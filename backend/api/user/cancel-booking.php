<?php
session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function jsonResponse($statusCode, $data) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse(405, [
        "success" => false,
        "error" => "Method not allowed."
    ]);
}

if (!isset($_SESSION["user_id"])) {
    jsonResponse(401, [
        "success" => false,
        "error" => "Unauthorized. Please login again."
    ]);
}

$userId = (int) $_SESSION["user_id"];

$input = [];

if (!empty($_POST)) {
    $input = $_POST;
} else {
    $rawInput = file_get_contents("php://input");
    $jsonInput = json_decode($rawInput, true);

    if (is_array($jsonInput)) {
        $input = $jsonInput;
    }
}

$bookingId = isset($input["booking_id"]) ? (int) $input["booking_id"] : 0;
$reason = isset($input["reason"]) ? trim((string) $input["reason"]) : "";

if ($bookingId <= 0) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid booking ID."
    ]);
}

if (strlen($reason) < 10) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Please provide a reason of at least 10 characters."
    ]);
}

if (strlen($reason) > 500) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Reason must not exceed 500 characters."
    ]);
}

$stmt = $conn->prepare("
    SELECT
        id,
        user_id,
        booking_type,
        status,
        payment_status,
        cancel_requested
    FROM bookings
    WHERE id = ?
    LIMIT 1
");

if (!$stmt) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while checking booking."
    ]);
}

$stmt->bind_param("i", $bookingId);
$stmt->execute();

$result = $stmt->get_result();
$booking = $result->fetch_assoc();
$stmt->close();

if (!$booking) {
    jsonResponse(404, [
        "success" => false,
        "error" => "Booking not found."
    ]);
}

if ((int) $booking["user_id"] !== $userId) {
    jsonResponse(403, [
        "success" => false,
        "error" => "You are not allowed to cancel this booking."
    ]);
}

$bookingType = strtolower(trim((string) ($booking["booking_type"] ?? "")));
$status = strtolower(trim((string) ($booking["status"] ?? "")));

$allowedBookingTypes = [
    "event_booking",
    "private_workshop",
    "custom"
];

if (!in_array($bookingType, $allowedBookingTypes, true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "This booking type cannot be cancelled from this page."
    ]);
}

if (!in_array($status, ["pending", "approved"], true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "This booking cannot be cancelled because its status is " . ($booking["status"] ?? "unknown") . "."
    ]);
}

if ((int) ($booking["cancel_requested"] ?? 0) === 1) {
    jsonResponse(409, [
        "success" => false,
        "error" => "A cancellation request has already been submitted for this booking."
    ]);
}

$now = date("Y-m-d H:i:s");

$upd = $conn->prepare("
    UPDATE bookings
    SET
        cancel_requested = 1,
        cancel_reason = ?,
        cancel_requested_at = ?
    WHERE id = ?
      AND user_id = ?
      AND cancel_requested = 0
");

if (!$upd) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while preparing cancellation request."
    ]);
}

$upd->bind_param("ssii", $reason, $now, $bookingId, $userId);

if (!$upd->execute()) {
    $upd->close();

    jsonResponse(500, [
        "success" => false,
        "error" => "Failed to submit cancellation request."
    ]);
}

if ($upd->affected_rows <= 0) {
    $upd->close();

    jsonResponse(409, [
        "success" => false,
        "error" => "A cancellation request may have already been submitted for this booking."
    ]);
}

$upd->close();

jsonResponse(200, [
    "success" => true,
    "message" => "Cancellation request submitted. The admin will review your request.",
    "booking_id" => $bookingId,
    "booking_type" => $bookingType,
    "cancel_requested" => 1,
    "cancel_requested_at" => $now
]);
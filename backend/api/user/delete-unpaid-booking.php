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

if ($bookingId <= 0) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid booking ID."
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
        "error" => "You are not allowed to delete this booking."
    ]);
}

$bookingType = strtolower(trim((string) ($booking["booking_type"] ?? "")));
$status = strtolower(trim((string) ($booking["status"] ?? "")));
$paymentStatus = strtolower(trim((string) ($booking["payment_status"] ?? "")));

$allowedBookingTypes = [
    "event_booking",
    "private_workshop",
    "custom"
];

if (!in_array($bookingType, $allowedBookingTypes, true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "This booking type cannot be deleted from this page."
    ]);
}

/*
  Only unpaid bookings can be deleted by user.
  Paid, partial, and pending proof bookings should not be deleted.
*/
if ($paymentStatus !== "unpaid") {
    jsonResponse(400, [
        "success" => false,
        "error" => "Only unpaid bookings can be deleted."
    ]);
}

/*
  Only early bookings can be deleted.
  Approved bookings should use cancellation request instead.
*/
if (!in_array($status, ["pending_payment", "pending"], true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "This booking cannot be deleted because its status is " . ($booking["status"] ?? "unknown") . "."
    ]);
}

if ((int) ($booking["cancel_requested"] ?? 0) === 1) {
    jsonResponse(409, [
        "success" => false,
        "error" => "This booking already has a cancellation request."
    ]);
}

/*
  Safety check:
  If there is already a pending or paid payment proof, do not delete.
*/
$paymentCheck = $conn->prepare("
    SELECT id
    FROM payments
    WHERE booking_id = ?
      AND status IN ('pending', 'paid')
    LIMIT 1
");

if (!$paymentCheck) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while checking payments."
    ]);
}

$paymentCheck->bind_param("i", $bookingId);
$paymentCheck->execute();

$paymentResult = $paymentCheck->get_result();
$existingPayment = $paymentResult->fetch_assoc();

$paymentCheck->close();

if ($existingPayment) {
    jsonResponse(409, [
        "success" => false,
        "error" => "This booking already has a payment record and cannot be deleted."
    ]);
}

$conn->begin_transaction();

try {
    /*
      Remove rejected/unused payment rows first, if any.
      This prevents foreign key issues if your payments table references bookings.
    */
    $deletePayments = $conn->prepare("
        DELETE FROM payments
        WHERE booking_id = ?
          AND status = 'rejected'
    ");

    if (!$deletePayments) {
        throw new Exception("Database error while preparing payment cleanup.");
    }

    $deletePayments->bind_param("i", $bookingId);
    $deletePayments->execute();
    $deletePayments->close();

    /*
      Optional cleanup if your database has payment_reviews.
      This is safe only if the table exists.
    */
    $tableCheck = $conn->query("SHOW TABLES LIKE 'payment_reviews'");

    if ($tableCheck && $tableCheck->num_rows > 0) {
        $deleteReviews = $conn->prepare("
            DELETE FROM payment_reviews
            WHERE booking_id = ?
        ");

        if ($deleteReviews) {
            $deleteReviews->bind_param("i", $bookingId);
            $deleteReviews->execute();
            $deleteReviews->close();
        }
    }

    $deleteBooking = $conn->prepare("
        DELETE FROM bookings
        WHERE id = ?
          AND user_id = ?
          AND payment_status = 'unpaid'
          AND status IN ('pending_payment', 'pending')
        LIMIT 1
    ");

    if (!$deleteBooking) {
        throw new Exception("Database error while preparing booking delete.");
    }

    $deleteBooking->bind_param("ii", $bookingId, $userId);
    $deleteBooking->execute();

    if ($deleteBooking->affected_rows <= 0) {
        $deleteBooking->close();
        throw new Exception("Booking was not deleted. It may have already changed status.");
    }

    $deleteBooking->close();

    $conn->commit();

    jsonResponse(200, [
        "success" => true,
        "message" => "Unpaid booking deleted successfully.",
        "booking_id" => $bookingId,
        "booking_type" => $bookingType
    ]);
} catch (Exception $e) {
    $conn->rollback();

    jsonResponse(500, [
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
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

function readInput() {
    if (!empty($_POST)) {
        return $_POST;
    }

    $rawInput = file_get_contents("php://input");
    $jsonInput = json_decode($rawInput, true);

    return is_array($jsonInput) ? $jsonInput : [];
}

function daysBeforeEvent($eventDate) {
    $today = new DateTime("today", new DateTimeZone("Asia/Manila"));
    $event = new DateTime($eventDate . " 00:00:00", new DateTimeZone("Asia/Manila"));

    return (int) $today->diff($event)->format("%r%a");
}

function detectDateFromSchedule($scheduleText, $fallbackDate) {
    $scheduleText = trim((string) $scheduleText);

    if ($scheduleText !== "") {
        $timestamp = strtotime($scheduleText);

        if ($timestamp !== false) {
            return date("Y-m-d", $timestamp);
        }
    }

    return $fallbackDate;
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
$input = readInput();

$refundType = strtolower(trim((string) ($input["refund_type"] ?? "")));
$reason = trim((string) ($input["reason"] ?? ""));
$bookingId = isset($input["booking_id"]) ? (int) $input["booking_id"] : 0;
$registrationId = isset($input["registration_id"]) ? (int) $input["registration_id"] : 0;

if (!in_array($refundType, ["booking", "workshop_registration"], true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid refund type."
    ]);
}

if (strlen($reason) < 10) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Please provide a refund reason of at least 10 characters."
    ]);
}

if (strlen($reason) > 800) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Refund reason must not exceed 800 characters."
    ]);
}

$eventDate = null;
$amountPaid = 0.00;
$totalAmount = 0.00;

if ($refundType === "booking") {
    if ($bookingId <= 0) {
        jsonResponse(400, [
            "success" => false,
            "error" => "Invalid booking ID."
        ]);
    }

    $stmt = $conn->prepare("
        SELECT
            b.id,
            b.user_id,
            b.booking_date,
            b.booking_type,
            b.status,
            b.payment_status,
            b.total_amount,
            b.amount_paid,
            COALESCE(SUM(
                CASE
                    WHEN p.status = 'paid' THEN p.amount
                    ELSE 0
                END
            ), 0) AS paid_from_payments
        FROM bookings b
        LEFT JOIN payments p
            ON p.booking_id = b.id
        WHERE b.id = ?
        GROUP BY
            b.id,
            b.user_id,
            b.booking_date,
            b.booking_type,
            b.status,
            b.payment_status,
            b.total_amount,
            b.amount_paid
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
            "error" => "You are not allowed to request a refund for this booking."
        ]);
    }

    $eventDate = $booking["booking_date"];
    $amountPaid = max((float) $booking["amount_paid"], (float) $booking["paid_from_payments"]);
    $totalAmount = (float) $booking["total_amount"];
}

if ($refundType === "workshop_registration") {
    if ($registrationId <= 0) {
        jsonResponse(400, [
            "success" => false,
            "error" => "Invalid registration ID."
        ]);
    }

    $stmt = $conn->prepare("
        SELECT
            wr.id,
            wr.user_id,
            wr.status,
            wr.payment_status,
            wr.total_amount,
            wr.created_at,
            wp.schedule,
            COALESCE(SUM(
                CASE
                    WHEN p.status = 'paid' THEN p.amount
                    ELSE 0
                END
            ), 0) AS paid_from_payments
        FROM workshop_registrations wr
        LEFT JOIN workshops_public wp
            ON wp.id = wr.workshop_id
        LEFT JOIN payments p
            ON p.registration_id = wr.id
        WHERE wr.id = ?
        GROUP BY
            wr.id,
            wr.user_id,
            wr.status,
            wr.payment_status,
            wr.total_amount,
            wr.created_at,
            wp.schedule
        LIMIT 1
    ");

    if (!$stmt) {
        jsonResponse(500, [
            "success" => false,
            "error" => "Database error while checking workshop registration."
        ]);
    }

    $stmt->bind_param("i", $registrationId);
    $stmt->execute();

    $result = $stmt->get_result();
    $registration = $result->fetch_assoc();

    $stmt->close();

    if (!$registration) {
        jsonResponse(404, [
            "success" => false,
            "error" => "Workshop registration not found."
        ]);
    }

    if ((int) $registration["user_id"] !== $userId) {
        jsonResponse(403, [
            "success" => false,
            "error" => "You are not allowed to request a refund for this registration."
        ]);
    }

    $fallbackDate = date("Y-m-d", strtotime($registration["created_at"]));
    $eventDate = detectDateFromSchedule($registration["schedule"] ?? "", $fallbackDate);
    $amountPaid = (float) $registration["paid_from_payments"];
    $totalAmount = (float) $registration["total_amount"];
}

if (!$eventDate) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Unable to determine the event date."
    ]);
}

$daysBefore = daysBeforeEvent($eventDate);

if ($daysBefore < 7) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Refund requests must be submitted at least 1 week before the actual event."
    ]);
}

if ($amountPaid <= 0) {
    jsonResponse(400, [
        "success" => false,
        "error" => "No paid amount was found for this transaction."
    ]);
}

$duplicateSql = $refundType === "booking"
    ? "SELECT id FROM refund_requests WHERE booking_id = ? AND refund_type = 'booking' AND status = 'pending' LIMIT 1"
    : "SELECT id FROM refund_requests WHERE registration_id = ? AND refund_type = 'workshop_registration' AND status = 'pending' LIMIT 1";

$dup = $conn->prepare($duplicateSql);

if (!$dup) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while checking refund request."
    ]);
}

$targetId = $refundType === "booking" ? $bookingId : $registrationId;

$dup->bind_param("i", $targetId);
$dup->execute();

$dupResult = $dup->get_result();
$existing = $dupResult->fetch_assoc();

$dup->close();

if ($existing) {
    jsonResponse(409, [
        "success" => false,
        "error" => "A pending refund request already exists for this transaction."
    ]);
}

/*
  Refund policy:
  Only 50% of the paid amount is refundable.
*/
$refundableAmount = round($amountPaid * 0.50, 2);

$insert = $conn->prepare("
    INSERT INTO refund_requests (
        user_id,
        booking_id,
        registration_id,
        refund_type,
        reason,
        amount_paid,
        refundable_amount,
        status,
        created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
");

if (!$insert) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while creating refund request."
    ]);
}

$nullableBookingId = $refundType === "booking" ? $bookingId : null;
$nullableRegistrationId = $refundType === "workshop_registration" ? $registrationId : null;

$insert->bind_param(
    "iiissdd",
    $userId,
    $nullableBookingId,
    $nullableRegistrationId,
    $refundType,
    $reason,
    $amountPaid,
    $refundableAmount
);

if (!$insert->execute()) {
    $insert->close();

    jsonResponse(500, [
        "success" => false,
        "error" => "Failed to submit refund request."
    ]);
}

$refundId = $insert->insert_id;
$insert->close();

jsonResponse(200, [
    "success" => true,
    "message" => "Refund request submitted. The admin will review your request.",
    "refund_id" => $refundId,
    "amount_paid" => $amountPaid,
    "refundable_amount" => $refundableAmount,
    "refund_policy" => "50% of the paid amount"
]);
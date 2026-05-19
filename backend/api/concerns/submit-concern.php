<?php
session_start();
require_once __DIR__ . "/../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$userId = (int)$_SESSION["user_id"];

// FIXED: Reads incoming React JSON stream. Falls back to standard $_POST if needed.
$data = json_decode(file_get_contents("php://input"), true) ?: $_POST;

$subject = trim($data["subject"] ?? "");
$type    = trim($data["concern_type"] ?? "Other");
$bookingIdRaw = trim($data["booking_id"] ?? "");
$details = trim($data["details"] ?? "");

$allowedTypes = ["Booking Issue", "Website Error", "Payment Issue", "Other"];
if (!in_array($type, $allowedTypes, true)) {
    $type = "Other";
}

$bookingId = null;
if ($bookingIdRaw !== "") {
    if (!ctype_digit($bookingIdRaw)) {
        echo json_encode(["error" => "Booking ID must be numeric"]);
        exit();
    }
    $bookingId = (int)$bookingIdRaw;
}

// FIXED: Removed the minimum character requirement. It only fails if completely empty.
if ($subject === "") {
    echo json_encode(["error" => "Subject is required"]);
    exit();
}

if ($details === "" || strlen($details) < 15) {
    echo json_encode(["error" => "Details too short"]);
    exit();
}

if ($bookingId === null) {
    $stmt = $conn->prepare("INSERT INTO concerns (user_id, subject, concern_type, booking_id, details) VALUES (?, ?, ?, NULL, ?)");
    $stmt->bind_param("isss", $userId, $subject, $type, $details);
} else {
    $stmt = $conn->prepare("INSERT INTO concerns (user_id, subject, concern_type, booking_id, details) VALUES (?, ?, ?, ?, ?)");
    $stmt->bind_param("issis", $userId, $subject, $type, $bookingId, $details);
}

$stmt->execute();
$stmt->close();

echo json_encode(["success" => true]);
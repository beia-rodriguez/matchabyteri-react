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

$subject = trim($_POST["subject"] ?? "");
$type    = trim($_POST["concern_type"] ?? "Other");
$bookingIdRaw = trim($_POST["booking_id"] ?? "");
$details = trim($_POST["details"] ?? "");

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

if ($subject === "" || strlen($subject) < 4) {
    echo json_encode(["error" => "Subject too short"]);
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
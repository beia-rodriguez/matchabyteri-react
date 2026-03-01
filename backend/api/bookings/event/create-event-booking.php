<?php
session_start();
require_once "../../../config/db.php";

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

$date = $data["date"] ?? "";
$start_time = $data["start_time"] ?? "";
$end_time = $data["end_time"] ?? "";
$draft = $data["draft"] ?? [];

if (!$date || !$start_time || !$end_time) {
    echo json_encode(["error" => "Missing required data"]);
    exit();
}

$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE);

$stmt = $conn->prepare("
    INSERT INTO bookings
    (user_id, booking_date, start_time, end_time, booking_type, status, notes, payment_status)
    VALUES (?, ?, ?, ?, 'event', 'pending', ?, 'unpaid')
");

$stmt->bind_param("issss", $user_id, $date, $start_time, $end_time, $notesJson);

if (!$stmt->execute()) {
    echo json_encode(["error" => "Database error"]);
    exit();
}

$bookingId = $conn->insert_id;
$stmt->close();

echo json_encode([
    "success" => true,
    "booking_id" => $bookingId
]);
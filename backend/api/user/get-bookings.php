<?php
session_start();
require_once __DIR__ . "/../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$id = (int)$_SESSION["user_id"];

$private = [];
$stmt = $conn->prepare("
  SELECT id, booking_date, start_time, end_time, booking_type, status, created_at
  FROM bookings
  WHERE user_id = ?
  ORDER BY booking_date DESC
");
$stmt->bind_param("i", $id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    $private[] = $row;
}
$stmt->close();

echo json_encode([
  "privateBookings" => $private
]);
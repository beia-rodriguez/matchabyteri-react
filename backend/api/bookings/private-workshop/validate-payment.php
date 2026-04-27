<?php
session_start();
require_once "../../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["valid" => false]);
  exit();
}

$user_id = $_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

$booking_id = (int)($data["booking_id"] ?? 0);
$token = $data["pay_token"] ?? "";

$stmt = $conn->prepare("
  SELECT b.booking_date
  FROM bookings b
  JOIN payments p ON p.booking_id = b.id
  WHERE b.id = ?
    AND b.user_id = ?
    AND b.booking_type = 'workshop'
    AND p.payment_token = ?
    AND p.purpose = 'workshop_booking'
    AND p.status IN ('pending','paid')
  LIMIT 1
");

$stmt->bind_param("iis", $booking_id, $user_id, $token);
$stmt->execute();
$res = $stmt->get_result();

if ($row = $res->fetch_assoc()) {
  echo json_encode([
    "valid" => true,
    "date" => $row["booking_date"]
  ]);
} else {
  echo json_encode(["valid" => false]);
}
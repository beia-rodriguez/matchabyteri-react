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
  SELECT
    id,
    booking_date,
    start_time,
    end_time,
    booking_type,
    status,
    payment_status,
    total_amount,
    cancel_requested,
    cancel_reason,
    created_at
  FROM bookings
  WHERE user_id = ?
  ORDER BY booking_date DESC
");
$stmt->bind_param("i", $id);
$stmt->execute();
$res = $stmt->get_result();
while ($row = $res->fetch_assoc()) {
    // Normalize nulls so the front end always has defined keys
    $row["payment_status"]   = $row["payment_status"]   ?? "unpaid";
    $row["total_amount"]     = (float)($row["total_amount"] ?? 0);
    $row["cancel_requested"] = (bool)($row["cancel_requested"] ?? false);
    $row["cancel_reason"]    = $row["cancel_reason"] ?? "";
    $private[] = $row;
}
$stmt->close();
 
echo json_encode([
  "privateBookings" => $private
]);
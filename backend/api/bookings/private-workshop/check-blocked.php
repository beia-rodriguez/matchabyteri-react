<?php
require_once "../../../config/db.php";
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

$date = $data["date"] ?? "";
$start = $data["start_time"] ?? "";
$end = $data["end_time"] ?? "";

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  echo json_encode(["error" => "Invalid date"]);
  exit();
}

/* ===== DAY FULL CHECK ===== */
$MAX = 2;

$stmt = $conn->prepare("
  SELECT COUNT(*) as c
  FROM bookings
  WHERE booking_date = ?
    AND status IN ('pending','approved')
");
$stmt->bind_param("s", $date);
$stmt->execute();
$count = $stmt->get_result()->fetch_assoc()["c"] ?? 0;
$stmt->close();

if ($count >= $MAX) {
  echo json_encode([
    "day_full" => true,
    "conflict" => false
  ]);
  exit();
}

/* ===== TIME CONFLICT CHECK ===== */

$stmt = $conn->prepare("
  SELECT id
  FROM bookings
  WHERE booking_date = ?
    AND status IN ('pending','approved')
    AND (start_time < ? AND end_time > ?)
  LIMIT 1
");

$stmt->bind_param("sss", $date, $end, $start);
$stmt->execute();
$conflict = $stmt->get_result()->num_rows > 0;
$stmt->close();

echo json_encode([
  "day_full" => false,
  "conflict" => $conflict
]);
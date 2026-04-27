<?php
session_start();
require_once "../../../config/db.php";
header("Content-Type: application/json");

$data = json_decode(file_get_contents("php://input"), true);

$date = $data["date"] ?? "";
$type = $data["type"] ?? "";
$start = $data["start_time"] ?? "";
$end = $data["end_time"] ?? "";

$MAX_EVENT_PER_DAY = 3;
$MAX_WORKSHOP_PER_DAY = 2;

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
    echo json_encode(["error" => "Invalid date"]);
    exit();
}

/* ==========================
   DAY FULL CHECK (BY TYPE)
========================== */

$stmt = $conn->prepare("
    SELECT COUNT(*) as c
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = ?
      AND status IN ('pending','approved')
");

$stmt->bind_param("ss", $date, $type);
$stmt->execute();
$count = $stmt->get_result()->fetch_assoc()["c"] ?? 0;
$stmt->close();

if ($type === "event" && $count >= $MAX_EVENT_PER_DAY) {
    echo json_encode(["day_full" => true, "conflict" => false]);
    exit();
}

if ($type === "workshop" && $count >= $MAX_WORKSHOP_PER_DAY) {
    echo json_encode(["day_full" => true, "conflict" => false]);
    exit();
}

/* ==========================
   TIME CONFLICT CHECK
   ONLY SAME TYPE
========================== */

$stmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = ?
      AND status IN ('pending','approved')
      AND (start_time < ? AND end_time > ?)
    LIMIT 1
");

$stmt->bind_param("ssss", $date, $type, $end, $start);
$stmt->execute();
$conflict = $stmt->get_result()->num_rows > 0;
$stmt->close();

echo json_encode([
    "day_full" => false,
    "conflict" => $conflict
]);
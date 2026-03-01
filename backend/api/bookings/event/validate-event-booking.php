<?php
session_start();
require_once "../../../config/db.php";

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$data = json_decode(file_get_contents("php://input"), true);

$date = $data["date"] ?? "";
$start_time = $data["start_time"] ?? "";
$end_time = $data["end_time"] ?? "";

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
    echo json_encode(["error" => "Invalid date"]);
    exit();
}

if (!$start_time || !$end_time) {
    echo json_encode(["error" => "Time required"]);
    exit();
}

$startTs = strtotime("$date $start_time");
$endTs   = strtotime("$date $end_time");

if ($endTs <= $startTs) {
    echo json_encode(["error" => "End time must be after start time"]);
    exit();
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
    echo json_encode(["error" => "Work hours must be up to 4 hours only"]);
    exit();
}

/* Blocked date check */
$stmt = $conn->prepare("SELECT id FROM blocked_dates WHERE block_date = ?");
$stmt->bind_param("s", $date);
$stmt->execute();

if ($stmt->get_result()->num_rows > 0) {
    echo json_encode(["error" => "Date is blocked"]);
    exit();
}
$stmt->close();

/* Max per day check */
$MAX_BOOKINGS_PER_DAY = 2;

$stmt = $conn->prepare("
    SELECT COUNT(*) c FROM bookings
    WHERE booking_date = ?
    AND status IN ('pending','approved')
");
$stmt->bind_param("s", $date);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ((int)$res["c"] >= $MAX_BOOKINGS_PER_DAY) {
    echo json_encode(["error" => "Day is fully booked"]);
    exit();
}

/* Overlap check */
$stmt = $conn->prepare("
    SELECT id FROM bookings
    WHERE booking_date = ?
    AND status IN ('pending','approved')
    AND (start_time < ? AND end_time > ?)
    LIMIT 1
");
$stmt->bind_param("sss", $date, $end_time, $start_time);
$stmt->execute();

if ($stmt->get_result()->num_rows > 0) {
    echo json_encode(["error" => "Time slot already booked"]);
    exit();
}
$stmt->close();

echo json_encode(["success" => true]);
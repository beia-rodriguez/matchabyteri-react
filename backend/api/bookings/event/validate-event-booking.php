<?php

session_start();

require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function fail($message, $status = 400, $extra = []) {
  http_response_code($status);
  echo json_encode(array_merge([
    "success" => false,
    "error" => $message
  ], $extra));
  exit();
}

function normalize_time_value($value, $label) {
  $value = trim((string)$value);

  if (!preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $value)) {
    fail("Invalid {$label} time format.");
  }

  return strlen($value) === 5 ? $value . ":00" : $value;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  fail("Method not allowed", 405);
}

if (!isset($_SESSION["user_id"])) {
  fail("Unauthorized", 401);
}

if (isset($_SESSION["role"]) && $_SESSION["role"] === "admin") {
  fail("Admins cannot book events.", 403);
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  fail("Invalid request.");
}

$date = trim($data["date"] ?? "");
$start_time = normalize_time_value($data["start_time"] ?? "", "start");
$end_time = normalize_time_value($data["end_time"] ?? "", "end");

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  fail("Invalid date.");
}

if ($date < date("Y-m-d")) {
  fail("Past dates are not allowed.");
}

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  fail("End time must be after start time.");
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  fail("Work hours must be up to 4 hours only.");
}

try {
  $stmt = $conn->prepare("
    SELECT reason
    FROM blocked_dates
    WHERE block_date = ?
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to check blocked date.");
  }

  $stmt->bind_param("s", $date);
  $stmt->execute();

  $result = $stmt->get_result();
  $blocked = $result ? $result->fetch_assoc() : null;

  $stmt->close();

  if ($blocked) {
    fail("Sorry, this date is not available.", 400, [
      "reason" => $blocked["reason"] ?? ""
    ]);
  }

  $MAX_EVENT_PER_DAY = 3;

  $stmt = $conn->prepare("
    SELECT COUNT(*) AS c
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'event_booking'
      AND status IN ('pending_payment', 'pending', 'approved')
  ");

  if (!$stmt) {
    throw new Exception("Failed to check booking count.");
  }

  $stmt->bind_param("s", $date);
  $stmt->execute();

  $result = $stmt->get_result();
  $row = $result ? $result->fetch_assoc() : null;
  $count = (int)($row["c"] ?? 0);

  $stmt->close();

  if ($count >= $MAX_EVENT_PER_DAY) {
    fail("Sorry, this day is fully booked.");
  }

  $stmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'event_booking'
      AND status IN ('pending_payment', 'pending', 'approved')
      AND (start_time < ? AND end_time > ?)
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to check time conflict.");
  }

  $stmt->bind_param("sss", $date, $end_time, $start_time);
  $stmt->execute();

  $result = $stmt->get_result();
  $hasConflict = $result && $result->num_rows > 0;

  $stmt->close();

  if ($hasConflict) {
    fail("That time slot is already booked.");
  }

  echo json_encode([
    "success" => true,
    "message" => "Booking schedule is available."
  ]);
  exit();

} catch (Exception $e) {
  error_log("validate-event-booking error: " . $e->getMessage());

  fail("Failed to validate event booking.", 500, [
    "details" => $e->getMessage()
  ]);
}

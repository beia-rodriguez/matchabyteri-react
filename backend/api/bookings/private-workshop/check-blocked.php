<?php

require_once "../../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode([
    "success" => false,
    "error" => "Method not allowed"
  ]);
  exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid request body"
  ]);
  exit();
}

$date = trim($data["date"] ?? "");
$start = trim($data["start_time"] ?? "");
$end = trim($data["end_time"] ?? "");

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid date format"
  ]);
  exit();
}

$today = date("Y-m-d");

if ($date < $today) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Past dates are not allowed"
  ]);
  exit();
}

try {
  $blockedStmt = $conn->prepare("
    SELECT reason
    FROM blocked_dates
    WHERE block_date = ?
    LIMIT 1
  ");

  if (!$blockedStmt) {
    throw new Exception("Failed to prepare blocked date query.");
  }

  $blockedStmt->bind_param("s", $date);
  $blockedStmt->execute();
  $blocked = $blockedStmt->get_result()->fetch_assoc();
  $blockedStmt->close();

  if ($blocked) {
    echo json_encode([
      "success" => true,
      "blocked" => true,
      "day_full" => false,
      "conflict" => false,
      "reason" => $blocked["reason"] ?? ""
    ]);
    exit();
  }

  $MAX_PER_DAY = 2;

  $countStmt = $conn->prepare("
    SELECT COUNT(*) AS c
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'workshop'
      AND status IN ('pending','approved')
  ");

  if (!$countStmt) {
    throw new Exception("Failed to prepare count query.");
  }

  $countStmt->bind_param("s", $date);
  $countStmt->execute();
  $count = (int)($countStmt->get_result()->fetch_assoc()["c"] ?? 0);
  $countStmt->close();

  if ($count >= $MAX_PER_DAY) {
    echo json_encode([
      "success" => true,
      "blocked" => false,
      "day_full" => true,
      "conflict" => false
    ]);
    exit();
  }

  if ($start === "" && $end === "") {
    echo json_encode([
      "success" => true,
      "blocked" => false,
      "day_full" => false,
      "conflict" => false
    ]);
    exit();
  }

  if (
    !preg_match("/^\d{2}:\d{2}$/", $start) ||
    !preg_match("/^\d{2}:\d{2}$/", $end)
  ) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Invalid time format"
    ]);
    exit();
  }

  $start .= ":00";
  $end .= ":00";

  $startTs = strtotime("$date $start");
  $endTs = strtotime("$date $end");

  if (!$startTs || !$endTs || $endTs <= $startTs) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Invalid time range"
    ]);
    exit();
  }

  if (($endTs - $startTs) > (4 * 60 * 60)) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Workshop time must be up to 4 hours only"
    ]);
    exit();
  }

  $conflictStmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'workshop'
      AND status IN ('pending','approved')
      AND (start_time < ? AND end_time > ?)
    LIMIT 1
  ");

  if (!$conflictStmt) {
    throw new Exception("Failed to prepare conflict query.");
  }

  $conflictStmt->bind_param("sss", $date, $end, $start);
  $conflictStmt->execute();
  $conflict = $conflictStmt->get_result()->num_rows > 0;
  $conflictStmt->close();

  echo json_encode([
    "success" => true,
    "blocked" => false,
    "day_full" => false,
    "conflict" => $conflict
  ]);
  exit();

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage()
  ]);
  exit();
}
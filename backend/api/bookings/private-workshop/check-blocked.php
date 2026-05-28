<?php

session_start();

require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["success" => false, "error" => "Method not allowed"]);
  exit();
}

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["success" => false, "error" => "Unauthorized"]);
  exit();
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["success" => false, "error" => "Invalid request"]);
  exit();
}

$date = trim($data["date"] ?? "");
$start_time = trim($data["start_time"] ?? "");
$end_time = trim($data["end_time"] ?? "");

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  http_response_code(400);
  echo json_encode(["success" => false, "error" => "Invalid date"]);
  exit();
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
  $blocked = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if ($blocked) {
    echo json_encode([
      "success" => true,
      "blocked" => true,
      "reason" => $blocked["reason"] ?? "This date is not available."
    ]);
    exit();
  }

  $MAX_PER_DAY = 2;

  $stmt = $conn->prepare("
    SELECT COUNT(*) AS c
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'private_workshop'
      AND status IN ('pending_payment', 'pending', 'approved')
  ");

  if (!$stmt) {
    throw new Exception("Failed to check booking count.");
  }

  $stmt->bind_param("s", $date);
  $stmt->execute();
  $count = (int)($stmt->get_result()->fetch_assoc()["c"] ?? 0);
  $stmt->close();

  if ($count >= $MAX_PER_DAY) {
    echo json_encode([
      "success" => true,
      "blocked" => false,
      "day_full" => true,
      "conflict" => false
    ]);
    exit();
  }

  $conflict = false;

  if ($start_time !== "" && $end_time !== "") {
    if (!preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $start_time) ||
        !preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $end_time)) {
      http_response_code(400);
      echo json_encode(["success" => false, "error" => "Invalid time format"]);
      exit();
    }

    if (strlen($start_time) === 5) $start_time .= ":00";
    if (strlen($end_time) === 5) $end_time .= ":00";

    $startTs = strtotime("$date $start_time");
    $endTs = strtotime("$date $end_time");

    if (!$startTs || !$endTs || $endTs <= $startTs) {
      http_response_code(400);
      echo json_encode(["success" => false, "error" => "End time must be after start time"]);
      exit();
    }

    if (($endTs - $startTs) > (4 * 60 * 60)) {
      http_response_code(400);
      echo json_encode(["success" => false, "error" => "Workshop time must be up to 4 hours only."]);
      exit();
    }

    $stmt = $conn->prepare("
      SELECT id
      FROM bookings
      WHERE booking_date = ?
        AND booking_type = 'private_workshop'
        AND status IN ('pending_payment', 'pending', 'approved')
        AND (start_time < ? AND end_time > ?)
      LIMIT 1
    ");

    if (!$stmt) {
      throw new Exception("Failed to check time conflict.");
    }

    $stmt->bind_param("sss", $date, $end_time, $start_time);
    $stmt->execute();
    $conflict = $stmt->get_result()->num_rows > 0;
    $stmt->close();
  }

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

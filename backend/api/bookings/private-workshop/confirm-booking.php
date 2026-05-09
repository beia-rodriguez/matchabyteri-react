<?php

session_start();

require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit();
}

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

if (isset($_SESSION["role"]) && $_SESSION["role"] === "admin") {
  http_response_code(403);
  echo json_encode(["error" => "Admins cannot book workshops"]);
  exit();
}

$user_id = (int)$_SESSION["user_id"];

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid request"]);
  exit();
}

$date = trim($data["date"] ?? "");
$draft = $data["draft"] ?? [];
$form_id = isset($data["form_id"]) ? (int)$data["form_id"] : null;
$total_amount = isset($data["total_amount"]) ? (float)$data["total_amount"] : 0;
$form_snapshot = $data["form_snapshot"] ?? null;

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid date"]);
  exit();
}

if ($date < date("Y-m-d")) {
  http_response_code(400);
  echo json_encode(["error" => "Past dates are not allowed"]);
  exit();
}

if (!is_array($draft)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking data"]);
  exit();
}

if (!$form_id) {
  http_response_code(400);
  echo json_encode(["error" => "Missing booking form"]);
  exit();
}

if ($total_amount <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid total amount"]);
  exit();
}

$start_time = trim($draft["start_time"] ?? "");
$end_time = trim($draft["end_time"] ?? "");

if ($start_time === "" || $end_time === "") {
  http_response_code(400);
  echo json_encode(["error" => "Missing start or end time"]);
  exit();
}

if (!preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $start_time)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid start time"]);
  exit();
}

if (!preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $end_time)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid end time"]);
  exit();
}

if (strlen($start_time) === 5) $start_time .= ":00";
if (strlen($end_time) === 5) $end_time .= ":00";

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid time selection"]);
  exit();
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  http_response_code(400);
  echo json_encode(["error" => "Workshop time must be up to 4 hours only."]);
  exit();
}

$draft["start_time"] = $start_time;
$draft["end_time"] = $end_time;

$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($notesJson === false || $notesJson === "") {
  $notesJson = "{}";
}

$snapshotJson = json_encode($form_snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($snapshotJson === false || $snapshotJson === "") {
  $snapshotJson = "{}";
}

$conn->begin_transaction();

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
    throw new Exception("This date is not available.");
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
    throw new Exception("This day is fully booked.");
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

  $conflictStmt->bind_param("sss", $date, $end_time, $start_time);
  $conflictStmt->execute();
  $conflict = $conflictStmt->get_result()->num_rows > 0;
  $conflictStmt->close();

  if ($conflict) {
    throw new Exception("That time slot is already booked.");
  }

  $insert = $conn->prepare("
    INSERT INTO bookings
      (
        user_id,
        booking_date,
        start_time,
        end_time,
        booking_type,
        status,
        notes,
        total_amount,
        payment_status,
        form_id,
        form_snapshot
      )
    VALUES
      (?, ?, ?, ?, 'workshop', 'pending', ?, ?, 'unpaid', ?, ?)
  ");

  if (!$insert) {
    throw new Exception("Failed to prepare booking.");
  }

  $insert->bind_param(
    "issssdis",
    $user_id,
    $date,
    $start_time,
    $end_time,
    $notesJson,
    $total_amount,
    $form_id,
    $snapshotJson
  );

  if (!$insert->execute()) {
    throw new Exception("Insert failed: " . $insert->error);
  }

  $bookingId = $conn->insert_id;
  $insert->close();

  $conn->commit();

  echo json_encode([
    "success" => true,
    "booking_id" => $bookingId,
    "total_amount" => $total_amount
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  http_response_code(400);
  echo json_encode([
    "error" => $e->getMessage()
  ]);
  exit();
}
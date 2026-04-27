<?php
session_start();
require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid request"]);
  exit();
}

$date = $data["date"] ?? "";
$start_time = $data["start_time"] ?? "";
$end_time = $data["end_time"] ?? "";
$draft = $data["draft"] ?? [];
$form_id = isset($data["form_id"]) ? (int)$data["form_id"] : null;
$total_amount = isset($data["total_amount"]) ? (float)$data["total_amount"] : 0;
$form_snapshot = $data["form_snapshot"] ?? null;

if (!$date || !$start_time || !$end_time || !is_array($draft)) {
  http_response_code(400);
  echo json_encode(["error" => "Missing required data"]);
  exit();
}

if ($total_amount <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid total amount"]);
  exit();
}

if (strlen($start_time) === 5) $start_time .= ":00";
if (strlen($end_time) === 5) $end_time .= ":00";

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  http_response_code(400);
  echo json_encode(["error" => "End time must be after start time"]);
  exit();
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  http_response_code(400);
  echo json_encode(["error" => "Work hours must be up to 4 hours only"]);
  exit();
}

$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($notesJson === false) $notesJson = "{}";

$snapshotJson = json_encode($form_snapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($snapshotJson === false) $snapshotJson = "{}";

$conn->begin_transaction();

try {
  $blockedStmt = $conn->prepare("
    SELECT id
    FROM blocked_dates
    WHERE block_date = ?
    LIMIT 1
  ");
  $blockedStmt->bind_param("s", $date);
  $blockedStmt->execute();
  $blockedResult = $blockedStmt->get_result();
  $blockedStmt->close();

  if ($blockedResult->num_rows > 0) {
    throw new Exception("This date is not available.");
  }

  $stmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND status IN ('pending','approved')
      AND (start_time < ? AND end_time > ?)
    LIMIT 1
  ");
  $stmt->bind_param("sss", $date, $end_time, $start_time);
  $stmt->execute();
  $result = $stmt->get_result();
  $stmt->close();

  if ($result->num_rows > 0) {
    throw new Exception("That time slot is already booked. Please choose another time.");
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
      (?, ?, ?, ?, 'event', 'pending', ?, ?, 'unpaid', ?, ?)
  ");

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
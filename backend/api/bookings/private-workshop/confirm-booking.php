<?php

session_start();

require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

function fail($message, $status = 400) {
  http_response_code($status);
  echo json_encode(["success" => false, "error" => $message]);
  exit();
}

function normalize_time_value($value, $label) {
  $value = trim((string)$value);

  if (!preg_match("/^\d{2}:\d{2}(:\d{2})?$/", $value)) {
    fail("Invalid {$label} time");
  }

  return strlen($value) === 5 ? $value . ":00" : $value;
}

function get_setting($conn, $key, $default = 0.00) {
  $stmt = $conn->prepare("
    SELECT setting_value
    FROM pricing_settings
    WHERE setting_key = ?
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to load pricing setting.");
  }

  $stmt->bind_param("s", $key);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  return $row ? (float)$row["setting_value"] : (float)$default;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  fail("Method not allowed", 405);
}

if (!isset($_SESSION["user_id"])) {
  fail("Unauthorized", 401);
}

if (isset($_SESSION["role"]) && $_SESSION["role"] === "admin") {
  fail("Admins cannot book workshops", 403);
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  fail("Invalid request");
}

$date = trim($data["date"] ?? "");
$draft = $data["draft"] ?? [];

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  fail("Invalid date");
}

if ($date < date("Y-m-d")) {
  fail("Past dates are not allowed");
}

if (!is_array($draft)) {
  fail("Invalid booking data");
}

$start_time = normalize_time_value($draft["start_time"] ?? "", "start");
$end_time = normalize_time_value($draft["end_time"] ?? "", "end");

$standard_attendees = isset($draft["standard_attendees"]) ? (int)$draft["standard_attendees"] : 0;
$premium_attendees = isset($draft["premium_attendees"]) ? (int)$draft["premium_attendees"] : 0;
$total_attendees = isset($draft["total_attendees"]) ? (int)$draft["total_attendees"] : 0;

if ($total_attendees <= 0) {
  fail("Total attendees is required.");
}

if ($standard_attendees < 0 || $premium_attendees < 0) {
  fail("Attendee counts cannot be negative.");
}

if (($standard_attendees + $premium_attendees) !== $total_attendees) {
  fail("Standard attendees plus Premium attendees must equal Total attendees.");
}

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  fail("End time must be after start time.");
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  fail("Workshop time must be up to 4 hours only.");
}

$conn->begin_transaction();

try {
  $standard_price = get_setting($conn, "private_workshop_standard_price", 3000.00);
  $premium_price = get_setting($conn, "private_workshop_premium_price", 3800.00);
  $total_amount = round(($standard_attendees * $standard_price) + ($premium_attendees * $premium_price), 2);

  if ($total_amount <= 0) {
    throw new Exception("Invalid total amount.");
  }

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
      AND booking_type = 'private_workshop'
      AND status IN ('pending_payment', 'pending', 'approved')
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
      AND booking_type = 'private_workshop'
      AND status IN ('pending_payment', 'pending', 'approved')
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

  $draft["booking_type"] = "private_workshop";
  $draft["start_time"] = $start_time;
  $draft["end_time"] = $end_time;
  $draft["total_attendees"] = $total_attendees;
  $draft["standard_attendees"] = $standard_attendees;
  $draft["premium_attendees"] = $premium_attendees;
  $draft["standard_price"] = round($standard_price, 2);
  $draft["premium_price"] = round($premium_price, 2);
  $draft["total_amount"] = $total_amount;

  $notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($notesJson === false || $notesJson === "") {
    $notesJson = "{}";
  }

  $formSnapshot = [
    "booking_type" => "private_workshop",
    "pricing_rule" => "standard_attendees_x_standard_price_plus_premium_attendees_x_premium_price",
    "standard_price" => round($standard_price, 2),
    "premium_price" => round($premium_price, 2)
  ];

  $snapshotJson = json_encode($formSnapshot, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($snapshotJson === false || $snapshotJson === "") {
    $snapshotJson = "{}";
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
      (?, ?, ?, ?, 'private_workshop', 'pending_payment', ?, ?, 'unpaid', NULL, ?)
  ");

  if (!$insert) {
    throw new Exception("Failed to prepare booking.");
  }

  $insert->bind_param(
    "issssds",
    $user_id,
    $date,
    $start_time,
    $end_time,
    $notesJson,
    $total_amount,
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
    "status" => "pending_payment",
    "payment_status" => "unpaid",
    "message" => "Booking hold created. Please submit GCash proof to send it for admin review.",
    "total_amount" => $total_amount
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();
  fail($e->getMessage());
}

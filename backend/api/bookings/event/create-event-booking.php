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

function get_event_price($conn, $cup_quantity, $menu_package) {
  $cupKeys = [
    50 => "event_50_cups_price_per_cup",
    100 => "event_100_cups_price_per_cup",
    150 => "event_150_cups_price_per_cup",
    200 => "event_200_cups_price_per_cup"
  ];

  $addonKeys = [
    "SIGNATURE" => "event_signature_addon",
    "PLUS" => "event_plus_addon",
    "PREMIUM" => "event_premium_addon"
  ];

  if (!isset($cupKeys[$cup_quantity])) {
    fail("Invalid cup package.");
  }

  if (!isset($addonKeys[$menu_package])) {
    fail("Invalid menu package.");
  }

  $pricePerCup = get_setting($conn, $cupKeys[$cup_quantity], 0);
  $menuAddon = get_setting($conn, $addonKeys[$menu_package], 0);
  $total = ($cup_quantity * $pricePerCup) + $menuAddon;

  return [
    "price_per_cup" => round($pricePerCup, 2),
    "menu_addon" => round($menuAddon, 2),
    "total" => round($total, 2)
  ];
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  fail("Method not allowed", 405);
}

if (!isset($_SESSION["user_id"])) {
  fail("Unauthorized", 401);
}

if (isset($_SESSION["role"]) && $_SESSION["role"] === "admin") {
  fail("Admins cannot book events", 403);
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  fail("Invalid request");
}

$date = trim($data["date"] ?? "");
$start_time = normalize_time_value($data["start_time"] ?? "", "start");
$end_time = normalize_time_value($data["end_time"] ?? "", "end");
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

$cup_quantity = isset($draft["cup_quantity"]) ? (int)$draft["cup_quantity"] : 0;
$menu_package = strtoupper(trim((string)($draft["menu_package"] ?? "")));

if ($cup_quantity <= 0) {
  fail("Cup package is required.");
}

if ($menu_package === "") {
  fail("Menu package is required.");
}

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  fail("End time must be after start time");
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  fail("Work hours must be up to 4 hours only");
}

$conn->begin_transaction();

try {
  $priceInfo = get_event_price($conn, $cup_quantity, $menu_package);
  $total_amount = $priceInfo["total"];

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
    throw new Exception("Failed to check blocked date.");
  }

  $blockedStmt->bind_param("s", $date);
  $blockedStmt->execute();
  $blocked = $blockedStmt->get_result()->fetch_assoc();
  $blockedStmt->close();

  if ($blocked) {
    throw new Exception("This date is not available.");
  }

  $MAX_EVENT_PER_DAY = 3;

  $countStmt = $conn->prepare("
    SELECT COUNT(*) AS c
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'event_booking'
      AND status IN ('pending_payment', 'pending', 'approved')
  ");

  if (!$countStmt) {
    throw new Exception("Failed to check booking count.");
  }

  $countStmt->bind_param("s", $date);
  $countStmt->execute();
  $count = (int)($countStmt->get_result()->fetch_assoc()["c"] ?? 0);
  $countStmt->close();

  if ($count >= $MAX_EVENT_PER_DAY) {
    throw new Exception("This day is fully booked.");
  }

  $conflictStmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'event_booking'
      AND status IN ('pending_payment', 'pending', 'approved')
      AND (start_time < ? AND end_time > ?)
    LIMIT 1
  ");

  if (!$conflictStmt) {
    throw new Exception("Failed to check time conflict.");
  }

  $conflictStmt->bind_param("sss", $date, $end_time, $start_time);
  $conflictStmt->execute();
  $conflict = $conflictStmt->get_result()->num_rows > 0;
  $conflictStmt->close();

  if ($conflict) {
    throw new Exception("That time slot is already booked. Please choose another time.");
  }

  $draft["booking_type"] = "event_booking";
  $draft["start_time"] = $start_time;
  $draft["end_time"] = $end_time;
  $draft["cup_quantity"] = $cup_quantity;
  $draft["menu_package"] = $menu_package;
  $draft["price_per_cup"] = $priceInfo["price_per_cup"];
  $draft["menu_addon"] = $priceInfo["menu_addon"];
  $draft["total_amount"] = $total_amount;

  $notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($notesJson === false || $notesJson === "") {
    $notesJson = "{}";
  }

  $formSnapshot = [
    "booking_type" => "event_booking",
    "pricing_rule" => "cup_quantity_x_price_per_cup_plus_menu_addon",
    "cup_quantity" => $cup_quantity,
    "price_per_cup" => $priceInfo["price_per_cup"],
    "menu_package" => $menu_package,
    "menu_addon" => $priceInfo["menu_addon"]
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
      (?, ?, ?, ?, 'event_booking', 'pending_payment', ?, ?, 'unpaid', NULL, ?)
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

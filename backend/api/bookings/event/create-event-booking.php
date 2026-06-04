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

function get_setting(mysqli $conn, string $key, float $default = 0.00): float {
  $stmt = $conn->prepare("
    SELECT setting_value
    FROM system_settings
    WHERE setting_key = ?
    LIMIT 1
  ");

  if (!$stmt) {
    return $default;
  }

  $stmt->bind_param("s", $key);
  $stmt->execute();

  $result = $stmt->get_result();
  $row = $result ? $result->fetch_assoc() : null;

  $stmt->close();

  return $row ? round((float)$row["setting_value"], 2) : $default;
}

function clean_string($value, int $max = 255): string {
  $value = trim((string)$value);
  return mb_substr($value, 0, $max);
}

function clean_string_array($value): array {
  if (!is_array($value)) {
    return [];
  }

  $clean = [];

  foreach ($value as $item) {
    $item = clean_string($item, 255);

    if ($item !== "") {
      $clean[] = $item;
    }
  }

  return $clean;
}

function clean_int_array($value): array {
  if (!is_array($value)) {
    return [];
  }

  $clean = [];

  foreach ($value as $item) {
    if (is_numeric($item)) {
      $clean[] = (int)$item;
    }
  }

  return array_values(array_unique($clean));
}

function get_event_cup_package(mysqli $conn, int $cupPackageId): array {
  $stmt = $conn->prepare("
    SELECT
      id,
      quantity,
      price_per_cup
    FROM event_cup_packages
    WHERE id = ?
      AND is_active = 1
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to load cup package.");
  }

  $stmt->bind_param("i", $cupPackageId);
  $stmt->execute();

  $row = $stmt->get_result()->fetch_assoc();

  $stmt->close();

  if (!$row) {
    throw new Exception("Invalid or inactive cup package.");
  }

  return [
    "id" => (int)$row["id"],
    "quantity" => (int)$row["quantity"],
    "price_per_cup" => round((float)$row["price_per_cup"], 2)
  ];
}

function get_event_menu_package(mysqli $conn, int $menuPackageId): array {
  $stmt = $conn->prepare("
    SELECT
      id,
      package_code,
      label,
      description,
      addon_price,
      included_drinks_count
    FROM event_menu_packages
    WHERE id = ?
      AND is_active = 1
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to load menu package.");
  }

  $stmt->bind_param("i", $menuPackageId);
  $stmt->execute();

  $row = $stmt->get_result()->fetch_assoc();

  $stmt->close();

  if (!$row) {
    throw new Exception("Invalid or inactive menu package.");
  }

  return [
    "id" => (int)$row["id"],
    "package_code" => $row["package_code"],
    "label" => $row["label"],
    "description" => $row["description"],
    "addon_price" => round((float)$row["addon_price"], 2),
    "included_drinks_count" => (int)$row["included_drinks_count"]
  ];
}

function get_event_drinks(mysqli $conn, array $drinkIds): array {
  if (count($drinkIds) === 0) {
    return [];
  }

  $placeholders = implode(",", array_fill(0, count($drinkIds), "?"));
  $types = str_repeat("i", count($drinkIds));

  $stmt = $conn->prepare("
    SELECT
      id,
      drink_name,
      category,
      is_signature
    FROM event_drinks
    WHERE id IN ($placeholders)
      AND is_active = 1
    ORDER BY sort_order ASC, drink_name ASC
  ");

  if (!$stmt) {
    throw new Exception("Failed to load selected drinks.");
  }

  $stmt->bind_param($types, ...$drinkIds);
  $stmt->execute();

  $result = $stmt->get_result();
  $rows = [];

  while ($row = $result->fetch_assoc()) {
    $rows[] = [
      "id" => (int)$row["id"],
      "drink_name" => $row["drink_name"],
      "category" => $row["category"],
      "is_signature" => (int)$row["is_signature"]
    ];
  }

  $stmt->close();

  return $rows;
}

function safe_json($value): string {
  $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

  if ($json === false || $json === "") {
    return "{}";
  }

  return $json;
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

$user_id = (int)$_SESSION["user_id"];

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  fail("Invalid request.");
}

$date = trim($data["date"] ?? "");
$start_time = normalize_time_value($data["start_time"] ?? "", "start");
$end_time = normalize_time_value($data["end_time"] ?? "", "end");
$draft = $data["draft"] ?? [];

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  fail("Invalid date.");
}

if ($date < date("Y-m-d")) {
  fail("Past dates are not allowed.");
}

if (!is_array($draft)) {
  fail("Invalid booking data.");
}

$cupPackageId = isset($draft["cup_package_id"]) ? (int)$draft["cup_package_id"] : 0;
$menuPackageId = isset($draft["menu_package_id"]) ? (int)$draft["menu_package_id"] : 0;
$selectedDrinkIds = clean_int_array($draft["selected_drink_ids"] ?? []);

if ($cupPackageId <= 0) {
  fail("Cup package is required.");
}

if ($menuPackageId <= 0) {
  fail("Menu package is required.");
}

$startTs = strtotime("$date $start_time");
$endTs = strtotime("$date $end_time");

if (!$startTs || !$endTs || $endTs <= $startTs) {
  fail("End time must be after start time.");
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  fail("Work hours must be up to 4 hours only.");
}

$conn->begin_transaction();

try {
  /*
    Re-read selected packages from database.
    Do not trust frontend total_amount, price_per_cup, or menu_addon.
  */
  $cupPackage = get_event_cup_package($conn, $cupPackageId);
  $menuPackage = get_event_menu_package($conn, $menuPackageId);
  $selectedDrinks = get_event_drinks($conn, $selectedDrinkIds);

  $downpaymentPercentage = get_setting(
    $conn,
    "event_booking_downpayment_percentage",
    50.00
  );

  if ($downpaymentPercentage < 1 || $downpaymentPercentage > 100) {
    $downpaymentPercentage = 50.00;
  }

  $cupSubtotal = $cupPackage["quantity"] * $cupPackage["price_per_cup"];
  $menuAddon = $menuPackage["addon_price"];
  $totalAmount = round($cupSubtotal + $menuAddon, 2);
  $dueNow = round($totalAmount * ($downpaymentPercentage / 100), 2);

  if ($totalAmount <= 0) {
    throw new Exception("Invalid total amount.");
  }

  /*
    Lock existing booking rows for this date to reduce race condition risk.
    This helps prevent two customers from booking the same time at once.
  */
  $lockStmt = $conn->prepare("
    SELECT id
    FROM bookings
    WHERE booking_date = ?
      AND booking_type = 'event_booking'
      AND status IN ('pending_payment', 'pending', 'approved')
    FOR UPDATE
  ");

  if (!$lockStmt) {
    throw new Exception("Failed to lock event bookings.");
  }

  $lockStmt->bind_param("s", $date);
  $lockStmt->execute();
  $lockStmt->get_result();
  $lockStmt->close();

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

  $hasConflict = $conflictStmt->get_result()->num_rows > 0;

  $conflictStmt->close();

  if ($hasConflict) {
    throw new Exception("That time slot is already booked. Please choose another time.");
  }

  $contactMethods = clean_string_array($draft["contact_methods"] ?? []);

  $bookingNotes = [
    "booking_type" => "event_booking",

    "full_name" => clean_string($draft["full_name"] ?? "", 120),
    "phone_number" => clean_string($draft["phone_number"] ?? "", 50),
    "email" => clean_string($draft["email"] ?? "", 150),
    "contact_methods" => $contactMethods,

    "booking_date" => $date,
    "start_time" => $start_time,
    "end_time" => $end_time,

    "event_type" => clean_string($draft["event_type"] ?? "", 120),
    "event_name" => clean_string($draft["event_name"] ?? "", 180),
    "event_location" => clean_string($draft["event_location"] ?? "", 255),
    "other_request" => clean_string($draft["other_request"] ?? "", 2000),

    "cup_package_id" => $cupPackage["id"],
    "cup_quantity" => $cupPackage["quantity"],
    "price_per_cup" => $cupPackage["price_per_cup"],
    "cup_subtotal" => $cupSubtotal,

    "menu_package_id" => $menuPackage["id"],
    "menu_package_code" => $menuPackage["package_code"],
    "menu_package_label" => $menuPackage["label"],
    "menu_package_description" => $menuPackage["description"],
    "menu_addon" => $menuAddon,

    "selected_drink_ids" => array_map(function ($drink) {
      return (int)$drink["id"];
    }, $selectedDrinks),
    "selected_drinks" => $selectedDrinks,

    "custom_drinks" => clean_string($draft["custom_drinks"] ?? "", 1000),
    "hojicha_options" => clean_string($draft["hojicha_options"] ?? "", 100),

    "downpayment_percentage" => $downpaymentPercentage,
    "due_now" => $dueNow,
    "total_amount" => $totalAmount
  ];

  $formSnapshot = [
    "booking_type" => "event_booking",
    "pricing_rule" => "cup_quantity_x_price_per_cup_plus_menu_addon",
    "cup_package" => $cupPackage,
    "menu_package" => $menuPackage,
    "selected_drinks" => $selectedDrinks,
    "downpayment_percentage" => $downpaymentPercentage,
    "cup_subtotal" => $cupSubtotal,
    "menu_addon" => $menuAddon,
    "due_now" => $dueNow,
    "total_amount" => $totalAmount,
    "created_from" => "dynamic_event_pricing"
  ];

  $notesJson = safe_json($bookingNotes);
  $snapshotJson = safe_json($formSnapshot);

  $insert = $conn->prepare("
    INSERT INTO bookings
      (
        user_id,
        time_slot_id,
        booking_date,
        start_time,
        end_time,
        booking_type,
        status,
        notes,
        total_amount,
        amount_paid,
        payment_status,
        form_id,
        form_snapshot
      )
    VALUES
      (?, NULL, ?, ?, ?, 'event_booking', 'pending_payment', ?, ?, 0.00, 'unpaid', NULL, ?)
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
    $totalAmount,
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
    "total_amount" => $totalAmount,
    "due_now" => $dueNow,
    "downpayment_percentage" => $downpaymentPercentage
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  fail($e->getMessage());
}
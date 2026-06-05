<?php
session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  http_response_code(405);
  echo json_encode([
    "success" => false,
    "error" => "Method not allowed."
  ]);
  exit();
}

$type = trim($_GET["type"] ?? "");

if ($type === "event") {
  $type = "event_booking";
}

if ($type === "workshop") {
  $type = "private_workshop";
}

if (!in_array($type, ["event_booking", "private_workshop"], true)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid booking type."
  ]);
  exit();
}

function get_setting(mysqli $conn, string $key, float $default): float {
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

  if (!$row) {
    return $default;
  }

  return round((float)$row["setting_value"], 2);
}

function fetch_all_assoc(mysqli $conn, string $sql): array {
  $result = $conn->query($sql);

  if (!$result) {
    throw new Exception($conn->error);
  }

  $rows = [];

  while ($row = $result->fetch_assoc()) {
    $rows[] = $row;
  }

  return $rows;
}

try {
  if ($type === "event_booking") {
    $cupPackages = fetch_all_assoc($conn, "
      SELECT
        id,
        quantity,
        price_per_cup,
        is_active,
        sort_order
      FROM event_cup_packages
      WHERE is_active = 1
      ORDER BY sort_order ASC, quantity ASC
    ");

    $menuPackages = fetch_all_assoc($conn, "
      SELECT
        id,
        package_code,
        label,
        description,
        addon_price,
        included_drinks_count,
        is_active,
        sort_order
      FROM event_menu_packages
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    ");

    $drinks = fetch_all_assoc($conn, "
      SELECT
        id,
        drink_name,
        category,
        is_signature,
        is_active,
        sort_order
      FROM event_drinks
      WHERE is_active = 1
      ORDER BY sort_order ASC, drink_name ASC
    ");

    echo json_encode([
      "success" => true,
      "type" => "event_booking",
      "form" => [
        "booking_type" => "event_booking",
        "pricing_rule" => "cup_quantity_x_price_per_cup_plus_menu_addon",
        "cup_packages" => $cupPackages,
        "menu_packages" => $menuPackages,
        "drinks" => $drinks,
        "downpayment_percentage" => get_setting(
          $conn,
          "event_booking_downpayment_percentage",
          50.00
        )
      ]
    ]);
    exit();
  }

  if ($type === "private_workshop") {
    $packages = fetch_all_assoc($conn, "
      SELECT
        id,
        package_code,
        label,
        price_per_person,
        description,
        is_active,
        sort_order
      FROM private_workshop_packages
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
    ");

    echo json_encode([
      "success" => true,
      "type" => "private_workshop",
      "form" => [
        "booking_type" => "private_workshop",
        "pricing_rule" => "package_attendees_x_price_per_person",
        "packages" => $packages,
        "downpayment_percentage" => get_setting(
          $conn,
          "private_workshop_downpayment_percentage",
          50.00
        )
      ]
    ]);
    exit();
  }
} catch (Exception $e) {
  error_log("get-active-booking-form error: " . $e->getMessage());

  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Failed to load booking form.",
    "details" => $e->getMessage()
  ]);
  exit();
}
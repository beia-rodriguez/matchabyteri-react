<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

$type = $_GET["type"] ?? "";

$allowedTypes = ["event_booking", "private_workshop", "audit_logs"];

if (!in_array($type, $allowedTypes, true)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid type."
  ]);
  exit();
}

function table_exists(mysqli $conn, string $table): bool {
  $stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
  ");

  if (!$stmt) {
    return false;
  }

  $stmt->bind_param("s", $table);
  $stmt->execute();

  $result = $stmt->get_result();
  $row = $result ? $result->fetch_assoc() : null;

  $stmt->close();

  return (int)($row["total"] ?? 0) > 0;
}

function table_count(mysqli $conn, string $table): int {
  $allowed = [
    "event_cup_packages",
    "event_menu_packages",
    "event_drinks",
    "private_workshop_packages",
    "pricing_audit_logs",
    "system_settings"
  ];

  if (!in_array($table, $allowed, true)) {
    return 0;
  }

  if (!table_exists($conn, $table)) {
    return 0;
  }

  $result = $conn->query("SELECT COUNT(*) AS total FROM `$table`");

  if (!$result) {
    return 0;
  }

  $row = $result->fetch_assoc();

  return (int)($row["total"] ?? 0);
}

function ensure_pricing_tables(mysqli $conn): void {
  $queries = [
    "
    CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
      setting_value TEXT NOT NULL,
      description TEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "
    CREATE TABLE IF NOT EXISTS event_cup_packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      quantity INT NOT NULL,
      price_per_cup DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "
    CREATE TABLE IF NOT EXISTS event_menu_packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_code VARCHAR(50) NOT NULL,
      label VARCHAR(120) NOT NULL,
      description TEXT NULL,
      addon_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      included_drinks_count INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "
    CREATE TABLE IF NOT EXISTS event_drinks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      drink_name VARCHAR(160) NOT NULL,
      category VARCHAR(50) NOT NULL DEFAULT 'matcha',
      is_signature TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "
    CREATE TABLE IF NOT EXISTS private_workshop_packages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      package_code VARCHAR(50) NOT NULL,
      label VARCHAR(120) NOT NULL,
      price_per_person DECIMAL(10,2) NOT NULL DEFAULT 0.00,
      description TEXT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ",
    "
    CREATE TABLE IF NOT EXISTS pricing_audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      admin_id INT NULL,
      action_type VARCHAR(80) NOT NULL,
      target_table VARCHAR(120) NOT NULL,
      target_id INT NULL,
      old_value LONGTEXT NULL,
      new_value LONGTEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    "
  ];

  foreach ($queries as $sql) {
    if (!$conn->query($sql)) {
      throw new Exception($conn->error);
    }
  }

  if (table_count($conn, "event_cup_packages") === 0) {
    $conn->query("
      INSERT INTO event_cup_packages
        (quantity, price_per_cup, is_active, sort_order)
      VALUES
        (50, 230.00, 1, 1),
        (100, 220.00, 1, 2),
        (150, 210.00, 1, 3),
        (200, 200.00, 1, 4)
    ");
  }

  if (table_count($conn, "event_menu_packages") === 0) {
    $conn->query("
      INSERT INTO event_menu_packages
        (package_code, label, description, addon_price, included_drinks_count, is_active, sort_order)
      VALUES
        ('SIGNATURE', 'Signature Package', '4 signature drinks', 0.00, 4, 1, 1),
        ('PLUS', 'Plus Package', 'Signature drinks + 2 additional drinks', 1000.00, 6, 1, 2),
        ('PREMIUM', 'Premium Package', 'Signature drinks + 4 additional drinks', 2000.00, 8, 1, 3)
    ");
  }

  if (table_count($conn, "event_drinks") === 0) {
    $conn->query("
      INSERT INTO event_drinks
        (drink_name, category, is_signature, is_active, sort_order)
      VALUES
        ('Basic Matcha Latte', 'matcha', 1, 1, 1),
        ('Earl Grey Matcha Latte', 'matcha', 1, 1, 2),
        ('Peach Mango Matcha Latte', 'matcha', 1, 1, 3),
        ('AM Matcha ’Ricano', 'matcha', 1, 1, 4)
    ");
  }

  if (table_count($conn, "private_workshop_packages") === 0) {
    $conn->query("
      INSERT INTO private_workshop_packages
        (package_code, label, price_per_person, description, is_active, sort_order)
      VALUES
        ('STANDARD', 'Standard Package', 3000.00, 'Private workshop standard package', 1, 1),
        ('PREMIUM', 'Premium Package', 3800.00, 'Private workshop premium package', 1, 2)
    ");
  }

  $settings = [
    [
      "key" => "event_booking_downpayment_percentage",
      "value" => "50.00",
      "description" => "Default downpayment percentage for event bookings."
    ],
    [
      "key" => "private_workshop_downpayment_percentage",
      "value" => "50.00",
      "description" => "Default downpayment percentage for private workshops."
    ]
  ];

  foreach ($settings as $setting) {
    $stmt = $conn->prepare("
      INSERT INTO system_settings
        (setting_key, setting_value, description)
      VALUES
        (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = setting_value
    ");

    if (!$stmt) {
      continue;
    }

    $stmt->bind_param(
      "sss",
      $setting["key"],
      $setting["value"],
      $setting["description"]
    );

    $stmt->execute();
    $stmt->close();
  }
}

function get_setting(mysqli $conn, string $key, float $default): float {
  if (!table_exists($conn, "system_settings")) {
    return $default;
  }

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

function latest_audit_meta(mysqli $conn, array $tables): array {
  if (!table_exists($conn, "pricing_audit_logs")) {
    return [
      "last_updated" => null,
      "updated_by" => null
    ];
  }

  $safeTables = array_map(function ($table) use ($conn) {
    return "'" . $conn->real_escape_string($table) . "'";
  }, $tables);

  $in = implode(",", $safeTables);

  $sql = "
    SELECT pal.created_at, u.name AS admin_name
    FROM pricing_audit_logs pal
    LEFT JOIN users u ON u.id = pal.admin_id
    WHERE pal.target_table IN ($in)
    ORDER BY pal.created_at DESC
    LIMIT 1
  ";

  $result = $conn->query($sql);

  if (!$result) {
    return [
      "last_updated" => null,
      "updated_by" => null
    ];
  }

  $row = $result->fetch_assoc();

  if (!$row) {
    return [
      "last_updated" => null,
      "updated_by" => null
    ];
  }

  return [
    "last_updated" => $row["created_at"],
    "updated_by" => $row["admin_name"] ?? null
  ];
}

try {
  ensure_pricing_tables($conn);

  if ($type === "audit_logs") {
    $logs = fetch_all_assoc($conn, "
      SELECT
        pal.id,
        pal.admin_id,
        u.name AS admin_name,
        pal.action_type,
        pal.target_table,
        pal.target_id,
        pal.old_value,
        pal.new_value,
        pal.created_at
      FROM pricing_audit_logs pal
      LEFT JOIN users u ON u.id = pal.admin_id
      ORDER BY pal.created_at DESC
      LIMIT 100
    ");

    echo json_encode([
      "success" => true,
      "csrf_token" => $csrf,
      "type" => $type,
      "logs" => $logs
    ]);
    exit();
  }

  if ($type === "event_booking") {
    $cupPackages = fetch_all_assoc($conn, "
      SELECT
        id,
        quantity,
        price_per_cup,
        is_active,
        sort_order,
        created_at,
        updated_at
      FROM event_cup_packages
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
        sort_order,
        created_at,
        updated_at
      FROM event_menu_packages
      ORDER BY sort_order ASC, id ASC
    ");

    $drinks = fetch_all_assoc($conn, "
      SELECT
        id,
        drink_name,
        category,
        is_signature,
        is_active,
        sort_order,
        created_at,
        updated_at
      FROM event_drinks
      ORDER BY sort_order ASC, drink_name ASC
    ");

    $meta = latest_audit_meta($conn, [
      "event_cup_packages",
      "event_menu_packages",
      "event_drinks",
      "system_settings"
    ]);

    echo json_encode([
      "success" => true,
      "csrf_token" => $csrf,
      "type" => $type,
      "form" => [
        "booking_type" => "event_booking",
        "title" => "Event Booking Pricing",
        "pricing_rule" => "cup_quantity_x_price_per_cup_plus_menu_addon",
        "cup_packages" => $cupPackages,
        "menu_packages" => $menuPackages,
        "drinks" => $drinks,
        "downpayment_percentage" => get_setting(
          $conn,
          "event_booking_downpayment_percentage",
          50.00
        ),
        "last_updated" => $meta["last_updated"],
        "updated_by" => $meta["updated_by"]
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
        sort_order,
        created_at,
        updated_at
      FROM private_workshop_packages
      ORDER BY sort_order ASC, id ASC
    ");

    $meta = latest_audit_meta($conn, [
      "private_workshop_packages",
      "system_settings"
    ]);

    echo json_encode([
      "success" => true,
      "csrf_token" => $csrf,
      "type" => $type,
      "form" => [
        "booking_type" => "private_workshop",
        "title" => "Private Workshop Pricing",
        "pricing_rule" => "package_attendees_x_price_per_person",
        "packages" => $packages,
        "downpayment_percentage" => get_setting(
          $conn,
          "private_workshop_downpayment_percentage",
          50.00
        ),
        "last_updated" => $meta["last_updated"],
        "updated_by" => $meta["updated_by"]
      ]
    ]);
    exit();
  }
} catch (Exception $e) {
  error_log("get-booking-form error: " . $e->getMessage());

  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Failed to load booking form settings.",
    "details" => $e->getMessage()
  ]);
  exit();
}
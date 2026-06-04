<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode([
    "success" => false,
    "error" => "Method not allowed."
  ]);
  exit();
}

$rawInput = file_get_contents("php://input");
$data = json_decode($rawInput, true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid JSON request."
  ]);
  exit();
}

$type = trim((string)($data["booking_type"] ?? $data["type"] ?? $_GET["type"] ?? ""));
$allowedTypes = ["event_booking", "private_workshop"];

if (!in_array($type, $allowedTypes, true)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid type."
  ]);
  exit();
}

if (isset($_SESSION["csrf_token"])) {
  $postedCsrf = (string)($data["csrf_token"] ?? "");

  if ($postedCsrf === "" || !hash_equals((string)$_SESSION["csrf_token"], $postedCsrf)) {
    http_response_code(403);
    echo json_encode([
      "success" => false,
      "error" => "Invalid CSRF token. Please refresh the page and try again."
    ]);
    exit();
  }
}

$form = $data["form"] ?? null;

if (!is_array($form)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid form data."
  ]);
  exit();
}

function table_exists(mysqli $conn, string $table): bool {
  $stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
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

  if (!in_array($table, $allowed, true) || !table_exists($conn, $table)) {
    return 0;
  }

  $result = $conn->query("SELECT COUNT(*) AS total FROM `$table`");
  if (!$result) return 0;

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

  $settings = [
    ["event_booking_downpayment_percentage", "50.00", "Default downpayment percentage for event bookings."],
    ["private_workshop_downpayment_percentage", "50.00", "Default downpayment percentage for private workshops."]
  ];

  foreach ($settings as $setting) {
    $stmt = $conn->prepare("
      INSERT INTO system_settings (setting_key, setting_value, description)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE setting_value = setting_value
    ");

    if (!$stmt) continue;

    $stmt->bind_param("sss", $setting[0], $setting[1], $setting[2]);
    $stmt->execute();
    $stmt->close();
  }
}

function admin_id(): ?int {
  if (isset($_SESSION["user_id"]) && is_numeric($_SESSION["user_id"])) {
    return (int)$_SESSION["user_id"];
  }

  if (isset($_SESSION["admin_id"]) && is_numeric($_SESSION["admin_id"])) {
    return (int)$_SESSION["admin_id"];
  }

  return null;
}

function audit_log(mysqli $conn, string $action, string $table, ?int $id, $oldValue, $newValue): void {
  if (!table_exists($conn, "pricing_audit_logs")) return;

  $adminId = admin_id();
  $oldJson = $oldValue === null ? null : json_encode($oldValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  $newJson = $newValue === null ? null : json_encode($newValue, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

  $stmt = $conn->prepare("
    INSERT INTO pricing_audit_logs
      (admin_id, action_type, target_table, target_id, old_value, new_value)
    VALUES
      (?, ?, ?, ?, ?, ?)
  ");

  if (!$stmt) return;

  $stmt->bind_param("ississ", $adminId, $action, $table, $id, $oldJson, $newJson);
  $stmt->execute();
  $stmt->close();
}

function one_row(mysqli $conn, string $table, int $id): ?array {
  $allowed = ["event_cup_packages", "event_menu_packages", "event_drinks", "private_workshop_packages"];
  if (!in_array($table, $allowed, true)) return null;

  $stmt = $conn->prepare("SELECT * FROM `$table` WHERE id = ? LIMIT 1");
  if (!$stmt) return null;

  $stmt->bind_param("i", $id);
  $stmt->execute();
  $result = $stmt->get_result();
  $row = $result ? $result->fetch_assoc() : null;
  $stmt->close();

  return $row ?: null;
}

function clean_code($value): string {
  $code = strtoupper(trim((string)$value));
  $code = preg_replace('/[^A-Z0-9]+/', '_', $code);
  $code = trim($code, '_');
  return $code ?: "PACKAGE";
}

function clean_text($value, int $max = 255): string {
  $text = trim((string)$value);
  if (function_exists('mb_substr')) {
    return mb_substr($text, 0, $max);
  }
  return substr($text, 0, $max);
}

function int_value($value, int $fallback = 0): int {
  if (is_string($value)) {
    $value = preg_replace('/[^0-9]/', '', $value);
  }

  if ($value === "" || $value === null || !is_numeric($value)) {
    return $fallback;
  }

  return max(0, (int)$value);
}

function money_value($value, float $fallback = 0.00): float {
  if ($value === "" || $value === null || !is_numeric($value)) {
    return $fallback;
  }

  return max(0, round((float)$value, 2));
}

function save_setting(mysqli $conn, string $key, float $value, string $description): void {
  $settingValue = number_format($value, 2, '.', '');

  $stmt = $conn->prepare("
    INSERT INTO system_settings (setting_key, setting_value, description)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      description = VALUES(description),
      updated_at = CURRENT_TIMESTAMP
  ");

  if (!$stmt) {
    throw new Exception($conn->error);
  }

  $stmt->bind_param("sss", $key, $settingValue, $description);
  $stmt->execute();
  $stmt->close();

  audit_log($conn, "update", "system_settings", null, null, [
    "setting_key" => $key,
    "setting_value" => $settingValue
  ]);
}

function save_event_cups(mysqli $conn, array $items): void {
  foreach ($items as $index => $item) {
    $id = int_value($item["id"] ?? 0);
    $quantity = int_value($item["quantity"] ?? 0);
    $price = money_value($item["price_per_cup"] ?? 0);
    $active = (int)((int)($item["is_active"] ?? 0) === 1);
    $sort = int_value($item["sort_order"] ?? ($index + 1), $index + 1);

    if ($quantity <= 0 && $active === 1) {
      throw new Exception("Cup quantity must be greater than 0.");
    }

    if ($id > 0 && one_row($conn, "event_cup_packages", $id)) {
      $old = one_row($conn, "event_cup_packages", $id);
      $stmt = $conn->prepare("
        UPDATE event_cup_packages
        SET quantity = ?, price_per_cup = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("idiii", $quantity, $price, $active, $sort, $id);
      $stmt->execute();
      $stmt->close();

      audit_log($conn, "update", "event_cup_packages", $id, $old, one_row($conn, "event_cup_packages", $id));
    } else {
      if ($quantity <= 0) continue;

      $stmt = $conn->prepare("
        INSERT INTO event_cup_packages (quantity, price_per_cup, is_active, sort_order)
        VALUES (?, ?, ?, ?)
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("idii", $quantity, $price, $active, $sort);
      $stmt->execute();
      $newId = $stmt->insert_id;
      $stmt->close();

      audit_log($conn, "create", "event_cup_packages", $newId, null, one_row($conn, "event_cup_packages", $newId));
    }
  }
}

function save_event_menus(mysqli $conn, array $items): void {
  foreach ($items as $index => $item) {
    $id = int_value($item["id"] ?? 0);
    $code = clean_code($item["package_code"] ?? "");
    $label = clean_text($item["label"] ?? "", 120);
    $description = clean_text($item["description"] ?? "", 1000);
    $addon = money_value($item["addon_price"] ?? 0);
    $included = int_value($item["included_drinks_count"] ?? 0);
    $active = (int)((int)($item["is_active"] ?? 0) === 1);
    $sort = int_value($item["sort_order"] ?? ($index + 1), $index + 1);

    if ($active === 1 && ($code === "" || $label === "")) {
      throw new Exception("Menu package code and label are required.");
    }

    if ($id > 0 && one_row($conn, "event_menu_packages", $id)) {
      $old = one_row($conn, "event_menu_packages", $id);
      $stmt = $conn->prepare("
        UPDATE event_menu_packages
        SET package_code = ?, label = ?, description = ?, addon_price = ?, included_drinks_count = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("sssdiiii", $code, $label, $description, $addon, $included, $active, $sort, $id);
      $stmt->execute();
      $stmt->close();

      audit_log($conn, "update", "event_menu_packages", $id, $old, one_row($conn, "event_menu_packages", $id));
    } else {
      if ($code === "" || $label === "") continue;

      $stmt = $conn->prepare("
        INSERT INTO event_menu_packages
          (package_code, label, description, addon_price, included_drinks_count, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("sssdiii", $code, $label, $description, $addon, $included, $active, $sort);
      $stmt->execute();
      $newId = $stmt->insert_id;
      $stmt->close();

      audit_log($conn, "create", "event_menu_packages", $newId, null, one_row($conn, "event_menu_packages", $newId));
    }
  }
}

function save_event_drinks(mysqli $conn, array $items): void {
  foreach ($items as $index => $item) {
    $id = int_value($item["id"] ?? 0);
    $name = clean_text($item["drink_name"] ?? "", 160);
    $category = clean_text($item["category"] ?? "matcha", 50) ?: "matcha";
    $signature = (int)((int)($item["is_signature"] ?? 0) === 1);
    $active = (int)((int)($item["is_active"] ?? 0) === 1);
    $sort = int_value($item["sort_order"] ?? ($index + 1), $index + 1);

    if ($active === 1 && $name === "") {
      throw new Exception("Drink name is required.");
    }

    if ($id > 0 && one_row($conn, "event_drinks", $id)) {
      $old = one_row($conn, "event_drinks", $id);
      $stmt = $conn->prepare("
        UPDATE event_drinks
        SET drink_name = ?, category = ?, is_signature = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("ssiiii", $name, $category, $signature, $active, $sort, $id);
      $stmt->execute();
      $stmt->close();

      audit_log($conn, "update", "event_drinks", $id, $old, one_row($conn, "event_drinks", $id));
    } else {
      if ($name === "") continue;

      $stmt = $conn->prepare("
        INSERT INTO event_drinks (drink_name, category, is_signature, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?)
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("ssiii", $name, $category, $signature, $active, $sort);
      $stmt->execute();
      $newId = $stmt->insert_id;
      $stmt->close();

      audit_log($conn, "create", "event_drinks", $newId, null, one_row($conn, "event_drinks", $newId));
    }
  }
}

function save_private_packages(mysqli $conn, array $items): void {
  foreach ($items as $index => $item) {
    $id = int_value($item["id"] ?? 0);
    $code = clean_code($item["package_code"] ?? "");
    $label = clean_text($item["label"] ?? "", 120);
    $price = money_value($item["price_per_person"] ?? 0);
    $description = clean_text($item["description"] ?? "", 1000);
    $active = (int)((int)($item["is_active"] ?? 0) === 1);
    $sort = int_value($item["sort_order"] ?? ($index + 1), $index + 1);

    if ($active === 1 && ($code === "" || $label === "")) {
      throw new Exception("Private workshop package code and label are required.");
    }

    if ($id > 0 && one_row($conn, "private_workshop_packages", $id)) {
      $old = one_row($conn, "private_workshop_packages", $id);
      $stmt = $conn->prepare("
        UPDATE private_workshop_packages
        SET package_code = ?, label = ?, price_per_person = ?, description = ?, is_active = ?, sort_order = ?
        WHERE id = ?
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("ssdsiii", $code, $label, $price, $description, $active, $sort, $id);
      $stmt->execute();
      $stmt->close();

      audit_log($conn, "update", "private_workshop_packages", $id, $old, one_row($conn, "private_workshop_packages", $id));
    } else {
      if ($code === "" || $label === "") continue;

      $stmt = $conn->prepare("
        INSERT INTO private_workshop_packages
          (package_code, label, price_per_person, description, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      ");

      if (!$stmt) throw new Exception($conn->error);
      $stmt->bind_param("ssdsii", $code, $label, $price, $description, $active, $sort);
      $stmt->execute();
      $newId = $stmt->insert_id;
      $stmt->close();

      audit_log($conn, "create", "private_workshop_packages", $newId, null, one_row($conn, "private_workshop_packages", $newId));
    }
  }
}

try {
  ensure_pricing_tables($conn);

  $conn->begin_transaction();

  if ($type === "event_booking") {
    $downpayment = money_value($form["downpayment_percentage"] ?? 50, 50);

    if ($downpayment < 1 || $downpayment > 100) {
      throw new Exception("Event downpayment percentage must be between 1 and 100.");
    }

    save_event_cups($conn, is_array($form["cup_packages"] ?? null) ? $form["cup_packages"] : []);
    save_event_menus($conn, is_array($form["menu_packages"] ?? null) ? $form["menu_packages"] : []);
    save_event_drinks($conn, is_array($form["drinks"] ?? null) ? $form["drinks"] : []);
    save_setting($conn, "event_booking_downpayment_percentage", $downpayment, "Default downpayment percentage for event bookings.");
  }

  if ($type === "private_workshop") {
    $downpayment = money_value($form["downpayment_percentage"] ?? 50, 50);

    if ($downpayment < 1 || $downpayment > 100) {
      throw new Exception("Private workshop downpayment percentage must be between 1 and 100.");
    }

    save_private_packages($conn, is_array($form["packages"] ?? null) ? $form["packages"] : []);
    save_setting($conn, "private_workshop_downpayment_percentage", $downpayment, "Default downpayment percentage for private workshops.");
  }

  $conn->commit();

  echo json_encode([
    "success" => true,
    "csrf_token" => $csrf ?? ($_SESSION["csrf_token"] ?? null),
    "type" => $type,
    "message" => "Booking pricing settings saved successfully."
  ]);
  exit();
} catch (Exception $e) {
  error_log("save-booking-form error: " . $e->getMessage());

  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage(),
    "file" => $e->getFile(),
    "line" => $e->getLine()
  ]);
  exit();
}

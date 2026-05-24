<?php
session_start();
require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

$type = $_GET["type"] ?? "";

if (!in_array($type, ["event", "workshop"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking type"]);
  exit();
}

$stmt = $conn->prepare("
  SELECT id, booking_type, title, base_rate, downpayment_percentage
  FROM booking_forms
  WHERE booking_type = ? AND is_active = 1
  ORDER BY id DESC
  LIMIT 1
");

if (!$stmt) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to prepare form query."]);
  exit();
}

$stmt->bind_param("s", $type);
$stmt->execute();
$form = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$form) {
  echo json_encode([
    "success" => true,
    "form" => null
  ]);
  exit();
}

$formId = (int) $form["id"];
$sections = [];

$stmt = $conn->prepare("
  SELECT id, title, sort_order
  FROM booking_form_sections
  WHERE form_id = ?
  ORDER BY sort_order ASC, id ASC
");

if (!$stmt) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to prepare section query."]);
  exit();
}

$stmt->bind_param("i", $formId);
$stmt->execute();
$res = $stmt->get_result();

while ($section = $res->fetch_assoc()) {
  $section["id"] = (int) $section["id"];
  $section["sort_order"] = (int) $section["sort_order"];
  $section["fields"] = [];
  $sections[(int) $section["id"]] = $section;
}

$stmt->close();

if (!empty($sections)) {
  $sectionIds = implode(",", array_map("intval", array_keys($sections)));

  $fieldsRes = $conn->query("
    SELECT id, section_id, label, field_name, field_type, is_required, allow_quantity, sort_order
    FROM booking_form_fields
    WHERE section_id IN ($sectionIds)
    ORDER BY sort_order ASC, id ASC
  ");

  if (!$fieldsRes) {
    http_response_code(500);
    echo json_encode(["error" => "Failed to load form fields."]);
    exit();
  }

  $fields = [];

  while ($field = $fieldsRes->fetch_assoc()) {
    $field["id"] = (int) $field["id"];
    $field["section_id"] = (int) $field["section_id"];
    $field["is_required"] = (int) $field["is_required"];
    $field["allow_quantity"] = (int) $field["allow_quantity"];
    $field["sort_order"] = (int) $field["sort_order"];
    $field["options"] = [];
    $fields[(int) $field["id"]] = $field;
  }

  if (!empty($fields)) {
    $fieldIds = implode(",", array_map("intval", array_keys($fields)));

    $optionsRes = $conn->query("
      SELECT id, field_id, label, price, price_type, is_other, sort_order
      FROM booking_form_options
      WHERE field_id IN ($fieldIds)
      ORDER BY sort_order ASC, id ASC
    ");

    if (!$optionsRes) {
      http_response_code(500);
      echo json_encode(["error" => "Failed to load form options."]);
      exit();
    }

    while ($option = $optionsRes->fetch_assoc()) {
      $option["id"] = (int) $option["id"];
      $option["field_id"] = (int) $option["field_id"];
      $option["price"] = (float) $option["price"];
      $option["is_other"] = (int) ($option["is_other"] ?? 0);
      $option["sort_order"] = (int) $option["sort_order"];

      $fields[(int) $option["field_id"]]["options"][] = $option;
    }
  }

  foreach ($fields as $field) {
    $sections[(int) $field["section_id"]]["fields"][] = $field;
  }
}

$form["id"] = (int) $form["id"];
$form["base_rate"] = (float) ($form["base_rate"] ?? 0);
$form["downpayment_percentage"] = (float) ($form["downpayment_percentage"] ?? 50);
$form["sections"] = array_values($sections);

echo json_encode([
  "success" => true,
  "form" => $form
]);

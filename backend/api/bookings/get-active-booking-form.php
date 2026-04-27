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
  SELECT id, booking_type, title, downpayment_percentage
  FROM booking_forms
  WHERE booking_type = ? AND is_active = 1
  ORDER BY id DESC
  LIMIT 1
");
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

$formId = (int)$form["id"];

$sections = [];

$stmt = $conn->prepare("
  SELECT id, title, sort_order
  FROM booking_form_sections
  WHERE form_id = ?
  ORDER BY sort_order ASC, id ASC
");
$stmt->bind_param("i", $formId);
$stmt->execute();
$res = $stmt->get_result();

while ($section = $res->fetch_assoc()) {
  $section["fields"] = [];
  $sections[(int)$section["id"]] = $section;
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

  $fields = [];

  while ($field = $fieldsRes->fetch_assoc()) {
    $field["options"] = [];
    $fields[(int)$field["id"]] = $field;
  }

  if (!empty($fields)) {
    $fieldIds = implode(",", array_map("intval", array_keys($fields)));

    $optionsRes = $conn->query("
      SELECT id, field_id, label, price, price_type, sort_order
      FROM booking_form_options
      WHERE field_id IN ($fieldIds)
      ORDER BY sort_order ASC, id ASC
    ");

    while ($option = $optionsRes->fetch_assoc()) {
      $fields[(int)$option["field_id"]]["options"][] = $option;
    }
  }

  foreach ($fields as $field) {
    $sections[(int)$field["section_id"]]["fields"][] = $field;
  }
}

$form["sections"] = array_values($sections);

echo json_encode([
  "success" => true,
  "form" => $form
]);
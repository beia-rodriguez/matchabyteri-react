<?php
require_once __DIR__ . "/admin-common-api.php";

$type = $_GET["type"] ?? "";

if (!in_array($type, ["event", "workshop"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid form type"]);
  exit();
}

$stmt = $conn->prepare("
  SELECT *
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
    "csrf_token" => $csrf,
    "form" => null
  ]);
  exit();
}

$formId = (int)$form["id"];
$sections = [];

$stmt = $conn->prepare("
  SELECT *
  FROM booking_form_sections
  WHERE form_id = ?
  ORDER BY sort_order ASC, id ASC
");
$stmt->bind_param("i", $formId);
$stmt->execute();
$res = $stmt->get_result();

while ($section = $res->fetch_assoc()) {
  $section["id"] = (int)$section["id"];
  $section["form_id"] = (int)$section["form_id"];
  $section["sort_order"] = (int)$section["sort_order"];
  $section["fields"] = [];
  $sections[(int)$section["id"]] = $section;
}

$stmt->close();

if (!empty($sections)) {
  $sectionIds = implode(",", array_map("intval", array_keys($sections)));

  $fieldsRes = $conn->query("
    SELECT *
    FROM booking_form_fields
    WHERE section_id IN ($sectionIds)
    ORDER BY sort_order ASC, id ASC
  ");

  $fields = [];

  while ($field = $fieldsRes->fetch_assoc()) {
    $field["id"] = (int)$field["id"];
    $field["section_id"] = (int)$field["section_id"];
    $field["is_required"] = (int)$field["is_required"];
    $field["allow_quantity"] = (int)$field["allow_quantity"];
    $field["sort_order"] = (int)$field["sort_order"];
    $field["options"] = [];
    $fields[(int)$field["id"]] = $field;
  }

  if (!empty($fields)) {
    $fieldIds = implode(",", array_map("intval", array_keys($fields)));

    $optRes = $conn->query("
      SELECT *
      FROM booking_form_options
      WHERE field_id IN ($fieldIds)
      ORDER BY sort_order ASC, id ASC
    ");

    while ($option = $optRes->fetch_assoc()) {
      $option["id"] = (int)$option["id"];
      $option["field_id"] = (int)$option["field_id"];
      $option["price"] = (float)$option["price"];
      $option["sort_order"] = (int)$option["sort_order"];

      $fields[(int)$option["field_id"]]["options"][] = $option;
    }
  }

  foreach ($fields as $field) {
    $sections[(int)$field["section_id"]]["fields"][] = $field;
  }
}

$form["id"] = (int)$form["id"];
$form["downpayment_percentage"] = (float)$form["downpayment_percentage"];
$form["is_active"] = (int)$form["is_active"];
$form["sections"] = array_values($sections);

echo json_encode([
  "success" => true,
  "csrf_token" => $csrf,
  "form" => $form
]);
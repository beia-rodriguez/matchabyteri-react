<?php
require_once __DIR__ . "/admin-common-api.php";

require_post();

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid JSON request"]);
  exit();
}

verify_csrf_json($data, $csrf);

$bookingType = $data["booking_type"] ?? "";
$title = trim($data["title"] ?? "");
$downpayment = (float)($data["downpayment_percentage"] ?? 50);
$sections = $data["sections"] ?? [];

if (!in_array($bookingType, ["event", "workshop"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking type"]);
  exit();
}

if ($title === "") {
  http_response_code(400);
  echo json_encode(["error" => "Form title is required"]);
  exit();
}

if ($downpayment < 1 || $downpayment > 100) {
  http_response_code(400);
  echo json_encode(["error" => "Downpayment must be between 1 and 100"]);
  exit();
}

if (!is_array($sections) || count($sections) === 0) {
  http_response_code(400);
  echo json_encode(["error" => "At least one section is required"]);
  exit();
}

$allowedTypes = [
  "text",
  "number",
  "email",
  "textarea",
  "select",
  "radio",
    "checkbox",
  "date",
  "time",
  "file"
];

$allowedPriceTypes = [
  "fixed",
  "per_quantity",
  "per_cup"
];

$conn->begin_transaction();

try {
  /*
    Only one active form per booking type.
    Old forms are kept in DB but marked inactive so old booking snapshots remain safe.
  */
  $deactivate = $conn->prepare("
    UPDATE booking_forms
    SET is_active = 0
    WHERE booking_type = ?
  ");
  $deactivate->bind_param("s", $bookingType);
  $deactivate->execute();
  $deactivate->close();

  $formStmt = $conn->prepare("
    INSERT INTO booking_forms
      (booking_type, title, downpayment_percentage, is_active)
    VALUES
      (?, ?, ?, 1)
  ");
  $formStmt->bind_param("ssd", $bookingType, $title, $downpayment);
  $formStmt->execute();

  $formId = $conn->insert_id;
  $formStmt->close();

  foreach ($sections as $sectionIndex => $section) {
    $sectionTitle = trim($section["title"] ?? "");

    if ($sectionTitle === "") {
      continue;
    }

    $sectionSort = $sectionIndex + 1;

    $sectionStmt = $conn->prepare("
      INSERT INTO booking_form_sections
        (form_id, title, sort_order)
      VALUES
        (?, ?, ?)
    ");
    $sectionStmt->bind_param("isi", $formId, $sectionTitle, $sectionSort);
    $sectionStmt->execute();

    $sectionId = $conn->insert_id;
    $sectionStmt->close();

    $fields = $section["fields"] ?? [];

    if (!is_array($fields)) {
      continue;
    }

    foreach ($fields as $fieldIndex => $field) {
      $label = trim($field["label"] ?? "");
      $fieldName = trim($field["field_name"] ?? "");
      $fieldType = $field["field_type"] ?? "text";
      $isRequired = !empty($field["is_required"]) ? 1 : 0;
      $allowQuantity = !empty($field["allow_quantity"]) ? 1 : 0;
      $fieldSort = $fieldIndex + 1;

      if ($label === "") {
        continue;
      }

      if ($fieldName === "") {
        $fieldName = strtolower(preg_replace("/[^a-zA-Z0-9]+/", "_", $label));
        $fieldName = trim($fieldName, "_");
      }

      if ($fieldName === "") {
        $fieldName = "field_" . $fieldIndex;
      }

      if (!in_array($fieldType, $allowedTypes, true)) {
        $fieldType = "text";
      }

      $fieldStmt = $conn->prepare("
        INSERT INTO booking_form_fields
          (section_id, label, field_name, field_type, is_required, allow_quantity, sort_order)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
      ");
      $fieldStmt->bind_param(
        "isssiii",
        $sectionId,
        $label,
        $fieldName,
        $fieldType,
        $isRequired,
        $allowQuantity,
        $fieldSort
      );
      $fieldStmt->execute();

      $fieldId = $conn->insert_id;
      $fieldStmt->close();

      $options = $field["options"] ?? [];

      if (!is_array($options)) {
        continue;
      }

      foreach ($options as $optionIndex => $option) {
        $optionLabel = trim($option["label"] ?? "");

        if ($optionLabel === "") {
          continue;
        }

        $price = (float)($option["price"] ?? 0);
        $priceType = $option["price_type"] ?? "fixed";
        $optionSort = $optionIndex + 1;

        if (!in_array($priceType, $allowedPriceTypes, true)) {
          $priceType = "fixed";
        }

        $optionStmt = $conn->prepare("
          INSERT INTO booking_form_options
            (field_id, label, price, price_type, sort_order)
          VALUES
            (?, ?, ?, ?, ?)
        ");
        $optionStmt->bind_param(
          "isdsi",
          $fieldId,
          $optionLabel,
          $price,
          $priceType,
          $optionSort
        );
        $optionStmt->execute();
        $optionStmt->close();
      }
    }
  }

  $conn->commit();

  echo json_encode([
    "success" => true,
    "message" => "Booking form saved successfully.",
    "form_id" => $formId
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  http_response_code(500);
  echo json_encode([
    "error" => "Failed to save booking form.",
    "details" => $e->getMessage()
  ]);
  exit();
}
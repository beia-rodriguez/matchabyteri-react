<?php
require_once __DIR__ . "/admin-common-api.php";

require_post();

header("Content-Type: application/json; charset=utf-8");

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid JSON request"]);
  exit();
}

verify_csrf_json($data, $csrf);

$bookingType = $data["booking_type"] ?? "";
$title = trim((string)($data["title"] ?? ""));
$baseRate = round((float)($data["base_rate"] ?? 0), 2);
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

if ($baseRate < 0) {
  http_response_code(400);
  echo json_encode(["error" => "Base booking rate cannot be negative"]);
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

$normalizedSections = [];

foreach ($sections as $sectionIndex => $section) {
  if (!is_array($section)) {
    continue;
  }

  $sectionTitle = trim((string)($section["title"] ?? ""));
  $fields = $section["fields"] ?? [];

  if (!is_array($fields)) {
    continue;
  }

  $normalizedFields = [];

  foreach ($fields as $fieldIndex => $field) {
    if (!is_array($field)) {
      continue;
    }

    $label = trim((string)($field["label"] ?? ""));
    $fieldName = trim((string)($field["field_name"] ?? ""));
    $fieldType = (string)($field["field_type"] ?? "text");
    $isRequired = !empty($field["is_required"]) ? 1 : 0;
    $allowQuantity = !empty($field["allow_quantity"]) ? 1 : 0;

    if ($label === "") {
      http_response_code(400);
      echo json_encode([
        "error" => "Every question needs a label.",
        "details" => "Section " . ($sectionIndex + 1) . ", question " . ($fieldIndex + 1) . " is missing a label."
      ]);
      exit();
    }

    if ($fieldName === "") {
      $fieldName = strtolower(preg_replace("/[^a-zA-Z0-9]+/", "_", $label));
      $fieldName = trim($fieldName, "_");
    }

    if ($fieldName === "") {
      $fieldName = "field_" . ($fieldIndex + 1);
    }

    if (!in_array($fieldType, $allowedTypes, true)) {
      $fieldType = "text";
    }

    $options = $field["options"] ?? [];
    $normalizedOptions = [];

    if (in_array($fieldType, ["select", "radio", "checkbox"], true)) {
      if (!is_array($options)) {
        $options = [];
      }

      foreach ($options as $optionIndex => $option) {
        if (!is_array($option)) {
          continue;
        }

        $isOther = !empty($option["is_other"]) ? 1 : 0;
        $optionLabel = trim((string)($option["label"] ?? ""));

        if ($isOther === 1) {
          $optionLabel = "Other";
        }

        if ($optionLabel === "") {
          http_response_code(400);
          echo json_encode([
            "error" => "Every option needs a label.",
            "details" => "\"" . $label . "\" has a blank option."
          ]);
          exit();
        }

        $price = $isOther === 1 ? 0.0 : (float)($option["price"] ?? 0);
        $priceType = $isOther === 1 ? "fixed" : (string)($option["price_type"] ?? "fixed");

        if ($price < 0) {
          http_response_code(400);
          echo json_encode([
            "error" => "Option prices cannot be negative.",
            "details" => "\"" . $optionLabel . "\" under \"" . $label . "\" has an invalid price."
          ]);
          exit();
        }

        if (!in_array($priceType, $allowedPriceTypes, true)) {
          $priceType = "fixed";
        }

        $normalizedOptions[] = [
          "label" => $optionLabel,
          "price" => $price,
          "price_type" => $priceType,
          "is_other" => $isOther
        ];
      }

      if (count($normalizedOptions) === 0) {
        http_response_code(400);
        echo json_encode([
          "error" => "Choice questions need at least one option.",
          "details" => "\"" . $label . "\" has no valid options."
        ]);
        exit();
      }
    } else {
      $allowQuantity = 0;
    }

    if ($fieldType !== "checkbox") {
      $allowQuantity = 0;
    }

    $normalizedFields[] = [
      "label" => $label,
      "field_name" => $fieldName,
      "field_type" => $fieldType,
      "is_required" => $isRequired,
      "allow_quantity" => $allowQuantity,
      "options" => $normalizedOptions
    ];
  }

  if (count($normalizedFields) === 0) {
    continue;
  }

  /*
    Section titles are allowed to be blank because the admin UI says:
    "leave blank for no header". We still save the section so its fields
    do not disappear.
  */
  $normalizedSections[] = [
    "title" => $sectionTitle,
    "fields" => $normalizedFields
  ];
}

if (count($normalizedSections) === 0) {
  http_response_code(400);
  echo json_encode(["error" => "At least one section with at least one question is required."]);
  exit();
}

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

  if (!$deactivate) {
    throw new Exception("Failed to prepare form deactivation: " . $conn->error);
  }

  $deactivate->bind_param("s", $bookingType);
  $deactivate->execute();
  $deactivate->close();

  $formStmt = $conn->prepare("
    INSERT INTO booking_forms
      (booking_type, title, base_rate, downpayment_percentage, is_active)
    VALUES
      (?, ?, ?, ?, 1)
  ");

  if (!$formStmt) {
    throw new Exception("Failed to prepare form insert: " . $conn->error);
  }

  $formStmt->bind_param("ssdd", $bookingType, $title, $baseRate, $downpayment);
  $formStmt->execute();

  $formId = $conn->insert_id;
  $formStmt->close();

  foreach ($normalizedSections as $sectionIndex => $section) {
    $sectionTitle = $section["title"];
    $sectionSort = $sectionIndex + 1;

    $sectionStmt = $conn->prepare("
      INSERT INTO booking_form_sections
        (form_id, title, sort_order)
      VALUES
        (?, ?, ?)
    ");

    if (!$sectionStmt) {
      throw new Exception("Failed to prepare section insert: " . $conn->error);
    }

    $sectionStmt->bind_param("isi", $formId, $sectionTitle, $sectionSort);
    $sectionStmt->execute();

    $sectionId = $conn->insert_id;
    $sectionStmt->close();

    foreach ($section["fields"] as $fieldIndex => $field) {
      $fieldSort = $fieldIndex + 1;

      $fieldStmt = $conn->prepare("
        INSERT INTO booking_form_fields
          (section_id, label, field_name, field_type, is_required, allow_quantity, sort_order)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)
      ");

      if (!$fieldStmt) {
        throw new Exception("Failed to prepare field insert: " . $conn->error);
      }

      $fieldStmt->bind_param(
        "isssiii",
        $sectionId,
        $field["label"],
        $field["field_name"],
        $field["field_type"],
        $field["is_required"],
        $field["allow_quantity"],
        $fieldSort
      );

      $fieldStmt->execute();

      $fieldId = $conn->insert_id;
      $fieldStmt->close();

      foreach ($field["options"] as $optionIndex => $option) {
        $optionSort = $optionIndex + 1;

        $optionStmt = $conn->prepare("
          INSERT INTO booking_form_options
            (field_id, label, price, price_type, is_other, sort_order)
          VALUES
            (?, ?, ?, ?, ?, ?)
        ");

        if (!$optionStmt) {
          throw new Exception("Failed to prepare option insert: " . $conn->error);
        }

        $optionStmt->bind_param(
          "isdsii",
          $fieldId,
          $option["label"],
          $option["price"],
          $option["price_type"],
          $option["is_other"],
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
    "form_id" => $formId,
    "saved_sections" => count($normalizedSections)
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  error_log("save-booking-form error: " . $e->getMessage());

  http_response_code(500);
  echo json_encode([
    "error" => "Failed to save booking form.",
    "details" => $e->getMessage()
  ]);
  exit();
}

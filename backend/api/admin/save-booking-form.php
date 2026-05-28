<?php
require_once __DIR__ . "/admin-common-api.php";

require_post();

header("Content-Type: application/json; charset=utf-8");

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid JSON request"
  ]);
  exit();
}

verify_csrf_json($data, $csrf);

$bookingType = $data["booking_type"] ?? "";
$pricing = $data["pricing"] ?? [];

if (!in_array($bookingType, ["event_booking", "private_workshop"], true)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid booking type. Use event_booking or private_workshop."
  ]);
  exit();
}

if (!is_array($pricing)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Pricing data is required."
  ]);
  exit();
}

$allowedSettings = [
  "event_booking" => [
    "event_50_cups_price_per_cup" => [
      "description" => "Event booking price per cup for 50 cups",
      "min" => 0,
      "max" => null
    ],
    "event_100_cups_price_per_cup" => [
      "description" => "Event booking price per cup for 100 cups",
      "min" => 0,
      "max" => null
    ],
    "event_150_cups_price_per_cup" => [
      "description" => "Event booking price per cup for 150 cups",
      "min" => 0,
      "max" => null
    ],
    "event_200_cups_price_per_cup" => [
      "description" => "Event booking price per cup for 200 cups",
      "min" => 0,
      "max" => null
    ],
    "event_signature_addon" => [
      "description" => "Signature menu package add-on",
      "min" => 0,
      "max" => null
    ],
    "event_plus_addon" => [
      "description" => "Plus menu package add-on",
      "min" => 0,
      "max" => null
    ],
    "event_premium_addon" => [
      "description" => "Premium menu package add-on",
      "min" => 0,
      "max" => null
    ],
    "event_booking_downpayment_percentage" => [
      "description" => "Event booking downpayment percentage",
      "min" => 1,
      "max" => 100
    ]
  ],

  "private_workshop" => [
    "private_workshop_standard_price" => [
      "description" => "Private workshop standard price per person",
      "min" => 0,
      "max" => null
    ],
    "private_workshop_premium_price" => [
      "description" => "Private workshop premium price per person",
      "min" => 0,
      "max" => null
    ],
    "private_workshop_downpayment_percentage" => [
      "description" => "Private workshop downpayment percentage",
      "min" => 1,
      "max" => 100
    ]
  ]
];

$settingsForType = $allowedSettings[$bookingType];
$normalizedPricing = [];

foreach ($settingsForType as $key => $rules) {
  if (!array_key_exists($key, $pricing)) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Missing pricing setting: " . $key
    ]);
    exit();
  }

  if (!is_numeric($pricing[$key])) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => "Invalid numeric value for: " . $key
    ]);
    exit();
  }

  $value = round((float)$pricing[$key], 2);

  if ($value < $rules["min"]) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => $key . " cannot be lower than " . $rules["min"]
    ]);
    exit();
  }

  if ($rules["max"] !== null && $value > $rules["max"]) {
    http_response_code(400);
    echo json_encode([
      "success" => false,
      "error" => $key . " cannot be higher than " . $rules["max"]
    ]);
    exit();
  }

  $normalizedPricing[$key] = [
    "value" => $value,
    "description" => $rules["description"]
  ];
}

$conn->begin_transaction();

try {
  $stmt = $conn->prepare("
    INSERT INTO pricing_settings
      (setting_key, setting_value, description)
    VALUES
      (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      setting_value = VALUES(setting_value),
      description = VALUES(description),
      updated_at = CURRENT_TIMESTAMP
  ");

  if (!$stmt) {
    throw new Exception("Failed to prepare pricing settings update: " . $conn->error);
  }

  foreach ($normalizedPricing as $key => $setting) {
    $value = $setting["value"];
    $description = $setting["description"];

    $stmt->bind_param("sds", $key, $value, $description);
    $stmt->execute();
  }

  $stmt->close();

  $conn->commit();

  echo json_encode([
    "success" => true,
    "message" => "Pricing settings saved successfully.",
    "booking_type" => $bookingType,
    "saved_settings" => count($normalizedPricing)
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  error_log("save-booking-form pricing error: " . $e->getMessage());

  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Failed to save pricing settings.",
    "details" => $e->getMessage()
  ]);
  exit();
}
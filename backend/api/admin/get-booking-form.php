<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

$type = $_GET["type"] ?? "";

$allowedTypes = ["event_booking", "private_workshop"];

if (!in_array($type, $allowedTypes, true)) {
  http_response_code(400);
  echo json_encode([
    "success" => false,
    "error" => "Invalid booking type. Use event_booking or private_workshop."
  ]);
  exit();
}

$defaults = [
  "event_50_cups_price_per_cup" => 230.00,
  "event_100_cups_price_per_cup" => 220.00,
  "event_150_cups_price_per_cup" => 210.00,
  "event_200_cups_price_per_cup" => 200.00,

  "event_signature_addon" => 0.00,
  "event_plus_addon" => 1000.00,
  "event_premium_addon" => 2000.00,
  "event_booking_downpayment_percentage" => 50.00,

  "private_workshop_standard_price" => 3000.00,
  "private_workshop_premium_price" => 3800.00,
  "private_workshop_downpayment_percentage" => 50.00
];

$keysByType = [
  "event_booking" => [
    "event_50_cups_price_per_cup",
    "event_100_cups_price_per_cup",
    "event_150_cups_price_per_cup",
    "event_200_cups_price_per_cup",
    "event_signature_addon",
    "event_plus_addon",
    "event_premium_addon",
    "event_booking_downpayment_percentage"
  ],

  "private_workshop" => [
    "private_workshop_standard_price",
    "private_workshop_premium_price",
    "private_workshop_downpayment_percentage"
  ]
];

$requestedKeys = $keysByType[$type];
$pricing = [];

foreach ($requestedKeys as $key) {
  $pricing[$key] = $defaults[$key];
}

$placeholders = implode(",", array_fill(0, count($requestedKeys), "?"));
$types = str_repeat("s", count($requestedKeys));

$stmt = $conn->prepare("
  SELECT setting_key, setting_value
  FROM pricing_settings
  WHERE setting_key IN ($placeholders)
");

if ($stmt) {
  $stmt->bind_param($types, ...$requestedKeys);
  $stmt->execute();

  $result = $stmt->get_result();

  while ($row = $result->fetch_assoc()) {
    $key = $row["setting_key"];

    if (array_key_exists($key, $pricing)) {
      $pricing[$key] = round((float)$row["setting_value"], 2);
    }
  }

  $stmt->close();
} else {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => "Failed to load pricing settings.",
    "details" => $conn->error
  ]);
  exit();
}

$form = null;

if ($type === "event_booking") {
  $form = [
    "booking_type" => "event_booking",
    "title" => "Event Booking Pricing",
    "pricing_rule" => "cup_quantity_x_price_per_cup_plus_menu_addon",
    "cup_packages" => [
      [
        "quantity" => 50,
        "price_per_cup" => $pricing["event_50_cups_price_per_cup"]
      ],
      [
        "quantity" => 100,
        "price_per_cup" => $pricing["event_100_cups_price_per_cup"]
      ],
      [
        "quantity" => 150,
        "price_per_cup" => $pricing["event_150_cups_price_per_cup"]
      ],
      [
        "quantity" => 200,
        "price_per_cup" => $pricing["event_200_cups_price_per_cup"]
      ]
    ],
    "menu_packages" => [
      [
        "package" => "SIGNATURE",
        "label" => "Signature Package",
        "description" => "4 signature drinks",
        "addon" => $pricing["event_signature_addon"]
      ],
      [
        "package" => "PLUS",
        "label" => "Plus Package",
        "description" => "Signature drinks + 2 additional drinks",
        "addon" => $pricing["event_plus_addon"]
      ],
      [
        "package" => "PREMIUM",
        "label" => "Premium Package",
        "description" => "Signature drinks + 4 additional drinks",
        "addon" => $pricing["event_premium_addon"]
      ]
    ],
    "downpayment_percentage" => $pricing["event_booking_downpayment_percentage"]
  ];
}

if ($type === "private_workshop") {
  $form = [
    "booking_type" => "private_workshop",
    "title" => "Private Workshop Pricing",
    "pricing_rule" => "standard_attendees_x_standard_price_plus_premium_attendees_x_premium_price",
    "packages" => [
      [
        "package" => "STANDARD",
        "label" => "Standard Package",
        "price_per_person" => $pricing["private_workshop_standard_price"]
      ],
      [
        "package" => "PREMIUM",
        "label" => "Premium Package",
        "price_per_person" => $pricing["private_workshop_premium_price"]
      ]
    ],
    "downpayment_percentage" => $pricing["private_workshop_downpayment_percentage"]
  ];
}

echo json_encode([
  "success" => true,
  "csrf_token" => $csrf,
  "type" => $type,
  "pricing" => $pricing,
  "form" => $form
]);
exit();
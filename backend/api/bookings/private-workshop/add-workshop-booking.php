<?php
session_start();
require_once "../../../config/db.php";
header("Content-Type: application/json");

/* ========================= */
/* AUTH CHECK */
/* ========================= */

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

if (isset($_SESSION["role"]) && $_SESSION["role"] === "admin") {
  http_response_code(403);
  echo json_encode(["error" => "Admins cannot book workshops"]);
  exit();
}

$user_id = (int)$_SESSION["user_id"];

/* ========================= */
/* READ INPUT */
/* ========================= */

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
  echo json_encode(["error" => "Invalid request format"]);
  exit();
}

$date  = $data["date"] ?? "";
$draft = $data["draft"] ?? [];

if (!is_array($draft)) {
  echo json_encode(["error" => "Invalid booking data"]);
  exit();
}

/* ========================= */
/* DATE VALIDATION */
/* ========================= */

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  echo json_encode(["error" => "Invalid date format"]);
  exit();
}

/* ========================= */
/* REQUIRED FIELDS */
/* ========================= */

$required = [
  "full_name",
  "phone_number",
  "email",
  "start_time",
  "end_time",
  "workshop_type",
  "location_choice",
  "attendees",
  "cup_drink_option",
  "drinks_per_person"
];

foreach ($required as $field) {
  if (empty($draft[$field])) {
    echo json_encode(["error" => "Please fill in all required fields."]);
    exit();
  }
}

/* ========================= */
/* LOCATION VALIDATION */
/* ========================= */

$location_choice = trim($draft["location_choice"] ?? "");
$custom_location = trim($draft["custom_location"] ?? "");
$location = ($location_choice === "custom") ? $custom_location : $location_choice;

if ($location === "") {
  echo json_encode(["error" => "Please fill in all required fields."]);
  exit();
}

$draft["location"] = $location;

/* ========================= */
/* MILK OPTION CHECKBOX VALIDATION */
/* ========================= */

$milk_option = $draft["milk_option"] ?? [];

if (!is_array($milk_option) || count($milk_option) === 0) {
  echo json_encode(["error" => "Please select at least one milk option."]);
  exit();
}

/* optional: whitelist allowed milk options */
$allowedMilkOptions = [
  "Dairy Milk (+30/cup)",
  "Sparkling water (+40/cup)"
];

foreach ($milk_option as $option) {
  if (!in_array($option, $allowedMilkOptions, true)) {
    echo json_encode(["error" => "Invalid milk option selected."]);
    exit();
  }
}

/* ========================= */
/* EMAIL VALIDATION */
/* ========================= */

if (!preg_match("/^[^\s@]+@[^\s@]+\.[^\s@]+$/", $draft["email"])) {
  echo json_encode(["error" => "Invalid email format."]);
  exit();
}

/* ========================= */
/* TIME VALIDATION */
/* ========================= */

$start = trim($draft["start_time"]);
$end   = trim($draft["end_time"]);

if (strlen($start) === 5) $start .= ":00";
if (strlen($end) === 5)   $end   .= ":00";

$startTs = strtotime($date . " " . $start);
$endTs   = strtotime($date . " " . $end);

if (!$startTs || !$endTs || $endTs <= $startTs) {
  echo json_encode(["error" => "Invalid time selection."]);
  exit();
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
  echo json_encode(["error" => "Workshop must be 4 hours maximum."]);
  exit();
}

/* keep normalized values */
$draft["start_time"] = $start;
$draft["end_time"] = $end;

/* ========================= */
/* BLOCKED DATE CHECK */
/* ========================= */

$bstmt = $conn->prepare("SELECT reason FROM blocked_dates WHERE block_date = ?");
$bstmt->bind_param("s", $date);
$bstmt->execute();
$blocked = $bstmt->get_result()->fetch_assoc();
$bstmt->close();

if ($blocked) {
  echo json_encode([
    "error" => "This date is not available.",
    "reason" => $blocked["reason"] ?? ""
  ]);
  exit();
}

/* ========================= */
/* MAX BOOKINGS PER DAY */
/* ========================= */

$MAX_PER_DAY = 2;

$stmt = $conn->prepare("
  SELECT COUNT(*) as c
  FROM bookings
  WHERE booking_date = ?
  AND status IN ('pending','approved')
");
$stmt->bind_param("s", $date);
$stmt->execute();
$res = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ((int)$res["c"] >= $MAX_PER_DAY) {
  echo json_encode(["error" => "This day is fully booked."]);
  exit();
}

/* ========================= */
/* TIME CONFLICT CHECK */
/* ========================= */

$stmt = $conn->prepare("
  SELECT id
  FROM bookings
  WHERE booking_date = ?
    AND status IN ('pending','approved')
    AND (start_time < ? AND end_time > ?)
  LIMIT 1
");
$stmt->bind_param("sss", $date, $end, $start);
$stmt->execute();
$conflict = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($conflict) {
  echo json_encode(["error" => "That time slot is already booked."]);
  exit();
}

/* ========================= */
/* INSERT BOOKING */
/* ========================= */

$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($notesJson === false || $notesJson === "") $notesJson = "{}";

$istmt = $conn->prepare("
  INSERT INTO bookings
    (user_id, booking_date, start_time, end_time, booking_type, status, notes)
    VALUES (?, ?, ?, ?, 'workshop', 'pending', ?)
");

$istmt->bind_param(
  "issss",
  $user_id,
  $date,
  $start,
  $end,
  $notesJson
);

if ($istmt->execute()) {
  echo json_encode([
    "success" => true,
    "booking_id" => $conn->insert_id
  ]);
} else {
  echo json_encode([
    "error" => "Something went wrong. Please try again."
  ]);
}

$istmt->close();
$conn->close();
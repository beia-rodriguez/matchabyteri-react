<?php
session_start();
require_once "../../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

$date = trim($data["date"] ?? "");
$draft = $data["draft"] ?? [];

if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $date)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid date"]);
  exit();
}

if (!is_array($draft)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking data"]);
  exit();
}

$start_time = trim($draft["start_time"] ?? "");
$end_time   = trim($draft["end_time"] ?? "");
$milk_option = $draft["milk_option"] ?? [];

if ($start_time === "" || $end_time === "") {
  http_response_code(400);
  echo json_encode(["error" => "Missing start or end time"]);
  exit();
}

if (!is_array($milk_option) || count($milk_option) === 0) {
  http_response_code(400);
  echo json_encode(["error" => "Please select at least one milk option"]);
  exit();
}

$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($notesJson === false || $notesJson === "") {
  $notesJson = "{}";
}

$stmt = $conn->prepare("
  INSERT INTO bookings
    (user_id, booking_date, start_time, end_time, booking_type, status, notes)
  VALUES (?, ?, ?, ?, 'workshop', 'pending', ?)
");

if (!$stmt) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to prepare booking"]);
  exit();
}

$stmt->bind_param(
  "issss",
  $user_id,
  $date,
  $start_time,
  $end_time,
  $notesJson
);

if ($stmt->execute()) {
  echo json_encode([
    "booking_id" => $conn->insert_id
  ]);
} else {
  http_response_code(500);
  echo json_encode(["error" => "Insert failed"]);
}

$stmt->close();
$conn->close();
<?php
session_start();
require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

$userId = (int)$_SESSION["user_id"];

$stmt = $conn->prepare("
  SELECT id, name, email, phone_number
  FROM users
  WHERE id = ?
  LIMIT 1
");
$stmt->bind_param("i", $userId);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
  http_response_code(404);
  echo json_encode(["error" => "User not found"]);
  exit();
}

echo json_encode([
  "success" => true,
  "user" => $user
]);
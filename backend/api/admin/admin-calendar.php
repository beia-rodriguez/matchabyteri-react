<?php
require_once __DIR__ . "/admin-common-api.php";

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
  $blockedDates = [];
  $res = $conn->query("SELECT block_date, reason FROM blocked_dates ORDER BY block_date DESC");
  if ($res) {
    while ($r = $res->fetch_assoc()) $blockedDates[] = $r;
  }

  echo json_encode([
    "success" => true,
    "csrf" => $csrf,
    "blockedDates" => $blockedDates
  ]);
  exit();
}

require_post();
$raw = file_get_contents("php://input");
$data = json_decode($raw, true);
if (!is_array($data)) $data = [];
verify_csrf_json($data, $csrf);

$action = $data["action"] ?? "";

if ($action === "add_block") {
  $block_date = trim($data["block_date"] ?? "");
  $reason = trim($data["reason"] ?? "");

  if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $block_date)) {
    echo json_encode(["error" => "Invalid date format."]);
    exit();
  }

  $stmt = $conn->prepare("
    INSERT INTO blocked_dates (block_date, reason)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE reason = VALUES(reason)
  ");
  $stmt->bind_param("ss", $block_date, $reason);

  if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Blocked date saved."]);
  } else {
    error_log("admin-calendar add_block error: " . $stmt->error);
    echo json_encode(["error" => "Failed to save blocked date."]);
  }
  $stmt->close();
  exit();
}

if ($action === "delete_block") {
  $block_date = trim($data["block_date"] ?? "");

  if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $block_date)) {
    echo json_encode(["error" => "Invalid date format."]);
    exit();
  }

  $stmt = $conn->prepare("DELETE FROM blocked_dates WHERE block_date = ?");
  $stmt->bind_param("s", $block_date);

  if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Blocked date removed."]);
  } else {
    error_log("admin-calendar delete_block error: " . $stmt->error);
    echo json_encode(["error" => "Failed to remove blocked date."]);
  }
  $stmt->close();
  exit();
}

echo json_encode(["error" => "Unknown action."]);
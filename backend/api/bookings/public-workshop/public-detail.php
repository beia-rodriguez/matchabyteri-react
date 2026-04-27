<?php
require_once __DIR__ . "/../../../config/db.php";
header("Content-Type: application/json");

function respond($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit();
}

$id = (int)($_GET["id"] ?? 0);

if ($id <= 0) {
  respond(["message" => "Invalid id"], 400);
}

$stmt = $conn->prepare("
  SELECT *
  FROM workshops_public
  WHERE id = ? AND is_active = 1
  LIMIT 1
");

if (!$stmt) {
  respond([
    "message" => "Failed to prepare workshop detail query.",
    "error" => $conn->error
  ], 500);
}

$stmt->bind_param("i", $id);
$stmt->execute();
$res = $stmt->get_result();
$w = $res->fetch_assoc();
$stmt->close();

if (!$w) {
  respond(["message" => "Workshop not found"], 404);
}

respond(["workshop" => $w]);
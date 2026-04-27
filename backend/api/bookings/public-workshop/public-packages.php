<?php
require_once __DIR__ . "/../../../config/db.php";
header("Content-Type: application/json");

function respond($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit();
}

function has_column($conn, $table, $col) {
  $sql = "
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
    LIMIT 1
  ";

  $stmt = $conn->prepare($sql);
  $stmt->bind_param("ss", $table, $col);
  $stmt->execute();
  $res = $stmt->get_result();
  $ok = ($res && $res->num_rows > 0);
  $stmt->close();

  return $ok;
}

function table_exists($conn, $table) {
  $sql = "
    SELECT 1
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    LIMIT 1
  ";

  $stmt = $conn->prepare($sql);
  $stmt->bind_param("s", $table);
  $stmt->execute();
  $res = $stmt->get_result();
  $ok = ($res && $res->num_rows > 0);
  $stmt->close();

  return $ok;
}

$id = (int)($_GET["id"] ?? 0);
if ($id <= 0) {
  respond(["message" => "Invalid id"], 400);
}

$hasMaxSlots = has_column($conn, "workshops_public", "max_slots");
$maxSlotsExpr = $hasMaxSlots ? "max_slots" : "0 AS max_slots";

$stmt = $conn->prepare("
  SELECT *, $maxSlotsExpr
  FROM workshops_public
  WHERE id = ? AND is_active = 1
  LIMIT 1
");

if (!$stmt) {
  respond([
    "message" => "Failed to prepare workshop query.",
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

$regCount = 0;
$hasRegsTable = table_exists($conn, "workshop_registrations");

if ($hasRegsTable) {
  $regsHasStatus = has_column($conn, "workshop_registrations", "status");
  $regsHasAttendees = has_column($conn, "workshop_registrations", "attendees");

  $countExpr = $regsHasAttendees ? "COALESCE(SUM(attendees),0)" : "COUNT(*)";
  $whereStatus = $regsHasStatus ? " AND status NOT IN ('cancelled','rejected')" : "";

  $stmt = $conn->prepare("
    SELECT $countExpr AS c
    FROM workshop_registrations
    WHERE workshop_id = ?
    $whereStatus
  ");

  if ($stmt) {
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $regCount = (int)($stmt->get_result()->fetch_assoc()["c"] ?? 0);
    $stmt->close();
  }
}

$maxSlots = (int)($w["max_slots"] ?? 0);
$isFull = ($maxSlots > 0 && $regCount >= $maxSlots);
$remaining = ($maxSlots > 0) ? max(0, $maxSlots - $regCount) : null;

respond([
  "workshop" => $w,
  "regCount" => $regCount,
  "maxSlots" => $maxSlots,
  "isFull" => $isFull,
  "remaining" => $remaining
]);
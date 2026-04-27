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

if (!isset($conn) || !$conn) {
  respond([
    "success" => false,
    "message" => "Database connection failed."
  ], 500);
}

$scope = strtolower(trim($_GET["scope"] ?? "upcoming"));
if (!in_array($scope, ["upcoming", "past"], true)) {
  $scope = "upcoming";
}

$hasMaxSlots = has_column($conn, "workshops_public", "max_slots");

$hasRegsTable = table_exists($conn, "workshop_registrations");
$regsHasStatus = false;
$regsHasAttendees = false;

if ($hasRegsTable) {
  $regsHasStatus = has_column($conn, "workshop_registrations", "status");
  $regsHasAttendees = has_column($conn, "workshop_registrations", "attendees");
}

$dateFilter = ($scope === "past")
  ? "(workshop_date < CURDATE() OR (workshop_date = CURDATE() AND end_time IS NOT NULL AND end_time < CURTIME()))"
  : "(workshop_date > CURDATE() OR workshop_date = CURDATE())";

$orderBy = ($scope === "past")
  ? "workshop_date DESC, start_time DESC"
  : "workshop_date ASC, start_time ASC";

$sql = "
  SELECT id, title, poster_path, workshop_date, start_time, end_time, location
  " . ($hasMaxSlots ? ", max_slots" : "") . "
  FROM workshops_public
  WHERE is_active = 1
    AND $dateFilter
  ORDER BY $orderBy
  LIMIT 100
";

$stmt = $conn->prepare($sql);
if (!$stmt) {
  respond([
    "success" => false,
    "message" => "Failed to prepare workshop query.",
    "error" => $conn->error
  ], 500);
}

$stmt->execute();
$res = $stmt->get_result();

$workshops = [];
$ids = [];

while ($r = $res->fetch_assoc()) {
  $workshops[] = $r;
  $ids[] = (int)$r["id"];
}
$stmt->close();

$regCounts = [];

if ($hasRegsTable && count($ids) > 0) {
  $placeholders = implode(",", array_fill(0, count($ids), "?"));
  $types = str_repeat("i", count($ids));

  $countExpr = $regsHasAttendees ? "COALESCE(SUM(attendees),0)" : "COUNT(*)";

  $whereStatus = "";
  if ($regsHasStatus) {
    $whereStatus = " AND status NOT IN ('cancelled','rejected')";
  }

  $q = "
    SELECT workshop_id, $countExpr AS c
    FROM workshop_registrations
    WHERE workshop_id IN ($placeholders)
    $whereStatus
    GROUP BY workshop_id
  ";

  $stmt = $conn->prepare($q);
  if ($stmt) {
    $stmt->bind_param($types, ...$ids);
    $stmt->execute();
    $rs = $stmt->get_result();

    while ($row = $rs->fetch_assoc()) {
      $wid = (int)($row["workshop_id"] ?? 0);
      $regCounts[$wid] = (int)($row["c"] ?? 0);
    }

    $stmt->close();
  }
}

respond([
  "success" => true,
  "scope" => $scope,
  "hasMaxSlots" => $hasMaxSlots,
  "workshops" => array_map(function($w) use ($regCounts) {
    $wid = (int)$w["id"];
    $w["taken"] = (int)($regCounts[$wid] ?? 0);
    return $w;
  }, $workshops)
]);
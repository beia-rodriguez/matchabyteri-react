<?php
require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

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

  if (!$stmt) {
    return false;
  }

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

  if (!$stmt) {
    return false;
  }

  $stmt->bind_param("s", $table);
  $stmt->execute();

  $res = $stmt->get_result();
  $ok = ($res && $res->num_rows > 0);

  $stmt->close();

  return $ok;
}

function get_base_url() {
  $isHttps = (
    (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off") ||
    (!empty($_SERVER["HTTP_X_FORWARDED_PROTO"]) && $_SERVER["HTTP_X_FORWARDED_PROTO"] === "https")
  );

  $scheme = $isHttps ? "https" : "http";
  $host = $_SERVER["HTTP_HOST"] ?? "localhost";

  return $scheme . "://" . $host;
}

function build_poster_url($posterPath) {
  if (!$posterPath) {
    return null;
  }

  $posterPath = trim($posterPath);

  if ($posterPath === "") {
    return null;
  }

  if (preg_match("/^https?:\/\//i", $posterPath)) {
    return $posterPath;
  }

  $posterPath = str_replace("\\", "/", $posterPath);
  $posterPath = ltrim($posterPath, "/");

  /*
    Database usually saves:
    uploads/workshops/image.png

    But public access usually needs:
    /backend/uploads/workshops/image.png
  */
  if (strpos($posterPath, "backend/") === 0) {
    return get_base_url() . "/" . $posterPath;
  }

  if (strpos($posterPath, "uploads/") === 0) {
    return get_base_url() . "/backend/" . $posterPath;
  }

  return get_base_url() . "/backend/uploads/workshops/" . basename($posterPath);
}

if (!isset($conn) || !$conn) {
  respond([
    "success" => false,
    "message" => "Database connection failed."
  ], 500);
}

if (!table_exists($conn, "workshops_public")) {
  respond([
    "success" => false,
    "message" => "The workshops_public table does not exist."
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
  ? "
    (
      workshop_date < CURDATE()
      OR (
        workshop_date = CURDATE()
        AND end_time IS NOT NULL
        AND end_time < CURTIME()
      )
    )
  "
  : "
    (
      workshop_date > CURDATE()
      OR (
        workshop_date = CURDATE()
        AND (
          end_time IS NULL
          OR end_time >= CURTIME()
        )
      )
    )
  ";

$orderBy = ($scope === "past")
  ? "workshop_date DESC, start_time DESC"
  : "workshop_date ASC, start_time ASC";

$sql = "
  SELECT
    id,
    title,
    poster_path,
    workshop_date,
    start_time,
    end_time,
    location
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

  $countExpr = $regsHasAttendees
    ? "COALESCE(SUM(COALESCE(attendees, 1)), 0)"
    : "COUNT(*)";

  $whereStatus = "";

  if ($regsHasStatus) {
    $whereStatus = "
      AND (
        status IS NULL
        OR status NOT IN ('cancelled', 'rejected')
      )
    ";
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

$formattedWorkshops = array_map(function($w) use ($regCounts, $hasMaxSlots) {
  $wid = (int)$w["id"];
  $taken = (int)($regCounts[$wid] ?? 0);

  $maxSlots = null;
  $slotsLeft = null;

  if ($hasMaxSlots) {
    $maxSlots = isset($w["max_slots"]) ? (int)$w["max_slots"] : null;

    if ($maxSlots !== null && $maxSlots > 0) {
      $slotsLeft = max(0, $maxSlots - $taken);
    }
  }

  return [
    "id" => $wid,
    "title" => $w["title"] ?? "",
    "poster_path" => $w["poster_path"] ?? null,
    "poster_url" => build_poster_url($w["poster_path"] ?? null),
    "workshop_date" => $w["workshop_date"] ?? null,
    "start_time" => $w["start_time"] ?? null,
    "end_time" => $w["end_time"] ?? null,
    "location" => $w["location"] ?? "",
    "max_slots" => $maxSlots,
    "taken" => $taken,
    "slots_left" => $slotsLeft
  ];
}, $workshops);

respond([
  "success" => true,
  "scope" => $scope,
  "hasMaxSlots" => $hasMaxSlots,
  "workshops" => $formattedWorkshops
]);
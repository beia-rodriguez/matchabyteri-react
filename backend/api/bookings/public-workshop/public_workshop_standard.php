<?php
session_start();
require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

function respond($data, $code = 200){
    http_response_code($code);
    echo json_encode($data);
    exit();
}

$id = (int)($_GET["id"] ?? 0);

if ($id <= 0) {
    respond([
        "success" => false,
        "message" => "Invalid workshop ID."
    ], 400);
}

$stmt = $conn->prepare("
    SELECT
        id, title, description, poster_path, workshop_date, start_time, end_time, location,
        register_points, standard_points, max_slots, standard_price, premium_price
    FROM workshops_public
    WHERE id = ? AND is_active = 1
    LIMIT 1
");

if (!$stmt) {
    respond([
        "success" => false,
        "message" => "Failed to prepare standard workshop query.",
        "error" => $conn->error
    ], 500);
}

$stmt->bind_param("i", $id);
$stmt->execute();
$res = $stmt->get_result();
$w = $res->fetch_assoc();
$stmt->close();

if (!$w) {
    respond([
        "success" => false,
        "message" => "Workshop not found."
    ], 404);
}

$maxSlots = (int)($w["max_slots"] ?? 0);
$regCount = 0;

$stmt = $conn->prepare("SELECT COUNT(*) c FROM workshop_registrations WHERE workshop_id = ?");

if ($stmt) {
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $regCount = (int)($stmt->get_result()->fetch_assoc()["c"] ?? 0);
    $stmt->close();
}

$isFull = ($maxSlots > 0 && $regCount >= $maxSlots);
$remaining = ($maxSlots > 0) ? max(0, $maxSlots - $regCount) : null;

function parse_bullets($raw){
    $raw = trim((string)$raw);
    if ($raw === "") return [];

    $lines = preg_split("/\R+/", $raw);
    $out = [];

    foreach ($lines as $line){
        $line = trim($line);
        if ($line === "") continue;

        $line = preg_replace('/^[\-\*\x{2022}\x{2023}\x{25E6}\x{2043}\x{2219}•]+\s*/u', '', $line);
        $line = trim($line);

        if ($line !== "") $out[] = $line;
    }

    return $out;
}

$rawStandard = "";
if (isset($w["standard_points"]) && trim((string)$w["standard_points"]) !== "") {
    $rawStandard = (string)$w["standard_points"];
} elseif (!empty($w["register_points"])) {
    $rawStandard = (string)$w["register_points"];
} else {
    $rawStandard = (string)($w["description"] ?? "");
}

$bullets = parse_bullets($rawStandard);
if (count($bullets) === 0 && trim($rawStandard) !== "") {
    $bullets = [trim($rawStandard)];
}

$dateText = date("F j, Y", strtotime($w["workshop_date"]));
$startText = date("g:i A", strtotime($w["start_time"]));
$timeText = $startText;

if (!empty($w["end_time"])) {
    $timeText .= " – " . date("g:i A", strtotime($w["end_time"]));
}

respond([
    "success" => true,
    "workshop" => [
        "id" => (int)$w["id"],
        "title" => $w["title"],
        "description" => $w["description"],
        "poster_path" => $w["poster_path"],
        "workshop_date" => $w["workshop_date"],
        "start_time" => $w["start_time"],
        "end_time" => $w["end_time"],
        "location" => $w["location"],
        "dateText" => $dateText,
        "timeText" => $timeText,
        "bullets" => $bullets,
        "max_slots" => $maxSlots,
        "reg_count" => $regCount,
        "remaining" => $remaining,
        "is_full" => $isFull,
        "standard_price" => (float)$w["standard_price"],
        "premium_price" => (float)$w["premium_price"]
    ]
]);
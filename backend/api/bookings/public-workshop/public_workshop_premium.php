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
        register_points, premium_points, standard_price, premium_price
    FROM workshops_public
    WHERE id = ? AND is_active = 1
    LIMIT 1
");

if (!$stmt) {
    respond([
        "success" => false,
        "message" => "Failed to prepare premium workshop query.",
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

$rawPremium = "";
if (isset($w["premium_points"]) && trim((string)$w["premium_points"]) !== "") {
    $rawPremium = (string)$w["premium_points"];
} elseif (!empty($w["register_points"])) {
    $rawPremium = (string)$w["register_points"];
} else {
    $rawPremium = (string)($w["description"] ?? "");
}

$bullets = parse_bullets($rawPremium);
if (count($bullets) === 0 && trim($rawPremium) !== "") {
    $bullets = [trim($rawPremium)];
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
        "standard_price" => (float)$w["standard_price"],
        "premium_price" => (float)$w["premium_price"]
    ]
]);
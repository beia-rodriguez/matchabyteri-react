<?php

session_start();

header("Content-Type: application/json");

// 🔒 SESSION PROTECTION
if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

// 🔎 Get parameters
$year  = isset($_GET["year"]) ? intval($_GET["year"]) : 0;
$month = isset($_GET["month"]) ? intval($_GET["month"]) : 0;
$type  = isset($_GET["type"]) ? $_GET["type"] : "both";

if (!$year || !$month) {
    echo json_encode([]);
    exit();
}

// 🗓 Example dummy data (replace with DB logic)
$response = [];

// Example: block 15th
$response["$year-" . str_pad($month,2,"0",STR_PAD_LEFT) . "-15"] = [
    "status" => "BLOCKED",
    "reason" => "Private Event"
];

// Example: full 20th
$response["$year-" . str_pad($month,2,"0",STR_PAD_LEFT) . "-20"] = [
    "status" => "FULL",
    "reason" => "Workshop Full"
];

// Example: open with booking
$response["$year-" . str_pad($month,2,"0",STR_PAD_LEFT) . "-10"] = [
    "status" => "OPEN",
    "count" => 1,
    "max" => 2
];

echo json_encode($response);
<?php
session_start();
require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$date = $_GET["date"] ?? date("Y-m-d");

$MAX_EVENT_PER_DAY = 3;
$MAX_WORKSHOP_PER_DAY = 2;

$bookings_event = [];
$bookings_workshop = [];

$stmt = $conn->prepare("
    SELECT *
    FROM bookings
    WHERE booking_date = ?
      AND status IN ('pending','approved')
    ORDER BY start_time ASC
");

$stmt->bind_param("s", $date);
$stmt->execute();
$res = $stmt->get_result();

while ($row = $res->fetch_assoc()) {
    if ($row["booking_type"] === "event") {
        $bookings_event[] = $row;
    } elseif ($row["booking_type"] === "workshop") {
        $bookings_workshop[] = $row;
    }
}

$stmt->close();

echo json_encode([
    "blocked" => false,
    "block_reason" => "",
    "heading" => "Manage your bookings",
    "monthDay" => date("F j", strtotime($date)),
    "year" => date("Y", strtotime($date)),

    // 🔥 Separate fully booked flags
    "eventFullyBooked" => count($bookings_event) >= $MAX_EVENT_PER_DAY,
    "workshopFullyBooked" => count($bookings_workshop) >= $MAX_WORKSHOP_PER_DAY,

    "bookings_event" => $bookings_event,
    "bookings_workshop" => $bookings_workshop
]);
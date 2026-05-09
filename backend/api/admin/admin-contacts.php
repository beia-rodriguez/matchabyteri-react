<?php
require_once __DIR__ . "/admin-common-api.php";

function respond($status, $payload = []) {
    echo json_encode(array_merge([
        "status" => $status
    ], $payload));
    exit;
}

$q = trim($_GET["q"] ?? "");
$q = mb_substr($q, 0, 100);

$limit = (int)($_GET["limit"] ?? 100);

if ($limit <= 0) {
    $limit = 100;
}

if ($limit > 300) {
    $limit = 300;
}

$contacts = [];

if ($q === "") {
    $stmt = $conn->prepare("
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone_number,
            MAX(b.booking_date) AS last_booking_date,
            COUNT(DISTINCT b.id) AS total_bookings
        FROM bookings b
        INNER JOIN users u ON b.user_id = u.id
        GROUP BY u.id, u.name, u.email, u.phone_number
        ORDER BY last_booking_date DESC
        LIMIT ?
    ");

    if (!$stmt) {
        respond("error", [
            "error" => "Failed to prepare contacts query."
        ]);
    }

    $stmt->bind_param("i", $limit);
} else {
    $like = "%" . $q . "%";

    $stmt = $conn->prepare("
        SELECT
            u.id,
            u.name,
            u.email,
            u.phone_number,
            MAX(b.booking_date) AS last_booking_date,
            COUNT(DISTINCT b.id) AS total_bookings
        FROM bookings b
        INNER JOIN users u ON b.user_id = u.id
        WHERE (
            u.name LIKE ?
            OR u.email LIKE ?
            OR u.phone_number LIKE ?
        )
        GROUP BY u.id, u.name, u.email, u.phone_number
        ORDER BY last_booking_date DESC
        LIMIT ?
    ");

    if (!$stmt) {
        respond("error", [
            "error" => "Failed to prepare contacts search query."
        ]);
    }

    $stmt->bind_param("sssi", $like, $like, $like, $limit);
}

if (!$stmt->execute()) {
    $stmt->close();

    respond("error", [
        "error" => "Failed to load contacts."
    ]);
}

$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $r["id"] = (int)$r["id"];
    $r["total_bookings"] = (int)$r["total_bookings"];
    $contacts[] = $r;
}

$stmt->close();

respond("success", [
    "success" => true,
    "contacts" => $contacts,
    "q" => $q,
    "limit" => $limit,
    "csrf" => $csrf ?? ""
]);
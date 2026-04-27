<?php
require_once __DIR__ . "/admin-common-api.php";

$q = trim($_GET["q"] ?? "");
$limit = (int)($_GET["limit"] ?? 100);
if ($limit <= 0) $limit = 100;
if ($limit > 300) $limit = 300;

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
  $stmt->bind_param("i", $limit);
} else {
  $like = "%".$q."%";
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
    WHERE (u.name LIKE ? OR u.email LIKE ? OR u.phone_number LIKE ?)
    GROUP BY u.id, u.name, u.email, u.phone_number
    ORDER BY last_booking_date DESC
    LIMIT ?
  ");
  $stmt->bind_param("sssi", $like, $like, $like, $limit);
}

$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) $contacts[] = $r;
$stmt->close();

echo json_encode([
  "success" => true,
  "contacts" => $contacts,
  "q" => $q,
  "limit" => $limit,
  "csrf" => $csrf
]);
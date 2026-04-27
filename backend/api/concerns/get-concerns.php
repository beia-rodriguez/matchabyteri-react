<?php
session_start();
require_once __DIR__ . "/../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$userId = (int)$_SESSION["user_id"];

/* mark replies as seen */
$stmt = $conn->prepare("UPDATE users SET concerns_last_seen_at = NOW() WHERE id=?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$stmt->close();

/* fetch concerns */
$concerns = [];
$stmt = $conn->prepare("
  SELECT id, subject, concern_type, booking_id, details, status,
         created_at, admin_response, responded_at
  FROM concerns
  WHERE user_id=?
  ORDER BY created_at DESC
  LIMIT 100
");
$stmt->bind_param("i", $userId);
$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) $concerns[] = $r;
$stmt->close();

echo json_encode($concerns);
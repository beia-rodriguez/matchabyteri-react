<?php
require_once __DIR__ . "/admin-common-api.php";

function safe_json($s){
  if (!is_string($s) || trim($s) === "") return [];
  $d = json_decode($s, true);
  return is_array($d) ? $d : [];
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw, true);
  if (!is_array($data)) $data = [];
  verify_csrf_json($data, $csrf);

  if (($data["action"] ?? "") === "set_status") {
    $booking_id = (int)($data["booking_id"] ?? 0);
    $new_status = strtolower(trim($data["new_status"] ?? ""));
    $allowed = ["approved", "cancelled"];

    if ($booking_id <= 0 || !in_array($new_status, $allowed, true)) {
      echo json_encode(["error" => "Invalid booking update."]);
      exit();
    }

    $approved_by = (int)($_SESSION["user_id"] ?? 0);
    $stmt = $conn->prepare("
      UPDATE bookings
      SET status = ?, approved_by = ?, updated_at = NOW()
      WHERE id = ?
      LIMIT 1
    ");
    $stmt->bind_param("sii", $new_status, $approved_by, $booking_id);

    if ($stmt->execute()) {
      echo json_encode(["success" => true, "message" => "Booking updated."]);
    } else {
      error_log("admin-reservations update error: " . $stmt->error);
      echo json_encode(["error" => "Failed to update booking."]);
    }
    $stmt->close();
    exit();
  }
}

$pending = [];
$stmt = $conn->prepare("
  SELECT
    b.id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.booking_type,
    b.notes,
    u.name AS user_name,
    u.email AS user_email
  FROM bookings b
  LEFT JOIN users u ON b.user_id = u.id
  WHERE b.status = 'pending'
  ORDER BY b.booking_date DESC, b.start_time ASC
  LIMIT 80
");
$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $r["notes_decoded"] = safe_json($r["notes"] ?? "");
  $pending[] = $r;
}
$stmt->close();

echo json_encode([
  "success" => true,
  "csrf" => $csrf,
  "pending" => $pending
]);
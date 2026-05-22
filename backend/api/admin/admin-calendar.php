<?php
require_once __DIR__ . "/admin-common-api.php";

function safe_json($s) {
  if (!is_string($s) || trim($s) === "") return [];

  $d = json_decode($s, true);

  return is_array($d) ? $d : [];
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
  $blockedDates = [];

  $res = $conn->query("
    SELECT 
      block_date, 
      reason 
    FROM blocked_dates 
    ORDER BY block_date DESC
  ");

  if ($res) {
    while ($r = $res->fetch_assoc()) {
      $blockedDates[] = $r;
    }
  }

  $bookings = [];

  $stmt = $conn->prepare("
    SELECT
      b.id,
      b.user_id,
      b.time_slot_id,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_type,
      b.status,
      b.notes,
      b.admin_notes,
      b.approved_by,
      b.created_at,
      b.updated_at,
      b.total_amount,
      b.amount_paid,
      b.payment_status,
      b.form_id,
      b.form_snapshot,
      b.cancel_requested,
      b.cancel_reason,
      b.cancel_requested_at,
      u.name AS user_name,
      u.email AS user_email
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    WHERE b.status <> 'pending_payment'
    ORDER BY 
      b.booking_date DESC,
      b.start_time ASC,
      b.id DESC
    LIMIT 500
  ");

  if (!$stmt) {
    echo json_encode([
      "success" => false,
      "error" => "Failed to load booking history: " . $conn->error,
      "csrf" => $csrf,
      "blockedDates" => $blockedDates,
      "bookings" => []
    ]);
    exit();
  }

  $stmt->execute();

  $result = $stmt->get_result();

  while ($r = $result->fetch_assoc()) {
    $notes = safe_json($r["notes"] ?? "");
    $snapshot = safe_json($r["form_snapshot"] ?? "");

    $r["notes_decoded"] = $notes;
    $r["form_snapshot_decoded"] = $snapshot;

    $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
    $r["selected_items"] = $notes["selected_items"] ?? [];

    $r["total_amount"] = (float)($r["total_amount"] ?? 0);
    $r["amount_paid"] = (float)($r["amount_paid"] ?? 0);

    $r["cancel_requested"] = (int)($r["cancel_requested"] ?? 0);
    $r["cancel_reason"] = $r["cancel_reason"] ?? "";
    $r["cancel_requested_at"] = $r["cancel_requested_at"] ?? null;

    $bookings[] = $r;
  }

  $stmt->close();

  echo json_encode([
    "success" => true,
    "csrf" => $csrf,
    "blockedDates" => $blockedDates,
    "bookings" => $bookings
  ]);
  exit();
}

require_post();

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!is_array($data)) {
  $data = [];
}

verify_csrf_json($data, $csrf);

$action = $data["action"] ?? "";

if ($action === "add_block") {
  $block_date = trim($data["block_date"] ?? "");
  $reason = trim($data["reason"] ?? "");

  if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $block_date)) {
    echo json_encode(["error" => "Invalid date format."]);
    exit();
  }

  $stmt = $conn->prepare("
    INSERT INTO blocked_dates (block_date, reason)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE reason = VALUES(reason)
  ");

  if (!$stmt) {
    echo json_encode(["error" => "Failed to prepare blocked date: " . $conn->error]);
    exit();
  }

  $stmt->bind_param("ss", $block_date, $reason);

  if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Blocked date saved."]);
  } else {
    echo json_encode(["error" => "Failed to save blocked date: " . $stmt->error]);
  }

  $stmt->close();
  exit();
}

if ($action === "delete_block") {
  $block_date = trim($data["block_date"] ?? "");

  if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $block_date)) {
    echo json_encode(["error" => "Invalid date format."]);
    exit();
  }

  $stmt = $conn->prepare("DELETE FROM blocked_dates WHERE block_date = ?");

  if (!$stmt) {
    echo json_encode(["error" => "Failed to prepare delete request: " . $conn->error]);
    exit();
  }

  $stmt->bind_param("s", $block_date);

  if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Blocked date removed."]);
  } else {
    echo json_encode(["error" => "Failed to remove blocked date: " . $stmt->error]);
  }

  $stmt->close();
  exit();
}

echo json_encode(["error" => "Unknown action."]);
exit();

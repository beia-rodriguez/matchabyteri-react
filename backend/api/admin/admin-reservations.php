<?php

require_once __DIR__ . "/admin-common-api.php";

function safe_json($s) {
  if (!is_string($s) || trim($s) === "") return [];

  $d = json_decode($s, true);

  return is_array($d) ? $d : [];
}

function can_approve_payment_status($paymentStatus) {
  $paymentStatus = strtolower((string)$paymentStatus);

  return in_array($paymentStatus, ["partial", "paid"], true);
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw, true);

  if (!is_array($data)) {
    $data = [];
  }

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

    $conn->begin_transaction();

    try {
      $stmt = $conn->prepare("
        SELECT id, status, payment_status
        FROM bookings
        WHERE id = ?
        LIMIT 1
      ");

      if (!$stmt) {
        throw new Exception("Failed to prepare booking lookup.");
      }

      $stmt->bind_param("i", $booking_id);
      $stmt->execute();

      $booking = $stmt->get_result()->fetch_assoc();

      $stmt->close();

      if (!$booking) {
        throw new Exception("Booking not found.");
      }

      if ($booking["status"] !== "pending") {
        throw new Exception("Only pending bookings can be updated here.");
      }

      if (
        $new_status === "approved" &&
        !can_approve_payment_status($booking["payment_status"] ?? "unpaid")
      ) {
        throw new Exception("Booking cannot be approved until payment is partial or paid.");
      }

      $stmt = $conn->prepare("
        UPDATE bookings
        SET status = ?, approved_by = ?, updated_at = NOW()
        WHERE id = ?
          AND status = 'pending'
        LIMIT 1
      ");

      if (!$stmt) {
        throw new Exception("Failed to prepare booking update.");
      }

      $stmt->bind_param("sii", $new_status, $approved_by, $booking_id);

      if (!$stmt->execute()) {
        throw new Exception($stmt->error);
      }

      if ($stmt->affected_rows < 1) {
        throw new Exception("Booking was already updated.");
      }

      $stmt->close();

      $conn->commit();

      echo json_encode([
        "success" => true,
        "message" => $new_status === "approved"
          ? "Booking approved."
          : "Booking cancelled."
      ]);
      exit();

    } catch (Exception $e) {
      $conn->rollback();

      error_log("admin-reservations update error: " . $e->getMessage());

      echo json_encode([
        "error" => $e->getMessage()
      ]);
      exit();
    }
  }

  echo json_encode(["error" => "Invalid action."]);
  exit();
}

$pending = [];

$stmt = $conn->prepare("
  SELECT
    b.id,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.booking_type,
    b.status,
    b.payment_status,
    b.total_amount,
    b.notes,
    b.form_snapshot,
    b.created_at,
    u.name AS user_name,
    u.email AS user_email
  FROM bookings b
  LEFT JOIN users u ON b.user_id = u.id
  WHERE b.status = 'pending'
  ORDER BY b.booking_date DESC, b.start_time ASC
  LIMIT 80
");

if (!$stmt) {
  echo json_encode([
    "error" => "Failed to load pending bookings."
  ]);
  exit();
}

$stmt->execute();

$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $notes = safe_json($r["notes"] ?? "");
  $snapshot = safe_json($r["form_snapshot"] ?? "");

  $r["notes_decoded"] = $notes;
  $r["form_snapshot_decoded"] = $snapshot;

  $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
  $r["selected_items"] = $notes["selected_items"] ?? [];

  $pending[] = $r;
}

$stmt->close();

echo json_encode([
  "success" => true,
  "csrf" => $csrf,
  "pending" => $pending
]);
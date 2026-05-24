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

function json_response($data) {
  echo json_encode($data);
  exit();
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

    $allowed = ["approved", "cancelled", "completed", "rejected"];

    if ($booking_id <= 0 || !in_array($new_status, $allowed, true)) {
      json_response(["error" => "Invalid booking update."]);
    }

    $approved_by = (int)($_SESSION["user_id"] ?? 0);

    $conn->begin_transaction();

    try {
      $stmt = $conn->prepare("
        SELECT 
          id, 
          status, 
          payment_status,
          cancel_requested
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

      $current_status = strtolower((string)$booking["status"]);
      $payment_status = strtolower((string)$booking["payment_status"]);

      if (in_array($current_status, ["cancelled", "completed", "rejected"], true)) {
        throw new Exception("This booking is already closed and can no longer be updated.");
      }

      if ($new_status === "approved") {
        if ($current_status !== "pending") {
          throw new Exception("Only pending bookings can be approved.");
        }

        if (!can_approve_payment_status($payment_status)) {
          throw new Exception("Booking cannot be approved until payment is partial or paid.");
        }
      }

      if ($new_status === "cancelled") {
        if (!in_array($current_status, ["pending", "approved"], true)) {
          throw new Exception("Only pending or approved bookings can be cancelled.");
        }
      }

      if ($new_status === "completed") {
        if ($current_status !== "approved") {
          throw new Exception("Only approved bookings can be marked as completed.");
        }
      }

      if ($new_status === "rejected") {
        if ($current_status !== "pending") {
          throw new Exception("Only pending bookings can be rejected.");
        }
      }

      $stmt = $conn->prepare("
        UPDATE bookings
        SET 
          status = ?, 
          approved_by = CASE 
            WHEN ? = 'approved' THEN ?
            ELSE approved_by
          END,
          updated_at = NOW()
        WHERE id = ?
        LIMIT 1
      ");

      if (!$stmt) {
        throw new Exception("Failed to prepare booking update.");
      }

      $stmt->bind_param("ssii", $new_status, $new_status, $approved_by, $booking_id);

      if (!$stmt->execute()) {
        throw new Exception($stmt->error);
      }

      if ($stmt->affected_rows < 1) {
        throw new Exception("Booking was not updated.");
      }

      $stmt->close();

      $conn->commit();

      $message = "Booking updated.";

      if ($new_status === "approved") {
        $message = "Booking approved.";
      } elseif ($new_status === "cancelled") {
        $message = "Booking cancelled.";
      } elseif ($new_status === "completed") {
        $message = "Booking marked as completed.";
      } elseif ($new_status === "rejected") {
        $message = "Booking rejected.";
      }

      json_response([
        "success" => true,
        "message" => $message
      ]);

    } catch (Exception $e) {
      $conn->rollback();

      error_log("admin-reservations update error: " . $e->getMessage());

      json_response([
        "error" => $e->getMessage()
      ]);
    }
  }

  json_response(["error" => "Invalid action."]);
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
  WHERE b.status IN ('pending_payment', 'pending', 'approved', 'cancelled', 'completed', 'rejected')
  ORDER BY 
    CASE 
      WHEN b.cancel_requested = 1 AND b.status IN ('pending', 'approved') THEN 0
      WHEN b.status = 'pending_payment' THEN 1
      WHEN b.status = 'pending' THEN 2
      WHEN b.status = 'approved' THEN 3
      ELSE 3
    END,
    b.booking_date DESC,
    b.start_time ASC
  LIMIT 300
");

if (!$stmt) {
  json_response([
    "error" => "Failed to load reservations."
  ]);
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

  $r["total_amount"] = (float)($r["total_amount"] ?? 0);
  $r["amount_paid"] = (float)($r["amount_paid"] ?? 0);

  $r["cancel_requested"] = (int)($r["cancel_requested"] ?? 0);
  $r["cancel_reason"] = $r["cancel_reason"] ?? "";
  $r["cancel_requested_at"] = $r["cancel_requested_at"] ?? null;

  $bookings[] = $r;
}

$stmt->close();

json_response([
  "success" => true,
  "csrf" => $csrf,
  "bookings" => $bookings
]);
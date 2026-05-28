<?php

require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function safe_json($s) {
  if (!is_string($s) || trim($s) === "") return [];

  $d = json_decode($s, true);

  return is_array($d) ? $d : [];
}

function can_approve_payment_status($paymentStatus) {
  $paymentStatus = strtolower((string)$paymentStatus);

  return in_array($paymentStatus, ["partial", "paid"], true);
}

function get_pricing_setting($conn, $key, $default) {
  $stmt = $conn->prepare("
    SELECT setting_value
    FROM pricing_settings
    WHERE setting_key = ?
    LIMIT 1
  ");

  if (!$stmt) {
    return (float)$default;
  }

  $stmt->bind_param("s", $key);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$row) {
    return (float)$default;
  }

  return (float)$row["setting_value"];
}

function get_downpayment_percentage($conn, $bookingType, $booking) {
  $bookingType = strtolower((string)$bookingType);

  $snapshot = safe_json($booking["form_snapshot"] ?? "");
  if (isset($snapshot["downpayment_percentage"])) {
    $percentage = (float)$snapshot["downpayment_percentage"];

    if ($percentage > 0 && $percentage <= 100) {
      return $percentage;
    }
  }

  $notes = safe_json($booking["notes"] ?? "");
  if (isset($notes["downpayment_percentage"])) {
    $percentage = (float)$notes["downpayment_percentage"];

    if ($percentage > 0 && $percentage <= 100) {
      return $percentage;
    }
  }

  if ($bookingType === "event_booking" || $bookingType === "event") {
    return get_pricing_setting($conn, "event_booking_downpayment_percentage", 50.0);
  }

  if ($bookingType === "private_workshop" || $bookingType === "workshop") {
    return get_pricing_setting($conn, "private_workshop_downpayment_percentage", 50.0);
  }

  return 50.0;
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
      json_response(["success" => false, "error" => "Invalid booking update."]);
    }

    $approved_by = (int)($_SESSION["user_id"] ?? 0);

    $conn->begin_transaction();

    try {
      $stmt = $conn->prepare("
        SELECT 
          b.id,
          b.status,
          b.payment_status,
          b.total_amount,
          b.amount_paid,
          b.cancel_requested,

          COALESCE(SUM(
            CASE
              WHEN p.status = 'paid' THEN p.amount
              ELSE 0
            END
          ), 0) AS paid_from_payments,

          COALESCE(SUM(
            CASE
              WHEN p.status = 'pending' THEN 1
              ELSE 0
            END
          ), 0) AS pending_payment_count
        FROM bookings b
        LEFT JOIN payments p
          ON p.booking_id = b.id
        WHERE b.id = ?
        GROUP BY
          b.id,
          b.status,
          b.payment_status,
          b.total_amount,
          b.amount_paid,
          b.cancel_requested
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
      $stored_payment_status = strtolower((string)$booking["payment_status"]);

      $total_amount = (float)($booking["total_amount"] ?? 0);
      $stored_amount_paid = (float)($booking["amount_paid"] ?? 0);
      $paid_from_payments = (float)($booking["paid_from_payments"] ?? 0);
      $amount_paid = max($stored_amount_paid, $paid_from_payments);
      $pending_payment_count = (int)($booking["pending_payment_count"] ?? 0);

      if ($total_amount > 0 && $amount_paid >= $total_amount) {
        $payment_status = "paid";
      } elseif ($amount_paid > 0) {
        $payment_status = "partial";
      } elseif ($pending_payment_count > 0) {
        $payment_status = "pending";
      } elseif (in_array($stored_payment_status, ["unpaid", "pending", "partial", "paid", "rejected"], true)) {
        $payment_status = $stored_payment_status;
      } else {
        $payment_status = "unpaid";
      }

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
        if (!in_array($current_status, ["pending_payment", "pending", "approved"], true)) {
          throw new Exception("Only pending payment, pending, or approved bookings can be cancelled.");
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
          payment_status = ?,
          amount_paid = ?,
          approved_by = CASE 
            WHEN ? = 'approved' THEN ?
            ELSE approved_by
          END,
          cancel_requested = CASE
            WHEN ? IN ('cancelled', 'rejected') THEN 0
            ELSE cancel_requested
          END,
          updated_at = NOW()
        WHERE id = ?
        LIMIT 1
      ");

      if (!$stmt) {
        throw new Exception("Failed to prepare booking update.");
      }

      $stmt->bind_param(
        "ssdsisi",
        $new_status,
        $payment_status,
        $amount_paid,
        $new_status,
        $approved_by,
        $new_status,
        $booking_id
      );

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
        "success" => false,
        "error" => $e->getMessage()
      ]);
    }
  }

  json_response(["success" => false, "error" => "Invalid action."]);
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
    b.amount_paid AS stored_amount_paid,
    b.payment_status AS stored_payment_status,
    b.form_id,
    b.form_snapshot,
    b.cancel_requested,
    b.cancel_reason,
    b.cancel_requested_at,

    u.name AS user_name,
    u.email AS user_email,

    COALESCE(SUM(
      CASE
        WHEN p.status = 'paid' THEN p.amount
        ELSE 0
      END
    ), 0) AS paid_from_payments,

    COALESCE(SUM(
      CASE
        WHEN p.status = 'pending' THEN 1
        ELSE 0
      END
    ), 0) AS pending_payment_count
  FROM bookings b
  LEFT JOIN users u
    ON b.user_id = u.id
  LEFT JOIN payments p
    ON p.booking_id = b.id
  WHERE b.status IN ('pending_payment', 'pending', 'approved', 'cancelled', 'completed', 'rejected')
  GROUP BY
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
    u.name,
    u.email
  ORDER BY 
    CASE 
      WHEN b.cancel_requested = 1 AND b.status IN ('pending_payment', 'pending', 'approved') THEN 0
      WHEN b.status = 'pending_payment' THEN 1
      WHEN b.status = 'pending' THEN 2
      WHEN b.status = 'approved' THEN 3
      ELSE 4
    END,
    b.booking_date DESC,
    b.start_time ASC
  LIMIT 300
");

if (!$stmt) {
  json_response([
    "success" => false,
    "error" => "Failed to load reservations."
  ]);
}

$stmt->execute();

$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $notes = safe_json($r["notes"] ?? "");
  $snapshot = safe_json($r["form_snapshot"] ?? "");

  $total_amount = (float)($r["total_amount"] ?? 0);
  $stored_amount_paid = (float)($r["stored_amount_paid"] ?? 0);
  $paid_from_payments = (float)($r["paid_from_payments"] ?? 0);
  $amount_paid = max($stored_amount_paid, $paid_from_payments);

  $pending_payment_count = (int)($r["pending_payment_count"] ?? 0);
  $stored_payment_status = strtolower((string)($r["stored_payment_status"] ?? "unpaid"));

  if ($total_amount > 0 && $amount_paid >= $total_amount) {
    $payment_status = "paid";
  } elseif ($amount_paid > 0) {
    $payment_status = "partial";
  } elseif ($pending_payment_count > 0) {
    $payment_status = "pending";
  } elseif (in_array($stored_payment_status, ["unpaid", "pending", "partial", "paid", "rejected"], true)) {
    $payment_status = $stored_payment_status;
  } else {
    $payment_status = "unpaid";
  }

  $booking_type = strtolower((string)($r["booking_type"] ?? ""));

  $downpayment_percentage = get_downpayment_percentage($conn, $booking_type, $r);
  if ($downpayment_percentage <= 0 || $downpayment_percentage > 100) {
    $downpayment_percentage = 50.0;
  }

  $downpayment_amount = round($total_amount * ($downpayment_percentage / 100), 2);
  $balance = round(max(0, $total_amount - $amount_paid), 2);

  $r["notes_decoded"] = $notes;
  $r["form_snapshot_decoded"] = $snapshot;

  $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
  $r["selected_items"] = $notes["selected_items"] ?? [];

  $r["total_amount"] = $total_amount;
  $r["amount_paid"] = $amount_paid;
  $r["balance"] = $balance;
  $r["payment_status"] = $payment_status;

  $r["downpayment_percentage"] = $downpayment_percentage;
  $r["downpayment_amount"] = $downpayment_amount;

  $r["stored_amount_paid"] = $stored_amount_paid;
  $r["paid_from_payments"] = $paid_from_payments;
  $r["pending_payment_count"] = $pending_payment_count;

  $r["cancel_requested"] = (int)($r["cancel_requested"] ?? 0);
  $r["cancel_reason"] = $r["cancel_reason"] ?? "";
  $r["cancel_requested_at"] = $r["cancel_requested_at"] ?? null;

  unset($r["stored_payment_status"]);

  $bookings[] = $r;
}

$stmt->close();

json_response([
  "success" => true,
  "csrf" => $csrf,
  "bookings" => $bookings
]);
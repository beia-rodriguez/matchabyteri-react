<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");
date_default_timezone_set("Asia/Manila");

function json_response($payload, int $statusCode = 200): void {
  http_response_code($statusCode);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit();
}

function safe_json($s): array {
  if (!is_string($s) || trim($s) === "") {
    return [];
  }

  $d = json_decode($s, true);

  return is_array($d) ? $d : [];
}

function clean_date($value): string {
  $value = trim((string)$value);
  return preg_match("/^\d{4}-\d{2}-\d{2}$/", $value) ? $value : "";
}

function normalize_booking_type_label($type): string {
  $type = strtolower(trim((string)$type));

  if ($type === "event") return "event_booking";
  if ($type === "workshop") return "private_workshop";

  return $type;
}

function normalize_booking_status($status): string {
  $status = strtolower(trim((string)$status));

  if ($status === "complete") return "completed";
  if ($status === "") return "pending";

  return $status;
}

function compute_payment_status($totalAmount, $amountPaid, $pendingPaymentCount, $rejectedPaymentCount, $storedPaymentStatus): string {
  $totalAmount = round((float)$totalAmount, 2);
  $amountPaid = round((float)$amountPaid, 2);
  $pendingPaymentCount = (int)$pendingPaymentCount;
  $rejectedPaymentCount = (int)$rejectedPaymentCount;
  $storedPaymentStatus = strtolower((string)$storedPaymentStatus);

  if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
    return "paid";
  }

  if ($amountPaid > 0) {
    return "partial";
  }

  if ($pendingPaymentCount > 0) {
    return "pending";
  }

  if ($rejectedPaymentCount > 0 && in_array($storedPaymentStatus, ["rejected", "pending", "unpaid"], true)) {
    return "rejected";
  }

  if (in_array($storedPaymentStatus, ["unpaid", "pending", "partial", "paid", "rejected"], true)) {
    return $storedPaymentStatus;
  }

  return "unpaid";
}

function get_active_booking_count_for_date(mysqli $conn, string $date): int {
  $stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM bookings
    WHERE booking_date = ?
      AND LOWER(status) IN ('pending_payment', 'pending', 'approved')
  ");

  if (!$stmt) {
    throw new Exception("Failed to check active bookings for this date.");
  }

  $stmt->bind_param("s", $date);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  return (int)($row["total"] ?? 0);
}

function get_active_public_workshop_count_for_date(mysqli $conn, string $date): int {
  $stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM workshops_public
    WHERE workshop_date = ?
      AND is_active = 1
  ");

  if (!$stmt) {
    return 0;
  }

  $stmt->bind_param("s", $date);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  return (int)($row["total"] ?? 0);
}

function load_blocked_dates(mysqli $conn): array {
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
      $date = (string)($r["block_date"] ?? "");
      $r["active_booking_count"] = $date !== "" ? get_active_booking_count_for_date($conn, $date) : 0;
      $r["public_workshop_count"] = $date !== "" ? get_active_public_workshop_count_for_date($conn, $date) : 0;
      $blockedDates[] = $r;
    }
  }

  return $blockedDates;
}

function load_bookings(mysqli $conn): array {
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
      COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) AS paid_from_payments,
      COALESCE(SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_payment_count,
      COALESCE(SUM(CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_payment_count
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    LEFT JOIN payments p ON p.booking_id = b.id
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
      b.booking_date DESC,
      b.start_time ASC,
      b.id DESC
    LIMIT 500
  ");

  if (!$stmt) {
    throw new Exception("Failed to load booking history: " . $conn->error);
  }

  $stmt->execute();
  $result = $stmt->get_result();

  while ($r = $result->fetch_assoc()) {
    $notes = safe_json($r["notes"] ?? "");
    $snapshot = safe_json($r["form_snapshot"] ?? "");

    $totalAmount = round((float)($r["total_amount"] ?? 0), 2);
    $storedAmountPaid = round((float)($r["stored_amount_paid"] ?? 0), 2);
    $paidFromPayments = round((float)($r["paid_from_payments"] ?? 0), 2);
    $amountPaid = max($storedAmountPaid, $paidFromPayments);
    $pendingPaymentCount = (int)($r["pending_payment_count"] ?? 0);
    $rejectedPaymentCount = (int)($r["rejected_payment_count"] ?? 0);

    $r["record_kind"] = "booking";
    $r["calendar_type"] = normalize_booking_type_label($r["booking_type"] ?? "");
    $r["status"] = normalize_booking_status($r["status"] ?? "");
    $r["notes_decoded"] = $notes;
    $r["form_snapshot_decoded"] = $snapshot;
    $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
    $r["selected_items"] = $notes["selected_items"] ?? [];
    $r["total_amount"] = $totalAmount;
    $r["amount_paid"] = $amountPaid;
    $r["balance"] = round(max(0, $totalAmount - $amountPaid), 2);
    $r["payment_status"] = compute_payment_status(
      $totalAmount,
      $amountPaid,
      $pendingPaymentCount,
      $rejectedPaymentCount,
      $r["stored_payment_status"] ?? "unpaid"
    );
    $r["stored_amount_paid"] = $storedAmountPaid;
    $r["paid_from_payments"] = $paidFromPayments;
    $r["pending_payment_count"] = $pendingPaymentCount;
    $r["rejected_payment_count"] = $rejectedPaymentCount;
    $r["cancel_requested"] = (int)($r["cancel_requested"] ?? 0);
    $r["cancel_reason"] = $r["cancel_reason"] ?? "";
    $r["cancel_requested_at"] = $r["cancel_requested_at"] ?? null;

    unset($r["stored_payment_status"]);

    $bookings[] = $r;
  }

  $stmt->close();

  return $bookings;
}

function load_public_workshops(mysqli $conn): array {
  $items = [];

  $stmt = $conn->prepare("
    SELECT
      w.id,
      w.title,
      w.workshop_date,
      w.start_time,
      w.end_time,
      w.location,
      w.standard_price,
      w.premium_price,
      w.max_slots,
      w.is_active,
      w.created_at,
      COUNT(r.id) AS registration_count,
      COALESCE(SUM(CASE WHEN r.payment_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_registration_count,
      COALESCE(SUM(CASE WHEN r.payment_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_payment_count,
      COALESCE(SUM(CASE WHEN r.payment_status = 'unpaid' THEN 1 ELSE 0 END), 0) AS unpaid_registration_count,
      COALESCE(SUM(CASE WHEN r.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_registration_count,
      COALESCE(SUM(COALESCE(r.total_amount, 0)), 0) AS total_amount
    FROM workshops_public w
    LEFT JOIN workshop_registrations r
      ON r.workshop_id = w.id
    GROUP BY
      w.id,
      w.title,
      w.workshop_date,
      w.start_time,
      w.end_time,
      w.location,
      w.standard_price,
      w.premium_price,
      w.max_slots,
      w.is_active,
      w.created_at
    ORDER BY
      w.workshop_date DESC,
      w.start_time ASC,
      w.id DESC
    LIMIT 300
  ");

  if (!$stmt) {
    return [];
  }

  $stmt->execute();
  $result = $stmt->get_result();

  while ($r = $result->fetch_assoc()) {
    $registrationCount = (int)($r["registration_count"] ?? 0);
    $pendingPaymentCount = (int)($r["pending_payment_count"] ?? 0);
    $paidRegistrationCount = (int)($r["paid_registration_count"] ?? 0);
    $unpaidRegistrationCount = (int)($r["unpaid_registration_count"] ?? 0);
    $cancelledRegistrationCount = (int)($r["cancelled_registration_count"] ?? 0);

    $computedPaymentStatus = "unpaid";

    if ($registrationCount > 0 && $paidRegistrationCount >= $registrationCount) {
      $computedPaymentStatus = "paid";
    } elseif ($paidRegistrationCount > 0) {
      $computedPaymentStatus = "partial";
    } elseif ($pendingPaymentCount > 0) {
      $computedPaymentStatus = "pending";
    } elseif ($cancelledRegistrationCount > 0 && $registrationCount === $cancelledRegistrationCount) {
      $computedPaymentStatus = "cancelled";
    } elseif ($unpaidRegistrationCount > 0) {
      $computedPaymentStatus = "unpaid";
    }

    $status = ((int)($r["is_active"] ?? 0) === 1) ? "active" : "hidden";

    $items[] = [
      "record_kind" => "public_workshop",
      "id" => (int)($r["id"] ?? 0),
      "user_id" => null,
      "booking_date" => $r["workshop_date"],
      "start_time" => $r["start_time"],
      "end_time" => $r["end_time"],
      "booking_type" => "public_workshop",
      "calendar_type" => "public_workshop",
      "status" => $status,
      "payment_status" => $computedPaymentStatus,
      "title" => $r["title"],
      "location" => $r["location"],
      "user_name" => "Public Workshop",
      "user_email" => "",
      "total_amount" => round((float)($r["total_amount"] ?? 0), 2),
      "amount_paid" => 0,
      "balance" => 0,
      "standard_price" => round((float)($r["standard_price"] ?? 0), 2),
      "premium_price" => round((float)($r["premium_price"] ?? 0), 2),
      "registration_count" => $registrationCount,
      "paid_registration_count" => $paidRegistrationCount,
      "pending_payment_count" => $pendingPaymentCount,
      "unpaid_registration_count" => $unpaidRegistrationCount,
      "cancel_requested" => 0,
      "cancel_reason" => "",
      "cancel_requested_at" => null,
      "notes_decoded" => [],
      "form_snapshot_decoded" => [],
      "dynamic_answers" => [],
      "selected_items" => [],
      "created_at" => $r["created_at"] ?? null,
      "updated_at" => null
    ];
  }

  $stmt->close();

  return $items;
}

$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
  try {
    $blockedDates = load_blocked_dates($conn);
    $bookings = load_bookings($conn);
    $publicWorkshops = load_public_workshops($conn);

    $calendarItems = array_merge($bookings, $publicWorkshops);

    usort($calendarItems, function ($a, $b) {
      $dateA = ($a["booking_date"] ?? "") . " " . ($a["start_time"] ?? "") . " " . ($a["record_kind"] ?? "");
      $dateB = ($b["booking_date"] ?? "") . " " . ($b["start_time"] ?? "") . " " . ($b["record_kind"] ?? "");
      return strcmp($dateB, $dateA);
    });

    json_response([
      "success" => true,
      "csrf" => $csrf,
      "blockedDates" => $blockedDates,
      "bookings" => $bookings,
      "publicWorkshops" => $publicWorkshops,
      "calendarItems" => $calendarItems
    ]);
  } catch (Exception $e) {
    error_log("admin-calendar GET error: " . $e->getMessage());

    json_response([
      "success" => false,
      "error" => $e->getMessage(),
      "csrf" => $csrf,
      "blockedDates" => [],
      "bookings" => [],
      "publicWorkshops" => [],
      "calendarItems" => []
    ], 500);
  }
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
  $block_date = clean_date($data["block_date"] ?? "");
  $reason = trim((string)($data["reason"] ?? ""));
  $force = !empty($data["force"]);
  $block_mode = strtolower(trim((string)($data["block_mode"] ?? "full_day")));

  if ($block_date === "") {
    json_response(["success" => false, "error" => "Invalid date format."], 400);
  }

  if ($block_mode !== "full_day") {
    json_response([
      "success" => false,
      "error" => "Partial time blocking is planned, but the current blocked_dates table supports full-day blocking only."
    ], 400);
  }

  if (mb_strlen($reason) > 255) {
    json_response(["success" => false, "error" => "Reason must be 255 characters or less."], 400);
  }

  $activeBookingCount = get_active_booking_count_for_date($conn, $block_date);
  $publicWorkshopCount = get_active_public_workshop_count_for_date($conn, $block_date);
  $affectedTotal = $activeBookingCount + $publicWorkshopCount;

  if ($affectedTotal > 0 && !$force) {
    json_response([
      "success" => false,
      "requires_confirmation" => true,
      "active_booking_count" => $activeBookingCount,
      "public_workshop_count" => $publicWorkshopCount,
      "affected_total" => $affectedTotal,
      "message" => "This date already has {$affectedTotal} active schedule record(s). Are you sure you want to block it?"
    ], 409);
  }

  $stmt = $conn->prepare("
    INSERT INTO blocked_dates (block_date, reason)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE reason = VALUES(reason)
  ");

  if (!$stmt) {
    json_response(["success" => false, "error" => "Failed to prepare blocked date: " . $conn->error], 500);
  }

  $stmt->bind_param("ss", $block_date, $reason);

  if ($stmt->execute()) {
    $stmt->close();

    json_response([
      "success" => true,
      "message" => $affectedTotal > 0
        ? "Blocked date saved. Existing active schedules were kept."
        : "Blocked date saved.",
      "active_booking_count" => $activeBookingCount,
      "public_workshop_count" => $publicWorkshopCount
    ]);
  }

  $error = $stmt->error;
  $stmt->close();

  json_response(["success" => false, "error" => "Failed to save blocked date: " . $error], 500);
}

if ($action === "delete_block") {
  $block_date = clean_date($data["block_date"] ?? "");

  if ($block_date === "") {
    json_response(["success" => false, "error" => "Invalid date format."], 400);
  }

  $stmt = $conn->prepare("DELETE FROM blocked_dates WHERE block_date = ?");

  if (!$stmt) {
    json_response(["success" => false, "error" => "Failed to prepare delete request: " . $conn->error], 500);
  }

  $stmt->bind_param("s", $block_date);

  if ($stmt->execute()) {
    $stmt->close();

    json_response(["success" => true, "message" => "Blocked date removed."]);
  }

  $error = $stmt->error;
  $stmt->close();

  json_response(["success" => false, "error" => "Failed to remove blocked date: " . $error], 500);
}

json_response(["success" => false, "error" => "Unknown action."], 400);

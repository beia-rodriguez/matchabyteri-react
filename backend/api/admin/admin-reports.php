<?php

require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set("Asia/Manila");

function safe_json($s) {
  if (!is_string($s) || trim($s) === "") return [];

  $d = json_decode($s, true);

  return is_array($d) ? $d : [];
}

function json_response($data) {
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit();
}

$from = trim($_GET["from"] ?? "");
$to = trim($_GET["to"] ?? "");

$hasFrom = (bool) preg_match("/^\d{4}-\d{2}-\d{2}$/", $from);
$hasTo = (bool) preg_match("/^\d{4}-\d{2}-\d{2}$/", $to);

if (!$hasFrom) $from = "";
if (!$hasTo) $to = "";

function add_date_filter($baseWhere, $from, $to, $dateColumn) {
  if ($from === "" && $to === "") {
    return $baseWhere;
  }

  if ($from !== "" && $to === "") {
    return $baseWhere . " AND {$dateColumn} >= ?";
  }

  if ($from === "" && $to !== "") {
    return $baseWhere . " AND {$dateColumn} <= ?";
  }

  return $baseWhere . " AND {$dateColumn} BETWEEN ? AND ?";
}

function bind_date_params($stmt, $from, $to) {
  if ($from !== "" && $to !== "") {
    $stmt->bind_param("ss", $from, $to);
  } elseif ($from !== "") {
    $stmt->bind_param("s", $from);
  } elseif ($to !== "") {
    $stmt->bind_param("s", $to);
  }
}

function compute_payment_status($totalAmount, $amountPaid, $pendingPaymentCount, $storedPaymentStatus) {
  $totalAmount = (float) $totalAmount;
  $amountPaid = (float) $amountPaid;
  $pendingPaymentCount = (int) $pendingPaymentCount;
  $storedPaymentStatus = strtolower((string) $storedPaymentStatus);

  if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
    return "paid";
  }

  if ($amountPaid > 0) {
    return "partial";
  }

  if ($pendingPaymentCount > 0) {
    return "pending";
  }

  if (in_array($storedPaymentStatus, ["unpaid", "pending", "partial", "paid", "rejected"], true)) {
    return $storedPaymentStatus;
  }

  return "unpaid";
}

/* ----------------------------
   1) PUBLIC WORKSHOPS
---------------------------- */

$publicWorkshopRows = [];

$wherePublic = add_date_filter(
  "WHERE 1=1",
  $from,
  $to,
  "wp.workshop_date"
);

$sql = "
  SELECT
    wr.id AS reg_id,
    CONCAT('public-', wr.id) AS report_key,
    wr.user_id,
    wr.workshop_id,
    wr.package,
    wr.full_name,
    wr.email,
    wr.phone_number,
    wr.created_at AS registered_at,
    wr.status,
    wr.payment_status,
    wr.total_amount,

    wp.title,
    wp.location,
    wp.workshop_date,
    wp.start_time,
    wp.end_time,
    wp.standard_price,
    wp.premium_price,

    COALESCE(pay.paid_amount, 0) AS paid_amount,
    COALESCE(pay.pending_payment_count, 0) AS pending_payment_count,
    COALESCE(pay.rejected_payment_count, 0) AS rejected_payment_count,
    COALESCE(pay.paid_reference_no, '') AS paid_reference_no

  FROM workshop_registrations wr

  INNER JOIN workshops_public wp
    ON wr.workshop_id = wp.id

  LEFT JOIN (
    SELECT
      registration_id,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_payment_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_payment_count,
      MAX(CASE WHEN status = 'paid' THEN reference_no ELSE NULL END) AS paid_reference_no
    FROM payments
    WHERE registration_id IS NOT NULL
    GROUP BY registration_id
  ) pay
    ON pay.registration_id = wr.id

  {$wherePublic}

  ORDER BY wp.workshop_date DESC, wr.created_at DESC
  LIMIT 300
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
  json_response([
    "success" => false,
    "error" => "Failed to prepare public workshop report."
  ]);
}

bind_date_params($stmt, $from, $to);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $totalAmount = (float) ($r["total_amount"] ?? 0);
  $paidAmount = (float) ($r["paid_amount"] ?? 0);
  $pendingPaymentCount = (int) ($r["pending_payment_count"] ?? 0);
  $storedPaymentStatus = strtolower((string) ($r["payment_status"] ?? "unpaid"));

  if ($paidAmount >= $totalAmount && $totalAmount > 0) {
    $computedPaymentStatus = "paid";
  } elseif ($paidAmount > 0) {
    $computedPaymentStatus = "partial";
  } elseif ($pendingPaymentCount > 0) {
    $computedPaymentStatus = "pending";
  } else {
    $computedPaymentStatus = $storedPaymentStatus ?: "unpaid";
  }

  $r["total_amount"] = $totalAmount;
  $r["paid_amount"] = $paidAmount;
  $r["computed_payment_status"] = $computedPaymentStatus;

  $publicWorkshopRows[] = $r;
}

$stmt->close();

/* ----------------------------
   Shared paid-payment join
---------------------------- */

$paymentJoinSql = "
  LEFT JOIN (
    SELECT
      booking_id,
      SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS paid_amount,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_payment_count,
      SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_payment_count,
      MAX(CASE WHEN status = 'paid' THEN reference_no ELSE NULL END) AS paid_reference_no
    FROM payments
    WHERE booking_id IS NOT NULL
    GROUP BY booking_id
  ) pay
    ON pay.booking_id = b.id
";

/* ----------------------------
   2) PRIVATE WORKSHOPS
---------------------------- */

$privateWorkshopRows = [];

$whereWorkshop = add_date_filter(
  "WHERE LOWER(b.booking_type) IN ('private_workshop', 'workshop')",
  $from,
  $to,
  "b.booking_date"
);

$sql = "
  SELECT
    b.id,
    CONCAT('private-workshop-', b.id) AS report_key,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.booking_type,
    b.status,
    b.payment_status,
    b.total_amount,
    b.amount_paid,
    b.notes,
    b.form_snapshot,

    u.name AS user_name,
    u.email AS user_email,

    COALESCE(pay.paid_amount, 0) AS paid_amount,
    COALESCE(pay.pending_payment_count, 0) AS pending_payment_count,
    COALESCE(pay.rejected_payment_count, 0) AS rejected_payment_count,
    COALESCE(pay.paid_reference_no, '') AS paid_reference_no

  FROM bookings b

  LEFT JOIN users u
    ON b.user_id = u.id

  {$paymentJoinSql}

  {$whereWorkshop}

  ORDER BY b.booking_date DESC, b.start_time DESC
  LIMIT 300
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
  json_response([
    "success" => false,
    "error" => "Failed to prepare private workshop report."
  ]);
}

bind_date_params($stmt, $from, $to);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $notes = safe_json($r["notes"] ?? "");
  $snapshot = safe_json($r["form_snapshot"] ?? "");

  $totalAmount = (float) ($r["total_amount"] ?? 0);
  $storedAmountPaid = (float) ($r["amount_paid"] ?? 0);
  $paidAmount = max($storedAmountPaid, (float) ($r["paid_amount"] ?? 0));
  $pendingPaymentCount = (int) ($r["pending_payment_count"] ?? 0);
  $storedPaymentStatus = strtolower((string) ($r["payment_status"] ?? "unpaid"));

  $r["notes_decoded"] = $notes;
  $r["form_snapshot_decoded"] = $snapshot;
  $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
  $r["selected_items"] = $notes["selected_items"] ?? [];

  $r["total_amount"] = $totalAmount;
  $r["paid_amount"] = $paidAmount;
  $r["computed_payment_status"] = compute_payment_status(
    $totalAmount,
    $paidAmount,
    $pendingPaymentCount,
    $storedPaymentStatus
  );

  $privateWorkshopRows[] = $r;
}

$stmt->close();

/* ----------------------------
   3) PRIVATE EVENTS
---------------------------- */

$privateEventRows = [];

$whereEvent = add_date_filter(
  "WHERE LOWER(b.booking_type) IN ('event_booking', 'event')",
  $from,
  $to,
  "b.booking_date"
);

$sql = "
  SELECT
    b.id,
    CONCAT('private-event-', b.id) AS report_key,
    b.booking_date,
    b.start_time,
    b.end_time,
    b.booking_type,
    b.status,
    b.payment_status,
    b.total_amount,
    b.amount_paid,
    b.notes,
    b.form_snapshot,

    u.name AS user_name,
    u.email AS user_email,

    COALESCE(pay.paid_amount, 0) AS paid_amount,
    COALESCE(pay.pending_payment_count, 0) AS pending_payment_count,
    COALESCE(pay.rejected_payment_count, 0) AS rejected_payment_count,
    COALESCE(pay.paid_reference_no, '') AS paid_reference_no

  FROM bookings b

  LEFT JOIN users u
    ON b.user_id = u.id

  {$paymentJoinSql}

  {$whereEvent}

  ORDER BY b.booking_date DESC, b.start_time DESC
  LIMIT 300
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
  json_response([
    "success" => false,
    "error" => "Failed to prepare private event report."
  ]);
}

bind_date_params($stmt, $from, $to);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $notes = safe_json($r["notes"] ?? "");
  $snapshot = safe_json($r["form_snapshot"] ?? "");

  $totalAmount = (float) ($r["total_amount"] ?? 0);
  $storedAmountPaid = (float) ($r["amount_paid"] ?? 0);
  $paidAmount = max($storedAmountPaid, (float) ($r["paid_amount"] ?? 0));
  $pendingPaymentCount = (int) ($r["pending_payment_count"] ?? 0);
  $storedPaymentStatus = strtolower((string) ($r["payment_status"] ?? "unpaid"));

  $r["notes_decoded"] = $notes;
  $r["form_snapshot_decoded"] = $snapshot;
  $r["dynamic_answers"] = $notes["dynamic_answers"] ?? [];
  $r["selected_items"] = $notes["selected_items"] ?? [];

  $r["total_amount"] = $totalAmount;
  $r["paid_amount"] = $paidAmount;
  $r["computed_payment_status"] = compute_payment_status(
    $totalAmount,
    $paidAmount,
    $pendingPaymentCount,
    $storedPaymentStatus
  );

  $privateEventRows[] = $r;
}

$stmt->close();

json_response([
  "success" => true,
  "from" => $from,
  "to" => $to,
  "publicWorkshopRows" => $publicWorkshopRows,
  "privateWorkshopRows" => $privateWorkshopRows,
  "privateEventRows" => $privateEventRows
]);
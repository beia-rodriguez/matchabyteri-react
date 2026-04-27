<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=UTF-8");

function safe_json($s){
  if (!is_string($s) || trim($s) === "") return [];
  $d = json_decode($s, true);
  return is_array($d) ? $d : [];
}

// ---- Date filters (optional) ----
$from = trim($_GET["from"] ?? "");
$to   = trim($_GET["to"] ?? "");

$hasFrom = (bool)preg_match("/^\d{4}-\d{2}-\d{2}$/", $from);
$hasTo   = (bool)preg_match("/^\d{4}-\d{2}-\d{2}$/", $to);

if (!$hasFrom) $from = "";
if (!$hasTo) $to = "";

// ----------------------------
// 1) PUBLIC WORKSHOPS
// ----------------------------
$publicWorkshopRows = [];

if ($from === "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      wr.id AS reg_id,
      wr.user_id,
      wr.workshop_id,
      wr.package,
      wr.full_name,
      wr.email,
      wr.phone_number,
      wr.created_at AS registered_at,

      wp.title,
      wp.location,
      wp.workshop_date,
      wp.start_time,
      wp.end_time,
      wp.standard_price,
      wp.premium_price

    FROM workshop_registrations wr
    INNER JOIN workshops_public wp ON wr.workshop_id = wp.id
    ORDER BY wp.workshop_date DESC, wr.created_at DESC
    LIMIT 120
  ");
} elseif ($from !== "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      wr.id AS reg_id,
      wr.user_id,
      wr.workshop_id,
      wr.package,
      wr.full_name,
      wr.email,
      wr.phone_number,
      wr.created_at AS registered_at,

      wp.title,
      wp.location,
      wp.workshop_date,
      wp.start_time,
      wp.end_time,
      wp.standard_price,
      wp.premium_price

    FROM workshop_registrations wr
    INNER JOIN workshops_public wp ON wr.workshop_id = wp.id
    WHERE wp.workshop_date >= ?
    ORDER BY wp.workshop_date DESC, wr.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $from);
} elseif ($from === "" && $to !== "") {
  $stmt = $conn->prepare("
    SELECT
      wr.id AS reg_id,
      wr.user_id,
      wr.workshop_id,
      wr.package,
      wr.full_name,
      wr.email,
      wr.phone_number,
      wr.created_at AS registered_at,

      wp.title,
      wp.location,
      wp.workshop_date,
      wp.start_time,
      wp.end_time,
      wp.standard_price,
      wp.premium_price

    FROM workshop_registrations wr
    INNER JOIN workshops_public wp ON wr.workshop_id = wp.id
    WHERE wp.workshop_date <= ?
    ORDER BY wp.workshop_date DESC, wr.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $to);
} else {
  $stmt = $conn->prepare("
    SELECT
      wr.id AS reg_id,
      wr.user_id,
      wr.workshop_id,
      wr.package,
      wr.full_name,
      wr.email,
      wr.phone_number,
      wr.created_at AS registered_at,

      wp.title,
      wp.location,
      wp.workshop_date,
      wp.start_time,
      wp.end_time,
      wp.standard_price,
      wp.premium_price

    FROM workshop_registrations wr
    INNER JOIN workshops_public wp ON wr.workshop_id = wp.id
    WHERE wp.workshop_date BETWEEN ? AND ?
    ORDER BY wp.workshop_date DESC, wr.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("ss", $from, $to);
}

$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) $publicWorkshopRows[] = $r;
$stmt->close();


// ----------------------------
// Helper subquery for PAID payments per booking_id
// ----------------------------
$paidJoinSql = "
  LEFT JOIN (
    SELECT
      booking_id,
      SUM(amount) AS paid_amount,
      MAX(reference_no) AS paid_reference_no
    FROM payments
    WHERE status = 'paid'
    GROUP BY booking_id
  ) pay ON pay.booking_id = b.id
";

// ----------------------------
// 2) PRIVATE WORKSHOPS
// ----------------------------
$privateWorkshopRows = [];

if ($from === "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'workshop'
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
} elseif ($from !== "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'workshop'
      AND b.booking_date >= ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $from);
} elseif ($from === "" && $to !== "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'workshop'
      AND b.booking_date <= ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $to);
} else {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'workshop'
      AND b.booking_date BETWEEN ? AND ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("ss", $from, $to);
}

$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $r["notes_decoded"] = safe_json($r["notes"] ?? "");
  $privateWorkshopRows[] = $r;
}
$stmt->close();


// ----------------------------
// 3) PRIVATE EVENTS
// ----------------------------
$privateEventRows = [];

if ($from === "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(pay.paid_reference_no, '') AS paid_reference_no
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'event'
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
} elseif ($from !== "" && $to === "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(pay.paid_reference_no, '') AS paid_reference_no
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'event'
      AND b.booking_date >= ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $from);
} elseif ($from === "" && $to !== "") {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(pay.paid_reference_no, '') AS paid_reference_no
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'event'
      AND b.booking_date <= ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $to);
} else {
  $stmt = $conn->prepare("
    SELECT
      b.id, b.booking_date, b.start_time, b.end_time, b.status, b.notes,
      u.name AS user_name, u.email AS user_email,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(pay.paid_reference_no, '') AS paid_reference_no
    FROM bookings b
    LEFT JOIN users u ON b.user_id = u.id
    $paidJoinSql
    WHERE b.booking_type = 'event'
      AND b.booking_date BETWEEN ? AND ?
    ORDER BY b.booking_date DESC
    LIMIT 120
  ");
  $stmt->bind_param("ss", $from, $to);
}

$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $r["notes_decoded"] = safe_json($r["notes"] ?? "");
  $privateEventRows[] = $r;
}
$stmt->close();

echo json_encode([
  "success" => true,
  "from" => $from,
  "to" => $to,
  "publicWorkshopRows" => $publicWorkshopRows,
  "privateWorkshopRows" => $privateWorkshopRows,
  "privateEventRows" => $privateEventRows
], JSON_UNESCAPED_UNICODE);
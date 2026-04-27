<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=UTF-8");

// last 12 months chart data
$MAX_MONTHS = 12;

// Build last 12 month keys
$months = [];
$countsWorkshop = [];
$countsEvent = [];
$revenue = [];

for ($i = $MAX_MONTHS - 1; $i >= 0; $i--) {
  $key = date("Y-m", strtotime("-{$i} months"));
  $months[$key] = $key;
  $countsWorkshop[$key] = 0;
  $countsEvent[$key] = 0;
  $revenue[$key] = 0;
}

/**
 * Totals (counts ALL bookings)
 */
$totalWorkshop = 0;
$totalEvent = 0;

$stmt = $conn->prepare("
  SELECT
    SUM(CASE WHEN LOWER(booking_type) = 'workshop' THEN 1 ELSE 0 END) AS total_workshop,
    SUM(CASE WHEN LOWER(booking_type) = 'event' THEN 1 ELSE 0 END) AS total_event
  FROM bookings
");
$stmt->execute();
$tot = $stmt->get_result()->fetch_assoc();
$stmt->close();

$totalWorkshop = (int)($tot["total_workshop"] ?? 0);
$totalEvent = (int)($tot["total_event"] ?? 0);

/**
 * Monthly booking counts (Approved/Complete only)
 */
$stmt = $conn->prepare("
  SELECT
    DATE_FORMAT(booking_date, '%Y-%m') AS ym,
    SUM(CASE WHEN LOWER(booking_type)='workshop' THEN 1 ELSE 0 END) AS workshop_count,
    SUM(CASE WHEN LOWER(booking_type)='event' THEN 1 ELSE 0 END) AS event_count
  FROM bookings
  WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    AND LOWER(status) IN ('approved','complete')
  GROUP BY ym
  ORDER BY ym ASC
");
$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $ym = $r["ym"] ?? "";
  if (isset($months[$ym])) {
    $countsWorkshop[$ym] = (int)($r["workshop_count"] ?? 0);
    $countsEvent[$ym] = (int)($r["event_count"] ?? 0);
  }
}
$stmt->close();

/**
 * Revenue from payments table
 * - Total Revenue card: all-time SUM(amount) where status='paid'
 * - Monthly Revenue chart: last 12 months by payments.created_at
 */
$totalRevenue = 0.0;

// All-time paid revenue
$stmt = $conn->prepare("
  SELECT COALESCE(SUM(amount), 0) AS total_paid
  FROM payments
  WHERE status = 'paid'
");
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();
$totalRevenue = (float)($row["total_paid"] ?? 0);

// Monthly paid revenue (last 12 months)
$stmt = $conn->prepare("
  SELECT
    DATE_FORMAT(created_at, '%Y-%m') AS ym,
    COALESCE(SUM(amount), 0) AS rev
  FROM payments
  WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
    AND status = 'paid'
  GROUP BY ym
  ORDER BY ym ASC
");
$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $ym = $r["ym"] ?? "";
  if (isset($months[$ym])) {
    $revenue[$ym] = (float)($r["rev"] ?? 0);
  }
}
$stmt->close();

echo json_encode([
  "success" => true,
  "labels" => array_values($months),
  "workshopCounts" => array_values($countsWorkshop),
  "eventCounts" => array_values($countsEvent),
  "revenue" => array_values($revenue),
  "totalWorkshop" => $totalWorkshop,
  "totalEvent" => $totalEvent,
  "totalRevenue" => $totalRevenue
], JSON_UNESCAPED_UNICODE);
<?php
/**
 * admin-dashboard.php
 *
 * Fixes over previous version:
 *  - totalWorkshop / totalEvent now count ONLY approved + complete bookings
 *    (cancelled/rejected were inflating the numbers before)
 *  - Added pendingBookings count for the new urgent card
 *  - Added paidBookings count so the front end can compute
 *    "avg revenue per paid booking" with the correct denominator
 *  - Monthly booking chart already filtered to approved/complete — no change needed there
 *  - Labels stay as raw "Y-m" strings; the React component formats them to "Jan 2025"
 */

require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=UTF-8");

$MAX_MONTHS = 12;

// ── Build last-12-months skeleton ─────────────────────────────────────────────
$months         = [];
$countsWorkshop = [];
$countsEvent    = [];
$revenue        = [];

for ($i = $MAX_MONTHS - 1; $i >= 0; $i--) {
    $key                  = date("Y-m", strtotime("-{$i} months"));
    $months[$key]         = $key;
    $countsWorkshop[$key] = 0;
    $countsEvent[$key]    = 0;
    $revenue[$key]        = 0;
}

// ── Total meaningful bookings (approved + complete only) ──────────────────────
//    Previously counted ALL statuses — cancelled/rejected inflated the numbers.
$totalWorkshop  = 0;
$totalEvent     = 0;
$pendingBookings = 0;

$stmt = $conn->prepare("
    SELECT
        SUM(CASE WHEN LOWER(booking_type) = 'workshop'
                  AND LOWER(status) IN ('approved','complete') THEN 1 ELSE 0 END) AS total_workshop,
        SUM(CASE WHEN LOWER(booking_type) = 'event'
                  AND LOWER(status) IN ('approved','complete') THEN 1 ELSE 0 END) AS total_event,
        SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_count
    FROM bookings
");
$stmt->execute();
$tot = $stmt->get_result()->fetch_assoc();
$stmt->close();

$totalWorkshop   = (int)($tot["total_workshop"]  ?? 0);
$totalEvent      = (int)($tot["total_event"]     ?? 0);
$pendingBookings = (int)($tot["pending_count"]   ?? 0);

// ── Paid bookings count (for avg revenue per paid booking) ────────────────────
//    Using payment_status = 'paid' on the bookings table.
$paidBookings = 0;

$stmt = $conn->prepare("
    SELECT COUNT(*) AS cnt
    FROM bookings
    WHERE LOWER(payment_status) = 'paid'
");
$stmt->execute();
$paidBookings = (int)($stmt->get_result()->fetch_assoc()["cnt"] ?? 0);
$stmt->close();

// ── Monthly booking counts (approved + complete) ──────────────────────────────
$stmt = $conn->prepare("
    SELECT
        DATE_FORMAT(booking_date, '%Y-%m') AS ym,
        SUM(CASE WHEN LOWER(booking_type) = 'workshop' THEN 1 ELSE 0 END) AS workshop_count,
        SUM(CASE WHEN LOWER(booking_type) = 'event'    THEN 1 ELSE 0 END) AS event_count
    FROM bookings
    WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
      AND LOWER(status) IN ('approved', 'complete')
    GROUP BY ym
    ORDER BY ym ASC
");
$stmt->bind_param("i", $MAX_MONTHS);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ym = $r["ym"] ?? "";
    if (isset($months[$ym])) {
        $countsWorkshop[$ym] = (int)($r["workshop_count"] ?? 0);
        $countsEvent[$ym]    = (int)($r["event_count"]    ?? 0);
    }
}
$stmt->close();

// ── All-time revenue from payments (status = 'paid') ─────────────────────────
$totalRevenue = 0.0;

$stmt = $conn->prepare("
    SELECT COALESCE(SUM(amount), 0) AS total_paid
    FROM payments
    WHERE status = 'paid'
");
$stmt->execute();
$totalRevenue = (float)($stmt->get_result()->fetch_assoc()["total_paid"] ?? 0);
$stmt->close();

// ── Monthly revenue (last N months, payments.created_at) ─────────────────────
$stmt = $conn->prepare("
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS ym,
        COALESCE(SUM(amount), 0)         AS rev
    FROM payments
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      AND status = 'paid'
    GROUP BY ym
    ORDER BY ym ASC
");
$stmt->bind_param("i", $MAX_MONTHS);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ym = $r["ym"] ?? "";
    if (isset($months[$ym])) {
        $revenue[$ym] = (float)($r["rev"] ?? 0);
    }
}
$stmt->close();

// ── Response ──────────────────────────────────────────────────────────────────
echo json_encode([
    "success"         => true,
    "totalWorkshop"   => $totalWorkshop,
    "totalEvent"      => $totalEvent,
    "pendingBookings" => $pendingBookings,
    "paidBookings"    => $paidBookings,
    "totalRevenue"    => $totalRevenue,
    "labels"          => array_values($months),          // raw "Y-m"; frontend formats
    "workshopCounts"  => array_values($countsWorkshop),
    "eventCounts"     => array_values($countsEvent),
    "revenue"         => array_values($revenue),
], JSON_UNESCAPED_UNICODE);
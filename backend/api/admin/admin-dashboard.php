<?php
/**
 * admin-dashboard.php
 *
 * Updated for new booking system:
 * - event_booking instead of old event
 * - private_workshop instead of old workshop
 * - keeps old event/workshop fallback for old records
 * - supports completed and old complete status
 * - adds richer chart data:
 *   booking trends, pending trends, revenue trends, payment count trends,
 *   booking status distribution, payment status distribution
 */

require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=UTF-8");

date_default_timezone_set("Asia/Manila");

$MAX_MONTHS = 12;

function json_response($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit();
}

function is_active_booking_status($status) {
    $status = strtolower((string) $status);
    return in_array($status, ["approved", "completed", "complete"], true);
}

function normalize_booking_type($type) {
    $type = strtolower(trim((string) $type));

    if ($type === "event") return "event_booking";
    if ($type === "workshop") return "private_workshop";

    return $type;
}

function normalize_status_label($status) {
    $status = strtolower(trim((string) $status));

    if ($status === "complete") return "completed";
    if ($status === "") return "unknown";

    return $status;
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

// ── Build last-12-months skeleton ─────────────────────────────────────────────

$months = [];
$privateWorkshopCounts = [];
$eventCounts = [];
$publicRegistrationCounts = [];
$pendingCounts = [];
$revenue = [];
$paymentCounts = [];

for ($i = $MAX_MONTHS - 1; $i >= 0; $i--) {
    $key = date("Y-m", strtotime("-{$i} months"));

    $months[$key] = $key;
    $privateWorkshopCounts[$key] = 0;
    $eventCounts[$key] = 0;
    $publicRegistrationCounts[$key] = 0;
    $pendingCounts[$key] = 0;
    $revenue[$key] = 0.0;
    $paymentCounts[$key] = 0;
}

// ── Main counters ────────────────────────────────────────────────────────────

$totalPrivateWorkshops = 0;
$totalEvents = 0;
$totalPublicRegistrations = 0;
$pendingBookings = 0;
$pendingPaymentBookings = 0;
$cancellationRequests = 0;

$stmt = $conn->prepare("
    SELECT
        SUM(
            CASE
                WHEN LOWER(booking_type) IN ('private_workshop', 'workshop')
                 AND LOWER(status) IN ('approved', 'completed', 'complete')
                THEN 1 ELSE 0
            END
        ) AS total_private_workshops,

        SUM(
            CASE
                WHEN LOWER(booking_type) IN ('event_booking', 'event')
                 AND LOWER(status) IN ('approved', 'completed', 'complete')
                THEN 1 ELSE 0
            END
        ) AS total_events,

        SUM(
            CASE
                WHEN LOWER(status) = 'pending'
                THEN 1 ELSE 0
            END
        ) AS pending_count,

        SUM(
            CASE
                WHEN LOWER(status) = 'pending_payment'
                THEN 1 ELSE 0
            END
        ) AS pending_payment_count,

        SUM(
            CASE
                WHEN cancel_requested = 1
                 AND LOWER(status) IN ('pending_payment', 'pending', 'approved')
                THEN 1 ELSE 0
            END
        ) AS cancellation_requests
    FROM bookings
");

if (!$stmt) {
    json_response([
        "success" => false,
        "error" => "Failed to load booking counters."
    ]);
}

$stmt->execute();
$tot = $stmt->get_result()->fetch_assoc();
$stmt->close();

$totalPrivateWorkshops = (int)($tot["total_private_workshops"] ?? 0);
$totalEvents = (int)($tot["total_events"] ?? 0);
$pendingBookings = (int)($tot["pending_count"] ?? 0);
$pendingPaymentBookings = (int)($tot["pending_payment_count"] ?? 0);
$cancellationRequests = (int)($tot["cancellation_requests"] ?? 0);

// ── Public workshop registration counter ─────────────────────────────────────

$publicStmt = $conn->prepare("
    SELECT COUNT(*) AS cnt
    FROM workshop_registrations
    WHERE LOWER(status) IN ('approved', 'pending')
");

if ($publicStmt) {
    $publicStmt->execute();
    $totalPublicRegistrations = (int)($publicStmt->get_result()->fetch_assoc()["cnt"] ?? 0);
    $publicStmt->close();
}

// ── Paid target count for average revenue denominator ─────────────────────────
// Counts each paid booking/registration once, even if it has multiple payments.

$paidBookings = 0;

$stmt = $conn->prepare("
    SELECT COUNT(*) AS cnt
    FROM (
        SELECT CONCAT('booking-', booking_id) AS target_key
        FROM payments
        WHERE status = 'paid'
          AND booking_id IS NOT NULL
        GROUP BY booking_id

        UNION ALL

        SELECT CONCAT('registration-', registration_id) AS target_key
        FROM payments
        WHERE status = 'paid'
          AND registration_id IS NOT NULL
        GROUP BY registration_id
    ) paid_targets
");

if ($stmt) {
    $stmt->execute();
    $paidBookings = (int)($stmt->get_result()->fetch_assoc()["cnt"] ?? 0);
    $stmt->close();
}

// ── Monthly booking counts ───────────────────────────────────────────────────

$stmt = $conn->prepare("
    SELECT
        DATE_FORMAT(booking_date, '%Y-%m') AS ym,

        SUM(
            CASE
                WHEN LOWER(booking_type) IN ('private_workshop', 'workshop')
                 AND LOWER(status) IN ('approved', 'completed', 'complete')
                THEN 1 ELSE 0
            END
        ) AS private_workshop_count,

        SUM(
            CASE
                WHEN LOWER(booking_type) IN ('event_booking', 'event')
                 AND LOWER(status) IN ('approved', 'completed', 'complete')
                THEN 1 ELSE 0
            END
        ) AS event_count,

        SUM(
            CASE
                WHEN LOWER(status) IN ('pending_payment', 'pending')
                THEN 1 ELSE 0
            END
        ) AS pending_count

    FROM bookings
    WHERE booking_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
    GROUP BY ym
    ORDER BY ym ASC
");

if (!$stmt) {
    json_response([
        "success" => false,
        "error" => "Failed to load monthly booking chart."
    ]);
}

$stmt->bind_param("i", $MAX_MONTHS);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ym = $r["ym"] ?? "";

    if (isset($months[$ym])) {
        $privateWorkshopCounts[$ym] = (int)($r["private_workshop_count"] ?? 0);
        $eventCounts[$ym] = (int)($r["event_count"] ?? 0);
        $pendingCounts[$ym] = (int)($r["pending_count"] ?? 0);
    }
}

$stmt->close();

// ── Monthly public workshop registration counts ──────────────────────────────

$publicMonthlyStmt = $conn->prepare("
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS ym,
        COUNT(*) AS cnt
    FROM workshop_registrations
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
    GROUP BY ym
    ORDER BY ym ASC
");

if ($publicMonthlyStmt) {
    $publicMonthlyStmt->bind_param("i", $MAX_MONTHS);
    $publicMonthlyStmt->execute();
    $publicMonthlyResult = $publicMonthlyStmt->get_result();

    while ($r = $publicMonthlyResult->fetch_assoc()) {
        $ym = $r["ym"] ?? "";

        if (isset($months[$ym])) {
            $publicRegistrationCounts[$ym] = (int)($r["cnt"] ?? 0);
        }
    }

    $publicMonthlyStmt->close();
}

// ── Revenue totals ───────────────────────────────────────────────────────────

$totalRevenue = 0.0;

$stmt = $conn->prepare("
    SELECT COALESCE(SUM(amount), 0) AS total_paid
    FROM payments
    WHERE status = 'paid'
");

if (!$stmt) {
    json_response([
        "success" => false,
        "error" => "Failed to load total revenue."
    ]);
}

$stmt->execute();
$totalRevenue = (float)($stmt->get_result()->fetch_assoc()["total_paid"] ?? 0);
$stmt->close();

// ── Monthly revenue + payment count ──────────────────────────────────────────

$stmt = $conn->prepare("
    SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS ym,
        COALESCE(SUM(amount), 0) AS rev,
        COUNT(*) AS paid_payment_count
    FROM payments
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
      AND status = 'paid'
    GROUP BY ym
    ORDER BY ym ASC
");

if (!$stmt) {
    json_response([
        "success" => false,
        "error" => "Failed to load monthly revenue chart."
    ]);
}

$stmt->bind_param("i", $MAX_MONTHS);
$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ym = $r["ym"] ?? "";

    if (isset($months[$ym])) {
        $revenue[$ym] = (float)($r["rev"] ?? 0);
        $paymentCounts[$ym] = (int)($r["paid_payment_count"] ?? 0);
    }
}

$stmt->close();

// ── Booking status distribution ──────────────────────────────────────────────

$statusCounts = [
    "pending_payment" => 0,
    "pending" => 0,
    "approved" => 0,
    "completed" => 0,
    "cancelled" => 0,
    "rejected" => 0,
];

$stmt = $conn->prepare("
    SELECT LOWER(status) AS status_key, COUNT(*) AS cnt
    FROM bookings
    GROUP BY LOWER(status)
");

if ($stmt) {
    $stmt->execute();
    $res = $stmt->get_result();

    while ($r = $res->fetch_assoc()) {
        $statusKey = normalize_status_label($r["status_key"] ?? "");

        if (!isset($statusCounts[$statusKey])) {
            $statusCounts[$statusKey] = 0;
        }

        $statusCounts[$statusKey] += (int)($r["cnt"] ?? 0);
    }

    $stmt->close();
}

// ── Payment status distribution computed from payments + booking totals ──────

$paymentStatusCounts = [
    "unpaid" => 0,
    "pending" => 0,
    "partial" => 0,
    "paid" => 0,
    "rejected" => 0,
];

$stmt = $conn->prepare("
    SELECT
        b.id,
        b.total_amount,
        b.amount_paid AS stored_amount_paid,
        b.payment_status AS stored_payment_status,

        COALESCE(SUM(
            CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END
        ), 0) AS paid_from_payments,

        COALESCE(SUM(
            CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END
        ), 0) AS pending_payment_count,

        COALESCE(SUM(
            CASE WHEN p.status = 'rejected' THEN 1 ELSE 0 END
        ), 0) AS rejected_payment_count

    FROM bookings b
    LEFT JOIN payments p
      ON p.booking_id = b.id
    GROUP BY
        b.id,
        b.total_amount,
        b.amount_paid,
        b.payment_status
");

if ($stmt) {
    $stmt->execute();
    $res = $stmt->get_result();

    while ($r = $res->fetch_assoc()) {
        $totalAmount = (float)($r["total_amount"] ?? 0);
        $storedAmountPaid = (float)($r["stored_amount_paid"] ?? 0);
        $paidFromPayments = (float)($r["paid_from_payments"] ?? 0);
        $amountPaid = max($storedAmountPaid, $paidFromPayments);
        $pendingPaymentCount = (int)($r["pending_payment_count"] ?? 0);
        $rejectedPaymentCount = (int)($r["rejected_payment_count"] ?? 0);
        $storedPaymentStatus = strtolower((string)($r["stored_payment_status"] ?? "unpaid"));

        if ($pendingPaymentCount <= 0 && $amountPaid <= 0 && $rejectedPaymentCount > 0) {
            $computedStatus = "rejected";
        } else {
            $computedStatus = compute_payment_status(
                $totalAmount,
                $amountPaid,
                $pendingPaymentCount,
                $storedPaymentStatus
            );
        }

        if (!isset($paymentStatusCounts[$computedStatus])) {
            $paymentStatusCounts[$computedStatus] = 0;
        }

        $paymentStatusCounts[$computedStatus]++;
    }

    $stmt->close();
}

// ── Public workshop registration payment status distribution ─────────────────

$registrationPaymentStmt = $conn->prepare("
    SELECT LOWER(payment_status) AS payment_status, COUNT(*) AS cnt
    FROM workshop_registrations
    GROUP BY LOWER(payment_status)
");

if ($registrationPaymentStmt) {
    $registrationPaymentStmt->execute();
    $registrationPaymentResult = $registrationPaymentStmt->get_result();

    while ($r = $registrationPaymentResult->fetch_assoc()) {
        $statusKey = strtolower((string)($r["payment_status"] ?? "unpaid"));

        if (!isset($paymentStatusCounts[$statusKey])) {
            $paymentStatusCounts[$statusKey] = 0;
        }

        $paymentStatusCounts[$statusKey] += (int)($r["cnt"] ?? 0);
    }

    $registrationPaymentStmt->close();
}

// ── Response ─────────────────────────────────────────────────────────────────

json_response([
    "success" => true,

    "totalWorkshop" => $totalPrivateWorkshops,
    "totalPrivateWorkshops" => $totalPrivateWorkshops,
    "totalEvent" => $totalEvents,
    "totalPublicRegistrations" => $totalPublicRegistrations,

    "pendingBookings" => $pendingBookings,
    "pendingPaymentBookings" => $pendingPaymentBookings,
    "cancellationRequests" => $cancellationRequests,

    "paidBookings" => $paidBookings,
    "totalRevenue" => $totalRevenue,

    "labels" => array_values($months),

    "workshopCounts" => array_values($privateWorkshopCounts),
    "privateWorkshopCounts" => array_values($privateWorkshopCounts),
    "eventCounts" => array_values($eventCounts),
    "publicRegistrationCounts" => array_values($publicRegistrationCounts),
    "pendingCounts" => array_values($pendingCounts),

    "revenue" => array_values($revenue),
    "paymentCounts" => array_values($paymentCounts),

    "statusLabels" => array_keys($statusCounts),
    "statusCounts" => array_values($statusCounts),

    "paymentStatusLabels" => array_keys($paymentStatusCounts),
    "paymentStatusCounts" => array_values($paymentStatusCounts),
]);
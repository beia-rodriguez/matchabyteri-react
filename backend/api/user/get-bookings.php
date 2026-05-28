<?php

session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "error" => "Unauthorized. Please login again."
    ]);
    exit();
}

$userId = (int) $_SESSION["user_id"];

$bookings = [];
$awaitingPayment = [];

/*
|--------------------------------------------------------------------------
| 1. Main bookings table
|--------------------------------------------------------------------------
| Supports:
| - event_booking
| - private_workshop
| - custom
|--------------------------------------------------------------------------
*/
$stmt = $conn->prepare("
    SELECT
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.status,
        b.total_amount,
        b.amount_paid AS stored_amount_paid,
        b.payment_status AS stored_payment_status,

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
        ), 0) AS pending_payment_count,

        b.cancel_requested,
        b.cancel_reason,
        b.cancel_requested_at,
        b.created_at
    FROM bookings b
    LEFT JOIN payments p
        ON p.booking_id = b.id
    WHERE b.user_id = ?
    GROUP BY
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.status,
        b.total_amount,
        b.amount_paid,
        b.payment_status,
        b.cancel_requested,
        b.cancel_reason,
        b.cancel_requested_at,
        b.created_at
    ORDER BY b.booking_date DESC, b.start_time DESC
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Database prepare failed: " . $conn->error
    ]);
    exit();
}

$stmt->bind_param("i", $userId);
$stmt->execute();

$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $totalAmount = (float) ($row["total_amount"] ?? 0);
    $storedAmountPaid = (float) ($row["stored_amount_paid"] ?? 0);
    $paidFromPayments = (float) ($row["paid_from_payments"] ?? 0);
    $amountPaid = max($storedAmountPaid, $paidFromPayments);

    $pendingPaymentCount = (int) ($row["pending_payment_count"] ?? 0);
    $storedPaymentStatus = strtolower((string) ($row["stored_payment_status"] ?? "unpaid"));

    if ($totalAmount > 0 && $amountPaid >= $totalAmount) {
        $computedPaymentStatus = "paid";
    } elseif ($amountPaid > 0) {
        $computedPaymentStatus = "partial";
    } elseif ($pendingPaymentCount > 0) {
        $computedPaymentStatus = "pending";
    } elseif (in_array($storedPaymentStatus, ["paid", "partial", "pending", "rejected", "unpaid"], true)) {
        $computedPaymentStatus = $storedPaymentStatus;
    } else {
        $computedPaymentStatus = "unpaid";
    }

    $bookingType = strtolower((string) ($row["booking_type"] ?? ""));

    $displayType = match ($bookingType) {
        "event_booking" => "Event Booking",
        "private_workshop" => "Private Workshop",
        "custom" => "Custom Booking",
        default => ucwords(str_replace("_", " ", $bookingType)),
    };

    $status = strtolower((string) ($row["status"] ?? "pending"));

    $item = [
        "id" => (int) $row["id"],
        "record_type" => "booking",
        "row_key" => "booking-" . $row["id"],

        "booking_date" => $row["booking_date"],
        "start_time" => $row["start_time"],
        "end_time" => $row["end_time"],

        "booking_type" => $bookingType,
        "display_type" => $displayType,

        "status" => $status,
        "payment_status" => $computedPaymentStatus,

        "total_amount" => $totalAmount,
        "amount_paid" => $amountPaid,
        "balance" => max($totalAmount - $amountPaid, 0),

        "cancel_requested" => (int) ($row["cancel_requested"] ?? 0),
        "cancel_reason" => $row["cancel_reason"] ?? "",
        "cancel_requested_at" => $row["cancel_requested_at"] ?? null,

        "created_at" => $row["created_at"],

        "display_status" => $status,
        "can_continue_payment" => false,
    ];

    if ($status === "pending_payment") {
        $item["display_status"] = "awaiting_payment";
        $item["can_continue_payment"] = true;
        $awaitingPayment[] = $item;
    }

    $bookings[] = $item;
}

$stmt->close();

/*
|--------------------------------------------------------------------------
| 2. Public workshop registrations
|--------------------------------------------------------------------------
| Public workshop registration uses workshop_registrations.
| It does not use the bookings table.
|--------------------------------------------------------------------------
*/
$workshopStmt = $conn->prepare("
    SELECT
        wr.id,
        wr.user_id,
        wr.workshop_id,
        wr.package,
        wr.full_name,
        wr.email,
        wr.phone_number,
        wr.created_at,
        wr.status,
        wr.payment_status,
        wr.total_amount,

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
    FROM workshop_registrations wr
    LEFT JOIN payments p
        ON p.registration_id = wr.id
    WHERE wr.user_id = ?
    GROUP BY
        wr.id,
        wr.user_id,
        wr.workshop_id,
        wr.package,
        wr.full_name,
        wr.email,
        wr.phone_number,
        wr.created_at,
        wr.status,
        wr.payment_status,
        wr.total_amount
    ORDER BY wr.created_at DESC
");

if (!$workshopStmt) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Workshop registration prepare failed: " . $conn->error
    ]);
    exit();
}

$workshopStmt->bind_param("i", $userId);
$workshopStmt->execute();

$workshopResult = $workshopStmt->get_result();

while ($row = $workshopResult->fetch_assoc()) {
    $createdAt = $row["created_at"] ?? null;
    $bookingDate = $createdAt ? date("Y-m-d", strtotime($createdAt)) : null;

    $totalAmount = (float) ($row["total_amount"] ?? 0);
    $paidFromPayments = (float) ($row["paid_from_payments"] ?? 0);
    $pendingPaymentCount = (int) ($row["pending_payment_count"] ?? 0);
    $storedPaymentStatus = strtolower((string) ($row["payment_status"] ?? "unpaid"));

    if ($totalAmount > 0 && $paidFromPayments >= $totalAmount) {
        $computedPaymentStatus = "paid";
        $amountPaid = $totalAmount;
    } elseif ($paidFromPayments > 0) {
        $computedPaymentStatus = "partial";
        $amountPaid = $paidFromPayments;
    } elseif ($pendingPaymentCount > 0) {
        $computedPaymentStatus = "pending";
        $amountPaid = 0;
    } elseif ($storedPaymentStatus === "paid") {
        $computedPaymentStatus = "paid";
        $amountPaid = $totalAmount;
    } else {
        $computedPaymentStatus = $storedPaymentStatus ?: "unpaid";
        $amountPaid = 0;
    }

    $registration = [
        "id" => (int) $row["id"],
        "record_type" => "workshop_registration",
        "row_key" => "workshop-registration-" . $row["id"],

        "booking_date" => $bookingDate,
        "start_time" => null,
        "end_time" => null,

        "booking_type" => "workshop_registration",
        "display_type" => "Public Workshop Registration",

        "workshop_id" => (int) $row["workshop_id"],
        "package" => $row["package"],

        "status" => strtolower((string) ($row["status"] ?? "pending")),
        "payment_status" => $computedPaymentStatus,

        "total_amount" => $totalAmount,
        "amount_paid" => $amountPaid,
        "balance" => max($totalAmount - $amountPaid, 0),

        "cancel_requested" => 0,
        "cancel_reason" => "",
        "cancel_requested_at" => null,

        "created_at" => $row["created_at"],
        "display_status" => strtolower((string) ($row["status"] ?? "pending")),
        "can_continue_payment" => false,
    ];

    $bookings[] = $registration;
}

$workshopStmt->close();

/*
|--------------------------------------------------------------------------
| 3. Sort all records together
|--------------------------------------------------------------------------
*/
usort($bookings, function ($a, $b) {
    $dateA = $a["booking_date"] ?? $a["created_at"] ?? "";
    $dateB = $b["booking_date"] ?? $b["created_at"] ?? "";

    $timeA = $a["start_time"] ?? "00:00:00";
    $timeB = $b["start_time"] ?? "00:00:00";

    return strtotime($dateB . " " . $timeB) <=> strtotime($dateA . " " . $timeA);
});

echo json_encode([
    "success" => true,
    "privateBookings" => $bookings,
    "awaitingPaymentBookings" => $awaitingPayment
]);
exit();
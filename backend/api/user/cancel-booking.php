<?php
session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized. Please login again."]);
    exit();
}

$userId = (int) $_SESSION["user_id"];

$private = [];
$awaitingPayment = [];

/* ─────────────────────────────────────────────
   NORMAL BOOKINGS
───────────────────────────────────────────── */

$stmt = $conn->prepare("
    SELECT
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.status,
        b.total_amount,

        COALESCE(SUM(
            CASE
                WHEN p.status = 'paid' THEN p.amount
                ELSE 0
            END
        ), 0) AS amount_paid,

        CASE
            WHEN COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) >= b.total_amount
                 AND b.total_amount > 0 THEN 'paid'

            WHEN COALESCE(SUM(CASE WHEN p.status = 'paid' THEN p.amount ELSE 0 END), 0) > 0 THEN 'partial'

            WHEN COALESCE(SUM(CASE WHEN p.status = 'pending' THEN 1 ELSE 0 END), 0) > 0 THEN 'pending'

            ELSE 'unpaid'
        END AS computed_payment_status,

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
        b.cancel_requested,
        b.cancel_reason,
        b.cancel_requested_at,
        b.created_at
    ORDER BY b.booking_date DESC, b.start_time DESC
");

if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "Database prepare failed: " . $conn->error]);
    exit();
}

$stmt->bind_param("i", $userId);
$stmt->execute();

$result = $stmt->get_result();

while ($row = $result->fetch_assoc()) {
    $row["record_type"] = "booking";
    $row["row_key"] = "booking-" . $row["id"];

    $row["status"] = $row["status"] ?? "pending";
    $row["payment_status"] = $row["computed_payment_status"] ?? "unpaid";

    $row["total_amount"] = (float) ($row["total_amount"] ?? 0);
    $row["amount_paid"] = (float) ($row["amount_paid"] ?? 0);
    $row["balance"] = max($row["total_amount"] - $row["amount_paid"], 0);

    unset($row["computed_payment_status"]);

    $row["cancel_requested"] = (int) ($row["cancel_requested"] ?? 0);
    $row["cancel_reason"] = $row["cancel_reason"] ?? "";
    $row["cancel_requested_at"] = $row["cancel_requested_at"] ?? null;

    if ($row["status"] === "pending_payment") {
        $row["display_status"] = "awaiting_payment";
        $row["can_continue_payment"] = true;
        $awaitingPayment[] = $row;
        continue;
    }

    $row["display_status"] = $row["status"];
    $row["can_continue_payment"] = false;

    $private[] = $row;
}

$stmt->close();

/* ─────────────────────────────────────────────
   WORKSHOP REGISTRATIONS
───────────────────────────────────────────── */

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
        wr.total_amount
    FROM workshop_registrations wr
    WHERE wr.user_id = ?
    ORDER BY wr.created_at DESC
");

if (!$workshopStmt) {
    http_response_code(500);
    echo json_encode(["error" => "Workshop registration prepare failed: " . $conn->error]);
    exit();
}

$workshopStmt->bind_param("i", $userId);
$workshopStmt->execute();

$workshopResult = $workshopStmt->get_result();

while ($row = $workshopResult->fetch_assoc()) {
    $paymentStatus = strtolower($row["payment_status"] ?? "unpaid");
    $totalAmount = (float) ($row["total_amount"] ?? 0);

    $createdAt = $row["created_at"] ?? null;
    $bookingDate = $createdAt ? date("Y-m-d", strtotime($createdAt)) : null;

    $registration = [
        "id" => (int) $row["id"],
        "record_type" => "workshop_registration",
        "row_key" => "workshop-registration-" . $row["id"],

        "booking_date" => $bookingDate,
        "start_time" => null,
        "end_time" => null,

        "booking_type" => "workshop registration",
        "workshop_id" => (int) $row["workshop_id"],
        "package" => $row["package"],

        "status" => $row["status"] ?? "pending",
        "payment_status" => $row["payment_status"] ?? "unpaid",

        "total_amount" => $totalAmount,
        "amount_paid" => $paymentStatus === "paid" ? $totalAmount : 0,
        "balance" => $paymentStatus === "paid" ? 0 : $totalAmount,

        "cancel_requested" => 0,
        "cancel_reason" => "",
        "cancel_requested_at" => null,

        "created_at" => $row["created_at"],
        "display_status" => $row["status"] ?? "pending",
        "can_continue_payment" => false,
    ];

    $private[] = $registration;
}

$workshopStmt->close();

/* ─────────────────────────────────────────────
   SORT BOOKINGS + WORKSHOP REGISTRATIONS
───────────────────────────────────────────── */

usort($private, function ($a, $b) {
    $dateA = $a["booking_date"] ?? $a["created_at"] ?? "";
    $dateB = $b["booking_date"] ?? $b["created_at"] ?? "";

    return strtotime($dateB) <=> strtotime($dateA);
});

echo json_encode([
    "success" => true,
    "privateBookings" => $private,
    "awaitingPaymentBookings" => $awaitingPayment
]);

exit();
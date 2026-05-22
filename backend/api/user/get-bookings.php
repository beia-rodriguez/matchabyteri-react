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

echo json_encode([
    "success" => true,
    "privateBookings" => $private,
    "awaitingPaymentBookings" => $awaitingPayment
]);
exit();

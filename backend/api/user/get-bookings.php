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

$stmt = $conn->prepare("
    SELECT
        b.id,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.status,
        b.payment_status,
        b.total_amount,

        COALESCE(SUM(
            CASE
                WHEN p.status = 'paid' THEN p.amount
                ELSE 0
            END
        ), 0) AS computed_amount_paid,

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
        b.payment_status,
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
    $row["payment_status"] = $row["payment_status"] ?? "unpaid";

    $row["total_amount"] = (float) ($row["total_amount"] ?? 0);
    $row["amount_paid"] = (float) ($row["computed_amount_paid"] ?? 0);
    $row["balance"] = max($row["total_amount"] - $row["amount_paid"], 0);

    /*
      Optional safety:
      If payment_status in bookings is outdated, derive display status from actual paid amount.
    */
    if ($row["amount_paid"] >= $row["total_amount"] && $row["total_amount"] > 0) {
        $row["payment_status"] = "paid";
    } elseif ($row["amount_paid"] > 0) {
        $row["payment_status"] = "partial";
    }

    unset($row["computed_amount_paid"]);

    $row["cancel_requested"] = (int) ($row["cancel_requested"] ?? 0);
    $row["cancel_reason"] = $row["cancel_reason"] ?? "";
    $row["cancel_requested_at"] = $row["cancel_requested_at"] ?? null;

    $private[] = $row;
}

$stmt->close();

echo json_encode([
    "success" => true,
    "privateBookings" => $private
]);
exit();
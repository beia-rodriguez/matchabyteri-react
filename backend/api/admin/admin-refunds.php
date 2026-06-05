<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function jsonResponse($statusCode, $data) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

function requireAdminUser(mysqli $conn) {
    if (!isset($_SESSION["user_id"])) {
        jsonResponse(401, [
            "success" => false,
            "error" => "Unauthorized. Please login again."
        ]);
    }

    $userId = (int) $_SESSION["user_id"];

    $stmt = $conn->prepare("
        SELECT id, role
        FROM users
        WHERE id = ?
        LIMIT 1
    ");

    if (!$stmt) {
        jsonResponse(500, [
            "success" => false,
            "error" => "Database error while checking admin access."
        ]);
    }

    $stmt->bind_param("i", $userId);
    $stmt->execute();

    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    $stmt->close();

    if (!$user || strtolower((string) $user["role"]) !== "admin") {
        jsonResponse(403, [
            "success" => false,
            "error" => "Forbidden. Admin access required."
        ]);
    }

    return $userId;
}

requireAdminUser($conn);

$status = isset($_GET["status"])
    ? strtolower(trim((string) $_GET["status"]))
    : "all";

$allowedStatuses = ["all", "pending", "approved", "rejected"];

if (!in_array($status, $allowedStatuses, true)) {
    $status = "all";
}

$where = "";

if ($status !== "all") {
    $where = "WHERE rr.status = ?";
}

$sql = "
    SELECT
        rr.id,
        rr.user_id,
        rr.booking_id,
        rr.registration_id,
        rr.refund_type,
        rr.reason,
        rr.amount_paid,
        rr.refundable_amount,
        rr.status,
        rr.admin_notes,
        rr.admin_attachment_path,
        rr.admin_attachment_name,
        rr.reviewed_by,
        rr.reviewed_at,
        rr.created_at,

        u.name AS user_name,
        u.email AS user_email,
        u.phone_number AS user_phone_number,

        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.total_amount AS booking_total_amount,

        wr.package AS workshop_package,
        wr.phone_number AS registration_phone_number,
        wr.total_amount AS registration_total_amount,

        wp.title AS workshop_title,
        wp.workshop_date AS workshop_date,
        wp.start_time AS workshop_start_time,
        wp.end_time AS workshop_end_time,

        (
            SELECT p.payer_name
            FROM payments p
            WHERE
                (
                    rr.refund_type = 'booking'
                    AND rr.booking_id IS NOT NULL
                    AND p.booking_id = rr.booking_id
                )
                OR
                (
                    rr.refund_type = 'workshop_registration'
                    AND rr.registration_id IS NOT NULL
                    AND p.registration_id = rr.registration_id
                )
            ORDER BY
                CASE
                    WHEN p.status = 'paid' THEN 1
                    WHEN p.status = 'pending' THEN 2
                    ELSE 3
                END,
                p.created_at DESC
            LIMIT 1
        ) AS customer_gcash_name
    FROM refund_requests rr
    LEFT JOIN users u
        ON u.id = rr.user_id
    LEFT JOIN bookings b
        ON b.id = rr.booking_id
    LEFT JOIN workshop_registrations wr
        ON wr.id = rr.registration_id
    LEFT JOIN workshops_public wp
        ON wp.id = wr.workshop_id
    $where
    ORDER BY rr.created_at DESC
";

$stmt = $conn->prepare($sql);

if (!$stmt) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database prepare failed: " . $conn->error
    ]);
}

if ($status !== "all") {
    $stmt->bind_param("s", $status);
}

$stmt->execute();

$result = $stmt->get_result();
$items = [];

while ($row = $result->fetch_assoc()) {
    $customerPhone = $row["registration_phone_number"] ?: $row["user_phone_number"];
    $customerGcashName = $row["customer_gcash_name"] ?: "N/A";

    $items[] = [
        "id" => (int) $row["id"],
        "user_id" => (int) $row["user_id"],

        "booking_id" => $row["booking_id"] !== null
            ? (int) $row["booking_id"]
            : null,

        "registration_id" => $row["registration_id"] !== null
            ? (int) $row["registration_id"]
            : null,

        "refund_type" => $row["refund_type"],
        "reason" => $row["reason"],

        "customer_gcash_name" => $customerGcashName,
        "customer_phone_number" => $customerPhone ?: "N/A",

        "amount_paid" => (float) $row["amount_paid"],
        "refundable_amount" => (float) $row["refundable_amount"],
        "status" => $row["status"],
        "admin_notes" => $row["admin_notes"],
        "admin_attachment_path" => $row["admin_attachment_path"],
        "admin_attachment_name" => $row["admin_attachment_name"],
        "reviewed_by" => $row["reviewed_by"],
        "reviewed_at" => $row["reviewed_at"],
        "created_at" => $row["created_at"],

        "user_name" => $row["user_name"],
        "user_email" => $row["user_email"],

        "booking_date" => $row["booking_date"],
        "start_time" => $row["start_time"],
        "end_time" => $row["end_time"],
        "booking_type" => $row["booking_type"],
        "booking_total_amount" => $row["booking_total_amount"] !== null
            ? (float) $row["booking_total_amount"]
            : null,

        "workshop_package" => $row["workshop_package"],
        "registration_total_amount" => $row["registration_total_amount"] !== null
            ? (float) $row["registration_total_amount"]
            : null,

        "workshop_title" => $row["workshop_title"],
        "workshop_date" => $row["workshop_date"],
        "workshop_start_time" => $row["workshop_start_time"],
        "workshop_end_time" => $row["workshop_end_time"],
    ];
}

$stmt->close();

jsonResponse(200, [
    "success" => true,
    "refund_requests" => $items
]);
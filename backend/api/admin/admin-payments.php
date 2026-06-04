<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function json_response($payload, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($payload);
    exit();
}

function decode_context($raw) {
    if (!is_string($raw) || trim($raw) === "") {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function short_token($t) {
    $t = (string)$t;

    if ($t === "") {
        return "";
    }

    if (mb_strlen($t) <= 10) {
        return $t;
    }

    return mb_substr($t, 0, 4) . "..." . mb_substr($t, -4);
}

function money_to_float($value) {
    if ($value === null || $value === "") {
        return 0.0;
    }

    return round((float)$value, 2);
}

function sync_booking_payment_summary(mysqli $conn, int $bookingId): void {
    if ($bookingId <= 0) {
        return;
    }

    $stmt = $conn->prepare("
        UPDATE bookings b
        SET
            b.amount_paid = (
                SELECT ROUND(COALESCE(SUM(COALESCE(p.amount, 0)), 0), 2)
                FROM payments p
                WHERE p.booking_id = b.id
                  AND p.status = 'paid'
            ),
            b.payment_status = CASE
                WHEN b.total_amount > 0
                 AND (
                    SELECT ROUND(COALESCE(SUM(COALESCE(p.amount, 0)), 0), 2)
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'paid'
                 ) >= ROUND(b.total_amount, 2)
                    THEN 'paid'

                WHEN (
                    SELECT ROUND(COALESCE(SUM(COALESCE(p.amount, 0)), 0), 2)
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'paid'
                ) > 0
                    THEN 'partial'

                WHEN EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'pending'
                )
                    THEN 'pending'

                ELSE 'unpaid'
            END,
            b.updated_at = NOW()
        WHERE b.id = ?
        LIMIT 1
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare booking payment sync: " . $conn->error);
    }

    $stmt->bind_param("i", $bookingId);

    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        throw new Exception("Failed to sync booking payment summary: " . $error);
    }

    $stmt->close();
}

function sync_registration_payment_summary(mysqli $conn, int $registrationId): void {
    if ($registrationId <= 0) {
        return;
    }

    $stmt = $conn->prepare("
        UPDATE workshop_registrations r
        SET
            r.payment_status = CASE
                WHEN r.total_amount > 0
                 AND (
                    SELECT ROUND(COALESCE(SUM(COALESCE(p.amount, 0)), 0), 2)
                    FROM payments p
                    WHERE p.registration_id = r.id
                      AND p.status = 'paid'
                 ) >= ROUND(r.total_amount, 2)
                    THEN 'paid'

                WHEN EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.registration_id = r.id
                      AND p.status = 'pending'
                )
                    THEN 'pending'

                ELSE 'unpaid'
            END
        WHERE r.id = ?
        LIMIT 1
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare registration payment sync: " . $conn->error);
    }

    $stmt->bind_param("i", $registrationId);

    if (!$stmt->execute()) {
        $error = $stmt->error;
        $stmt->close();
        throw new Exception("Failed to sync registration payment summary: " . $error);
    }

    $stmt->close();
}

function get_payment_totals_for_booking(mysqli $conn, int $bookingId): array {
    if ($bookingId <= 0) {
        return [
            "record_type" => "booking",
            "total_amount" => 0.0,
            "amount_paid" => 0.0,
            "remaining_balance" => 0.0,
            "payment_status" => "unpaid"
        ];
    }

    $stmt = $conn->prepare("
        SELECT
            COALESCE(b.total_amount, 0) AS total_amount,
            COALESCE(b.amount_paid, 0) AS amount_paid,
            COALESCE(b.payment_status, 'unpaid') AS payment_status
        FROM bookings b
        WHERE b.id = ?
        LIMIT 1
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare booking totals lookup.");
    }

    $stmt->bind_param("i", $bookingId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        return [
            "record_type" => "booking",
            "total_amount" => 0.0,
            "amount_paid" => 0.0,
            "remaining_balance" => 0.0,
            "payment_status" => "unpaid"
        ];
    }

    $total = money_to_float($row["total_amount"] ?? 0);
    $paid = money_to_float($row["amount_paid"] ?? 0);

    return [
        "record_type" => "booking",
        "total_amount" => $total,
        "amount_paid" => $paid,
        "remaining_balance" => max(round($total - $paid, 2), 0),
        "payment_status" => (string)($row["payment_status"] ?? "unpaid")
    ];
}

function get_payment_totals_for_registration(mysqli $conn, int $registrationId): array {
    if ($registrationId <= 0) {
        return [
            "record_type" => "registration",
            "total_amount" => 0.0,
            "amount_paid" => 0.0,
            "remaining_balance" => 0.0,
            "payment_status" => "unpaid"
        ];
    }

    $stmt = $conn->prepare("
        SELECT
            COALESCE(r.total_amount, 0) AS total_amount,
            COALESCE(r.payment_status, 'unpaid') AS payment_status,
            COALESCE(SUM(CASE WHEN p.status = 'paid' THEN COALESCE(p.amount, 0) ELSE 0 END), 0) AS amount_paid
        FROM workshop_registrations r
        LEFT JOIN payments p ON p.registration_id = r.id
        WHERE r.id = ?
        GROUP BY r.id, r.total_amount, r.payment_status
        LIMIT 1
    ");

    if (!$stmt) {
        throw new Exception("Failed to prepare registration totals lookup.");
    }

    $stmt->bind_param("i", $registrationId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        return [
            "record_type" => "registration",
            "total_amount" => 0.0,
            "amount_paid" => 0.0,
            "remaining_balance" => 0.0,
            "payment_status" => "unpaid"
        ];
    }

    $total = money_to_float($row["total_amount"] ?? 0);
    $paid = money_to_float($row["amount_paid"] ?? 0);

    return [
        "record_type" => "registration",
        "total_amount" => $total,
        "amount_paid" => $paid,
        "remaining_balance" => max(round($total - $paid, 2), 0),
        "payment_status" => (string)($row["payment_status"] ?? "unpaid")
    ];
}

/*
|--------------------------------------------------------------------------
| POST: Update payment status
|--------------------------------------------------------------------------
*/
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $raw = file_get_contents("php://input");
    $data = json_decode($raw, true);

    if (!is_array($data)) {
        $data = [];
    }

    verify_csrf_json($data, $csrf);

    if (($data["action"] ?? "") !== "set_payment_status") {
        json_response(["error" => "Invalid action."], 400);
    }

    $pid = (int)($data["payment_id"] ?? 0);
    $newStatus = strtolower(trim((string)($data["status"] ?? "")));
    $adminNote = trim((string)($data["admin_note"] ?? ""));
    $adminId = (int)($_SESSION["user_id"] ?? 0);

    $allowed = ["pending", "paid", "rejected"];

    if ($pid <= 0 || !in_array($newStatus, $allowed, true)) {
        json_response(["error" => "Invalid payment update."], 400);
    }

    $conn->begin_transaction();

    try {
        $stmt = $conn->prepare("
            SELECT
                id,
                booking_id,
                registration_id,
                amount,
                context_json,
                status
            FROM payments
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        ");

        if (!$stmt) {
            throw new Exception("Failed to prepare payment lookup.");
        }

        $stmt->bind_param("i", $pid);
        $stmt->execute();
        $cur = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$cur) {
            throw new Exception("Payment not found.");
        }

        $bookingId = (int)($cur["booking_id"] ?? 0);
        $registrationId = (int)($cur["registration_id"] ?? 0);
        $oldStatus = strtolower((string)($cur["status"] ?? "pending"));
        $amount = money_to_float($cur["amount"] ?? 0);
        $ctx = decode_context($cur["context_json"] ?? "");

        if ($oldStatus === "paid" && $newStatus !== "paid") {
            throw new Exception("This payment is already marked as paid. Create an adjustment/refund record instead of changing it back.");
        }

        if ($newStatus === "paid" && $amount <= 0) {
            throw new Exception("This payment has no valid amount. Fix the payment amount before marking it as paid.");
        }

        $now = date("Y-m-d H:i:s");

        $history = [];
        if (isset($ctx["_admin_history"]) && is_array($ctx["_admin_history"])) {
            $history = $ctx["_admin_history"];
        }

        $history[] = [
            "note" => $adminNote,
            "updated_by" => $adminId,
            "updated_at" => $now,
            "from_status" => $oldStatus,
            "to_status" => $newStatus
        ];

        $ctx["_admin"] = [
            "note" => $adminNote,
            "updated_by" => $adminId,
            "updated_at" => $now,
            "from_status" => $oldStatus,
            "to_status" => $newStatus
        ];
        $ctx["_admin_history"] = $history;

        if ($newStatus === "paid") {
            if (empty($ctx["_paid_at"])) {
                $ctx["_paid_at"] = $now;
            }
        } elseif ($oldStatus !== "paid") {
            unset($ctx["_paid_at"]);
        }

        $ctxJson = json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($ctxJson === false || $ctxJson === "") {
            $ctxJson = "{}";
        }

        $stmt = $conn->prepare("
            UPDATE payments
            SET
                status = ?,
                reviewed_by = ?,
                reviewed_at = ?,
                admin_notes = ?,
                context_json = ?
            WHERE id = ?
            LIMIT 1
        ");

        if (!$stmt) {
            throw new Exception("Failed to prepare payment update.");
        }

        $stmt->bind_param("sisssi", $newStatus, $adminId, $now, $adminNote, $ctxJson, $pid);

        if (!$stmt->execute()) {
            $error = $stmt->error;
            $stmt->close();
            throw new Exception("Failed to update payment: " . $error);
        }

        $stmt->close();

        if ($bookingId > 0) {
            sync_booking_payment_summary($conn, $bookingId);
            $totals = get_payment_totals_for_booking($conn, $bookingId);
        } elseif ($registrationId > 0) {
            sync_registration_payment_summary($conn, $registrationId);
            $totals = get_payment_totals_for_registration($conn, $registrationId);
        } else {
            $totals = [
                "record_type" => "unknown",
                "total_amount" => 0.0,
                "amount_paid" => 0.0,
                "remaining_balance" => 0.0,
                "payment_status" => "unpaid"
            ];
        }

        $conn->commit();

        json_response([
            "success" => true,
            "message" => "Payment review saved. Payment totals were recalculated.",
            "payment" => [
                "id" => $pid,
                "old_status" => $oldStatus,
                "new_status" => $newStatus,
                "amount" => $amount
            ],
            "linked_record" => $totals,
            "booking" => $totals
        ]);
    } catch (Exception $e) {
        $conn->rollback();

        error_log("admin-payments update error: " . $e->getMessage());

        json_response([
            "error" => $e->getMessage()
        ], 400);
    }
}

/*
|--------------------------------------------------------------------------
| GET: Load payments
|--------------------------------------------------------------------------
*/
$statusFilter = strtolower(trim((string)($_GET["status"] ?? "pending")));
$allowedStatus = ["all", "pending", "paid", "rejected"];

if (!in_array($statusFilter, $allowedStatus, true)) {
    $statusFilter = "pending";
}

$q = trim((string)($_GET["q"] ?? ""));
$payments = [];

$baseSelect = "
    SELECT
        p.*,
        COALESCE(u.name, r.full_name) AS user_name,
        COALESCE(u.email, r.email) AS user_email,

        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.payment_status AS booking_payment_status,
        b.amount_paid AS booking_amount_paid,
        b.total_amount AS booking_total_amount,

        r.workshop_id,
        r.package AS registration_package,
        r.full_name AS registration_full_name,
        r.email AS registration_email,
        r.phone_number AS registration_phone_number,
        r.status AS registration_status,
        r.payment_status AS registration_payment_status,
        r.total_amount AS registration_total_amount,

        w.title AS workshop_title,
        w.workshop_date,
        w.start_time AS workshop_start_time,
        w.end_time AS workshop_end_time,
        w.location AS workshop_location,

        COALESCE(b.total_amount, r.total_amount, 0) AS total_amount,

        CASE
            WHEN p.booking_id IS NOT NULL THEN COALESCE(b.amount_paid, 0)
            WHEN p.registration_id IS NOT NULL THEN (
                SELECT ROUND(COALESCE(SUM(COALESCE(pp.amount, 0)), 0), 2)
                FROM payments pp
                WHERE pp.registration_id = p.registration_id
                  AND pp.status = 'paid'
            )
            ELSE 0
        END AS amount_paid,

        CASE
            WHEN p.booking_id IS NOT NULL THEN COALESCE(b.payment_status, 'unpaid')
            WHEN p.registration_id IS NOT NULL THEN COALESCE(r.payment_status, 'unpaid')
            ELSE 'unpaid'
        END AS linked_payment_status,

        CASE
            WHEN p.booking_id IS NOT NULL THEN GREATEST(COALESCE(b.total_amount, 0) - COALESCE(b.amount_paid, 0), 0)
            WHEN p.registration_id IS NOT NULL THEN GREATEST(
                COALESCE(r.total_amount, 0) - (
                    SELECT ROUND(COALESCE(SUM(COALESCE(pp.amount, 0)), 0), 2)
                    FROM payments pp
                    WHERE pp.registration_id = p.registration_id
                      AND pp.status = 'paid'
                ),
                0
            )
            ELSE 0
        END AS remaining_balance
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    LEFT JOIN workshop_registrations r ON p.registration_id = r.id
    LEFT JOIN workshops_public w ON r.workshop_id = w.id
";

if ($statusFilter === "all" && $q === "") {
    $stmt = $conn->prepare($baseSelect . "
        ORDER BY p.created_at DESC
        LIMIT 120
    ");
} elseif ($statusFilter !== "all" && $q === "") {
    $stmt = $conn->prepare($baseSelect . "
        WHERE p.status = ?
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param("s", $statusFilter);
    }
} elseif ($statusFilter === "all" && $q !== "") {
    $like = "%" . $q . "%";

    $stmt = $conn->prepare($baseSelect . "
        WHERE (
            u.name LIKE ?
            OR u.email LIKE ?
            OR r.full_name LIKE ?
            OR r.email LIKE ?
            OR r.phone_number LIKE ?
            OR w.title LIKE ?
            OR p.payer_name LIKE ?
            OR p.reference_no LIKE ?
            OR p.purpose LIKE ?
            OR p.payment_token LIKE ?
            OR CAST(p.booking_id AS CHAR) LIKE ?
            OR CAST(p.registration_id AS CHAR) LIKE ?
        )
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param(
            "ssssssssssss",
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like
        );
    }
} else {
    $like = "%" . $q . "%";

    $stmt = $conn->prepare($baseSelect . "
        WHERE p.status = ?
          AND (
            u.name LIKE ?
            OR u.email LIKE ?
            OR r.full_name LIKE ?
            OR r.email LIKE ?
            OR r.phone_number LIKE ?
            OR w.title LIKE ?
            OR p.payer_name LIKE ?
            OR p.reference_no LIKE ?
            OR p.purpose LIKE ?
            OR p.payment_token LIKE ?
            OR CAST(p.booking_id AS CHAR) LIKE ?
            OR CAST(p.registration_id AS CHAR) LIKE ?
          )
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param(
            "sssssssssssss",
            $statusFilter,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like,
            $like
        );
    }
}

if (!$stmt) {
    json_response(["error" => "Failed to load payments: " . $conn->error], 500);
}

$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ctx = decode_context($r["context_json"] ?? "");

    $isRegistration = !empty($r["registration_id"]);

    $r["short_payment_token"] = short_token($r["payment_token"] ?? "");
    $r["decoded_context"] = $ctx;

    $r["amount"] = money_to_float($r["amount"] ?? 0);
    $r["total_amount"] = money_to_float($r["total_amount"] ?? 0);
    $r["amount_paid"] = money_to_float($r["amount_paid"] ?? 0);
    $r["remaining_balance"] = money_to_float($r["remaining_balance"] ?? 0);

    $r["linked_record_type"] = $isRegistration ? "registration" : "booking";
    $r["linked_record_id"] = $isRegistration ? (int)($r["registration_id"] ?? 0) : (int)($r["booking_id"] ?? 0);
    $r["linked_payment_status"] = $r["linked_payment_status"] ?? "unpaid";

    if ($isRegistration) {
        $r["linked_record_label"] = "Public Workshop Registration";
        $r["linked_schedule"] = trim((string)($r["workshop_date"] ?? ""));

        if (!empty($r["workshop_start_time"]) && !empty($r["workshop_end_time"])) {
            $r["linked_schedule"] .= " • " . $r["workshop_start_time"] . " - " . $r["workshop_end_time"];
        }

        $r["linked_type"] = trim((string)($r["workshop_title"] ?? "Public Workshop"));

        if (!empty($r["registration_package"])) {
            $r["linked_type"] .= " • " . strtoupper((string)$r["registration_package"]);
        }
    } else {
        $r["linked_record_label"] = "Booking";
        $r["linked_schedule"] = trim((string)($r["booking_date"] ?? ""));

        if (!empty($r["start_time"]) && !empty($r["end_time"])) {
            $r["linked_schedule"] .= " • " . $r["start_time"] . " - " . $r["end_time"];
        }

        $r["linked_type"] = strtoupper((string)($r["booking_type"] ?? ""));
    }

    $payments[] = $r;
}

$stmt->close();

/*
|--------------------------------------------------------------------------
| Payment counts
|--------------------------------------------------------------------------
*/
$counts = [
    "all" => 0,
    "pending" => 0,
    "paid" => 0,
    "rejected" => 0
];

$stmt = $conn->prepare("
    SELECT status, COUNT(*) AS c
    FROM payments
    GROUP BY status
");

if ($stmt) {
    $stmt->execute();
    $res = $stmt->get_result();

    while ($r = $res->fetch_assoc()) {
        $st = strtolower((string)$r["status"]);

        if (isset($counts[$st])) {
            $counts[$st] = (int)$r["c"];
        }

        $counts["all"] += (int)$r["c"];
    }

    $stmt->close();
}

json_response([
    "success" => true,
    "csrf" => $csrf,
    "status" => $statusFilter,
    "q" => $q,
    "counts" => $counts,
    "payments" => $payments
]);

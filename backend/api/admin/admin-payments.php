<?php
require_once __DIR__ . "/admin-common-api.php";

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
    $t = (string) $t;

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

    return round((float) $value, 2);
}

function sync_booking_payment_summary($conn, $bookingId) {
    $bookingId = (int) $bookingId;

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

function get_payment_totals_for_booking($conn, $bookingId) {
    $bookingId = (int) $bookingId;

    if ($bookingId <= 0) {
        return [
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
            "total_amount" => 0.0,
            "amount_paid" => 0.0,
            "remaining_balance" => 0.0,
            "payment_status" => "unpaid"
        ];
    }

    $total = money_to_float($row["total_amount"] ?? 0);
    $paid = money_to_float($row["amount_paid"] ?? 0);

    return [
        "total_amount" => $total,
        "amount_paid" => $paid,
        "remaining_balance" => max(round($total - $paid, 2), 0),
        "payment_status" => (string) ($row["payment_status"] ?? "unpaid")
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

    $pid = (int) ($data["payment_id"] ?? 0);
    $newStatus = strtolower(trim((string) ($data["status"] ?? "")));
    $adminNote = trim((string) ($data["admin_note"] ?? ""));
    $adminId = (int) ($_SESSION["user_id"] ?? 0);

    $allowed = ["pending", "paid", "rejected"];

    if ($pid <= 0 || !in_array($newStatus, $allowed, true)) {
        json_response(["error" => "Invalid payment update."], 400);
    }

    $conn->begin_transaction();

    try {
        /*
          Lock this payment row during review.
          This prevents two admins from changing the same payment at the same time.
        */
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

        $bookingId = (int) ($cur["booking_id"] ?? 0);
        $oldStatus = strtolower((string) ($cur["status"] ?? "pending"));
        $amount = money_to_float($cur["amount"] ?? 0);
        $ctx = decode_context($cur["context_json"] ?? "");

        /*
          Business rule:
          - A pending/rejected payment can still be reviewed.
          - A paid payment is final, because reversing it could silently reduce amount_paid.
          - Updating admin notes on an already-paid payment is allowed only when status stays paid.
        */
        if ($oldStatus === "paid" && $newStatus !== "paid") {
            throw new Exception("This payment is already marked as paid. Create an adjustment/refund record instead of changing it back.");
        }

        /*
          Safety rule:
          A payment with zero/blank amount should not be approved, because it will not increase booking.amount_paid.
          This commonly causes the “remaining balance did not change” problem.
        */
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
        }

        $totals = get_payment_totals_for_booking($conn, $bookingId);

        $conn->commit();

        json_response([
            "success" => true,
            "message" => "Payment review saved. Booking payment totals were recalculated.",
            "payment" => [
                "id" => $pid,
                "old_status" => $oldStatus,
                "new_status" => $newStatus,
                "amount" => $amount
            ],
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
$statusFilter = strtolower(trim((string) ($_GET["status"] ?? "pending")));
$allowedStatus = ["all", "pending", "paid", "rejected"];

if (!in_array($statusFilter, $allowedStatus, true)) {
    $statusFilter = "pending";
}

$q = trim((string) ($_GET["q"] ?? ""));
$payments = [];

$baseSelect = "
    SELECT
        p.*,
        u.name AS user_name,
        u.email AS user_email,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.booking_type,
        b.payment_status,
        b.amount_paid,
        b.total_amount,
        GREATEST(COALESCE(b.total_amount, 0) - COALESCE(b.amount_paid, 0), 0) AS remaining_balance
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
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
            "ssssssss",
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
            "sssssssss",
            $statusFilter,
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

    $r["short_payment_token"] = short_token($r["payment_token"] ?? "");
    $r["decoded_context"] = $ctx;

    $r["amount"] = money_to_float($r["amount"] ?? 0);
    $r["total_amount"] = money_to_float($r["total_amount"] ?? 0);
    $r["amount_paid"] = money_to_float($r["amount_paid"] ?? 0);
    $r["remaining_balance"] = money_to_float($r["remaining_balance"] ?? 0);

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
        $st = strtolower((string) $r["status"]);

        if (isset($counts[$st])) {
            $counts[$st] = (int) $r["c"];
        }

        $counts["all"] += (int) $r["c"];
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

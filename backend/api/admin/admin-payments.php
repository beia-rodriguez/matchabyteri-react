<?php
require_once __DIR__ . "/admin-common-api.php";

function sync_booking_payment_summary($conn, $bookingId) {
    $bookingId = (int) $bookingId;

    if ($bookingId <= 0) {
        return;
    }

    $stmt = $conn->prepare("
        UPDATE bookings b
        SET 
            b.amount_paid = (
                SELECT COALESCE(SUM(p.amount), 0)
                FROM payments p
                WHERE p.booking_id = b.id
                  AND p.status = 'paid'
            ),
            b.payment_status = CASE
                WHEN (
                    SELECT COALESCE(SUM(p.amount), 0)
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'paid'
                ) >= b.total_amount
                AND b.total_amount > 0 THEN 'paid'

                WHEN (
                    SELECT COALESCE(SUM(p.amount), 0)
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'paid'
                ) > 0 THEN 'partial'

                WHEN EXISTS (
                    SELECT 1
                    FROM payments p
                    WHERE p.booking_id = b.id
                      AND p.status = 'pending'
                ) THEN 'pending'

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

function decode_context($raw) {
    if (!is_string($raw) || trim($raw) === "") return [];

    $data = json_decode($raw, true);

    return is_array($data) ? $data : [];
}

function short_token($t) {
    $t = (string) $t;

    if ($t === "") return "";
    if (mb_strlen($t) <= 10) return $t;

    return mb_substr($t, 0, 4) . "..." . mb_substr($t, -4);
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

    if (($data["action"] ?? "") === "set_payment_status") {
        $pid = (int) ($data["payment_id"] ?? 0);
        $newStatus = strtolower(trim($data["status"] ?? ""));
        $adminNote = trim($data["admin_note"] ?? "");

        $allowed = ["pending", "paid", "rejected"];

        if ($pid <= 0 || !in_array($newStatus, $allowed, true)) {
            echo json_encode(["error" => "Invalid payment update."]);
            exit();
        }

        $stmt = $conn->prepare("
            SELECT 
                id, 
                booking_id, 
                context_json, 
                status
            FROM payments
            WHERE id = ?
            LIMIT 1
        ");

        if (!$stmt) {
            echo json_encode(["error" => "Failed to prepare payment lookup."]);
            exit();
        }

        $stmt->bind_param("i", $pid);
        $stmt->execute();

        $cur = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$cur) {
            echo json_encode(["error" => "Payment not found."]);
            exit();
        }

        $bookingId = (int) ($cur["booking_id"] ?? 0);
        $ctx = decode_context($cur["context_json"] ?? "");
        $oldStatus = strtolower((string) ($cur["status"] ?? "pending"));

        /*
          Important:
          Prevent reversing already-paid payments.
          This protects booking.amount_paid from being manipulated accidentally.
        */
        if ($oldStatus === "paid" && $newStatus !== "paid") {
            echo json_encode([
                "error" => "Paid payments cannot be changed back to pending or rejected."
            ]);
            exit();
        }

        $ctx["_admin"] = [
            "note" => $adminNote,
            "updated_by" => (int) ($_SESSION["user_id"] ?? 0),
            "updated_at" => date("Y-m-d H:i:s"),
            "from_status" => $oldStatus,
            "to_status" => $newStatus
        ];

        if ($newStatus === "paid") {
            $ctx["_paid_at"] = date("Y-m-d H:i:s");
        } else {
            unset($ctx["_paid_at"]);
        }

        $ctxJson = json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        if ($ctxJson === false || $ctxJson === "") {
            $ctxJson = "{}";
        }

        $conn->begin_transaction();

        try {
            $stmt = $conn->prepare("
                UPDATE payments
                SET 
                    status = ?, 
                    context_json = ?
                WHERE id = ?
                LIMIT 1
            ");

            if (!$stmt) {
                throw new Exception("Failed to prepare payment update.");
            }

            $stmt->bind_param("ssi", $newStatus, $ctxJson, $pid);

            if (!$stmt->execute()) {
                throw new Exception($stmt->error);
            }

            $stmt->close();

            /*
              This is the important fix:
              Do not manually add amount_paid.
              Always recompute bookings.amount_paid from all paid payment records.
            */
            if ($bookingId > 0) {
                sync_booking_payment_summary($conn, $bookingId);
            }

            $conn->commit();

            echo json_encode([
                "success" => true,
                "message" => "Payment updated and booking payment summary synced."
            ]);
            exit();

        } catch (Exception $e) {
            $conn->rollback();

            error_log("admin-payments update error: " . $e->getMessage());

            echo json_encode([
                "error" => $e->getMessage()
            ]);
            exit();
        }
    }

    echo json_encode(["error" => "Invalid action."]);
    exit();
}

/*
|--------------------------------------------------------------------------
| GET: Load payments
|--------------------------------------------------------------------------
*/
$statusFilter = strtolower(trim($_GET["status"] ?? "pending"));
$allowedStatus = ["all", "pending", "paid", "rejected"];

if (!in_array($statusFilter, $allowedStatus, true)) {
    $statusFilter = "pending";
}

$q = trim($_GET["q"] ?? "");

$payments = [];

if ($statusFilter === "all" && $q === "") {
    $stmt = $conn->prepare("
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
            b.total_amount
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN bookings b ON p.booking_id = b.id
        ORDER BY p.created_at DESC
        LIMIT 120
    ");
} elseif ($statusFilter !== "all" && $q === "") {
    $stmt = $conn->prepare("
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
            b.total_amount
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE p.status = ?
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param("s", $statusFilter);
    }
} elseif ($statusFilter === "all" && $q !== "") {
    $like = "%" . $q . "%";

    $stmt = $conn->prepare("
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
            b.total_amount
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE (
            u.name LIKE ?
            OR u.email LIKE ?
            OR p.payer_name LIKE ?
            OR p.reference_no LIKE ?
            OR p.purpose LIKE ?
            OR p.payment_token LIKE ?
            OR CAST(p.booking_id AS CHAR) LIKE ?
        )
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param(
            "sssssss",
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

    $stmt = $conn->prepare("
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
            b.total_amount
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN bookings b ON p.booking_id = b.id
        WHERE p.status = ?
          AND (
            u.name LIKE ?
            OR u.email LIKE ?
            OR p.payer_name LIKE ?
            OR p.reference_no LIKE ?
            OR p.purpose LIKE ?
            OR p.payment_token LIKE ?
            OR CAST(p.booking_id AS CHAR) LIKE ?
          )
        ORDER BY p.created_at DESC
        LIMIT 120
    ");

    if ($stmt) {
        $stmt->bind_param(
            "ssssssss",
            $statusFilter,
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
    echo json_encode(["error" => "Failed to load payments: " . $conn->error]);
    exit();
}

$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
    $ctx = decode_context($r["context_json"] ?? "");

    $r["short_payment_token"] = short_token($r["payment_token"] ?? "");
    $r["decoded_context"] = $ctx;

    $r["amount"] = (float) ($r["amount"] ?? 0);
    $r["total_amount"] = (float) ($r["total_amount"] ?? 0);
    $r["amount_paid"] = (float) ($r["amount_paid"] ?? 0);

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

echo json_encode([
    "success" => true,
    "csrf" => $csrf,
    "status" => $statusFilter,
    "q" => $q,
    "counts" => $counts,
    "payments" => $payments
]);
exit();
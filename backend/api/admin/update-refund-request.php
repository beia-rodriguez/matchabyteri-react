<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . "/../../config/db.php";
require_once __DIR__ . "/../auth/mailer.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function jsonResponse($statusCode, $data) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

function readInput() {
    if (!empty($_POST)) {
        return $_POST;
    }

    $rawInput = file_get_contents("php://input");
    $jsonInput = json_decode($rawInput, true);

    return is_array($jsonInput) ? $jsonInput : [];
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

function saveAdminAttachment($refundId) {
    if (
        !isset($_FILES["admin_attachment"]) ||
        !is_array($_FILES["admin_attachment"]) ||
        $_FILES["admin_attachment"]["error"] === UPLOAD_ERR_NO_FILE
    ) {
        return [
            "path" => null,
            "name" => null,
            "absolute_path" => null,
        ];
    }

    $file = $_FILES["admin_attachment"];

    if ($file["error"] !== UPLOAD_ERR_OK) {
        jsonResponse(400, [
            "success" => false,
            "error" => "Attachment upload failed."
        ]);
    }

    if ($file["size"] > 5 * 1024 * 1024) {
        jsonResponse(400, [
            "success" => false,
            "error" => "Attachment must be 5MB or smaller."
        ]);
    }

    $allowedTypes = [
        "image/jpeg" => "jpg",
        "image/png" => "png",
        "image/webp" => "webp",
        "image/gif" => "gif",
        "application/pdf" => "pdf",
    ];

    $mimeType = mime_content_type($file["tmp_name"]);

    if (!isset($allowedTypes[$mimeType])) {
        jsonResponse(400, [
            "success" => false,
            "error" => "Only JPG, PNG, WEBP, GIF, or PDF files are allowed."
        ]);
    }

    $uploadDir = __DIR__ . "/../uploads/refund-attachments";

    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0775, true);
    }

    $extension = $allowedTypes[$mimeType];
    $safeOriginalName = preg_replace("/[^a-zA-Z0-9._-]/", "_", basename($file["name"]));
    $fileName = "refund_" . $refundId . "_" . time() . "." . $extension;
    $absolutePath = $uploadDir . "/" . $fileName;

    if (!move_uploaded_file($file["tmp_name"], $absolutePath)) {
        jsonResponse(500, [
            "success" => false,
            "error" => "Failed to save attachment."
        ]);
    }

    return [
        "path" => "uploads/refund-attachments/" . $fileName,
        "name" => $safeOriginalName,
        "absolute_path" => $absolutePath,
    ];
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse(405, [
        "success" => false,
        "error" => "Method not allowed."
    ]);
}

$adminId = requireAdminUser($conn);
$input = readInput();

$refundId = isset($input["refund_id"]) ? (int) $input["refund_id"] : 0;
$action = strtolower(trim((string) ($input["action"] ?? "")));
$adminNotes = trim((string) ($input["admin_notes"] ?? ""));

if ($refundId <= 0) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid refund request ID."
    ]);
}

if (!in_array($action, ["approved", "rejected"], true)) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid refund action."
    ]);
}

if ($action === "rejected" && strlen($adminNotes) < 5) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Please provide a short reason when rejecting a refund."
    ]);
}

$stmt = $conn->prepare("
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

        u.name AS user_name,
        u.email AS user_email,
        u.phone_number AS user_phone_number,

        wr.phone_number AS registration_phone_number,

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
    LEFT JOIN workshop_registrations wr
        ON wr.id = rr.registration_id
    WHERE rr.id = ?
    LIMIT 1
");

$stmt->bind_param("i", $refundId);
$stmt->execute();

$result = $stmt->get_result();
$refund = $result->fetch_assoc();

$stmt->close();

if (!$refund) {
    jsonResponse(404, [
        "success" => false,
        "error" => "Refund request not found."
    ]);
}

if ($refund["status"] !== "pending") {
    jsonResponse(409, [
        "success" => false,
        "error" => "This refund request has already been reviewed."
    ]);
}

$refund["customer_phone_number"] =
    $refund["registration_phone_number"] ?: $refund["user_phone_number"];

$refund["customer_gcash_name"] =
    $refund["customer_gcash_name"] ?: "N/A";

$attachment = saveAdminAttachment($refundId);

$conn->begin_transaction();

try {
    $update = $conn->prepare("
        UPDATE refund_requests
        SET
            status = ?,
            admin_notes = ?,
            admin_attachment_path = ?,
            admin_attachment_name = ?,
            reviewed_by = ?,
            reviewed_at = NOW()
        WHERE id = ?
          AND status = 'pending'
        LIMIT 1
    ");

    if (!$update) {
        throw new Exception("Database error while preparing refund update.");
    }

    $attachmentPath = $attachment["path"];
    $attachmentName = $attachment["name"];

    $update->bind_param(
        "ssssii",
        $action,
        $adminNotes,
        $attachmentPath,
        $attachmentName,
        $adminId,
        $refundId
    );

    $update->execute();

    if ($update->affected_rows <= 0) {
        $update->close();
        throw new Exception("Refund request was not updated.");
    }

    $update->close();

    if ($action === "approved") {
        if ($refund["refund_type"] === "booking" && !empty($refund["booking_id"])) {
            $bookingId = (int) $refund["booking_id"];
            $refundAmountText = pesoMoney($refund["refundable_amount"]);

            $bookingUpdate = $conn->prepare("
                UPDATE bookings
                SET
                    status = 'cancelled',
                    admin_notes = CONCAT(
                        COALESCE(admin_notes, ''),
                        '\nRefund approved. Refund amount: ',
                        ?,
                        '. Reviewed at: ',
                        NOW()
                    )
                WHERE id = ?
                LIMIT 1
            ");

            if (!$bookingUpdate) {
                throw new Exception("Database error while updating booking after refund approval.");
            }

            $bookingUpdate->bind_param("si", $refundAmountText, $bookingId);
            $bookingUpdate->execute();
            $bookingUpdate->close();
        }

        if (
            $refund["refund_type"] === "workshop_registration" &&
            !empty($refund["registration_id"])
        ) {
            $registrationId = (int) $refund["registration_id"];

            $registrationUpdate = $conn->prepare("
                UPDATE workshop_registrations
                SET
                    status = 'cancelled'
                WHERE id = ?
                LIMIT 1
            ");

            if (!$registrationUpdate) {
                throw new Exception("Database error while updating workshop registration after refund approval.");
            }

            $registrationUpdate->bind_param("i", $registrationId);
            $registrationUpdate->execute();
            $registrationUpdate->close();
        }
    }

    $conn->commit();
} catch (Exception $e) {
    $conn->rollback();

    if (!empty($attachment["absolute_path"]) && file_exists($attachment["absolute_path"])) {
        unlink($attachment["absolute_path"]);
    }

    jsonResponse(500, [
        "success" => false,
        "error" => $e->getMessage()
    ]);
}

$emailSent = sendRefundDecisionEmail(
    $refund["user_email"] ?? "",
    $refund["user_name"] ?? "Customer",
    $refund,
    $action,
    $adminNotes,
    $attachment["absolute_path"],
    $attachment["name"]
);

jsonResponse(200, [
    "success" => true,
    "message" => $action === "approved"
        ? "Refund request approved. Customer email notification was processed."
        : "Refund request rejected. Customer email notification was processed.",
    "refund_id" => $refundId,
    "status" => $action,
    "refund_policy" => "50% of paid amount",
    "refundable_amount" => (float) $refund["refundable_amount"],
    "attachment_uploaded" => !empty($attachment["path"]),
    "email_sent" => $emailSent
]);
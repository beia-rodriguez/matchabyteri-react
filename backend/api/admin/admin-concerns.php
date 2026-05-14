<?php
require_once __DIR__ . "/admin-common-api.php";
require_once __DIR__ . "/../../config/mail.php";
require_once __DIR__ . "/../../../vendor/autoload.php"; 

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// 1. Handle POST Requests (Updates & Replies)
if ($_SERVER["REQUEST_METHOD"] === "POST") {
    $payload = get_json_payload();
    
    // Uncomment this if you are passing csrf_token from frontend:
    // verify_csrf_json($payload, $_SESSION["csrf_token"]);

    $action = $payload["action"] ?? "";
    $cid = (int)($payload["concern_id"] ?? 0);
    $statusPost = trim($payload["status"] ?? "");
    $allowedStatus = ["pending", "in_review", "resolved"];

    if ($cid <= 0 || !in_array($statusPost, $allowedStatus, true)) {
        respond_json(["status" => "error", "error" => "Invalid concern or status update."], 400);
    }

    // -- STATUS UPDATE ONLY --
    if ($action === "set_status") {
        $stmt = $conn->prepare("UPDATE concerns SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $statusPost, $cid);
        
        if ($stmt->execute()) {
            respond_json(["status" => "success", "message" => "Status updated successfully."]);
        } else {
            error_log("admin-concerns set_status DB error: " . $stmt->error);
            respond_json(["status" => "error", "error" => "Failed to update status."], 500);
        }
        $stmt->close();
    }

    // -- REPLY AND STATUS UPDATE --
    if ($action === "reply_concern") {
        $reply = trim($payload["admin_response"] ?? "");
        $emailReply = (bool)($payload["email_reply"] ?? false);
        $adminId = (int)$_SESSION["user_id"];

        if (mb_strlen($reply) < 3) {
            respond_json(["status" => "error", "error" => "Reply is too short."], 400);
        }

        // Fetch concern & user details for emailing
        $stmt = $conn->prepare("
            SELECT c.id, c.subject, c.concern_type, c.booking_id, u.email AS user_email, u.name AS user_name
            FROM concerns c
            INNER JOIN users u ON c.user_id = u.id
            WHERE c.id = ? LIMIT 1
        ");
        $stmt->bind_param("i", $cid);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row) respond_json(["status" => "error", "error" => "Concern not found."], 404);

        // Update Database
        $stmt = $conn->prepare("
            UPDATE concerns 
            SET status = ?, admin_response = ?, responded_at = NOW(), responded_by = ? 
            WHERE id = ?
        ");
        $stmt->bind_param("ssii", $statusPost, $reply, $adminId, $cid);

        if (!$stmt->execute()) {
            error_log("admin-concerns reply_concern DB error: " . $stmt->error);
            respond_json(["status" => "error", "error" => "Failed to save reply."], 500);
        }
        $stmt->close();

        // Optional Email Sending
        if ($emailReply && !empty($row["user_email"])) {
            $mail = new PHPMailer(true);
            try {
                $mail->isSMTP();
                $mail->Host       = MAIL_HOST;
                $mail->SMTPAuth   = true;
                $mail->Username   = MAIL_USERNAME;
                $mail->Password   = MAIL_PASSWORD;
                $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = MAIL_PORT;

                $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
                $mail->addAddress($row["user_email"], $row["user_name"]);

                $mail->isHTML(true);
                $safeSubject = htmlspecialchars($row["subject"], ENT_QUOTES, "UTF-8");
                $safeType = htmlspecialchars($row["concern_type"], ENT_QUOTES, "UTF-8");
                $safeReply = nl2br(htmlspecialchars($reply, ENT_QUOTES, "UTF-8"));
                $bookingStr = empty($row["booking_id"]) ? "" : "<p><strong>Booking ID:</strong> {$row["booking_id"]}</p>";

                $mail->Subject = "Reply to your concern: " . $safeSubject;
                $mail->Body = "
                    <div style='font-family: Arial, sans-serif; line-height:1.5; color:#333;'>
                        <h2 style='color:#2f5d4e;'>We replied to your concern</h2>
                        <p>Hi {$row["user_name"]},</p>
                        <p><strong>Subject:</strong> {$safeSubject}</p>
                        <p><strong>Type:</strong> {$safeType}</p>
                        {$bookingStr}
                        <hr style='border:none; border-top:1px solid #ccc; margin:15px 0;' />
                        <p><strong>Admin Reply:</strong></p>
                        <div style='background:#f9f9f9; border-left:4px solid #2f5d4e; padding:10px;'>
                            {$safeReply}
                        </div>
                        <p style='font-size:12px; color:#888; margin-top:20px;'>
                            You can also view this by logging into your account.
                        </p>
                    </div>
                ";
                
                $mail->send();
                respond_json(["status" => "success", "message" => "Reply saved and emailed successfully."]);
            } catch (Exception $e) {
                error_log("Mailer Error (Concerns): " . $mail->ErrorInfo);
                respond_json(["status" => "success", "message" => "Reply saved, but email failed to send."]); // Still a success since DB saved
            }
        } else {
            respond_json(["status" => "success", "message" => "Reply saved successfully (No email sent)."]);
        }
    }
}

// 2. Handle GET Requests (Fetch List & Counts)
if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $status = trim($_GET["status"] ?? "all");
    $q = trim($_GET["q"] ?? "");
    $limit = min(max((int)($_GET["limit"] ?? 80), 1), 200);

    // Get Counts
    $counts = ["all" => 0, "pending" => 0, "in_review" => 0, "resolved" => 0];
    $countStmt = $conn->prepare("SELECT status, COUNT(*) as c FROM concerns GROUP BY status");
    $countStmt->execute();
    $res = $countStmt->get_result();
    while ($r = $res->fetch_assoc()) {
        $counts[$r["status"]] = (int)$r["c"];
        $counts["all"] += (int)$r["c"];
    }
    $countStmt->close();

    // Build Query
    $query = "
        SELECT c.*, u.name AS user_name, u.email AS user_email 
        FROM concerns c 
        LEFT JOIN users u ON c.user_id = u.id 
        WHERE 1=1
    ";
    $types = "";
    $params = [];

    if ($status !== "all" && in_array($status, ["pending", "in_review", "resolved"])) {
        $query .= " AND c.status = ?";
        $types .= "s";
        $params[] = $status;
    }

    if ($q !== "") {
        $query .= " AND (c.subject LIKE ? OR c.details LIKE ? OR u.name LIKE ? OR u.email LIKE ?)";
        $like = "%{$q}%";
        $types .= "ssss";
        array_push($params, $like, $like, $like, $like);
    }

    $query .= " ORDER BY c.created_at DESC LIMIT ?";
    $types .= "i";
    $params[] = $limit;

    $stmt = $conn->prepare($query);
    if ($types) {
        $stmt->bind_param($types, ...$params);
    }
    $stmt->execute();
    $result = $stmt->get_result();

    $concerns = [];
    while ($row = $result->fetch_assoc()) {
        $concerns[] = $row;
    }
    $stmt->close();

    respond_json([
        "status" => "success",
        "counts" => $counts,
        "concerns" => $concerns
    ]);
}
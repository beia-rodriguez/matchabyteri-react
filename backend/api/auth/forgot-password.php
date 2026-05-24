<?php
session_start();

header("Content-Type: application/json");

require_once "../../config/db.php";
require_once "./mailer.php";

function respond($status, $message = "") {
    echo json_encode([
        "status" => $status,
        "message" => $message
    ]);
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond("error", "Invalid request method.");
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond("error", "Invalid request data.");
}

$email = strtolower(trim($data["email"] ?? ""));

if (!$email) {
    respond("error", "Email is required.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond("error", "Invalid email address.");
}

$sessionKey = "password_reset_last_sent_" . hash("sha256", $email);
$lastSent = (int)($_SESSION[$sessionKey] ?? 0);

if ($lastSent > 0 && (time() - $lastSent) < 60) {
    respond("error", "Please wait before requesting another code.");
}

$stmt = $conn->prepare("
    SELECT id, name, email, status
    FROM users
    WHERE email = ?
    LIMIT 1
");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("s", $email);
$stmt->execute();

$result = $stmt->get_result();

/*
  Generic success prevents people from checking which emails exist.
*/
if ($result->num_rows !== 1) {
    $_SESSION[$sessionKey] = time();
    respond("success", "If that email exists, a password reset code has been sent.");
}

$user = $result->fetch_assoc();

if ($user["status"] !== "active") {
    $_SESSION[$sessionKey] = time();
    respond("success", "If that email exists, a password reset code has been sent.");
}

$otp = (string)random_int(100000, 999999);
$otpHash = hash("sha256", $otp);
$expires = date("Y-m-d H:i:s", strtotime("+10 minutes"));

$update = $conn->prepare("
    UPDATE users
    SET reset_token = ?, reset_expires = ?
    WHERE id = ?
");

if (!$update) {
    respond("error", "Server error.");
}

$update->bind_param("ssi", $otpHash, $expires, $user["id"]);

if (!$update->execute()) {
    respond("error", "Could not create password reset code.");
}

$emailSent = sendPasswordResetOtpEmail($email, $user["name"], $otp);

if (!$emailSent) {
    respond("error", "Could not send password reset email. Please try again.");
}

$_SESSION[$sessionKey] = time();

$stmt->close();
$update->close();
$conn->close();

respond("success", "If that email exists, a password reset code has been sent.");

<?php
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
    respond("success", "If that email exists, a password reset link has been sent.");
}

$user = $result->fetch_assoc();

if ($user["status"] !== "active") {
    respond("success", "If that email exists, a password reset link has been sent.");
}

$token = bin2hex(random_bytes(32));
$expires = date("Y-m-d H:i:s", strtotime("+1 hour"));

$update = $conn->prepare("
    UPDATE users
    SET reset_token = ?, reset_expires = ?
    WHERE id = ?
");

if (!$update) {
    respond("error", "Server error.");
}

$update->bind_param("ssi", $token, $expires, $user["id"]);

if (!$update->execute()) {
    respond("error", "Could not create password reset link.");
}

$emailSent = sendPasswordResetEmail($email, $user["name"], $token);

if (!$emailSent) {
    respond("error", "Could not send password reset email. Please try again.");
}

$stmt->close();
$update->close();
$conn->close();

respond("success", "If that email exists, a password reset link has been sent.");
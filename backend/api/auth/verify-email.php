<?php
header("Content-Type: application/json");
require_once "../../config/db.php";

function respond($status, $message = "", $extra = []) {
    echo json_encode(array_merge([
        "status" => $status,
        "message" => $message
    ], $extra));
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    respond("error", "Invalid request method.");
}

$token = trim($_GET["token"] ?? "");

if (!$token) {
    respond("error", "Verification token is required.");
}

if (!preg_match("/^[a-f0-9]{64}$/", $token)) {
    respond("error", "Invalid verification token.");
}

$stmt = $conn->prepare("
    SELECT id, email_verified
    FROM users
    WHERE verification_token = ?
    LIMIT 1
");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("s", $token);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    respond("error", "Invalid or expired verification link.");
}

$user = $result->fetch_assoc();

if ((int)$user["email_verified"] === 1) {
    respond("success", "Your email is already verified.");
}

$update = $conn->prepare("
    UPDATE users
    SET 
        email_verified = 1,
        verification_token = NULL
    WHERE id = ?
");

if (!$update) {
    respond("error", "Server error.");
}

$update->bind_param("i", $user["id"]);

if (!$update->execute()) {
    respond("error", "Could not verify your email. Please try again.");
}

$stmt->close();
$update->close();
$conn->close();

respond("success", "Email verified successfully. You may now log in.");
<?php
header("Content-Type: application/json");
require_once "../../config/db.php";

function respond($status, $message = "") {
    echo json_encode([
        "status" => $status,
        "message" => $message
    ]);
    exit;
}

function validatePassword($password) {
    if (strlen($password) < 8) return "Password must be at least 8 characters long.";
    if (!preg_match("/[A-Z]/", $password)) return "Password must include at least one uppercase letter.";
    if (!preg_match("/[a-z]/", $password)) return "Password must include at least one lowercase letter.";
    if (!preg_match("/[0-9]/", $password)) return "Password must include at least one number.";
    if (!preg_match("/[\W_]/", $password)) return "Password must include at least one special character.";
    return "";
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond("error", "Invalid request method.");
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond("error", "Invalid request data.");
}

$token = trim($data["token"] ?? "");
$password = $data["password"] ?? "";
$confirm = $data["confirm_password"] ?? "";

if (!$token || !$password || !$confirm) {
    respond("error", "Please fill in all required fields.");
}

if (!preg_match("/^[a-f0-9]{64}$/", $token)) {
    respond("error", "Invalid or expired reset link.");
}

if ($password !== $confirm) {
    respond("error", "Passwords do not match.");
}

$passwordError = validatePassword($password);
if ($passwordError) {
    respond("error", $passwordError);
}

$stmt = $conn->prepare("
    SELECT id, reset_expires
    FROM users
    WHERE reset_token = ?
    LIMIT 1
");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("s", $token);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    respond("error", "Invalid or expired reset link.");
}

$user = $result->fetch_assoc();

if (!$user["reset_expires"] || strtotime($user["reset_expires"]) < time()) {
    respond("error", "This reset link has expired. Please request a new one.");
}

$hashed = password_hash($password, PASSWORD_DEFAULT);

$update = $conn->prepare("
    UPDATE users
    SET 
        password = ?,
        reset_token = NULL,
        reset_expires = NULL
    WHERE id = ?
");

if (!$update) {
    respond("error", "Server error.");
}

$update->bind_param("si", $hashed, $user["id"]);

if (!$update->execute()) {
    respond("error", "Could not reset password. Please try again.");
}

$stmt->close();
$update->close();
$conn->close();

respond("success", "Password reset successfully. You may now log in.");
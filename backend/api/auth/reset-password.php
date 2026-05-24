<?php
header("Content-Type: application/json; charset=utf-8");

require_once "../../config/db.php";

function respond($status, $message = "", $httpCode = 200) {
    http_response_code($httpCode);
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
    respond("error", "Invalid request method.", 405);
}

$data = json_decode(file_get_contents("php://input"), true);

if (!is_array($data)) {
    respond("error", "Invalid request data.", 400);
}

$email = strtolower(trim($data["email"] ?? ""));
$otp = preg_replace("/\D/", "", trim((string)($data["otp"] ?? "")));
$password = (string)($data["password"] ?? "");
$confirm = (string)($data["confirm_password"] ?? "");

if ($email === "") {
    respond("error", "Email is required.", 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond("error", "Invalid email address.", 422);
}

if (!preg_match("/^\d{6}$/", $otp)) {
    respond("error", "Please enter the complete 6-digit reset code.", 422);
}

if ($password === "" || $confirm === "") {
    respond("error", "Please fill in the new password and confirm password.", 422);
}

if ($password !== $confirm) {
    respond("error", "Passwords do not match.", 422);
}

$passwordError = validatePassword($password);

if ($passwordError) {
    respond("error", $passwordError, 422);
}

$otpHash = hash("sha256", $otp);

$stmt = $conn->prepare("
    SELECT id, status, reset_expires
    FROM users
    WHERE email = ?
      AND reset_token = ?
    LIMIT 1
");

if (!$stmt) {
    respond("error", "Server error.", 500);
}

$stmt->bind_param("ss", $email, $otpHash);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    $stmt->close();
    respond("error", "Invalid or expired reset code.", 422);
}

$user = $result->fetch_assoc();
$stmt->close();

if (($user["status"] ?? "") !== "active") {
    respond("error", "This account is not active.", 403);
}

if (!$user["reset_expires"] || strtotime($user["reset_expires"]) < time()) {
    respond("error", "This reset code has expired. Please request a new one.", 422);
}

$hashed = password_hash($password, PASSWORD_DEFAULT);

$update = $conn->prepare("
    UPDATE users
    SET
        password = ?,
        reset_token = NULL,
        reset_expires = NULL
    WHERE id = ?
    LIMIT 1
");

if (!$update) {
    respond("error", "Server error.", 500);
}

$update->bind_param("si", $hashed, $user["id"]);

if (!$update->execute()) {
    $update->close();
    respond("error", "Could not reset password. Please try again.", 500);
}

$update->close();
$conn->close();

respond("success", "Password reset successfully. You may now log in.");

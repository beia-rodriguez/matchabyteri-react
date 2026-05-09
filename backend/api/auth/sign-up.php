<?php
header("Content-Type: application/json");

require_once "../../config/db.php";
require_once "./mailer.php";

function respond($status, $message = "", $extra = []) {
    echo json_encode(array_merge([
        "status" => $status,
        "message" => $message
    ], $extra));
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

$name = trim($data["name"] ?? "");
$email = strtolower(trim($data["email"] ?? ""));

$password = $data["password"] ?? "";
$confirm = $data["confirm_password"] ?? "";

if (!$name || !$email || !$password || !$confirm) {
    respond("error", "Please fill in all required fields.");
}

if (strlen($name) < 2 || strlen($name) > 100) {
    respond("error", "Full name must be between 2 and 100 characters.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond("error", "Invalid email address.");
}

if ($password !== $confirm) {
    respond("error", "Passwords do not match.");
}

$passwordError = validatePassword($password);
if ($passwordError) {
    respond("error", $passwordError);
}

$check = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");

if (!$check) {
    respond("error", "Server error.");
}

$check->bind_param("s", $email);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    $check->close();
    respond("error", "This email is already registered.");
}

$check->close();

$hashed = password_hash($password, PASSWORD_DEFAULT);
$verificationToken = bin2hex(random_bytes(32));

$stmt = $conn->prepare("
    INSERT INTO users 
        (name, email, password, role, status, email_verified, verification_token)
    VALUES 
        (?, ?, ?, 'user', 'active', 0, ?)
");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("ssss", $name, $email, $hashed, $verificationToken);

if (!$stmt->execute()) {
    $stmt->close();
    respond("error", "Something went wrong while creating your account.");
}

$newUserId = $stmt->insert_id;
$stmt->close();

$emailSent = sendVerificationEmail($email, $name, $verificationToken);

if (!$emailSent) {
    $delete = $conn->prepare("DELETE FROM users WHERE id = ?");
    if ($delete) {
        $delete->bind_param("i", $newUserId);
        $delete->execute();
        $delete->close();
    }

    $conn->close();

    respond(
        "error",
        "Could not send verification email. Please check your email address or try again later."
    );
}

$conn->close();

respond("success", "Account created successfully. Please check your email to verify your account.");
<?php
header("Content-Type: application/json");
require_once "../../config/db.php";

function validatePassword($password) {
    if (strlen($password) < 8) return "Password must be at least 8 characters long.";
    if (!preg_match("/[A-Z]/", $password)) return "Password must include at least one uppercase letter.";
    if (!preg_match("/[a-z]/", $password)) return "Password must include at least one lowercase letter.";
    if (!preg_match("/[0-9]/", $password)) return "Password must include at least one number.";
    if (!preg_match("/[\W_]/", $password)) return "Password must include at least one special character.";
    return "";
}

$data = json_decode(file_get_contents("php://input"), true);

$name = trim($data["name"] ?? "");
$email = trim($data["email"] ?? "");
$password = trim($data["password"] ?? "");
$confirm = trim($data["confirm_password"] ?? "");

if (!$name || !$email || !$password || !$confirm) {
    echo json_encode(["status" => "error", "message" => "Please fill in all required fields."]);
    exit;
}

if ($password !== $confirm) {
    echo json_encode(["status" => "error", "message" => "Passwords do not match."]);
    exit;
}

$passwordError = validatePassword($password);
if ($passwordError) {
    echo json_encode(["status" => "error", "message" => $passwordError]);
    exit;
}

$check = $conn->prepare("SELECT id FROM users WHERE email = ?");
$check->bind_param("s", $email);
$check->execute();
$check->store_result();

if ($check->num_rows > 0) {
    echo json_encode(["status" => "error", "message" => "This email is already registered."]);
    exit;
}

$hashed = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare("
    INSERT INTO users (name, email, password, role, status)
    VALUES (?, ?, ?, 'user', 'active')
");
$stmt->bind_param("sss", $name, $email, $hashed);

if ($stmt->execute()) {
    echo json_encode(["status" => "success"]);
} else {
    echo json_encode(["status" => "error", "message" => "Something went wrong."]);
}
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

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond("error", "Invalid request method.");
}

$email = strtolower(trim($_POST["email"] ?? ""));

if (!$email) {
    respond("error", "Email is required.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond("invalid", "Invalid email format.");
}

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    respond("taken", "Email already exists.");
}

respond("available", "Email available.");
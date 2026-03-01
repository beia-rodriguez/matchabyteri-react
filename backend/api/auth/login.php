<?php
session_start();
require_once "../../config/db.php";

header("Content-Type: application/json");

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    echo json_encode(["status" => "error", "message" => "Invalid request method"]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);

$email = trim($data["email"] ?? "");
$password = trim($data["password"] ?? "");

if (empty($email) || empty($password)) {
    echo json_encode(["status" => "error", "message" => "Please fill in all fields."]);
    exit;
}

$stmt = $conn->prepare("
    SELECT id, name, email, password, role, status, profile_picture
    FROM users
    WHERE email = ?
");
$stmt->bind_param("s", $email);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows !== 1) {
    echo json_encode(["status" => "error", "message" => "No user found with that email."]);
    exit;
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user["password"])) {
    echo json_encode(["status" => "error", "message" => "Invalid password."]);
    exit;
}

/* 🔥 CREATE SESSION HERE */
$_SESSION["user_id"] = $user["id"];
$_SESSION["role"] = $user["role"];

unset($user["password"]);

echo json_encode([
    "status" => "success",
    "user" => $user
]);
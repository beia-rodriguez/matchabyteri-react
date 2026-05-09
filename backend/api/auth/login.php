<?php
session_start();

header("Content-Type: application/json");
require_once "../../config/db.php";

function respond($status, $message = "", $extra = []) {
    echo json_encode(array_merge([
        "status" => $status,
        "message" => $message
    ], $extra));
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

/*
  Do not trim password.
  Password spaces may be intentional.
*/
$password = $data["password"] ?? "";

if (!$email || !$password) {
    respond("error", "Please fill in all fields.");
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond("error", "Invalid email or password.");
}

$stmt = $conn->prepare("
    SELECT 
        id,
        name,
        email,
        password,
        role,
        status,
        email_verified,
        profile_picture
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

if ($result->num_rows !== 1) {
    respond("error", "Invalid email or password.");
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user["password"])) {
    respond("error", "Invalid email or password.");
}

if ($user["status"] !== "active") {
    respond("error", "Your account is not active.");
}

if ((int)$user["email_verified"] !== 1) {
    respond("error", "Please verify your email before logging in.");
}

session_regenerate_id(true);

$_SESSION["user_id"] = (int)$user["id"];
$_SESSION["role"] = $user["role"];

unset($user["password"]);
$user["id"] = (int)$user["id"];
$user["email_verified"] = (int)$user["email_verified"];

$stmt->close();
$conn->close();

respond("success", "Login successful.", [
    "user" => $user
]);
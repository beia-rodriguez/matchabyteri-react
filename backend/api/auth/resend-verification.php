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
    SELECT id, name, email_verified
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
    /*
      Generic message prevents account enumeration.
    */
    respond("success", "If this email exists and is not verified, a verification link has been sent.");
}

$user = $result->fetch_assoc();

if ((int)$user["email_verified"] === 1) {
    respond("error", "This email is already verified. You may log in.");
}

$newToken = bin2hex(random_bytes(32));

$update = $conn->prepare("
    UPDATE users
    SET verification_token = ?
    WHERE id = ?
");

if (!$update) {
    respond("error", "Server error.");
}

$update->bind_param("si", $newToken, $user["id"]);

if (!$update->execute()) {
    respond("error", "Could not create a new verification link.");
}

$emailSent = sendVerificationEmail($email, $user["name"], $newToken);

if (!$emailSent) {
    respond("error", "Could not send verification email. Please try again.");
}

$stmt->close();
$update->close();
$conn->close();

respond("success", "Verification email sent. Please check your inbox.");
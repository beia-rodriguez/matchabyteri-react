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

/*
  User not logged in.
*/
if (!isset($_SESSION["user_id"])) {
    respond("error", "Not authenticated.");
}

$userId = (int) $_SESSION["user_id"];

$stmt = $conn->prepare("
    SELECT
        id,
        name,
        email,
        role,
        status,
        email_verified,
        profile_picture
    FROM users
    WHERE id = ?
    LIMIT 1
");

if (!$stmt) {
    respond("error", "Server error.");
}

$stmt->bind_param("i", $userId);
$stmt->execute();

$result = $stmt->get_result();

if ($result->num_rows !== 1) {

    /*
      Session exists but user no longer exists.
    */
    session_unset();
    session_destroy();

    respond("error", "User not found.");
}

$user = $result->fetch_assoc();

/*
  Prevent inactive users from continuing sessions.
*/
if ($user["status"] !== "active") {

    session_unset();
    session_destroy();

    respond("error", "Account is inactive.");
}

$user["id"] = (int)$user["id"];
$user["email_verified"] = (int)$user["email_verified"];

$stmt->close();
$conn->close();

respond("success", "Authenticated.", [
    "user" => $user
]);
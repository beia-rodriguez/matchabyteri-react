<?php
session_start();

header("Content-Type: application/json");

/*
  Clear all session variables.
*/
$_SESSION = [];

/*
  Remove session cookie if it exists.
*/
if (ini_get("session.use_cookies")) {

    $params = session_get_cookie_params();

    setcookie(
        session_name(),
        '',
        time() - 42000,
        $params["path"],
        $params["domain"],
        $params["secure"],
        $params["httponly"]
    );
}

/*
  Destroy the session.
*/
session_destroy();

echo json_encode([
    "status" => "success",
    "message" => "Logged out successfully."
]);
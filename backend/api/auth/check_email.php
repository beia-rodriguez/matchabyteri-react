<?php
require_once "../../config/db.php";


$email = $_POST["email"] ?? "";

$stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->store_result();

if ($stmt->num_rows > 0) {
    echo "taken";
} else {
    echo "available";
}
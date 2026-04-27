<?php
session_start();
require_once __DIR__ . "/../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$id = (int)$_SESSION["user_id"];

$name = trim($_POST["name"] ?? "");
$phone = trim($_POST["phone_number"] ?? "");
$birthdate = trim($_POST["birthdate"] ?? "");

if ($name === "") {
    echo json_encode(["error" => "Name required"]);
    exit();
}

$stmt = $conn->prepare("SELECT profile_picture FROM users WHERE id=?");
$stmt->bind_param("i", $id);
$stmt->execute();
$current = $stmt->get_result()->fetch_assoc();
$stmt->close();

$profilePath = $current["profile_picture"] ?? "";

/* IMAGE UPLOAD */
if (!empty($_FILES["profile_picture"]["name"])) {

    $folder = __DIR__ . "/../../uploads/";
    if (!is_dir($folder)) {
        mkdir($folder, 0777, true);
    }

    $tmp = $_FILES["profile_picture"]["tmp_name"];
    $ext = strtolower(pathinfo($_FILES["profile_picture"]["name"], PATHINFO_EXTENSION));
    $allowed = ["jpg","jpeg","png","gif"];

    if (!in_array($ext, $allowed)) {
        echo json_encode(["error" => "Invalid image format"]);
        exit();
    }

    $newName = "profile_" . $id . "_" . time() . "." . $ext;
    $target = $folder . $newName;

    if (move_uploaded_file($tmp, $target)) {
        $profilePath = "uploads/" . $newName;
    }
}

$stmt = $conn->prepare("
  UPDATE users
  SET name=?, phone_number=?, birthdate=?, profile_picture=?
  WHERE id=?
");
$stmt->bind_param("ssssi", $name, $phone, $birthdate, $profilePath, $id);
$stmt->execute();
$stmt->close();

echo json_encode([
    "success" => true,
    "profile_picture" => $profilePath
]);
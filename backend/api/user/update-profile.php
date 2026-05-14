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
    echo json_encode(["error" => "Name is required."]);
    exit();
}

// Fetch current user data
$stmt = $conn->prepare("SELECT profile_picture FROM users WHERE id = ?");
$stmt->bind_param("i", $id);
$stmt->execute();
$current = $stmt->get_result()->fetch_assoc();
$stmt->close();

$oldProfilePath = $current['profile_picture'] ?? "";
$newProfilePath = $oldProfilePath;
$uploadedNew = false;

// IMAGE UPLOAD LOGIC
if (isset($_FILES["profile_picture"]) && !empty($_FILES["profile_picture"]["name"])) {
    $tmpName  = $_FILES["profile_picture"]["tmp_name"];
    $origName = $_FILES["profile_picture"]["name"];
    $fileSize = $_FILES["profile_picture"]["size"];
    $fileError = $_FILES["profile_picture"]["error"];

    if ($fileError !== UPLOAD_ERR_OK) {
        echo json_encode(["error" => "Upload failed with error code " . $fileError]);
        exit();
    }

    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowedExt = ["jpg", "jpeg", "png", "gif"];
    
    $info = @getimagesize($tmpName);
    if ($info === false || !in_array($ext, $allowedExt, true)) {
        echo json_encode(["error" => "Invalid image format. Only JPG, PNG, and GIF allowed."]);
        exit();
    }

    if ($fileSize > 3 * 1024 * 1024) {
        echo json_encode(["error" => "Image size must be less than 3MB."]);
        exit();
    }

    // Explicitly target your actual uploads folder
    $absoluteFolder = dirname(__DIR__) . "/uploads/"; 

    if (!is_dir($absoluteFolder)) {
        @mkdir($absoluteFolder, 0755, true);
    }

    $safeName = "profile_" . $id . "_" . time() . "." . $ext;
    $relativeTarget = "uploads/" . $safeName;
    $absoluteTarget = $absoluteFolder . $safeName;

    if (move_uploaded_file($tmpName, $absoluteTarget)) {
        $newProfilePath = $relativeTarget;
        $uploadedNew = true;
    } else {
        echo json_encode(["error" => "Failed to move file to storage folder. Check write permissions."]);
        exit();
    }
}

// Database Update
$stmt = $conn->prepare("UPDATE users SET name=?, phone_number=?, birthdate=?, profile_picture=? WHERE id=?");
$stmt->bind_param("ssssi", $name, $phone, $birthdate, $newProfilePath, $id);

if ($stmt->execute()) {
    $stmt->close();

    // Clean up old physical file if changed
    if ($uploadedNew && $oldProfilePath && $oldProfilePath !== $newProfilePath) {
        $oldAbs = dirname(__DIR__) . "/" . $oldProfilePath;
        if (file_exists($oldAbs)) {
            @unlink($oldAbs);
        }
    }

    echo json_encode([
        "success" => true,
        "profile_picture" => $newProfilePath
    ]);
} else {
    echo json_encode(["error" => "Database update failed: " . $conn->error]);
}
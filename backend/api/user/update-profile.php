<?php
session_start();
require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

function json_response($payload, $status = 200) {
    http_response_code($status);
    echo json_encode($payload);
    exit();
}

function clean_text($value) {
    return trim((string)$value);
}

function valid_birthdate($value) {
    if ($value === "") return true;

    if (!preg_match("/^\d{4}-\d{2}-\d{2}$/", $value)) {
        return false;
    }

    $dt = DateTime::createFromFormat("Y-m-d", $value);
    if (!$dt || $dt->format("Y-m-d") !== $value) {
        return false;
    }

    $today = new DateTime("today");

    return $dt <= $today;
}

function normalize_ph_phone($value) {
    $value = preg_replace("/\s+/", "", trim((string)$value));

    if ($value === "") {
        return "";
    }

    if (preg_match("/^09\d{9}$/", $value)) {
        return "+63" . substr($value, 1);
    }

    if (preg_match("/^9\d{9}$/", $value)) {
        return "+63" . $value;
    }

    if (preg_match("/^\+639\d{9}$/", $value)) {
        return $value;
    }

    return null;
}

function absolute_upload_path($relativePath) {
    return dirname(__DIR__) . "/" . ltrim((string)$relativePath, "/");
}

if (!isset($_SESSION["user_id"])) {
    json_response(["error" => "Unauthorized"], 401);
}

$id = (int)$_SESSION["user_id"];

$input = $_POST;

if (empty($input)) {
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (is_array($json)) {
        $input = $json;
    }
}

$stmt = $conn->prepare("SELECT id, name, phone_number, birthdate, profile_picture FROM users WHERE id = ? LIMIT 1");

if (!$stmt) {
    json_response(["error" => "Database prepare failed."], 500);
}

$stmt->bind_param("i", $id);
$stmt->execute();
$current = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$current) {
    json_response(["error" => "User not found."], 404);
}

/*
  Partial-safe update:
  If a field is not sent, keep the current database value.
  This allows the frontend or future pages to update only name, only phone,
  only birthdate, or only photo without resending every field.
*/
$name = array_key_exists("name", $input)
    ? clean_text($input["name"])
    : clean_text($current["name"] ?? "");

$phoneRaw = array_key_exists("phone_number", $input)
    ? clean_text($input["phone_number"])
    : clean_text($current["phone_number"] ?? "");

$birthdate = array_key_exists("birthdate", $input)
    ? clean_text($input["birthdate"])
    : clean_text($current["birthdate"] ?? "");

$phone = normalize_ph_phone($phoneRaw);

if ($name === "") {
    json_response(["error" => "Name is required."], 422);
}

if (mb_strlen($name) > 120) {
    json_response(["error" => "Name must be 120 characters or less."], 422);
}

if ($phone === null) {
    json_response(["error" => "Contact number must be a Philippine mobile number. Example: +639123456789."], 422);
}

if (!valid_birthdate($birthdate)) {
    json_response(["error" => "Birthdate must be a valid date and cannot be in the future."], 422);
}

$oldProfilePath = $current["profile_picture"] ?? "";
$newProfilePath = $oldProfilePath;
$uploadedNew = false;

if (isset($_FILES["profile_picture"]) && !empty($_FILES["profile_picture"]["name"])) {
    $tmpName = $_FILES["profile_picture"]["tmp_name"] ?? "";
    $origName = $_FILES["profile_picture"]["name"] ?? "";
    $fileSize = (int)($_FILES["profile_picture"]["size"] ?? 0);
    $fileError = (int)($_FILES["profile_picture"]["error"] ?? UPLOAD_ERR_NO_FILE);

    if ($fileError !== UPLOAD_ERR_OK) {
        json_response(["error" => "Upload failed. Please choose another image."], 422);
    }

    if ($tmpName === "" || !is_uploaded_file($tmpName)) {
        json_response(["error" => "Invalid upload."], 422);
    }

    if ($fileSize <= 0 || $fileSize > 3 * 1024 * 1024) {
        json_response(["error" => "Image size must be less than 3MB."], 422);
    }

    $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
    $allowedExt = ["jpg", "jpeg", "png", "gif", "webp"];
    $allowedMime = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    $info = @getimagesize($tmpName);
    $mime = $info["mime"] ?? "";

    if ($info === false || !in_array($ext, $allowedExt, true) || !in_array($mime, $allowedMime, true)) {
        json_response(["error" => "Invalid image format. Only JPG, PNG, GIF, and WEBP are allowed."], 422);
    }

    $absoluteFolder = dirname(__DIR__) . "/uploads/";

    if (!is_dir($absoluteFolder) && !@mkdir($absoluteFolder, 0755, true)) {
        json_response(["error" => "Upload folder is not available."], 500);
    }

    $safeName = "profile_" . $id . "_" . time() . "_" . bin2hex(random_bytes(4)) . "." . $ext;
    $relativeTarget = "uploads/" . $safeName;
    $absoluteTarget = $absoluteFolder . $safeName;

    if (!move_uploaded_file($tmpName, $absoluteTarget)) {
        json_response(["error" => "Failed to save profile photo."], 500);
    }

    $newProfilePath = $relativeTarget;
    $uploadedNew = true;
}

$stmt = $conn->prepare("
    UPDATE users
    SET name = ?, phone_number = ?, birthdate = ?, profile_picture = ?
    WHERE id = ?
");

if (!$stmt) {
    if ($uploadedNew && $newProfilePath) {
        @unlink(absolute_upload_path($newProfilePath));
    }

    json_response(["error" => "Database prepare failed."], 500);
}

$stmt->bind_param("ssssi", $name, $phone, $birthdate, $newProfilePath, $id);

if (!$stmt->execute()) {
    $error = $stmt->error;
    $stmt->close();

    if ($uploadedNew && $newProfilePath) {
        @unlink(absolute_upload_path($newProfilePath));
    }

    error_log("update-profile failed: " . $error);
    json_response(["error" => "Database update failed."], 500);
}

$stmt->close();

if ($uploadedNew && $oldProfilePath && $oldProfilePath !== $newProfilePath) {
    $oldAbs = absolute_upload_path($oldProfilePath);

    if (str_starts_with($oldProfilePath, "uploads/") && file_exists($oldAbs)) {
        @unlink($oldAbs);
    }
}

json_response([
    "success" => true,
    "message" => "Profile updated successfully.",
    "name" => $name,
    "phone_number" => $phone,
    "birthdate" => $birthdate,
    "profile_picture" => $newProfilePath
]);

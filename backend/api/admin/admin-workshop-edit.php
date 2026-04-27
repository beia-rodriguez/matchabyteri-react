<?php
require_once __DIR__ . "/admin-common-api.php";

function clean_date($s){
  $s = trim((string)$s);
  return preg_match("/^\d{4}-\d{2}-\d{2}$/", $s) ? $s : "";
}

function clean_time($s){
  $s = trim((string)$s);
  return preg_match("/^\d{2}:\d{2}$/", $s) ? $s : "";
}

function time_to_db($hhmm){
  return ($hhmm === "") ? null : ($hhmm . ":00");
}

function time_after($start_hhmm, $end_hhmm){
  if ($start_hhmm === "" || $end_hhmm === "") return true;
  return strtotime("1970-01-01 {$end_hhmm}:00") > strtotime("1970-01-01 {$start_hhmm}:00");
}

function ensure_upload_dir($dir){
  if (!is_dir($dir)) {
    @mkdir($dir, 0755, true);
  }
}

function absolute_upload_path($relativePath){
  return dirname(__DIR__) . "/" . ltrim($relativePath, "/");
}

function validate_and_save_image($field, &$outPath, &$outErr){
  $outPath = "";
  $outErr = "";

  if (empty($_FILES[$field]["name"])) {
    $outErr = "No file selected.";
    return false;
  }

  $tmpName  = $_FILES[$field]["tmp_name"] ?? "";
  $fileSize = (int)($_FILES[$field]["size"] ?? 0);
  $origName = (string)($_FILES[$field]["name"] ?? "");

  if ($tmpName === "" || !is_uploaded_file($tmpName)) {
    $outErr = "Invalid upload.";
    return false;
  }

  $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
  $allowedExt  = ["jpg","jpeg","png","gif","webp"];
  $allowedMime = ["image/jpeg","image/png","image/gif","image/webp"];

  $info = @getimagesize($tmpName);
  if ($info === false) {
    $outErr = "Invalid image file.";
    return false;
  }

  $mime = $info["mime"] ?? "";
  if (!in_array($ext, $allowedExt, true) || !in_array($mime, $allowedMime, true)) {
    $outErr = "Only JPG, PNG, GIF, or WEBP images are allowed.";
    return false;
  }

  if ($fileSize <= 0 || $fileSize > 3 * 1024 * 1024) {
    $outErr = "Image size must be less than 3MB.";
    return false;
  }

  $relativeFolder = "uploads/workshops/";
  $absoluteFolder = dirname(__DIR__) . "/" . $relativeFolder;

  ensure_upload_dir($absoluteFolder);

  $safeName = "workshop_" . time() . "_" . bin2hex(random_bytes(6)) . "." . $ext;
  $relativeTarget = $relativeFolder . $safeName;
  $absoluteTarget = $absoluteFolder . $safeName;

  if (!move_uploaded_file($tmpName, $absoluteTarget)) {
    $outErr = "Failed to upload poster image.";
    return false;
  }

  $outPath = $relativeTarget;
  return true;
}

function get_reg_count($conn, $id){
  $count = 0;

  $stmt = $conn->prepare("SELECT COUNT(*) c FROM workshop_registrations WHERE workshop_id=?");
  if ($stmt) {
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $count = (int)($row["c"] ?? 0);
  }

  return $count;
}

/* -------------------- load workshop -------------------- */
$id = (int)($_GET["id"] ?? $_POST["id"] ?? 0);

if ($id <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid workshop id."]);
  exit();
}

$stmt = $conn->prepare("SELECT * FROM workshops_public WHERE id=? LIMIT 1");
$stmt->bind_param("i", $id);
$stmt->execute();
$workshop = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$workshop) {
  http_response_code(404);
  echo json_encode(["error" => "Workshop not found."]);
  exit();
}

/* -------------------- GET -------------------- */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $regCount = get_reg_count($conn, $id);

  echo json_encode([
    "success" => true,
    "csrf" => $csrf,
    "workshop" => $workshop,
    "regCount" => $regCount
  ]);
  exit();
}

/* -------------------- POST -------------------- */
if ($_SERVER["REQUEST_METHOD"] === "POST") {
  if (!hash_equals($csrf, $_POST["csrf_token"] ?? "")) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request (CSRF)."]);
    exit();
  }

  $action = (string)($_POST["action"] ?? "");
  $regCount = get_reg_count($conn, $id);

  if ($action === "delete_workshop") {
    if ($regCount > 0) {
      echo json_encode([
        "error" => "Cannot delete: this workshop has {$regCount} registration(s). Set it to Hidden instead."
      ]);
      exit();
    }

    $poster = (string)($workshop["poster_path"] ?? "");

    $stmt = $conn->prepare("DELETE FROM workshops_public WHERE id=? LIMIT 1");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
      $stmt->close();

      if ($poster) {
        $posterAbs = absolute_upload_path($poster);
        if (file_exists($posterAbs)) {
          @unlink($posterAbs);
        }
      }

      echo json_encode([
        "success" => true,
        "message" => "Workshop deleted."
      ]);
      exit();
    } else {
      $e = $stmt->error;
      $stmt->close();
      error_log("delete_workshop error: " . $e);

      echo json_encode([
        "error" => "Failed to delete workshop."
      ]);
      exit();
    }
  }

  if ($action === "update_workshop") {
    $title = trim($_POST["title"] ?? "");
    $description = trim($_POST["description"] ?? "");
    $register_points = trim($_POST["register_points"] ?? "");
    $standard_points = trim($_POST["standard_points"] ?? "");
    $premium_points  = trim($_POST["premium_points"] ?? "");

    $workshop_date = clean_date($_POST["workshop_date"] ?? "");
    $start_time = clean_time($_POST["start_time"] ?? "");
    $end_time = clean_time($_POST["end_time"] ?? "");
    $location = trim($_POST["location"] ?? "");
    $is_active = (int)(($_POST["is_active"] ?? "0") === "1");
    $max_slots = max(0, (int)($_POST["max_slots"] ?? 0));

    if ($title === "" || $description === "" || $workshop_date === "" || $start_time === "" || $location === "") {
      echo json_encode([
        "error" => "Please fill in Title, Description, Date, Start Time, and Location."
      ]);
      exit();
    }

    if ($end_time !== "" && !time_after($start_time, $end_time)) {
      echo json_encode([
        "error" => "End time must be after start time."
      ]);
      exit();
    }

    if ($max_slots > 0 && $regCount > $max_slots) {
      echo json_encode([
        "error" => "Max slots cannot be less than current registrations ({$regCount})."
      ]);
      exit();
    }

    $start_db = time_to_db($start_time);
    $end_db = ($end_time === "") ? null : time_to_db($end_time);

    $oldPoster = (string)($workshop["poster_path"] ?? "");
    $newPosterPath = $oldPoster;
    $uploadedNew = false;

    if (!empty($_FILES["poster"]["name"])) {
      $tempPath = "";
      $uploadErr = "";

      if (!validate_and_save_image("poster", $tempPath, $uploadErr)) {
        echo json_encode([
          "error" => $uploadErr ?: "Poster upload failed."
        ]);
        exit();
      }

      $newPosterPath = $tempPath;
      $uploadedNew = true;
    }

    $stmt = $conn->prepare("
      UPDATE workshops_public
      SET title=?, description=?, register_points=?, standard_points=?, premium_points=?,
          poster_path=?, workshop_date=?, start_time=?, end_time=?, location=?, max_slots=?, is_active=?
      WHERE id=?
      LIMIT 1
    ");

    $stmt->bind_param(
      "ssssssssssiii",
      $title,
      $description,
      $register_points,
      $standard_points,
      $premium_points,
      $newPosterPath,
      $workshop_date,
      $start_db,
      $end_db,
      $location,
      $max_slots,
      $is_active,
      $id
    );

    if ($stmt->execute()) {
      $stmt->close();

      if ($uploadedNew && $oldPoster && $oldPoster !== $newPosterPath) {
        $oldPosterAbs = absolute_upload_path($oldPoster);
        if (file_exists($oldPosterAbs)) {
          @unlink($oldPosterAbs);
        }
      }

      $stmt = $conn->prepare("SELECT * FROM workshops_public WHERE id=? LIMIT 1");
      $stmt->bind_param("i", $id);
      $stmt->execute();
      $updatedWorkshop = $stmt->get_result()->fetch_assoc();
      $stmt->close();

      echo json_encode([
        "success" => true,
        "message" => "Workshop updated.",
        "workshop" => $updatedWorkshop,
        "regCount" => $regCount
      ]);
      exit();
    } else {
      $e = $stmt->error;
      $stmt->close();

      if ($uploadedNew && $newPosterPath) {
        $newPosterAbs = absolute_upload_path($newPosterPath);
        if (file_exists($newPosterAbs)) {
          @unlink($newPosterAbs);
        }
      }

      error_log("update_workshop error: " . $e);

      echo json_encode([
        "error" => "Failed to update workshop."
      ]);
      exit();
    }
  }

  echo json_encode(["error" => "Unknown action."]);
  exit();
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
exit();

<?php
require_once __DIR__ . "/admin-common-api.php";

header("Content-Type: application/json; charset=utf-8");

function json_response(array $payload, int $status = 200): void {
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit();
}

function clean_date($value): string {
  $value = trim((string)$value);
  return preg_match("/^\d{4}-\d{2}-\d{2}$/", $value) ? $value : "";
}

function clean_time($value): string {
  $value = trim((string)$value);
  return preg_match("/^\d{2}:\d{2}$/", $value) ? $value : "";
}

function clean_text($value, int $max = 5000): string {
  $value = trim((string)$value);
  return mb_substr($value, 0, $max);
}

function clean_money($value) {
  $value = trim((string)$value);

  if ($value === "") {
    return 0.00;
  }

  if (!preg_match("/^\d+(\.\d{1,2})?$/", $value)) {
    return null;
  }

  $amount = (float)$value;

  return $amount >= 0 ? round($amount, 2) : null;
}

function clean_int_value($value): int {
  if ($value === null || $value === "") {
    return 0;
  }

  $clean = preg_replace("/[^\d]/", "", (string)$value);

  if ($clean === "") {
    return 0;
  }

  return max(0, (int)$clean);
}

function time_to_db($hhmm) {
  return $hhmm === "" ? null : $hhmm . ":00";
}

function time_after($start_hhmm, $end_hhmm): bool {
  if ($start_hhmm === "" || $end_hhmm === "") {
    return true;
  }

  return strtotime("1970-01-01 {$end_hhmm}:00") > strtotime("1970-01-01 {$start_hhmm}:00");
}

function ensure_upload_dir($dir): void {
  if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
    throw new Exception("Failed to prepare upload folder.");
  }
}

function absolute_upload_path($relativePath): string {
  return dirname(__DIR__) . "/" . ltrim((string)$relativePath, "/");
}

function validate_and_save_image($field, &$outPath, &$outErr): bool {
  $outPath = "";
  $outErr = "";

  if (empty($_FILES[$field]["name"])) {
    $outErr = "No file selected.";
    return false;
  }

  $tmpName = $_FILES[$field]["tmp_name"] ?? "";
  $fileSize = (int)($_FILES[$field]["size"] ?? 0);
  $origName = (string)($_FILES[$field]["name"] ?? "");

  if ($tmpName === "" || !is_uploaded_file($tmpName)) {
    $outErr = "Invalid upload.";
    return false;
  }

  $ext = strtolower(pathinfo($origName, PATHINFO_EXTENSION));
  $allowedExt = ["jpg", "jpeg", "png", "gif", "webp"];
  $allowedMime = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

  try {
    ensure_upload_dir($absoluteFolder);
  } catch (Exception $e) {
    $outErr = $e->getMessage();
    return false;
  }

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

function get_reg_count(mysqli $conn, int $id): int {
  $stmt = $conn->prepare("
    SELECT COUNT(*) AS total
    FROM workshop_registrations
    WHERE workshop_id = ?
  ");

  if (!$stmt) {
    return 0;
  }

  $stmt->bind_param("i", $id);
  $stmt->execute();

  $row = $stmt->get_result()->fetch_assoc();

  $stmt->close();

  return (int)($row["total"] ?? 0);
}

function get_workshop(mysqli $conn, int $id): ?array {
  $stmt = $conn->prepare("
    SELECT *
    FROM workshops_public
    WHERE id = ?
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to prepare workshop lookup.");
  }

  $stmt->bind_param("i", $id);
  $stmt->execute();

  $row = $stmt->get_result()->fetch_assoc();

  $stmt->close();

  return $row ?: null;
}

$id = (int)($_GET["id"] ?? $_POST["id"] ?? 0);

if ($id <= 0) {
  json_response(["success" => false, "error" => "Invalid workshop id."], 400);
}

try {
  $workshop = get_workshop($conn, $id);

  if (!$workshop) {
    json_response(["success" => false, "error" => "Workshop not found."], 404);
  }

  if ($_SERVER["REQUEST_METHOD"] === "GET") {
    json_response([
      "success" => true,
      "csrf" => $csrf,
      "workshop" => $workshop,
      "regCount" => get_reg_count($conn, $id)
    ]);
  }

  if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_response(["success" => false, "error" => "Method not allowed."], 405);
  }

  if (!hash_equals($csrf, $_POST["csrf_token"] ?? "")) {
    json_response(["success" => false, "error" => "Invalid request (CSRF)."], 400);
  }

  $action = (string)($_POST["action"] ?? "");
  $regCount = get_reg_count($conn, $id);

  if ($action === "delete_workshop") {
    if ($regCount > 0) {
      json_response([
        "success" => false,
        "error" => "Cannot delete: this workshop has {$regCount} registration(s). Set it to Hidden instead."
      ]);
    }

    $poster = (string)($workshop["poster_path"] ?? "");

    $stmt = $conn->prepare("
      DELETE FROM workshops_public
      WHERE id = ?
      LIMIT 1
    ");

    if (!$stmt) {
      throw new Exception("Failed to prepare workshop delete.");
    }

    $stmt->bind_param("i", $id);

    if (!$stmt->execute()) {
      $error = $stmt->error;
      $stmt->close();
      throw new Exception($error);
    }

    $stmt->close();

    if ($poster) {
      $posterAbs = absolute_upload_path($poster);

      if (file_exists($posterAbs)) {
        @unlink($posterAbs);
      }
    }

    json_response([
      "success" => true,
      "message" => "Workshop deleted."
    ]);
  }

  if ($action !== "update_workshop") {
    json_response(["success" => false, "error" => "Unknown action."], 400);
  }

  $title = clean_text($_POST["title"] ?? "", 180);
  $description = clean_text($_POST["description"] ?? "", 5000);
  $register_points = clean_text($_POST["register_points"] ?? "", 5000);
  $standard_points = clean_text($_POST["standard_points"] ?? "", 5000);
  $premium_points = clean_text($_POST["premium_points"] ?? "", 5000);

  $standard_price = clean_money($_POST["standard_price"] ?? "0");
  $premium_price = clean_money($_POST["premium_price"] ?? "0");

  $workshop_date = clean_date($_POST["workshop_date"] ?? "");
  $start_time = clean_time($_POST["start_time"] ?? "");
  $end_time = clean_time($_POST["end_time"] ?? "");
  $location = clean_text($_POST["location"] ?? "", 255);
  $is_active = (int)(($_POST["is_active"] ?? "0") === "1");
  $max_slots = clean_int_value($_POST["max_slots"] ?? 0);

  if ($title === "" || $description === "" || $workshop_date === "" || $start_time === "" || $location === "") {
    json_response([
      "success" => false,
      "error" => "Please fill in Title, Description, Date, Start Time, and Location."
    ]);
  }

  if ($standard_price === null || $premium_price === null) {
    json_response([
      "success" => false,
      "error" => "Prices must be valid non-negative amounts with up to 2 decimal places."
    ]);
  }

  if ($is_active === 1 && $standard_price <= 0 && $premium_price <= 0) {
    json_response([
      "success" => false,
      "error" => "Active workshops must have at least one paid package price. Set the workshop to Hidden if pricing is not ready."
    ]);
  }

  if ($end_time !== "" && !time_after($start_time, $end_time)) {
    json_response([
      "success" => false,
      "error" => "End time must be after start time."
    ]);
  }

  if ($max_slots > 0 && $regCount > $max_slots) {
    json_response([
      "success" => false,
      "error" => "Max slots cannot be less than current registrations ({$regCount})."
    ]);
  }

  $start_db = time_to_db($start_time);
  $end_db = $end_time === "" ? null : time_to_db($end_time);

  if ($is_active === 1 && $end_db !== null) {
    $overlapStmt = $conn->prepare("
      SELECT id, title
      FROM workshops_public
      WHERE id <> ?
        AND is_active = 1
        AND workshop_date = ?
        AND start_time < ?
        AND COALESCE(end_time, start_time) > ?
      LIMIT 1
    ");

    if (!$overlapStmt) {
      throw new Exception("Failed to prepare overlap check.");
    }

    $overlapStmt->bind_param("isss", $id, $workshop_date, $end_db, $start_db);
    $overlapStmt->execute();

    $overlap = $overlapStmt->get_result()->fetch_assoc();

    $overlapStmt->close();

    if ($overlap) {
      json_response([
        "success" => false,
        "error" => "This active workshop overlaps with another active workshop: " . $overlap["title"]
      ]);
    }
  }

  $oldPoster = (string)($workshop["poster_path"] ?? "");
  $newPosterPath = $oldPoster;
  $uploadedNew = false;

  if (!empty($_FILES["poster"]["name"])) {
    $tempPath = "";
    $uploadErr = "";

    if (!validate_and_save_image("poster", $tempPath, $uploadErr)) {
      json_response([
        "success" => false,
        "error" => $uploadErr ?: "Poster upload failed."
      ]);
    }

    $newPosterPath = $tempPath;
    $uploadedNew = true;
  }

  $stmt = $conn->prepare("
    UPDATE workshops_public
    SET
      title = ?,
      description = ?,
      register_points = ?,
      standard_points = ?,
      standard_price = ?,
      premium_points = ?,
      premium_price = ?,
      poster_path = ?,
      workshop_date = ?,
      start_time = ?,
      end_time = ?,
      location = ?,
      max_slots = ?,
      is_active = ?
    WHERE id = ?
    LIMIT 1
  ");

  if (!$stmt) {
    throw new Exception("Failed to prepare workshop update.");
  }

  $stmt->bind_param(
    "ssssdsdsssssiii",
    $title,
    $description,
    $register_points,
    $standard_points,
    $standard_price,
    $premium_points,
    $premium_price,
    $newPosterPath,
    $workshop_date,
    $start_db,
    $end_db,
    $location,
    $max_slots,
    $is_active,
    $id
  );

  if (!$stmt->execute()) {
    $error = $stmt->error;
    $stmt->close();

    if ($uploadedNew && $newPosterPath) {
      $newPosterAbs = absolute_upload_path($newPosterPath);

      if (file_exists($newPosterAbs)) {
        @unlink($newPosterAbs);
      }
    }

    throw new Exception($error);
  }

  $stmt->close();

  if ($uploadedNew && $oldPoster && $oldPoster !== $newPosterPath) {
    $oldPosterAbs = absolute_upload_path($oldPoster);

    if (file_exists($oldPosterAbs)) {
      @unlink($oldPosterAbs);
    }
  }

  $updatedWorkshop = get_workshop($conn, $id);

  json_response([
    "success" => true,
    "message" => "Workshop updated.",
    "workshop" => $updatedWorkshop,
    "regCount" => $regCount
  ]);
} catch (Exception $e) {
  error_log("admin-workshop-edit error: " . $e->getMessage());

  json_response([
    "success" => false,
    "error" => $e->getMessage()
  ], 500);
}

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

function validate_and_save_image($fileField, &$outPath, &$outErr){
  $outPath = "";
  $outErr = "";

  if (empty($_FILES[$fileField]["name"])) {
    $outErr = "Please upload a workshop poster image.";
    return false;
  }

  $tmpName  = $_FILES[$fileField]["tmp_name"] ?? "";
  $fileSize = (int)($_FILES[$fileField]["size"] ?? 0);
  $origName = (string)($_FILES[$fileField]["name"] ?? "");

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

function clean_money($v){
  $v = trim((string)$v);
  if ($v === "") return 0.00;
  if (!preg_match('/^\d+(\.\d{1,2})?$/', $v)) return null;
  return (float)$v;
}

function clean_int_nonneg($v){
  if ($v === "" || $v === null) return 0;
  if (!preg_match('/^\d+$/', (string)$v)) return null;
  return (int)$v;
}

function get_reg_count($conn, $wid){
  $count = 0;
  $stmt = $conn->prepare("SELECT COUNT(*) c FROM workshop_registrations WHERE workshop_id=?");
  if ($stmt) {
    $stmt->bind_param("i", $wid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    $count = (int)($row["c"] ?? 0);
  }
  return $count;
}

function load_workshops_and_regs($conn){
  $workshops = [];
  $res = $conn->query("SELECT * FROM workshops_public ORDER BY workshop_date DESC, start_time DESC LIMIT 200");
  if ($res) {
    while ($r = $res->fetch_assoc()) $workshops[] = $r;
  }

  $regCounts = [];
  $res = $conn->query("SELECT workshop_id, COUNT(*) c FROM workshop_registrations GROUP BY workshop_id");
  if ($res) {
    while ($r = $res->fetch_assoc()) {
      $wid = (int)($r["workshop_id"] ?? 0);
      $regCounts[$wid] = (int)($r["c"] ?? 0);
    }
  }

  return [$workshops, $regCounts];
}

function load_selected_regs($conn, $selectedWorkshopId){
  $selectedWorkshop = null;
  $selectedRegs = [];

  if ($selectedWorkshopId > 0) {
    $stmt = $conn->prepare("SELECT * FROM workshops_public WHERE id=? LIMIT 1");
    $stmt->bind_param("i", $selectedWorkshopId);
    $stmt->execute();
    $selectedWorkshop = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($selectedWorkshop) {
      $stmt = $conn->prepare("SELECT * FROM workshop_registrations WHERE workshop_id=? ORDER BY id DESC LIMIT 300");
      $stmt->bind_param("i", $selectedWorkshopId);
      $stmt->execute();
      $res = $stmt->get_result();
      while ($r = $res->fetch_assoc()) $selectedRegs[] = $r;
      $stmt->close();
    }
  }

  return [$selectedWorkshop, $selectedRegs];
}

/* ----------------- EXPORT CSV (Registrations) ----------------- */
if (($_GET["action"] ?? "") === "export_regs") {
  if (!hash_equals($csrf, $_GET["csrf_token"] ?? "")) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request (CSRF)."]);
    exit();
  }

  $wid = (int)($_GET["workshop_id"] ?? 0);
  if ($wid <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid workshop for export."]);
    exit();
  }

  $wTitle = "workshop_" . $wid;
  $stmt = $conn->prepare("SELECT title FROM workshops_public WHERE id=? LIMIT 1");
  $stmt->bind_param("i", $wid);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if ($row && !empty($row["title"])) {
    $wTitle = preg_replace("/[^a-z0-9_\-]+/i", "_", (string)$row["title"]);
  }

  $regs = [];
  $stmt = $conn->prepare("SELECT * FROM workshop_registrations WHERE workshop_id=? ORDER BY id DESC");
  $stmt->bind_param("i", $wid);
  $stmt->execute();
  $res = $stmt->get_result();
  while ($r = $res->fetch_assoc()) $regs[] = $r;
  $stmt->close();

  header("Content-Type: text/csv; charset=UTF-8");
  header("Content-Disposition: attachment; filename=\"registrations_{$wTitle}.csv\"");
  header("Pragma: no-cache");
  header("Expires: 0");

  $out = fopen("php://output", "w");
  fwrite($out, "\xEF\xBB\xBF");

  if (count($regs) === 0) {
    fputcsv($out, ["No registrations found for workshop_id", $wid]);
  } else {
    $headers = array_keys($regs[0]);
    fputcsv($out, $headers);
    foreach ($regs as $r) {
      $line = [];
      foreach ($headers as $h) $line[] = $r[$h] ?? "";
      fputcsv($out, $line);
    }
  }

  fclose($out);
  exit();
}

/* ----------------- GET PAGE DATA ----------------- */
if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $tab = strtolower(trim($_GET["tab"] ?? "workshops"));
  if (!in_array($tab, ["workshops", "registrations"], true)) $tab = "workshops";

  $selectedWorkshopId = (int)($_GET["workshop_id"] ?? 0);

  [$workshops, $regCounts] = load_workshops_and_regs($conn);
  [$selectedWorkshop, $selectedRegs] = ($tab === "registrations" && $selectedWorkshopId > 0)
    ? load_selected_regs($conn, $selectedWorkshopId)
    : [null, []];

  echo json_encode([
    "success" => true,
    "csrf" => $csrf,
    "tab" => $tab,
    "workshops" => $workshops,
    "regCounts" => $regCounts,
    "selectedWorkshopId" => $selectedWorkshopId,
    "selectedWorkshop" => $selectedWorkshop,
    "selectedRegs" => $selectedRegs,
  ]);
  exit();
}

/* ----------------- ADD WORKSHOP ----------------- */
if ($_SERVER["REQUEST_METHOD"] === "POST" && ($_POST["action"] ?? "") === "add_workshop") {
  if (!hash_equals($csrf, $_POST["csrf_token"] ?? "")) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request (CSRF)."]);
    exit();
  }

  $title = trim($_POST["title"] ?? "");
  $description = trim($_POST["description"] ?? "");
  $register_points = trim($_POST["register_points"] ?? "");
  $standard_points = trim($_POST["standard_points"] ?? "");
  $premium_points  = trim($_POST["premium_points"] ?? "");

  $standard_price = clean_money($_POST["standard_price"] ?? "");
  $premium_price  = clean_money($_POST["premium_price"] ?? "");
  $max_slots      = clean_int_nonneg($_POST["max_slots"] ?? "0");

  $workshop_date = clean_date($_POST["workshop_date"] ?? "");
  $start_time = clean_time($_POST["start_time"] ?? "");
  $end_time = clean_time($_POST["end_time"] ?? "");
  $location = trim($_POST["location"] ?? "");
  $is_active = (int)(($_POST["is_active"] ?? "1") === "1");

  if ($title === "" || $description === "" || $workshop_date === "" || $start_time === "" || $location === "") {
    echo json_encode(["error" => "Please fill in Title, Description, Date, Start Time, and Location."]);
    exit();
  }

  if ($standard_price === null || $premium_price === null) {
    echo json_encode(["error" => "Invalid price. Use numbers like 499 or 499.00 only."]);
    exit();
  }

  if ($max_slots === null) {
    echo json_encode(["error" => "Invalid Max Slots. Use a non-negative whole number. Use 0 for unlimited."]);
    exit();
  }

  if ($end_time !== "" && !time_after($start_time, $end_time)) {
    echo json_encode(["error" => "End time must be after start time."]);
    exit();
  }

  $posterPath = "";
  $uploadErr = "";
  if (!validate_and_save_image("poster", $posterPath, $uploadErr)) {
    echo json_encode(["error" => $uploadErr ?: "Poster upload failed."]);
    exit();
  }

  $start_db = time_to_db($start_time);
  $end_db   = ($end_time === "") ? null : time_to_db($end_time);

  $stmt = $conn->prepare("
    INSERT INTO workshops_public
      (title, description, register_points, standard_points, standard_price,
       premium_points, premium_price,
       poster_path, workshop_date, start_time, end_time, location, max_slots, is_active)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  ");

  $stmt->bind_param(
    "ssssdsdsssssii",
    $title,
    $description,
    $register_points,
    $standard_points,
    $standard_price,
    $premium_points,
    $premium_price,
    $posterPath,
    $workshop_date,
    $start_db,
    $end_db,
    $location,
    $max_slots,
    $is_active
  );

  if ($stmt->execute()) {
    $stmt->close();
    echo json_encode(["success" => true, "message" => "Workshop added successfully."]);
    exit();
  } else {
    $e = $stmt->error;
    $stmt->close();
    if ($posterPath) {
      $posterAbs = absolute_upload_path($posterPath);
      if (file_exists($posterAbs)) @unlink($posterAbs);
    }
    error_log("add_workshop error: " . $e);
    echo json_encode(["error" => "Failed to save workshop."]);
    exit();
  }
}

/* ----------------- UPDATE / DELETE WORKSHOP ----------------- */
if ($_SERVER["REQUEST_METHOD"] === "POST" && in_array(($_POST["action"] ?? ""), ["update_workshop","delete_workshop"], true)) {
  if (!hash_equals($csrf, $_POST["csrf_token"] ?? "")) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request (CSRF)."]);
    exit();
  }

  $id = (int)($_POST["id"] ?? 0);
  if ($id <= 0) {
    echo json_encode(["error" => "Invalid workshop."]);
    exit();
  }

  $oldPoster = "";
  $stmt = $conn->prepare("SELECT poster_path FROM workshops_public WHERE id=? LIMIT 1");
  $stmt->bind_param("i", $id);
  $stmt->execute();
  $cur = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$cur) {
    echo json_encode(["error" => "Workshop not found."]);
    exit();
  }

  $oldPoster = (string)($cur["poster_path"] ?? "");

  if (($_POST["action"] ?? "") === "delete_workshop") {
    $cnt = get_reg_count($conn, $id);

    if ($cnt > 0) {
      echo json_encode(["error" => "Cannot delete: this workshop has {$cnt} registration(s). Set it to Hidden instead."]);
      exit();
    }

    $stmt = $conn->prepare("DELETE FROM workshops_public WHERE id=? LIMIT 1");
    $stmt->bind_param("i", $id);

    if ($stmt->execute()) {
      $stmt->close();

      if ($oldPoster) {
        $oldPosterAbs = absolute_upload_path($oldPoster);
        if (file_exists($oldPosterAbs)) @unlink($oldPosterAbs);
      }

      echo json_encode(["success" => true, "message" => "Workshop deleted."]);
      exit();
    } else {
      $e = $stmt->error;
      $stmt->close();
      error_log("delete_workshop error: " . $e);
      echo json_encode(["error" => "Failed to delete workshop."]);
      exit();
    }
  }

  $title = trim($_POST["title"] ?? "");
  $description = trim($_POST["description"] ?? "");
  $register_points = trim($_POST["register_points"] ?? "");
  $standard_points = trim($_POST["standard_points"] ?? "");
  $premium_points  = trim($_POST["premium_points"] ?? "");

  $standard_price = clean_money($_POST["standard_price"] ?? "");
  $premium_price  = clean_money($_POST["premium_price"] ?? "");
  $max_slots      = clean_int_nonneg($_POST["max_slots"] ?? "0");

  $workshop_date = clean_date($_POST["workshop_date"] ?? "");
  $start_time = clean_time($_POST["start_time"] ?? "");
  $end_time = clean_time($_POST["end_time"] ?? "");
  $location = trim($_POST["location"] ?? "");
  $is_active = (int)(($_POST["is_active"] ?? "0") === "1");

  if ($title === "" || $description === "" || $workshop_date === "" || $start_time === "" || $location === "") {
    echo json_encode(["error" => "Please fill in Title, Description, Date, Start Time, and Location."]);
    exit();
  }

  if ($standard_price === null || $premium_price === null) {
    echo json_encode(["error" => "Invalid price. Use numbers like 499 or 499.00 only."]);
    exit();
  }

  if ($max_slots === null) {
    echo json_encode(["error" => "Invalid Max Slots. Use a non-negative whole number. Use 0 for unlimited."]);
    exit();
  }

  $currentRegs = get_reg_count($conn, $id);
  if ($max_slots > 0 && $currentRegs > $max_slots) {
    echo json_encode(["error" => "Max slots cannot be less than current registrations ({$currentRegs})."]);
    exit();
  }

  if ($end_time !== "" && !time_after($start_time, $end_time)) {
    echo json_encode(["error" => "End time must be after start time."]);
    exit();
  }

  $start_db = time_to_db($start_time);
  $end_db   = ($end_time === "") ? null : time_to_db($end_time);

  $newPosterPath = $oldPoster;
  $uploadedNewPoster = false;

  if (!empty($_FILES["poster"]["name"])) {
    $tempPath = "";
    $uploadErr = "";
    if (!validate_and_save_image("poster", $tempPath, $uploadErr)) {
      echo json_encode(["error" => $uploadErr ?: "Poster upload failed."]);
      exit();
    }
    $newPosterPath = $tempPath;
    $uploadedNewPoster = true;
  }

  $stmt = $conn->prepare("
    UPDATE workshops_public
    SET title=?,
        description=?,
        register_points=?,
        standard_points=?,
        standard_price=?,
        premium_points=?,
        premium_price=?,
        poster_path=?,
        workshop_date=?,
        start_time=?,
        end_time=?,
        location=?,
        max_slots=?,
        is_active=?
    WHERE id=?
    LIMIT 1
  ");

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

  if ($stmt->execute()) {
    $stmt->close();

    if ($uploadedNewPoster && $oldPoster && $oldPoster !== $newPosterPath) {
      $oldPosterAbs = absolute_upload_path($oldPoster);
      if (file_exists($oldPosterAbs)) @unlink($oldPosterAbs);
    }

    echo json_encode(["success" => true, "message" => "Workshop updated."]);
    exit();
  } else {
    $e = $stmt->error;
    $stmt->close();

    if ($uploadedNewPoster && $newPosterPath) {
      $newPosterAbs = absolute_upload_path($newPosterPath);
      if (file_exists($newPosterAbs)) @unlink($newPosterAbs);
    }

    error_log("update_workshop error: " . $e);
    echo json_encode(["error" => "Failed to update workshop."]);
    exit();
  }
}

http_response_code(405);
echo json_encode(["error" => "Method not allowed"]);
exit();

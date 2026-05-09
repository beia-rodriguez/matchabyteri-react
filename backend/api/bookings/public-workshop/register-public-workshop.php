<?php

session_start();

require_once __DIR__ . "/../../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

function respond($data, $code = 200) {
  http_response_code($code);
  echo json_encode($data);
  exit();
}

function format_date_text($date) {
  return date("F j, Y", strtotime($date));
}

function format_time_text($start, $end) {
  $startText = date("g:i A", strtotime($start));

  if (!empty($end)) {
    return $startText . " – " . date("g:i A", strtotime($end));
  }

  return $startText;
}

if (!isset($_SESSION["user_id"])) {
  respond(["success" => false, "error" => "Unauthorized"], 401);
}

$userId = (int)$_SESSION["user_id"];
$method = $_SERVER["REQUEST_METHOD"];

if ($method === "GET") {
  $workshopId = (int)($_GET["id"] ?? 0);
  $package = strtolower(trim($_GET["package"] ?? ""));
} else {
  $data = json_decode(file_get_contents("php://input"), true);

  if (!is_array($data)) {
    respond(["success" => false, "error" => "Invalid request"], 400);
  }

  $workshopId = (int)($data["id"] ?? 0);
  $package = strtolower(trim($data["package"] ?? ""));
}

if ($workshopId <= 0 || !in_array($package, ["standard", "premium"], true)) {
  respond(["success" => false, "error" => "Invalid workshop or package"], 400);
}

$stmt = $conn->prepare("
  SELECT
    id,
    title,
    description,
    poster_path,
    workshop_date,
    start_time,
    end_time,
    location,
    max_slots,
    standard_price,
    premium_price
  FROM workshops_public
  WHERE id = ?
    AND is_active = 1
  LIMIT 1
");

if (!$stmt) {
  respond(["success" => false, "error" => "Database error"], 500);
}

$stmt->bind_param("i", $workshopId);
$stmt->execute();
$workshop = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$workshop) {
  respond(["success" => false, "error" => "Workshop not found"], 404);
}

$today = date("Y-m-d");
$now = date("H:i:s");

$workshopDate = $workshop["workshop_date"];
$endTime = !empty($workshop["end_time"]) ? $workshop["end_time"] : $workshop["start_time"];

if ($workshopDate < $today || ($workshopDate === $today && $endTime < $now)) {
  respond(["success" => false, "error" => "This workshop has already ended."], 400);
}

$price = $package === "premium"
  ? (float)$workshop["premium_price"]
  : (float)$workshop["standard_price"];

if ($price <= 0) {
  respond(["success" => false, "error" => "Invalid package price."], 400);
}

if ($method === "GET") {
  $stmt = $conn->prepare("
    SELECT name, email, phone_number
    FROM users
    WHERE id = ?
    LIMIT 1
  ");

  $user = null;

  if ($stmt) {
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();
  }

  respond([
    "success" => true,
    "workshop" => [
      "id" => (int)$workshop["id"],
      "title" => $workshop["title"],
      "poster_path" => $workshop["poster_path"],
      "workshop_date" => $workshop["workshop_date"],
      "start_time" => $workshop["start_time"],
      "end_time" => $workshop["end_time"],
      "location" => $workshop["location"],
      "dateText" => format_date_text($workshop["workshop_date"]),
      "timeText" => format_time_text($workshop["start_time"], $workshop["end_time"])
    ],
    "package" => $package,
    "price" => $price,
    "user" => $user
  ]);
}

if ($method !== "POST") {
  respond(["success" => false, "error" => "Method not allowed"], 405);
}

$fullName = trim($data["full_name"] ?? "");
$email = trim($data["email"] ?? "");
$phone = trim($data["phone"] ?? "");

if ($fullName === "" || $email === "" || $phone === "") {
  respond(["success" => false, "error" => "Please complete all fields."], 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(["success" => false, "error" => "Please enter a valid email address."], 400);
}

$phoneClean = preg_replace("/[\s\-\(\)]/", "", $phone);

if (!preg_match("/^\+?\d{7,15}$/", $phoneClean)) {
  respond(["success" => false, "error" => "Please enter a valid phone number."], 400);
}

$conn->begin_transaction();

try {
  $lockStmt = $conn->prepare("
    SELECT id, max_slots
    FROM workshops_public
    WHERE id = ?
      AND is_active = 1
    FOR UPDATE
  ");

  if (!$lockStmt) {
    throw new Exception("Failed to lock workshop.");
  }

  $lockStmt->bind_param("i", $workshopId);
  $lockStmt->execute();
  $lockedWorkshop = $lockStmt->get_result()->fetch_assoc();
  $lockStmt->close();

  if (!$lockedWorkshop) {
    throw new Exception("Workshop not found.");
  }

  /*
    Slots count only registrations that have submitted payment proof
    or are already approved/paid.

    Unpaid abandoned registrations do NOT consume a slot.
  */
  $maxSlots = (int)($lockedWorkshop["max_slots"] ?? 0);

  if ($maxSlots > 0) {
    $countStmt = $conn->prepare("
      SELECT COUNT(*) AS c
      FROM workshop_registrations
      WHERE workshop_id = ?
        AND status IN ('pending', 'approved')
        AND payment_status IN ('pending', 'paid')
    ");

    if (!$countStmt) {
      throw new Exception("Failed to count registrations.");
    }

    $countStmt->bind_param("i", $workshopId);
    $countStmt->execute();
    $count = (int)($countStmt->get_result()->fetch_assoc()["c"] ?? 0);
    $countStmt->close();

    if ($count >= $maxSlots) {
      throw new Exception("This workshop is fully booked.");
    }
  }

  /*
    If user already has an unpaid registration, reuse it instead of
    creating a duplicate row.
  */
  $existingUnpaidStmt = $conn->prepare("
    SELECT id, package, total_amount
    FROM workshop_registrations
    WHERE workshop_id = ?
      AND user_id = ?
      AND status = 'pending'
      AND payment_status IN ('unpaid', 'rejected')
    LIMIT 1
  ");

  if (!$existingUnpaidStmt) {
    throw new Exception("Failed to check existing registration.");
  }

  $existingUnpaidStmt->bind_param("ii", $workshopId, $userId);
  $existingUnpaidStmt->execute();
  $existingUnpaid = $existingUnpaidStmt->get_result()->fetch_assoc();
  $existingUnpaidStmt->close();

  if ($existingUnpaid) {
    $existingId = (int)$existingUnpaid["id"];

    $updateStmt = $conn->prepare("
      UPDATE workshop_registrations
      SET
        package = ?,
        full_name = ?,
        email = ?,
        phone_number = ?,
        payment_status = 'unpaid',
        total_amount = ?
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    ");

    if (!$updateStmt) {
      throw new Exception("Failed to update existing registration.");
    }

    $packageDb = strtoupper($package);

    $updateStmt->bind_param(
      "ssssdii",
      $packageDb,
      $fullName,
      $email,
      $phone,
      $price,
      $existingId,
      $userId
    );

    if (!$updateStmt->execute()) {
      throw new Exception("Failed to update existing registration.");
    }

    $updateStmt->close();
    $conn->commit();

    respond([
      "success" => true,
      "registration_id" => $existingId,
      "total_amount" => $price,
      "reused" => true
    ]);
  }

  /*
    Block duplicate active registrations only when payment has already
    been submitted/approved.
  */
  $duplicateStmt = $conn->prepare("
    SELECT id
    FROM workshop_registrations
    WHERE workshop_id = ?
      AND (user_id = ? OR email = ?)
      AND status IN ('pending', 'approved')
      AND payment_status IN ('pending', 'paid')
    LIMIT 1
  ");

  if (!$duplicateStmt) {
    throw new Exception("Failed to check duplicate registration.");
  }

  $duplicateStmt->bind_param("iis", $workshopId, $userId, $email);
  $duplicateStmt->execute();
  $duplicate = $duplicateStmt->get_result()->fetch_assoc();
  $duplicateStmt->close();

  if ($duplicate) {
    throw new Exception("You are already registered for this workshop.");
  }

  $insert = $conn->prepare("
    INSERT INTO workshop_registrations
      (
        user_id,
        workshop_id,
        package,
        full_name,
        email,
        phone_number,
        status,
        payment_status,
        total_amount
      )
    VALUES
      (?, ?, ?, ?, ?, ?, 'pending', 'unpaid', ?)
  ");

  if (!$insert) {
    throw new Exception("Failed to prepare registration.");
  }

  $packageDb = strtoupper($package);

  $insert->bind_param(
    "iissssd",
    $userId,
    $workshopId,
    $packageDb,
    $fullName,
    $email,
    $phone,
    $price
  );

  if (!$insert->execute()) {
    throw new Exception("Failed to submit registration.");
  }

  $registrationId = $conn->insert_id;
  $insert->close();

  $conn->commit();

  respond([
    "success" => true,
    "registration_id" => $registrationId,
    "total_amount" => $price,
    "reused" => false
  ]);

} catch (Exception $e) {
  $conn->rollback();

  respond([
    "success" => false,
    "error" => $e->getMessage()
  ], 400);
}
<?php

session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

$userId = (int)$_SESSION["user_id"];

$GCASH_NUMBER = "+639771277498";
$GCASH_NAME = "J*A*T";
$GCASH_QR = "images/gcash-qr.jpg";

$allowedPurposes = ["event_booking", "workshop_booking", "workshop_public"];

$purpose = strtolower(trim($_GET["purpose"] ?? ""));
$bookingId = (int)($_GET["booking_id"] ?? 0);
$registrationId = (int)($_GET["registration_id"] ?? 0);

$isPublicWorkshop = $purpose === "workshop_public";

if (!in_array($purpose, $allowedPurposes, true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment purpose"]);
  exit();
}

if ($isPublicWorkshop && $registrationId <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid registration"]);
  exit();
}

if (!$isPublicWorkshop && $bookingId <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking"]);
  exit();
}

$totalAmount = 0;
$paymentStatus = "unpaid";
$paymentEntity = null;
$contextBase = [];

if ($isPublicWorkshop) {
  $stmt = $conn->prepare("
    SELECT
      r.id,
      r.user_id,
      r.workshop_id,
      r.package,
      r.full_name,
      r.email,
      r.phone_number,
      r.status,
      r.payment_status,
      r.total_amount,
      w.title,
      w.workshop_date,
      w.start_time,
      w.end_time,
      w.location
    FROM workshop_registrations r
    JOIN workshops_public w ON w.id = r.workshop_id
    WHERE r.id = ?
    LIMIT 1
  ");

  if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "Database error"]);
    exit();
  }

  $stmt->bind_param("i", $registrationId);
  $stmt->execute();
  $registration = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$registration || (int)$registration["user_id"] !== $userId) {
    http_response_code(403);
    echo json_encode(["error" => "Registration not found or access denied"]);
    exit();
  }

  $paymentEntity = $registration;
  $paymentStatus = strtolower((string)($registration["payment_status"] ?? "unpaid"));
  $totalAmount = (float)($registration["total_amount"] ?? 0);

  $contextBase = [
    "purpose" => $purpose,
    "registration_id" => $registrationId,
    "workshop_id" => (int)$registration["workshop_id"],
    "workshop_title" => $registration["title"],
    "package" => $registration["package"],
    "full_name" => $registration["full_name"],
    "email" => $registration["email"],
    "phone_number" => $registration["phone_number"],
    "workshop_date" => $registration["workshop_date"],
    "start_time" => $registration["start_time"],
    "end_time" => $registration["end_time"],
    "location" => $registration["location"],
  ];
} else {
$stmt = $conn->prepare("
    SELECT id, user_id, booking_date, start_time, end_time, booking_type, notes, payment_status, total_amount, amount_paid, form_snapshot
    FROM bookings
    WHERE id = ? LIMIT 1
  ");

  if (!$stmt) {
    http_response_code(500);
    echo json_encode(["error" => "Database error"]);
    exit();
  }

  $stmt->bind_param("i", $bookingId);
  $stmt->execute();
  $booking = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$booking || (int)$booking["user_id"] !== $userId) {
    http_response_code(403);
    echo json_encode(["error" => "Booking not found or access denied"]);
    exit();
  }

  if ($purpose === "event_booking" && $booking["booking_type"] !== "event") {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payment purpose for this booking"]);
    exit();
  }

  if ($purpose === "workshop_booking" && $booking["booking_type"] !== "workshop") {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payment purpose for this booking"]);
    exit();
  }

  $paymentEntity = $booking;
  $paymentStatus = strtolower((string)($booking["payment_status"] ?? "unpaid"));
  $totalAmount = (float)($booking["total_amount"] ?? 0);

  if ($totalAmount <= 0 && !empty($booking["notes"])) {
    $notesDecoded = json_decode((string)$booking["notes"], true);

    if (is_array($notesDecoded) && isset($notesDecoded["total_amount"])) {
      $totalAmount = (float)$notesDecoded["total_amount"];
    }
  }

  $contextBase = [
    "purpose" => $purpose,
    "booking_id" => $bookingId,
    "booking_type" => $booking["booking_type"],
    "booking_date" => $booking["booking_date"],
    "start_time" => $booking["start_time"],
    "end_time" => $booking["end_time"],
  ];
}

if ($totalAmount <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment amount"]);
  exit();
}

$downpaymentPercentage = 50.0;

if (!$isPublicWorkshop && !empty($paymentEntity["form_snapshot"])) {
  $snapshot = json_decode((string)$paymentEntity["form_snapshot"], true);

  if (is_array($snapshot) && isset($snapshot["downpayment_percentage"])) {
    $downpaymentPercentage = (float)$snapshot["downpayment_percentage"];
  }
}

if ($isPublicWorkshop) {
  $downpaymentPercentage = 100.0;
}

if ($downpaymentPercentage <= 0 || $downpaymentPercentage > 100) {
  $downpaymentPercentage = 50.0;
}
$amountPaid = (float)($booking["amount_paid"] ?? 0);
$downpaymentAmount = round($totalAmount * ($downpaymentPercentage / 100), 2);
$remainingAmount = round($totalAmount - $amountPaid, 2);

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  if ($isPublicWorkshop) {
    $pendingStmt = $conn->prepare("
      SELECT id
      FROM payments
      WHERE registration_id = ?
        AND purpose = ?
        AND status = 'pending'
      LIMIT 1
    ");
    $pendingStmt->bind_param("is", $registrationId, $purpose);
  } else {
    $pendingStmt = $conn->prepare("
      SELECT id
      FROM payments
      WHERE booking_id = ?
        AND purpose = ?
        AND status = 'pending'
      LIMIT 1
    ");
    $pendingStmt->bind_param("is", $bookingId, $purpose);
  }

  $pendingStmt->execute();
  $hasPending = $pendingStmt->get_result()->num_rows > 0;
  $pendingStmt->close();

  if ($hasPending) {
    http_response_code(409);
    echo json_encode(["error" => "A payment is already pending admin verification."]);
    exit();
  }

  if ($paymentStatus === "paid") {
    http_response_code(409);
    echo json_encode(["error" => "This is already fully paid."]);
    exit();
  }

$common = [
    "payment_status" => $paymentStatus,
    "total_amount" => $totalAmount,
    "amount_paid" => $amountPaid, // Add this so the frontend knows what to display
    "downpayment_amount" => $downpaymentAmount,
    "remaining_amount" => $remainingAmount,
  ];
  echo json_encode([
    "success" => true,
    "gcash_number" => $GCASH_NUMBER,
    "gcash_name" => $GCASH_NAME,
    "gcash_qr" => $GCASH_QR,
    $isPublicWorkshop ? "registration" : "booking" => array_merge($paymentEntity, $common)
  ]);
  exit();
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  http_response_code(405);
  echo json_encode(["error" => "Method not allowed"]);
  exit();
}

$referenceNo = trim($_POST["reference_no"] ?? "");
$payerName = trim($_POST["payer_name"] ?? "");
$amountRaw = trim($_POST["amount"] ?? "");
$paymentChoice = strtolower(trim($_POST["payment_choice"] ?? ""));

$allowedChoices = $isPublicWorkshop
  ? ["full"]
  : ["downpayment", "remaining", "full"];

if (!in_array($paymentChoice, $allowedChoices, true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment option"]);
  exit();
}

if (!$isPublicWorkshop) {
  if ($paymentStatus === "unpaid" && !in_array($paymentChoice, ["downpayment", "full"], true)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid payment option for unpaid booking"]);
    exit();
  }

  if ($paymentStatus === "partial" && $paymentChoice !== "remaining") {
    http_response_code(400);
    echo json_encode(["error" => "Only remaining balance payment is allowed."]);
    exit();
  }
}

if ($paymentStatus === "paid") {
  http_response_code(400);
  echo json_encode(["error" => "This is already fully paid."]);
  exit();
}

if ($referenceNo === "" || $payerName === "" || $amountRaw === "") {
  http_response_code(400);
  echo json_encode(["error" => "Please enter payer name, reference number, and amount."]);
  exit();
}

if (!preg_match("/^\d+(\.\d{1,2})?$/", $amountRaw)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid amount format"]);
  exit();
}

$amount = (float)$amountRaw;

if ($paymentChoice === "full") {
  $expectedAmount = round($totalAmount, 2);
} elseif ($paymentChoice === "remaining") {
  $expectedAmount = round($remainingAmount, 2);
} else {
  $expectedAmount = round($downpaymentAmount, 2);
}

if (abs($amount - $expectedAmount) > 0.01) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment amount. Please refresh the page and try again."]);
  exit();
}

if (!isset($_FILES["proof"]) || $_FILES["proof"]["error"] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(["error" => "Please upload your payment proof screenshot."]);
  exit();
}

if ($_FILES["proof"]["size"] > 5 * 1024 * 1024) {
  http_response_code(400);
  echo json_encode(["error" => "File must be 5MB or smaller."]);
  exit();
}

$tmp = $_FILES["proof"]["tmp_name"];
$name = $_FILES["proof"]["name"];
$ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

if (!in_array($ext, ["jpg", "jpeg", "png", "webp"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid file type. Upload JPG, PNG, or WEBP only."]);
  exit();
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mime = finfo_file($finfo, $tmp);
finfo_close($finfo);

if (!in_array($mime, ["image/jpeg", "image/png", "image/webp"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid image file."]);
  exit();
}

$uploadDir = __DIR__ . "/../uploads/payments";

if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
  http_response_code(500);
  echo json_encode(["error" => "Failed to prepare upload folder."]);
  exit();
}

$paymentToken = bin2hex(random_bytes(16));
$fileName = "gcash_" . $paymentToken . "." . $ext;
$destAbs = $uploadDir . "/" . $fileName;
$destRel = "uploads/payments/" . $fileName;

if (!move_uploaded_file($tmp, $destAbs)) {
  http_response_code(500);
  echo json_encode(["error" => "Upload failed. Please try again."]);
  exit();
}

$context = array_merge($contextBase, [
  "payment_choice" => $paymentChoice,
  "total_amount" => $totalAmount,
  "downpayment_percentage" => $downpaymentPercentage,
  "downpayment_amount" => $downpaymentAmount,
  "remaining_amount" => $remainingAmount,
  "expected_payment_amount" => $expectedAmount
]);

if (!$isPublicWorkshop) {
  $notesDecoded = json_decode((string)($paymentEntity["notes"] ?? ""), true);

  if (is_array($notesDecoded) && isset($notesDecoded["selected_items"])) {
    $context["selected_items"] = $notesDecoded["selected_items"];
  }
}

$contextJson = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($contextJson === false) $contextJson = "{}";

$conn->begin_transaction();

try {
  if ($isPublicWorkshop) {
    $pendingStmt = $conn->prepare("
      SELECT id
      FROM payments
      WHERE registration_id = ?
        AND purpose = ?
        AND status = 'pending'
      LIMIT 1
    ");
    $pendingStmt->bind_param("is", $registrationId, $purpose);
  } else {
    $pendingStmt = $conn->prepare("
      SELECT id
      FROM payments
      WHERE booking_id = ?
        AND purpose = ?
        AND status = 'pending'
      LIMIT 1
    ");
    $pendingStmt->bind_param("is", $bookingId, $purpose);
  }

  $pendingStmt->execute();
  $hasPending = $pendingStmt->get_result()->num_rows > 0;
  $pendingStmt->close();

  if ($hasPending) {
    throw new Exception("A payment is already pending admin verification.");
  }

  $stmt = $conn->prepare("
    INSERT INTO payments
      (
        user_id,
        booking_id,
        registration_id,
        purpose,
        payment_token,
        reference_no,
        payer_name,
        amount,
        proof_path,
        status,
        context_json
      )
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  ");

  $bookingIdForInsert = $isPublicWorkshop ? null : $bookingId;
  $registrationIdForInsert = $isPublicWorkshop ? $registrationId : null;

  $stmt->bind_param(
    "iiissssdss",
    $userId,
    $bookingIdForInsert,
    $registrationIdForInsert,
    $purpose,
    $paymentToken,
    $referenceNo,
    $payerName,
    $amount,
    $destRel,
    $contextJson
  );

  if (!$stmt->execute()) {
    throw new Exception("Failed to save payment.");
  }

  $stmt->close();

  if ($isPublicWorkshop) {
    $up = $conn->prepare("
      UPDATE workshop_registrations
      SET payment_status = 'pending'
      WHERE id = ?
        AND user_id = ?
    ");
    $up->bind_param("ii", $registrationId, $userId);
  } else {
    $up = $conn->prepare("
      UPDATE bookings
      SET payment_status = 'pending'
      WHERE id = ?
        AND user_id = ?
    ");
    $up->bind_param("ii", $bookingId, $userId);
  }

  if (!$up->execute()) {
    throw new Exception("Failed to update payment status.");
  }

  $up->close();

  $conn->commit();

  echo json_encode([
    "success" => true,
    "payment_token" => $paymentToken,
    "amount" => $amount,
    "payment_choice" => $paymentChoice
  ]);
  exit();

} catch (Exception $e) {
  $conn->rollback();

  if (file_exists($destAbs)) {
    @unlink($destAbs);
  }

  http_response_code(400);
  echo json_encode(["error" => $e->getMessage()]);
  exit();
}
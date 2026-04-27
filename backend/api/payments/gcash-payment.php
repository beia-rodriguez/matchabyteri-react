<?php
session_start();
require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

function h($s) {
  return htmlspecialchars((string)$s, ENT_QUOTES, "UTF-8");
}

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

$userId = (int)$_SESSION["user_id"];

$GCASH_NUMBER = "+639771277498";
$GCASH_NAME   = "J*A*T";
$GCASH_QR     = "images/gcash-qr.jpg";

$purpose = strtolower(trim($_GET["purpose"] ?? ""));
$bookingId = (int)($_GET["booking_id"] ?? 0);

if (!in_array($purpose, ["event_booking", "workshop_booking", "workshop_public"], true) || $bookingId <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid booking or purpose"]);
  exit();
}

$stmt = $conn->prepare("
  SELECT
    id,
    user_id,
    booking_date,
    start_time,
    end_time,
    booking_type,
    notes,
    payment_status,
    total_amount,
    form_snapshot
  FROM bookings
  WHERE id = ?
  LIMIT 1
");
$stmt->bind_param("i", $bookingId);
$stmt->execute();
$booking = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$booking || (int)$booking["user_id"] !== $userId) {
  http_response_code(403);
  echo json_encode(["error" => "Booking not found or access denied"]);
  exit();
}

$totalAmount = (float)($booking["total_amount"] ?? 0);

if ($totalAmount <= 0 && !empty($booking["notes"])) {
  $notesDecoded = json_decode((string)$booking["notes"], true);
  if (is_array($notesDecoded) && isset($notesDecoded["total_amount"])) {
    $totalAmount = (float)$notesDecoded["total_amount"];
  }
}

$stmt = $conn->prepare("
  SELECT id, status
  FROM payments
  WHERE booking_id = ?
  ORDER BY id DESC
  LIMIT 1
");
$stmt->bind_param("i", $bookingId);
$stmt->execute();
$lastPay = $stmt->get_result()->fetch_assoc();
$stmt->close();

if ($lastPay && in_array($lastPay["status"], ["pending", "paid"], true)) {
  http_response_code(409);
  echo json_encode([
    "error" => "A payment for this booking is already submitted (" . h($lastPay["status"]) . ")."
  ]);
  exit();
}

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  echo json_encode([
    "success" => true,
    "gcash_number" => $GCASH_NUMBER,
    "gcash_name"   => $GCASH_NAME,
    "gcash_qr"     => $GCASH_QR,
    "booking"      => [
      "id" => $booking["id"],
      "booking_date" => $booking["booking_date"],
      "start_time" => $booking["start_time"],
      "end_time" => $booking["end_time"],
      "booking_type" => $booking["booking_type"],
      "payment_status" => $booking["payment_status"],
      "total_amount" => $totalAmount,
      "form_snapshot" => $booking["form_snapshot"],
      "notes" => $booking["notes"]
    ]
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
$paymentChoice = strtolower(trim($_POST["payment_choice"] ?? "downpayment"));

if (!in_array($paymentChoice, ["downpayment", "full"], true)) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment option"]);
  exit();
}

if ($referenceNo === "" || $payerName === "" || $amountRaw === "") {
  http_response_code(400);
  echo json_encode(["error" => "Please enter payer name, reference number, and amount."]);
  exit();
}

$amount = (float)$amountRaw;

if ($amount <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Amount must be greater than 0."]);
  exit();
}

$downpaymentPercentage = 50.0;

if (!empty($booking["form_snapshot"])) {
  $snapshot = json_decode((string)$booking["form_snapshot"], true);
  if (is_array($snapshot) && isset($snapshot["downpayment_percentage"])) {
    $downpaymentPercentage = (float)$snapshot["downpayment_percentage"];
  }
}

$expectedAmount = $paymentChoice === "full"
  ? $totalAmount
  : ($totalAmount * ($downpaymentPercentage / 100));

if (abs($amount - $expectedAmount) > 0.01) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid payment amount. Please refresh the page and try again."]);
  exit();
}

if (!isset($_FILES["proof"]) || $_FILES["proof"]["error"] !== UPLOAD_ERR_OK) {
  http_response_code(400);
  echo json_encode(["error" => "Please upload your payment proof (screenshot)."]);
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

$uploadDir = __DIR__ . "/../uploads/payments";

if (!is_dir($uploadDir)) {
  @mkdir($uploadDir, 0777, true);
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

$context = [
  "purpose" => $purpose,
  "booking_id" => $bookingId,
  "booking_type" => $booking["booking_type"],
  "booking_date" => $booking["booking_date"],
  "start_time" => $booking["start_time"],
  "end_time" => $booking["end_time"],
  "payment_choice" => $paymentChoice,
  "total_amount" => $totalAmount,
  "downpayment_percentage" => $downpaymentPercentage,
  "expected_payment_amount" => $expectedAmount
];

$notesDecoded = json_decode((string)($booking["notes"] ?? ""), true);
if (is_array($notesDecoded)) {
  if (isset($notesDecoded["selected_items"])) {
    $context["selected_items"] = $notesDecoded["selected_items"];
  }

  foreach (["workshop_id", "workshop_title", "package"] as $k) {
    if (isset($notesDecoded[$k])) {
      $context[$k] = $notesDecoded[$k];
    }
  }
}

$contextJson = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($contextJson === false) {
  $contextJson = "{}";
}

$conn->begin_transaction();

try {
  $stmt = $conn->prepare("
    INSERT INTO payments
      (
        user_id,
        booking_id,
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
      (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
  ");

  $stmt->bind_param(
    "iissssdss",
    $userId,
    $bookingId,
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

  $up = $conn->prepare("
    UPDATE bookings
    SET payment_status = 'pending'
    WHERE id = ? AND user_id = ?
  ");
  $up->bind_param("ii", $bookingId, $userId);
  $up->execute();
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

  http_response_code(500);
  echo json_encode([
    "error" => "Failed to save payment. Please try again."
  ]);
  exit();
}
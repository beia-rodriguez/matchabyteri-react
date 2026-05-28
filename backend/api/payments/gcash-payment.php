<?php

session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json");

date_default_timezone_set("Asia/Manila");

function json_fail($message, $status = 400) {
  http_response_code($status);
  echo json_encode([
    "success" => false,
    "error" => $message
  ]);
  exit();
}

function normalize_payment_purpose($purpose) {
  $purpose = strtolower(trim((string)$purpose));

  if ($purpose === "workshop_booking") {
    return "private_workshop";
  }

  if ($purpose === "workshop_public") {
    return "workshop_registration";
  }

  return $purpose;
}

function purpose_aliases($purpose) {
  if ($purpose === "private_workshop") {
    return ["private_workshop", "workshop_booking"];
  }

  if ($purpose === "workshop_registration") {
    return ["workshop_registration", "workshop_public"];
  }

  return [$purpose];
}

function get_pricing_setting($conn, $key, $default) {
  $stmt = $conn->prepare("
    SELECT setting_value
    FROM pricing_settings
    WHERE setting_key = ?
    LIMIT 1
  ");

  if (!$stmt) {
    return (float)$default;
  }

  $stmt->bind_param("s", $key);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  if (!$row) {
    return (float)$default;
  }

  return (float)$row["setting_value"];
}

function get_downpayment_percentage($conn, $bookingType, $paymentEntity, $isPublicWorkshop) {
  if ($isPublicWorkshop) {
    return 100.0;
  }

  if (!empty($paymentEntity["form_snapshot"])) {
    $snapshot = json_decode((string)$paymentEntity["form_snapshot"], true);

    if (is_array($snapshot) && isset($snapshot["downpayment_percentage"])) {
      $percentage = (float)$snapshot["downpayment_percentage"];

      if ($percentage > 0 && $percentage <= 100) {
        return $percentage;
      }
    }
  }

  if (!empty($paymentEntity["notes"])) {
    $notes = json_decode((string)$paymentEntity["notes"], true);

    if (is_array($notes) && isset($notes["downpayment_percentage"])) {
      $percentage = (float)$notes["downpayment_percentage"];

      if ($percentage > 0 && $percentage <= 100) {
        return $percentage;
      }
    }
  }

  if ($bookingType === "event_booking") {
    return get_pricing_setting($conn, "event_booking_downpayment_percentage", 50.0);
  }

  if ($bookingType === "private_workshop") {
    return get_pricing_setting($conn, "private_workshop_downpayment_percentage", 50.0);
  }

  return 50.0;
}

function has_pending_payment($conn, $isPublicWorkshop, $registrationId, $bookingId, $purposeList) {
  $purposePlaceholders = implode(",", array_fill(0, count($purposeList), "?"));

  if ($isPublicWorkshop) {
    $sql = "
      SELECT id
      FROM payments
      WHERE registration_id = ?
        AND purpose IN ($purposePlaceholders)
        AND status = 'pending'
      LIMIT 1
    ";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
      throw new Exception("Failed to check pending payment.");
    }

    $types = "i" . str_repeat("s", count($purposeList));
    $stmt->bind_param($types, $registrationId, ...$purposeList);
  } else {
    $sql = "
      SELECT id
      FROM payments
      WHERE booking_id = ?
        AND purpose IN ($purposePlaceholders)
        AND status = 'pending'
      LIMIT 1
    ";

    $stmt = $conn->prepare($sql);

    if (!$stmt) {
      throw new Exception("Failed to check pending payment.");
    }

    $types = "i" . str_repeat("s", count($purposeList));
    $stmt->bind_param($types, $bookingId, ...$purposeList);
  }

  $stmt->execute();
  $hasPending = $stmt->get_result()->num_rows > 0;
  $stmt->close();

  return $hasPending;
}

if (!isset($_SESSION["user_id"])) {
  json_fail("Unauthorized", 401);
}

$userId = (int)$_SESSION["user_id"];

$GCASH_NUMBER = "+639771277498";
$GCASH_NAME = "J*A*T";
$GCASH_QR = "images/gcash-qr.jpg";

$rawPurpose = $_GET["purpose"] ?? "";
$purpose = normalize_payment_purpose($rawPurpose);

$allowedPurposes = [
  "event_booking",
  "private_workshop",
  "workshop_registration"
];

$bookingId = (int)($_GET["booking_id"] ?? 0);
$registrationId = (int)($_GET["registration_id"] ?? 0);

$isPublicWorkshop = $purpose === "workshop_registration";

if (!in_array($purpose, $allowedPurposes, true)) {
  json_fail("Invalid payment purpose");
}

if ($isPublicWorkshop && $registrationId <= 0) {
  json_fail("Invalid registration");
}

if (!$isPublicWorkshop && $bookingId <= 0) {
  json_fail("Invalid booking");
}

$totalAmount = 0.0;
$paymentStatus = "unpaid";
$paymentEntity = null;
$contextBase = [];
$amountPaid = 0.0;
$bookingType = "";

try {
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
      json_fail("Database error", 500);
    }

    $stmt->bind_param("i", $registrationId);
    $stmt->execute();
    $registration = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$registration || (int)$registration["user_id"] !== $userId) {
      json_fail("Registration not found or access denied", 403);
    }

    $paymentEntity = $registration;
    $paymentStatus = strtolower((string)($registration["payment_status"] ?? "unpaid"));
    $totalAmount = (float)($registration["total_amount"] ?? 0);
    $amountPaid = $paymentStatus === "paid" ? $totalAmount : 0.0;

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
      "location" => $registration["location"]
    ];
  } else {
    $stmt = $conn->prepare("
      SELECT
        id,
        user_id,
        booking_date,
        start_time,
        end_time,
        booking_type,
        status,
        notes,
        payment_status,
        total_amount,
        amount_paid,
        form_snapshot
      FROM bookings
      WHERE id = ?
      LIMIT 1
    ");

    if (!$stmt) {
      json_fail("Database error", 500);
    }

    $stmt->bind_param("i", $bookingId);
    $stmt->execute();
    $booking = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$booking || (int)$booking["user_id"] !== $userId) {
      json_fail("Booking not found or access denied", 403);
    }

    $bookingType = (string)$booking["booking_type"];

    if ($purpose === "event_booking" && $bookingType !== "event_booking") {
      json_fail("Invalid payment purpose for this booking");
    }

    if ($purpose === "private_workshop" && $bookingType !== "private_workshop") {
      json_fail("Invalid payment purpose for this booking");
    }

    $paymentEntity = $booking;
    $paymentStatus = strtolower((string)($booking["payment_status"] ?? "unpaid"));
    $totalAmount = (float)($booking["total_amount"] ?? 0);
    $amountPaid = (float)($booking["amount_paid"] ?? 0);

    if ($totalAmount <= 0 && !empty($booking["notes"])) {
      $notesDecoded = json_decode((string)$booking["notes"], true);

      if (is_array($notesDecoded) && isset($notesDecoded["total_amount"])) {
        $totalAmount = (float)$notesDecoded["total_amount"];
      }
    }

    $contextBase = [
      "purpose" => $purpose,
      "booking_id" => $bookingId,
      "booking_type" => $bookingType,
      "booking_status" => $booking["status"] ?? "",
      "booking_date" => $booking["booking_date"],
      "start_time" => $booking["start_time"],
      "end_time" => $booking["end_time"]
    ];
  }

  if ($totalAmount <= 0) {
    json_fail("Invalid payment amount");
  }

  $downpaymentPercentage = get_downpayment_percentage(
    $conn,
    $bookingType,
    $paymentEntity,
    $isPublicWorkshop
  );

  if ($downpaymentPercentage <= 0 || $downpaymentPercentage > 100) {
    $downpaymentPercentage = $isPublicWorkshop ? 100.0 : 50.0;
  }

  $downpaymentAmount = round($totalAmount * ($downpaymentPercentage / 100), 2);
  $remainingAmount = round(max(0, $totalAmount - $amountPaid), 2);

  $purposeList = purpose_aliases($purpose);

  if ($_SERVER["REQUEST_METHOD"] === "GET") {
    $hasPending = has_pending_payment(
      $conn,
      $isPublicWorkshop,
      $registrationId,
      $bookingId,
      $purposeList
    );

    if ($hasPending) {
      json_fail("A payment is already pending admin verification.", 409);
    }

    if ($paymentStatus === "paid") {
      json_fail("This is already fully paid.", 409);
    }

    $common = [
      "payment_status" => $paymentStatus,
      "total_amount" => $totalAmount,
      "amount_paid" => $amountPaid,
      "downpayment_percentage" => $downpaymentPercentage,
      "downpayment_amount" => $downpaymentAmount,
      "remaining_amount" => $remainingAmount
    ];

    echo json_encode([
      "success" => true,
      "purpose" => $purpose,
      "gcash_number" => $GCASH_NUMBER,
      "gcash_name" => $GCASH_NAME,
      "gcash_qr" => $GCASH_QR,
      $isPublicWorkshop ? "registration" : "booking" => array_merge($paymentEntity, $common)
    ]);
    exit();
  }

  if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    json_fail("Method not allowed", 405);
  }

  $referenceNo = trim($_POST["reference_no"] ?? "");
  $payerName = trim($_POST["payer_name"] ?? "");
  $amountRaw = trim($_POST["amount"] ?? "");
  $paymentChoice = strtolower(trim($_POST["payment_choice"] ?? ""));

  $allowedChoices = $isPublicWorkshop
    ? ["full"]
    : ["downpayment", "remaining", "full"];

  if (!in_array($paymentChoice, $allowedChoices, true)) {
    json_fail("Invalid payment option");
  }

  if (!$isPublicWorkshop) {
    if (
      ($paymentStatus === "unpaid" || $paymentStatus === "rejected") &&
      !in_array($paymentChoice, ["downpayment", "full"], true)
    ) {
      json_fail("Invalid payment option for unpaid booking");
    }

    if ($paymentStatus === "partial" && $paymentChoice !== "remaining") {
      json_fail("Only remaining balance payment is allowed.");
    }
  }

  if ($paymentStatus === "paid") {
    json_fail("This is already fully paid.");
  }

  if ($referenceNo === "" || $payerName === "" || $amountRaw === "") {
    json_fail("Please enter payer name, reference number, and amount.");
  }

  if (!preg_match("/^\d+(\.\d{1,2})?$/", $amountRaw)) {
    json_fail("Invalid amount format");
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
    json_fail("Invalid payment amount. Please refresh the page and try again.");
  }

  if (!isset($_FILES["proof"]) || $_FILES["proof"]["error"] !== UPLOAD_ERR_OK) {
    json_fail("Please upload your payment proof screenshot.");
  }

  if ($_FILES["proof"]["size"] > 5 * 1024 * 1024) {
    json_fail("File must be 5MB or smaller.");
  }

  $tmp = $_FILES["proof"]["tmp_name"];
  $name = $_FILES["proof"]["name"];
  $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));

  if (!in_array($ext, ["jpg", "jpeg", "png", "webp"], true)) {
    json_fail("Invalid file type. Upload JPG, PNG, or WEBP only.");
  }

  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  $mime = finfo_file($finfo, $tmp);
  finfo_close($finfo);

  if (!in_array($mime, ["image/jpeg", "image/png", "image/webp"], true)) {
    json_fail("Invalid image file.");
  }

  $uploadDir = __DIR__ . "/../uploads/payments";

  if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) {
    json_fail("Failed to prepare upload folder.", 500);
  }

  $paymentToken = bin2hex(random_bytes(16));
  $fileName = "gcash_" . $paymentToken . "." . $ext;
  $destAbs = $uploadDir . "/" . $fileName;
  $destRel = "uploads/payments/" . $fileName;

  if (!move_uploaded_file($tmp, $destAbs)) {
    json_fail("Upload failed. Please try again.", 500);
  }

  $context = array_merge($contextBase, [
    "payment_choice" => $paymentChoice,
    "total_amount" => $totalAmount,
    "amount_paid_before_submission" => $amountPaid,
    "downpayment_percentage" => $downpaymentPercentage,
    "downpayment_amount" => $downpaymentAmount,
    "remaining_amount" => $remainingAmount,
    "expected_payment_amount" => $expectedAmount
  ]);

  if (!$isPublicWorkshop) {
    $notesDecoded = json_decode((string)($paymentEntity["notes"] ?? ""), true);

    if (is_array($notesDecoded)) {
      if (isset($notesDecoded["selected_items"])) {
        $context["selected_items"] = $notesDecoded["selected_items"];
      }

      if (isset($notesDecoded["cup_quantity"])) {
        $context["cup_quantity"] = $notesDecoded["cup_quantity"];
      }

      if (isset($notesDecoded["menu_package"])) {
        $context["menu_package"] = $notesDecoded["menu_package"];
      }

      if (isset($notesDecoded["standard_attendees"])) {
        $context["standard_attendees"] = $notesDecoded["standard_attendees"];
      }

      if (isset($notesDecoded["premium_attendees"])) {
        $context["premium_attendees"] = $notesDecoded["premium_attendees"];
      }
    }
  }

  $contextJson = json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($contextJson === false) {
    $contextJson = "{}";
  }

  $conn->begin_transaction();

  try {
    $hasPending = has_pending_payment(
      $conn,
      $isPublicWorkshop,
      $registrationId,
      $bookingId,
      $purposeList
    );

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

    if (!$stmt) {
      throw new Exception("Failed to prepare payment insert.");
    }

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

      if (!$up) {
        throw new Exception("Failed to prepare registration update.");
      }

      $up->bind_param("ii", $registrationId, $userId);
    } else {
      $up = $conn->prepare("
        UPDATE bookings
        SET
          payment_status = 'pending',
          status = CASE
            WHEN status = 'pending_payment' THEN 'pending'
            ELSE status
          END
        WHERE id = ?
          AND user_id = ?
      ");

      if (!$up) {
        throw new Exception("Failed to prepare booking update.");
      }

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
      "payment_choice" => $paymentChoice,
      "purpose" => $purpose
    ]);
    exit();

  } catch (Exception $e) {
    $conn->rollback();

    if (file_exists($destAbs)) {
      @unlink($destAbs);
    }

    json_fail($e->getMessage());
  }

} catch (Exception $e) {
  json_fail($e->getMessage(), 500);
}
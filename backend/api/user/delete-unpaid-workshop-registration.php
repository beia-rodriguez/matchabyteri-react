<?php
session_start();

require_once __DIR__ . "/../../config/db.php";

header("Content-Type: application/json; charset=utf-8");

date_default_timezone_set("Asia/Manila");

function jsonResponse($statusCode, $data) {
    http_response_code($statusCode);
    echo json_encode($data);
    exit();
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    jsonResponse(405, [
        "success" => false,
        "error" => "Method not allowed."
    ]);
}

if (!isset($_SESSION["user_id"])) {
    jsonResponse(401, [
        "success" => false,
        "error" => "Unauthorized. Please login again."
    ]);
}

$userId = (int) $_SESSION["user_id"];

$input = [];

if (!empty($_POST)) {
    $input = $_POST;
} else {
    $rawInput = file_get_contents("php://input");
    $jsonInput = json_decode($rawInput, true);

    if (is_array($jsonInput)) {
        $input = $jsonInput;
    }
}

$registrationId = isset($input["registration_id"]) ? (int) $input["registration_id"] : 0;

if ($registrationId <= 0) {
    jsonResponse(400, [
        "success" => false,
        "error" => "Invalid registration ID."
    ]);
}

$stmt = $conn->prepare("
    SELECT
        id,
        user_id,
        workshop_id,
        package,
        status,
        payment_status,
        total_amount
    FROM workshop_registrations
    WHERE id = ?
    LIMIT 1
");

if (!$stmt) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while checking workshop registration."
    ]);
}

$stmt->bind_param("i", $registrationId);
$stmt->execute();

$result = $stmt->get_result();
$registration = $result->fetch_assoc();

$stmt->close();

if (!$registration) {
    jsonResponse(404, [
        "success" => false,
        "error" => "Workshop registration not found."
    ]);
}

if ((int) $registration["user_id"] !== $userId) {
    jsonResponse(403, [
        "success" => false,
        "error" => "You are not allowed to delete this workshop registration."
    ]);
}

$status = strtolower(trim((string) ($registration["status"] ?? "")));
$paymentStatus = strtolower(trim((string) ($registration["payment_status"] ?? "")));

if ($paymentStatus !== "unpaid") {
    jsonResponse(400, [
        "success" => false,
        "error" => "Only unpaid workshop registrations can be deleted."
    ]);
}

if ($status !== "pending") {
    jsonResponse(400, [
        "success" => false,
        "error" => "This workshop registration cannot be deleted because its status is " . ($registration["status"] ?? "unknown") . "."
    ]);
}

/*
  Safety check:
  If there is already a pending or paid payment proof,
  do not delete the public workshop registration.
*/
$paymentCheck = $conn->prepare("
    SELECT id
    FROM payments
    WHERE registration_id = ?
      AND status IN ('pending', 'paid')
    LIMIT 1
");

if (!$paymentCheck) {
    jsonResponse(500, [
        "success" => false,
        "error" => "Database error while checking payments."
    ]);
}

$paymentCheck->bind_param("i", $registrationId);
$paymentCheck->execute();

$paymentResult = $paymentCheck->get_result();
$existingPayment = $paymentResult->fetch_assoc();

$paymentCheck->close();

if ($existingPayment) {
    jsonResponse(409, [
        "success" => false,
        "error" => "This workshop registration already has a payment record and cannot be deleted."
    ]);
}

$conn->begin_transaction();

try {
    /*
      Remove rejected or unused payment rows first, if any.
      This prevents foreign key problems if payments reference registrations.
    */
    $deleteRejectedPayments = $conn->prepare("
        DELETE FROM payments
        WHERE registration_id = ?
          AND status = 'rejected'
    ");

    if (!$deleteRejectedPayments) {
        throw new Exception("Database error while preparing payment cleanup.");
    }

    $deleteRejectedPayments->bind_param("i", $registrationId);
    $deleteRejectedPayments->execute();
    $deleteRejectedPayments->close();

    /*
      Optional cleanup if your database has payment_reviews.
    */
    $tableCheck = $conn->query("SHOW TABLES LIKE 'payment_reviews'");

    if ($tableCheck && $tableCheck->num_rows > 0) {
        $deleteReviews = $conn->prepare("
            DELETE FROM payment_reviews
            WHERE registration_id = ?
        ");

        if ($deleteReviews) {
            $deleteReviews->bind_param("i", $registrationId);
            $deleteReviews->execute();
            $deleteReviews->close();
        }
    }

    /*
      Delete only if it is still owned by the user,
      still unpaid, and still pending.
    */
    $deleteRegistration = $conn->prepare("
        DELETE FROM workshop_registrations
        WHERE id = ?
          AND user_id = ?
          AND payment_status = 'unpaid'
          AND status = 'pending'
        LIMIT 1
    ");

    if (!$deleteRegistration) {
        throw new Exception("Database error while preparing workshop registration delete.");
    }

    $deleteRegistration->bind_param("ii", $registrationId, $userId);
    $deleteRegistration->execute();

    if ($deleteRegistration->affected_rows <= 0) {
        $deleteRegistration->close();
        throw new Exception("Workshop registration was not deleted. It may have already changed status.");
    }

    $deleteRegistration->close();

    $conn->commit();

    jsonResponse(200, [
        "success" => true,
        "message" => "Unpaid workshop registration deleted successfully.",
        "registration_id" => $registrationId,
        "workshop_id" => (int) $registration["workshop_id"],
        "package" => $registration["package"]
    ]);
} catch (Exception $e) {
    $conn->rollback();

    jsonResponse(500, [
        "success" => false,
        "error" => $e->getMessage()
    ]);
}
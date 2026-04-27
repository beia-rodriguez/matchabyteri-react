<?php
session_start();
require_once "../../../config/db.php"; // $conn = mysqli connection

header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit();
}

$user_id = (int)$_SESSION["user_id"];
$data = json_decode(file_get_contents("php://input"), true);

// Log incoming request for debugging
file_put_contents('debug.log', "Incoming request: " . json_encode($data, JSON_PRETTY_PRINT) . PHP_EOL, FILE_APPEND);

$date       = $data["date"] ?? "";
$start_time = $data["start_time"] ?? "";
$end_time   = $data["end_time"] ?? "";
$draft      = $data["draft"] ?? [];

if (!$date || !$start_time || !$end_time) {
    $msg = "Missing required data";
    file_put_contents('debug.log', "Error: $msg" . PHP_EOL, FILE_APPEND);
    echo json_encode(["error" => $msg]);
    exit();
}

// Normalize time
if (strlen($start_time) === 5) $start_time .= ":00";
if (strlen($end_time) === 5) $end_time .= ":00";

$startTs = strtotime("$date $start_time");
$endTs   = strtotime("$date $end_time");

if ($endTs <= $startTs) {
    $msg = "End time must be after start time";
    file_put_contents('debug.log', "Error: $msg" . PHP_EOL, FILE_APPEND);
    echo json_encode(["error" => $msg]);
    exit();
}

if (($endTs - $startTs) > (4 * 60 * 60)) {
    $msg = "Work hours must be up to 4 hours only";
    file_put_contents('debug.log', "Error: $msg" . PHP_EOL, FILE_APPEND);
    echo json_encode(["error" => $msg]);
    exit();
}

// Encode notes
$notesJson = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($notesJson === false) $notesJson = "{}";

$conn->begin_transaction();

try {
    // Check overlapping bookings
    $stmt = $conn->prepare("
        SELECT id
        FROM bookings
        WHERE booking_date = ?
          AND status IN ('pending','approved')
          AND (start_time < ? AND end_time > ?)
        LIMIT 1
    ");
    $stmt->bind_param("sss", $date, $end_time, $start_time);
    $stmt->execute();
    $result = $stmt->get_result();
    $stmt->close();

    if ($result->num_rows > 0) {
        $conn->rollback();
        $msg = "That time slot is already booked. Please choose another time.";
        file_put_contents('debug.log', "Error: $msg" . PHP_EOL, FILE_APPEND);
        echo json_encode(["error" => $msg]);
        exit();
    }

    // Insert booking
    $insert = $conn->prepare("
    INSERT INTO bookings
    (user_id, booking_date, start_time, end_time, booking_type, status, notes)
    VALUES (?, ?, ?, ?, 'event', 'pending', ?)
");
    $insert->bind_param("issss", $user_id, $date, $start_time, $end_time, $notesJson);

    if (!$insert->execute()) {
        throw new Exception("Insert failed: " . $insert->error);
    }

    $bookingId = $conn->insert_id;
    $insert->close();

    $conn->commit();

    // Return success + booking_id + draft for debugging in React
    echo json_encode([
        "success" => true,
        "booking_id" => $bookingId,
        "draft" => $draft
    ]);

} catch (Exception $e) {
    $conn->rollback();

    // Log detailed error including the draft JSON for debugging
    $errorLog = [
        "error_message" => $e->getMessage(),
        "request_data" => $data
    ];
    file_put_contents('debug.log', "Exception: " . json_encode($errorLog, JSON_PRETTY_PRINT) . PHP_EOL, FILE_APPEND);

    echo json_encode([
        "error" => "Something went wrong. Check debug.log for details."
    ]);
}
<?php
require_once __DIR__ . "/admin-common-api.php";

function decode_context($raw) {
  if (!is_string($raw) || trim($raw) === "") return [];

  $data = json_decode($raw, true);

  return is_array($data) ? $data : [];
}

function short_token($t) {
  $t = (string)$t;

  if ($t === "") return "";
  if (mb_strlen($t) <= 10) return $t;

  return mb_substr($t, 0, 4) . "..." . mb_substr($t, -4);
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {
  $raw = file_get_contents("php://input");
  $data = json_decode($raw, true);

  if (!is_array($data)) {
    $data = [];
  }

  verify_csrf_json($data, $csrf);

  if (($data["action"] ?? "") === "set_payment_status") {
    $pid = (int)($data["payment_id"] ?? 0);
    $newStatus = strtolower(trim($data["status"] ?? ""));
    $adminNote = trim($data["admin_note"] ?? "");

    $allowed = ["pending", "paid", "rejected"];

    if ($pid <= 0 || !in_array($newStatus, $allowed, true)) {
      echo json_encode(["error" => "Invalid payment update."]);
      exit();
    }

    $stmt = $conn->prepare("
      SELECT id, booking_id, context_json, status
      FROM payments
      WHERE id = ?
      LIMIT 1
    ");

    if (!$stmt) {
      echo json_encode(["error" => "Failed to prepare payment lookup."]);
      exit();
    }

    $stmt->bind_param("i", $pid);
    $stmt->execute();
    $cur = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$cur) {
      echo json_encode(["error" => "Payment not found."]);
      exit();
    }

    $bookingId = (int)($cur["booking_id"] ?? 0);
    $ctx = decode_context($cur["context_json"] ?? "");
    $oldStatus = strtolower((string)($cur["status"] ?? "pending"));
    $paymentChoice = strtolower((string)($ctx["payment_choice"] ?? "full"));

    if ($oldStatus === "paid" && $newStatus !== "paid") {
      echo json_encode([
        "error" => "Paid payments cannot be changed back to pending or rejected."
      ]);
      exit();
    }

    $ctx["_admin"] = [
      "note" => $adminNote,
      "updated_by" => (int)($_SESSION["user_id"] ?? 0),
      "updated_at" => date("Y-m-d H:i:s"),
      "from_status" => $oldStatus,
      "to_status" => $newStatus
    ];

    if ($newStatus === "paid") {
      $ctx["_paid_at"] = date("Y-m-d H:i:s");
    } else {
      unset($ctx["_paid_at"]);
    }

    $ctxJson = json_encode($ctx, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    if ($ctxJson === false || $ctxJson === "") {
      $ctxJson = "{}";
    }

    if ($newStatus === "paid") {
      if ($paymentChoice === "downpayment") {
        $bookingPaymentStatus = "partial";
      } else {
        $bookingPaymentStatus = "paid";
      }
    } elseif ($newStatus === "rejected") {
      $bookingPaymentStatus = "rejected";
    } else {
      $bookingPaymentStatus = "pending";
    }

    $conn->begin_transaction();

    try {
      $stmt = $conn->prepare("
        UPDATE payments
        SET status = ?, context_json = ?
        WHERE id = ?
        LIMIT 1
      ");

      if (!$stmt) {
        throw new Exception("Failed to prepare payment update.");
      }

      $stmt->bind_param("ssi", $newStatus, $ctxJson, $pid);

      if (!$stmt->execute()) {
        throw new Exception($stmt->error);
      }

      $stmt->close();
      
    if ($bookingId > 0) {
        // If the new status is 'paid' and it wasn't already 'paid', update balance
        if ($newStatus === "paid" && $oldStatus !== "paid") {
            $bstmt = $conn->prepare("
              UPDATE bookings
              SET payment_status = ?, amount_paid = amount_paid + ?
              WHERE id = ?
              LIMIT 1
            ");
            $bstmt->bind_param("sdi", $bookingPaymentStatus, $paymentAmount, $bookingId);
        } else {
            // Otherwise just update the payment status string
            $bstmt = $conn->prepare("
              UPDATE bookings
              SET payment_status = ?
              WHERE id = ?
              LIMIT 1
            ");
            $bstmt->bind_param("si", $bookingPaymentStatus, $bookingId);
        }

        if (!$bstmt) throw new Exception("Failed to prepare booking update.");
        if (!$bstmt->execute()) throw new Exception($bstmt->error);
        $bstmt->close();
    }
      $conn->commit();

      echo json_encode([
        "success" => true,
        "message" => "Payment and booking payment status updated."
      ]);
      exit();

    } catch (Exception $e) {
      $conn->rollback();

      error_log("admin-payments update error: " . $e->getMessage());

      echo json_encode([
        "error" => "Failed to update payment."
      ]);
      exit();
    }
  }

  echo json_encode(["error" => "Invalid action."]);
  exit();
}

$statusFilter = strtolower(trim($_GET["status"] ?? "pending"));
$allowedStatus = ["all", "pending", "paid", "rejected"];

if (!in_array($statusFilter, $allowedStatus, true)) {
  $statusFilter = "pending";
}

$q = trim($_GET["q"] ?? "");

$payments = [];

if ($statusFilter === "all" && $q === "") {
  $stmt = $conn->prepare("
    SELECT
      p.*,
      u.name AS user_name,
      u.email AS user_email,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_type,
      b.payment_status,
      b.total_amount
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    ORDER BY p.created_at DESC
    LIMIT 120
  ");
} elseif ($statusFilter !== "all" && $q === "") {
  $stmt = $conn->prepare("
    SELECT
      p.*,
      u.name AS user_name,
      u.email AS user_email,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_type,
      b.payment_status,
      b.total_amount
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE p.status = ?
    ORDER BY p.created_at DESC
    LIMIT 120
  ");

  $stmt->bind_param("s", $statusFilter);
} elseif ($statusFilter === "all" && $q !== "") {
  $like = "%" . $q . "%";

  $stmt = $conn->prepare("
    SELECT
      p.*,
      u.name AS user_name,
      u.email AS user_email,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_type,
      b.payment_status,
      b.total_amount
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE (
      u.name LIKE ?
      OR u.email LIKE ?
      OR p.payer_name LIKE ?
      OR p.reference_no LIKE ?
      OR p.purpose LIKE ?
      OR p.payment_token LIKE ?
      OR CAST(p.booking_id AS CHAR) LIKE ?
    )
    ORDER BY p.created_at DESC
    LIMIT 120
  ");

  $stmt->bind_param(
    "sssssss",
    $like,
    $like,
    $like,
    $like,
    $like,
    $like,
    $like
  );
} else {
  $like = "%" . $q . "%";

  $stmt = $conn->prepare("
    SELECT
      p.*,
      u.name AS user_name,
      u.email AS user_email,
      b.booking_date,
      b.start_time,
      b.end_time,
      b.booking_type,
      b.payment_status,
      b.total_amount
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE p.status = ?
      AND (
        u.name LIKE ?
        OR u.email LIKE ?
        OR p.payer_name LIKE ?
        OR p.reference_no LIKE ?
        OR p.purpose LIKE ?
        OR p.payment_token LIKE ?
        OR CAST(p.booking_id AS CHAR) LIKE ?
      )
    ORDER BY p.created_at DESC
    LIMIT 120
  ");

  $stmt->bind_param(
    "ssssssss",
    $statusFilter,
    $like,
    $like,
    $like,
    $like,
    $like,
    $like,
    $like
  );
}

if (!$stmt) {
  echo json_encode(["error" => "Failed to load payments."]);
  exit();
}

$stmt->execute();
$res = $stmt->get_result();

while ($r = $res->fetch_assoc()) {
  $ctx = decode_context($r["context_json"] ?? "");

  $r["short_payment_token"] = short_token($r["payment_token"] ?? "");
  $r["decoded_context"] = $ctx;

  $payments[] = $r;
}

$stmt->close();

$counts = [
  "all" => 0,
  "pending" => 0,
  "paid" => 0,
  "rejected" => 0
];

$stmt = $conn->prepare("
  SELECT status, COUNT(*) AS c
  FROM payments
  GROUP BY status
");

if ($stmt) {
  $stmt->execute();

  $res = $stmt->get_result();

  while ($r = $res->fetch_assoc()) {
    $st = strtolower((string)$r["status"]);

    if (isset($counts[$st])) {
      $counts[$st] = (int)$r["c"];
    }

    $counts["all"] += (int)$r["c"];
  }

  $stmt->close();
}

echo json_encode([
  "success" => true,
  "csrf" => $csrf,
  "status" => $statusFilter,
  "q" => $q,
  "counts" => $counts,
  "payments" => $payments
]);
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
  if (!is_array($data)) $data = [];
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

    $stmt = $conn->prepare("SELECT context_json, status FROM payments WHERE id = ? LIMIT 1");
    $stmt->bind_param("i", $pid);
    $stmt->execute();
    $cur = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$cur) {
      echo json_encode(["error" => "Payment not found."]);
      exit();
    }

    $ctx = decode_context($cur["context_json"] ?? "");
    $oldStatus = strtolower((string)($cur["status"] ?? "pending"));

    $ctx["_admin"] = [
      "note" => $adminNote,
      "updated_by" => (int)($_SESSION["user_id"] ?? 0),
      "updated_at" => date("Y-m-d H:i:s"),
      "from_status" => $oldStatus,
      "to_status" => $newStatus
    ];

    if ($newStatus === "paid") $ctx["_paid_at"] = date("Y-m-d H:i:s");
    else unset($ctx["_paid_at"]);

    $ctxJson = json_encode($ctx, JSON_UNESCAPED_SLASHES);

    $stmt = $conn->prepare("
      UPDATE payments
      SET status = ?, context_json = ?
      WHERE id = ?
      LIMIT 1
    ");
    $stmt->bind_param("ssi", $newStatus, $ctxJson, $pid);

    if ($stmt->execute()) {
      echo json_encode(["success" => true, "message" => "Payment updated."]);
    } else {
      error_log("admin-payments update error: " . $stmt->error);
      echo json_encode(["error" => "Failed to update payment."]);
    }
    $stmt->close();
    exit();
  }
}

$statusFilter = strtolower(trim($_GET["status"] ?? "pending"));
$allowedStatus = ["all", "pending", "paid", "rejected"];
if (!in_array($statusFilter, $allowedStatus, true)) $statusFilter = "pending";
$q = trim($_GET["q"] ?? "");

$payments = [];

if ($statusFilter === "all" && $q === "") {
  $stmt = $conn->prepare("
    SELECT p.*, u.name AS user_name, u.email AS user_email,
           b.booking_date, b.start_time, b.end_time, b.booking_type
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    ORDER BY p.created_at DESC
    LIMIT 120
  ");
} elseif ($statusFilter !== "all" && $q === "") {
  $stmt = $conn->prepare("
    SELECT p.*, u.name AS user_name, u.email AS user_email,
           b.booking_date, b.start_time, b.end_time, b.booking_type
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE p.status = ?
    ORDER BY p.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("s", $statusFilter);
} elseif ($statusFilter === "all" && $q !== "") {
  $like = "%".$q."%";
  $stmt = $conn->prepare("
    SELECT p.*, u.name AS user_name, u.email AS user_email,
           b.booking_date, b.start_time, b.end_time, b.booking_type
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE (
      u.name LIKE ? OR u.email LIKE ?
      OR p.payer_name LIKE ? OR p.reference_no LIKE ? OR p.purpose LIKE ?
      OR p.payment_token LIKE ? OR CAST(p.booking_id AS CHAR) LIKE ?
    )
    ORDER BY p.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("sssssss", $like, $like, $like, $like, $like, $like, $like);
} else {
  $like = "%".$q."%";
  $stmt = $conn->prepare("
    SELECT p.*, u.name AS user_name, u.email AS user_email,
           b.booking_date, b.start_time, b.end_time, b.booking_type
    FROM payments p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN bookings b ON p.booking_id = b.id
    WHERE p.status = ? AND (
      u.name LIKE ? OR u.email LIKE ?
      OR p.payer_name LIKE ? OR p.reference_no LIKE ? OR p.purpose LIKE ?
      OR p.payment_token LIKE ? OR CAST(p.booking_id AS CHAR) LIKE ?
    )
    ORDER BY p.created_at DESC
    LIMIT 120
  ");
  $stmt->bind_param("ssssssss", $statusFilter, $like, $like, $like, $like, $like, $like, $like);
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

$counts = ["all"=>0, "pending"=>0, "paid"=>0, "rejected"=>0];
$stmt = $conn->prepare("SELECT status, COUNT(*) c FROM payments GROUP BY status");
$stmt->execute();
$res = $stmt->get_result();
while ($r = $res->fetch_assoc()) {
  $st = strtolower((string)$r["status"]);
  if (isset($counts[$st])) $counts[$st] = (int)$r["c"];
  $counts["all"] += (int)$r["c"];
}
$stmt->close();

echo json_encode([
  "success" => true,
  "csrf" => $csrf,
  "status" => $statusFilter,
  "q" => $q,
  "counts" => $counts,
  "payments" => $payments
]);
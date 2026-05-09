<?php
session_start();

header("Content-Type: application/json");

require_once __DIR__ . "/../../config/db.php";

function respond_json($payload, $code = 200) {
  http_response_code($code);
  echo json_encode($payload);
  exit();
}

if (!isset($_SESSION["user_id"])) {
  respond_json(["status" => "error", "error" => "Unauthorized"], 401);
}

if (!isset($_SESSION["role"]) || $_SESSION["role"] !== "admin") {
  respond_json(["status" => "error", "error" => "Forbidden"], 403);
}

function h($s) {
  return htmlspecialchars((string)$s, ENT_QUOTES, "UTF-8");
}

if (empty($_SESSION["csrf_token"])) {
  $_SESSION["csrf_token"] = bin2hex(random_bytes(32));
}

$csrf = $_SESSION["csrf_token"];

function extract_amount($notesJson) {
  if (!$notesJson) return 0;

  $arr = json_decode($notesJson, true);

  if (!is_array($arr)) return 0;

  foreach (["total_amount", "payment_amount", "amount", "total", "paid_amount", "totalPaid"] as $k) {
    if (isset($arr[$k])) {
      $val = preg_replace("/[^\d.]/", "", (string)$arr[$k]);
      return (float)$val;
    }
  }

  return 0;
}

function require_post() {
  if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    respond_json(["status" => "error", "error" => "Method not allowed"], 405);
  }
}

function get_json_payload() {
  $payload = json_decode(file_get_contents("php://input"), true);

  if (!is_array($payload)) {
    respond_json(["status" => "error", "error" => "Invalid JSON payload."], 400);
  }

  return $payload;
}

function verify_csrf_json($payload, $csrf) {
  if (!hash_equals($csrf, $payload["csrf_token"] ?? "")) {
    respond_json(["status" => "error", "error" => "Invalid request (CSRF)."], 400);
  }
}
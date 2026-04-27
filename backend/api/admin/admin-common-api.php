<?php
// admin-common-api.php
session_start();
require_once __DIR__ . "/../../config/db.php";
header("Content-Type: application/json");

if (!isset($_SESSION["user_id"])) {
  http_response_code(401);
  echo json_encode(["error" => "Unauthorized"]);
  exit();
}

if (!isset($_SESSION["role"]) || $_SESSION["role"] !== "admin") {
  http_response_code(403);
  echo json_encode(["error" => "Forbidden"]);
  exit();
}

function h($s){ return htmlspecialchars((string)$s, ENT_QUOTES, "UTF-8"); }

if (empty($_SESSION["csrf_token"])) {
  $_SESSION["csrf_token"] = bin2hex(random_bytes(16));
}
$csrf = $_SESSION["csrf_token"];

function extract_amount($notesJson){
  if (!$notesJson) return 0;
  $arr = json_decode($notesJson, true);
  if (!is_array($arr)) return 0;

  foreach (["total_amount","payment_amount","amount","total","paid_amount","totalPaid"] as $k) {
    if (isset($arr[$k])) {
      $val = preg_replace("/[^\d.]/", "", (string)$arr[$k]);
      return (float)$val;
    }
  }
  return 0;
}

function require_post(){
  if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
    exit();
  }
}

function verify_csrf_json($payload, $csrf){
  if (!hash_equals($csrf, $payload["csrf_token"] ?? "")) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request (CSRF)."]);
    exit();
  }
}
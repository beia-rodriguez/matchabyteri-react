<?php
header("Content-Type: application/json; charset=utf-8");

echo json_encode([
    "success" => true,
    "test" => "CORRECT FILE IS RUNNING"
]);
exit();
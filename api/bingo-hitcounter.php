<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

require_once __DIR__ . '/database.php';

try {
    $pdo->exec("UPDATE bingo_hitcounter SET hits = hits + 1 WHERE id = 1");
    $stmt = $pdo->query("SELECT hits FROM bingo_hitcounter WHERE id = 1");
    $row = $stmt->fetch();
    echo json_encode(['hits' => (int) $row['hits']]);
} catch (PDOException $e) {
    error_log("Hit counter failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Counter failed']);
}
?>
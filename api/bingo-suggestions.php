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

$input = json_decode(file_get_contents('php://input'), true);
$suggestion = htmlspecialchars(trim($input['suggestion'] ?? ''), ENT_QUOTES, 'UTF-8');

if ($suggestion === '') {
    http_response_code(400);
    echo json_encode(['error' => 'Suggestion cannot be empty']);
    exit();
}

if (strlen($suggestion) > 200) {
    http_response_code(400);
    echo json_encode(['error' => 'Suggestion must be 200 characters or less']);
    exit();
}

try {
    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    $stmt = $pdo->prepare("INSERT INTO bingo_suggestions (suggestion, ip_address) VALUES (:suggestion, :ip)");
    $stmt->execute(['suggestion' => $suggestion, 'ip' => $ip]);
    echo json_encode(['success' => true, 'message' => 'Suggestion submitted!']);
} catch (PDOException $e) {
    error_log("Bingo suggestion insert failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save suggestion']);
}
?>
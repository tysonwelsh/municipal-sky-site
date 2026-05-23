<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/database.php';

// GET — fetch entries
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $stmt = $pdo->query("SELECT name, message, signed_at FROM bingo_guestbook ORDER BY signed_at DESC LIMIT 100");
        $entries = $stmt->fetchAll();
        echo json_encode(['entries' => $entries]);
    } catch (PDOException $e) {
        error_log("Guestbook fetch failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load guestbook']);
    }
    exit();
}

// POST — add entry
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $name = htmlspecialchars(trim($input['name'] ?? ''), ENT_QUOTES, 'UTF-8');
    $message = htmlspecialchars(trim($input['message'] ?? ''), ENT_QUOTES, 'UTF-8');

    if ($name === '' || $message === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Name and message are required']);
        exit();
    }

    if (strlen($name) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Name must be 100 characters or less']);
        exit();
    }

    if (strlen($message) > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'Message must be 500 characters or less']);
        exit();
    }

    try {
        $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
        $stmt = $pdo->prepare("INSERT INTO bingo_guestbook (name, message, ip_address) VALUES (:name, :message, :ip)");
        $stmt->execute(['name' => $name, 'message' => $message, 'ip' => $ip]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        error_log("Guestbook insert failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to sign guestbook']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
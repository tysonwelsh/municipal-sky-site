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

$input = json_decode(file_get_contents('php://input'), true) ?? [];

// Honeypot. The form includes a hidden "website" field that real users never
// see or fill. Bots fill every field, so if it has any value we pretend to
// succeed and store nothing — no IP, no logging, no error that would tell a
// bot it was caught.
if (!empty($input['website'])) {
    echo json_encode(['success' => true, 'message' => 'Thanks for subscribing.']);
    exit();
}

$email = trim(strtolower($input['email'] ?? ''));
// "source" is just the page path someone signed up from (e.g. "/chatbots/").
// It is not personal data; it helps me see which pages drive signups.
$source = isset($input['source']) ? substr(trim($input['source']), 0, 255) : null;

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit();
}

require_once __DIR__ . '/database.php';

try {
    // Self-bootstrapping: create the table on first use, so deploying this file
    // is all that's needed to go live. IF NOT EXISTS is a no-op once the table
    // exists and never touches existing data.
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS subscribers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            source VARCHAR(255) DEFAULT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'subscribed',
            token CHAR(40) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_email (email)
        )"
    );
    // INSERT IGNORE relies on the UNIQUE key on `email`. Re-subscribing an
    // existing address is a silent no-op, and we still return success — so the
    // form never reveals whether an address is already on the list.
    $stmt = $pdo->prepare("INSERT IGNORE INTO subscribers (email, source) VALUES (:email, :source)");
    $stmt->execute(['email' => $email, 'source' => $source]);
    echo json_encode(['success' => true, 'message' => 'Thanks — you are on the list.']);
} catch (PDOException $e) {
    error_log("Subscribe failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Something went wrong. Please try again later.']);
}
?>

<?php
// Load secrets - check local first, then production
if (file_exists(__DIR__ . '/../config/secrets.php')) {
    // Local development
    $secrets = include __DIR__ . '/../config/secrets.php';
} else {
    // Production server
    $secrets = include '/home1/tdrivemy/private_config/secrets.php';
}


// Database configuration
$db_host = 'localhost';
$db_name = $secrets['db_name'];
$db_user = $secrets['db_user'];
$db_pass = $secrets['db_pass'];

try {
    // Create PDO connection
    $pdo = new PDO(
        "mysql:host=$db_host;dbname=$db_name;charset=utf8mb4",
        $db_user,
        $db_pass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    if (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false) {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit();
    }
    die('Database connection failed. Please try again later.');
}

?>
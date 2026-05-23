<?php
// One-time setup script — delete after running
require_once __DIR__ . '/database.php';

try {
    $pdo->exec("
        CREATE TABLE pronoun_viz_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            event_type ENUM('page_view', 'png_download') NOT NULL,
            chart_name VARCHAR(255) DEFAULT NULL,
            ip_address VARCHAR(45) DEFAULT NULL,
            country VARCHAR(100) DEFAULT NULL,
            city VARCHAR(100) DEFAULT NULL,
            region VARCHAR(100) DEFAULT NULL,
            user_agent TEXT DEFAULT NULL,
            referer TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_event_type (event_type),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "pronoun_viz_events table created successfully!";
} catch (PDOException $e) {
    echo "Failed: " . $e->getMessage();
}
?>

<?php
// One-time setup script — delete after running.
// Generic per-page event table shared by page-event-tracking.php.
require_once __DIR__ . '/database.php';

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS page_events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            page VARCHAR(64) NOT NULL,
            event_type VARCHAR(32) NOT NULL,
            label VARCHAR(255) DEFAULT NULL,
            visitor_hash CHAR(64) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_page (page),
            INDEX idx_page_visitor (page, visitor_hash),
            INDEX idx_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "page_events table created successfully!";
} catch (PDOException $e) {
    echo "Failed: " . $e->getMessage();
}
?>

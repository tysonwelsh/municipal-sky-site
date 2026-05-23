<?php
// One-time setup script — delete after running
require_once __DIR__ . '/database.php';

try {
    $pdo->exec("DROP TABLE IF EXISTS bingo_downloads");
    $pdo->exec("
        CREATE TABLE bingo_downloads (
            id INT AUTO_INCREMENT PRIMARY KEY,
            ip_address VARCHAR(45),
            country VARCHAR(100),
            city VARCHAR(100),
            region VARCHAR(100),
            num_cards INT NOT NULL DEFAULT 1,
            user_agent TEXT,
            referer VARCHAR(500),
            downloaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_downloaded (downloaded_at),
            INDEX idx_ip (ip_address)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    echo "bingo_downloads table recreated successfully!";
} catch (PDOException $e) {
    echo "Failed: " . $e->getMessage();
}
?>
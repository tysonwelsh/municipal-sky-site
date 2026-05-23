<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

// Use absolute path
$secrets = include '/home1/tdrivemy/private_config/secrets.php';

// Basic health check
$health = [
    'claude' => !empty($secrets['claude_key']),
    'gemini' => !empty($secrets['gemini_key']),
    'openai' => !empty($secrets['openai_key'])
];

echo json_encode($health);
?>
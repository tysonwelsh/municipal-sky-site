<?php
// Cache bust v2
// --------------------
// Onomatopoeia Chatbot API (Claude + OpenAI)
// --------------------

// TEMPORARY DEBUG MODE - Remove after fixing
$debug_mode = true;
$debug_info = [];

if ($debug_mode) {
    ini_set('display_errors', 0); // Keep off to not break JSON
    error_reporting(E_ALL);
    $debug_info['error_log_location'] = ini_get('error_log');
}

// Set CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

// Ensure the request method is POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Load API keys from secure location
$secrets = include '/home1/tdrivemy/private_config/secrets.php';
$claude_key = $secrets['claude_key'] ?? null;
$openai_key = $secrets['openai_key'] ?? null;
$gemini_key = $secrets['gemini_key'] ?? null;

// ============================================
// MODEL CONFIGURATION - Update models here only
// ============================================
$claude_model = 'claude-haiku-4-5-20251001';
$openai_model = 'gpt-4o-mini';

// Validate API keys are loaded
if (empty($claude_key) || empty($openai_key)) {
    http_response_code(500);
    echo json_encode(['error' => 'API keys not loaded correctly. Check secrets.php']);
    exit();
}

// Get and validate message from input
$input = json_decode(file_get_contents('php://input'), true);
$message = $input['message'] ?? '';
$sliderValue = $input['sliderValue'] ?? 0.6;

// Validate slider value and map to temperature
$sliderValue = max(0, min(1, floatval($sliderValue)));
$temperature = 0.5 + ($sliderValue * 0.5);

if (empty($message) || strlen($message) > 500) {
    http_response_code(400);
    echo json_encode(['error' => 'Message is required and must be under 500 characters']);
    exit();
}

// Define the system prompt
$system_prompt = "The user will input a description of a sound, creature, object, event or some other entity. The assistant will output an onomatopoeia which accurately transcribes the sound made by what is described in the input into text form. The onomatopoeias in the output must be inventive, modernist, and realist in style; influenced by James Joyce. Examples of desired input/output taken from the works of James Joyce include: cat - Mrkgnao, fart - Pprrpffrrppffff, Tram - Tram kran kran kran. Krandlkrankran, Printing press - Sllt. The assistant must include only onomatopoeia in the output, with no additional text or extraneous information. The assistant's response must be limited to 100 characters in length.";

// ----------------------------------------------------
// Claude API function
// ----------------------------------------------------
function callClaude($message, $api_key, $system_prompt, $temperature, $model)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.anthropic.com/v1/messages');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $api_key,
        'anthropic-version: 2023-06-01'
    ]);

    $payload = [
        'model' => $model,
        'max_tokens' => 150,
        'temperature' => $temperature,
        'system' => $system_prompt,
        'messages' => [
            ['role' => 'user', 'content' => $message]
        ]
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'message' => 'cURL error: ' . $curlError];
    }

    if ($httpCode !== 200) {
        $error_data = json_decode($response, true);
        $error_message = 'Claude API error: HTTP ' . $httpCode;
        if (isset($error_data['error']['message'])) {
            $error_message .= ' - ' . $error_data['error']['message'];
        }
        return ['success' => false, 'message' => $error_message, 'raw_response' => $response];
    }

    $data = json_decode($response, true);
    if (isset($data['content'][0]['text'])) {
        return ['success' => true, 'message' => trim($data['content'][0]['text'])];
    }

    return ['success' => false, 'message' => 'Invalid Claude response: ' . substr($response, 0, 300)];
}

// ----------------------------------------------------
// OpenAI API function (with improved error handling)
// ----------------------------------------------------
function callOpenAI($message, $api_key, $system_prompt, $temperature, $model)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.openai.com/v1/chat/completions');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $api_key
    ]);

    $payload = [
        'model' => $model,
        'temperature' => $temperature,
        'max_tokens' => 150,
        'messages' => [
            ['role' => 'system', 'content' => $system_prompt],
            ['role' => 'user', 'content' => $message]
        ]
    ];

    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($curlError) {
        return ['success' => false, 'message' => 'cURL error: ' . $curlError];
    }

    if ($httpCode !== 200) {
        $error_data = json_decode($response, true);
        $error_message = 'OpenAI API error: HTTP ' . $httpCode;
        if (isset($error_data['error']['message'])) {
            $error_message .= ' - ' . $error_data['error']['message'];
        }
        return ['success' => false, 'message' => $error_message, 'raw_response' => $response];
    }

    $data = json_decode($response, true);
    if (isset($data['choices'][0]['message']['content'])) {
        return ['success' => true, 'message' => trim($data['choices'][0]['message']['content'])];
    }

    return ['success' => false, 'message' => 'Invalid OpenAI response: ' . substr($response, 0, 300)];
}

// ----------------------------------------------------
// Call both APIs with the dynamic temperature
// ----------------------------------------------------
$claude_result = callClaude($message, $claude_key, $system_prompt, $temperature, $claude_model);
$openai_result = callOpenAI($message, $openai_key, $system_prompt, $temperature, $openai_model);

// Optional: log detailed results for debugging (safe, server-side only)
error_log("Claude result: " . print_r($claude_result, true));
error_log("OpenAI result: " . print_r($openai_result, true));

// ----------------------------------------------------
// Save conversation to database
// ----------------------------------------------------
include 'database.php';

try {
    $conversation_id = uniqid(time(), true);
    $session_id = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

    $stmt = $pdo->prepare("
        INSERT INTO conversations (
            id, timestamp, user_message, claude_response, openai_response, 
            temperature, session_id
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $conversation_id,
        substr($message, 0, 500),
        $claude_result['success'] ? substr($claude_result['message'], 0, 200) : null,
        $openai_result['success'] ? substr($openai_result['message'], 0, 200) : null,
        $temperature,
        $session_id
    ]);

    error_log("Conversation saved successfully with ID: $conversation_id");

} catch (PDOException $e) {
    // Don't fail the response if database save fails
    error_log("Failed to save conversation: " . $e->getMessage());
}

// ----------------------------------------------------
// Output combined results as JSON
// ----------------------------------------------------
$output = [
    'claude' => $claude_result,
    'openai' => $openai_result,
    'temperature_used' => $temperature,
    'model_a' => $claude_model,
    'model_b' => $openai_model
];

if ($debug_mode) {
    $output['debug'] = $debug_info;
}

echo json_encode($output);
?>
<?php
// Set CORS headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // Consider restricting this in production
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
$gemini_key = $secrets['gemini_key'] ?? null;

// Validate API keys are loaded
if (empty($claude_key) || empty($gemini_key)) {
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
$temperature = 0.5 + ($sliderValue * 0.5); // Maps 0-1 slider to 0.5-1.0 temperature

if (empty($message) || strlen($message) > 500) {
    http_response_code(400);
    echo json_encode(['error' => 'Message is required and must be under 500 characters']);
    exit();
}

// Define the system prompt
$system_prompt = "The user will input a description of a sound, creature, object, event or some other entity. The assistant will output an onomatopoeia which accurately transcribes the sound made by what is described in the input into text form. The onomatopoeias in the output must be inventive, modernist, and realist in style; influenced by James Joyce. Examples of desired input/output taken from the works of James Joyce include: cat - Mrkgnao, fart - Pprrpffrrppffff, Tram - Tram kran kran kran. Krandlkrankran, Printing press - Sllt. The assistant must include only onomatopoeia in the output, with no additional text or extraneous information. The assistant's response must be limited to 100 characters in length.";

// --- callClaude function with temperature parameter ---
function callClaude($message, $api_key, $system_prompt, $temperature)
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, 'https://api.anthropic.com/v1/messages');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true); // Force a new connection
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'x-api-key: ' . $api_key,
        'anthropic-version: 2023-06-01'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'model' => 'claude-3-5-sonnet-20240620',
        'max_tokens' => 150,
        'temperature' => $temperature,
        'system' => $system_prompt,
        'messages' => [
            ['role' => 'user', 'content' => $message]
        ]
    ]));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        $error_data = json_decode($response, true);
        $error_message = 'Claude API error: HTTP ' . $httpCode;
        if (isset($error_data['error']['message'])) {
            $error_message .= ' - ' . $error_data['error']['message'];
        } else if ($curlError) {
            $error_message .= ' - cURL Error: ' . $curlError;
        }
        return ['success' => false, 'message' => $error_message];
    }

    $data = json_decode($response, true);
    if (isset($data['content'][0]['text'])) {
        return ['success' => true, 'message' => trim($data['content'][0]['text'])];
    }

    // Improved error feedback: return the raw response if it's invalid
    return ['success' => false, 'message' => 'Invalid Claude response. Raw: ' . $response];
}

function callGemini($message, $api_key, $system_prompt, $temperature)
{
    $ch = curl_init();
    // Reverted to the more concise and appropriate 'flash' model
    curl_setopt($ch, CURLOPT_URL, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=' . $api_key);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true); // Force a new connection
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
        'systemInstruction' => [
            'parts' => [['text' => $system_prompt]]
        ],
        'contents' => [
            ['role' => 'user', 'parts' => [['text' => $message]]]
        ],
        'generationConfig' => [
            'maxOutputTokens' => 2350,
            'temperature' => $temperature
        ],
        'safetySettings' => [
            [
                'category' => 'HARM_CATEGORY_HARASSMENT',
                'threshold' => 'BLOCK_NONE'
            ],
            [
                'category' => 'HARM_CATEGORY_HATE_SPEECH',
                'threshold' => 'BLOCK_NONE'
            ],
            [
                'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                'threshold' => 'BLOCK_NONE'
            ],
            [
                'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                'threshold' => 'BLOCK_NONE'
            ]
        ]
    ]));

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($httpCode !== 200) {
        $error_data = json_decode($response, true);
        $error_message = 'Gemini API error: HTTP ' . $httpCode;
        if (isset($error_data['error']['message'])) {
            $error_message .= ' - ' . $error_data['error']['message'];
        } else if ($curlError) {
            $error_message .= ' - cURL Error: ' . $curlError;
        }
        return ['success' => false, 'message' => $error_message];
    }

    $data = json_decode($response, true);
    if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
        return ['success' => true, 'message' => trim($data['candidates'][0]['content']['parts'][0]['text'])];
    }

    if (isset($data['promptFeedback']['blockReason'])) {
        return ['success' => false, 'message' => 'Content blocked by Gemini safety settings: ' . $data['promptFeedback']['blockReason']];
    }

    // Improved error feedback: return the raw response if it's invalid
    return ['success' => false, 'message' => 'Invalid Gemini response. Raw: ' . $response];
}

// Call both APIs with the dynamic temperature
$claude_result = callClaude($message, $claude_key, $system_prompt, $temperature);
$gemini_result = callGemini($message, $gemini_key, $system_prompt, $temperature);

// Output the combined results as JSON
echo json_encode([
    'claude' => $claude_result,
    'gemini' => $gemini_result,
    'temperature_used' => $temperature // Optional: for debugging/monitoring
]);


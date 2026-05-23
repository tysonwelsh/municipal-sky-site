<?php
// ------------------------------
// Feedback API (Response A + Response B)
// ------------------------------

// Debug logging (optional; disable in production)
error_log("Feedback endpoint called at " . date('Y-m-d H:i:s'));
error_log("Request method: " . $_SERVER['REQUEST_METHOD']);

// Load database connection
include 'database.php';

// CORS + headers
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit();
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_log("Feedback error: Method not allowed - " . $_SERVER['REQUEST_METHOD']);
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// ------------------------------
// Parse & validate input
// ------------------------------
$raw_input = file_get_contents('php://input');
error_log("Raw input: " . $raw_input);

$input = json_decode($raw_input, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("Feedback error: Invalid JSON - " . json_last_error_msg());
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit();
}

$user_message = $input['user_message'] ?? '';
$claude_response = $input['claude_response'] ?? null;
$openai_response = $input['openai_response'] ?? null;
$preference_rating = $input['preference_rating'] ?? 0;
$slider_value = $input['slider_value'] ?? null;
$model_a = $input['model_a'] ?? 'unknown';
$model_b = $input['model_b'] ?? 'unknown';

error_log("Parsed data - Message: $user_message, Rating: $preference_rating, Model A: $model_a, Model B: $model_b");

// Validate message + rating
if (empty($user_message)) {
    error_log("Feedback error: Empty user message");
    http_response_code(400);
    echo json_encode(['error' => 'User message is required']);
    exit();
}

if (!is_int($preference_rating) || $preference_rating < 1 || $preference_rating > 7) {
    error_log("Feedback error: Invalid rating - $preference_rating");
    http_response_code(400);
    echo json_encode(['error' => 'Rating must be an integer between 1 and 7']);
    exit();
}

// ------------------------------
// Store feedback in database
// ------------------------------
try {
    $id = uniqid(time(), true);
    $session_id = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    error_log("Generated feedback ID: $id");

    // Insert feedback record with new column structure
    $stmt = $pdo->prepare("
        INSERT INTO onomatopoeia_feedback (
            id, timestamp, user_message, 
            response_a, response_b, 
            model_a, model_b,
            preference_rating, temperature, session_id
        ) VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $params = [
        $id,
        substr($user_message, 0, 500),
        $claude_response ? substr($claude_response, 0, 200) : null,
        $openai_response ? substr($openai_response, 0, 200) : null,
        $model_a,
        $model_b,
        $preference_rating,
        $slider_value,
        $session_id
    ];

    error_log("Executing query with params: " . json_encode($params));

    $result = $stmt->execute($params);

    if ($result) {
        error_log("Feedback inserted successfully");

        // Update analytics
        updateAnalytics($pdo, $preference_rating);

        echo json_encode([
            'success' => true,
            'message' => 'Feedback recorded successfully',
            'id' => $id
        ]);
    } else {
        error_log("Feedback error: Query execution failed");
        http_response_code(500);
        echo json_encode(['error' => 'Failed to execute query']);
    }

} catch (PDOException $e) {
    error_log("Feedback storage failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Feedback error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Unexpected error: ' . $e->getMessage()]);
}

// ------------------------------
// Analytics Update Function
// ------------------------------
function updateAnalytics($pdo, $rating)
{
    try {
        error_log("Updating analytics for rating: $rating");

        // Increment counters
        $pdo->exec("INSERT INTO onomatopoeia_analytics (metric, value) VALUES ('total_feedback', 1) 
                    ON DUPLICATE KEY UPDATE value = value + 1");
        $pdo->exec("INSERT INTO onomatopoeia_analytics (metric, value) VALUES ('rating_$rating', 1) 
                    ON DUPLICATE KEY UPDATE value = value + 1");

        // Preference logic (Response A = ratings 1-3, Response B = ratings 5-7, Neutral = 4)
        if ($rating <= 3) {
            $pdo->exec("INSERT INTO onomatopoeia_analytics (metric, value) VALUES ('prefer_response_a', 1) 
                        ON DUPLICATE KEY UPDATE value = value + 1");
        } elseif ($rating >= 5) {
            $pdo->exec("INSERT INTO onomatopoeia_analytics (metric, value) VALUES ('prefer_response_b', 1) 
                        ON DUPLICATE KEY UPDATE value = value + 1");
        } else {
            $pdo->exec("INSERT INTO onomatopoeia_analytics (metric, value) VALUES ('neutral', 1) 
                        ON DUPLICATE KEY UPDATE value = value + 1");
        }

        error_log("Analytics updated successfully");

    } catch (PDOException $e) {
        error_log("Analytics update failed: " . $e->getMessage());
    }
}
?>
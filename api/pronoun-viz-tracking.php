<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/visitor-hash.php';

// POST — log a page view or PNG download.
// Still stores NO raw personal data: no raw IP, no geolocation, no user agent,
// no referrer. The only addition is `visitor_hash` — a salted, daily-rotating
// SHA-256 of the IP (see visitor-hash.php) that lets us count UNIQUE visits
// without keeping anything reversible to a person.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $eventType = $input['event_type'] ?? null;

    if (!in_array($eventType, ['page_view', 'png_download'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid event_type']);
        exit();
    }

    $chartName = $input['chart_name'] ?? null;
    $visitorHash = msky_visitor_hash($secrets ?? []);

    try {
        $stmt = $pdo->prepare("INSERT INTO pronoun_viz_events (event_type, chart_name, visitor_hash) VALUES (:event_type, :chart_name, :visitor_hash)");
        $stmt->execute([
            'event_type' => $eventType,
            'chart_name' => $chartName,
            'visitor_hash' => $visitorHash,
        ]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        error_log("Pronoun viz tracking failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to log event']);
    }
    exit();
}

// GET — fetch stats
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $totals = $pdo->query("
            SELECT
                SUM(event_type = 'page_view') as total_views,
                SUM(event_type = 'png_download') as total_downloads,
                COUNT(DISTINCT IF(event_type = 'page_view', visitor_hash, NULL)) as unique_visitors
            FROM pronoun_viz_events
        ")->fetch();

        $downloadsByChart = $pdo->query("
            SELECT chart_name, COUNT(*) as downloads
            FROM pronoun_viz_events
            WHERE event_type = 'png_download'
            GROUP BY chart_name
        ")->fetchAll();

        $recent = $pdo->query("
            SELECT event_type, chart_name, created_at
            FROM pronoun_viz_events
            ORDER BY created_at DESC
            LIMIT 50
        ")->fetchAll();

        echo json_encode([
            'total_views' => (int) ($totals['total_views'] ?? 0),
            'total_downloads' => (int) ($totals['total_downloads'] ?? 0),
            'unique_visitors' => (int) ($totals['unique_visitors'] ?? 0),
            'downloads_by_chart' => $downloadsByChart,
            'recent' => $recent,
        ]);
    } catch (PDOException $e) {
        error_log("Pronoun viz stats fetch failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load stats']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
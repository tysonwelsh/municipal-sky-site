<?php
// Generic per-page event tracker, modeled on pronoun-viz-tracking.php but with
// a `page` slug so several pages can share one table (`page_events`). Stores no
// raw PII — only a salted, daily-rotating visitor_hash (see visitor-hash.php)
// for counting UNIQUE visits.
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

// Allowlists — keep this endpoint from being used to write arbitrary rows
// (CORS is open). Add new pages / event types here as they're wired up.
$ALLOWED_PAGES = ['prosperos-jukebox', 'underworld-occupations', 'zankyo', 'bardo', 'kolob'];
$ALLOWED_EVENTS = ['page_view', 'play', 'png_download'];

// POST — log an event.
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $page = $input['page'] ?? null;
    $eventType = $input['event_type'] ?? null;

    if (!in_array($page, $ALLOWED_PAGES, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid page']);
        exit();
    }
    if (!in_array($eventType, $ALLOWED_EVENTS, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid event_type']);
        exit();
    }

    // Optional free-text label (e.g. which track was played). Capped to fit
    // the column and avoid storing anything unexpected.
    $label = isset($input['label']) && $input['label'] !== null
        ? substr((string) $input['label'], 0, 255)
        : null;
    $visitorHash = msky_visitor_hash($secrets ?? []);

    try {
        $stmt = $pdo->prepare("INSERT INTO page_events (page, event_type, label, visitor_hash) VALUES (:page, :event_type, :label, :visitor_hash)");
        $stmt->execute([
            'page' => $page,
            'event_type' => $eventType,
            'label' => $label,
            'visitor_hash' => $visitorHash,
        ]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        error_log("Page event tracking failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to log event']);
    }
    exit();
}

// GET — fetch stats. Optional ?page=slug filter; otherwise all pages.
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $page = $_GET['page'] ?? null;
        $where = '';
        $params = [];
        if ($page !== null) {
            if (!in_array($page, $ALLOWED_PAGES, true)) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid page']);
                exit();
            }
            $where = 'WHERE page = :page';
            $params['page'] = $page;
        }

        $stmt = $pdo->prepare("
            SELECT
                page,
                event_type,
                COUNT(*) as events,
                COUNT(DISTINCT visitor_hash) as unique_visitors
            FROM page_events
            $where
            GROUP BY page, event_type
            ORDER BY page, event_type
        ");
        $stmt->execute($params);

        echo json_encode(['stats' => $stmt->fetchAll()]);
    } catch (PDOException $e) {
        error_log("Page event stats fetch failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load stats']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>

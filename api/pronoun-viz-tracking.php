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

// POST — log a page view or PNG download
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $eventType = $input['event_type'] ?? null;

    if (!in_array($eventType, ['page_view', 'png_download'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid event_type']);
        exit();
    }

    $chartName = $input['chart_name'] ?? null;

    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $referer = $_SERVER['HTTP_REFERER'] ?? null;

    // Geo lookup via ip-api.com
    $country = null;
    $city = null;
    $region = null;
    if ($ip) {
        $lookupIp = explode(',', $ip)[0];
        $geo = @json_decode(@file_get_contents("http://ip-api.com/json/" . urlencode(trim($lookupIp)) . "?fields=country,city,regionName"), true);
        if ($geo) {
            $country = $geo['country'] ?? null;
            $city = $geo['city'] ?? null;
            $region = $geo['regionName'] ?? null;
        }
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO pronoun_viz_events (event_type, chart_name, ip_address, country, city, region, user_agent, referer) VALUES (:event_type, :chart_name, :ip, :country, :city, :region, :ua, :ref)");
        $stmt->execute([
            'event_type' => $eventType,
            'chart_name' => $chartName,
            'ip' => $ip,
            'country' => $country,
            'city' => $city,
            'region' => $region,
            'ua' => $userAgent,
            'ref' => $referer,
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
                SUM(event_type = 'png_download') as total_downloads
            FROM pronoun_viz_events
        ")->fetch();

        $downloadsByChart = $pdo->query("
            SELECT chart_name, COUNT(*) as downloads
            FROM pronoun_viz_events
            WHERE event_type = 'png_download'
            GROUP BY chart_name
        ")->fetchAll();

        $recent = $pdo->query("
            SELECT event_type, chart_name, ip_address, country, city, region, user_agent, referer, created_at
            FROM pronoun_viz_events
            ORDER BY created_at DESC
            LIMIT 50
        ")->fetchAll();

        echo json_encode([
            'total_views' => (int) ($totals['total_views'] ?? 0),
            'total_downloads' => (int) ($totals['total_downloads'] ?? 0),
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
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

// POST — log a download
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    $numCards = intval($input['num_cards'] ?? 1);
    if ($numCards < 1)
        $numCards = 1;
    if ($numCards > 10)
        $numCards = 10;

    $ip = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
    $referer = $_SERVER['HTTP_REFERER'] ?? null;

    // Geo lookup via ip-api.com (free, no key needed)
    $country = null;
    $city = null;
    $region = null;
    if ($ip) {
        $lookupIp = explode(',', $ip)[0]; // use first IP if forwarded chain
        $geo = @json_decode(@file_get_contents("http://ip-api.com/json/" . urlencode(trim($lookupIp)) . "?fields=country,city,regionName"), true);
        if ($geo) {
            $country = $geo['country'] ?? null;
            $city = $geo['city'] ?? null;
            $region = $geo['regionName'] ?? null;
        }
    }

    try {
        $stmt = $pdo->prepare("INSERT INTO bingo_downloads (ip_address, country, city, region, num_cards, user_agent, referer) VALUES (:ip, :country, :city, :region, :num_cards, :ua, :ref)");
        $stmt->execute([
            'ip' => $ip,
            'country' => $country,
            'city' => $city,
            'region' => $region,
            'num_cards' => $numCards,
            'ua' => $userAgent,
            'ref' => $referer,
        ]);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        error_log("Download log failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to log download']);
    }
    exit();
}

// GET — fetch download stats (for your own use)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $totals = $pdo->query("SELECT COUNT(*) as total_downloads, COALESCE(SUM(num_cards), 0) as total_cards FROM bingo_downloads")->fetch();
        $recent = $pdo->query("SELECT ip_address, country, city, region, num_cards, user_agent, downloaded_at FROM bingo_downloads ORDER BY downloaded_at DESC LIMIT 50")->fetchAll();
        echo json_encode([
            'total_downloads' => (int) $totals['total_downloads'],
            'total_cards' => (int) $totals['total_cards'],
            'recent' => $recent,
        ]);
    } catch (PDOException $e) {
        error_log("Download stats fetch failed: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to load stats']);
    }
    exit();
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
?>
<?php
// Onobot daily digest, emailed by a cPanel cron job.
//
// Runs on the Bluehost server where the database is local, so it reuses
// database.php (localhost connection, production secrets) — no remote access
// or credentials needed here. CLI-only: refuses web requests so the public
// /api/ URL can't be used to trigger emails.

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("This script runs from cron (CLI) only.\n");
}

require __DIR__ . '/database.php';   // provides $pdo

$HOURS = 24;
$TO    = 'tysonwelsh@gmail.com';
$FROM  = 'onobot@municipalsky.com';  // a domain address improves deliverability

// Best-effort geolocation of the visitor IP (stored in session_id). Never let
// a slow/failed lookup hold up or break the digest.
function geo($ip)
{
    $ctx = stream_context_create(['http' => ['timeout' => 5]]);
    $r = @file_get_contents("http://ip-api.com/csv/{$ip}?fields=city,regionName,country", false, $ctx);
    return ($r && trim($r) !== '') ? trim($r) : 'location unavailable';
}

$stmt = $pdo->prepare(
    "SELECT timestamp, preference_rating, session_id, user_message,
            model_a, response_a, model_b, response_b
     FROM onomatopoeia_feedback
     WHERE timestamp >= NOW() - INTERVAL :h HOUR
     ORDER BY timestamp DESC"
);
$stmt->bindValue(':h', $HOURS, PDO::PARAM_INT);
$stmt->execute();
$rows  = $stmt->fetchAll();
$count = count($rows);
$total = $pdo->query("SELECT COUNT(*) FROM onomatopoeia_feedback")->fetchColumn();

$L   = [];
$L[] = "Onobot digest — submissions in the last {$HOURS}h (server time)";
$L[] = "All-time feedback rows: {$total}";
$L[] = str_repeat('-', 64);

if ($count === 0) {
    $L[] = "No new submissions in the last {$HOURS}h.";
} else {
    $L[] = "{$count} new submission(s):";
    $L[] = "";
    $a = $b = $n = 0;
    foreach ($rows as $r) {
        $rating = (int) $r['preference_rating'];
        if ($rating <= 3)      { $lean = "A — {$r['model_a']} (Claude)"; $a++; }
        elseif ($rating >= 5)  { $lean = "B — {$r['model_b']} (GPT)";    $b++; }
        else                   { $lean = "neutral";                       $n++; }

        $L[] = "• {$r['timestamp']}   [{$r['session_id']} — " . geo($r['session_id']) . "]";
        $L[] = "    prompt : {$r['user_message']}";
        $L[] = "    A ({$r['model_a']}): {$r['response_a']}";
        $L[] = "    B ({$r['model_b']}): {$r['response_b']}";
        $L[] = "    rating : {$rating}/7 → leans {$lean}";
        $L[] = "";
    }
    $L[] = str_repeat('-', 64);
    $L[] = "Window tally: {$a} prefer A (Claude), {$b} prefer B (GPT), {$n} neutral";
}

$body    = implode("\n", $L) . "\n";
$subject = $count > 0
    ? "Onobot digest — {$count} new (" . date('Y-m-d') . ")"
    : "Onobot digest — no new submissions (" . date('Y-m-d') . ")";

$headers = "From: Onobot <{$FROM}>\r\n"
         . "Reply-To: {$FROM}\r\n"
         . "Content-Type: text/plain; charset=utf-8\r\n";

mail($TO, $subject, $body, $headers);

// Echo too, so cron logs (or a cPanel cron-email, if you set one) carry it.
echo $body;

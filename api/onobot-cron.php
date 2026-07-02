<?php
// Municipal Sky — comprehensive daily digest, emailed by a cPanel cron job.
//
// Runs on the Bluehost server where the database is local, so it reuses
// database.php (localhost connection, production secrets) — no remote access
// or credentials needed here. CLI-only: refuses web requests so the public
// /api/ URL can't be used to trigger emails.
//
// Covers: onobot feedback (with model preference), page-view analytics for the
// pronoun article / jukebox / underworld, and new email signups.

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("This script runs from cron (CLI) only.\n");
}

require __DIR__ . '/database.php';   // provides $pdo

$H    = 24;                          // look-back window, hours
$TO   = 'tysonwelsh@gmail.com';
$FROM = 'onobot@municipalsky.com';   // a domain address improves deliverability

// Best-effort geolocation of a visitor IP. Never let a slow/failed lookup
// hold up or break the digest.
function geo($ip)
{
    $ctx = stream_context_create(['http' => ['timeout' => 5]]);
    $r = @file_get_contents("http://ip-api.com/json/{$ip}?fields=city,region", false, $ctx);
    $d = $r ? json_decode($r, true) : null;
    $city = $d['city'] ?? '';
    $reg  = $d['region'] ?? '';
    $loc  = trim($city . (($city !== '' && $reg !== '') ? ', ' : '') . $reg);
    return $loc !== '' ? $loc : 'unknown';
}

// Collapse whitespace and truncate to N chars with a ".." marker.
function trunc($s, $n)
{
    $s = trim(preg_replace('/\s+/', ' ', (string) $s));
    return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 2) . '..' : $s;
}

$q  = function ($sql) use ($pdo) { return $pdo->query($sql)->fetchAll(); };
$q1 = function ($sql) use ($pdo) { return $pdo->query($sql)->fetch(); };

$L    = [];
$rule = str_repeat('=', 64);
$L[]  = $rule;
$L[]  = "MUNICIPAL SKY — DAILY DIGEST";
$L[]  = "Last {$H}h (server time) · " . date('Y-m-d H:i');
$L[]  = $rule;

// ─────────────────────────────────────────────────────────────
// 1. ONOBOT (onomatopoeia machine)
// ─────────────────────────────────────────────────────────────
$rows = $q("SELECT timestamp, preference_rating, session_id, user_message,
                   model_a, response_a, model_b, response_b
            FROM onomatopoeia_feedback
            WHERE timestamp >= NOW() - INTERVAL $H HOUR
            ORDER BY timestamp DESC");
$onoCount = count($rows);
$onoTotal = $pdo->query("SELECT COUNT(*) FROM onomatopoeia_feedback")->fetchColumn();
$p24 = $q1("SELECT SUM(preference_rating<=3) a, SUM(preference_rating>=5) b, SUM(preference_rating=4) n
            FROM onomatopoeia_feedback WHERE timestamp >= NOW() - INTERVAL $H HOUR");
$pAll = $q1("SELECT SUM(preference_rating<=3) a, SUM(preference_rating>=5) b, SUM(preference_rating=4) n
             FROM onomatopoeia_feedback");

$L[] = "";
$L[] = "ONOBOT — onomatopoeia machine";
$L[] = "  {$onoCount} new submission(s) in {$H}h  ·  all-time: {$onoTotal}";
$L[] = sprintf("  Model preference (24h):      Claude %d · GPT %d · neutral %d",
               (int)$p24['a'], (int)$p24['b'], (int)$p24['n']);
$L[] = sprintf("  Model preference (all-time): Claude %d · GPT %d · neutral %d",
               (int)$pAll['a'], (int)$pAll['b'], (int)$pAll['n']);

if ($onoCount > 0) {
    $L[] = "";
    foreach ($rows as $r) {
        $rating = (int) $r['preference_rating'];
        $pref = $rating <= 3 ? "A {$rating}/7 (Claude)" : ($rating >= 5 ? "B {$rating}/7 (GPT)" : "neutral {$rating}/7");
        $L[] = "  • " . substr($r['timestamp'], 5, 11) . " · " . geo($r['session_id']) . " · preference: " . $pref;
        $L[] = "      prompt    : " . $r['user_message'];
        $L[] = "      A (Claude): " . $r['response_a'];
        $L[] = "      B (GPT)   : " . $r['response_b'];
        $L[] = "";
    }
}

// ─────────────────────────────────────────────────────────────
// 2. PAGE ANALYTICS  (views · unique visitors · downloads/plays)
// ─────────────────────────────────────────────────────────────
// Pronoun article has its own table; jukebox + underworld share page_events.
$pr24  = $q1("SELECT SUM(event_type='page_view') v,
                     COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_hash END) u,
                     SUM(event_type='png_download') d
              FROM pronoun_viz_events WHERE created_at >= NOW() - INTERVAL $H HOUR");
$prAll = $q1("SELECT SUM(event_type='page_view') v,
                     COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_hash END) u,
                     SUM(event_type='png_download') d
              FROM pronoun_viz_events");

$peSel = "SELECT page,
                 SUM(event_type='page_view') v,
                 COUNT(DISTINCT CASE WHEN event_type='page_view' THEN visitor_hash END) u,
                 SUM(event_type='play') p,
                 SUM(event_type='png_download') d
          FROM page_events";
$pe24 = []; foreach ($q("$peSel WHERE created_at >= NOW() - INTERVAL $H HOUR GROUP BY page") as $r) { $pe24[$r['page']] = $r; }
$peAll = []; foreach ($q("$peSel GROUP BY page") as $r) { $peAll[$r['page']] = $r; }

$i = function ($row, $k) { return (int) ($row[$k] ?? 0); };

$L[] = $rule;
$L[] = "PAGE ANALYTICS";
$L[] = sprintf("  %-26s %d views (%d unique), %d downloads   [all-time: %d / %d / %d]",
    "Pronoun distribution",
    $i($pr24,'v'), $i($pr24,'u'), $i($pr24,'d'),
    $i($prAll,'v'), $i($prAll,'u'), $i($prAll,'d'));

$jk = $pe24['prosperos-jukebox'] ?? []; $jkA = $peAll['prosperos-jukebox'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "Prospero's Jukebox",
    $i($jk,'v'), $i($jk,'u'), $i($jk,'p'),
    $i($jkA,'v'), $i($jkA,'u'), $i($jkA,'p'));

$zk = $pe24['zankyo'] ?? []; $zkA = $peAll['zankyo'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "ZANKYO",
    $i($zk,'v'), $i($zk,'u'), $i($zk,'p'),
    $i($zkA,'v'), $i($zkA,'u'), $i($zkA,'p'));

$bd = $pe24['bardo'] ?? []; $bdA = $peAll['bardo'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "BARDO",
    $i($bd,'v'), $i($bd,'u'), $i($bd,'p'),
    $i($bdA,'v'), $i($bdA,'u'), $i($bdA,'p'));

$uw = $pe24['underworld-occupations'] ?? []; $uwA = $peAll['underworld-occupations'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "Underworld Annotated",
    $i($uw,'v'), $i($uw,'u'),
    $i($uwA,'v'), $i($uwA,'u'));

// ─────────────────────────────────────────────────────────────
// 3. EMAIL SIGNUPS
// ─────────────────────────────────────────────────────────────
$L[] = $rule;
$L[] = "EMAIL SIGNUPS";
$subCount = 0;
try {
    $subTotal = $pdo->query("SELECT COUNT(*) FROM subscribers")->fetchColumn();
    $newSubs  = $q("SELECT email, source, created_at FROM subscribers
                    WHERE created_at >= NOW() - INTERVAL $H HOUR ORDER BY created_at DESC");
    $subCount = count($newSubs);
    $L[] = "  {$subCount} new in {$H}h  ·  total subscribers: {$subTotal}";
    foreach ($newSubs as $s) {
        $src = $s['source'] !== null && $s['source'] !== '' ? " (from {$s['source']})" : "";
        $L[] = "  • {$s['created_at']}  {$s['email']}{$src}";
    }
} catch (PDOException $e) {
    // subscribers table is created lazily on the first signup; absence = none yet.
    $L[] = "  0 new — no signups yet (the subscribers table hasn't been created).";
}

$L[] = $rule;

$body = implode("\n", $L) . "\n";

$views24 = $i($pr24,'v') + $i($jk,'v') + $i($uw,'v');
$subject = sprintf("Municipal Sky digest %s — %d onobot, %d views, %d new emails",
    date('Y-m-d'), $onoCount, $views24, $subCount);

$headers = "From: Municipal Sky <{$FROM}>\r\n"
         . "Reply-To: {$FROM}\r\n"
         . "Content-Type: text/plain; charset=utf-8\r\n";

mail($TO, $subject, $body, $headers);

// Echo too, so cron logs (or a cPanel cron-email, if you set one) carry it.
echo $body;

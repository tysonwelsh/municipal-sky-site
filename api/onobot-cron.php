<?php
// Municipal Sky — comprehensive daily digest, emailed by a cPanel cron job.
//
// Runs on the Bluehost server where the database is local, so it reuses
// database.php (localhost connection, production secrets) — no remote access
// or credentials needed here. CLI-only: refuses web requests so the public
// /api/ URL can't be used to trigger emails.
//
// Covers: onobot feedback (with model preference), page-view analytics for the
// pronoun article / jukebox / underworld, the Junk Drawer (drawer + about-page
// visits, items opened, turns, and every new visitor prompt), and new email
// signups.

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("This script runs from cron (CLI) only.\n");
}

require __DIR__ . '/database.php';   // provides $pdo

$H    = 24;                          // look-back window, hours
$TO   = 'tysonwelsh@gmail.com';
$FROM = 'onobot@municipalsky.com';   // a domain address improves deliverability

// No visitor geolocation (2026-10-01): the digest used to send each bot
// visitor's IP to ip-api.com (plain HTTP, a third party the privacy policy
// never named) to print a city. Visitor IPs stay on this server.

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
        $L[] = "  • " . substr($r['timestamp'], 5, 11) . " · preference: " . $pref;
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

$hp = $pe24['homepage'] ?? []; $hpA = $peAll['homepage'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "Homepage",
    $i($hp,'v'), $i($hp,'u'),
    $i($hpA,'v'), $i($hpA,'u'));

$L[] = sprintf("  %-26s %d views (%d unique), %d downloads   [all-time: %d / %d / %d]",
    "Pronoun distribution",
    $i($pr24,'v'), $i($pr24,'u'), $i($pr24,'d'),
    $i($prAll,'v'), $i($prAll,'u'), $i($prAll,'d'));

$cb = $pe24['carbon-structures'] ?? []; $cbA = $peAll['carbon-structures'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "Carbon structures",
    $i($cb,'v'), $i($cb,'u'),
    $i($cbA,'v'), $i($cbA,'u'));

// v2 is the live jukebox (linked from /art since 2026-08-07); v1 stays for
// its history only — it is no longer linked anywhere.
$j2 = $pe24['prosperos-jukebox-v2'] ?? []; $j2A = $peAll['prosperos-jukebox-v2'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "Prospero's Jukebox v2",
    $i($j2,'v'), $i($j2,'u'), $i($j2,'p'),
    $i($j2A,'v'), $i($j2A,'u'), $i($j2A,'p'));

$jk = $pe24['prosperos-jukebox'] ?? []; $jkA = $peAll['prosperos-jukebox'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "Prospero's Jukebox (v1)",
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

$kb = $pe24['kolob'] ?? []; $kbA = $peAll['kolob'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique), %d plays   [all-time: %d / %d / %d]",
    "KOLOB",
    $i($kb,'v'), $i($kb,'u'), $i($kb,'p'),
    $i($kbA,'v'), $i($kbA,'u'), $i($kbA,'p'));

$uw = $pe24['underworld-occupations'] ?? []; $uwA = $peAll['underworld-occupations'] ?? [];
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "Underworld Annotated",
    $i($uw,'v'), $i($uw,'u'),
    $i($uwA,'v'), $i($uwA,'u'));

// ─────────────────────────────────────────────────────────────
// 3. JUNK DRAWER  (visits · items opened · turns · new prompts)
// ─────────────────────────────────────────────────────────────
// The drawer logs to page_events under page='junk-drawer' (jd-core.js JD_track):
// page_view with label NULL for the drawer itself and 'about' for /about/,
// item_open, and turn_open / turn_submit / turn_complete / turn_error. The
// prompts visitors file are jd_submissions rows with item_id IS NULL (curated
// items carry an item_id and are not visits). jd_* timestamps are UTC, so the
// window there is UTC_TIMESTAMP(), not NOW().
$jdSel = "SELECT
            SUM(event_type='page_view' AND (label IS NULL OR label <> 'about')) v,
            COUNT(DISTINCT CASE WHEN event_type='page_view' AND (label IS NULL OR label <> 'about') THEN visitor_hash END) u,
            SUM(event_type='page_view' AND label = 'about') av,
            COUNT(DISTINCT CASE WHEN event_type='page_view' AND label = 'about' THEN visitor_hash END) au,
            SUM(event_type='item_open') io,
            SUM(event_type='turn_open') topen,
            SUM(event_type='turn_submit') tsub,
            SUM(event_type='turn_complete') tdone,
            SUM(event_type='turn_error') terr
          FROM page_events WHERE page = 'junk-drawer'";
$jd24  = $q1("$jdSel AND created_at >= NOW() - INTERVAL $H HOUR") ?: [];
$jdAll = $q1($jdSel) ?: [];

$jdCount = 0;
$L[] = $rule;
$L[] = "JUNK DRAWER";
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "The drawer", $i($jd24,'v'), $i($jd24,'u'), $i($jdAll,'v'), $i($jdAll,'u'));
$L[] = sprintf("  %-26s %d views (%d unique)   [all-time: %d views, %d unique]",
    "About page", $i($jd24,'av'), $i($jd24,'au'), $i($jdAll,'av'), $i($jdAll,'au'));
$L[] = sprintf("  %-26s %d   [all-time: %d]", "Items opened", $i($jd24,'io'), $i($jdAll,'io'));
$L[] = sprintf("  %-26s %d opened · %d submitted · %d completed · %d errors   [all-time: %d / %d / %d / %d]",
    "Turns", $i($jd24,'topen'), $i($jd24,'tsub'), $i($jd24,'tdone'), $i($jd24,'terr'),
    $i($jdAll,'topen'), $i($jdAll,'tsub'), $i($jdAll,'tdone'), $i($jdAll,'terr'));
try {
    $jdTotal = $q1("SELECT COUNT(*) n, SUM(status='rated') rated FROM jd_submissions WHERE item_id IS NULL") ?: [];
    $prompts = $q("SELECT s.created, s.status, s.title, s.prompt, g.model_id AS winner
                   FROM jd_submissions s
                   LEFT JOIN jd_ranks r ON r.submission_id = s.id AND r.rank_pos = 1 AND r.client = 'web'
                   LEFT JOIN jd_generations g ON g.id = r.generation_id
                   WHERE s.item_id IS NULL AND s.created >= UTC_TIMESTAMP() - INTERVAL $H HOUR
                   ORDER BY s.created DESC");
    $jdCount = count($prompts);
    $L[] = sprintf("  %-26s %d new in %dh   [all-time: %d prompts, %d rated]",
        "Prompts collected", $jdCount, $H, $i($jdTotal,'n'), $i($jdTotal,'rated'));
    if ($jdCount > 0) {
        $L[] = "";
        foreach ($prompts as $p) {
            $when = substr($p['created'], 5, 11) . ' UTC';
            $tail = $p['status'] === 'rated'
                ? ('rated' . ($p['winner'] ? ' · 1st: ' . $p['winner'] : ''))
                : $p['status'];
            $L[] = "  • {$when} · " . ($p['title'] !== null && $p['title'] !== '' ? $p['title'] : '(untitled)') . " · {$tail}";
            $L[] = "      prompt: " . trunc($p['prompt'], 220);
        }
    }
} catch (PDOException $e) {
    $L[] = "  Prompts collected: unavailable (" . $e->getMessage() . ")";
}

// ─────────────────────────────────────────────────────────────
// 4. EMAIL SIGNUPS
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

$views24 = $i($hp,'v') + $i($pr24,'v') + $i($jk,'v') + $i($j2,'v') + $i($zk,'v') + $i($kb,'v') + $i($uw,'v') + $i($jd24,'v') + $i($jd24,'av');
$subject = sprintf("Municipal Sky digest %s — %d onobot, %d drawer prompts, %d views, %d new emails",
    date('Y-m-d'), $onoCount, $jdCount, $views24, $subCount);

$headers = "From: Municipal Sky <{$FROM}>\r\n"
         . "Reply-To: {$FROM}\r\n"
         . "Content-Type: text/plain; charset=utf-8\r\n";

mail($TO, $subject, $body, $headers);

// Echo too, so cron logs (or a cPanel cron-email, if you set one) carry it.
echo $body;

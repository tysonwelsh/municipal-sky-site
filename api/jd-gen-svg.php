<?php
// GET /api/jd-gen-svg.php?gen=<generation_id> — one drawing's SVG (2026-08-30).
//
// A curated response's artwork is a file in its item directory; a TURN's
// artwork exists only as a column in jd_generations. The bench now seats
// turns as well as curated items (the reassessment backlog: 84 prompts that
// never reached the drawer), so it needs a way to fetch one drawing at a
// time. Inlining 314 SVGs in the queue payload would be megabytes; this is
// the on-demand half, and the bench's per-item fetch already has the shape
// for it.
//
// Serves the SANITIZED text as stored — the same bytes the turn flow drew
// and the same bytes a promotion would commit. Read-only.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    jd_fail(405, 'method_not_allowed', 'GET only.');
}

// THE DRAWER DEPENDS ON THIS ENDPOINT NOW (2026-08-30): a rated turn's
// artwork is served from here to every visitor, so the key cannot be the
// only way in. A drawing whose turn is RATED is public by definition — it
// is on display — and is served to anyone; everything else (an unrated
// turn's drawings, which only the bench has business seeing) still answers
// to the gate when the gate is on.
$keyed = true;
if (JD_IS_PRODUCTION && JD_BENCH_REQUIRE_KEY) {
    $secrets  = jd_secrets();
    $expected = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    $supplied = $_SERVER['HTTP_X_BENCH_KEY'] ?? ($_GET['key'] ?? '');
    $keyed = is_string($expected) && $expected !== ''
        && hash_equals($expected, (string) $supplied);
}

$gen = (string) ($_GET['gen'] ?? '');
if (!preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $gen)) {
    jd_fail(400, 'bad_request', 'A generation id is required.');
}

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $db->prepare(
        "SELECT g.svg, s.status, s.item_id
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE g.id = ? AND g.status = 'ok'"
    );
    $stmt->execute([$gen]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $svg = $row === false ? false : $row['svg'];
    // on display = rated turn, or any curated response
    $public = $row !== false
        && ($row['status'] === 'rated' || $row['item_id'] !== null);
    if (!$keyed && !$public) {
        jd_fail(403, 'forbidden', 'That drawing is not on display.');
    }
} catch (PDOException $e) {
    error_log('jd-gen-svg: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The drawing could not be read.');
}

if ($svg === false || !is_string($svg) || $svg === '') {
    jd_fail(404, 'not_found', 'No drawing on file for that generation.');
}

// image/svg+xml so an <img> or a fetch both work; no-store because the
// bench is an instrument, not a gallery, and a stale drawing would be a lie.
header('Content-Type: image/svg+xml; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('X-Content-Type-Options: nosniff');
echo $svg;

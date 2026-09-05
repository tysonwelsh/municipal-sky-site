<?php
// GET /api/jd-gen-svg.php?gen=<generation_id> — one drawing's SVG (2026-08-30).
//
// A curated response's artwork is a file in its item directory; a TURN's
// artwork exists only as a column in jd_generations. The bench seats turns
// as well as curated items, so it needs a way to fetch one drawing at a
// time — and since a rated turn joins the drawer for everyone, so does the
// drawer itself: each served turn response points here rather than at a
// file.
//
// Serves the SANITIZED text as stored — the same bytes the turn flow drew
// and the same bytes a promotion would commit. Read-only.
//
// A drawing whose turn is RATED is on display, and is served to anyone;
// everything else (an unrated turn's drawings, which only the bench has
// business seeing) answers to the bench gate when the gate is on.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();
jd_require_get();

$gen = (string) ($_GET['gen'] ?? '');
if (!jd_is_ulid($gen)) {
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
    if (!$public && !jd_bench_keyed()) {
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
jd_no_store();
header('X-Content-Type-Options: nosniff');
echo $svg;

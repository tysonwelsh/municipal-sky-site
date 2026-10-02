<?php
// GET /api/jd2-gen-svg.php?gen=<generation id> — one drawing's SVG (dataset v2).
//
// v2 keeps no artwork on disk: a drawing is jd2_generations.svg, the
// SANITIZED text as stored — the same bytes the turn drew. data.php points
// every served response here.
//
// Who may see it: anyone, when the drawing's prompt is LIVE (it is in the
// drawer) and the owner has not dropped the drawing from the card; the bench
// key-holder, always (a draft or hidden prompt is the owner's business).
// Anything else answers 404 exactly as a drawing that does not exist would,
// so a draft's ids cannot be probed for. Read-only.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();
jd_require_get();

$gen = (string) ($_GET['gen'] ?? '');
if (!jd_is_ulid($gen)) {
    jd_fail(400, 'bad_request', 'A generation id is required.');
}

try {
    $db = jd_db();
    $q = $db->prepare(
        "SELECT g.svg, g.hidden, p.visibility
           FROM jd2_generations g
           JOIN jd2_runs r ON r.id = g.run_id
           JOIN jd2_prompts p ON p.id = r.prompt_id
          WHERE g.id = ? AND g.status = '" . JD2_GEN_OK . "'"
    );
    $q->execute([$gen]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('jd2-gen-svg: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The drawing could not be read.');
}

$onDisplay = $row !== false && $row['visibility'] === JD2_VIS_LIVE && (int) $row['hidden'] === 0;
if ($row === false || !is_string($row['svg']) || $row['svg'] === '' || (!$onDisplay && !jd_bench_keyed())) {
    jd_fail(404, 'not_found', 'No drawing on file for that generation.');
}

// image/svg+xml so an <img> or a fetch both work; no-store because a drawing
// can be hidden at any moment and a cached copy would outlive the decision.
header('Content-Type: image/svg+xml; charset=utf-8');
jd_no_store();
header('X-Content-Type-Options: nosniff');
echo $row['svg'];

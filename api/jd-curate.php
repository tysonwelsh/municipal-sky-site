<?php
// POST /api/jd-curate.php — the curator's standing intents on one item.
//
// Two decisions the bench strip files that are about the ITEM, not about any
// drawing on it: SCRAP (retire it from the drawer) and RERUN (re-issue its
// prompt to the current pool). Until 2026-09-05 they were `kind='flag'` rows
// in jd_ratings hung off a generation with the intent encoded in the note;
// they are timestamp columns on jd_submissions now — set = requested, NULL =
// not (or withdrawn) — and this is the one endpoint that writes them.
//
// Request:  { "submission_id": "<ulid>", "retire": true|false, "rerun": true|false }
//           Only the keys present are touched.
// Response: the submission's current standing.
//
// These are INTENTS. The drawer honours retire_requested_at at request time
// (data.php holds a scrapped turn back), and a session carries a curated
// item's scrap into its entry.json (scripts/apply-scraps.py). A rerun is a
// real turn the bench starts the moment the flag is filed; the queue reports
// whether it landed (rerun_landed), so an abandoned rerun comes back.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_require_post();
jd_require_bench_key();

$body = jd_read_json_body();

$submissionId = $body['submission_id'] ?? null;
if (!jd_is_ulid($submissionId)) {
    jd_fail(400, 'bad_request', 'A submission_id is required.');
}

$sets = [];
$vals = [];
foreach (['retire' => 'retire_requested_at', 'rerun' => 'rerun_requested_at'] as $key => $column) {
    if (!array_key_exists($key, $body)) {
        continue;
    }
    if (!is_bool($body[$key])) {
        jd_fail(400, 'bad_request', $key . ' must be true or false.');
    }
    $sets[] = $column . ' = ?';
    $vals[] = $body[$key] ? jd_now() : null;
}
if (!$sets) {
    jd_fail(400, 'bad_request', 'Nothing to file: pass retire and/or rerun.');
}

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $vals[] = $submissionId;
    $stmt = $db->prepare('UPDATE jd_submissions SET ' . implode(', ', $sets) . ' WHERE id = ?');
    $stmt->execute($vals);
    if ($stmt->rowCount() === 0) {
        // rowCount is 0 both for "no such row" and "nothing changed"; tell
        // them apart before answering 404
        $probe = $db->prepare('SELECT id FROM jd_submissions WHERE id = ?');
        $probe->execute([$submissionId]);
        if ($probe->fetch() === false) {
            jd_fail(404, 'not_found', 'That submission is not on file.');
        }
    }

    $stmt = $db->prepare(
        'SELECT id, item_id, size_class, suppressed, retire_requested_at, rerun_requested_at
           FROM jd_submissions WHERE id = ?'
    );
    $stmt->execute([$submissionId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    jd_json_out(200, [
        'ok'                  => true,
        'build'               => jd_build_stamp()['build'],
        'submission_id'       => $submissionId,
        'item_id'             => $row['item_id'],
        'size_class'          => $row['size_class'],
        'suppressed'          => (bool) $row['suppressed'],
        'retire_requested_at' => $row['retire_requested_at'],
        'rerun_requested_at'  => $row['rerun_requested_at'],
    ]);
} catch (PDOException $e) {
    error_log('jd-curate: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The intent could not be filed.');
}

<?php
// POST /api/jd-item-rate.php — the curator's rating of ONE curated response.
//
// Sibling of jd-rate.php, not a reuse of it. jd-rate.php cannot serve this:
// it claims a submission with `UPDATE ... WHERE status <> 'rated'` (one batch
// per submission, ever), it requires a pairwise comparison once more than one
// generation survives (jd_comparisons is UNIQUE per submission), and it
// releases the model reveal. Re-rating the curated corpus needs the opposite
// of all three: repeatable writes, no comparison, no reveal.
//
// Writes jd_ratings rows exactly as the turn flow does — same table, same
// columns, same taxonomy_version discipline — so curator and visitor ratings
// aggregate together and stay separable by `client`.
//
// AUTH: this endpoint writes AUTHORITATIVE ratings under the curator identity.
// It is gated in production on jd_bench_key; without the gate anyone could
// forge the owner's judgments. visitor_hash and client are ALWAYS assigned
// server-side and are never read from the request body.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();
jd_require_post();

// --- Auth -----------------------------------------------------------------
if (JD_IS_PRODUCTION) {
    // jd_bench_key if it exists, else the jd_setup_key that is already on file
    // — this needs no new secret to work in production. Same trust level:
    // whoever holds jd_setup_key can already create and alter these tables.
    // Set a dedicated jd_bench_key later if the two should be separable.
    $secrets  = jd_secrets();
    $expected = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    $supplied = $_SERVER['HTTP_X_BENCH_KEY'] ?? '';
    if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
        jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
    }
}

$body = jd_read_json_body();

// --- Taxonomy -------------------------------------------------------------
// Same discipline as jd-rate.php: a taxonomy that cannot state its version
// must not produce rows, because a silent 0 is indistinguishable from a real
// version once it is on disk.
$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    error_log('jd-item-rate: taxonomy.json could not be read at ' . JD_TAXONOMY_PATH);
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}
$taxonomyVersion = (int) ($taxonomy['version'] ?? 0);
if ($taxonomyVersion < 1) {
    error_log('jd-item-rate: taxonomy.json has no usable version field');
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}

// Live axes only, with the ranks each one actually allows. Rating a defunct
// axis is refused: they are kept for already-graded responses and never
// surveyed again.
$liveAxes = [];
foreach ($taxonomy['axes'] ?? [] as $axis) {
    if (!empty($axis['defunct'])) {
        continue;
    }
    $ranks = [];
    foreach ($axis['values'] ?? [] as $v) {
        if (isset($v['rank'])) {
            $ranks[] = (float) $v['rank'];
        }
    }
    if ($ranks) {
        $liveAxes[(string) $axis['id']] = $ranks;
    }
}
$gradeRanks = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    if (isset($g['rank'])) {
        $gradeRanks[] = (float) $g['rank'];
    }
}

// --- Parse ----------------------------------------------------------------
$generationId = $body['generation_id'] ?? null;
if (!is_string($generationId) || !preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $generationId)) {
    jd_fail(400, 'bad_request', 'A generation_id is required.');
}

$ratings = $body['ratings'] ?? [];
if (!is_array($ratings) || !array_is_list($ratings) || !$ratings) {
    jd_fail(400, 'bad_request', 'ratings must be a non-empty list.');
}
if (count($ratings) > JD_RATINGS_MAX) {
    jd_fail(400, 'rating_invalid', 'Too many ratings in one batch.');
}

$note = $body['note'] ?? null;
if ($note !== null && (!is_string($note) || mb_strlen($note) > JD_NOTE_MAX_CHARS)) {
    jd_fail(400, 'bad_request', 'A note must be a string of at most ' . JD_NOTE_MAX_CHARS . ' characters.');
}

// Validate every row BEFORE opening a transaction, so a bad batch cannot
// half-apply.
$clean = [];
foreach ($ratings as $r) {
    if (!is_array($r)) {
        jd_fail(400, 'bad_request', 'Each rating must be an object.');
    }
    $kind = $r['kind'] ?? 'axis';
    if (!in_array($kind, ['axis', 'grade', 'flag'], true)) {
        jd_fail(400, 'rating_invalid', 'kind must be axis, grade or flag.');
    }

    if ($kind === 'axis') {
        $axisId = $r['axis_id'] ?? null;
        if (!is_string($axisId) || !isset($liveAxes[$axisId])) {
            jd_fail(400, 'rating_invalid', 'Unknown or retired axis: ' . var_export($axisId, true));
        }
        $value = $r['value'] ?? null;
        if (!is_numeric($value) || !in_array((float) $value, $liveAxes[$axisId], true)) {
            jd_fail(400, 'rating_invalid', "Value out of range for axis $axisId.");
        }
        $clean[] = ['axis', $axisId, (float) $value];
    } elseif ($kind === 'grade') {
        $value = $r['value'] ?? null;
        if (!is_numeric($value) || ($gradeRanks && !in_array((float) $value, $gradeRanks, true))) {
            jd_fail(400, 'rating_invalid', 'Value out of range for the grade scale.');
        }
        $clean[] = ['grade', null, (float) $value];
    } else {
        $clean[] = ['flag', is_string($r['axis_id'] ?? null) ? $r['axis_id'] : null, null];
    }
}

// --- Write ----------------------------------------------------------------
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // The generation must exist AND be curated. Refusing turn generations here
    // keeps the two write paths from crossing: a visitor's turn is rated
    // through jd-rate.php, under its one-batch-per-submission rule.
    $stmt = $db->prepare(
        'SELECT g.id, s.item_id
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE g.id = ?'
    );
    $stmt->execute([$generationId]);
    $gen = $stmt->fetch();
    if ($gen === false) {
        jd_fail(404, 'not_found', 'That drawing is not on file.');
    }
    if (($gen['item_id'] ?? null) === null) {
        jd_fail(409, 'not_curated', 'That drawing is a visitor turn — rate it through jd-rate.php.');
    }

    $curator = jd_curator_hash();
    $now     = gmdate('Y-m-d H:i:s');

    $db->beginTransaction();

    // Re-rating REPLACES this rater's prior answer on the same axis rather than
    // stacking a second row: the bench is a corrective instrument and the
    // curator changing their mind is expected. Only rows from this client and
    // this rater are cleared — visitor ratings are never touched.
    $delAxis  = $db->prepare(
        "DELETE FROM jd_ratings
          WHERE generation_id = ? AND client = 'bench' AND visitor_hash = ?
            AND kind = 'axis' AND axis_id = ?"
    );
    $delOther = $db->prepare(
        "DELETE FROM jd_ratings
          WHERE generation_id = ? AND client = 'bench' AND visitor_hash = ?
            AND kind = ?"
    );
    $ins = $db->prepare(
        'INSERT INTO jd_ratings
            (id, generation_id, kind, axis_id, value, note, taxonomy_version,
             visitor_hash, client, rated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $written = 0;
    foreach ($clean as [$kind, $axisId, $value]) {
        if ($kind === 'axis') {
            $delAxis->execute([$generationId, $curator, $axisId]);
        } else {
            $delOther->execute([$generationId, $curator, $kind]);
        }
        $ins->execute([
            jd_ulid(), $generationId, $kind, $axisId, $value,
            // the note rides on the first row of the batch only
            $written === 0 ? $note : null,
            $taxonomyVersion, $curator, 'bench', $now,
        ]);
        $written++;
    }

    $db->commit();

    // Report back what this response now stands at, so the bench can render
    // truth from the server rather than trusting its own optimism.
    $stmt = $db->prepare(
        "SELECT kind, axis_id, value
           FROM jd_ratings
          WHERE generation_id = ? AND client = 'bench' AND visitor_hash = ?
          ORDER BY kind, axis_id"
    );
    $stmt->execute([$generationId, $curator]);

    jd_json_out(200, [
        'ok'               => true,
        'generation_id'    => $generationId,
        'item_id'          => $gen['item_id'],
        'written'          => $written,
        'taxonomy_version' => $taxonomyVersion,
        'current'          => $stmt->fetchAll(PDO::FETCH_ASSOC),
    ]);
} catch (PDOException $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('jd-item-rate: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The rating could not be filed.');
}

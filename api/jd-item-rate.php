<?php
// POST /api/jd-item-rate.php — the curator's rating of ONE ITEM, whole.
//
// Sibling of jd-rate.php, not a reuse of it. jd-rate.php claims a submission
// once (one batch per submission, ever), requires a pairwise judgment, and
// releases the model reveal. Re-rating the corpus needs the opposite of all
// three: repeatable writes, no reveal, and — since 2026-09-05 — the whole
// item in ONE transaction, so a retry after a failure converges rather than
// half-applies. (It used to take one generation per request, which left an
// item half-filed when a later request failed.)
//
// Request:
//   {
//     "submission_id": "<ulid>",                 the item's submission
//     "size": "m" | null,                        optional — the item's tier
//     "responses": [
//       { "generation_id": "<ulid>",
//         "grade": 4 | null,                     null = leave the grade alone
//         "axes": { "<axis_id>": 3, ... },       only the axes sent are replaced
//         "rank": 1 | null,                      all responses ranked, or none
//         "note": "..." }                        optional
//     ]
//   }
//
// Writes jd_ratings rows exactly as the turn flow does — same table, same
// columns, same taxonomy_version discipline — under client='bench' and the
// curator's fixed hash, so curator and visitor ratings aggregate together and
// stay separable by `client`. Re-rating REPLACES this curator's prior answer
// on the same axis rather than stacking a second row; visitor rows are never
// touched. Ranks go to jd_ranks and REPLACE whatever row stood there for the
// drawing, whoever filed it (the bench's order is the same person's
// considered judgment superseding a first pass). The size goes to
// jd_submissions.size_class.
//
// AUTH: writes AUTHORITATIVE ratings under the curator identity, gated by
// jd_require_bench_key(). visitor_hash and client are ALWAYS assigned
// server-side and never read from the request.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_require_post();
jd_require_bench_key();

$body = jd_read_json_body();

$taxonomy = jd_taxonomy_required('jd-item-rate');
$taxonomyVersion = jd_taxonomy_version($taxonomy);
$axisRanks = jd_axis_ranks($taxonomy);   // live axes only: a retired axis is refused
$gradeRanks = jd_grade_ranks($taxonomy);
$sizeTiers = jd_size_tiers($taxonomy);

// --- Parse ----------------------------------------------------------------
$submissionId = $body['submission_id'] ?? null;
if (!jd_is_ulid($submissionId)) {
    jd_fail(400, 'bad_request', 'A submission_id is required.');
}

$size = $body['size'] ?? null;
if ($size !== null && (!is_string($size) || !isset($sizeTiers[$size]))) {
    jd_fail(400, 'rating_invalid', 'That size is not one of the taxonomy tiers.');
}

$responses = $body['responses'] ?? [];
if (!is_array($responses) || !array_is_list($responses)) {
    jd_fail(400, 'bad_request', 'responses must be a list.');
}
if (count($responses) > 4) {
    jd_fail(400, 'bad_request', 'An item carries at most four responses.');
}
if (!$responses && $size === null) {
    jd_fail(400, 'bad_request', 'Nothing to file.');
}

// Validate every response BEFORE opening a transaction, so a bad batch cannot
// half-apply.
$clean = [];
$ranked = 0;
$ranks = [];
foreach ($responses as $r) {
    if (!is_array($r)) {
        jd_fail(400, 'bad_request', 'Each response must be an object.');
    }
    $gid = $r['generation_id'] ?? null;
    if (!jd_is_ulid($gid)) {
        jd_fail(400, 'bad_request', 'Each response needs a generation_id.');
    }
    if (isset($clean[$gid])) {
        jd_fail(400, 'bad_request', 'A generation was listed twice.');
    }

    $axes = [];
    foreach ((array) ($r['axes'] ?? []) as $axisId => $value) {
        if (!is_string($axisId) || !isset($axisRanks[$axisId])) {
            jd_fail(400, 'rating_invalid', 'Unknown or retired axis: ' . var_export($axisId, true));
        }
        $rank = jd_rank_on_scale($value, $axisRanks[$axisId]);
        if ($rank === null) {
            jd_fail(400, 'rating_invalid', "Value out of range for axis $axisId.");
        }
        $axes[$axisId] = $rank;
    }

    $grade = null;
    if (array_key_exists('grade', $r) && $r['grade'] !== null) {
        $grade = jd_rank_on_scale($r['grade'], $gradeRanks);
        if ($grade === null) {
            jd_fail(400, 'rating_invalid', 'Value out of range for the grade scale.');
        }
    }

    $rank = null;
    if (array_key_exists('rank', $r) && $r['rank'] !== null) {
        $v = $r['rank'];
        if (is_bool($v) || !is_numeric($v) || (float) $v != (int) $v || (int) $v < 1 || (int) $v > 4) {
            jd_fail(400, 'rating_invalid', 'A rank must be a whole number from 1 to 4.');
        }
        $rank = (int) $v;
        $ranked++;
        $ranks[] = $rank;
    }

    $note = $r['note'] ?? null;
    if ($note !== null && (!is_string($note) || mb_strlen($note) > JD_NOTE_MAX_CHARS)) {
        jd_fail(400, 'bad_request', 'A note must be a string of at most ' . JD_NOTE_MAX_CHARS . ' characters.');
    }

    $clean[$gid] = ['axes' => $axes, 'grade' => $grade, 'rank' => $rank, 'note' => $note];
}

// The rank order is checked across the WHOLE item (which the old one-
// generation-per-request shape could not do): every response ranked or none,
// exactly one first, dense from 1 — the same rules jd-rate.php holds a
// visitor's ranking to.
if ($ranked > 0) {
    if ($ranked !== count($clean)) {
        jd_fail(400, 'ranking_invalid', 'Rank every response, or none of them.');
    }
    if (count(array_keys($ranks, 1, true)) !== 1) {
        jd_fail(400, 'ranking_invalid', 'Exactly one response must be ranked first.');
    }
    $distinct = array_values(array_unique($ranks));
    sort($distinct);
    if ($distinct !== range(1, count($distinct))) {
        jd_fail(400, 'ranking_invalid', 'Ranks must run 1, 2, 3 … with no gaps.');
    }
}

// --- Write ----------------------------------------------------------------
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $db->prepare('SELECT id, item_id FROM jd_submissions WHERE id = ?');
    $stmt->execute([$submissionId]);
    $sub = $stmt->fetch();
    if ($sub === false) {
        jd_fail(404, 'not_found', 'That submission is not on file.');
    }

    // Every generation must belong to THIS submission — a rating can never be
    // filed against a drawing from another turn, whatever the body claims.
    if ($clean) {
        $stmt = $db->prepare('SELECT id FROM jd_generations WHERE submission_id = ?');
        $stmt->execute([$submissionId]);
        $owned = array_fill_keys($stmt->fetchAll(PDO::FETCH_COLUMN), true);
        foreach (array_keys($clean) as $gid) {
            if (!isset($owned[$gid])) {
                jd_fail(400, 'bad_request', 'A generation does not belong to that submission.');
            }
        }
    }

    $curator = jd_curator_hash();
    $now = jd_now();

    $delAxis = $db->prepare(
        "DELETE FROM jd_ratings
          WHERE generation_id = ? AND client = 'bench' AND visitor_hash = ?
            AND kind = 'axis' AND axis_id = ?"
    );
    $delGrade = $db->prepare(
        "DELETE FROM jd_ratings
          WHERE generation_id = ? AND client = 'bench' AND visitor_hash = ?
            AND kind = 'grade'"
    );
    $ins = $db->prepare(
        'INSERT INTO jd_ratings
            (id, generation_id, kind, axis_id, value, note, taxonomy_version,
             visitor_hash, client, rated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $delRank = $db->prepare('DELETE FROM jd_ranks WHERE submission_id = ? AND generation_id = ?');
    $insRank = $db->prepare(
        'INSERT INTO jd_ranks
            (id, submission_id, generation_id, rank_pos, visitor_hash, client, rated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );

    $db->beginTransaction();
    $written = 0;
    $ranksFiled = true;

    if ($size !== null) {
        $db->prepare('UPDATE jd_submissions SET size_class = ? WHERE id = ?')
           ->execute([$size, $submissionId]);
        $written++;
    }

    foreach ($clean as $gid => $c) {
        $noteUsed = false;   // the note rides the first jd_ratings row only
        foreach ($c['axes'] as $axisId => $value) {
            $delAxis->execute([$gid, $curator, $axisId]);
            $ins->execute([jd_ulid(), $gid, 'axis', $axisId, $value,
                $noteUsed ? null : $c['note'], $taxonomyVersion, $curator, 'bench', $now]);
            $noteUsed = true;
            $written++;
        }
        if ($c['grade'] !== null) {
            $delGrade->execute([$gid, $curator]);
            $ins->execute([jd_ulid(), $gid, 'grade', null, $c['grade'],
                $noteUsed ? null : $c['note'], $taxonomyVersion, $curator, 'bench', $now]);
            $noteUsed = true;
            $written++;
        }
        if ($c['rank'] !== null) {
            // jd_ranks lands via the manual setup script; a database without
            // it yet files the rest of the batch rather than 500ing.
            try {
                $delRank->execute([$submissionId, $gid]);
                $insRank->execute([jd_ulid(), $submissionId, $gid, $c['rank'], $curator, 'bench', $now]);
                $written++;
            } catch (PDOException $e) {
                if (!jd_missing_table($e)) {
                    throw $e;
                }
                $ranksFiled = false;
            }
        }
    }

    $db->commit();
    if (!$ranksFiled) {
        error_log('jd-item-rate: jd_ranks is missing — filed without the ranks (run setup-jd-tables.php)');
    }

    jd_json_out(200, [
        'ok'               => true,
        'build'            => jd_build_stamp()['build'],
        'submission_id'    => $submissionId,
        'item_id'          => $sub['item_id'],
        'written'          => $written,
        'taxonomy_version' => $taxonomyVersion,
    ]);
} catch (PDOException $e) {
    if (isset($db) && $db instanceof PDO && $db->inTransaction()) {
        $db->rollBack();
    }
    error_log('jd-item-rate: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The rating could not be filed.');
}

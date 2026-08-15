<?php
// POST /api/jd-rate.php — the rating batch and the pairwise preference.
// Contract: PLAN-USER-PROMPTS-CONTRACTS.md C1.3.
//
// This is the ONLY place model identity is ever released. Blind rating is a
// server guarantee, not a UI courtesy: nothing else in the feature returns a
// model_id. One batch per submission, ever, and the whole batch is atomic.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-usage.php';   // the reveal prices what it cost
require_once __DIR__ . '/visitor-hash.php';

jd_require_allowed_origin();
jd_require_post();

// --- 1. Parse -------------------------------------------------------------
$body = jd_read_json_body();

$submissionId = $body['submission_id'] ?? null;
if (!is_string($submissionId) || !preg_match('/^[0-9A-HJKMNP-TV-Z]{26}$/', $submissionId)) {
    jd_fail(400, 'bad_request', 'A submission_id is required.');
}

$client = jd_normalize_client($body['client'] ?? null);

$ratings = $body['ratings'] ?? [];
if (!is_array($ratings) || !array_is_list($ratings)) {
    jd_fail(400, 'bad_request', 'ratings must be a list.');
}
if (count($ratings) > JD_RATINGS_MAX) {
    jd_fail(400, 'rating_invalid', 'Too many ratings in one batch.');
}

$comparison = $body['comparison'] ?? null;
if ($comparison !== null && !is_array($comparison)) {
    jd_fail(400, 'bad_request', 'comparison must be an object or null.');
}

$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    error_log('jd-rate: taxonomy.json could not be read at ' . JD_TAXONOMY_PATH);
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}

// taxonomy_version is what makes an old rating still mean something, so a
// taxonomy that cannot say which version it is must not produce rows: a
// silent 0 in the column would be indistinguishable from a real version.
$taxonomyVersion = (int) ($taxonomy['version'] ?? 0);
if ($taxonomyVersion < 1) {
    error_log('jd-rate: taxonomy.json has no usable version field');
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}

$db = null;

try {
    $db = jd_db();

    // --- 2. Load the submission and its generations -----------------------
    $stmt = $db->prepare('SELECT id, status FROM jd_submissions WHERE id = ?');
    $stmt->execute([$submissionId]);
    $submission = $stmt->fetch();
    if ($submission === false) {
        jd_fail(404, 'not_found', 'That submission is not on file.');
    }

    // provider/model_version/usage_tokens ride along so the reveal can say
    // what each surviving drawing cost (jd_build_reveal below).
    $stmt = $db->prepare('SELECT id, slot, model_id, status, provider, model_version, usage_tokens FROM jd_generations WHERE submission_id = ? ORDER BY slot');
    $stmt->execute([$submissionId]);
    $generations = $stmt->fetchAll();

    // --- 3. One batch per submission, ever --------------------------------
    if ($submission['status'] === 'rated') {
        // Deliberately no reveal here: an abandoned duplicate does not get a
        // second unveil channel.
        jd_fail(409, 'already_rated', 'This submission has already been rated.');
    }

    $bySlot = [];
    $byId = [];
    foreach ($generations as $generation) {
        $bySlot[$generation['slot']] = $generation;
        $byId[$generation['id']] = $generation;
    }
    $okSlots = array_values(array_filter($generations, static fn($g) => $g['status'] === 'ok'));
    if ($okSlots === []) {
        jd_fail(409, 'nothing_to_rate', 'Neither drawing survived, so there is nothing to rate.');
    }

    // --- 4. Validate every rating against the live taxonomy ---------------
    $gradeRanks = jd_taxonomy_grade_ranks($taxonomy);
    $axisRanks = jd_taxonomy_axis_ranks($taxonomy);

    $seenGrades = [];
    $seenAxes = [];
    $prepared = [];

    foreach ($ratings as $rating) {
        if (!is_array($rating)) {
            jd_fail(400, 'rating_invalid', 'A rating entry was not an object.');
        }

        $genId = $rating['gen_id'] ?? null;
        if (!is_string($genId) || !isset($byId[$genId]) || $byId[$genId]['status'] !== 'ok') {
            jd_fail(400, 'rating_invalid', 'A rating referenced a generation that cannot be rated.');
        }

        $kind = $rating['kind'] ?? null;
        $note = jd_clean_note($rating['note'] ?? null);

        if ($kind === 'grade') {
            if (array_key_exists('axis_id', $rating) && $rating['axis_id'] !== null) {
                jd_fail(400, 'rating_invalid', 'A grade cannot carry an axis_id.');
            }
            $value = jd_rank_on_scale(jd_numeric_value($rating['value'] ?? null), $gradeRanks);
            if ($value === null) {
                jd_fail(400, 'rating_invalid', 'That grade is not on the scale.');
            }
            if (isset($seenGrades[$genId])) {
                jd_fail(400, 'rating_invalid', 'Only one grade per response.');
            }
            $seenGrades[$genId] = true;
            $prepared[] = ['gen_id' => $genId, 'kind' => 'grade', 'axis_id' => null, 'value' => $value, 'note' => $note];
            continue;
        }

        if ($kind === 'axis') {
            $axisId = $rating['axis_id'] ?? null;
            // Defunct axes are never surveyed, so they are never accepted.
            if (!is_string($axisId) || !isset($axisRanks[$axisId])) {
                jd_fail(400, 'rating_invalid', 'That axis is not open for annotation.');
            }
            $value = jd_rank_on_scale(jd_numeric_value($rating['value'] ?? null), $axisRanks[$axisId]);
            if ($value === null) {
                jd_fail(400, 'rating_invalid', 'That value is not on the axis.');
            }
            $seenKey = $genId . '|' . $axisId;
            if (isset($seenAxes[$seenKey])) {
                jd_fail(400, 'rating_invalid', 'Only one value per axis per response.');
            }
            $seenAxes[$seenKey] = true;
            $prepared[] = ['gen_id' => $genId, 'kind' => 'axis', 'axis_id' => $axisId, 'value' => $value, 'note' => $note];
            continue;
        }

        if ($kind === 'flag') {
            // APP §4.6's whole mitigation: one row, no queue, no admin UI.
            if (array_key_exists('axis_id', $rating) && $rating['axis_id'] !== null) {
                jd_fail(400, 'rating_invalid', 'A flag cannot carry an axis_id.');
            }
            if (array_key_exists('value', $rating) && $rating['value'] !== null) {
                jd_fail(400, 'rating_invalid', 'A flag cannot carry a value.');
            }
            $prepared[] = ['gen_id' => $genId, 'kind' => 'flag', 'axis_id' => null, 'value' => null, 'note' => $note];
            continue;
        }

        jd_fail(400, 'rating_invalid', 'Unknown rating kind.');
    }

    // Comparison. The winner is named by SLOT and mapped here, so a client can
    // never file a foreign generation as the winner.
    $winnerGenId = null;
    $strength = null;
    if ($comparison === null) {
        if (count($okSlots) > 1) {
            jd_fail(400, 'comparison_required', 'A comparison is required when more than one drawing survived.');
        }
    } else {
        $winner = $comparison['winner'] ?? null;
        if ($winner !== 'a' && $winner !== 'b' && $winner !== 'c' && $winner !== 'd' && $winner !== 'tie') {
            jd_fail(400, 'rating_invalid', 'The winner must be "a", "b", "c", "d" or "tie".');
        }
        if ($winner !== 'tie') {
            if (!isset($bySlot[$winner]) || $bySlot[$winner]['status'] !== 'ok') {
                jd_fail(400, 'rating_invalid', 'That slot has no usable drawing to win with.');
            }
            $winnerGenId = $bySlot[$winner]['id'];
        }
        // strength — the likert margin (C1.3 addition, 2026-08-11: the single
        // bench files the call as winner + margin). NULLABLE on a won slot so
        // an older cached client that names only a winner still files; a tie
        // by definition has no margin.
        $strength = $comparison['strength'] ?? null;
        if ($strength !== null && $strength !== 'decisive' && $strength !== 'slight') {
            jd_fail(400, 'rating_invalid', 'The strength must be "decisive", "slight" or null.');
        }
        if ($winner === 'tie' && $strength !== null) {
            jd_fail(400, 'rating_invalid', 'A tie has no margin.');
        }
    }

    // --- 5/6. Write the batch atomically ----------------------------------
    // taxonomy_version was read from the server's own copy above; the client
    // never sends it.
    $visitorHash = msky_visitor_hash(jd_secrets());
    $ratedAt = jd_now();

    $db->beginTransaction();
    try {
        // Claim the submission FIRST. Step 3's read is only a fast path: two
        // concurrent batches can both pass it, and on the degraded path
        // (comparison null) there is no jd_comparisons unique key to make the
        // loser roll back. The guarded UPDATE is the serialization point —
        // exactly one caller can move a submission out of its current status,
        // and everything below rides on that row lock.
        $claim = $db->prepare("UPDATE jd_submissions SET status = 'rated' WHERE id = ? AND status <> 'rated'");
        $claim->execute([$submissionId]);
        if ($claim->rowCount() !== 1) {
            $db->rollBack();
            jd_fail(409, 'already_rated', 'This submission has already been rated.');
        }

        $insertRating = $db->prepare(
            'INSERT INTO jd_ratings
                (id, generation_id, kind, axis_id, value, note, taxonomy_version,
                 visitor_hash, client, rated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($prepared as $row) {
            $insertRating->execute([
                jd_ulid(),
                $row['gen_id'],
                $row['kind'],
                $row['axis_id'],
                $row['value'],
                $row['note'],
                $taxonomyVersion,
                $visitorHash,
                $client,
                $ratedAt,
            ]);
        }

        if ($comparison !== null) {
            // The strength column lands via setup-jd-tables.php's migration;
            // deploys are instant while the migration is a manual run, so a
            // database that has not run it yet files the batch WITHOUT the
            // margin rather than 500ing every rating in the gap.
            try {
                $db->prepare(
                    'INSERT INTO jd_comparisons
                        (id, submission_id, winner_gen_id, strength, visitor_hash, client, rated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                )->execute([jd_ulid(), $submissionId, $winnerGenId, $strength, $visitorHash, $client, $ratedAt]);
            } catch (PDOException $e) {
                if (!jd_missing_column($e)) {
                    throw $e;
                }
                error_log('jd-rate: jd_comparisons.strength is missing — filed without the margin (run setup-jd-tables.php)');
                $db->prepare(
                    'INSERT INTO jd_comparisons
                        (id, submission_id, winner_gen_id, visitor_hash, client, rated_at)
                     VALUES (?, ?, ?, ?, ?, ?)'
                )->execute([jd_ulid(), $submissionId, $winnerGenId, $visitorHash, $client, $ratedAt]);
            }
        }

        $db->commit();
    } catch (PDOException $e) {
        $db->rollBack();
        throw $e;
    }

    // --- 7. The reveal -----------------------------------------------------
    jd_json_out(200, ['ok' => true, 'reveal' => jd_build_reveal($generations, $taxonomy)]);
} catch (PDOException $e) {
    error_log('jd-rate database error: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The ratings could not be filed.');
}

// ---------------------------------------------------------------------------

/** @return float[] every grade rank on the live scale */
function jd_taxonomy_grade_ranks(array $taxonomy): array
{
    $ranks = [];
    foreach ($taxonomy['grades'] ?? [] as $grade) {
        if (isset($grade['rank'])) {
            $ranks[] = (float) $grade['rank'];
        }
    }
    return $ranks;
}

/** @return array<string,float[]> non-defunct axis id => its value ranks */
function jd_taxonomy_axis_ranks(array $taxonomy): array
{
    $axes = [];
    foreach ($taxonomy['axes'] ?? [] as $axis) {
        if (!isset($axis['id']) || !empty($axis['defunct'])) {
            continue;
        }
        $ranks = [];
        foreach ($axis['values'] ?? [] as $value) {
            if (isset($value['rank'])) {
                $ranks[] = (float) $value['rank'];
            }
        }
        $axes[(string) $axis['id']] = $ranks;
    }
    return $axes;
}

function jd_numeric_value(mixed $value): ?float
{
    if (is_int($value) || is_float($value)) {
        return (float) $value;
    }
    if (is_string($value) && is_numeric($value)) {
        return (float) $value;
    }
    return null;
}

// Ranks are filed as decimals; match on the DECIMAL(3,1) grid the column
// stores rather than on exact float equality, and return the TAXONOMY's rank
// rather than the client's near-miss — what is stored has to sit exactly on
// the published scale, or a GROUP BY value in the export splits a rank in two.
function jd_rank_on_scale(?float $value, array $ranks): ?float
{
    if ($value === null) {
        return null;
    }
    foreach ($ranks as $rank) {
        if (abs($rank - $value) < 0.05) {
            return $rank;
        }
    }
    return null;
}

// MySQL says SQLSTATE 42S22 / "Unknown column"; SQLite says "has no column
// named" (insert) or "no such column" (elsewhere). Anything else re-throws.
function jd_missing_column(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S22') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such column')
        || str_contains($msg, 'has no column named')
        || str_contains($msg, 'Unknown column');
}

function jd_clean_note(mixed $note): ?string
{
    if (!is_string($note)) {
        return null;
    }
    $note = trim($note);
    if ($note === '') {
        return null;
    }
    return mb_substr($note, 0, JD_NOTE_MAX_CHARS);
}

// Failed and rejected slots ARE revealed: the visitor may fairly learn which
// machine failed them. label/vendor come from the taxonomy models registry.
// Surviving generations also carry what they COST (owner call, 2026-08-15):
// the normalized token counts and the exact provider spend, computed by the
// shared api/jd-usage.php from the usage object jd-generate.php stored
// verbatim. A survivor with no usage recorded (never reached the provider —
// or a mock call) gets tokens/cost null and priced false rather than four
// honest-looking zeros; an UNPRICED model gets cost_usd null, never a
// confident $0. Failed slots get neither key — nothing was drawn, and a
// failed call's usage (when one exists) is partial anyway.
function jd_build_reveal(array $generations, array $taxonomy): array
{
    $registry = [];
    foreach ($taxonomy['models'] ?? [] as $model) {
        if (isset($model['id'])) {
            $registry[(string) $model['id']] = $model;
        }
    }

    $reveal = [];
    foreach ($generations as $generation) {
        $modelId = (string) $generation['model_id'];
        $entry = [
            'slot' => $generation['slot'],
            'model_id' => $modelId,
            'label' => (string) ($registry[$modelId]['label'] ?? $modelId),
            'vendor' => (string) ($registry[$modelId]['vendor'] ?? ''),
            'status' => $generation['status'],
        ];
        if ($generation['status'] === 'ok') {
            $usage = !empty($generation['usage_tokens'])
                ? json_decode((string) $generation['usage_tokens'], true) : null;
            $cost = jd_generation_cost(
                (string) ($generation['provider'] ?? ''),
                (string) ($generation['model_version'] ?? ''),
                is_array($usage) ? $usage : null
            );
            $t = $cost['tokens'];
            // the payload carries the three numbers a person reads; the cache
            // and reasoning buckets stay in the database (jd-spend.php's job)
            $entry['tokens'] = $t === null ? null : [
                'input' => $t['input'],
                'output' => $t['output'],
                'total' => $t['input'] + $t['cache_write'] + $t['cache_read'] + $t['output'],
            ];
            $entry['cost_usd'] = $cost['cost_usd'] === null
                ? null : round($cost['cost_usd'], 6);
            $entry['priced'] = $cost['priced'];
        }
        $reveal[] = $entry;
    }
    return $reveal;
}

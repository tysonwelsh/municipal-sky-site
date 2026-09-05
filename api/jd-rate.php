<?php
// POST /api/jd-rate.php — the rating batch and the visitor's judgment (a full
// rank order of the survivors, or the legacy single winner).
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
if (!jd_is_ulid($submissionId)) {
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

// ranking — the full order of the survivors (C1.3 addition, 2026-08-22), the
// successor to comparison's single winner. Both keys are accepted forever:
// ranking is the answer of record when it is present, comparison is what a
// visitor on a cached copy of the old JS still sends, and a client that sends
// both gets ranking read and comparison ignored (never an error — the old key
// is not evidence of a bug).
$ranking = $body['ranking'] ?? null;
if ($ranking !== null && (!is_array($ranking) || !array_is_list($ranking))) {
    jd_fail(400, 'bad_request', 'ranking must be a list or null.');
}
if (is_array($ranking) && count($ranking) > JD_RATINGS_MAX) {
    jd_fail(400, 'ranking_invalid', 'Too many entries in one ranking.');
}

// taxonomy_version is what makes an old rating still mean something (see
// jd_taxonomy_required for why a versionless taxonomy is refused outright)
$taxonomy = jd_taxonomy_required('jd-rate');
$taxonomyVersion = jd_taxonomy_version($taxonomy);

// THE TURN'S OWN CARD (2026-08-30). A fully rated turn takes a place in the
// drawer itself, so three facts the client knows reach the submission row:
// the TITLE a model wrote for the object (jd-title.php drafts it during the
// darkroom wait), the SIZE the visitor chose on the closing card, and whether
// they asked to SUPPRESS it — everything recorded, nothing displayed. They
// are columns on jd_submissions (since 2026-09-05; they rode as flag rows
// before), written with the claim below.
$titleIn = $body['title'] ?? null;
$title = (is_string($titleIn) && trim($titleIn) !== '') ? mb_substr(trim($titleIn), 0, 80) : null;
$sizeIn = $body['size'] ?? null;
$size = (is_string($sizeIn) && isset(jd_size_tiers($taxonomy)[$sizeIn])) ? $sizeIn : null;
$suppressed = !empty($body['suppress']) ? 1 : 0;

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
    $gradeRanks = jd_grade_ranks($taxonomy);
    $axisRanks = jd_axis_ranks($taxonomy);

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
            $value = jd_rank_on_scale($rating['value'] ?? null, $gradeRanks);
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
            $value = jd_rank_on_scale($rating['value'] ?? null, $axisRanks[$axisId]);
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

    // The judgment. Every slot here is named by SLOT and mapped through
    // $bySlot, so a client can never file a foreign generation as a winner or
    // as a ranked entry.
    //
    // Three accepted shapes, in precedence order:
    //   ranking present    -> the full order is the answer; comparison, if it
    //                         also came, is ignored without complaint.
    //   comparison present -> exactly today's legacy path, unchanged.
    //   neither            -> legal only on a single-survivor submission.
    $winnerGenId = null;
    $strength = null;
    $rankBySlot = null;   // slot => rank_pos, only when a full order was filed

    if ($ranking !== null) {
        $rankBySlot = jd_validate_ranking($ranking, $okSlots);
        // The rank-1 slot is the winner of record. Validation guarantees
        // exactly one of them, so this search cannot come back false.
        $winnerSlot = array_search(1, $rankBySlot, true);
        $winnerGenId = $bySlot[$winnerSlot]['id'];
        // strength stays NULL: a rank order carries no likert margin, and a
        // fabricated one would be indistinguishable from a real answer.
    } elseif ($comparison === null) {
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
        // and everything below rides on that row lock. The turn's own facts
        // (title, size, suppress — see above) land in the same statement.
        $claim = $db->prepare(
            "UPDATE jd_submissions
                SET status = 'rated', title = ?, size_class = ?, suppressed = ?
              WHERE id = ? AND status <> 'rated'"
        );
        $claim->execute([$title, $size, $suppressed, $submissionId]);
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

        if ($rankBySlot !== null) {
            // One row per surviving slot. The whole jd_ranks table lands via
            // setup-jd-tables.php, and a deploy is instant while that script is
            // a manual run — so a database that has not had it run yet files
            // the batch WITHOUT the order rather than 500ing every rating in
            // the gap. jd_missing_table() is deliberately narrow: any other
            // PDOException still reaches the outer catch and rolls the batch
            // back. Rating must never break because a migration lagged a
            // deploy.
            try {
                $insertRank = $db->prepare(
                    'INSERT INTO jd_ranks
                        (id, submission_id, generation_id, rank_pos, visitor_hash, client, rated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?)'
                );
                foreach ($rankBySlot as $slot => $rankPos) {
                    $insertRank->execute([
                        jd_ulid(),
                        $submissionId,
                        $bySlot[$slot]['id'],   // never from client input
                        $rankPos,
                        $visitorHash,
                        $client,
                        $ratedAt,
                    ]);
                }
            } catch (PDOException $e) {
                if (!jd_missing_table($e)) {
                    throw $e;
                }
                error_log('jd-rate: jd_ranks is missing — filed the winner only, without the order (run setup-jd-tables.php)');
            }
        }

        // jd_comparisons is written for BOTH shapes: a ranking files its
        // rank-1 generation as the winner with a NULL margin, so the win
        // series that predates ranking stays one continuous table and the
        // export keeps working unchanged.
        if ($rankBySlot !== null || $comparison !== null) {
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
// (the taxonomy rank helpers and the missing-table/column classifiers this
// file used to carry live in jd-config.php now, shared with every endpoint)

/**
 * C1.3's ranking rules, enforced here and never trusted from the client.
 *
 * Takes the raw `ranking` list and the submission's ok generations; returns
 * slot => rank_pos on success and never returns on failure (jd_fail exits).
 *
 * The rules, all of them:
 *   - one entry per ok slot, every ok slot present exactly once, nothing else;
 *   - rank is an integer >= 1;
 *   - EXACTLY ONE entry at rank 1 — there is never a tie for first;
 *   - ranks are DENSE: the distinct ranks used are exactly {1..k}. Ties below
 *     first are legal and expected (1,2,2,3 and 1,2,2,2 both pass), a gap is
 *     not (1,2,4 fails).
 *
 * Presence is NOT policed here: the contract says a client sends `ranking`
 * only when more than one slot survived, but a well-formed one-entry order on
 * a single-survivor submission records exactly the same fact as the legacy
 * one-slot comparison does, and rejecting it would throw away a visitor's
 * whole rating batch over a shape the server can read perfectly well.
 *
 * @param array $ranking  the client's list, already known to be a list
 * @param array $okSlots  jd_generations rows with status 'ok'
 * @return array<string,int>
 */
function jd_validate_ranking(array $ranking, array $okSlots): array
{
    $okBySlot = [];
    foreach ($okSlots as $generation) {
        $okBySlot[(string) $generation['slot']] = true;
    }

    if (count($ranking) !== count($okBySlot)) {
        jd_fail(400, 'ranking_invalid', 'The ranking must place every surviving drawing exactly once.');
    }

    $rankBySlot = [];
    foreach ($ranking as $entry) {
        if (!is_array($entry)) {
            jd_fail(400, 'ranking_invalid', 'A ranking entry was not an object.');
        }

        $slot = $entry['slot'] ?? null;
        if (!is_string($slot) || !isset($okBySlot[$slot])) {
            jd_fail(400, 'ranking_invalid', 'A ranking entry named a slot with no usable drawing.');
        }
        if (isset($rankBySlot[$slot])) {
            jd_fail(400, 'ranking_invalid', 'A slot was ranked twice.');
        }

        $rank = jd_rank_position($entry['rank'] ?? null);
        if ($rank === null) {
            jd_fail(400, 'ranking_invalid', 'A rank must be a whole number of 1 or more.');
        }

        $rankBySlot[$slot] = $rank;
    }

    // count($ranking) === count($okBySlot), every slot was a known ok slot and
    // none repeated, so by now every ok slot is present exactly once.

    if (count(array_keys($rankBySlot, 1, true)) !== 1) {
        jd_fail(400, 'ranking_invalid', 'Exactly one drawing must be ranked first.');
    }

    // Dense: the distinct ranks used, sorted, must be 1..k. This is what makes
    // a stored order readable years later without knowing the field size —
    // and it is checked on the values, so a client cannot smuggle a gap past
    // the rank-1 test.
    $distinct = array_values(array_unique(array_values($rankBySlot)));
    sort($distinct);
    if ($distinct !== range(1, count($distinct))) {
        jd_fail(400, 'ranking_invalid', 'Ranks must run 1, 2, 3 … with no gaps.');
    }

    return $rankBySlot;
}

// A rank position: a whole number >= 1. Accepts the integer a JSON client
// sends, and the integral float/numeric string a looser one might; rejects
// booleans, 0, negatives and anything fractional.
function jd_rank_position(mixed $value): ?int
{
    if (is_bool($value)) {
        return null;
    }
    if (is_int($value)) {
        return $value >= 1 ? $value : null;
    }
    if (is_float($value) || (is_string($value) && is_numeric($value))) {
        $number = (float) $value;
        if ($number < 1 || floor($number) !== $number) {
            return null;
        }
        return (int) $number;
    }
    return null;
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
    $registry = jd_model_registry($taxonomy);

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

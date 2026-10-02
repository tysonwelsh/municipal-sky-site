<?php
// POST /api/jd2-rate.php — file ONE sitting (a jd2_sessions row and everything
// it judged) over one run, atomically (dataset v2, PLAN-V2 §3, §4, §11).
//
// This is the ONLY place model identity is released (the reveal), as in v1:
// blind rating is a server guarantee, not a UI courtesy. Sessions are
// append-only — a re-rating is a new session, nothing is replaced.
//
// Request (every drawing is named by its SLOT, never by an id the client
// could forge onto a foreign run — the server maps slot → generation):
//   {
//     run_id: <run id>,                (submission_id accepted as an alias: SHIM
//                                       for the unchanged v1 turn card)
//     client: 'web'|'ios'|'android',
//     client_ref?: <UUID>,             a VISITOR's proof the run is theirs: the
//                                       client_ref their browser minted for the
//                                       turn and sent with every slot request
//                                       (jd2_prompts.client_ref); required of a
//                                       visitor, ignored for the owner
//     device_ref?: <UUID>,
//     title?: string, size?: <sizeTiers id>, suppress?: bool,
//     ratings: [ {slot, kind: 'grade'|'axis', axis_id?, value, note?} ],
//     ranking: [ {slot, rank, gap?} ] | null,    strict 1..n over every ok,
//                                                non-hidden drawing; gap 0..3
//                                                on every place but the last
//                                                (or on none)
//     pairs:   [ {slot_a, slot_b, score, shown_left?} ] | null,
//                                                −3..+3, positive = slot_a
//                                                preferred; each pair once
//     blind?: bool                               bench key only; default true
//     note?: string                              the sitting's rationale ("notes
//                                                for the record", Phase 4b):
//                                                trimmed, ≤ 2000 chars, blank =
//                                                none → jd2_sessions.note
//   }
//
// ONE SESSION, ONE METHOD for the comparative score: when `pairs` are sent
// they are filed as `direct` and nothing is derived; when they are not and
// the ranking carries gaps, the pairs are DERIVED from it (jd2_derive_pairs,
// `derived`, spaced-rank-v1). The gaps are filed on the ranking either way —
// they are the raw answer. A sitting with neither files without pairs and is
// not complete (a multi-drawing run needs every pair scored to be complete).
//
// Who: the bench key presented and right = the owner (unlimited sessions per
// run, each appended; no client_ref asked for); otherwise a visitor — and a
// visitor files only on THEIR OWN turn: a run a visitor asked for, whose
// prompt's client_ref is the one the request carries (the browser minted it
// for the turn and keeps it in its jd2-turn record). A run id and its origin
// are public once the prompt is live (data.php serves both), so without that
// proof a stranger could file a sitting on someone else's live item, hide it
// with suppress, and overwrite its title and size. A missing or wrong
// client_ref is 403 not_yours; a run the owner asked for is 403 forbidden.
// With the proof, at most ONE filed visitor session per run (409
// already_rated). Filing also lands the prompt's facts — title, size, and
// the keep-out (suppress → visibility 'hidden', hidden_by = the rater's
// role) — so a visitor sets them only under that same proof; and a COMPLETE
// sitting on a prompt that is not hidden makes it 'live' — a visitor's rated
// turn joins the drawer, v1's rule (approval is the roadmap's; approved_at is
// left alone).
//
// Response: { ok, build, session_id, run_id, prompt_id, complete, reveal: [
// {slot, model_id, label, vendor, status, tokens?, cost_usd?, priced?} ] } —
// v1's reveal shape; cost is the snapshot taken when the drawing was made.
// `build` is the tooling fingerprint (jd_build_stamp()['build']), as v1's
// writers answered it: the bench compares it with the queue's and says a
// deploy landed under the page.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-usage.php';   // the reveal's token summary
require_once __DIR__ . '/jd-build.php';   // the build the filing answers with

jd_require_allowed_origin();
jd_require_post();

/** The sitting's note allowance (jd2_sessions.note is TEXT; a cell's note is JD_NOTE_MAX_CHARS). */
const JD2_SESSION_NOTE_MAX = 2000;

// --- 1. Parse -------------------------------------------------------------
$body = jd_read_json_body();
$rater = jd2_rater();
$isOwner = $rater['role'] === JD2_ROLE_OWNER;

$runId = $body['run_id'] ?? ($body['submission_id'] ?? null);   // submission_id: SHIM alias
if (!jd_is_ulid($runId)) {
    jd2_fail(400, 'bad_request', 'A run_id is required.');
}
$ctx = ['run_id' => $runId];

$client = jd_normalize_client($body['client'] ?? null);
// the visitor's proof of ownership (checked against the run's prompt below)
$clientRef = $body['client_ref'] ?? null;
if (!is_string($clientRef) || !preg_match(JD_UUID_RE, $clientRef)) {
    $clientRef = null;
}
$deviceRef = $body['device_ref'] ?? null;
if (!is_string($deviceRef) || !preg_match(JD_UUID_RE, $deviceRef)) {
    $deviceRef = null;
}

$ratings = $body['ratings'] ?? [];
if (!is_array($ratings) || !array_is_list($ratings)) {
    jd2_fail(400, 'bad_request', 'ratings must be a list.', $ctx);
}
$ranking = $body['ranking'] ?? null;
if ($ranking !== null && (!is_array($ranking) || !array_is_list($ranking))) {
    jd2_fail(400, 'bad_request', 'ranking must be a list or null.', $ctx);
}
$pairsIn = $body['pairs'] ?? null;
if ($pairsIn !== null && (!is_array($pairsIn) || !array_is_list($pairsIn))) {
    jd2_fail(400, 'bad_request', 'pairs must be a list or null.', $ctx);
}

// blind = 1 unless the OWNER says the names were visible (the about page's
// walkthrough). A visitor's turn is blind by construction; their word on it
// is not asked for, so it is ignored rather than refused.
$blind = 1;
if (array_key_exists('blind', $body) && $body['blind'] !== null) {
    if (!is_bool($body['blind'])) {
        jd2_fail(400, 'bad_request', 'blind must be true or false.', $ctx);
    }
    if ($isOwner && $body['blind'] === false) {
        $blind = 0;
    }
}

// taxonomy_version and instrument_version are stamped from the server's own
// copy; the client never sends them
$taxonomy = jd_taxonomy_required('jd2-rate');
$taxonomyVersion = jd_taxonomy_version($taxonomy);
$liveAxes = jd_live_axes($taxonomy);
$gradeRanks = jd_grade_ranks($taxonomy);
$axisRanks = jd_axis_ranks($taxonomy);

// No sitting can hold more cells than every slot letter × every cell.
if (count($ratings) > strlen(JD2_SLOT_LETTERS) * count(jd2_required_cells($taxonomy))) {
    jd2_fail(400, 'rating_invalid', 'Too many ratings in one batch.', $ctx);
}

// The prompt's own facts, filed with the sitting (v1's turn card sends them).
$titleIn = $body['title'] ?? null;
$title = (is_string($titleIn) && trim($titleIn) !== '') ? mb_substr(trim($titleIn), 0, 80) : null;
$sizeIn = $body['size'] ?? null;
$size = (is_string($sizeIn) && isset(jd_size_tiers($taxonomy)[$sizeIn])) ? $sizeIn : null;
$suppress = !empty($body['suppress']);
// The sitting's own note, cleaned as a cell's note is (trimmed; empty or not
// a string = none) but clipped at the column's own allowance.
$sessionNote = jd2_clean_note($body['note'] ?? null) === null ? null
    : mb_substr(trim((string) $body['note']), 0, JD2_SESSION_NOTE_MAX);

try {
    $db = jd_db();

    // --- 2. The run, its prompt, its drawings -------------------------------
    $q = $db->prepare(
        'SELECT r.id, r.prompt_id, r.requested_by, r.created, p.visibility, p.client_ref
           FROM jd2_runs r JOIN jd2_prompts p ON p.id = r.prompt_id
          WHERE r.id = ?'
    );
    $q->execute([$runId]);
    $run = $q->fetch(PDO::FETCH_ASSOC);
    if ($run === false) {
        jd2_fail(404, 'not_found', 'That run is not on file.', $ctx);
    }
    $promptId = (string) $run['prompt_id'];
    $ctx['prompt_id'] = $promptId;

    if (!$isOwner) {
        // A run id is public once its prompt is live (data.php serves it), so
        // the visitor population is held to the runs visitors drew: their own
        // turn. The owner's prompts are rated by the owner.
        if ($run['requested_by'] !== JD2_ROLE_VISITOR) {
            jd2_fail(403, 'forbidden', 'Only the turn that drew these can rate them here.', $ctx);
        }
        // …and to THEIR turn: the run id is public, the client_ref is not.
        // Checked before already_rated, so a stranger learns nothing about
        // whether the turn was rated.
        $onFile = $run['client_ref'];
        if ($clientRef === null || !is_string($onFile) || $onFile === ''
            || !hash_equals(strtolower($onFile), strtolower($clientRef))) {
            jd2_fail(403, 'not_yours', 'Only the browser that took this turn can rate it.', $ctx);
        }
        // Fast path only; the guarded re-check inside the transaction is the
        // real serialization point. No reveal: a duplicate gets no second unveil.
        if (jd2_current_session($db, $runId, JD2_ROLE_VISITOR) !== null) {
            jd2_fail(409, 'already_rated', 'This turn has already been rated.', $ctx);
        }
    }

    $generations = jd2_run_generations($db, $runId, false);
    $rateable = [];   // slot => generation row: ok and not hidden
    $slotOf = [];     // generation id => slot, every drawing of the run
    $seat = [];       // slot => generation id, in dealt (slot) order
    foreach ($generations as $g) {
        $slotOf[(string) $g['id']] = (string) $g['slot'];
        $seat[(string) $g['slot']] = (string) $g['id'];
        if ($g['status'] === JD2_GEN_OK && (int) $g['hidden'] === 0) {
            $rateable[(string) $g['slot']] = $g;
        }
    }
    if ($rateable === []) {
        jd2_fail(409, 'nothing_to_rate', 'No drawing survived, so there is nothing to rate.', $ctx);
    }
    $n = count($rateable);

    // --- 3. The cells: grade and live axes, validated as v1 ------------------
    $cells = [];
    $seen = [];
    foreach ($ratings as $rating) {
        if (!is_array($rating)) {
            jd2_fail(400, 'rating_invalid', 'A rating entry was not an object.', $ctx);
        }
        $kind = $rating['kind'] ?? null;
        if ($kind === 'flag') {
            // SHIM: the v1 turn card still files a 'flag' row when a visitor
            // flags a drawing; v2 has no flag kind, so it is dropped here
            // rather than failing the whole sitting. Phase 4 stops sending it.
            continue;
        }
        $slot = jd2_rating_slot($rating, $rateable, $slotOf);
        if ($slot === null) {
            jd2_fail(400, 'rating_invalid', 'A rating named a slot with no usable drawing.', $ctx);
        }
        $gid = (string) $rateable[$slot]['id'];
        $note = jd2_clean_note($rating['note'] ?? null);

        if ($kind === 'grade') {
            if (array_key_exists('axis_id', $rating) && $rating['axis_id'] !== null && $rating['axis_id'] !== '') {
                jd2_fail(400, 'rating_invalid', 'A grade cannot carry an axis_id.', $ctx);
            }
            $value = jd_rank_on_scale($rating['value'] ?? null, $gradeRanks);
            if ($value === null) {
                jd2_fail(400, 'rating_invalid', 'That grade is not on the scale.', $ctx);
            }
            $axisId = '';
        } elseif ($kind === 'axis') {
            $axisId = $rating['axis_id'] ?? null;
            // Defunct axes are never surveyed, so they are never accepted.
            if (!is_string($axisId) || !isset($axisRanks[$axisId])) {
                jd2_fail(400, 'rating_invalid', 'That axis is not open for annotation.', $ctx);
            }
            $value = jd_rank_on_scale($rating['value'] ?? null, $axisRanks[$axisId]);
            if ($value === null) {
                jd2_fail(400, 'rating_invalid', 'That value is not on the axis.', $ctx);
            }
        } else {
            jd2_fail(400, 'rating_invalid', 'Unknown rating kind.', $ctx);
        }
        $key = $gid . '|' . $kind . '|' . $axisId;
        if (isset($seen[$key])) {
            jd2_fail(400, 'rating_invalid', $kind === 'grade'
                ? 'Only one grade per drawing.' : 'Only one value per axis per drawing.', $ctx);
        }
        $seen[$key] = true;
        $cells[] = [$gid, $kind, $axisId, $value, $note];
    }

    // --- 4. The ranking: strict 1..n, gaps between adjacent places -----------
    $places = $ranking === null ? null : jd2_validate_ranking($ranking, $rateable, $ctx);
    $hasGaps = false;
    if ($places !== null) {
        foreach ($places as $p) {
            $hasGaps = $hasGaps || $p['gap'] !== null;
        }
    }

    // --- 5. The pairs: asked directly, or derived from the gaps --------------
    $slotByGen = [];
    foreach ($rateable as $slot => $g) {
        $slotByGen[(string) $g['id']] = $slot;
    }
    $pairs = [];
    if ($pairsIn !== null && $pairsIn !== []) {
        $pairs = jd2_validate_pairs($pairsIn, $rateable, $slotByGen, $ctx);
    } elseif ($places !== null && $hasGaps && $n > 1) {
        $rows = [];
        foreach ($places as $slot => $p) {
            $rows[] = ['generation_id' => (string) $rateable[$slot]['id'], 'rank_pos' => $p['rank'],
                       'gap_after' => $p['gap'], 'slot' => $slot];
        }
        try {
            foreach (jd2_derive_pairs($rows) as $d) {
                $pairs[] = $d + ['shown_left' => null];
            }
        } catch (InvalidArgumentException $e) {
            // jd2_validate_ranking already holds the ranking to the same rules
            jd2_fail(400, 'ranking_invalid', $e->getMessage(), $ctx);
        }
    }

    // --- 6. File the sitting atomically ---------------------------------------
    $now = jd_now();
    $sessionId = jd_ulid();
    $db->beginTransaction();
    try {
        // The run row is the lock: on MySQL the UPDATE takes its row lock (a
        // second visitor batch waits here, and the read below then sees the
        // first one's session); on SQLite it takes the database write lock.
        $db->prepare('UPDATE jd2_runs SET status = status WHERE id = ?')->execute([$runId]);
        if (!$isOwner && jd2_current_session($db, $runId, JD2_ROLE_VISITOR) !== null) {
            $db->rollBack();
            jd2_fail(409, 'already_rated', 'This turn has already been rated.', $ctx);
        }

        $db->prepare(
            'INSERT INTO jd2_sessions
                (id, run_id, rater_role, rater_hash, device_ref, client, taxonomy_version,
                 instrument_version, blind, seat_order, note, started_at, filed_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $sessionId, $runId, $rater['role'], $rater['hash'], $deviceRef, $client,
            $taxonomyVersion, JD2_INSTRUMENT_VERSION, $blind,
            // the seats as dealt: slot => generation, in slot order (the run's deal)
            json_encode((object) $seat),
            $sessionNote,
            // the sitting opened when the drawings did: the run's filing time
            (string) $run['created'], $now, JD2_SESSION_FILED,
        ]);

        $ins = $db->prepare(
            'INSERT INTO jd2_judgments (id, session_id, generation_id, kind, axis_id, value, note)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($cells as [$gid, $kind, $axisId, $value, $note]) {
            $ins->execute([jd_ulid(), $sessionId, $gid, $kind, $axisId, $value, $note]);
        }

        if ($places !== null) {
            $ins = $db->prepare(
                'INSERT INTO jd2_rankings (id, session_id, generation_id, rank_pos, gap_after)
                 VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($places as $slot => $p) {
                $ins->execute([jd_ulid(), $sessionId, (string) $rateable[$slot]['id'], $p['rank'], $p['gap']]);
            }
        }

        $ins = $db->prepare(
            'INSERT INTO jd2_pairs (id, session_id, gen_a, gen_b, score, source, method, shown_left)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($pairs as $p) {
            $ins->execute([jd_ulid(), $sessionId, $p['gen_a'], $p['gen_b'], $p['score'],
                           $p['source'], $p['method'], $p['shown_left']]);
        }

        // Complete is computed from what was just filed, read back the way
        // every reader reads it.
        $complete = jd2_is_complete(
            jd2_session_standing($db, $sessionId),
            array_map(static fn ($g) => (string) $g['id'], array_values($rateable)),
            $taxonomy
        );

        // The prompt's facts. visibility is read inside the lock: suppress
        // keeps a prompt out (hidden_by = whoever asked), and a complete
        // sitting makes a prompt that nobody hid live.
        $q = $db->prepare('SELECT visibility FROM jd2_prompts WHERE id = ?');
        $q->execute([$promptId]);
        $visibility = (string) $q->fetchColumn();
        $sets = [];
        $vals = [];
        if ($title !== null) {
            $sets[] = 'title = ?';
            $vals[] = $title;
        }
        if ($size !== null) {
            $sets[] = 'size_class = ?';
            $vals[] = $size;
        }
        if ($suppress && $visibility !== JD2_VIS_HIDDEN) {
            array_push($sets, 'visibility = ?', 'hidden_by = ?', 'hidden_at = ?');
            array_push($vals, JD2_VIS_HIDDEN, $rater['role'], $now);
            $visibility = JD2_VIS_HIDDEN;
        } elseif ($complete && $visibility === JD2_VIS_DRAFT) {
            $sets[] = 'visibility = ?';
            $vals[] = JD2_VIS_LIVE;
        }
        if ($sets) {
            $vals[] = $promptId;
            $db->prepare('UPDATE jd2_prompts SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
        }

        $db->commit();
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    // --- 7. The reveal ---------------------------------------------------------
    jd_json_out(200, [
        'ok' => true,
        'build' => jd_build_stamp()['build'],
        'session_id' => $sessionId,
        'run_id' => $runId,
        'prompt_id' => $promptId,
        'complete' => $complete,
        'reveal' => jd2_build_reveal($generations, $taxonomy),
    ]);
} catch (PDOException $e) {
    error_log('jd2-rate database error: ' . $e->getMessage());
    jd2_fail(500, 'server_error', 'The ratings could not be filed.', $ctx);
}

// ---------------------------------------------------------------------------

/**
 * The slot a rating names, when it names a rateable drawing; else null.
 * `slot` is the address. `gen_id` is accepted too — SHIM: the unchanged v1
 * turn card files ratings by generation id — but only an id of THIS run's
 * drawings, mapped back to its slot, so a foreign id never files.
 */
function jd2_rating_slot(array $rating, array $rateable, array $slotOf): ?string
{
    $slot = $rating['slot'] ?? null;
    $gid = $rating['gen_id'] ?? null;
    if ($slot === null && is_string($gid)) {
        $slot = $slotOf[$gid] ?? null;
    } elseif ($slot !== null && $gid !== null && ($slotOf[(string) $gid] ?? null) !== $slot) {
        return null;   // the two addresses disagree
    }
    return (is_string($slot) && isset($rateable[$slot])) ? $slot : null;
}

/** A whole number (int, integral float, or integral numeric string), or null; never a bool. */
function jd2_whole(mixed $v): ?int
{
    if (is_bool($v) || $v === null) {
        return null;
    }
    if (is_int($v)) {
        return $v;
    }
    if (is_float($v) || (is_string($v) && is_numeric($v))) {
        $f = (float) $v;
        return floor($f) === $f ? (int) $f : null;
    }
    return null;
}

/**
 * The ranking rules, enforced here and never trusted from the client.
 * Returns slot => {rank, gap} in place order; never returns on failure.
 *
 *   - one entry per rateable slot, each exactly once, nothing else;
 *   - places are STRICT 1..n: no two drawings share a place (a tie is said
 *     as a gap of 0 between adjacent places), exactly one is first, and
 *     there are no holes;
 *   - `gap` is a whole number 0..3 (taxonomy "gaps"), on every place but
 *     the last or on none; the last place has nothing below it.
 */
function jd2_validate_ranking(array $ranking, array $rateable, array $ctx): array
{
    if (count($ranking) !== count($rateable)) {
        jd2_fail(400, 'ranking_invalid', 'The ranking must place every surviving drawing exactly once.', $ctx);
    }
    $rankBySlot = [];
    $gapBySlot = [];
    foreach ($ranking as $entry) {
        if (!is_array($entry)) {
            jd2_fail(400, 'ranking_invalid', 'A ranking entry was not an object.', $ctx);
        }
        $slot = $entry['slot'] ?? null;
        if (!is_string($slot) || !isset($rateable[$slot])) {
            jd2_fail(400, 'ranking_invalid', 'A ranking entry named a slot with no usable drawing.', $ctx);
        }
        if (isset($rankBySlot[$slot])) {
            jd2_fail(400, 'ranking_invalid', 'A slot was ranked twice.', $ctx);
        }
        $rank = jd2_whole($entry['rank'] ?? null);
        if ($rank === null || $rank < 1) {
            jd2_fail(400, 'ranking_invalid', 'A rank must be a whole number of 1 or more.', $ctx);
        }
        $gap = null;
        if (array_key_exists('gap', $entry) && $entry['gap'] !== null) {
            $gap = jd2_whole($entry['gap']);
            if ($gap === null || $gap < 0 || $gap > JD2_GAP_MAX) {
                jd2_fail(400, 'ranking_invalid', 'A gap is a whole number from 0 to ' . JD2_GAP_MAX . '.', $ctx);
            }
        }
        $rankBySlot[$slot] = $rank;
        $gapBySlot[$slot] = $gap;
    }

    $n = count($rankBySlot);
    if (count(array_unique($rankBySlot)) !== $n) {
        jd2_fail(400, 'ranking_invalid',
            'Two drawings share a place. Places run strictly 1 to ' . $n . '; say a tie as a gap of 0 between adjacent places.', $ctx);
    }
    if (jd_ranking_defect($rankBySlot) !== null) {
        // distinct places that are not exactly 1..n: no first, or a hole
        jd2_fail(400, 'ranking_invalid', 'Ranks must run 1, 2, 3 … ' . $n . ' with no gaps.', $ctx);
    }

    asort($rankBySlot);
    $gaps = 0;
    $places = [];
    foreach ($rankBySlot as $slot => $rank) {
        if ($rank === $n && $gapBySlot[$slot] !== null) {
            jd2_fail(400, 'ranking_invalid', 'The last place has nothing below it; its gap must be empty.', $ctx);
        }
        if ($gapBySlot[$slot] !== null) {
            $gaps++;
        }
        $places[$slot] = ['rank' => $rank, 'gap' => $gapBySlot[$slot]];
    }
    if ($gaps !== 0 && $gaps !== $n - 1) {
        jd2_fail(400, 'ranking_invalid', 'Give a gap on every place but the last, or on none.', $ctx);
    }
    return $places;
}

/**
 * Directly scored pairs → rows in canonical order (jd2_pair_key: by slot
 * letter), the score re-signed against that order so positive always means
 * gen_a was preferred. Each unordered pair at most once. shown_left, when
 * sent, names which of the two slots was on the left (position bias).
 */
function jd2_validate_pairs(array $pairsIn, array $rateable, array $slotByGen, array $ctx): array
{
    $out = [];
    $seen = [];
    foreach ($pairsIn as $p) {
        if (!is_array($p)) {
            jd2_fail(400, 'pairs_invalid', 'A pair entry was not an object.', $ctx);
        }
        $sa = $p['slot_a'] ?? null;
        $sb = $p['slot_b'] ?? null;
        if (!is_string($sa) || !is_string($sb) || !isset($rateable[$sa]) || !isset($rateable[$sb])) {
            jd2_fail(400, 'pairs_invalid', 'A pair named a slot with no usable drawing.', $ctx);
        }
        if ($sa === $sb) {
            jd2_fail(400, 'pairs_invalid', 'A pair needs two different drawings.', $ctx);
        }
        $score = jd2_whole($p['score'] ?? null);
        if ($score === null || abs($score) > JD2_SCORE_MAX) {
            jd2_fail(400, 'pairs_invalid', 'A pair score is a whole number from -' . JD2_SCORE_MAX . ' to ' . JD2_SCORE_MAX . '.', $ctx);
        }
        $key = strcmp($sa, $sb) < 0 ? $sa . $sb : $sb . $sa;
        if (isset($seen[$key])) {
            jd2_fail(400, 'pairs_invalid', 'That pair was scored twice.', $ctx);
        }
        $seen[$key] = true;
        $left = $p['shown_left'] ?? null;
        if ($left !== null && $left !== $sa && $left !== $sb) {
            jd2_fail(400, 'pairs_invalid', "shown_left must name one of the pair's two slots.", $ctx);
        }

        $ga = (string) $rateable[$sa]['id'];
        $gb = (string) $rateable[$sb]['id'];
        [$a, $b] = jd2_pair_key($ga, $gb, $slotByGen);
        $out[] = [
            'gen_a' => $a,
            'gen_b' => $b,
            'score' => $a === $ga ? $score : -$score,
            'source' => 'direct',
            'method' => null,
            'shown_left' => $left === null ? null : (string) $rateable[$left]['id'],
        ];
    }
    return $out;
}

// Failed and rejected slots ARE revealed: the rater may fairly learn which
// machine failed them (v1). label/vendor come from the taxonomy registry.
// A surviving drawing also states what it cost: the token summary from its
// stored usage, and cost_usd/priced as snapshotted when it was drawn — an
// unpriced model says cost_usd null, never a confident $0.
function jd2_build_reveal(array $generations, array $taxonomy): array
{
    $registry = jd_model_registry($taxonomy);
    $reveal = [];
    foreach ($generations as $g) {
        $modelId = (string) $g['model_id'];
        $entry = [
            'slot' => $g['slot'],
            'model_id' => $modelId,
            'label' => (string) ($registry[$modelId]['label'] ?? $modelId),
            'vendor' => (string) ($registry[$modelId]['vendor'] ?? ''),
            'status' => $g['status'],
        ];
        if ($g['status'] === JD2_GEN_OK) {
            $shown = jd_cost_summary(jd_price_generation_row(
                $g['usage_json'] ?? null, (string) $g['provider'], (string) $g['api_model']));
            $entry['tokens'] = $shown['tokens'];
            $entry['cost_usd'] = $g['cost_usd'] === null ? null : round((float) $g['cost_usd'], 6);
            $entry['priced'] = (int) $g['priced'] === 1;
        }
        $reveal[] = $entry;
    }
    return $reveal;
}

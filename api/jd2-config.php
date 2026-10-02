<?php
// Junk Drawer, dataset v2 — the shared definitions every jd2 endpoint and
// script includes (PLAN-V2 §3, §4). Phase 2 holds only what the schema and
// the instrument need to agree on:
//
//   1. the allowed words of every enumerated jd2_* column   (constants)
//   2. the instrument version and the derivation method     (constants)
//   3. the canonical pair order                             (jd2_pair_key)
//   4. the spaced-ranking derivation                        (jd2_derive_pairs)
//   5. what "complete" means at a taxonomy version          (jd2_required_cells)
//
// Include-only: no output, no session, no cookies. The database handle, the
// schema probes, the key gate, ULIDs and the taxonomy accessors come from
// jd-config.php (jd_db, jd_has_table, jd_require_setup_key, jd_ulid,
// jd_live_axes, …) and are not repeated here.
//
// The schema is api/setup-jd2-tables.php; the doc is db/junk-drawer-v2-schema.md.

require_once __DIR__ . '/jd-config.php';

// ---------------------------------------------------------------------------
// 1. Allowed words. Each list is defined ONCE, here; the runner builds the
// SQLite CHECK constraints and the MySQL column comments from these arrays.
// The columns are VARCHAR(16), never ENUM: widening v1's ENUM slot column was
// a migration that sat unrun for seventeen days (2026-09-10 → 09-27), and a
// new word here needs no ALTER on MySQL. (A SQLite dev database is disposable:
// delete local-dev/jd-dev.sqlite and re-run the runner to pick up a new word.)
// The writers validate against these lists before they insert.

/** jd2_prompts.origin — who wrote the prompt. */
const JD2_PROMPT_ORIGIN = ['owner', 'visitor'];

/** jd2_prompts.visibility — the ONE display switch. */
const JD2_VISIBILITY = ['draft', 'live', 'hidden'];

/** jd2_prompts.hidden_by — who set visibility to hidden. */
const JD2_HIDDEN_BY = ['owner', 'visitor'];

/** jd2_runs.kind — the first run of a prompt, or a later one. */
const JD2_RUN_KIND = ['initial', 'rerun'];

/** jd2_runs.requested_by — who asked for the run. */
const JD2_REQUESTED_BY = ['owner', 'visitor'];

/** jd2_runs.profile — the effort profile (JD_HARNESS_BY_PROFILE keys). */
const JD2_PROFILE = ['web', 'bench'];

/** jd2_runs.status */
const JD2_RUN_STATUS = ['pending', 'generated', 'failed'];

/** jd2_generations.status — v1's generation states, unchanged. */
const JD2_GEN_STATUS = ['pending', 'ok', 'failed', 'rejected'];

/** jd2_sessions.rater_role — two populations, never pooled. */
const JD2_RATER_ROLE = ['owner', 'visitor'];

/** jd2_sessions.status */
const JD2_SESSION_STATUS = ['open', 'filed', 'abandoned'];

/** jd2_judgments.kind — no 'flag' in v2. */
const JD2_JUDGMENT_KIND = ['grade', 'axis'];

/** jd2_pairs.source — asked as a head-to-head, or computed from a ranking. */
const JD2_PAIR_SOURCE = ['direct', 'derived'];

// ---------------------------------------------------------------------------
// 2. Versions. The instrument is the rubric plus the comparison and gaps
// scales plus the rules of a sitting; every session stamps it beside the
// taxonomy version. It matches taxonomy.json's top-level "instrument".

const JD2_INSTRUMENT_VERSION = 'v2.0';

/** jd2_pairs.method for rows jd2_derive_pairs() produces. Bump it when the rule changes; derived rows are a cache and re-derive. */
const JD2_DERIVE_METHOD = 'spaced-rank-v1';

/** The largest gap between adjacent places (taxonomy "gaps" 0..3). */
const JD2_GAP_MAX = 3;

/** The comparative score's bound: jd2_pairs.score is −3..+3. */
const JD2_SCORE_MAX = 3;

// ---------------------------------------------------------------------------
// 3. The canonical pair order. A pair of drawings has exactly ONE row in
// jd2_pairs, so (gen_a, gen_b) needs a rule that does not depend on who was
// ranked higher or shown on the left:
//
//   - when BOTH generations' slot letters are known (and differ), the one
//     with the earlier slot letter is gen_a (a before b before c …);
//   - otherwise the one with the smaller generation id is gen_a (ids are
//     ULIDs, so that is the one filed first).
//
// A run deals its slots once (jd2_runs.deal), so within a run the slot rule
// and a reader's later re-derivation always agree. jd2_pairs.score is signed
// against this order: positive = gen_a preferred.

/**
 * @param array<string,string> $slots  optional generation id => slot letter
 * @return array{0:string,1:string}     [gen_a, gen_b]
 * @throws InvalidArgumentException     when the two ids are empty or the same
 */
function jd2_pair_key(string $genA, string $genB, array $slots = []): array
{
    if ($genA === '' || $genB === '') {
        throw new InvalidArgumentException('jd2_pair_key: a generation id is empty.');
    }
    if ($genA === $genB) {
        throw new InvalidArgumentException("jd2_pair_key: a pair needs two different generations, got $genA twice.");
    }
    $slotA = isset($slots[$genA]) ? (string) $slots[$genA] : '';
    $slotB = isset($slots[$genB]) ? (string) $slots[$genB] : '';
    if ($slotA !== '' && $slotB !== '' && $slotA !== $slotB) {
        return strcmp($slotA, $slotB) < 0 ? [$genA, $genB] : [$genB, $genA];
    }
    return strcmp($genA, $genB) < 0 ? [$genA, $genB] : [$genB, $genA];
}

// ---------------------------------------------------------------------------
// 4. The spaced-ranking derivation (PLAN-V2 §4 B, method 'spaced-rank-v1').
//
// The rater files a strict order (places 1..n, no ties) and, between each
// pair of ADJACENT places, a gap 0..3 (0 = about the same … 3 = much better;
// labels are taxonomy.json "gaps"). Every unordered pair then gets a score:
//
//   between places i < j:  s = gap_after(i) + gap_after(i+1) + … + gap_after(j−1),
//                          clamped to 3; s favours place i (the better one).
//
// The row is then signed against the canonical order (jd2_pair_key):
// score = +s when place i's generation is gen_a, −s when it is gen_b. A tie
// is a zero gap, so two drawings separated only by zero gaps score 0.
//
// Input rows: ['generation_id' => string, 'rank_pos' => int 1..n,
// 'gap_after' => int 0..3 | null on the last place, optionally 'slot' => the
// generation's slot letter]. When every row carries a slot, the canonical
// order is by slot; otherwise by id. Integers may arrive as digit strings
// (PDO hands MySQL ints back as strings).
//
// Output: n(n−1)/2 rows, places (1,2), (1,3) … (n−1,n) in that order, each
// ['gen_a', 'gen_b', 'score' => int −3..+3, 'source' => 'derived',
//  'method' => 'spaced-rank-v1']. A one-drawing (or empty) ranking yields [].

/**
 * @param array<int,array{generation_id:string,rank_pos:int|string,gap_after:int|string|null,slot?:string}> $ranking
 * @return array<int,array{gen_a:string,gen_b:string,score:int,source:string,method:string}>
 * @throws InvalidArgumentException when the ranking is not a strict 1..n order with valid gaps
 */
function jd2_derive_pairs(array $ranking): array
{
    $n = count($ranking);
    $byPlace = [];   // rank_pos => row
    $seen = [];      // generation_id => true
    $slots = [];     // generation_id => slot letter
    $slotSeen = [];

    foreach (array_values($ranking) as $k => $row) {
        if (!is_array($row)) {
            throw new InvalidArgumentException("jd2_derive_pairs: row $k is not an array.");
        }
        $gen = $row['generation_id'] ?? null;
        if (!is_string($gen) || $gen === '') {
            throw new InvalidArgumentException("jd2_derive_pairs: row $k has no generation_id.");
        }
        if (isset($seen[$gen])) {
            throw new InvalidArgumentException("jd2_derive_pairs: generation $gen is ranked twice.");
        }
        $seen[$gen] = true;

        $pos = jd2_small_int($row['rank_pos'] ?? null);
        if ($pos === null || $pos < 1 || $pos > $n) {
            throw new InvalidArgumentException(
                "jd2_derive_pairs: generation $gen has rank_pos " . var_export($row['rank_pos'] ?? null, true)
                . "; places must be the integers 1..$n."
            );
        }
        if (isset($byPlace[$pos])) {
            throw new InvalidArgumentException(
                "jd2_derive_pairs: place $pos is held twice; ranks are strict 1..$n with no ties (a tie is a zero gap)."
            );
        }

        $hasGap = array_key_exists('gap_after', $row) && $row['gap_after'] !== null;
        $gap = $hasGap ? jd2_small_int($row['gap_after']) : null;
        if ($hasGap && ($gap === null || $gap < 0 || $gap > JD2_GAP_MAX)) {
            throw new InvalidArgumentException(
                "jd2_derive_pairs: generation $gen has gap_after " . var_export($row['gap_after'], true)
                . '; a gap is an integer 0..' . JD2_GAP_MAX . '.'
            );
        }

        $slot = isset($row['slot']) ? (string) $row['slot'] : '';
        if ($slot !== '') {
            if (isset($slotSeen[$slot])) {
                throw new InvalidArgumentException("jd2_derive_pairs: slot $slot is held by two generations.");
            }
            $slotSeen[$slot] = true;
            $slots[$gen] = $slot;
        }

        $byPlace[$pos] = ['gen' => $gen, 'gap' => $gap];
    }

    // Distinct places, each within 1..n, n of them: exactly 1..n. Now the
    // gaps: one between each adjacent pair, none after the last place.
    for ($p = 1; $p <= $n; $p++) {
        $gap = $byPlace[$p]['gap'];
        if ($p < $n && $gap === null) {
            throw new InvalidArgumentException(
                "jd2_derive_pairs: place $p has no gap_after; every place but the last needs a gap 0.." . JD2_GAP_MAX . '.'
            );
        }
        if ($p === $n && $gap !== null) {
            throw new InvalidArgumentException("jd2_derive_pairs: the last place ($n) must have gap_after null, got $gap.");
        }
    }

    // Slot order only when every drawing has one; a partial map would mix rules.
    if (count($slots) !== $n) {
        $slots = [];
    }

    $pairs = [];
    for ($i = 1; $i < $n; $i++) {
        $sum = 0;
        for ($j = $i + 1; $j <= $n; $j++) {
            $sum += $byPlace[$j - 1]['gap'];
            $s = min($sum, JD2_SCORE_MAX);
            $better = $byPlace[$i]['gen'];
            [$a, $b] = jd2_pair_key($better, $byPlace[$j]['gen'], $slots);
            $pairs[] = [
                'gen_a'  => $a,
                'gen_b'  => $b,
                'score'  => $s === 0 ? 0 : ($a === $better ? $s : -$s),
                'source' => 'derived',
                'method' => JD2_DERIVE_METHOD,
            ];
        }
    }
    return $pairs;
}

/** An int, or a string of decimal digits (PDO's MySQL ints), as an int; anything else null. */
function jd2_small_int(mixed $v): ?int
{
    if (is_int($v)) {
        return $v;
    }
    if (is_string($v) && $v !== '' && ctype_digit($v) && strlen($v) <= 4) {
        return (int) $v;
    }
    return null;
}

// ---------------------------------------------------------------------------
// 5. Completeness. A session is complete when every non-hidden ok generation
// of its run carries every cell this returns — the LIVE axes of the taxonomy
// the session was stamped with, plus the overall grade. Computed from the
// taxonomy handed in, never from a constant like v1's JD_QUEUE_RUBRIC_SINCE.
// In jd2_judgments a 'grade' cell is kind = 'grade' with axis_id = ''; an
// axis cell is kind = 'axis' with axis_id = the axis id.

/** @return string[] the live axis ids in taxonomy order, then 'grade' */
function jd2_required_cells(array $taxonomy): array
{
    return array_merge(array_map('strval', array_keys(jd_live_axes($taxonomy))), ['grade']);
}

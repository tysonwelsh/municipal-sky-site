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

/**
 * jd2_runs.profile — the effort profile a run was filed under: a
 * JD_HARNESS_BY_PROFILE key (web, bench-max, bench-medium, bench-low), plus
 * `bench`, the retired pre-split profile (max effort, a 12000-token budget,
 * harness v4-bench.3) still stored on the runs filed before 2026-10-02. No new
 * run is filed under `bench`; jd2-generate refuses to draw into one.
 */
const JD2_PROFILE = ['web', 'bench', 'bench-max', 'bench-medium', 'bench-low'];

/** The profiles a NEW owner run may be filed under (jd2-generate's `profile`). */
const JD2_OWNER_PROFILES = ['bench-medium', 'bench-low', 'bench-max', 'web'];

/**
 * The owner's default profile (owner, 2026-10-02: medium — "not all the way to
 * the bottom, but we don't need high either"). jd2-generate files an owner run
 * under it when no `profile` is sent, AND when the bare word `bench` is sent:
 * on the wire `bench` means "the server's default owner profile", so the
 * bench page and older clients follow this constant without an edit. The
 * batch runner's --profile defaults to it too.
 */
const JD2_OWNER_DEFAULT_PROFILE = 'bench-medium';

/** The retired stored profile (see JD2_PROFILE). */
const JD2_PROFILE_RETIRED = 'bench';

/**
 * An owner's requested profile as it will be filed: null or the wire alias
 * `bench` → JD2_OWNER_DEFAULT_PROFILE; anything else as sent (the caller
 * checks it against JD2_OWNER_PROFILES).
 */
function jd2_owner_profile(?string $requested): string
{
    return ($requested === null || $requested === JD2_PROFILE_RETIRED) ? JD2_OWNER_DEFAULT_PROFILE : $requested;
}

/** jd2_runs.status */
const JD2_RUN_STATUS = ['pending', 'generated', 'failed'];

/** jd2_generations.status — v1's generation states, unchanged. */
const JD2_GEN_STATUS = ['pending', 'ok', 'failed', 'rejected'];

/**
 * jd2_generations.normalized — what the sanitizer changed between the model's
 * raw_response and the svg served, as a comma-joined list of these words
 * (the keys of jd_sanitize_svg()'s 'normalized'); NULL when nothing was.
 * jd2_normalized_column() builds it.
 */
const JD2_GEN_NORMALIZED = ['cdata_unwrapped'];

/** jd2_sessions.rater_role — two populations, never pooled. */
const JD2_RATER_ROLE = ['owner', 'visitor'];

/** jd2_sessions.status */
const JD2_SESSION_STATUS = ['open', 'filed', 'abandoned'];

/** jd2_judgments.kind — no 'flag' in v2. */
const JD2_JUDGMENT_KIND = ['grade', 'axis'];

/** jd2_pairs.source — asked as a head-to-head, or computed from a ranking. */
const JD2_PAIR_SOURCE = ['direct', 'derived'];

/**
 * jd2_prompts.size_by — who set size_class last: the intake model, the owner
 * (the bench's catalogue entry and the ledger, through jd2-curate; the batch
 * runner's CSV) or the visitor
 * (the turn card's size card, shown only when intake failed). An owner's size
 * is never overwritten by the model (api/jd2-intake.php).
 */
const JD2_SIZE_BY = ['model', 'owner', 'visitor'];

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

// ===========================================================================
// Phase 3 — what the jd2 endpoints share (PLAN-V2 §3, §5, §11):
//
//   6. the named status words                            (constants)
//   7. the model pool and the deal                       (jd2_pool, jd2_deal)
//   8. the error envelope with the run's ids             (jd2_fail)
//   9. who is rating: owner or visitor                   (jd2_rater, jd2_require_bench_key)
//  10. the current session, its standing, completeness   (jd2_current_session, …)
//      — and the same rules over many runs at once        (jd2_current_sessions_for_runs,
//        jd2_standings_for_sessions, jd2_display_pick)
//
// The endpoints are api/jd2-generate.php, jd2-intake.php, jd2-rate.php,
// jd2-curate.php, jd2-gen-svg.php and art/junk-drawer/data.php; their
// request and response shapes are in db/junk-drawer-v2-schema.md, "Endpoints".

require_once __DIR__ . '/visitor-hash.php';

// ---------------------------------------------------------------------------
// 6. The status words the writers file, by name. Each IS a member of its
// list above (the list is what the runner's CHECKs and comments are built
// from); a name here is only so a statement reads `JD2_GEN_OK`, not 'ok'.

const JD2_RUN_PENDING = 'pending';
const JD2_RUN_GENERATED = 'generated';
const JD2_RUN_FAILED = 'failed';

const JD2_GEN_PENDING = 'pending';
const JD2_GEN_OK = 'ok';
const JD2_GEN_FAILED = 'failed';
const JD2_GEN_REJECTED = 'rejected';

const JD2_SESSION_FILED = 'filed';

const JD2_VIS_DRAFT = 'draft';
const JD2_VIS_LIVE = 'live';
const JD2_VIS_HIDDEN = 'hidden';

const JD2_ROLE_OWNER = 'owner';
const JD2_ROLE_VISITOR = 'visitor';

/** The slot letters a run can deal: a..z, so a pool may hold up to 26 models. */
const JD2_SLOT_LETTERS = 'abcdefghijklmnopqrstuvwxyz';

// ---------------------------------------------------------------------------
// 7. The pool is data (PLAN-V2 §6): taxonomy.json `models[]` entries with
// `"pool": true`, each naming its `provider` and wire `api_model`, in file
// order. Nothing in PHP names a model; a pool refresh is an edit to the
// taxonomy and a bump of its `poolVersion`, which every run records.
// The provider must be one the provider layer can call (a JD_EFFORT key):
// an unknown slug would otherwise fall through jd_provider_call() to the
// OpenAI branch and spend against the wrong vendor.

/**
 * @return list<array{model_id:string,api_model:string,provider:string}>
 *   the active pool, in taxonomy order; a 500 envelope when it is empty or
 *   a member cannot be called
 */
function jd2_pool(array $taxonomy): array
{
    $pool = [];
    foreach ($taxonomy['models'] ?? [] as $m) {
        if (!is_array($m) || ($m['pool'] ?? false) !== true) {
            continue;
        }
        $id = (string) ($m['id'] ?? '');
        $provider = (string) ($m['provider'] ?? '');
        $apiModel = (string) ($m['api_model'] ?? '');
        if ($id === '' || $provider === '' || $apiModel === '' || !isset(JD_EFFORT['web'][$provider])) {
            error_log('jd2_pool: taxonomy.json pool member ' . var_export($id, true)
                . ' lacks a callable provider or an api_model');
            jd_fail(500, 'server_error', 'The model pool is misconfigured.');
        }
        $pool[] = ['model_id' => $id, 'api_model' => $apiModel, 'provider' => $provider];
    }
    if ($pool === []) {
        error_log('jd2_pool: taxonomy.json has no model with "pool": true');
        jd_fail(500, 'server_error', 'The model pool is empty.');
    }
    if (count($pool) > strlen(JD2_SLOT_LETTERS)) {
        error_log('jd2_pool: ' . count($pool) . ' pool members, more than the 26 slot letters');
        jd_fail(500, 'server_error', 'The model pool is misconfigured.');
    }
    return $pool;
}

/**
 * A helper model the drawer calls OUTSIDE the eval pool, by use (taxonomy.json
 * `utility.<use>`, e.g. `utility.intake`, the intake clerk): its wire
 * `api_model` and its `provider`. Model names live in the taxonomy, never in
 * PHP; a 500 envelope with a sentence when the entry is absent or incomplete.
 *
 * @return array{api_model:string,provider:string}
 */
function jd2_utility_model(array $taxonomy, string $use): array
{
    $m = $taxonomy['utility'][$use] ?? null;
    $apiModel = is_array($m) ? ($m['api_model'] ?? null) : null;
    $provider = is_array($m) ? ($m['provider'] ?? null) : null;
    if (!is_string($apiModel) || $apiModel === '' || !is_string($provider) || $provider === '') {
        error_log('jd2_utility_model: taxonomy.json has no usable utility.' . $use . ' {api_model, provider}');
        jd_fail(500, 'server_error', 'The ' . $use . ' model is not configured in the taxonomy (utility.' . $use . ').');
    }
    return ['api_model' => $apiModel, 'provider' => $provider];
}

/** The pool snapshot's name (taxonomy.json `poolVersion`), stamped on every run; a 500 when absent. */
function jd2_pool_version(array $taxonomy): string
{
    $v = $taxonomy['poolVersion'] ?? null;
    if (!is_string($v) || $v === '' || strlen($v) > 32) {
        error_log('jd2_pool_version: taxonomy.json has no usable poolVersion');
        jd_fail(500, 'server_error', 'The model pool is misconfigured.');
    }
    return $v;
}

/**
 * The deal: which model draws in which seat, drawn ONCE per run and stored
 * in jd2_runs.deal. Slots are the first count($pool) letters a, b, c …; the
 * models are a uniformly random permutation of the pool (Fisher–Yates over
 * random_int), so model identity never correlates with slot position —
 * v1's pair_order discipline, for any pool size instead of a table of 24.
 *
 * @param list<array{model_id:string}> $pool  jd2_pool()
 * @return array<string,string>  slot letter => model_id, in slot order
 */
function jd2_deal(array $pool): array
{
    $ids = array_map(static fn ($m) => (string) $m['model_id'], array_values($pool));
    for ($i = count($ids) - 1; $i > 0; $i--) {
        $j = random_int(0, $i);
        [$ids[$i], $ids[$j]] = [$ids[$j], $ids[$i]];
    }
    $deal = [];
    foreach ($ids as $k => $id) {
        $deal[JD2_SLOT_LETTERS[$k]] = $id;
    }
    return $deal;
}

/**
 * A passing sanitizer verdict's 'normalized' as the jd2_generations.normalized
 * value: the words with a nonzero count, in JD2_GEN_NORMALIZED order (a word
 * the list does not know yet is kept, last, rather than hidden), joined by
 * commas; NULL when the drawing passed byte-identical.
 */
function jd2_normalized_column(array $verdict): ?string
{
    $counts = is_array($verdict['normalized'] ?? null) ? $verdict['normalized'] : [];
    $words = array_keys(array_filter($counts, static fn ($n): bool => (int) $n > 0));
    if (!$words) {
        return null;
    }
    usort($words, static function (string $a, string $b): int {
        $ia = array_search($a, JD2_GEN_NORMALIZED, true);
        $ib = array_search($b, JD2_GEN_NORMALIZED, true);
        return ($ia === false ? PHP_INT_MAX : $ia) <=> ($ib === false ? PHP_INT_MAX : $ib) ?: strcmp($a, $b);
    });
    return implode(',', $words);
}

/**
 * The status a run's slots settle it to: null while any dealt slot is still
 * pending (or the deal is unreadable), else 'generated' when at least one
 * drawing is ok and 'failed' when none is. jd2-generate applies it to a
 * pending run as its last slot settles; jd2-resanitize re-applies it after a
 * rejected drawing is recovered.
 */
function jd2_run_settled_status(PDO $db, string $runId): ?string
{
    $run = $db->prepare('SELECT deal FROM jd2_runs WHERE id = ?');
    $run->execute([$runId]);
    $dealt = count(jd2_deal_decode($run->fetchColumn()));
    $q = $db->prepare(
        "SELECT COUNT(*) AS settled, SUM(CASE WHEN status = '" . JD2_GEN_OK . "' THEN 1 ELSE 0 END) AS ok
           FROM jd2_generations WHERE run_id = ? AND status <> '" . JD2_GEN_PENDING . "'"
    );
    $q->execute([$runId]);
    $n = $q->fetch(PDO::FETCH_ASSOC);
    if ($dealt === 0 || (int) $n['settled'] < $dealt) {
        return null;
    }
    return (int) $n['ok'] > 0 ? JD2_RUN_GENERATED : JD2_RUN_FAILED;
}

/** A stored deal (jd2_runs.deal) back as slot => model_id; [] when unreadable. */
function jd2_deal_decode(mixed $json): array
{
    $deal = is_string($json) ? json_decode($json, true) : null;
    if (!is_array($deal)) {
        return [];
    }
    $out = [];
    foreach ($deal as $slot => $modelId) {
        if (is_string($slot) && preg_match('/^[a-z]$/', $slot) && is_string($modelId) && $modelId !== '') {
            $out[$slot] = $modelId;
        }
    }
    ksort($out);
    return $out;
}

// ---------------------------------------------------------------------------
// 8. jd_fail()'s envelope, carrying the v2 ids. A jd2 failure names the run
// and the prompt when they exist by then; `submission_id` repeats the run id
// because the unchanged v1 turn card (jd-turn.js, until Phase 4) reads a
// failed slot's submission_id to know which turn it belonged to. SHIM: drop
// the alias when the Phase 4 card reads run_id.

function jd2_fail(int $status, string $code, string $message, array $context = []): void
{
    $payload = ['ok' => false];
    if (isset($context['run_id']) && $context['run_id'] !== null) {
        $payload['submission_id'] = $context['run_id'];   // shim alias, see above
    }
    foreach (['run_id', 'prompt_id', 'gen_id', 'slot'] as $key) {
        if (isset($context[$key]) && $context[$key] !== null) {
            $payload[$key] = $context[$key];
        }
    }
    $payload['error'] = ['code' => $code, 'message' => $message];
    if (isset($context['retry_after'])) {
        $payload['retry_after'] = (int) $context['retry_after'];
        if (!headers_sent()) {
            header('Retry-After: ' . (int) $context['retry_after']);
        }
    }
    jd_json_out($status, $payload);
}

// ---------------------------------------------------------------------------
// 9. Who is rating (or drawing). Two populations, never pooled (PLAN-V2 §3):
//
//   owner   — the request PRESENTS the bench key (X-Bench-Key or ?key=) and
//             it is right; rater_hash is jd_curator_hash(), the fixed value
//             that groups the owner's sittings across days;
//   visitor — everyone else; rater_hash is msky_visitor_hash(), the salted
//             daily hash, exactly as v1 (no cookie, no session).
//
// A request that presents a WRONG key is refused (403, and a throttled miss)
// rather than quietly demoted to a visitor: a mistyped key must not file
// the owner's sitting under the visitor population. The gate is v1's one
// switch, JD_BENCH_REQUIRE_KEY, through jd2_require_bench_key(); a box with
// no key on file (a dev checkout without config/secrets.php) is open, so
// there any presented key makes the caller the owner.

/** 403/429 unless the caller holds the bench key — v1's gate, one switch for both datasets. */
function jd2_require_bench_key(): void
{
    jd_require_bench_key();
}

/** @return array{role:string,hash:string} */
function jd2_rater(): array
{
    if (jd_bench_key_supplied() !== '') {
        jd2_require_bench_key();
        return ['role' => JD2_ROLE_OWNER, 'hash' => jd_curator_hash()];
    }
    return ['role' => JD2_ROLE_VISITOR, 'hash' => msky_visitor_hash(jd_secrets())];
}

// ---------------------------------------------------------------------------
// 10. Reading a run's ratings. Three rules, applied by every reader:
//
//   CURRENT  — sessions are append-only; a role's current session on a run
//              is its latest `filed` one (by filed_at, then id).
//   OWNER OVER VISITOR — where one session must stand for the run, the
//              owner's current session outranks the visitor's.
//   COMPLETE — a session is complete when every non-hidden ok drawing of the
//              run carries a grade and every live axis, and — when there is
//              more than one — a strict ranking places them all and every
//              unordered pair of them has a score (direct or derived).
//
// For display (data.php, the curate standing) the three combine in
// jd2_display_session(): the owner's current session if it is complete,
// else the visitor's current session if it is complete; an incomplete
// sitting never displaces a complete one.

/**
 * The latest filed session on $runId: the owner's when $role is null and the
 * owner has one (else the visitor's), or only $role's when named.
 *
 * @return array<string,mixed>|null  the jd2_sessions row
 */
function jd2_current_session(PDO $db, string $runId, ?string $role = null): ?array
{
    $sql = "SELECT id, run_id, rater_role, rater_hash, device_ref, client, taxonomy_version,
                   instrument_version, blind, seat_order, started_at, filed_at, status
              FROM jd2_sessions
             WHERE run_id = ? AND status = '" . JD2_SESSION_FILED . "'";
    $args = [$runId];
    if ($role !== null) {
        $sql .= ' AND rater_role = ?';
        $args[] = $role;
    }
    $sql .= " ORDER BY CASE rater_role WHEN '" . JD2_ROLE_OWNER . "' THEN 0 ELSE 1 END,
                       filed_at DESC, id DESC
              LIMIT 1";
    $q = $db->prepare($sql);
    $q->execute($args);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/** How many ids one `IN (…)` list carries (SQLite's old host-parameter limit is 999). */
const JD2_IN_CHUNK = 500;

/**
 * The rows of $sql for every id in $ids. $sql holds the token `{ids}` where
 * the placeholder list goes ("… WHERE run_id IN ({ids}) ORDER BY run_id, …").
 * A long list is read in chunks of JD2_IN_CHUNK, one statement each; every
 * row of one id comes from the one chunk that holds it, so an ORDER BY that
 * leads with the IN column holds within each id. No ids, no query.
 *
 * @param list<string> $ids
 * @return list<array<string,mixed>>
 */
function jd2_select_in(PDO $db, string $sql, array $ids): array
{
    $ids = array_values(array_unique(array_map('strval', $ids)));
    $rows = [];
    foreach (array_chunk($ids, JD2_IN_CHUNK) as $chunk) {
        $q = $db->prepare(str_replace('{ids}', implode(', ', array_fill(0, count($chunk), '?')), $sql));
        $q->execute($chunk);
        foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $rows[] = $r;
        }
    }
    return $rows;
}

/**
 * jd2_current_session() for many runs in one read: per run, per role, the
 * latest filed session (by filed_at, then id) — the same rule and the same
 * columns, picked in PHP from one ordered scan instead of a query per run.
 *
 * @param list<string> $runIds
 * @return array<string,array<string,array<string,mixed>>>  run id => role => the jd2_sessions row
 */
function jd2_current_sessions_for_runs(PDO $db, array $runIds): array
{
    $rows = jd2_select_in($db,
        "SELECT id, run_id, rater_role, rater_hash, device_ref, client, taxonomy_version,
                instrument_version, blind, seat_order, started_at, filed_at, status
           FROM jd2_sessions
          WHERE run_id IN ({ids}) AND status = '" . JD2_SESSION_FILED . "'
          ORDER BY run_id, rater_role, filed_at DESC, id DESC",
        $runIds);
    $out = [];
    foreach ($rows as $r) {
        $out[(string) $r['run_id']][(string) $r['rater_role']] ??= $r;   // the first per (run, role) is the latest
    }
    return $out;
}

/**
 * Everything one session filed, folded for reading:
 *
 *   judgments  generation_id => {grade: ?float, axes: {axis_id: float},
 *              notes: {axis_id|'grade': string}}
 *   rankings   generation_id => {rank_pos: int, gap_after: ?int}
 *   pairs      list of {gen_a, gen_b, score: int, source, method, shown_left}
 *
 * @return array{judgments:array,rankings:array,pairs:list<array>}
 */
function jd2_session_standing(PDO $db, string $sessionId): array
{
    return jd2_standings_for_sessions($db, [$sessionId])[$sessionId];
}

/**
 * jd2_session_standing() for many sessions in one read per table: session id
 * => its standing, the same fold (judgments in filing order, rankings by
 * place, pairs in filing order). A session that filed nothing still answers
 * an empty standing.
 *
 * @param list<string> $sessionIds
 * @return array<string,array{judgments:array,rankings:array,pairs:list<array>}>
 */
function jd2_standings_for_sessions(PDO $db, array $sessionIds): array
{
    $out = [];
    foreach ($sessionIds as $sid) {
        $out[(string) $sid] = ['judgments' => [], 'rankings' => [], 'pairs' => []];
    }

    foreach (jd2_select_in($db, 'SELECT session_id, generation_id, kind, axis_id, value, note
                                   FROM jd2_judgments WHERE session_id IN ({ids}) ORDER BY session_id, id', $sessionIds) as $r) {
        $o = &$out[(string) $r['session_id']];
        $gid = (string) $r['generation_id'];
        $o['judgments'][$gid] ??= ['grade' => null, 'axes' => [], 'notes' => []];
        $cell = $r['kind'] === 'grade' ? 'grade' : (string) $r['axis_id'];
        if ($r['kind'] === 'grade') {
            $o['judgments'][$gid]['grade'] = (float) $r['value'];
        } else {
            $o['judgments'][$gid]['axes'][$cell] = (float) $r['value'];
        }
        if ($r['note'] !== null && $r['note'] !== '') {
            $o['judgments'][$gid]['notes'][$cell] = (string) $r['note'];
        }
        unset($o);
    }

    foreach (jd2_select_in($db, 'SELECT session_id, generation_id, rank_pos, gap_after
                                   FROM jd2_rankings WHERE session_id IN ({ids}) ORDER BY session_id, rank_pos', $sessionIds) as $r) {
        $out[(string) $r['session_id']]['rankings'][(string) $r['generation_id']] = [
            'rank_pos' => (int) $r['rank_pos'],
            'gap_after' => $r['gap_after'] === null ? null : (int) $r['gap_after'],
        ];
    }

    foreach (jd2_select_in($db, 'SELECT session_id, gen_a, gen_b, score, source, method, shown_left
                                   FROM jd2_pairs WHERE session_id IN ({ids}) ORDER BY session_id, id', $sessionIds) as $r) {
        $out[(string) $r['session_id']]['pairs'][] = [
            'gen_a' => (string) $r['gen_a'],
            'gen_b' => (string) $r['gen_b'],
            'score' => (int) $r['score'],
            'source' => (string) $r['source'],
            'method' => $r['method'],
            'shown_left' => $r['shown_left'],
        ];
    }
    return $out;
}

/**
 * COMPLETE, from a session's standing and the drawings it must cover (the
 * run's non-hidden ok generations). The cells come from the taxonomy handed
 * in (jd2_required_cells: the live axes and the grade). A drawing the owner
 * hid after the sitting simply drops out of $generationIds: the ranking need
 * only place the ones left in distinct places, and only their pairs count.
 *
 * @param string[] $generationIds
 */
function jd2_is_complete(array $standing, array $generationIds, array $taxonomy): bool
{
    $ids = array_values(array_unique(array_map('strval', $generationIds)));
    if ($ids === []) {
        return false;
    }
    $axes = array_map('strval', array_keys(jd_live_axes($taxonomy)));
    foreach ($ids as $gid) {
        $j = $standing['judgments'][$gid] ?? null;
        if ($j === null || $j['grade'] === null) {
            return false;
        }
        foreach ($axes as $axis) {
            if (!array_key_exists($axis, $j['axes'])) {
                return false;
            }
        }
    }
    if (count($ids) === 1) {
        return true;
    }

    $places = [];
    foreach ($ids as $gid) {
        $pos = $standing['rankings'][$gid]['rank_pos'] ?? null;
        if ($pos === null || isset($places[$pos])) {
            return false;
        }
        $places[$pos] = true;
    }

    $scored = [];
    foreach ($standing['pairs'] as $p) {
        $k = strcmp($p['gen_a'], $p['gen_b']) < 0 ? $p['gen_a'] . '|' . $p['gen_b'] : $p['gen_b'] . '|' . $p['gen_a'];
        $scored[$k] = true;
    }
    $n = count($ids);
    for ($i = 0; $i < $n; $i++) {
        for ($j = $i + 1; $j < $n; $j++) {
            $k = strcmp($ids[$i], $ids[$j]) < 0 ? $ids[$i] . '|' . $ids[$j] : $ids[$j] . '|' . $ids[$i];
            if (!isset($scored[$k])) {
                return false;
            }
        }
    }
    return true;
}

/**
 * The session that stands for a run on display: the owner's current session
 * when it is complete, else the visitor's current session when it is
 * complete, else — only when $fallback — the current session owner-first,
 * complete or not (the admin card of a prompt still being rated).
 *
 * @param string[] $generationIds  the run's non-hidden ok generations
 * @return array{session:array,standing:array,complete:bool}|null
 */
function jd2_display_session(PDO $db, string $runId, array $generationIds, array $taxonomy, bool $fallback = false): ?array
{
    $current = [];
    foreach ([JD2_ROLE_OWNER, JD2_ROLE_VISITOR] as $role) {
        $s = jd2_current_session($db, $runId, $role);
        if ($s !== null) {
            $current[$role] = $s;
        }
    }
    $standings = jd2_standings_for_sessions($db, array_map(static fn ($s) => (string) $s['id'], array_values($current)));
    return jd2_display_pick($current, $standings, $generationIds, $taxonomy, $fallback);
}

/**
 * jd2_display_session()'s rule over sessions already read — the set-based
 * readers (data.php, jd2-analytics) fetch every run's current sessions and
 * their standings at once and pick here. The owner's current session if
 * complete, else the visitor's if complete, else (only with $fallback) the
 * current session owner-first, complete or not.
 *
 * @param array<string,array> $current    role => that role's current session row on the run
 * @param array<string,array> $standings  session id => jd2_standings_for_sessions() standing
 * @param string[] $generationIds         the run's non-hidden ok generations
 * @return array{session:array,standing:array,complete:bool}|null
 */
function jd2_display_pick(array $current, array $standings, array $generationIds, array $taxonomy, bool $fallback = false): ?array
{
    $empty = ['judgments' => [], 'rankings' => [], 'pairs' => []];
    foreach ([JD2_ROLE_OWNER, JD2_ROLE_VISITOR] as $role) {
        $s = $current[$role] ?? null;
        if ($s === null) {
            continue;
        }
        $standing = $standings[(string) $s['id']] ?? $empty;
        if (jd2_is_complete($standing, $generationIds, $taxonomy)) {
            return ['session' => $s, 'standing' => $standing, 'complete' => true];
        }
    }
    if (!$fallback) {
        return null;
    }
    $s = $current[JD2_ROLE_OWNER] ?? ($current[JD2_ROLE_VISITOR] ?? null);
    if ($s === null) {
        return null;
    }
    $standing = $standings[(string) $s['id']] ?? $empty;
    return ['session' => $s, 'standing' => $standing,
            'complete' => jd2_is_complete($standing, $generationIds, $taxonomy)];
}

/**
 * The rating reads of a set-based reader, for every run in $runIds at once:
 * each run's current sessions per role (jd2_current_sessions_for_runs) and
 * those sessions' standings (jd2_standings_for_sessions) — four queries,
 * whatever the number of runs. jd2_display_pick() then applies the rules.
 *
 * @param list<string> $runIds
 * @return array{0:array<string,array<string,array>>,1:array<string,array>}  [run id => role => session row, session id => standing]
 */
function jd2_current_with_standings(PDO $db, array $runIds): array
{
    $current = jd2_current_sessions_for_runs($db, $runIds);
    $sessionIds = [];
    foreach ($current as $byRole) {
        foreach ($byRole as $s) {
            $sessionIds[] = (string) $s['id'];
        }
    }
    return [$current, jd2_standings_for_sessions($db, $sessionIds)];
}

/** Every run id of a jd2_runs_for_prompts() answer. @return list<string> */
function jd2_run_ids(array $runsByPrompt): array
{
    $ids = [];
    foreach ($runsByPrompt as $runs) {
        foreach ($runs as $run) {
            $ids[] = (string) $run['id'];
        }
    }
    return $ids;
}

/**
 * The ETag's movers for a v2 reader (data.php, jd2-analytics): two aggregate
 * reads — filed sessions (how many, the newest filed_at) and generations
 * (how many; how many ok, pending, hidden and priced; the newest created) —
 * as one stamp string. What else moves an answer (a prompt's facts, a run,
 * a drawing hidden or shown) the reader folds in from the rows it reads
 * anyway, with jd2_etag_reads().
 */
function jd2_etag_movers(PDO $db): string
{
    $s = $db->query("SELECT COUNT(*) AS n, MAX(filed_at) AS m FROM jd2_sessions WHERE status = '" . JD2_SESSION_FILED . "'")
        ->fetch(PDO::FETCH_ASSOC);
    $g = $db->query(
        "SELECT COUNT(*) AS n,
                SUM(CASE WHEN status = '" . JD2_GEN_OK . "' THEN 1 ELSE 0 END) AS ok,
                SUM(CASE WHEN status = '" . JD2_GEN_PENDING . "' THEN 1 ELSE 0 END) AS pending,
                SUM(hidden) AS hid, COUNT(cost_usd) AS priced, MAX(created) AS m
           FROM jd2_generations"
    )->fetch(PDO::FETCH_ASSOC);
    return 's|' . $s['n'] . '@' . $s['m'] . ';g|' . $g['n'] . '/' . $g['ok'] . '/' . $g['pending'] . '/' . $g['hid']
        . '/' . $g['priced'] . '@' . $g['m'] . ';';
}

/**
 * The rest of a reader's ETag, from the rows it already read: every prompt
 * row as read, and per prompt its runs and each generation's id, status and
 * hidden flag (jd2_runs_for_prompts) — so a prompt's facts changing, a rerun,
 * or a drawing hidden and another shown moves the tag exactly.
 *
 * @param list<array> $prompts
 * @param array<string,list<array>> $runsByPrompt
 */
function jd2_etag_reads(array $prompts, array $runsByPrompt): string
{
    $h = '';
    foreach ($prompts as $p) {
        $h .= implode('/', array_map('strval', $p)) . ';';
        foreach ($runsByPrompt[(string) $p['id']] ?? [] as $run) {
            $h .= $run['id'] . ':' . $run['status'] . '[';
            foreach ($run['gens'] as $g) {
                $h .= $g['id'] . '/' . $g['status'] . '/' . (int) $g['hidden'] . ',';
            }
            $h .= ']';
        }
    }
    return 'r|' . md5($h) . ';';
}

/** A run's drawings that count — ok and not hidden — as rows (id, slot, …), in slot order. */
function jd2_run_generations(PDO $db, string $runId, bool $countingOnly = true): array
{
    $sql = 'SELECT id, run_id, slot, model_id, api_model, provider, status, hidden,
                   usage_json, cost_usd, priced, created
              FROM jd2_generations WHERE run_id = ?';
    if ($countingOnly) {
        $sql .= " AND status = '" . JD2_GEN_OK . "' AND hidden = 0";
    }
    $q = $db->prepare($sql . ' ORDER BY slot');
    $q->execute([$runId]);
    return $q->fetchAll(PDO::FETCH_ASSOC);
}

/** A rater's remark, trimmed and clipped to JD_NOTE_MAX_CHARS; null when empty or not a string. */
function jd2_clean_note(mixed $note): ?string
{
    if (!is_string($note)) {
        return null;
    }
    $note = trim($note);
    return $note === '' ? null : mb_substr($note, 0, JD_NOTE_MAX_CHARS);
}

/**
 * A database handle for the DRAWER's read, or null when there is none. The
 * drawer must paint through an outage (an empty manifest, never a 500), and
 * jd_db() cannot promise that on MySQL: it goes through api/database.php,
 * whose connection failure EXITS with a 500 before any caller can catch it.
 * So off the dev box this opens its own PDO with the DSN and options
 * database.php uses (host localhost, utf8mb4 — keep the two in step) and
 * answers null on any failure. In dev it is jd_db()'s SQLite file.
 */
function jd2_db_or_null(): ?PDO
{
    try {
        if (JD_DEV_MODE) {
            return jd_db();
        }
        $s = jd_secrets();
        foreach (['db_name', 'db_user', 'db_pass'] as $k) {
            if (!isset($s[$k])) {
                return null;
            }
        }
        return new PDO('mysql:host=localhost;dbname=' . $s['db_name'] . ';charset=utf8mb4', $s['db_user'], $s['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $e) {
        error_log('jd2_db_or_null: no database (' . $e->getMessage() . ')');
        return null;
    }
}

// ===========================================================================
// Phase 3c — what the owner-side readers share (jd2-queue.php, jd2-ledger.php,
// jd2-analytics.php; PLAN-V2 §5):
//
//  11. a prompt's runs and drawings, read once             (jd2_prompt_runs,
//      — or many prompts' at once                          jd2_runs_for_prompts)
//  12. is a run's drawing finished                         (jd2_run_settled)
//  13. the run the bench rates, and what it still needs    (jd2_bench_view, jd2_needs)
//  14. which drawing the drawer shows on a run, and why    (jd2_shows)
//
// They sit on top of section 10 and never restate it: "current", "owner over
// visitor" and "complete" are still jd2_current_session, jd2_display_session
// and jd2_is_complete, called from here.

// ---------------------------------------------------------------------------
// 11. A prompt's runs, newest first, each with EVERY generation row (any
// status, hidden or not; no svg/raw text) under 'gens' and the ids of the
// ones that count (ok, not hidden) under 'counting'.

/** @return list<array<string,mixed>> */
function jd2_prompt_runs(PDO $db, string $promptId): array
{
    return jd2_runs_for_prompts($db, [$promptId])[$promptId] ?? [];
}

/**
 * jd2_prompt_runs() for many prompts in two reads (their runs, then those
 * runs' generations): prompt id => its runs newest first, each with 'gens'
 * (every generation, slot order) and 'counting' (the ids that count). A
 * prompt with no run is absent.
 *
 * @param list<string> $promptIds
 * @return array<string,list<array<string,mixed>>>
 */
function jd2_runs_for_prompts(PDO $db, array $promptIds): array
{
    $runs = jd2_select_in($db,
        'SELECT id, prompt_id, kind, requested_by, profile, harness, pool_version, deal, status, created
           FROM jd2_runs WHERE prompt_id IN ({ids}) ORDER BY prompt_id, created DESC, id DESC',
        $promptIds);
    $gensByRun = [];
    foreach (jd2_select_in($db,
        'SELECT id, run_id, slot, model_id, api_model, provider, status, reject_reason, hidden,
                latency_ms, usage_json, cost_usd, priced, created
           FROM jd2_generations WHERE run_id IN ({ids}) ORDER BY run_id, slot',
        array_column($runs, 'id')) as $g) {
        $gensByRun[(string) $g['run_id']][] = $g;
    }
    $out = [];
    foreach ($runs as $run) {
        $run['gens'] = $gensByRun[(string) $run['id']] ?? [];
        $run['counting'] = [];
        foreach ($run['gens'] as $gen) {
            if ($gen['status'] === JD2_GEN_OK && (int) $gen['hidden'] === 0) {
                $run['counting'][] = (string) $gen['id'];
            }
        }
        $out[(string) $run['prompt_id']][] = $run;
    }
    return $out;
}

// ---------------------------------------------------------------------------
// 12. A run is SETTLED when every slot its deal dealt has a generation row and
// none of them is still pending. A run still drawing (the batch runner is
// mid-row, or a slot request never came) is not offered for rating: a sitting
// filed now would go incomplete the moment the next drawing lands.

/** @param array $run a jd2_prompt_runs() row */
function jd2_run_settled(array $run): bool
{
    $dealt = jd2_deal_decode($run['deal'] ?? null);
    $bySlot = [];
    foreach ($run['gens'] as $g) {
        if ($g['status'] === JD2_GEN_PENDING) {
            return false;
        }
        $bySlot[(string) $g['slot']] = true;
    }
    foreach (array_keys($dealt) as $slot) {
        if (!isset($bySlot[$slot])) {
            return false;
        }
    }
    return true;
}

// ---------------------------------------------------------------------------
// 13. The bench's view of a prompt. The run the owner rates is the one the
// drawer shows when the owner chose it (shown_run_id), else the NEWEST run —
// a rerun the owner asked for is the thing waiting to be rated. The prompt is
// DONE on the bench when the owner's current session on that run is complete
// (jd2_is_complete over the run's counting drawings); a visitor's sitting
// never closes the owner's backlog — the campaign is the owner re-rating
// everything under one instrument (PLAN-V2 §0).

/**
 * @param array $prompt  the jd2_prompts row (needs shown_run_id)
 * @param list<array> $runs  jd2_prompt_runs()
 * @return array{run:?array,settled:bool,owner:?array,standing:?array,complete:bool,needs:list<string>}
 */
function jd2_bench_view(PDO $db, array $prompt, array $runs, array $taxonomy): array
{
    $run = null;
    foreach ($runs as $r) {
        if ($prompt['shown_run_id'] !== null && $r['id'] === $prompt['shown_run_id']) {
            $run = $r;
            break;
        }
    }
    $run ??= $runs[0] ?? null;
    if ($run === null) {
        return ['run' => null, 'settled' => false, 'owner' => null, 'standing' => null,
                'complete' => false, 'needs' => ['no run on file']];
    }
    $settled = jd2_run_settled($run);
    $owner = jd2_current_session($db, (string) $run['id'], JD2_ROLE_OWNER);
    $standing = $owner === null ? null : jd2_session_standing($db, (string) $owner['id']);
    $complete = $standing !== null && jd2_is_complete($standing, $run['counting'], $taxonomy);
    $needs = [];
    if (!$settled) {
        $dealt = count(jd2_deal_decode($run['deal'] ?? null));
        $done = 0;
        foreach ($run['gens'] as $g) {
            $done += $g['status'] === JD2_GEN_PENDING ? 0 : 1;
        }
        $needs[] = "still drawing: $done of $dealt drawings back";
    }
    if ($run['counting'] === []) {
        $needs[] = 'no drawing survived — nothing to rate (rerun it)';
    } elseif (!$complete) {
        $needs = array_merge($needs, jd2_needs($standing, $run['gens'], $taxonomy));
    }
    return ['run' => $run, 'settled' => $settled, 'owner' => $owner, 'standing' => $standing,
            'complete' => $complete, 'needs' => $needs];
}

/**
 * What a sitting still lacks over a run's counting drawings, in plain words,
 * drawings named by SLOT (never by model: the bench is blind). The same three
 * tests as jd2_is_complete — every cell, a strict ranking, every pair — so an
 * empty list and a complete session go together.
 *
 * @param array|null $standing  jd2_session_standing(), or null for no sitting
 * @param list<array> $gens     the run's generation rows (id, slot, status, hidden)
 * @return list<string>
 */
function jd2_needs(?array $standing, array $gens, array $taxonomy): array
{
    $counting = [];
    foreach ($gens as $g) {
        if ($g['status'] === JD2_GEN_OK && (int) $g['hidden'] === 0) {
            $counting[(string) $g['id']] = (string) $g['slot'];
        }
    }
    if ($counting === []) {
        return [];
    }
    if ($standing === null) {
        return ['no owner sitting yet'];
    }
    $axes = jd_live_axes($taxonomy);
    $out = [];
    $noGrade = [];
    $axisGaps = [];
    foreach ($counting as $gid => $slot) {
        $j = $standing['judgments'][$gid] ?? null;
        if ($j === null || $j['grade'] === null) {
            $noGrade[] = $slot;
        }
        $missing = 0;
        foreach (array_keys($axes) as $axis) {
            if ($j === null || !array_key_exists((string) $axis, $j['axes'])) {
                $missing++;
            }
        }
        if ($missing > 0) {
            $axisGaps[] = $slot . ' (' . $missing . ' of ' . count($axes) . ')';
        }
    }
    if ($noGrade) {
        $out[] = 'no grade: ' . implode(', ', $noGrade);
    }
    if ($axisGaps) {
        $out[] = 'axes unanswered: ' . implode(', ', $axisGaps);
    }
    $n = count($counting);
    if ($n > 1) {
        $places = [];
        foreach (array_keys($counting) as $gid) {
            $pos = $standing['rankings'][$gid]['rank_pos'] ?? null;
            if ($pos !== null) {
                $places[$pos] = true;
            }
        }
        if (count($places) < $n) {
            $out[] = 'ranked: ' . count($places) . ' of ' . $n;
        }
        $scored = [];
        foreach ($standing['pairs'] as $p) {
            if (isset($counting[$p['gen_a']], $counting[$p['gen_b']])) {
                $scored[$p['gen_a'] < $p['gen_b'] ? $p['gen_a'] . '|' . $p['gen_b'] : $p['gen_b'] . '|' . $p['gen_a']] = true;
            }
        }
        $want = $n * ($n - 1) / 2;
        if (count($scored) < $want) {
            $out[] = 'pairs scored: ' . count($scored) . ' of ' . $want;
        }
    }
    return $out;
}

// ---------------------------------------------------------------------------
// 14. Which drawing the drawer shows on a run — data.php's rule, stated once
// for the readers that report it: the pinned drawing when it is one of the
// run's counting drawings, else 1st place in the standing, else (no ranking)
// the first counting drawing by slot.

/**
 * @param list<array> $gens  the run's generation rows
 * @return array{0:?string,1:?string}  [generation id, the rule in words]
 */
function jd2_shows(?string $pin, array $gens, ?array $standing): array
{
    $counting = [];
    foreach ($gens as $g) {
        if ($g['status'] === JD2_GEN_OK && (int) $g['hidden'] === 0) {
            $counting[(string) $g['id']] = (string) $g['slot'];
        }
    }
    if ($counting === []) {
        return [null, null];
    }
    if ($pin !== null && isset($counting[$pin])) {
        return [$pin, 'pinned by the owner'];
    }
    foreach ($standing['rankings'] ?? [] as $gid => $r) {
        if ((int) $r['rank_pos'] === 1 && isset($counting[$gid])) {
            return [(string) $gid, 'first place'];
        }
    }
    asort($counting);
    return [(string) array_key_first($counting), count($counting) === 1 ? 'the one drawing' : 'no ranking — first by slot'];
}

// ===========================================================================
// Intake (PLAN-INTAKE, 2026-10-02) — what the intake clerk and its readers share:
//
//  15. the facets of the classification, read from the taxonomy   (jd2_facets)
//  16. checking and reading a prompt's tags                       (jd2_facet_problem,
//                                                                   jd2_tags_check, jd2_tags_decode)
//  17. the intake fields every owner-side reader carries          (jd2_intake_fields)
//
// The prompt, the schema and the call are api/jd2-intake-prompt.php; the
// endpoint is api/jd2-intake.php.

/**
 * taxonomy.json `facets`, normalised: each {id, label, question, min, max,
 * headings: [{id, label, scope}]}, in file order; a heading marked
 * `defunct` is history and is left out (never offered, never accepted).
 *
 * @return list<array{id:string,label:string,question:string,min:int,max:int,headings:list<array{id:string,label:string,scope:string}>}>
 */
function jd2_facets(array $taxonomy): array
{
    $out = [];
    foreach ($taxonomy['facets'] ?? [] as $f) {
        if (!is_array($f) || !is_string($f['id'] ?? null) || $f['id'] === '') {
            continue;
        }
        $headings = [];
        foreach ($f['headings'] ?? [] as $h) {
            if (is_array($h) && is_string($h['id'] ?? null) && $h['id'] !== '' && empty($h['defunct'])) {
                $headings[] = ['id' => $h['id'], 'label' => (string) ($h['label'] ?? $h['id']),
                               'scope' => (string) ($h['scope'] ?? '')];
            }
        }
        $out[] = [
            'id' => $f['id'],
            'label' => (string) ($f['label'] ?? $f['id']),
            'question' => (string) ($f['question'] ?? ''),
            'min' => max(0, (int) ($f['min'] ?? 0)),
            'max' => max(1, (int) ($f['max'] ?? count($headings))),
            'headings' => $headings,
        ];
    }
    return $out;
}

/** The intake prompt's version (taxonomy.json `intakeVersion`); a 500 envelope when absent. */
function jd2_intake_version(array $taxonomy): string
{
    $v = $taxonomy['intakeVersion'] ?? null;
    if (!is_string($v) || $v === '' || strlen($v) > 32) {
        error_log('jd2_intake_version: taxonomy.json has no usable intakeVersion');
        jd_fail(500, 'server_error', 'The intake is not configured in the taxonomy (intakeVersion).');
    }
    return $v;
}

/** Why $v is not a valid answer for facet $f (a list of its heading ids, no repeats, within min..max), or null. */
function jd2_facet_problem(array $f, mixed $v): ?string
{
    if (!is_array($v) || !array_is_list($v)) {
        return $f['id'] . ' is not a list';
    }
    $ids = array_column($f['headings'], 'id');
    $seen = [];
    foreach ($v as $x) {
        if (!is_string($x) || !in_array($x, $ids, true)) {
            return $f['id'] . ' names ' . json_encode($x) . ', not one of its headings';
        }
        if (isset($seen[$x])) {
            return $f['id'] . ' names ' . $x . ' twice';
        }
        $seen[$x] = true;
    }
    if (count($v) < $f['min'] || count($v) > $f['max']) {
        return $f['id'] . ' has ' . count($v) . ' headings (' . $f['min'] . '–' . $f['max'] . ')';
    }
    return null;
}

/**
 * A tags object as filed (jd2_prompts.tags): every facet of the taxonomy
 * present, each valid (jd2_facet_problem); nothing else.
 *
 * @return array{0:?array<string,list<string>>,1:?string}  [the clean object in facet order, null] or [null, the problem]
 */
function jd2_tags_check(mixed $tags, array $taxonomy): array
{
    if (!is_array($tags) || ($tags !== [] && array_is_list($tags))) {
        return [null, 'tags must be an object keyed by facet'];
    }
    $facets = jd2_facets($taxonomy);
    $known = array_column($facets, 'id');
    foreach (array_keys($tags) as $k) {
        if (!in_array((string) $k, $known, true)) {
            return [null, 'tags names an unknown facet ' . json_encode($k)];
        }
    }
    $clean = [];
    foreach ($facets as $f) {
        if (!array_key_exists($f['id'], $tags)) {
            return [null, 'tags is missing the facet ' . $f['id']];
        }
        $problem = jd2_facet_problem($f, $tags[$f['id']]);
        if ($problem !== null) {
            return [null, $problem];
        }
        $clean[$f['id']] = array_values($tags[$f['id']]);
    }
    return [$clean, null];
}

/** jd2_prompts.tags as read: {facet: [ids]} or null (none, or unreadable). */
function jd2_tags_decode(mixed $json): ?array
{
    $t = is_string($json) && $json !== '' ? json_decode($json, true) : null;
    return is_array($t) && ($t === [] || !array_is_list($t)) ? $t : null;
}

/**
 * The intake facts every owner-side reader (jd2-queue, jd2-ledger) carries
 * for a prompt row that selected tags, size_by and the intake_* columns:
 * tags (decoded), size_by, intake_version, intake_model, intake_at, the
 * reasons from intake_json, and `intake_fallback` — true when intake was
 * tried and failed (intake_json holds an error and intake_at is NULL), so
 * the ledger can say so. intake_error carries that error's code.
 */
function jd2_intake_fields(array $p): array
{
    $rec = is_string($p['intake_json'] ?? null) ? json_decode((string) $p['intake_json'], true) : null;
    $reasons = is_array($rec['answer']['reasons'] ?? null) ? $rec['answer']['reasons'] : null;
    $failed = ($p['intake_at'] ?? null) === null && is_array($rec) && isset($rec['error']);
    return [
        'tags' => jd2_tags_decode($p['tags'] ?? null),
        'size_by' => $p['size_by'] ?? null,
        'intake_version' => $p['intake_version'] ?? null,
        'intake_model' => $p['intake_model'] ?? null,
        'intake_at' => $p['intake_at'] ?? null,
        'intake_reasons' => $reasons === null ? null : [
            'size' => (string) ($reasons['size'] ?? ''), 'classification' => (string) ($reasons['classification'] ?? '')],
        'intake_fallback' => $failed,
        'intake_error' => $failed ? (string) ($rec['error']['code'] ?? 'failed') : null,
    ];
}

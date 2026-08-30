<?php
// GET /api/jd-analytics.php — the numbers behind the drawer, in one payload.
// Contract: art/junk-drawer/PLAN-ANALYTICS.md §1 (2026-08-28). The top-level
// keys there are FROZEN: the folder module builds against them blind, so a
// field may be added but nothing may be renamed.
//
// Read-only and public, the same posture as data.php: an aggregate over five
// tables holds nothing a visitor could not be told. No writes, no new tables.
//
// WHY EVERYTHING IS AGGREGATED IN PHP: cost is the spine of half these charts
// and cost is only knowable through jd_generation_cost() — a rate table keyed
// by the provider's wire string, applied to a per-provider usage object. That
// cannot be expressed in SQL, and a second, SQL-shaped pricing path would be
// exactly the hand-rolled price lookup jd-usage.php exists to prevent. So the
// queries are plain column SELECTs (no NOW(), no vendor-only syntax, MySQL and
// the dev SQLite alike) and every sum is taken here. At the scale this serves
// — a few hundred generations, a few hundred ratings — that is cheaper than
// the round trips a GROUP BY per chart would cost.
//
// The three population rules this file exists to get right, all of them from
// setup-jd-tables.php's item_id block and PLAN-ANALYTICS §1:
//   1. Curated rows (jd_submissions.item_id IS NOT NULL) are NOT visitor
//      turns. They sit at status='generated' forever. Turn counts, the
//      first-place charts and — since 2026-08-30, owner call — the GRADE AND
//      AXIS charts all exclude them: the corpus was never a controlled
//      comparison, so it cannot answer "which model draws better." Cost
//      aggregates still include them (the spend was real), and so does
//      rated_responses (the owner's filing work, not a scoreboard).
//   2. Unpriced or usage-less generations are EXCLUDED from money, never
//      counted as $0 — the same discipline as jd-rate.php's reveal.
//   3. jd_comparisons is written alongside jd_ranks (the rank-1 winner), so a
//      comparison counts toward `firsts` ONLY on submissions with no ranks.
//      Counting both would double every ranked turn.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-usage.php';   // the ONLY way a generation is priced

jd_require_allowed_origin();

// GET only — the jd-bench-queue.php precedent.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    jd_fail(405, 'method_not_allowed', 'GET only.');
}

// no-cache, as data.php serves the drawer itself. A max-age here would be
// defensible (the aggregate is cheap and staleness harms nobody), but the
// owner opens this folder right after taking a turn, and numbers that had not
// moved yet would read as a broken dashboard rather than as a cache.
if (!headers_sent()) {
    header('Cache-Control: no-cache');
}

$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    error_log('jd-analytics: taxonomy.json could not be read at ' . JD_TAXONOMY_PATH);
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}

// --- the rubric, live only -------------------------------------------------
// Model identity resolves through taxonomy.json's registry; a model_id with no
// entry still appears, labelled with its raw id, because a chart that silently
// drops a model is worse than one that shows an ugly name.
$registry = [];
$registryOrder = [];
foreach ($taxonomy['models'] ?? [] as $model) {
    if (!isset($model['id'])) {
        continue;
    }
    $id = (string) $model['id'];
    $registry[$id] = [
        'label'  => (string) ($model['label'] ?? $id),
        'vendor' => (string) ($model['vendor'] ?? ''),
    ];
    $registryOrder[] = $id;
}

// Live axes in taxonomy order, each carrying its own scale length. The 3-point
// and 4-point axes are DIFFERENT RULERS and are never normalized together, so
// `points` travels with every panel and the frontend has no reason to guess.
// Defunct axes are dropped outright (jd-bench-queue.php's precedent): a rating
// filed under a retired axis stays in the table as history and must not
// reappear as a chart of a question nobody is asked any more.
$axisDefs = [];
foreach ($taxonomy['axes'] ?? [] as $axis) {
    if (!isset($axis['id']) || !empty($axis['defunct'])) {
        continue;
    }
    $axisDefs[(string) $axis['id']] = [
        'label'  => (string) ($axis['label'] ?? $axis['id']),
        'points' => count($axis['values'] ?? []),
    ];
}

// --- the reads -------------------------------------------------------------
// Column lists are explicit and deliberately narrow: jd_generations carries
// raw_response and svg as MEDIUMTEXT, and neither belongs in a report.
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $subs = $db->query(
        'SELECT id, item_id FROM jd_submissions'
    )->fetchAll(PDO::FETCH_ASSOC);

    $gens = $db->query(
        'SELECT id, submission_id, model_id, model_version, provider,
                status, usage_tokens, created
           FROM jd_generations'
    )->fetchAll(PDO::FETCH_ASSOC);

    $rates = $db->query(
        'SELECT generation_id, kind, axis_id, value, taxonomy_version
           FROM jd_ratings'
    )->fetchAll(PDO::FETCH_ASSOC);

    $comparisons = $db->query(
        'SELECT submission_id, winner_gen_id FROM jd_comparisons'
    )->fetchAll(PDO::FETCH_ASSOC);

    // jd_ranks landed 2026-08-22 through setup-jd-tables.php, which is a
    // manual run while a deploy is instant. jd-rate.php deliberately keeps
    // filing ratings when the table is absent, so this read must survive it
    // too — a dashboard that 500s on a lagging migration would be the only
    // thing in the feature that breaks. No ranks simply means the legacy
    // comparisons carry `firsts` on their own.
    try {
        $ranks = $db->query(
            'SELECT submission_id, generation_id, rank_pos FROM jd_ranks'
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (!jd_analytics_missing_table($e)) {
            throw $e;
        }
        error_log('jd-analytics: jd_ranks is missing — firsts come from '
            . 'jd_comparisons alone (run setup-jd-tables.php)');
        $ranks = [];
    }
} catch (PDOException $e) {
    error_log('jd-analytics: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The numbers could not be read.');
}

// --- population 1: which submissions are visitor turns ---------------------
// The predicate is `item_id IS NULL`, exactly as setup-jd-tables.php spells it.
$turnSubs = [];
foreach ($subs as $s) {
    if (($s['item_id'] ?? null) === null) {
        $turnSubs[(string) $s['id']] = true;
    }
}

// --- one pass over the generations: the funnel, the money, the calendar ----
$genById   = [];   // gen_id => [submission_id, model_id, status]
$gensBySub = [];   // turn submission_id => [[model_id, status], ...]

$turnDrawings = 0;
$turnSurvived = 0;

$costByModel = [];    // model_id => ['sum' => float, 'n' => int] — ok slots only
$spendByDate = [];    // 'YYYY-MM-DD' => ['usd' => float, 'by_model' => [...]]

foreach ($gens as $g) {
    $genId   = (string) $g['id'];
    $subId   = (string) $g['submission_id'];
    $modelId = (string) $g['model_id'];
    $status  = (string) $g['status'];
    $isOk    = ($status === 'ok');

    $genById[$genId] = ['submission_id' => $subId, 'model_id' => $modelId, 'status' => $status];

    if (isset($turnSubs[$subId])) {
        $turnDrawings++;
        if ($isOk) {
            $turnSurvived++;
        }
        $gensBySub[$subId][] = ['model_id' => $modelId, 'status' => $status];
    }

    // usage_tokens is the provider's own object, stored verbatim by
    // jd-generate.php. Null/empty means the slot never reached a provider (or
    // was a mock call) and jd_generation_cost answers null for both that and
    // an unpriced wire string — which is the whole point: neither is $0.
    $raw   = $g['usage_tokens'] ?? null;
    $usage = ($raw !== null && $raw !== '') ? json_decode((string) $raw, true) : null;
    $cost  = jd_generation_cost(
        (string) ($g['provider'] ?? ''),
        (string) ($g['model_version'] ?? ''),
        is_array($usage) ? $usage : null
    );
    if ($cost['cost_usd'] === null) {
        continue;
    }
    $usd = (float) $cost['cost_usd'];

    // Spend is spend: a failed or rejected generation that burned tokens still
    // cost money, so the daily ledger below counts every priced row, and the
    // ledger TOTAL is that same table summed once (see $running) rather than a
    // second accumulator — two float sums taken in different orders disagree
    // in the sixth decimal, and a dashboard whose header does not match the
    // end of its own line chart is a bug report waiting to happen. `cost` (the
    // per-drawing average) is the different question — what a SURVIVING
    // drawing costs — and takes only ok slots below.
    //
    // created is the UTC 'Y-m-d H:i:s' string every writer in this feature
    // stores, so the date is its first ten characters — no timezone maths, and
    // no dialect-specific date function.
    $date = substr((string) $g['created'], 0, 10);
    if (!isset($spendByDate[$date])) {
        $spendByDate[$date] = ['usd' => 0.0, 'by_model' => []];
    }
    $spendByDate[$date]['usd'] += $usd;
    $spendByDate[$date]['by_model'][$modelId] =
        ($spendByDate[$date]['by_model'][$modelId] ?? 0.0) + $usd;

    if ($isOk) {
        if (!isset($costByModel[$modelId])) {
            $costByModel[$modelId] = ['sum' => 0.0, 'n' => 0];
        }
        $costByModel[$modelId]['sum'] += $usd;
        $costByModel[$modelId]['n']++;
    }
}

// --- the ratings: grades and the live axes ---------------------------------
// All clients count — 'web' (a visitor's turn), 'bench' (the curator at the
// rating bench) and 'seed' (grades carried over from entry.json) are three
// raters of the same corpus, not three populations.
//
// CURRENT RUBRIC ONLY (owner call, 2026-08-28). The quality charts count
// ratings filed under the v17 rework onward — the era the whole current
// rubric belongs to (v18–20 are refinements of v17's reset, which retired
// every earlier axis at once). Everything stamped before v17 is the old
// Claude-only demo era and is excluded, grades included: the 1..5 rank scale
// is technically permanent, but the owner's call is that a judgment filed
// under a retired rubric is not the same judgment, and the pre-v17 material
// will re-enter these charts by being RE-RATED, not by being grandfathered.
// (Axis ratings additionally pass the live-axis filter below, which guards
// the scales that changed shape.)
const JD_ANALYTICS_RUBRIC_SINCE = 17;

$ratedGenIds = [];
$gradeByModel = [];   // model_id => ['sum', 'n']
$axisByModel  = [];   // axis_id => model_id => ['sum', 'n']

foreach ($rates as $r) {
    // The era gate, before anything is counted — the ledger's rated_responses
    // must agree with what the charts below actually draw from.
    if ((int) ($r['taxonomy_version'] ?? 0) < JD_ANALYTICS_RUBRIC_SINCE) {
        continue;
    }
    $genId = (string) $r['generation_id'];
    $ratedGenIds[$genId] = true;      // any current-rubric row — flags included

    $gen = $genById[$genId] ?? null;
    if ($gen === null || $r['value'] === null) {
        continue;                      // a flag carries no value; orphans cannot exist (FK)
    }
    // MODEL PERFORMANCE IS TURN-ONLY (owner call, 2026-08-30). The curated
    // corpus is not a controlled comparison and never was — generations made
    // over weeks, some refined over several prompts, under harnesses that
    // changed underneath them, and by a Claude-only cast; jd-bench-run.php's
    // own header says nothing about it supports "model A beats model B". The
    // legacy responses the owner PRESERVES in the drawer are exactly those
    // rows, so they would sit in the grade book as if they had run in the
    // four-model bracket. They do not: the grade and axis aggregates below
    // count only generations from real turns (the four models drawing the
    // same prompt at the same moment, item_id IS NULL). Spend still counts
    // the curated bench — that money was really spent (rule 1 above) — and
    // rated_responses still counts every current-rubric judgment on file,
    // because that figure is the owner's filing work, not a scoreboard.
    if (!isset($turnSubs[(string) $gen['submission_id']])) {
        continue;
    }
    $modelId = $gen['model_id'];
    $value   = (float) $r['value'];
    $kind    = (string) $r['kind'];

    if ($kind === 'grade') {
        if (!isset($gradeByModel[$modelId])) {
            $gradeByModel[$modelId] = ['sum' => 0.0, 'n' => 0];
        }
        $gradeByModel[$modelId]['sum'] += $value;
        $gradeByModel[$modelId]['n']++;
        continue;
    }

    if ($kind === 'axis') {
        $axisId = $r['axis_id'] === null ? '' : (string) $r['axis_id'];
        if (!isset($axisDefs[$axisId])) {
            continue;                  // defunct or unknown axis: history, not a chart
        }
        if (!isset($axisByModel[$axisId][$modelId])) {
            $axisByModel[$axisId][$modelId] = ['sum' => 0.0, 'n' => 0];
        }
        $axisByModel[$axisId][$modelId]['sum'] += $value;
        $axisByModel[$axisId][$modelId]['n']++;
    }
}

// --- the judgment: who takes first -----------------------------------------
// Visitor turns only. A judged submission is one a visitor actually ordered:
// jd_ranks rows, or — for the turns that predate ranking — a jd_comparisons
// row. Population rule 3 lives in the `isset($ranksBySub[...])` skip below:
// jd-rate.php writes a comparison ALONGSIDE every ranking (winner = the rank-1
// generation), so counting both would credit every ranked turn twice.
$ranksBySub = [];
foreach ($ranks as $r) {
    $ranksBySub[(string) $r['submission_id']][(string) $r['generation_id']] = (int) $r['rank_pos'];
}

$winnerBySub = [];   // judged turn submission_id => winning gen_id, or null on a tie
foreach ($ranksBySub as $subId => $byGen) {
    if (!isset($turnSubs[$subId])) {
        continue;
    }
    $winner = null;
    foreach ($byGen as $genId => $pos) {
        if ($pos === 1) {
            $winner = $genId;          // validation guarantees exactly one
            break;
        }
    }
    $winnerBySub[$subId] = $winner;
}
foreach ($comparisons as $c) {
    $subId = (string) $c['submission_id'];
    if (!isset($turnSubs[$subId]) || isset($ranksBySub[$subId])) {
        continue;
    }
    $winnerBySub[$subId] = $c['winner_gen_id'] === null ? null : (string) $c['winner_gen_id'];
}

// A model's denominator is the judged turns it SURVIVED in, not all judged
// turns: a model that failed the call was never in the running, and charging
// it a loss for a slot it never filled would be a lie about the drawings.
$firstsByModel = [];
$judgedByModel = [];
foreach ($winnerBySub as $subId => $winnerGenId) {
    $present = [];
    foreach ($gensBySub[$subId] ?? [] as $g) {
        if ($g['status'] === 'ok') {
            $present[$g['model_id']] = true;   // once per submission, never per slot
        }
    }
    foreach (array_keys($present) as $modelId) {
        $judgedByModel[$modelId] = ($judgedByModel[$modelId] ?? 0) + 1;
    }
    if ($winnerGenId !== null && isset($genById[$winnerGenId])) {
        $modelId = $genById[$winnerGenId]['model_id'];
        $firstsByModel[$modelId] = ($firstsByModel[$modelId] ?? 0) + 1;
    }
}

// --- the model list: everyone with data anywhere ---------------------------
// Registry order first (the taxonomy's own reading order, which groups by
// vendor), then anything the registry has never heard of, alphabetically. The
// frontend keys one colour per model off this list, so its ORDER is the one
// thing that must not wobble between requests.
$seenModels = [];
foreach (array_keys($costByModel) as $id)  { $seenModels[$id] = true; }
foreach (array_keys($judgedByModel) as $id) { $seenModels[$id] = true; }
foreach (array_keys($firstsByModel) as $id) { $seenModels[$id] = true; }
foreach (array_keys($gradeByModel) as $id)  { $seenModels[$id] = true; }
foreach ($axisByModel as $byModel) {
    foreach (array_keys($byModel) as $id) { $seenModels[$id] = true; }
}

$modelOrder = [];
foreach ($registryOrder as $id) {
    if (isset($seenModels[$id])) {
        $modelOrder[] = $id;
        unset($seenModels[$id]);
    }
}
$unregistered = array_keys($seenModels);
sort($unregistered);
$modelOrder = array_merge($modelOrder, $unregistered);

$models = [];
foreach ($modelOrder as $id) {
    $models[] = [
        'model_id' => $id,
        'label'    => $registry[$id]['label'] ?? $id,
        'vendor'   => $registry[$id]['vendor'] ?? '',
    ];
}

// --- shaping ---------------------------------------------------------------
// Bars sort by value (PLAN-ANALYTICS §1: "sort bars by value"), so the chart
// reads as a ranking without a legend. The AXES panels deliberately do not:
// small multiples are read across, and a model that moved rows between panels
// would destroy the comparison the panels exist to make — so those keep the
// $modelOrder above, the same order the colour key is built from.
$cost = [];
foreach ($costByModel as $id => $c) {
    $cost[] = [
        'model_id' => $id,
        'avg_usd'  => round($c['sum'] / $c['n'], 6),
        'n'        => $c['n'],
    ];
}
usort($cost, static fn($a, $b) => $b['avg_usd'] <=> $a['avg_usd']);

$firsts = [];
foreach ($judgedByModel as $id => $judged) {
    $won = $firstsByModel[$id] ?? 0;
    $firsts[] = [
        'model_id' => $id,
        'firsts'   => $won,
        'judged'   => $judged,
        'rate'     => $judged > 0 ? round($won / $judged, 4) : 0.0,
    ];
}
usort($firsts, static fn($a, $b) => [$b['rate'], $b['firsts']] <=> [$a['rate'], $a['firsts']]);

$grades = [];
foreach ($gradeByModel as $id => $g) {
    $grades[] = [
        'model_id' => $id,
        'avg'      => round($g['sum'] / $g['n'], 3),
        'n'        => $g['n'],
    ];
}
usort($grades, static fn($a, $b) => $b['avg'] <=> $a['avg']);

$axes = [];
foreach ($axisDefs as $axisId => $def) {
    $rows = [];
    foreach ($modelOrder as $id) {
        $cell = $axisByModel[$axisId][$id] ?? null;
        if ($cell === null) {
            continue;                  // no rating on this axis: no dot, not a zero
        }
        $rows[] = [
            'model_id' => $id,
            'avg'      => round($cell['sum'] / $cell['n'], 3),
            'n'        => $cell['n'],
        ];
    }
    $axes[] = [
        'axis_id' => $axisId,
        'label'   => $def['label'],
        'points'  => $def['points'],
        'models'  => $rows,
    ];
}

// The meter line. Dates sort as strings because they are UTC 'YYYY-MM-DD' —
// the same property that lets every cutoff in this feature be a bound
// parameter instead of a date function. Only days with priced spend appear;
// the gaps are the drawer's real quiet days, and the cumulative line carries
// them across on its own.
ksort($spendByDate);
$spend = [];
$running = 0.0;
foreach ($spendByDate as $date => $day) {
    $running += $day['usd'];
    $byModel = [];
    foreach ($day['by_model'] as $id => $usd) {
        $byModel[$id] = round($usd, 6);
    }
    $spend[] = [
        'date'     => $date,
        'usd'      => round($day['usd'], 6),
        'cum_usd'  => round($running, 6),
        'by_model' => $byModel,
    ];
}
// $running is now the whole priced spend, and totals.cost_usd below is that
// same value — so the last cum_usd and the ledger figure agree to the byte.

jd_json_out(200, [
    'ok'        => true,
    'generated' => gmdate('c'),
    'totals'    => [
        'turns'           => count($turnSubs),
        'drawings'        => $turnDrawings,
        'survived'        => $turnSurvived,
        // Corpus-wide on purpose, unlike the three above: a rated response is
        // a judgment on file, and the curated backfill exists precisely so the
        // owner's 77 responses could be rated through the same table. Counted
        // under the same current-rubric gate as the charts (v17+), so this
        // figure and the grade book can never disagree about what "rated"
        // means.
        'rated_responses' => count($ratedGenIds),
        'cost_usd'        => round($running, 6),
    ],
    'models' => $models,
    'cost'   => $cost,
    'firsts' => $firsts,
    'grades' => $grades,
    'axes'   => $axes,
    'spend'  => $spend,
]);

// ---------------------------------------------------------------------------

// jd-rate.php's jd_missing_table(), under its own name so the two endpoints
// stay independently includable. MySQL says SQLSTATE 42S02 / "Table ...
// doesn't exist" (8.0: "Base table or view not found"); SQLite says "no such
// table". Anything else re-throws — this recovers a migration that has not
// been run yet, not a bad statement.
function jd_analytics_missing_table(PDOException $e): bool
{
    if (($e->getCode() ?: '') === '42S02') {
        return true;
    }
    $msg = $e->getMessage();
    return str_contains($msg, 'no such table')
        || str_contains($msg, "doesn't exist")
        || str_contains($msg, 'Base table or view not found');
}

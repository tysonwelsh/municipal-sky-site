<?php
// GET /api/jd-bench-queue.php — the curator's work queue for the rating bench.
//
// Joins the two halves the bench needs and neither store holds alone:
//   DB   — generation ids (what a rating hangs off), ratings already filed
//   disk — the .svg filename, the prompt, the rid, retired state (entry.json)
//
// Read-only. Returns the WHOLE curated corpus in one response (30 items / 77
// responses is ~40KB of JSON) so the bench can resume, jump, and show progress
// without a request per response.
//
// AUTH: same gate as jd-item-rate.php. This exposes nothing secret, but it is
// the curator's instrument and there is no reason to serve it to the public.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    jd_fail(405, 'method_not_allowed', 'GET only.');
}

if (JD_IS_PRODUCTION && JD_BENCH_REQUIRE_KEY) {
    // See jd-item-rate.php: falls back to the jd_setup_key already on file, so
    // the bench needs nothing added to production to work.
    $secrets  = jd_secrets();
    $expected = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    $supplied = $_SERVER['HTTP_X_BENCH_KEY'] ?? ($_GET['key'] ?? '');
    if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
        jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
    }
}

$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    jd_fail(500, 'server_error', 'The rubric could not be read.');
}

// Live axes, in taxonomy order, each with its values BEST FIRST. The bench
// binds number keys to position in this list, never to the rank value: ranks
// run 4..1 on two axes and 3..1 on three, so binding to the literal rank would
// make "1" mean best on one row and worst on the next.
$axes = [];
foreach ($taxonomy['axes'] ?? [] as $axis) {
    if (!empty($axis['defunct'])) {
        continue;
    }
    $values = [];
    foreach ($axis['values'] ?? [] as $v) {
        $values[] = [
            'rank'        => (int) ($v['rank'] ?? 0),
            'label'       => (string) ($v['label'] ?? ''),
            'description' => (string) ($v['description'] ?? ''),
        ];
    }
    usort($values, fn($a, $b) => $b['rank'] <=> $a['rank']);   // best first
    $axes[] = [
        'id'          => (string) $axis['id'],
        'label'       => (string) ($axis['label'] ?? $axis['id']),
        'description' => (string) ($axis['description'] ?? ''),
        'values'      => $values,
    ];
}

$liveAxisIds = [];
foreach ($axes as $a) {
    $liveAxisIds[$a['id']] = true;
}

$grades = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    $grades[] = ['rank' => (int) ($g['rank'] ?? 0), 'label' => (string) ($g['label'] ?? '')];
}
usort($grades, fn($a, $b) => $b['rank'] <=> $a['rank']);

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $subs = $db->query(
        "SELECT id, item_id, prompt, created
           FROM jd_submissions
          WHERE item_id IS NOT NULL
          ORDER BY created, item_id"
    )->fetchAll(PDO::FETCH_ASSOC);

    $gens = $db->query(
        "SELECT g.id, g.submission_id, g.slot, g.model_id, g.model_version, g.provider
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL
          ORDER BY g.submission_id, g.slot"
    )->fetchAll(PDO::FETCH_ASSOC);

    // Every rating on curated rows, split by who filed it. 'bench' is the
    // curator's live answer; 'seed' is the grade carried over from entry.json.
    $rates = $db->query(
        "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.note, r.client,
                r.taxonomy_version
           FROM jd_ratings r
           JOIN jd_generations g  ON g.id = r.generation_id
           JOIN jd_submissions s  ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL"
    )->fetchAll(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('jd-bench-queue: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The queue could not be read.');
}

$byGen = [];
foreach ($rates as $r) {
    $byGen[$r['generation_id']][] = $r;
}

$gensBySub = [];
foreach ($gens as $g) {
    $gensBySub[$g['submission_id']][] = $g;
}

// entry.json carries what the DB deliberately does not: the .svg filename
// (svg is NULL on curated rows because the file on disk is canonical) and the
// rid the drawer uses as its stable response id.
$ITEMS = __DIR__ . '/../art/junk-drawer/items';
$items = [];
$totalResponses = 0;
$totalRated     = 0;

foreach ($subs as $sub) {
    $itemId = (string) $sub['item_id'];
    $entryPath = $ITEMS . '/' . $itemId . '/entry.json';
    $entry = is_readable($entryPath)
        ? json_decode((string) file_get_contents($entryPath), true)
        : null;

    // rid/file, keyed by position — the backfill filed slot a,b,c,d in the
    // order responses appear in entry.json, so position is the join.
    $byIndex = [];
    foreach (($entry['responses'] ?? []) as $i => $r) {
        $byIndex[$i] = $r;
    }

    $responses = [];
    foreach ($gensBySub[$sub['id']] ?? [] as $i => $g) {
        $src  = $byIndex[$i] ?? null;
        $file = $src['file'] ?? null;

        $axisValues = [];
        $note = null; $gradeBench = null; $gradeSeed = null; $flags = [];
        foreach ($byGen[$g['id']] ?? [] as $r) {
            if ($r['client'] === 'bench') {
                // LIVE axes only. A rating filed under an axis that has since
                // been retired stays in the table as history, but must not
                // count toward "complete" or reappear in the survey — that
                // would mark a response done on a question no longer asked.
                if ($r['kind'] === 'axis' && $r['axis_id'] !== null
                    && isset($liveAxisIds[$r['axis_id']])) {
                    $axisValues[$r['axis_id']] = (float) $r['value'];
                } elseif ($r['kind'] === 'grade') {
                    $gradeBench = (float) $r['value'];
                } elseif ($r['kind'] === 'flag') {
                    $flags[] = ['axis_id' => $r['axis_id'], 'note' => $r['note']];
                }
                if ($r['note'] !== null && $note === null) {
                    $note = $r['note'];
                }
            } elseif ($r['client'] === 'seed' && $r['kind'] === 'grade') {
                $gradeSeed = (float) $r['value'];
            }
        }

        $totalResponses++;
        if (count($axisValues) === count($axes)) {
            $totalRated++;
        }

        $responses[] = [
            'generation_id' => $g['id'],
            'rid'           => $src['rid'] ?? ('r' . ($i + 1)),
            'slot'          => $g['slot'],
            'model_id'      => $g['model_id'],
            'model_version' => $g['model_version'],
            'provider'      => $g['provider'],
            // relative to /art/junk-drawer/ — the drawer builds the same URL
            'svg'           => $file ? ('items/' . $itemId . '/' . $file) : null,
            'axes'          => $axisValues,
            'note'          => $note,
            'grade'         => $gradeBench,
            'grade_seed'    => $gradeSeed,
            'flags'         => $flags,
            'complete'      => count($axisValues) === count($axes),
        ];
    }

    $items[] = [
        'item_id'   => $itemId,
        'title'     => $entry['title'] ?? $itemId,
        'prompt'    => (string) $sub['prompt'],
        'created'   => (string) $sub['created'],
        'retired'   => !empty($entry['retired']),
        'responses' => $responses,
    ];
}

jd_json_out(200, [
    'ok'               => true,
    'taxonomy_version' => (int) ($taxonomy['version'] ?? 0),
    'axes'             => $axes,
    'grades'           => $grades,
    'items'            => $items,
    'progress'         => [
        'responses' => $totalResponses,
        'complete'  => $totalRated,
        'cells'     => $totalResponses * count($axes),
    ],
]);

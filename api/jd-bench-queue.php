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
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();

// The host fronts the site with an edge cache (Newfold/nginx) that will
// happily cache a header-less GET — observed serving a previous deploy's
// queue to a fresh session (2026-08-28). A stale queue silently breaks the
// bench's whole cross-device story: the phone files an item, the desktop
// refetches, and the cache hands back the world from before. This response
// must never be stored anywhere.
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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

// THE SIZE SCALE (2026-08-30): the five tiers the bench's closing card asks
// for — how big the item reads in the drawer, the owner's call per item and
// the one curatorial field the rubric never covered. Served straight from
// the taxonomy so the card renders from data like every other scale.
$sizeTiers = [];
foreach ($taxonomy['sizeTiers'] ?? [] as $s) {
    if (isset($s['id'])) {
        $sizeTiers[] = [
            'id'          => (string) $s['id'],
            'label'       => (string) ($s['label'] ?? $s['id']),
            'description' => (string) ($s['description'] ?? ''),
            'box'         => $s['box'] ?? null,
        ];
    }
}

// id -> label, for the bench's unveil: model names print only after an item's
// grades are filed, and the queue is the one payload the bench is guaranteed
// to hold (data.php may not have answered on a broken page).
$models = [];
foreach ($taxonomy['models'] ?? [] as $m) {
    if (isset($m['id'])) {
        $models[(string) $m['id']] = (string) ($m['label'] ?? $m['id']);
    }
}

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

    // The curator's filed rank order (the podium's answer), one row per
    // response. jd_ranks lands via the manual setup script, so its absence
    // reads as "no ranks yet", never as a broken queue.
    $rankRows = [];
    try {
        $rankRows = $db->query(
            "SELECT r.generation_id, r.rank_pos
               FROM jd_ranks r
               JOIN jd_submissions s ON s.id = r.submission_id
              WHERE s.item_id IS NOT NULL AND r.client = 'bench'"
        )->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log('jd-bench-queue: jd_ranks unavailable (' . $e->getMessage() . ') — serving without ranks');
    }
} catch (PDOException $e) {
    error_log('jd-bench-queue: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The queue could not be read.');
}

$rankByGen = [];
foreach ($rankRows as $r) {
    $rankByGen[$r['generation_id']] = (int) $r['rank_pos'];
}

// The prompts of every RATED visitor turn — the set a curated item's prompt is
// looked up in to answer "did this item's rerun land?" (see rerun_landed).
$ratedRerunPrompts = [];
try {
    $stmt = $db->query(
        "SELECT DISTINCT prompt FROM jd_submissions
          WHERE item_id IS NULL AND status = 'rated'"
    );
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $p) {
        $ratedRerunPrompts[(string) $p] = true;
    }
} catch (PDOException $e) {
    error_log('jd-bench-queue: rated-rerun prompts unavailable (' . $e->getMessage() . ')');
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
    $sizeFiled = null;          // the tier the bench last filed for this item
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
                    // the size card files its answer as a flag wearing the
                    // tier in its note ("SIZE m") — the item's, not the
                    // response's, so the first one seen is the item's
                    if ($r['axis_id'] === 'size' && $sizeFiled === null
                        && preg_match('/^SIZE ([a-z]{1,2})$/', (string) $r['note'], $m2)) {
                        $sizeFiled = $m2[1];
                    }
                }
                if ($r['note'] !== null && $note === null) {
                    $note = $r['note'];
                }
            } elseif ($r['client'] === 'seed' && $r['kind'] === 'grade') {
                $gradeSeed = (float) $r['value'];
            }
        }

        // A response is complete when every live axis is answered AND it
        // carries a grade — the curator's own, or the seed carried over from
        // entry.json (a deliberate, recent judgment on a scale the taxonomy
        // reworks did not touch). The turn card's own gate requires a grade,
        // so completeness has to as well or a "done" response would reopen
        // the moment it was put back on the bench. (Tightened 2026-08-28,
        // when the bench moved into the real turn card; before that,
        // complete meant axes alone.)
        $isComplete = count($axisValues) === count($axes)
            && ($gradeBench !== null || $gradeSeed !== null);

        $totalResponses++;
        if ($isComplete) {
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
            'rank'          => $rankByGen[$g['id']] ?? null,
            'flags'         => $flags,
            'complete'      => $isComplete,
        ];
    }

    $items[] = [
        'item_id'   => $itemId,
        'title'     => $entry['title'] ?? $itemId,
        'prompt'    => (string) $sub['prompt'],
        'created'   => (string) $sub['created'],
        'retired'   => !empty($entry['retired']),
        // DID THE RERUN ACTUALLY LAND? (2026-08-30) A rerun-request flag used
        // to retire an item from the backlog the instant the button was
        // pressed — so an abandoned rerun (a closed window, a turn left
        // unrated, a slot that timed out) put the item in limbo: marked sent,
        // never returned, never decided. The flag is the owner's INTENT; this
        // is whether it was carried out — a rated visitor turn on the same
        // prompt, byte for byte, which is the same join jd-harvest.php makes.
        // The bench skips a flagged item only when this is true.
        'rerun_landed' => isset($ratedRerunPrompts[(string) $sub['prompt']]),
        // the size already on file, if any: the tier the entry carries today
        // (the drawer's truth) and the tier the bench last filed (the owner's
        // newer word, waiting to be applied). The card prefills from either.
        'size_class'   => $entry['sizeClass'] ?? null,
        'size_filed'   => $sizeFiled,
        'responses' => $responses,
    ];
}

// ===========================================================================
// THE SECOND POPULATION — turns that never became items (owner, 2026-08-30)
//
// The queue above is the curated corpus. This is everything else the drawer
// has ever drawn: the blue-button turns whose prompts never became items —
// 84 of them at the time of writing, 314 surviving drawings, none of which
// has ever appeared in the drawer. They are the reassessment backlog.
//
// One row per DISTINCT PROMPT (a prompt re-sent is one subject, not two):
// the run with the most survivors wins, newest breaking the tie. A turn's
// artwork lives in the database rather than in a file, so each response
// carries `svg_url` — jd-gen-svg.php, fetched per item — instead of `svg`.
//
// PREFILL: a turn may already carry the visitor-path judgment the owner made
// when they took it (client='web'). Only CURRENT-RUBRIC rows may prefill —
// v17 was the rewrite that set today's four axes, and a v16 value answered a
// question that is no longer asked — so those arrive as `axes_seed` /
// `grade_seed` / `rank_seed`, the same shape the curated grade seed uses.
// The bench's own answers (client='bench') outrank them.
// ===========================================================================
$RUBRIC_SINCE = 17;
try {
    $curatedPrompts = [];
    foreach ($subs as $s) {
        $curatedPrompts[(string) $s['prompt']] = true;
    }

    $tSubs = $db->query(
        "SELECT id, prompt, created, status
           FROM jd_submissions
          WHERE item_id IS NULL
          ORDER BY created"
    )->fetchAll(PDO::FETCH_ASSOC);

    // one submission per prompt: most surviving drawings, then newest
    $tGenRows = $db->query(
        "SELECT g.id, g.submission_id, g.slot, g.model_id, g.model_version,
                g.provider, g.status
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NULL AND g.status = 'ok' AND g.svg IS NOT NULL
          ORDER BY g.submission_id, g.slot"
    )->fetchAll(PDO::FETCH_ASSOC);
    $tGensBySub = [];
    foreach ($tGenRows as $g) {
        $tGensBySub[(string) $g['submission_id']][] = $g;
    }

    $bestBySubject = [];
    foreach ($tSubs as $s) {
        $p = (string) $s['prompt'];
        if (isset($curatedPrompts[$p])) {
            continue;                       // a rerun of a drawer item
        }
        $n = count($tGensBySub[(string) $s['id']] ?? []);
        if ($n === 0) {
            continue;                       // nothing survived; nothing to rate
        }
        $prev = $bestBySubject[$p] ?? null;
        if ($prev === null || $n > $prev['n']
            || ($n === $prev['n'] && $s['created'] > $prev['sub']['created'])) {
            $bestBySubject[$p] = ['sub' => $s, 'n' => $n];
        }
    }

    // ratings and ranks on exactly those generations
    $tRates = $db->query(
        "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.note, r.client,
                r.taxonomy_version
           FROM jd_ratings r
           JOIN jd_generations g  ON g.id = r.generation_id
           JOIN jd_submissions s  ON s.id = g.submission_id
          WHERE s.item_id IS NULL"
    )->fetchAll(PDO::FETCH_ASSOC);
    $tRatesByGen = [];
    foreach ($tRates as $r) {
        $tRatesByGen[(string) $r['generation_id']][] = $r;
    }
    $tRankByGen = [];
    try {
        foreach ($db->query(
            "SELECT r.generation_id, r.rank_pos, r.client
               FROM jd_ranks r
               JOIN jd_submissions s ON s.id = r.submission_id
              WHERE s.item_id IS NULL"
        )->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $g = (string) $r['generation_id'];
            // the bench's own order wins; the turn's is the seed
            if ($r['client'] === 'bench' || !isset($tRankByGen[$g])) {
                $tRankByGen[$g] = ['pos' => (int) $r['rank_pos'], 'client' => $r['client']];
            }
        }
    } catch (PDOException $e) {
        error_log('jd-bench-queue: jd_ranks unavailable for turns');
    }

    foreach ($bestBySubject as $prompt => $best) {
        $sub = $best['sub'];
        $sid = (string) $sub['id'];
        $responses = [];
        $sizeFiledT = null;
        foreach ($tGensBySub[$sid] as $i => $g) {
            $axisValues = [];  $axisSeed = [];
            $gradeBench = null; $gradeSeed = null; $flags = []; $note = null;
            foreach ($tRatesByGen[(string) $g['id']] ?? [] as $r) {
                $isCurrent = (int) $r['taxonomy_version'] >= $RUBRIC_SINCE;
                if ($r['client'] === 'bench') {
                    if ($r['kind'] === 'axis' && isset($liveAxisIds[$r['axis_id']])) {
                        $axisValues[$r['axis_id']] = (float) $r['value'];
                    } elseif ($r['kind'] === 'grade') {
                        $gradeBench = (float) $r['value'];
                    } elseif ($r['kind'] === 'flag') {
                        $flags[] = ['axis_id' => $r['axis_id'], 'note' => $r['note']];
                        if ($r['axis_id'] === 'size' && $sizeFiledT === null
                            && preg_match('/^SIZE ([a-z]{1,2})$/', (string) $r['note'], $m3)) {
                            $sizeFiledT = $m3[1];
                        }
                    }
                    if ($r['note'] !== null && $note === null) {
                        $note = $r['note'];
                    }
                } elseif ($isCurrent) {
                    // the visitor-path judgment, current rubric only
                    if ($r['kind'] === 'axis' && isset($liveAxisIds[$r['axis_id']])) {
                        $axisSeed[$r['axis_id']] = (float) $r['value'];
                    } elseif ($r['kind'] === 'grade') {
                        $gradeSeed = (float) $r['value'];
                    }
                }
            }
            $rk = $tRankByGen[(string) $g['id']] ?? null;
            $isComplete = count($axisValues) === count($axes)
                && ($gradeBench !== null || $gradeSeed !== null);
            $totalResponses++;
            if ($isComplete) {
                $totalRated++;
            }
            $responses[] = [
                'generation_id' => $g['id'],
                'rid'           => 'g' . ($i + 1),
                'slot'          => $g['slot'],
                'model_id'      => $g['model_id'],
                'model_version' => $g['model_version'],
                'provider'      => $g['provider'],
                'svg'           => null,
                'svg_url'       => '/api/jd-gen-svg.php?gen=' . rawurlencode((string) $g['id']),
                'axes'          => $axisValues,
                'axes_seed'     => $axisSeed,
                'note'          => $note,
                'grade'         => $gradeBench,
                'grade_seed'    => $gradeSeed,
                'rank'          => ($rk && $rk['client'] === 'bench') ? $rk['pos'] : null,
                'rank_seed'     => $rk ? $rk['pos'] : null,
                'flags'         => $flags,
                'complete'      => $isComplete,
            ];
        }
        $items[] = [
            // a turn has no item id; this is its handle everywhere the bench
            // keys on one, and it is stable (the submission is)
            'item_id'      => 'turn:' . $sid,
            'source'       => 'turn',
            'title'        => mb_substr(trim(preg_replace('/\s+/u', ' ', $prompt)), 0, 42),
            'prompt'       => $prompt,
            'created'      => (string) $sub['created'],
            'retired'      => false,
            'rerun_landed' => null,
            'size_class'   => null,
            'size_filed'   => $sizeFiledT,
            'responses'    => $responses,
        ];
    }
} catch (PDOException $e) {
    error_log('jd-bench-queue: turn population unavailable (' . $e->getMessage() . ')');
}

jd_json_out(200, [
    'ok'               => true,
    'build'            => jd_build_stamp(),
    'taxonomy_version' => (int) ($taxonomy['version'] ?? 0),
    'axes'             => $axes,
    'grades'           => $grades,
    'size_tiers'       => $sizeTiers,
    'models'           => $models,
    'items'            => $items,
    'progress'         => [
        'responses' => $totalResponses,
        'complete'  => $totalRated,
        'cells'     => $totalResponses * count($axes),
    ],
]);

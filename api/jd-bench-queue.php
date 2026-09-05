<?php
// GET /api/jd-bench-queue.php — the curator's work queue for the rating bench.
//
// Joins the two halves the bench needs and neither store holds alone:
//   DB   — generation ids (what a rating hangs off), ratings already filed,
//          the item's own facts (size, scrap / rerun intents)
//   disk — the .svg filename, the prompt, the rid, retired state (entry.json)
//
// Two populations, one shape:
//   1. THE CURATED CORPUS — every submission carrying an item_id (the
//      backfill of art/junk-drawer/items/), joined to its entry.json by
//      position: the backfill filed slot a,b,c,d in the order responses
//      appear in the entry, so index i is generation i.
//   2. THE TURNS — every blue-button turn whose prompt never became an item
//      (owner, 2026-08-30): one row per DISTINCT PROMPT, the run with the
//      most survivors, newest breaking the tie. Their artwork lives in the
//      database, so each response carries `svg_url` (jd-gen-svg.php) instead
//      of `svg`. A turn may already carry the visitor's own judgment under
//      the current rubric; that arrives as axes_seed / grade_seed / rank_seed,
//      the same shape the curated grade seed uses, and the bench's own
//      answers (client='bench') outrank it.
//
// Read-only. Returns the whole queue in one response so the bench can resume,
// jump and show progress without a request per response. Never cached (the
// host's edge cache was caught serving a stale queue, 2026-08-28).

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_no_store();
jd_require_get();
jd_require_bench_key();

$taxonomy = jd_taxonomy_required('jd-bench-queue');
$liveAxes = jd_live_axes($taxonomy);
$axisCount = count($liveAxes);

// Only rows filed under the current rubric may PREFILL a turn: v17 was the
// rewrite that set today's axes, and a v16 value answered a question that is
// no longer asked.
const JD_QUEUE_RUBRIC_SINCE = 17;

// Live axes, in taxonomy order, each with its values BEST FIRST. The bench
// binds number keys to position in this list, never to the rank value.
$axes = [];
foreach ($liveAxes as $id => $axis) {
    $values = [];
    foreach ($axis['values'] ?? [] as $v) {
        $values[] = [
            'rank'        => (int) ($v['rank'] ?? 0),
            'label'       => (string) ($v['label'] ?? ''),
            'description' => (string) ($v['description'] ?? ''),
        ];
    }
    usort($values, fn($a, $b) => $b['rank'] <=> $a['rank']);
    $axes[] = [
        'id'          => $id,
        'label'       => (string) ($axis['label'] ?? $id),
        'description' => (string) ($axis['description'] ?? ''),
        'values'      => $values,
    ];
}

$grades = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    $grades[] = ['rank' => (int) ($g['rank'] ?? 0), 'label' => (string) ($g['label'] ?? '')];
}
usort($grades, fn($a, $b) => $b['rank'] <=> $a['rank']);

$sizeTiers = [];
foreach (jd_size_tiers($taxonomy) as $id => $s) {
    $sizeTiers[] = [
        'id'          => $id,
        'label'       => (string) ($s['label'] ?? $id),
        'description' => (string) ($s['description'] ?? ''),
        'box'         => $s['box'] ?? null,
    ];
}

// id -> label, for the bench's unveil (the queue is the one payload the
// bench is guaranteed to hold)
$models = [];
foreach (jd_model_registry($taxonomy) as $id => $m) {
    $models[$id] = (string) ($m['label'] ?? $id);
}

// --- the reads, both populations at once ----------------------------------
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $subs = $db->query(
        'SELECT id, item_id, prompt, created, status, size_class, suppressed,
                retire_requested_at, rerun_requested_at
           FROM jd_submissions
          ORDER BY created, item_id'
    )->fetchAll(PDO::FETCH_ASSOC);

    $gens = $db->query(
        "SELECT id, submission_id, slot, model_id, model_version, provider, status,
                CASE WHEN svg IS NULL THEN 0 ELSE 1 END AS has_svg
           FROM jd_generations
          ORDER BY submission_id, slot"
    )->fetchAll(PDO::FETCH_ASSOC);

    $rates = $db->query(
        'SELECT generation_id, kind, axis_id, value, note, client, taxonomy_version
           FROM jd_ratings
          ORDER BY rated_at, id'
    )->fetchAll(PDO::FETCH_ASSOC);

    // The filed rank order, one row per drawing: the bench's own outranks a
    // turn's. jd_ranks lands via the manual setup script, so its absence
    // reads as "no ranks yet", never as a broken queue.
    $rankRows = [];
    try {
        $rankRows = $db->query('SELECT generation_id, rank_pos, client FROM jd_ranks')
            ->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (!jd_missing_table($e)) {
            throw $e;
        }
        error_log('jd-bench-queue: jd_ranks unavailable — serving without ranks');
    }
} catch (PDOException $e) {
    error_log('jd-bench-queue: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The queue could not be read.');
}

$fold = jd_fold_ratings($rates, $liveAxes);

$rankByGen = [];   // gen => ['pos' => int, 'client' => string]
foreach ($rankRows as $r) {
    $g = (string) $r['generation_id'];
    if ($r['client'] === 'bench' || !isset($rankByGen[$g])) {
        $rankByGen[$g] = ['pos' => (int) $r['rank_pos'], 'client' => (string) $r['client']];
    }
}

$gensBySub = [];
foreach ($gens as $g) {
    $gensBySub[(string) $g['submission_id']][] = $g;
}

$curated = [];   // submissions backing an item
$turns = [];     // visitor turns
foreach ($subs as $s) {
    if ($s['item_id'] === null) {
        $turns[] = $s;
    } else {
        $curated[] = $s;
    }
}

// The prompts of every RATED visitor turn — the set a curated item's prompt
// is looked up in to answer "did this item's rerun land?" (rerun_landed), and
// the set of curated prompts a turn is checked against (a turn on a curated
// prompt is a rerun and belongs to its item, not to the second population).
$ratedTurnPrompts = [];
foreach ($turns as $s) {
    if ($s['status'] === 'rated') {
        $ratedTurnPrompts[(string) $s['prompt']] = true;
    }
}
$curatedPrompts = [];
foreach ($curated as $s) {
    $curatedPrompts[(string) $s['prompt']] = true;
}

$ITEMS = __DIR__ . '/../art/junk-drawer/items';
$items = [];
$totalResponses = 0;
$totalRated = 0;

/**
 * One response as the bench seats it. $seedFrom names the clients whose
 * filed answers may PREFILL the card as seeds: 'seed' (the entry.json grade
 * the backfill carried over) for a curated response, or any non-bench client
 * under the current rubric for a turn.
 */
function jdq_response(array $g, array $byClient, array $rank, int $axisCount, bool $isTurn): array
{
    global $totalResponses, $totalRated;
    $bench = $byClient['bench'] ?? null;
    $axisValues = $bench ? $bench['axes'] : [];
    $gradeBench = $bench ? $bench['grade'] : null;
    $note = $bench ? $bench['note'] : null;

    $axesSeed = [];
    $gradeSeed = null;
    foreach ($byClient as $client => $s) {
        if ($client === 'bench') {
            continue;
        }
        if ($isTurn) {
            // the visitor-path judgment, current rubric only
            foreach ($s['axes'] as $axis => $v) {
                if (($s['axes_version'][$axis] ?? 0) >= JD_QUEUE_RUBRIC_SINCE) {
                    $axesSeed[$axis] = $v;
                }
            }
            if ($s['grade'] !== null && ($s['grade_version'] ?? 0) >= JD_QUEUE_RUBRIC_SINCE) {
                $gradeSeed = $s['grade'];
            }
        } elseif ($client === 'seed' && $s['grade'] !== null) {
            $gradeSeed = $s['grade'];
        }
    }

    // A response is complete when every live axis is answered AND it carries
    // a grade — the curator's own, or a seed. The turn card's own gate
    // requires a grade, so completeness has to as well.
    $isComplete = count($axisValues) === $axisCount
        && ($gradeBench !== null || $gradeSeed !== null);
    $totalResponses++;
    if ($isComplete) {
        $totalRated++;
    }

    $out = [
        'generation_id' => $g['id'],
        'slot'          => $g['slot'],
        'model_id'      => $g['model_id'],
        'model_version' => $g['model_version'],
        'provider'      => $g['provider'],
        'axes'          => $axisValues,
        'note'          => $note,
        'grade'         => $gradeBench,
        'grade_seed'    => $gradeSeed,
        'rank'          => ($rank && $rank['client'] === 'bench') ? $rank['pos'] : null,
        'complete'      => $isComplete,
    ];
    if ($isTurn) {
        $out['axes_seed'] = $axesSeed;
        $out['rank_seed'] = $rank ? $rank['pos'] : null;
    }
    return $out;
}

// --- population 1: the curated corpus --------------------------------------
// entry.json carries what the DB deliberately does not: the .svg filename
// (svg is NULL on curated rows because the file on disk is canonical) and the
// rid the drawer uses as its stable response id.
foreach ($curated as $sub) {
    $itemId = (string) $sub['item_id'];
    $entryPath = $ITEMS . '/' . $itemId . '/entry.json';
    $entry = is_readable($entryPath)
        ? json_decode((string) file_get_contents($entryPath), true)
        : null;
    $byIndex = array_values($entry['responses'] ?? []);

    $responses = [];
    foreach ($gensBySub[(string) $sub['id']] ?? [] as $i => $g) {
        $src = $byIndex[$i] ?? null;
        $file = $src['file'] ?? null;
        $r = jdq_response($g, $fold[(string) $g['id']] ?? [], $rankByGen[(string) $g['id']] ?? [], $axisCount, false);
        $r['rid'] = $src['rid'] ?? ('r' . ($i + 1));
        // relative to /art/junk-drawer/ — the drawer builds the same URL
        $r['svg'] = $file ? ('items/' . $itemId . '/' . $file) : null;
        $responses[] = $r;
    }

    $items[] = [
        'item_id'          => $itemId,
        'submission_id'    => (string) $sub['id'],
        'source'           => 'curated',
        'title'            => $entry['title'] ?? $itemId,
        'prompt'           => (string) $sub['prompt'],
        'created'          => (string) $sub['created'],
        'retired'          => !empty($entry['retired']),
        // the intents, as the item stands. SCRAP is absolute; RERUN settles
        // only once the rerun LANDED (a rated turn on the same prompt, byte
        // for byte — the join jd-harvest.php makes), so an abandoned rerun
        // comes back to the bench rather than stranding the item.
        'retire_requested' => $sub['retire_requested_at'] !== null,
        'rerun_requested'  => $sub['rerun_requested_at'] !== null,
        'rerun_landed'     => isset($ratedTurnPrompts[(string) $sub['prompt']]),
        // the size on file: the tier the entry carries today (the drawer's
        // truth) and the tier the bench filed (the owner's newer word,
        // waiting to be applied). The card prefills from either.
        'size_class'       => $entry['sizeClass'] ?? null,
        'size_filed'       => $sub['size_class'],
        'responses'        => $responses,
    ];
}

// --- population 2: the turns that never became items ------------------------
// one submission per prompt: most surviving drawings, then newest
$bestBySubject = [];
foreach ($turns as $s) {
    $p = (string) $s['prompt'];
    if (isset($curatedPrompts[$p])) {
        continue;                       // a rerun of a drawer item
    }
    $ok = array_values(array_filter($gensBySub[(string) $s['id']] ?? [],
        fn($g) => $g['status'] === 'ok' && (int) $g['has_svg'] === 1));
    if (!$ok) {
        continue;                       // nothing survived; nothing to rate
    }
    $n = count($ok);
    $prev = $bestBySubject[$p] ?? null;
    if ($prev === null || $n > $prev['n']
        || ($n === $prev['n'] && $s['created'] > $prev['sub']['created'])) {
        $bestBySubject[$p] = ['sub' => $s, 'n' => $n, 'gens' => $ok];
    }
}

foreach ($bestBySubject as $prompt => $best) {
    $sub = $best['sub'];
    $responses = [];
    foreach ($best['gens'] as $i => $g) {
        $gid = (string) $g['id'];
        $r = jdq_response($g, $fold[$gid] ?? [], $rankByGen[$gid] ?? [], $axisCount, true);
        $r['rid'] = 'g' . ($i + 1);
        $r['svg'] = null;
        $r['svg_url'] = '/api/jd-gen-svg.php?gen=' . rawurlencode($gid);
        $responses[] = $r;
    }
    $items[] = [
        // a turn has no item id; this is its handle everywhere the bench
        // keys on one, and it is stable (the submission is)
        'item_id'          => 'turn:' . $sub['id'],
        'submission_id'    => (string) $sub['id'],
        'source'           => 'turn',
        'title'            => mb_substr(trim(preg_replace('/\s+/u', ' ', $prompt)), 0, 42),
        'prompt'           => $prompt,
        'created'          => (string) $sub['created'],
        'retired'          => false,
        'retire_requested' => $sub['retire_requested_at'] !== null,
        'rerun_requested'  => $sub['rerun_requested_at'] !== null,
        'rerun_landed'     => null,
        'suppressed'       => (bool) $sub['suppressed'],
        'size_class'       => null,
        'size_filed'       => $sub['size_class'],
        'responses'        => $responses,
    ];
}

jd_json_out(200, [
    'ok'               => true,
    'build'            => jd_build_stamp(),
    'taxonomy_version' => jd_taxonomy_version($taxonomy),
    'axes'             => $axes,
    'grades'           => $grades,
    'size_tiers'       => $sizeTiers,
    'models'           => $models,
    'items'            => $items,
    'progress'         => [
        'responses' => $totalResponses,
        'complete'  => $totalRated,
        'cells'     => $totalResponses * $axisCount,
    ],
]);

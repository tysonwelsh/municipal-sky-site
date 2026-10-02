<?php
// GET /api/jd2-analytics.php — the numbers behind the drawer, dataset v2
// (PLAN-V2 §5). Public, read-only, Cache-Control: no-cache with an ETag and
// a 304 on If-None-Match (data.php's discipline) — the posture of
// v1's api/jd-analytics.php, whose payload this keeps key for key so the
// about page's charts (art/junk-drawer/about/about-scenes.js) and the
// analytics folder switch to it at the cutover by changing one URL:
//
//   totals  {turns, drawings, survived, rated_responses, cost_usd}
//   models  [{model_id, label, vendor}]           registry order; the colour key
//   cost    [{model_id, avg_usd, n}]              per surviving drawing, by value
//   firsts  [{model_id, firsts, judged, rate}]    rank-1 share, by rate
//   grades  [{model_id, avg, n, hist{"1".."5"}}]  by avg
//   axes    [{axis_id, label, points, models:[{model_id, avg, n, hist}]}]
//   spend   [{date, usd, cum_usd, by_model{}}]
//   turns   [{date, prompt, grades{model_id: grade}, prompt_id, run_id, origin}]
//
// and adds the comparative read v1 could not make (PLAN-V2 §4):
//
//   pairs   {models:[model_id…],
//            matrix:[[mean, n]…]…]  row model over column model: the mean pair
//                                   score (−3..+3, positive = the ROW preferred)
//                                   and how many pairs; antisymmetric; the
//                                   diagonal and unmet pairs are [null, 0]
//            wins:[{model_id, wins, losses, ties}]   from the SIGN of each score
//            bt:[{model_id, strength, n}]}           Bradley–Terry, below
//   margins [{model_a, model_b, mean, n, hist{"-3".."3"}}]  one per pair of
//            models that met, model_a first in `models` order, the score
//            signed so positive = model_a preferred; hist sums to n
//
// and the classification (intake, 2026-10-02):
//
//   tags    {facet id: {heading id: {label, n, by_model: {model_id: {mean, n}}}}}
//           every facet and heading of taxonomy.json `facets`, in file order:
//           n = the population's prompts filed under the heading (jd2_prompts.tags),
//           by_model = each model's mean GRADE over its counting drawings on
//           those prompts' runs (the display session's grade, as `grades`)
//
// ?tag=<facet>:<heading> keeps only the prompts filed under that heading —
// the population and the spend alike (400 for a facet or heading the
// taxonomy does not have); it combines with ?origin=.
//
// THE POPULATION. Every RUN of every LIVE prompt (a rerun is its own bracket
// and counts; draft and hidden prompts do not), and on each run ONE session:
// jd2_display_session() — the owner's current session when it is complete,
// else the visitor's current session when it is complete, else none. One
// rater per drawing, never the owner and a visitor averaged together. Only a
// run's counting drawings (ok, not hidden) are read. Owner and visitor
// prompts are pooled by default; ?origin=owner or ?origin=visitor keeps one
// population (prompts.origin — who wrote the prompt).
//
// MONEY. cost_usd is the price SNAPSHOTTED when the drawing was made
// (jd2-generate); an unpriced drawing (NULL) is left out of every sum, never
// counted as $0. `cost` averages the surviving drawings of the population
// above. `spend` and totals.cost_usd are every priced drawing of the origin
// filter, whatever its prompt's visibility or the drawing's status — spend is
// spend: a rejected drawing and a hidden prompt were really paid for. The
// last cum_usd equals totals.cost_usd (one sum, taken once).
//
// BRADLEY–TERRY. Each pair score is an outcome by its sign: the preferred
// model wins, the other loses, 0 is a tie and counts half a win to each.
// Strengths p_i are fitted by Hunter's (2004) MM iteration,
//     p_i ← W_i / Σ_j n_ij / (p_i + p_j),
// W_i = model i's wins (ties halved), n_ij = the comparisons between i and j,
// with a weak prior — ONE virtual tie between every two models that met — so
// a model that has not yet won stays finite and a thin sample shrinks toward
// equal. Iterated to a change below 1e-10 (at most 10,000 rounds), then
// normalised so the MEAN LOG-STRENGTH IS 0. `strength` is that log-strength:
// P(i preferred to j) = 1 / (1 + exp(strength_j − strength_i)).
//
// Nothing here names a model: identities come from the rows and labels from
// taxonomy.json's registry (a model the registry lacks shows its raw id). No
// v1 (jd_*) table is read. All aggregation is in PHP over plain SELECTs, as
// v1's file explains; the reads go through the jd2 helpers so the population
// is the one every other reader uses.
//
// THE READS are a fixed number of set-based queries, however many prompts:
// the ETag's two aggregates (jd2_etag_movers); the live prompts; their runs
// and those runs' generations (jd2_runs_for_prompts) — the ETag is taken
// over these (jd2_etag_reads), and a matching If-None-Match answers 304
// before anything else is read — then the spend; every run's current
// sessions and their judgments, rankings and pairs
// (jd2_current_with_standings). jd2_display_pick applies the reader rules
// per run in PHP.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();
jd_require_get();
if (!headers_sent()) {
    header('Cache-Control: no-cache');
}

$origin = $_GET['origin'] ?? null;
if ($origin !== null && !in_array($origin, JD2_PROMPT_ORIGIN, true)) {
    jd_fail(400, 'bad_request', 'origin must be one of: ' . implode(', ', JD2_PROMPT_ORIGIN) . '.');
}

$taxonomy = jd_taxonomy_required('jd2-analytics');

$tagFilter = null;   // [facet, heading]
if (isset($_GET['tag'])) {
    $parts = is_string($_GET['tag']) ? explode(':', $_GET['tag'], 2) : [];
    $facet = null;
    foreach (jd2_facets($taxonomy) as $f) {
        if ($f['id'] === ($parts[0] ?? null)) {
            $facet = $f;
        }
    }
    if (count($parts) !== 2 || $facet === null || !in_array($parts[1], array_column($facet['headings'], 'id'), true)) {
        jd_fail(400, 'bad_request', 'tag must be <facet>:<heading>, a heading of a taxonomy facet (e.g. subject:object).');
    }
    $tagFilter = $parts;
}
/** Is a prompt (its tags column) filed under the ?tag= heading? True when there is no filter. */
function jd2a_tag_passes(mixed $tagsJson, ?array $filter): bool
{
    if ($filter === null) {
        return true;
    }
    $t = jd2_tags_decode($tagsJson);
    return in_array($filter[1], $t[$filter[0]] ?? [], true);
}

$registry = [];
foreach (jd_model_registry($taxonomy) as $id => $model) {
    $registry[(string) $id] = ['label' => (string) ($model['label'] ?? $id), 'vendor' => (string) ($model['vendor'] ?? '')];
}
$axisDefs = [];
foreach (jd_live_axes($taxonomy) as $id => $axis) {
    $axisDefs[(string) $id] = ['label' => (string) ($axis['label'] ?? $id), 'points' => count($axis['values'] ?? [])];
}

$totals = ['turns' => 0, 'drawings' => 0, 'survived' => 0, 'rated_responses' => 0];
$costByModel = [];   // model => {sum, n}
$gradeByModel = [];  // model => {sum, n, hist}
$axisByModel = [];   // axis => model => {sum, n, hist}
$firstsByModel = [];
$judgedByModel = [];
$pairRows = [];      // [model_a, model_b, score] — score positive = model_a preferred
$turnRows = [];
$spendByDate = [];
$gradesByPrompt = [];  // prompt id => model => {sum, n}: the tags block's raw material

try {
    $db = jd_db();

    // --- the population's prompts, runs and drawings, and the ETag over them --
    $stamp = JD_TAXONOMY_PATH . '|' . @filemtime(JD_TAXONOMY_PATH) . ';o|' . ($origin ?? '') . ';t|'
        . ($tagFilter === null ? '' : implode(':', $tagFilter)) . ';' . jd2_etag_movers($db);
    $sql = "SELECT id, text, title, origin, created, shown_run_id, tags
              FROM jd2_prompts WHERE visibility = '" . JD2_VIS_LIVE . "'";
    $args = [];
    if ($origin !== null) {
        $sql .= ' AND origin = ?';
        $args[] = $origin;
    }
    $q = $db->prepare($sql . ' ORDER BY created DESC, id DESC');
    $q->execute($args);
    $prompts = array_values(array_filter($q->fetchAll(PDO::FETCH_ASSOC),
        static fn ($p) => jd2a_tag_passes($p['tags'], $tagFilter)));
    $runsByPrompt = jd2_runs_for_prompts($db, array_column($prompts, 'id'));
    $etag = '"' . md5($stamp . jd2_etag_reads($prompts, $runsByPrompt)) . '"';
    if (!headers_sent()) {
        header('ETag: ' . $etag);
    }
    if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
        http_response_code(304);
        exit();
    }

    // --- spend: every priced drawing of the origin filter ---------------------
    $sql = 'SELECT g.model_id, g.cost_usd, g.created, p.tags
              FROM jd2_generations g
              JOIN jd2_runs r ON r.id = g.run_id
              JOIN jd2_prompts p ON p.id = r.prompt_id
             WHERE g.cost_usd IS NOT NULL';
    $args = [];
    if ($origin !== null) {
        $sql .= ' AND p.origin = ?';
        $args[] = $origin;
    }
    $q = $db->prepare($sql . ' ORDER BY g.created, g.id');
    $q->execute($args);
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $g) {
        if (!jd2a_tag_passes($g['tags'], $tagFilter)) {
            continue;
        }
        $date = substr((string) $g['created'], 0, 10);
        $usd = (float) $g['cost_usd'];
        $spendByDate[$date] ??= ['usd' => 0.0, 'by_model' => []];
        $spendByDate[$date]['usd'] += $usd;
        $spendByDate[$date]['by_model'][(string) $g['model_id']] =
            ($spendByDate[$date]['by_model'][(string) $g['model_id']] ?? 0.0) + $usd;
    }

    // --- the population: every run of every live prompt -----------------------
    [$current, $standings] = jd2_current_with_standings($db, jd2_run_ids($runsByPrompt));
    foreach ($prompts as $p) {
        $runs = $runsByPrompt[(string) $p['id']] ?? [];
        $drawerRun = null;   // data.php's run: the owner's choice, else the newest complete
        $displayOf = [];
        foreach ($runs as $run) {
            $rid = (string) $run['id'];
            $totals['turns']++;
            $totals['drawings'] += count($run['gens']);
            $modelOf = [];
            foreach ($run['gens'] as $g) {
                $modelOf[(string) $g['id']] = (string) $g['model_id'];
                if ($g['status'] !== JD2_GEN_OK) {
                    continue;
                }
                $totals['survived']++;
                if ($g['cost_usd'] !== null) {
                    $m = (string) $g['model_id'];
                    $costByModel[$m] ??= ['sum' => 0.0, 'n' => 0];
                    $costByModel[$m]['sum'] += (float) $g['cost_usd'];
                    $costByModel[$m]['n']++;
                }
            }
            if ($run['counting'] === []) {
                continue;
            }
            $display = jd2_display_pick($current[$rid] ?? [], $standings, $run['counting'], $taxonomy);
            $displayOf[$rid] = $display;
            if ($display === null) {
                continue;
            }
            $st = $display['standing'];
            $counting = array_flip($run['counting']);

            foreach ($run['counting'] as $gid) {
                $m = $modelOf[$gid];
                $j = $st['judgments'][$gid] ?? null;
                if ($j === null) {
                    continue;
                }
                $totals['rated_responses']++;
                if ($j['grade'] !== null) {
                    $gradeByModel[$m] ??= ['sum' => 0.0, 'n' => 0, 'hist' => []];
                    $gradeByModel[$m]['sum'] += $j['grade'];
                    $gradeByModel[$m]['n']++;
                    $bin = (string) (int) round($j['grade']);
                    $gradeByModel[$m]['hist'][$bin] = ($gradeByModel[$m]['hist'][$bin] ?? 0) + 1;
                    $gp = &$gradesByPrompt[(string) $p['id']][$m];
                    $gp ??= ['sum' => 0.0, 'n' => 0];
                    $gp['sum'] += $j['grade'];
                    $gp['n']++;
                    unset($gp);
                }
                foreach ($j['axes'] as $axis => $value) {
                    if (!isset($axisDefs[$axis])) {
                        continue;   // a defunct axis is history, not a chart
                    }
                    $axisByModel[$axis][$m] ??= ['sum' => 0.0, 'n' => 0, 'hist' => []];
                    $axisByModel[$axis][$m]['sum'] += $value;
                    $axisByModel[$axis][$m]['n']++;
                    $bin = (string) (int) round($value);
                    $axisByModel[$axis][$m]['hist'][$bin] = ($axisByModel[$axis][$m]['hist'][$bin] ?? 0) + 1;
                }
            }

            // firsts: a run with a contest (two or more counting drawings);
            // the denominator is the runs a model SURVIVED in
            if (count($run['counting']) > 1) {
                foreach ($run['counting'] as $gid) {
                    $m = $modelOf[$gid];
                    $judgedByModel[$m] = ($judgedByModel[$m] ?? 0) + 1;
                    if ((int) ($st['rankings'][$gid]['rank_pos'] ?? 0) === 1) {
                        $firstsByModel[$m] = ($firstsByModel[$m] ?? 0) + 1;
                    }
                }
            }

            foreach ($st['pairs'] as $pr) {
                if (!isset($counting[$pr['gen_a']], $counting[$pr['gen_b']])) {
                    continue;
                }
                $pairRows[] = [$modelOf[$pr['gen_a']], $modelOf[$pr['gen_b']], (int) $pr['score']];
            }
        }

        // the turn table: one row per live prompt, the run the drawer shows
        foreach ($runs as $run) {
            if ($p['shown_run_id'] !== null && $run['id'] === $p['shown_run_id']) {
                $drawerRun = $run;
                break;
            }
        }
        if ($drawerRun === null) {
            foreach ($runs as $run) {
                if (($displayOf[(string) $run['id']] ?? null) !== null) {
                    $drawerRun = $run;
                    break;
                }
            }
        }
        $dd = $drawerRun === null ? null : ($displayOf[(string) $drawerRun['id']] ?? null);
        if ($dd !== null) {
            $grades = [];
            foreach ($drawerRun['gens'] as $g) {
                $gr = $dd['standing']['judgments'][(string) $g['id']]['grade'] ?? null;
                if ($gr !== null && in_array((string) $g['id'], $drawerRun['counting'], true)) {
                    $grades[(string) $g['model_id']] = $gr;
                }
            }
            if ($grades) {
                $turnRows[] = ['date' => substr((string) $drawerRun['created'], 0, 10), 'prompt' => (string) $p['text'],
                               'grades' => $grades, 'prompt_id' => (string) $p['id'],
                               'run_id' => (string) $drawerRun['id'], 'origin' => (string) $p['origin']];
            }
        }
    }
} catch (PDOException $e) {
    error_log('jd2-analytics: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The numbers could not be read.');
}

// --- the model list: everyone with data anywhere, registry order first ---------
$seen = [];
foreach ([$costByModel, $gradeByModel, $judgedByModel, $firstsByModel] as $byModel) {
    foreach (array_keys($byModel) as $id) {
        $seen[(string) $id] = true;
    }
}
foreach ($axisByModel as $byModel) {
    foreach (array_keys($byModel) as $id) {
        $seen[(string) $id] = true;
    }
}
foreach ($pairRows as [$a, $b]) {
    $seen[$a] = $seen[$b] = true;
}
$modelOrder = [];
foreach (array_keys($registry) as $id) {
    if (isset($seen[$id])) {
        $modelOrder[] = $id;
        unset($seen[$id]);
    }
}
$rest = array_map('strval', array_keys($seen));
sort($rest);
$modelOrder = array_merge($modelOrder, $rest);
$models = array_map(static fn ($id) => ['model_id' => $id, 'label' => $registry[$id]['label'] ?? $id,
                                        'vendor' => $registry[$id]['vendor'] ?? ''], $modelOrder);

// --- the v1 shapes -------------------------------------------------------------
$cost = [];
foreach ($costByModel as $id => $c) {
    $cost[] = ['model_id' => (string) $id, 'avg_usd' => round($c['sum'] / $c['n'], 6), 'n' => $c['n']];
}
usort($cost, static fn ($a, $b) => $b['avg_usd'] <=> $a['avg_usd']);

$firsts = [];
foreach ($judgedByModel as $id => $judged) {
    $won = $firstsByModel[$id] ?? 0;
    $firsts[] = ['model_id' => (string) $id, 'firsts' => $won, 'judged' => $judged,
                 'rate' => $judged > 0 ? round($won / $judged, 4) : 0.0];
}
usort($firsts, static fn ($a, $b) => [$b['rate'], $b['firsts']] <=> [$a['rate'], $a['firsts']]);

$grades = [];
foreach ($gradeByModel as $id => $g) {
    ksort($g['hist'], SORT_NUMERIC);
    $grades[] = ['model_id' => (string) $id, 'avg' => round($g['sum'] / $g['n'], 3), 'n' => $g['n'],
                 'hist' => (object) $g['hist']];
}
usort($grades, static fn ($a, $b) => $b['avg'] <=> $a['avg']);

$axes = [];
foreach ($axisDefs as $axisId => $def) {
    $rows = [];
    foreach ($modelOrder as $id) {
        $cell = $axisByModel[$axisId][$id] ?? null;
        if ($cell === null) {
            continue;   // no rating on this axis: no dot, not a zero
        }
        ksort($cell['hist'], SORT_NUMERIC);
        $rows[] = ['model_id' => $id, 'avg' => round($cell['sum'] / $cell['n'], 3), 'n' => $cell['n'],
                   'hist' => (object) $cell['hist']];
    }
    $axes[] = ['axis_id' => $axisId, 'label' => $def['label'], 'points' => $def['points'], 'models' => $rows];
}

ksort($spendByDate);
$spend = [];
$running = 0.0;
foreach ($spendByDate as $date => $day) {
    $running += $day['usd'];
    $byModel = [];
    foreach ($day['by_model'] as $id => $usd) {
        $byModel[(string) $id] = round($usd, 6);
    }
    $spend[] = ['date' => (string) $date, 'usd' => round($day['usd'], 6), 'cum_usd' => round($running, 6),
                'by_model' => (object) $byModel];
}
$totals['cost_usd'] = round($running, 6);

// --- the classification: per facet, per heading -------------------------------
$tagsOut = [];
foreach (jd2_facets($taxonomy) as $f) {
    $acc = [];
    foreach ($f['headings'] as $h) {
        $acc[$h['id']] = ['label' => $h['label'], 'n' => 0, 'models' => []];
    }
    foreach ($prompts as $p) {
        $filed = jd2_tags_decode($p['tags'])[$f['id']] ?? [];
        foreach (is_array($filed) ? $filed : [] as $hid) {
            if (!is_string($hid) || !isset($acc[$hid])) {
                continue;   // a retired heading is history, not a row
            }
            $acc[$hid]['n']++;
            foreach ($gradesByPrompt[(string) $p['id']] ?? [] as $m => $g) {
                $acc[$hid]['models'][$m] ??= ['sum' => 0.0, 'n' => 0];
                $acc[$hid]['models'][$m]['sum'] += $g['sum'];
                $acc[$hid]['models'][$m]['n'] += $g['n'];
            }
        }
    }
    $out = [];
    foreach ($acc as $hid => $a) {
        $byModel = [];
        foreach ($modelOrder as $m) {
            if (isset($a['models'][$m])) {
                $byModel[$m] = ['mean' => round($a['models'][$m]['sum'] / $a['models'][$m]['n'], 3), 'n' => $a['models'][$m]['n']];
            }
        }
        $out[$hid] = ['label' => $a['label'], 'n' => $a['n'], 'by_model' => (object) $byModel];
    }
    $tagsOut[$f['id']] = (object) $out;
}

usort($turnRows, static fn ($a, $b) => strcmp($b['date'], $a['date']) ?: strcmp($b['run_id'], $a['run_id']));
$turnRows = array_slice($turnRows, 0, 200);

// --- the comparative read ------------------------------------------------------
$pm = [];   // the models that met in a pair, in the colour key's order
$met = [];
foreach ($pairRows as [$a, $b]) {
    $met[$a] = $met[$b] = true;
}
foreach ($modelOrder as $id) {
    if (isset($met[$id])) {
        $pm[] = $id;
    }
}
$ix = array_flip($pm);
$k = count($pm);
$sum = array_fill(0, $k, array_fill(0, $k, 0));
$cnt = array_fill(0, $k, array_fill(0, $k, 0));
$wins = array_fill(0, $k, ['wins' => 0, 'losses' => 0, 'ties' => 0]);
$hist = [];   // "i|j" (i < j) => score (signed for i) => count
foreach ($pairRows as [$a, $b, $s]) {
    $i = $ix[$a];
    $j = $ix[$b];
    if ($i === $j) {
        continue;   // one model on both sides cannot happen in a dealt run; guard anyway
    }
    $sum[$i][$j] += $s;
    $sum[$j][$i] -= $s;
    $cnt[$i][$j]++;
    $cnt[$j][$i]++;
    if ($s > 0) {
        $wins[$i]['wins']++;
        $wins[$j]['losses']++;
    } elseif ($s < 0) {
        $wins[$j]['wins']++;
        $wins[$i]['losses']++;
    } else {
        $wins[$i]['ties']++;
        $wins[$j]['ties']++;
    }
    [$lo, $hi, $signed] = $i < $j ? [$i, $j, $s] : [$j, $i, -$s];
    $hist["$lo|$hi"][$signed] = ($hist["$lo|$hi"][$signed] ?? 0) + 1;
}

$matrix = [];
for ($i = 0; $i < $k; $i++) {
    $row = [];
    for ($j = 0; $j < $k; $j++) {
        $row[] = $cnt[$i][$j] > 0 ? [round($sum[$i][$j] / $cnt[$i][$j], 3), $cnt[$i][$j]] : [null, 0];
    }
    $matrix[] = $row;
}

$winsOut = [];
foreach ($pm as $i => $id) {
    $winsOut[] = ['model_id' => $id] + $wins[$i];
}

$margins = [];
for ($i = 0; $i < $k; $i++) {
    for ($j = $i + 1; $j < $k; $j++) {
        if ($cnt[$i][$j] === 0) {
            continue;
        }
        $h = [];
        for ($s = -JD2_SCORE_MAX; $s <= JD2_SCORE_MAX; $s++) {
            $h[(string) $s] = $hist["$i|$j"][$s] ?? 0;
        }
        $margins[] = ['model_a' => $pm[$i], 'model_b' => $pm[$j],
                      'mean' => round($sum[$i][$j] / $cnt[$i][$j], 3), 'n' => $cnt[$i][$j], 'hist' => $h];
    }
}

jd_json_out(200, [
    'ok' => true,
    'generated' => gmdate('c'),
    'dataset' => 'v2',
    'origin' => $origin,
    'tag' => $tagFilter === null ? null : implode(':', $tagFilter),
    'totals' => $totals,
    'models' => $models,
    'cost' => $cost,
    'firsts' => $firsts,
    'grades' => $grades,
    'axes' => $axes,
    'spend' => $spend,
    'turns' => $turnRows,
    'pairs' => [
        'models' => $pm,
        'matrix' => $matrix,
        'wins' => $winsOut,
        'bt' => jd2a_bradley_terry($pm, $cnt, $wins, $pairRows, $ix),
    ],
    'margins' => $margins,
    'tags' => (object) $tagsOut,
]);

// ---------------------------------------------------------------------------

/**
 * Bradley–Terry log-strengths by the MM iteration (see the header): ties half
 * a win to each side, one virtual tie between every two models that met,
 * normalised to a mean log-strength of 0.
 *
 * @return list<array{model_id:string,strength:float,n:int}>  in $pm order
 */
function jd2a_bradley_terry(array $pm, array $cnt, array $wins, array $pairRows, array $ix): array
{
    $k = count($pm);
    if ($k === 0) {
        return [];
    }
    // w[i][j] = i's wins over j, ties halved; n[i][j] = comparisons; plus the prior
    $w = array_fill(0, $k, array_fill(0, $k, 0.0));
    foreach ($pairRows as [$a, $b, $s]) {
        $i = $ix[$a];
        $j = $ix[$b];
        if ($s > 0) {
            $w[$i][$j] += 1.0;
        } elseif ($s < 0) {
            $w[$j][$i] += 1.0;
        } else {
            $w[$i][$j] += 0.5;
            $w[$j][$i] += 0.5;
        }
    }
    $n = array_fill(0, $k, array_fill(0, $k, 0.0));
    $W = array_fill(0, $k, 0.0);
    for ($i = 0; $i < $k; $i++) {
        for ($j = 0; $j < $k; $j++) {
            if ($i === $j || $cnt[$i][$j] === 0) {
                continue;
            }
            $n[$i][$j] = $cnt[$i][$j] + 1.0;      // + the virtual tie
            $W[$i] += $w[$i][$j] + 0.5;
        }
    }
    $p = array_fill(0, $k, 1.0);
    for ($round = 0; $round < 10000; $round++) {
        $next = [];
        for ($i = 0; $i < $k; $i++) {
            $den = 0.0;
            for ($j = 0; $j < $k; $j++) {
                if ($n[$i][$j] > 0) {
                    $den += $n[$i][$j] / ($p[$i] + $p[$j]);
                }
            }
            $next[$i] = $den > 0 ? $W[$i] / $den : 1.0;
        }
        // normalise: mean log-strength 0 (geometric mean 1)
        $logMean = array_sum(array_map('log', $next)) / $k;
        $delta = 0.0;
        for ($i = 0; $i < $k; $i++) {
            $next[$i] = exp(log($next[$i]) - $logMean);
            $delta = max($delta, abs(log($next[$i]) - log($p[$i])));
        }
        $p = $next;
        if ($delta < 1e-10) {
            break;
        }
    }
    $out = [];
    foreach ($pm as $i => $id) {
        $out[] = ['model_id' => $id, 'strength' => round(log($p[$i]), 4),
                  'n' => $wins[$i]['wins'] + $wins[$i]['losses'] + $wins[$i]['ties']];
    }
    return $out;
}

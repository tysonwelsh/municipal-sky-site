<?php
// GET /api/jd-ledger.php — the curator's overview (owner ask, 2026-09-10).
//
// One read that answers, for EVERYTHING the drawer has ever held — every
// curated entry on disk (retired ones included) and every visitor turn in
// the database — the questions the owner kept having to guess at:
//   · is it in the drawer right now, and if not, WHY not (hidden by the
//     admin card, retired in its file, a turn nobody finished rating, a
//     visitor's SUPPRESS, a rerun that belongs to a curated item …)
//   · which response the drawer shows, and by what rule
//   · how far the rating of each response has got under the current rubric
//     (the bench's own answers, the seeds an entry carried, a visitor's)
//   · whether the bench would offer the item, and if not, why (done; more
//     served responses than the card seats; no rows yet; hidden)
// jd-inventory.php is the raw census; this is the census READ THE WAY THE
// DRAWER AND THE BENCH READ IT, so the ledger page (art/junk-drawer/
// ledger.html) can be a plain table instead of a second copy of their rules.
//
// Read-only, no-store, the bench gate. Prompts ride along (they are public
// in the drawer); SVG text does not — the page fetches a drawing on demand.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_no_store();
jd_require_get();
jd_require_bench_key();

$taxonomy = jd_taxonomy_required('jd-ledger');
$liveAxes = jd_live_axes($taxonomy);
$axisCount = count($liveAxes);
$models = [];
foreach (jd_model_registry($taxonomy) as $id => $m) {
    $models[$id] = (string) ($m['label'] ?? $id);
}
$gradeLabels = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    $gradeLabels[(string) (float) ($g['rank'] ?? 0)] = (string) ($g['label'] ?? '');
}
$axesOut = [];
foreach ($liveAxes as $id => $axis) {
    $values = [];
    foreach ($axis['values'] ?? [] as $v) {
        $values[(string) (float) ($v['rank'] ?? 0)] = (string) ($v['label'] ?? '');
    }
    $axesOut[] = ['id' => $id, 'label' => (string) ($axis['label'] ?? $id), 'values' => $values];
}

// --- the reads ---------------------------------------------------------------
try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    // device_ref (2026-09-10) may not have reached this table yet
    $hasDevice = jd_has_column($db, 'jd_submissions', 'device_ref');
    $subs = $db->query(
        'SELECT id, item_id, prompt, created, status, client, title, size_class,
                suppressed, retire_requested_at, rerun_requested_at' .
                ($hasDevice ? ', device_ref' : ', NULL AS device_ref') . '
           FROM jd_submissions ORDER BY created, id'
    )->fetchAll(PDO::FETCH_ASSOC);
    $gens = $db->query(
        "SELECT id, submission_id, slot, model_id, model_version, provider, status,
                reject_reason, created,
                CASE WHEN svg IS NULL THEN 0 ELSE 1 END AS has_svg
           FROM jd_generations ORDER BY submission_id, slot"
    )->fetchAll(PDO::FETCH_ASSOC);
    $rates = $db->query(
        'SELECT generation_id, kind, axis_id, value, note, client, taxonomy_version
           FROM jd_ratings ORDER BY rated_at, id'
    )->fetchAll(PDO::FETCH_ASSOC);
    $rankRows = [];
    try {
        $rankRows = $db->query('SELECT submission_id, generation_id, rank_pos, client FROM jd_ranks')
            ->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (!jd_missing_table($e)) {
            throw $e;
        }
    }
} catch (PDOException $e) {
    error_log('jd-ledger: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The ledger could not be read.');
}

$fold = jd_fold_ratings($rates, $liveAxes);
$rankByGen = [];          // gen => ['pos', 'client'] — the bench's outranks
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
$subByItem = [];
$turns = [];
$curatedPrompts = [];     // prompt => item id
$ratedTurnPrompts = [];
foreach ($subs as $s) {
    if ($s['item_id'] === null) {
        $turns[] = $s;
        if ($s['status'] === 'rated') {
            $ratedTurnPrompts[(string) $s['prompt']] = true;
        }
    } else {
        $subByItem[(string) $s['item_id']] = $s;
        $curatedPrompts[(string) $s['prompt']] = (string) $s['item_id'];
    }
}

/** one generation's standing, every client's word laid out */
function jdl_standing(array $byClient, int $axisCount): array
{
    $pick = jd_pick_rating($byClient, ['bench', '*']);
    $bench = $byClient['bench'] ?? null;
    $seed = $byClient['seed'] ?? null;
    $visitor = null;
    foreach ($byClient as $c => $s) {
        if ($c !== 'bench' && $c !== 'seed') {
            $visitor = $s;
            break;
        }
    }
    return [
        'grade'      => $pick['grade'],
        'axes'       => (object) $pick['axes'],
        'axes_n'     => count($pick['axes']),
        'notes'      => (object) $pick['notes'],
        'note'       => $pick['note'],
        'by'         => [
            'bench'   => $bench ? ['grade' => $bench['grade'], 'axes_n' => count($bench['axes'])] : null,
            'seed'    => $seed ? ['grade' => $seed['grade'], 'axes_n' => count($seed['axes'])] : null,
            'visitor' => $visitor ? ['grade' => $visitor['grade'], 'axes_n' => count($visitor['axes'])] : null,
        ],
        'complete'   => count($pick['axes']) === $axisCount && $pick['grade'] !== null,
    ];
}

$items = [];

// --- the curated corpus: every entry on disk ---------------------------------
$dir = __DIR__ . '/../art/junk-drawer/items';
$entries = [];
foreach (glob($dir . '/*/entry.json') as $f) {
    $e = json_decode((string) @file_get_contents($f), true);
    if (is_array($e) && isset($e['id'])) {
        $entries[(string) $e['id']] = $e;
    }
}
ksort($entries);

foreach ($entries as $itemId => $entry) {
    $sub = $subByItem[$itemId] ?? null;
    $sgens = $sub ? ($gensBySub[(string) $sub['id']] ?? []) : [];
    $responses = [];
    $served = [];
    $allBenchRanked = true;
    foreach (array_values($entry['responses'] ?? []) as $i => $src) {
        $g = $sgens[$i] ?? null;
        $gid = $g ? (string) $g['id'] : null;
        $st = $gid ? jdl_standing($fold[$gid] ?? [], $axisCount) : null;
        $rank = $gid ? ($rankByGen[$gid] ?? null) : null;
        $retired = !empty($src['retired']);
        $entryAxes = [];
        foreach ($src['annotations'] ?? [] as $axis => $a) {
            if (isset($liveAxes[(string) $axis])) {
                $entryAxes[(string) $axis] = is_array($a) ? ($a['value'] ?? null) : $a;
            }
        }
        $r = [
            'rid'         => (string) ($src['rid'] ?? ('r' . ($i + 1))),
            'gen_id'      => $gid,
            'slot'        => $g ? $g['slot'] : null,
            'model'       => (string) ($src['model'] ?? ''),
            'model_label' => $models[(string) ($src['model'] ?? '')] ?? (string) ($src['model'] ?? ''),
            'date'        => (string) ($src['date'] ?? ''),
            'url'         => '/art/junk-drawer/items/' . $itemId . '/' . (string) ($src['file'] ?? ''),
            'retired'     => $retired,
            'entry'       => ['grade' => $src['grade'] ?? null, 'axes' => (object) $entryAxes,
                              'axes_n' => count($entryAxes), 'notes' => $src['notes'] ?? null],
            'standing'    => $st,
            'rank'        => $rank ? $rank['pos'] : null,
            'rank_by'     => $rank ? $rank['client'] : null,
            // complete as the queue counts it — the database's word; an
            // entry annotated but never synced is a "no rows" item, below
            'complete'    => $st ? $st['complete'] : false,
        ];
        $responses[] = $r;
        if (!$retired) {
            $served[] = $r;
            if (!$rank || $rank['client'] !== 'bench') {
                $allBenchRanked = false;
            }
        }
    }
    // the response the drawer shows, by data.php's rule: the bench's 1st
    // place when the bench ranked every served response, else the pin,
    // else the best overlaid grade (bench's, else the entry's), earliest rid
    $shows = null;
    $rule = null;
    if ($served && $allBenchRanked) {
        foreach ($served as $r) {
            if ($r['rank'] === 1) {
                $shows = $r['rid']; $rule = 'the bench ranked it first';
                break;
            }
        }
    }
    if ($shows === null && $served && !empty($entry['primary'])) {
        foreach ($served as $r) {
            if ($r['rid'] === $entry['primary']) {
                $shows = $r['rid']; $rule = 'pinned in the entry';
                break;
            }
        }
    }
    if ($shows === null && $served) {
        $best = null; $bestG = -1;
        foreach ($served as $r) {
            $gr = $r['standing'] && $r['standing']['by']['bench'] && $r['standing']['by']['bench']['grade'] !== null
                ? (float) $r['standing']['by']['bench']['grade']
                : (float) ($r['entry']['grade'] ?? 0);
            if ($gr > $bestG) { $bestG = $gr; $best = $r['rid']; }
        }
        $shows = $best; $rule = 'best grade';
    }

    $retiredFile = !empty($entry['retired']);
    $hidden = $sub && $sub['retire_requested_at'] !== null;
    $rerunReq = $sub && $sub['rerun_requested_at'] !== null;
    $rerunLanded = isset($ratedTurnPrompts[(string) ($entry['prompt'] ?? '')]);
    if ($retiredFile) {
        $drawer = ['state' => 'absent', 'why' => 'retired in its entry file — only a commit brings it back'];
    } elseif (!$served) {
        $drawer = ['state' => 'absent', 'why' => 'every response is retired in the entry file'];
    } elseif ($hidden) {
        $drawer = ['state' => 'hidden', 'why' => 'hidden from the drawer (admin card / bench scrap) — SHOW puts it back'];
    } else {
        $drawer = ['state' => 'shown', 'why' => ''];
    }
    $drawer['shows'] = $shows;
    $drawer['rule'] = $rule;

    // the bench's view, mirroring jd-bench.js workable()/itemDone()
    $needs = [];
    $benchState = 'done';
    if ($retiredFile || $hidden) {
        $benchState = 'off';
        $needs[] = $retiredFile ? 'retired in its file' : 'hidden — the bench skips hidden items';
    } elseif (!$sub) {
        $benchState = 'blocked';
        $needs[] = 'no database rows yet — the backfill (or the first admin save) files them';
    } else {
        $seatable = array_values(array_filter($served, fn($r) => $r['gen_id'] !== null));
        if (count($served) > count($sgens)) {
            $benchState = 'blocked';
            $needs[] = (count($served) - count($seatable)) . ' response(s) in the entry have no database row yet — re-run the backfill';
        }
        if (count($served) > 4) {
            $benchState = 'blocked';
            $needs[] = count($served) . ' served responses — the bench card seats four, so the bench never offers this item';
        }
        if ($rerunReq && !$rerunLanded) {
            $needs[] = 'rerun requested and not landed yet';
            $benchState = 'open';
        } elseif ($rerunReq) {
            $needs[] = 'rerun landed';
        }
        $incomplete = []; $unranked = [];
        foreach ($served as $r) {
            if (!$r['complete']) {
                $st = $r['standing'];
                $incomplete[] = $r['rid'] . ' (' . ($st ? $st['axes_n'] : 0) . '/' . $axisCount . ' axes' .
                    (($st && $st['grade'] !== null) ? '' : ', no grade') . ')';
            }
            if (count($served) > 1 && !($r['rank'] >= 1)) {
                $unranked[] = $r['rid'];
            }
        }
        if ($incomplete) {
            $needs[] = 'unrated: ' . implode(', ', $incomplete);
        }
        if ($unranked) {
            $needs[] = 'unranked: ' . implode(', ', $unranked);
        }
        if (($incomplete || $unranked) && $benchState === 'done') {
            $benchState = $rerunReq ? 'done' : 'open';
        }
    }

    $items[] = [
        'key'            => $itemId,
        'kind'           => 'curated',
        'item_id'        => $itemId,
        'submission_id'  => $sub ? (string) $sub['id'] : null,
        'title'          => (string) ($entry['title'] ?? $itemId),
        'prompt'         => (string) ($entry['prompt'] ?? ''),
        'created'        => (string) ($entry['created'] ?? ''),
        'size'           => ['entry' => $entry['sizeClass'] ?? null, 'filed' => $sub['size_class'] ?? null,
                             'scale' => $entry['sizeScale'] ?? null],
        'flags'          => [
            'retired_file'      => $retiredFile,
            'retire_requested'  => $hidden,
            'rerun_requested'   => $rerunReq,
            'rerun_landed'      => $rerunLanded,
            'primary'           => $entry['primary'] ?? null,
        ],
        'drawer'         => $drawer,
        'drawer_id'      => $itemId,
        'bench'          => ['state' => $benchState, 'needs' => $needs, 'served' => count($served)],
        'responses'      => $responses,
    ];
}

// --- the turns: every visitor submission ------------------------------------
// which copy of a repeated prompt the bench offers (jd-bench-queue's rule:
// most surviving drawings, then newest)
$offered = [];
foreach ($turns as $s) {
    $p = (string) $s['prompt'];
    if (isset($curatedPrompts[$p])) {
        continue;
    }
    $n = 0;
    foreach ($gensBySub[(string) $s['id']] ?? [] as $g) {
        if ($g['status'] === 'ok' && (int) $g['has_svg'] === 1) {
            $n++;
        }
    }
    if (!$n) {
        continue;
    }
    $prev = $offered[$p] ?? null;
    if ($prev === null || $n > $prev['n'] || ($n === $prev['n'] && $s['created'] > $prev['created'])) {
        $offered[$p] = ['id' => (string) $s['id'], 'n' => $n, 'created' => $s['created']];
    }
}

foreach ($turns as $s) {
    $sid = (string) $s['id'];
    $sgens = $gensBySub[$sid] ?? [];
    $responses = [];
    $ok = [];
    foreach ($sgens as $i => $g) {
        $gid = (string) $g['id'];
        $st = jdl_standing($fold[$gid] ?? [], $axisCount);
        $rank = $rankByGen[$gid] ?? null;
        $alive = $g['status'] === 'ok' && (int) $g['has_svg'] === 1;
        $r = [
            'rid'         => 'g' . ($i + 1),
            'gen_id'      => $gid,
            'slot'        => $g['slot'],
            'model'       => (string) $g['model_id'],
            'model_label' => $models[(string) $g['model_id']] ?? (string) $g['model_id'],
            'date'        => substr((string) $g['created'], 0, 10),
            'url'         => $alive ? ('/api/jd-gen-svg.php?gen=' . rawurlencode($gid)) : null,
            'status'      => (string) $g['status'],
            'reject'      => $g['reject_reason'],
            'retired'     => !$alive,
            'entry'       => null,
            'standing'    => $st,
            'rank'        => $rank ? $rank['pos'] : null,
            'rank_by'     => $rank ? $rank['client'] : null,
            'complete'    => $st['complete'],
        ];
        $responses[] = $r;
        if ($alive) {
            $ok[] = $r;
        }
    }
    $prompt = (string) $s['prompt'];
    $rerunOf = $curatedPrompts[$prompt] ?? null;
    $rated = $s['status'] === 'rated';
    $suppressed = (bool) $s['suppressed'];
    $hidden = $s['retire_requested_at'] !== null;
    $allDone = true; $allRanked = true; $first = null;
    foreach ($ok as $r) {
        if (!$r['complete']) { $allDone = false; }
        if (!($r['rank'] >= 1)) { $allRanked = false; }
        if ($r['rank'] === 1 && $first === null) { $first = $r; }
    }
    if ($rerunOf !== null) {
        $drawer = ['state' => 'absent', 'why' => 'a rerun of the curated item ' . $rerunOf . ' — it belongs to that item (harvest it to file); its own drawings are never shown as a turn'];
    } elseif (!$ok) {
        $drawer = ['state' => 'absent', 'why' => 'no surviving drawings (' . $s['status'] . ')'];
    } elseif (!$rated) {
        $drawer = ['state' => 'absent', 'why' => 'the turn was never finished — status "' . $s['status'] . '"; only a rated turn joins the drawer'];
    } elseif ($suppressed) {
        $drawer = ['state' => 'absent', 'why' => 'the visitor ticked SUPPRESS on the closing card — recorded, displayed nowhere'];
    } elseif ($hidden) {
        $drawer = ['state' => 'hidden', 'why' => 'hidden from the drawer (bench scrap / admin card) — SHOW puts it back'];
    } elseif (!$allDone || (count($ok) > 1 && !$allRanked)) {
        $drawer = ['state' => 'absent', 'why' => 'rated, but not every drawing is graded on every live axis and ranked — the bench can finish it'];
    } else {
        $drawer = ['state' => 'shown', 'why' => ''];
    }
    $shownRid = $first ? $first['rid'] : ($ok ? $ok[0]['rid'] : null);
    $drawer['shows'] = $drawer['state'] === 'shown' ? $shownRid : null;
    $drawer['rule'] = $drawer['state'] === 'shown' ? ($first ? 'ranked first' : 'the one drawing') : null;

    $needs = [];
    $benchState = 'done';
    $isOffered = isset($offered[$prompt]) && $offered[$prompt]['id'] === $sid;
    if ($rerunOf !== null) {
        $benchState = 'blocked';
        $needs[] = 'a rerun of ' . $rerunOf . ' — harvest-rerun.py files it into that item';
    } elseif (!$ok) {
        $benchState = 'blocked';
        $needs[] = 'nothing to rate';
    } elseif ($hidden) {
        $benchState = 'off';
        $needs[] = 'hidden — the bench skips hidden items';
    } elseif (!$isOffered) {
        $benchState = 'blocked';
        $needs[] = 'another turn on this same prompt is the copy the bench offers (most drawings, then newest)';
    } else {
        $incomplete = []; $unranked = [];
        foreach ($ok as $r) {
            if (!$r['complete']) {
                $incomplete[] = $r['rid'] . ' (' . $r['standing']['axes_n'] . '/' . $axisCount . ' axes' .
                    ($r['standing']['grade'] !== null ? '' : ', no grade') . ')';
            }
            if (count($ok) > 1 && !($r['rank'] >= 1)) {
                $unranked[] = $r['rid'];
            }
        }
        if ($incomplete) { $needs[] = 'unrated: ' . implode(', ', $incomplete); }
        if ($unranked) { $needs[] = 'unranked: ' . implode(', ', $unranked); }
        if (!$s['size_class']) { $needs[] = 'no size filed'; }
        if ($s['rerun_requested_at'] !== null) { $needs[] = 'rerun requested'; }
        if ($incomplete || $unranked || !$s['size_class']) { $benchState = 'open'; }
    }

    $title = trim((string) ($s['title'] ?? ''));
    $items[] = [
        'key'            => 'turn:' . $sid,
        'kind'           => 'turn',
        'item_id'        => 'turn:' . $sid,
        'submission_id'  => $sid,
        'title'          => $title !== '' ? $title
            : (mb_strlen($prompt) > 42 ? mb_substr($prompt, 0, 41) . '…' : $prompt),
        'prompt'         => $prompt,
        'created'        => (string) $s['created'],
        'size'           => ['entry' => null, 'filed' => $s['size_class'], 'scale' => null],
        'flags'          => [
            'status'            => (string) $s['status'],
            'client'            => (string) $s['client'],
            'suppressed'        => $suppressed,
            'retire_requested'  => $hidden,
            'rerun_requested'   => $s['rerun_requested_at'] !== null,
            'rerun_of'          => $rerunOf,
            'offered'           => $isOffered,
            // the random per-device code the browser keeps (2026-09-10) —
            // the handle that groups one visitor's turns across days
            'device'            => $s['device_ref'] ?? null,
        ],
        'drawer'         => $drawer,
        // a shown turn's drawer id is its winning generation (data.php)
        'drawer_id'      => $drawer['state'] === 'shown' && $first ? $first['gen_id'] : ($ok ? $ok[0]['gen_id'] : null),
        'bench'          => ['state' => $benchState, 'needs' => $needs, 'served' => count($ok)],
        'responses'      => $responses,
    ];
}

usort($items, fn($a, $b) => strcmp($b['created'], $a['created']) ?: strcmp($a['key'], $b['key']));

$counts = ['curated' => 0, 'turns' => 0, 'shown' => 0, 'hidden' => 0, 'absent' => 0, 'bench_open' => 0];
foreach ($items as $it) {
    $counts[$it['kind'] === 'turn' ? 'turns' : 'curated']++;
    $counts[$it['drawer']['state']]++;
    if ($it['bench']['state'] === 'open') {
        $counts['bench_open']++;
    }
}

jd_json_out(200, [
    'ok'               => true,
    'build'            => jd_build_stamp(),
    'taxonomy_version' => jd_taxonomy_version($taxonomy),
    'axes'             => $axesOut,
    'grades'           => $gradeLabels,
    'counts'           => $counts,
    'items'            => $items,
]);

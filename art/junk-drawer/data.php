<?php
// The Junk Drawer — read-only data endpoint, dataset v2 (PLAN-V2 §5).
//
// The database is the system of record: this reads the jd2_* tables and
// nothing else (no entry.json, no items/ directory, no overlay — the file
// path is retired, owner 2026-10-01). The only file read is taxonomy.json,
// the rubric. The v1 drawer's own endpoint is legacy/data.php.
//
// What is served, per prompt whose visibility is 'live':
//   - the SHOWN RUN: jd2_prompts.shown_run_id when the owner chose one, else
//     the newest run that has a complete filed session;
//   - its drawings that count: status ok, not hidden by the owner;
//   - the session that stands for the run (jd2_display_session: the owner's
//     current session if complete, else the visitor's current session if
//     complete) for each drawing's grade, axes, notes and place, and the
//     run's pair scores;
//   - `primary`: the pinned drawing (pinned_generation_id) when it is among
//     them, else 1st place.
//
// THE ITEM SHAPE IS v1's TURN ITEM, kept on purpose so the front end renders
// it unchanged (Phase 4 evolves the JS): responses ordered by place, rid
// 'r1' = 1st, each pointing at api/jd2-gen-svg.php. Additions: run_id,
// prompt_id, origin, gen_id on each response, and `pairs` — the run's
// comparative scores as {a: rid, b: rid, score (−3..+3, positive = a
// preferred), source: 'direct'|'derived'}. `submission_id` repeats run_id —
// SHIM for the v1 front end, which keys a turn by it.
//
//   ?item=<prompt id>   one item, whatever its visibility (the admin card's
//                       read): a draft or hidden prompt answers too, marked
//                       `hidden: true`, standing on its newest run when no
//                       run is complete yet
//   ?slim=1             the pile and its tags only (_slim.php)
//
// A DATABASE OUTAGE MUST NOT TAKE THE DRAWER DOWN: the manifest then answers
// empty with the taxonomy (the drawer paints its furniture), never a 500.

require_once __DIR__ . '/../../api/jd2-config.php';
require_once __DIR__ . '/../../api/jd-usage.php';

$itemId = isset($_GET['item']) ? (string) $_GET['item'] : null;
$slim = isset($_GET['slim']);
// a slim manifest drops tokens and cost again (_slim.php), so it skips the
// pricing; single-item mode always prices
$priced = !$slim || $itemId !== null;

// ETag: the rubric file, plus what moves when the drawer's contents can —
// a session filed, a drawing made, any prompt's display facts, a drawing
// hidden or shown. A database that cannot answer contributes a fixed word.
$stamp = JD_TAXONOMY_PATH . '|' . @filemtime(JD_TAXONOMY_PATH) . ';';
// jd2_db_or_null(), not jd_db(): an unreachable MySQL must not exit with a
// 500 from inside api/database.php before this file can answer empty.
$db = jd2_db_or_null();
try {
    if ($db === null) {
        throw new RuntimeException('no database handle');
    }
    $s = $db->query("SELECT COUNT(*) AS n, MAX(filed_at) AS m FROM jd2_sessions WHERE status = '" . JD2_SESSION_FILED . "'")
        ->fetch(PDO::FETCH_ASSOC);
    $g = $db->query(
        "SELECT COUNT(*) AS n, SUM(CASE WHEN status = '" . JD2_GEN_OK . "' THEN 1 ELSE 0 END) AS ok,
                SUM(hidden) AS hid, MAX(created) AS m
           FROM jd2_generations"
    )->fetch(PDO::FETCH_ASSOC);
    $hiddenGens = '';
    foreach ($db->query('SELECT id FROM jd2_generations WHERE hidden = 1 ORDER BY id') as $h) {
        $hiddenGens .= $h['id'] . ',';
    }
    $promptFacts = '';
    foreach ($db->query(
        'SELECT id, visibility, title, size_class, size_scale, shown_run_id, pinned_generation_id
           FROM jd2_prompts ORDER BY id'
    ) as $p) {
        $promptFacts .= implode('/', array_map('strval', $p)) . ',';
    }
    $stamp .= 's|' . $s['n'] . '@' . $s['m'] . ';g|' . $g['n'] . '/' . $g['ok'] . '/' . $g['hid'] . '@' . $g['m']
        . ';h|' . md5($hiddenGens) . ';p|' . md5($promptFacts) . ';';
} catch (Throwable $e) {
    error_log('data.php: the jd2 tables could not be read (' . $e->getMessage() . ')');
    $db = null;
    $stamp .= 'db-unavailable;';
}
$etag = '"' . md5($stamp) . '"';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('ETag: ' . $etag);

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit();
}

$taxonomy = jd_taxonomy();
if (!is_array($taxonomy)) {
    http_response_code(500);
    echo json_encode(['error' => 'taxonomy.json missing or unparseable']);
    exit();
}

// --- single-item mode -------------------------------------------------------
if ($itemId !== null) {
    if ($db === null) {
        http_response_code(503);
        echo json_encode(['error' => 'the drawer database is unavailable']);
        exit();
    }
    $item = null;
    try {
        if (jd_is_ulid($itemId)) {
            $q = $db->prepare(jd2_data_prompt_sql() . ' WHERE id = ?');
            $q->execute([$itemId]);
            $prompt = $q->fetch(PDO::FETCH_ASSOC);
            if ($prompt !== false) {
                $item = jd2_data_item($db, $prompt, $taxonomy, true, $priced);
            }
        }
    } catch (Throwable $e) {
        error_log('data.php: item ' . $itemId . ' unavailable (' . $e->getMessage() . ')');
        http_response_code(503);
        echo json_encode(['error' => 'the drawer database is unavailable']);
        exit();
    }
    if ($item === null) {
        http_response_code(404);
        echo json_encode(['error' => 'no such item: ' . $itemId]);
        exit();
    }
    echo json_encode(['taxonomy' => $taxonomy, 'item' => $item]);
    exit();
}

// --- the manifest: live prompts, newest first --------------------------------
$items = [];
if ($db !== null) {
    try {
        $q = $db->query(jd2_data_prompt_sql() . " WHERE visibility = '" . JD2_VIS_LIVE . "' ORDER BY created DESC, id DESC");
        foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $prompt) {
            $item = jd2_data_item($db, $prompt, $taxonomy, false, $priced);
            if ($item !== null) {
                $items[] = $item;
            }
        }
    } catch (Throwable $e) {
        error_log('data.php: manifest unavailable (' . $e->getMessage() . ')');
        $items = [];
    }
}

if ($slim) {
    require_once __DIR__ . '/_slim.php';
    echo json_encode(jd_slim_payload($taxonomy, $items));
    exit();
}

echo json_encode([
    'generated' => gmdate('c'),
    'count' => count($items),
    'taxonomy' => $taxonomy,
    'items' => $items,
    'errors' => [],
]);

// ---------------------------------------------------------------------------

function jd2_data_prompt_sql(): string
{
    return 'SELECT id, text, title, origin, created, size_class, size_scale, visibility,
                   shown_run_id, pinned_generation_id
              FROM jd2_prompts';
}

/**
 * One prompt as a drawer item, or null when it has nothing to show. In the
 * manifest a prompt shows only through a complete run (or the run the owner
 * chose); $itemMode also answers a prompt still being rated, from its
 * newest run.
 */
function jd2_data_item(PDO $db, array $prompt, array $taxonomy, bool $itemMode, bool $priced): ?array
{
    $promptId = (string) $prompt['id'];
    $q = $db->prepare('SELECT id, created FROM jd2_runs WHERE prompt_id = ? ORDER BY created DESC, id DESC');
    $q->execute([$promptId]);
    $runs = $q->fetchAll(PDO::FETCH_ASSOC);
    if ($runs === []) {
        return null;
    }

    $shown = null;
    $gens = [];
    $display = null;
    $idsOf = static fn (array $rows) => array_map(static fn ($g) => (string) $g['id'], $rows);

    // The owner's choice of run stands whether or not it is complete: they
    // chose it. Otherwise the newest run with a complete sitting.
    foreach ($runs as $run) {
        if ($prompt['shown_run_id'] !== null && $run['id'] === $prompt['shown_run_id']) {
            $shown = $run;
            $gens = jd2_run_generations($db, (string) $run['id']);
            $display = jd2_display_session($db, (string) $run['id'], $idsOf($gens), $taxonomy, true);
            break;
        }
    }
    if ($shown === null) {
        foreach ($runs as $run) {
            $g = jd2_run_generations($db, (string) $run['id']);
            $d = $g ? jd2_display_session($db, (string) $run['id'], $idsOf($g), $taxonomy) : null;
            if ($d !== null) {
                [$shown, $gens, $display] = [$run, $g, $d];
                break;
            }
        }
    }
    if ($shown === null) {
        if (!$itemMode) {
            return null;
        }
        $shown = $runs[0];
        $gens = jd2_run_generations($db, (string) $shown['id']);
        $display = jd2_display_session($db, (string) $shown['id'], $idsOf($gens), $taxonomy, true);
    }
    if ($gens === [] && !$itemMode) {
        return null;
    }

    $standing = $display['standing'] ?? ['judgments' => [], 'rankings' => [], 'pairs' => []];
    $liveAxes = jd_live_axes($taxonomy);

    // place order: ranked drawings by place, any unranked after them by slot
    usort($gens, static function ($a, $b) use ($standing) {
        $ra = $standing['rankings'][(string) $a['id']]['rank_pos'] ?? PHP_INT_MAX;
        $rb = $standing['rankings'][(string) $b['id']]['rank_pos'] ?? PHP_INT_MAX;
        return $ra <=> $rb ?: strcmp((string) $a['slot'], (string) $b['slot']);
    });

    $date = substr((string) $shown['created'], 0, 10);
    $responses = [];
    $ridOf = [];
    foreach ($gens as $i => $g) {
        $gid = (string) $g['id'];
        $rid = 'r' . ($i + 1);
        $ridOf[$gid] = $rid;
        $j = $standing['judgments'][$gid] ?? ['grade' => null, 'axes' => [], 'notes' => []];
        // the report card renders a bare rank, or {value, note} when the
        // rater left a remark on that axis; live axes only, as v1's fold
        $annotations = [];
        foreach ($j['axes'] as $axis => $value) {
            if (!isset($liveAxes[$axis])) {
                continue;
            }
            $note = $j['notes'][$axis] ?? null;
            $annotations[$axis] = $note !== null ? ['value' => $value, 'note' => $note] : $value;
        }
        $rank = $standing['rankings'][$gid]['rank_pos'] ?? (count($gens) === 1 ? 1 : null);
        $row = [
            'rid' => $rid,
            'file' => $gid . '.svg',
            'gen_id' => $gid,
            'slot' => (string) $g['slot'],   // the blind letter the run dealt it; jd2-rate names drawings by slot
            'rank' => $rank,
            'model' => (string) $g['model_id'],
            'model_version' => (string) $g['api_model'],
            'date' => $date,
            'generation' => ['mode' => 'one-shot', 'prompt_count' => 1],
            'grade' => $j['grade'],
            'annotations' => (object) $annotations,
            'url' => '/api/jd2-gen-svg.php?gen=' . rawurlencode($gid),
            'transcript_url' => null,
        ];
        if ($priced) {
            // a key only when there is a number for it (v1's drawer items
            // leave the nulls out; jd2-rate's reveal states them)
            $tokens = jd_cost_summary(jd_price_generation_row(
                $g['usage_json'], (string) $g['provider'], (string) $g['api_model']))['tokens'];
            if ($tokens !== null) {
                $row['tokens'] = $tokens;
            }
            if ($g['cost_usd'] !== null) {
                $row['cost_usd'] = round((float) $g['cost_usd'], 6);
            }
        }
        $responses[] = $row;
    }

    $pairs = [];
    foreach ($standing['pairs'] as $p) {
        if (isset($ridOf[$p['gen_a']], $ridOf[$p['gen_b']])) {
            $pairs[] = ['a' => $ridOf[$p['gen_a']], 'b' => $ridOf[$p['gen_b']],
                        'score' => $p['score'], 'source' => $p['source']];
        }
    }

    $pin = $prompt['pinned_generation_id'];
    $item = [
        'schema' => 2,
        'id' => $promptId,
        'submission_id' => (string) $shown['id'],   // SHIM: the v1 front end keys a turn by it
        'run_id' => (string) $shown['id'],
        'prompt_id' => $promptId,
        'title' => jd_turn_title($prompt['title'], (string) $prompt['text']),
        'prompt' => (string) $prompt['text'],
        'created' => substr((string) $prompt['created'], 0, 10),
        // 'm' when the rater never chose a size
        'sizeClass' => $prompt['size_class'] ?: 'm',
    ];
    if ($prompt['size_scale'] !== null && (float) $prompt['size_scale'] !== 1.0) {
        $item['sizeScale'] = (float) $prompt['size_scale'];
    }
    $item += [
        'primary' => ($pin !== null && isset($ridOf[$pin])) ? $ridOf[$pin] : ($responses ? 'r1' : null),
        'fromTurn' => true,
        'origin' => (string) $prompt['origin'],
        'responses' => $responses,
        'pairs' => $pairs,
    ];
    if ($prompt['visibility'] !== JD2_VIS_LIVE) {
        $item['hidden'] = true;
    }
    return $item;
}

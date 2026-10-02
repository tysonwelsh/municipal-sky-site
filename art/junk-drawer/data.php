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
// prompt_id, origin, `display_role` ('owner' | 'visitor': whose sitting the
// item is showing — the admin card refuses to re-file a visitor's; null when
// no sitting is on file), gen_id on each response, and `pairs` — the run's
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
//
// THE READS are a fixed number of set-based queries, however full the drawer
// is (never a query per prompt or per run):
//   1–2. the ETag's movers: filed sessions and generations, two aggregates
//        (jd2_etag_movers)
//   3.   the prompts this answer covers — the live ones, or the ?item= one
//   4–5. their runs, then those runs' generations (jd2_runs_for_prompts)
//        — the ETag is taken here (jd2_etag_reads over 3–5), so a 304 stops
//        before the ratings are read —
//   6.   every one of those runs' current sessions, per role
//        (jd2_current_sessions_for_runs)
//   7–9. those sessions' judgments, rankings and pairs
//        (jd2_standings_for_sessions; 6–9 are jd2_current_with_standings)
// and the fold is PHP: jd2_display_pick applies the reader rules per run.

require_once __DIR__ . '/../../api/jd2-config.php';
require_once __DIR__ . '/../../api/jd-usage.php';

$itemId = isset($_GET['item']) ? (string) $_GET['item'] : null;
$slim = isset($_GET['slim']);
// a slim manifest drops tokens and cost again (_slim.php), so it skips the
// pricing; single-item mode always prices
$priced = !$slim || $itemId !== null;

// --- reads 1–5, and the ETag over them ------------------------------------
// The rubric file, plus what moves when the drawer's contents can — a
// session filed, a drawing made, a prompt's display facts, a run, a drawing
// hidden or shown. A database that cannot answer contributes a fixed word.
$stamp = JD_TAXONOMY_PATH . '|' . @filemtime(JD_TAXONOMY_PATH) . ';';
// jd2_db_or_null(), not jd_db(): an unreachable MySQL must not exit with a
// 500 from inside api/database.php before this file can answer empty.
$db = jd2_db_or_null();
$prompts = [];
$runsByPrompt = [];
try {
    if ($db === null) {
        throw new RuntimeException('no database handle');
    }
    $stamp .= jd2_etag_movers($db);
    if ($itemId !== null) {
        if (jd_is_ulid($itemId)) {
            $q = $db->prepare(jd2_data_prompt_sql() . ' WHERE id = ?');
            $q->execute([$itemId]);
            $prompts = $q->fetchAll(PDO::FETCH_ASSOC);
        }
    } else {
        // the manifest: live prompts, newest first
        $prompts = $db->query(jd2_data_prompt_sql() . " WHERE visibility = '" . JD2_VIS_LIVE . "' ORDER BY created DESC, id DESC")
            ->fetchAll(PDO::FETCH_ASSOC);
    }
    $runsByPrompt = jd2_runs_for_prompts($db, array_column($prompts, 'id'));
    $stamp .= jd2_etag_reads($prompts, $runsByPrompt);
} catch (Throwable $e) {
    error_log('data.php: the jd2 tables could not be read (' . $e->getMessage() . ')');
    $db = null;
    $prompts = [];
    $runsByPrompt = [];
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
        if ($prompts !== []) {
            [$current, $standings] = jd2_current_with_standings($db, jd2_run_ids($runsByPrompt));
            $item = jd2_data_item($prompts[0], $runsByPrompt[(string) $prompts[0]['id']] ?? [], $current, $standings,
                                  $taxonomy, true, $priced);
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
        [$current, $standings] = jd2_current_with_standings($db, jd2_run_ids($runsByPrompt));
        foreach ($prompts as $prompt) {
            $item = jd2_data_item($prompt, $runsByPrompt[(string) $prompt['id']] ?? [], $current, $standings,
                                  $taxonomy, false, $priced);
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
    return 'SELECT id, text, title, origin, created, size_class, size_scale, size_by, tags, visibility,
                   shown_run_id, pinned_generation_id
              FROM jd2_prompts';
}

/**
 * One prompt as a drawer item, or null when it has nothing to show. In the
 * manifest a prompt shows only through a complete run (or the run the owner
 * chose); $itemMode also answers a prompt still being rated, from its
 * newest run. Nothing here queries: the runs, their generations, the current
 * sessions and their standings were read for every prompt at once.
 *
 * @param list<array> $runs  the prompt's runs, newest first (jd2_runs_for_prompts)
 */
function jd2_data_item(array $prompt, array $runs, array $current, array $standings, array $taxonomy,
                       bool $itemMode, bool $priced): ?array
{
    $promptId = (string) $prompt['id'];
    if ($runs === []) {
        return null;
    }

    $shown = null;
    $gens = [];
    $display = null;
    $idsOf = static fn (array $rows) => array_map(static fn ($g) => (string) $g['id'], $rows);
    // a run's drawings that count — ok and not hidden — in slot order
    $countingOf = static fn (array $run) => array_values(array_filter($run['gens'],
        static fn ($g) => $g['status'] === JD2_GEN_OK && (int) $g['hidden'] === 0));
    $displayOf = static fn (array $run, array $g, bool $fallback) => jd2_display_pick(
        $current[(string) $run['id']] ?? [], $standings, $idsOf($g), $taxonomy, $fallback);

    // The owner's choice of run stands whether or not it is complete: they
    // chose it. Otherwise the newest run with a complete sitting.
    foreach ($runs as $run) {
        if ($prompt['shown_run_id'] !== null && $run['id'] === $prompt['shown_run_id']) {
            $shown = $run;
            $gens = $countingOf($run);
            $display = $displayOf($run, $gens, true);
            break;
        }
    }
    if ($shown === null) {
        foreach ($runs as $run) {
            $g = $countingOf($run);
            $d = $g ? $displayOf($run, $g, false) : null;
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
        $gens = $countingOf($shown);
        $display = $displayOf($shown, $gens, true);
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
    // who set the size (model | owner | visitor; null = none, shown as 'm'),
    // and the intake classification {facet: [heading id…]} or null
    $item['size_by'] = $prompt['size_by'];
    $item['tags'] = jd2_tags_decode($prompt['tags']);
    $item += [
        'primary' => ($pin !== null && isset($ridOf[$pin])) ? $ridOf[$pin] : ($responses ? 'r1' : null),
        'fromTurn' => true,
        'origin' => (string) $prompt['origin'],
        // whose sitting stands for the shown run: the owner's or a visitor's
        'display_role' => isset($display['session']['rater_role']) ? (string) $display['session']['rater_role'] : null,
        'responses' => $responses,
        'pairs' => $pairs,
    ];
    if ($prompt['visibility'] !== JD2_VIS_LIVE) {
        $item['hidden'] = true;
    }
    return $item;
}

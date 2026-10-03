<?php
// GET /api/jd2-ledger.php — the curator's overview (dataset v2, PLAN-V2 §5).
// Bench key, no-store. Replaces v1's jd-ledger.php, which read entry files
// and four hide switches; v2 has one prompt row, its runs and their sittings.
//
// One row per prompt, every visibility, newest first. Each row states:
//   · drawer — whether it is in the drawer and, if not, why:
//       shown       live, and a run stands for it (shown_run_id, else the
//                   newest run with a complete display session)
//       hidden      visibility hidden (by the owner or the visitor)
//       draft       not live yet (a complete sitting makes a draft live;
//                   the owner can also set it back to draft)
//       incomplete  live, but no run has a complete display session, so
//                   the drawer skips it
//     with `shows` (the drawing the drawer shows, or would show) and the rule
//     that picked it (jd2_shows: the pin, else 1st place, else first by slot);
//   · bench — `done` when the owner's current sitting on the bench run is
//     complete, `open` when the bench's default backlog lists it, `off` when
//     the bench skips it (hidden, still drawing, nothing survived) — with the
//     plain-words `needs` (jd2_bench_view, the queue's own rule);
//   · every run, newest first, with every drawing (any status), EVERY
//     session filed on it (history, not folded away; `current` marks each
//     role's current one, `complete` is jd2_is_complete over the run's
//     counting drawings today against the cells the sitting's own rubric
//     required — `required_cells`, jd2_session_cells), and `display` — the standing the drawer reads
//     for that run (jd2_display_session with its owner-first fallback, so an
//     incomplete run still shows what is on file; `complete` says which).
//
// Each row also carries the intake facts: size_by, tags, intake_version,
// intake_model, intake_at, intake_cost_usd, the clerk's `reasons`, and
// `fallback` / `intake_error` when intake was tried and failed. The payload
// names the taxonomy's `facets` and `size_tiers` for the page's editors.
//
//   ?prompt=<id>   that one prompt (the batch runner reads a drawing's model,
//                  latency and cost from it)
//
// Prompts ride along (they are the drawer's own text); SVG text does not —
// the page fetches each drawing from jd2-gen-svg.php with the key.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_curator_get();

$taxonomy = jd_taxonomy_required('jd2-ledger');

$only = $_GET['prompt'] ?? null;
if ($only !== null && !jd_is_ulid($only)) {
    jd_fail(400, 'bad_request', 'prompt must be a prompt id.');
}

$axesOut = [];
foreach (jd_live_axes($taxonomy) as $id => $axis) {
    $values = [];
    foreach ($axis['values'] ?? [] as $v) {
        $values[(string) (float) ($v['rank'] ?? 0)] = (string) ($v['label'] ?? '');
    }
    $axesOut[] = ['id' => (string) $id, 'label' => (string) ($axis['label'] ?? $id), 'values' => (object) $values];
}
$gradeLabels = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    $gradeLabels[(string) (float) ($g['rank'] ?? 0)] = (string) ($g['label'] ?? '');
}

try {
    $db = jd_db();
    $sql = 'SELECT id, text, title, origin, created, size_class, size_scale, size_by, visibility, hidden_by,
                   hidden_at, approved_at, shown_run_id, pinned_generation_id, v1_item_id, category, device_ref,
                   tags, intake_version, intake_model, intake_json, intake_cost_usd, intake_at
              FROM jd2_prompts';
    if ($only !== null) {
        $q = $db->prepare($sql . ' WHERE id = ?');
        $q->execute([$only]);
    } else {
        $q = $db->query($sql . ' ORDER BY created DESC, id DESC');
    }
    $prompts = $q->fetchAll(PDO::FETCH_ASSOC);
    if ($only !== null && $prompts === []) {
        jd_fail(404, 'not_found', 'That prompt is not on file.');
    }

    $sessQ = $db->prepare(
        'SELECT id, rater_role, client, blind, taxonomy_version, instrument_version, required_cells, note,
                started_at, filed_at, status
           FROM jd2_sessions WHERE run_id = ? ORDER BY filed_at, id'
    );

    $items = [];
    $counts = ['prompts' => 0, 'live' => 0, 'hidden' => 0, 'draft' => 0, 'bench_open' => 0];
    foreach ($prompts as $p) {
        $runs = jd2_prompt_runs($db, (string) $p['id']);
        $runsOut = [];
        $complete = [];   // run id => display standing, complete runs only
        $displayOf = [];  // run id => display (fallback) or null
        foreach ($runs as $run) {
            $rid = (string) $run['id'];
            $display = jd2_display_session($db, $rid, $run['counting'], $taxonomy, true);
            $displayOf[$rid] = $display;
            if ($display !== null && $display['complete'] && $run['counting'] !== []) {
                $complete[$rid] = $display;
            }
            $current = [];
            foreach (JD2_RATER_ROLE as $role) {
                $c = jd2_current_session($db, $rid, $role);
                if ($c !== null) {
                    $current[(string) $c['id']] = true;
                }
            }
            $sessQ->execute([$rid]);
            $sessions = [];
            foreach ($sessQ->fetchAll(PDO::FETCH_ASSOC) as $s) {
                $sessions[] = [
                    'session_id' => (string) $s['id'],
                    'rater_role' => (string) $s['rater_role'],
                    'client' => (string) $s['client'],
                    'status' => (string) $s['status'],
                    'started_at' => $s['started_at'],
                    'filed_at' => $s['filed_at'],
                    'taxonomy_version' => (int) $s['taxonomy_version'],
                    'instrument_version' => (string) $s['instrument_version'],
                    'blind' => (int) $s['blind'] === 1,
                    'note' => $s['note'],
                    // the cells this sitting had to carry, and complete against them
                    'required_cells' => jd2_session_cells($s, $taxonomy),
                    'complete' => jd2_is_complete(jd2_session_standing($db, (string) $s['id']), $run['counting'],
                        $taxonomy, jd2_session_cells($s, $taxonomy)),
                    'current' => isset($current[(string) $s['id']]),
                ];
            }
            $gens = [];
            foreach ($run['gens'] as $g) {
                $gens[] = [
                    'generation_id' => (string) $g['id'],
                    'slot' => (string) $g['slot'],
                    'model_id' => (string) $g['model_id'],
                    'api_model' => (string) $g['api_model'],
                    'status' => (string) $g['status'],
                    'reject_reason' => $g['reject_reason'],
                    'hidden' => (int) $g['hidden'] === 1,
                    'cost_usd' => $g['cost_usd'] === null ? null : round((float) $g['cost_usd'], 6),
                    'priced' => (int) $g['priced'] === 1,
                    'latency_ms' => $g['latency_ms'] === null ? null : (int) $g['latency_ms'],
                    'created' => (string) $g['created'],
                ];
            }
            $runsOut[] = [
                'run_id' => $rid,
                'kind' => (string) $run['kind'],
                'requested_by' => (string) $run['requested_by'],
                'profile' => (string) $run['profile'],
                'harness' => (string) $run['harness'],
                'pool_version' => (string) $run['pool_version'],
                'status' => (string) $run['status'],
                'settled' => jd2_run_settled($run),
                'created' => (string) $run['created'],
                'generations' => $gens,
                'sessions' => $sessions,
                'display' => jd2l_display($display, $run['gens']),
            ];
        }

        // --- the drawer: data.php's choice of run, then its choice of drawing ---
        $shown = null;
        $runRule = null;
        foreach ($runs as $run) {
            if ($p['shown_run_id'] !== null && $run['id'] === $p['shown_run_id']) {
                [$shown, $runRule] = [$run, 'the run the owner chose'];
                break;
            }
        }
        if ($shown === null) {
            foreach ($runs as $i => $run) {
                if (isset($complete[(string) $run['id']])) {
                    [$shown, $runRule] = [$run, $i === 0 ? 'the newest run' : 'the newest complete run'];
                    break;
                }
            }
        }
        $standing = $shown === null ? null : ($displayOf[(string) $shown['id']]['standing'] ?? null);
        [$shows, $pick] = $shown === null ? [null, null]
            : jd2_shows($p['pinned_generation_id'], $shown['gens'], $standing);

        $vis = (string) $p['visibility'];
        if ($vis === JD2_VIS_HIDDEN) {
            $drawer = ['state' => 'hidden', 'why' => 'hidden by the ' . ($p['hidden_by'] ?? 'owner')
                . ($p['hidden_at'] ? ' on ' . substr((string) $p['hidden_at'], 0, 10) : '') . ' — SHOW puts it back'];
        } elseif ($vis === JD2_VIS_DRAFT) {
            $drawer = ['state' => 'draft', 'why' => $complete
                ? 'a draft with a complete sitting — SHOW makes it live'
                : 'a draft — it goes live when a sitting on it is complete'];
        } elseif ($shown === null) {
            $drawer = ['state' => 'incomplete', 'why' => 'live, but no run has a complete sitting — the drawer skips it until one does'];
        } elseif ($shows === null) {
            $drawer = ['state' => 'incomplete', 'why' => 'the run the owner chose has no drawing left to show'];
        } else {
            $drawer = ['state' => 'shown', 'why' => ''];
        }
        $drawer['shows'] = $shows;
        $drawer['rule'] = $shows === null ? null : $pick . ' · ' . $runRule;
        $drawer['run_id'] = $shown === null ? null : (string) $shown['id'];

        // --- the bench: the queue's own rule ---------------------------------
        $view = jd2_bench_view($db, $p, $runs, $taxonomy);
        $rateable = $view['run'] !== null && $view['settled'] && $view['run']['counting'] !== [];
        $needs = $view['needs'];
        if ($view['complete']) {
            $benchState = 'done';
        } elseif ($vis !== JD2_VIS_HIDDEN && $rateable) {
            $benchState = 'open';
        } else {
            $benchState = 'off';
            if ($vis === JD2_VIS_HIDDEN) {
                array_unshift($needs, 'hidden — the bench skips hidden prompts');
            }
        }

        $f = jd2_intake_fields($p);
        $counts['prompts']++;
        $counts[$vis] = ($counts[$vis] ?? 0) + 1;
        $counts['bench_open'] += $benchState === 'open' ? 1 : 0;

        $items[] = [
            'prompt_id' => (string) $p['id'],
            'title' => jd_turn_title($p['title'], (string) $p['text']),
            'title_filed' => $p['title'],
            'prompt' => (string) $p['text'],
            'created' => (string) $p['created'],
            'origin' => (string) $p['origin'],
            'visibility' => $vis,
            'hidden_by' => $p['hidden_by'],
            'approved_at' => $p['approved_at'],
            'size_class' => $p['size_class'],
            'size_scale' => $p['size_scale'] === null ? null : (float) $p['size_scale'],
            'size_by' => $p['size_by'],
            'tags' => $f['tags'],
            'intake_version' => $f['intake_version'],
            'intake_model' => $f['intake_model'],
            'intake_at' => $f['intake_at'],
            'intake_cost_usd' => $p['intake_cost_usd'] === null ? null : round((float) $p['intake_cost_usd'], 6),
            'reasons' => $f['intake_reasons'],
            'fallback' => $f['intake_fallback'],
            'intake_error' => $f['intake_error'],
            'shown_run_id' => $p['shown_run_id'],
            'pinned_generation_id' => $p['pinned_generation_id'],
            'v1_item_id' => $p['v1_item_id'],
            'category' => $p['category'],
            'device_ref' => $p['device_ref'],
            'drawer' => $drawer,
            'bench' => ['state' => $benchState, 'run_id' => $view['run']['id'] ?? null, 'needs' => $needs],
            'runs' => $runsOut,
        ];
    }
} catch (PDOException $e) {
    error_log('jd2-ledger: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The ledger could not be read.');
}

jd_json_out(200, [
    'ok' => true,
    'build' => jd_build_stamp(),
    'taxonomy_version' => jd_taxonomy_version($taxonomy),
    'instrument_version' => JD2_INSTRUMENT_VERSION,
    'axes' => $axesOut,
    'grades' => (object) $gradeLabels,
    'models' => (object) jd_model_labels($taxonomy),
    // the classification's facets and the size tiers, for the chips and the
    // size select (an edit of either goes through jd2-curate)
    'facets' => jd2_facets($taxonomy),
    'size_tiers' => array_map(static fn ($id, $t) => ['id' => (string) $id, 'label' => (string) ($t['label'] ?? $id)],
        array_keys(jd_size_tiers($taxonomy)), array_values(jd_size_tiers($taxonomy))),
    'counts' => $counts,
    'items' => $items,
]);

// ---------------------------------------------------------------------------

/**
 * A run's display standing, keyed by generation id: grades, axes, notes,
 * ranks and gaps, and the pairs with each side's slot (so the page can carry
 * the standing into a new sitting by slot, as jd2-rate takes it).
 */
function jd2l_display(?array $display, array $gens): ?array
{
    if ($display === null) {
        return null;
    }
    $slotOf = [];
    foreach ($gens as $g) {
        $slotOf[(string) $g['id']] = (string) $g['slot'];
    }
    $st = $display['standing'];
    $grades = [];
    $axes = [];
    $notes = [];
    foreach ($st['judgments'] as $gid => $j) {
        if ($j['grade'] !== null) {
            $grades[$gid] = $j['grade'];
        }
        $axes[$gid] = (object) $j['axes'];
        if ($j['notes']) {
            $notes[$gid] = (object) $j['notes'];
        }
    }
    $ranks = [];
    $gaps = [];
    foreach ($st['rankings'] as $gid => $r) {
        $ranks[$gid] = $r['rank_pos'];
        $gaps[$gid] = $r['gap_after'];
    }
    $pairs = [];
    foreach ($st['pairs'] as $p) {
        $pairs[] = [
            'gen_a' => $p['gen_a'], 'gen_b' => $p['gen_b'],
            'slot_a' => $slotOf[$p['gen_a']] ?? null, 'slot_b' => $slotOf[$p['gen_b']] ?? null,
            'score' => $p['score'], 'source' => $p['source'], 'method' => $p['method'],
            'shown_left' => $p['shown_left'] === null ? null : ($slotOf[(string) $p['shown_left']] ?? null),
        ];
    }
    return [
        'session_id' => (string) $display['session']['id'],
        'rater_role' => (string) $display['session']['rater_role'],
        'complete' => $display['complete'],
        'grades' => (object) $grades,
        'axes' => (object) $axes,
        'notes' => (object) $notes,
        'ranks' => (object) $ranks,
        'gaps' => (object) $gaps,
        'pairs' => $pairs,
    ];
}

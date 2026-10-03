<?php
// GET /api/jd2-queue.php — the bench's backlog (dataset v2, PLAN-V2 §5, §11).
// Bench key, no-store. Replaces v1's jd-bench-queue.php, which joined the
// database to entry.json by position; v2 reads the jd2 tables only.
//
// WHAT IS IN THE BACKLOG. One row per prompt whose bench run — shown_run_id
// when the owner chose one, else the newest run — has no COMPLETE owner
// session (none at all, or the owner's current one is incomplete), newest
// prompt first. A visitor's complete sitting does not close the owner's
// backlog: the campaign is the owner re-rating everything under one
// instrument. Left out of the default backlog, and visible with ?all=1:
//   - prompts the owner or the visitor HID (the bench skips hidden, as v1);
//   - runs still drawing (a dealt slot pending or not yet requested — the
//     batch runner is mid-row): a sitting filed now would go incomplete when
//     the next drawing lands;
//   - runs where no drawing survived (nothing to rate).
//
//   ?prompt=<id>   that one prompt, whatever its state (direct addressing;
//                  a closed prompt comes back with its prefill)
//   ?all=1         every prompt, open or not
//   ?reveal=1      add model_id to each response. THE BENCH IS BLIND by
//                  default: no model identity, and responses in slot order
//                  (the card shuffles the seats itself)
//   ?count=1       only today's spend counter (the batch runner's guard):
//                  {ok, today: {generations, limit, remaining, since}}
//
// Each item also carries the intake facts: tags, size_by, intake_version,
// intake_model, intake_at, the clerk's `reasons`, `fallback` (intake
// failed) and `intake_error` (its code), and `title_on_file` — the heading
// as filed, null when there is none (`title` is what the card prints: that
// heading, else the prompt's first words). The payload carries the
// taxonomy's live `facets` (jd2_facets: id, label, question, min, max,
// headings with their scope notes) for the bench's catalogue entry card. Each response carries the owner's latest sitting as `prefill` (grade, axes,
// rank_pos, gap_after) and the visitor's current sitting as `visitor`; the
// owner's pairs ride on the item as `pairs_prefill` by slot. `needs` says in
// plain words what the owner's sitting still lacks (jd2_needs). `progress`
// counts the whole campaign — every prompt not hidden whose bench run has
// settled — whatever the view, so the bench can say "12 of 40 done"; a
// prompt's cells are counted against what its owner sitting had to carry
// (jd2_session_cells), the live axes when there is none.
//
// THE PREFILL CARRIES ONLY WHAT THE CARD CAN FILE (taxonomy v35, 2026-10-02).
// A value on a defunct axis, or off its axis's current scale (and a grade off
// the grade scale), is dropped from `prefill` rather than carried into the
// new sitting — jd2-rate would refuse it, and a retired axis is never asked
// again. The item then says `prefill_pruned: true`, and the card notes that
// those earlier answers were not carried over. The visitor's sitting
// (`visitor`) is shown, never refiled, so it is passed as filed.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_curator_get();

$taxonomy = jd_taxonomy_required('jd2-queue');

try {
    $db = jd_db();

    if (isset($_GET['count'])) {
        $since = jd_utc_midnight();
        $q = $db->prepare('SELECT COUNT(*) FROM jd2_generations WHERE created >= ?');
        $q->execute([$since]);
        $n = (int) $q->fetchColumn();
        jd_json_out(200, ['ok' => true, 'today' => [
            'generations' => $n,
            'limit' => JD_LIMIT_GLOBAL_DAILY,
            'remaining' => max(0, JD_LIMIT_GLOBAL_DAILY - $n),
            'since' => $since,
            'resets_in_s' => jd_seconds_to_utc_midnight(),
        ]]);
    }

    $only = $_GET['prompt'] ?? null;
    if ($only !== null && !jd_is_ulid($only)) {
        jd_fail(400, 'bad_request', 'prompt must be a prompt id.');
    }
    $all = !empty($_GET['all']);
    $reveal = !empty($_GET['reveal']);

    $sql = 'SELECT id, text, title, origin, created, visibility, size_class, size_scale, size_by,
                   shown_run_id, pinned_generation_id, v1_item_id, category,
                   tags, intake_version, intake_model, intake_json, intake_at
              FROM jd2_prompts';
    // every view reads every prompt: `progress` counts the whole campaign
    // even when ?prompt= asks for one row (the same walk the default view
    // makes), and the loop below keeps only the asked-for prompt's item
    $q = $db->query($sql . ' ORDER BY created DESC, id DESC');
    $prompts = $q->fetchAll(PDO::FETCH_ASSOC);
    if ($only !== null && !in_array($only, array_column($prompts, 'id'), true)) {
        jd_fail(404, 'not_found', 'That prompt is not on file.');
    }

    $items = [];
    $progress = ['prompts' => 0, 'complete' => 0, 'drawing' => 0, 'cells_filed' => 0, 'cells_total' => 0];

    foreach ($prompts as $p) {
        $runs = jd2_prompt_runs($db, (string) $p['id']);
        $view = jd2_bench_view($db, $p, $runs, $taxonomy);
        $run = $view['run'];
        $hidden = $p['visibility'] === JD2_VIS_HIDDEN;
        $rateable = $run !== null && $view['settled'] && $run['counting'] !== [];

        // the campaign's progress: every prompt not hidden whose bench run settled
        if (!$hidden && $run !== null) {
            if (!$view['settled']) {
                $progress['drawing']++;
            } elseif ($rateable) {
                $progress['prompts']++;
                $progress['complete'] += $view['complete'] ? 1 : 0;
                $required = $view['cells'];   // the owner sitting's own cells, else the live axes
                $progress['cells_total'] += count($run['counting']) * count($required);
                foreach ($run['counting'] as $gid) {
                    $j = $view['standing']['judgments'][$gid] ?? null;
                    if ($j !== null) {
                        $progress['cells_filed'] += ($j['grade'] !== null ? 1 : 0) + count(array_intersect(
                            array_map('strval', array_keys($j['axes'])), $required));
                    }
                }
            }
        }

        $open = !$hidden && $rateable && !$view['complete'];
        if ($only !== null ? (string) $p['id'] !== $only : (!$all && !$open)) {
            continue;
        }
        $items[] = jd2q_item($db, $p, $runs, $view, $reveal, $taxonomy);
    }
} catch (PDOException $e) {
    error_log('jd2-queue: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The queue could not be read.');
}

// --- the rubric, as the bench draws it (v1's queue shapes) -----------------
// live axes in taxonomy order, each with its values BEST FIRST: the bench
// binds number keys to position in this list, never to the rank value
$axes = [];
foreach (jd_live_axes($taxonomy) as $id => $axis) {
    $values = [];
    foreach ($axis['values'] ?? [] as $v) {
        $values[] = ['rank' => (int) ($v['rank'] ?? 0), 'label' => (string) ($v['label'] ?? ''),
                     'description' => (string) ($v['description'] ?? '')];
    }
    usort($values, fn ($a, $b) => $b['rank'] <=> $a['rank']);
    $axes[] = ['id' => (string) $id, 'label' => (string) ($axis['label'] ?? $id),
               'description' => (string) ($axis['description'] ?? ''), 'values' => $values];
}
$grades = [];
foreach ($taxonomy['grades'] ?? [] as $g) {
    $grades[] = ['rank' => (int) ($g['rank'] ?? 0), 'label' => (string) ($g['label'] ?? '')];
}
usort($grades, fn ($a, $b) => $b['rank'] <=> $a['rank']);
$sizeTiers = [];
foreach (jd_size_tiers($taxonomy) as $id => $s) {
    $sizeTiers[] = ['id' => (string) $id, 'label' => (string) ($s['label'] ?? $id),
                    'description' => (string) ($s['description'] ?? ''), 'box' => $s['box'] ?? null];
}

jd_json_out(200, [
    'ok' => true,
    'build' => jd_build_stamp(),
    'taxonomy_version' => jd_taxonomy_version($taxonomy),
    'instrument_version' => JD2_INSTRUMENT_VERSION,
    'axes' => $axes,
    'grades' => $grades,
    'size_tiers' => $sizeTiers,
    // the classification's facets and their headings (scope notes included),
    // for the catalogue entry card that closes a bench sitting
    'facets' => jd2_facets($taxonomy),
    'comparison' => $taxonomy['comparison'] ?? null,
    'gaps' => $taxonomy['gaps'] ?? null,
    // id => label, for the unveil; the payload's one list of names, which the
    // bench reads only after a sitting is filed
    'models' => (object) jd_model_labels($taxonomy),
    'items' => $items,
    'progress' => $progress,
]);

// ---------------------------------------------------------------------------

/** One backlog row: the prompt, its bench run's drawings with both prefills, and what is missing. */
function jd2q_item(PDO $db, array $p, array $runs, array $view, bool $reveal, array $taxonomy): array
{
    $run = $view['run'];
    $owner = $view['standing'];
    $visitorSession = $run === null ? null : jd2_current_session($db, (string) $run['id'], JD2_ROLE_VISITOR);
    $visitor = $visitorSession === null ? null : jd2_session_standing($db, (string) $visitorSession['id']);

    $responses = [];
    $slotOf = [];
    $pruned = false;
    $scales = ['axes' => jd_axis_ranks($taxonomy), 'grade' => jd_grade_ranks($taxonomy)];
    foreach ($run['gens'] ?? [] as $g) {
        if ($g['status'] !== JD2_GEN_OK) {
            continue;   // a failed or rejected slot has nothing to seat
        }
        $gid = (string) $g['id'];
        $slotOf[$gid] = (string) $g['slot'];
        $r = [
            'generation_id' => $gid,
            'slot' => (string) $g['slot'],
        ];
        if ($reveal) {
            $r['model_id'] = (string) $g['model_id'];
        }
        $r += [
            'svg_url' => '/api/jd2-gen-svg.php?gen=' . rawurlencode($gid),
            'hidden' => (int) $g['hidden'] === 1,
            'prefill' => jd2q_prune(jd2q_cells($owner, $gid, true), $scales, $pruned),
            'visitor' => jd2q_cells($visitor, $gid, false),
        ];
        $responses[] = $r;
    }

    $pairs = [];
    foreach ($owner['pairs'] ?? [] as $pr) {
        if (isset($slotOf[$pr['gen_a']], $slotOf[$pr['gen_b']])) {
            $pairs[] = ['slot_a' => $slotOf[$pr['gen_a']], 'slot_b' => $slotOf[$pr['gen_b']],
                        'score' => $pr['score'], 'source' => $pr['source']];
        }
    }

    return [
        'prompt_id' => (string) $p['id'],
        'run_id' => $run === null ? null : (string) $run['id'],
        'title' => jd_turn_title($p['title'], (string) $p['text']),
        'title_on_file' => ($p['title'] === null || trim((string) $p['title']) === '') ? null : (string) $p['title'],
        'prompt' => (string) $p['text'],
        'created' => (string) $p['created'],
        'origin' => (string) $p['origin'],
        'visibility' => (string) $p['visibility'],
        'size_class' => $p['size_class'],
        'category' => $p['category'],
    ] + jd2_q_intake($p) + [
        'runs' => count($runs),
        'settled' => $view['settled'],
        'responses' => $responses,
        'pairs_prefill' => $pairs,
        // true when a prefill value sat on a retired axis or off its current
        // scale and was left out (jd2q_prune)
        'prefill_pruned' => $pruned,
        'complete' => $view['complete'],
        'needs' => $view['needs'],
    ];
}

/**
 * The intake facts (jd2_intake_fields): tags, size_by, intake_version,
 * intake_model, intake_at, the reasons from intake_json as `reasons`,
 * `fallback` (intake was tried and failed) and `intake_error` (its code).
 */
function jd2_q_intake(array $p): array
{
    $f = jd2_intake_fields($p);
    return ['size_by' => $f['size_by'], 'tags' => $f['tags'], 'intake_version' => $f['intake_version'],
            'intake_model' => $f['intake_model'], 'intake_at' => $f['intake_at'],
            'reasons' => $f['intake_reasons'], 'fallback' => $f['intake_fallback'],
            'intake_error' => $f['intake_error']];
}

/**
 * The owner's prefill, cut to what a sitting filed NOW can carry: an axis
 * value only on a live axis and on its current scale, a grade only on the
 * grade scale. Sets $pruned when anything was dropped. Places and gaps are
 * not on a taxonomy scale and pass as they are.
 *
 * @param array{axes:array<string,float[]>,grade:float[]} $scales  jd_axis_ranks, jd_grade_ranks
 */
function jd2q_prune(?array $cells, array $scales, bool &$pruned): ?array
{
    if ($cells === null) {
        return null;
    }
    $keep = [];
    foreach ((array) $cells['axes'] as $axis => $value) {
        $on = isset($scales['axes'][(string) $axis]) ? jd_rank_on_scale($value, $scales['axes'][(string) $axis]) : null;
        if ($on === null) {
            $pruned = true;
            continue;
        }
        $keep[(string) $axis] = $value;
    }
    $cells['axes'] = (object) $keep;
    if ($cells['grade'] !== null && jd_rank_on_scale($cells['grade'], $scales['grade']) === null) {
        $cells['grade'] = null;
        $pruned = true;
    }
    return $cells;
}

/** One drawing's cells in a standing: {grade, axes{}, rank_pos[, gap_after]}, or null when the sitting has none. */
function jd2q_cells(?array $standing, string $gid, bool $withGap): ?array
{
    if ($standing === null) {
        return null;
    }
    $j = $standing['judgments'][$gid] ?? null;
    $rk = $standing['rankings'][$gid] ?? null;
    if ($j === null && $rk === null) {
        return null;
    }
    $out = [
        'grade' => $j['grade'] ?? null,
        'axes' => (object) ($j['axes'] ?? []),
        'rank_pos' => $rk['rank_pos'] ?? null,
    ];
    if ($withGap) {
        $out['gap_after'] = $rk['gap_after'] ?? null;
    }
    return $out;
}

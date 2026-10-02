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
// Each response carries the owner's latest sitting as `prefill` (grade, axes,
// rank_pos, gap_after) and the visitor's current sitting as `visitor`; the
// owner's pairs ride on the item as `pairs_prefill` by slot. `needs` says in
// plain words what the owner's sitting still lacks (jd2_needs). `progress`
// counts the whole campaign — every prompt not hidden whose bench run has
// settled — whatever the view, so the bench can say "12 of 40 done".

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

    $sql = 'SELECT id, text, title, origin, created, visibility, size_class, size_scale,
                   shown_run_id, pinned_generation_id, v1_item_id, category
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

    $required = jd2_required_cells($taxonomy);
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
        if ($only === null && !$all && !$open) {
            continue;
        }
        $items[] = jd2q_item($db, $p, $runs, $view, $reveal);
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
function jd2q_item(PDO $db, array $p, array $runs, array $view, bool $reveal): array
{
    $run = $view['run'];
    $owner = $view['standing'];
    $visitorSession = $run === null ? null : jd2_current_session($db, (string) $run['id'], JD2_ROLE_VISITOR);
    $visitor = $visitorSession === null ? null : jd2_session_standing($db, (string) $visitorSession['id']);

    $responses = [];
    $slotOf = [];
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
            'prefill' => jd2q_cells($owner, $gid, true),
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
        'prompt' => (string) $p['text'],
        'created' => (string) $p['created'],
        'origin' => (string) $p['origin'],
        'visibility' => (string) $p['visibility'],
        'size_class' => $p['size_class'],
        'category' => $p['category'],
        'runs' => count($runs),
        'settled' => $view['settled'],
        'responses' => $responses,
        'pairs_prefill' => $pairs,
        'complete' => $view['complete'],
        'needs' => $view['needs'],
    ];
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

<?php
// POST /api/jd2-curate.php — the owner's standing decisions about a prompt
// and its drawings (dataset v2, PLAN-V2 §3, §5). Bench key.
//
// v1 had four hide switches with different meanings and a harvest to change
// which drawing showed. v2 has columns, and this is the one writer of them:
//
//   { prompt_id,                         the prompt; then any of —
//     visibility?: 'live'|'hidden'|'draft',   THE display switch; hidden stamps
//                                        hidden_by 'owner' and hidden_at, any
//                                        other value clears both
//     shown_run_id?: <run id> | null,    which run the drawer shows; null =
//                                        the newest run with a complete sitting
//     pinned_generation_id?: <gen id> | null,  which drawing the drawer shows;
//                                        null = the current sitting's 1st place
//     title?: string | null, size_class?: <sizeTiers id> | null,
//     size_scale?: number | null,        the fine dial on the tier; null = 1
//     category?: string | null }         the owner's prompt-set category, a
//                                        free word ≤ 32 chars (the CSV batch
//                                        runner's column); null clears it
//
//   { generation_id, hidden: bool }      drop one drawing from the card (or put
//                                        it back) without touching its run;
//                                        prompt_id optional, and must match
//
// Only the keys present are touched. Ownership is checked, never assumed: a
// shown run must be one of the prompt's runs, a pin one of its runs' drawings.
// Nothing here deletes anything.
//
// Response: { ok, build, prompt: {...}, runs: [ {id, kind, requested_by,
// profile, status, created, generations: [...], sessions: [...],
// display_session_id, complete} ] } — the prompt's standing, as the drawer
// would read it. `build` is the tooling fingerprint (jd_build_stamp()['build']),
// as v1's writers answered it, for the bench's stale-deploy check.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';   // the build the answer names

jd_curator_post();

$body = jd_read_json_body();
$taxonomy = jd_taxonomy_required('jd2-curate');

$promptId = $body['prompt_id'] ?? null;
$generationId = $body['generation_id'] ?? null;
if ($promptId !== null && !jd_is_ulid($promptId)) {
    jd_fail(400, 'bad_request', 'prompt_id must be a prompt id.');
}
if ($generationId !== null && !jd_is_ulid($generationId)) {
    jd_fail(400, 'bad_request', 'generation_id must be a generation id.');
}
if ($promptId === null && $generationId === null) {
    jd_fail(400, 'bad_request', 'A prompt_id or a generation_id is required.');
}

// --- Validate every field BEFORE writing, so a bad request changes nothing --
$sets = [];
$vals = [];
if (array_key_exists('visibility', $body)) {
    $v = $body['visibility'];
    if (!is_string($v) || !in_array($v, JD2_VISIBILITY, true)) {
        jd_fail(400, 'bad_request', 'visibility must be one of: ' . implode(', ', JD2_VISIBILITY) . '.');
    }
    $hidden = $v === JD2_VIS_HIDDEN;
    array_push($sets, 'visibility = ?', 'hidden_by = ?', 'hidden_at = ?');
    array_push($vals, $v, $hidden ? JD2_ROLE_OWNER : null, $hidden ? jd_now() : null);
}
$shownRun = array_key_exists('shown_run_id', $body) ? ['id' => $body['shown_run_id']] : null;
if ($shownRun !== null && $shownRun['id'] !== null && !jd_is_ulid($shownRun['id'])) {
    jd_fail(400, 'bad_request', 'shown_run_id must be a run id or null.');
}
$pin = array_key_exists('pinned_generation_id', $body) ? ['id' => $body['pinned_generation_id']] : null;
if ($pin !== null && $pin['id'] !== null && !jd_is_ulid($pin['id'])) {
    jd_fail(400, 'bad_request', 'pinned_generation_id must be a generation id or null.');
}
if (array_key_exists('title', $body)) {
    $t = $body['title'];
    if ($t !== null && !is_string($t)) {
        jd_fail(400, 'bad_request', 'title must be a string or null.');
    }
    $t = $t === null ? null : trim($t);
    $sets[] = 'title = ?';
    $vals[] = ($t === null || $t === '') ? null : mb_substr($t, 0, 80);
}
if (array_key_exists('size_class', $body)) {
    $sc = $body['size_class'];
    if ($sc !== null && (!is_string($sc) || !isset(jd_size_tiers($taxonomy)[$sc]))) {
        jd_fail(400, 'bad_request', 'size_class must be a taxonomy size tier or null.');
    }
    $sets[] = 'size_class = ?';
    $vals[] = $sc;
}
if (array_key_exists('size_scale', $body)) {
    $ss = $body['size_scale'];
    // a positive multiplier on the tier, inside what DECIMAL(6,3) holds
    if ($ss !== null && (!(is_int($ss) || is_float($ss)) || $ss <= 0 || $ss > 100)) {
        jd_fail(400, 'bad_request', 'size_scale must be a number above 0 and at most 100, or null.');
    }
    $sets[] = 'size_scale = ?';
    $vals[] = $ss === null ? null : round((float) $ss, 3);
}
if (array_key_exists('category', $body)) {
    $cat = $body['category'];
    if ($cat !== null && !is_string($cat)) {
        jd_fail(400, 'bad_request', 'category must be a string or null.');
    }
    $cat = $cat === null ? null : trim($cat);
    if ($cat !== null && mb_strlen($cat) > 32) {
        jd_fail(400, 'bad_request', 'category is at most 32 characters.');
    }
    $sets[] = 'category = ?';
    $vals[] = ($cat === null || $cat === '') ? null : $cat;
}
$hideGen = null;
if ($generationId !== null) {
    if (!array_key_exists('hidden', $body) || !is_bool($body['hidden'])) {
        jd_fail(400, 'bad_request', 'hidden must be true or false.');
    }
    $hideGen = $body['hidden'] ? 1 : 0;
}
if ($generationId === null && !$sets && $shownRun === null && $pin === null) {
    jd_fail(400, 'bad_request', 'Nothing to file.');
}

try {
    $db = jd_db();

    // --- Ownership ------------------------------------------------------------
    if ($generationId !== null) {
        $q = $db->prepare(
            'SELECT r.prompt_id FROM jd2_generations g JOIN jd2_runs r ON r.id = g.run_id WHERE g.id = ?'
        );
        $q->execute([$generationId]);
        $owner = $q->fetchColumn();
        if ($owner === false) {
            jd_fail(404, 'not_found', 'That drawing is not on file.');
        }
        if ($promptId !== null && $owner !== $promptId) {
            jd_fail(400, 'bad_request', 'That drawing does not belong to that prompt.');
        }
        $promptId = (string) $owner;
    }
    $q = $db->prepare('SELECT id FROM jd2_prompts WHERE id = ?');
    $q->execute([$promptId]);
    if ($q->fetchColumn() === false) {
        jd_fail(404, 'not_found', 'That prompt is not on file.');
    }
    if ($shownRun !== null) {
        if ($shownRun['id'] !== null) {
            $q = $db->prepare('SELECT 1 FROM jd2_runs WHERE id = ? AND prompt_id = ?');
            $q->execute([$shownRun['id'], $promptId]);
            if ($q->fetchColumn() === false) {
                jd_fail(400, 'bad_request', 'That run does not belong to that prompt.');
            }
        }
        $sets[] = 'shown_run_id = ?';
        $vals[] = $shownRun['id'];
    }
    if ($pin !== null) {
        if ($pin['id'] !== null) {
            $q = $db->prepare(
                'SELECT 1 FROM jd2_generations g JOIN jd2_runs r ON r.id = g.run_id WHERE g.id = ? AND r.prompt_id = ?'
            );
            $q->execute([$pin['id'], $promptId]);
            if ($q->fetchColumn() === false) {
                jd_fail(400, 'bad_request', 'That drawing does not belong to that prompt.');
            }
        }
        $sets[] = 'pinned_generation_id = ?';
        $vals[] = $pin['id'];
    }

    // --- Write, in one transaction --------------------------------------------
    $db->beginTransaction();
    try {
        if ($sets) {
            $db->prepare('UPDATE jd2_prompts SET ' . implode(', ', $sets) . ' WHERE id = ?')
               ->execute(array_merge($vals, [$promptId]));
        }
        if ($hideGen !== null) {
            $db->prepare('UPDATE jd2_generations SET hidden = ? WHERE id = ?')->execute([$hideGen, $generationId]);
        }
        $db->commit();
    } catch (PDOException $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }

    jd_json_out(200, ['ok' => true, 'build' => jd_build_stamp()['build']] + jd2_prompt_standing($db, $promptId, $taxonomy));
} catch (PDOException $e) {
    error_log('jd2-curate: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The decision could not be filed.');
}

// ---------------------------------------------------------------------------

/**
 * The prompt's standing: its row, and per run (newest first) the drawings,
 * every session filed on it (history visible, not folded away), and the
 * session the drawer would stand on (jd2_display_session).
 */
function jd2_prompt_standing(PDO $db, string $promptId, array $taxonomy): array
{
    $q = $db->prepare(
        'SELECT id, text, title, origin, created, size_class, size_scale, visibility, hidden_by,
                hidden_at, shown_run_id, pinned_generation_id, v1_item_id, category
           FROM jd2_prompts WHERE id = ?'
    );
    $q->execute([$promptId]);
    $prompt = $q->fetch(PDO::FETCH_ASSOC);
    $prompt['size_scale'] = $prompt['size_scale'] === null ? null : (float) $prompt['size_scale'];

    $q = $db->prepare(
        'SELECT id, kind, requested_by, profile, harness, pool_version, status, created
           FROM jd2_runs WHERE prompt_id = ? ORDER BY created DESC, id DESC'
    );
    $q->execute([$promptId]);
    $runs = [];
    foreach ($q->fetchAll(PDO::FETCH_ASSOC) as $run) {
        $gens = [];
        $counting = [];
        foreach (jd2_run_generations($db, (string) $run['id'], false) as $g) {
            $gens[] = ['id' => $g['id'], 'slot' => $g['slot'], 'model_id' => $g['model_id'],
                       'status' => $g['status'], 'hidden' => (int) $g['hidden'] === 1];
            if ($g['status'] === JD2_GEN_OK && (int) $g['hidden'] === 0) {
                $counting[] = (string) $g['id'];
            }
        }
        $s = $db->prepare(
            'SELECT id, rater_role, client, blind, taxonomy_version, instrument_version, filed_at, status
               FROM jd2_sessions WHERE run_id = ? ORDER BY filed_at, id'
        );
        $s->execute([$run['id']]);
        $display = jd2_display_session($db, (string) $run['id'], $counting, $taxonomy);
        $run['generations'] = $gens;
        $run['sessions'] = $s->fetchAll(PDO::FETCH_ASSOC);
        $run['display_session_id'] = $display['session']['id'] ?? null;
        $run['complete'] = $display !== null;
        $runs[] = $run;
    }
    return ['prompt' => $prompt, 'runs' => $runs];
}

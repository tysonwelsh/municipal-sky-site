<?php
// POST /api/jd2-intake.php — the intake clerk files a prompt in the catalogue:
// its heading (the tag title), its size tier and its faceted classification,
// in ONE structured-output call, written onto the prompt row (dataset v2,
// PLAN-INTAKE; replaces jd2-title.php, 2026-10-02).
//
// Two callers:
//   visitor  {client_ref, prompt}   the turn card fires it during the darkroom
//            wait, in parallel with the slot requests, as it fired the titler.
//            ABUSE GUARD (the titler's): it answers only for a real, current
//            turn — a jd2 prompt filed under that client_ref in the last hour
//            (403 no_turn otherwise; the card retries once, since the first
//            slot request files the row). The prompt read is the STORED one:
//            the prompt of record, whatever the request re-posts.
//   owner    {prompt_id} + the bench key — the bench's NEW PROMPT and the CSV
//            batch runner, once the run's first drawing has filed the row.
//
// The call is api/jd2-intake-prompt.php's jd2_intake_answer(): the rendered
// system prompt, the visitor's prompt as the one user turn inside a labelled
// block, the taxonomy's schema as structured output (claude-sonnet-5-5,
// taxonomy.json utility.intake; effort low; max_tokens 1024). In dev
// (JD_DEV_MODE) the deterministic mock answers instead, intake_model 'mock'.
//
// WHAT IT WRITES on jd2_prompts, in one UPDATE guarded by intake_at IS NULL
// (so two racing calls file once):
//   title            only when the row has none — a title the owner filed
//                    (NEW PROMPT, the CSV) is never replaced
//   size_class, size_by = 'model'   unless size_by is 'owner': the owner's
//                    size is never overwritten by the model
//   tags             only when the row has none (an owner edit stands)
//   intake_version, intake_model, intake_json (the answer verbatim, usage,
//   stop_reason, the key SLOT's name), intake_cost_usd (priced at write
//   time against jd-prices.json), intake_at
//
// IDEMPOTENT: a prompt that already has intake_at answers its stored facts
// (`stored: true`) without calling the model.
//
// A MISSING INTAKE NEVER HOLDS UP A TURN. On any failure of the call — a
// provider error, a timeout, a refusal or other stop_reason, an answer that
// fails the checks — it answers 200 {ok: true, title: <the prompt's first
// 41 characters + …, jd_turn_title's fallback>, size_class: null, tags: null,
// fallback: true} and writes only intake_json (the error, so the failure
// shows on the ledger); intake_at stays NULL and a later call tries again.
// The visitor's card then shows the size card as before; the bench's
// catalogue entry opens with no tier and no headings, for the owner to make.
//
// Response: {ok, title, size_class, size_by, tags, reasons, intake_version,
// prompt_id[, stored][, fallback]}.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd2-intake-prompt.php';

jd_require_allowed_origin();
jd_require_post();
jd_no_store();

$body = jd_read_json_body();
$taxonomy = jd_taxonomy_required('jd2-intake');
// both checked in dev too, so a taxonomy that lost them fails the tests, not production
$clerk = jd2_utility_model($taxonomy, 'intake');
$version = jd2_intake_version($taxonomy);

$promptId = $body['prompt_id'] ?? null;
$clientRef = $body['client_ref'] ?? null;

try {
    $db = jd_db();
    $cols = 'id, text, title, origin, size_class, size_by, tags, intake_version, intake_model, intake_json, intake_at';
    if ($promptId !== null) {
        // the owner's path: the bench key, any prompt
        jd2_require_bench_key();
        if (!jd_is_ulid($promptId)) {
            jd_fail(400, 'bad_request', 'prompt_id must be a prompt id.');
        }
        $q = $db->prepare("SELECT $cols FROM jd2_prompts WHERE id = ?");
        $q->execute([$promptId]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            jd_fail(404, 'not_found', 'That prompt is not on file.');
        }
    } else {
        // the visitor's path: a real turn, filed in the last hour
        if (!is_string($clientRef) || !preg_match('/^[0-9a-fA-F-]{8,64}$/', $clientRef)) {
            jd_fail(400, 'bad_request', 'A client_ref (or, with the bench key, a prompt_id) is required.');
        }
        $posted = $body['prompt'] ?? null;
        if ($posted !== null && (!is_string($posted) || mb_strlen($posted) > JD_PROMPT_MAX_CHARS)) {
            jd_fail(400, 'bad_request', 'The prompt is at most ' . JD_PROMPT_MAX_CHARS . ' characters.');
        }
        $q = $db->prepare("SELECT $cols FROM jd2_prompts WHERE client_ref = ? AND created >= ? LIMIT 1");
        $q->execute([$clientRef, gmdate('Y-m-d H:i:s', time() - 3600)]);
        $row = $q->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            jd_fail(403, 'no_turn', 'No current turn matches that reference.');
        }
    }
} catch (PDOException $e) {
    error_log('jd2-intake: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The prompt could not be read.');
}

$id = (string) $row['id'];
$text = (string) $row['text'];

// --- already filed: the stored facts, no call ----------------------------------
if ($row['intake_at'] !== null) {
    jd2i_answer($row, ['stored' => true]);
}

// --- the call -------------------------------------------------------------------
@set_time_limit(JD2_INTAKE_TIMEOUT + 30);
$res = jd2_intake_answer($taxonomy, $text, JD_DEV_MODE);
$now = jd_now();
$record = $res['record'] + ['at' => $now];

try {
    if (!$res['ok']) {
        // only the error is filed (a prompt intake already answered keeps its answer)
        error_log('jd2-intake: prompt ' . $id . ' fell back (' . ($res['error'] ?? 'failed') . ')');
        $db->prepare('UPDATE jd2_prompts SET intake_json = ? WHERE id = ? AND intake_at IS NULL')
           ->execute([jd2i_json($record), $id]);
        jd_json_out(200, [
            'ok' => true,
            'prompt_id' => $id,
            'title' => jd_turn_title(null, $text),
            'size_class' => null,
            'size_by' => $row['size_by'],
            'tags' => null,
            'reasons' => null,
            'intake_version' => $version,
            'fallback' => true,
        ]);
    }

    $cost = $res['cost_usd'] === null ? null : round((float) $res['cost_usd'], 6);
    $q = $db->prepare(
        "UPDATE jd2_prompts
            SET title = CASE WHEN title IS NULL OR title = '' THEN ? ELSE title END,
                size_class = CASE WHEN size_by = 'owner' THEN size_class ELSE ? END,
                size_by = CASE WHEN size_by = 'owner' THEN size_by ELSE 'model' END,
                tags = CASE WHEN tags IS NULL OR tags = '' THEN ? ELSE tags END,
                intake_version = ?, intake_model = ?, intake_json = ?, intake_cost_usd = ?, intake_at = ?
          WHERE id = ? AND intake_at IS NULL"
    );
    $q->execute([
        mb_substr((string) $res['title'], 0, 80), $res['size'], json_encode($res['tags']),
        $version, $res['model'], jd2i_json($record), $cost, $now, $id,
    ]);
    // read back: what the row says now (the owner's title or size, if any, stand)
    $q = $db->prepare('SELECT id, text, title, origin, size_class, size_by, tags, intake_version, intake_model, intake_json, intake_at
                         FROM jd2_prompts WHERE id = ?');
    $q->execute([$id]);
    $after = $q->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('jd2-intake: ' . $e->getMessage());
    // the answer exists but could not be filed: the card still gets a title, never a held turn
    jd_json_out(200, ['ok' => true, 'prompt_id' => $id, 'title' => jd_turn_title(null, $text), 'size_class' => null,
                      'size_by' => $row['size_by'], 'tags' => null, 'reasons' => null, 'intake_version' => $version,
                      'fallback' => true]);
}
jd2i_answer($after);

// ---------------------------------------------------------------------------

/** The answer from a row as it stands; never returns. */
function jd2i_answer(array $row, array $extra = []): void
{
    $f = jd2_intake_fields($row);
    jd_json_out(200, [
        'ok' => true,
        'prompt_id' => (string) $row['id'],
        'title' => jd_turn_title($row['title'], (string) $row['text']),
        'size_class' => $row['size_class'],
        'size_by' => $row['size_by'],
        'tags' => $f['tags'],
        'reasons' => $f['intake_reasons'],
        'intake_version' => $row['intake_version'],
    ] + $extra);
}

function jd2i_json(array $record): string
{
    return (string) json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
}

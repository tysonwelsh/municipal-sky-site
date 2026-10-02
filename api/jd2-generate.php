<?php
// POST /api/jd2-generate.php — one model's SVG for one slot of a run
// (dataset v2, PLAN-V2 §3, §5, §11). v1's jd-generate.php, re-pointed at the
// jd2 tables: same race-safe filing, same provider layer, same sanitizer,
// same blindness.
//
// A turn fires this once per dealt slot, in parallel, with one shared
// client_ref. The first request for a client_ref files the PROMPT and its
// first RUN together (one transaction, so a sibling that loses the race
// finds both); the run's DEAL — which model sits in which slot — is drawn
// once, there, and stored. Every slot request then fills its own generation
// with the model the deal assigned. No model identity appears in any answer
// from this file: the reveal exists only in jd2-rate.php.
//
// Request (visitor):
//   { client_ref: <UUID>, slot: 'a'.., prompt, client, consent: {version},
//     device_ref?: <UUID>, website: '' (honeypot) }
// With the bench key (the owner), also:
//   { profile?: 'bench'|'web' }        default 'bench' — owner runs are the
//                                      benchmark condition (owner, 2026-10-01)
//   { rerun_of: <prompt_id> }          a NEW run of an existing prompt; no new
//                                      prompt row; prompt text is the stored one
//   { run_id: <run id> }               fill a slot of an existing run
// and no consent (the owner is not sending a stranger's words anywhere).
//
// RERUNS AND CONVERGENCE. A prompt's client_ref is UNIQUE, which is what lets
// four parallel requests converge on one prompt and its initial run. A rerun
// files no prompt row, and jd2_runs has no client_ref, so a rerun converges
// by its id instead: the first slot request (rerun_of, no run_id) creates the
// run and answers its run_id; the remaining slots send rerun_of + run_id and
// join it. A rerun request WITHOUT run_id always makes a new run.
//
// Response: { ok, svg, gen_id, slot, run_id, prompt_id, submission_id }.
// submission_id repeats run_id: SHIM for the unchanged v1 turn card
// (jd-turn.js reads res.submission_id) until Phase 4 reads run_id.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-provider.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-svg-sanitizer.php';
require_once __DIR__ . '/jd-usage.php';
if (JD_DEV_MODE) {
    require_once __DIR__ . '/jd-mock-provider.php';
}

jd_require_allowed_origin();
jd_require_post();

// --- 1. Parse and shape-check ---------------------------------------------
$body = jd_read_json_body();

// owner or visitor: decided by the bench key being presented and right (a
// wrong one is a 403 here, never a demotion)
$rater = jd2_rater();
$isOwner = $rater['role'] === JD2_ROLE_OWNER;

$clientRef = $body['client_ref'] ?? null;
if (!is_string($clientRef) || !preg_match(JD_UUID_RE, $clientRef)) {
    jd2_fail(400, 'bad_request', 'A client_ref in UUID form is required.');
}

$deviceRef = $body['device_ref'] ?? null;
if (!is_string($deviceRef) || !preg_match(JD_UUID_RE, $deviceRef)) {
    $deviceRef = null;
}

// Shape only: which letters exist is the run's deal, checked once it is loaded.
$slot = $body['slot'] ?? null;
if (!is_string($slot) || !preg_match('/^[a-z]$/', $slot)) {
    jd2_fail(400, 'bad_request', 'slot must be a single letter a–z.');
}

// --- 2. Honeypot: no row written, no provider called ----------------------
$honeypot = $body['website'] ?? '';
if (!is_string($honeypot) || $honeypot !== '') {
    jd2_fail(400, 'bad_request', 'The request could not be accepted.', ['slot' => $slot]);
}

// --- 3. The owner's extras ------------------------------------------------
$rerunOf = $body['rerun_of'] ?? null;
$joinRunId = $body['run_id'] ?? null;
$profileIn = $body['profile'] ?? null;
if (!$isOwner && ($rerunOf !== null || $joinRunId !== null || $profileIn !== null)) {
    jd2_fail(403, 'forbidden', 'profile, rerun_of and run_id need the bench key.', ['slot' => $slot]);
}
if ($rerunOf !== null && !jd_is_ulid($rerunOf)) {
    jd2_fail(400, 'bad_request', 'rerun_of must be a prompt id.', ['slot' => $slot]);
}
if ($joinRunId !== null && !jd_is_ulid($joinRunId)) {
    jd2_fail(400, 'bad_request', 'run_id must be a run id.', ['slot' => $slot]);
}
// A new run's effort profile. Visitors are always on 'web'; the owner's runs
// default to 'bench' — every model at its vendor's top documented setting.
// A slot that joins an existing run uses THAT run's profile, whatever is sent.
$profile = $isOwner ? ($profileIn ?? 'bench') : 'web';
if (!in_array($profile, JD2_PROFILE, true)) {
    jd2_fail(400, 'bad_request', 'profile must be one of: ' . implode(', ', JD2_PROFILE) . '.', ['slot' => $slot]);
}

// --- 4. Prompt: validated on the trimmed text, stored byte-exact ----------
// A rerun or a join draws the STORED prompt; only a new prompt needs one.
$prompt = $body['prompt'] ?? null;
$needsPrompt = $rerunOf === null && $joinRunId === null;
if ($needsPrompt) {
    if (!is_string($prompt)) {
        jd2_fail(400, 'prompt_invalid', 'A prompt is required.', ['slot' => $slot]);
    }
    $trimmedLength = mb_strlen(trim($prompt));
    if ($trimmedLength < 1 || $trimmedLength > JD_PROMPT_MAX_CHARS) {
        jd2_fail(400, 'prompt_invalid', 'The prompt must be 1 to ' . JD_PROMPT_MAX_CHARS . ' characters.', ['slot' => $slot]);
    }
}

// --- 5. Consent (APP §4.5) — a visitor's consent of record -----------------
// The owner path needs none: the owner is the one sending the words.
if (!$isOwner && ($body['consent']['version'] ?? null) !== JD_CONSENT_VERSION) {
    jd2_fail(400, 'consent_required', 'Consent to send the prompt to the AI providers is required.', ['slot' => $slot]);
}

$client = jd_normalize_client($body['client'] ?? null);

$taxonomy = jd_taxonomy_required('jd2-generate');

$runId = null;
$promptId = null;
$generationId = null;

try {
    $db = jd_db();

    // --- 6. Resolve the run (race-safe) --------------------------------------
    if ($joinRunId !== null) {
        $run = jd2_load_run($db, $joinRunId);
        if ($run === null || ($rerunOf !== null && $run['prompt_id'] !== $rerunOf)) {
            jd2_fail(404, 'not_found', 'That run is not on file for that prompt.', ['slot' => $slot]);
        }
    } elseif ($rerunOf !== null) {
        $source = jd2_load_prompt($db, $rerunOf);
        if ($source === null) {
            jd2_fail(404, 'not_found', 'That prompt is not on file.', ['slot' => $slot]);
        }
        $limited = jd2_rate_limit_failure($db, null);
        if ($limited !== null) {
            jd2_fail($limited['status'], $limited['code'], $limited['message'],
                ['slot' => $slot, 'prompt_id' => $rerunOf, 'retry_after' => $limited['retry_after']]);
        }
        $newRunId = jd2_insert_run($db, $rerunOf, 'rerun', JD2_ROLE_OWNER, $profile, $taxonomy);
        $run = jd2_load_run($db, $newRunId);
    } else {
        $run = jd2_load_initial_run_by_ref($db, $clientRef);
        if ($run === null) {
            // --- 7. Rate limits — only when a new prompt is being filed ----
            // The slot requests race: a racer that trips a limit RE-LOADS
            // before failing, so a request whose sibling already filed the
            // turn joins it (v1, 2026-08-15: a lone 429 mid-turn otherwise).
            $limited = jd2_rate_limit_failure($db, $isOwner ? null : $rater['hash']);
            if ($limited !== null) {
                $run = jd2_load_initial_run_by_ref($db, $clientRef);
                if ($run === null) {
                    jd2_fail($limited['status'], $limited['code'], $limited['message'],
                        ['slot' => $slot, 'retry_after' => $limited['retry_after']]);
                }
            }
        }
        if ($run === null) {
            jd2_file_prompt_and_run($db, [
                'client_ref' => $clientRef,
                'text' => $prompt,
                'origin' => $rater['role'],
                'visitor_hash' => $isOwner ? null : $rater['hash'],
                'device_ref' => $isOwner ? null : $deviceRef,
                'consent_version' => $isOwner ? null : JD_CONSENT_VERSION,
            ], $profile, $taxonomy);
            // The loser of the race had its INSERT ignored; both read back
            // the one prompt (and its run) the unique key let through.
            $run = jd2_load_initial_run_by_ref($db, $clientRef);
            if ($run === null) {
                jd2_fail(500, 'server_error', 'The turn could not be filed.', ['slot' => $slot]);
            }
        }
        // A visitor never draws into the owner's prompt, even holding its ref.
        if (!$isOwner && $run['origin'] !== JD2_ROLE_VISITOR) {
            jd2_fail(403, 'forbidden', 'That turn is not yours to draw.', ['slot' => $slot]);
        }
    }

    $runId = (string) $run['id'];
    $promptId = (string) $run['prompt_id'];
    $ctx = ['run_id' => $runId, 'prompt_id' => $promptId, 'slot' => $slot];

    // The stored prompt is the prompt of record: every slot is sent exactly
    // the text the prompt row froze, whatever a later caller re-posted.
    $prompt = (string) $run['text'];
    $profile = (string) $run['profile'];
    if ($profile === 'bench') {
        // a bench call may take JD_BENCH_TIMEOUT on the wire; give PHP the same
        @set_time_limit(JD_BENCH_TIMEOUT + 60);
    }

    // --- 8. The slot is checked against the deal, not a fixed list ---------
    $deal = jd2_deal_decode($run['deal']);
    if (!isset($deal[$slot])) {
        jd2_fail(400, 'bad_request', 'slot must be one of: ' . implode(', ', array_keys($deal)) . '.', $ctx);
    }

    // --- 9. Slot idempotency ------------------------------------------------
    $existing = jd2_load_generation($db, $runId, $slot);
    if ($existing !== null) {
        jd2_respond_for_generation($existing, $ctx);
    }

    // --- 10. Model routing + pending row before the provider call ----------
    // The model is the deal's; its wire string and provider come from the
    // taxonomy registry (not the active pool), so a run dealt before a pool
    // edit still draws the models it was dealt.
    $modelId = $deal[$slot];
    $entry = jd_model_registry($taxonomy)[$modelId] ?? [];
    $provider = (string) ($entry['provider'] ?? '');
    $apiModel = (string) ($entry['api_model'] ?? '');
    if ($provider === '' || $apiModel === '' || !isset(JD_EFFORT['web'][$provider])) {
        error_log('jd2-generate: dealt model ' . $modelId . ' has no provider/api_model in taxonomy.json');
        jd2_fail(500, 'server_error', 'The drawer is not configured to draw right now.', $ctx);
    }
    if (!JD_DEV_MODE && jd_provider_key($provider) === null) {
        // Refuse before a row exists rather than bank a failure that can never be retried.
        error_log('jd2-generate: no API key configured for provider ' . $provider);
        jd2_fail(500, 'server_error', 'The drawer is not configured to draw right now.', $ctx);
    }

    $generationId = jd_ulid();
    $insert = $db->prepare(
        jd_insert_ignore($db) . ' jd2_generations
            (id, run_id, slot, model_id, api_model, provider, params, status,
             disobedience, priced, hidden, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)'
    );
    $insert->execute([
        $generationId, $runId, $slot, $modelId, $apiModel, $provider,
        jd_provider_params($provider, $profile), JD2_GEN_PENDING, jd_now(),
    ]);
    if ($insert->rowCount() === 0) {
        // A concurrent retry of the same slot claimed it first.
        $existing = jd2_load_generation($db, $runId, $slot);
        if ($existing !== null) {
            jd2_respond_for_generation($existing, $ctx);
        }
        jd2_fail(500, 'server_error', 'The generation could not be recorded.', $ctx);
    }
    $ctx['gen_id'] = $generationId;

    $started = microtime(true);
    $result = JD_DEV_MODE
        ? jd_mock_call($provider, $prompt)
        : jd_provider_call($provider, $apiModel, $prompt, $profile);
    $latencyMs = (int) round((microtime(true) - $started) * 1000);

    $usage = !empty($result['usage']) && is_array($result['usage']) ? $result['usage'] : null;
    $settle = ['latency_ms' => $latencyMs, 'usage' => $usage, 'provider' => $provider, 'api_model' => $apiModel];

    // --- 11. Provider or transport failure ----------------------------------
    if (empty($result['ok'])) {
        $failureText = (string) ($result['raw'] ?? '');
        if ($failureText === '') {
            $failureText = (string) ($result['error'] ?? '');
        }
        jd2_finish_generation($db, $generationId, $runId, $settle + [
            'status' => JD2_GEN_FAILED, 'raw_response' => $failureText,
        ]);
        jd2_fail(502, 'provider_failed', 'The machine did not answer.', $ctx);
    }

    // raw_response is kept the moment the provider answers, before any verdict.
    $raw = (string) ($result['raw'] ?? '');

    // --- 12. Extraction -----------------------------------------------------
    $extracted = jd_extract_svg($raw);
    if ($extracted === null) {
        jd2_finish_generation($db, $generationId, $runId, $settle + [
            'status' => JD2_GEN_REJECTED, 'reject_reason' => 'no_svg_found', 'raw_response' => $raw,
        ]);
        jd2_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', $ctx);
    }

    // Fences, prose, apologies: gradeable disobedience, so it is data.
    $disobedience = trim($raw) !== $extracted ? 1 : 0;

    // --- 13. Sanitize -------------------------------------------------------
    $verdict = jd_sanitize_svg($extracted);
    if (empty($verdict['ok'])) {
        // The reject_reason is stored but never returned — it would aid probing.
        jd2_finish_generation($db, $generationId, $runId, $settle + [
            'status' => JD2_GEN_REJECTED, 'reject_reason' => $verdict['reason'],
            'raw_response' => $raw, 'disobedience' => $disobedience,
        ]);
        jd2_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', $ctx);
    }

    // --- 14. Success --------------------------------------------------------
    jd2_finish_generation($db, $generationId, $runId, $settle + [
        'status' => JD2_GEN_OK, 'raw_response' => $raw, 'svg' => $verdict['svg'],
        'disobedience' => $disobedience,
    ]);

    jd_json_out(200, [
        'ok' => true,
        'svg' => $verdict['svg'],
        'gen_id' => $generationId,
        'slot' => $slot,
        'run_id' => $runId,
        'prompt_id' => $promptId,
        'submission_id' => $runId,   // SHIM: the v1 turn card reads submission_id (Phase 4 drops it)
    ]);
} catch (PDOException $e) {
    error_log('jd2-generate database error: ' . $e->getMessage());
    jd2_fail(500, 'server_error', 'The drawer could not be reached.', [
        'run_id' => $runId, 'prompt_id' => $promptId, 'gen_id' => $generationId, 'slot' => $slot,
    ]);
}

// ---------------------------------------------------------------------------

/** The prompt row (id, text, origin, visibility), or null. */
function jd2_load_prompt(PDO $db, string $promptId): ?array
{
    $q = $db->prepare('SELECT id, text, origin, visibility FROM jd2_prompts WHERE id = ?');
    $q->execute([$promptId]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/** A run with its prompt's text and origin, or null. */
function jd2_load_run(PDO $db, string $runId): ?array
{
    $q = $db->prepare(
        'SELECT r.id, r.prompt_id, r.kind, r.profile, r.deal, r.status, p.text, p.origin
           FROM jd2_runs r JOIN jd2_prompts p ON p.id = r.prompt_id
          WHERE r.id = ?'
    );
    $q->execute([$runId]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/** The initial run of the prompt filed under $clientRef (with its text and origin), or null. */
function jd2_load_initial_run_by_ref(PDO $db, string $clientRef): ?array
{
    $q = $db->prepare(
        "SELECT r.id, r.prompt_id, r.kind, r.profile, r.deal, r.status, p.text, p.origin
           FROM jd2_prompts p JOIN jd2_runs r ON r.prompt_id = p.id
          WHERE p.client_ref = ? AND r.kind = 'initial'
          ORDER BY r.id LIMIT 1"
    );
    $q->execute([$clientRef]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

/**
 * Insert a run with a freshly drawn deal; returns its id. The deal is drawn
 * here and only here, so a run's seating is decided exactly once.
 */
function jd2_insert_run(PDO $db, string $promptId, string $kind, string $requestedBy, string $profile, array $taxonomy): string
{
    $runId = jd_ulid();
    $db->prepare(
        'INSERT INTO jd2_runs
            (id, prompt_id, kind, requested_by, profile, harness, pool_version, deal, status, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $runId, $promptId, $kind, $requestedBy, $profile, jd_harness($profile),
        jd2_pool_version($taxonomy), json_encode(jd2_deal(jd2_pool($taxonomy))),
        JD2_RUN_PENDING, jd_now(),
    ]);
    return $runId;
}

/**
 * File a new prompt and its initial run in ONE transaction. The prompt's
 * UNIQUE client_ref is the serialization point: a racing sibling's INSERT
 * waits on the winner's uncommitted row (InnoDB's duplicate-key lock; the
 * SQLite write lock in dev), is then ignored, and by the time it returns the
 * winner's prompt AND run are committed together — so no reader ever sees a
 * prompt without its run, and only the winner draws a deal.
 */
function jd2_file_prompt_and_run(PDO $db, array $p, string $profile, array $taxonomy): void
{
    // validate the pool before any row is written: a misconfigured pool is a
    // 500 with nothing filed
    jd2_pool($taxonomy);
    jd2_pool_version($taxonomy);

    $promptId = jd_ulid();
    $now = jd_now();
    $db->beginTransaction();
    try {
        $insert = $db->prepare(
            jd_insert_ignore($db) . ' jd2_prompts
                (id, text, origin, created, visibility, visitor_hash, device_ref,
                 consent_version, consent_at, client_ref)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $insert->execute([
            $promptId, $p['text'], $p['origin'], $now, JD2_VIS_DRAFT,
            $p['visitor_hash'], $p['device_ref'], $p['consent_version'],
            $p['consent_version'] === null ? null : $now, $p['client_ref'],
        ]);
        if ($insert->rowCount() === 1) {
            jd2_insert_run($db, $promptId, 'initial', $p['origin'], $profile, $taxonomy);
        }
        $db->commit();
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

function jd2_load_generation(PDO $db, string $runId, string $slot): ?array
{
    $q = $db->prepare('SELECT id, status, svg FROM jd2_generations WHERE run_id = ? AND slot = ?');
    $q->execute([$runId, $slot]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

// A retried request for a slot is free, and a settled slot re-answers its
// stored verdict (v1 C1.2 step 8). No re-generation: a failed slot stays failed.
function jd2_respond_for_generation(array $generation, array $ctx): void
{
    $ctx['gen_id'] = $generation['id'];
    if ($generation['status'] === JD2_GEN_OK) {
        jd_json_out(200, [
            'ok' => true,
            'svg' => (string) $generation['svg'],
            'gen_id' => $generation['id'],
            'slot' => $ctx['slot'],
            'run_id' => $ctx['run_id'],
            'prompt_id' => $ctx['prompt_id'],
            'submission_id' => $ctx['run_id'],   // SHIM, as in the main answer
        ]);
    }
    if ($generation['status'] === JD2_GEN_PENDING) {
        jd2_fail(409, 'slot_in_progress', 'This slot is already being drawn.', $ctx);
    }
    if ($generation['status'] === JD2_GEN_REJECTED) {
        jd2_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', $ctx);
    }
    jd2_fail(502, 'provider_failed', 'The machine did not answer.', $ctx);
}

// The limits, as DATA (null = may proceed) so the caller can re-check for a
// sibling-filed turn before answering. Cutoffs are computed in PHP and bound,
// so the same SQL runs on MySQL and SQLite. The per-visitor caps count the
// visitor's prompts (v1 counted submissions — the same unit, a turn); the
// owner ($visitorHash null) meets only the global breaker, as v1's owner did.
function jd2_rate_limit_failure(PDO $db, ?string $visitorHash): ?array
{
    $midnight = jd_utc_midnight();

    if ($visitorHash !== null) {
        $hourly = $db->prepare('SELECT COUNT(*) FROM jd2_prompts WHERE visitor_hash = ? AND created >= ?');
        $hourly->execute([$visitorHash, gmdate('Y-m-d H:i:s', time() - 3600)]);
        if ((int) $hourly->fetchColumn() >= JD_LIMIT_HOURLY) {
            return ['status' => 429, 'code' => 'rate_limited',
                    'message' => 'That is enough turns for one hour.', 'retry_after' => 3600];
        }
        $daily = $db->prepare('SELECT COUNT(*) FROM jd2_prompts WHERE visitor_hash = ? AND created >= ?');
        $daily->execute([$visitorHash, $midnight]);
        if ((int) $daily->fetchColumn() >= JD_LIMIT_DAILY) {
            return ['status' => 429, 'code' => 'rate_limited',
                    'message' => 'That is enough turns for one day.', 'retry_after' => jd_seconds_to_utc_midnight()];
        }
    }

    // The global breaker counts DRAWINGS since UTC midnight, pending ones
    // included (in-flight generations occupy the day's budget), whoever
    // asked for them — the owner included (owner call, 2026-10-01).
    $global = $db->prepare('SELECT COUNT(*) FROM jd2_generations WHERE created >= ?');
    $global->execute([$midnight]);
    if ((int) $global->fetchColumn() >= JD_LIMIT_GLOBAL_DAILY) {
        return ['status' => 503, 'code' => 'drawer_resting',
                'message' => 'The drawer is resting — come back tomorrow.',
                'retry_after' => jd_seconds_to_utc_midnight()];
    }
    return null;
}

/**
 * Settle a pending generation, priced on the day (PLAN-V2 §3: prices move,
 * an eval record says what it cost when it was drawn), then settle the run
 * once every dealt slot has. Through jd_db_retry() because this is the first
 * write after the provider call and the connection may not have survived it
 * (jd-config.php C6.2); every write is guarded on the state it leaves, which
 * is what makes the replay safe.
 */
function jd2_finish_generation(PDO $db, string $generationId, string $runId, array $f): void
{
    // Priced from the provider's own usage object whenever there is one —
    // a rejected drawing was still paid for. No usage: cost NULL, priced 0,
    // never a confident $0.
    $cost = jd_generation_cost($f['provider'], $f['api_model'], $f['usage']);
    $costUsd = $cost['cost_usd'] === null ? null : round($cost['cost_usd'], 6);

    jd_db_retry(function (PDO $db) use ($generationId, $runId, $f, $costUsd, $cost): void {
        $db->prepare(
            'UPDATE jd2_generations
                SET status = ?, reject_reason = ?, raw_response = ?, svg = ?,
                    disobedience = ?, latency_ms = ?, usage_json = ?, cost_usd = ?, priced = ?
              WHERE id = ? AND status = ?'
        )->execute([
            $f['status'],
            $f['reject_reason'] ?? null,
            $f['raw_response'] ?? null,
            $f['svg'] ?? null,
            (int) ($f['disobedience'] ?? 0),
            $f['latency_ms'] ?? null,
            $f['usage'] === null ? null : json_encode($f['usage']),
            $costUsd,
            ($cost['priced'] && $costUsd !== null) ? 1 : 0,
            $generationId,
            JD2_GEN_PENDING,
        ]);

        // The run settles when every dealt slot has: 'generated' if any
        // drawing survived, 'failed' if none did. Two last slots may both see
        // the run whole; the pending guard makes the second a no-op.
        $run = $db->prepare('SELECT deal FROM jd2_runs WHERE id = ?');
        $run->execute([$runId]);
        $dealt = count(jd2_deal_decode($run->fetchColumn()));
        $q = $db->prepare(
            "SELECT COUNT(*) AS settled, SUM(CASE WHEN status = '" . JD2_GEN_OK . "' THEN 1 ELSE 0 END) AS ok
               FROM jd2_generations WHERE run_id = ? AND status <> '" . JD2_GEN_PENDING . "'"
        );
        $q->execute([$runId]);
        $n = $q->fetch(PDO::FETCH_ASSOC);
        if ($dealt > 0 && (int) $n['settled'] >= $dealt) {
            $db->prepare('UPDATE jd2_runs SET status = ? WHERE id = ? AND status = ?')->execute([
                (int) $n['ok'] > 0 ? JD2_RUN_GENERATED : JD2_RUN_FAILED, $runId, JD2_RUN_PENDING,
            ]);
        }
    }, $db);
}

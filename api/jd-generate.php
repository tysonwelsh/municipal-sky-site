<?php
// POST /api/jd-generate.php — one model's SVG for one visitor prompt.
// Contract: PLAN-USER-PROMPTS-CONTRACTS.md C1.2, C4.
//
// The client fires this four times in parallel (slots a, b, c, d) with one
// shared client_ref. The submission row — not the request — is the
// rate-limit unit, and the unique key on client_ref is what makes the
// callers converge on it. No model identity appears in any response from
// this file: blindness is server-enforced, and the reveal exists only in
// jd-rate.php.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-svg-sanitizer.php';
require_once __DIR__ . '/visitor-hash.php';
if (JD_DEV_MODE) {
    require_once __DIR__ . '/jd-mock-provider.php';
}

jd_require_allowed_origin();
jd_require_post();

// --- 1. Parse and shape-check ---------------------------------------------
$body = jd_read_json_body();

$clientRef = $body['client_ref'] ?? null;
if (!is_string($clientRef)
    || !preg_match('/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/', $clientRef)) {
    jd_fail(400, 'bad_request', 'A client_ref in UUID form is required.');
}

$slot = $body['slot'] ?? null;
if ($slot !== 'a' && $slot !== 'b' && $slot !== 'c' && $slot !== 'd') {
    jd_fail(400, 'bad_request', 'slot must be "a", "b", "c" or "d".');
}

// --- 2. Honeypot: no row written, no provider called ----------------------
$honeypot = $body['website'] ?? '';
if (!is_string($honeypot) || $honeypot !== '') {
    jd_fail(400, 'bad_request', 'The request could not be accepted.', ['slot' => $slot]);
}

// --- 3. Prompt: validated on the trimmed text, stored byte-exact ----------
$prompt = $body['prompt'] ?? null;
if (!is_string($prompt)) {
    jd_fail(400, 'prompt_invalid', 'A prompt is required.', ['slot' => $slot]);
}
$trimmedLength = mb_strlen(trim($prompt));
if ($trimmedLength < 1 || $trimmedLength > JD_PROMPT_MAX_CHARS) {
    jd_fail(400, 'prompt_invalid', 'The prompt must be 1 to ' . JD_PROMPT_MAX_CHARS . ' characters.', ['slot' => $slot]);
}

// --- 4. Consent (APP §4.5) — the recorded consent of record ---------------
$consentVersion = $body['consent']['version'] ?? null;
if ($consentVersion !== JD_CONSENT_VERSION) {
    jd_fail(400, 'consent_required', 'Consent to send the prompt to the AI providers is required.', ['slot' => $slot]);
}

// --- 5. Client: declared, never sniffed -----------------------------------
$client = jd_normalize_client($body['client'] ?? null);

$db = null;
$submissionId = null;
$generationId = null;

try {
    $db = jd_db();
    $visitorHash = msky_visitor_hash(jd_secrets());

    // --- 6. Submission resolve (race-safe) --------------------------------
    $submission = jd_load_submission_by_ref($db, $clientRef);

    if ($submission === null) {
        // --- 7. Rate limits — only when a new submission is being created --
        // The four slot requests race: each can load "no submission" before
        // any sibling's INSERT lands and then run this check against a count
        // a sibling is moving under it. A racer that trips the limit RE-LOADS
        // before failing — if a sibling created the submission in the
        // meantime, this request belongs to a turn that was legal when it
        // started and joins it; only a turn no sibling managed to start is
        // refused. (2026-08-15: without the re-load, whichever slot counted
        // last after a boundary crossing ate a lone 429 mid-turn — observed
        // live as one chair failing rate_limited while its three siblings
        // drew.)
        $limited = jd_rate_limit_failure($db, $visitorHash);
        if ($limited !== null) {
            $submission = jd_load_submission_by_ref($db, $clientRef);
            if ($submission === null) {
                jd_fail($limited['status'], $limited['code'], $limited['message'], [
                    'slot' => $slot,
                    'retry_after' => $limited['retry_after'],
                ]);
            }
        }
    }

    if ($submission === null) {
        $insert = $db->prepare(
            jd_insert_ignore($db) . ' jd_submissions
                (id, client_ref, created, prompt, visitor_hash, client, pair_order,
                 ai_consent_at, ai_consent_version, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $now = jd_now();
        $insert->execute([
            jd_ulid(),
            $clientRef,
            $now,
            $prompt,
            $visitorHash,
            $client,
            random_int(0, 23),
            $now,
            JD_CONSENT_VERSION,
            'pending',
        ]);

        // The loser of the parallel-slot race had its INSERT ignored; both
        // callers read back the one row the unique key allowed through.
        $submission = jd_load_submission_by_ref($db, $clientRef);
        if ($submission === null) {
            jd_fail(500, 'server_error', 'The submission could not be created.', ['slot' => $slot]);
        }
    }

    $submissionId = $submission['id'];

    // The stored prompt is the prompt of record: every slot is sent exactly
    // the text the submission froze, whatever a later caller re-posted.
    $prompt = (string) $submission['prompt'];

    // --- 8. Slot idempotency ---------------------------------------------
    $existing = jd_load_generation($db, $submissionId, $slot);
    if ($existing !== null) {
        jd_respond_for_generation($existing, $submissionId, $slot);
    }

    // --- 9. Model routing + pending row before the provider call ----------
    $perm = JD_DRAW_PERMS[(int) $submission['pair_order'] % 24];
    $slotIndex = array_search($slot, ['a', 'b', 'c', 'd'], true);
    $model = JD_MODEL_POOL[$perm[$slotIndex]];

    if (!JD_DEV_MODE && jd_provider_key($model['provider']) === null) {
        // Refuse before a row exists rather than bank a failure the visitor
        // can never retry (C1.2 step 8: a failed slot stays failed).
        error_log('jd-generate: no API key configured for provider ' . $model['provider']);
        jd_fail(500, 'server_error', 'The drawer is not configured to draw right now.', [
            'submission_id' => $submissionId,
            'slot' => $slot,
        ]);
    }

    $generationId = jd_ulid();
    $params = jd_provider_params($model['provider']);

    $insertGeneration = $db->prepare(
        jd_insert_ignore($db) . ' jd_generations
            (id, submission_id, slot, model_id, model_version, provider, harness,
             params, status, disobedience, created)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertGeneration->execute([
        $generationId,
        $submissionId,
        $slot,
        $model['model_id'],
        $model['api_model'],
        $model['provider'],
        JD_HARNESS,
        $params,
        'pending',
        0,
        jd_now(),
    ]);

    if ($insertGeneration->rowCount() === 0) {
        // A concurrent retry of the same slot claimed it first.
        $existing = jd_load_generation($db, $submissionId, $slot);
        if ($existing !== null) {
            jd_respond_for_generation($existing, $submissionId, $slot);
        }
        jd_fail(500, 'server_error', 'The generation could not be recorded.', [
            'submission_id' => $submissionId,
            'slot' => $slot,
        ]);
    }

    $started = microtime(true);
    $result = JD_DEV_MODE
        ? jd_mock_call($model['provider'], $prompt)
        : jd_provider_call($model['provider'], $model['api_model'], $prompt);
    $latencyMs = (int) round((microtime(true) - $started) * 1000);

    $usage = !empty($result['usage']) ? json_encode($result['usage']) : null;

    // --- 12. Provider or transport failure --------------------------------
    if (empty($result['ok'])) {
        // The provider's body when there is one, otherwise the transport
        // error: a failed slot is a first-class result and must stay legible.
        $failureText = (string) ($result['raw'] ?? '');
        if ($failureText === '') {
            $failureText = (string) ($result['error'] ?? '');
        }
        jd_finish_generation($db, $generationId, [
            'status' => 'failed',
            'raw_response' => $failureText,
            'latency_ms' => $latencyMs,
            'usage_tokens' => $usage,
        ]);
        jd_fail(502, 'provider_failed', 'The machine did not answer.', [
            'submission_id' => $submissionId,
            'gen_id' => $generationId,
            'slot' => $slot,
        ]);
    }

    // raw_response is kept the moment the provider answers, before any verdict.
    $raw = (string) ($result['raw'] ?? '');

    // --- 10. Extraction ----------------------------------------------------
    $extracted = jd_extract_svg($raw);
    if ($extracted === null) {
        jd_finish_generation($db, $generationId, [
            'status' => 'rejected',
            'reject_reason' => 'no_svg_found',
            'raw_response' => $raw,
            'latency_ms' => $latencyMs,
            'usage_tokens' => $usage,
        ]);
        jd_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', [
            'submission_id' => $submissionId,
            'gen_id' => $generationId,
            'slot' => $slot,
        ]);
    }

    // Fences, prose, apologies: gradeable disobedience, so it is data.
    $disobedience = trim($raw) !== $extracted ? 1 : 0;

    // --- 11. Sanitize ------------------------------------------------------
    $verdict = jd_sanitize_svg($extracted);
    if (empty($verdict['ok'])) {
        // The reject_reason is stored but never returned — it would aid probing.
        jd_finish_generation($db, $generationId, [
            'status' => 'rejected',
            'reject_reason' => $verdict['reason'],
            'raw_response' => $raw,
            'disobedience' => $disobedience,
            'latency_ms' => $latencyMs,
            'usage_tokens' => $usage,
        ]);
        jd_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', [
            'submission_id' => $submissionId,
            'gen_id' => $generationId,
            'slot' => $slot,
        ]);
    }

    // --- 13. Success -------------------------------------------------------
    jd_finish_generation($db, $generationId, [
        'status' => 'ok',
        'raw_response' => $raw,
        'svg' => $verdict['svg'],
        'disobedience' => $disobedience,
        'latency_ms' => $latencyMs,
        'usage_tokens' => $usage,
    ]);

    // Idempotent, and never a downgrade from 'rated'. Also post-provider, so it
    // takes the same reconnect path as the settle above.
    jd_db_retry(function (PDO $db) use ($submissionId): void {
        $db->prepare("UPDATE jd_submissions SET status = 'generated' WHERE id = ? AND status = 'pending'")
           ->execute([$submissionId]);
    }, $db);

    jd_json_out(200, [
        'ok' => true,
        'submission_id' => $submissionId,
        'gen_id' => $generationId,
        'slot' => $slot,
        'svg' => $verdict['svg'],
    ]);
} catch (PDOException $e) {
    error_log('jd-generate database error: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The drawer could not be reached.', [
        'submission_id' => $submissionId,
        'gen_id' => $generationId,
        'slot' => $slot,
    ]);
}

// ---------------------------------------------------------------------------

function jd_load_submission_by_ref(PDO $db, string $clientRef): ?array
{
    $stmt = $db->prepare('SELECT id, prompt, visitor_hash, pair_order, status FROM jd_submissions WHERE client_ref = ?');
    $stmt->execute([$clientRef]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

function jd_load_generation(PDO $db, string $submissionId, string $slot): ?array
{
    $stmt = $db->prepare('SELECT id, status, svg FROM jd_generations WHERE submission_id = ? AND slot = ?');
    $stmt->execute([$submissionId, $slot]);
    $row = $stmt->fetch();
    return $row === false ? null : $row;
}

// C1.2 step 8 — a retried fetch with the same client_ref + slot is free, and
// a settled slot re-returns its stored verdict. No re-generation in v1.
function jd_respond_for_generation(array $generation, string $submissionId, string $slot): void
{
    $context = [
        'submission_id' => $submissionId,
        'gen_id' => $generation['id'],
        'slot' => $slot,
    ];

    if ($generation['status'] === 'ok') {
        jd_json_out(200, [
            'ok' => true,
            'submission_id' => $submissionId,
            'gen_id' => $generation['id'],
            'slot' => $slot,
            'svg' => (string) $generation['svg'],
        ]);
    }
    if ($generation['status'] === 'pending') {
        jd_fail(409, 'slot_in_progress', 'This slot is already being drawn.', $context);
    }
    if ($generation['status'] === 'rejected') {
        jd_fail(422, 'sanitizer_rejected', 'The drawing that came back could not be used.', $context);
    }
    jd_fail(502, 'provider_failed', 'The machine did not answer.', $context);
}

// C1.2 step 7. Cutoffs are computed here in PHP and bound as parameters so
// the same SQL runs on MySQL and on the dev SQLite file. Returns the refusal
// as DATA (null = the turn may proceed) rather than failing itself, so the
// caller can re-check for a sibling-created submission before answering 429 —
// the parallel-slot race, see the note at the call site.
function jd_rate_limit_failure(PDO $db, string $visitorHash): ?array
{
    $hourly = $db->prepare('SELECT COUNT(*) FROM jd_submissions WHERE visitor_hash = ? AND created >= ?');
    $hourly->execute([$visitorHash, gmdate('Y-m-d H:i:s', time() - 3600)]);
    if ((int) $hourly->fetchColumn() >= JD_LIMIT_HOURLY) {
        return [
            'status' => 429, 'code' => 'rate_limited',
            'message' => 'That is enough turns for one hour.',
            'retry_after' => 3600,
        ];
    }

    $midnight = jd_utc_midnight();

    $daily = $db->prepare('SELECT COUNT(*) FROM jd_submissions WHERE visitor_hash = ? AND created >= ?');
    $daily->execute([$visitorHash, $midnight]);
    if ((int) $daily->fetchColumn() >= JD_LIMIT_DAILY) {
        return [
            'status' => 429, 'code' => 'rate_limited',
            'message' => 'That is enough turns for one day.',
            'retry_after' => jd_seconds_to_utc_midnight(),
        ];
    }

    // Global circuit breaker. Counts pending rows too — in-flight generations
    // occupy the day's budget.
    $global = $db->prepare('SELECT COUNT(*) FROM jd_generations WHERE created >= ?');
    $global->execute([$midnight]);
    if ((int) $global->fetchColumn() >= JD_LIMIT_GLOBAL_DAILY) {
        return [
            'status' => 503, 'code' => 'drawer_resting',
            'message' => 'The drawer is resting — come back tomorrow.',
            'retry_after' => jd_seconds_to_utc_midnight(),
        ];
    }

    return null;
}

// Nothing ever UPDATEs a row away from 'ok', so every settle is guarded on
// the pending state it is leaving.
function jd_finish_generation(PDO $db, string $generationId, array $fields): void
{
    // Through jd_db_retry() because this is the first write after the provider
    // call, and the connection may not have survived it (jd-config.php C6.2).
    // The 'pending' guard below is what makes the replay safe.
    jd_db_retry(function (PDO $db) use ($generationId, $fields): void {
        $stmt = $db->prepare(
            'UPDATE jd_generations
                SET status = ?, reject_reason = ?, raw_response = ?, svg = ?,
                    disobedience = ?, latency_ms = ?, usage_tokens = ?
              WHERE id = ? AND status = ?'
        );
        $stmt->execute([
            $fields['status'],
            $fields['reject_reason'] ?? null,
            $fields['raw_response'] ?? null,
            $fields['svg'] ?? null,
            (int) ($fields['disobedience'] ?? 0),
            $fields['latency_ms'] ?? null,
            $fields['usage_tokens'] ?? null,
            $generationId,
            'pending',
        ]);
    }, $db);
}

// C4.3 — exactly what was sent, minus the prompt and system text.
function jd_provider_params(string $provider): string
{
    if ($provider === 'anthropic') {
        return json_encode([
            'max_tokens' => JD_MAX_TOKENS,
            'thinking' => 'disabled',
            'temperature' => 'provider-default',
        ]);
    }
    if ($provider === 'kimi') {
        return json_encode([
            'max_tokens' => JD_MAX_TOKENS,
            // kimi-k3 reasons by default and blows the timeout (see
            // JD_MODEL_POOL); 'low' is the disclosed compromise.
            'reasoning_effort' => 'low',
            'temperature' => 'provider-default',
        ]);
    }
    if ($provider === 'google') {
        return json_encode([
            'max_output_tokens' => JD_MAX_TOKENS,
            // Gemini 3.x thinks by default; 'low' is the disclosed compromise
            // (see JD_MODEL_POOL).
            'thinking_level' => 'low',
            'temperature' => 'provider-default',
        ]);
    }
    return json_encode([
        'max_completion_tokens' => JD_MAX_TOKENS,
        'temperature' => 'provider-default',
    ]);
}

// The owner's runbook adds the dedicated keys; the fallback keeps the feature
// launchable on the existing ones.
function jd_provider_key(string $provider): ?string
{
    $secrets = jd_secrets();
    if ($provider === 'anthropic') {
        $key = $secrets['jd_claude_key'] ?? $secrets['claude_key'] ?? null;
    } elseif ($provider === 'kimi') {
        $key = $secrets['jd_kimi_key'] ?? $secrets['kimi_key'] ?? null;
    } elseif ($provider === 'google') {
        $key = $secrets['jd_gemini_key'] ?? $secrets['gemini_key'] ?? null;
    } else {
        $key = $secrets['jd_openai_key'] ?? $secrets['openai_key'] ?? null;
    }
    return (is_string($key) && $key !== '') ? $key : null;
}

/**
 * C4.3. Returns the same shape as jd_mock_call() so that everything after the
 * call — extraction, sanitizer, storage — is identical in both modes.
 *
 * @return array{ok:bool,http_code:int,raw:string,usage:array,error:?string}
 */
function jd_provider_call(string $provider, string $apiModel, string $prompt): array
{
    $key = jd_provider_key($provider);
    if ($key === null) {
        return ['ok' => false, 'http_code' => 0, 'raw' => '', 'usage' => [], 'error' => 'missing_api_key'];
    }

    if ($provider === 'anthropic') {
        $url = 'https://api.anthropic.com/v1/messages';
        $headers = [
            'Content-Type: application/json',
            'x-api-key: ' . $key,
            'anthropic-version: 2023-06-01',
        ];
        // No temperature: Claude Sonnet 5 rejects non-default sampling
        // parameters, and the provider default is the behaviour we record.
        $payload = [
            'model' => $apiModel,
            'max_tokens' => JD_MAX_TOKENS,
            'thinking' => ['type' => 'disabled'],
            'system' => JD_SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
    } elseif ($provider === 'kimi') {
        // Moonshot's OpenAI-compatible endpoint. Standard max_tokens (the
        // max_completion_tokens spelling is a GPT-5 reasoning-family quirk);
        // reasoning_effort keeps the thinking model inside the shared
        // hosting time budget (probed 2026-08-14 — see JD_MODEL_POOL).
        $url = 'https://api.moonshot.ai/v1/chat/completions';
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ];
        $payload = [
            'model' => $apiModel,
            'max_tokens' => JD_MAX_TOKENS,
            'reasoning_effort' => 'low',
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
    } elseif ($provider === 'google') {
        // Gemini's generateContent endpoint. The key rides in the
        // x-goog-api-key header; thinkingLevel 'low' keeps the thinking
        // model inside the shared hosting time budget (see JD_MODEL_POOL).
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            . rawurlencode($apiModel) . ':generateContent';
        $headers = [
            'Content-Type: application/json',
            'x-goog-api-key: ' . $key,
        ];
        $payload = [
            'system_instruction' => ['parts' => [['text' => JD_SYSTEM_PROMPT]]],
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $prompt]]],
            ],
            'generationConfig' => [
                'maxOutputTokens' => JD_MAX_TOKENS,
                'thinkingConfig' => ['thinkingLevel' => 'low'],
            ],
        ];
    } else {
        $url = 'https://api.openai.com/v1/chat/completions';
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ];
        // max_completion_tokens, not max_tokens (gpt-5 reasoning family).
        $payload = [
            'model' => $apiModel,
            'max_completion_tokens' => JD_MAX_TOKENS,
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, JD_PROVIDER_TIMEOUT);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, JD_PROVIDER_CONNECT_TIMEOUT);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '') {
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => '', 'usage' => [], 'error' => 'transport: ' . $curlError];
    }
    if ($httpCode !== 200) {
        // The body is the error text and is kept as raw_response — failure
        // rates per model are first-class results.
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => (string) $response, 'usage' => [], 'error' => 'http_' . $httpCode];
    }

    $data = json_decode((string) $response, true);
    if (!is_array($data)) {
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => (string) $response, 'usage' => [], 'error' => 'unparseable_response'];
    }

    $usage = isset($data['usage']) && is_array($data['usage']) ? $data['usage'] : [];
    if ($provider === 'google' && isset($data['usageMetadata']) && is_array($data['usageMetadata'])) {
        $usage = $data['usageMetadata'];
    }

    if ($provider === 'anthropic') {
        $text = '';
        foreach ($data['content'] ?? [] as $block) {
            if (is_array($block) && ($block['type'] ?? '') === 'text') {
                $text .= (string) ($block['text'] ?? '');
            }
        }
    } elseif ($provider === 'google') {
        $text = '';
        foreach ($data['candidates'][0]['content']['parts'] ?? [] as $part) {
            if (is_array($part)) {
                $text .= (string) ($part['text'] ?? '');
            }
        }
    } else {
        $text = (string) ($data['choices'][0]['message']['content'] ?? '');
    }

    if ($text === '') {
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => (string) $response, 'usage' => $usage, 'error' => 'empty_completion'];
    }

    return ['ok' => true, 'http_code' => $httpCode, 'raw' => $text, 'usage' => $usage, 'error' => null];
}

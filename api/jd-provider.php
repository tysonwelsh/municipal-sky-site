<?php
// The provider layer, shared by BOTH harnesses.
//
// Extracted from jd-generate.php (2026-08-20) so the CLI benchmark runner and
// the visitor turn flow call the SAME code. The alternative — a second copy in
// the runner — would let the web and bench conditions drift apart silently,
// which is the one thing a harness exists to prevent. jd-generate.php is a
// request handler and executes on include, so it could not simply be required.
//
// jd_provider_call() takes an effort PROFILE ('web' | 'bench-max' |
// 'bench-medium' | 'bench-low'), defined in jd-config.php's JD_EFFORT table,
// with its output budget from JD_MAX_TOKENS_BY_PROFILE. It defaults to 'web'
// so every pre-existing call site is byte-identical.

require_once __DIR__ . '/jd-config.php';

// C4.3 — exactly what was sent, minus the prompt and system text. The
// effort fragment comes from the same JD_EFFORT table the payload is built
// from, so params can never drift from the request: a recorded condition that
// disagrees with the wire is worse than none.
function jd_provider_params(string $provider, string $profile = 'web'): string
{
    $effort = jd_effort($provider, $profile);
    $maxTokens = jd_max_tokens($profile);
    $base = [
        'anthropic' => ['max_tokens' => $maxTokens],
        'kimi'      => ['max_tokens' => $maxTokens],
        'google'    => ['max_output_tokens' => $maxTokens],
        'openai'    => ['max_completion_tokens' => $maxTokens],
    ][$provider] ?? ['max_tokens' => $maxTokens];

    return json_encode(array_merge($base, $effort, [
        // Forced, not chosen: Opus 5 rejects temperature outright, so
        // provider-default is the only setting all four can share.
        'temperature' => 'provider-default',
        'effort_profile' => $profile,
        'harness' => jd_harness($profile),
    ]));
}

/**
 * One JSON POST over cURL — the single wire call every provider request
 * (and the intake clerk's, api/jd2-intake-prompt.php) goes through. No reuse, one attempt.
 *
 * @return array{http_code:int, body:string, error:?string}  error is the
 *   transport failure text, or null when a response (any status) came back
 */
function jd_http_post_json(string $url, array $headers, array $payload, int $timeout): array
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, JD_PROVIDER_CONNECT_TIMEOUT);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

    $response = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    if ($response === false || $curlError !== '') {
        return ['http_code' => $httpCode, 'body' => '', 'error' => $curlError];
    }
    return ['http_code' => $httpCode, 'body' => (string) $response, 'error' => null];
}

// The owner's runbook adds the dedicated jd_* keys; the fallback keeps the
// feature launchable on the existing ones. $use names a helper that has its
// own key SLOT (jd_provider_key_slot below); without it, the provider's chain.
function jd_provider_key(string $provider, ?string $use = null): ?string
{
    return jd_provider_key_slot($provider, $use)['key'];
}

/**
 * The key slots in secrets.php, per provider and optionally per USE: a helper
 * with its own key (owner, 2026-10-02: the intake clerk gets its own
 * Anthropic key, `jd_intake_key`) reads its slot first and falls back to the
 * provider's chain, so nothing breaks before the dedicated key is added.
 *
 * Returns the key and the NAME of the slot it came from — `jd_intake_key`, or
 * `jd_claude_key (fallback)` when a use's own slot is empty — so a caller can
 * record which slot answered. The name is all that may ever be recorded,
 * logged or printed; never any part of the key.
 *
 * @return array{key:?string, slot:?string}  both null when no slot holds a key
 */
function jd_provider_key_slot(string $provider, ?string $use = null): array
{
    $chains = [
        'anthropic' => ['jd_claude_key', 'claude_key'],
        'kimi'      => ['jd_kimi_key', 'kimi_key'],
        'google'    => ['jd_gemini_key', 'gemini_key'],
        'openai'    => ['jd_openai_key', 'openai_key'],
    ];
    $useSlots = [
        'anthropic' => ['intake' => 'jd_intake_key'],
    ];
    $secrets = jd_secrets();
    $own = $use === null ? null : ($useSlots[$provider][$use] ?? null);
    if ($own !== null && is_string($secrets[$own] ?? null) && $secrets[$own] !== '') {
        return ['key' => $secrets[$own], 'slot' => $own];
    }
    // the provider's chain (an unknown slug rides OpenAI's, as before); a
    // slot that is set but empty ends the chain, as the ?? chain always did
    foreach ($chains[$provider] ?? $chains['openai'] as $slot) {
        if (array_key_exists($slot, $secrets) && $secrets[$slot] !== null) {
            $key = $secrets[$slot];
            return (is_string($key) && $key !== '')
                ? ['key' => $key, 'slot' => $slot . ($own !== null ? ' (fallback)' : '')]
                : ['key' => null, 'slot' => null];
        }
    }
    return ['key' => null, 'slot' => null];
}

/**
 * C4.3. Returns the same shape as jd_mock_call() so that everything after the
 * call — extraction, sanitizer, storage — is identical in both modes, plus
 * `stop`: the provider's own stop/finish reason when one came back (Anthropic
 * stop_reason, OpenAI/Kimi finish_reason, Gemini finishReason), else null.
 * Nothing stores `stop` yet; scripts/jd2-profile-probe.php prints it.
 *
 * @return array{ok:bool,http_code:int,raw:string,usage:array,error:?string,stop?:?string}
 */
function jd_provider_call(string $provider, string $apiModel, string $prompt, string $profile = 'web'): array
{
    // The effort fragment and output budget for this profile. Defaulting to
    // 'web' keeps every existing call site byte-identical — v3-web.1 must not
    // drift because a benchmark profile was added beside it. An unknown
    // profile is refused, never drawn under a silently empty effort fragment.
    if (!jd_profile_known($profile)) {
        return ['ok' => false, 'http_code' => 0, 'raw' => '', 'usage' => [], 'error' => 'unknown_profile'];
    }
    $effort = jd_effort($provider, $profile);
    $maxTokens = jd_max_tokens($profile);
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
            'max_tokens' => $maxTokens,
            'system' => JD_SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
        // web: thinking disabled. bench-*: output_config.effort, and NO
        // thinking key — thinking stays on (Opus 5 rejects disabled thinking
        // above effort high, and the bench profiles want it on at every rung).
        foreach ($effort as $k => $v) {
            $payload[$k] = $v;
        }
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
            'max_tokens' => $maxTokens,
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
        foreach ($effort as $k => $v) {
            $payload[$k] = $v;
        }
    } elseif ($provider === 'google') {
        // Gemini's generateContent endpoint. The key rides in the
        // x-goog-api-key header; thinkingLevel comes from the profile ('low'
        // on web keeps the thinking model inside the shared hosting time
        // budget, see JD_MODEL_POOL). maxOutputTokens counts its thoughts.
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
                'maxOutputTokens' => $maxTokens,
            ],
        ];
        if (isset($effort['thinking_level'])) {
            // Gemini nests it, unlike the flat OpenAI-shaped providers.
            $payload['generationConfig']['thinkingConfig'] =
                ['thinkingLevel' => $effort['thinking_level']];
        }
    } else {
        $url = 'https://api.openai.com/v1/chat/completions';
        $headers = [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ];
        // max_completion_tokens, not max_tokens (gpt-5 reasoning family).
        $payload = [
            'model' => $apiModel,
            'max_completion_tokens' => $maxTokens,
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
        foreach ($effort as $k => $v) {
            $payload[$k] = $v;
        }
    }

    $wire = jd_http_post_json($url, $headers, $payload, jd_profile_timeout($profile));
    $httpCode = $wire['http_code'];
    $response = $wire['body'];

    if ($wire['error'] !== null) {
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => '', 'usage' => [], 'error' => 'transport: ' . $wire['error']];
    }
    if ($httpCode !== 200) {
        // The body is the error text and is kept as raw_response — failure
        // rates per model are first-class results.
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => $response, 'usage' => [], 'error' => 'http_' . $httpCode];
    }

    $data = json_decode($response, true);
    if (!is_array($data)) {
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => $response, 'usage' => [], 'error' => 'unparseable_response'];
    }

    $usage = isset($data['usage']) && is_array($data['usage']) ? $data['usage'] : [];
    if ($provider === 'google' && isset($data['usageMetadata']) && is_array($data['usageMetadata'])) {
        $usage = $data['usageMetadata'];
    }

    $stop = $provider === 'anthropic' ? ($data['stop_reason'] ?? null)
        : ($provider === 'google' ? ($data['candidates'][0]['finishReason'] ?? null)
            : ($data['choices'][0]['finish_reason'] ?? null));
    $stop = is_string($stop) ? $stop : null;

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
        return ['ok' => false, 'http_code' => $httpCode, 'raw' => (string) $response, 'usage' => $usage, 'error' => 'empty_completion', 'stop' => $stop];
    }

    return ['ok' => true, 'http_code' => $httpCode, 'raw' => $text, 'usage' => $usage, 'error' => null, 'stop' => $stop];
}

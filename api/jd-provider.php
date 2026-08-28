<?php
// The provider layer, shared by BOTH harnesses.
//
// Extracted from jd-generate.php (2026-08-20) so the CLI benchmark runner and
// the visitor turn flow call the SAME code. The alternative — a second copy in
// the runner — would let the web and bench conditions drift apart silently,
// which is the one thing a harness exists to prevent. jd-generate.php is a
// request handler and executes on include, so it could not simply be required.
//
// jd_provider_call() takes an effort PROFILE ('web' | 'bench'), defined in
// jd-config.php's JD_EFFORT table. It defaults to 'web' so every pre-existing
// call site is byte-identical.

require_once __DIR__ . '/jd-config.php';

// C4.3 — exactly what was sent, minus the prompt and system text. The
// effort fragment comes from the same JD_EFFORT table the payload is built
// from, so params can never drift from the request: a recorded condition that
// disagrees with the wire is worse than none.
function jd_provider_params(string $provider, string $profile = 'web'): string
{
    $effort = jd_effort($provider, $profile);
    $base = [
        'anthropic' => ['max_tokens' => JD_MAX_TOKENS],
        'kimi'      => ['max_tokens' => JD_MAX_TOKENS],
        'google'    => ['max_output_tokens' => JD_MAX_TOKENS],
        'openai'    => ['max_completion_tokens' => JD_MAX_TOKENS],
    ][$provider] ?? ['max_tokens' => JD_MAX_TOKENS];

    return json_encode(array_merge($base, $effort, [
        // Forced, not chosen: Opus 5 rejects temperature outright, so
        // provider-default is the only setting all four can share.
        'temperature' => 'provider-default',
        'effort_profile' => $profile,
        'harness' => jd_harness($profile),
    ]));
}

// The owner's runbook adds the dedicated jd_* keys; the fallback keeps the
// feature launchable on the existing ones.
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
function jd_provider_call(string $provider, string $apiModel, string $prompt, string $profile = 'web'): array
{
    // The effort fragment for this profile. Defaulting to 'web' keeps every
    // existing call site byte-identical — v3-web.1 must not drift because a
    // benchmark profile was added beside it.
    $effort = jd_effort($provider, $profile);
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
            'system' => JD_SYSTEM_PROMPT,
            'messages' => [
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
        // web: thinking disabled. bench: output_config.effort = max, and NO
        // thinking key — Opus 5 rejects disabled thinking above effort high.
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
            'max_tokens' => JD_MAX_TOKENS,
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
            'max_completion_tokens' => JD_MAX_TOKENS,
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ];
        foreach ($effort as $k => $v) {
            $payload[$k] = $v;
        }
    }

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_FORBID_REUSE, true);
    curl_setopt($ch, CURLOPT_TIMEOUT,
        $profile === 'bench' ? JD_BENCH_TIMEOUT : JD_PROVIDER_TIMEOUT);
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

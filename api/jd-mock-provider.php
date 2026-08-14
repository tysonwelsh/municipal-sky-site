<?php
// Canned provider responses for the dev loop (C6.3). Included ONLY when
// JD_DEV_MODE — jd-generate.php guards the require.
//
// jd_mock_call() returns the exact shape of jd_provider_call(), so it replaces
// the cURL exec and nothing else: extraction, the REAL sanitizer, and storage
// all run identically in both modes.

require_once __DIR__ . '/jd-config.php';

if (!JD_DEV_MODE) {
    // A hard stop rather than a silent no-op: this file must never be
    // reachable on a host that has real keys and a real database.
    throw new RuntimeException('jd-mock-provider.php loaded outside dev mode');
}

const JD_MOCK_DIR = __DIR__ . '/../local-dev/jd-mock';

// Fixed and nonzero, so an eval export has shape to look at.
const JD_MOCK_USAGE = [
    'anthropic' => ['input_tokens' => 214, 'output_tokens' => 1873],
    'openai' => ['prompt_tokens' => 209, 'completion_tokens' => 1642, 'total_tokens' => 1851],
    'kimi' => ['prompt_tokens' => 211, 'completion_tokens' => 1704, 'total_tokens' => 1915],
];

/**
 * @return array{ok:bool,http_code:int,raw:string,usage:array,error:?string}
 */
function jd_mock_call(string $provider, string $prompt): array
{
    // Rehearse the long wait with JD_DEV_LATENCY_MS=45000.
    usleep(1000 * (int) (getenv('JD_DEV_LATENCY_MS') ?: 1200));

    $usage = JD_MOCK_USAGE[$provider] ?? JD_MOCK_USAGE['anthropic'];

    if (jd_mock_token_hits($prompt, 'fail', $provider)) {
        return [
            'ok' => false,
            'http_code' => 0,
            'raw' => '',
            'usage' => [],
            'error' => 'transport: Operation timed out after 90000 milliseconds (simulated)',
        ];
    }

    if (jd_mock_token_hits($prompt, 'hostile', $provider)) {
        // Flows through the real sanitizer, which rejects it — that is the
        // point of the fixture.
        return jd_mock_ok(jd_mock_fixture('mock-hostile.svg'), $usage);
    }

    $svg = jd_mock_fixture(
        $provider === 'anthropic' ? 'mock-anthropic.svg'
            : ($provider === 'kimi' ? 'mock-kimi.svg' : 'mock-openai.svg')
    );

    if (stripos($prompt, '[prose]') !== false) {
        $svg = "Certainly! Here is the object you described.\n\n```svg\n"
            . $svg
            . "\n```\n\nLet me know if you'd like a different treatment.";
    }

    return jd_mock_ok($svg, $usage);
}

// '[token]' fires for both providers; '[token:anthropic]' for just that one.
function jd_mock_token_hits(string $prompt, string $token, string $provider): bool
{
    return stripos($prompt, '[' . $token . ']') !== false
        || stripos($prompt, '[' . $token . ':' . $provider . ']') !== false;
}

function jd_mock_ok(string $raw, array $usage): array
{
    return ['ok' => true, 'http_code' => 200, 'raw' => $raw, 'usage' => $usage, 'error' => null];
}

function jd_mock_fixture(string $name): string
{
    $path = JD_MOCK_DIR . '/' . $name;
    $contents = @file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException('missing dev fixture: ' . $path);
    }
    return rtrim($contents, "\n");
}

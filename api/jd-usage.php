<?php
declare(strict_types=1);

/**
 * jd-usage.php — the one normalizer + pricer for provider token usage.
 *
 * jd-generate.php stores each provider's own usage object VERBATIM in
 * jd_generations.usage_tokens (see jd-generate.php:173). That column is the
 * authoritative token record, so nothing here estimates: counts the providers
 * themselves reported, multiplied by the rate table in api/jd-prices.json
 * (which lives in api/ — not scripts/, which is deploy-excluded — because
 * jd-rate.php's reveal payload now spends from the same table).
 *
 * The four providers report usage in three shapes and with different
 * inclusion rules. All are folded to the same five buckets here, and getting
 * the inclusion rules right is the whole correctness of this file:
 *
 *   Anthropic /v1/messages — input_tokens EXCLUDES both cache figures, so the
 *     three input buckets simply add up. output_tokens INCLUDES thinking;
 *     output_tokens_details.thinking_tokens (seen on Opus 5 and Opus 5.5,
 *     2026-10-02) is that part, kept in `reasoning` for visibility and never
 *     added on top.
 *   OpenAI /v1/chat/completions — prompt_tokens INCLUDES cached_tokens, so the
 *     cached part must be subtracted out to avoid billing it twice at the full
 *     rate; and completion_tokens ALREADY INCLUDES reasoning_tokens, so
 *     reasoning is reported for visibility but never added on top.
 *     (Kimi's OpenAI-compatible usage from api.moonshot.ai rides this branch:
 *     same field names, same inclusion rules.) Both now also report
 *     prompt_tokens_details.cache_write_tokens (seen 2026-10-02: 0 on
 *     gpt-6-astra, 256 of kimi-k3's 431 prompt_tokens). Read as a part of
 *     prompt_tokens (an inference from those numbers, not a documented rule)
 *     and absent from cached_tokens, they price at the input rate — which is what
 *     Moonshot charges for a 5-minute cache write ($3.00, the same as input;
 *     platform.kimi.ai/docs/pricing/chat) and OpenAI has no write charge.
 *   Google usageMetadata — promptTokenCount INCLUDES cachedContentTokenCount
 *     (same subtraction discipline as OpenAI), and thoughtsTokenCount is
 *     BILLED AS OUTPUT by Google, so it is added to candidatesTokenCount in
 *     `output` AND kept separately in `reasoning` — visible but never added
 *     on top, the same discipline as the OpenAI branch.
 *
 * Bucket meanings after normalization: input = uncached input; cache_write =
 * Anthropic 5-minute cache writes (no other provider has the charge);
 * cache_read = cache hits (billed cheap); output = everything billed at the
 * output rate; reasoning = the output tokens that were thinking.
 */

/** @return array{input:int,cache_write:int,cache_read:int,output:int,reasoning:int} */
function jd_normalize_usage(string $provider, array $u): array
{
    if ($provider === 'anthropic') {
        return [
            'input'      => (int) ($u['input_tokens'] ?? 0),
            'cache_write'=> (int) ($u['cache_creation_input_tokens'] ?? 0),
            'cache_read' => (int) ($u['cache_read_input_tokens'] ?? 0),
            'output'     => (int) ($u['output_tokens'] ?? 0),
            'reasoning'  => (int) ($u['output_tokens_details']['thinking_tokens'] ?? 0),
        ];
    }
    if ($provider === 'google') {
        $prompt = (int) ($u['promptTokenCount'] ?? 0);
        $cached = (int) ($u['cachedContentTokenCount'] ?? 0);
        $thoughts = (int) ($u['thoughtsTokenCount'] ?? 0);
        return [
            'input'      => max(0, $prompt - $cached),
            'cache_write'=> 0,
            'cache_read' => $cached,
            // Google bills thinking at the output rate — it belongs IN output…
            'output'     => (int) ($u['candidatesTokenCount'] ?? 0) + $thoughts,
            // …and is kept visible here WITHOUT being added again.
            'reasoning'  => $thoughts,
        ];
    }
    // OpenAI shape (OpenAI itself, and Kimi's OpenAI-compatible endpoint).
    $prompt = (int) ($u['prompt_tokens'] ?? 0);
    $cached = (int) ($u['prompt_tokens_details']['cached_tokens'] ?? 0);
    return [
        'input'      => max(0, $prompt - $cached),
        'cache_write'=> 0,
        'cache_read' => $cached,
        'output'     => (int) ($u['completion_tokens'] ?? 0),
        'reasoning'  => (int) ($u['completion_tokens_details']['reasoning_tokens'] ?? 0),
    ];
}

/** cost in USD: normalized buckets x a rates row from api/jd-prices.json */
function jd_cost(array $t, array $p): float
{
    return $t['input']       / 1e6 * (float) ($p['input'] ?? 0)
         + $t['cache_write'] / 1e6 * (float) ($p['cache_write'] ?? 0)
         + $t['cache_read']  / 1e6 * (float) ($p['cache_read'] ?? 0)
         + $t['output']      / 1e6 * (float) ($p['output'] ?? 0);
}

/**
 * The rate table, read once per process. Keyed by model_version — the exact
 * provider wire string jd-generate.php sent. Returns [] when the file is
 * unreadable: an unpriced table prices everything as null, never as $0
 * presented with confidence (see jd_generation_cost's 'priced').
 *
 * @return array<string,array{input:float,output:float,cache_write:float,cache_read:float}>
 */
function jd_prices(): array
{
    static $prices = null;
    if ($prices === null) {
        $doc = json_decode((string) @file_get_contents(__DIR__ . '/jd-prices.json'), true);
        $prices = (is_array($doc) && isset($doc['prices']) && is_array($doc['prices']))
            ? $doc['prices'] : [];
    }
    return $prices;
}

/**
 * One generation's normalized tokens and exact spend, for callers that have
 * a jd_generations row in hand (jd-rate's reveal; anything future).
 *
 * $usage is the DECODED usage_tokens object, or null when none was recorded
 * (a slot that never reached the provider, a mock call): the caller gets
 * tokens null rather than four honest-looking zeros that would price as $0.
 *
 * @return array{tokens:?array, cost_usd:?float, priced:bool}
 *   tokens    normalized buckets (input/cache_write/cache_read/output/
 *             reasoning), or null when no usage was recorded
 *   cost_usd  exact USD, or null when the model has no rate (UNPRICED is a
 *             fact to show, not a zero to spend) or there was no usage
 *   priced    whether a rate exists for this wire string
 */
function jd_generation_cost(string $provider, string $modelVersion, ?array $usage): array
{
    if (!is_array($usage) || $usage === []) {
        return ['tokens' => null, 'cost_usd' => null, 'priced' => false];
    }
    $prices = jd_prices();
    $t = jd_normalize_usage($provider, $usage);
    if (!isset($prices[$modelVersion])) {
        return ['tokens' => $t, 'cost_usd' => null, 'priced' => false];
    }
    return ['tokens' => $t, 'cost_usd' => jd_cost($t, $prices[$modelVersion]), 'priced' => true];
}

/**
 * Price one STORED generation row: its usage_tokens text (the provider's
 * usage object as jd-generate.php stored it, JSON; null or empty when none
 * was recorded) decoded and handed to jd_generation_cost(). Every reader that
 * prices a jd_generations row goes through here — data.php's turn items,
 * jd-rate's reveal, jd-analytics.
 *
 * @return array{tokens:?array, cost_usd:?float, priced:bool}
 */
function jd_price_generation_row(mixed $usageTokens, string $provider, string $modelVersion): array
{
    $usage = !empty($usageTokens) ? json_decode((string) $usageTokens, true) : null;
    return jd_generation_cost($provider, $modelVersion, is_array($usage) ? $usage : null);
}

/**
 * A priced generation as the payloads state it: tokens as the three numbers a
 * person reads (input, output, and the total of every bucket — the cache and
 * reasoning buckets stay in the database, jd-spend.php's job) and cost_usd
 * rounded to six places; either null when jd_generation_cost() had none.
 * jd-rate's reveal prints both keys, nulls included; data.php omits a null.
 *
 * @param array{tokens:?array, cost_usd:?float} $cost  jd_generation_cost()'s answer
 * @return array{tokens:?array{input:int,output:int,total:int}, cost_usd:?float}
 */
function jd_cost_summary(array $cost): array
{
    $t = $cost['tokens'];
    return [
        'tokens' => $t === null ? null : [
            'input' => $t['input'],
            'output' => $t['output'],
            'total' => $t['input'] + $t['cache_write'] + $t['cache_read'] + $t['output'],
        ],
        'cost_usd' => $cost['cost_usd'] === null ? null : round($cost['cost_usd'], 6),
    ];
}

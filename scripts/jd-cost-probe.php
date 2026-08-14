<?php
declare(strict_types=1);

/**
 * jd-cost-probe.php — what a Junk Drawer turn costs, measured not guessed.
 *
 * NOTHING IS SAVED. This calls the two providers directly and throws the
 * artwork away, keeping only the token counts. It does not touch the
 * database, does not write jd_submissions/jd_generations, does not go
 * through api/jd-generate.php, and does not consume any of the JD_LIMIT_*
 * rate-limit budget. The only trace it leaves is real spend on your two
 * provider accounts.
 *
 * It mirrors jd_provider_call() in api/jd-generate.php (lines ~404-450)
 * deliberately rather than including it, because that file is a request
 * handler and executes on include. The payloads here must stay in step with
 * it — same JD_SYSTEM_PROMPT, same JD_MAX_TOKENS, thinking disabled for
 * Anthropic, max_completion_tokens for OpenAI — or the numbers stop
 * describing the real feature.
 *
 * USAGE
 *     php scripts/jd-cost-probe.php                    # the 5 built-in prompts
 *     php scripts/jd-cost-probe.php --prompts=my.txt   # one prompt per line
 *     php scripts/jd-cost-probe.php --runs=3           # repeat for variance
 *     php scripts/jd-cost-probe.php --dry-run          # show what it WOULD spend
 *     php scripts/jd-cost-probe.php --self-test        # prove the validator fails correctly
 *     php scripts/jd-cost-probe.php --save-svg         # KEEP the artwork + contact sheet
 *     php scripts/jd-cost-probe.php --json
 *
 * Each prompt costs one real generation on EACH provider.
 *
 * --save-svg is the one exception to "nothing is saved": it writes each SVG
 * plus an index.html contact sheet to local-dev/jd-probe/<timestamp>/, which
 * is gitignored and excluded from both deploy paths. Still no database writes.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../api/jd-config.php';
require_once __DIR__ . '/../api/jd-svg-sanitizer.php';
ini_set('display_errors', '1');

$opts = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--([a-z-]+)(?:=(.*))?$/', $arg, $m)) {
        $opts[$m[1]] = $m[2] ?? true;
    }
}

// A deliberate spread from trivial to elaborate: SVG output tokens are driven
// almost entirely by how much structure the brief implies, so a single prompt
// tells you nothing about the range you should budget for.
$PROMPTS = [
    'a paperclip',
    'a small brass key with one bent tooth',
    'a tangled pair of earbuds',
    'a pocket watch with its cover open, showing the tiny gears inside',
    'a dried seahorse in a glass jar on a windowsill at dusk',
];
if (is_string($opts['prompts'] ?? null)) {
    $lines = file($opts['prompts'], FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        fwrite(STDERR, "Could not read {$opts['prompts']}\n");
        exit(1);
    }
    $PROMPTS = array_values(array_filter(array_map('trim', $lines)));
}
$runs = max(1, (int) ($opts['runs'] ?? 1));

$priceDoc = json_decode((string) @file_get_contents(__DIR__ . '/jd-prices.json'), true);
$PRICES = $priceDoc['prices'] ?? [];

$secrets = jd_secrets();
$KEYS = [
    // mirrors jd-generate.php:393-394
    'anthropic' => $secrets['jd_claude_key'] ?? $secrets['claude_key'] ?? null,
    'openai'    => $secrets['jd_openai_key'] ?? $secrets['openai_key'] ?? null,
    'kimi'      => $secrets['jd_kimi_key'] ?? $secrets['kimi_key'] ?? null,
];
foreach ($KEYS as $p => $k) {
    if ($k === null) {
        fwrite(STDERR, "No API key configured for $p\n");
        exit(1);
    }
}

$calls = count($PROMPTS) * $runs * count(JD_MODEL_TRIO);
echo "\nCost probe — ", count($PROMPTS), " prompt(s) x $runs run(s) x ",
     count(JD_MODEL_TRIO), " providers = $calls live generation(s).\n";
echo "Nothing is written to the database. Artwork is discarded.\n\n";

if (isset($opts['dry-run'])) {
    foreach ($PROMPTS as $i => $p) {
        printf("  %d. %s\n", $i + 1, $p);
    }
    echo "\nDry run — no API calls made.\n\n";
    exit(0);
}

// --self-test proves the validator can actually FAIL before any money is spent
// on it. A raster detector that never fires would read as reassurance.
if (isset($opts['self-test'])) {
    $vector = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
        . '<path d="M1 1 L9 9"/><circle cx="5" cy="5" r="2"/></svg>';
    $pngUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==';
    $cases = [
        ['genuine vector',        $vector, $vector,                    'ok',    false, 0],
        ['raster in <image>',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
            . '<image href="' . $pngUri . '"/></svg>', null,           null,    true,  null],
        ['bare raster data URI',
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
            . '<rect fill="url(' . $pngUri . ')" width="10" height="10"/></svg>', null, null, true, null],
        ['fenced in prose',       $vector, "Here you go!\n```svg\n$vector\n```", null,  false, 1],
        ['no svg at all',         null,    'I cannot draw that.',      'no_svg', false, 1],
    ];
    $bad = 0;
    foreach ($cases as [$name, $svg, $raw, $wantVerdict, $wantRaster, $wantDisobey]) {
        $got = jd_probe_inspect($svg, $raw ?? (string) $svg);
        $fails = [];
        if ($wantVerdict !== null && $got['verdict'] !== $wantVerdict) {
            $fails[] = "verdict={$got['verdict']} want=$wantVerdict";
        }
        if ($wantRaster !== null && $got['raster'] !== $wantRaster) {
            $fails[] = 'raster=' . var_export($got['raster'], true);
        }
        if ($wantDisobey !== null && $got['disobedience'] !== $wantDisobey) {
            $fails[] = "disobedience={$got['disobedience']} want=$wantDisobey";
        }
        printf("  %-22s %-9s verdict=%-16s raster=%-5s marks=%d%s\n",
            $name, $fails ? 'FAIL' : 'pass', $got['verdict'],
            $got['raster'] ? 'YES' : 'no', $got['marks'],
            $fails ? '   <- ' . implode(', ', $fails) : '');
        $bad += $fails ? 1 : 0;
    }
    echo "\n", $bad ? "$bad case(s) FAILED\n\n" : "Validator behaves correctly. No API calls made.\n\n";
    exit($bad ? 1 : 0);
}

// ---------------------------------------------------------------------------

function jd_probe_payload(array $model, string $prompt): array
{
    if ($model['provider'] === 'anthropic') {
        return ['https://api.anthropic.com/v1/messages', [
            'model' => $model['api_model'],
            'max_tokens' => JD_MAX_TOKENS,
            'thinking' => ['type' => 'disabled'],
            'system' => JD_SYSTEM_PROMPT,
            'messages' => [['role' => 'user', 'content' => $prompt]],
        ]];
    }
    if ($model['provider'] === 'kimi') {
        return ['https://api.moonshot.ai/v1/chat/completions', [
            'model' => $model['api_model'],
            'max_tokens' => JD_MAX_TOKENS,
            'reasoning_effort' => 'low',
            'messages' => [
                ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
                ['role' => 'user', 'content' => $prompt],
            ],
        ]];
    }
    return ['https://api.openai.com/v1/chat/completions', [
        'model' => $model['api_model'],
        'max_completion_tokens' => JD_MAX_TOKENS,
        'messages' => [
            ['role' => 'system', 'content' => JD_SYSTEM_PROMPT],
            ['role' => 'user', 'content' => $prompt],
        ],
    ]];
}

function jd_probe_headers(string $provider, string $key): array
{
    return $provider === 'anthropic'
        ? ['Content-Type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01']
        : ['Content-Type: application/json', 'Authorization: Bearer ' . $key];
}

/**
 * Is this real vector artwork, or a bitmap in an <svg> wrapper?
 *
 * jd_extract_svg() only proves a '<svg' ... '</svg>' span exists, and a
 * base64 PNG inside <image> would satisfy that with a very convincing byte
 * count. So the verdict here is the site's OWN sanitizer — jd_sanitize_svg()
 * allowlists elements and deliberately omits image/feImage/foreignObject/
 * script — plus a mark census, because an SVG that parses clean but contains
 * two <rect>s and nothing else is not a drawing either.
 */
function jd_probe_inspect(?string $svg, string $raw): array
{
    if ($svg === null) {
        return ['verdict' => 'no_svg', 'marks' => 0, 'raster' => false,
                'disobedience' => 1, 'tags' => []];
    }

    $sanitized = jd_sanitize_svg($svg);

    // Counted on the raw string rather than the parsed tree, so that a
    // document the sanitizer rejected before parsing is still described.
    $tags = [];
    if (preg_match_all('/<\s*([a-zA-Z][a-zA-Z0-9:_-]*)/', $svg, $m)) {
        foreach ($m[1] as $t) {
            $t = strtolower($t);
            $tags[$t] = ($tags[$t] ?? 0) + 1;
        }
    }
    $markTags = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text'];
    $marks = 0;
    foreach ($markTags as $t) {
        $marks += $tags[$t] ?? 0;
    }

    // The exact failure mode we are testing for, checked three ways: the
    // element, the filter primitive that smuggles one, and the payload.
    $raster = isset($tags['image']) || isset($tags['feimage'])
        || (bool) preg_match('#data:image/(png|jpe?g|gif|webp|bmp|avif)#i', $svg);

    return [
        'verdict' => $sanitized['ok'] ? 'ok' : ($sanitized['reason'] ?? 'rejected'),
        'marks' => $marks,
        'raster' => $raster,
        // Matches jd-generate.php:215 — anything outside the SVG span (code
        // fences, prose, apologies) is gradeable disobedience.
        'disobedience' => trim($raw) !== $svg ? 1 : 0,
        'tags' => $tags,
    ];
}

/** All three providers for one prompt, concurrently — the trio is what a turn is. */
function jd_probe_pair(string $prompt, array $keys, ?string $saveDir = null, string $label = ''): array
{
    $mh = curl_multi_init();
    $handles = [];
    foreach (JD_MODEL_TRIO as $idx => $model) {
        [$url, $payload] = jd_probe_payload($model, $prompt);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => jd_probe_headers($model['provider'], $keys[$model['provider']]),
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => JD_PROVIDER_TIMEOUT,
            CURLOPT_CONNECTTIMEOUT => JD_PROVIDER_CONNECT_TIMEOUT,
        ]);
        curl_multi_add_handle($mh, $ch);
        $handles[$idx] = ['ch' => $ch, 'model' => $model, 'started' => microtime(true)];
    }

    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running) {
            curl_multi_select($mh, 1.0);
        }
    } while ($running > 0);

    $out = [];
    foreach ($handles as $idx => $h) {
        $body = (string) curl_multi_getcontent($h['ch']);
        $code = (int) curl_getinfo($h['ch'], CURLINFO_HTTP_CODE);
        $ms = (int) round((microtime(true) - $h['started']) * 1000);
        // The transport error is the ONLY evidence when http=0: no body, no
        // JSON error object, nothing. Swallowing it turns "your wifi dropped"
        // and "the provider refused you" into the same unreadable failure.
        $curlErrNo = curl_errno($h['ch']);
        $curlErr = curl_error($h['ch']);
        curl_multi_remove_handle($mh, $h['ch']);
        curl_close($h['ch']);

        $data = json_decode($body, true);
        $provider = $h['model']['provider'];
        $usage = (is_array($data) && isset($data['usage']) && is_array($data['usage']))
            ? $data['usage'] : [];

        // Extract only to measure it; the SVG itself is never kept.
        $text = '';
        if ($provider === 'anthropic') {
            foreach ($data['content'] ?? [] as $block) {
                if (($block['type'] ?? '') === 'text') {
                    $text .= $block['text'];
                }
            }
        } else {
            $text = (string) ($data['choices'][0]['message']['content'] ?? '');
        }
        $svg = jd_extract_svg($text);

        $out[] = [
            'model' => $h['model']['api_model'],
            'provider' => $provider,
            'http' => $code,
            'ok' => $code === 200 && $svg !== null,
            'error' => $code === 200 ? null : ($curlErrNo !== 0
                ? "curl#$curlErrNo: $curlErr"
                : (string) ($data['error']['message'] ?? "http_$code")),
            'svg_bytes' => $svg !== null ? strlen($svg) : 0,
            'latency_ms' => $ms,
            'usage' => $usage,
            // Structural findings only — never the artwork itself.
            'inspect' => jd_probe_inspect($svg, $text),
            'file' => null,
        ];
        // --save-svg is the ONLY path on which artwork touches disk. Default
        // off: the probe's whole point is measuring a turn without keeping one.
        if ($saveDir !== null && $svg !== null) {
            $name = sprintf('%s-%s.svg', $label, $provider);
            if (file_put_contents(rtrim($saveDir, '/') . '/' . $name, $svg) !== false) {
                $out[count($out) - 1]['file'] = $name;
            }
        }
        unset($text, $svg, $data, $body);   // artwork out of memory immediately
    }
    curl_multi_close($mh);
    return $out;
}

// Same normalisation and pricing rules as jd-spend.php — see the long comment
// there for why the two providers' inclusion rules differ.
function jd_probe_cost(string $provider, array $u, array $p): array
{
    if ($provider === 'anthropic') {
        $in = (int) ($u['input_tokens'] ?? 0);
        $cw = (int) ($u['cache_creation_input_tokens'] ?? 0);
        $cr = (int) ($u['cache_read_input_tokens'] ?? 0);
        $out = (int) ($u['output_tokens'] ?? 0);
        $reason = 0;
    } else {
        $pt = (int) ($u['prompt_tokens'] ?? 0);
        $cr = (int) ($u['prompt_tokens_details']['cached_tokens'] ?? 0);
        $in = max(0, $pt - $cr);
        $cw = 0;
        $out = (int) ($u['completion_tokens'] ?? 0);
        $reason = (int) ($u['completion_tokens_details']['reasoning_tokens'] ?? 0);
    }
    $cost = $in / 1e6 * (float) ($p['input'] ?? 0)
          + $cw / 1e6 * (float) ($p['cache_write'] ?? 0)
          + $cr / 1e6 * (float) ($p['cache_read'] ?? 0)
          + $out / 1e6 * (float) ($p['output'] ?? 0);
    return compact('in', 'cw', 'cr', 'out', 'reason', 'cost');
}

// ---------------------------------------------------------------------------

// Artwork, when kept at all, lands outside the repo's publishable surface:
// local-dev/ is excluded from publish.sh and deploy.yml, and local-dev/jd-probe
// is gitignored, so a saved run cannot be committed or deployed by accident.
$saveDir = null;
if (isset($opts['save-svg'])) {
    $saveDir = is_string($opts['save-svg'])
        ? $opts['save-svg']
        : __DIR__ . '/../local-dev/jd-probe/' . gmdate('Ymd-His');
    if (!is_dir($saveDir) && !mkdir($saveDir, 0755, true) && !is_dir($saveDir)) {
        fwrite(STDERR, "Could not create $saveDir\n");
        exit(1);
    }
    echo "Saving artwork to $saveDir\n\n";
}

$results = [];
$turnCosts = [];
foreach ($PROMPTS as $pi => $prompt) {
    for ($r = 0; $r < $runs; $r++) {
        $label = $runs > 1 ? sprintf('%d.%d', $pi + 1, $r + 1) : (string) ($pi + 1);
        fwrite(STDERR, "  [$label] " . substr($prompt, 0, 46) . " ... ");
        $pair = jd_probe_pair($prompt, $KEYS, $saveDir, $label);
        $turnCost = 0.0;
        foreach ($pair as &$slot) {
            $price = $PRICES[$slot['model']] ?? [];
            $slot['billed'] = jd_probe_cost($slot['provider'], $slot['usage'], $price);
            $slot['priced'] = $price !== [];
            $turnCost += $slot['billed']['cost'];
        }
        unset($slot);
        // Only a COMPLETE turn is an observation of what a turn costs. A pair
        // with a dead slot averaged in as $0.00 would drag the mean toward
        // zero and quietly understate every projection built on it.
        $complete = true;
        foreach ($pair as $slot) {
            $complete = $complete && $slot['ok'];
        }
        if ($complete) {
            $turnCosts[] = $turnCost;
        }
        $results[] = ['label' => $label, 'prompt' => $prompt, 'slots' => $pair,
                      'turn_cost' => $turnCost, 'complete' => $complete];
        fwrite(STDERR, sprintf("$%.6f%s\n", $turnCost, $complete ? '' : '   INCOMPLETE'));
    }
}

if (isset($opts['json'])) {
    echo json_encode(['results' => $results, 'turn_costs' => $turnCosts],
        JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), "\n";
    exit(0);
}

$money = static fn(float $v): string => '$' . number_format($v, 6);
$n = static fn(int $v): string => number_format($v);

echo "\n";
printf("%-4s %-34s %-14s %8s %8s %8s %9s %11s\n",
    '#', 'PROMPT', 'MODEL', 'IN', 'OUT', 'REASON', 'SVG B', 'COST');
echo str_repeat('-', 104), "\n";
foreach ($results as $row) {
    $first = true;
    foreach ($row['slots'] as $s) {
        printf("%-4s %-34s %-14s %8s %8s %8s %9s %11s%s\n",
            $first ? $row['label'] : '',
            $first ? substr($row['prompt'], 0, 34) : '',
            $s['model'],
            $n($s['billed']['in']), $n($s['billed']['out']),
            $s['billed']['reason'] ? $n($s['billed']['reason']) : '-',
            $s['ok'] ? $n($s['svg_bytes']) : 'FAIL',
            $money($s['billed']['cost']),
            $s['priced'] ? '' : ' (UNPRICED)');
        $first = false;
    }
    printf("%-4s %-34s %-14s %8s %8s %8s %9s %11s\n", '', '', '', '', '', '', 'turn:', $money($row['turn_cost']));
}

// Did each model actually return VECTOR artwork? The verdict column is the
// site's own jd_sanitize_svg() — the same gate the live feature applies before
// anything reaches a visitor.
echo "\nARTWORK VALIDATION (verdict = the site's own jd_sanitize_svg)\n";
printf("%-4s %-14s %9s %7s %8s %7s %-14s\n",
    '#', 'MODEL', 'SVG B', 'MARKS', 'RASTER?', 'FENCED', 'SANITIZER');
echo str_repeat('-', 74), "\n";
$count = count($turnCosts);   // needed by the failure block below, not just the summary
$allClean = true;
foreach ($results as $row) {
    foreach ($row['slots'] as $s) {
        $ins = $s['inspect'];
        if ($ins['verdict'] !== 'ok' || $ins['raster']) {
            $allClean = false;
        }
        printf("%-4s %-14s %9s %7s %8s %7s %-14s\n",
            $row['label'], $s['model'],
            $s['ok'] ? $n($s['svg_bytes']) : '-',
            $s['ok'] ? $n($ins['marks']) : '-',
            $ins['raster'] ? 'YES' : ($s['ok'] ? 'no' : '-'),
            $s['ok'] ? ($ins['disobedience'] ? 'yes' : 'no') : '-',
            $ins['verdict']);
    }
}
echo str_repeat('-', 74), "\n";
echo $allClean
    ? "All returned slots are genuine vector SVG: no <image>, no feImage, no\n"
    . "raster data URI, and every one passes the production sanitizer.\n"
    : "!! At least one slot is not clean vector artwork — see RASTER/SANITIZER.\n";
echo "MARKS counts path/rect/circle/ellipse/line/polyline/polygon/text elements:\n",
     "a real drawing has many; a bitmap in a wrapper has almost none.\n";

// A failed slot is a first-class result: on the live site the visitor sees an
// empty half of the pair, so the reason has to be legible here, not swallowed.
$failures = [];
foreach ($results as $row) {
    foreach ($row['slots'] as $s) {
        if (!$s['ok']) {
            $failures[] = sprintf('  [%s] %-14s http=%-4d %-9s %s',
                $row['label'], $s['model'], $s['http'],
                $s['latency_ms'] . 'ms',
                $s['error'] ?? ($s['usage'] ? 'no <svg> in a 200 response' : 'empty response'));
        }
    }
}
if ($failures) {
    echo "\nFAILED SLOTS (", count($failures), " of ",
        count($results) * count(JD_MODEL_TRIO), " attempted)\n";
    echo implode("\n", $failures), "\n";
    printf("  JD_PROVIDER_TIMEOUT is %ds — a latency at or near that is a timeout,\n"
         . "  and the visitor gets half a turn.\n", JD_PROVIDER_TIMEOUT);
}

// Every projection below rests on at least one complete turn. With none, say
// so plainly rather than printing an authoritative-looking $0.00.
if ($count === 0) {
    echo "\n", str_repeat('=', 60), "\n";
    echo "No COMPLETE turns — every pair lost at least one slot.\n";
    echo "There is nothing to average, so no cost estimate is given.\n";
    echo "See FAILED SLOTS above for the transport errors.\n";
    if ($saveDir !== null) {
        echo "Any artwork that did arrive is still in $saveDir\n";
    }
    echo str_repeat('=', 60), "\n\n";
    exit(1);
}

sort($turnCosts);
$mean = array_sum($turnCosts) / $count;
$median = $turnCosts[(int) floor(($count - 1) / 2)];
$min = $turnCosts[0];
$max = $turnCosts[$count - 1];

// Per-provider split, so you can size each dashboard's cap independently.
$byProvider = [];
foreach ($results as $row) {
    foreach ($row['slots'] as $s) {
        $byProvider[$s['provider']] = ($byProvider[$s['provider']] ?? 0) + $s['billed']['cost'];
    }
}

echo "\n", str_repeat('=', 60), "\n";
printf("Complete turns        %d of %d attempted%s\n", $count, count($results),
    $count === count($results) ? '' : '   <- averages use the complete ones only');
printf("Mean cost per turn    %s\n", $money($mean));
printf("Median                %s\n", $money($median));
printf("Cheapest / dearest    %s  /  %s\n", $money($min), $money($max));
echo str_repeat('-', 60), "\n";
foreach ($byProvider as $prov => $total) {
    printf("%-14s mean/turn  %s\n", $prov, $money($total / max(1, $count)));
}
echo str_repeat('-', 60), "\n";
printf("Probe spend (actual)  %s\n", $money(array_sum($turnCosts)));
echo str_repeat('=', 60), "\n\n";

// The breaker is the number that matters for a spend cap: it is the most the
// feature can cost you in a day before it refuses to generate at all.
$daily = JD_LIMIT_GLOBAL_DAILY * $mean;
$dailyMax = JD_LIMIT_GLOBAL_DAILY * $max;
echo "WHAT TO EXPECT\n";
printf("  At the JD_LIMIT_GLOBAL_DAILY breaker (%d turns/day):\n", JD_LIMIT_GLOBAL_DAILY);
printf("    typical day at the cap   %s   (~%s / 30 days)\n",
    '$' . number_format($daily, 2), '$' . number_format($daily * 30, 2));
printf("    worst case at the cap    %s   (~%s / 30 days)\n",
    '$' . number_format($dailyMax, 2), '$' . number_format($dailyMax * 30, 2));
printf("  One visitor at their daily ceiling (%d turns): %s\n",
    JD_LIMIT_DAILY, '$' . number_format(JD_LIMIT_DAILY * $mean, 2));
echo "\n  Set your provider spend caps above the worst-case line, not the\n",
     "  typical one — the breaker counts turns, not dollars.\n\n";

// ---------------------------------------------------------------------------
// Contact sheet — the point of saving artwork is looking at it side by side,
// which is the same comparison the feature asks a visitor to make.
//
// Each drawing is referenced with <img src>, never inlined. SVG inside <img>
// renders in a restricted mode with scripting and external loads disabled, so
// reviewing raw model output cannot execute anything. The saved .svg files are
// the RAW extraction, not the sanitized form, which is exactly why they are
// displayed this way.
if ($saveDir !== null) {
    $h = static fn(string $s): string => htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
    $cards = '';
    foreach ($results as $row) {
        $slots = '';
        foreach ($row['slots'] as $s) {
            $ins = $s['inspect'];
            $art = $s['file'] !== null
                ? '<img src="' . $h($s['file']) . '" alt="' . $h($row['prompt']) . '">'
                : '<div class="fail">no artwork returned</div>';
            $slots .= '<figure class="slot"><div class="art">' . $art . '</div>'
                . '<figcaption><b>' . $h($s['model']) . '</b>'
                . '<span>' . number_format($s['billed']['cost'], 6) . ' USD</span>'
                . '<span>' . number_format($ins['marks']) . ' marks &middot; '
                . number_format($s['svg_bytes']) . ' B</span>'
                . '<span class="' . ($ins['verdict'] === 'ok' && !$ins['raster'] ? 'ok' : 'bad') . '">'
                . ($ins['raster'] ? 'RASTER &mdash; ' : '') . $h($ins['verdict'])
                . '</span></figcaption></figure>';
        }
        $cards .= '<section><h2>' . $h($row['label']) . '. ' . $h($row['prompt']) . '</h2>'
            . '<div class="pair">' . $slots . '</div></section>';
    }

    $html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>Junk Drawer cost probe — ' . $h(gmdate('Y-m-d H:i')) . ' UTC</title><style>'
        . ':root{--bg:#fbfaf7;--fg:#1a1815;--mut:#6b665e;--line:#ddd8ce;--card:#fff;'
        . '--ok:#2f6b3a;--bad:#a3341f}'
        . '@media(prefers-color-scheme:dark){:root{--bg:#16150f;--fg:#ece7dc;--mut:#9a9387;'
        . '--line:#332f27;--card:#201e17;--ok:#7fbf8a;--bad:#e08a72}}'
        . '*{box-sizing:border-box}body{margin:0;padding:2rem 1.25rem;background:var(--bg);'
        . 'color:var(--fg);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif}'
        . '.wrap{max-width:1100px;margin:0 auto}h1{font-size:1.4rem;margin:0 0 .25rem}'
        . 'p.sub{color:var(--mut);margin:0 0 2rem}'
        . 'h2{font-size:1rem;font-weight:600;margin:2.5rem 0 .75rem;padding-bottom:.5rem;'
        . 'border-bottom:1px solid var(--line)}'
        . '.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}'
        . '.slot{margin:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;'
        . 'background:var(--card)}'
        . '.art{aspect-ratio:1;display:grid;place-items:center;padding:1rem;'
        . 'background-image:linear-gradient(45deg,rgba(128,128,128,.14) 25%,transparent 25%,'
        . 'transparent 75%,rgba(128,128,128,.14) 75%),linear-gradient(45deg,'
        . 'rgba(128,128,128,.14) 25%,transparent 25%,transparent 75%,rgba(128,128,128,.14) 75%);'
        . 'background-size:18px 18px;background-position:0 0,9px 9px}'
        . '.art img{max-width:100%;max-height:100%}'
        . '.fail{color:var(--bad);font-size:.85rem}'
        . 'figcaption{display:flex;flex-direction:column;gap:.15rem;padding:.75rem;'
        . 'border-top:1px solid var(--line);font-size:.8rem;color:var(--mut)}'
        . 'figcaption b{color:var(--fg);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}'
        . '.ok{color:var(--ok)}.bad{color:var(--bad);font-weight:600}'
        . '</style></head><body><div class="wrap">'
        . '<h1>Junk Drawer cost probe</h1><p class="sub">'
        . $h(gmdate('Y-m-d H:i')) . ' UTC &middot; ' . $count . ' turns &middot; mean '
        . number_format($mean, 6) . ' USD/turn &middot; checkerboard shows SVG transparency</p>'
        . $cards . '</div></body></html>';

    file_put_contents(rtrim($saveDir, '/') . '/index.html', $html);
    echo "Contact sheet: ", rtrim($saveDir, '/'), "/index.html\n\n";
}

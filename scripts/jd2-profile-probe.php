<?php
/**
 * jd2-profile-probe.php — can every bench profile finish an SVG on every pool
 * model? (2026-10-02). CLI only; nothing is written to any database.
 *
 *   php scripts/jd2-profile-probe.php                       # the PLAN: what each cell would send (free)
 *   JD_PROFILE_LIVE=1 php scripts/jd2-profile-probe.php     # LIVE: 12 small calls, real money
 *   JD_PROFILE_LIVE=1 php scripts/jd2-profile-probe.php --web   # LIVE: 16 — the visitor's web profile too
 *
 * Options: --model ID (one pool model id, e.g. kimi-k3), --profile NAME (one
 * of bench-low, bench-medium, bench-max, web) — together they re-run one
 * cell; --web (add the web profile to the default three bench profiles);
 * --prompt TEXT (default "a plain red circle"); --json FILE (also write every
 * cell, with the provider's raw usage object, as JSON lines); --save DIR
 * (2026-10-03: also write each cell's drawing to DIR as
 * <model>.<profile>.svg — the SERVED svg, sanitized — and its byte-exact
 * reply as <model>.<profile>.raw.txt, so a real prompt can be looked at,
 * not just passed).
 *
 * The web profile (2026-10-02, the pool refresh) is the visitor turn's: its
 * own 12000 budget and the visitor's JD_PROVIDER_TIMEOUT, both through the
 * same jd_provider_call(). It is off by default so the bench check stays the
 * 12 calls it always was; --web adds it, --profile web runs it alone.
 *
 * WHY. The first live batch at the pre-split `bench` profile ran every model
 * at its top setting inside one shared 12000-token budget, and two of four
 * could not finish: Opus 5 spent all 12000 output tokens thinking (stop
 * max_tokens, no text), Gemini 3.1 Pro was cut off ~1.3 KB into its SVG.
 * The profiles now carry their own budgets (api/jd-config.php
 * JD_MAX_TOKENS_BY_PROFILE). This sends ONE tiny prompt per (model, profile)
 * through the real provider path — jd_provider_call() in api/jd-provider.php,
 * the real JD_SYSTEM_PROMPT, the profile's real effort fragment and budget —
 * and reports whether an SVG came back. It proves the parameters are
 * accepted and that a profile CAN finish; the batch confirms it on real
 * prompts.
 *
 * WHAT IT PRINTS, per cell: model · profile · the effort value sent · HTTP ·
 * stop reason (the provider's own: Anthropic stop_reason, OpenAI/Kimi
 * finish_reason, Gemini finishReason) · output tokens (everything billed as
 * output, thinking included — jd-usage.php's `output` bucket) · thinking
 * tokens (its `reasoning` bucket: Anthropic output_tokens_details.
 * thinking_tokens, OpenAI/Kimi reasoning_tokens, Gemini thoughtsTokenCount)
 * · latency · cost (jd-prices.json) · SVG: `ok` when
 * jd_extract_svg() found one AND jd_sanitize_svg() passed it, else why not
 * · normalized: what the sanitizer changed (jd2_normalized_column(); `—`
 * when nothing).
 *
 * The cells (12, or 16 with --web) run as concurrent child processes of this script
 * (--cell MODEL:PROFILE prints one JSON line), so the wall time is the
 * slowest cell's, not the sum. Keys come from config/secrets.php through
 * jd_provider_key(); only the slot NAME is ever printed.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/jd2-config.php';
require_once __DIR__ . '/../api/jd-provider.php';
require_once __DIR__ . '/../api/jd-svg-sanitizer.php';
require_once __DIR__ . '/../api/jd-usage.php';

const PROBE_PROFILES = ['bench-low', 'bench-medium', 'bench-max'];
// every profile a cell may run: the bench three plus the visitor's web profile
const PROBE_ALL_PROFILES = ['bench-low', 'bench-medium', 'bench-max', 'web'];

$args = array_slice($argv, 1);
$opt = ['model' => null, 'profile' => null, 'prompt' => 'a plain red circle', 'json' => null, 'cell' => null, 'web' => false, 'save' => null];
for ($i = 0; $i < count($args); $i++) {
    $a = $args[$i];
    $name = substr($a, 2);
    if ($a === '--web') {
        $opt['web'] = true;
    } elseif (in_array($a, ['--model', '--profile', '--prompt', '--json', '--cell', '--save'], true)) {
        $opt[$name] = $args[++$i] ?? probe_bail("$a needs a value.");
    } else {
        probe_bail("Unknown argument $a. See the header of scripts/jd2-profile-probe.php.");
    }
}
$live = getenv('JD_PROFILE_LIVE') === '1';

$taxonomy = jd_taxonomy();
if (!is_array($taxonomy)) {
    probe_bail('taxonomy.json is missing or unreadable.');
}
$pool = [];
foreach (jd2_pool($taxonomy) as $m) {
    $pool[$m['model_id']] = $m;
}

// --- one cell (a child process): one call, one JSON line --------------------
if ($opt['cell'] !== null) {
    [$modelId, $profile] = array_pad(explode(':', $opt['cell'], 2), 2, '');
    if (!isset($pool[$modelId]) || !in_array($profile, PROBE_ALL_PROFILES, true)) {
        probe_bail("--cell must be MODEL:PROFILE with a pool model and a probe profile.");
    }
    echo json_encode(probe_cell($pool[$modelId], $profile, $opt['prompt'], $opt['save']), JSON_UNESCAPED_SLASHES) . "\n";
    exit(0);
}

$models = $opt['model'] === null ? array_keys($pool) : [$opt['model']];
$profiles = $opt['profile'] !== null ? [$opt['profile']]
    : ($opt['web'] ? PROBE_ALL_PROFILES : PROBE_PROFILES);
foreach ($models as $m) {
    if (!isset($pool[$m])) {
        probe_bail("--model $m is not in the pool (" . implode(', ', array_keys($pool)) . ').');
    }
}
foreach ($profiles as $p) {
    if (!in_array($p, PROBE_ALL_PROFILES, true)) {
        probe_bail("--profile $p is not one of " . implode(', ', PROBE_ALL_PROFILES) . '.');
    }
}
if ($opt['save'] !== null) {
    if (!is_dir($opt['save']) && !mkdir($opt['save'], 0775, true)) {
        probe_bail("--save {$opt['save']}: cannot create the directory.");
    }
    $opt['save'] = realpath($opt['save']);
}

echo 'jd2-profile-probe · prompt "' . $opt['prompt'] . '" · ' . count($models) . ' model(s) × ' . count($profiles)
    . ' profile(s) · ' . ($live ? 'LIVE (real money)' : 'plan only (JD_PROFILE_LIVE=1 to spend)') . "\n";

if (!$live) {
    foreach ($models as $m) {
        foreach ($profiles as $p) {
            $prov = $pool[$m]['provider'];
            $slot = jd_provider_key_slot($prov)['slot'] ?? 'NO KEY';
            echo sprintf("  %-15s %-13s %-9s key slot %-15s params %s\n", $m, $p, jd_harness($p), $slot,
                jd_provider_params($prov, $p));
        }
    }
    echo "plan only: nothing sent.\n";
    exit(0);
}

// --- live: every cell at once, as child processes ---------------------------
$procs = [];
foreach ($models as $m) {
    foreach ($profiles as $p) {
        $cmd = [PHP_BINARY, __FILE__, '--cell', "$m:$p", '--prompt', $opt['prompt']];
        if ($opt['save'] !== null) {
            array_push($cmd, '--save', $opt['save']);
        }
        $proc = proc_open($cmd, [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        $procs[] = ['m' => $m, 'p' => $p, 'proc' => $proc, 'out' => $pipes[1], 'err' => $pipes[2]];
    }
}
$cells = [];
foreach ($procs as $c) {
    $out = stream_get_contents($c['out']);
    $err = stream_get_contents($c['err']);
    fclose($c['out']);
    fclose($c['err']);
    proc_close($c['proc']);
    $row = json_decode(trim((string) $out), true);
    $cells[] = is_array($row) ? $row : ['model' => $c['m'], 'profile' => $c['p'], 'error' => 'child failed: ' . trim($err . ' ' . $out)];
}

$order = array_flip(PROBE_ALL_PROFILES);
usort($cells, fn ($a, $b) => [$a['model'], $order[$a['profile']] ?? 9] <=> [$b['model'], $order[$b['profile']] ?? 9]);
echo "\n| model | profile | harness | effort sent | budget | HTTP | stop | output tok | thinking tok | latency | cost | SVG | normalized |\n";
echo "|---|---|---|---|---|---|---|---|---|---|---|---|---|\n";
$total = 0.0;
foreach ($cells as $c) {
    $total += (float) ($c['cost_usd'] ?? 0);
    echo sprintf("| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %s |\n",
        $c['model'], $c['profile'], $c['harness'] ?? '—', $c['effort'] ?? '—', $c['max_tokens'] ?? '—', $c['http'] ?? '—',
        $c['stop'] ?? '—', $c['output'] ?? '—', $c['reasoning'] ?? '—',
        isset($c['latency_s']) ? sprintf('%.1f s', $c['latency_s']) : '—',
        isset($c['cost_usd']) ? sprintf('$%.4f', $c['cost_usd']) : 'unpriced',
        $c['svg'] ?? ('error: ' . ($c['error'] ?? '?')), $c['normalized'] ?? '—');
}
echo sprintf("\ntotal $%.4f\n", $total);
foreach ($cells as $c) {
    if (($c['svg'] ?? '') !== 'ok' && !empty($c['error_body'])) {
        echo "\n{$c['model']} · {$c['profile']}: " . $c['error_body'] . "\n";
    }
}
if ($opt['save'] !== null) {
    echo "\nsaved each cell's served svg and raw reply in {$opt['save']}\n";
}
if ($opt['json'] !== null) {
    file_put_contents($opt['json'], implode('', array_map(fn ($c) => json_encode($c, JSON_UNESCAPED_SLASHES) . "\n", $cells)));
    echo "\nwrote {$opt['json']}\n";
}
exit(count(array_filter($cells, fn ($c) => ($c['svg'] ?? '') !== 'ok')) === 0 ? 0 : 1);

// ===========================================================================

function probe_bail(string $msg): never
{
    fwrite(STDERR, $msg . "\n");
    exit(2);
}

/** One call through the real provider path, measured and judged. */
function probe_cell(array $m, string $profile, string $prompt, ?string $saveDir = null): array
{
    $provider = $m['provider'];
    $effort = jd_effort($provider, $profile);
    $effortWord = $effort['output_config']['effort'] ?? $effort['reasoning_effort'] ?? $effort['thinking_level'] ?? '—';
    $started = microtime(true);
    $r = jd_provider_call($provider, $m['api_model'], $prompt, $profile);
    $latency = microtime(true) - $started;

    $usage = is_array($r['usage'] ?? null) ? $r['usage'] : [];
    $cost = jd_generation_cost($provider, $m['api_model'], $usage ?: null);
    $t = $cost['tokens'];
    $svg = 'no answer';
    $bytes = null;
    $normalized = null;
    $stem = $saveDir === null ? null : $saveDir . '/' . $m['model_id'] . '.' . $profile;
    if ($stem !== null && isset($r['raw'])) {
        file_put_contents("$stem.raw.txt", (string) $r['raw']);
    }
    if (!empty($r['ok'])) {
        $extracted = jd_extract_svg((string) $r['raw']);
        if ($extracted === null) {
            $svg = 'no_svg_found';
        } else {
            $verdict = jd_sanitize_svg($extracted);
            $svg = !empty($verdict['ok']) ? 'ok' : 'rejected: ' . ($verdict['reason'] ?? '?');
            $bytes = strlen($extracted);
            if (!empty($verdict['ok'])) {
                $normalized = jd2_normalized_column($verdict);
                if ($stem !== null) {
                    file_put_contents("$stem.svg", $verdict['svg']);
                }
            }
        }
    } elseif (($r['error'] ?? '') !== '') {
        $svg = (string) $r['error'];
    }
    return [
        'model' => $m['model_id'],
        'api_model' => $m['api_model'],
        'profile' => $profile,
        'harness' => jd_harness($profile),
        'effort' => $effortWord,
        'max_tokens' => jd_max_tokens($profile),
        'http' => (int) ($r['http_code'] ?? 0),
        'stop' => $r['stop'] ?? null,
        'output' => $t['output'] ?? null,
        'reasoning' => $t['reasoning'] ?? null,
        'latency_s' => round($latency, 1),
        'cost_usd' => $cost['cost_usd'] === null ? null : round($cost['cost_usd'], 6),
        'svg' => $svg,
        'svg_bytes' => $bytes,
        'normalized' => $normalized,
        'error' => $r['error'] ?? null,
        // a refusal's body (the vendor's own error text) is short and is the evidence
        'error_body' => empty($r['ok']) ? mb_substr((string) ($r['raw'] ?? ''), 0, 600) : null,
        'usage' => $usage,
    ];
}

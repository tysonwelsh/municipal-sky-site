<?php
/**
 * jd-bench-run.php — the CONTROLLED rerun harness. CLI only.
 *
 *   php api/jd-bench-run.php --dry-run --all        # show the exact wire payloads
 *   php api/jd-bench-run.php 2026-08-09-mao-badge   # rerun one item
 *   php api/jd-bench-run.php --all --limit 5        # rerun the first five
 *
 * WHAT THIS IS FOR
 * The curated corpus was never a controlled comparison: 77 responses across
 * six model ids, generated over weeks, some one-shot and some refined over
 * several prompts, under harnesses that changed underneath them. Nothing about
 * it supports "model A beats model B".
 *
 * This produces the thing that does: one prompt, one harness, one effort
 * condition, four models, every item — every generation stamped with the
 * profile that made it so the two can never be pooled by accident.
 *
 * WHY IT IS NOT THE WEB PATH
 * jd-generate.php answers a visitor watching a loading animation, so it caps
 * at JD_PROVIDER_TIMEOUT (90s) and buys that latency with thinking. Raising
 * effort there would not just be slow — generations would time out UNEVENLY,
 * failing most for whichever model thinks longest. That is missing data
 * correlated with the variable under study, which is worse than uniform
 * throttling. CLI has no execution limit, so the benchmark simply waits.
 *
 * WEB IS UNTOUCHED. This never runs over HTTP (see the SAPI guard) and calls
 * with profile 'bench'; jd_provider_call defaults to 'web', so v3-web.1 is
 * byte-identical to what it was.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo "CLI only. This spends real money at four providers.\n";
    exit(1);
}

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-provider.php';
require_once __DIR__ . '/jd-svg-sanitizer.php';
require_once __DIR__ . '/jd-usage.php';
require_once __DIR__ . '/jd-build.php';
// JD_DEV_MODE routes to the mock so the write path can be exercised without
// spending anything. jd-generate.php applies the mock at its CALL SITE rather
// than inside jd_provider_call, so a runner that called the provider layer
// directly would hit the real paid APIs even in dev mode — this mirrors the
// same switch deliberately.
if (JD_DEV_MODE) {
    require_once __DIR__ . '/jd-mock-provider.php';
}

const BENCH_PROFILE = 'bench';

$args   = array_slice($argv, 1);
$dryRun = in_array('--dry-run', $args, true);
$all    = in_array('--all', $args, true);
$limit  = null;
foreach ($args as $i => $a) {
    if ($a === '--limit' && isset($args[$i + 1])) {
        $limit = (int) $args[$i + 1];
    }
}
$ids = array_values(array_filter($args, fn($a) => $a[0] !== '-' && !ctype_digit($a)));

$ITEMS = __DIR__ . '/../art/junk-drawer/items';

// --- which items -----------------------------------------------------------
$targets = [];
foreach (glob($ITEMS . '/*/entry.json') as $path) {
    $e = json_decode((string) file_get_contents($path), true);
    if (!is_array($e) || empty($e['id']) || empty($e['prompt'])) {
        continue;
    }
    if (!empty($e['retired'])) {
        continue;                       // retired items are out of the drawer
    }
    if ($all || in_array($e['id'], $ids, true)) {
        $targets[$e['id']] = $e;
    }
}
ksort($targets);
if ($limit !== null) {
    $targets = array_slice($targets, 0, $limit, true);
}
if (!$targets) {
    fwrite(STDERR, "Nothing to run. Pass item ids, or --all.\n");
    exit(1);
}

$pool = JD_MODEL_POOL;

echo "build          : " . jd_build_line() . "\n";
echo "harness        : " . jd_harness(BENCH_PROFILE) . "\n";
echo "effort profile : " . BENCH_PROFILE . "\n";
echo "timeout        : " . JD_BENCH_TIMEOUT . "s per call\n";
echo "items          : " . count($targets) . "  (x " . count($pool) . " models = "
     . (count($targets) * count($pool)) . " generations)\n";
echo "mode           : " . (JD_DEV_MODE ? "*** MOCK (JD_DEV_MOCK=1) — not real models ***" : "LIVE — real providers, real money") . "\n";
echo str_repeat('-', 72) . "\n";

// --- dry run: show exactly what goes on the wire ---------------------------
// The point of the dry run is that the effort condition is auditable BEFORE
// spending anything: if a vendor renames a knob, it shows up here, not as a
// silently-degraded run recorded as if it were max effort.
if ($dryRun) {
    $sample = reset($targets);
    echo "DRY RUN — no provider called, nothing written.\n\n";
    echo "Sample prompt (" . $sample['id'] . "):\n  "
         . substr((string) $sample['prompt'], 0, 100) . "...\n\n";
    foreach ($pool as $m) {
        $p = $m['provider'];
        echo str_pad($m['model_id'], 20) . " [" . $p . "]\n";
        echo "   web   : " . json_encode(jd_effort($p, 'web')) . "\n";
        echo "   bench : " . json_encode(jd_effort($p, BENCH_PROFILE)) . "\n";
        echo "   recorded params: " . jd_provider_params($p, BENCH_PROFILE) . "\n\n";
    }
    echo "Items that would run:\n";
    foreach ($targets as $id => $e) {
        echo "  $id\n";
    }
    exit(0);
}

// --- live ------------------------------------------------------------------
$db = jd_db();
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$curator = jd_curator_hash();

$totalCost = 0.0; $okCount = 0; $failCount = 0;

foreach ($targets as $itemId => $entry) {
    echo "\n=== $itemId\n";

    // A rerun is its own SUBMISSION, never an append to the curated one. slot
    // is ENUM('a'..'d') UNIQUE per submission, so one submission per
    // generation EVENT is what keeps the 4-slot ceiling true forever; items
    // accumulate submissions and join on item_id.
    $subId = jd_ulid();
    $db->prepare(
        'INSERT INTO jd_submissions
            (id, client_ref, item_id, created, prompt, visitor_hash, client,
             pair_order, ai_consent_at, ai_consent_version, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)'
    )->execute([
        $subId,
        sprintf('%08x-%04x-4%03x-%04x-%012x', random_int(0, 0xffffffff), random_int(0, 0xffff),
                random_int(0, 0xfff), random_int(0x8000, 0xbfff), random_int(0, 0xffffffffffff)),
        $itemId,
        gmdate('Y-m-d H:i:s'),
        (string) $entry['prompt'],
        $curator,
        'bench',
        -1,            // no shuffle: every model draws, and the slot letter is
                       // assigned by pool order, not by a blind permutation
        'generated',
    ]);

    $slots = ['a', 'b', 'c', 'd'];
    foreach ($pool as $i => $model) {
        $slot     = $slots[$i];
        $provider = $model['provider'];
        $genId    = jd_ulid();

        $db->prepare(
            'INSERT INTO jd_generations
                (id, submission_id, slot, model_id, model_version, provider,
                 harness, params, status, disobedience, created)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)'
        )->execute([
            $genId, $subId, $slot, $model['model_id'], $model['api_model'], $provider,
            jd_harness(BENCH_PROFILE),
            jd_provider_params($provider, BENCH_PROFILE),
            'pending', gmdate('Y-m-d H:i:s'),
        ]);

        printf("  %-18s ", $model['model_id']);
        flush();

        $started = microtime(true);
        $res = JD_DEV_MODE
            ? jd_mock_call($provider, (string) $entry['prompt'])
            : jd_provider_call($provider, $model['api_model'], (string) $entry['prompt'], BENCH_PROFILE);
        $ms  = (int) round((microtime(true) - $started) * 1000);

        $raw   = (string) ($res['raw'] ?? '');
        $usage = !empty($res['usage']) ? $res['usage'] : [];
        // Priced through the same jd-usage.php path the reveal uses, keyed by
        // model_version (the wire string) — this used to read the raw prices
        // file and key by model_id, which priced everything $0. cost_usd is
        // null (printed 'unpriced'), never $0, when no rate or usage exists.
        $priced = jd_generation_cost($provider, $model['api_model'], $usage);
        $norm   = $priced['tokens'] ?? [];
        $cost   = $priced['cost_usd'];
        if ($cost !== null) {
            $totalCost += $cost;
        }

        $fields = [
            'raw_response' => $raw,
            'latency_ms'   => $ms,
            'usage_tokens' => $usage ? json_encode($usage) : null,
        ];

        if (empty($res['ok'])) {
            $fields['status'] = 'failed';
            $failCount++;
            printf("FAILED  %5.1fs  %s\n", $ms / 1000, (string) ($res['error'] ?? 'provider error'));
        } else {
            // Same extraction and sanitising the web path uses — a benchmark
            // that accepted artwork the site would reject is measuring
            // something the drawer never shows.
            $extracted = jd_extract_svg($raw);
            if ($extracted === null) {
                $fields['status'] = 'rejected';
                $fields['reject_reason'] = 'no_svg_found';
                $failCount++;
                printf("NO SVG  %5.1fs\n", $ms / 1000);
            } else {
                $fields['disobedience'] = trim($raw) !== $extracted ? 1 : 0;
                $verdict = jd_sanitize_svg($extracted);
                if (empty($verdict['ok'])) {
                    $fields['status'] = 'rejected';
                    $fields['reject_reason'] = $verdict['reason'];
                    $failCount++;
                    printf("REJECT  %5.1fs  %s\n", $ms / 1000, (string) $verdict['reason']);
                } else {
                    $fields['status'] = 'ok';
                    $fields['svg'] = $verdict['svg'];
                    $okCount++;
                    printf("ok      %5.1fs  reasoning %6s tok  %s%s\n",
                        $ms / 1000,
                        isset($norm['reasoning']) ? number_format($norm['reasoning']) : '?',
                        $cost !== null ? sprintf('$%.4f', $cost) : 'unpriced',
                        !empty($fields['disobedience']) ? '  (disobedience)' : '');
                }
            }
        }

        $sets = []; $vals = [];
        foreach ($fields as $k => $v) { $sets[] = "$k = ?"; $vals[] = $v; }
        $vals[] = $genId;
        $db->prepare('UPDATE jd_generations SET ' . implode(', ', $sets) . ' WHERE id = ?')
           ->execute($vals);
    }
}

echo "\n" . str_repeat('-', 72) . "\n";
printf("done  ok %d  failed/rejected %d  cost $%.4f  harness %s\n",
    $okCount, $failCount, $totalCost, jd_harness(BENCH_PROFILE));
echo "Generations are in jd_generations with svg in the DB — the curated .svg\n";
echo "files on disk are untouched. Promote a rerun into the collection only\n";
echo "deliberately; nothing here enters git on its own.\n";

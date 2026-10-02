<?php
/**
 * jd2-intake-check.php — the agreement check (PLAN-INTAKE §2): run the
 * intake clerk on the 67 v1 prompts the owner sized and titled by hand, and
 * set the clerk's answers beside the owner's. CLI only; nothing is written
 * anywhere (no database, no file).
 *
 *   php scripts/jd2-intake-check.php                      # the MOCK clerk (free; proves the script)
 *   JD_INTAKE_LIVE=1 php scripts/jd2-intake-check.php     # the REAL clerk: 67 Sonnet calls, real money
 *
 * Options: --items DIR (default ~/Media/junk-drawer-v1/2026-10-01/items),
 * --limit N (the first N items only), --json FILE (also write every row as
 * JSON lines — prompt, owner's title and size, the clerk's full answer or
 * error, usage, cost — for a closer read).
 *
 * THE CALL is the endpoint's own: jd2_intake_answer() in
 * api/jd2-intake-prompt.php — the same rendered system prompt, user turn,
 * schema, model and settings (claude-sonnet-5-5, effort low, max_tokens
 * 1024) — called directly, not through api/jd2-intake.php, so no prompt row
 * is needed and none is touched. The key is the clerk's slot,
 * `jd_intake_key`, falling back to jd_claude_key → claude_key, read from
 * config/secrets.php (only the slot's NAME is printed).
 *
 * WHAT IT PRINTS: one row per item — the prompt (clipped), the owner's size,
 * the clerk's size, the clerk's heading (the owner's v1 title beside it), and
 * the headings per facet; then a 5×5 confusion matrix (owner's tier down,
 * the clerk's across), the exact and the within-one-tier agreement rates
 * over the items the clerk answered, the failures (a fallback, with why),
 * and the total cost. The owner's v1 sizes stay the archive's record: they
 * were chosen under the old tier wording, before the 2026-10-02 rulings
 * (e.g. the rocket ship is large now), so disagreement is information about
 * the prompt's wording, not an error in either.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}

require_once __DIR__ . '/../api/jd2-intake-prompt.php';

$live = getenv('JD_INTAKE_LIVE') === '1';
$args = array_slice($argv, 1);
$opt = ['items' => (getenv('HOME') ?: '') . '/Media/junk-drawer-v1/2026-10-01/items', 'limit' => null, 'json' => null];
for ($i = 0; $i < count($args); $i++) {
    $a = $args[$i];
    if (in_array($a, ['--items', '--limit', '--json'], true)) {
        $opt[substr($a, 2)] = $args[++$i] ?? null;
    } else {
        fwrite(STDERR, "Unknown argument $a. See the header of scripts/jd2-intake-check.php.\n");
        exit(2);
    }
}

$taxonomy = jd_taxonomy();
if (!is_array($taxonomy)) {
    fwrite(STDERR, "taxonomy.json is missing or unreadable.\n");
    exit(2);
}
$tiers = array_map('strval', array_keys(jd_size_tiers($taxonomy)));
$facets = jd2_facets($taxonomy);

$files = glob(rtrim((string) $opt['items'], '/') . '/*/entry.json') ?: [];
sort($files);
if ($files === []) {
    fwrite(STDERR, "No entry.json under {$opt['items']} — pass --items DIR.\n");
    exit(2);
}
$items = [];
foreach ($files as $f) {
    $e = json_decode((string) file_get_contents($f), true);
    if (is_array($e) && is_string($e['prompt'] ?? null) && trim($e['prompt']) !== '') {
        $items[] = ['id' => (string) ($e['id'] ?? basename(dirname($f))), 'prompt' => $e['prompt'],
                    'title' => (string) ($e['title'] ?? ''), 'size' => (string) ($e['sizeClass'] ?? '')];
    }
}
if ($opt['limit'] !== null) {
    $items = array_slice($items, 0, max(0, (int) $opt['limit']));
}

$model = jd2_utility_model($taxonomy, 'intake')['api_model'];
$slot = $live ? (jd_provider_key_slot('anthropic', 'intake')['slot'] ?? 'none') : null;
echo 'jd2-intake-check · ' . count($items) . ' v1 items · ' . jd2_intake_version($taxonomy) . ' · taxonomy v'
    . jd_taxonomy_version($taxonomy) . ' · ' . ($live ? "LIVE: $model, key slot $slot" : 'MOCK clerk (JD_INTAKE_LIVE=1 for the real one)') . "\n\n";
if ($live && $slot === 'none') {
    fwrite(STDERR, "No Anthropic key on file (jd_intake_key, jd_claude_key, claude_key in config/secrets.php).\n");
    exit(2);
}

$jsonOut = $opt['json'] !== null ? fopen((string) $opt['json'], 'w') : null;
$matrix = array_fill_keys($tiers, array_fill_keys($tiers, 0));
$answered = 0;
$exact = 0;
$within = 0;
$cost = 0.0;
$unpriced = 0;
$failures = [];
$rank = array_flip($tiers);

echo pad('prompt', 44) . ' ' . pad('owner', 5) . ' ' . pad('model', 5) . ' ' . pad('model heading (owner title)', 40) . " tags\n";
echo str_repeat('-', 140) . "\n";
foreach ($items as $it) {
    $res = jd2_intake_answer($taxonomy, $it['prompt'], !$live);
    if ($res['cost_usd'] !== null) {
        $cost += (float) $res['cost_usd'];
    } elseif (isset($res['record']['cost_usd'])) {
        $cost += (float) $res['record']['cost_usd'];   // a failed call that was still billed
    } elseif ($live && isset($res['record']['usage'])) {
        $unpriced++;
    }
    if ($jsonOut) {
        fwrite($jsonOut, json_encode(['id' => $it['id'], 'prompt' => $it['prompt'], 'owner_title' => $it['title'],
            'owner_size' => $it['size'], 'ok' => $res['ok'], 'title' => $res['title'], 'size' => $res['size'],
            'tags' => $res['tags'], 'reasons' => $res['reasons'], 'error' => $res['error'],
            'record' => $res['record'], 'cost_usd' => $res['cost_usd']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    }
    if (!$res['ok']) {
        $tried = $res['record']['answer']['title'] ?? ($res['record']['first_answer']['title'] ?? null);
        $failures[] = [$it['id'], (string) ($res['record']['error']['message'] ?? $res['error'] ?? 'failed')
            . ($tried !== null ? ' — tried: "' . $tried . '"' : '')];
        echo pad(clip($it['prompt'], 44), 44) . ' ' . pad($it['size'] ?: '—', 5) . ' ' . pad('—', 5) . ' FALLBACK ('
            . ($res['error'] ?? 'failed') . ")\n";
        continue;
    }
    $answered++;
    $tagText = [];
    foreach ($facets as $f) {
        if (($res['tags'][$f['id']] ?? []) !== []) {
            $tagText[] = $f['id'] . ': ' . implode(',', $res['tags'][$f['id']]);
        }
    }
    echo pad(clip($it['prompt'], 44), 44) . ' ' . pad($it['size'] ?: '—', 5) . ' ' . pad((string) $res['size'], 5) . ' '
        . pad(clip($res['title'] . ' (' . $it['title'] . ')', 40), 40) . ' ' . implode(' · ', $tagText) . "\n";
    if (isset($rank[$it['size']], $rank[$res['size']])) {
        $matrix[$it['size']][$res['size']]++;
        $exact += $it['size'] === $res['size'] ? 1 : 0;
        $within += abs($rank[$it['size']] - $rank[$res['size']]) <= 1 ? 1 : 0;
    }
}
if ($jsonOut) {
    fclose($jsonOut);
}

$scored = array_sum(array_map('array_sum', $matrix));
echo "\nconfusion matrix — owner's v1 tier (rows) × the clerk's tier (columns)\n";
printf("%-8s", 'owner\\m');
foreach ($tiers as $t) {
    printf("%5s", $t);
}
printf("%7s\n", 'total');
foreach ($tiers as $o) {
    printf("%-8s", $o);
    foreach ($tiers as $m) {
        $cell = $matrix[$o][$m] === 0 ? '·' : (string) $matrix[$o][$m];
        echo str_repeat(' ', 5 - mb_strlen($cell)) . $cell;
    }
    printf("%7d\n", array_sum($matrix[$o]));
}
printf("%-8s", 'total');
foreach ($tiers as $m) {
    printf("%5d", array_sum(array_column($matrix, $m)));
}
printf("%7d\n", $scored);

echo "\n";
printf("answered: %d of %d (%d fell back)\n", $answered, count($items), count($failures));
if ($scored > 0) {
    printf("exact agreement:         %d of %d = %.1f%%\n", $exact, $scored, 100 * $exact / $scored);
    printf("within one tier:         %d of %d = %.1f%%\n", $within, $scored, 100 * $within / $scored);
}
foreach ($failures as [$id, $why]) {
    echo "  fell back: $id — $why\n";
}
printf("total cost: $%.4f%s\n", $cost, $live ? ($unpriced ? " ($unpriced call(s) unpriced)" : '') : ' (the mock is free)');
exit(0);

/** Left-justify to $n characters (not bytes: the prompts carry curly quotes and dashes). */
function pad(string $s, int $n): string
{
    return $s . str_repeat(' ', max(0, $n - mb_strlen($s)));
}

function clip(string $s, int $n): string
{
    $s = preg_replace('/\s+/u', ' ', trim($s));
    return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s;
}

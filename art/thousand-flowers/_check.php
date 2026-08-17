<?php
/**
 * _check.php — headless verdict harness for the A Thousand Flowers substrate.
 *
 *   php _check.php                 # sample spool, pinned demo clock
 *   php _check.php spool/          # another spool dir (relative to this file)
 *   php _check.php mockups/sample-spool/ 2026-08-25T00:00:00Z
 *
 * Prints a verdict table: articles parsed, threads, gated (in transit), and a
 * per-article line with arrival gate and era-shifted dates. Exit 0 on PASS.
 */

require_once __DIR__ . '/flowers-lib.php';

$dir = isset($argv[1]) ? $argv[1] : 'mockups/sample-spool/';
$nowArg = isset($argv[2]) ? $argv[2] : '2026-08-14T12:00:00Z';

$relay = flowers_load_relay(__DIR__ . '/relay.json');
$path  = (substr($dir, 0, 1) === '/') ? $dir : __DIR__ . '/' . $dir;

$files   = is_dir($path) ? (array) glob(rtrim($path, '/') . '/*.msg') : array();
$spool   = flowers_load_spool($path);
$now     = flowers_now($nowArg);
$arrived = flowers_arrived($spool, $now);
$inbound = flowers_in_transit($spool, $now, $relay);
$threads = flowers_build_threads($arrived);

$line = str_repeat('-', 78);
echo "A THOUSAND FLOWERS — substrate check\n$line\n";
echo "spool dir     : $dir\n";
echo "clock (real)  : " . $now->format('Y-m-d\TH:i:s\Z') . "\n";
echo "clock (era)   : " . flowers_era_datetime($now, $relay) . "\n";
echo "group         : " . $relay['group'] . "\n";
echo "era offset    : +" . $relay['eraOffsetYears'] . " years\n";
echo "$line\n";
printf("%-8s %-10s %-11s %-9s %-9s %s\n", 'SEQ', 'COLONY', 'STATE', 'WRITTEN', 'ARRIVES', 'SUBJECT');
echo "$line\n";

$byArrival = $spool;
uasort($byArrival, function ($a, $b) {
    return strcmp((string) $a['seq'], (string) $b['seq']);
});
foreach ($byArrival as $a) {
    $gated = !flowers_has_arrived($a, $now);
    printf(
        "%-8s %-10s %-11s %-9s %-9s %s\n",
        $a['seq'],
        $a['colony'],
        $gated ? 'IN TRANSIT' : 'arrived',
        flowers_era_date($a['date'], $relay, 'j M Y'),
        flowers_era_date($a['arrives'], $relay, 'j M Y'),
        $gated ? '(withheld until arrival)' : $a['subject']
    );
}

echo "$line\nTHREADS\n";
foreach ($threads as $t) {
    foreach (flowers_flatten_thread($t) as $n) {
        echo str_repeat('  ', $n['depth']) . ($n['depth'] ? '└ ' : '* ')
            . '#' . $n['seq'] . ' ' . $n['from_name'] . ' — ' . $n['subject'] . "\n";
    }
    echo "  (" . flowers_thread_count($t) . " articles)\n";
}

echo "$line\nINBOUND (disclosed fields only)\n";
if (!count($inbound)) {
    echo "  none\n";
}
foreach ($inbound as $t) {
    echo "  · inbound from " . $t['colony_title'] . ", arrives " . $t['arrives_display'] . " ·\n";
}

// ── Assertions ───────────────────────────────────────────────────────────
$checks = array();
$checks['spool files found']       = count($files) > 0;
$checks['every file parsed']       = count($spool) === count($files);
$checks['relay.json loaded']       = count($relay['nodes']) > 0;
$checks['some articles arrived']   = count($arrived) > 0;
$checks['threads built']           = count($threads) > 0;
$checks['gating consistent']       = count($arrived) + count($inbound) === count($spool);
$checks['era offset applied']      = strpos(flowers_era_date('2026-08-04T00:00:00Z', $relay), '3042') !== false;

// In-transit records must expose colony + arrival ONLY.
$leak = false;
foreach ($inbound as $t) {
    foreach (array_keys($t) as $k) {
        if (!in_array($k, array('colony', 'colony_title', 'arrives', 'arrives_display'), true)) {
            $leak = true;
        }
    }
}
$checks['in-transit leaks nothing'] = !$leak;

// Malformed input must not fatal.
$checks['malformed text survives'] = flowers_parse_article_text("not an article at all") === null
    && flowers_parse_article_file('/no/such/file.msg') === null;

echo "$line\nVERDICT\n";
printf("  %-28s %d\n", 'files on disk', count($files));
printf("  %-28s %d\n", 'articles parsed', count($spool));
printf("  %-28s %d\n", 'arrived (visible)', count($arrived));
printf("  %-28s %d\n", 'gated (in transit)', count($inbound));
printf("  %-28s %d\n", 'threads', count($threads));
echo "$line\n";
$ok = true;
foreach ($checks as $name => $pass) {
    printf("  [%s] %s\n", $pass ? 'PASS' : 'FAIL', $name);
    $ok = $ok && $pass;
}
echo "$line\n" . ($ok ? "ALL CHECKS PASS\n" : "CHECKS FAILED\n");
exit($ok ? 0 : 1);

<?php
/**
 * jd-backfill-curated.php — file the Junk Drawer's curated collection into
 * jd_submissions / jd_generations so its responses can be rated through the
 * same jd_ratings store the turn flow already writes.
 *
 * Lives in api/ rather than scripts/ for one reason: scripts/** is excluded
 * from the deploy (deploy.yml, publish.sh), so a script there can never run
 * against the production database. Same reasoning, same ?key= gate, as
 * api/setup-jd-tables.php.
 *
 *   CLI:  JD_DEV_MOCK=1 php api/jd-backfill-curated.php --dry-run
 *         php api/jd-backfill-curated.php
 *   web:  https://municipalsky.com/api/jd-backfill-curated.php?key=<jd_setup_key>&dry-run=1
 *
 * Flags:
 *   --dry-run           report only, touch nothing
 *   --include-retired   also file items carrying "retired": true (default: skip,
 *                       they are excluded from the drawer at data.php)
 *
 * IDEMPOTENT, and since 2026-09-10 INCREMENTAL: an item already on file is
 * brought level with its entry.json — responses appended since (a harvested
 * rerun set) get generations after the ones already there, and rows that
 * already carry ratings are never touched. The mechanics live in
 * jd-curated-sync.php, which jd-item-rate.php also calls on demand, so this
 * bulk run is a convenience (the queue and the overlay see every response at
 * once) rather than a prerequisite for admin mode.
 *
 * WHAT THIS IS NOT: these rows are not visitor turns. See the item_id block in
 * api/setup-jd-tables.php before writing any report over these tables.
 */

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-curated-sync.php';

// Dataset v1 frozen (JD_V1_FROZEN, jd-config.php): file nothing. Plain text in
// this script's own voice, not the JSON 410 the other v1 writers answer: the
// deploy workflow calls this after every upload and fails unless a line starts
// with "done", so the frozen answer is a 200 whose one line starts "done" and
// the deploy stays green. A no-op until the cutover.
if (JD_V1_FROZEN) {
    if (PHP_SAPI !== 'cli') {
        header('Content-Type: text/plain; charset=utf-8');
    }
    echo "done — dataset v1 is frozen (JD_V1_FROZEN); nothing filed\n";
    exit(0);
}

// jd-config.php turns display_errors off, which for a maintenance script means
// a failure arrives as a blank 500. Report it here instead.
set_error_handler(function ($no, $str, $file, $line) {
    echo "PHP error: $str  ($file:$line)\n";
    return true;
});
set_exception_handler(function ($e) {
    http_response_code(500);
    echo "FAILED: " . $e->getMessage() . "\n  at " . $e->getFile() . ':' . $e->getLine() . "\n";
});

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    // Production requires the setup key: this writes rows into the live
    // tables and must not be triggerable by a stray GET.
    jd_require_setup_key("Forbidden. Call with ?key=<jd_setup_key>.\n");
}

$args           = $isCli ? array_slice($argv, 1) : [];
$dryRun         = $isCli ? in_array('--dry-run', $args, true)         : isset($_GET['dry-run']);
$includeRetired = $isCli ? in_array('--include-retired', $args, true) : isset($_GET['include-retired']);

$ITEMS = __DIR__ . '/../art/junk-drawer/items';

// --- gather ----------------------------------------------------------------

$taxonomy = jd_taxonomy();
if ($taxonomy === null) {
    fwrite(STDERR, "backfill: taxonomy.json could not be read\n");
    exit(1);
}

$entries = glob($ITEMS . '/*/entry.json');
sort($entries);
if (!$entries) {
    fwrite(STDERR, "backfill: no entry.json found under $ITEMS\n");
    exit(1);
}

$db = jd_db();

// The schema is setup-jd-tables.php's job, and only its job: this script
// refuses to run against a database the setup script has not brought up to
// date (item_id arrived 2026-08-18; the sixteen-slot column 2026-09-10).
if (!jd_has_column($db, 'jd_submissions', 'item_id')) {
    echo "jd_submissions.item_id is missing — run api/setup-jd-tables.php first.\n";
    exit(1);
}
// Same refusal for the slot column (2026-09-27): the widest entry on disk must
// fit the LIVE ENUM, or every rerun item below would fail one by one with a
// truncation warning. jd_slot_capacity reads the schema; JD_SLOT_LETTERS is
// only what the code was written for.
$widest = 0;
foreach ($entries as $path) {
    $e = json_decode((string) file_get_contents($path), true);
    if (is_array($e) && (empty($e['retired']) || $includeRetired)) {
        $widest = max($widest, count($e['responses'] ?? []));
    }
}
$capacity = jd_slot_capacity($db);
if ($capacity !== null && $widest > $capacity) {
    echo "jd_generations.slot holds only $capacity slot(s) here and the widest entry has $widest responses"
       . " — run api/setup-jd-tables.php?key=<jd_setup_key> first (db/junk-drawer-schema.md, Runbook). Nothing written.\n";
    exit(1);
}

$filedItems = 0; $appended = 0; $current = 0; $filedGens = 0; $filedSeeds = 0;
$filedAxes = 0; $leveled = 0; $leveledItems = 0;
$skipRetired = 0; $overflow = [];

foreach ($entries as $path) {
    $e = json_decode((string) file_get_contents($path), true);
    if (!is_array($e) || !isset($e['id'])) {
        fwrite(STDERR, "backfill: unreadable entry at $path\n");
        continue;
    }
    $itemId = (string) $e['id'];
    if (!empty($e['retired']) && !$includeRetired) { $skipRetired++; continue; }

    try {
        $r = jd_curated_sync($db, $e, $taxonomy, $dryRun);
    } catch (PDOException $ex) {
        fwrite(STDERR, "backfill: FAILED on $itemId — " . $ex->getMessage() . "\n");
        exit(1);
    }
    // the seeds levelled onto rows already on file (2026-09-10) — reported
    // per item, because this is what a re-run of the backfill is FOR now
    $filedAxes += $r['filed_axes'] ?? 0;
    if (!empty($r['leveled'])) {
        $leveled += $r['leveled']; $leveledItems++;
        echo sprintf("%s  %-36s %d seed row(s) onto rows already filed\n", $dryRun ? 'would level' : 'leveled    ', $itemId, $r['leveled']);
    }
    switch ($r['status']) {
        case 'filed':
            $filedItems++; $filedGens += $r['filed_gens']; $filedSeeds += $r['filed_seeds'];
            echo sprintf("%s  %-36s %d response(s)\n", $dryRun ? 'would file ' : 'filed      ', $itemId, $r['filed_gens']);
            break;
        case 'appended':
            $appended++; $filedGens += $r['filed_gens']; $filedSeeds += $r['filed_seeds'];
            echo sprintf("%s  %-36s +%d response(s) (now %d)\n", $dryRun ? 'would add  ' : 'appended   ', $itemId, $r['filed_gens'], $r['total']);
            break;
        case 'overflow':
            $overflow[] = $itemId . ' (' . $r['total'] . ' responses)';
            break;
        case 'current':
            $current++;
            break;
        default:
            break;                          // 'empty': nothing to file
    }
}

echo "\n" . ($dryRun ? "DRY RUN — nothing written\n" : "done\n");
echo "  items filed      : $filedItems\n";
echo "  items appended   : $appended\n";
echo "  already current  : $current\n";
echo "  generations      : $filedGens\n";
echo "  seed grade rows  : $filedSeeds\n";
echo "  seed axis rows   : $filedAxes (with the new rows) + $leveled leveled onto $leveledItems item(s) already on file (axes and ranks)\n";
echo "  skipped retired  : $skipRetired" . ($includeRetired ? " (--include-retired was set)" : "") . "\n";
if ($overflow) {
    echo "\n  !! REFUSED — more responses than the " . strlen(JD_SLOT_LETTERS) . " slots hold:\n";
    foreach ($overflow as $o) { echo "     $o\n"; }
    exit(1);
}

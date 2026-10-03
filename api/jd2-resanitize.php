<?php
// Junk Drawer, dataset v2 — re-check REJECTED drawings under the current
// sanitizer rules, and recover the ones that now pass.
//
//   CLI:  JD_DEV_MOCK=1 php api/jd2-resanitize.php --dry-run   (the SQLite dev database)
//         JD_DEV_MOCK=1 php api/jd2-resanitize.php
//   web:  https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>&dry-run=1
//         https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>
//
// When to run it: after a sanitizer change makes the rules more permissive
// (2026-10-02: CDATA sections are unwrapped, not refused — the Kimi K3 case).
// A drawing rejected under the old rules keeps its byte-exact raw_response,
// so it can be judged again without asking the model again.
//
// What it does: every jd2_generations row with status 'rejected' and a
// raw_response is re-extracted (jd_extract_svg) and re-sanitized
// (jd_sanitize_svg). A row that now passes gets status 'ok', the sanitized
// svg, normalized (what the sanitizer changed; NULL when nothing),
// disobedience (recomputed from raw_response by jd2-generate's rule — the
// same value already on file for a sanitizer rejection), and reject_reason
// cleared. Nothing else on the row changes: usage, latency, cost, priced,
// params, model, slot, hidden and created stay as filed. A row that still
// fails is left exactly as it was (its stored reason is the reason it was
// rejected at the time; the line printed shows today's). Then each touched
// run is re-settled by jd2-generate's rule (jd2_run_settled_status): once
// every dealt slot has settled, 'generated' if any drawing is ok — so a run
// whose every drawing had been rejected goes 'failed' → 'generated'.
//
// One line per rejected row: run, slot, model, old reason → result. With
// ?dry-run=1 (CLI --dry-run) it only lists. IDEMPOTENT: a recovered row is
// no longer 'rejected', so a second run finds nothing to do. It never
// touches a v1 jd_* table, and never a session, judgment, ranking or pair.
//
// A recovered drawing joins its run, so a sitting already filed over that run
// does not rate it and reads incomplete until the drawing is rated; such runs
// are named in the output.
//
// Production requires ?key=<jd_setup_key> (jd_require_setup_key, as the
// runners and the backfill): this writes to the live tables and must not be
// triggerable by a stray GET. The CLI and a dev box are open.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-svg-sanitizer.php';

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
    jd_require_setup_key("Forbidden. Call with ?key=<jd_setup_key>.\n");
}

$dryRun = $isCli ? in_array('--dry-run', array_slice($argv, 1), true) : isset($_GET['dry-run']);

if (!JD_DEV_MODE && !JD_IS_PRODUCTION && !is_readable(__DIR__ . '/../config/secrets.php')) {
    http_response_code(500);
    echo "No database available. Either add config/secrets.php for a local MySQL, or run with JD_DEV_MOCK=1 for the SQLite dev database.\n";
    exit(1);
}

$db = jd_db();
echo jd_db_driver($db) === 'sqlite'
    ? "Dev mode (SQLite): " . realpath(JD_DEV_DB_PATH) . "\n"
    : "MySQL\n";
echo $dryRun ? "DRY RUN — nothing is written\n\n" : "APPLYING\n\n";

if (!jd_has_column($db, 'jd2_generations', 'normalized')) {
    http_response_code(500);
    echo "jd2_generations.normalized is missing: run api/setup-jd2-tables.php first.\n";
    exit(1);
}

$rows = $db->query(
    "SELECT id, run_id, slot, model_id, reject_reason, raw_response
       FROM jd2_generations
      WHERE status = '" . JD2_GEN_REJECTED . "' AND raw_response IS NOT NULL
      ORDER BY created, run_id, slot"
)->fetchAll(PDO::FETCH_ASSOC);

$recovered = 0;
$still = 0;
$runs = [];   // run_id => true, for the runs a recovery touched

foreach ($rows as $g) {
    $raw = (string) $g['raw_response'];
    $old = $g['reject_reason'] ?? '(none)';
    $head = sprintf('run %s  slot %s  %-24s %s →', $g['run_id'], $g['slot'], $g['model_id'], $old);

    $extracted = jd_extract_svg($raw);
    if ($extracted === null) {
        echo "$head still rejected: no_svg_found\n";
        $still++;
        continue;
    }
    $verdict = jd_sanitize_svg($extracted);
    if (empty($verdict['ok'])) {
        echo "$head still rejected: {$verdict['reason']}\n";
        $still++;
        continue;
    }

    $normalized = jd2_normalized_column($verdict);
    $disobedience = trim($raw) !== $extracted ? 1 : 0;
    echo "$head ok" . ($normalized === null ? '' : " (normalized: $normalized)")
        . ($dryRun ? '  [would apply]' : '') . "\n";
    $recovered++;
    if ($dryRun) {
        $runs[$g['run_id']] = true;
        continue;
    }

    $db->beginTransaction();
    try {
        $u = $db->prepare(
            'UPDATE jd2_generations
                SET status = ?, svg = ?, normalized = ?, disobedience = ?, reject_reason = NULL
              WHERE id = ? AND status = ?'
        );
        $u->execute([JD2_GEN_OK, $verdict['svg'], $normalized, $disobedience, $g['id'], JD2_GEN_REJECTED]);
        $db->commit();
    } catch (Throwable $e) {
        $db->rollBack();
        throw $e;
    }
    $runs[$g['run_id']] = true;
}

// Re-settle each touched run by jd2-generate's rule. Only an unsettled or a
// 'failed' run moves: a recovery adds an ok drawing, so 'generated' stays.
foreach (array_keys($runs) as $runId) {
    $q = $db->prepare('SELECT status FROM jd2_runs WHERE id = ?');
    $q->execute([$runId]);
    $before = (string) $q->fetchColumn();
    $sessions = $db->prepare("SELECT COUNT(*) FROM jd2_sessions WHERE run_id = ? AND status = '" . JD2_SESSION_FILED . "'");
    $sessions->execute([$runId]);
    $filed = (int) $sessions->fetchColumn();
    $note = $filed > 0
        ? "  ($filed filed sitting(s) over this run do not rate the recovered drawing: incomplete until it is rated)"
        : '';

    // Dry run: the recovered rows are still 'rejected' (settled, not ok), so
    // the rule settles the run exactly when it will after applying, and then
    // at least one drawing is ok — 'generated'.
    $after = jd2_run_settled_status($db, $runId);
    if ($dryRun && $after !== null) {
        $after = JD2_RUN_GENERATED;
    }
    if ($after !== null && $after !== $before && in_array($before, [JD2_RUN_PENDING, JD2_RUN_FAILED], true)) {
        if (!$dryRun) {
            $db->prepare('UPDATE jd2_runs SET status = ? WHERE id = ? AND status = ?')->execute([$after, $runId, $before]);
        }
        echo "run $runId  status $before → $after" . ($dryRun ? '  [would apply]' : '') . "$note\n";
    } else {
        echo "run $runId  status $before (unchanged)$note\n";
    }
}

printf("\n%sdone — %d rejected drawing(s) checked: %d %s, %d still rejected\n",
    $dryRun ? 'dry run ' : '', count($rows), $recovered, $dryRun ? 'would pass' : 'recovered', $still);

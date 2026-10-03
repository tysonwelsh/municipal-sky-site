<?php
// Junk Drawer, dataset v2 — re-check REJECTED drawings under the current
// sanitizer rules, and recover the ones that now pass; or, asked with
// recheck=ok, re-serve the OK drawings under the current normalizations.
//
//   CLI:  JD_DEV_MOCK=1 php api/jd2-resanitize.php --dry-run   (the SQLite dev database)
//         JD_DEV_MOCK=1 php api/jd2-resanitize.php
//         JD_DEV_MOCK=1 php api/jd2-resanitize.php --recheck=ok            (dry run)
//         JD_DEV_MOCK=1 php api/jd2-resanitize.php --recheck=ok --apply
//   web:  https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>&dry-run=1
//         https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>
//         https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>&recheck=ok            (dry run)
//         https://municipalsky.com/api/jd2-resanitize.php?key=<jd_setup_key>&recheck=ok&apply=1
//
// RECHECK=OK (2026-10-03, harness v5: the sanitizer strips <title>/<desc>).
// A normalization added after drawings were filed changes what those
// drawings SHOULD serve, not whether they pass, so the rejected-row pass
// never sees them. With recheck=ok every 'ok' row with a raw_response is
// re-extracted and re-sanitized; where the result differs from what is on
// file (svg or normalized), the row gets the new svg and normalized —
// nothing else (status, usage, latency, cost, disobedience, hidden, created
// stay as filed; raw_response is never touched). A row whose result is
// identical is counted unchanged. A row the current rules would now REJECT
// is reported and left exactly as it is: an ok drawing may already be
// rated, and demoting it is the owner's call, not this script's. The runs
// are not re-settled (an ok row stays ok). Filed sittings stay complete: the
// drawing's id is unchanged, and stripping a <title>/<desc> removes text the
// viewer never saw drawn. This mode is a DRY RUN unless asked to apply
// (?apply=1, CLI --apply) — it rewrites what the drawer serves. Idempotent:
// a second applied run finds every row unchanged.
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

$cliArgs = $isCli ? array_slice($argv, 1) : [];
$recheck = $isCli
    ? (in_array('--recheck=ok', $cliArgs, true) ? 'ok' : null)
    : (isset($_GET['recheck']) ? (string) $_GET['recheck'] : null);
if ($recheck !== null && $recheck !== 'ok') {
    http_response_code(400);
    echo "recheck must be 'ok' (the only status this script can re-serve).\n";
    exit(1);
}
$dryRun = $recheck === 'ok'
    ? !($isCli ? in_array('--apply', $cliArgs, true) : (($_GET['apply'] ?? '') === '1'))
    : ($isCli ? in_array('--dry-run', $cliArgs, true) : isset($_GET['dry-run']));

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

if ($recheck === 'ok') {
    jd2_resanitize_ok_rows($db, $dryRun);
    exit(0);
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

/**
 * recheck=ok: re-serve every ok drawing under the current sanitizer (the
 * header's RECHECK=OK). One line per row that would change or would now be
 * rejected; unchanged rows are only counted.
 */
function jd2_resanitize_ok_rows(PDO $db, bool $dryRun): void
{
    echo "recheck=ok — every ok drawing re-sanitized from its raw_response\n\n";
    $rows = $db->query(
        "SELECT id, run_id, slot, model_id, svg, normalized, raw_response
           FROM jd2_generations
          WHERE status = '" . JD2_GEN_OK . "' AND raw_response IS NOT NULL
          ORDER BY created, run_id, slot"
    )->fetchAll(PDO::FETCH_ASSOC);

    $changed = 0;
    $same = 0;
    $wouldReject = 0;
    foreach ($rows as $g) {
        $head = sprintf('run %s  slot %s  %-24s', $g['run_id'], $g['slot'], $g['model_id']);
        $extracted = jd_extract_svg((string) $g['raw_response']);
        $verdict = $extracted === null ? ['ok' => false, 'reason' => 'no_svg_found'] : jd_sanitize_svg($extracted);
        if (empty($verdict['ok'])) {
            echo "$head ok → would now be rejected: {$verdict['reason']}  (left as filed)\n";
            $wouldReject++;
            continue;
        }
        $normalized = jd2_normalized_column($verdict);
        $oldNorm = $g['normalized'] === null ? null : (string) $g['normalized'];
        if ($verdict['svg'] === (string) $g['svg'] && $normalized === $oldNorm) {
            $same++;
            continue;
        }
        printf("%s normalized %s → %s, svg %d → %d bytes%s\n", $head, $oldNorm ?? 'NULL', $normalized ?? 'NULL',
            strlen((string) $g['svg']), strlen($verdict['svg']), $dryRun ? '  [would apply]' : '');
        $changed++;
        if ($dryRun) {
            continue;
        }
        $u = $db->prepare(
            'UPDATE jd2_generations SET svg = ?, normalized = ? WHERE id = ? AND status = ?'
        );
        $u->execute([$verdict['svg'], $normalized, $g['id'], JD2_GEN_OK]);
    }

    printf("\n%sdone — %d ok drawing(s) checked: %d %s, %d unchanged, %d would now be rejected (left as filed)\n",
        $dryRun ? 'dry run ' : '', count($rows), $changed, $dryRun ? 'would change' : 'changed', $same, $wouldReject);
    if ($dryRun && $changed > 0) {
        echo "nothing written: apply with ?apply=1 (CLI --apply)\n";
    }
}

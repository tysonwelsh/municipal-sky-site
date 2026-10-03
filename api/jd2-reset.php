<?php
// Junk Drawer, dataset v2 — the ONE-SHOT PRE-CAMPAIGN RESET.
//
// THIS IS THE ONE DELIBERATE EXCEPTION to the Never list's "Never delete or
// overwrite a session, judgment, ranking or pair" (art/junk-drawer/CLAUDE.md).
// It is run ONCE, BY THE OWNER, BEFORE THE CAMPAIGN'S FIRST SITTING (owner,
// 2026-10-03; PLAN-V2 §12): the trial drawings (rows 101–110 under the old
// pool and the medium setting, the trial that follows, and the owner's test
// sitting on the Titanic prompt) are deleted entirely, so the campaign starts
// clean under the new pool, the new rubric and the reviewed drawing prompt.
// From the campaign's first sitting on, the never-delete rule holds without
// exception, and this file should be deleted from the repo once it has run.
// It refuses a real run outside JD2_RESET_WINDOW_FROM … JD2_RESET_WINDOW_UNTIL
// (UTC dates, inclusive) — the window is the owner's to move, deliberately,
// in a commit.
//
//   web:  https://municipalsky.com/api/jd2-reset.php?key=<jd_setup_key>&dry-run=1
//         https://municipalsky.com/api/jd2-reset.php?key=<jd_setup_key>&confirm=<token>
//   CLI:  JD_DEV_MOCK=1 php api/jd2-reset.php [--dry-run]           (the SQLite dev database)
//         JD_DEV_MOCK=1 php api/jd2-reset.php --confirm=<token>
//
// WHAT GOES: every row of the seven dataset-v2 tables — jd2_pairs,
// jd2_rankings, jd2_judgments, jd2_sessions, jd2_generations, jd2_runs,
// jd2_prompts (the prompts' intake records are prompt columns, so they go
// with them). Deleted in foreign-key order in ONE transaction; the prompts'
// two forward references (shown_run_id, pinned_generation_id, which point at
// runs and generations) are cleared first, inside the same transaction. The
// tables themselves stay (the schema runner owns them). NOTHING ELSE IS
// TOUCHED: no v1 jd_* table, no page_events, no other table — this file never
// names one.
//
// DRY RUN FIRST. With ?dry-run=1 (CLI --dry-run), and BY DEFAULT when neither
// flag is given, it only prints what would go: each table's row count, a
// one-line census (prompts by origin, sessions by role and status, the newest
// filed_at, the drawings' total cost_usd, the intake cost, the pool versions
// and harnesses present) and the CONFIRMATION TOKEN. The token is the first
// 12 hex of a sha256 over the seven counts, the newest id of each table and
// the newest filed_at, so it names one exact state of the tables: a stale dry
// run cannot authorise a later state (one more drawing or sitting and the
// token changes). The real run needs ?confirm=<token> (CLI --confirm=<token>);
// a token that does not match the tables as they stand is refused, nothing is
// deleted, and the refusal says to run the dry run again. The refusal never
// prints the right token: the dry run is the only way to it.
//
// THE RECORD. A real run appends one JSON line (time, token, how it was
// called, the census, the rows deleted per table, the counts after) to
// jd2-reset.log and writes jd2-reset.stamp beside it. The directory is one no
// web request can reach (jd2_reset_record_dir): on production
// /home1/tdrivemy/private_config — the out-of-webroot directory that holds
// secrets.php — else the system temp dir (the bench-key throttle's place);
// anywhere else local-dev/ (gitignored and deploy-excluded, so never on the
// server). The .htaccess denies nothing but itself, so a log under api/ WOULD
// be served; that is why it is not there. A real run checks the directory is
// writable BEFORE it deletes anything. The stamp refuses a second real run
// within JD2_RESET_COOLDOWN seconds (an hour).
//
// THE BATCH RUNNER'S STATE FILE (local-dev/jd2-batch-state.json on the
// owner's Mac) remembers which CSV rows were drawn. This endpoint cannot reach
// it; after the reset the runner would think the rows were already drawn.
// The output says so: run `php scripts/jd2-batch-run.php --forget-state` in
// the checkout that ran the batch.
//
// THE GATE. On production the setup key (jd_require_setup_key, ?key=), as the
// runners and jd2-resanitize. Beyond that: wherever JD_DEV_MODE is false — a
// checkout whose config/secrets.php points at the live MySQL, a php -S without
// JD_DEV_MOCK=1 — it refuses outright unless the key is supplied (?key= on the
// web, JD_SETUP_KEY in the environment on the CLI) and matches jd_setup_key on
// file. Only the dev box (JD_DEV_MOCK=1, never true on the server) is open.

require_once __DIR__ . '/jd2-config.php';

// jd-config.php turns display_errors off, which for a maintenance script means
// a failure arrives as a blank 500. Report it here instead.
set_error_handler(function ($no, $str, $file, $line) {
    echo "PHP error: $str  ($file:$line)\n";
    return true;
});
set_exception_handler(function ($e) {
    jd2_reset_status(500);
    echo "FAILED: " . $e->getMessage() . "\n  at " . $e->getFile() . ':' . $e->getLine() . "\n";
    echo "Nothing was deleted unless the line above says the transaction committed.\n";
});

/** The seven v2 tables, children first: the order the deletes run in. */
const JD2_RESET_TABLES = ['jd2_pairs', 'jd2_rankings', 'jd2_judgments', 'jd2_sessions',
                          'jd2_generations', 'jd2_runs', 'jd2_prompts'];
/** The window a real run is allowed in (UTC dates, inclusive). Owner's to move. */
const JD2_RESET_WINDOW_FROM = '2026-10-02';
const JD2_RESET_WINDOW_UNTIL = '2026-10-31';
/** A second real run within this many seconds of the last is refused. */
const JD2_RESET_COOLDOWN = 3600;
/** Production's out-of-webroot directory (beside private_config/secrets.php). */
const JD2_RESET_PROD_DIR = '/home1/tdrivemy/private_config';

$isCli = (PHP_SAPI === 'cli');
if (!$isCli) {
    // Buffered, so a refusal printed after the header lines can still set its
    // status code (jd2_reset_status).
    ob_start();
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Robots-Tag: noindex');
    jd_no_store();
    jd_require_setup_key("Forbidden. Call with ?key=<jd_setup_key>.\n");
}

// --- the gate beyond production: the key, everywhere but the dev box --------
if (!JD_DEV_MODE) {
    $expected = jd_secrets()['jd_setup_key'] ?? null;
    $supplied = $isCli ? (string) getenv('JD_SETUP_KEY') : (string) ($_GET['key'] ?? '');
    if (!is_string($expected) || $expected === '' || $supplied === '' || !hash_equals($expected, $supplied)) {
        jd2_reset_status(403);
        echo "Refused: this is not the dev box (JD_DEV_MOCK=1), and the setup key is missing or wrong.\n"
           . ($isCli
               ? "On the CLI the key is read from JD_SETUP_KEY in the environment (jd_setup_key in secrets.php).\n"
               : "Call with ?key=<jd_setup_key>.\n")
           . "Nothing was read and nothing was deleted.\n";
        exit(1);
    }
}

// --- arguments -----------------------------------------------------------------
$confirm = null;
$dryFlag = false;
if ($isCli) {
    $args = array_slice($argv, 1);
    for ($i = 0; $i < count($args); $i++) {
        $a = $args[$i];
        if ($a === '--dry-run') {
            $dryFlag = true;
        } elseif (str_starts_with($a, '--confirm=')) {
            $confirm = substr($a, strlen('--confirm='));
        } elseif ($a === '--confirm') {
            $confirm = (string) ($args[++$i] ?? '');
        } else {
            echo "Unknown argument $a. Use --dry-run, or --confirm=<token> from a dry run.\n";
            exit(1);
        }
    }
} else {
    $dryFlag = isset($_GET['dry-run']);
    if (isset($_GET['confirm'])) {
        $confirm = is_string($_GET['confirm']) ? $_GET['confirm'] : '';
    }
}
// A dry run unless a token was given — and a dry run whenever one was asked for.
$dryRun = $dryFlag || $confirm === null;

// The window's "today". On the dev box only, JD2_RESET_TODAY (Y-m-d) stands in
// for the clock, so the tests can stand inside and outside the window; the
// server can never set it (JD_DEV_MODE is false there).
$today = gmdate('Y-m-d');
$fakeToday = (string) getenv('JD2_RESET_TODAY');
if (JD_DEV_MODE && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fakeToday)) {
    $today = $fakeToday;
}
$inWindow = $today >= JD2_RESET_WINDOW_FROM && $today <= JD2_RESET_WINDOW_UNTIL;

// --- the database ------------------------------------------------------------------
if (!JD_DEV_MODE && !JD_IS_PRODUCTION && !is_readable(__DIR__ . '/../config/secrets.php')) {
    jd2_reset_status(500);
    echo "No database available. Either add config/secrets.php for a local MySQL, or run with JD_DEV_MOCK=1 for the SQLite dev database.\n";
    exit(1);
}
$db = jd_db();
$driver = jd_db_driver($db);

echo "JD2 PRE-CAMPAIGN RESET\n";
echo "This is the ONE sanctioned exception to \"never delete a session, judgment, ranking or pair\"\n"
   . "(art/junk-drawer/CLAUDE.md, Never): run once, by the owner, before the campaign's first sitting\n"
   . "(window " . JD2_RESET_WINDOW_FROM . " … " . JD2_RESET_WINDOW_UNTIL . " UTC). From that sitting on, the rule holds without exception.\n";
echo $driver === 'sqlite'
    ? "Database: dev mode (SQLite) " . realpath(JD_DEV_DB_PATH) . "\n"
    : "Database: MySQL\n";
echo $dryRun ? "DRY RUN — nothing is deleted\n\n" : "REAL RUN\n\n";

foreach (JD2_RESET_TABLES as $t) {
    if (!jd_has_table($db, $t)) {
        jd2_reset_status(500);
        echo "$t is missing: run api/setup-jd2-tables.php first. Nothing was deleted.\n";
        exit(1);
    }
}

// --- the record's place, the stamp ------------------------------------------------
[$recordDir, $recordWhy] = jd2_reset_record_dir();
$logPath = $recordDir === null ? null : $recordDir . '/jd2-reset.log';
$stampPath = $recordDir === null ? null : $recordDir . '/jd2-reset.stamp';
$stamp = $stampPath !== null && is_readable($stampPath)
    ? json_decode((string) file_get_contents($stampPath), true)
    : null;
$lastAt = is_array($stamp) ? (int) ($stamp['at'] ?? 0) : 0;
$sinceLast = $lastAt > 0 ? time() - $lastAt : null;
$cooling = $sinceLast !== null && $sinceLast < JD2_RESET_COOLDOWN;

// ---------------------------------------------------------------------------
// DRY RUN
// ---------------------------------------------------------------------------
if ($dryRun) {
    $census = jd2_reset_census($db);
    echo "Would delete, in foreign-key order (the prompts' shown_run_id and pinned_generation_id cleared first):\n";
    jd2_reset_print_counts($census['counts'], null);
    echo "\ncensus: " . jd2_reset_census_line($census) . "\n";
    echo "untouched: every v1 jd_* table, page_events, and every other table.\n\n";

    if ($lastAt > 0) {
        echo "last real reset: " . gmdate('Y-m-d H:i:s', $lastAt) . " UTC"
            . ($cooling ? " — a real run is refused until " . gmdate('Y-m-d H:i:s', $lastAt + JD2_RESET_COOLDOWN) . " UTC" : '') . "\n";
    }
    if (!$inWindow) {
        echo "the window is closed (today $today, window " . JD2_RESET_WINDOW_FROM . " … " . JD2_RESET_WINDOW_UNTIL
            . " UTC): a real run will be refused.\n";
    }
    if ($recordDir === null) {
        echo "no writable record directory ($recordWhy): a real run will be refused.\n";
    }
    if (array_sum($census['counts']) === 0) {
        echo "The seven tables are already empty: there is nothing to delete.\n";
        exit(0);
    }
    echo "confirmation token: {$census['token']}\n";
    echo "It authorises exactly the state counted above; any new row changes it. To delete:\n";
    echo '  ' . jd2_reset_command($isCli, $census['token']) . "\n";
    exit(0);
}

// ---------------------------------------------------------------------------
// REAL RUN — refusals first, then one transaction
// ---------------------------------------------------------------------------
if (!$inWindow) {
    jd2_reset_status(409);
    echo "Refused: today ($today UTC) is outside the reset's window, " . JD2_RESET_WINDOW_FROM . " … " . JD2_RESET_WINDOW_UNTIL
       . ".\nThe reset is for before the campaign's first sitting; after that, sittings are never deleted.\n"
       . "Moving the window is the owner's decision, made in a commit (JD2_RESET_WINDOW_* in api/jd2-reset.php). Nothing was deleted.\n";
    exit(1);
}
if ($cooling) {
    jd2_reset_status(409);
    echo "Refused: a real reset already ran at " . gmdate('Y-m-d H:i:s', $lastAt) . " UTC, "
       . (int) floor($sinceLast / 60) . " minute(s) ago. A second run within the hour is refused (" . $stampPath . ").\n"
       . "Nothing was deleted. Run the dry run to see what is on file now.\n";
    exit(1);
}
if ($recordDir === null) {
    jd2_reset_status(500);
    echo "Refused: there is no writable directory for the record ($recordWhy). The reset is not run unrecorded.\n"
       . "Nothing was deleted.\n";
    exit(1);
}

$deleted = [];
$db->beginTransaction();
try {
    // The census is taken INSIDE the transaction, so the token is checked
    // against the state the deletes act on.
    $census = jd2_reset_census($db);
    if (!hash_equals($census['token'], (string) $confirm)) {
        $db->rollBack();
        jd2_reset_status(409);
        echo "Refused: the confirmation token \"" . jd2_reset_safe((string) $confirm) . "\" does not match the tables as they stand now.\n"
           . "Either it was mistyped, or a row was filed since that dry run (a token names one exact state).\n"
           . "Run the dry run again, read what it lists, and use the token IT prints:\n"
           . '  ' . jd2_reset_command($isCli, null) . "\n"
           . "Nothing was deleted.\n";
        exit(1);
    }
    if (array_sum($census['counts']) === 0) {
        $db->rollBack();
        echo "The seven tables are already empty: nothing deleted, nothing recorded.\n";
        exit(0);
    }

    // The prompts point forward at runs and generations: clear those two
    // columns first, or the generation/run deletes would break the keys.
    $db->exec('UPDATE jd2_prompts SET shown_run_id = NULL, pinned_generation_id = NULL');
    foreach (JD2_RESET_TABLES as $t) {
        $deleted[$t] = $db->exec("DELETE FROM $t");
    }
    $after = jd2_reset_census($db)['counts'];
    if (array_sum($after) !== 0) {
        $db->rollBack();
        jd2_reset_status(500);
        echo "FAILED: rows remained after the deletes (" . json_encode($after) . "); rolled back. Nothing was deleted.\n";
        exit(1);
    }
    $db->commit();
} catch (Throwable $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    jd2_reset_status(500);
    echo "FAILED: " . $e->getMessage() . "\nRolled back. Nothing was deleted.\n";
    exit(1);
}

echo "Deleted, in foreign-key order, in one transaction (committed):\n";
jd2_reset_print_counts($census['counts'], $after);
echo "\ncensus before: " . jd2_reset_census_line($census) . "\n";
echo "untouched: every v1 jd_* table, page_events, and every other table.\n";

// --- the record -----------------------------------------------------------------
$now = time();
$line = json_encode([
    'at' => gmdate('Y-m-d\TH:i:s\Z', $now),
    'event' => 'jd2-pre-campaign-reset',
    'token' => $census['token'],
    'via' => $isCli ? 'cli' : 'web',
    'driver' => $driver,
    'before' => $census['counts'],
    'deleted' => $deleted,
    'after' => $after,
    'census' => jd2_reset_census_line($census),
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
$logged = @file_put_contents($logPath, $line . "\n", FILE_APPEND | LOCK_EX) !== false;
$stamped = @file_put_contents($stampPath, json_encode(['at' => $now, 'token' => $census['token']]) . "\n", LOCK_EX) !== false;
echo "\nrecord: " . ($logged ? "one line appended to $logPath ($recordWhy)" : "COULD NOT WRITE $logPath — copy this output; the line was:\n  $line") . "\n";
echo "stamp:  " . ($stamped ? "$stampPath (a second real run within the hour is refused)" : "COULD NOT WRITE $stampPath") . "\n";

echo "\nNEXT, ON YOUR MAC: the batch runner's state file (local-dev/jd2-batch-state.json) still lists the\n"
   . "deleted rows as drawn, and this endpoint cannot reach it. In the checkout that ran the batch:\n"
   . "  php scripts/jd2-batch-run.php --forget-state\n"
   . "(or delete local-dev/jd2-batch-state.json by hand). Then the campaign's first sitting starts the record,\n"
   . "and from that sitting on nothing is deleted.\n";
echo "\ndone — reset complete: " . array_sum($census['counts']) . " row(s) deleted, the seven tables now empty\n";

// ---------------------------------------------------------------------------

/**
 * The seven counts, each table's newest id, sessions' newest filed_at, and the
 * census figures; `token` is the first 12 hex of a sha256 over the first three.
 */
function jd2_reset_census(PDO $db): array
{
    $counts = [];
    $newest = [];
    foreach (JD2_RESET_TABLES as $t) {
        $r = $db->query("SELECT COUNT(*) AS n, MAX(id) AS m FROM $t")->fetch(PDO::FETCH_ASSOC);
        $counts[$t] = (int) $r['n'];
        $newest[$t] = $r['m'] === null ? null : (string) $r['m'];
    }
    $filedAt = $db->query('SELECT MAX(filed_at) FROM jd2_sessions')->fetchColumn();
    $filedAt = ($filedAt === null || $filedAt === false) ? null : (string) $filedAt;

    $group = static function (PDO $db, string $sql): array {
        $out = [];
        foreach ($db->query($sql)->fetchAll(PDO::FETCH_NUM) as [$k, $n]) {
            $out[(string) ($k ?? '(none)')] = (int) $n;
        }
        return $out;
    };
    $cost = $db->query('SELECT SUM(cost_usd), SUM(CASE WHEN cost_usd IS NULL THEN 1 ELSE 0 END) FROM jd2_generations')
               ->fetch(PDO::FETCH_NUM);
    $intake = $db->query('SELECT SUM(intake_cost_usd) FROM jd2_prompts')->fetchColumn();
    // role and status joined in PHP: `||` is OR on MySQL, CONCAT absent on SQLite
    $roles = [];
    foreach ($db->query('SELECT rater_role, status, COUNT(*) FROM jd2_sessions GROUP BY rater_role, status ORDER BY rater_role, status')
                ->fetchAll(PDO::FETCH_NUM) as [$role, $status, $n]) {
        $roles[$role . ' ' . $status] = (int) $n;
    }

    return [
        'counts' => $counts,
        'newest' => $newest,
        'newest_filed_at' => $filedAt,
        'origins' => $group($db, 'SELECT origin, COUNT(*) FROM jd2_prompts GROUP BY origin ORDER BY origin'),
        'roles' => $roles,
        'cost_usd' => (float) ($cost[0] ?? 0),
        'unpriced' => (int) ($cost[1] ?? 0),
        'intake_usd' => (float) ($intake ?: 0),
        'pools' => $group($db, 'SELECT pool_version, COUNT(*) FROM jd2_runs GROUP BY pool_version ORDER BY pool_version'),
        'harnesses' => $group($db, 'SELECT harness, COUNT(*) FROM jd2_runs GROUP BY harness ORDER BY harness'),
        'token' => substr(hash('sha256', 'jd2-reset-v1|' . json_encode([$counts, $newest, $filedAt])), 0, 12),
    ];
}

/** One line: prompts by origin, sessions by role, newest filed_at, cost, pools, harnesses. */
function jd2_reset_census_line(array $c): string
{
    $list = static function (array $m, string $sep = ' '): string {
        if (!$m) {
            return 'none';
        }
        $parts = [];
        foreach ($m as $k => $n) {
            $parts[] = $k . $sep . $n;
        }
        return implode(', ', $parts);
    };
    return sprintf(
        'prompts %d (%s) · sessions %d (%s) · newest filed_at %s · drawings $%.6f%s · intake $%.6f · pools %s · harnesses %s',
        $c['counts']['jd2_prompts'], $list($c['origins']),
        $c['counts']['jd2_sessions'], $list($c['roles']),
        $c['newest_filed_at'] ?? 'none',
        $c['cost_usd'], $c['unpriced'] > 0 ? " ({$c['unpriced']} unpriced)" : '',
        $c['intake_usd'],
        $list($c['pools'], ' ×'), $list($c['harnesses'], ' ×')
    );
}

function jd2_reset_print_counts(array $before, ?array $after): void
{
    foreach (JD2_RESET_TABLES as $t) {
        echo '  ' . str_pad($t, 18) . str_pad((string) $before[$t], 8, ' ', STR_PAD_LEFT)
            . ($after === null ? '' : '  →  ' . $after[$t]) . "\n";
    }
    echo '  ' . str_pad('total', 18) . str_pad((string) array_sum($before), 8, ' ', STR_PAD_LEFT)
        . ($after === null ? '' : '  →  ' . array_sum($after)) . "\n";
}

/** The command for the next step, in the shape this run was called in; the key is never printed. */
function jd2_reset_command(bool $isCli, ?string $token): string
{
    if (!$isCli) {
        return 'https://municipalsky.com/api/jd2-reset.php?key=<jd_setup_key>&' . ($token === null ? 'dry-run=1' : 'confirm=' . $token);
    }
    return (JD_DEV_MODE ? 'JD_DEV_MOCK=1' : 'JD_SETUP_KEY=<jd_setup_key>') . ' php api/jd2-reset.php '
        . ($token === null ? '--dry-run' : '--confirm=' . $token);
}

/** The HTTP status, on the web only (the CLI has none; its exit code says it). */
function jd2_reset_status(int $code): void
{
    if (PHP_SAPI !== 'cli' && !headers_sent()) {
        http_response_code($code);
    }
}

/**
 * Where the record goes: a directory no web request can reach. Production:
 * private_config (outside public_html, beside secrets.php), else the system
 * temp dir. Anywhere else: local-dev/ (gitignored, deploy-excluded).
 * @return array{0:?string,1:string} the directory (null when none is writable) and why it is that one
 */
function jd2_reset_record_dir(): array
{
    if (JD_IS_PRODUCTION) {
        if (is_dir(JD2_RESET_PROD_DIR) && is_writable(JD2_RESET_PROD_DIR)) {
            return [JD2_RESET_PROD_DIR, 'private_config, outside the web root'];
        }
        $tmp = rtrim(sys_get_temp_dir(), '/');
        if (is_dir($tmp) && is_writable($tmp)) {
            return [$tmp, 'the system temp dir, outside the web root; private_config was not writable'];
        }
        return [null, 'neither private_config nor the system temp dir is writable'];
    }
    $dir = dirname(__DIR__) . '/local-dev';
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return is_dir($dir) && is_writable($dir)
        ? [realpath($dir), 'local-dev, gitignored and never deployed']
        : [null, 'local-dev is not writable'];
}

/** A supplied token echoed back: hex-ish characters only, clipped. */
function jd2_reset_safe(string $s): string
{
    return substr(preg_replace('/[^0-9A-Za-z_-]/', '?', $s), 0, 40);
}

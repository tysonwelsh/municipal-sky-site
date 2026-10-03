<?php
// The one-shot pre-campaign reset (api/jd2-reset.php) end to end, against the
// SQLite dev database and the mock provider.
//
//   php scripts/test-jd2-reset.php
//
// HERMETIC, like test-jd2-flow.php: it sets JD_DEV_MOCK=1 for itself and for
// the server it starts, refuses to run where JD_DEV_MODE cannot be true,
// and talks only to a `php -S` it starts on a free 127.0.0.1 port. Nothing
// reaches a provider or a production URL. It EMPTIES the jd2_* tables of
// local-dev/jd-dev.sqlite first (run the suites ONE AT A TIME), and removes
// the dev box's reset stamp (local-dev/jd2-reset.stamp) so the hour's guard
// starts open; the dev log (local-dev/jd2-reset.log) is appended to, never
// cleared.
//
// The v1 check: the dev v1 tables are empty, so "untouched" would be a
// count of zero before and after. To make it a real check the test files
// ONE sentinel row in the DEV database's jd_submissions (never production),
// counts every jd_* table before and after the reset, and removes the
// sentinel at the end.
//
// The key gate off the dev box is checked on a COPY of api/ in a temp dir
// with no config/secrets.php and without JD_DEV_MOCK: the refusal must come
// before any database is opened, and with no secrets file there is no
// database to reach even if it did not.
//
// One PASS/FAIL line per check; exit 0 iff all pass.

putenv('JD_DEV_MOCK=1');
putenv('JD_DEV_LATENCY_MS=1');
putenv('JD2_RESET_TODAY');   // the real clock unless a case sets it
require_once __DIR__ . '/../api/jd2-config.php';

if (!JD_DEV_MODE) {
    fwrite(STDERR, "Refusing to run: JD_DEV_MODE is false here (production secrets present?).\n");
    exit(2);
}

$root = realpath(__DIR__ . '/..');
$passed = 0;
$failed = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        printf("PASS  %s\n", $name);
    } else {
        $failed++;
        printf("FAIL  %s%s\n", $name, $detail === '' ? '' : "\n      " . $detail);
    }
}

function section(string $title): void
{
    echo "\n-- $title\n";
}

// --- 0. The dev database, the record files, the server ------------------------
foreach (['setup-jd-tables.php', 'setup-jd2-tables.php'] as $runner) {
    $setup = [];
    exec('JD_DEV_MOCK=1 ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/api/' . $runner) . ' 2>&1', $setup, $rc);
    if ($rc !== 0 || !in_array('All tables present and migrated.', $setup, true)) {
        fwrite(STDERR, "$runner did not finish cleanly:\n" . implode("\n", $setup) . "\n");
        exit(2);
    }
}

const TABLES = ['jd2_pairs', 'jd2_rankings', 'jd2_judgments', 'jd2_sessions', 'jd2_generations', 'jd2_runs', 'jd2_prompts'];
const V1_TABLES = ['jd_submissions', 'jd_generations', 'jd_ratings', 'jd_ranks', 'jd_comparisons'];

$db = jd_db();
$db->exec('UPDATE jd2_prompts SET shown_run_id = NULL, pinned_generation_id = NULL');
foreach (TABLES as $t) {
    $db->exec("DELETE FROM $t");
}

$LOG = $root . '/local-dev/jd2-reset.log';
$STAMP = $root . '/local-dev/jd2-reset.stamp';
@unlink($STAMP);
$logLinesBefore = is_file($LOG) ? count(file($LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) : 0;

// the dev-only v1 sentinel (see the header)
$SENTINEL = 'test-jd2-reset-sentinel';
$db->prepare('DELETE FROM jd_submissions WHERE id = ?')->execute([$SENTINEL]);
$db->prepare("INSERT INTO jd_submissions (id, client_ref, created, prompt, visitor_hash, pair_order)
              VALUES (?, ?, ?, 'v1 sentinel (test-jd2-reset)', ?, 0)")
   ->execute([$SENTINEL, jd_uuid4(), jd_now(), str_repeat('0', 64)]);

$mockDir = $root . '/local-dev/jd-mock';
if (!is_dir($mockDir)) {
    mkdir($mockDir, 0775, true);
}
$fixtures = [
    'mock-anthropic.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#b8860b"/></svg>',
    'mock-openai.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" fill="#336"/></svg>',
    'mock-kimi.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M2 98 L50 2 L98 98 Z" fill="#a33"/></svg>',
    'mock-google.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="48" ry="30" fill="#3a3"/></svg>',
];
foreach ($fixtures as $name => $svg) {
    if (!is_file("$mockDir/$name")) {
        file_put_contents("$mockDir/$name", $svg . "\n");
    }
}

$probe = stream_socket_server('tcp://127.0.0.1:0');
$port = (int) substr(strrchr(stream_socket_get_name($probe, false), ':'), 1);
fclose($probe);
$serverLog = tempnam(sys_get_temp_dir(), 'jd2-reset-');
$server = proc_open(
    [PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root],
    [0 => ['file', '/dev/null', 'r'], 1 => ['file', $serverLog, 'a'], 2 => ['file', $serverLog, 'a']],
    $pipes,
    $root,
    array_merge(getenv(), ['JD_DEV_MOCK' => '1', 'JD_DEV_LATENCY_MS' => '1'])
);
register_shutdown_function(static function () use ($server, $serverLog): void {
    proc_terminate($server);
    @unlink($serverLog);
});
for ($i = 0; $i < 100; $i++) {
    $s = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
    if ($s) {
        fclose($s);
        break;
    }
    usleep(50000);
}

$BENCH_KEY = jd_bench_key_expected() ?? 'keyless-dev-checkout';
$BASE = "http://127.0.0.1:$port";

/** @return array{0:int,1:mixed,2:string} status, decoded JSON (or null), raw body */
function req(string $method, string $path, ?array $body = null, bool $owner = false): array
{
    global $BASE, $BENCH_KEY;
    $ch = curl_init($BASE . $path);
    $headers = ['Origin: http://localhost:8000'];
    if ($owner) {
        $headers[] = 'X-Bench-Key: ' . $BENCH_KEY;
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
                            CURLOPT_HTTPHEADER => $headers, CURLOPT_TIMEOUT => 60]);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, json_decode($raw, true), $raw];
}

function one(PDO $db, string $sql, array $args = []): mixed
{
    $q = $db->prepare($sql);
    $q->execute($args);
    return $q->fetchColumn();
}

function counts(PDO $db, array $tables): array
{
    $out = [];
    foreach ($tables as $t) {
        $out[$t] = (int) $db->query("SELECT COUNT(*) FROM $t")->fetchColumn();
    }
    return $out;
}

/** api/jd2-reset.php on the CLI; $env adds to the environment. @return array{0:int,1:string} */
function reset_cli(string $args = '', array $env = []): array
{
    global $root;
    $prefix = 'JD_DEV_MOCK=1';
    foreach ($env as $k => $v) {
        $prefix .= ' ' . $k . '=' . escapeshellarg($v);
    }
    $out = [];
    exec($prefix . ' ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/api/jd2-reset.php')
        . ($args === '' ? '' : ' ' . $args) . ' 2>&1', $out, $rc);
    return [$rc, implode("\n", $out)];
}

function token_of(string $out): ?string
{
    return preg_match('/^confirmation token: ([0-9a-f]{12})$/m', $out, $m) ? $m[1] : null;
}

$taxonomy = jd_taxonomy();
$axisRanks = jd_axis_ranks($taxonomy);
function fullRatings(array $grades, array $axisRanks): array
{
    $out = [];
    foreach ($grades as $slot => $grade) {
        $out[] = ['slot' => $slot, 'kind' => 'grade', 'value' => $grade];
        foreach ($axisRanks as $axis => $ranks) {
            $out[] = ['slot' => $slot, 'kind' => 'axis', 'axis_id' => $axis, 'value' => max($ranks)];
        }
    }
    return $out;
}

/** An owner prompt drawn on the bench profile, four slots; @return array{0:?string,1:?string,2:array} run, prompt, slot => gen id */
function ownerRun(PDO $db, string $prompt): array
{
    $ref = jd_uuid4();
    [, $j] = req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => 'a', 'prompt' => $prompt,
                                                   'profile' => 'bench', 'website' => ''], true);
    $run = $j['run_id'] ?? null;
    foreach (['b', 'c', 'd'] as $slot) {
        req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt,
                                              'run_id' => $run, 'profile' => 'bench', 'website' => ''], true);
    }
    $gens = [];
    $q = $db->prepare('SELECT slot, id FROM jd2_generations WHERE run_id = ? ORDER BY slot');
    $q->execute([(string) $run]);
    foreach ($q->fetchAll(PDO::FETCH_NUM) as [$slot, $id]) {
        $gens[$slot] = $id;
    }
    return [$run, $j['prompt_id'] ?? null, $gens];
}

/** A visitor's four slots; @return array{0:?string,1:?string,2:string} run, prompt, client_ref */
function visitorTurn(string $prompt): array
{
    $ref = jd_uuid4();
    $device = jd_uuid4();
    $first = null;
    foreach (['a', 'b', 'c', 'd'] as $slot) {
        [, $j] = req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt, 'client' => 'web',
                     'consent' => ['version' => JD_CONSENT_VERSION], 'device_ref' => $device, 'website' => '']);
        $first ??= $j;
    }
    return [$first['run_id'] ?? null, $first['prompt_id'] ?? null, $ref];
}

$ranking = [['slot' => 'c', 'rank' => 1, 'gap' => 2], ['slot' => 'a', 'rank' => 2, 'gap' => 0],
            ['slot' => 'd', 'rank' => 3, 'gap' => 1], ['slot' => 'b', 'rank' => 4]];

// ============================================================================
section('(a) seed through the endpoints: an owner prompt, its intake, a filed sitting, a pin; a visitor turn and sitting');
[$runO, $promptO, $gensO] = ownerRun($db, 'the Titanic, sinking, seen from a lifeboat');
check('the owner run: four drawings on one run', jd_is_ulid((string) $runO) && count($gensO) === 4, json_encode([$runO, $gensO]));
[$st, $j] = req('POST', '/api/jd2-intake.php', ['prompt_id' => $promptO], true);
check('intake files on the owner prompt (an intake record on the prompt row)',
      $st === 200 && one($db, 'SELECT intake_at FROM jd2_prompts WHERE id = ?', [$promptO]) !== null, $st . ' ' . json_encode($j));
[$st, $j] = req('POST', '/api/jd2-rate.php', ['run_id' => $runO, 'client' => 'web',
                 'ratings' => fullRatings(['a' => 4, 'b' => 2, 'c' => 5, 'd' => 3], $axisRanks), 'ranking' => $ranking], true);
check('the owner files a complete sitting (judgments, rankings, derived pairs)', $st === 200 && ($j['complete'] ?? false) === true,
      $st . ' ' . json_encode($j));
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $promptO, 'shown_run_id' => $runO, 'pinned_generation_id' => $gensO['d']], true);
check("the prompt points forward at its run and a drawing (shown_run_id, pinned_generation_id)",
      $st === 200 && one($db, 'SELECT shown_run_id FROM jd2_prompts WHERE id = ?', [$promptO]) === $runO
      && one($db, 'SELECT pinned_generation_id FROM jd2_prompts WHERE id = ?', [$promptO]) === $gensO['d'], $st . ' ' . json_encode($j));
[$runV, $promptV, $refV] = visitorTurn('a brass key with a paper tag');
[$st, $j] = req('POST', '/api/jd2-rate.php', ['run_id' => $runV, 'client_ref' => $refV, 'client' => 'web', 'size' => 's',
                 'ratings' => fullRatings(['a' => 1, 'b' => 2, 'c' => 3, 'd' => 4], $axisRanks), 'ranking' => $ranking]);
check('a visitor turn and its filed sitting', $st === 200 && ($j['complete'] ?? false) === true, $st . ' ' . json_encode($j));
$seeded = counts($db, TABLES);
check('every one of the seven tables holds rows', min($seeded) > 0, json_encode($seeded));
$v1Before = counts($db, V1_TABLES);
check('the v1 sentinel is on file in the dev jd_submissions', $v1Before['jd_submissions'] >= 1, json_encode($v1Before));

// ============================================================================
section('(b) the dry run: per-table counts, the census, a token; nothing deleted');
[$rc, $dry] = reset_cli();
$token = token_of($dry);
echo "\n---- dry run output (no flags) ----\n$dry\n----\n";
$countsOk = true;
foreach ($seeded as $t => $n) {
    $countsOk = $countsOk && preg_match('/^  ' . preg_quote($t, '/') . '\s+' . $n . '$/m', $dry) === 1;
}
check('no flags = a dry run: "DRY RUN", rc 0, each table\'s count as on file', $rc === 0 && str_contains($dry, 'DRY RUN — nothing is deleted') && $countsOk, $dry);
check('it names itself the one sanctioned exception, once, before the first sitting',
      str_contains($dry, 'ONE sanctioned exception') && str_contains($dry, "before the campaign's first sitting"), $dry);
$cost = (float) one($db, 'SELECT SUM(cost_usd) FROM jd2_generations');
$filed = (string) one($db, 'SELECT MAX(filed_at) FROM jd2_sessions');
check('the census line: prompts by origin, sessions by role, newest filed_at, drawings cost, pools, harnesses',
      str_contains($dry, 'prompts 2 (owner 1, visitor 1)') && str_contains($dry, 'sessions 2 (owner filed 1, visitor filed 1)')
      && str_contains($dry, "newest filed_at $filed") && str_contains($dry, sprintf('drawings $%.6f', $cost))
      && str_contains($dry, 'pools ' . jd2_pool_version($taxonomy) . ' ×2')
      && str_contains($dry, jd_harness(JD2_OWNER_DEFAULT_PROFILE) . ' ×1') && str_contains($dry, jd_harness('web') . ' ×1'), $dry);
check('a 12-hex token and the command that uses it', $token !== null && str_contains($dry, "--confirm=$token"), $dry);
check('the dry run deleted nothing', counts($db, TABLES) === $seeded);
[$rc2, $dry2] = reset_cli('--dry-run');
check('--dry-run prints the same token (same state, same token)', $rc2 === 0 && token_of($dry2) === $token, $dry2);
[$st, , $webDry] = req('GET', '/api/jd2-reset.php?dry-run=1');
check('over the web on the dev box: plain text, the same token (the key gate is for off the dev box)',
      $st === 200 && token_of($webDry) === $token && str_contains($webDry, 'jd2-reset.php?key=<jd_setup_key>&confirm=' . $token), $webDry);
[$st, , $webBoth] = req('GET', '/api/jd2-reset.php?dry-run=1&confirm=' . $token);
check('dry-run wins over confirm: nothing deleted', $st === 200 && str_contains($webBoth, 'DRY RUN') && counts($db, TABLES) === $seeded, $webBoth);

// ============================================================================
section('(c) refusals: a wrong token, a stale token, outside the window, off the dev box');
[$rc, $out] = reset_cli('--confirm=000000000000');
echo "\n---- wrong token output ----\n$out\n----\n";
check('a wrong token is refused, names the dry run, and nothing changes',
      $rc !== 0 && str_contains($out, 'does not match the tables as they stand now') && str_contains($out, 'Run the dry run again')
      && str_contains($out, 'JD_DEV_MOCK=1 php api/jd2-reset.php --dry-run') && !str_contains($out, $token)
      && !str_contains($out, 'PHP error') && counts($db, TABLES) === $seeded, $out);
[$st, , $body] = req('GET', '/api/jd2-reset.php?confirm=' . rawurlencode('<b>x</b>'));
check('the web refusal answers 409 and echoes the bad token escaped; nothing changes',
      $st === 409 && str_contains($body, '"?b?x??b?"') && counts($db, TABLES) === $seeded, $st . ' ' . $body);
[$st, $j] = req('POST', '/api/jd2-generate.php', ['client_ref' => jd_uuid4(), 'slot' => 'a', 'rerun_of' => $promptO, 'profile' => 'bench', 'website' => ''], true);
[$rc, $out] = reset_cli('--confirm=' . $token);
check('a STALE token (one drawing filed since the dry run) is refused; nothing deleted',
      $st === 200 && $rc !== 0 && str_contains($out, 'a row was filed since that dry run')
      && counts($db, TABLES)['jd2_generations'] === $seeded['jd2_generations'] + 1, $out);
[, $dry3] = reset_cli();
$token2 = token_of($dry3);
check('a fresh dry run gives a new token', $token2 !== null && $token2 !== $token, $dry3);
$now = counts($db, TABLES);
[$rc, $out] = reset_cli('--confirm=' . $token2, ['JD2_RESET_TODAY' => '2026-11-01']);
check('outside the window (dev clock 2026-11-01) the right token is refused; nothing deleted',
      $rc !== 0 && str_contains($out, "outside the reset's window") && counts($db, TABLES) === $now, $out);
[, $dryClosed] = reset_cli('', ['JD2_RESET_TODAY' => '2026-11-01']);
check('…and the dry run says the window is closed', str_contains($dryClosed, 'the window is closed'), $dryClosed);

// off the dev box: a copy of api/ with no secrets file, no JD_DEV_MOCK
$tmp = sys_get_temp_dir() . '/jd2-reset-gate-' . bin2hex(random_bytes(4));
mkdir($tmp . '/art/junk-drawer', 0775, true);
exec('cp -R ' . escapeshellarg($root . '/api') . ' ' . escapeshellarg($tmp . '/api'));
copy($root . '/art/junk-drawer/taxonomy.json', $tmp . '/art/junk-drawer/taxonomy.json');
$gate = static function (string $env) use ($tmp): array {
    $out = [];
    exec('env -u JD_DEV_MOCK -u JD_SETUP_KEY ' . $env . ' ' . escapeshellarg(PHP_BINARY) . ' '
        . escapeshellarg($tmp . '/api/jd2-reset.php') . ' --dry-run 2>&1', $out, $rc);
    return [$rc, implode("\n", $out)];
};
[$rcA, $outA] = $gate('');
[$rcB, $outB] = $gate('JD_SETUP_KEY=not-the-key');
exec('rm -rf ' . escapeshellarg($tmp));
check('JD_DEV_MODE false and no key: refused outright, before any database (CLI)',
      $rcA !== 0 && str_contains($outA, 'the setup key is missing or wrong') && str_contains($outA, 'Nothing was read')
      && !str_contains($outA, 'Database:'), $outA);
check('JD_DEV_MODE false and a key that matches nothing on file: refused', $rcB !== 0
      && str_contains($outB, 'the setup key is missing or wrong'), $outB);

// ============================================================================
section('(d) the real run: everything in the seven tables, nothing else, in one transaction, recorded');
$before = counts($db, TABLES);
[$rc, $real] = reset_cli('--confirm=' . $token2);
echo "\n---- real run output ----\n$real\n----\n";
check('the right token: rc 0, "reset complete", no PHP error', $rc === 0 && !str_contains($real, 'PHP error') && str_contains($real, 'done — reset complete: ' . array_sum($before) . ' row(s) deleted'), $real);
$beforeAfterOk = true;
foreach ($before as $t => $n) {
    $beforeAfterOk = $beforeAfterOk && preg_match('/^  ' . preg_quote($t, '/') . '\s+' . $n . '  →  0$/m', $real) === 1;
}
check('it prints each table before → after', $beforeAfterOk, $real);
check('the seven tables are empty', array_sum(counts($db, TABLES)) === 0, json_encode(counts($db, TABLES)));
check('the v1 jd_* tables are untouched (every count as before, the sentinel still there)',
      counts($db, V1_TABLES) === $v1Before && one($db, 'SELECT id FROM jd_submissions WHERE id = ?', [$SENTINEL]) === $SENTINEL,
      json_encode([$v1Before, counts($db, V1_TABLES)]));
$lines = is_file($LOG) ? file($LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
$last = json_decode((string) end($lines), true);
check('one line appended to local-dev/jd2-reset.log: token, before, deleted, after',
      count($lines) === $logLinesBefore + 1 && ($last['token'] ?? null) === $token2 && ($last['before'] ?? null) === $before
      && ($last['deleted'] ?? null) === $before && array_sum($last['after'] ?? [1]) === 0 && ($last['via'] ?? '') === 'cli',
      json_encode($last));
check('the stamp is written', is_file($STAMP) && (json_decode((string) file_get_contents($STAMP), true)['token'] ?? null) === $token2);
check('the output tells the owner to clear the batch runner\'s state file (--forget-state)',
      str_contains($real, 'php scripts/jd2-batch-run.php --forget-state') && str_contains($real, 'local-dev/jd2-batch-state.json'), $real);
[$st, $m] = req('GET', '/art/junk-drawer/data.php');
check('data.php answers an empty drawer', $st === 200 && ($m['items'] ?? null) === [], json_encode($m));

// ============================================================================
section('(e) a second run within the hour is refused');
[$runX] = visitorTurn('a tin robot with a wind-up key');
[, $dry4] = reset_cli();
$token3 = token_of($dry4);
check('the dry run still works and says when a real run is allowed again',
      $token3 !== null && str_contains($dry4, 'last real reset:') && str_contains($dry4, 'a real run is refused until'), $dry4);
$now = counts($db, TABLES);
[$rc, $out] = reset_cli('--confirm=' . $token3);
check('the real run with a right token is refused within the hour; nothing deleted, nothing logged',
      $rc !== 0 && str_contains($out, 'A second run within the hour is refused') && counts($db, TABLES) === $now
      && count(file($LOG, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES)) === $logLinesBefore + 1, $out);

// ============================================================================
section('(f) scripts/jd2-batch-run.php --forget-state');
$statePath = sys_get_temp_dir() . '/jd2-reset-state-' . bin2hex(random_bytes(4)) . '.json';
file_put_contents($statePath, json_encode(['version' => 1, 'bases' => [
    'https://municipalsky.com' => ['[bench-medium] a' => ['client_ref' => 'x'], '[bench-medium] b' => ['client_ref' => 'y']],
    'local' => ['[bench-medium] c' => ['client_ref' => 'z']],
]]));
$out = [];
exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/scripts/jd2-batch-run.php') . ' --forget-state --state '
    . escapeshellarg($statePath) . ' 2>&1', $out, $rc);
$out = implode("\n", $out);
check('--forget-state prints how many rows the file held, per base, and deletes it',
      $rc === 0 && str_contains($out, 'held 3 row(s)') && str_contains($out, 'https://municipalsky.com') && !is_file($statePath), $out);
$out = [];
exec(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/scripts/jd2-batch-run.php') . ' --forget-state --state '
    . escapeshellarg($statePath) . ' 2>&1', $out, $rc);
check('…and with no file says there is nothing to forget', $rc === 0 && str_contains(implode("\n", $out), 'nothing to forget'), implode("\n", $out));

// --- cleanup: the sentinel and the stamp (the log stays: it is the record) ----
$db->prepare('DELETE FROM jd_submissions WHERE id = ?')->execute([$SENTINEL]);
@unlink($STAMP);

printf("\n%d passed, %d failed\n", $passed, $failed);
if ($failed > 0) {
    echo "\n-- server log --\n" . @file_get_contents($serverLog);
}
exit($failed === 0 ? 0 : 1);

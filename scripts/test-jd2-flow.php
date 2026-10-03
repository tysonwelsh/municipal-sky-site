<?php
// The v2 core endpoints end to end, against the SQLite dev database and the
// mock provider (PLAN-V2 §3–§5; db/junk-drawer-v2-schema.md "Endpoints").
//
//   php scripts/test-jd2-flow.php
//
// HERMETIC: it sets JD_DEV_MOCK=1 for itself and for the server it starts,
// refuses to run where JD_DEV_MODE cannot be true (a box with the production
// secrets), and talks only to a `php -S` it starts on a free 127.0.0.1 port
// with the worktree as the document root. Nothing reaches a provider or a
// production URL. It EMPTIES the jd2_* tables of local-dev/jd-dev.sqlite
// first (DELETE in foreign-key order; the v1 jd_* tables are not touched),
// so it can be re-run at will.
//
// The bench key: the server reads config/secrets.php exactly as production
// does, so this script presents whatever key jd_bench_key_expected() finds
// there (never printed). A checkout with no key on file runs keyless, and
// there the gate is open in dev (v1's rule): any presented key makes the
// caller the owner, and a request without one is a visitor.
//
// Mock fixtures: local-dev/jd-mock/*.svg (gitignored) are written with small
// valid drawings when absent, so a fresh worktree can run this.
//
// (j) is the intake clerk (api/jd2-intake.php, the mock in dev): the columns
// it writes, its idempotence, its fallback (a second php -S started with
// JD_INTAKE_MOCK_FAIL tells the mock to fail), jd2-rate leaving the clerk's
// size alone, and jd2-curate's tags and owner size.
//
// (l) is the sanitizer's named normalization: a mock drawing whose <style>
// wraps its CSS in CDATA (the mock's '[cdata]' switch) files ok with
// normalized = 'cdata_unwrapped', and api/jd2-resanitize.php recovers the same
// drawings when they are seeded as the old rules filed them.
//
// One PASS/FAIL line per check, grouped by case (a)–(l); exit 0 iff all pass.

putenv('JD_DEV_MOCK=1');
putenv('JD_DEV_LATENCY_MS=1');
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

// --- 0. The dev database, the fixtures, the server ---------------------------
$setup = [];
exec('JD_DEV_MOCK=1 ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/api/setup-jd2-tables.php') . ' 2>&1', $setup, $rc);
if ($rc !== 0 || !in_array('All tables present and migrated.', $setup, true)) {
    fwrite(STDERR, "The jd2 runner did not finish cleanly:\n" . implode("\n", $setup) . "\n");
    exit(2);
}

$db = jd_db();
$db->exec('UPDATE jd2_prompts SET shown_run_id = NULL, pinned_generation_id = NULL');
foreach (['jd2_pairs', 'jd2_rankings', 'jd2_judgments', 'jd2_sessions', 'jd2_generations', 'jd2_runs', 'jd2_prompts'] as $t) {
    $db->exec("DELETE FROM $t");
}

$mockDir = $root . '/local-dev/jd-mock';
if (!is_dir($mockDir)) {
    mkdir($mockDir, 0775, true);
}
$fixtures = [
    'mock-anthropic.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#b8860b"/></svg>',
    'mock-openai.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" fill="#336"/></svg>',
    'mock-kimi.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M2 98 L50 2 L98 98 Z" fill="#a33"/></svg>',
    'mock-google.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="48" ry="30" fill="#3a3"/></svg>',
    'mock-hostile.svg' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script></svg>',
];
foreach ($fixtures as $name => $svg) {
    if (!is_file("$mockDir/$name")) {
        file_put_contents("$mockDir/$name", $svg . "\n");
    }
}

$probe = stream_socket_server('tcp://127.0.0.1:0');
$port = (int) substr(strrchr(stream_socket_get_name($probe, false), ':'), 1);
fclose($probe);
$serverLog = tempnam(sys_get_temp_dir(), 'jd2-flow-');
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

/** @return array{0:int,1:mixed,2:array<string,string>,3:string} status, decoded JSON (or null), headers, raw body */
function req(string $method, string $path, ?array $body = null, bool $owner = false, array $extraHeaders = []): array
{
    global $BASE, $BENCH_KEY;
    $ch = curl_init($BASE . $path);
    $headers = array_merge(['Origin: http://localhost:8000'], $extraHeaders);
    if ($owner) {
        $headers[] = 'X-Bench-Key: ' . $BENCH_KEY;
    }
    if ($body !== null) {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }
    $respHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADERFUNCTION => static function ($ch, $line) use (&$respHeaders) {
            if (str_contains($line, ':')) {
                [$k, $v] = explode(':', $line, 2);
                $respHeaders[strtolower(trim($k))] = trim($v);
            }
            return strlen($line);
        },
    ]);
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$status, json_decode($raw, true), $respHeaders, $raw];
}

function gen(array $body, bool $owner = false): array
{
    return req('POST', '/api/jd2-generate.php', $body, $owner);
}

function rate(array $body, bool $owner = false): array
{
    return req('POST', '/api/jd2-rate.php', $body, $owner);
}

function manifest(string $query = ''): array
{
    return req('GET', '/art/junk-drawer/data.php' . $query);
}

function rows(PDO $db, string $sql, array $args = []): array
{
    $q = $db->prepare($sql);
    $q->execute($args);
    return $q->fetchAll(PDO::FETCH_ASSOC);
}

function one(PDO $db, string $sql, array $args = []): mixed
{
    $q = $db->prepare($sql);
    $q->execute($args);
    return $q->fetchColumn();
}

/** A visitor's four slot requests for one prompt; returns [responses by slot, run id, prompt id]. */
function visitorTurn(string $prompt): array
{
    $ref = jd_uuid4();
    $device = jd_uuid4();
    $out = [];
    foreach (['a', 'b', 'c', 'd'] as $slot) {
        $out[$slot] = gen(['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt, 'client' => 'web',
                           'consent' => ['version' => JD_CONSENT_VERSION], 'device_ref' => $device, 'website' => '']);
    }
    return [$out, $out['a'][1]['run_id'] ?? null, $out['a'][1]['prompt_id'] ?? null, $ref];
}

$taxonomy = jd_taxonomy();
$liveAxes = jd_live_axes($taxonomy);
$axisRanks = jd_axis_ranks($taxonomy);
$poolIds = array_column(jd2_pool($taxonomy), 'model_id');

/** Every cell for every slot: grade $grades[slot], each live axis at its top rank, a note on the first axis of slot a. */
function fullRatings(array $grades, array $axisRanks): array
{
    $out = [];
    foreach ($grades as $slot => $grade) {
        $out[] = ['slot' => $slot, 'kind' => 'grade', 'value' => $grade];
        $first = true;
        foreach ($axisRanks as $axis => $ranks) {
            $r = ['slot' => $slot, 'kind' => 'axis', 'axis_id' => $axis, 'value' => max($ranks)];
            if ($first && $slot === 'a') {
                $r['note'] = 'crisp edges';
            }
            $first = false;
            $out[] = $r;
        }
    }
    return $out;
}

// ============================================================================
section('(a) a visitor turn: four slots, one run, one deal');
[$t1, $run1, $prompt1, $ref1] = visitorTurn('a brass key with a paper tag');
$allOk = true;
foreach ($t1 as $slot => [$st, $j]) {
    $allOk = $allOk && $st === 200 && ($j['ok'] ?? false) && str_contains((string) ($j['svg'] ?? ''), '<svg')
        && $j['run_id'] === $run1 && $j['prompt_id'] === $prompt1 && $j['submission_id'] === $run1;
}
check('four slots answer 200 with an svg, one run_id/prompt_id, submission_id = run_id', $allOk && jd_is_ulid($run1),
      json_encode(array_map(fn ($r) => [$r[0], $r[1]['error'] ?? null], $t1)));
$run = rows($db, 'SELECT * FROM jd2_runs WHERE id = ?', [$run1])[0] ?? [];
$deal = jd2_deal_decode($run['deal'] ?? null);
$sortedDeal = array_values($deal);
sort($sortedDeal);
$sortedPool = $poolIds;
sort($sortedPool);
check('the deal is stored: slots a–d, a permutation of the pool',
      array_keys($deal) === ['a', 'b', 'c', 'd'] && $sortedDeal === $sortedPool, json_encode($deal));
$gens1 = rows($db, 'SELECT * FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$run1]);
$matches = count($gens1) === 4;
foreach ($gens1 as $g) {
    $matches = $matches && $g['status'] === 'ok' && $g['model_id'] === $deal[$g['slot']]
        && $g['cost_usd'] !== null && (int) $g['priced'] === 1 && $g['usage_json'] !== null;
}
check('four ok generations, each the model the deal seated, priced at write time', $matches,
      json_encode(array_map(fn ($g) => [$g['slot'], $g['model_id'], $g['status'], $g['cost_usd'], $g['priced']], $gens1)));
check('run: initial, visitor, web profile, its harness and pool version, status generated',
      ($run['kind'] ?? '') === 'initial' && $run['requested_by'] === 'visitor' && $run['profile'] === 'web'
      && $run['harness'] === jd_harness('web') && $run['pool_version'] === jd2_pool_version($taxonomy)
      && $run['status'] === 'generated', json_encode($run));
$p = rows($db, 'SELECT * FROM jd2_prompts WHERE id = ?', [$prompt1])[0] ?? [];
check('prompt: visitor origin, draft, consent and visitor fields filed',
      ($p['origin'] ?? '') === 'visitor' && $p['visibility'] === 'draft' && $p['consent_version'] === JD_CONSENT_VERSION
      && $p['client_ref'] === $ref1 && strlen((string) $p['visitor_hash']) === 64 && $p['device_ref'] !== null, json_encode($p));
[$st, $j] = gen(['client_ref' => $ref1, 'slot' => 'a', 'prompt' => 'something else', 'client' => 'web',
                 'consent' => ['version' => JD_CONSENT_VERSION], 'website' => '']);
check('a retried slot re-answers its stored drawing (idempotent)', $st === 200 && $j['gen_id'] === $t1['a'][1]['gen_id']);
// a STRANDED pending slot (its claim older than the profile's timeout) is redrawn, not refused — on its own turn
[$tS, $runS, $promptS, $refS] = visitorTurn('a stranded slot test');
$oldGen = $tS['a'][1]['gen_id'];
$db->prepare("UPDATE jd2_generations SET status = 'pending', svg = NULL, created = ? WHERE id = ?")
   ->execute([gmdate('Y-m-d H:i:s', time() - 3600), $oldGen]);
[$st, $j] = gen(['client_ref' => $refS, 'slot' => 'a', 'prompt' => 'x', 'client' => 'web',
                 'consent' => ['version' => JD_CONSENT_VERSION], 'website' => '']);
$redrawn = rows($db, 'SELECT id, status FROM jd2_generations WHERE run_id = ? AND slot = ?', [$runS, 'a'])[0] ?? [];
check('a stranded pending slot is redrawn: 200, a new ok row, the dead claim gone',
      $st === 200 && ($redrawn['status'] ?? '') === 'ok' && ($redrawn['id'] ?? '') !== $oldGen && $j['gen_id'] === ($redrawn['id'] ?? null),
      json_encode([$st, $j, $redrawn]));
// the stranded-slot turn was only a fixture: remove it so the later prompt counts hold
$db->prepare('DELETE FROM jd2_generations WHERE run_id = ?')->execute([$runS]);
$db->prepare('DELETE FROM jd2_runs WHERE id = ?')->execute([$runS]);
$db->prepare('DELETE FROM jd2_prompts WHERE id = ?')->execute([$promptS]);
[$st, $j] = gen(['client_ref' => $ref1, 'slot' => 'e', 'prompt' => 'x', 'client' => 'web',
                 'consent' => ['version' => JD_CONSENT_VERSION], 'website' => '']);
check('a slot the deal does not hold is refused against the deal', $st === 400
      && str_contains($j['error']['message'] ?? '', 'a, b, c, d'), json_encode($j));
[$st, $j] = req('POST', '/api/jd2-intake.php', ['client_ref' => $ref1, 'prompt' => 'a brass key with a paper tag']);
check('jd2-intake answers for the turn (mock clerk): the inverted heading', $st === 200 && ($j['title'] ?? '') === 'Key, brass'
      && empty($j['fallback']), json_encode($j));
check('nothing is public yet: data.php is empty', (manifest()[1]['count'] ?? -1) === 0);

// ============================================================================
section('(b) the visitor files a complete sitting: grades, axes, a strict ranking with gaps');
$slotGen1 = [];
foreach ($gens1 as $g) {
    $slotGen1[$g['slot']] = $g['id'];
}
// place order c, a, d, b with gaps 2, 0, 1
$ranking1 = [['slot' => 'c', 'rank' => 1, 'gap' => 2], ['slot' => 'a', 'rank' => 2, 'gap' => 0],
             ['slot' => 'd', 'rank' => 3, 'gap' => 1], ['slot' => 'b', 'rank' => 4]];
// A visitor sitting needs the turn's own client_ref (the run id is public once
// the item is live; the client_ref is not). Missing or wrong → 403 not_yours.
$visitorBody1 = ['run_id' => $run1, 'client' => 'web', 'title' => 'Not Yours', 'suppress' => true,
                 'ratings' => fullRatings(['a' => 1, 'b' => 1, 'c' => 1, 'd' => 1], $axisRanks), 'ranking' => $ranking1];
[$st, $j] = rate($visitorBody1);
check('a visitor POST without client_ref → 403 not_yours "' . ($j['error']['message'] ?? '') . '"',
      $st === 403 && ($j['error']['code'] ?? '') === 'not_yours' && ($j['error']['message'] ?? '') !== '' && !isset($j['reveal']),
      $st . ' ' . json_encode($j));
[$st, $j] = rate($visitorBody1 + ['client_ref' => jd_uuid4()]);
check('a visitor POST with a wrong client_ref → 403 not_yours', $st === 403 && ($j['error']['code'] ?? '') === 'not_yours',
      $st . ' ' . json_encode($j));
check('…and neither filed a sitting nor touched the prompt (title, visibility)',
      (int) one($db, 'SELECT COUNT(*) FROM jd2_sessions WHERE run_id = ?', [$run1]) === 0
      && one($db, 'SELECT title FROM jd2_prompts WHERE id = ?', [$prompt1]) === 'Key, brass'
      && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$prompt1]) === 'draft');
[$st, $j] = rate([
    'submission_id' => $run1,   // the v1 alias the unchanged card sends
    'client_ref' => $ref1,      // the turn's own: the proof it is this visitor's
    'client' => 'web', 'title' => 'Brass Key', 'size' => 's', 'suppress' => false,
    'ratings' => fullRatings(['a' => 4, 'b' => 2, 'c' => 5, 'd' => 3], $axisRanks),
    'ranking' => $ranking1, 'pairs' => null,
    'comparison' => ['winner' => 'c', 'strength' => null],   // what the v1 card also sends; ignored
]);
$session1 = $j['session_id'] ?? null;
check('with the right client_ref: filed, 200, complete, a session id', $st === 200 && ($j['ok'] ?? false) && $j['complete'] === true && jd_is_ulid($session1),
      $st . ' ' . json_encode($j));
require_once $root . '/api/jd-build.php';
check("the filing answers `build`, the tooling fingerprint (as v1's writers did)", ($j['build'] ?? null) === jd_build_stamp()['build'],
      json_encode($j['build'] ?? null));
$reveal = $j['reveal'] ?? [];
$revealOk = count($reveal) === 4;
foreach ($reveal as $r) {
    $revealOk = $revealOk && $r['model_id'] === $deal[$r['slot']] && $r['label'] !== '' && $r['priced'] === true
        && is_float($r['cost_usd'] + 0.0) && isset($r['tokens']['total']);
}
check('the reveal names every model, with tokens and the cost snapshot', $revealOk, json_encode($reveal));
$s = rows($db, 'SELECT * FROM jd2_sessions WHERE id = ?', [$session1])[0] ?? [];
check('session: visitor, filed, stamped taxonomy and instrument, blind, seat_order = the deal',
      ($s['rater_role'] ?? '') === 'visitor' && $s['status'] === 'filed' && (int) $s['taxonomy_version'] === jd_taxonomy_version($taxonomy)
      && $s['instrument_version'] === JD2_INSTRUMENT_VERSION && (int) $s['blind'] === 1 && $s['started_at'] === $run['created']
      && json_decode($s['seat_order'], true) === $slotGen1, json_encode($s));
check('every cell filed: 4 grades + 4 × live axes', (int) one($db, 'SELECT COUNT(*) FROM jd2_judgments WHERE session_id = ?', [$session1])
      === 4 * (1 + count($liveAxes)));
$pairs1 = rows($db, 'SELECT * FROM jd2_pairs WHERE session_id = ?', [$session1]);
$derived = count($pairs1) === 6;
foreach ($pairs1 as $pr) {
    $derived = $derived && $pr['source'] === 'derived' && $pr['method'] === JD2_DERIVE_METHOD && $pr['shown_left'] === null;
}
check('six derived pairs, spaced-rank-v1', $derived, json_encode($pairs1));
$byKey = [];
foreach ($pairs1 as $pr) {
    $byKey[$pr['gen_a'] . '|' . $pr['gen_b']] = (int) $pr['score'];
}
// c (1st) over a (2nd) by 2; canonical order is by slot, so gen_a = a and the score is −2.
// c over b: 2+0+1 = 3. a over d: 0. d over b: 1 → gen_a = b, so −1.
check('scores signed against the slot order (a|c −2, b|c −3, a|d 0, b|d −1)',
      ($byKey[$slotGen1['a'] . '|' . $slotGen1['c']] ?? null) === -2 && ($byKey[$slotGen1['b'] . '|' . $slotGen1['c']] ?? null) === -3
      && ($byKey[$slotGen1['a'] . '|' . $slotGen1['d']] ?? null) === 0 && ($byKey[$slotGen1['b'] . '|' . $slotGen1['d']] ?? null) === -1,
      json_encode($byKey));
$gapRows = rows($db, 'SELECT generation_id, rank_pos, gap_after FROM jd2_rankings WHERE session_id = ? ORDER BY rank_pos', [$session1]);
check('the ranking and its gaps are filed as the raw answer',
      array_map(fn ($r) => [$r['generation_id'], (int) $r['rank_pos'], $r['gap_after'] === null ? null : (int) $r['gap_after']], $gapRows)
      === [[$slotGen1['c'], 1, 2], [$slotGen1['a'], 2, 0], [$slotGen1['d'], 3, 1], [$slotGen1['b'], 4, null]]);
$p = rows($db, 'SELECT * FROM jd2_prompts WHERE id = ?', [$prompt1])[0];
check('the prompt is live, with the title and size filed (the visitor\'s pick: size_by visitor)', $p['visibility'] === 'live'
      && $p['title'] === 'Brass Key' && $p['size_class'] === 's' && $p['size_by'] === 'visitor' && $p['approved_at'] === null,
      json_encode($p));

// ============================================================================
section('(c) data.php serves it: r1 = 1st place, six pairs');
[$st, $m, $h] = manifest();
$item = $m['items'][0] ?? [];
check('one item, keyed by the prompt, run_id and the submission_id shim', $st === 200 && $m['count'] === 1
      && $item['id'] === $prompt1 && $item['prompt_id'] === $prompt1 && $item['run_id'] === $run1
      && $item['submission_id'] === $run1 && $m['errors'] === [] && isset($m['taxonomy']['version']), json_encode($m));
check('responses in place order: r1 = c (1st), then a, d, b; primary r1',
      array_column($item['responses'] ?? [], 'gen_id') === [$slotGen1['c'], $slotGen1['a'], $slotGen1['d'], $slotGen1['b']]
      && array_column($item['responses'], 'rid') === ['r1', 'r2', 'r3', 'r4']
      && array_column($item['responses'], 'rank') === [1, 2, 3, 4] && $item['primary'] === 'r1');
$r2 = $item['responses'][1] ?? [];
$firstAxis = array_key_first($liveAxes);
check('v1 response shape: model, model_version, grade, annotations (a note as {value, note}), url, cost',
      $r2['model'] === $deal['a'] && $r2['model_version'] !== '' && (float) $r2['grade'] === 4.0
      && ($r2['annotations'][$firstAxis]['note'] ?? null) === 'crisp edges'
      && $r2['url'] === '/api/jd2-gen-svg.php?gen=' . $slotGen1['a'] && $r2['file'] === $slotGen1['a'] . '.svg'
      && $r2['generation'] === ['mode' => 'one-shot', 'prompt_count' => 1] && $r2['transcript_url'] === null
      && isset($r2['cost_usd'], $r2['tokens']), json_encode($r2));
$pairsOut = $item['pairs'] ?? [];
$ridOk = count($pairsOut) === 6;
foreach ($pairsOut as $pp) {
    $ridOk = $ridOk && $pp['source'] === 'derived' && preg_match('/^r[1-4]$/', $pp['a']) && preg_match('/^r[1-4]$/', $pp['b']);
}
check('six pairs, by rid, derived', $ridOk, json_encode($pairsOut));
check('the item carries title, size, origin, fromTurn', $item['title'] === 'Brass Key' && $item['sizeClass'] === 's'
      && $item['origin'] === 'visitor' && $item['fromTurn'] === true && !isset($item['hidden']));
[$st, $slim] = manifest('?slim=1');
check('?slim=1 through _slim.php: one response, the shown one', $st === 200 && ($slim['slim'] ?? false) && $slim['count'] === 1
      && count($slim['items'][0]['responses']) === 1 && !isset($slim['items'][0]['responses'][0]['gen_id'])
      && $slim['items'][0]['responses'][0]['url'] === $item['responses'][0]['url'], json_encode($slim['items'] ?? null));
[$st] = req('GET', '/art/junk-drawer/data.php', null, false, ['If-None-Match: ' . ($h['etag'] ?? '')]);
check('an unchanged manifest revalidates (304 on its ETag)', $st === 304, (string) $st);
[$st, , $hh, $raw] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c']);
$svgTag = '"' . md5((string) one($db, 'SELECT svg FROM jd2_generations WHERE id = ?', [$slotGen1['c']])) . '"';
check('jd2-gen-svg serves a live drawing to anyone: private, max-age=86400, ETag = md5 of the svg, nosniff',
      $st === 200 && str_starts_with($hh['content-type'] ?? '', 'image/svg+xml') && str_contains($raw, '<svg')
      && ($hh['cache-control'] ?? '') === 'private, max-age=86400' && ($hh['etag'] ?? '') === $svgTag
      && ($hh['x-content-type-options'] ?? '') === 'nosniff', json_encode($hh));
[$st, , $hh, $raw] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c'], null, false, ['If-None-Match: ' . $svgTag]);
check('…and revalidates: 304, no body, on its ETag', $st === 304 && $raw === '', (string) $st);
[$st, , $hh] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c'], null, false, ['If-None-Match: "stale"']);
check('…a different ETag gets the drawing again (200)', $st === 200, (string) $st);
[$st, , $hh] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c'], null, true);
check('a keyed answer stays no-store, without an ETag', $st === 200 && str_contains($hh['cache-control'] ?? '', 'no-store')
      && !isset($hh['etag']) && ($hh['x-content-type-options'] ?? '') === 'nosniff', json_encode($hh));
[$st] = req('GET', '/api/jd2-gen-svg.php?gen=' . $t1['a'][1]['gen_id'] . 'X');
check('jd2-gen-svg refuses a malformed id', $st === 400);

// ============================================================================
section('(d) one visitor sitting per run; a live item is not a stranger\'s to rate');
[$st, $j] = rate(['run_id' => $run1, 'client_ref' => $ref1, 'client' => 'web',
                  'ratings' => fullRatings(['a' => 1, 'b' => 1, 'c' => 1, 'd' => 1], $axisRanks), 'ranking' => $ranking1]);
check('a second visitor sitting (the right client_ref) is 409 already_rated, with no reveal', $st === 409
      && ($j['error']['code'] ?? '') === 'already_rated' && !isset($j['reveal']), json_encode($j));
// the item is live now: data.php publishes its run_id and origin — a stranger
// holding only those cannot hide it or rename it
[$st, $j] = rate($visitorBody1);
check('a stranger with the public run_id (no client_ref) is 403 not_yours, not 409', $st === 403
      && ($j['error']['code'] ?? '') === 'not_yours', json_encode($j));
check('…and the live item keeps its title, its visibility and its one visitor sitting',
      one($db, 'SELECT title FROM jd2_prompts WHERE id = ?', [$prompt1]) === 'Brass Key'
      && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$prompt1]) === 'live'
      && (int) one($db, 'SELECT COUNT(*) FROM jd2_sessions WHERE run_id = ?', [$run1]) === 1);

// ============================================================================
section('(e) the owner re-rates the same run with DIRECT pairs');
$direct = [
    ['slot_a' => 'a', 'slot_b' => 'b', 'score' => 3, 'shown_left' => 'a'],
    ['slot_a' => 'a', 'slot_b' => 'c', 'score' => 2, 'shown_left' => 'c'],
    ['slot_a' => 'd', 'slot_b' => 'a', 'score' => -1],                       // re-signed: a|d +1
    ['slot_a' => 'b', 'slot_b' => 'c', 'score' => 0],
    ['slot_a' => 'b', 'slot_b' => 'd', 'score' => -2],
    ['slot_a' => 'c', 'slot_b' => 'd', 'score' => 1],
];
[$st, $j] = rate(['run_id' => $run1, 'client' => 'web', 'blind' => false,
                  'ratings' => fullRatings(['a' => 5, 'b' => 5, 'c' => 5, 'd' => 5], $axisRanks),
                  'ranking' => [['slot' => 'a', 'rank' => 1], ['slot' => 'c', 'rank' => 2], ['slot' => 'd', 'rank' => 3], ['slot' => 'b', 'rank' => 4]],
                  'pairs' => $direct,
                  // the sitting's note (Phase 4b): trimmed, clipped at 2000
                  'note' => "  a and c read the brief; b missed the cracked glass\n" . str_repeat('x', 2100) . '  '], true);
$session2 = $j['session_id'] ?? null;
check('the owner (bench key, no client_ref) files a second session on the run: 200, complete', $st === 200 && $j['complete'] === true && $session2 !== $session1,
      $st . ' ' . json_encode($j));
$s2 = rows($db, 'SELECT * FROM jd2_sessions WHERE id = ?', [$session2])[0] ?? [];
check('owner session: role owner, the curator hash, blind 0 (bench key + blind:false)',
      ($s2['rater_role'] ?? '') === 'owner' && $s2['rater_hash'] === jd_curator_hash() && (int) $s2['blind'] === 0, json_encode($s2));
check("the sitting's note lands on jd2_sessions.note, trimmed and clipped to 2000; the visitor's sitting has none",
      is_string($s2['note'] ?? null) && mb_strlen($s2['note']) === 2000
      && str_starts_with($s2['note'], "a and c read the brief; b missed the cracked glass\nxxx")
      && one($db, 'SELECT note FROM jd2_sessions WHERE id = ?', [$session1]) === null,
      json_encode(['len' => mb_strlen((string) ($s2['note'] ?? '')), 'head' => substr((string) ($s2['note'] ?? ''), 0, 60)]));
$pairs2 = rows($db, 'SELECT * FROM jd2_pairs WHERE session_id = ?', [$session2]);
$allDirect = count($pairs2) === 6;
$k2 = [];
foreach ($pairs2 as $pr) {
    $allDirect = $allDirect && $pr['source'] === 'direct' && $pr['method'] === null;
    $k2[$pr['gen_a'] . '|' . $pr['gen_b']] = [(int) $pr['score'], $pr['shown_left']];
}
check('six DIRECT pairs and nothing derived for that session', $allDirect, json_encode($pairs2));
check('a pair sent as (d, a, −1) is stored canonically as a|d +1; shown_left kept as a generation',
      ($k2[$slotGen1['a'] . '|' . $slotGen1['d']][0] ?? null) === 1
      && ($k2[$slotGen1['a'] . '|' . $slotGen1['c']] ?? null) === [2, $slotGen1['c']], json_encode($k2));
$cur = jd2_current_session($db, $run1);
check('jd2_current_session: the owner outranks the visitor; per role, each its own',
      ($cur['id'] ?? null) === $session2 && (jd2_current_session($db, $run1, 'visitor')['id'] ?? null) === $session1
      && (jd2_current_session($db, $run1, 'owner')['id'] ?? null) === $session2);
[$st, $m] = manifest();
$item = $m['items'][0] ?? [];
check("data.php now shows the owner's sitting: r1 = a, every grade 5, pairs direct",
      ($item['responses'][0]['gen_id'] ?? null) === $slotGen1['a']
      && array_map(fn ($r) => (float) $r['grade'], $item['responses']) === [5.0, 5.0, 5.0, 5.0]
      && array_unique(array_column($item['pairs'], 'source')) === ['direct'], json_encode($item));

// ============================================================================
section('(f) the owner reruns the prompt (the wire word `bench` = the default owner profile)');
[$st, $j] = gen(['client_ref' => jd_uuid4(), 'slot' => 'a', 'rerun_of' => $prompt1, 'website' => '']);
check('a rerun without the bench key is 403', $st === 403, json_encode($j));
$ref = jd_uuid4();
[$st, $j] = gen(['client_ref' => $ref, 'slot' => 'a', 'rerun_of' => $prompt1, 'profile' => 'bench', 'website' => ''], true);
$run2 = $j['run_id'] ?? null;
$rerunOk = $st === 200 && jd_is_ulid($run2) && $run2 !== $run1 && $j['prompt_id'] === $prompt1;
foreach (['b', 'c', 'd'] as $slot) {
    [$st2, $j2] = gen(['client_ref' => $ref, 'slot' => $slot, 'rerun_of' => $prompt1, 'run_id' => $run2, 'website' => ''], true);
    $rerunOk = $rerunOk && $st2 === 200 && $j2['run_id'] === $run2;
}
check('slot a makes the rerun, slots b–d join it by run_id', $rerunOk, json_encode($j));
$r2row = rows($db, 'SELECT * FROM jd2_runs WHERE id = ?', [$run2])[0] ?? [];
$params = json_decode((string) one($db, "SELECT params FROM jd2_generations WHERE run_id = ? AND slot = 'a'", [$run2]), true);
check('second run on the same prompt: rerun, owner, `bench` filed as ' . JD2_OWNER_DEFAULT_PROFILE . ' with its harness and budget; no new prompt',
      ($r2row['kind'] ?? '') === 'rerun' && $r2row['requested_by'] === 'owner' && $r2row['profile'] === JD2_OWNER_DEFAULT_PROFILE
      && JD2_OWNER_DEFAULT_PROFILE === 'bench-medium'
      && $r2row['harness'] === jd_harness(JD2_OWNER_DEFAULT_PROFILE) && $r2row['harness'] === 'v4-benchmed.1' && $r2row['status'] === 'generated'
      && ($params['effort_profile'] ?? '') === JD2_OWNER_DEFAULT_PROFILE && ($params['harness'] ?? '') === 'v4-benchmed.1'
      && ($params['max_tokens'] ?? $params['max_completion_tokens'] ?? $params['max_output_tokens'] ?? null) === 64000
      && (int) one($db, 'SELECT COUNT(*) FROM jd2_prompts') === 1
      && (int) one($db, 'SELECT COUNT(*) FROM jd2_runs WHERE prompt_id = ?', [$prompt1]) === 2, json_encode($r2row));
check('shown_run_id is untouched and data.php still shows the first run (the rerun is unrated)',
      one($db, 'SELECT shown_run_id FROM jd2_prompts WHERE id = ?', [$prompt1]) === null
      && (manifest()[1]['items'][0]['run_id'] ?? null) === $run1);
[$st, $j] = rate(['run_id' => $run2, 'client' => 'web', 'ratings' => fullRatings(['a' => 3, 'b' => 3, 'c' => 3, 'd' => 3], $axisRanks),
                  'ranking' => [['slot' => 'b', 'rank' => 1, 'gap' => 1], ['slot' => 'a', 'rank' => 2, 'gap' => 1],
                                ['slot' => 'c', 'rank' => 3, 'gap' => 1], ['slot' => 'd', 'rank' => 4]]], true);
check('the owner rates the rerun complete', $st === 200 && $j['complete'] === true, json_encode($j));
check('with shown_run_id NULL the drawer shows the newest complete run (the rerun)',
      (manifest()[1]['items'][0]['run_id'] ?? null) === $run2
      && one($db, 'SELECT shown_run_id FROM jd2_prompts WHERE id = ?', [$prompt1]) === null);
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'shown_run_id' => $run1], true);
check('jd2-curate sets shown_run_id (answering `build`); the drawer goes back to the first run',
      $st === 200 && ($j['build'] ?? null) === jd_build_stamp()['build'] && $j['prompt']['shown_run_id'] === $run1 && (manifest()[1]['items'][0]['run_id'] ?? null) === $run1, json_encode($j));
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'pinned_generation_id' => $slotGen1['d']], true);
$it = manifest()[1]['items'][0] ?? [];
$ridD = null;
foreach ($it['responses'] ?? [] as $r) {
    if ($r['gen_id'] === $slotGen1['d']) {
        $ridD = $r['rid'];
    }
}
check('a pin re-points primary to the pinned drawing', $st === 200 && $ridD !== null && $it['primary'] === $ridD && $ridD !== 'r1');
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'shown_run_id' => $run2], true);
check('curate accepts a run of the same prompt as shown_run_id and refuses a foreign one',
      $st === 200 && req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'shown_run_id' => jd_ulid()], true)[0] === 400);
req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'shown_run_id' => $run1, 'pinned_generation_id' => null], true);

// ============================================================================
section('(g) the owner hides the prompt');
[$st] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'visibility' => 'hidden']);
check('jd2-curate without the bench key is refused', in_array($st, [403], true) || jd_bench_key_expected() === null, (string) $st);
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $prompt1, 'visibility' => 'hidden'], true);
check('hidden: visibility hidden, hidden_by owner, the standing lists both runs and their sessions',
      $st === 200 && $j['prompt']['visibility'] === 'hidden' && $j['prompt']['hidden_by'] === 'owner' && $j['prompt']['hidden_at'] !== null
      && count($j['runs']) === 2 && count($j['runs'][1]['sessions']) === 2 && $j['runs'][1]['display_session_id'] === $session2,
      json_encode($j));
check('gone from the manifest', (manifest()[1]['count'] ?? -1) === 0);
[$st, $j] = manifest('?item=' . $prompt1);
check('?item= still answers it, marked hidden', $st === 200 && ($j['item']['id'] ?? null) === $prompt1 && ($j['item']['hidden'] ?? false) === true,
      json_encode($j));
[$st] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c']);
[$stKeyed, , $hKeyed] = req('GET', '/api/jd2-gen-svg.php?gen=' . $slotGen1['c'], null, true);
check('jd2-gen-svg: 404 to the public, 200 no-store to the bench key', ($st === 404 || jd_bench_key_expected() === null) && $stKeyed === 200
      && str_contains($hKeyed['cache-control'] ?? '', 'no-store'), "$st / $stKeyed");
$tag0 = manifest('?item=' . $prompt1)[2]['etag'] ?? '';
[$st, $j] = req('POST', '/api/jd2-curate.php', ['generation_id' => $slotGen1['b'], 'hidden' => true], true);
[, $ji, $hi] = manifest('?item=' . $prompt1);
check('hiding one drawing drops it from the card (3 responses) and moves the ETag; showing it puts it back',
      $st === 200 && count($ji['item']['responses']) === 3 && ($hi['etag'] ?? '') !== $tag0
      && req('POST', '/api/jd2-curate.php', ['generation_id' => $slotGen1['b'], 'hidden' => false], true)[0] === 200
      && count(manifest('?item=' . $prompt1)[1]['item']['responses']) === 4
      && (manifest('?item=' . $prompt1)[2]['etag'] ?? '') === $tag0);
[$st] = manifest('?item=' . jd_ulid());
check('?item= for an unknown id is 404', $st === 404);

// ============================================================================
section('(h) refusals, each with its sentence, and nothing filed');
[$t2, $run3, $prompt3, $ref3] = visitorTurn('a tin whistle');
$base = ['run_id' => $run3, 'client_ref' => $ref3, 'client' => 'web', 'ratings' => fullRatings(['a' => 3, 'b' => 3, 'c' => 3, 'd' => 3], $axisRanks)];
$cases = [
    'a tie (two drawings at place 2)' => [
        ['ranking' => [['slot' => 'a', 'rank' => 1, 'gap' => 1], ['slot' => 'b', 'rank' => 2, 'gap' => 0],
                       ['slot' => 'c', 'rank' => 2, 'gap' => 1], ['slot' => 'd', 'rank' => 3]]],
        'ranking_invalid', 'share a place'],
    'a gap of 4' => [
        ['ranking' => [['slot' => 'a', 'rank' => 1, 'gap' => 4], ['slot' => 'b', 'rank' => 2, 'gap' => 0],
                       ['slot' => 'c', 'rank' => 3, 'gap' => 1], ['slot' => 'd', 'rank' => 4]]],
        'ranking_invalid', 'from 0 to 3'],
    'a pair scored twice' => [
        ['pairs' => [['slot_a' => 'a', 'slot_b' => 'b', 'score' => 1], ['slot_a' => 'b', 'slot_b' => 'a', 'score' => -1]]],
        'pairs_invalid', 'scored twice'],
    'a foreign slot in a rating' => [
        ['ratings' => [['slot' => 'z', 'kind' => 'grade', 'value' => 3]]],
        'rating_invalid', 'no usable drawing'],
    "another run's generation id in a rating" => [
        ['ratings' => [['gen_id' => $slotGen1['a'], 'kind' => 'grade', 'value' => 3]]],
        'rating_invalid', 'no usable drawing'],
    'a foreign slot in the ranking' => [
        ['ranking' => [['slot' => 'z', 'rank' => 1, 'gap' => 1], ['slot' => 'b', 'rank' => 2, 'gap' => 0],
                       ['slot' => 'c', 'rank' => 3, 'gap' => 1], ['slot' => 'd', 'rank' => 4]]],
        'ranking_invalid', 'no usable drawing'],
    'a gap on the last place' => [
        ['ranking' => [['slot' => 'a', 'rank' => 1, 'gap' => 1], ['slot' => 'b', 'rank' => 2, 'gap' => 0],
                       ['slot' => 'c', 'rank' => 3, 'gap' => 1], ['slot' => 'd', 'rank' => 4, 'gap' => 1]]],
        'ranking_invalid', 'last place'],
    'a pair score of 4' => [
        ['pairs' => [['slot_a' => 'a', 'slot_b' => 'b', 'score' => 4]]],
        'pairs_invalid', 'from -3 to 3'],
];
foreach ($cases as $name => [$patch, $code, $needle]) {
    [$st, $j] = rate(array_merge($base, $patch));
    check("$name → 400 $code \"" . ($j['error']['message'] ?? '') . '"',
          $st === 400 && ($j['error']['code'] ?? '') === $code && str_contains($j['error']['message'] ?? '', $needle), json_encode($j));
}
check('nothing was filed on that run', (int) one($db, 'SELECT COUNT(*) FROM jd2_sessions WHERE run_id = ?', [$run3]) === 0
      && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$prompt3]) === 'draft');
[$st, $j] = gen(['client_ref' => jd_uuid4(), 'slot' => 'a', 'prompt' => 'x', 'client' => 'web', 'website' => '']);
check('a visitor without consent is refused', $st === 400 && ($j['error']['code'] ?? '') === 'consent_required');
[$st, $j] = gen(['client_ref' => jd_uuid4(), 'slot' => 'a', 'prompt' => 'x', 'client' => 'web', 'profile' => 'bench',
                 'consent' => ['version' => JD_CONSENT_VERSION], 'website' => '']);
check('a visitor asking for the bench profile is refused', $st === 403);
[$st, $j] = rate(array_merge($base, ['ranking' => null]));
check('a sitting without ranking or pairs files, incomplete, and the prompt stays draft',
      $st === 200 && $j['complete'] === false && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$prompt3]) === 'draft',
      json_encode($j));

// ============================================================================
section('(i) the drawer paints through a database fault');
// The jd2 tables made unreadable for one request (renamed away and back):
// data.php must answer 200 with the taxonomy and no items, never a 500.
$db->exec('ALTER TABLE jd2_sessions RENAME TO jd2_sessions_away');
try {
    [$st, $m] = manifest();
    [$stItem] = manifest('?item=' . $prompt3);
} finally {
    $db->exec('ALTER TABLE jd2_sessions_away RENAME TO jd2_sessions');
}
check('manifest: 200, count 0, the taxonomy, errors []', $st === 200 && ($m['count'] ?? -1) === 0 && $m['items'] === []
      && isset($m['taxonomy']['version']) && $m['errors'] === [], $st . ' ' . substr(json_encode($m), 0, 200));
check('?item= answers 503, not 500', $stItem === 503, (string) $stItem);

// ============================================================================
section('(j) the intake clerk: heading, size tier and classification on the prompt row');
/** A second dev server, with $env added (the mock told to fail); returns its base URL. */
function extraServer(array $env): string
{
    global $root;
    $probe = stream_socket_server('tcp://127.0.0.1:0');
    $port = (int) substr(strrchr(stream_socket_get_name($probe, false), ':'), 1);
    fclose($probe);
    $proc = proc_open([PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root],
        [0 => ['file', '/dev/null', 'r'], 1 => ['file', '/dev/null', 'a'], 2 => ['file', '/dev/null', 'a']],
        $pipes, $root, array_merge(getenv(), ['JD_DEV_MOCK' => '1', 'JD_DEV_LATENCY_MS' => '1'], $env));
    register_shutdown_function(static function () use ($proc): void {
        proc_terminate($proc);
    });
    for ($i = 0; $i < 100; $i++) {
        $s = @fsockopen('127.0.0.1', $port, $errno, $errstr, 0.1);
        if ($s) {
            fclose($s);
            break;
        }
        usleep(50000);
    }
    return "http://127.0.0.1:$port";
}
function intake(array $body, bool $owner = false, ?string $base = null): array
{
    global $BASE;
    $keep = $BASE;
    if ($base !== null) {
        $BASE = $base;
    }
    try {
        return req('POST', '/api/jd2-intake.php', $body, $owner);
    } finally {
        $BASE = $keep;
    }
}
$IP = 'a pewter thimble on a velvet cushion';
[, $runI, $promptI, $refI] = visitorTurn($IP);
[$st, $j] = intake(['client_ref' => $refI, 'prompt' => $IP]);
$tiers = array_keys(jd_size_tiers($taxonomy));
$wantTier = $tiers[mb_strlen($IP) % count($tiers)];
check('a visitor turn: 200 with the mock clerk\'s heading, tier (by length) and headings, no fallback',
      $st === 200 && ($j['title'] ?? '') === 'Thimble, pewter' && ($j['size_class'] ?? '') === $wantTier
      && ($j['size_by'] ?? '') === 'model' && ($j['tags'] ?? null) === ['subject' => ['object'], 'treatment' => [], 'probe' => []]
      && isset($j['reasons']['size'], $j['reasons']['classification']) && empty($j['fallback']), json_encode($j));
$pi = rows($db, 'SELECT * FROM jd2_prompts WHERE id = ?', [$promptI])[0];
$rec = json_decode((string) $pi['intake_json'], true);
check('the row: title, size_class, size_by model, tags, intake_version, intake_model mock, intake_json, intake_at',
      $pi['title'] === 'Thimble, pewter' && $pi['size_class'] === $wantTier && $pi['size_by'] === 'model'
      && json_decode((string) $pi['tags'], true) === ['subject' => ['object'], 'treatment' => [], 'probe' => []]
      && $pi['intake_version'] === jd2_intake_version($taxonomy) && $pi['intake_model'] === 'mock'
      && ($rec['answer']['title'] ?? '') === 'Thimble, pewter' && ($rec['stop_reason'] ?? '') === 'end_turn'
      && array_key_exists('key', $rec) && $rec['key'] === null && $pi['intake_at'] !== null && $pi['intake_cost_usd'] === null,
      json_encode($pi));
$at = $pi['intake_at'];
sleep(1);
[$st, $j2] = intake(['client_ref' => $refI, 'prompt' => 'something else entirely']);
check('a second call is idempotent: the stored answer (stored: true), nothing re-filed',
      $st === 200 && !empty($j2['stored']) && $j2['title'] === $j['title'] && $j2['size_class'] === $j['size_class']
      && $j2['tags'] === $j['tags'] && one($db, 'SELECT intake_at FROM jd2_prompts WHERE id = ?', [$promptI]) === $at,
      json_encode($j2));
[$st, $j] = intake(['client_ref' => jd_uuid4(), 'prompt' => 'x']);
check('a client_ref with no current turn → 403 no_turn', $st === 403 && ($j['error']['code'] ?? '') === 'no_turn', json_encode($j));

// jd2-rate without a size: the clerk's tier stands (never NULL), size_by stays model
$axisAll = fullRatings(['a' => 3, 'b' => 2, 'c' => 4, 'd' => 1], $axisRanks);
[$st, $j] = rate(['run_id' => $runI, 'client_ref' => $refI, 'client' => 'web', 'title' => 'Thimble, pewter',
                  'ratings' => $axisAll, 'ranking' => [['slot' => 'c', 'rank' => 1, 'gap' => 1], ['slot' => 'a', 'rank' => 2, 'gap' => 1],
                  ['slot' => 'b', 'rank' => 3, 'gap' => 1], ['slot' => 'd', 'rank' => 4]]]);
$pi = rows($db, 'SELECT size_class, size_by, visibility FROM jd2_prompts WHERE id = ?', [$promptI])[0];
check('a visitor sitting with no size leaves the clerk\'s size alone (size_by model)', $st === 200 && $j['complete'] === true
      && $pi['size_class'] === $wantTier && $pi['size_by'] === 'model' && $pi['visibility'] === 'live', $st . ' ' . json_encode($pi));
[$st, $m] = manifest('?item=' . $promptI);
check('data.php: the item carries the clerk\'s sizeClass, size_by and tags',
      ($m['item']['sizeClass'] ?? '') === $wantTier && ($m['item']['size_by'] ?? '') === 'model'
      && ($m['item']['tags']['subject'] ?? null) === ['object'], json_encode(array_intersect_key($m['item'] ?? [], array_flip(['sizeClass', 'size_by', 'tags']))));

// the fallback: a server whose mock is told to fail
$failBase = extraServer(['JD_INTAKE_MOCK_FAIL' => 'provider']);
$FP = 'an origami crane folded from a subway map, slightly crumpled at one wing';
[, $runF, $promptF, $refF] = visitorTurn($FP);
[$st, $j] = intake(['client_ref' => $refF, 'prompt' => $FP], false, $failBase);
check('a failed intake still answers 200 ok: the prompt\'s 41 characters + …, size and tags null, fallback',
      $st === 200 && ($j['ok'] ?? false) === true && !empty($j['fallback']) && $j['title'] === jd_turn_title(null, $FP)
      && $j['size_class'] === null && $j['tags'] === null, json_encode($j));
$pf = rows($db, 'SELECT * FROM jd2_prompts WHERE id = ?', [$promptF])[0];
$recF = json_decode((string) $pf['intake_json'], true);
check('…and writes nothing but intake_json (the error): no title, size, tags or intake_at',
      $pf['title'] === null && $pf['size_class'] === null && $pf['size_by'] === null && $pf['tags'] === null
      && $pf['intake_at'] === null && $pf['intake_model'] === null && ($recF['error']['code'] ?? '') === 'provider_failed',
      json_encode($pf));
[$st, $l] = req('GET', '/api/jd2-ledger.php?prompt=' . $promptF, null, true);
check('the ledger shows the failure (fallback, intake_error)', $st === 200 && ($l['items'][0]['fallback'] ?? null) === true
      && ($l['items'][0]['intake_error'] ?? '') === 'provider_failed', json_encode(array_intersect_key($l['items'][0] ?? [], array_flip(['fallback', 'intake_error']))));
[$st, $j] = intake(['client_ref' => $refF, 'prompt' => $FP]);
check('a later call (the clerk answering) files it: intake_at set, the error replaced',
      $st === 200 && empty($j['fallback']) && one($db, 'SELECT intake_at FROM jd2_prompts WHERE id = ?', [$promptF]) !== null
      && !isset(json_decode((string) one($db, 'SELECT intake_json FROM jd2_prompts WHERE id = ?', [$promptF]), true)['error']),
      json_encode($j));

// the owner: curate's tags and size (size_by owner); the clerk never overwrites them
$ownerRef = jd_uuid4();
foreach (['a', 'b', 'c', 'd'] as $slot) {
    [, $jo] = gen(['client_ref' => $ownerRef, 'slot' => $slot, 'prompt' => 'a lead soldier missing its musket', 'website' => ''], true);
}
$promptO = $jo['prompt_id'] ?? '';
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $promptO, 'title' => 'Soldier (toy), lead', 'size_class' => 'xs'], true);
check('curate: a size filed through jd2-curate is the owner\'s (size_by owner)', $st === 200
      && ($j['prompt']['size_class'] ?? '') === 'xs' && ($j['prompt']['size_by'] ?? '') === 'owner', json_encode($j['prompt'] ?? $j));
[$st, $j] = intake(['prompt_id' => $promptO], true);
$po = rows($db, 'SELECT title, size_class, size_by, tags, intake_at FROM jd2_prompts WHERE id = ?', [$promptO])[0];
check('owner intake (prompt_id + key): the owner\'s title and size stand; the clerk files the headings',
      $st === 200 && $po['title'] === 'Soldier (toy), lead' && $po['size_class'] === 'xs' && $po['size_by'] === 'owner'
      && $po['tags'] !== null && $po['intake_at'] !== null && ($j['title'] ?? '') === 'Soldier (toy), lead', json_encode($po));
$tagsO = ['subject' => ['figure', 'object'], 'treatment' => [], 'probe' => ['state']];
[$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $promptO, 'tags' => $tagsO], true);
check('curate: tags filed (validated against the facets)', $st === 200 && ($j['prompt']['tags'] ?? null) === $tagsO
      && json_decode((string) one($db, 'SELECT tags FROM jd2_prompts WHERE id = ?', [$promptO]), true) === $tagsO, json_encode($j['prompt'] ?? $j));
$bad = [
    'an unknown heading' => ['subject' => ['spaceship'], 'treatment' => [], 'probe' => []],
    'no subject (min 1)' => ['subject' => [], 'treatment' => [], 'probe' => []],
    'a repeated heading' => ['subject' => ['object', 'object'], 'treatment' => [], 'probe' => []],
    'a missing facet' => ['subject' => ['object'], 'treatment' => []],
    'an unknown facet' => ['subject' => ['object'], 'treatment' => [], 'probe' => [], 'mood' => []],
    'seven headings (max 6)' => ['subject' => ['object', 'creature', 'figure', 'plant', 'food', 'vehicle', 'natural'], 'treatment' => [], 'probe' => []],
];
foreach ($bad as $name => $t) {
    [$st, $j] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $promptO, 'tags' => $t], true);
    check("curate refuses tags with $name → 400", $st === 400 && ($j['error']['code'] ?? '') === 'bad_request', json_encode($j));
}
check('…and the filed tags are unchanged', json_decode((string) one($db, 'SELECT tags FROM jd2_prompts WHERE id = ?', [$promptO]), true) === $tagsO);
// a bench sitting that files a size: size_by owner
$runO = $jo['run_id'] ?? '';
[$st, $j] = rate(['run_id' => $runO, 'client' => 'web', 'size' => 'l', 'ratings' => fullRatings(['a' => 3, 'b' => 3, 'c' => 3, 'd' => 3], $axisRanks)], true);
check('an owner sitting that files a size writes size_by owner', $st === 200
      && one($db, 'SELECT size_class FROM jd2_prompts WHERE id = ?', [$promptO]) === 'l'
      && one($db, 'SELECT size_by FROM jd2_prompts WHERE id = ?', [$promptO]) === 'owner', json_encode($j));

// ============================================================================
section('(k) the effort profiles: default, explicit, refused, retired');
$profPrompt = 'a brass compass with a cracked glass';
$runsBy = [];
foreach ([null, 'bench-low', 'bench-medium', 'bench-max'] as $pf) {
    $refP = jd_uuid4();
    $body = ['client_ref' => $refP, 'slot' => 'a', 'prompt' => $profPrompt . ' ' . ($pf ?? 'default'), 'website' => ''];
    if ($pf !== null) {
        $body['profile'] = $pf;
    }
    [$st, $j] = gen($body, true);
    $runsBy[$pf ?? 'default'] = [$st, $j['run_id'] ?? null];
}
$prof = [];
foreach ($runsBy as $k => [$st, $rid]) {
    $r = rows($db, 'SELECT profile, harness FROM jd2_runs WHERE id = ?', [(string) $rid])[0] ?? [];
    $pp = json_decode((string) one($db, "SELECT params FROM jd2_generations WHERE run_id = ? AND slot = 'a'", [(string) $rid]), true) ?: [];
    $prof[$k] = [$st, $r['profile'] ?? null, $r['harness'] ?? null, $pp['effort_profile'] ?? null,
                 $pp['max_tokens'] ?? $pp['max_completion_tokens'] ?? $pp['max_output_tokens'] ?? null];
}
check('no profile sent: the owner run is filed under bench-medium (v4-benchmed.1, 64000)',
      $prof['default'] === [200, 'bench-medium', 'v4-benchmed.1', 'bench-medium', 64000], json_encode($prof['default']));
check('bench-low / bench-medium / bench-max filed as sent, each with its own harness and the 64000 budget',
      $prof['bench-low'] === [200, 'bench-low', 'v4-benchlow.1', 'bench-low', 64000]
      && $prof['bench-medium'] === [200, 'bench-medium', 'v4-benchmed.1', 'bench-medium', 64000]
      && $prof['bench-max'] === [200, 'bench-max', 'v4-bench.4', 'bench-max', 64000], json_encode($prof));
$webParams = json_decode((string) one($db, "SELECT g.params FROM jd2_generations g JOIN jd2_runs r ON r.id = g.run_id WHERE r.profile = 'web' LIMIT 1"), true) ?: [];
check('a visitor turn stays on web: v4-web.3 and the 12000 budget (JD_MAX_TOKENS)',
      ($webParams['harness'] ?? '') === 'v4-web.3' && JD_MAX_TOKENS === 12000
      && ($webParams['max_tokens'] ?? $webParams['max_completion_tokens'] ?? $webParams['max_output_tokens'] ?? null) === 12000, json_encode($webParams));
foreach (['bench-ultra' => 'an unknown word', 'bench' . "\u{00A0}" => 'a near miss'] as $badP => $what) {
    [$st, $j] = gen(['client_ref' => jd_uuid4(), 'slot' => 'a', 'prompt' => 'x', 'profile' => $badP, 'website' => ''], true);
    check("an owner profile that is $what → 400, nothing filed", $st === 400 && ($j['error']['code'] ?? '') === 'bad_request'
          && str_contains($j['error']['message'] ?? '', 'bench-medium'), json_encode($j));
}
// a run filed before the split, under the retired `bench` (harness v4-bench.3)
$oldRun = jd_ulid();
$db->prepare("INSERT INTO jd2_runs (id, prompt_id, kind, requested_by, profile, harness, pool_version, deal, status, created)
              VALUES (?, ?, 'rerun', 'owner', 'bench', 'v4-bench.3', ?, ?, 'pending', ?)")
   ->execute([$oldRun, $promptO, jd2_pool_version($taxonomy), json_encode(jd2_deal(jd2_pool($taxonomy))), jd_now()]);
[$st, $j] = gen(['client_ref' => jd_uuid4(), 'slot' => 'a', 'rerun_of' => $promptO, 'run_id' => $oldRun, 'website' => ''], true);
check('a slot of a run under the retired `bench` profile is refused (409 retired_profile), nothing drawn',
      $st === 409 && ($j['error']['code'] ?? '') === 'retired_profile'
      && (int) one($db, 'SELECT COUNT(*) FROM jd2_generations WHERE run_id = ?', [$oldRun]) === 0, json_encode($j));

// ============================================================================
section('(l) the sanitizer\'s normalization: CDATA unwrapped and recorded; jd2-resanitize');
/** An owner turn of four slots on a new prompt; returns [responses by slot, run id]. */
function ownerTurn(string $prompt): array
{
    $ref = jd_uuid4();
    $out = [];
    $runId = null;
    foreach (['a', 'b', 'c', 'd'] as $slot) {
        $body = ['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt, 'website' => ''];
        if ($runId !== null) {
            $body['run_id'] = $runId;
        }
        $out[$slot] = gen($body, true);
        $runId ??= $out[$slot][1]['run_id'] ?? null;
    }
    return [$out, $runId];
}
[$tc, $runC] = ownerTurn('a tin lantern with a paper shade [cdata]');
$gensC = rows($db, 'SELECT * FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$runC]);
$cdataOk = count($gensC) === 4;
foreach ($gensC as $g) {
    $cdataOk = $cdataOk && $g['status'] === 'ok' && $g['normalized'] === 'cdata_unwrapped' && $g['reject_reason'] === null
        && str_contains((string) $g['raw_response'], '<![CDATA[') && !str_contains((string) $g['svg'], '<![CDATA[')
        && str_contains((string) $g['svg'], '<style> .jd-mock-cdata &gt; * { opacity: 1; } </style>')
        && ($tc[$g['slot']][1]['svg'] ?? null) === $g['svg'];
}
check('a drawing whose <style> wraps its CSS in CDATA files ok, normalized = cdata_unwrapped; svg (served) has no CDATA, raw_response keeps it',
      $cdataOk, json_encode(array_map(fn ($g) => [$g['slot'], $g['status'], $g['reject_reason'], $g['normalized']], $gensC)));
check('a drawing that passed byte-identical files normalized NULL',
      (int) one($db, "SELECT COUNT(*) FROM jd2_generations WHERE run_id = ? AND status = 'ok' AND normalized IS NULL", [$run1]) === 4);

// Seed the 2026-10-02 case: the CDATA run as the old rules filed it — every
// slot rejected element_not_allowed, no svg, the run failed. Usage, latency
// and cost stay as filed and must survive the recovery.
$before = rows($db, 'SELECT id, usage_json, latency_ms, cost_usd, priced, params, disobedience, created FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$runC]);
$db->prepare("UPDATE jd2_generations SET status = 'rejected', reject_reason = 'element_not_allowed', svg = NULL, normalized = NULL WHERE run_id = ?")->execute([$runC]);
$db->prepare("UPDATE jd2_runs SET status = 'failed' WHERE id = ?")->execute([$runC]);
// and a drawing that is rejected under the current rules too
[$th, $runH] = ownerTurn('a brass bell [hostile]');
check('a hostile drawing is still rejected (setup for the re-check)',
      (int) one($db, "SELECT COUNT(*) FROM jd2_generations WHERE run_id = ? AND status = 'rejected' AND reject_reason = 'element_not_allowed'", [$runH]) === 4
      && one($db, 'SELECT status FROM jd2_runs WHERE id = ?', [$runH]) === 'failed');

function resanitize(bool $dry): array
{
    global $root;
    $out = [];
    exec('JD_DEV_MOCK=1 ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/api/jd2-resanitize.php')
        . ($dry ? ' --dry-run' : '') . ' 2>&1', $out, $rc);
    return [$rc, implode("\n", $out)];
}
[$rc, $out] = resanitize(true);
check('jd2-resanitize --dry-run lists 8 rejected drawings: 4 would pass, 4 still rejected; writes nothing',
      $rc === 0 && str_contains($out, 'dry run done — 8 rejected drawing(s) checked: 4 would pass, 4 still rejected')
      && substr_count($out, 'element_not_allowed → ok (normalized: cdata_unwrapped)  [would apply]') === 4
      && substr_count($out, 'element_not_allowed → still rejected: element_not_allowed') === 4
      && str_contains($out, "run $runC  status failed → generated  [would apply]")
      && (int) one($db, "SELECT COUNT(*) FROM jd2_generations WHERE run_id = ? AND status = 'rejected'", [$runC]) === 4
      && one($db, 'SELECT status FROM jd2_runs WHERE id = ?', [$runC]) === 'failed', $out);
[$rc, $out] = resanitize(false);
$after = rows($db, 'SELECT id, usage_json, latency_ms, cost_usd, priced, params, disobedience, created FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$runC]);
$gensR = rows($db, 'SELECT * FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$runC]);
$recOk = count($gensR) === 4;
foreach ($gensR as $g) {
    $recOk = $recOk && $g['status'] === 'ok' && $g['reject_reason'] === null && $g['normalized'] === 'cdata_unwrapped'
        && $g['svg'] === $gensC[array_search($g['slot'], array_column($gensC, 'slot'), true)]['svg'];
}
check('applied: the 4 recovered rows are ok with the sanitized svg, normalized set, reject_reason cleared',
      $rc === 0 && $recOk && str_contains($out, 'done — 8 rejected drawing(s) checked: 4 recovered, 4 still rejected'), $out);
check('usage, latency, cost, priced, params, disobedience and created are untouched', $after === $before,
      json_encode([$before, $after]));
check('the run re-settles failed → generated; the still-rejected run stays failed',
      one($db, 'SELECT status FROM jd2_runs WHERE id = ?', [$runC]) === 'generated'
      && str_contains($out, "run $runC  status failed → generated")
      && one($db, 'SELECT status FROM jd2_runs WHERE id = ?', [$runH]) === 'failed'
      && (int) one($db, "SELECT COUNT(*) FROM jd2_generations WHERE run_id = ? AND status = 'rejected'", [$runH]) === 4, $out);
[$rc, $out] = resanitize(false);
check('idempotent: a second run recovers nothing', $rc === 0
      && str_contains($out, 'done — 4 rejected drawing(s) checked: 0 recovered, 4 still rejected'), $out);
[$st, $body] = (static function () use ($runC) {
    global $BASE;
    $ch = curl_init($BASE . '/api/jd2-resanitize.php?dry-run=1');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $b = curl_exec($ch);
    return [curl_getinfo($ch, CURLINFO_HTTP_CODE), (string) $b];
})();
check('over the web on a dev box it answers plain text (the key gate is production-only)',
      $st === 200 && str_contains($body, 'DRY RUN') && str_contains($body, 'dry run done'), $body);

printf("\n%d passed, %d failed\n", $passed, $failed);
if ($failed > 0) {
    echo "\n-- server log --\n" . @file_get_contents($serverLog);
}
exit($failed === 0 ? 0 : 1);

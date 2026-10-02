<?php
// The v2 owner-side READS end to end — jd2-queue, jd2-ledger, jd2-analytics,
// scripts/jd2-export.py and scripts/jd2-batch-run.php — against the SQLite dev
// database and the mock provider (PLAN-V2 §5, §11; db/junk-drawer-v2-schema.md
// "Endpoints").
//
//   php scripts/test-jd2-reads.php
//
// HERMETIC, in scripts/test-jd2-flow.php's pattern: JD_DEV_MOCK=1 for itself
// and the `php -S` it starts on a free 127.0.0.1 port; it refuses to run where
// JD_DEV_MODE cannot be true; it EMPTIES the jd2_* tables of
// local-dev/jd-dev.sqlite first (the v1 jd_* tables are not touched); the
// batch runner runs with --local (its own php -S, the same SQLite file) and a
// throwaway state file, never local-dev/jd2-batch-state.json. The bench key is
// whatever config/secrets.php holds (never printed); keyless when none.
//
// The fixture, filed through the endpoints:
//   P1  a visitor turn, rated complete by the visitor (ranking + gaps, so the
//       pairs are DERIVED); later an incomplete owner sitting on it
//   P2  the owner's prompt (bench profile), rated complete with DIRECT pairs;
//       then a rerun, first unrated, then an incomplete owner sitting, then
//       a complete one with direct pairs
//   P3  a visitor turn rated complete with SUPPRESS (hidden by the visitor)
//   P4  the owner's prompt, drawn and never rated (a draft)
//
// One PASS/FAIL line per check, grouped by case; exit 0 iff all pass.

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
        printf("FAIL  %s%s\n", $name, $detail === '' ? '' : "\n      " . substr($detail, 0, 1500));
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
$serverLog = tempnam(sys_get_temp_dir(), 'jd2-reads-');
$scratch = sys_get_temp_dir() . '/jd2-reads-' . getmypid();
@mkdir($scratch, 0775, true);
$server = proc_open(
    [PHP_BINARY, '-S', "127.0.0.1:$port", '-t', $root],
    [0 => ['file', '/dev/null', 'r'], 1 => ['file', $serverLog, 'a'], 2 => ['file', $serverLog, 'a']],
    $pipes,
    $root,
    array_merge(getenv(), ['JD_DEV_MOCK' => '1', 'JD_DEV_LATENCY_MS' => '1'])
);
register_shutdown_function(static function () use ($server, $serverLog, $scratch): void {
    proc_terminate($server);
    @unlink($serverLog);
    foreach (glob($scratch . '/*') ?: [] as $f) {
        @unlink($f);
    }
    @rmdir($scratch);
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

/** @return array{0:int,1:mixed,2:array<string,string>,3:string} */
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

function one(PDO $db, string $sql, array $args = []): mixed
{
    $q = $db->prepare($sql);
    $q->execute($args);
    return $q->fetchColumn();
}

function rows(PDO $db, string $sql, array $args = []): array
{
    $q = $db->prepare($sql);
    $q->execute($args);
    return $q->fetchAll(PDO::FETCH_ASSOC);
}

$taxonomy = jd_taxonomy();
$axisRanks = jd_axis_ranks($taxonomy);
$liveAxisIds = array_map('strval', array_keys(jd_live_axes($taxonomy)));

/** grade $grades[slot] and every live axis at rank $axisAt (null = the top) per slot. */
function cells(array $grades, array $axisRanks, ?int $axisAt = null): array
{
    $out = [];
    foreach ($grades as $slot => $g) {
        $out[] = ['slot' => $slot, 'kind' => 'grade', 'value' => $g];
        foreach ($axisRanks as $axis => $ranks) {
            $out[] = ['slot' => $slot, 'kind' => 'axis', 'axis_id' => $axis, 'value' => $axisAt ?? max($ranks)];
        }
    }
    return $out;
}

function visitorTurn(string $prompt): array
{
    $ref = jd_uuid4();
    $out = [];
    foreach (['a', 'b', 'c', 'd'] as $slot) {
        $out[$slot] = req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt,
            'client' => 'web', 'consent' => ['version' => JD_CONSENT_VERSION], 'device_ref' => jd_uuid4(), 'website' => '']);
    }
    // the client_ref too: a visitor files a sitting only with the turn's own
    return [$out['a'][1]['run_id'] ?? null, $out['a'][1]['prompt_id'] ?? null, $ref];
}

function ownerPrompt(string $prompt): array
{
    $ref = jd_uuid4();
    $out = [];
    foreach (['a', 'b', 'c', 'd'] as $slot) {
        $out[$slot] = req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => $slot, 'prompt' => $prompt,
            'website' => ''], true);
    }
    return [$out['a'][1]['run_id'] ?? null, $out['a'][1]['prompt_id'] ?? null];
}

function rate(array $body, bool $owner = false): array
{
    return req('POST', '/api/jd2-rate.php', $body + ['client' => 'web'], $owner);
}

function slotGens(PDO $db, string $runId): array
{
    $out = [];
    foreach (rows($db, 'SELECT id, slot, model_id FROM jd2_generations WHERE run_id = ? ORDER BY slot', [$runId]) as $g) {
        $out[$g['slot']] = $g;
    }
    return $out;
}

/** six direct pairs a>b>c>d by $s. */
function directPairs(int $ab, int $ac, int $ad, int $bc, int $bd, int $cd): array
{
    return [['slot_a' => 'a', 'slot_b' => 'b', 'score' => $ab, 'shown_left' => 'b'], ['slot_a' => 'a', 'slot_b' => 'c', 'score' => $ac],
            ['slot_a' => 'a', 'slot_b' => 'd', 'score' => $ad], ['slot_a' => 'b', 'slot_b' => 'c', 'score' => $bc],
            ['slot_a' => 'b', 'slot_b' => 'd', 'score' => $bd], ['slot_a' => 'c', 'slot_b' => 'd', 'score' => $cd]];
}

// ============================================================================
section('(fixture) four prompts filed through the endpoints');
[$run1, $p1, $ref1] = visitorTurn('a brass key with a paper tag');
[$st, $j] = req('POST', '/api/jd2-intake.php', ['client_ref' => $ref1, 'prompt' => 'a brass key with a paper tag']);
check('P1: the intake clerk (mock) files its heading, tier and headings', $st === 200 && empty($j['fallback'])
    && ($j['tags']['subject'] ?? null) === ['object'], json_encode($j));
[$st, $j] = rate(['run_id' => $run1, 'client_ref' => $ref1, 'title' => 'Brass Key', 'size' => 's',
    'ratings' => cells(['a' => 4, 'b' => 2, 'c' => 5, 'd' => 3], $axisRanks),
    'ranking' => [['slot' => 'c', 'rank' => 1, 'gap' => 2], ['slot' => 'a', 'rank' => 2, 'gap' => 1],
                  ['slot' => 'd', 'rank' => 3, 'gap' => 1], ['slot' => 'b', 'rank' => 4]]]);
check('P1: a visitor turn rated complete with derived pairs', $st === 200 && $j['complete'] === true, json_encode($j));

[$run2a, $p2] = ownerPrompt('a tin whistle on a lanyard');
[$st, $j] = rate(['run_id' => $run2a, 'ratings' => cells(['a' => 5, 'b' => 4, 'c' => 2, 'd' => 1], $axisRanks),
    'ranking' => [['slot' => 'a', 'rank' => 1], ['slot' => 'b', 'rank' => 2], ['slot' => 'c', 'rank' => 3], ['slot' => 'd', 'rank' => 4]],
    'pairs' => directPairs(2, 3, 3, 1, 2, 0)], true);
check('P2 run 1: the owner rates it complete with direct pairs', $st === 200 && $j['complete'] === true, json_encode($j));
[$st, $j] = req('POST', '/api/jd2-intake.php', ['prompt_id' => $p2], true);
$P2TAGS = ['subject' => ['object'], 'treatment' => [], 'probe' => ['state']];
[$st2, $j2] = req('POST', '/api/jd2-curate.php', ['prompt_id' => $p2, 'tags' => $P2TAGS], true);
check('P2: owner intake, then the owner re-files its headings through jd2-curate (probe: state)', $st === 200 && $st2 === 200
    && ($j2['prompt']['tags'] ?? null) === $P2TAGS, json_encode([$j, $j2['prompt']['tags'] ?? $j2]));
$ref = jd_uuid4();
[$st, $j] = req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => 'a', 'rerun_of' => $p2, 'website' => ''], true);
$run2b = $j['run_id'] ?? null;
foreach (['b', 'c', 'd'] as $slot) {
    req('POST', '/api/jd2-generate.php', ['client_ref' => $ref, 'slot' => $slot, 'rerun_of' => $p2, 'run_id' => $run2b, 'website' => ''], true);
}
check('P2 run 2: a rerun, settled, unrated', jd_is_ulid($run2b)
    && one($db, 'SELECT status FROM jd2_runs WHERE id = ?', [$run2b]) === 'generated');

[$run3, $p3, $ref3] = visitorTurn('a chipped enamel mug');
[$st, $j] = rate(['run_id' => $run3, 'client_ref' => $ref3, 'suppress' => true, 'ratings' => cells(['a' => 3, 'b' => 3, 'c' => 3, 'd' => 3], $axisRanks),
    'ranking' => [['slot' => 'a', 'rank' => 1, 'gap' => 0], ['slot' => 'b', 'rank' => 2, 'gap' => 0],
                  ['slot' => 'c', 'rank' => 3, 'gap' => 0], ['slot' => 'd', 'rank' => 4]]]);
check('P3: a visitor turn rated complete and suppressed (hidden by the visitor)', $st === 200
    && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$p3]) === 'hidden', json_encode($j));

[$run4, $p4] = ownerPrompt('a rubber band ball');
check('P4: the owner draws a prompt and leaves it unrated (draft)', jd_is_ulid($run4)
    && one($db, 'SELECT visibility FROM jd2_prompts WHERE id = ?', [$p4]) === 'draft');

// ============================================================================
section('(a) jd2-queue: the backlog');
[$st, $q] = req('GET', '/api/jd2-queue.php');
check('without the bench key it is refused', $st === 403 || jd_bench_key_expected() === null, (string) $st);
[$st, $q, $h] = req('GET', '/api/jd2-queue.php', null, true);
$ids = array_column($q['items'] ?? [], 'prompt_id');
check('200, no-store; the backlog is P4, P2 (its unrated rerun), P1 — newest first; not the hidden P3',
    $st === 200 && str_contains($h['cache-control'] ?? '', 'no-store') && $ids === [$p4, $p2, $p1], json_encode($ids));
foreach (['build', 'taxonomy_version', 'instrument_version', 'axes', 'grades', 'size_tiers', 'comparison', 'gaps', 'models', 'items', 'progress'] as $k) {
    if (!array_key_exists($k, $q)) {
        check("the payload has $k", false);
    }
}
check('the payload carries the rubric, the comparison and gaps scales and the instrument',
    count($q['axes']) === count($liveAxisIds) && $q['axes'][0]['values'][0]['rank'] >= $q['axes'][0]['values'][1]['rank']
    && $q['grades'][0]['rank'] === 5 && isset($q['comparison']['values'], $q['gaps']['values'])
    && $q['instrument_version'] === JD2_INSTRUMENT_VERSION && is_array($q['models']));
$byId = array_column($q['items'], null, 'prompt_id');
$i2 = $byId[$p2];
check('P2 points at the rerun (the newest run), 2 runs, needs "no owner sitting yet"',
    $i2['run_id'] === $run2b && $i2['runs'] === 2 && $i2['complete'] === false && $i2['needs'] === ['no owner sitting yet'],
    json_encode($i2));
$blind = true;
foreach ($q['items'] as $it) {
    foreach ($it['responses'] as $r) {
        $blind = $blind && !array_key_exists('model_id', $r) && str_starts_with($r['svg_url'], '/api/jd2-gen-svg.php?gen=');
    }
}
check('the bench is blind: no model_id anywhere, svg_url to jd2-gen-svg', $blind);
$keys = array_keys($byId[$p1]['responses'][0]);
check('a response has generation_id, slot, svg_url, hidden, prefill, visitor (in that order)',
    $keys === ['generation_id', 'slot', 'svg_url', 'hidden', 'prefill', 'visitor'], json_encode($keys));
$r1 = $byId[$p1]['responses'];
$s1 = slotGens($db, $run1);
check("P1's responses carry the visitor's sitting (grade, axes, rank) and no owner prefill",
    $r1[2]['slot'] === 'c' && (float) $r1[2]['visitor']['grade'] === 5.0 && $r1[2]['visitor']['rank_pos'] === 1
    && count((array) $r1[2]['visitor']['axes']) === count($liveAxisIds) && $r1[2]['prefill'] === null, json_encode($r1[2]));
[$st, $qr] = req('GET', '/api/jd2-queue.php?reveal=1&prompt=' . $p1, null, true);
check('?reveal=1 adds model_id, the model the deal seated', $st === 200
    && ($qr['items'][0]['responses'][0]['model_id'] ?? null) === $s1['a']['model_id']);
[$st, $qa] = req('GET', '/api/jd2-queue.php?all=1', null, true);
check('?all=1 lists every prompt, the hidden one too', $st === 200 && count($qa['items']) === 4
    && in_array($p3, array_column($qa['items'], 'prompt_id'), true));
check('progress counts the campaign (not hidden, settled): 3 prompts, 0 complete, cells 0 of 3×4×' . (1 + count($liveAxisIds)),
    $q['progress']['prompts'] === 3 && $q['progress']['complete'] === 0 && $q['progress']['cells_filed'] === 0
    && $q['progress']['cells_total'] === 3 * 4 * (1 + count($liveAxisIds)), json_encode($q['progress']));
[$st, $c] = req('GET', '/api/jd2-queue.php?count=1', null, true);
check('?count=1: today\'s generations against the breaker', $st === 200 && $c['today']['generations'] === 20
    && $c['today']['limit'] === JD_LIMIT_GLOBAL_DAILY && $c['today']['remaining'] === JD_LIMIT_GLOBAL_DAILY - 20, json_encode($c));

// an incomplete owner sitting on the rerun: grades only
[$st, $j] = rate(['run_id' => $run2b, 'ratings' => array_map(fn ($s) => ['slot' => $s, 'kind' => 'grade', 'value' => 3], ['a', 'b', 'c', 'd'])], true);
[, $q] = req('GET', '/api/jd2-queue.php?prompt=' . $p2, null, true);
$i2 = $q['items'][0];
check('after an incomplete owner sitting: still open, prefill holds the grades, needs name what is missing',
    $st === 200 && $j['complete'] === false && $i2['complete'] === false && (float) $i2['responses'][0]['prefill']['grade'] === 3.0
    && in_array('axes unanswered: a (' . count($liveAxisIds) . ' of ' . count($liveAxisIds) . '), b (' . count($liveAxisIds) . ' of '
        . count($liveAxisIds) . '), c (' . count($liveAxisIds) . ' of ' . count($liveAxisIds) . '), d (' . count($liveAxisIds) . ' of '
        . count($liveAxisIds) . ')', $i2['needs'], true)
    && in_array('ranked: 0 of 4', $i2['needs'], true) && in_array('pairs scored: 0 of 6', $i2['needs'], true), json_encode($i2['needs']));
// …then the owner completes the rerun with direct pairs
[$st, $j] = rate(['run_id' => $run2b, 'ratings' => cells(['a' => 2, 'b' => 3, 'c' => 4, 'd' => 5], $axisRanks, 1),
    'ranking' => [['slot' => 'd', 'rank' => 1, 'gap' => 1], ['slot' => 'c', 'rank' => 2, 'gap' => 1],
                  ['slot' => 'b', 'rank' => 3, 'gap' => 1], ['slot' => 'a', 'rank' => 4]],
    'pairs' => directPairs(-1, -2, -3, -1, -2, -1)], true);
check('the owner completes the rerun (direct pairs)', $st === 200 && $j['complete'] === true, json_encode($j));
[, $q] = req('GET', '/api/jd2-queue.php', null, true);
check('the closed P2 leaves the backlog: P4, P1', array_column($q['items'], 'prompt_id') === [$p4, $p1],
    json_encode(array_column($q['items'], 'prompt_id')));
[$st, $q] = req('GET', '/api/jd2-queue.php?prompt=' . $p2, null, true);
$i2 = $q['items'][0] ?? [];
$s2b = slotGens($db, $run2b);
$pp = [];
foreach ($i2['pairs_prefill'] ?? [] as $x) {
    $pp[$x['slot_a'] . $x['slot_b']] = [$x['score'], $x['source']];
}
check('?prompt= returns the closed P2: complete, prefill from the latest owner sitting (grade, axes, place, gap)',
    $st === 200 && $i2['complete'] === true && $i2['needs'] === [] && $i2['responses'][3]['slot'] === 'd'
    && (float) $i2['responses'][3]['prefill']['grade'] === 5.0 && $i2['responses'][3]['prefill']['rank_pos'] === 1
    && $i2['responses'][3]['prefill']['gap_after'] === 1 && $i2['responses'][0]['prefill']['gap_after'] === null
    && array_map('floatval', array_values((array) $i2['responses'][0]['prefill']['axes'])) === array_fill(0, count($liveAxisIds), 1.0), json_encode($i2));
check('pairs_prefill: six by slot, direct, signed for slot_a', count($pp) === 6 && $pp['ab'] === [-1, 'direct'] && $pp['ad'] === [-3, 'direct'],
    json_encode($pp));
[$st] = req('GET', '/api/jd2-queue.php?prompt=' . jd_ulid(), null, true);
check('?prompt= for an unknown id is 404', $st === 404);

// an incomplete owner sitting on P1 (grades only): the visitor's sitting still stands for display
[$st, $j] = rate(['run_id' => $run1, 'ratings' => array_map(fn ($s) => ['slot' => $s, 'kind' => 'grade', 'value' => 1], ['a', 'b', 'c', 'd'])], true);
check('P1: an incomplete owner sitting files', $st === 200 && $j['complete'] === false);

// ============================================================================
section('(b) jd2-ledger: one row per prompt, runs, sessions, drawer and bench');
[$st, $L, $h] = req('GET', '/api/jd2-ledger.php', null, true);
check('200, no-store, counts {prompts 4, live 2, hidden 1, draft 1, bench_open 2}', $st === 200
    && str_contains($h['cache-control'] ?? '', 'no-store')
    && $L['counts'] === ['prompts' => 4, 'live' => 2, 'hidden' => 1, 'draft' => 1, 'bench_open' => 2], json_encode($L['counts'] ?? $L));
$Lb = array_column($L['items'], null, 'prompt_id');
check('newest first: P4, P3, P2, P1', array_column($L['items'], 'prompt_id') === [$p4, $p3, $p2, $p1]);
$need = ['prompt_id', 'title', 'prompt', 'created', 'origin', 'visibility', 'hidden_by', 'approved_at', 'size_class', 'size_scale',
         'shown_run_id', 'pinned_generation_id', 'v1_item_id', 'device_ref', 'drawer', 'bench', 'runs'];
check('an item carries every field the page reads', array_diff($need, array_keys($Lb[$p1])) === [], json_encode(array_keys($Lb[$p1])));
check('P1: shown (the visitor\'s sitting stands), shows 1st place c, bench open with the owner\'s needs',
    $Lb[$p1]['drawer']['state'] === 'shown' && $Lb[$p1]['drawer']['shows'] === $s1['c']['id']
    && str_starts_with($Lb[$p1]['drawer']['rule'], 'first place') && $Lb[$p1]['bench']['state'] === 'open'
    && in_array('ranked: 0 of 4', $Lb[$p1]['bench']['needs'], true), json_encode([$Lb[$p1]['drawer'], $Lb[$p1]['bench']]));
$runs1 = $Lb[$p1]['runs'][0];
check("P1's run: two sessions in filing order — the visitor's (complete, current) then the owner's (incomplete, current)",
    count($runs1['sessions']) === 2 && $runs1['sessions'][0]['rater_role'] === 'visitor' && $runs1['sessions'][0]['complete'] === true
    && $runs1['sessions'][0]['current'] === true && $runs1['sessions'][1]['rater_role'] === 'owner'
    && $runs1['sessions'][1]['complete'] === false && $runs1['sessions'][1]['current'] === true
    && $runs1['display']['rater_role'] === 'visitor' && $runs1['display']['complete'] === true, json_encode($runs1['sessions']));
check("P1's display: grades and axes by generation, ranks, six derived pairs with slots",
    (float) $runs1['display']['grades'][$s1['c']['id']] === 5.0 && $runs1['display']['ranks'][$s1['c']['id']] === 1
    && count((array) $runs1['display']['axes'][$s1['a']['id']]) === count($liveAxisIds)
    && count($runs1['display']['pairs']) === 6 && $runs1['display']['pairs'][0]['source'] === 'derived'
    && $runs1['display']['pairs'][0]['slot_a'] !== null, json_encode($runs1['display']));
$g0 = $runs1['generations'][0];
check('a generation: id, slot, model, api_model, status, hidden, cost_usd snapshot, latency',
    array_diff(['generation_id', 'slot', 'model_id', 'api_model', 'status', 'reject_reason', 'hidden', 'cost_usd', 'latency_ms'], array_keys($g0)) === []
    && $g0['cost_usd'] !== null && $g0['model_id'] === $s1['a']['model_id'], json_encode($g0));
$L2 = $Lb[$p2];
check('P2: shown from its newest complete run (the rerun), shows its 1st place d; bench done',
    $L2['drawer']['state'] === 'shown' && $L2['drawer']['run_id'] === $run2b && $L2['drawer']['shows'] === $s2b['d']['id']
    && $L2['bench']['state'] === 'done' && $L2['bench']['needs'] === [], json_encode([$L2['drawer'], $L2['bench']]));
check("P2: two runs, newest first; the rerun's history keeps both owner sessions (incomplete → superseded, complete → current)",
    count($L2['runs']) === 2 && $L2['runs'][0]['run_id'] === $run2b && $L2['runs'][0]['kind'] === 'rerun'
    && $L2['runs'][0]['profile'] === 'bench' && count($L2['runs'][0]['sessions']) === 2
    && $L2['runs'][0]['sessions'][0]['current'] === false && $L2['runs'][0]['sessions'][0]['complete'] === false
    && $L2['runs'][0]['sessions'][1]['current'] === true && $L2['runs'][0]['sessions'][1]['complete'] === true
    && $L2['runs'][0]['display']['pairs'][0]['source'] === 'direct', json_encode($L2['runs'][0]['sessions']));
check('P3: hidden by the visitor; bench off, saying so', $Lb[$p3]['drawer']['state'] === 'hidden'
    && $Lb[$p3]['hidden_by'] === 'visitor' && str_contains($Lb[$p3]['drawer']['why'], 'visitor')
    && $Lb[$p3]['bench']['state'] === 'off' && str_starts_with($Lb[$p3]['bench']['needs'][0], 'hidden'), json_encode($Lb[$p3]['bench']));
check('P4: draft, bench open ("no owner sitting yet"), no display', $Lb[$p4]['drawer']['state'] === 'draft'
    && $Lb[$p4]['bench']['state'] === 'open' && $Lb[$p4]['bench']['needs'] === ['no owner sitting yet']
    && $Lb[$p4]['runs'][0]['display'] === null);
[$st, $one] = req('GET', '/api/jd2-ledger.php?prompt=' . $p2, null, true);
check('?prompt= answers that one prompt', $st === 200 && count($one['items']) === 1 && $one['items'][0]['prompt_id'] === $p2);
// the pin and a hidden drawing move the drawer's choice
req('POST', '/api/jd2-curate.php', ['prompt_id' => $p2, 'pinned_generation_id' => $s2b['b']['id']], true);
[, $one] = req('GET', '/api/jd2-ledger.php?prompt=' . $p2, null, true);
check('a pin re-points `shows`, rule "pinned by the owner"', $one['items'][0]['drawer']['shows'] === $s2b['b']['id']
    && str_starts_with($one['items'][0]['drawer']['rule'], 'pinned'));
req('POST', '/api/jd2-curate.php', ['prompt_id' => $p2, 'pinned_generation_id' => null], true);

// A keyed owner session carrying the display standing (grades, axes, the
// ranking with its gaps → pairs re-derived) with one cell edited — the shape
// ledger.html's SAVE builds. Here on P1, whose standing is the visitor's: the
// SERVER files any keyed owner sitting, but ledger.html and the drawer's admin
// card no longer build this one (they refuse on a visitor's standing and send
// the owner to the bench); this stands in for the owner's own sitting so the
// analytics fixture below keeps an owner session on P1.
$disp = $runs1['display'];
$slotOfGen = array_column($runs1['generations'], 'slot', 'generation_id');
$ratings = [];
$ranking = [];
foreach ($slotOfGen as $gid => $slot) {
    $ratings[] = ['slot' => $slot, 'kind' => 'grade', 'value' => $gid === $s1['b']['id'] ? 1 : $disp['grades'][$gid]];
    foreach ((array) $disp['axes'][$gid] as $axis => $v) {
        $ratings[] = ['slot' => $slot, 'kind' => 'axis', 'axis_id' => $axis, 'value' => $v];
    }
    $ranking[] = ['slot' => $slot, 'rank' => $disp['ranks'][$gid], 'gap' => $disp['gaps'][$gid]];
}
[$st, $j] = rate(['run_id' => $run1, 'blind' => false, 'ratings' => $ratings, 'ranking' => $ranking, 'pairs' => null], true);
[, $one] = req('GET', '/api/jd2-ledger.php?prompt=' . $p1, null, true);
$r1L = $one['items'][0]['runs'][0];
check("a keyed owner sitting files a third, complete session over the visitor's standing; it now stands for display (one edit)",
    $st === 200 && $j['complete'] === true && count($r1L['sessions']) === 3 && $r1L['display']['rater_role'] === 'owner'
    && (float) $r1L['display']['grades'][$s1['b']['id']] === 1.0 && (float) $r1L['display']['grades'][$s1['c']['id']] === 5.0
    && $one['items'][0]['bench']['state'] === 'done', json_encode([$j, $r1L['display']['grades']]));

// ============================================================================
section('(c) jd2-analytics: the v1 shapes the about page reads, plus pairs and margins');
[$st, $A, $h] = req('GET', '/api/jd2-analytics.php');
check('public: 200 without a key, Cache-Control no-cache', $st === 200 && ($h['cache-control'] ?? '') === 'no-cache', $st . ' ' . json_encode($h));
[$st304, , $h304, $raw304] = req('GET', '/api/jd2-analytics.php', null, false, ['If-None-Match: ' . ($h['etag'] ?? '')]);
[, , $hOwner] = req('GET', '/api/jd2-analytics.php?origin=owner');
check('an ETag; an unchanged answer revalidates (304, no body, still no-cache); ?origin= has its own tag',
    preg_match('/^"[0-9a-f]{32}"$/', $h['etag'] ?? '') === 1 && $st304 === 304 && $raw304 === ''
    && ($h304['cache-control'] ?? '') === 'no-cache' && ($hOwner['etag'] ?? '') !== ($h['etag'] ?? ''), $st304 . ' ' . json_encode($h304));
check('the v1 top-level keys are all there', array_diff(['totals', 'models', 'cost', 'firsts', 'grades', 'axes', 'spend', 'turns'], array_keys($A)) === [],
    json_encode(array_keys($A)));
check('totals: {turns, drawings, survived, rated_responses, cost_usd}', array_keys($A['totals']) === ['turns', 'drawings', 'survived', 'rated_responses', 'cost_usd']
    && $A['totals']['turns'] === 3 && $A['totals']['drawings'] === 12 && $A['totals']['survived'] === 12 && $A['totals']['rated_responses'] === 12,
    json_encode($A['totals']));
check('models[]: exactly {model_id, label, vendor}, the four pool models', count($A['models']) === 4
    && array_keys($A['models'][0]) === ['model_id', 'label', 'vendor']);
$gradeKeysOk = $A['grades'] !== [];
$gradeN = 0;
foreach ($A['grades'] as $g) {
    $gradeKeysOk = $gradeKeysOk && array_keys($g) === ['model_id', 'avg', 'n', 'hist'] && array_sum((array) $g['hist']) === $g['n'];
    $gradeN += $g['n'];
}
check('grades[]: exactly {model_id, avg, n, hist}, hist sums to n, 3 runs × 4 = 12 grades (one rater per drawing)',
    $gradeKeysOk && $gradeN === 12, json_encode($A['grades']));
$axesOk = count($A['axes']) === count($liveAxisIds);
foreach ($A['axes'] as $ax) {
    $axesOk = $axesOk && array_keys($ax) === ['axis_id', 'label', 'points', 'models'] && in_array($ax['axis_id'], $liveAxisIds, true);
    foreach ($ax['models'] as $m) {
        $axesOk = $axesOk && array_keys($m) === ['model_id', 'avg', 'n', 'hist'] && array_sum((array) $m['hist']) === $m['n'];
    }
}
check('axes[]: exactly {axis_id, label, points, models[{model_id, avg, n, hist}]}, live axes only', $axesOk, json_encode($A['axes'][0]));
$costOk = count($A['cost']) === 4;
foreach ($A['cost'] as $c) {
    $costOk = $costOk && array_keys($c) === ['model_id', 'avg_usd', 'n'] && $c['n'] === 3 && $c['avg_usd'] > 0;
}
check('cost[]: exactly {model_id, avg_usd, n} from the cost_usd snapshots (3 surviving drawings each)', $costOk, json_encode($A['cost']));
$firstSum = array_sum(array_column($A['firsts'], 'firsts'));
check('firsts[]: {model_id, firsts, judged, rate}; three contests, one first place each',
    array_keys($A['firsts'][0]) === ['model_id', 'firsts', 'judged', 'rate'] && $firstSum === 3
    && array_sum(array_column($A['firsts'], 'judged')) === 12, json_encode($A['firsts']));
// the owner's word stands on P1 now (the ledger SAVE): slot b's model has the owner's 1, not the visitor's 2
$bModel = $s1['b']['model_id'];
$allSpend = (float) one($db, 'SELECT SUM(cost_usd) FROM jd2_generations');
check('spend: every priced drawing (the hidden P3 and the draft P4 too); last cum_usd = totals.cost_usd',
    abs(end($A['spend'])['cum_usd'] - $A['totals']['cost_usd']) < 1e-9 && abs($A['totals']['cost_usd'] - round($allSpend, 6)) < 1e-6,
    json_encode([$A['totals']['cost_usd'], $allSpend]));
check('turns: one row per live prompt (P2 from its rerun, P1), with grades by model',
    count($A['turns']) === 2 && in_array($run2b, array_column($A['turns'], 'run_id'), true)
    && array_keys($A['turns'][0]) === ['date', 'prompt', 'grades', 'prompt_id', 'run_id', 'origin'], json_encode($A['turns']));
$t1 = array_values(array_filter($A['turns'], fn ($t) => $t['prompt_id'] === $p1))[0] ?? [];
check("P1's turn row reads the owner's complete sitting (owner over visitor), never an average",
    (float) ($t1['grades'][$bModel] ?? -1) === 1.0, json_encode($t1));

$P = $A['pairs'];
check('pairs: {models, matrix, wins, bt}', array_keys($P) === ['models', 'matrix', 'wins', 'bt'] && count($P['models']) === 4);
$anti = count($P['matrix']) === 4;
$nTotal = 0;
for ($i = 0; $i < 4; $i++) {
    for ($k = 0; $k < 4; $k++) {
        [$m, $n] = $P['matrix'][$i][$k];
        [$m2, $n2] = $P['matrix'][$k][$i];
        if ($i === $k) {
            $anti = $anti && $m === null && $n === 0;
            continue;
        }
        $anti = $anti && $n === $n2 && ($m === null ? $m2 === null : abs($m + $m2) < 1e-9);
        $nTotal += $n;
    }
}
check('pairs.matrix is antisymmetric (mean_ij = −mean_ji, n_ij = n_ji, diagonal [null, 0]); 18 pairs', $anti && $nTotal === 36,
    json_encode($P['matrix']));
$score = [];
foreach ($P['wins'] as $w) {
    $score[$w['model_id']] = $w['wins'] + 0.5 * $w['ties'];
}
$bt = array_column($P['bt'], 'strength', 'model_id');
$agree = count($bt) === 4 && abs(array_sum($bt)) < 1e-3;
foreach ($score as $a => $sa) {
    foreach ($score as $b => $sb) {
        if ($sa > $sb) {
            $agree = $agree && $bt[$a] > $bt[$b];
        } elseif ($sa == $sb) {
            $agree = $agree && abs($bt[$a] - $bt[$b]) < 1e-3;
        }
    }
}
check('bt: strengths order agrees with wins (ties half), mean log-strength 0', $agree, json_encode([$score, $bt]));
check('wins: {model_id, wins, losses, ties}; wins = losses overall', array_keys($P['wins'][0]) === ['model_id', 'wins', 'losses', 'ties']
    && array_sum(array_column($P['wins'], 'wins')) === array_sum(array_column($P['wins'], 'losses')));
$margOk = count($A['margins']) === 6;
$mn = 0;
foreach ($A['margins'] as $mg) {
    $margOk = $margOk && array_keys($mg) === ['model_a', 'model_b', 'mean', 'n', 'hist']
        && array_keys($mg['hist']) === [-3, -2, -1, 0, 1, 2, 3] && array_sum($mg['hist']) === $mg['n'];
    $mn += $mg['n'];
    $ia = array_search($mg['model_a'], $P['models'], true);
    $ib = array_search($mg['model_b'], $P['models'], true);
    $margOk = $margOk && $ia < $ib && abs($P['matrix'][$ia][$ib][0] - $mg['mean']) < 1e-9;
}
check('margins: six model pairs, hist "-3".."3" sums to n, mean = the matrix cell', $margOk && $mn === 18, json_encode($A['margins']));
[$st, $Av] = req('GET', '/api/jd2-analytics.php?origin=visitor');
[$st2, $Ao] = req('GET', '/api/jd2-analytics.php?origin=owner');
check('?origin=visitor keeps P1 only (4 grades); ?origin=owner keeps P2 (8 grades, 2 runs)',
    $st === 200 && array_sum(array_column($Av['grades'], 'n')) === 4 && $Av['totals']['turns'] === 1
    && $st2 === 200 && array_sum(array_column($Ao['grades'], 'n')) === 8 && $Ao['totals']['turns'] === 2);
check('?origin=bogus is 400', req('GET', '/api/jd2-analytics.php?origin=bogus')[0] === 400);
$src = (string) file_get_contents($root . '/api/jd2-analytics.php');
$hard = false;
foreach (array_keys(jd_model_registry($taxonomy)) as $id) {
    $hard = $hard || str_contains($src, "'" . $id . "'") || str_contains($src, '"' . $id . '"');
}
check('nothing in jd2-analytics.php names a model, and no v1 table is read', !$hard && !preg_match('/\bjd_(submissions|generations|ratings|ranks|comparisons)\b/', $src));

// ============================================================================
section('(d) scripts/jd2-export.py from the SQLite file');
$jsonl = "$scratch/v2.jsonl";
$standingCsv = "$scratch/standing.csv";
$pairsCsv = "$scratch/pairs.csv";
exec('python3 ' . escapeshellarg($root . '/scripts/jd2-export.py') . ' --sqlite ' . escapeshellarg($root . '/local-dev/jd-dev.sqlite')
    . ' --out ' . escapeshellarg($jsonl) . ' --standing ' . escapeshellarg($standingCsv) . ' --pairs ' . escapeshellarg($pairsCsv) . ' 2>&1', $out, $rc);
$lines = is_file($jsonl) ? file($jsonl, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) : [];
$recs = array_map(fn ($l) => json_decode($l, true), $lines);
$valid = count($recs) === 4 && !in_array(null, $recs, true);
check('exit 0; JSONL: four lines, each valid JSON, one per prompt', $rc === 0 && $valid, implode("\n", $out));
$rec2 = array_values(array_filter($recs, fn ($r) => ($r['prompt']['id'] ?? '') === $p2))[0] ?? [];
check('a prompt record: its runs, generations (no svg by default), every session with judgments, rankings, pairs',
    count($rec2['runs'] ?? []) === 2 && count($rec2['runs'][1]['sessions']) === 2 && isset($rec2['runs'][0]['generations'][0]['svg_bytes'])
    && !isset($rec2['runs'][0]['generations'][0]['svg']) && count($rec2['runs'][1]['sessions'][1]['pairs']) === 6
    && count($rec2['runs'][1]['sessions'][1]['rankings']) === 4 && $rec2['runs'][1]['display_session_id'] === $rec2['runs'][1]['sessions'][1]['id'],
    json_encode(array_keys($rec2)));
// the display sessions as the PHP readers compute them, to check the CSVs against
$expPairs = 0;
$expDisplay = [];
foreach (rows($db, 'SELECT id FROM jd2_runs') as $r) {
    $counting = array_column(jd2_run_generations($db, $r['id']), 'id');
    $d = jd2_display_session($db, $r['id'], $counting, $taxonomy);
    $expDisplay[$r['id']] = $d['session']['id'] ?? null;
    $expPairs += $d === null ? 0 : count($d['standing']['pairs']);
}
$sc = array_map(fn ($l) => str_getcsv($l, ',', '"', ''), file($standingCsv, FILE_IGNORE_NEW_LINES));
$head = array_shift($sc);
$pc = array_map(fn ($l) => str_getcsv($l, ',', '"', ''), file($pairsCsv, FILE_IGNORE_NEW_LINES));
$phead = array_shift($pc);
$sameDisplay = true;
foreach ($recs as $rec) {
    foreach ($rec['runs'] as $run) {
        $sameDisplay = $sameDisplay && array_key_exists($run['id'], $expDisplay) && $expDisplay[$run['id']] === $run['display_session_id'];
    }
}
check('the export picks the same display session per run as jd2_display_session', $sameDisplay);
$pr2 = $rec2['prompt'] ?? [];
check('the export carries the intake facts on the prompt: tags, size_by, intake_version/model/json/cost/at',
    ($pr2['tags'] ?? null) === $P2TAGS && ($pr2['size_by'] ?? '') === 'model' && ($pr2['intake_version'] ?? '') === jd2_intake_version($taxonomy)
    && ($pr2['intake_model'] ?? '') === 'mock' && isset($pr2['intake_json']['answer']['reasons']) && array_key_exists('intake_cost_usd', $pr2)
    && !empty($pr2['intake_at']), json_encode(array_intersect_key($pr2, array_flip(['tags', 'size_by', 'intake_version', 'intake_model', 'intake_at']))));
check('standing CSV: one row per generation (20), grade + every live axis + rank columns',
    count($sc) === (int) one($db, 'SELECT COUNT(*) FROM jd2_generations') && in_array('grade', $head, true)
    && array_diff($liveAxisIds, $head) === [] && in_array('rank_pos', $head, true), json_encode($head));
$ixT = array_search('tags_probe', $head, true);
$ixP = array_search('prompt_id', $head, true);
$p2rows = array_values(array_filter($sc, fn ($r) => ($r[$ixP] ?? '') === $p2));
check('standing CSV: size_class, size_by and a tags_<facet> column per facet (P2: tags_probe = state)',
    in_array('size_class', $head, true) && in_array('size_by', $head, true) && in_array('tags_subject', $head, true)
    && in_array('tags_treatment', $head, true) && $ixT !== false && $p2rows !== [] && $p2rows[0][$ixT] === 'state', json_encode($head));
check("pairs CSV: one row per pair of every run's display session ($expPairs), with both models",
    count($pc) === $expPairs && in_array('model_a', $phead, true) && in_array('score', $phead, true));

// ============================================================================
section('(e) scripts/jd2-batch-run.php --local: the CSV runner on the mock provider');
$legacy = null;
foreach (glob($root . '/art/junk-drawer/legacy/items/*/entry.json') as $f) {
    $e = json_decode((string) file_get_contents($f), true);
    if (is_array($e) && mb_strlen(trim((string) ($e['prompt'] ?? ''))) <= JD_PROMPT_MAX_CHARS && !str_contains((string) $e['prompt'], "\n")) {
        $legacy = $e;
        break;
    }
}
$csv = "$scratch/prompts.csv";
$fh = fopen($csv, 'w');
fputcsv($fh, ['prompt', 'title', 'size', 'category', 'v1_item_id', 'rerun_of'], ',', '"', '');
fputcsv($fh, ['a wind-up tin robot', 'Tin Robot', 'm', 'toys', '2026-07-26-button', ''], ',', '"', '');
fputcsv($fh, [$legacy['prompt'], '', 'xs', '', '', ''], ',', '"', '');
fputcsv($fh, ['a rubber band ball (rerun)', '', '', '', '', $p4], ',', '"', '');
fclose($fh);
$state = "$scratch/state.json";
function batch(string $args): array
{
    global $root;
    $out = [];
    exec('JD_BENCH_KEY= ' . escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($root . '/scripts/jd2-batch-run.php') . ' ' . $args . ' 2>&1', $out, $rc);
    return [$rc, implode("\n", $out)];
}
$before = (int) one($db, 'SELECT COUNT(*) FROM jd2_generations');
[$rc, $o] = batch(escapeshellarg($csv) . ' --local --dry-run --state ' . escapeshellarg($state));
check('--dry-run: 3 rows, 12 requests (3 × a pool of 4), lineage matched by text, nothing drawn',
    $rc === 0 && str_contains($o, '3 row(s) to draw, 0 already done · 12 request(s)') && str_contains($o, 'v1 ' . $legacy['id'] . ' (matched by text)')
    && str_contains($o, 'dry run: nothing drawn') && (int) one($db, 'SELECT COUNT(*) FROM jd2_generations') === $before
    && !str_contains($o, $BENCH_KEY === 'keyless-dev-checkout' ? "\x00" : $BENCH_KEY), $o);
[$rc, $o] = batch(escapeshellarg($csv) . ' --local --rate-url --state ' . escapeshellarg($state));
$new = rows($db, "SELECT id, text, title, size_class, category, v1_item_id, origin FROM jd2_prompts WHERE text IN (?, ?) ORDER BY created", ['a wind-up tin robot', $legacy['prompt']]);
$robot = $new[0] ?? [];
$okLines = preg_match_all('/^\s+#\d+\s+[a-d]\s+\S+\s+ok\s/m', $o);
check('the run: exit 0, twelve "ok" lines with model and cost, a running total, the bench URLs',
    $rc === 0 && $okLines === 12 && str_contains($o, 'total $') && str_contains($o, 'index.php?bench&prompt='), $o);
check('two new owner prompts, each one run under the bench profile with four ok drawings',
    count($new) === 2 && $robot['origin'] === 'owner'
    && (int) one($db, "SELECT COUNT(*) FROM jd2_runs r WHERE r.prompt_id IN (?, ?) AND r.profile = 'bench' AND r.requested_by = 'owner'", [$new[0]['id'], $new[1]['id']]) === 2
    && (int) one($db, "SELECT COUNT(*) FROM jd2_generations g JOIN jd2_runs r ON r.id = g.run_id WHERE r.prompt_id IN (?, ?) AND g.status = 'ok'", [$new[0]['id'], $new[1]['id']]) === 8,
    json_encode($new));
check('v1_item_id recorded: the CSV column, and the legacy match by text', $robot['v1_item_id'] === '2026-07-26-button'
    && ($new[1]['v1_item_id'] ?? null) === $legacy['id'], json_encode($new));
check('title, size and category filed through jd2-curate', $robot['title'] === 'Tin Robot' && $robot['size_class'] === 'm'
    && $robot['category'] === 'toys' && $new[1]['size_class'] === 'xs' && $new[1]['category'] === null, json_encode($new));
$ri = rows($db, 'SELECT text, title, size_class, size_by, tags, intake_at FROM jd2_prompts WHERE text IN (?, ?) ORDER BY created',
    ['a wind-up tin robot', $legacy['prompt']]);
check('the batch: no intake when the CSV gave title AND size (the robot); the owner\'s title and size stand',
    isset($ri[0]) && $ri[0]['intake_at'] === null && $ri[0]['tags'] === null && $ri[0]['size_by'] === 'owner', json_encode($ri[0] ?? null));
check('the batch: intake after the first drawing when the CSV left the title open — the clerk\'s heading and headings, the CSV\'s size (owner)',
    ($ri[1]['intake_at'] ?? null) !== null && $ri[1]['tags'] !== null && $ri[1]['size_class'] === 'xs' && $ri[1]['size_by'] === 'owner'
    && $ri[1]['title'] !== null && preg_match('/^\s+#2\s+intake: ".+" · size \S+ \((model|owner)\) · subject: object/m', $o) === 1
    && substr_count($o, 'intake:') === 1, json_encode($ri[1] ?? null) . "\n" . $o);
check('the rerun row made a second run of P4 (rerun, bench), four drawings',
    (int) one($db, "SELECT COUNT(*) FROM jd2_runs WHERE prompt_id = ? AND kind = 'rerun' AND profile = 'bench'", [$p4]) === 1
    && (int) one($db, "SELECT COUNT(*) FROM jd2_generations g JOIN jd2_runs r ON r.id = g.run_id WHERE r.prompt_id = ? AND r.kind = 'rerun'", [$p4]) === 4);
$after = (int) one($db, 'SELECT COUNT(*) FROM jd2_generations');
[$rc, $o] = batch(escapeshellarg($csv) . ' --local --resume --state ' . escapeshellarg($state));
check('--resume with everything done: 0 rows, 0 requests, nothing drawn', $rc === 0
    && str_contains($o, '0 row(s) to draw, 3 already done · 0 request(s)') && (int) one($db, 'SELECT COUNT(*) FROM jd2_generations') === $after, $o);
// a stop mid-row: forget slots c and d of the robot and of the rerun, as if the runner died
$S = json_decode((string) file_get_contents($state), true);
$sb = array_key_first($S['bases']);
unset($S['bases'][$sb]['a wind-up tin robot']['slots']['c'], $S['bases'][$sb]['a wind-up tin robot']['slots']['d']);
unset($S['bases'][$sb]['a rubber band ball (rerun)']['slots']['d']);
file_put_contents($state, json_encode($S));
[$rc, $o] = batch(escapeshellarg($csv) . ' --local --resume --state ' . escapeshellarg($state));
check('--resume after a stop re-asks only the unsettled slots (3) and files nothing twice',
    $rc === 0 && str_contains($o, '2 row(s) to draw, 1 already done · 3 request(s)')
    && (int) one($db, 'SELECT COUNT(*) FROM jd2_generations') === $after
    && (int) one($db, 'SELECT COUNT(*) FROM jd2_runs WHERE prompt_id = ?', [$p4]) === 2
    && count(json_decode((string) file_get_contents($state), true)['bases'][$sb]['a wind-up tin robot']['slots']) === 4, $o);
[$rc, $o] = batch(escapeshellarg($csv) . ' --local --state ' . escapeshellarg($state));
check('without --resume, rows already in the state file are refused (exit 2)', $rc === 2 && str_contains($o, 'Pass --resume'), $o);
// the spend guard: a CSV bigger than what is left of today's breaker
$big = "$scratch/big.csv";
$fh = fopen($big, 'w');
fputcsv($fh, ['prompt'], ',', '"', '');
for ($i = 1; $i <= 60; $i++) {
    fputcsv($fh, ["guard prompt $i"], ',', '"', '');
}
fclose($fh);
$left = JD_LIMIT_GLOBAL_DAILY - (int) one($db, 'SELECT COUNT(*) FROM jd2_generations WHERE created >= ?', [jd_utc_midnight()]);
[$rc, $o] = batch(escapeshellarg($big) . ' --local --state ' . escapeshellarg("$scratch/state2.json"));
check("the spend guard refuses 240 drawings against $left left, says how many rows fit, draws nothing",
    $rc === 2 && str_contains($o, 'Refusing to start') && str_contains($o, 'run the first ' . intdiv($left, 4) . ' row(s)')
    && (int) one($db, 'SELECT COUNT(*) FROM jd2_generations') === $after, $o);
[$rc, $o] = batch(escapeshellarg($big) . ' --local --dry-run --state ' . escapeshellarg("$scratch/state2.json"));
check('--dry-run reports the refusal without failing', $rc === 0 && str_contains($o, 'WOULD REFUSE'), $o);
$badCsv = "$scratch/bad.csv";
file_put_contents($badCsv, "prompt,size,rerun_of\nsomething,huge,\nother,,not-an-id\n");
[$rc, $o] = batch(escapeshellarg($badCsv) . ' --local --dry-run --state ' . escapeshellarg("$scratch/state3.json"));
check('a bad CSV is refused before anything is asked, every problem listed', $rc === 2 && str_contains($o, 'size `huge`')
    && str_contains($o, 'rerun_of `not-an-id`'), $o);
[$rc, $o] = batch(escapeshellarg($csv) . ' --state ' . escapeshellarg("$scratch/state4.json"));
check('without --local and without JD_BENCH_KEY it refuses (and calls nothing)', $rc === 2 && str_contains($o, 'JD_BENCH_KEY is not set'), $o);
[, $q] = req('GET', '/api/jd2-queue.php', null, true);
check("the batch's prompts are in the bench's backlog (P4 now on its rerun)", count(array_intersect([$new[0]['id'], $new[1]['id'], $p4],
    array_column($q['items'], 'prompt_id'))) === 3, json_encode(array_column($q['items'], 'prompt_id')));

// ============================================================================
section('(f) the intake facts on every reader: queue, ledger, analytics ?tag=');
[$st, $q] = req('GET', '/api/jd2-queue.php?prompt=' . $p2, null, true);
$qi = $q['items'][0] ?? [];
check('jd2-queue: the item carries tags, size_by, intake_version, intake_model, intake_at, reasons, fallback',
    $st === 200 && ($qi['tags'] ?? null) === $P2TAGS && ($qi['size_by'] ?? '') === 'model' && ($qi['intake_version'] ?? '') === jd2_intake_version($taxonomy)
    && ($qi['intake_model'] ?? '') === 'mock' && !empty($qi['intake_at']) && isset($qi['reasons']['size'], $qi['reasons']['classification'])
    && ($qi['fallback'] ?? null) === false, json_encode(array_intersect_key($qi, array_flip(['tags', 'size_by', 'intake_version', 'intake_model', 'intake_at', 'reasons', 'fallback']))));
[$st, $L] = req('GET', '/api/jd2-ledger.php?prompt=' . $p1, null, true);
$li = $L['items'][0] ?? [];
check('jd2-ledger: the row carries size_by (visitor: P1\'s sitting chose s), tags, the intake stamp and reasons; the payload names facets and size tiers',
    $st === 200 && ($li['size_class'] ?? '') === 's' && ($li['size_by'] ?? '') === 'visitor' && ($li['tags']['subject'] ?? null) === ['object']
    && ($li['intake_model'] ?? '') === 'mock' && !empty($li['intake_at']) && array_key_exists('intake_cost_usd', $li)
    && isset($li['reasons']['size']) && ($li['fallback'] ?? null) === false && array_key_exists('intake_error', $li) && $li['intake_error'] === null
    && array_column($L['facets'] ?? [], 'id') === ['subject', 'treatment', 'probe']
    && array_column($L['size_tiers'] ?? [], 'id') === array_keys(jd_size_tiers($taxonomy)),
    json_encode(array_intersect_key($li, array_flip(['size_class', 'size_by', 'tags', 'intake_model', 'reasons', 'fallback']))));
[$st, $A] = req('GET', '/api/jd2-analytics.php');
$tagsBlock = $A['tags'] ?? [];
$obj = $tagsBlock['subject']['object'] ?? [];
$state = $tagsBlock['probe']['state'] ?? [];
$byModelOk = is_array($obj['by_model'] ?? null) && $obj['by_model'] !== [];
foreach ($obj['by_model'] ?? [] as $m => $c) {
    $byModelOk = $byModelOk && isset($c['mean'], $c['n']) && $c['n'] > 0 && $c['mean'] >= 1 && $c['mean'] <= 5;
}
check('analytics: a tags block per facet, per heading {label, n, by_model {mean, n}}',
    $st === 200 && array_keys($tagsBlock) === ['subject', 'treatment', 'probe'] && ($obj['n'] ?? 0) === 2 && ($obj['label'] ?? '') === 'Object'
    && ($state['n'] ?? 0) === 1 && $byModelOk && (($tagsBlock['treatment']['cartoon']['n'] ?? -1) === 0), json_encode($tagsBlock['subject']['object'] ?? null));
// P2 is the only prompt filed under probe:state: its two runs are the population
// (the grades: its runs' display sessions, as the readers compute them)
$wantGrades = 0;
foreach (rows($db, 'SELECT id FROM jd2_runs WHERE prompt_id = ?', [$p2]) as $r) {
    $d = jd2_display_session($db, $r['id'], array_column(jd2_run_generations($db, $r['id']), 'id'), $taxonomy);
    foreach ($d['standing']['judgments'] ?? [] as $jj) {
        $wantGrades += $jj['grade'] !== null ? 1 : 0;
    }
}
[$st, $T, $hT] = req('GET', '/api/jd2-analytics.php?tag=probe:state');
$tGrades = array_sum(array_column($T['grades'] ?? [], 'n'));
check('?tag=probe:state keeps P2 only: 2 runs, its graded drawings, its own ETag, `tag` echoed',
    $st === 200 && ($T['tag'] ?? '') === 'probe:state' && ($T['totals']['turns'] ?? 0) === 2 && $wantGrades > 0 && $tGrades === $wantGrades
    && ($T['tags']['subject']['object']['n'] ?? 0) === 1 && ($hT['etag'] ?? '') !== '', json_encode([$T['totals'] ?? null, $tGrades]));
[$st, $T2] = req('GET', '/api/jd2-analytics.php?tag=subject:object');
check('?tag=subject:object keeps both live prompts (the same population as no filter)', $st === 200
    && ($T2['totals']['turns'] ?? 0) === ($A['totals']['turns'] ?? -1), json_encode($T2['totals'] ?? null));
[$st, $T3] = req('GET', '/api/jd2-analytics.php?tag=treatment:cartoon');
check('?tag= with no prompt filed under it: an empty population, not an error', $st === 200 && ($T3['totals']['turns'] ?? -1) === 0
    && ($T3['grades'] ?? null) === [], json_encode($T3['totals'] ?? null));
foreach (['subject' => 'no heading', 'mood:happy' => 'an unknown facet', 'subject:spaceship' => 'an unknown heading'] as $bad => $what) {
    [$st, $j] = req('GET', '/api/jd2-analytics.php?tag=' . rawurlencode($bad));
    check("?tag= with $what → 400", $st === 400 && ($j['error']['code'] ?? '') === 'bad_request', $st . ' ' . json_encode($j));
}

printf("\n%d passed, %d failed\n", $passed, $failed);
if ($failed > 0) {
    echo "\n-- server log --\n" . @file_get_contents($serverLog);
}
exit($failed === 0 ? 0 : 1);

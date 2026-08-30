<?php
// GET /api/jd-inventory.php — the census (2026-08-30).
//
// Everything the drawer has ever made, in one read: every submission (the
// curated backfill AND every real turn), its generations, and how far the
// owner's rating of each has got under the CURRENT rubric. The bench queue
// answers "what curated work is left"; this answers the larger question the
// owner asked — what exists at all, how it came to exist, and what has never
// been seen in the drawer.
//
// Read-only, no-store, same soft gate as the other bench endpoints. Prompts
// ride along (they are the join key between a curated item and its reruns,
// and they are already public in the drawer); SVG text does not — this is a
// census, not a payload.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    jd_fail(405, 'method_not_allowed', 'GET only.');
}

if (JD_IS_PRODUCTION && JD_BENCH_REQUIRE_KEY) {
    $secrets  = jd_secrets();
    $expected = $secrets['jd_bench_key'] ?? ($secrets['jd_setup_key'] ?? null);
    $supplied = $_SERVER['HTTP_X_BENCH_KEY'] ?? ($_GET['key'] ?? '');
    if (!is_string($expected) || $expected === '' || !hash_equals($expected, (string) $supplied)) {
        jd_fail(403, 'forbidden', 'The bench key is missing or wrong.');
    }
}

// The live rubric: what "fully rated" means today.
$taxonomy = jd_taxonomy();
$liveAxes = [];
foreach ($taxonomy['axes'] ?? [] as $a) {
    if (empty($a['defunct']) && isset($a['id'])) {
        $liveAxes[(string) $a['id']] = true;
    }
}

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $subs = $db->query(
        'SELECT id, item_id, prompt, created, status, client FROM jd_submissions ORDER BY created'
    )->fetchAll(PDO::FETCH_ASSOC);

    $gens = $db->query(
        'SELECT id, submission_id, slot, model_id, status FROM jd_generations'
    )->fetchAll(PDO::FETCH_ASSOC);

    $rates = $db->query(
        'SELECT generation_id, kind, axis_id, value, taxonomy_version, client FROM jd_ratings'
    )->fetchAll(PDO::FETCH_ASSOC);

    $ranks = [];
    try {
        $ranks = $db->query('SELECT submission_id, generation_id, rank_pos FROM jd_ranks')
            ->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        error_log('jd-inventory: jd_ranks unavailable');
    }
} catch (PDOException $e) {
    error_log('jd-inventory: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The census could not be read.');
}

// --- fold the ratings onto their generations ------------------------------
$byGen = [];   // gen_id => ['axes' => [id => v], 'grade' => v, 'flags' => [], 'vers' => []]
foreach ($rates as $r) {
    $g = (string) $r['generation_id'];
    if (!isset($byGen[$g])) {
        $byGen[$g] = ['axes' => [], 'grade' => null, 'flags' => [], 'vers' => []];
    }
    $byGen[$g]['vers'][(int) $r['taxonomy_version']] = true;
    if ($r['kind'] === 'axis' && isset($liveAxes[(string) $r['axis_id']])) {
        $byGen[$g]['axes'][(string) $r['axis_id']] = (float) $r['value'];
    } elseif ($r['kind'] === 'grade') {
        $byGen[$g]['grade'] = (float) $r['value'];
    } elseif ($r['kind'] === 'flag') {
        $byGen[$g]['flags'][] = ['axis_id' => $r['axis_id'], 'client' => $r['client']];
    }
}
$rankByGen = [];
foreach ($ranks as $r) {
    $rankByGen[(string) $r['generation_id']] = (int) $r['rank_pos'];
}

$gensBySub = [];
foreach ($gens as $g) {
    $id = (string) $g['id'];
    $rec = $byGen[$id] ?? ['axes' => [], 'grade' => null, 'flags' => [], 'vers' => []];
    $gensBySub[(string) $g['submission_id']][] = [
        'gen_id'    => $id,
        'slot'      => $g['slot'],
        'model_id'  => $g['model_id'],
        'status'    => $g['status'],
        'axes'      => (object) $rec['axes'],
        'axes_n'    => count($rec['axes']),
        'grade'     => $rec['grade'],
        'rank'      => $rankByGen[$id] ?? null,
        'flags'     => $rec['flags'],
        'tax'       => array_map('intval', array_keys($rec['vers'])),
        'complete'  => count($rec['axes']) === count($liveAxes) && $rec['grade'] !== null,
    ];
}

// --- which curated items exist as FILES, and what the drawer serves --------
$dir = __DIR__ . '/../art/junk-drawer/items';
$onDisk = [];
foreach (glob($dir . '/*/entry.json') as $f) {
    $e = json_decode((string) @file_get_contents($f), true);
    if (!is_array($e) || !isset($e['id'])) {
        continue;
    }
    $shown = 0;
    foreach ($e['responses'] ?? [] as $r) {
        if (empty($r['retired'])) {
            $shown++;
        }
    }
    $onDisk[(string) $e['id']] = [
        'title'      => $e['title'] ?? $e['id'],
        'prompt'     => $e['prompt'] ?? '',
        'retired'    => !empty($e['retired']),
        'responses'  => count($e['responses'] ?? []),
        'shown'      => $shown,
    ];
}

$out = [];
foreach ($subs as $s) {
    $sid = (string) $s['id'];
    $out[] = [
        'submission_id' => $sid,
        'item_id'       => $s['item_id'],
        'kind'          => $s['item_id'] === null ? 'turn' : 'curated',
        'created'       => $s['created'],
        'status'        => $s['status'],
        'client'        => $s['client'],
        'prompt'        => (string) $s['prompt'],
        'generations'   => $gensBySub[$sid] ?? [],
    ];
}

jd_json_out(200, [
    'ok'          => true,
    'build'       => jd_build_stamp()['build'],
    'live_axes'   => array_keys($liveAxes),
    'items_on_disk' => $onDisk,
    'submissions' => $out,
]);

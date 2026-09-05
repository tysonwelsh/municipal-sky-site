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
// Read-only, no-store, same gate as the other bench endpoints. Prompts ride
// along (they are the join key between a curated item and its reruns, and
// they are already public in the drawer); SVG text does not — this is a
// census, not a payload.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_no_store();
jd_require_get();
jd_require_bench_key();

$taxonomy = jd_taxonomy_required('jd-inventory');
$liveAxes = jd_live_axes($taxonomy);

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $subs = $db->query(
        'SELECT id, item_id, prompt, created, status, client, title, size_class,
                suppressed, retire_requested_at, rerun_requested_at
           FROM jd_submissions ORDER BY created'
    )->fetchAll(PDO::FETCH_ASSOC);

    // usage rides along: a promoted turn's item has to state what the
    // drawing cost, and this is the only census that can price it
    $gens = $db->query(
        'SELECT id, submission_id, slot, model_id, model_version, provider,
                status, usage_tokens FROM jd_generations ORDER BY submission_id, slot'
    )->fetchAll(PDO::FETCH_ASSOC);

    $rates = $db->query(
        'SELECT generation_id, kind, axis_id, value, taxonomy_version, client
           FROM jd_ratings ORDER BY rated_at, id'
    )->fetchAll(PDO::FETCH_ASSOC);

    $ranks = [];
    try {
        $ranks = $db->query('SELECT submission_id, generation_id, rank_pos FROM jd_ranks')
            ->fetchAll(PDO::FETCH_ASSOC);
    } catch (PDOException $e) {
        if (!jd_missing_table($e)) {
            throw $e;
        }
        error_log('jd-inventory: jd_ranks unavailable');
    }
} catch (PDOException $e) {
    error_log('jd-inventory: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The census could not be read.');
}

// --- fold the ratings onto their generations ------------------------------
// The census reads a generation's standing the way the drawer does — the
// bench's answer outranks any other rater's — and also lists the taxonomy
// versions a generation has been judged under.
$fold = jd_fold_ratings($rates, $liveAxes);
$versions = [];
foreach ($rates as $r) {
    $versions[(string) $r['generation_id']][(int) $r['taxonomy_version']] = true;
}
$rankByGen = [];
foreach ($ranks as $r) {
    $rankByGen[(string) $r['generation_id']] = (int) $r['rank_pos'];
}

$gensBySub = [];
foreach ($gens as $g) {
    $id = (string) $g['id'];
    $pick = jd_pick_rating($fold[$id] ?? [], ['bench', '*']);
    $gensBySub[(string) $g['submission_id']][] = [
        'gen_id'        => $id,
        'slot'          => $g['slot'],
        'model_id'      => $g['model_id'],
        'model_version' => $g['model_version'],
        'provider'      => $g['provider'],
        'usage_tokens'  => $g['usage_tokens'],
        'status'        => $g['status'],
        'axes'          => (object) $pick['axes'],
        'axes_n'        => count($pick['axes']),
        'grade'         => $pick['grade'],
        'rank'          => $rankByGen[$id] ?? null,
        'tax'           => array_keys($versions[$id] ?? []),
        'complete'      => count($pick['axes']) === count($liveAxes) && $pick['grade'] !== null,
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
        'submission_id'       => $sid,
        'item_id'             => $s['item_id'],
        'kind'                => $s['item_id'] === null ? 'turn' : 'curated',
        'created'             => $s['created'],
        'status'              => $s['status'],
        'client'              => $s['client'],
        'prompt'              => (string) $s['prompt'],
        'title'               => $s['title'],
        'size_class'          => $s['size_class'],
        'suppressed'          => (bool) $s['suppressed'],
        'retire_requested_at' => $s['retire_requested_at'],
        'rerun_requested_at'  => $s['rerun_requested_at'],
        'generations'         => $gensBySub[$sid] ?? [],
    ];
}

jd_json_out(200, [
    'ok'            => true,
    'build'         => jd_build_stamp()['build'],
    'live_axes'     => array_keys($liveAxes),
    'items_on_disk' => $onDisk,
    'submissions'   => $out,
]);

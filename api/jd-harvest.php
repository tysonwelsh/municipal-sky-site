<?php
// GET /api/jd-harvest.php?item=<item_id> — the RERUN HARVEST read (2026-08-29).
//
// The bench's rerun files a curated item's prompt as an ordinary visitor turn:
// four fresh generations, rated blind, filed through jd-rate.php. Everything a
// session needs to commit that rerun back into the item's directory — the SVG
// texts, the owner's grades and axis ratings, the rank order — lives only in
// these tables, and no other endpoint serves turn rows. This one returns, for
// one curated item, every RATED visitor submission whose prompt matches the
// item's prompt byte-for-byte (a rerun re-issues the stored prompt verbatim,
// so exact match is the honest join), newest first.
//
// Read-only. Same gate as the other bench endpoints. What it could expose
// while the gate is open: generated SVGs and the ratings on them for prompts
// that are already public in the drawer. No visitor identity: hashes are
// omitted.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_no_store();
jd_require_get();
jd_require_bench_key();

$itemId = (string) ($_GET['item'] ?? '');
if (!preg_match('/^[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,64}$/', $itemId)) {
    jd_fail(400, 'bad_request', 'An item id is required (YYYY-MM-DD-slug).');
}

try {
    $db = jd_db();
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $stmt = $db->prepare('SELECT prompt FROM jd_submissions WHERE item_id = ? LIMIT 1');
    $stmt->execute([$itemId]);
    $prompt = $stmt->fetchColumn();
    if ($prompt === false) {
        jd_fail(404, 'not_found', 'No curated submission for that item — has the backfill run?');
    }

    // ?status=any widens to un-rated turns — the diagnostic view (which slot
    // failed, why, how long it ran) shouldn't have to wait for a rating.
    // Harvest consumers keep the default: only rated turns are commit-worthy.
    $anyStatus = (($_GET['status'] ?? '') === 'any');
    $stmt = $db->prepare(
        "SELECT id, created, status, title, size_class, suppressed,
                retire_requested_at, rerun_requested_at
           FROM jd_submissions
          WHERE item_id IS NULL AND prompt = ?"
        . ($anyStatus ? '' : " AND status = 'rated'")
        . " ORDER BY created DESC
          LIMIT 5"
    );
    $stmt->execute([$prompt]);
    $subs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $genQ = $db->prepare(
        'SELECT id, slot, model_id, model_version, provider, harness, status,
                reject_reason, svg, raw_response, latency_ms, usage_tokens, created
           FROM jd_generations
          WHERE submission_id = ?
          ORDER BY slot'
    );
    $rateQ = $db->prepare(
        'SELECT generation_id, kind, axis_id, value, note, taxonomy_version, client
           FROM jd_ratings
          WHERE generation_id IN (SELECT id FROM jd_generations WHERE submission_id = ?)'
    );
    $rankQ = $db->prepare(
        'SELECT generation_id, rank_pos, client FROM jd_ranks WHERE submission_id = ?'
    );
    $compQ = $db->prepare(
        'SELECT winner_gen_id, strength FROM jd_comparisons WHERE submission_id = ?'
    );

    $out = [];
    foreach ($subs as $sub) {
        $genQ->execute([$sub['id']]);
        $rateQ->execute([$sub['id']]);
        $ranks = [];
        try {
            $rankQ->execute([$sub['id']]);
            $ranks = $rankQ->fetchAll(PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            if (!jd_missing_table($e)) {
                throw $e;
            }
            // jd_ranks lands via the manual setup script; absent = no order
        }
        $compQ->execute([$sub['id']]);
        $gens = $genQ->fetchAll(PDO::FETCH_ASSOC);
        foreach ($gens as &$g) {
            // raw_response is the diagnostic for a FAILED slot (the provider's
            // error body); on an ok slot it's the whole model output — omit it
            if ($g['status'] === 'ok') {
                $g['raw_response'] = null;
            } elseif (is_string($g['raw_response']) && strlen($g['raw_response']) > 2000) {
                $g['raw_response'] = substr($g['raw_response'], 0, 2000) . '…[truncated]';
            }
        }
        unset($g);
        $out[] = [
            'submission_id'       => $sub['id'],
            'created'             => $sub['created'],
            'status'              => $sub['status'],
            'title'               => $sub['title'],
            'size_class'          => $sub['size_class'],
            'suppressed'          => (bool) $sub['suppressed'],
            'retire_requested_at' => $sub['retire_requested_at'],
            'rerun_requested_at'  => $sub['rerun_requested_at'],
            'generations'         => $gens,
            'ratings'             => $rateQ->fetchAll(PDO::FETCH_ASSOC),
            'ranks'               => $ranks,
            'comparison'          => $compQ->fetch(PDO::FETCH_ASSOC) ?: null,
        ];
    }
} catch (PDOException $e) {
    error_log('jd-harvest: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The turn rows could not be read.');
}

jd_json_out(200, [
    'ok'      => true,
    'build'   => jd_build_stamp()['build'],
    'item_id' => $itemId,
    'prompt'  => $prompt,
    'reruns'  => $out,
]);

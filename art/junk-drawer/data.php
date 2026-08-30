<?php
// The Junk Drawer — read-only data endpoint.
// Assembles taxonomy.json + items/*/entry.json into one JSON document at
// request time. There is no committed manifest. Committing entry files is
// still the whole publishing act for CURATED items — but since 2026-08-30 a
// fully rated turn joins the drawer straight from the database (owner call),
// so the payload is files AND the turns the drawer drew for itself. The
// database half is best-effort: if it cannot answer, the files still serve.
// Contract: PLAN-BACKEND.md §7 (repo-only doc).

$base = __DIR__;
$taxonomyFile = $base . '/taxonomy.json';
$entryFiles = glob($base . '/items/*/entry.json') ?: [];

// ETag over (path + mtime) of every data file, so a deploy invalidates
// caches and unchanged repeats are 304s.
$stamp = '';
foreach (array_merge([$taxonomyFile], $entryFiles) as $f) {
    $stamp .= $f . '|' . @filemtime($f) . ';';
}
// The database is part of the payload since 2026-08-30 (rated turns join the
// drawer), so the ETag has to move when IT moves: the newest rating and the
// count are enough to change the hash on every filing, and cost one small
// query. A database that cannot answer contributes nothing and the drawer
// still serves its files — see the turn block below for the same discipline.
$dbStamp = '';
try {
    require_once __DIR__ . '/../../api/jd-config.php';
    $dbq = jd_db()->query('SELECT COUNT(*) AS n, MAX(rated_at) AS m FROM jd_ratings')
        ->fetch(PDO::FETCH_ASSOC);
    $dbStamp = ($dbq['n'] ?? '0') . '@' . ($dbq['m'] ?? '');
} catch (Throwable $e) {
    $dbStamp = 'db-unavailable';
}
$stamp .= 'db|' . $dbStamp . ';';
$etag = '"' . md5($stamp) . '"';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache');
header('ETag: ' . $etag);

if (isset($_SERVER['HTTP_IF_NONE_MATCH']) && trim($_SERVER['HTTP_IF_NONE_MATCH']) === $etag) {
    http_response_code(304);
    exit();
}

$taxonomy = json_decode(@file_get_contents($taxonomyFile), true);
if (!is_array($taxonomy)) {
    http_response_code(500);
    echo json_encode(['error' => 'taxonomy.json missing or unparseable']);
    exit();
}

$items = [];
$errors = [];

foreach ($entryFiles as $file) {
    $dirId = basename(dirname($file));
    $entry = json_decode(@file_get_contents($file), true);

    if (!is_array($entry)) {
        $errors[] = ['path' => 'items/' . $dirId . '/entry.json', 'reason' => 'unparseable JSON'];
        continue;
    }
    foreach (['id', 'title', 'prompt', 'created', 'responses'] as $req) {
        if (empty($entry[$req])) {
            $errors[] = ['path' => 'items/' . $dirId . '/entry.json', 'reason' => 'missing required field: ' . $req];
            continue 2;
        }
    }
    if ($entry['id'] !== $dirId) {
        $errors[] = ['path' => 'items/' . $dirId . '/entry.json', 'reason' => 'id does not match directory name'];
        continue;
    }
    if (!is_array($entry['responses']) || count($entry['responses']) === 0) {
        $errors[] = ['path' => 'items/' . $dirId . '/entry.json', 'reason' => 'responses must be a non-empty array'];
        continue;
    }

    // A RESPONSE may retire individually (owner call, 2026-08-30, first use:
    // the desktop succulent's two flawed originals): `"retired": true` on a
    // response drops it from the served payload — the drawer and the report
    // card never see it — while the entry keeps the row and its files, so
    // rids stay permanent and the bench queue's position-join to the DB's
    // curated generations is undisturbed. This is the display-side half of
    // the legacy-keep exception; deletion is never the mechanism.
    $entry['responses'] = array_values(array_filter(
        $entry['responses'],
        static fn($r) => empty($r['retired'])
    ));
    if (count($entry['responses']) === 0) {
        continue;   // every response retired reads as no item to serve
    }

    foreach ($entry['responses'] as $i => $resp) {
        $entry['responses'][$i]['url'] = '/art/junk-drawer/items/' . $dirId . '/' . ($resp['file'] ?? '');
        $entry['responses'][$i]['transcript_url'] = !empty($resp['transcript'])
            ? '/art/junk-drawer/items/' . $dirId . '/' . $resp['transcript']
            : null;
    }

    // primary always resolves. An entry MAY pin one response by setting
    // `primary` — an explicit curatorial flag that wins outright. With no
    // pin, the best-graded response is shown, ties breaking to the earliest
    // response, so a regrade re-points the drawer on its own. Grades are
    // stored as the taxonomy rank itself (5.0 … 1.0, entry schema 2), so
    // "best" is just the highest number. Entries whose responses carry no
    // numeric grade fall back to the first response.
    $rids = array_column($entry['responses'], 'rid');
    if (empty($entry['primary']) || !in_array($entry['primary'], $rids, true)) {
        $best = null;
        $bestRank = -1;
        foreach ($entry['responses'] as $resp) {
            $rank = is_numeric($resp['grade'] ?? null) ? (float) $resp['grade'] : -1;
            if ($rank > $bestRank) {
                $bestRank = $rank;
                $best = $resp['rid'] ?? null;
            }
        }
        $entry['primary'] = $best ?? ($rids[0] ?? null);
    }

    $items[] = $entry;
}

// ===========================================================================
// THE TURNS THEMSELVES (owner call, 2026-08-30)
//
// A turn used to end as a souvenir: the winning drawing went into the
// visitor's own browser storage, wore a YOURS tag, and vanished with the
// session. It now takes a real place in the drawer, on one condition — the
// visitor finished the job: every surviving drawing graded and answered on
// every live axis, and the ranking filed. Rate it through and it is in the
// drawer for everyone; leave it half-rated and it is not.
//
// Three ways a turn is held back: the visitor ticked SUPPRESS on the last
// card (recorded in full, displayed nowhere), the owner scrapped it at the
// bench, or its prompt already belongs to a curated item — that last one is
// a rerun, whose drawings live in the item it belongs to, and serving it
// again would double the subject in the drawer.
//
// The artwork stays in the database: each response points at jd-gen-svg.php
// rather than a file. Nothing is committed, which is the point — the drawer
// stops needing a deploy to grow. (The colophon's "no database" claim was
// retired with this change; it is now files AND the turns the drawer has
// drawn for itself.)
//
// A DATABASE OUTAGE MUST NOT TAKE THE DRAWER DOWN. Everything here is one
// try, and its failure leaves $items exactly as the files built it.
$turnItems = [];
try {
    if (!function_exists('jd_db')) {
        require_once __DIR__ . '/../../api/jd-config.php';
    }
    // the pricing table, so a turn's card can state what the drawing cost —
    // the same numbers jd-rate's reveal and the report card already use
    require_once __DIR__ . '/../../api/jd-usage.php';
    $tdb = jd_db();
    $tdb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $liveAxes = [];
    foreach ($taxonomy['axes'] ?? [] as $ax) {
        if (empty($ax['defunct']) && isset($ax['id'])) {
            $liveAxes[(string) $ax['id']] = true;
        }
    }
    $curatedPrompts = [];
    foreach ($items as $e) {
        $curatedPrompts[(string) ($e['prompt'] ?? '')] = true;
    }

    $tsubs = $tdb->query(
        "SELECT id, prompt, created FROM jd_submissions
          WHERE item_id IS NULL AND status = 'rated'
          ORDER BY created DESC"
    )->fetchAll(PDO::FETCH_ASSOC);

    if ($tsubs) {
        $tgens = $tdb->query(
            "SELECT g.id, g.submission_id, g.slot, g.model_id, g.model_version,
                    g.usage_tokens, g.provider
               FROM jd_generations g
               JOIN jd_submissions s ON s.id = g.submission_id
              WHERE s.item_id IS NULL AND s.status = 'rated'
                AND g.status = 'ok' AND g.svg IS NOT NULL
              ORDER BY g.submission_id, g.slot"
        )->fetchAll(PDO::FETCH_ASSOC);
        $bySub = [];
        foreach ($tgens as $g) { $bySub[(string) $g['submission_id']][] = $g; }

        $trates = $tdb->query(
            "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.note, r.client
               FROM jd_ratings r
               JOIN jd_generations g ON g.id = r.generation_id
               JOIN jd_submissions s ON s.id = g.submission_id
              WHERE s.item_id IS NULL AND s.status = 'rated'"
        )->fetchAll(PDO::FETCH_ASSOC);
        $rby = [];
        foreach ($trates as $r) { $rby[(string) $r['generation_id']][] = $r; }

        $tranks = [];
        try {
            foreach ($tdb->query(
                "SELECT r.generation_id, r.rank_pos, r.client
                   FROM jd_ranks r
                   JOIN jd_submissions s ON s.id = r.submission_id
                  WHERE s.item_id IS NULL AND s.status = 'rated'"
            )->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $gid = (string) $r['generation_id'];
                if ($r['client'] === 'bench' || !isset($tranks[$gid])) {
                    $tranks[$gid] = (int) $r['rank_pos'];
                }
            }
        } catch (PDOException $e) { /* no ranks table: no turns qualify */ }

        foreach ($tsubs as $sub) {
            $sid = (string) $sub['id'];
            $gens = $bySub[$sid] ?? [];
            if (!$gens) { continue; }
            if (isset($curatedPrompts[(string) $sub['prompt']])) { continue; }

            $responses = []; $hold = false; $title = null; $ok = true;
            foreach ($gens as $g) {
                $gid = (string) $g['id'];
                $axes = []; $grade = null;
                foreach ($rby[$gid] ?? [] as $r) {
                    if ($r['kind'] === 'axis' && isset($liveAxes[(string) $r['axis_id']])) {
                        // the bench's answer outranks the turn's own
                        if ($r['client'] === 'bench' || !isset($axes[(string) $r['axis_id']])) {
                            $axes[(string) $r['axis_id']] = (float) $r['value'];
                        }
                    } elseif ($r['kind'] === 'grade') {
                        if ($r['client'] === 'bench' || $grade === null) {
                            $grade = (float) $r['value'];
                        }
                    } elseif ($r['kind'] === 'flag') {
                        $ax = (string) $r['axis_id'];
                        if ($ax === 'suppress' || $ax === 'retire-request') {
                            if (strpos((string) $r['note'], 'UN') !== 0) { $hold = true; }
                        } elseif ($ax === 'title'
                            && preg_match('/^TITLE (.+)$/s', (string) $r['note'], $m)) {
                            $title = trim($m[1]);
                        }
                    }
                }
                if (count($axes) !== count($liveAxes) || $grade === null) { $ok = false; break; }
                $rank = $tranks[$gid] ?? null;
                if (count($gens) > 1 && $rank === null) { $ok = false; break; }
                $responses[] = [
                    'gen_id' => $gid, 'rank' => $rank ?: 1,
                    'model' => (string) $g['model_id'],
                    'model_version' => (string) ($g['model_version'] ?? $g['model_id']),
                    'axes' => $axes, 'grade' => $grade,
                    'usage' => $g['usage_tokens'], 'provider' => (string) $g['provider'],
                ];
            }
            if (!$ok || $hold || !$responses) { continue; }

            usort($responses, fn($a, $b) => $a['rank'] <=> $b['rank']);
            $out = [];
            foreach ($responses as $i => $r) {
                $row = [
                    'rid' => 'r' . ($i + 1),
                    'file' => $r['gen_id'] . '.svg',
                    'gen_id' => $r['gen_id'],
                    'model' => $r['model'],
                    'model_version' => $r['model_version'],
                    'date' => substr((string) $sub['created'], 0, 10),
                    'generation' => ['mode' => 'one-shot', 'prompt_count' => 1],
                    'grade' => $r['grade'],
                    'annotations' => $r['axes'],
                    'url' => '/api/jd-gen-svg.php?gen=' . rawurlencode($r['gen_id']),
                    'transcript_url' => null,
                ];
                if (function_exists('jd_generation_cost')) {
                    $u = $r['usage'] ? json_decode((string) $r['usage'], true) : null;
                    $c = jd_generation_cost($r['provider'], $r['model_version'],
                        is_array($u) ? $u : null);
                    if ($c['tokens']) {
                        $row['tokens'] = [
                            'input' => $c['tokens']['input'], 'output' => $c['tokens']['output'],
                            'total' => $c['tokens']['input'] + $c['tokens']['cache_write']
                                + $c['tokens']['cache_read'] + $c['tokens']['output'],
                        ];
                    }
                    if ($c['cost_usd'] !== null) { $row['cost_usd'] = round($c['cost_usd'], 6); }
                }
                $out[] = $row;
            }
            // the id IS the winning drawing's generation, which is also the id
            // the visitor's own browser gave it the moment they won it — so a
            // freshly-won item and the served one are one item, not two
            $turnItems[] = [
                'schema' => 2,
                'id' => $out[0]['gen_id'],
                'title' => $title !== null && $title !== ''
                    ? $title
                    : (mb_strlen($sub['prompt']) > 42
                        ? mb_substr($sub['prompt'], 0, 41) . '…' : (string) $sub['prompt']),
                'prompt' => (string) $sub['prompt'],
                'created' => substr((string) $sub['created'], 0, 10),
                'sizeClass' => 'm',
                'primary' => 'r1',
                'fromTurn' => true,
                'responses' => $out,
            ];
        }
    }
} catch (Throwable $e) {
    error_log('data.php: turn items unavailable (' . $e->getMessage() . ')');
    $turnItems = [];
}
$items = array_merge($items, $turnItems);

// Single-item mode: ?item=<id> (returns the item even if retired).
if (isset($_GET['item'])) {
    foreach ($items as $entry) {
        if ($entry['id'] === $_GET['item']) {
            echo json_encode(['taxonomy' => $taxonomy, 'item' => $entry]);
            exit();
        }
    }
    http_response_code(404);
    echo json_encode(['error' => 'no such item: ' . $_GET['item']]);
    exit();
}

// Full manifest: retired items excluded, newest first.
$items = array_values(array_filter($items, function ($e) {
    return empty($e['retired']);
}));
usort($items, function ($a, $b) {
    return strcmp($b['created'], $a['created']) ?: strcmp($b['id'], $a['id']);
});

echo json_encode([
    'generated' => gmdate('c'),
    'count' => count($items),
    'taxonomy' => $taxonomy,
    'items' => $items,
    'errors' => $errors,
]);

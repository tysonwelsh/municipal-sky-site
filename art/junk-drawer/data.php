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
    $dbc = jd_db();
    $dbq = $dbc->query('SELECT COUNT(*) AS n, MAX(rated_at) AS m FROM jd_ratings')
        ->fetch(PDO::FETCH_ASSOC);
    $dbStamp = ($dbq['n'] ?? '0') . '@' . ($dbq['m'] ?? '');
    // since 2026-09-05 the payload also carries the bench's RANKS and the
    // size the bench filed on a curated item (the overlay below), so those
    // have to move the tag as well — a rank-only refile changed nothing in
    // jd_ratings and would otherwise 304 a stale card back to everyone
    try {
        $dbr = $dbc->query('SELECT COUNT(*) AS n, MAX(rated_at) AS m FROM jd_ranks')
            ->fetch(PDO::FETCH_ASSOC);
        $dbStamp .= '|' . ($dbr['n'] ?? '0') . '@' . ($dbr['m'] ?? '');
    } catch (Throwable $e) {
        $dbStamp .= '|no-ranks';
    }
    $sizes = '';
    foreach ($dbc->query("SELECT id, size_class FROM jd_submissions WHERE item_id IS NOT NULL AND size_class IS NOT NULL ORDER BY id") as $sz) {
        $sizes .= $sz['id'] . '=' . $sz['size_class'] . ',';
    }
    $dbStamp .= '|' . md5($sizes);
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
    $unfiltered[$dirId] = $entry['responses'];   // the position join reads these
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
    $pinned[$dirId] = !empty($entry['primary']) && in_array($entry['primary'], $rids, true);
    if (!$pinned[$dirId]) {
        $entry['primary'] = jd_best_graded($entry['responses']);
    }

    $items[] = $entry;
}

/** the best-graded response's rid, ties to the earliest; the first when none is graded */
function jd_best_graded(array $responses): ?string
{
    $best = null;
    $bestRank = -1;
    foreach ($responses as $resp) {
        $rank = is_numeric($resp['grade'] ?? null) ? (float) $resp['grade'] : -1;
        if ($rank > $bestRank) {
            $bestRank = $rank;
            $best = $resp['rid'] ?? null;
        }
    }
    return $best ?? ($responses[0]['rid'] ?? null);
}

// ===========================================================================
// THE BENCH'S WORD ON THE CURATED CORPUS (owner call, 2026-09-05 — admin mode)
//
// Until this block the drawer rendered a curated item's grades and axis
// annotations from entry.json alone; the owner's re-ratings at the bench
// lived in jd_ratings / jd_ranks and reached the card only when a session
// copied them into the entry by hand (ROADMAP: "a read path for DB
// ratings"). Now what the bench filed is laid OVER the entry at request
// time, response by response:
//   · grade and every live axis the bench answered replace the entry's
//     (an axis the bench never answered keeps the entry's value; a remark
//     the entry carries on that axis survives unless the bench filed one)
//   · rank rides along as `rank`
//   · the size the bench filed (jd_submissions.size_class) replaces the
//     entry's sizeClass
//   · which response the drawer SHOWS: the bench's 1st place whenever the
//     bench has ranked EVERY served response (owner, 2026-09-05: a re-rank
//     re-points the drawer without a harvest, over any `primary` the entry
//     carries — the pin a harvest wrote was that day's 1st place, and the
//     bench's later word supersedes it, matching the 2026-08-29 "what
//     appears is the re-rated set" rule); else the entry's explicit pin;
//     else the best overlaid grade as before. A harvested rerun set has no
//     generations of its own until the backfill runs, so a partly-ranked
//     item keeps its pin — the legacy-keep exceptions stand.
// The entry stays the permanent record and the harvest scripts keep
// copying into it; this only changes what is SERVED. Same outage
// discipline as the turn block: one try, and a failure serves the files.
$unfiltered = $unfiltered ?? [];
$pinned = $pinned ?? [];
try {
    if (!function_exists('jd_db')) {
        require_once __DIR__ . '/../../api/jd-config.php';
    }
    $cdb = jd_db();
    $cdb->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $cLive = jd_live_axes($taxonomy);

    $subByItem = [];
    foreach ($cdb->query('SELECT id, item_id, size_class FROM jd_submissions WHERE item_id IS NOT NULL') as $row) {
        $subByItem[(string) $row['item_id']] = $row;
    }
    $cgens = [];
    foreach ($cdb->query(
        "SELECT g.id, g.submission_id, g.slot
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL
          ORDER BY g.submission_id, g.slot"
    ) as $g) {
        $cgens[(string) $g['submission_id']][] = $g;
    }
    $cfold = jd_fold_ratings($cdb->query(
        "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.note, r.client, r.taxonomy_version
           FROM jd_ratings r
           JOIN jd_generations g ON g.id = r.generation_id
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL AND r.client = 'bench'
          ORDER BY r.rated_at, r.id"
    )->fetchAll(PDO::FETCH_ASSOC), $cLive);
    $cranks = [];
    try {
        foreach ($cdb->query(
            "SELECT r.generation_id, r.rank_pos
               FROM jd_ranks r
               JOIN jd_submissions s ON s.id = r.submission_id
              WHERE s.item_id IS NOT NULL AND r.client = 'bench'"
        ) as $r) {
            $cranks[(string) $r['generation_id']] = (int) $r['rank_pos'];
        }
    } catch (PDOException $e) { /* no ranks table: no re-pointing */ }

    foreach ($items as $ii => $entry) {
        $id = (string) $entry['id'];
        $sub = $subByItem[$id] ?? null;
        if ($sub === null) {
            continue;   // never backfilled: the entry is all there is
        }
        $genByRid = [];
        foreach (jd_curated_positions($unfiltered[$id] ?? [], $cgens[(string) $sub['id']] ?? []) as $p) {
            $genByRid[$p['rid']] = (string) $p['gen']['id'];
        }
        $allRanked = count($entry['responses']) > 0;
        foreach ($entry['responses'] as $ri => $resp) {
            $gid = $genByRid[(string) ($resp['rid'] ?? '')] ?? null;
            if ($gid === null) {
                $allRanked = false;
                continue;
            }
            $pick = jd_pick_rating($cfold[$gid] ?? [], ['bench']);
            if ($pick['grade'] !== null) {
                $resp['grade'] = $pick['grade'];
            }
            foreach ($pick['axes'] as $axis => $value) {
                $cur = $resp['annotations'][$axis] ?? null;
                $note = $pick['notes'][$axis] ?? (is_array($cur) ? ($cur['note'] ?? null) : null);
                $resp['annotations'][$axis] = ($note !== null && $note !== '')
                    ? ['value' => $value, 'note' => $note]
                    : $value;
            }
            if (isset($cranks[$gid])) {
                $resp['rank'] = $cranks[$gid];
            } else {
                $allRanked = false;
            }
            $entry['responses'][$ri] = $resp;
        }
        if (!empty($sub['size_class'])) {
            $entry['sizeClass'] = (string) $sub['size_class'];
        }
        $first = null;
        if ($allRanked) {
            foreach ($entry['responses'] as $resp) {
                if ((int) ($resp['rank'] ?? 0) === 1) {
                    $first = $resp['rid'];
                    break;
                }
            }
        }
        if ($first !== null) {
            $entry['primary'] = $first;
        } elseif (empty($pinned[$id])) {
            $entry['primary'] = jd_best_graded($entry['responses']);
        }
        $items[$ii] = $entry;
    }
} catch (Throwable $e) {
    error_log('data.php: bench overlay unavailable (' . $e->getMessage() . ')');
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

    $liveAxes = jd_live_axes($taxonomy);
    $curatedPrompts = [];
    foreach ($items as $e) {
        $curatedPrompts[(string) ($e['prompt'] ?? '')] = true;
    }

    // The three ways a turn is held back, read straight off its row: the
    // visitor ticked SUPPRESS (suppressed), the owner scrapped it at the
    // bench (retire_requested_at), or its prompt belongs to a curated item
    // (checked below). title and size_class are the turn's own facts, filed
    // with its ratings.
    $tsubs = $tdb->query(
        "SELECT id, prompt, created, title, size_class
           FROM jd_submissions
          WHERE item_id IS NULL AND status = 'rated'
            AND suppressed = 0 AND retire_requested_at IS NULL
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

        $fold = jd_fold_ratings($tdb->query(
            "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.client, r.taxonomy_version
               FROM jd_ratings r
               JOIN jd_generations g ON g.id = r.generation_id
               JOIN jd_submissions s ON s.id = g.submission_id
              WHERE s.item_id IS NULL AND s.status = 'rated'
              ORDER BY r.rated_at, r.id"
        )->fetchAll(PDO::FETCH_ASSOC), $liveAxes);

        $tranks = [];
        try {
            foreach ($tdb->query(
                "SELECT r.generation_id, r.rank_pos, r.client
                   FROM jd_ranks r
                   JOIN jd_submissions s ON s.id = r.submission_id
                  WHERE s.item_id IS NULL AND s.status = 'rated'"
            )->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $gid = (string) $r['generation_id'];
                // the bench's order outranks the turn's own
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

            // the condition: every surviving drawing graded and answered on
            // every live axis (the bench's answer outranking the turn's own),
            // and the ranking filed when there was more than one
            $responses = []; $ok = true;
            foreach ($gens as $g) {
                $gid = (string) $g['id'];
                $pick = jd_pick_rating($fold[$gid] ?? [], ['bench', '*']);
                if (count($pick['axes']) !== count($liveAxes) || $pick['grade'] === null) { $ok = false; break; }
                $rank = $tranks[$gid] ?? null;
                if (count($gens) > 1 && $rank === null) { $ok = false; break; }
                $responses[] = [
                    'gen_id' => $gid, 'rank' => $rank ?: 1,
                    'model' => (string) $g['model_id'],
                    'model_version' => (string) ($g['model_version'] ?? $g['model_id']),
                    'axes' => $pick['axes'], 'grade' => $pick['grade'],
                    'usage' => $g['usage_tokens'], 'provider' => (string) $g['provider'],
                ];
            }
            if (!$ok || !$responses) { continue; }

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
                $out[] = $row;
            }
            $title = trim((string) ($sub['title'] ?? ''));
            // the id IS the winning drawing's generation, which is also the id
            // the visitor's own browser gave it the moment they won it — so a
            // freshly-won item and the served one are one item, not two
            $turnItems[] = [
                'schema' => 2,
                'id' => $out[0]['gen_id'],
                'submission_id' => $sid,
                'title' => $title !== ''
                    ? $title
                    : (mb_strlen($sub['prompt']) > 42
                        ? mb_substr($sub['prompt'], 0, 41) . '…' : (string) $sub['prompt']),
                'prompt' => (string) $sub['prompt'],
                'created' => substr((string) $sub['created'], 0, 10),
                // the size the visitor chose on the closing card; 'm' is the
                // fallback for turns filed before that card existed
                'sizeClass' => $sub['size_class'] ?: 'm',
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

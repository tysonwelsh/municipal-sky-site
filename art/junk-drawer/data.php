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
$curatedSubs = null;   // every curated submission, read once here (see the overlay)
try {
    require_once __DIR__ . '/../../api/jd-config.php';
    $db = jd_db();
    $dbq = $db->query('SELECT COUNT(*) AS n, MAX(rated_at) AS m FROM jd_ratings')
        ->fetch(PDO::FETCH_ASSOC);
    $dbStamp = ($dbq['n'] ?? '0') . '@' . ($dbq['m'] ?? '');
    // since 2026-09-05 the payload also carries the bench's RANKS and the
    // size the bench filed on a curated item (the overlay below), so those
    // have to move the tag as well — a rank-only refile changed nothing in
    // jd_ratings and would otherwise 304 a stale card back to everyone
    try {
        $dbr = $db->query('SELECT COUNT(*) AS n, MAX(rated_at) AS m FROM jd_ranks')
            ->fetch(PDO::FETCH_ASSOC);
        $dbStamp .= '|' . ($dbr['n'] ?? '0') . '@' . ($dbr['m'] ?? '');
    } catch (Throwable $e) {
        $dbStamp .= '|no-ranks';
    }
    // ONE read of the curated submissions serves the tag here and the
    // overlay's submission-by-item map below: the stamp hashes the rows that
    // carry a size or a hide, in id order, exactly as its own narrower query
    // used to select them (size_class IS NOT NULL OR retire_requested_at IS
    // NOT NULL ... ORDER BY id), so the tag's value does not move
    $curatedSubs = $db->query(
        'SELECT id, item_id, size_class, retire_requested_at
           FROM jd_submissions WHERE item_id IS NOT NULL ORDER BY id'
    )->fetchAll(PDO::FETCH_ASSOC);
    $sizes = '';
    foreach ($curatedSubs as $sz) {
        if ($sz['size_class'] !== null || $sz['retire_requested_at'] !== null) {
            $sizes .= $sz['id'] . '=' . $sz['size_class'] . '/' . $sz['retire_requested_at'] . ',';
        }
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

// the same file ($taxonomyFile, the one JD_TAXONOMY_PATH names), through the
// reader every endpoint uses — jd-config.php is always loaded by the tag block
// above, so the static-cached jd_taxonomy() is there
$taxonomy = jd_taxonomy();
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

/** single-item mode: answer with the first entry whose id is $id and exit; return on a miss */
function jd_answer_item(array $taxonomy, array $items, $id): void
{
    foreach ($items as $entry) {
        if ($entry['id'] === $id) {
            echo json_encode(['taxonomy' => $taxonomy, 'item' => $entry]);
            exit();
        }
    }
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
//   · a curated item the curator HID (retire_requested_at set — SCRAP at
//     the bench, HIDE FROM DRAWER on the admin card) is held back from the
//     manifest like a hidden turn, live, no commit (2026-09-10); it still
//     answers in single-item mode, marked `hidden`, so the admin card can
//     put it back
//   · which response the drawer SHOWS: the 1st place of a FULL ranking —
//     every served response holding a row in jd_ranks — whenever there is
//     one (owner, 2026-09-05: a re-rank re-points the drawer without a
//     harvest, over any `primary` the entry carries — the pin a harvest
//     wrote was that day's 1st place, and the bench's later word supersedes
//     it, matching the 2026-08-29 "what appears is the re-rated set" rule);
//     else the entry's explicit pin; else the best overlaid grade as before.
//     NOTE: this read "the bench's 1st place whenever the bench has ranked
//     EVERY served response", but the code takes a rank from ANY client —
//     per drawing the bench's row wins when there is one, else a seed rank
//     (the harvest's "filed rank N of M") or a visitor's — so an item ranked
//     by a seed or a visitor is re-pointed too. jd-ledger.php's "shows"
//     column counts BENCH ranks only, so the two can disagree on such an
//     item; behaviour left as it is (REFACTOR-PLAN §5, the owner's call). A harvested rerun set has no
//     generations of its own until the backfill runs, so a partly-ranked
//     item keeps its pin — the legacy-keep exceptions stand.
// The entry stays the permanent record and the harvest scripts keep
// copying into it; this only changes what is SERVED. Same outage
// discipline as the turn block: one try, and a failure serves the files.
$unfiltered = $unfiltered ?? [];
$pinned = $pinned ?? [];

// the live axes, for the overlay and the turn block alike
$liveAxes = jd_live_axes($taxonomy);

// jd_ranks, read ONCE for both blocks below (the overlay re-points a curated
// item by it; a turn with more than one drawing qualifies only when its
// ranking is filed): generation id => {pos, client}, the bench's row
// outranking any other client's (jd_rank_by_generation). Its own try: a database without the table (a migration
// that lagged a deploy) re-points nothing and lets no multi-drawing turn in.
// This is the overlay's read as it always was; the turn block used to join
// the same rows to the rated turns, which picks out exactly a turn drawing's
// own rows (every writer files a rank under the drawing's own submission),
// so it reads the same value here. Neither read had an ORDER BY, and still
// none: UNIQUE (submission_id, generation_id) leaves a turn's drawing one row.
$rankByGen = [];
try {
    $rankByGen = jd_rank_by_generation(jd_db()->query(
        "SELECT r.generation_id, r.rank_pos, r.client FROM jd_ranks r"
    ));
} catch (Throwable $e) {
    /* no ranks table — or no database at all (the overlay's own try used to
       swallow a failed jd_db() the same way, as Throwable): no re-pointing,
       no ranked turns; the files still serve */
}

try {
    $db = jd_db();

    // the curated submissions the tag block already read (same columns, same
    // ORDER BY id); read here only when that block could not
    $subByItem = [];
    foreach ($curatedSubs ?? $db->query(
        'SELECT id, item_id, size_class, retire_requested_at
           FROM jd_submissions WHERE item_id IS NOT NULL ORDER BY id'
    ) as $row) {
        $subByItem[(string) $row['item_id']] = $row;
    }
    $cgens = [];
    foreach ($db->query(
        "SELECT g.id, g.submission_id, g.slot
           FROM jd_generations g
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL
          ORDER BY g.submission_id, g.slot"
    ) as $g) {
        $cgens[(string) $g['submission_id']][] = $g;
    }
    $cfold = jd_fold_ratings($db->query(
        "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.note, r.client, r.taxonomy_version
           FROM jd_ratings r
           JOIN jd_generations g ON g.id = r.generation_id
           JOIN jd_submissions s ON s.id = g.submission_id
          WHERE s.item_id IS NOT NULL AND r.client = '" . JD_CLIENT_BENCH . "'
          ORDER BY r.rated_at, r.id"
    )->fetchAll(PDO::FETCH_ASSOC), $liveAxes);
    /* THE RANK FOLLOWS THE GENERATION, not the submission it was filed under
       (owner, 2026-09-17). A rank is filed against a GENERATION — a single
       drawing — and that drawing can move: a visitor's turn on a prompt that
       matches a curated item is a RERUN, and harvesting it hangs its drawings
       on the curated item. The grades came across; the ranking did not, because
       this query asked for rows whose SUBMISSION already carried the item_id,
       and a rerun's submission never does. That is how 281 filed ranks — 163
       of them visitors' — reached exactly nothing in the drawer.
       Keyed on generation_id alone, the join is unnecessary: whichever
       submission a drawing was ranked under, it is the same drawing. The
       bench's order still outranks a turn's, as it does for turns below.
       ($rankByGen, read once above the overlay.) */

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
            $pick = jd_pick_rating($cfold[$gid] ?? [], [JD_CLIENT_BENCH]);
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
            if (isset($rankByGen[$gid])) {
                $resp['rank'] = $rankByGen[$gid]['pos'];
            } else {
                $allRanked = false;
            }
            $entry['responses'][$ri] = $resp;
        }
        if (!empty($sub['size_class'])) {
            $entry['sizeClass'] = (string) $sub['size_class'];
        }
        if (!empty($sub['retire_requested_at'])) {
            $entry['hidden'] = true;
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

// Single-item mode, CURATED ids first: the curated entries lead the merged
// list below, so a match among them is the match the whole list would give —
// answer it before the turn population is built (four queries and a price
// per response; the about page asks for one curated item on every load). A
// miss falls through to the turn block and the search after it, which covers
// the turns and answers the same 404.
if (isset($_GET['item'])) {
    jd_answer_item($taxonomy, $items, $_GET['item']);
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
    // the pricing table, so a turn's card can state what the drawing cost —
    // the same numbers jd-rate's reveal and the report card already use.
    // A slim manifest (?slim=1, no ?item=) drops tokens and cost_usd again
    // (_slim.php), so it skips the pricing; single-item mode always prices.
    require_once __DIR__ . '/../../api/jd-usage.php';
    $priced = !isset($_GET['slim']) || isset($_GET['item']);
    $db = jd_db();

    $curatedPrompts = [];
    foreach ($items as $e) {
        $curatedPrompts[(string) ($e['prompt'] ?? '')] = true;
    }

    // The three ways a turn is held back, read straight off its row: the
    // visitor ticked SUPPRESS (suppressed), the owner scrapped it at the
    // bench (retire_requested_at), or its prompt belongs to a curated item
    // (checked below). title and size_class are the turn's own facts, filed
    // with its ratings.
    $tsubs = $db->query(
        "SELECT id, prompt, created, title, size_class
           FROM jd_submissions
          WHERE item_id IS NULL AND status = '" . JD_SUB_RATED . "'
            AND suppressed = 0 AND retire_requested_at IS NULL
          ORDER BY created DESC"
    )->fetchAll(PDO::FETCH_ASSOC);

    if ($tsubs) {
        $tgens = $db->query(
            "SELECT g.id, g.submission_id, g.slot, g.model_id, g.model_version,
                    g.usage_tokens, g.provider
               FROM jd_generations g
               JOIN jd_submissions s ON s.id = g.submission_id
              WHERE s.item_id IS NULL AND s.status = '" . JD_SUB_RATED . "'
                AND g.status = '" . JD_GEN_OK . "' AND g.svg IS NOT NULL
              ORDER BY g.submission_id, g.slot"
        )->fetchAll(PDO::FETCH_ASSOC);
        $bySub = [];
        foreach ($tgens as $g) { $bySub[(string) $g['submission_id']][] = $g; }

        $fold = jd_fold_ratings($db->query(
            "SELECT r.generation_id, r.kind, r.axis_id, r.value, r.client, r.taxonomy_version
               FROM jd_ratings r
               JOIN jd_generations g ON g.id = r.generation_id
               JOIN jd_submissions s ON s.id = g.submission_id
              WHERE s.item_id IS NULL AND s.status = '" . JD_SUB_RATED . "'
              ORDER BY r.rated_at, r.id"
        )->fetchAll(PDO::FETCH_ASSOC), $liveAxes);

        // the ranks are $rankByGen (read once, above the overlay): the bench's
        // order outranks the turn's own

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
                $pick = jd_pick_rating($fold[$gid] ?? [], [JD_CLIENT_BENCH, '*']);
                if (count($pick['axes']) !== count($liveAxes) || $pick['grade'] === null) { $ok = false; break; }
                $rank = $rankByGen[$gid]['pos'] ?? null;
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
                    /* the placing, carried OUT and not just used on the way
                       (owner, 2026-09-17). The rank has always been read here,
                       required here, and sorted on here — and then dropped,
                       because the ORDER was the whole answer: r1 is first
                       place and nothing downstream had to ask. The thumbnails
                       wear their placing now, so the number itself has to
                       survive the trip. 114 filed placings on 29 turn items
                       reached the drawer as nothing until this line. */
                    'rank' => $r['rank'],
                    'model' => $r['model'],
                    'model_version' => $r['model_version'],
                    'date' => substr((string) $sub['created'], 0, 10),
                    'generation' => ['mode' => 'one-shot', 'prompt_count' => 1],
                    'grade' => $r['grade'],
                    'annotations' => $r['axes'],
                    'url' => '/api/jd-gen-svg.php?gen=' . rawurlencode($r['gen_id']),
                    'transcript_url' => null,
                ];
                if ($priced) {
                    // a key only when there is a number for it (jd-rate's
                    // reveal states the nulls; a drawer item leaves them out)
                    $c = jd_cost_summary(jd_price_generation_row(
                        $r['usage'], $r['provider'], $r['model_version']));
                    if ($c['tokens'] !== null) { $row['tokens'] = $c['tokens']; }
                    if ($c['cost_usd'] !== null) { $row['cost_usd'] = $c['cost_usd']; }
                }
                $out[] = $row;
            }
            // the id IS the winning drawing's generation, which is also the id
            // the visitor's own browser gave it the moment they won it — so a
            // freshly-won item and the served one are one item, not two
            $turnItems[] = [
                'schema' => 2,
                'id' => $out[0]['gen_id'],
                'submission_id' => $sid,
                'title' => jd_turn_title($sub['title'] ?? null, (string) $sub['prompt']),
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

// Single-item mode: ?item=<id> (returns the item even if retired). A curated
// id was answered above the turn block; this finds a turn's.
if (isset($_GET['item'])) {
    jd_answer_item($taxonomy, $items, $_GET['item']);
    http_response_code(404);
    echo json_encode(['error' => 'no such item: ' . $_GET['item']]);
    exit();
}

// Full manifest: retired and hidden items excluded, newest first.
$items = array_values(array_filter($items, function ($e) {
    return empty($e['retired']) && empty($e['hidden']);
}));
usort($items, function ($a, $b) {
    return strcmp($b['created'], $a['created']) ?: strcmp($b['id'], $a['id']);
});

// Slim mode: ?slim=1 — the pile and its tags only (see _slim.php).
if (isset($_GET['slim'])) {
    require_once __DIR__ . '/_slim.php';
    echo json_encode(jd_slim_payload($taxonomy, $items));
    exit();
}

echo json_encode([
    'generated' => gmdate('c'),
    'count' => count($items),
    'taxonomy' => $taxonomy,
    'items' => $items,
    'errors' => $errors,
]);

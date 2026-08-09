<?php
// The Junk Drawer — read-only data endpoint.
// Assembles taxonomy.json + items/*/entry.json into one JSON document at
// request time. There is no committed manifest and no database; committing
// entry files to the repo is the entire publishing act.
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

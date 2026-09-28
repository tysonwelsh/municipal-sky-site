<?php
// _slim.php — the drawer's contents cut down to what the PILE and its SPECIMEN
// TAGS need (2026-09-27, the /about/ walkthrough's live drawer). For each item:
// its id, title, size and dates, and ONE response — the one the drawer shows —
// with only the fields a tag prints (model, grade and rank, date, one-shot or
// refined) and the file to draw. No alternatives, no axis ratings, no notes,
// transcripts, tokens, costs or grade histories: a page that only lets the
// reader dig through the pile has no use for the record behind it, and the
// full payload is several times the size. The taxonomy stays whole — it is
// the rubric, not anyone's ratings, and the tags read their words from it.
//
// Used by data.php (?slim=1) and by local-dev/router.php, which shapes the
// live payload the same way for local work — one definition, so the two
// cannot drift.
function jd_slim_payload(array $taxonomy, array $items): array
{
    $keepItem = array_flip(['id', 'title', 'created', 'sizeClass', 'sizeScale',
                            'fromTurn', 'schema', 'tags']);
    $keepResp = array_flip(['rid', 'model', 'grade', 'rank', 'date',
                            'generation', 'file', 'url']);
    $out = [];
    foreach ($items as $e) {
        $shown = null;
        foreach ($e['responses'] ?? [] as $r) {
            if (($r['rid'] ?? null) === ($e['primary'] ?? null)) { $shown = $r; break; }
        }
        if (!$shown) $shown = $e['responses'][0] ?? null;
        if (!$shown) continue;
        $slim = array_intersect_key($e, $keepItem);
        $resp = array_intersect_key($shown, $keepResp);
        $slim['primary'] = $resp['rid'] ?? ($e['primary'] ?? 'r1');
        $slim['responses'] = [$resp];
        $out[] = $slim;
    }
    return [
        'generated' => gmdate('c'),
        'count' => count($out),
        'slim' => true,
        'taxonomy' => $taxonomy,
        'items' => $out,
        'errors' => [],
    ];
}

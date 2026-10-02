<?php
// GET /api/jd2-gen-svg.php?gen=<generation id> — one drawing's SVG (dataset v2).
//
// v2 keeps no artwork on disk: a drawing is jd2_generations.svg, the
// SANITIZED text as stored — the same bytes the turn drew. data.php points
// every served response here.
//
// Who may see it: anyone, when the drawing's prompt is LIVE (it is in the
// drawer) and the owner has not dropped the drawing from the card; the bench
// key-holder, always (a draft or hidden prompt is the owner's business).
// Anything else answers 404 exactly as a drawing that does not exist would,
// so a draft's ids cannot be probed for. Read-only.
//
// Caching. A PUBLIC answer — the prompt live, the drawing not hidden, and no
// key presented — is `Cache-Control: private, max-age=86400` with a strong
// ETag (md5 of the SVG text) and a 304 on a matching If-None-Match: a drawing
// never changes once filed, and the pile asks for the same few dozen on every
// visit. `private` keeps shared caches out of it; the cost is that a drawing
// hidden later can linger up to a day in a browser that already holds it (the
// drawer stops listing it at once — data.php is no-cache). Every other answer
// (keyed, or a draft/hidden one the key unlocked) stays `no-store`.

require_once __DIR__ . '/jd2-config.php';
require_once __DIR__ . '/jd-origin.php';

jd_require_allowed_origin();
jd_require_get();

$gen = (string) ($_GET['gen'] ?? '');
if (!jd_is_ulid($gen)) {
    jd_fail(400, 'bad_request', 'A generation id is required.');
}

try {
    $db = jd_db();
    $q = $db->prepare(
        "SELECT g.svg, g.hidden, p.visibility
           FROM jd2_generations g
           JOIN jd2_runs r ON r.id = g.run_id
           JOIN jd2_prompts p ON p.id = r.prompt_id
          WHERE g.id = ? AND g.status = '" . JD2_GEN_OK . "'"
    );
    $q->execute([$gen]);
    $row = $q->fetch(PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    error_log('jd2-gen-svg: ' . $e->getMessage());
    jd_fail(500, 'server_error', 'The drawing could not be read.');
}

$onDisplay = $row !== false && $row['visibility'] === JD2_VIS_LIVE && (int) $row['hidden'] === 0;
if ($row === false || !is_string($row['svg']) || $row['svg'] === '' || (!$onDisplay && !jd_bench_keyed())) {
    jd_fail(404, 'not_found', 'No drawing on file for that generation.');
}

// image/svg+xml so an <img> or a fetch both work
$public = $onDisplay && jd_bench_key_supplied() === '';
header('Content-Type: image/svg+xml; charset=utf-8');
header('X-Content-Type-Options: nosniff');
if (!$public) {
    jd_no_store();
    echo $row['svg'];
    exit();
}
$etag = '"' . md5($row['svg']) . '"';
header('Cache-Control: private, max-age=86400');
header('ETag: ' . $etag);
$ifNoneMatch = (string) ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '');
if ($ifNoneMatch !== '') {
    foreach (explode(',', $ifNoneMatch) as $tag) {
        $tag = trim($tag);
        if ($tag === '*' || $tag === $etag) {
            http_response_code(304);
            exit();
        }
    }
}
echo $row['svg'];

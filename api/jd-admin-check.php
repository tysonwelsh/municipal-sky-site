<?php
// GET /api/jd-admin-check.php — "is this key good?" (2026-09-05, admin mode).
//
// The page's admin gate (JD_admin in jd-core.js) verifies a remembered key
// against this before it paints a single write control, so a stale or wrong
// key shows the prompt rather than a string of refused writes. Read-only,
// no-store, and the same gate as every other curator endpoint — including
// the wrong-key throttle, so this is not a free oracle: it costs a miss
// like any other refused request.
//
// Answers { ok:true, build, version, taxonomy_version } when keyed; 403 /
// 429 otherwise, in the standard error shape.

require_once __DIR__ . '/jd-config.php';
require_once __DIR__ . '/jd-origin.php';
require_once __DIR__ . '/jd-build.php';

jd_require_allowed_origin();
jd_no_store();
jd_require_get();
jd_require_bench_key();

$taxonomy = jd_taxonomy();
$stamp = jd_build_stamp();
jd_json_out(200, [
    'ok'               => true,
    'build'            => $stamp['build'],
    'version'          => $stamp['version'] ?? null,
    'taxonomy_version' => is_array($taxonomy) ? jd_taxonomy_version($taxonomy) : null,
]);

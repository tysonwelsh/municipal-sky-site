<?php
// The build stamp for the Junk Drawer's TOOLING — the rating bench, its two
// endpoints, and the benchmark runner.
//
// Same three-part convention the drawer's colophon already uses
// (art/junk-drawer/index.php), for the same reason: a hand-set marker alone is
// not checkable, because it only moves when someone remembers to move it.
//   · version   — art/junk-drawer/VERSION, the readable human marker
//   · build     — md5 of the ACTUAL BYTES of the files below, so it shifts the
//                 instant any of them ships and cannot be forgotten
//   · deployed  — newest mtime of those files, stamped by the server at
//                 upload, so it reads as when the live files actually landed
//
// The file list is the tooling's real surface: change any of them and the
// fingerprint moves. (2026-10-01: the ledger and its endpoint, the census,
// the rerun harvest, the curated sync, the drawing server, this file and the
// version reader joined the list — each had been able to change without
// moving the stamp; at the v2 cutover the retired rating-bench.html and
// jd-bench-run.php left it with their files. Later the same day every v2
// surface joined: the api/jd2-*.php endpoints, data.php, the seven page
// modules, and the shared helpers the v2 writers lean on — the sanitizer,
// the origin gate, the usage pricer and the price table. The v1 files stay
// listed while they are still on disk: the frozen writers answer 410 and the
// readers serve legacy/, and a change to either is still a deploy.) It
// deliberately spans art/ and api/, because "am I running
// the updated code?" is a question about the page AND the endpoints behind it —
// a bench page from the right deploy talking to a stale endpoint is exactly the
// confusion this exists to make impossible.

require_once __DIR__ . '/../art/junk-drawer/_version.php';   // jd_version_marker

function jd_build_files(): array
{
    $root = __DIR__ . '/..';
    return [
        $root . '/art/junk-drawer/ledger.html',
        $root . '/art/junk-drawer/taxonomy.json',
        $root . '/art/junk-drawer/_version.php',
        // dataset v2: the drawer's read, the seven page modules, every jd2 endpoint
        $root . '/art/junk-drawer/data.php',
        $root . '/art/junk-drawer/jd-core.js',
        $root . '/art/junk-drawer/jd-filmstrip.js',
        $root . '/art/junk-drawer/jd-furniture.js',
        $root . '/art/junk-drawer/jd-record.js',
        $root . '/art/junk-drawer/jd-darkroom.js',
        $root . '/art/junk-drawer/jd-turn.js',
        $root . '/art/junk-drawer/jd-bench.js',
        $root . '/api/jd2-config.php',
        $root . '/api/jd2-generate.php',
        $root . '/api/jd2-title.php',
        $root . '/api/jd2-rate.php',
        $root . '/api/jd2-curate.php',
        $root . '/api/jd2-gen-svg.php',
        $root . '/api/jd2-queue.php',
        $root . '/api/jd2-ledger.php',
        $root . '/api/jd2-analytics.php',
        // the shared helpers the v2 writers include
        $root . '/api/jd-svg-sanitizer.php',
        $root . '/api/jd-origin.php',
        $root . '/api/jd-usage.php',
        $root . '/api/jd-prices.json',
        // v1, still on disk: the frozen writers (410) and legacy/'s readers
        $root . '/api/jd-bench-queue.php',
        $root . '/api/jd-item-rate.php',
        $root . '/api/jd-curate.php',
        $root . '/api/jd-admin-check.php',
        $root . '/api/jd-provider.php',
        $root . '/api/jd-config.php',
        $root . '/api/jd-ledger.php',
        $root . '/api/jd-curated-sync.php',
        $root . '/api/jd-inventory.php',
        $root . '/api/jd-harvest.php',
        $root . '/api/jd-gen-svg.php',
        $root . '/api/jd-build.php',
    ];
}

function jd_build_stamp(): array
{
    // once per request: the files cannot change under it
    static $memo = null;
    if ($memo !== null) {
        return $memo;
    }
    // VERSION is an append-only changelog: the NEWEST entry is the LAST line,
    // and its first token is the semver — the prose tail after the em dash is
    // for humans reading git, not for a one-line stamp. (Until 2026-08-28
    // this read the first token of the whole file and reported 0.9.41
    // forever.) The drawer's colophon reads it the same way (_version.php).
    $short = jd_version_marker(__DIR__ . '/../art/junk-drawer/VERSION');

    $hashes = [];
    $mtime  = 0;
    foreach (jd_build_files() as $f) {
        if (is_file($f)) {
            $hashes[] = md5_file($f);
            $m = filemtime($f);
            if ($m > $mtime) {
                $mtime = $m;
            }
        } else {
            // A missing file must CHANGE the fingerprint, not be skipped —
            // otherwise a half-deployed upload could fingerprint as complete.
            $hashes[] = 'missing:' . basename($f);
        }
    }

    // the taxonomy through jd-config's static-cached reader (the same file),
    // not a second read and decode of it
    $taxonomy = jd_taxonomy();
    return $memo = [
        'version'  => $short !== '' ? $short : 'dev',
        'build'    => substr(md5(implode('', $hashes)), 0, 6),
        'deployed' => $mtime ? gmdate('Y-m-d H:i', $mtime) . ' UTC' : '',
        'harness'  => ['web' => jd_harness('web'), 'bench' => jd_harness('bench')],
        'taxonomy' => is_array($taxonomy) ? jd_taxonomy_version($taxonomy) : 0,
    ];
}

/** One line, for the CLI and for anywhere a single string is wanted. */
function jd_build_line(): string
{
    $b = jd_build_stamp();
    return $b['version'] . ' · ' . $b['build']
        . ($b['deployed'] !== '' ? ' · ' . $b['deployed'] : '')
        . ' · taxonomy v' . $b['taxonomy'];
}

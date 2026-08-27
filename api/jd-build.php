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
// fingerprint moves. It deliberately spans art/ and api/, because "am I running
// the updated code?" is a question about the page AND the endpoints behind it —
// a bench page from the right deploy talking to a stale endpoint is exactly the
// confusion this exists to make impossible.

function jd_build_files(): array
{
    $root = __DIR__ . '/..';
    return [
        $root . '/art/junk-drawer/rating-bench.html',
        $root . '/art/junk-drawer/taxonomy.json',
        $root . '/api/jd-bench-queue.php',
        $root . '/api/jd-item-rate.php',
        $root . '/api/jd-bench-run.php',
        $root . '/api/jd-provider.php',
        $root . '/api/jd-config.php',
    ];
}

function jd_build_stamp(): array
{
    $version = trim((string) @file_get_contents(__DIR__ . '/../art/junk-drawer/VERSION'));
    // The VERSION file's first token is the semver; the prose tail after the
    // em dash is for humans reading git, not for a one-line stamp.
    $short = $version !== '' ? preg_split('/\s+—\s+/u', $version)[0] : 'dev';

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

    return [
        'version'  => $short !== '' ? $short : 'dev',
        'build'    => substr(md5(implode('', $hashes)), 0, 6),
        'deployed' => $mtime ? gmdate('Y-m-d H:i', $mtime) . ' UTC' : '',
        'harness'  => ['web' => jd_harness('web'), 'bench' => jd_harness('bench')],
        'taxonomy' => (function () {
            $t = @json_decode((string) @file_get_contents(
                __DIR__ . '/../art/junk-drawer/taxonomy.json'), true);
            return is_array($t) ? (int) ($t['version'] ?? 0) : 0;
        })(),
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

<?php
// _version.php — the readable version marker, read from art/junk-drawer/VERSION.
// Shared by the drawer's colophon (_assets.php) and the tooling build stamp
// (api/jd-build.php), so the two read the changelog the same way. Defines one
// function and prints nothing; it needs nothing else, so _assets.php can load
// it without pulling api/jd-config.php into the page.
//
// VERSION grew from a one-line marker into an append-only changelog, so the
// marker is the NEWEST (last) line's leading semver — the prose tail after the
// em dash is for humans reading git, not for a one-line stamp. 'dev' when the
// file is missing or empty.
function jd_version_marker(string $path)
{
    $lines = preg_split('/\R/', trim((string) @file_get_contents($path)), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $last  = $lines ? (string) end($lines) : '';
    return $last !== '' ? preg_split('/\s+—\s+/u', $last)[0] : 'dev';
}

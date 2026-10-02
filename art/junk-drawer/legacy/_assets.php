<?php
// _assets.php — the drawer's asset list and build stamp, shared by every page
// that mounts the drawer (index.php, about/index.php). Factored out of
// index.php on 2026-09-13 (PLAN-PORTFOLIO §6.2) so the two pages cannot
// drift: ONE list of script files, ONE cache-buster, ONE version/build/
// deploy stamp. Paths are relative to THIS directory (art/junk-drawer/),
// whichever page includes it. A page may set $jd_extra_assets (paths
// relative to this directory) BEFORE requiring this file to fold its own
// markup into the build fingerprint and deploy time; $jd_base (the URL
// prefix the script tags print — '' on the art page, '/art/junk-drawer/'
// from a sub-directory); $jd_page_label (the page_view ping's label).
if (!isset($jd_base)) $jd_base = '';
if (!isset($jd_page_label)) $jd_page_label = null;


// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx). Computed at
// request time so a changed file always ships a fresh URL. Memoised for the
// request: the build stamp below hashes every asset, and the script tags and
// the pages' own <link>/<style> lines ask for the same files again — each
// file is read and hashed once per request, not two or three times.
function jd_v($file)
{
    static $memo = [];
    if (!isset($memo[$file])) {
        $path = __DIR__ . '/' . $file;
        $memo[$file] = file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
    }
    return $memo[$file];
}

// Build/version stamp (printed small at the foot of the notes) — a way to tell at a
// glance whether the page being served is the latest deploy:
//   · VERSION  — a hand-set marker, bumped when the app changes (0.1.0, …)
//   · build    — derived from the ACTUAL bytes of the served assets, so it
//                shifts the instant any JS/CSS/markup ships, with no upkeep
//   · deployed — the newest asset's mtime; the server stamps this at upload,
//                so it reads as the moment the live files landed (UTC)
// turn-object.svg, instructions-object.svg and analytics-folder.svg are in
// this list because they are SERVED ART, not decoration in the stylesheet:
// the Take-a-Turn trigger's, the instructions sheet's and the analytics
// folder's whole appearance, fetched at runtime by jd-furniture.js. Listing
// them means an art-only edit both busts the visitor's cache (the hashes are
// stamped onto the script tag below) and moves the build fingerprint +
// deploy stamp the owner reads in the colophon.
// The script is seven files since 2026-09-26 (one per module — six from
// 2026-09-05, then jd-filmstrip.js; see the file map in CLAUDE.md), loaded
// synchronously in dependency order below. Each carries its own ?v= token;
// all seven move the build fingerprint.
$jd_scripts = ['jd-core.js', 'jd-filmstrip.js', 'jd-furniture.js', 'jd-record.js',
               'jd-darkroom.js', 'jd-turn.js', 'jd-bench.js'];
// LEGACY (2026-10-01): turn-object.svg and instructions-object.svg are not
// copied into the legacy exhibit (neither is mounted), so they leave the list.
$jd_assets  = array_merge(['junk-drawer.css'], $jd_scripts,
              ['analytics-folder.svg', 'index.php']);
// VERSION grew from a one-line marker into an append-only changelog, so the
// stamp reads the NEWEST (last) line and prints only its leading semver —
// the prose tail after the em dash is for humans reading git, not for the
// colophon (which printed the entire changelog until 2026-08-28). The reading
// is _version.php's, shared with the tooling stamp (api/jd-build.php).
require_once __DIR__ . '/_version.php';
$jd_version = jd_version_marker(__DIR__ . '/VERSION');
// The fingerprint and the deploy time cover the asset list plus the page's
// own extras, in that order — computed once, over the merged list.
$jd_stamped = (!empty($jd_extra_assets) && is_array($jd_extra_assets))
    ? array_merge($jd_assets, $jd_extra_assets) : $jd_assets;
$jd_build   = substr(md5(implode('', array_map('jd_v', $jd_stamped))), 0, 6);
$jd_mtime   = 0;
foreach ($jd_stamped as $jd_a) {
    $jd_p = __DIR__ . '/' . $jd_a;
    if (is_file($jd_p)) { $jd_m = filemtime($jd_p); if ($jd_m > $jd_mtime) $jd_mtime = $jd_m; }
}
$jd_deployed = $jd_mtime ? gmdate('Y-m-d H:i', $jd_mtime) . ' UTC' : '';

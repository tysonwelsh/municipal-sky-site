<?php
$page_title = "The Junk Drawer - Municipal Sky";
$page_description = "A drawer of machine-made objects: SVGs drawn by large language models, kept imperfections intact and graded like the model output they are. Dig around.";
// $page_image — Phase 3 ships a painted-drawer share image (PLAN-FRONTEND §6);
// until then the site default OG image serves.

// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx). Computed at
// request time so a changed file always ships a fresh URL.
function jd_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}

// Build/version stamp (printed small in the colophon) — a way to tell at a
// glance whether the page being served is the latest deploy:
//   · VERSION  — a hand-set marker, bumped when the app changes (0.1.0, …)
//   · build    — derived from the ACTUAL bytes of the served assets, so it
//                shifts the instant any JS/CSS/markup ships, with no upkeep
//   · deployed — the newest asset's mtime; the server stamps this at upload,
//                so it reads as the moment the live files landed (UTC)
// turn-object.svg is in this list because it is SERVED ART, not decoration in
// the stylesheet: it is the Take-a-Turn trigger's whole appearance, fetched at
// runtime by junk-drawer.js. Listing it means an art-only edit both busts the
// visitor's cache (the hash is stamped onto the script tag below) and moves
// the build fingerprint + deploy stamp the owner reads in the colophon.
$jd_assets  = ['junk-drawer.css', 'junk-drawer.js', 'turn-object.svg', 'index.php'];
$jd_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$jd_build   = substr(md5(implode('', array_map('jd_v', $jd_assets))), 0, 6);
$jd_mtime   = 0;
foreach ($jd_assets as $jd_a) {
    $jd_p = __DIR__ . '/' . $jd_a;
    if (is_file($jd_p)) { $jd_m = filemtime($jd_p); if ($jd_m > $jd_mtime) $jd_mtime = $jd_m; }
}
$jd_deployed = $jd_mtime ? gmdate('Y-m-d H:i', $jd_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>

<link rel="stylesheet" href="junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />

<div class="main-wrapper">

  <!-- Desktop dek: one line above the drawer. Hidden ≤768px — on a phone
       every explanatory word lives below the drawer (PLAN-MOBILE §3). -->

  <!-- ============ THE DRAWER STAGE (transplanted from Phase 0) ============
       Layer stack, bottom to top: craquelure (the DRAWER's own aging, under
       the items — G2), the pile (its own stacking context), wall shade,
       varnish sheen, vignette. The pile is built by junk-drawer.js from
       data.php; placements arrive from each entry.json (PLAN-BACKEND §7). -->
  <div class="jd-stage" id="drawer">
    <div class="jd-frame">
      <div class="jd-well">
        <div class="jd-pile"></div>
        <div class="jd-wallshade"></div>
      </div>
    </div>

    <div class="jd-craquelure"></div>
    <div class="jd-varnish"></div>
    <div class="jd-vignette"></div>

    <!-- the pull: victorian bail in PLAN VIEW (owner's pick, mockup-5,
         "for now"). The vertical backplate survives as a thin brass strip
         along the outer edge; the bail is a sliver past it; the posts two
         domes. Decorative only (pointer-events: none); overhangs the
         stage's bottom edge, shadow falling to the page floor. Shown at
         every width: on mobile the immersive stage gives back exactly the
         overhang so the hardware still seats on the outer edge and stays
         above the fold (see --jd-pull-drop in junk-drawer.css). -->
    <svg class="jd-pull" viewBox="0 0 300 70" aria-hidden="true">
      <defs>
        <linearGradient id="jdp-strip" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#dcb768"/>
          <stop offset="0.5" stop-color="#b3873a"/>
          <stop offset="1" stop-color="#6e4f1e"/>
        </linearGradient>
        <linearGradient id="jdp-bail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#e0bc6d"/>
          <stop offset="0.55" stop-color="#a87c30"/>
          <stop offset="1" stop-color="#4f3814"/>
        </linearGradient>
        <radialGradient id="jdp-post" cx="0.35" cy="0.32" r="0.85">
          <stop offset="0" stop-color="#f2dc9b"/>
          <stop offset="0.55" stop-color="#c1913c"/>
          <stop offset="1" stop-color="#5c421a"/>
        </radialGradient>
        <filter id="jdp-sh" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4"/>
        </filter>
      </defs>
      <g transform="translate(11,13)" filter="url(#jdp-sh)" opacity="0.38">
        <rect x="40" y="10" width="220" height="3.8" rx="1.5" fill="#1c0e05"/>
        <path d="M 95 20 C 115 32.5, 185 32.5, 205 20" fill="none" stroke="#1c0e05" stroke-width="4" stroke-linecap="round"/>
        <circle cx="95" cy="24" r="7" fill="#1c0e05"/>
        <circle cx="205" cy="24" r="7" fill="#1c0e05"/>
      </g>
      <rect x="40" y="10" width="220" height="3.8" rx="1.5" fill="url(#jdp-strip)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.5"/>
      <line x1="46" y1="11" x2="110" y2="11" stroke="#f0d795" stroke-width="0.8" opacity="0.45"/>
      <path d="M 128 13.6 C 138 16.2, 162 16.2, 172 13.6 Z" fill="url(#jdp-strip)" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <path d="M 95 20 C 115 32.5, 185 32.5, 205 20" fill="none" stroke="url(#jdp-bail)" stroke-width="4" stroke-linecap="round"/>
      <path d="M 96.5 19 C 116 30.5, 184 30.5, 203.5 19" fill="none" stroke="#f4df9e" stroke-width="1" opacity="0.5"/>
      <rect x="91.5" y="13" width="7" height="6" fill="#8a6427" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <rect x="201.5" y="13" width="7" height="6" fill="#8a6427" stroke="#3a280e" stroke-width="0.6" stroke-opacity="0.5"/>
      <circle cx="95" cy="24" r="7" fill="url(#jdp-post)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.55"/>
      <ellipse cx="92.2" cy="21.4" rx="1.9" ry="1.6" fill="#fff6d8" opacity="0.85"/>
      <circle cx="205" cy="24" r="7" fill="url(#jdp-post)" stroke="#3a280e" stroke-width="0.7" stroke-opacity="0.55"/>
      <ellipse cx="202.2" cy="21.4" rx="1.9" ry="1.6" fill="#fff6d8" opacity="0.85"/>
    </svg>

    <!-- TAKE A TURN: the visitor's own commission (PLAN-USER-PROMPTS §4.1).
         NO MARKUP HERE ANY MORE. The corner brass card-holder that used to
         sit on this front band was retired on 2026-08-10: the owner picked
         candidate 8e from the PLAN-TURN-OBJECT mockups, so the trigger is now
         an OBJECT IN THE DRAWER — a doorbell plate injected into .jd-pile by
         junk-drawer.js from turn-object.svg, draggable and scattered like
         every specimen and labelled from JD_STRINGS.turnButton. Nothing about
         the modal it opens changed. -->
  </div>

  <!-- ============ FIELD NOTES ============
       The wall label, intro, taxonomy legend, inventory, and colophon. The
       legend and inventory render from data.php's payload (junk-drawer.js);
       everything else is static copy. -->
  <section class="jd-notes" id="notes">

    <header class="jd-wall-label">
      <h1 class="jd-title">The Junk Drawer</h1>
      <p class="jd-label-dek">A drawer of machine-made objects, graded like model output</p>
      <p class="jd-count" id="jd-count"></p>
    </header>

    <div class="jd-intro">
      <p>Every object in the drawer above is an SVG drawn by a large language
      model &mdash; asked, in plain words, for a skeleton key or a matchbook
      or a pair of scissors, and taken at its word. The drawing arrives as
      code; what lands in the drawer is exactly what the model wrote,
      imperfections intact. Nothing is cleaned up. The imperfections are the
      point.</p>

      <p>Each response is graded the way model output gets graded: an overall
      grade on a five-tier scale, then notes along a few fixed axes &mdash;
      did it draw what was asked, does the geometry hold together, and so on.
      The rubric is data, not prose: the legend below renders from the same
      file the grades are recorded in, so when the taxonomy grows, this page
      follows on its own.</p>

      <p>The collection accumulates. New prompts add objects; old prompts
      collect alternative takes from other models, filed with the original.
      For now the drawer shows each item&rsquo;s best-graded response &mdash;
      the per-item paperwork and the alternatives surface in a later phase.</p>
    </div>

    <section class="jd-legend" aria-label="how to read the grades">
      <h2>How to Read the Grades</h2>
      <div class="jd-grades" id="jd-grades"></div>
      <h3>The Axes</h3>
      <div class="jd-axes" id="jd-axes"></div>
    </section>

    <section class="jd-inventory-block" aria-label="inventory">
      <h2>Inventory</h2>
      <ol class="jd-inventory" id="jd-inventory"></ol>
    </section>

    <section class="jd-colophon" aria-label="colophon">
      <h2>Colophon</h2>
      <p>Flat files in a git repository: one directory per prompt, one SVG
      per response, one JSON file of grades and notes, and a taxonomy the
      whole page renders from. <code>data.php</code> assembles them at
      request time &mdash; no database, no build step; a commit to the
      repository is the entire publishing act.</p>
      <p><a href="/art/" aria-label="the generative art series">the generative art series</a></p>
      <!-- Build stamp: version · content fingerprint · deploy time. A quiet
           way to confirm which build is actually live. -->
      <p class="jd-build" aria-label="build version">
        <?php echo htmlspecialchars($jd_version); ?><span class="jd-build-sep">·</span><?php echo $jd_build; ?><?php if ($jd_deployed): ?><span class="jd-build-sep">·</span><?php echo $jd_deployed; ?><?php endif; ?>
      </p>
    </section>

    <p class="jd-back"><a href="#drawer">THE DRAWER &#8593;</a></p>

  </section>

</div>

<!-- data-jd-turn-object: the content hash of the turn object's artwork. The
     script fetches turn-object.svg at runtime, so its cache-busting token has
     to reach JS from here — there is no <link> or <img> to hang it on. -->
<script src="junk-drawer.js?v=<?php echo jd_v('junk-drawer.js'); ?>"
        data-jd-turn-object="<?php echo jd_v('turn-object.svg'); ?>"></script>

<!-- Anonymous usage tracking: a page view. No personal data leaves the
     browser; the server records only a salted, daily-rotating visitor hash
     for unique-visit counts. The request itself is built by JD_track in
     junk-drawer.js (loaded above, synchronously) so every call on this page
     goes through the one JD_API base — no relative path here may assume the
     page and the API share a directory (APP §4.1). -->
<script>
  if (window.JD_track) JD_track("page_view", null);
</script>

<?php include '../../includes/footer.php'; ?>

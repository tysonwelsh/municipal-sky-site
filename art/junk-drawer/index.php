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
$jd_assets  = ['junk-drawer.css', 'junk-drawer.js', 'index.php'];
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
       varnish sheen, vignette, the manila FIELD NOTES tag. The pile is built
       by junk-drawer.js from data.php; placements arrive from each
       entry.json (PLAN-BACKEND §7). -->
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

    <a class="jd-tag" href="#notes"><svg class="jd-tag-string" viewBox="0 0 44 34" aria-hidden="true"><circle cx="8" cy="6" r="3.4" fill="#8a713c" stroke="#4a3a12" stroke-width="1"/><circle cx="7" cy="5" r="1.2" fill="#d8c288"/><path d="M8 8 C 5 18, 15 25, 30 27" fill="none" stroke="#8a7648" stroke-width="1.6" stroke-linecap="round"/></svg><span class="jd-tag-body">FIELD NOTES &#8595;</span></a>
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
      For now the drawer shows each item&rsquo;s primary response &mdash; the
      per-item paperwork and the alternatives surface in a later phase.</p>
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

<script src="junk-drawer.js?v=<?php echo jd_v('junk-drawer.js'); ?>"></script>

<!-- Anonymous usage tracking: a page view. No personal data leaves the
     browser; the server records only a salted, daily-rotating visitor hash
     for unique-visit counts. Item-open engagement events arrive with the
     specimen card (Phase 3). -->
<script>
  (function () {
    function track(eventType, label) {
      fetch("../../api/page-event-tracking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "junk-drawer", event_type: eventType, label: label || null }),
      }).catch(function () {});
    }
    track("page_view", null);
  })();
</script>

<?php include '../../includes/footer.php'; ?>

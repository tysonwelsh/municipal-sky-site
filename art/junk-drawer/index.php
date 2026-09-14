<?php
$page_title = "The Junk Drawer - Municipal Sky";
$page_description = "A drawer of machine-made objects: SVGs drawn by large language models, kept imperfections intact and graded like the model output they are. Dig around.";
// $page_image — Phase 3 ships a painted-drawer share image (PLAN-FRONTEND §6);
// until then the site default OG image serves.

// The asset list, the cache-buster and the build stamp live in _assets.php
// since 2026-09-13; the drawer stage markup in _stage.php and the script
// tags in _scripts.php. about/index.php mounts the same three, so the
// drawer cannot drift between the art page and its portfolio sub-page
// (PLAN-PORTFOLIO §6.2).
require __DIR__ . '/_assets.php';

include '../../includes/header.php';
?>

<link rel="stylesheet" href="junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />

<div class="main-wrapper">

<?php include __DIR__ . '/_stage.php'; ?>

  <!-- ============ FIELD NOTES ============
       The wall label, a one-paragraph intro, the taxonomy legend, and the
       bare foot (the colophon was pared down 2026-08-28 and removed
       2026-09-10, owner calls — the series link and build stamp remain). The legend renders from
       data.php's payload (junk-drawer.js); everything else is static copy. -->
  <section class="jd-notes" id="notes">

    <header class="jd-wall-label">
      <h1 class="jd-title">The Junk Drawer</h1>
      <p class="jd-label-dek">A drawer of machine-made objects, graded like model output</p>
      <p class="jd-count" id="jd-count"></p>
    </header>

    <div class="jd-intro">
      <p>Every object in the drawer above is an SVG drawn by a large language
      model &mdash; asked, in plain words, for a skeleton key or a matchbook,
      and taken at its word. What lands in the drawer is exactly the code the
      model wrote, imperfections intact, and each response is graded like the
      model output it is: an overall grade on a five-tier scale, then notes
      along the fixed axes below. The rubric is data &mdash; the legend
      renders from the same file the grades are recorded in.</p>
    </div>

    <section class="jd-legend" aria-label="how to read the grades">
      <h2>How to Read the Grades</h2>
      <div class="jd-grades" id="jd-grades"></div>
      <h3>The Axes</h3>
      <div class="jd-axes" id="jd-axes"></div>
    </section>

    <!-- The COLOPHON section and its paragraph went 2026-09-10 (owner call).
         What stays is the bare foot of the notes: the series link and the
         build stamp — version · content fingerprint · deploy time, the quiet
         way to confirm which build is actually live (the same stamp the
         bench strip shows). Same class, so the foot keeps its tailoring. -->
    <footer class="jd-colophon" aria-label="build and series">
      <p><a href="/art/" aria-label="the generative art series">the generative art series</a></p>
      <p class="jd-build" aria-label="build version">
        <?php echo htmlspecialchars($jd_version); ?><span class="jd-build-sep">·</span><?php echo $jd_build; ?><?php if ($jd_deployed): ?><span class="jd-build-sep">·</span><?php echo $jd_deployed; ?><?php endif; ?>
      </p>
    </footer>

    <p class="jd-back"><a href="#drawer">THE DRAWER &#8593;</a></p>

  </section>

</div>

<?php include __DIR__ . '/_scripts.php'; ?>

<?php include '../../includes/footer.php'; ?>

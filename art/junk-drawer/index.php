<?php
$page_title = "The SVG Junk Drawer - Municipal Sky";
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
       2026-09-10, owner calls; the series link and the deploy time went
       2026-09-29 — the version and fingerprint remain). The legend renders from
       data.php's payload (junk-drawer.js); everything else is static copy.
       jd-notes--drawer: this page's notes read in the about page's
       typography (owner, 2026-09-29) — the modifier keeps the change off
       the about page, which shares .jd-notes for its steps. -->
  <section class="jd-notes jd-notes--drawer" id="notes">

    <!-- THE NOTES, SHORT (owner, 2026-09-28): a quick introduction in the
         about page's voice, and the way to it. The grade legend, the axes and
         the item count went: the about page explains the taxonomy with the
         real instrument beside it, so this page only has to say what the
         drawer is and where to learn more. -->
    <header class="jd-wall-label">
      <h1 class="jd-title">The SVG Junk Drawer</h1>
    </header>

    <div class="jd-intro">
      <p>This is the virtual junk drawer where I stash my collection of
      AI-generated vector art.</p>
      <p>Every object in it is an SVG drawn by a large language model. Each
      prompt goes to four leading models at once, and every drawing gets
      graded, without knowing which model made it.</p>
      <p>Dig around: drag things, or tap one to see its tag. Press the blue
      button to give the four models a prompt of your own.</p>
    </div>

    <p class="jd-about-cta"><a href="/art/junk-drawer/about/">Click here to learn
    more about the SVG junk drawer &rarr;</a></p>

    <!-- The COLOPHON section and its paragraph went 2026-09-10 (owner call);
         the "generative art series" link and the deploy date/time went
         2026-09-29 (owner: there is no series, and no timestamp on the
         drawer). What stays is the build stamp — version · content
         fingerprint — the quiet way to confirm which build is actually
         live (the bench strip still shows the deploy time). -->
    <footer class="jd-colophon" aria-label="build">
      <p class="jd-build" aria-label="build version">
        <?php echo htmlspecialchars($jd_version); ?><span class="jd-build-sep">·</span><?php echo $jd_build; ?>
      </p>
    </footer>

    <p class="jd-back"><a href="#drawer">THE DRAWER &#8593;</a></p>

  </section>

</div>

<?php include __DIR__ . '/_scripts.php'; ?>

<?php include '../../includes/footer.php'; ?>

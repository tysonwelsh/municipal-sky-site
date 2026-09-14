<?php
// /art/junk-drawer/about/ — THE JUNK DRAWER, EXPLAINED (PLAN-PORTFOLIO v2,
// 2026-09-13). One more page under the drawer: the drawer exactly as it is
// on the art page (same _stage.php, same six scripts, same stylesheet, same
// data.php) with an explanation column beside it, written in evaluation
// terms for a reader with thirty seconds — first audience, a recruiter.
// Drawer left / explanation right on a desktop; drawer first, notes below,
// on a phone (junk-drawer.css's mobile rules apply unchanged). Layout CSS
// lives in about.css, scoped to .jd-about; nothing here touches the drawer.
//
// PLACEHOLDER COPY: every block marked "PLACEHOLDER n" below is a first
// draft from the build session (sources: README.md, CLAUDE.md,
// taxonomy.json) for the owner to replace with his own words. The rubric
// legend and the counts are NOT copy — they render from data.php, so this
// page and the art page cannot disagree about the rubric or the numbers.
$page_title = "The Junk Drawer, explained - Municipal Sky";
$page_description = "The Junk Drawer read as an evaluation: one prompt to four frontier models, every drawing graded blind on a versioned rubric, the whole record public. The drawer beside its method.";

// this page's own files ride the build stamp too (see _assets.php); the
// script tags need the drawer's directory spelled out from a sub-directory
$jd_extra_assets = ['about/index.php', 'about/about.css', '_stage.php', '_scripts.php'];
$jd_base = '/art/junk-drawer/';
$jd_page_label = 'about';
require __DIR__ . '/../_assets.php';

include __DIR__ . '/../../../includes/header.php';
?>

<link rel="stylesheet" href="/art/junk-drawer/junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />
<link rel="stylesheet" href="about.css?v=<?php echo jd_v('about/about.css'); ?>" />

<div class="main-wrapper jd-about">
  <div class="jd-about-grid">

    <!-- LEFT: the drawer, unchanged. The wrapper is the sticky element on a
         desktop (about.css); on a phone it is inert and the stage fills the
         viewport as on the art page. -->
    <div class="jd-about-drawer">
<?php include __DIR__ . '/../_stage.php'; ?>
    </div>

    <!-- RIGHT: the explanation. Same class as the art page's field notes
         (.jd-notes) so it speaks in the same type; id="notes" so the phone
         layout's page snap and the immersive banner behave as on the art
         page. #jd-count / #jd-grades / #jd-axes are filled by jd-core.js
         from data.php exactly as on the art page. -->
    <section class="jd-notes jd-about-notes" id="notes" aria-label="how the drawer works">

      <header class="jd-wall-label">
        <h1 class="jd-title">The Junk Drawer</h1>
        <p class="jd-label-dek">A running evaluation of how language models draw</p>
        <p class="jd-count" id="jd-count"></p>
        <p class="jd-count jd-about-tally" id="jd-about-tally"></p>
      </header>

      <!-- PLACEHOLDER 1 · WHAT THIS IS (owner copy replaces this block) -->
      <div class="jd-intro">
        <p>Every object in the drawer is an SVG drawn by a large language
        model, asked in plain words for a skeleton key or a matchbook and
        taken at its word. The drawer is a painting of a benchmark: one
        prompt, given verbatim to four frontier models from four vendors, one
        drawing each; every drawing filed exactly as the model wrote it,
        imperfections intact, and graded blind on a versioned rubric. The
        prompt, the model and version, the grade, the notes on each axis, the
        token count and the cost sit on every drawing&rsquo;s report card.
        Tap any object to read one.</p>
      </div>

      <!-- PLACEHOLDER 2 · HOW IT WORKS (owner copy replaces this block) -->
      <h2>How It Works</h2>
      <ol class="jd-about-steps">
        <li><b>Prompt.</b> A plain-language request for an object, written by
        the author or by a visitor, kept verbatim: no trimming, no fixing
        typos.</li>
        <li><b>Generation.</b> Four models each draw it as SVG code in a
        single pass. The code is sanitized for safety and otherwise filed byte
        for byte; nothing is cleaned up.</li>
        <li><b>Blind grading.</b> Each drawing gets an overall grade on the
        five-tier scale and a rating on each live axis, with the model&rsquo;s
        name withheld until the grades are filed. A turn ends by ranking the
        four.</li>
        <li><b>Record.</b> Prompt, model, grades, rank, tokens and cost go on
        the report card. Visitor ratings are stored in evaluation tables,
        separately from the author&rsquo;s, and export as JSONL.</li>
      </ol>
      <p>You can run one yourself: press PUSH 4 MORE JUNK in the drawer,
      describe an object, and grade what comes back. The analytics folder in
      the pile holds the running numbers: spend, grade distribution and axis
      profile per model.</p>

      <!-- THE RUBRIC: rendered from taxonomy.json via data.php (jd-core.js),
           as the art page's legend is. Only the lead-in is copy. -->
      <section class="jd-legend" aria-label="the rubric">
        <h2>The Rubric</h2>
        <!-- PLACEHOLDER 3 · lead-in only; the legend itself is data -->
        <p>Five grade tiers, then four axes that name where a drawing went
        wrong. The legend renders from the same file the grades are recorded
        in, so the rubric on this page is the rubric in force.</p>
        <div class="jd-grades" id="jd-grades"></div>
        <h3>The Axes</h3>
        <div class="jd-axes" id="jd-axes"></div>
      </section>

      <!-- PLACEHOLDER 4 · HOW GRADING WORKS (owner copy replaces this block) -->
      <h2>How Grading Works</h2>
      <p>The author grades the collection, blind to which model drew what.
      The rubric is versioned<span id="jd-about-taxver"></span>: when an axis
      is retired, drawings graded under it keep that grade on their record
      rather than being re-scored, so an old grade means what it meant when
      it was filed. A drawing re-run under the current rubric replaces the
      old set in the drawer, and the old set stays on the record. Visitor
      ratings from turns are kept apart from the author&rsquo;s and never
      overwrite them.</p>

      <!-- PLACEHOLDER 5 · WHY IT EXISTS (owner copy replaces this block) -->
      <h2>Why It Exists</h2>
      <p>The evaluation programs I run professionally are under NDA. This is
      the same craft on a subject I can show in full: writing the instrument,
      defining the rubric, grading blind, keeping the record honest, and
      presenting the result so it reads in one pass. It was built with AI
      coding tools; the design, the rubric, the grades and the verification
      are mine.</p>

      <!-- PLACEHOLDER 6 · LIMITATIONS (owner copy replaces this block) -->
      <h2>Limitations</h2>
      <p>One rater. A small visitor sample. Drawing SVGs is one narrow
      capability, not a measure of a model. The point is the method, not the
      leaderboard.</p>

      <footer class="jd-colophon" aria-label="build and series">
        <p><a href="/art/junk-drawer/">the drawer on its own page</a><span class="jd-about-sep">·</span><a href="/art/" aria-label="the generative art series">the generative art series</a></p>
        <p class="jd-build" aria-label="build version">
          <?php echo htmlspecialchars($jd_version); ?><span class="jd-build-sep">·</span><?php echo $jd_build; ?><?php if ($jd_deployed): ?><span class="jd-build-sep">·</span><?php echo $jd_deployed; ?><?php endif; ?>
        </p>
      </footer>

      <p class="jd-back"><a href="#drawer">THE DRAWER &#8593;</a></p>

    </section>

  </div>
</div>

<?php include __DIR__ . '/../_scripts.php'; ?>

<!-- The tally line and the rubric version, from the same payload the drawer
     loads. jd-core.js keeps its copy private, so this is a second, cheap
     read of data.php; it derives the numbers rather than hand-typing them
     (PLAN-PORTFOLIO §3.1 — the art page's typed counter drifted). Nothing
     here is computed anywhere else on the page. -->
<script>
  (function () {
    var tally = document.getElementById('jd-about-tally');
    var ver = document.getElementById('jd-about-taxver');
    if (!tally && !ver) return;
    fetch((window.JD_API || '') + '/art/junk-drawer/data.php')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data) return;
        var drawings = 0, models = {};
        (data.items || []).forEach(function (item) {
          (item.responses || []).forEach(function (res) {
            drawings += 1;
            if (res.model) models[res.model] = true;
          });
        });
        var n = Object.keys(models).length;
        if (tally && drawings) {
          tally.textContent = drawings + (drawings === 1 ? ' drawing' : ' drawings') +
            ' · ' + n + (n === 1 ? ' model' : ' models');
        }
        var v = data.taxonomy && data.taxonomy.version;
        if (ver && v) ver.textContent = ' (this is v' + v + ')';
      })
      .catch(function () {});
  })();
</script>

<?php include __DIR__ . '/../../../includes/footer.php'; ?>

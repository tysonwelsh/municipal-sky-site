<?php
// /art/junk-drawer/about/ — THE JUNK DRAWER, EXPLAINED (PLAN-PORTFOLIO v3,
// 2026-09-14). A sticky-graphic scrollytelling walkthrough: one pinned visual
// pane holding four scenes — the live drawer, the real turn card, the real
// report card, the real analytics folder — and eighteen steps of prose
// beside it. about-scenes.js switches the pane as each step arrives;
// about.css places the columns and flows the three modal cards inline.
//
// Nothing on this page is a screenshot. Every scene is the production app
// with its network sealed, so the walkthrough cannot drift from the thing it
// describes.
//
// COPY IS SCAFFOLDING. Every step below is a first draft for the owner to
// rewrite; build to the structure, not to the sentences. The taxonomy legend
// and every number ARE NOT copy — they render from data.php.
//
// House rules for this page (owner, 2026-09-14): no employer is named, here
// or anywhere on the site; the word is "taxonomy", never "rubric"; and no
// past versions of the taxonomy are shown — only the one in force.
$page_title = "The Junk Drawer, explained - Municipal Sky";
$page_description = "A running evaluation of how language models draw: one prompt to four frontier models, every drawing graded blind on a versioned taxonomy, the whole record public. Walk through the instrument, the record and the analysis.";

$jd_extra_assets = ['about/index.php', 'about/about.css', 'about/about-scenes.js', '_stage.php', '_scripts.php'];
$jd_base = '/art/junk-drawer/';
$jd_page_label = 'about';
require __DIR__ . '/../_assets.php';

include __DIR__ . '/../../../includes/header.php';
?>

<link rel="stylesheet" href="/art/junk-drawer/junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />
<link rel="stylesheet" href="about.css?v=<?php echo jd_v('about/about.css'); ?>" />

<script>
/* ---- DEMO MODE: the seal ---------------------------------------------------
   Scene 2 hands the visitor the REAL rating instrument. Nothing they do in it
   may reach the database. Every network call in the six drawer modules goes
   through window.fetch — verified: no sendBeacon, no XMLHttpRequest, no image
   pings — so wrapping fetch here, BEFORE those modules load, is a complete
   seal rather than a partial one.

   Reads pass through (data.php, the .svg files). Writes are swallowed and
   answered with a plausible success so the card behaves exactly as it would
   in production. The one exception is the page-view ping, which is the site's
   own anonymous traffic count and is not something the visitor "enters" — it
   is allowed through so this page's analytics keep working. Every other
   tracking event from this page is dropped.
   ------------------------------------------------------------------------- */
(function () {
  document.documentElement.classList.add('jd-about-page');
  var BLOCK = ['/api/jd-generate.php', '/api/jd-rate.php', '/api/jd-title.php',
               '/api/jd-item-rate.php', '/api/jd-curate.php'];
  var TRACK = '/api/page-event-tracking.php';
  var orig = window.fetch ? window.fetch.bind(window) : null;
  if (!orig) return;
  function ok(body) {
    return Promise.resolve({
      ok: true, status: 200,
      json: function () { return Promise.resolve(body || { ok: true }); },
      text: function () { return Promise.resolve(JSON.stringify(body || { ok: true })); }
    });
  }
  window.fetch = function (u, o) {
    var url = String(u && u.url ? u.url : u);
    for (var i = 0; i < BLOCK.length; i++) {
      if (url.indexOf(BLOCK[i]) >= 0) return ok({ ok: true, demo: true });
    }
    if (url.indexOf(TRACK) >= 0) {
      var t = '';
      try { t = JSON.parse((o && o.body) || '{}').event_type || ''; } catch (e) {}
      if (t !== 'page_view') return ok({ ok: true, demo: true });
    }
    return orig(u, o);
  };
})();
</script>

<div class="main-wrapper jd-about">
  <div class="jd-about-grid">

    <!-- THE PINNED PANE: four scenes, one visible at a time. The drawer is in
         the markup (it is the opening shot and must paint without JS); the
         other three are empty hosts that their own modules mount into. -->
    <div class="jd-about-pane" id="jd-about-pane">
      <div class="jd-scene is-on" data-scene-pane="drawer">
<?php include __DIR__ . '/../_stage.php'; ?>
      </div>
      <div class="jd-scene" data-scene-pane="instrument" aria-label="the rating instrument, in demo"></div>
      <div class="jd-scene" data-scene-pane="record" aria-label="a report card"></div>
      <div class="jd-scene" data-scene-pane="analytics" data-fx="grades" aria-label="the analytics folder"></div>
    </div>

    <!-- THE STEPS -->
    <section class="jd-notes jd-about-notes" id="notes" aria-label="how the drawer works">

      <header class="jd-wall-label">
        <h1 class="jd-title">The Junk Drawer</h1>
        <p class="jd-label-dek">A running evaluation of how language models draw</p>
      </header>

      <!-- ============================ SCENE 1 ============================ -->
      <div class="jd-step" data-scene="drawer" data-step="hook">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>Everything here was drawn by a machine</h2>
        <p>Every object in the drawer is an SVG a large language model drew,
        asked in plain words for a skeleton key or a matchbook and taken at
        its word. The code is filed exactly as the model wrote it &mdash;
        imperfections intact, nothing cleaned up.</p>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="premise">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>One prompt, four models</h2>
        <p>Each prompt goes verbatim to four frontier models from four
        vendors. One drawing each, graded blind on a fixed taxonomy. The
        drawer is a painting of a benchmark.</p>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="graded">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>Every one of them is graded</h2>
        <p>Pick anything out of the pile and it arrives with a tag: what it
        is, and how it scored. Behind that tag is a full record &mdash; the
        prompt, the model, every axis, what it cost. We will open one shortly.</p>
      </div>

      <!-- ============================ SCENE 2 ============================ -->
      <div class="jd-step" data-scene="instrument" data-step="try">
        <p class="jd-step-eyebrow">The instrument</p>
        <h2>This is the instrument. Try it.</h2>
        <p>Four drawings of the same prompt, dealt blind &mdash; the models'
        names are withheld until the grades are filed, so nothing is scored on
        reputation. Rate them on each axis, then rank them. It is the real
        thing, wired exactly as a visitor gets it.</p>
        <p class="jd-demo-note"><b>This is a demo.</b> Nothing you enter here
        is recorded. Every rating you file stays in your browser.</p>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="taxonomy">
        <p class="jd-step-eyebrow">The instrument</p>
        <h2>The taxonomy</h2>
        <p>Five grade tiers, then four axes that name <em>where</em> a drawing
        went wrong. An axis exists to separate a kind of failure from every
        other kind, so that a low score says something specific. This legend
        renders from the same file the grades are recorded against, so the
        page and the instrument cannot disagree.</p>
        <section class="jd-legend" aria-label="the taxonomy">
          <div class="jd-grades" id="jd-grades"></div>
          <h3>The Axes</h3>
          <div class="jd-axes" id="jd-axes"></div>
        </section>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="claude-fable-5">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 1</p>
        <h2>What &ldquo;no problems&rdquo; looks like</h2>
        <p>Start with the anchor. Parts attach, the stacking reads as
        intended, and it has style. Top marks on every axis &mdash; which is
        what makes it useful: it calibrates the other three.</p>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="kimi-k3">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 2</p>
        <h2>A failure you cannot see &mdash; press REPLAY</h2>
        <p>This one looks thin and a little bare, and it is easy to call it
        simply worse. Press <b>REPLAY</b> and watch it draw: the leaves are
        rendered <em>correctly</em>, in full &mdash; and then the pot is drawn
        on top of them. Nothing is malformed. The parts are stacked in the
        wrong order.</p>
        <p>That is one axis, Layering, doing its whole job: naming a defect
        the still image hides. Structure is sound, the brief is understood,
        and it still fails &mdash; on exactly one thing.</p>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="gemini-3-1-pro">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 3</p>
        <h2>A different axis, a different diagnosis</h2>
        <p>Here the stacking is fine and the problem is the object itself: the
        leaves float free of the pot, attached to nothing. You could not fix
        this by reordering anything &mdash; it needs the parts moved. Same
        taxonomy, different axis, and the score lands somewhere else.</p>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="gpt-5-1">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 4</p>
        <h2>The axes describe. They do not decide.</h2>
        <p>This drawing scores <em>identically</em> to the last one on all
        four axes &mdash; and takes a lower overall grade. That is deliberate.
        The grade is a judgment about the whole drawing, not the sum of its
        axes, and the taxonomy says so out loud: the last axis invites the
        rater's own taste rather than pretending it isn't there.</p>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="ranking">
        <p class="jd-step-eyebrow">The instrument &middot; the call</p>
        <h2>Then they stop being four judgments</h2>
        <p>The last station is the podium: the four drawings come off the
        bench and stand in order, best to worst. Scoring each one alone
        answers &ldquo;how good is this?&rdquo;; the ranking answers the
        question the drawer is actually built on &mdash; <em>which of these
        four did the job?</em> &mdash; and it is the only judgment a rater
        cannot make one drawing at a time.</p>
        <p class="jd-demo-note">The order shown here is <b>derived from the
        filed grades</b>, not read from a filed ranking: nobody ever ranked
        this specimen. Everything else on this page comes straight out of the
        record.</p>
      </div>

      <!-- ============================ SCENE 3 ============================ -->
      <div class="jd-step" data-scene="record" data-step="record">
        <p class="jd-step-eyebrow">The record</p>
        <h2>Every judgment becomes a record</h2>
        <p>This is the report card behind the tag from earlier. The prompt
        verbatim, the model and its version, the grade, every axis, where it
        ranked against its siblings. Press an axis name and its definition
        unfolds &mdash; the same definition the instrument showed you.</p>
      </div>

      <div class="jd-step" data-scene="record" data-step="cost">
        <p class="jd-step-eyebrow">The record</p>
        <h2>What it cost to collect</h2>
        <p>Tokens in, tokens out, and the price of the call, per drawing.
        Evaluation data has a unit cost, and a programme that does not track
        it cannot be planned.</p>
      </div>

      <div class="jd-step" data-scene="record" data-step="stack">
        <p class="jd-step-eyebrow">The record</p>
        <h2>It is a real application, front to back</h2>
        <p>Ratings are rows in a SQL database, not files: a schema for
        submissions, generations, ratings and ranks, written through
        authenticated endpoints and read back by the pages you have been
        scrolling through. The front end, the back end, the schema and the
        taxonomy are all mine.</p>
      </div>

      <div class="jd-step" data-scene="record" data-step="populations">
        <p class="jd-step-eyebrow">The record</p>
        <h2>Two populations, never mixed</h2>
        <p>My own ratings and visitors' ratings are stored separately and
        neither overwrites the other, so the reference set stays clean while
        the crowd set grows beside it. Both export as JSONL.</p>
      </div>

      <!-- ============================ SCENE 4 ============================
           Three cards, one per step (owner, 2026-09-15): the overall grade,
           then what the drawings cost, then the four axes as a two-by-two.
           The folder's turn-by-turn table is left off this page. Each step's
           data-fx names the card the pane shows; about-scenes.js sets it on
           the scene host and about.css shows that card alone. -->
      <div class="jd-step" data-scene="analytics" data-step="grades" data-fx="grades">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>Now all of it at once: where the grades fall</h2>
        <p>Every drawing, every model, counted live from the same records you
        just looked at. The distribution of overall grades across the whole
        collection, and per model &mdash; the first thing the data actually
        says. Nothing on this page is typed in by hand.</p>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="spend" data-fx="cost">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>What the drawings cost</h2>
        <p>Spend per model, priced from each call&rsquo;s own token counts
        rather than estimated. A collection programme has a unit cost, and
        one that does not track it cannot be planned or defended.</p>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="multiples" data-fx="axes">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>Four axes, four rulers</h2>
        <p>The axis panels are small multiples: identical geometry, so the eye
        can compare them directly. What they deliberately do <em>not</em> do
        is share a scale. A three-point axis and a four-point axis are
        different rulers, and stretching them onto one would invent a
        comparison the data cannot support.</p>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="limits" data-fx="axes">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>What this does not show</h2>
        <p>One rater. A small visitor sample. Drawing SVGs is one narrow
        capability and not a measure of a model. The point is the method
        &mdash; the taxonomy, the instrument, the record, the analysis &mdash;
        not the leaderboard.</p>
      </div>

      <!-- outro -->
      <footer class="jd-colophon" aria-label="build and series">
        <p><a href="/art/junk-drawer/">the drawer on its own page</a><span class="jd-about-sep">&middot;</span><a href="/art/" aria-label="the generative art series">the generative art series</a></p>
        <p class="jd-build" aria-label="build version">
          <?php echo htmlspecialchars($jd_version); ?><span class="jd-build-sep">&middot;</span><?php echo $jd_build; ?><?php if ($jd_deployed): ?><span class="jd-build-sep">&middot;</span><?php echo $jd_deployed; ?><?php endif; ?>
        </p>
      </footer>

      <p class="jd-back"><a href="#drawer">THE DRAWER &#8593;</a></p>

    </section>

    <!-- THE TIMELINE. A station per step, grouped by scene: it says the page
         is scrollable before anyone has scrolled, shows how far along the
         reader is, and takes them back to any earlier moment. Built and kept
         in sync by about-scenes.js from the steps themselves, so it can never
         disagree with them. Empty (and hidden) without JS. -->
    <nav class="jd-timeline" id="jd-timeline" aria-label="walkthrough progress"></nav>

  </div>
</div>

<?php include __DIR__ . '/../_scripts.php'; ?>
<script src="about-scenes.js?v=<?php echo jd_v('about/about-scenes.js'); ?>"></script>

<?php include __DIR__ . '/../../../includes/footer.php'; ?>

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

<?php
  // Type exploration (owner, 2026-09-23): ?type=a|b|c picks a heading treatment
  // for the step column; see about.css "THE STEP TYPE". Default is a.
  $jd_type = isset($_GET['type']) && preg_match('/^[abc]$/', $_GET['type']) ? $_GET['type'] : 'a';
?>
<div class="main-wrapper jd-about" data-type="<?php echo $jd_type; ?>">
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

      <!-- wall label (h1 + dek) removed 2026-09-23 (owner): the first step
           introduces the page in first person; a museum label above it read
           as a second, colder opening. -->

      <!-- ============================ SCENE 1 ============================ -->
      <div class="jd-step" data-scene="drawer" data-step="hook">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>A junk drawer, and a benchmark</h2>
        <p>This is the virtual junk drawer where I stash my collection of
        AI-generated vector art. It is also where I&rsquo;m building my own
        personal benchmark for evaluating how well different LLMs generate
        SVG images. You can dig around in it right now, or keep scrolling to
        learn more.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="premise">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>One prompt, four models, one shot each</h2>
        <p>Here is how it works. I write a prompt and send it, word for word,
        to four frontier models from four different companies. Each one gets
        a single try. Whatever comes back goes into the drawer exactly as the
        model wrote it, imperfections and all, and I grade it without knowing
        which model drew it.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="graded">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The drawer</p>
        <h2>Every object has a grade</h2>
        <p>Tap anything in the pile and it comes with a tag that tells you
        what it is and how it scored. Behind the tag is a full record: the
        prompt, the model, the score on every axis, and what the drawing cost
        to generate. I&rsquo;ll open one of those records a little further
        down.</p>
        </div>
      </div>

      <!-- ============================ SCENE 2 ============================ -->
      <div class="jd-step" data-scene="instrument" data-step="try">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument</p>
        <h2>This is the grading instrument. Try it.</h2>
        <p>These are four drawings of the same prompt. The models&rsquo; names
        are hidden until the grades are filed, so nothing gets scored on
        reputation. Rate each drawing on each axis, then rank the four. This
        is the real instrument, wired exactly the way a visitor to the drawer
        gets it.</p>
        <p class="jd-demo-note"><b>This is a demo.</b> Nothing you enter here
        is recorded. Every rating you file stays in your browser.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="taxonomy">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument</p>
        <h2>The taxonomy</h2>
        <p>I grade on five overall tiers and four axes. The tiers say how good
        a drawing is; the axes say <em>where</em> it went wrong. I designed
        each axis to isolate one kind of failure from every other kind, so a
        low score always means something specific. The legend below renders
        from the same file the grades are recorded in, so this page and the
        instrument can never disagree.</p>
        <section class="jd-legend" aria-label="the taxonomy">
          <div class="jd-grades" id="jd-grades"></div>
          <h3>The Axes</h3>
          <div class="jd-axes" id="jd-axes"></div>
        </section>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="claude-fable-5">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 1</p>
        <h2>What &ldquo;no problems&rdquo; looks like</h2>
        <p>Start with the best of the four. The parts attach where they
        should, the layers stack the way the artist intended, and it has some
        style. Top marks on every axis. That is what makes it useful here: it
        sets the standard the other three get measured against.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="kimi-k3">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 2</p>
        <h2>A failure you cannot see. Press REPLAY.</h2>
        <p>This one looks thin and a little bare, and it would be easy to call
        it simply worse. Press <b>REPLAY</b> and watch it draw. The leaves are
        rendered <em>correctly</em> and in full, and then the pot is drawn on
        top of them. Nothing is malformed. The parts are just stacked in the
        wrong order.</p>
        <p>That is one axis, Layering, doing exactly the job I built it for:
        naming a defect the still image hides. The structure is sound and the
        model understood the brief, and it still fails on one specific
        thing.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="gemini-3-1-pro">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 3</p>
        <h2>A different axis, a different diagnosis</h2>
        <p>Here the stacking is fine and the problem is the object itself. The
        leaves float free of the pot, attached to nothing. You could not fix
        this by reordering the layers; the parts themselves would have to
        move. Same taxonomy, different axis, and the score lands in a
        different place.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="gpt-5-1">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument &middot; specimen 4</p>
        <h2>The axes describe. They do not decide.</h2>
        <p>This drawing scores <em>identically</em> to the last one on all
        four axes, and I gave it a lower overall grade. That is deliberate.
        The grade is a judgment about the whole drawing, not a sum of the
        axes, and the taxonomy says so out loud: the last axis makes room for
        the rater&rsquo;s own taste instead of pretending it isn&rsquo;t
        there.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="ranking">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The instrument &middot; the call</p>
        <h2>Then the four get ranked</h2>
        <p>The last step is the podium. The four drawings line up from best
        to worst. Scoring each one on its own answers &ldquo;how good is
        this?&rdquo; The ranking answers the question the whole drawer is
        built on: <em>which of these four actually did the job?</em> It is
        the one judgment you cannot make one drawing at a time.</p>
        <p class="jd-demo-note">The order shown here is <b>derived from the
        filed grades</b>, not read from a filed ranking: nobody ever ranked
        this specimen. Everything else on this page comes straight out of the
        record.</p>
        </div>
      </div>

      <!-- ============================ SCENE 3 ============================ -->
      <div class="jd-step" data-scene="record" data-step="record">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The record</p>
        <h2>Every judgment becomes a record</h2>
        <p>This is the report card behind the tag from earlier. The prompt,
        word for word. The model and its exact version. The overall grade,
        the score on every axis, and where it ranked against the other three.
        Press an axis name and its definition unfolds, the same definition
        the instrument showed you.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="cost">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The record</p>
        <h2>What it cost to collect</h2>
        <p>Tokens in, tokens out, and the price of the API call, recorded for
        every drawing. Evaluation data has a unit cost. In my day job I plan
        collection programs around that number, so I track it here too.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="stack">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The record</p>
        <h2>It is a real application, front to back</h2>
        <p>The ratings are rows in a SQL database, not files. There is a
        schema for submissions, generations, ratings, and ranks, written
        through authenticated endpoints and read back by the pages you are
        scrolling through now. I built the front end, the back end, the
        schema, and the taxonomy myself, working with Claude Code.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="populations">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The record</p>
        <h2>Two sets of ratings, never mixed</h2>
        <p>My own ratings and visitors&rsquo; ratings are stored separately,
        and neither can overwrite the other. That keeps my reference set
        clean while the crowd&rsquo;s set grows beside it. Both export as
        JSONL for analysis.</p>
        </div>
      </div>

      <!-- ============================ SCENE 4 ============================
           Three cards, one per step (owner, 2026-09-15): the overall grade,
           then what the drawings cost, then the four axes as a two-by-two.
           The folder's turn-by-turn table is left off this page. Each step's
           data-fx names the card the pane shows; about-scenes.js sets it on
           the scene host and about.css shows that card alone. -->
      <div class="jd-step" data-scene="analytics" data-step="grades" data-fx="grades">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>Now all of it at once: where the grades fall</h2>
        <p>Every drawing and every model, counted live from the same records
        you just looked at. This is the distribution of overall grades across
        the whole collection and for each model, which is the first thing the
        data has to say. None of these numbers are typed in by hand.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="spend" data-fx="cost">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>What the drawings cost</h2>
        <p>Spend per model, priced from each call&rsquo;s own token counts
        rather than estimated. Some models draw better than others, and some cost
        a good deal more per drawing. Both facts belong in the same
        chart.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="multiples" data-fx="axes">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>Four axes, four rulers</h2>
        <p>The axis panels are small multiples: the same shape, so your eye
        can compare them directly. What they deliberately do <em>not</em> do
        is share a scale. A three-point axis and a four-point axis are
        different rulers, and stretching them onto one would invent a
        comparison the data cannot support.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="limits" data-fx="axes">
        <div class="jd-step-body">
        <p class="jd-step-eyebrow">The analysis</p>
        <h2>What this does not show</h2>
        <p>One rater, mostly me. A small visitor sample. Drawing SVGs is one
        narrow skill, not a measure of a model. The point of this project is
        the method: the taxonomy, the instrument, the record, and the
        analysis. The leaderboard is a side effect.</p>
        </div>
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

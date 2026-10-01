<?php
// /art/junk-drawer/about/ — THE JUNK DRAWER, EXPLAINED (PLAN-PORTFOLIO v3,
// 2026-09-14). A sticky-graphic scrollytelling walkthrough: one pinned visual
// pane holding four scenes — the drawer, the real turn card, the real report
// card, and the analysis (the charts and the records table about-scenes.js
// draws from the analytics folder's own endpoint; the folder itself has not
// been mounted here since 2026-09-27) — and sixteen steps of prose beside
// it. about-scenes.js switches the pane as each step arrives; about.css
// places the columns and flows the two modal cards inline. On a phone each
// scene's graphic stands above its own steps instead (about.css, THE PHONE).
//
// Nothing here is a mock-up: the cards are the production app with its
// network sealed, so the walkthrough cannot drift from the thing it
// describes. The one picture is scene 1's pile — a capture of the real
// drawer, with the live specimen on top of it (THE POSTER, below); ?live
// brings the whole live pile back.
//
// COPY IS SCAFFOLDING. Every step below is a first draft for the owner to
// rewrite; build to the structure, not to the sentences. The taxonomy legend
// and every number ARE NOT copy — they render from data.php.
//
// House rules for this page (owner, 2026-09-14): no employer is named, here
// or anywhere on the site; the word is "taxonomy", never "rubric"; and no
// past versions of the taxonomy are shown — only the one in force.
$page_title = "The SVG Junk Drawer, explained - Municipal Sky";
$page_description = "A running evaluation of how language models draw: one prompt to four frontier models, every drawing graded blind on a versioned taxonomy, the whole record public. Walk through the instrument, the record and the analysis.";

$jd_base = '/art/junk-drawer/';
$jd_page_label = 'about';

// THE POSTER (owner, 2026-09-26). Scene 1 used to mount the whole pile — every
// drawing live, each with its own drop-shadow, pinned in a pane the page
// scrolls past — and it lagged. Now the pile is a picture of itself: a
// capture of the real drawer (scripts/capture-drawer-poster.js) laid in as
// the well's floor, with ONE live object on top of it, the specimen scene 1
// lifts, so the tag it opens is still the real tag. The capture records the
// scatter it was taken from; that layout is handed to the drawer's own
// session store, so the live specimen lands exactly where the picture left a
// space for it, and "open the drawer" opens the same drawer the reader saw.
// ?live brings back the full pile — the capture script needs it, and so does
// any comparison against the real thing.
$jd_poster = null;
if (!isset($_GET['live'])
    && is_readable(__DIR__ . '/drawer-poster.json')
    && is_readable(__DIR__ . '/drawer-poster.webp')
    && is_readable(__DIR__ . '/drawer-poster@2x.webp')) {
  $jd_poster = json_decode(file_get_contents(__DIR__ . '/drawer-poster.json'), true);
  if (!is_array($jd_poster) || empty($jd_poster['specimen'])) $jd_poster = null;
}
require __DIR__ . '/../_assets.php';

include __DIR__ . '/../../../includes/header.php';
?>

<link rel="stylesheet" href="/art/junk-drawer/junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />
<link rel="stylesheet" href="about.css?v=<?php echo jd_v('about/about.css'); ?>" />
<?php if ($jd_poster):
  // The two preloads split where image-set() splits: a browser takes the
  // first candidate whose resolution is at least the screen's, so any screen
  // over 1x paints the @2x. Split at 1.5dppx (until 2026-10-01), a 1.25 or a
  // 1.1 screen preloaded the 1x and then fetched the @2x as well — measured
  // in Chromium at devicePixelRatio 1.25: drawer-poster.webp first, the
  // @2x 91ms later. The <style> needs no html.jd-poster-on: it is printed
  // only when the script below sets that class.
?>
<link rel="preload" as="image" href="drawer-poster@2x.webp?v=<?php echo jd_v('about/drawer-poster@2x.webp'); ?>" media="not all and (max-resolution: 1dppx)" />
<link rel="preload" as="image" href="drawer-poster.webp?v=<?php echo jd_v('about/drawer-poster.webp'); ?>" media="(max-resolution: 1dppx)" />
<style>
  .jd-about {
    --jd-poster-url: image-set(
      url("drawer-poster.webp?v=<?php echo jd_v('about/drawer-poster.webp'); ?>") 1x,
      url("drawer-poster@2x.webp?v=<?php echo jd_v('about/drawer-poster@2x.webp'); ?>") 2x);
  }
</style>
<script>
/* the poster's layout, handed to the drawer before it scatters: the pile
   reuses a stored scatter that covers every item on the page (jd-core's
   layoutFor), so the one live object lands where the picture expects it.
   Merged over whatever this session already holds, so a visitor's own won
   items keep their places. */
(function () {
  document.documentElement.classList.add('jd-poster-on');
  /* A LIGHT DRAWER THAT STILL DIGS (owner, 2026-09-27). The drawer loads the
     SLIM pile (jd-core's JD_SLIM: every item, only the drawing it shows and
     what its tag prints — no alternatives, no ratings) and, of the
     furniture, only the Take-a-Turn button (JD_FURNITURE). The pile is built
     behind the picture and stays unpainted until the reader reaches for the
     drawer (about-scenes.js, "the drawer wakes"). ?live loads everything. */
  window.JD_SLIM = true;
  window.JD_FURNITURE = ['data-jd-turn-object'];
  /* the scatter is kept on JD_POSTER for the phone's wake (about-scenes.js,
     posterReseat) */
  window.JD_POSTER = <?php echo json_encode([
    'specimen' => $jd_poster['specimen'],
    'place' => $jd_poster['place'] ?? null,
    'scatter' => $jd_poster['scatter'] ?? new stdClass,
  ], JSON_UNESCAPED_SLASHES); ?>;
  var scatter = window.JD_POSTER.scatter;
  try {
    var KEY = 'jd-scatter-v2';
    var held = JSON.parse(sessionStorage.getItem(KEY) || 'null') || {};
    Object.keys(scatter).forEach(function (k) { held[k] = scatter[k]; });
    sessionStorage.setItem(KEY, JSON.stringify(held));
  } catch (e) {}
})();
</script>
<?php endif; ?>

<script>
/* ---- DEMO MODE: the seal ---------------------------------------------------
   Scene 2 hands the visitor the REAL rating instrument. Nothing they do in it
   may reach the database. Every network call in the seven drawer modules and
   in about-scenes.js goes through window.fetch — verified (again 2026-10-01):
   no sendBeacon, no XMLHttpRequest, no image pings — so wrapping fetch here,
   BEFORE those modules load, is a complete seal rather than a partial one.

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
<script>
  /* the walkthrough's layout from the first paint. about-scenes.js sets this
     class too, but it loads at the foot of the page, after the browser has
     already painted every step stacked in one column beside the drawer — the
     no-JS reading — and then re-laid them out as the walkthrough. Set here,
     a page with JS never shows the stacked version. */
  document.currentScript.parentNode.classList.add('jd-about--live');
</script>
  <div class="jd-about-grid">

    <?php /* THE PINNED PANE: four scenes, one visible at a time. The drawer is in
             the markup (it is the opening shot and must paint without JS); the
             other three are empty hosts that about-scenes.js fills: the turn card
             and the report card from their own modules, the analysis with charts
             and a table of its own. */ ?>

    <div class="jd-about-pane" id="jd-about-pane">
      <div class="jd-scene is-on" data-scene-pane="drawer">
<?php include __DIR__ . '/../_stage.php'; ?>
      </div>
      <div class="jd-scene" data-scene-pane="instrument" aria-label="the rating instrument, in demo"></div>
      <div class="jd-scene" data-scene-pane="record" aria-label="a report card"></div>
      <div class="jd-scene" data-scene-pane="analytics" data-fx="grades" aria-label="the analytics folder"></div>
    </div>

    <?php /* THE STEPS */ ?>

    <section class="jd-notes jd-about-notes" id="notes" aria-label="how the drawer works">

      <?php /* ============================ SCENE 1 ============================ */ ?>

      <div class="jd-step is-on" data-scene="drawer" data-step="hook">
        <div class="jd-step-body">
        <?php /* THE PAGE'S TITLE (owner, 2026-09-28): the head of the opening
                 step, so it arrives and leaves with the opening paragraphs.
                 "About the" is part of the title, set like the name on its
                 own line above the name. */ ?>

        <header class="jd-about-head">
          <h1 class="jd-about-title"><span class="jd-about-kicker">About the</span>
          SVG Junk Drawer</h1>
        </header>
        <h2>My personal SVG benchmark</h2>
        <p>This is the virtual junk drawer where I stash my collection of
        AI-generated vector art.</p>
        <p>It&rsquo;s also an experiment in benchmarking how well large
        language models generate SVG images.</p>
        <p>Everything in the drawer is interactive. Click an item to view its
        details, or drag it aside to see what&rsquo;s underneath.</p>
        <p><a href="/art/junk-drawer/" target="_blank" rel="noopener">Visit
        the full drawer</a> to try a prompt yourself, or keep scrolling to
        learn more.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="premise">
        <div class="jd-step-body">
        <h2>What are SVG images?</h2>
        <p>An SVG is a drawing written in code: a list of shapes, coordinates,
        and colors.</p>
        <p>Unlike most AI-generated art, SVGs are vector images. This means
        they can be edited in programs like Adobe Illustrator or scaled to any
        size without losing sharpness.</p>
        <p>They are also a fun way to test a model&rsquo;s coding skills,
        because mistakes in the code show up in the drawing.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="graded">
        <div class="jd-step-body">
        <h2>Every item has a grade</h2>
        <p>Each item in the drawer began as a prompt sent to four leading
        models.</p>
        <p>When the four drawings come back, whoever wrote the prompt grades
        each one without knowing which model made it.</p>
        </div>
      </div>

      <?php /* ============================ SCENE 2 ============================ */ ?>

      <div class="jd-step" data-scene="instrument" data-step="try">
        <div class="jd-step-body">
        <h2>The instrument</h2>
        <p>This is the interface I use to grade the drawings.</p>
        <p>Each one is rated in four categories and given an overall grade, on
        the same five-point scale the USDA uses for beef: Prime, Choice, Select,
        Standard, and Utility. After that, all four are ranked from best to
        worst.</p>
        <p>Feel free to try it out!</p>
        <p class="jd-demo-note">For demonstration purposes only. Nothing
        entered here is saved or recorded.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="taxonomy">
        <div class="jd-step-body">
        <h2>The taxonomy</h2>
        <p>Images are rated in four categories, each designed to isolate a
        single type of failure. They are:</p>
        <?php /* the four live categories only, from taxonomy.json (jd-core's
                 renderLegend fills #jd-axes, one-line summaries). The grade tiers are left off this
                 page (owner, 2026-09-27): the categories are the design worth
                 reading; the tiers are just a scale. */ ?>

        <section class="jd-legend" aria-label="the taxonomy">
          <ul class="jd-axes jd-axes--list" id="jd-axes" data-summary></ul>
        </section>
        </div>
      </div>

      <?php /* ============================ SCENE 3 ============================
               THE SPECIMENS ON THE REPORT CARD (owner, 2026-09-27): the four model
               steps show each drawing on the real report card, filed grade and
               data included, rather than on the instrument. The ranking step
               (the instrument's podium) was cut with the move; its text is kept
               in COPY.md. */ ?>

      <div class="jd-step" data-scene="record" data-step="claude-fable-5" data-view="claude-fable-5">
        <div class="jd-step-body">
        <h2>A gold standard</h2>
        <p>Here&rsquo;s a top-notch SVG drawn by Claude Fable 5.</p>
        <p>It&rsquo;s clearly a desktop succulent, the individual parts fit
        together, the layers stack correctly, and the pot has the tasteful
        Scandinavian style I had in mind when I wrote the prompt.</p>
        <p>It earned top marks in every category.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="gemini-3-1-pro" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>This one has problems. But which <em>kind</em>?</h2>
        <p>This drawing from Gemini 3.1 Pro has issues in the Understanding
        Assignment and Structural Coherence categories.</p>
        <p>Can you spot the Understanding Assignment problem?</p>
        </div>
      </div>

      <?php /* the two answers, beside the same card (same data-view: no card change) */ ?>

      <div class="jd-step" data-scene="record" data-step="gemini-answer" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>Problems with Understanding Assignment</h2>
        <p>The prompt asked for a <em>desktop</em> succulent, but Gemini drew a
        pot on a stand with wooden legs. That&rsquo;s the kind of stand
        you&rsquo;d see holding a large floor plant, not a small pot on a
        desk.</p>
        <p>This is considered an Understanding Assignment problem because the
        model tried to draw something other than what was asked for in the
        prompt.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="gemini-structure" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>Problems with Structural Coherence</h2>
        <p>This drawing has other obvious issues: the succulent&rsquo;s leaves
        are distorted and float in midair.</p>
        <p>These fall under Structural Coherence because they relate to the
        plant&rsquo;s anatomy and how the individual parts fit together.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="kimi-k3" data-view="kimi-k3">
        <div class="jd-step-body">
        <h2>Problems with Layering</h2>
        <p>This drawing from Kimi K3 has a big Layering problem.</p>
        <p>Notice how the leaves are hidden behind the pot, when they should be
        sprouting from its mouth.</p>
        <p>Press &#9654; under the drawing to see what I mean. The replay shows
        the model drawing the leaves just fine, but then covering them with the
        pot&rsquo;s mouth. Textbook layering issue.</p>
        </div>
      </div>

      <?php /* the application behind the cards (owner, 2026-09-27): the table of
               recent turns opens the analysis — the rows the charts are made of */ ?>

      <div class="jd-step" data-scene="analytics" data-step="stack" data-view="turns">
        <div class="jd-step-body">
        <h2>A real application, front to back</h2>
        <p>The SVG Junk Drawer isn&rsquo;t just a pretty interface. It also has
        a working back end.</p>
        <p>Behind the drawer, a server-side pipeline sends each prompt to all
        four models with the same system instructions, and everything is stored
        in a SQL database.</p>
        <p>The only thing missing is actual users (other than me!)</p>
        </div>
      </div>

      <?php /* THE STORY THE CHARTS TELL (owner, 2026-09-27; final copy 2026-09-28):
               about even on average; the spread shows Opus's edge is its Primes;
               the categories point at Je ne sais quoi; and the edge costs money.
               The first two steps share one card (the average and the spread
               together). */ ?>

      <div class="jd-step" data-scene="analytics" data-step="grades" data-view="grades">
        <div class="jd-step-body">
        <h2>Insights</h2>
        <p>Here&rsquo;s how the four models compare on overall grade, across
        roughly 100 drawings each. It&rsquo;s a small sample, I know, but humor
        me.</p>
        <p>On average, Claude Opus 5 has a <em>slight</em> lead over Gemini 3.1 Pro.</p>
        <p>Kimi K3 isn&rsquo;t far behind in third, with GPT-5.1 a distant
        fourth.</p>
        </div>
      </div>


      <div class="jd-step" data-scene="analytics" data-step="distribution" data-view="grades" data-focus="spread-lead">
        <div class="jd-step-body">
        <h2>Similar averages, different distributions</h2>
        <p>Despite similar averages, Gemini generated more drawings graded
        Choice, while Opus had more graded Prime.</p>
        <p>In other words, while Gemini is reliably good, Opus is slightly more
        likely to produce something special.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="multiples" data-view="axes">
        <div class="jd-step-body">
        <h2>The je ne sais quoi factor</h2>
        <p>How did Opus end up with more drawings graded Prime?</p>
        <p>Gemini and Opus are nearly tied on Structural Coherence, and Gemini even leads slightly on Understanding Assignment.</p>
        <p>However, in the Je ne sais quoi category Opus has the advantage. This suggests that the gap between good and great comes down to that special something you can&rsquo;t quite put your finger on.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="spend" data-view="cost">
        <div class="jd-step-body">
        <h2>Prime cuts ain&rsquo;t cheap</h2>
        <p>But that special something has a price. Opus&rsquo;s drawings cost
        roughly twice as much as Gemini&rsquo;s.</p>
        <p>Kimi K3&rsquo;s drawings are the cheapest of the four, yet it still
        beats GPT-5.1 on overall quality.</p>
        </div>
      </div>

      <?php /* ============================ OUTRO ==============================
               Back to the drawer (owner, 2026-09-27): the walkthrough ends where
               it began, with the way out — the drawer itself, and a way to reach
               the person who built it. */ ?>

      <div class="jd-step" data-scene="drawer" data-step="outro">
        <div class="jd-step-body">
        <h2>Thanks for digging through the drawer</h2>
        <p>Of course, this is not meant to be a scientific study.</p>
        <p>I built it as a portfolio piece to showcase the sort of work I do in
        product operations for AI evaluation, including developing taxonomies,
        designing grading instruments, working with SQL databases, and telling
        stories with data.</p>
        <p><a href="/art/junk-drawer/" target="_blank" rel="noopener">Visit the
        full drawer</a> to explore my SVG collection or try a prompt
        yourself.</p>
        <p>If you&rsquo;d like to talk about evaluation and the art of data
        collection, email me at
        <a href="mailto:tysonwelsh@gmail.com">tysonwelsh@gmail.com</a> or
        <a href="https://www.linkedin.com/in/tysonwelsh" rel="noopener">find me
        on LinkedIn</a>.</p>
        </div>
      </div>

      <?php /* (owner, 2026-09-28) no colophon, build stamp or back link under the
               outro: the page ends on its last paragraph, then the site footer */ ?>


    </section>

    <?php /* THE TIMELINE. A station per step, grouped by scene: it says the page
             is scrollable before anyone has scrolled, shows how far along the
             reader is, and takes them back to any earlier moment. Built and kept
             in sync by about-scenes.js from the steps themselves, so it can never
             disagree with them. Empty (and hidden) without JS. */ ?>

    <nav class="jd-timeline" id="jd-timeline" aria-label="walkthrough progress"></nav>

  </div>
</div>

<?php include __DIR__ . '/../_scripts.php'; ?>
<script src="about-scenes.js?v=<?php echo jd_v('about/about-scenes.js'); ?>"></script>

<?php include __DIR__ . '/../../../includes/footer.php'; ?>

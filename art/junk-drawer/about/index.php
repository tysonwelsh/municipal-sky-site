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
$page_title = "The SVG Junk Drawer, explained - Municipal Sky";
$page_description = "A running evaluation of how language models draw: one prompt to four frontier models, every drawing graded blind on a versioned taxonomy, the whole record public. Walk through the instrument, the record and the analysis.";

$jd_extra_assets = ['about/index.php', 'about/about.css', 'about/about-scenes.js', '_stage.php', '_scripts.php'];
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
$jd_extra_assets[] = 'about/drawer-poster.json';
$jd_extra_assets[] = 'about/drawer-poster.webp';
$jd_extra_assets[] = 'about/drawer-poster@2x.webp';
require __DIR__ . '/../_assets.php';

include __DIR__ . '/../../../includes/header.php';
?>

<link rel="stylesheet" href="/art/junk-drawer/junk-drawer.css?v=<?php echo jd_v('junk-drawer.css'); ?>" />
<link rel="stylesheet" href="about.css?v=<?php echo jd_v('about/about.css'); ?>" />
<?php if ($jd_poster): ?>
<link rel="preload" as="image" href="drawer-poster@2x.webp?v=<?php echo jd_v('about/drawer-poster@2x.webp'); ?>" media="(min-resolution: 1.5dppx)" />
<link rel="preload" as="image" href="drawer-poster.webp?v=<?php echo jd_v('about/drawer-poster.webp'); ?>" media="(max-resolution: 1.49dppx)" />
<style>
  html.jd-poster-on .jd-about {
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
  window.JD_POSTER = <?php echo json_encode([
    'specimen' => $jd_poster['specimen'],
    'place' => $jd_poster['place'] ?? null,
  ], JSON_UNESCAPED_SLASHES); ?>;
  var scatter = <?php echo json_encode($jd_poster['scatter'] ?? new stdClass, JSON_UNESCAPED_SLASHES); ?>;
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
<script>
  /* the walkthrough's layout from the first paint. about-scenes.js sets this
     class too, but it loads at the foot of the page, after the browser has
     already painted every step stacked in one column beside the drawer — the
     no-JS reading — and then re-laid them out as the walkthrough. Set here,
     a page with JS never shows the stacked version. */
  document.currentScript.parentNode.classList.add('jd-about--live');
</script>
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

      <!-- ============================ SCENE 1 ============================ -->
      <div class="jd-step is-on" data-scene="drawer" data-step="hook">
        <div class="jd-step-body">
        <!-- THE PAGE'S TITLE (owner, 2026-09-28): the head of the opening
             step, so it arrives and leaves with the opening paragraphs. A
             small mono kicker names the page (this is the ABOUT page; the
             drawer itself is elsewhere), the title names the thing. -->
        <header class="jd-about-head">
          <h1 class="jd-about-title"><span class="jd-about-kicker">About the</span>
          SVG Junk Drawer</h1>
        </header>
        <h2>My personal SVG benchmark</h2>
        <p>This is the virtual junk drawer where I stash my collection of
        AI-generated vector art.</p>
        <p>It is also where I&rsquo;m building my own personal benchmark for
        evaluating how well large language models generate SVG images.</p>
        <p>Feel free to click through or rearrange the items. You can
        <a href="/art/junk-drawer/" target="_blank" rel="noopener">open the
        full drawer</a> to see everything it can do, or just keep scrolling
        to learn more.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="premise">
        <div class="jd-step-body">
        <h2>What are SVG images?</h2>
        <p>An SVG is a drawing written in code: a list of shapes, coordinates,
        and colors. Unlike most AI-generated art, SVGs are vector images, so
        they can be edited in programs like Adobe Illustrator or scaled to any
        size without losing sharpness.</p>
        <p>They also make for a fun way to test the coding skills of a model,
        because mistakes in the code show up in the drawing.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="drawer" data-step="graded">
        <div class="jd-step-body">
        <h2>Every item has a grade</h2>
        <p>Every item in this drawer began as a prompt sent to four leading
        models.</p>
        <p>Once the four drawings come back, the person who wrote the prompt
        grades each one without knowing which model made it. Those grades are
        stored as data, with the aim of building a running comparison of how
        well each model draws.</p>
        <p>Keep scrolling to learn more, or dig around in the drawer
        yourself.</p>
        </div>
      </div>

      <!-- ============================ SCENE 2 ============================ -->
      <div class="jd-step" data-scene="instrument" data-step="try">
        <div class="jd-step-body">
        <h2>The instrument</h2>
        <p>This is the interface used to collect the grades. Graders evaluate
        each drawing one at a time before ranking the four drawings from best
        to worst.</p>
        <p>Go ahead and try it out.</p>
        <p class="jd-demo-note"><b>This is a demo.</b> Nothing you enter here
        is saved or recorded.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="instrument" data-step="taxonomy">
        <div class="jd-step-body">
        <h2>The taxonomy</h2>
        <p>Images are graded in four distinct categories, each designed to
        isolate a single kind of failure. They are:</p>
        <!-- the four live categories only, from taxonomy.json (jd-core's
             renderLegend fills #jd-axes, one-line summaries). The grade tiers are left off this
             page (owner, 2026-09-27): the categories are the design worth
             reading; the tiers are just a scale. -->
        <section class="jd-legend" aria-label="the taxonomy">
          <ul class="jd-axes jd-axes--list" id="jd-axes" data-summary></ul>
        </section>
        </div>
      </div>

      <!-- ============================ SCENE 3 ============================
           THE SPECIMENS ON THE REPORT CARD (owner, 2026-09-27): the four model
           steps show each drawing on the real report card, filed grade and
           data included, rather than on the instrument. The ranking step
           (the instrument's podium) was cut with the move; its text is kept
           in COPY.md. -->
      <div class="jd-step" data-scene="record" data-step="claude-fable-5" data-view="claude-fable-5">
        <div class="jd-step-body">
        <h2>This is a great SVG!</h2>
        <p>Here&rsquo;s an example of a primo SVG drawn by Claude Fable 5.</p>
        <p>The individual parts are well connected, the layers stack
        correctly, and the pot has the tasteful, Scandinavian influence I was
        hoping for when I wrote the prompt.</p>
        <p>It earned top marks in every category.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="gemini-3-1-pro" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>This one has problems. But which <em>kind</em> of problems?</h2>
        <p>Here&rsquo;s an example of an image with problems in both the
        Understanding Assignment and Structural Coherence categories.</p>
        <p>Can you spot the problem with Understanding Assignment?</p>
        </div>
      </div>

      <!-- the two answers, beside the same card (same data-view: no card change) -->
      <div class="jd-step" data-scene="record" data-step="gemini-answer" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>Problems with Understanding Assignment</h2>
        <p>The prompt asked for a <em>desktop</em> succulent, but this model
        drew a pot that is resting on a stand with wooden legs. That&rsquo;s
        the sort of stand you&rsquo;d see holding a large floor plant, not a
        smaller pot that sits on a desk.</p>
        <p>This is an issue with Understanding Assignment because the model
        attempted to draw something other than what was asked for in the
        prompt.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="gemini-structure" data-view="gemini-3-1-pro">
        <div class="jd-step-body">
        <h2>Problems with Structural Coherence</h2>
        <p>There are other problems with this image: the succulent&rsquo;s
        leaves are oddly proportioned and float in midair.</p>
        <p>These issues belong in the Structural Coherence category, because
        they have to do with how well the individual parts fit together.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="record" data-step="kimi-k3" data-view="kimi-k3">
        <div class="jd-step-body">
        <h2>Problems with Layering</h2>
        <p>Here&rsquo;s an example of an image with big problems in the
        Layering category.</p>
        <p>Notice how the leaves of the plant are hidden on the bottom layer
        of the image, behind the pot, when they should be sitting on top,
        emerging from the mouth of the pot.</p>
        <p>Press &#9654; under the drawing to see what I mean. It shows how
        the model did a pretty good job drawing the leaves, but then made the
        mistake of drawing the mouth of the pot over them. Textbook layering
        issue.</p>
        </div>
      </div>

      <!-- the application behind the cards (owner, 2026-09-27): the table of
           recent turns opens the analysis — the rows the charts are made of -->
      <div class="jd-step" data-scene="analytics" data-step="stack" data-view="turns">
        <div class="jd-step-body">
        <h2>A real application, front to back</h2>
        <p>The SVG Junk Drawer is more than just a pretty interface &mdash; it
        also has a functional back end.</p>
        <p>Behind the drawer, a server-side pipeline sends the user&rsquo;s
        prompt to all four models at once, with the same system prompt and
        limits. The ratings are rows in a SQL database, written through
        authenticated endpoints into a schema for submissions, generations,
        ratings, and ranks.</p>
        <p>The only thing it doesn&rsquo;t have is actual users (other than
        myself!)</p>
        </div>
      </div>

      <!-- THE STORY THE CHARTS TELL (owner, 2026-09-27): neck and neck on
           average; the spread shows Opus's edge is its Primes; the categories
           point at Je ne sais quoi; and the edge costs money. The first two
           steps share one card (the average and the spread together). -->
      <div class="jd-step" data-scene="analytics" data-step="grades" data-view="grades">
        <div class="jd-step-body">
        <h2>Insights into overall quality</h2>
        <p>Let&rsquo;s look at how the models compare across all of their
        drawings.</p>
        <p>Besides the four category ratings, every drawing gets one overall
        grade on a five-point scale:</p>
        <!-- counted down, Prime at the top, the order of the spread chart -->
        <ol class="jd-step-list" reversed>
          <li>Prime</li>
          <li>Choice</li>
          <li>Select</li>
          <li>Standard</li>
          <li>Utility</li>
        </ol>
        <p>(The same scale the USDA uses for beef!)</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="grades-analysis" data-view="grades">
        <div class="jd-step-body">
        <h2>By the averages</h2>
        <p>The sample is small, about 95 drawings per model, all graded by
        one rater, so treat these as early results.</p>
        <p>On average overall grade, Claude Opus 5 and Gemini 3.1 Pro finish
        neck and neck.</p>
        <p>Kimi K3 is not far behind in third, with GPT-5.1 a distant
        fourth.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="distribution" data-view="grades" data-focus="spread-top2">
        <div class="jd-step-body">
        <h2>Same averages, but different distributions</h2>
        <p>The shape of the distributions tells them apart.</p>
        <p>Despite the similar averages, Gemini generated more drawings with a
        Choice grade.</p>
        <p>Meanwhile Opus had a few more Prime quality SVGs, and that tail
        lifted its average.</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="multiples" data-view="axes">
        <div class="jd-step-body">
        <h2>The je ne sais quoi factor</h2>
        <p>How did Opus end up with more Prime grade drawings?</p>
        <p>Category by category, Opus and Gemini are close. Gemini even edges
        ahead on Understanding Assignment.</p>
        <p>But Opus&rsquo;s clearest lead is in Je ne sais quoi, which
        suggests it&rsquo;s the spark that turns a good drawing into a great
        one.</p>
        <p>(Though again &hellip; the sample size is small!)</p>
        </div>
      </div>

      <div class="jd-step" data-scene="analytics" data-step="spend" data-view="cost">
        <div class="jd-step-body">
        <h2>Style doesn&rsquo;t come cheap</h2>
        <p>But je ne sais quoi isn&rsquo;t free! Opus&rsquo;s drawings cost
        roughly twice as much as Gemini&rsquo;s.</p>
        <p>Notably, Kimi K3&rsquo;s drawings are the cheapest of the four,
        even though it outperforms GPT-5.1 on overall quality.</p>
        </div>
      </div>

      <!-- ============================ OUTRO ==============================
           Back to the drawer (owner, 2026-09-27): the walkthrough ends where
           it began, with the way out — the drawer itself, and a way to reach
           the person who built it. -->
      <div class="jd-step" data-scene="drawer" data-step="outro">
        <div class="jd-step-body">
        <h2>Thanks for digging through the drawer</h2>
        <p>The SVG Junk Drawer is a personal side project built to show my
        approach to data collection and evaluation: a clear taxonomy, an
        instrument people can actually use, a clean record, and analysis that
        doesn&rsquo;t overstate what the data can show.</p>
        <p>You can <a href="/art/junk-drawer/" target="_blank" rel="noopener">open
        the full drawer</a> to explore or take a turn yourself.</p>
        <p>If you&rsquo;d like to talk about evaluation and data work,
        <a href="https://www.linkedin.com/in/tysonwelsh" rel="noopener">find me
        on LinkedIn</a>.</p>
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

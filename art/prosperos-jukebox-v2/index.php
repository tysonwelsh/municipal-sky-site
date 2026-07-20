<?php
// ============================================================================
// PROSPERO'S JUKEBOX v2 — the front door. Three books on one dark reading
// desk (PLAN-GRAPHICS §1/§5): the Library's alchemical codex, Sycorax's
// woodcut grimoire, Ariel's celestial atlas. The page owns the reading-desk
// layout (three viz canvases: plate / margin / footer), the DOM scribal log,
// and the conjurer's cabinet; pj2-ui.js drives the engines and pj2-viz.js
// draws the plates. Family front-door pattern per art/kolob/index.php,
// including the anonymous page-view / first-play tracking.
// ============================================================================
$page_title = "Prospero's Jukebox — Municipal Sky";
$page_description = "An aleatoric jukebox of three books: the Library's alchemical codex, Sycorax's woodcut grimoire, and Ariel's celestial atlas. Generative chamber music that never repeats, drawn as living manuscript plates.";

// Cache-bust local assets from their mtimes (?v=…) — the form-demo pattern.
function pj2v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? filemtime($path) : 0;
}

// Build/version stamp (kolob pattern): VERSION marker + content fingerprint +
// newest-asset mtime, printed small at the foot so the live build is legible.
$pj2_assets = [
    'pj2-rand.js', 'pj2-pitch.js', 'pj2-clock.js', 'pj2-voice.js', 'pj2-fx.js',
    'pj2-air.js', 'pj2-motif.js', 'pj2-harmony.js', 'pj2-conductor.js',
    'pj2-library.js', 'pj2-sycorax.js', 'pj2-ariel.js',
    'pj2-skin.js', 'pj2-viz.js', 'pj2-ui.js', 'pj2.css', 'index.php',
];
$pj2_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$pj2_build = substr(md5(implode('', array_map('pj2v', $pj2_assets))), 0, 6);
$pj2_mtime = 0;
foreach ($pj2_assets as $pj2_a) {
    $pj2_p = __DIR__ . '/' . $pj2_a;
    if (is_file($pj2_p)) { $pj2_m = filemtime($pj2_p); if ($pj2_m > $pj2_mtime) $pj2_mtime = $pj2_m; }
}
$pj2_deployed = $pj2_mtime ? gmdate('Y-m-d H:i', $pj2_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>

<!-- VT323 (the universal data/chrome face) + Jacquard 12 (the blackletter
     display face) — PJ2.Skin.Type.GOOGLE_FONTS_URL, same delivery path. -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Jacquard+12&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="pj2.css?v=<?php echo pj2v('pj2.css'); ?>" />

<div class="pj2-desk">

  <noscript>
    <p class="pj2-nojs">Prospero&rsquo;s Jukebox is a generative music engine and needs JavaScript
    to conjure anything &mdash; with scripts off, the books stay closed.</p>
  </noscript>
  <p class="pj2-nojs pj2-unsupported" id="pj2-unsupported">This browser lacks the Web Audio
  conjuring apparatus the jukebox requires &mdash; a current Firefox, Chrome, or Safari will open the books.</p>

  <div class="pj2-app" id="pj2-app" data-track="library">

    <!-- THE TABS — v1's horizontal track row restored above the folio (owner
         ruling: tabs, not book spines). Three side-by-side buttons; each tab
         keeps its own track palette even while idle (v1's multi-colored tab
         rule); the active tab reads raised/open against the folio below. -->
    <div class="pj2-tabs" role="tablist" aria-label="the three books">
      <button type="button" class="pj2-tab is-active" id="pj2-tab-library" data-track="library"
              role="tab" aria-selected="true" aria-label="Prospero's Library — the alchemical codex">Prospero&rsquo;s Library</button>
      <button type="button" class="pj2-tab" id="pj2-tab-sycorax" data-track="sycorax"
              role="tab" aria-selected="false" aria-label="Sycorax's Spell — the woodcut grimoire">Sycorax&rsquo;s Spell</button>
      <button type="button" class="pj2-tab" id="pj2-tab-ariel" data-track="ariel"
              role="tab" aria-selected="false" aria-label="Ariel's Day Off — the celestial atlas">Ariel&rsquo;s Day Off</button>
    </div>

    <!-- THE FOLIO — the open book: plate, margin apparatus, annotations, footer rule -->
    <div class="pj2-folio-wrap">
      <div class="pj2-folio">

        <header class="pj2-folio-head">
          <h1 class="pj2-title" id="pj2-title"><span class="pj2-title-pre">Prospero&rsquo;s Jukebox &middot; </span><span class="pj2-init">P</span>rospero&rsquo;s Library</h1>
          <div class="pj2-folio-no" id="pj2-folio-no">c dorian &middot; tonic 262</div>
        </header>

        <div class="pj2-folio-grid">

          <div class="pj2-plate-col">
            <!-- no caption anywhere (owner 2026-07-20): the spiral explains itself -->
            <canvas id="pj2-plate" aria-label="the pitch spiral — the live spectrum drawn as a glowing coil, one turn per octave, rotating over the night ground"></canvas>
            <!-- §6 degradation: the margin apparatus collapsed to one strip (small screens) -->
            <div class="pj2-telemetry" id="pj2-telemetry" aria-label="performance telemetry"></div>
          </div>

          <div class="pj2-margin-col">
            <canvas id="pj2-margin" aria-label="the margin apparatus — tide, intensity, the air, the chord, and the motif genealogy as diagram furniture"></canvas>
            <section class="pj2-log-block">
              <h2 class="pj2-log-head" id="pj2-log-head">annotationes &middot; the scribal log</h2>
              <div class="pj2-log" id="pj2-log" role="log" aria-live="polite" aria-label="the scribal event log">
                <div class="pj2-log-empty">the page waits &mdash; press play</div>
              </div>
            </section>
          </div>

        </div><!-- /pj2-folio-grid -->

        <div class="pj2-footer-strip">
          <canvas id="pj2-footer" aria-label="the density envelope — solid ink past, pricked forecast"></canvas>
        </div>

      </div><!-- /pj2-folio -->
    </div><!-- /pj2-folio-wrap -->

    <!-- THE CABINET — one shared frame, track-skinned inserts (§5); the
         track tabs live ABOVE the folio now, so the cabinet is transport,
         seal, lamp and legend only -->
    <div class="pj2-cabinet">

      <div class="pj2-transport" role="group" aria-label="transport">
        <button type="button" class="pj2-pushplate" id="pj2-play" aria-label="play">PLAY&nbsp;&#9654;&#xFE0E;</button>
        <button type="button" class="pj2-pushplate" id="pj2-stop" aria-label="stop">STOP&nbsp;&#9632;&#xFE0E;</button>
        <button type="button" class="pj2-pushplate" id="pj2-reset" aria-label="reset — reseed this book with a fresh evening">RESET&nbsp;&#8635;&#xFE0E;</button>
      </div>

      <div class="pj2-cab-spacer"></div>

      <div class="pj2-seal-wrap">
        <div class="pj2-seal-stack" id="pj2-seal-stack">
          <canvas id="pj2-seal" aria-hidden="true"></canvas>
          <input type="text" inputmode="numeric" class="pj2-seal-num" id="pj2-seed"
                 aria-label="the seed — type a number and press enter to re-stamp the seal"
                 autocomplete="off" spellcheck="false" />
        </div>
        <span class="pj2-cab-cap">the seed</span>
      </div>

      <div class="pj2-lamp">
        <label class="pj2-cab-cap" for="pj2-vol">the lamp &middot; volume</label>
        <div class="pj2-lamp-track">
          <div class="pj2-lamp-fill" id="pj2-lamp-fill"></div>
          <div class="pj2-lamp-thumb" id="pj2-lamp-thumb"></div>
          <input type="range" id="pj2-vol" min="0" max="1" step="0.01" value="0.6" aria-label="master volume" />
        </div>
      </div>

      <div class="pj2-legend" id="pj2-legend" aria-label="the plate's legend — per-voice volumes and mutes"></div>

    </div><!-- /pj2-cabinet -->

  </div><!-- /pj2-app -->

  <!-- Build stamp: version · content fingerprint · deploy time (kolob pattern) -->
  <p class="pj2-build" aria-label="build version">
    <?php echo htmlspecialchars($pj2_version); ?><span class="pj2-build-sep">&middot;</span><?php echo $pj2_build; ?><?php if ($pj2_deployed): ?><span class="pj2-build-sep">&middot;</span><?php echo $pj2_deployed; ?><?php endif; ?>
  </p>

</div><!-- /pj2-desk -->

<!-- Engine + graphics modules, in the REQUIRED order: substrate (rand, pitch,
     clock, voice), sound tools (fx), form (air, motif, harmony, conductor),
     the three tracks, then skin → viz → ui. -->
<script src="pj2-rand.js?v=<?php echo pj2v('pj2-rand.js'); ?>"></script>
<script src="pj2-pitch.js?v=<?php echo pj2v('pj2-pitch.js'); ?>"></script>
<script src="pj2-clock.js?v=<?php echo pj2v('pj2-clock.js'); ?>"></script>
<script src="pj2-voice.js?v=<?php echo pj2v('pj2-voice.js'); ?>"></script>
<script src="pj2-fx.js?v=<?php echo pj2v('pj2-fx.js'); ?>"></script>
<script src="pj2-air.js?v=<?php echo pj2v('pj2-air.js'); ?>"></script>
<script src="pj2-motif.js?v=<?php echo pj2v('pj2-motif.js'); ?>"></script>
<script src="pj2-harmony.js?v=<?php echo pj2v('pj2-harmony.js'); ?>"></script>
<script src="pj2-conductor.js?v=<?php echo pj2v('pj2-conductor.js'); ?>"></script>
<script src="pj2-library.js?v=<?php echo pj2v('pj2-library.js'); ?>"></script>
<script src="pj2-sycorax.js?v=<?php echo pj2v('pj2-sycorax.js'); ?>"></script>
<script src="pj2-ariel.js?v=<?php echo pj2v('pj2-ariel.js'); ?>"></script>
<script src="pj2-skin.js?v=<?php echo pj2v('pj2-skin.js'); ?>"></script>
<script src="pj2-viz.js?v=<?php echo pj2v('pj2-viz.js'); ?>"></script>
<script src="pj2-ui.js?v=<?php echo pj2v('pj2-ui.js'); ?>"></script>

<!-- Anonymous usage tracking (kolob pattern): a page view, plus the first
     PLAY press as an engagement signal (a raw view understates an audio
     page). No personal data leaves the browser; the server records only a
     salted, daily-rotating visitor hash for unique-visit counts. -->
<script>
  (function () {
    function track(eventType, label) {
      fetch("../../api/page-event-tracking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "prosperos-jukebox-v2", event_type: eventType, label: label || null }),
      }).catch(function () {});
    }
    track("page_view", null);
    var played = false;
    var playBtn = document.getElementById("pj2-play");
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        if (played) return;
        played = true;
        // label the first play with the open book — which door people enter by
        var app = document.getElementById("pj2-app");
        track("play", app ? app.getAttribute("data-track") : null);
      });
    }
  })();
</script>

<?php include '../../includes/footer.php'; ?>

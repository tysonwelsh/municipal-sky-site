<?php
$page_title = "Prospero's Jukebox - Municipal Sky";
$page_description = "Two aleatoric soundscapes from Prospero's Pinball — generative ambient and dark generative — with per-layer mixing controls.";
include '../../includes/header.php';
?>

<!-- Retro fonts for jukebox aesthetic -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Cinzel+Decorative:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="prosperos-jukebox.css?v=83823457" />

<div class="main-wrapper">
 <div class="jukebox-scene">
  <div class="content-frame jukebox-frame">

    <!-- Title -->
    <h1 class="jukebox-title">Prospero's Jukebox</h1>
    <p class="jukebox-subtitle">~ aleatoric soundscapes ~</p>

    <!-- Track selector tabs -->
    <div class="jukebox-tracks">
      <button type="button" class="jukebox-track-tab active" data-track="library">
        Prospero's<br>Library
      </button>
      <button type="button" class="jukebox-track-tab" data-track="sycorax">
        Sycorax's<br>Spell
      </button>
      <button type="button" class="jukebox-track-tab" data-track="ariel">
        Ariel's<br>Day Off
      </button>
    </div>

    <!-- Transport controls -->
    <div class="jukebox-transport">
      <button type="button" class="jukebox-btn play-btn" id="jukebox-play">&#9654; PLAY</button>
      <button type="button" class="jukebox-btn stop-btn" id="jukebox-stop">&#9632; STOP</button>
      <button type="button" class="jukebox-btn reset-btn" id="jukebox-reset">&#8635; RESET</button>
      <div class="jukebox-transport-spacer"></div>
      <span class="jukebox-vol-label">VOL</span>
      <span class="jukebox-val-readout" id="jukebox-master-vol-val">60</span>
      <div class="jukebox-vol-slider">
        <input type="range" min="0" max="100" value="60" class="jukebox-range" id="jukebox-master-vol" />
      </div>
    </div>

    <!-- Mixing desk -->
    <div class="jukebox-mixer">
      <div class="jukebox-mixer-title">Mixing Desk</div>
      <div id="jukebox-layers">
        <!-- Populated by JS based on current track -->
      </div>
    </div>

    <!-- Flavor text + consolidated track explainer. Starts expanded; click
         summary to collapse. JS rewrites #jukebox-flavor body when the
         track switches. -->
    <details class="jukebox-flavor-block" id="jukebox-flavor-block">
      <summary class="jukebox-flavor-summary">
        <span class="jukebox-flavor-chevron">&#9656;</span>
        <span class="jukebox-flavor-summary-label">About this song</span>
      </summary>
      <div class="jukebox-flavor" id="jukebox-flavor">
        <!-- Populated by JS based on current track -->
      </div>
    </details>

    <!-- Status sentinel kept hidden so existing UI handlers that read/write
         it don't blow up. Strip removed from view per UX request. -->
    <div class="jukebox-status" id="jukebox-status" hidden>STOPPED</div>

    <!-- Event log: every audible event the engine emits, newest at top. -->
    <div class="jukebox-event-log-block">
      <div class="jukebox-viz-label" id="jukebox-log-label">EVENTS &middot; activity log</div>
      <div id="jukebox-log" class="jukebox-log">
        <div class="jukebox-log-empty">Press PLAY. Audio events will appear here as they fire.</div>
      </div>
      <p class="jukebox-viz-caption">
        Every audible thing the engine emits, newest at top.
        <span class="log-tag ambient">AMBIENT</span> = one of the track's ambient pool events (page turn, owl hoot, cricket, etc.).
        Motif fires from the primary melodic layer (harpsichord / ghost / whistle) appear as
        <span class="log-tag fresh">FRESH</span> (a newly generated phrase),
        <span class="log-tag verbatim">VERBATIM</span> (a stored motif replayed exactly), or
        <span class="log-tag transform">TRANSFORM</span> (a stored motif altered &mdash; transpose / retrograde / octave / stretch).
      </p>
    </div>

  </div>

  <!-- Visualization scene: data-driven views of each layer.
       Eventually the user-facing experience; the mixer above is the
       developer/control surface for now. -->
  <div class="content-frame jukebox-viz-frame">
    <h2 class="jukebox-viz-title">Scene</h2>

    <div class="jukebox-viz-block">
      <div class="jukebox-viz-label">
        SPECTRUM &middot; pitch spiral
        <span class="jukebox-viz-spiral-controls">
          <button type="button" class="jukebox-viz-spiral-btn" id="jukebox-viz-spiral-auto" title="Toggle slow auto-rotation">&#8635; AUTO</button>
          <button type="button" class="jukebox-viz-spiral-btn" id="jukebox-viz-spiral-view" title="Reset camera">&#8634; VIEW</button>
        </span>
      </div>
      <div class="jukebox-viz-spiral-wrap">
        <canvas id="jukebox-viz-spiral" class="jukebox-viz-canvas jukebox-viz-canvas-spiral"></canvas>
      </div>
    </div>

    <div class="jukebox-viz-block">
      <div class="jukebox-viz-label">
        DENSITY &middot; event-rate envelope
        <span class="jukebox-viz-readout" id="jukebox-viz-density-readout">--</span>
      </div>
      <canvas id="jukebox-viz-density" class="jukebox-viz-canvas jukebox-viz-canvas-short"></canvas>
      <p class="jukebox-viz-caption">
        Slow envelope that scales how often library event layers fire. Two coprime sine LFOs (~1:37 and ~2:31) combined and mapped to a multiplier. Below 1.0 thins events out; above 1.0 packs them tighter. The RATE slider is your average; this curve modulates around it. Solid line = past 4 minutes; dashed line right of <strong>NOW</strong> = forecast (next 30 seconds).
      </p>
    </div>

  </div>
 </div>
</div>

<script src="prosperos-jukebox-themes.js?v=cc7678a3"></script>
<script src="prosperos-jukebox-audio.js?v=1c79e6e3"></script>
<script>if(!window.ProsperoAudio)console.error("AUDIO ENGINE FAILED TO LOAD");</script>
<script src="prosperos-jukebox-ui.js?v=bcbdd909"></script>
<script src="prosperos-jukebox-viz.js?v=0b01789c"></script>

<!-- Anonymous usage tracking. Logs a page view, plus the first PLAY press as
     an engagement signal (a raw view understates an audio page). No personal
     data leaves the browser; the server records only a salted, daily-rotating
     visitor hash for unique-visit counts. -->
<script>
  (function () {
    function track(eventType, label) {
      fetch("../../api/page-event-tracking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "prosperos-jukebox",
          event_type: eventType,
          label: label || null,
        }),
      }).catch(function () {});
    }

    track("page_view", null);

    // Count the first PLAY press only, tagged with the active track.
    var played = false;
    var playBtn = document.getElementById("jukebox-play");
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        if (played) return;
        played = true;
        var activeTab = document.querySelector(".jukebox-track-tab.active");
        track("play", activeTab ? activeTab.getAttribute("data-track") : null);
      });
    }
  })();
</script>

<?php include '../../includes/footer.php'; ?>

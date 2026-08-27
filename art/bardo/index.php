<?php
$page_title = "BARDO བར་དོ - Municipal Sky";
$page_description = "A Tibetan generative liturgy engine: overtone chant, dungchen and ritual bells aboard a derelict monastery-ark adrift between worlds.";
// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx). Computed at
// request time so a changed file always ships a fresh URL.
function bardo_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Serif+Tibetan:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="bardo.css?v=<?php echo bardo_v('bardo.css'); ?>" />

<div class="main-wrapper">
 <div class="bardo-scene">
  <div class="content-frame bardo-frame">
    <div class="bardo-grain"></div>

    <!-- Header -->
    <header class="bardo-header">
      <h1 class="bardo-title">
        <span class="bardo-uchen">བར་དོ</span>
        <span class="bardo-latin">B&thinsp;A&thinsp;R&thinsp;D&thinsp;O</span>
      </h1>
      <p class="bardo-subtitle">a liturgy engine adrift between worlds</p>
    </header>

    <!-- Visualizer -->
    <div class="bardo-viz-wrap">
      <canvas id="bardo-viz" class="bardo-viz"></canvas>
    </div>

    <!-- Conductor telemetry + seed -->
    <div class="bardo-conductor">
      <div class="bardo-telemetry" id="bardo-telemetry">CEREMONY ——— · THE VESSEL IS STILL</div>
      <div class="bardo-motifline" id="bardo-motifline"></div>
      <div class="bardo-seed-row">
        <span class="bardo-seed-label">SEED</span>
        <span id="bardo-seed-current">—</span>
        <input type="text" inputmode="numeric" class="bardo-seed-input" id="bardo-seed-input"
               placeholder="any integer" aria-label="Seed for rebirth" />
        <button type="button" class="bardo-btn bardo-btn-small" id="bardo-rebirth"
                title="reseed &amp; restart">REBIRTH</button>
      </div>
    </div>

    <!-- Transport -->
    <div class="bardo-transport">
      <button type="button" class="bardo-btn play-btn" id="bardo-play">&#9654;&#xFE0E;&nbsp; PLAY</button>
      <button type="button" class="bardo-btn stop-btn" id="bardo-stop"><span class="stop-square">&#9632;&#xFE0E;</span>&nbsp;STOP</button>
      <div class="bardo-transport-spacer"></div>
      <span class="bardo-ctl-label">VOL</span>
      <span class="bardo-val-readout" id="bardo-master-vol-val">60</span>
      <div class="bardo-vol-slider"><input type="range" min="0" max="100" value="60" class="bardo-range" id="bardo-master-vol" /></div>
    </div>

    <!-- Liturgy / section meter -->
    <div class="bardo-liturgy" id="bardo-liturgy">
      <div class="bardo-liturgy-head">
        <span class="bardo-sec-orn">liturgy · five stages</span>
        <span class="bardo-liturgy-current" id="bardo-liturgy-current">idle</span>
      </div>
      <div class="bardo-liturgy-track" id="bardo-liturgy-track"></div>
      <div class="bardo-liturgy-labels" id="bardo-liturgy-labels">
        <span>generation</span><span>offering</span><span>action</span><span>dissolution</span><span>dedication</span>
      </div>
    </div>

    <!-- Console -->
    <div class="bardo-mixer">
      <div class="bardo-mixer-title bardo-sec-orn">console · the assembly</div>
      <div id="bardo-layers"></div>
    </div>

    <!-- Activity log -->
    <div class="bardo-log-block">
      <div class="bardo-log-label bardo-sec-orn">activity · the mind at work</div>
      <div id="bardo-log" class="bardo-log">
        <div class="bardo-log-empty">Press PLAY. The liturgy narrates itself here.</div>
      </div>
    </div>

    <!-- About -->
    <p class="bardo-note">
      A generative liturgy over a hull-drone: overtone <strong>chant</strong>, <strong>dungchen</strong> horns
      and ritual bells, conducted through generation &rarr; offering &rarr; action &rarr; dissolution &rarr; dedication.
      Nothing repeats; every ceremony is a rebirth. Part of the <a href="/art/">generative art</a> series
      &middot; sibling vessel to <a href="/art/zankyo/">ZANKY&#332; &#27544;&#38911;</a>.
    </p>

  </div>
 </div>
</div>

<script src="../background-audio.js?v=<?php echo bardo_v('../background-audio.js'); ?>"></script>
<script src="bardo-audio.js?v=<?php echo bardo_v('bardo-audio.js'); ?>"></script>
<script>if(!window.BardoAudio)console.error("BARDO AUDIO ENGINE FAILED TO LOAD");</script>
<script src="bardo-viz.js?v=<?php echo bardo_v('bardo-viz.js'); ?>"></script>
<script src="bardo-ui.js?v=<?php echo bardo_v('bardo-ui.js'); ?>"></script>

<!-- Anonymous usage tracking: a page view, plus the first PLAY press as an
     engagement signal (a raw view understates an audio page). No personal data
     leaves the browser; the server records only a salted, daily-rotating
     visitor hash for unique-visit counts. -->
<script>
  (function () {
    function track(eventType, label) {
      fetch("../../api/page-event-tracking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: "bardo", event_type: eventType, label: label || null }),
      }).catch(function () {});
    }
    track("page_view", null);
    var played = false;
    var playBtn = document.getElementById("bardo-play");
    if (playBtn) {
      playBtn.addEventListener("click", function () {
        if (played) return;
        played = true;
        track("play", null);
      });
    }
  })();
</script>

<?php include '../../includes/footer.php'; ?>

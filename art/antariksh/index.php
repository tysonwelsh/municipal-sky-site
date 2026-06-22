<?php
$page_title = "Antariksh - Municipal Sky";
$page_description = "An aleatoric raga engine: endless generative Raga Malkauns — a tanpura drone and free-rhythm alap, with a futuristic sheen.";
include '../../includes/header.php';
?>

<!-- Futuristic display + mono fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Space+Grotesk:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="antariksh.css?v=731898f3" />

<div class="main-wrapper">
 <div class="antariksh-scene">
  <div class="content-frame antariksh-frame">

    <!-- Title -->
    <div class="antariksh-header">
      <h1 class="antariksh-title">ANTARIKSH</h1>
      <p class="antariksh-subtitle">अंतरिक्ष &middot; the cosmos &middot; an aleatoric raga engine</p>
    </div>

    <!-- Raga info panel (populated by JS from AntarikshAudio.RAGA) -->
    <div class="antariksh-raga" id="antariksh-raga"></div>

    <!-- Development meter — the long-form alap arc (register + intensity) -->
    <div class="antariksh-arc" id="antariksh-arc">
      <div class="antariksh-arc-head">
        <span class="antariksh-arc-label">Development</span>
        <span class="antariksh-arc-stage" id="antariksh-arc-stage">idle</span>
      </div>
      <div class="antariksh-arc-track"><div class="antariksh-arc-fill" id="antariksh-arc-fill"></div></div>
      <div class="antariksh-arc-scale"><span>mandra</span><span>madhya</span><span>taar</span></div>
    </div>

    <!-- Transport -->
    <div class="antariksh-transport">
      <button type="button" class="antariksh-btn play-btn" id="antariksh-play">&#9654; PLAY</button>
      <button type="button" class="antariksh-btn stop-btn" id="antariksh-stop">&#9632; STOP</button>
      <div class="antariksh-transport-spacer"></div>
      <span class="antariksh-vol-label">VOL</span>
      <span class="antariksh-val-readout" id="antariksh-master-vol-val">60</span>
      <div class="antariksh-vol-slider">
        <input type="range" min="0" max="100" value="60" class="antariksh-range" id="antariksh-master-vol" />
      </div>
    </div>

    <!-- Mixing desk -->
    <div class="antariksh-mixer">
      <div class="antariksh-mixer-title">Console</div>
      <div id="antariksh-layers">
        <!-- Populated by JS -->
      </div>
    </div>

    <!-- Activity log — every phrase/event the engine fires, newest at top. -->
    <div class="antariksh-log-block">
      <div class="antariksh-log-label">Activity &middot; what's playing</div>
      <div id="antariksh-log" class="antariksh-log">
        <div class="antariksh-log-empty">Press PLAY. Events will appear here as they fire.</div>
      </div>
    </div>

    <p class="antariksh-note">
      Phase 1: the foundation &mdash; a <strong>tanpura</strong> drone (Sa + Ma, with jivari shimmer)
      and a futuristic <strong>pad</strong> glow beneath it. The melodic alap voices arrive next.
      Free-rhythm and endlessly generative; nothing here repeats.
    </p>

  </div>
 </div>
</div>

<script src="antariksh-audio.js?v=858c5515"></script>
<script>if(!window.AntarikshAudio)console.error("ANTARIKSH AUDIO ENGINE FAILED TO LOAD");</script>
<script src="antariksh-ui.js?v=133f9733"></script>

<?php include '../../includes/footer.php'; ?>

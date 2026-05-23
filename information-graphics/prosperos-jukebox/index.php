<?php
$page_title = "Prospero's Jukebox - Municipal Sky";
$page_description = "Two aleatoric soundscapes from Prospero's Pinball — generative ambient and dark generative — with per-layer mixing controls.";
include '../../includes/header.php';
?>

<!-- Retro fonts for jukebox aesthetic -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=VT323&family=Cinzel+Decorative:wght@400;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="prosperos-jukebox.css?v=9" />

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

    <!-- Flavor text -->
    <div class="jukebox-flavor" id="jukebox-flavor">
      <!-- Populated by JS based on current track -->
    </div>

    <!-- Status -->
    <div class="jukebox-status" id="jukebox-status">STOPPED</div>

  </div>

  <!-- Visualization scene: data-driven views of each layer.
       Eventually the user-facing experience; the mixer above is the
       developer/control surface for now. -->
  <div class="content-frame jukebox-viz-frame">
    <h2 class="jukebox-viz-title">Scene</h2>
    <p class="jukebox-viz-subtitle">~ what the song looks like ~</p>

    <div class="jukebox-viz-block">
      <div class="jukebox-viz-label">DRONE &middot; pulse constellation</div>
      <canvas id="jukebox-viz-drone" class="jukebox-viz-canvas"></canvas>
      <p class="jukebox-viz-caption">
        Each drone partial sits on a chromatic circle (C&ndash;B around the ring, octave-from-center via radius) and grows a waveform halo as its cycle progresses. The halo's radius tracks cycle progress; its shape is the actual sound wave of that tone, slowed 60&times; so the eye can track it. A connecting line shows the interval between the two partials, colored and thickened by consonance.
      </p>
    </div>

    <div class="jukebox-viz-block">
      <div class="jukebox-viz-label" id="jukebox-harmonic-label">HARMONIC &middot; current center</div>
      <div class="jukebox-harmonic" id="jukebox-harmonic">
        <span class="jukebox-harmonic-chord" id="jukebox-harmonic-chord">--</span>
        <span class="jukebox-harmonic-drone" id="jukebox-harmonic-drone">drone --</span>
      </div>
      <p class="jukebox-viz-caption">
        On Library, each drone pair implies a harmonic center; melody, music box, and hum bias their note picks toward that center's chord tones. On Sycorax, this shows the current "spell pose" — which dissonant cluster is sounding right now. When the drone rotates, the label flashes.
      </p>
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

    <div class="jukebox-viz-block">
      <div class="jukebox-viz-label" id="jukebox-log-label">HARPSICHORD &middot; motif log</div>
      <div id="jukebox-log" class="jukebox-log">
        <div class="jukebox-log-empty">Press PLAY. New motifs will appear here, with returns shown in gold.</div>
      </div>
      <p class="jukebox-viz-caption">
        Each row is one motif fire from the track's primary melodic layer (harpsichord on Library, ghost tones on Sycorax).
        <span class="log-tag fresh">FRESH</span> is a newly generated phrase (captured into memory).
        <span class="log-tag verbatim">VERBATIM</span> is a stored motif played exactly as captured.
        <span class="log-tag transform">TRANSFORM</span> is a stored motif altered (transpose / retrograde / octave / stretch).
      </p>
    </div>
  </div>
 </div>
</div>

<script src="prosperos-jukebox-audio.js?v=41"></script>
<script>if(!window.ProsperoAudio)console.error("AUDIO ENGINE FAILED TO LOAD");</script>
<script src="prosperos-jukebox-ui.js?v=5"></script>
<script src="prosperos-jukebox-viz.js?v=16"></script>

<?php include '../../includes/footer.php'; ?>

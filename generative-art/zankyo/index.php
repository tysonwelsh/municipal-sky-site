<?php
$page_title = "ZANKYŌ 残響 - Municipal Sky";
$page_description = "A Japanese aleatoric noise-engine: generative gagaku and koto eroded by Japanoise grit — a derelict orbital station, year 3042.";
$page_image = "/images/zankyo-share.png";
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="zankyo.css?v=785b5a8f" />

<div class="main-wrapper">
 <div class="zankyo-scene">
  <div class="content-frame zankyo-frame">
    <div class="zankyo-scanlines"></div>

    <div class="zankyo-header">
      <h1 class="zankyo-title" data-glitch="ZANKYŌ">ZANKYŌ<span class="zankyo-kanji">残響</span></h1>
      <p class="zankyo-subtitle">// lingering reverberation · a japanese noise-engine · 3042 //</p>
    </div>

    <!-- Visualizer -->
    <div class="zankyo-viz-wrap">
      <canvas id="zankyo-viz" class="zankyo-viz"></canvas>
    </div>

    <!-- Scale / info -->
    <div class="zankyo-scale" id="zankyo-scale"></div>

    <!-- Jo-ha-kyū development meter -->
    <div class="zankyo-arc" id="zankyo-arc">
      <div class="zankyo-arc-head">
        <span class="zankyo-arc-label">序破急 · development</span>
        <span class="zankyo-arc-phase" id="zankyo-arc-phase">idle</span>
      </div>
      <div class="zankyo-arc-track"><div class="zankyo-arc-fill" id="zankyo-arc-fill"></div></div>
      <div class="zankyo-arc-scale"><span>jo 序</span><span>ha 破</span><span>kyū 急</span></div>
    </div>

    <!-- Transport -->
    <div class="zankyo-transport">
      <button type="button" class="zankyo-btn play-btn" id="zankyo-play">&#9654;&#xFE0E; PLAY</button>
      <button type="button" class="zankyo-btn stop-btn" id="zankyo-stop">&#9632;&#xFE0E; STOP</button>
      <div class="zankyo-transport-spacer"></div>
      <span class="zankyo-vol-label">VOL</span>
      <span class="zankyo-val-readout" id="zankyo-master-vol-val">60</span>
      <div class="zankyo-vol-slider"><input type="range" min="0" max="100" value="60" class="zankyo-range" id="zankyo-master-vol" /></div>
    </div>

    <!-- Console -->
    <div class="zankyo-mixer">
      <div class="zankyo-mixer-title">卓 · console</div>
      <div id="zankyo-layers"></div>
    </div>

    <!-- Activity log -->
    <div class="zankyo-log-block">
      <div class="zankyo-log-label">活動 · activity</div>
      <div id="zankyo-log" class="zankyo-log">
        <div class="zankyo-log-empty">Press PLAY. Events appear here as they fire.</div>
      </div>
    </div>

    <p class="zankyo-note">
      Generative <strong>Hirajoshi</strong> over a distorted hull-drone, structured by
      <strong>jo-ha-kyū</strong> (序破急) — a slow spacious opening that accelerates into a noise-wall climax,
      then dissolves. Nothing repeats; the voices answer one another.
    </p>

  </div>
 </div>
</div>

<script src="zankyo-audio.js?v=0e5777a0"></script>
<script>if(!window.ZankyoAudio)console.error("ZANKYO AUDIO ENGINE FAILED TO LOAD");</script>
<script src="zankyo-viz.js?v=82f84512"></script>
<script src="zankyo-ui.js?v=c664bd86"></script>

<?php include '../../includes/footer.php'; ?>

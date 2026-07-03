<?php
$page_title = "ZANKYŌ 残響 - Municipal Sky";
$page_description = "A Japanese aleatoric noise-engine: generative gagaku and koto eroded by Japanoise grit — a derelict orbital station, year 3042.";
$page_image = "/images/zankyo-share.png";
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="zankyo.css?v=10080336" />

<div class="main-wrapper">
 <div class="zankyo-scene">
  <div class="content-frame zankyo-frame">

    <!-- chassis furniture -->
    <span class="zk-screw zk-screw-tl" style="--slot:23deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-tr" style="--slot:74deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-bl" style="--slot:-15deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-br" style="--slot:51deg" aria-hidden="true"></span>
    <div class="zk-vent zk-vent-tr" aria-hidden="true"></div>
    <div class="zk-vent zk-vent-bl" aria-hidden="true"></div>

    <!-- illuminated marquee -->
    <div class="zk-marquee">
      <span class="zk-marquee-screw" aria-hidden="true"></span>
      <div class="zankyo-header">
        <h1 class="zankyo-title" data-glitch="ZANKYŌ">ZANKYŌ<span class="zankyo-kanji">残響</span></h1>
        <p class="zankyo-subtitle">// <span class="zankyo-sub-long">lingering reverberation &middot; </span>a derelict noise-engine &middot; 3042 //</p>
      </div>
      <span class="zk-marquee-screw zk-marquee-screw-r" aria-hidden="true"></span>
    </div>

    <!-- CRT monitor -->
    <div class="zk-monitor">
      <div class="zk-screen zankyo-viz-wrap">
        <canvas id="zankyo-viz" class="zankyo-viz"></canvas>
        <div class="zankyo-scanlines" aria-hidden="true"></div>
        <div class="zk-glass" aria-hidden="true"></div>
      </div>
      <div class="zk-monitor-chin">
        <span class="zk-monitor-brand">映像管 &middot; MSHI CRT-19</span>
        <span class="zk-chin-spacer"></span>
        <span class="zk-led-label">電源</span>
        <span class="zk-led" aria-hidden="true"></span>
      </div>
      <span class="zk-sticker" aria-hidden="true"><b>検査済</b>3042.04<i></i></span>
    </div>

    <!-- 段階 DEVELOPMENT — segmented LED bargraph, full display width.
         Fill = jo-ha-kyū arc level; zone splits sit where the engine's phase
         cuts land on the level curve (pos 0.45 → level 0.25, pos 0.82 → 0.80). -->
    <div class="zk-bargraph" id="zankyo-bargraph">
      <div class="zk-bar-scale" aria-hidden="true">
        <span class="zk-bar-zl zk-bar-zl-jo">序 jo</span>
        <span class="zk-bar-zl zk-bar-zl-ha">破 ha</span>
        <span class="zk-bar-zl zk-bar-zl-kyu">急 kyū</span>
        <span class="zk-bar-tick" style="left:25%"></span>
        <span class="zk-bar-tick" style="left:80%"></span>
      </div>
      <div class="zk-bar-housing">
        <div class="zk-bar-cells" id="zankyo-bar-cells" aria-hidden="true"></div>
        <span class="zk-bar-glass" aria-hidden="true"></span>
      </div>
      <div class="zk-bar-foot" aria-hidden="true">
        <span class="zk-bar-label">段階 &middot; DEVELOPMENT</span>
        <span class="zk-bar-serial">LM-3814 &middot; 56&nbsp;SEG</span>
      </div>
    </div>

    <!-- control rail: transport · pitch-management module · master volume, one compact row -->
    <div class="zk-console-top">
      <div class="zk-transport-cluster">
        <button type="button" class="zk-arcade play-btn" id="zankyo-play" aria-label="Play"><span class="zk-arcade-cap">&#9654;&#xFE0E;</span></button>
        <button type="button" class="zk-arcade stop-btn" id="zankyo-stop" aria-label="Stop"><span class="zk-arcade-cap">&#9632;&#xFE0E;</span></button>
      </div>
      <div class="zk-module">
        <span class="zk-mod-screw" style="--slot:31deg" aria-hidden="true"></span>
        <span class="zk-mod-screw zk-mod-screw-r" style="--slot:-47deg" aria-hidden="true"></span>
        <div class="zk-mod-zone zk-mod-mode">
          <span class="zk-mod-head">旋法 &middot; MODE</span>
          <div class="zk-mod-lamp">
            <span class="zankyo-scale-name" id="zankyo-mode-name"><b>Hirajoshi</b> &middot; D</span>
            <span class="zankyo-scale-mood" id="zankyo-mode-mood">haunted &middot; derelict &middot; neon-rust</span>
          </div>
        </div>
        <div class="zk-mod-zone zk-mod-scale">
          <span class="zk-mod-head">音階 &middot; SCALE</span>
          <div class="zk-deg-row" id="zankyo-degrees"></div>
          <span class="zk-testpoints" aria-hidden="true"></span>
        </div>
        <span class="zk-mod-stamp" aria-hidden="true">音程管理 &middot; MODULE 04</span>
      </div>
      <div class="zk-master">
        <div id="zankyo-master-knob" class="zk-knob-mount"></div>
        <div class="zk-master-meta">
          <span class="zk-print">主音量 &middot; VOL</span>
          <span class="zankyo-val-readout" id="zankyo-master-vol-val">60</span>
        </div>
      </div>
    </div>

    <!-- console -->
    <div class="zankyo-mixer">
      <div class="zankyo-mixer-title"><span>卓 &middot; CONSOLE</span><span class="zk-warn-small" aria-hidden="true">機動注意</span></div>
      <div id="zankyo-layers"></div>
    </div>

    <!-- VFD activity display -->
    <div class="zankyo-log-block">
      <div class="zankyo-log-label"><span>活動 &middot; ACTIVITY</span><span class="zk-vfd-tag">VFD-08</span></div>
      <div id="zankyo-log" class="zankyo-log">
        <div class="zankyo-log-empty">Press PLAY. Events appear here as they fire.</div>
      </div>
    </div>

    <!-- model / serial plate -->
    <div class="zk-plate-row">
      <span class="zk-plate">残響-3042 &middot; MUNICIPAL SKY HEAVY INDUSTRIES &middot; 製造番号 3042-0117</span>
    </div>

    <p class="zankyo-note">
      Generative dark pentatonics — <strong>Hirajoshi</strong>, In-sen, Kumoi, Iwato — over a distorted hull-drone, structured by
      <strong>jo-ha-kyū</strong> (序破急) — a slow spacious opening that accelerates into a noise-wall climax,
      then dissolves. Nothing repeats; the voices answer one another.
    </p>

  </div>
 </div>
</div>

<script src="../background-audio.js?v=98cd6909"></script>
<script src="zankyo-audio.js?v=4161392f"></script>
<script>if(!window.ZankyoAudio)console.error("ZANKYO AUDIO ENGINE FAILED TO LOAD");</script>
<script src="zankyo-viz.js?v=f8b989f1"></script>
<script src="zankyo-ui.js?v=01c1c917"></script>

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
        body: JSON.stringify({ page: "zankyo", event_type: eventType, label: label || null }),
      }).catch(function () {});
    }
    track("page_view", null);
    var played = false;
    var playBtn = document.getElementById("zankyo-play");
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

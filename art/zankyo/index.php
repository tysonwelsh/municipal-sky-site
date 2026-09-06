<?php
$page_title = "ZANKYŌ 残響 - Municipal Sky";
$page_description = "A Japanese aleatoric noise-engine: generative gagaku and koto eroded by Japanoise grit — a derelict orbital station, year 3042.";
$page_image = "/images/zankyo-share.png";

// Cache-bust local assets from their mtimes (?v=…) — the Jukebox v2 pattern.
function zkv($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? filemtime($path) : 0;
}

// Build/version stamp (Jukebox v2 / kolob pattern): VERSION marker + content
// fingerprint + newest-asset mtime, printed small by the serial plate so the
// live build is legible. The footer shows only the version NUMBER; the
// "— summary" tail in VERSION stays for git history and the bump rule.
$zk_assets = [
    'zankyo-audio.js', 'zankyo-viz.js', 'zankyo-ui.js', 'zk-set.js', 'zk-broadcast.js', 'broadcast/manifest.json', 'zankyo.css', 'index.php',
    '../prosperos-jukebox-v2/pj2-rand.js', '../prosperos-jukebox-v2/pj2-pitch.js',
    '../prosperos-jukebox-v2/pj2-clock.js', '../prosperos-jukebox-v2/pj2-voice.js',
    '../prosperos-jukebox-v2/pj2-fx.js', '../prosperos-jukebox-v2/pj2-air.js',
    '../prosperos-jukebox-v2/pj2-conductor.js',
];
$zk_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$zk_version = trim(explode('—', $zk_version)[0]);
$zk_build = substr(md5(implode('', array_map('zkv', $zk_assets))), 0, 6);
$zk_mtime = 0;
foreach ($zk_assets as $zk_a) {
    $zk_p = __DIR__ . '/' . $zk_a;
    if (is_file($zk_p)) { $zk_m = filemtime($zk_p); if ($zk_m > $zk_mtime) $zk_mtime = $zk_m; }
}
$zk_deployed = $zk_mtime ? gmdate('Y-m-d H:i', $zk_mtime) . ' UTC' : '';
include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Shippori+Mincho:wght@500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="zankyo.css?v=<?php echo zkv('zankyo.css'); ?>" />

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

    <!-- THE BANK (S0, the second set): the scope + bargraph stack on the left
         (3fr), and to its right the older receive-only tube the yard bolted on
         later — 映像管 MSHI CRT-9, 受信専用 — on its own steel strap (2fr). Under
         700 px the bank stacks and the set goes full width under the bargraph.
         Look decided by the owner: mockups/monitor-1-second-set.html. -->
    <div class="zk-bank">
      <div class="zk-bank-main">
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
      </div>

      <!-- 隣 THE SECOND SET — MSHI CRT-9, receive only, on its strap; under it
           the receiver sub-panel (owner refinement §4.3: S0 leaves the plate,
           S1 fills it with band / flutter / grit and the 選局 TUNE control) -->
      <div class="zk-bank-side">
      <div class="zk-mount">
        <span class="zk-bolt zk-bolt-tl" style="--hex:12deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-tr" style="--hex:-20deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-bl" style="--hex:40deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-br" style="--hex:5deg" aria-hidden="true"></span>
        <div class="zk-set2" id="zankyo-set2">
          <div class="zk-set2-tubewrap">
            <div class="zk-tube" id="zankyo-tube">
              <canvas id="zankyo-set" aria-label="the second set: a receive-only tube, dark until a signal is picked up"></canvas>
              <div class="zankyo-scanlines" aria-hidden="true"></div>
              <svg class="zk-crack" id="zankyo-crack" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"></svg>
              <div class="zk-glass" aria-hidden="true"></div>
            </div>
          </div>
          <div class="zk-set2-chin">
            <span class="zk-set2-brand">映像管 &middot; MSHI CRT-9 &middot; <i>受信専用</i></span>
            <span class="zk-chin-spacer"></span>
            <button type="button" class="zk-tune" id="zankyo-tune" aria-label="選局 · tune: scan for a signal" title="選局 &middot; tune"></button>
            <span class="zk-rx-label">受信</span>
            <span class="zk-rx" id="zankyo-rx" aria-hidden="true"></span>
          </div>
          <span class="zk-tape zk-tape-2" aria-hidden="true"></span>
        </div>
      </div>
      <!-- the transport plate (owner §4.5): PLAY · STOP · master volume, moved
           here from the control rail; the ids are the same, zankyo-ui.js binds
           to them wherever they sit -->
      <div class="zk-rxpanel" id="zankyo-rxpanel">
        <span class="zk-bolt zk-bolt-tl" style="--hex:33deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-tr" style="--hex:-8deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-bl" style="--hex:17deg" aria-hidden="true"></span>
        <span class="zk-bolt zk-bolt-br" style="--hex:-41deg" aria-hidden="true"></span>
        <div class="zk-transport-cluster">
          <button type="button" class="zk-arcade play-btn" id="zankyo-play" aria-label="Play"><span class="zk-arcade-cap">&#9654;&#xFE0E;</span></button>
          <button type="button" class="zk-arcade stop-btn" id="zankyo-stop" aria-label="Stop"><span class="zk-arcade-cap">&#9632;&#xFE0E;</span></button>
        </div>
        <span class="zk-rxpanel-gap" aria-hidden="true"><span class="zk-rxpanel-head">操作 &middot; TRANSPORT</span><span class="zk-rxpanel-stamp">TYPE 9-B &middot; No. 2887-R</span></span>
        <div class="zk-master">
          <div id="zankyo-master-knob" class="zk-knob-mount"></div>
          <div class="zk-master-meta">
            <span class="zk-print">主音量 &middot; VOL</span>
            <span class="zankyo-val-readout" id="zankyo-master-vol-val">60</span>
          </div>
        </div>
      </div>
      </div>
    </div>

    <!-- control rail: the pitch-management module, full width (the transport
         and the master volume moved to the plate under the second set, §4.5) -->
    <div class="zk-console-top">
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
    <!-- Build stamp: version · content fingerprint · deploy time (Jukebox v2 pattern) -->
    <p class="zk-build" aria-label="build version">
      <?php echo htmlspecialchars($zk_version); ?><span class="zk-build-sep">&middot;</span><?php echo $zk_build; ?><?php if ($zk_deployed): ?><span class="zk-build-sep">&middot;</span><?php echo $zk_deployed; ?><?php endif; ?>
    </p>

    <p class="zankyo-note">
      Generative dark pentatonics — <strong>Hirajoshi</strong>, In-sen, Kumoi, Iwato — over a distorted hull-drone, structured by
      <strong>jo-ha-kyū</strong> (序破急) — a slow spacious opening that accelerates into a noise-wall climax,
      then dissolves. Each cycle is planned anew (a rite, a drift, a storm, a silence, a broadcast), the voices take turns and rest,
      the key drifts, themes are born and inherited, and rare guests visit. Nothing repeats; the voices answer one another.
      Add <code>?seed=</code> to the address to share a night.
    </p>

  </div>
 </div>
</div>

<!-- shared site helper: keeps the engine sounding under a locked screen /
     backgrounded mobile browser, with lock-screen media controls. -->
<script src="../background-audio.js?v=<?php echo zkv('../background-audio.js'); ?>"></script>
<!-- THE SUBSTRATE (ZANKYŌ 2): the Prospero's Jukebox v2 modules, shared by
     relative path and never modified from here — in the REQUIRED order:
     rand, pitch, clock, voice, fx, air, conductor — then the engine. -->
<script src="../prosperos-jukebox-v2/pj2-rand.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-rand.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-pitch.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-pitch.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-clock.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-clock.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-voice.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-voice.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-fx.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-fx.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-air.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-air.js'); ?>"></script>
<script src="../prosperos-jukebox-v2/pj2-conductor.js?v=<?php echo zkv('../prosperos-jukebox-v2/pj2-conductor.js'); ?>"></script>
<script src="zankyo-audio.js?v=<?php echo zkv('zankyo-audio.js'); ?>"></script>
<script>if(!window.ZankyoAudio)console.error("ZANKYO AUDIO ENGINE FAILED TO LOAD");</script>
<!-- THE RECEIVER (S1): a real reel from broadcast/ through the station's own
     receiver chain, seated by the Conductor as the broadcast visitation. -->
<script src="zk-broadcast.js?v=<?php echo zkv('zk-broadcast.js'); ?>"></script>
<script src="zankyo-viz.js?v=<?php echo zkv('zankyo-viz.js'); ?>"></script>
<!-- THE SECOND SET (S0): the CRT-9's own phosphor pipeline and its idle stream;
     no-ops headless (the probe loads every zk-*.js). -->
<script src="zk-set.js?v=<?php echo zkv('zk-set.js'); ?>"></script>
<script src="zankyo-ui.js?v=<?php echo zkv('zankyo-ui.js'); ?>"></script>

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

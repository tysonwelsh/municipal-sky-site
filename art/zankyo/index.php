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
    'zankyo-audio.js', 'zankyo-viz.js', 'zankyo-ui.js', 'zk-picture.js', 'zk-set.js', 'zk-broadcast.js', 'broadcast/manifest.json', 'broadcast/geo.json', 'zankyo.css', 'index.php',
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

    <!-- The page's heading. It used to be the marquee's big title; now the tube
         shows a decorative copy that disappears on the first PLAY, so the real
         h1 lives here off-screen and the document keeps a heading in every
         state. -->
    <h1 class="zk-sr-title">ZANKYŌ 残響</h1>

    <!-- chassis furniture -->
    <span class="zk-screw zk-screw-tl" style="--slot:23deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-tr" style="--slot:74deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-bl" style="--slot:-15deg" aria-hidden="true"></span>
    <span class="zk-screw zk-screw-br" style="--slot:51deg" aria-hidden="true"></span>
    <div class="zk-vent zk-vent-tr" aria-hidden="true"></div>
    <div class="zk-vent zk-vent-bl" aria-hidden="true"></div>
    <!-- 逸脱 (plan §5): one slat of the bottom-left vent is a different metal
         and it slides. Unlabeled, nothing printed near it, no cursor tell until
         you are on it. ON → the station restarts on a night with d ≥ 0.8 and
         rewrites ?seed= so it can be sent to somebody. It is reachable from the
         keyboard and named 逸脱 to a screen reader: hiding a control from
         assistive technology is a different thing from hiding it on a panel. -->
    <button type="button" class="zk-far-sw" id="zankyo-far-sw" role="switch" aria-checked="false" aria-label="逸脱"><span class="zk-far-nub" aria-hidden="true"></span></button>

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
            <!-- the title now lives ON THE TUBE until the station is played:
                 it sits under the scanlines and the glass, so the same
                 treatment reads as phosphor rather than as a printed sign.
                 The first PLAY removes it for the session. -->
            <div class="zk-boot" id="zankyo-boot" aria-hidden="true">
              <div class="zankyo-title" data-glitch="ZANKYŌ">ZANKYŌ</div>
              <p class="zk-boot-line">// awaiting signal, press play</p>
            </div>
            <div class="zankyo-scanlines" aria-hidden="true"></div>
            <div class="zk-glass" aria-hidden="true"></div>
          </div>
          <!-- 段階 DEVELOPMENT — segmented LED bargraph, in the SAME casing as
               the tube (owner, 2026-09-18): the scope and the bar read as two
               separate screens let into one moulding, parted only by a gutter
               of the casing's own plastic. Fill = jo-ha-kyū arc level; zone
               splits sit where the engine's phase cuts land on the level curve
               (pos 0.45 → level 0.25, pos 0.82 → 0.80). -->
          <div class="zk-bargraph" id="zankyo-bargraph">
            <div class="zk-bar-housing">
              <div class="zk-bar-cells" id="zankyo-bar-cells" aria-hidden="true"></div>
              <!-- the jo/ha/kyū splits, moved INSIDE the housing when the scale
                   row came off: the marks survive and cost no height of their own -->
              <span class="zk-bar-tick" style="left:25%" aria-hidden="true"></span>
              <span class="zk-bar-tick" style="left:80%" aria-hidden="true"></span>
              <span class="zk-bar-glass" aria-hidden="true"></span>
            </div>
            <!-- no foot: just the bar (owner, 2026-09-14) -->
          </div>

          <!-- the transport: PLAY · STOP · master volume, moved off its own
               bolted plate under the second set and INTO this casing, below the
               bar (owner, 2026-09-24) — no plate, no screws, the monitor's
               moulding carries it. The ids are the same; zankyo-ui.js binds to
               them wherever they sit. -->
          <div class="zk-rxpanel" id="zankyo-rxpanel">
            <!-- TRANSPORT (owner's pick, 2026-09-18: mockups/transport-1-options.html
                 option B3): mechanical deck keys in their own recessed bed. PLAY
                 LATCHES DOWN and stays down while the station runs — the machine's
                 state is a physical position, so it still reads with the lamp off —
                 and STOP releases it. Green on PLAY, red on STOP. -->
            <div class="zk-transport-cluster">
              <div class="zk-keybed">
                <button type="button" class="zk-key zk-key-play" id="zankyo-play" aria-label="Play" aria-pressed="false">
                  <span class="zk-key-glyph" aria-hidden="true">&#9654;&#xFE0E;</span>
                </button>
                <button type="button" class="zk-key zk-key-stop" id="zankyo-stop" aria-label="Stop">
                  <span class="zk-key-glyph" aria-hidden="true">&#9632;&#xFE0E;</span>
                </button>
              </div>
              <span class="zk-tally" id="zankyo-tally" aria-hidden="true"></span>
            </div>
            <span class="zk-rxpanel-gap" aria-hidden="true"></span>
            <!-- MASTER VOLUME (owner's pick, 2026-09-20: mockups/volume-2-options.html
                 option W6). A moulded rubber thumbwheel turned on a vertical axle.
                 The scale is printed on the wheel — 0-100 in tens, each numeral on
                 its own flat milled into the middle of the tread band, with the
                 tread carrying on above and below it — and a fixed 指標 pointer
                 above reads whichever flat has come round to it.

                 The treads and flats are placed by zankyo-ui.js, by ANGLE rather
                 than at even spacing, so they crowd toward the edges the way a real
                 cylinder's do. That projection is the whole of the effect; an
                 evenly-spaced pattern reads as a strip sliding sideways. -->
            <div class="zk-master">
              <div class="zk-wheel" id="zankyo-master-wheel">
                <span class="zk-wheel-ind" aria-hidden="true"></span>
                <span class="zk-wheel-barrel" aria-hidden="true">
                  <span class="zk-wheel-sheen"></span>
                </span>
                <input type="range" class="zk-wheel-input" id="zankyo-master-vol"
                       min="0" max="100" step="1" value="60" aria-label="Master volume" />
              </div>
            </div>
          </div>
        </div>

        <!-- 拡声器 THE SPEAKER (owner's pick, 2026-09-24:
             mockups/speaker-1-options.php option C): louvres moulded into
             the plastic, dark cloth behind them, a recessed 音 medallion. Its
             own casing, in the scope's plastic, filling the column under it to
             the foot of the second set. Decorative — it plays nothing — and
             gone under 700 px, where the bank stacks and there is no gap. -->
        <div class="zk-spk" aria-hidden="true">
          <span class="zk-spk-medal"><i>音</i></span>
          <span class="zk-spk-slots"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></span>
        </div>

      </div>

      <!-- 隣 THE SECOND SET — 映像管 MSHI CRT-9, 受信専用: the older receive-only
           tube the yard bolted on later, cracked glass and a strip of yellowed
           tape, now in a casing re-cut as ONE injection moulding with a 操作段
           control ledge (owner's pick: mockups/set-R2-ledge.html, re-worked
           2026-09-17 so the ledge is part of the tool and not tacked on).
           SETTLED: the set takes column 1 — at 960 that is 516 px of column,
           13 px of wall each side, so the tube is 488 × 366. -->
      <div class="zk-bank-side">
      <div class="zk-set2" id="zankyo-set2">
          <!-- the aperture. Its 4:3 comes from percentage padding, not
               aspect-ratio: WebKit squashes a ratio on a shrinkable flex item
               (PLAN-MONITOR-2 §9.1) and shipped a 488 × 274 tube that looked
               perfect in Chrome. -->
          <div class="zk-set2-tubewrap">
            <div class="zk-tube-wrap">
              <div class="zk-tube" id="zankyo-tube">
                <canvas id="zankyo-set" aria-label="the second set: a receive-only tube, dark until a signal is picked up"></canvas>
                <div class="zankyo-scanlines" aria-hidden="true"></div>
                <svg class="zk-crack" id="zankyo-crack" viewBox="0 0 400 300" preserveAspectRatio="none" aria-hidden="true"></svg>
                <div class="zk-glass" aria-hidden="true"></div>
              </div>
            </div>
          </div>

          <!-- 操作段 THE CONTROL LEDGE. Three stations on one moulded bar:
               the unlabelled stepper, the 受信 push, and a station the tool cut
               and nothing has been fitted to yet. (rc.77: 輝度 came off the
               panel — the owner wanted the number under his left thumb and the
               button back. setBright()/getBright() stay in zk-set.js at their
               default step, waiting for a control.) -->
          <div class="zk-ledge">
            <span class="zk-pin zk-pin-l" aria-hidden="true"></span>
            <span class="zk-pin zk-pin-r" aria-hidden="true"></span>

            <div class="zk-ledge-brand" aria-hidden="true">
              <span>映像管 &middot; MSHI CRT-9 &middot; <i>受信専用</i></span>
              <em>操作段 &middot; LEDGE 01</em>
            </div>

            <div class="zk-well">

              <!-- THE LEFT STATION: two arrows and a two-digit readout, and
                   nothing else. No label on the panel, no legend, no tooltip and
                   no line in the VFD — the owner asked that it not be explained
                   ("part of the appeal of this app is just kind of mysterious
                   and you just have to figure out yourself whether it's actually
                   controlling"). The screen reader is told what the control
                   factually IS, which is a different thing from explaining it
                   on the faceplate. The digits are amber (rc.77). -->
              <div class="zk-rocker" id="zankyo-rock-loc" role="group" aria-label="選局番号 &middot; channel number, 00 to 10">
                <span class="zk-cap zk-cap-l" aria-hidden="true"><i>&#9662;</i></span>
                <span class="zk-rock-win zk-rock-win-num">
                  <span class="zk-num" aria-hidden="true"><i class="zk-num-ghost">88</i><b class="zk-num-v" id="zankyo-loc-read">00</b></span>
                </span>
                <span class="zk-cap zk-cap-r" aria-hidden="true"><i>&#9652;</i></span>
                <button type="button" class="zk-face zk-hit zk-hit-l" data-d="-1" aria-label="番号を下げる &middot; channel number down"></button>
                <button type="button" class="zk-face zk-hit zk-hit-r" data-d="1" aria-label="番号を上げる &middot; channel number up"></button>
                <span class="zk-sr" id="zankyo-loc-sr" role="status"></span>
              </div>

              <!-- THE MIDDLE STATION: 受信, the momentary push, back on the
                   panel (rc.77). One press seats a real broadcast AT ONCE —
                   no cooldown, no lottery gate, no probability — through the
                   production path, narrowed by the number to its left. The
                   plate carries the set's own word and NOTHING ELSE: no
                   legend, no tooltip, no line of help. The lamp is the whole
                   readout — lit while a reception is on the air. The
                   aria-label states what the control factually does, which is
                   what a screen reader needs and not what the plastic says. -->
              <button type="button" class="zk-face zk-push" id="zankyo-push" aria-label="受信 &middot; receive a broadcast now">
                <span class="zk-push-cap" aria-hidden="true">
                  <span class="zk-push-k">受信</span>
                  <span class="zk-push-lens"></span>
                </span>
              </button>

              <!-- THE THIRD STATION: reserved blank plastic. A blanking plate
                   with the mounting boss the yard never used — moulded as if the
                   tool always had this station, not a gap where something was
                   ripped out. Something goes here later. -->
              <div class="zk-blank" aria-hidden="true"></div>

            </div>
          </div>
      </div>
      </div>
    </div>

    <!-- control rail: one row above the console — the narrow pitch-management
         module on the left (mode, tonic, mood, the scale-degree lamps that
         strike with every melodic note) and the VFD activity log on the right,
         moved up from under the console (owner, 2026-09-24: "a narrower
         container … move the activity log up … less explaining"). The gold
         test-point strip was dead decoration and is gone. -->
    <div class="zk-console-top">
      <div class="zk-module">
        <span class="zk-mod-screw" style="--slot:31deg" aria-hidden="true"></span>
        <span class="zk-mod-screw zk-mod-screw-r" style="--slot:-47deg" aria-hidden="true"></span>
        <div class="zk-mod-zone zk-mod-mode">
          <div class="zk-mod-lamp">
            <span class="zankyo-scale-name" id="zankyo-mode-name"><b>Hirajoshi</b> &middot; <span class="zk-tonic">D</span></span>
            <span class="zankyo-scale-mood" id="zankyo-mode-mood">haunted &middot; derelict &middot; neon-rust</span>
            <!-- the night's seed (owner, 2026-09-24): the number that plays this
                 night again, as ?seed= in the address -->
            <span class="zankyo-scale-mood zk-seed" id="zankyo-seed"></span>
          </div>
        </div>
        <div class="zk-mod-zone zk-mod-scale">
          <!-- the testpoints are back where the label was (owner, 2026-09-24):
               no printed words on this panel, just the readout and the lamps -->
          <span class="zk-testpoints" aria-hidden="true"></span>
          <div class="zk-deg-row" id="zankyo-degrees"></div>
        </div>
      </div>

      <!-- VFD activity display -->
      <div class="zankyo-log-block">
        <div class="zankyo-log-label"><span>活動 &middot; ACTIVITY</span><span class="zk-vfd-tag">VFD-08</span></div>
        <div id="zankyo-log" class="zankyo-log">
          <div class="zankyo-log-empty">Press PLAY. Events appear here as they fire.</div>
        </div>
      </div>
    </div>

    <!-- console -->
    <!-- the title strip is the console's own latch: press it and the whole
         console folds to the strip, the way a row's name plate folds its cavity
         (owner, 2026-09-14). Remembered per browser. -->
    <div class="zankyo-mixer" id="zankyo-mixer">
      <div class="zankyo-mixer-title" id="zankyo-mixer-toggle" role="button" tabindex="0" aria-expanded="true" aria-controls="zankyo-layers" aria-label="Console: fold or unfold">
        <span>卓 &middot; CONSOLE</span>
        <span class="zk-warn-small" aria-hidden="true">機動注意</span>
        <span class="zk-name-latch zk-mixer-latch" aria-hidden="true"></span>
      </div>
      <div id="zankyo-layers"></div>
    </div>

    <!-- model / serial plate -->
    <div class="zk-plate-row">
      <span class="zk-plate">残響-3042 &middot; MUNICIPAL SKY HEAVY INDUSTRIES &middot; 製造番号 3042-0117</span>
    </div>
    <!-- Build stamp: version · content fingerprint · deploy time (Jukebox v2 pattern) -->
    <p class="zk-build" aria-label="build version">
      <?php echo htmlspecialchars($zk_version); ?><span class="zk-build-sep">&middot;</span><?php echo $zk_build; ?><?php if ($zk_deployed): ?><span class="zk-build-sep">&middot;</span><?php echo $zk_deployed; ?><?php endif; ?>
    </p>

  </div>
 </div>
</div>

<!-- shared site helper: keeps the engine sounding under a locked screen /
     backgrounded mobile browser, with lock-screen media controls. -->
<!-- The page's asset fingerprint, exposed for the receiver: it fetches the
     manifest with ?v=<this> so a rebuilt manifest is never served from a
     six-hour cache. The reels carry their own per-reel rev instead. -->
<script>window.ZK_ASSET_V = "<?php echo $zk_build; ?>";</script>
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
<script src="zk-far.js?v=<?php echo zkv('zk-far.js'); ?>"></script>
<script src="zankyo-audio.js?v=<?php echo zkv('zankyo-audio.js'); ?>"></script>
<script>if(!window.ZankyoAudio)console.error("ZANKYO AUDIO ENGINE FAILED TO LOAD");</script>
<!-- THE RECEIVER (S1): a real reel from broadcast/ through the station's own
     receiver chain, seated by the Conductor as the broadcast visitation. -->
<script src="zk-broadcast.js?v=<?php echo zkv('zk-broadcast.js'); ?>"></script>
<script src="zankyo-viz.js?v=<?php echo zkv('zankyo-viz.js'); ?>"></script>
<!-- THE SECOND SET (S0): the CRT-9's own phosphor pipeline and its idle stream;
     no-ops headless (the probe loads every zk-*.js). zk-picture.js (映り, the
     reception characters and the impairment library) must load first: pure
     functions and constants, harmless headless. -->
<script src="zk-picture.js?v=<?php echo zkv('zk-picture.js'); ?>"></script>
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

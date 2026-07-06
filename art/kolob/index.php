<?php
$page_title = "KOLOB 𐐗𐐄𐐢𐐉𐐒 - Municipal Sky";
$page_description = "An American-utopian hymn engine: four-part harmony, fuging tunes, a Deseret-alphabet broadside and a still small voice, from a colony at the rim of Kolob's light. Nothing repeats; every meeting is one of a kind.";
$page_image = "/images/kolob-share.png";
// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx). Computed at
// request time so a changed file always ships a fresh URL.
function kolob_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}

// Build/version stamp (printed small at the foot of the page) — a way to tell
// at a glance whether the page being served is the latest deploy:
//   · VERSION  — a hand-set marker, bumped when the app changes (v0.01, v0.02…)
//   · build    — derived from the ACTUAL bytes of the served assets, so it
//                shifts the instant any JS/CSS/markup ships, with no upkeep
//   · deployed — the newest asset's mtime; the server stamps this at upload,
//                so it reads as the moment the live files landed (UTC)
$kolob_assets  = ['kolob-audio.js', 'kolob-ui.js', 'kolob-viz.js', 'kolob-text.js', 'kolob.css', 'index.php'];
$kolob_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$kolob_build   = substr(md5(implode('', array_map('kolob_v', $kolob_assets))), 0, 6);
$kolob_mtime   = 0;
foreach ($kolob_assets as $kolob_a) {
    $kolob_p = __DIR__ . '/' . $kolob_a;
    if (is_file($kolob_p)) { $kolob_m = filemtime($kolob_p); if ($kolob_m > $kolob_mtime) $kolob_mtime = $kolob_m; }
}
$kolob_deployed = $kolob_mtime ? gmdate('Y-m-d H:i', $kolob_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>

<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Noto+Sans+Deseret&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="kolob.css?v=<?php echo kolob_v('kolob.css'); ?>" />

<div class="main-wrapper">
 <div class="kolob-scene">
  <div class="content-frame kolob-frame">

    <!-- Corner toggles: a flex row, so the buttons space themselves however
         wide their labels render (the script toggle grows in Deseret). -->
    <div class="kolob-toggles">
      <!-- The Whole switch: cycles the cumulative-form governor — guaranteed
           (solid gilt) / natural 8% (outline) / never (struck). A cumulative
           meeting withholds the tune until the doxology sings it whole. -->
      <button type="button" class="kolob-latin-toggle kolob-cumulative-toggle is-deseret" id="kolob-cumulative" aria-label="the tune withheld until the doxology — about one meeting in twelve" aria-pressed="false">𐐐𐐄𐐢</button>
      <!-- The Ives switch: while on, every meeting is guaranteed a visitation
           (the unanswered question or the two bands). Checking it restarts the
           meeting so the guarantee begins at once. -->
      <button type="button" class="kolob-latin-toggle kolob-ives-toggle is-deseret" id="kolob-ives" aria-label="guarantee an Ives visitation (restarts the meeting)" aria-pressed="false">𐐌𐐚𐐞</button>
      <!-- Dev script toggle: Deseret <-> Latin labels (development aid) -->
      <button type="button" class="kolob-latin-toggle" id="kolob-latin" aria-label="switch to the Latin alphabet">Latin</button>
    </div>

    <!-- Title page -->
    <header class="kolob-header">
      <h1 class="kolob-title">𐐗𐐄𐐢𐐉𐐒</h1>
      <p class="kolob-subtitle">𐐊 𐐐𐐆𐐣 𐐇𐐤𐐖𐐆𐐤 𐐈𐐓 𐐜 𐐡𐐆𐐣 𐐊𐐚 𐐜 𐐢𐐌𐐓</p>
      <div class="kolob-rule" aria-hidden="true"></div>
    </header>

    <!-- The organ: the tabernacle facade as a spectrum analyzer -->
    <div class="kolob-organ-wrap">
      <canvas id="kolob-organ" class="kolob-organ" aria-label="the tabernacle organ pipes, breathing with the music"></canvas>
    </div>

    <!-- The page (shape-note engraving) -->
    <div class="kolob-viz-wrap">
      <canvas id="kolob-viz" class="kolob-viz" aria-label="shape-note engraving of the music as it plays"></canvas>
    </div>

    <!-- Running head + the Liahona -->
    <div class="kolob-head-row">
      <div class="kolob-telemetry" id="kolob-telemetry" aria-label="meeting telemetry">𐐜 𐐚𐐈𐐢𐐆 𐐆𐐞 𐐝𐐓𐐆𐐢</div>
      <canvas id="kolob-dial" class="kolob-dial" aria-label="the Liahona dial"></canvas>
    </div>

    <!-- Transport -->
    <div class="kolob-transport">
      <button type="button" class="kolob-btn play-btn" id="kolob-play" aria-label="play"><span class="kolob-btn-glyph">&#9654;&#xFE0E;</span>&nbsp; 𐐑𐐢𐐁</button>
      <button type="button" class="kolob-btn stop-btn" id="kolob-stop" aria-label="stop"><span class="kolob-btn-glyph kolob-glyph-stop">&#9632;&#xFE0E;</span>&nbsp; 𐐝𐐓𐐉𐐑</button>
      <div class="kolob-transport-spacer"></div>
      <span class="kolob-ctl-label">𐐚𐐉𐐢</span>
      <input type="range" min="0" max="100" value="60" class="kolob-range" id="kolob-master-vol" aria-label="master volume" />
    </div>

    <!-- Order of service + hymn board -->
    <div class="kolob-columns">
      <div class="kolob-order-block">
        <div class="kolob-sec-head">𐐃𐐡𐐔𐐊𐐡 𐐊𐐚 𐐝𐐊𐐡𐐚𐐆𐐝</div>
        <div id="kolob-order" aria-label="order of service"></div>
      </div>
      <div class="kolob-board-block">
        <div class="kolob-sec-head">𐐐𐐆𐐣 𐐒𐐄𐐡𐐔</div>
        <div class="kolob-board">
          <div class="kolob-seed-row">
            <span class="kolob-ctl-label">𐐝𐐀𐐔</span>
            <span class="kolob-seed-current" id="kolob-seed-current">—</span>
            <input type="text" inputmode="numeric" class="kolob-seed-input" id="kolob-seed-input" aria-label="seed for a new gathering" />
            <button type="button" class="kolob-btn kolob-btn-board" id="kolob-gather" aria-label="reseed and restart">𐐘𐐈𐐜𐐊𐐡</button>
            <div class="kolob-board-nums" id="kolob-board-nums"><span class="kolob-board-card">—</span></div>
          </div>
        </div>
        <!-- The broadside — seated beneath the board to keep the page short -->
        <div class="kolob-broadside-block">
          <div class="kolob-sec-head">𐐜 𐐒𐐡𐐃𐐔𐐝𐐌𐐔</div>
          <div class="kolob-broadside-line" id="kolob-broadside-line" aria-label="the broadside verse">𐑄 𐑂𐐰𐑊𐐮 𐐮𐑆 𐑅𐐻𐐮𐑊</div>
        </div>
      </div>
    </div>

    <!-- The stops -->
    <div class="kolob-stops-block">
      <div class="kolob-sec-head">𐐜 𐐝𐐓𐐉𐐑𐐝</div>
      <div id="kolob-layers"></div>
    </div>

    <!-- Clerk's minutes -->
    <div class="kolob-log-block">
      <div class="kolob-sec-head">𐐗𐐢𐐊𐐡𐐗𐐝 𐐣𐐆𐐤𐐆𐐓𐐝</div>
      <div id="kolob-log" class="kolob-log" aria-label="the clerk's minutes">
        <div class="kolob-log-empty">𐐑𐐡𐐇𐐝 𐐑𐐢𐐁</div>
      </div>
    </div>

    <!-- Colophon -->
    <p class="kolob-note">
      <a href="/art/" id="kolob-art-link" aria-label="the generative art series">𐐂𐐡𐐓</a>
      &nbsp;·&nbsp;
      <a href="/art/zankyo/" aria-label="sibling engine ZANKYO">&#27531;&#38911;</a>
      &nbsp;·&nbsp;
      <a href="/art/bardo/" aria-label="sibling engine BARDO">&#3926;&#3928;&#3921;&#3964;</a>
    </p>

    <!-- Build stamp: version · content fingerprint · deploy time. A quiet way
         to confirm which build is actually live. -->
    <p class="kolob-build" aria-label="build version">
      <?php echo htmlspecialchars($kolob_version); ?><span class="kolob-build-sep">·</span><?php echo $kolob_build; ?><?php if ($kolob_deployed): ?><span class="kolob-build-sep">·</span><?php echo $kolob_deployed; ?><?php endif; ?>
    </p>

  </div>
 </div>
</div>

<script src="../background-audio.js?v=<?php echo kolob_v('../background-audio.js'); ?>"></script>
<script src="kolob-audio.js?v=<?php echo kolob_v('kolob-audio.js'); ?>"></script>
<script>if(!window.KolobAudio)console.error("KOLOB AUDIO ENGINE FAILED TO LOAD");</script>
<script src="kolob-text.js?v=<?php echo kolob_v('kolob-text.js'); ?>"></script>
<script src="kolob-viz.js?v=<?php echo kolob_v('kolob-viz.js'); ?>"></script>
<script src="kolob-ui.js?v=<?php echo kolob_v('kolob-ui.js'); ?>"></script>

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
        body: JSON.stringify({ page: "kolob", event_type: eventType, label: label || null }),
      }).catch(function () {});
    }
    track("page_view", null);
    var played = false;
    var playBtn = document.getElementById("kolob-play");
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

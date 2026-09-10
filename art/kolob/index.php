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

    <!-- Title page: the title and its double rule. The edition switches that
         once rode a masthead above the title now sit in the colophon at the
         foot of the page (v0.16). -->
    <header class="kolob-header">
      <h1 class="kolob-title">𐐗𐐄𐐢𐐉𐐒</h1>
      <div class="kolob-rule" aria-hidden="true"></div>
    </header>

    <!-- The plates: two engravings in one column, at one rhythm — the wheel
         (with the organ facade standing inside it), then the staff. -->

    <!-- Order of service: the crown of a wheel. The seven sections are seated
         round the rim of one great wheel and the page shows only its crown, a
         sun low on the horizon. The section now playing is lettered at the
         crown beneath ONE fixed gilt arc that fills as the section plays; when
         it is full the wheel turns anticlockwise a seat beneath it and the arc
         fills again. Inside the wheel's hour ring, standing on the horizon,
         the tabernacle organ facade — a spectrum analyzer as black pipe
         silhouettes — breathes with the music. Drawn by kolob-viz.js
         (drawWheel, drawFacade); the horizon rule is the divider between this
         plate and the staff beneath. The live region speaks the seat and its
         progress for readers who cannot see it. -->
    <div class="kolob-wheel-wrap">
      <canvas id="kolob-wheel" class="kolob-wheel" aria-label="the order of service — a wheel turning beneath one arc, the tabernacle organ pipes breathing inside it"></canvas>
      <div id="kolob-wheel-live" class="kolob-visually-hidden" aria-live="polite"></div>
    </div>

    <!-- The page (shape-note engraving) -->
    <div class="kolob-viz-wrap">
      <canvas id="kolob-viz" class="kolob-viz" aria-label="shape-note engraving of the music as it plays"></canvas>
    </div>

    <!-- The console (v0.22): one row on the paper — PLAY a solid ink dot,
         STOP a ringed one, glyph only (play turns gilt while the meeting
         runs); then the volume slider, an ink line with a brass hexagon for
         its thumb, the beehive of the Deseret theme. One hairline beneath.
         One row at every width; the VOL caption drops on a phone. The
         Liahona dial that once sat at the row's end is gone — the wheel
         does its work. -->
    <div class="kolob-console">
      <div class="kolob-transport">
        <button type="button" class="kolob-knob play-btn" id="kolob-play" aria-label="play"><svg class="kolob-knob-glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 2.4v11.2L13.4 8z" fill="currentColor"/></svg></button>
        <button type="button" class="kolob-knob stop-btn" id="kolob-stop" aria-label="stop"><svg class="kolob-knob-glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.6" y="3.6" width="8.8" height="8.8" fill="currentColor"/></svg></button>
        <div class="kolob-transport-spacer"></div>
        <span class="kolob-ctl-label">𐐚𐐉𐐢</span>
        <input type="range" min="0" max="100" value="60" class="kolob-range kolob-lever" id="kolob-master-vol" aria-label="master volume" />
      </div>
    </div>

    <!-- Hymn board + broadside. The board holds a printed PROGRAMME card
         (v0.20): the day in small capitals under a short double rule; the
         mode and the meter (during a hymn) beneath, with the direction line
         (stillness, fuging, the question, two bands, the steeples answer, the
         whole tune) as a gilt rubric on the same line; and the day's numbers
         (theme, develops, answers) as one printed line. Idle, the card says
         the valley is still. The seed row sits on the green beneath the card.
         The broadside verse sits beside, centred on the board's height. -->
    <div class="kolob-columns">
      <div class="kolob-board-block" aria-label="the hymn board">
        <div class="kolob-board">
          <div class="kolob-prog" id="kolob-running-head" aria-label="the programme: day, mode, meter, direction and the day's numbers">
            <div class="kolob-prog-day" id="kolob-rh-left">𐐜 𐐚𐐈𐐢𐐆 𐐆𐐞 𐐝𐐓𐐆𐐢</div>
            <div class="kolob-prog-rule" aria-hidden="true"></div>
            <div class="kolob-prog-line"><span class="kolob-prog-mm" id="kolob-rh-mm"></span><span class="kolob-direction" id="kolob-direction" aria-label="performance direction"></span></div>
            <div class="kolob-board-nums" id="kolob-board-nums"><span class="kolob-board-n">—</span></div>
          </div>
          <div class="kolob-seed-row">
            <span class="kolob-ctl-label">𐐝𐐀𐐔</span>
            <span class="kolob-seed-current" id="kolob-seed-current">—</span>
            <input type="text" inputmode="numeric" class="kolob-seed-input" id="kolob-seed-input" aria-label="seed for a new gathering" />
            <button type="button" class="kolob-btn kolob-btn-board" id="kolob-gather" aria-label="reseed and restart">𐐘𐐈𐐜𐐊𐐡</button>
          </div>
        </div>
      </div>
      <div class="kolob-broadside-block" aria-label="the broadside">
        <div class="kolob-broadside-line" id="kolob-broadside-line" aria-label="the broadside verse">𐑄 𐑂𐐰𐑊𐐮 𐐮𐑆 𐑅𐐻𐐮𐑊</div>
      </div>
    </div>

    <!-- Clerk's minutes -->
    <div class="kolob-log-block">
      <div class="kolob-sec-head">𐐗𐐢𐐊𐐡𐐗𐐝 𐐣𐐆𐐤𐐆𐐓𐐝</div>
      <div id="kolob-log" class="kolob-log" aria-label="the clerk's minutes">
        <div class="kolob-log-empty">𐐑𐐡𐐇𐐝 𐐑𐐢𐐁</div>
      </div>
    </div>

    <!-- The instruments — a collapsible console with a copy-parameters button.
         Seated last, beneath the minutes, and closed by default: a drawer for
         the curious, not part of the page as read. -->
    <div class="kolob-stops-block">
      <button type="button" class="kolob-sec-head kolob-instruments-head" id="kolob-instruments-head" aria-expanded="false" aria-controls="kolob-instruments-body">
        <span class="kolob-collapse-caret" aria-hidden="true"></span>
        <span class="kolob-sec-head-label">𐐜 𐐆𐐤𐐝𐐓𐐡𐐊𐐣𐐊𐐤𐐓𐐝</span>
      </button>
      <div class="kolob-instruments-body" id="kolob-instruments-body" hidden>
        <div id="kolob-layers"></div>
        <button type="button" class="kolob-btn kolob-copy-btn" id="kolob-copy-params" aria-label="copy current volume parameters">
          <span class="kolob-copy-label">𐐗𐐃𐐑𐐆 𐐑𐐊𐐡𐐈𐐣𐐊𐐓𐐊𐐡𐐞</span>
        </button>
      </div>
    </div>

    <!-- Colophon: one ruled line at the foot of the page — the series links at
         the left, the three edition switches at the right. On a narrow page
         the switches drop to a line of their own beneath the links. -->
    <div class="kolob-colophon">
      <p class="kolob-note">
        <a href="/art/" id="kolob-art-link" aria-label="the generative art series">𐐂𐐡𐐓</a>
        &nbsp;·&nbsp;
        <a href="/art/zankyo/" aria-label="sibling engine ZANKYO">&#27531;&#38911;</a>
        &nbsp;·&nbsp;
        <a href="/art/bardo/" aria-label="sibling engine BARDO">&#3926;&#3928;&#3921;&#3964;</a>
      </p>

      <!-- The edition switches: a flex row, so each button spaces itself
           however wide its label renders (the script toggle grows in Deseret). -->
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
    </div>

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

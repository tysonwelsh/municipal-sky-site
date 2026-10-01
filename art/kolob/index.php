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
//   · VERSION  — a hand-set marker, bumped when the app changes (one line,
//                v0.36.N — what the owner would notice; README.md)
//   · build    — derived from the ACTUAL bytes of the served assets, so it
//                shifts the instant any JS/CSS/markup ships, with no upkeep
//   · deployed — the newest asset's mtime; the server stamps this at upload,
//                so it reads as the moment the live files landed (UTC)
// The engine is a family of modules, loaded in the SCORE.md §1 order from the
// ONE list in _engine.php (the Jukebox v2 substrate — pj2-rand, pj2-clock,
// pj2-fx — then pitch, the score and the Earth tunes, the composers, the
// voices, the performers, and last the core that raises the KolobAudio
// facade over them). The labs read the same list; so does the harness.
$kolob_engine  = require __DIR__ . '/_engine.php';
$kolob_assets  = array_merge($kolob_engine, ['kolob-ui.js', 'kolob-viz.js', 'kolob-text.js', 'kolob.css', 'index.php', '_engine.php']);
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
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Noto+Sans+Deseret&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="kolob.css?v=<?php echo kolob_v('kolob.css'); ?>" />

<div class="main-wrapper">
 <div class="kolob-scene">
  <div class="content-frame kolob-frame">

    <!-- Title page: the title and its double rule. The edition switches sit
         in the colophon at the foot of the page. -->
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

    <!-- The console: one row on the paper — PLAY a solid ink dot,
         PAUSE and STOP ringed ones, glyph only (play turns gilt while the
         meeting runs; pause fills while the meeting is held); then the
         volume slider, an ink line with a brass hexagon for its thumb, the
         beehive of the Deseret theme. The hexagon is not the browser's thumb
         (every browser paints its own box behind that) but an SVG laid over
         the slider and moved with it by kolob-ui.js; the real thumb is
         invisible and only takes the pointer. One hairline beneath. One row
         at every width; the VOL caption drops on a phone. -->
    <div class="kolob-console">
      <div class="kolob-transport">
        <button type="button" class="kolob-knob play-btn" id="kolob-play" aria-label="play"><svg class="kolob-knob-glyph" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 2.4v11.2L13.4 8z" fill="currentColor"/></svg></button>
        <button type="button" class="kolob-knob pause-btn" id="kolob-pause" aria-label="pause" aria-pressed="false"><svg class="kolob-knob-glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.4" y="2.8" width="3.4" height="10.4" fill="currentColor"/><rect x="9.2" y="2.8" width="3.4" height="10.4" fill="currentColor"/></svg></button>
        <button type="button" class="kolob-knob stop-btn" id="kolob-stop" aria-label="stop"><svg class="kolob-knob-glyph" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.6" y="3.6" width="8.8" height="8.8" fill="currentColor"/></svg></button>
        <div class="kolob-transport-spacer"></div>
        <!-- The band's caterpillar: a volume for the Nauvoo band alone,
             there only while the band is in the
             street. It is a slider and nothing more: a dark ink line for
             its body, the pale track ahead of it, and a round head, a green
             ink disc with a paper ring inside. It inches in from the
             paper's left edge, behind the dots, the line arching up like a
             bell as it bunches, and lies down between STOP and VOL. When
             the band has gone out of hearing it turns and crawls back off.
             On a phone, where the master slider takes the row, it walks the
             console's rule beneath the dots. kolob-ui.js draws the line and
             places the head. The range beneath them is a real slider with an
             invisible thumb, as the master's is, and it is out of the tab
             order while the caterpillar is away. -->
        <div class="kolob-cat" id="kolob-cat" hidden inert>
          <input type="range" min="0" max="150" step="1" value="100" class="kolob-cat-range" id="kolob-band-vol" aria-label="band volume" tabindex="-1" disabled />
          <span class="kolob-cat-track" aria-hidden="true"></span>
          <svg class="kolob-cat-draw" aria-hidden="true" focusable="false">
            <path class="kolob-cat-line" d="M0 0"/>
            <g class="kolob-cat-head">
              <circle class="kolob-cat-disc" r="7"/>
              <circle class="kolob-cat-ring" r="3.4"/>
            </g>
          </svg>
        </div>
        <span class="kolob-ctl-label">𐐚𐐉𐐢</span>
        <span class="kolob-lever-wrap">
          <input type="range" min="0" max="100" value="60" class="kolob-range kolob-lever" id="kolob-master-vol" aria-label="master volume" />
          <svg class="kolob-lever-thumb" viewBox="0 0 20 22" aria-hidden="true">
            <defs><linearGradient id="kolob-brass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9c986"/><stop offset="0.55" stop-color="#8a7a45"/><stop offset="1" stop-color="#6e6136"/></linearGradient></defs>
            <polygon points="10,0.8 18.9,5.9 18.9,16.1 10,21.2 1.1,16.1 1.1,5.9" fill="url(#kolob-brass)" stroke="#3f3720" stroke-width="1"/>
            <polygon points="10,4.6 15.6,7.8 15.6,14.2 10,17.4 4.4,14.2 4.4,7.8" fill="none" stroke="#f5f0e4" stroke-opacity="0.45" stroke-width="0.9"/>
          </svg>
        </span>
      </div>
    </div>

    <!-- Hymn board + broadside. The board holds a printed PROGRAMME card:
         the day in small capitals under a short double rule; the
         mode and the meter (during a hymn) beneath, with the direction line
         (stillness, fuging, two bands, the steeples answer, an old tune, the
         whole tune) as a gilt rubric on the same line; the hymn being sung
         (its number, its Deseret name, its meter and its hymnist, from the
         typed hymn-announced); and the day's numbers (theme,
         develops, answers) as one printed line. Idle, the card says
         the valley is still. The seed row sits on the green beneath the card.
         The broadside verse sits beside, centred on the board's height. -->
    <div class="kolob-columns">
      <div class="kolob-board-block" aria-label="the hymn board">
        <div class="kolob-board">
          <div class="kolob-prog" id="kolob-running-head" aria-label="the programme: day, mode, meter, direction and the day's numbers">
            <div class="kolob-prog-day" id="kolob-rh-left">𐐜 𐐚𐐈𐐢𐐆 𐐆𐐞 𐐝𐐓𐐆𐐢</div>
            <div class="kolob-prog-rule" aria-hidden="true"></div>
            <div class="kolob-prog-line"><span class="kolob-prog-mm" id="kolob-rh-mm"></span><span class="kolob-direction" id="kolob-direction" aria-label="performance direction"></span></div>
            <div class="kolob-board-nums kolob-board-hymn" id="kolob-board-hymn" aria-label="the hymn: its number, its name, its meter and its hymnist"></div>
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

    <!-- Colophon: one ruled line at the foot of the page carrying the three
         edition switches, centred. No series links (the art index, the
         sibling engines): the owner struck them. -->
    <div class="kolob-colophon">
      <!-- The edition switches: a flex row, so each button spaces itself
           however wide its label renders (the script toggle grows in Deseret). -->
      <div class="kolob-toggles">
        <!-- The Whole switch: cycles the cumulative-form governor — guaranteed
             (solid gilt) / natural (outline; the engine's CUMULATIVE_ODDS) /
             never (struck). A cumulative meeting withholds the tune until the
             doxology sings it whole. The label below is a placeholder:
             kolob-ui.js rewrites it at load with the rate the engine reports
             (KolobAudio.getCumulativeOdds()), so no number is typed here. -->
        <button type="button" class="kolob-latin-toggle kolob-cumulative-toggle is-deseret" id="kolob-cumulative" aria-label="the tune withheld until the doxology — the natural draw" aria-pressed="false">𐐐𐐄𐐢</button>
        <!-- The Ives switch: while on, every meeting is guaranteed a visitation
             (one of the guests the switch may name; the list is in
             kolob-ui.js). Checking it restarts the meeting so the guarantee
             begins at once. -->
        <button type="button" class="kolob-latin-toggle kolob-ives-toggle is-deseret" id="kolob-ives" aria-label="guarantee an Ives visitation (restarts the meeting)" aria-pressed="false">𐐌𐐚𐐞</button>
        <!-- Dev script toggle: Deseret <-> Latin labels (development aid) -->
        <button type="button" class="kolob-latin-toggle" id="kolob-latin" aria-label="switch to the Latin alphabet">Latin</button>
      </div>
    </div>

    <!-- The room's credit. The tabernacle is a measured impulse response of
         St Margaret's Church, York (OpenAIR, University of York), licensed
         CC BY-SA 3.0 — attribution is a condition of the licence, so it is
         printed here in Latin, small, like an imprint. -->
    <p class="kolob-credit">
      the hall: St Margaret's Church, York &mdash; an impulse response from
      <a href="https://www.openair.hosted.york.ac.uk/" rel="license noopener">OpenAIR</a>, AudioLab, University of York
      (<a href="https://creativecommons.org/licenses/by-sa/3.0/" rel="license noopener">CC BY-SA 3.0</a>)
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
<!-- The engine, room by room, from _engine.php: first the Jukebox v2 substrate
     (pj2-rand's dice, pj2-clock's clock, pj2-fx's room crossfade), shared by
     relative path the way ZANKYŌ shares it and never modified from here; then
     Kolob's own rooms. The guard printed after them names any room that did
     not answer the roll call, to the console and in KOLOB._broken, which
     kolob-ui.js reads: a broken page keeps PLAY disabled. -->
<?php kolob_engine_tags($kolob_engine, 'kolob_v'); ?>
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

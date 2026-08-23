<?php
// Kimi's Take, mini — the same engine at junk-drawer loading-card size
// (the darkroom swatches run ~41% x 33% of a card on the house 9px grid).
// Meant to be iframed; opened directly it caps at swatch size and gets the
// lab bench (streams / stubborn / pause / reset). Query params: n (streams,
// default 6), stubborn (0-100, default 35), speedLo/speedHi (cells/sec,
// engine defaults when absent), words=1 (word mode: every string is one of
// the office's wait-words, the list below). The sheet fills whatever box it
// is given and re-deals itself on resize, so the frame can be any size.
function kt_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}
$kt_n    = max(2, min(64, (int) ($_GET['n'] ?? 6)));
$kt_stub = max(0, min(100, (int) ($_GET['stubborn'] ?? 35)));
$kt_words = !empty($_GET['words']);
$kt_slo  = isset($_GET['speedLo']) ? (float) $_GET['speedLo'] : null;
$kt_shi  = isset($_GET['speedHi']) ? (float) $_GET['speedHi'] : null;
// the office's wait-words (owner's sixteen, 2026-08-23 — mockup-34's list).
// The long ones simply place rarely on a small sheet: a 28-letter string
// needs 28 cells of clear spacetime, so the traffic manager deals them only
// when the weave has room. That is self-regulating, not a fault.
$kt_wait_words = [
    'LOADING', 'STAND BY', 'PLEASE WAIT', 'ONE MOMENT PLEASE', 'PENDING',
    'PROCESSING', 'PLEASE HOLD', 'ASSEMBLING', 'COMPUTING',
    'AWAITING RESPONSES', 'TRANSMISSION IN PROGRESS',
    'DO NOT ADJUST YOUR SET', 'TRANSMITTING', 'DO NOT REFRESH',
    'REMAIN SEATED', 'YOUR PATIENCE IS APPRECIATED',
];
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kimi's Take, mini</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400;1,700&display=swap" />
<link rel="stylesheet" href="kimis-take.css?v=<?php echo kt_v('kimis-take.css'); ?>" />
<style>html { height: 100%; background: #f8f3e2; }</style>
</head>
<body class="cr-mini-page">
<div class="cr-sheet cr-mini"><span class="cr-rain" id="cr-rain" aria-hidden="true"></span></div>

<!-- the lab bench — solo viewing only (html.is-solo); the junk drawer's
     frame never shows it. Same dials as the piece's own page -->
<div class="cr-mini-bench">
  <p class="cr-dial">
    <label for="cr-streams">streams</label>
    <input type="range" id="cr-streams" min="2" max="64" step="2" value="<?php echo $kt_n; ?>" />
    <span id="cr-streams-n"><?php echo $kt_n; ?></span>
    <span id="cr-streams-live" class="cr-dial-live"></span>
  </p>
  <p class="cr-dial">
    <label for="cr-stubborn">stubborn</label>
    <input type="range" id="cr-stubborn" min="0" max="100" step="5" value="<?php echo $kt_stub; ?>" />
    <span id="cr-stubborn-n"><?php echo $kt_stub; ?>%</span>
    <button id="cr-pause" type="button">pause</button>
    <button id="cr-reset" type="button">reset</button>
  </p>
</div>

<script src="kimis-take.js?v=<?php echo kt_v('kimis-take.js'); ?>"></script>
<script>
  (function () {
    /* opened directly (not iframed into the junk drawer), the sheet caps at
       swatch size and sits on white — the CSS keys off this */
    if (window === window.top) document.documentElement.className = 'is-solo';
    var host = document.getElementById('cr-rain');
    var dial = document.getElementById('cr-streams');
    var out = document.getElementById('cr-streams-n');
    var WORDS = <?php echo $kt_words ? json_encode($kt_wait_words) : 'null'; ?>;
    var SPEED = <?php echo ($kt_slo !== null && $kt_shi !== null)
        ? '[' . json_encode($kt_slo) . ',' . json_encode($kt_shi) . ']'
        : 'null'; ?>;
    var POINTS = ['d', 'u', 'r', 'l'];
    function dirsFor(n) {
      var d = [];
      for (var i = 0; i < n; i++) d.push(POINTS[i % 4]);
      return d;
    }
    function mount() {
      var o = {
        dirs: dirsFor(+dial.value),
        stubbornP: +stub.value / 100
      };
      if (WORDS) o.words = WORDS;
      if (SPEED) {
        o.speedMin = Math.min(SPEED[0], SPEED[1]);
        o.speedSpan = Math.abs(SPEED[1] - SPEED[0]);
      }
      window.KimisTake.mount(host, o);
    }
    /* sliding remounts, but only once the thumb stops moving */
    var t = null;
    dial.addEventListener('input', function () {
      out.textContent = dial.value;
      clearTimeout(t);
      t = setTimeout(mount, 200);
    });
    /* the stubborn share is live: it changes what the planner deals next,
       no remount */
    var stub = document.getElementById('cr-stubborn');
    var stubOut = document.getElementById('cr-stubborn-n');
    stub.addEventListener('input', function () {
      stubOut.textContent = stub.value + '%';
      window.KimisTake.set({ stubbornP: +stub.value / 100 });
    });
    /* pause freezes the piece's own clock; reset re-deals and runs */
    var pauseBtn = document.getElementById('cr-pause');
    pauseBtn.addEventListener('click', function () {
      if (window.KimisTake.paused()) {
        window.KimisTake.resume();
        pauseBtn.textContent = 'pause';
      } else {
        window.KimisTake.pause();
        pauseBtn.textContent = 'play';
      }
    });
    document.getElementById('cr-reset').addEventListener('click', function () {
      window.KimisTake.resume();
      pauseBtn.textContent = 'pause';
      mount();
    });
    mount();
    /* the frame can be any size — a resize changes the grid, so re-deal,
       once the dragging stops */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(mount, 320);
    });
    /* what the traffic manager actually placed */
    var liveOut = document.getElementById('cr-streams-live');
    setInterval(function () {
      var s = window.KimisTake.stats();
      liveOut.textContent = s.live + ' of ' + s.slots + ' placed';
    }, 1000);
  })();
</script>
</body>
</html>

<?php
$page_title = "Kimi's Take - Municipal Sky";
$page_description = 'A spin-off of The Carbon Rain: four streams of characters from 73 writing systems — one falling, one rising, one running left, one running right — cross a sheet of engineering paper at once, timed by a spacetime reservation table so they never touch.';

// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx), computed at
// request time so a changed file always ships a fresh URL.
function kt_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}

// Build/version stamp, the house way: a hand-set VERSION, a build hash derived
// from the actual served bytes, and the newest asset's mtime as the deploy time.
// It is the only text on the page — the piece explains itself or it does not.
$cr_assets   = ['kimis-take.js', 'kimis-take.css', 'index.php'];
$cr_version  = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$cr_number   = $cr_version === 'dev' ? 'dev' : explode(' ', $cr_version)[0];
$cr_build    = substr(md5(implode('', array_map('kt_v', $cr_assets))), 0, 6);
$cr_mtime    = 0;
foreach ($cr_assets as $cr_a) {
    $cr_p = __DIR__ . '/' . $cr_a;
    if (is_file($cr_p)) { $cr_m = filemtime($cr_p); if ($cr_m > $cr_mtime) $cr_mtime = $cr_m; }
}
$cr_deployed = $cr_mtime ? gmdate('Y-m-d H:i', $cr_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>
<link rel="stylesheet" href="kimis-take.css?v=<?php echo kt_v('kimis-take.css'); ?>" />

<div class="main-wrapper cr-page">

  <!-- The sheet, and nothing else. The rain is built into it by
       kimis-take.js, which measures this box first: the glyph grid is
       absolute px, so a wider sheet simply carries more columns. -->
  <div class="cr-sheet"><span class="cr-rain" id="cr-rain" aria-hidden="true"></span></div>

  <!-- the lab bench: how many streams the cast holds, what share of them
       carry a commission, and pause/play/reset for watching closely. The
       placed readout shows what the traffic manager could actually place —
       turn streams up to 256 and watch spacetime fill until births start
       failing and the sheet thins itself -->
  <p class="cr-dial">
    <label for="cr-streams">streams</label>
    <input type="range" id="cr-streams" min="4" max="256" step="4" value="8" />
    <span id="cr-streams-n">8</span>
    <span id="cr-streams-live" class="cr-dial-live"></span>
  </p>
  <p class="cr-dial">
    <label for="cr-stubborn">stubborn</label>
    <input type="range" id="cr-stubborn" min="0" max="100" step="5" value="35" />
    <span id="cr-stubborn-n">35%</span>
    <button id="cr-pause" type="button">pause</button>
    <button id="cr-reset" type="button">reset</button>
  </p>

  <p class="cr-build">v<?php echo htmlspecialchars($cr_number); ?><span class="cr-build-sep">&middot;</span><?php echo $cr_build; ?><?php if ($cr_deployed): ?><span class="cr-build-sep">&middot;</span><?php echo $cr_deployed; ?><?php endif; ?></p>

</div>

<script src="kimis-take.js?v=<?php echo kt_v('kimis-take.js'); ?>"></script>
<script>
  (function () {
    var host = document.getElementById('cr-rain');
    var dial = document.getElementById('cr-streams');
    var out = document.getElementById('cr-streams-n');
    /* the cast, dealt round-robin: n streams, one compass point each in turn,
       so 8 is two per direction, 32 is eight */
    var POINTS = ['d', 'u', 'r', 'l'];
    function dirsFor(n) {
      var d = [];
      for (var i = 0; i < n; i++) d.push(POINTS[i % 4]);
      return d;
    }
    function mount() {
      window.KimisTake.mount(host, { dirs: dirsFor(+dial.value) });
    }
    mount();
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
    /* the sheet is sized off the viewport, so a resize changes the grid —
       rebuild, but only once the dragging stops */
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
<?php include '../../includes/footer.php'; ?>

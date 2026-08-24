<?php
$page_title = 'Rain of Babel - Municipal Sky';
$page_description = 'A rain of characters from 73 writing systems — Greek, Cherokee, Deseret, Devanagari, Tibetan, Chinese, Linear B — falling down a sheet of engineering paper, crashing on the bottom rule and drifting into a heap. No column ever repeats.';

// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx), computed at
// request time so a changed file always ships a fresh URL.
function rb_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}

// Build/version stamp, the house way: a hand-set VERSION, a build hash derived
// from the actual served bytes, and the newest asset's mtime as the deploy time.
// It is the only text on the page — the piece explains itself or it does not.
$rb_assets   = ['rain-of-babel.js', 'rain-of-babel.css', 'index.php'];
$rb_version  = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$rb_number   = $rb_version === 'dev' ? 'dev' : explode(' ', $rb_version)[0];
$rb_build    = substr(md5(implode('', array_map('rb_v', $rb_assets))), 0, 6);
$rb_mtime    = 0;
foreach ($rb_assets as $rb_a) {
    $rb_p = __DIR__ . '/' . $rb_a;
    if (is_file($rb_p)) { $rb_m = filemtime($rb_p); if ($rb_m > $rb_mtime) $rb_mtime = $rb_m; }
}
$rb_deployed = $rb_mtime ? gmdate('Y-m-d H:i', $rb_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>
<link rel="stylesheet" href="rain-of-babel.css?v=<?php echo rb_v('rain-of-babel.css'); ?>" />

<div class="main-wrapper rb-page">

  <!-- one sheet: the pile. The rain falls, crashes on the bottom rule, and
       what it throws comes to rest and accumulates. -->
  <div class="rb-sheet"><span class="rb-rain" id="rb-rain-pile" aria-hidden="true"></span></div>

  <!-- the control panel. The slider rows are dealt by the inline script from
       one table of dials, into the three empty fieldsets below. -->
  <div class="rb-panel" id="rb-panel">
    <div class="rb-panel-actions">
      <button type="button" class="rb-pause" aria-pressed="false">Pause</button>
      <button type="button" class="rb-reset">Reset</button>
      <button type="button" class="rb-copy">Copy settings</button>
      <output class="rb-count">&mdash;</output>
    </div>
    <div class="rb-panel-groups">
      <fieldset class="rb-group" data-group="rain"><legend>The rain</legend></fieldset>
      <fieldset class="rb-group" data-group="crash"><legend>The crash</legend></fieldset>
      <fieldset class="rb-group" data-group="pool"><legend>The pool</legend></fieldset>
    </div>
  </div>

  <p class="rb-build">v<?php echo htmlspecialchars($rb_number); ?><span class="rb-build-sep">&middot;</span><?php echo $rb_build; ?><?php if ($rb_deployed): ?><span class="rb-build-sep">&middot;</span><?php echo $rb_deployed; ?><?php endif; ?></p>

</div>

<script src="rain-of-babel.js?v=<?php echo rb_v('rain-of-babel.js'); ?>"></script>
<script>
  (function () {
    var CR = window.RainOfBabel;
    var host = document.getElementById('rb-rain-pile');
    var panel = document.getElementById('rb-panel');
    var count = panel.querySelector('.rb-count');

    /* THE DIALS. Every value is an integer (percent of the tuned default,
       except `cap`, which is a plain count), which keeps the shareable URL
       short and unambiguous. `live` says which mechanism a dial reaches:
       a live dial is read by the physics at every launch, so CR.tune()
       turns it on the running sheet; the rest shape the columns themselves
       and only take hold when the sheet is rebuilt (a slide rebuilds after
       a beat; Reset rebuilds at once). */
    /* The defaults are the darkroom mockup's desk (mockups/mockup-31-drift-
       loader.html), translated onto this engine's base ranges — the tuning
       the owner liked: throws about half as far, arcs a quarter as high,
       short sparse runs, and a shallow heap that reads as letters lying on
       letters rather than sediment. */
    var DIALS = [
      { k: 'den', g: 'rain',  label: 'Columns',    min: 2,   max: 100,  step: 1,   def: 36,   live: false, u: '%' },
      { k: 'spd', g: 'rain',  label: 'Fall speed', min: 25,  max: 300,  step: 5,   def: 95,   live: false, u: '%' },
      { k: 'run', g: 'rain',  label: 'Run length', min: 30,  max: 300,  step: 10,  def: 50,   live: false, u: '%' },
      { k: 'gap', g: 'rain',  label: 'Run gap',    min: 30,  max: 300,  step: 10,  def: 220,  live: false, u: '%' },
      { k: 'thr', g: 'crash', label: 'Throw',      min: 0,   max: 300,  step: 5,   def: 80,   live: true,  u: '%' },
      { k: 'pop', g: 'crash', label: 'Loft',       min: 0,   max: 400,  step: 5,   def: 80,   live: true,  u: '%' },
      { k: 'spn', g: 'crash', label: 'Spin',       min: 0,   max: 300,  step: 5,   def: 90,   live: true,  u: '%' },
      { k: 'bnc', g: 'crash', label: 'Bounce',     min: 0,   max: 95,   step: 1,   def: 48,   live: true,  u: '%' },
      { k: 'grv', g: 'crash', label: 'Gravity',    min: 30,  max: 300,  step: 5,   def: 50,   live: true,  u: '%' },
      { k: 'nst', g: 'pool',  label: 'Nesting',    min: 10,  max: 95,   step: 1,   def: 68,   live: true,  u: '%' },
      { k: 'fil', g: 'pool',  label: 'Pool depth', min: 10,  max: 100,  step: 2,   def: 60,   live: true,  u: '%' },
      { k: 'cap', g: 'pool',  label: 'Sweep at',   min: 500, max: 6100, step: 100, def: 6100, live: true,  u: '',
        fmt: function (v) { return v > 6000 ? 'never' : v; } }
    ];
    /* the top of the Sweep At range means 'never': the drift holds when it
       is full instead of clearing itself */
    function capOf(v) { return v > 6000 ? Infinity : v; }

    /* a shared URL carries the dials as its query string; anything absent,
       out of range, or not a number falls back to the default */
    var val = {}, qs = new URLSearchParams(location.search);
    DIALS.forEach(function (d) {
      var v = parseInt(qs.get(d.k), 10);
      val[d.k] = isNaN(v) ? d.def : Math.min(d.max, Math.max(d.min, v));
    });

    function opts() {
      return {
        mode: 'pile',
        density: val.den / 100, speed: val.spd / 100,
        run: val.run / 100, gap: val.gap / 100,
        throwX: val.thr / 100, popY: val.pop / 100, spin: val.spn / 100,
        bounce: val.bnc / 100, gravity: val.grv / 100,
        overlap: val.nst / 100, maxFill: val.fil / 100, cap: capOf(val.cap),
        onBuilt: function (n, of) { count.textContent = n + ' of ' + of + ' columns'; }
      };
    }

    /* Building is deferred until the sheet has been laid out, so the panel
       keeps its own paused state and re-applies it after every rebuild —
       otherwise resetting a paused sheet would quietly start it running. */
    var paused = false;
    function build() {
      CR.mount(host, opts());
      if (paused) setTimeout(function () { CR.setPaused(host, true); }, 60);
    }

    /* deal the slider rows into their fieldsets */
    var bt = null;
    DIALS.forEach(function (d) {
      var grp = panel.querySelector('[data-group="' + d.g + '"]');
      var row = document.createElement('div');
      row.className = 'rb-row';
      var id = 'rb-p-' + d.k;
      var show = function (v) { return d.fmt ? d.fmt(v) : v + d.u; };
      row.innerHTML =
        '<label for="' + id + '">' + d.label + '</label>' +
        '<input type="range" id="' + id + '" min="' + d.min + '" max="' + d.max +
        '" step="' + d.step + '" value="' + val[d.k] + '">' +
        '<output for="' + id + '">' + show(val[d.k]) + '</output>';
      var input = row.querySelector('input'), out = row.querySelector('output');
      input.addEventListener('input', function () {
        val[d.k] = +input.value;
        out.textContent = show(val[d.k]);
        if (d.live) { CR.tune(host, opts()); }
        else { clearTimeout(bt); bt = setTimeout(build, 180); }
      });
      grp.appendChild(row);
    });

    var pauseBtn = panel.querySelector('.rb-pause');
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      CR.setPaused(host, paused);
      pauseBtn.textContent = paused ? 'Play' : 'Pause';
      pauseBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    });

    /* an empty sheet, started over with whatever is dialled in now */
    panel.querySelector('.rb-reset').addEventListener('click', build);

    /* the settings travel as a URL, so sharing them is pasting a link */
    var copyBtn = panel.querySelector('.rb-copy');
    copyBtn.addEventListener('click', function () {
      var q = new URLSearchParams();
      DIALS.forEach(function (d) { q.set(d.k, val[d.k]); });
      var url = location.origin + location.pathname + '?' + q.toString();
      function done(ok) {
        copyBtn.textContent = ok ? 'Copied' : 'Copy failed';
        setTimeout(function () { copyBtn.textContent = 'Copy settings'; }, 1600);
      }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        return ok;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(
          function () { done(true); }, function () { done(fallback()); });
      } else { done(fallback()); }
    });

    build();

    /* The sheet is sized off the viewport, so a resize can change how many
       columns it holds — rebuild, but only once the dragging stops, and ONLY
       if the sheet's own grid actually changed. Mobile browsers fire resize
       every time their chrome slides in or out while scrolling, with the
       sheet's size unchanged — rebuilding on those wiped the drift just for
       reading the page (owner, 2026-08-24). */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        var st = host.__pile;
        if (st && Math.floor(host.clientWidth / st.CELL) === st.cols &&
                  Math.floor(host.clientHeight / st.CELL) === st.rows) return;
        build();
      }, 320);
    });
  })();
</script>
<?php include '../../includes/footer.php'; ?>

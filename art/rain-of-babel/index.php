<?php
$page_title = 'Rain of Babel - Municipal Sky';
$page_description = 'A rain of characters from 73 writing systems — Greek, Cherokee, Deseret, Devanagari, Tibetan, Chinese, Linear B — struck one to a printed square on a sheet of engineering paper. No column ever repeats.';

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

  <?php
  // One block per sheet: the sheet, then its own controls. `mode` is what
  // rain-of-babel.js is asked to build; `density` is where its slider starts.
  $rb_sheets = [
      ['id' => 'rb-rain',        'mode' => '',       'density' => 100, 'label' => 'Falling'],
      ['id' => 'rb-rain-impact', 'mode' => 'impact', 'density' => 55,  'label' => 'Impact'],
      ['id' => 'rb-rain-pile',   'mode' => 'pile',   'density' => 34,  'label' => 'Pile'],
  ];
  foreach ($rb_sheets as $rb_s): ?>
    <div class="rb-sheet"><span class="rb-rain" id="<?php echo $rb_s['id']; ?>" aria-hidden="true"></span></div>
    <div class="rb-ctl" data-target="<?php echo $rb_s['id']; ?>" data-mode="<?php echo $rb_s['mode']; ?>">
      <button type="button" class="rb-pause" aria-pressed="false">Pause</button>
      <label for="<?php echo $rb_s['id']; ?>-d"><?php echo $rb_s['label']; ?></label>
      <input type="range" id="<?php echo $rb_s['id']; ?>-d" min="0" max="100" step="1"
             value="<?php echo $rb_s['density']; ?>">
      <output for="<?php echo $rb_s['id']; ?>-d">&mdash;</output>
    </div>
  <?php endforeach; ?>

  <p class="rb-build">v<?php echo htmlspecialchars($rb_number); ?><span class="rb-build-sep">&middot;</span><?php echo $rb_build; ?><?php if ($rb_deployed): ?><span class="rb-build-sep">&middot;</span><?php echo $rb_deployed; ?><?php endif; ?></p>

</div>

<script src="rain-of-babel.js?v=<?php echo rb_v('rain-of-babel.js'); ?>"></script>
<script>
  (function () {
    var CR = window.RainOfBabel;

    /* Each control row owns one sheet. Building is deferred until the sheet
       has been laid out, so the row keeps its own paused state and re-applies
       it after every rebuild — otherwise changing the density of a paused
       sheet would quietly start it running again. */
    function wire(row) {
      var host = document.getElementById(row.getAttribute('data-target'));
      var mode = row.getAttribute('data-mode');
      var btn = row.querySelector('.rb-pause');
      var slider = row.querySelector('input[type=range]');
      var out = row.querySelector('output');
      var paused = false;

      function build() {
        var opt = { density: slider.value / 100,
          onBuilt: function (n, of) { out.textContent = n + ' of ' + of + ' columns'; } };
        if (mode) opt.mode = mode;
        CR.mount(host, opt);
        /* mount() defers until the sheet has a size, so re-assert the pause
           after it has actually had a chance to build */
        if (paused) setTimeout(function () { CR.setPaused(host, true); }, 60);
      }

      btn.addEventListener('click', function () {
        paused = !paused;
        CR.setPaused(host, paused);
        btn.textContent = paused ? 'Play' : 'Pause';
        btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      });

      var t = null;
      slider.addEventListener('input', function () {
        out.textContent = slider.value + '%';
        clearTimeout(t);
        t = setTimeout(build, 140);
      });

      build();
      return build;
    }

    var builders = [];
    Array.prototype.forEach.call(document.querySelectorAll('.rb-ctl'), function (row) {
      builders.push(wire(row));
    });

    /* the sheets are sized off the viewport, so a resize changes how many
       columns they hold — rebuild, but only once the dragging stops */
    var rt = null;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        builders.forEach(function (b) { b(); });
      }, 320);
    });
  })();
</script>
<?php include '../../includes/footer.php'; ?>

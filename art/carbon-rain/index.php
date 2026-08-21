<?php
$page_title = 'The Carbon Rain - Municipal Sky';
$page_description = 'A falling column of characters from 73 writing systems — Greek, Cherokee, Deseret, Devanagari, Tibetan, Chinese, Linear B — struck one to a printed square on a sheet of engineering paper. A loading screen that loads nothing, forever.';

// Cache-bust local assets with an md5 content hash (?v=xxxxxxxx), computed at
// request time so a changed file always ships a fresh URL.
function cr_v($file)
{
    $path = __DIR__ . '/' . $file;
    return file_exists($path) ? substr(md5_file($path), 0, 8) : '00000000';
}

// Build/version stamp, the house way: a hand-set VERSION, a build hash derived
// from the actual served bytes, and the newest asset's mtime as the deploy time.
$cr_assets   = ['carbon-rain.js', 'carbon-rain.css', 'index.php'];
$cr_version  = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$cr_build    = substr(md5(implode('', array_map('cr_v', $cr_assets))), 0, 6);
$cr_mtime    = 0;
foreach ($cr_assets as $cr_a) {
    $cr_p = __DIR__ . '/' . $cr_a;
    if (is_file($cr_p)) { $cr_m = filemtime($cr_p); if ($cr_m > $cr_mtime) $cr_mtime = $cr_m; }
}
$cr_deployed = $cr_mtime ? gmdate('Y-m-d H:i', $cr_mtime) . ' UTC' : '';

include '../../includes/header.php';
?>
<link rel="stylesheet" href="carbon-rain.css?v=<?php echo cr_v('carbon-rain.css'); ?>" />

<div class="main-wrapper cr-page">

  <div class="cr-head">
    <h1>The Carbon Rain</h1>
    <p class="cr-dek">Seventy-three writing systems and five sets of notation &mdash;
      5,987 characters &mdash; struck one to a printed square and falling down the
      ruling of the paper itself. About one glyph in five is printed backwards:
      the film mirrors its katakana for the look, a carbon copy mirrors because
      you are reading the second sheet from behind. No column ever repeats.</p>
  </div>

  <!-- The sheet. The rain is built into it by carbon-rain.js, which measures
       this box first: at 9px to a square, a wider sheet simply carries more
       columns. -->
  <div class="cr-sheet"><span class="cr-rain" id="cr-rain" aria-hidden="true"></span></div>

  <div class="cr-foot">
    <span>Ink on engineering paper &middot; one glyph per printed square &middot;
      <a href="/art/junk-drawer/">first drawn for The Junk Drawer</a></span>
    <span class="cr-build">v<?php echo htmlspecialchars($cr_version === 'dev' ? 'dev' : explode(' ', $cr_version)[0]); ?><span class="cr-build-sep">&middot;</span><?php echo $cr_build; ?><?php if ($cr_deployed): ?><span class="cr-build-sep">&middot;</span><?php echo $cr_deployed; ?><?php endif; ?></span>
  </div>

</div>

<script src="carbon-rain.js?v=<?php echo cr_v('carbon-rain.js'); ?>"></script>
<script>
  (function () {
    var host = document.getElementById('cr-rain');
    window.CarbonRain.mount(host, { words: ['LOADING', 'STAND BY'] });
    /* the sheet is sized off the viewport, so a resize changes how many
       columns it holds — rebuild, but only once the dragging stops */
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        window.CarbonRain.mount(host, { words: ['LOADING', 'STAND BY'] });
      }, 320);
    });
  })();
</script>
<?php include '../../includes/footer.php'; ?>

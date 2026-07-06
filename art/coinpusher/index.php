<?php
// Never let the browser cache this page's HTML: the script tags below carry
// content-hashed ?v= URLs, but a cached copy of the HTML would keep pointing
// at old hashes for up to an hour (the site header's meta max-age).
header('Cache-Control: no-cache, must-revalidate, max-age=0');

$page_title = "SCRIP CREEK - Municipal Sky";
$page_description = "A coin pusher of dubious provenance, from a nickel arcade deep in the Appalachian fog. Tokens in, tokens out. The raccoon takes one.";
include '../../includes/header.php';
?>

<link rel="stylesheet" href="coinpusher.css?v=<?php echo substr(md5_file(__DIR__ . '/coinpusher.css'), 0, 8); ?>" />

<div class="coinpusher-page">
    <div class="coinpusher-stage" id="coinpusher-mount"></div>
    <p class="coinpusher-blurb">
        <em>SCRIP CREEK</em> &mdash; a coin pusher from a nickel arcade somewhere
        in the Appalachian fog. Still life: the pile, the raccoon, the dead bulb.
        The pusher starts moving soon. <span id="coinpusher-version"></span>
    </p>
</div>

<script src="../arcade/arcade-palette.js?v=<?php echo substr(md5_file(__DIR__ . '/../arcade/arcade-palette.js'), 0, 8); ?>"></script>
<script src="../arcade/arcade-sprites.js?v=<?php echo substr(md5_file(__DIR__ . '/../arcade/arcade-sprites.js'), 0, 8); ?>"></script>
<script src="../arcade/arcade-core.js?v=<?php echo substr(md5_file(__DIR__ . '/../arcade/arcade-core.js'), 0, 8); ?>"></script>
<script src="coinpusher-render.js?v=<?php echo substr(md5_file(__DIR__ . '/coinpusher-render.js'), 0, 8); ?>"></script>
<script src="coinpusher-physics.js?v=<?php echo substr(md5_file(__DIR__ . '/coinpusher-physics.js'), 0, 8); ?>"></script>
<script src="coinpusher-main.js?v=<?php echo substr(md5_file(__DIR__ . '/coinpusher-main.js'), 0, 8); ?>"></script>

<?php include '../../includes/footer.php'; ?>

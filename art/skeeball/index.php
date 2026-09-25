<?php
// Never let the browser cache this page's HTML: the script tags below carry
// content-hashed ?v= URLs, but a cached copy of the HTML would keep pointing
// at old hashes for up to an hour (the site header's meta max-age).
header('Cache-Control: no-cache, must-revalidate, max-age=0');

$page_title = "HOLLER ROLLER - Municipal Sky";
$page_description = "A deranged skee ball machine from a nickel arcade deep in the Appalachian fog. Nine balls a nickel. The possum is watching.";

// content hash for cache-busting one asset
function skv($file)
{
    $path = __DIR__ . '/' . $file;
    return is_file($path) ? substr(md5_file($path), 0, 8) : '0';
}

// Build/version stamp (ZANKYŌ pattern): VERSION number + a fingerprint of
// every asset + the newest asset's mtime. The "— summary" tail of VERSION
// stays for git history and the bump rule; the page shows the number.
$sk_assets = [
    '../arcade/arcade-core.js', '../arcade/arcade-palette.js', '../arcade/arcade-sprites.js',
    'skeeball-render.js', 'skeeball-physics.js', 'skeeball-mischief.js', 'skeeball-audio.js', 'skeeball-main.js', 'skeeball.css', 'index.php',
];
$sk_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$sk_version = trim(explode('—', $sk_version)[0]);
$sk_build = substr(md5(implode('', array_map('skv', $sk_assets))), 0, 6);
$sk_mtime = 0;
foreach ($sk_assets as $sk_a) {
    $sk_p = __DIR__ . '/' . $sk_a;
    if (is_file($sk_p)) { $sk_m = filemtime($sk_p); if ($sk_m > $sk_mtime) $sk_mtime = $sk_m; }
}
$sk_deployed = $sk_mtime ? gmdate('Y-m-d H:i', $sk_mtime) . ' UTC' : '';
include '../../includes/header.php';
?>

<link rel="stylesheet" href="skeeball.css?v=<?php echo skv('skeeball.css'); ?>" />

<div class="skeeball-page">
    <div class="skeeball-stage" id="skeeball-mount" data-version="<?php echo htmlspecialchars($sk_version); ?>"></div>
    <div class="skeeball-placard">
        <p class="skeeball-blurb">
            <em>HOLLER ROLLER</em> &mdash; Swipe up the lane. Nine balls a nickel. The possum is watching.
        </p>
        <p class="skeeball-build" aria-label="build version">
            <?php echo htmlspecialchars($sk_version); ?><span class="skeeball-build-sep">&middot;</span><?php echo $sk_build; ?><?php if ($sk_deployed): ?><span class="skeeball-build-sep">&middot;</span><?php echo $sk_deployed; ?><?php endif; ?>
        </p>
    </div>
</div>

<script src="../arcade/arcade-core.js?v=<?php echo skv('../arcade/arcade-core.js'); ?>"></script>
<script src="../arcade/arcade-palette.js?v=<?php echo skv('../arcade/arcade-palette.js'); ?>"></script>
<script src="../arcade/arcade-sprites.js?v=<?php echo skv('../arcade/arcade-sprites.js'); ?>"></script>
<script src="skeeball-render.js?v=<?php echo skv('skeeball-render.js'); ?>"></script>
<script src="skeeball-physics.js?v=<?php echo skv('skeeball-physics.js'); ?>"></script>
<?php if (is_file(__DIR__ . '/skeeball-mischief.js')): ?>
<script src="skeeball-mischief.js?v=<?php echo skv('skeeball-mischief.js'); ?>"></script>
<?php endif; ?>
<?php if (is_file(__DIR__ . '/skeeball-audio.js')): ?>
<script src="skeeball-audio.js?v=<?php echo skv('skeeball-audio.js'); ?>"></script>
<?php endif; ?>
<script src="skeeball-main.js?v=<?php echo skv('skeeball-main.js'); ?>"></script>

<?php include '../../includes/footer.php'; ?>

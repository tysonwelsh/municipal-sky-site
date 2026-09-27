<?php
// Never let the browser cache this page's HTML: the script tags below carry
// content-hashed ?v= URLs, but a cached copy of the HTML would keep pointing
// at old hashes for up to an hour (the site header's meta max-age).
header('Cache-Control: no-cache, must-revalidate, max-age=0');

$page_title = "MOTHER LODE - Municipal Sky";
$page_description = "A pachinko machine from a nickel arcade in the Appalachian fog. Behind the glass, a museum model of a working coal mine, and the little miners in it are not supposed to move. Thirteen marbles a token.";

// content hash for cache-busting one asset
function pkv($file)
{
    $path = __DIR__ . '/' . $file;
    return is_file($path) ? substr(md5_file($path), 0, 8) : '0';
}

// Build/version stamp (ZANKYŌ pattern): VERSION number + a fingerprint of
// every asset + the newest asset's mtime. The "— summary" tail of VERSION
// stays for git history and the bump rule; the page shows the number.
// the art files (pachinko-art-*.js: the kit first, then the rest by name) load
// before pachinko-render.js; missing files are skipped, so the page still
// boots (main.js falls back to its debug view) while a phase is unwritten
$pk_art = array_map('basename', glob(__DIR__ . '/pachinko-art-*.js') ?: []);
usort($pk_art, function ($a, $b) {
    if ($a === 'pachinko-art-kit.js') return -1;
    if ($b === 'pachinko-art-kit.js') return 1;
    return strcmp($a, $b);
});
$pk_scripts = array_merge([
    '../arcade/arcade-core.js', '../arcade/arcade-palette.js', '../arcade/arcade-sprites.js',
    'pachinko-board.js', 'pachinko-physics.js', 'pachinko-knockers.js', 'pachinko-mischief.js',
], $pk_art, [
    'pachinko-render.js', 'pachinko-audio.js', 'pachinko-main.js',
]);
$pk_assets = array_merge($pk_scripts, ['pachinko.css', 'index.php']);
$pk_version = trim((string) @file_get_contents(__DIR__ . '/VERSION')) ?: 'dev';
$pk_version = trim(explode('—', $pk_version)[0]);
$pk_build = substr(md5(implode('', array_map('pkv', $pk_assets))), 0, 6);
$pk_mtime = 0;
foreach ($pk_assets as $pk_a) {
    $pk_p = __DIR__ . '/' . $pk_a;
    if (is_file($pk_p)) { $pk_m = filemtime($pk_p); if ($pk_m > $pk_mtime) $pk_mtime = $pk_m; }
}
$pk_deployed = $pk_mtime ? gmdate('Y-m-d H:i', $pk_mtime) . ' UTC' : '';
include '../../includes/header.php';
?>

<link rel="stylesheet" href="pachinko.css?v=<?php echo pkv('pachinko.css'); ?>" />

<div class="pachinko-page">
    <div class="pachinko-stage" id="pachinko-mount" data-version="<?php echo htmlspecialchars($pk_version); ?>"></div>
    <div class="pachinko-placard">
        <p class="pachinko-blurb">
            <em>MOTHER LODE</em> &mdash; A working model of a coal mine, shown in section. Put a token in the coin door on the right, then click where each of thirteen marbles should fall. Space drops, the arrow keys aim, M mutes. Please do not tap the glass.
        </p>
        <p class="pachinko-build" aria-label="build version">
            <?php echo htmlspecialchars($pk_version); ?><span class="pachinko-build-sep">&middot;</span><?php echo $pk_build; ?><?php if ($pk_deployed): ?><span class="pachinko-build-sep">&middot;</span><?php echo $pk_deployed; ?><?php endif; ?>
        </p>
    </div>
</div>

<?php foreach ($pk_scripts as $pk_s): if (is_file(__DIR__ . '/' . $pk_s)): ?>
<script src="<?php echo htmlspecialchars($pk_s); ?>?v=<?php echo pkv($pk_s); ?>"></script>
<?php endif; endforeach; ?>

<?php include '../../includes/footer.php'; ?>

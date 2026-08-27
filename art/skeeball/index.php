<?php
// Never let the browser cache this page's HTML: the script tags below carry
// content-hashed ?v= URLs, but a cached copy of the HTML would keep pointing
// at old hashes for up to an hour (the site header's meta max-age).
header('Cache-Control: no-cache, must-revalidate, max-age=0');

$page_title = "HOLLER ROLLER - Municipal Sky";
$page_description = "A deranged skee ball machine from a nickel arcade deep in the Appalachian fog. Nine balls a nickel. The possum is watching.";
include '../../includes/header.php';
?>

<link rel="stylesheet" href="skeeball.css?v=<?php echo substr(md5_file(__DIR__ . '/skeeball.css'), 0, 8); ?>" />

<div class="skeeball-page">
    <div class="skeeball-stage" id="skeeball-mount"></div>
    <p class="skeeball-blurb">
        <em>HOLLER ROLLER</em> &mdash; a skee ball machine from a nickel arcade somewhere
        in the Appalachian fog. Swipe up the lane to roll. Physics prototype:
        endless balls, no nickels needed yet. <span id="skeeball-version"></span>
    </p>
</div>

<script src="skeeball-render.js?v=<?php echo substr(md5_file(__DIR__ . '/skeeball-render.js'), 0, 8); ?>"></script>
<script src="skeeball-physics.js?v=<?php echo substr(md5_file(__DIR__ . '/skeeball-physics.js'), 0, 8); ?>"></script>
<script src="skeeball-main.js?v=<?php echo substr(md5_file(__DIR__ . '/skeeball-main.js'), 0, 8); ?>"></script>

<?php include '../../includes/footer.php'; ?>

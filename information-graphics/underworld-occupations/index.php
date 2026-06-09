<?php
// PHP's built-in dev server (`php -S`) doesn't auto-append a trailing
// slash when a URL points at a directory the way Apache does. Without
// the slash, the browser resolves relative <link>/<script> URLs against
// the parent directory and silently 404s the CSS and JS, which kills
// the dashboard and SOC-tree carousel. Force the slash here.
$uri = $_SERVER['REQUEST_URI'] ?? '';
$path = strtok($uri, '?');
if ($path !== '' && substr($path, -1) !== '/') {
    $qs = strstr($uri, '?');
    header('Location: ' . $path . '/' . ($qs ?: ''), true, 301);
    exit;
}

$page_title = 'Classifying Rabelais\'s Underworld With the Bureau of Labor Statistics - Municipal Sky';
$page_description = 'A hierarchical treemap of U.S. occupations with wage distributions, RIASEC interest profiles, industry breakdowns, and employment projections — populated by the damned souls of Rabelais\'s underworld.';
include '../../includes/header.php';
?>

<!-- Extra dependencies for treemap visualization -->
<!-- Tailwind CDN intentionally removed: it generated CSS at runtime, which
     left chart containers with zero measured width during init and caused
     visualizations to render small on slower paints (notably external
     monitors). The handful of utilities the page used are now inlined at
     the top of underworld-occupations.css. -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=IM+Fell+Great+Primer:ital@0;1&family=IM+Fell+Great+Primer+SC&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Cormorant+SC:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
<link rel="stylesheet" href="underworld-occupations.css?v=8.4" />

<!-- Main Content -->
<div class="main-wrapper">
<div class="content-frame">

<?php
// Helper: pull the <body>…</body> content from a standalone HTML file,
// plus any <style> blocks from the <head> so chart-specific CSS travels
// with the body. Lets each visualization stay self-contained and
// browser-previewable.
//
// IMPORTANT: search for the real <body> tag only AFTER </head> — CSS
// comments can mention "<body>" textually, and a plain strpos would
// match that first and cut the file in the wrong place.
function extract_body_content($path) {
    $html = file_get_contents($path);

    $headEnd = stripos($html, '</head>');
    $searchFrom = $headEnd !== false ? $headEnd : 0;

    $bodyStart = stripos($html, '<body', $searchFrom);
    $bodyOpenEnd = strpos($html, '>', $bodyStart) + 1;
    $bodyEnd = strripos($html, '</body>');
    $body = substr($html, $bodyOpenEnd, $bodyEnd - $bodyOpenEnd);

    // Carry over any <style> tags from the head.
    $head = substr($html, 0, $bodyStart);
    if (preg_match_all('/<style[^>]*>[\s\S]*?<\/style>/i', $head, $m)) {
        $body = implode("\n", $m[0]) . "\n" . $body;
    }
    return $body;
}

// Main page content (intro prose + treemap dashboard + works consulted).
$pageBody = extract_body_content(__DIR__ . '/underworld-occupations.html');

// Inject the Underworld Labor Market slide deck at the marker. The deck
// is authored as a standalone, browser-previewable file; its <body> +
// <style> are pulled in by extract_body_content() and its IIFE script
// isolates itself from the host page's globals.
$deck = extract_body_content(__DIR__ . '/underworld-labor-market.html');
// Strip the standalone-only "design panel" (every slide rendered a
// second time). It's hidden on the host page anyway, but leaving it in
// would make the chart JS render every visualization twice into hidden,
// zero-width containers. The chart code guards on container existence,
// so removing the panel is safe.
$deck = preg_replace(
    '/<!--UMLM_DESIGN_PANEL_START-->.*?<!--UMLM_DESIGN_PANEL_END-->/s',
    '',
    $deck
);
$pageBody = str_replace(
    '<!--__CHART_UNDERWORLD_LABOR_MARKET__-->',
    $deck,
    $pageBody
);

// Epistemon chapter injection is disabled along with the SOC-tree
// carousel that consumed it — the carousel markup has been removed from
// underworld-occupations.html while the viewer is being rebuilt
// elsewhere. Re-enable by restoring the aside and uncommenting below.
// $chapterPath = __DIR__ . '/../../data/epistemon-chapter.html';
// if (is_file($chapterPath)) {
//     $pageBody = str_replace(
//         '<!--__EPISTEMON_CHAPTER__-->',
//         file_get_contents($chapterPath),
//         $pageBody
//     );
// }

echo $pageBody;
?>

</div>
</div>

<?php include '../../includes/footer.php'; ?>

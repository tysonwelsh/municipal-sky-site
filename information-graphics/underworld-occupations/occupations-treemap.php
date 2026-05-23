<?php
$page_title = 'U.S. Occupations Treemap - Municipal Sky';
$page_description = 'A hierarchical treemap of U.S. occupations with wage distributions, RIASEC interest profiles, industry breakdowns, and employment projections.';
include '../../includes/header.php';
?>

<!-- Extra dependencies for treemap visualization -->
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://d3js.org/d3.v7.min.js"></script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=IM+Fell+Great+Primer:ital@0;1&family=IM+Fell+Great+Primer+SC&family=Cormorant+Garamond:wght@400;500;600&display=swap"
  rel="stylesheet" />
<link rel="stylesheet" href="occupations-treemap.css" />

<?php
// Extract and output the <style> block and <body> content from the standalone HTML.
// This keeps the .html file as the single source of truth for the visualization.
$html = file_get_contents(__DIR__ . '/occupations-treemap.html');

// Extract inline <style> block from <head>
if (preg_match('/<style>(.*?)<\/style>/s', $html, $styleMatch)) {
  echo '<style>' . $styleMatch[1] . '</style>';
}
?>

<!-- Main Content -->
<div class="main-wrapper">
  <div class="content-frame">

    <?php
    // Extract body content (everything between <body...> and </body>)
    $bodyStart = strpos($html, '<body');
    $bodyStart = strpos($html, '>', $bodyStart) + 1;
    $bodyEnd = strrpos($html, '</body>');
    echo substr($html, $bodyStart, $bodyEnd - $bodyStart);
    ?>

  </div>
</div>

<?php include '../../includes/footer.php'; ?>
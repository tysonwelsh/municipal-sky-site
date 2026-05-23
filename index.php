<?php
$page_title = 'Municipal Sky';
$page_description = 'Municipal Sky - Creative explorations, digital experiments, and innovative projects';

// Poem body lives in a nowdoc so the renderer sees lines starting at column 0.
// .poem-excerpt uses white-space: pre, which would otherwise render any leading
// HTML indentation as part of each line.
$tate_poem = <<<'POEM'
...
O when all is lost,
when we have thrown our shoes in the sea,
when our watches have crawled off into weeds,
our typewriters have finally spelled perhaps
accidentally the unthinkable word,

when the rocks loosen and the sea anemones
welcome us home with their gossamer arms
dropping like a ship from the stars,

what on earth shall we speak or think of,
and who do you think you are?
POEM;

include 'includes/header.php';
?>
<!-- Main Content -->
<div class="main-wrapper">
    <div class="content-frame">
        <div class="post-container">
            <!-- Poetry Excerpt -->
            <div class="poem-excerpt width-75 position-right bleed-right"><?= $tate_poem ?>
                <div class="poem-attribution">James Tate, <cite>Images of Little Compton, Rhode Island</cite></div>
            </div>
        </div>
    </div>
    <?php include 'includes/footer.php'; ?>
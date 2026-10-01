<?php
$page_title = 'Natural Light';
$page_description = 'Natural Light';

// Poem body lives in a nowdoc so the renderer sees lines starting at column 0.
// .poem-excerpt uses white-space: pre, which would otherwise render the HTML
// indentation as part of each line.
$natural_light_poem = <<<'POEM'
Natural Light
High overhead
Natural light
High overhead

Natural high
Light overhead
Natural high
Overhead light

High light
Natural overhead



Overhead light
Natural high

High head light
Over natural
High head light
Over over
Natural natural
High high
Headlight headlight

Free range
POEM;

include '../includes/header.php';
?>
<div class="main-wrapper">
    <div class="content-frame">
        <div class="post-container">

            <h1 class="display-heading">Natural Light</h1>
            <p class="post-date">2026.03.10</p>

            <div class="poem-excerpt unframed width-75"><?= $natural_light_poem ?></div>

        </div>
    </div>
</div>
<?php include '../includes/footer.php'; ?>

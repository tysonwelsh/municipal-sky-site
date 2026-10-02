<?php
$track_page = 'information-graphics';   // anonymous page-view tally (includes/footer.php)
$page_title = 'Information Graphics - Municipal Sky';
$page_description = 'Interactive information graphics and visual explorations';
include '../includes/header.php';
?>

<!-- Main Content -->
<div class="main-wrapper">
    <div class="content-frame">
        <div class="index-wrapper">
            <!-- Section Header -->
            <h1 class="section-title">Information Graphics</h1>
            <div class="section-divider"></div>

            <!-- Entry List -->
            <div class="entry-list entry-list--undated">
                <div class="entry">
                    <div class="entry-content">
                        <a href="/information-graphics/carbon-structures" class="entry-title">Visualizing the Structure of Amorphous Carbon</a>
                        <span class="entry-description">Interactive 3D point clouds of simulated carbon atomic structures.</span>
                    </div>
                </div>
                <div class="entry">
                    <div class="entry-content">
                        <a href="/information-graphics/underworld-occupations" class="entry-title">Classifying Rabelais&rsquo;s Underworld With the Bureau of Labor Statistics</a>
                        <span class="entry-description">Renaissance satire meets federal labor data.</span>
                    </div>
                </div>
                <div class="entry">
                    <div class="entry-content">
                        <a href="/information-graphics/gendered-pronouns" class="entry-title">The Distribution of Pronouns by Gender
                            Across Classic Novels</a>
                        <span class="entry-description">Mapping masculine and feminine third-person pronouns across
                            classic literature.</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<?php include '../includes/footer.php'; ?>
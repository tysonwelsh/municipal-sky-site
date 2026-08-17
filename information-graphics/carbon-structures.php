<?php
$page_title = 'The Hidden Structure of Amorphous Carbon - Municipal Sky';
$page_description = 'Interactive 3D point clouds of simulated carbon atomic structures — coordination numbers, ring statistics, and radial distribution functions across amorphous, carbide-derived, and irradiated carbons.';
$page_type = 'article';
include '../includes/header.php';
?>

<style>
  /* ── Visualization embed: full-viewport, ignoring the site's normal frame ── */

  /* body-level section, so it escapes .content-frame's max-width and padding */
  .carbon-fullscreen {
    width: 100%;
    margin-top: 32px;
  }

  .carbon-fullscreen iframe {
    display: block;
    width: 100%;
    height: 100vh;
    border: 0;
    background: #f9f9f7;
  }
</style>

<!-- Main Content -->
<div class="main-wrapper">
  <div class="content-frame">

    <!-- Page Header -->
    <div class="post-container">
      <header>
        <h1>The Hidden Structure of Amorphous Carbon</h1>
        <p class="post-date">2026.08.17</p>
      </header>
    </div>

    <!-- Introduction -->
    <div class="post-container">
      <section class="prose-flow">
        <p>Soot, charcoal, and the diamond in a ring are all pure carbon — what differs is how the atoms connect.
          These interactive point clouds let you tumble through simulated carbon structures atom by atom: amorphous
          carbons across a range of densities, carbide-derived carbons before and after annealing, and graphite as it
          accumulates irradiation damage. Color encodes each atom's coordination number; the panels tally ring sizes,
          bond lengths, and the radial distribution function.</p>
        <p>Drag to rotate, scroll to zoom, and try the theme selector — the same data rendered as a midnight
          observatory plate, an Oppenheimer-era journal figure, or a Kandinsky composition.</p>
      </section>
    </div>

  </div>
</div>

<!-- Visualization embed: outside .content-frame, so it spans the full viewport -->
<div class="carbon-fullscreen">
  <iframe src="carbon-point-cloud/" title="Interactive carbon point cloud visualization" loading="lazy"></iframe>
</div>

<div class="main-wrapper">
  <div class="content-frame">

    <!-- Methodology note -->
    <div class="post-container">
      <section class="prose-flow">
        <p>Structures from Iwanowski, Csányi &amp; Simoncelli, <em>Bond-network entropy governs heat transport in
            coordination-disordered solids</em> (<a href="https://arxiv.org/abs/2412.12753"
            target="_blank">arXiv:2412.12753</a>), relaxed with the GAP potential. Bonds are drawn between atoms within
          1.8&nbsp;Å.</p>
      </section>
    </div>

  </div>
</div>

<?php include '../includes/footer.php'; ?>

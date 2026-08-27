<?php
$page_title = 'The Hidden Structure of Amorphous Carbon - Municipal Sky';
$page_description = 'Interactive 3D point clouds of simulated carbon atomic structures — coordination numbers, ring statistics, radial distribution functions, and bond-network entropy across amorphous, carbide-derived, and irradiated carbons.';
$page_type = 'article';
// share card: the VPC(T) 1.5 structure rendered in the viewer's Oppenheimer
// palette (regenerate with pointcloud_entropy/tools/make_og_image.py)
$page_image = '/images/carbon-structures-share.png';
include '../includes/header.php';
?>

<style>
  /* ── Visualization embed: full-viewport, ignoring the site's normal frame ── */

  /* this page hides the fixed banner on load, so it drops the body's
     banner-height padding too — the dashboard starts at the very top */
  body { padding-top: 0; }

  /* body-level section, so it escapes .content-frame's max-width and padding */
  .carbon-fullscreen {
    width: 100%;
  }

  .carbon-fullscreen iframe {
    display: block;
    width: 100%;
    height: 100vh;   /* fallback + minimum; JS below grows it to the content height */
    height: 100svh;  /* stable: doesn't change when mobile browser chrome shows/hides on scroll */
    border: 0;
    background: #f9f9f7;
  }

  /* probe: reads the stable small-viewport height in px (no pure-JS way to read svh) */
  #carbonSvhProbe {
    position: absolute; top: 0; left: 0;
    height: 100vh; height: 100svh;
    visibility: hidden; pointer-events: none;
  }

  /* banner starts hidden on load (dashboard fills the window immediately),
     stays hidden at the very top, reveals on scroll-up further down the
     page, retracts again on scroll-down (this page only) */
  .site-banner { transition: transform 0.25s ease; }
  body.carbon-banner-hidden .site-banner { transform: translateY(-100%); }
</style>

<script>
  document.body.classList.add("carbon-banner-hidden"); // hidden on first load
  (function () {
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      if (Math.abs(y - lastY) < 4) return; // ignore sub-pixel jitter
      // hidden at the very top (dashboard fills the window) and when
      // scrolling down; revealed only by scrolling up while down the page
      document.body.classList.toggle("carbon-banner-hidden", y <= 80 || y > lastY);
      lastY = y;
    }, { passive: true });
  })();
</script>

<!-- Visualization embed: at the very top, outside .content-frame, so it spans the full viewport -->
<div class="carbon-fullscreen">
  <iframe id="carbonFrame" src="carbon-point-cloud/?v=<?php echo filemtime('carbon-point-cloud/index.html'); ?>" title="Interactive carbon point cloud visualization" loading="lazy"></iframe>
</div>
<div id="carbonSvhProbe" aria-hidden="true"></div>

<script>
  /* Grow the iframe to the app's natural document height, so the dashboard
     never gets its own scrollbar — the page's scrollbar is the only one.
     The app fits its plot to THIS page's svh probe (not the iframe's own
     viewport), so the content height doesn't feed back into the iframe.
     Measure body.scrollHeight, not documentElement.scrollHeight: the latter
     is floored at the iframe's current viewport height, so it could never
     shrink the iframe again after the content gets shorter (theme switch). */
  (function () {
    const f = document.getElementById("carbonFrame");
    const probe = document.getElementById("carbonSvhProbe");
    function fit() {
      const doc = f.contentDocument;
      if (!doc || !doc.documentElement) return;
      const contentH = doc.body ? doc.body.scrollHeight : doc.documentElement.scrollHeight;
      const h = Math.max(Math.ceil(contentH), probe.offsetHeight);
      if (f.style.height !== h + "px") f.style.height = h + "px";
    }
    f.addEventListener("load", () => {
      fit();
      // content height changes on theme/structure switches, data loads, reflows
      new ResizeObserver(fit).observe(f.contentDocument.body);
    });
    // parent resize: drop back to the CSS 100svh baseline, then re-measure —
    // otherwise a stale inline height would pin the document tall forever
    window.addEventListener("resize", () => {
      f.style.height = "";
      requestAnimationFrame(() => requestAnimationFrame(fit));
    });
  })();
</script>

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
        <p>Twenty-seven simulated carbon structures in five classes: amorphous carbon (ρ&nbsp;1.5–2.9&nbsp;g/cm³),
          carbide-derived carbon (synthesized at 800 and 1200&nbsp;°C, plus an annealed variant), irradiated
          graphite (four damage stages), variable-porosity carbon, and a phase-separated phase. Atoms draw as
          points colored by coordination number; bonds join atoms within 1.8&nbsp;Å.</p>
        <p>Drag to rotate. Shift-drag to pan. Ctrl/⌘&nbsp;+&nbsp;scroll to zoom. Hover an atom for its
          coordination, rings, local topology, and coordinates; click it to spotlight it and every ring through
          it. <strong>Reset view</strong> restores the camera and clears every selection and filter.</p>
      </section>
    </div>

    <!-- Controls -->
    <div class="post-container">
      <section class="prose-flow">
        <h2>Controls</h2>
        <ul>
          <li><strong>Structure</strong> — one of the 27 models, grouped by class.</li>
          <li><strong>Theme</strong> — four palettes for the same data.</li>
          <li><strong>Color by</strong> — coordination number, or bond-network entropy (below).</li>
          <li><strong>Bonds</strong>, <strong>Rings</strong>, <strong>Bond strain</strong> — toggle bond lines;
            overlay shortest-path rings (sizes 3–10); color bonds on a compressed-red → stretched-blue ramp
            about the median length.</li>
          <li><strong>Hide gridlines</strong>, <strong>Spin</strong>, <strong>Point size</strong> — cell box and
            axes; slow auto-rotation; dot radius.</li>
          <li><strong>Fly (WASD)</strong> — first-person camera inside the cell: W/A/S/D to move, Q/E to
            descend/climb, Shift for speed, drag to look, Ctrl/⌘&nbsp;+&nbsp;scroll to dolly, Esc to exit.</li>
          <li><strong>Sequence</strong> — ordered series (irradiation damage, CDC annealing, AC densification,
            VPC density). ◀&nbsp;▶ and Play step the stages, the camera holds still between them, and the other
            stages draw as gray ghost curves in the charts.</li>
        </ul>
        <h2>Panels</h2>
        <p>Panel filters compose — every active selection ANDs with the others. The <em>i</em> badge beside each
          heading holds that panel's full explanation. On phones the g(r) and bond-length panels are hidden.</p>
        <ul>
          <li><strong>Coordination number</strong> — click a class to isolate those atoms; shift-click adds
            more.</li>
          <li><strong>Radial distribution g(r)</strong> — brush a range of r to highlight every atom pair at
            that separation (out to 5&nbsp;Å); click outside the band to clear.</li>
          <li><strong>Bond lengths</strong> — brush to select bonds by length; bars share the strain ramp.</li>
          <li><strong>Rings by size</strong> — click a size to isolate those rings; solid bars are rings drawn
            in the cloud, faded bars cross the cell boundary.</li>
        </ul>
      </section>
    </div>

    <!-- Bond-network entropy -->
    <div class="post-container">
      <section class="prose-flow">
        <h2>Bond-network entropy</h2>
        <p>The paper's disorder descriptor. Each atom's local environment — its n nearest atoms and the bonds
          among them — is classified by ring topology (its H<sub>1</sub> barcode); BNE(n) is the Shannon entropy
          of that classification over all atoms, and the per-structure number is the growth rate: the mean of
          BNE(n)/n for n&nbsp;=&nbsp;14–30. A perfect crystal scores zero; the more distinct local topologies a
          structure contains, the higher it scores.</p>
        <p>Set <strong>Color by</strong> to bond-network entropy to shade each atom by the rarity (surprisal) of
          its environment; the average of the shading equals BNE(n) exactly. In the panel, the
          <strong>Environment n</strong> slider sets the environment size; the barcode rows list the commonest
          topologies — click one to isolate its atoms, shift-click to add; the curve plots BNE(n) with the
          14–30 band shaded; the tick strip places this structure's growth rate among all 27.</p>
        <p>A worked example: Sequence → <em>Irradiation damage — IRG T2→T9</em>, Color by → bond-network
          entropy, then step the stages. The pristine graphitic class falls from 79% of atoms to 59% while the
          entropy curve lifts.</p>
      </section>
    </div>

    <!-- Methodology note -->
    <div class="post-container">
      <section class="prose-flow">
        <h2>Method</h2>
        <p>Structures from Iwanowski, Csányi &amp; Simoncelli, <em>Bond-network entropy governs heat transport in
            coordination-disordered solids</em> (<a href="https://journals.aps.org/prx/abstract/10.1103/w4p6-b9mp"
            target="_blank">Phys. Rev. X 15, 041041 (2025)</a>), relaxed with the GAP potential. Bonds are drawn
          between atoms within 1.8&nbsp;Å.</p>
        <p>The bond-network entropy is computed with the authors' own reference implementation, the
          <a href="https://github.com/MPA2suite/smooth-disorder" target="_blank">smooth-disorder</a> package, with
          every atom of every structure catalogued — no sampling. The values here reproduce the paper's
          (amorphous carbon at 2.9&nbsp;g/cm³ and 8,000 atoms: 0.240 against Fig.&nbsp;2c's&nbsp;≈0.24).
          Cells of a few hundred atoms are small enough that nearly every neighborhood in them is unique, which
          caps the entropy and understates their disorder; the panel flags this when it happens.</p>
      </section>
    </div>

  </div>
</div>

<!-- Anonymous usage tracking (site pattern): a page view only. No personal
     data leaves the browser; the server records a salted, daily-rotating
     visitor hash for unique-visit counts. The dashboard itself lives in the
     carbon-point-cloud iframe — a separate document — so interactions inside
     it aren't counted here, only arrivals at the page. -->
<script>
  (function () {
    fetch("../api/page-event-tracking.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        page: "carbon-structures",
        event_type: "page_view",
        label: null,
      }),
    }).catch(function () {});
  })();
</script>

<?php include '../includes/footer.php'; ?>

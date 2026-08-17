<?php
$page_title = 'The Hidden Structure of Amorphous Carbon - Municipal Sky';
$page_description = 'Interactive 3D point clouds of simulated carbon atomic structures — coordination numbers, ring statistics, and radial distribution functions across amorphous, carbide-derived, and irradiated carbons.';
$page_type = 'article';
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
     reveals on scroll-up, retracts again on scroll-down (this page only) */
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
      document.body.classList.toggle("carbon-banner-hidden", y > lastY && y > 80);
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
        <p>Soot, charcoal, and the diamond in a ring are all pure carbon — what differs is how the atoms connect.
          These interactive point clouds let you tumble through simulated carbon structures atom by atom: amorphous
          carbons across a range of densities, carbide-derived carbons before and after annealing, and graphite as it
          accumulates irradiation damage. Color encodes each atom's coordination number; the panels tally ring sizes,
          bond lengths, and the radial distribution function.</p>
        <p>Drag to rotate, hold Ctrl/⌘ and scroll to zoom, and try the theme selector — the same data rendered as a midnight
          observatory plate, an Oppenheimer-era journal figure, or a Kandinsky composition.</p>
      </section>
    </div>

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

<?php
$page_title = 'Visualizing the Structure of Amorphous Carbon - Municipal Sky';
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
        <h1>Visualizing the Structure of Amorphous Carbon</h1>
        <p class="post-date">2026.08.17</p>
      </header>
    </div>

    <!-- The story: how the dashboard came to be (draft — 2026-09-12) -->
    <div class="post-container">
      <section class="prose-flow">
        <p>I made this dashboard in collaboration with
          <a href="https://journals.aps.org/prx/abstract/10.1103/w4p6-b9mp" target="_blank">Kamil Iwanowski</a>, a
          researcher and PhD candidate in physics at NYU whose work is on the design of materials.</p>
        <p>I met Kamil at an event in Brooklyn, where we connected over our shared interest in data visualizations.
          When he showed me some of the visualizations he had made for his research, I asked if he had considered
          using D3.js, a JavaScript library for making bespoke data visualizations. I shared some of the other
          visualizations I've made to show what sets D3 apart from other tools, and Kamil liked what he saw. We met
          up again on a Sunday afternoon and built this dashboard using Claude Code.</p>
        <p>To be honest, I don't fully understand the science behind these data. My interest in making it was
          primarily as an exercise in data storytelling, in addition to exploring how well Claude could handle
          processing and visualizing data used in actual frontier research. In other words, I wanted to make
          something that looks cool by giving Kamil's existing research visualizations an interactive makeover with
          D3.js.</p>
        <p>However, along the way we ended up making something that adds value beyond Kamil's previous dashboards.
          Specifically, with this dashboard the user can filter the main visualization by selecting a ring size in
          the <em>Rings by size</em> panel on the right. Doing so highlights those rings in the 3D diagram, showing
          their position relative to the other rings in the structure. Although Kamil's previous dashboards
          depicted the counts of different types of rings, they did not allow for this kind of interactive
          filtering that displays the rings' positions.</p>
        <p>You can read more about Kamil's research
          <a href="https://journals.aps.org/prx/abstract/10.1103/w4p6-b9mp" target="_blank">here</a>, or view the
          source code for this dashboard on
          <a href="https://github.com/tysonwelsh/municipal-sky-site/tree/main/information-graphics/carbon-point-cloud"
            target="_blank">GitHub</a>.</p>
      </section>
    </div>

    <!-- Methodology note -->
    <div class="post-container">
      <section class="prose-flow">
        <h2>About the data</h2>
        <p>Structures from Iwanowski, Csányi &amp; Simoncelli, <em>Bond-network entropy governs heat transport in
            coordination-disordered solids</em> (<a href="https://journals.aps.org/prx/abstract/10.1103/w4p6-b9mp"
            target="_blank">Phys. Rev. X 15, 041041 (2025)</a>), relaxed with the GAP potential. Bonds are drawn
          between atoms within 1.8&nbsp;Å.</p>
        <p>The bond-network entropy shown in the dashboard is computed with the authors' own
          <a href="https://github.com/MPA2suite/smooth-disorder" target="_blank">smooth-disorder</a> package.</p>
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

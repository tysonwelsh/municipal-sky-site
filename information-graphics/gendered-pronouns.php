<?php
$page_title = 'The Distribution of Pronouns by Gender Across Classic Novels - Municipal Sky';
$page_description = 'Visualizing the distribution of masculine and feminine third-person pronouns across classic novels, with an episode-by-episode breakdown of James Joyce\'s Ulysses.';
include '../includes/header.php';
?>

<!-- D3.js for visualizations -->
<script src="https://d3js.org/d3.v7.min.js"></script>
<!-- html2canvas for PNG export -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<!-- Jost font for viz-internal labels (chart axis labels, legend text) -->
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet" />

<style>
  /* ── Visualization-specific styles (scoped to this page) ── */

  .viz-section {
    margin-bottom: 0;
  }

  .viz-title {
    font-family: "Jost", sans-serif;
    font-size: 26px;
    font-weight: 600;
    color: #1a1816;
    margin-bottom: 8px;
    white-space: nowrap;
  }

  .viz-desc {
    font-family: var(--font-family-body);
    font-size: 15px;
    color: rgba(0, 0, 0, 0.6);
    max-width: 860px;
    line-height: 1.6;
    margin-bottom: 24px;
  }

  .viz-methodology {
    font-family: var(--font-family-body);
    font-size: 12px;
    color: rgba(0, 0, 0, 0.45);
    margin-top: 20px;
    line-height: 1.5;
    max-width: 900px;
  }

  .viz-methodology strong {
    font-weight: 600;
    color: rgba(0, 0, 0, 0.6);
  }

  .viz-container {
    border: 1px solid rgba(0, 0, 0, 0.1);
    padding: 48px 64px 24px 64px;
    border-radius: 4px;
    margin-top: 40px;
    overflow-x: auto;
  }

  .viz-rule {
    height: 1px;
    background: rgba(0, 0, 0, 0.1);
    margin: 48px 0;
  }

  /* Treat plots like images — fixed pixel dimensions, so labels and titles
     never rescale with viewport width. */
  .viz-section svg {
    display: block;
    margin: 0 auto;
    width: 780px;
    height: auto;
    max-width: none;
  }

  .viz-controls {
    margin-bottom: 16px;
    font-family: var(--font-family-body);
    font-size: 13px;
    color: rgba(0, 0, 0, 0.7);
  }

  .viz-controls label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .viz-controls select {
    font-family: inherit;
    font-size: 13px;
    padding: 4px 6px;
    background: #fff;
    border: 1px solid rgba(0, 0, 0, 0.2);
    cursor: pointer;
  }

  svg {
    overflow: visible;
  }

  .tooltip {
    position: absolute;
    font-family: var(--font-family-body);
    background: #fcfbf9;
    border: 1px solid rgba(0, 0, 0, 0.15);
    padding: 12px 16px;
    font-size: 13px;
    pointer-events: none;
    line-height: 1.6;
    color: #2c2825;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
    max-width: 300px;
    z-index: 1000;
  }

  .tooltip .ep-name {
    font-family: "Jost", sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #1a1816;
  }

  .tooltip .meta {
    color: rgba(0, 0, 0, 0.5);
    font-size: 12px;
    font-style: italic;
  }

  .tooltip strong {
    font-weight: 600;
  }

  .axis text {
    fill: rgba(0, 0, 0, 0.6);
    font-family: var(--font-family-body);
    font-size: 12px;
  }

  .axis path,
  .axis line {
    stroke: rgba(0, 0, 0, 0.15);
  }

  .grid line {
    stroke: rgba(0, 0, 0, 0.15);
    stroke-dasharray: 2, 2;
  }

  .grid path {
    display: none;
  }

  .label-masc {
    fill: #385572;
    font-family: "Jost", sans-serif;
    font-weight: 600;
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .label-fem {
    fill: #8c4651;
    font-family: "Jost", sans-serif;
    font-weight: 600;
    font-size: 15px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .label-sub-masc {
    fill: #385572;
    font-family: var(--font-family-body);
    font-size: 12px;
    font-style: italic;
    opacity: 0.85;
  }

  .label-sub-fem {
    fill: #8c4651;
    font-family: var(--font-family-body);
    font-size: 12px;
    font-style: italic;
    opacity: 0.85;
  }

  /* Page subtitle */
  .page-subtitle {
    font-family: var(--font-family-body);
    font-size: var(--font-size-base);
    font-style: italic;
    color: var(--color-text-light);
    line-height: 1.6;
    margin-top: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }

  /* Match text container width */
  .wide-container {
    max-width: var(--max-width-content);
    margin-top: 32px;
    margin-bottom: 32px;
  }

  .opening-lines {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    margin-top: 24px;
  }

  .opening-lines .ol-header {
    font-family: "Jost", sans-serif;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(0, 0, 0, 0.45);
    padding: 12px 24px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    background: rgba(0, 0, 0, 0.02);
  }

  .opening-lines .ol-quotes {
    display: flex;
    gap: 0;
  }

  .opening-lines .ol-quote {
    flex: 1;
    padding: 48px 24px 24px 24px;
    position: relative;
  }

  .opening-lines .ol-quote+.ol-quote {
    border-left: 1px solid rgba(0, 0, 0, 0.12);
  }

  .opening-lines .ol-quote::before {
    content: "\201C";
    font-family: "IBM Plex Serif", serif;
    font-size: 4rem;
    color: rgba(0, 0, 0, 0.15);
    position: absolute;
    top: 12px;
    left: 16px;
    line-height: 1;
  }

  .opening-lines .ol-quote .quote-text {
    font-family: var(--font-family-literary-alt);
    font-size: 1.1rem;
    line-height: 1.5;
    font-style: italic;
    color: #2c2825;
  }

  .opening-lines .ol-quote .quote-attribution {
    font-family: var(--font-family-literary);
    font-size: 0.85rem;
    font-style: normal;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.45);
    text-align: right;
    margin-top: 12px;
  }

  .opening-lines .ol-quote .quote-attribution::before {
    content: "— ";
  }

  .opening-lines .ol-caption {
    padding: 12px 24px 16px 24px;
    font-size: 14px;
    font-style: italic;
    color: rgba(0, 0, 0, 0.5);
  }

  .download-btn {
    padding: 6px 16px;
    margin-top: 16px;
    font-family: var(--font-family-body);
    font-size: 13px;
    color: rgba(0, 0, 0, 0.5);
    background: none;
    border: 1px solid rgba(0, 0, 0, 0.15);
    border-radius: 3px;
    cursor: pointer;
  }

  .download-btn:hover {
    color: rgba(0, 0, 0, 0.7);
    border-color: rgba(0, 0, 0, 0.3);
  }

  @media (max-width: 768px) {
    .viz-container {
      padding: 24px 16px;
    }
  }
</style>

<!-- Main Content -->
<div class="main-wrapper">
  <div class="content-frame">

    <!-- Page Header -->
    <div class="post-container">
      <header>
        <h1>The Distribution of Pronouns by Gender Across Classic Novels</h1>
        <p class="post-date">2026.03.13</p>
      </header>
    </div>

    <!-- Introduction -->
    <div class="post-container">
      <section class="prose-flow">
        <p>These plots look at the distribution of masculine vs. feminine first person pronouns across classic English
          language novels. </p>
      </section>
    </div>

    <!-- Viz 1: Cross-Novel Comparison -->
    <div class="wide-container">
      <div class="viz-container">
        <div class="viz-section" id="viz2"></div>
      </div>
    </div>

    <!-- Observations on cross-novel chart -->
    <div class="post-container">
      <section class="prose-flow">
        <p><strong>Stray Observations...</strong></p>
        <ul>
          <li>The only three novels with a greater share of feminine than masculine pronouns are all by women authors.
          </li>
          <li>Noted momma's boy D.H. Lawrence stands out as the only male author on the list with a more balanced
            distribution than any female author.</li>
          <li>Despite having an overwhelmingly masculine pronoun distribution, <em>Heart of Darkness</em> is one of
            only two novels on this list that includes a feminine pronoun in its opening sentence — albeit in reference
            to a ship.</li>
        </ul>
        <div class="opening-lines">
          <div class="ol-header">Two famous opening lines...</div>
          <div class="ol-quotes">
            <div class="ol-quote">
              <p class="quote-text">The <em>Nellie</em>, a cruising yawl, swung to <strong>her</strong> anchor without a
                flutter of the sails, and was at rest.</p>
              <div class="quote-attribution">Heart of Darkness</div>
            </div>
            <div class="ol-quote">
              <p class="quote-text">Mrs. Dalloway said <strong>she</strong> would buy the flowers
                <strong>herself</strong>.</p>
              <div class="quote-attribution">Mrs Dalloway</div>
            </div>
          </div>
          <div class="ol-caption">Both of these opening lines contain feminine pronouns, but only one of them is about
            an actual human woman.</div>
        </div>
      </section>
    </div>

    <!-- Transition to Ulysses chart -->
    <div class="post-container">
      <section class="prose-flow">
        <h2 style="margin-top: 48px;">A Closer Look at <em>Ulysses</em></h2>
        <p>I was somewhat surprised to see such a masculine balance for <em>Ulysses</em>, with the novel just a few
          percentage points behind Joyce's famously macho <a
            href="https://www.openculture.com/2024/06/james-joyce-picked-drunken-fights-then-hid-behind-hemingway.html"
            target="_blank">drinking buddy</a> Ernest Hemingway. However, a closer look at each of the novel's 18
          stylistically distinct episodes reveals that this balance is not evenly distributed.</p>
      </section>
    </div>

    <!-- Viz 2: Ulysses Episode Breakdown -->
    <div class="wide-container">
      <div class="viz-container">
        <div class="viz-section" id="viz1"></div>
      </div>
    </div>

    <!-- Conclusion -->
    <div class="post-container">
      <section class="prose-flow">
        <p>The <em>Nausicaa</em> episode stands out as having by far the largest share of feminine pronouns out of any
          text I looked at. Written in the style of a pulp romance novel or fashion magazine, this episode features a
          young woman who performs for the gaze of the novel's protagonist Leopold Bloom, who watches her from the beach
          while masturbating. This suggests that a count of gendered pronouns is more about who the text is looking at or
          narrative gaze, and not necessarily a measure of how much empathy the text affords to its female characters.</p>
      </section>
    </div>

  </div>
</div>

<div class="tooltip" id="tip" style="display: none"></div>

<script>
  const data = [
    { ch: 1, name: "Telemachus", part: "I", masc: 352, fem: 93, scene: "Tower", symbol: "Heir", time: "8 a.m." },
    { ch: 2, name: "Nestor", part: "I", masc: 160, fem: 18, scene: "School", symbol: "Horse", time: "10 a.m." },
    { ch: 3, name: "Proteus", part: "I", masc: 190, fem: 55, scene: "Strand", symbol: "Tide", time: "11 a.m." },
    { ch: 4, name: "Calypso", part: "II", masc: 240, fem: 156, scene: "House", symbol: "Nymph", time: "8 a.m." },
    { ch: 5, name: "Lotus Eaters", part: "II", masc: 229, fem: 65, scene: "Bath", symbol: "Eucharist", time: "10 a.m." },
    { ch: 6, name: "Hades", part: "II", masc: 469, fem: 71, scene: "Graveyard", symbol: "Caretaker", time: "11 a.m." },
    { ch: 7, name: "Aeolus", part: "II", masc: 411, fem: 12, scene: "Newspaper", symbol: "Editor", time: "Noon" },
    { ch: 8, name: "Lestrygonians", part: "II", masc: 452, fem: 196, scene: "Lunch", symbol: "Constables", time: "1 p.m." },
    { ch: 9, name: "Scylla and Charybdis", part: "II", masc: 546, fem: 86, scene: "Library", symbol: "Stratford / London", time: "2 p.m." },
    { ch: 10, name: "Wandering Rocks", part: "II", masc: 531, fem: 127, scene: "Streets", symbol: "Citizens", time: "3 p.m." },
    { ch: 11, name: "Sirens", part: "II", masc: 371, fem: 237, scene: "Concert Room", symbol: "Barmaids", time: "4 p.m." },
    { ch: 12, name: "Cyclops", part: "II", masc: 771, fem: 85, scene: "Tavern", symbol: "Fenian", time: "5 p.m." },
    { ch: 13, name: "Nausicaa", part: "II", masc: 419, fem: 684, scene: "Rocks", symbol: "Virgin", time: "8 p.m." },
    { ch: 14, name: "Oxen of the Sun", part: "II", masc: 707, fem: 249, scene: "Hospital", symbol: "Mothers", time: "10 p.m." },
    { ch: 15, name: "Circe", part: "II", masc: 1277, fem: 463, scene: "Brothel", symbol: "Whore", time: "Midnight" },
    { ch: 16, name: "Eumaeus", part: "III", masc: 904, fem: 94, scene: "Shelter", symbol: "Sailors", time: "1 a.m." },
    { ch: 17, name: "Ithaca", part: "III", masc: 407, fem: 106, scene: "House", symbol: "Comets", time: "2 a.m." },
    { ch: 18, name: "Penelope", part: "III", masc: 1043, fem: 284, scene: "Bed", symbol: "Earth", time: "—" },
  ];

  data.forEach((d) => {
    d.total = d.masc + d.fem;
    d.mascPct = (d.masc / d.total) * 100;
    d.femPct = (d.fem / d.total) * 100;
    d.ratio = d.fem > 0 ? d.masc / d.fem : Infinity;
  });

  const mascColor = "#385572";
  const femColor = "#8c4651";
  const bgColor = "#fcfbf9";
  const borderColor = "rgba(0,0,0,0.15)";
  const textLight = "rgba(0,0,0,0.5)";
  const tip = d3.select("#tip");

  function showTip(event, html) {
    tip
      .style("display", "block")
      .html(html)
      .style("left", event.pageX + 15 + "px")
      .style("top", event.pageY - 10 + "px");
  }
  function hideTip() {
    tip.style("display", "none");
  }

  function tipHtml(d) {
    return `<span class="ep-name">${d.ch ? d.ch + ". " : ""}${d.name}</span><br>
      <span class="meta">${d.scene ? d.scene + " \u00b7 " + d.symbol : d.author + " \u00b7 " + d.words.toLocaleString() + " words"}</span><br>
      Masculine: <strong>${d.masc}</strong> (${d.mascPct.toFixed(1)}%)<br>
      Feminine: <strong>${d.fem}</strong> (${d.femPct.toFixed(1)}%)<br>
      Ratio: <strong>${d.ratio === Infinity ? "n/a" : d.ratio.toFixed(1) + ":1"}</strong>`;
  }

  const methodologyHtml = `Pronoun frequencies are determined via case-insensitive word-boundary matching, encompassing both straight and curly apostrophes.<br>Masculine forms counted: <em>he, him, his, himself, he's, he'd, he'll</em>. Feminine forms counted: <em>she, her, hers, herself, she's, she'd, she'll</em>.<br>www.municipalsky.com`;

  // Tracking
  function trackEvent(eventType, chartName) {
    fetch("../api/pronoun-viz-tracking.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_type: eventType, chart_name: chartName }),
    }).catch(() => { });
  }

  // Log page view
  trackEvent("page_view", null);

  // Helper for PNG Download
  function downloadViz(selector, filename, btnElement) {
    const originalHtml = btnElement.innerHTML;
    btnElement.innerHTML = `Saving...`;
    btnElement.style.opacity = "0.7";
    btnElement.disabled = true;

    const element = document.querySelector(selector);

    html2canvas(element, {
      backgroundColor: "#fcfbf9",
      scale: 2,
      useCORS: true,
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.querySelector(selector);
        clonedEl.style.padding = "40px 72px 48px 96px";
        clonedEl.style.display = "inline-block";
        clonedEl.style.width = "auto";
        clonedEl.style.maxWidth = "none";

        const title = clonedEl.querySelector(".viz-title");
        if (title) title.style.marginBottom = "24px";

        const svg = clonedEl.querySelector("svg");
        if (svg) {
          const vb = svg.getAttribute("viewBox").split(" ").map(Number);
          const expandLeft = 50;

          svg.setAttribute(
            "viewBox",
            `${vb[0] - expandLeft} ${vb[1]} ${vb[2] + expandLeft} ${vb[3]}`,
          );

          svg.style.width = `${vb[2] + expandLeft}px`;
          svg.style.height = `${vb[3]}px`;
          svg.style.marginLeft = `-${expandLeft}px`;
        }
      },
    })
      .then((canvas) => {
        const a = document.createElement("a");
        a.download = filename;
        a.href = canvas.toDataURL("image/png");
        a.click();

        trackEvent("png_download", filename);

        btnElement.innerHTML = originalHtml;
        btnElement.style.opacity = "1";
        btnElement.disabled = false;
      })
      .catch((err) => {
        console.error("Error generating PNG:", err);
        btnElement.innerHTML = `Error`;
        setTimeout(() => {
          btnElement.innerHTML = originalHtml;
          btnElement.style.opacity = "1";
          btnElement.disabled = false;
        }, 2000);
      });
  }

  // =====================================================================
  // Diverging Bar Chart: Gender Balance by Episode
  // =====================================================================
  (function () {
    const section = d3.select("#viz1");

    section
      .append("div")
      .attr("class", "viz-title")
      .html(
        "Distribution of Gendered Pronouns in James Joyce\u2019s <em>Ulysses</em>",
      );

    section
      .append("div")
      .attr("class", "viz-controls")
      .html(
        '<label>Sort by: <select class="viz-sort-select">' +
        '<option value="masc">Masculine share</option>' +
        '<option value="order">Order in novel</option>' +
        '</select></label>'
      );

    const svgWrap = section.append("div").attr("class", "viz-svg-wrap");

    function renderChart(sortMode) {
      svgWrap.selectAll("*").remove();

      const sorted = sortMode === "order"
        ? [...data].sort((a, b) => a.ch - b.ch)
        : [...data].sort((a, b) => b.mascPct - a.mascPct);

      const rowHeight = 46;
      const sceneColW = 100;
      const symbolColW = 120;

      const margin = { top: 65, right: 240, bottom: 30, left: 150 };
      const totalWidth = 940;
      const width = totalWidth - margin.left - margin.right;
      const height = sorted.length * rowHeight;

      const svg = svgWrap
        .append("svg")
        .attr(
          "viewBox",
          `0 0 ${totalWidth} ${height + margin.top + margin.bottom}`,
        )
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

      const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
      const y = d3
        .scaleBand()
        .domain(sorted.map((d) => d.name))
        .range([0, height])
        .padding(0.18);

      svg
        .append("g")
        .attr("class", "grid")
        .call(
          d3.axisTop(x).tickSize(-height).tickValues([25, 75]).tickFormat(""),
        )
        .select(".domain")
        .remove();

      const names = sorted.map((d) => d.name);
      for (let i = 0; i < names.length - 1; i++) {
        const lineY =
          y(names[i]) + y.bandwidth() + (y.step() - y.bandwidth()) / 2;
        svg
          .append("line")
          .attr("x1", -16)
          .attr("x2", width + sceneColW + symbolColW + 16)
          .attr("y1", lineY)
          .attr("y2", lineY)
          .attr("stroke", borderColor)
          .attr("stroke-width", 0.5);
      }

      const gap = 1;

      svg
        .selectAll(".bar-bg-m")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d) => y(d.name))
        .attr("width", (d) => x(d.mascPct))
        .attr("height", y.bandwidth())
        .attr("fill", bgColor);

      svg
        .selectAll(".bar-bg-f")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("x", (d) => x(d.mascPct) + gap)
        .attr("y", (d) => y(d.name))
        .attr("width", (d) => Math.max(0, x(d.femPct) - gap))
        .attr("height", y.bandwidth())
        .attr("fill", bgColor);

      svg
        .selectAll(".bar-m")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("x", 0)
        .attr("y", (d) => y(d.name))
        .attr("width", (d) => x(d.mascPct))
        .attr("height", y.bandwidth())
        .attr("fill", mascColor)
        .style("mix-blend-mode", "multiply")
        .on("mousemove", (e, d) => showTip(e, tipHtml(d)))
        .on("mouseleave", hideTip);

      svg
        .selectAll(".bar-f")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("x", (d) => x(d.mascPct) + gap)
        .attr("y", (d) => y(d.name))
        .attr("width", (d) => Math.max(0, x(d.femPct) - gap))
        .attr("height", y.bandwidth())
        .attr("fill", femColor)
        .style("mix-blend-mode", "multiply")
        .on("mousemove", (e, d) => showTip(e, tipHtml(d)))
        .on("mouseleave", hideTip);

      svg
        .append("line")
        .attr("x1", x(50))
        .attr("x2", x(50))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4, 4")
        .style("pointer-events", "none");

      const pctMin = 6;
      svg
        .selectAll(".pct-masc")
        .data(sorted.filter((d) => d.mascPct >= pctMin))
        .enter()
        .append("text")
        .attr("x", (d) => x(d.mascPct) / 2)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", bgColor)
        .attr("font-family", "'IBM Plex Sans', sans-serif")
        .attr("font-size", "12px")
        .style("pointer-events", "none")
        .text((d) => d.name === sorted[0].name ? d.mascPct.toFixed(1) + "%" : d.mascPct.toFixed(1));

      svg
        .selectAll(".pct-fem")
        .data(sorted.filter((d) => d.femPct >= pctMin))
        .enter()
        .append("text")
        .attr("x", (d) => x(d.mascPct) + gap + (x(d.femPct) - gap) / 2)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .attr("fill", bgColor)
        .attr("font-family", "'IBM Plex Sans', sans-serif")
        .attr("font-size", "12px")
        .style("pointer-events", "none")
        .text((d) => d.name === sorted[0].name ? d.femPct.toFixed(1) + "%" : d.femPct.toFixed(1));

      const yLabels = svg
        .selectAll(".y-label")
        .data(sorted)
        .enter()
        .append("text")
        .attr("x", -12)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .attr("text-anchor", "end")
        .attr("font-family", "'Jost', sans-serif");

      yLabels
        .append("tspan")
        .attr("x", -12)
        .attr("dy", "-0.25em")
        .attr("fill", "#1a1816")
        .attr("font-size", "16px")
        .attr("font-weight", "600")
        .text((d) => d.name);

      yLabels
        .append("tspan")
        .attr("x", -12)
        .attr("dy", "1.4em")
        .attr("fill", textLight)
        .attr("font-size", "11px")
        .text((d) => d.time);

      const sceneBraceX1 = width + 14;
      const sceneBraceX2 = width + 10 + sceneColW - 4;
      const symbolBraceX1 = width + 10 + sceneColW + 4;
      const symbolBraceX2 = width + 4 + sceneColW + symbolColW;
      const schemaCenterX = (sceneBraceX1 + symbolBraceX2) / 2;

      svg
        .append("text")
        .attr("x", schemaCenterX)
        .attr("y", -32)
        .attr("text-anchor", "middle")
        .attr("fill", "#1a1816")
        .attr("font-family", "'Jost', sans-serif")
        .attr("font-size", "13px")
        .attr("font-weight", "600")
        .attr("letter-spacing", "0.08em")
        .text("GILBERT SCHEMA");

      svg
        .append("text")
        .attr("x", (sceneBraceX1 + sceneBraceX2) / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", textLight)
        .attr("font-family", "'Jost', sans-serif")
        .attr("font-size", "11px")
        .attr("letter-spacing", "0.05em")
        .text("SCENE");

      svg
        .append("text")
        .attr("x", (symbolBraceX1 + symbolBraceX2) / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .attr("fill", textLight)
        .attr("font-family", "'Jost', sans-serif")
        .attr("font-size", "11px")
        .attr("letter-spacing", "0.05em")
        .text("SYMBOL");

      function braceDown(x1, x2, yPeak, yEnds) {
        const mid = (x1 + x2) / 2;
        return `M${x1},${yEnds} C${x1},${yPeak} ${mid},${yEnds} ${mid},${yPeak} C${mid},${yEnds} ${x2},${yPeak} ${x2},${yEnds}`;
      }

      svg
        .append("path")
        .attr("d", braceDown(sceneBraceX1, sceneBraceX2, -1, 8))
        .attr("fill", "none")
        .attr("stroke", textLight)
        .attr("stroke-width", 1);

      svg
        .append("path")
        .attr("d", braceDown(symbolBraceX1, symbolBraceX2, -1, 8))
        .attr("fill", "none")
        .attr("stroke", textLight)
        .attr("stroke-width", 1);

      svg
        .selectAll(".scene-label")
        .data(sorted)
        .enter()
        .append("text")
        .attr("x", width + 16)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("fill", textLight)
        .attr("font-family", "'IBM Plex Sans', sans-serif")
        .attr("font-size", "13px")
        .text((d) => d.scene);

      svg
        .selectAll(".symbol-label")
        .data(sorted)
        .enter()
        .append("text")
        .attr("x", width + 16 + sceneColW)
        .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
        .attr("dy", "0.35em")
        .attr("fill", textLight)
        .attr("font-family", "'IBM Plex Sans', sans-serif")
        .attr("font-size", "13px")
        .text((d) => d.symbol);

      svg
        .append("text")
        .attr("x", x(50) - 40)
        .attr("y", -26)
        .attr("text-anchor", "end")
        .attr("class", "label-masc")
        .text("Masculine Share");
      svg
        .append("text")
        .attr("x", x(50) - 40)
        .attr("y", -8)
        .attr("text-anchor", "end")
        .attr("class", "label-sub-masc")
        .text("(he/him/his)");

      svg
        .append("text")
        .attr("x", x(50) + 40)
        .attr("y", -26)
        .attr("text-anchor", "start")
        .attr("class", "label-fem")
        .text("Feminine Share");
      svg
        .append("text")
        .attr("x", x(50) + 40)
        .attr("y", -8)
        .attr("text-anchor", "start")
        .attr("class", "label-sub-fem")
        .text("(she/her/hers)");

      svg
        .append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${height})`)
        .call(
          d3
            .axisBottom(x)
            .tickValues([0, 25, 50, 75, 100])
            .tickFormat((d) => d + "%"),
        );
    }

    renderChart("masc");

    section.select(".viz-sort-select").on("change", function () {
      renderChart(this.value);
    });

    section
      .append("div")
      .attr("class", "viz-methodology")
      .html(methodologyHtml);

    const btn1 = section
      .append("button")
      .attr("class", "download-btn")
      .attr("data-html2canvas-ignore", "true")
      .on("click", function () {
        downloadViz("#viz1", "ulysses-pronouns.png", this);
      });
    btn1.html(
      `Save PNG`,
    );
  })();

  // =====================================================================
  // VIZ 2: Comparative Bar Chart — Other Books
  // =====================================================================
  (function () {
    const books = [
      { name: "Moby-Dick", author: "Herman Melville", words: 435953, masc: 11616, fem: 920 },
      { name: "Heart of Darkness", author: "Joseph Conrad", words: 38898, masc: 1197, fem: 169 },
      { name: "Ulysses", author: "James Joyce", words: 264822, masc: 9479, fem: 3081 },
      { name: "The Sun Also Rises", author: "Ernest Hemingway", words: 68490, masc: 2082, fem: 586 },
      { name: "Brave New World", author: "Aldous Huxley", words: 66840, masc: 2177, fem: 876 },
      { name: "As I Lay Dying", author: "William Faulkner", words: 57266, masc: 2270, fem: 1011 },
      { name: "The Great Gatsby", author: "F. Scott Fitzgerald", words: 50128, masc: 1696, fem: 855 },
      { name: "The Grapes of Wrath", author: "John Steinbeck", words: 181092, masc: 5450, fem: 3114 },
      { name: "Sons and Lovers", author: "D.H. Lawrence", words: 162241, masc: 9777, fem: 7490 },
      { name: "The Age of Innocence", author: "Edith Wharton", words: 102930, masc: 3692, fem: 3358 },
      { name: "Mrs Dalloway", author: "Virginia Woolf", words: 64266, masc: 2203, fem: 2870 },
      { name: "Pride and Prejudice", author: "Jane Austen", words: 122958, masc: 3472, fem: 4136 },
      { name: "The Bell Jar", author: "Sylvia Plath", words: 71735, masc: 822, fem: 919 },
      { name: "Wuthering Heights", author: "Emily Bronte", words: 117234, masc: 4763, fem: 3016 },
      { name: "The Autobiography of Alice B. Toklas", author: "Gertrude Stein", words: 92922, masc: 2350, fem: 2223 },
    ];

    books.forEach((d) => {
      d.total = d.masc + d.fem;
      d.mascPct = (d.masc / d.total) * 100;
      d.femPct = (d.fem / d.total) * 100;
      d.ratio = d.fem > 0 ? d.masc / d.fem : Infinity;
    });

    books.sort((a, b) => b.mascPct - a.mascPct);

    const section = d3.select("#viz2");
    section
      .append("div")
      .attr("class", "viz-title")
      .text("Distribution of Gendered Pronouns Across Classic Novels");
    const rowHeight = 66;

    const margin = { top: 45, right: 40, bottom: 30, left: 190 };
    const totalWidth = 940;
    const width = totalWidth - margin.left - margin.right;
    const height = books.length * rowHeight;

    const svg = section
      .append("svg")
      .attr(
        "viewBox",
        `0 0 ${totalWidth} ${height + margin.top + margin.bottom}`,
      )
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3
      .scaleBand()
      .domain(books.map((d) => d.name))
      .range([0, height])
      .padding(0.18);
    const x = d3.scaleLinear().domain([0, 100]).range([0, width]);

    svg
      .append("g")
      .attr("class", "grid")
      .call(
        d3.axisTop(x).tickSize(-height).tickValues([25, 75]).tickFormat(""),
      )
      .select(".domain")
      .remove();

    const bookNames = books.map((d) => d.name);
    for (let i = 0; i < bookNames.length - 1; i++) {
      const lineY =
        y(bookNames[i]) + y.bandwidth() + (y.step() - y.bandwidth()) / 2;
      svg
        .append("line")
        .attr("x1", -16)
        .attr("x2", width + 16)
        .attr("y1", lineY)
        .attr("y2", lineY)
        .attr("stroke", borderColor)
        .attr("stroke-width", 0.5);
    }

    const gap = 1;

    svg
      .selectAll(".bar-bg-m")
      .data(books)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.name))
      .attr("width", (d) => x(d.mascPct))
      .attr("height", y.bandwidth())
      .attr("fill", bgColor);

    svg
      .selectAll(".bar-bg-f")
      .data(books)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.mascPct) + gap)
      .attr("y", (d) => y(d.name))
      .attr("width", (d) => Math.max(0, x(d.femPct) - gap))
      .attr("height", y.bandwidth())
      .attr("fill", bgColor);

    svg
      .selectAll(".bar-m")
      .data(books)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.name))
      .attr("width", (d) => x(d.mascPct))
      .attr("height", y.bandwidth())
      .attr("fill", mascColor)
      .style("mix-blend-mode", "multiply")
      .on("mousemove", (e, d) => showTip(e, tipHtml(d)))
      .on("mouseleave", hideTip);

    svg
      .selectAll(".bar-f")
      .data(books)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.mascPct) + gap)
      .attr("y", (d) => y(d.name))
      .attr("width", (d) => Math.max(0, x(d.femPct) - gap))
      .attr("height", y.bandwidth())
      .attr("fill", femColor)
      .style("mix-blend-mode", "multiply")
      .on("mousemove", (e, d) => showTip(e, tipHtml(d)))
      .on("mouseleave", hideTip);

    svg
      .append("line")
      .attr("x1", x(50))
      .attr("x2", x(50))
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4, 4")
      .style("pointer-events", "none");

    const pctMin2 = 6;
    svg
      .selectAll(".pct-masc")
      .data(books.filter((d) => d.mascPct >= pctMin2))
      .enter()
      .append("text")
      .attr("x", (d) => x(d.mascPct) / 2)
      .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", bgColor)
      .attr("font-family", "'IBM Plex Sans', sans-serif")
      .attr("font-size", "15px")
      .style("pointer-events", "none")
      .text((d) => d.name === books[0].name ? d.mascPct.toFixed(1) + "%" : d.mascPct.toFixed(1));

    svg
      .selectAll(".pct-fem")
      .data(books.filter((d) => d.femPct >= pctMin2))
      .enter()
      .append("text")
      .attr("x", (d) => x(d.mascPct) + gap + (x(d.femPct) - gap) / 2)
      .attr("y", (d) => y(d.name) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("text-anchor", "middle")
      .attr("fill", bgColor)
      .attr("font-family", "'IBM Plex Sans', sans-serif")
      .attr("font-size", "15px")
      .style("pointer-events", "none")
      .text((d) => d.name === books[0].name ? d.femPct.toFixed(1) + "%" : d.femPct.toFixed(1));

    const maxTitleWidth = 22;
    function splitTitle(name) {
      if (name.length <= maxTitleWidth) return [name];
      const words = name.split(" ");
      const lines = [];
      let line = "";
      for (const w of words) {
        if (line && (line + " " + w).length > maxTitleWidth) {
          lines.push(line);
          line = w;
        } else {
          line = line ? line + " " + w : w;
        }
      }
      if (line) lines.push(line);
      return lines;
    }

    svg
      .selectAll(".y-label")
      .data(books)
      .enter()
      .append("text")
      .attr("x", -12)
      .attr("text-anchor", "end")
      .attr("fill", "#1a1816")
      .attr("font-family", "'Jost', sans-serif")
      .attr("font-weight", "600")
      .each(function (d) {
        const el = d3.select(this);
        const lines = splitTitle(d.name);
        const lineHeightPx = 22;
        const totalLines = lines.length + 1;
        const barCenter = y(d.name) + y.bandwidth() / 2;
        const blockTop = barCenter - ((totalLines - 1) * lineHeightPx) / 2;

        lines.forEach((line, i) => {
          el.append("tspan")
            .attr("x", -12)
            .attr("y", blockTop + i * lineHeightPx)
            .attr("dominant-baseline", "central")
            .attr("font-size", "18px")
            .text(line);
        });

        el.append("tspan")
          .attr("x", -12)
          .attr("y", blockTop + lines.length * lineHeightPx)
          .attr("dominant-baseline", "central")
          .attr("fill", textLight)
          .attr("font-family", "'IBM Plex Sans', sans-serif")
          .attr("font-size", "13px")
          .attr("font-style", "italic")
          .attr("font-weight", "400")
          .text(d.author);
      });

    svg
      .append("text")
      .attr("x", x(50) - 40)
      .attr("y", -26)
      .attr("text-anchor", "end")
      .attr("class", "label-masc")
      .text("Masculine Share");
    svg
      .append("text")
      .attr("x", x(50) - 40)
      .attr("y", -8)
      .attr("text-anchor", "end")
      .attr("class", "label-sub-masc")
      .text("(he/him/his)");

    svg
      .append("text")
      .attr("x", x(50) + 40)
      .attr("y", -26)
      .attr("text-anchor", "start")
      .attr("class", "label-fem")
      .text("Feminine Share");
    svg
      .append("text")
      .attr("x", x(50) + 40)
      .attr("y", -8)
      .attr("text-anchor", "start")
      .attr("class", "label-sub-fem")
      .text("(she/her/hers)");

    svg
      .append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues([0, 25, 50, 75, 100])
          .tickFormat((d) => d + "%"),
      );

    section
      .append("div")
      .attr("class", "viz-methodology")
      .html(methodologyHtml);

    const btn2 = section
      .append("button")
      .attr("class", "download-btn")
      .attr("data-html2canvas-ignore", "true")
      .on("click", function () {
        downloadViz("#viz2", "comparative-literature-pronouns.png", this);
      });
    btn2.html(
      `Save PNG`,
    );
  })();
</script>

<?php include '../includes/footer.php'; ?>
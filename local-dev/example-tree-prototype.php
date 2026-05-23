<?php
// Prototype playground for the SOC-tree example component used on
// /information-graphics/underworld-occupations.
//
// Local-only — not linked from the site. Load directly:
//   http://localhost:8000/local-dev/example-tree-prototype.php

$chapterHtml = file_get_contents(__DIR__ . '/../data/epistemon-chapter.html');
?>
<!doctype html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Infernal Register — Layout Prototype</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=IM+Fell+English:ital@0;1&family=IM+Fell+English+SC&family=IM+Fell+Great+Primer:ital@0;1&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&display=swap"
    rel="stylesheet" />
  <!-- Reuse the production stylesheets so the card matches the live look. -->
  <link rel="stylesheet" href="../css/style.css" />
  <link rel="stylesheet" href="../information-graphics/underworld-occupations.css" />

  <style>
    /* ===== Prototype chrome ===== */
    body {
      padding: 48px 24px 96px;
      max-width: 1100px;
      margin: 0 auto;
      background: var(--paper);
    }

    .proto-title {
      font-family: var(--font-mono);
      font-size: var(--fs-xs);
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--ink-mute);
      margin: 0 0 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--rule-soft);
    }

    .proto-name {
      font-family: var(--font-body);
      font-size: var(--fs-2xl);
      font-weight: 600;
      letter-spacing: -0.015em;
      line-height: 1.2;
      margin: 0 0 4px;
      color: var(--ink);
    }

    .proto-note {
      font-family: var(--font-body);
      font-size: var(--fs-sm);
      font-style: italic;
      color: var(--ink-soft);
      margin: 0 0 var(--s-5);
      max-width: 60ch;
    }

    .proto-container {
      max-width: var(--max-content, 720px);
    }

    /* ===== Interactive & Typographic Enhancements ===== */
    /* Override the shared 2px sepia border with a hairline so the title
       feels like a header line, not a structural divider. */
    .soc-tree-card-header {
      border-bottom: 1px solid var(--color-border-light);
    }
    .soc-tree-card-header-text {
      font-family: var(--font-family-sc);
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-rubrication);
    }

    .soc-tree-nav-btn {
      font-family: var(--font-family) !important;
      font-size: 22px !important;
      padding: 0 8px !important;
    }

    /* Highlight styling for the text excerpt.
       Use text-decoration (not border-bottom) so the dotted underline
       renders identically across all spans — 1px dotted borders are
       prone to collapsing into a solid-looking line at certain zoom
       levels and on wrapped lines. */
    [data-figures] {
      cursor: pointer;
      border-bottom: 0;
      text-decoration: underline;
      text-decoration-style: dotted;
      text-decoration-color: var(--color-border-medium);
      text-decoration-thickness: 1px;
      text-underline-offset: 3px;
      transition: color var(--transition-fast), text-decoration-color var(--transition-fast), background var(--transition-fast);
    }

    [data-figures]:hover {
      color: var(--color-rubrication);
      text-decoration-color: var(--color-rubrication);
    }

    .soc-tree-card-excerpt [data-figures].is-current {
      font-weight: 700;
      color: var(--color-text-primary);
      text-decoration-style: solid;
      text-decoration-color: var(--color-rubrication);
      text-decoration-thickness: 1.5px;
      background: rgba(179, 58, 43, 0.05);
      /* very faint vermillion tint */
    }

    /* ===== Two-Pane Layout (The Book Spread) ===== */
    /* Whole viewer (header + body + footer) totals 600px; the body
       absorbs whatever's left over after the chrome rows take their
       natural heights. */
    .soc-tree-card {
      width: 100%;
      display: flex;
      flex-direction: column;
      height: 600px;
    }

    .soc-tree-card-body {
      display: grid;
      grid-template-columns: 50% 50%;
      /* Mount sizes to its tree content; the description that follows
         it sits flush below; any remaining vertical space (row 5 = 1fr)
         falls beneath the description as empty parchment. */
      grid-template-rows: min-content min-content min-content min-content 1fr;
      padding: 0;
      /* Fill the remaining card height between header and footer.
         min-height:0 lets the flex child shrink below content size so
         the excerpt's overflow:auto kicks in instead of expanding. */
      flex: 1;
      min-height: 0;
      /* Cream background matches the left excerpt so both columns sit
         on the same paper; the top banners ride above on their own
         darker parchment so they read as labels, not page-color. */
      background: #f1e8d2;
    }

    /* Left Page: Chapter Excerpt */
    .soc-tree-card-excerpt {
      grid-column: 1;
      grid-row: 1 / span 5;
      margin: 0;
      max-height: none;
      /* Let grid control height */
      border-right: 2px solid var(--color-border-medium);
      /* Binding seam */

      background: #f1e8d2;
      font-family: var(--font-family-data);
      font-style: italic;
      font-weight: 400;
      font-size: 18px;
      line-height: 1.55;
      color: var(--color-text-secondary);
      padding: 0 24px 24px;
      overflow-y: auto;

      /* Custom sepia scrollbar */
      scrollbar-width: thin;
      scrollbar-color: var(--color-border-medium) transparent;
    }

    .soc-tree-card-excerpt::-webkit-scrollbar {
      width: 6px;
    }

    .soc-tree-card-excerpt::-webkit-scrollbar-thumb {
      background: var(--color-border-medium);
      border-radius: 0;
    }

    .soc-tree-card-excerpt p {
      margin: 0 0 16px;
      text-indent: 1.5rem;
    }

    .soc-tree-card-excerpt p:first-of-type {
      text-indent: 0;
    }

    /* Drop Cap */
    .soc-tree-card-excerpt p:first-of-type::first-letter {
      font-family: var(--font-family);
      font-style: normal;
      font-size: 3.5rem;
      line-height: 1;
      float: left;
      margin-right: 0.5rem;
      margin-top: -0.25rem;
      color: var(--color-rubrication);
    }

    .soc-tree-card-excerpt-attribution {
      position: sticky;
      top: 0;
      z-index: 2;
      margin: 0 -24px 16px;
      padding: 0 24px;
      /* Matched dimensions with .soc-tree-right-banner on the right page. */
      min-height: 36px;
      display: flex;
      align-items: center;
      background: var(--color-bg-card);
      border-bottom: 1.5px solid var(--color-border-medium);
      font-family: var(--font-family-sc);
      font-style: normal;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }

    .soc-tree-card-excerpt-attribution cite {
      font-family: var(--font-family);
      font-style: italic;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      color: var(--color-text-primary);
      font-size: 18px;
    }

    /* Right Page: top banner — parallel to the .soc-tree-card-excerpt-attribution
       on the left, but now also the home for the manicule navigation.
       Flex layout: [☜] · Underworld Figure #X of Y · [☞]. */
    .soc-tree-right-banner {
      grid-column: 2;
      grid-row: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      /* Matched dimensions with .soc-tree-card-excerpt-attribution on
         the left page so the two banners read as a single header strip
         across the spread. */
      min-height: 36px;
      padding: 0 8px;
      background: var(--color-bg-card);
      border-bottom: 1.5px solid var(--color-border-medium);
      font-family: var(--font-family-sc);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-muted);
    }
    .soc-tree-right-banner-text {
      flex: 1;
      text-align: center;
    }
    /* Counter "#X of Y" — distinguished from the small-caps label by
       using the data face in italic primary ink. */
    .soc-tree-right-banner-text [data-soc-tree-counter] {
      margin-left: 4px;
      font-family: var(--font-family-data);
      font-weight: 600;
      font-style: italic;
      letter-spacing: 0;
      text-transform: none;
      color: var(--color-text-primary);
    }
    /* Manicule buttons sized to fit comfortably inside the 36px banner
       while staying clearly hit-able. */
    .soc-tree-right-banner .soc-tree-nav-btn {
      min-width: 28px !important;
      height: 26px !important;
      font-size: 16px !important;
      padding: 0 4px !important;
    }

    /* Right Page: Header Info */
    .soc-tree-figure-label {
      grid-column: 2;
      grid-row: 2;
      margin: 0;
      padding: 16px 24px;
      border-bottom: 1px solid var(--color-border-light);
      text-align: left;
      line-height: 1.2;
    }

    .soc-tree-figure-name {
      display: block;
      font-family: var(--font-family-display-body);
      font-style: italic;
      font-size: 28px;
      color: var(--color-text-primary);
      margin-bottom: 4px;
    }

    /* Biographical description — sits between the figure's name and
       their underworld labor. Body-weight serif (not italic) so it
       reads as informational prose rather than another caption. */
    .soc-tree-figure-description {
      display: block;
      margin: 6px 0;
      font-family: var(--font-family-data);
      font-style: normal;
      font-size: 15px;
      line-height: 1.4;
      color: var(--color-text-tertiary);
    }
    .soc-tree-figure-description:empty {
      display: none;
    }
    .soc-tree-figure-description:not(:empty)::before {
      content: "Lot in life: ";
      font-weight: 700;
      color: var(--color-text-primary);
    }

    .soc-tree-figure-labor {
      display: block;
      font-family: var(--font-family-data);
      font-style: italic;
      font-size: 15px;
      color: var(--color-text-muted);
    }

    .soc-tree-figure-labor:not(:empty)::before {
      content: "Underworld labor: ";
      font-weight: 700;
      font-style: normal;
      color: var(--color-text-primary);
    }

    /* Right Page: Section header above the tree. Labels the
       indented diagram so the reader knows what they're looking at.
       Inherits the parchment background and sits close to the tree —
       no border or fill that would cut it off from the diagram below. */
    .soc-tree-section-header {
      grid-column: 2;
      grid-row: 3;
      padding: 12px 24px 0;
      font-family: var(--font-family-sc);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--color-text-primary);
    }
    .soc-tree-section-header-aux {
      margin-left: 4px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--color-rubrication);
    }

    /* Right Page: Tree Body */
    .soc-tree-mount {
      grid-column: 2;
      grid-row: 4;
      padding: 4px 24px 4px;
      overflow-y: auto;
    }

    /* O*NET description of the leaf Detailed Occupation. Sits flush
       beneath the indented tree (no border) as italic body prose. */
    .soc-tree-occ-description {
      grid-column: 2;
      grid-row: 5;
      padding: 0 24px 24px;
      font-family: var(--font-family-data);
      font-style: italic;
      font-size: 13px;
      line-height: 1.45;
      color: var(--color-text-tertiary);
    }
    .soc-tree-occ-description:empty {
      display: none;
    }

    /* Source-attribution footer below the spread. Single italic
       paragraph; "Sources:" prefix bolded as a label. Matches the
       banners' parchment-card background. */
    .soc-tree-card-footer {
      margin: 0;
      padding: 10px 16px;
      background: var(--color-bg-card);
      border-top: 1.5px solid var(--color-border-medium);
      font-family: var(--font-family-data);
      font-style: italic;
      font-size: 12px;
      line-height: 1.5;
      color: var(--color-text-secondary);
    }
    .soc-tree-card-footer strong {
      font-style: normal;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: var(--color-text-primary);
    }
    .soc-tree-card-footer cite {
      font-style: italic;
    }
    .soc-tree-card-footer a {
      color: var(--color-rubrication);
      text-decoration: none;
      border-bottom: 1px dotted var(--color-rubrication);
    }
    .soc-tree-card-footer a:hover {
      border-bottom-style: solid;
    }


    /* Loading Overlay for Split Layout */
    .soc-tree-card-loading {
      grid-column: 1 / -1;
      grid-row: 1 / -1;
      display: none;
      /* Hidden strictly by default */
      align-items: center;
      justify-content: center;
      background: rgba(221, 208, 179, 0.9);
      z-index: 10;
      margin: 0;
    }

    /* Only reveal via flex when the parent has is-loading */
    .soc-tree-card--carousel.is-loading .soc-tree-card-loading {
      display: flex;
    }
  </style>
</head>

<body>
  <header style="margin-bottom: var(--s-5);">
    <p class="proto-title">Prototype</p>
    <h1 class="proto-name">The Infernal Register</h1>
    <p class="proto-note">
      Two-pane book spread layout integrating Rabelais's text with the SOC hierarchy.
    </p>
  </header>

  <main class="proto-container">
    <aside class="soc-tree-card soc-tree-card--carousel is-loading" data-soc-tree-start="Pope Calixtus"
      aria-label="Worked example: Classification of Underworld Labors">

      <div class="soc-tree-card-header">
        <span class="soc-tree-card-header-text">Classifying the Underworld with the Bureau of Labor Statistics</span>
      </div>

      <div class="soc-tree-card-body">
        <div class="soc-tree-card-loading" data-soc-tree-loading aria-live="polite">
          <span style="color: var(--color-text-subtle); font-style: italic; font-family: var(--font-family);">Loading
            the underworld&hellip;</span>
        </div>

        <div class="soc-tree-card-excerpt" data-soc-tree-excerpt>
          <div class="soc-tree-card-excerpt-attribution">
            <cite>Gargantua and Pantagruel</cite> &middot; Book&nbsp;2, Ch.&nbsp;30
          </div>
          <?= $chapterHtml ?>
        </div>

        <div class="soc-tree-right-banner">
          <button class="soc-tree-nav-btn" type="button" data-soc-tree-nav="prev"
            aria-label="Previous figure">&#9756;</button>
          <span class="soc-tree-right-banner-text">
            Underworld Figure <span data-soc-tree-counter aria-live="polite"></span>
          </span>
          <button class="soc-tree-nav-btn" type="button" data-soc-tree-nav="next"
            aria-label="Next figure">&#9758;</button>
        </div>

        <div class="soc-tree-figure-label">
          <span class="soc-tree-figure-name" data-soc-tree-figure-name aria-live="polite"></span>
          <span class="soc-tree-figure-description" data-soc-tree-figure-description></span>
          <span class="soc-tree-figure-labor" data-soc-tree-figure-labor></span>
        </div>

        <div class="soc-tree-section-header">
          Modern Equivalent
          <span class="soc-tree-section-header-aux">(SOC Classification)</span>
        </div>

        <div class="soc-tree-mount" aria-label="Selected figure SOC classification"></div>
        <div class="soc-tree-occ-description" data-soc-tree-occ-description></div>
      </div>

      <p class="soc-tree-card-footer">
        <strong>Sources:</strong>
        Chapter text from <cite>Gargantua and Pantagruel</cite>, Urquhart (1693) translation, via
        <a href="https://www.gutenberg.org/ebooks/1200" rel="noopener" target="_blank">Project Gutenberg</a>.
        The &ldquo;lot in life&rdquo; entries were generated by a large language model (reviewed for accuracy.)
        Occupation descriptions from U.S. Department of Labor
        <a href="https://www.onetonline.org/" rel="noopener" target="_blank">O*NET-SOC</a> database.
      </p>
    </aside>
  </main>

  <script>
    (function () {
      const API_URL =
        "https://municipalsky.com/api/rabelais-annotations.php";

      const stripOcc = (s) =>
        (s || "").replace(/\s+Occupations$/i, "");

      function wrapLines(text, maxChars) {
        const words = String(text).split(/\s+/).filter(Boolean);
        const lines = [];
        let cur = "";
        for (const w of words) {
          const next = cur ? cur + " " + w : w;
          if (next.length > maxChars && cur) {
            lines.push(cur);
            cur = w;
          } else {
            cur = next;
          }
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [""];
      }

      const escape = (s) =>
        String(s)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

      // Extract the first sentence from a description. Greedy match up
      // to the first sentence-ending punctuation (.!?). Falls back to
      // the whole string if no terminator is found.
      function firstSentence(text) {
        if (!text) return "";
        const m = String(text).match(/^[^.!?]*[.!?]/);
        return m ? m[0].trim() : String(text).trim();
      }

      const TREE_W_DEFAULT = 320;
      const INDENT = 22;
      const TEXT_GAP = 12;
      const LINE_H = 22;
      const ROW_GAP = 32; // Buffer for the meta-labels
      const OFFSET_X = 6;
      const OFFSET_Y = 28; // Increased to prevent the top label from clipping outside the SVG viewBox
      const CHAR_W = 6.5;

      function renderSocTree(mount, character, opts) {
        const treeW = (opts && opts.treeW) || TREE_W_DEFAULT;
        if (!character) {
          mount.innerHTML = '<p class="soc-tree-mount-empty">Classification unavailable.</p>';
          return;
        }
        const labels = [
          stripOcc(character.major_group_title),
          stripOcc(character.minor_group_title),
          stripOcc(character.broad_group_title),
          character.occ_title || "",
        ].filter((s) => s && s.length > 0);

        if (labels.length === 0) {
          mount.innerHTML = "";
          return;
        }

        const nodes = [];
        let cy = 0;
        for (let i = 0; i < labels.length; i++) {
          const x = i * INDENT;
          const textX = x + TEXT_GAP;
          const availW = treeW - OFFSET_X * 2 - textX;
          const maxChars = Math.max(10, Math.floor(availW / CHAR_W));
          const lines = wrapLines(labels[i], maxChars);

          nodes.push({
            x,
            textX,
            y: cy,
            lines,
            isLeaf: i === labels.length - 1,
            levelLabel: ["Major Group", "Minor Group", "Broad Group", "Detailed Occupation"][i]
          });
          cy += Math.max(ROW_GAP, lines.length * LINE_H + 14);
        }

        const last = nodes[nodes.length - 1];
        // Top buffer needs OFFSET_Y for the meta-label above row 0; the
        // bottom only needs a few pixels so the leaf circle's stroke
        // isn't clipped. Anything bigger leaves empty space above the
        // O*NET description that follows the SVG.
        const totalH = last.y + last.lines.length * LINE_H + OFFSET_Y + 4;
        const figureName = character.name || "figure";
        const pathDesc = labels.join(" › ");

        let svg = `<svg class="soc-tree-svg" width="${treeW}" height="${totalH}" viewBox="0 0 ${treeW} ${totalH}" role="img" aria-label="${escape(figureName)} SOC classification path: ${escape(pathDesc)}">`;
        svg += `<g transform="translate(${OFFSET_X}, ${OFFSET_Y})">`;

        for (let i = 1; i < nodes.length; i++) {
          const p = nodes[i - 1];
          const c = nodes[i];
          svg += `<path class="soc-tree-svg-path" d="M${p.x},${p.y + 4} V${c.y + 4} H${c.x}" />`;
        }

        for (const n of nodes) {
          const cls = n.isLeaf ? "soc-tree-svg-node is-leaf" : "soc-tree-svg-node";
          svg += `<circle class="${cls}" cx="${n.x}" cy="${n.y + 4}" r="3.5" />`;
        }

        for (const n of nodes) {
          const cls = n.isLeaf ? "soc-tree-svg-text is-leaf" : "soc-tree-svg-text";
          const textY = n.y + 8;

          // Meta-label rendered in IM Fell Small Caps
          svg += `<text style="font-family: var(--font-family-sc); font-size: 10px; fill: var(--color-rubrication); text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;" x="${n.textX}" y="${textY - 14}">${n.levelLabel}</text>`;

          if (n.lines.length === 1) {
            svg += `<text class="${cls}" x="${n.textX}" y="${textY}">${escape(n.lines[0])}</text>`;
          } else {
            svg += `<text class="${cls}" x="${n.textX}" y="${textY}">`;
            for (let li = 0; li < n.lines.length; li++) {
              const dy = li === 0 ? "" : ` dy="${LINE_H}"`;
              svg += `<tspan x="${n.textX}"${dy}>${escape(n.lines[li])}</tspan>`;
            }
            svg += "</text>";
          }
        }
        svg += "</g></svg>";

        // Subtle fade-in transition
        mount.style.opacity = 0;
        mount.innerHTML = svg;
        setTimeout(() => {
          mount.style.transition = 'opacity 0.4s ease';
          mount.style.opacity = 1;
        }, 50);
      }

      function initFigureCarousel(card, byName) {
        const excerpt = card.querySelector("[data-soc-tree-excerpt]");
        const mount = card.querySelector(".soc-tree-mount");
        const figureNameEl = card.querySelector("[data-soc-tree-figure-name]");
        const figureDescEl = card.querySelector("[data-soc-tree-figure-description]");
        const figureLaborEl = card.querySelector("[data-soc-tree-figure-labor]");
        const occDescEl = card.querySelector("[data-soc-tree-occ-description]");
        const counter = card.querySelector("[data-soc-tree-counter]");
        const prevBtn = card.querySelector('[data-soc-tree-nav="prev"]');
        const nextBtn = card.querySelector('[data-soc-tree-nav="next"]');

        if (!excerpt || !mount) return;
        const entries = [];

        excerpt.querySelectorAll("[data-figures]").forEach((el) => {
          const raw = el.getAttribute("data-figures") || "";
          raw.split("|").forEach((name) => {
            const trimmed = name.trim();
            if (trimmed) entries.push({ name: trimmed, span: el });
          });

          // Click-to-navigate event
          el.addEventListener("click", () => {
            const targetName = raw.split("|")[0].trim();
            const foundIdx = entries.findIndex(e => e.name === targetName);
            if (foundIdx >= 0) {
              idx = foundIdx;
              render({ scrollInto: false });
            }
          });
        });

        if (entries.length === 0) return;
        const startName = card.getAttribute("data-soc-tree-start");
        let idx = 0;
        if (startName) {
          const found = entries.findIndex((e) => e.name === startName);
          if (found >= 0) idx = found;
        }

        const treeWAttr = parseInt(card.getAttribute("data-soc-tree-width") || "", 10);
        const treeW = Number.isFinite(treeWAttr) ? treeWAttr : null;

        function centerSpanInExcerpt(span, smooth) {
          if (!span || excerpt.scrollHeight <= excerpt.clientHeight) return;
          const spanRect = span.getBoundingClientRect();
          const excerptRect = excerpt.getBoundingClientRect();
          const spanTopInExcerpt = excerpt.scrollTop + (spanRect.top - excerptRect.top);
          const target = spanTopInExcerpt - (excerpt.clientHeight - spanRect.height) / 2;
          excerpt.scrollTo({
            top: Math.max(0, target),
            behavior: smooth ? "smooth" : "auto",
          });
        }

        function render(opts) {
          const scrollInto = opts && opts.scrollInto;
          const smooth = !(opts && opts.instant);
          const current = entries[idx];
          const seen = new Set();

          entries.forEach((e) => {
            if (seen.has(e.span)) return;
            seen.add(e.span);
            e.span.classList.toggle("is-current", e.span === current.span);
          });

          if (counter) {
            counter.textContent = entries.length > 1
              ? "#" + (idx + 1) + " of " + entries.length
              : "";
          }

          const character = byName.get(current.name);
          if (figureNameEl) figureNameEl.textContent = current.name;
          if (figureDescEl) {
            figureDescEl.textContent = firstSentence(
              character && character.description,
            );
          }
          if (figureLaborEl) {
            let laborStr = (character && character.labor) || "";
            if (laborStr) {
              laborStr = laborStr.charAt(0).toUpperCase() + laborStr.slice(1);
            }
            figureLaborEl.textContent = laborStr;
          }
          if (occDescEl) {
            occDescEl.textContent = firstSentence(
              character && character.occ_description,
            );
          }

          renderSocTree(mount, character, treeW ? { treeW: treeW } : undefined);

          if (scrollInto) {
            centerSpanInExcerpt(current.span, smooth);
          }
        }

        function step(delta) {
          idx = (idx + delta + entries.length) % entries.length;
          render({ scrollInto: true });
        }
        if (prevBtn) prevBtn.addEventListener("click", () => step(-1));
        if (nextBtn) nextBtn.addEventListener("click", () => step(+1));

        card.classList.remove("is-loading");
        render({ scrollInto: true, instant: true });
      }

      function init() {
        const carousels = document.querySelectorAll(".soc-tree-card--carousel");
        if (carousels.length === 0) return;

        setTimeout(() => {
          fetch(API_URL + "?v=" + Date.now())
            .then((r) => {
              if (!r.ok) throw new Error("HTTP " + r.status);
              return r.json();
            })
            .then((data) => {
              if (!data || !data.characters) throw new Error("Missing characters");
              const byName = new Map();
              for (const c of data.characters) {
                if (c && c.name) byName.set(c.name, c);
              }
              carousels.forEach((card) => initFigureCarousel(card, byName));
            })
            .catch((err) => {
              console.error("SOC tree data load failed:", err);
              carousels.forEach((c) => {
                c.classList.remove("is-loading");
                c.classList.add("is-error");
                const loadingEl = c.querySelector("[data-soc-tree-loading]");
                if (loadingEl) {
                  loadingEl.innerHTML = "<span style='color: var(--color-rubrication);'>Could not load classification data from the bureaucratic realms.</span>";
                }
              });
            });
        }, 300); // intentional delay for visual effect
      }

      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    })();
  </script>
</body>

</html>
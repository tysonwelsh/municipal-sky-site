// ============================================================================
// PROSPERO'S JUKEBOX v2 — pj2-wireframe.js · THE LAYOUT MAP (dev only)
//
// A labelled wireframe overlay for talking about the page's anatomy: every
// container gets a bounding box carrying its CSS handle and its live measured
// size. Owner tool (2026-08-08) — so that "move this / make that wider" can
// name the part instead of pointing.
//
// NOT loaded in production. index.php includes this file only when the URL
// carries ?wire (see the conditional block at the foot of index.php), so a
// normal visitor never fetches it and the page is byte-identical without it.
//
//   /art/prosperos-jukebox-v2/?wire=1     open with the map on
//   w   toggle the whole overlay          d   toggle the size readouts
//   c   toggle the canvas-drawn regions
//
// OUTLINES ONLY, NO FILLS (owner 2026-08-08): the boxes nest up to seven deep
// over the plate, so even a 5%-alpha tint stacked into a green cast that hid
// the art underneath. Every box is a hairline outline and a label; nothing
// between them is painted, so what you see inside a box is the real page.
//
// TWO KINDS OF BOX, and the difference matters when asking for a change:
//
//   · GREEN = real DOM containers. Their geometry lives in pj2.css, so a
//     change is a CSS edit (and often a matching tweak in the two media
//     queries at the foot of that file).
//   · AMBER, dashed = regions *drawn inside* the two canvases by pj2-viz.js.
//     There is no element to inspect — the boxes below are recomputed from
//     the same formulas the renderer uses (measureAll's plate zone;
//     marginLayout's six panel slots). Changing one of those is a JS edit.
//
// Each part also carries a plain-words note and a "what decides its size"
// line. Those are no longer shown on screen (the sidebar that held them was
// cut, owner 2026-08-08); they print on demand from the console:
//
//   PJ2.wireframe.parts()      the whole registry as a table
//
// The overlay only ever reads the page: no styles are written to any existing
// element, and everything it adds lives inside one node, so removing the
// query parameter restores the page exactly.
// ============================================================================

(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  // --------------------------------------------------------------------------
  // THE PALETTE — the overlay is deliberately NOT in the jukebox's palette.
  // It is scaffolding sitting on top of the art, and it should read as
  // scaffolding, so it uses its own signal colors and ignores the skinning
  // contract (which binds pj2.css and pj2-viz.js, not dev chrome).
  // --------------------------------------------------------------------------
  var C = {
    ground: "#2f6b3a",   // the page ground — the outermost box
    region: "#46d16a",   // major regions: tabs / folio / cabinet
    group: "#8bf0a8",    // rows and columns inside a region
    leaf: "#3fd6c4",     // individual controls
    canvas: "#e8a83c",   // regions PAINTED inside a canvas (no DOM node)
  };

  // --------------------------------------------------------------------------
  // THE PARTS REGISTRY — outermost first, so inner boxes paint over outer.
  // `size` says what actually decides the box's dimensions, which is the
  // sentence you want when asking for it to change.
  // --------------------------------------------------------------------------
  var PARTS = [
    { sel: ".pj2-desk", name: ".pj2-desk", color: C.ground,
      note: "the desk — the page's near-black ground",
      size: "full width · padding 26px 12px 48px" },

    { sel: "#pj2-app", name: "#pj2-app / .pj2-app", color: C.region,
      note: "the app — carries data-track (which book) and data-binding (night/parchment); every per-track color variable is set here",
      size: "max-width 1392px, centred" },

    { sel: ".pj2-tabs", name: ".pj2-tabs", color: C.region,
      note: "the tab row — three books, above the folio",
      size: "flex row · gap 8px · margin-bottom 10px" },
    { sel: "#pj2-tab-library", name: ".pj2-tab (library)", color: C.leaf,
      note: "one tab; keeps its own palette even while idle", size: "flex 1 1 0 — equal thirds" },
    { sel: "#pj2-tab-sycorax", name: ".pj2-tab (sycorax)", color: C.leaf,
      note: "one tab", size: "flex 1 1 0" },
    { sel: "#pj2-tab-ariel", name: ".pj2-tab (ariel)", color: C.leaf,
      note: "one tab; the open one is .is-active — taller, in its book's paper", size: "flex 1 1 0" },

    { sel: ".pj2-folio-wrap", name: ".pj2-folio-wrap", color: C.region,
      note: "shadow wrapper only — exists so the drop-shadow follows the folio's rounded outline",
      size: "hugs .pj2-folio" },
    { sel: ".pj2-folio", name: ".pj2-folio", color: C.region,
      note: "the open book — the parchment frame and the night interior",
      size: "border 10px · radius 16px · padding 10px 12px 8px" },

    { sel: ".pj2-folio-head", name: ".pj2-folio-head", color: C.group,
      note: "the running head — title on the left, transport on the right",
      size: "flex row, space-between · border-bottom 2px · margin-bottom 10px" },
    { sel: "#pj2-title", name: ".pj2-title", color: C.leaf,
      note: "the book's title; the small kicker inside it is .pj2-title-pre and the coloured first letter is .pj2-init",
      size: "32px display face (24px under 700px)" },
    { sel: ".pj2-transport-head", name: ".pj2-transport-head", color: C.leaf,
      note: "PLAY / STOP / RESET — three .pj2-pushplate buttons",
      size: "margin-left auto · 16px plates (full-width row under 700px)" },

    { sel: ".pj2-folio-grid", name: ".pj2-folio-grid", color: C.group,
      note: "the reading-desk grid — plate column beside margin column; stacks vertically under 1080px",
      size: "flex row · gap 12px" },

    { sel: ".pj2-plate-col", name: ".pj2-plate-col", color: C.group,
      note: "the plate column — takes whatever width the margin column leaves",
      size: "flex 1 1 auto" },
    { sel: "#pj2-plate", name: "#pj2-plate  ⟨canvas⟩", color: C.leaf,
      note: "the spiral canvas — drawn by pj2-viz.js; width follows the column",
      size: "height 660px  (480px under 1080px · 360px under 700px)" },
    { sel: "#pj2-telemetry", name: ".pj2-telemetry", color: C.leaf,
      note: "the one-line readout strip that replaces the margin canvas on small screens",
      size: "hidden above 1080px" },

    { sel: ".pj2-margin-col", name: ".pj2-margin-col", color: C.group,
      note: "the margin column — apparatus and annotations",
      size: "fixed 402px wide (flex 0 0 402px) · gap 8px" },
    { sel: "#pj2-folio-no", name: ".pj2-folio-no", color: C.leaf,
      note: "the folio number — mode and tonic",
      size: "15px caption · 1px rule beneath" },
    { sel: "#pj2-margin", name: "#pj2-margin  ⟨canvas⟩", color: C.leaf,
      note: "the margin apparatus canvas — six panel slots, drawn by pj2-viz.js",
      size: "height 330px · width follows the column (402px)" },
    { sel: ".pj2-log-block", name: ".pj2-log-block", color: C.leaf,
      note: "the annotation block — heading plus the scrolling log",
      size: "flex 1 1 auto — takes the column's leftover height" },
    { sel: "#pj2-log-head", name: ".pj2-log-head", color: C.leaf,
      note: "the log's heading (its wording changes per book)", size: "15px caption" },
    { sel: "#pj2-log", name: "#pj2-log", color: C.leaf,
      note: "the scribal log — newest first, ink ages in three steps",
      size: "min-height 240px · max-height 330px · scrolls" },

    { sel: ".pj2-cabinet", name: ".pj2-cabinet", color: C.region,
      note: "the conjurer's cabinet — the wood-and-brass strip; constant across books",
      size: "flex row, wraps · gap 16px · padding 10px 16px 12px · margin-top 14px" },
    { sel: "#pj2-binding", name: "#pj2-binding", color: C.leaf,
      note: "NIGHT / PARCH — swaps the whole dress; the choice is remembered",
      size: "one pushplate" },
    { sel: ".pj2-cab-spacer", name: ".pj2-cab-spacer", color: C.leaf,
      note: "empty flexible gap — this is what pushes the seal, lamp and legend to the right",
      size: "flex 1 1 auto (removed under 700px)" },
    { sel: ".pj2-seal-wrap", name: ".pj2-seal-wrap", color: C.leaf,
      note: "the wax seal — the seed number sits inside it (#pj2-seed); typing one re-stamps",
      size: "84 × 84 seal + caption" },
    { sel: ".pj2-lamp", name: ".pj2-lamp", color: C.leaf,
      note: "the lamp — master volume",
      size: "width 136px · 14px track" },
    { sel: "#pj2-legend", name: "#pj2-legend", color: C.leaf,
      note: "the plate's legend — the per-voice mixer; one .pj2-legend-row per voice, rebuilt on every tab switch",
      size: "width 318px (100% under 700px)" },

    { sel: ".pj2-build", name: ".pj2-build", color: C.ground,
      note: "the build stamp — version · fingerprint · deploy time",
      size: "13px, centred · margin-top 10px" },
  ];

  // --------------------------------------------------------------------------
  // THE CANVAS-DRAWN REGIONS — no DOM to measure, so these are recomputed
  // from pj2-viz.js's own geometry. Keep the two in step: the plate zone is
  // measureAll()'s `pad`/radius, the six margin slots are marginLayout().
  // --------------------------------------------------------------------------
  var MARGIN_HEADS = {
    library: ["the tide · volvelle", "the athanor · fire", "aer · the air",
      "the chord · its metal", "genealogia motivi"],
    sycorax: ["the treeline · tide", "the smoke · intensity", "the pose",
      "the tallies", "the cord and bone"],
    ariel: ["the wind-rose · tide", "the quadrant · altitude",
      "the chord · constellation", "the season", "migratio · the signature"],
  };

  function currentTrack() {
    var app = document.getElementById("pj2-app");
    var t = app && app.getAttribute ? app.getAttribute("data-track") : null;
    return MARGIN_HEADS[t] ? t : "library";
  }
  function currentBinding() {
    var app = document.getElementById("pj2-app");
    return (app && app.getAttribute("data-binding") === "parchment") ? "parchment" : "night";
  }

  // → [{el, x, y, w, h, name, note}] with x/y in CSS px inside the canvas box
  function canvasRegions() {
    var out = [];
    var plate = document.getElementById("pj2-plate");
    var margin = document.getElementById("pj2-margin");

    if (plate) {
      var pr = plate.getBoundingClientRect();
      if (pr.width > 1 && pr.height > 1) {
        // measureAll(): night inset 6px; parchment inset max(16, 3% of the
        // short side) — the slim rounded window of the codex dress
        var pad = currentBinding() === "night"
          ? 6 : Math.max(16, Math.round(Math.min(pr.width, pr.height) * 0.03));
        out.push({
          el: plate, x: pad, y: pad, w: pr.width - pad * 2, h: pr.height - pad * 2,
          name: "plateZone  (drawn)",
          note: "the night window — the coil is sized to fit inside it and hard-clipped to it. Set in pj2-viz.js measureAll(): inset "
            + pad + "px on the " + currentBinding() + " binding.",
        });
      }
    }

    if (margin) {
      var mr = margin.getBoundingClientRect();
      if (mr.width > 1 && mr.height > 1) {
        var W = mr.width, H = mr.height, p = 8;   // marginLayout()'s pad
        var half = (W - 3 * p) / 2;
        var heads = MARGIN_HEADS[currentTrack()];
        var slots = [
          { x: p, y: p, w: W - 2 * p, h: H * 0.17, key: "scene", head: "the scene heading" },
          { x: p, y: H * 0.19, w: half, h: H * 0.24, key: "dialA", head: heads[0] },
          { x: p * 2 + half, y: H * 0.19, w: half, h: H * 0.24, key: "dialB", head: heads[1] },
          { x: p, y: H * 0.45, w: half, h: H * 0.14, key: "rowA", head: heads[2] },
          { x: p * 2 + half, y: H * 0.45, w: half, h: H * 0.14, key: "rowB", head: heads[3] },
          { x: p, y: H * 0.61, w: W - 2 * p, h: H * 0.37 - p, key: "tree", head: heads[4] },
        ];
        for (var i = 0; i < slots.length; i++) {
          var s = slots[i];
          out.push({
            el: margin, x: s.x, y: s.y, w: s.w, h: s.h,
            name: "marginLayout." + s.key + "  ·  " + s.head,
            note: "slot proportions are fractions of the canvas height in pj2-viz.js marginLayout(); the panel names change per book.",
          });
        }
      }
    }
    return out;
  }

  // --------------------------------------------------------------------------
  // THE OVERLAY — outlines and labels, nothing else.
  // --------------------------------------------------------------------------
  var root = null, boxes = [], canvasBoxes = [];
  var shown = true, showDims = true, showCanvas = true;

  var FONT = '"VT323", ui-monospace, Menlo, monospace';

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.setAttribute("style", css);
    if (text != null) e.textContent = text;
    return e;
  }

  function makeBox(color, name, dashed) {
    // no background: the outline is the whole box (see the header note)
    var b = el("div",
      "position:fixed;pointer-events:none;box-sizing:border-box;z-index:2147483000;"
      + "background:none;border:1px " + (dashed ? "dashed" : "solid") + " " + color + ";");
    var tag = el("div",
      "position:absolute;left:0;top:0;transform:translateY(-100%);"
      + "font:14px " + FONT + ";line-height:1.15;white-space:nowrap;"
      + "padding:1px 5px 0;color:" + color + ";background:#05070acc;");
    b.appendChild(tag);
    b._tag = tag; b._name = name; b._color = color;
    return b;
  }

  function place(b, rect, dims) {
    if (!rect || rect.width < 1 || rect.height < 1) { b.style.display = "none"; return; }
    b.style.display = "";
    b.style.left = rect.left + "px";
    b.style.top = rect.top + "px";
    b.style.width = rect.width + "px";
    b.style.height = rect.height + "px";
    b._tag.textContent = b._name
      + (showDims ? "   " + Math.round(dims.w) + " × " + Math.round(dims.h) : "");
    // a label that would sit above the viewport drops inside its own box
    b._tag.style.transform = (rect.top < 20) ? "translateY(0)" : "translateY(-100%)";
  }

  function build() {
    root = el("div", "position:fixed;inset:0;pointer-events:none;z-index:2147483000;");
    for (var i = 0; i < PARTS.length; i++) {
      var p = PARTS[i];
      var node = document.querySelector(p.sel);
      if (!node) continue;
      var b = makeBox(p.color, p.name, false);
      b._node = node; b._part = p;
      root.appendChild(b);
      boxes.push(b);
    }
    document.body.appendChild(root);
    measure();
  }

  // Canvas boxes are rebuilt rather than updated: their count and their names
  // both change with the open book, and there are only seven of them.
  function syncCanvasBoxes() {
    var regions = showCanvas ? canvasRegions() : [];
    while (canvasBoxes.length > regions.length) {
      var dead = canvasBoxes.pop();
      if (dead.parentNode) dead.parentNode.removeChild(dead);
    }
    while (canvasBoxes.length < regions.length) {
      var nb = makeBox(C.canvas, "", true);
      root.appendChild(nb);
      canvasBoxes.push(nb);
    }
    for (var i = 0; i < regions.length; i++) {
      var r = regions[i], b = canvasBoxes[i];
      b._name = r.name;
      var cr = r.el.getBoundingClientRect();
      place(b, { left: cr.left + r.x, top: cr.top + r.y, width: r.w, height: r.h },
        { w: r.w, h: r.h });
    }
  }

  function measure() {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      var rect = b._node.getBoundingClientRect();
      place(b, rect, { w: rect.width, h: rect.height });
    }
    syncCanvasBoxes();
  }

  var ticking = false;
  function scheduleMeasure() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { ticking = false; if (shown) measure(); });
  }

  function setShown(v) {
    shown = v;
    root.style.display = v ? "" : "none";
    if (v) measure();
  }

  function init() {
    build();

    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    // a tab switch re-labels the margin panels and rebuilds the mixer rows,
    // and the log grows — so re-measure on any structural change
    if (window.MutationObserver) {
      var mo = new MutationObserver(scheduleMeasure);
      mo.observe(document.getElementById("pj2-app") || document.body,
        { attributes: true, childList: true, subtree: true });
    }
    setInterval(function () { if (shown) measure(); }, 750);

    document.addEventListener("keydown", function (e) {
      var t = e.target, tag = (t && t.tagName) ? String(t.tagName).toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable)) return;
      var k = String(e.key || "").toLowerCase();
      if (k === "w") setShown(!shown);
      else if (k === "d") { showDims = !showDims; measure(); }
      else if (k === "c") { showCanvas = !showCanvas; measure(); }
      else return;
      e.preventDefault();
    });

    try {
      console.info("PJ2 layout map — w: overlay · d: sizes · c: canvas regions."
        + "  PJ2.wireframe.parts() prints the registry.");
    } catch (e) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // The notes and "what decides its size" lines used to live in an on-page
  // sidebar; they print here instead so the page itself stays clean.
  window.PJ2 = window.PJ2 || {};
  window.PJ2.wireframe = {
    parts: function () {
      var rows = PARTS.map(function (p) {
        var node = document.querySelector(p.sel);
        var r = node ? node.getBoundingClientRect() : null;
        return {
          part: p.name,
          size: r ? Math.round(r.width) + " × " + Math.round(r.height) : "—",
          "decided by": p.size,
          what: p.note,
        };
      });
      try { console.table(rows); } catch (e) {}
      return rows;
    },
    regions: function () { return canvasRegions(); },
    toggle: function () { setShown(!shown); return shown; },
  };
})();

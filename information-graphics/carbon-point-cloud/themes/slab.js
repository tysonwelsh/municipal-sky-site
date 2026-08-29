// ░⌭⎔ʬ³³ — two pinned plates of one room.
//
// A poured-concrete slab: the dashboard silkscreened onto it. Washed pink is
// sp² (the graphitic sheets — the thing irradiation erodes), seafoam is sp³;
// those two hues ARE the cloud, everything else is supporting ink. Depth is
// posterized to three screenprint layers and atoms are hard squares — every
// mark is still its true projected position, class, and color; only the
// printing process got cheaper. Set dressing is documentation that documents
// nothing: crop marks, a stencil pour number, a catalog strip, a cyan survey
// lattice drifting behind the title at 160-second tempo.
//
//   ᵈᵃʸ — the slab at inspection hour. Grain multiplies, ink sits matte.
//   ⁿᵗ  — the same room at 3 a.m. Same hues gone phosphorescent, grain
//         screens, the cloud picks up 1px of chromatic misregistration.
//
// Uses every hook the engine offers: render.drawAtom / render.drawHalo for
// the canvas marks, mount()/unmount() for the injected DOM (all nodes carry
// data-theme-owned; heading text is restored on unmount). Motion is CSS-only
// and dies under prefers-reduced-motion.

(() => {
"use strict";

// ---------- textures (inline SVG data URIs — no network needed for these) ----------
const uri = s => `url("data:image/svg+xml,${encodeURIComponent(s.replace(/\s+/g, " ").trim())}")`;

// film grain: opaque gray noise, blended multiply (day) / screen (night)
const GRAIN = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'>
  <filter id='g'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' seed='7' stitchTiles='stitch'/>
  <feColorMatrix type='saturate' values='0'/></filter>
  <rect width='260' height='260' filter='url(#g)'/></svg>`);

// coarse mottle for the page ground
const BODY_TEX = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='700' height='700'>
  <filter id='p'><feTurbulence type='fractalNoise' baseFrequency='0.006' numOctaves='3' seed='4' stitchTiles='stitch'/>
  <feColorMatrix type='saturate' values='0'/></filter>
  <rect width='700' height='700' filter='url(#p)' opacity='0.08'/></svg>`);

// finer pour for the plot slab
const POUR = uri(`<svg xmlns='http://www.w3.org/2000/svg' width='480' height='480'>
  <filter id='q'><feTurbulence type='fractalNoise' baseFrequency='0.013' numOctaves='4' seed='11' stitchTiles='stitch'/>
  <feColorMatrix type='saturate' values='0'/></filter>
  <rect width='480' height='480' filter='url(#q)' opacity='0.10'/></svg>`);

// ---------- mounted set dressing ----------
// print-misregistration warp for the canvas (≤ ~2px, so hover stays truthful)
const DEFS_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">
  <filter id="slab-warp" x="-4%" y="-4%" width="108%" height="108%">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.016" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>`;

// survey lattice, overprinted in cyan (fine lines, node dots, one chord circle)
const LATTICE_SVG = `
<svg viewBox="0 0 480 360" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <g stroke="currentColor" stroke-width="1">
    <rect x="6" y="6" width="468" height="348"/>
    <rect x="24" y="24" width="432" height="312"/>
    <rect x="42" y="42" width="396" height="276"/>
    <line x1="6" y1="6" x2="240" y2="180"/><line x1="474" y1="6" x2="240" y2="180"/>
    <line x1="6" y1="354" x2="240" y2="180"/><line x1="474" y1="354" x2="240" y2="180"/>
    <circle cx="240" cy="180" r="84"/>
    <path d="M156 180a84 84 0 0 1 168 0"/>
    <line x1="240" y1="6" x2="240" y2="96"/>
    <line x1="60" y1="96" x2="420" y2="96"/>
    <line x1="60" y1="264" x2="420" y2="264"/>
    <line x1="300" y1="120" x2="474" y2="120"/>
    <line x1="300" y1="132" x2="474" y2="132"/>
    <line x1="300" y1="144" x2="474" y2="144"/>
  </g>
  <g fill="currentColor">
    <circle cx="240" cy="180" r="3"/>
    <circle cx="6" cy="6" r="2.5"/><circle cx="474" cy="6" r="2.5"/>
    <circle cx="6" cy="354" r="2.5"/><circle cx="474" cy="354" r="2.5"/>
    <circle cx="240" cy="96" r="2.5"/><circle cx="60" cy="96" r="2.5"/><circle cx="420" cy="96" r="2.5"/>
    <circle cx="60" cy="264" r="2.5"/><circle cx="420" cy="264" r="2.5"/>
    <circle cx="240" cy="6" r="2.5"/>
  </g>
</svg>`;

const STRIP_TEXT = "ᴘᴏᴜʀ·³³ ⌇ ʜᴀʟʟ ⌭ ⌇ 140 ᴍɪɴ⁻¹ ⌇ sp²∕sp³ ⌇ ⎔⎔⎔ ⌇ ᴅʀʏ ᴛɪᴍᴇ ∞ ⌇ ɴᴏ ʀᴇ-ᴇɴᴛʀʏ";

// panel headings become catalog codes; the i-badge tooltips (left intact —
// only the heading's first text node is touched) still spell everything out
const HEADING_CODES = [
  ["#cnPanel h2",   "Cɴ ⁰¹ ⌇ "],
  ["#rdfPanel h2",  "ʀᴅꜰ ⁰² ⌇ "],
  ["#bondPanel h2", "ʟᴇɴ ⁰³ ⌇ "],
  ["#ringPanel h2", "⌬ ⁰⁴ ⌇ "],
  ["#bnePanel h2",  "S⌭ ⁰⁵ ⌇ "],
];

let mounted = null;

function slabMount({ body, plot }) {
  const owned = [];
  const el = (tag, cls, html, parent) => {
    const e = document.createElement(tag);
    e.className = cls;
    if (html != null) e.innerHTML = html;
    e.setAttribute("data-theme-owned", "");
    e.setAttribute("aria-hidden", "true");
    (parent || body).appendChild(e);
    owned.push(e);
    return e;
  };
  el("div", "slab-defs", DEFS_SVG);
  el("div", "slab-grain");
  el("div", "slab-crop slab-crop-tl"); el("div", "slab-crop slab-crop-tr");
  el("div", "slab-crop slab-crop-bl"); el("div", "slab-crop slab-crop-br");
  el("div", "slab-stamp", "33");
  el("div", "slab-lattice", LATTICE_SVG);
  if (plot) el("div", "slab-strip", STRIP_TEXT, plot);
  const restored = [];
  for (const [sel, code] of HEADING_CODES) {
    const h = document.querySelector(sel);
    if (!h || !h.firstChild || h.firstChild.nodeType !== Node.TEXT_NODE) continue;
    restored.push([h.firstChild, h.firstChild.nodeValue]);
    h.firstChild.nodeValue = code;
  }
  mounted = { owned, restored };
}

function slabUnmount() {
  if (!mounted) return;
  for (const e of mounted.owned) e.remove();
  for (const [node, text] of mounted.restored) node.nodeValue = text;
  mounted = null;
}

// ---------- css ----------
const SLAB_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Saira+Stencil+One&family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap');

  body {
    font-family: "Space Grotesk", system-ui, sans-serif;
    padding: 20px 24px 20px 38px; /* room for the vertical spine */
    background-image: ${BODY_TEX};
    background-attachment: fixed;
    background-size: 700px;
  }

  /* ---- title: overprinted, misregistered ---- */
  header h1 {
    font-size: 20px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.14em;
    text-shadow: 1.5px 0 0 var(--slab-mis1), -1.5px 0 0 var(--slab-mis2);
  }
  header h1::before { content: "⌬ "; color: var(--cn3); text-shadow: none; }
  /* the subtitle becomes a catalog spine down the left edge */
  header .sub {
    position: fixed; left: 3px; top: 128px; z-index: 30;
    writing-mode: vertical-rl;
    font-family: "Space Mono", monospace; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.28em;
    color: var(--ink-2);
    max-height: 72vh; overflow: hidden;
    pointer-events: none;
  }
  header .sub::before { content: "⌇ "; }

  /* ---- controls: mechanical, uppercase, zero radius, no transitions ---- */
  .controls {
    font-family: "Space Mono", monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  select, button {
    font-family: "Space Mono", monospace; font-size: 11px;
    text-transform: uppercase; letter-spacing: 0.03em;
    border-radius: 0; border: 1px solid var(--border);
  }
  button:hover { background: var(--ink); color: var(--page); }
  input[type=range], input[type=checkbox] { accent-color: var(--cn3); }

  /* ---- slabs: hard edges, hard offset shadows ---- */
  .plot, .panel { border-radius: 0; border: 1px solid var(--border); box-shadow: 6px 6px 0 var(--slab-shadow); }
  /* bare pour only behind the cloud — the rings themselves are the honeycomb */
  .plot {
    background-image: ${POUR};
    background-size: 480px;
  }
  canvas { cursor: crosshair; }
  #canvas { filter: var(--slab-canvas-filter); }
  .tooltip, .row-tip, .info-tip {
    border-radius: 0; box-shadow: 4px 4px 0 var(--slab-shadow);
    font-family: "Space Mono", monospace; font-size: 11px;
  }
  .panel h2 {
    font-family: "Space Mono", monospace; font-weight: 700; font-size: 12px;
    letter-spacing: 0.16em; color: var(--ink);
    border-bottom: 2px solid var(--ink); padding-bottom: 5px;
  }
  .cn-dot, .bne-cls .dot { border-radius: 0; }
  .bne-ramp, .ring-bar, .ring-bar-drawn { border-radius: 0; }
  .cn-row, .ring-row, .bne-cls { border-radius: 0; }
  .cn-row:hover, .ring-row:hover, .bne-cls:hover { background: none; box-shadow: inset 4px 0 0 var(--cn3); }
  .cn-row.sel, .ring-row.sel, .bne-cls.sel { background: none; border-color: var(--ink); box-shadow: inset 4px 0 0 var(--cn4); }
  .bne-big b { font-family: "Space Mono", monospace; font-size: 24px; letter-spacing: -0.02em; }
  #rdfSvg text, #bondSvg text, #bneSvg text { font-family: "Space Mono", monospace; }
  footer {
    font-family: "Space Mono", monospace; font-size: 10px; letter-spacing: 0.04em;
    border-top: 1px solid var(--border); padding-top: 8px;
  }
  footer a { color: var(--cn4); }

  /* ---- set dressing (mounted nodes) ---- */
  .slab-defs { position: fixed; width: 0; height: 0; }
  .slab-grain {
    position: fixed; inset: -80px; z-index: 60; pointer-events: none;
    background-image: ${GRAIN}; background-size: 260px;
    mix-blend-mode: var(--slab-grain-blend); opacity: var(--slab-grain-op);
    animation: slab-jitter 0.8s steps(1) infinite;
  }
  @keyframes slab-jitter {
    0%   { transform: translate(0, 0); }
    25%  { transform: translate(-16px, 10px); }
    50%  { transform: translate(11px, -14px); }
    75%  { transform: translate(-6px, -8px); }
    100% { transform: translate(0, 0); }
  }
  .slab-crop { position: fixed; width: 15px; height: 15px; z-index: 55; pointer-events: none; opacity: 0.75; }
  .slab-crop-tl { top: 5px; left: 5px; border-top: 1px solid var(--ink); border-left: 1px solid var(--ink); }
  .slab-crop-tr { top: 5px; right: 5px; border-top: 1px solid var(--ink); border-right: 1px solid var(--ink); }
  .slab-crop-bl { bottom: 5px; left: 5px; border-bottom: 1px solid var(--ink); border-left: 1px solid var(--ink); }
  .slab-crop-br { bottom: 5px; right: 5px; border-bottom: 1px solid var(--ink); border-right: 1px solid var(--ink); }
  .slab-stamp {
    position: fixed; right: -3vw; bottom: -9vh; z-index: -1; pointer-events: none;
    font-family: "Saira Stencil One", "Space Grotesk", sans-serif;
    font-size: 44vh; line-height: 1; color: var(--ink);
    opacity: var(--slab-stamp-op); transform: rotate(7deg);
    -webkit-user-select: none; user-select: none;
  }
  /* printed on the ground behind the title/controls band — panels and plot
     are opaque slabs, so it vanishes under them instead of overlaying data */
  .slab-lattice {
    position: fixed; top: 4px; left: 30px; width: 620px; z-index: -1; pointer-events: none;
    color: var(--slab-lattice-ink); mix-blend-mode: var(--slab-lattice-blend);
    animation: slab-drift 160s linear infinite alternate;
  }
  @keyframes slab-drift { from { transform: translate(0, 0); } to { transform: translate(-46px, 26px); } }
  .slab-strip {
    position: absolute; left: 12px; right: 12px; bottom: 6px; z-index: 6; pointer-events: none;
    font-family: "Space Mono", monospace; font-size: 9px; letter-spacing: 0.34em;
    color: var(--slab-strip-ink); white-space: nowrap; overflow: hidden;
  }

  @media (prefers-reduced-motion: reduce) {
    .slab-grain, .slab-lattice { animation: none; }
  }
  @media (max-width: 760px) {
    body { padding: 16px; }
    header .sub {
      position: static; writing-mode: horizontal-tb;
      max-height: none; letter-spacing: 0.1em;
    }
    .slab-lattice, .slab-stamp { display: none; }
  }
`;

// ---------- canvas ----------
const SLAB_RENDER = {
  bondWidth: 0.8,
  bondAlphaBrushed: 0.08,
  dimAlpha: 0.06,
  ringFillAlpha: 0.42,      // flat screenprint fills…
  ringStrokeAlpha: 1,       // …with hard outlines
  ringWidth: 1.25,
  ringMutedFactor: 0.1,
  pairHighlightAlpha: 0.7,
  pairHighlightWidth: 1,
  rdfFillAlpha: 0.2,
  cellBoxWidth: 1.5,        // the formwork gets a heavier gauge
  axisLabelFont: "700 11px 'Space Mono', monospace",
  axisLabel: name => `${name.toUpperCase()}·Å`,
  // depth posterized into three print layers — far / mid / near pulls
  orbitSize:  t => [0.62, 0.88, 1.14][Math.max(0, Math.min(2, Math.floor(t * 3)))],
  orbitAlpha: t => [0.34, 0.62, 0.96][Math.max(0, Math.min(2, Math.floor(t * 3)))],
  // atoms are hard squares (area-matched down from the circumscribing square)
  drawAtom: (ctx, x, y, r, _t) => {
    const s = r * 1.8;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  },
  // selection reads as a specimen photo: corner brackets + crosshair ticks
  drawHalo: (ctx, x, y, rBase) => {
    const d = rBase * 1.6 + 5, b = d * 0.55;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x - d, y - d + b); ctx.lineTo(x - d, y - d); ctx.lineTo(x - d + b, y - d);
    ctx.moveTo(x + d - b, y - d); ctx.lineTo(x + d, y - d); ctx.lineTo(x + d, y - d + b);
    ctx.moveTo(x + d, y + d - b); ctx.lineTo(x + d, y + d); ctx.lineTo(x + d - b, y + d);
    ctx.moveTo(x - d + b, y + d); ctx.lineTo(x - d, y + d); ctx.lineTo(x - d, y + d - b);
    ctx.moveTo(x - d - 4, y); ctx.lineTo(x - d + 2, y);
    ctx.moveTo(x + d - 2, y); ctx.lineTo(x + d + 4, y);
    ctx.moveTo(x, y - d - 4); ctx.lineTo(x, y - d + 2);
    ctx.moveTo(x, y + d - 2); ctx.lineTo(x, y + d + 4);
    ctx.stroke();
  },
};

// ---------- the two plates ----------
window.__registerTheme({
  id: "slab-day",
  name: "░⌭⎔ʬ³³ ᵈᵃʸ",
  colorScheme: "light", // pinned: the slab ignores the OS setting

  vars: {
    "--page":     "#c8c7c2",
    "--surface":  "#d3d2cc",
    "--ink":      "#171715",
    "--ink-2":    "#45443f",
    "--muted":    "#75746c",
    "--grid":     "rgba(23,23,21,0.13)",
    "--baseline": "rgba(23,23,21,0.38)",
    "--border":   "rgba(23,23,21,0.6)",
    "--bond":     "rgba(23,23,21,0.32)",
    // sp² = washed silkscreen pink, sp³ = seafoam; everything else supporting ink
    "--cn0": "#171715", "--cn1": "#d1472b", "--cn2": "#b8862c",
    "--cn3": "#c26787", "--cn4": "#2f8f77", "--cn5": "#7b7fc4",
    "--cn6": "#8a63a8", "--cn7": "#a56a3a", "--cn8": "#2e8f9e",
    // rings diverge around a bare-concrete 6: pinks tighten below, seafoam deepens above
    "--ring3": "#a03050", "--ring4": "#bb567a", "--ring5": "#d08ba6",
    "--ring6": "#a5a49d",
    "--ring7": "#8fc4b3", "--ring8": "#57a48f", "--ring9": "#2f8574", "--ring10": "#1d5f56",
    "--strain-lo": "#d1472b", "--strain-mid": "#a5a49d", "--strain-hi": "#2f8f77",
    // ordinary → rare: concrete → periwinkle wash → hot signal pink
    "--bne-lo": "#b2b1aa", "--bne-mid": "#8f93cf", "--bne-hi": "#e0347c",
    // private (engine never reads these; the shared CSS resolves through them)
    "--slab-shadow":        "rgba(23,23,21,0.16)",
    "--slab-grain-blend":   "multiply",
    "--slab-grain-op":      "0.32",
    "--slab-canvas-filter": "url(#slab-warp)",
    "--slab-lattice-ink":   "rgba(38,146,166,0.5)",
    "--slab-lattice-blend": "multiply",
    "--slab-strip-ink":     "rgba(23,23,21,0.55)",
    "--slab-mis1":          "rgba(194,103,135,0.55)",
    "--slab-mis2":          "rgba(47,143,119,0.55)",
    "--slab-stamp-op":      "0.055",
  },

  css: SLAB_CSS,
  render: SLAB_RENDER,
  mount: slabMount,
  unmount: slabUnmount,
});

window.__registerTheme({
  id: "slab-night",
  name: "░⌭⎔ʬ³³ ⁿᵗ",
  colorScheme: "dark", // pinned nocturne

  vars: {
    "--page":     "#131312",
    "--surface":  "#1d1d1b",
    "--ink":      "#eceae2",
    "--ink-2":    "#b3b1a8",
    "--muted":    "#7b7a72",
    "--grid":     "rgba(236,234,226,0.11)",
    "--baseline": "rgba(236,234,226,0.32)",
    "--border":   "rgba(236,234,226,0.45)",
    "--bond":     "rgba(236,234,226,0.28)",
    // the day hues lifted to phosphorescence — same identities, lit from inside
    "--cn0": "#eceae2", "--cn1": "#ff6a45", "--cn2": "#dfa83e",
    "--cn3": "#ef8bb0", "--cn4": "#5fd4b4", "--cn5": "#9aa0ef",
    "--cn6": "#b285d8", "--cn7": "#cf8a4e", "--cn8": "#45c4d8",
    // on asphalt, distance from the 6-ring means brighter, or the poles vanish
    "--ring3": "#ff9dbd", "--ring4": "#e585a8", "--ring5": "#c46a89",
    "--ring6": "#5c5b55",
    "--ring7": "#4fa38c", "--ring8": "#6fc9ae", "--ring9": "#93e2c8", "--ring10": "#c1f4e2",
    "--strain-lo": "#ff6a45", "--strain-mid": "#eceae2", "--strain-hi": "#5fd4b4",
    "--bne-lo": "#302f2c", "--bne-mid": "#9aa0ef", "--bne-hi": "#ff4f9a",
    "--slab-shadow":        "rgba(0,0,0,0.5)",
    "--slab-grain-blend":   "screen",
    "--slab-grain-op":      "0.15",
    // night adds 1px chromatic misregistration to the cloud itself
    "--slab-canvas-filter": "url(#slab-warp) drop-shadow(1px 0 0 rgba(255,79,154,0.3)) drop-shadow(-1px 0 0 rgba(95,212,180,0.28))",
    "--slab-lattice-ink":   "rgba(69,196,216,0.45)",
    "--slab-lattice-blend": "screen",
    "--slab-strip-ink":     "rgba(236,234,226,0.5)",
    "--slab-mis1":          "rgba(255,79,154,0.6)",
    "--slab-mis2":          "rgba(95,212,180,0.6)",
    "--slab-stamp-op":      "0.07",
  },

  css: SLAB_CSS,
  render: SLAB_RENDER,
  mount: slabMount,
  unmount: slabUnmount,
});

})();

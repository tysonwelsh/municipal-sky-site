// Oppenheimer (Trinity) — the false dawn, not the printed report.
//
// A different reading of the same name: instead of the archival plate, the
// instrument looking at the thing itself. Two pinned variants, both selectable
// from the Theme dropdown:
//
//   Oppenheimer — Trinity (dark)   the event: emission on a near-black ground
//   Oppenheimer — Trinity (light)  the print: the same event pulled onto paper
//
// They are pinned rather than OS-following on purpose — you choose which one
// you are looking at, the way you would choose a plate. Both are registered
// from this one file and share their CSS and render parameters, so a change to
// the type or the drawing applies to both; only the palette differs.
//
// ORGANIZING RULE: colour is TEMPERATURE. Every hue sits somewhere on a
// black-body curve, so nothing is decorative — an atom's colour is where its
// coordination number lands on that curve, and a ring's colour is how far it
// sits from the graphitic 6. There is a deliberate discontinuity in the ramp
// between CN 3 and CN 4: the sp²→sp³ boundary is the physically meaningful
// break in these structures, so the palette breaks there too, with a full
// luminance jump rather than the small hue step a smooth ramp would give. That
// keeps the primary read — how sp² and sp³ interpenetrate — legible by
// brightness alone, which also survives every form of colour blindness.
//
// The dark variant makes that jump upward (bright orange → pale gold); the
// light variant makes it downward (mid warm → near-black indigo), because on
// paper you cannot print brighter than white. That is also where a real
// black-body curve goes at the top end, so the translation is honest rather
// than merely inverted.

// ---------------------------------------------------------------- shared ---
// Ground-dependent values are routed through --trin-* variables, which the
// engine never reads. That is what lets one CSS string serve both variants.
const TRINITY_CSS = `
  body, select, button, input {
    font-family: ui-monospace, "SF Mono", "IBM Plex Mono", Menlo, Consolas, monospace;
  }
  body { font-size: 13px; }
  .controls { font-size: 12px; gap: 12px; }

  header h1 {
    font-weight: 500;
    font-size: 17px;
    letter-spacing: 0.01em;
  }
  header .sub { font-size: 12px; letter-spacing: 0.005em; max-width: 78ch; line-height: 1.5; }

  .plot, .panel {
    border-radius: 4px;
    box-shadow: var(--trin-shadow);
  }

  /* The canvas is transparent, so this sits under the cloud: a warm core
     against a cold horizon. Both stops are low-alpha on purpose — it should
     read as light in the room, not as a graphic. */
  .plot {
    background-image:
      radial-gradient(78% 62% at 50% 54%, var(--trin-core), transparent 70%),
      radial-gradient(130% 110% at 50% 6%, var(--trin-sky), transparent 62%);
  }

  /* A quiet title card in the corner of the plate — a label for the theme,
     not a readout of the data. */
  .plot::after {
    content: "TRINITY · JULY 16 1945";
    position: absolute;
    left: 14px; bottom: 12px;
    font-size: 10px;
    letter-spacing: 0.22em;
    color: var(--muted);
    opacity: 0.55;
    pointer-events: none;
  }

  /* Monospace runs wider than the sans this layout was measured for, and the
     side panel is a fixed 230px — so the panels step down a size and the
     tracking on the headings stays modest, or "@1.8 Å" wraps to its own line. */
  .panel { font-size: 12px; }
  .panel h2 {
    font-size: 10px;
    letter-spacing: 0.11em;
    color: var(--ink-2);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--grid);
  }
  .panel .hint { font-size: 11px; line-height: 1.55; letter-spacing: 0.002em; }
  .meta-row { font-size: 11px; gap: 10px; }
  /* Monospace runs the widest here, so one side of the row has to be allowed
     to wrap. The shared CSS pins the value (a measurement must never orphan
     its unit), which makes the label the side that gives — so it must be able
     to shrink below its content width. */
  .meta-row > :first-child { min-width: 0; }

  /* Instrument readout: every count in a fixed column, no proportional drift. */
  .cn-count, .cn-pct, .ring-count, .meta-row b, #rdfSvg .rdf-readout {
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.02em;
  }

  .cn-dot {
    width: 9px; height: 9px;
    border-radius: 2px;                       /* square marks, like a filter strip */
    box-shadow: inset 0 0 0 1px var(--trin-dot-edge);
  }
  .cn-row:hover, .ring-row:hover {
    background: none;
    box-shadow: inset 0 0 0 1px var(--border);
  }
  .ring-bar, .ring-bar-drawn { border-radius: 0; }

  select, button { border-radius: 3px; letter-spacing: 0.02em; }
  button:hover:not(:disabled) { border-color: var(--cn2); color: var(--ink); }
  select:focus-visible, button:focus-visible,
  input[type=range]:focus-visible, input[type=checkbox]:focus-visible {
    outline: 1px solid var(--cn2);
    outline-offset: 2px;
  }
  input[type=range], input[type=checkbox] { accent-color: var(--cn2); }

  .tooltip { border-radius: 4px; box-shadow: var(--trin-tip); }

  #rdfSvg text { font: 10px ui-monospace, "SF Mono", Menlo, monospace; letter-spacing: 0.04em; }

  footer { letter-spacing: 0.01em; border-top: 1px solid var(--grid); padding-top: 8px; }
`;

// Everything structural is drawn as fine, cooling filament so the atoms
// themselves are the only bright thing in the frame.
const TRINITY_RENDER = {
  bondWidth: 0.8,
  bondAlphaBrushed: 0.05,
  dimAlpha: 0.06,           // an unselected atom goes nearly to ash

  ringFillAlpha: 0.18,
  ringStrokeAlpha: 0.9,
  ringWidth: 1,
  ringMutedFactor: 0.12,

  pairHighlightAlpha: 0.85, // the brushed shell is the flash — let it dominate
  pairHighlightWidth: 1.2,

  cellBoxWidth: 1,
  axisLabelFont: '11px ui-monospace, "SF Mono", Menlo, monospace',

  // The widest depth spread of any of these themes: on a near-black ground the
  // back of the cell should fall away into the dark, so the cloud has volume
  // rather than reading as a flat disc of dots.
  orbitSize:  t => 0.55 + 0.90 * t,
  orbitAlpha: t => 0.30 + 0.70 * t,

  // Same size calibration as the default in fly mode (an atom at entry distance
  // renders at exactly the slider size), with a heavier fog.
  flySize:  (rBase, radius, rz) => Math.min(14, Math.max(0.4, rBase * 1.5 * radius / rz)),
  flyAlpha: (radius, rz) => Math.max(0.07, Math.min(1, 1.25 - rz / (2.2 * radius))),
};

// ------------------------------------------------------------------ dark ---
// The event. Unexposed film, warm rather than neutral — never pure black,
// because pure black kills the depth falloff at the back of the cloud.
window.__registerTheme({
  id: "oppenheimer-trinity",
  name: "Oppenheimer — Trinity (dark)",
  colorScheme: "dark",

  vars: {
    "--page":     "#0a0908",
    "--surface":  "#131110",
    "--ink":      "#f5f0e8",   // paper-white, warm
    "--ink-2":    "#b3ab9e",
    "--muted":    "#6e675e",   // ash — also the fill for filtered-out atoms
    "--grid":     "#241f1a",   // chart gridlines AND the simulation-box outline
    "--baseline": "#37302a",
    "--border":   "rgba(245,240,232,0.10)",
    "--bond":     "rgba(196,168,138,0.20)",  // bonds as cooling filament, well back

    // Black-body curve: cold ember → white → blue-white.
    "--cn0": "#7c2d12",  // isolated: barely glowing, the coldest thing present
    "--cn1": "#b3401a",  // dangling end
    "--cn2": "#e0611f",  // sp chain (doubles as the RDF brush tint — hot, correct)
    "--cn3": "#ff8c2b",  // sp² graphitic ─┐ the break in the ramp: a full
    "--cn4": "#ffe9a8",  // sp³ diamond   ─┘ luminance step, not a hue step
    "--cn5": "#d7e9ff",  // over-coordinated: past white, into the blue end
    "--cn6": "#9ec4ff",
    "--cn7": "#6d9de0",
    "--cn8": "#4a72b8",

    // Ash at the graphitic 6; the further from 6 the more energy — strained
    // small rings burn warm, open large rings run cold.
    "--ring3":  "#ffb066", "--ring4": "#e07c30", "--ring5":  "#a85a26",
    "--ring6":  "#4f4a44",
    "--ring7":  "#46617f", "--ring8": "#6b8fb8", "--ring9":  "#9dbde0",
    "--ring10": "#d6e6f7",

    // ordinary → rare surprisal, on the same black-body story: ash → ember →
    // white-hot. Stated explicitly because the engine's fallback ends on cn1,
    // which here is *darker* than its own midpoint — the rare atoms would
    // recede on this ground instead of burning.
    "--bne-lo": "#37302a", "--bne-mid": "#e0611f", "--bne-hi": "#ffd9a0",

    "--trin-core":     "rgba(255,176,90,0.055)",   // warm core light under the cloud
    "--trin-sky":      "rgba(90,130,190,0.045)",   // cold pre-dawn sky at the edges
    "--trin-shadow":   "0 1px 0 rgba(255,235,200,0.035), 0 16px 44px rgba(0,0,0,0.62)",
    "--trin-tip":      "0 10px 30px rgba(0,0,0,0.6)",
    "--trin-dot-edge": "rgba(0,0,0,0.5)",
  },

  css: TRINITY_CSS,
  render: TRINITY_RENDER,
});

// ----------------------------------------------------------------- light ---
// The print. Desert-bone paper, and the same temperature ramp pulled into ink:
// the hot end runs to near-black indigo instead of to white, since paper has no
// brighter-than-white. Depth shading is gentler here — on a light ground,
// fading toward the background means vanishing, not receding.
window.__registerTheme({
  id: "oppenheimer-trinity-light",
  name: "Oppenheimer — Trinity (light)",
  colorScheme: "light",

  vars: {
    "--page":     "#efe8dc",   // bone / desert sand
    "--surface":  "#f8f3e9",
    "--ink":      "#191510",
    "--ink-2":    "#4a4136",
    "--muted":    "#8b8071",
    "--grid":     "#ded4c2",
    "--baseline": "#bcae97",
    "--border":   "rgba(25,21,16,0.14)",
    "--bond":     "rgba(120,100,78,0.30)",

    // Ink density rises with temperature. The 3│4 break jumps the other way
    // from the dark variant — mid warm to near-black indigo.
    "--cn0": "#d9a76a",  // coldest: a pale tan dot, still legible on paper
    "--cn1": "#c47a2e",
    "--cn2": "#a8501a",  // sp chain (also the RDF brush tint)
    "--cn3": "#8a3a12",  // sp² graphitic ─┐ mid warm ↓ near-black indigo:
    "--cn4": "#14243f",  // sp³ diamond   ─┘ the largest step in the ramp
    "--cn5": "#2f4f7d",  // past the break, the blue end lightens back out
    "--cn6": "#4a6f9e",
    "--cn7": "#6d90b8",
    "--cn8": "#94b0cd",

    // Same rule as the dark variant, read as ink: sand-grey at the graphitic 6,
    // and the further from 6 the denser the ink.
    "--ring3":  "#7a3410", "--ring4": "#a45a24", "--ring5":  "#c98f5c",
    "--ring6":  "#b0a695",
    "--ring7":  "#7f96b4", "--ring8": "#4f719b", "--ring9":  "#2c4d7d",
    "--ring10": "#16305a",

    // The same ramp as ink: paper-adjacent sand for the ordinary, and the
    // rare end lands on the indigo the CN ramp breaks to.
    "--bne-lo": "#cfc4ae", "--bne-mid": "#a8501a", "--bne-hi": "#14243f",

    "--trin-core":     "rgba(190,110,40,0.07)",    // a warm stain under the cloud
    "--trin-sky":      "rgba(60,90,140,0.05)",
    "--trin-shadow":   "0 1px 2px rgba(60,44,26,0.07), 0 12px 30px rgba(60,44,26,0.09)",
    "--trin-tip":      "0 8px 24px rgba(60,44,26,0.18)",
    "--trin-dot-edge": "rgba(25,21,16,0.28)",
  },

  css: TRINITY_CSS,

  // Shared drawing, with the handful of values that only make sense against a
  // dark ground relaxed for paper.
  render: {
    ...TRINITY_RENDER,
    bondWidth: 0.9,
    dimAlpha: 0.10,           // on paper, 0.06 is indistinguishable from gone
    ringFillAlpha: 0.20,
    pairHighlightAlpha: 0.7,
    orbitSize:  t => 0.70 + 0.60 * t,
    orbitAlpha: t => 0.55 + 0.45 * t,
    flyAlpha: (radius, rz) => Math.max(0.14, Math.min(1, 1.25 - rz / (2.5 * radius))),
  },
});

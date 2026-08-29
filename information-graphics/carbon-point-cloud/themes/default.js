// Default theme — reproduces the viewer's original built-in look.
// `vars` is the light palette, `varsDark` its dark counterpart; the engine
// picks between them following the OS `prefers-color-scheme` setting.
window.__registerTheme({
  id: "default",
  name: "Original (system light/dark)",

  vars: {
    "--page":     "#f9f9f7",
    "--surface":  "#fcfcfb",
    "--ink":      "#0b0b0b",
    "--ink-2":    "#52514e",
    "--muted":    "#898781",
    "--grid":     "#e1e0d9",
    "--baseline": "#c3c2b7",
    "--border":   "rgba(11,11,11,0.10)",
    "--bond":     "rgba(120,118,112,0.40)",
    // atom colors by coordination number (CN 0–8)
    "--cn0": "#0b0b0b", "--cn1": "#e34948", "--cn2": "#eda100",
    "--cn3": "#008300", "--cn4": "#2a78d6", "--cn5": "#e87ba4",
    "--cn6": "#4a3aa7", "--cn7": "#eb6834", "--cn8": "#1baf7a",
    // ring sizes 3–10: diverging around the graphitic 6-ring
    "--ring3": "#a11f1e", "--ring4": "#cc3d3b", "--ring5": "#e98481",
    "--ring6": "#b3b1aa", "--ring7": "#7fb1ed", "--ring8": "#3987e5",
    "--ring9": "#1c5cab", "--ring10": "#0d366b",
  },

  varsDark: {
    "--page":     "#0d0d0d",
    "--surface":  "#1a1a19",
    "--ink":      "#ffffff",
    "--ink-2":    "#c3c2b7",
    "--muted":    "#898781",
    "--grid":     "#2c2c2a",
    "--baseline": "#383835",
    "--border":   "rgba(255,255,255,0.10)",
    "--bond":     "rgba(150,148,142,0.35)",
    // the light hues do not survive a near-black ground (#008300 was 3.5:1 on
    // --surface, and CN 3 is most of the cloud) — same neutral "system"
    // character, lifted to dark-ground luminances
    "--cn0": "#ffffff", "--cn1": "#f85149", "--cn2": "#d29922",
    "--cn3": "#3fb950", "--cn4": "#58a6ff", "--cn5": "#db61a2",
    "--cn6": "#a371f7", "--cn7": "#f0883e", "--cn8": "#2dd4bf",
    "--ring3": "#f28d8b", "--ring4": "#e2716f", "--ring5": "#cf5654",
    "--ring6": "#6e6c66", "--ring7": "#4f92e4", "--ring8": "#6da7ec",
    "--ring9": "#9ec5f4", "--ring10": "#cde2fb",
    // ordinary → rare: the fallback (baseline→cn2→cn1) ends on a red that is
    // darker than its own midpoint, so rare atoms receded instead of popping
    "--bne-lo": "#3a3a38", "--bne-mid": "#d29922", "--bne-hi": "#ffcf40",
  },

  // Extra CSS injected as-is (textures, fonts, radii, shadows…). Empty here.
  css: "",

  // Canvas render parameters (these equal the engine's built-in fallbacks;
  // listed here as the reference for what each value controls).
  render: {
    bondWidth: 1,             // stroke width of bonds
    bondAlphaBrushed: 0.10,   // bond opacity while an RDF range is brushed
    dimAlpha: 0.10,           // opacity of atoms filtered out by a selection
    ringFillAlpha: 0.30,      // ring polygon fill opacity
    ringStrokeAlpha: 0.7,     // ring polygon outline opacity
    ringMutedFactor: 0.18,    // ring fade factor while an RDF range is brushed
    ringWidth: 1,             // ring outline width
    pairHighlightAlpha: 0.55, // RDF pair-highlight line opacity
    pairHighlightWidth: 1,    // RDF pair-highlight line width
    cellBoxWidth: 1,          // simulation box outline width
    axisLabelFont: "12px system-ui, sans-serif", // canvas axis labels
    // depth shading in orbit view: t = 0 (far) … 1 (near)
    orbitSize: t => 0.72 + 0.55 * t,   // point radius multiplier
    orbitAlpha: t => 0.55 + 0.45 * t,  // point opacity
    // fly view: apparent size/opacity vs camera distance rz
    flySize: (rBase, radius, rz) => Math.min(14, Math.max(0.4, rBase * 1.5 * radius / rz)),
    flyAlpha: (radius, rz) => Math.max(0.14, Math.min(1, 1.25 - rz / (2.5 * radius))),
  },
});

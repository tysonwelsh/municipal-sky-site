// Midnight — a pinned dark theme (ignores the OS light/dark setting).
// Demonstrates everything a theme can control: palette vars, extra CSS
// (typography, shadows, a dot-grid texture on the plot), and canvas render
// parameters (stronger depth shading, pinned axis font).
window.__registerTheme({
  id: "midnight",
  name: "Midnight",
  colorScheme: "dark", // pinned: no varsDark, so OS dark/light changes have no effect

  vars: {
    "--page":     "#0b1020",
    "--surface":  "#141b31",
    "--ink":      "#e8ecf8",
    "--ink-2":    "#9aa4c0",
    "--muted":    "#5f6b8a",
    "--grid":     "#223050",
    "--baseline": "#2a3a5e",
    "--border":   "rgba(160,180,255,0.14)",
    "--bond":     "rgba(140,160,220,0.35)",
    // One hue family, read as instrument emission: ice-cyan carries sp²,
    // violet carries sp³ (hue AND a ~2× luminance gap, so the primary read
    // survives colour blindness), gold the sp chains, magenta the defects.
    "--cn0": "#f0f4ff", "--cn1": "#ff5c87", "--cn2": "#ffc857",
    "--cn3": "#33d6ff", "--cn4": "#9d7bff", "--cn5": "#ff7ad9",
    "--cn6": "#c084fc", "--cn7": "#ff9e64", "--cn8": "#2dd4bf",
    // rings: same diverging rule (warm = smaller, cool = larger), retuned to
    // the palette above; the graphitic 6 stays the quietest bar.
    "--ring3": "#ffb3a0", "--ring4": "#ff8f7d", "--ring5": "#ff6a5e",
    "--ring6": "#4a5578", "--ring7": "#5fb7ff", "--ring8": "#8ccfff",
    "--ring9": "#b8e2ff", "--ring10": "#e0f2ff",
    // bond strain: compressed → median → stretched. The median must read
    // neutral on THIS surface, so it cannot inherit the light-theme grey.
    "--strain-lo": "#ff6a5e", "--strain-mid": "#7a86a8", "--strain-hi": "#5fb7ff",
    // ordinary → rare surprisal ramp: dim indigo → warm → bright gold.
    // Explicit rather than the baseline→cn2→cn1 fallback, which is not
    // monotonic in lightness on this ground.
    "--bne-lo": "#3a4a78", "--bne-mid": "#ff8a5c", "--bne-hi": "#ffe08a",
  },

  css: `
    body { font-family: "Avenir Next", "Trebuchet MS", system-ui, sans-serif; }
    .panel, .plot { box-shadow: 0 8px 30px rgba(0,0,0,0.35); }
    /* a low glow under the cloud, then the dot grid over it — the canvas is
       transparent, so this reads as light in the instrument rather than as a
       graphic. Order matters: the gradient is listed second so it paints
       beneath the grid, and its background-size entry must match. */
    .plot {
      background-image:
        radial-gradient(rgba(120,150,255,0.06) 1px, transparent 1px),
        radial-gradient(70% 60% at 50% 50%, rgba(80,150,255,0.05), transparent 70%);
      background-size: 22px 22px, auto;
    }
    #rdfSvg text { font-family: "Avenir Next", system-ui, sans-serif; }
  `,

  render: {
    bondWidth: 1.2,
    dimAlpha: 0.08,
    // stronger depth falloff than the default, for a more "deep space" feel
    orbitAlpha: t => 0.40 + 0.60 * t,
    axisLabelFont: "12px 'Avenir Next', system-ui, sans-serif",
    rdfFillAlpha: 0.16, // a little glow pooling beneath the g(r) curve
  },
});

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
    "--cn0": "#e8ecf8", "--cn1": "#ff5d73", "--cn2": "#ffb020",
    "--cn3": "#3ddc84", "--cn4": "#4cc3ff", "--cn5": "#ff7ad9",
    "--cn6": "#a78bfa", "--cn7": "#ff8a3d", "--cn8": "#2dd4bf",
    "--ring3": "#ff8a80", "--ring4": "#ff6d64", "--ring5": "#e8503f",
    "--ring6": "#4a5578", "--ring7": "#5e8ce6", "--ring8": "#7aa5f0",
    "--ring9": "#a3c2fa", "--ring10": "#d3e0ff",
  },

  css: `
    body { font-family: "Avenir Next", "Trebuchet MS", system-ui, sans-serif; }
    .panel, .plot { box-shadow: 0 8px 30px rgba(0,0,0,0.35); }
    .plot {
      background-image: radial-gradient(rgba(120,150,255,0.06) 1px, transparent 1px);
      background-size: 22px 22px;
    }
    #rdfSvg text { font-family: "Avenir Next", system-ui, sans-serif; }
  `,

  render: {
    bondWidth: 1.2,
    dimAlpha: 0.08,
    // stronger depth falloff than the default, for a more "deep space" feel
    orbitAlpha: t => 0.40 + 0.60 * t,
    axisLabelFont: "12px 'Avenir Next', system-ui, sans-serif",
  },
});

// Kandinsky — Bauhaus, Weimar/Dessau circa 1923–1933. Flat primary gouache on
// warm cream, black construction lines, geometric type (Bayer-style lowercase),
// the circle–triangle–square grammar of the preliminary course.
//
// ORGANIZING RULE: every mark is a flat geometric primitive in one of the
// three primaries (red / blue / yellow) or black ink — no gradients of
// meaning, no decoration that isn't construction.
//
// Registered as two PINNED themes (no varsDark, so the OS light/dark setting
// is ignored): the daylight plate after "Composition VIII", and the nocturne
// after "Several Circles" (1926) — same primaries on deep indigo.

const KANDINSKY_SHARED = {
  // CN classes — the Bauhaus primaries first, then Kandinsky's secondary
  // accents: flat, opaque gouache
  "--cn0": "#181512", // black
  "--cn1": "#BE1E2D", // vermilion
  "--cn2": "#F2A81D", // mustard yellow (also: pair highlight & brush tint)
  "--cn3": "#1D4E9E", // ultramarine (graphitic sp²)
  "--cn4": "#E85A24", // orange (diamond-like sp³; also the RDF curve)
  "--cn5": "#7A3B8F", // violet
  "--cn6": "#5F7033", // olive
  "--cn7": "#8A5A2B", // ochre
  "--cn8": "#2E8C8C", // teal

  // rings: warm primaries tighten below the graphitic 6-ring,
  // ultramarine deepens above it
  "--ring3": "#7E1420", "--ring4": "#BE1E2D", "--ring5": "#D94F4F",
  "--ring6": "#C9BFA9", "--ring7": "#7A93C4", "--ring8": "#4A6CB0",
  "--ring9": "#1D4E9E", "--ring10": "#122F63",
};

const KANDINSKY_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;600;700&display=swap');

  /* ---- geometric sans; Bayer universal-alphabet lowercase ---- */
  body, select, button, input {
    font-family: "Josefin Sans", Futura, "Century Gothic", sans-serif;
  }
  #rdfSvg text { font-family: "Josefin Sans", Futura, sans-serif; }
  header h1 {
    text-transform: lowercase;
    letter-spacing: 0.04em;
    font-weight: 700;
  }

  /* ---- the preliminary-course triad: red circle, yellow triangle,
         blue square, set before the title ---- */
  header h1::before {
    content: "";
    display: inline-block;
    width: 84px; height: 22px;
    margin-right: 12px;
    vertical-align: baseline;
    background:
      radial-gradient(circle at 11px 11px, #BE1E2D 10px, transparent 10.5px),
      conic-gradient(from 150deg at 50% 0%, #F2A81D 0deg 60deg, transparent 60deg),
      linear-gradient(#1D4E9E, #1D4E9E);
    background-size: 22px 22px, 24px 22px, 18px 18px;
    background-position: 0 0, 32px 0, 64px 2px;
    background-repeat: no-repeat;
  }
  header .sub { letter-spacing: 0.03em; }

  /* ---- flat plates: squared corners, firm rule, no shadow ---- */
  .panel, .plot, .tooltip, button, select {
    border-radius: 0;
    box-shadow: none;
    border-color: var(--border);
  }
  .panel h2 {
    text-transform: lowercase;
    letter-spacing: 0.14em;
    font-weight: 700;
    color: var(--ink);
    border-bottom: 2px solid var(--ink);
    padding-bottom: 5px;
  }
  .panel h2::before {
    content: "";
    display: inline-block;
    width: 9px; height: 9px;
    background: #BE1E2D;
    margin-right: 8px;
  }

  /* ---- controls: flat ruled fields; vermilion for the checked state ---- */
  input[type=range], input[type=checkbox] { accent-color: #BE1E2D; }
  button:hover { background: var(--ink); color: var(--surface); }
  .cn-row:hover, .ring-row:hover { background: none; box-shadow: inset 3px 0 0 #BE1E2D; }

  footer { border-top: 2px solid var(--ink); padding-top: 6px; letter-spacing: 0.02em; }
`;

const KANDINSKY_RENDER = {
  bondWidth: 1,
  bondAlphaBrushed: 0.12,
  dimAlpha: 0.12,
  ringWidth: 1,
  ringFillAlpha: 0.35,     // flat gouache fills, a little more present
  ringStrokeAlpha: 0.9,
  ringMutedFactor: 0.18,
  pairHighlightAlpha: 0.55,
  pairHighlightWidth: 1,
  cellBoxWidth: 1,
  axisLabelFont: "12px 'Josefin Sans', Futura, sans-serif",
  axisLabel: name => `${name} · Å`, // bayer lowercase, abbreviated unit
  // confident, poster-flat marks: restrained depth shading
  orbitSize: t => 0.80 + 0.40 * t,
  orbitAlpha: t => 0.70 + 0.30 * t,
};

window.__registerTheme({
  id: "kandinsky",
  name: "Kandinsky",
  colorScheme: "light", // pinned: OS dark mode does not flip this plate

  vars: {
    ...KANDINSKY_SHARED,
    "--page":     "#EFE7D3",           // warm cream
    "--surface":  "#F6F0E0",
    "--ink":      "#181512",
    "--ink-2":    "#4A453C",
    "--muted":    "#8A8172",
    "--grid":     "rgba(24,21,18,0.16)",
    "--baseline": "rgba(24,21,18,0.40)",
    "--border":   "rgba(24,21,18,0.70)",
    "--bond":     "rgba(24,21,18,0.45)", // black construction lines
  },

  css: KANDINSKY_CSS,

  render: KANDINSKY_RENDER,
});

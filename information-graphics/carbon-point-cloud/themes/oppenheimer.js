// Oppenheimer — mid-century scientific document. A plate from a technical
// report: warm cream paper, warm-black ink, diazo-blue accent, ruled frames,
// serif small caps, graph-paper grid printed under the data.
//
// ORGANIZING RULE: two-color printing (warm black + ONE diazo blue accent);
// the richer Du Bois gouache set is admitted only for the CN classes, which
// are a categorical channel hue cannot carry otherwise. Everything else —
// rings, grids, bonds, curves — is ink dilution or diazo dilution alone.
window.__registerTheme({
  id: "oppenheimer",
  name: "Oppenheimer",
  colorScheme: "light", // pinned paper plate; the dark lecture-hall variant is a separate theme

  vars: {
    // paper & ink — never pure white, never pure black
    "--page":     "#EAE0C8",           // page: darker warm cream
    "--surface":  "#F1EAD7",           // plates: lighter cream, pasted on the page
    "--ink":      "#1F1D1A",
    "--ink-2":    "#3A362F",
    "--muted":    "#6E6553",           // aged, washed-out ink
    // diazo whiteprint conventions: pale blue ruled lines on cream
    "--grid":     "rgba(18,56,90,0.25)",
    "--baseline": "rgba(18,56,90,0.45)",
    "--border":   "rgba(31,29,26,0.60)", // hairline rules for plate frames
    "--bond":     "rgba(18,56,90,0.45)", // bonds as pale diazo strokes

    // CN classes — Du Bois 1900 gouache set: flat, chalky, never saturated
    "--cn0": "#1F1D1A", // ink
    "--cn1": "#8E3320", // oxide red
    "--cn2": "#AE8B47", // ochre (also: pair highlight & RDF brush tint)
    "--cn3": "#4A7A6F", // dusty teal (graphitic sp²)
    "--cn4": "#12385A", // diazo blue — THE accent (diamond-like sp³, RDF curve)
    "--cn5": "#5C4B8B", // ditto violet
    "--cn6": "#6B6B3A", // olive
    "--cn7": "#7A5C3E", // diazo sepia
    "--cn8": "#9C5A48", // chalky brick

    // rings: diverging around the graphitic 6-ring — oxide-red dilutions for
    // the small (non-graphitic) rings, diazo dilutions for the large ones
    "--ring3": "#5E1F12", "--ring4": "#8E3320", "--ring5": "#B0624A",
    "--ring6": "#A39B87", "--ring7": "#6E82A0", "--ring8": "#47648C",
    "--ring9": "#27496E", "--ring10": "#12385A",
  },

  css: `
    @import url('https://fonts.googleapis.com/css2?family=Old+Standard+TT:ital,wght@0,400;0,700;1,400&display=swap');

    /* ---- type: Monotype-Modern-revival serif; no sans-serif anywhere ---- */
    body, select, button, input {
      font-family: "Old Standard TT", "Latin Modern Roman", "Computer Modern Serif", Georgia, serif;
    }
    #rdfSvg text {
      font-family: "Old Standard TT", Georgia, serif;
      font-size: 11px;
    }

    /* ---- paper: laid lines, faint foxing at the edges ---- */
    body {
      background-color: var(--page);
      background-image:
        repeating-linear-gradient(0deg, rgba(31,29,26,0.025) 0 1px, transparent 1px 7px),
        radial-gradient(ellipse at 6% 3%,  rgba(122,92,62,0.10), transparent 42%),
        radial-gradient(ellipse at 97% 94%, rgba(122,92,62,0.09), transparent 48%);
    }

    /* ---- figure caption convention: small caps ---- */
    header h1 {
      font-variant: small-caps;
      letter-spacing: 0.03em;
      font-weight: 700;
    }
    header .sub { font-style: italic; }

    /* ---- plates: squared corners, hairline + double rule frames ---- */
    .panel, .plot, .tooltip, button, select {
      border-radius: 0;
      box-shadow: none;
    }
    .panel, .plot {
      border: 1px solid var(--border);
      outline: 1px solid rgba(31,29,26,0.35);
      outline-offset: 3px;
    }
    .tooltip {
      border: 3px double var(--border);
      background: var(--surface);
    }

    /* ---- panel headings as ruled title blocks ---- */
    .panel h2 {
      font-family: "Old Standard TT", Georgia, serif;
      font-variant: small-caps;
      letter-spacing: 0.10em;
      color: var(--ink);
      border-bottom: 3px double rgba(31,29,26,0.55);
      padding-bottom: 6px;
    }

    /* ---- the figure plate: plain cream stock, pasted in by hand
           (slightly off true) ---- */
    .plot {
      background-color: var(--surface);
      transform: rotate(-0.4deg);
    }

    /* ---- controls as ruled form fields; diazo accent for checked state ---- */
    input[type=range], input[type=checkbox] { accent-color: #12385A; }
    button:hover { background: rgba(18,56,90,0.08); color: var(--ink); }

    /* ---- legend & ring rows: no modern hover wash, just an underline rule ---- */
    .cn-row:hover, .ring-row:hover { background: none; box-shadow: inset 0 -1px 0 rgba(31,29,26,0.35); }

    /* ---- ring chart: vertical count gridlines plus a base rule under the
           axis. The per-row horizontal ledger lines were removed — behind
           eight stacked bars they read as chart junk rather than ruling. ---- */
    .ring-axis-track { border-bottom: 1px solid rgba(18,56,90,0.50); }

    /* ---- footer as a colophon ---- */
    footer { font-style: italic; border-top: 1px solid rgba(31,29,26,0.35); padding-top: 6px; }
  `,

  render: {
    // hairline strokes throughout, as drawn with a ruling pen
    bondWidth: 0.8,
    bondAlphaBrushed: 0.12,
    dimAlpha: 0.12,
    ringWidth: 0.8,
    ringFillAlpha: 0.22,     // fills read as flat tint, not glow
    ringStrokeAlpha: 0.8,
    ringMutedFactor: 0.18,
    pairHighlightAlpha: 0.5,
    rdfFillAlpha: 0.08, // faint washed tint beneath g(r), like an old plate
    pairHighlightWidth: 0.8,
    cellBoxWidth: 1,
    // canvas axis labels: serif, ALL CAPS, abbreviated unit
    axisLabelFont: "12px 'Old Standard TT', Georgia, serif",
    axisLabel: name => `${name.toUpperCase()} (Å)`,
    // printed marks vary little with depth — flatter shading than a modern viz
    orbitSize: t => 0.85 + 0.30 * t,
    orbitAlpha: t => 0.72 + 0.28 * t,
  },
});

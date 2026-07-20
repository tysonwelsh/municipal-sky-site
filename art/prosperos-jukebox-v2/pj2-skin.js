// ============================================================================
// Prospero's Jukebox v2 — pj2-skin.js
// PJ2.Skin: the shared visual-skin engine. Graphics build, step 2 of 5.
//
// Everything the three mockups PROVED, extracted and unified: the codex's
// parchment stack and Bayer ink-wash (mockup-1), the grimoire's soot rag and
// palette-step hush (mockup-2), the atlas's burnished plate and hierarchy
// lesson (mockup-3). This module is a TOOLKIT, not a framework — pj2-viz.js
// will call these helpers to draw plates; nothing in here knows about audio
// engines, spirals, or layouts. It owns exactly four hard-won disciplines:
//
//   1. THE ART-PIXEL GRID (§2/§6). One art-pixel U = 2 CSS px, rendered at
//      round(2 × devicePixelRatio) DEVICE px so the grid lands on integer
//      device pixels at every common DPR (1→2, 1.5→3, 2→4). One helper owns
//      this math; no renderer computes its own unit. That rule exists because
//      v1's per-canvas ad-hoc sizing produced half-pixel seams between the
//      paper texture and the stamped sigils at DPR 1.5.
//
//   2. THE LOCKED PALETTES (§2), with the mockups' measured adjustments
//      encoded as RULES the API enforces, not advice in a comment:
//      dataInk(track) returns only the colors legally allowed to be the sole
//      carrier of a data mark on that track's paper. The grimoire taught us
//      blood is 2.3:1 on soot (decoration only); the atlas taught us deep
//      silver is 3.4:1 (depth cues and hatching, never alone); the codex
//      taught us rubric-1 fails at body size (rubric-0 does body duty).
//
//   3. PAPER IS BAKED, SEEDED, AND QUIET WHERE INK MUST SPEAK. All three
//      generators carry the §6 plate zone (reduced mottle amplitude where
//      the spiral lives) and the codex mockup's extension of it: quietRects
//      for the text columns. Texture never fights a thin data line.
//      NOTE the deliberate inversion of the audio-texture rule: in the sound
//      engines, unseeded Math.random is FINE for texture (zankyo's rule —
//      noise is noise). Here the opposite holds: paper must be reproducible
//      per seed (same evening, same stains), so ALL texture flows from
//      PJ2.Rand streams and Math.random is forbidden in this file.
//
//   4. DECAY IS RE-THRESHOLDING, NOT ALPHA (§2). Emblems fade by dropping
//      cells in blue-noise order, so an old mark looks like ink absorbing
//      into the page, not a ghost dimming. On dark papers alpha fades also
//      sink marks below 4.5:1 (grimoire lesson) — palette steps and cell
//      dropout are the only legal decays.
//
// House rules: IIFE on window.PJ2, ES5 voice, loadable in the headless Node
// harness — no top-level DOM/canvas access, everything lazy, factories take
// their targets. Depends on PJ2.Rand (load order: pj2-rand.js first).
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Skin = (function () {
  "use strict";

  // ==========================================================================
  // canvas factory — lazy + injectable so the harness can hand us mock
  // canvases. Never touched at load time.
  // ==========================================================================
  var canvasFactory = null;
  function setCanvasFactory(fn) { canvasFactory = fn; }
  function createCanvas(w, h) {
    var cv;
    if (canvasFactory) cv = canvasFactory(w, h);
    else if (typeof document !== "undefined") cv = document.createElement("canvas");
    else throw new Error("PJ2.Skin: no canvas factory — call setCanvasFactory() in headless environments");
    cv.width = w; cv.height = h;
    return cv;
  }

  // ==========================================================================
  // GRID — the one owner of art-pixel math (§2, §6)
  // ==========================================================================
  var U = 2; // one art-pixel = 2 CSS px. The whole retro texture hangs on this.

  // device pixels per art cell: round(2 × dpr). Integer at every common DPR,
  // and rounding (not flooring) keeps odd DPRs like 1.25 from collapsing the
  // grid to sub-CSS cells.
  function deviceUnit(dpr) { return Math.max(1, Math.round(U * dpr)); }

  // CSS px per art cell at this DPR. NOT always exactly 2: at DPR 1.25 the
  // cell is 3 device px = 2.4 CSS px. Grid-snapped drawing must use THIS
  // value, because i·cssUnit·dpr = i·deviceUnit lands on integer device px.
  function cssUnit(dpr) { return deviceUnit(dpr) / dpr; }

  // snap a CSS coordinate to the art grid for the given DPR
  function snap(v, dpr) {
    var u = cssUnit(dpr || 1);
    return Math.round(v / u) * u;
  }

  // Per-canvas setup. kind decides the smoothing flag per §6:
  //   "art"  — paper, furniture, grain, stamps: smoothing OFF, chunky is law
  //   "data" — the per-frame data layer: smoothing ON, sub-pixel accurate
  // Returns a G object every other helper in this file accepts.
  function fit(canvas, opts) {
    opts = opts || {};
    var dpr = opts.dpr;
    if (dpr === undefined) {
      dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    }
    var w = opts.w, h = opts.h;
    if ((w === undefined || h === undefined) && canvas.getBoundingClientRect) {
      var r = canvas.getBoundingClientRect();
      if (w === undefined) w = r.width;
      if (h === undefined) h = r.height;
    }
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var kind = opts.kind || "art";
    ctx.imageSmoothingEnabled = (kind === "data");
    var u = cssUnit(dpr);
    return {
      canvas: canvas, ctx: ctx, kind: kind,
      w: w, h: h, dpr: dpr,
      u: u,                        // CSS px per art cell
      du: deviceUnit(dpr),         // device px per art cell (always integer)
      cols: Math.ceil(w / u),
      rows: Math.ceil(h / u),
      snap: function (v) { return Math.round(v / u) * u; },
    };
  }

  var Grid = { U: U, deviceUnit: deviceUnit, cssUnit: cssUnit, snap: snap, fit: fit };

  // ==========================================================================
  // PALETTES — the locked registry (§2) + the mockups' validated ink law
  // ==========================================================================
  // Every hex below is verbatim from PLAN-GRAPHICS §2. The `data` list and
  // `rules` per track are the three mockups' MEASURED findings, promoted from
  // design-notes prose into API-enforced facts. `worstBg` is the darkest
  // (light papers) / lightest (dark papers) tone a data mark can land on
  // inside a plate/text zone — the zones clamp the bake, so this is exact.
  //
  // `spiral` (PLAN-SPIRAL-REVERT, owner 2026-07-20): the v1 phosphor coil
  // palette, verbatim from prosperos-jukebox-themes.js → canvas. The plate
  // window is painted `spiral.bg` (the track's near-black night ground);
  // the coil, constellation floor, and note marks inside the window draw in
  // these colors. RGB triples are kept triple-form because the v1 renderer
  // composes them with computed alpha; `spiral.data` lists the hex forms
  // that are legal SOLE data carriers on the night ground (all clear 4.5:1
  // against bg by a wide margin — light ink on near-black).
  // NIGHT FOLIO (PLAN-NIGHT-FOLIO §C, owner 2026-07-20): the panels all
  // sit on the track's night ground now — the ramps below are the night
  // values. Library's apparatus ink flipped from iron-gall-on-parchment to
  // the amber phosphor ramp; measured on #0a0805: 15.1 / 11.2 / 5.9 / 3.3.
  // Rubric fails as data on night (4.0:1 / 2.7:1) and demotes to
  // display-size accent duty — gilt (8.3:1) carries its data-side jobs.
  // The parchment ramp lives on only in the folio frame + tabs (CSS).
  var PALETTES = {
    library: {
      void_:  "#0b0a08",
      paper:  ["#0a0805", "#120d07", "#1a130a", "#241a0d", "#2e2114"],
      ink:    ["#ffdc82", "#ffc878", "#b4823c", "#785f32"],
      rubric: ["#8e3b2c", "#b0553c"],
      gilt:   ["#c9a227", "#e8c95a"],
      // data-legal ink on the night ground (grain tone = worst case):
      data:   ["#ffdc82", "#ffc878", "#b4823c", "#c9a227"],
      worstBg: "#120d07",
      primary: "#ffdc82", accent: "#c9a227",
      exceptions: {
        "#785f32": "faintest amber step: depth cues and aged log lines only, never the sole carrier (3.3:1)",
      },
      rules: {
        "#8e3b2c": "rubric: display-size accents only on night (2.7:1) — gilt carries rubric's data-side jobs",
        "#b0553c": "rubric-1: display-size accents only on night (4.0:1) — gilt carries rubric's data-side jobs",
      },
      spiral: {
        bg: "#0a0805",
        ribbonStroke: [255, 220, 130], ribbonFill: [255, 170, 0],
        baseStroke:   [180, 130, 60],
        inKeyLabel:   [255, 220, 140], outKeyLabel: [120, 95, 50],
        octaveLabel:  [255, 200, 120],
        constFg: "255,170,0", constSub: "255,130,40",
        lollipopHead: "rgba(255,220,130,1)",
        // #b4823c = baseStroke hex: the far-limb depth step for marks
        data: ["#ffdc82", "#ffaa00", "#ffdc8c", "#ffc878", "#b4823c"],
      },
    },
    sycorax: {
      void_:  "#070605",
      paper:  ["#08070f", "#0e0c17", "#151220"],
      ink:    ["#0d0b09", "#1a1512"],
      bone:   ["#d8cfc0", "#b3a68e", "#7d715c"],
      blood:  ["#6e2a22", "#93392b"],
      witch:  ["#9b87b8", "#c4b5fd"],
      // bone carries ALL the data on the night ground; the hush is a
      // palette step bone-0 → bone-1, never an alpha fade.
      data:   ["#d8cfc0", "#b3a68e", "#c4b5fd"],
      worstBg: "#151220", // lightest night tone = worst case for light marks
      primary: "#d8cfc0", accent: "#c4b5fd",
      exceptions: {
        "#7d715c": "dim bone: depth-cue far limb + oldest ink-age step, never the sole carrier",
      },
      rules: {
        "#6e2a22": "blood never carries data (2.3:1 on this paper) — rubrication beside bone only",
        "#93392b": "blood never carries data (2.3:1 on this paper) — rubrication beside bone only",
        "#9b87b8": "dim witch-light: the apparition's halo only; data-carrying witch-light is the bright step",
        "#0d0b09": "ink carries weight and depth on soot, never data — the block prints in negative",
        "#1a1512": "ink carries weight and depth on soot, never data — the block prints in negative",
      },
      spiral: {
        bg: "#08070f",
        ribbonStroke: [220, 200, 255], ribbonFill: [200, 150, 255],
        baseStroke:   [140, 100, 200],
        inKeyLabel:   [220, 200, 255], outKeyLabel: [95, 80, 130],
        octaveLabel:  [200, 170, 240],
        constFg: "196,181,253", constSub: "155,135,216",
        lollipopHead: "rgba(220,200,255,1)",
        data: ["#dcc8ff", "#c896ff", "#c8aaf0"],
      },
    },
    ariel: {
      void_:  "#05070c",
      plate:  ["#06090e", "#0b1119", "#121b2a"],
      silver: ["#d8e4ec", "#a8c0d4", "#6e8aa4"],
      gilt:   ["#d4af5f", "#ecd28a"],
      rose:   ["#a04838"],
      sky:    ["#bfe0f4", "#8fc4e4"],
      data:   ["#d8e4ec", "#a8c0d4", "#ecd28a", "#d4af5f", "#bfe0f4", "#8fc4e4"],
      worstBg: "#121b2a", // lightest night tone
      primary: "#d8e4ec", accent: "#ecd28a",
      exceptions: {
        "#6e8aa4": "deep silver: depth-cue hairlines, hatch shading, aged-ink log lines — never the sole carrier (3.4:1, atlas mockup)",
      },
      rules: {
        "#a04838": "rose: chrome accent (mute square) only — 2.0:1 on plate",
      },
      spiral: {
        bg: "#06090e",
        ribbonStroke: [216, 240, 255], ribbonFill: [150, 220, 255],
        baseStroke:   [100, 160, 200],
        inKeyLabel:   [216, 240, 255], outKeyLabel: [85, 110, 130],
        octaveLabel:  [170, 220, 240],
        constFg: "150,220,255", constSub: "100,200,220",
        lollipopHead: "rgba(216,240,255,1)",
        data: ["#d8f0ff", "#96dcff", "#aadcf0"],
      },
    },
  };
  var TRACKS = ["library", "sycorax", "ariel"];

  // ==========================================================================
  // THE BINDING (owner 2026-07-20, undecided between the two): "night" is
  // the night-folio registry above; "parchment" restores the codex-page
  // values (PR #24's look — parchment panels, the spiral in its windowed
  // monitor, iron-gall apparatus ink). palette()/atlas()/inkAge() are all
  // mode-aware; the viz + CSS carry the rest of the switch.
  // ==========================================================================
  var MODE = "night";
  var PARCH_OVERRIDES = {
    library: {
      paper:  ["#efe3c0", "#e3d3a8", "#d0bc8c", "#b49a68", "#8a704a"],
      ink:    ["#2e2114", "#4a3620", "#6e5638", "#93794f"],
      data:   ["#2e2114", "#4a3620", "#6e5638", "#8e3b2c"],
      worstBg: "#e3d3a8",
      primary: "#2e2114", accent: "#8e3b2c",
      exceptions: {
        "#93794f": "far-limb depth-cue hairline — the same datum returns at full contrast every half revolution",
      },
      rules: {
        "#b0553c": "rubric-1: aged tags and display-size accents only; body-size rubric duty is rubric-0",
        "#c9a227": "gilt: illumination and chrome, never a sole data carrier on paper",
        "#e8c95a": "gilt: illumination and chrome, never a sole data carrier on paper",
      },
    },
    sycorax: {
      paper:  ["#241d17", "#322820", "#453729"],
      worstBg: "#453729",
    },
    ariel: {
      plate:  ["#101a30", "#16233f", "#22345a"],
      worstBg: "#22345a",
    },
  };
  var PALETTES_P = {};
  (function () {
    for (var t = 0; t < TRACKS.length; t++) {
      var tr = TRACKS[t], out = {}, k;
      for (k in PALETTES[tr]) out[k] = PALETTES[tr][k];
      var ov = PARCH_OVERRIDES[tr] || {};
      for (k in ov) out[k] = ov[k];
      PALETTES_P[tr] = out;
    }
  })();
  function setMode(m) {
    if (m !== "night" && m !== "parchment") {
      throw new Error("PJ2.Skin.setMode: unknown mode '" + m + "'");
    }
    MODE = m;
  }
  function getMode() { return MODE; }

  function palette(track) {
    var p = (MODE === "night" ? PALETTES : PALETTES_P)[track];
    if (!p) throw new Error("PJ2.Skin: unknown track '" + track + "'");
    return p;
  }
  // only the colors legal as SOLE carriers of a data mark on this paper
  function dataInk(track) { return palette(track).data.slice(); }

  // WCAG 2.1 relative luminance + contrast ratio — the numbers the mockups'
  // dev boxes printed, now a first-class helper for the viz build.
  function relLum(hex) {
    var n = parseInt(hex.slice(1), 16);
    var c = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    var f = [];
    for (var i = 0; i < 3; i++) {
      var v = c[i] / 255;
      f[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
    return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
  }
  function contrast(fg, bg) {
    var a = relLum(fg), b = relLum(bg);
    var hi = a > b ? a : b, lo = a > b ? b : a;
    return (hi + 0.05) / (lo + 0.05);
  }

  // dev assertion mode: PJ2.Skin.dev = true makes illegal ink LOUD. Off in
  // production — the registry is the contract, the assertion is the tripwire.
  var api; // forward ref so helpers can read api.dev
  function assertDataInk(track, hex, context) {
    if (!api || !api.dev) return true;
    var p = palette(track);
    if (p.data.indexOf(hex) !== -1) return true;
    if (p.spiral && p.spiral.data.indexOf(hex) !== -1) return true; // phosphor ink on the night window
    if (p.exceptions && p.exceptions[hex]) return true; // documented depth cues
    throw new Error("PJ2.Skin: '" + hex + "' is not data-legal on " + track
      + (context ? " (" + context + ")" : "")
      + (p.rules && p.rules[hex] ? " — " + p.rules[hex] : ""));
  }

  // the registry, checked: every data color vs its paper's worst-case tone.
  // Returns rows for dev boxes / the skin-test page.
  function checkContrast() {
    var rows = [];
    for (var t = 0; t < TRACKS.length; t++) {
      var track = TRACKS[t], p = PALETTES[track];
      var i, hex;
      for (i = 0; i < p.data.length; i++) {
        hex = p.data[i];
        rows.push({ track: track, hex: hex, bg: p.worstBg,
                    ratio: contrast(hex, p.worstBg), required: 4.5,
                    pass: contrast(hex, p.worstBg) >= 4.5, note: "data" });
      }
      for (hex in p.exceptions) {
        rows.push({ track: track, hex: hex, bg: p.worstBg,
                    ratio: contrast(hex, p.worstBg), required: 0,
                    pass: true, note: "exception: " + p.exceptions[hex] });
      }
    }
    return rows;
  }

  // ==========================================================================
  // NOISE — deterministic, seedless lattice noise. Seeds enter as domain
  // offsets drawn from PJ2.Rand streams, so the functions stay pure.
  // ==========================================================================
  function hash2(x, y) {
    var h = Math.sin(x * 127.1 + y * 311.7 + 74.7) * 43758.5453;
    return h - Math.floor(h);
  }
  function vnoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
    var a = hash2(xi, yi), b = hash2(xi + 1, yi);
    var c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  }
  // fBm: 4 octaves — the parchment mottle's spectrum (§1a)
  function fbm(x, y) {
    return 0.44 * vnoise(x, y) + 0.28 * vnoise(x * 2.13, y * 2.13)
         + 0.18 * vnoise(x * 4.31, y * 4.31) + 0.10 * vnoise(x * 8.77, y * 8.77);
  }

  // ==========================================================================
  // DITHER — Bayer 4×4 ordered + a 64×64 blue-noise tile (§2). Both STATIC:
  // baked into textures, never animated. Animated dither shimmers.
  // ==========================================================================
  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  // blue-noise tile: best-candidate over a torus, generated ONCE per seed
  // and cached. Rank-normalized to [0,1). Good enough for organic fields —
  // no visible pattern at U scale (proved in all three mockups).
  var bnCache = {};
  function blueNoise(seed) {
    var key = (seed >>> 0) + "";
    if (bnCache[key]) return bnCache[key];
    var N = 64, pts = [], vals = new Float32Array(N * N);
    var r = PJ2.Rand.stream(seed >>> 0).fork("bluenoise");
    for (var i = 0; i < N * N; i++) {
      var best = null, bestD = -1;
      for (var k = 0; k < 12; k++) {
        var cx = (r.next() * N) | 0, cy = (r.next() * N) | 0;
        var dmin = 1e9;
        // toroidal distance vs a sliding window of recent points — full
        // history is O(n²) for no visible gain (mockup-1's finding)
        for (var j = Math.max(0, pts.length - 90); j < pts.length; j++) {
          var dx = Math.abs(cx - pts[j][0]); if (dx > N / 2) dx = N - dx;
          var dy = Math.abs(cy - pts[j][1]); if (dy > N / 2) dy = N - dy;
          var dd = dx * dx + dy * dy;
          if (dd < dmin) dmin = dd;
        }
        if (dmin > bestD) { bestD = dmin; best = [cx, cy]; }
      }
      pts.push(best);
      vals[best[1] * N + best[0]] = i / (N * N);
    }
    var out = {
      size: N,
      values: vals,
      at: function (x, y) {
        return vals[((y % N + N) % N) * N + ((x % N + N) % N)];
      },
    };
    bnCache[key] = out;
    return out;
  }

  // a small offscreen Bayer tile: `level` of 16 cells inked, cell = u CSS px.
  // Cached per (color, level, u·dpr) — patterns from it tile from the canvas
  // origin, which keeps the crosshatch aligned with the paper's grid.
  var bayerTileCache = {};
  function bayerTile(color, level, u) {
    u = u || U;
    var key = color + "/" + level + "/" + u;
    if (bayerTileCache[key]) return bayerTileCache[key];
    var px = Math.round(4 * u);
    var cv = createCanvas(px, px);
    var c = cv.getContext("2d");
    c.fillStyle = color;
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        if (BAYER4[y][x] < level) c.fillRect(x * (px / 4), y * (px / 4), px / 4, px / 4);
      }
    }
    bayerTileCache[key] = cv;
    return cv;
  }
  function bayerPattern(ctx, color, level, u) {
    return ctx.createPattern(bayerTile(color, level, u), "repeat");
  }

  // fill helpers. coverage 0..1; mode "bayer" (directional, engraving-flavored)
  // or "blue" (organic, no pattern). Blue mode needs a seed for its tile.
  function ditherFill(ctx, x, y, w, h, color, coverage, opts) {
    opts = opts || {};
    var u = opts.u || U;
    var mode = opts.mode || "bayer";
    if (coverage <= 0) return;
    if (coverage >= 1) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); return; }
    ctx.fillStyle = color;
    var gx0 = Math.floor(x / u), gy0 = Math.floor(y / u);
    var gx1 = Math.ceil((x + w) / u), gy1 = Math.ceil((y + h) / u);
    var bn = mode === "blue" ? blueNoise(opts.seed || 1) : null;
    for (var gy = gy0; gy < gy1; gy++) {
      for (var gx = gx0; gx < gx1; gx++) {
        var t = bn ? bn.at(gx, gy) : (BAYER4[gy & 3][gx & 3] + 0.5) / 16;
        if (t < coverage) ctx.fillRect(gx * u, gy * u, u, u);
      }
    }
  }

  // THE RE-THRESHOLD FADE (§2): decay = dropping cells in blue-noise order.
  // life 1 → full mark, life 0 → gone; cells vanish where bn ≥ life, so the
  // mark erodes organically — ink absorbing into the page, never alpha.
  function fadeFill(ctx, x, y, w, h, color, life, seed, u) {
    ditherFill(ctx, x, y, w, h, color, Math.max(0, Math.min(1, life)),
               { u: u, mode: "blue", seed: seed });
  }

  var Dither = {
    BAYER4: BAYER4,
    tile: bayerTile,
    pattern: bayerPattern,
    fill: ditherFill,
    fadeFill: fadeFill,
    blueNoise: blueNoise,
  };

  // ==========================================================================
  // AUTHORED BITMAPS — the glyph vocabulary extracted from the mockups.
  // Encoding: "." empty · "X" primary ink · "R" accent (rubric / witch / gilt
  // per track). Hand-authored cells are verbatim from the proven mockups;
  // the rest are authored here in the same visual language.
  // ==========================================================================

  // --- seven planetary-metal sigils, 12×12 (mockup-1; §1a: ☉☽☿♀♂♃♄) -------
  var PLANET_SIGILS = {
    sol: [ // ☉ gold — C, the tonic
      "....XXXX....",
      "..XX....XX..",
      ".X........X.",
      ".X........X.",
      "X....XX....X",
      "X...X..X...X",
      "X...X..X...X",
      "X....XX....X",
      ".X........X.",
      ".X........X.",
      "..XX....XX..",
      "....XXXX...."],
    luna: [ // ☽ silver — D
      "....XXXX....",
      "..XXX.......",
      ".XXX........",
      ".XX.........",
      "XXX.........",
      "XX..........",
      "XX..........",
      "XXX.........",
      ".XX.........",
      ".XXX........",
      "..XXX.......",
      "....XXXX...."],
    mercury: [ // ☿ quicksilver — Eb
      ".XX......XX.",
      "..X......X..",
      "..XX....XX..",
      "....XXXX....",
      "...X....X...",
      "...X....X...",
      "...X....X...",
      "....XXXX....",
      ".....XX.....",
      "...XXXXXX...",
      ".....XX.....",
      ".....XX....."],
    venus: [ // ♀ copper — F
      "....XXXX....",
      "...X....X...",
      "..X......X..",
      "..X......X..",
      "..X......X..",
      "...X....X...",
      "....XXXX....",
      ".....XX.....",
      ".....XX.....",
      "...XXXXXX...",
      ".....XX.....",
      ".....XX....."],
    mars: [ // ♂ iron — G
      ".......XXXXX",
      "..........XX",
      ".........X.X",
      "........X..X",
      ".......X....",
      "..XXXXX.....",
      ".X....X.....",
      "X......X....",
      "X......X....",
      "X......X....",
      ".X....X.....",
      "..XXXX......"],
    jupiter: [ // ♃ tin — A
      "..XXX.......",
      ".X...X......",
      ".....X......",
      "....X....X..",
      "....X....X..",
      "...X.....X..",
      "..X......X..",
      ".X.......X..",
      ".XXXXXXXXXX.",
      ".........X..",
      ".........X..",
      ".........X.."],
    saturn: [ // ♄ lead — Bb
      "..XX........",
      "XXXXXX......",
      "..XX........",
      "..XX........",
      "..XX.XXX....",
      "..XXX...X...",
      "..XX.....X..",
      "..XX.....X..",
      ".........X..",
      ".........X..",
      "........X...",
      ".....XXX...."],
  };
  // in-key semitone degree → sigil name (C Dorian mapping, §1a) — exported so
  // the viz never re-derives the metal table
  var DEGREE_SIGIL = { 0: "sol", 2: "luna", 3: "mercury", 5: "venus", 7: "mars", 9: "jupiter", 10: "saturn" };

  // --- five pose bind-runes, 12×12 (mockup-2). Shared anatomy: each stands
  // on a center stave; coil wraps it, sting barbs and falls off it, hollow
  // opens an empty eye, veil drapes, smoke breaks it into drift. -----------
  var POSE_SIGILS = {
    coil: [
      "............",
      "..XXXXXXXX..",
      "..X......X..",
      "..X.XXXX.X..",
      "..X.X..X.X..",
      "..X.X.XX.X..",
      "..X.X....X..",
      "..X.XXXXXX..",
      "..X.........",
      "..XXXXXXXX..",
      ".....X......",
      ".....X......"],
    sting: [
      ".....X......",
      ".....X......",
      "..X..X..X...",
      "...X.X.X....",
      "....XXX.....",
      ".....X......",
      ".....X......",
      "....XX......",
      "...X.X......",
      "..X..X......",
      ".....XX.....",
      "......X....."],
    hollow: [
      ".....X......",
      ".....X......",
      "....X.X.....",
      "...X...X....",
      "..X.....X...",
      ".X.......X..",
      "..X.....X...",
      "...X...X....",
      "....X.X.....",
      ".....X......",
      ".....X......",
      "....XXX....."],
    veil: [
      ".....X......",
      ".XXXXXXXXX..",
      ".X...X...X..",
      ".X...X...X..",
      "..X..X..X...",
      "..X..X..X...",
      "...X.X.X....",
      "...X.X.X....",
      "...X.X.X....",
      "....X.X.....",
      "....X.X.....",
      "............"],
    smoke: [
      "....X.......",
      ".....X..X...",
      "....X..X....",
      "...X....X...",
      "....X..X....",
      ".....X..X...",
      "....X..X....",
      "...X....X...",
      "....X..X....",
      ".....XX.....",
      ".....XX.....",
      "....XXXX...."],
  };

  // --- the waterphone apparition, 16×16 (mockup-2, witch-light's one stamp)
  var APPARITION = [
    "...X........X...",
    "...X..X..X..X...",
    "...X..X..X..X...",
    "...X..X..X..X...",
    "...XX.X..X.XX...",
    "....XXXXXXXX....",
    "....X......X....",
    "...X........X...",
    "...X........X...",
    "....X......X....",
    ".....XXXXXX.....",
    "........X.......",
    ".......X........",
    "......X.........",
    ".......X........",
    "........X......."];

  // --- voice sigils, 12×12 -------------------------------------------------
  // Library (mockup-1 legend) — drone / harpsichord / music box
  var LIB_VOICES = {
    drone: [
      "............",
      "............",
      "..XX........",
      ".X..X...XX..",
      "X....X.X..X.",
      "......X....X",
      "............",
      "..XX........",
      ".X..X...XX..",
      "X....X.X..X.",
      "......X....X",
      "............"],
    harp: [
      ".....X......",
      ".....X......",
      ".....X......",
      "...XXXXX....",
      "...X.X.X....",
      "...XXXXX....",
      ".....X......",
      ".....X......",
      ".....X......",
      ".....X......",
      ".....X......",
      ".....X......"],
    box: [
      "..X..X..X...",
      "..X..X..X...",
      "..XXXXXXX...",
      "..X..X..X...",
      "............",
      "XXXXXXXXXXXX",
      "X..........X",
      "X.XX.XX.XX.X",
      "X..........X",
      "XXXXXXXXXXXX",
      "............",
      "............"],
  };
  // the quill (mockup-1 air panel)
  var QUILL = [
    "..........X.",
    ".........XX.",
    "........XXX.",
    ".......XXX..",
    "......XXXX..",
    ".....XXXX...",
    "....XXXX....",
    "...XXX......",
    "..XXX.......",
    ".XX.........",
    "XX..........",
    "X..........."];

  // Sycorax — authored here in the grimoire's bind-rune language (the mockup
  // legend used pose runes + tallies; these give the mixer its voice icons).
  var SYC_VOICES = {
    gurdy: [ // the wheel and its crank — continuous, reedy, low
      "...XXXXX....",
      "..X.....X...",
      ".X..XXX..X..",
      ".X.X...X.X..",
      ".X.X.X.X.X..",
      ".X.X...X.X..",
      ".X..XXX..X..",
      "..X.....X...",
      "...XXXXX....",
      ".......X....",
      "........X...",
      "........XX.."],
    chant: [ // organum: two rules, neumes riding above and below
      "............",
      "..X...X..X..",
      ".X.X.X..X...",
      "............",
      "XXXXXXXXXXXX",
      "............",
      "XXXXXXXXXXXX",
      "............",
      "...X...X....",
      "..X.X.X..X..",
      "............",
      "............"],
    rebec: [ // the bow crossing the stave — bind-rune anatomy kept
      ".....X......",
      ".....X......",
      "..X..X......",
      "...X.X......",
      "....XX......",
      ".....X......",
      ".....XX.....",
      ".....X.X....",
      ".....X..X...",
      ".....X......",
      ".....X......",
      ".....X......"],
    boneflute: [ // a bone laid flat, holes bored along it
      "............",
      "............",
      "............",
      ".XX......XX.",
      "X..XXXXXX..X",
      "X.X.X.X.X..X",
      "X..XXXXXX..X",
      ".XX......XX.",
      "............",
      "............",
      "............",
      "............"],
    waterphone: [ // the bowl, four tines, the downward gliss trailing off
      "..X..X..X...",
      "..X..X..X...",
      "..X..X..X...",
      "..XX.X.XX...",
      "...XXXXX....",
      "...X...X....",
      "..X.....X...",
      "..X.....X...",
      "...XXXXX....",
      ".....X......",
      "....X.......",
      ".....X......"],
    protodrum: [ // the lub-dub: an open hand-cut ring, heavy strike + echo
      "...XXXX.....",
      "..X....X....",
      ".X......X...",
      ".X.......X..",
      "X....XX....X",
      "X...XXXX....",
      "X....XX..X..",
      ".X........X.",
      ".X......X...",
      "..X....X....",
      "...XXXX.....",
      "............"],
  };

  // Ariel (mockup-3 legend) — seven voices of the air
  var ARIEL_VOICES = {
    breeze: [
      "............",
      "............",
      ".XXX...XXX..",
      "X...XXX...XX",
      "............",
      "..XXX...XXX.",
      ".X...XXX...X",
      "............",
      ".XXX...XXX..",
      "X...XXX...XX",
      "............",
      "............"],
    whistle: [
      "............",
      "............",
      ".XX......XX.",
      "X..X....X..X",
      "....X..X....",
      ".....XX.....",
      "....XXXX....",
      ".....XX.....",
      "......X.....",
      ".......X....",
      "............",
      "............"],
    chime: [
      ".....X......",
      "....XXX.....",
      "....X.X.....",
      "...X...X....",
      "...X...X....",
      "..X.....X...",
      "..X.....X...",
      ".X.......X..",
      ".XXXXXXXXX..",
      "....XXX.....",
      ".....X......",
      "............"],
    flutter: [
      "............",
      ".XX.....XX..",
      "X..X...X..X.",
      "X...X.X...X.",
      ".X..XXX..X..",
      "..X.XXX.X...",
      "....XXX.....",
      "..X.XXX.X...",
      ".X...X...X..",
      "X....X....X.",
      "............",
      "............"],
    bass: [
      "............",
      "............",
      "............",
      ".....XX.....",
      "....XXXX....",
      "....XXXX....",
      ".....XX.....",
      "............",
      "XXXXXXXXXXXX",
      "..X..X..X...",
      "............",
      "............"],
    aeolian: [
      "............",
      "XXXXXXXXXXXX",
      "............",
      "..X..X..X...",
      "..X..X..X...",
      "..X..X..X...",
      "..X..X..X...",
      "..X..X..X...",
      "..X..X..X...",
      "............",
      "XXXXXXXXXXXX",
      "............"],
    gust: [
      "............",
      ".XXXXXXX....",
      "........X...",
      ".....XXXX...",
      "............",
      "..XXXXXXXX..",
      ".........X..",
      "......XXX...",
      "............",
      ".XXXXXXXX...",
      "........X...",
      "............"],
  };

  // --- atlas-tradition small furniture, 12×12 / 8×8 ------------------------
  var STAR8 = [ // 4-point engraved star (star4 rasterized to the cell grid)
    "...X....",
    "...X....",
    "..XXX...",
    "XXXXXXX.",
    "..XXX...",
    "...X....",
    "...X....",
    "........"];
  var FEATHER = [ // the float cadence's feather — shaft + barbs
    "..........X.",
    ".........XX.",
    "........XX..",
    ".......XX...",
    "..X...XX....",
    "...X.XX.....",
    "....XXX.....",
    "..X.XX......",
    "...XXX......",
    "..XXX.......",
    ".XX.........",
    "XX.........."];
  var ROSE_POINT = [ // one portolan compass point, split-fill: half ink, half open
    ".....XX.....",
    ".....XX.....",
    "....XXX.....",
    "....XX.X....",
    "...XXX.X....",
    "...XX...X...",
    "..XXX...X...",
    "..XX.....X..",
    ".XXX.....X..",
    ".XXXXXXXXXX.",
    "............",
    "............"];
  var GLYPH_LIFT = [ // the lift cadence — ascending steps, a star at the top
    "..........R.",
    ".......XXX..",
    ".......X....",
    ".......X....",
    "...XXXXX....",
    "...X........",
    "...X........",
    "XXXX........",
    "............",
    "............",
    "............",
    "............"];
  var WINGBEAT = [ // paired wingbeat chevrons — the answer mark
    "............",
    "............",
    "..X....X....",
    ".X.X..X.X...",
    "X...XX...X..",
    "............",
    "....X....X..",
    "...X.X..X.X.",
    "..X...XX...X",
    "............",
    "............",
    "............"];
  var OUROBOROS = [ // gen-9 renewal closes the tree; the sea-change's tail-eater
    "....XXXX....",
    "..XX....XX..",
    ".X........X.",
    ".X........X.",
    "X..........X",
    "X..........X",
    "X..........X",
    ".X........X.",
    ".X...RR...X.",
    "..XX..R.XX..",
    "....XXXX....",
    "............"];

  // ==========================================================================
  // PROCEDURAL CELLS — grid drawings too fiddly to hand-type. All build on a
  // small grid-painter; deterministic, no RNG. The Conjunctio port is the
  // codex mockup's generator verbatim (circle pair + Bayer'd overlap + footed
  // cross); the other six operations are authored in its language: thin
  // ink circles/vessels, one rubric gesture each, a base mark.
  // ==========================================================================
  function gridPainter(n) {
    var g = [];
    for (var y = 0; y < n; y++) { g.push(new Array(n)); for (var x = 0; x < n; x++) g[y][x] = 0; }
    function set(x, y, v) {
      if (x >= 0 && x < n && y >= 0 && y < n) g[y][x] = v;
    }
    return {
      g: g, n: n, set: set,
      // ring of radius r about (cx,cy): cells within 0.55 of the radius
      circle: function (cx, cy, r, v) {
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
          var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
          if (Math.abs(d - r) < 0.55) g[y][x] = v;
        }
      },
      disc: function (cx, cy, r, v) {
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
          if (Math.hypot(x - cx, y - cy) <= r) g[y][x] = v;
        }
      },
      line: function (x0, y0, x1, y1, v) { // integer Bresenham
        x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
        var dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
        var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
        for (;;) {
          set(x0, y0, v);
          if (x0 === x1 && y0 === y1) break;
          var e2 = 2 * err;
          if (e2 >= dy) { err += dy; x0 += sx; }
          if (e2 <= dx) { err += dx; y0 += sy; }
        }
      },
      toBits: function () {
        var rows = [];
        for (var y = 0; y < n; y++) {
          var s = "";
          for (var x = 0; x < n; x++) s += g[y][x] === 2 ? "R" : (g[y][x] === 1 ? "X" : ".");
          rows.push(s);
        }
        return rows;
      },
    };
  }

  // the seven operation emblems, 16×16. Keyed by the ENGINE's label strings
  // (lowercased) — a label-table change in the engine re-skins for free (§1a).
  function buildOperationEmblems() {
    var ops = {};
    var p, i, x, y;

    // CONJUNCTIO — sun and moon conjoined (ported from mockup-1 verbatim)
    p = gridPainter(16);
    p.circle(6, 7, 4.6, 1);
    p.circle(10, 7, 4.6, 1);
    for (y = 3; y < 12; y++) for (x = 6; x < 11; x++) {
      var d1 = Math.hypot(x - 6, y - 7), d2 = Math.hypot(x - 10, y - 7);
      if (d1 < 4.2 && d2 < 4.2 && BAYER4[y & 3][x & 3] < 6) p.set(x, y, 2);
    }
    p.set(7, 13, 1); p.set(8, 13, 1);
    p.set(7, 14, 1); p.set(8, 14, 1); p.set(5, 14, 1); p.set(6, 14, 1); p.set(9, 14, 1); p.set(10, 14, 1);
    p.set(7, 15, 1); p.set(8, 15, 1);
    ops.conjunctio = p.toBits();

    // CALCINATIO — the settling: fire under the open vessel, ash beneath
    p = gridPainter(16);
    p.line(3, 4, 3, 9, 1); p.line(12, 4, 12, 9, 1);          // vessel walls
    p.circle(7.5, 9, 4.4, 1);                                 // rounded bottom
    for (y = 0; y < 8; y++) for (x = 4; x < 12; x++) p.g[y][x] = 0; // open mouth
    p.line(3, 4, 3, 9, 1); p.line(12, 4, 12, 9, 1);           // re-ink the walls
    p.line(2, 4, 4, 4, 1); p.line(11, 4, 13, 4, 1);           // the rim
    p.line(6, 15, 9, 15, 1);                                  // the hearth line
    // the flame — one rubric gesture
    p.set(7, 14, 2); p.set(8, 14, 2); p.set(6, 14, 2); p.set(9, 14, 2);
    p.set(7, 13, 2); p.set(8, 13, 2); p.set(7, 12, 2); p.set(8, 11, 2); p.set(7, 10, 2);
    // ash motes rising from the mouth
    p.set(6, 3, 1); p.set(9, 2, 1); p.set(7, 1, 1);
    ops.calcinatio = p.toBits();

    // SOLUTIO — dissolution: the vessel filled with water, a body sinking
    p = gridPainter(16);
    p.line(3, 2, 3, 12, 1); p.line(12, 2, 12, 12, 1);
    p.circle(7.5, 11, 4.4, 1);
    for (y = 0; y < 7; y++) for (x = 4; x < 12; x++) if (p.g[y][x] === 1 && y < 7 && x > 3 && x < 12) p.g[y][x] = 0;
    p.line(2, 2, 4, 2, 1); p.line(11, 2, 13, 2, 1);
    // the waves — rubric, two courses
    for (x = 4; x <= 11; x++) p.set(x, 6 + (x % 2), 2);
    for (x = 4; x <= 11; x++) p.set(x, 8 + ((x + 1) % 2), 2);
    p.set(7, 11, 1); p.set(8, 11, 1); p.set(7, 12, 1); p.set(8, 12, 1); // the sinking body
    ops.solutio = p.toBits();

    // SEPARATIO — the elements parted: a circle cut by the sword, halves fleeing
    p = gridPainter(16);
    p.circle(7.5, 7.5, 5.2, 1);
    p.line(7, 0, 7, 15, 2); p.line(8, 0, 8, 15, 2);            // the rubric blade
    p.line(2, 7, 4, 7, 1); p.line(3, 6, 3, 8, 1);              // left half's mark
    p.line(11, 7, 13, 7, 1); p.line(12, 6, 12, 8, 1);          // right half's mark
    p.line(0, 3, 2, 5, 1); p.line(15, 3, 13, 5, 1);            // diverging strokes
    ops.separatio = p.toBits();

    // FERMENTATIO — the seizure: the flask agitated, bubbles climbing
    p = gridPainter(16);
    p.line(6, 1, 6, 5, 1); p.line(9, 1, 9, 5, 1);              // the neck
    p.line(5, 1, 10, 1, 1);
    p.circle(7.5, 10, 5.0, 1);                                  // the belly
    for (y = 5; y < 8; y++) { p.set(6 - (y - 5), y, 1); p.set(9 + (y - 5), y, 1); } // shoulders
    // the ferment — a rubric zigzag boiling inside
    p.line(5, 12, 7, 10, 2); p.line(7, 10, 9, 12, 2); p.line(9, 12, 11, 10, 2);
    p.set(7, 8, 2); p.set(9, 7, 2); p.set(6, 6, 2);            // bubbles in the neck
    ops.fermentatio = p.toBits();

    // DISTILLATIO — the reverie: alembic and beak, drops falling to the receiver
    p = gridPainter(16);
    p.circle(5, 5, 3.6, 1);                                     // the cucurbit
    p.line(7, 3, 12, 6, 1);                                     // the beak
    p.line(12, 6, 12, 9, 1);
    p.line(10, 12, 14, 12, 1); p.line(10, 12, 10, 14, 1); p.line(14, 12, 14, 14, 1);
    p.line(10, 14, 14, 14, 1);                                  // the receiver
    p.set(12, 10, 2); p.set(12, 11, 2);                         // the falling drops
    p.set(5, 5, 2);                                             // the spirit within
    ops.distillatio = p.toBits();

    // COAGULATIO — the candle-out: the stone fixed, a diamond bound in a square
    p = gridPainter(16);
    p.line(3, 3, 12, 3, 1); p.line(3, 12, 12, 12, 1);
    p.line(3, 3, 3, 12, 1); p.line(12, 3, 12, 12, 1);           // the square: fixity
    p.line(7, 4, 11, 7, 1); p.line(11, 8, 8, 11, 1);
    p.line(7, 11, 4, 8, 1); p.line(4, 7, 7, 4, 1);              // the diamond within
    p.set(7, 7, 2); p.set(8, 7, 2); p.set(7, 8, 2); p.set(8, 8, 2); // the fixed heart
    ops.coagulatio = p.toBits();

    // TRANSMUTATIO — the sea change: the ouroboros, rubric head taking the tail
    p = gridPainter(16);
    p.circle(7.5, 7.5, 5.6, 1);
    p.set(7, 13, 2); p.set(8, 13, 2); p.set(8, 12, 2);          // the head
    p.set(6, 13, 0);                                            // the bite — tail enters
    p.set(10, 2, 1); p.set(11, 3, 1);                           // the crest scale
    ops.transmutatio = p.toBits();

    return ops;
  }

  // eight moon phases, 12×12 (the volvelle's wheel). At this raster the
  // mockup's offset-disc shadow loses its gibbous sliver (the curve falls
  // between cells), so the terminator is a straight column here — the 8
  // phases stay legibly distinct at stamp size, which is the volvelle's job.
  // "X" = ink outline + shadow, "R" = the lit face.
  function buildMoonPhases() {
    var out = {};
    var n = 12, cx = 5.5, cy = 5.5, r = 5;
    for (var p2 = 0; p2 < 8; p2++) {
      var g = gridPainter(n);
      var q = p2 < 4 ? p2 : 8 - p2;               // 0..4 distance from new
      var sgn = p2 < 4 ? 1 : -1;                  // waxing lights the right limb
      var T = (2 - q) * 0.55 * r;                 // terminator column offset
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n; x++) {
          var d = Math.hypot(x - cx, y - cy);
          if (d > r + 0.4) continue;
          if (d > r - 0.6) { g.set(x, y, 1); continue; }   // the rim, always inked
          var lit;
          if (p2 === 0) lit = false;                        // new — all shadow
          else if (p2 === 4) lit = true;                    // full — all face
          else lit = sgn * (x - cx) > T;
          g.set(x, y, lit ? 2 : 1);
        }
      }
      out["moon-" + p2] = g.toBits();
    }
    return out;
  }

  // the athanor at the four degrees of fire, 16×16 (mockup-1's furnace:
  // chimney, domed body, stoke arch; the fire is the rubric, more per gradus)
  var ATHANOR_BASE = [
    "......XXXX......",
    "......X..X......",
    "....XXX..XXX....",
    "...X........X...",
    "..X..........X..",
    "..X..........X..",
    ".X............X.",
    ".X............X.",
    ".X............X.",
    ".X............X.",
    ".X............X.",
    ".X............X.",
    ".X....XXXX....X.",
    ".X...X....X...X.",
    ".X...X....X...X.",
    ".XXXXX....XXXXX."];
  function buildAthanorStates() {
    // fire cells per gradus, cumulative — I lambent … IV roaring up the flue
    var FIRE = [
      [[7, 15], [8, 15]],
      [[6, 15], [9, 15], [7, 14], [8, 14]],
      [[6, 14], [9, 14], [7, 13], [8, 13]],
      [[6, 13], [9, 13], [7, 1], [8, 1]],  // gradus IV glows in the chimney
    ];
    var out = {};
    var cells = [];
    for (var deg = 1; deg <= 4; deg++) {
      cells = cells.concat(FIRE[deg - 1]);
      var rows = [];
      for (var y = 0; y < 16; y++) {
        var s = "";
        for (var x = 0; x < 16; x++) {
          var fire = false;
          for (var f = 0; f < cells.length; f++) {
            if (cells[f][0] === x && cells[f][1] === y) { fire = true; break; }
          }
          s += fire ? "R" : ATHANOR_BASE[y].charAt(x);
        }
        rows.push(s);
      }
      out["athanor-" + deg] = rows;
    }
    return out;
  }

  // the two Lydian homes as stampable cells (mockup-3's asterisms rasterized
  // at half scale onto 24/32-wide cells: "R" stars, "X" link lines). The
  // full-resolution vector data + drawAsterism live alongside for furniture.
  var ASTERISMS = {
    i:  { stars: [[0, 6, 2.6], [15, -6, 2.0], [30, 2, 3.2], [45, -8, 2.0], [26, 18, 1.7]],
          links: [[0, 1], [1, 2], [2, 3], [2, 4]] },
    ii: { stars: [[0, 14, 2.4], [14, 4, 3.0], [28, -6, 3.8], [44, -2, 2.6], [58, 8, 3.0], [32, 18, 2.0]],
          links: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
  };
  function rasterAsterism(ast, cellW, cellH) {
    // scale star coords into the cell with a 1-cell margin
    var xs = [], ys = [], i;
    for (i = 0; i < ast.stars.length; i++) { xs.push(ast.stars[i][0]); ys.push(ast.stars[i][1]); }
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var sx = (cellW - 4) / Math.max(1, maxX - minX), sy = (cellH - 4) / Math.max(1, maxY - minY);
    var s = Math.min(sx, sy);
    function px(v) { return Math.round(2 + (v - minX) * s); }
    function py(v) { return Math.round(2 + (v - minY) * s); }
    var p = gridPainter(Math.max(cellW, cellH)); // square painter, cropped below
    for (i = 0; i < ast.links.length; i++) {
      var a = ast.stars[ast.links[i][0]], b = ast.stars[ast.links[i][1]];
      p.line(px(a[0]), py(a[1]), px(b[0]), py(b[1]), 1);
    }
    for (i = 0; i < ast.stars.length; i++) {
      var st = ast.stars[i], x0 = px(st[0]), y0 = py(st[1]);
      p.set(x0, y0, 2);
      p.set(x0 - 1, y0, 2); p.set(x0 + 1, y0, 2); p.set(x0, y0 - 1, 2); p.set(x0, y0 + 1, 2);
      if (st[2] > 3) { p.set(x0 - 2, y0, 2); p.set(x0 + 2, y0, 2); } // the bright ones flare
    }
    var rows = p.toBits().slice(0, cellH);
    for (i = 0; i < rows.length; i++) rows[i] = rows[i].slice(0, cellW);
    return rows;
  }

  // ==========================================================================
  // vector furniture helpers (mockup-3) — for full-resolution L1 use where a
  // stamped cell is too coarse. Exported; the atlas cells above are the
  // stamp-scale versions of the same vocabulary.
  // ==========================================================================
  function star4(c, x, y, r, color, rays) {
    c.fillStyle = color;
    c.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4 - Math.PI / 2;
      var rr = (i % 2 === 0) ? r : r * 0.36;
      c[i === 0 ? "moveTo" : "lineTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath(); c.fill();
    if (rays) {
      c.strokeStyle = color; c.lineWidth = 1;
      for (var k = 0; k < 4; k++) {
        var ra = k * Math.PI / 2 + Math.PI / 4;
        c.beginPath();
        c.moveTo(x + Math.cos(ra) * r * 1.1, y + Math.sin(ra) * r * 1.1);
        c.lineTo(x + Math.cos(ra) * r * 2.0, y + Math.sin(ra) * r * 2.0);
        c.stroke();
      }
    }
  }
  function feather(c, x, y, len, ang, color) {
    c.save();
    c.translate(x, y); c.rotate(ang);
    c.strokeStyle = color; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.45, -len * 0.14, len, -len * 0.26);
    c.stroke();
    for (var i = 1; i <= 6; i++) {
      var t = i / 7;
      var bx = len * t * 0.96, by = -len * 0.24 * t * t - len * 0.02;
      var bl = len * 0.22 * (1 - t * 0.55);
      c.beginPath();
      c.moveTo(bx, by);
      c.quadraticCurveTo(bx - bl * 0.5, by - bl * 0.45, bx - bl * 0.8, by - bl);
      c.stroke();
    }
    c.restore();
  }
  function drawAsterism(c, ast, x, y, opts) {
    opts = opts || {};
    var s = opts.scale || 1;
    var lit = !!opts.lit;
    var pal = palette(opts.track || "ariel");
    var lineCol = opts.lineColor || (lit ? pal.silver[1] : pal.silver[2]);
    var starCol = opts.starColor || (lit ? pal.gilt[1] : pal.gilt[0]);
    var i, a, b;
    c.save();
    c.strokeStyle = lineCol; c.lineWidth = 1;
    for (i = 0; i < ast.links.length; i++) {
      a = ast.stars[ast.links[i][0]]; b = ast.stars[ast.links[i][1]];
      c.beginPath();
      c.moveTo(x + a[0] * s, y + a[1] * s);
      c.lineTo(x + b[0] * s, y + b[1] * s);
      c.stroke();
    }
    for (i = 0; i < ast.stars.length; i++) {
      a = ast.stars[i];
      star4(c, x + a[0] * s, y + a[1] * s, a[2] * s * (lit ? 1.25 : 1), starCol, lit && a[2] > 3);
    }
    c.restore();
  }

  // ==========================================================================
  // SPRITE ATLAS — atlas(track): every authored cell pre-rendered onto ONE
  // offscreen canvas (1 canvas px per art px), plus a fillRect stamping path
  // for tints and re-threshold fades. Built lazily, cached per track.
  // ==========================================================================
  var atlasCache = {};

  function cellSpecs(track) {
    var cells = [], k;
    function add(name, bits) { cells.push({ name: name, bits: bits, w: bits[0].length, h: bits.length }); }
    if (track === "library") {
      for (k in PLANET_SIGILS) add("sigil-" + k, PLANET_SIGILS[k]);
      var ops = buildOperationEmblems();
      for (k in ops) add("op-" + k, ops[k]);
      for (k in LIB_VOICES) add("voice-" + k, LIB_VOICES[k]);
      add("quill", QUILL);
      var moons = buildMoonPhases();
      for (k in moons) add(k, moons[k]);
      var ath = buildAthanorStates();
      for (k in ath) add(k, ath[k]);
      add("ouroboros", OUROBOROS);
    } else if (track === "sycorax") {
      for (k in POSE_SIGILS) add("pose-" + k, POSE_SIGILS[k]);
      add("apparition", APPARITION);
      for (k in SYC_VOICES) add("voice-" + k, SYC_VOICES[k]);
    } else if (track === "ariel") {
      for (k in ARIEL_VOICES) add("voice-" + k, ARIEL_VOICES[k]);
      add("asterism-i", rasterAsterism(ASTERISMS.i, 24, 16));
      add("asterism-ii", rasterAsterism(ASTERISMS.ii, 32, 16));
      add("rose-point", ROSE_POINT);
      add("star", STAR8);
      add("feather", FEATHER);
      add("glyph-lift", GLYPH_LIFT);
      add("wingbeat", WINGBEAT);
    } else {
      throw new Error("PJ2.Skin.atlas: unknown track '" + track + "'");
    }
    return cells;
  }

  function buildAtlas(track) {
    var pal = palette(track);
    var cells = cellSpecs(track);
    // sanity: authored bitmaps must be rectangular and pure [.XR] — a single
    // stray character once shipped in a mockup sigil (the mars 象 incident)
    var i, r;
    for (i = 0; i < cells.length; i++) {
      var cell = cells[i];
      for (r = 0; r < cell.bits.length; r++) {
        if (cell.bits[r].length !== cell.w) throw new Error("PJ2.Skin.atlas: ragged bitmap " + cell.name + " row " + r);
        if (/[^.XR]/.test(cell.bits[r])) throw new Error("PJ2.Skin.atlas: illegal char in " + cell.name + " row " + r);
      }
    }
    // pack: simple shelf layout, 1 px gutter, canvas grows in rows
    var MAXW = 128, x = 0, y = 0, rowH = 0, W = 0;
    for (i = 0; i < cells.length; i++) {
      var cl = cells[i];
      if (x + cl.w > MAXW) { x = 0; y += rowH + 1; rowH = 0; }
      cl.x = x; cl.y = y;
      x += cl.w + 1;
      if (cl.h > rowH) rowH = cl.h;
      if (x > W) W = x;
    }
    var H = y + rowH;
    // pre-render at art resolution in the track's default inks
    var cv = createCanvas(W, H);
    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    var byName = {};
    for (i = 0; i < cells.length; i++) {
      var s = cells[i];
      byName[s.name] = s;
      for (var yy = 0; yy < s.h; yy++) {
        for (var xx = 0; xx < s.w; xx++) {
          var ch = s.bits[yy].charAt(xx);
          if (ch === ".") continue;
          c.fillStyle = ch === "R" ? pal.accent : pal.primary;
          c.fillRect(s.x + xx, s.y + yy, 1, 1);
        }
      }
    }

    var atlasObj = {
      track: track,
      canvas: cv,
      cells: byName,
      list: function () {
        var names = [];
        for (var n2 in byName) names.push(n2);
        return names;
      },
      has: function (name) { return !!byName[name]; },

      // stamp(ctx, name, x, y, opts) — the tintable, fadeable path.
      // GRID-SNAPPED: the cell's top-left lands on a multiple of u, and each
      // bitmap pixel is exactly (scale) art cells. Centered on (x, y).
      //   opts: u (CSS px per art cell — pass G.u), scale (integer, art cells
      //   per bitmap px), tint / tint2 (replace primary / accent), fade
      //   (0..1 re-threshold decay, blue-noise order), seed (for fade),
      //   align "center"|"corner", data (true → dev-assert tint legality)
      stamp: function (ctx, name, sx, sy, opts) {
        opts = opts || {};
        var spec = byName[name];
        if (!spec) throw new Error("PJ2.Skin.atlas(" + track + "): no cell '" + name + "'");
        var u = (opts.u || U) * (opts.scale ? Math.max(1, Math.round(opts.scale)) : 1);
        var tint = opts.tint || pal.primary;
        var tint2 = opts.tint2 || opts.tint || pal.accent;
        if (opts.data) { assertDataInk(track, tint, "stamp " + name); }
        var wpx = spec.w * u, hpx = spec.h * u;
        var baseU = opts.u || U;
        var ox, oy;
        if (opts.align === "corner") {
          ox = Math.round(sx / baseU) * baseU;
          oy = Math.round(sy / baseU) * baseU;
        } else {
          ox = Math.round((sx - wpx / 2) / baseU) * baseU;
          oy = Math.round((sy - hpx / 2) / baseU) * baseU;
        }
        var fade = opts.fade === undefined ? 1 : opts.fade;
        var bn = fade < 1 ? blueNoise(opts.seed || 1) : null;
        for (var yy2 = 0; yy2 < spec.h; yy2++) {
          for (var xx2 = 0; xx2 < spec.w; xx2++) {
            var ch2 = spec.bits[yy2].charAt(xx2);
            if (ch2 === ".") continue;
            if (bn && bn.at(xx2 + spec.x, yy2 + spec.y) >= fade) continue; // ink absorbed
            ctx.fillStyle = ch2 === "R" ? tint2 : tint;
            ctx.fillRect(ox + xx2 * u, oy + yy2 * u, u, u);
          }
        }
        return { x: ox, y: oy, w: wpx, h: hpx };
      },

      // stampImage — the fast path for untinted furniture: one drawImage from
      // the pre-rendered atlas, scaled to the grid, smoothing must be off.
      stampImage: function (ctx, name, sx, sy, opts) {
        opts = opts || {};
        var spec = byName[name];
        if (!spec) throw new Error("PJ2.Skin.atlas(" + track + "): no cell '" + name + "'");
        var u = (opts.u || U) * (opts.scale ? Math.max(1, Math.round(opts.scale)) : 1);
        var baseU = opts.u || U;
        var wpx = spec.w * u, hpx = spec.h * u;
        var ox = Math.round((sx - wpx / 2) / baseU) * baseU;
        var oy = Math.round((sy - hpx / 2) / baseU) * baseU;
        ctx.drawImage(cv, spec.x, spec.y, spec.w, spec.h, ox, oy, wpx, hpx);
        return { x: ox, y: oy, w: wpx, h: hpx };
      },
    };
    return atlasObj;
  }

  function atlas(track) {
    var key = track + "/" + MODE;
    if (!atlasCache[key]) atlasCache[key] = buildAtlas(track);
    return atlasCache[key];
  }

  // ==========================================================================
  // PAPER GENERATORS — L0, baked once per (track, size, seed). §1a/§1b/§1c
  // layer stacks with the §6 plate zone and the codex mockup's quietRects
  // extension. ALL randomness from PJ2.Rand — papers are reproducible.
  //
  //   paper(ctx, w, h, track, seed, opts)
  //     ctx    — a 2d context already transformed to its DPR (use Grid.fit)
  //     w, h   — CSS px
  //     opts.u          — CSS px per art cell (pass G.u; default 2)
  //     opts.plateZone  — {cx, cy, rx, ry} ellipse (CSS px) kept quiet
  //     opts.quietRects — [{x, y, w, h}] text columns kept quiet
  //     opts.deckle     — worn border (default true; ignored by ariel)
  //     opts.stars      — ariel only: sparse engraved star-field (default true)
  // ==========================================================================
  // signed distance to a rounded rect {cx, cy, rx, ry, r} (half-extents +
  // corner radius, CSS px). Negative = inside. Shared by the zone test and
  // the viz's night-window fill/feather.
  function rrectDist(px, py, pz) {
    var r = pz.r || 0;
    var qx = Math.abs(px - pz.cx) - (pz.rx - r);
    var qy = Math.abs(py - pz.cy) - (pz.ry - r);
    var ax = qx > 0 ? qx : 0, ay = qy > 0 ? qy : 0;
    return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(qx, qy), 0) - r;
  }

  function zoneTester(opts) {
    var pz = opts.plateZone || null;
    var qr = opts.quietRects || [];
    return function (px, py) {
      if (pz) {
        if (pz.shape === "rrect") {
          if (rrectDist(px, py, pz) < 0) return true;
        } else {
          var zx = (px - pz.cx) / pz.rx, zy = (py - pz.cy) / pz.ry;
          if (zx * zx + zy * zy < 1) return true;
        }
      }
      for (var i = 0; i < qr.length; i++) {
        var q = qr[i];
        if (px >= q.x && px < q.x + q.w && py >= q.y && py < q.y + q.h) return true;
      }
      return false;
    };
  }

  // --- LIBRARY: procedural parchment (§1a) ---------------------------------
  function paperParchment(ctx, w, h, seed, opts) {
    var pal = palette("library");
    var u = opts.u || U;
    var rs = PJ2.Rand.stream(seed >>> 0).fork("paper:library");
    var bn = blueNoise(seed);
    var ox = rs.rnd(0, 512), oy = rs.rnd(0, 512);   // mottle domain offset
    var fx = rs.rnd(0, 512);                          // fiber domain offset
    // stains: 2–5 large soft blotches, seeded
    var nStains = rs.rint(2, 5), stains = [], s;
    for (s = 0; s < nStains; s++) {
      stains.push([rs.rnd(0.04, 0.96), rs.rnd(0.05, 0.97), rs.rnd(0.05, 0.09), rs.rnd(0.6, 1.0)]);
    }
    var quiet = zoneTester(opts);
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    var mx = cols / 2, my = rows / 2;
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var px = gx * u, py = gy * u;
        // base mottle: fBm mapped across the ramp, mostly light
        var n = fbm(gx / 26 + ox, gy / 26 + oy);
        var v = (n - 0.5) * 1.15 + 0.30;
        // blue-noise stains — large soft blotches
        for (s = 0; s < stains.length; s++) {
          var stx = stains[s][0] * w, sty = stains[s][1] * h;
          var sd = Math.sqrt((px - stx) * (px - stx) + (py - sty) * (py - sty)) / (stains[s][2] * w);
          if (sd < 1) v += (1 - sd) * (1 - sd) * 1.5 * stains[s][3] * (0.6 + 0.8 * bn.at(gx, gy));
        }
        // horizontal fiber streaks: thin 1U runs, ±4% luminance
        var fy = vnoise(gx / 34 + fx, gy * 1.7);
        if (fy > 0.78) v += 0.34; else if (fy < 0.16) v -= 0.20;
        // radial edge darkening
        var dx = (gx - mx) / mx, dy = (gy - my) / my;
        var d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d > 0.72) v += (d - 0.72) * 3.4;
        // Bayer-dithered tone choice
        var bt = (BAYER4[gy & 3][gx & 3] + 0.5) / 16 - 0.5;
        var tone = Math.floor(v + bt * 0.55 + 0.5);
        if (tone < 0) tone = 0; if (tone > 4) tone = 4;
        // §6 plate zone + text columns: clamp to the two lightest tones
        if (tone > 1 && quiet(px, py)) tone = 1;
        ctx.fillStyle = pal.paper[tone];
        ctx.fillRect(px, py, u, u);
      }
    }
    // deckled / worn border: 1–3 cell irregular dark edge onto the void
    if (opts.deckle !== false) {
      var dr = rs.fork("deckle");
      ctx.fillStyle = pal.void_;
      var e;
      for (e = 0; e < cols; e++) {
        var dt = 1 + ((dr.next() * 2.4) | 0), db = 1 + ((dr.next() * 2.4) | 0);
        ctx.fillRect(e * u, 0, u, dt * u);
        ctx.fillRect(e * u, h - db * u, u, db * u);
        if (dr.chance(0.14)) {
          ctx.fillStyle = pal.paper[4];
          ctx.fillRect(e * u, dt * u, u, u);
          ctx.fillRect(e * u, h - (db + 1) * u, u, u);
          ctx.fillStyle = pal.void_;
        }
      }
      for (e = 0; e < rows; e++) {
        var dl = 1 + ((dr.next() * 2.4) | 0), drr = 1 + ((dr.next() * 2.4) | 0);
        ctx.fillRect(0, e * u, dl * u, u);
        ctx.fillRect(w - drr * u, e * u, drr * u, u);
      }
    }
  }

  // --- SYCORAX: the soot rag (§1b) — darker, heavier grain, scorched edges.
  // The quiet zones COMPRESS the grain toward its middle tone rather than
  // clamping (the grimoire lesson: soot must stay soot, just calmer).
  function paperSootRag(ctx, w, h, seed, opts) {
    var pal = palette("sycorax");
    var u = opts.u || U;
    var rs = PJ2.Rand.stream(seed >>> 0).fork("paper:sycorax");
    var bn = blueNoise(seed);
    var ox = rs.rnd(0, 512), oy = rs.rnd(0, 512);
    var quiet = zoneTester(opts);
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    // fiber streaks precomputed as row runs (mockup-2's method), seeded
    var fibers = {}, f;
    var fr = rs.fork("fibers");
    for (f = 0; f < Math.round(cols * rows / 700); f++) {
      var fy2 = fr.rint(0, rows - 1), fx2 = fr.rint(0, cols - 1);
      var flen = fr.rint(4, 30);
      var fs = (fr.chance(0.5) ? -1 : 1) * fr.rnd(0.03, 0.065);
      for (var k = 0; k < flen && fx2 + k < cols; k++) fibers[fy2 * cols + fx2 + k] = fs;
    }
    // two seeded stains (one dark, one pale)
    var st1 = [rs.rnd(0.1, 0.4), rs.rnd(0.5, 0.9)], st2 = [rs.rnd(0.6, 0.9), rs.rnd(0.1, 0.4)];
    // ember chance mask offset
    var eo = rs.rnd(0, 512);
    var p0 = pal.paper[0], p1 = pal.paper[1], p2 = pal.paper[2];
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var px = gx * u, py = gy * u;
        // heavy grain: 2 octaves of value noise + fine per-cell hash
        var n = 0.48 * vnoise(gx / 26 + ox, gy / 26 + oy)
              + 0.27 * vnoise(gx / 9 + ox, gy / 9 + oy)
              + 0.25 * hash2(gx + ox, gy + oy);
        n += 0.10 * Math.exp(-(Math.pow(gx - cols * st1[0], 2) / (cols * cols * 0.012)
                             + Math.pow(gy - rows * st1[1], 2) / (rows * rows * 0.02)));
        n -= 0.09 * Math.exp(-(Math.pow(gx - cols * st2[0], 2) / (cols * cols * 0.010)
                             + Math.pow(gy - rows * st2[1], 2) / (rows * rows * 0.016)));
        var fib = fibers[gy * cols + gx];
        if (fib) n += fib;
        // quiet zones: compress amplitude toward the middle (×0.4)
        if (quiet(px, py)) n = 0.5 + (n - 0.5) * 0.4;
        // radial edge darkening
        var ex = Math.min(gx, cols - 1 - gx), ey = Math.min(gy, rows - 1 - gy);
        var edge = Math.min(ex, ey);
        if (edge < 26) n -= (26 - edge) / 26 * 0.16;
        // scorched deckle: torn void → char band (with embers) → paper
        if (opts.deckle !== false) {
          var deckle = 1.5 + vnoise(gx / 7 + 40 + ox, gy / 7 + 40 + oy) * 4;
          var charB = deckle + 2 + vnoise(gx / 5 + 90 + ox, gy / 5 + 90 + oy) * 7;
          var cornD = Math.min(Math.hypot(gx, gy), Math.hypot(cols - gx, gy),
                               Math.hypot(gx, rows - gy), Math.hypot(cols - gx, rows - gy));
          if (cornD < 46) charB += (46 - cornD) * 0.35;
          if (edge < deckle) { ctx.fillStyle = pal.void_; ctx.fillRect(px, py, u, u); continue; }
          if (edge < charB) {
            var ct = (edge - deckle) / Math.max(0.001, charB - deckle);
            var isEmber = ct < 0.35 && hash2(gx + 7 + eo, gy + 13 + eo) > 0.94;
            ctx.fillStyle = isEmber ? pal.blood[0] : pal.ink[0];
            ctx.fillRect(px, py, u, u);
            continue;
          }
        }
        // quantize to the 3 paper tones with static blue-noise dither
        var q = n + (bn.at(gx, gy) - 0.5) * 0.14;
        var tone2 = q < 0.52 ? 0 : (q < 0.74 ? 1 : 2);
        ctx.fillStyle = tone2 === 0 ? p0 : (tone2 === 1 ? p1 : p2);
        ctx.fillRect(px, py, u, u);
      }
    }
  }

  // --- ARIEL: the engraved plate (§1c) — burnish and scratches, not stains.
  // Quiet zones reduce the dither jitter and bar scratches/glints/stars.
  function paperEngravedPlate(ctx, w, h, seed, opts) {
    var pal = palette("ariel");
    var u = opts.u || U;
    var rs = PJ2.Rand.stream(seed >>> 0).fork("paper:ariel");
    var bn = blueNoise(seed);
    var ox = rs.rnd(0, 512), oy = rs.rnd(0, 512);
    var bAng = rs.rnd(-0.6, -0.44);                  // the polisher's diagonal
    var bc = Math.cos(bAng), bs = Math.sin(bAng);
    var b1 = rs.rnd(-90, -30), b2 = rs.rnd(120, 220); // sweep centers
    var quiet = zoneTester(opts);
    var cols = Math.ceil(w / u), rows = Math.ceil(h / u);
    var mx = cols / 2, my = rows / 2;
    for (var gy = 0; gy < rows; gy++) {
      for (var gx = 0; gx < cols; gx++) {
        var px = gx * u, py = gy * u;
        var inQ = quiet(px, py);
        // fine, low-contrast metal grain — burnish, not stains
        var n = 0.26 * vnoise(gx / 26 + ox, gy / 26 + oy)
              + 0.38 * vnoise(gx / 8.5 + ox, gy / 8.5 + oy)
              + 0.36 * vnoise(gx / 2.7 + ox, gy / 2.7 + oy);
        var dx = (gx - mx) / mx, dy = (gy - my) / my;
        n -= (dx * dx + dy * dy) * 0.20;
        var uu = (gx - mx) * bc + (gy - my) * bs;
        n += 0.13 * Math.exp(-Math.pow((uu - b1) / 110, 2));
        n += 0.09 * Math.exp(-Math.pow((uu - b2) / 70, 2));
        // blue-noise jitter — halved in quiet zones so hairlines never fight
        n += (bn.at(gx, gy) - 0.5) * (inQ ? 0.06 : 0.12);
        var tone = n < 0.27 ? 0 : (n < 0.72 ? 1 : 2);
        if (inQ && tone > 1) tone = 1; // and the lightest tone stays out of the zone
        ctx.fillStyle = pal.plate[tone];
        ctx.fillRect(px, py, u, u);
      }
    }
    // seeded scratch strokes — broken 1-cell runs near the burnish axis
    var sr = rs.fork("scratches");
    var s2;
    for (s2 = 0; s2 < 88; s2++) {
      var sx = sr.next() * w, sy = sr.next() * h;
      var ang = bAng + (sr.next() - 0.5) * 0.7;
      var len = 26 + sr.next() * 84;
      var ca = Math.cos(ang), sa = Math.sin(ang);
      for (var k2 = 0; k2 < len; k2++) {
        var px2 = sx + k2 * ca * u, py2 = sy + k2 * sa * u;
        if (px2 < 8 || py2 < 8 || px2 > w - 8 || py2 > h - 8) break;
        if (hash2(s2 * 3 + ox, k2) < 0.30) continue;          // etched, broken
        if (quiet(px2, py2)) continue;                        // never in the zone
        ctx.fillStyle = pal.plate[2];
        ctx.fillRect(Math.floor(px2 / u) * u, Math.floor(py2 / u) * u, u, u);
      }
    }
    // a few short deep-silver glints (texture, not data — silver-2 is legal
    // here precisely because it is NOT carrying data)
    var gr = rs.fork("glints");
    for (s2 = 0; s2 < 9; s2++) {
      var gx2 = gr.next() * w, gy2 = gr.next() * h;
      var ga = bAng + (gr.next() - 0.5) * 0.4;
      var gl = 6 + gr.next() * 12;
      var gc = Math.cos(ga), gs2 = Math.sin(ga);
      for (var q2 = 0; q2 < gl; q2++) {
        var qx = gx2 + q2 * gc * u, qy = gy2 + q2 * gs2 * u;
        if (qx < 10 || qy < 10 || qx > w - 10 || qy > h - 10) break;
        if (quiet(qx, qy)) break;
        ctx.fillStyle = pal.silver[2];
        ctx.fillRect(Math.floor(qx / u) * u, Math.floor(qy / u) * u, u, u);
      }
    }
    // the printed star-field — sparse engraved points, barred from the zone
    if (opts.stars !== false) {
      var str = rs.fork("stars");
      for (s2 = 0; s2 < 150; s2++) {
        var stx = 12 + str.next() * (w - 24);
        var sty = 12 + str.next() * (h - 24);
        var m2 = str.next();
        if (quiet(stx, sty) && str.next() > 0.22) continue;
        var cx3 = Math.round(stx / u) * u, cy3 = Math.round(sty / u) * u;
        if (m2 > 0.94) { // the bright ones: a gilt 4-point cross, 5 cells
          ctx.fillStyle = pal.gilt[0];
          ctx.fillRect(cx3, cy3, u, u);
          ctx.fillRect(cx3 - u, cy3, u, u); ctx.fillRect(cx3 + u, cy3, u, u);
          ctx.fillRect(cx3, cy3 - u, u, u); ctx.fillRect(cx3, cy3 + u, u, u);
        } else if (m2 > 0.78) {
          ctx.fillStyle = pal.silver[2];
          ctx.fillRect(cx3, cy3, u, u);
          ctx.fillRect(cx3 + u, cy3, u, u);
        } else {
          ctx.fillStyle = pal.silver[2];
          ctx.fillRect(cx3, cy3, u, u);
        }
      }
    }
  }

  function paper(ctx, w, h, track, seed, opts) {
    opts = opts || {};
    if (track === "library") return paperParchment(ctx, w, h, seed, opts);
    if (track === "sycorax") return paperSootRag(ctx, w, h, seed, opts);
    if (track === "ariel") return paperEngravedPlate(ctx, w, h, seed, opts);
    throw new Error("PJ2.Skin.paper: unknown track '" + track + "'");
  }

  // ==========================================================================
  // COMPOSITOR SCAFFOLD — stack(visibleCanvas, track, opts): the §6 layer
  // architecture as plumbing. The stack owns caching, dirty flags, the alive
  // list, and the degradation ladder; pj2-viz.js owns what gets drawn.
  //
  //   L0 paper        cached; regenerated on resize-debounce / track / seed
  //   L1 furniture    offscreen; redrawn when dirty("furniture")
  //   L2 data         drawn every frame directly on the visible canvas,
  //                   smoothing ON (renderers.data)
  //   L3 illustrations offscreen; composited only while any emblem is alive
  //   L4 grain        cached; first rung of the degradation ladder
  //
  //   opts: { seed, w, h, dpr, zones: {plateZone, quietRects},
  //           renderers: { paper?(G, track, seed, zones)   — override L0
  //                        furniture?(G, track)            — L1
  //                        data?(G, track, tNow)           — L2
  //                        grain?(G, track, seed) }        — L4
  //           setTimeout?, clearTimeout?, onCollapse? }
  // ==========================================================================
  function stack(visibleCanvas, track, opts) {
    opts = opts || {};
    var renderers = opts.renderers || {};
    var seed = opts.seed === undefined ? 1 : opts.seed;
    var zones = opts.zones || {};
    var degradeLevel = 0;
    var hidden = false;
    var setT = opts.setTimeout || (typeof setTimeout !== "undefined" ? setTimeout : null);
    var clearT = opts.clearTimeout || (typeof clearTimeout !== "undefined" ? clearTimeout : null);
    var resizeTimer = null;

    var visG = null;                 // the visible canvas G (kind data)
    var layers = { paper: null, furniture: null, illus: null, grain: null };
    var dirty = { paper: true, furniture: true, grain: true };
    var illusList = [];              // { draw(G, age01, item), ttl, born }
    var lastCompositeMs = 0;

    function effDpr() {
      // rung 2 of the ladder: render at DPR 1 and upscale. Texture stays
      // crisp because it is authored in art-pixels and composited with
      // smoothing off.
      if (degradeLevel >= 2) return 1;
      return opts.dpr !== undefined ? opts.dpr
        : ((typeof window !== "undefined" && window.devicePixelRatio) || 1);
    }

    function size(w, h) {
      if (w !== undefined) opts.w = w;
      if (h !== undefined) opts.h = h;
      visG = fit(visibleCanvas, { w: opts.w, h: opts.h, dpr: effDpr(), kind: "data" });
      var lw = Math.round(visG.w * visG.dpr), lh = Math.round(visG.h * visG.dpr);
      var names = ["paper", "furniture", "illus", "grain"];
      for (var i = 0; i < names.length; i++) {
        var cv = layers[names[i]] ? layers[names[i]].canvas : createCanvas(lw, lh);
        layers[names[i]] = fit(cv, { w: visG.w, h: visG.h, dpr: visG.dpr, kind: "art" });
      }
      dirty.paper = true; dirty.furniture = true; dirty.grain = true;
    }

    function bakePaper() {
      var G = layers.paper;
      G.ctx.clearRect(0, 0, G.w, G.h);
      if (renderers.paper) renderers.paper(G, track, seed, zones);
      else paper(G.ctx, G.w, G.h, track, seed,
                 { u: G.u, plateZone: zones.plateZone, quietRects: zones.quietRects });
      dirty.paper = false;
    }
    function bakeFurniture() {
      var G = layers.furniture;
      G.ctx.clearRect(0, 0, G.w, G.h);
      if (renderers.furniture) renderers.furniture(G, track);
      dirty.furniture = false;
    }
    function bakeGrain() {
      var G = layers.grain;
      G.ctx.clearRect(0, 0, G.w, G.h);
      if (renderers.grain) renderers.grain(G, track, seed);
      dirty.grain = false;
    }

    var st = {
      track: track,
      seed: seed,
      layers: layers,
      illustrations: illusList,

      // --- lifecycle -----------------------------------------------------
      resize: function (w, h) { size(w, h); },
      scheduleResize: function (w, h) { // the §6 resize debounce
        if (!setT) { size(w, h); return; }
        if (resizeTimer !== null && clearT) clearT(resizeTimer);
        resizeTimer = setT(function () { resizeTimer = null; size(w, h); }, 160);
      },
      setTrack: function (t) {
        palette(t); // validates
        track = t; st.track = t;
        dirty.paper = true; dirty.furniture = true; dirty.grain = true;
      },
      setSeed: function (s) {
        seed = s; st.seed = s;
        dirty.paper = true; dirty.grain = true;
      },
      invalidate: function (layer) {
        if (dirty[layer] === undefined) throw new Error("PJ2.Skin.stack: no layer '" + layer + "'");
        dirty[layer] = true;
      },

      // --- L3 alive-list ---------------------------------------------------
      addIllustration: function (item, now) {
        item.born = now === undefined ? 0 : now;
        illusList.push(item);
        return item;
      },
      aliveCount: function (now) {
        var n = 0;
        for (var i = 0; i < illusList.length; i++) {
          if (now === undefined || (now - illusList[i].born) < illusList[i].ttl) n++;
        }
        return n;
      },

      // --- degradation ladder (§6) ----------------------------------------
      setDegrade: function (level) {
        level = Math.max(0, Math.min(3, level | 0));
        if (level === degradeLevel) return;
        var wasDpr = effDpr();
        degradeLevel = level;
        if (effDpr() !== wasDpr) size();     // rung 2 changes render DPR
        if (level >= 3 && opts.onCollapse) opts.onCollapse(); // rung 3: margin collapse is layout, the viz owns it
      },
      degradeLevel: function () { return degradeLevel; },

      // rung 4: auto-rotate pauses in hidden tabs — expose the flag, guard
      // the listener for the harness.
      bindVisibility: function () {
        if (typeof document === "undefined" || !document.addEventListener) return;
        document.addEventListener("visibilitychange", function () {
          hidden = document.visibilityState === "hidden";
        });
      },
      isHidden: function () { return hidden; },

      // --- the composite loop (§6: 5 drawImage calls + L2 direct) ----------
      composite: function (tNow) {
        if (!visG) size();
        var start = (typeof performance !== "undefined" && performance.now) ? performance.now() : 0;
        if (dirty.paper) bakePaper();
        if (dirty.furniture) bakeFurniture();
        if (dirty.grain && degradeLevel < 1) bakeGrain();
        var ctx = visG.ctx;
        ctx.clearRect(0, 0, visG.w, visG.h);
        var wasSmooth = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;   // layer composites are pixel-exact
        ctx.drawImage(layers.paper.canvas, 0, 0, visG.w, visG.h);
        if (renderers.furniture) ctx.drawImage(layers.furniture.canvas, 0, 0, visG.w, visG.h);
        ctx.imageSmoothingEnabled = wasSmooth; // data draws smoothed (§6)
        if (renderers.data) renderers.data(visG, track, tNow);
        // L3: composited only while an emblem is alive
        var i, alive = false;
        for (i = illusList.length - 1; i >= 0; i--) {
          var age = tNow === undefined ? 0 : (tNow - illusList[i].born) / illusList[i].ttl;
          if (age >= 1) { illusList.splice(i, 1); continue; }
          alive = true;
        }
        if (alive) {
          var G3 = layers.illus;
          G3.ctx.clearRect(0, 0, G3.w, G3.h);
          for (i = 0; i < illusList.length; i++) {
            var it = illusList[i];
            var a2 = tNow === undefined ? 0 : (tNow - it.born) / it.ttl;
            it.draw(G3, Math.max(0, Math.min(1, a2)), it);
          }
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(G3.canvas, 0, 0, visG.w, visG.h);
          ctx.imageSmoothingEnabled = wasSmooth;
        }
        // L4: skippable — the first rung of the ladder
        if (degradeLevel < 1 && renderers.grain) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(layers.grain.canvas, 0, 0, visG.w, visG.h);
          ctx.imageSmoothingEnabled = wasSmooth;
        }
        if (start) lastCompositeMs = performance.now() - start;
        return lastCompositeMs;
      },
      lastCompositeMs: function () { return lastCompositeMs; },
      G: function () { if (!visG) size(); return visG; },
    };
    return st;
  }

  // ==========================================================================
  // TYPE — font stacks, per-track header treatments (§2), ink-aging steps.
  // VT323 is the universal data/chrome face; Jacquard 12 is the blackletter
  // display face; numerals are ALWAYS VT323 (blackletter numerals fail the
  // precision rule).
  // ==========================================================================
  var FONT_MONO = '"VT323", monospace';
  var FONT_BLACKLETTER = '"Jacquard 12", "VT323", monospace';

  // the three steps of ink aging per track (log entries pale as they age)
  var INK_AGE = {
    library: ["#ffdc82", "#ffc878", "#b4823c"],   // amber on night (C-flip)
    sycorax: ["#d8cfc0", "#b3a68e", "#7d715c"],
    ariel:   ["#d8e4ec", "#a8c0d4", "#6e8aa4"],
  };
  var INK_AGE_P = {
    library: ["#2e2114", "#4a3620", "#6e5638"],   // iron-gall on parchment
    sycorax: INK_AGE.sycorax,
    ariel:   INK_AGE.ariel,
  };
  function inkAge(track, step) {
    var ramp = (MODE === "night" ? INK_AGE : INK_AGE_P)[track];
    if (!ramp) throw new Error("PJ2.Skin.Type.inkAge: unknown track '" + track + "'");
    return ramp[Math.max(0, Math.min(2, step | 0))];
  }

  // header treatment specs — enough for CSS callers to style without canvas
  function headerSpec(track) {
    if (track === "library") return {
      font: FONT_BLACKLETTER, transform: "none", letterSpacing: 0,
      treatment: "rubricated-initial", // first letter in rubric-0, +~15% size
      color: palette("library").ink[0], initialColor: palette("library").rubric[0],
    };
    if (track === "sycorax") return {
      font: FONT_BLACKLETTER, transform: "none", letterSpacing: 0,
      treatment: "woodcut-offset",     // bone over a 1U ink offset (rough caps)
      color: palette("sycorax").bone[0], offsetColor: palette("sycorax").ink[0],
    };
    if (track === "ariel") return {
      font: FONT_MONO, transform: "uppercase", letterSpacing: 3,
      treatment: "star-interpuncts",   // words joined by gilt ✦
      color: palette("ariel").silver[0], interpunctColor: palette("ariel").gilt[0],
    };
    throw new Error("PJ2.Skin.Type.header: unknown track '" + track + "'");
  }

  // canvas small-caps caption (mockup-3's smallCaps, the family's caption voice)
  function smallCaps(c, txt, x, y, px, color, spacing, align) {
    c.save();
    c.fillStyle = color;
    c.font = px + "px " + FONT_MONO;
    if (c.letterSpacing !== undefined) c.letterSpacing = (spacing === undefined ? 1 : spacing) + "px";
    c.textAlign = align || "left";
    c.textBaseline = "alphabetic";
    c.fillText(String(txt).toUpperCase(), x, y);
    c.restore();
  }

  // canvas header with the per-track treatment applied
  function drawHeader(c, track, text, x, y, px, opts) {
    opts = opts || {};
    var spec = headerSpec(track);
    var u = opts.u || U;
    c.save();
    c.textBaseline = "alphabetic";
    c.textAlign = "left";
    if (track === "library") {
      c.font = px + "px " + FONT_BLACKLETTER;
      var head = text.charAt(0), tail = text.slice(1);
      c.fillStyle = opts.initialColor || spec.initialColor;
      var big = Math.round(px * 1.15);
      c.font = big + "px " + FONT_BLACKLETTER;
      c.fillText(head, x, y);
      var iw = c.measureText(head).width;
      c.font = px + "px " + FONT_BLACKLETTER;
      c.fillStyle = opts.color || spec.color;
      c.fillText(tail, x + iw, y);
    } else if (track === "sycorax") {
      c.font = px + "px " + FONT_BLACKLETTER;
      c.fillStyle = opts.offsetColor || spec.offsetColor;
      c.fillText(text, x + u, y + u);           // the block's 1U rough offset
      c.fillStyle = opts.color || spec.color;
      c.fillText(text, x, y);
    } else { // ariel — letter-spaced small caps, gilt star interpuncts
      c.font = px + "px " + FONT_MONO;
      if (c.letterSpacing !== undefined) c.letterSpacing = (opts.letterSpacing === undefined ? 3 : opts.letterSpacing) + "px";
      var words = String(text).toUpperCase().split(/\s+/);
      var cx = x;
      for (var i = 0; i < words.length; i++) {
        c.fillStyle = opts.color || spec.color;
        c.fillText(words[i], cx, y);
        cx += c.measureText(words[i]).width;
        if (i < words.length - 1) {
          c.fillStyle = opts.interpunctColor || spec.interpunctColor;
          var gap = c.measureText(" ").width;
          c.fillText("✦", cx + gap * 0.35, y - px * 0.06); // ✦
          cx += c.measureText(" ✦ ").width;
        }
      }
    }
    c.restore();
  }

  var Type = {
    MONO: FONT_MONO,
    BLACKLETTER: FONT_BLACKLETTER,
    // Google-fonts delivery path, same as v1 — for pages to link
    GOOGLE_FONTS_URL: "https://fonts.googleapis.com/css2?family=VT323&family=Jacquard+12&display=swap",
    inkAge: inkAge,
    header: headerSpec,
    drawHeader: drawHeader,
    smallCaps: smallCaps,
  };

  // ==========================================================================
  // public API
  // ==========================================================================
  api = {
    // the art-pixel constant + grid math
    U: U,
    Grid: Grid,

    // palettes and the ink law
    TRACKS: TRACKS.slice(),
    palette: palette,
    dataInk: dataInk,
    contrast: contrast,
    relLum: relLum,
    assertDataInk: assertDataInk,
    checkContrast: checkContrast,
    setMode: setMode,
    getMode: getMode,
    dev: false, // set true in development: illegal data ink throws

    // deterministic noise (seeds enter as domain offsets)
    noise: { hash2: hash2, vnoise: vnoise, fbm: fbm },

    // dithers + the re-threshold fade
    Dither: Dither,

    // paper generators (L0) + zone geometry helper
    paper: paper,
    rrectDist: rrectDist,

    // the sprite atlas + vector furniture vocabulary
    atlas: atlas,
    asterisms: ASTERISMS,
    drawAsterism: drawAsterism,
    star4: star4,
    feather: feather,
    DEGREE_SIGIL: DEGREE_SIGIL,

    // the compositor scaffold (L0..L4)
    stack: stack,

    // typography
    Type: Type,

    // harness plumbing
    setCanvasFactory: setCanvasFactory,
  };
  return api;
})();

// ============================================================================
// Prospero's Jukebox v2 — pj2-viz.js
// PJ2.Viz: the live renderer — the illuminated plate. Graphics build, step
// 3+4 of 5: all three skins on the ONE plate anatomy (PLAN-GRAPHICS §3),
// driven by the real engines' audio + telemetry.
//
// What this module is: the consumer of pj2-skin.js (grid, palettes, paper,
// dither, atlas, stack, type) and of the three engine facades
// (PJ2.Library / PJ2.Sycorax / PJ2.Ariel — attachAnalyser, note/event
// listeners, getInfo). It owns the spiral (v1's honest FFT coil — 7 octaves
// × 96 samples, one turn per octave, dB floor −75 / ceil −10, adaptive
// baseline, drag + auto-rotate camera) and the margin apparatus (§4
// diegetic telemetry, plus the theme staff and the harmony readout — the
// live chord/pose, cadence approach and sea-change state under the scene
// label, PLAN-HARMONY-READOUT).
//
// SPIRAL REVERT + NIGHT FOLIO (PLAN-SPIRAL-REVERT / PLAN-NIGHT-FOLIO,
// owner 2026-07-20): the coil renders v1's phosphor treatment for ALL
// THREE tracks — translucent colored ribbon fills with a bright fixed
// baseline, depth as alpha fade. Both panels (plate, margin)
// bake ONE shared night ground (paperNight); the paper frame is the
// folio's CSS border. The alchemy-sigil dial is gone; beneath the coil
// sits v1's constellation floor. v1's overlay animations are ported
// (lollipop, baseline ripples, glint stars, hum bar, bubbles), and every
// overlay voice is spectrally NOTCHED out of the coil's display — the
// coil's waves belong to the drones alone (applyOverlayNotches).
//
// THE INTERFACE CONTRACT (pj2-ui.js builds against exactly this):
//   PJ2.Viz.create({ plateCanvas, marginCanvas })
//   viz.setTrack(name)      — "library"|"sycorax"|"ariel"; swaps skins,
//                             rebuilds furniture, resets per-run visual state
//   viz.attach(engine, audioCtx) — wires an analyser
//                             (engine.attachAnalyser(audioCtx.createAnalyser())),
//                             note + event listeners (multicast facades),
//                             and a ~300 ms getInfo() poll. Returns an
//                             unsubscribe function; .detach() calls it.
//   viz.detach()            — unhooks listeners + poll; the engine may keep
//                             playing. NOTE: the engine facades have no
//                             detachAnalyser, so the analyser node stays on
//                             the engine's list (harmless — an analyser is a
//                             passive tap; it alters no audio).
//   viz.start() / viz.stop()— the rAF loop on / off
//   viz.resize()            — measures the canvases, delegates to each
//                             Skin.stack's scheduleResize (debounced — the
//                             L0 bake is 150–300 ms and must stay off the
//                             hot path)
//
// REMOVED (owner 2026-07-27): the densitas footer — the density envelope
// strip that sat below the folio grid ("past solid / forecast pricked").
// Its canvas, stack, renderers and the poll's intensity history are gone;
// create() no longer takes a footerCanvas. Intensity telemetry still
// reaches the margin apparatus (the quadrant/altitude panel), so nothing
// else lost its datum.
//
// REMOVED (owner 2026-08-08): Ariel's horizon — the dashed rule across the
// plate's foot with its "horizon — sinks through the release" label. It was
// the last static plate furniture on any track, and it read as an
// unexplained fixture: it only moved during a `release` event, so in normal
// listening it was a motionless line with a caption. drawPlateFurniture is
// now a no-op everywhere, and the `release` event no longer draws anything.
//
// REMOVED (owner 2026-08-16): the plate's emblem column — the §4 per-event
// illustrations that stamped into four slots down the plate's left edge
// (cadence sigils and gilt rules, the transmutation op, the ouroboros,
// feathers, pose gouges, organum rules, the waterphone apparition). They
// appeared and faded beside the coil unannounced and never earned their
// meaning; the scribal log already narrates every one of those events in
// words. addPlateIllustration / stampEmblem and each handler's stamp are
// gone (with them the cut/cut-return bookkeeping, which by then existed
// only to gate the apparition — the cut is audio-only again); the L3
// alive-list machinery stays in pj2-skin.js, simply unused here.
//
// MOVED + REBUILT (owner 2026-08-16): the theme staff — off the plate's
// top-left corner and into its own full-width margin panel, redrawn as a
// REAL five-line staff (see drawThemeStaff). The plate is the spiral's
// alone now; everything readable lives in the margin column.
//
// DEPLOY RE-SYNC (2026-08-17): a manual publish from a stale checkout
// overwrote the SERVER copy of this file with a pre-rowA/rowB-removal
// build — and the hash-diffing FTP deploy, whose sync state already
// matched Git, saw nothing to re-upload. This paragraph is the content
// change that forces the re-upload. The root cause (publish.sh uploading
// even when its push is rejected as behind origin) is guarded against in
// scripts/publish.sh as of the same day.
//
// Precision rules, binding (§2): data marks are never quantized coarser
// than 1 device px (contour, marks, needle angles all draw at full
// resolution on the smoothed L2 context); SAMPLES_PER_TURN is a constant
// 96 and no degradation rung may reduce it; every SOLE-carrier data stroke
// picks its color through dataCol(), which dev-asserts against
// Skin.dataInk when PJ2.Skin.dev is true (the node smoke runs that way).
//
// House rules: IIFE on window.PJ2, ES5 voice, loadable headless — no
// top-level DOM/canvas/audio access; create() takes its targets and
// injectable timers/rAF for the harness. Load order: pj2-rand.js,
// pj2-skin.js, then this file.
// ============================================================================

window.PJ2 = window.PJ2 || {};

PJ2.Viz = (function () {
  "use strict";

  // ==========================================================================
  // constants — v1's honest preset, verbatim (prosperos-jukebox-viz.js)
  // ==========================================================================
  var OCTAVES = 7;
  var BASE_OCTAVE = 1;
  var SPT = 96;                      // SAMPLES_PER_TURN — never reduced (§6)
  var TOTAL = OCTAVES * SPT;
  var FFT_SIZE = 8192;
  var DB_FLOOR = -75, DB_CEIL = -10;
  var BASELINE_ALPHA = 0.005;        // ~3.3 s EMA at 60 fps
  var BASELINE_RETAIN = 0.30;        // sustained content kept at ~30%
  var YAW_RATE = 0.09;               // rad/s — v1's felt speed (0.0015 rad/frame at 60 fps)
  var POLL_MS = 300;

  // per-track configuration: the FFT anchor (v1's table), the field's home
  // era (tonic + mode steps), and display strings.
  var TRACK_CFG = {
    library: {
      anchorPc: 0, anchorName: "C",
      homeTonicHz: 262, steps: [0, 2, 3, 5, 7, 9, 10], modeName: "dorian",
    },
    sycorax: {
      anchorPc: 3, anchorName: "Eb",
      homeTonicHz: 311, steps: [0, 1, 3, 4, 5, 7, 8], modeName: "sycorax",
    },
    ariel: {
      anchorPc: 5, anchorName: "F",
      homeTonicHz: 349, steps: [0, 2, 4, 6, 7, 9, 11], modeName: "lydian",
    },
  };

  var ROMAN_LO = ["i", "ii", "iii", "iv", "v", "vi", "vii"];
  var ROMAN_HI = ["I", "II", "III", "IV", "V", "VI", "VII"];

  // note-letter → pitch class (for parsing chord roots out of harmony names)
  var PC_OF_LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  function pcFromHz(hz) {
    if (!hz || hz <= 0) return 0;
    var m = 12 * (Math.log(hz / 16.3516) / Math.LN2);
    return ((Math.round(m) % 12) + 12) % 12;
  }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }
  function rgba(hex, a) {
    var c = hexRGB(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a < 0 ? 0 : a > 1 ? 1 : a) + ")";
  }

  // ==========================================================================
  // create({ plateCanvas, marginCanvas, ... })
  // ==========================================================================
  function create(opts) {
    opts = opts || {};
    if (!PJ2.Skin) throw new Error("PJ2.Viz: pj2-skin.js must load first");
    if (!PJ2.Rand) throw new Error("PJ2.Viz: pj2-rand.js must load first");
    var Skin = PJ2.Skin;

    var plateCanvas = opts.plateCanvas, marginCanvas = opts.marginCanvas;
    if (!plateCanvas || !marginCanvas) {
      throw new Error("PJ2.Viz.create: needs plateCanvas, marginCanvas");
    }
    // OPTIONAL: the folio's own paper canvas — the full-page sheet the
    // parchment binding is drawn on (see paperFolio). Absent (the harness,
    // and any host that has not added the element) the parchment dress
    // simply has no paper behind its panels; nothing else changes, and the
    // night binding never touches it.
    var folioCanvas = opts.folioCanvas || null;

    // injectable environment (harness plumbing — the node smoke passes mocks)
    var raf = opts.raf || (typeof requestAnimationFrame !== "undefined"
      ? function (fn) { return requestAnimationFrame(fn); } : null);
    var caf = opts.caf || (typeof cancelAnimationFrame !== "undefined"
      ? function (id) { cancelAnimationFrame(id); } : function () {});
    var nowFn = opts.now || (typeof performance !== "undefined" && performance.now
      ? function () { return performance.now(); } : function () { return Date.now(); });
    var setT = opts.setInterval || (typeof setInterval !== "undefined" ? setInterval : null);
    var clearT = opts.clearInterval || (typeof clearInterval !== "undefined" ? clearInterval : null);
    var pollMs = opts.pollMs || POLL_MS;

    var seed = opts.seed === undefined ? 451049 : (opts.seed >>> 0);

    // ------------------------------------------------------------------ state
    var track = "library";
    var cfg = TRACK_CFG[track];
    var pal = Skin.palette(track);
    var at = Skin.atlas(track);

    var engine = null, actx = null, analyser = null;
    var unsubNote = null, unsubEvent = null, pollId = null;
    var lastInfo = {};
    var running = false, rafId = null, lastFrameT = 0;
    var fontsReady = false;

    // the binding: "night" (night folio) | "parchment" (the windowed codex
    // page) — owner 2026-07-20, switchable, both kept alive
    var binding = "parchment"; // the app's one dress (toggle retired 2026-08-31)

    // camera (v1 verbatim behavior)
    var camYaw = 0.55, camPitch = 0.30, autoRotate = true;
    var dragging = false, lastMx = 0, lastMy = 0;

    // FFT machinery
    var fftData = null;              // sized on attach (frequencyBinCount)
    var magnitudes = new Float32Array(TOTAL);
    var rawMag = new Float32Array(TOTAL);   // pre-notch copy — overlays read this
    var baselineLin = new Float32Array(TOTAL);
    var sampleFftIdx = new Float32Array(TOTAL);
    var rowFMin = 0, sampleRate = 44100;

    // projection scratch (reused every frame — no per-frame allocation)
    var innerX = new Float32Array(TOTAL + 1), innerY = new Float32Array(TOTAL + 1), innerZ = new Float32Array(TOTAL + 1);
    var outerX = new Float32Array(TOTAL + 1), outerY = new Float32Array(TOTAL + 1), outerZ = new Float32Array(TOTAL + 1);
    var orderZ = new Float32Array(TOTAL);     // quad mean depths
    var orderArr = [];                        // Array mirror for .sort
    (function () { for (var i = 0; i < TOTAL; i++) orderArr.push(i); })();

    // per-run visual state (reset on setTrack / engine play / reseed)
    var era = { tonicPc: pcFromHz(cfg.homeTonicHz), steps: cfg.steps };
    var st = null; // set by resetRunState()
    function resetRunState() {
      era = { tonicPc: pcFromHz(cfg.homeTonicHz), steps: cfg.steps.slice() };
      st = {
        marks: [],            // note-driven overlay marks
        droneSet: [],         // active drones {deg, freq, oct, sub, t0, until} — the floor's ledger
        whistleQ: [],         // ariel whistle notes {of, freq, t, until} — time-gated → lollipop
        lolli: null,          // v1 tracked lollipop {theta, yBase, yHead, octIdx, framesQuiet}
        harpPlucks: [],       // library harpsichord baseline ripples {of, t, vel}
        bassPlucks: [],       // ariel bass baseline ripples {of, t, vel, freq}
        boxGlints: [],        // library music-box glint stars {of, t, riseFrac, seed, dir}
        chimeGlints: [],      // ariel chime glints (music-box's sibling voice)
        bubbles: [],          // ariel ambient gliss bubbles {startOct, glissEndOct, driftTo, t, dur, phase, r}
        humNote: null,        // library hum bar {of, freq, vowel, endTime}
        humLevel: 0,          // smoothed hum level (bar height)
        notches: [],          // active spectral notches {of, t0, until} — see applyOverlayNotches
        pulseAt: -1e9,        // sycorax proto-drum last lub (audio t)
        tree: [],             // library genealogy nodes {gen, name, ghost, answer, coagula}
        migration: [],        // ariel develop/answer gens
        sinkPx: 0,            // sycorax print-drop offset (CSS px)
        ghostLineUntil: -1e9, // ariel prior-evening flight-line (wall s)
        flightScenes: 0,      // ariel legs drawn = scenes seen
        bruise: 0,
        sceneLabel: null, sceneType: null, sceneX: 0, sceneIdx: 0, sceneCount: 0,
        lastCadence: null,    // {kind, label, rootStep|null, at}
      };
    }
    resetRunState();

    // ------------------------------------------------------- fonts (lesson 1)
    // canvas-only fonts are never fetched by a CSS link alone — load
    // explicitly BEFORE first canvas text, then rebake the furniture.
    function ensureFonts() {
      if (typeof document === "undefined" || !document.fonts || !document.fonts.load) {
        fontsReady = true;
        return;
      }
      try {
        Promise.all([
          document.fonts.load('38px "Jacquard 12"'),
          document.fonts.load('17px "VT323"'),
        ]).then(function () {
          fontsReady = true;
          invalidateFurniture();
        }, function () { fontsReady = true; });
      } catch (e) { fontsReady = true; }
    }

    // ------------------------------------------------------------- the stacks
    // one Skin.stack per canvas; zone objects are mutated in place on resize
    // (the stack closes over them and reads at bake time).
    var plateZones = { plateZone: { shape: "rrect", cx: 0, cy: 0, rx: 1, ry: 1, r: 0 } };
    var marginZones = { quietRects: [{ x: 0, y: 0, w: 4000, h: 4000 }] };

    var plateStack = Skin.stack(plateCanvas, track, {
      seed: seed, w: opts.plateW || 900, h: opts.plateH || 860,
      dpr: opts.dpr, zones: plateZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperPlatePanel, furniture: drawPlateFurniture, data: drawPlateData },
    });
    // both panels share the one night ground (function declarations
    // below are hoisted — safe to reference here)
    var marginStack = Skin.stack(marginCanvas, track, {
      seed: seed, w: opts.marginW || 402, h: opts.marginH || 640,
      dpr: opts.dpr, zones: marginZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperSidePanel, furniture: drawMarginFurniture, data: drawMarginData },
    });
    // the folio sheet: a paper-only stack, composited on demand rather than
    // per frame — it changes with the track, the binding and the size, and
    // nothing else. (Compositing a folio-sized layer every frame would be
    // pure waste; the panels above it are what animate.)
    var folioStack = folioCanvas ? Skin.stack(folioCanvas, track, {
      seed: seed, w: opts.folioW || 1392, h: opts.folioH || 768,
      dpr: opts.dpr, zones: {},
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperFolio },
    }) : null;
    function invalidateFolio() {
      if (folioStack) folioStack.invalidate("paper");
    }
    // The stack's own dirty flag is the trigger, not a flag of ours: every
    // path that changes the sheet (setTrack, the binding switch, and the
    // DEBOUNCED resize, which dirties the layer 160 ms after the call) sets
    // it, so asking the stack cannot miss a re-bake the way a local flag can.
    function compositeFolioIfDirty() {
      if (folioStack && folioStack.isDirty("paper")) folioStack.composite();
    }

    function invalidateFurniture() {
      plateStack.invalidate("furniture");
      marginStack.invalidate("furniture");
    }

    // THE NIGHT SURFACE (PLAN-NIGHT-FOLIO §B, owner 2026-07-20): every panel
    // — plate and margin — fills the same flat night ground. No parchment, no
    // windows, no texture boundaries. The paper frame lives at the folio's
    // CSS border.
    //
    // THE GRAIN IS GONE (owner 2026-08-08). §B asked for a "near-subliminal"
    // art-pixel grain, and this used to paint ~6% of cells one tone step up
    // (paper[1] over spiral.bg, blue-noise placed). It was not subliminal —
    // it read as speckle, or as static, on a ground that is otherwise almost
    // black. Removing it also settles the folio's continuity for free: a flat
    // fill is exactly .pj2-folio's own --pj2-paper, so the gutters between
    // the panels now match the panels perfectly and no seam is possible.
    function paperNight(G, tr, sd, zones) {
      var c = G.ctx;
      c.fillStyle = Skin.palette(tr).spiral.bg;
      c.fillRect(0, 0, G.w, G.h);
    }
    // THE FOLIO'S PAPER (parchment binding; owner 2026-08-08). ONE sheet for
    // the whole page, baked on a canvas that sits behind everything inside
    // .pj2-folio — the title, both panels, the gutters, the log.
    //
    // It used to be baked twice, once per panel, and that could not read as a
    // page: Skin.paper's generators work in LOCAL canvas coordinates, and the
    // ariel/library/sycorax generators all centre a radial darkening on the
    // canvas they are handed (pj2-skin.js: `n -= (dx*dx + dy*dy) * 0.20`,
    // plus burnish sweeps off the same centre). Two panels therefore meant
    // two sheets — each with its own bright middle and its own dark edge —
    // with the folio's flat background showing through the 12px column gutter
    // and the 8px gaps in the margin column between them. Closing the gaps
    // would not have helped; the seam was the two centres, not the distance.
    //
    // Now the sheet is generated once at folio size, so there is one centre,
    // one falloff, and no boundary anywhere. The panels above it paint only
    // their own contents: the plate its night window, the margin nothing at
    // all. Cost is a wash — one bake of the folio instead of two of the
    // panels — and it stays on the debounced resize path (§6).
    function paperFolio(G, tr, sd, zones) {
      if (binding !== "parchment") return;   // night: the panels own their ground
      Skin.paper(G.ctx, G.w, G.h, tr, sd, {
        u: G.u,
        quietRects: [{ x: 0, y: 0, w: G.w, h: G.h }],
        deckle: false, stars: false,
      });
    }

    // CUT A NIGHT WINDOW into whatever paper this layer holds: a rounded
    // rect of the track's night ground, with a feathered lip speckling into
    // the paper at its edge. Every opening on the page — the spiral's plate
    // zone and each of the apparatus panels — is cut by this one function,
    // so they are unmistakably the same kind of hole. The loop is bounded to
    // the window's own neighbourhood (the plate used to sweep the whole
    // canvas for its single window; five small windows could not afford it).
    // `feather` is the lip's reach in CSS px. The plate's window has room for
    // the full 7; the apparatus panels are 8px apart, so theirs must stay
    // under 4 or adjacent lips meet in the gutter and the parchment between
    // two panels turns to speckle.
    var WINDOW_FEATHER = 7;
    function cutNightWindow(G, tr, sd, z, feather) {
      if (!z || !(z.rx > 0) || !(z.ry > 0)) return;
      var c = G.ctx, u = G.u || 2;
      var FEATHER = feather || WINDOW_FEATHER;
      var f = FEATHER + u;
      var gx0 = Math.max(0, Math.floor((z.cx - z.rx - f) / u));
      var gx1 = Math.min(Math.ceil(G.w / u), Math.ceil((z.cx + z.rx + f) / u));
      var gy0 = Math.max(0, Math.floor((z.cy - z.ry - f) / u));
      var gy1 = Math.min(Math.ceil(G.h / u), Math.ceil((z.cy + z.ry + f) / u));
      c.fillStyle = Skin.palette(tr).spiral.bg;
      for (var gy = gy0; gy < gy1; gy++) {
        for (var gx = gx0; gx < gx1; gx++) {
          var px = gx * u, py = gy * u;
          var d = Skin.rrectDist(px + u * 0.5, py + u * 0.5, z);
          if (d < 0) { c.fillRect(px, py, u, u); continue; }
          if (d < FEATHER
              && Skin.noise.hash2(gx + (sd & 255), gy) < (1 - d / FEATHER) * 0.4) {
            c.fillRect(px, py, u, u);   // the feather speckle onto the paper
          }
        }
      }
    }

    // parchment binding: the spiral's rounded monitor window, cut into the
    // folio's sheet. The paper behind it is paperFolio's; this paints the
    // window and its feathered lip and leaves everything else TRANSPARENT.
    function paperParchPlate(G, tr, sd, zones) {
      cutNightWindow(G, tr, sd, zones.plateZone);
    }
    function paperPlatePanel(G, tr, sd, zones) {
      if (binding === "night") return paperNight(G, tr, sd, zones);
      return paperParchPlate(G, tr, sd, zones);
    }
    function paperSidePanel(G, tr, sd, zones) {
      if (binding === "night") return paperNight(G, tr, sd, zones);
      // Parchment: the margin sits on the folio's sheet (paperFolio), so it
      // paints no paper of its own — only the night windows its panels
      // live in, one per slot.
      var L = marginLayout(G), pf = 2;   // the panels' short lip (see above)
      // taller windows leave less paper between panels, so the lip drops
      // to 2 — at 3 the tree's speckle nearly met the row above it.
      // Every window runs to (nearly) its slot's foot now: the readouts
      // moved INSIDE the windows (owner 2026-08-16), so no slot keeps a
      // strip of paper below its box anymore.
      cutNightWindow(G, tr, sd, panelWindow(L.scene, 0), pf);
      cutNightWindow(G, tr, sd, panelWindow(L.staff, 2), pf);
      cutNightWindow(G, tr, sd, panelWindow(L.dialA, 2), pf);
      cutNightWindow(G, tr, sd, panelWindow(L.dialB, 2), pf);
      cutNightWindow(G, tr, sd, panelWindow(L.tree, 0), pf);
    }

    // ---------------------------------------------------------------- camera
    function bindCamera() {
      if (!plateCanvas.addEventListener) return;
      plateCanvas.addEventListener("mousedown", function (e) {
        dragging = true; lastMx = e.clientX; lastMy = e.clientY;
      });
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("mousemove", function (e) {
          if (!dragging) return;
          camYaw += (e.clientX - lastMx) * 0.01;
          camPitch = clamp(camPitch + (e.clientY - lastMy) * 0.01, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
          lastMx = e.clientX; lastMy = e.clientY;
        });
        window.addEventListener("mouseup", function () { dragging = false; });
      }
      plateCanvas.addEventListener("touchstart", function (e) {
        if (e.touches.length !== 1) return;
        dragging = true; lastMx = e.touches[0].clientX; lastMy = e.touches[0].clientY;
        if (e.preventDefault) e.preventDefault();
      }, { passive: false });
      plateCanvas.addEventListener("touchmove", function (e) {
        if (!dragging || e.touches.length !== 1) return;
        camYaw += (e.touches[0].clientX - lastMx) * 0.01;
        camPitch = clamp(camPitch + (e.touches[0].clientY - lastMy) * 0.01, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
        lastMx = e.touches[0].clientX; lastMy = e.touches[0].clientY;
        if (e.preventDefault) e.preventDefault();
      }, { passive: false });
      plateCanvas.addEventListener("touchend", function () { dragging = false; });
    }
    bindCamera();

    // ------------------------------------------------------------ FFT mapping
    function rebuildSampleIdx() {
      rowFMin = 16.3516 * Math.pow(2, BASE_OCTAVE + cfg.anchorPc / 12);
      for (var o = 0; o < OCTAVES; o++) {
        var rowF = rowFMin * Math.pow(2, o);
        for (var b = 0; b < SPT; b++) {
          var f = rowF * Math.pow(2, b / SPT);
          sampleFftIdx[o * SPT + b] = f * FFT_SIZE / sampleRate;
        }
      }
    }
    rebuildSampleIdx();

    function computeMagnitudes() {
      if (!analyser || !fftData) {
        // detached: the coil settles honestly to silence
        for (var i = 0; i < TOTAL; i++) magnitudes[i] *= 0.92;
        return;
      }
      analyser.getFloatFrequencyData(fftData);
      var bins = fftData.length;
      for (var idx = 0; idx < TOTAL; idx++) {
        var fi = sampleFftIdx[idx];
        var lo = Math.floor(fi), t = fi - lo, hi = lo + 1;
        if (lo < 0) lo = 0;
        if (lo >= bins) lo = bins - 1;
        if (hi >= bins) hi = bins - 1;
        var db = fftData[lo] * (1 - t) + fftData[hi] * t;
        if (db !== db || db === -Infinity) db = -160;      // NaN / silence guard
        // adaptive baseline (v1 verbatim: EMA in LINEAR amplitude space)
        var lin = db > -120 ? Math.pow(10, db / 20) : 0;
        baselineLin[idx] += (lin - baselineLin[idx]) * BASELINE_ALPHA;
        var bsl = baselineLin[idx];
        var transient = lin - bsl;
        if (transient < 0) transient = 0;
        var disp = transient + bsl * BASELINE_RETAIN;
        var dispDb = disp > 1e-10 ? 20 * Math.log(disp) / Math.LN10 : -120;
        magnitudes[idx] = dispDb < DB_FLOOR ? 0 : (dispDb > DB_CEIL ? 1 : (dispDb - DB_FLOOR) / (DB_CEIL - DB_FLOOR));
      }
    }

    function aNow() { return actx ? actx.currentTime : 0; }

    // -------------------------------------------------------- the ink law
    // every SOLE-carrier data stroke routes through here; in dev mode an
    // illegal color throws (the node smoke runs with Skin.dev = true).
    function dataCol(hex, context) {
      Skin.assertDataInk(track, hex, context);
      return hex;
    }

    // ============================================================== EVENTS ==
    function onEvent(ev) {
      if (!ev || !ev.type) return;
      var wallS = nowFn() / 1000;
      switch (ev.type) {
        case "engine":
          if (ev.state === "play" || ev.state === "reseed") {
            resetRunState();
            invalidateFurniture();
          }
          break;
        case "scene": handleScene(ev, wallS); break;
        case "cadence": handleCadence(ev, wallS); break;
        case "seachange": handleSeachange(ev, wallS); break;
        case "reground": handleReground(ev, wallS); break;
        case "ghost": handleGhost(ev, wallS); break;
        case "seam-ghost": st.ghostLineUntil = wallS + 60; break;
        case "develop": case "answer": handleDevelop(ev, wallS); break;
        case "coagula": handleCoagula(ev, wallS); break;
        case "bruise": st.bruise = ev.value || 0; break;
        // arrival / organum / feather / bass-flourish / air / cut /
        // cut-return: these drew only emblem-column stamps — gone with the
        // column (owner 2026-08-16). pose / percussion fed only the
        // pose/tallies row — gone with the rowA/rowB slots (owner
        // 2026-08-17). The log still narrates each of them, and the
        // proto-drum note events still drive the plate's pulse mark.
        default: break;
      }
    }

    function handleScene(ev, wallS) {
      st.sceneType = ev.scene;
      st.sceneIdx = ev.idx; st.sceneCount = ev.count;
      st.sceneLabel = ev.label || ev.scene;
      if (track === "ariel") st.flightScenes = (ev.idx || 0) + 1;
      marginStack.invalidate("furniture"); // scene heading is furniture-grade
    }

    function parseRomanRoot(name) {
      // "IV", "iv", "II°", "F major", "i (Eb)" … → scale-degree index 0..6, or null
      if (!name) return null;
      var m = String(name).match(/^(vii|VII|vi|VI|iv|IV|iii|III|ii|II|v|V|i|I)\b/);
      if (!m) return null;
      var lo = m[1].toLowerCase();
      for (var i = 0; i < 7; i++) if (ROMAN_LO[i] === lo) return i;
      return null;
    }

    function handleCadence(ev, wallS) {
      var rootStep = null;
      if (ev.chords && ev.chords.length) {
        var last = ev.chords[ev.chords.length - 1];
        var idx = parseRomanRoot(typeof last === "string" ? last : (last && last.name));
        if (idx != null) rootStep = era.steps[idx];
      }
      // bookkeeping only — the cadence's stamped emblem went with the
      // column (2026-08-16); the log announces the arrival in words
      st.lastCadence = { kind: ev.kind, label: ev.label || ev.kind, rootStep: rootStep, at: wallS };
    }

    function handleSeachange(ev, wallS) {
      if (ev.field && ev.field.tonicHz) {
        era.tonicPc = pcFromHz(ev.field.tonicHz);
        // (mode steps stay the track's — engines modulate within family)
        // the coil itself takes no theatric — the floor's in-key labels and
        // the margin carry the modulation (PLAN-SPIRAL-REVERT D1)
      }
      if (track === "sycorax") {
        // the rare semitone SINK: the whole plate's print drops one visible
        // line lower, once (§4). One art line = 3 cells.
        st.sinkPx = st.sinkPx + 6;
      }
      plateStack.invalidate("furniture");
      marginStack.invalidate("furniture");
    }

    function handleReground(ev, wallS) {
      // ariel's seam: the tonic ratchets home
      era.tonicPc = pcFromHz(cfg.homeTonicHz);
      plateStack.invalidate("furniture");
    }

    function handleGhost(ev, wallS) {
      if (track === "library") {
        st.tree.push({ gen: 0, name: ev.name, ghost: true });
        marginStack.invalidate("furniture");
      } else if (track === "ariel") {
        // the returning bird: prior evening's flight-line ghosted under tonight's
        st.ghostLineUntil = wallS + 90;
      }
      // sycorax: the chant intones it and the log records it — the doubled
      // bone rule went with the emblem column (2026-08-16)
    }

    function handleDevelop(ev, wallS) {
      if (track === "library") {
        st.tree.push({ gen: ev.gen || 0, name: ev.name, answer: ev.type === "answer" });
        if (st.tree.length > 24) st.tree.shift();
        marginStack.invalidate("furniture");
      } else if (track === "sycorax") {
        st.tree.push({ gen: ev.gen || 0, name: ev.name, answer: ev.type === "answer" }); // the cord-and-bone tally
        if (st.tree.length > 24) st.tree.shift();
        marginStack.invalidate("furniture");
      } else {
        st.migration.push({ gen: ev.gen || 0, answer: ev.type === "answer" });
        if (st.migration.length > 24) st.migration.shift();
        marginStack.invalidate("furniture");
      }
    }

    function handleCoagula(ev, wallS) {
      st.tree.push({ gen: 9, name: ev.name, coagula: true });
      marginStack.invalidate("furniture");
    }

    // (the emblem column's plumbing — addPlateIllustration, stampEmblem,
    // the four-slot cycler and the hold-then-decay easing — lived here;
    // removed with the column, owner 2026-08-16. The cut/cut-return
    // bookkeeping went with it: by then it existed only to gate the
    // waterphone apparition stamp, so the cut is an audio event with no
    // visual state at all — the carried bruise's darkening of the treeline
    // margin, fed by the `bruise` event, remains its only residue.)

    // =============================================================== NOTES ==
    function ofOf(freq) {
      if (!freq || freq <= 0) return null;
      var of = Math.log(freq / rowFMin) / Math.LN2;
      if (of < 0 || of >= OCTAVES) return null;
      return of;
    }
    function onNote(ev) {
      if (!ev || !ev.voice) return;
      var of = ofOf(ev.freq);
      var t = ev.t || 0;
      if (track === "library") {
        if (ev.voice === "pluck" && of != null) {
          // v1: the harpsichord vibrates the baseline itself (viz.js:698)
          st.harpPlucks.push({ of: of, t: t, vel: ev.velocity || 0.7, freq: ev.freq });
          if (st.harpPlucks.length > 24) st.harpPlucks.shift();
          pushNotch(of, t, Math.max(ev.durS || 1, 2));
        } else if (ev.voice === "musicbox" && of != null) {
          // v1: soft-glow glint star, loudness → rise (viz.js:1326–1346)
          var gv = ev.velocity == null ? 0.8 : ev.velocity;
          var gn = clamp01((gv - 0.45) / 0.55);
          st.boxGlints.push({
            of: of, t: t,
            riseFrac: BOX_RISE_MIN + BOX_RISE_VAR * gn,
            seed: Skin.noise.hash2(ev.freq || 1, t) * 6.283,
            dir: Skin.noise.hash2(t, 3.7) < 0.5 ? -1 : 1,
          });
          if (st.boxGlints.length > 32) st.boxGlints.shift();
          pushNotch(of, t, ev.durS || 1);
        } else if (ev.voice === "hum" && of != null) {
          // v1: the vowel-shaped hum bar (viz.js:1292–1319). The v2 events
          // don't carry the mouth's vowel — neutral "uh" until the engine
          // emits it (additive event change, flagged in PLAN-NIGHT-FOLIO).
          st.humNote = { of: of, freq: ev.freq, vowel: ev.vowel || "uh", endTime: t + (ev.durS || 1) };
          pushNotch(of, t, ev.durS || 1);
        } else if (ev.voice === "drone" && ev.deg != null) {
          upsertDrone(ev, t);
        }
      } else if (track === "sycorax") {
        if ((ev.voice === "chant" || ev.voice === "rebec" || ev.voice === "boneflute") && of != null) {
          pushMark({ kind: "cutline", of: of, t: t, life: Math.min(ev.durS || 1.5, 4), vel: ev.velocity || 0.6 });
          pushNotch(of, t, ev.durS || 1.5);
        } else if (ev.voice === "protodrum") {
          if (ev.kind === "lub" || ev.kind === "dub") st.pulseAt = t;
        } else if (ev.voice === "waterphone" && of != null) {
          pushMark({ kind: "tine", of: of, t: t, life: Math.min(ev.durS || 3, 6) });
          pushNotch(of, t, ev.durS || 3);
        } else if (ev.voice === "gurdy" && ev.deg != null) {
          upsertDrone(ev, t);
        }
      } else { // ariel
        if (ev.voice === "whistle" && of != null) {
          // v1: the whistle IS the lollipop (viz.js:1137–1228). Notes are
          // QUEUED and gated by their scheduled time — the engines emit a
          // whole phrase ahead of the sound, and the tracker must strike
          // each note as it actually plays (owner 2026-07-20: one lollipop
          // per note, gliding between neighbors, not one per phrase).
          st.whistleQ.push({ of: of, freq: ev.freq, t: t, until: t + (ev.durS || 2) + 0.4 });
          if (st.whistleQ.length > 24) st.whistleQ.shift();
          pushNotch(of, t, ev.durS || 2);
        } else if (ev.voice === "chime" && of != null) {
          // the chime is the music box's sibling: same glint-star voice
          var cv = ev.velocity == null ? 0.7 : ev.velocity;
          st.chimeGlints.push({
            of: of, t: t,
            riseFrac: BOX_RISE_MIN + BOX_RISE_VAR * clamp01((cv - 0.45) / 0.55),
            seed: Skin.noise.hash2(ev.freq || 1, t) * 6.283,
            dir: Skin.noise.hash2(t, 5.1) < 0.5 ? -1 : 1,
          });
          if (st.chimeGlints.length > 32) st.chimeGlints.shift();
          pushNotch(of, t, ev.durS || 2);
        } else if (ev.voice === "flutter" && of != null) {
          pushMark({ kind: "wing", of: of, t: t, life: 1.4 });
          pushNotch(of, t, ev.durS || 1);
        } else if (ev.voice === "bass" && of != null) {
          // v1: the bass ripples the baseline (viz.js:729) — no diamond mark
          st.bassPlucks.push({ of: of, t: t, vel: ev.velocity || 0.8, freq: ev.freq });
          if (st.bassPlucks.length > 24) st.bassPlucks.shift();
          pushNotch(of, t, Math.max(ev.durS || 1, 2));
        } else if (ev.voice === "ambient" && ev.kind === "bubble" && of != null) {
          // v1's rising bubbles (viz.js:1353–1374): gliss → climb, drift, pop
          var eof = ev.endFreq ? ofOf(ev.endFreq) : of;
          if (eof == null) eof = of;
          st.bubbles.push({
            startOct: of, glissEndOct: eof,
            driftTo: Math.min(OCTAVES - 0.01, eof + BUBBLE_RISE_EXTRA),
            t: t, dur: ev.durS || 1,
            phase: Skin.noise.hash2(ev.freq || 1, t) * Math.PI * 2,
            r: BUBBLE_R * (0.8 + Skin.noise.hash2(t, 9.2) * 0.5),
          });
          if (st.bubbles.length > 24) st.bubbles.shift();
          pushNotch(of, t, ev.durS || 1);
        } else if (ev.voice === "breeze" && ev.deg != null) {
          upsertDrone(ev, t);
        }
      }
    }
    function pushMark(m) {
      st.marks.push(m);
      if (st.marks.length > 160) st.marks.shift();
    }
    // the drone ledger feeds the constellation floor (freq → node). Each
    // re-emission of a degree is a fresh cycle: t0/until restart so the
    // floor's halo rings breathe per cycle, v1-style. Sub-octave tones
    // (kind "sub") keep their own row.
    function upsertDrone(ev, t) {
      var until = t + (ev.durS || 8);
      var sub = ev.kind === "sub";
      for (var i = 0; i < st.droneSet.length; i++) {
        var d = st.droneSet[i];
        if (d.deg === ev.deg && d.sub === sub) {
          d.freq = ev.freq || d.freq; d.oct = ev.oct;
          d.t0 = t; d.until = until;
          return;
        }
      }
      st.droneSet.push({ deg: ev.deg, freq: ev.freq || 0, oct: ev.oct, sub: sub, t0: t, until: until });
      if (st.droneSet.length > 8) st.droneSet.shift();
    }

    // ============================================================ PLATE L1 ==
    // PLAN-NIGHT-FOLIO A1: the coil is top-heavy — its turns span −3…+4
    // octave-steps around the center and the FFT contour extrudes a further
    // `peak` above the top turn — so R is solved from the night window's
    // real vertical budget at the DEFAULT camera pitch (drag never resizes;
    // the A2 clip guarantees the frame regardless). Headroom covers half
    // the worst-case top peak; a rare fortissimo top-octave crest crops at
    // the window edge instead of painting the paper.
    var FIT_CP = Math.cos(0.30), FIT_SP = Math.sin(0.30);   // default pitch
    var FIT_TOP = (4 * 0.55 + 0.825 * 0.5) * FIT_CP;        // turns + ½ peak
    var FIT_BOT = (3.45 * 0.55) * FIT_CP + 1.10 * FIT_SP;   // floor + label ring
    function plateMetrics(G) {
      var CX = G.w * 0.5;
      var pz = plateZones.plateZone;
      var ry = pz.ry > 10 ? pz.ry : G.h * 0.46;
      var inner = 10;                                        // breathing room inside the window
      var baseRadius = Math.min((2 * ry - 2 * inner) / (FIT_TOP + FIT_BOT), G.w * 0.27);
      var CY = (pz.ry > 10 ? pz.cy - pz.ry : G.h * 0.04) + inner + FIT_TOP * baseRadius + st.sinkPx;
      return {
        CX: CX, CY: CY,
        R: baseRadius,
        // v1's coil proportions (prosperos-jukebox-viz.js:1394–1397)
        oct: baseRadius * 0.55,
        peak: baseRadius * 0.55 * 1.5,
      };
    }

    // PLAN-NIGHT-FOLIO A2: the hard clip — nothing on the data pass may
    // paint outside the night window, at any camera angle or FFT extreme
    function clipToWindow(c) {
      var pz = plateZones.plateZone;
      if (!pz || pz.rx <= 1) return false;
      var x0 = pz.cx - pz.rx, y0 = pz.cy - pz.ry;
      var w = pz.rx * 2, h = pz.ry * 2, r = Math.min(pz.r || 0, pz.rx, pz.ry);
      c.save();
      c.beginPath();
      c.moveTo(x0 + r, y0);
      c.lineTo(x0 + w - r, y0); c.arcTo(x0 + w, y0, x0 + w, y0 + r, r);
      c.lineTo(x0 + w, y0 + h - r); c.arcTo(x0 + w, y0 + h, x0 + w - r, y0 + h, r);
      c.lineTo(x0 + r, y0 + h); c.arcTo(x0, y0 + h, x0, y0 + h - r, r);
      c.lineTo(x0, y0 + r); c.arcTo(x0, y0, x0 + r, y0, r);
      c.closePath();
      c.clip();
      return true;
    }

    function drawPlateFurniture(G) {
      // The plate carries NO static furniture on any track: no caption
      // (owner 2026-07-20: the explanatory line under the spiral is gone),
      // no corner schema, no persistent marks (no-scar ruling), and — owner
      // 2026-08-08 — no Ariel horizon (the dashed rule and its
      // "horizon — sinks through the release" label read as an unexplained
      // fixture, since the sink only moves during a rare release event).
      // The layer stays registered: the stack expects a furniture renderer,
      // and the night ground beneath it is baked by the paper layer.
    }

    // ============================================================ PLATE L2 ==
    // v1 constellation-floor helpers (prosperos-jukebox-viz.js:989–1062):
    // the drones' chromatic star-map beneath the coil.
    var HALO_WAVE_POINTS = 96;
    var HALO_WAVE_AMP_FRAC = 0.2;
    var FLOOR_LOWPASS = 240;
    var HARMONIC_FREQ_CEILING = 800;
    var HALO_SLOWDOWN = 60;
    var HALO_WAVELENGTHS = 6;
    var CONST_PITCH_LABELS = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
    var INTERVAL_NAMES = {
      0: "unison", 1: "m2", 2: "M2", 3: "m3", 4: "M3",
      5: "P4", 6: "tritone", 7: "P5", 8: "m6", 9: "M6",
      10: "m7", 11: "M7",
    };
    var CONSONANCE = { 0: 1.0, 7: 0.95, 5: 0.85, 4: 0.75, 3: 0.7,
                       8: 0.55, 9: 0.55, 2: 0.4, 10: 0.4,
                       1: 0.25, 11: 0.25, 6: 0.3 };
    function lowpassResponse(f) {
      var r = f / FLOOR_LOWPASS;
      return 1 / Math.sqrt(1 + r * r);
    }
    function triangleHarmonics(fundamental, maxFreq) {
      var result = [];
      for (var n = 1; n <= 9; n += 2) {
        var f = fundamental * n;
        if (f > maxFreq) break;
        result.push({ freq: f, relAmp: (1 / (n * n)) * lowpassResponse(f) });
      }
      return result;
    }
    function freqToMidi(f) { return 12 * (Math.log(f / 440) / Math.LN2) + 69; }
    function pitchClassF(f) { return ((freqToMidi(f) % 12) + 12) % 12; }  // fractional — no rounding
    function intervalSemitones(f1, f2) {
      return Math.round(Math.abs(freqToMidi(f1) - freqToMidi(f2))) % 12;
    }
    // pitch class → clock angle, octave → distance from center (v1 verbatim)
    function constNodeWorld(freq, constMaxR) {
      var theta = (pitchClassF(freq) / 12) * 2 * Math.PI;
      var oct = Math.floor(freqToMidi(freq) / 12) - 1;
      var norm = clamp01((oct - 1) / 4);
      var r = 0.25 * constMaxR + norm * 0.75 * constMaxR;
      return { x: r * Math.cos(theta), z: r * Math.sin(theta) };
    }
    // drone-cycle envelope, approximated: the events carry t/durS but not
    // v1's fadeIn/fadeOut/peakGain — a fixed fade fraction stands in
    // (PLAN-SPIRAL-REVERT D4; extend the events additively if this reads flat)
    function droneIntensity(d, t) {
      var dur = d.until - d.t0;
      if (dur <= 0 || t < d.t0 || t > d.until) return 0;
      var fadeS = Math.min(2.5, dur * 0.25);
      return clamp01(Math.min((t - d.t0) / fadeS, (d.until - t) / fadeS));
    }
    function liveDrones(t) {
      var live = [];
      for (var i = 0; i < st.droneSet.length; i++) {
        if (st.droneSet[i].until > t) live.push(st.droneSet[i]);
      }
      st.droneSet = live;
      return live;
    }
    function spRGBA(triple, a) {
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      return "rgba(" + triple[0] + "," + triple[1] + "," + triple[2] + "," + a.toFixed(3) + ")";
    }
    // in-key membership by ABSOLUTE pitch class — the floor is a fixed clock
    // face, C at angle 0 (v1's layout); tracks the era's live modulation
    function inKeyAbsPc() {
      var out = {};
      for (var i = 0; i < era.steps.length; i++) {
        out[(era.tonicPc + era.steps[i]) % 12] = true;
      }
      return out;
    }

    // ---- v1 overlay animations (prosperos-jukebox-viz.js:684–852 +
    // 1088–1228): harpsichord/bass baseline ripples, music-box glint stars,
    // rising bubbles, the vowel hum bar, the whistle lollipop. v1 drove the
    // ripple/hum waveforms and whistle tracking from per-layer analyser
    // taps; the v2 facades expose no per-voice taps, so pitch comes from
    // the note events and the ripple wave is a slowed traveling sine at
    // the note's own frequency (the floor halos' SLOWDOWN convention).
    // Same shapes, same envelopes, same lifetimes as v1.
    // v1's HARP_TAU=2 / LIFETIME=7 assumed the tap's own decaying waveform
    // multiplied in (a plucked string dies fast); the synthesized sine
    // doesn't decay, so those constants read as endless sustain (owner
    // 2026-07-20). The effective envelope is folded into shorter values.
    var HARP_TAU = 0.7, HARP_SIGMA_OCT = 0.05, HARP_LIFETIME = 3, HARP_AMP = 80;
    var BASS_TAU = 1.6, BASS_SIGMA_OCT = 0.06, BASS_LIFETIME = 5.5, BASS_AMP = 80;
    var LOLLI_HEIGHT = 2;          // hum-bar max-height multiplier (v1)
    var HEAD_SMOOTH = 0.30;        // lollipop pitch/height easing
    var HUM_VOWEL_SHAPES = {
      ng: { width: 1.0, height: 0.95, peak:  0.08, pointed: 0, round: 0.10 },
      oo: { width: 1.0, height: 1.00, peak:  0.00, pointed: 0, round: 0.60 },
      uh: { width: 1.0, height: 1.00, peak:  0.00, pointed: 0, round: 0.08 },
      oh: { width: 1.0, height: 1.00, peak: -0.02, pointed: 0, round: 0.00 },
      ah: { width: 1.0, height: 1.00, peak:  0.04, pointed: 1, round: 0.00 },
    };
    var HUM_BAR_HALF = 1;          // base half-width in samples (× vowel width)
    var BOX_GLINT_LIFE = 1.5, BOX_GLINT_BLOOM = 0.08, BOX_GLINT_R = 6.5;
    var BOX_RISE_MIN = 0.175, BOX_RISE_VAR = 0.475;
    var BOX_SPIN = 12 * Math.PI / 180, BOX_SHIM = 0.4;
    var BUBBLE_RISE_EXTRA = 0.45, BUBBLE_AFTER = 1.1, BUBBLE_R = 7, BUBBLE_WOBBLE = 0.06;

    // ---- spectral notches (owner 2026-07-20: "I just want the lollipop").
    // Every voice with a DEDICATED overlay (lollipop, ripple, glint, bar,
    // bubble, cutline, tine, wing) is lifted OUT of the coil's displayed
    // spectrum while it sounds: a gaussian notch at its pitch and 2nd/3rd
    // harmonics. The coil's waves belong to the drones alone. Overlays
    // read their heights from the pre-notch rawMag so nothing lies.
    var NOTCH_SIGMA = 2.6;                       // samples
    var LOG2H = [0, 1, Math.log(3) / Math.LN2];  // harmonic offsets in octaves
    var NOTCH_DEPTH = [0.92, 0.6, 0.4];
    function pushNotch(of, t, durS) {
      if (of == null) return;
      st.notches.push({ of: of, t0: t, until: t + (durS || 1) + 0.5 });
      if (st.notches.length > 48) st.notches.shift();
    }
    function applyOverlayNotches(t) {
      var live = [];
      for (var n = 0; n < st.notches.length; n++) {
        if (t <= st.notches[n].until) live.push(st.notches[n]);
      }
      st.notches = live;
      for (n = 0; n < live.length; n++) {
        var nc = live[n];
        if (t < nc.t0) continue;
        for (var h = 0; h < 3; h++) {
          var cS = (nc.of + LOG2H[h]) * SPT;
          if (cS >= TOTAL + NOTCH_SIGMA * 3) continue;
          var i0 = Math.max(0, Math.floor(cS - NOTCH_SIGMA * 3));
          var i1 = Math.min(TOTAL - 1, Math.ceil(cS + NOTCH_SIGMA * 3));
          for (var b2 = i0; b2 <= i1; b2++) {
            var d = (b2 - cS) / NOTCH_SIGMA;
            magnitudes[b2] *= 1 - NOTCH_DEPTH[h] * Math.exp(-0.5 * d * d);
          }
        }
      }
    }

    // baseline ripple displacement at coil position `frac` (octave float) —
    // v1's harpDr/bassDr (viz.js:698/729) with the synthesized wave
    function rippleDr(plucks, sigma, tau, radial, frac, t) {
      var dr = 0;
      for (var i = 0; i < plucks.length; i++) {
        var pk = plucks[i];
        if (t < pk.t) continue;
        var dOct = frac - pk.of;
        if (dOct < -sigma * 3 || dOct > sigma * 3) continue;
        var env = Math.exp(-(dOct * dOct) / (2 * sigma * sigma));
        var decay = Math.exp(-(t - pk.t) / tau);
        var winFrac = clamp01(dOct / (2.5 * sigma) + 0.5);
        var cycles = 1.5 + (pk.freq ? Math.min(6, pk.freq / 180) : 2);
        var wv = Math.sin(winFrac * cycles * 2 * Math.PI
          + ((pk.freq || 200) / HALO_SLOWDOWN) * 2 * Math.PI * t) * 2.4 * (pk.vel || 0.7);
        if (wv > 2.6) wv = 2.6; else if (wv < -2.6) wv = -2.6;
        dr += radial * decay * env * wv;
      }
      return dr;
    }

    // the whistle lollipop tracker — v1's updateLollipop3D (viz.js:1137).
    // v1 peak-tracked the isolated whistle analyser every frame, which is
    // what made the head SLIDE through glissandi and QUIVER with vibrato.
    // Reproduced here without a per-voice tap: the note queue gates WHICH
    // note is sounding (the engines schedule phrases ahead), and the
    // sounding pitch is refined every frame by locating the spectral peak
    // in rawMag near the note — the whistle's 5.5 Hz vibrato and bends
    // live in the spectrum, so the head follows them.
    var LOLLI_REFINE_SAMPLES = 8;      // ± search window (1 semitone)
    function refineWhistleOf(of) {
      var c0 = clamp(Math.round(of * SPT), 0, TOTAL - 1);
      var i0 = Math.max(1, c0 - LOLLI_REFINE_SAMPLES);
      var i1 = Math.min(TOTAL - 2, c0 + LOLLI_REFINE_SAMPLES);
      var best = c0, bv = rawMag[c0];
      for (var i = i0; i <= i1; i++) {
        if (rawMag[i] > bv) { bv = rawMag[i]; best = i; }
      }
      if (bv < 0.04) return of;        // near-silence: hold the note's pitch
      // parabolic refinement between neighboring samples (v1 viz.js:1093)
      var y0 = rawMag[best - 1], y1 = rawMag[best], y2 = rawMag[best + 1];
      var den = y0 - 2 * y1 + y2;
      var off = Math.abs(den) < 1e-6 ? 0 : clamp(0.5 * (y0 - y2) / den, -0.5, 0.5);
      return clamp((best + off) / SPT, 0, OCTAVES - 0.001);
    }
    function updateLollipop(M, audioT) {
      // prune, then gate: the sounding note is the latest-STARTED live one
      var live = [], wn = null, i;
      for (i = 0; i < st.whistleQ.length; i++) {
        var q = st.whistleQ[i];
        if (audioT > q.until) continue;
        live.push(q);
        if (audioT >= q.t && (!wn || q.t > wn.t)) wn = q;
      }
      st.whistleQ = live;
      var lp = st.lolli;
      if (wn) {
        var of = refineWhistleOf(wn.of);
        var afterSilence = !lp || lp.framesQuiet > 3;
        var noteChanged = !afterSilence && lp.noteT !== wn.t;
        // the turn anchor: vibrato stays on its turn mid-note; a new note
        // (or a fresh strike) re-anchors so octave leaps land correctly
        var octIdx = (afterSilence || noteChanged) ? Math.floor(of) : lp.octIdx;
        var fracIn = clamp(of - octIdx, 0, 0.999);
        var iB = clamp(Math.round(of * SPT), 0, TOTAL - 1);
        var theta = fracIn * 2 * Math.PI;
        var yBase = (octIdx + fracIn - (OCTAVES - 1) / 2) * M.oct;
        var yHead = yBase + rawMag[iB] * M.peak;
        // a step to a NEARBY note glides (the slide the owner remembers);
        // a leap past ~2.5 semitones strikes a fresh lollipop at the new
        // pitch — one lollipop per note, as in v1's note-start snap
        var strike = afterSilence ||
          (noteChanged && Math.abs(of - lp.lastOf) > 0.21);
        if (strike) {
          st.lolli = { theta: theta, yBase: yBase, yHead: yHead,
                       octIdx: octIdx, noteT: wn.t, lastOf: of, framesQuiet: 0 };
        } else {
          var dT = theta - lp.theta;
          while (dT > Math.PI) dT -= 2 * Math.PI;
          while (dT < -Math.PI) dT += 2 * Math.PI;
          lp.theta += dT * HEAD_SMOOTH;
          lp.yHead += (yHead - lp.yHead) * HEAD_SMOOTH;
          lp.yBase = yBase; lp.octIdx = octIdx;
          lp.noteT = wn.t; lp.lastOf = of; lp.framesQuiet = 0;
        }
      } else if (lp) {
        // note over: the head sinks home, then the lollipop leaves (v1)
        lp.framesQuiet++;
        lp.yHead += (lp.yBase - lp.yHead) * 0.3;
        if ((lp.yHead - lp.yBase) < M.oct * 0.03 || lp.framesQuiet > 12) st.lolli = null;
      }
    }

    // scale an "rgba(r,g,b,a)" template's alpha (v1's fadeRgba)
    function fadeRgba(rgbaStr, mult) {
      return rgbaStr.replace(/rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)/,
        function (_, r, g, b, a) {
          var na = Math.max(0, Math.min(1, parseFloat(a) * mult));
          return "rgba(" + r + "," + g + "," + b + "," + na.toFixed(3) + ")";
        });
    }

    // v1's drawLollipop3D (viz.js:1204): glowing head, stem to the baseline
    function drawLollipop(G, M, proj, depthAlpha) {
      var lp = st.lolli;
      if (!lp) return;
      var c = G.ctx;
      var ct = Math.cos(lp.theta), sn = Math.sin(lp.theta);
      var pb = proj(M.R * ct, lp.yBase, M.R * sn);
      var ph = proj(M.R * ct, lp.yHead, M.R * sn);
      var head = fadeRgba(pal.spiral.lollipopHead, depthAlpha);
      c.save();
      c.globalCompositeOperation = "lighter";
      var grad = c.createRadialGradient(ph.sx, ph.sy, 1, ph.sx, ph.sy, 16);
      grad.addColorStop(0, head);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = grad;
      c.beginPath(); c.arc(ph.sx, ph.sy, 16, 0, Math.PI * 2); c.fill();
      c.globalCompositeOperation = "source-over";
      c.strokeStyle = head; c.lineWidth = 2;
      c.beginPath(); c.moveTo(pb.sx, pb.sy); c.lineTo(ph.sx, ph.sy); c.stroke();
      c.fillStyle = head;
      c.beginPath(); c.arc(pb.sx, pb.sy, 2.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(ph.sx, ph.sy, 5, 0, Math.PI * 2); c.fill();
      c.fillStyle = "rgba(255,255,255," + (0.85 * depthAlpha).toFixed(3) + ")";
      c.beginPath(); c.arc(ph.sx, ph.sy, 1.6, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // the hum bar's per-frame parameters (v1 viz.js:1292–1319, tap-less
    // path: level from the display magnitude, no side ripple — v1's own
    // humTapOk=false degradation)
    function updateHumBar(M, audioT) {
      if (st.humNote && audioT > st.humNote.endTime + 0.15) st.humNote = null;
      if (track !== "library" || !st.humNote) { st.humLevel = 0; return null; }
      var hn = st.humNote;
      var center = clamp(Math.round(hn.of * SPT), 0, TOTAL - 1);
      st.humLevel = st.humLevel * 0.55 + rawMag[center] * 0.45;
      var shape = HUM_VOWEL_SHAPES[hn.vowel] || HUM_VOWEL_SHAPES.uh;
      var halfSamp = Math.max(1, Math.round(HUM_BAR_HALF * shape.width));
      return {
        sL: Math.max(0, center - halfSamp),
        sR: Math.min(TOTAL - 1, center + halfSamp),
        center: center,
        ht: st.humLevel * M.peak * LOLLI_HEIGHT * shape.height,
        shape: shape, vowel: hn.vowel,
      };
    }

    // v1's drawHumBar (viz.js:1475): vertical-edged bar, vowel-shaped top,
    // no bottom edge (the baseline under it is skipped in the quad pass)
    function drawHumBar(G, M, proj, bar, depth) {
      var c = G.ctx;
      var halfSpan = (bar.sR - bar.sL) / 2;
      if (halfSpan < 0.5) halfSpan = 0.5;
      function top(u) {
        var sh2 = bar.shape, pk = sh2.peak;
        if (pk > 0.0001 || pk < -0.0001) {
          var a = u < 0 ? -u : u;
          var s3 = (1 - u * u) * (1 - sh2.pointed) + (1 - a) * sh2.pointed;
          return bar.ht * (1 + pk * s3);
        }
        if (bar.vowel === "oo" && sh2.round > 0.001 && halfSpan > 0) {
          var halfW = halfSpan * (2 * Math.PI * M.R / SPT);
          var rad = sh2.round * Math.min(halfW, bar.ht * 0.95);
          var rFx = halfW > 0 ? rad / halfW : 0;
          var au = u < 0 ? -u : u;
          if (au <= 1 - rFx) return bar.ht;
          var aa = (au - (1 - rFx)) / rFx;
          return bar.ht - rad * (1 - Math.sqrt(Math.max(0, 1 - aa * aa)));
        }
        return bar.ht;
      }
      var pts = [], ML = 12, TT = 26;
      var hL = top(-1), hR = top(1);
      for (var s1 = 0; s1 <= ML; s1++) pts.push([bar.sL, hL * (s1 / ML)]);
      for (var i2 = 0; i2 <= TT; i2++) {
        var u = -1 + 2 * i2 / TT;
        pts.push([bar.center + u * halfSpan, top(u)]);
      }
      for (var s2 = 1; s2 <= ML; s2++) pts.push([bar.sR, hR * (1 - s2 / ML)]);
      c.save();
      c.strokeStyle = spRGBA(pal.spiral.ribbonStroke, 0.9 * depth);
      c.lineWidth = 1.3;
      c.lineJoin = "round";
      c.beginPath();
      for (var p = 0; p < pts.length; p++) {
        var ofr = pts[p][0] / SPT;
        var th = (ofr - Math.floor(ofr)) * 2 * Math.PI;
        var by = (ofr - (OCTAVES - 1) / 2) * M.oct;
        var pr = proj(M.R * Math.cos(th), by + pts[p][1], M.R * Math.sin(th));
        if (p === 0) c.moveTo(pr.sx, pr.sy); else c.lineTo(pr.sx, pr.sy);
      }
      c.stroke();
      c.restore();
    }

    // v1's lo-fi soft-glow star (viz.js:808): posterized rings, 4 spinning
    // rays, flickering specks, bright core — snapped to a 2px grid
    function drawGlintStar(c, sx0, sy0, age, env, depth, R2, rot, sd2, col) {
      var shim = 1 + BOX_SHIM * 0.3 * Math.sin(age * 10 + sd2 * 4);
      var e = env * depth * (shim < 0 ? 0 : shim);
      if (e <= 0.003) return;
      function ca(a) { a = a < 0 ? 0 : (a > 1 ? 1 : a); return "rgba(" + col[0] + "," + col[1] + "," + col[2] + "," + a.toFixed(3) + ")"; }
      var GS = 2, sx = Math.round(sx0 / GS) * GS, sy = Math.round(sy0 / GS) * GS;
      c.save();
      c.globalCompositeOperation = "lighter";
      var rings = 5, maxR = R2 * (0.9 + 0.7 * env);
      for (var k = rings; k >= 1; k--) {
        c.fillStyle = ca(0.15 * e * (1 - (k - 1) / rings));
        c.beginPath(); c.arc(sx, sy, maxR * (k / rings), 0, Math.PI * 2); c.fill();
      }
      var len = R2 * 1.8 * (0.5 + 0.5 * env), wid = R2 * 0.22;
      c.fillStyle = ca(0.85 * e);
      for (var i = 0; i < 4; i++) {
        c.save(); c.translate(sx, sy); c.rotate(rot + i * Math.PI / 2);
        c.beginPath(); c.moveTo(0, -wid); c.lineTo(len, 0); c.lineTo(0, wid); c.closePath();
        c.fill(); c.restore();
      }
      for (var s4 = 0; s4 < 4; s4++) {
        var fl = Math.sin(age * (8 + s4 * 3) + sd2 * 5 + s4);
        if (fl <= 0.55) continue;
        var ang = sd2 * 2 + s4 * 1.9, dist = R2 * (1.1 + 0.5 * ((s4 * 7 + sd2) % 1));
        var px = Math.round((sx + Math.cos(ang) * dist) / GS) * GS;
        var py = Math.round((sy + Math.sin(ang) * dist) / GS) * GS;
        var fa = clamp01(0.7 * e * (fl - 0.55) / 0.45);
        c.fillStyle = "rgba(255,255,255," + fa.toFixed(3) + ")";
        c.fillRect(px - 1, py - 1, GS, GS);
      }
      var coreA = Math.min(1, 0.9 * e);
      c.fillStyle = "rgba(255,255,255," + coreA.toFixed(3) + ")";
      c.beginPath(); c.arc(sx, sy, R2 * 0.2 * (0.6 + env), 0, Math.PI * 2); c.fill();
      c.restore();
    }

    // glint lifecycle + draw (v1 viz.js:1803–1827): bloom, ease-out decay,
    // loudness-set rise off the baseline, depth fade
    function drawGlints(G, M, proj, audioT, list) {
      var col = pal.spiral.ribbonStroke;
      for (var i = list.length - 1; i >= 0; i--) {
        var gl = list[i];
        var age = audioT - gl.t;
        if (age > BOX_GLINT_LIFE) { list.splice(i, 1); continue; }
        if (age < 0) continue;
        var env = age < BOX_GLINT_BLOOM
          ? age / BOX_GLINT_BLOOM
          : Math.pow(1 - (age - BOX_GLINT_BLOOM) / (BOX_GLINT_LIFE - BOX_GLINT_BLOOM), 1.8);
        if (env <= 0.001) continue;
        var th = (gl.of - Math.floor(gl.of)) * 2 * Math.PI;
        var rt = clamp01(age / BOX_GLINT_LIFE);
        var rise = gl.riseFrac * M.peak * (1 - Math.pow(1 - rt, 1.6));
        var gy = (gl.of - (OCTAVES - 1) / 2) * M.oct + rise;
        var gp = proj(M.R * Math.cos(th), gy, M.R * Math.sin(th));
        var dep = clamp(0.3 + 0.7 * (gp.z + M.R) / (2 * M.R), 0.12, 1);
        drawGlintStar(G.ctx, gp.sx, gp.sy, age, env, dep, BOX_GLINT_R,
          gl.seed + gl.dir * BOX_SPIN * age, gl.seed, col);
      }
    }

    // v1's rising bubbles (viz.js:1831–1876): climb with the gliss, buoyant
    // drift after the note, wobble, expand-and-pop
    function drawBubbles(G, M, proj, audioT) {
      var c = G.ctx;
      var col = pal.spiral.ribbonFill;
      c.save();
      for (var i = st.bubbles.length - 1; i >= 0; i--) {
        var bub = st.bubbles[i];
        var age = audioT - bub.t;
        var total = bub.dur + BUBBLE_AFTER;
        if (age > total) { st.bubbles.splice(i, 1); continue; }
        if (age < 0) continue;
        var t01 = clamp01(age / total);
        var bOf;
        if (age < bub.dur) {
          bOf = bub.startOct + (bub.glissEndOct - bub.startOct) * (age / bub.dur);
        } else {
          var aft = clamp01((age - bub.dur) / BUBBLE_AFTER);
          bOf = bub.glissEndOct + (bub.driftTo - bub.glissEndOct) * aft;
        }
        bOf = clamp(bOf, 0, OCTAVES - 0.01);
        var wob = Math.sin(age * 3.2 + bub.phase) * BUBBLE_WOBBLE;
        var th = (bOf - Math.floor(bOf)) * 2 * Math.PI + wob;
        var yB = (bOf - (OCTAVES - 1) / 2) * M.oct;
        var bp = proj(M.R * Math.cos(th), yB, M.R * Math.sin(th));
        var dep = clamp(0.25 + 0.75 * (bp.z + M.R) / (2 * M.R), 0.12, 1);
        var pop = t01 > 0.82 ? (t01 - 0.82) / 0.18 : 0;
        var fade = t01 < 0.1 ? t01 / 0.1 : (1 - pop);
        if (fade <= 0.001) continue;
        var r = bub.r * (1 + 0.25 * Math.sin(age * 2.1 + bub.phase)) * (1 + pop * 1.4);
        var a = fade * dep;
        c.strokeStyle = spRGBA(col, 0.7 * a);
        c.lineWidth = 1.2;
        c.beginPath(); c.arc(bp.sx, bp.sy, r, 0, Math.PI * 2); c.stroke();
        c.fillStyle = spRGBA(col, 0.10 * a);
        c.fill();
        if (pop < 0.5) {
          c.fillStyle = "rgba(255,255,255," + (0.7 * a * (1 - pop * 2)).toFixed(3) + ")";
          c.beginPath();
          c.arc(bp.sx - r * 0.33, bp.sy - r * 0.33, Math.max(0.8, r * 0.18), 0, Math.PI * 2);
          c.fill();
        }
      }
      c.restore();
    }

    function drawPlateData(G, tr, tNow) {
      var c = G.ctx;
      var M = plateMetrics(G);
      var wallS = tNow === undefined ? nowFn() / 1000 : tNow;
      var audioT = aNow();
      var cy1 = Math.cos(camYaw), sy1 = Math.sin(camYaw);
      var cp1 = Math.cos(camPitch), sp1 = Math.sin(camPitch);

      function proj(x, y, z) {
        var x1 = x * cy1 - z * sy1;
        var z1 = x * sy1 + z * cy1;
        var y1 = y * cp1 - z1 * sp1;
        var z2 = y * sp1 + z1 * cp1;
        return { sx: M.CX + x1, sy: M.CY - y1, z: z2 };
      }

      // snapshot the honest spectrum, then notch the overlay voices out of
      // the coil's display — the waves belong to the drones alone
      var i0n;
      for (i0n = 0; i0n < TOTAL; i0n++) rawMag[i0n] = magnitudes[i0n];
      applyOverlayNotches(audioT);

      // ---- v1 overlay lifecycles (viz.js:1252–1322) -----------------------
      var harpOn = false, bassOn = false, harpRadial = 0, bassRadial = 0;
      if (track === "library") {
        st.harpPlucks = st.harpPlucks.filter(function (p) { return audioT - p.t < HARP_LIFETIME; });
        harpOn = st.harpPlucks.length > 0;
        harpRadial = M.oct * (HARP_AMP / 350);   // v1 viz.js:1395
      } else if (track === "ariel") {
        st.bassPlucks = st.bassPlucks.filter(function (p) { return audioT - p.t < BASS_LIFETIME; });
        bassOn = st.bassPlucks.length > 0;
        bassRadial = M.oct * (BASS_AMP / 350);   // v1 viz.js:1396
        updateLollipop(M, audioT);
      }
      var humBar = updateHumBar(M, audioT);

      // ---- project the coil (inner baseline, outer FFT contour — v1: same
      // radius, magnitude extrudes the outer point straight up; the
      // baseline itself vibrates with the harpsichord/bass ripples) --------
      var i, th, yW, m;
      for (i = 0; i <= TOTAL; i++) {
        var ii = i < TOTAL ? i : TOTAL - 1;
        var frac = i / SPT;
        th = (frac % 1) * 2 * Math.PI;
        yW = (frac - (OCTAVES - 1) / 2) * M.oct;
        if (harpOn) yW += rippleDr(st.harpPlucks, HARP_SIGMA_OCT, HARP_TAU, harpRadial, frac, audioT);
        else if (bassOn) yW += rippleDr(st.bassPlucks, BASS_SIGMA_OCT, BASS_TAU, bassRadial, frac, audioT);
        m = magnitudes[ii];
        var xw = M.R * Math.cos(th), zw = M.R * Math.sin(th);
        var x1 = xw * cy1 - zw * sy1, z1 = xw * sy1 + zw * cy1;
        innerX[i] = x1; innerY[i] = yW * cp1 - z1 * sp1; innerZ[i] = yW * sp1 + z1 * cp1;
        var yo = yW + m * M.peak;
        outerX[i] = x1; outerY[i] = yo * cp1 - z1 * sp1; outerZ[i] = yo * sp1 + z1 * cp1;
      }

      // v1 draw order: floor first (the coil occludes it), then the coil
      // with the lollipop + hum bar interleaved at their own depths, then
      // axis text, then the over-the-coil decorations — the whole pass
      // clipped to the night window (A2: the frame is unpaintable)
      var clipped = clipToWindow(c);
      drawConstellationFloor(G, M, proj, audioT);
      drawPhosphorCoil(G, M, proj, humBar);
      drawOctaveAxisAndScale(G, M);

      // ---- per-track live extras ------------------------------------------
      drawNoteMarks(G, M, proj, audioT);
      if (track === "library") drawGlints(G, M, proj, audioT, st.boxGlints);
      if (track === "sycorax") drawPulseMark(G, M, audioT);
      if (track === "ariel") {
        drawGlints(G, M, proj, audioT, st.chimeGlints);
        drawBubbles(G, M, proj, audioT);
        if (wallS < st.ghostLineUntil) drawFlightLine(G, M, proj, true);
        if (st.flightScenes > 0) drawFlightLine(G, M, proj, false);
      }
      if (clipped) c.restore();
    }

    // ---- the v1 phosphor coil (prosperos-jukebox-viz.js:1677–1790): quads
    // z-sorted back-to-front; translucent colored ribbon fill, faint
    // fluctuating top edge, bright fixed baseline, octave notch dots.
    // Depth is alpha fade — the revert's one sanctioned departure from the
    // ink-weight law (owner 2026-07-20: the coil is v1's, verbatim).
    // The whistle lollipop and hum bar interleave into the same depth sort
    // (v1 viz.js:1689–1738) so front coils occlude them correctly.
    function drawPhosphorCoil(G, M, proj, humBar) {
      var c = G.ctx;
      var sp = pal.spiral;
      var f = sp.ribbonFill, s = sp.ribbonStroke, b = sp.baseStroke;
      var i;
      for (i = 0; i < TOTAL; i++) orderZ[i] = (innerZ[i] + innerZ[i + 1]) * 0.5;
      orderArr.sort(function (a, b2) { return orderZ[a] - orderZ[b2]; });
      var denom = M.R * 2;

      // depth markers for the interleaved overlays
      var lolliZ = null, lolliDepth = 1, lolliDrawn = false;
      if (track === "ariel" && st.lolli) {
        var lph = proj(M.R * Math.cos(st.lolli.theta), st.lolli.yHead, M.R * Math.sin(st.lolli.theta));
        lolliZ = lph.z;
        lolliDepth = clamp(0.20 + 0.80 * (lolliZ + M.R) / denom, 0.10, 1);
      }
      var barZ = null, barDepth = 1, barDrawn = false;
      if (humBar) {
        barZ = innerZ[humBar.center];
        barDepth = clamp(0.35 + 0.65 * (barZ + M.R) / denom, 0.15, 1);
      }

      for (var q = 0; q < TOTAL; q++) {
        i = orderArr[q];
        var zAvg = orderZ[i];
        if (lolliZ !== null && !lolliDrawn && zAvg >= lolliZ) {
          drawLollipop(G, M, proj, lolliDepth);
          lolliDrawn = true;
        }
        if (barZ !== null && !barDrawn && zAvg >= barZ) {
          drawHumBar(G, M, proj, humBar, barDepth);
          barDrawn = true;
        }
        var depth = 0.35 + 0.65 * (zAvg + M.R) / denom;
        if (depth < 0.15) depth = 0.15; else if (depth > 1) depth = 1;
        var ix0 = innerX[i] + M.CX, iy0 = M.CY - innerY[i];
        var ix1 = innerX[i + 1] + M.CX, iy1 = M.CY - innerY[i + 1];
        var ox0 = outerX[i] + M.CX, oy0 = M.CY - outerY[i];
        var ox1 = outerX[i + 1] + M.CX, oy1 = M.CY - outerY[i + 1];
        // ribbon fill
        c.beginPath();
        c.moveTo(ix0, iy0); c.lineTo(ox0, oy0); c.lineTo(ox1, oy1); c.lineTo(ix1, iy1);
        c.closePath();
        c.fillStyle = spRGBA(f, 0.28 * depth);
        c.fill();
        // fluctuating top edge — thin and faint; the emphasis is the baseline
        c.beginPath(); c.moveTo(ox0, oy0); c.lineTo(ox1, oy1);
        c.strokeStyle = spRGBA(b, 0.25 * depth); c.lineWidth = 0.6; c.stroke();
        // the fixed baseline — the emphasized line, skipped under the hum
        // bar (its vertical edges replace it; v1 viz.js:1771)
        if (!(humBar && i >= humBar.sL && i < humBar.sR)) {
          c.beginPath(); c.moveTo(ix0, iy0); c.lineTo(ix1, iy1);
          c.strokeStyle = spRGBA(s, 0.9 * depth); c.lineWidth = 1.3; c.stroke();
        }
        // octave-boundary notch dot, inside the depth sort
        if (i % SPT === 0 && i !== 0) {
          c.beginPath(); c.arc(ix0, iy0, 2, 0, Math.PI * 2);
          c.fillStyle = spRGBA(s, 0.9 * depth); c.fill();
        }
      }
      // overlays that sat in front of every quad
      if (lolliZ !== null && !lolliDrawn) drawLollipop(G, M, proj, lolliDepth);
      if (barZ !== null && !barDrawn) drawHumBar(G, M, proj, humBar, barDepth);
    }

    // ---- the v1 constellation floor (prosperos-jukebox-viz.js:1506–1675 +
    // 1878–1915): the drones charted on a clock-face plane beneath the coil
    // — chromatic spokes, outer ring, per-drone standing-wave halo rings,
    // consonance-weighted interval lines + labels, harmonic dots, sub dots,
    // and note-name ring labels tinted by live in-key membership. Fed by
    // the engines' drone-class note events (freq/oct/durS — D4).
    function drawConstellationFloor(G, M, proj, audioT) {
      var c = G.ctx;
      var sp = pal.spiral;
      // v1 hung the floor 0.55 oct below the coil; the windowed plate is
      // tighter vertically, so it rides a touch higher here
      var floorY = -((OCTAVES - 1) / 2) * M.oct - M.oct * 0.45;
      var constMaxR = M.R;
      var haloMaxR = M.R * 0.20;
      var live = liveDrones(audioT);
      var mains = [], subs = [], i, j, d;
      for (i = 0; i < live.length; i++) {
        d = live[i];
        if (!d.freq) continue;
        if (d.sub) subs.push(d); else mains.push(d);
      }

      // chromatic spokes
      c.strokeStyle = "rgba(" + sp.constFg + ",0.13)";
      c.lineWidth = 1;
      var centerP = proj(0, floorY, 0);
      for (var si = 0; si < 12; si++) {
        var sa = (si / 12) * 2 * Math.PI;
        var endP = proj(constMaxR * Math.cos(sa), floorY, constMaxR * Math.sin(sa));
        c.beginPath(); c.moveTo(centerP.sx, centerP.sy); c.lineTo(endP.sx, endP.sy); c.stroke();
      }
      // outer ring
      c.strokeStyle = "rgba(" + sp.constFg + ",0.20)";
      c.beginPath();
      for (var ri = 0; ri <= 64; ri++) {
        var ra = (ri / 64) * 2 * Math.PI;
        var rp = proj(constMaxR * Math.cos(ra), floorY, constMaxR * Math.sin(ra));
        if (ri === 0) c.moveTo(rp.sx, rp.sy); else c.lineTo(rp.sx, rp.sy);
      }
      c.stroke();

      // halo waveforms per drone — additive; expanding rings that morph into
      // standing waves shaped by the drone's triangle-harmonic partials
      c.globalCompositeOperation = "lighter";
      for (i = 0; i < mains.length; i++) {
        d = mains[i];
        var intensity = droneIntensity(d, audioT);
        if (intensity === 0) continue;
        var visI = Math.min(1, intensity * 1.7);
        var progress = clamp01((audioT - d.t0) / Math.max(0.001, d.until - d.t0));
        var baseRingR = progress * haloMaxR;
        var node = constNodeWorld(d.freq, constMaxR);
        var partials = triangleHarmonics(d.freq, HARMONIC_FREQ_CEILING);
        c.strokeStyle = "rgba(" + sp.constFg + "," + (visI * 0.85).toFixed(3) + ")";
        c.lineWidth = 0.5 + 0.8 * visI;
        if (!partials.length || baseRingR < haloMaxR * 0.04) {
          c.beginPath();
          for (var cs = 0; cs <= 48; cs++) {
            var ca = (cs / 48) * 2 * Math.PI;
            var cp = proj(node.x + baseRingR * Math.cos(ca), floorY, node.z + baseRingR * Math.sin(ca));
            if (cs === 0) c.moveTo(cp.sx, cp.sy); else c.lineTo(cp.sx, cp.sy);
          }
          c.stroke();
        } else {
          var fMin = partials[0].freq;
          var waveAmp = baseRingR * HALO_WAVE_AMP_FRAC;
          c.beginPath();
          for (var kk = 0; kk <= HALO_WAVE_POINTS; kk++) {
            var hth = (kk / HALO_WAVE_POINTS) * 2 * Math.PI;
            var disp = 0;
            for (var pp = 0; pp < partials.length; pp++) {
              var part = partials[pp];
              var spatialK = HALO_WAVELENGTHS * part.freq / fMin;
              var omegaT = (2 * Math.PI * part.freq / HALO_SLOWDOWN) * audioT;
              disp += intensity * part.relAmp * Math.sin(spatialK * hth) * Math.cos(omegaT);
            }
            var hr = baseRingR + disp * waveAmp;
            var hp = proj(node.x + hr * Math.cos(hth), floorY, node.z + hr * Math.sin(hth));
            if (kk === 0) c.moveTo(hp.sx, hp.sy); else c.lineTo(hp.sx, hp.sy);
          }
          c.closePath();
          c.stroke();
        }
      }
      c.globalCompositeOperation = "source-over";

      // consonance-weighted interval lines between concurrent drones
      for (i = 0; i < mains.length; i++) {
        for (j = i + 1; j < mains.length; j++) {
          var pairI = Math.min(droneIntensity(mains[i], audioT), droneIntensity(mains[j], audioT));
          if (pairI === 0) continue;
          var sem = intervalSemitones(mains[i].freq, mains[j].freq);
          var cons = CONSONANCE[sem] != null ? CONSONANCE[sem] : 0.5;
          var alpha = pairI * (0.6 + cons * 0.4);
          if (alpha < 0.02) continue;
          var nA = constNodeWorld(mains[i].freq, constMaxR);
          var nB = constNodeWorld(mains[j].freq, constMaxR);
          var pA = proj(nA.x, floorY, nA.z), pB = proj(nB.x, floorY, nB.z);
          c.strokeStyle = "rgba(" + sp.constFg + "," + alpha.toFixed(3) + ")";
          c.lineWidth = 0.5 + cons * 1.0;
          c.beginPath(); c.moveTo(pA.sx, pA.sy); c.lineTo(pB.sx, pB.sy); c.stroke();
        }
      }

      // harmonic dots (2nd/3rd partials of each drone)
      for (i = 0; i < mains.length; i++) {
        var hInt = droneIntensity(mains[i], audioT);
        if (hInt === 0) continue;
        var harms = triangleHarmonics(mains[i].freq, 4000);
        for (var hi = 1; hi < Math.min(3, harms.length); hi++) {
          var ha = hInt * harms[hi].relAmp;
          if (ha < 0.02) continue;
          var hn = constNodeWorld(harms[hi].freq, constMaxR);
          var hpp = proj(hn.x, floorY, hn.z);
          c.fillStyle = "rgba(" + sp.constFg + "," + (ha * 0.55).toFixed(3) + ")";
          c.beginPath(); c.arc(hpp.sx, hpp.sy, 1.5 + ha * 2, 0, Math.PI * 2); c.fill();
        }
      }

      // drone nodes + sub-octave dots
      for (i = 0; i < mains.length; i++) {
        var nInt = droneIntensity(mains[i], audioT);
        if (nInt === 0) continue;
        var pn = constNodeWorld(mains[i].freq, constMaxR);
        var pnP = proj(pn.x, floorY, pn.z);
        c.fillStyle = "rgba(" + sp.constFg + "," + nInt.toFixed(3) + ")";
        c.beginPath(); c.arc(pnP.sx, pnP.sy, 1.5 + nInt * 2, 0, Math.PI * 2); c.fill();
      }
      for (i = 0; i < subs.length; i++) {
        var sInt = droneIntensity(subs[i], audioT) * 0.85;
        if (sInt === 0) continue;
        var sn = constNodeWorld(subs[i].freq, constMaxR);
        var snP = proj(sn.x, floorY, sn.z);
        c.fillStyle = "rgba(" + sp.constSub + "," + sInt.toFixed(3) + ")";
        c.beginPath(); c.arc(snP.sx, snP.sy, 1.5 + sInt * 2, 0, Math.PI * 2); c.fill();
      }

      if (!fontsReady) return;

      // pitch-class ring labels — v1's flats, in-key vs out-of-key tinted
      var labelR = constMaxR * 1.10;
      var inKey = inKeyAbsPc();
      c.font = '12px "VT323", monospace';
      c.textAlign = "center";
      c.textBaseline = "middle";
      for (var pli = 0; pli < 12; pli++) {
        var pla = (pli / 12) * 2 * Math.PI;
        var plp = proj(labelR * Math.cos(pla), floorY, labelR * Math.sin(pla));
        c.fillStyle = spRGBA(inKey[pli] ? sp.inKeyLabel : sp.outKeyLabel, 0.95);
        c.fillText(CONST_PITCH_LABELS[pli], plp.sx, plp.sy);
      }

      // interval labels at pair midpoints, on a dark backing
      for (i = 0; i < mains.length; i++) {
        for (j = i + 1; j < mains.length; j++) {
          var lI = Math.min(droneIntensity(mains[i], audioT), droneIntensity(mains[j], audioT));
          if (lI < 0.1) continue;
          var lbl = INTERVAL_NAMES[intervalSemitones(mains[i].freq, mains[j].freq)] || "";
          if (!lbl) continue;
          var nA2 = constNodeWorld(mains[i].freq, constMaxR);
          var nB2 = constNodeWorld(mains[j].freq, constMaxR);
          var mp = proj((nA2.x + nB2.x) * 0.5, floorY, (nA2.z + nB2.z) * 0.5);
          var tw = c.measureText(lbl).width;
          c.fillStyle = "rgba(5,6,10,0.85)";
          c.fillRect(mp.sx - tw / 2 - 4, mp.sy - 9, tw + 8, 16);
          c.fillStyle = "rgba(" + sp.constFg + "," + (0.55 + lI * 0.35).toFixed(3) + ")";
          c.fillText(lbl, mp.sx, mp.sy);
        }
      }
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
    }

    // (the theme staff drew here, in the night window's top-left corner,
    // as a two-to-four-line degree grid; owner 2026-08-16 moved it into
    // the margin apparatus and rebuilt it as a real five-line staff —
    // see drawThemeStaff in the MARGIN section below.)

    // ---- the v1 octave axis + scale caption (prosperos-jukebox-viz.js:
    // 1917–1950): C1…C7 ticks on the left, billboarded (tracks camera pitch
    // only, never yaw), and the scale name at the coil's top-right — both
    // inside the night window. Replaces the roman seam numerals (owner
    // 2026-07-20: no roman numerals for now).
    function drawOctaveAxisAndScale(G, M) {
      if (!fontsReady) return;
      var c = G.ctx;
      var sp = pal.spiral;
      var o = sp.octaveLabel;
      var cp1 = Math.cos(camPitch);
      var tickX = M.CX - M.R - 28, labelX = tickX - 8, capW = 4;
      c.font = '13px "VT323", monospace';
      c.textAlign = "right";
      c.textBaseline = "middle";
      c.strokeStyle = spRGBA(o, 0.45);
      c.lineWidth = 1;
      c.fillStyle = spRGBA(o, 0.85);
      for (var oi = 0; oi < OCTAVES; oi++) {
        var yStart = (oi - (OCTAVES - 1) / 2) * M.oct;
        var yEnd = (oi + 1 - (OCTAVES - 1) / 2) * M.oct;
        var sStart = M.CY - yStart * cp1;
        var sEnd = M.CY - yEnd * cp1;
        c.beginPath();
        c.moveTo(tickX, sStart); c.lineTo(tickX, sEnd);
        c.moveTo(tickX - capW, sStart); c.lineTo(tickX + capW, sStart);
        c.moveTo(tickX - capW, sEnd); c.lineTo(tickX + capW, sEnd);
        c.stroke();
        c.fillText(cfg.anchorName + (BASE_OCTAVE + oi), labelX, M.CY - (yStart + yEnd) * 0.5 * cp1);
      }
      // (the scale caption — "C dorian" et al — was removed here, owner
      // 2026-07-27; the octave ticks above still name the anchor pitch)
      c.textAlign = "left";
      c.textBaseline = "alphabetic";
    }

    // ---- note-driven overlay marks (positions/magnitudes at full res) -----
    function drawNoteMarks(G, M, proj, audioT) {
      var c = G.ctx;
      var keep = [];
      for (var i = 0; i < st.marks.length; i++) {
        var mk = st.marks[i];
        var age = audioT - mk.t;
        if (age > mk.life) continue;
        keep.push(mk);
        if (age < 0) continue; // scheduled ahead — not yet sounded
        var p01 = age / mk.life;
        var th = (mk.of % 1) * 2 * Math.PI;
        var yW = (mk.of - (OCTAVES - 1) / 2) * M.oct;
        var iC = Math.min(TOTAL - 1, Math.max(0, Math.round(mk.of * SPT)));
        var pt, dep;
        if (mk.kind === "cutline") {
          // the chant/rebec/boneflute cut — the block's living mark: a bone
          // stroke riding the contour at the note's pitch
          var yC = yW + rawMag[iC] * M.peak;
          pt = proj(M.R * Math.cos(th), yC, M.R * Math.sin(th));
          c.strokeStyle = dataCol(pal.bone[0], "grimoire living line");
          c.lineWidth = 2.2 * (1 - p01 * 0.6);
          c.beginPath(); c.moveTo(pt.sx - 7, pt.sy); c.lineTo(pt.sx + 7, pt.sy - 2); c.stroke();
        } else if (mk.kind === "tine") {
          pt = proj(M.R * Math.cos(th), yW + M.peak * 0.25 * (1 - p01), M.R * Math.sin(th));
          c.strokeStyle = dataCol(pal.witch ? pal.witch[1] : pal.bone[0], "waterphone tine");
          c.lineWidth = 1;
          c.beginPath(); c.arc(pt.sx, pt.sy, 3 + 4 * p01, 0, Math.PI * 2); c.stroke();
        } else if (mk.kind === "wing") {
          pt = proj(M.R * Math.cos(th), yW + M.peak * 0.3, M.R * Math.sin(th));
          c.strokeStyle = dataCol(pal.sky[1], "flutter wing");
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(pt.sx - 5, pt.sy + 3); c.lineTo(pt.sx, pt.sy - 2); c.lineTo(pt.sx + 5, pt.sy + 3);
          c.stroke();
        }
      }
      st.marks = keep;
    }

    // sycorax: the proto-drum's lone pulse mark — keeps printing in the hush
    function drawPulseMark(G, M, audioT) {
      var c = G.ctx;
      var px = M.CX - M.oct * 3.3, py = M.CY + M.oct * 2.7;
      var beat = Math.max(0, 1 - (audioT - st.pulseAt) / 0.5);
      c.strokeStyle = dataCol(pal.bone[0], "proto-drum ring");
      c.lineWidth = 1.8;
      c.beginPath();
      for (var a = 0; a <= 34; a++) {
        var th = 0.5 + (a / 34) * Math.PI * 1.8;
        var wob = 1 + 0.03 * Math.sin(a * 1.7);
        var x = px + 17 * wob * Math.cos(th), y = py + 17 * wob * Math.sin(th) * 0.94;
        if (a === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
      // lub-dub: strike + echo, swelling on the beat
      c.fillStyle = pal.bone[0];
      c.beginPath(); c.arc(px - 4, py + 1, 4.2 + 2.4 * beat, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(px + 6, py - 3, 2.2 + 1.2 * beat, 0, Math.PI * 2); c.fill();
      if (beat > 0) {
        c.strokeStyle = rgba(pal.bone[1], 0.9 * beat); c.lineWidth = 1.4;
        for (var k = 0; k < 3; k++) {
          var ta = -Math.PI / 2 + (k - 1) * 0.6;
          c.beginPath();
          c.moveTo(px + Math.cos(ta) * 21, py + Math.sin(ta) * 20);
          c.lineTo(px + Math.cos(ta) * (24 + 6 * beat), py + Math.sin(ta) * (23 + 6 * beat));
          c.stroke();
        }
      }
    }

    // ariel: dotted flight-line arcing up the coil; tonight gilt, the ghost
    // (prior evening) in deep silver beneath. Legs = scenes so far.
    function drawFlightLine(G, M, proj, ghost) {
      var c = G.ctx;
      var progress = ghost ? 1 : clamp01((st.sceneIdx + (lastInfo.x || 0)) / Math.max(1, st.sceneCount || 3));
      var oct0 = ghost ? 1.05 : 1.15, oct1 = ghost ? 4.5 : 5.0;
      var rr = M.R * (ghost ? 1.14 : 1.22);
      var phase = ghost ? 1.1 : 0;
      var N = 220;
      var maxI = Math.round(N * progress);
      for (var i = 0; i <= maxI; i++) {
        if (i % 2 === 1) continue;
        var t = i / N;
        var of = oct0 + (oct1 - oct0) * (t * t * (3 - 2 * t));
        var th = (of % 1) * 2 * Math.PI + phase;
        var yW = (of - (OCTAVES - 1) / 2) * M.oct;
        var pt = proj(rr * Math.cos(th), yW, rr * Math.sin(th));
        if (pt.z / M.R < -0.75) continue;
        c.fillStyle = ghost ? pal.silver[2] : (pt.z / M.R > -0.15 ? pal.gilt[0] : pal.gilt[1]);
        var s = ghost ? 1.8 : (pt.z / M.R > 0 ? 3 : 2.2);
        c.fillRect(pt.sx - s / 2, pt.sy - s / 2, s, s);
        // leg junctions: gilt stars at scene boundaries
        if (!ghost && st.sceneCount > 1) {
          for (var L = 1; L < st.sceneCount; L++) {
            if (i === Math.round(N * L / st.sceneCount)) Skin.star4(c, pt.sx, pt.sy, 3.2, pal.gilt[0]);
          }
        }
      }
    }

    // ============================================================== MARGIN ==
    // The apparatus panels. Furniture = frames, headings, the tree (event-
    // grade, invalidated on change); data = the live dials each frame.
    //
    // COLLISION-PROOF LAYOUT LAW (final-gate ruling — the assembled page's
    // margin canvas is 402×330, HALF the bench height, and fixed offsets
    // collided there): every panel is fixed rows — heading (caption baseline
    // y+11, rule y+15), the CONTENT CELL (y+20 … y+h−14 for dial panels),
    // and the readout baseline (y+h−3, one line, nowhere else). Row panels
    // are a single inline content line (icons + value side by side, no
    // readout row). Stamps are FIT-SCALED to their cell — never a fixed
    // scale — so no canvas height can push an emblem into its own heading
    // or readout. Idle (no scene / no info) renders deliberate em-dash
    // placeholders, never bare value fragments.
    // The slots, STACKED with real gaps between them (owner 2026-08-08).
    // They used to be independent fractions of the height, and they did not
    // quite tile: the scene band ran to 0.17H while the dials began at 0.19H,
    // so at 330px the band's last 1.4px lay inside the dials' slot. Nothing
    // was drawn there, so nothing showed — until every slot became a window
    // with a feathered lip, and the scene's progress bar started colliding
    // with the tops of the dial windows.
    //
    // So the layout is now a sequence: each slot takes its height, then a
    // fixed GAP of clear paper before the next. The gap has to survive two
    // window lips (2px each) plus the 2px each window is lifted above its
    // heading, hence 10.
    var MARGIN_GAP = 10;
    function marginLayout(G) {
      var H = G.h, W = G.w, pad = 8, gap = MARGIN_GAP;
      var half = (W - 3 * pad) / 2, full = W - 2 * pad, right = pad * 2 + half;
      // the scene band and the staff SHARE the top row (owner 2026-08-16:
      // neither earned full width — the band's three stacked lines and the
      // stave's short phrase both live happily in a half). The row's height
      // is the staff's need: five lines plus ledger air, a heading above,
      // the readout below.
      // (the rowA/rowB pair that sat between the dials and the tree — the
      // air/chord, pose/tallies, constellation/season rows — is REMOVED,
      // owner 2026-08-17: they never explained themselves and weren't
      // pulling their weight. Three rows remain: scene+staff, dials, tree.)
      var topH = Math.round(H * 0.23);
      var dialH = Math.round(H * 0.21);
      var y = pad;
      var scene = { x: pad, y: y, w: half, h: topH };
      var staff = { x: right, y: y, w: half, h: topH };
      y += topH + gap;
      var dialA = { x: pad, y: y, w: half, h: dialH };
      var dialB = { x: right, y: y, w: half, h: dialH };
      y += dialH + gap;
      var tree = { x: pad, y: y, w: full, h: Math.max(40, H - pad - y) };
      return {
        pad: pad, W: W, H: H,
        scene: scene, staff: staff, dialA: dialA, dialB: dialB, tree: tree,
      };
    }
    // the content cell between heading row and readout row (dial panels);
    // the 18 reserves the readout line's room INSIDE the window (its
    // baseline prints at h−6, caps to ~h−16) — content stops above it
    function cellOf(r) {
      var top = r.y + 20, bot = r.y + r.h - 18;
      if (bot < top + 8) bot = top + 8;
      return { top: top, bot: bot, cy: (top + bot) / 2, ch: bot - top };
    }
    // largest integer stamp scale whose rendered height fits `avail` CSS px
    function fitScale(bmpPx, avail, u) {
      var s = Math.floor(avail / (bmpPx * (u || 2)));
      return s < 1 ? 1 : s;
    }
    // the margin apparatus ink roles — promoted into the registry's uniform
    // layer (pj2-skin.js finalizePalette): every palette carries `margin`
    // ({cap, rule, lead, mid, accent}) for its own track and binding.
    function marginInk() { return pal.margin; }
    // (pageMarginInk — the binding-following ink for text printed on the
    // paper itself — retired 2026-08-16 with the last paper-side text: the
    // readouts moved inside their windows, so every line in the apparatus
    // now takes the window surface's ink.)

    // The panel heading and its rule live INSIDE the panel's window (owner
    // 2026-08-08), so they take the ink of the surface being drawn — the
    // window's — not the page's.
    function panelHead(G, r, text) {
      if (!fontsReady) return;
      var c = G.ctx;
      var ic = marginInk();
      // the heading must never leave its slot — a half-width panel's
      // neighbour starts 8px away. Measure in the caption face (plus the
      // 2px tracking smallCaps adds per letter) and pare back to an
      // ellipsis if a fallback face runs wide.
      var t = String(text);
      c.save();
      c.font = '13px ' + Skin.Type.MONO;
      function headW(s) { return c.measureText(String(s).toUpperCase()).width + s.length * 2; }
      if (headW(t) > r.w - 4) {
        while (t.length > 1 && headW(t + "…") > r.w - 4) t = t.slice(0, t.length - 1);
        t += "…";
      }
      c.restore();
      Skin.Type.smallCaps(c, t, r.x, r.y + 11, 13, ic.cap, 2);
      c.strokeStyle = ic.rule; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r.x, r.y + 15); c.lineTo(r.x + r.w, r.y + 15); c.stroke();
    }
    // the readout baseline — the panel's one value line, printed INSIDE
    // its window just above the lower lip. It used to sit on the paper
    // BELOW the window; on the parchment page "tide 0.45 · candlelit"
    // orphaned outside the tide's black container read as information
    // that had lost its box (owner 2026-08-16).
    function readoutLine(G, r, text) {
      if (!fontsReady) return;
      Skin.Type.smallCaps(G.ctx, text, r.x, r.y + r.h - 6, 12, marginInk().mid, 1);
    }

    // THE HARMONY READOUT (PLAN-HARMONY-READOUT, 2026-08-21): the harmony
    // brain's live line — the one brain the margin didn't show. Composed
    // from the getInfo() poll (info.harmony / harmonyTones / pose /
    // cadence / seaChange / sink / mode / tonicHz): line 1 is the current
    // chord (library: name + spelled tones; ariel: name + mode + tonic —
    // the tonic is live information on a track that re-grounds nightly) or
    // Sycorax's pose; line 2 is the approach (a planned cadence's label +
    // countdown) or the state (the fired sea change's new ground, kept
    // until the next performance; the sink, planned/done). Stopped or
    // silent: null — nothing draws, no stale chord frozen on the plate.
    function harmonyLines(info) {
      if (!info || !info.playing) return null;
      var l1 = null, l2 = null;
      if (track === "sycorax") {
        // no cadences by construction; the sink is the pose track's sea change
        if (info.pose) l1 = "pose · " + info.pose;
        if (info.sink && info.sink.planned) l2 = "the sink · " + (info.sink.done ? "done" : "planned");
      } else {
        if (info.harmony) {
          l1 = String(info.harmony);
          if (track === "ariel") {
            if (info.mode) l1 += " · " + info.mode + (isFinite(info.tonicHz) ? " " + Math.round(info.tonicHz) : "");
          } else if (info.harmonyTones) {
            l1 += " · " + info.harmonyTones;
          }
        }
        if (info.cadence && info.cadence.label != null) {
          l2 = String(info.cadence.label).toLowerCase() + " in " + Math.ceil(Math.max(0, info.cadence.inS || 0)) + "s";
        } else if (info.seaChange && info.seaChange.done && info.seaChange.label) {
          l2 = "sea change → " + info.seaChange.label;
        }
      }
      if (!l1 && !l2) return null;
      return [l1, l2];
    }

    // ---- THE APPARATUS WINDOWS (owner 2026-08-08) ----------------------------
    // On the parchment binding each panel sits WHOLE in its own night
    // window cut into the sheet — the same kind of opening as the spiral's
    // plate zone. Heading, content and readout all live inside it (the
    // readouts joined them 2026-08-16 — nothing of a panel prints on the
    // paper anymore). So a panel draws with the NIGHT palette even while
    // the page is parchment: the genealogy in amber on black, exactly as
    // the night folio draws it, rather than iron gall on a hole in the page.
    //
    // Skin's mode is global (palette, atlas AND the dataInk tripwire all read
    // it), so the switch is scoped: flip, draw, restore in a finally. On the
    // night binding there is nothing to flip and this is a plain call.
    // The mode the SURFACE being drawn is in — which is not the page's
    // binding once windows exist (a parchment page holds night windows).
    // Every ink decision must follow the surface; only paper choice and
    // window geometry follow the page.
    function inkMode() { return Skin.getMode ? Skin.getMode() : binding; }

    function inWindowInk(fn) {
      if (binding !== "parchment") { fn(); return; }
      var pagePal = pal, pageAt = at;
      Skin.setMode("night");
      pal = Skin.palette(track); at = Skin.atlas(track);
      try {
        fn();
      } finally {
        Skin.setMode("parchment");
        pal = pagePal; at = pageAt;
      }
    }

    // What a panel DRAWS into, as distinct from the slot it occupies. On the
    // parchment binding the slot is a black window, and everything in it —
    // heading, rule, dial, the tree's caption — needs a margin from that
    // black edge, so the drawing rect is inset while the WINDOW keeps the
    // full slot. On the night binding there is no window and nothing moves.
    //
    // HORIZONTAL ONLY, deliberately. An earlier version also took 3px off the
    // top and the height, which is invisible until you notice that panels
    // test their own remaining height before drawing a second line — Ariel's
    // season panel asks for 22px and had 21.2 — and the "gen · deepest"
    // readout silently vanished. Vertical air comes from lifting the WINDOW
    // instead (panelWindow), which no renderer measures.
    function panelContentRect(r) {
      if (binding !== "parchment") return r;
      return { x: r.x + 5, y: r.y, w: r.w - 10, h: r.h };
    }

    // The window a slot occupies. It covers the slot from above its heading
    // caps down to `bottomInset` short of the foot — what the slot must leave
    // clear there: 2 for the panels (readouts included — every line of a
    // panel draws inside its window now, owner 2026-08-16), 0 for the scene
    // band and the tree, whose content runs to the slot's very foot.
    // Width is the slot's exactly: the 8px between the two columns is all
    // that keeps their windows (and their lips) apart.
    function panelWindow(r, bottomInset) {
      var top = r.y - 2;                         // air above the heading caps (top ≈ r.y+2)
      var bot = r.y + r.h - bottomInset;
      if (bot < top + 8) bot = top + 8;
      var h = bot - top;
      return {
        cx: r.x + r.w / 2, cy: top + h / 2, rx: r.w / 2, ry: h / 2,
        r: Math.max(3, Math.min(6, Math.round(Math.min(r.w, h) * 0.08))),
      };
    }
    function fmt2(v) { return v == null ? "—" : v.toFixed(2); }
    function hasScene() {
      return !!(st.sceneLabel || st.sceneType || lastInfo.sceneLabel || lastInfo.sceneType);
    }

    function drawMarginFurniture(G) {
      var L = marginLayout(G);
      var c = G.ctx;
      var hs = hasScene();
      var label = st.sceneLabel || lastInfo.sceneLabel || st.sceneType || lastInfo.sceneType;
      // (the air/chord, pose/tallies and constellation/season rows that sat
      // between the dials and the tree are gone — owner 2026-08-17)
      var heads = track === "library"
        ? ["the tide · volvelle", "the athanor · fire", "genealogia motivi"]
        : (track === "sycorax"
          ? ["the treeline · tide", "the smoke · intensity", "the cord and bone"]
          : ["the wind-rose · tide", "the quadrant · altitude", "migratio · the signature"]);
      // the staff panel's heading, in each book's fiction
      var staffHead = track === "library" ? "thema · the staff"
        : (track === "sycorax" ? "the chant · its staff" : "the song · its staff");

      // EVERY slot is a window now, the scene band included (owner
      // 2026-08-08), so the whole apparatus draws in window ink — the
      // operation label and its emblem, the four headings with their rules,
      // and the genealogy / tally cord / migration map (furniture-grade:
      // redrawn only when an event changes it).
      inWindowInk(function () {
        var S = panelContentRect(L.scene);
        // heading font fits the scene band; the clamp keeps the baseline
        // (y+4+hf) and its descenders clear of the sub-line row's caps
        // (drawn by the data pass at y+h−12) — at 0.5/30 the g's and p's
        // sat on the sub-line in every book
        var hf = Math.max(16, Math.min(22, Math.floor(S.h * 0.42)));
        var emblemCell = 0;
        if (hs && track === "library") {
          var opName = "op-" + String(label).toLowerCase();
          if (at.has(opName)) {
            // the operation emblem sits in its OWN reserved cell left of the
            // heading, fit-scaled to the band — never under the letters
            var eScale = fitScale(16, Math.min(S.h - 8, hf + 14), G.u);
            var eW = 16 * G.u * eScale;
            at.stamp(c, opName, S.x + eW / 2, S.y + 4 + hf / 2, { u: G.u, scale: eScale });
            emblemCell = eW + 8;
          }
        }
        if (fontsReady) {
          if (hs) {
            Skin.Type.drawHeader(c, track, String(label), S.x + emblemCell, S.y + 4 + hf, hf, { u: G.u });
          } else {
            // idle: a deliberate em-dash placeholder in the caption voice —
            // never the display face's rubricated initial on a bare dash
            Skin.Type.smallCaps(c, "—", S.x, S.y + 4 + hf * 0.7, 15, marginInk().cap, 2);
          }
        }
        if (hs && track === "sycorax") drawStationVignette(G, S);

        panelHead(G, panelContentRect(L.staff), staffHead);
        panelHead(G, panelContentRect(L.dialA), heads[0]);
        panelHead(G, panelContentRect(L.dialB), heads[1]);
        panelHead(G, panelContentRect(L.tree), heads[2]);
        var T = panelContentRect(L.tree);
        if (track === "library") drawGenealogy(G, T);
        else if (track === "sycorax") drawTallyCord(G, T);
        else drawMigration(G, T);
      });
    }

    // the five stations of the rite — small woodcut vignettes keyed by scene
    function drawStationVignette(G, r) {
      var c = G.ctx;
      var h = Math.min(36, r.h - 16), w = 56;
      var x = r.x + r.w - w - 8, y = r.y + 4;
      if (h < 20) return; // no room for a vignette — the heading carries it
      c.strokeStyle = pal.bone[2]; c.lineWidth = 1;
      c.strokeRect(x, y, w, h);
      var ty = y + h - 8;
      c.strokeStyle = pal.bone[1]; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(x + 4, ty); c.lineTo(x + w - 4, ty); c.stroke();
      var sc = st.sceneType || "";
      c.fillStyle = pal.bone[0];
      if (sc === "gathering") {          // gathering fire
        c.beginPath(); c.moveTo(x + w / 2, ty - 14); c.lineTo(x + w / 2 - 6, ty); c.lineTo(x + w / 2 + 6, ty); c.closePath(); c.fill();
        c.fillStyle = pal.blood[1]; c.fillRect(x + w / 2 - 1, ty - 18, 2, 4);
      } else if (sc === "processional") { // walking strokes
        for (var k = 0; k < 4; k++) {
          c.beginPath(); c.moveTo(x + 10 + k * 11, ty); c.lineTo(x + 14 + k * 11, ty - 12); c.stroke();
        }
      } else if (sc === "invocation") {   // the raised staff
        c.beginPath(); c.moveTo(x + w / 2, ty); c.lineTo(x + w / 2, ty - 24); c.stroke();
        c.beginPath(); c.arc(x + w / 2, ty - 27, 3, 0, Math.PI * 2); c.stroke();
      } else if (sc === "afterimage") {   // embers
        for (var e = 0; e < 5; e++) {
          c.fillStyle = e % 2 ? pal.blood[0] : pal.bone[2];
          c.fillRect(x + 8 + e * 9, ty - 3 - (e % 3) * 3, 2, 2);
        }
      } else {                            // the circle
        c.beginPath(); c.arc(x + w / 2, ty - 8, 9, 0, Math.PI * 2); c.stroke();
      }
    }

    function drawMarginData(G, tr, tNow) {
      var c = G.ctx;
      var L = marginLayout(G);
      var info = lastInfo || {};
      // Every slot is a window, so the whole data pass is window ink. (The
      // dials' readout lines are the exception and handle themselves:
      // readoutLine always takes the page's ink, since it prints on the
      // paper below its window.)
      inWindowInk(function () {
        var ic = marginInk();
        var S = panelContentRect(L.scene);
        // scene sub-line + progress: only once a scene exists. Idle renders
        // NOTHING here (final-gate ruling: no bare "— · x 0.00" fragments).
        if (hasScene()) {
          var x01 = info.x || 0;
          var py = S.y + S.h - 5;
          if (x01 > 0) {
            c.strokeStyle = dataCol(ic.lead, "scene progress"); c.lineWidth = 2;
            c.beginPath(); c.moveTo(S.x, py); c.lineTo(S.x + S.w * x01, py); c.stroke();
          }
          c.fillStyle = ic.rule;
          for (var px = S.x + S.w * x01 + 6; px < S.x + S.w - 2; px += 6) c.fillRect(px, py - 1, 2, 2);
          if (fontsReady) {
            // the sceneType token only earns its slot when it says something
            // the display title above doesn't — sycorax and ariel title
            // scenes BY their type, so there it would just echo the heading
            var sceneTok = info.sceneType || st.sceneType || "—";
            var drawnLabel = st.sceneLabel || info.sceneLabel || st.sceneType || info.sceneType || "";
            // the tide label used to ride this line too — but the tide dial
            // prints it a hundred pixels below, under a heading that says
            // "tide", so it was the same word twice on one screen (owner
            // 2026-08-16). The band keeps what only IT knows: which scene,
            // and how far through.
            var sub = (String(sceneTok).toLowerCase() === String(drawnLabel).toLowerCase()
              ? "" : sceneTok + " · ")
              + "x " + x01.toFixed(2);
            // the band is half-width now: pare the sub-line back to its own
            // panel (panelHead's rule) rather than run under the staff
            c.save();
            c.font = '12px ' + Skin.Type.MONO;
            var subW = function (s) { return c.measureText(String(s).toUpperCase()).width + s.length; };
            if (subW(sub) > S.w - 2) {
              while (sub.length > 1 && subW(sub + "…") > S.w - 2) sub = sub.slice(0, sub.length - 1);
              sub += "…";
            }
            c.restore();
            Skin.Type.smallCaps(c, sub, S.x, py - 6, 12, ic.mid, 1);
          }
        }
        // the harmony readout — up to two short lines under the scene
        // label, in the readout idiom (12px caption face, the surface's
        // mid ink, the sub-line's own pare-to-fit law). It shares the band
        // with the heading above and the sub-line/progress below and never
        // crosses either; idle draws nothing (harmonyLines returns null).
        var hLines = harmonyLines(info);
        if (hLines && fontsReady) {
          var hhf = Math.max(16, Math.min(22, Math.floor(S.h * 0.42))); // the band's own heading-fit law
          c.save();
          c.font = '12px ' + Skin.Type.MONO;
          var hW = function (s) { return c.measureText(String(s).toUpperCase()).width + String(s).length; };
          for (var hl = 0; hl < 2; hl++) {
            var hTxt = hLines[hl];
            if (!hTxt) continue;
            var hBase = S.y + 4 + hhf + 15 + hl * 14;
            if (hBase > S.y + S.h - 24) break; // the sub-line row's caps start here
            if (hW(hTxt) > S.w - 2) {
              while (hTxt.length > 1 && hW(hTxt + "…") > S.w - 2) hTxt = hTxt.slice(0, hTxt.length - 1);
              hTxt += "…";
            }
            Skin.Type.smallCaps(c, hTxt, S.x, hBase, 12, ic.mid, 1);
          }
          c.restore();
        }
        drawThemeStaff(G, panelContentRect(L.staff), info);
        var A = panelContentRect(L.dialA), B = panelContentRect(L.dialB);
        if (track === "library") {
          drawVolvelle(G, A, info);
          drawAthanor(G, B, info);
        } else if (track === "sycorax") {
          drawTreeline(G, A, info);
          drawSmoke(G, B, info);
        } else {
          drawWindRose(G, A, info);
          drawQuadrant(G, B, info);
        }
      });
    }

    // ---- THE THEME STAFF (owner 2026-07-20; rehomed + rebuilt 2026-08-16):
    // the working theme written out as sheet music — no longer the old
    // two-to-four-line degree grid in the plate's corner, but a REAL
    // five-line staff in its own margin panel. Treble range: E4 on the
    // bottom line, and a letter-clef "G" printed ON the G4 line (the
    // gothic manuscripts' clef — honest at pixel size, where a swash clef
    // would be mush). Every note is spelled ABSOLUTELY: the live tonic
    // (info.tonicHz, so a sea change re-roots the staff) plus the track's
    // mode steps gives the midi pitch; the floor's flat-preferring table
    // names it; letter → line-or-space, middle C gets its ledger line, and
    // the accidental prints beside its own head ("b" / "#" in the data
    // face — per-note, which stays honest even in Sycorax's undiatonic
    // witch mode). Note lengths keep the mensural language of the old
    // corner staff: filled head + flag = half-beat, filled + stem = one
    // beat, a dot adds half, open head = two beats, open headless = the
    // augmented breves. All three books carry it now — the chant has a
    // working theme too, and it always deserved printing.
    var STAFF_ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii"];
    var STAFF_LETTER_DIA = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
    var STAFF_MID_DIA = 34;               // B4 — the middle line's diatonic index
    function drawThemeStaff(G, r, info) {
      var c = G.ctx;
      var ic = marginInk();
      var mo = info && info.motif && info.motif.working;
      var notes = mo && mo.themeNotes;
      // the readout under the stave: name + generation. Ariel's fiction
      // flags a promoted signature (the ghost that won the coin).
      var gen = (mo && mo.themeGen) || 0;
      var sig = track === "ariel" && info.signature;
      var name = (sig && sig.promoted && sig.name) ? sig.name : ((mo && mo.theme) || "—");
      var cell = cellOf(r);
      // geometry: HS px per line-or-space step, the staff centred on the
      // cell (B4 on the middle line); everything clips to the panel's
      // window so a far-flung variation cannot print into a neighbour
      var HS = clamp(Math.floor(cell.ch / 13), 3, 5);
      var midY = Math.round(cell.cy);
      function yFor(dia) { return midY + (STAFF_MID_DIA - dia) * HS; }
      var clefW = 14;
      var x0 = r.x + 2;
      // the readout lives inside the window but outside the note clip
      // (which stops at h−18, right above the readout's caps), so it
      // prints first — and only once a theme exists to name
      if (notes && notes.length) {
        readoutLine(G, r, name
          + (gen > 0 ? " · gen " + (STAFF_ROMAN[Math.min(gen, 12) - 1] || gen) : "")
          + (sig && sig.promoted ? " · signature" : ""));
      }
      // the stave rules the full panel width, manuscript-style — the notes
      // themselves stay left-anchored on the ruling
      var lineW = r.w - 4;
      var cx0 = r.x - 4, cy0 = r.y + 17, cx1 = r.x + r.w + 4, cy1 = r.y + r.h - 18;
      c.save();
      c.beginPath();
      c.moveTo(cx0, cy0); c.lineTo(cx1, cy0); c.lineTo(cx1, cy1); c.lineTo(cx0, cy1);
      c.closePath(); c.clip();
      // the five lines, E4 (dia 30) to F5 (dia 38)
      c.strokeStyle = ic.rule; c.lineWidth = 1;
      for (var dl = 30; dl <= 38; dl += 2) {
        c.beginPath(); c.moveTo(x0, yFor(dl)); c.lineTo(x0 + lineW, yFor(dl)); c.stroke();
      }
      // the letter-clef: "G" printed on its own line
      if (fontsReady) {
        c.font = '15px "VT323", monospace';
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillStyle = ic.cap;
        c.fillText("G", x0 + 6, yFor(32) - 1);
        c.textAlign = "left"; c.textBaseline = "alphabetic";
      }
      if (!notes || !notes.length) {
        // idle: the ruled stave awaits its theme — the empty ruling is the
        // slot's ONE placeholder (final-gate law), no em dash and no readout
        c.restore();
        return;
      }
      // spell a scale degree absolutely: midi → letter, accidental, octave
      var tonicMidi = Math.round(freqToMidi(info.tonicHz || cfg.homeTonicHz));
      function spell(deg) {
        var d7 = ((deg % 7) + 7) % 7;
        var midi = tonicMidi + era.steps[d7] + 12 * Math.floor(deg / 7);
        var label = CONST_PITCH_LABELS[((midi % 12) + 12) % 12];
        return {
          dia: (Math.floor(midi / 12) - 1) * 7 + STAFF_LETTER_DIA[label.charAt(0)],
          acc: label.charAt(1) || "",
        };
      }
      var noteW = clamp(Math.floor((r.w - clefW - 14) / notes.length), 9, 24);
      // the display octave: the ruling is fixed (E4–F5), but a chant may
      // live an octave below it — so take the theme's median line-or-space
      // and shift the PRINTING by a whole octave to land it on the stave.
      // The ottava "8" under the clef confesses the shift (the vocal
      // score's octave clef — the pitch itself is never bent).
      var sps = [];
      for (var si = 0; si < notes.length; si++) sps.push(spell(notes[si].deg));
      var dias = sps.map(function (s) { return s.dia; }).sort(function (a, b) { return a - b; });
      var med = dias[Math.floor(dias.length / 2)];
      var oct = Math.max(-7, Math.min(7, 7 * Math.round((STAFF_MID_DIA - med) / 7)));
      if (oct !== 0 && fontsReady) {
        c.font = '9px "VT323", monospace';
        c.textAlign = "center"; c.textBaseline = "middle";
        c.fillStyle = ic.cap;
        // oct up on the page = sounds below the ruling = "8" under the clef
        c.fillText("8", x0 + 6, oct > 0 ? yFor(32) + HS * 2 + 8 : yFor(32) - HS * 2 - 4);
        c.textAlign = "left"; c.textBaseline = "alphabetic";
      }
      function ledger(nx, y) {
        c.beginPath(); c.moveTo(nx - 6, y); c.lineTo(nx + 6, y); c.stroke();
      }
      var head = dataCol(ic.lead, "theme staff notes");
      for (var i = 0; i < notes.length; i++) {
        var sp2 = sps[i];
        var dd = sp2.dia + oct;
        var nx = x0 + clefW + 10 + i * noteW + Math.floor(noteW / 2);
        var ny = yFor(dd);
        // ledger lines out to the note: middle C below, A5 and beyond above
        c.strokeStyle = ic.rule; c.lineWidth = 1;
        var ld;
        for (ld = 28; ld >= dd; ld -= 2) ledger(nx, yFor(ld));
        for (ld = 40; ld <= dd; ld += 2) ledger(nx, yFor(ld));
        // the accidental rides beside its own head
        if (sp2.acc && fontsReady) {
          c.font = '11px "VT323", monospace';
          c.textAlign = "right"; c.textBaseline = "middle";
          c.fillStyle = ic.mid;
          c.fillText(sp2.acc, nx - 5, ny);
          c.textAlign = "left"; c.textBaseline = "alphabetic";
        }
        // mensural pixel heads — the old corner staff's language, verbatim
        var b = notes[i].durBeats || 1;
        if (b >= 2) {
          c.strokeStyle = head; c.lineWidth = 1.5;
          c.strokeRect(nx - 3, ny - 2.5, 6, 5);
        } else {
          c.fillStyle = head;
          c.fillRect(nx - 3, ny - 2.5, 6, 5);
        }
        if (b < 3) {                                   // stem
          var stemH = HS * 2.5 + 3;
          c.strokeStyle = head; c.lineWidth = 1;
          c.beginPath(); c.moveTo(nx + 3, ny - 2); c.lineTo(nx + 3, ny - 2 - stemH); c.stroke();
          if (b <= 0.5) {                              // flag for the half-beat
            c.beginPath(); c.moveTo(nx + 3, ny - 2 - stemH); c.lineTo(nx + 7, ny + 2 - stemH); c.stroke();
          }
        }
        if (b === 1.5 || b === 3) {                    // the dot
          c.fillStyle = head;
          c.fillRect(nx + 6, ny - 1, 2, 2);
        }
      }
      c.restore();
    }

    // ---- library margin panels ----
    function drawVolvelle(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var cx = r.x + r.w / 2, cy = cell.cy;
      var R = Math.min(r.w * 0.44, cell.ch * 0.5) - 1;
      if (R < 10) R = 10;
      c.strokeStyle = pal.ink[1]; c.lineWidth = 1.4;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      var tide = info.tidePos;
      var CUR = tide == null ? null : Math.min(7, Math.floor(tide * 8));
      if (R >= 40) {
        // full volvelle: the eight moons ride the wheel, current under the index
        c.strokeStyle = pal.ink[3]; c.lineWidth = 1;
        c.beginPath(); c.arc(cx, cy, R - 13, 0, Math.PI * 2); c.stroke();
        c.fillStyle = pal.ink[0];
        c.beginPath(); c.arc(cx, cy, 2.2, 0, Math.PI * 2); c.fill();
        var rot = -(CUR == null ? 0 : CUR) * Math.PI / 4 - Math.PI / 2;
        for (var p = 0; p < 8; p++) {
          var a = rot + p * Math.PI / 4;
          // the moon phases: explicit tint2 — the lit face is paper-light,
          // never the default rubric accent (skin lesson 2)
          at.stamp(c, "moon-" + p, cx + Math.cos(a) * (R - 9), cy + Math.sin(a) * (R - 9),
            { u: G.u, tint: pal.ink[0], tint2: pal.paper[0] });
        }
        if (CUR != null) { // the index — the needle position is data
          c.fillStyle = pal.rubric[0];
          c.beginPath();
          c.moveTo(cx, cy - R - 1); c.lineTo(cx - 5, cy - R - 9); c.lineTo(cx + 5, cy - R - 9);
          c.closePath(); c.fill();
        }
      } else {
        // compact volvelle (small cells): current moon at the hub, eight
        // phase dots on the rim, the current one rubricated
        if (CUR != null) at.stamp(c, "moon-" + CUR, cx, cy, { u: G.u, tint: pal.ink[0], tint2: pal.paper[0] });
        for (var p2 = 0; p2 < 8; p2++) {
          var a2 = p2 * Math.PI / 4 - Math.PI / 2;
          c.fillStyle = (CUR != null && p2 === CUR) ? pal.rubric[0] : pal.ink[3];
          c.fillRect(Math.round(cx + Math.cos(a2) * R) - 1, Math.round(cy + Math.sin(a2) * R) - 1, 2, 2);
        }
      }
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " · " + info.tideLabel : ""));
    }

    function drawAthanor(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var gradus = inten == null ? 1 : 1 + Math.min(3, Math.floor(frac * 4));
      // the furnace and its gauge read as ONE instrument: centred in the
      // cell as a group, tops aligned to the furnace's stamped height —
      // never under the heading or across the readout (final-gate fix)
      var aScale = fitScale(16, cell.ch, G.u);
      var stampH = 16 * G.u * aScale;
      var gw = Math.max(10, Math.min(14, Math.floor(r.w * 0.09)));
      var groupW = stampH + 16 + gw;             // the stamp is square: w = h
      var fx = r.x + (r.w - groupW) / 2 + stampH / 2;
      at.stamp(c, "athanor-" + gradus, fx, cell.cy, {
        u: G.u, scale: aScale, tint: pal.ink[0],
        tint2: inten == null ? pal.ink[1] : pal.rubric[1], // idle: cold hearth, no fire
      });
      // the gauge — four degrees of fire; fill height is data
      var gx = fx + stampH / 2 + 16;
      var gTop = cell.cy - stampH / 2, gBot = cell.cy + stampH / 2;
      c.strokeStyle = pal.ink[1]; c.lineWidth = 1.4;
      c.strokeRect(gx, gTop, gw, gBot - gTop);
      for (var d = 1; d < 4; d++) {
        var yq = gTop + (d / 4) * (gBot - gTop);
        c.beginPath(); c.moveTo(gx, yq); c.lineTo(gx + gw, yq); c.stroke();
      }
      if (inten != null) {
        var fillH = frac * (gBot - gTop);
        Skin.Dither.fill(c, gx + 2, gBot - fillH, gw - 4, fillH, pal.rubric[0], 0.5, { u: G.u });
        // rubric red is not data-legal on the night ground (2.7:1) — gilt
        // carries its data-side jobs there. Keyed to the SURFACE, not the
        // page: in a night window on a parchment page, gilt still wins.
        c.fillStyle = dataCol(inkMode() === "night" ? pal.gilt[0] : pal.rubric[0], "athanor gauge line");
        c.fillRect(gx, gBot - fillH - 1, gw, 2);
      }
      readoutLine(G, r, "fire " + fmt2(inten) + " · gradus " + (inten == null ? "—" : ROMAN_HI[gradus - 1]));
    }

    // (drawAirQuills and drawChordMetal — the air/chord row pair — lived
    // here; removed with the rowA/rowB slots, owner 2026-08-17.)

    // library genealogy tree — pen-work family diagram from real events
    function drawGenealogy(G, r) {
      var c = G.ctx;
      var nodes = st.tree;
      var baseY = r.y + Math.max(r.h * 0.55, 52); // gen branches climb ~28 px + numerals: stay under the heading
      var x0 = r.x + 12;
      var stepX = Math.min(44, (r.w - 40) / Math.max(4, nodes.length + 1));
      function penLine(ax, ay, bx, by, col, w2, dash) {
        c.save();
        if (dash) c.setLineDash(dash);
        c.strokeStyle = col; c.lineWidth = w2;
        c.beginPath();
        c.moveTo(ax, ay);
        c.quadraticCurveTo((ax + bx) / 2, ay + (by - ay) * 0.15, bx, by);
        c.stroke(); c.restore();
      }
      // root
      c.fillStyle = pal.ink[1];
      c.beginPath(); c.arc(x0, baseY, 4.4, 0, Math.PI * 2); c.fill();
      if (fontsReady) Skin.Type.smallCaps(c, "θ", x0, baseY - 8, 14, pal.rubric[0], 0, "center");
      var px = x0, pyy = baseY;
      var placed = []; // {x, y, gen}
      for (var i = 0; i < nodes.length; i++) {
        var nd = nodes[i];
        var nx = x0 + (i + 1) * stepX;
        var ny = baseY - ((nd.gen || 0) % 3) * 14 + (nd.answer ? 16 : 0);
        if (nd.ghost) {
          // the earlier hand: paler ink, tilted letterforms (§1a)
          var gy = Math.min(baseY + 22, r.y + r.h - 10);
          c.save();
          c.translate(nx, gy); c.rotate(-0.06); c.translate(-nx, -gy);
          penLine(px, pyy + 4, nx, gy, pal.ink[3], 1.1, [4, 3]);
          c.fillStyle = pal.ink[3];
          c.beginPath(); c.arc(nx, gy, 3.2, 0, Math.PI * 2); c.fill();
          if (fontsReady) Skin.Type.smallCaps(c, "α · " + (nd.name || ""), nx + 6, gy + 4, 12, pal.ink[3], 0);
          c.restore();
          continue;
        }
        if (nd.coagula) {
          at.stamp(c, "ouroboros", nx, ny, { u: G.u, tint: pal.ink[0], tint2: pal.rubric[0] });
          if (fontsReady) Skin.Type.smallCaps(c, "solve et coagula", nx, ny + 16, 11, pal.rubric[0], 0, "center");
          continue;
        }
        penLine(px, pyy, nx, ny, nd.answer ? pal.ink[1] : pal.ink[0], nd.answer ? 1.2 : 1.5, nd.answer ? [3, 2] : null);
        c.fillStyle = pal.ink[0];
        c.beginPath(); c.arc(nx, ny, 3.2, 0, Math.PI * 2); c.fill();
        if (fontsReady && nd.gen) {
          Skin.Type.smallCaps(c, ROMAN_LO[Math.min(6, Math.max(0, nd.gen - 1))], nx, ny - 8, 13, pal.ink[1], 0, "center");
        }
        // the every-3rd-gen ancestor tether, dotted rubric return
        if (nd.gen >= 4 && (nd.gen - 1) % 3 === 0) {
          for (var j = 0; j < placed.length; j++) {
            if (placed[j].gen === nd.gen - 3) {
              c.save();
              c.setLineDash([2, 4]); c.strokeStyle = pal.rubric[0]; c.lineWidth = 1.2;
              c.beginPath();
              c.moveTo(nx, ny - 4);
              // the tether's arch stays inside the panel (short-canvas clamp)
              c.quadraticCurveTo((nx + placed[j].x) / 2, Math.max(ny - 34, r.y + 22), placed[j].x, placed[j].y - 6);
              c.stroke(); c.restore();
              break;
            }
          }
        }
        placed.push({ x: nx, y: ny, gen: nd.gen });
        if (!nd.answer) { px = nx; pyy = ny; }
      }
      // (the "theme <name>" caption stood here until 2026-08-16. Only Ariel
      // ever emits a signature, so in the one book that drew this the name
      // always fell through to the working theme — the very string the staff
      // panel prints in its readout, two panels up. The tree's job is the
      // lineage; the staff names the line.)
    }

    // ---- sycorax margin panels ----
    function drawTreeline(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var tide = info.tidePos;
      var gy = cell.bot - 2;
      c.strokeStyle = pal.bone[2]; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r.x, gy); c.lineTo(r.x + r.w, gy); c.stroke();
      // firs along the ridge — heights fit the cell
      var fMax = Math.min(18, cell.ch - 6);
      for (var i = 0; i < 7; i++) {
        var fx = r.x + 8 + i * (r.w - 16) / 6;
        var fh = fMax * (0.55 + Skin.noise.hash2(i, 3) * 0.45);
        c.strokeStyle = pal.bone[2]; c.lineWidth = 1;
        c.beginPath(); c.moveTo(fx, gy); c.lineTo(fx, gy - fh); c.stroke();
        c.beginPath(); c.moveTo(fx - 4, gy - fh * 0.4); c.lineTo(fx, gy - fh); c.lineTo(fx + 4, gy - fh * 0.4); c.stroke();
      }
      if (tide != null) {
        // the rite's fire glow: nearer at high tide (rubrication beside
        // bone, never the sole carrier — the position mark is bone). The
        // carried bruise dims the glow slightly — the cut's only lasting
        // residue anywhere (owner ruling: nothing persistent on the plate).
        var fireX = r.x + 10 + (r.w - 20) * tide;
        var glow = 0.45 * (1 - 0.5 * clamp01(st.bruise || 0));
        Skin.Dither.fill(c, fireX - 8, gy - 8, 16, 8, pal.blood[1], glow, { u: G.u });
        c.fillStyle = dataCol(pal.bone[0], "treeline fire position");
        c.beginPath(); c.moveTo(fireX, gy - 10); c.lineTo(fireX - 3, gy - 4); c.lineTo(fireX + 3, gy - 4); c.closePath(); c.fill();
      }
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " · " + info.tideLabel : ""));
    }

    function drawSmoke(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var bx = r.x + r.w / 2, bot = cell.bot, top = cell.top;
      var colH = (bot - top) * frac;
      // the hearth: a ground line for the smoke to rise FROM (echoing the
      // treeline's ridge), with a coal-bed at the column's foot — so the
      // dial keeps its instrument even at rest, when the height bar sits
      // ON the grate and reads "no smoke yet". Furniture ink, not data.
      c.strokeStyle = pal.bone[2]; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r.x, bot); c.lineTo(r.x + r.w, bot); c.stroke();
      c.fillStyle = pal.bone[2];
      c.fillRect(bx - 6, bot - 3, 12, 2);
      // the column: dithered bone rising, drifting
      for (var y = 0; y < colH; y += 4) {
        var drift = Math.sin(y / 14) * (2 + y * 0.06);
        var cover = 0.65 - (y / (bot - top)) * 0.4;
        Skin.Dither.fill(c, bx + drift - 4, bot - y - 4, 8, 4, pal.bone[1], cover, { u: G.u, mode: "blue", seed: seed + 2 });
      }
      if (inten != null) {
        c.strokeStyle = dataCol(pal.bone[0], "smoke height"); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(bx - 12, bot - colH); c.lineTo(bx + 12, bot - colH); c.stroke();
      }
      readoutLine(G, r, "intensity " + fmt2(inten) + " · bruise " + fmt2(st.bruise || (inten == null ? null : 0)));
    }

    // (drawPoseSigil and drawTallies — the pose/tallies row pair — lived
    // here; removed with the rowA/rowB slots, owner 2026-08-17. The
    // percussion still speaks through the plate's proto-drum mark and the
    // scribal log.)

    // the cord-and-bone: develops as knots on a cord (sycorax tree panel)
    function drawTallyCord(G, r) {
      var c = G.ctx;
      var y = r.y + r.h * 0.5;
      c.strokeStyle = pal.bone[1]; c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(r.x + 6, y);
      c.quadraticCurveTo(r.x + r.w / 2, y + 8, r.x + r.w - 6, y - 2);
      c.stroke();
      for (var i = 0; i < st.tree.length && i < 12; i++) {
        var t = (i + 1) / 13;
        var kx = r.x + 6 + (r.w - 12) * t;
        var ky = y + 8 * Math.sin(Math.PI * t) * (1 - t) * 2 - 1;
        var nd = st.tree[i];
        c.fillStyle = nd.answer ? pal.bone[1] : pal.bone[0];
        c.beginPath(); c.arc(kx, ky, nd.answer ? 2.6 : 3.4, 0, Math.PI * 2); c.fill();
        if (fontsReady && nd.gen) {
          Skin.Type.smallCaps(c, ROMAN_LO[Math.min(6, Math.max(0, nd.gen - 1))], kx, ky - 7, 11, pal.bone[1], 0, "center");
        }
      }
    }

    // ---- ariel margin panels ----
    var TIDE_POINT = { "still-air": 0, "rising-thermals": 1, "gale": 2, "clearing": 3 };
    function drawWindRose(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var cx = r.x + r.w / 2, cy = cell.cy;
      var R = Math.min(r.w * 0.4, cell.ch * 0.5) - 1;
      if (R < 8) R = 8;
      c.strokeStyle = pal.silver[2]; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
      var activeIdx = TIDE_POINT[info.tideLabel];
      var tide = info.tidePos;
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4 - Math.PI / 2;
        var big = k % 2 === 0;
        var active = activeIdx != null && k === activeIdx * 2;
        var len = big ? R * 0.92 : R * 0.6;
        var col = active ? pal.gilt[0] : pal.silver[1];
        c.strokeStyle = col; c.lineWidth = active ? 1.6 : 1;
        c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); c.stroke();
        if (active) Skin.star4(c, cx + Math.cos(a) * len, cy + Math.sin(a) * len, 3.4, pal.gilt[0]);
      }
      // feather streamers — count rides tidePos; only where the cell has
      // room past the rose (they stay inside the panel)
      if (tide != null && activeIdx != null && R >= 30) {
        var nF = 1 + Math.round(tide * 3);
        var aA = activeIdx * Math.PI / 2 - Math.PI / 2;
        for (var f = 0; f < nF; f++) {
          var fx2 = cx + Math.cos(aA) * (R + 6 + f * 9), fy2 = cy + Math.sin(aA) * (R + 6 + f * 9) + f * 3;
          if (fx2 > r.x + 4 && fx2 < r.x + r.w - 4 && fy2 > cell.top && fy2 < cell.bot) {
            Skin.feather(c, fx2, fy2, 11, aA + 0.6, pal.silver[1]);
          }
        }
      }
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " ✦ " + info.tideLabel : ""));
    }

    function drawQuadrant(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var R = Math.min(r.w - 36, cell.ch);
      if (R < 12) R = 12;
      // the instrument's footprint is R wide (origin to limb): centre it in
      // the cell like its siblings, rather than hugging the left edge
      var ox = r.x + (r.w - R) / 2, oy = cell.bot;
      c.strokeStyle = pal.silver[1]; c.lineWidth = 1;
      c.beginPath(); c.arc(ox, oy, R, -Math.PI / 2, 0); c.stroke();
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox, oy - R); c.stroke();
      c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + R, oy); c.stroke();
      if (R >= 26) {
        for (var d = 1; d < 6; d++) {
          var ta = -Math.PI / 2 + (d / 6) * (Math.PI / 2);
          c.strokeStyle = pal.silver[2];
          c.beginPath();
          c.moveTo(ox + Math.cos(ta) * (R - 4), oy + Math.sin(ta) * (R - 4));
          c.lineTo(ox + Math.cos(ta) * R, oy + Math.sin(ta) * R);
          c.stroke();
        }
      }
      if (inten != null) {
        // the astrolabe arm — its angle is the datum
        var aArm = -Math.PI / 2 + frac * (Math.PI / 2);
        c.strokeStyle = dataCol(pal.silver[0], "quadrant arm"); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(ox, oy); c.lineTo(ox + Math.cos(aArm) * (R - 2), oy + Math.sin(aArm) * (R - 2)); c.stroke();
        Skin.star4(c, ox + Math.cos(aArm) * (R - 2), oy + Math.sin(aArm) * (R - 2), 3, pal.gilt[0]);
      }
      readoutLine(G, r, "altitude " + fmt2(inten));
    }

    // (drawConstellation and drawSeason — the constellation/season row pair
    // — lived here; removed with the rowA/rowB slots, owner 2026-08-17.
    // The signature's name and generation still print under the stave, and
    // a promoted signature is still flagged there.)

    // ariel migration map (tree panel): the flight of gens across the season
    function drawMigration(G, r) {
      var c = G.ctx;
      var y0 = r.y + r.h * 0.62;
      c.strokeStyle = pal.silver[2]; c.lineWidth = 1;
      c.save(); c.setLineDash([1, 4]);
      c.beginPath();
      c.moveTo(r.x + 6, y0 + 10);
      c.quadraticCurveTo(r.x + r.w / 2, y0 - 26, r.x + r.w - 6, y0 - 4);
      c.stroke(); c.restore();
      var n = st.migration.length;
      for (var i = 0; i < n && i < 14; i++) {
        var t = (i + 1) / 15;
        var mx = r.x + 6 + (r.w - 12) * t;
        var my = y0 + 10 - 36 * t * (2 - t) + 8 * (1 - t);
        var nd = st.migration[i];
        if (nd.answer) {
          c.strokeStyle = pal.sky[1]; c.lineWidth = 1;
          c.beginPath(); c.moveTo(mx - 4, my + 3); c.lineTo(mx, my - 2); c.lineTo(mx + 4, my + 3); c.stroke();
        } else {
          Skin.star4(c, mx, my, 2.6, i === n - 1 ? pal.gilt[1] : pal.gilt[0]);
        }
        if (fontsReady && nd.gen) {
          Skin.Type.smallCaps(c, ROMAN_LO[Math.min(6, Math.max(0, nd.gen - 1))], mx, my - 8, 11, pal.silver[1], 0, "center");
        }
      }
    }

    // ============================================================ LIFECYCLE ==
    function pollInfo() {
      if (!engine) return;
      var info;
      try { info = engine.getInfo(); } catch (e) { return; }
      if (!info) return;
      lastInfo = info;
      if (info.sceneLabel && info.sceneLabel !== st.sceneLabel) {
        st.sceneLabel = info.sceneLabel; st.sceneType = info.sceneType;
        marginStack.invalidate("furniture");
      } else if (!info.sceneLabel && info.sceneType && info.sceneType !== st.sceneType) {
        st.sceneType = info.sceneType; st.sceneLabel = info.sceneType;
        marginStack.invalidate("furniture");
      }
      if (info.sceneIdx != null) { st.sceneIdx = info.sceneIdx; st.sceneCount = info.sceneCount || st.sceneCount; }
      // (st.pose was mirrored here for the pose row; the row went with
      // rowA/rowB, owner 2026-08-17.)
      // (st.signature was tracked here for the genealogy's caption; the
      // caption went 2026-08-16 and the panels that still want a signature
      // read info.signature directly, so the mirrored state went with it.)
      // era safety net: if the engine exposes tonicHz, trust it
      if (info.tonicHz) {
        var pc = pcFromHz(info.tonicHz);
        if (pc !== era.tonicPc) { era.tonicPc = pc; plateStack.invalidate("furniture"); }
      }
    }

    function frame(ts) {
      if (!running) return;
      rafId = raf ? raf(frame) : null;
      var tNow = nowFn() / 1000;
      var dt = lastFrameT ? Math.min(0.1, tNow - lastFrameT) : 0.016;
      lastFrameT = tNow;
      if (autoRotate && !dragging && !plateStack.isHidden()) camYaw += YAW_RATE * dt;
      computeMagnitudes();
      compositeFolioIfDirty();   // the sheet: only when it actually changed
      plateStack.composite(tNow);
      marginStack.composite(tNow);
    }

    function measure(canvas, defW, defH) {
      if (canvas.getBoundingClientRect) {
        var r = canvas.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
      }
      return { w: defW, h: defH };
    }
    // one measurement path for resize() and start(). immediate = true sizes
    // the stacks NOW (start must not draw a frame on stale backing sizes);
    // false rides each stack's debounce (the §6 off-hot-path rule). Either
    // way nothing rebakes when the measured size is unchanged.
    function measureAll(immediate) {
      var p = measure(plateCanvas, opts.plateW || 900, opts.plateH || 860);
      var m = measure(marginCanvas, opts.marginW || 402, opts.marginH || 640);
      // the window zone (A2 clip + coil sizing budget both read this):
      // night — the whole canvas minus a courtesy inset; parchment — the
      // slim rounded monitor window inside the page
      var pad = binding === "night" ? 6 : Math.max(16, Math.round(Math.min(p.w, p.h) * 0.03));
      plateZones.plateZone.cx = p.w * 0.5;
      plateZones.plateZone.cy = p.h * 0.5;
      plateZones.plateZone.rx = p.w * 0.5 - pad;
      plateZones.plateZone.ry = p.h * 0.5 - pad;
      plateZones.plateZone.r = binding === "night" ? 12
        : Math.max(14, Math.round(Math.min(p.w, p.h) * 0.045));
      function apply(stack, s) {
        var G = stack.G();
        if (Math.abs(G.w - s.w) < 1 && Math.abs(G.h - s.h) < 1) return false;
        if (immediate) stack.resize(s.w, s.h);
        else stack.scheduleResize(s.w, s.h);
        return true;
      }
      apply(plateStack, p);
      apply(marginStack, m);
      // the sheet measures its own element (CSS stretches it to the folio),
      // and a resize is the one thing that must re-bake it
      if (folioStack) {
        apply(folioStack, measure(folioCanvas, opts.folioW || 1392, opts.folioH || 768));
      }
    }

    var viz = {
      // ---- the contract surface ----
      setTrack: function (t) {
        if (!TRACK_CFG[t]) throw new Error("PJ2.Viz.setTrack: unknown track '" + t + "'");
        if (t === track) return;
        track = t; cfg = TRACK_CFG[t];
        pal = Skin.palette(t); at = Skin.atlas(t);
        plateStack.setTrack(t); marginStack.setTrack(t);
        if (folioStack) { folioStack.setTrack(t); invalidateFolio(); }
        resetRunState();
        for (var i = 0; i < TOTAL; i++) { baselineLin[i] = 0; magnitudes[i] = 0; }
        rebuildSampleIdx();
        lastInfo = {};
        invalidateFurniture();
      },
      getTrack: function () { return track; },

      // the binding switch (owner 2026-07-20): swaps the whole dress —
      // palettes, atlas inks, papers, window geometry — between the night
      // folio and the windowed parchment page. The spiral, floor, and
      // animations are identical in both.
      setBinding: function (b) {
        if (b !== "night" && b !== "parchment") {
          throw new Error("PJ2.Viz.setBinding: unknown binding '" + b + "'");
        }
        if (b === binding) return;
        binding = b;
        if (Skin.setMode) Skin.setMode(b);
        pal = Skin.palette(track);
        at = Skin.atlas(track);
        plateStack.invalidate("paper"); plateStack.invalidate("furniture");
        marginStack.invalidate("paper"); marginStack.invalidate("furniture");
        invalidateFolio();   // the sheet is parchment-only: bake it or clear it
        measureAll(true);
        compositeFolioIfDirty();  // the switch must show even while stopped
      },
      getBinding: function () { return binding; },

      attach: function (eng, audioCtx) {
        if (engine) viz.detach();
        engine = eng; actx = audioCtx || null;
        if (actx && actx.createAnalyser) {
          analyser = actx.createAnalyser();
          try {
            analyser.fftSize = FFT_SIZE;
            analyser.smoothingTimeConstant = 0.05;
            analyser.minDecibels = -100;
            analyser.maxDecibels = 0;
          } catch (e) {}
          sampleRate = actx.sampleRate || 44100;
          rebuildSampleIdx();
          fftData = new Float32Array(analyser.frequencyBinCount || FFT_SIZE / 2);
          try { engine.attachAnalyser(analyser); } catch (e) {}
        }
        if (engine.setNoteListener) unsubNote = engine.setNoteListener(onNote);
        if (engine.setEventListener) unsubEvent = engine.setEventListener(onEvent);
        if (setT) pollId = setT(pollInfo, pollMs);
        pollInfo();
        var unsub = function () { viz.detach(); };
        return unsub;
      },

      detach: function () {
        if (unsubNote) { try { unsubNote(); } catch (e) {} unsubNote = null; }
        if (unsubEvent) { try { unsubEvent(); } catch (e) {} unsubEvent = null; }
        if (pollId != null && clearT) { clearT(pollId); pollId = null; }
        engine = null; actx = null; analyser = null; fftData = null;
      },

      start: function () {
        if (running) return;
        running = true;
        lastFrameT = 0;
        ensureFonts();
        // measure NOW, immediately (not through the debounce): the host UI
        // only calls resize() on window-resize events, so without this the
        // first evening renders on the creation-default backing sizes and
        // the CSS box squashes it (final-gate lesson: circles as ellipses
        // at 402×330). Skipped when nothing changed — a tab-return start()
        // must not rebake the papers for free.
        measureAll(true);
        if (raf) rafId = raf(frame);
      },
      stop: function () {
        running = false;
        if (rafId != null) { caf(rafId); rafId = null; }
      },
      isRunning: function () { return running; },

      resize: function () { measureAll(false); },

      // ---- dev/bench extras (not part of the UI contract; harmless) ----
      setCamera: function (yaw, pitch) {
        if (yaw != null) camYaw = yaw;
        if (pitch != null) camPitch = clamp(pitch, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      },
      setAutoRotate: function (on) { autoRotate = !!on; },
      frameOnce: function (tNow) { // harness: one composite without rAF
        computeMagnitudes();
        var t = tNow === undefined ? nowFn() / 1000 : tNow;
        plateStack.composite(t); marginStack.composite(t);
      },
      _injectEvent: onEvent,   // bench-only: art-direct the event vocabulary on demand
      _injectNote: onNote,
      debug: function () {
        var peak = 0;
        for (var i = 0; i < TOTAL; i++) if (magnitudes[i] > peak) peak = magnitudes[i];
        return {
          track: track, running: running, attached: !!engine,
          fftPeak: peak, marks: st.marks.length, tree: st.tree.length,
          drones: st.droneSet.length,
          plucks: st.harpPlucks.length + st.bassPlucks.length,
          glints: st.boxGlints.length + st.chimeGlints.length,
          bubbles: st.bubbles.length,
          lolli: !!st.lolli,
          lolliOf: st.lolli ? st.lolli.lastOf : null,
          era: { tonicPc: era.tonicPc },
          plateMs: plateStack.lastCompositeMs(),
          info: lastInfo,
        };
      },
      _stacks: { plate: plateStack, margin: marginStack },
    };

    return viz;
  }

  return { create: create, TRACK_CFG: TRACK_CFG };
})();

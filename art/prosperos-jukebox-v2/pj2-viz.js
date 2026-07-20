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
// baseline, drag + auto-rotate camera), the margin apparatus (§4 diegetic
// telemetry), the §4 per-event illustrations on the L3 alive-list, and the
// density footer.
//
// SPIRAL REVERT (PLAN-SPIRAL-REVERT, owner 2026-07-20): the coil renders
// v1's phosphor treatment for ALL THREE tracks — translucent colored
// ribbon fills with a bright fixed baseline, depth as alpha fade, on the
// track's near-black night ground. The paper page and deckle frame stay;
// only the plate-zone ellipse is painted night (paperPlate override).
// The alchemy-sigil dial is gone; beneath the coil sits v1's constellation
// floor — the drones charted by pitch-class angle / octave radius, with
// consonance-weighted interval lines, triangle-harmonic halo ripples, and
// note-name ring labels. The v2 coil theatrics (pen wobble, ink oxidation,
// hush step, Cut slash, re-gild, roman seam numerals) are removed with it.
//
// THE INTERFACE CONTRACT (pj2-ui.js builds against exactly this):
//   PJ2.Viz.create({ plateCanvas, marginCanvas, footerCanvas })
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
// DOCUMENTED SUBSTITUTION — the density footer: the plan's envelope keeps
// "past solid / forecast pricked", but the v2 engines expose no
// getDensityAt(t) (v1 did). The footer therefore plots the RECENT MEASURED
// intensity (sampled from the ~300 ms getInfo() poll — real telemetry, not
// a synthetic curve) as the solid past, and prints the forecast as a
// pricked continuation held at the current level with the conductor's tide
// slope applied. When an engine grows a density-forecast surface the
// pricked half can go honest without touching the axes.
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
  var DENSITY_KEEP = 1200;           // ~6 min of poll samples

  // per-track configuration: the FFT anchor (v1's table), the field's home
  // era (tonic + mode steps), and display strings.
  var TRACK_CFG = {
    library: {
      anchorPc: 0, anchorName: "C",
      homeTonicHz: 262, steps: [0, 2, 3, 5, 7, 9, 10], modeName: "dorian",
      scaleLabel: "C dorian",
    },
    sycorax: {
      anchorPc: 3, anchorName: "Eb",
      homeTonicHz: 311, steps: [0, 1, 3, 4, 5, 7, 8], modeName: "sycorax",
      scaleLabel: "Eb chromatic-locrian",
    },
    ariel: {
      anchorPc: 5, anchorName: "F",
      homeTonicHz: 349, steps: [0, 2, 4, 6, 7, 9, 11], modeName: "lydian",
      scaleLabel: "F lydian",
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
  // create({ plateCanvas, marginCanvas, footerCanvas, ... })
  // ==========================================================================
  function create(opts) {
    opts = opts || {};
    if (!PJ2.Skin) throw new Error("PJ2.Viz: pj2-skin.js must load first");
    if (!PJ2.Rand) throw new Error("PJ2.Viz: pj2-rand.js must load first");
    var Skin = PJ2.Skin;

    var plateCanvas = opts.plateCanvas, marginCanvas = opts.marginCanvas, footerCanvas = opts.footerCanvas;
    if (!plateCanvas || !marginCanvas || !footerCanvas) {
      throw new Error("PJ2.Viz.create: needs plateCanvas, marginCanvas, footerCanvas");
    }

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

    // camera (v1 verbatim behavior)
    var camYaw = 0.55, camPitch = 0.30, autoRotate = true;
    var dragging = false, lastMx = 0, lastMy = 0;

    // FFT machinery
    var fftData = null;              // sized on attach (frequencyBinCount)
    var magnitudes = new Float32Array(TOTAL);
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
        whistle: null,        // ariel whistle note tracker {of, freq, until} → lollipop
        lolli: null,          // v1 tracked lollipop {theta, yBase, yHead, octIdx, framesQuiet}
        harpPlucks: [],       // library harpsichord baseline ripples {of, t, vel}
        bassPlucks: [],       // ariel bass baseline ripples {of, t, vel, freq}
        boxGlints: [],        // library music-box glint stars {of, t, riseFrac, seed, dir}
        chimeGlints: [],      // ariel chime glints (music-box's sibling voice)
        bubbles: [],          // ariel ambient gliss bubbles {startOct, glissEndOct, driftTo, t, dur, phase, r}
        humNote: null,        // library hum bar {of, freq, vowel, endTime}
        humLevel: 0,          // smoothed hum level (bar height)
        pulseAt: -1e9,        // sycorax proto-drum last lub (audio t)
        tallies: 0,           // sycorax percussion strokes this evening
        tallyKinds: [],       // recent percussion kinds (margin readout)
        tree: [],             // library genealogy nodes {gen, name, ghost, answer, coagula}
        migration: [],        // ariel develop/answer gens
        sinkPx: 0,            // sycorax print-drop offset (CSS px)
        cut: null,            // sycorax {tB, sev, dip, ret:{t,s}|null} (audio t)
        ghostLineUntil: -1e9, // ariel prior-evening flight-line (wall s)
        flightScenes: 0,      // ariel legs drawn = scenes seen
        bruise: 0,
        pose: null,
        sceneLabel: null, sceneType: null, sceneX: 0, sceneIdx: 0, sceneCount: 0,
        emblemSlot: 0,        // L3 stamp placement cycler
        lastCadence: null,    // {kind, label, rootStep|null, at}
        signature: null,
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
    var footerZones = { quietRects: [{ x: 0, y: 0, w: 4000, h: 4000 }] };

    var plateStack = Skin.stack(plateCanvas, track, {
      seed: seed, w: opts.plateW || 900, h: opts.plateH || 860,
      dpr: opts.dpr, zones: plateZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperPlate, furniture: drawPlateFurniture, data: drawPlateData },
    });
    // margin/footer papers are quiet apparatus pages: no deckle, no star
    // field, texture calmed everywhere ink writes (function declarations
    // below are hoisted — safe to reference here)
    var marginStack = Skin.stack(marginCanvas, track, {
      seed: seed, w: opts.marginW || 402, h: opts.marginH || 640,
      dpr: opts.dpr, zones: marginZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperMargin, furniture: drawMarginFurniture, data: drawMarginData },
    });
    var footerStack = Skin.stack(footerCanvas, track, {
      seed: seed, w: opts.footerW || 900, h: opts.footerH || 64,
      dpr: opts.dpr, zones: footerZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { paper: paperFooter, furniture: drawFooterFurniture, data: drawFooterData },
    });
    plateStack.bindVisibility();

    function invalidateFurniture() {
      plateStack.invalidate("furniture");
      marginStack.invalidate("furniture");
      footerStack.invalidate("furniture");
    }

    // the plate page (owner 2026-07-20, both rulings): the night window is a
    // SLIM ROUNDED SQUARE, and the paper around it must run seamlessly into
    // the folio, margin, and footer — so the plate bakes the same calm,
    // deckle-less paper the margin/footer pages use (no torn edge, no star
    // field; the folio's CSS paper shows through the gaps and everything
    // reads as one continuous page). The window edge keeps a short dithered
    // feather so it prints, not peels. Bake-time only — off the hot path.
    function paperPlate(G, tr, sd, zones) {
      Skin.paper(G.ctx, G.w, G.h, tr, sd, {
        u: G.u, plateZone: zones.plateZone,
        // full-bleed quiet — even the outermost cells stay calm so the
        // canvas edge leaves no seam ring against the folio
        quietRects: [{ x: 0, y: 0, w: G.w, h: G.h }],
        deckle: false, stars: false,
      });
      var pz = zones.plateZone;
      if (!pz || !pz.rx || !pz.ry) return;
      var c = G.ctx, u = G.u || 2;
      c.fillStyle = Skin.palette(tr).spiral.bg;
      var cols = Math.ceil(G.w / u), rows = Math.ceil(G.h / u);
      for (var gy = 0; gy < rows; gy++) {
        for (var gx = 0; gx < cols; gx++) {
          var px = gx * u, py = gy * u;
          var d = Skin.rrectDist(px + u * 0.5, py + u * 0.5, pz);
          if (d < 0) { c.fillRect(px, py, u, u); continue; }
          if (d < 7 && Skin.noise.hash2(gx + (sd & 255), gy) < (1 - d / 7) * 0.4) {
            c.fillRect(px, py, u, u);   // the feather speckle onto the paper
          }
        }
      }
    }
    function paperMargin(G, tr, sd, zones) {
      Skin.paper(G.ctx, G.w, G.h, tr, sd, {
        u: G.u, quietRects: [{ x: 4, y: 4, w: G.w - 8, h: G.h - 8 }],
        deckle: false, stars: false,
      });
    }
    function paperFooter(G, tr, sd, zones) {
      Skin.paper(G.ctx, G.w, G.h, tr, sd, {
        u: G.u, quietRects: [{ x: 2, y: 2, w: G.w - 4, h: G.h - 4 }],
        deckle: false, stars: false,
      });
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
            clearIllustrations();
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
        case "cut": handleCut(ev, wallS); break;
        case "cut-return": handleCutReturn(ev, wallS); break;
        case "pose": st.pose = ev.pose; break;
        case "arrival": handleArrival(ev, wallS); break;
        case "organum": handleOrganum(ev, wallS); break;
        case "percussion": st.tallies++; pushTally(ev.mode || "strike"); break;
        case "bruise": st.bruise = ev.value || 0; break;
        case "release": handleRelease(ev, wallS); break;
        case "feather": handleFeather(ev, wallS); break;
        case "bass-flourish": handleFlourish(ev, wallS); break;
        case "air":
          // the waterphone apparition stamps its emblem in the hush (§1b)
          if (track === "sycorax" && ev.voice === "waterphone" && cutActive(aNow())) {
            stampEmblem("apparition", 10, { tint2: pal.witch ? pal.witch[1] : undefined, witch: true });
          }
          break;
        default: break;
      }
    }
    function pushTally(kind) {
      st.tallyKinds.push(kind);
      if (st.tallyKinds.length > 8) st.tallyKinds.shift();
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
      st.lastCadence = { kind: ev.kind, label: ev.label || ev.kind, rootStep: rootStep, at: wallS };
      if (track === "library") {
        // gilt line + the arrival root's metal sigil, stamped (§4) — gilt,
        // not rubric, now that the emblem column sits on the night window
        var sig = rootStep != null ? Skin.DEGREE_SIGIL[rootStep] : null;
        addPlateIllustration(20, function (G, age, x, y) {
          var life = 1 - age;
          var c = G.ctx;
          c.strokeStyle = pal.gilt[1]; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(x - 22, y + 14); c.lineTo(x + 22, y + 14); c.stroke();
          if (sig) at.stamp(c, "sigil-" + sig, x, y - 2, { u: G.u, scale: 2, tint: pal.gilt[0], fade: life, seed: seed + 7 });
          if (fontsReady) Skin.Type.smallCaps(c, ev.label || ev.kind, x, y + 26, 13, pal.gilt[1], 1, "center");
        });
      } else if (track === "ariel") {
        var glyph = ev.kind === "float" ? "feather" : "glyph-lift";
        addPlateIllustration(18, function (G, age, x, y) {
          at.stamp(G.ctx, glyph, x, y, {
            u: G.u, scale: 2, fade: 1 - age, seed: seed + 11,
            tint: pal.silver[0], tint2: pal.gilt[1],
          });
          if (fontsReady) Skin.Type.smallCaps(G.ctx, ev.kind, x, y + 24, 12, pal.silver[1], 1, "center");
        });
      }
      // sycorax has no cadences by design — darkening arrivals handled via "arrival"
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
      if (track === "library") {
        stampEmblem("op-transmutatio", 22, {});
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
      } else if (track === "sycorax") {
        // the chant intones it: a worn, double-struck print of last night's
        // line — a doubled bone rule on the plate (§4)
        addPlateIllustration(14, function (G, age, x, y) {
          var c = G.ctx, life = 1 - age;
          c.strokeStyle = rgba(pal.bone[1], 0.9 * life); c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(x - 30, y); c.lineTo(x + 30, y - 4); c.stroke();
          c.beginPath(); c.moveTo(x - 29, y + 3); c.lineTo(x + 31, y - 1); c.stroke();
          if (fontsReady) Skin.Type.smallCaps(c, "ghost", x, y + 16, 12, pal.bone[1], 1, "center");
        });
      } else {
        // the returning bird: prior evening's flight-line ghosted under tonight's
        st.ghostLineUntil = wallS + 90;
      }
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
        if (ev.type === "answer") {
          addPlateIllustration(10, function (G, age, x, y) {
            at.stamp(G.ctx, "wingbeat", x, y, { u: G.u, scale: 2, fade: 1 - age, seed: seed + 3, tint: pal.sky[1] });
          });
        }
      }
    }

    function handleCoagula(ev, wallS) {
      st.tree.push({ gen: 9, name: ev.name, coagula: true });
      marginStack.invalidate("furniture");
      stampEmblem("ouroboros", 24, {});
    }

    function handleCut(ev, wallS) {
      st.cut = { tB: ev.t, sev: clamp01(ev.severity || 0.5), dip: ev.dip, ret: null };
    }
    function handleCutReturn(ev, wallS) {
      // OWNER RULING: no scar. The slash + skip-print visualize the real
      // audio dip and fade out COMPLETELY with the return ramp — nothing
      // persistent stays on the plate. The carried bruise's only visual
      // residue is the treeline margin darkening slightly (drawTreeline).
      if (st.cut) st.cut.ret = { t: ev.t, s: ev.returnS || 4 };
    }
    // the cut is an AUDIO event again — no slash, no hush on the coil
    // (owner 2026-07-20; sycorax spiral dramaturgy waits for that track's
    // planned rework). cutActive still gates the waterphone apparition.
    function cutActive(audioT) {
      var c = st.cut;
      if (!c) return false;
      if (audioT < c.tB) return false;
      if (c.ret && audioT > c.ret.t + c.ret.s) { st.cut = null; return false; }
      return true;
    }

    function handleArrival(ev, wallS) {
      // darkening arrivals gouge the pose sigil deeper (§4 sycorax cadence row)
      var pose = st.pose;
      if (!pose || !at.has("pose-" + pose)) return;
      addPlateIllustration(12, function (G, age, x, y) {
        at.stamp(G.ctx, "pose-" + pose, x, y, {
          u: G.u, scale: 3, fade: 1 - age * age, seed: seed + 13, tint: pal.bone[0],
        });
      });
    }

    function handleOrganum(ev, wallS) {
      addPlateIllustration(8, function (G, age, x, y) {
        var c = G.ctx, life = 1 - age;
        c.strokeStyle = rgba(pal.bone[0], life); c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x - 22, y - 4); c.lineTo(x + 22, y - 4); c.stroke();
        c.beginPath(); c.moveTo(x - 22, y + 4); c.lineTo(x + 22, y + 4); c.stroke();
      });
    }

    function handleRelease(ev, wallS) {
      // the plate's horizon sinks through the release (§1c)
      st.releaseAt = wallS; st.releaseDur = ev.durS || 60;
      plateStack.invalidate("furniture");
    }

    function handleFeather(ev, wallS) {
      addPlateIllustration(12, function (G, age, x, y) {
        at.stamp(G.ctx, "feather", x, y, {
          u: G.u, scale: 2, fade: 1 - age, seed: seed + 21,
          tint: pal.silver[0],
        });
      });
    }
    function handleFlourish(ev, wallS) {
      addPlateIllustration(8, function (G, age, x, y) {
        var c = G.ctx;
        c.strokeStyle = dataCol(pal.silver[0], "bass-flourish");
        c.lineWidth = 1.4;
        c.beginPath();
        c.moveTo(x - 16, y + 8); c.quadraticCurveTo(x, y - 14, x + 16, y + 4);
        c.stroke();
      });
    }

    // L3 placement: emblems live in the plate's left margin column, cycling
    // four slots so consecutive events never overprint. The age handed to
    // draw() is HOLD-THEN-DECAY eased: full ink for the first 45% of the
    // ttl, then the re-threshold absorption — a stamp should be READ before
    // the page drinks it.
    function addPlateIllustration(ttl, draw) {
      var slot = st.emblemSlot++ % 4;
      plateStack.addIllustration({
        ttl: ttl,
        draw: function (G, age) {
          var eased = age < 0.45 ? 0 : (age - 0.45) / 0.55;
          var x = G.w * 0.085;
          var y = G.h * (0.16 + slot * 0.2);
          draw(G, eased, x, y);
        },
      }, nowFn() / 1000);
    }
    function stampEmblem(name, ttl, o) {
      if (!at.has(name)) return;
      addPlateIllustration(ttl, function (G, age, x, y) {
        at.stamp(G.ctx, name, x, y, {
          u: G.u, scale: 2, fade: 1 - age, seed: seed + 31,
          // library emblems gild on the night window (ink is invisible there)
          tint: o.witch ? (pal.witch ? pal.witch[1] : pal.primary)
            : (track === "library" ? pal.gilt[0] : undefined),
          tint2: o.tint2,
        });
      });
    }
    function clearIllustrations() {
      plateStack.illustrations.length = 0;
    }

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
        } else if (ev.voice === "hum" && of != null) {
          // v1: the vowel-shaped hum bar (viz.js:1292–1319). The v2 events
          // don't carry the mouth's vowel — neutral "uh" until the engine
          // emits it (additive event change, flagged in PLAN-NIGHT-FOLIO).
          st.humNote = { of: of, freq: ev.freq, vowel: ev.vowel || "uh", endTime: t + (ev.durS || 1) };
        } else if (ev.voice === "drone" && ev.deg != null) {
          upsertDrone(ev, t);
        }
      } else if (track === "sycorax") {
        if ((ev.voice === "chant" || ev.voice === "rebec" || ev.voice === "boneflute") && of != null) {
          pushMark({ kind: "cutline", of: of, t: t, life: Math.min(ev.durS || 1.5, 4), vel: ev.velocity || 0.6 });
        } else if (ev.voice === "protodrum") {
          if (ev.kind === "lub" || ev.kind === "dub") st.pulseAt = t;
        } else if (ev.voice === "waterphone" && of != null) {
          pushMark({ kind: "tine", of: of, t: t, life: Math.min(ev.durS || 3, 6) });
        } else if (ev.voice === "gurdy" && ev.deg != null) {
          upsertDrone(ev, t);
        }
      } else { // ariel
        if (ev.voice === "whistle" && of != null) {
          // v1: the whistle IS the lollipop (viz.js:1137–1228) — tracked
          // pitch, stem off the baseline, glowing head riding the crest
          st.whistle = { of: of, freq: ev.freq, until: t + (ev.durS || 2) + 0.4 };
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
        } else if (ev.voice === "flutter" && of != null) {
          pushMark({ kind: "wing", of: of, t: t, life: 1.4 });
        } else if (ev.voice === "bass" && of != null) {
          // v1: the bass ripples the baseline (viz.js:729) — no diamond mark
          st.bassPlucks.push({ of: of, t: t, vel: ev.velocity || 0.8, freq: ev.freq });
          if (st.bassPlucks.length > 24) st.bassPlucks.shift();
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
    function plateMetrics(G) {
      var CX = G.w * 0.5, CY = G.h * 0.485 + st.sinkPx;
      var baseRadius = Math.min(G.h * 0.21, G.w * 0.27);
      return {
        CX: CX, CY: CY,
        R: baseRadius,
        // v1's coil proportions (prosperos-jukebox-viz.js:1394–1397)
        oct: baseRadius * 0.55,
        peak: baseRadius * 0.55 * 1.5,
      };
    }

    function drawPlateFurniture(G) {
      // no caption (owner 2026-07-20: the explanatory line under the
      // spiral is gone), no corner schema, no persistent marks (no-scar
      // ruling) — the plate's only furniture is Ariel's horizon
      if (track === "ariel") {
        drawHorizon(G);
      }
    }

    function drawHorizon(G) {
      var c = G.ctx;
      var sink = 0;
      if (st.releaseAt != null) {
        sink = clamp01((nowFn() / 1000 - st.releaseAt) / (st.releaseDur || 60)) * G.h * 0.05;
      }
      var hy = G.h * 0.86 + sink;
      c.save();
      c.setLineDash([2, 5]);
      c.strokeStyle = pal.silver[2]; c.lineWidth = 1;
      c.beginPath(); c.moveTo(G.w * 0.08, hy); c.lineTo(G.w * 0.92, hy); c.stroke();
      c.restore();
      if (fontsReady) {
        // label lives on the plate ring, left of the night window — the
        // dashed line itself passes honestly behind the floor
        Skin.Type.smallCaps(c, "horizon — sinks through the release", G.w * 0.075, hy - 6, 12, pal.silver[1], 2);
      }
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
    var HARP_TAU = 2, HARP_SIGMA_OCT = 0.05, HARP_LIFETIME = 7, HARP_AMP = 80;
    var BASS_TAU = 2.5, BASS_SIGMA_OCT = 0.06, BASS_LIFETIME = 8, BASS_AMP = 80;
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

    // the whistle lollipop tracker — v1's updateLollipop3D (viz.js:1137),
    // event-tracked pitch, head height from the live display magnitude
    function updateLollipop(M, audioT) {
      var wn = st.whistle;
      if (wn && audioT > wn.until) { st.whistle = wn = null; }
      var lp = st.lolli;
      if (wn) {
        var octIdx = Math.floor(wn.of);
        if (lp && lp.framesQuiet <= 3) octIdx = lp.octIdx;
        var fracIn = clamp(wn.of - octIdx, 0, 0.999);
        var iB = clamp(Math.round(wn.of * SPT), 0, TOTAL - 1);
        var theta = fracIn * 2 * Math.PI;
        var yBase = (octIdx + fracIn - (OCTAVES - 1) / 2) * M.oct;
        var yHead = yBase + magnitudes[iB] * M.peak;
        if (!lp || lp.framesQuiet > 3) {
          st.lolli = { theta: theta, yBase: yBase, yHead: yHead, octIdx: Math.floor(wn.of), framesQuiet: 0 };
        } else {
          var dT = theta - lp.theta;
          while (dT > Math.PI) dT -= 2 * Math.PI;
          while (dT < -Math.PI) dT += 2 * Math.PI;
          lp.theta += dT * HEAD_SMOOTH;
          lp.yHead += (yHead - lp.yHead) * HEAD_SMOOTH;
          lp.yBase = yBase; lp.framesQuiet = 0;
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
      st.humLevel = st.humLevel * 0.55 + magnitudes[center] * 0.45;
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
      // axis text, then the over-the-coil decorations
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
      // the scale caption, top-right inside the window
      c.font = '12px "VT323", monospace';
      c.fillStyle = spRGBA(o, 0.55);
      c.fillText(cfg.scaleLabel, M.CX + M.R + 10, M.CY - M.oct * 3.2 * cp1);
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
          var yC = yW + magnitudes[iC] * M.peak;
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
    function marginLayout(G) {
      var H = G.h, W = G.w, pad = 8;
      return {
        pad: pad, W: W, H: H,
        scene: { x: pad, y: pad, w: W - 2 * pad, h: H * 0.17 },
        dialA: { x: pad, y: H * 0.19, w: (W - 3 * pad) / 2, h: H * 0.24 },
        dialB: { x: pad * 2 + (W - 3 * pad) / 2, y: H * 0.19, w: (W - 3 * pad) / 2, h: H * 0.24 },
        rowA: { x: pad, y: H * 0.45, w: (W - 3 * pad) / 2, h: H * 0.14 },
        rowB: { x: pad * 2 + (W - 3 * pad) / 2, y: H * 0.45, w: (W - 3 * pad) / 2, h: H * 0.14 },
        tree: { x: pad, y: H * 0.61, w: W - 2 * pad, h: H * 0.37 - pad },
      };
    }
    // the content cell between heading row and readout row (dial panels)
    function cellOf(r) {
      var top = r.y + 20, bot = r.y + r.h - 14;
      if (bot < top + 8) bot = top + 8;
      return { top: top, bot: bot, cy: (top + bot) / 2, ch: bot - top };
    }
    // a single inline content line (row panels — no readout row)
    function lineOf(r) {
      var top = r.y + 20, bot = r.y + r.h - 2;
      if (bot < top + 8) bot = top + 8;
      return { top: top, bot: bot, cy: (top + bot) / 2, ch: bot - top };
    }
    // largest integer stamp scale whose rendered height fits `avail` CSS px
    function fitScale(bmpPx, avail, u) {
      var s = Math.floor(avail / (bmpPx * (u || 2)));
      return s < 1 ? 1 : s;
    }
    function marginInk() {
      return track === "library"
        ? { cap: pal.ink[2], rule: pal.ink[3], lead: pal.ink[0], mid: pal.ink[1], accent: pal.rubric[0] }
        : (track === "sycorax"
          ? { cap: pal.bone[2], rule: pal.bone[2], lead: pal.bone[0], mid: pal.bone[1], accent: pal.witch[1] }
          : { cap: pal.silver[1], rule: pal.silver[2], lead: pal.silver[0], mid: pal.silver[1], accent: pal.gilt[0] });
    }
    function panelHead(G, r, text) {
      if (!fontsReady) return;
      var c = G.ctx;
      var ic = marginInk();
      Skin.Type.smallCaps(c, text, r.x, r.y + 11, 13, ic.cap, 2);
      c.strokeStyle = ic.rule; c.lineWidth = 1;
      c.beginPath(); c.moveTo(r.x, r.y + 15); c.lineTo(r.x + r.w, r.y + 15); c.stroke();
    }
    // the readout baseline — the panel's one value line
    function readoutLine(G, r, text, col) {
      if (!fontsReady) return;
      Skin.Type.smallCaps(G.ctx, text, r.x, r.y + r.h - 3, 12, col || marginInk().mid, 1);
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
      // heading font fits the scene band; baseline stays clear of the
      // sub-line row (drawn by the data pass at y+h−12)
      var hf = Math.max(16, Math.min(30, Math.floor(L.scene.h * 0.5)));
      var emblemCell = 0;
      if (hs && track === "library") {
        var opName = "op-" + String(label).toLowerCase();
        if (at.has(opName)) {
          // the operation emblem sits in its OWN reserved cell left of the
          // heading, fit-scaled to the band — never under the letters
          var eScale = fitScale(16, Math.min(L.scene.h - 8, hf + 14), G.u);
          var eW = 16 * G.u * eScale;
          at.stamp(c, opName, L.scene.x + eW / 2, L.scene.y + 4 + hf / 2, { u: G.u, scale: eScale });
          emblemCell = eW + 8;
        }
      }
      if (fontsReady) {
        if (hs) {
          Skin.Type.drawHeader(c, track, String(label), L.scene.x + emblemCell, L.scene.y + 4 + hf, hf, { u: G.u });
        } else {
          // idle: a deliberate em-dash placeholder in the caption voice —
          // never the display face's rubricated initial on a bare dash
          Skin.Type.smallCaps(c, "—", L.scene.x, L.scene.y + 4 + hf * 0.7, 15, marginInk().cap, 2);
        }
      }
      if (hs && track === "sycorax") {
        drawStationVignette(G, L.scene);
      }
      // panel heads
      var heads = track === "library"
        ? ["the tide · volvelle", "the athanor · fire", "aer · the air", "the chord · its metal", "genealogia motivi"]
        : (track === "sycorax"
          ? ["the treeline · tide", "the smoke · intensity", "the pose", "the tallies", "the cord and bone"]
          : ["the wind-rose · tide", "the quadrant · altitude", "the chord · constellation", "the season", "migratio · the signature"]);
      panelHead(G, L.dialA, heads[0]);
      panelHead(G, L.dialB, heads[1]);
      panelHead(G, L.rowA, heads[2]);
      panelHead(G, L.rowB, heads[3]);
      panelHead(G, L.tree, heads[4]);
      // the genealogy / tally cord / migration map is furniture-grade:
      // redrawn only when an event changes it
      if (track === "library") drawGenealogy(G, L.tree);
      else if (track === "sycorax") drawTallyCord(G, L.tree);
      else drawMigration(G, L.tree);
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
      var ic = marginInk();
      // scene sub-line + progress: only once a scene exists. Idle renders
      // NOTHING here (final-gate ruling: no bare "— · x 0.00" fragments).
      if (hasScene()) {
        var x01 = info.x || 0;
        var py = L.scene.y + L.scene.h - 5;
        if (x01 > 0) {
          c.strokeStyle = dataCol(ic.lead, "scene progress"); c.lineWidth = 2;
          c.beginPath(); c.moveTo(L.scene.x, py); c.lineTo(L.scene.x + L.scene.w * x01, py); c.stroke();
        }
        c.fillStyle = ic.rule;
        for (var px = L.scene.x + L.scene.w * x01 + 6; px < L.scene.x + L.scene.w - 2; px += 6) c.fillRect(px, py - 1, 2, 2);
        if (fontsReady) {
          var sub = (info.sceneType || st.sceneType || "—") + " · x " + x01.toFixed(2)
            + (info.tideLabel ? " · " + info.tideLabel : "");
          Skin.Type.smallCaps(c, sub, L.scene.x, py - 6, 13, ic.mid, 1);
        }
      }
      if (track === "library") {
        drawVolvelle(G, L.dialA, info);
        drawAthanor(G, L.dialB, info);
        drawAirQuills(G, L.rowA, info);
        drawChordMetal(G, L.rowB, info);
      } else if (track === "sycorax") {
        drawTreeline(G, L.dialA, info);
        drawSmoke(G, L.dialB, info);
        drawPoseSigil(G, L.rowA, info);
        drawTallies(G, L.rowB, info);
      } else {
        drawWindRose(G, L.dialA, info);
        drawQuadrant(G, L.dialB, info);
        drawConstellation(G, L.rowA, info);
        drawSeason(G, L.rowB, info);
      }
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
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " · " + info.tideLabel : ""), pal.ink[1]);
    }

    function drawAthanor(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var gradus = inten == null ? 1 : 1 + Math.min(3, Math.floor(frac * 4));
      // the furnace in its own reserved cell, fit-scaled — never under the
      // heading or across the readout (final-gate fix)
      var aScale = fitScale(16, cell.ch, G.u);
      at.stamp(c, "athanor-" + gradus, r.x + r.w * 0.27, cell.cy, {
        u: G.u, scale: aScale, tint: pal.ink[0],
        tint2: inten == null ? pal.ink[1] : pal.rubric[1], // idle: cold hearth, no fire
      });
      // the gauge — four degrees of fire; fill height is data
      var gw = Math.max(10, Math.min(14, Math.floor(r.w * 0.09)));
      var gx = r.x + r.w * 0.58, gTop = cell.top, gBot = cell.bot;
      c.strokeStyle = pal.ink[1]; c.lineWidth = 1.4;
      c.strokeRect(gx, gTop, gw, gBot - gTop);
      for (var d = 1; d < 4; d++) {
        var yq = gTop + (d / 4) * (gBot - gTop);
        c.beginPath(); c.moveTo(gx, yq); c.lineTo(gx + gw, yq); c.stroke();
      }
      if (inten != null) {
        var fillH = frac * (gBot - gTop);
        Skin.Dither.fill(c, gx + 2, gBot - fillH, gw - 4, fillH, pal.rubric[0], 0.5, { u: G.u });
        c.fillStyle = dataCol(pal.rubric[0], "athanor gauge line");
        c.fillRect(gx, gBot - fillH - 1, gw, 2);
      }
      readoutLine(G, r, "fire " + fmt2(inten) + " · gradus " + (inten == null ? "—" : ROMAN_HI[gradus - 1]), pal.ink[1]);
    }

    function drawAirQuills(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var n = typeof info.airHolders === "number" ? info.airHolders
        : (info.airHolders && info.airHolders.length);
      var count = n == null ? 0 : n;
      var limit = Math.max(3, count);
      var qScale = fitScale(12, line.ch, G.u);
      var slot = 12 * G.u * qScale + 6;
      var x = r.x + slot / 2;
      for (var i = 0; i < limit; i++) {
        if (i < count) at.stamp(c, "quill", x, line.cy, { u: G.u, scale: qScale, tint: i === 0 ? pal.ink[0] : pal.ink[1] });
        else { // an inked rest — the air not yet taken
          var rs = Math.min(10, line.ch / 2 - 1);
          c.strokeStyle = pal.ink[3]; c.lineWidth = 1.4;
          c.strokeRect(x - rs, line.cy - rs, rs * 2, rs * 2);
          c.beginPath(); c.moveTo(x - rs * 0.4, line.cy + rs * 0.4); c.lineTo(x + rs * 0.4, line.cy - rs * 0.4); c.stroke();
        }
        x += slot;
      }
      // the value rides BESIDE the icons on the same line — never beneath
      if (fontsReady) {
        Skin.Type.smallCaps(c, (n == null ? "—" : n + " aloft"), x + 2, line.cy + 4, 12, pal.ink[1], 1);
      }
    }

    function drawChordMetal(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var name = info.harmony == null ? "—" : String(info.harmony);
      var idx = info.harmony == null ? null : parseRomanRoot(name);
      var sigW = 12 * G.u + 6; // the sigil's reserved right cell
      if (fontsReady) {
        var fs = Math.min(26, line.ch + 4);
        c.fillStyle = pal.ink[0];
        c.font = fs + "px " + Skin.Type.MONO;
        c.textBaseline = "alphabetic"; c.textAlign = "left";
        c.fillText(name.slice(0, 8), r.x + 2, line.cy + fs * 0.36);
      }
      if (idx != null) {
        var sig = Skin.DEGREE_SIGIL[era.steps[idx]];
        if (sig) {
          at.stamp(c, "sigil-" + sig, r.x + r.w - sigW / 2 - 2, line.cy, {
            u: G.u, scale: fitScale(12, line.ch, G.u), tint: pal.rubric[0],
          });
        }
      }
    }

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
      if (st.signature && fontsReady) {
        Skin.Type.smallCaps(c, "theme " + st.signature, r.x, r.y + r.h - 2, 12, pal.ink[2], 1);
      }
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
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " · " + info.tideLabel : ""), pal.bone[1]);
    }

    function drawSmoke(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var bx = r.x + r.w / 2, bot = cell.bot, top = cell.top;
      var colH = (bot - top) * frac;
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
      readoutLine(G, r, "intensity " + fmt2(inten) + " · bruise " + fmt2(st.bruise || (inten == null ? null : 0)), pal.bone[1]);
    }

    function drawPoseSigil(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var pose = info.pose || st.pose;
      var x = r.x + 2;
      if (pose && at.has("pose-" + pose)) {
        var pScale = fitScale(12, line.ch, G.u);
        var pw = 12 * G.u * pScale;
        at.stamp(c, "pose-" + pose, x + pw / 2, line.cy, { u: G.u, scale: pScale, tint: pal.bone[0] });
        x += pw + 8;
      }
      // name + root ride the same line, beside the sigil (never beneath)
      if (fontsReady) {
        var txt = (pose || "—") + (info.rootDeg != null ? " · root " + info.rootDeg : "");
        Skin.Type.smallCaps(c, txt, x, line.cy + 4, 13, pal.bone[0], 1);
      }
    }

    function drawTallies(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var n = st.tallies;
      var groups = Math.min(8, Math.floor(n / 5)), rem = Math.min(n, 40) % 5;
      var y0 = line.cy;
      var hh = Math.min(8, line.ch / 2 - 1); // stroke half-height fits the line
      c.strokeStyle = dataCol(pal.bone[0], "percussion tallies"); c.lineWidth = 1.4;
      var x = r.x + 4;
      var xCap = r.x + r.w - 62; // reserve the value's room on the same line
      function strokes(count, gate) {
        for (var i = 0; i < count; i++) {
          c.beginPath();
          c.moveTo(x + i * 5 + (Skin.noise.hash2(i, x) - 0.5) * 1.5, y0 - hh);
          c.lineTo(x + i * 5 + (Skin.noise.hash2(i, x + 1) - 0.5) * 1.5, y0 + hh);
          c.stroke();
        }
        if (gate) { // the fifth stroke crosses
          c.beginPath(); c.moveTo(x - 2, y0 + hh - 2); c.lineTo(x + 22, y0 - hh + 2); c.stroke();
        }
        x += 30;
      }
      for (var g = 0; g < groups && x < xCap; g++) strokes(4, true);
      if (x < xCap && rem > 0) strokes(rem, false);
      if (fontsReady) {
        Skin.Type.smallCaps(c, n + " strokes", r.x + r.w, y0 + 4, 12, pal.bone[1], 1, "right");
      }
    }

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
      readoutLine(G, r, "tide " + fmt2(tide) + (info.tideLabel ? " ✦ " + info.tideLabel : ""), pal.silver[1]);
    }

    function drawQuadrant(G, r, info) {
      var c = G.ctx;
      var cell = cellOf(r);
      var inten = info.intensity;
      var frac = inten == null ? 0 : clamp01((inten - 0.04) / (0.65 - 0.04));
      var ox = r.x + 8, oy = cell.bot, R = Math.min(r.w - 36, cell.ch);
      if (R < 12) R = 12;
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
      readoutLine(G, r, "altitude " + fmt2(inten), pal.silver[1]);
    }

    function drawConstellation(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var name = info.harmony == null ? "—" : String(info.harmony);
      var idx = info.harmony == null ? null : parseRomanRoot(name);
      // the two Lydian homes as VECTOR asterisms scaled to the line (the
      // stamped cells are taller than a row panel — drawAsterism is the
      // full-resolution vocabulary for exactly this)
      var s = Math.min(0.55, line.ch / 44);
      var ay = line.cy - 2 * s;
      Skin.drawAsterism(c, Skin.asterisms.i, r.x + 4, ay, { track: "ariel", scale: s, lit: idx === 0 });
      Skin.drawAsterism(c, Skin.asterisms.ii, r.x + 4 + 52 * s + 14, ay, { track: "ariel", scale: s, lit: idx === 1 });
      // the #4 — a lone gilt star only the halo lights
      var halo = info.haloLevel || 0;
      var sx = r.x + r.w - 10;
      if (halo > 0.03) Skin.star4(c, sx, line.cy - 4, 3.5, pal.gilt[1], halo > 0.05);
      else { c.fillStyle = pal.silver[2]; c.fillRect(sx - 1, line.cy - 5, 2, 2); }
      if (fontsReady) {
        Skin.Type.smallCaps(c, name.slice(0, 10), r.x + r.w, line.bot, 12, pal.silver[0], 1, "right");
      }
    }

    function drawSeason(G, r, info) {
      var c = G.ctx;
      var line = lineOf(r);
      var sig = info.signature || {};
      if (fontsReady) {
        Skin.Type.smallCaps(c, (sig.name || "—") + (sig.promoted ? " ✦ promoted" : ""),
          r.x + 2, line.top + 9, 13, sig.promoted ? pal.gilt[1] : pal.silver[0], 1);
        if (line.bot - line.top >= 22) {
          Skin.Type.smallCaps(c, "gen " + (sig.themeGen == null ? "—" : sig.themeGen)
            + " · deepest " + (sig.maxGen == null ? "—" : sig.maxGen),
            r.x + 2, line.top + 21, 12, pal.silver[1], 1);
        }
      }
    }

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

    // ============================================================== FOOTER ==
    var densityHist = []; // {t: audio time, v: intensity}
    function drawFooterFurniture(G) {
      var c = G.ctx;
      var lead = track === "library" ? pal.ink[3] : (track === "sycorax" ? pal.bone[2] : pal.silver[2]);
      var capCol = track === "library" ? pal.ink[2] : (track === "sycorax" ? pal.bone[2] : pal.silver[1]);
      c.strokeStyle = lead; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, G.h * 0.86); c.lineTo(G.w, G.h * 0.86); c.stroke();
      c.save(); c.setLineDash([1, 5]);
      c.beginPath(); c.moveTo(0, G.h * 0.18); c.lineTo(G.w, G.h * 0.18); c.stroke();
      c.restore();
      if (fontsReady) {
        Skin.Type.smallCaps(c, "0.04", 3, G.h * 0.84, 12, capCol, 0);
        Skin.Type.smallCaps(c, "0.65", 3, G.h * 0.18 + 11, 12, capCol, 0);
        Skin.Type.smallCaps(c, "densitas · measured intensity in ink, forecast pricked for pouncing", 44, 13, 13, capCol, 1);
      }
    }
    function drawFooterData(G, tr, tNow) {
      var c = G.ctx;
      var t = aNow();
      var lead = track === "library" ? pal.ink[0] : (track === "sycorax" ? pal.bone[0] : pal.silver[0]);
      var dot = track === "library" ? pal.ink[1] : (track === "sycorax" ? pal.bone[1] : pal.silver[1]);
      var accent = track === "library" ? pal.rubric[0] : (track === "sycorax" ? pal.witch[1] : pal.gilt[0]);
      var SPAN_PAST = 150, SPAN_FUT = 45;
      var nowX = G.w * (SPAN_PAST / (SPAN_PAST + SPAN_FUT));
      function yOf(v) {
        var frac = clamp01((v - 0.04) / (0.65 - 0.04));
        return G.h * 0.86 - frac * (G.h * 0.86 - G.h * 0.18);
      }
      // past: solid ink from the poll history (real telemetry)
      c.strokeStyle = dataCol(lead, "density past");
      c.lineWidth = 2;
      c.beginPath();
      var started = false;
      for (var i = 0; i < densityHist.length; i++) {
        var s = densityHist[i];
        var x = nowX - (t - s.t) / SPAN_PAST * nowX;
        if (x < 0) continue;
        var y = yOf(s.v);
        if (!started) { c.moveTo(x, y); started = true; } else c.lineTo(x, y);
      }
      if (started) c.stroke();
      // forecast: pricked pounce-holes — the documented substitution (no
      // engine getDensityAt): held at the current level, tide slope applied
      var last = densityHist.length ? densityHist[densityHist.length - 1].v : 0.2;
      var slope = 0;
      if (densityHist.length > 20) {
        var a20 = densityHist[densityHist.length - 20];
        slope = (last - a20.v) / Math.max(0.1, t - a20.t);
      }
      c.fillStyle = dot;
      for (var x2 = nowX + 6; x2 < G.w - 2; x2 += 7) {
        var dt = (x2 - nowX) / (G.w - nowX) * SPAN_FUT;
        var v = clamp(last + slope * dt * 0.5, 0.04, 0.65);
        c.beginPath(); c.arc(x2, yOf(v), 1.3, 0, Math.PI * 2); c.fill();
      }
      // NOW
      c.strokeStyle = accent; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(nowX, 4); c.lineTo(nowX, G.h - 4); c.stroke();
      if (fontsReady) Skin.Type.smallCaps(c, "nunc", nowX + 5, 13, 13, accent, 1);
    }

    // ============================================================ LIFECYCLE ==
    function pollInfo() {
      if (!engine) return;
      var info;
      try { info = engine.getInfo(); } catch (e) { return; }
      if (!info) return;
      lastInfo = info;
      if (info.intensity != null) {
        densityHist.push({ t: aNow(), v: info.intensity });
        if (densityHist.length > DENSITY_KEEP) densityHist.shift();
      }
      if (info.sceneLabel && info.sceneLabel !== st.sceneLabel) {
        st.sceneLabel = info.sceneLabel; st.sceneType = info.sceneType;
        marginStack.invalidate("furniture");
      } else if (!info.sceneLabel && info.sceneType && info.sceneType !== st.sceneType) {
        st.sceneType = info.sceneType; st.sceneLabel = info.sceneType;
        marginStack.invalidate("furniture");
      }
      if (info.sceneIdx != null) { st.sceneIdx = info.sceneIdx; st.sceneCount = info.sceneCount || st.sceneCount; }
      if (info.pose) st.pose = info.pose;
      if (info.signature) st.signature = info.signature.name || st.signature;
      if (info.motif && info.motif.working && !st.signature) st.signature = info.motif.working.theme;
      // era safety net: if the engine exposes tonicHz, trust it
      if (info.tonicHz) {
        var pc = pcFromHz(info.tonicHz);
        if (pc !== era.tonicPc) { era.tonicPc = pc; plateStack.invalidate("furniture"); }
      }
      // the ariel horizon sinks through the release — it lives on the
      // furniture layer, so rebake it at poll cadence while a release runs
      if (track === "ariel" && st.releaseAt != null) {
        var relX = (nowFn() / 1000 - st.releaseAt) / (st.releaseDur || 60);
        if (relX <= 1.05) plateStack.invalidate("furniture");
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
      plateStack.composite(tNow);
      marginStack.composite(tNow);
      footerStack.composite(tNow);
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
      var f = measure(footerCanvas, opts.footerW || 900, opts.footerH || 64);
      // the night window: a slim, even rounded-square border (owner
      // 2026-07-20 — "square frame with rounded corners", less frame)
      var pad = Math.max(16, Math.round(Math.min(p.w, p.h) * 0.03));
      plateZones.plateZone.cx = p.w * 0.5;
      plateZones.plateZone.cy = p.h * 0.5;
      plateZones.plateZone.rx = p.w * 0.5 - pad;
      plateZones.plateZone.ry = p.h * 0.5 - pad;
      plateZones.plateZone.r = Math.max(14, Math.round(Math.min(p.w, p.h) * 0.045));
      function apply(stack, s) {
        var G = stack.G();
        if (Math.abs(G.w - s.w) < 1 && Math.abs(G.h - s.h) < 1) return;
        if (immediate) stack.resize(s.w, s.h);
        else stack.scheduleResize(s.w, s.h);
      }
      apply(plateStack, p);
      apply(marginStack, m);
      apply(footerStack, f);
    }

    var viz = {
      // ---- the contract surface ----
      setTrack: function (t) {
        if (!TRACK_CFG[t]) throw new Error("PJ2.Viz.setTrack: unknown track '" + t + "'");
        if (t === track) return;
        track = t; cfg = TRACK_CFG[t];
        pal = Skin.palette(t); at = Skin.atlas(t);
        plateStack.setTrack(t); marginStack.setTrack(t); footerStack.setTrack(t);
        resetRunState();
        clearIllustrations();
        densityHist.length = 0;
        for (var i = 0; i < TOTAL; i++) { baselineLin[i] = 0; magnitudes[i] = 0; }
        rebuildSampleIdx();
        lastInfo = {};
        invalidateFurniture();
      },
      getTrack: function () { return track; },

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
        plateStack.composite(t); marginStack.composite(t); footerStack.composite(t);
      },
      _injectEvent: onEvent,   // bench-only: art-direct §4 illustrations on demand
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
          era: { tonicPc: era.tonicPc },
          plateMs: plateStack.lastCompositeMs(),
          illustrations: plateStack.illustrations.length,
          info: lastInfo,
        };
      },
      _stacks: { plate: plateStack, margin: marginStack, footer: footerStack },
    };

    return viz;
  }

  return { create: create, TRACK_CFG: TRACK_CFG };
})();

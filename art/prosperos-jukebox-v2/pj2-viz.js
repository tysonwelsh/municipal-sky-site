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
// baseline, drag + auto-rotate camera), the per-track quad-pass costume
// (codex Bayer ink-wash / grimoire woodcut band / atlas engraver's
// hatching), the margin apparatus (§4 diegetic telemetry), the §4 per-event
// illustrations on the L3 alive-list, and the density footer.
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
  var YAW_RATE = 2 * Math.PI / 60;   // 1 rpm auto-rotate (mockup-1's read)
  var POLL_MS = 300;
  var DENSITY_KEEP = 1200;           // ~6 min of poll samples

  // per-track configuration: the FFT anchor (v1's table), the field's home
  // era (tonic + mode steps), and display strings.
  var TRACK_CFG = {
    library: {
      anchorPc: 0, anchorName: "C",
      homeTonicHz: 262, steps: [0, 2, 3, 5, 7, 9, 10], modeName: "dorian",
      caption: "figura I · the coil of pitches — seven turns, one per octave · in-key degrees bear their metal",
    },
    sycorax: {
      anchorPc: 3, anchorName: "Eb",
      homeTonicHz: 311, steps: [0, 1, 3, 4, 5, 7, 8], modeName: "sycorax",
      caption: "the block · seven turns cut in relief · the keening notch at the flat second",
    },
    ariel: {
      anchorPc: 5, anchorName: "F",
      homeTonicHz: 349, steps: [0, 2, 4, 6, 7, 9, 11], modeName: "lydian",
      caption: "carta caelestis · seven turns engraved · the tonic bears the gilt star",
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

    // the pen's authored wobble on the baseline coil (furniture flavor —
    // deterministic, identical every frame; never touches the data contour)
    var wobble = new Float32Array(TOTAL + 1);
    (function () {
      for (var i = 0; i <= TOTAL; i++) {
        wobble[i] = (Skin.noise.vnoise((i / SPT) * 24.7, 3.1) - 0.5) * 2.4;
      }
    })();

    // projection scratch (reused every frame — no per-frame allocation)
    var innerX = new Float32Array(TOTAL + 1), innerY = new Float32Array(TOTAL + 1), innerZ = new Float32Array(TOTAL + 1);
    var outerX = new Float32Array(TOTAL + 1), outerY = new Float32Array(TOTAL + 1), outerZ = new Float32Array(TOTAL + 1);
    var order = new Int32Array(TOTAL + 12);   // quads 0..TOTAL-1, dial items TOTAL..
    var orderZ = new Float32Array(TOTAL + 12);
    var orderArr = [];                        // Array mirror for .sort
    (function () { for (var i = 0; i < TOTAL + 12; i++) orderArr.push(i); })();

    // per-run visual state (reset on setTrack / engine play / reseed)
    var era = { tonicPc: pcFromHz(cfg.homeTonicHz), steps: cfg.steps };
    var st = null; // set by resetRunState()
    function resetRunState() {
      era = { tonicPc: pcFromHz(cfg.homeTonicHz), steps: cfg.steps.slice() };
      st = {
        marks: [],            // note-driven overlay marks
        droneSet: [],         // library lower-schema nodes {deg, oct, until}
        whistle: null,        // ariel plumb-bob {of, until}
        pulseAt: -1e9,        // sycorax proto-drum last lub (audio t)
        keenAt: -1e9,         // sycorax keening flash (audio t)
        tallies: 0,           // sycorax percussion strokes this evening
        tallyKinds: [],       // recent percussion kinds (margin readout)
        tree: [],             // library genealogy nodes {gen, name, ghost, answer, coagula}
        migration: [],        // ariel develop/answer gens
        inkShift: null,       // library re-oxidation {t0 (wall s), warm}
        regild: null,         // ariel plate re-gild {t0 (wall s), fromPc}
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
    var plateZones = { plateZone: { cx: 0, cy: 0, rx: 1, ry: 1 } };
    var marginZones = { quietRects: [{ x: 0, y: 0, w: 4000, h: 4000 }] };
    var footerZones = { quietRects: [{ x: 0, y: 0, w: 4000, h: 4000 }] };

    var plateStack = Skin.stack(plateCanvas, track, {
      seed: seed, w: opts.plateW || 900, h: opts.plateH || 860,
      dpr: opts.dpr, zones: plateZones,
      setTimeout: opts.setTimeout, clearTimeout: opts.clearTimeout,
      renderers: { furniture: drawPlateFurniture, data: drawPlateData },
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
        // rubricated line + the arrival root's metal sigil, stamped (§4)
        var sig = rootStep != null ? Skin.DEGREE_SIGIL[rootStep] : null;
        addPlateIllustration(20, function (G, age, x, y) {
          var life = 1 - age;
          var c = G.ctx;
          c.strokeStyle = pal.rubric[0]; c.lineWidth = 1.4;
          c.beginPath(); c.moveTo(x - 22, y + 14); c.lineTo(x + 22, y + 14); c.stroke();
          if (sig) at.stamp(c, "sigil-" + sig, x, y - 2, { u: G.u, scale: 2, tint: pal.rubric[0], fade: life, seed: seed + 7 });
          if (fontsReady) Skin.Type.smallCaps(c, ev.label || ev.kind, x, y + 26, 13, pal.rubric[0], 1, "center");
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
        var newPc = pcFromHz(ev.field.tonicHz);
        var reroot = !!(ev.field.mode && ev.field.mode !== cfg.modeName);
        var fromPc = era.tonicPc;
        era.tonicPc = newPc;
        // (mode steps stay the track's — engines modulate within family)
        if (track === "library") st.inkShift = { t0: wallS, warm: reroot };
        if (track === "ariel") st.regild = { t0: wallS, fromPc: fromPc };
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
      st.regild = { t0: wallS, fromPc: era.tonicPc };
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
    function cutActive(audioT) {
      var c = st.cut;
      if (!c) return false;
      if (audioT < c.tB) return false;
      if (c.ret && audioT > c.ret.t + c.ret.s) return false;
      return true;
    }
    // ink presence during the cut: print drops to ~25% for the hold, ramps
    // home over the return (matching cutGain's shape)
    function hushStep(audioT) {
      var c = st.cut;
      if (!c || audioT < c.tB) return 1;
      var floor = 0.25;
      if (!c.ret) return floor;
      if (audioT <= c.ret.t) return floor;
      var p = clamp01((audioT - c.ret.t) / Math.max(0.001, c.ret.s));
      if (p >= 1) { st.cut = null; return 1; }
      return floor + (1 - floor) * p;
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
          tint: o.witch ? (pal.witch ? pal.witch[1] : pal.primary) : undefined,
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
          pushMark({ kind: "flick", of: of, t: t, life: 2.2, vel: ev.velocity || 0.7 });
        } else if (ev.voice === "musicbox" && of != null) {
          pushMark({ kind: "glint", of: of, t: t, life: 1.6, vel: ev.velocity || 0.5 });
        } else if (ev.voice === "hum" && of != null) {
          pushMark({ kind: "column", of: of, t: t, life: Math.min(ev.durS || 4, 10) });
        } else if (ev.voice === "drone" && ev.deg != null) {
          upsertDrone(ev.deg, t + (ev.durS || 8));
        }
      } else if (track === "sycorax") {
        if ((ev.voice === "chant" || ev.voice === "rebec" || ev.voice === "boneflute") && of != null) {
          pushMark({ kind: "cutline", of: of, t: t, life: Math.min(ev.durS || 1.5, 4), vel: ev.velocity || 0.6 });
          // the keening law made visible: phrase-final notes on the flat
          // second tick a bone notch at degree 1's angle (§1b)
          if (ev.final && ev.freq) {
            var off = ((pcFromHz(ev.freq) - era.tonicPc) % 12 + 12) % 12;
            if (off === 1) st.keenAt = t;
          }
        } else if (ev.voice === "protodrum") {
          if (ev.kind === "lub" || ev.kind === "dub") st.pulseAt = t;
        } else if (ev.voice === "waterphone" && of != null) {
          pushMark({ kind: "tine", of: of, t: t, life: Math.min(ev.durS || 3, 6) });
        } else if (ev.voice === "gurdy" && ev.deg != null) {
          upsertDrone(ev.deg, t + (ev.durS || 8));
        }
      } else { // ariel
        if (ev.voice === "whistle" && of != null) {
          st.whistle = { of: of, until: t + (ev.durS || 2) + 0.4 };
        } else if (ev.voice === "chime" && of != null) {
          pushMark({ kind: "bubble", of: of, t: t, life: 2.6, vel: ev.velocity || 0.5 });
        } else if (ev.voice === "flutter" && of != null) {
          pushMark({ kind: "wing", of: of, t: t, life: 1.4 });
        } else if (ev.voice === "bass" && of != null) {
          pushMark({ kind: "bassmark", of: of, t: t, life: Math.min(ev.durS || 2, 5) });
        } else if (ev.voice === "breeze" && ev.deg != null) {
          upsertDrone(ev.deg, t + (ev.durS || 8));
        }
      }
    }
    function pushMark(m) {
      st.marks.push(m);
      if (st.marks.length > 160) st.marks.shift();
    }
    function upsertDrone(deg, until) {
      for (var i = 0; i < st.droneSet.length; i++) {
        if (st.droneSet[i].deg === deg) { st.droneSet[i].until = until; return; }
      }
      st.droneSet.push({ deg: deg, until: until });
      if (st.droneSet.length > 6) st.droneSet.shift();
    }

    // ============================================================ PLATE L1 ==
    function plateMetrics(G) {
      var CX = G.w * 0.5, CY = G.h * 0.485 + st.sinkPx;
      var baseRadius = Math.min(G.h * 0.21, G.w * 0.27);
      return {
        CX: CX, CY: CY,
        R: baseRadius,
        oct: baseRadius * 0.46,
        peak: baseRadius * 0.46 * 1.3,
      };
    }

    function drawPlateFurniture(G) {
      var c = G.ctx;
      var M = plateMetrics(G);
      // caption — engraved / inked plate caption, per-track voice
      var capCol = track === "library" ? pal.ink[2] : (track === "sycorax" ? pal.bone[2] : pal.silver[1]);
      if (fontsReady) {
        Skin.Type.smallCaps(c, cfg.caption, G.w * 0.5, G.h - 10, 13, capCol, 1, "center");
      }
      if (track === "library") {
        drawSchemaBase(G, M);
      } else if (track === "ariel") {
        drawHorizon(G);
      }
      // sycorax plate furniture: caption only — the block carries no
      // persistent marks (owner ruling: no scar)
    }

    // library lower schema (§3 marginalia): 12-spoke horoscope square-in-circle
    function schemaGeom(G) {
      return { sx: G.w * 0.165, sy: G.h * 0.845, sr: Math.min(G.w, G.h) * 0.085 };
    }
    function drawSchemaBase(G, M) {
      var c = G.ctx, S = schemaGeom(G);
      c.strokeStyle = pal.ink[2]; c.lineWidth = 1;
      c.beginPath(); c.arc(S.sx, S.sy, S.sr, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = pal.ink[3];
      c.strokeRect(S.sx - S.sr * 0.707, S.sy - S.sr * 0.707, S.sr * 1.414, S.sr * 1.414);
      for (var k = 0; k < 12; k++) {
        var a = k * Math.PI / 6 - Math.PI / 2;
        c.beginPath();
        c.moveTo(S.sx + Math.cos(a) * S.sr * 0.28, S.sy + Math.sin(a) * S.sr * 0.28);
        c.lineTo(S.sx + Math.cos(a) * S.sr, S.sy + Math.sin(a) * S.sr);
        c.stroke();
      }
      if (fontsReady) {
        Skin.Type.smallCaps(c, "schema inferius · the drone", S.sx, S.sy + S.sr + 16, 13, pal.ink[2], 1, "center");
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
        Skin.Type.smallCaps(c, "horizon — sinks through the release", G.w * 0.24, hy - 6, 12, pal.silver[1], 2);
      }
    }

    // ============================================================ PLATE L2 ==
    var patCache = {};
    function washPattern(ctx, color, level, u) {
      var k = color + "/" + level + "/" + u;
      if (!patCache[k]) patCache[k] = ctx.createPattern(Skin.Dither.tile(color, level, u), "repeat");
      return patCache[k];
    }

    // era geometry: pitch-class offset (from the track anchor) of degree step d
    function eraTheta(step) {
      var pcOff = ((era.tonicPc - cfg.anchorPc + step) % 12 + 12) % 12;
      return (pcOff / 12) * 2 * Math.PI;
    }
    function inKeyPcOffsets() {
      // map pc-offset-from-anchor → step (or undefined)
      var out = {};
      for (var i = 0; i < era.steps.length; i++) {
        var pcOff = ((era.tonicPc - cfg.anchorPc + era.steps[i]) % 12 + 12) % 12;
        out[pcOff] = era.steps[i];
      }
      return out;
    }

    // the library re-oxidation: per-sample ink substitution in blue-noise
    // order — chemistry, not alpha (§1a / Skin discipline 4)
    function oxidized(i, baseCol, wallS) {
      var sh = st.inkShift;
      if (!sh) return baseCol;
      var e = wallS - sh.t0;
      var p = e < 10 ? e / 10 : (e < 20 ? 1 : (e < 30 ? (30 - e) / 10 : -1));
      if (p < 0) { st.inkShift = null; return baseCol; }
      var bn = Skin.Dither.blueNoise(seed);
      if (bn.at(i & 63, (i >> 3) & 63) < p) {
        return sh.warm ? pal.rubric[0] : pal.ink[2]; // both data-legal
      }
      return baseCol;
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

      // ---- project the coil (inner baseline+wobble, outer contour) --------
      var i, o, b, th, yW, m;
      for (i = 0; i <= TOTAL; i++) {
        var ii = i < TOTAL ? i : TOTAL - 1;
        var frac = i / SPT;
        th = (frac % 1) * 2 * Math.PI;
        yW = (frac - (OCTAVES - 1) / 2) * M.oct;
        m = magnitudes[ii];
        var rr = M.R + wobble[i];
        var ct = Math.cos(th), s2 = Math.sin(th);
        var xw = rr * ct, zw = rr * s2;
        // inner
        var x1 = xw * cy1 - zw * sy1, z1 = xw * sy1 + zw * cy1;
        innerX[i] = x1; innerY[i] = yW * cp1 - z1 * sp1; innerZ[i] = yW * sp1 + z1 * cp1;
        // outer — contour, full resolution (wobble-free radius: data, not pen)
        var xo = M.R * ct, zo = M.R * s2, yo = yW + m * M.peak;
        var x2 = xo * cy1 - zo * sy1, z2 = xo * sy1 + zo * cy1;
        outerX[i] = x2; outerY[i] = yo * cp1 - z2 * sp1; outerZ[i] = yo * sp1 + z2 * cp1;
      }

      if (track === "ariel") {
        drawAtlasCoil(G, M, proj, wallS);
      } else {
        drawSortedCoil(G, M, proj, wallS, audioT);
      }

      // ---- octave numerals at each turn's seam ----------------------------
      if (fontsReady) {
        var numCol = track === "library" ? [pal.ink[1], pal.ink[3]]
          : (track === "sycorax" ? [pal.bone[1], pal.bone[2]] : [pal.silver[1], pal.silver[2]]);
        for (o = 0; o < OCTAVES; o++) {
          var yO = (o - (OCTAVES - 1) / 2) * M.oct;
          var pN = proj(M.R * 1.12, yO, 0);
          Skin.Type.smallCaps(c, ROMAN_LO[o], pN.sx + 6, pN.sy + 4, 15, pN.z > 0 ? numCol[0] : numCol[1], 0, "left");
        }
      }

      // ---- per-track live extras ------------------------------------------
      drawNoteMarks(G, M, proj, audioT);
      if (track === "library") drawSchemaLive(G, M);
      if (track === "sycorax") {
        drawPulseMark(G, M, audioT);
        if (st.cut && cutActive(audioT)) drawSlash(G, M, audioT);
      }
      if (track === "ariel") {
        if (wallS < st.ghostLineUntil) drawFlightLine(G, M, proj, true);
        if (st.flightScenes > 0) drawFlightLine(G, M, proj, false);
        drawPlumbBob(G, M, proj, audioT);
      }
    }

    // ---- codex + grimoire: the depth-sorted quad pass WITH the dial sigils
    // sorted in (mockup-1's flagged fix: the sigils must occlude correctly
    // against the coil, so they enter the same far→near ordering).
    function drawSortedCoil(G, M, proj, wallS, audioT) {
      var c = G.ctx;
      var i, k;
      var yDial = -((OCTAVES - 1) / 2) * M.oct - M.oct * 0.8;
      var inKey = inKeyPcOffsets();

      // dial item positions (12 pc offsets from the anchor)
      var dial = [];
      for (k = 0; k < 12; k++) {
        var thD = (k / 12) * 2 * Math.PI;
        var ctd = Math.cos(thD), std = Math.sin(thD);
        dial.push({
          pcOff: k, step: inKey[k],
          pIn: proj(M.R * 1.04 * ctd, yDial, M.R * 1.04 * std),
          pOut: proj(M.R * 1.16 * ctd, yDial, M.R * 1.16 * std),
          pSig: proj(M.R * 1.38 * ctd, yDial, M.R * 1.38 * std),
        });
      }

      // the dial's compass rim draws first (always behind — it sits below
      // the coil and encircles it; drawing it under everything is honest)
      c.save();
      c.setLineDash([3, 4]);
      c.strokeStyle = track === "library" ? pal.ink[3] : rgba(pal.bone[1], 0.75);
      c.lineWidth = track === "library" ? 1 : 1.4;
      c.beginPath();
      for (var rp = 0; rp <= 72; rp++) {
        var thR = (rp / 72) * 2 * Math.PI;
        var wob = track === "sycorax" ? 1 + 0.008 * Math.sin(rp * 1.7 + 2) : 1;
        var pR = proj(M.R * 1.16 * wob * Math.cos(thR), yDial, M.R * 1.16 * wob * Math.sin(thR));
        if (rp === 0) c.moveTo(pR.sx, pR.sy); else c.lineTo(pR.sx, pR.sy);
      }
      c.stroke();
      c.restore();

      // ---- build the combined far→near order: quads + dial items ----------
      var n = 0;
      for (i = 0; i < TOTAL; i++) { orderZ[i] = (innerZ[i] + innerZ[i + 1]) * 0.5; }
      for (k = 0; k < 12; k++) { orderZ[TOTAL + k] = dial[k].pSig.z; }
      orderArr.sort(function (a, b2) { return orderZ[a] - orderZ[b2]; });

      var hush = track === "sycorax" ? hushStep(audioT) : 1;
      var keenFlash = track === "sycorax" && (audioT - st.keenAt) < 2.5;

      for (var s = 0; s < orderArr.length; s++) {
        var id = orderArr[s];
        if (id >= TOTAL) {
          drawDialItem(G, M, dial[id - TOTAL], keenFlash);
          continue;
        }
        i = id;
        var ix0 = innerX[i] + M.CX, iy0 = M.CY - innerY[i];
        var ix1 = innerX[i + 1] + M.CX, iy1 = M.CY - innerY[i + 1];
        var ox0 = outerX[i] + M.CX, oy0 = M.CY - outerY[i];
        var ox1 = outerX[i + 1] + M.CX, oy1 = M.CY - outerY[i + 1];
        var zMid = orderZ[i];
        var m0 = magnitudes[i], m1 = magnitudes[i + 1];
        var mm = (m0 + m1) * 0.5;

        if (track === "library") {
          // Bayer ink-wash fill under the contour (chunky allowed; §3)
          if (mm > 0.10) {
            var lvl = mm < 0.28 ? 3 : (mm < 0.46 ? 6 : (mm < 0.68 ? 9 : 13));
            var tone = zMid > 0 ? pal.ink[1] : pal.ink[2];
            c.fillStyle = washPattern(c, tone, lvl, G.u);
            c.beginPath();
            c.moveTo(ix0, iy0); c.lineTo(ix1, iy1);
            c.lineTo(ox1, oy1); c.lineTo(ox0, oy0);
            c.closePath(); c.fill();
          }
          // depth → ink weight, never alpha: near dark & wide, far pale hairline
          var t = zMid / M.R;
          var col, wd;
          if (t > 0.30) { col = pal.ink[0]; wd = 2.2; }
          else if (t > -0.30) { col = pal.ink[1]; wd = 1.4; }
          else { col = pal.ink[3]; wd = 0.85; } // documented depth-cue exception
          col = oxidized(i, col, wallS);
          c.strokeStyle = col; c.lineWidth = Math.max(1, wd - 0.4);
          c.beginPath(); c.moveTo(ix0, iy0); c.lineTo(ix1, iy1); c.stroke();
          // the FFT contour — full resolution, never quantized (§2)
          c.strokeStyle = col; c.lineWidth = wd;
          c.beginPath(); c.moveTo(ox0, oy0); c.lineTo(ox1, oy1); c.stroke();
        } else {
          // GRIMOIRE (mockup-2's proven recipe): the woodcut coil line —
          // irregular width, ink squash at pressure peaks — plus the ink
          // band up to the contour, relief gouges, bone data contour.
          var dep = clamp01((zMid + M.R) / (2 * M.R));
          var bandPx = Math.abs(oy0 - iy0) + Math.abs(oy1 - iy1);
          var wob0 = wobble[i] * 0.6, wob1 = wobble[i + 1] * 0.6;
          c.strokeStyle = rgba(pal.ink[0], (0.62 + 0.38 * dep) * hush);
          c.lineWidth = 2.6 + mm * 7 + wob0 * 0.9;
          c.beginPath(); c.moveTo(ix0, iy0 + wob0); c.lineTo(ix1, iy1 + wob1); c.stroke();
          if (bandPx > 2.2) {
            c.fillStyle = rgba(pal.ink[0], (0.68 + 0.32 * dep) * hush);
            c.beginPath();
            c.moveTo(ix0, iy0 + 1.5); c.lineTo(ix1, iy1 + 1.5);
            c.lineTo(ox1, oy1); c.lineTo(ox0, oy0);
            c.closePath(); c.fill();
            if (mm > 0.4) { // ink squash past the contour
              c.strokeStyle = rgba(pal.ink[0], 0.5 * hush);
              c.lineWidth = 1.5 + mm * 4.5 * dep;
              c.beginPath(); c.moveTo(ox0, oy0); c.lineTo(ox1, oy1); c.stroke();
            }
          }
          // relief gouges — short white cuts inside the band
          if (bandPx > 8 && Skin.noise.hash2(i, 88) < 0.58) {
            var gl = 0.45 + Skin.noise.hash2(i, 55) * 0.4;
            var gx0 = ix0 + (ox0 - ix0) * 0.12, gy0 = iy0 + (oy0 - iy0) * 0.12;
            var gx1 = ix0 + (ox0 - ix0) * gl, gy1 = iy0 + (oy0 - iy0) * gl;
            c.strokeStyle = rgba(hush > 0.6 ? pal.bone[0] : pal.bone[1], (0.35 + 0.5 * dep) * (hush > 0.6 ? 0.95 : 0.7));
            c.lineWidth = 1.7 * dep + 0.5;
            c.beginPath(); c.moveTo(gx0, gy0); c.lineTo(gx1, gy1); c.stroke();
          }
          // THE DATA CONTOUR — the longest gouge on the block. Hush = one
          // bone ramp step down, never an alpha fade (§1b / risk 4).
          var loud = Math.min(1, mm * 3.2);
          var nearBone = hush > 0.6 ? pal.bone[0] : pal.bone[1];
          var cA = dep > 0.45 ? (0.42 + 0.58 * loud) : (0.3 + 0.3 * loud);
          c.strokeStyle = rgba(dep > 0.45 ? nearBone : pal.bone[2], hush > 0.6 ? Math.max(cA, 0.75) : cA);
          c.lineWidth = (hush > 0.6 ? 1.3 + 2.6 * mm : 0.8 + 2.0 * mm) * (0.3 + 0.7 * dep);
          c.beginPath(); c.moveTo(ox0, oy0); c.lineTo(ox1, oy1); c.stroke();
        }
      }
    }

    function drawDialItem(G, M, d, keenFlash) {
      var c = G.ctx;
      var near = d.pSig.z > 0;
      if (track === "library") {
        var colN = near ? pal.ink[0] : pal.ink[3];
        if (d.step !== undefined) {
          var sig = Skin.DEGREE_SIGIL[d.step];
          c.strokeStyle = colN; c.lineWidth = near ? 1.6 : 1;
          c.beginPath(); c.moveTo(d.pIn.sx, d.pIn.sy); c.lineTo(d.pOut.sx, d.pOut.sy); c.stroke();
          if (sig) {
            at.stamp(c, "sigil-" + sig, d.pSig.sx, d.pSig.sy, { u: G.u, tint: colN });
            if (d.step === 0) { // the tonic's sigil is rubricated — Sol regnant
              at.stamp(c, "sigil-" + sig, d.pSig.sx, d.pSig.sy, { u: G.u, tint: near ? pal.rubric[0] : pal.ink[3] });
            }
          }
        } else {
          // out-of-key: bare pale tick — in-key tinting lives in symbol weight
          c.strokeStyle = pal.ink[3]; c.lineWidth = 1;
          c.beginPath(); c.moveTo(d.pIn.sx, d.pIn.sy); c.lineTo(d.pOut.sx, d.pOut.sy); c.stroke();
        }
      } else {
        // grimoire floor ring ticks + the keening notch at degree 1
        var dep = clamp01((d.pSig.z + M.R) / (2 * M.R));
        var isKeen = d.step === 1;
        if (isKeen) {
          // the bone V-cut — the plate's one double-struck tick
          var flash = keenFlash ? 1 : 0.8;
          c.fillStyle = rgba(pal.bone[0], flash);
          c.beginPath();
          c.moveTo(d.pSig.sx - 5, d.pSig.sy - 6); c.lineTo(d.pSig.sx + 5, d.pSig.sy - 6);
          c.lineTo(d.pIn.sx, d.pIn.sy);
          c.closePath(); c.fill();
          if (keenFlash) {
            c.strokeStyle = pal.bone[0]; c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(d.pSig.sx, d.pSig.sy - 6); c.lineTo(d.pSig.sx, d.pSig.sy - 14); c.stroke();
          }
        } else if (d.step !== undefined) {
          c.strokeStyle = rgba(pal.bone[1], 0.55 + 0.45 * dep); c.lineWidth = 2;
          c.beginPath(); c.moveTo(d.pIn.sx, d.pIn.sy); c.lineTo(d.pOut.sx, d.pOut.sy); c.stroke();
          c.fillStyle = rgba(pal.bone[1], 0.5 + 0.5 * dep);
          c.beginPath();
          c.moveTo(d.pOut.sx, d.pOut.sy - 3); c.lineTo(d.pOut.sx + 3, d.pOut.sy);
          c.lineTo(d.pOut.sx, d.pOut.sy + 3); c.lineTo(d.pOut.sx - 3, d.pOut.sy);
          c.closePath(); c.fill();
        } else {
          c.strokeStyle = rgba(pal.bone[2], 0.35 + 0.35 * dep); c.lineWidth = 1;
          c.beginPath(); c.moveTo(d.pIn.sx, d.pIn.sy); c.lineTo(d.pOut.sx, d.pOut.sy); c.stroke();
        }
      }
    }

    // ---- atlas (ariel): the engraved passes — hatch, baseline, contour,
    // ticks + seam stars (mockup-3's mid-silver-baseline hierarchy: the
    // scaffold never brighter than mid silver; the bright data contour owns
    // the eye). Strokes only — no fills — so painter's order suffices; the
    // far side lets go (its ticks/labels drop) which is this skin's honest
    // occlusion story.
    function drawAtlasCoil(G, M, proj, wallS) {
      var c = G.ctx;
      var i, o, b, th, yW, pt;
      // pass 1 — engraver's hatching: radial burin strokes, density = magnitude
      for (i = 0; i < TOTAL; i += 1) {
        var m = magnitudes[i];
        if (m < 0.09) continue;
        var p0x = innerX[i] + M.CX, p0y = M.CY - innerY[i];
        var p1x = outerX[i] + M.CX, p1y = M.CY - outerY[i];
        c.strokeStyle = (innerZ[i] / M.R > -0.1) ? pal.silver[2] : pal.plate[2];
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(p0x, p0y); c.lineTo(p1x, p1y); c.stroke();
      }
      // pass 2 — the baseline helix, scaffold recessive
      var prevX = 0, prevY = 0, prevZ = 0, has = false;
      for (i = 0; i <= TOTAL; i++) {
        var sx = innerX[i] + M.CX, sy = M.CY - innerY[i], zz = innerZ[i];
        if (has) {
          var zAvg = (zz + prevZ) / 2 / M.R;
          c.strokeStyle = zAvg > 0.1 ? pal.silver[1] : pal.silver[2];
          c.lineWidth = zAvg > 0.1 ? 1 : 0.7;
          c.beginPath(); c.moveTo(prevX, prevY); c.lineTo(sx, sy); c.stroke();
        }
        prevX = sx; prevY = sy; prevZ = zz; has = true;
      }
      // pass 3 — the FFT contour: drawn only where there is data
      var FLOOR = 0.085;
      var pm = 0;
      has = false;
      for (i = 0; i < TOTAL; i++) {
        b = i % SPT;
        var cx2 = outerX[i] + M.CX, cy2 = M.CY - outerY[i], cz2 = outerZ[i];
        if (has && b !== 0 && (magnitudes[i] > FLOOR || pm > FLOOR)) {
          var t = (cz2 + prevZ) / 2 / M.R;
          var col, wd;
          if (t > 0.25) { col = pal.silver[0]; wd = 2; }
          else if (t > -0.35) { col = pal.silver[1]; wd = 1.4; }
          else { col = pal.silver[2]; wd = 0.9; } // documented depth-cue exception
          c.strokeStyle = col; c.lineWidth = wd;
          c.beginPath(); c.moveTo(prevX, prevY); c.lineTo(cx2, cy2); c.stroke();
        }
        prevX = cx2; prevY = cy2; prevZ = cz2; pm = magnitudes[i]; has = true;
      }
      // pass 4 — degree ticks per turn + gilt seam stars; the re-gilding
      // after a sea change lights the stars one by one over ~8 s (§1c)
      var inKey = inKeyPcOffsets();
      var regildP = -1;
      if (st.regild) {
        regildP = (wallS - st.regild.t0) / 8;
        if (regildP >= 1) { st.regild = null; regildP = -1; }
      }
      for (o = 0; o < OCTAVES; o++) {
        for (var pc = 0; pc < 12; pc++) {
          th = (pc / 12) * 2 * Math.PI;
          yW = (o + pc / 12 - (OCTAVES - 1) / 2) * M.oct;
          var step = inKey[pc];
          var inK = step !== undefined;
          var r1 = M.R - (inK ? 7 : 4);
          var q0 = proj(M.R * Math.cos(th), yW, M.R * Math.sin(th));
          if (q0.z / M.R < -0.55) continue; // far side: let it go
          var q1 = proj(r1 * Math.cos(th), yW, r1 * Math.sin(th));
          var gilding = regildP >= 0 && inK && (pc / 12) < regildP;
          c.strokeStyle = gilding ? pal.gilt[0] : (inK ? pal.silver[1] : pal.silver[2]);
          c.lineWidth = 1;
          c.beginPath(); c.moveTo(q0.sx, q0.sy); c.lineTo(q1.sx, q1.sy); c.stroke();
          // the tonic rings as the gilt star on every turn
          if (inK && step === 0) {
            Skin.star4(c, q0.sx, q0.sy, q0.z / M.R > 0 ? 3.4 : 2.4,
              q0.z / M.R > -0.15 ? pal.gilt[0] : pal.gilt[1]);
          }
        }
        // octave seam: gilt star + numeral
        yW = (o - (OCTAVES - 1) / 2) * M.oct;
        var sPt = proj(M.R * 1.05, yW, 0);
        if (sPt.z / M.R > -0.6) {
          Skin.star4(c, sPt.sx, sPt.sy, 3.4, sPt.z / M.R > -0.15 ? pal.gilt[0] : pal.gilt[1]);
        }
      }
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
        if (mk.kind === "flick") {
          // quill flick off the baseline (library harpsichord)
          pt = proj(M.R * Math.cos(th), yW, M.R * Math.sin(th));
          dep = pt.z / M.R;
          var len = 10 + 14 * (mk.vel || 0.6);
          c.strokeStyle = dataCol(dep > -0.3 ? pal.ink[0] : "#93794f", "quill flick");
          c.lineWidth = 1.4 * (1 - p01 * 0.5);
          c.beginPath();
          c.moveTo(pt.sx, pt.sy);
          c.quadraticCurveTo(pt.sx + len * 0.4, pt.sy - len * 0.9, pt.sx + len * 0.85, pt.sy - len * 1.4 * (1 - p01 * 0.4));
          c.stroke();
        } else if (mk.kind === "glint") {
          // gilt-leaf fleck rising by loudness — 2 px-snapped (the one v1
          // mark already ahead of the plan). Ink core carries the datum;
          // gilt illuminates beside it (gilt never a sole carrier).
          var rise = (0.18 + 0.45 * (mk.vel || 0.5)) * M.peak * Math.min(1, age / 0.4);
          pt = proj(M.R * Math.cos(th), yW + rise, M.R * Math.sin(th));
          var gx = Math.round(pt.sx / 2) * 2, gy = Math.round(pt.sy / 2) * 2;
          c.fillStyle = dataCol(pal.ink[0], "music-box glint core");
          c.fillRect(gx - 1, gy - 1, 2, 2);
          if (p01 < 0.8) {
            c.fillStyle = pal.gilt[1];
            c.fillRect(gx - 3, gy - 1, 2, 2); c.fillRect(gx + 1, gy - 1, 2, 2);
            c.fillRect(gx - 1, gy - 3, 2, 2); c.fillRect(gx - 1, gy + 1, 2, 2);
          }
        } else if (mk.kind === "column") {
          // the hum's illuminated column: Bayer body, inked edges
          var pB = proj(M.R * Math.cos(th), yW, M.R * Math.sin(th));
          var hCol = magnitudes[iC] * M.peak;
          var pT = proj(M.R * Math.cos(th), yW + Math.max(hCol, M.peak * 0.14), M.R * Math.sin(th));
          c.fillStyle = washPattern(c, pal.ink[2], 6, G.u);
          var wCol = 7;
          c.fillRect(Math.min(pB.sx, pT.sx) - wCol / 2, Math.min(pB.sy, pT.sy), wCol, Math.abs(pB.sy - pT.sy));
          c.strokeStyle = dataCol(pal.ink[1], "hum column");
          c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(pB.sx - wCol / 2, pB.sy); c.lineTo(pT.sx - wCol / 2, pT.sy); c.stroke();
          c.beginPath(); c.moveTo(pB.sx + wCol / 2, pB.sy); c.lineTo(pT.sx + wCol / 2, pT.sy); c.stroke();
        } else if (mk.kind === "cutline") {
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
        } else if (mk.kind === "bubble") {
          // engraved rising circle (ariel chime)
          var riseB = M.peak * (0.2 + 0.8 * p01);
          pt = proj(M.R * Math.cos(th), yW + riseB, M.R * Math.sin(th));
          c.strokeStyle = dataCol(pt.z / M.R > -0.3 ? pal.silver[0] : pal.silver[1], "chime bubble");
          c.lineWidth = 1;
          c.beginPath(); c.arc(pt.sx, pt.sy, 2.5 + 2.5 * (1 - p01), 0, Math.PI * 2); c.stroke();
        } else if (mk.kind === "wing") {
          pt = proj(M.R * Math.cos(th), yW + M.peak * 0.3, M.R * Math.sin(th));
          c.strokeStyle = dataCol(pal.sky[1], "flutter wing");
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(pt.sx - 5, pt.sy + 3); c.lineTo(pt.sx, pt.sy - 2); c.lineTo(pt.sx + 5, pt.sy + 3);
          c.stroke();
        } else if (mk.kind === "bassmark") {
          pt = proj(M.R * Math.cos(th), yW, M.R * Math.sin(th));
          c.fillStyle = dataCol(pal.silver[0], "bass mark");
          c.beginPath();
          c.moveTo(pt.sx, pt.sy - 4); c.lineTo(pt.sx + 4, pt.sy); c.lineTo(pt.sx, pt.sy + 4); c.lineTo(pt.sx - 4, pt.sy);
          c.closePath(); c.fill();
        }
      }
      st.marks = keep;
    }

    // library lower schema, live: drone tones as inked nodes, interval rules
    // weighted by consonance (single/double), labeled
    function drawSchemaLive(G, M) {
      var c = G.ctx, S = schemaGeom(G);
      var t = aNow();
      var live = [];
      for (var i = 0; i < st.droneSet.length; i++) {
        if (st.droneSet[i].until > t) live.push(st.droneSet[i]);
      }
      st.droneSet = live;
      var pts = [];
      for (i = 0; i < live.length; i++) {
        var step = ((live[i].deg % 7) + 7) % 7;
        var semis = era.steps[step];
        var a = (semis / 12) * 2 * Math.PI - Math.PI / 2;
        pts.push({ x: S.sx + Math.cos(a) * S.sr * 0.8, y: S.sy + Math.sin(a) * S.sr * 0.8, semis: semis });
      }
      // interval rules
      var CONS = { 0: 1, 7: 0.95, 5: 0.85, 4: 0.75, 3: 0.7, 8: 0.55, 9: 0.55, 2: 0.4, 10: 0.4, 1: 0.2, 11: 0.2, 6: 0.15 };
      for (i = 0; i < pts.length; i++) {
        for (var j = i + 1; j < pts.length; j++) {
          var iv = Math.abs(pts[i].semis - pts[j].semis) % 12;
          var cons = CONS[iv] || 0.3;
          c.strokeStyle = pal.ink[1]; c.lineWidth = 1.2;
          if (cons > 0.8) { // double rule for the perfect intervals
            c.beginPath(); c.moveTo(pts[i].x - 1.5, pts[i].y); c.lineTo(pts[j].x - 1.5, pts[j].y); c.stroke();
            c.beginPath(); c.moveTo(pts[i].x + 1.5, pts[i].y); c.lineTo(pts[j].x + 1.5, pts[j].y); c.stroke();
          } else if (cons > 0.5) {
            c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[j].x, pts[j].y); c.stroke();
          } else {
            c.save(); c.setLineDash([2, 3]);
            c.beginPath(); c.moveTo(pts[i].x, pts[i].y); c.lineTo(pts[j].x, pts[j].y); c.stroke();
            c.restore();
          }
        }
      }
      for (i = 0; i < pts.length; i++) {
        c.fillStyle = dataCol(pal.ink[0], "schema drone node");
        c.beginPath(); c.arc(pts[i].x, pts[i].y, 3.4, 0, Math.PI * 2); c.fill();
      }
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

    // THE CUT — the white slash across the plate at tB (severity = length),
    // fading out COMPLETELY as the return ramps home (owner ruling: no scar)
    function drawSlash(G, M, audioT) {
      var c = G.ctx;
      var cut = st.cut;
      var sev = cut.sev;
      var heal = cut.ret ? clamp01((audioT - cut.ret.t) / Math.max(0.001, cut.ret.s)) : 0;
      var vis = 1 - heal;
      if (vis <= 0.01) return;
      var w = G.w, h = G.h;
      var x0 = w * 0.5 - w * 0.30 * sev, y0 = M.CY - h * 0.30 * sev;
      var x1 = w * 0.5 + w * 0.28 * sev, y1 = M.CY + h * 0.24 * sev;
      var dx = x1 - x0, dy = y1 - y0;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var N = 26;
      c.strokeStyle = rgba(pal.ink[0], 0.55 * vis); c.lineWidth = 2.5;
      c.beginPath();
      var b;
      for (var i2 = 0; i2 <= N; i2++) {
        var t = i2 / N;
        var pxS = x0 + dx * t, pyS = y0 + dy * t;
        var hw = (5.5 * Math.pow(Math.sin(Math.PI * t), 0.65) + 0.4) * vis;
        var jag = (Skin.noise.hash2(i2, 5) - 0.5) * 3.2;
        var tx = pxS + nx * (hw + jag), ty = pyS + ny * (hw + jag);
        if (i2 === 0) c.moveTo(tx, ty); else c.lineTo(tx, ty);
      }
      for (b = N; b >= 0; b--) {
        var t2 = b / N;
        var pxS2 = x0 + dx * t2, pyS2 = y0 + dy * t2;
        var hw2 = (5.5 * Math.pow(Math.sin(Math.PI * t2), 0.65) + 0.4) * vis;
        var jag2 = (Skin.noise.hash2(b, 5) - 0.5) * 3.2;
        c.lineTo(pxS2 - nx * (hw2 - jag2 * 0.6), pyS2 - ny * (hw2 - jag2 * 0.6));
      }
      c.closePath();
      c.stroke();
      c.fillStyle = rgba(pal.bone[0], vis);
      c.fill();
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

    // ariel: the whistle's silver plumb-bob at the tracked pitch
    function drawPlumbBob(G, M, proj, audioT) {
      var wl = st.whistle;
      if (!wl || audioT > wl.until) return;
      var c = G.ctx;
      var of = wl.of;
      var th = (of % 1) * 2 * Math.PI;
      var yB = (of - (OCTAVES - 1) / 2) * M.oct;
      var i0 = Math.min(TOTAL - 1, Math.max(0, Math.round(of * SPT)));
      var yH = yB + magnitudes[i0] * M.peak + 14;
      var xw = M.R * Math.cos(th), zw = M.R * Math.sin(th);
      var pb = proj(xw, yB, zw);
      var ph = proj(xw, yH, zw);
      c.strokeStyle = dataCol(pal.silver[0], "plumb-bob stem"); c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(pb.sx, pb.sy); c.lineTo(ph.sx, ph.sy); c.stroke();
      c.fillStyle = pal.silver[0];
      c.beginPath();
      c.moveTo(ph.sx, ph.sy + 9);
      c.lineTo(ph.sx - 5, ph.sy - 1); c.lineTo(ph.sx - 3, ph.sy - 7);
      c.lineTo(ph.sx + 3, ph.sy - 7); c.lineTo(ph.sx + 5, ph.sy - 1);
      c.closePath(); c.fill();
      c.strokeStyle = pal.silver[0]; c.lineWidth = 1;
      c.beginPath(); c.arc(pb.sx, pb.sy, 3, 0, Math.PI * 2); c.stroke();
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
      plateZones.plateZone.cx = p.w * 0.5;
      plateZones.plateZone.cy = p.h * 0.485;
      plateZones.plateZone.rx = p.w * 0.42;
      plateZones.plateZone.ry = p.h * 0.46;
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
        patCache = {};
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

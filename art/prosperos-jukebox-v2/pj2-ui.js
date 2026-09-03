// ============================================================================
// PROSPERO'S JUKEBOX v2 — pj2-ui.js · the conjurer's cabinet controller
//
// The chrome layer between the page (index.php + pj2.css) and everything
// beneath it: the three engine facades (PJ2.Library / Sycorax / Ariel), the
// skin toolkit (PJ2.Skin — palettes, atlas sigils), and the visualization
// (PJ2.Viz — plate / margin canvases). This file owns:
//
//   · ENGINE LIFECYCLE — all three engines are created lazily on ONE shared
//     AudioContext, and ONLY ONE ever plays at a time. The tracks are v1's
//     horizontal tabs above the folio (owner ruling, overriding §5's shelf):
//     switching while playing stops the current engine (its own 1.5 s fade)
//     and starts the new book after the fade; switching while stopped just
//     re-skins the desk. The active tab reads raised/open.
//
//   · THE SHARED-CONTEXT ARRANGEMENT — each facade builds its own lazy
//     AudioContext via `new (window.AudioContext)()`. Rather than modify the
//     engines, the page supplies a singleton constructor: the first engine
//     to play creates the one real context, every later engine receives the
//     same instance, and the UI (which needs the context for viz.attach)
//     holds the reference. One subtlety is inherited: an engine's stop()
//     SUSPENDS the context ~1.7 s after the fade begins, so a successor may
//     only start after that window closes (FADE_MS below) — and a 300 ms
//     watchdog resumes the context if a straggling finalize ever suspends
//     it under a playing engine.
//
//   · TRANSPORT — PLAY / STOP / RESET brass pushplates (reset = reseed the
//     open book with a fresh random seed), the wax-seal seed entry (typed
//     seed + a ≤300 ms re-stamp animation), the lamp as master volume (one
//     shared setting, applied to every engine).
//
//   · THE MIXING DESK — the instrument rows inside the cabinet frame,
//     next to the binding plate (owner 2026-08-22: no collapse, no
//     header — just the rows, with the COPY plate beneath them).
//     Built at EVERY width since 2026-08-23 (the owner fine-tunes from a
//     phone); CSS compacts the rows under the 700px breakpoint.
//     One row per layer, rebuilt from getLayers() on every tab switch —
//     the row is an expand chevron, an authored voice sigil stamped from
//     PJ2.Skin.atlas, VT323 name, and the dithered-fill VOL slider
//     (thumb position unquantized). The chevron unfolds the layer's
//     DETAIL STRIP: v1's pixel mute square (filled = audible) wired to
//     toggleLayer, a solo square, the log-mapped RATE slider
//     (0.25×–4×, double-click the readout resets to 1× — only for
//     layers with a clock lane), and the fine-tune knobs (the facade's
//     getLayerParams contract, live per-voice scalars in the same
//     slider idiom). Solo is UI-side only, composed through
//     toggleLayer; clearing the last solo restores the pre-solo mutes,
//     and tab switching dissolves it. COPY serializes the whole mix
//     (master + volumes + mutes + rates + non-default knob values under
//     "p") as JSON.
//
//   · THE SCRIBAL EVENT LOG (§4) — DOM rows fed by setEventListener. Scene
//     lines print the ENGINE'S display labels (Calcinatio … Coagulatio;
//     Transmutatio; cadence Latin) with an illuminated capital; tags are
//     rubricated per skin; entries age through the registry's three ink
//     steps; the buffer caps at ~120 rows per book. A compact telemetry
//     strip (300 ms getInfo() poll) carries the margin data on small
//     screens (§6 degradation) — tide, fire, air, and the harmony brain's
//     one mobile line (chord or pose, plus an announced cadence's label).
//
//   · VIZ WIRING — PJ2.Viz created once; attach/detach on play/stop/tab
//     switch; resize on debounce; start/stop with document visibility. If
//     pj2-viz.js has not landed, an honest placeholder keeps the page
//     alive behind the same surface.
//
// House rules kept: no CRT effects, no wall-clock in MUSICAL paths (the
// page choosing a fresh evening per visit is the one sanctioned dice roll —
// it happens before any engine exists), ARIA labels on all controls, and
// palette hexes only ever read from PJ2.Skin's registry or the cabinet's
// own chrome inventory (documented below).
// ============================================================================

(function () {
  "use strict";

  if (typeof window === "undefined") return;

  function $(id) { return document.getElementById(id); }
  function clamp01(v) { v = +v; return v > 1 ? 1 : (v >= 0 ? v : 0); }

  // --------------------------------------------------------------------------
  // THE ONE SHARED AUDIOCONTEXT (see header). Captured before any engine can
  // call `new AudioContext()`; the singleton constructor hands every caller
  // the same instance. `new Fn()` returning an object yields that object —
  // the engines are untouched and unaware.
  // --------------------------------------------------------------------------
  var RealAC = window.AudioContext || window.webkitAudioContext || null;
  var sharedCtx = null;
  function ensureSharedCtx() {
    if (!sharedCtx) sharedCtx = new RealAC();
    return sharedCtx;
  }
  if (RealAC) {
    var SharedAC = function AudioContext() { return ensureSharedCtx(); };
    window.AudioContext = SharedAC;
    window.webkitAudioContext = SharedAC;
  }

  // --------------------------------------------------------------------------
  // TRACK TABLE — one row per book: wiring only (namespace, captions, the
  // voice→sigil map). Colors — wax bodies, rims, sigil tints — come from the
  // registry's per-track `control` group (PJ2.Skin.palette(key).control);
  // this table holds no hexes (theme refactor, owner 2026-08-31).
  // --------------------------------------------------------------------------
  var TRACKS = ["library", "sycorax", "ariel"];
  var TRACK = {
    library: {
      ns: "Library",
      // (the per-track running-head title retired 2026-08-23 — the tabs
      // carry the original v1 song titles, verbatim, in the display face)
      folioNo: "c dorian · tonic 262",
      logHead: "annotationes · the scribal log",
      // rc.31: the cello, the vessel, the regal and the flue have no
      // authored atlas cell — stampSigil falls back to a scribal initial in
      // the same ink (C · V · R · F), which is exactly what the cello has
      // worn since rc.22. Named here so the omission reads as a decision.
      sigils: {
        drone: "voice-drone", hum: "quill", harpsichord: "voice-harp",
        musicbox: "voice-box", halo: "sigil-sol",
        cello: null, vessel: null, regal: null, flue: null,
      },
    },
    sycorax: {
      ns: "Sycorax",
      folioNo: "the ghost world · tonic 311",
      logHead: "the black book’s margins · scribal log",
      // rc.32: the low horn and the five sound-diversity voices have no
      // authored atlas cell — stampSigil falls back to a scribal initial in
      // the same ink, taken from the desk LABEL (L · B · O · J · B · C),
      // which is what the horn has worn since rc.23. Named here so the
      // omission reads as a decision rather than an oversight; the
      // bullroarer and the blade share a B until someone cuts them cells.
      sigils: {
        gurdy: "voice-gurdy", noise: "pose-smoke", chant: "voice-chant",
        rebec: "voice-rebec", waterphone: "voice-waterphone",
        boneflute: "voice-boneflute", percussion: "voice-protodrum",
        ambient: "pose-veil",
        horn: null, bullroarer: null, overtone: null, jawharp: null,
        blade: null, cauldron: null,
      },
    },
    ariel: {
      ns: "Ariel",
      folioNo: "f lydian · tonic 349",
      logHead: "chart annotations · the scribal log",
      sigils: {
        breeze: "voice-breeze", whistle: "voice-whistle", chime: "voice-chime",
        flutter: "voice-flutter", bass: "voice-bass", aeolian: "voice-aeolian",
        ambient: "voice-gust", halo: "star",
      },
    },
  };

  // the registry's chrome-duty color group for a track (wax, sigils, fills)
  function controlOf(track) {
    try {
      if (window.PJ2 && PJ2.Skin) return PJ2.Skin.palette(track).control;
    } catch (e) {}
    return null;
  }

  // --------------------------------------------------------------------------
  // STATE
  // --------------------------------------------------------------------------
  var engines = {};            // key -> facade (created lazily)
  var activeKey = "library";   // the open book
  var playIntent = false;      // what the user asked for
  var masterVol = 0.6;         // the lamp — one shared setting
  var seeds = {};              // key -> the seed the engine was given last

  // An engine's stop() fades 1.5 s and finalizes (suspending the shared ctx)
  // at ~1.7 s; the next book may only start after that. 2 s covers the fade,
  // the 25 ms clock-tick slop, and a margin.
  var FADE_MS = 2000;
  var busyUntil = 0;           // wall-clock ms: the fading engine owns the ctx
  var pendingTimer = null;     // one deferred start at a time

  var viz = null;
  var vizStarted = false;
  var vizAttachedKey = null;

  var logs = { library: [], sycorax: [], ariel: [] }; // entry ring per book
  var logRowEls = [];          // DOM rows currently rendered (newest first)
  var MAX_LOG_ROWS = 120;

  // The mixing desk (see THE MIXING DESK below) — built at every width
  // since 2026-08-23. Solo is a transient listening mode of the ACTIVE
  // book only — dissolved on tab switch, never serialized.
  var mixdeskOn = true;
  var soloSet = {};            // layer key -> true
  var soloMutes = null;        // the pre-solo mute set (key -> muted), else null
  var mixRowRender = [];       // per-row refreshers for the built desk rows

  function nowMs() { return Date.now(); }

  // Fresh-evening dice: the ONE sanctioned Math.random — rolled by the page
  // before any engine exists, exactly like typing a seed by hand.
  function freshSeed() { return (Math.random() * 4294967296) >>> 0; }

  var urlSeed = null;
  try {
    if (window.location && window.location.search) {
      var m = /[?&]seed=([0-9]+)/.exec(window.location.search);
      if (m) urlSeed = (+m[1]) >>> 0;
      // deep link to a book: ?track=library|sycorax|ariel opens that tab
      var tm = /[?&]track=(library|sycorax|ariel)/.exec(window.location.search);
      if (tm) activeKey = tm[1];
    }
  } catch (e) { /* headless */ }

  // --------------------------------------------------------------------------
  // ENGINES — lazy create; every engine gets the shared volume and its own
  // event subscription. Creating a facade is cheap (no AudioContext until
  // play), so a tab switch while stopped costs nothing audible.
  // --------------------------------------------------------------------------
  function engineFor(key) {
    if (engines[key]) return engines[key];
    var def = TRACK[key];
    var ns = window.PJ2 && window.PJ2[def.ns];
    if (!ns || !ns.create) return null;
    if (seeds[key] == null) seeds[key] = (urlSeed != null) ? urlSeed : freshSeed();
    var eng = ns.create({ seed: seeds[key], volume: masterVol });
    eng.setEventListener(function (e) { onEngineEvent(key, e); });
    engines[key] = eng;
    return eng;
  }

  function anyOtherPlaying(key) {
    for (var k in engines) {
      if (k !== key && engines[k] && engines[k].isPlaying()) return k;
    }
    return null;
  }

  function stopEngine(key) {
    var eng = engines[key];
    if (eng && eng.isPlaying()) {
      try { eng.stop(); } catch (e) { /* already down */ }
      busyUntil = Math.max(busyUntil, nowMs() + FADE_MS);
    }
    // background-audio: the lock-screen session pauses with the engine
    // (buildBus re-declares "playing" itself on the next run's bus)
    try {
      if (window.PJ2 && PJ2.Voice && PJ2.Voice.background) PJ2.Voice.background.stopped();
    } catch (e) {}
  }

  function cancelPending() {
    if (pendingTimer != null) { clearTimeout(pendingTimer); pendingTimer = null; }
  }

  // Start `key` as soon as the shared context is free. Re-entrant: a switch
  // during the wait simply re-queues with the new target (the old timer is
  // always cancelled first), and startNow() re-checks intent + active tab.
  function requestStart(key) {
    cancelPending();
    var wait = busyUntil - nowMs();
    if (wait > 0) {
      pendingTimer = setTimeout(function () {
        pendingTimer = null;
        startNow(key);
      }, wait + 30);
    } else {
      startNow(key);
    }
  }

  function startNow(key) {
    if (!playIntent || key !== activeKey) return; // the world moved on
    var other = anyOtherPlaying(key);
    if (other) { // straggler still fading in an edge race: wait it out
      stopEngine(other);
      requestStart(key);
      return;
    }
    var eng = engineFor(key);
    if (!eng) return;
    if (!eng.isPlaying()) {
      try { eng.play(); } catch (err) {
        playIntent = false;
        try { console.error("PJ2 UI: engine play failed", err); } catch (e2) {}
      }
    }
    if (eng.isPlaying()) vizAttach(key);
    updateTransport();
  }

  // --------------------------------------------------------------------------
  // VIZ WIRING
  // --------------------------------------------------------------------------
  function vizAttach(key) {
    if (!viz || vizAttachedKey === key) return;
    vizDetach();
    var eng = engines[key];
    if (!eng) return;
    try {
      viz.attach(eng, sharedCtx || null);
      vizAttachedKey = key;
    } catch (e) { try { console.error("PJ2 UI: viz.attach failed", e); } catch (e2) {} }
  }

  function vizDetach() {
    if (!viz || vizAttachedKey == null) return;
    try { viz.detach(); } catch (e) { /* viz's problem */ }
    vizAttachedKey = null;
  }

  var resizeTimer = null;
  function scheduleResize() {
    if (resizeTimer != null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resizeTimer = null;
      if (viz) { try { viz.resize(); } catch (e) {} }
    }, 150);
  }

  // The placeholder viz — same surface as the contract, used only when
  // pj2-viz.js is absent. Draws one honest note per track on the plate.
  function placeholderViz(plate) {
    function note(track) {
      try {
        var pal = window.PJ2 && PJ2.Skin ? PJ2.Skin.palette(track) : null;
        var paperTone = pal ? pal.surface[1] : "#e3d3a8";
        var inkTone = pal ? pal.primary : "#2e2114";
        var r = plate.getBoundingClientRect();
        var w = Math.max(2, Math.round(r.width)) || 640;
        var h = Math.max(2, Math.round(r.height)) || 480;
        plate.width = w; plate.height = h;
        var c = plate.getContext("2d");
        c.fillStyle = paperTone;
        c.fillRect(0, 0, w, h);
        c.fillStyle = inkTone;
        c.font = '20px "VT323", monospace';
        c.textAlign = "center";
        c.fillText("the plates are still at the engraver — pj2-viz.js not loaded", w / 2, h / 2);
        c.fillText("the music itself is unaffected · press play", w / 2, h / 2 + 28);
      } catch (e) { /* mock canvas */ }
    }
    var tr = activeKey;
    return {
      _placeholder: true,
      setTrack: function (t) { tr = t; note(tr); return this; },
      attach: function () { return this; },
      detach: function () { return this; },
      start: function () { note(tr); return this; },
      stop: function () { return this; },
      resize: function () { note(tr); return this; },
    };
  }

  function makeViz() {
    var plate = $("pj2-plate"), margin = $("pj2-margin");
    if (window.PJ2 && PJ2.Viz && typeof PJ2.Viz.create === "function") {
      try {
        return PJ2.Viz.create({
          plateCanvas: plate,
          marginCanvas: margin,
          folioCanvas: $("pj2-folio-paper"),  // the parchment sheet (optional)
        });
      } catch (err) {
        try { console.error("PJ2 UI: PJ2.Viz.create failed — placeholder plates", err); } catch (e) {}
      }
    }
    return placeholderViz(plate);
  }

  function startVizOnce() {
    if (!viz || vizStarted) return;
    if (document.visibilityState === "hidden") return; // visibility handler will start it
    vizStarted = true;
    try { viz.start(); } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // TAB SWITCHING — the tab row above the folio. Switching while playing: the
  // closing book gets its own 1.5 s fade, the opening book starts after it
  // (requestStart waits out busyUntil). Switching while stopped: pure re-skin,
  // nothing sounds.
  // --------------------------------------------------------------------------
  function selectTrack(key) {
    if (!TRACK[key] || key === activeKey) return;
    var wasOn = playIntent;
    cancelPending();
    dissolveSolo(true); // restore the departing book's pre-solo mutes
    stopEngine(activeKey); // no-op if it wasn't sounding
    vizDetach();
    activeKey = key;
    reskin();
    if (viz) {
      try { viz.setTrack(key); } catch (e) {}
      scheduleResize();
    }
    if (wasOn) requestStart(key);
    updateTransport();
  }

  // --------------------------------------------------------------------------
  // RE-SKIN — everything the data-track attribute + rebuilt inserts cover.
  // --------------------------------------------------------------------------
  function reskin() {
    var def = TRACK[activeKey];
    var app = $("pj2-app");
    if (app) app.setAttribute("data-track", activeKey);
    // the desk carries the theme vars (generated sheet keys on
    // [data-pj2-theme]) so elements OUTSIDE .pj2-app — the desk ground, the
    // build stamp, the nojs lines — follow the track too
    var desk = $("pj2-desk");
    if (desk) desk.setAttribute("data-track", activeKey);

    for (var i = 0; i < TRACKS.length; i++) {
      var k = TRACKS[i];
      var tab = $("pj2-tab-" + k);
      if (!tab) continue;
      if (k === activeKey) tab.classList.add("is-active"); else tab.classList.remove("is-active");
      tab.setAttribute("aria-selected", k === activeKey ? "true" : "false");
    }

    // (no running-head title to rebuild — owner 2026-08-23: the masthead is
    // static and the active TAB is the song's title now)
    var folioNo = $("pj2-folio-no");
    if (folioNo) folioNo.textContent = def.folioNo;
    var logHead = $("pj2-log-head");
    if (logHead) logHead.textContent = def.logHead;

    buildLegend(activeKey);
    drawSeal();
    syncSeedDisplay(true);
    renderLog(activeKey);
  }

  // --------------------------------------------------------------------------
  // TRANSPORT
  // --------------------------------------------------------------------------
  function doPlay() {
    if (playIntent) return;
    playIntent = true;
    requestStart(activeKey);
    updateTransport();
    startLockArt();
  }

  function doStop() {
    playIntent = false;
    cancelPending();
    stopEngine(activeKey);
    vizDetach();
    updateTransport();
    stopLockArt();
  }

  // LIVE LOCK-SCREEN ART (owner 2026-07-20): while playing, the now-playing
  // artwork is a periodic square snapshot of the actual plate, so the lock
  // screen slowly follows the music. The static spiral emblem is the
  // create-time fallback — platforms that ignore metadata updates keep it.
  // While the page is hidden the rAF loop is stopped, so a fresh frame is
  // rendered on demand before each snapshot.
  var LOCK_ART_MS = 12000;
  var lockArtTimer = null, lockArtUrl = null;
  var LOCK_ART_TITLES = {
    library: "Prospero's Library",
    sycorax: "Sycorax's Spell",
    ariel: "Ariel's Day Off",
  };
  function refreshLockArt() {
    if (!playIntent) return;
    var bgApi = window.PJ2 && PJ2.Voice && PJ2.Voice.background;
    if (!bgApi || !bgApi.updateMetadata) return;
    var plate = $("pj2-plate");
    if (!plate || !plate.width || !plate.getContext) return;
    try {
      if (document.visibilityState === "hidden" && viz && viz.frameOnce) viz.frameOnce();
      var side = Math.min(plate.width, plate.height);
      var cv = document.createElement("canvas");
      cv.width = 512; cv.height = 512;
      var c2 = cv.getContext("2d");
      c2.drawImage(plate, (plate.width - side) / 2, (plate.height - side) / 2, side, side, 0, 0, 512, 512);
      cv.toBlob(function (blob) {
        if (!blob || !playIntent) return;
        var url = URL.createObjectURL(blob);
        var old = lockArtUrl;
        lockArtUrl = url;
        bgApi.updateMetadata({
          title: LOCK_ART_TITLES[activeKey] || "Prospero's Jukebox v2",
          artist: "Municipal Sky · Prospero's Jukebox v2",
          artwork: [{ src: url, sizes: "512x512", type: "image/png" }],
        });
        // revoke the superseded frame once the OS has had time to fetch it
        if (old) setTimeout(function () { try { URL.revokeObjectURL(old); } catch (e) {} }, 4000);
      }, "image/png");
    } catch (e) {}
  }
  function startLockArt() {
    if (lockArtTimer == null) lockArtTimer = setInterval(refreshLockArt, LOCK_ART_MS);
    setTimeout(refreshLockArt, 1500);
  }
  function stopLockArt() {
    if (lockArtTimer != null) { clearInterval(lockArtTimer); lockArtTimer = null; }
    try {
      if (window.PJ2 && PJ2.Voice && PJ2.Voice.background && PJ2.Voice.background.updateMetadata) {
        PJ2.Voice.background.updateMetadata({
          artwork: [{ src: "/images/prosperos-jukebox-v2-art.png", sizes: "656x656", type: "image/png" }],
        });
      }
    } catch (e) {}
  }

  // RESET — reseed the open book with a fresh random seed. The facade's
  // reseed hard-cuts and (if it was sounding) restarts at once, so the viz
  // attachment survives (analyser taps are facade-level, re-tapped per run).
  function doReset() {
    var eng = engineFor(activeKey);
    if (!eng) return;
    var s = freshSeed();
    seeds[activeKey] = s;
    try { eng.reseed(s); } catch (e) {}
    stampSeal();
    updateTransport();
  }

  function updateTransport() {
    // one control, two states (the apparatus dial): the ticks come up and
    // the glyph swaps to the rest when the book is asked to sound
    var toggle = $("pj2-toggle");
    if (!toggle) return;
    if (playIntent) toggle.classList.add("is-on"); else toggle.classList.remove("is-on");
    toggle.setAttribute("aria-pressed", playIntent ? "true" : "false");
    toggle.setAttribute("aria-label", playIntent ? "stop" : "play");
  }

  // the dial's art, drawn once at init: twelve zodiac tick dots just outside
  // the ring (the cardinals a pixel larger — the dial has a north) and the
  // play glyph, a right-pointing triangle stepped in 5-unit rows with its
  // flat back edge lit. SVG units, so the mark scales intact to the phone.
  function buildDialArt() {
    var SVGNS = "http://www.w3.org/2000/svg";
    var ticks = $("pj2-ticks"), gp = $("pj2-glyph-play");
    if (!ticks || !gp || ticks.childNodes.length) return;
    function rect(g, x, y, w, h, cls) {
      var r = document.createElementNS(SVGNS, "rect");
      r.setAttribute("x", x); r.setAttribute("y", y);
      r.setAttribute("width", w); r.setAttribute("height", h);
      if (cls) r.setAttribute("class", cls);
      g.appendChild(r);
    }
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * Math.PI * 2 - Math.PI / 2;
      var s = (i % 3 === 0) ? 4 : 3;
      rect(ticks, 40 + Math.cos(a) * 36.5 - s / 2, 40 + Math.sin(a) * 36.5 - s / 2, s, s, null);
    }
    for (var r0 = 0; r0 < 7; r0++) {
      rect(gp, 24, 22 + r0 * 5, 34 - Math.abs(r0 - 3) * 10, 5, "pj2-tri-body");
    }
    rect(gp, 24, 22, 2, 35, "pj2-tri-edge");
  }

  // --------------------------------------------------------------------------
  // THE WAX SEAL — seed display, typed entry, the ≤300 ms re-stamp.
  // --------------------------------------------------------------------------
  function drawSeal() {
    var cv = $("pj2-seal");
    if (!cv) return;
    var def = controlOf(activeKey);
    if (!def) return; // no registry, no seal — pj2-skin.js failed to load
    try {
      cv.width = 84; cv.height = 84;
      var c = cv.getContext("2d");
      if (!c) return;
      c.clearRect(0, 0, 84, 84);
      var noise = (window.PJ2 && PJ2.Skin && PJ2.Skin.noise) ? PJ2.Skin.noise : null;
      var U = 2, cx = 42, cy = 42;
      for (var gy = 0; gy < 42; gy++) {
        for (var gx = 0; gx < 42; gx++) {
          var px = gx * U + 1, py = gy * U + 1;
          var wob = noise ? (noise.vnoise(gx / 4.5, gy / 4.5) - 0.5) * 9 : 0;
          var d = Math.sqrt((px - cx) * (px - cx) + (py - cy) * (py - cy)) + wob;
          if (d < 36) {
            var fleck = noise ? noise.hash2(gx * 7 + 3, gy * 7 + 11) : 0;
            c.fillStyle = d > 31 ? def.waxRim : (fleck > def.waxFleck ? def.wax[1] : def.wax[0]);
            c.fillRect(px - 1, py - 1, U, U);
          }
        }
      }
      c.strokeStyle = def.waxRim;
      c.lineWidth = 2;
      c.beginPath();
      c.arc(cx, cy, 26, 0, Math.PI * 2);
      c.stroke();
    } catch (e) { /* mock canvas */ }
  }

  var stampTimer = null;
  function stampSeal() {
    syncSeedDisplay(true);
    var stack = $("pj2-seal-stack");
    if (!stack) return;
    stack.classList.remove("is-stamping");
    if (stampTimer != null) clearTimeout(stampTimer);
    // next tick so the animation restarts even on rapid re-stamps
    setTimeout(function () { stack.classList.add("is-stamping"); }, 0);
    stampTimer = setTimeout(function () {
      stampTimer = null;
      stack.classList.remove("is-stamping");
    }, 300);
  }

  function currentSeed() {
    var eng = engines[activeKey];
    if (eng) {
      try { var info = eng.getInfo(); if (info && info.seed != null) return info.seed; } catch (e) {}
    }
    if (seeds[activeKey] == null) seeds[activeKey] = (urlSeed != null) ? urlSeed : freshSeed();
    return seeds[activeKey];
  }

  function syncSeedDisplay(force) {
    // the bare echo at the apparatus column's foot follows the seal's seed
    var echo = $("pj2-seed-echo");
    if (echo) echo.textContent = String(currentSeed());
    var input = $("pj2-seed");
    if (!input) return;
    if (!force && document.activeElement === input) return; // don't fight the typist
    input.value = String(currentSeed());
  }

  function commitTypedSeed() {
    var input = $("pj2-seed");
    if (!input) return;
    var digits = String(input.value || "").replace(/[^0-9]/g, "");
    if (!digits) { syncSeedDisplay(true); return; }
    var s = (+digits) >>> 0;
    if (s === currentSeed()) { syncSeedDisplay(true); return; }
    seeds[activeKey] = s;
    var eng = engineFor(activeKey);
    if (eng) { try { eng.reseed(s); } catch (e) {} }
    stampSeal();
  }

  // --------------------------------------------------------------------------
  // THE LAMP — master volume, one shared setting across all three books.
  // Since 2026-08-31 it is the WICK GAUGE in the apparatus column: a vertical
  // throw with a transient % readout that rides the fill line while the hand
  // is on it and fades once it comes off.
  // --------------------------------------------------------------------------
  var lampBooted = false;   // the readout only shows for real adjustments
  var lampPctTimer = null;

  function applyVolume(v) {
    masterVol = clamp01(v);
    for (var k in engines) {
      try { engines[k].setMasterVolume(masterVol); } catch (e) {}
    }
    updateLamp();
  }

  function updateLamp() {
    var pct = Math.round(masterVol * 100);
    var fill = $("pj2-lamp-fill"), thumb = $("pj2-lamp-thumb"), input = $("pj2-vol");
    var pctEl = $("pj2-wick-pct");
    if (fill) fill.style.height = pct + "%";
    if (thumb) thumb.style.bottom = "calc(" + pct + "% - 2px)";
    if (pctEl) {
      pctEl.textContent = String(pct);
      // clamped so the readout never leaves the gauge at the top
      pctEl.style.bottom = "calc(" + Math.min(pct, 88) + "% + 5px)";
      if (lampBooted) {
        pctEl.classList.add("is-live");
        if (lampPctTimer != null) clearTimeout(lampPctTimer);
        lampPctTimer = setTimeout(function () {
          lampPctTimer = null;
          pctEl.classList.remove("is-live");
        }, 900);
      }
    }
    lampBooted = true;
    if (input && document.activeElement !== input) input.value = String(masterVol);
  }

  // --------------------------------------------------------------------------
  // THE MIXING DESK (PLAN-MIXING-DESK) — the per-layer mixer, rebuilt from
  // getLayers() per book into the drawer's #pj2-legend. One row per layer:
  // chevron · sigil · name · VOL; the chevron unfolds the detail strip
  // (M · S · RATE · the fine-tune knobs). Desktop only — init leaves
  // mixdeskOn false under the 700px breakpoint and nothing here is ever
  // built there.
  // --------------------------------------------------------------------------
  function stampSigil(cv, track, layerKey, label) {
    var name = TRACK[track].sigils[layerKey] || null;
    var ctl = controlOf(track);
    if (!ctl) return;
    try {
      var at = (window.PJ2 && PJ2.Skin) ? PJ2.Skin.atlas(track) : null;
      if (at && name && at.has(name)) {
        var cell = at.cells[name];
        cv.width = cell.w; cv.height = cell.h;
        cv.style.width = (cell.w * 2) + "px";
        cv.style.height = (cell.h * 2) + "px";
        var c = cv.getContext("2d");
        c.imageSmoothingEnabled = false;
        at.stamp(c, name, 0, 0, { u: 1, align: "corner", tint: ctl.sigil, tint2: ctl.sigil2 });
        return;
      }
      // No authored cell for this layer: a scribal initial in the same ink.
      cv.width = 12; cv.height = 12;
      cv.style.width = "24px"; cv.style.height = "24px";
      var c2 = cv.getContext("2d");
      c2.imageSmoothingEnabled = false;
      c2.fillStyle = ctl.sigil;
      c2.font = '12px "VT323", monospace';
      c2.textAlign = "center";
      c2.textBaseline = "middle";
      c2.fillText(String(label || layerKey).charAt(0).toUpperCase(), 6, 7);
    } catch (e) { /* mock canvas */ }
  }

  // The dithered-fill slider, one component for VOL and RATE: set(frac)
  // positions fill + thumb on a 0..1 fraction (unquantized, per §5).
  function makeDeskSlider(ariaLabel) {
    var slider = document.createElement("div");
    slider.className = "pj2-legend-slider";
    var fill = document.createElement("div");
    fill.className = "pj2-legend-fill";
    var thumb = document.createElement("div");
    thumb.className = "pj2-legend-thumb";
    var range = document.createElement("input");
    range.type = "range";
    range.min = "0"; range.max = "1"; range.step = "any";
    range.setAttribute("aria-label", ariaLabel);
    slider.appendChild(fill);
    slider.appendChild(thumb);
    slider.appendChild(range);
    return {
      el: slider,
      range: range,
      set: function (frac) {
        frac = clamp01(frac);
        var pct = (frac * 100).toFixed(2) + "%";
        fill.style.width = pct;
        thumb.style.left = "calc(" + pct + " - 2px)";
      },
    };
  }

  // RATE mapping: a 0..1 throw, log-mapped 0.25×–4× around the 1× center
  // (v1's mapping with a saner range). rate = 4^((frac - 0.5) / 0.5).
  function fracToRate(f) { return Math.pow(4, (clamp01(f) - 0.5) / 0.5); }
  function rateToFrac(r) {
    r = +r;
    if (!isFinite(r) || r <= 0) r = 1;
    return clamp01(0.5 + 0.5 * Math.log(r) / Math.log(4));
  }
  function fmtRate(r) {
    var s = (+r).toFixed(2);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s + "×";
  }

  function countSolo() {
    var n = 0;
    for (var k in soloSet) n++;
    return n;
  }

  // Dissolve the solo mode. With restore=true the pre-solo mute set is
  // written back to the engine (the last-solo-cleared and tab-switch
  // paths); with false the mutes stand as the solo left them (a manual
  // mute click — the user takes the mutes back over by hand).
  function dissolveSolo(restore) {
    var eng = engines[activeKey];
    if (restore && eng && soloMutes) {
      for (var k in soloMutes) {
        try { eng.toggleLayer(k, !soloMutes[k]); } catch (e) {}
      }
    }
    soloSet = {};
    soloMutes = null;
  }

  // Soloing L mutes every non-soloed layer through the existing
  // toggleLayer(key, on) contract; solos compose (A then B = only A+B
  // audible); clearing the last solo restores the saved pre-solo mutes.
  function applySolo(eng, layers, key) {
    var i;
    if (!soloSet[key]) {
      if (!soloMutes) {
        soloMutes = {};
        var info = null;
        try { info = eng.getInfo(); } catch (e) {}
        for (i = 0; i < layers.length; i++) {
          var lk = layers[i].key;
          soloMutes[lk] = !!(info && info.layers && info.layers[lk] && info.layers[lk].muted);
        }
      }
      soloSet[key] = true;
      try { eng.toggleLayer(key, true); } catch (e) {}
      for (i = 0; i < layers.length; i++) {
        if (!soloSet[layers[i].key]) {
          try { eng.toggleLayer(layers[i].key, false); } catch (e) {}
        }
      }
    } else {
      delete soloSet[key];
      if (!countSolo()) {
        dissolveSolo(true);
      } else {
        try { eng.toggleLayer(key, false); } catch (e) {}
      }
    }
  }

  // Re-read the engine's mute truth (and the UI's solo set) onto the rows.
  function refreshMixRows() {
    var eng = engines[activeKey];
    var info = null;
    try { info = eng && eng.getInfo(); } catch (e) {}
    for (var i = 0; i < mixRowRender.length; i++) {
      try { mixRowRender[i](info); } catch (e) {}
    }
  }

  // Plain readout formatting for the fine-tune knobs (fmtRate's trimming,
  // no unit suffix).
  function fmtParam(v) {
    var s = (+v).toFixed(2);
    if (s.indexOf(".") >= 0) s = s.replace(/0+$/, "").replace(/\.$/, "");
    return s;
  }

  function buildLegend(key) {
    var box = $("pj2-legend");
    mixRowRender = [];
    if (!box || !mixdeskOn) return;
    var eng = engineFor(key);
    box.textContent = "";
    if (!eng) return;
    var layers = [], vols = {}, rates = {}, info = null, params = {}, paramVals = {};
    try { layers = eng.getLayers(); } catch (e) { return; }
    try { vols = eng.getLayerVolumes(); } catch (e) {}
    try { if (typeof eng.getLayerRates === "function") rates = eng.getLayerRates() || {}; } catch (e) {}
    try { if (typeof eng.getLayerParams === "function") params = eng.getLayerParams() || {}; } catch (e) {}
    try { if (typeof eng.getLayerParamValues === "function") paramVals = eng.getLayerParamValues() || {}; } catch (e) {}
    try { info = eng.getInfo(); } catch (e) {}
    var canRate = typeof eng.setLayerRate === "function";
    var canParam = typeof eng.setLayerParam === "function";

    for (var i = 0; i < layers.length; i++) {
      (function (ly) {
        var row = document.createElement("div");
        row.className = "pj2-legend-row";

        // The collapsed row is chevron · sigil · name · VOL and nothing
        // else (owner 2026-08-22). Every layer has a detail strip — RATE,
        // M/S and the fine-tune knobs live there — so every chevron works.
        var knobDefs = (canParam && params[ly.key] && params[ly.key].length) ? params[ly.key] : null;
        var hasRate = canRate && rates[ly.key] != null;
        var chev = document.createElement("button");
        chev.type = "button";
        chev.className = "pj2-legend-chev";
        chev.setAttribute("aria-label", "fine-tune " + ly.label);
        chev.setAttribute("aria-expanded", "false");
        chev.textContent = "▸︎";
        row.appendChild(chev);

        var sigilBox = document.createElement("div");
        sigilBox.className = "pj2-legend-sigil";
        var cvs = document.createElement("canvas");
        sigilBox.appendChild(cvs);
        stampSigil(cvs, key, ly.key, ly.label);
        row.appendChild(sigilBox);

        var name = document.createElement("span");
        name.className = "pj2-legend-name";
        name.textContent = ly.label;
        row.appendChild(name);

        var vol = makeDeskSlider(ly.label + " volume");
        row.appendChild(vol.el);
        var v0 = (vols && vols[ly.key] != null) ? vols[ly.key] : 1;
        vol.range.value = String(v0);
        vol.set(v0);
        vol.range.addEventListener("input", function () {
          var v = clamp01(vol.range.value);
          try { eng.setLayerVolume(ly.key, v); } catch (e) {}
          vol.set(v);
        });

        // THE DETAIL STRIP — unfolds beneath the row: the M/S squares,
        // RATE + readout (lane-ful layers only), then the fine-tune knobs.
        // Expansion dies with the rebuild on tab switch.
        var strip = document.createElement("div");
        strip.className = "pj2-detail";
        strip.id = "pj2-detail-" + ly.key;
        strip.setAttribute("hidden", "");
        chev.setAttribute("aria-controls", strip.id);

        // v1's pixel mute square, kept verbatim: filled = audible
        var muteBox = document.createElement("span");
        muteBox.className = "pj2-detail-ms";
        var mute = document.createElement("button");
        mute.type = "button";
        mute.className = "pj2-legend-mute";
        mute.setAttribute("aria-label", "mute " + ly.label);
        function renderMute(muted) {
          if (muted) mute.classList.remove("is-on"); else mute.classList.add("is-on");
          mute.setAttribute("aria-pressed", muted ? "true" : "false");
        }
        var muted0 = !!(info && info.layers && info.layers[ly.key] && info.layers[ly.key].muted);
        renderMute(muted0);
        mute.addEventListener("click", function () {
          if (countSolo()) dissolveSolo(false); // a manual mute takes the mutes back over
          try { eng.toggleLayer(ly.key); } catch (e) {}
          refreshMixRows();
        });
        muteBox.appendChild(mute);
        var mcap = document.createElement("span");
        mcap.className = "pj2-detail-cap";
        mcap.textContent = "MUTE";
        muteBox.appendChild(mcap);
        strip.appendChild(muteBox);

        // the solo square — the accent fill to the mute's bone fill
        var soloBox = document.createElement("span");
        soloBox.className = "pj2-detail-ms";
        var solo = document.createElement("button");
        solo.type = "button";
        solo.className = "pj2-legend-solo";
        solo.setAttribute("aria-label", "solo " + ly.label);
        function renderSolo(on) {
          if (on) solo.classList.add("is-on"); else solo.classList.remove("is-on");
          solo.setAttribute("aria-pressed", on ? "true" : "false");
        }
        renderSolo(!!soloSet[ly.key]);
        solo.addEventListener("click", function () {
          applySolo(eng, layers, ly.key);
          refreshMixRows();
        });
        soloBox.appendChild(solo);
        var scap = document.createElement("span");
        scap.className = "pj2-detail-cap";
        scap.textContent = "SOLO";
        soloBox.appendChild(scap);
        strip.appendChild(soloBox);

        mixRowRender.push(function (inf) {
          renderMute(!!(inf && inf.layers && inf.layers[ly.key] && inf.layers[ly.key].muted));
          renderSolo(!!soloSet[ly.key]);
        });

        // RATE — only for layers with a clock lane (getLayerRates omits the
        // lane-less ones, e.g. halo). Log-mapped, center detent: a
        // double-click on the READOUT settles the throw back to 1× (the
        // invisible range covers the slider, so a dblclick there would
        // jump the rate twice before resetting).
        if (hasRate) {
          var rateBox = document.createElement("span");
          rateBox.className = "pj2-detail-rate";
          var rate = makeDeskSlider(ly.label + " rate");
          rate.el.classList.add("pj2-legend-rate");
          var readout = document.createElement("span");
          readout.className = "pj2-legend-rate-val";
          readout.title = "double-click to reset to 1×";
          readout.setAttribute("aria-label", ly.label + " rate — double-click to reset to 1×");
          var r0 = rates[ly.key];
          rate.range.value = String(rateToFrac(r0));
          rate.set(rateToFrac(r0));
          readout.textContent = fmtRate(r0);
          rate.range.addEventListener("input", function () {
            var r = fracToRate(rate.range.value);
            try { eng.setLayerRate(ly.key, r); } catch (e) {}
            rate.set(rate.range.value);
            readout.textContent = fmtRate(r);
          });
          readout.addEventListener("dblclick", function () {
            try { eng.setLayerRate(ly.key, 1); } catch (e) {}
            rate.range.value = "0.5";
            rate.set(0.5);
            readout.textContent = fmtRate(1);
          });
          rateBox.appendChild(rate.el);
          rateBox.appendChild(readout);
          var rcap = document.createElement("span");
          rcap.className = "pj2-detail-cap";
          rcap.textContent = "RATE";
          rateBox.appendChild(rcap);
          strip.appendChild(rateBox);
        }

        // the fine-tune knobs: one compact slider per exposed param, linear
        // across the knob's [min, max], live through setLayerParam.
        if (knobDefs) {
          for (var ki = 0; ki < knobDefs.length; ki++) {
            (function (pd) {
              var item = document.createElement("div");
              item.className = "pj2-knob";
              var lab = document.createElement("span");
              lab.className = "pj2-knob-name";
              lab.textContent = pd.key;
              lab.title = pd.label;
              item.appendChild(lab);
              var sl = makeDeskSlider(ly.label + " " + pd.key);
              item.appendChild(sl.el);
              var rd = document.createElement("span");
              rd.className = "pj2-knob-val";
              item.appendChild(rd);
              var vals = paramVals[ly.key] || {};
              var v0 = (vals[pd.key] != null) ? vals[pd.key] : pd.def;
              var span = pd.max - pd.min;
              function showV(v) {
                sl.set((v - pd.min) / span);
                rd.textContent = fmtParam(v);
              }
              sl.range.value = String((v0 - pd.min) / span);
              showV(v0);
              sl.range.addEventListener("input", function () {
                var v = pd.min + clamp01(sl.range.value) * span;
                try { eng.setLayerParam(ly.key, pd.key, v); } catch (e) {}
                showV(v);
              });
              strip.appendChild(item);
            })(knobDefs[ki]);
          }
        }

        chev.addEventListener("click", function () {
          var open = strip.hasAttribute("hidden");
          if (open) strip.removeAttribute("hidden"); else strip.setAttribute("hidden", "");
          chev.setAttribute("aria-expanded", open ? "true" : "false");
          chev.textContent = open ? "▾︎" : "▸︎";
          if (open) chev.classList.add("is-open"); else chev.classList.remove("is-open");
        });
        box.appendChild(row);
        box.appendChild(strip);
      })(layers[i]);
    }
  }

  // --------------------------------------------------------------------------
  // THE COPY PLATE — the mix as JSON is the save mechanism
  // (PLAN-MIXING-DESK: no localStorage mixes — copy is how a mix is kept,
  // shared, and hand-tuned). Solo is transient and never serialized.
  // --------------------------------------------------------------------------
  function round3(v) { return Math.round((+v) * 1000) / 1000; }

  // The pre-clipboard-API path: a parked offscreen textarea + execCommand.
  function legacyCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    try { document.body.removeChild(ta); } catch (e) {}
  }

  function serializeMix() {
    var eng = engines[activeKey];
    if (!eng) return null;
    var layers = [], vols = {}, rates = {}, info = null, pDefs = {}, pVals = {};
    try { layers = eng.getLayers(); } catch (e) { return null; }
    try { vols = eng.getLayerVolumes(); } catch (e) {}
    try { if (typeof eng.getLayerRates === "function") rates = eng.getLayerRates() || {}; } catch (e) {}
    try { if (typeof eng.getLayerParams === "function") pDefs = eng.getLayerParams() || {}; } catch (e) {}
    try { if (typeof eng.getLayerParamValues === "function") pVals = eng.getLayerParamValues() || {}; } catch (e) {}
    try { info = eng.getInfo(); } catch (e) {}
    var out = { "pj2-mix": 1, track: activeKey, master: round3(masterVol), layers: {} };
    for (var i = 0; i < layers.length; i++) {
      var k = layers[i].key;
      var cell = {
        v: round3(vols[k] != null ? vols[k] : 1),
        m: (info && info.layers && info.layers[k] && info.layers[k].muted) ? 1 : 0,
      };
      if (rates[k] != null) cell.r = round3(rates[k]); // lane-less layers carry no rate
      // knob values ride under "p" — only non-defaults, to keep blobs short
      var pd = pDefs[k], pv = pVals[k];
      if (pd && pv) {
        var pmap = null;
        for (var pi = 0; pi < pd.length; pi++) {
          var d = pd[pi];
          if (pv[d.key] != null && round3(pv[d.key]) !== round3(d.def)) {
            if (!pmap) pmap = {};
            pmap[d.key] = round3(pv[d.key]);
          }
        }
        if (pmap) cell.p = pmap;
      }
      out.layers[k] = cell;
    }
    return JSON.stringify(out, null, 2);
  }

  function initMixdesk() {
    // COPY — the plate flashes COPIED for a breath once the text is away.
    // (Mixing desk III, owner 2026-08-22: no collapse, no header, no
    // PASTE — the rows are simply always there, with COPY beneath them.)
    var copyBtn = $("pj2-mix-copy");
    var copyTimer = null;
    if (copyBtn) copyBtn.addEventListener("click", function () {
      var text = serializeMix();
      if (text == null) return;
      function flash() {
        copyBtn.textContent = "COPIED";
        if (copyTimer != null) clearTimeout(copyTimer);
        copyTimer = setTimeout(function () { copyTimer = null; copyBtn.textContent = "COPY"; }, 1000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(flash, function () { legacyCopy(text); flash(); });
      } else {
        legacyCopy(text);
        flash();
      }
    });
  }

  // --------------------------------------------------------------------------
  // THE SCRIBAL LOG (§4) — engine events → annotation rows. The engines'
  // display labels print VERBATIM (the shared-vocabulary ruling); the skin
  // only decides tag color, capital, and aging.
  // --------------------------------------------------------------------------
  var SKIP_EVENTS = { air: 1, percussion: 1, organum: 1 };
  var RUBRIC_TAGS = {
    scene: 1, cadence: 1, seachange: 1, ghost: 1, coagula: 1, cast: 1,
    cut: 1, "cut-return": 1, reground: 1, performance: 1, arrival: 1,
  };

  var ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
  function roman(n) {
    n = n | 0;
    if (n <= 0) return "0";
    return n < ROMAN.length ? ROMAN[n] : String(n);
  }

  function fmtClock(t) {
    if (typeof t !== "number" || !isFinite(t) || t < 0) return "--:--";
    var s = Math.floor(t);
    var mm = Math.floor(s / 60), ss = s % 60;
    return (mm < 10 ? "0" + mm : String(mm)) + ":" + (ss < 10 ? "0" + ss : String(ss));
  }

  function capWord(s) {
    s = String(s == null ? "" : s);
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function descVal(v) {
    if (v == null) return "";
    if (typeof v === "string" || typeof v === "number") return String(v);
    if (typeof v === "object") {
      if (v.name) return String(v.name);
      var bits = [];
      if (v.mode) bits.push(String(v.mode));
      if (typeof v.tonicHz === "number") bits.push("tonic " + Math.round(v.tonicHz));
      if (bits.length) return bits.join(" · ");
    }
    return "";
  }

  // → {tag, body, rubric, scene, seed?} or null to skip
  function describeEvent(key, e) {
    if (!e || !e.type || SKIP_EVENTS[e.type]) return null;
    var tag = e.type, body = "", scene = false, seedVal = null;
    switch (e.type) {
      case "engine":
        if (e.state === "play") { body = "the book opens · seed "; seedVal = e.seed; }
        else if (e.state === "stop") { body = "the reading pauses — the tail rings out"; }
        else if (e.state === "reseed") { body = "the seal re-stamped · seed "; seedVal = e.seed; }
        else body = String(e.state || "");
        break;
      case "performance":
        if (e.phase === "begin") {
          body = "evening " + (e.n != null ? e.n : "?")
            + (e.scenes ? " · " + e.scenes.length + " scenes" : "")
            + (e.tideLabel ? " · " + e.tideLabel : "");
        } else {
          body = "evening " + (e.n != null ? e.n : "?") + " closes";
        }
        break;
      case "scene": {
        scene = true;
        var name = e.label || capWord(e.scene);
        body = name + " · " + ((e.idx | 0) + 1) + " of " + (e.count != null ? e.count : "?")
          + (e.activity ? " · " + e.activity : "");
        break;
      }
      case "cadence":
        body = (e.label || e.kind || "cadence")
          + (e.chords && e.chords.length ? " · " + e.chords.join(" → ") : "")
          + (e.kind && e.label ? " (" + e.kind + ")" : "");
        break;
      case "seachange":
        body = (e.label || "sea change")
          + (descVal(e.target) ? " · " + descVal(e.target) : "")
          + " — the substance changes";
        break;
      case "ghost":
        body = (e.label || "ghost") + (e.name ? " · " + e.name : "")
          + (e.promoted ? " · promoted" : "") + " · an earlier hand";
        break;
      case "coagula":
        body = (e.label || "solve et coagula") + (e.name ? " · " + e.name : "")
          + " — the theme settles whole";
        break;
      // rc.31 — the evening's CAST, in plain words (owner, 2026-09-02: plain
      // while we tune; the alchemical register is a later decision). Evening
      // one of a run wears no draw at all and says so.
      case "cast": {
        if (e.plain) { body = "tonight: the full ensemble, plain"; break; }
        var dress = [];
        if (e.harpsichord) {
          dress.push("harpsichord, " + (e.harpsichord === "lute" ? "lute stop" : "8′"));
        }
        if (e.musicbox) {
          dress.push(e.musicbox === "absent" ? "no music box tonight" : "music box, " + e.musicbox);
        }
        if (e.drone) dress.push("drone, " + e.drone);
        if (e.vessel) dress.push("the vessel " + e.vessel);
        if (e.regal) dress.push("the regal " + e.regal);
        if (e.flue) dress.push("the flue " + e.flue);
        body = "tonight: " + dress.join(" · ");
        break;
      }
      case "develop":
        body = (e.voice ? e.voice + " · " : "") + (e.name || "motif")
          + " · gen " + roman(e.gen) + " — the branch grows";
        break;
      case "answer":
        body = (e.voice ? e.voice + " answers" : "an answer") + (e.name ? " · " + e.name : "")
          + (e.gen != null ? " · gen " + roman(e.gen) : "");
        break;
      case "tide":
        body = (e.label || "the tide") + " · " + (typeof e.pos === "number" ? e.pos.toFixed(2) : "");
        break;
      case "joint":
        body = "the seam · " + (e.from || "?") + " → " + (e.to || "?");
        break;
      case "joint-gesture":
        body = "a gesture at the seam" + (e.gesture ? " · " + descVal(e.gesture) : "");
        break;
      case "pose":
        body = "the harmony takes " + (e.pose || "?") + (e.via ? " · via " + e.via : "");
        break;
      case "arrival":
        body = "arrival · " + (e.to || "") + " — the sigil gouged deeper";
        break;
      case "cut":
        body = "THE CUT · severity " + (typeof e.severity === "number" ? e.severity.toFixed(2) : "?")
          + " — the block gouged, the print skips";
        break;
      case "cut-return":
        body = "the print returns · the scar remains";
        break;
      case "bruise":
        body = "a bruise on the block" + (typeof e.value === "number" ? " · " + e.value.toFixed(2) : "");
        break;
      case "reground":
        body = "reground at the seam" + (descVal(e.from) ? " · " + descVal(e.from) : "")
          + (descVal(e.to) ? " → " + descVal(e.to) : "");
        break;
      case "release":
        body = "the release — upward, not louder";
        break;
      case "feather":
        body = "a feather falls";
        break;
      case "bass-flourish":
        body = "the bass flourishes once";
        break;
      default: {
        var bits = [];
        for (var k in e) {
          if (k === "type" || k === "t") continue;
          var v = e[k];
          if (typeof v === "string" || typeof v === "number") bits.push(k + " " + v);
          if (bits.length >= 3) break;
        }
        body = bits.join(" · ");
      }
    }
    return {
      t: (typeof e.t === "number") ? e.t : null,
      tag: tag,
      body: body,
      rubric: !!RUBRIC_TAGS[e.type],
      scene: scene,
      seed: seedVal,
    };
  }

  function makeLogRow(entry) {
    var row = document.createElement("div");
    row.className = "pj2-log-row pj2-age-0";
    var tEl = document.createElement("span");
    tEl.className = "pj2-log-t";
    tEl.textContent = fmtClock(entry.t);
    row.appendChild(tEl);
    var tagEl = document.createElement("span");
    tagEl.className = "pj2-log-tag" + (entry.rubric ? "" : " pj2-tag-plain");
    tagEl.textContent = entry.tag;
    row.appendChild(tagEl);
    var bodyEl = document.createElement("span");
    bodyEl.className = "pj2-log-body";
    if (entry.scene && entry.body) {
      // illuminated capital on scene headings (§4)
      var cap = document.createElement("span");
      cap.className = "pj2-cap";
      cap.textContent = entry.body.charAt(0);
      bodyEl.appendChild(cap);
      bodyEl.appendChild(document.createTextNode(entry.body.slice(1)));
    } else {
      bodyEl.appendChild(document.createTextNode(entry.body || ""));
      if (entry.seed != null) {
        var g = document.createElement("span");
        g.className = "pj2-gd";
        g.textContent = String(entry.seed);
        bodyEl.appendChild(g);
      }
    }
    row.appendChild(bodyEl);
    return row;
  }

  // ink aging: three palette steps by recency (never alpha)
  function reAgeLog() {
    for (var i = 0; i < logRowEls.length; i++) {
      var el = logRowEls[i];
      var age = i < 6 ? 0 : (i < 18 ? 1 : 2);
      el.className = "pj2-log-row pj2-age-" + age;
    }
  }

  function renderLog(key) {
    var box = $("pj2-log");
    if (!box) return;
    box.textContent = "";
    logRowEls = [];
    var entries = logs[key];
    if (!entries.length) {
      var empty = document.createElement("div");
      empty.className = "pj2-log-empty";
      empty.textContent = "the page waits — press play";
      box.appendChild(empty);
      return;
    }
    for (var i = 0; i < entries.length; i++) {
      var row = makeLogRow(entries[i]);
      logRowEls.push(row);
      box.appendChild(row);
    }
    reAgeLog();
  }

  function pushLog(key, entry) {
    logs[key].unshift(entry);
    if (logs[key].length > MAX_LOG_ROWS) logs[key].length = MAX_LOG_ROWS;
    if (key !== activeKey) return;
    var box = $("pj2-log");
    if (!box) return;
    if (!logRowEls.length) box.textContent = ""; // clear the "page waits" line
    var row = makeLogRow(entry);
    logRowEls.unshift(row);
    if (box.firstChild) box.insertBefore(row, box.firstChild);
    else box.appendChild(row);
    while (logRowEls.length > MAX_LOG_ROWS) {
      var old = logRowEls.pop();
      try { box.removeChild(old); } catch (e) {}
    }
    reAgeLog();
  }

  function onEngineEvent(key, e) {
    if (e && e.type === "engine" && e.state === "reseed") {
      seeds[key] = e.seed;
      if (key === activeKey) syncSeedDisplay(true);
    }
    var entry = describeEvent(key, e);
    if (entry) pushLog(key, entry);
    if (e && e.type === "engine" && key === activeKey) updateTransport();
  }

  // --------------------------------------------------------------------------
  // TELEMETRY — the 300 ms getInfo() poll: the compact strip (§6), the seed
  // display, the transport lit states, and the two lifecycle watchdogs.
  // --------------------------------------------------------------------------
  function pollTick() {
    var eng = engines[activeKey];
    var strip = $("pj2-telemetry");
    if (!eng) {
      if (strip) strip.textContent = "idle · press play";
      return;
    }
    var info = null;
    try { info = eng.getInfo(); } catch (e) { return; }
    if (!info) return;

    // Watchdog 1: a straggling finalize suspended the shared ctx under a
    // playing engine (the documented shared-context subtlety) — resume it.
    if (playIntent && info.playing && sharedCtx && sharedCtx.state === "suspended"
        && nowMs() >= busyUntil) {
      try { sharedCtx.resume(); } catch (e) {}
    }
    // Watchdog 2: sounding against the user's wish (e.g. a reseed fired
    // during a stop-fade replays by facade contract) — put it back down.
    if (!playIntent && info.playing && pendingTimer == null) stopEngine(activeKey);

    updateTransport();
    syncSeedDisplay(false);

    if (strip) {
      var bits = [];
      if (!info.playing) bits.push("idle");
      if (info.perfN != null) bits.push("evening " + info.perfN);
      if (info.sceneType) {
        bits.push((info.sceneLabel ? info.sceneLabel + " · " : "") + info.sceneType
          + (typeof info.x === "number" ? " · x " + info.x.toFixed(2) : ""));
      }
      if (typeof info.tidePos === "number") {
        bits.push("tide " + info.tidePos.toFixed(2) + (info.tideLabel ? " " + info.tideLabel : ""));
      }
      if (typeof info.intensity === "number") bits.push("fire " + info.intensity.toFixed(2));
      if (info.airHolders && info.airHolders.length != null) bits.push("air " + info.airHolders.length);
      // the chord name, or Sycorax's pose — plus the cadence's label while
      // an approach is announced (the harmony readout's one mobile surface);
      // the label gates on playing so a stopped engine never shows a stale one
      if (info.harmony || info.pose) {
        bits.push(String(info.harmony || info.pose)
          + (info.playing && info.cadence && info.cadence.label != null ? " · " + String(info.cadence.label).toLowerCase() : ""));
      }
      strip.textContent = bits.join("  ·  ") || "—";
    }
  }

  // --------------------------------------------------------------------------
  // INIT
  // --------------------------------------------------------------------------
  function showUnsupported() {
    var el = $("pj2-unsupported");
    if (el) el.classList.add("is-shown");
  }

  function init() {
    var P = window.PJ2;
    if (!P || !P.Library || !P.Sycorax || !P.Ariel || !P.Skin || !RealAC) {
      showUnsupported();
      if (!P || !P.Library) return; // without engines there is nothing to drive
      if (!RealAC) return;
    }

    // the tab row above the folio
    for (var i = 0; i < TRACKS.length; i++) {
      (function (k) {
        var tab = $("pj2-tab-" + k);
        if (tab) tab.addEventListener("click", function () { selectTrack(k); });
      })(TRACKS[i]);
    }

    // transport — the apparatus dial (one control, two states) + the rune
    buildDialArt();
    var toggleBtn = $("pj2-toggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", function () {
        if (playIntent) doStop(); else doPlay();
      });
    }
    var runeBtn = $("pj2-rune");
    if (runeBtn) {
      runeBtn.addEventListener("click", function () {
        runeBtn.classList.remove("is-spun");
        void runeBtn.offsetWidth; // restart the steps() spin on repeat presses
        runeBtn.classList.add("is-spun");
        doReset();
      });
    }

    // (the NIGHT/PARCH binding switch retired 2026-08-31 — the parchment
    // page is the app's one dress; PJ2.Skin and PJ2.Viz both default to it)

    // the seal
    var seedInput = $("pj2-seed");
    if (seedInput) {
      seedInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.keyCode === 13) {
          commitTypedSeed();
          try { seedInput.blur(); } catch (e2) {}
        }
      });
      seedInput.addEventListener("change", commitTypedSeed);
    }

    // the lamp — the wick gauge: the visually-hidden range is the real
    // control (keyboard + AT); pointer drags on the etched column write to it
    var volInput = $("pj2-vol");
    if (volInput) {
      volInput.addEventListener("input", function () { applyVolume(volInput.value); });
      masterVol = clamp01(volInput.value != null && volInput.value !== "" ? volInput.value : masterVol);
    }
    var wickEl = $("pj2-wick"), wickTrack = $("pj2-wick-track");
    if (wickTrack) {
      var wickDragging = false;
      var wickSet = function (clientY) {
        var box = wickTrack.getBoundingClientRect();
        if (!box.height) return;
        var t = clamp01(1 - (clientY - box.top) / box.height); // bottom = 0, top = 1
        if (volInput) volInput.value = String(t); // keep the real control honest
        applyVolume(t);
      };
      wickTrack.addEventListener("pointerdown", function (e) {
        wickDragging = true;
        try { if (wickTrack.setPointerCapture) wickTrack.setPointerCapture(e.pointerId); } catch (e2) {}
        wickSet(e.clientY);
        try { if (volInput) volInput.focus(); } catch (e2) {}
        if (e.preventDefault) e.preventDefault();
      });
      wickTrack.addEventListener("pointermove", function (e) {
        if (wickDragging) wickSet(e.clientY);
      });
      var wickEnd = function () { wickDragging = false; };
      wickTrack.addEventListener("pointerup", wickEnd);
      wickTrack.addEventListener("pointercancel", wickEnd);
      if (volInput && wickEl) {
        volInput.addEventListener("focus", function () { wickEl.classList.add("is-focus"); });
        volInput.addEventListener("blur", function () { wickEl.classList.remove("is-focus"); });
      }
    }
    updateLamp();

    // the mixing desk — at EVERY width since 2026-08-23 (owner: the
    // fine-tuning happens from a phone too). CSS compacts the rows under
    // the 700px breakpoint instead of hiding them.
    mixdeskOn = true;
    initMixdesk();
    buildLegend(activeKey);

    // space = play/stop (when not in an input; buttons keep native space,
    // and the mixing desk's header keeps its own Enter/Space toggle)
    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space" && e.key !== " ") return;
      var t = e.target;
      var tag = (t && t.tagName) ? String(t.tagName).toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      if (t && t.isContentEditable) return;
      if (e.preventDefault) e.preventDefault();
      if (playIntent) doStop(); else doPlay();
    });

    // background-audio (lock-screen survival, kolob pattern): the helper's
    // media-session transport drives the cabinet's own play/stop
    try {
      if (window.PJ2 && PJ2.Voice && PJ2.Voice.background) {
        PJ2.Voice.background.setHandlers({ onPlay: doPlay, onPause: doStop });
      }
    } catch (e) {}

    // viz lifecycle
    viz = makeViz();
    try { viz.setTrack(activeKey); } catch (e) {}
    document.addEventListener("visibilitychange", function () {
      if (!viz) return;
      if (document.visibilityState === "hidden") {
        if (vizStarted) { try { viz.stop(); } catch (e) {} vizStarted = false; }
      } else {
        startVizOnce();
      }
    });
    window.addEventListener("resize", scheduleResize);

    // canvas text (and the log's Jacquard capitals) want the faces resident
    // before first paint — the pj2-skin lesson: document.fonts.load first.
    var fontsKicked = false;
    function kickViz() {
      if (fontsKicked) return;
      fontsKicked = true;
      startVizOnce();
    }
    try {
      if (document.fonts && document.fonts.load) {
        Promise.all([
          document.fonts.load('16px "VT323"'),
          document.fonts.load('16px "Jacquard 12"'),
        ]).then(kickViz, kickViz);
        setTimeout(kickViz, 1500); // never let a font CDN hold the plate hostage
      } else {
        kickViz();
      }
    } catch (e) { kickViz(); }

    reskin();
    updateTransport();
    setInterval(pollTick, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // a small debug/harness surface (unlinked, like the engines' facades)
  window.PJ2 = window.PJ2 || {};
  window.PJ2.UI = {
    _engines: engines,
    activeTrack: function () { return activeKey; },
    isPlayIntent: function () { return playIntent; },
    sharedContext: function () { return sharedCtx; },
  };
})();

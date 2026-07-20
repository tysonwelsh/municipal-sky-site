// ============================================================================
// PROSPERO'S JUKEBOX v2 — pj2-ui.js · the conjurer's cabinet controller
//
// The chrome layer between the page (index.php + pj2.css) and everything
// beneath it: the three engine facades (PJ2.Library / Sycorax / Ariel), the
// skin toolkit (PJ2.Skin — palettes, atlas sigils), and the visualization
// (PJ2.Viz — plate / margin / footer canvases). This file owns:
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
//   · THE MIXER LEGEND — rebuilt from getLayers() on every tab switch: an
//     authored voice sigil stamped from PJ2.Skin.atlas, VT323 name, a
//     dithered-fill slider whose thumb position is unquantized, and v1's
//     pixel mute square (filled = audible) wired to toggleLayer.
//
//   · THE SCRIBAL EVENT LOG (§4) — DOM rows fed by setEventListener. Scene
//     lines print the ENGINE'S display labels (Calcinatio … Coagulatio;
//     Transmutatio; cadence Latin) with an illuminated capital; tags are
//     rubricated per skin; entries age through the registry's three ink
//     steps; the buffer caps at ~120 rows per book. A compact telemetry
//     strip (300 ms getInfo() poll) carries the margin data on small
//     screens (§6 degradation).
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
  // TRACK TABLE — one row per book. Wax/sigil tints are cabinet-chrome duty:
  // wax bodies come from each track's registry accent ramp; the rim shades
  // and the bone sigil ink are the cabinet's own constants (mockup chrome).
  // --------------------------------------------------------------------------
  var TRACKS = ["library", "sycorax", "ariel"];
  var TRACK = {
    library: {
      ns: "Library",
      // the original v1 song titles, verbatim (owner ruling) — the kicker
      // "Prospero's Jukebox · " stays small; the title is the display text
      title: { pre: "Prospero’s Jukebox · ", init: "P", rest: "rospero’s Library" },
      folioNo: "c dorian · tonic 262",
      logHead: "annotationes · the scribal log",
      sigils: {
        drone: "voice-drone", hum: "quill", harpsichord: "voice-harp",
        musicbox: "voice-box", halo: "sigil-sol",
      },
      sigilTint: "#c7b795", sigilTint2: "#c9a227",           // bone + gilt (chrome duty)
      wax: ["#8e3b2c", "#b0553c"], waxRim: "#5e2018", waxFleck: 0.72,
    },
    sycorax: {
      ns: "Sycorax",
      title: { pre: "Prospero’s Jukebox · ", init: "S", rest: "ycorax’s Spell" },
      folioNo: "the ghost world · tonic 311",
      logHead: "the black book’s margins · scribal log",
      sigils: {
        gurdy: "voice-gurdy", noise: "pose-smoke", chant: "voice-chant",
        rebec: "voice-rebec", waterphone: "voice-waterphone",
        boneflute: "voice-boneflute", percussion: "voice-protodrum",
        ambient: "pose-veil",
      },
      sigilTint: "#b3a68e", sigilTint2: "#9b87b8",           // bone-1 + dim witch
      wax: ["#6e2a22", "#93392b"], waxRim: "#0d0b09", waxFleck: 0.72,
    },
    ariel: {
      ns: "Ariel",
      title: { pre: "Prospero’s Jukebox · ", init: "A", rest: "riel’s Day Off" },
      folioNo: "f lydian · tonic 349",
      logHead: "chart annotations · the scribal log",
      sigils: {
        breeze: "voice-breeze", whistle: "voice-whistle", chime: "voice-chime",
        flutter: "voice-flutter", bass: "voice-bass", aeolian: "voice-aeolian",
        ambient: "voice-gust", halo: "star",
      },
      sigilTint: "#a8c0d4", sigilTint2: "#d4af5f",           // silver-1 + gilt-0
      wax: ["#a04838", "#d4af5f"], waxRim: "#05070c", waxFleck: 0.9,
    },
  };

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
        var paperTone = pal ? (pal.paper ? pal.paper[1] : pal.plate[1]) : "#e3d3a8";
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
    var plate = $("pj2-plate"), margin = $("pj2-margin"), footer = $("pj2-footer");
    if (window.PJ2 && PJ2.Viz && typeof PJ2.Viz.create === "function") {
      try {
        return PJ2.Viz.create({ plateCanvas: plate, marginCanvas: margin, footerCanvas: footer });
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

    for (var i = 0; i < TRACKS.length; i++) {
      var k = TRACKS[i];
      var tab = $("pj2-tab-" + k);
      if (!tab) continue;
      if (k === activeKey) tab.classList.add("is-active"); else tab.classList.remove("is-active");
      tab.setAttribute("aria-selected", k === activeKey ? "true" : "false");
    }

    var title = $("pj2-title");
    if (title) {
      title.textContent = "";
      var pre = document.createElement("span");
      pre.className = "pj2-title-pre";
      pre.textContent = def.title.pre;
      title.appendChild(pre);
      var init = document.createElement("span");
      init.className = "pj2-init";
      init.textContent = def.title.init;
      title.appendChild(init);
      title.appendChild(document.createTextNode(def.title.rest));
    }
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
  }

  function doStop() {
    playIntent = false;
    cancelPending();
    stopEngine(activeKey);
    vizDetach();
    updateTransport();
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
    var eng = engines[activeKey];
    var sounding = !!(eng && eng.isPlaying());
    var playBtn = $("pj2-play"), stopBtn = $("pj2-stop");
    if (playBtn) {
      if (playIntent) playBtn.classList.add("is-lit"); else playBtn.classList.remove("is-lit");
      playBtn.setAttribute("aria-pressed", playIntent ? "true" : "false");
    }
    if (stopBtn) {
      if (!playIntent && !sounding) stopBtn.classList.add("is-lit"); else stopBtn.classList.remove("is-lit");
      stopBtn.setAttribute("aria-pressed", (!playIntent) ? "true" : "false");
    }
  }

  // --------------------------------------------------------------------------
  // THE WAX SEAL — seed display, typed entry, the ≤300 ms re-stamp.
  // --------------------------------------------------------------------------
  function drawSeal() {
    var cv = $("pj2-seal");
    if (!cv) return;
    var def = TRACK[activeKey];
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
  // --------------------------------------------------------------------------
  function applyVolume(v) {
    masterVol = clamp01(v);
    for (var k in engines) {
      try { engines[k].setMasterVolume(masterVol); } catch (e) {}
    }
    updateLamp();
  }

  function updateLamp() {
    var pct = (masterVol * 100).toFixed(1) + "%";
    var fill = $("pj2-lamp-fill"), thumb = $("pj2-lamp-thumb"), input = $("pj2-vol");
    if (fill) fill.style.width = pct;
    if (thumb) thumb.style.left = "calc(" + pct + " - 3px)";
    if (input && document.activeElement !== input) input.value = String(masterVol);
  }

  // --------------------------------------------------------------------------
  // THE LEGEND — per-layer mixer, rebuilt from getLayers() per book.
  // --------------------------------------------------------------------------
  function stampSigil(cv, track, layerKey, label) {
    var def = TRACK[track];
    var name = def.sigils[layerKey] || null;
    try {
      var at = (window.PJ2 && PJ2.Skin) ? PJ2.Skin.atlas(track) : null;
      if (at && name && at.has(name)) {
        var cell = at.cells[name];
        cv.width = cell.w; cv.height = cell.h;
        cv.style.width = (cell.w * 2) + "px";
        cv.style.height = (cell.h * 2) + "px";
        var c = cv.getContext("2d");
        c.imageSmoothingEnabled = false;
        at.stamp(c, name, 0, 0, { u: 1, align: "corner", tint: def.sigilTint, tint2: def.sigilTint2 });
        return;
      }
      // No authored cell for this layer: a scribal initial in the same ink.
      cv.width = 12; cv.height = 12;
      cv.style.width = "24px"; cv.style.height = "24px";
      var c2 = cv.getContext("2d");
      c2.imageSmoothingEnabled = false;
      c2.fillStyle = def.sigilTint;
      c2.font = '12px "VT323", monospace';
      c2.textAlign = "center";
      c2.textBaseline = "middle";
      c2.fillText(String(label || layerKey).charAt(0).toUpperCase(), 6, 7);
    } catch (e) { /* mock canvas */ }
  }

  function buildLegend(key) {
    var box = $("pj2-legend");
    if (!box) return;
    var eng = engineFor(key);
    box.textContent = "";
    if (!eng) return;
    var layers = [], vols = {}, info = null;
    try { layers = eng.getLayers(); } catch (e) { return; }
    try { vols = eng.getLayerVolumes(); } catch (e) {}
    try { info = eng.getInfo(); } catch (e) {}

    for (var i = 0; i < layers.length; i++) {
      (function (ly) {
        var row = document.createElement("div");
        row.className = "pj2-legend-row";

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

        var slider = document.createElement("div");
        slider.className = "pj2-legend-slider";
        var fill = document.createElement("div");
        fill.className = "pj2-legend-fill";
        var thumb = document.createElement("div");
        thumb.className = "pj2-legend-thumb";
        var range = document.createElement("input");
        range.type = "range";
        range.min = "0"; range.max = "1"; range.step = "any"; // unquantized, per §5
        range.setAttribute("aria-label", ly.label + " volume");
        slider.appendChild(fill);
        slider.appendChild(thumb);
        slider.appendChild(range);
        row.appendChild(slider);

        function setSlider(v) {
          v = clamp01(v);
          var pct = (v * 100).toFixed(2) + "%";
          fill.style.width = pct;
          thumb.style.left = "calc(" + pct + " - 2px)";
        }
        var v0 = (vols && vols[ly.key] != null) ? vols[ly.key] : 1;
        range.value = String(v0);
        setSlider(v0);
        range.addEventListener("input", function () {
          var v = clamp01(range.value);
          try { eng.setLayerVolume(ly.key, v); } catch (e) {}
          setSlider(v);
        });

        // v1's pixel mute square, kept verbatim: filled = audible
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
          var muted = false;
          try { muted = eng.toggleLayer(ly.key); } catch (e) {}
          renderMute(muted);
        });
        row.appendChild(mute);

        box.appendChild(row);
      })(layers[i]);
    }
  }

  // --------------------------------------------------------------------------
  // THE SCRIBAL LOG (§4) — engine events → annotation rows. The engines'
  // display labels print VERBATIM (the shared-vocabulary ruling); the skin
  // only decides tag color, capital, and aging.
  // --------------------------------------------------------------------------
  var SKIP_EVENTS = { air: 1, percussion: 1, organum: 1 };
  var RUBRIC_TAGS = {
    scene: 1, cadence: 1, seachange: 1, ghost: 1, coagula: 1,
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
      if (info.harmony) bits.push(String(info.harmony));
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

    // transport
    var playBtn = $("pj2-play"), stopBtn = $("pj2-stop"), resetBtn = $("pj2-reset");
    if (playBtn) playBtn.addEventListener("click", doPlay);
    if (stopBtn) stopBtn.addEventListener("click", doStop);
    if (resetBtn) resetBtn.addEventListener("click", doReset);

    // the binding switch (owner 2026-07-20, undecided between the two
    // dresses): NIGHT = the night folio; PARCH = the windowed codex page.
    // Persisted; the viz swaps palettes/papers/window live.
    var bindingBtn = $("pj2-binding");
    function applyBinding(b, persist) {
      var app = $("pj2-app");
      if (app) app.setAttribute("data-binding", b);
      if (viz && viz.setBinding) { try { viz.setBinding(b); } catch (e) {} }
      if (bindingBtn) {
        bindingBtn.textContent = b === "night" ? "NIGHT ☽︎" : "PARCH ☰︎";
        bindingBtn.setAttribute("aria-label",
          "binding — showing the " + (b === "night" ? "night folio" : "parchment page")
          + "; press to switch");
      }
      if (persist) { try { localStorage.setItem("pj2.binding", b); } catch (e) {} }
    }
    function storedBinding() {
      try {
        var b = localStorage.getItem("pj2.binding");
        return b === "parchment" ? "parchment" : "night";
      } catch (e) { return "night"; }
    }
    if (bindingBtn) {
      bindingBtn.addEventListener("click", function () {
        var cur = (viz && viz.getBinding) ? viz.getBinding()
          : (($("pj2-app") || {}).getAttribute ? $("pj2-app").getAttribute("data-binding") : "night");
        applyBinding(cur === "night" ? "parchment" : "night", true);
      });
    }

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

    // the lamp
    var volInput = $("pj2-vol");
    if (volInput) {
      volInput.addEventListener("input", function () { applyVolume(volInput.value); });
      masterVol = clamp01(volInput.value != null && volInput.value !== "" ? volInput.value : masterVol);
    }
    updateLamp();

    // space = play/stop (when not in an input; buttons keep native space)
    document.addEventListener("keydown", function (e) {
      if (e.code !== "Space" && e.key !== " ") return;
      var t = e.target;
      var tag = (t && t.tagName) ? String(t.tagName).toUpperCase() : "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return;
      if (t && t.isContentEditable) return;
      if (e.preventDefault) e.preventDefault();
      if (playIntent) doStop(); else doPlay();
    });

    // viz lifecycle
    viz = makeViz();
    try { viz.setTrack(activeKey); } catch (e) {}
    applyBinding(storedBinding(), false);
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

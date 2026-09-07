// ZANKYŌ critic's probe (dev-only; the swarm critic's instrument, not shipped).
//
// A symbolic "listen" that goes further than _harness.js: it loads the engine
// exactly as index.php does (every <script> in order, minus the UI/viz/bg-audio
// files, so the PJ2 substrate and any zk-*.js extension load automatically),
// drives a virtual clock that honours BOTH setTimeout (the old timer Set) and
// setInterval (PJ2.Clock's pump), and measures the things the owner's brief
// is about: density, silence, how many voices sound at once, event pacing per
// phase, and the vocabulary the plan adds (cycle kinds, seatings, sea changes,
// visitations, KIRUs). It also instruments the mock graph for the technical
// faults the family keeps re-learning: exponential ramps from/to zero, sources
// started and never stopped, Math.random in musical decisions, events placed
// in the past.
//
// Usage: node _probe.js [seconds] [seed] [--json out.json] [--repro] [--quiet]
//   --repro  runs the whole thing twice in fresh globals and compares the
//            note + event streams bit for bit (the REPRO gate).
"use strict";
var fs = require("fs");
var path = require("path");

var args = process.argv.slice(2);
var RUN = parseFloat(args[0] || "1800"); if (!isFinite(RUN) || RUN <= 0) RUN = 1800;
var SEED = parseInt(args[1] || "3042", 10) || 3042;
// THE FAR TARGET IS PINNED (plan §9, 2026-09-06). It was "3× the base p95",
// re-derived each phase — but the base's own tail compresses as the owner asks
// the receiver for more broadcasts, so a re-derived target got EASIER every
// phase (17.4 → 17.0 → 15.5) exactly as the far tail was being asked to go
// further. These are the original numbers, 3× and 5× the 2.1.0-rc.1 home p95,
// and they do not move again. Identity re-bases and home-only calibration
// continue; only the target is fixed.
var FAR_TARGET = 17.4, FAR_TARGET_5X = 29.0;
var JSON_OUT = null, REPRO = false, QUIET = false, JITTER = 0, FAR = null, DIST_JSON = null, BASE_FILE = path.join(__dirname, "_probe-base.json");
for (var ai = 2; ai < args.length; ai++) {
  if (args[ai] === "--json") JSON_OUT = args[++ai];
  else if (args[ai] === "--far") FAR = args[++ai];              // W0+: force the night's distance (?far=d) — the engine reads location.search, or setFar(d) if it exposes one
  else if (args[ai] === "--dist-json") DIST_JSON = args[++ai];  // write the distance components only (the batch driver's per-seed file)
  else if (args[ai] === "--base") BASE_FILE = args[++ai];       // the base statistics the distance is standardized against
  else if (args[ai] === "--repro") REPRO = true;
  else if (args[ai] === "--quiet") QUIET = true;
  else if (args[ai] === "--jitter") JITTER = parseInt(args[++ai], 10) || 0;   // timer jitter seed (0 = exact)
}

var LOADED_FROM = null;      // which file each script was actually read from (set by runOnce)
var LANDSCAPE = { subDrone: 1, sho: 1, taiko: 1, noise: 1, ambient: 1, pa: 1, weather: 1 };   // never "melodic voices" (new melodic bodies — hichiriki, biwa — count automatically)
function isMelodic(layer) { return !LANDSCAPE[layer]; }

// ============================================================================
// One full run in a fresh global environment. Returns the raw capture.
// ============================================================================
function runOnce(seed, runS, jitterSeed) {
  // ---- virtual clock: setTimeout + setInterval in one queue ----
  // With jitterSeed > 0 every timer fires 0–20 ms LATE by a private LCG (the
  // browser's timer sloppiness, made reproducible): a musical decision that
  // reads ctx.currentTime instead of its scheduled t will change with the
  // jitter seed, and the note stream will not match between two jitter runs.
  var vnow = 0, timers = {}, nextId = 1, jstate = (jitterSeed >>> 0) || 0;
  function jit() { if (!jitterSeed) return 0; jstate = (Math.imul(jstate, 1664525) + 1013904223) >>> 0; return (jstate / 4294967296) * (parseFloat(process.env.JIT_S) || 0.020); }
  function addTimer(fn, ms, repeat) {
    var id = nextId++;
    var period = Math.max((ms || 0) / 1000, repeat ? 0.001 : 0);
    timers[id] = { fn: fn, period: period, next: vnow + period + jit(), repeat: repeat };
    return id;
  }
  global.setTimeout = function (fn, ms) { return addTimer(fn, ms, false); };
  global.setInterval = function (fn, ms) { return addTimer(fn, ms, true); };
  global.clearTimeout = global.clearInterval = function (id) { delete timers[id]; };
  global.performance = { now: function () { return vnow * 1000; } };
  global.requestAnimationFrame = function () { return 0; };

  // ---- graph instrumentation ----
  var faults = { expZero: [], pastSchedule: [], neverStopped: 0, startedTwice: 0 };
  var counts = { nodes: 0, sourcesStarted: 0, byType: {} };
  var liveSources = {};   // id → {type, startedAt, stack}
  var srcId = 1;
  var srcSpans = [];      // [startT, stopT] per source (scheduled times) → peak concurrency
  function callerLine() {
    var st = (new Error().stack || "").split("\n");
    for (var i = 2; i < st.length; i++) {
      var m = /at (\S+) .*?[\/\\]([^\/\\]+\.js):(\d+)/.exec(st[i]);
      if (m && /zankyo|zk-|pj2-/.test(m[2]) && !/_probe/.test(m[2])) return m[1] + " (" + m[2] + ":" + m[3] + ")";
    }
    return "?";
  }
  function param(init) {
    var p = { value: init || 0, _last: init || 0 };
    p.setValueAtTime = function (v, t) { p._last = v; p.value = v; checkPast(t); return p; };
    p.linearRampToValueAtTime = function (v, t) { p._last = v; p.value = v; checkPast(t); return p; };
    p.exponentialRampToValueAtTime = function (v, t) {
      if (!(v > 0) || !(p._last > 0)) {
        if (faults.expZero.length < 40) faults.expZero.push({ t: +vnow.toFixed(2), from: p._last, to: v, where: callerLine() });
      }
      p._last = v; p.value = v; checkPast(t); return p;
    };
    p.setTargetAtTime = function (v, t) { p._last = v; p.value = v; return p; };
    p.cancelScheduledValues = function () { return p; };
    p.cancelAndHoldAtTime = function () { return p; };
    p.setValueCurveAtTime = function (arr, t) { if (arr && arr.length) { p._last = arr[arr.length - 1]; p.value = p._last; } checkPast(t); return p; };
    return p;
  }
  function checkPast(t) {
    if (typeof t === "number" && t < vnow - 0.25 && faults.pastSchedule.length < 20)
      faults.pastSchedule.push({ t: +t.toFixed(2), now: +vnow.toFixed(2), where: callerLine() });
  }
  function node(type, extra) {
    counts.nodes++; counts.byType[type] = (counts.byType[type] || 0) + 1;
    var n = { _type: type, connect: function () { return n; }, disconnect: function () {}, numberOfInputs: 1, numberOfOutputs: 1 };
    return Object.assign(n, extra || {});
  }
  function source(type, extra) {
    var n = node(type, extra), id = srcId++, started = false, stopped = false;
    var startT = null;
    n.start = function (t) {
      if (started) faults.startedTwice++;
      started = true; counts.sourcesStarted++; startT = typeof t === "number" ? t : vnow;
      liveSources[id] = { type: type, at: +vnow.toFixed(2), where: callerLine() };
      checkPast(t);
    };
    n.stop = function (t) { stopped = true; delete liveSources[id]; if (startT != null) srcSpans.push([startT, typeof t === "number" ? t : vnow]); };
    n.addEventListener = function () {};
    return n;
  }
  function MockCtx() {
    var self = this;
    this.sampleRate = 48000; this.state = "running";
    this.destination = node("destination");
    this.listener = {};
    Object.defineProperty(this, "currentTime", { get: function () { return vnow; } });
    this.resume = function () { return { then: function (f) { if (f) f(); return this; }, catch: function () { return this; } }; };
    this.suspend = function () {};
    this.close = function () {};
    this.createGain = function () { return node("gain", { gain: param(1) }); };
    this.createOscillator = function () { return source("osc", { type: "sine", frequency: param(440), detune: param(0), setPeriodicWave: function () {} }); };
    this.createBiquadFilter = function () { return node("biquad", { type: "lowpass", frequency: param(350), Q: param(1), gain: param(0), detune: param(0) }); };
    this.createStereoPanner = function () { return node("panner", { pan: param(0) }); };
    this.createPanner = function () { return node("panner3d", { positionX: param(0), positionY: param(0), positionZ: param(0) }); };
    this.createConvolver = function () { return node("convolver", { buffer: null, normalize: true }); };
    this.createDelay = function () { return node("delay", { delayTime: param(0) }); };
    this.createWaveShaper = function () { return node("shaper", { curve: null, oversample: "none" }); };
    this.createDynamicsCompressor = function () { return node("comp", { threshold: param(-24), knee: param(30), ratio: param(12), attack: param(0.003), release: param(0.25), reduction: 0 }); };
    this.createAnalyser = function () { return node("analyser", { fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0.8, getByteFrequencyData: function () {}, getFloatTimeDomainData: function () {}, getByteTimeDomainData: function () {} }); };
    this.createChannelMerger = function () { return node("merger"); };
    this.createChannelSplitter = function () { return node("splitter"); };
    this.createConstantSource = function () { return source("const", { offset: param(1) }); };
    this.createMediaStreamDestination = function () { return node("msd", { stream: {} }); };
    this.createBuffer = function (ch, len, sr) {
      var chans = [];
      for (var c = 0; c < (ch || 1); c++) chans.push(new Float32Array(len || 1));
      return { numberOfChannels: ch || 1, length: len || 1, sampleRate: sr || self.sampleRate, duration: (len || 1) / (sr || self.sampleRate), getChannelData: function (i) { return chans[i] || chans[0]; } };
    };
    this.createBufferSource = function () { return source("bufsrc", { buffer: null, loop: false, loopStart: 0, loopEnd: 0, playbackRate: param(1), detune: param(0) }); };
    this.createPeriodicWave = function () { return {}; };
    this.decodeAudioData = function (buf, ok, err) { var p = { then: function (f) { return p; }, catch: function (f) { return p; } }; return p; };
  }
  var doc = {
    visibilityState: "visible", hidden: false, _ls: {},
    addEventListener: function (type, fn) { (doc._ls[type] = doc._ls[type] || []).push(fn); },
    removeEventListener: function () {},
    getElementById: function () { return null; }, querySelector: function () { return null; }, querySelectorAll: function () { return []; },
    createElement: function () { return { style: {}, setAttribute: function () {}, appendChild: function () {}, addEventListener: function () {}, play: function () { return { catch: function () {} }; }, pause: function () {} }; },
    body: { appendChild: function () {} },
  };
  var W = {};
  W.AudioContext = MockCtx;
  W.window = W; W.document = doc;
  W.addEventListener = function () {}; W.removeEventListener = function () {};
  W.location = { search: FAR != null ? "?far=" + FAR : "", href: "http://127.0.0.1/art/zankyo/", pathname: "/art/zankyo/" };
  W.navigator = { userAgent: "probe", mediaSession: null };
  W.fetch = function () { return { then: function () { return this; }, catch: function () { return this; } }; };
  W.console = console;
  global.window = W; global.document = doc; global.PJ2 = W.PJ2 = {};
  global.location = W.location; try { Object.defineProperty(global, "navigator", { value: W.navigator, configurable: true, writable: true }); } catch (e) {}
  global.fetch = W.fetch;

  // ---- Math.random watch: allowed at init (texture), suspect while playing ----
  var realRandom = Math.random, randomDuringPlay = {}, randomPlayCount = 0, playingFlag = false;
  Math.random = function () {
    if (playingFlag) { randomPlayCount++; var w = callerLine(); randomDuringPlay[w] = (randomDuringPlay[w] || 0) + 1; }
    return realRandom();
  };

  // ---- load the engine the way index.php does ----
  var dir = __dirname;
  var scripts = [];
  try {
    var html = fs.readFileSync(path.join(dir, "index.php"), "utf8");
    var re = /<script[^>]+src="([^"?]+)(?:\?[^"]*)?"/g, m;
    while ((m = re.exec(html))) scripts.push(m[1]);
  } catch (e) {}
  scripts = scripts.filter(function (s) { return !/background-audio|zankyo-ui|zankyo-viz|page-event/.test(s); });
  if (!scripts.length) scripts = ["zankyo-audio.js"];
  var loadErrors = [];
  // ZK_SRCDIR — swap the WHOLE ZANKYŌ script set, not just the engine.
  //
  // ZK_ENGINE below replaces zankyo-audio.js alone, which is what
  // _far-identity.js used, and it meant the home-identity gate compared two
  // engines across ONE shared receiver: zk-broadcast.js was the working tree's
  // in both runs. Every receiver change in §11, the planned hold, degreeHz and
  // the tone tables therefore went through a gate that could not see them.
  // With ZK_SRCDIR set, any script the page loads is taken from that directory
  // when a file of the same name is there, so the comparison is between two
  // BUILDS. The PJ2 substrate is deliberately not swapped: it is frozen by
  // policy and never modified from ZANKYŌ, so both sides should share it.
  var srcDir = process.env.ZK_SRCDIR ? path.resolve(process.env.ZK_SRCDIR) : null;
  var loadedFrom = {};
  scripts.forEach(function (s) {
    var full = path.resolve(dir, s), base = path.basename(s);
    if (srcDir && /^(zankyo-audio|zk-[a-z0-9-]+)\.js$/.test(base)) {
      var alt = path.join(srcDir, base);
      if (fs.existsSync(alt)) full = alt;
    }
    if (/zankyo-audio\.js$/.test(s) && process.env.ZK_ENGINE) full = path.resolve(process.env.ZK_ENGINE);   // A/B an alternate engine build
    loadedFrom[base] = full;
    try { (0, eval)(fs.readFileSync(full, "utf8")); } catch (e) { loadErrors.push(s + ": " + (e && e.message)); }
  });
  LOADED_FROM = loadedFrom;
  var Z = W.ZankyoAudio;
  if (!Z) return { fatal: "ZankyoAudio not defined; loaded " + JSON.stringify(scripts) + " errors " + JSON.stringify(loadErrors) };

  if (Z.reseed) Z.reseed(seed);
  if (FAR != null && typeof Z.setFar === "function") { try { Z.setFar(parseFloat(FAR)); } catch (e) {} }

  // ---- capture ----
  var notes = [], events = [], phaseTimeline = [], arcSamples = [], planInfo = [];
  Z.setNoteListener(function (n) {
    var fld = null; try { fld = Z.getField ? Z.getField() : null; } catch (e) {}
    notes.push({ layer: n.layer, freq: n.freq, t: typeof n.startTime === "number" ? n.startTime : vnow, dur: n.duration || 0, at: vnow, tonic: fld ? fld.tonicHz : 146.83 });
  });
  Z.setEventListener(function (e) {
    events.push({ t: typeof e.t === "number" ? e.t : vnow, cat: e.cat, label: String(e.label || ""), detail: String(e.detail || "") });
  });

  var errors = [];
  var lastPhase = null, nextSample = 0, nextInfo = 0;
  function pump() {
    var ai = Z.getArcInfo ? Z.getArcInfo() : { level: 0, phase: "?" };
    if (ai.phase !== lastPhase) { phaseTimeline.push({ t: vnow, phase: ai.phase }); lastPhase = ai.phase; }
    if (vnow >= nextSample) { arcSamples.push({ t: vnow, level: ai.level, phase: ai.phase }); nextSample += 5; }
    if (vnow >= nextInfo) {
      var mi = Z.getMetaInfo ? Z.getMetaInfo() : null;
      var pi = Z.getPlanInfo ? Z.getPlanInfo() : (Z.getSceneInfo ? Z.getSceneInfo() : null);
      var fi = Z.getMode ? Z.getMode() : null;
      var fld = null; try { fld = Z.getField ? Z.getField() : null; } catch (e) {}
      planInfo.push({ t: vnow, meta: mi, plan: pi, mode: fi && (fi.key || fi.name), tonic: fld ? +(+fld.tonicHz).toFixed(3) : (fi && (fi.tonic || fi.tonicHz)) });
      nextInfo += 15;
    }
  }
  try {
    Z.play(); playingFlag = true;
    var guard = 0;
    for (;;) {
      if (++guard > 20000000) { errors.push("guard tripped at " + vnow.toFixed(1)); break; }
      var bestId = null, bestT = Infinity;
      for (var id in timers) if (timers[id].next < bestT) { bestT = timers[id].next; bestId = id; }
      if (bestId === null || bestT > runS) { vnow = runS; break; }
      vnow = bestT;
      var tm = timers[bestId];
      if (tm.repeat) tm.next = vnow + tm.period + jit(); else delete timers[bestId];
      pump();
      try { tm.fn(); } catch (e) { errors.push("RUN@" + vnow.toFixed(1) + "s: " + (e && e.message) + " @ " + ((e && e.stack || "").split("\n")[1] || "").trim()); if (errors.length > 30) break; }
    }
  } catch (e) { errors.push("PLAY: " + (e && e.message)); }
  playingFlag = false;
  Math.random = realRandom;

  // sources still live at the end that started more than 60 s ago = leaks
  var leaked = [];
  var infra = 0;
  for (var lid in liveSources) { if (liveSources[lid].at < 0.05) { infra++; continue; } if (vnow - liveSources[lid].at > 60) leaked.push(liveSources[lid]); }
  faults.infraSources = infra;   // persistent modulators built with the graph (e.g. Fx.delay's drift LFO) — not leaks
  faults.neverStopped = leaked.length;
  var leakWhere = {};
  leaked.forEach(function (l) { leakWhere[l.type + " " + l.where] = (leakWhere[l.type + " " + l.where] || 0) + 1; });

  var evs = [];
  srcSpans.forEach(function (sp) { evs.push([sp[0], 1]); evs.push([sp[1], -1]); });
  evs.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
  var live = 0, peakSources = 0, peakAt = 0;
  evs.forEach(function (e) { live += e[1]; if (live > peakSources) { peakSources = live; peakAt = e[0]; } });
  counts.peakSources = peakSources; counts.peakAt = +peakAt.toFixed(1);
  return {
    scripts: scripts, loadErrors: loadErrors, errors: errors, seed: seed, runS: runS,
    notes: notes, events: events, phaseTimeline: phaseTimeline, arcSamples: arcSamples, planInfo: planInfo,
    faults: faults, leakWhere: leakWhere, counts: counts,
    randomPlayCount: randomPlayCount, randomDuringPlay: randomDuringPlay,
    motifStats: Z.getMotifStats ? Z.getMotifStats() : null,
    airInfo: (function () { try { var a = Z.getAir ? Z.getAir() : null; return a && a.info ? a.info() : (Z.getAirInfo ? Z.getAirInfo() : null); } catch (e) { return null; } })(),
    layers: Z.LAYERS ? Z.LAYERS.slice() : [],
    far: (function () { try { return Z.getFar ? Z.getFar() : null; } catch (e) { return null; } })(),   // W0+: {d, name, departures…} when the engine exposes it
    api: Object.keys(Z).sort(),
  };
}

// ============================================================================
// Analysis
// ============================================================================
function phaseAt(tl, t) {
  var ph = tl.length ? tl[0].phase : "?";
  for (var i = 0; i < tl.length; i++) { if (tl[i].t <= t) ph = tl[i].phase; else break; }
  return ph;
}
function pct(x) { return (100 * x).toFixed(1) + "%"; }
function fmt(x, d) { return (+x).toFixed(d == null ? 2 : d); }
function pad(s, n) { s = String(s); while (s.length < n) s += " "; return s; }
function lpad(s, n) { s = String(s); while (s.length < n) s = " " + s; return s; }

function analyze(R) {
  var runS = R.runS, per30 = 1800 / runS;
  var A = { seed: R.seed, runS: runS, scripts: R.scripts, layers: R.layers };

  // ---- notes per layer (raw + per 30 min) ----
  var byLayer = {};
  R.notes.forEach(function (n) { byLayer[n.layer] = (byLayer[n.layer] || 0) + 1; });
  A.notesByLayer = byLayer;
  A.notesPer30 = {}; for (var k in byLayer) A.notesPer30[k] = Math.round(byLayer[k] * per30);
  var mel = R.notes.filter(function (n) { return isMelodic(n.layer); }).sort(function (a, b) { return a.t - b.t; });
  A.melodicNotes = mel.length; A.melodicPer30 = Math.round(mel.length * per30); A.melodicPerSec = mel.length / runS;
  A.totalNotes = R.notes.length; A.totalPer30 = Math.round(R.notes.length * per30);

  // ---- phase durations ----
  var tl = R.phaseTimeline, phaseDur = {};
  for (var i = 0; i < tl.length; i++) {
    var end = i + 1 < tl.length ? tl[i + 1].t : runS;
    phaseDur[tl[i].phase] = (phaseDur[tl[i].phase] || 0) + (end - tl[i].t);
  }
  A.phaseDur = phaseDur;

  // ---- per-second occupancy: distinct melodic layers sounding ----
  var S = Math.ceil(runS), occ = new Array(S);
  for (var s = 0; s < S; s++) occ[s] = {};
  var perLayerSec = {};
  mel.forEach(function (n) {
    var d = n.dur > 0 ? n.dur : 0.5;
    var a = Math.max(0, Math.floor(n.t)), b = Math.min(S - 1, Math.floor(n.t + d));
    for (var x = a; x <= b; x++) occ[x][n.layer] = 1;
  });
  var hist = { 0: 0, 1: 0, 2: 0, 3: 0 }, histByPhase = {};
  var layerSoundingSec = {};
  for (var s2 = 0; s2 < S; s2++) {
    var c = Object.keys(occ[s2]).length, key = c >= 3 ? 3 : c;
    hist[key]++;
    var ph = phaseAt(tl, s2);
    histByPhase[ph] = histByPhase[ph] || { 0: 0, 1: 0, 2: 0, 3: 0, n: 0 };
    histByPhase[ph][key]++; histByPhase[ph].n++;
    for (var L in occ[s2]) layerSoundingSec[L] = (layerSoundingSec[L] || 0) + 1;
  }
  A.voices = { 0: hist[0] / S, 1: hist[1] / S, 2: hist[2] / S, "3+": hist[3] / S };
  A.voicesByPhase = {};
  for (var p in histByPhase) { var h = histByPhase[p]; A.voicesByPhase[p] = { 0: h[0] / h.n, 1: h[1] / h.n, 2: h[2] / h.n, "3+": h[3] / h.n, secs: h.n }; }
  A.layerSoundingFrac = {}; for (var L2 in layerSoundingSec) A.layerSoundingFrac[L2] = layerSoundingSec[L2] / S;

  // ---- melodic silences (gap from the end of the last sounding melodic note to the next onset) ----
  var gaps = [], gapsByPhase = {}, curEnd = -1, longest = { gap: 0, at: 0 };
  mel.forEach(function (n) {
    var d = n.dur > 0 ? n.dur : 0.5;
    if (curEnd >= 0 && n.t > curEnd) {
      var g = n.t - curEnd; gaps.push(g);
      var ph = phaseAt(tl, curEnd); (gapsByPhase[ph] = gapsByPhase[ph] || []).push(g);
      if (g > longest.gap) longest = { gap: g, at: curEnd, phase: ph };
    }
    if (n.t + d > curEnd) curEnd = n.t + d;
  });
  gaps.sort(function (a, b) { return a - b; });
  function q(arr, f) { if (!arr.length) return 0; return arr[Math.min(arr.length - 1, Math.floor(arr.length * f))]; }
  A.silence = { longest: longest, count: gaps.length, median: q(gaps, 0.5), p90: q(gaps, 0.9), over5s: gaps.filter(function (g) { return g >= 5; }).length, over10s: gaps.filter(function (g) { return g >= 10; }).length, over20s: gaps.filter(function (g) { return g >= 20; }).length };
  A.silenceByPhase = {};
  for (var gp in gapsByPhase) { var ga = gapsByPhase[gp].slice().sort(function (a, b) { return a - b; }); A.silenceByPhase[gp] = { n: ga.length, median: q(ga, 0.5), p90: q(ga, 0.9), max: ga[ga.length - 1] }; }

  // ---- liveness: longest stretch with no melodic note AND no ambient/noise/taiko/joint/KIRU event ----
  var marks = mel.map(function (n) { return n.t; }).concat(R.events.filter(function (e) { return /ambient|noise|taiko/.test(e.cat) || /joint/.test(e.label); }).map(function (e) { return e.t; })).sort(function (a, b) { return a - b; });
  var dead = { longest: 0, at: 0, over20: 0, over30: 0 };
  for (var di = 1; di < marks.length; di++) { var dg = marks[di] - marks[di - 1]; if (dg > dead.longest) { dead.longest = dg; dead.at = marks[di - 1]; } if (dg >= 20) dead.over20++; if (dg >= 30) dead.over30++; }
  A.dead = dead;
  // ---- events per minute per category, and by phase ----
  var evByCat = {}, evByCatPhase = {};
  R.events.forEach(function (e) {
    evByCat[e.cat] = (evByCat[e.cat] || 0) + 1;
    var ph = phaseAt(tl, e.t);
    evByCatPhase[e.cat] = evByCatPhase[e.cat] || {};
    evByCatPhase[e.cat][ph] = (evByCatPhase[e.cat][ph] || 0) + 1;
  });
  A.eventsPerMin = {}; for (var ec in evByCat) A.eventsPerMin[ec] = evByCat[ec] / (runS / 60);
  A.eventsPerMinByPhase = {};
  for (var ec2 in evByCatPhase) { A.eventsPerMinByPhase[ec2] = {}; for (var ph2 in evByCatPhase[ec2]) A.eventsPerMinByPhase[ec2][ph2] = phaseDur[ph2] ? evByCatPhase[ec2][ph2] / (phaseDur[ph2] / 60) : 0; }
  // ambient by name
  var ambNames = {};
  R.events.filter(function (e) { return e.cat === "ambient"; }).forEach(function (e) { ambNames[e.label] = (ambNames[e.label] || 0) + 1; });
  A.ambientByName = ambNames;
  var nb = {}; R.events.filter(function (e) { return e.cat === "noise" && /^(wall|screech|static|rumble)/.test(e.label); }).forEach(function (e) { var k = e.label.split(" ")[0]; nb[k] = (nb[k] || 0) + 1; });
  A.noiseBodies = nb;

  // ---- notes per layer per phase (per minute of that phase) ----
  A.notesPerMinByLayerPhase = {};
  R.notes.forEach(function (n) {
    var ph = phaseAt(tl, n.t);
    A.notesPerMinByLayerPhase[n.layer] = A.notesPerMinByLayerPhase[n.layer] || {};
    A.notesPerMinByLayerPhase[n.layer][ph] = (A.notesPerMinByLayerPhase[n.layer][ph] || 0) + 1;
  });
  for (var nl in A.notesPerMinByLayerPhase) for (var np in A.notesPerMinByLayerPhase[nl]) A.notesPerMinByLayerPhase[nl][np] = phaseDur[np] ? +(A.notesPerMinByLayerPhase[nl][np] / (phaseDur[np] / 60)).toFixed(1) : 0;

  // ---- form vocabulary from the event stream ----
  function has(e, re) { return re.test(e.label) || re.test(e.detail); }
  var modeEvents = R.events.filter(function (e) { return e.cat === "mode" || e.cat === "form" || e.cat === "plan" || e.cat === "scene" || e.cat === "visit" || e.cat === "visitation" || e.cat === "pitch" || e.cat === "far"; });   // "far" (W1): the 逸脱 lines were in the stream but invisible in a printout — the critic's free note, r2
  A.kirus = R.events.filter(function (e) { return /KIRU/.test(e.label); }).map(function (e) { return { t: Math.round(e.t), detail: e.detail }; });
  A.cycles = R.events.filter(function (e) { return /cycle \d+/.test(e.detail) && /mode/.test(e.label); }).map(function (e) { return { t: Math.round(e.t), detail: e.detail }; });
  A.kinds = {}; A.seatings = {}; A.seaChanges = []; A.visitations = []; A.scenes = {}; A.joints = 0; A.airInfo = null; A.signals = []; A.signalFallbacks = 0; A.sceneSpans = []; A.signalTimes = [];
  R.events.forEach(function (e) {
    var txt = e.label + " · " + e.detail;
    var km = /(?:kind|活動|cycle kind)[:\s]+([^\s·,]+)/i.exec(txt); if (km) A.kinds[km[1]] = (A.kinds[km[1]] || 0) + 1;
    var sm = /seat(?:ing|ed)[:\s]+([^·]+)/i.exec(txt); if (sm) A.seatings[sm[1].trim()] = (A.seatings[sm[1].trim()] || 0) + 1;
    if (/sea change|modulat|海|retun/i.test(txt) && !/mode lottery/.test(txt)) A.seaChanges.push({ t: Math.round(e.t), txt: txt.slice(0, 120) });
    if (/visit(ation)?:/i.test(txt) && e.cat !== "ambient") A.visitations.push({ t: Math.round(e.t), txt: txt.slice(0, 120) });   // the plan-time token only (one per hosting cycle); "begins"/"goes dead" are not counted
    if (e.cat === "rx" && e.label === "受信") A.signals.push({ t: Math.round(e.t), txt: e.detail });          // S3: the receiver's signals (受信 = a reel played; the fallback and the scan are not counted)
    if (e.cat === "rx" && e.label === "受信 fallback") A.signalFallbacks++;
    var scm = /scene[:\s]+([^\s·,]+)/i.exec(txt); if (scm) { A.scenes[scm[1]] = (A.scenes[scm[1]] || 0) + 1; A.sceneSpans.push({ t: +e.t.toFixed(2), type: scm[1] }); }
    // CRITIC: the orchestrator wants the JO SHARE of broadcasts. signalFallbacks
    // was a bare counter, so a seating could not be located in the cycle at all.
    // Record every seating's TIME — real or fallback — and bucket it against
    // sceneSpans in analysis. (Dev-only, my file, no VERSION bump.)
    if (e.cat === "rx" && (e.label === "受信" || e.label === "受信 fallback")) A.signalTimes.push({ t: +e.t.toFixed(2), real: e.label === "受信" });
    if (/joint/i.test(txt)) A.joints++;
  });
  // ---- Phase 2: tonic trace (sea changes) and shō voicings (aitake) ----
  var tonics = [], lastTon = null;
  R.planInfo.forEach(function (pi) { if (pi.tonic != null && pi.tonic !== lastTon) { tonics.push({ t: Math.round(pi.t), hz: pi.tonic }); lastTon = pi.tonic; } });
  A.tonicTrace = tonics;
  var byStart = {};
  R.notes.filter(function (n) { return n.layer === "sho"; }).forEach(function (n) { var k = n.t.toFixed(3); (byStart[k] = byStart[k] || []).push(n.freq); });
  var voicings = {}, clusters = 0;
  for (var bk in byStart) { var fs = byStart[bk].slice().sort(function (a, b) { return a - b; }); if (fs.length < 2) continue; clusters++; var sig = fs.map(function (f) { return Math.round(12 * Math.log2(f / fs[0])); }).join(","); voicings[sig] = (voicings[sig] || 0) + 1; }
  A.shoVoicings = { clusters: clusters, distinct: Object.keys(voicings).length, top: Object.keys(voicings).sort(function (a, b) { return voicings[b] - voicings[a]; }).slice(0, 12).map(function (k) { return k + "×" + voicings[k]; }) };
  A.seedPool = {};
  A.seedPoolAuthentic = {}; A.seedPoolBorn = {}; A.seedPoolInherited = 0;
  R.events.forEach(function (e) { if (/working set/.test(e.label)) e.detail.split(" · ").forEach(function (part) {
    var nm = part.replace(/^\s*[イロハ]\s*/, "").trim(); if (!nm) return;
    A.seedPool[nm] = (A.seedPool[nm] || 0) + 1;
    if (/^inherited:/.test(nm)) A.seedPoolInherited++;
    else if (/^born:/.test(nm)) A.seedPoolBorn[nm] = 1;
    else A.seedPoolAuthentic[nm] = (A.seedPoolAuthentic[nm] || 0) + 1;
  }); });
  A.modeEventLog = modeEvents.map(function (e) { return Math.round(e.t) + "s " + e.cat + " " + e.label + " · " + e.detail; });
  A.motif = R.motifStats;

  // ---- per-cycle table ----
  var bounds = A.cycles.map(function (c) { return c.t; }); bounds.push(runS);
  A.perCycle = [];
  for (var ci = 0; ci + 1 < bounds.length; ci++) {
    var a = bounds[ci], b = bounds[ci + 1], row = { cycle: ci, start: a, len: Math.round(b - a), notes: {}, maxVoices: 0, voices3: 0, secs: 0 };
    R.notes.forEach(function (n) { if (n.t >= a && n.t < b) row.notes[n.layer] = (row.notes[n.layer] || 0) + 1; });
    for (var s3 = Math.floor(a); s3 < Math.min(S, Math.floor(b)); s3++) { var cc = Object.keys(occ[s3]).length; row.secs++; if (cc > row.maxVoices) row.maxVoices = cc; if (cc >= 3) row.voices3++; }
    row.voices3 = row.secs ? row.voices3 / row.secs : 0;
    var info = A.cycles[ci] ? A.cycles[ci].detail : "";
    row.info = info.slice(0, 90);
    A.perCycle.push(row);
  }

  // ---- technical ----
  A.airInfo = R.airInfo;
  // ---- Phase 1 gate summary (plan §7): half the baseline density, ≥3 kinds, ≥2 seatings in 1 h ----
  var BASE_MELODIC_30 = 5075;   // baseline seed 3042 (see baseline-critic.md)
  // ---- Phase 4: visitations per cycle (≥ 1 per 3 cycles over a long run; never two in one cycle) ----
  var vpc = {}; A.visitations.forEach(function (v) { var ci = 0; for (var q = 0; q < A.cycles.length; q++) if (A.cycles[q].t <= v.t) ci = q; vpc[ci] = (vpc[ci] || 0) + 1; });
  A.visitPerCycle = vpc; A.visitMaxPerCycle = Object.keys(vpc).length ? Math.max.apply(null, Object.keys(vpc).map(function (k) { return vpc[k]; })) : 0;
  A.visitRatePer3 = A.cycles.length ? +(3 * A.visitations.length / A.cycles.length).toFixed(2) : 0;
  // ---- S3: the signal per cycle and per cycle kind ----
  var spc = {}, spk = {};
  A.signals.forEach(function (s) { var ci = 0; for (var q = 0; q < A.cycles.length; q++) if (A.cycles[q].t <= s.t) ci = q; spc[ci] = (spc[ci] || 0) + 1; var kd = A.cycles[ci] ? /kind: ([a-z]+)/.exec(A.cycles[ci].detail) : null; var kk = kd ? kd[1] : "?"; spk[kk] = (spk[kk] || 0) + 1; });
  A.signalPerCycle = spc; A.signalPerKind = spk; A.signalMaxPerCycle = Object.keys(spc).length ? Math.max.apply(null, Object.keys(spc).map(function (k) { return spc[k]; })) : 0;
  A.signalRatePer3 = A.cycles.length ? +(3 * A.signals.length / A.cycles.length).toFixed(2) : 0;
  A.gates = {
    melodicPer30: A.melodicPer30, melodicRatioToBaseline: +(A.melodicPer30 / BASE_MELODIC_30).toFixed(2),
    zeroVoiceFrac: +A.voices[0].toFixed(3), joThreePlus: A.voicesByPhase.jo ? +A.voicesByPhase.jo["3+"].toFixed(3) : null,
    gapsOver10s: A.silence.over10s, kinds: Object.keys(A.kinds).length, seatings: Object.keys(A.seatings).length,
    seaChanges: A.seaChanges.length, visitations: A.visitations.length, cycles: A.cycles.length, kirus: A.kirus.length,
    nodesPerMin: Math.round(R.counts.nodes / (runS / 60)), peakSources: R.counts.peakSources,
    visitPer3Cycles: A.visitRatePer3, visitMaxPerCycle: A.visitMaxPerCycle,
    signals: A.signals.length, signalFallbacks: A.signalFallbacks, signalPer3Cycles: A.signalRatePer3, signalMaxPerCycle: A.signalMaxPerCycle, signalPerKind: A.signalPerKind,
    tonicsSeen: A.tonicTrace.length, seedPoolAuthentic: Object.keys(A.seedPoolAuthentic).length, seedPoolBorn: Object.keys(A.seedPoolBorn).length, shoVoicings: A.shoVoicings.distinct,
  };
  A.far = R.far;
  A.distance = distanceComponents(R, A);
  A.distanceScalar = distanceScalar(A.distance, loadBase());
  A.tech = {
    loadErrors: R.loadErrors, errors: R.errors, expZero: R.faults.expZero, pastSchedule: R.faults.pastSchedule,
    neverStopped: R.faults.neverStopped, leakWhere: R.leakWhere, startedTwice: R.faults.startedTwice, infraSources: R.faults.infraSources,
    nodesCreated: R.counts.nodes, nodesPerMin: R.counts.nodes / (runS / 60), sourcesStarted: R.counts.sourcesStarted, byType: R.counts.byType, peakSources: R.counts.peakSources, peakAt: R.counts.peakAt,
    randomDuringPlay: R.randomPlayCount, randomWhere: R.randomDuringPlay,
    api: R.api,
  };
  return A;
}

function signature(R) {
  var crypto = require("crypto");
  var h = crypto.createHash("sha1");
  R.notes.forEach(function (n) { h.update(n.layer + "|" + n.freq.toFixed(4) + "|" + n.t.toFixed(4) + "|" + (+n.dur).toFixed(4) + "\n"); });
  var hn = h.digest("hex");
  var h2 = crypto.createHash("sha1");
  R.events.forEach(function (e) { h2.update(e.t.toFixed(3) + "|" + e.cat + "|" + e.label + "|" + e.detail + "\n"); });
  return { notes: hn, events: h2.digest("hex"), noteCount: R.notes.length, eventCount: R.events.length };
}


// ============================================================================
// THE DISTANCE METRIC (far tail, PLAN-ZANKYO-FAR §1) — one scalar per night.
// ============================================================================
// Nine symbolic components from the note + event streams and the arc samples,
// each standardized against the BASE distribution over 40 seeds (median, MAD)
// with a musical floor on the scale so a base of zero spread (12-TET: every
// note exactly on the grid) cannot make a 1-cent wobble "far". The scalar is
// the Euclidean norm of the standardized deviations, either direction (Ma
// inverted is as far from home as clouds are). Units: "how many base spreads
// / floors away". The real-audio components (master centroid, roughness) are
// measured by the critic's recorder (handoff/W0/farrec.js) and reported on
// their own base (3 seeds); they are not folded into this scalar.
var DIST_FLOORS = {   // one unit = a just-noticeable departure (the critic's floors; see phase-W0-critic-baseline.md §1)
  pcEntropy: 0.20,    // bits — pitch-class entropy of the melodic notes (rel. the emit-time tonic, 12 bins)
  tetDev: 5,          // cents RMS — melodic pitch vs the nearest 12-TET step of the emit-time tonic (a stretched octave, JI, quarter-tones)
  offMode: 0.05,      // fraction of melodic notes > 15 cents from every degree of the four modes on the emit-time tonic (bitonality, the spiral)
  ioiVar: 0.10,       // octaves — std of log2 of the within-phrase inter-onset intervals (tempo variance: dilation, canons, varispeed)
  rateExc: 0.20,      // octaves — max |2-min window median log2 IOI − run median| (rate excursion: a glacial or frantic cycle)
  densVar: 0.08,      // coefficient of variation of log2(1 + melodic notes per 60 s window) (density variance: ma inverted, clouds)
  formDev: 0.06,      // per cycle: (1 − Spearman ρ of arc level vs time)/2 + out-of-order phase steps + a missing KIRU, averaged (form-shape deviation)
  coinc: 0.03,        // fraction of melodic notes with another voice's onset within 40 ms (synchrony: gagaku heterophony, swarm)
  polyMean: 0.12      // mean melodic voices sounding over the seconds where any sounds (polyphony: swarm, hocket, clouds)
};
var DIST_KEYS = Object.keys(DIST_FLOORS);
function q(arr, f) { if (!arr.length) return 0; var a = arr.slice().sort(function (x, y) { return x - y; }); return a[Math.min(a.length - 1, Math.floor(a.length * f))]; }
function mean(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return a.length ? s / a.length : 0; }
function sd(a) { var m = mean(a), s = 0; for (var i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m); return a.length > 1 ? Math.sqrt(s / (a.length - 1)) : 0; }
function spearman(xs, ys) {
  function ranks(a) { var idx = a.map(function (v, i) { return [v, i]; }).sort(function (p, q2) { return p[0] - q2[0]; }); var r = new Array(a.length); for (var i = 0; i < idx.length;) { var j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; var rk = (i + j) / 2 + 1; for (var k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; } return r; }
  if (xs.length < 3) return 1;
  var rx = ranks(xs), ry = ranks(ys), mx = mean(rx), my = mean(ry), num = 0, dx = 0, dy = 0;
  for (var i = 0; i < xs.length; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) * (rx[i] - mx); dy += (ry[i] - my) * (ry[i] - my); }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
}
var ALL_MODES = [[0, 2, 3, 7, 8], [0, 1, 5, 7, 8], [0, 2, 3, 7, 9], [0, 1, 5, 6, 10]];   // hirajoshi / in-sen / kumoi / iwato (the harness's model)
function distanceComponents(R, A) {
  var runS = R.runS, tl = R.phaseTimeline;
  var mel = R.notes.filter(function (n) { return isMelodic(n.layer) && n.freq > 0; }).sort(function (a, b) { return a.t - b.t || (a.layer < b.layer ? -1 : 1); });
  var C = { n: mel.length };
  // --- pitch: entropy, 12-TET deviation, off-mode fraction (all relative to the tonic in force when the note was emitted) ---
  var pcHist = new Array(12).fill(0), devs = [], off = 0;
  mel.forEach(function (n) {
    var cents = 1200 * Math.log2(n.freq / (n.tonic || 146.83));
    var pc = ((Math.round(cents / 100) % 12) + 12) % 12; pcHist[pc]++;
    var dev = cents - 100 * Math.round(cents / 100); devs.push(dev * dev);
    var best = 1e9;
    for (var mi = 0; mi < ALL_MODES.length; mi++) for (var d = 0; d < 5; d++) { var semi = ALL_MODES[mi][d]; var x = ((cents - 100 * semi) % 1200 + 1200) % 1200; if (x > 600) x = 1200 - x; if (x < best) best = x; }
    if (best > 15) off++;
  });
  var H = 0; pcHist.forEach(function (c) { if (c > 0) { var p = c / mel.length; H -= p * Math.log2(p); } });
  C.pcEntropy = +H.toFixed(4); C.tetDev = +Math.sqrt(mean(devs)).toFixed(3); C.offMode = mel.length ? +(off / mel.length).toFixed(4) : 0;
  // --- time: within-phrase IOIs per voice → tempo variance, rate excursion ---
  var byLayer = {}; mel.forEach(function (n) { (byLayer[n.layer] = byLayer[n.layer] || []).push(n); });
  var ioi = [];   // [t, log2 ioi]
  for (var L in byLayer) { var arr = byLayer[L]; for (var i = 1; i < arr.length; i++) { var g = arr[i].t - arr[i - 1].t; if (g > 0.02 && g <= 2.0) ioi.push([arr[i].t, Math.log2(g)]); } }
  var lg = ioi.map(function (x) { return x[1]; });
  C.ioiVar = +sd(lg).toFixed(4);
  var runMed = q(lg, 0.5), exc = 0, W2 = 120;
  for (var w0 = 0; w0 + W2 <= runS + 1; w0 += W2 / 2) { var win = ioi.filter(function (x) { return x[0] >= w0 && x[0] < w0 + W2; }).map(function (x) { return x[1]; }); if (win.length >= 12) { var e = Math.abs(q(win, 0.5) - runMed); if (e > exc) exc = e; } }
  C.rateExc = +exc.toFixed(4); C.ioiN = ioi.length;
  // --- density variance over 60 s windows ---
  var nW = Math.max(1, Math.floor(runS / 60)), cnt = new Array(nW).fill(0);
  mel.forEach(function (n) { var w = Math.floor(n.t / 60); if (w >= 0 && w < nW) cnt[w]++; });
  var lc = cnt.map(function (c) { return Math.log2(1 + c); }), lm = mean(lc);
  C.densVar = lm > 0 ? +(sd(lc) / lm).toFixed(4) : 0; C.densPerMin = +mean(cnt).toFixed(1);
  // --- form: per completed cycle — arc level vs time (Spearman), phase steps out of jo→ha→kyū→release order, a missing KIRU ---
  var cyc = R.events.filter(function (e) { return e.cat === "mode" && /cycle \d+/.test(e.detail) && /mode/.test(e.label); }).map(function (e) { return e.t; });
  cyc.push(runS);
  var ORDER = { "jo": 0, "ha": 1, "kyū": 2, "release": 3 };
  var formPer = [], kiruT = R.events.filter(function (e) { return /KIRU/.test(e.label); }).map(function (e) { return e.t; });
  for (var ci = 0; ci + 1 < cyc.length; ci++) {
    var a = cyc[ci], b = cyc[ci + 1];
    if (b - a < 60 || b > runS - 1 && ci + 2 === cyc.length && (b - a) < 240) continue;   // incomplete tail cycle (< 4 min seen) is not judged
    var smp = R.arcSamples.filter(function (s) { return s.t >= a && s.t < b && s.phase !== "release"; });
    var rho = spearman(smp.map(function (s) { return s.t; }), smp.map(function (s) { return s.level; }));
    var steps = tl.filter(function (p) { return p.t > a && p.t < b; }), bad = 0, prev = phaseAt(tl, a);
    steps.forEach(function (p) { var o1 = ORDER[prev], o2 = ORDER[p.phase]; if (o1 != null && o2 != null && !(o2 === o1 || o2 === o1 + 1 || (o1 === 3 && o2 === 0))) bad++; prev = p.phase; });
    var kiru = kiruT.some(function (t) { return t >= a && t < b; }) ? 0 : 1;
    if (ci + 2 === cyc.length && b >= runS - 1) kiru = 0;   // the last (unfinished) cycle has not had its chance
    formPer.push((1 - rho) / 2 + 0.5 * Math.min(1, bad / 2) + 0.5 * kiru);
  }
  C.formDev = +mean(formPer).toFixed(4); C.cycles = formPer.length;
  // --- ensemble: onset coincidence across voices, mean polyphony ---
  var co = 0;
  for (var i2 = 0; i2 < mel.length; i2++) {
    var hit = false;
    for (var j = i2 - 1; j >= 0 && mel[i2].t - mel[j].t <= 0.04; j--) if (mel[j].layer !== mel[i2].layer) { hit = true; break; }
    if (!hit) for (var k2 = i2 + 1; k2 < mel.length && mel[k2].t - mel[i2].t <= 0.04; k2++) if (mel[k2].layer !== mel[i2].layer) { hit = true; break; }
    if (hit) co++;
  }
  C.coinc = mel.length ? +(co / mel.length).toFixed(4) : 0;
  var v = A.voices, any = 1 - v[0];
  C.polyMean = any > 0 ? +((v[1] + 2 * v[2] + 3.2 * v["3+"]) / any).toFixed(4) : 0;
  return C;
}
function loadBase() { try { return JSON.parse(fs.readFileSync(BASE_FILE, "utf8")); } catch (e) { return null; } }
function distanceScalar(C, base) {
  var u = {}, ss = 0;
  DIST_KEYS.forEach(function (k) {
    var med = base && base.stats && base.stats[k] ? base.stats[k].median : 0;
    var scale = base && base.stats && base.stats[k] ? Math.max(base.stats[k].mad * 1.4826, DIST_FLOORS[k]) : DIST_FLOORS[k];
    var z = Math.abs((C[k] || 0) - med) / scale; u[k] = +z.toFixed(2); ss += z * z;
  });
  return { D: +Math.sqrt(ss).toFixed(2), u: u, base: base ? base.meta : null };
}

// ============================================================================
// Report
// ============================================================================
function report(A) {
  var out = [];
  function line(s) { out.push(s == null ? "" : s); }
  line("=== ZANKYŌ probe ===  seed " + A.seed + " · " + A.runS + " s simulated · scripts " + JSON.stringify(A.scripts));
  line("layers: " + A.layers.join(", "));
  line();
  line("--- density ---");
  line("notes total " + A.totalNotes + " (" + A.totalPer30 + " /30min) · melodic " + A.melodicNotes + " (" + A.melodicPer30 + " /30min · " + fmt(A.melodicPerSec) + " /s)");
  var ls = Object.keys(A.notesByLayer);
  line("per layer /30min: " + ls.map(function (l) { return l + " " + A.notesPer30[l]; }).join(" · "));
  line("phase seconds: " + Object.keys(A.phaseDur).map(function (p) { return p + " " + Math.round(A.phaseDur[p]); }).join(" · "));
  line("notes/min by layer × phase:");
  var phases = ["jo", "ha", "kyū", "release"];
  line("  " + pad("layer", 12) + phases.map(function (p) { return lpad(p, 9); }).join(""));
  Object.keys(A.notesPerMinByLayerPhase).forEach(function (l) {
    line("  " + pad(l, 12) + phases.map(function (p) { return lpad(A.notesPerMinByLayerPhase[l][p] == null ? "-" : A.notesPerMinByLayerPhase[l][p], 9); }).join(""));
  });
  line();
  line("--- melodic voices sounding at once (fraction of seconds) ---");
  line("  overall  0: " + pct(A.voices[0]) + "  1: " + pct(A.voices[1]) + "  2: " + pct(A.voices[2]) + "  3+: " + pct(A.voices["3+"]));
  phases.forEach(function (p) { var v = A.voicesByPhase[p]; if (v) line("  " + pad(p, 8) + " 0: " + pct(v[0]) + "  1: " + pct(v[1]) + "  2: " + pct(v[2]) + "  3+: " + pct(v["3+"]) + "   (" + v.secs + " s)"); });
  line("  layer sounding fraction: " + Object.keys(A.layerSoundingFrac).map(function (l) { return l + " " + pct(A.layerSoundingFrac[l]); }).join(" · "));
  line();
  line("--- melodic silence (gaps with no melodic voice sounding) ---");
  line("  gaps " + A.silence.count + " · median " + fmt(A.silence.median) + " s · p90 " + fmt(A.silence.p90) + " s · ≥5s " + A.silence.over5s + " · ≥10s " + A.silence.over10s + " · ≥20s " + A.silence.over20s);
  line("  longest " + fmt(A.silence.longest.gap, 1) + " s at " + Math.round(A.silence.longest.at) + " s (" + A.silence.longest.phase + ")");
  line("  dead air (no melodic note, no ambient/noise/taiko/joint event): longest " + fmt(A.dead.longest, 1) + " s at " + Math.round(A.dead.at) + " s · ≥20 s " + A.dead.over20 + " · ≥30 s " + A.dead.over30);
  phases.forEach(function (p) { var v = A.silenceByPhase[p]; if (v) line("  " + pad(p, 8) + " n " + v.n + " · median " + fmt(v.median) + " · p90 " + fmt(v.p90) + " · max " + fmt(v.max, 1)); });
  line();
  line("--- events per minute (by category × phase) ---");
  line("  " + pad("cat", 12) + lpad("all", 8) + phases.map(function (p) { return lpad(p, 9); }).join(""));
  Object.keys(A.eventsPerMin).sort().forEach(function (c) {
    line("  " + pad(c, 12) + lpad(fmt(A.eventsPerMin[c]), 8) + phases.map(function (p) { var v = A.eventsPerMinByPhase[c][p]; return lpad(v == null ? "-" : fmt(v), 9); }).join(""));
  });
  line("  ambient by name: " + Object.keys(A.ambientByName).map(function (n) { return n + " " + A.ambientByName[n]; }).join(" · "));
  line("  noise bodies: " + JSON.stringify(A.noiseBodies));
  line();
  line("--- form ---");
  line("  cycles " + A.cycles.length + " · KIRUs " + A.kirus.length + " · kinds " + JSON.stringify(A.kinds) + " · seatings " + JSON.stringify(A.seatings) + " · scenes " + JSON.stringify(A.scenes) + " · joints " + A.joints);
  line("  sea changes " + A.seaChanges.length + (A.seaChanges.length ? ": " + A.seaChanges.slice(0, 6).map(function (s) { return s.t + "s " + s.txt; }).join(" | ") : ""));
  line("  visitations " + A.visitations.length + " (" + A.visitRatePer3 + " per 3 cycles · max " + A.visitMaxPerCycle + " in one cycle)" + (A.visitations.length ? ": " + A.visitations.slice(0, 8).map(function (s) { return s.t + "s " + s.txt; }).join(" | ") : ""));
  line("  signals " + A.signals.length + " (" + A.signalRatePer3 + " per 3 cycles · max " + A.signalMaxPerCycle + " in one cycle · by kind " + JSON.stringify(A.signalPerKind) + " · fallbacks " + A.signalFallbacks + ")" + (A.signals.length ? ": " + A.signals.slice(0, 6).map(function (s) { return s.t + "s " + s.txt; }).join(" | ") : ""));
  line("  KIRUs: " + A.kirus.map(function (k) { return k.t + "s " + k.detail; }).join(" | "));
  line("  motif: " + JSON.stringify(A.motif));
  line("  tonic trace: " + A.tonicTrace.map(function (x) { return x.t + "s " + x.hz + "Hz"; }).join(" → "));
  line("  seed pool: authentic " + Object.keys(A.seedPoolAuthentic).length + " seen (" + Object.keys(A.seedPoolAuthentic).map(function (k) { return k + " " + A.seedPoolAuthentic[k]; }).join(", ") + ") · born " + Object.keys(A.seedPoolBorn).length + " · inherited slots " + A.seedPoolInherited);
  line("  shō voicings: " + A.shoVoicings.clusters + " clusters · " + A.shoVoicings.distinct + " distinct (semitones above the lowest) · " + A.shoVoicings.top.join(" | "));
  if (A.airInfo) line("  air: " + JSON.stringify(A.airInfo));
  line("  GATES: " + JSON.stringify(A.gates));
  line("  per cycle:");
  line("  " + pad("c", 3) + lpad("start", 6) + lpad("len", 5) + lpad("maxV", 5) + lpad("3+%", 6) + "  notes · info");
  A.perCycle.forEach(function (r) {
    line("  " + pad(r.cycle, 3) + lpad(r.start, 6) + lpad(r.len, 5) + lpad(r.maxVoices, 5) + lpad((100 * r.voices3).toFixed(0), 6) + "  " + Object.keys(r.notes).map(function (l) { return l.slice(0, 4) + r.notes[l]; }).join(" ") + " · " + r.info);
  });
  line("  mode/form event log (first 40):");
  A.modeEventLog.slice(0, 40).forEach(function (s) { line("    " + s); });
  line();
  line("--- distance from home (far tail) ---");
  var DC = A.distance, DS = A.distanceScalar;
  line("  far: " + (A.far ? JSON.stringify(A.far) : "(engine exposes no getFar)"));
  line("  D = " + DS.D + (DS.base ? "  (base: " + DS.base.seeds + " seeds × " + DS.base.runS + " s, p50 " + DS.base.p50 + " · p95 " + DS.base.p95 + " · 3×p95 " + (3 * DS.base.p95).toFixed(1) + ")" : "  (no base file — raw floors only)"));
  line("  " + pad("component", 11) + lpad("value", 9) + lpad("z", 6) + "   meaning");
  var MEAN = { pcEntropy: "bits, pitch-class entropy (12 bins rel. tonic)", tetDev: "cents RMS off 12-TET", offMode: "fraction > 15 c off every mode degree", ioiVar: "octaves, std log2 within-phrase IOI", rateExc: "octaves, 2-min tempo excursion", densVar: "CV of log2(1+notes/min)", formDev: "arc shape: (1−ρ)/2 + bad steps + no KIRU", coinc: "onsets within 40 ms of another voice", polyMean: "mean voices when any sounds" };
  DIST_KEYS.forEach(function (k) { line("  " + pad(k, 11) + lpad(DC[k], 9) + lpad(DS.u[k], 6) + "   " + MEAN[k]); });
  line("  (melodic notes " + DC.n + " · IOIs " + DC.ioiN + " · cycles judged " + DC.cycles + " · notes/min " + DC.densPerMin + ")");
  line();
  line("--- technical ---");
  var T = A.tech;
  line("  load errors: " + (T.loadErrors.length ? JSON.stringify(T.loadErrors) : "none") + " · runtime errors: " + (T.errors.length ? T.errors.length : "none"));
  T.errors.slice(0, 10).forEach(function (e) { line("    " + e); });
  line("  exp ramps from/to ≤0: " + T.expZero.length + (T.expZero.length ? "  e.g. " + T.expZero.slice(0, 5).map(function (f) { return f.where + " " + f.from + "→" + f.to; }).join(" | ") : ""));
  line("  scheduled in the past (>0.25 s): " + T.pastSchedule.length + (T.pastSchedule.length ? "  e.g. " + T.pastSchedule.slice(0, 3).map(function (f) { return f.where + " t=" + f.t + " now=" + f.now; }).join(" | ") : ""));
  line("  sources never stopped (alive >60 s at end): " + T.neverStopped + (T.neverStopped ? "  " + JSON.stringify(T.leakWhere) : "") + " · started twice: " + T.startedTwice + " · build-time persistent sources (not leaks): " + (T.infraSources || 0));
  line("  nodes created " + T.nodesCreated + " (" + Math.round(T.nodesPerMin) + " /min; Phase 3 budget ≤ 1500) · sources started " + T.sourcesStarted + " · peak concurrent sources " + T.peakSources + " at " + T.peakAt + " s (budget ≤ 110) · " + JSON.stringify(T.byType));
  line("  Math.random during play: " + T.randomDuringPlay + (T.randomDuringPlay ? "  " + JSON.stringify(T.randomWhere) : ""));
  line("  public API: " + T.api.join(", "));
  return out.join("\n");
}

// ============================================================================
// Batch driver: node _probe.js batch [seconds] [--seeds "a b c" | --nseeds 40] [--far d] [--calibrate] [--out dir] [--par 8]
//   runs every seed in its own process (--quiet --dist-json), prints the
//   component table with p50 / p95 of D, the note/event signatures (the
//   byte-identity gate), and with --calibrate writes _probe-base.json.
// ============================================================================
if (args[0] === "batch") {
  var cp = require("child_process");
  var bRun = parseFloat(args[1] || "1800"); if (!isFinite(bRun) || bRun <= 0) bRun = 1800;
  var seeds = null, nseeds = 40, bFar = null, calibrate = false, outDir = null, par = 8;
  for (var bi = 2; bi < args.length; bi++) {
    if (args[bi] === "--seeds") seeds = args[++bi].split(/[\s,]+/).filter(Boolean).map(Number);
    else if (args[bi] === "--nseeds") nseeds = parseInt(args[++bi], 10) || 40;
    else if (args[bi] === "--far") bFar = args[++bi];
    else if (args[bi] === "--calibrate") calibrate = true;
    else if (args[bi] === "--out") outDir = args[++bi];
    else if (args[bi] === "--par") par = parseInt(args[++bi], 10) || 8;
    else if (args[bi] === "--base") BASE_FILE = args[++bi];
  }
  if (!seeds) { seeds = [3042, 17, 7, 8891]; for (var si = 101; seeds.length < nseeds; si++) seeds.push(si); }   // the crew's four + a fixed run of seeds
  var tmpDir = outDir || fs.mkdtempSync(path.join(require("os").tmpdir(), "zk-batch-"));
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (e) {}
  var results = [], queue = seeds.slice(), running = 0;
  function next() {
    while (running < par && queue.length) {
      (function (sd0) {
        running++;
        var f = path.join(tmpDir, "dist-" + sd0 + (bFar != null ? "-far" + bFar : "") + ".json");
        var a2 = [__filename, String(bRun), String(sd0), "--quiet", "--dist-json", f, "--base", BASE_FILE]; if (bFar != null) a2.push("--far", bFar);
        cp.execFile(process.execPath, a2, { maxBuffer: 1 << 26 }, function (err, so, se) {
          running--;
          try { results.push(JSON.parse(fs.readFileSync(f, "utf8"))); } catch (e) { results.push({ seed: sd0, error: (err && err.message) || String(e), stderr: String(se).slice(0, 300) }); }
          if (queue.length) next(); else if (!running) finish();
        });
      })(queue.shift());
    }
  }
  function finish() {
    results.sort(function (a, b) { return seeds.indexOf(a.seed) - seeds.indexOf(b.seed); });
    var ok = results.filter(function (r) { return !r.error; });
    var base = loadBase();
    var stats = {};
    // THE BASE IS HOME NIGHTS ONLY (critic, §8.1 re-base). A law-drawn sample
    // carries ~10 % departed nights, and once the far tail actually works those
    // nights score high — so calibrating on the whole sample makes the base
    // chase the work: the better the departures get, the higher the base's p95
    // and the harder the gate that is derived from it. At W0 nothing departed
    // and the two were the same number, which is why this went unnoticed until
    // the far tail had teeth (all-40 p95 7.75 vs home-only 5.71 on the same run).
    var homeOk = ok.filter(function (r) { return !r.far || r.far.home; });
    if (!homeOk.length) homeOk = ok;
    DIST_KEYS.forEach(function (k) { var vals = homeOk.map(function (r) { return r.C[k]; }); var med = q(vals, 0.5); var mad = q(vals.map(function (v) { return Math.abs(v - med); }), 0.5); stats[k] = { median: +med.toFixed(4), mad: +mad.toFixed(4), min: +Math.min.apply(null, vals).toFixed(4), max: +Math.max.apply(null, vals).toFixed(4) }; });
    var useBase = base;
    if (calibrate || !base) { useBase = { meta: { seeds: ok.length, homeSeeds: homeOk.length, runS: bRun, seedList: ok.map(function (r) { return r.seed; }), engine: ok[0] && ok[0].engineSig, written: new Date().toISOString() }, stats: stats }; }
    ok.forEach(function (r) { r.DS = distanceScalar(r.C, useBase); });
    var Ds = ok.map(function (r) { return r.DS.D; });
    var p50 = +q(Ds, 0.5).toFixed(2), p95 = +q(Ds, 0.95).toFixed(2);
    // The GATE is derived from home nights only, for the reason above.
    var homeDs = homeOk.map(function (r) { return r.DS.D; });
    var hp50 = +q(homeDs, 0.5).toFixed(2), hp95 = +q(homeDs, 0.95).toFixed(2);
    if (calibrate || !base) { useBase.meta.p50 = hp50; useBase.meta.p95 = hp95; useBase.meta.pmax = +Math.max.apply(null, homeDs).toFixed(2);
      useBase.meta.p50AllDrawn = p50; useBase.meta.p95AllDrawn = p95; }
    if (calibrate) { fs.writeFileSync(BASE_FILE, JSON.stringify(useBase, null, 1)); }
    var out = [];
    out.push("=== ZANKYŌ distance batch ===  " + ok.length + " seeds × " + bRun + " s" + (bFar != null ? " · ?far=" + bFar : "") + (calibrate ? " · CALIBRATED → " + BASE_FILE : base ? " · base " + base.meta.seeds + " seeds (p50 " + base.meta.p50 + " · p95 " + base.meta.p95 + ")" : " · no base"));
    out.push(pad("seed", 6) + lpad("D", 7) + DIST_KEYS.map(function (k) { return lpad(k, 10); }).join("") + "   far · notes/events signature");
    ok.forEach(function (r) { out.push(pad(r.seed, 6) + lpad(r.DS.D, 7) + DIST_KEYS.map(function (k) { return lpad(r.C[k], 10); }).join("") + "   " + (r.far ? (r.far.d != null ? "d " + (+r.far.d).toFixed(2) + " " + (r.far.name || "") : JSON.stringify(r.far).slice(0, 30)) : "-") + " · " + r.sig.notes.slice(0, 10) + "/" + r.sig.events.slice(0, 10) + " (" + r.sig.noteCount + "/" + r.sig.eventCount + ")" + (r.errors ? "  ERRORS " + r.errors : "")); });
    out.push(pad("median", 6) + lpad(p50, 7) + DIST_KEYS.map(function (k) { return lpad(stats[k].median, 10); }).join(""));
    out.push(pad("MAD", 6) + lpad("", 7) + DIST_KEYS.map(function (k) { return lpad(stats[k].mad, 10); }).join(""));
    out.push(pad("scale", 6) + lpad("", 7) + DIST_KEYS.map(function (k) { return lpad(Math.max(stats[k].mad * 1.4826, DIST_FLOORS[k]).toFixed(3), 10); }).join("") + "   (max(1.4826·MAD, floor))");
    out.push("D: p50 " + p50 + " · p95 " + p95 + " · max " + Math.max.apply(null, Ds) + " · min " + Math.min.apply(null, Ds));
    out.push("   home-only (" + homeOk.length + " of " + ok.length + "): p50 " + hp50 + " · p95 " + hp95 + " · max " + Math.max.apply(null, homeDs).toFixed(2) +
      (useBase && useBase.meta && useBase.meta.p95 ? "   [3× this base's p95 would be " + (3 * useBase.meta.p95).toFixed(1) + " — NOT the gate, see below]" : ""));
    out.push("   THE FAR TARGET IS PINNED (plan §9): p95 ≥ " + FAR_TARGET + " · W4 1-in-50 ≥ " + FAR_TARGET_5X +
      "   — this run: p95 " + p95 + " (" + (p95 >= FAR_TARGET ? "clears" : "SHORT OF") + " " + FAR_TARGET + ") · nights ≥ " + FAR_TARGET + ": " +
      Ds.filter(function (d) { return d >= FAR_TARGET; }).length + "/" + Ds.length + " · ≥ " + FAR_TARGET_5X + ": " + Ds.filter(function (d) { return d >= FAR_TARGET_5X; }).length);
    // W1+: D by drawn departure — which departures carry the distance, and which draw without registering
    var byDep = {};
    ok.forEach(function (r) { var ids = r.far && r.far.ids ? r.far.ids : []; ids.forEach(function (id) { (byDep[id] = byDep[id] || []).push(r.DS.D); }); });
    var depKeys = Object.keys(byDep).sort(function (a, b) { return q(byDep[b], 0.5) - q(byDep[a], 0.5); });
    if (depKeys.length) out.push("D by departure (median · n): " + depKeys.map(function (k) { return k + " " + q(byDep[k], 0.5).toFixed(1) + "·" + byDep[k].length; }).join(" · "));
    var nDep = ok.filter(function (r) { return r.far && !r.far.home; }).length;
    if (nDep) out.push("departed nights " + nDep + "/" + ok.length + " · their D p50 " + q(ok.filter(function (r) { return r.far && !r.far.home; }).map(function (r) { return r.DS.D; }), 0.5).toFixed(2) + " · home p50 " + q(ok.filter(function (r) { return !r.far || r.far.home; }).map(function (r) { return r.DS.D; }), 0.5).toFixed(2));
    out.push("seeds ≥ " + FAR_TARGET + ": " + ok.filter(function (r) { return r.DS.D >= FAR_TARGET; }).map(function (r) { return r.seed; }).join(" ") + " · ≥ " + FAR_TARGET_5X + ": " + ok.filter(function (r) { return r.DS.D >= FAR_TARGET_5X; }).map(function (r) { return r.seed; }).join(" "));
    results.filter(function (r) { return r.error; }).forEach(function (r) { out.push("seed " + r.seed + " FAILED: " + r.error + " " + r.stderr); });
    console.log(out.join("\n"));
    fs.writeFileSync(path.join(tmpDir, "batch" + (bFar != null ? "-far" + bFar : "") + ".json"), JSON.stringify({ runS: bRun, far: bFar, seeds: seeds, results: ok, stats: stats, p50: p50, p95: p95 }, null, 1));
    console.log("per-seed files in " + tmpDir);
    process.exit(results.some(function (r) { return r.error; }) ? 1 : 0);
  }
  next();
} else {
var R1 = runOnce(SEED, RUN, JITTER);
if (R1.fatal) { console.error("FATAL: " + R1.fatal); process.exit(2); }
var A1 = analyze(R1);
if (!QUIET) console.log(report(A1));
var sig1 = signature(R1);
console.log("\nsignature: notes " + sig1.notes.slice(0, 12) + " (" + sig1.noteCount + ") · events " + sig1.events.slice(0, 12) + " (" + sig1.eventCount + ")");
var reproOk = null;
if (REPRO) {
  var R2 = runOnce(SEED, RUN, JITTER ? JITTER + 1 : 0);
  var sig2 = signature(R2);
  reproOk = sig1.notes === sig2.notes && sig1.events === sig2.events;
  console.log("REPRO (same seed twice, fresh globals" + (JITTER ? ", timer jitter seeds " + JITTER + " vs " + (JITTER + 1) : "") + "): " + (reproOk ? "IDENTICAL ✓" : "DIFFERENT ✗  run2 notes " + sig2.notes.slice(0, 12) + " (" + sig2.noteCount + ") events " + sig2.events.slice(0, 12) + " (" + sig2.eventCount + ")"));
  if (!reproOk) {
    // first divergence, for the coder
    for (var i = 0; i < Math.min(R1.notes.length, R2.notes.length); i++) {
      var a = R1.notes[i], b = R2.notes[i];
      if (a.layer !== b.layer || a.freq !== b.freq || Math.abs(a.t - b.t) > 1e-6) { console.log("  first note divergence at #" + i + ": " + JSON.stringify(a) + " vs " + JSON.stringify(b)); break; }
    }
    for (var j = 0; j < Math.min(R1.events.length, R2.events.length); j++) {
      var ea = R1.events[j], eb = R2.events[j];
      if (ea.cat !== eb.cat || ea.label !== eb.label || ea.detail !== eb.detail || Math.abs(ea.t - eb.t) > 1e-6) { console.log("  first event divergence at #" + j + ": " + JSON.stringify(ea) + " vs " + JSON.stringify(eb)); break; }
    }
  }
}
if (JSON_OUT) {
  A1.signature = sig1; A1.repro = reproOk;
  fs.writeFileSync(JSON_OUT, JSON.stringify(A1, null, 1));
  console.log("wrote " + JSON_OUT);
}
if (DIST_JSON) {
  // The signature of what was ACTUALLY LOADED, not of the file in the tree —
  // under ZK_SRCDIR or ZK_ENGINE those differ, and a signature that names the
  // wrong build is worse than none.
  var engineSig = (function () {
    try {
      var h = require("crypto").createHash("sha1");
      var lf = LOADED_FROM || {};
      var names = Object.keys(lf).sort();
      if (!names.length) names = null;
      if (names) { for (var i = 0; i < names.length; i++) h.update(names[i]).update(fs.readFileSync(lf[names[i]])); }
      else h.update(fs.readFileSync(path.join(__dirname, "zankyo-audio.js")));
      return h.digest("hex").slice(0, 12);
    } catch (e) { return null; }
  })();
  fs.writeFileSync(DIST_JSON, JSON.stringify({ seed: SEED, runS: RUN, far: A1.far, C: A1.distance, sig: sig1, engineSig: engineSig, errors: A1.tech.errors.length + A1.tech.loadErrors.length || undefined, gates: A1.gates }));
}
process.exit(A1.tech.errors.length || A1.tech.loadErrors.length || reproOk === false ? 1 : 0);
}

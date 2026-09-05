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
var JSON_OUT = null, REPRO = false, QUIET = false, JITTER = 0;
for (var ai = 2; ai < args.length; ai++) {
  if (args[ai] === "--json") JSON_OUT = args[++ai];
  else if (args[ai] === "--repro") REPRO = true;
  else if (args[ai] === "--quiet") QUIET = true;
  else if (args[ai] === "--jitter") JITTER = parseInt(args[++ai], 10) || 0;   // timer jitter seed (0 = exact)
}

var LANDSCAPE = { subDrone: 1, sho: 1, taiko: 1, noise: 1, ambient: 1 };   // never "melodic voices"
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
    n.start = function (t) {
      if (started) faults.startedTwice++;
      started = true; counts.sourcesStarted++;
      liveSources[id] = { type: type, at: +vnow.toFixed(2), where: callerLine() };
      checkPast(t);
    };
    n.stop = function () { stopped = true; delete liveSources[id]; };
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
  W.location = { search: "", href: "http://127.0.0.1/art/zankyo/", pathname: "/art/zankyo/" };
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
  scripts.forEach(function (s) {
    var full = path.resolve(dir, s);
    if (/zankyo-audio\.js$/.test(s) && process.env.ZK_ENGINE) full = path.resolve(process.env.ZK_ENGINE);   // A/B an alternate engine build
    try { (0, eval)(fs.readFileSync(full, "utf8")); } catch (e) { loadErrors.push(s + ": " + (e && e.message)); }
  });
  var Z = W.ZankyoAudio;
  if (!Z) return { fatal: "ZankyoAudio not defined; loaded " + JSON.stringify(scripts) + " errors " + JSON.stringify(loadErrors) };

  if (Z.reseed) Z.reseed(seed);

  // ---- capture ----
  var notes = [], events = [], phaseTimeline = [], arcSamples = [], planInfo = [];
  Z.setNoteListener(function (n) {
    notes.push({ layer: n.layer, freq: n.freq, t: typeof n.startTime === "number" ? n.startTime : vnow, dur: n.duration || 0, at: vnow });
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

  return {
    scripts: scripts, loadErrors: loadErrors, errors: errors, seed: seed, runS: runS,
    notes: notes, events: events, phaseTimeline: phaseTimeline, arcSamples: arcSamples, planInfo: planInfo,
    faults: faults, leakWhere: leakWhere, counts: counts,
    randomPlayCount: randomPlayCount, randomDuringPlay: randomDuringPlay,
    motifStats: Z.getMotifStats ? Z.getMotifStats() : null,
    airInfo: (function () { try { var a = Z.getAir ? Z.getAir() : null; return a && a.info ? a.info() : (Z.getAirInfo ? Z.getAirInfo() : null); } catch (e) { return null; } })(),
    layers: Z.LAYERS ? Z.LAYERS.slice() : [],
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
  var modeEvents = R.events.filter(function (e) { return e.cat === "mode" || e.cat === "form" || e.cat === "plan" || e.cat === "scene" || e.cat === "visit" || e.cat === "visitation" || e.cat === "pitch"; });
  A.kirus = R.events.filter(function (e) { return /KIRU/.test(e.label); }).map(function (e) { return { t: Math.round(e.t), detail: e.detail }; });
  A.cycles = R.events.filter(function (e) { return /cycle \d+/.test(e.detail) && /mode/.test(e.label); }).map(function (e) { return { t: Math.round(e.t), detail: e.detail }; });
  A.kinds = {}; A.seatings = {}; A.seaChanges = []; A.visitations = []; A.scenes = {}; A.joints = 0; A.airInfo = null;
  R.events.forEach(function (e) {
    var txt = e.label + " · " + e.detail;
    var km = /(?:kind|活動|cycle kind)[:\s]+([^\s·,]+)/i.exec(txt); if (km) A.kinds[km[1]] = (A.kinds[km[1]] || 0) + 1;
    var sm = /seat(?:ing|ed)[:\s]+([^·]+)/i.exec(txt); if (sm) A.seatings[sm[1].trim()] = (A.seatings[sm[1].trim()] || 0) + 1;
    if (/sea change|modulat|海|retun/i.test(txt) && !/mode lottery/.test(txt)) A.seaChanges.push({ t: Math.round(e.t), txt: txt.slice(0, 120) });
    if (/visit|apparition|guest|放送 the|祭|回線|鐘 the|無 mu/i.test(txt) && e.cat !== "ambient") A.visitations.push({ t: Math.round(e.t), txt: txt.slice(0, 120) });
    var scm = /scene[:\s]+([^\s·,]+)/i.exec(txt); if (scm) A.scenes[scm[1]] = (A.scenes[scm[1]] || 0) + 1;
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
  A.gates = {
    melodicPer30: A.melodicPer30, melodicRatioToBaseline: +(A.melodicPer30 / BASE_MELODIC_30).toFixed(2),
    zeroVoiceFrac: +A.voices[0].toFixed(3), joThreePlus: A.voicesByPhase.jo ? +A.voicesByPhase.jo["3+"].toFixed(3) : null,
    gapsOver10s: A.silence.over10s, kinds: Object.keys(A.kinds).length, seatings: Object.keys(A.seatings).length,
    seaChanges: A.seaChanges.length, visitations: A.visitations.length, cycles: A.cycles.length, kirus: A.kirus.length,
    tonicsSeen: A.tonicTrace.length, seedPoolAuthentic: Object.keys(A.seedPoolAuthentic).length, seedPoolBorn: Object.keys(A.seedPoolBorn).length, shoVoicings: A.shoVoicings.distinct,
  };
  A.tech = {
    loadErrors: R.loadErrors, errors: R.errors, expZero: R.faults.expZero, pastSchedule: R.faults.pastSchedule,
    neverStopped: R.faults.neverStopped, leakWhere: R.leakWhere, startedTwice: R.faults.startedTwice, infraSources: R.faults.infraSources,
    nodesCreated: R.counts.nodes, nodesPerMin: R.counts.nodes / (runS / 60), sourcesStarted: R.counts.sourcesStarted, byType: R.counts.byType,
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
  line();
  line("--- form ---");
  line("  cycles " + A.cycles.length + " · KIRUs " + A.kirus.length + " · kinds " + JSON.stringify(A.kinds) + " · seatings " + JSON.stringify(A.seatings) + " · scenes " + JSON.stringify(A.scenes) + " · joints " + A.joints);
  line("  sea changes " + A.seaChanges.length + (A.seaChanges.length ? ": " + A.seaChanges.slice(0, 6).map(function (s) { return s.t + "s " + s.txt; }).join(" | ") : ""));
  line("  visitations " + A.visitations.length + (A.visitations.length ? ": " + A.visitations.slice(0, 8).map(function (s) { return s.t + "s " + s.txt; }).join(" | ") : ""));
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
  line("--- technical ---");
  var T = A.tech;
  line("  load errors: " + (T.loadErrors.length ? JSON.stringify(T.loadErrors) : "none") + " · runtime errors: " + (T.errors.length ? T.errors.length : "none"));
  T.errors.slice(0, 10).forEach(function (e) { line("    " + e); });
  line("  exp ramps from/to ≤0: " + T.expZero.length + (T.expZero.length ? "  e.g. " + T.expZero.slice(0, 5).map(function (f) { return f.where + " " + f.from + "→" + f.to; }).join(" | ") : ""));
  line("  scheduled in the past (>0.25 s): " + T.pastSchedule.length + (T.pastSchedule.length ? "  e.g. " + T.pastSchedule.slice(0, 3).map(function (f) { return f.where + " t=" + f.t + " now=" + f.now; }).join(" | ") : ""));
  line("  sources never stopped (alive >60 s at end): " + T.neverStopped + (T.neverStopped ? "  " + JSON.stringify(T.leakWhere) : "") + " · started twice: " + T.startedTwice + " · build-time persistent sources (not leaks): " + (T.infraSources || 0));
  line("  nodes created " + T.nodesCreated + " (" + Math.round(T.nodesPerMin) + " /min) · sources started " + T.sourcesStarted + " · " + JSON.stringify(T.byType));
  line("  Math.random during play: " + T.randomDuringPlay + (T.randomDuringPlay ? "  " + JSON.stringify(T.randomWhere) : ""));
  line("  public API: " + T.api.join(", "));
  return out.join("\n");
}

// ============================================================================
// Main
// ============================================================================
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
process.exit(A1.tech.errors.length || A1.tech.loadErrors.length || reproOk === false ? 1 : 0);

// ============================================================================
// ZANKYŌ headless validation harness (dev tool, not shipped to users' ears).
//
// Mocks Web Audio + a virtual clock, loads the PJ2 substrate the engine now
// stands on (pj2-rand / pitch / clock / voice / fx / air / conductor, by
// relative path from ../prosperos-jukebox-v2/) and then the real
// zankyo-audio.js unmodified, runs the generator for simulated minutes, and
// checks: scale adherence, jo-ha-kyū arc progression, motif machinery, the
// meta-arc, runtime errors — and, since ZANKYŌ 2 Phase 0, two substrate
// gates the Jukebox harness taught us: REPRO (same seed twice → identical
// note + event streams; a different seed → a different stream) and a NODE
// BUDGET line (how many audio nodes the engine spends per simulated minute,
// and the peak number of sources sounding at once). The mock AudioParams
// record every automation call and flag two click-bug classes at the moment
// of commission: a ramp with no prior anchor, and an exponential ramp
// through zero.
//
// Virtual time: vnow (seconds) is the one clock. The mock ctx.currentTime
// reads it; the fake setInterval/setTimeout queue advances it. PJ2.Clock is
// a lookahead transport pumped by setInterval(tick, 25ms), so the queue
// model is the Jukebox harness's, not the old per-layer setTimeout one.
//
// Usage: node _harness.js [seconds] [seed]
"use strict";
const fs = require("fs");
const path = require("path");

const RUN = parseFloat(process.argv[2] || "480");   // simulate N seconds
const SEED = parseInt(process.argv[3] || "3042", 10) || 3042;

// ---- virtual clock + timer queue ----
let vnow = 0;
let vtimers = {};
let vtimerNext = 1;
function vSetInterval(fn, ms) {
  const id = vtimerNext++;
  const period = Math.max((ms || 0) / 1000, 0.001);
  vtimers[id] = { fn, period, next: vnow + period, once: false };
  return id;
}
function vSetTimeout(fn, ms) {
  const id = vtimerNext++;
  vtimers[id] = { fn, period: 0, next: vnow + Math.max((ms || 0) / 1000, 0), once: true };
  return id;
}
function vClear(id) { delete vtimers[id]; }
global.setInterval = vSetInterval;
global.clearInterval = vClear;
global.setTimeout = vSetTimeout;
global.clearTimeout = vClear;
global.performance = { now: () => vnow * 1000 };

let errors = [];
function vAdvance(untilS, onStep) {
  let guard = 0;
  for (;;) {
    if (++guard > 20000000) { errors.push("vAdvance: iteration guard tripped at " + vnow.toFixed(3) + "s"); return; }
    let bestId = null, bestT = Infinity;
    for (const id in vtimers) { if (vtimers[id].next < bestT) { bestT = vtimers[id].next; bestId = id; } }
    if (bestId === null || bestT > untilS) { vnow = untilS; return; }
    vnow = bestT;
    const tm = vtimers[bestId];
    if (tm.once) delete vtimers[bestId]; else tm.next = vnow + tm.period;
    try { tm.fn(); } catch (e) { errors.push("timer@" + vnow.toFixed(1) + "s: " + (e && e.message)); if (errors.length > 40) return; }
    if (onStep) onStep();
  }
}

// ---- mock Web Audio (recording params, PJ2-harness lineage) ----
const VIOLATIONS = [];
function mkParam(ownerKind, label, initV) {
  const p = { value: initV != null ? initV : 0, _label: ownerKind + "." + label, _anchored: false, _lastV: initV != null ? initV : 0 };
  p.setValueAtTime = function (v, t) { p._anchored = true; p._lastV = v; p.value = v; return p; };
  p.linearRampToValueAtTime = function (v, t) {
    if (!p._anchored) VIOLATIONS.push({ kind: "linearRamp without anchor", param: p._label, v, t });
    p._anchored = true; p._lastV = v; p.value = v; return p;
  };
  p.exponentialRampToValueAtTime = function (v, t) {
    if (!p._anchored) VIOLATIONS.push({ kind: "exponentialRamp without anchor", param: p._label, v, t });
    if (!(v > 0)) VIOLATIONS.push({ kind: "exponentialRamp target <= 0", param: p._label, v, t });
    else if (!(p._lastV > 0)) VIOLATIONS.push({ kind: "exponentialRamp departing from <= 0", param: p._label, v: p._lastV, t });
    p._anchored = true; p._lastV = v; p.value = v; return p;
  };
  p.setTargetAtTime = function (v) { p._anchored = true; p._lastV = v; return p; };
  p.setValueCurveAtTime = function (curve) { p._anchored = true; if (curve && curve.length) p._lastV = curve[curve.length - 1]; return p; };
  p.cancelScheduledValues = function () { p._anchored = false; return p; };
  return p;
}
let nodeStats = null;   // per run: { created: {kind: n}, total, sources: [{start, stop}] }
function mkCtx() {
  const ctx = { sampleRate: 48000, state: "running", resume() {} };
  Object.defineProperty(ctx, "currentTime", { get: () => vnow });
  function mkNode(kind, params, props) {
    const n = {
      _kind: kind,
      connect: () => n, disconnect: () => {},
      start(when) { n._start = when != null ? when : vnow; },
      stop(when) { n._stop = when != null ? when : vnow; if (nodeStats) nodeStats.sources.push({ start: n._start != null ? n._start : vnow, stop: n._stop }); },
    };
    for (const k in params) n[k] = mkParam(kind, k, params[k]);
    if (props) for (const k in props) n[k] = props[k];
    if (nodeStats) { nodeStats.created[kind] = (nodeStats.created[kind] || 0) + 1; nodeStats.total++; }
    return n;
  }
  ctx.destination = mkNode("Destination", {}, {});
  ctx.createGain = () => mkNode("Gain", { gain: 1 });
  ctx.createOscillator = () => mkNode("Oscillator", { frequency: 440, detune: 0 }, { type: "sine", setPeriodicWave() {} });
  ctx.createBiquadFilter = () => mkNode("BiquadFilter", { frequency: 350, Q: 1, gain: 0 }, { type: "lowpass" });
  ctx.createStereoPanner = () => mkNode("StereoPanner", { pan: 0 });
  ctx.createDelay = () => mkNode("Delay", { delayTime: 0 });
  ctx.createConvolver = () => mkNode("Convolver", {}, { buffer: null });
  ctx.createWaveShaper = () => mkNode("WaveShaper", {}, { curve: null, oversample: "none" });
  ctx.createDynamicsCompressor = () => mkNode("DynamicsCompressor", { threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 });
  ctx.createAnalyser = () => mkNode("Analyser", {}, { fftSize: 2048 });
  ctx.createBuffer = (nCh, len, sr) => {
    const chans = []; for (let c = 0; c < nCh; c++) chans.push(new Float32Array(len));
    return { numberOfChannels: nCh, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => chans[i] };
  };
  ctx.createBufferSource = () => mkNode("BufferSource", {}, { buffer: null, loop: false, loopStart: 0, loopEnd: 0 });
  ctx.createPeriodicWave = () => ({});
  return ctx;
}

// ---- load the substrate + the engine, fresh per run ----
const PJ2_DIR = path.join(__dirname, "..", "prosperos-jukebox-v2");
const PJ2_MODULES = ["pj2-rand.js", "pj2-pitch.js", "pj2-clock.js", "pj2-voice.js", "pj2-fx.js", "pj2-air.js", "pj2-conductor.js"];
const SRC = {};
for (const m of PJ2_MODULES) SRC[m] = fs.readFileSync(path.join(PJ2_DIR, m), "utf8");
SRC.engine = fs.readFileSync(process.env.ZK_ENGINE || path.join(__dirname, "zankyo-audio.js"), "utf8");   // ZK_ENGINE: A/B an alternate build

function loadEngine() {
  const W = { AudioContext: function () { return mkCtx(); } };
  global.window = W;
  global.PJ2 = W.PJ2 = {};
  global.location = undefined;
  for (const m of PJ2_MODULES) {
    try { (0, eval)(SRC[m]); } catch (e) { errors.push("LOAD " + m + ": " + e.message); }
  }
  try { (0, eval)(SRC.engine); } catch (e) { errors.push("LOAD zankyo-audio.js: " + e.message); }
  return W.ZankyoAudio;
}

// ---- one run: play for simS, collect notes/events/arc samples/meta ----
function runOnce(seed, simS, opts) {
  opts = opts || {};
  vnow = 0; vtimers = {}; vtimerNext = 1;
  nodeStats = { created: {}, total: 0, sources: [] };
  const Z = loadEngine();
  if (!Z) { errors.push("ZankyoAudio not defined"); return null; }
  Z.reseed(seed);
  const R = { seed, simS, notes: [], events: [], arcSamples: [], metaByCycle: new Map(), t0: 0 };
  Z.setNoteListener((n) => R.notes.push({ t: n.startTime, layer: n.layer, freq: n.freq, dur: n.duration }));
  Z.setEventListener((e) => R.events.push({ t: e.t, cat: e.cat, label: e.label, detail: e.detail }));
  const SAMPLE_EVERY = 15;
  let nextSample = 0;
  const origCE = console.error;
  const swallowed = [];
  console.error = function () { swallowed.push(Array.prototype.join.call(arguments, " ")); };
  try {
    Z.play();
    R.t0 = vnow;
    vAdvance(simS, () => {
      if (vnow >= nextSample) { R.arcSamples.push({ t: Math.round(vnow), level: +Z.getArc().toFixed(3), phase: Z.getArcInfo().phase }); nextSample += SAMPLE_EVERY; }
      if (Z.getMetaInfo) {
        const mi = Z.getMetaInfo();
        if (mi.cycle >= 0 && !R.metaByCycle.has(mi.cycle))
          R.metaByCycle.set(mi.cycle, { metaPos: +mi.metaPos.toFixed(3), period: Math.round(mi.period), severity: +mi.severity.toFixed(3) });
      }
    });
    Z.stop();
  } catch (e) { errors.push("PLAY: " + e.message + "\n" + (e.stack || "").split("\n").slice(1, 4).join("\n")); }
  console.error = origCE;
  for (const s of swallowed) errors.push("swallowed@" + vnow.toFixed(1) + "s: " + s.slice(0, 200));
  R.nodes = nodeStats;
  R.info = Z.getMetaInfo ? Z.getMetaInfo() : {};
  R.stats = Z.getMotifStats ? Z.getMotifStats() : { transforms: [], developments: 0, answers: 0 };
  R.Z = Z;
  nodeStats = null;
  return R;
}

// ---- scale model (must match engine) for adherence checks ----
const TONIC = 146.83;
const ALL_MODES = [[0,2,3,7,8],[0,1,5,7,8],[0,2,3,7,9],[0,1,5,6,10]];   // hirajoshi/insen/kumoi/iwato
function nearestCents(freq) {
  let best = 1e9;
  for (const M of ALL_MODES) {
    for (let i = -10; i <= 25; i++) {
      const semi = M[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
      const f = TONIC * Math.pow(2, semi / 12);
      const cents = Math.abs(1200 * Math.log2(freq / f));
      if (cents < best) best = cents;
    }
  }
  return best;
}

// ============================================================================
// THE RUNS: A (the one under the microscope), B (same seed — REPRO), C (a
// different seed, shorter — must differ).
// ============================================================================
const runA = runOnce(SEED, RUN);
const runB = runOnce(SEED, RUN);
const CRUN = Math.min(RUN, 600);
const runC = runOnce(SEED + 1, CRUN);
if (!runA || !runB || !runC) { console.error("FAIL: engine did not load"); errors.forEach((e) => console.error("  " + e)); process.exit(1); }

// ---- analyze run A ----
const notes = runA.notes, events = runA.events, arcSamples = runA.arcSamples, metaByCycle = runA.metaByCycle;
const byLayer = {};
notes.forEach((n) => (byLayer[n.layer] = (byLayer[n.layer] || 0) + 1));
const byCat = {};
events.forEach((e) => (byCat[e.cat] = (byCat[e.cat] || 0) + 1));
let inScale = 0, offNotes = [];
notes.forEach((n) => { const c = nearestCents(n.freq); if (c < 5) inScale++; else offNotes.push({ layer: n.layer, freq: Math.round(n.freq), cents: Math.round(c) }); });
const arcMax = Math.max(...arcSamples.map((s) => s.level), 0);
const arcMin = Math.min(...arcSamples.map((s) => s.level), 1);
const phasesSeen = [...new Set(arcSamples.map((s) => s.phase))];

const stats = runA.stats;
const answers = events.filter((e) => e.label.indexOf("answers") >= 0).length;
const maxGen = Math.max(0, ...events.map((e) => { const m = /·g(\d+)/.exec(e.label); return m ? parseInt(m[1], 10) : 0; }));
const reprises = events.filter((e) => e.label.indexOf("reprise") >= 0).length;
const ghosts = events.filter((e) => e.label.indexOf("ghost") >= 0).length;
const shadows = events.filter((e) => e.label.indexOf("shadows") >= 0).length;
const decomposes = events.filter((e) => e.label.indexOf("decomposes") >= 0).length;
const MELODIC = { shakuhachi: 1, koto: 1, shamisen: 1 };
const melodicNotes = notes.filter((n) => MELODIC[n.layer]).length;

console.log("=== ZANKYŌ harness ===  (simulated " + RUN + "s, seed " + SEED + ")");
console.log("notes:", notes.length, " events:", events.length, " melodic notes/s:", (melodicNotes / RUN).toFixed(2), " (per 30 min: " + Math.round(melodicNotes * 1800 / RUN) + ")");
console.log("notes by layer:", JSON.stringify(byLayer));
console.log("events by cat:", JSON.stringify(byCat));
console.log("scale adherence:", inScale + "/" + notes.length, notes.length ? "(" + Math.round(100 * inScale / notes.length) + "%)" : "");
if (offNotes.length) console.log("  OFF-SCALE (first 8):", JSON.stringify(offNotes.slice(0, 8)));
console.log("arc: min", arcMin, "max", arcMax, "phases seen:", JSON.stringify(phasesSeen));
console.log("arc trace:", arcSamples.map((s) => s.phase[0] + s.level).join(" "));
console.log("motif: developments", stats.developments, "· answers", answers, "· max generation", maxGen, "· reprises", reprises, "· ghosts", ghosts, "· shadows", shadows, "· decomposes", decomposes);
console.log("transforms used:", JSON.stringify(stats.transforms));

// ---- meta-arc metrics ----
const cycles = [...metaByCycle.keys()].sort((a, b) => a - b);
const periods = [...new Set(cycles.map((c) => metaByCycle.get(c).period))];
const metaVals = cycles.map((c) => metaByCycle.get(c).metaPos);
const metaRange = metaVals.length ? Math.max(...metaVals) - Math.min(...metaVals) : 0;
const kirus = events.filter((e) => e.label.indexOf("KIRU") >= 0).length;
console.log("meta: cycles seen", cycles.length, "· distinct ARC_PERIODs", JSON.stringify(periods), "· metaPos range", +metaRange.toFixed(3), "· KIRUs", kirus);
console.log("meta trace:", cycles.map((c) => { const m = metaByCycle.get(c); return "c" + c + ":" + m.period + "s@" + m.metaPos; }).join(" "));

// ---- form vocabulary (Phase 1): kinds, seatings, scenes, joints, air ----
const formVocab = (() => {
  const count = (re, key) => { const m = {}; for (const e of events) { const x = re.exec(e.label + " · " + (e.detail || "")); if (x) m[x[1]] = (m[x[1]] || 0) + 1; } return m; };
  const kinds = count(/kind: ([a-z]+)/), scenes = count(/scene: ([a-z]+)/), joints = count(/joint: ([a-z ]+?) ·/);
  const seatings = {};
  for (const e of events) { const m = /seating: (.+?)(?: · scenes:|$)/.exec(e.detail || ""); if (m) seatings[m[1].trim()] = (seatings[m[1].trim()] || 0) + 1; }   // the whole seating string, named part included
  const nSeat = Object.keys(seatings).length, nKind = Object.keys(kinds).length;
  const oroshi = events.filter((e) => e.label.indexOf("oroshi") >= 0).length;
  const airInfo = runA.Z.getAirInfo ? runA.Z.getAirInfo() : null;
  console.log("form: kinds " + JSON.stringify(kinds) + " · scenes " + JSON.stringify(scenes) + " · joints " + JSON.stringify(joints) + " · oroshi " + oroshi);
  console.log("seatings (" + nSeat + " distinct): " + Object.keys(seatings).map((k) => k + "×" + seatings[k]).join(" | "));
  if (airInfo) console.log("air: attempts " + airInfo.attempts + " · grants " + airInfo.grants + " · denials " + airInfo.denials + " · overlap grants " + airInfo.overlapGrants + " (" + Math.round(100 * airInfo.denials / Math.max(1, airInfo.attempts)) + "% denied)");
  return { nKind, nSeat, kinds, seatings };
})();

// ---- node budget: creations per simulated minute + peak concurrent sources ----
(function nodeBudget() {
  const ns = runA.nodes;
  const perMin = ns.total / (RUN / 60);
  // peak concurrency of started sources (oscillators + buffer sources): sweep
  const evs = [];
  for (const s of ns.sources) { if (s.start != null && s.stop != null) { evs.push([s.start, 1]); evs.push([s.stop, -1]); } }
  evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let live = 0, peak = 0;
  for (const e of evs) { live += e[1]; if (live > peak) peak = live; }
  const kinds = Object.keys(ns.created).map((k) => k + ":" + ns.created[k]).join(" ");
  console.log("node budget: " + ns.total + " nodes created (" + perMin.toFixed(0) + "/min) · peak concurrent sources " + peak + " · " + kinds);
  runA.peakSources = peak;
})();

// ---- REPRO ----
function noteSig(r, windowS) {
  const out = [];
  for (const n of r.notes) { const rel = n.t - r.t0; if (rel > windowS) continue; out.push(n.layer + ":" + n.freq + ":" + (typeof n.dur === "number" ? n.dur.toFixed(6) : n.dur) + "@" + rel.toFixed(4)); }
  return out;
}
function evtSig(r, windowS) {
  const out = [];
  for (const e of r.events) { const rel = (e.t || 0) - r.t0; if (rel > windowS) continue; out.push(e.cat + ":" + e.label + ":" + (e.detail || "") + "@" + rel.toFixed(3)); }
  return out;
}
let reproSame = true, reproDiff = "";
{
  const wnd = RUN - 1;
  const nA = noteSig(runA, wnd), nB = noteSig(runB, wnd), eA = evtSig(runA, wnd), eB = evtSig(runB, wnd);
  if (nA.length !== nB.length || eA.length !== eB.length) { reproSame = false; reproDiff = "counts notes " + nA.length + "/" + nB.length + " events " + eA.length + "/" + eB.length; }
  else {
    for (let i = 0; i < nA.length; i++) if (nA[i] !== nB[i]) { reproSame = false; reproDiff = "note#" + i + " " + nA[i] + " vs " + nB[i]; break; }
    if (reproSame) for (let i = 0; i < eA.length; i++) if (eA[i] !== eB[i]) { reproSame = false; reproDiff = "evt#" + i + " " + eA[i] + " vs " + eB[i]; break; }
  }
  const wndC = CRUN - 20;
  const differs = noteSig(runA, wndC).join("\n") !== noteSig(runC, wndC).join("\n");
  console.log("REPRO: same seed twice → " + (reproSame ? "IDENTICAL ✓ (" + nA.length + " notes, " + eA.length + " events)" : "DIFFERENT ✗ " + reproDiff) +
    " · seed " + (SEED + 1) + " → " + (differs ? "different ✓" : "SAME ✗"));
  if (!differs) reproSame = false;
}

// ---- click-safety violations (recorded on the mock params) ----
const viol = {};
for (const v of VIOLATIONS) { const k = v.kind + " " + v.param; viol[k] = (viol[k] || 0) + 1; }
const violKeys = Object.keys(viol);
console.log("param violations: " + (violKeys.length ? violKeys.map((k) => k + "×" + viol[k]).join("; ") : "none ✓"));

console.log(errors.length ? "ERRORS (" + errors.length + "):\n  " + errors.slice(0, 20).join("\n  ") : "ERRORS: none ✓");

// ---- verdicts ----
const fails = [];
if (notes.length > 50 && inScale < notes.length) fails.push("scale adherence < 100%");
if (RUN >= 700 && stats.transforms.length < 6) fails.push("only " + stats.transforms.length + " transform types used");
if (RUN >= 700 && answers < 1) fails.push("no cross-voice answers");
if (RUN >= 700 && maxGen < 3) fails.push("max generation " + maxGen + " < 3");
if (RUN >= 1500 && periods.length < 2) fails.push("only " + periods.length + " distinct ARC_PERIOD(s) — per-cycle draw not working");
if (RUN >= 1500 && metaRange < 0.05) fails.push("meta drift range " + metaRange.toFixed(3) + " < 0.05 — meta-curve not traveling");
if (RUN >= 1500 && kirus < 1) fails.push("no KIRU");
// Phase 1 gates (plan §7): melodic density ≈ half the baseline (4 600–5 780 / 30 min → 2 300–2 900 ±);
// ≥ 3 cycle kinds and ≥ 2 seatings seen in an hour
const melPer30 = melodicNotes * 1800 / RUN;
if (RUN >= 1500 && (melPer30 < 1900 || melPer30 > 3300)) fails.push("melodic notes/30 min " + Math.round(melPer30) + " outside 1900–3300");
if (RUN >= 3600 && formVocab.nKind < 3) fails.push("only " + formVocab.nKind + " cycle kind(s) in " + RUN + "s");
if (RUN >= 3600 && formVocab.nSeat < 2) fails.push("only " + formVocab.nSeat + " seating(s) in " + RUN + "s");
if (!reproSame) fails.push("REPRO gate failed");
if (errors.length) fails.push(errors.length + " runtime errors");
console.log(fails.length ? "VERDICT: FAIL — " + fails.join("; ") : "VERDICT: PASS ✓");
process.exit(fails.length ? 1 : 0);

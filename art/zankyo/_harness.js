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
// --far d : force tonight's distance, the same door ?far= opens (rc.21). The
// harness could not reach a far night before this, which is how 継's NaN
// shipped: the ensemble departures are only drawn on seeds that draw them, and
// the fault check had never been run on one.
let FARD = null;
for (let ai = 4; ai < process.argv.length; ai++) if (process.argv[ai] === "--far") FARD = parseFloat(process.argv[++ai]);
if (FARD != null && !isFinite(FARD)) FARD = null;

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
// ---- AudioParam LOAD (rc.49) ----
// The instrument that was missing, and whose absence is why the wrong quantity
// was nearly capped. "AudioParam calls per second" is ambiguous and the two
// readings differ by an order of magnitude on a far night:
//   TARGET-second  — bucketed by the time the value is NEEDED. This is the
//                    automation density the audio graph carries, and it is the
//                    reading the owner's ~2 500/s cap is about. GATED below.
//   WRITTEN-second — bucketed by when the main thread made the call.
//   SINGLE TICK    — one timer callback. This is what stutters a phone, and
//                    before rc.49 a far night put 11 011 calls in ONE of them
//                    while the median tick held 78. Reported, not gated: the
//                    glide burst is gone, and what is left is note CONSTRUCTION
//                    (seed 65 far 0.95 peaks at 1 506, of which 778 are
//                    Gain.gain), which is a real number nobody has attacked yet
//                    and which a threshold here would only hide.
const PL = { tick: 0, cur: 0, curBy: null, perTick: [], byTarget: new Map(), byWritten: new Map(), worst: null, total: 0 };
function plHit(label, targetT) {
  PL.total++; PL.cur++;
  if (!PL.curBy) PL.curBy = new Map();
  PL.curBy.set(label, (PL.curBy.get(label) || 0) + 1);
  const tt = Math.floor(targetT != null && isFinite(targetT) ? targetT : vnow);
  PL.byTarget.set(tt, (PL.byTarget.get(tt) || 0) + 1);
  const wt = Math.floor(vnow);
  PL.byWritten.set(wt, (PL.byWritten.get(wt) || 0) + 1);
}
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
    PL.cur = 0; PL.curBy = null;
    try { tm.fn(); } catch (e) { errors.push("timer@" + vnow.toFixed(1) + "s: " + (e && e.message)); if (errors.length > 40) return; }
    if (PL.cur) { PL.perTick.push(PL.cur); if (!PL.worst || PL.cur > PL.worst.n) PL.worst = { n: PL.cur, t: vnow, by: PL.curBy }; }
    if (onStep) onStep();
  }
}

// ---- mock Web Audio (recording params, PJ2-harness lineage) ----
const VIOLATIONS = [];
function mkParam(ownerKind, label, initV) {
  const p = { value: initV != null ? initV : 0, _label: ownerKind + "." + label, _anchored: false, _lastV: initV != null ? initV : 0 };
  p.setValueAtTime = function (v, t) { plHit(p._label, t); p._anchored = true; p._lastV = v; p.value = v; return p; };
  p.linearRampToValueAtTime = function (v, t) {
    plHit(p._label, t);
    if (!p._anchored) VIOLATIONS.push({ kind: "linearRamp without anchor", param: p._label, v, t });
    p._anchored = true; p._lastV = v; p.value = v; return p;
  };
  p.exponentialRampToValueAtTime = function (v, t) {
    plHit(p._label, t);
    if (!p._anchored) VIOLATIONS.push({ kind: "exponentialRamp without anchor", param: p._label, v, t });
    if (!(v > 0)) VIOLATIONS.push({ kind: "exponentialRamp target <= 0", param: p._label, v, t });
    else if (!(p._lastV > 0)) VIOLATIONS.push({ kind: "exponentialRamp departing from <= 0", param: p._label, v: p._lastV, t });
    p._anchored = true; p._lastV = v; p.value = v; return p;
  };
  p.setTargetAtTime = function (v, t) { plHit(p._label, t); p._anchored = true; p._lastV = v; return p; };
  p.setValueCurveAtTime = function (curve, t) { plHit(p._label, t); p._anchored = true; if (curve && curve.length) p._lastV = curve[curve.length - 1]; return p; };
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
  ctx.createBufferSource = () => mkNode("BufferSource", { playbackRate: 1, detune: 0 }, { buffer: null, loop: false, loopStart: 0, loopEnd: 0 });
  ctx.createPeriodicWave = () => ({});
  ctx.createMediaElementSource = (el) => mkNode("MediaElementSource", {}, { mediaElement: el });
  return ctx;
}

// ---- the receiver's world (S1): a document with a <video>, a fetch that serves
// the real manifest — all on the virtual clock. ZK_SIGNAL_MOCK=ready (default:
// the reel is ready 0.3 s after prefetch) | slow (never ready → the gagaku
// fallback) | none (fetch fails → the fallback). Promises would only settle
// when the JS stack empties (after the whole run), so the mocks are
// synchronous thenables. ----
const SIGNAL_MOCK = process.env.ZK_SIGNAL_MOCK || "ready";
// ZK_REELS trims the pool to the named reels (comma-separated ids), or to the
// first N with ZK_REELS=n:<count>. §6's R1 gate wants the §12 sweep run on a
// FORCED SINGLE-REEL POOL as well as on the real one: with one reel the recent
// ring has nothing to fall back on, every candidate filter empties, and the
// degrade paths that are rarely reached become the only paths. That is exactly
// where a hold has previously been written for a reception that then could not
// be seated.
const MANIFEST_TEXT = (() => {
  let raw;
  // ZK_MANIFEST points at another manifest — the way to hear what the pool
  // WOULD do once §5's long windows exist, without cutting a single reel.
  try { raw = fs.readFileSync(process.env.ZK_MANIFEST || path.join(__dirname, "broadcast", "manifest.json"), "utf8"); } catch (e) { return "[]"; }
  const want = process.env.ZK_REELS;
  if (!want) return raw;
  try {
    const m = JSON.parse(raw), arr = Array.isArray(m) ? m : m.reels;
    let keep;
    if (/^n:\d+$/.test(want)) keep = arr.slice(0, parseInt(want.slice(2), 10));
    else { const ids = want.split(","); keep = arr.filter((e) => ids.indexOf(e.id) >= 0); }
    if (!keep.length) keep = arr.slice(0, 1);
    return JSON.stringify(Array.isArray(m) ? keep : Object.assign({}, m, { reels: keep }));
  } catch (e) { return raw; }
})();
function thenableOf(v) { return { then(f) { let r; try { r = f(v); } catch (e) { return failing(e); } return (r && typeof r.then === "function") ? r : thenableOf(r); }, catch() { return this; } }; }
function failing(err) { return { then() { return this; }, catch(f) { try { f(err); } catch (e) {} return this; } }; }
function mockVideo() {
  const latencyS = SIGNAL_MOCK === "slow" ? 600 : 0.3;
  const v = { src: "", preload: "none", muted: false, volume: 1, playsInline: false, crossOrigin: null, readyState: 0, duration: 96, paused: true, style: {}, _l: {}, _ct: 0, _plays: 0 };
  v.setAttribute = () => {}; v.addEventListener = (n, f) => { (v._l[n] = v._l[n] || []).push(f); }; v.removeEventListener = (n, f) => { if (v._l[n]) v._l[n] = v._l[n].filter((g) => g !== f); };
  const fire = (n) => { const L = v._l[n] || []; v._l[n] = []; for (const f of L) { try { f({ type: n }); } catch (e) {} } };
  Object.defineProperty(v, "currentTime", { get: () => v._ct, set: (x) => { v._ct = x; vSetTimeout(() => fire("seeked"), 40); } });
  v.load = () => { v.readyState = 0; vSetTimeout(() => { v.readyState = 1; fire("loadedmetadata"); vSetTimeout(() => { v.readyState = 4; fire("canplay"); }, 200); }, latencyS * 1000); };
  v.play = () => { v.paused = false; v._plays++; return thenableOf(undefined); };
  v.pause = () => { v.paused = true; };
  return v;
}
function mockDocument() { return { createElement: (tag) => tag === "video" ? mockVideo() : { style: {}, setAttribute() {}, appendChild() {} }, body: { appendChild() {} }, documentElement: { appendChild() {} } }; }
function mockFetch(url) { if (SIGNAL_MOCK === "none") return failing(new Error("offline")); return thenableOf({ ok: true, json: () => thenableOf(JSON.parse(MANIFEST_TEXT)) }); }

// ---- load the substrate + the engine, fresh per run ----
const PJ2_DIR = path.join(__dirname, "..", "prosperos-jukebox-v2");
const PJ2_MODULES = ["pj2-rand.js", "pj2-pitch.js", "pj2-clock.js", "pj2-voice.js", "pj2-fx.js", "pj2-air.js", "pj2-conductor.js"];
const SRC = {};
for (const m of PJ2_MODULES) SRC[m] = fs.readFileSync(path.join(PJ2_DIR, m), "utf8");
SRC.engine = fs.readFileSync(process.env.ZK_ENGINE || path.join(__dirname, "zankyo-audio.js"), "utf8");   // ZK_ENGINE: A/B an alternate build
// ZANKYŌ's own extensions (S0+): every zk-*.js index.php loads after the engine,
// in page order, the way _probe.js does — minus the viz-side zk-set.js (DOM only;
// it no-ops headless anyway). So zk-broadcast.js (S1) is under the harness too.
const ZK_EXT = (() => {
  try {
    const html = fs.readFileSync(path.join(__dirname, "index.php"), "utf8"), re = /<script[^>]+src="(zk-[^"?]+\.js)(?:\?[^"]*)?"/g, out = [];
    let m; while ((m = re.exec(html))) if (!/zk-set\.js$/.test(m[1])) out.push(m[1]);
    return out;
  } catch (e) { return []; }
})();
for (const m of ZK_EXT) SRC[m] = fs.readFileSync(path.join(__dirname, m), "utf8");

function loadEngine() {
  const W = { AudioContext: function () { return mkCtx(); } };
  global.window = W;
  global.PJ2 = W.PJ2 = {};
  global.location = undefined;
  global.document = W.document = mockDocument();
  global.fetch = W.fetch = mockFetch;
  for (const m of PJ2_MODULES) {
    try { (0, eval)(SRC[m]); } catch (e) { errors.push("LOAD " + m + ": " + e.message); }
  }
  try { (0, eval)(SRC.engine); } catch (e) { errors.push("LOAD zankyo-audio.js: " + e.message); }
  for (const m of ZK_EXT) { try { (0, eval)(SRC[m]); } catch (e) { errors.push("LOAD " + m + ": " + e.message); } }
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
  if (FARD != null && Z.setFar) Z.setFar(FARD);
  const R = { seed, simS, notes: [], events: [], arcSamples: [], metaByCycle: new Map(), t0: 0 };
  Z.setNoteListener((n) => { const F = Z.getField ? Z.getField() : null; R.notes.push({ t: n.startTime, layer: n.layer, freq: n.freq, dur: n.duration, tonic: F ? F.tonicHz : 146.83, steps: F ? (Z.getMode().offsets) : null }); });
  Z.setEventListener((e) => R.events.push({ t: e.t, cat: e.cat, label: e.label, detail: e.detail, sig: e.signal ? { t0: e.signal.t0, holdS: e.signal.holdS, lossD: e.signal.lossD, id: e.signal.id, rx: e.signal.rx || null } : null }));
  const SAMPLE_EVERY = 15;
  let nextSample = 0;
  const origCE = console.error;
  const swallowed = [];
  console.error = function () { swallowed.push(Array.prototype.join.call(arguments, " ")); };
  // S2: ZK_TUNE_AT=<seconds> presses 選局 TUNE (Z.tune) at that virtual time — the same press in every run, so REPRO holds
  const TUNE_AT = parseFloat(process.env.ZK_TUNE_AT || "0");
  try {
    Z.play();
    R.t0 = vnow;
    if (TUNE_AT > 0) vSetTimeout(() => { try { R.tunePressed = vnow; R.tuneResult = Z.tune(); } catch (e) { errors.push("tune: " + e.message); } }, TUNE_AT * 1000);
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

// ---- scale model for adherence checks: ERA-AWARE (Phase 2) — each note is
// judged against the field AS IT STOOD WHEN THE NOTE WAS SCHEDULED (tonic +
// mode captured at emit time), so a sea change mid-run is honoured and a
// straddling note (scheduled before the seam, sounding after) keeps its
// old-world truth. Any of the four modes on that tonic counts (the shō's
// aitake project onto the current mode; the bell rings the tonic).
const ALL_MODES = [[0,2,3,7,8],[0,1,5,7,8],[0,2,3,7,9],[0,1,5,6,10]];   // hirajoshi/insen/kumoi/iwato
function nearestCents(freq, tonic) {
  let best = 1e9;
  for (const M of ALL_MODES) {
    for (let i = -10; i <= 25; i++) {
      const semi = M[((i % 5) + 5) % 5] + 12 * Math.floor(i / 5);
      const f = (tonic || 146.83) * Math.pow(2, semi / 12);
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
PL.tick = 0; PL.total = 0; PL.perTick.length = 0; PL.byTarget.clear(); PL.byWritten.clear(); PL.worst = null;
const runA = runOnce(SEED, RUN);
const PL_A = { total: PL.total, perTick: PL.perTick.slice(), byTarget: new Map(PL.byTarget), byWritten: new Map(PL.byWritten), worst: PL.worst };
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
notes.forEach((n) => { const c = nearestCents(n.freq, n.tonic); if (c < 5) inScale++; else offNotes.push({ layer: n.layer, freq: Math.round(n.freq), cents: Math.round(c), tonic: Math.round(n.tonic) }); });
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
const MELODIC = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1, vox: 1 };   // the melodic voices: five at the S1 re-base, six with the intercom (2026-09-14 re-base)
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

// ---- pitch + melody vocabulary (Phase 2): sea changes, tonic trace, seed pool, aitake ----
const pitchVocab = (() => {
  const seas = events.filter((e) => (e.label + " " + (e.detail || "")).indexOf("sea change") >= 0);
  const pivots = events.filter((e) => e.cat === "mode" && /pivot/.test(e.detail || ""));
  const tonics = []; for (const n of notes) { const t = Math.round(n.tonic * 100) / 100; if (tonics.indexOf(t) < 0) tonics.push(t); }
  const pool = {};
  for (const e of events) if (e.label.indexOf("working set") >= 0) for (const part of (e.detail || "").split(" · ")) { const nm = part.replace(/^[イロハ] /, "").replace(/^inherited: /, "").replace(/·g\d+$/, ""); pool[nm] = (pool[nm] || 0) + 1; }
  const born = Object.keys(pool).filter((k) => k.indexOf("born: ") === 0).length;
  // aitake: group shō notes by shared t → semitone set above the lowest
  const byT = {}; for (const n of notes) if (n.layer === "sho") (byT[n.t.toFixed(4)] = byT[n.t.toFixed(4)] || []).push(n.freq);
  const voicings = {}; let clusters = 0;
  for (const k in byT) { const fs = byT[k].sort((a, b) => a - b); clusters++; const set = fs.map((f) => Math.round(12 * Math.log2(f / fs[0]))).join(","); voicings[set] = (voicings[set] || 0) + 1; }
  const aitakeNames = {}; for (const e of events) { const m = /^笙 (\S+) (\S+)/.exec(e.label); if (m) aitakeNames[m[2]] = (aitakeNames[m[2]] || 0) + 1; }
  console.log("pitch: sea changes " + seas.length + " [" + seas.map((e) => Math.round(e.t) + "s " + e.detail).join(" | ") + "] · pivots " + pivots.length + " · tonics seen " + JSON.stringify(tonics));
  console.log("melody: seed pool " + Object.keys(pool).length + " names (" + born + " born) · aitake " + Object.keys(voicings).length + " distinct voicings in " + clusters + " clusters · named " + JSON.stringify(aitakeNames));
  return { seas: seas.length, pool: Object.keys(pool).length, voicings: Object.keys(voicings).length };
})();

// ---- melodic DNA (road map §1, 2026-09-13): distinct phrases per hour, and the "have I heard this before" rate ----
// A phrase is a run of one melodic voice's notes with no gap over 0.9 s; its
// signature is the interval sequence in semitones plus each note's length as
// a multiple of the phrase's shortest note (half-steps), so a transposition
// or a re-registering is the same phrase and a re-rhythming is not. Only
// phrases of three notes or more count — two notes are not a thing to have
// heard before. HEARD-BEFORE is the share of phrases whose signature has
// already sounded earlier in the same run: the listener's question.
const phraseVocab = (() => {
  const MEL = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1, vox: 1 };
  const byLayerSeq = {};
  for (const n of notes) if (MEL[n.layer]) (byLayerSeq[n.layer] = byLayerSeq[n.layer] || []).push(n);
  const sigs = [], seen = {}, seenShape = {}; let repeats = 0, shapeRepeats = 0, longest = 0;
  for (const L in byLayerSeq) {
    const seq = byLayerSeq[L].sort((a, b) => a.t - b.t);
    let cur = [];
    const flush = () => {
      if (cur.length >= 3) {
        const minD = Math.max(0.05, Math.min(...cur.map((n) => n.dur)));
        const iv = [], rh = [];
        for (let i = 0; i < cur.length; i++) {
          if (i) iv.push(Math.round(12 * Math.log2(cur[i].freq / cur[i - 1].freq)));
          rh.push(Math.round(2 * cur[i].dur / minD) / 2);
        }
        const shape = iv.join(","), sig = shape + "|" + rh.join(",");
        if (seenShape[shape]) shapeRepeats++; seenShape[shape] = (seenShape[shape] || 0) + 1;   // the SHAPE: intervals alone — what a listener recognises across a re-rhythming
        if (seen[sig]) repeats++; seen[sig] = (seen[sig] || 0) + 1;
        sigs.push(sig); if (cur.length > longest) longest = cur.length;
      }
      cur = [];
    };
    for (let i = 0; i < seq.length; i++) {
      if (cur.length && seq[i].t - (cur[cur.length - 1].t + cur[cur.length - 1].dur) > 0.9) flush();
      cur.push(seq[i]);
    }
    flush();
  }
  const distinct = Object.keys(seen).length, perHour = distinct * 3600 / RUN, heardBefore = sigs.length ? repeats / sigs.length : 0;
  const shapes = Object.keys(seenShape).length, shapesPerHour = shapes * 3600 / RUN, shapeHeardBefore = sigs.length ? shapeRepeats / sigs.length : 0;
  const top = Object.keys(seenShape).sort((a, b) => seenShape[b] - seenShape[a]).slice(0, 3).map((k) => k + "×" + seenShape[k]);
  console.log("phrases: " + sigs.length + " (≥3 notes) · shapes " + shapes + " distinct (" + shapesPerHour.toFixed(0) + "/h) · heard-before by shape " + (100 * shapeHeardBefore).toFixed(1) +
    "% · with rhythm " + distinct + " distinct, heard-before " + (100 * heardBefore).toFixed(1) + "% · longest " + longest + " · most repeated shapes " + top.join(" ; "));
  if (process.env.ZK_SHAPES) { try { fs.writeFileSync(process.env.ZK_SHAPES, JSON.stringify({ seed: SEED, n: sigs.length, shapes: seenShape })); } catch (e) {} }   // for _harness-bank.js's cross-night measure
  return { n: sigs.length, distinct, perHour, heardBefore, shapes, shapesPerHour, shapeHeardBefore };
})();

// ---- visitations (Phase 4; §8.1 follow-up): never two BROADCASTS and never
// two GUESTS in a cycle — but a broadcast and one guest may share one, seated
// in different scenes. The broadcast became its own kind of visitation when
// the owner asked for one a cycle; before that, "never two in a cycle" and
// "never two of a kind" were the same sentence, and this gate encoded the
// version that is no longer true. ----
const visitVocab = (() => {
  const byName = {}, perCycleBc = {}, perCycleGuest = {};
  let cycleN = -1;
  for (const e of events) {
    const mc = /cycle (\d+)/.exec(e.detail || ""); if (e.cat === "mode" && mc && e.label.indexOf("mode") >= 0) cycleN = +mc[1];
    const mv = /visitation: ([a-z ]+?) ·/.exec(e.detail || "");
    if (mv) {
      byName[mv[1]] = (byName[mv[1]] || 0) + 1;
      const bucket = mv[1] === "the broadcast" ? perCycleBc : perCycleGuest;
      bucket[cycleN] = (bucket[cycleN] || 0) + 1;
    }
  }
  const perCycle = perCycleBc;
  const total = Object.values(byName).reduce((a, b) => a + b, 0);
  const maxPer = Math.max(0, ...Object.values(perCycleBc), ...Object.values(perCycleGuest));
  const kiruMaster = events.filter((e) => e.label.indexOf("KIRU") >= 0 && (e.detail || "").indexOf("landscape only") < 0).length;
  console.log("visitations: " + total + " in " + cycles.length + " cycles " + JSON.stringify(byName) + " · max of a kind per cycle " + maxPer + " · KIRUs not on the landscape: " + kiruMaster);
  return { total, maxPer, kiruMaster };
})();

// ---- the receiver (S1): signals per cycle, never two, never near a KIRU, the crew silent for the hold, the fallback when the reel is not ready ----
const signalVocab = (() => {
  const cycleStarts = events.filter((e) => e.label.indexOf("❁ cycle plan") >= 0).map((e) => e.t);
  const cycleOf = (t) => { let ci = -1; for (let q = 0; q < cycleStarts.length; q++) if (cycleStarts[q] <= t) ci = q; return ci; };
  const sigs = events.filter((e) => e.cat === "rx" && e.label === "受信" && e.sig);
  const fallbacks = events.filter((e) => e.cat === "rx" && e.label === "受信 fallback");
  const kiruTs = events.filter((e) => e.label.indexOf("KIRU") >= 0).map((e) => e.t);
  const perCycle = {}; for (const s of sigs) { const ci = cycleOf(s.sig.t0); perCycle[ci] = (perCycle[ci] || 0) + 1; }
  const maxPer = Math.max(0, ...Object.values(perCycle));
  let nearKiru = 0, notSilent = 0, overlaps = 0; const MEL = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1, vox: 1 };
  const intruders = [];
  for (const s of sigs) {
    // THE SPAN IS THE PLAN'S, not tune + hold + loss. A reception can carry an
    // entry of up to ten seconds and an exit of twelve now, so the old
    // arithmetic understated the window it was checking by up to twenty
    // seconds — which is exactly the part of a reception a gate must not miss.
    const t0 = s.sig.t0, rx = s.sig.rx || null;
    const tEnd = t0 + (rx ? rx.spanS : 0.4 + s.sig.holdS + s.sig.lossD);
    for (const k of kiruTs) if (k > t0 - 20 && k < tEnd + 15) nearKiru++;
    // §3.5 THE POROUS HOLD: one melodic voice may be left OUT of the hold and
    // play over the signal. Its notes are PERMITTED, not intrusions — but the
    // exemption is for that one named voice and no other, which is what makes
    // the count still worth reading.
    const por = rx && rx.porous;
    // §3.5 — TWO EXEMPTIONS, AND ONLY TWO. The hold used to be one block from
    // the first static to the last, so any melodic note inside it was an
    // intrusion. A reception that breaks and returns RELEASES the air where the
    // carrier is lost, and a porous reception leaves one named voice out of the
    // hold altogether — both deliberate, both the owner's ask. Everything else
    // inside a reception is still a fault, which is what keeps this gate worth
    // reading: the exemptions are for a named voice and for a named span, never
    // for "it was a shaped reception".
    const gapAt = (e) => {
      if (!rx) return false;
      for (let gi = 0; gi < rx.gaps.length; gi++) {
        const g = rx.gaps[gi], seg = rx.segments[gi + 1], gEnd = seg ? seg.atS : g.atS + g.durS;
        if (e >= g.atS && e < gEnd) return true;
      }
      return false;
    };
    for (const n of notes) {
      if (!(MEL[n.layer] || n.layer === "pa")) continue;
      if (n.t < t0 + 1 || n.t > tEnd) continue;
      if (por && n.layer === por) continue;
      if (gapAt(n.t - t0)) continue;
      notSilent++;
      if (intruders.length < 6) intruders.push(n.layer + " @" + n.t.toFixed(1) + " (" + (n.t - t0).toFixed(1) + "s into " + Math.round(t0) + "s" + (rx ? " · " + rx.body + "/" + rx.entry + "/" + rx.exit : "") + ")");
    }
  }
  // NO TWO RECEPTIONS ON THE AIR AT ONCE — the placement's job, asserted here
  // because the spacing is a drawn number now and not a constant.
  {
    const spans = sigs.map((s) => [s.sig.t0, s.sig.t0 + (s.sig.rx ? s.sig.rx.spanS : 0.4 + s.sig.holdS + s.sig.lossD)]).sort((a, b) => a[0] - b[0]);
    for (let q = 1; q < spans.length; q++) if (spans[q][0] < spans[q - 1][1]) overlaps++;
  }
  if (intruders.length) console.log("signal intrusions: " + intruders.join(" | "));
  if (process.env.ZK_INTRUDE && intruders.length) {
    const s0 = sigs.find((x) => notes.some((n) => (MEL[n.layer] || n.layer === "pa") && n.t >= x.sig.t0 + 1 && n.t <= x.sig.t0 + (x.sig.rx ? x.sig.rx.spanS : 13)));
    const t0 = s0.sig.t0, rx = s0.sig.rx;
    console.log("  intrusion context: t0 " + t0.toFixed(2) + " span " + (rx ? rx.spanS : "?") + " budget " + (rx ? rx.budgetS : "?"));
    for (const n of notes) if (n.t > t0 - 60 && n.t < t0 + 30 && (MEL[n.layer] || n.layer === "pa"))
      console.log("    " + n.layer + " t=" + n.t.toFixed(2) + " (" + (n.t - t0).toFixed(2) + ") dur=" + (n.dur || 0).toFixed(2));
  }
  // W4's placement numbers, printed because they are the gate on any change to
  // the seating or the footprint: broadcasts per cycle, how often a cycle gets
  // the PAIR it wanted, and how often it gets none at all.
  {
    const counts = [];
    for (let ci = 0; ci < cycleStarts.length; ci++) counts.push(perCycle[ci] || 0);
    const nPair = counts.filter((x) => x >= 2).length, nEmpty = counts.filter((x) => x === 0).length;
    const per = counts.length ? (counts.reduce((a, b) => a + b, 0) / counts.length) : 0;
    console.log("placement: " + per.toFixed(2) + " broadcasts/cycle · pair " + nPair + "/" + counts.length +
      (counts.length ? " (" + Math.round(100 * nPair / counts.length) + "%)" : "") +
      " · empty " + nEmpty + "/" + counts.length +
      (counts.length ? " (" + Math.round(100 * nEmpty / counts.length) + "%)" : "") +
      " · per-cycle " + JSON.stringify(counts));
  }
  // §4.1 — WHERE THE SEATING LOST ITS PICKS. The count per cycle is drawn from
  // the cycle's legal time now, so "wanted 4, seated 2" is the number that says
  // whether the frequency constant is doing anything or whether the room is.
  {
    const pl = runA.Z.getPlacement ? runA.Z.getPlacement() : null;
    if (pl && pl.seats) { const b = {}; for (const s2 of pl.seats) b[s2.body] = (b[s2.body] || 0) + 1;
      console.log("seating bodies (as SEATED, before the receiver's window): " + JSON.stringify(b)); }
    if (pl) console.log("seating: " + pl.total + " seated · lost " + pl.lost + " · overflow " + pl.overflow +
      " · jo " + Math.round(100 * pl.joShare) + "% (P " + pl.joP + ") · refused by: spacing " + pl.spacing + " guest " + pl.guest + " short " + pl.tooShort + " noT0 " + pl.noT0 +
      (pl.geom && pl.geom.length ? " · wanted/cycle " + JSON.stringify(pl.geom.map((g) => g.want)) : ""));
  }
  const hosted = events.filter((e) => /visitation: the broadcast/.test(e.detail || "")).length;
  const scans = events.filter((e) => e.cat === "rx" && e.label === "選局 scanning");
  if (runA.tunePressed != null) console.log("tune: pressed at " + Math.round(runA.tunePressed) + "s → " + runA.tuneResult + " · " + scans.map((e) => Math.round(e.t) + "s " + e.detail).join(" | ") + " · signals after the press: " + sigs.filter((x) => x.sig.t0 > runA.tunePressed).map((x) => Math.round(x.sig.t0) + "s " + x.sig.id).join(" | "));
  const ai = runA.Z.getAirInfo ? runA.Z.getAirInfo() : null;
  console.log("signal (" + SIGNAL_MOCK + "): " + sigs.length + " signals + " + fallbacks.length + " fallbacks in " + cycleStarts.length + " cycles (" + hosted + " hosted the broadcast) · " + (cycleStarts.length ? (3 * sigs.length / cycleStarts.length).toFixed(2) : "—") + " per 3 cycles · max per cycle " + maxPer + " · near a KIRU " + nearKiru + " · melodic/PA notes inside a hold " + notSilent + (ai ? " · hold denials " + ai.holdDenials : "") +
    (sigs.length ? " · " + sigs.slice(0, 5).map((s) => Math.round(s.sig.t0) + "s " + s.sig.id + " " + s.sig.holdS.toFixed(1) + "s").join(" | ") : "") + (fallbacks.length ? " · fallback: " + fallbacks[0].detail : ""));
  return { n: sigs.length, fallbacks: fallbacks.length, cycles: cycleStarts.length, maxPer, nearKiru, notSilent, hosted, overlaps, sigs };
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
  console.log("node budget: " + ns.total + " nodes created (" + perMin.toFixed(0) + "/min; base spread 791–2064, bound enforced on seeds 3042/7) · peak concurrent sources " + peak + " (≤ 110, every seed) · " + kinds);
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

// ---- the fault tally (rc.21): lanes that threw, notes that were not finite ----
// This gate exists because 継's takes handed four melodic bodies a NaN
// frequency from rc.15 to rc.21 — the winds threw "non-finite float" at an
// oscillator, the strings threw on createBuffer via N = round(sr / freq) — and
// every gate here passed, because the lane guard only wrote to the console and
// nothing read it. A thrown lane loses the rest of its phrase and goes quiet
// until something re-arms it; that is a listener-facing fault and it must not
// be possible to ship one again. Any count fails, on any seed.
let FAULTS = { lanes: 0, notes: 0, lane: [], note: [] };
try { FAULTS = (runA && runA.Z && runA.Z.getFaults) ? runA.Z.getFaults() : FAULTS; } catch (e) {}
if (FAULTS.lanes || FAULTS.notes) {
  console.log("FAULTS: " + FAULTS.lanes + " lane throw(s), " + FAULTS.notes + " non-finite note(s)");
  FAULTS.lane.forEach((f) => console.log("  lane " + f.lane + " @" + f.t + "s — " + f.msg));
  FAULTS.note.forEach((f) => console.log("  note " + f.layer + " freq=" + f.freq + " t=" + f.t + " dur=" + f.dur));
} else console.log("faults: no lane threw, every scheduled note finite ✓");
// THE ARM LEAD MUST OUTREACH THE VOICES. A body that commits a note further
// ahead than the air hold is written schedules something the hold cannot yet
// refuse — plan §12, exactly. The relation was a comment justified by a
// measured maximum (35.55 s worst, against a 55 s lead); measured maxima drift
// when a slower body or a further-reaching time departure is added, and §12
// would re-open silently on the nights that draw it. Compared against the
// ENGINE'S OWN constant rather than a copy, so the two cannot disagree.
// THE CONSTANT IS NOT THE LEAD. arm() is scheduled at
// Math.max(t0c + 0.05, at - BC_ARM_LEAD_S) — CLAMPED to the cycle start, not
// rejected — so a broadcast early in its cycle arms with less than 55 s of
// lead. Measured on 14 seeds at 1 h, 48.1 % of broadcasts sit closer than 55 s
// to their cycle start, the earliest at 8.2 s. Asserting against the engine's
// CONSTANT could not see that: it is the shape of gate that cannot fail.
// armLeadMinS is the smallest lead ACTUALLY used, and the assertion below now
// binds on it.
const ARM_EFF = FAULTS.armLeadMinS != null ? FAULTS.armLeadMinS : FAULTS.armLeadS;
if (FAULTS.armLeadS && FAULTS.maxLead) {
  const marg = ARM_EFF - FAULTS.maxLead;
  console.log("commit lead: worst " + FAULTS.maxLead.toFixed(2) + "s (" + FAULTS.maxLeadLayer +
    ") against the SMALLEST arm lead actually used " + ARM_EFF.toFixed(2) + "s (constant " + FAULTS.armLeadS +
    "s) — margin " + marg.toFixed(2) + "s" + (marg > 0 ? " ✓" : " ✗") +
    (FAULTS.paLead > FAULTS.armLeadS ? "   [PA reaches " + FAULTS.paLead.toFixed(1) + "s — 回線 bulk-schedules; not asserted, see §12 note]" : ""));
}

// ---- verdicts ----
const fails = [];
if (FAULTS.lanes) fails.push(FAULTS.lanes + " lane throw(s) — " + FAULTS.lane.map((f) => f.lane + ": " + f.msg).slice(0, 3).join(" | "));
if (FAULTS.notes) fails.push(FAULTS.notes + " note(s) scheduled with a non-finite freq/time/duration");
if (FAULTS.armLeadS && FAULTS.maxLead >= ARM_EFF)
  fails.push("a voice committed " + FAULTS.maxLead.toFixed(2) + "s ahead (" + FAULTS.maxLeadLayer +
    "), beyond the SMALLEST arm lead actually used (" + ARM_EFF.toFixed(2) + "s; constant " + FAULTS.armLeadS +
    "s) — the air hold cannot refuse a note that early (plan §12)");
// Scale adherence is a HOME gate. 耳 bends the koto off the grid by ear, 減
// narrows semitone pairs toward quarter-tones, 螺 spirals the whole field —
// leaving the scale is what the far tail IS, so the check only binds at home.
//
// AND "HOME" MEANS THE NIGHT, NOT THE FLAG. rc.21 keyed this to whether --far
// was passed, which is wrong for the obvious reason: a seed can be far without
// being told to be. Seed 19 draws d 0.94 naturally (崩 重 多 鏡) and was failing
// this gate on its own lottery, with no flag in sight.
const NIGHT_HOME = (() => { try { return !!(runA && runA.Z && runA.Z.getFar && runA.Z.getFar().home); } catch (e) { return FARD == null; } })();
if (NIGHT_HOME && notes.length > 50 && inScale < notes.length) fails.push("scale adherence < 100%");
else if (!NIGHT_HOME && notes.length > 50 && inScale < notes.length) console.log("scale adherence: " + inScale + "/" + notes.length + " (far night — off-grid is the departure, not a fault)");
if (RUN >= 700 && stats.transforms.length < 6) fails.push("only " + stats.transforms.length + " transform types used");
if (RUN >= 700 && answers < 1) fails.push("no cross-voice answers");
if (RUN >= 700 && maxGen < 3) fails.push("max generation " + maxGen + " < 3");
if (RUN >= 1500 && periods.length < 2) fails.push("only " + periods.length + " distinct ARC_PERIOD(s) — per-cycle draw not working");
if (RUN >= 1500 && metaRange < 0.05) fails.push("meta drift range " + metaRange.toFixed(3) + " < 0.05 — meta-curve not traveling");
if (RUN >= 1500 && kirus < 1) fails.push("no KIRU");
// Phase 1 gates (plan §7): melodic density ≈ half the baseline (4 600–5 780 / 30 min → 2 300–2 900 ±);
// ≥ 3 cycle kinds and ≥ 2 seatings seen in an hour
const melPer30 = melodicNotes * 1800 / RUN;
// HISTORY. The floor has been 1700, then 1650, then my proportional 1500,
// each calibrated against a handful of seeds. I briefly wrote here that the
// critic's two probe distributions (1084–4191 before the re-base, 1015–4019
// after) corroborated the 6–8 % melodic cost of the second broadcast, because
// the numbers fell by about the right amount. THAT WAS WRONG AND IS WITHDRAWN:
// the probe's fetch mock never resolves, so in every probe run all seven
// broadcasts fall back and NOT ONE holds the air. A second broadcast costs
// essentially nothing there, so that drop cannot be evidence for its cost. I
// read a real-looking number as confirmation of a mechanism the instrument is
// structurally unable to show — the same fault as a band that cannot fail.
//
// CANON_SEED survives the density rewrite because the NODE BUDGET below still
// uses it, and for the same reason the old density band did: it is a
// regression bound on the two seeds the harness habitually runs, not an engine
// invariant. On 3042 a move really would mean something changed; read as an
// invariant across all seeds it sends people chasing phantoms.
var CANON_SEED = (SEED === 3042 || SEED === 7);
// ============================================================================
// MELODIC DENSITY — MEASURED ON THIS INSTRUMENT, WITH THE REELS PLAYING
// ============================================================================
// The critic derived a floor from their 36 home nights (min 1015, p5 1280,
// median 2246, max 4019) and handed it to me to set here. It does not
// transfer, and finding out why is the most important thing in this block.
//
// THEIR PROBE AND THIS HARNESS WERE MEASURING DIFFERENT BUILDS. _probe.js
// mocks fetch as { then: () => this }, a thenable whose callback is never
// invoked, so the reel manifest never arrives: every broadcast falls back and
// none holds the air. Over 1800 s on seed 104 the probe logs seven 受信, all
// seven "fallback", and zero 消失. This harness serves the real manifest, so
// the same seven broadcasts play and hold. Setting ZK_SIGNAL_MOCK=none here
// reproduces the probe EXACTLY on all five seeds tried — 104, 132, 107, 3042,
// 7 give 1015 / 1280 / 1488 / 2402 / 2204 against the probe's identical
// figures — which isolates the manifest as the only difference between the two
// instruments and confirms this engine has not drifted from their base.
//
// The air-hold is therefore worth 0.7–13.2 % of melodic notes, and the probe
// cannot see any of it. That is a live blind spot in the critic's base, not a
// point about this floor: the re-base was run to price two broadcasts a cycle,
// and on that instrument two broadcasts cost nothing.
//
// So the numbers below are mine, measured with reels playing on the critic's
// own 40-seed list at 1800 s. The home/far split agrees with theirs exactly —
// 36 home, 4 far — so we are classifying the same nights. Home density runs
// 895 to 3980, median 1986. The floor is 800: about ten percent below the
// observed minimum, the same margin they reasoned for. Their 900 would fail
// seed 104 at 895, an honest sparse home night.
//
// THE LENGTH IS PART OF THE GATE. Seed 3042 reads 2385 at 1800 s and 1647 at
// 7200 s; a bound without its length compares two things that were never
// comparable. So does the reel state, for exactly the reason above — the gate
// binds only when both match the base and merely reports otherwise.
//
// THE PER-SEED BAND IS THE DISCRIMINATING GATE, and _harness-base.json carries
// the per-seed densities for it. A single floor cannot work across a fourfold
// honest spread: it is either too low to catch a regression on a dense seed or
// too high to pass a sparse one.
//
// ±20 % IS NOT AN ERROR BAR. This instrument is exactly repeatable — three
// runs each on seeds 104, 3042 and 7 returned identical counts, spread zero —
// so the width is a policy choice about how large a musical change should stop
// a build, and a uniform 15 % drop would pass on every seed. Because the
// instrument is exact, any deviation at all is reported even when it passes;
// silence means the number is unchanged to the note.
const DENS_FLOOR = 800, DENS_CEIL = 4400, DENS_BAND = 0.20;
// The ceiling is mine and nobody ruled it: a runaway density is as much a
// regression as a stalled one, but 4400 is only the observed max of 3980 plus
// about ten percent. It is a number chosen to sit above the data I have, which
// is the shape of constant we have agreed to name rather than let pass as a
// measurement. The per-seed band bounds both directions honestly.
let dBase = null;
try { dBase = JSON.parse(fs.readFileSync(path.join(__dirname, "_harness-base.json"), "utf8")); } catch (e) {}
if (notes.length > 50) {
  const bm = dBase && dBase.meta;
  const sameLen = bm && Math.abs(RUN - bm.runS) < 1;
  const sameReels = bm && SIGNAL_MOCK === bm.signalMock;
  const banked = dBase && dBase.seedDensity ? dBase.seedDensity[String(SEED)] : null;
  const d = Math.round(melPer30);
  // A --far override is a different night from the one banked, and on a far
  // night an extreme density IS the departure: seed 89 at d 0.95 draws 19
  // melodic notes (沈) and seed 1047 draws 8316 (群). Both are the work
  // succeeding. The home distribution has no authority over them, exactly as
  // the scale-adherence gate above defers on a far night.
  const why = !sameLen ? RUN + "s vs the base's " + (bm ? bm.runS : "?") + "s"
    : !sameReels ? "reels '" + SIGNAL_MOCK + "' vs the base's '" + (bm ? bm.signalMock : "?") + "'"
    : FARD != null ? "--far " + FARD + " is not the night the base drew for this seed" : null;
  if (why) {
    console.log("melodic density: " + d + " — not asserted (" + why +
      "); a bound from the base would not be comparing like with like");
  } else if (banked != null) {
    const off = (d - banked) / banked;
    if (d === banked) console.log("melodic density: " + d + " — exactly this seed's banked value ✓");
    else console.log("melodic density: " + d + " vs this seed's banked " + banked + " (" +
      (off >= 0 ? "+" : "") + (off * 100).toFixed(1) + "%) — this instrument is exactly repeatable, so something changed" +
      (Math.abs(off) > DENS_BAND ? " ✗" : " (inside the ±" + Math.round(DENS_BAND * 100) + "% band)"));
    if (Math.abs(off) > DENS_BAND)
      fails.push("melodic notes/30 min " + d + " is " + (off >= 0 ? "+" : "") + (off * 100).toFixed(1) +
        "% from seed " + SEED + "'s banked " + banked + " at " + RUN + "s (band ±" + Math.round(DENS_BAND * 100) + "%)");
  } else {
    console.log("melodic density: " + d + " at " + RUN + "s — seed not in the base, floor only " +
      "(home spread " + bm.homeMin + "-" + bm.homeMax + " over " + bm.homeSeeds + " seeds)" +
      (NIGHT_HOME ? "" : " — far night, reported not asserted"));
    if (NIGHT_HOME && (d < DENS_FLOOR || d > DENS_CEIL))
      fails.push("melodic notes/30 min " + d + " outside " + DENS_FLOOR + "-" + DENS_CEIL + " at " + RUN + "s");
  }
}
if (RUN >= 3600 && formVocab.nKind < 3) fails.push("only " + formVocab.nKind + " cycle kind(s) in " + RUN + "s");
if (RUN >= 3600 && formVocab.nSeat < 2) fails.push("only " + formVocab.nSeat + " seating(s) in " + RUN + "s");
// Phase 2 gates (plan §7): ≥ 1 sea change per hour; seed pool ≥ 12 over a long run; ≥ 8 distinct aitake voicings
if (RUN >= 3600 && pitchVocab.seas < 1) fails.push("no sea change in " + RUN + "s");
if (RUN >= 7200 && pitchVocab.pool < 12) fails.push("seed pool " + pitchVocab.pool + " < 12");
if (RUN >= 1500 && pitchVocab.voicings < 8) fails.push("only " + pitchVocab.voicings + " distinct aitake voicings");
// Phase 3 gates: node budget ≤ 1 500/min and ≤ 110 concurrent sources (the critic's ceilings); every new body heard in an hour
// Same: base spread 791–2064/min, NINE of thirty-six home nights over 1500.
// (The runtime gate for the far tail is already same-seed relative after the
// W2a ruling — far ≤ its own home × 1.5 — which is the shape this one would
// take if the harness had a reference build to compare against; it does not,
// so it is scoped instead.)
if (CANON_SEED && runA.nodes.total / (RUN / 60) > 1500) fails.push("node budget " + Math.round(runA.nodes.total / (RUN / 60)) + "/min > 1500 (regression bound, seeds 3042/7; base spread 791–2064)");
// This one IS an invariant and stays absolute on every seed: the base's max
// over the same 36 nights is 100, and nothing in the far tail may exceed 110.
// It is the constraint 群 and 雲 were designed against.
if (runA.peakSources > 110) fails.push("peak concurrent sources " + runA.peakSources + " > 110");
if (RUN >= 3600) for (const L of ["hichiriki", "biwa", "pa", "furin", "vox"]) if (!byLayer[L]) fails.push("no " + L + " notes in " + RUN + "s");
// The bank line: `ZK_BANK=1 node _harness.js 1800 <seed>` prints one JSON line
// for _harness-bank.js to gather into _harness-base.json (the deliberate re-base).
if (process.env.ZK_BANK) console.log("BANK " + JSON.stringify({ seed: SEED, home: NIGHT_HOME, density: Math.round(melPer30), shapesPerHour: Math.round(phraseVocab.shapesPerHour), shapeHeardBefore: +phraseVocab.shapeHeardBefore.toFixed(3) }));
// Road map §1's gate, at an hour on a home night: the vocabulary must not
// collapse — ≥ 250 distinct shapes an hour and under a third of phrases a
// shape already heard tonight. Measured before the DNA work: ~490–560 shapes/h
// and 5–6 % by full signature; the shape rate is the listener's number.
if (RUN >= 3600 && NIGHT_HOME && phraseVocab.n > 50) {
  if (phraseVocab.shapesPerHour < 250) fails.push("only " + Math.round(phraseVocab.shapesPerHour) + " distinct phrase shapes/h (< 250)");
  if (phraseVocab.shapeHeardBefore > 0.34) fails.push("heard-before by shape " + Math.round(100 * phraseVocab.shapeHeardBefore) + "% (> 34%)");
}
// Phase 4 gates (plan §7): ≥ 1 visitation per 3 cycles over 4 h; never two in one cycle; the KIRU lives on the landscape cut
if (visitVocab.maxPer > 1) fails.push("two of a kind in one cycle (two broadcasts, or two guests)");
if (RUN >= 14000 && visitVocab.total < Math.floor(cycles.length / 3)) fails.push("visitations " + visitVocab.total + " < " + Math.floor(cycles.length / 3) + " (one per 3 cycles)");
if (visitVocab.kiruMaster > 0) fails.push(visitVocab.kiruMaster + " KIRU(s) not on the landscape cut");
// S1 gates (PLAN-SIGNAL-INTEGRATION §1 S1): never two per cycle, never in a KIRU, the melodic voices silent for the hold,
// ≈ 1 per 3 cycles over 4 h (0.7–1.6) when the reel is ready; the fallback fires when it is not
// PER CYCLE IS NO LONGER THE QUANTITY (PLAN-SIGNAL-SHAPES §4.1, §6). The count
// is drawn from the cycle's LEGAL TIME now, and cycles run five to ten minutes,
// so "max two a cycle" was a gate on a design that no longer exists: a
// ten-minute cycle legitimately holds six receptions where a five-minute one
// holds three. What is still a fault is a count the seating could not have
// produced — that would mean the visitation seam is firing broadcasts as well
// as the drawn times, which is exactly what happened on the first pass of §8.1.
// So the rail is the seating's own ceiling and the REAL gate is the per-hour
// rate below.
const BC_RAIL = 8;
if (signalVocab.maxPer > BC_RAIL) fails.push(signalVocab.maxPer + " signals in one cycle (the seating's ceiling is " + BC_RAIL + ")");
if (signalVocab.nearKiru > 0) fails.push(signalVocab.nearKiru + " signal(s) within a KIRU's reach");
if (signalVocab.notSilent > 0) fails.push(signalVocab.notSilent + " melodic note(s) inside a signal's hold");
// NO TWO RECEPTIONS ON THE AIR AT ONCE. The spacing is a drawn 15–90 s now
// rather than a constant 95, and two overlapping receptions would mean one
// media element playing two reels — audible as a cut, and invisible to every
// other gate here.
if (signalVocab.overlaps > 0) fails.push(signalVocab.overlaps + " overlapping reception(s)");
// §2 THE FLOOR: a reception is at least 8 s on air, summed over its pieces.
// It can only be broken by a reel whose longest window cannot serve it, and
// choose() filters those out of the candidate set — so this is the gate on that
// filter. It reports rather than fails where the pool genuinely cannot serve
// the floor (a one-reel bench pool), because then the floor yielding is the
// right answer and a silent night is not.
{
  const pres = signalVocab.sigs.map((x) => x.sig.rx ? x.sig.rx.presenceS : x.sig.holdS);
  if (pres.length) {
    const lo = Math.min(...pres), hi = Math.max(...pres);
    const sorted = pres.slice().sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    const asked = signalVocab.sigs.map((x) => (x.sig.rx && x.sig.rx.budgetS) || null).filter((x) => x != null);
    const askMed = asked.length ? asked.slice().sort((a, b) => a - b)[asked.length >> 1] : null;
    // §2's table, ASKED against ACHIEVED. Until the reels are re-cut (§5) every
    // budget over about 11.6 s degrades to what a 12 s window can serve, so
    // these two columns are the measure of how far the pool is from the owner's
    // spread — reported, never gated, because the reels are the answer.
    const BUCKETS = [[8, 12], [12, 18], [18, 25], [25, 32], [32, 41]];
    const cnt = (arr) => BUCKETS.map(([lo2, hi2]) => arr.filter((v) => v >= lo2 && v < hi2).length);
    console.log("on air: " + pres.length + " receptions · min " + lo.toFixed(1) + " median " + med.toFixed(1) + " max " + hi.toFixed(1) + " s" +
      (askMed != null ? " · asked median " + askMed.toFixed(1) + " s" : "") +
      " · achieved " + JSON.stringify(cnt(pres)) + " vs asked " + JSON.stringify(cnt(asked)) + " over [8–12, 12–18, 18–25, 25–32, 32–40]");
    if (lo < 8.0 - 0.05) fails.push("a reception held the air for only " + lo.toFixed(1) + " s (the §2 floor is 8.0)");
  }
}
// §6 R2 — THE SHAPES LINE. What ARRIVED, by body, entry and exit, against the
// weights in §3.6; which rungs of the degrade ladder were taken and how often;
// and the two structural assertions a shaped reception can fail silently.
if (signalVocab.sigs.length) {
  const rx = signalVocab.sigs.map((x) => x.sig.rx).filter(Boolean);
  if (rx.length) {
    const tally = (f) => { const o = {}; for (const r of rx) o[f(r)] = (o[f(r)] || 0) + 1; return o; };
    const fell = {}; for (const r of rx) for (const f of (r.fell || [])) fell[f] = (fell[f] || 0) + 1;
    const nCall = rx.filter((r) => r.callback).length, nPor = rx.filter((r) => r.porous).length;
    console.log("shapes: body " + JSON.stringify(tally((r) => r.body)) + " · entry " + JSON.stringify(tally((r) => r.entry)) +
      " · exit " + JSON.stringify(tally((r) => r.exit)) + " · 同 callback " + nCall + " · 尺 porous " + nPor +
      " · degraded " + JSON.stringify(fell) + " of " + rx.length);
    // A PIECE MUST NOT OVERLAP THE ONE BEFORE IT, and a gap must sit between
    // them. Cheap to assert, impossible to hear as anything but a glitch.
    let badSeg = 0;
    for (const r of rx) for (let i = 1; i < r.segments.length; i++) {
      const prev = r.segments[i - 1];
      if (r.segments[i].atS < prev.atS + prev.onS + (prev.holeS || 0) - 1e-6) badSeg++;
    }
    if (badSeg) fails.push(badSeg + " reception(s) with overlapping pieces");
    // 戻 THE RETURN IS ALWAYS LATER IN THE SOURCE. This is the promise the body
    // makes — "the transmission went on while we lost it" — and the one thing
    // that would make it a lie is an in-point that went backwards.
    let badBack = 0;
    for (const r of rx) if (r.body === "modori") for (let i = 1; i < r.segments.length; i++) {
      const a2 = r.segments[i - 1], b2 = r.segments[i];
      if (a2.reel === b2.reel && b2.inS <= a2.inS) badBack++;
    }
    if (badBack) fails.push(badBack + " return(s) whose second piece was not later in the source");
    // §3.5 — DOES THE AIR ACTUALLY OPEN? Two counts, because both are claims
    // this phase makes and neither is visible in the silence gate above:
    //   OVER   the permitted voice's notes over a porous signal. If this is 0
    //          the feature is declared and inert.
    //   IN-GAP notes by any melodic voice inside a carrier-lost gap — the crew
    //          coming in where the station is not.
    //   RAN-IN a note that started in a gap and was still sounding when the
    //          signal came back. The footprint test is supposed to make this
    //          impossible; it is counted rather than assumed, so §3.5's
    //          fallback would be a measured decision and not a guess.
    let over = 0, inGap = 0, ranIn = 0;
    const MELP = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1, vox: 1, pa: 1 };
    for (const s of signalVocab.sigs) {
      const t0 = s.sig.t0, r = s.sig.rx; if (!r) continue;
      for (const n of notes) {
        if (!MELP[n.layer]) continue;
        const e = n.t - t0; if (e < 0 || e > r.spanS) continue;
        if (r.porous && n.layer === r.porous) over++;
        for (let gi = 0; gi < r.gaps.length; gi++) {
          const g = r.gaps[gi], seg = r.segments[gi + 1], gEnd = seg ? seg.atS : g.atS + g.durS;
          if (e >= g.atS && e < gEnd) { inGap++; if (e + (n.dur || 0) > gEnd) ranIn++; }
        }
      }
    }
    console.log("the air: 尺 " + over + " note(s) over a porous signal · " + inGap + " in a carrier-lost gap · " + ranIn + " ran into the relock");
    if (ranIn > 0) fails.push(ranIn + " note(s) ran from a gap into the relock");
  }
}
// THE FREQUENCY, AS A RATE PER HOUR. §7 q3: "signals 75 % more frequent than
// today". rc.68 seats 88 over six seeds at an hour (3042 16, 17 13, 7 14,
// 8891 15, 101 15, 102 15) — a mean of 14.7 — so 1.75× is 25.7 an hour, and
// §6's gate is that ± 15 %: 21.8 to 29.5. Per-seed, because the spread across
// seeds is real (13 to 16 on rc.68) and a mean over one seed is not a mean.
if (SIGNAL_MOCK === "ready" && RUN >= 3600) {
  const perH = signalVocab.n * 3600 / RUN;
  console.log("signals/hour: " + perH.toFixed(1) + " (rc.68 mean 14.7 · 1.75× = 25.7 · gate 21.8–29.5)");
  if (perH < 21.8 || perH > 29.5) fails.push("signals " + perH.toFixed(1) + "/hour outside 21.8–29.5 (1.75× rc.68 ± 15 %)");
}
if (SIGNAL_MOCK === "ready" && RUN >= 14000 && signalVocab.fallbacks > 0) fails.push(signalVocab.fallbacks + " fallback(s) with the reel ready");
if (SIGNAL_MOCK !== "ready" && signalVocab.hosted > 0 && signalVocab.n > 0) fails.push("a signal played with the reel unavailable");
if (SIGNAL_MOCK !== "ready" && signalVocab.hosted > 0 && signalVocab.fallbacks < 1) fails.push("no fallback fired with the reel unavailable");
// ---- the param-load line + the density gate ----
{
  const mx = (m) => Math.max(0, ...m.values());
  // t=0 is construction, not play: the whole graph is built in one go there and
  // it has always been so. The gate is about a performance.
  const tgt = [...PL_A.byTarget.entries()].filter(([k]) => k > 0), wr = [...PL_A.byWritten.entries()].filter(([k]) => k > 0);
  const tgtPeak = Math.max(0, ...tgt.map((e) => e[1])), wrPeak = Math.max(0, ...wr.map((e) => e[1]));
  const pt = PL_A.perTick.slice().sort((a, b) => a - b);
  const q = (f) => pt.length ? pt[Math.min(pt.length - 1, Math.floor(pt.length * f))] : 0;
  const w = PL_A.worst;
  const wby = w && w.by ? [...w.by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => k + " " + v).join(", ") : "";
  console.log("param load: density (by time-of-need) peak " + tgtPeak + "/s ≤ 2500 " + (tgtPeak <= 2500 ? "✓" : "✗") +
    " · written peak " + wrPeak + "/s · worst single tick " + (w ? w.n : 0) + " @" + (w ? w.t.toFixed(1) : "0") + "s [" + wby + "]" +
    " · tick p50 " + q(0.5) + " p99 " + q(0.99));
  if (tgtPeak > 2500) fails.push("AudioParam density " + tgtPeak + "/s over 2500 (measured by time-of-need)");
}
if (!reproSame) fails.push("REPRO gate failed");
if (errors.length) fails.push(errors.length + " runtime errors");
console.log(fails.length ? "VERDICT: FAIL — " + fails.join("; ") : "VERDICT: PASS ✓");
process.exit(fails.length ? 1 : 0);

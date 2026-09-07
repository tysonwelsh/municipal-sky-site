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
const MANIFEST_TEXT = (() => { try { return fs.readFileSync(path.join(__dirname, "broadcast", "manifest.json"), "utf8"); } catch (e) { return "[]"; } })();
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
  Z.setEventListener((e) => R.events.push({ t: e.t, cat: e.cat, label: e.label, detail: e.detail, sig: e.signal ? { t0: e.signal.t0, holdS: e.signal.holdS, lossD: e.signal.lossD, id: e.signal.id } : null }));
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
const MELODIC = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1 };   // all five melodic voices (S1 re-base, orchestrator ruling)
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
  let nearKiru = 0, notSilent = 0; const MEL = { shakuhachi: 1, koto: 1, shamisen: 1, hichiriki: 1, biwa: 1 };
  for (const s of sigs) {
    const t0 = s.sig.t0, tEnd = t0 + 0.4 + s.sig.holdS + s.sig.lossD;
    for (const k of kiruTs) if (k > t0 - 20 && k < tEnd + 15) nearKiru++;
    for (const n of notes) if ((MEL[n.layer] || n.layer === "pa") && n.t >= t0 + 1 && n.t <= tEnd) notSilent++;   // the PA counts too (critic S1 r1)
  }
  const hosted = events.filter((e) => /visitation: the broadcast/.test(e.detail || "")).length;
  const scans = events.filter((e) => e.cat === "rx" && e.label === "選局 scanning");
  if (runA.tunePressed != null) console.log("tune: pressed at " + Math.round(runA.tunePressed) + "s → " + runA.tuneResult + " · " + scans.map((e) => Math.round(e.t) + "s " + e.detail).join(" | ") + " · signals after the press: " + sigs.filter((x) => x.sig.t0 > runA.tunePressed).map((x) => Math.round(x.sig.t0) + "s " + x.sig.id).join(" | "));
  const ai = runA.Z.getAirInfo ? runA.Z.getAirInfo() : null;
  console.log("signal (" + SIGNAL_MOCK + "): " + sigs.length + " signals + " + fallbacks.length + " fallbacks in " + cycleStarts.length + " cycles (" + hosted + " hosted the broadcast) · " + (cycleStarts.length ? (3 * sigs.length / cycleStarts.length).toFixed(2) : "—") + " per 3 cycles · max per cycle " + maxPer + " · near a KIRU " + nearKiru + " · melodic/PA notes inside a hold " + notSilent + (ai ? " · hold denials " + ai.holdDenials : "") +
    (sigs.length ? " · " + sigs.slice(0, 5).map((s) => Math.round(s.sig.t0) + "s " + s.sig.id + " " + s.sig.holdS.toFixed(1) + "s").join(" | ") : "") + (fallbacks.length ? " · fallback: " + fallbacks[0].detail : ""));
  return { n: sigs.length, fallbacks: fallbacks.length, cycles: cycleStarts.length, maxPer, nearKiru, notSilent, hosted };
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
if (FAULTS.armLeadS && FAULTS.maxLead) {
  const marg = FAULTS.armLeadS - FAULTS.maxLead;
  console.log("commit lead: worst " + FAULTS.maxLead.toFixed(2) + "s (" + FAULTS.maxLeadLayer +
    ") against an arm lead of " + FAULTS.armLeadS + "s — margin " + marg.toFixed(2) + "s" + (marg > 0 ? " ✓" : " ✗") +
    (FAULTS.paLead > FAULTS.armLeadS ? "   [PA reaches " + FAULTS.paLead.toFixed(1) + "s — 回線 bulk-schedules; not asserted, see §12 note]" : ""));
}

// ---- verdicts ----
const fails = [];
if (FAULTS.lanes) fails.push(FAULTS.lanes + " lane throw(s) — " + FAULTS.lane.map((f) => f.lane + ": " + f.msg).slice(0, 3).join(" | "));
if (FAULTS.notes) fails.push(FAULTS.notes + " note(s) scheduled with a non-finite freq/time/duration");
if (FAULTS.armLeadS && FAULTS.maxLead >= FAULTS.armLeadS)
  fails.push("a voice committed " + FAULTS.maxLead.toFixed(2) + "s ahead (" + FAULTS.maxLeadLayer +
    "), beyond the " + FAULTS.armLeadS + "s arm lead — the air hold cannot refuse a note that early (plan §12)");
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
if (RUN >= 3600) for (const L of ["hichiriki", "biwa", "pa"]) if (!byLayer[L]) fails.push("no " + L + " notes in " + RUN + "s");
// Phase 4 gates (plan §7): ≥ 1 visitation per 3 cycles over 4 h; never two in one cycle; the KIRU lives on the landscape cut
if (visitVocab.maxPer > 1) fails.push("two of a kind in one cycle (two broadcasts, or two guests)");
if (RUN >= 14000 && visitVocab.total < Math.floor(cycles.length / 3)) fails.push("visitations " + visitVocab.total + " < " + Math.floor(cycles.length / 3) + " (one per 3 cycles)");
if (visitVocab.kiruMaster > 0) fails.push(visitVocab.kiruMaster + " KIRU(s) not on the landscape cut");
// S1 gates (PLAN-SIGNAL-INTEGRATION §1 S1): never two per cycle, never in a KIRU, the melodic voices silent for the hold,
// ≈ 1 per 3 cycles over 4 h (0.7–1.6) when the reel is ready; the fallback fires when it is not
// The owner asked for TWO broadcasts a cycle (was one). Three is still a
// fault: the plan draws at most two, so a third means the visitation seam is
// firing one as well as the drawn times, which is exactly what happened on the
// first pass of this change.
if (signalVocab.maxPer > 2) fails.push("more than two signals in one cycle");
if (signalVocab.nearKiru > 0) fails.push(signalVocab.nearKiru + " signal(s) within a KIRU's reach");
if (signalVocab.notSilent > 0) fails.push(signalVocab.notSilent + " melodic note(s) inside a signal's hold");
// §8.1 (the owner, after the rc.9 listen) raised the seating rate from about
// one signal in three cycles to about one per cycle, so this gate's old
// 0.7–1.6 per 3 cycles encodes a design that no longer exists. Re-stated as
// the new intent: 2.2–3.6 per 3 cycles, i.e. 0.73–1.2 per cycle around the
// measured 0.97.
if (SIGNAL_MOCK === "ready" && RUN >= 14000) { const r3 = 3 * signalVocab.n / Math.max(1, signalVocab.cycles); if (r3 < 2.2 || r3 > 3.6) fails.push("signals " + r3.toFixed(2) + " per 3 cycles outside 2.2–3.6"); }
if (SIGNAL_MOCK === "ready" && RUN >= 14000 && signalVocab.fallbacks > 0) fails.push(signalVocab.fallbacks + " fallback(s) with the reel ready");
if (SIGNAL_MOCK !== "ready" && signalVocab.hosted > 0 && signalVocab.n > 0) fails.push("a signal played with the reel unavailable");
if (SIGNAL_MOCK !== "ready" && signalVocab.hosted > 0 && signalVocab.fallbacks < 1) fails.push("no fallback fired with the reel unavailable");
if (!reproSame) fails.push("REPRO gate failed");
if (errors.length) fails.push(errors.length + " runtime errors");
console.log(fails.length ? "VERDICT: FAIL — " + fails.join("; ") : "VERDICT: PASS ✓");
process.exit(fails.length ? 1 : 0);

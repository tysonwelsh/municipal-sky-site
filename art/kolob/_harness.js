#!/usr/bin/env node
// ============================================================================
// KOLOB headless harness (dev tool; tracked since 2026-10-01, excluded from
// deploy, never shipped).
//
// Like its siblings (zankyo/_harness.js, prosperos-jukebox-v2/_harness.js)
// it mocks window, mocks Web Audio with nodes that merely RECORD what was
// done to them, drives a virtual clock through a queue of fake timers, and
// then evaluates the real engine sources unmodified — the list in
// _engine.php, in that order, the Jukebox v2 substrate first. Nothing in
// here plays a sound; the harness is how the meeting a seed WOULD play is
// written down, note for note, for the measurement tools in tools/ (which
// read nothing but the dump this writes) and for a quick silent check that
// the engine still loads, plays and keeps time.
//
// Built to the tools' contract (tools/README.md "Which build is measured"
// and "The dump format (v1)", tools/lib/run.js, tools/lib/witness.js) and
// the siblings' mock design; it loads, plays, dumps and reports, and
// carries none of the siblings' spec suites.
//
// Usage:
//   node _harness.js <secs> <seed> [ives] [razz] [cumulative] [force=<guest>]
//                    [exp=<spec>] [dump=<file>] [header]
//
//   ives          KolobAudio.setForceVisitation(true)   — the Ives switch
//   force=<name>  KolobAudio.setForceVisitation(name)   — one named guest
//   razz          KolobAudio.setForceRaspberry(true)
//   cumulative    KolobAudio.setCumulativeMode("always")
//   exp=<spec>    the experiments' switch, as ?exp= takes it (-name,+name,none,all)
//   dump=<file>   write the note and event streams, one JSON array per line
//   header        with dump=: a first line ["H", 0, {...}] naming the run and
//                 the engine (opt-in, so a plain dump stays byte-identical)
//
// Which engine: KOLOB_BASE or KOLOB_DIR (the tools set both; either alone
// works) names the engine directory; the default is this file's own. The
// module list is that directory's _engine.php (the one list since
// 2026-09-29; the index.php $kolob_engine fallback reads the split builds
// of 2026-09-26 to 2026-09-29 — git: refs of those days, nothing newer);
// the substrate's "../prosperos-jukebox-v2/pj2-*.js" resolve relative to
// it. KOLOB_LEGACY=<file> loads a single-file build instead — kolob-audio.js,
// the engine before the split of 2026-09-26, for git: refs older than that
// — best effort, that build keeps its own time.
// Every module is read with fs.readFileSync (so tools/lib/witness.js, which
// the tools preload, can see exactly which bytes were played) and evaluated
// with vm.runInThisContext, which is a browser <script>: top-level var, let
// and const become globals, and `window` is the global object itself.
//
// The dump (tools/README.md "The dump format (v1)"): ["N", t, note] for
// every note exactly as onNote delivered it, ["E", t, event] for every event
// exactly as onEvent delivered it; t is the music's own time at emission
// (S.now(): the cue's scheduled time inside a cue, the audio clock outside),
// and records past the run's end are dropped. With `header` the first line
// is ["H", 0, {format: "kolob-dump", v: 1, seed, secs, flags, engine: {dir,
// legacy, list, files, fingerprint}}]; the fingerprint is the witness's
// (SHA-1 over the files played, in name order, each its name then its
// bytes, first ten hex digits), so the tools can hold the harness's word
// against what they saw it read. Same arguments on the same build give a
// byte-identical file.
//
// Virtual time: vnow (seconds) is the one clock. The mock ctx.currentTime
// reads it; setTimeout/setInterval/requestAnimationFrame are a queue the run
// loop advances in order, flushing promise microtasks after every callback;
// performance.now reads it too. PJ2.Clock's lookahead pump is a setInterval,
// so every cue fires at or ahead of its own time, and KolobAudio.clockHealth
// must report no late cue. The run plays until the clock passes <secs> + 3,
// then STOP is pressed, so the stop fade is exercised too.
//
// The report: seed, seconds, the engine and its fingerprint, meetings and
// sections, notes by layer, events by type, guests, the clock's health, the
// hymnal's desk, the graph the mock saw built, console warnings, and every
// error caught (a timer callback that threw, a cue the clock reported, an
// unhandled rejection). Exit 1 on any of those, or on a late cue; the last
// line is VERDICT: PASS ✓ or VERDICT: FAIL ✗, which tools/lib/run.js keeps.
// A module that fails to load prints "LOAD <file>: <error>" (run.js reads
// that line) and no dump is written.
// ============================================================================
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const crypto = require("crypto");

const realSetImmediate = setImmediate;          // the real one, for flushing microtasks
const realConsole = { log: console.log.bind(console), warn: console.warn.bind(console), error: console.error.bind(console) };

// ----------------------------------------------------------------------------
// Arguments
// ----------------------------------------------------------------------------
const argv = process.argv.slice(2);
let RUN = parseFloat(argv[0] || "300");
if (!isFinite(RUN) || RUN <= 0) RUN = 300;
const SEED = (parseInt(argv[1] || "1847", 10) >>> 0) || 1847;
const OPT = { ives: false, razz: false, cumulative: false, force: null, exp: null, dump: null, header: false };
const FLAGS = [];                                // the switches, as given, for the header
const unknownFlags = [];
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (a === "header") { OPT.header = true; continue; }
  if (a.indexOf("dump=") === 0) { OPT.dump = a.slice(5); continue; }
  FLAGS.push(a);
  if (a === "ives") OPT.ives = true;
  else if (a === "razz") OPT.razz = true;
  else if (a === "cumulative") OPT.cumulative = true;
  else if (a.indexOf("force=") === 0) OPT.force = a.slice(6);
  else if (a.indexOf("exp=") === 0) OPT.exp = a.slice(4);
  else unknownFlags.push(a);
}

// ----------------------------------------------------------------------------
// Which engine, and its list (the same reading as tools/lib/run.js)
// ----------------------------------------------------------------------------
function realpath(p) { try { return fs.realpathSync(p); } catch (e) { return path.resolve(p); } }
const ENGINE_DIR = realpath(process.env.KOLOB_BASE || process.env.KOLOB_DIR || __dirname);
const LEGACY = process.env.KOLOB_LEGACY ? realpath(process.env.KOLOB_LEGACY) : null;

function engineList(dir) {
  if (LEGACY) return { from: "the single file", files: [LEGACY] };
  const php = path.join(dir, "_engine.php");
  if (fs.existsSync(php)) {
    const src = fs.readFileSync(php, "utf8");
    const ret = src.slice(src.lastIndexOf("return ["));
    const files = [...ret.matchAll(/'([^']+\.js)'/g)].map((m) => path.resolve(dir, m[1]));
    if (files.length) return { from: "_engine.php", files };
  }
  const idx = path.join(dir, "index.php");
  if (fs.existsSync(idx)) {
    const m = /\$kolob_engine\s*=\s*\[([\s\S]*?)\];/.exec(fs.readFileSync(idx, "utf8"));
    const files = m ? [...m[1].matchAll(/'([^']+\.js)'/g)].map((x) => path.resolve(dir, x[1])) : [];
    if (files.length) return { from: "index.php", files };
  }
  return { from: null, files: [] };
}
const LIST = engineList(ENGINE_DIR);
if (!LIST.files.length) {
  realConsole.log("LOAD no module list in " + ENGINE_DIR + " (no _engine.php, no $kolob_engine in index.php; set KOLOB_LEGACY for a single-file build)");
  process.exitCode = 1;
  return;
}

// the witness's fingerprint: SHA-1 over the files in name order, each its name then its bytes
function fingerprintOf(files) {
  const h = crypto.createHash("sha1");
  files.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .forEach((f) => { h.update(f.name); h.update(f.bytes); });
  return h.digest("hex").slice(0, 10);
}

// ----------------------------------------------------------------------------
// Errors: everything caught lands here; the report prints them, the verdict counts them
// ----------------------------------------------------------------------------
const errors = [];              // { where, t, msg, stack }
function noteError(where, e) {
  errors.push({ where, t: vnow, msg: String(e && e.message || e), stack: e && e.stack ? String(e.stack) : "" });
}
process.on("uncaughtException", (e) => noteError("uncaught", e));
process.on("unhandledRejection", (e) => noteError("unhandled rejection", e));

// ----------------------------------------------------------------------------
// Virtual time: one clock, a queue of fake timers
// ----------------------------------------------------------------------------
let vnow = 0;
const timers = new Map();
let timerSeq = 0;
function addTimer(fn, ms, args, repeat) {
  const id = ++timerSeq;
  if (typeof fn !== "function") return id;
  const delay = Math.max(0, (+ms || 0) / 1000);
  timers.set(id, { id, fn, args, next: vnow + delay, period: repeat ? Math.max(delay, 0.001) : 0, repeat, seq: id });
  return id;
}
function clearTimer(id) { timers.delete(id); }
function nextTimer() {
  let best = null;
  for (const t of timers.values()) if (!best || t.next < best.next || (t.next === best.next && t.seq < best.seq)) best = t;
  return best;
}
// Run every timer due up to untilS, in time order (insertion order on a tie),
// flushing promise microtasks after each one — the fetch's refusal, the
// context's resume(), anything the engine chains on a promise settles between
// callbacks, as it would between tasks in a browser.
let fatal = false;
async function advance(untilS) {
  let guard = 0;
  for (;;) {
    if (fatal) return;
    const tm = nextTimer();
    if (!tm || tm.next > untilS) { vnow = untilS; return; }
    if (++guard > 20000000) { noteError("advance", new Error("iteration guard tripped at " + vnow.toFixed(3) + " s: a timer loop never ends")); fatal = true; return; }
    vnow = Math.max(vnow, tm.next);
    if (tm.repeat) { tm.next = vnow + tm.period; tm.seq = ++timerSeq; } else timers.delete(tm.id);
    try { tm.fn.apply(null, tm.args); } catch (e) { noteError("timer callback", e); if (errors.length > 200) { fatal = true; return; } }
    await new Promise(realSetImmediate);
  }
}
global.setTimeout = function (fn, ms) { return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), false); };
global.setInterval = function (fn, ms) { return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), true); };
global.clearTimeout = clearTimer;
global.clearInterval = clearTimer;
global.requestAnimationFrame = function (fn) { return addTimer(function () { fn(vnow * 1000); }, 1000 / 60, [], false); };
global.cancelAnimationFrame = clearTimer;
global.requestIdleCallback = function (fn) { return addTimer(function () { fn({ didTimeout: false, timeRemaining: () => 50 }); }, 1, [], false); };
global.cancelIdleCallback = clearTimer;
global.performance = { now: () => vnow * 1000, timeOrigin: 0, mark() {}, measure() {}, getEntriesByName() { return []; }, clearMarks() {}, clearMeasures() {} };

// ----------------------------------------------------------------------------
// Mock Web Audio — recorders. Params keep their last value; nodes connect,
// disconnect, start and stop, and a source whose stop time passes fires its
// onended on the virtual clock (the engine's handlers are all cleanup). The
// context counts what was built, for the report. A method the mock lacks
// fails loudly with its name (ctx.createX → an error naming X; a node's →
// "is not a function" naming it), never silently.
// ----------------------------------------------------------------------------
const graph = { created: {}, total: 0, automation: 0, contexts: 0 };
let lastCtx = null;

function mkParam(owner, name, init) {
  const p = { _label: owner + "." + name, _v: +init, defaultValue: +init, minValue: -3.4028234663852886e38, maxValue: 3.4028234663852886e38, automationRate: "a-rate" };
  Object.defineProperty(p, "value", { enumerable: true, get() { return p._v; }, set(v) { p._v = +v; } });
  p.setValueAtTime = function (v) { graph.automation++; p._v = +v; return p; };
  p.linearRampToValueAtTime = function (v) { graph.automation++; p._v = +v; return p; };
  p.exponentialRampToValueAtTime = function (v) { graph.automation++; p._v = +v; return p; };
  p.setTargetAtTime = function (v) { graph.automation++; p._v = +v; return p; };
  p.setValueCurveAtTime = function (curve) { graph.automation++; if (curve && curve.length) p._v = +curve[curve.length - 1]; return p; };
  p.cancelScheduledValues = function () { return p; };
  p.cancelAndHoldAtTime = function () { return p; };
  return p;
}
function mkBuffer(nCh, len, sr) {
  nCh = Math.max(1, nCh | 0); len = Math.max(1, len | 0); sr = sr || 48000;
  const chans = [];
  return {
    _kind: "AudioBuffer", numberOfChannels: nCh, length: len, sampleRate: sr, duration: len / sr,
    getChannelData(i) {
      if (!(i >= 0 && i < nCh)) throw new Error("AudioBuffer.getChannelData(" + i + "): the buffer has " + nCh + " channel(s)");
      return chans[i] || (chans[i] = new Float32Array(len));
    },
    copyToChannel(src, i, off) { this.getChannelData(i).set(src.subarray(0, Math.min(src.length, len - (off || 0))), off || 0); },
    copyFromChannel(dst, i, off) { const d = this.getChannelData(i); dst.set(d.subarray(off || 0, (off || 0) + dst.length)); },
  };
}
// kind → [params with defaults, plain properties, is it a scheduled source]
const NODE_KINDS = {
  Gain:               [{ gain: 1 }, {}, false],
  Oscillator:         [{ frequency: 440, detune: 0 }, { type: "sine" }, true],
  BiquadFilter:       [{ frequency: 350, detune: 0, Q: 1, gain: 0 }, { type: "lowpass", getFrequencyResponse() {} }, false],
  StereoPanner:       [{ pan: 0 }, {}, false],
  Panner:             [{ positionX: 0, positionY: 0, positionZ: 0, orientationX: 1, orientationY: 0, orientationZ: 0 }, { panningModel: "equalpower", distanceModel: "inverse", refDistance: 1, maxDistance: 10000, rolloffFactor: 1, coneInnerAngle: 360, coneOuterAngle: 360, coneOuterGain: 0, setPosition() {}, setOrientation() {} }, false],
  Delay:              [{ delayTime: 0 }, {}, false],
  Convolver:          [{}, { buffer: null, normalize: true }, false],
  WaveShaper:         [{}, { curve: null, oversample: "none" }, false],
  DynamicsCompressor: [{ threshold: -24, knee: 30, ratio: 12, attack: 0.003, release: 0.25 }, { reduction: 0 }, false],
  Analyser:           [{}, { fftSize: 2048, frequencyBinCount: 1024, minDecibels: -100, maxDecibels: -30, smoothingTimeConstant: 0.8, getByteFrequencyData() {}, getByteTimeDomainData() {}, getFloatFrequencyData() {}, getFloatTimeDomainData() {} }, false],
  BufferSource:       [{ playbackRate: 1, detune: 0 }, { buffer: null, loop: false, loopStart: 0, loopEnd: 0 }, true],
  ConstantSource:     [{ offset: 1 }, {}, true],
  ChannelMerger:      [{}, {}, false],
  ChannelSplitter:    [{}, {}, false],
  IIRFilter:          [{}, { getFrequencyResponse() {} }, false],
  ScriptProcessor:    [{}, { bufferSize: 4096, onaudioprocess: null }, false],
  MediaStreamDestination: [{}, { stream: { id: "mock-stream", active: true, getTracks() { return []; }, getAudioTracks() { return []; } } }, false],
  MediaElementSource: [{}, { mediaElement: null }, false],
  MediaStreamSource:  [{}, { mediaStream: null }, false],
  AudioDestination:   [{}, { maxChannelCount: 2 }, false],
};
function mkNode(ctx, kind) {
  const spec = NODE_KINDS[kind];
  const n = { _kind: kind, context: ctx, numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: "max", channelInterpretation: "speakers" };
  n.connect = function (dest) { return dest; };            // returns the destination, so chains read naturally
  n.disconnect = function () {};
  n.addEventListener = function (type, fn) { if (type === "ended") (n._ended = n._ended || []).push(fn); };
  n.removeEventListener = function (type, fn) { if (n._ended) n._ended = n._ended.filter((f) => f !== fn); };
  n.dispatchEvent = function () { return true; };
  for (const k in spec[0]) n[k] = mkParam(kind, k, spec[0][k]);
  for (const k in spec[1]) n[k] = spec[1][k];
  if (spec[2]) {
    n.onended = null; n._started = null; n._stopAt = null; n._endTimer = null;
    const armEnded = (at) => {
      if (n._endTimer != null) clearTimer(n._endTimer);
      n._endTimer = addTimer(function () {
        n._endTimer = null;
        const ev = { type: "ended", target: n };
        if (typeof n.onended === "function") n.onended(ev);
        (n._ended || []).forEach((f) => f(ev));
      }, Math.max(0, at - ctx.currentTime) * 1000, [], false);
    };
    n.start = function (when, offset, dur) {
      if (n._started != null) throw new Error("InvalidStateError: " + kind + ".start() called twice");
      n._started = when != null ? +when : ctx.currentTime;
      if (dur != null) armEnded(n._started + dur / (n.playbackRate ? n.playbackRate.value || 1 : 1));
      else if (kind === "BufferSource" && !n.loop && n.buffer && n.buffer.duration) armEnded(n._started + (n.buffer.duration - (offset || 0)) / (n.playbackRate.value || 1));
    };
    n.stop = function (when) {
      if (n._started == null) throw new Error("InvalidStateError: " + kind + ".stop() before start()");
      n._stopAt = when != null ? +when : ctx.currentTime;
      armEnded(Math.max(n._stopAt, n._started));
    };
    n.setPeriodicWave = function (w) { n._wave = w; n.type = "custom"; };
  }
  graph.created[kind] = (graph.created[kind] || 0) + 1; graph.total++;
  return n;
}
function mkContext(kind, opts) {
  const ctx = { _kind: kind, sampleRate: (opts && opts.sampleRate) || 48000, state: "running", baseLatency: 0.005, outputLatency: 0.01, _lost: 0, _suspendedAt: null };
  Object.defineProperty(ctx, "currentTime", { enumerable: true, get: () => (ctx.state === "suspended" ? ctx._suspendedAt : vnow - ctx._lost) });
  ctx.destination = mkNode(ctx, "AudioDestination");
  ctx.listener = { positionX: mkParam("Listener", "positionX", 0), positionY: mkParam("Listener", "positionY", 0), positionZ: mkParam("Listener", "positionZ", 0), setPosition() {}, setOrientation() {} };
  for (const k in NODE_KINDS) if (k !== "AudioDestination") ctx["create" + k] = function () { return mkNode(ctx, k); };
  ctx.createBuffer = function (nCh, len, sr) { return mkBuffer(nCh, len, sr || ctx.sampleRate); };
  ctx.createPeriodicWave = function (real, imag, o) { return { _kind: "PeriodicWave", real, imag, disableNormalization: !!(o && o.disableNormalization) }; };
  ctx.decodeAudioData = function (ab, ok, bad) {
    const b = mkBuffer(2, ctx.sampleRate * 2, ctx.sampleRate);
    if (typeof ok === "function") addTimer(() => ok(b), 0, [], false);
    return Promise.resolve(b);
  };
  ctx.resume = function () { if (ctx.state === "suspended") { ctx._lost += vnow - (ctx._suspendedAt + ctx._lost); ctx.state = "running"; } else if (ctx.state === "closed") return Promise.reject(new Error("InvalidStateError: the context is closed")); return Promise.resolve(); };
  ctx.suspend = function () { if (ctx.state === "running") { ctx._suspendedAt = vnow - ctx._lost; ctx.state = "suspended"; } return Promise.resolve(); };
  ctx.close = function () { ctx.state = "closed"; return Promise.resolve(); };
  ctx.addEventListener = function () {}; ctx.removeEventListener = function () {};
  ctx.onstatechange = null;
  if (kind === "OfflineAudioContext") {
    ctx.length = (opts && opts.length) || ctx.sampleRate;
    ctx.startRendering = function () { return Promise.resolve(mkBuffer((opts && opts.numberOfChannels) || 2, ctx.length, ctx.sampleRate)); };
  }
  graph.contexts++;
  lastCtx = ctx;
  // an unknown create* fails loudly, by name; other unknown properties stay undefined (feature checks stay honest)
  return new Proxy(ctx, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === "string" && /^create[A-Z]/.test(prop)) return function () { throw new Error("mock AudioContext has no " + prop + "() — add it to _harness.js NODE_KINDS"); };
      return undefined;
    },
  });
}
function MockAudioContext(opts) { return mkContext("AudioContext", opts); }
function MockOfflineAudioContext(a, b, c) { return mkContext("OfflineAudioContext", typeof a === "object" ? a : { numberOfChannels: a, length: b, sampleRate: c }); }
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;
global.OfflineAudioContext = MockOfflineAudioContext;
global.AudioBuffer = function (o) { return mkBuffer(o.numberOfChannels || 1, o.length, o.sampleRate); };
global.PeriodicWave = function (ctx, o) { return ctx.createPeriodicWave((o && o.real) || new Float32Array(2), (o && o.imag) || new Float32Array(2), o); };
// the constructor forms (new GainNode(ctx, {gain}) …): built through the context, options applied
for (const k in NODE_KINDS) {
  if (k === "AudioDestination") continue;
  const name = (k === "BufferSource" ? "AudioBufferSource" : k === "MediaStreamDestination" ? "MediaStreamAudioDestination" : k === "MediaElementSource" ? "MediaElementAudioSource" : k === "MediaStreamSource" ? "MediaStreamAudioSource" : k) + "Node";
  global[name] = function (ctx, o) {
    const n = ctx["create" + k]();
    if (o) for (const key in o) { if (n[key] && typeof n[key] === "object" && "value" in n[key] && typeof o[key] === "number") n[key].value = o[key]; else n[key] = o[key]; }
    return n;
  };
}

// ----------------------------------------------------------------------------
// Mock window: the global object itself (the substrate writes the bare PJ2,
// the rooms the bare KOLOB), with a document that is visible and empty, a
// location whose ?seed= is this run's, an in-memory localStorage, no Worker
// (so the hymnal composes on its idle road), and a fetch that refuses (so
// the rooms keep their poured impulse responses).
// ----------------------------------------------------------------------------
global.window = global;
global.self = global;
function mkElement(tag) {
  return {
    tagName: String(tag || "div").toUpperCase(), style: { setProperty() {}, getPropertyValue() { return ""; } }, dataset: {},
    classList: { add() {}, remove() {}, toggle() { return false; }, contains() { return false; } },
    children: [], childNodes: [], parentNode: null, textContent: "", innerHTML: "", value: "", hidden: false, src: "",
    width: 0, height: 0, clientWidth: 0, clientHeight: 0, offsetWidth: 0, offsetHeight: 0,
    setAttribute() {}, getAttribute() { return null; }, removeAttribute() {}, hasAttribute() { return false; },
    appendChild(c) { return c; }, removeChild(c) { return c; }, insertBefore(c) { return c; }, replaceChild(c) { return c; }, remove() {},
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    querySelector() { return null; }, querySelectorAll() { return []; }, getElementsByTagName() { return []; }, closest() { return null; },
    getContext() { return null; }, getBoundingClientRect() { return { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 }; },
    focus() {}, blur() {}, click() {}, play() { return Promise.resolve(); }, pause() {}, load() {}, animate() { return null; },
  };
}
const docListeners = {};
global.document = {
  hidden: false, visibilityState: "visible", readyState: "complete", title: "KOLOB (harness)", cookie: "",
  body: mkElement("body"), documentElement: mkElement("html"), head: mkElement("head"),
  addEventListener(type, fn) { (docListeners[type] = docListeners[type] || []).push(fn); },
  removeEventListener(type, fn) { if (docListeners[type]) docListeners[type] = docListeners[type].filter((f) => f !== fn); },
  dispatchEvent(ev) { (docListeners[ev.type] || []).slice().forEach((f) => { try { f(ev); } catch (e) { noteError("document listener", e); } }); return true; },
  getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
  getElementsByTagName() { return []; }, getElementsByClassName() { return []; },
  createElement: mkElement, createElementNS(ns, tag) { return mkElement(tag); }, createTextNode(s) { return { nodeValue: s, textContent: s }; },
  createDocumentFragment() { return mkElement("fragment"); },
};
const SEARCH = "?seed=" + SEED + (OPT.exp ? "&exp=" + encodeURIComponent(OPT.exp).replace(/%2C/g, ",") : "");
global.location = { search: SEARCH, href: "http://localhost/art/kolob/index.php" + SEARCH, pathname: "/art/kolob/index.php", hash: "", host: "localhost", hostname: "localhost", port: "", protocol: "http:", origin: "http://localhost", reload() {}, replace() {}, assign() {}, toString() { return this.href; } };
global.history = { pushState() {}, replaceState() {}, back() {}, state: null };
try { Object.defineProperty(global, "navigator", { configurable: true, writable: true, value: { userAgent: "kolob-harness (node " + process.version + ")", language: "en", languages: ["en"], platform: process.platform, hardwareConcurrency: 4, onLine: true, mediaSession: undefined, vibrate() { return false; } } }); } catch (e) {}
(function () {
  const store = new Map();
  const ls = {
    getItem(k) { return store.has(String(k)) ? store.get(String(k)) : null; },
    setItem(k, v) { store.set(String(k), String(v)); }, removeItem(k) { store.delete(String(k)); }, clear() { store.clear(); },
    key(i) { return [...store.keys()][i] || null; }, get length() { return store.size; },
  };
  try { Object.defineProperty(global, "localStorage", { configurable: true, writable: true, value: ls }); } catch (e) {}
  try { Object.defineProperty(global, "sessionStorage", { configurable: true, writable: true, value: ls }); } catch (e) {}
})();
global.Worker = undefined;                       // the hymnal falls back to its idle slices
global.fetch = function (url) { return Promise.reject(new Error("the harness has no network (fetch " + url + " refused)")); };
global.XMLHttpRequest = undefined;
global.addEventListener = function () {};
global.removeEventListener = function () {};
global.dispatchEvent = function () { return true; };
global.innerWidth = 1280; global.innerHeight = 800; global.devicePixelRatio = 1; global.scrollX = 0; global.scrollY = 0;
global.matchMedia = function () { return { matches: false, media: "", addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; };
global.getComputedStyle = function () { return { getPropertyValue() { return ""; } }; };
global.Image = function () { return mkElement("img"); };
global.Audio = function () { return mkElement("audio"); };
global.MskyBackgroundAudio = undefined;          // no <audio> route here: the master goes to ctx.destination

// console: the engine's warnings are kept for the report; a cue the clock
// reports (console.error from PJ2.Clock's onError) is an error of the run
const warns = [], consoleErrors = [];
function fmtArgs(args) { return Array.prototype.map.call(args, (a) => (a instanceof Error ? a.message : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })())).join(" "); }
console.warn = function () { warns.push({ t: vnow, msg: fmtArgs(arguments) }); };
console.error = function () {
  const err = Array.prototype.find.call(arguments, (a) => a instanceof Error);
  consoleErrors.push({ t: vnow, msg: fmtArgs(arguments), stack: err && err.stack ? String(err.stack) : "" });
};

// ----------------------------------------------------------------------------
// Load the engine: every file read with fs.readFileSync (the witness watches
// it), evaluated in this context in list order
// ----------------------------------------------------------------------------
const loaded = [];              // { name, path, bytes }
const loadErrors = [];
for (const file of LIST.files) {
  const name = path.basename(file);
  let bytes;
  try { bytes = fs.readFileSync(file); } catch (e) { loadErrors.push(name + ": " + e.message); continue; }
  loaded.push({ name, path: file, bytes });
  try { vm.runInThisContext(bytes.toString("utf8"), { filename: file }); }
  catch (e) { loadErrors.push(name + ": " + (e && e.message) + (e && e.stack ? "\n    " + String(e.stack).split("\n").slice(0, 3).join("\n    ") : "")); }
}
const FINGERPRINT = loaded.length ? fingerprintOf(loaded) : null;
if (loadErrors.length) {
  loadErrors.forEach((m) => realConsole.log("LOAD " + m));
  realConsole.log("VERDICT: FAIL ✗ (" + loadErrors.length + " module(s) failed to load)");
  process.exitCode = 1;
  return;
}
const K = global.KolobAudio;
if (!K || typeof K.play !== "function") {
  realConsole.error("FAIL: KolobAudio not defined after loading " + loaded.length + " modules from " + ENGINE_DIR);
  realConsole.log("VERDICT: FAIL ✗ (no KolobAudio facade)");
  process.exitCode = 1;
  return;
}
const KOLOB = global.KOLOB || {};
const S = KOLOB._s || null;

// ----------------------------------------------------------------------------
// The run
// ----------------------------------------------------------------------------
const musicNow = () => (S && typeof S.now === "function") ? S.now() : (lastCtx ? lastCtx.currentTime : vnow);
const dumpLines = [];
const tally = { notes: 0, events: 0, byLayer: {}, byType: {}, guests: {}, cadences: {}, sections: [], meetings: [], unserialisable: 0 };
function count(map, k) { map[k] = (map[k] || 0) + 1; }
function record(kind, t, payload) {
  if (!(t < RUN)) return;                        // past the run's end: dropped (and NaN never written)
  try { dumpLines.push(JSON.stringify([kind, t, payload])); }
  catch (e) { tally.unserialisable++; if (tally.unserialisable <= 3) noteError("dump", new Error("a " + kind + " record at " + t.toFixed(3) + " s could not be serialised: " + e.message)); }
}
K.setNoteListener(function (n) {
  const t = musicNow();
  tally.notes++; count(tally.byLayer, n && n.layer || "?");
  record("N", t, n);
});
K.setEventListener(function (ev) {
  const t = typeof ev.t === "number" ? ev.t : musicNow();
  tally.events++;
  const type = ev && (ev.type || ev.cat) || "?";
  count(tally.byType, type);
  if (ev.type === "meeting-start" || (!ev.type && ev.cat === "meeting" && /meeting \d+/.test(ev.label || ""))) tally.meetings.push({ t, n: ev.n, mode: ev.mode, kind: ev.kind, sunday: ev.sunday, keynoteHz: ev.keynoteHz, houseDialect: ev.houseDialect, label: ev.label, detail: ev.detail });
  if (ev.type === "section-start" || (!ev.type && ev.cat === "section")) tally.sections.push({ t, section: ev.section || String(ev.label || "").replace(/^[^A-Za-z]*/, "").toLowerCase(), dur: ev.dur });
  if (ev.type === "guest-start") count(tally.guests, ev.guest || "?");
  if (ev.type === "cadence") count(tally.cadences, ev.kind || "?");
  record("E", t, ev);
});

// the switches, before PLAY (the planner reads them when the meeting is called)
if (OPT.ives && K.setForceVisitation) K.setForceVisitation(true);
if (OPT.force && K.setForceVisitation) K.setForceVisitation(OPT.force);
if (OPT.razz && K.setForceRaspberry) K.setForceRaspberry(true);
if (OPT.cumulative && K.setCumulativeMode) K.setCumulativeMode("always");
// the experiments' switch: the module read ?exp= from location at load; the
// console form is applied as well where it exists (the latest word wins, and it is the same word)
if (OPT.exp && KOLOB.Experimental && typeof KOLOB.Experimental.set === "function") {
  OPT.exp.split(",").forEach((tok) => {
    tok = tok.trim(); if (!tok) return;
    const E = KOLOB.Experimental;
    try {
      if (tok === "none" || tok === "all") Object.keys(E.DEFAULTS || {}).forEach((k) => E.set(k, tok === "all"));
      else { let on = true, name = tok; if (tok[0] === "-" || tok[0] === "!") { on = false; name = tok.slice(1); } else if (tok[0] === "+") name = tok.slice(1); E.set(name, on); }
    } catch (e) { warns.push({ t: vnow, msg: "exp=" + tok + ": " + e.message }); }
  });
}
// the seed: kolob-core read ?seed= from location when it loaded; a build that did not is reseeded
if (typeof K.getSeed === "function" && K.getSeed() !== SEED && typeof K.reseed === "function") K.reseed(SEED);

(async function main() {
  let playError = null;
  // PLAY at 0: the page's press makes the context (currentTime 0) and the
  // downbeat falls LEAD_S = 0.1 s later — the meeting is called at 0.1 s
  try { K.play(); } catch (e) { playError = e; noteError("play()", e); }
  if (!playError) {
    await advance(RUN + 3);
    try { K.stop(); } catch (e) { noteError("stop()", e); }
    if (!fatal) await advance(vnow + 1.5);       // the stop fade's own timers
  }

  // ---- the dump ----
  if (OPT.dump) {
    const out = [];
    if (OPT.header) {
      out.push(JSON.stringify(["H", 0, {
        format: "kolob-dump", v: 1, seed: SEED, secs: RUN, flags: FLAGS,
        engine: { dir: ENGINE_DIR, legacy: !!LEGACY, list: LIST.from, files: loaded.map((f) => f.name), fingerprint: FINGERPRINT },
      }]));
    }
    const file = path.resolve(OPT.dump);
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch (e) {}
    fs.writeFileSync(file, out.concat(dumpLines).join("\n") + "\n");
  }

  // ---- the report ----
  const L = realConsole.log;
  const health = typeof K.clockHealth === "function" ? safe(() => K.clockHealth()) : null;
  const hymnal = typeof K.hymnalStats === "function" ? safe(() => K.hymnalStats()) : null;
  const lateCues = health && health.late > 0;
  const fails = [];
  if (playError) fails.push("play() threw");
  if (errors.length) fails.push(errors.length + " error(s) caught");
  if (consoleErrors.length) fails.push(consoleErrors.length + " console.error (cues that threw)");
  if (lateCues) fails.push(health.late + " late cue(s)");
  if (fatal) fails.push("the run was cut short");

  L("=== KOLOB harness ===  seed " + SEED + " · " + RUN + " s" + (FLAGS.length ? " · flags " + FLAGS.join(",") : "") + (OPT.dump ? " · dump " + path.resolve(OPT.dump) + (OPT.header ? " (header)" : "") : ""));
  L("engine: " + loaded.length + " module" + (loaded.length === 1 ? "" : "s") + " from " + ENGINE_DIR + (LEGACY ? " (single-file " + path.basename(LEGACY) + ")" : " (the list in " + LIST.from + ")") + " · fingerprint " + FINGERPRINT);
  if (unknownFlags.length) L("note: unknown flag(s) " + unknownFlags.join(", ") + " (passed to the header, otherwise ignored)");
  const M = tally.meetings;
  L("meetings: " + M.length + M.map((m) => " · #" + (m.n != null ? m.n : "?") + " at " + m.t.toFixed(1) + " s: " + [m.mode, m.kind, m.sunday, m.keynoteHz ? m.keynoteHz.toFixed(1) + " Hz" : null, m.houseDialect].filter(Boolean).join(" · ") + (m.mode ? "" : " " + (m.label || "") + " " + (m.detail || ""))).join(""));
  L("sections: " + tally.sections.length + (tally.sections.length ? " · " + tally.sections.map((s) => s.section + "@" + s.t.toFixed(1)).join(" ") : ""));
  L("notes: " + tally.notes + " · by layer " + JSON.stringify(sortedCounts(tally.byLayer)));
  L("events: " + tally.events + " · by type " + JSON.stringify(sortedCounts(tally.byType, 16)));
  L("guests: " + (Object.keys(tally.guests).length ? JSON.stringify(tally.guests) : "none") + " · cadences " + (Object.keys(tally.cadences).length ? JSON.stringify(tally.cadences) : "none"));
  L("clock: " + (health ? health.cues + " cues · " + health.late + " late · max late " + health.maxLate + " s" : "(no clockHealth on this build)") + " · " + timers.size + " timer(s) still armed at the end");
  if (hymnal) L("hymnal: backend " + hymnal.backend + " (worker " + hymnal.worker + ") · posted " + hymnal.posted + " · composed " + hymnal.composed + " (idle " + hymnal.byIdle + ", worker " + hymnal.byWorker + ") · late " + hymnal.late + " (in a cue " + hymnal.lateInCue + ") · failed " + hymnal.failed);
  L("graph: " + graph.contexts + " context(s) · " + graph.total + " nodes " + JSON.stringify(sortedCounts(graph.created, 10)) + " · " + graph.automation + " automation calls");
  if (OPT.dump) L("dump: " + dumpLines.length + " records" + (OPT.header ? " + header" : "") + (tally.unserialisable ? " · " + tally.unserialisable + " NOT serialisable" : ""));
  L("console.warn: " + warns.length + (warns.length ? " · first: " + warns.slice(0, 3).map((w) => "[" + w.t.toFixed(1) + " s] " + w.msg.slice(0, 160)).join(" | ") : ""));
  L("errors: " + errors.length + " caught · " + consoleErrors.length + " console.error");
  errors.slice(0, 5).forEach((e, i) => L("  error " + (i + 1) + " (" + e.where + " @ " + e.t.toFixed(3) + " s): " + e.msg + (e.stack ? "\n    " + e.stack.split("\n").slice(0, 6).join("\n    ") : "")));
  consoleErrors.slice(0, 5).forEach((e, i) => L("  console.error " + (i + 1) + " @ " + e.t.toFixed(3) + " s: " + e.msg.slice(0, 300) + (e.stack ? "\n    " + e.stack.split("\n").slice(0, 6).join("\n    ") : "")));
  L(fails.length ? "VERDICT: FAIL ✗ (" + fails.join("; ") + ")" : "VERDICT: PASS ✓");
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => { noteError("main", e); realConsole.log("VERDICT: FAIL ✗ (" + e.message + ")\n" + (e.stack || "")); process.exitCode = 1; });

function safe(fn) { try { return fn(); } catch (e) { noteError("report", e); return null; } }
function sortedCounts(map, limit) {
  const keys = Object.keys(map).sort((a, b) => map[b] - map[a] || (a < b ? -1 : 1));
  const out = {};
  keys.slice(0, limit || 40).forEach((k) => { out[k] = map[k]; });
  if (limit && keys.length > limit) out["…"] = keys.length - limit + " more";
  return out;
}

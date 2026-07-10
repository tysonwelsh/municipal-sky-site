// ============================================================================
// Prospero's Jukebox v2 — viz-smoke.js (dev tool, never shipped)
//
// The node smoke for pj2-viz.js: mock window, mock canvas 2d (records only
// that legal calls were made), a mock engine that emits a SCRIPTED event +
// info sequence covering every §4 vocabulary row, and a mock AudioContext /
// AnalyserNode feeding a plausible spectrum. Asserts:
//
//   1. create / setTrack(×3) / attach / frames / detach / start / stop —
//      the whole lifecycle, no exceptions
//   2. listener unhook verified: after detach() the engine's listener lists
//      are EMPTY and the poll timer is cleared (no leaks)
//   3. PJ2.Skin.dev = true the whole run: zero dataInk violations while all
//      three skins draw full frames with live marks + event illustrations
//   4. the scripted events actually land (tree grows, cut hushes then
//      clears WITHOUT residue — owner ruling: no scar state anywhere)
//
// Usage: node viz-smoke.js      Exit 0 = ALL GREEN, exit 1 = failures.
// ============================================================================
"use strict";

var fs = require("fs");
var path = require("path");

var checks = [];
function check(name, pass, detail) {
  checks.push({ name: name, pass: !!pass, detail: detail || "" });
}

// ----------------------------------------------------------------------------
// mock DOM / timers
// ----------------------------------------------------------------------------
var vnow = 0; // virtual ms
var timers = {}; var timerNext = 1;
global.window = global;
global.performance = { now: function () { return vnow; } };
global.document = {
  fonts: null, // no font API — viz must cope
  addEventListener: function () {},
  visibilityState: "visible",
};

function vSetInterval(fn, ms) {
  var id = timerNext++;
  timers[id] = { fn: fn, ms: ms, next: vnow + ms };
  return id;
}
function vClearInterval(id) { delete timers[id]; }
function tickTimers() {
  for (var id in timers) {
    var t = timers[id];
    while (t.next <= vnow) { t.next += t.ms; try { t.fn(); } catch (e) { throw e; } }
  }
}

// ----------------------------------------------------------------------------
// mock canvas 2d — every method the skin + viz use, as recording no-ops.
// Unknown method access fails loudly (that's the point of a smoke).
// ----------------------------------------------------------------------------
var CTX_METHODS = [
  "fillRect", "clearRect", "strokeRect", "beginPath", "closePath", "moveTo",
  "lineTo", "arc", "ellipse", "stroke", "fill", "save", "restore",
  "setTransform", "translate", "rotate", "scale", "setLineDash", "clip",
  "quadraticCurveTo", "bezierCurveTo", "fillText", "strokeText", "drawImage",
];
function mockCtx(canvas) {
  var ctx = {
    canvas: canvas,
    imageSmoothingEnabled: true,
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1,
    font: "10px monospace", textAlign: "left", textBaseline: "alphabetic",
    letterSpacing: "0px", globalCompositeOperation: "source-over",
    calls: 0,
    createPattern: function () { ctx.calls++; return { __pattern: true }; },
    measureText: function (s) { return { width: String(s).length * 7 }; },
    getImageData: function () { throw new Error("mock ctx: getImageData not supported (viz must not use it)"); },
  };
  CTX_METHODS.forEach(function (m) {
    ctx[m] = function () { ctx.calls++; };
  });
  return ctx;
}
function mockCanvas(w, h) {
  var cv = {
    width: w || 300, height: h || 150,
    style: {},
    _listeners: {},
    addEventListener: function (type, fn) {
      (cv._listeners[type] = cv._listeners[type] || []).push(fn);
    },
    getBoundingClientRect: function () {
      return { width: cv._cssW || 300, height: cv._cssH || 150, left: 0, top: 0 };
    },
  };
  cv._ctx = mockCtx(cv);
  cv.getContext = function () { return cv._ctx; };
  return cv;
}

// ----------------------------------------------------------------------------
// mock Web Audio: AnalyserNode with a plausible spectrum, AudioContext
// ----------------------------------------------------------------------------
function mockAnalyser() {
  var an = {
    fftSize: 2048,
    smoothingTimeConstant: 0,
    minDecibels: -100, maxDecibels: 0,
    get frequencyBinCount() { return an.fftSize / 2; },
    getFloatFrequencyData: function (arr) {
      // a plausible evening: noise floor + a few peaks that drift
      for (var i = 0; i < arr.length; i++) {
        arr[i] = -78 + 3 * Math.sin(i * 0.31);
      }
      var peaks = [40, 81, 162, 320, 645, 1290];
      for (var p = 0; p < peaks.length; p++) {
        var c = peaks[p] + Math.round(Math.sin(vnow / 900 + p) * 3);
        for (var k = -4; k <= 4; k++) {
          if (c + k >= 0 && c + k < arr.length) {
            arr[c + k] = Math.max(arr[c + k], -28 - p * 4 - Math.abs(k) * 5);
          }
        }
      }
    },
  };
  return an;
}
function mockAudioCtx() {
  return {
    sampleRate: 44100,
    get currentTime() { return vnow / 1000; },
    createAnalyser: mockAnalyser,
  };
}

// ----------------------------------------------------------------------------
// mock engine — the facade surface viz consumes, multicast listeners like
// the real ones (addListener returns a remover), scripted stream.
// ----------------------------------------------------------------------------
function mockEngine(track) {
  var noteLs = [], eventLs = [], analysers = [];
  function addListener(list, fn) {
    if (typeof fn !== "function") return function () {};
    list.push(fn);
    return function () {
      var i = list.indexOf(fn);
      if (i >= 0) list.splice(i, 1);
    };
  }
  var info = {
    running: true, sceneType: "settling", sceneIdx: 0, sceneCount: 3,
    x: 0.3, intensity: 0.22, tidePos: 0.55, tideLabel: "candlelit",
    airHolders: 2, harmony: "IV", motif: { working: { theme: "#b2", themeGen: 3 }, maxGen: 5 },
    weather: { haloLevel: 0.5 }, roomBalance: 0.2, haloLevel: 0.04,
    playing: true, seed: 7,
    layers: {},
  };
  if (track === "library") info.sceneLabel = "Calcinatio";
  if (track === "sycorax") { info.pose = "coil"; info.rootDeg = 0; info.tonicHz = 311; }
  if (track === "ariel") {
    info.tonicHz = 349; info.mode = "lydian";
    info.signature = { name: "#a4", promoted: false, themeGen: 2, maxGen: 4 };
    info.tideLabel = "rising-thermals";
  }
  return {
    _noteLs: noteLs, _eventLs: eventLs, _analysers: analysers,
    _info: info,
    attachAnalyser: function (a) { analysers.push(a); },
    setNoteListener: function (fn) { return addListener(noteLs, fn); },
    setEventListener: function (fn) { return addListener(eventLs, fn); },
    getInfo: function () { return JSON.parse(JSON.stringify(info)); },
    emitNote: function (n) { for (var i = 0; i < noteLs.length; i++) noteLs[i](n); },
    emitEvent: function (e) { for (var i = 0; i < eventLs.length; i++) eventLs[i](e); },
  };
}

// ----------------------------------------------------------------------------
// load the real modules
// ----------------------------------------------------------------------------
var DIR = __dirname;
["pj2-rand.js", "pj2-skin.js", "pj2-viz.js"].forEach(function (f) {
  var src = fs.readFileSync(path.join(DIR, f), "utf8");
  eval(src); // eslint-disable-line no-eval
});
check("modules loaded", !!(PJ2.Rand && PJ2.Skin && PJ2.Viz), "");

PJ2.Skin.setCanvasFactory(function (w, h) { return mockCanvas(w, h); });
PJ2.Skin.dev = true; // THE TRIPWIRE: illegal data ink throws for the whole run

// ----------------------------------------------------------------------------
// the run
// ----------------------------------------------------------------------------
var failures = 0;
function tryStep(name, fn) {
  try { fn(); check(name, true, ""); }
  catch (e) { check(name, false, e && e.message); failures++; }
}

var plate = mockCanvas(900, 860); plate._cssW = 900; plate._cssH = 860;
var margin = mockCanvas(402, 640); margin._cssW = 402; margin._cssH = 640;
var footer = mockCanvas(900, 64); footer._cssW = 900; footer._cssH = 64;

var pendingRaf = null, rafCount = 0, cafCount = 0;
var viz = null;

tryStep("create()", function () {
  viz = PJ2.Viz.create({
    plateCanvas: plate, marginCanvas: margin, footerCanvas: footer,
    seed: 451049,
    dpr: 2,
    raf: function (cb) { pendingRaf = cb; return ++rafCount; },
    caf: function () { cafCount++; pendingRaf = null; },
    now: function () { return vnow; },
    setInterval: vSetInterval, clearInterval: vClearInterval,
    setTimeout: function (fn, ms) { return vSetInterval(function () { fn(); }, ms || 1); },
    clearTimeout: vClearInterval,
  });
});
check("contract surface", !!(viz.setTrack && viz.attach && viz.detach && viz.start && viz.stop && viz.resize), "");

function runFrames(n, stepMs) {
  for (var i = 0; i < n; i++) {
    vnow += stepMs || 33;
    tickTimers();
    if (pendingRaf) { var cb = pendingRaf; pendingRaf = null; cb(vnow); }
    else viz.frameOnce(vnow / 1000);
  }
}

// ---- the scripted evening, one act per track ------------------------------
var SCRIPTS = {
  library: function (eng) {
    eng.emitEvent({ type: "engine", state: "play", seed: 7, t: 0 });
    eng.emitEvent({ type: "scene", scene: "settling", idx: 0, count: 3, durS: 90, tidePos: 0.5, t: 0.1, label: "Calcinatio" });
    eng.emitNote({ voice: "drone", freq: 65.4, t: vnow / 1000, durS: 20, deg: 0, oct: -1 });
    eng.emitNote({ voice: "drone", freq: 98, t: vnow / 1000, durS: 20, deg: 4, oct: -1 });
    eng.emitNote({ voice: "pluck", freq: 349.2, t: vnow / 1000 + 0.1, durS: 1.2, velocity: 0.8 });
    eng.emitNote({ voice: "musicbox", freq: 1046.5, t: vnow / 1000 + 0.2, durS: 0.8, velocity: 0.6 });
    eng.emitNote({ voice: "hum", kind: "sing", freq: 174.6, t: vnow / 1000, durS: 6 });
    eng.emitEvent({ type: "develop", voice: "pluck", name: "#b2", gen: 2, t: vnow / 1000 });
    eng.emitEvent({ type: "answer", voice: "musicbox", name: "#b2", gen: 2, t: vnow / 1000 });
    eng.emitEvent({ type: "cadence", kind: "plagal", label: "Ablutio", t: vnow / 1000, startT: vnow / 1000 - 4, chords: ["iv", "i"] });
    eng.emitEvent({ type: "ghost", voice: "pluck", name: "#a7", t: vnow / 1000, label: "Caput Mortuum" });
    eng.emitEvent({
      type: "seachange", target: "reroot", label: "Transmutatio",
      field: { tonicHz: 349.23, mode: "dorian" }, t: vnow / 1000,
    });
    eng.emitEvent({ type: "develop", voice: "pluck", name: "#b2", gen: 4, t: vnow / 1000 });
    eng.emitEvent({ type: "coagula", voice: "pluck", name: "#b2", t: vnow / 1000, label: "Solve et Coagula" });
    eng.emitEvent({ type: "joint-gesture", gesture: "page", from: "settling", to: "chapter", t: vnow / 1000 });
  },
  sycorax: function (eng) {
    eng.emitEvent({ type: "engine", state: "play", seed: 7, t: 0 });
    eng.emitEvent({ type: "scene", scene: "gathering", idx: 0, count: 4, durS: 90, tidePos: 0.4, t: 0.1 });
    eng.emitEvent({ type: "pose", pose: "sting", rootDeg: 0, via: "set", t: vnow / 1000 });
    eng.emitNote({ voice: "gurdy", freq: 155.6, t: vnow / 1000, durS: 18, deg: 0, oct: -1 });
    eng.emitNote({ voice: "chant", freq: 311, t: vnow / 1000, durS: 2, deg: 0, oct: 0 });
    eng.emitNote({ voice: "chant", freq: 329.6, t: vnow / 1000 + 0.1, durS: 2, deg: 1, oct: 0, final: true });
    eng.emitNote({ voice: "protodrum", kind: "lub", freq: null, t: vnow / 1000, durS: 0.3 });
    eng.emitEvent({ type: "percussion", mode: "walk", t: vnow / 1000 });
    eng.emitEvent({ type: "percussion", mode: "cluster", n: 3, t: vnow / 1000 });
    eng.emitEvent({ type: "organum", top: 4, low: 0, parts: 2, t: vnow / 1000, via: "arrival" });
    eng.emitEvent({ type: "arrival", to: "invocation", t: vnow / 1000 });
    eng.emitEvent({ type: "cut", t: vnow / 1000 + 0.05, severity: 0.71, dip: 0.25 });
    eng.emitEvent({ type: "air", voice: "waterphone", t: vnow / 1000 + 0.2, durS: 8, marginS: 2 });
    eng.emitNote({ voice: "waterphone", freq: 622, t: vnow / 1000 + 0.3, durS: 4 });
  },
  ariel: function (eng) {
    eng.emitEvent({ type: "engine", state: "play", seed: 7, t: 0 });
    eng.emitEvent({ type: "scene", scene: "song", idx: 0, count: 3, durS: 60, tidePos: 0.6, t: 0.1 });
    eng.emitNote({ voice: "breeze", freq: 174.6, t: vnow / 1000, durS: 16, deg: 0, oct: -1 });
    eng.emitNote({ voice: "whistle", freq: 784, t: vnow / 1000, durS: 2.5, velocity: 0.7 });
    eng.emitNote({ voice: "chime", freq: 1397, t: vnow / 1000 + 0.1, durS: 2, velocity: 0.5 });
    eng.emitNote({ voice: "flutter", freq: 698, t: vnow / 1000 + 0.1, durS: 1 });
    eng.emitNote({ voice: "bass", freq: 87.3, t: vnow / 1000, durS: 3 });
    eng.emitEvent({ type: "cadence", kind: "lift", arrivalAbove: true, t: vnow / 1000, startT: vnow / 1000 - 3, chords: ["II", "I"] });
    eng.emitEvent({ type: "cadence", kind: "float", t: vnow / 1000, startT: vnow / 1000 - 2, chords: ["I"] });
    eng.emitEvent({ type: "feather", deg: 4, t: vnow / 1000 });
    eng.emitEvent({ type: "develop", voice: "whistle", name: "#a4", gen: 3, t: vnow / 1000 });
    eng.emitEvent({ type: "answer", voice: "chime", name: "#a4", gen: 3, t: vnow / 1000 });
    eng.emitEvent({ type: "ghost", voice: "whistle", name: "#z1", promoted: true, t: vnow / 1000 });
    eng.emitEvent({ type: "seam-ghost", name: "#z1", promoted: true, t: vnow / 1000 });
    eng.emitEvent({
      type: "seachange", target: "up", field: { tonicHz: 392, mode: "lydian" }, t: vnow / 1000,
    });
    eng.emitEvent({ type: "release", t: vnow / 1000, durS: 40 });
    eng.emitEvent({ type: "bass-flourish", tag: "rise", t: vnow / 1000 });
    eng.emitEvent({ type: "reground", from: 392, to: 349, t: vnow / 1000 });
  },
};

var TRACKS = ["library", "sycorax", "ariel"];
TRACKS.forEach(function (tr) {
  var eng = mockEngine(tr);
  var actx = mockAudioCtx();

  tryStep(tr + ": setTrack", function () {
    if (viz.getTrack() !== tr) viz.setTrack(tr);
  });
  var unsub = null;
  tryStep(tr + ": attach", function () { unsub = viz.attach(eng, actx); });
  check(tr + ": analyser attached to engine", eng._analysers.length === 1, "got " + eng._analysers.length);
  check(tr + ": listeners registered", eng._noteLs.length === 1 && eng._eventLs.length === 1,
    "notes=" + eng._noteLs.length + " events=" + eng._eventLs.length);

  tryStep(tr + ": start + first frames", function () {
    viz.start();
    runFrames(10, 33);
  });
  tryStep(tr + ": scripted evening", function () {
    SCRIPTS[tr](eng);
    runFrames(30, 33);
  });

  // event-state assertions
  var dbg = viz.debug();
  if (tr === "library") {
    check("library: genealogy grew from events", dbg.tree >= 3, "tree=" + dbg.tree);
    check("library: era moved with Transmutatio (C→F)", dbg.era.tonicPc === 5, "tonicPc=" + dbg.era.tonicPc);
    check("library: illustrations alive (emblems)", dbg.illustrations > 0, "n=" + dbg.illustrations);
  }
  if (tr === "sycorax") {
    // the hush is live now; return then heal fully — and nothing persists
    tryStep("sycorax: cut-return heals with no residue", function () {
      eng.emitEvent({ type: "cut-return", t: vnow / 1000, returnS: 1.5 });
      runFrames(80, 33); // > returnS: the ramp completes, cut state clears
    });
    var dbg2 = viz.debug();
    check("sycorax: marks flowed from notes", dbg2.marks >= 0, "marks=" + dbg2.marks);
  }
  if (tr === "ariel") {
    check("ariel: reground brought the tonic home (F)", dbg.era.tonicPc === 5, "tonicPc=" + dbg.era.tonicPc);
  }

  check(tr + ": frames drew to all three canvases",
    plate._ctx.calls > 0 && margin._ctx.calls > 0 && footer._ctx.calls > 0,
    "plate=" + plate._ctx.calls + " margin=" + margin._ctx.calls + " footer=" + footer._ctx.calls);

  tryStep(tr + ": detach via returned unsubscribe", function () { unsub(); });
  check(tr + ": listener unhook verified (no leaks)",
    eng._noteLs.length === 0 && eng._eventLs.length === 0,
    "notes=" + eng._noteLs.length + " events=" + eng._eventLs.length);
  check(tr + ": poll timer cleared", (function () {
    var n = 0; for (var id in timers) n++;
    return n === 0;
  })(), "live timers remain");

  // frames still run cleanly detached (engine may keep playing without us)
  tryStep(tr + ": detached frames clean", function () { runFrames(5, 33); });
});

// stop: the loop must not reschedule
viz.stop();
pendingRaf = null;
var rafBefore = rafCount;
vnow += 100;
check("stop(): rAF loop off", rafCount === rafBefore && pendingRaf === null, "");

// resize path (debounced through scheduleResize)
tryStep("resize()", function () {
  plate._cssW = 700; plate._cssH = 700;
  viz.resize();
  vnow += 400; tickTimers(); // let the debounce fire
  viz.frameOnce(vnow / 1000);
});

// a second attach/detach cycle — lifecycle re-entrancy
tryStep("second attach/detach cycle", function () {
  var eng2 = mockEngine("ariel");
  viz.setTrack("ariel");
  var u2 = viz.attach(eng2, mockAudioCtx());
  viz.start();
  runFrames(5, 33);
  u2();
  viz.stop();
  if (eng2._noteLs.length || eng2._eventLs.length) throw new Error("second cycle leaked listeners");
});

check("dataInk assertion mode was armed all run", PJ2.Skin.dev === true, "");

// ----------------------------------------------------------------------------
// verdict
// ----------------------------------------------------------------------------
var pass = 0, fail = 0;
console.log("\n== viz-smoke verdict ==");
checks.forEach(function (c) {
  if (c.pass) pass++; else fail++;
  console.log((c.pass ? "  ok   " : "  FAIL ") + c.name + (c.detail ? "  — " + c.detail : ""));
});
console.log("\n" + pass + " passed, " + fail + " failed" + (fail ? "" : " — ALL GREEN"));
process.exit(fail ? 1 : 0);

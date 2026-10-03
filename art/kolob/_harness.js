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
//   node _harness.js <secs> <seed> [ives] [razz] [cumulative[=<mode>]] [force=<guest>]
//                    [exp=<spec>] [stop=<secs>,…] [play=<secs>,…]
//                    [reseed=<seed>@<secs>,…] [throw=<lane>@<secs>,…]
//                    [badlistener=note|event] [desk=<secs>] [staff[=860|390]] [cost[=<file>]]
//                    [dump=<file>] [header]
//
//   ives          KolobAudio.setForceVisitation(true)   — the Ives switch
//   force=<name>  KolobAudio.setForceVisitation(name)   — one named guest
//   razz          KolobAudio.setForceRaspberry(true)
//   cumulative    KolobAudio.setCumulativeMode("always"); cumulative=<mode>
//                 that mode (always, natural or never: the Whole switch)
//   exp=<spec>    the experiments' switch, as ?exp= takes it (-name,+name,none,all)
//   stop=<secs>   KolobAudio.stop() at that time on the audio clock (the
//                 dump's timeline: the harness never holds, so it is the
//                 music's own); play=<secs> KolobAudio.play() likewise, so
//                 stop=120 play=121 is a STOP and a quick restart. Either
//                 takes a comma list or comes again (stop=120,400 play=121,402);
//                 at one time a stop goes first. A time at or past <secs> is
//                 not played (the report says so). The run's end still presses
//                 STOP as below.
//   reseed=<seed>@<secs>  KolobAudio.reseed(seed) at that time, as GATHER
//                 does (a new visit): between a stop and a play at the same
//                 time, so stop=90 reseed=11@90 play=90.5 is a STOP, a new
//                 seed and its first meeting; a comma list for several. The
//                 report prints what the old visit left the new one: the
//                 drone's note before and after the reseed.
//   throw=<lane>@<secs>  a fault: the first cue on that clock lane (conductor,
//                 drone, choir, organ, …) at or after that time throws an
//                 Error, once (THE FAULT INJECTION, below); a comma list for
//                 several (throw=drone@120,choir@200)
//   badlistener=note|event  a fault in the page: a note (or an event)
//                 listener, registered after the harness's own, that throws
//                 at every note (event) it is handed, as a bug in the staff or
//                 the minutes would (THE BAD LISTENER, below); both with
//                 badlistener=note,event. (A listener that writes into a
//                 note fails every run: THE NOTE UNWRITTEN, below.)
//   desk=<secs>   the hymnal's idle road paced: each of its slices (one hymn
//                 written on the main thread) comes <secs> after the one
//                 before, as a browser's comes after the hymn before it took
//                 that long. Without it the harness's clock stands still
//                 while a hymn is written, so a meeting's book is written at
//                 the instant it is ordered and no press can find the desk at
//                 work. (A slice is known by its function's name, idleSlice in
//                 kolob-hymnal.js; the hymnal line says how many were paced.)
//   staff[=<px>]  the page's drawing plays along (THE STAFF, below): the
//                 page's own files (_viz.php's list, or kolob-viz.js where a
//                 build has no list) drawn on canvases that record instead of
//                 painting (tools/lib/canvas.js), the staff 860 px wide at
//                 DPR 2 (staff=390: a phone's, DPR 3), the console's poll
//                 every 300 ms, a frame every 1/60 s; the report gives the
//                 digest of everything drawn, so two builds of the page fed
//                 the same meeting are held to the same drawing, frame by
//                 frame (KOLOB_DIR=<the other build> for the other side);
//                 with KOLOB_STAFF_TRACE=<file> every call is also written
//                 there (gzip), each frame marked, for tools/tracediff.js
//   cost[=<file>] what the audio graph cost, charged to the work that did it
//                 (THE COST, below): every node built, automation call and
//                 disconnect counted to the clock lane whose cue made it — on
//                 the guests' lane, to the guest it names — or to the press,
//                 and the report's cost section gives each its nodes by type,
//                 its calls and disconnects, in all and per minute of the run,
//                 its busiest minute and the notes it told, the functions that
//                 built the most, and the check that every count is
//                 accounted. With =<file> (or beside dump=, as
//                 <dump>.cost.json) the same as JSON, for tools/cost.js to
//                 hold two runs side by side. Nothing the engine does moves:
//                 the dump is the plain run's
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
// must report no late cue. The run plays until the clock passes <secs> + 3
// (pressing any scripted stop=, reseed= and play= on the way), then STOP is pressed,
// so the stop fade is exercised too, and runs 1.5 s more for the fade's own
// timers.
//
// The report: seed, seconds, the switches and the script, the engine and its
// fingerprint, meetings (one called inside a stillness's hold says so:
// "hushed at its downbeat") and sections, notes by layer, events by type, guests,
// the clock's health, the hymnal's desk, the graph the mock saw built,
// console warnings, and every error caught (a timer callback that threw, a
// cue the clock reported, an unhandled rejection). Exit 1 on any of those, or
// on a late cue; the last line is VERDICT: PASS ✓ or VERDICT: FAIL ✗, which
// tools/lib/run.js keeps. Three counts are told and not judged: the timers
// the engine left armed after the last STOP (a setTimeout, setInterval,
// requestAnimationFrame or requestIdleCallback still waiting would be a leak;
// there is none today); the sources scheduled past the run's end (the mock's
// onended for a node whose stop() lies beyond it: since PLAN-REFACTOR §4.6
// the STOP stops what was still sounding behind the doors it shuts, so none
// but a guest's teardown sentinel, left to its own time — before it, the
// drone's partials and the voices written ahead, seed 7 at 300 s 101); and
// a console.warn other than the refused
// fetch's (the harness has no network, so a room keeps the impulse response
// it poured: that warning is expected), each printed on its own line. With
// throw=, the injected throws: when each fired, who reported it, and how
// many cues its lane ran after it; an injected throw is not an error of the
// run. With badlistener=, how many notes (events) the bad listener threw at
// and how many times the engine told it, with the first line told; those
// console.errors are not the run's errors either. With a script, the presses' timers (THE PRESSES' TIMERS, below) and,
// on the hymnal's line, the hymns written while the transport stood stopped
// and the orders never written. With cost, the cost section after the graph
// line (THE COST). After the clock line, the stops: each STOP (the run's
// last too), the sources sounding at its press and those still sounding once
// its doors were shut (THE STOPS' SOURCES).
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
const OPT = { ives: false, razz: false, cumulative: false, force: null, exp: null, dump: null, header: false, script: [], throws: [], desk: null, bad: {}, staff: null, cost: null };
const FLAGS = [];                                // the switches, as given, for the header
const unknownFlags = [];
const notes = [];                                // a switch understood but not played, and why
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (a === "header") { OPT.header = true; continue; }
  if (a.indexOf("dump=") === 0) { OPT.dump = a.slice(5); continue; }
  FLAGS.push(a);
  if (a === "ives") OPT.ives = true;
  else if (a === "razz") OPT.razz = true;
  else if (a === "cumulative") OPT.cumulative = "always";
  else if (a.indexOf("cumulative=") === 0) {
    const mode = a.slice(11);
    if (mode === "always" || mode === "natural" || mode === "never") OPT.cumulative = mode;
    else notes.push(a + " is not always, natural or never: the switch is left as it stands");
  }
  else if (a.indexOf("force=") === 0) OPT.force = a.slice(6);
  else if (a.indexOf("exp=") === 0) OPT.exp = a.slice(4);
  else if (a.indexOf("stop=") === 0 || a.indexOf("play=") === 0) {
    a.slice(5).split(",").forEach((s) => {
      const t = s.trim() === "" ? NaN : Number(s);
      if (!(t >= 0 && isFinite(t))) notes.push(a.slice(0, 5) + s + " is not a time in seconds: not played");
      else if (t >= RUN) notes.push(a.slice(0, 5) + s + " lies at or past the run's end (" + RUN + " s): not played");
      else OPT.script.push({ act: a.slice(0, 4), t });
    });
  } else if (a.indexOf("reseed=") === 0) {
    a.slice(7).split(",").forEach((s) => {
      const m = /^(\d+)@(\d+(?:\.\d+)?)$/.exec(s.trim());
      if (!m) notes.push("reseed=" + s + " is not <seed>@<secs>: not pressed");
      else if (+m[2] >= RUN) notes.push("reseed=" + s + " lies at or past the run's end (" + RUN + " s): not pressed");
      else OPT.script.push({ act: "reseed", t: +m[2], seed: (+m[1] >>> 0) || 1847 });
    });
  } else if (a.indexOf("throw=") === 0) {
    a.slice(6).split(",").forEach((s) => {
      const m = /^([A-Za-z][\w-]*)@(\d+(?:\.\d+)?)$/.exec(s.trim());
      if (m) OPT.throws.push({ lane: m[1], at: +m[2], spec: m[1] + "@" + m[2] });
      else notes.push("throw=" + s + " is not <lane>@<secs>: not injected");
    });
  } else if (a.indexOf("badlistener=") === 0) {
    a.slice(12).split(",").forEach((s) => {
      const k = s.trim();
      if (k === "note" || k === "event") OPT.bad[k] = { kind: k, thrown: 0, told: 0, first: null, at: null };
      else notes.push("badlistener=" + s + " is not note or event: not registered");
    });
  } else if (a === "staff" || a.indexOf("staff=") === 0) {
    const w = a === "staff" ? 860 : +a.slice(6);
    if (w === 860 || w === 390) OPT.staff = { w };
    else notes.push(a + " is not 860 or 390: the page is not drawn");
  } else if (a === "cost" || a.indexOf("cost=") === 0) {
    OPT.cost = { file: a.length > 5 ? a.slice(5) : null };
  } else if (a.indexOf("desk=") === 0) {
    const d = Number(a.slice(5));
    if (d > 0 && isFinite(d)) OPT.desk = d;
    else notes.push(a + " is not a time in seconds: the desk is not paced");
  } else unknownFlags.push(a);
}
// the script in time order, at one time a stop, then a reseed, then a play (a
// stop and a restart, on a new seed or the same); the throws in time order,
// so on one lane the earliest arms first
const ACT_ORDER = { stop: 0, reseed: 1, play: 2 };
OPT.script.sort((x, y) => x.t - y.t || ACT_ORDER[x.act] - ACT_ORDER[y.act]);
OPT.throws.sort((x, y) => x.at - y.at);

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
  if (e && e.harnessInjected) { e.harnessInjected.reported = e.harnessInjected.reported || where; return; }   // the fault asked for (throw=), not one of the run's
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
// kind: who armed it — the engine's setTimeout, setInterval,
// requestAnimationFrame or requestIdleCallback, or the mock's own onended
// (a source's end) and decodeAudioData; the report tells them apart
function addTimer(fn, ms, args, repeat, kind) {
  const id = ++timerSeq;
  if (typeof fn !== "function") return id;
  const delay = Math.max(0, (+ms || 0) / 1000);
  // (cost: a timer runs as the work that armed it; a source's end as the work that built the source — THE COST)
  timers.set(id, { id, fn: COST && kind !== "onended" ? costAs(costNow, fn) : fn, args, next: vnow + delay, period: repeat ? Math.max(delay, 0.001) : 0, repeat, seq: id, kind });
  if (pressing && kind === "setTimeout") pressTimers.set(id, { press: pressing, ms: +ms || 0, name: fn.name || "", state: "armed", at: null, by: null, later: null, did: null });
  return id;
}
// THE PRESSES' TIMERS. A setTimeout the engine arms inside a press of the
// transport (the first PLAY, every stop=, play= and reseed=, and the run's
// last STOP) is followed: cleared (and by which press), or fired — and one
// that fires after a later press is told with what it did then (the nodes
// it disconnected, the automation calls it made, the nodes it built),
// because a press's timer that outlives the next press acts on that press's
// meeting: a STOP's 800 ms timer that fired after a PLAY and a second STOP
// disconnected the second STOP's doors halfway through its fade
// (PLAN-REFACTOR §2.3). The report prints them with a script.
const presses = [];             // { label, t, i }, in the order pressed
let pressing = null;            // the press now running
const pressTimers = new Map();  // timer id → { press, ms, name, state: armed | cleared | fired, at, by, later, did }
// THE STOPS' SOURCES. Each STOP is followed too: the sources sounding at
// its press (started, not ended, not due to stop by then), and how many of
// those still sound once its doors are shut — when the STOP's own timer
// fires (the fade done) or a PLAY comes first (it shuts them at once). Since
// PLAN-REFACTOR §4.6 the core stops what is behind the doors it shuts, all
// but a guest's teardown sentinel (kolob-core.js, THE DOORS' SOURCES), so
// the second figure is 0, or a sentinel; before it, every one ran on.
const sounding = new Set();     // sources started and not yet ended (the mock's)
const stopsSeen = [];           // { label, t, snap, at, by, still, kinds }
function soundingNow() { return [...sounding].filter((n) => n._stopAt == null || n._stopAt > vnow); }
function stopsShut(by) {
  stopsSeen.forEach((st) => {
    if (st.at != null) return;
    const still = st.snap.filter((n) => sounding.has(n) && (n._stopAt == null || n._stopAt > vnow));
    st.at = vnow; st.by = by; st.still = still.length; st.kinds = {};
    still.forEach((n) => count(st.kinds, n._kind));
  });
}
function clearTimer(id) {
  timers.delete(id);
  const pt = pressTimers.get(id);
  if (pt && pt.state === "armed") { pt.state = "cleared"; pt.at = vnow; pt.by = pressing ? pressing.label : "the engine"; }
}
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
    const pt = pressTimers.get(tm.id), was = pt ? { d: graph.disconnects, a: graph.automation, n: graph.total } : null;
    try { tm.fn.apply(null, tm.args); } catch (e) { noteError("timer callback", e); if (errors.length > 200) { fatal = true; return; } }
    finally {
      if (pt) {
        pt.state = "fired"; pt.at = vnow; pt.later = presses.slice(pt.press.i + 1).map((p) => p.label);
        if (pt.press.act === "stop") stopsShut(pt.press.label + "'s timer");
        pt.did = { disconnects: graph.disconnects - was.d, automation: graph.automation - was.a, built: graph.total - was.n };
      }
    }
    await new Promise(realSetImmediate);
  }
}
// (desk=: the hymnal's idle slices, known by their function's name, paced)
const desk = { paced: 0 };
global.setTimeout = function (fn, ms) {
  if (OPT.desk && typeof fn === "function" && fn.name === "idleSlice") { desk.paced++; ms = OPT.desk * 1000; }
  return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), false, "setTimeout");
};
global.setInterval = function (fn, ms) { return addTimer(fn, ms, Array.prototype.slice.call(arguments, 2), true, "setInterval"); };
global.clearTimeout = clearTimer;
global.clearInterval = clearTimer;
global.requestAnimationFrame = function (fn) { return addTimer(function () { fn(vnow * 1000); }, 1000 / 60, [], false, "requestAnimationFrame"); };
global.cancelAnimationFrame = clearTimer;
global.requestIdleCallback = function (fn) { return addTimer(function () { fn({ didTimeout: false, timeRemaining: () => 50 }); }, 1, [], false, "requestIdleCallback"); };
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
const graph = { created: {}, total: 0, automation: 0, contexts: 0, disconnects: 0 };
let lastCtx = null;

// ----------------------------------------------------------------------------
// THE COST (cost, cost=<file>; PLAN-REFACTOR §4.0(b)). The graph is counted
// whole above; with `cost` every node built, every automation call and every
// disconnect is also charged to the work that did it, so a change to the
// audio graph is told in numbers, layer by layer, before and after. The work
// is:
//   a lane's cue     the clock lane whose cue was running — the engine names
//                    its lanes for its layers (drone, organ, choir, strings…),
//                    and the conductor, the ward's pump, the organist's pump
//                    and the guests have lanes of their own; a piece one cue
//                    hands to another layer's pump (a line to the ward's desk,
//                    a plan to the organist's) is that pump's when it builds
//   a guest's slice  on the guests' lane, the guest the cue names — in its
//                    notes' `guest` (the testimony's notes say `testimony`),
//                    or in a guest-start, guest or guest-end event (the
//                    bearers' testimony events) — else the guest named by the
//                    work that scheduled it (a guests' cue's own guest; the
//                    conductor's tick that began the Hosanna, which names it
//                    as it begins it; the choir's cue that stages the far
//                    ward), else "guests"; what that work built itself stays
//                    its own
//   a press          PLAY, STOP and GATHER (reseed=): press:play, press:stop,
//                    press:reseed — the house built at PLAY, the doors closed
//   a source's end   the mock's onended runs as the work that built the
//                    source: a teardown is its builder's
//   a timer          a setTimeout, setInterval, requestAnimationFrame or
//                    requestIdleCallback runs as the work that armed it
//   outside          anything else (a promise settling between tasks):
//                    nothing builds there today
// The clock is watched as for throw= (THE FAULT INJECTION: its file is never
// touched), and nothing the engine does moves: no die, no cue, no record —
// the dump is the plain run's. The report's cost section gives each its cues,
// its nodes by type, automation calls and disconnects, in all and per minute
// of the run (<secs> / 60), its busiest minute and the notes it told by
// layer; the builders — the engine's function that called create… — that
// built the most; and the check: every count accounted (the buckets add up
// to the graph's), nothing outside, every bucket that told notes built
// nodes. The sidecar (cost=<file>, or <dump>.cost.json beside dump=) holds
// the same as JSON, for tools/cost.js, which holds two runs side by side.
// ----------------------------------------------------------------------------
const COST = OPT.cost ? { buckets: {}, conflicts: 0 } : null;
let costNow = null;             // the work now running: { lane, bucket, by, named, guest, settled } (a guests' cue not yet settled: bucket null, its counts pending)
function costTally(name) { return { name, cues: 0, total: 0, built: {}, automation: 0, disconnects: 0, notes: {}, sites: {}, min: [] }; }
function costBucket(name) { return COST.buckets[name] || (COST.buckets[name] = costTally(name)); }
// where a count lands: the work's bucket, or — a guests' cue that has not
// yet named its guest — its own pending counts, merged when it returns
function costTo(w) { return !w ? costBucket("outside") : w.bucket || w.pending; }
function costMin(T) { const m = Math.floor(vnow / 60); while (T.min.length <= m) T.min.push([0, 0, 0]); return T.min[m]; }
function costRun(w, fn, self, args) { const was = costNow; costNow = w; try { return fn.apply(self, args); } finally { costNow = was; } }
function costAs(w, fn) { return function () { return costRun(w, fn, this, arguments); }; }
// the builder: the first function on the stack outside the harness — the
// engine's own call of create… (or new …Node); the core's madeInDoors, which
// writes a source into the meeting's doors on its way (kolob-core.js, THE
// DOORS' SOURCES), is looked through to the room that called it
const HARNESS_FILE = __filename;
function costSite() {
  const o = {}, lim = Error.stackTraceLimit, prep = Error.prepareStackTrace;
  Error.stackTraceLimit = 9; Error.prepareStackTrace = (e, frames) => frames;
  try {
    Error.captureStackTrace(o, costSite);
    for (const f of o.stack) { const file = f.getFileName(); if (file && file !== HARNESS_FILE && f.getFunctionName() !== "madeInDoors") return (f.getFunctionName() || "(anonymous)") + " (" + path.basename(file) + ":" + f.getLineNumber() + ")"; }
    return "(the harness)";
  } finally { Error.prepareStackTrace = prep; Error.stackTraceLimit = lim; }
}
function costBuilt(n, kind) {
  n._costBy = costNow;
  const T = costTo(costNow), site = costSite(), s = T.sites[site] || (T.sites[site] = {});
  T.total++; T.built[kind] = (T.built[kind] || 0) + 1; costMin(T)[0]++;
  s[kind] = (s[kind] || 0) + 1;
}
function costCharge(i) { const T = costTo(costNow); if (i === 1) T.automation++; else T.disconnects++; costMin(T)[i]++; }   // 1 an automation call, 2 a disconnect
// the work names a guest (the first it names; a second is counted): a
// guests' cue is that guest's, and a guests' cue it schedules inherits it
function costNamed(guest) {
  const w = costNow;
  if (!guest || !w || w.settled) return;
  if (!w.named) w.named = guest; else if (w.named !== guest) w.conflict = true;
}
function costTold(layer, guest) { const T = costTo(costNow); T.notes[layer] = (T.notes[layer] || 0) + 1; costNamed(guest); }
// a cue begins (by: the work that scheduled it) and returns; a press is work
// of its own (cues counts the presses)
function costWork(lane, bucket, by) { return { lane, bucket, pending: bucket ? null : costTally(null), by: bucket ? null : by, named: null, conflict: false, guest: null, settled: false }; }
function costCue(lane, by) { return lane === "guests" ? costWork(lane, null, by) : costWork(lane, costBucket(lane)); }
function costSettle(w) {
  w.settled = true;
  if (!w.bucket) {
    w.guest = w.named || (w.by ? w.by.guest : null);
    w.bucket = costBucket(w.guest ? "guest:" + w.guest : "guests");
    costMerge(w.bucket, w.pending);
    if (w.conflict) COST.conflicts++;
    w.pending = null; w.by = null;
  } else w.guest = w.conflict ? null : w.named;      // (for the guests' cues it schedules: a work that named two names none)
  w.bucket.cues++;
}
function costPress(act, fn) { const w = costWork(null, costBucket("press:" + act)); try { return costRun(w, fn); } finally { costSettle(w); } }
function costMerge(B, T) {
  const add = (to, from) => Object.keys(from).forEach((k) => { to[k] = (to[k] || 0) + from[k]; });
  B.total += T.total; B.automation += T.automation; B.disconnects += T.disconnects;
  add(B.built, T.built); add(B.notes, T.notes);
  Object.keys(T.sites).forEach((s) => add(B.sites[s] || (B.sites[s] = {}), T.sites[s]));
  T.min.forEach((m, i) => { while (B.min.length <= i) B.min.push([0, 0, 0]); for (let j = 0; j < 3; j++) B.min[i][j] += m[j]; });
}

function automated() { graph.automation++; if (COST) costCharge(1); }
function mkParam(owner, name, init) {
  const p = { _label: owner + "." + name, _v: +init, defaultValue: +init, minValue: -3.4028234663852886e38, maxValue: 3.4028234663852886e38, automationRate: "a-rate" };
  Object.defineProperty(p, "value", { enumerable: true, get() { return p._v; }, set(v) { p._v = +v; } });
  p.setValueAtTime = function (v) { automated(); p._v = +v; return p; };
  p.linearRampToValueAtTime = function (v) { automated(); p._v = +v; return p; };
  p.exponentialRampToValueAtTime = function (v) { automated(); p._v = +v; return p; };
  p.setTargetAtTime = function (v) { automated(); p._v = +v; return p; };
  p.setValueCurveAtTime = function (curve) { automated(); if (curve && curve.length) p._v = +curve[curve.length - 1]; return p; };
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
  n.disconnect = function () { graph.disconnects++; if (COST) costCharge(2); };
  n.addEventListener = function (type, fn) { if (type === "ended") (n._ended = n._ended || []).push(fn); };
  n.removeEventListener = function (type, fn) { if (n._ended) n._ended = n._ended.filter((f) => f !== fn); };
  n.dispatchEvent = function () { return true; };
  for (const k in spec[0]) n[k] = mkParam(kind, k, spec[0][k]);
  for (const k in spec[1]) n[k] = spec[1][k];
  if (spec[2]) {
    n.onended = null; n._started = null; n._stopAt = null; n._endTimer = null;
    const armEnded = (at) => {
      if (n._endTimer != null) clearTimer(n._endTimer);
      const ended = function () {
        n._endTimer = null; n._gone = true; sounding.delete(n);
        const ev = { type: "ended", target: n };
        if (typeof n.onended === "function") n.onended(ev);
        (n._ended || []).forEach((f) => f(ev));
      };
      n._endTimer = addTimer(COST ? costAs(n._costBy, ended) : ended, Math.max(0, at - ctx.currentTime) * 1000, [], false, "onended");
    };
    n.start = function (when, offset, dur) {
      if (n._started != null) throw new Error("InvalidStateError: " + kind + ".start() called twice");
      n._started = when != null ? +when : ctx.currentTime;
      sounding.add(n);
      if (dur != null) armEnded(n._started + dur / (n.playbackRate ? n.playbackRate.value || 1 : 1));
      else if (kind === "BufferSource" && !n.loop && n.buffer && n.buffer.duration) armEnded(n._started + (n.buffer.duration - (offset || 0)) / (n.playbackRate.value || 1));
    };
    // (a later stop() moves the end, as a browser's does, until the source
    // has stopped: once its stop time is reached a stop() changes nothing,
    // and its onended is not fired again; and a source stopped before its
    // start never sounds and ends at its stop time — both as Chrome and
    // WebKit keep a source. Nothing called for either before a STOP stopped
    // the sources behind the doors it shuts, PLAN-REFACTOR §4.6)
    n.stop = function (when) {
      if (n._started == null) throw new Error("InvalidStateError: " + kind + ".stop() before start()");
      if (n._gone || (n._stopAt != null && n._stopAt <= ctx.currentTime)) return;
      n._stopAt = when != null ? +when : ctx.currentTime;
      armEnded(n._stopAt);
    };
    n.setPeriodicWave = function (w) { n._wave = w; n.type = "custom"; };
  }
  graph.created[kind] = (graph.created[kind] || 0) + 1; graph.total++;
  if (COST) costBuilt(n, kind);
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
    if (typeof ok === "function") addTimer(() => ok(b), 0, [], false, "decodeAudioData");
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
try { Object.defineProperty(global, "navigator", { configurable: true, writable: true, value: { userAgent: "kolob-harness (node " + process.version + ")", language: "en", languages: ["en"], platform: process.platform, hardwareConcurrency: 4, onLine: true, mediaSession: undefined, vibrate() { return false; } } }); } catch (e) { /* a Node whose navigator cannot be replaced: its own serves */ }
(function () {
  const store = new Map();
  const ls = {
    getItem(k) { return store.has(String(k)) ? store.get(String(k)) : null; },
    setItem(k, v) { store.set(String(k), String(v)); }, removeItem(k) { store.delete(String(k)); }, clear() { store.clear(); },
    key(i) { return [...store.keys()][i] || null; }, get length() { return store.size; },
  };
  try { Object.defineProperty(global, "localStorage", { configurable: true, writable: true, value: ls }); } catch (e) { /* a Node whose storage cannot be replaced: its own serves */ }
  try { Object.defineProperty(global, "sessionStorage", { configurable: true, writable: true, value: ls }); } catch (e) { /* a Node whose storage cannot be replaced: its own serves */ }
})();
global.Worker = undefined;                       // the hymnal falls back to its idle slices
const NO_NETWORK = "the harness has no network";
global.fetch = function (url) { return Promise.reject(new Error(NO_NETWORK + " (fetch " + url + " refused)")); };
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

// ----------------------------------------------------------------------------
// THE FAULT INJECTION (throw=<lane>@<secs>). The clock the engine makes is
// watched lane by lane: once the substrate has loaded, PJ2.Clock.create is
// wrapped here (its file is never touched), and each lane's at/in/every hands
// the clock a callback of the harness's that counts the cue and runs the
// engine's own. The first cue on an asked lane whose time is at or after the
// asked one throws an Error, once, from inside its own callback: the moment
// it schedules on its own lane — a layer's and the conductor's re-arm, the
// last thing they do, is refused — or, if it schedules nothing there, as it
// returns. So the throw lands where a fault in the cue's body would: a
// try/finally in the engine sees it, and it is caught and reported — by the
// clock (onError → console.error), or by the core's net under a layer's turn,
// the same way — and the report files it with its injection, not among the
// run's errors. Then the report says how many cues the lane ran after it, and how
// many sections the meeting began: the proof that the engine recovers
// (PLAN-REFACTOR §2.1) — a layer's turn re-armed by the core's net 5 s after
// it threw, the conductor's tick 0.6 s after, the ward's and the organist's
// pumps at their own pace; a hymn whose chain broke let go, so the meeting
// moves on (the choir's lane carries more than one chain — its verse loop,
// a hymn's lines — so its own count runs on either way).
// Without throw= (or cost, which watches the lanes the same way to charge
// each cue's work to its lane: THE COST) nothing is wrapped.
// ----------------------------------------------------------------------------
const INJ = OPT.throws.map((x) => ({ lane: x.lane, at: x.at, spec: x.spec, marker: "the harness's injected throw (throw=" + x.spec + ")", t: null, how: null, reported: null, before: 0, after: 0, firstAfter: null }));
const laneCues = {};            // lane → the cues the clock ran on it (with throw= only)
let cueNow = null;              // the cue whose callback is running: { lane, t, armed }
function watchClock() {
  const C = global.PJ2 && global.PJ2.Clock;
  if ((!INJ.length && !COST) || !C || typeof C.create !== "function") return;
  const create = C.create;
  C.create = function (ctx, opts) {
    const clock = create(ctx, opts), laneOf = clock.lane, seen = new Set();
    clock.lane = function (name) {
      const api = laneOf(name);
      if (!seen.has(api)) {
        seen.add(api);
        const guard = () => { if (cueNow && cueNow.armed && cueNow.lane === name) fire(cueNow, "as it scheduled on its own lane"); };
        const wrap = (fn) => (typeof fn === "function" ? watched(name, fn, costNow) : fn);
        const at = api.at, inS = api.in, every = api.every;
        api.at = function (when, fn) { guard(); return at(when, wrap(fn)); };
        api.in = function (dt, fn) { guard(); return inS(dt, wrap(fn)); };
        api.every = function (fn) { guard(); return every(wrap(fn)); };
      }
      return api;
    };
    return clock;
  };
}
function watched(lane, fn, by) {
  return function (tt) {
    laneCues[lane] = (laneCues[lane] || 0) + 1;
    const c = { lane, t: tt, armed: null };
    INJ.forEach((j) => {
      if (j.lane !== lane) return;
      if (j.t != null) { j.after++; if (j.firstAfter == null) j.firstAfter = tt; }
      else if (!c.armed && tt >= j.at) c.armed = j;
    });
    const was = cueNow, w = COST ? costCue(lane, by) : null, wasW = costNow;
    cueNow = c;
    if (w) costNow = w;
    let r;
    try { r = fn(tt); } finally { cueNow = was; if (w) { costNow = wasW; costSettle(w); } }
    if (c.armed) fire(c, "as it returned (it scheduled nothing on its own lane)");
    return r;                                    // an .every callback's next delay
  };
}
function fire(c, how) {
  const j = c.armed;
  c.armed = null;
  j.t = c.t; j.how = how; j.before = laneCues[c.lane] - 1;
  const e = new Error(j.marker + " on the " + c.lane + " lane at " + c.t.toFixed(3) + " s");
  e.harnessInjected = j;
  throw e;
}

// console: the engine's warnings are kept for the report, the refused
// fetch's (NO_NETWORK: a room's impulse response) apart from the rest; a cue
// the clock reports (console.error from PJ2.Clock's onError) is an error of
// the run — unless it is the throw the run asked for, filed with its injection
const warns = [], consoleErrors = [];
function fmtArgs(args) { return Array.prototype.map.call(args, (a) => (a instanceof Error ? a.message : typeof a === "string" ? a : (() => { try { return JSON.stringify(a); } catch (e) { return String(a); } })())).join(" "); }
function injectionIn(args) {                     // the injected Error itself, or its message quoted
  for (const a of args) {
    if (a && a.harnessInjected) return a.harnessInjected;
    if (typeof a === "string") { const j = INJ.find((x) => x.t != null && a.indexOf(x.marker) >= 0); if (j) return j; }
  }
  return null;
}
console.warn = function () {
  const j = injectionIn(arguments);
  if (j) { j.reported = j.reported || "console.warn"; return; }
  warns.push({ t: vnow, msg: fmtArgs(arguments) });
};
console.error = function () {
  const j = injectionIn(arguments);
  if (j) { j.reported = j.reported || "console.error"; return; }
  const b = Array.prototype.find.call(arguments, (a) => a && a.harnessBadListener);
  if (b) { const bl = b.harnessBadListener; bl.told++; if (bl.first == null) { bl.first = String(arguments[0]); bl.at = musicNow(); } return; }
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
watchClock();                                    // throw=: the clock PLAY makes is watched (above)

// ----------------------------------------------------------------------------
// THE NOTE UNWRITTEN. The engine builds a note once and hands the same
// object to every note listener (kolob-core.js, ONE NOTE, ONE OBJECT), so a
// listener that wrote into it would be read by the next — where each was
// once handed its own copy, and a write stayed its writer's. The rule is now
// that none writes, and the harness holds every note listener to it, the
// page's drawing (staff=) among them: each is registered through a wrapper,
// and the first to be handed a note freezes it (its own fields; what it
// carries, a telegraph's marks or a monzo, is the engine's), so a write —
// every listener here is strict code — throws, is passed over and told as
// any listener's fault is (THE FAULTS), and fails the run (a
// console.error). The listeners keep their numbers in what the engine
// tells. A listener that throws is still only passed over (THE BAD
// LISTENER, below).
// ----------------------------------------------------------------------------
const setNoteListener = K.setNoteListener;
K.setNoteListener = function (fn) {
  return setNoteListener(function (n) { if (n && typeof n === "object" && !Object.isFrozen(n)) Object.freeze(n); return fn(n); });
};

// ----------------------------------------------------------------------------
// THE STAFF (staff=): the page's drawing, played along. Its files are read
// from _viz.php's list (kolob-viz.js alone in a build older than the list),
// in that order, after the engine, as the page's tags load them; its
// canvases record (tools/lib/canvas.js), the plates the size the page lays
// them out at (860 px: the staff 687 × 240, the wheel 687 × 200, DPR 2; 390
// px, a phone: 316 × 196 and 316 × 150, DPR 3). init() before PLAY, as the
// page's load calls it; the console's poll (kolob-ui.js poll(): the
// conductor, playing, held) every 300 ms (the page's stands still while the
// meeting is stopped, where nothing the drawing reads of it moves: this one
// runs on, and hands it the same); a frame every 1/60 s. The digest
// of everything drawn is told minute by minute and whole. The analyser the
// facade reads is the mock's, which hears nothing: the organ stands at rest.
// KOLOB_STAFF_TRACE=<file>: every call the digest takes in is also written
// to that file, gzip'd a few megabytes at a time (each piece a gzip member
// of its own: gunzip reads them as one), with `#F <n>` before frame n's
// calls — what tools/tracediff.js reads, two builds frame by frame.
// ----------------------------------------------------------------------------
const staff = OPT.staff ? { files: [], frames: 0, rec: null, minutes: [], error: null, trace: null } : null;
if (staff && process.env.KOLOB_STAFF_TRACE) {
  const zlib = require("zlib"), fd = fs.openSync(process.env.KOLOB_STAFF_TRACE, "w");
  let parts = [], size = 0;
  const flush = () => { if (size) fs.writeSync(fd, zlib.gzipSync(parts.join(""))); parts = []; size = 0; };
  staff.trace = { fd, flush, write(line) { parts.push(line); size += line.length; if (size > (4 << 20)) flush(); } };
  process.on("exit", () => { flush(); fs.closeSync(fd); });
}
if (staff) {
  const REC = require(path.join(__dirname, "tools", "lib", "canvas.js")).recorder(staff.trace ? { trace: staff.trace.write } : null);
  staff.rec = REC;
  global.Path2D = REC.Path2D;
  global.devicePixelRatio = OPT.staff.w === 390 ? 3 : 2;
  const mkPlain = document.createElement;
  document.createElement = function (tag) { return String(tag).toLowerCase() === "canvas" ? REC.canvas(0, 0) : mkPlain(tag); };
  const vizPhp = path.join(ENGINE_DIR, "_viz.php");
  if (fs.existsSync(vizPhp)) {
    const src = fs.readFileSync(vizPhp, "utf8"), body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
    const re = /'([^']+\.js)'/g;
    let m;
    while ((m = re.exec(body))) staff.files.push(path.join(ENGINE_DIR, m[1]));
  } else staff.files.push(path.join(ENGINE_DIR, "kolob-viz.js"));
  for (const file of staff.files) {
    try { vm.runInThisContext(fs.readFileSync(file, "utf8"), { filename: file }); }
    catch (e) { staff.error = path.basename(file) + ": " + e.message; break; }
  }
  if (!staff.error && !(global.KolobViz && typeof global.KolobViz.init === "function")) staff.error = "no KolobViz after " + staff.files.length + " file(s)";
  if (staff.error) {
    realConsole.log("LOAD the page's drawing: " + staff.error);
    realConsole.log("VERDICT: FAIL ✗ (the page's drawing failed to load)");
    process.exitCode = 1;
    return;
  }
  const raf = global.requestAnimationFrame;
  global.requestAnimationFrame = function (fn) { return raf(function (ts) { staff.frames++; REC.mark("F " + staff.frames); fn(ts); }); };
  const phone = OPT.staff.w === 390;
  global.KolobViz.init(REC.canvas(phone ? 316 : 687, phone ? 196 : 240), REC.canvas(phone ? 316 : 687, phone ? 150 : 200));
  setInterval(function () {
    const playing = !!(K.isPlaying && K.isPlaying());
    global.KolobViz.setConductor((K.getConductor && K.getConductor()) || {}, playing, playing && !!(K.isPaused && K.isPaused()));
  }, 300);
  setInterval(function () { staff.minutes.push(REC.digest().slice(0, 8)); }, 60000);
}

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
function hushedNow() { try { return !!(S && typeof S.inHush === "function" && S.inHush()); } catch (e) { return false; } }
// reseed=: what the old visit leaves the new one — the drone's note
function droneSaid() {
  try {
    const d = S && typeof S.droneNote === "function" ? S.droneNote() : null;
    return d ? "×" + +d.mul.toFixed(4) + " " + d.role + (d.k != null ? " (cantus " + d.k + ")" : "") : "(no drone note on this build)";
  } catch (e) { return "(the drone's note could not be read: " + e.message + ")"; }
}
const reseeds = [];             // { seed, t, playing, before, after }
// a press of the transport: its timers followed (THE PRESSES' TIMERS,
// above), and the hymns the desk wrote while the transport stood stopped
// counted — from a STOP of a playing meeting to the next PLAY, or to the
// run's end
const stopped = { since: null, written: 0 };
function composedNow() { const h = typeof K.hymnalStats === "function" ? safe(() => K.hymnalStats()) : null; return h ? h.composed : 0; }
function press(act, label, fn) {
  const wasPlaying = !!(K.isPlaying && K.isPlaying());
  if (act === "play" && !wasPlaying && stopped.since != null) { stopped.written += composedNow() - stopped.since; stopped.since = null; }
  if (act === "stop" && wasPlaying) stopped.since = composedNow();
  const p = { label, t: vnow, i: presses.length, act };
  presses.push(p);
  const was = pressing;
  pressing = p;
  try { return COST ? costPress(act, fn) : fn(); } finally {
    pressing = was;
    if (act === "stop") stopsSeen.push({ label, t: vnow, snap: soundingNow(), at: null });
    if (act === "play") stopsShut(label);
  }
}
K.setNoteListener(function (n) {
  const t = musicNow();
  tally.notes++; count(tally.byLayer, n && n.layer || "?");
  if (COST) costTold(n && n.layer || "?", n && (typeof n.guest === "string" ? n.guest : n.testimony ? "testimony" : null));
  record("N", t, n);
});
K.setEventListener(function (ev) {
  const t = typeof ev.t === "number" ? ev.t : musicNow();
  tally.events++;
  const type = ev && (ev.type || ev.cat) || "?";
  count(tally.byType, type);
  // (a meeting called inside a stillness's hold is told: the conductor
  // refuses a guest, a fuging and another stillness until the hold ends)
  if (ev.type === "meeting-start" || (!ev.type && ev.cat === "meeting" && /meeting \d+/.test(ev.label || ""))) tally.meetings.push({ t, n: ev.n, mode: ev.mode, kind: ev.kind, sunday: ev.sunday, keynoteHz: ev.keynoteHz, houseDialect: ev.houseDialect, label: ev.label, detail: ev.detail, hushed: hushedNow() });
  if (ev.type === "section-start" || (!ev.type && ev.cat === "section")) tally.sections.push({ t, section: ev.section || String(ev.label || "").replace(/^[^A-Za-z]*/, "").toLowerCase(), dur: ev.dur });
  if (ev.type === "guest-start") count(tally.guests, ev.guest || "?");
  if (ev.type === "cadence") count(tally.cadences, ev.kind || "?");
  if (COST) costNamed(ev.type === "testimony" ? "testimony" : /^guest(-start|-end)?$/.test(ev.type) && typeof ev.guest === "string" ? ev.guest : null);
  record("E", t, ev);
});
// THE BAD LISTENER (badlistener=note|event): a listener of the page's with
// a bug in it — registered after the harness's own, so the dump is the
// clean run's — that throws at every note (event) it is handed. The engine
// passes it over and tells its fault (kolob-core.js, THE FAULTS: once per
// listener, then every thousandth); each console.error that carries its
// throw is filed with it, as an injected throw is, not among the run's
// errors, and the report says how many it threw and how many the engine
// told, with the first line told. Told none: the engine swallowed them all.
Object.keys(OPT.bad).forEach((k) => {
  const b = OPT.bad[k];
  K[k === "note" ? "setNoteListener" : "setEventListener"](function () {
    b.thrown++;
    const e = new Error("the harness's bad " + k + " listener (badlistener=" + k + ")");
    e.harnessBadListener = b;
    throw e;
  });
});

// the switches, before PLAY (the planner reads them when the meeting is called)
if (OPT.ives && K.setForceVisitation) K.setForceVisitation(true);
if (OPT.force && K.setForceVisitation) K.setForceVisitation(OPT.force);
if (OPT.razz && K.setForceRaspberry) K.setForceRaspberry(true);
if (OPT.cumulative && K.setCumulativeMode) K.setCumulativeMode(OPT.cumulative);
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
  try { press("play", "play@0", () => K.play()); } catch (e) { playError = e; noteError("play()", e); }
  if (!playError) {
    // the script (stop=, reseed=, play=): each pressed at its time, in time order
    for (const s of OPT.script) {
      await advance(s.t);
      if (fatal) break;
      if (s.act === "reseed") {
        const r = { seed: s.seed, t: s.t, playing: !!(K.isPlaying && K.isPlaying()), before: droneSaid(), after: null };
        try { press("reseed", "reseed " + s.seed + "@" + s.t, () => K.reseed(s.seed)); } catch (e) { noteError("reseed(" + s.seed + ") at " + s.t + " s", e); }
        r.after = droneSaid();
        reseeds.push(r);
        continue;
      }
      try { press(s.act, s.act + "@" + s.t, () => K[s.act]()); } catch (e) { noteError(s.act + "() at " + s.t + " s", e); }
    }
    await advance(RUN + 3);
    try { press("stop", "stop@" + (RUN + 3) + " (the run's end)", () => K.stop()); } catch (e) { noteError("stop()", e); }
    if (!fatal) await advance(vnow + 1.5);       // the stop fade's own timers
    if (stopped.since != null) { stopped.written += composedNow() - stopped.since; stopped.since = null; }
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
    try { fs.mkdirSync(path.dirname(file), { recursive: true }); } catch (e) { /* the folder stands, or the write below says why not */ }
    fs.writeFileSync(file, out.concat(dumpLines).join("\n") + "\n");
  }
  // ---- the cost's sidecar (THE COST) ----
  const costed = COST ? costSummary() : null;
  const costFile = COST ? OPT.cost.file || (OPT.dump ? OPT.dump.replace(/\.jsonl$/, "") + ".cost.json" : null) : null;
  if (costFile) costWrite(path.resolve(costFile), costed);

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

  const SWITCHES = FLAGS.filter((f) => !/^(stop|play|reseed|throw|badlistener)=/.test(f));   // the script, the throws and the bad listener have their own say
  L("=== KOLOB harness ===  seed " + SEED + " · " + RUN + " s" + (SWITCHES.length ? " · flags " + SWITCHES.join(",") : "") +
    (OPT.script.length ? " · script " + OPT.script.map((s) => s.act + (s.act === "reseed" ? " " + s.seed : "") + "@" + s.t).join(" ") : "") + (INJ.length ? " · throw " + INJ.map((j) => j.spec).join(",") : "") + (Object.keys(OPT.bad).length ? " · badlistener " + Object.keys(OPT.bad).join(",") : "") +
    (OPT.dump ? " · dump " + path.resolve(OPT.dump) + (OPT.header ? " (header)" : "") : ""));
  L("engine: " + loaded.length + " module" + (loaded.length === 1 ? "" : "s") + " from " + ENGINE_DIR + (LEGACY ? " (single-file " + path.basename(LEGACY) + ")" : " (the list in " + LIST.from + ")") + " · fingerprint " + FINGERPRINT);
  if (unknownFlags.length) L("note: unknown flag(s) " + unknownFlags.join(", ") + " (passed to the header, otherwise ignored)");
  notes.forEach((m) => L("note: " + m));
  const M = tally.meetings;
  L("meetings: " + M.length + M.map((m) => " · #" + (m.n != null ? m.n : "?") + " at " + m.t.toFixed(1) + " s: " + [m.mode, m.kind, m.sunday, m.keynoteHz ? m.keynoteHz.toFixed(1) + " Hz" : null, m.houseDialect].filter(Boolean).join(" · ") + (m.mode ? "" : " " + (m.label || "") + " " + (m.detail || "")) + (m.hushed ? " · hushed at its downbeat" : "")).join(""));
  reseeds.forEach((r) => L("reseed " + r.seed + " at " + r.t + " s (" + (r.playing ? "playing" : "stopped") + "): the drone's note " + r.before + " → " + r.after));
  L("sections: " + tally.sections.length + (tally.sections.length ? " · " + tally.sections.map((s) => s.section + "@" + s.t.toFixed(1)).join(" ") : ""));
  L("notes: " + tally.notes + " · by layer " + JSON.stringify(sortedCounts(tally.byLayer)));
  L("events: " + tally.events + " · by type " + JSON.stringify(sortedCounts(tally.byType, 16)));
  L("guests: " + (Object.keys(tally.guests).length ? JSON.stringify(tally.guests) : "none") + " · cadences " + (Object.keys(tally.cadences).length ? JSON.stringify(tally.cadences) : "none"));
  // what is still armed at the end: the engine's own timers (a leak, if any)
  // apart from the mock's onended for a source whose stop() lies past the end
  const left = {}, ends = [];
  timers.forEach((tm) => { if (tm.kind === "onended") ends.push(tm.next); else if (tm.kind !== "decodeAudioData") count(left, tm.kind); });
  const nLeft = Object.keys(left).reduce((a, k) => a + left[k], 0);
  L("clock: " + (health ? health.cues + " cues · " + health.late + " late · max late " + health.maxLate + " s" : "(no clockHealth on this build)") +
    " · " + nLeft + " timer(s) still armed after STOP" + (nLeft ? " (" + Object.keys(left).map((k) => k + " " + left[k]).join(", ") + ")" : "") +
    " · " + ends.length + " source(s) scheduled past the run's end" + (ends.length ? " (due " + ends.reduce((a, x) => Math.min(a, x), Infinity).toFixed(1) + "–" + ends.reduce((a, x) => Math.max(a, x), 0).toFixed(1) + " s)" : ""));
  // each STOP: the sources sounding at its press, and those still sounding once its doors were shut (THE STOPS' SOURCES)
  if (stopsSeen.length) L("stops: " + stopsSeen.map((st) => st.label + ": " + st.snap.length + " source(s) sounding → " + (st.at == null ? "its doors never shut" :
    st.still + " once its doors were shut (" + st.at.toFixed(3) + " s, by " + st.by + ")" + (st.still ? " " + JSON.stringify(st.kinds) : ""))).join(" · "));
  if (INJ.length) {
    const cues = Object.keys(laneCues).reduce((a, k) => a + laneCues[k], 0);
    L("cues by lane: " + cues + " " + JSON.stringify(sortedCounts(laneCues)) + " · the clock counted " + (health ? health.cues : "?"));
    INJ.forEach((j) => L("throw " + j.spec + ": " + (j.t == null
      ? "never thrown — no cue on the " + j.lane + " lane at or after " + j.at + " s" + (laneCues[j.lane] ? "" : " (the lane ran no cue at all)")
      : "thrown at " + j.t.toFixed(3) + " s, " + j.how + "; reported by " + (j.reported || "nobody") +
        " · the " + j.lane + " lane ran " + j.after + " cue(s) after it" + (j.after ? ", the first at " + j.firstAfter.toFixed(3) + " s" : "") + " (" + j.before + " before)" +
        " · the meeting began " + tally.sections.filter((x) => x.t > j.t).length + " section(s) after it")));
  }
  Object.keys(OPT.bad).forEach((k) => {
    const b = OPT.bad[k];
    L("badlistener=" + k + ": the listener threw at " + b.thrown + " " + k + "(s); the engine told it " + b.told + " time(s) by console.error" +
      (b.first != null ? ", the first at " + b.at.toFixed(3) + " s: " + b.first : " — it swallowed every one"));
  });
  if (OPT.script.length) {
    // THE PRESSES' TIMERS: what each press armed, and what became of it
    const pts = [...pressTimers.values()], fired = pts.filter((x) => x.state === "fired");
    const late = fired.filter((x) => x.later.length), byLater = pts.filter((x) => x.state === "cleared" && x.by !== x.press.label);
    const who = (x) => x.press.label + "'s " + +x.ms.toFixed(3) + " ms timer" + (x.name ? " (" + x.name + ")" : "");
    L("presses: " + presses.length + " (" + presses.map((p) => p.label).join(", ") + ") · their timers: " + pts.length + " armed, " +
      pts.filter((x) => x.state === "cleared").length + " cleared (" + byLater.length + " by a later press), " + fired.length + " fired (" + late.length + " after a later press), " +
      pts.filter((x) => x.state === "armed").length + " still armed");
    // (told: every timer that fired after a later press, and every other
    // that touched the graph — a STOP's, disconnecting its doors)
    const told = fired.filter((x) => x.later.length || x.did.disconnects || x.did.automation || x.did.built);
    told.slice(0, 8).forEach((x) => L("  " + who(x) + " fired at " + x.at.toFixed(3) + " s" + (x.later.length ? ", after " + x.later.join(", ") : "") + ": " +
      x.did.disconnects + " node(s) disconnected, " + x.did.automation + " automation call(s), " + x.did.built + " node(s) built"));
    byLater.slice(0, 8).forEach((x) => L("  " + who(x) + " cleared by " + x.by + " at " + x.at.toFixed(3) + " s"));
    if (told.length > 8 || byLater.length > 8) L("  … and " + (Math.max(0, told.length - 8) + Math.max(0, byLater.length - 8)) + " more");
  }
  // (with a script or desk=: the hymns written while the transport stood
  // stopped, and the orders left unwritten at the end)
  const unwritten = (OPT.script.length || OPT.desk) && KOLOB.Hymnal && typeof KOLOB.Hymnal.book === "function"
    ? (safe(() => KOLOB.Hymnal.book()) || []).filter((b) => b.state === "queued" || b.state === "posted").length : null;
  if (hymnal) L("hymnal: backend " + hymnal.backend + " (worker " + hymnal.worker + ") · posted " + hymnal.posted + " · composed " + hymnal.composed + " (idle " + hymnal.byIdle + ", worker " + hymnal.byWorker + ") · late " + hymnal.late + " (in a cue " + hymnal.lateInCue + ") · failed " + hymnal.failed +
    (unwritten != null ? " · written while stopped " + stopped.written + " · " + unwritten + " order(s) never written" : "") +
    (OPT.desk ? " · desk " + OPT.desk + " s a slice, " + desk.paced + " slice(s) paced" : ""));
  L("graph: " + graph.contexts + " context(s) · " + graph.total + " nodes " + JSON.stringify(sortedCounts(graph.created, 10)) + " · " + graph.automation + " automation calls");
  if (COST) costReport(L, costed, costFile);
  if (staff) L("staff: " + OPT.staff.w + " px · " + staff.files.length + " file(s) of the page's drawing · " + staff.frames + " frames · " + staff.rec.calls + " canvas calls on " + staff.rec.canvases + " canvases, " + staff.rec.paths + " paths · digest " + staff.rec.digest().slice(0, 16) +
    " · by minute " + (staff.minutes.length ? staff.minutes.join(" ") : "—"));
  if (OPT.dump) L("dump: " + dumpLines.length + " records" + (OPT.header ? " + header" : "") + (tally.unserialisable ? " · " + tally.unserialisable + " NOT serialisable" : ""));
  const fetchWarns = warns.filter((w) => w.msg.indexOf(NO_NETWORK) >= 0).length, otherWarns = warns.filter((w) => w.msg.indexOf(NO_NETWORK) < 0);
  L("console.warn: " + otherWarns.length + (fetchWarns ? " · and " + fetchWarns + " from the refused fetch (expected: no network here, so a room keeps the impulse response it poured)" : ""));
  otherWarns.slice(0, 5).forEach((w, i) => L("  warn " + (i + 1) + " @ " + w.t.toFixed(3) + " s: " + w.msg.slice(0, 300)));
  if (otherWarns.length > 5) L("  … and " + (otherWarns.length - 5) + " more");
  L("errors: " + errors.length + " caught · " + consoleErrors.length + " console.error");
  errors.slice(0, 5).forEach((e, i) => L("  error " + (i + 1) + " (" + e.where + " @ " + e.t.toFixed(3) + " s): " + e.msg + (e.stack ? "\n    " + e.stack.split("\n").slice(0, 6).join("\n    ") : "")));
  consoleErrors.slice(0, 5).forEach((e, i) => L("  console.error " + (i + 1) + " @ " + e.t.toFixed(3) + " s: " + e.msg.slice(0, 300) + (e.stack ? "\n    " + e.stack.split("\n").slice(0, 6).join("\n    ") : "")));
  L(fails.length ? "VERDICT: FAIL ✗ (" + fails.join("; ") + ")" : "VERDICT: PASS ✓");
  process.exitCode = fails.length ? 1 : 0;
})().catch((e) => { noteError("main", e); realConsole.log("VERDICT: FAIL ✗ (" + e.message + ")\n" + (e.stack || "")); process.exitCode = 1; });

function safe(fn) { try { return fn(); } catch (e) { noteError("report", e); return null; } }

// THE COST, summed: the buckets, the builders across them, and the check
// that every count the graph made is in a bucket
function costSummary() {
  const B = Object.keys(COST.buckets).map((k) => COST.buckets[k]).sort((a, b) => b.total - a.total || b.automation - a.automation || b.disconnects - a.disconnects || (a.name < b.name ? -1 : 1));
  const by = {};
  B.forEach((b) => Object.keys(b.sites).forEach((s) => {
    const x = by[s] || (by[s] = { site: s, total: 0, built: {}, buckets: {} });
    Object.keys(b.sites[s]).forEach((k) => { const n = b.sites[s][k]; x.total += n; x.built[k] = (x.built[k] || 0) + n; x.buckets[b.name] = (x.buckets[b.name] || 0) + n; });
  }));
  const sum = (f) => B.reduce((a, b) => a + f(b), 0), notesOf = (b) => Object.keys(b.notes).reduce((a, k) => a + b.notes[k], 0);
  const out = COST.buckets.outside || costTally("outside"), told = B.filter((b) => notesOf(b) > 0);
  return {
    buckets: B,
    builders: Object.keys(by).map((s) => by[s]).sort((a, b) => b.total - a.total || (a.site < b.site ? -1 : 1)),
    check: {
      nodes: [sum((b) => b.total), graph.total], automation: [sum((b) => b.automation), graph.automation], disconnects: [sum((b) => b.disconnects), graph.disconnects],
      notes: [sum(notesOf), tally.notes], outside: { nodes: out.total, automation: out.automation, disconnects: out.disconnects },
      toldNotes: told.map((b) => b.name), toldButBuiltNothing: told.filter((b) => !b.total).map((b) => b.name), namedTwo: COST.conflicts,
    },
  };
}
function costReport(L, s, file) {
  const mins = RUN / 60, n = (v) => Math.round(v).toLocaleString("en-US"), r = (v, w) => String(v).padStart(w);
  const TYPES = ["BiquadFilter", "Gain", "Oscillator", "BufferSource"];
  const other = (b) => Object.keys(b.built).filter((k) => TYPES.indexOf(k) < 0).reduce((a, k) => a + b.built[k], 0);
  const busiest = (b) => { let m = -1; b.min.forEach((x, i) => { if (m < 0 || x[0] > b.min[m][0]) m = i; }); return m < 0 || !b.min[m][0] ? "—" : n(b.min[m][0]) + " in min " + m; };
  const told = (b) => Object.keys(b.notes).sort((x, y) => b.notes[y] - b.notes[x] || (x < y ? -1 : 1)).slice(0, 3).map((k) => k + " " + n(b.notes[k])).join(", ") || "—";
  const row = (name, b) => "  " + name.padEnd(20) + r(n(b.cues), 6) + r(n(b.total), 9) + r(n(b.total / mins), 7) + r(b.min ? busiest(b) : "", 18) +
    TYPES.map((k) => r(n(b.built[k] || 0), 8)).join("") + r(n(other(b)), 7) + r(n(b.automation), 10) + r(n(b.automation / mins), 7) + r(n(b.disconnects), 9) + r(n(b.disconnects / mins), 6) + "  " + (b.notes ? told(b) : "");
  L("cost: the graph charged to the work that did it — the lane whose cue built it (on the guests' lane, the guest it names), the press, a source's end to its builder · per minute over " + mins.toFixed(1) + " min" + (file ? " · sidecar " + file : ""));
  L("  " + "work".padEnd(20) + r("cues", 6) + r("nodes", 9) + r("/min", 7) + r("busiest minute", 18) + r("biquad", 8) + r("gain", 8) + r("osc", 8) + r("buffer", 8) + r("other", 7) + r("autom", 10) + r("/min", 7) + r("disconn", 9) + r("/min", 6) + "  notes told");
  s.buckets.forEach((b) => L(row(b.name, b)));
  // (the graph's row: the cues of every lane, which come to the clock's own count, and the graph's own counts)
  const tot = { cues: s.buckets.filter((b) => b.name.indexOf("press:") !== 0).reduce((a, b) => a + b.cues, 0), total: graph.total, built: graph.created, automation: graph.automation, disconnects: graph.disconnects };
  L(row("(the graph)", tot));
  L("  builders — the engine's function that called create…, the " + Math.min(10, s.builders.length) + " that built the most of " + s.builders.length + ":");
  s.builders.slice(0, 10).forEach((x) => {
    const kinds = Object.keys(x.built).sort((a, b) => x.built[b] - x.built[a]).map((k) => k + " " + n(x.built[k])).join(", ");
    const whose = Object.keys(x.buckets).sort((a, b) => x.buckets[b] - x.buckets[a]).slice(0, 4).map((k) => k + " " + n(x.buckets[k])).join(", ");
    L("  " + r(n(x.total), 8) + "  " + x.site + " · " + kinds + " · " + whose);
  });
  const c = s.check, eq = (p) => n(p[0]) + (p[0] === p[1] ? " of " : " — NOT the graph's ") + n(p[1]);
  L("  check: nodes " + eq(c.nodes) + " · automation " + eq(c.automation) + " · disconnects " + eq(c.disconnects) + " · notes " + eq(c.notes) +
    " · outside a cue, a press or a source's end: " + c.outside.nodes + " node(s), " + c.outside.automation + " call(s), " + c.outside.disconnects + " disconnect(s)" +
    " · " + (c.toldButBuiltNothing.length ? "told notes and built nothing: " + c.toldButBuiltNothing.join(", ") : "every one of the " + c.toldNotes.length + " that told notes built nodes") +
    " · " + c.namedTwo + " guests' cue(s) named two guests");
}
function costWrite(file, s) {
  const buckets = {};
  s.buckets.forEach((b) => { buckets[b.name] = { cues: b.cues, total: b.total, built: b.built, automation: b.automation, disconnects: b.disconnects, notes: b.notes, perMinute: b.min }; });
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      format: "kolob-cost", v: 1, seed: SEED, secs: RUN, minutes: RUN / 60, flags: FLAGS.filter((f) => f.indexOf("cost=") !== 0),
      engine: { dir: ENGINE_DIR, list: LIST.from, fingerprint: FINGERPRINT },
      graph: { contexts: graph.contexts, total: graph.total, created: graph.created, automation: graph.automation, disconnects: graph.disconnects },
      buckets, builders: s.builders, check: s.check,
    }, null, 1) + "\n");
  } catch (e) { noteError("cost sidecar", e); }
}
function sortedCounts(map, limit) {
  const keys = Object.keys(map).sort((a, b) => map[b] - map[a] || (a < b ? -1 : 1));
  const out = {};
  keys.slice(0, limit || 40).forEach((k) => { out[k] = map[k]; });
  if (limit && keys.length > limit) out["…"] = keys.length - limit + " more";
  return out;
}

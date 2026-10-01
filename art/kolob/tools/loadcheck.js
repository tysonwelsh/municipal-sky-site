#!/usr/bin/env node
// ============================================================================
// KOLOB — tools/loadcheck.js: does the engine load? (2026-10-01)
//
// The cheapest check there is, and the one a fresh clone could not run before:
// read _engine.php's one list, evaluate every room in that order under a bare
// mock of the page (no audio, no clock, no DOM to speak of), and take the roll
// call the page's own load guard takes — every room answered, the substrate's
// globals raised, the KolobAudio facade standing, and the facade carrying the
// methods the page and the labs call. The page's guard itself
// (kolob_engine_guard() in _engine.php) is then run as the page runs it, and
// must name in KOLOB._broken exactly what the roll call missed (the page keeps
// PLAY disabled on it). The calendar and the plan (kolob-plan.js) must stand
// before the meeting room is evaluated (the meeting requires both). The
// composer's desk: the files the
// hymnal's worker would load on the page, found by the script tags the page
// prints from the list, must be the list's own, in its order. Then one pure
// smoke: the composer writes a hymn from a fixed stream and the Score's
// proofreader passes it. Last, the labs: every *-lab.php (beside the engine
// and in shelved/) loads the house's rooms its page loads, in its page's
// order, in a process of its own — each room evaluated with only what the
// lab put before it, without a throw or a word to console.error, and every
// room of the one list answering the roll call — so a room that comes to
// need another at load (kolob-pitch.js, kolob-score.js) is caught on the
// bench that lacks it, not by the owner opening it. (A room that reads
// another only when called is not caught here: its lab finds it.)
//
//   node art/kolob/tools/loadcheck.js            (exit 0 = loaded, 1 = not)
//   KOLOB_DIR=<dir> node art/kolob/tools/loadcheck.js   (another build)
//
// It needs no harness and no browser, so it runs in CI on every push. The
// full harness (art/kolob/_harness.js) is what plays a meeting; this only
// proves the doors open.
// ============================================================================
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const E = require("./lib/engine.js");     // the list, the page's mock, the rooms evaluated (shared with tools/golden.js)

const DIR = path.resolve(process.env.KOLOB_DIR || process.env.KOLOB_BASE || path.join(__dirname, ".."));

E.mockPage();
const list = E.engineList(DIR);
// (the meeting requires the calendar and the plan: KOLOB.Calendar and
// KOLOB.Plan stand before its room)
const { loaded, failures } = E.evaluate(DIR, list, (rel) => (path.basename(rel) !== "kolob-meeting.js" ? null
  : !(global.KOLOB && global.KOLOB.Calendar) ? rel + ": evaluated before KOLOB.Calendar stands — the meeting requires the calendar (kolob-calendar.js, ahead of it on the list)"
  : !(global.KOLOB && global.KOLOB.Plan) ? rel + ": evaluated before KOLOB.Plan stands — the meeting requires its plan (kolob-plan.js, ahead of it on the list)" : null));

// the roll call, as _engine.php's guard takes it
const K = global.KOLOB || {}, rooms = K._rooms || {}, P = global.PJ2 || {};
const missed = E.rollCall(list);
missed.forEach((f) => failures.push(f + ": did not answer the roll call"));
if (!global.KolobAudio) { missed.push("the KolobAudio facade"); failures.push("the KolobAudio facade is not raised"); }

// the page's own guard, run as the page runs it (after every room, with the
// list's file names): it names what did not answer in KOLOB._broken, which
// kolob-ui.js reads to keep PLAY disabled, and nothing on a whole load
let guard = "";
{
  const php = fs.readFileSync(path.join(DIR, "_engine.php"), "utf8");
  const gm = /function kolob_engine_guard\(\)[\s\S]*?<<<'JS'\r?\n([\s\S]*?)\r?\nJS;/.exec(php);
  if (!gm && php.indexOf("kolob_engine_guard") < 0) guard = "not run (this build's _engine.php is older than kolob_engine_guard())";
  else if (!gm) failures.push("_engine.php: kolob_engine_guard()'s script is not found between its markers");
  else {
    const said = [], realError = console.error;
    console.error = (...a) => { said.push(a.join(" ")); };
    try { vm.runInThisContext("(" + gm[1] + ")(" + JSON.stringify(list.map((f) => path.basename(f))) + ");", { filename: "_engine.php (kolob_engine_guard)" }); }
    catch (e) { failures.push("the page's load guard threw: " + (e && e.message || e)); }
    finally { console.error = realError; }
    const KB = global.KOLOB || {}, broken = KB._broken || null;
    if (broken) failures.push("the page's load guard names " + broken.join(", ") + " in KOLOB._broken (the page keeps PLAY disabled)" + (said.length ? "; it says: " + said[0] : ""));
    if (JSON.stringify(broken || []) !== JSON.stringify(missed)) failures.push("the page's load guard named [" + (broken || []).join(", ") + "] where the roll call missed [" + missed.join(", ") + "]");
    guard = broken ? "KOLOB._broken = [" + broken.join(", ") + "]" : "nothing missing, KOLOB._broken unset" + (said.length ? " (but it said: " + said[0] + ")" : "");
    if (!broken && said.length) failures.push("the page's load guard said " + said[0] + " with nothing missing");
  }
}

// the facade's surface the page and the labs rely on
const FACADE = ["init", "play", "pause", "resume", "stop", "isPlaying", "isPaused", "getSeed", "reseed",
  "setMasterVolume", "setLayerVolume", "toggleLayer", "getLayers", "getVolumes", "sample",
  "setNoteListener", "setEventListener", "getConductor", "getAudioTime", "attachAnalyser",
  "setForceVisitation", "setForceRaspberry", "setCumulativeMode", "getCumulativeMode", "getCumulativeOdds",
  "getHymnal", "getHymn", "hymnalStats", "clockHealth", "getWard", "wardStats", "getOrganist", "organStats",
  "setBandVolume", "getBandVolume", "getBandHeardUntil", "skipToSection"];
if (global.KolobAudio) FACADE.forEach((m) => { if (typeof global.KolobAudio[m] !== "function") failures.push("KolobAudio." + m + " is missing"); });

// the composer's desk: the files the hymnal's worker would load on the page,
// found as the page finds them (its script tags, printed from the list), are
// the list's own, in the list's order — the worker writes the meeting's hymns
// with the same bytes as the page
let desk = "";
if (K.Hymnal && K.Hymnal.warm) {
  const base = "http://localhost/art/kolob/";
  const at = new Map(list.map((rel, i) => [new URL(rel, base).href, i]));
  const tags = list.map((rel) => ({ src: new URL(rel, base).href + "?v=00000000" }));
  let urls = null;
  const savedWorker = global.Worker;
  global.Worker = function () { this.postMessage = (m) => { if (m && m.type === "load") urls = m.urls; }; this.terminate = () => {}; };
  global.document.getElementsByTagName = (n) => (n === "script" ? tags : []);
  try { K.Hymnal.warm(); }
  catch (e) { failures.push("the hymnal's warm() threw: " + (e && e.message || e)); }
  finally { global.Worker = savedWorker; delete global.document.getElementsByTagName; }
  if (!urls) { desk = "the worker would not start"; failures.push("the composer's desk: the hymnal's worker would not start on the page (a room the hymnal names is not on the list)"); }
  else {
    let last = -1, kept = true;
    const names = urls.map((u) => {
      const i = at.has(u.split("?")[0]) ? at.get(u.split("?")[0]) : -1, f = path.basename(u.split("?")[0]);
      if (i < 0) { kept = false; failures.push("the composer's desk: the worker would load " + f + ", which is not on the list"); }
      else if (i < last) { kept = false; failures.push("the composer's desk: the worker would load " + f + " after " + path.basename(list[last]) + "; the list has it before"); }
      if (i >= 0) last = Math.max(last, i);
      return f;
    });
    desk = "the worker loads " + names.length + " files" + (kept ? ", the list's own, in its order" : ", not as the list has them") + " (" + names.join(", ") + ")";
  }
} else desk = "no hymnal loaded";

// one pure smoke: a hymn composed and proofread
let smoke = "";
try {
  if (K.Composer && K.Score && P.Rand) {
    const h = K.Composer.compose(P.Rand.stream(1).fork("hymn:1:1"), { dialect: "tabernacle", meter: "CM", mode: "ionian", keyMonzo: [0, 0, 0, 0], id: "h:1:1" });
    const v = K.Score.validateHymn ? K.Score.validateHymn(h) : null;
    const ok = v == null ? true : (v === true || (v && v.ok !== false && !(Array.isArray(v) && v.length)));
    smoke = "composed " + (h && h.nameEn ? h.nameEn : h && h.id) + " (" + (h && h.lines ? h.lines.length : "?") + " lines)" + (ok ? ", proofread ✓" : ", proofread ✗ " + JSON.stringify(v).slice(0, 200));
    if (!ok) failures.push("the composer's hymn did not proofread");
  } else smoke = "composer or score not loaded";
} catch (e) { failures.push("the composer threw: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" | ") : e)); }

// the labs: each lab's list in a process of its own (a room sees only what
// its lab loaded before it), a few at a time
async function labsLoad() {
  const benches = E.labs(DIR), said = [];
  if (!benches.length) return "none in this build";
  const results = new Array(benches.length);
  let next = 0;
  const worker = async () => {
    while (next < benches.length) {
      const i = next++, lab = benches[i], files = E.labList(DIR, lab);
      results[i] = { lab, files, r: files.length ? await E.evaluateApart(DIR, files) : null };
    }
  };
  await Promise.all(Array.from({ length: Math.min(benches.length, os.cpus().length || 2) }, worker));
  let whole = 0;
  results.forEach(({ lab, files, r }) => {
    const name = lab.replace(/\.php$/, "");
    if (!r) { said.push(name + " loads no room of the house"); whole++; return; }
    const bad = r.failures.concat(r.missed.map((f) => f + ": did not answer the roll call"), r.said.map((s) => "said to console.error as its rooms loaded: " + s.split("\n")[0]));
    if (bad.length) bad.forEach((b) => failures.push(lab + " (its rooms in its order): " + b));
    else whole++;
    if (!bad.length) said.push(name + " " + r.loaded);
    else said.push(name + " FAILED (" + r.loaded + " of " + files.length + " loaded)");
  });
  return whole + " of " + benches.length + " load the house's rooms in their own order (" + said.join(", ") + ")";
}

(async () => {
  const labLine = await labsLoad();
  console.log("kolob loadcheck — " + DIR);
  console.log("  modules: " + loaded + " of " + list.length + " loaded; rooms answering: " + Object.keys(rooms).length);
  console.log("  guard: " + guard);
  console.log("  desk: " + desk);
  console.log("  smoke: " + smoke);
  console.log("  labs: " + labLine);
  if (failures.length) { console.log("  FAILED:"); failures.forEach((f) => console.log("   - " + f)); process.exit(1); }
  console.log("  ALL GREEN");
})();

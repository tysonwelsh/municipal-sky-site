#!/usr/bin/env node
// ============================================================================
// KOLOB — tools/loadcheck.js: does the engine load? (2026-10-01)
//
// The cheapest check there is, and the one a fresh clone could not run before:
// read _engine.php's one list, evaluate every room in that order under a bare
// mock of the page (no audio, no clock, no DOM to speak of), and take the roll
// call the page's own load guard takes — every room answered, the substrate's
// globals raised, the KolobAudio facade standing, and the facade carrying the
// methods the page and the labs call. Then one pure smoke: the composer writes
// a hymn from a fixed stream and the Score's proofreader passes it.
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
const path = require("path");
const vm = require("vm");

const DIR = path.resolve(process.env.KOLOB_DIR || process.env.KOLOB_BASE || path.join(__dirname, ".."));

function engineList(dir) {
  const src = fs.readFileSync(path.join(dir, "_engine.php"), "utf8");
  const body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
  const out = []; const re = /'([^']+\.js)'/g; let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

// the page, as little of it as the rooms touch at load
global.window = global;
global.document = {
  hidden: false, visibilityState: "visible", readyState: "complete",
  addEventListener() {}, removeEventListener() {},
  getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
  createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }; },
  body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
  documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
};
global.location = { search: "", href: "http://localhost/art/kolob/", hash: "", pathname: "/art/kolob/" };
global.localStorage = (function () { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })();
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
if (typeof global.navigator === "undefined") global.navigator = { userAgent: "node", hardwareConcurrency: 4 };

const list = engineList(DIR);
const failures = [];
let loaded = 0;
for (const rel of list) {
  const file = path.resolve(DIR, rel);
  let src;
  try { src = fs.readFileSync(file, "utf8"); }
  catch (e) { failures.push(rel + ": cannot read (" + e.message + ")"); continue; }
  try { vm.runInThisContext(src, { filename: file }); loaded++; }
  catch (e) { failures.push(rel + ": threw at load — " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
}

// the roll call, as _engine.php's guard takes it
const K = global.KOLOB || {}, rooms = K._rooms || {}, P = global.PJ2 || {};
const sub = { "pj2-rand.js": P.Rand, "pj2-clock.js": P.Clock, "pj2-fx.js": P.Fx, "kolob-tunes.js": K.Tunes };
list.map((f) => path.basename(f)).forEach((f) => { if (f in sub ? !sub[f] : !rooms[f]) failures.push(f + ": did not answer the roll call"); });
if (!global.KolobAudio) failures.push("the KolobAudio facade is not raised");

// the facade's surface the page and the labs rely on
const FACADE = ["init", "play", "pause", "resume", "stop", "isPlaying", "isPaused", "getSeed", "reseed",
  "setMasterVolume", "setLayerVolume", "toggleLayer", "getLayers", "getVolumes", "sample",
  "setNoteListener", "setEventListener", "getConductor", "getAudioTime", "attachAnalyser",
  "setForceVisitation", "setForceRaspberry", "setCumulativeMode", "getCumulativeMode", "getCumulativeOdds",
  "getHymnal", "getHymn", "hymnalStats", "clockHealth", "getWard", "wardStats", "getOrganist", "organStats",
  "setBandVolume", "getBandVolume", "getBandHeardUntil", "skipToSection"];
if (global.KolobAudio) FACADE.forEach((m) => { if (typeof global.KolobAudio[m] !== "function") failures.push("KolobAudio." + m + " is missing"); });

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

console.log("kolob loadcheck — " + DIR);
console.log("  modules: " + loaded + " of " + list.length + " loaded; rooms answering: " + Object.keys(rooms).length);
console.log("  smoke: " + smoke);
if (failures.length) { console.log("  FAILED:"); failures.forEach((f) => console.log("   - " + f)); process.exit(1); }
console.log("  ALL GREEN");

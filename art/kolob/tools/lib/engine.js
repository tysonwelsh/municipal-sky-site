// KOLOB tools — the engine, loaded headless.
//
// _engine.php's one list, read as the page reads it, and every room on it
// evaluated in that order under a bare mock of the page: no audio, no clock,
// almost no DOM. tools/loadcheck.js (does the engine load?) and
// tools/golden.js (does the pure core compose what it composed?) load the
// engine this way. The harness (_harness.js) keeps a loader of its own, with
// a mock of Web Audio and a virtual clock, because it plays the meeting.
//
// Each room is read with fs.readFileSync and evaluated with
// vm.runInThisContext, which is a browser <script>: top-level names become
// globals, and `window` is the global object itself. So one process loads
// one list: a lab's list (labList) is loaded in a process of its own
// (evaluateApart, which runs this file: node lib/engine.js <dir> <list>).
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { execFile } = require("child_process");

// the list's file names, relative to the engine directory, in its order (the
// comments on the list are not files)
function engineList(dir) {
  const src = fs.readFileSync(path.join(dir, "_engine.php"), "utf8");
  const body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
  const out = []; const re = /'([^']+\.js)'/g; let m;
  while ((m = re.exec(body))) out.push(m[1]);
  return out;
}

// the page's drawing (KolobViz), _viz.php's list in its order; a build from
// before the list has kolob-viz.js alone, and one copied without the page
// none ([])
function vizList(dir) {
  const php = path.join(dir, "_viz.php");
  if (!fs.existsSync(php)) return fs.existsSync(path.join(dir, "kolob-viz.js")) ? ["kolob-viz.js"] : [];
  const body = fs.readFileSync(php, "utf8");
  const tail = body.slice(body.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
  const out = []; const re = /'([^']+\.js)'/g; let m;
  while ((m = re.exec(tail))) out.push(m[1]);
  return out;
}

// the page, as little of it as the rooms touch at load. opts.search is the
// address's query: the core reads ?seed= from it, and without one the hour
// chooses the visit (Date.now, at load)
function mockPage(opts) {
  opts = opts || {};
  global.window = global;
  global.document = {
    hidden: false, visibilityState: "visible", readyState: "complete",
    addEventListener() {}, removeEventListener() {},
    getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }; },
    body: { appendChild() {}, classList: { add() {}, remove() {}, toggle() {} } },
    documentElement: { classList: { add() {}, remove() {}, toggle() {} } },
  };
  global.location = { search: opts.search || "", href: "http://localhost/art/kolob/" + (opts.search || ""), hash: "", pathname: "/art/kolob/" };
  global.localStorage = (function () { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })();
  global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
  global.cancelAnimationFrame = (id) => clearTimeout(id);
  global.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  if (typeof global.navigator === "undefined") global.navigator = { userAgent: "node", hardwareConcurrency: 4 };
}

// every room on the list, evaluated in the list's order. before(rel): a
// check made just before a room is evaluated — the words of a failure, or
// nothing. → { loaded (how many evaluated without a throw), failures,
// read: [{ name, path, bytes }] (what was read, for a fingerprint) }
function evaluate(dir, list, before) {
  const failures = [], read = [];
  let loaded = 0;
  for (const rel of list) {
    const file = path.resolve(dir, rel);
    let bytes;
    try { bytes = fs.readFileSync(file); }
    catch (e) { failures.push(rel + ": cannot read (" + e.message + ")"); continue; }
    read.push({ name: path.basename(file), path: file, bytes });
    const said = before ? before(rel) : null;
    if (said) failures.push(said);
    try { vm.runInThisContext(bytes.toString("utf8"), { filename: file }); loaded++; }
    catch (e) {
      // (the message, and where: a script's stack opens with its file:line)
      const where = e && e.stack ? (String(e.stack).split("\n").find((l) => /:\d+(:\d+)?\)?$/.test(l.trim())) || "").trim().replace(/^at\s+/, "") : "";
      failures.push(rel + ": threw at load — " + (e && e.message ? e.message : e) + (where ? " (" + path.basename(where) + ")" : ""));
    }
  }
  return { loaded, failures, read };
}

// the load guard's roll call over these files (as _engine.php's guard takes
// it): each room's KOLOB._rooms[file], and for the substrate and the Earth
// tunes the global each raises → the file names that did not answer
function rollCall(files) {
  const K = global.KOLOB || {}, rooms = K._rooms || {}, P = global.PJ2 || {};
  const sub = { "pj2-rand.js": P.Rand, "pj2-clock.js": P.Clock, "pj2-fx.js": P.Fx, "kolob-tunes.js": K.Tunes };
  return files.map((f) => path.basename(f)).filter((f) => (f in sub ? !sub[f] : !rooms[f]));
}

// the labs: every *-lab.php beside the engine and in shelved/, by name
function labs(dir) {
  const of = (sub) => { try { return fs.readdirSync(path.join(dir, sub)).filter((f) => /-lab\.php$/.test(f)).sort().map((f) => path.join(sub, f)); } catch (e) { return []; } };
  return of(".").concat(of("shelved")).map((f) => path.normalize(f));
}

// a lab's list of the house's files (the substrate's pj2-*.js and the rooms,
// kolob-*.js), in the order its page loads them, relative to the engine
// directory as engineList's are: its <script> tags, each resolved from the
// lab's own folder, and _engine.php's one list where it prints
// kolob_engine_tags(). The lab's own script is not on it.
function labList(dir, lab) {
  const php = fs.readFileSync(path.join(dir, lab), "utf8"), at = [];
  let m;
  const tag = /<script\b[^>]*\bsrc=["']([^"'?#]+)/g;
  while ((m = tag.exec(php))) {
    const rel = path.relative(dir, path.resolve(dir, path.dirname(lab), m[1])).split(path.sep).join("/");
    if (/^(pj2|kolob)-[^/]*\.js$/.test(path.basename(rel))) at.push({ i: m.index, files: [rel] });
  }
  const call = /\bkolob_engine_tags\(\s*\$/g;
  while ((m = call.exec(php))) at.push({ i: m.index, files: engineList(dir) });
  return at.sort((a, b) => a.i - b.i).reduce((out, x) => out.concat(x.files), []);
}

// a list loaded in a fresh process of its own, under the page's mock →
// Promise of { loaded, failures, missed (the roll call, over the files on
// _engine.php's list: a room off it — a shelved one — answers none), said
// (what the rooms told console.error as they loaded) }
function evaluateApart(dir, list) {
  return new Promise((resolve) => {
    execFile(process.execPath, [__filename, dir, JSON.stringify(list)], { maxBuffer: 1 << 24 }, (err, stdout, stderr) => {
      const last = String(stdout || "").trim().split("\n").pop();
      try { resolve(JSON.parse(last)); }
      catch (e) { resolve({ loaded: 0, failures: ["the loader's process failed: " + String(stderr || (err && err.message) || last).trim().split("\n").slice(0, 3).join(" | ")], missed: [], said: [] }); }
    });
  });
}

module.exports = { engineList, vizList, mockPage, evaluate, rollCall, labs, labList, evaluateApart };

// run as a program (evaluateApart): node lib/engine.js <dir> <the list as JSON>
// → one line of JSON on stdout, after anything the rooms printed
if (require.main === module) {
  const dir = path.resolve(process.argv[2]), list = JSON.parse(process.argv[3]);
  const said = [], realError = console.error;
  console.error = (...a) => { said.push(a.map(String).join(" ")); };
  mockPage();
  let r;
  try { r = evaluate(dir, list); }
  finally { console.error = realError; }
  const onList = new Set(engineList(dir).map((f) => path.basename(f)));
  const missed = rollCall(list.filter((f) => onList.has(path.basename(f))));
  process.stdout.write("\n" + JSON.stringify({ loaded: r.loaded, failures: r.failures, missed, said }) + "\n");
}

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
// globals, and `window` is the global object itself.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

// the list's file names, relative to the engine directory, in its order (the
// comments on the list are not files)
function engineList(dir) {
  const src = fs.readFileSync(path.join(dir, "_engine.php"), "utf8");
  const body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
  const out = []; const re = /'([^']+\.js)'/g; let m;
  while ((m = re.exec(body))) out.push(m[1]);
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
    catch (e) { failures.push(rel + ": threw at load — " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e)); }
  }
  return { loaded, failures, read };
}

module.exports = { engineList, mockPage, evaluate };

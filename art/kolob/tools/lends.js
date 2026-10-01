#!/usr/bin/env node
// ============================================================================
// KOLOB — tools/lends.js: the shared bag, checked (2026-10-01)
//
// Every room lends what it builds onto one bag, KOLOB._s (SCORE §9.1: "the
// chorister's book"), as `S.name = …`, and reads the others' as `S.name(…)`.
// Load order is the only type system that pattern has: a lend renamed in one
// room fails in another at the first cue that reaches it, as "S.x is not a
// function", minutes into a meeting. This tool reads the rooms statically and
// reports every `S.name` read whose name no room lends. A read that is
// guarded (`S.x ? … : …`, `S.x && …`, `typeof S.x`, `!S.x`) is an OPTIONAL
// lend and is listed, not failed. Dead lends — lent, never read anywhere —
// are listed too.
//
// THE BORROWED WRAPPERS. A room that calls another's function keeps a
// one-line wrapper for it at its top, `function x(a, b) { return S.x(a, b); }`
// (the BORROWED block): the room's manifest of what it borrows, bound late
// through S. A wrapper must be exact — named after the lend it calls, its
// arguments passed through unchanged, in order — so a reader can take its
// name for the lend's. Every function of that shape (parsed with acorn, the
// parser ESLint brings) is checked: one that calls another name than its own
// (`function foo() { return S.bar(); }`), or drops, adds or reorders an
// argument, fails the run. The wrappers are counted room by room, with any
// the room never uses (ESLint's no-unused-vars fails those).
//
//   node art/kolob/tools/lends.js            (exit 0 = no unguarded unknown read, every wrapper exact)
//   KOLOB_DIR=<dir> node art/kolob/tools/lends.js
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(process.env.KOLOB_DIR || process.env.KOLOB_BASE || path.join(__dirname, ".."));
let acorn = null;
try { acorn = require(path.join(__dirname, "..", "..", "..", "node_modules", "acorn")); } catch (e) { acorn = null; }
const src = fs.readFileSync(path.join(DIR, "_engine.php"), "utf8");
const body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
const files = []; { const re = /'([^']+\.js)'/g; let m; while ((m = re.exec(body))) if (/^kolob-/.test(path.basename(m[1]))) files.push(m[1]); }

const lends = {};      // name → [file]
const reads = [];      // {name, file, line, guarded, text}
const wrappers = [];   // {file, line, name, calls, exact, why, used}
const unparsed = [];   // a room acorn could not read
for (const rel of files) {
  const file = path.join(DIR, rel), text = fs.readFileSync(file, "utf8");
  const am = text.match(/var\s+([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?KOLOB\._s\b/);
  if (!am) continue;
  if (acorn) {
    try { wrappers.push(...wrappersOf(rel, text, am[1])); }
    catch (e) { unparsed.push(rel + ": " + e.message); }
  }
  const S = am[1].replace(/\$/g, "\\$");
  const lendRe = new RegExp("^\\s*" + S + "\\.([A-Za-z_$][\\w$]*)\\s*=(?!=)", "gm");
  const defRe = new RegExp("Object\\.defineProperty\\(\\s*" + S + "\\s*,\\s*[\"']([A-Za-z_$][\\w$]*)[\"']", "g");
  let m;
  while ((m = lendRe.exec(text))) (lends[m[1]] = lends[m[1]] || []).push(rel);
  while ((m = defRe.exec(text))) (lends[m[1]] = lends[m[1]] || []).push(rel);
  const lines = text.split("\n");
  const readRe = new RegExp("\\b" + S + "\\.([A-Za-z_$][\\w$]*)", "g");
  lines.forEach((ln, i) => {
    const code = ln.replace(/\/\/.*$/, "");
    let r;
    while ((r = readRe.exec(code))) {
      const name = r[1], after = code.slice(r.index + r[0].length);
      if (/^\s*=(?!=)/.test(after)) continue;                     // a lend
      const before = code.slice(0, r.index);
      const guarded = /(typeof\s+|!\s*)$/.test(before) || /^\s*(\?|&&|\|\||==|!=|\)\s*(\?|&&|\|\|))/.test(after)
        || new RegExp("\\b(if|while)\\s*\\(\\s*!?\\s*" + S + "\\." + name + "\\s*\\)").test(code);
      reads.push({ name, file: rel, line: i + 1, guarded, text: ln.trim().slice(0, 110) });
    }
  });
}

// Every function declared as `function x(…) { return S.y(…); }` in a room
// whose bag is S: is it exact (x is y, its arguments its parameters, in
// order), and how many times does its room name it (its own declaration
// aside — a property's key, or a name after a dot, is not a use)?
function wrappersOf(rel, text, S) {
  const ast = acorn.parse(text, { ecmaVersion: 2022, sourceType: "script", locations: true });
  const found = [], uses = new Map();
  (function walk(node, parent) {
    if (node.type === "Identifier") {
      const notUse = (parent.type === "MemberExpression" && parent.property === node && !parent.computed)
        || (parent.type === "Property" && parent.key === node && !parent.computed)
        || (parent.type === "FunctionDeclaration" && parent.id === node);
      if (!notUse) uses.set(node.name, (uses.get(node.name) || 0) + 1);
      return;
    }
    if (node.type === "FunctionDeclaration") {
      const body = node.body.body, ret = body.length === 1 && body[0].type === "ReturnStatement" ? body[0].argument : null;
      const callee = ret && ret.type === "CallExpression" ? ret.callee : null;
      if (callee && callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === S) {
        const name = node.id.name, calls = callee.property.name;
        const params = node.params.map((p) => (p.type === "Identifier" ? p.name : "…")), args = ret.arguments.map((a) => (a.type === "Identifier" ? a.name : text.slice(a.start, a.end)));
        const why = [];
        if (calls !== name) why.push("renames: " + name + " calls " + S + "." + calls);
        if (params.join(", ") !== args.join(", ") || node.params.some((p) => p.type !== "Identifier")) why.push("does not pass its arguments through: (" + params.join(", ") + ") → " + S + "." + calls + "(" + args.join(", ") + ")");
        found.push({ file: rel, line: node.loc.start.line, name, calls, exact: !why.length, why: why.join("; ") });
      }
    }
    for (const key of Object.keys(node)) {
      const v = node[key];
      if (Array.isArray(v)) v.forEach((c) => { if (c && typeof c.type === "string") walk(c, node); });
      else if (v && typeof v.type === "string") walk(v, node);
    }
  })(ast, null);
  found.forEach((w) => { w.used = uses.get(w.name) || 0; });
  return found;
}

const unknown = reads.filter((r) => !lends[r.name]);
const unguarded = unknown.filter((r) => !r.guarded), optional = unknown.filter((r) => r.guarded);
const readNames = new Set(reads.map((r) => r.name));
const dead = Object.keys(lends).filter((n) => !readNames.has(n)).sort();

console.log("kolob lends — " + DIR);
console.log("  rooms read: " + files.length + "; names lent: " + Object.keys(lends).length + "; reads: " + reads.length);
if (unguarded.length) {
  console.log("  UNKNOWN READS, unguarded (" + unguarded.length + ") — a name no room lends:");
  unguarded.forEach((r) => console.log("   - S." + r.name + "  " + r.file + ":" + r.line + "  " + r.text));
}
if (optional.length) {
  const by = {}; optional.forEach((r) => (by[r.name] = by[r.name] || []).push(r.file + ":" + r.line));
  console.log("  optional lends read under a guard, never lent by an engine room (" + Object.keys(by).length + "): " + Object.keys(by).sort().map((n) => "S." + n + " [" + by[n].length + "]").join(", "));
}
if (dead.length) console.log("  lent, never read by another room (" + dead.length + "): " + dead.map((n) => "S." + n + " (" + lends[n].map((f) => path.basename(f, ".js").replace(/^kolob-/, "")).join(",") + ")").join(", "));

// the wrappers, room by room
const short = (f) => path.basename(f, ".js").replace(/^kolob-/, "");
const inexact = wrappers.filter((w) => !w.exact), unused = wrappers.filter((w) => !w.used);
if (!acorn) console.log("  wrappers: NOT CHECKED — acorn is not installed (run `npm install` at the repo root)");
else {
  const per = {}; wrappers.forEach((w) => { per[w.file] = (per[w.file] || 0) + 1; });
  console.log("  wrappers (function x(…) { return S.x(…); }): " + wrappers.length + " in " + Object.keys(per).length + " rooms — " + Object.keys(per).map((f) => short(f) + " " + per[f]).join(", ")
    + (inexact.length ? "" : "; every one exact") + (unused.length ? "" : ", every one used in its room"));
  if (unparsed.length) { console.log("  ROOMS ACORN COULD NOT READ (" + unparsed.length + "):"); unparsed.forEach((u) => console.log("   - " + u)); }
  if (inexact.length) {
    console.log("  WRAPPERS THAT ARE NOT EXACT (" + inexact.length + ") — a wrapper is named after the lend it calls and passes its arguments through, in order:");
    inexact.forEach((w) => console.log("   - " + w.name + "  " + w.file + ":" + w.line + "  " + w.why));
  }
  if (unused.length) console.log("  wrappers their room never uses (" + unused.length + "; ESLint's no-unused-vars fails these): " + unused.map((w) => w.name + " (" + w.file + ":" + w.line + ")").join(", "));
}
if (unguarded.length || inexact.length || unparsed.length) process.exit(1);
if (!acorn) process.exit(2);
console.log("  ALL GREEN");

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
//   node art/kolob/tools/lends.js            (exit 0 = no unguarded unknown read)
//   KOLOB_DIR=<dir> node art/kolob/tools/lends.js
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.resolve(process.env.KOLOB_DIR || process.env.KOLOB_BASE || path.join(__dirname, ".."));
const src = fs.readFileSync(path.join(DIR, "_engine.php"), "utf8");
const body = src.slice(src.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
const files = []; { const re = /'([^']+\.js)'/g; let m; while ((m = re.exec(body))) if (/^kolob-/.test(path.basename(m[1]))) files.push(m[1]); }

const lends = {};      // name → [file]
const reads = [];      // {name, file, line, guarded, text}
for (const rel of files) {
  const file = path.join(DIR, rel), text = fs.readFileSync(file, "utf8");
  const am = text.match(/var\s+([A-Za-z_$][\w$]*)\s*=\s*(?:window\.)?KOLOB\._s\b/);
  if (!am) continue;
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
if (unguarded.length) process.exit(1);
console.log("  ALL GREEN");

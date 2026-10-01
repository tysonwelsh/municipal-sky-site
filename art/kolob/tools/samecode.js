#!/usr/bin/env node
// ============================================================================
// KOLOB — tools/samecode.js: did an edit touch only comments and whitespace?
//
// A comment-only cleanup must leave the code exactly as it was. This proves
// it: each file is tokenized (acorn, the parser ESLint brought with it) with
// comments and whitespace dropped, in a git ref and in the worktree, and the
// two token streams are compared. A file whose tokens differ is named with
// the first token that moved; a file whose tokens agree had only its
// comments or its layout changed. Run it beside tools/tally.js (which proves
// the music did not move) after any pass over the comments.
//
//   node art/kolob/tools/samecode.js                 # HEAD against the worktree, every kolob-*.js
//   node art/kolob/tools/samecode.js --ref HEAD~1    # another ref
//   node art/kolob/tools/samecode.js file.js …       # these files only
//
// Exit 0 when every compared file's code is unchanged, 1 otherwise.
// ============================================================================
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..", "..", "..");
let acorn;
try { acorn = require(path.join(ROOT, "node_modules", "acorn")); }
catch (e) { console.error("samecode.js: acorn is not installed — run `npm install` at the repo root"); process.exit(2); }

const args = process.argv.slice(2);
let ref = "HEAD";
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ref") ref = args[++i];
  else files.push(args[i]);
}
const KOLOB = path.join(ROOT, "art", "kolob");
const list = files.length ? files.map((f) => path.resolve(f)) : fs.readdirSync(KOLOB).filter((f) => /^kolob-.*\.js$/.test(f)).map((f) => path.join(KOLOB, f));

function tokens(src, name) {
  const out = [];
  try {
    for (const t of acorn.tokenizer(src, { ecmaVersion: 2022, sourceType: "script", locations: true })) {
      out.push({ k: t.type.label, v: t.value === undefined ? "" : String(t.value), line: t.loc.start.line });
    }
  } catch (e) { return { error: name + ": " + e.message }; }
  return { tokens: out };
}

let changed = 0, same = 0, skipped = 0;
for (const file of list) {
  const rel = path.relative(ROOT, file).split(path.sep).join("/");
  let before;
  try { before = execFileSync("git", ["-C", ROOT, "show", ref + ":" + rel], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
  catch (e) { console.log("  skip   " + rel + " (not in " + ref + ")"); skipped++; continue; }
  const after = fs.readFileSync(file, "utf8");
  if (before === after) { same++; continue; }
  const a = tokens(before, rel + "@" + ref), b = tokens(after, rel);
  if (a.error || b.error) { console.log("  ERROR  " + (a.error || b.error)); changed++; continue; }
  let i = 0;
  while (i < a.tokens.length && i < b.tokens.length && a.tokens[i].k === b.tokens[i].k && a.tokens[i].v === b.tokens[i].v) i++;
  if (i === a.tokens.length && i === b.tokens.length) { console.log("  same   " + rel + " (comments or layout only)"); same++; }
  else {
    const ta = a.tokens[i], tb = b.tokens[i];
    console.log("  CODE   " + rel + " — first difference at token " + i + ": " + ref + " line " + (ta ? ta.line + " `" + ta.v + "`" : "end") + " vs worktree line " + (tb ? tb.line + " `" + tb.v + "`" : "end"));
    changed++;
  }
}
console.log("samecode against " + ref + ": " + same + " unchanged in code, " + changed + " changed, " + skipped + " skipped");
process.exit(changed ? 1 : 0);

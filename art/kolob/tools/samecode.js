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
//   node art/kolob/tools/samecode.js --split kolob-viz.js [--ref <ref> | --from <file>] [new.js …]
//
// Exit 0 when every compared file's code is unchanged, 1 otherwise.
//
// THE SPLIT (--split). A file cut into pieces (one closure become several,
// sharing state through one bag, the way the house's rooms share KOLOB._s)
// moved its code if every statement of the old closure stands, whole and in
// its old order, in exactly one of the new files, and everything else in
// the new files is glue of the house's few shapes. The old file is read at
// the ref (HEAD by default; --from <file> reads it from a file instead), the
// new ones from the worktree (default: the list in _viz.php, in its order). Each is parsed (espree and eslint-scope,
// ESLint's own) and each top-level statement of its closure tokenized.
// Glue is: the bag (`var VS = window.KOLOB._viz = window.KOLOB._viz || {};`),
// `var K = window.KolobAudio;`, a BORROWED wrapper (`function x(a) {
// return VS.x(a); }`), a borrowed value (`var x = VS.x;`), a lend (`VS.x =
// x;`, or Object.defineProperty(VS, "x", { get … [set …] }) for a name the
// old closure reassigned). Every other statement must be an old one, token
// for token, but for one change: a name of the old closure that another
// file now owns may be read as VS.name. And every name is checked for what
// it means, token by token: a name of the old closure is the same name in
// the new file — its own, a wrapper's, a value taken once (only a name the
// old closure never reassigned, never written here, lent by a file loaded
// before this one) or VS.name (lent by the file that declares it, by a
// getter where the old closure reassigned it, and a setter where it is
// written here); a local stays local and a global global. So the moved
// code computes what it computed, on the same state.
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
let ref = "HEAD", split = null, from = null;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ref") ref = args[++i];
  else if (args[i] === "--split") split = args[++i];
  else if (args[i] === "--from") from = args[++i];
  else files.push(args[i]);
}
const KOLOB = path.join(ROOT, "art", "kolob");
if (split) { process.exit(splitCheck(split, files)); }
const list = files.length ? files.map((f) => path.resolve(f)) : fs.readdirSync(KOLOB).filter((f) => /^kolob-.*\.js$/.test(f)).map((f) => path.join(KOLOB, f));

function tokens(src, name) {
  const out = [];
  try {
    for (const t of acorn.tokenizer(src, { ecmaVersion: 2022, sourceType: "script", locations: true, allowHashBang: true })) {
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

// ---------------------------------------------------------------------------
// THE SPLIT
// ---------------------------------------------------------------------------
function splitCheck(oldName, newArgs) {
  let espree, eslintScope;
  try { espree = require(path.join(ROOT, "node_modules", "espree")); eslintScope = require(path.join(ROOT, "node_modules", "eslint-scope")); }
  catch (e) { console.error("samecode.js --split: espree and eslint-scope (ESLint's) are not installed — run `npm install` at the repo root"); return 2; }
  const where = (f) => (fs.existsSync(path.resolve(f)) ? path.resolve(f) : path.resolve(KOLOB, f));   // (from here, or from art/kolob)
  const oldRel = path.relative(ROOT, where(oldName)).split(path.sep).join("/");
  let oldSrc;
  if (from) { oldSrc = fs.readFileSync(path.resolve(from), "utf8"); ref = path.basename(from); }
  else {
    try { oldSrc = execFileSync("git", ["-C", ROOT, "show", ref + ":" + oldRel], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
    catch (e) { console.log("samecode --split: " + oldRel + " is not in " + ref); return 1; }
  }
  const list = newArgs.map(where);
  if (!list.length) {
    const php = fs.readFileSync(path.join(KOLOB, "_viz.php"), "utf8"), body = php.slice(php.indexOf("return [")).replace(/\/\/[^\n]*/g, "");
    const re = /'([^']+\.js)'/g;
    let m;
    while ((m = re.exec(body))) list.push(path.join(KOLOB, m[1]));
  }
  const fails = [];
  const fail = (m) => { if (fails.length < 40) fails.push(m); else if (fails.length === 40) fails.push("…"); };
  // a file read: its closure, its statements, every identifier token classed
  function read(src, name, bagOf) {
    const ast = espree.parse(src, { ecmaVersion: 2022, sourceType: "script", range: true, loc: true, tokens: true });
    const sm = eslintScope.analyze(ast, { ecmaVersion: 2022, sourceType: "script" });
    const fn = sm.scopes.find((sc) => sc.type === "function" && sc.upper && sc.upper.type === "global");
    if (!fn) throw new Error(name + ": no closure");
    const top = new Map();                      // name → { v, def: statement index }
    fn.variables.forEach((v) => { if (v.defs.length) top.set(v.name, v); });
    const cls = new Map();                      // identifier start → class
    sm.scopes.forEach((sc) => sc.references.forEach((r) => {
      const v = r.resolved, at = r.identifier.range[0];
      cls.set(at, !v ? "global" : v.scope === fn ? "top:" + v.name : sc.type === "global" && v.scope.type === "global" ? "global" : "local");
    }));
    fn.variables.forEach((v) => v.defs.forEach((d) => { if (d.name && d.name.range) cls.set(d.name.range[0], "top:" + v.name); }));
    const stmts = fn.block.body.body.filter((st) => !(st.type === "ExpressionStatement" && st.directive));
    const bag = bagOf ? bagOf(stmts) : null;
    const out = stmts.map((st) => {
      const toks = ast.tokens.filter((t) => t.range[0] >= st.range[0] && t.range[1] <= st.range[1]);
      const norm = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (bag && t.type === "Identifier" && t.value === bag && cls.get(t.range[0]) === "top:" + bag && toks[i + 1] && toks[i + 1].value === "." && toks[i + 2] && toks[i + 2].type === "Identifier") {
          const p = toks[i - 1], n = toks[i + 3];
          const written = (n && /^(=|\+=|-=|\*=|\/=|%=|\+\+|--|\|\|=|&&=)$/.test(n.value) && n.type === "Punctuator") || (p && (p.value === "++" || p.value === "--"));
          norm.push({ k: "Identifier", v: toks[i + 2].value, c: "bag:" + toks[i + 2].value, written, line: t.loc.start.line });
          i += 2;
          continue;
        }
        norm.push({ k: t.type, v: t.value, c: t.type === "Identifier" ? (cls.get(t.range[0]) || "key") : null, line: t.loc.start.line });
      }
      return { st, norm, key: norm.map((x) => x.k + " " + x.v).join("\n") };
    });
    return { ast, fn, top, stmts: out, bag };
  }
  // the old file
  const old = read(oldSrc, oldRel + "@" + ref, null);
  const oldMut = new Set(), oldFns = new Set();
  old.top.forEach((v, n) => {
    if (v.defs[0].type === "FunctionName") oldFns.add(n);
    if (v.references.some((r) => r.isWrite() && !(r.init && r.from === old.fn))) oldMut.add(n);
  });
  const byKey = new Map();
  old.stmts.forEach((x, i) => { (byKey.get(x.key) || byKey.set(x.key, []).get(x.key)).push(i); });
  const owner = new Array(old.stmts.length).fill(null);
  // the new files
  const files_ = list.map((file, fi) => {
    const rel = path.relative(KOLOB, file);
    const src = fs.readFileSync(file, "utf8");
    const r = read(src, rel, (stmts) => {
      for (const st of stmts) if (st.type === "VariableDeclaration") for (const d of st.declarations) {
        const t = src.slice(d.range[0], d.range[1]).replace(/\s+/g, " ");
        if (/^[A-Za-z_$][\w$]* = window\.KOLOB\._viz = window\.KOLOB\._viz \|\| \{\}$/.test(t)) return d.id.name;
      }
      return null;
    });
    return { rel, src, fi, r, moved: [], glue: { bag: 0, K: 0, wrappers: [], aliases: [], lends: [], lendsMut: [] }, bagRefs: {} };
  });
  const lender = new Map();                     // name → [{ file, kind: plain | get | getset }]
  files_.forEach((F) => {
    const { r, src } = F, B = r.bag;
    if (!B) { fail(F.rel + ": no bag (var VS = window.KOLOB._viz = window.KOLOB._viz || {};)"); return; }
    let last = -1;
    r.stmts.forEach((x) => {
      const st = x.st, text = src.slice(st.range[0], st.range[1]).replace(/\s+/g, " ");
      if (text === "var K = window.KolobAudio;") { F.glue.K++; return; }   // (each file reads the facade itself)
      const q = byKey.get(x.key);
      const free = q ? q.filter((i) => owner[i] == null) : [];
      if (free.length) {                        // an old statement, moved
        const i = free[0];
        owner[i] = F.rel;
        if (i <= last) fail(F.rel + ": the old statement at line " + old.stmts[i].st.loc.start.line + " stands out of its old order (line " + st.loc.start.line + ")");
        last = Math.max(last, i);
        F.moved.push({ i, x });
        return;
      }
      const m1 = new RegExp("^var " + B + " = window\\.KOLOB\\._viz = window\\.KOLOB\\._viz \\|\\| \\{\\};$").test(text);
      if (m1) { F.glue.bag++; return; }
      if (st.type === "FunctionDeclaration") {
        const body = st.body.body, ret = body.length === 1 && body[0].type === "ReturnStatement" ? body[0].argument : null;
        const ce = ret && ret.type === "CallExpression" ? ret.callee : null;
        if (ce && ce.type === "MemberExpression" && !ce.computed && ce.object.type === "Identifier" && ce.object.name === B && ce.property.name === st.id.name &&
            st.params.every((p) => p.type === "Identifier") && ret.arguments.length === st.params.length && ret.arguments.every((a, k) => a.type === "Identifier" && a.name === st.params[k].name)) {
          F.glue.wrappers.push(st.id.name);
          return;
        }
      }
      if (st.type === "VariableDeclaration" && st.declarations.every((d) => d.init && d.init.type === "MemberExpression" && !d.init.computed && d.init.object.type === "Identifier" && d.init.object.name === B && d.init.property.name === d.id.name)) {
        st.declarations.forEach((d) => F.glue.aliases.push(d.id.name));
        return;
      }
      if (st.type === "ExpressionStatement" && st.expression.type === "AssignmentExpression" && st.expression.operator === "=") {
        const L = st.expression.left, R = st.expression.right;
        if (L.type === "MemberExpression" && !L.computed && L.object.type === "Identifier" && L.object.name === B && R.type === "Identifier" && R.name === L.property.name) {
          F.glue.lends.push(R.name);
          (lender.get(R.name) || lender.set(R.name, []).get(R.name)).push({ file: F.rel, fi: F.fi, kind: "plain" });
          return;
        }
      }
      const dp = new RegExp("^Object\\.defineProperty\\(" + B + ", \"([A-Za-z_$][\\w$]*)\", \\{ enumerable: true, configurable: true, get: function \\(\\) \\{ return ([A-Za-z_$][\\w$]*); \\}(, set: function \\(v\\) \\{ ([A-Za-z_$][\\w$]*) = v; \\})? \\}\\);$").exec(text);
      if (dp && dp[1] === dp[2] && (!dp[3] || dp[4] === dp[1])) {
        F.glue.lendsMut.push(dp[1] + (dp[3] ? " (get, set)" : " (get)"));
        (lender.get(dp[1]) || lender.set(dp[1], []).get(dp[1])).push({ file: F.rel, fi: F.fi, kind: dp[3] ? "getset" : "get" });
        return;
      }
      fail(F.rel + ":" + st.loc.start.line + ": a statement that is neither an old one nor glue: " + text.slice(0, 120));
    });
  });
  old.stmts.forEach((x, i) => { if (owner[i] == null && oldSrc.slice(x.st.range[0], x.st.range[1]) === "var K = window.KolobAudio;" && files_.some((F) => F.glue.K)) owner[i] = "(each file's own)"; });
  owner.forEach((o, i) => { if (o == null) fail("the old statement at line " + old.stmts[i].st.loc.start.line + " stands in no new file: " + oldSrc.slice(old.stmts[i].st.range[0], old.stmts[i].st.range[0] + 100).replace(/\s+/g, " ")); });
  // what every name means, token by token
  const declaredIn = new Map();                 // old closure name → the file whose moved statements declare it
  files_.forEach((F) => F.moved.forEach(({ i }) => {
    const st = old.stmts[i].st;
    const names = st.type === "FunctionDeclaration" ? [st.id.name] : st.type === "VariableDeclaration" ? st.declarations.map((d) => d.id.name) : [];
    names.forEach((n) => declaredIn.set(n, F));
  }));
  const writtenViaBag = new Set();
  files_.forEach((F) => F.moved.forEach(({ i, x }) => {
    const o = old.stmts[i].norm;
    if (o.length !== x.norm.length) { fail(F.rel + ": token count differs at line " + x.st.loc.start.line); return; }
    o.forEach((ot, k) => {
      const nt = x.norm[k];
      if (ot.k !== "Identifier") return;
      const oc = ot.c || "key", nc = nt.c || "key";
      const where = F.rel + ":" + nt.line + " `" + nt.v + "`";
      if (oc.indexOf("top:") === 0) {
        const n = oc.slice(4);
        if (nc === "bag:" + n) {
          F.bagRefs[n] = (F.bagRefs[n] || 0) + 1;
          if (nt.written) writtenViaBag.add(n);
          const d = declaredIn.get(n);
          if (!d || d === F) fail(where + ": read through the bag, but " + (d ? "this file declares it" : "no file declares it"));
          return;
        }
        if (nc !== "top:" + n) { fail(where + ": the old closure's " + n + " is " + nc + " here"); return; }
        const d = declaredIn.get(n);
        if (d === F) return;                    // its own
        if (F.glue.wrappers.indexOf(n) >= 0) { if (!oldFns.has(n)) fail(where + ": a wrapper for " + n + ", which was not a function"); return; }
        if (F.glue.aliases.indexOf(n) >= 0) {
          if (oldMut.has(n)) fail(where + ": " + n + " taken once at load, but the old closure reassigned it");
          if (n === "K") fail(where + ": K is read from window.KolobAudio, not borrowed");
          return;
        }
        if (n === "K" && F.glue.K) return;
        fail(where + ": " + n + " is neither this file's own nor borrowed here");
        return;
      }
      if (oc !== nc) fail(where + ": " + oc + " in the old file, " + nc + " here");
    });
  }));
  // the borrowed: each lent by the one file that declares it, in the right way
  files_.forEach((F) => {
    F.glue.wrappers.concat(F.glue.aliases).forEach((n) => {
      const d = declaredIn.get(n), L = lender.get(n) || [];
      if (!d) { fail(F.rel + ": borrows " + n + ", which no file declares"); return; }
      if (!L.some((l) => l.file === d.rel)) fail(F.rel + ": borrows " + n + ", which " + d.rel + " does not lend");
      if (F.glue.aliases.indexOf(n) >= 0 && d.fi >= F.fi) fail(F.rel + ": takes " + n + " at load from " + d.rel + ", which loads after it");
    });
    Object.keys(F.bagRefs).forEach((n) => {
      const d = declaredIn.get(n), L = (lender.get(n) || []).filter((l) => d && l.file === d.rel);
      if (!L.length) { fail(F.rel + ": reads VS." + n + ", which " + (d ? d.rel : "no file") + " does not lend"); return; }
      if (oldMut.has(n) && L[0].kind === "plain") fail(d.rel + ": lends " + n + " as it stood at load, but the old closure reassigned it (a getter is needed)");
      if (writtenViaBag.has(n) && L[0].kind !== "getset") fail(d.rel + ": " + n + " is written through VS elsewhere, but lent without a setter");
    });
  });
  lender.forEach((L, n) => {
    const d = declaredIn.get(n);
    if (!d || L.some((l) => l.file !== d.rel)) fail("VS." + n + " is lent by " + L.map((l) => l.file).join(", ") + (d ? ", declared in " + d.rel : ", declared nowhere"));
  });
  // the report
  const oldLines = oldSrc.split("\n").length;
  console.log("samecode --split: " + oldRel + " at " + ref + " (" + oldLines + " lines, " + old.stmts.length + " statements in its closure) against " + files_.length + " file(s)");
  files_.forEach((F) => {
    const refs = Object.keys(F.bagRefs).sort().map((n) => n + "×" + F.bagRefs[n]);
    console.log("  " + F.rel + " (" + F.src.split("\n").length + " lines): " + F.moved.length + " statements moved, in their old order; glue: " +
      (F.glue.K ? "the facade (var K), " : "") + F.glue.wrappers.length + " wrappers, " + F.glue.aliases.length + " values taken, " + (F.glue.lends.length + F.glue.lendsMut.length) + " lent" +
      (F.glue.lendsMut.length ? " (" + F.glue.lendsMut.join(", ") + ")" : "") + (refs.length ? "; read through VS: " + refs.join(" ") : ""));
  });
  const nRefs = files_.reduce((a, F) => a + Object.keys(F.bagRefs).reduce((b, n) => b + F.bagRefs[n], 0), 0);
  console.log("  " + owner.filter((o) => o != null).length + " of " + old.stmts.length + " old statements moved whole, each once; " + nRefs + " names read through VS");
  if (fails.length) { console.log("  NOT A PURE MOVE (" + fails.length + "):"); fails.forEach((m) => console.log("   - " + m)); return 1; }
  console.log("  SAME CODE — every statement moved whole and in order; the rest is glue");
  return 0;
}

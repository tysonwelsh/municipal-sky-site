#!/usr/bin/env node
// KOLOB tools — cost.js: what the audio graph cost, before and after.
//
// The harness's `cost` (PLAN-REFACTOR §4.0(b), _harness.js THE COST) charges
// every node built, automation call and disconnect to the work that did it —
// the clock lane whose cue built it, on the guests' lane the guest it names,
// the press — and writes it as a sidecar (seed-N.cost.json beside the dump).
// This holds two of them side by side: per work, nodes, automation calls and
// disconnects, in all, per minute and in the busiest minute, with the shift;
// the node types; the builders that moved. It is the number a commit message
// on the audio graph states (§4.6: the ward's lines, the Hosanna).
//
//   node tools/cost.js <a> <b>          two sidecars, or two dump sets holding them
//   node tools/cost.js <a>              one side's table
//   node tools/cost.js --a <spec> --b <spec> [--seeds 3,7,22,37] [--secs 1200]
//                      [--flags force=hosanna] [--jobs N] [--top 10] [--out <dir>]
//     where <spec> is a sidecar (.cost.json), a dump set rendered with
//     --flags cost (a directory of them), an engine directory, git:<ref>, or
//     "worktree": a build is rendered here, through the harness, witnessed
//     (tools/README.md, "Which build is measured"), with `cost`
//
// Several seeds a side are summed, work by work, over the seeds both sides
// hold; per minute is over their minutes together, the busiest minute the
// busiest of any seed's. The builders are matched by function and file, not
// line, so a builder whose lines moved is still itself.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./lib/util.js");
const R = require("./lib/run.js");

const HELP = `cost.js — the audio graph's cost per work (the harness's cost sidecars), one side or A against B
  <a> [<b>]           sidecars (.cost.json) or dump sets holding them (render.js/tally.js --flags cost)
  --a <spec> --b <spec>   spec = sidecar | dump set | engine dir | git:<ref> | worktree (a build is rendered, witnessed)
  --seeds 3,7,22,37   seeds to render (default 3,7,22,37); a dump set's seeds are the ones both sides hold
  --secs 1200         harness seconds per seed (default 1200)
  --flags force=hosanna   harness switches for every render (cost is added)
  --jobs N            parallel harness processes (default: half the cores, at most 8)
  --top 10            builders shown (default 10)
  --out <dir>         where renders go (default tools/out/cost-<stamp>)`;

// ---------------------------------------------------------------------------
// A side: one or more sidecars, summed
// ---------------------------------------------------------------------------
function sidecarsIn(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".cost.json")).map((f) => path.join(dir, f));
}
function readSidecar(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  if (j.format !== "kolob-cost") throw R.refusal(file + " is not a cost sidecar (format " + j.format + ")");
  return j;
}
async function sideOf(spec, a, into, label) {
  const s = String(spec);
  if (s.endsWith(".json") && fs.existsSync(s)) return { label: path.basename(s), runs: [readSidecar(s)], manifest: null };
  if (fs.existsSync(s) && fs.statSync(s).isDirectory() && sidecarsIn(s).length) {
    let m = null;
    try { m = JSON.parse(fs.readFileSync(path.join(s, "manifest.json"), "utf8")); } catch (e) { /* a set without a manifest: its sidecars name themselves */ }
    return { label: s, runs: sidecarsIn(s).map(readSidecar), manifest: m };
  }
  // a build: render it, with cost
  const engine = R.resolveEngine(s === "worktree" ? null : s, null);
  const seeds = U.parseSeeds(a.seeds, [3, 7, 22, 37]);
  const { results, manifest } = await R.renderSet({ engine, seeds, secs: +a.secs || 1200, flags: ["cost"].concat(U.parseList(a.flags, [])), dir: into, jobs: +a.jobs || 0, quiet: true });
  const runs = results.map((r) => {
    const f = r.dump.replace(/\.jsonl$/, ".cost.json");
    if (!fs.existsSync(f)) throw R.refusal("the harness " + engine.harness + " wrote no cost sidecar for " + r.name + " (it does not know `cost`: a harness older than PLAN-REFACTOR §4.0(b))");
    return readSidecar(f);
  });
  return { label, runs, manifest };
}
// keep the seeds both sides hold (a sidecar given alone is matched as it is)
function matchSeeds(A, B) {
  if (A.runs.length === 1 && B.runs.length === 1) return [];
  const sa = new Set(A.runs.map((r) => r.seed)), sb = new Set(B.runs.map((r) => r.seed));
  const dropA = A.runs.filter((r) => !sb.has(r.seed)).map((r) => r.seed), dropB = B.runs.filter((r) => !sa.has(r.seed)).map((r) => r.seed);
  A.runs = A.runs.filter((r) => sb.has(r.seed)); B.runs = B.runs.filter((r) => sa.has(r.seed));
  return dropA.concat(dropB);
}
function sum(runs) {
  const S = { minutes: 0, graph: { total: 0, automation: 0, disconnects: 0, created: {} }, work: {}, builders: {}, checks: [] };
  const add = (to, from) => Object.keys(from || {}).forEach((k) => { to[k] = (to[k] || 0) + from[k]; });
  runs.forEach((r) => {
    S.minutes += r.minutes;
    S.graph.total += r.graph.total; S.graph.automation += r.graph.automation; S.graph.disconnects += r.graph.disconnects; add(S.graph.created, r.graph.created);
    Object.keys(r.buckets).forEach((k) => {
      const b = r.buckets[k], w = S.work[k] || (S.work[k] = { cues: 0, total: 0, automation: 0, disconnects: 0, built: {}, notes: {}, peak: 0 });
      w.cues += b.cues; w.total += b.total; w.automation += b.automation; w.disconnects += b.disconnects; add(w.built, b.built); add(w.notes, b.notes);
      (b.perMinute || []).forEach((m) => { if (m[0] > w.peak) w.peak = m[0]; });
    });
    r.builders.forEach((x) => {
      const key = x.site.replace(/:\d+\)$/, ")"), y = S.builders[key] || (S.builders[key] = { total: 0, built: {} });
      y.total += x.total; add(y.built, x.built);
    });
    const c = r.check;
    S.checks.push(c.nodes[0] === c.nodes[1] && c.automation[0] === c.automation[1] && c.disconnects[0] === c.disconnects[1] && !c.outside.nodes && !c.toldButBuiltNothing.length);
  });
  return S;
}

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------
const n = (v) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));
const r = (v, w) => String(v).padStart(w);
function shift(a, b) {
  if (a == null || b == null) return a ? "gone" : b ? "new" : "—";
  if (!a) return b ? "new" : "0 %";
  const p = (100 * (b - a)) / a;
  if (p >= 1000) return "×" + (b / a).toFixed(0);
  return p === 0 ? "0 %" : (p > 0 ? "+" : "") + (Math.abs(p) >= 10 ? p.toFixed(0) : p.toFixed(1)) + " %";
}
function describeSide(S, label) {
  const m = S.manifest, r0 = S.runs[0], flags = (r0.flags || []).filter((f) => f !== "cost");
  const engine = m ? R.describe(Object.assign({}, m, { flags: (m.flags || []).filter((f) => f !== "cost") })).replace(/\*\*/g, "").replace(/ · harness .*$/, "")
    : "modules " + r0.engine.fingerprint + " · " + r0.secs + " s per seed" + (flags.length ? " · flags " + flags.join(",") : "");
  return label + ": " + engine + " · seeds " + S.runs.map((x) => x.seed).sort((x, y) => x - y).join(", ");
}
function oneSide(S, top) {
  const T = sum(S.runs), L = [];
  L.push(describeSide(S, "cost") + " · " + T.minutes.toFixed(1) + " min");
  L.push("");
  L.push("work".padEnd(20) + r("cues", 7) + r("nodes", 10) + r("/min", 8) + r("peak/min", 10) + r("autom", 11) + r("/min", 8) + r("disconn", 10) + r("/min", 7) + "  notes told");
  const keys = Object.keys(T.work).sort((x, y) => T.work[y].total - T.work[x].total || T.work[y].automation - T.work[x].automation || (x < y ? -1 : 1));
  keys.forEach((k) => {
    const w = T.work[k];
    const told = Object.keys(w.notes).sort((x, y) => w.notes[y] - w.notes[x]).slice(0, 3).map((l) => l + " " + n(w.notes[l])).join(", ") || "—";
    L.push(k.padEnd(20) + r(n(w.cues), 7) + r(n(w.total), 10) + r(n(w.total / T.minutes), 8) + r(n(w.peak), 10) + r(n(w.automation), 11) + r(n(w.automation / T.minutes), 8) + r(n(w.disconnects), 10) + r(n(w.disconnects / T.minutes), 7) + "  " + told);
  });
  L.push("(the graph)".padEnd(20) + r("", 7) + r(n(T.graph.total), 10) + r(n(T.graph.total / T.minutes), 8) + r("", 10) + r(n(T.graph.automation), 11) + r(n(T.graph.automation / T.minutes), 8) + r(n(T.graph.disconnects), 10) + r(n(T.graph.disconnects / T.minutes), 7));
  L.push("");
  L.push("builders, the " + Math.min(top, Object.keys(T.builders).length) + " that built the most:");
  Object.keys(T.builders).sort((x, y) => T.builders[y].total - T.builders[x].total || (x < y ? -1 : 1)).slice(0, top)
    .forEach((k) => L.push(r(n(T.builders[k].total), 9) + "  " + k));
  L.push("");
  L.push("accounted: " + T.checks.filter(Boolean).length + " of " + T.checks.length + " run(s) — every node, call and disconnect in a work's count, none outside, every work that told notes built nodes");
  return L.join("\n");
}
function twoSides(A, B, top, dropped) {
  const TA = sum(A.runs), TB = sum(B.runs), L = [];
  L.push("cost A/B");
  L.push(describeSide(A, "A") + " · " + TA.minutes.toFixed(1) + " min");
  L.push(describeSide(B, "B") + " · " + TB.minutes.toFixed(1) + " min");
  if (dropped.length) L.push("seeds held by one side only, left out: " + dropped.join(", "));
  const secsA = [...new Set(A.runs.map((x) => x.secs))], secsB = [...new Set(B.runs.map((x) => x.secs))];
  if (secsA.join() !== secsB.join()) L.push("⚠ the two sides ran different lengths (" + secsA.join(",") + " s against " + secsB.join(",") + " s): read the per-minute columns");
  L.push("");
  const head = "work".padEnd(20) + r("nodes A", 10) + r("nodes B", 10) + r("Δ", 8) + r("/min A", 8) + r("/min B", 8) + r("peak A", 8) + r("peak B", 8) + r("autom A", 10) + r("autom B", 10) + r("Δ", 8) + r("disc A", 9) + r("disc B", 9) + r("Δ", 8);
  L.push(head);
  const keys = [...new Set(Object.keys(TA.work).concat(Object.keys(TB.work)))]
    .sort((x, y) => Math.max((TB.work[y] || {}).total || 0, (TA.work[y] || {}).total || 0) - Math.max((TB.work[x] || {}).total || 0, (TA.work[x] || {}).total || 0) || (x < y ? -1 : 1));
  const row = (name, a, b) => name.padEnd(20) + r(n(a && a.total), 10) + r(n(b && b.total), 10) + r(shift(a && a.total, b && b.total), 8) +
    r(n(a && a.total / TA.minutes), 8) + r(n(b && b.total / TB.minutes), 8) + r(a && a.peak != null ? n(a.peak) : "", 8) + r(b && b.peak != null ? n(b.peak) : "", 8) +
    r(n(a && a.automation), 10) + r(n(b && b.automation), 10) + r(shift(a && a.automation, b && b.automation), 8) +
    r(n(a && a.disconnects), 9) + r(n(b && b.disconnects), 9) + r(shift(a && a.disconnects, b && b.disconnects), 8);
  keys.forEach((k) => L.push(row(k, TA.work[k], TB.work[k])));
  L.push(row("(the graph)", TA.graph, TB.graph));
  L.push("");
  L.push("node type".padEnd(20) + r("A", 10) + r("B", 10) + r("Δ", 8));
  [...new Set(Object.keys(TA.graph.created).concat(Object.keys(TB.graph.created)))]
    .sort((x, y) => Math.max(TB.graph.created[y] || 0, TA.graph.created[y] || 0) - Math.max(TB.graph.created[x] || 0, TA.graph.created[x] || 0) || (x < y ? -1 : 1))
    .forEach((k) => L.push(k.padEnd(20) + r(n(TA.graph.created[k] || 0), 10) + r(n(TB.graph.created[k] || 0), 10) + r(shift(TA.graph.created[k] || 0, TB.graph.created[k] || 0), 8)));
  L.push("");
  const bk = [...new Set(Object.keys(TA.builders).concat(Object.keys(TB.builders)))];
  const moved = bk.map((k) => ({ k, a: (TA.builders[k] || {}).total || 0, b: (TB.builders[k] || {}).total || 0 })).filter((x) => x.a !== x.b)
    .sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a) || (x.k < y.k ? -1 : 1));
  if (!moved.length) L.push("builders: every one of the " + bk.length + " built on B what it built on A");
  else {
    L.push("builders that moved, the " + Math.min(top, moved.length) + " that moved most of " + moved.length + " (of " + bk.length + "):");
    moved.slice(0, top).forEach((x) => L.push(r(n(x.a), 9) + r(n(x.b), 9) + r(shift(x.a, x.b), 8) + "  " + x.k));
  }
  L.push("");
  L.push("accounted: A " + TA.checks.filter(Boolean).length + " of " + TA.checks.length + " run(s), B " + TB.checks.filter(Boolean).length + " of " + TB.checks.length +
    " — every node, call and disconnect in a work's count, none outside, every work that told notes built nodes");
  return L.join("\n");
}

async function main() {
  const a = U.parseArgs(process.argv.slice(2), ["help"]);
  if (a.help || (!a._.length && !a.a && !a.b)) { console.log(HELP); return; }
  const top = +a.top || 10;
  const specA = a.a || a._[0], specB = a.b || a._[1];
  const renders = [specA, specB].some((s) => s && !(String(s).endsWith(".json") && fs.existsSync(String(s))) && !(fs.existsSync(String(s)) && fs.statSync(String(s)).isDirectory() && sidecarsIn(String(s)).length));
  const out = renders ? U.outDir(a, "cost") : null;
  const A = await sideOf(specA, a, out && path.join(out, "a"), "A");
  if (!specB) { console.log(oneSide(A, top)); return; }
  const B = await sideOf(specB, a, out && path.join(out, "b"), "B");
  const dropped = matchSeeds(A, B);
  if (!A.runs.length || !B.runs.length) throw R.refusal("the two sides hold no seed in common");
  const text = twoSides(A, B, top, dropped);
  if (out) fs.writeFileSync(path.join(out, "report.txt"), text + "\n");
  console.log(text);
}

module.exports = { sum, readSidecar };
if (require.main === module) main().catch((e) => { console.error("cost.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

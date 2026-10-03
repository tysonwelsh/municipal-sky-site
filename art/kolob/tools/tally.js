#!/usr/bin/env node
// KOLOB tools — tally.js: what a meeting is made of, counted; and did it move?
//
// Cadence types, guests per meeting, section lengths, notes per minute per
// layer, note lengths, events per meeting, modes and kinds of Sunday — over
// every complete meeting of a dump set. PLAN-COMPOSITION §2.6 ("Tallies") and
// the §12 checks that a dump can answer.
//
// A/B: two builds (or two dump sets) side by side, every metric's shift, and
// a flag on each shift beyond ±15 % that is also beyond the sampling noise —
// the proof that a change is "still Kolob". When both sides were
// rendered from the same seeds, it first says which seeds came out identical.
//
//   node tools/tally.js [--seeds 1-20] [--secs 1200] [--engine <dir>|git:<ref>] [--dumps <dir>]
//   node tools/tally.js --a <spec> --b <spec> [--seeds 1-60] [--secs 1200] [--threshold 15]
//     where <spec> is a dump directory, an engine directory, git:<ref>, or "worktree"
//   --flags force=bands (the harness's switches, as render.js takes them: every
//     build rendered here is rendered with them — one guest forced on both
//     sides, so a change to its room is proved on the seeds that seat it)
//   --jobs N  harness processes at once (default min(4, the cores)); both
//     sides render on one pool of N, so neither waits on the other's last
//     seed. Each render is witnessed on its own as a lone one is, the dumps
//     are the same files byte for byte at any N, and the report differs only
//     in its timing line (PLAN-REFACTOR §4.0(c)). A harness keeps about two
//     cores busy by itself (V8's collector and compiler beside the run), so
//     four cores fill at three or four: 20 seeds a side at 1200 s took 149 s
//     at 1, 85 at 2, 70 at 3, 72 at 4 and 68 at 6 (and 85 s before, at 2 a
//     side with B after A)
//
// A/B renders 60 seeds a side by default (seconds of work): twenty meetings
// leave a share such as "meetings with a guest" ±30 points of noise.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const U = require("./lib/util.js");
const D = require("./lib/dump.js");
const R = require("./lib/run.js");

const HELP = `tally.js — counts over complete meetings; --a/--b compares two builds
  --seeds 1-20        seeds to render (default 1-20; 1-60 for A/B)
  --secs 1200         harness seconds per seed (default 1200)
  --engine / --harness / --dumps   one build (default: this worktree)
  --a <spec> --b <spec>            A/B: spec = dump dir | engine dir | git:<ref> | worktree
  --harness-a / --harness-b        harness per side (default: see README)
  --flags ives,force=bands   harness switches for every build rendered (default none)
  --jobs N            harness processes at once, both builds on one pool (default min(4, the cores))
  --threshold 15      shift (in %) worth a flag (default 15)
  --first             meeting 1 of each seed only
  --out <dir>         (default tools/out/tally-<stamp>)`;

// ---------------------------------------------------------------------------
// One meeting → a flat record of what it holds
// ---------------------------------------------------------------------------
function recordOf(run, m) {
  const ev = m.events, min = m.dur / 60;
  const r = {
    seed: run.seed, n: m.n, dur: m.dur, min, mode: m.mode, kind: m.meetingKind || "?",
    sections: m.sections.map((s) => ({ section: s.section, dur: s.dur, closed: s.closed })),
    cadences: {}, guests: {}, cats: {}, notes: {}, noteDur: {}, joints: 0,
  };
  ev.forEach((e) => {
    r.cats[e.cat] = (r.cats[e.cat] || 0) + 1;
    if (e.kind === "cadence") r.cadences[e.cadence] = (r.cadences[e.cadence] || 0) + 1;
    if (e.kind === "joint") r.joints++;
    if (e.kind === "guest" && e.phase === "start") r.guests[e.guest] = (r.guests[e.guest] || 0) + 1;
  });
  m.notes.forEach((n) => {
    r.notes[n.layer] = (r.notes[n.layer] || 0) + 1;
    (r.noteDur[n.layer] = r.noteDur[n.layer] || []).push(n.dur);
  });
  return r;
}

// ---------------------------------------------------------------------------
// Metrics: each a stat over a list of meeting records (so it can be
// bootstrapped over meetings), with a support count for the low-count guard.
// ---------------------------------------------------------------------------
function metricsFor(recs) {
  const keys = (f) => [...new Set(recs.flatMap((r) => Object.keys(f(r))))].sort();
  const secTypes = [...new Set(recs.flatMap((r) => r.sections.map((s) => s.section)))].sort();
  const M = [];
  const add = (group, id, unit, stat, support) => M.push({ group, id, unit, stat, support: support || ((rs) => rs.length) });
  const perMeeting = (f) => (rs) => U.mean(rs.map(f));

  add("shape", "meeting length", "min", perMeeting((r) => r.min));
  add("shape", "sections per meeting", "", perMeeting((r) => r.sections.length));
  secTypes.forEach((t) => {
    add("sections", "length: " + t, "s", (rs) => U.median(rs.flatMap((r) => r.sections.filter((s) => s.section === t && s.closed).map((s) => s.dur))),
      (rs) => rs.filter((r) => r.sections.some((s) => s.section === t)).length);
    add("sections", "per meeting: " + t, "", perMeeting((r) => r.sections.filter((s) => s.section === t).length),
      (rs) => rs.filter((r) => r.sections.some((s) => s.section === t)).length);
  });
  const cadKinds = keys((r) => r.cadences);
  const cadTotal = (rs) => U.sum(rs.map((r) => U.sum(Object.values(r.cadences))));
  add("cadences", "cadences per meeting", "", perMeeting((r) => U.sum(Object.values(r.cadences))));
  cadKinds.forEach((k) => {
    add("cadences", "share: " + k, "%", (rs) => { const t = cadTotal(rs); return t ? U.sum(rs.map((r) => r.cadences[k] || 0)) / t : null; },
      (rs) => rs.filter((r) => r.cadences[k]).length);
  });
  add("cadences", "joints per meeting", "", perMeeting((r) => r.joints));
  const guestKinds = keys((r) => r.guests);
  add("guests", "guests per meeting", "", perMeeting((r) => Object.keys(r.guests).length), (rs) => rs.filter((r) => Object.keys(r.guests).length).length);
  add("guests", "meetings with a guest", "%", (rs) => rs.filter((r) => Object.keys(r.guests).length > 0).length / rs.length,
    (rs) => rs.filter((r) => Object.keys(r.guests).length).length);
  guestKinds.forEach((g) => add("guests", "meetings with: " + g, "%", (rs) => rs.filter((r) => r.guests[g]).length / rs.length, (rs) => rs.filter((r) => r.guests[g]).length));
  const layers = keys((r) => r.notes);
  layers.forEach((l) => add("layers", "notes/min: " + l, "", (rs) => U.sum(rs.map((r) => r.notes[l] || 0)) / U.sum(rs.map((r) => r.min)), (rs) => rs.filter((r) => r.notes[l]).length));
  layers.forEach((l) => add("layers", "note length: " + l, "s", (rs) => U.median(rs.flatMap((r) => r.noteDur[l] || [])), (rs) => rs.filter((r) => r.notes[l]).length));
  // `transport` is the harness's own start-up line (▶ the meeting is called),
  // told by one harness and not another: not the music, so never a metric
  const cats = keys((r) => r.cats).filter((c) => c !== "transport");
  cats.forEach((c) => add("events", "per meeting: " + c, "", perMeeting((r) => r.cats[c] || 0), (rs) => rs.filter((r) => r.cats[c]).length));
  const modes = [...new Set(recs.map((r) => r.mode))].filter(Boolean).sort();
  modes.forEach((mo) => add("sundays", "mode: " + mo, "%", (rs) => rs.filter((r) => r.mode === mo).length / rs.length, (rs) => rs.filter((r) => r.mode === mo).length));
  const kinds = [...new Set(recs.map((r) => r.kind))].sort();
  kinds.forEach((k) => add("sundays", "kind: " + k, "%", (rs) => rs.filter((r) => r.kind === k).length / rs.length, (rs) => rs.filter((r) => r.kind === k).length));
  return M;
}
function show(v, unit) {
  if (v == null || !isFinite(v)) return "—";
  if (unit === "%") return (100 * v).toFixed(1) + " %";
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

// ---------------------------------------------------------------------------
async function loadSide(spec, a, into, harness, dfltSeeds, pool) {
  const isDir = spec && spec !== true && fs.existsSync(String(spec)) && fs.statSync(String(spec)).isDirectory();
  const hasDumps = isDir && fs.readdirSync(String(spec)).some((f) => f.endsWith(".jsonl"));
  const seeds = U.parseSeeds(a.seeds, U.parseSeeds(dfltSeeds || "1-20"));
  const o = hasDumps ? { dumps: spec, seeds: a.seeds ? seeds : null } : { engine: spec === "worktree" ? null : spec, harness, seeds, secs: +a.secs || 1200, flags: U.parseList(a.flags, []), into, pool };
  const set = await R.obtainSet(o);
  const runs = set.files.map((f) => D.readDump(f));
  const recs = [];
  let partial = 0;
  runs.forEach((run) => run.meetings.forEach((m, k) => {
    if (a.first && k > 0) return;
    if (!m.complete) { partial++; return; }
    recs.push(recordOf(run, m));
  }));
  return { set, runs, recs, partial };
}
// the timing line: the one line of a report that two renders of the same
// seeds may differ in (the pool's size and the clock)
function timing(t0, pool, sides, stampNow) {
  const n = sides.reduce((s, x) => s + (x.set.rendered || 0), 0), secs = ((Date.now() - t0) / 1000).toFixed(1);
  return "- " + (n ? n + " render" + (n === 1 ? "" : "s") + " in " + secs + " s, " + pool.size + " at a time" + (sides.length > 1 ? " (A and B on one pool)" : "") : "nothing rendered (dump sets read) · " + secs + " s") + " · " + stampNow;
}
// "1-20, 25" for a long list of seeds
function seedList(seeds) {
  const s = seeds.map(Number).sort((x, y) => x - y), out = [];
  for (let i = 0; i < s.length;) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i + 1 ? s[i] + "–" + s[j] : j === i + 1 ? s[i] + ", " + s[j] : String(s[i])); i = j + 1; }
  return out.join(", ");
}
// the dump minus its header: two builds that play the same meeting write the same lines
function streamHash(run) {
  const h = crypto.createHash("sha1");
  fs.readFileSync(run.file, "utf8").split("\n").forEach((l) => { if (l && !l.startsWith('["H"')) h.update(l + "\n"); });
  return h.digest("hex");
}

// §12 checks a dump can answer (PLAN-COMPOSITION §0, §8, §12, §13, §14)
function planChecks(recs, value) {
  const out = [];
  const plag = value("cadences", "share: plagal");
  out.push(["plagal share of cadences", "30–55 % (§12)", show(plag, "%"), plag == null ? "—" : plag >= 0.30 && plag <= 0.55 ? "✓" : "✗"]);
  const g = value("guests", "meetings with a guest");
  out.push(["meetings carrying a guest", "≈ 55 % (§8, §13)", show(g, "%"), g == null ? "—" : Math.abs(g - 0.55) <= 0.15 ? "✓" : "✗"]);
  const len = recs.map((r) => r.min);
  out.push(["meeting length", "≈ 14–15 min (§0 law 1)", U.fmt(U.mean(len), 1) + " min (" + U.fmt(Math.min(...len), 1) + "–" + U.fmt(Math.max(...len), 1) + ")", U.mean(len) >= 13 && U.mean(len) <= 16 ? "✓" : "✗"]);
  return out;
}

async function main() {
  const a = U.parseArgs(process.argv.slice(2), ["help", "first"]);
  if (a.help) { console.log(HELP); return; }
  const out = U.outDir(a, "tally");
  const thr = (+a.threshold || 15) / 100;
  const L = [];
  const stampNow = new Date().toISOString().slice(0, 16).replace("T", " ");
  const pool = R.pool(+a.jobs || Math.min(4, os.cpus().length)), t0 = Date.now();

  if (!a.a && !a.b) {
    // ---------------- one build ----------------
    const S = await loadSide(a.dumps || a.engine || "worktree", a, path.join(out, "dumps"), a.harness, null, pool);
    if (!S.recs.length) throw new Error("no complete meetings (raise --secs)");
    const M = metricsFor(S.recs);
    const val = (grp, id) => { const m = M.find((x) => x.group === grp && x.id === id); return m ? m.stat(S.recs) : null; };
    L.push("# Tally — " + S.recs.length + " complete meetings");
    L.push("");
    L.push("- " + R.describe(S.set.manifest));
    L.push("- seeds " + seedList(S.runs.map((r) => r.seed)) + (a.first ? " · meeting 1 only" : "") + (S.partial ? " · " + S.partial + " partial meetings left out" : ""));
    L.push(timing(t0, pool, [S], stampNow));
    const verdicts = S.set.manifest && S.set.manifest.verdicts ? Object.values(S.set.manifest.verdicts) : [];
    if (verdicts.length) L.push("- harness verdicts: " + verdicts.filter((v) => /PASS/.test(v || "")).length + "/" + verdicts.length + " PASS" + (verdicts.some((v) => !/PASS/.test(v || "")) ? " (the harness's own checks; the rest: " + [...new Set(verdicts.filter((v) => !/PASS/.test(v || "")).flatMap((v) => String(v).replace(/^FAIL — /, "").split("; ")))].join("; ") + ")" : ""));
    L.push("");
    L.push("## Plan checks");
    L.push("");
    L.push(U.table(["check", "plan", "measured", ""], planChecks(S.recs, val), ["l", "l", "r", "c"]));
    L.push("");
    const groups = [...new Set(M.map((m) => m.group))];
    groups.forEach((g) => {
      L.push("## " + g[0].toUpperCase() + g.slice(1));
      L.push("");
      L.push(U.table(["metric", "value", "meetings with it"], M.filter((m) => m.group === g).map((m) => [m.id + (m.unit && m.unit !== "%" ? " (" + m.unit + ")" : ""), show(m.stat(S.recs), m.unit), m.support(S.recs) + "/" + S.recs.length])));
      L.push("");
    });
    L.push("## Per meeting");
    L.push("");
    L.push(U.table(["seed", "m", "min", "mode", "kind", "sections", "cadences", "guests", "notes"],
      S.recs.map((r) => [String(r.seed), String(r.n), r.min.toFixed(1), r.mode || "?", r.kind, r.sections.map((s) => s.section.slice(0, 4)).join("·"),
        Object.entries(r.cadences).map(([k, v]) => k + " " + v).join(", "), Object.keys(r.guests).join(", ") || "—", String(U.sum(Object.values(r.notes)))]),
      ["l", "r", "r", "l", "l", "l", "l", "l", "r"]));
    L.push("");
    fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(M.map((m) => ({ group: m.group, id: m.id, unit: m.unit, value: m.stat(S.recs), support: m.support(S.recs) })), null, 1));
  } else {
    // ---------------- A/B ----------------
    // both sides on one pool; a failure on either stops the other's renders
    // not yet begun, and the failure is what is told
    const side = (spec, dir, harness) => loadSide(spec, a, path.join(out, dir), harness, "1-60", pool).catch((e) => { pool.stop(); throw e; });
    const sides = await Promise.allSettled([side(a.a || "worktree", "dumps-a", a["harness-a"]), side(a.b || "worktree", "dumps-b", a["harness-b"])]);
    const why = sides.filter((x) => x.status === "rejected").map((x) => x.reason);
    if (why.length) throw why.find((e) => !e.stopped) || why[0];
    const A = sides[0].value, B = sides[1].value;
    if (!A.recs.length || !B.recs.length) throw new Error("no complete meetings on one side (raise --secs)");
    const MA = metricsFor(A.recs.concat(B.recs));   // one metric list over the union, evaluated per side
    const rows = [];
    MA.forEach((m, k) => {
      const va = m.stat(A.recs), vb = m.stat(B.recs);
      const seA = U.bootstrapSE(A.recs, m.stat, 300, 11 + k), seB = U.bootstrapSE(B.recs, m.stat, 300, 911 + k);
      const noise = 2 * Math.sqrt((seA || 0) ** 2 + (seB || 0) ** 2);
      const supA = m.support(A.recs), supB = m.support(B.recs);
      let delta = null, flag = "";
      if (va == null && vb == null) return;
      if (va === vb) flag = "";
      else if (!va) { delta = Infinity; flag = "new"; }
      else if (!vb) { delta = -1; flag = "gone"; }
      else delta = (vb - va) / Math.abs(va);
      const low = Math.max(supA, supB) < 5;
      if (flag === "" && delta != null && Math.abs(delta) > thr) flag = Math.abs((vb || 0) - (va || 0)) > noise ? "SHIFT" : "within noise";
      if ((flag === "new" || flag === "gone") && Math.abs((vb || 0) - (va || 0)) <= noise) flag += " (within noise)";
      if (flag && low) flag += ", low count";
      rows.push({ m, va, vb, delta, noise, flag, supA, supB });
    });
    // paired seeds
    const byA = {}, byB = {};
    A.runs.forEach((r) => (byA[r.seed] = r));
    B.runs.forEach((r) => (byB[r.seed] = r));
    const paired = Object.keys(byA).filter((s) => byB[s]);
    const same = paired.filter((s) => streamHash(byA[s]) === streamHash(byB[s]));
    const seedsA = [...new Set(A.runs.map((r) => r.seed))], seedsB = [...new Set(B.runs.map((r) => r.seed))];
    const sameSeeds = seedsA.length === seedsB.length && seedsA.every((s) => byB[s]);
    const mA = A.set.manifest || {}, mB = B.set.manifest || {};
    const fpA = mA.fingerprint || null, fpB = mB.fingerprint || null;
    const twoHarnesses = mA.harness && mB.harness && mA.harness !== mB.harness;
    const flagged = rows.filter((r) => /^(SHIFT|new|gone)/.test(r.flag) && !/within noise|low count/.test(r.flag));
    const noisy = rows.filter((r) => /within noise|low count/.test(r.flag));

    L.push("# Tally A/B — " + A.recs.length + " vs " + B.recs.length + " complete meetings");
    L.push("");
    L.push("- **A:** " + R.describe(A.set.manifest));
    L.push("- **B:** " + R.describe(B.set.manifest));
    L.push("- " + (sameSeeds ? "seeds " + seedList(seedsA) : "seeds **A:** " + seedList(seedsA) + " · **B:** " + seedList(seedsB)) + (a.first ? " · meeting 1 only" : "") + " · threshold ±" + Math.round(thr * 100) + " %");
    L.push(timing(t0, pool, [A, B], stampNow));
    L.push("");
    L.push("## Verdict");
    L.push("");
    if (!sameSeeds) L.push("- **⚠ A and B hold different seeds** (" + seedsA.length + " against " + seedsB.length + ", " + paired.length + " shared): every shift below mixes the change with which Sundays were drawn. Pass `--seeds` to compare like with like.");
    if (paired.length) L.push("- **Same seeds, same meetings?** " + same.length + " of " + paired.length + " shared seeds played identically (note and event streams byte-for-byte)" +
      (same.length === paired.length ? " — **nothing moved**" + (fpA && fpB && fpA !== fpB ? " (the modules' bytes differ, " + fpA + " against " + fpB + ", but not the music)" : "") + "." :
        same.length ? "; the rest differ: " + seedList(paired.filter((s) => !same.includes(s)).map(Number)) + "." : ".") +
      (same.length < paired.length && fpA && fpA === fpB ? " The two sides played the same module bytes (" + fpA + "), so the difference is the harness or the flags, not the engine." : ""));
    if (twoHarnesses) L.push("- **Two harnesses:** A was rendered by `" + mA.harness + "`, B by `" + mB.harness + "`. Each harness stamps its records its own way, so the identity line above compares the harnesses as well as the engines; the metrics below do not depend on it.");
    L.push("- **Shifts beyond ±" + Math.round(thr * 100) + " % and beyond noise:** " + (flagged.length ? "**" + flagged.length + "** — " + flagged.map((r) => r.m.group + " · " + r.m.id + " (" + (isFinite(r.delta) ? (r.delta > 0 ? "+" : "") + (100 * r.delta).toFixed(0) + " %" : r.flag) + ")").join("; ") : "none") + ".");
    if (noisy.length) L.push("- **Beyond ±" + Math.round(thr * 100) + " % but within noise or on few meetings** (worth a look, not a verdict): " + noisy.length + " — " + noisy.slice(0, 8).map((r) => r.m.id).join("; ") + (noisy.length > 8 ? "; …" : "") + ".");
    L.push("- **Noise** is two bootstrap standard errors of the difference (meetings resampled 300× per side); with the same seeds on both sides and an unchanged engine every difference is exactly zero." +
      (Math.min(A.recs.length, B.recs.length) < 40 ? " With " + Math.min(A.recs.length, B.recs.length) + " meetings on a side the band is wide (a share such as \"meetings with a guest\" moves ±30 points on twenty): `--seeds 1-60` renders in seconds." : ""));
    L.push("");
    const valA = (grp, id) => { const r = rows.find((x) => x.m.group === grp && x.m.id === id); return r ? r.va : null; };
    const valB = (grp, id) => { const r = rows.find((x) => x.m.group === grp && x.m.id === id); return r ? r.vb : null; };
    const cA = planChecks(A.recs, valA), cB = planChecks(B.recs, valB);
    L.push("## Plan checks");
    L.push("");
    L.push(U.table(["check", "plan", "A", "B"], cA.map((c, i) => [c[0], c[1], c[2] + " " + c[3], cB[i][2] + " " + cB[i][3]]), ["l", "l", "r", "r"]));
    L.push("");
    const groups = [...new Set(rows.map((r) => r.m.group))];
    groups.forEach((g) => {
      L.push("## " + g[0].toUpperCase() + g.slice(1));
      L.push("");
      L.push(U.table(["metric", "A", "B", "Δ", "noise ±", "meetings A/B", "flag"],
        rows.filter((r) => r.m.group === g).map((r) => [r.m.id + (r.m.unit && r.m.unit !== "%" ? " (" + r.m.unit + ")" : ""), show(r.va, r.m.unit), show(r.vb, r.m.unit),
          r.delta == null ? "0" : isFinite(r.delta) ? (r.delta > 0 ? "+" : "") + (100 * r.delta).toFixed(0) + " %" : "new",
          r.m.unit === "%" ? (100 * r.noise).toFixed(1) + " pt" : show(r.noise, ""), r.supA + "/" + r.supB, /^(SHIFT|new|gone)/.test(r.flag) && !/noise|low/.test(r.flag) ? "**⚑ " + r.flag + "**" : r.flag]),
        ["l", "r", "r", "r", "r", "r", "l"]));
      L.push("");
    });
    fs.writeFileSync(path.join(out, "metrics.json"), JSON.stringify(rows.map((r) => ({ group: r.m.group, id: r.m.id, unit: r.m.unit, a: r.va, b: r.vb, delta: isFinite(r.delta) ? r.delta : null, noise: r.noise, flag: r.flag })), null, 1));
  }
  L.push("## How it is counted");
  L.push("");
  L.push("- Only complete meetings (the next meeting began, or the log said \"meeting ends\", inside the run). Section lengths run from one section's start to the next (the joint included); cadences are the harmony's cadences (v0.30: `∴ <kind> cadence`; typed: `cadence.kind`); joints are the section joints; a guest is counted once per meeting however long it stays.");
  L.push("- Notes per minute and note lengths count every emitted note, doublings and unpitched events included, as the engine reports them.");
  L.push("- Events per meeting count every event by its `cat` (or typed `type`), except `transport`: the harness's own start-up line, which one harness tells and another does not.");
  L.push("");
  fs.writeFileSync(path.join(out, "report.md"), L.join("\n"));
  console.log(path.join(out, "report.md"));
}

module.exports = { recordOf, metricsFor, planChecks };
if (require.main === module) main().catch((e) => { console.error("tally.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

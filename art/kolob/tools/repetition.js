#!/usr/bin/env node
// KOLOB tools — repetition.js: how often a meeting says the same thing twice.
//
// Within a meeting: every voice's phrases, the distinct phrase shapes per
// hour, and the heard-before rate — how often a phrase's shape has already
// sounded earlier in the same meeting. Across seeds: the shapes that turn up
// in the most meetings (the stock formulas a returning visitor would learn).
// PLAN-COMPOSITION §2.6 ("Repetition: phrase shapes heard before within a
// meeting") and §12.
//
//   node tools/repetition.js [--seeds 1-20] [--secs 1200] [--first]
//        [--engine <dir>|git:<ref>] [--dumps <dir>] [--min 3] [--out <dir>]
//
// A phrase shape is transposition-free: the melodic intervals in semitones
// (rounded from the just ratios) and the rhythm as inter-onset ratios to the
// phrase's own median beat. Two looser readings are reported alongside:
// the pitch shape (intervals only) and the contour (up/down/same).
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./lib/util.js");
const D = require("./lib/dump.js");
const R = require("./lib/run.js");

const HELP = `repetition.js — phrase shapes heard before, within a meeting and across seeds
  --seeds 1-20 | 1847,5     seeds (default 1-20)
  --secs 1200               harness seconds per seed (default 1200: one complete meeting and change)
  --first                   read meeting 1 of each seed only (default: every complete meeting)
  --min 3                   notes a phrase needs to count (default 3)
  --common-min 4            notes a shape needs for the across-seeds table (default 4)
  --engine / --harness / --dumps / --out   as in the other tools`;

const NOT_MELODIC = new Set(["drone", "ambient"]);
const Q = [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2, 3, 4];
const QN = ["¼", "⅓", "½", "⅔", "¾", "1", "1½", "2", "3", "4"];
const CROSS_LEAD = 1.0;   // a doubling in another voice is "heard together", not "heard before"

function shapeOf(ph, keynote) {
  const iv = [], io = [];
  for (let i = 1; i < ph.length; i++) {
    iv.push(Math.round(D.cents(ph[i].freq, ph[i - 1].freq) / 100));
    io.push(ph[i].t - ph[i - 1].t);
  }
  const med = U.median(io.filter((x) => x > 0)) || 1;
  const rq = io.map((x) => {
    const r = Math.max(1e-3, x / med);
    let best = 0;
    for (let k = 1; k < Q.length; k++) if (Math.abs(Math.log(r / Q[k])) < Math.abs(Math.log(r / Q[best]))) best = k;
    return best;
  });
  const ivs = iv.map((x) => (x > 0 ? "+" + x : x < 0 ? "−" + -x : "0")).join(" ");
  return {
    key: ivs + " | " + rq.map((k) => QN[k]).join(" "),
    pitch: ivs,
    contour: iv.map((x) => (x > 0 ? "u" : x < 0 ? "d" : "s")).join(""),
    rhythm: rq.map((k) => QN[k]).join(" "),
    solf: keynote ? ph.map((n) => D.solf(n.freq, keynote)).join(" ") : null,
    n: ph.length,
  };
}

function analyseMeeting(run, m, minN) {
  const lines = D.voiceLines(m.notes, NOT_MELODIC);
  const all = [];
  const perVoice = {};
  for (const [voice, line] of lines) {
    const phs = D.phrasesOf(line).filter((p) => p.length >= minN);
    perVoice[voice] = { phrases: phs.length, shapes: new Set(), pitch: new Set(), again: 0, againPitch: 0, againContour: 0, againCross: 0, counts: {} };
    const seen = { key: new Set(), pitch: new Set(), contour: new Set() };
    phs.forEach((ph) => {
      const s = shapeOf(ph, m.keynoteHz);
      const V = perVoice[voice];
      if (seen.key.has(s.key)) V.again++;
      if (seen.pitch.has(s.pitch)) V.againPitch++;
      if (seen.contour.has(s.contour)) V.againContour++;
      seen.key.add(s.key); seen.pitch.add(s.pitch); seen.contour.add(s.contour);
      V.shapes.add(s.key); V.pitch.add(s.pitch);
      V.counts[s.key] = (V.counts[s.key] || 0) + 1;
      all.push({ voice, t: ph[0].t, s });
    });
  }
  // across voices: heard earlier in any voice (by more than CROSS_LEAD seconds)
  all.sort((a, b) => a.t - b.t);
  const firstAt = {};
  all.forEach((x) => {
    const f = firstAt[x.s.key];
    if (f != null && x.t - f > CROSS_LEAD) perVoice[x.voice].againCross++;
    if (f == null) firstAt[x.s.key] = x.t;
  });
  return { run, m, perVoice, all };
}

async function main() {
  const a = U.parseArgs(process.argv.slice(2), ["help", "first"]);
  if (a.help) { console.log(HELP); return; }
  const seeds = U.parseSeeds(a.seeds, U.parseSeeds("1-20"));
  const secs = +a.secs || 1200, minN = +a.min || 3;
  const out = U.outDir(a, "repetition");
  const set = await R.obtainSet({ dumps: a.dumps, engine: a.engine, harness: a.harness, seeds, secs, into: path.join(out, "dumps"), jobs: +a.jobs || 0 });
  const runs = set.files.map((f) => D.readDump(f));

  const meetings = [];
  let partial = 0;
  runs.forEach((run) => run.meetings.forEach((m, k) => {
    if (a.first && k > 0) return;
    if (!m.complete) { partial++; return; }
    meetings.push(analyseMeeting(run, m, minN));
  }));
  if (!meetings.length) throw new Error("no complete meeting in the dumps (raise --secs)");

  // ---- per voice, pooled over meetings ----
  const voices = [...new Set(meetings.flatMap((x) => Object.keys(x.perVoice)))].sort();
  const vrows = voices.map((v) => {
    const ms = meetings.filter((x) => x.perVoice[v] && x.perVoice[v].phrases > 0);
    const ph = U.sum(ms.map((x) => x.perVoice[v].phrases));
    const perHour = ms.map((x) => x.perVoice[v].shapes.size / (x.m.dur / 3600));
    const rate = (f) => (ph ? U.sum(ms.map((x) => x.perVoice[v][f])) / ph : null);
    return {
      v, meetings: ms.length, ph, perMeeting: ms.length ? ph / ms.length : 0,
      distinctHr: U.median(perHour), distinctShare: ph ? U.sum(ms.map((x) => x.perVoice[v].shapes.size)) / ph : null,
      again: rate("again"), againPitch: rate("againPitch"), againContour: rate("againContour"), againCross: rate("againCross"),
    };
  }).filter((r) => r.ph > 0).sort((x, y) => y.ph - x.ph);

  // ---- per meeting ----
  const mrows = meetings.map((x) => {
    const P = Object.values(x.perVoice);
    const ph = U.sum(P.map((p) => p.phrases)), again = U.sum(P.map((p) => p.again)), cross = U.sum(P.map((p) => p.againCross));
    let top = null;
    Object.entries(x.perVoice).forEach(([v, p]) => Object.entries(p.counts).forEach(([k, c]) => { if (!top || c > top.c) top = { v, k, c }; }));
    return { x, ph, again: ph ? again / ph : null, cross: ph ? cross / ph : null, distinct: U.sum(P.map((p) => p.shapes.size)), top };
  });

  // ---- across seeds ----
  const bank = {};
  meetings.forEach((x) => {
    const seenHere = new Set();
    x.all.forEach((o) => {
      const b = bank[o.s.key] = bank[o.s.key] || { s: o.s, meetings: 0, seeds: new Set(), occ: 0, voices: new Set(), ex: null };
      b.occ++; b.voices.add(o.voice);
      if (!b.ex) b.ex = { seed: x.run.seed, meeting: x.m.n, t: o.t, voice: o.voice, solf: o.s.solf };
      if (!seenHere.has(o.s.key)) { seenHere.add(o.s.key); b.meetings++; b.seeds.add(x.run.seed); }
    });
  });
  // three-note shapes (a repeated note, a bass fourth) recur by chance; the
  // table of stock formulas starts at --common-min notes (default 4)
  const commonMin = +a["common-min"] || 4;
  const common = Object.values(bank).filter((b) => b.meetings > 1 && b.s.n >= commonMin).sort((p, q) => q.meetings - p.meetings || q.occ - p.occ);
  const totalShapes = Object.keys(bank).length;
  const onlyOnce = Object.values(bank).filter((b) => b.meetings === 1).length;
  // pitch-shape (rhythm-free) commonality, for the family resemblance
  const pbank = {};
  meetings.forEach((x) => { const seen = new Set(); x.all.forEach((o) => { if (seen.has(o.s.pitch)) return; seen.add(o.s.pitch); pbank[o.s.pitch] = (pbank[o.s.pitch] || 0) + 1; }); });
  const pcommon = Object.entries(pbank).filter(([k]) => k.split(" ").length >= 3).sort((p, q) => q[1] - p[1]).slice(0, 8);

  const allPh = U.sum(mrows.map((r) => r.ph));
  const pooledAgain = U.sum(meetings.map((x) => U.sum(Object.values(x.perVoice).map((p) => p.again)))) / allPh;
  const pooledCross = U.sum(meetings.map((x) => U.sum(Object.values(x.perVoice).map((p) => p.againCross)))) / allPh;

  // ---- report ----
  const L = [];
  const pctM = (b) => U.pct(b.meetings / meetings.length);
  L.push("# Repetition — phrase shapes heard before");
  L.push("");
  L.push("*PLAN-COMPOSITION §2.6: \"Repetition: phrase shapes heard before within a meeting.\" Recurrence inside a meeting is by design (the theme returns, a hymn's verses repeat); the same shape in every meeting is the rut.*");
  L.push("");
  L.push("- " + R.describe(set.manifest));
  L.push("- " + meetings.length + " complete meetings from " + runs.length + " seeds" + (a.first ? " (meeting 1 only)" : "") + (partial ? " · " + partial + " partial meetings left out" : "") + " · " + allPh + " phrases of ≥ " + minN + " notes · " + new Date().toISOString().slice(0, 16).replace("T", " "));
  L.push("");
  L.push("## Verdict");
  L.push("");
  L.push("- **Heard before, same voice:** " + U.pct(pooledAgain, 1) + " of phrases repeat a shape their own voice already sang in that meeting; **any voice:** " + U.pct(pooledCross, 1) + " (a doubling within " + CROSS_LEAD + " s is heard together, not before).");
  L.push("- **Most repetitive meeting:** " + (() => { const r = mrows.slice().sort((p, q) => q.again - p.again)[0]; return "seed " + r.x.run.seed + " meeting " + r.x.m.n + ", " + U.pct(r.again) + " heard before (" + r.ph + " phrases)"; })() +
    "; **least:** " + (() => { const r = mrows.slice().sort((p, q) => p.again - q.again)[0]; return "seed " + r.x.run.seed + " meeting " + r.x.m.n + ", " + U.pct(r.again); })() + ".");
  L.push("- **Across seeds:** " + totalShapes + " distinct shapes; " + U.pct(onlyOnce / totalShapes) + " of them belong to one meeting only. " +
    (common.length ? "The commonest of " + commonMin + "+ notes, `" + common[0].s.key + "` (" + common[0].s.n + " notes, " + [...common[0].voices].join("/") + "), is in " + common[0].meetings + " of " + meetings.length + " meetings." : "No shape of " + commonMin + "+ notes recurs across meetings."));
  L.push("");
  L.push("## Per voice");
  L.push("");
  L.push("*distinct/hr* is the number of distinct shapes a voice sings per hour of meeting (median over meetings); *heard before* counts a phrase whose shape the same voice already sang in that meeting, in three readings from strict to loose.");
  L.push("");
  L.push(U.table(["voice", "meetings", "phrases/meeting", "distinct/hr", "distinct share", "heard before (shape)", "(pitch only)", "(contour)", "heard before in any voice"],
    vrows.map((r) => [r.v, String(r.meetings), U.fmt(r.perMeeting, 1), U.fmt(r.distinctHr, 0), U.pct(r.distinctShare), U.pct(r.again), U.pct(r.againPitch), U.pct(r.againContour), U.pct(r.againCross)])));
  L.push("");
  L.push("## Per meeting");
  L.push("");
  L.push(U.table(["seed", "meeting", "length", "phrases", "distinct shapes", "heard before", "any voice", "most repeated (voice ×n: shape)"],
    mrows.map((r) => [String(r.x.run.seed), String(r.x.m.n), (r.x.m.dur / 60).toFixed(1) + " min", String(r.ph), String(r.distinct), U.pct(r.again), U.pct(r.cross),
      r.top && r.top.c > 1 ? r.top.v + " ×" + r.top.c + ": `" + r.top.k + "`" : "nothing twice"]), ["l", "r", "r", "r", "r", "r", "r", "l"]));
  L.push("");
  L.push("## Across seeds — the shapes (≥ " + commonMin + " notes) in the most meetings");
  L.push("");
  L.push("Shape = intervals in semitones | each inter-onset time as a ratio to the phrase's median beat (quantised to " + QN.join(" ") + "). The example is the first hearing, spelled in solfège against that meeting's keynote.");
  L.push("");
  L.push(U.table(["shape", "notes", "meetings", "occurrences", "voices", "first heard"],
    common.slice(0, 15).map((b) => ["`" + b.s.key + "`", String(b.s.n), b.meetings + " (" + pctM(b) + ")", String(b.occ), [...b.voices].join(", "),
      "seed " + b.ex.seed + " m" + b.ex.meeting + " @" + Math.round(b.ex.t) + " s: " + (b.ex.solf || "")]), ["l", "r", "r", "r", "l", "l"]));
  L.push("");
  L.push("Rhythm-free (pitch shape, ≥ 3 intervals) in the most meetings: " + (pcommon.length ? pcommon.map(([k, c]) => "`" + k + "` " + c + "/" + meetings.length).join(" · ") : "none") + ".");
  L.push("");
  L.push("## How it is measured");
  L.push("");
  L.push("- One line per voice (layer, or layer:part when the engine marks parts); a chordal layer without parts is read by its top line. Drone and field are left out.");
  L.push("- A phrase ends at a breath (more than 0.35 s of silence between one note's end and the next onset) or at 12 notes. Phrases under " + minN + " notes are not counted.");
  L.push("- Meetings are the harness's meeting 1, 2, …; only complete ones count, so every rate is over a whole meeting.");
  L.push("");
  fs.writeFileSync(path.join(out, "report.md"), L.join("\n"));
  fs.writeFileSync(path.join(out, "shapes.json"), JSON.stringify(Object.values(bank).sort((p, q) => q.meetings - p.meetings || q.occ - p.occ).map((b) => ({ key: b.s.key, n: b.s.n, meetings: b.meetings, occurrences: b.occ, voices: [...b.voices], example: b.ex })), null, 1));
  console.log(path.join(out, "report.md"));
}

module.exports = { shapeOf, analyseMeeting };
if (require.main === module) main().catch((e) => { console.error("repetition.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

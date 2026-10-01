#!/usr/bin/env node
// KOLOB tools — selftest.js: do the instruments still read true? (seconds, no browser)
//
//   node tools/selftest.js
//
// 1. A real dump from this worktree's harness reads as meetings and sections.
// 2. A synthetic dump in the SCORE.md §6 typed vocabulary reads the same way —
//    meetings, sections, cadences, guests, parts, and the distinctness hooks
//    (sunday, dialect, cast) light up — and a typed event echoed by a log
//    line (a build older than 2026-09-27) counts once: the readers are proved
//    on a dump no harness wrote.
// 3. The same seed rendered twice is distance 0; two seeds are not.
// 4. The loudness meter reads the BS.1770 reference tones, and gates as
//    EBU Tech 3341 says it must (its cases 3, 4 and 5, and a −20/−40 half).
// 5. The witness: a render names the engine it played, and a harness that
//    plays another directory's engine than the one it was pointed at is
//    refused before a number is computed.
// 6. The count: every section of a complete meeting closes on one joint
//    (`∴ the room empties` says how a joint goes; it is not one of its own),
//    and the harness's start-up line is not a metric.
// 7. The capture: a tap block read a few samples off is laid contiguous; a
//    hole is found, sized to its render quanta, and placed in time; and
//    --meeting finds meeting 1's end in either vocabulary.
"use strict";
const fs = require("fs");
const path = require("path");
const D = require("./lib/dump.js");
const R = require("./lib/run.js");
const A = require("./lib/audio.js");
const Dist = require("./distinctness.js");
const Tally = require("./tally.js");
const Rep = require("./repetition.js");
const Cap = require("./capture.js");

let fails = 0;
function check(name, ok, detail) {
  console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail ? " — " + detail : ""));
  if (!ok) fails++;
}

(async () => {
  const tmp = path.join(R.OUT_ROOT, "_selftest");
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  console.log("1. a real dump (this worktree, seeds 1847 ×2 and 5, 200 s)");
  const engine = R.resolveEngine(null);
  const { results } = await R.renderSet({ engine, seeds: [1847, 5], secs: 200, dir: tmp, extra: [{ seed: 1847, name: "twin-1847" }], quiet: true });
  const run = D.readDump(results.find((r) => r.name === "seed-1847").dump);
  check("header read", run.header.format === "kolob-dump" && run.seed === 1847 && run.secs === 200, "seed " + run.header.seed + " · " + run.header.secs + " s");
  check("meeting 1 found with mode, kind and keynote", run.meetings.length >= 1 && !!run.meetings[0].mode && !!run.meetings[0].meetingKind && run.meetings[0].keynoteHz > 100,
    run.meetings[0].mode + " · " + run.meetings[0].meetingKind + " · " + (run.meetings[0].keynoteHz || 0).toFixed(1) + " Hz");
  check("sections in order from the meeting's start", run.meetings[0].sections.length >= 2 && Math.abs(run.meetings[0].sections[0].t0 - run.meetings[0].t0) < 0.5, run.meetings[0].sections.map((s) => s.section + "@" + s.t0.toFixed(0)).join(" "));
  check("voices found", D.voiceLines(run.notes).size >= 3, [...D.voiceLines(run.notes).keys()].join(", "));
  check("the witness names what the harness played: the build's own list", results.every((r) => r.loaded && r.loaded.fingerprint === engine.fingerprint),
    "modules " + results[0].loaded.fingerprint + ", " + results[0].loaded.files.length + " files, the list in " + engine.list.from);
  check("the harness names it too, in the header (`engine`), and agrees", results.every((r) => r.loaded && r.loaded.saidBy === "header and witness"),
    run.header.engine ? "fingerprint " + run.header.engine.fingerprint : "this harness writes no header.engine");

  console.log("2. a synthetic dump in the typed vocabulary (SCORE.md §6)");
  const lines = [
    ["H", 0, { format: "kolob-dump", v: 1, seed: 42, secs: 130, flags: [] }],
    ["E", 0, { type: "meeting-start", n: 1, sunday: "pioneer", kind: "jubilee", mode: "ionian", keynoteHz: 261.6, houseDialect: "gospel", t: 0 }],
    ["E", 0, { type: "section-start", section: "prelude", index: 0, t: 0 }],
    ["E", 1, { type: "hymn-announced", hymn: { id: "h:1:1", number: 214, meter: "CM", dialect: "sacredharp" }, t: 1 }],
    ["E", 1, { type: "cast", memberId: "m:7", action: "rises", t: 1 }],
    ["E", 1, { type: "verse-start", hymnId: "h:1:1", verse: 1, practice: "notes", t: 1 }],
  ];
  const tune = [0, 2, 4, 5, 7, 5, 4, 2, 0, 2, 4, 0];
  tune.forEach((d, i) => ["S", "A", "T", "B"].forEach((p, k) => lines.push(["N", 1, { layer: "choir", part: p, freq: 261.6 * Math.pow(2, (d - 7 * k) / 12), startTime: 2 + i, duration: 1, hymnId: "h:1:1", memberId: k === 2 ? "m:7" : null }])));
  lines.push(["E", 14, { type: "cadence", kind: "openfifth", hymnId: "h:1:1", t: 14 }]);
  lines.push(["E", 20, { type: "guest-start", guest: "trombones", section: "prelude", logged: true, t: 20 }]);
  lines.push(["E", 60, { type: "section-start", section: "invocation", index: 1, t: 60 }]);
  lines.push(["E", 60.02, { cat: "section", label: "§ INVOCATION", detail: "50s", t: 60.02 }]);     // the log-line echo of an old build
  lines.push(["E", 70, { type: "cadence", kind: "plagal", t: 70 }]);
  lines.push(["E", 70.01, { cat: "harmony", label: "∴ plagal cadence", detail: "amen", t: 70.01 }]); // the same echo
  lines.push(["E", 100, { type: "guest-end", guest: "trombones", t: 100 }]);
  lines.push(["E", 110, { type: "meeting-start", n: 2, sunday: "ordinary", kind: "ordinary", mode: "dorian", keynoteHz: 240, t: 110 }]);
  lines.push(["E", 125, { type: "meeting-end", n: 2, dur: 3, t: 125 }]);   // (no engine emits meeting-end; the reader must still close a meeting on one)
  const synth = path.join(tmp, "typed-42.jsonl");
  fs.writeFileSync(synth, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const T = D.readDump(synth);
  const m1 = T.meetings[0];
  check("two meetings; the first complete", T.meetings.length === 2 && m1.complete && m1.t1 === 110);
  check("the last closed by a typed meeting-end", T.meetings[1].complete && T.meetings[1].t1 === 128, "ends at " + T.meetings[1].t1);
  check("sections read, the echo merged (plannedDur from the log line)", m1.sections.length === 2 && m1.sections[1].section === "invocation" && m1.sections[1].plannedDur === 50,
    m1.sections.map((s) => s.section + " " + s.dur + " s").join(", "));
  const rec = Tally.recordOf(T, m1);
  check("cadences counted once each", rec.cadences.openfifth === 1 && rec.cadences.plagal === 1, JSON.stringify(rec.cadences));
  check("guest counted", rec.guests.trombones === 1);
  check("parts are voices", ["choir:S", "choir:A", "choir:T", "choir:B"].every((v) => D.voiceLines(m1.notes).has(v)));
  const F = Dist.featuresOf(T, 120);
  check("hooks lit: sunday, dialect, cast", F.sunday.value === "pioneer" && F.dialect.value.includes("gospel") && F.dialect.value.includes("sacredharp") && F.cast.value.includes("m:7"),
    "sunday " + F.sunday.value + " · dialect " + F.dialect.value + " · cast " + F.cast.value);
  const rep = Rep.analyseMeeting(T, m1, 3);
  check("phrase shapes read from a part", rep.perVoice["choir:S"] && rep.perVoice["choir:S"].phrases === 1);

  console.log("3. distinctness sanity");
  const a1 = D.readDump(results.find((r) => r.name === "seed-1847").dump), a2 = D.readDump(results.find((r) => r.name === "twin-1847").dump), b = D.readDump(results.find((r) => r.name === "seed-5").dump);
  const feats = [a1, a2, b].map((r) => Dist.featuresOf(r, 180));
  Dist.expandDensity(feats, 180);
  const names = [...new Set(feats.flatMap((f) => Object.keys(f)))];
  const sc = Dist.scales([feats[0], feats[2]], names);
  const same = Dist.pair(feats[0], feats[1], names, sc).D, diff = Dist.pair(feats[0], feats[2], names, sc).D;
  check("same seed twice → D = 0", same === 0, "D = " + same);
  check("seeds 1847 and 5 → D > 0", diff > 0, "D = " + diff.toFixed(3));

  console.log("4. loudness (BS.1770-4, gated as EBU Tech 3341)");
  const sr = 48000, n = sr * 10, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.1 * Math.sin(2 * Math.PI * 1000 * i / sr);
  const st = A.loudness([L, L], sr).integrated, mono = A.loudness([L, new Float32Array(n)], sr).integrated;
  check("1 kHz at −20 dBFS, both channels → −20.0 LUFS", Math.abs(st + 20) < 0.05, st.toFixed(2));
  check("… one channel → −23.0 LUFS", Math.abs(mono + 23) < 0.05, mono.toFixed(2));
  const c = A.kCoefs(48000);
  check("K-weighting at 48 kHz = the spec's coefficients", Math.abs(c[0].b[0] - 1.53512485958697) < 1e-9 && Math.abs(c[1].a[0] + 1.99004745483398) < 1e-9);
  // a 1 kHz stereo tone in steps of [dBFS, seconds], its phase running on
  const steps = (plan) => {
    const len = plan.reduce((a2, p) => a2 + Math.round(p[1] * sr), 0), x = new Float32Array(len);
    let i = 0;
    plan.forEach(([db, secs]) => { const amp = Math.pow(10, db / 20); for (let e = i + Math.round(secs * sr); i < e; i++) x[i] = amp * Math.sin(2 * Math.PI * 1000 * i / sr); });
    return A.loudness([x, x], sr).integrated;
  };
  const g3 = steps([[-36, 10], [-23, 60], [-36, 10]]);
  check("EBU 3341 case 3: −36/−23/−36 dBFS (10/60/10 s) → −23.0 ±0.1 (the relative gate drops the −36)", Math.abs(g3 + 23) <= 0.1, g3.toFixed(2));
  const g4 = steps([[-72, 10], [-36, 10], [-23, 60], [-36, 10], [-72, 10]]);
  check("EBU 3341 case 4: −72/−36/−23/−36/−72 → −23.0 ±0.1 (the absolute gate drops the −72)", Math.abs(g4 + 23) <= 0.1, g4.toFixed(2));
  const g5 = steps([[-26, 20], [-20, 20.1], [-26, 20]]);
  check("EBU 3341 case 5: −26/−20/−26 (20/20.1/20 s) → −23.0 ±0.1", Math.abs(g5 + 23) <= 0.1, g5.toFixed(2));
  const gh = steps([[-20, 30], [-40, 30]]);
  check("half at −20, half at −40 → −20.0 ±0.1 (ungated it would read −23.0: the −40 half is gated out)", Math.abs(gh + 20) <= 0.1, gh.toFixed(2));

  console.log("5. the witness: the engine a harness played, not the one it was told");
  // a copy of this engine, and a harness that ignores KOLOB_BASE and KOLOB_DIR
  const copy = path.join(tmp, "engine-copy", "art", "kolob");
  fs.mkdirSync(copy, { recursive: true });
  fs.readdirSync(R.HERE_ENGINE).filter((f) => /^kolob-.*\.js$|^index\.php$|^_engine\.php$|^VERSION$/.test(f)).forEach((f) => fs.copyFileSync(path.join(R.HERE_ENGINE, f), path.join(copy, f)));
  const sub = path.join(R.HERE_ENGINE, "..", "prosperos-jukebox-v2"), subCopy = path.join(copy, "..", "prosperos-jukebox-v2");
  fs.mkdirSync(subCopy, { recursive: true });
  fs.readdirSync(sub).filter((f) => /^pj2-.*\.js$/.test(f)).forEach((f) => fs.copyFileSync(path.join(sub, f), path.join(subCopy, f)));
  fs.appendFileSync(path.join(copy, "kolob-meeting.js"), "\n// the selftest's copy: one comment more, so its bytes are not the worktree's\n");
  const deaf = path.join(tmp, "deaf-harness.js");
  fs.writeFileSync(deaf, "delete process.env.KOLOB_BASE; delete process.env.KOLOB_DIR;\nrequire(" + JSON.stringify(engine.harness) + ");\n");
  const eCopy = R.resolveEngine(copy);
  const ok = await R.renderSet({ engine: eCopy, seeds: [1847], secs: 60, dir: path.join(tmp, "w-ok"), quiet: true }).then((x) => x.manifest, (e) => e);
  check("a copy rendered by a listening harness: accepted, its own fingerprint", ok && ok.fingerprint && ok.fingerprint === eCopy.fingerprint && ok.fingerprint !== engine.fingerprint, ok && ok.fingerprint ? ok.fingerprint + " (worktree " + engine.fingerprint + ")" : String(ok && ok.message));
  const refused = await R.renderSet({ engine: R.resolveEngine(copy, deaf), seeds: [1847], secs: 60, dir: path.join(tmp, "w-deaf"), quiet: true }).then(() => null, (e) => e);
  check("the same copy rendered by a harness that plays its own directory: refused", !!(refused && refused.refusal && /did not play the build/.test(refused.message)), refused ? refused.message.split("\n")[1] : "it was accepted ✗");

  console.log("6. the count (seed 3, 1200 s)");
  const long = await R.renderSet({ engine, seeds: [3], secs: 1200, dir: path.join(tmp, "long"), quiet: true });
  const L3 = D.readDump(long.results[0].dump);
  const done = L3.meetings.filter((m) => m.complete);
  const recs = done.map((m) => Tally.recordOf(L3, m));
  check("every section closes on one joint", done.length > 0 && recs.every((r, i) => r.joints === done[i].sections.length), recs.map((r, i) => r.joints + "/" + done[i].sections.length).join(", ") + " joints/sections");
  const stills = L3.events.filter((e) => e.kind === "joint-still").length, marked = L3.events.filter((e) => e.stillJoint).length;
  check("`the room empties` marks the joint it tells of", stills > 0 && stills === marked, stills + " told, " + marked + " marked");
  const M = Tally.metricsFor(recs);
  check("the harness's start-up line (transport) is not a metric", !M.some((m) => /transport/.test(m.id)) && M.some((m) => /per meeting: section/.test(m.id)));

  console.log("7. the capture's tap");
  {
    const rate = 48000, N = 16384, T0 = 2.5, fA = Math.round(T0 * rate), fB = fA + 75 * rate, blocks = [];
    let f = fA - 1000, k = 0, holeK = -1;
    while (f < fB + N) {
      // the ramp read a sample or two off; the block after the hole read 2 short (126, as a real capture had it)
      blocks.push({ f: f + (k === holeK ? -2 : [0, 2, -1][k % 3]), d: new Float32Array(2 * N).fill(0.1) });
      f += N; k++;
      if (holeK < 0 && f > fA + 40.9 * rate) { f += 128; holeK = k; }                     // one render quantum never reached the tap
    }
    const Lc = new Float32Array(fB - fA), Rc = new Float32Array(fB - fA);
    const r = Cap.assemble(blocks.filter((b2) => b2.f + N > fA && b2.f < fB), fA, fB, rate, Lc, Rc);
    const q = r.gaps[0] || {};
    check("one hole, read as 126 and sized to its 128, at 0:40.9", r.gaps.length === 1 && q.n === 128 && q.raw === 126 && Math.abs(q.f / rate - T0 - 40.93) < 0.05, r.gaps.map((x) => Cap.mmss(x.f / rate - T0, 3) + " " + x.n + " (read " + x.raw + ")").join(", "));
    const T = 10;
    const legacyEnd = Cap.meetingEnd([["E", T + 800, { cat: "cadence", label: "∴ joint", detail: "meeting ends · 9s", t: T + 800 }]], T);
    const typedEnd = Cap.meetingEnd([["E", T + 700, { type: "meeting-end", n: 1, dur: 5, t: T + 700 }]], T);
    const nextEnd = Cap.meetingEnd([["E", T, { type: "meeting-start", n: 1, t: T }], ["E", T + 900, { type: "meeting-start", n: 2, t: T + 900 }]], T);
    check("--meeting finds the end: v0.30 joint, typed meeting-end, or the next meeting", legacyEnd === 815 && typedEnd === 711 && nextEnd === 900, legacyEnd + " / " + typedEnd + " / " + nextEnd + " s");
    check("the rest laid contiguous, and the coverage exact", r.jitter > 0 && r.covered === fB - fA - 128 && Lc.filter((x) => x === 0).length === 128, r.jitter + " block starts read off by 1–2 samples; " + (fB - fA - r.covered) + " samples lost");
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? "SELFTEST: " + fails + " FAILED" : "SELFTEST: all passed ✓");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("selftest.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

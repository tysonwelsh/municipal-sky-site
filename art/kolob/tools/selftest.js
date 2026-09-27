#!/usr/bin/env node
// KOLOB tools — selftest.js: do the instruments still read true? (seconds, no browser)
//
//   node tools/selftest.js
//
// 1. A real dump from this worktree's harness reads as meetings and sections.
// 2. A synthetic dump in the SCORE.md §6 typed vocabulary reads the same way —
//    meetings, sections, cadences, guests, parts, and the distinctness hooks
//    (sunday, dialect, cast) light up — and a typed event echoed by a v0.30
//    log line counts once. This is what keeps the tools working when the
//    engine crew moves the engine to typed events.
// 3. The same seed rendered twice is distance 0; two seeds are not.
// 4. The loudness meter reads the BS.1770 reference tones.
"use strict";
const fs = require("fs");
const path = require("path");
const D = require("./lib/dump.js");
const R = require("./lib/run.js");
const A = require("./lib/audio.js");
const Dist = require("./distinctness.js");
const Tally = require("./tally.js");
const Rep = require("./repetition.js");

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
  check("header read", run.header.format === "kolob-dump" && run.seed === 1847 && run.secs === 200, JSON.stringify(run.header));
  check("meeting 1 found with mode, kind and keynote", run.meetings.length >= 1 && !!run.meetings[0].mode && !!run.meetings[0].meetingKind && run.meetings[0].keynoteHz > 100,
    run.meetings[0].mode + " · " + run.meetings[0].meetingKind + " · " + (run.meetings[0].keynoteHz || 0).toFixed(1) + " Hz");
  check("sections in order from 0 s", run.meetings[0].sections.length >= 2 && run.meetings[0].sections[0].t0 === 0, run.meetings[0].sections.map((s) => s.section + "@" + s.t0.toFixed(0)).join(" "));
  check("voices found", D.voiceLines(run.notes).size >= 3, [...D.voiceLines(run.notes).keys()].join(", "));

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
  lines.push(["E", 60.02, { cat: "section", label: "§ INVOCATION", detail: "50s", t: 60.02 }]);     // the v0.30 echo
  lines.push(["E", 70, { type: "cadence", kind: "plagal", t: 70 }]);
  lines.push(["E", 70.01, { cat: "harmony", label: "∴ plagal cadence", detail: "amen", t: 70.01 }]); // echo
  lines.push(["E", 100, { type: "guest-end", guest: "trombones", t: 100 }]);
  lines.push(["E", 110, { type: "meeting-start", n: 2, sunday: "ordinary", kind: "ordinary", mode: "dorian", keynoteHz: 240, t: 110 }]);
  lines.push(["E", 125, { type: "meeting-end", n: 2, dur: 3, t: 125 }]);
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

  console.log("4. loudness (BS.1770-4)");
  const sr = 48000, n = sr * 10, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = 0.1 * Math.sin(2 * Math.PI * 1000 * i / sr);
  const st = A.loudness([L, L], sr).integrated, mono = A.loudness([L, new Float32Array(n)], sr).integrated;
  check("1 kHz at −20 dBFS, both channels → −20.0 LUFS", Math.abs(st + 20) < 0.05, st.toFixed(2));
  check("… one channel → −23.0 LUFS", Math.abs(mono + 23) < 0.05, mono.toFixed(2));
  const c = A.kCoefs(48000);
  check("K-weighting at 48 kHz = the spec's coefficients", Math.abs(c[0].b[0] - 1.53512485958697) < 1e-9 && Math.abs(c[1].a[0] + 1.99004745483398) < 1e-9);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? "SELFTEST: " + fails + " FAILED" : "SELFTEST: all passed ✓");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("selftest.js: " + (e.stack || e.message)); process.exit(1); });

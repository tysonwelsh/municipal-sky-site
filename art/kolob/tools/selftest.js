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
// 8. The harness's modes: a scripted STOP and restart (stop=, play=) is told
//    by the transport events at its times and calls a meeting of its own, and
//    the clock's accounting names the timers left armed apart from the
//    sources scheduled past the end; an injected throw (throw=) fires once,
//    is reported by the clock and kept out of the run's errors, and the cues
//    it counts lane by lane add up to the clock's own — with the drone's
//    later cues told.
// 9. Recovery (PLAN-REFACTOR §2.1): a layer's turn that throws is re-armed by
//    the core's net 5 s later and its lane plays on (throw=drone@120); a
//    conductor's tick that throws is re-armed at its own pace and the dump is
//    the clean run's, record for record (throw=conductor@300); a hymn whose
//    chain of cues breaks is let go, and the meeting begins its next section
//    (throw=choir@212.5); the ward's and the organist's pumps, made to throw
//    at their re-arm in one run, tick on at their own pace and the dump and
//    the graph are the clean run's (throw=ward@200,organist@200).
// 10. A stillness ends at STOP (PLAN-REFACTOR §2.2): seed 7 stopped a second
//    into its first stillness's hold and played half a second later
//    (stop=626.1 play=626.6) calls a meeting that is not hushed at its
//    downbeat, and it plays as the meeting called after a stop outside the
//    stillness does (stop=600 play=600.5), record for record from its
//    downbeat; and a reseed while stopped lets the old visit's drone go —
//    seed 1 stopped with its drone on the invocation's third and reseeded to
//    7 (stop=90 reseed=7@90 play=90.5): the drone's note is the keynote's
//    after the reseed, and seed 7's first meeting is the fresh run's, record
//    for record from its downbeat.
// 11. STOP's own race (PLAN-REFACTOR §2.3): a transport press cancels the
//    timer the press before it armed. Seed 7, stop=120 play=120.3 stop=120.5:
//    the first STOP's 800 ms timer is cleared by the PLAY, and the second's
//    fires at its own 800 ms; with play=121 after, that PLAY clears the
//    second's, no press's timer fires after a later press, and the meeting it
//    calls plays as the one called when the second STOP and the PLAY fall
//    together (stop=121 play=121), record for record. Seed 22, whose second
//    meeting's drone enters 0.11 s after its downbeat: the second STOP's
//    doors are disconnected by its own timer, after its whole fade (the
//    first STOP's timer did it 0.3 s into the fade). And the hymnal's desk,
//    paced (desk=0.5), writes nothing while the transport stands stopped:
//    stopped at 0.7 s, the stopped meeting's orders stay unwritten; played
//    again at 1 s, the next meeting's are written and those passed over; a
//    GATHER of the same seed between writes them for the meeting it calls
//    again, which is the fresh run's record for record; and the pacing moves
//    no record.
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

  // §9's renders — the faults of PLAN-REFACTOR §2.1 and the clean run beside
  // them, each the shortest that shows its recovery (the two pumps' in one
  // run, at the clean run's length, to be held against it) — are begun here,
  // beside §6's long meeting, and read when §9 comes
  const recovery = Promise.all([[null, 360], ["throw=drone@120", 145], ["throw=conductor@300", 360], ["throw=choir@212.5", 360], ["throw=ward@200,organist@200", 360]]
    .map(([flag, secs], i) => R.renderSet({ engine, seeds: [7], secs, flags: flag ? [flag] : [], dir: path.join(tmp, "recover-" + i), quiet: true }).then((x) => x.results[0])));
  // …and §10's (PLAN-REFACTOR §2.2): a stop inside seed 7's first stillness
  // and one outside it, each played again at once, to 133 s past the next
  // downbeat; seed 1 stopped with its drone off home and reseeded to 7; and
  // seed 7 fresh, to as far past its downbeat
  const stillness = Promise.all([[7, 760, ["stop=626.1", "play=626.6"]], [7, 734, ["stop=600", "play=600.5"]], [1, 200, ["stop=90", "reseed=7@90", "play=90.5"]], [7, 110, []]]
    .map(([seed, secs, flags], i) => R.renderSet({ engine, seeds: [seed], secs, flags, dir: path.join(tmp, "still-" + i), quiet: true }).then((x) => x.results[0])));
  // …and §11's (PLAN-REFACTOR §2.3): the stop/play/stop scripts on seeds 7
  // and 22, and the paced desk stopped, played again, and gathered again
  const race = Promise.all([
    [7, 130, ["stop=120", "play=120.3", "stop=120.5"]], [7, 230, ["stop=120", "play=120.3", "stop=120.5", "play=121"]], [7, 230, ["stop=120", "play=120.3", "stop=121", "play=121"]],
    [22, 130, ["stop=120", "play=120.3", "stop=120.5"]],
    [7, 60, ["desk=0.5", "stop=0.7"]], [7, 110, ["desk=0.5", "stop=0.7", "play=1"]], [7, 110, ["desk=0.5", "stop=0.7", "reseed=7@0.7", "play=1"]], [7, 110, ["desk=0.5"]], [7, 110, []],
  ].map(([seed, secs, flags], i) => R.renderSet({ engine, seeds: [seed], secs, flags, dir: path.join(tmp, "race-" + i), quiet: true }).then((x) => x.results[0])));
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

  console.log("8. the harness's modes (seed 7): a scripted stop and restart, an injected throw");
  {
    const sp = (await R.renderSet({ engine, seeds: [7], secs: 90, flags: ["stop=40", "play=41"], dir: path.join(tmp, "script"), quiet: true })).results[0];
    const recs = fs.readFileSync(sp.dump, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r[0] === "E");
    const told = recs.filter((r) => r[2].type === "transport").map((r) => r[2].action + "@" + r[1]).join(" ");
    check("stop=40 play=41: the transport events fall at the scripted times", told === "play@0 stop@40 play@41", told);
    const m2 = recs.find((r) => r[2].type === "meeting-start" && r[2].n === 2);
    check("… and the restart calls a meeting of its own, the run clean", !!m2 && m2[1] > 41 && m2[1] < 42 && /PASS/.test(sp.verdict || ""), (m2 ? "meeting 2 at " + m2[1].toFixed(1) + " s" : "no meeting 2") + " · " + sp.verdict);
    const clock = (/^clock: .*$/m.exec(fs.readFileSync(sp.log, "utf8")) || [""])[0];
    const acct = / (\d+) timer\(s\) still armed after STOP.* (\d+) source\(s\) scheduled past the run's end/.exec(clock);
    check("the clock's accounting: timers left armed apart from sources scheduled past the end", !!acct, acct ? acct[1] + " timer(s) · " + acct[2] + " source(s)" : clock || "no clock line");

    const th = (await R.renderSet({ engine, seeds: [7], secs: 200, flags: ["throw=drone@60"], dir: path.join(tmp, "throw"), quiet: true })).results[0];
    const log = fs.readFileSync(th.log, "utf8");
    const j = /^throw drone@60: thrown at ([\d.]+) s, [^;]*; reported by (\S+) · the drone lane ran (\d+) cue\(s\) after it[^(]*\((\d+) before\)/m.exec(log);
    check("throw=drone@60: thrown once, from 60 s on, reported by the clock, and not counted among the run's errors",
      !!j && +j[1] >= 60 && j[2] === "console.error" && /^errors: 0 caught · 0 console\.error$/m.test(log) && /PASS/.test(th.verdict || ""),
      j ? "at " + j[1] + " s · " + th.verdict : "no throw line");
    const lanes = /^cues by lane: (\d+) (\{.*\}) · the clock counted (\d+)$/m.exec(log);
    const drone = lanes ? JSON.parse(lanes[2]).drone : null;
    check("… the cues counted lane by lane add up to the clock's own, and the drone's to before + the throw + after",
      !!lanes && !!j && lanes[1] === lanes[3] && drone === +j[4] + 1 + +j[3],
      lanes && j ? lanes[1] + " = " + lanes[3] + " cues; drone " + drone + " = " + j[4] + " + 1 + " + j[3] + " — the drone runs " + j[3] + " cue(s) after its throw (the core's net re-arms it: §9)" : "no count");
  }

  console.log("9. recovery (seed 7): a turn, the conductor's tick, a hymn's chain and the two pumps, each made to throw");
  {
    const runs = await recovery;
    const thrown = (r, spec) => {          // the run's throw line (the one for spec, where the run has two)
      const log = fs.readFileSync(r.log, "utf8");
      const re = /^throw (\S+): thrown at ([\d.]+) s, [^;]*; reported by (\S+) · the \S+ lane ran (\d+) cue\(s\) after it(?:, the first at ([\d.]+) s)? \((\d+) before\) · the meeting began (\d+) section\(s\) after it$/gm;
      let m;
      while ((m = re.exec(log)) && spec && m[1] !== spec);
      return m ? { spec: m[1], t: +m[2], by: m[3], after: +m[4], first: m[5] != null ? +m[5] : null, sections: +m[7], clean: /^errors: 0 caught · 0 console\.error$/m.test(log) && /PASS/.test(r.verdict || "") } : null;
    };
    const records = (r) => fs.readFileSync(r.dump, "utf8").split("\n").filter((l) => l && !l.startsWith('["H"'));
    const said = (x) => x ? "thrown at " + x.t.toFixed(3) + " s · " + x.after + " cue(s) after it" + (x.first != null ? ", the first at " + x.first.toFixed(3) + " s" : "") + " · " + x.sections + " section(s) after it" : "no throw line";
    const dr = thrown(runs[1]), co = thrown(runs[2]), ch = thrown(runs[3]);
    check("throw=drone@120: the drone's turn throws once and its lane plays on, re-armed 5 s after the throw, the run clean",
      !!dr && dr.by === "console.error" && dr.after > 0 && Math.abs(dr.first - dr.t - 5) < 0.001 && dr.clean, said(dr));
    const same = !!co && records(runs[2]).join("\n") === records(runs[0]).join("\n");
    check("throw=conductor@300: the tick throws once, the next is armed 0.6 s on, the meeting begins its next section — the clean run's, record for record",
      !!co && co.after > 0 && Math.abs(co.first - co.t - 0.6) < 0.001 && co.sections > 0 && same && co.clean, said(co) + (same ? " · " + records(runs[0]).length + " records, identical to the clean run's" : " · NOT the clean run's"));
    const sec = (r) => records(r).map((l) => JSON.parse(l)).filter((x) => x[0] === "E" && x[2].type === "section-start").map((x) => x[2].section + "@" + x[1].toFixed(1));
    check("throw=choir@212.5: the hymn's chain breaks, the hymn is let go, and the meeting begins its next section",
      !!ch && ch.sections > 0 && ch.clean, said(ch) + " · sections " + sec(runs[3]).join(" ") + " (clean: " + sec(runs[0]).join(" ") + ")");
    // the two pumps, thrown in one run: a ward that hands no line builds no
    // voice (the graph shows it; its notes are told apart from its sound), an
    // organist who lays no note tells none (the dump shows it)
    const graph = (r) => (/^graph: .*$/m.exec(fs.readFileSync(r.log, "utf8")) || [""])[0];
    const pumpsDump = records(runs[4]).join("\n") === records(runs[0]).join("\n"), pumpsGraph = graph(runs[4]) !== "" && graph(runs[4]) === graph(runs[0]);
    [["ward", 0.12], ["organist", 0.2]].forEach(([lane, pace]) => {
      const x = thrown(runs[4], lane + "@200");
      check("throw=" + lane + "@200: the " + lane + "'s pump throws at its re-arm and the next tick is armed " + pace + " s on, its own pace",
        !!x && x.after > 0 && Math.abs(x.first - x.t - pace) < 0.001 && x.clean, said(x));
    });
    check("… and with both pumps thrown, the dump and the graph are the clean run's",
      pumpsDump && pumpsGraph, (pumpsDump ? "the dump" : "NOT the dump") + " and " + (pumpsGraph ? "the graph" : "NOT the graph") + " of the clean run (" + (graph(runs[0]).split(" · ")[1] || "?").split(" {")[0] + ")");
  }

  // (§10 and §11) the records of len s from one run's downbeat, held against
  // another's from its own: a number is the same if it is equal, or equal
  // once each run's downbeat is taken off (a time); with `counts`, the chord book's
  // own numbers (a chord's id wherever it is named, and the page a chord
  // event names), which count on for the page's life and not the visit's,
  // may each stand off by one constant, and only one
  // → { n, len, at: -1 } or the first record that differs
  const sameFrom = (A, tA, B, tB, len, counts) => {
    const win = (rs, t0) => rs.filter((x) => x[1] >= t0 && x[1] < t0 + len);
    const a = win(A, tA), b = win(B, tB), off = {};
    const counter = (key, parent) => counts && (key === "chord" || (key === "page" && parent.type === "chord"));
    const eq = (x, y, key, parent) => {
      if (typeof x === "number" && typeof y === "number") {
        if (counter(key, parent)) { if (!(key in off)) off[key] = x - y; return x - y === off[key]; }
        return Math.abs(x - y) < 1e-6 || Math.abs((x - tA) - (y - tB)) < 1e-6;
      }
      if (!x || !y || typeof x !== "object" || typeof y !== "object") return x === y;
      const keys = new Set(Object.keys(x).concat(Object.keys(y)));
      for (const k of keys) if (!eq(x[k], y[k], k, x)) return false;
      return true;
    };
    for (let i = 0; i < Math.max(a.length, b.length); i++) if (!eq(a[i], b[i], null, null)) return { n: a.length, len, at: i, a: a[i], b: b[i], off };
    return { n: a.length, len, at: -1, off };
  };
  const told = (d) => (d.at < 0 ? d.n + " records over " + d.len + " s, the same" : "record " + d.at + " of " + d.n + " differs: " + JSON.stringify(d.a || null).slice(0, 140) + " against " + JSON.stringify(d.b || null).slice(0, 140)) +
    (Object.keys(d.off).length ? " (" + Object.keys(d.off).map((k) => "the " + k + "s numbered on by " + d.off[k]).join(", ") + ")" : "");
  console.log("10. a stillness ends at STOP, and a reseed lets the old visit's drone go (PLAN-REFACTOR §2.2)");
  {
    const [inHold, outside, reseeded, fresh] = await stillness;
    const log = (r) => fs.readFileSync(r.log, "utf8");
    const recs = (r) => fs.readFileSync(r.dump, "utf8").split("\n").filter((l) => l && !l.startsWith('["H"')).map((l) => JSON.parse(l));
    const downbeat = (rs, after) => { const m = rs.find((x) => x[0] === "E" && x[2].type === "meeting-start" && x[1] > after); return m ? m[1] : null; };
    const H = recs(inHold), still = H.find((x) => x[0] === "E" && x[2].type === "stillness");
    const t2 = downbeat(H, 626.1), holdEnd = still ? still[1] + still[2].holdS + 2.5 : null;
    check("seed 7's first stillness holds past the next downbeat of stop=626.1 play=626.6",
      !!still && still[1] < 626.1 && t2 != null && holdEnd > t2, still ? "the " + still[2].why + "'s at " + still[1].toFixed(1) + " s, held to " + (holdEnd || 0).toFixed(1) + " s; meeting 2 at " + (t2 || 0).toFixed(1) + " s" : "no stillness");
    const m2 = (/ · #2 at [\d.]+ s: [^#\n]*/.exec(log(inHold)) || [""])[0];
    check("… and meeting 2 is not hushed at its downbeat (the stopped meeting's hold ended with it)", !!m2 && !/hushed at its downbeat/.test(m2) && /PASS/.test(inHold.verdict || ""), m2.trim() || "no meeting 2");
    const O = recs(outside), d2 = sameFrom(H, t2, O, downbeat(O, 600), 130);
    check("… and it plays as meeting 2 does after a stop outside the stillness (stop=600 play=600.5), record for record from its downbeat", d2.at < 0, told(d2));
    const rs = (/^reseed 7 at 90 s \(stopped\): the drone's note (.*) → (.*)$/m.exec(log(reseeded)) || []);
    check("stop=90 reseed=7@90 play=90.5 on seed 1: its drone stood off home, and the reseed lets it go",
      !!rs[1] && rs[1] !== "×1 tonic" && rs[2] === "×1 tonic" && /PASS/.test(reseeded.verdict || ""), rs[0] ? rs[1] + " → " + rs[2] : "no reseed line");
    const Rr = recs(reseeded), F = recs(fresh), d7 = sameFrom(Rr, downbeat(Rr, 90), F, downbeat(F, 0), 105, true);
    check("… and seed 7's first meeting is the fresh run's, record for record from its downbeat", d7.at < 0, told(d7));
  }

  console.log("11. STOP's own race: a press cancels the timer the press before it armed (PLAN-REFACTOR §2.3)");
  {
    const [one, two, together, s22, stopped, played, gathered, paced, fresh] = await race;
    const log = (r) => fs.readFileSync(r.log, "utf8");
    const recs = (r) => fs.readFileSync(r.dump, "utf8").split("\n").filter((l) => l && !l.startsWith('["H"')).map((l) => JSON.parse(l));
    // the presses' line: { cleared, after (fired after a later press), lines (what each timer did) }
    const presses = (r) => {
      const L = log(r), m = /^presses: .* (\d+) cleared \((\d+) by a later press\), (\d+) fired \((\d+) after a later press\)/m.exec(L);
      return m ? { byLater: +m[2], after: +m[4], lines: L.split("\n").filter((l) => /^ {2}\S.*'s [\d.]+ ms timer/.test(l)).map((l) => l.trim()) } : null;
    };
    const has = (p, re) => !!p && p.lines.some((l) => re.test(l));
    const p1 = presses(one), p2 = presses(two), p22 = presses(s22);
    check("seed 7, stop=120 play=120.3 stop=120.5: the PLAY clears the first STOP's timer, the second STOP's fires at its own 800 ms, and none fires after a later press",
      !!p1 && has(p1, /^stop@120's 800 ms timer cleared by play@120\.3 /) && has(p1, /^stop@120\.5's 800 ms timer fired at 121\.300 s:/) && p1.after === 0 && /PASS/.test(one.verdict || ""),
      p1 ? p1.lines.filter((l) => /^stop@120(\.5)?'s/.test(l)).join("; ") : "no presses line");
    check("… and with play=121 after, that PLAY clears the second STOP's timer, and no press's timer fires after a later press",
      !!p2 && p2.byLater === 2 && has(p2, /^stop@120\.5's 800 ms timer cleared by play@121 /) && p2.after === 0 && /PASS/.test(two.verdict || ""),
      p2 ? p2.byLater + " cleared by a later press, " + p2.after + " fired after one" : "no presses line");
    const meeting3 = (rs) => { const m = rs.find((x) => x[0] === "E" && x[2].type === "meeting-start" && x[2].n === 3); return m ? m[1] : null; };
    const A = recs(two), B = recs(together), d3 = sameFrom(A, meeting3(A), B, meeting3(B), 105, true);
    check("… and the meeting play=121 calls plays as the one called when the second STOP and the PLAY fall together (stop=121 play=121), record for record",
      meeting3(A) != null && d3.at < 0, "meeting 3 at " + meeting3(A) + " s: " + told(d3) + ", " + A.filter((x) => x[0] === "N" && x[1] >= meeting3(A) && x[1] < meeting3(A) + 105).length + " notes");
    const own = p22 && p22.lines.map((l) => /^stop@120\.5's 800 ms timer fired at 121\.300 s: (\d+) node\(s\) disconnected/.exec(l)).find(Boolean);
    check("seed 22, the same script: the second STOP's doors (its meeting's drone, in 0.11 s after the downbeat) are disconnected by its own timer, after its whole fade",
      !!own && +own[1] > 0 && p22.after === 0 && has(p22, /^stop@120's 800 ms timer cleared by play@120\.3 /), own ? own[0] : "no such line");
    // the desk: written while stopped, and the orders never written
    const desk = (r) => { const m = /^hymnal: .* posted (\d+) · composed (\d+) .* · written while stopped (\d+) · (\d+) order\(s\) never written · desk 0\.5 s a slice, (\d+) slice\(s\) paced/m.exec(log(r)); return m ? { posted: +m[1], composed: +m[2], whileStopped: +m[3], unwritten: +m[4], paced: +m[5] } : null; };
    const said = (h) => h ? "posted " + h.posted + ", written " + h.composed + ", while stopped " + h.whileStopped + ", never " + h.unwritten : "no hymnal line";
    const hs = desk(stopped), hp = desk(played), hg = desk(gathered);
    check("desk=0.5 stop=0.7 (seed 7): the desk writes nothing while stopped, and the stopped meeting's orders stay unwritten",
      !!hs && hs.whileStopped === 0 && hs.unwritten > 0 && hs.paced > 0 && /PASS/.test(stopped.verdict || ""), said(hs));
    check("… played again at 1 s: nothing written while stopped, the next meeting's orders written, the stopped meeting's passed over",
      !!hp && !!hs && hp.whileStopped === 0 && hp.unwritten === hs.unwritten && hp.composed === hp.posted - hp.unwritten && /PASS/.test(played.verdict || ""), said(hp));
    const G = recs(gathered), F = recs(fresh), first = (rs, after) => { const m = rs.find((x) => x[0] === "E" && x[2].type === "meeting-start" && x[1] > after); return m ? m[1] : null; };
    const dg = sameFrom(G, first(G, 0.7), F, first(F, 0), 105, true);
    check("… a GATHER of the same seed between (reseed=7@0.7): the orders are found by key and written for the meeting called again, the fresh run's record for record",
      !!hg && !!hs && hg.whileStopped === 0 && hg.unwritten === 0 && hg.posted === hs.posted && dg.at < 0, said(hg) + " · " + told(dg));
    const same = recs(paced).map((x) => JSON.stringify(x)).join("\n") === F.map((x) => JSON.stringify(x)).join("\n");
    check("… and the pacing moves no record (desk=0.5 against the plain run, 110 s)", same, same ? F.length + " records, identical" : "NOT identical");
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? "SELFTEST: " + fails + " FAILED" : "SELFTEST: all passed ✓");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("selftest.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

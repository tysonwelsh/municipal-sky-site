// KOLOB tools — the dump reader.
//
// The one place that knows the harness's dump format (`node _harness.js <secs>
// <seed> dump=<file>`, JSON lines; README "The dump format") and the engine's
// event vocabulary, so every tool in this folder reads meetings, sections,
// cadences, guests and voices the same way. When the engine changes what it
// says, this file learns the new words and the tools above it do not move.
//
// Two vocabularies are understood side by side:
//   · the v0.30 log events  {cat, label, detail, t}  — read by their words;
//   · the SCORE.md §6 typed events  {type, t, …payload} — read by their fields.
// Whatever neither knows is still counted, by its `cat` or `type`.
// Since round 2's milestone 3 the engine sends ONE event carrying both
// (type and payload, and the legacy cat/label/detail on the same object),
// and types many happenings §6's first table does not name (joint, guest,
// chord, field, hymns-of-the-day…). An event is read by its type where this
// file knows the type, and by its words otherwise — so a joint, a guest's
// stage and the day's material are still read on a typed engine (the
// integration found them all falling to "other"). Its `cat` stays the log's
// word where it has one, so an A/B against a log-only build counts the same
// categories on both sides.
"use strict";
const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
function readDump(file) {
  const text = fs.readFileSync(file, "utf8");
  let header = null, lastT = 0, bad = 0, raw = 0;
  const notes = [], events = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch (e) { bad++; continue; }
    if (!Array.isArray(rec) || rec.length < 3) { bad++; continue; }
    const k = rec[0], at = rec[1], p = rec[2] || {};
    if (k === "H") { header = p; continue; }
    raw++;
    if (typeof at === "number" && at > lastT) lastT = at;
    if (k === "N") notes.push(normNote(p, at, notes.length));
    else if (k === "E") events.push(normEvent(p, at, events.length));
    // any other record kind is someone's later addition: skipped, not fatal
  }
  // Events arrive in emission order; a few are emitted ahead of their time
  // (scheduleRaw), so order by time, keeping emission order within a tie.
  events.sort((a, b) => a.t - b.t || a.i - b.i);
  notes.sort((a, b) => a.t - b.t || a.i - b.i);
  // a joint told as going into stillness: mark the joint that follows
  events.forEach((e, k) => {
    if (e.kind !== "joint-still") return;
    const j = events.slice(k + 1, k + 6).find((x) => x.kind === "joint" && x.t - e.t < 1);
    if (j) j.stillJoint = true;
  });
  const run = { file, name: path.basename(file).replace(/\.jsonl$/, ""), header: header || {}, notes, events: dedupe(events), bad, records: raw };
  run.seed = seedOf(run);
  run.secs = typeof run.header.secs === "number" ? run.header.secs : lastT;
  run.flags = run.header.flags || [];
  run.meetings = meetingsOf(run);
  return run;
}

function seedOf(run) {
  if (run.header && run.header.seed != null) return run.header.seed;
  const tr = run.events.find((e) => e.kind === "transport" && e.seed != null);
  if (tr) return tr.seed;
  const m = /(\d+)/.exec(run.name);
  return m ? +m[1] : null;
}

function normNote(p, at, i) {
  return {
    i,
    t: typeof p.startTime === "number" ? p.startTime : at,
    dur: +p.duration || 0,
    layer: p.layer || "?",
    freq: +p.freq || 0,
    part: p.part != null ? String(p.part) : null,
    emitT: at,
    hymnId: p.hymnId != null ? p.hymnId : null,
    member: p.memberId != null ? p.memberId : p.member != null ? p.member : null,
    registration: p.registration != null ? p.registration : null,
    raw: p,
  };
}

// ---------------------------------------------------------------------------
// Events → one normalised shape: {t, cat, kind, …}
//   kind: meeting | mode-change | section | cadence | joint | joint-still | guest | guest-plan
//         | material | hymn | line | lining | fuging | stillness | field
//         | telegraph | transport | cast | vision | other
// ---------------------------------------------------------------------------
function normEvent(p, at, i) {
  const e = { i, t: typeof p.t === "number" ? p.t : at, cat: p.cat || p.type || "?", label: p.label || "", detail: p.detail || "", raw: p };
  if (p.type) typedEvent(e, p);
  if (!e.kind && p.cat) legacyEvent(e, p);              // a type this file does not know, told in words too
  if (!e.kind) e.kind = "other";
  // hooks any event may carry, in either vocabulary (dialect, registration)
  if (typeof p.dialect === "string") e.dialect = p.dialect;
  if (p.hymn && typeof p.hymn.dialect === "string") e.dialect = p.hymn.dialect;
  if (typeof p.houseDialect === "string") e.houseDialect = p.houseDialect;
  if (p.registration != null) e.registration = p.registration;
  return e;
}

function typedEvent(e, p) {
  switch (p.type) {
    case "meeting-start":
      e.kind = "meeting"; e.n = p.n; e.mode = p.mode; e.meetingKind = p.kind || null;
      e.sunday = p.sunday || null; e.keynoteHz = +p.keynoteHz || null; break;
    case "meeting-end":          // not in SCORE §6 yet (requested by r2-tools): lets a typed engine close its last meeting
      e.kind = "joint"; e.meetingEnd = true; e.jointDur = typeof p.dur === "number" ? p.dur : 0; break;
    case "section-start":
      e.kind = "section"; e.section = String(p.section || "?").toLowerCase();
      e.plannedDur = typeof p.dur === "number" ? p.dur : null; break;
    case "hymn-announced":
      e.kind = "hymn"; e.hymnId = p.hymn ? p.hymn.id : null; e.meter = p.hymn ? p.hymn.meter : null; break;
    case "verse-start":
      e.kind = "verse"; e.hymnId = p.hymnId; e.practice = p.practice || null; break;
    case "cadence":
      e.kind = "cadence"; e.cadence = p.kind || "?"; break;
    case "guest-start": case "guest-end":
      e.kind = "guest"; e.guest = p.guest || "?"; e.phase = p.type === "guest-start" ? "start" : "end";
      e.logged = p.logged !== false; break;
    case "question-asking": e.kind = "guest"; e.guest = "question"; e.phase = "mark"; break;
    case "question-unanswered": e.kind = "guest"; e.guest = "question"; e.phase = "end"; break;
    case "cast": e.kind = "cast"; e.member = p.memberId; e.action = p.action || null; break;
    case "vision": e.kind = "vision"; e.vision = p.name; break;
    case "telegraph": e.kind = "telegraph"; e.word = p.word; break;
    case "registration": e.kind = "registration"; e.registration = p.name || p.stops || p.registration; break;
    default: e.kind = null;                               // (normEvent reads its words, if it has any)
  }
}

// The v0.30 log, read by its words (the glyphs are decoration and may change).
const GUEST_WORDS = [
  [/the question$/, "question", "start"], [/unanswered/, "question", "end"],
  [/band approaches/, "bands", "start"], [/passes on/, "bands", "end"], [/bands cross/, "bands", "mark"],
  [/steeples answer/, "steeples", "start"], [/last bell/, "steeples", "end"],
  [/old tune remembered/, "oldtune", "start"], [/memory gives out/, "oldtune", "mark"],
  [/trombones at dawn/, "trombones", "start"], [/near choir answers/, "trombones", "mark"], [/two choirs together/, "trombones", "mark"],
  [/raspberry/, "raspberry", "start"], [/amen—/, "raspberry", "mark"],
  [/tune is withheld/, "cumulative", "start"], [/whole tune, at last/, "cumulative", "mark"],
];
function legacyEvent(e, p) {
  const L = e.label, D = e.detail;
  let m;
  switch (p.cat) {
    case "meeting":
      m = /F0 ([\d.]+) Hz · (\w+) · (\w*)/.exec(D);
      if (/meeting \d+/.test(L)) {
        e.kind = "meeting"; e.n = +(/meeting (\d+)/.exec(L)[1]);
        if (m) { e.f0 = +m[1]; e.keynoteHz = +m[1] * 4; e.mode = m[2]; e.meetingKind = m[3] || null; }
      } else if (/sunrise/.test(L)) { e.kind = "mode-change"; if (m) e.mode = m[2]; }
      else e.kind = "other";
      break;
    case "section":
      e.kind = "section"; e.section = L.replace(/^[^A-Za-z]*/, "").trim().toLowerCase();
      m = /(\d+)s$/.exec(D); e.plannedDur = m ? +m[1] : null;
      if (/ · /.test(D) && e.section === "hymn") e.meter = D.split(" · ")[0];
      break;
    case "harmony":
      m = /(\w+) cadence/.exec(L);
      if (m) { e.kind = "cadence"; e.cadence = m[1]; } else e.kind = "chord";
      break;
    case "cadence":
      // `∴ the room empties` is not a joint of its own: it says how the joint
      // that follows it goes (into stillness, around the sacrament), and the
      // `∴ joint` line is still told after it. It marks that joint `still`.
      if (/empties/.test(L)) { e.kind = "joint-still"; break; }
      e.kind = "joint"; e.meetingEnd = /meeting ends/.test(D);
      m = /(\d+)s$/.exec(D); e.jointDur = m ? +m[1] : 0;
      break;
    case "visitation":
      e.kind = "guest"; e.guest = "other"; e.phase = "start";
      for (const [re, g, ph] of GUEST_WORDS) if (re.test(L)) { e.guest = g; e.phase = ph; break; }
      if (e.guest === "other") e.guest = "other:" + L.replace(/^[^A-Za-z]*/, "").trim();
      break;
    case "visitation-draw":
      e.kind = "guest-plan"; e.plan = L.split(",").filter(Boolean).map((s) => { const q = s.split("@"); return { guest: q[0], section: q[1] }; });
      break;
    case "motif":
      if (/day's hymns/.test(L)) {
        e.kind = "material";
        const parts = D.split(" · ");
        e.temper = ((parts.find((x) => /^temper:/.test(x)) || "").split(":")[1] || "").trim() || null;
        e.material = parts.filter((x) => !/^temper:/.test(x)).map((x) => x.replace(/^[ⅠⅡⅢⅣⅤ]+\s*/, "").trim()).filter(Boolean);
      } else e.kind = "motif";
      break;
    case "verse": e.kind = /lines out/.test(L) ? "lining" : "line"; break;
    case "fuging": e.kind = "fuging"; break;
    case "conductor": e.kind = /still small/.test(L) ? "stillness" : /skipped/.test(L) ? "skip" : "other"; break;
    case "ambient": e.kind = "field"; e.field = L.replace(/^[^A-Za-z]*/, "").trim(); break;
    case "telegraph": e.kind = "telegraph"; e.word = D; break;
    case "transport":
      e.kind = "transport"; m = /seed (\d+)/.exec(D); if (m) e.seed = +m[1];
      break;
    case "liahona": e.kind = "liahona"; break;
    default: e.kind = "other";
  }
}

// While the engine migrates (SCORE §6: "existing emitEvent calls stay until
// the UI moves over"), one happening may be told twice — a log line and a
// typed event. Keep the first, fill its gaps from the second, drop the echo.
const ECHO = {
  meeting: { tol: 0.5, key: (e) => "m" },
  section: { tol: 0.1, key: (e) => e.section },
  cadence: { tol: 0.1, key: (e) => e.cadence },
  guest: { tol: 1.0, key: (e) => e.guest + "/" + e.phase },
  hymn: { tol: 0.5, key: (e) => String(e.hymnId) },
};
function dedupe(events) {
  const out = [], last = {};
  for (const e of events) {
    const rule = ECHO[e.kind];
    if (rule) {
      const k = e.kind + ":" + rule.key(e), prev = last[k];
      const typed = (x) => !!(x.raw && x.raw.type);
      if (prev && e.t - prev.t <= rule.tol && typed(prev) !== typed(e)) {
        for (const f in e) if (prev[f] == null) prev[f] = e[f];
        continue;
      }
      last[k] = e;
    }
    out.push(e);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Meetings and sections
// ---------------------------------------------------------------------------
// A meeting runs from its start to the next one's; the last is complete only
// if the log says it ended ("meeting ends") inside the run.
function meetingsOf(run) {
  const starts = run.events.filter((e) => e.kind === "meeting");
  const out = [];
  const list = starts.length ? starts : [{ t: 0, n: 1, mode: null, meetingKind: null, keynoteHz: null, synthetic: true }];
  list.forEach((s, k) => {
    const next = list[k + 1];
    let t1 = next ? next.t : null, complete = !!next;
    if (!next) {
      const end = run.events.find((e) => e.kind === "joint" && e.meetingEnd && e.t >= s.t);
      if (end) { t1 = Math.min(run.secs, end.t + (end.jointDur || 0)); complete = end.t + (end.jointDur || 0) <= run.secs + 1e-6; }
      else t1 = run.secs;
    }
    const inM = (x) => x.t >= s.t - 1e-9 && (next ? x.t < t1 - 1e-9 : x.t <= t1 + 1e-9);
    const events = run.events.filter(inM);
    const notes = run.notes.filter(inM);
    const m = {
      n: s.n || k + 1, t0: s.t, t1, dur: t1 - s.t, complete,
      mode: s.mode || null, meetingKind: s.meetingKind || null, sunday: s.sunday || null,
      keynoteHz: s.keynoteHz || null, houseDialect: s.houseDialect || null,
      events, notes,
    };
    m.sections = sectionsOf(m);
    out.push(m);
  });
  return out;
}

function sectionsOf(m) {
  const secs = m.events.filter((e) => e.kind === "section");
  return secs.map((e, k) => {
    const t1 = k + 1 < secs.length ? secs[k + 1].t : m.t1;
    return { section: e.section, t0: e.t, t1, dur: t1 - e.t, plannedDur: e.plannedDur, meter: e.meter || null, closed: k + 1 < secs.length || m.complete };
  });
}

// ---------------------------------------------------------------------------
// Voices and phrases
// ---------------------------------------------------------------------------
// One line per voice: the layer, or layer:part when the engine marks parts.
// A chordal layer without parts (v0.30's choir prints all four voices at one
// onset) is read by its top line — the tune, in every dialect that keeps the
// tune on top. Unpitched notes (freq 0: bells, voice, wind, telegraph) and
// any layer in `skip` are left out.
function voiceLines(notes, skip) {
  const groups = new Map();
  for (const n of notes) {
    if (!(n.freq > 20)) continue;
    if (skip && skip.has(n.layer)) continue;
    const k = n.part != null ? n.layer + ":" + n.part : n.layer;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  const out = new Map();
  for (const [k, arr] of groups) {
    arr.sort((a, b) => a.t - b.t || b.freq - a.freq);
    const line = [];
    let clustered = 0;
    for (let i = 0; i < arr.length;) {
      let j = i + 1, top = arr[i];
      while (j < arr.length && arr[j].t - arr[i].t < 0.03) { if (arr[j].freq > top.freq) top = arr[j]; j++; }
      if (j - i > 1) clustered++;
      line.push(top);
      i = j;
    }
    const name = clustered > 0.3 * line.length && !k.includes(":") ? k + " (top)" : k;
    out.set(name, line);
  }
  return out;
}

// Phrases: a new phrase after a breath (silence longer than gapS between one
// note's end and the next onset), or when a phrase reaches maxLen notes.
function phrasesOf(line, opts) {
  const gapS = (opts && opts.gapS) || 0.35, maxLen = (opts && opts.maxLen) || 12;
  const out = [];
  let cur = [];
  for (let i = 0; i < line.length; i++) {
    const n = line[i];
    if (cur.length) {
      const p = cur[cur.length - 1];
      if (n.t - (p.t + p.dur) > gapS || cur.length >= maxLen) { out.push(cur); cur = []; }
    }
    cur.push(n);
  }
  if (cur.length) out.push(cur);
  return out;
}

// ---------------------------------------------------------------------------
// Pitch helpers
// ---------------------------------------------------------------------------
function cents(f, ref) { return 1200 * Math.log2(f / ref); }
const SOLF = ["do", "ra", "re", "me", "mi", "fa", "fi", "sol", "le", "la", "te", "ti"];
function pcOf(f, keynoteHz) { return ((Math.round(cents(f, keynoteHz) / 100) % 12) + 12) % 12; }
function solf(f, keynoteHz) { return keynoteHz ? SOLF[pcOf(f, keynoteHz)] : "?"; }

// The keynote a note should be read against: the meeting it sounds in.
function keynoteAt(run, t) {
  let k = null;
  for (const m of run.meetings) if (m.t0 <= t + 1e-9) k = m.keynoteHz;
  return k || (run.meetings[0] && run.meetings[0].keynoteHz) || null;
}

// ---------------------------------------------------------------------------
// Dump sets (a directory of *.jsonl, as render.js writes them)
// ---------------------------------------------------------------------------
function listDumps(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => path.join(dir, f))
    .sort((a, b) => {
      const na = +(/(\d+)\.jsonl$/.exec(a) || [0, 0])[1], nb = +(/(\d+)\.jsonl$/.exec(b) || [0, 0])[1];
      return na - nb || a.localeCompare(b);
    });
}
function readManifest(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")); } catch (e) { return null; }
}

module.exports = {
  readDump, normEvent, normNote, meetingsOf, sectionsOf, voiceLines, phrasesOf,
  cents, pcOf, solf, keynoteAt, SOLF, listDumps, readManifest,
};

#!/usr/bin/env node
// KOLOB tools — distinctness.js: design law 2, measured.
//
//   "Two random seeds must sound clearly different within three minutes."
//                                   (PLAN-COMPOSITION §0 law 2, §2.6, §12)
//
// Renders the first three minutes of N seeds through the harness, describes
// each seed by what a listener could notice in that window (its keynote,
// mode and kind of Sunday; its pulse, density, pitch and rhythm profiles,
// register and texture; the guests, the field and the day's material),
// standardises every feature across the seeds, and measures how far apart
// each pair is. It lists the near-twins, and the features that separate
// seeds least.
//
// Distances are standardised by this build's own spread, so a yardstick is
// needed that the build cannot move: the planted twin, the first seed heard
// a semitone higher and 4 % slower — one Sunday in another key. A pair as
// close as that (or a little closer than 1.5× it) is a twin whatever the
// median says, and a build whose median pair is within three plants of
// itself has collapsed: its seeds are one meeting, transposed.
//
//   node tools/distinctness.js [--n 20 | --seeds 1-20] [--window 180]
//        [--engine <dir>|git:<ref>] [--dumps <dir>] [--twin 0.5]
//        [--plant-floor 1.5] [--collapse 3] [--out <dir>]
//
// Output: report.md, distances.csv, features.json in the out directory.
"use strict";
const fs = require("fs");
const path = require("path");
const U = require("./lib/util.js");
const D = require("./lib/dump.js");
const R = require("./lib/run.js");

const HELP = `distinctness.js — how far apart are the first minutes of N seeds?
  --n 20 | --seeds 1-20 | 1847,5,9   seeds (default 1..20)
  --window 180         seconds from the start of the meeting (default 180)
  --engine <dir>|git:<ref>   build to render (default: this worktree)
  --harness <file>     harness to render with
  --dumps <dir>        read an existing dump set instead of rendering
  --twin 0.5           near-twin threshold, as a fraction of the median pair distance
  --plant-floor 1.5    …or at most this many times the planted twin's distance, whatever the median
  --collapse 3         the build has collapsed when the median pair is within this many plants
  --no-sanity          skip the same-seed-twice render and the sanity line
  --out <dir>          (default tools/out/distinctness-<stamp>)`;

// Layers that are ground or field, not voices: they count toward density and
// silence but are not read as melody, pulse or pitch profile.
const NOT_MELODIC = new Set(["drone", "ambient"]);

// ---------------------------------------------------------------------------
// Features — each {group, type, value, jnd}. type: num | cat | set | vec.
// jnd: the smallest difference taken as audible (num: in the value's units;
// vec: Jensen–Shannon distance; set: Jaccard distance; cat: any mismatch).
// A value of null means "not measured for this seed" (a voice not heard, a
// hook the engine does not emit yet); the feature then sits out that pair.
// ---------------------------------------------------------------------------
const GROUPS = {
  identity: { w: 3, note: "keynote, mode, kind of Sunday" },
  style: { w: 2, note: "dialect, organ registration (hooks: typed events)" },
  cast: { w: 1.5, note: "who is heard (hook: typed cast events / note.memberId)" },
  tempo: { w: 2, note: "median inter-onset interval per voice" },
  density: { w: 1.5, note: "notes per minute per layer" },
  pitch: { w: 2, note: "pitch-class and melodic-interval profiles" },
  rhythm: { w: 1, note: "inter-onset-interval profile" },
  register: { w: 1, note: "median pitch and span of the voices" },
  texture: { w: 1, note: "silence share, polyphony, layers heard" },
  guests: { w: 1, note: "guests begun in the window" },
  field: { w: 0.5, note: "field events (wind, crickets, fork…)" },
  material: { w: 1.5, note: "the day's gestures / hymns announced" },
  form: { w: 1, note: "prelude length, sections entered" },
};
const JND = {
  keynote: 0.05, pulse: 0.1, density: 0.25, profile: 0.12, register: 0.15, span: 0.2,
  silence: 0.08, polyphony: 0.3, layers: 1, prelude: 15, sections: 1, set: 0.5,
};

function iois(line) {
  const out = [];
  for (let i = 1; i < line.length; i++) { const d = line[i].t - line[i - 1].t; if (d > 0.02 && d <= 4) out.push(d); }
  return out;
}
function hist(values, bins, weights) {
  const h = new Array(bins.n).fill(0);
  values.forEach((v, i) => { const b = bins.of(v); if (b >= 0 && b < bins.n) h[b] += weights ? weights[i] : 1; });
  const s = U.sum(h);
  return s > 0 ? h.map((x) => x / s) : null;
}

function featuresOf(run, W) {
  const m1 = run.meetings[0] || {};
  const key = m1.keynoteHz || null;
  const notes = run.notes.filter((n) => n.t < W);
  const events = run.events.filter((e) => e.t < W);
  const F = {};
  const put = (name, group, type, value, jnd) => { F[name] = { group, type, value, jnd }; };

  // identity
  put("keynote", "identity", "num", key ? Math.log2(key) : null, JND.keynote);
  put("mode", "identity", "cat", m1.mode || null);
  put("kind", "identity", "cat", m1.meetingKind || null);
  put("sunday", "identity", "cat", m1.sunday || null);            // (typed meeting-start)
  // dialect, registration, cast — null when the dump carries none (a
  // registration rides on notes and payloads; no event is typed so)
  const dialects = new Set();
  if (m1.houseDialect) dialects.add(m1.houseDialect);
  events.forEach((e) => { if (e.dialect) dialects.add(e.dialect); if (e.houseDialect) dialects.add(e.houseDialect); });
  put("dialect", "style", "set", dialects.size ? [...dialects] : null);
  const regs = new Set();
  events.forEach((e) => { if (e.registration != null) [].concat(e.registration).forEach((r) => regs.add(String(r))); });
  notes.forEach((n) => { if (n.registration != null) [].concat(n.registration).forEach((r) => regs.add(String(r))); });
  put("registration", "style", "set", regs.size ? [...regs] : null);
  const cast = new Set();
  events.forEach((e) => { if (e.kind === "cast" && e.member != null) cast.add(String(e.member)); });
  notes.forEach((n) => { if (n.member != null) cast.add(String(n.member)); });
  put("cast", "cast", "set", cast.size ? [...cast] : null);

  // voices: tempo (pulse) per voice, pooled pulse, rhythm and interval profiles
  const lines = D.voiceLines(notes, NOT_MELODIC);
  const allIoi = [], allIv = [];
  for (const [name, line] of lines) {
    const io = iois(line);
    if (io.length >= 3) put("pulse: " + name, "tempo", "num", Math.log2(U.median(io)), JND.pulse);
    io.forEach((x) => allIoi.push(x));
    D.phrasesOf(line).forEach((ph) => {
      for (let i = 1; i < ph.length; i++) allIv.push(Math.round(D.cents(ph[i].freq, ph[i - 1].freq) / 100));
    });
  }
  put("pulse: all voices", "tempo", "num", allIoi.length >= 3 ? Math.log2(U.median(allIoi)) : null, JND.pulse);
  put("rhythm profile", "rhythm", "vec",
    hist(allIoi, { n: 13, of: (x) => Math.max(0, Math.min(12, Math.round(2 * Math.log2(x) + 6))) }), JND.profile);
  put("interval profile", "pitch", "vec",
    hist(allIv, { n: 25, of: (x) => Math.max(-12, Math.min(12, x)) + 12 }), JND.profile);

  // density: notes per minute per layer (every layer, pitched or not)
  const perLayer = {};
  notes.forEach((n) => (perLayer[n.layer] = (perLayer[n.layer] || 0) + 1));
  F.__layers = perLayer;           // expanded to the union of layers below
  // pitch-class profile against the keynote, duration-weighted
  const voiced = notes.filter((n) => n.freq > 20 && !NOT_MELODIC.has(n.layer));
  put("pitch-class profile", "pitch", "vec",
    key ? hist(voiced.map((n) => D.pcOf(n.freq, key)), { n: 12, of: (x) => x }, voiced.map((n) => Math.min(n.dur, W - n.t))) : null, JND.profile);
  // register: duration-weighted median pitch and p10–p90 span, in octaves
  const reg = [];
  voiced.forEach((n) => { const w = Math.max(1, Math.round(Math.min(n.dur, 8) * 4)); for (let k = 0; k < w; k++) reg.push(Math.log2(n.freq)); });
  put("register", "register", "num", reg.length ? U.median(reg) : null, JND.register);
  put("register span", "register", "num", reg.length ? U.quantile(reg, 0.9) - U.quantile(reg, 0.1) : null, JND.span);

  // texture: silence (nothing but ground and field), polyphony, layers heard
  const step = 0.25, slots = Math.ceil(W / step), sounding = new Array(slots).fill(0);
  notes.forEach((n) => {
    if (NOT_MELODIC.has(n.layer)) return;
    const a = Math.max(0, Math.floor(n.t / step)), b = Math.min(slots, Math.ceil((n.t + Math.max(n.dur, 0.1)) / step));
    for (let k = a; k < b; k++) sounding[k]++;
  });
  put("silence share", "texture", "num", sounding.filter((x) => x === 0).length / slots, JND.silence);
  put("polyphony", "texture", "num", U.mean(sounding), JND.polyphony);
  put("layers heard", "texture", "num", Object.keys(perLayer).length, JND.layers);

  // guests, field, material
  const guests = new Set(events.filter((e) => e.kind === "guest" && e.phase === "start").map((e) => e.guest));
  put("guests", "guests", "set", [...guests]);
  put("field", "field", "set", [...new Set(events.filter((e) => e.kind === "field").map((e) => e.field))]);
  const mat = events.find((e) => e.kind === "material");
  const hymns = events.filter((e) => e.kind === "hymn" && e.hymnId != null).map((e) => String(e.hymnId));
  put("material", "material", "set", mat ? mat.material : hymns.length ? hymns : null);

  // form: when the prelude gives way, and how many sections the window holds
  const secs = events.filter((e) => e.kind === "section");
  put("prelude length", "form", "num", secs.length > 1 ? Math.min(W, secs[1].t - secs[0].t) : W, JND.prelude);
  put("sections entered", "form", "num", secs.length, JND.sections);
  return F;
}

// Expand per-layer densities to the union of layers (absent → 0 notes).
function expandDensity(feats, W) {
  const layers = new Set();
  feats.forEach((F) => Object.keys(F.__layers).forEach((l) => layers.add(l)));
  feats.forEach((F) => {
    [...layers].sort().forEach((l) => { F["density: " + l] = { group: "density", type: "num", value: Math.log1p((F.__layers[l] || 0) * 60 / W), jnd: JND.density, absentIsZero: true }; });
    delete F.__layers;
  });
}

// ---------------------------------------------------------------------------
// Distances
// ---------------------------------------------------------------------------
function jsDist(p, q) {
  let d = 0;
  for (let i = 0; i < p.length; i++) {
    const m = (p[i] + q[i]) / 2;
    if (p[i] > 0) d += 0.5 * p[i] * Math.log2(p[i] / m);
    if (q[i] > 0) d += 0.5 * q[i] * Math.log2(q[i] / m);
  }
  return Math.sqrt(Math.max(0, d));
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size && !B.size) return 0;
  let inter = 0; A.forEach((x) => { if (B.has(x)) inter++; });
  return 1 - inter / (A.size + B.size - inter);
}
function rawDist(f, a, b) {
  if (a == null || b == null) return null;
  // a layer neither seed sounds says nothing about how they differ
  if (f.absentIsZero && a === 0 && b === 0) return null;
  switch (f.type) {
    case "num": return Math.abs(a - b);
    case "cat": return a === b ? 0 : 1;
    case "set": return jaccard(a, b);
    case "vec": return jsDist(a, b);
  }
  return null;
}
// Per-feature scale from the real seeds: num → SD, vec → the SD a normal
// would need for its mean pair distance. Floored at the JND, so a spread no
// ear could hear never counts as separation.
function scales(feats, names) {
  const sc = {};
  names.forEach((nm) => {
    const f0 = feats.find((F) => F[nm]) [nm];
    if (f0.type === "num") {
      const v = feats.map((F) => F[nm] && F[nm].value).filter((x) => x != null);
      sc[nm] = Math.max(U.sd(v), f0.jnd || 0) || 1;
    } else if (f0.type === "vec") {
      const ds = [];
      for (let i = 0; i < feats.length; i++) for (let j = i + 1; j < feats.length; j++) {
        const r = rawDist(f0, feats[i][nm] && feats[i][nm].value, feats[j][nm] && feats[j][nm].value);
        if (r != null) ds.push(r);
      }
      sc[nm] = Math.max((U.mean(ds) || 0) / 1.128, f0.jnd || 0) || 1;
    } else sc[nm] = 1;
  });
  return sc;
}
function stdDist(f, r, scale) {
  if (r == null) return null;
  return f.type === "num" || f.type === "vec" ? Math.min(1, r / (2 * scale)) : r;
}
function separated(f, r) {
  if (r == null) return null;
  if (f.type === "cat") return r > 0;
  if (f.type === "set") return r >= JND.set;
  return r >= f.jnd;
}
function pair(FA, FB, names, sc) {
  const byGroup = {}, detail = {};
  names.forEach((nm) => {
    const fa = FA[nm], fb = FB[nm];
    if (!fa || !fb) return;
    const r = rawDist(fa, fa.value, fb.value);
    const s = stdDist(fa, r, sc[nm]);
    if (s == null) return;
    (byGroup[fa.group] = byGroup[fa.group] || []).push(s);
    detail[nm] = { r, s, sep: separated(fa, r) };
  });
  let num = 0, den = 0;
  const groups = {};
  Object.keys(byGroup).forEach((g) => { const d = U.mean(byGroup[g]); groups[g] = d; num += GROUPS[g].w * d; den += GROUPS[g].w; });
  return { D: den ? num / den : 0, groups, detail };
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------
const NOTE = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
function noteName(hz) {
  if (!hz) return "—";
  const midi = 69 + 12 * Math.log2(hz / 440), r = Math.round(midi), c = Math.round((midi - r) * 100);
  return NOTE[((r % 12) + 12) % 12] + (Math.floor(r / 12) - 1) + (c ? (c > 0 ? "+" : "−") + Math.abs(c) + "¢" : "");
}
// What the seeds' values span, in the feature's own units.
function rangeOf(nm, fs) {
  const f0 = fs.find(Boolean);
  const vals = fs.map((f) => f && f.value).filter((v) => v != null);
  if (!f0 || !vals.length) return "—";
  if (f0.type === "cat") {
    const c = {}; vals.forEach((v) => (c[v] = (c[v] || 0) + 1));
    return Object.keys(c).sort((x, y) => c[y] - c[x]).slice(0, 3).map((k) => k + " " + c[k]).join(", ") + (Object.keys(c).length > 3 ? ", …" : "");
  }
  if (f0.type === "set") {
    const empty = vals.filter((v) => !v.length).length, c = {};
    vals.forEach((v) => v.forEach((x) => (c[x] = (c[x] || 0) + 1)));
    const top = Object.keys(c).sort((x, y) => c[y] - c[x])[0];
    return (empty ? "none in " + empty + "/" + vals.length : "") + (top ? (empty ? "; " : "") + "commonest: " + top + " " + c[top] + "/" + vals.length : "");
  }
  if (f0.type === "vec") return "(profile)";
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (nm === "keynote" || nm === "register") return noteName(Math.pow(2, lo)) + " – " + noteName(Math.pow(2, hi)) + " (" + ((hi - lo) * 12).toFixed(1) + " semitones)";
  if (nm === "register span") return (lo * 12).toFixed(0) + "–" + (hi * 12).toFixed(0) + " semitones";
  if (nm.startsWith("pulse")) return Math.pow(2, lo).toFixed(2) + "–" + Math.pow(2, hi).toFixed(2) + " s";
  if (nm.startsWith("density")) { const z = vals.filter((v) => v === 0).length; return Math.expm1(lo).toFixed(1) + "–" + Math.expm1(hi).toFixed(1) + " /min" + (z ? " (absent in " + z + ")" : ""); }
  if (nm === "silence share") return U.pct(lo) + "–" + U.pct(hi);
  if (nm === "prelude length") return Math.round(lo) + "–" + Math.round(hi) + " s";
  return +lo.toFixed(2) + "–" + +hi.toFixed(2);
}
function showVal(f) {
  if (!f || f.value == null) return "—";
  const v = f.value;
  if (f.type === "set") return v.length ? v.join(", ") : "none";
  if (f.type === "vec") return "(profile)";
  return typeof v === "number" ? +v.toFixed(3) : String(v);
}

// ---------------------------------------------------------------------------
async function main() {
  const a = U.parseArgs(process.argv.slice(2), ["help", "no-sanity"]);
  if (a.help) { console.log(HELP); return; }
  const W = +a.window || 180;
  const seeds = a.seeds ? U.parseSeeds(a.seeds, []) : U.parseSeeds("1-" + (+a.n || 20), []);
  const twinFrac = +a.twin || 0.5, plantFloor = +a["plant-floor"] || 1.5, collapseX = +a.collapse || 3;
  const sanity = !a["no-sanity"];
  const out = U.outDir(a, "distinctness");

  // Render (or read). The self-test renders the first seed a second time
  // under another name: the same seed twice must be distance 0.
  const extra = sanity && !a.dumps ? [{ seed: seeds[0], name: "twin-" + seeds[0] }] : [];
  const set = await R.obtainSet({ dumps: a.dumps, engine: a.engine, harness: a.harness, seeds, secs: Math.ceil(W) + 5, into: path.join(out, "dumps"), extra, jobs: +a.jobs || 0 });
  const runs = set.files.map((f) => D.readDump(f));
  const real = runs.filter((r) => !/^twin-/.test(r.name));
  const twin = runs.find((r) => /^twin-/.test(r.name));
  if (real.length < 3) throw new Error("need at least 3 seeds");

  // The planted twin: seed 1's meeting heard a semitone higher and 4 % slower —
  // the same Sunday in another key. A tool that cannot flag this cannot flag
  // anything; and it is the yardstick for what "the same" means in this build.
  let plant = null;
  {
    const base = real[0], k = Math.pow(2, 1 / 12), s = 1.04;
    plant = JSON.parse(JSON.stringify({ name: "plant-" + base.seed, seed: base.seed, secs: base.secs, notes: base.notes, events: base.events.map((e) => Object.assign({}, e, { raw: null })) }));
    plant.notes.forEach((n) => { n.freq *= k; n.t *= s; n.dur *= s; });
    plant.events.forEach((e) => { e.t *= s; if (e.keynoteHz) e.keynoteHz *= k; });
    plant.meetings = D.meetingsOf(plant);
  }

  const all = real.concat(twin ? [twin] : []).concat(plant ? [plant] : []);
  const feats = all.map((r) => featuresOf(r, W));
  expandDensity(feats, W);
  const names = [...new Set(feats.flatMap((F) => Object.keys(F)))].sort();
  const realFeats = feats.slice(0, real.length);
  const sc = scales(realFeats, names);

  // pairwise over the real seeds
  const P = [];
  for (let i = 0; i < real.length; i++) for (let j = i + 1; j < real.length; j++) {
    P.push(Object.assign({ i, j }, pair(realFeats[i], realFeats[j], names, sc)));
  }
  const Ds = P.map((p) => p.D);
  const med = U.median(Ds), tau = twinFrac * med;
  // the plant's distance, the yardstick the build cannot move
  const pf = feats[feats.length - 1];
  const plantD = pair(pf, realFeats[0], names, sc).D;
  const plantRank = Ds.filter((d) => d < plantD).length;
  const tauAbs = plantFloor * plantD;
  const isTwin = (d) => d < tau || d <= tauAbs;
  const twins = P.filter((p) => isTwin(p.D)).sort((x, y) => x.D - y.D);
  const spread = plantD > 0 ? med / plantD : Infinity;
  const collapsed = spread <= collapseX;
  const nearest = real.map((r, i) => {
    let best = null;
    P.forEach((p) => { if (p.i === i || p.j === i) { if (!best || p.D < best.D) best = p; } });
    return { i, best, other: best.i === i ? best.j : best.i };
  });

  // sanity numbers
  let twinD = null;
  if (twin) twinD = pair(feats[real.length], realFeats[0], names, sc).D;
  const minDistinct = Math.min(...Ds);

  // features that separate least / groups that separate most
  const featStats = names.map((nm) => {
    const f0 = realFeats.find((F) => F[nm])[nm];
    let n = 0, notSep = 0, sSum = 0;
    P.forEach((p) => { const d = p.detail[nm]; if (!d) return; n++; if (!d.sep) notSep++; sSum += d.s; });
    const present = realFeats.filter((F) => F[nm] && F[nm].value != null).length;
    return { nm, group: f0.group, type: f0.type, n, notSep: n ? notSep / n : null, meanS: n ? sSum / n : null, present };
  });
  const hooks = featStats.filter((f) => f.present === 0).map((f) => f.nm);
  const least = featStats.filter((f) => f.n > 0).sort((x, y) => y.notSep - x.notSep || x.meanS - y.meanS);
  const groupStats = Object.keys(GROUPS).map((g) => {
    const vals = P.map((p) => p.groups[g]).filter((x) => x != null);
    return { g, n: vals.length, mean: vals.length ? U.mean(vals) : null, share: null };
  });
  const gTot = U.sum(groupStats.filter((x) => x.mean != null).map((x) => GROUPS[x.g].w * x.mean));
  groupStats.forEach((x) => { if (x.mean != null) x.share = GROUPS[x.g].w * x.mean / gTot; });

  // ---- what two seeds share / where they differ, in words ----
  function words(p) {
    const same = [], diff = [];
    Object.keys(p.detail).forEach((nm) => {
      const d = p.detail[nm];
      if (nm.startsWith("density: ") && realFeats[p.i][nm].value === 0 && realFeats[p.j][nm].value === 0) return;
      (d.sep ? diff : same).push(nm);
    });
    return { same, diff };
  }
  const label = (i) => "seed " + real[i].seed;

  // ---- report ----
  const L = [];
  L.push("# Distinctness — the first " + W + " s of " + real.length + " seeds");
  L.push("");
  L.push("*Design law 2 (PLAN-COMPOSITION §0, §2.6, §12): \"Two random seeds must sound clearly different within three minutes.\"*");
  L.push("");
  L.push("- " + R.describe(set.manifest));
  L.push("- seeds " + real.map((r) => r.seed).join(", ") + " · " + P.length + " pairs · window 0–" + W + " s of the first meeting · " + new Date().toISOString().slice(0, 16).replace("T", " "));
  L.push("");
  L.push("## Verdict");
  L.push("");
  L.push("- **Pair distance D** (0 = the same in every measured respect, 1 = two standard deviations apart on everything): median **" + U.fmt(med, 3) + "**, p10 " + U.fmt(U.quantile(Ds, 0.1), 3) + ", p90 " + U.fmt(U.quantile(Ds, 0.9), 3) + ", closest " + U.fmt(minDistinct, 3) + ".");
  L.push("- **Spread:** the median pair is **" + (isFinite(spread) ? spread.toFixed(1) + "×" : "∞ ×") + "** as far apart as seed " + real[0].seed + " is from itself a semitone higher and 4 % slower (the planted twin, D = " + U.fmt(plantD, 3) + ")" +
    (collapsed ? ". **⚠ COLLAPSED** — at " + collapseX + "× or less, the typical pair of seeds is barely farther apart than one meeting heard in another key: design law 2 fails for this build, whatever the near-twin count says." : " (collapse at " + collapseX + "× or less)."));
  const twinList = twins.slice(0, 12).map((p) => label(p.i) + " / " + label(p.j) + " (" + U.fmt(p.D, 3) + ")").join("; ") + (twins.length > 12 ? "; and " + (twins.length - 12) + " more" : "");
  L.push("- **Near-twins** (D < " + twinFrac + " × median = " + U.fmt(tau, 3) + ", or D ≤ " + plantFloor + " × the planted twin = " + U.fmt(tauAbs, 3) + "): " +
    (twins.length ? "**" + twins.length + " of " + P.length + " pairs** — " + twinList : "**none**") + ".");
  if (sanity) {
    L.push("- **Sanity:** " + [
      twin ? "the same seed rendered twice (seed " + real[0].seed + ") D = " + U.fmt(twinD, 3) + (twinD === 0 ? " ✓" : " ✗ (should be 0)") : null,
      "the planted twin is seen (D > 0" + (plantD > 0 ? " ✓" : " ✗") + ") and is closer than the median's twin line (" + U.fmt(plantD, 3) + " < " + U.fmt(tau, 3) + (plantD < tau ? " ✓" : " ✗") + "); " + plantRank + " of " + P.length + " real pairs are closer than it",
      "every pair of different seeds D > 0" + (minDistinct > 0 ? " ✓" : " ✗"),
    ].filter(Boolean).join("; ") + ".");
  }
  L.push("- **Separates least:** " + least.slice(0, 4).map((f) => f.nm + " (" + U.pct(f.notSep) + " of pairs not separated)").join(", ") + ".");
  L.push("- **Separates most:** " + groupStats.filter((x) => x.share != null).sort((x, y) => y.share - x.share).slice(0, 4).map((x) => x.g + " (" + U.pct(x.share) + " of all distance)").join(", ") + ".");
  if (hooks.length) L.push("- **Hooks not yet fed by the engine:** " + hooks.join(", ") + " (typed events per SCORE §6; they join the distance as soon as a dump carries them).");
  L.push("");

  L.push("## The closest pairs");
  L.push("");
  L.push(U.table(["pair", "D", "twin?", "the same (within an audible step)", "different"],
    P.slice().sort((x, y) => x.D - y.D).slice(0, 8).map((p) => {
      const w = words(p);
      return [label(p.i) + " / " + label(p.j), U.fmt(p.D, 3), isTwin(p.D) ? "**twin**" : "",
        w.same.filter((n) => !/^density: |^pulse: /.test(n)).join(", ") || "—",
        w.diff.filter((n) => !/^density: |^pulse: /.test(n)).join(", ") || "—"];
    }), ["l", "r", "c", "l", "l"]));
  L.push("");
  L.push("(Per-layer density and pulse features are left out of the two word columns for length; they are in the distance.)");
  L.push("");

  L.push("## Each seed and its nearest neighbour");
  L.push("");
  L.push(U.table(["seed", "keynote", "mode", "kind", "pulse (s)", "notes/min", "silence", "guests", "material", "prelude", "nearest", "D"],
    nearest.map(({ i, best, other }) => {
      const F = realFeats[i], r = real[i];
      const nm = r.notes.filter((n) => n.t < W).length * 60 / W;
      return ["**" + r.seed + "**", noteName((r.meetings[0] || {}).keynoteHz), showVal(F.mode), showVal(F.kind),
        F["pulse: all voices"].value == null ? "—" : Math.pow(2, F["pulse: all voices"].value).toFixed(2),
        nm.toFixed(0), U.pct(F["silence share"].value), showVal(F.guests), showVal(F.material),
        Math.round(F["prelude length"].value) + " s", real[other].seed, U.fmt(best.D, 3)];
    })));
  L.push("");

  L.push("## What separates seeds least");
  L.push("");
  L.push("A pair is *not separated* on a feature when the two seeds differ by less than an audible step (the JND column; for a set, when they share at least half of it; for a category, when it is the same).");
  L.push("");
  L.push(U.table(["feature", "group", "pairs not separated", "mean std. distance", "JND", "across the seeds"],
    least.slice(0, 16).map((f) => {
      const f0 = realFeats.find((F) => F[f.nm])[f.nm];
      return [f.nm, f.group, U.pct(f.notSep) + " of " + f.n, U.fmt(f.meanS, 3), f0.type === "cat" ? "any change" : f0.type === "set" ? "Jaccard " + JND.set : String(f0.jnd), rangeOf(f.nm, realFeats.map((F) => F[f.nm]))];
    }), ["l", "l", "r", "r", "r", "l"]));
  L.push("");

  L.push("## Where the distance comes from");
  L.push("");
  L.push(U.table(["group", "weight", "mean distance", "share of all distance", "what it holds"],
    groupStats.map((x) => [x.g, String(GROUPS[x.g].w), x.mean == null ? "— (not measured)" : U.fmt(x.mean, 3), x.share == null ? "—" : U.pct(x.share), GROUPS[x.g].note]), ["l", "r", "r", "r", "l"]));
  L.push("");

  L.push("## How it is measured");
  L.push("");
  L.push("- Each seed is rendered by the harness for " + (Math.ceil(W) + 5) + " s; only notes with an onset before " + W + " s and events before " + W + " s count. Meeting 1 supplies the keynote, mode and kind.");
  L.push("- Numeric features are standardised by their spread across these seeds (SD, floored at the JND so an inaudible spread never counts); a difference of two spreads or more counts as fully different (1). Profiles use the Jensen–Shannon distance, scaled the same way; sets the Jaccard distance; categories 0 or 1.");
  L.push("- A group's distance is the mean over its features that both seeds have; **D** is the weighted mean over groups (weights in the table above). Voices: " + "one line per layer (or layer:part), a chordal layer read by its top line; drone and field are ground, not voices.");
  L.push("- Near-twin: D below " + twinFrac + " × the median pair distance (the pairs that stand out as close *in this build*), or D at most " + plantFloor + " × the planted twin's (the pairs as close as one meeting is to itself in another key — a floor the build's own spread cannot move). The spread line holds the median against the same yardstick: at " + collapseX + "× or less the build has collapsed, and a relative threshold alone would never say so.");
  L.push("- Files: `distances.csv` (the full matrix), `features.json` (every seed's features), `dumps/` (the harness dumps and logs).");
  L.push("");
  fs.writeFileSync(path.join(out, "report.md"), L.join("\n"));

  // matrix + features
  const hdr = ["seed"].concat(real.map((r) => r.seed));
  const M = real.map((r, i) => [r.seed].concat(real.map((_, j) => {
    if (i === j) return "0";
    const p = P.find((q) => (q.i === i && q.j === j) || (q.i === j && q.j === i));
    return p.D.toFixed(4);
  })));
  fs.writeFileSync(path.join(out, "distances.csv"), [hdr].concat(M).map((r) => r.join(",")).join("\n") + "\n");
  fs.writeFileSync(path.join(out, "features.json"), JSON.stringify(real.map((r, i) => ({ seed: r.seed, features: realFeats[i] })), null, 1));
  console.log(path.join(out, "report.md"));
}

module.exports = { featuresOf, expandDensity, pair, scales, GROUPS, JND };
if (require.main === module) main().catch((e) => { console.error("distinctness.js: " + (e.refusal ? e.message : e.stack || e.message)); process.exit(1); });

#!/usr/bin/env node
// KOLOB tools — capture.js: a seeded meeting, recorded, for the Listener.
//
// Plays a seeded meeting in MUTED headless Chrome (--mute-audio: the speakers
// hear nothing; a tap inside the page hears everything) and records a window
// of it: the signal the engine hands to the output — after the master chain,
// exactly what a listener's speakers would get. Writes
//   capture-<seed>-<from>-<to>.wav   16-bit stereo, the window
//   …-spectrogram.png                spectrogram, loudness curve, voices, sections
//   …-events.jsonl                   the page's own notes and events, in the dump format
//   report.md                        LUFS (integrated, max momentary / short-term, LRA),
//                                    sample and true peak, loudness by minute,
//                                    what happened when, and whether the browser
//                                    played the meeting the harness describes
//
//   node tools/capture.js [--seed 1847 | --seeds 1847,5] [--from 0] [--to 240] [--meeting]
//        [--section hymn] [--ives] [--px-per-s 8] [--port 8113] [--chrome-port 9423] [--out <dir>]
//   node tools/capture.js --wav <file.wav> [--events <file.jsonl>] [--out <dir>]    (re-analyse)
//
// Times are meeting seconds (from the moment the meeting is called); with
// --section, from the moment the meeting was jumped there. Recording is in
// real time: a four-minute window takes four minutes.
"use strict";
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const U = require("./lib/util.js");
const C = require("./lib/chrome.js");
const A = require("./lib/audio.js");
const Dm = require("./lib/dump.js");
const R = require("./lib/run.js");

const HELP = `capture.js — record a seeded meeting (muted), with spectrogram, loudness and peaks
  --seed 1847 | --seeds 1847,5,9   meeting(s) to record, one after another (default 1847)
  --from 0 --to 240      window in meeting seconds (default 0–240)
  --meeting              record until meeting 1 ends (overrides --to; cap --max, default 1500 s)
  --section <type>       jump there first; times then count from the jump
  --ives                 arm the Ives switch
  --px-per-s 8           spectrogram width per second (default 8; 600–2400 px)
  --no-harness-check     skip the comparison with the harness's plan for the seed
  --wav <file> [--events <file.jsonl>]   re-analyse an existing capture instead
  --port 8113 --chrome-port 9423 --out <dir>`;

// ---------------------------------------------------------------------------
// The tap, injected before any page script: every node that connects to an
// output (the AudioDestinationNode, or the MediaStreamDestination the page
// routes through for lock-screen survival) also feeds a ScriptProcessor.
// A third channel carries a ConstantSource ramp whose value IS the audio
// time, so every buffer knows the sample it began at and a dropout shows as
// a gap. (Not an AudioWorklet: adding one moves Chrome's rendering of the
// whole graph onto the worklet thread, which fell behind real time on a
// loaded machine — measured 0.36× — and would have slowed the meeting itself.)
// ---------------------------------------------------------------------------
const TAP = (o) => `(function(){
  try {
    localStorage.setItem("kolobIves", ${o.ives ? '"1"' : '"0"'});
    localStorage.setItem("kolobCumulative", "natural");
  } catch (e) {}
  var N = 16384;
  var T = window.__tap = { blocks: [], sr: 0, win: [0, 1e9], first: null, last: null, err: null, rec: [] };
  var AN = AudioNode.prototype, origConnect = AN.connect;
  function isOut(d) {
    return d && ((window.AudioDestinationNode && d instanceof AudioDestinationNode) ||
      (window.MediaStreamAudioDestinationNode && d instanceof MediaStreamAudioDestinationNode));
  }
  function build(ctx) {
    var inp = ctx.createGain();                       // any source, up-mixed to stereo
    inp.channelCount = 2; inp.channelCountMode = "explicit"; inp.channelInterpretation = "speakers";
    var split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(3);
    var clk = ctx.createConstantSource();
    clk.offset.setValueAtTime(0, 0); clk.offset.linearRampToValueAtTime(100000, 100000);
    var sp = ctx.createScriptProcessor(N, 3, 1), z = ctx.createGain(); z.gain.value = 0;
    [inp, split, merge, clk, sp, z].forEach(function (x) { x.__kolobTap = true; });
    origConnect.call(inp, split);
    origConnect.call(split, merge, 0, 0); origConnect.call(split, merge, 1, 1);
    origConnect.call(clk, merge, 0, 2);
    origConnect.call(merge, sp); origConnect.call(sp, z); origConnect.call(z, ctx.destination);
    clk.start();
    var sr = ctx.sampleRate;
    sp.onaudioprocess = function (e) {
      var ib = e.inputBuffer, L = ib.getChannelData(0), R = ib.getChannelData(1), K = ib.getChannelData(2), n = L.length;
      var acc = 0, m = 0;
      for (var i = 0; i < n; i += 256) { acc += K[i] - i / sr; m++; }
      var f = Math.round(acc / m * sr), t = f / sr, dur = n / sr;
      if (T.first == null) T.first = t;
      T.last = t + dur;
      if (!(t + dur >= T.win[0] && t <= T.win[1])) return;
      var d = new Float32Array(2 * n);
      for (var j = 0; j < n; j++) { d[2 * j] = L[j]; d[2 * j + 1] = R[j]; }
      T.blocks.push({ f: f, d: d });
    };
    return inp;
  }
  function register(node) {
    var ctx = node.context;
    if (!ctx.__tapIn) { ctx.__tapIn = build(ctx); T.sr = ctx.sampleRate; }
    origConnect.call(node, ctx.__tapIn);              // again after any disconnect(); a repeat connect is a no-op
  }
  AN.connect = function (d) {
    var r = origConnect.apply(this, arguments);
    try { if (!this.__kolobTap && isOut(d)) register(this); } catch (e) { T.err = String(e); }
    return r;
  };
  function b64(f32) {
    var u8 = new Uint8Array(f32.buffer, f32.byteOffset, f32.byteLength), s = "";
    for (var i = 0; i < u8.length; i += 32768) s += String.fromCharCode.apply(null, u8.subarray(i, i + 32768));
    return btoa(s);
  }
  window.__tapDrain = function () {
    var out = T.blocks.map(function (b) { return { f: b.f, d: b64(b.d) }; });
    T.blocks = [];
    var rec = T.rec; T.rec = [];
    return JSON.stringify({ sr: T.sr, first: T.first, last: T.last, err: T.err, blocks: out, rec: rec,
      now: window.KolobAudio ? window.KolobAudio.getAudioTime() : 0 });
  };
  // the page's notes and events, as the harness dumps them (["N"|"E", audio time, payload])
  var iv = setInterval(function () {
    var K = window.KolobAudio;
    if (K && K.setNoteListener && K.setEventListener) {
      clearInterval(iv);
      K.setNoteListener(function (n) { try { T.rec.push(JSON.stringify(["N", K.getAudioTime(), n])); } catch (e) {} });
      K.setEventListener(function (e) { try { T.rec.push(JSON.stringify(["E", K.getAudioTime(), e])); } catch (e2) {} });
    }
  }, 5);
})();`;

// ---------------------------------------------------------------------------
// The picture, drawn in the (muted) browser's canvas so it can carry type.
// ---------------------------------------------------------------------------
const DRAW = function (P) {
  const W = P.spec.width, HS = P.spec.height, ML = 74, MR = 14, MT = 44, GAP = 10, HL = 120, ROW = 11;
  const layers = P.layers, HR = Math.max(1, layers.length) * ROW + 6, MB = 30;
  const cw = ML + W + MR, ch = MT + HS + GAP + HL + GAP + HR + MB;
  const cv = document.createElement("canvas"); cv.width = cw; cv.height = ch;
  const g = cv.getContext("2d");
  g.fillStyle = "#f4efe3"; g.fillRect(0, 0, cw, ch);
  const inferno = [[0, 0, 0, 4], [0.13, 31, 12, 72], [0.25, 85, 15, 109], [0.38, 136, 34, 106], [0.5, 186, 54, 85], [0.63, 227, 89, 51], [0.75, 249, 140, 10], [0.88, 249, 201, 50], [1, 252, 255, 164]];
  const col = (v) => { for (let i = 1; i < inferno.length; i++) if (v <= inferno[i][0]) { const a = inferno[i - 1], b = inferno[i], f = (v - a[0]) / (b[0] - a[0]); return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3])]; } return inferno[inferno.length - 1].slice(1); };
  const img = g.createImageData(W, HS), raw = atob(P.spec.u8);
  for (let i = 0; i < W * HS; i++) { const c = col(raw.charCodeAt(i) / 255); img.data[4 * i] = c[0]; img.data[4 * i + 1] = c[1]; img.data[4 * i + 2] = c[2]; img.data[4 * i + 3] = 255; }
  g.putImageData(img, ML, MT);
  const X = (t) => ML + (t - P.t0) / (P.t1 - P.t0) * W;
  g.font = "11px Helvetica, Arial, sans-serif"; g.textBaseline = "middle";
  // frequency axis
  g.fillStyle = "#2b3a33"; g.strokeStyle = "rgba(255,255,255,0.18)"; g.textAlign = "right";
  [50, 100, 200, 500, 1000, 2000, 5000, 10000].forEach((f) => {
    if (f < P.spec.fmin || f > P.spec.fmax) return;
    const y = MT + HS * (1 - Math.log(f / P.spec.fmin) / Math.log(P.spec.fmax / P.spec.fmin));
    g.beginPath(); g.moveTo(ML, y + 0.5); g.lineTo(ML + W, y + 0.5); g.stroke();
    g.fillText(f >= 1000 ? f / 1000 + "k" : String(f), ML - 5, y);
  });
  g.save(); g.translate(12, MT + HS / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("Hz", 0, 0); g.restore();
  g.textAlign = "left"; g.fillStyle = "rgba(255,255,255,0.75)"; g.fillText(P.spec.floor.toFixed(0) + " … " + P.spec.top.toFixed(0) + " dB", ML + 6, MT + HS - 10);
  // loudness strip
  const yL0 = MT + HS + GAP, lo = -60, hi = -5, Y = (v) => yL0 + HL * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
  g.fillStyle = "#ebe4d3"; g.fillRect(ML, yL0, W, HL);
  g.strokeStyle = "rgba(43,58,51,0.16)"; g.fillStyle = "#2b3a33"; g.textAlign = "right";
  [-50, -40, -30, -20, -10].forEach((v) => { g.beginPath(); g.moveTo(ML, Y(v) + 0.5); g.lineTo(ML + W, Y(v) + 0.5); g.stroke(); g.fillText(String(v), ML - 5, Y(v)); });
  g.save(); g.translate(12, yL0 + HL / 2); g.rotate(-Math.PI / 2); g.textAlign = "center"; g.fillText("LUFS", 0, 0); g.restore();
  const line = (pts, style, w) => { g.strokeStyle = style; g.lineWidth = w; g.beginPath(); let on = false; pts.forEach((p) => { if (!isFinite(p.lufs) || p.t < P.t0 || p.t > P.t1) { on = false; return; } const x = X(p.t), y = Y(p.lufs); if (!on) { g.moveTo(x, y); on = true; } else g.lineTo(x, y); }); g.stroke(); g.lineWidth = 1; };
  line(P.mom, "rgba(126,140,110,0.55)", 1);
  line(P.st, "#1e5a45", 2);
  if (isFinite(P.integrated)) { g.setLineDash([4, 4]); g.strokeStyle = "#8a6d1f"; g.beginPath(); g.moveTo(ML, Y(P.integrated) + 0.5); g.lineTo(ML + W, Y(P.integrated) + 0.5); g.stroke(); g.setLineDash([]); g.textAlign = "left"; g.fillStyle = "#8a6d1f"; g.fillText("integrated " + P.integrated.toFixed(1), ML + 6, Y(P.integrated) - 8); }
  g.textAlign = "right"; g.fillStyle = "#1e5a45"; g.fillText("short-term (3 s) — momentary (0.4 s) grey", ML + W - 6, yL0 + 10);
  // voices raster: one row per layer, a bar per note
  const yR0 = yL0 + HL + GAP;
  g.fillStyle = "#ebe4d3"; g.fillRect(ML, yR0, W, HR);
  const hues = ["#1e5a45", "#8a6d1f", "#6d3b52", "#2f4f7f", "#9a4a24", "#4c6b2a", "#555", "#7a5c99", "#2b7a78", "#a0522d", "#3d3d8a", "#806020", "#5b7065", "#993d3d"];
  layers.forEach((l, i) => {
    const y = yR0 + 3 + i * ROW;
    g.fillStyle = "#2b3a33"; g.textAlign = "right"; g.fillText(l, ML - 5, y + ROW / 2);
    g.fillStyle = hues[i % hues.length];
    P.notes.filter((n) => n.layer === l).forEach((n) => { const x0 = X(Math.max(P.t0, n.t)), x1 = X(Math.min(P.t1, n.t + Math.max(n.dur, 0.08))); if (x1 >= ML && x0 <= ML + W) g.fillRect(x0, y + 1, Math.max(1.2, x1 - x0), ROW - 3); });
  });
  // sections and guests, through every strip
  P.marks.forEach((m) => {
    if (m.t < P.t0 || m.t > P.t1) return;
    const x = Math.round(X(m.t)) + 0.5;
    g.strokeStyle = m.kind === "section" ? "rgba(20,30,25,0.85)" : "rgba(138,109,31,0.95)";
    g.setLineDash(m.kind === "section" ? [] : [3, 3]);
    g.beginPath(); g.moveTo(x, MT - 4); g.lineTo(x, yR0 + HR); g.stroke(); g.setLineDash([]);
    g.fillStyle = m.kind === "section" ? "#14201a" : "#8a6d1f"; g.textAlign = "left";
    g.fillText(m.label, x + 3, m.kind === "section" ? MT - 12 : MT - 26);
  });
  // time axis
  const span = P.t1 - P.t0, step = span > 600 ? 120 : span > 300 ? 60 : span > 90 ? 30 : 10;
  g.fillStyle = "#2b3a33"; g.textAlign = "center";
  for (let t = Math.ceil(P.t0 / step) * step; t <= P.t1; t += step) {
    const x = X(t);
    g.fillRect(x, yR0 + HR, 1, 5);
    g.fillText(Math.floor(t / 60) + ":" + String(Math.round(t % 60)).padStart(2, "0"), x, yR0 + HR + 14);
  }
  g.textAlign = "left"; g.font = "bold 12px Helvetica, Arial, sans-serif"; g.fillStyle = "#14201a";
  g.fillText(P.title, ML, 12);
  return cv.toDataURL("image/png").split(",")[1];
};

function pctl(arr, p) { return U.quantile(Array.from(arr), p); }

// Build the picture's data, draw it in Chrome, write the PNG.
async function drawPicture(b, o) {
  const { chans, sr, t0, t1, loud, recs, title, pxPerS } = o;
  const mono = new Float32Array(chans[0].length);
  for (let i = 0; i < mono.length; i++) mono[i] = chans.length > 1 ? 0.5 * (chans[0][i] + chans[1][i]) : chans[0][i];
  const width = Math.max(600, Math.min(2400, Math.round((t1 - t0) * (pxPerS || 8))));
  const S = A.spectrogram(mono, sr, { width, height: 380, fmin: 30, fmax: 16000, nfft: 8192 });
  const sample = [];
  for (let i = 0; i < S.db.length; i += 7) sample.push(S.db[i]);
  const top = Math.ceil(pctl(sample, 0.999)), floor = top - 80;
  const u8 = Buffer.alloc(S.db.length);
  for (let i = 0; i < S.db.length; i++) u8[i] = Math.max(0, Math.min(255, Math.round(255 * (S.db[i] - floor) / (top - floor))));
  const notes = recs.notes.filter((n) => n.t < t1 && n.t + n.dur > t0).map((n) => ({ layer: n.layer, t: n.t, dur: n.dur }));
  const order = ["drone", "organ", "strings", "choir", "clarinet", "harmonium", "bells", "band", "tuba", "voice", "telegraph", "ambient"];
  const layers = [...new Set(notes.map((n) => n.layer))].sort((x, y) => (order.indexOf(x) + 99 * (order.indexOf(x) < 0)) - (order.indexOf(y) + 99 * (order.indexOf(y) < 0)));
  const marks = recs.events.filter((e) => e.kind === "section" || (e.kind === "guest" && e.phase === "start"))
    .map((e) => ({ t: e.t, kind: e.kind, label: e.kind === "section" ? e.section.toUpperCase() : "✦ " + e.guest }));
  const P = {
    t0, t1, title, integrated: loud.integrated, layers, notes, marks,
    spec: { width, height: S.height, fmin: S.fmin, fmax: S.fmax, top, floor, u8: u8.toString("base64") },
    st: loud.shortTerm.map((p) => ({ t: t0 + p.t, lufs: p.lufs })).filter((_, i) => i % 2 === 0),
    mom: loud.momentary.map((p) => ({ t: t0 + p.t, lufs: p.lufs })),
  };
  await b.send("Page.navigate", { url: "about:blank" });
  await C.sleep(300);
  const b64 = await b.evalJS("(" + DRAW.toString() + ")(" + JSON.stringify(P) + ")");
  fs.writeFileSync(o.file, Buffer.from(b64, "base64"));
  return { width, top, floor };
}

// The page's records → a dump-format file (times shifted so the meeting starts at 0).
function writeRecords(file, lines, shift, header) {
  const out = [JSON.stringify(["H", 0, header])];
  lines.forEach((l) => {
    const r = JSON.parse(l);
    r[1] = +(r[1] - shift).toFixed(6);
    if (r[2] && typeof r[2].t === "number") r[2].t = +(r[2].t - shift).toFixed(6);
    if (r[2] && typeof r[2].startTime === "number") r[2].startTime = +(r[2].startTime - shift).toFixed(6);
    out.push(JSON.stringify(r));
  });
  fs.writeFileSync(file, out.join("\n") + "\n");
}

// Does the browser play the meeting the harness describes? Compare the section plan.
function harnessCheck(seed, secs, browserRun) {
  const engine = R.resolveEngine(null);
  const tmp = path.join(R.OUT_ROOT, "_tmp");
  fs.mkdirSync(tmp, { recursive: true });
  const f = path.join(tmp, "capture-check-" + seed + ".jsonl");
  const env = Object.assign({}, process.env, { KOLOB_DIR: engine.dir });
  spawnSync(process.execPath, [engine.harness, String(Math.ceil(secs)), String(seed), "dump=" + f], { env, stdio: "ignore" });
  if (!fs.existsSync(f)) return null;
  const h = Dm.readDump(f);
  const hs = h.events.filter((e) => e.kind === "section" && e.t <= secs), bs = browserRun.events.filter((e) => e.kind === "section" && e.t <= secs);
  const hm = h.meetings[0] || {}, bm = browserRun.meetings[0] || {};
  const rows = [];
  for (let i = 0; i < Math.max(hs.length, bs.length); i++) {
    const x = hs[i], y = bs[i];
    rows.push([x ? x.section : "—", x ? x.t.toFixed(1) : "—", y ? y.section : "—", y ? y.t.toFixed(1) : "—", x && y ? (x.section === y.section && Math.abs(x.t - y.t) < 2 ? "✓" : "✗ " + (y.t - x.t).toFixed(1) + " s") : "✗"]);
  }
  const same = hm.mode === bm.mode && hm.meetingKind === bm.meetingKind && Math.abs((hm.keynoteHz || 0) - (bm.keynoteHz || 0)) < 0.5;
  // note for note: where do the two meetings part? (v0.30 draws every choice
  // from one die in timer order and reads the audio clock at callback time,
  // so real-time jitter changes the draws — PLAN §2.2; the streams and the
  // clock of phase 0b are the cure)
  const hn = h.notes.filter((n) => n.t < secs), bn = browserRun.notes.filter((n) => n.t < secs);
  const used = new Set();
  let matched = 0, firstMiss = null;
  hn.forEach((x) => {
    const j = bn.findIndex((y, k) => !used.has(k) && y.layer === x.layer && Math.abs(y.t - x.t) < 0.3 &&
      (x.freq > 0 ? Math.abs(y.freq / x.freq - 1) < 0.003 : !(y.freq > 0)));
    if (j >= 0) { used.add(j); matched++; } else if (firstMiss == null) firstMiss = x;
  });
  let firstExtra = null;
  bn.forEach((y, k) => { if (!used.has(k) && (!firstExtra || y.t < firstExtra.t)) firstExtra = y; });
  const part = [firstMiss, firstExtra].filter(Boolean).sort((p, q) => p.t - q.t)[0] || null;
  return { rows, same, hm, bm, ok: same && rows.every((r) => r[4] === "✓"), notes: { harness: hn.length, browser: bn.length, matched, part } };
}

function mmss(t) { return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); }

// ---------------------------------------------------------------------------
async function analyse(o) {
  // o: { chans, sr, t0, t1, recs (normalised run or null), out, base, title, b, extra }
  const loud = A.loudness(o.chans, o.sr);
  const pk = A.peaks(o.chans);
  const png = o.base + "-spectrogram.png";
  const pic = await drawPicture(o.b, { chans: o.chans, sr: o.sr, t0: o.t0, t1: o.t1, loud, recs: o.recs || { notes: [], events: [] }, title: o.title, pxPerS: o.pxPerS, file: path.join(o.out, png) });
  const perMin = [];
  for (let m = 0; m * 60 < o.t1 - o.t0 - 1; m++) {
    const seg = loud.shortTerm.filter((p) => p.t > m * 60 && p.t <= (m + 1) * 60 && isFinite(p.lufs)).map((p) => p.lufs);
    const notes = o.recs ? o.recs.notes.filter((n) => n.t >= o.t0 + m * 60 && n.t < o.t0 + (m + 1) * 60).length : null;
    perMin.push([mmss(o.t0 + m * 60) + "–" + mmss(Math.min(o.t1, o.t0 + (m + 1) * 60)), seg.length ? U.fmt(U.median(seg), 1) : "—", seg.length ? U.fmt(Math.max(...seg), 1) : "—", seg.length ? U.fmt(Math.min(...seg), 1) : "—", notes == null ? "—" : String(notes)]);
  }
  return { loud, pk, png, pic, perMin };
}

function reportFor(r) {
  const L = [];
  L.push("## " + r.title);
  L.push("");
  if (r.meta) L.push(r.meta), L.push("");
  L.push(U.table(["measure", "value"], [
    ["integrated loudness", U.fmt(r.an.loud.integrated, 1) + " LUFS"],
    ["loudness range (LRA)", r.an.loud.lra == null ? "—" : U.fmt(r.an.loud.lra, 1) + " LU"],
    ["max momentary (0.4 s)", U.fmt(r.an.loud.momentaryMax, 1) + " LUFS"],
    ["max short-term (3 s)", U.fmt(r.an.loud.shortTermMax, 1) + " LUFS"],
    ["sample peak", U.fmt(r.an.pk.samplePeakDb, 2) + " dBFS"],
    ["true peak (4× oversampled, estimate)", U.fmt(r.an.pk.truePeakDb, 2) + " dBTP"],
  ].concat(r.extraRows || []), ["l", "r"]));
  L.push("");
  L.push("![spectrogram, loudness and voices](" + r.an.png + ")");
  L.push("");
  L.push("*Top: spectrogram (log frequency, " + r.an.pic.floor + "…" + r.an.pic.top + " dB). Middle: loudness, short-term (3 s) in green over momentary (0.4 s) in grey, the integrated level dashed. Bottom: every note the engine reported, one row per layer. Solid lines are section starts; dashed gold lines are guests.*");
  L.push("");
  L.push("### Loudness by minute (short-term, LUFS)");
  L.push("");
  L.push(U.table(["minute", "median", "max", "min", "notes"], r.an.perMin));
  L.push("");
  if (r.timeline && r.timeline.length) {
    L.push("### What happened when");
    L.push("");
    L.push(U.table(["time", "event"], r.timeline, ["r", "l"]));
    L.push("");
  }
  if (r.check) {
    L.push("### The browser's meeting against the harness's");
    L.push("");
    L.push((r.check.ok ? "✓ Same plan: " : "✗ Different: ") + "harness " + [r.check.hm.mode, r.check.hm.meetingKind, r.check.hm.keynoteHz && r.check.hm.keynoteHz.toFixed(1) + " Hz"].join(" · ") +
      "; browser " + [r.check.bm.mode, r.check.bm.meetingKind, r.check.bm.keynoteHz && r.check.bm.keynoteHz.toFixed(1) + " Hz"].join(" · ") + ".");
    L.push("");
    L.push(U.table(["harness section", "at (s)", "browser section", "at (s)", ""], r.check.rows));
    L.push("");
    const nn = r.check.notes;
    L.push("Note for note: " + nn.matched + " of the harness's " + nn.harness + " notes sound in the browser too (" + nn.browser + " there). " +
      (nn.part ? "The two first part at " + mmss(nn.part.t) + " (" + nn.part.layer + (nn.part.freq > 0 ? " " + nn.part.freq.toFixed(1) + " Hz" : "") + ")" +
        " — after that the browser's meeting keeps its plan but takes its own path. v0.30 draws every choice from one die, in the order its timers fire, and reads the audio clock when they fire, so real-time jitter changes the draws — and two browser runs of one seed part from each other too. The streams and the clock of phase 0b (PLAN §2.2: \"every decision keys off scheduled time\") are the cure; until then the harness tools describe the meetings a seed *would* play, and this capture the one it did." : "They agree throughout ✓."));
    L.push("");
  }
  return L.join("\n");
}

(async () => {
  const a = U.parseArgs(process.argv.slice(2), ["help", "meeting", "ives", "no-harness-check"]);
  if (a.help) { console.log(HELP); return; }

  // ---- re-analysis of an existing WAV ----
  if (a.wav) {
    const out = U.outDir(a, "capture-wav");
    const w = A.readWav(String(a.wav));
    const recs = a.events ? Dm.readDump(String(a.events)) : null;
    const t0 = +a.from || 0, t1 = t0 + w.chans[0].length / w.sr;
    const b = await C.launch({ port: +a["chrome-port"] || C.DEFAULT_CHROME_PORT });
    C.cleanupOnExit([b]);
    const base = path.basename(String(a.wav)).replace(/\.wav$/i, "");
    const an = await analyse({ chans: w.chans, sr: w.sr, t0, t1, recs, out, base, title: base, b, pxPerS: +a["px-per-s"] || 8 });
    fs.writeFileSync(path.join(out, "report.md"), "# Capture (re-analysed)\n\n" + reportFor({ title: base, an }) + "\n");
    b.kill();
    console.log(path.join(out, "report.md"));
    process.exit(0);
  }

  const seeds = a.seeds ? U.parseSeeds(a.seeds, []) : [+a.seed || 1847];
  const from = +a.from || 0, maxS = +a.max || 1500;
  let toReq = a.meeting ? maxS : (+a.to || 240);
  if (toReq <= from) throw new Error("--to must be after --from");
  const out = a.out ? U.outDir(a) : U.outDir({}, "capture-" + seeds.join("-"));
  const server = await C.ensureServer({ port: +a.port || C.DEFAULT_HTTP_PORT });
  const b = await C.launch({ port: +a["chrome-port"] || C.DEFAULT_CHROME_PORT });
  C.cleanupOnExit([b, server.proc]);
  const logs = C.collectConsole(b);
  await C.prepare(b);
  await b.send("Page.addScriptToEvaluateOnNewDocument", { source: TAP({ ives: !!a.ives }) });
  await b.send("Emulation.setDeviceMetricsOverride", { width: 860, height: 1300, deviceScaleFactor: 1, mobile: false });

  const sections = [];
  for (const seed of seeds) {
    const errs0 = logs.length;
    const url = server.base + "/art/kolob/?seed=" + seed;
    await b.send("Page.navigate", { url });
    await C.waitFor(b, "document.readyState === 'complete' && !!window.KolobAudio && !!document.getElementById('kolob-play')", 30000);
    await C.sleep(500);
    await b.evalJS("document.getElementById('kolob-play').click(), 1");
    await C.waitFor(b, "KolobAudio.isPlaying() && KolobAudio.getAudioTime() > 0 && window.__tap.sr > 0", 10000, 50);
    // meeting zero: the moment the meeting is called (its first event), else PLAY
    let rec = [], blocks = [], sr = 0, lastNow = 0, tapErr = null;
    const drain = async () => {
      const d = JSON.parse(await b.evalJS("window.__tapDrain()"));
      sr = d.sr || sr; lastNow = d.now; tapErr = d.err || tapErr;
      d.blocks.forEach((x) => {
        const buf = Buffer.from(x.d, "base64");       // may sit inside Node's shared pool: copy exactly its bytes
        blocks.push({ f: x.f, d: new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) });
      });
      d.rec.forEach((l) => rec.push(l));
      return d;
    };
    await C.sleep(300);
    await drain();
    const firstE = rec.map((l) => JSON.parse(l)).find((r) => r[0] === "E");
    let T0 = firstE ? (typeof firstE[2].t === "number" ? firstE[2].t : firstE[1]) : lastNow;
    let jumped = null;
    if (a.section) {
      await C.sleep(1500);
      const ok = await b.evalJS("KolobAudio.skipToSection(" + JSON.stringify(String(a.section)) + ")");
      if (ok) { T0 = await b.evalJS("KolobAudio.getAudioTime()"); jumped = String(a.section); }
      else console.error("capture.js: no '" + a.section + "' in this meeting's plan; times count from the start");
    }
    let to = toReq;
    await b.evalJS("window.__tap.win = [" + (T0 + from) + "," + (T0 + to + 0.5) + "], 1");
    const wall0 = Date.now(), audio0 = lastNow;
    let lastPrint = 0;
    for (;;) {
      await C.sleep(2000);
      await drain();
      if (a.meeting && to === toReq) {
        const end = rec.map((l) => JSON.parse(l)).find((r) => r[0] === "E" && r[2] && r[2].cat === "cadence" && /meeting ends/.test(r[2].detail || ""));
        const endTyped = rec.map((l) => JSON.parse(l)).filter((r) => r[0] === "E" && r[2] && r[2].type === "meeting-start")[1];
        if (end) { const m = /(\d+)s$/.exec(end[2].detail || ""); to = Math.min(maxS, end[2].t - T0 + (m ? +m[1] : 8) + 6); }
        else if (endTyped) to = Math.min(maxS, endTyped[2].t - T0);
        if (to !== toReq) await b.evalJS("window.__tap.win = [" + (T0 + from) + "," + (T0 + to + 0.5) + "], 1");
      }
      if (Date.now() - lastPrint > 15000) { process.stderr.write("seed " + seed + ": " + mmss(Math.max(0, lastNow - T0)) + " / " + mmss(to) + "\n"); lastPrint = Date.now(); }
      if (lastNow > T0 + to + 0.6) { await C.sleep(500); await drain(); break; }
      if ((Date.now() - wall0) / 1000 > (to - from) * 3 + 120) throw new Error("the audio clock is not keeping time (" + (lastNow - audio0).toFixed(1) + " s in " + ((Date.now() - wall0) / 1000).toFixed(0) + " s)");
    }
    const clockRatio = (lastNow - audio0) / ((Date.now() - wall0) / 1000);
    await b.evalJS("document.getElementById('kolob-stop') && document.getElementById('kolob-stop').click(), 1");
    if (tapErr) throw new Error("the tap failed: " + tapErr);
    if (!blocks.length) throw new Error("the tap recorded nothing (is the page routing its output somewhere new?)");

    // assemble the window, exactly
    blocks.sort((x, y) => x.f - y.f);
    const fA = Math.round((T0 + from) * sr), fB = Math.round((T0 + to) * sr), n = fB - fA;
    const Lc = new Float32Array(n), Rc = new Float32Array(n);
    let gaps = 0, covered = 0, expect = null;
    blocks.filter((blk) => blk.f + blk.d.length / 2 > fA && blk.f < fB).forEach((blk) => {
      if (expect != null && blk.f !== expect) gaps++;
      expect = blk.f + blk.d.length / 2;
      for (let i = 0; i < blk.d.length / 2; i++) {
        const j = blk.f + i - fA;
        if (j < 0 || j >= n) continue;
        Lc[j] = blk.d[2 * i]; Rc[j] = blk.d[2 * i + 1]; covered++;
      }
    });
    const base = "capture-" + seed + "-" + Math.round(from) + "-" + Math.round(to);
    const wav = A.writeWav16(path.join(out, base + ".wav"), Lc, Rc, sr);
    writeRecords(path.join(out, base + "-events.jsonl"), rec, T0, { format: "kolob-dump", v: 1, seed, source: "browser", secs: Math.ceil(to), flags: a.ives ? ["ives"] : [], jumped });
    const run = Dm.readDump(path.join(out, base + "-events.jsonl"));
    const title = "KOLOB · seed " + seed + (jumped ? " · from the " + jumped : "") + " · " + mmss(from) + "–" + mmss(to);
    const an = await analyse({ chans: [Lc, Rc], sr, t0: from, t1: to, recs: run, out, base, title, b, pxPerS: +a["px-per-s"] || 8 });
    const check = a["no-harness-check"] || jumped ? null : harnessCheck(seed, to, run);
    const timeline = run.events.filter((e) => e.t >= from - 0.01 && e.t <= to && (e.kind === "section" || e.kind === "guest" || e.kind === "meeting" || e.kind === "cadence" || e.kind === "joint" || e.kind === "stillness" || e.kind === "fuging" || e.kind === "lining" || e.kind === "field" || e.kind === "telegraph"))
      .filter((e, i, arr) => !(e.kind === "cadence" && arr[i - 1] && arr[i - 1].kind === "cadence" && e.t - arr[i - 1].t < 1))
      .slice(0, 80).map((e) => [mmss(e.t), (e.label ? e.label + (e.detail ? " — " + e.detail : "") : e.cat)]);
    const meta = "- " + url.replace(server.base, "") + (a.ives ? " · Ives switch armed" : "") + " · " + sr + " Hz · " + (n / sr).toFixed(1) + " s recorded in muted headless Chrome (" + b.args.filter((x) => /mute/.test(x)).join(" ") + ")\n" +
      "- files: `" + base + ".wav`, `" + base + "-spectrogram.png`, `" + base + "-events.jsonl` (the page's notes and events, meeting time)\n" +
      "- tap: " + (covered >= n ? "every sample of the window" : (100 * covered / n).toFixed(1) + " % of the window") + " · " + (gaps ? gaps + " discontinuities ✗" : "no dropouts ✓") + " · audio clock ran at " + clockRatio.toFixed(3) + "× real time" + (wav.clipped ? " · " + wav.clipped + " samples clipped in the 16-bit file" : "") +
      " · console: " + (logs.length - errs0 ? (logs.length - errs0) + " error(s): " + logs.slice(errs0, errs0 + 3).map((e) => e.text).join(" · ") : "clean");
    sections.push(reportFor({ title, meta, an, timeline, check }));
    process.stderr.write("seed " + seed + ": done — " + U.fmt(an.loud.integrated, 1) + " LUFS, peak " + U.fmt(an.pk.samplePeakDb, 1) + " dBFS\n");
  }
  let version = "";
  try { version = fs.readFileSync(path.join(C.REPO, "art/kolob/VERSION"), "utf8").trim().split(" — ")[0]; } catch (e) {}
  fs.writeFileSync(path.join(out, "report.md"), "# Capture — " + seeds.map((s) => "seed " + s).join(", ") + "\n\n*build " + version + " · " + new Date().toISOString().slice(0, 16).replace("T", " ") + " · for the Listener (PLAN-EXECUTION §4.2): Claude cannot hear; read the picture, the numbers and the log together, and let the owner's ear decide.*\n\n" + sections.join("\n\n") + "\n");
  b.kill();
  if (server.proc) server.proc.kill();
  console.log(path.join(out, "report.md"));
  process.exit(0);
})().catch((e) => { console.error("capture.js: " + (e.stack || e.message)); process.exit(1); });

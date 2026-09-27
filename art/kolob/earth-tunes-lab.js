// ============================================================================
// EARTH TUNES LAB — the owner's review bench for kolob-tunes.js (dev only;
// see earth-tunes-lab.php).
//
// Three small machines, all reading KOLOB.Tunes and nothing else:
//  · THE ENGRAVER draws each tune as its source prints it: one staff per part,
//    the book's key signature and clefs, the written octave (the shape-note
//    tenor sits in the treble clef and is heard an octave lower), rests,
//    fermatas, slurs over the melody's melismas, and the barlines where the
//    metre puts them. Round heads; legibility is the point, not facsimile.
//  · THE ORGAN plays the stored ratios exactly: Hz = keynote × ratio(monzo),
//    with the keynote set to the tune's own tonic so the pitch sits where the
//    book put it. Sines and a soft triangle, a gentle envelope, one limiter.
//    It schedules every note ahead on the audio clock; the only timer on the
//    page is a visual one that lights the notes as they sound.
//  · THE COMPARISON keeps a frozen copy of v0.30's OLD_TUNES incipits (the
//    data the owner judged wrong) so the old and the new can be heard in the
//    same key, one after the other. It is a snapshot for this page only; the
//    engine's own table stays in kolob-audio.js until integration.
//
// Public surface: window.EarthTunesLab (for headless checks)
// ============================================================================
window.EarthTunesLab = (function () {
  "use strict";

  var errEl = document.getElementById("etl-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent += msg + "\n"; }
  window.addEventListener("error", function (e) { showErr("JS error: " + e.message + " @ " + String(e.filename || "").split("/").pop() + ":" + e.lineno); });

  var TUNES = window.KOLOB && window.KOLOB.Tunes;
  if (!TUNES) { showErr("kolob-tunes.js did not load."); return {}; }
  if (TUNES.problems && TUNES.problems.length) showErr("kolob-tunes.js reports:\n  " + TUNES.problems.join("\n  "));

  // ---- v0.30's OLD_TUNES, frozen (kolob-audio.js, 2026-09-26) ----------------
  // [degree in 7-degree space (0 = tonic; minor tunes count from la), beats]
  var OLD = {
    "earth:all-is-well": { minor: false, notes: [[0, 1], [0, 1], [1, 1], [2, 1], [0, 2], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 2]] },
    "earth:kingsfold": { minor: true, notes: [[2, 1], [1, 1], [0, 1], [0, 1], [0, 2], [-1, 1], [2, 1], [2, 1], [3, 1], [2, 3]] },
    "earth:bethany": { minor: false, notes: [[2, 1.5], [1, 0.5], [0, 1], [0, 1], [-2, 2], [-2, 1.5], [-3, 0.5], [0, 1], [2, 1], [1, 3]] },
    "earth:foundation": { minor: false, notes: [[-3, 1], [-2, 0.5], [0, 0.5], [-2, 1], [0, 1], [-3, 1], [0, 0.5], [0, 0.5], [2, 1], [0, 2]] },
    "earth:nettleton": { minor: false, notes: [[2, 1], [1, 0.5], [0, 0.5], [0, 1], [2, 1], [4, 1], [1, 0.5], [1, 0.5], [2, 1], [4, 2]] },
    "earth:simple-gifts": { minor: false, notes: [[-3, 1], [-3, 1], [0, 1], [0, 0.5], [1, 0.5], [2, 0.5], [0, 0.5], [2, 0.5], [3, 0.5], [4, 1], [4, 0.5], [4, 0.5], [2, 1], [1, 0.5], [0, 0.5]] },
    "earth:god-be-with-you": { minor: false, notes: [[2, 1], [2, 0.5], [2, 0.5], [2, 1], [2, 0.5], [2, 0.5], [4, 1], [1, 1], [2, 1], [5, 2]] }
  };
  var OLD_BEAT = 0.6;       // seconds per v0.30 beat at tempo 1 (the tune lab's plain voice ran ~1.2 s; halved to sit near the new tunes' pace)

  var SEVEN = ["earth:all-is-well", "earth:kingsfold", "earth:bethany", "earth:foundation", "earth:nettleton", "earth:simple-gifts", "earth:god-be-with-you"];

  // ---- pitch helpers ---------------------------------------------------------
  var LET = "CDEFGAB";
  var SEMI = [0, 2, 4, 5, 7, 9, 11];
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3]); }
  function sigMap(sig) {
    var out = {}; if (!sig) return out;
    var n = parseInt(sig, 10), sharp = sig.indexOf("#") >= 0;
    for (var i = 0; i < n; i++) out[(sharp ? "FCGDAEB" : "BEADGCF")[i]] = sharp ? 1 : -1;
    return out;
  }
  function tonicStep(t) { var li = LET.indexOf(t); return (li >= 3 ? 3 : 4) * 7 + li; }
  // the keynote: the tonic's equal-tempered pitch in the octave F3–E4, so the
  // tune sounds in the book's key; everything above it is exact ratio
  function keynoteHz(h) {
    var e = h.engrave, step = tonicStep(e.tonic), acc = sigMap(e.sig)[e.tonic] || 0;
    var oct = Math.floor(step / 7), midi = 12 * (oct + 1) + SEMI[step % 7] + acc;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }
  var SCALE = {
    ionian: [[0, 0, 0, 0], [-3, 2, 0, 0], [-2, 0, 1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [0, -1, 1, 0], [-3, 1, 1, 0]],
    aeolian: [[0, 0, 0, 0], [-3, 2, 0, 0], [1, 1, -1, 0], [2, -1, 0, 0], [-1, 1, 0, 0], [3, 0, -1, 0], [4, -2, 0, 0]]
  };
  function degMonzo(minor, d) {
    var s = SCALE[minor ? "aeolian" : "ionian"], c = ((d % 7) + 7) % 7, o = Math.floor(d / 7);
    var m = s[c]; return [m[0] + o, m[1], m[2], m[3]];
  }
  function parseSrc(src) {           // "F#4" → {L, acc, oct, step}
    var m = /^([A-G])([#bn]?)(-?\d)$/.exec(src);
    return { L: m[1], acc: m[2], oct: +m[3], step: +m[3] * 7 + LET.indexOf(m[1]) };
  }

  // ---- the engraver ------------------------------------------------------------
  var SP = 8;                        // staff space, px
  var CLEF = {                       // bottom line (diatonic step), label
    treble: { bottom: 4 * 7 + 2, label: "G", sub: "" },
    treble8: { bottom: 4 * 7 + 2, label: "G", sub: "8" },
    bass: { bottom: 2 * 7 + 4, label: "F", sub: "" }
  };
  var SHARP_POS = { treble: ["F5", "C5", "G5", "D5", "A4", "E5", "B4"], bass: ["F3", "C3", "G3", "D3", "A2", "E3", "B2"] };
  var FLAT_POS = { treble: ["B4", "E5", "A4", "D5", "G4", "C5", "F4"], bass: ["B2", "E3", "A2", "D3", "G2", "C3", "F2"] };
  var PART_NAME = {
    sacredharp: { S: "Treble", A: "Alto", T: "Tenor", B: "Bass" },
    other: { S: "Soprano", A: "Alto", T: "Tenor", B: "Bass" }
  };

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function f1(v) { return Math.round(v * 10) / 10; }

  // note value (fraction of a whole note) → glyph description
  function glyphOf(whole) {
    var bases = [[1, "w"], [0.5, "h"], [0.25, "q"], [0.125, "e"], [0.0625, "s"]];
    for (var i = 0; i < bases.length; i++) {
      var b = bases[i][0];
      if (Math.abs(whole - b) < 1e-6) return { kind: bases[i][1], dot: false };
      if (Math.abs(whole - b * 1.5) < 1e-6) return { kind: bases[i][1], dot: true };
    }
    for (i = 0; i < bases.length; i++) if (whole > bases[i][0]) return { kind: bases[i][1], dot: false, odd: true };
    return { kind: "s", dot: false };
  }

  function staffY(clef, step, top) { return top + 4 * SP - (step - CLEF[clef].bottom) * SP / 2; }

  // one poetic line of one tune → SVG (all parts stacked)
  function engraveRow(h, line, rowIdx, nextStart, opts) {
    var e = h.engrave, den = +h.modeOfTime.split("/")[1], barBeats = +h.modeOfTime.split("/")[0];
    var parts = e.order.filter(function (p) { return line.notes[p]; });
    if (opts.melodyOnly) parts = [h.melodyPart];
    var sig = sigMap(e.sig), nsig = e.sig ? parseInt(e.sig, 10) : 0, sharpSig = (e.sig || "").indexOf("#") >= 0;
    var minBeats = 99, span = 0;
    parts.forEach(function (p) { line.notes[p].forEach(function (n) { minBeats = Math.min(minBeats, n.beats); span = Math.max(span, n.beat + n.beats); }); });
    if (nextStart != null) span = Math.max(span, nextStart - line.startBeat);
    var unit = 30 * Math.pow(4 / den, 0.75);
    unit = Math.max(unit, 15 / minBeats);
    var head = 34 + nsig * 8 + (rowIdx === 0 ? 20 : 0) + 22;
    var W = Math.ceil(head + span * unit + 20);
    var staffH = 4 * SP, pad = 30, gap = 8;
    var H = parts.length * (staffH + 2 * pad) + gap;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" data-row="' + rowIdx + '">');
    parts.forEach(function (p, pi) {
      var clef = e.clefs[p] || "treble", baseClef = clef === "bass" ? "bass" : "treble";
      var top = pi * (staffH + 2 * pad) + pad;
      // staff
      for (var k = 0; k < 5; k++) out.push('<line class="st" x1="4" x2="' + (W - 4) + '" y1="' + (top + k * SP) + '" y2="' + (top + k * SP) + '"/>');
      // part label + clef
      var nm = (PART_NAME[h.dialect === "sacredharp" ? "sacredharp" : "other"][p] || p) + (p === h.melodyPart ? " ★" : "");
      out.push('<text class="tx" x="6" y="' + (top - 8) + '" font-size="10">' + esc(nm) + "</text>");
      var cy = clef === "bass" ? top + SP : top + 3 * SP;
      out.push('<text class="tx" x="8" y="' + (cy + 5) + '" font-size="15" font-weight="600">' + CLEF[clef].label + "</text>");
      if (CLEF[clef].sub) out.push('<text class="tx" x="10" y="' + (top + 4 * SP + 11) + '" font-size="8">8</text>');
      // key signature
      var pos = sharpSig ? SHARP_POS[baseClef] : FLAT_POS[baseClef];
      for (k = 0; k < nsig; k++) {
        var ps = parseSrc(pos[k]);
        out.push('<text class="ac" x="' + (26 + k * 8) + '" y="' + f1(staffY(baseClef, ps.step, top) + 4) + '" font-size="13">' + (sharpSig ? "♯" : "♭") + "</text>");
      }
      if (rowIdx === 0) {
        var tx = 30 + nsig * 8;
        out.push('<text class="tx" x="' + tx + '" y="' + (top + 2 * SP - 1) + '" font-size="13" font-weight="600">' + barBeats + "</text>");
        out.push('<text class="tx" x="' + tx + '" y="' + (top + 4 * SP - 1) + '" font-size="13" font-weight="600">' + den + "</text>");
      }
      // barlines (shared metric grid)
      for (var b = Math.ceil(-line.barStart / barBeats) * barBeats + barBeats - line.barStart; b <= span + 1e-6; b += barBeats) {
        if (b <= 1e-6) continue;
        var bx = f1(head + b * unit - 3);
        out.push('<line class="bl" x1="' + bx + '" x2="' + bx + '" y1="' + top + '" y2="' + (top + 4 * SP) + '"/>');
      }
      // notes and rests
      var ns = line.notes[p], cursor = 0, prevX = null, prevY = null;
      ns.forEach(function (n, ni) {
        if (n.beat > cursor + 1e-6) out.push(restSvg(head + cursor * unit + 5, (n.beat - cursor) / den, top));
        var x = head + n.beat * unit + 9, src = parseSrc(n.src);
        var y = staffY(clef, src.step, top);
        var g = glyphOf(n.beats / den);
        var lineIdx = (src.step - CLEF[clef].bottom);
        out.push('<g class="nt" data-p="' + p + '" data-b="' + f1((line.startBeat + n.beat) * 1000) / 1000 + '">');
        // ledger lines
        for (var ls = -2; ls >= lineIdx; ls -= 2) out.push('<line class="st" x1="' + f1(x - 8) + '" x2="' + f1(x + 8) + '" y1="' + f1(staffY(clef, CLEF[clef].bottom + ls, top)) + '" y2="' + f1(staffY(clef, CLEF[clef].bottom + ls, top)) + '"/>');
        for (ls = 10; ls <= lineIdx; ls += 2) out.push('<line class="st" x1="' + f1(x - 8) + '" x2="' + f1(x + 8) + '" y1="' + f1(staffY(clef, CLEF[clef].bottom + ls, top)) + '" y2="' + f1(staffY(clef, CLEF[clef].bottom + ls, top)) + '"/>');
        // accidental, shown when the written one differs from the signature
        var inSig = sig[src.L] || 0, wr = src.acc === "#" ? 1 : src.acc === "b" ? -1 : src.acc === "n" ? 0 : inSig;
        if (src.acc && wr !== inSig) out.push('<text class="ac" x="' + f1(x - 15) + '" y="' + f1(y + 4) + '" font-size="12">' + (wr > 0 ? "♯" : wr < 0 ? "♭" : "♮") + "</text>");
        // head
        var open = g.kind === "w" || g.kind === "h";
        out.push('<ellipse class="hd' + (open ? " op" : "") + '" cx="' + f1(x) + '" cy="' + f1(y) + '" rx="5" ry="3.6" transform="rotate(-20 ' + f1(x) + " " + f1(y) + ')"/>');
        if (g.dot) out.push('<circle class="hd" cx="' + f1(x + 9) + '" cy="' + f1(y - ((lineIdx % 2 === 0) ? 2 : 0)) + '" r="1.4"/>');
        if (g.odd) out.push('<text class="tx" x="' + f1(x + 7) + '" y="' + f1(y - 6) + '" font-size="8">' + (Math.round(n.beats * 100) / 100) + "</text>");
        // stem and flags
        if (g.kind !== "w") {
          var up = lineIdx < 4, sx = up ? x + 4.6 : x - 4.6, sy2 = up ? y - 3.5 * SP : y + 3.5 * SP;
          out.push('<line class="sm" x1="' + f1(sx) + '" x2="' + f1(sx) + '" y1="' + f1(y) + '" y2="' + f1(sy2) + '"/>');
          var nfl = g.kind === "e" ? 1 : g.kind === "s" ? 2 : 0;
          for (var fl = 0; fl < nfl; fl++) {
            var fy = sy2 + (up ? fl * 5 : -fl * 5);
            out.push('<path class="fl" d="M' + f1(sx) + " " + f1(fy) + " q 6 " + (up ? 5 : -5) + " 5 " + (up ? 11 : -11) + '"/>');
          }
        }
        if (n.fermata) {
          var fyy = Math.min(top - 6, y - 12);
          out.push('<path class="sl" d="M' + f1(x - 6) + " " + f1(fyy) + " q 6 -8 12 0" + '"/><circle class="hd" cx="' + f1(x) + '" cy="' + f1(fyy - 2) + '" r="1.2"/>');
        }
        out.push("</g>");
        // slur (melisma continuation of the melody) or tie from the previous note
        var prev = ns[ni - 1];
        if (prev && ((p === h.melodyPart && n.syl === null && !prev.tie) || prev.tie)) {
          var yy = Math.max(prevY, y) + 7;
          out.push('<path class="sl" d="M' + f1(prevX + 2) + " " + f1(yy) + " Q " + f1((prevX + x) / 2) + " " + f1(yy + 7) + " " + f1(x - 2) + " " + f1(yy) + '"/>');
        }
        prevX = x; prevY = y;
        cursor = n.beat + n.beats;
      });
      if (span > cursor + 1e-6) out.push(restSvg(head + cursor * unit + 5, (span - cursor) / den, top));
    });
    out.push("</svg>");
    return out.join("");
  }
  function restSvg(x, whole, top) {
    x = f1(x + 2);
    if (whole >= 0.5 - 1e-6) {                                     // half/whole rest block on the middle line
      var y = whole >= 1 - 1e-6 ? top + SP : top + 2 * SP - 3;
      return '<rect class="hd" x="' + x + '" y="' + y + '" width="8" height="3"/>';
    }
    if (whole >= 0.25 - 1e-6) return '<path class="fl" d="M' + x + " " + (top + SP) + " l 4 5 l -4 4 l 5 6 q -6 -2 -2 5" + '"/>';
    return '<path class="fl" d="M' + x + " " + (top + 2 * SP) + " l 4 -4 m -4 4 l 0 8" + '"/><circle class="hd" cx="' + x + '" cy="' + (top + 2 * SP - 3) + '" r="1.6"/>';
  }

  function engraveTune(h, opts) {
    var L = h.lines.concat(h.refrain || []);
    return L.map(function (ln, i) {
      var next = i + 1 < L.length ? L[i + 1].startBeat : null;
      return '<div class="etl-row">' + engraveRow(h, ln, i, next, opts) + "</div>";
    }).join("");
  }

  // v0.30's incipit, engraved on the melody's staff in the tune's key
  function oldHymn(h) {
    var o = OLD[h.id]; if (!o) return null;
    var mel = h.lines[0].notes[h.melodyPart], first = mel[0];
    var shift = h.engrave.shift[h.melodyPart] || 0;
    var t0 = tonicStep(h.engrave.tonic);
    var minor = h.mode === "aeolian" || h.mode === "dorian";
    // put v0.30's first note in the octave nearest the new tune's first note
    var k = Math.round((first.deg - o.notes[0][0]) / 7) * 7;
    var sig = sigMap(h.engrave.sig), beat = 0, notes = [];
    o.notes.forEach(function (nd) {
      var deg = nd[0] + k, step = t0 + deg - shift * 7, L = LET[((step % 7) + 7) % 7];
      notes.push({ beat: beat, beats: nd[1], deg: deg, monzo: degMonzo(minor, deg), tie: false, fermata: false,
                   syl: 0, src: L + (sig[L] ? "" : "") + Math.floor(step / 7) });
      beat += nd[1];
    });
    var line = { notes: {}, startBeat: 0, barStart: 0 };
    line.notes[h.melodyPart] = notes;
    return {
      id: h.id + ":v030", modeOfTime: "4/4", melodyPart: h.melodyPart, dialect: h.dialect, beatS: OLD_BEAT, mode: h.mode,
      engrave: h.engrave, lines: [line], refrain: null, _old: true
    };
  }

  // ---- the organ -------------------------------------------------------------------
  var ctx = null, master = null, live = [], playing = null, timer = null;
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.15;
    master.connect(lim); lim.connect(ctx.destination);
    api.master = master; api.limiter = lim;
  }
  function voice(t, dur, hz, gainMul, pan) {
    var g = ctx.createGain(), lp = ctx.createBiquadFilter(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    lp.type = "lowpass"; lp.frequency.value = Math.min(4200, hz * 7); lp.Q.value = 0.3;
    var o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator();
    var g2 = ctx.createGain(), g3 = ctx.createGain();
    o1.type = "sine"; o2.type = "sine"; o3.type = "triangle";
    o1.frequency.value = hz; o2.frequency.value = hz * 2; o3.frequency.value = hz;
    g2.gain.value = 0.28; g3.gain.value = 0.22;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); o3.connect(g3); g3.connect(lp);
    lp.connect(g);
    if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(master); } else g.connect(master);
    var peak = 0.16 * gainMul, rel = Math.min(0.12, dur * 0.3);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.025);
    g.gain.setValueAtTime(peak, t + Math.max(0.03, dur - rel));
    g.gain.linearRampToValueAtTime(0, t + dur);
    [o1, o2, o3].forEach(function (o) { o.start(t); o.stop(t + dur + 0.05); live.push(o); });
  }
  var PAN = { S: -0.25, A: 0.3, T: 0.1, B: -0.05 };

  // the events of a hymn: [{t, dur, hz, part, b}]
  function eventsOf(h, opts) {
    var spb = h.beatS / opts.tempo, key = keynoteHz(h), melody = h.melodyPart;
    var L = h.lines.concat(h.refrain || []);
    var ferm = [];
    L.forEach(function (ln) { (ln.notes[melody] || []).forEach(function (n) { if (n.fermata) ferm.push(ln.startBeat + n.beat + n.beats); }); });
    function at(b) { var x = 0; for (var i = 0; i < ferm.length; i++) if (ferm[i] <= b + 1e-6) x += 0.8; return (b + x) * spb; }
    var ev = [];
    L.forEach(function (ln) {
      Object.keys(ln.notes).forEach(function (p) {
        if (opts.melodyOnly && p !== melody) return;
        ln.notes[p].forEach(function (n) {
          var b = ln.startBeat + n.beat, t = at(b), end = at(b + n.beats) + (n.fermata ? 0.8 * spb : 0);
          ev.push({ t: t, dur: Math.max(0.06, end - t - 0.012), hz: key * ratio(n.monzo), part: p, b: Math.round(b * 1000) / 1000, mel: p === melody });
        });
      });
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function stop() {
    live.forEach(function (o) { try { o.stop(); } catch (e) {} });
    live = [];
    if (timer) { clearInterval(timer); timer = null; }
    if (playing && playing.card) playing.card.classList.remove("is-playing");
    document.querySelectorAll(".etl svg .hi").forEach(function (g) { g.classList.remove("hi"); });
    document.querySelectorAll(".etl-btn.is-on").forEach(function (b) { b.classList.remove("is-on"); });
    playing = null;
    nowEl.textContent = "";
  }

  // play one or more hymns back to back; `scoreEls` light the notes
  function play(seq, card, btn, label) {
    stop(); ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    var t0 = ctx.currentTime + 0.12, all = [], off = t0;
    seq.forEach(function (item) {
      var ev = eventsOf(item.h, item.opts);
      ev.forEach(function (e) { e.t += off; e.scope = item.scope; all.push(e); });
      var last = ev.length ? ev[ev.length - 1] : null;
      var end = 0; ev.forEach(function (e) { end = Math.max(end, e.t + e.dur); });
      off = (ev.length ? end : off) + 0.9;
    });
    all.forEach(function (e) { voice(e.t, e.dur, e.hz, e.mel ? 1 : 0.62, PAN[e.part] || 0); });
    playing = { card: card, events: all, end: off, label: label };
    if (card) card.classList.add("is-playing");
    if (btn) btn.classList.add("is-on");
    nowEl.textContent = "playing " + label;
    api.lastEvents = all;
    timer = setInterval(function () {                          // visual only: the notes that are sounding
      if (!playing) return;
      var now = ctx.currentTime;
      if (now > playing.end) { stop(); return; }
      if (!followEl.checked) return;
      playing.events.forEach(function (e) {
        if (!e.scope) return;
        if (!e.el) e.el = e.scope.querySelectorAll('g.nt[data-p="' + e.part + '"][data-b="' + e.b + '"]');
        var on = now >= e.t && now < e.t + e.dur;
        for (var i = 0; i < e.el.length; i++) e.el[i].classList.toggle("hi", on);
      });
    }, 60);
  }

  // ---- the page ------------------------------------------------------------------------
  var listEl = document.getElementById("etl-tunes"), tocEl = document.getElementById("etl-toc");
  var nowEl = document.getElementById("etl-now"), followEl = document.getElementById("etl-follow");
  var melEl = document.getElementById("etl-melody"), tempoEl = document.getElementById("etl-tempo"), tempoOut = document.getElementById("etl-tempo-out");
  function opts() { return { tempo: +tempoEl.value, melodyOnly: melEl.checked }; }

  var ordered = SEVEN.map(function (id) { return TUNES.byId(id); }).filter(Boolean)
    .concat(TUNES.list.filter(function (h) { return SEVEN.indexOf(h.id) < 0; }));

  function srcLine(s, lead) {
    if (!s) return "";
    return '<p class="etl-src">' + lead + ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.book) + "</a>, " +
      esc(s.year) + ", " + (typeof s.page === "number" ? "p. " + s.page : esc(s.page)) + (s.note ? '<br><span class="etl-x">' + esc(s.note) + "</span>" : "") + "</p>";
  }

  function render() {
    stop();
    var o = opts(), html = [], toc = [];
    ordered.forEach(function (h, i) {
      if (i === 0) html.push('<h2 class="etl-sec">The seven, re-transcribed (v0.30 carried these as incipits)</h2>');
      if (i === SEVEN.length) html.push('<h2 class="etl-sec">Added: public-domain tunes of Kolob\'s families</h2>');
      var slug = h.id.split(":")[1], L = h.lines.concat(h.refrain || []);
      toc.push('<a href="#t-' + slug + '">' + esc(h.nameEn) + "</a>");
      var parts = Object.keys(L[0].notes);
      html.push('<section class="etl-card" id="t-' + slug + '" data-id="' + esc(h.id) + '">');
      html.push("<h2>" + esc(h.nameEn) + '<span class="etl-ds">' + esc(h.nameDs) + "</span></h2>");
      html.push('<p class="etl-meta"><b>' + esc(h.engrave.sourceKey) + "</b> · " + esc(h.meter) + " · " + esc(h.modeOfTime) +
        " · Kolob mode <b>" + esc(h.mode) + "</b> · dialect " + esc(h.dialect) + " · form " + esc(h.form) +
        " · " + L.length + " lines · parts " + parts.join(" ") + " (melody " + h.melodyPart + ")</p>");
      html.push(srcLine(h.source, "Source:"));
      (h.crossCheck || []).forEach(function (c) { html.push(srcLine(c, "Cross-check:")); });
      html.push('<div class="etl-ctl"><button type="button" class="etl-btn" data-act="play">play</button>');
      if (OLD[h.id]) {
        html.push('<button type="button" class="etl-btn is-old" data-act="old">v0.30</button>' +
          '<button type="button" class="etl-btn is-old" data-act="ab">v0.30 → new</button>' +
          '<button type="button" class="etl-btn" data-act="showold">show v0.30</button>');
      }
      html.push('<span class="etl-hint">' + (o.melodyOnly ? "melody only" : "all parts the book prints") + "</span></div>");
      html.push('<div class="etl-score etl-new">' + engraveTune(h, o) + "</div>");
      if (OLD[h.id]) html.push('<div class="etl-score etl-old" hidden><p class="etl-old-cap">v0.30 incipit, on the same staff and in the same key (its rhythm in plain beats)</p>' + engraveTune(oldHymn(h), { melodyOnly: true }) + "</div>");
      html.push('<details class="etl-notes"' + (i < 3 ? " open" : "") + '><summary>transcriber\'s notes</summary><p>' + esc(h.notes).replace(/\. /g, ".</p><p>") + "</p></details>");
      html.push("</section>");
    });
    listEl.innerHTML = html.join("");
    tocEl.innerHTML = toc.join("");
  }

  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]"); if (!btn) return;
    var card = btn.closest(".etl-card"), h = TUNES.byId(card.getAttribute("data-id")), o = opts();
    var act = btn.getAttribute("data-act");
    var newEl = card.querySelector(".etl-new"), oldEl = card.querySelector(".etl-old");
    if (act === "play") {
      if (playing && playing.card === card && btn.classList.contains("is-on")) { stop(); return; }
      play([{ h: h, opts: o, scope: newEl }], card, btn, h.nameEn);
    } else if (act === "old") {
      if (oldEl) oldEl.hidden = false;
      play([{ h: oldHymn(h), opts: { tempo: o.tempo, melodyOnly: true }, scope: oldEl }], card, btn, h.nameEn + " — v0.30 incipit");
    } else if (act === "ab") {
      if (oldEl) oldEl.hidden = false;
      var firstTwo = { id: h.id, beatS: h.beatS, melodyPart: h.melodyPart, engrave: h.engrave, lines: h.lines.slice(0, 2), refrain: null };
      play([{ h: oldHymn(h), opts: { tempo: o.tempo, melodyOnly: true }, scope: oldEl }, { h: firstTwo, opts: { tempo: o.tempo, melodyOnly: true }, scope: newEl }],
           card, btn, h.nameEn + " — v0.30, then the new first lines");
    } else if (act === "showold") {
      oldEl.hidden = !oldEl.hidden; btn.classList.toggle("is-on", !oldEl.hidden);
    }
  });
  document.getElementById("etl-stop").addEventListener("click", stop);
  tempoEl.addEventListener("input", function () { tempoOut.textContent = (+tempoEl.value).toFixed(2) + "×"; });
  melEl.addEventListener("change", render);

  var api = { tunes: ordered, render: render, stop: stop, play: play, eventsOf: eventsOf, oldHymn: oldHymn, keynoteHz: keynoteHz, engraveTune: engraveTune };
  render();
  return api;
})();

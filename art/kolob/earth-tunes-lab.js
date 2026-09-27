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
//    book put it. One oscillator per note (a principal with a little octave
//    and twelfth, as a PeriodicWave) into a shared filter and pan per part,
//    one limiter. Notes are handed to a PJ2.Clock a few hundred milliseconds
//    ahead of the audio clock, never all at once, and every note's two nodes
//    disconnect when it ends, so a four-part PISGAH costs what one bar does.
//    It plays legato, as an organist would: each note's release runs into
//    the next, except a repeated pitch, which is lifted just before it
//    strikes again; tied notes sound once. STOP fades the whole organ out in
//    25 ms instead of cutting it. The commas (kolob-tunes.js header) are on
//    by default; "fixed degrees" plays every degree at its table ratio, so
//    the owner can hear what the commas fix.
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
    unit = Math.max(unit, 19 / minBeats);                          // room for a semiquaver's head, flags and a barline
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
        var tx = 35 + nsig * 8;
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
        if (n.beat > cursor + 1e-6) out.push(restsSvg(cursor, n.beat, line.barStart, barBeats, den, head, unit, top));
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
        // the comma (Johnston's + and −): this note leans a syntonic comma
        // off its degree so the chord it sounds in stays just
        if (n.comma && !opts.fixed) out.push('<text class="cm" x="' + f1(x - 9) + '" y="' + f1(y - 5) + '" font-size="9" text-anchor="end">' + (n.comma > 0 ? "+" : "−") + "</text>");
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
      if (span > cursor + 1e-6) out.push(restsSvg(cursor, span, line.barStart, barBeats, den, head, unit, top));
    });
    out.push("</svg>");
    return out.join("");
  }
  // the silence from beat `from` to beat `to` of a line, as rests the way a
  // hymnal prints them: never across a barline, a bar's worth of silence as
  // one whole-bar rest in the middle of the bar, anything shorter as the
  // largest plain values that fit, in order
  function restsSvg(from, to, barStart, barBeats, den, head, unit, top) {
    var out = [], b = from;
    while (b < to - 1e-6) {
      var intoBar = (((barStart + b) % barBeats) + barBeats) % barBeats;
      var barEnd = b + (barBeats - intoBar);
      var segEnd = Math.min(to, barEnd);
      if (intoBar < 1e-6 && segEnd >= barEnd - 1e-6) {             // a whole bar: the whole rest, centred
        out.push(restSvg(head + (b + barBeats / 2) * unit - 4, 1, top));
      } else {
        var c = b;
        while (c < segEnd - 1e-6) {
          var room = (segEnd - c) / den, vals = [1, 0.5, 0.25, 0.125, 0.0625], v = vals[vals.length - 1];
          for (var k = 0; k < vals.length; k++) if (vals[k] <= room + 1e-6) { v = vals[k]; break; }
          out.push(restSvg(head + c * unit + 5, v, top));
          c += v * den;
        }
      }
      b = segEnd;
    }
    return out.join("");
  }
  function restSvg(x, whole, top) {
    x = f1(x + 2);
    if (whole >= 0.5 - 1e-6) {                                     // whole rest hangs from the 4th line; half sits on the middle
      var y = whole >= 1 - 1e-6 ? top + SP : top + 2 * SP - 3;
      return '<rect class="hd" x="' + x + '" y="' + y + '" width="8" height="3"/>';
    }
    if (whole >= 0.25 - 1e-6) return '<path class="fl" d="M' + x + " " + (top + SP) + " l 4 5 l -4 4 l 5 6 q -6 -2 -2 5" + '"/>';
    var two = whole < 0.125 - 1e-6;                                // a semiquaver rest carries a second hook
    return '<path class="fl" d="M' + x + " " + (top + 2 * SP) + " l 4 -4 m -4 4 l 0 8" + '"/><circle class="hd" cx="' + x + '" cy="' + (top + 2 * SP - 3) + '" r="1.6"/>' +
      (two ? '<circle class="hd" cx="' + f1(+x - 1) + '" cy="' + (top + 2 * SP + 2) + '" r="1.6"/>' : "");
  }

  function engraveTune(h, opts) {
    var L = h.lines.concat(h.refrain || []);
    return L.map(function (ln, i) {
      var next = i + 1 < L.length ? L[i + 1].startBeat : null;
      var cap = ln.devNote ? '<p class="etl-cap">' + esc(ln.devNote) + "</p>" : "";
      return '<div class="etl-row">' + cap + engraveRow(h, ln, i, next, opts) + "</div>";
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
  var ctx = null, master = null, clock = null, wave = null, session = null, live = [];
  var playing = null, timer = null, quietUntil = 0;
  var LEVEL = 0.5, FADE = 0.025;                                   // the master level; the stop fade
  var COMMA = [-4, 4, -1, 0];                                       // 81/80
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = LEVEL;
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.15;
    master.connect(lim); lim.connect(ctx.destination);
    // a principal with a little octave and twelfth: one oscillator per note
    var re = new Float32Array(8), im = new Float32Array(8);
    im[1] = 1; im[2] = 0.3; im[3] = 0.1; im[4] = 0.07; im[5] = 0.02; im[6] = 0.015;
    wave = ctx.createPeriodicWave(re, im);
    clock = window.PJ2 && PJ2.Clock ? PJ2.Clock.create(ctx, { aheadS: 0.3 }) : null;
    api.master = master; api.limiter = lim; api.ctx = ctx;
  }
  var PAN = { S: -0.25, A: 0.3, T: 0.1, B: -0.05 };
  // a session: one gain for everything a PLAY starts, with a filter and a
  // pan per part under it. STOP fades the session, not the master, and the
  // next PLAY opens a fresh one, so nothing waits on a gain being restored.
  function openSession() {
    var g = ctx.createGain(); g.gain.value = 1; g.connect(master);
    return { gain: g, buses: {}, nodes: [g] };
  }
  function bus(part) {                                             // one filter and pan per part, shared by its notes
    var S = session;
    if (S.buses[part]) return S.buses[part];
    var lp = ctx.createBiquadFilter(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    lp.type = "lowpass"; lp.frequency.value = 3200; lp.Q.value = 0.4;
    if (pn) { pn.pan.value = PAN[part] || 0; lp.connect(pn); pn.connect(S.gain); S.nodes.push(pn); } else lp.connect(S.gain);
    S.nodes.push(lp);
    return (S.buses[part] = lp);
  }
  function voice(t, e) {
    if (!session) return;
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.setPeriodicWave(wave); o.frequency.value = e.hz;
    o.connect(g); g.connect(bus(e.part));
    var peak = 0.13 * (e.mel ? 1 : 0.62);
    // legato: the release begins where the next note does and dies under it;
    // a repeated pitch is lifted 45 ms early so it can be struck again
    var relAt = t + e.dur, tau = 0.035;
    if (e.lift) { relAt = Math.max(t + 0.03, t + e.dur - 0.045); tau = 0.012; }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.setValueAtTime(peak, relAt);
    g.gain.setTargetAtTime(0, relAt, tau);
    o.start(t); o.stop(relAt + tau * 8);
    var rec = { o: o, g: g, t: t };
    live.push(rec);
    o.onended = function () {                                      // leave nothing connected behind
      try { o.disconnect(); g.disconnect(); } catch (x) {}
      var i = live.indexOf(rec); if (i >= 0) live.splice(i, 1);
    };
  }

  // the events of a hymn: [{t, dur, hz, part, bs, mel, lift}], t from 0.
  // Fermatas are read from the melody: each adds 0.8 beat of hold at the
  // end of its note, and every part that sounds across that moment holds too.
  function eventsOf(h, opts) {
    var spb = h.beatS / opts.tempo, key = keynoteHz(h), melody = h.melodyPart;
    var L = h.lines.concat(h.refrain || []);
    var ferm = [];
    L.forEach(function (ln) { (ln.notes[melody] || []).forEach(function (n) { if (n.fermata) ferm.push(ln.startBeat + n.beat + n.beats); }); });
    function at(b) { var x = 0; for (var i = 0; i < ferm.length; i++) if (ferm[i] <= b + 1e-6) x += 0.8; return (b + x) * spb; }
    var parts = {}, ev = [];
    L.forEach(function (ln) { Object.keys(ln.notes).forEach(function (p) { parts[p] = true; }); });
    Object.keys(parts).forEach(function (p) {
      if (opts.melodyOnly && p !== melody) return;
      var seq = [];
      L.forEach(function (ln) { (ln.notes[p] || []).forEach(function (n) { seq.push({ b: ln.startBeat + n.beat, beats: n.beats, n: n, bs: [ln.startBeat + n.beat] }); }); });
      for (var i = 0; i < seq.length - 1; i++) {                   // a tie sounds once
        while (seq[i].n.tie && seq[i + 1] && seq[i + 1].n.deg === seq[i].n.deg && Math.abs(seq[i + 1].b - seq[i].b - seq[i].beats) < 1e-6) {
          seq[i].beats += seq[i + 1].beats; seq[i].bs.push(seq[i + 1].b); seq[i].n = { tie: seq[i + 1].n.tie, deg: seq[i + 1].n.deg, monzo: seq[i].n.monzo, comma: seq[i].n.comma };
          seq.splice(i + 1, 1);
        }
      }
      var hzOf = function (n) {
        var m = n.monzo;
        if (opts.fixed && n.comma) m = [m[0] - COMMA[0] * n.comma, m[1] - COMMA[1] * n.comma, m[2] - COMMA[2] * n.comma, m[3]];
        return key * ratio(m);
      };
      seq.forEach(function (x, k) {
        var t = at(x.b), end = at(x.b + x.beats), hz = hzOf(x.n), nx = seq[k + 1];
        ev.push({ t: t, dur: Math.max(0.06, end - t), hz: hz, part: p, mel: p === melody,
                  bs: x.bs.map(function (v) { return Math.round(v * 1000) / 1000; }),
                  lift: !!(nx && Math.abs(nx.b - x.b - x.beats) < 1e-6 && Math.abs(hzOf(nx.n) - hz) < 0.01) });
      });
    });
    ev.sort(function (a, b) { return a.t - b.t; });
    return ev;
  }

  function lightsOff() {
    document.querySelectorAll(".etl svg .hi").forEach(function (g) { g.classList.remove("hi"); });
  }
  function light(e, on) {
    if (!e.scope) return;
    if (!e.el) {
      e.el = [];
      e.bs.forEach(function (b) {
        var q = e.scope.querySelectorAll('g.nt[data-p="' + e.part + '"][data-b="' + b + '"]');
        for (var i = 0; i < q.length; i++) e.el.push(q[i]);
      });
    }
    for (var i = 0; i < e.el.length; i++) e.el[i].classList.toggle("hi", on);
  }

  // stop: fade the session out over 25 ms, then silence every oscillator, so
  // a stop (or a switch to another tune mid-note) never clicks
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (ctx && session) {
      var now = ctx.currentTime, S = session;
      if (clock) clock.stop();
      S.gain.gain.setValueAtTime(1, now);
      S.gain.gain.linearRampToValueAtTime(0, now + FADE);
      live = live.filter(function (r) {
        if (r.t > now + FADE) {                                    // never began: drop it now
          try { r.o.onended = null; r.o.stop(); r.o.disconnect(); r.g.disconnect(); } catch (x) {}
          return false;
        }
        try { r.o.stop(now + FADE + 0.005); } catch (x) {}
        return true;
      });
      quietUntil = now + FADE + 0.005;
      setTimeout(function () { S.nodes.forEach(function (n) { try { n.disconnect(); } catch (x) {} }); }, 250);
      session = null;
    }
    if (playing && playing.card) playing.card.classList.remove("is-playing");
    lightsOff();
    document.querySelectorAll(".etl-btn.is-on").forEach(function (b) { b.classList.remove("is-on"); });
    playing = null;
    nowEl.textContent = "";
  }

  // play one or more hymns back to back; `scope` elements light the notes
  function play(seq, card, btn, label) {
    stop(); ensureCtx();
    if (ctx.state === "suspended") ctx.resume();
    session = openSession();
    var t0 = Math.max(ctx.currentTime + 0.12, quietUntil + 0.01), all = [], off = t0;
    seq.forEach(function (item) {
      var ev = eventsOf(item.h, item.opts), end = off;
      ev.forEach(function (e) { e.t += off; e.scope = item.scope; all.push(e); end = Math.max(end, e.t + e.dur); });
      off = end + 0.9;
    });
    all.sort(function (a, b) { return a.t - b.t; });
    if (clock) {                                                   // handed over a few hundred ms ahead, never all at once
      var lane = clock.lane("notes");
      all.forEach(function (e) { lane.at(e.t, function (t) { voice(t, e); }); });
      clock.start();
    } else {
      all.forEach(function (e) { voice(e.t, e); });
    }
    playing = { card: card, events: all, end: off, label: label, idx: 0, on: [] };
    if (card) card.classList.add("is-playing");
    if (btn) btn.classList.add("is-on");
    nowEl.textContent = "playing " + label;
    api.lastEvents = all;
    timer = setInterval(function () {                              // visual only: the notes that are sounding
      if (!playing) return;
      var now = ctx.currentTime, P = playing;
      if (now > P.end) { stop(); return; }
      if (!followEl.checked) { if (P.on.length) { P.on.forEach(function (e) { light(e, false); }); P.on = []; } return; }
      while (P.idx < P.events.length && P.events[P.idx].t <= now) { light(P.events[P.idx], true); P.on.push(P.events[P.idx]); P.idx++; }
      P.on = P.on.filter(function (e) { if (now >= e.t + e.dur) { light(e, false); return false; } return true; });
    }, 50);
  }

  // ---- the page ------------------------------------------------------------------------
  var listEl = document.getElementById("etl-tunes"), pickEl = document.getElementById("etl-pick");
  var nowEl = document.getElementById("etl-now"), followEl = document.getElementById("etl-follow");
  var melEl = document.getElementById("etl-melody"), tempoEl = document.getElementById("etl-tempo"), tempoOut = document.getElementById("etl-tempo-out");
  var fixedEl = document.getElementById("etl-fixed");
  function opts() { return { tempo: +tempoEl.value, melodyOnly: melEl.checked, fixed: !!(fixedEl && fixedEl.checked) }; }

  var ordered = SEVEN.map(function (id) { return TUNES.byId(id); }).filter(Boolean)
    .concat(TUNES.list.filter(function (h) { return SEVEN.indexOf(h.id) < 0; }));

  function srcLine(s, lead) {
    if (!s) return "";
    return '<p class="etl-src">' + lead + ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.book) + "</a>, " +
      esc(s.year) + ", " + (typeof s.page === "number" ? "p. " + s.page : esc(s.page)) +
      (s.tuneName ? ', where the tune is printed as <b>' + esc(s.tuneName) + "</b>" : "") +
      (s.note ? '<br><span class="etl-x">' + esc(s.note) + "</span>" : "") + "</p>";
  }

  // whether the Latter-day Saints sing this tune (Hymn.lds, kolob-tunes.js): each
  // hymn number links to its Gospel Library page; the note and the numbered
  // sources ride below in small type
  function ldsLine(h) {
    var L = h.lds;
    if (!L) return '<p class="etl-src etl-lds"><b>LDS hymnal:</b> <span class="etl-x">not yet checked</span></p>';
    function hymns(arr) {
      return arr.map(function (x) {
        return '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">#' + esc(x.number) + " “" + esc(x.title) + "”</a>";
      }).join(", ");
    }
    var a = L.hymns1985, b = L.homeAndChurch, out = [];
    if (a.length) out.push(hymns(a) + " (<i>Hymns</i>, 1985)");
    if (b.length) out.push(hymns(b) + ' (<i class="etl-nw">Hymns—For Home and Church</i>)');
    var head = out.length
      ? "<b>LDS hymnal:</b> " + out.join(" · ") + (a.length ? "" : " · not in <i>Hymns</i> (1985)")
      : '<b>Not in the LDS hymnal</b> (<i>Hymns</i>, 1985) or <i class="etl-nw">Hymns—For Home and Church</i> (as released by <span class="etl-nw">' + esc(L.checked) + "</span>)";
    var src = L.sources.map(function (u, i) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + (i + 1) + "</a>"; }).join(" ");
    return '<p class="etl-src etl-lds">' + head + '<br><span class="etl-x">' + (L.other ? esc(L.other) + " " : "") +
      "Sources " + src + ' · checked <span class="etl-nw">' + esc(L.checked) + "</span></span></p>";
  }

  // the tune the page is showing: the picker's choice, kept in the URL hash
  // (#t-<slug>) so a reload lands on the same tune
  function slugOf(h) { return h.id.split(":")[1]; }
  function current() {
    var want = (location.hash || "").replace(/^#t-/, ""), hit = null;
    ordered.forEach(function (h) { if (slugOf(h) === want) hit = h; });
    return hit || ordered[0];
  }
  function fillPicker() {
    var html = ['<optgroup label="The seven, re-transcribed (v0.30 carried these as incipits)">'];
    ordered.forEach(function (h, i) {
      if (i === SEVEN.length) html.push('</optgroup><optgroup label="Added: public-domain tunes of Kolob\'s families">');
      html.push('<option value="' + esc(slugOf(h)) + '">' + esc(h.nameEn) + "</option>");
    });
    html.push("</optgroup>");
    pickEl.innerHTML = html.join("");
  }

  // one card: the selected tune's information, its player (play, stop, and
  // for the seven a version menu), the engraving, and the transcriber's notes
  function render() {
    stop();
    var o = opts(), html = [], h = current(), i = ordered.indexOf(h);
    pickEl.value = slugOf(h);
    var L = h.lines.concat(h.refrain || []), parts = Object.keys(L[0].notes);
    html.push('<section class="etl-card" id="t-' + slugOf(h) + '" data-id="' + esc(h.id) + '">');
    html.push("<h2>" + esc(h.nameEn) + '<span class="etl-ds">' + esc(h.nameDs) + "</span></h2>");
    html.push('<p class="etl-meta"><b>' + esc(h.engrave.sourceKey) + "</b> · " + esc(h.meter) + " · " + esc(h.modeOfTime) +
      " · Kolob mode <b>" + esc(h.mode) + "</b>" + (h.melodyMode && h.melodyMode !== h.mode ? " (the melody alone: " + esc(h.melodyMode) + ")" : "") +
      " · dialect " + esc(h.dialect) + " · form " + esc(h.form) +
      " · " + L.length + " lines · parts " + parts.join(" ") + " (melody " + h.melodyPart + ")</p>");
    var tu = h.tuning;
    if (tu && tu.onsets) html.push('<p class="etl-meta etl-tune">Just intonation: ' +
      (tu.sourBefore ? tu.sourBefore + " of " + tu.onsets + " chords would sound a sour third, sixth or fifth on the fixed degrees; " + tu.moved + " notes lean a comma (<b>+</b> / <b>−</b>) and " +
        (tu.sourAfter ? tu.sourAfter + " passing chords stay sour (a held note is never re-tuned)." : "every chord is just.")
        : "every chord is just on the fixed degrees; no note needs a comma.") + "</p>");
    html.push(srcLine(h.source, "Source:"));
    (h.crossCheck || []).forEach(function (c) { html.push(srcLine(c, "Cross-check:")); });
    html.push(ldsLine(h));
    html.push('<div class="etl-ctl"><button type="button" class="etl-btn" data-act="play">play</button>' +
      '<button type="button" class="etl-btn" data-act="stop">stop</button>' +
      '<span class="etl-ver"><label class="etl-ver-label" for="etl-ver">version</label><select class="etl-select" id="etl-ver"' + (OLD[h.id] ? "" : " disabled") + ">" +
      '<option value="new">new transcription</option>' +
      (OLD[h.id] ? '<option value="old">v0.30 incipit</option><option value="ab">v0.30, then the new first lines</option>' : "") +
      "</select></span>" +
      '<span class="etl-hint">' + (OLD[h.id] ? "" : "added tune: no v0.30 version · ") + (o.melodyOnly ? "melody only" : "all parts the book prints") + "</span></div>");
    html.push('<div class="etl-score etl-new">' + engraveTune(h, o) + "</div>");
    if (OLD[h.id]) html.push('<div class="etl-score etl-old" hidden><p class="etl-old-cap">v0.30 incipit, on the same staff and in the same key (its rhythm in plain beats)</p>' + engraveTune(oldHymn(h), { melodyOnly: true }) + "</div>");
    html.push('<details class="etl-notes" open><summary>transcriber\'s notes</summary><p>' + esc(h.notes).replace(/\. /g, ".</p><p>") + "</p></details>");
    html.push("</section>");
    listEl.innerHTML = html.join("");
  }

  // the version menu decides which engraving shows: the new tune, v0.30's
  // incipit, or both (for "v0.30, then the new first lines")
  function showVersion(card, v) {
    var newEl = card.querySelector(".etl-new"), oldEl = card.querySelector(".etl-old");
    if (newEl) newEl.hidden = v === "old";
    if (oldEl) oldEl.hidden = v === "new";
  }

  listEl.addEventListener("click", function (ev) {
    var btn = ev.target.closest("button[data-act]"); if (!btn) return;
    var card = btn.closest(".etl-card"), h = TUNES.byId(card.getAttribute("data-id")), o = opts();
    var act = btn.getAttribute("data-act");
    if (act === "stop") { stop(); return; }
    var verEl = card.querySelector("#etl-ver"), v = verEl && !verEl.disabled ? verEl.value : "new";
    var newEl = card.querySelector(".etl-new"), oldEl = card.querySelector(".etl-old");
    showVersion(card, v);
    if (v === "old") {
      play([{ h: oldHymn(h), opts: { tempo: o.tempo, melodyOnly: true }, scope: oldEl }], card, btn, h.nameEn + " — v0.30 incipit");
    } else if (v === "ab") {
      var firstTwo = { id: h.id, beatS: h.beatS, melodyPart: h.melodyPart, engrave: h.engrave, lines: h.lines.slice(0, 2), refrain: null };
      play([{ h: oldHymn(h), opts: { tempo: o.tempo, melodyOnly: true }, scope: oldEl }, { h: firstTwo, opts: { tempo: o.tempo, melodyOnly: true }, scope: newEl }],
           card, btn, h.nameEn + " — v0.30, then the new first lines");
    } else {
      play([{ h: h, opts: o, scope: newEl }], card, btn, h.nameEn);
    }
  });
  listEl.addEventListener("change", function (ev) {
    if (ev.target.id !== "etl-ver") return;
    stop(); showVersion(ev.target.closest(".etl-card"), ev.target.value);
  });
  pickEl.addEventListener("change", function () {
    history.replaceState(null, "", "#t-" + pickEl.value);
    render();
  });
  window.addEventListener("hashchange", render);
  tempoEl.addEventListener("input", function () { tempoOut.textContent = (+tempoEl.value).toFixed(2) + "×"; });
  melEl.addEventListener("change", render);
  if (fixedEl) fixedEl.addEventListener("change", render);

  var api = { tunes: ordered, render: render, stop: stop, play: play, eventsOf: eventsOf, oldHymn: oldHymn, keynoteHz: keynoteHz, engraveTune: engraveTune,
              liveCount: function () { return live.length; } };
  fillPicker();
  render();
  return api;
})();

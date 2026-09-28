// ============================================================================
// HYMN LAB (dev only; see hymn-lab.php) — the owner's listening checkpoint.
//
// Compose: KOLOB.Composer.compose(PJ2.Rand.stream(seed), {dialect, mode,
// meter, hymnist, keyMonzo, gestures}) — the gestures are the day's theme,
// drawn by the motif engine from the same seed, so the hymn shares its
// opening shape with the meeting's material (PLAN §4 step 4).
// Engrave: each line a system, the way the dialect's books print it — the
// Tabernacle in closed score (soprano and alto on the treble staff, tenor and
// bass on the bass staff), the Sacred Harp in open score with the tune in
// the tenor and four shapes for the four syllables, the Old Way one staff
// with the singers' ornament places marked. Spelled on the white keys of
// the mode (a major hymn in C, an aeolian one on A), whatever the day's key.
// Sing: thirty-two people (KOLOB.VoicesVocal.singer, the round-1 full ward),
// eight to a part — the Sacred Harp doubling treble and tenor in octaves,
// the Old Way all on the tune with its own ornaments after the precentor's
// line — and the organ (KOLOB.VoicesOrgan) under the Tabernacle only; through
// the voices lab's master chain and a limiter (never louder than the app).
// ============================================================================
(function () {
  "use strict";
  var K = window.KOLOB || {};
  var errEl = document.getElementById("khl-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent += msg + "\n"; }
  window.addEventListener("error", function (e) { showErr("JS error: " + e.message + " @ " + String(e.filename || "").split("/").pop() + ":" + e.lineno); });
  var need = { Composer: K.Composer, Dialects: K.Dialects, Hymnists: K.Hymnists, Score: K.Score, VoicesVocal: K.VoicesVocal, VoicesOrgan: K.VoicesOrgan, Rand: window.PJ2 && PJ2.Rand };
  for (var nm in need) if (!need[nm]) { showErr(nm + " did not load."); return; }
  var C = K.Composer, D = K.Dialects, HS = K.Hymnists, V = K.VoicesVocal;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function f1(v) { return Math.round(v * 10) / 10; }
  function pct(v) { return Math.round(v * 100) + "%"; }

  // ==========================================================================
  // THE CONTROLS
  // ==========================================================================
  var MODES = [["", "any (the dialect draws)"], ["ionian", "ionian (major)"], ["mixolydian", "mixolydian"], ["dorian", "dorian"], ["aeolian", "aeolian (minor)"], ["penta", "pentatonic"], ["hexa", "hexatonic"]];
  var METER_NAMES = { "CM": "CM 8.6.8.6", "LM": "LM 8.8.8.8", "SM": "SM 6.6.8.6", "CMD": "CMD (doubled)", "87.87": "8.7.8.7", "87.87D": "8.7.8.7 D", "76.76D": "7.6.7.6 D", "11s": "11s (11.11.11.11)", "10.10R": "10.10 with refrain" };
  var KEYS = [["0,0,0,0", "do on the keynote"], ["2,-1,0,0", "up a just fourth (4/3)"], ["-1,1,0,0", "up a just fifth (3/2)"], ["1,-1,0,0", "down a fourth (2/3)"], ["-2,1,0,0", "down a fifth (3/4)"]];
  function fill(sel, pairs) { sel.innerHTML = pairs.map(function (p) { return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + "</option>"; }).join(""); }
  fill($("khl-mode"), MODES);
  fill($("khl-meter"), [["", "any (the dialect draws)"]].concat(Object.keys(C.METERS).map(function (m) { return [m, METER_NAMES[m] || m]; })));
  fill($("khl-hymnist"), [["", "any (drawn by the dialect)"]].concat(HS.list.map(function (h) { return [h.id, h.nameEn + " · " + h.nameDs]; })));
  fill($("khl-key"), KEYS);
  // a link can carry the settings: ?seed=12&dialect=sacredharp&mode=aeolian&play
  var Q = new URLSearchParams(location.search);
  if (Q.get("seed")) $("khl-seed").value = Q.get("seed");
  ["dialect", "mode", "meter", "hymnist"].forEach(function (k) { if (Q.get(k) != null) $("khl-" + k).value = Q.get(k); });
  $("khl-tempo").addEventListener("input", function () { $("khl-tempo-out").textContent = (+this.value).toFixed(2) + "×"; });

  var KEYNOTE_HZ = 261.63;                 // the day's keynote, about middle C (the app's F0 · 4)
  var hymn = null, seedNow = null;

  // the day's theme, as the motif engine draws it from the same seed: the
  // composer lays its shape on the hymn's first line (step 4)
  function dayTheme(seed) {
    try {
      var M = K.Melody && K.Melody.Motif;
      if (!M) return null;
      M.newMeeting({ activity: "ordinary", seasonPos: 0.5 }, PJ2.Rand.stream(seed).fork("motif:1"));
      var th = M.theme(), st = M.stats();
      return th ? { degs: th.notes.map(function (n) { return n.deg; }), name: st.working && st.working.gesture } : null;
    } catch (e) { return null; }
  }

  function settings() {
    return {
      seed: Math.max(1, Math.floor(+$("khl-seed").value || 1)),
      dialect: $("khl-dialect").value, mode: $("khl-mode").value || undefined, meter: $("khl-meter").value || undefined,
      hymnist: $("khl-hymnist").value || undefined,
      keyMonzo: $("khl-key").value.split(",").map(Number),
    };
  }
  function compose() {
    stop();
    var s = settings(), th = dayTheme(s.seed);
    var t0 = performance.now();
    try {
      hymn = C.compose(PJ2.Rand.stream(s.seed), { dialect: s.dialect, mode: s.mode, meter: s.meter, hymnist: s.hymnist, keyMonzo: s.keyMonzo,
                                                  gestures: th ? [th.degs] : null, id: "h:1:1" });
    } catch (e) { showErr("compose failed: " + e.message); return; }
    hymn._ms = Math.round(performance.now() - t0);
    hymn._theme = th;
    seedNow = s.seed;
    render();
    $("khl-playbtn").disabled = false;
    $("khl-organ").disabled = !D.get(hymn.dialect).organ;
    $("khl-lined").disabled = hymn.dialect !== "oldway";
  }
  $("khl-compose").addEventListener("click", compose);
  $("khl-another").addEventListener("click", function () { $("khl-seed").value = (Math.floor(+$("khl-seed").value) || 0) + 1; compose(); });
  $("khl-dialect").addEventListener("change", function () { $("khl-spreadout").innerHTML = ""; });

  // ==========================================================================
  // THE CARD, THE CHECKS, THE MEASUREMENTS, THE PLAN
  // ==========================================================================
  var DIALECT_NAME = { tabernacle: "C · Tabernacle", sacredharp: "A · Sacred Harp", oldway: "F · The Old Way" };
  var MODE_NAME = { ionian: "ionian (major)", mixolydian: "mixolydian", dorian: "dorian", aeolian: "aeolian (minor)", penta: "pentatonic", hexa: "hexatonic" };
  function render() {
    var h = hymn, r = h.report, Dl = D.get(h.dialect);
    var bpm = Math.round(60 / h.beatS);
    $("khl-hymn").innerHTML =
      '<div class="khl-board"><span class="khl-num">' + h.number + '</span><span class="khl-name">' + esc(h.nameDs) + '</span><span class="khl-en">' + esc(h.nameEn) + " (dev)</span></div>" +
      '<p class="khl-meta"><b>' + esc(DIALECT_NAME[h.dialect]) + "</b> · " + esc(METER_NAMES[h.meter] || h.meter) + " · form " + esc(h.form) + " · " + esc(MODE_NAME[h.mode]) +
      " · " + esc(h.modeOfTime) + " at " + bpm + " beats a minute · " + (h.hymnist ? "by " + esc(h.hymnist.nameDs) + ' <span class="khl-en">' + esc(h.hymnist.nameEn) + "</span>" : "") +
      (r.frame.alto ? " · with an alto" : h.dialect === "sacredharp" ? " · three parts (no alto)" : "") + "</p>" +
      '<p class="khl-about">' + esc(Dl.about) + (h._theme && h._theme.name ? " · first line seeded from the day's theme, “" + esc(h._theme.name) + "”" : "") + " · composed in " + h._ms + " ms</p>" +
      '<div class="khl-score" id="khl-scorebox">' + engrave(h) + "</div>";
    // the checks
    $("khl-checks").innerHTML = r.checks.map(function (c) {
      return '<li class="' + (c.ok ? "ok" : c.hard ? "no" : "soft") + '">' + esc(c.name) + " <small>— " + esc(c.detail) + "</small></li>";
    }).join("") + (r.repairs.length ? '<li class="soft">repaired <small>— ' + esc(r.repairs.map(function (x) { return "round " + x.round + ": " + x.failed.join(", "); }).join("; ")) + "</small></li>" : "");
    // the fingerprint against the dialect's Earth tunes
    var refs = C.references()[h.dialect], fp = r.fingerprint, tol = refs.tolerance;
    if ((h.mode === "aeolian" || h.mode === "dorian") && tol.minor) { var t2 = {}; for (var k in tol) t2[k] = tol[k]; for (k in tol.minor) t2[k] = tol.minor[k]; tol = t2; }
    var ROWS = [["par5", "moves with parallel fifths"], ["thirdless", "chords with no third"], ["crossing", "chords with parts crossed"], ["chromatic", "chromatic notes"],
                ["sevenths", "chords with a seventh"], ["leap", "melody leaps (a third or more)"], ["melisma", "melody notes slurred"], ["melodyRange", "melody's compass (steps)"]];
    $("khl-fp").innerHTML = '<table class="khl-table"><tr><th>measure</th><th>this hymn</th><th>Earth tunes (' + refs.tunes.length + ")</th><th>tolerance</th></tr>" +
      ROWS.map(function (row) {
        var v = row[0] === "melodyRange" ? fp.melodyRange : fp.share[row[0]], t = tol[row[0]], ref = refs.mean[row[0]];
        var inT = !t || (v >= t[0] - 1e-9 && v <= t[1] + 1e-9);
        var show = function (x) { return row[0] === "melodyRange" ? x : pct(x); };
        return "<tr><td>" + esc(row[1]) + '</td><td class="num ' + (inT ? "in" : "out") + '">' + show(v) + '</td><td class="num">' + show(ref) + '</td><td class="num">' + (t ? show(t[0]) + "–" + show(t[1]) : "") + "</td></tr>";
      }).join("") +
      '<tr><td>cadences</td><td colspan="3">' + esc(Object.keys(fp.cadences).map(function (c) { return c + " " + fp.cadences[c]; }).join(" · ")) + "</td></tr>" +
      '<tr><td>parts\' compass</td><td colspan="3">' + esc(Object.keys(fp.range).map(function (p) { return p + " " + fp.range[p]; }).join(" · ")) + " steps</td></tr></table>" +
      '<p class="khl-cap">Earth tunes: ' + esc(refs.tunes.map(function (t) { return t.id.replace("earth:", "").toUpperCase(); }).join(", ")) + "</p>";
    // the plan
    $("khl-plan").innerHTML = '<table class="khl-table"><tr><th>line</th><th>role</th><th>cadence planned</th><th>ending (drawn first)</th><th>contour</th><th>rhythm cell</th><th>search</th></tr>' +
      r.lines.map(function (L, i) {
        return "<tr><td>" + (i + 1) + " · " + esc(L.letter) + (L.copyOf ? " (= " + L.copyOf + ")" : "") + (r.peak.line === i + 1 ? " ★" : "") + "</td><td>" + esc(L.role) + "</td><td>" + esc(L.cadence) + " on " + solName(L.target, h.mode) +
               "</td><td>" + esc(L.figure) + "</td><td>" + esc(L.contour) + "</td><td>" + esc(L.cell) + '</td><td class="num">' + (L.copyOf ? "copied" : "cost " + L.searchCost + ", top-8 differ by " + L.topSpread) + "</td></tr>";
      }).join("") + "</table>" +
      '<p class="khl-cap">★ the peak: ' + r.peak.stepsOverFinal + " steps over the final, at " + pct(r.peak.at) + " of the tune (planned 60–75%). Compass " + r.peak.span + " steps.</p>";
    listenNote(h);
  }
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  function solName(cl, mode) { var d = C.doOf(mode); return SOLF[((cl - d) % 7 + 7) % 7]; }

  // ==========================================================================
  // THE ENGRAVER — each line of the hymn a system
  // ==========================================================================
  var LET = "CDEFGAB", LET_SEMI = [0, 2, 4, 5, 7, 9, 11];
  var FINAL_LETTER = { ionian: 0, penta: 0, hexa: 0, mixolydian: 4, dorian: 1, aeolian: 5 };
  var SP = 8;
  var CLEF = { treble: { bottom: 30, label: "G" }, treble8: { bottom: 30, label: "G", sub: "8", shift: 7 }, bass: { bottom: 18, label: "F" } };
  var SHAPES = ["fa", "sol", "la", "fa", "sol", "la", "mi"];            // four shapes: do re mi fa sol la ti
  function monzoCents(m) { return 1200 * (m[0] + m[1] * Math.log2(3) + m[2] * Math.log2(5) + m[3] * Math.log2(7)); }
  // the final's staff step: its letter, in the octave nearest the day's key
  function finalStep(h) {
    var L = FINAL_LETTER[h.mode] || 0, ks = Math.round(monzoCents(h.keyMonzo) / 100), best = 0, bd = 1e9;
    for (var o = -2; o <= 2; o++) { var d = Math.abs(12 * o + LET_SEMI[L] - ks); if (d < bd) { bd = d; best = o; } }
    return 7 * (4 + best) + L;
  }
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
  function staffY(clef, step, top) { return top + 4 * SP - (step + (CLEF[clef].shift || 0) - CLEF[clef].bottom) * SP / 2; }
  // the staves each dialect prints, top to bottom: [[clef, [parts], label]]
  function layoutOf(h) {
    if (h.dialect === "tabernacle") return [["treble", ["S", "A"], "S · A"], ["bass", ["T", "B"], "T · B"]];
    if (h.dialect === "oldway") return [["treble", ["S"], "the tune"]];
    var out = [["treble", ["S"], "Treble"]];
    if (h.lines[0].notes.A) out.push(["treble", ["A"], "Alto"]);
    out.push(["treble8", ["T"], "Tenor ★"], ["bass", ["B"], "Bass"]);
    return out;
  }
  function headSvg(x, y, open, shape) {
    var cls = "hd" + (open ? " op" : "");
    if (!shape) return '<ellipse class="' + cls + '" cx="' + f1(x) + '" cy="' + f1(y) + '" rx="5" ry="3.6" transform="rotate(-20 ' + f1(x) + " " + f1(y) + ')"/>';
    if (shape === "fa") return '<path class="' + cls + '" d="M' + f1(x - 5.5) + " " + f1(y + 3.8) + " L" + f1(x + 5.5) + " " + f1(y + 3.8) + " L" + f1(x + 5.5) + " " + f1(y - 3.8) + ' Z"/>';
    if (shape === "la") return '<rect class="' + cls + '" x="' + f1(x - 5) + '" y="' + f1(y - 3.6) + '" width="10" height="7.2"/>';
    if (shape === "mi") return '<path class="' + cls + '" d="M' + f1(x) + " " + f1(y - 4.4) + " L" + f1(x + 5.5) + " " + f1(y) + " L" + f1(x) + " " + f1(y + 4.4) + " L" + f1(x - 5.5) + " " + f1(y) + ' Z"/>';
    return '<ellipse class="' + cls + '" cx="' + f1(x) + '" cy="' + f1(y) + '" rx="5.3" ry="3.8"/>';                 // sol: round
  }
  function engraveLine(h, line, rowIdx, label) {
    var T = h.modeOfTime.split("/"), barBeats = +T[0], den = +T[1];
    var staves = layoutOf(h), step0 = finalStep(h), doOf = C.doOf(h.mode);
    var minBeats = 99, span = 0;
    Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { minBeats = Math.min(minBeats, n.beats); span = Math.max(span, n.beat + n.beats); }); });
    var unit = Math.max(30 * Math.pow(4 / den, 0.75), 19 / minBeats);
    var head = 30 + (rowIdx === 0 ? 20 : 0) + 22;
    var W = Math.ceil(head + span * unit + 22), staffH = 4 * SP, pad = 34;
    var romanRow = line.chords && line.chords.length ? 16 : 0, sylRow = h.dialect === "sacredharp" ? 14 : 0;
    var H = staves.length * (staffH + 2 * pad) + romanRow + sylRow + 6;
    var out = ['<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(label) + '">'];
    staves.forEach(function (sv, si) {
      var clef = sv[0], parts = sv[1].filter(function (p) { return line.notes[p]; }), top = si * (staffH + 2 * pad) + pad;
      for (var k = 0; k < 5; k++) out.push('<line class="st" x1="4" x2="' + (W - 4) + '" y1="' + (top + k * SP) + '" y2="' + (top + k * SP) + '"/>');
      if (rowIdx === 0) out.push('<text class="tx" x="6" y="' + (top - 10) + '" font-size="10">' + esc(sv[2]) + "</text>");
      var cy = clef === "bass" ? top + SP : top + 3 * SP;
      out.push('<text class="tx" x="8" y="' + (cy + 5) + '" font-size="15" font-weight="600">' + CLEF[clef].label + "</text>");
      if (CLEF[clef].sub) out.push('<text class="tx" x="10" y="' + (top + 4 * SP + 11) + '" font-size="8">8</text>');
      if (rowIdx === 0) {
        out.push('<text class="tx" x="30" y="' + (top + 2 * SP - 1) + '" font-size="13" font-weight="600">' + barBeats + "</text>");
        out.push('<text class="tx" x="30" y="' + (top + 4 * SP - 1) + '" font-size="13" font-weight="600">' + den + "</text>");
      }
      // barlines
      var bs = line.barStart || 0;
      for (var b = (barBeats - bs % barBeats) % barBeats; b <= span + 1e-6; b += barBeats) {
        if (b <= 1e-6) continue;
        var bx = f1(head + b * unit - 4);
        out.push('<line class="bl" x1="' + bx + '" x2="' + bx + '" y1="' + top + '" y2="' + (top + 4 * SP) + '"/>');
      }
      parts.forEach(function (p, pi) {
        var two = parts.length === 2, up = two ? pi === 0 : null;
        var ns = line.notes[p], prevX = null, prevY = null, accs = {};
        ns.forEach(function (n, ni) {
          var step = step0 + n.deg, y = staffY(clef, step, top);
          var x = head + n.beat * unit + 9;
          // a second between the two voices on one staff: the lower head steps aside
          if (two && pi === 1) {
            var other = line.notes[parts[0]].filter(function (o) { return Math.abs(o.beat - n.beat) < 1e-6; })[0];
            if (other && Math.abs(other.deg - n.deg) === 1) x += 9;
          }
          var g = glyphOf(n.beats / den), lineIdx = step + (CLEF[clef].shift || 0) - CLEF[clef].bottom;
          var stemUp = up != null ? up : lineIdx < 4;
          out.push('<g class="nt" data-p="' + p + '" data-b="' + f1(((line.startBeat || 0) + n.beat) * 1000) / 1000 + '">');
          for (var ls = -2; ls >= lineIdx; ls -= 2) out.push('<line class="st" x1="' + f1(x - 8) + '" x2="' + f1(x + 8) + '" y1="' + f1(y + (lineIdx - ls) * SP / 2) + '" y2="' + f1(y + (lineIdx - ls) * SP / 2) + '"/>');
          for (ls = 10; ls <= lineIdx; ls += 2) out.push('<line class="st" x1="' + f1(x - 8) + '" x2="' + f1(x + 8) + '" y1="' + f1(y + (lineIdx - ls) * SP / 2) + '" y2="' + f1(y + (lineIdx - ls) * SP / 2) + '"/>');
          // accidentals (white-key spelling: only an altered degree, or its return)
          var barNo = Math.floor(((line.barStart || 0) + n.beat + 1e-6) / barBeats), key = barNo + ":" + step, alt = n.alt || 0;
          if (alt || accs[key]) {
            if ((accs[key] || 0) !== alt) out.push('<text class="ac" x="' + f1(x - 16) + '" y="' + f1(y + 4) + '" font-size="12">' + (alt > 0 ? "♯" : alt < 0 ? "♭" : "♮") + "</text>");
            accs[key] = alt;
          }
          if (n.comma) out.push('<text class="cm" x="' + f1(x - (alt ? 17 : 8)) + '" y="' + f1(y - 5) + '" font-size="9" text-anchor="end">' + (n.comma > 0 ? "+" : "−") + "</text>");
          var open = g.kind === "w" || g.kind === "h";
          var shape = h.dialect === "sacredharp" ? SHAPES[((n.deg - doOf) % 7 + 7) % 7] : null;
          out.push(headSvg(x, y, open, shape));
          if (g.dot) out.push('<circle class="hd" cx="' + f1(x + 9) + '" cy="' + f1(y - (lineIdx % 2 === 0 ? 2 : 0)) + '" r="1.4"/>');
          if (g.odd) out.push('<text class="tx" x="' + f1(x + 7) + '" y="' + f1(y - 6) + '" font-size="8">' + (Math.round(n.beats * 100) / 100) + "</text>");
          if (g.kind !== "w") {
            var sx = stemUp ? x + 4.6 : x - 4.6, sy2 = stemUp ? y - 3.5 * SP : y + 3.5 * SP;
            out.push('<line class="sm" x1="' + f1(sx) + '" x2="' + f1(sx) + '" y1="' + f1(y) + '" y2="' + f1(sy2) + '"/>');
            var nfl = g.kind === "e" ? 1 : g.kind === "s" ? 2 : 0;
            for (var fl = 0; fl < nfl; fl++) { var fy = sy2 + (stemUp ? fl * 5 : -fl * 5); out.push('<path class="fl" d="M' + f1(sx) + " " + f1(fy) + " q 6 " + (stemUp ? 5 : -5) + " 5 " + (stemUp ? 11 : -11) + '"/>'); }
          }
          if (n.fermata && (pi === 0 || !two)) { var fyy = Math.min(top - 6, y - 12); out.push('<path class="sl" d="M' + f1(x - 6) + " " + f1(fyy) + ' q 6 -8 12 0"/><circle class="hd" cx="' + f1(x) + '" cy="' + f1(fyy - 2) + '" r="1.2"/>'); }
          if (n.ornament) out.push('<text class="or" x="' + f1(x) + '" y="' + f1(Math.min(top - 4, y - 14)) + '" font-size="12" text-anchor="middle">' + (n.ornament === "turn" ? "∽" : n.ornament === "slide" ? "↗" : "ˇ") + "</text>");
          out.push("</g>");
          // slur into a melisma's note, or a tie from the note before
          var prev = ns[ni - 1];
          if (prev && ((p === h.melodyPart && n.syl === null && !prev.tie) || prev.tie)) {
            var yy = (stemUp ? Math.max(prevY, y) + 7 : Math.min(prevY, y) - 7);
            out.push('<path class="sl" d="M' + f1(prevX + 2) + " " + f1(yy) + " Q " + f1((prevX + x) / 2) + " " + f1(yy + (stemUp ? 6 : -6)) + " " + f1(x - 2) + " " + f1(yy) + '"/>');
          }
          prevX = x; prevY = y;
        });
      });
      // the shape-note syllables under the tune (Sacred Harp: the tenor)
      if (sylRow && sv[1][0] === "T") line.notes.T.forEach(function (n) {
        if (n.syl === null) return;
        out.push('<text class="rn" x="' + f1(head + n.beat * unit + 9) + '" y="' + (top + 4 * SP + pad - 8) + '" font-size="10" text-anchor="middle">' + SHAPES[((n.deg - doOf) % 7 + 7) % 7] + "</text>");
      });
    });
    // the chords, under the last staff
    if (romanRow) {
      var ry = staves.length * (staffH + 2 * pad) + sylRow + 2;
      line.chords.forEach(function (c) { out.push('<text class="rn" x="' + f1(head + c.beat * unit + 9) + '" y="' + ry + '" font-size="10" text-anchor="middle">' + esc(c.roman) + "</text>"); });
    }
    out.push("</svg>");
    return out.join("");
  }
  function engrave(h) {
    var L = h.lines.map(function (l, i) { return [l, "line " + (i + 1) + " · " + l.plan.letter + " · " + l.cadence.kind]; });
    (h.refrain || []).forEach(function (l, i) { L.push([l, "refrain " + (i + 1) + " · " + l.cadence.kind]); });
    if (h.amen) L.push([h.amen, "the amen (after the last verse)"]);
    return L.map(function (x, i) {
      return '<div class="khl-row"><p class="khl-cap">' + esc(x[1]) + (x[0].peak ? " · the peak" : "") + "</p>" + engraveLine(h, x[0], i, x[1]) + "</div>";
    }).join("");
  }

  // ==========================================================================
  // THE ROOM — the voices lab's master chain (glue, master 0.6, tanh,
  // compressor) with a brick-wall limiter after it: never louder than the app
  // ==========================================================================
  var irBytes = null;
  var irReady = fetch("../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav")
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(function (b) { irBytes = b; }, function () { irBytes = null; });
  function pouredIR(ctx) {
    var len = Math.floor(ctx.sampleRate * 2.8), b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c), s = 12345 + c * 999; for (var i = 0; i < len; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = (s / 0x3fffffff - 1) * Math.pow(1 - i / len, 3.2) * 0.5; } }
    return b;
  }
  function chain(ctx) {
    var t = 0;
    function G(v) { var g = ctx.createGain(); g.gain.setValueAtTime(v, t); return g; }
    var layer = 0.8 * 1.1;
    var near = G(layer), hall = G(layer);
    var dry = G(1), wetIn = G(1), conv = ctx.createConvolver(), wet = G(0.9 * 0.85);
    var nd = G(1.0), nw = G(0.35), hd = G(0.72), hw = G(0.75);
    near.connect(nd); near.connect(nw); hall.connect(hd); hall.connect(hw);
    nd.connect(dry); hd.connect(dry); nw.connect(wetIn); hw.connect(wetIn);
    var bus = G(1);
    dry.connect(bus); wetIn.connect(conv); conv.connect(wet); wet.connect(bus);
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = G(0.6);
    var sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = curve; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var lim = ctx.createDynamicsCompressor();
    lim.threshold.setValueAtTime(-1.5, t); lim.knee.setValueAtTime(0, t); lim.ratio.setValueAtTime(20, t);
    lim.attack.setValueAtTime(0.002, t); lim.release.setValueAtTime(0.12, t);
    bus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(lim); lim.connect(ctx.destination);
    // a meter on the way out (for the silent checks: is the ward singing?)
    var meter = ctx.createAnalyser(); meter.fftSize = 2048; lim.connect(meter);
    var ready = irReady.then(function () {
      if (!irBytes) { conv.buffer = pouredIR(ctx); return; }
      return ctx.decodeAudioData(irBytes.slice(0)).then(function (buf) { conv.buffer = buf; }, function () { conv.buffer = pouredIR(ctx); });
    });
    return { near: near, hall: hall, ready: ready, out: lim, meter: meter };
  }

  // ==========================================================================
  // THE WARD — thirty-two people, eight to a part, each with a throat of
  // their own (voices-lab demo 2a, the owner's choice)
  // ==========================================================================
  function fullWard(seed) {
    var root = PJ2.Rand.stream(seed).fork("fullward"), people = [];
    ["S", "A", "T", "B"].forEach(function (part) {
      for (var k = 0; k < 8; k++) {
        var r = root.fork(part + ":" + k), base = { S: 0.30, A: -0.30, T: 0.45, B: -0.45 }[part] * 0.9;
        people.push({ part: part, k: k, appetite: r.rnd(0.3, 1), spread: r.rnd(0, 0.3), singer: V.singer({
          seed: seed, name: "ward-" + part + k, part: part, age: r.pick(["young", "mid", "mid", "old"]),
          confidence: r.rnd(0.45, 0.9), brightness: r.rnd(0.3, 0.65), breath: r.rnd(0.2, 0.55),
          pitchHabitCents: r.rnd(-12, 12), timingHabitMs: r.rnd(0, 70) + r.rnd(-10, 25), tractScale: r.rnd(0.95, 1.05),
          pan: Math.max(-0.9, Math.min(0.9, base + r.rnd(-0.3, 0.3))) }) });
      }
    });
    return people;
  }
  // who sings what, by dialect: [part of the Score, octave factor]
  function assignment(h, person) {
    var p = person.part, k = person.k;
    if (h.dialect === "oldway") return [h.melodyPart, p === "T" || p === "B" ? 0.5 : 1];
    if (h.dialect === "sacredharp") {
      // the treble and the tenor are doubled in octaves (six parts, really)
      if (p === "S") return k < 6 ? ["S", 1] : ["T", 2];
      if (p === "T") return k < 6 ? ["T", 1] : ["S", 0.5];
      if (p === "A") return h.lines[0].notes.A ? ["A", 1] : (k < 4 ? ["S", 1] : ["T", 2]);
      return ["B", 1];
    }
    return [p, 1];
  }

  // ==========================================================================
  // THE PERFORMANCE — the Score laid out in seconds, verse by verse
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function lineLen(h, line, i, all) {
    var nx = all[i + 1];
    if (nx && nx.startBeat != null && line.startBeat != null) return nx.startBeat - line.startBeat;
    return K.Score.lineLength(line);
  }
  // a line's clock: a fermata holds its note and moves everything after it
  function clockOf(line, beatS) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var mel = line.notes[Object.keys(line.notes)[0]], len = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  // every note of one part in one verse (and its refrain), in seconds from t0
  //   → { ev: [{t, dur, n, line, beatAbs}], end }
  function partEvents(h, part, t0, beatS, lines, after) {
    var ev = [], t = t0;
    lines.forEach(function (line, i) {
      var clk = clockOf(line, beatS), len = lineLen(h, line, i, after ? lines.concat([after]) : lines), ns = line.notes[part] || [];
      for (var k = 0; k < ns.length; k++) {
        var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
        while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
        var st = t + clk(b0), dur = clk(b1) - clk(b0);
        if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);   // the breath
        ev.push({ t: st, dur: dur, n: n, line: line, beatAbs: (line.startBeat || 0) + n.beat });
      }
      t += clk(len) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
    });
    return { ev: ev, end: t };
  }
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 2], ["oo", 1.5], ["eh", 1.5]];
  function vowelsFor(seed, verse, n) { var r = PJ2.Rand.stream(seed).fork("vowels:" + verse), out = []; for (var i = 0; i < n; i++) out.push(r.pickW(VOWELS)); return out; }
  function shapeOf(h, deg) { return SHAPES[((deg - C.doOf(h.mode)) % 7 + 7) % 7]; }
  // a person's line: the events as the singer takes them (f, vowel, slur, the rests between)
  function toSung(h, evs, t0, oct, vowelOf) {
    var out = [], t = t0, base = KEYNOTE_HZ * ratio(h.keyMonzo);
    evs.forEach(function (e) {
      if (e.t > t + 0.004) out.push({ rest: true, dur: e.t - t });
      out.push({ f: base * ratio(e.n.monzo) * oct, dur: e.dur, vowel: vowelOf(e), stress: e.n.stress, slur: e.n.syl === null, _e: e });
      t = e.t + e.dur;
    });
    return out;
  }
  // the Old Way's decorations, at the places the composer marked, by a
  // singer's own appetite (the performer's work, PLAN §3 F)
  function decorate(h, notes, r, appetite) {
    var out = [], base = KEYNOTE_HZ * ratio(h.keyMonzo);
    notes.forEach(function (x) {
      var d1 = r.rnd(0, 1), d2 = r.rnd(0, 1);
      if (x.rest || !x._e || !x._e.n.ornament || d1 > appetite) { out.push(x); return; }
      var n = x._e.n, oct = x.f / (base * ratio(n.monzo));
      function nb(step) { return base * ratio(C.spelledMonzo(h.mode, n.deg + step, 0)) * oct; }
      var c = function (o) { var y = {}; for (var k in x) y[k] = x[k]; for (k in o) y[k] = o[k]; return y; };
      if (n.ornament === "turn" && x.dur > 0.9) {
        var q = Math.min(0.2, x.dur * 0.1);
        if (d2 < 0.6) out.push(c({ dur: x.dur - 4 * q }), c({ f: nb(1), dur: q, slur: true }), c({ dur: q, slur: true }), c({ f: nb(-1), dur: q, slur: true }), c({ dur: q, slur: true }));
        else out.push(c({ dur: x.dur * 0.6 }), c({ f: nb(1), dur: x.dur * 0.22, slur: true, slide: true }), c({ dur: x.dur * 0.18, slur: true }));
      } else if (n.ornament === "slide") out.push(c({ slide: true }));
      else if (n.ornament === "grace" && x.dur > 0.4) out.push(c({ f: nb(1), dur: 0.1 }), c({ dur: x.dur - 0.1, slur: true }));
      else out.push(x);
    });
    return out;
  }

  var AC = null, timer = null, ROOM = null;
  // (for the silent checks) the level leaving the limiter, in dBFS, and the peak since the last read
  var peakSeen = 0;
  function level() {
    if (!AC || !ROOM) return { rms: -120, peak: 0 };
    var a = new Float32Array(ROOM.meter.fftSize); ROOM.meter.getFloatTimeDomainData(a);
    var s2 = 0, pk = 0; for (var i = 0; i < a.length; i++) { s2 += a[i] * a[i]; pk = Math.max(pk, Math.abs(a[i])); }
    return { rms: Math.round(10 * Math.log10(s2 / a.length + 1e-12) * 10) / 10, peak: Math.round(pk * 1000) / 1000, t: AC.currentTime };
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (AC) { var a = AC; AC = null; try { a.close(); } catch (e) { /* gone */ } }
    document.querySelectorAll("#khl-scorebox .hi").forEach(function (g) { g.classList.remove("hi"); });
    $("khl-stop").disabled = true;
    $("khl-now").textContent = "";
  }
  $("khl-stop").addEventListener("click", stop);
  // Everything is laid out in seconds first; then a small pump hands each
  // line to the singers and the organ a few seconds before it sounds (so a
  // long hymn never builds its whole graph at once, and Stop is instant).
  function play() {
    if (!hymn) return;
    stop();
    var h = hymn, Dl = D.get(h.dialect), seed = seedNow;
    var Ctor = window.AudioContext || window.webkitAudioContext;
    try { AC = new Ctor(); } catch (e) { showErr("no audio: " + e.message); return; }
    var ac = AC, room = chain(ac);
    ROOM = room;
    $("khl-stop").disabled = false;
    $("khl-now").textContent = "the ward is finding its seats…";
    room.ready.then(function () {
      if (AC !== ac) return;
      if (ac.state === "suspended" && ac.resume) ac.resume();
      var tempo = +$("khl-tempo").value, beatS = h.beatS / tempo, verses = +$("khl-verses").value;
      var withOrgan = Dl.organ && $("khl-organ").checked, lined = h.dialect === "oldway" && $("khl-lined").checked;
      var ward = fullWard(seed), T0 = ac.currentTime + 1.0, t = T0, marks = [], jobs = [], g1 = 1 / Math.sqrt(8);
      var verseLines = h.lines.concat(h.refrain || []), base = KEYNOTE_HZ * ratio(h.keyMonzo);
      var organ = withOrgan ? K.VoicesOrgan.create(ac, room.hall, { gain: 0.9, seed: seed, t0: T0 }) : null;
      function job(at, fn) { jobs.push({ at: at, fn: fn }); }
      // one line (lines[i]) at t0, by everyone who sings it; → the line's end
      function singLine(t0, lines, i, bs, vowelOf, opts) {
        opts = opts || {};
        var end = partEvents(h, h.melodyPart, t0, bs, [lines[i]], lines[i + 1]).end;
        job(t0, function () {
          ward.forEach(function (person) {
            var asg = assignment(h, person), off = opts.spread ? person.spread * bs * 0.6 : 0;
            var ev = partEvents(h, asg[0], t0 + off, bs, [lines[i]], lines[i + 1]).ev, lastV = "ah";
            var sung = toSung(h, ev, t0 + off, asg[1], function (e) { var v = vowelOf(e); if (v) lastV = v; return lastV; });
            if (opts.decorate) sung = decorate(h, sung, PJ2.Rand.stream(seed).fork("orn:" + person.part + person.k + ":" + opts.decorate), person.appetite);
            if (sung.length) person.singer.sing(ac, room.hall, t0 + off, sung, g1 * (opts.gain || 1));
          });
          if (organ && !opts.noOrgan) organLine(t0, lines, i, bs, opts.reg || "hymn principal");
        });
        ["S", "A", "T", "B"].forEach(function (p) {
          partEvents(h, p, t0, bs, [lines[i]], lines[i + 1]).ev.forEach(function (e) {
            marks.push({ t: e.t, end: e.t + e.dur, p: p, b: e.beatAbs, amen: lines[i] === h.amen, label: opts.label || "" });
          });
        });
        return end;
      }
      function organLine(t0, lines, i, bs, reg) {
        var notes = [];
        ["S", "A", "T", "B"].forEach(function (p) {
          partEvents(h, p, t0, bs, [lines[i]], lines[i + 1]).ev.forEach(function (e) { notes.push({ f: base * ratio(e.n.monzo), dur: e.dur, at: e.t - t0, pedal: p === "B", v: p === "S" ? 1 : 0.8 }); });
        });
        organ.play(t0, notes, reg);
      }
      // the organist gives out the tune: its last line, alone
      if (organ) {
        var lastI = h.lines.length - 1, t0i = t;
        job(t0i, function () { organLine(t0i, h.lines, lastI, beatS, "hymn principal"); });
        t = partEvents(h, "S", t, beatS, [h.lines[lastI]], null).end + 0.9 * beatS;
      }
      for (var v = 0; v < verses; v++) {
        (function (v) {
          var vowels = vowelsFor(seed, v, 400), onNotes = h.dialect === "sacredharp" && v === 0;
          var label = "verse " + (v + 1) + (onNotes ? ", on the notes" : "");
          var vowelOf = function (e) { if (onNotes) return shapeOf(h, e.n.deg); return e.n.syl != null ? vowels[e.n.syl] : null; };
          var reg = verses === 3 && v === 2 ? "full organ" : "hymn principal";
          verseLines.forEach(function (line, li) {
            if (lined) {
              // the precentor lines out the line; the ward answers it, slowly, each their own way
              var tp = t, pe = partEvents(h, h.melodyPart, tp, beatS * 0.42, [line], verseLines[li + 1]);
              job(tp, function () {
                var pre = V.precentor({ seed: seed, pan: 0.05 });
                var psung = toSung(h, pe.ev, tp, 0.5, function (e) { return vowels[e.n.syl != null ? e.n.syl : 0]; });
                pre.line(ac, room.near, tp, psung, 0.75, { rand: PJ2.Rand.stream(seed).fork("precentor:" + v + ":" + li), amount: 0.7, tonicHz: base,
                                                         scale: K.Pitch ? K.Pitch.COLLECTIONS[h.mode].ratios : null });
              });
              t = pe.end + 0.35;
              t = singLine(t, verseLines, li, beatS, vowelOf, { spread: true, decorate: v + ":" + li, gain: 0.9, noOrgan: true, label: label + " · line " + (li + 1) }) + 0.5;
            } else {
              t = singLine(t, verseLines, li, beatS, vowelOf, { reg: reg, label: label + " · line " + (li + 1) });
            }
          });
          if (!lined && v < verses - 1) t += 1.1 * beatS;
        })(v);
      }
      // the amen: the Tabernacle's, after the last verse
      if (h.amen) {
        t += 0.3 * beatS;
        t = singLine(t, [h.amen], 0, beatS, function (e) { return e.n.beat === 0 ? "ah" : "eh"; }, { reg: verses === 3 ? "full organ" : "hymn principal", label: "amen" });
      }
      var endAt = t + 2.5;
      jobs.sort(function (x, y) { return x.at - y.at; });
      // light the notes as they sound (visual only)
      var els = {};
      document.querySelectorAll("#khl-scorebox svg").forEach(function (svg, row) {
        svg.querySelectorAll("g.nt").forEach(function (g) { var k = row + "|" + g.getAttribute("data-p") + "|" + g.getAttribute("data-b"); (els[k] = els[k] || []).push(g); });
      });
      var all = h.lines.concat(h.refrain || []);
      var rowOf = function (m) { if (m.amen) return all.length; for (var i = all.length - 1; i >= 0; i--) if (m.b >= (all[i].startBeat || 0) - 1e-6) return i; return 0; };
      marks.forEach(function (m) { m.key = rowOf(m) + "|" + m.p + "|" + (Math.round(m.b * 1000) / 1000); });
      var on = {};
      function pump() {
        if (!AC || AC !== ac) return;
        var now = ac.currentTime, lab = "", want = {};
        while (jobs.length && jobs[0].at - 3 <= now) jobs.shift().fn();
        marks.forEach(function (m) { if (now >= m.t && now < m.end) { want[m.key] = true; if (m.p === h.melodyPart) lab = m.label; } });
        for (var k in on) if (!want[k]) { (els[k] || []).forEach(function (g) { g.classList.remove("hi"); }); delete on[k]; }
        for (k in want) if (!on[k]) { (els[k] || []).forEach(function (g) { g.classList.add("hi"); }); on[k] = true; }
        $("khl-now").textContent = now < T0 ? "" : now < endAt - 2 ? (lab || (organ ? "the organ gives out the tune" : lined ? "the precentor lines out the tune" : "")) : "";
        if (now > endAt) stop();
      }
      pump();
      timer = setInterval(pump, 120);
    });
  }
  $("khl-playbtn").addEventListener("click", play);

  // ==========================================================================
  // THE SPREAD — two dozen hymns, composed a few at a time so the page
  // breathes: do they all end alike? peak alike? measure like the book?
  // ==========================================================================
  $("khl-spreadbtn").addEventListener("click", function () {
    var s = settings(), N = 24, i = 0, out = $("khl-spreadout"), btn = this;
    var T = { finalFigure: {}, lineEnd: {}, contour: {}, cadence: {}, meter: {}, peakLine: {}, hymnist: {}, opening: {} }, peaks = [], fps = [], fails = {};
    btn.disabled = true;
    function inc(t, k) { T[t][k] = (T[t][k] || 0) + 1; }
    function step() {
      for (var k = 0; k < 2 && i < N; k++, i++) {
        var h = C.compose(PJ2.Rand.stream(s.seed + 1 + i), { dialect: s.dialect, mode: s.mode, meter: s.meter, hymnist: s.hymnist, keyMonzo: s.keyMonzo });
        var r = h.report;
        inc("meter", h.meter); inc("hymnist", h.hymnist ? h.hymnist.nameEn : "—"); inc("peakLine", "line " + r.peak.line);
        r.lines.forEach(function (L) { inc("contour", L.contour); inc("cadence", L.cadence.split(" ")[0]); inc("lineEnd", solName(L.target, h.mode) + " by " + L.figure); if (L.role === "home") inc("finalFigure", L.figure); });
        var m = h.lines[0].notes[h.melodyPart].filter(function (x) { return x.syl !== null; }).map(function (x) { return x.deg; });
        inc("opening", m.slice(1, 5).map(function (d, j) { return d - m[j]; }).join(" "));
        peaks.push(r.peak.at); fps.push(r.fingerprint);
        r.checks.forEach(function (c) { if (!c.ok) fails[c.name] = (fails[c.name] || 0) + 1; });
      }
      out.innerHTML = "<p class=\"khl-cap\">composed " + i + " of " + N + "…</p>";
      if (i < N) { setTimeout(step, 0); return; }
      btn.disabled = false;
      function line(t, name) {
        var tot = 0, arr = []; for (var k2 in T[t]) { tot += T[t][k2]; arr.push([k2, T[t][k2]]); }
        arr.sort(function (a, b) { return b[1] - a[1]; });
        var H = 0; arr.forEach(function (x) { var p = x[1] / tot; H -= p * Math.log2(p); });
        return name + ": " + arr.length + " kinds, the commonest " + pct(arr[0][1] / tot) + " (" + arr[0][0] + "), entropy " + H.toFixed(2) + " bits\n    " + arr.slice(0, 8).map(function (x) { return x[0] + " " + x[1]; }).join(" · ");
      }
      var refs = C.references()[s.dialect], mean = {};
      ["par5", "thirdless", "crossing", "chromatic", "sevenths", "leap", "melisma"].forEach(function (k2) { mean[k2] = fps.reduce(function (a, f) { return a + f.share[k2]; }, 0) / fps.length; });
      var mn = Math.min.apply(null, peaks), mx = Math.max.apply(null, peaks), av = peaks.reduce(function (a, b) { return a + b; }, 0) / peaks.length;
      out.innerHTML = "<pre>" + esc([
        line("finalFigure", "how the last line ends"), line("lineEnd", "every line's ending (note, figure)"), line("opening", "the first line's opening intervals"),
        line("contour", "line contours"), line("cadence", "cadences"), line("meter", "meters"), line("hymnist", "hymnists"), line("peakLine", "where the peak falls (line)"),
        "the peak's place in the tune: " + pct(mn) + " to " + pct(mx) + ", mean " + pct(av) + " (planned 60–75%)",
        "measured, mean of " + N + " (Earth tunes' mean; tolerance): " + Object.keys(mean).map(function (k2) { var t = refs.tolerance[k2]; return k2 + " " + pct(mean[k2]) + " (" + pct(refs.mean[k2]) + (t ? "; " + pct(t[0]) + "–" + pct(t[1]) : "") + ")"; }).join(" · "),
        "checks not passed: " + (Object.keys(fails).length ? Object.keys(fails).map(function (k2) { return k2 + " ×" + fails[k2]; }).join(", ") : "none"),
      ].join("\n")) + "</pre>";
    }
    step();
  });

  // ==========================================================================
  // WHAT TO LISTEN FOR — in plain words, per dialect
  // ==========================================================================
  var LISTEN = {
    tabernacle: [
      "<b>The Tabernacle</b> is the Latter-day Saint hymnal's own voice (Careless, Beesley, Stephens): the tune on top, the organ under the ward, warm full chords.",
      "Listen for: the organ giving out the last line first, then the congregation. Every line ends on a real cadence — a half close that leaves you leaning, a full close home at the end; now and then the harmony slips aside (a <i>deceptive</i> close) or leans on the dominant's own dominant for colour. At the end of a line the alto or tenor sometimes holds a note over the chord change and then settles (a <i>4–3 suspension</i>). The highest note of the tune should come about two-thirds of the way through, not at the start.",
      "And after the last verse, the plagal <i>A-men</i>.",
    ],
    sacredharp: [
      "<b>The Sacred Harp</b> is the Georgia singing school's sound: loud, bright, raw. The tune is in the <i>tenor</i> (the men in the middle, doubled an octave up by some women), with the treble and bass as melodies of their own.",
      "Listen for: open fifths and bare octaves where you expect a sweet third; parts moving in parallel fifths (welcome here); every line ending on a hollow, bare chord; no organ, no amen. The first verse is sung <i>on the notes</i> — fa, sol, la, mi — as the singing schools teach; the next on the words.",
    ],
    oldway: [
      "<b>The Old Way</b> is lining out: a precentor half-sings each line, and the congregation answers it extremely slowly, every singer decorating the tune in their own way — a slow cloud of voices, unmetered and haunting.",
      "Listen for: the single tune, never harmonized; the slides and turns at the places the composer marked (the small marks on the staff); the ward arriving a little unevenly. Turn off “lined out” to hear the ward alone.",
    ],
  };
  function listenNote(h) {
    $("khl-listen").innerHTML = '<h2 class="khl-sec">What to listen for</h2>' + LISTEN[h.dialect].map(function (p) { return "<p>" + p + "</p>"; }).join("") +
      "<p>What you are hearing is the whole composer: the hymnist's habits leaned on the dice; each line's cadence, ending and the peak were drawn before a single note; the search filled the notes between; the dialect wrote the harmony; the checks (left) are what a tunebook's editor would send back. Try “compose another” a few times — no two should sound alike.</p>";
  }

  // the page's handles, for the silent checks (tools, the critic)
  window.HymnLab = { compose: compose, play: play, stop: stop, level: level, hymn: function () { return hymn; } };
  compose();
  if (Q.has("play")) play();
})();

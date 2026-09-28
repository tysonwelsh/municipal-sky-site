// ============================================================================
// HYMN LAB (dev only; see hymn-lab.php) — the owner's listening checkpoint.
//
// Compose: KOLOB.Composer.compose(PJ2.Rand.stream(seed), {dialect, mode,
// meter, hymnist, keyMonzo, gestures, kind}) — the gestures are the day's
// theme, drawn by the motif engine from the same seed, so the hymn shares its
// opening shape with the meeting's material (PLAN §4 step 4).
// Engrave: each line a system, the way the dialect's books print it — the
// Tabernacle in closed score (soprano and alto on the treble staff, tenor and
// bass on the bass staff), the Sacred Harp in open score with the tune in
// the tenor and four shapes for the four syllables, the psalmody the same
// open score in round notes (the fuge's entries where they fall), the
// barbershop quartet on two staves (the tenor harmony over the lead, the
// baritone with the bass), the unison songs and the Old Way on one staff.
// Spelled on the white keys of the mode (a major hymn in C, an aeolian one on
// A), whatever the day's key; a septimal note wears Johnston's 7.
// Sing: thirty-two people (KOLOB.VoicesVocal.singer, the round-1 full ward),
// eight to a part, seated by the dialect — and the organ (KOLOB.VoicesOrgan)
// under the Tabernacle; through the voices lab's master chain and a limiter
// (never louder than the app).
// Round 3 adds, below the hymn: A ROUND (the ward in groups, entering in
// turn), THE PARTNER HYMN (the first hymn, the closing hymn written on its
// chords, then the two together — or "not combined", with the fit that
// refused them), and THE WANDERING REFRAIN (in each of the day's keys).
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
  var METER_NAMES = { "CM": "CM 8.6.8.6", "LM": "LM 8.8.8.8", "SM": "SM 6.6.8.6", "CMD": "CMD (doubled)", "87.87": "8.7.8.7", "87.87D": "8.7.8.7 D", "76.76D": "7.6.7.6 D", "11s": "11s (11.11.11.11)", "10.10R": "10.10 with refrain",
                      "66.66": "6.6.6.6", "77.77": "7.7.7.7", "65.65": "6.5.6.5", "88.88": "8.8.8.8 (trochaic, the dance)", "88": "8.8 (a couplet)", "86": "8.6 (a couplet)", "77": "7.7 (a couplet)" };
  // (2/3 is a fifth down, 3/4 a fourth down — the labels were swapped in round 1)
  var KEYS = [["0,0,0,0", "do on the keynote"], ["2,-1,0,0", "up a just fourth (4/3)"], ["-1,1,0,0", "up a just fifth (3/2)"], ["1,-1,0,0", "down a just fifth (2/3)"], ["-2,1,0,0", "down a just fourth (3/4)"]];
  // ?key= takes a name, a ratio or the monzo itself: up4 · 4/3 · 2,-1,0,0
  var KEY_ALIAS = { home: "0,0,0,0", "1/1": "0,0,0,0", up4: "2,-1,0,0", "4/3": "2,-1,0,0", up5: "-1,1,0,0", "3/2": "-1,1,0,0", down5: "1,-1,0,0", "2/3": "1,-1,0,0", down4: "-2,1,0,0", "3/4": "-2,1,0,0" };
  var KEY_NAME = { "0,0,0,0": "home", "2,-1,0,0": "up4", "-1,1,0,0": "up5", "1,-1,0,0": "down5", "-2,1,0,0": "down4" };
  function fill(sel, pairs) { sel.innerHTML = pairs.map(function (p) { return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + "</option>"; }).join(""); }
  fill($("khl-mode"), MODES);
  fill($("khl-meter"), [["", "any (the dialect draws)"]].concat(Object.keys(C.METERS).filter(function (m) { return C.METERS[m].lines.length > 2; }).map(function (m) { return [m, METER_NAMES[m] || m]; })));
  fill($("khl-hymnist"), [["", "any (drawn by the dialect)"]].concat(HS.list.map(function (h) { return [h.id, h.nameEn + " · " + h.nameDs]; })));
  fill($("khl-key"), KEYS);
  fill($("khl-kind"), [["", "any (drawn)"], ["shaker", "a Shaker hymn"], ["gift", "a gift song (vocables)"], ["primary", "a Primary song"]]);
  // a link can carry the settings: ?seed=12&dialect=sacredharp&mode=aeolian&play
  var Q = new URLSearchParams(location.search);
  if (Q.get("seed")) $("khl-seed").value = Q.get("seed");
  ["dialect", "mode", "meter", "hymnist", "kind"].forEach(function (k) { if (Q.get(k) != null) $("khl-" + k).value = Q.get(k); });
  if (Q.get("key") != null) { var kq = String(Q.get("key")).replace(/\s/g, ""), kv = KEY_ALIAS[kq] || kq; if (KEY_NAME[kv]) $("khl-key").value = kv; }
  function kindShown() { $("khl-kindf").hidden = $("khl-dialect").value !== "shaker"; }
  kindShown();
  // the address bar always holds the link that composes this hymn again
  function syncURL(s) {
    try {
      var u = new URLSearchParams();
      u.set("seed", s.seed); u.set("dialect", s.dialect);
      if (s.mode) u.set("mode", s.mode); if (s.meter) u.set("meter", s.meter); if (s.hymnist) u.set("hymnist", s.hymnist); if (s.kind && s.dialect === "shaker") u.set("kind", s.kind);
      var kn = KEY_NAME[s.keyMonzo.join(",")]; if (kn && kn !== "home") u.set("key", kn);
      history.replaceState(null, "", location.pathname + "?" + u.toString());
    } catch (e) { /* a sandboxed page keeps its address */ }
  }
  $("khl-tempo").addEventListener("input", function () { $("khl-tempo-out").textContent = (+this.value).toFixed(2) + "×"; });

  var KEYNOTE_HZ = 261.63;                 // the day's keynote, about middle C (the app's F0 · 4)
  var GIVE_OUT = 2.8;                      // the organ alone, giving out the tune: about +9 dB over its doubling level
  var hymn = null, seedNow = null, extra = { round: null, partner: null, refrain: null };

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
      hymnist: $("khl-hymnist").value || undefined, kind: $("khl-kind").value || undefined,
      keyMonzo: $("khl-key").value.split(",").map(Number),
    };
  }
  function compose() {
    stop();
    var s = settings(), th = dayTheme(s.seed);
    var t0 = performance.now();
    try {
      hymn = C.compose(PJ2.Rand.stream(s.seed), { dialect: s.dialect, mode: s.mode, meter: s.meter, hymnist: s.hymnist, keyMonzo: s.keyMonzo, kind: s.kind,
                                                  gestures: th ? [th.degs] : null, id: "h:1:1" });
    } catch (e) { showErr("compose failed: " + e.message); return; }
    hymn._ms = Math.round(performance.now() - t0);
    hymn._theme = th;
    seedNow = s.seed;
    syncURL(s);
    render();
    ["round", "partner", "refrain"].forEach(function (k) { extra[k] = null; $("khl-" + k + "out").innerHTML = ""; $("khl-" + k + "play").disabled = true; });
    $("khl-playbtn").disabled = false;
    $("khl-organ").disabled = !D.get(hymn.dialect).organ;
    $("khl-lined").disabled = hymn.dialect !== "oldway";
  }
  $("khl-compose").addEventListener("click", compose);
  $("khl-another").addEventListener("click", function () { $("khl-seed").value = (Math.floor(+$("khl-seed").value) || 0) + 1; compose(); });
  $("khl-dialect").addEventListener("change", function () { $("khl-spreadout").innerHTML = ""; kindShown(); });

  // ==========================================================================
  // THE CARD, THE CHECKS, THE MEASUREMENTS, THE PLAN
  // ==========================================================================
  var DIALECT_NAME = { tabernacle: "C · Tabernacle", sacredharp: "A · Sacred Harp", oldway: "F · The Old Way", psalmody: "B · New England psalmody", gospel: "D · Gospel and barbershop", shaker: "E · Shaker and Primary" };
  var KIND_NAME = { shaker: "a Shaker hymn", gift: "a gift song on vocables", primary: "a Primary song" };
  var MODE_NAME = { ionian: "ionian (major)", mixolydian: "mixolydian", dorian: "dorian", aeolian: "aeolian (minor)", penta: "pentatonic", hexa: "hexatonic" };
  function checksHtml(r) {
    return r.checks.map(function (c) {
      return '<li class="' + (c.ok ? "ok" : c.hard ? "no" : "soft") + '">' + esc(c.name) + " <small>— " + esc(c.detail) + "</small></li>";
    }).join("") + (r.repairs && r.repairs.length ? '<li class="soft">repaired <small>— ' + esc(r.repairs.map(function (x) { return "round " + x.round + ": " + x.failed.join(", "); }).join("; ")) + "</small></li>" : "");
  }
  function boardHtml(h) {
    var compound = /\/8$/.test(h.modeOfTime), bpm = Math.round(60 / (h.beatS * (compound ? 3 : 1))), r = h.report || {};
    return '<div class="khl-board"><span class="khl-num">' + h.number + '</span><span class="khl-name">' + esc(h.nameDs) + '</span><span class="khl-en">' + esc(h.nameEn) + " (dev)</span></div>" +
      '<p class="khl-meta"><b>' + esc(DIALECT_NAME[h.dialect]) + "</b>" + (h.kind ? " · " + esc(KIND_NAME[h.kind] || h.kind) : "") + " · " + esc(METER_NAMES[h.meter] || h.meter) + " · form " + esc(h.form) + " · " + esc(MODE_NAME[h.mode]) +
      " · " + esc(h.modeOfTime) + " at " + bpm + (compound ? " dotted-crotchet beats" : " beats") + " a minute" + (h.hymnist ? " · by " + esc(h.hymnist.nameDs) + ' <span class="khl-en">' + esc(h.hymnist.nameEn) + "</span>" : "") +
      (r.frame && r.frame.alto ? " · with an alto" : h.dialect === "sacredharp" ? " · three parts (no alto)" : "") + (h.drone ? " · over a hummed drone" : "") + (h.fuge ? " · a fuge in line " + (h.fuge.line + 1) : "") + (h.tag ? " · a tag" : "") + "</p>";
  }
  function render() {
    var h = hymn, r = h.report, Dl = D.get(h.dialect);
    $("khl-hymn").innerHTML = boardHtml(h) +
      '<p class="khl-about">' + esc(Dl.about) + (h._theme && h._theme.name ? " · first line seeded from the day's theme, “" + esc(h._theme.name) + "”" : "") + " · composed in " + h._ms + " ms</p>" +
      '<div class="khl-score" id="khl-scorebox" data-box="main">' + engrave(h) + "</div>";
    // the checks
    $("khl-checks").innerHTML = checksHtml(r);
    // the fingerprint against the dialect's Earth tunes
    var refs = C.references()[h.dialect], fp = r.fingerprint, tol = refs.tolerance;
    if ((h.mode === "aeolian" || h.mode === "dorian") && tol.minor) { var t2 = {}; for (var k in tol) t2[k] = tol[k]; for (k in tol.minor) t2[k] = tol.minor[k]; tol = t2; }
    var unison = Dl.parts.length === 1;
    var ROWS = [["par5", "moves with parallel fifths"], ["thirdless", "chords with no third"], ["crossing", "chords with parts crossed"], ["chromatic", "chromatic notes"],
                ["sevenths", "chords with a seventh"], ["septimal", "notes tuned on the 7th partial"], ["stagger", "onsets where a part is silent (a fuge's entries)"], ["leap", "melody leaps (a third or more)"], ["melisma", "melody notes slurred"],
                ["ornament", "ornament marks"], ["melodyRange", "melody's compass (steps)"],
                ["closeThird", "line closes that keep their third"], ["closeHome", "line closes on home's chord"], ["closeDom", "line closes on the dominant"], ["closeUnison", "line closes on a bare unison or octave"]]
      .filter(function (row) { return !unison || !/^close|par5|thirdless|crossing|sevenths|septimal|stagger/.test(row[0]); })
      .filter(function (row) { return row[0] !== "ornament" || h.dialect === "oldway"; })
      .filter(function (row) { return row[0] !== "septimal" || h.dialect === "gospel"; });
    $("khl-fp").innerHTML = '<table class="khl-table"><tr><th>measure</th><th>this hymn</th><th>Earth tunes (' + refs.tunes.length + ")</th><th>tolerance</th></tr>" +
      ROWS.map(function (row) {
        var v = row[0] === "melodyRange" ? fp.melodyRange : fp.share[row[0]], t = tol[row[0]], ref = refs.mean[row[0]];
        var inT = !t || (v >= t[0] - 1e-9 && v <= t[1] + 1e-9);
        var show = function (x) { return x == null ? "—" : row[0] === "melodyRange" ? x : pct(x); };
        return "<tr><td>" + esc(row[1]) + '</td><td class="num ' + (inT ? "in" : "out") + '">' + show(v) + '</td><td class="num">' + (refs.tunes.length ? show(ref) : "—") + '</td><td class="num">' + (t ? show(t[0]) + "–" + show(t[1]) : "") + "</td></tr>";
      }).join("") +
      '<tr><td>cadences</td><td colspan="3">' + esc(Object.keys(fp.cadences).map(function (c) { return c + " " + fp.cadences[c]; }).join(" · ")) + "</td></tr>" +
      '<tr><td>parts\' compass</td><td colspan="3">' + esc(Object.keys(fp.rangeSemi).map(function (p) { return p + " " + fp.rangeSemi[p] + " semitones (" + fp.range[p] + " steps)"; }).join(" · ")) + " — an octave and a fourth is 17</td></tr>" +
      '<tr><td>how it ends</td><td colspan="3">' + esc(C.sungEnding(h, 3)) + " (the last three notes, named from the final)</td></tr></table>" +
      '<p class="khl-cap">Earth tunes: ' + (refs.tunes.length ? esc(refs.tunes.map(function (t) { return t.id.replace("earth:", "").toUpperCase(); }).join(", ")) : "none in Kolob's tune book for this dialect") +
      (h.dialect === "psalmody" ? " — no Yankee fuging tune is in the book yet; the fuge is held to its own rules (the checks, left)" : h.dialect === "gospel" ? " — a gospel hymn with its echoing refrain; no barbershop is written in the book, so the ringing sevenths are held to their own rule (the checks, left)" : "") + "</p>";
    // the plan
    $("khl-plan").innerHTML = '<table class="khl-table"><tr><th>line</th><th>role</th><th>cadence planned</th><th>ending (drawn first)</th><th>contour</th><th>rhythm cell</th><th>search</th></tr>' +
      r.lines.map(function (L, i) {
        var pl = (h.lines.concat(h.refrain || [])[i] || {}).plan || {};
        var extraNote = (pl.bare ? ", closes bare" : "") + (pl.fuge ? " · the FUGE" : "") + (pl.echo ? " · the men's echo" : "") + (pl.swipes ? " · " + pl.swipes + " swipe" + (pl.swipes > 1 ? "s" : "") : "");
        return "<tr><td>" + (i + 1) + " · " + esc(L.letter) + (L.copyOf ? " (= " + L.copyOf + ")" : "") + (r.peak.line === i + 1 ? " ★" : "") + "</td><td>" + esc(L.role) + "</td><td>" + esc(L.cadence) + (L.full ? ", its third kept" : "") + " on " + solName(L.target, h.mode) + esc(extraNote) +
               "</td><td>" + esc(L.figure) + "</td><td>" + esc(L.contour) + "</td><td>" + esc(L.cell) + '</td><td class="num">' + (L.copyOf ? "copied" : "cost " + L.searchCost + ", top-8 differ by " + L.topSpread) + "</td></tr>";
      }).join("") + "</table>" +
      '<p class="khl-cap">★ the peak: ' + r.peak.stepsOverFinal + " steps over the final, at " + pct(r.peak.at) + " of the tune (planned 60–75%). Compass " + r.peak.span + " steps." +
      (r.slurs ? " " + r.slurs + " passing notes slurred after the search." : "") + "</p>";
    listenNote(h);
  }
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  function solName(cl, mode) { var d = C.doOf(mode); return SOLF[((cl - d) % 7 + 7) % 7]; }

  // ==========================================================================
  // THE ENGRAVER — each line of the hymn a system
  // ==========================================================================
  var LET_SEMI = [0, 2, 4, 5, 7, 9, 11];
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
    if (h.dialect === "gospel") return [["treble", ["S", "T"], "tenor · lead ★"], ["bass", ["A", "B"], "baritone · bass"]];
    if (Object.keys(h.lines[0].notes).length === 1) return [["treble", [h.melodyPart], h.round ? "the round" : "the tune"]];
    var out = [["treble", ["S"], "Treble"]];
    if (h.lines[0].notes.A) out.push(["treble", ["A"], h.dialect === "psalmody" ? "Counter" : "Alto"]);
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
          // Johnston's marks: + and − a syntonic comma, 7 the seventh partial
          var mk = (n.septimal ? "7" : "") + (n.comma ? (n.comma > 0 ? "+" : "−") : "");
          if (mk) out.push('<text class="cm" x="' + f1(x - (alt ? 17 : 8)) + '" y="' + f1(y - 5) + '" font-size="9" text-anchor="end">' + mk + "</text>");
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
    // the chords, under the last staff (a ringing 4:5:6:7 marked ✦, a swipe ~)
    if (romanRow) {
      var ry = staves.length * (staffH + 2 * pad) + sylRow + 2;
      line.chords.forEach(function (c) { out.push('<text class="rn' + (c.ring ? " rg" : "") + '" x="' + f1(head + c.beat * unit + 9) + '" y="' + ry + '" font-size="10" text-anchor="middle">' + esc((c.swipe ? "~" : "") + c.roman + (c.ring ? "✦" : "")) + "</text>"); });
    }
    out.push("</svg>");
    return out.join("");
  }
  // every system of a hymn (its lines, refrain, amen, tag), in order: the
  // row a line is engraved on is its index here
  function systems(h) {
    var L = h.lines.map(function (l, i) { return [l, (h.round ? "segment " : "line ") + (i + 1) + " · " + l.plan.letter + (h.round ? " · " + (l.plan.rhythm || "") + ", " + (l.plan.register || "") : " · " + l.cadence.kind) + (h.fuge && h.fuge.line === i ? " · the fuge" : "")]; });
    (h.refrain || []).forEach(function (l, i) { L.push([l, "refrain " + (i + 1) + " · " + l.cadence.kind]); });
    if (h.amen) L.push([h.amen, "the amen (after the last verse)"]);
    if (h.tag) L.push([h.tag, "the tag (after the last refrain): " + ((h.tag.plan && h.tag.plan.chain) || []).join("–")]);
    return L;
  }
  function engrave(h) {
    return systems(h).map(function (x, i) {
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
    var dry = G(1), wetIn = G(1), conv = ctx.createConvolver(), wet = G(roomOn() ? 0.9 * 0.85 : 0);
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
  // (the owner's A/B for the sound he hears between the notes: the singers'
  // breath, and the room's reverberation, each can be switched off)
  function breathOn() { return !$("khl-breath") || $("khl-breath").checked; }
  function roomOn() { return !$("khl-room") || $("khl-room").checked; }
  function fullWard(seed) {
    var root = PJ2.Rand.stream(seed).fork("fullward"), people = [];
    ["S", "A", "T", "B"].forEach(function (part) {
      for (var k = 0; k < 8; k++) {
        var r = root.fork(part + ":" + k), base = { S: 0.30, A: -0.30, T: 0.45, B: -0.45 }[part] * 0.9;
        people.push({ part: part, k: k, appetite: r.rnd(0.3, 1), spread: r.rnd(0, 0.3), singer: V.singer({
          seed: seed, name: "ward-" + part + k, part: part, age: r.pick(["young", "mid", "mid", "old"]),
          confidence: r.rnd(0.45, 0.9), brightness: r.rnd(0.3, 0.65), breath: r.rnd(0.2, 0.55) * (breathOn() ? 1 : 0),
          pitchHabitCents: r.rnd(-12, 12), timingHabitMs: r.rnd(0, 70) + r.rnd(-10, 25), tractScale: r.rnd(0.95, 1.05),
          pan: Math.max(-0.9, Math.min(0.9, base + r.rnd(-0.3, 0.3))) }) });
      }
    });
    return people;
  }
  // who sings what, by dialect: [part of the Score, octave factor] (null: sits this one out)
  function assignment(h, person) {
    var p = person.part, k = person.k;
    if (Object.keys(h.lines[0].notes).length === 1) return [h.melodyPart, p === "T" || p === "B" ? 0.5 : 1];
    if (h.dialect === "sacredharp" || h.dialect === "psalmody") {
      // the treble and the tenor are doubled in octaves (six parts, really)
      if (p === "S") return k < 6 ? ["S", 1] : ["T", 2];
      if (p === "T") return k < 6 ? ["T", 1] : ["S", 0.5];
      if (p === "A") return h.lines[0].notes.A ? ["A", 1] : (k < 4 ? ["S", 1] : ["T", 2]);
      return ["B", 1];
    }
    if (h.dialect === "gospel") {
      // the quartet in the ward: the tune (the lead) with the altos and three
      // sopranos; the tenor harmony over it with five sopranos; the tenors on
      // the baritone under it; the basses on the bass — so the men's echo is
      // the men's
      if (p === "S") return k < 5 ? ["S", 1] : ["T", 1];
      if (p === "A") return ["T", 1];
      if (p === "T") return ["A", 1];
      return ["B", 1];
    }
    return [p, 1];
  }

  // ==========================================================================
  // THE PERFORMANCE — a Score laid out in seconds, line by line
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function lineLen(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    return K.Score.lineLength(line);
  }
  // a line's clock: a fermata holds its note and moves everything after it
  function clockOf(line, beatS) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len * beatS });
    });
    return function (b) { var t = b * beatS; holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; }); return t; };
  }
  // every note of one part of one line, in seconds from t0 → { ev: [{t, dur, n, beatAbs}], end }
  function partEvents(line, next, part, t0, beatS) {
    var ev = [], clk = clockOf(line, beatS), len = lineLen(line, next), ns = line.notes[part] || [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var st = t0 + clk(b0), dur = clk(b1) - clk(b0);
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);   // the breath
      ev.push({ t: st, dur: dur, n: n, beatAbs: (line.startBeat || 0) + n.beat });
    }
    return { ev: ev, end: t0 + clk(len) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0) };
  }
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 2], ["oo", 1.5], ["eh", 1.5]];
  function vowelsFor(seed, verse, n) { var r = PJ2.Rand.stream(seed).fork("vowels:" + verse), out = []; for (var i = 0; i < n; i++) out.push(r.pickW(VOWELS)); return out; }
  function shapeOf(h, deg) { return SHAPES[((deg - C.doOf(h.mode)) % 7 + 7) % 7]; }
  // the gift song's vocables, as the voices can sound them
  var VOCABLE_SOUND = { lo: "oh", la: "la", lee: "ee", dee: "ee", de: "eh", vol: "oh", hey: "eh", loo: "oo", lum: "hum", dum: "oo", day: "eh" };
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

  var AC = null, timer = null, ROOM = null, TAP = null;
  var STOPS = ["khl-stop", "khl-roundstop", "khl-partnerstop", "khl-refrainstop"];
  // (for the silent checks) the level leaving the limiter, in dBFS, and the peak since the last read
  function level() {
    if (!AC || !ROOM) return { rms: -120, peak: 0 };
    var a = new Float32Array(ROOM.meter.fftSize); ROOM.meter.getFloatTimeDomainData(a);
    var s2 = 0, pk = 0; for (var i = 0; i < a.length; i++) { s2 += a[i] * a[i]; pk = Math.max(pk, Math.abs(a[i])); }
    return { rms: Math.round(10 * Math.log10(s2 / a.length + 1e-12) * 10) / 10, peak: Math.round(pk * 1000) / 1000, t: AC.currentTime };
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
    if (AC) { var a = AC; AC = null; try { a.close(); } catch (e) { /* gone */ } }
    document.querySelectorAll(".khl-score .hi").forEach(function (g) { g.classList.remove("hi"); });
    STOPS.forEach(function (id) { if ($(id)) $(id).disabled = true; });
    $("khl-now").textContent = "";
  }
  STOPS.forEach(function (id) { if ($(id)) $(id).addEventListener("click", stop); });

  // A STAGE: one AudioContext, the room, the ward and (maybe) the organ, and
  // a small pump that hands each line to the singers a few seconds before it
  // sounds (so a long hymn never builds its whole graph at once, and Stop is
  // instant). Marks light the engraved notes as they sound: a mark names the
  // score box, the engraved row, the part and the beat.
  function stage(seed, build) {
    stop();
    var Ctor = window.AudioContext || window.webkitAudioContext;
    try { AC = new Ctor(); } catch (e) { showErr("no audio: " + e.message); return; }
    var ac = AC, room = chain(ac);
    ROOM = room;
    STOPS.forEach(function (id) { if ($(id)) $(id).disabled = false; });
    $("khl-now").textContent = "the ward is finding its seats…";
    if (TAP) TAP.attach(ac, room.out);
    room.ready.then(function () {
      if (AC !== ac) return;
      if (ac.state === "suspended" && ac.resume) ac.resume();
      var S = { ac: ac, room: room, ward: fullWard(seed), T0: ac.currentTime + 1.0, jobs: [], marks: [], organ: null, organBus: null, seed: seed, g1: 1 / Math.sqrt(8) };
      S.job = function (at, fn) { S.jobs.push({ at: at, fn: fn }); };
      S.mark = function (box, row, h, line, next, t0, bs, label, parts) {
        (parts || ["S", "A", "T", "B"]).forEach(function (p) {
          if (!line.notes[p]) return;
          partEvents(line, next, p, t0, bs).ev.forEach(function (e) { S.marks.push({ t: e.t, end: e.t + e.dur, key: box + "|" + row + "|" + p + "|" + (Math.round(e.beatAbs * 1000) / 1000), mel: p === h.melodyPart, label: label || "" }); });
        });
      };
      S.withOrgan = function () {
        if (S.organ) return S.organ;
        S.organBus = ac.createGain(); S.organBus.gain.setValueAtTime(1, S.T0 - 0.5); S.organBus.connect(room.hall);
        S.organ = K.VoicesOrgan.create(ac, S.organBus, { gain: 0.9, seed: seed, t0: S.T0 });
        return S.organ;
      };
      // one line of hymn h at t0, by everyone who sings it; → the line's end
      S.singLine = function (h, box, row, t0, line, next, bs, vowelOf, o) {
        o = o || {};
        var end = partEvents(line, next, h.melodyPart, t0, bs).end;
        S.job(t0, function () {
          S.ward.forEach(function (person) {
            if (o.who && !o.who(person)) return;
            var asg = o.assign ? o.assign(person) : assignment(h, person);
            if (!asg || !line.notes[asg[0]]) return;
            var off = o.spread ? person.spread * bs * (o.spread === true ? 0.6 : o.spread) : 0;
            var ev = partEvents(line, next, asg[0], t0 + off, bs).ev, lastV = "ah";
            if (!ev.length) return;
            var sung = toSung(h, ev, ev[0].t, asg[1], function (e) { var v = vowelOf(e); if (v) lastV = v; return lastV; });
            if (o.decorate) sung = decorate(h, sung, PJ2.Rand.stream(seed).fork("orn:" + person.part + person.k + ":" + o.decorate), person.appetite);
            // (a part that comes in late — a fuge's entry, the men's echo — begins where it enters)
            person.singer.sing(ac, room.hall, ev[0].t, sung, S.g1 * (o.gain || 1));
          });
          if (o.organ) S.organLine(h, t0, line, next, bs, o.reg || "hymn principal");
          if (o.drone && h.drone) S.drone(h, t0, end - t0);
        });
        S.mark(box, row, h, line, next, t0, bs, o.label);
        return end;
      };
      S.organLine = function (h, t0, line, next, bs, reg) {
        var notes = [], base = KEYNOTE_HZ * ratio(h.keyMonzo), organ = S.withOrgan();
        ["S", "A", "T", "B"].forEach(function (p) {
          if (!line.notes[p]) return;
          partEvents(line, next, p, t0, bs).ev.forEach(function (e) { notes.push({ f: base * ratio(e.n.monzo), dur: e.dur, at: e.t - t0, pedal: p === "B", v: p === h.melodyPart ? 1 : 0.8 }); });
        });
        organ.play(t0, notes, reg);
      };
      // the unison song's drone: a few of the men humming home's note (and its fifth), quietly
      S.drone = function (h, t0, dur) {
        var base = KEYNOTE_HZ * ratio(h.keyMonzo);
        (h.drone.degs || [-7]).forEach(function (d, j) {
          S.ward.filter(function (p) { return j === 0 ? p.part === "B" && p.k < 3 : p.part === "T" && p.k < 2; }).forEach(function (p) {
            p.singer.sing(ac, room.hall, t0, [{ f: base * ratio(C.spelledMonzo(h.mode, d, 0)), dur: dur, vowel: "hum", stress: 1 }], S.g1 * 0.55);
          });
        });
      };
      var endAt = build(S);
      S.jobs.sort(function (x, y) { return x.at - y.at; });
      // light the notes as they sound (visual only)
      var els = {};
      document.querySelectorAll(".khl-score[data-box]").forEach(function (box) {
        var id = box.getAttribute("data-box");
        box.querySelectorAll("svg").forEach(function (svg, row) {
          svg.querySelectorAll("g.nt").forEach(function (g) { var k = id + "|" + row + "|" + g.getAttribute("data-p") + "|" + g.getAttribute("data-b"); (els[k] = els[k] || []).push(g); });
        });
      });
      var on = {};
      function pump() {
        if (!AC || AC !== ac) return;
        var now = ac.currentTime, lab = "", want = {};
        while (S.jobs.length && S.jobs[0].at - 3 <= now) S.jobs.shift().fn();
        S.marks.forEach(function (m) { if (now >= m.t && now < m.end) { want[m.key] = true; if (m.label && (m.mel || !lab)) lab = m.label; } });
        for (var k in on) if (!want[k]) { (els[k] || []).forEach(function (g) { g.classList.remove("hi"); }); delete on[k]; }
        for (k in want) if (!on[k]) { (els[k] || []).forEach(function (g) { g.classList.add("hi"); }); on[k] = true; }
        $("khl-now").textContent = now < S.T0 ? "" : now < endAt - 2 ? lab : "";
        if (now > endAt) stop();
      }
      pump();
      timer = setInterval(pump, 120);
    });
  }

  // THE HYMN: the organ's giving-out (the Tabernacle), the verses (and the
  // refrain after each), the fuge sung again (the psalmody), the precentor's
  // lining-out (the Old Way), the amen, the tag
  function playHymn(h, box, S, t, o) {
    o = o || {};
    var Dl = D.get(h.dialect), tempo = +$("khl-tempo").value, beatS = h.beatS / tempo, verses = o.verses || +$("khl-verses").value;
    var withOrgan = Dl.organ && $("khl-organ").checked && !o.noOrgan, lined = h.dialect === "oldway" && $("khl-lined").checked;
    var sys = systems(h).map(function (x) { return x[0]; }), rowOf = function (line) { return sys.indexOf(line); };
    var verseLines = h.lines.concat(h.refrain || []), seed = S.seed, base = KEYNOTE_HZ * ratio(h.keyMonzo), unison = Dl.parts.length === 1;
    if (withOrgan && !o.noGivingOut) {
      // the organist gives out the tune: its last line, alone, at the ward's level
      var lastI = h.lines.length - 1, t0i = t;
      S.withOrgan(); S.organBus.gain.setValueAtTime(GIVE_OUT, t - 0.4);
      S.job(t0i, function () { S.organLine(h, t0i, h.lines[lastI], null, beatS, "hymn principal"); });
      S.mark(box, rowOf(h.lines[lastI]), h, h.lines[lastI], null, t0i, beatS, "the organ gives out the tune");
      t = partEvents(h.lines[lastI], null, "S", t, beatS).end + 0.9 * beatS;
      S.organBus.gain.setValueAtTime(GIVE_OUT, t - 0.45);
      S.organBus.gain.linearRampToValueAtTime(1, t - 0.05);          // the ward stands; the organ steps back under them
    }
    for (var v = 0; v < verses; v++) {
      (function (v) {
        var vowels = vowelsFor(seed, v, 400), onNotes = h.dialect === "sacredharp" && v === 0;
        var label = (h.kind === "gift" ? "the gift song" : "verse " + (v + 1)) + (onNotes ? ", on the notes" : "");
        var vowelOf = function (e) {
          if (onNotes) return shapeOf(h, e.n.deg);
          if (h.vocablesEn && e.n.syl != null) return VOCABLE_SOUND[h.vocablesEn[e.n.syl % h.vocablesEn.length]] || "ah";
          return e.n.syl != null ? vowels[e.n.syl] : null;
        };
        var reg = verses === 3 && v === 2 ? "full organ" : "hymn principal";
        var order = verseLines.map(function (l, i) { return i; });
        // the fuging tune sings its fuge twice, as the books repeat it
        if (h.fuge && h.fuge.repeatFrom != null) for (var q = h.fuge.repeatFrom; q < h.lines.length; q++) order.splice(h.lines.length + (q - h.fuge.repeatFrom), 0, q);
        order.forEach(function (li, oi) {
          var line = verseLines[li], next = oi + 1 < order.length && order[oi + 1] === li + 1 ? verseLines[li + 1] : null, row = rowOf(line);
          var lab = label + " · " + (li < h.lines.length ? "line " + (li + 1) : "refrain") + (h.fuge && h.fuge.line === li ? " (the fuge)" : "");
          if (lined) {
            // the precentor lines out the line; the ward answers it, slowly, each their own way
            var tp = t, pe = partEvents(line, next, h.melodyPart, tp, beatS * 0.42);
            S.job(tp, function () {
              var pre = V.precentor({ seed: seed, pan: 0.05 });
              var psung = toSung(h, pe.ev, tp, 0.5, function (e) { return vowels[e.n.syl != null ? e.n.syl : 0]; });
              pre.line(S.ac, S.room.near, tp, psung, 0.75, { rand: PJ2.Rand.stream(seed).fork("precentor:" + v + ":" + li), amount: 0.7, tonicHz: base,
                                                            scale: K.Pitch ? K.Pitch.COLLECTIONS[h.mode].ratios : null });
            });
            // (the staff lights with the precentor too — round 2's critic: it had stayed dark)
            S.mark(box, row, h, line, next, tp, beatS * 0.42, "the precentor lines out line " + (li + 1), [h.melodyPart]);
            t = pe.end + 0.35;
            t = S.singLine(h, box, row, t, line, next, beatS, vowelOf, { spread: true, decorate: v + ":" + li, gain: 0.9, label: label + " · line " + (li + 1) }) + 0.5;
          } else {
            t = S.singLine(h, box, row, t, line, next, beatS, vowelOf, { reg: reg, organ: withOrgan, label: lab, spread: unison && h.dialect === "shaker" ? 0.35 : false, drone: true });
          }
        });
        if (!lined && v < verses - 1) t += 1.1 * beatS;
      })(v);
    }
    // the amen (the Tabernacle's) and the tag (the barbershop's), after the last verse
    if (h.amen && !o.noAmen) { t += 0.3 * beatS; t = S.singLine(h, box, rowOf(h.amen), t, h.amen, null, beatS, function (e) { return e.n.beat === 0 ? "ah" : "eh"; }, { reg: verses === 3 ? "full organ" : "hymn principal", organ: withOrgan, label: "amen" }); }
    if (h.tag && !o.noAmen) { t += 0.4 * beatS; t = S.singLine(h, box, rowOf(h.tag), t, h.tag, null, beatS * 1.15, function (e) { return e.n.syl != null ? ["oh", "ee", "ah", "oh"][e.n.syl % 4] : null; }, { label: "the tag: the lead holds, the chords turn round it, the last one rings" }); }
    return t;
  }
  function play() {
    if (!hymn) return;
    var h = hymn;
    stage(seedNow, function (S) { return playHymn(h, "main", S, S.T0) + 2.5; });
  }
  $("khl-playbtn").addEventListener("click", play);

  // ==========================================================================
  // ROUND 3's DEMONSTRATIONS — a round, the partner hymn, the wandering refrain
  // ==========================================================================
  function miniCard(h, box, notes) {
    var r = h.report || { checks: [] };
    return boardHtml(h) + (notes || "") + '<div class="khl-score" data-box="' + box + '">' + engrave(h) + "</div>" +
           '<ul class="khl-checks">' + checksHtml(r) + "</ul>";
  }
  // A ROUND: the Shakers' and the Primary's (the psalmody's a Billings round), in the lab's key
  function composeRound() {
    var s = settings(), d = s.dialect === "psalmody" ? "psalmody" : "shaker";
    var h = C.round(PJ2.Rand.stream(s.seed).fork("round"), { dialect: d, keyMonzo: s.keyMonzo, id: "h:1:2" });
    extra.round = h;
    var rd = h.round;
    $("khl-roundout").innerHTML = miniCard(h, "round",
      '<p class="khl-note">Over the ground <b>' + esc(rd.ground.join("–")) + "</b>, " + rd.segments + " segments of " + rd.delayBars + " bar" + (rd.delayBars > 1 ? "s" : "") + " each. " +
      "It carries <b>" + (rd.entries >= 2 ? rd.entries + " entries" : "no entries") + "</b> (" + Object.keys(rd.byEntries).map(function (n) { return n + " voices " + (rd.byEntries[n] ? "✓" : "✗"); }).join(", ") + "). " +
      "Every pair of segments that sounds together, heard: " + rd.pairs.map(function (p) { return p.a + "+" + p.b + (p.ok ? " ✓" : " ✗"); }).join(" · ") + ".</p>");
    $("khl-roundplay").disabled = false;
  }
  function playRound() {
    var h = extra.round; if (!h) return;
    stage(seedNow, function (S) {
      var rd = h.round, n = Math.max(1, Math.min(4, rd.entries)), beatS = h.beatS / +$("khl-tempo").value, times = 2;
      var groups = ["S", "A", "T", "B"].slice(0, n), vowels = vowelsFor(S.seed, 0, 400), end = S.T0;
      // (each group sings the whole round twice, entering one segment after the last)
      var segLen = partEvents(h.lines[0], h.lines[1], "S", 0, beatS).end;
      groups.forEach(function (g, gi) {
        var t = S.T0 + gi * segLen;
        for (var rep = 0; rep < times; rep++) h.lines.forEach(function (line, li) {
          t = S.singLine(h, "round", li, t, line, h.lines[li + 1] || null, beatS, function (e) { return vowels[e.n.syl % vowels.length]; },
                         { who: function (p) { return p.part === g; }, assign: function (p) { return ["S", p.part === "T" || p.part === "B" ? 0.5 : 1]; }, gain: 1.6,
                           label: "the round: the " + ["sopranos", "altos", "tenors", "basses"][gi] + " come in (" + n + " entries)" });
          t = S.T0 + gi * segLen + (rep * h.lines.length + li + 1) * segLen;     // (on the ground's own clock, no breath between segments)
        });
        end = Math.max(end, t);
      });
      return end + 2.5;
    });
  }
  // THE PARTNER HYMN: written on the hymn above's chords and meter
  function composePartner() {
    if (!hymn) return;
    var p = C.partner(PJ2.Rand.stream(seedNow).fork("closing"), hymn, { id: "h:1:3" });
    extra.partner = p;
    var f = p.fit, h2 = p.hymn;
    $("khl-partnerout").innerHTML = h2 ? miniCard(h2, "partner",
      '<p class="khl-note"><b>' + (p.combined ? "They fit: combined." : "They do not fit: NOT combined.") + "</b> " +
      "The fit, heard at every onset of either tune (" + f.onsets + " onsets in " + f.lines + " lines): " + f.strong + " clashes on the beat, " + f.weak + " passing clashes, " + f.parallels + " parallel fifths or octaves between the tunes, " +
      pct(f.unisonShare || 0) + " unisons, " + f.nonChord + " notes off the chord on the beat, " + f.sour + " sour consonances" + (f.misaligned ? ", " + f.misaligned + " lines that do not line up" : "") +
      (f.where.length ? " — " + esc(f.where.join("; ")) : "") + ". " + (p.combined ? "Found on try " + h2.partner.tries + "." : "Tried " + h2.partner.tries + " times; the closing hymn stands on its own.") + "</p>") : "<p>" + esc(f.where.join("; ")) + "</p>";
    $("khl-partnerplay").disabled = !h2;
  }
  function playPartner() {
    var p = extra.partner, h1 = hymn; if (!p || !p.hymn) return;
    var h2 = p.hymn;
    stage(seedNow, function (S) {
      // the first hymn (one verse), the closing hymn (one verse), then — if they fit — the closing hymn again with the first played against it
      var t = playHymn(h1, "main", S, S.T0, { verses: 1, noAmen: true });
      t = playHymn(h2, "partner", S, t + 2, { verses: 1, noGivingOut: true, noAmen: true });
      if (!p.combined) return t + 2.5;
      t += 1.5;
      var beatS = h2.beatS / +$("khl-tempo").value, L2 = h2.lines.concat(h2.refrain || []), L1 = h1.lines.concat(h1.refrain || []), vowels = vowelsFor(S.seed, 7, 400);
      var tune = h2.partner.firstTune, base = KEYNOTE_HZ * ratio(h1.keyMonzo);
      L2.forEach(function (line, li) {
        var t0 = t, next = L2[li + 1] || null;
        t = S.singLine(h2, "partner", li, t0, line, next, beatS, function (e) { return e.n.syl != null ? vowels[e.n.syl] : null; },
                       { organ: D.get(h2.dialect).organ && $("khl-organ").checked, label: "together: the ward sings the closing hymn, the trumpet stop plays the first against it" });
        // the first tune on the organ's trumpet stop, an octave up, as the composer retuned it to these chords
        var l1 = { notes: { S: tune[li] }, startBeat: L1[li].startBeat, fermataBeats: line.fermataBeats, breathAfter: true, chords: [] };
        S.job(t0, function () {
          var notes = partEvents(l1, next, "S", t0, beatS).ev.map(function (e) { return { f: base * ratio(e.n.monzo) * 2, dur: e.dur, at: e.t - t0, v: 1 }; });
          S.withOrgan().play(t0, notes, "trumpet");
        });
        S.mark("main", li, h1, L1[li], L1[li + 1] || null, t0, beatS, "", [h1.melodyPart]);
      });
      return t + 2.5;
    });
  }
  // THE WANDERING REFRAIN: in the lilt, fitted to the day's keys (here: the
  // lab's key, a fourth up and a fifth down), in this hymn's dialect
  function composeRefrain() {
    var s = settings(), d = hymn ? hymn.dialect : "gospel", k0 = s.keyMonzo;
    var keys = [k0, [k0[0] + 2, k0[1] - 1, k0[2], k0[3]], [k0[0] + 1, k0[1] - 1, k0[2], k0[3]]];
    var r = C.wanderingRefrain(PJ2.Rand.stream(s.seed).fork("wandering"), { keys: keys, dialect: d, id: "h:1:4" });
    extra.refrain = r;
    // the same tune in each key of the day, set in the hymn's dialect
    r.inKeys = keys.map(function (km, i) { return i === 0 ? r.hymn : C.refrainIn(PJ2.Rand.stream(s.seed).fork("wandering:" + i), r, { dialect: d, keyMonzo: km, id: "h:1:4" }); });
    var where = ["in the lab's key", "a fourth up", "a fifth down"];
    $("khl-refrainout").innerHTML = miniCard(r.hymn, "refrain",
      '<p class="khl-note"><b>' + (r.fits ? "It sits well in every key of the day." : "It does not sit well in every key — see below.") + "</b> Compass " + r.compass + " semitones. " +
      r.keys.map(function (k, i) { return where[i] + ": " + (k.fits ? "✓" : "✗") + " (" + k.lo + " to " + k.hi + " semitones from middle C; the close on " + k.final + (k.closeInTess ? "" : ", low") + ")"; }).join(" · ") + "</p>");
    $("khl-refrainplay").disabled = false;
  }
  function playRefrain() {
    var r = extra.refrain; if (!r) return;
    stage(seedNow, function (S) {
      var t = S.T0;
      r.inKeys.forEach(function (h, i) {
        var beatS = h.beatS / +$("khl-tempo").value, vowels = vowelsFor(S.seed, 20 + i, 400), all = h.lines;
        all.forEach(function (line, li) {
          // (the first time, the enthusiast starts it alone — one tenor — and the ward has it by the second line)
          var alone = i === 0 && li === 0;
          t = S.singLine(h, i === 0 ? "refrain" : "none", li, t, line, all[li + 1] || null, beatS, function (e) { return e.n.syl != null ? vowels[e.n.syl] : null; },
                         { who: alone ? function (p) { return p.part === "T" && p.k === 0; } : null, assign: alone ? function () { return [h.melodyPart, h.melodyPart === "S" ? 0.5 : 1]; } : null, gain: alone ? 2.4 : 1,
                           label: "the wandering refrain, " + ["in the first hymn's key", "a fourth up, after a later hymn", "a fifth down, in the doxology"][i] + (alone ? " — the enthusiast starts it alone" : "") });
        });
        t += 2.2;
      });
      return t + 1;
    });
  }
  $("khl-roundbtn").addEventListener("click", composeRound);
  $("khl-roundplay").addEventListener("click", playRound);
  $("khl-partnerbtn").addEventListener("click", composePartner);
  $("khl-partnerplay").addEventListener("click", playPartner);
  $("khl-refrainbtn").addEventListener("click", composeRefrain);
  $("khl-refrainplay").addEventListener("click", playRefrain);

  // ==========================================================================
  // THE SPREAD — two dozen hymns, composed a few at a time so the page
  // breathes: do they all end alike? peak alike? measure like the book?
  // ==========================================================================
  $("khl-spreadbtn").addEventListener("click", function () {
    var s = settings(), N = 24, i = 0, out = $("khl-spreadout"), btn = this;
    var T = { lastTwo: {}, lastThree: {}, finalFigure: {}, lineEnd: {}, contour: {}, cadence: {}, meter: {}, peakLine: {}, hymnist: {}, opening: {}, kind: {} }, peaks = [], fps = [], fails = {};
    btn.disabled = true;
    function inc(t, k) { T[t][k] = (T[t][k] || 0) + 1; }
    function step() {
      for (var k = 0; k < 2 && i < N; k++, i++) {
        var h = C.compose(PJ2.Rand.stream(s.seed + 1 + i), { dialect: s.dialect, mode: s.mode, meter: s.meter, hymnist: s.hymnist, keyMonzo: s.keyMonzo, kind: s.kind });
        var r = h.report;
        inc("meter", h.meter); inc("hymnist", h.hymnist ? h.hymnist.nameEn : "—"); inc("peakLine", "line " + r.peak.line); if (h.kind) inc("kind", h.kind);
        r.lines.forEach(function (L) { inc("contour", L.contour); inc("cadence", L.cadence.split(" ")[0]); inc("lineEnd", solName(L.target, h.mode) + " by " + L.figure); if (L.role === "home") inc("finalFigure", L.figure); });
        inc("lastTwo", C.sungEnding(h, 2)); inc("lastThree", C.sungEnding(h, 3));
        var m = h.lines[0].notes[h.melodyPart].filter(function (x) { return x.syl !== null; }).map(function (x) { return x.deg; });
        inc("opening", m.slice(1, 5).map(function (d, j) { return d - m[j]; }).join(" "));
        peaks.push(r.peak.at); fps.push(r.fingerprint);
        r.checks.forEach(function (c) { if (!c.ok && c.hard) fails[c.name] = (fails[c.name] || 0) + 1; });
      }
      out.innerHTML = "<p class=\"khl-cap\">composed " + i + " of " + N + "…</p>";
      if (i < N) { setTimeout(step, 0); return; }
      btn.disabled = false;
      function line(t, name) {
        var tot = 0, arr = []; for (var k2 in T[t]) { tot += T[t][k2]; arr.push([k2, T[t][k2]]); }
        if (!arr.length) return "";
        arr.sort(function (a, b) { return b[1] - a[1]; });
        var H = 0; arr.forEach(function (x) { var p = x[1] / tot; H -= p * Math.log2(p); });
        return name + ": " + arr.length + " kinds, the commonest " + pct(arr[0][1] / tot) + " (" + arr[0][0] + "), entropy " + H.toFixed(2) + " bits\n    " + arr.slice(0, 8).map(function (x) { return x[0] + " " + x[1]; }).join(" · ");
      }
      var refs = C.references()[s.dialect], mean = {}, unison = D.get(s.dialect).parts.length === 1;
      C.FP_KEYS.filter(function (k2) { return !unison || !/^close|par5|thirdless|crossing|sevenths|septimal|stagger/.test(k2); }).forEach(function (k2) { mean[k2] = fps.reduce(function (a, f) { return a + (f.share[k2] || 0); }, 0) / fps.length; });
      var mn = Math.min.apply(null, peaks), mx = Math.max.apply(null, peaks), av = peaks.reduce(function (a, b) { return a + b; }, 0) / peaks.length;
      out.innerHTML = "<pre>" + esc([
        "(the endings AS SUNG, named from the final as if it were do; a comma marks a note below it)",
        line("lastTwo", "the hymn's last two notes"), line("lastThree", "the hymn's last three notes"), line("finalFigure", "the last line's ending figure (as drawn)"),
        line("lineEnd", "every line's ending (note, figure)"), line("opening", "the first line's opening intervals"),
        line("contour", "line contours"), line("cadence", "cadences"), line("meter", "meters"), line("hymnist", "hymnists"), line("peakLine", "where the peak falls (line)"), line("kind", "which unison song"),
        "the peak's place in the tune: " + pct(mn) + " to " + pct(mx) + ", mean " + pct(av) + " (planned 60–75%)",
        "measured, mean of " + N + " (Earth tunes' mean; tolerance): " + Object.keys(mean).map(function (k2) { var t = refs.tolerance[k2]; return k2 + " " + pct(mean[k2]) + " (" + (refs.tunes.length ? pct(refs.mean[k2]) : "—") + (t ? "; " + pct(t[0]) + "–" + pct(t[1]) : "") + ")"; }).join(" · "),
        "hard checks not passed: " + (Object.keys(fails).length ? Object.keys(fails).map(function (k2) { return k2 + " ×" + fails[k2]; }).join(", ") : "none"),
      ].filter(Boolean).join("\n")) + "</pre>";
    }
    step();
  });

  // ==========================================================================
  // WHAT TO LISTEN FOR — in plain words, per dialect
  // ==========================================================================
  var LISTEN = {
    tabernacle: [
      "<b>The Tabernacle</b> is the Latter-day Saint hymnal's own voice (Careless, Beesley, Stephens): the tune on top, the organ under the ward, warm full chords.",
      "Listen for: the organ giving out the last line first, then the congregation. Every line ends on a real cadence — a half close that leaves you leaning, a full close home at the end, the bass stepping sol–do beneath it; now and then the harmony slips aside (a <i>deceptive</i> close), leans on the dominant's own dominant for colour, or rests mid-verse on the IV or the vi chord, as the 1889 book does. At the end of a line the alto or tenor sometimes holds a note over the chord change and then settles (a <i>4–3 suspension</i>), and the tune now walks some of its thirds, two notes to a syllable. The highest note of the tune should come about two-thirds of the way through, not at the start.",
      "And after the last verse, the plagal <i>A-men</i> (the bass fa–do).",
    ],
    sacredharp: [
      "<b>The Sacred Harp</b> is the Georgia singing school's sound: loud, bright, raw. The tune is in the <i>tenor</i> (the men in the middle, doubled an octave up by some women), with the treble and bass as melodies of their own.",
      "Listen for: open fifths and bare octaves where you expect a sweet third; parts moving in parallel fifths (welcome here); most lines ending on a hollow, bare chord — and now and then on a single note, everyone in unison and octaves; in a major tune an inner line may close full, its third kept; no organ, no amen. The first verse is sung <i>on the notes</i> — fa, sol, la, mi — as the singing schools teach; the next on the words.",
    ],
    oldway: [
      "<b>The Old Way</b> is lining out: a precentor half-sings each line, and the congregation answers it extremely slowly, every singer decorating the tune in their own way — a slow cloud of voices, unmetered and haunting.",
      "Listen for: the single tune, never harmonized; the slides and turns at the places the composer marked (the small marks on the staff); the ward arriving a little unevenly. The staff lights with the precentor now, as well as with the ward. Turn off “lined out” to hear the ward alone.",
    ],
    psalmody: [
      "<b>New England psalmody</b> is Billings's Boston, the 1770s: the tune in the tenor, four rough-hewn parts in plain chords — until the <b>fuge</b>.",
      "Listen for the fuging line (marked on the staff and in the plan, usually the third): the <i>bass starts it alone</i> with the line's opening words and notes; half a bar or a bar later the <i>tenor</i> comes in with the same opening (it is the tune), then the <i>counter</i> (the alto), then the <i>treble</i> — the words overlapping, a four-way conversation — and all four land together on one written chord. The fuge is then sung a second time, as the books repeat it. Elsewhere: open fifths, a clash left standing where two lines pass, bare closes; no organ, no amen.",
    ],
    gospel: [
      "<b>Gospel and barbershop</b>: the parlour quartet and Moody and Sankey's revival hymns. The tune is the <i>lead</i>, the second voice from the top (the altos and some sopranos sing it); a tenor harmony floats above it, the baritone and the bass below.",
      "Listen for the <b>ringing sevenths</b>: dominant-seventh chords (marked ✦ under the staff) tuned on the seventh harmonic, 4:5:6:7 — the seventh a little lower than a piano's — so the chord seems to bloom and a faint fifth voice hums over it. They come in chains down the circle of fifths. Listen for <i>swipes</i> (marked ~): the lead holds one word while the chord turns under it. At a held line end the <i>men echo</i> the women's last words. A <i>refrain</i> after every verse, and at the end a <i>tag</i>: the lead holds home's note as a post while the chords turn round it, and the last chord rings.",
    ],
    shaker: [
      "<b>Shaker and Primary</b>: one tune, sung by everyone together, bright and plain, often in a dance time (two-four, six-eight).",
      "It is one of three kinds (shown above the staff): a <i>Shaker hymn</i>; a <i>gift song</i> — wordless, on syllables like “lo” and “dee”, two strains each sung twice, the way the Shakers' dancing songs were “received”; or a <i>Primary song</i> for the children, short, with a chorus, never wider than an octave. Sometimes a few men hum a <i>drone</i> on home's note (and its fifth) underneath. Listen for how singable it is: a tune you could have by heart after one hearing.",
    ],
  };
  function listenNote(h) {
    $("khl-listen").innerHTML = '<h2 class="khl-sec">What to listen for</h2>' + LISTEN[h.dialect].map(function (p) { return "<p>" + p + "</p>"; }).join("") +
      "<p>What you are hearing is the whole composer: the hymnist's habits leaned on the dice; each line's cadence, ending and the peak were drawn before a single note; the search filled the notes between; the dialect wrote the harmony; the checks (left) are what a tunebook's editor would send back. Try “compose another” a few times — no two should sound alike.</p>";
  }

  // (silent checks only) a tap on the limiter's output: while `on`, the next
  // performance is recorded into memory, so a muted headless browser can
  // measure what the room sends out
  TAP = {
    on: false, rec: [], sr: 48000,
    attach: function (ac, node) {
      if (!this.on) return;
      var self = this, sp = ac.createScriptProcessor(4096, 2, 2);
      self.rec = []; self.sr = ac.sampleRate;
      sp.onaudioprocess = function (e) { self.rec.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
      node.connect(sp); var sink = ac.createGain(); sink.gain.value = 0; sp.connect(sink); sink.connect(ac.destination);
    },
    samples: function () { var n = 0; this.rec.forEach(function (b) { n += b.length; }); var o = new Float32Array(n), i = 0; this.rec.forEach(function (b) { o.set(b, i); i += b.length; }); return o; },
  };

  // the page's handles, for the silent checks (tools, the critic)
  window.HymnLab = { compose: compose, play: play, stop: stop, level: level, hymn: function () { return hymn; },
                     round: function () { composeRound(); return extra.round; }, playRound: playRound,
                     partner: function () { composePartner(); return extra.partner; }, playPartner: playPartner,
                     refrain: function () { composeRefrain(); return extra.refrain; }, playRefrain: playRefrain, tap: TAP };
  compose();
  if (Q.has("play")) play();
})();

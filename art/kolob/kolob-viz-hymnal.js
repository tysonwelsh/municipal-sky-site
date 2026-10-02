// ============================================================================
// KOLOB — kolob-viz-hymnal.js: the hymnal on the staff
//
// One of the page's six files (kolob-viz.js raises KolobViz over them; THE
// SIX FILES there, and _viz.php's list): a composed hymn read from its Score
// as the hymnal prints it (below), a line at a time as kolob-viz-intake.js
// hands its notes over (scoreRoute, takeHymnLine); the fuging between the
// verses (takeFuging); the organ under the singing kept off the page
// (organAlone); the folds that keep a note on the plate (foldFor). Lends what
// the intake, the guests and the page read of it (the LENT block at the
// foot) — the ward's spans among them, which STOP cuts (wardSpans, by a
// getter and a setter); reads the conductor's report (VS.cond) and
// Johnston's switch (VS.TUNING_MARKS) from kolob-viz.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var K = window.KolobAudio;
  // The page's shared state. Each of the page's files lends what the others
  // need onto VS (the LENT block at its foot); a name written VS.x belongs to
  // another of them; a bare name is this file's own or borrowed below.
  var VS = window.KOLOB._viz = window.KOLOB._viz || {};

  // ---- BORROWED — the other files' functions, bound late through VS (every
  // file is loaded before the first frame, so the call always finds its owner;
  // each wrapper is named after the lend it calls and passes its arguments
  // through in order — tools/lends.js checks), and their values that are
  // never reassigned, taken once at load from a file loaded before this one ----
  // from kolob-viz-atlas.js
  function clamp(x, a, b) { return VS.clamp(x, a, b); }
  // from kolob-viz-intake.js
  function noteQ(freq) { return VS.noteQ(freq); }
  function posDir(heads, st) { return VS.posDir(heads, st); }
  function ledgerCost(st, q) { return VS.ledgerCost(st, q); }
  var Q_MID = VS.Q_MID;
  var groups = VS.groups;
  var CHOIR_LAYERS = VS.CHOIR_LAYERS;
  var GAP_T = VS.GAP_T;
  var GAP_B = VS.GAP_B;
  var TUNE_T = VS.TUNE_T;
  var TUNE_B = VS.TUNE_B;
  var marks = VS.marks;
  // (the other files' state, read through VS: VS.cond, VS.TUNING_MARKS)

  // ==========================================================================
  // THE HYMNAL ON THE STAFF (PLAN-ENGRAVING §4.3–§4.4)
  //
  // A composed hymn is not guessed at from its sound. The engine tells the
  // page each line with its Score as it hands the line to the voices
  // (verse-line: the Line as the composer wrote it, where it begins and the
  // beat it is sung to), and every note it sings names its part, its line
  // and its beat. So the page prints the hymn the way the hymnal prints it:
  //
  //  · the barlines of its mode of time, from the line's own place in the
  //    bar; a double bar where each line of the poem ends, and the final bar
  //    where the hymn ends (after the A-men, or after the last verse when
  //    the performance names how many it sings); each bar standing clear of
  //    the ink either side of it, the downbeat's notes making room for it
  //    where the page is tight (drawHymnBar);
  //  · every note at its written value — quarters, halves, dots, a whole in
  //    a Sacred Harp 3/2 — and the quick notes of one voice beamed within
  //    the beat of the mode of time instead of flagged; rests where a part
  //    is silent (the fuge's voices before they come in); fermatas where
  //    the Score holds, over the treble and under the bass; ties; a slur
  //    over the tune's melismas; an accidental where the Score alters a
  //    degree;
  //  · CLOSED SCORE, from the parts that sound (whoever sings them, and the
  //    organ doubling them under the Tabernacle's verses): the two upper
  //    voices on the treble, the upper's stems up and the lower's down, the
  //    two lower voices on the bass the same way; where the two on one
  //    staff move together through a beat they share their stems (the
  //    treble's up, the bass's down, as the tunebook sets them). The voices
  //    keep their order on the page: gospel's lead sings under its tenor, so
  //    there the tenor and the lead take the treble and the baritone and the
  //    bass the bass (kolob-dialects.js, GOSPEL.voiceOrder);
  //  · THE TUNE MARKED in every dialect that sings in parts, by a slightly
  //    heavier head: the soprano's in the Tabernacle, the tenor's in the
  //    Sacred Harp and the psalmody, the lead's in gospel — and the tune
  //    keeps its staff and its stem however high it climbs (a Sacred Harp
  //    tenor on its third ledger over the bass staff, its stem shortened,
  //    never turned: the gap between the staves is shared out with the tune
  //    first, shareGap);
  //  · the fuging between the verses, the voices entering one by one on the
  //    tune's head, printed as a free passage: its written values in the
  //    verse's beat, no barlines, the close under a fermata (takeFuging);
  //  · a unison (the Old Way, the Shaker's and the Primary's songs) as one
  //    line on the staff it sits best on, the Old Way's ornaments marked
  //    where the composer placed them — a turn, a slide into the note, a
  //    grace before it (each singer decorates them their own way: the sign
  //    says where, the ear hears how);
  //  · (optional, the owner's call) Ben Johnston's tuning marks before a
  //    head the colony tunes away from its spelling: − or + for a syntonic
  //    comma, 7 for the septimal seventh that rings. TUNING_MARKS, kolob-viz.js.
  //
  // The ward prints as its four parts however many sing them: the page
  // reads each part once, from the Score, and the notes only say which
  // parts sound and when. The organ under the singing is not printed, as in
  // hymnals; the organ alone (its giving-out of the tune, a prelude, a fill
  // between the lines, the house's own chords where no one sings) is.
  // Everything is green; nothing is text.
  // ==========================================================================
  var lastEndBar = null;                           // the last line's double bar, until the next line comes
  var wardSpans = [];                              // where the ward sings a composed line (the organ under it is not printed)
  var hymnBook = {}, hymnIds = [];                 // id → what the page knows of a hymn (its Score, from the engine)
  var VOICE_ORDER = { gospel: ["S", "T", "A", "B"] };
  var MELODY_PART = { sacredharp: "T", psalmody: "T", gospel: "T" };
  var DO_OF = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };   // (kolob-composer.js DO_OF, if the composer is absent)
  var SHAPE4 = ["fa", "sol", "la", "fa", "sol", "la", "mi"];                             // do re mi fa sol la ti, in four shapes

  function hymnOf(id) {
    var h = hymnBook[id];
    if (!h) {
      h = hymnBook[id] = { id: id };
      hymnIds.push(id);
      if (hymnIds.length > 16) delete hymnBook[hymnIds.shift()];
    }
    if (!h.score && K && K.getHymn) {
      var sc = null;
      try { sc = K.getHymn(id); } catch (e) { sc = null; if (K.confess) K.confess("the staff could not read hymn " + id + " from the hymnal", e); }
      if (sc && sc.lines) {
        h.score = sc;
        ["dialect", "mode", "keyMonzo", "modeOfTime", "melodyPart"].forEach(function (k) { if (h[k] == null && sc[k] != null) h[k] = sc[k]; });
      }
    }
    return h;
  }
  function announceHymn(hy) {
    var h = hymnOf(hy.id);
    ["dialect", "mode", "keyMonzo", "modeOfTime"].forEach(function (k) { if (hy[k] != null) h[k] = hy[k]; });
  }
  // (a verse's performance: the beat it is sung to, and — when the engine
  // names it — how many verses the hymn is sung to, so the last one ends on
  // the final bar)
  function verseBegins(ev) {
    var h = hymnOf(ev.hymnId), P = ev.performance || {};
    if (P.beatS > 0) h.bs = P.beatS;
    if (typeof P.verses === "number") h.verses = P.verses;
    else if (typeof ev.verses === "number") h.verses = ev.verses;
  }
  function lineKey(x) { return x.hymnId + "|" + x.verse + "|" + x.line + (x.amen ? "|a" : "") + (x.givingOut ? "|g" : ""); }
  // which notes the Score engraves: a composed hymn's (not a guest's, not
  // the fuging's head, which has no line), and of the organ's only its
  // giving-out; the organ under the ward only tells which parts sound
  function scoreRoute(n) {
    if (!n.hymnId || typeof n.beat !== "number" || n.line == null || n.fuging) return null;
    if (n.layer === "organ") {
      if (n.givingOut) return "line";
      if ((typeof n.verse === "number" && n.verse >= 0) || n.amen) return "under";
      return null;
    }
    return CHOIR_LAYERS[n.layer] ? "line" : null;
  }
  function doOf(mode) {
    var C = window.KOLOB && window.KOLOB.Composer, d = C && C.doOf ? C.doOf(mode) : null;
    return typeof d === "number" ? d : DO_OF[mode] || 0;
  }
  // the shape a degree is sung on (the same syllable the ward sings on the notes)
  function shapeOfDeg(mode, deg) { return SHAPE4[(((deg - doOf(mode)) % 7) + 7) % 7]; }
  function monzoCents(m) { return 1200 * ((m[0] || 0) + (m[1] || 0) * Math.log2(3) + (m[2] || 0) * Math.log2(5) + (m[3] || 0) * Math.log2(7)); }
  // the hymn's key, in staff steps from the day's keynote (a fourth up: three)
  function keySteps(m) { return m ? Math.round(monzoCents(m) * 7 / 1200) : 0; }
  // a note that names its degree in a composed hymn's key is placed by it,
  // not by its sound (a hymn keyed a fourth away would misspell): the
  // octave from its frequency, the step from its degree
  function taggedQ(n) {
    if (typeof n.deg !== "number" || !n.keyMonzo || !n.hymnId || !(CHOIR_LAYERS[n.layer] || n.layer === "organ")) return null;
    var h = hymnBook[n.hymnId], mode = (h && h.mode) || VS.cond.mode;
    var key = Math.pow(2, monzoCents(n.keyMonzo) / 1200), K0 = (VS.cond.f0 || 65) * 4;
    var oct = Math.round(Math.log2(n.freq / (K0 * key)) - n.deg / 7);
    return { q: Q_MID + keySteps(n.keyMonzo) + n.deg + 7 * oct, shape: shapeOfDeg(mode, n.deg) };
  }
  function timeSig(mot) {
    var m = /^(\d+)\/(\d+)$/.exec(mot || "");
    return m ? { bar: +m[1], den: +m[2] } : { bar: 4, den: 4 };
  }
  // a line's clock in beats (KOLOB.Score.lineClock, the performers' own, at
  // a beat of one; the page keeps its copy): a fermata holds its note
  // seven-tenths again and moves all that follows
  function unitsOf(line) {
    var holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var len = 1;
      Object.keys(line.notes).forEach(function (p) { (line.notes[p] || []).forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) len = Math.max(len, n.beats); }); });
      holds.push({ at: fb + len, extra: 0.7 * len });
    });
    return function (b) { var u = b; for (var i = 0; i < holds.length; i++) if (b >= holds[i].at - 1e-6) u += holds[i].extra; return u; };
  }
  // how long a line is, in beats: to where the next begins, or to its last note's end
  function spanBeats(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    var S = window.KOLOB && window.KOLOB.Score;
    if (S && S.lineLength) { try { var L = S.lineLength(line); if (L > 0) return L; } catch (e) { if (K && K.confess) K.confess("the staff could not measure a line (it measures by its last note)", e); } }
    var e = 0;
    Object.keys(line.notes).forEach(function (p) { (line.notes[p] || []).forEach(function (n) { e = Math.max(e, n.beat + n.beats); }); });
    return e;
  }
  // a written length (in whole notes) → the glyph that writes it
  var WVAL = [[2, "breve"], [1.5, "w", 1], [1, "w"], [0.75, "h", 1], [0.5, "h"], [0.375, "q", 1], [0.25, "q"],
              [0.1875, "e", 1], [0.125, "e"], [0.09375, "s", 1], [0.0625, "s"]];
  function writtenValue(w) {
    var pick = null, i;
    for (i = 0; i < WVAL.length && !pick; i++) if (Math.abs(WVAL[i][0] - w) < 1e-3) pick = WVAL[i];
    for (i = 0; i < WVAL.length && !pick; i++) if (WVAL[i][0] <= w + 1e-3) pick = WVAL[i];   // (the plainest glyph under it)
    if (!pick) pick = WVAL[WVAL.length - 1];
    if (pick[1] === "breve") return { open: true, stem: false, breve: true, dots: 0, flags: 0 };
    return { open: pick[1] === "w" || pick[1] === "h", stem: pick[1] !== "w", dots: pick[2] || 0, flags: pick[1] === "e" ? 1 : pick[1] === "s" ? 2 : 0 };
  }
  // the dialect's voices, top to bottom: the upper two on the treble, the
  // lower two on the bass, the upper of each pair stems up
  function staffPlan(dialect) {
    var o = VOICE_ORDER[dialect] || ["S", "A", "T", "B"], out = {};
    out[o[0]] = { st: "T", dir: 1 }; out[o[1]] = { st: "T", dir: -1 };
    out[o[2]] = { st: "B", dir: 1 }; out[o[3]] = { st: "B", dir: -1 };
    return out;
  }
  // where a line begins and the beat it goes at, from its notes, when no
  // verse-line told it (the organ's giving-out): t = t0 + beat·units(b)
  function fitClock(ns, U, bs0) {
    var us = ns.map(function (n) { return U(n.beat); }), ts = ns.map(function (n) { return n.startTime; });
    var mu = 0, mt = 0, i, k = ns.length;
    if (!k) return null;
    for (i = 0; i < k; i++) { mu += us[i]; mt += ts[i]; }
    mu /= k; mt /= k;
    var cov = 0, vr = 0;
    for (i = 0; i < k; i++) { cov += (us[i] - mu) * (ts[i] - mt); vr += (us[i] - mu) * (us[i] - mu); }
    var bs = vr > 1e-6 ? cov / vr : bs0;
    if (!(bs > 0.05)) {                                 // one chord alone: its length says the beat
      var r = ns.map(function (n) { return n.duration / Math.max(0.25, n.beats || 1); }).sort(function (a, b) { return a - b; });
      bs = r[r.length >> 1];
    }
    if (!(bs > 0.05)) return null;
    return { t0: mt - bs * mu, bs: bs };
  }

  // One composed line, taken in whole: its notes (and the organ under
  // them), and its verse-line when it came. → true when it is engraved
  var givenOut = [];                               // (the lines the organ has given out, engraved)
  function takeHymnLine(entries, ev) {
    var first = ev || (entries[0] && entries[0].n);
    if (!first || !first.hymnId) return false;
    var h = hymnOf(first.hymnId), sc = h.score;
    var li = first.line, verse = first.verse, amen = !!first.amen, giving = !ev && !!first.givingOut;
    var vl = sc ? sc.lines.concat(sc.refrain || []) : null;
    var line = ev && ev.score ? ev.score : !sc ? null : amen ? sc.amen : giving ? sc.lines[li] : vl[li];
    if (!line || !line.notes) return false;
    if (!entries.some(function (x) { return !x.under; })) return true;   // the organ under a line no one here sings: nothing to print
    var next = amen || giving || !vl ? null : vl[li + 1] || null;
    var dialect = (ev && ev.dialect) || h.dialect || "tabernacle";
    var mode = h.mode || VS.cond.mode;
    var keyM = (ev && ev.keyMonzo) || entries[0].n.keyMonzo || h.keyMonzo || [0, 0, 0, 0];
    var ts = timeSig(h.modeOfTime), bar0 = line.barStart || 0;
    var melody = h.melodyPart || MELODY_PART[dialect] || "S";
    var U = unitsOf(line), t0, bs;
    if (ev && ev.start != null && ev.beatS > 0) { t0 = ev.start; bs = ev.beatS; }
    else {
      var fit = fitClock(entries.map(function (x) { return x.n; }).filter(function (n) { return !n.octave; }), U, h.bs);
      if (!fit) return false;
      t0 = fit.t0; bs = fit.bs;
    }
    function T(b) { return t0 + U(b) * bs; }
    // the parts that sound: whoever sings them, and the organ under them
    var sounding = {}, np = 0;
    entries.forEach(function (x) {
      var p = x.n.layer === "organ" ? x.n.part : (x.n.sings || x.n.part);
      if (line.notes[p] && line.notes[p].length && !sounding[p]) { sounding[p] = 1; np++; }
    });
    if (!np) return false;
    var parts = Object.keys(sounding), multi = np > 1, plan = staffPlan(dialect), ks = keySteps(keyM);
    var layer = giving ? "organ" : "choir";
    var span = spanBeats(line, next), tEnd = T(span) + ((line.fermataBeats || []).length ? 0.3 * bs : 0);
    // (the organist gives the line out a chord at a time, and
    // each chord came here alone and engraved the whole line again from the
    // Score, its clock fitted from that one chord — two or three copies of
    // every chord, a hair or a beat apart, one over another: the doubled,
    // smeared notes at the head of every accompanied hymn. A line given out
    // is engraved once, from its first chord; the rest of its chords find it
    // already on the page)
    if (giving) {
      var gk = lineKey(first);
      if (givenOut.some(function (e) { return e.k === gk && t0 < e.t1 && T(span) > e.t0; })) return true;
      givenOut.push({ k: gk, t0: t0, t1: tEnd });
      if (givenOut.length > 40) givenOut.shift();
    }
    // a unison sits on the one staff it needs the fewest ledger lines on
    var single = null;
    if (!multi) {
      var cT = 0, cB = 0;
      line.notes[parts[0]].forEach(function (n) { cT += ledgerCost("T", Q_MID + ks + n.deg); cB += ledgerCost("B", Q_MID + ks + n.deg); });
      single = cT <= cB ? "T" : "B";
    }
    // the written notes — a note held over a barline is written as two,
    // tied across it (a note never crosses a barline)
    var W = [];
    function downbeatsIn(b, b1) {
      var out = [], d = b + (ts.bar - ((((b + bar0) % ts.bar) + ts.bar) % ts.bar));
      for (; d < b1 - 1e-6; d += ts.bar) if (d > b + 1e-6) out.push(d);
      return out;
    }
    parts.forEach(function (p) {
      var pl = plan[p] || { st: "T", dir: 1 }, ns = line.notes[p], tune = multi && p === melody;
      ns.forEach(function (n, j) {
        var q = Q_MID + ks + n.deg, st = single || pl.st, hop = false;
        if (!single) {                                  // (two ledgers into the gap at most: past that, the other staff —
          // but a step further, hanging under its second ledger, where the
          // other staff leaves the gap open then: deepOK, below. The TUNE
          // never crosses: a Sacred Harp tenor climbing to its high notes
          // stays on the bass staff on its third ledger, and a step over it,
          // its stem kept and shortened — the reader follows the melody on
          // one staff, as a closed-score hymnal prints it; only past that,
          // where its head would all but touch the other staff, does it go
          // over)
          var dT = tune ? TUNE_T : GAP_T - 1, dB = tune ? TUNE_B : GAP_B + 1;
          if (st === "T" && q < dT) { st = "B"; hop = true; }
          else if (st === "B" && q > dB) { st = "T"; hop = true; }
        }
        var cuts = [n.beat].concat(downbeatsIn(n.beat, n.beat + n.beats), [n.beat + n.beats]);
        for (var c = 0; c + 1 < cuts.length; c++) {
          var b = cuts[c], b1 = cuts[c + 1], last = c + 2 === cuts.length;
          W.push({ p: p, n: n, j: j, seg: c, b: b, b1: b1, q: q, st: st, hop: hop, dir: single || hop ? 0 : pl.dir,
                   w: (b1 - b) / ts.den, tp: T(b), dur: Math.max(0.05, T(b1) - T(b)),
                   heavy: tune, tied: c > 0 || (j > 0 && !!ns[j - 1].tie), tieOn: last ? !!n.tie : true,
                   head: null, grp: null });
        }
      });
    });
    // (a part a step deeper than two ledgers stays on its staff only if the
    // other staff has no note then reaching toward it; else it crosses)
    // (the tune past its second ledger stays unless a note of the other
    // staff then lies within a space and a half of it: two heads all but
    // touching across the gap, where it goes over after all)
    W.forEach(function (x) {
      if (single || x.hop || !x.heavy || !(x.st === "T" ? x.q < GAP_T - 1 : x.q > GAP_B + 1)) return;
      var other = x.st === "T" ? "B" : "T", ux = uOf(x.st, x.q);
      if (W.some(function (y) { return y.st === other && y.b < x.b1 - 1e-6 && y.b1 > x.b + 1e-6 && Math.abs(uOf(y.st, y.q) - ux) < 1.5; })) { x.st = other; x.hop = true; x.dir = 0; }
    });
    W.forEach(function (x) {
      var deep = x.st === "T" ? x.q < GAP_T : x.q > GAP_B;
      if (single || x.hop || !deep || x.heavy) return;
      var other = x.st === "T" ? "B" : "T", crowd = W.some(function (y) {
        return y !== x && y.st === other && y.b < x.b1 - 1e-6 && y.b1 > x.b + 1e-6 && (other === "B" ? y.q > Q_MID : y.q < Q_MID);
      });
      if (crowd) { x.st = other; x.hop = true; x.dir = 0; }
    });
    var win = ts.den === 8 ? 3 : 1;                    // the beat of the mode of time: a quarter, a half, or 6/8's dotted quarter
    function winOf(b) { return Math.floor((b + bar0) / win + 1e-6); }
    function mkHead(x, v) {
      var n = x.n, hd = { q: x.q, shape: shapeOfDeg(mode, n.deg), open: v.open, dots: v.dots, heavy: x.heavy };
      if (x.seg > 0) return hd;                      // (a tied continuation carries no signs)
      if (n.comma || n.septimal) hd.jm = { c: n.comma || 0, s7: !!n.septimal };
      if (n.ornament) hd.orn = n.ornament;
      if (n.ornament === "grace") hd.graceShape = shapeOfDeg(mode, n.deg + 1);   // (the grace is the step above: the performers' own)
      return hd;
    }
    var made = [], byGrpOn = {};
    ["T", "B"].forEach(function (st) {
      var xs = W.filter(function (x) { return x.st === st; });
      if (!xs.length) return;
      var voiceOf = {};
      xs.forEach(function (x) { if (!x.hop && x.dir) voiceOf[x.p] = x.dir; });
      var upper = null, lower = null;
      Object.keys(voiceOf).forEach(function (p) { if (voiceOf[p] > 0) upper = p; else lower = p; });
      var two = !!(upper && lower), together = {};
      xs.forEach(function (x) { x.two = two; });   // (a tie or slur of a voice that shares its staff keeps to the voice's side)
      if (two) {                                        // a beat through which the two voices move alike
        var on = {};
        xs.forEach(function (x) { if (x.hop) return; var k = winOf(x.b); (on[k] = on[k] || { U: [], L: [] })[x.p === upper ? "U" : "L"].push(x); });
        Object.keys(on).forEach(function (k) {
          var a = on[k].U, b = on[k].L;
          together[k] = a.length > 0 && a.length === b.length && a.every(function (x, i) {
            var y = b[i];
            return Math.abs(x.b - y.b) < 1e-6 && Math.abs(x.b1 - y.b1) < 1e-6 && x.tieOn === y.tieOn && (x.seg === 0 && !!x.n.fermata) === (y.seg === 0 && !!y.n.fermata);
          });
        });
      }
      var byOn = {};
      xs.forEach(function (x) { var k = Math.round(x.b * 1000); (byOn[k] = byOn[k] || []).push(x); });
      Object.keys(byOn).sort(function (a, b) { return a - b; }).forEach(function (k) {
        var here = byOn[k], sets = [];
        var tog = two && together[winOf(here[0].b)];
        here.forEach(function (x) {
          if (tog && !x.hop) {
            var s0 = sets.filter(function (s) { return s.voice === "both"; })[0];
            if (!s0) sets.push(s0 = { xs: [], voice: "both", dir: st === "T" ? 1 : -1 });
            s0.xs.push(x);
          } else sets.push({ xs: [x], voice: x.hop ? "hop" : two ? x.p : "one", dir: two && !x.hop ? x.dir : 0 });
        });
        // (the stem-down voice is set first: where the two lie a second
        // apart, the stem-up voice is the one moved over, as engravers do)
        sets.sort(function (a, b) { return (a.dir < 0 ? 0 : 1) - (b.dir < 0 ? 0 : 1); });
        var coAt = {};
        sets.forEach(function (set) {
          var v = writtenValue(set.xs[0].w), heads = [], seen = {}, dur = 0;
          set.xs.forEach(function (x) {
            dur = Math.max(dur, x.dur);
            if (seen[x.q]) { if (x.heavy) seen[x.q].heavy = true; x.head = seen[x.q]; return; }   // unison parts share a head
            x.head = seen[x.q] = mkHead(x, v);
            heads.push(x.head);
          });
          var grp = { layer: layer, tp: set.xs[0].tp, dur: dur, st: st, heads: heads, v: v, scale: 1, dir: set.dir,
                      noStem: !v.stem, flags: v.flags, hymn: true, voice: set.voice, win: winOf(set.xs[0].b), xs: set.xs, lead: 0,
                      tune: set.xs.some(function (x) { return x.heavy; }) };
          if (!grp.dir) grp.dir = posDir(heads, st);
          // two voices on one note of one length: one head, two stems (the lower voice's head is the upper's,
          // and goes where it goes: coOf)
          if (set.voice !== "both" && set.voice !== "hop" && set.voice !== "one" && heads.length === 1) {
            var ck = heads[0].q + "|" + v.open + "|" + v.dots;
            if (coAt[ck]) { heads[0].ghost = true; grp.noCol = true; grp.coOf = coAt[ck]; }
            else coAt[ck] = grp;
          }
          set.xs.forEach(function (x) { x.grp = grp; });
          groups.push(grp);
          made.push(grp);
          (byGrpOn[st + "|" + k] = byGrpOn[st + "|" + k] || []).push(grp);
        });
      });
      // accidentals: an altered degree, or its return, once in a bar
      var state = {};
      xs.slice().sort(function (a, b) { return a.b - b.b; }).forEach(function (x) {
        if (x.tied || !x.head || x.head.ghost) return;
        var key = Math.floor((x.b + bar0) / ts.bar + 1e-6) + ":" + x.q, alt = x.n.alt || 0, was = state[key] || 0;
        if (alt !== was) x.head.acc = alt > 0 ? "s" : alt < 0 ? "f" : "n";
        state[key] = alt;
      });
      // beams: one voice's quick notes, within one beat, with no rest between
      var runs = {};
      made.forEach(function (gp) { if (gp.st === st && gp.voice !== "hop") (runs[gp.voice + "|" + gp.win] = runs[gp.voice + "|" + gp.win] || []).push(gp); });
      Object.keys(runs).forEach(function (rk) {
        var gs = runs[rk].sort(function (a, b) { return a.tp - b.tp; }), cur = [];
        function close() { if (cur.length >= 2) makeBeam(cur, st); cur = []; }
        gs.forEach(function (gp) {
          if (gp.flags >= 1 && gp.v.stem) {
            var last = cur[cur.length - 1];
            if (last && Math.abs(last.xs[0].b1 - gp.xs[0].b) > 1e-6) close();
            cur.push(gp);
          } else close();
        });
        close();
      });
    });
    // how far each group's ink reaches left of its head (a barline stands clear of it)
    made.forEach(function (gp) {
      var lead = 0.64;
      gp.heads.forEach(function (hd) {
        var l = 0.64 + (hd.acc ? 1.25 : 0) + (VS.TUNING_MARKS && hd.jm ? 0.85 * ((hd.jm.c ? 1 : 0) + (hd.jm.s7 ? 1 : 0)) : 0) + (hd.orn === "grace" || hd.orn === "slide" ? 1.3 : 0);
        lead = Math.max(lead, l);
      });
      gp.lead = lead;
    });
    // the staves this line prints on
    var sts = {};
    W.forEach(function (x) { sts[x.st] = 1; });
    var stList = ["T", "B"].filter(function (s) { return sts[s]; });
    var sys = { hymnId: h.id, tp: t0, tp1: tEnd };
    // rests, where a part that sings in this line is silent (they join the
    // page after the bars, so a rest just after a barline is set from it)
    var restAt = {}, restMarks = [];
    parts.forEach(function (p) {
      var ns = line.notes[p], t = 0, gaps = [];
      ns.forEach(function (n) { if (n.beat > t + 1e-6) gaps.push([t, n.beat]); t = Math.max(t, n.beat + n.beats); });
      if (span > t + 1e-6) gaps.push([t, span]);
      var st = single || (plan[p] || { st: "T" }).st, dir = single ? 0 : (plan[p] || { dir: 0 }).dir;
      var both = !single && parts.some(function (o) { return o !== p && (plan[o] || {}).st === st; });
      gaps.forEach(function (gp) {
        var a = gp[0];
        while (a < gp[1] - 1e-6) {
          var into = (((a + bar0) % ts.bar) + ts.bar) % ts.bar, nb = a + (ts.bar - into);
          var e = Math.min(gp[1], nb), whole = (e - a) / ts.den, full = Math.abs((e - a) - ts.bar) < 1e-6;
          (full ? [{ v: 1, at: 0, full: true }] : splitRest(whole)).forEach(function (r) {
            var ra = a + r.at * ts.den, re = full ? e : ra + r.v * ts.den, key = st + "|" + Math.round(ra * 1000) + "|" + r.v;
            var voice = both ? (dir > 0 ? "U" : "L") : "C";
            if (restAt[key]) { if (restAt[key].voice !== voice) { restAt[key].voice = "C"; restAt[key].q = restQ(st, full ? 1 : r.v, "C", null); } return; }
            // (a voice's rest stands clear of the other voice's notes sounding over it)
            var qs = W.filter(function (x) { return x.st === st && x.p !== p && x.b < re - 1e-6 && x.b1 > ra + 1e-6; }).map(function (x) { return x.q; });
            restMarks.push(restAt[key] = { kind: "rest", tp: T(ra), st: st, v: r.v, full: !!r.full, voice: voice, q: restQ(st, full ? 1 : r.v, voice, qs), sys: sys });
          });
          a = e;
        }
      });
    });
    // barlines: every downbeat inside the line, and the line's end
    var lastLine = !amen && !giving && vl && li === vl.length - 1;
    var final = amen || (lastLine && !(sc && sc.amen) && typeof h.verses === "number" && verse === h.verses - 1);
    // (each bar knows the notes either side of it, so that on a crowded
    // page it stands between their inks: drawHymnBar — before it, every note
    // begun in the two seconds before it whose ink might reach it: a quarter
    // stemmed up beside the beamed eighths of the other voice as much as the
    // last eighth)
    function before(bb) {
      var tb = T(bb);
      return made.filter(function (gp) { return gp.xs[0].b < bb - 1e-6 && gp.tp > tb - 2; });
    }
    // (and the rests just before it: their ink is the bar's to clear too)
    function restsBefore(tb) { return restMarks.filter(function (r) { return r.tp < tb - 1e-6 && r.tp > tb - 4; }); }
    var b = (ts.bar - (bar0 % ts.bar)) % ts.bar;
    if (b < 1e-6) b = ts.bar;
    for (; b < span - 1e-6; b += ts.bar) {
      var lead = 0, nx = [];
      stList.forEach(function (st) { (byGrpOn[st + "|" + Math.round(b * 1000)] || []).forEach(function (gp) { lead = Math.max(lead, gp.lead); nx.push(gp); }); });
      var bm = { kind: "bar", type: "single", tp: T(b), sts: stList, off: lead ? -(lead + 0.55) : 0, pv: before(b), pvRests: restsBefore(T(b)), nx: nx, sys: sys };
      // the notes on the downbeat make room for their bar if they must (placeColumn),
      // and a rest there stands after it
      nx.forEach(function (gp) { gp.barIn = bm; });
      restMarks.forEach(function (r) { if (Math.abs(r.tp - bm.tp) < 1e-6) r.barIn = bm; });
      marks.push(bm);
    }
    // (the double bar stands just before the next line's first note; the
    // final bar where the last note's written length ends)
    var endBar = { kind: "bar", type: final ? "final" : "double", tp: final ? T(span) : tEnd, sts: stList, off: final ? 0 : -1.35, pv: before(span + 1), pvRests: restsBefore(T(span) + 1e-3), nx: null, sys: sys };
    marks.push(endBar);
    restMarks.forEach(function (r) { marks.push(r); });
    // the line before's double bar learns this line's first notes: it stands
    // clear of them too (they make room for it, as for any bar)
    var le = lastEndBar;
    if (le && le.sys.hymnId === h.id && t0 - le.tp > -1.5 && t0 - le.tp < 4 && made.length) {
      var fb0 = Math.min.apply(null, made.map(function (gp) { return gp.xs[0].b; }));
      le.nx = made.filter(function (gp) { return Math.abs(gp.xs[0].b - fb0) < 1e-6 && !gp.barIn; });
      le.nx.forEach(function (gp) { gp.barIn = le; });
    }
    lastEndBar = final ? null : endBar;
    // fermatas: over the treble, under the bass (over a unison)
    var fbs = {};
    W.forEach(function (x) { if (x.n.fermata && x.seg === 0) fbs[Math.round(x.b * 1000)] = x.b; });
    (line.fermataBeats || []).forEach(function (fb) { fbs[Math.round(fb * 1000)] = fb; });
    Object.keys(fbs).forEach(function (k) {
      stList.forEach(function (st) {
        var gs = byGrpOn[st + "|" + k], up = single ? true : st === "T";
        if (!gs || !gs.length) return;
        gs.forEach(function (gp) { gp.ferm = up ? 1 : -1; });   // (its stem leaves the fermata room at the plate's edge)
        marks.push({ kind: "ferm", tp: T(fbs[k]), st: st, up: up, grps: gs, sys: sys });
      });
    });
    // ties, and the slur over a melisma of the tune
    // (where two voices share the staff, the upper voice's
    // curve lies above and the lower's below — each on its own side, as an
    // engraver sets them; alone on its staff, its stems decide: settleCurve)
    function vside(x) { return x.two && !x.hop && x.dir ? (x.dir > 0 ? -1 : 1) : 0; }
    parts.forEach(function (p) {
      var xs = W.filter(function (x) { return x.p === p; }).sort(function (a, b) { return a.b - b.b; });
      xs.forEach(function (x, i) {
        var y = xs[i + 1];
        if (x.tieOn && y && x.grp && y.grp && x.st === y.st) marks.push({ kind: "tie", tp: x.tp, tp2: y.tp, g1: x.grp, g2: y.grp, q1: x.q, q2: y.q, st: x.st, sys: sys, vside: vside(x) });
      });
      if (p !== melody) return;
      function cont(x) { return x.n.syl == null || x.seg > 0; }   // (a melisma's later notes; a tied note's continuation)
      for (var i = 0; i < xs.length; i++) {
        if (cont(xs[i])) continue;
        var j = i;
        while (j + 1 < xs.length && cont(xs[j + 1])) j++;
        var allTied = true;
        for (var k2 = i; k2 < j; k2++) if (!xs[k2].tieOn) allTied = false;
        if (j > i && !allTied && xs[i].st === xs[j].st) marks.push({ kind: "slur", tp: xs[i].tp, tp2: xs[j].tp, g1: xs[i].grp, g2: xs[j].grp, q1: xs[i].q, q2: xs[j].q, st: xs[i].st, sys: sys,
          vside: vside(xs[i]), line: xs.slice(i, j + 1).map(function (x) { return x.grp; }).filter(function (gp, k, a) { return gp && a.indexOf(gp) === k; }) });
        i = j;
      }
    });
    shareRoom(made);
    if (!giving) wardSpans.push({ tp0: t0, tp1: tEnd });
    if (wardSpans.length > 60) wardSpans.splice(0, wardSpans.length - 60);
    return true;
  }
  // Where a rest stands on its staff (its anchor, in steps): the whole
  // rest hangs from the fourth line, the half sits on the middle line, the
  // others on the middle line; a voice's own rest, when two share the
  // staff, is raised (the upper voice's) or lowered (the lower's) a line,
  // and further if the other voice's notes over it would touch it.
  var REST_EXT = { rest1: [-1, 0], rest2: [0, 1], rest4: [-3, 3], rest8: [-2, 1.5], rest16: [-3, 1.5] };   // [below, above] the anchor, in steps
  function restName(v) { return (REST_OF[v] || REST_OF[0.25])[0]; }
  function restQ(st, v, voice, qs) {
    var nm = restName(v), mid = st === "T" ? 16 : 4, ext = REST_EXT[nm], onLine = nm === "rest1" || nm === "rest2";
    var q = (nm === "rest1" ? mid + 2 : mid) + (voice === "U" ? 2 : voice === "L" ? -2 : 0);
    if (qs && qs.length) {
      if (voice === "U") { var lo = Math.max.apply(null, qs) + 2 - ext[0]; if (q < lo) q = onLine ? Math.ceil(lo / 2) * 2 : Math.ceil(lo); }
      if (voice === "L") { var hi = Math.min.apply(null, qs) - 2 - ext[1]; if (q > hi) q = onLine ? Math.floor(hi / 2) * 2 : Math.floor(hi); }
    }
    return q;
  }
  // The gap between the staves, shared out note by note: a treble stem may
  // reach down into it as far as the bass's ink at that moment allows (and
  // a bass stem up as far as the treble's). Where both staves send a stem
  // into the gap at once, the gap is divided between them (shareGap):
  // at the telegraph's line when both stems fit;
  // else moved so that each keeps a stem — the tune's first
  function shareRoom(made) {
    made.forEach(function (gp) {
      gp.gapIn = !!(gp.v.stem && (gp.st === "T" ? gp.dir < 0 : gp.dir > 0));
      gp.uNear = null;
      gp.heads.forEach(function (hd) { var u = uOf(gp.st, hd.q); gp.uNear = gp.uNear == null ? u : gp.st === "T" ? Math.min(gp.uNear, u) : Math.max(gp.uNear, u); });
    });
    // (a beam's notes share one stem height: each asks for room from the
    // beam's head nearest the gap, and a little more, for the beam itself)
    made.forEach(function (gp) {
      if (!gp.beam || gp.beam.shared) return;
      var bm = gp.beam, u = null;
      bm.shared = true;
      bm.members.forEach(function (m) { if (m.uNear != null) u = u == null ? m.uNear : bm.st === "T" ? Math.min(u, m.uNear) : Math.max(u, m.uNear); });
      bm.members.forEach(function (m) { m.uNear = u; m.want = GAP_WANT + 0.4; });
    });
    made.forEach(function (gp) {
      var other = gp.st === "T" ? "B" : "T", qx = null, facing = [];
      made.forEach(function (o2) {
        if (o2.st !== other || Math.abs(o2.tp - gp.tp) > 0.35) return;
        if (o2.gapIn) facing.push(o2);
        o2.heads.forEach(function (hd) { qx = qx == null ? hd.q : other === "B" ? Math.max(qx, hd.q) : Math.min(qx, hd.q); });
      });
      gp.room = { q: qx, div: null };
      if (!gp.gapIn) return;
      facing.forEach(function (o2) {
        var d = gp.st === "T" ? shareGap(gp, o2) : shareGap(o2, gp);
        if (d == null) return;
        if (gp.room.div == null) gp.room.div = d;
        else gp.room.div = gp.st === "T" ? Math.max(gp.room.div, d) : Math.min(gp.room.div, d);
      });
    });
  }
  // Heights in the gap, in staff spaces over the bass staff's top line: the
  // treble's bottom line at 5, the telegraph's holes at 2.5. (The same at
  // every staff size, so a line's sharing of the gap is worked out once.)
  function uOf(st, q) { return st === "T" ? 5 + (q - 12) / 2 : (q - 8) / 2; }
  // Two stems in the gap at once, the treble's down (tg) and the bass's up
  // (bg): where they divide it (a height each stays 0.3 sp clear of), or
  // null when they do not meet — each then runs as far as the other staff's
  // heads allow, beside the other's stem if they pass. The division is the
  // telegraph's line where both keep a stem there; else it moves toward the
  // one that has room to give, the tune keeping at least 2.2 sp of stem (2.6
  // under a beam, its want) and the other voice at least 1.3; where even
  // that will not fit, the tune has
  // what it needs and the other voice what is left (layoutGroup turns an
  // other voice's stem that is left under 1.3 sp; the tune's never turns).
  var GAP_WANT = 2.2, GAP_MIN = 1.3;
  function shareGap(tg, bg) {
    var uT = tg.uNear, uB = bg.uNear;
    var eT = Math.max(uT - 3.5, uB + 0.95, 0.45), eB = Math.min(uB + 3.5, uT - 0.95, 4.55);
    if (eB + 0.6 <= eT) return null;
    var lo = uB + (bg.tune ? bg.want || GAP_WANT : GAP_MIN) + 0.3, hi = uT - (tg.tune ? tg.want || GAP_WANT : GAP_MIN) - 0.3;
    if (lo <= hi) return clamp(2.5, lo, hi);
    var lo2 = uB + GAP_MIN + 0.3, hi2 = uT - GAP_MIN - 0.3;   // (no room for the tune's 2.2: all the other voice can give)
    if (lo2 > hi2) return null;
    return bg.tune ? hi2 : lo2;
  }
  // a silent stretch as rests, in whole-note units (the plainest values,
  // largest first: hymn-lab's)
  function splitRest(w) {
    var V = [1, 0.75, 0.5, 0.375, 0.25, 0.1875, 0.125, 0.0625], out = [], at = 0;
    while (w > 1e-6) {
      var v = V.filter(function (x) { return x <= w + 1e-6; })[0];
      if (!v) break;
      out.push({ v: v, at: at }); at += v; w -= v;
    }
    return out;
  }
  // a beam: the groups it joins, and the stem it turns them to — a voice's
  // own where two share the staff apart, the shared one where they move
  // together, else the position rule over the whole group
  function makeBeam(gs, st) {
    var v = gs[0].voice, bm = { members: gs.slice(), st: st, fixed: v === "one" ? 0 : gs[0].dir, geo: null };
    gs.forEach(function (gp) { gp.beam = bm; });
  }
  // The fuging between the verses: the voices go out one by one on the
  // tune's first notes, a few seconds apart, and gather into the dialect's
  // close. Its entries come by the second, not by the bar (the engine
  // staggers them 2.4–3.2 s), so the page prints it as a hymnal prints a
  // free passage: no barlines inside it; each voice's notes at their
  // written values in the verse's own beat, its quick notes beamed within
  // its beat; the voices in closed score as in the verses (the stems by
  // part, the tune's heads heavier); the close as two chords in whole
  // notes, a fermata over the last, and a double bar after it. → false
  // while the hymn's beat is not known (the old reading then prints it)
  function takeFuging(ns) {
    var h = hymnBook[ns[0].hymnId];
    if (!h || !(h.bs > 0.05)) return false;
    var bs = h.bs, ts = timeSig(h.modeOfTime), dialect = h.dialect || "tabernacle", plan = staffPlan(dialect);
    var melody = h.melodyPart || MELODY_PART[dialect] || "S", win = ts.den === 8 ? 3 : 1;
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    function partOf(n) { return n.sings || n.part; }
    function onKey(n) { return Math.round(n.startTime * 50); }
    // the close: the chords at its end, where the voices sing together
    var ons = [], byOn = {};
    ns.forEach(function (n) { var k = onKey(n); if (!byOn[k]) { byOn[k] = []; ons.push(k); } byOn[k].push(n); });
    var close = {}, nClose = 0;
    for (var i = ons.length - 1; i >= 0 && nClose < 2 && byOn[ons[i]].length >= 2; i--) { close[ons[i]] = ++nClose; }
    var parts = {};
    ns.forEach(function (n) { parts[partOf(n)] = 1; });
    var multi = Object.keys(parts).length > 1, made = [], t0 = ns[0].startTime, tEnd = t0;
    ns.forEach(function (n) { tEnd = Math.max(tEnd, n.startTime + n.duration); });
    var sys = { hymnId: h.id, tp: t0, tp1: tEnd };
    function placeOf(n, tune, pl) {                  // its staff and step (the tune keeps its staff, as in the verses)
      var tq = taggedQ(n) || noteQ(n.freq), st = pl.st, hop = false;
      if (multi) {
        if (st === "T" && tq.q < (tune ? TUNE_T : GAP_T - 1)) { st = "B"; hop = true; }
        else if (st === "B" && tq.q > (tune ? TUNE_B : GAP_B + 1)) { st = "T"; hop = true; }
      }
      return { q: tq.q, shape: tq.shape, st: st, hop: hop };
    }
    // each voice's entry, beamed in the entry's own beat
    var byPart = {};
    ns.forEach(function (n) { if (!close[onKey(n)]) (byPart[partOf(n)] = byPart[partOf(n)] || []).push(n); });
    Object.keys(byPart).forEach(function (p) {
      var pl = plan[p] || { st: "T", dir: 1 }, tune = multi && p === melody, e0 = byPart[p][0].startTime, run = [];
      byPart[p].forEach(function (n) {
        var at = placeOf(n, tune, pl), beats = Math.max(0.25, Math.round(n.duration / bs * 4) / 4), v = writtenValue(beats / ts.den);
        var grp = { layer: n.layer, tp: n.startTime, dur: n.duration, st: at.st, heads: [{ q: at.q, shape: at.shape, open: v.open, dots: v.dots, heavy: tune }],
                    v: v, scale: 1, dir: at.hop || !multi ? 0 : pl.dir, noStem: !v.stem, flags: v.flags, hymn: true,
                    voice: at.hop ? "hop" : multi ? p : "one", win: Math.floor((n.startTime - e0) / bs / win + 1e-6), tune: tune, lead: 0 };
        if (!grp.dir) grp.dir = posDir(grp.heads, at.st);
        groups.push(grp); made.push(grp);
        var last = run[run.length - 1], quick = grp.flags >= 1 && grp.v.stem && !at.hop;
        if (quick && last && last.win === grp.win && last.st === grp.st && Math.abs(last.tp + last.dur - grp.tp) < 0.05) run.push(grp);
        else { if (run.length >= 2) makeBeam(run, run[0].st); run = quick ? [grp] : []; }
      });
      if (run.length >= 2) makeBeam(run, run[0].st);
    });
    // the close: on each staff, its voices' heads together
    var wv = writtenValue(1), lastGs = [];
    ons.forEach(function (k) {
      if (!close[k]) return;
      var onSt = {};
      byOn[k].forEach(function (n) {
        var p = partOf(n), pl = plan[p] || { st: "T", dir: 1 }, tune = multi && p === melody, at = placeOf(n, tune, pl);
        var o = onSt[at.st] = onSt[at.st] || { heads: [], ps: {}, dur: 0, tp: n.startTime };
        o.ps[p] = pl.dir; o.dur = Math.max(o.dur, n.duration);
        var same = o.heads.filter(function (hd) { return hd.q === at.q; })[0];
        if (same) { if (tune) same.heavy = true; return; }
        o.heads.push({ q: at.q, shape: at.shape, open: true, dots: 0, heavy: tune });
      });
      var gs = [];
      Object.keys(onSt).forEach(function (st) {
        var o = onSt[st], two = Object.keys(o.ps).length > 1;
        var grp = { layer: byOn[k][0].layer, tp: o.tp, dur: o.dur, st: st, heads: o.heads, v: wv, scale: 1, dir: two ? (st === "T" ? 1 : -1) : 0,
                    noStem: true, flags: 0, hymn: true, voice: two ? "both" : "one", win: 0, tune: o.heads.some(function (hd) { return hd.heavy; }), lead: 0 };
        if (!grp.dir) grp.dir = posDir(o.heads, st);
        groups.push(grp); made.push(grp); gs.push(grp);
      });
      if (close[k] === 1) lastGs = gs;           // (the last chord: numbered from the end)
    });
    lastGs.forEach(function (gp) {
      gp.ferm = gp.st === "T" ? 1 : -1;
      marks.push({ kind: "ferm", tp: gp.tp, st: gp.st, up: gp.st === "T", grps: [gp], sys: sys });
    });
    shareRoom(made);
    // the double bar after the close (and before the verse that follows)
    var sts = {};
    made.forEach(function (gp) { sts[gp.st] = 1; });
    var tLast = lastGs.length ? lastGs[0].tp : t0;
    var endBar = { kind: "bar", type: "double", tp: tEnd, sts: ["T", "B"].filter(function (st) { return sts[st]; }), off: -1.35,
                   pv: made.filter(function (gp) { return gp.tp >= tLast - 1e-6; }), pvRests: [], nx: null, sys: sys };
    marks.push(endBar);
    lastEndBar = endBar;
    wardSpans.push({ tp0: t0, tp1: tEnd });
    return true;
  }
  // The organ alone. Its notes are printed only where no one sings over
  // them — under a composed line of the ward, or under the choir's own
  // singing, the organ doubles what the page already shows (as a hymnal
  // prints no accompaniment). Decided once, when the note is first reached.
  function organAlone(gr) {
    for (var i = 0; i < wardSpans.length; i++) if (gr.tp >= wardSpans[i].tp0 - 0.3 && gr.tp <= wardSpans[i].tp1 + 0.3) return false;
    for (i = 0; i < groups.length; i++) {
      var o = groups[i];
      if (!CHOIR_LAYERS[o.layer] || o.ring) continue;
      if (o.tp <= gr.tp + 0.25 && o.tp + o.dur >= gr.tp - 0.05) return false;
    }
    return true;
  }

  // Beyond the ledger room a group folds in silently by octaves until it
  // fits the plate (no 8va: the owner wants just the notes). The fold is
  // decided at draw time, so a resize re-folds it. A voice that keeps above
  // the ledger room keeps its shape: a note that would fold less than the
  // voice's last folded note, close behind it, folds as far (if it still
  // sits on or near the staff). A Question's asking (shelved) folds as one phrase.
  // The gap is the telegraph's: no stem ever crosses its middle. So a fold
  // never carries a head into the gap (nothing is lifted over the bass
  // staff's ledger-free space, q9, or sunk under the treble's, q11), and a
  // head that would sit more than two ledgers into the gap, on the
  // telegraph's line (a part kept on its own staff: a trombone tenor high
  // over the bass staff), folds back toward its staff. When folding a
  // whole chord would carry a head into the gap (a trombone chord whose
  // bass drops under the plate while its tenor sits high), or a head lies
  // too deep in it, the chord folds head by head, each only as far as it
  // needs: the tenor stays where it is and the bass comes up an octave.
  var lastFold = {};
  var FOLD_B = 9, FOLD_T = 11;                     // no fold carries a head past these into the gap
  function foldFor(grp, g) {
    if (grp.fold && grp.fold.sp === g.sp) return grp.fold;
    var hi = -1e9, lo = 1e9, sh = 0, tr = grp.st === "T";
    grp.heads.forEach(function (h) { hi = Math.max(hi, h.q); lo = Math.min(lo, h.q); });
    // (a composed hymn's note may hang a step under the second ledger: its
    // line knew the other staff left room there — takeHymnLine; its tune
    // goes a step past the third)
    var gT = grp.hymn ? (grp.tune ? TUNE_T : GAP_T - 1) : GAP_T, gB = grp.hymn ? (grp.tune ? TUNE_B : GAP_B + 1) : GAP_B;
    var deep = tr ? lo < gT : hi > gB;             // a head on the telegraph's line
    if (tr) { while (hi - sh > g.qMaxT) sh += 7; }
    else { while (lo + sh < g.qMinB) sh += 7; }
    var key = grp.layer + grp.st, lf = lastFold[key];
    if (sh && lf && lf.sp === g.sp && grp.tp - lf.tp1 < 1.2 && lf.sh > sh &&
        (tr ? lo - lf.sh >= 9 : hi + lf.sh <= 11)) sh = lf.sh;
    var per = null;
    if (deep || (sh && (tr ? lo - sh < FOLD_T : hi + sh > FOLD_B))) {
      per = []; sh = 0;                            // head by head: only a head off the plate, or too deep in the gap, folds
      grp.heads.forEach(function (h) {
        var d = 0;                                 // this head's move, in steps (up +)
        if (tr) { while (h.q + d > g.qMaxT) d -= 7; while (h.q + d < gT) d += 7; }
        else { while (h.q + d < g.qMinB) d += 7; while (h.q + d > gB) d -= 7; }
        per.push(d);
        sh = Math.max(sh, tr ? -d : d);            // (the voice's shape follows the plate-edge folds only)
      });
      if (!per.some(function (d) { return d; })) per = null;
    }
    if (sh) lastFold[key] = { sp: g.sp, sh: sh, tp1: grp.tp + grp.dur };
    grp.fold = { sp: g.sp, oct: per ? 0 : sh / 7, per: per, heads: null };
    return grp.fold;
  }
  // the heads as they print, folded (two parts folded onto one line print
  // one head)
  function drawnHeads(grp, g) {
    var f = foldFor(grp, g);
    if (!f.oct && !f.per) return grp.heads;
    if (f.heads) return f.heads;
    var dq = grp.st === "T" ? -7 : 7, seen = {}, out = [];
    grp.heads.forEach(function (h, i) {
      var q = h.q + (f.per ? f.per[i] : dq * f.oct);
      if (seen[q]) return;
      seen[q] = 1;
      var c = {};
      for (var k in h) c[k] = h[k];                // (its weight, its marks, its ornament go with it)
      c.q = q;
      out.push(c);
    });
    f.heads = out;
    return out;
  }
  // the rest that writes each length (in whole notes) and its dots: restName,
  // above, names a hymn's rests by it, and kolob-viz.js's drawRest strikes them
  var REST_OF = { 1: ["rest1", 0], 0.75: ["rest2", 1], 0.5: ["rest2", 0], 0.375: ["rest4", 1], 0.25: ["rest4", 0], 0.1875: ["rest8", 1], 0.125: ["rest8", 0], 0.0625: ["rest16", 0] };

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  Object.defineProperty(VS, "wardSpans", { enumerable: true, configurable: true, get: function () { return wardSpans; }, set: function (v) { wardSpans = v; } });
  VS.hymnOf = hymnOf;
  VS.announceHymn = announceHymn;
  VS.verseBegins = verseBegins;
  VS.lineKey = lineKey;
  VS.scoreRoute = scoreRoute;
  VS.shapeOfDeg = shapeOfDeg;
  VS.monzoCents = monzoCents;
  VS.keySteps = keySteps;
  VS.taggedQ = taggedQ;
  VS.timeSig = timeSig;
  VS.takeHymnLine = takeHymnLine;
  VS.restQ = restQ;
  VS.makeBeam = makeBeam;
  VS.takeFuging = takeFuging;
  VS.organAlone = organAlone;
  VS.drawnHeads = drawnHeads;
  VS.REST_OF = REST_OF;
})();

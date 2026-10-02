// ============================================================================
// KOLOB — kolob-viz-intake.js: the page's intake — each note's place on the
// staff, the notes taken in a call at a time, the trombone choir at dawn, the
// old tune, the telegraph and the band
//
// One of the page's six files (kolob-viz.js raises KolobViz over them; THE
// SIX FILES there, and _viz.php's list). The engine tells the page every
// note it schedules and every event (onNote and onEvent, the listeners
// KolobViz.init hands it); here they are read: a note's degree, its place on
// the staff's lattice and its shape (degOf, noteQ, bandQ), its staff by the
// part it sings (staffOf); everything one call writes taken in together at
// the end of its task (queueIntake, flushIntake) and set as heads on shared
// stems (takeLayer); a composed hymn's lines handed to the hymnal
// (kolob-viz-hymnal.js) and the new guests to theirs (kolob-viz-guests.js);
// the trombones' chorale, the old tune, the telegraph's holes and the band's
// notes taken in here; and what STOP lifts from the page (silence). It keeps
// the page's data: the groups of heads, the hymn's marks, the telegraph's
// tapes, the band's notes and its visits.
// Lends what the other files read of it (the LENT block at the foot); reads
// the conductor's report (VS.cond) and the frame-exact capture (VS.freeze)
// from kolob-viz.js, the ward's spans from the hymnal (VS.wardSpans, which
// STOP cuts) and the guests' layers from theirs (VS.NEW_GUEST_LAYERS).
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
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
  // from kolob-viz-guests.js
  function takeNewGuests(byLayer) { return VS.takeNewGuests(byLayer); }
  // from kolob-viz-hymnal.js
  function announceHymn(hy) { return VS.announceHymn(hy); }
  function verseBegins(ev) { return VS.verseBegins(ev); }
  function lineKey(x) { return VS.lineKey(x); }
  function scoreRoute(n) { return VS.scoreRoute(n); }
  function taggedQ(n) { return VS.taggedQ(n); }
  function takeHymnLine(entries, ev) { return VS.takeHymnLine(entries, ev); }
  function takeFuging(ns) { return VS.takeFuging(ns); }
  // from kolob-viz.js
  function audioNow() { return VS.audioNow(); }
  function holdsBack(fn, x) { return VS.holdsBack(fn, x); }
  // (the other files' state, read through VS: VS.NEW_GUEST_LAYERS, VS.wardSpans, VS.cond, VS.freeze)

  // ---- pitch → staff position -----------------------------------------------
  var COLLECTIONS = {
    ionian:     [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8],
    mixolydian: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9],
    dorian:     [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9],
    aeolian:    [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9],
    penta:      [1, 9/8, 5/4, 3/2, 5/3],
    hexa:       [1, 9/8, 5/4, 4/3, 3/2, 5/3],
  };
  // 4-shape solmization per collection degree (fa sol la fa sol la mi).
  // The rudiments fix the key note as fa (major) or la (minor), so the
  // modal collections take the shapes of the tune they are written as:
  // dorian as a minor tune whose raised sixth is still fa, mixolydian as a
  // major tune whose lowered seventh is still mi (the Score may add the
  // accidental; the shape does not change with it).
  var SHAPES = {
    ionian:     ["fa", "sol", "la", "fa", "sol", "la", "mi"],
    mixolydian: ["fa", "sol", "la", "fa", "sol", "la", "mi"],
    dorian:     ["la", "mi", "fa", "sol", "la", "fa", "sol"],
    aeolian:    ["la", "mi", "fa", "sol", "la", "fa", "sol"],
    penta:      ["fa", "sol", "la", "sol", "la"],
    hexa:       ["fa", "sol", "la", "fa", "sol", "la"],
  };
  function degOf(freq) {
    var ratios = COLLECTIONS[VS.cond.mode] || COLLECTIONS.ionian;
    var root = (VS.cond.f0 || 65) * 4;
    var r = freq / root;
    var oct = 0;
    while (r >= 2) { r /= 2; oct++; }
    while (r < 1) { r *= 2; oct--; }
    var best = 0, bd = 1e9;
    for (var i = 0; i < ratios.length; i++) {
      var d = Math.abs(Math.log2(r / ratios[i]));
      if (d < bd) { bd = d; best = i; }
    }
    // a pitch just under the octave belongs to the next octave's do
    if (Math.abs(Math.log2(r / 2)) < bd) { best = 0; oct++; }
    return { deg: best, oct: oct, n: ratios.length };
  }
  // (the staff's lattice, q, and how the page is engraved: THE PAGE, kolob-viz.js)
  var STAFFPOS = {
    ionian:     [0, 1, 2, 3, 4, 5, 6],
    mixolydian: [0, 1, 2, 3, 4, 5, 6],
    dorian:     [0, 1, 2, 3, 4, 5, 6],
    aeolian:    [0, 1, 2, 3, 4, 5, 6],
    penta:      [0, 1, 2, 4, 5],
    hexa:       [0, 1, 2, 3, 4, 5],
  };
  var Q_MID = 10;                                  // middle C / the meeting's tonic-root
  function noteQ(freq) {
    var d = degOf(freq);
    var letters = STAFFPOS[VS.cond.mode] || STAFFPOS.ionian;
    var pos = letters[d.deg];
    if (pos == null) pos = d.deg;
    var q = Q_MID + pos + 7 * d.oct;
    while (q < -24) q += 7;                        // guard against nonsense only; the page folds (silently) at draw time
    while (q > 44) q -= 7;
    var shapes = SHAPES[VS.cond.mode] || SHAPES.ionian;
    return { q: q, shape: shapes[d.deg] || "sol" };
  }
  // the visiting band plays in its own key: its staff letter comes from the
  // equal-tempered distance to the ward's do, not from the ward's scale
  var ET_LETTER = [0, 0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6];
  function bandQ(freq) {
    var s = Math.round(12 * Math.log2(freq / ((VS.cond.f0 || 65) * 4)));
    var oct = Math.floor(s / 12), pc = s - oct * 12;
    return Q_MID + ET_LETTER[pc] + 7 * oct;
  }

  // ---- note intake ----------------------------------------------------------------
  // The engine emits notes when it SCHEDULES them, a line at a time, often
  // seconds early. Everything one call emits (and the events it raises) is
  // taken in together at the end of the task, so a hymn line is read as a
  // line: its beat is estimated from its own lengths, its chords stacked.
  var intake = [], intakeArmed = false;
  var groups = [];                                 // engraved note groups (heads on one stem)
  var tapes = [];                                  // telegraph messages
  var bandNotes = [], visits = [];                  // the visiting band, on its own layer
  // (the trombone choir at dawn and the old tune are engraved too — the
  // staff never sits blank while a guest of ours is playing; and the organ
  // when it plays alone — the giving-out, the organist's prelude and fills,
  // the house's own chords where no one sings over them; the ward's
  // handbells; the full ward, whatever layer it sings on)
  var MELODIC = { clarinet: 1, choir: 1, bells: 1, harmonium: 1, strings: 1, trombones: 1, oldtune: 1,
                  organ: 1, handbells: 1, ward: 1, cast: 1 };
  var CHOIR_LAYERS = { choir: 1, ward: 1, cast: 1 };
  var lastBeat = { choir: 1.15 };
  // Closed score, read from the part each note reports (SCORE §6): the
  // soprano and alto on the treble, the tenor and bass on the bass; where
  // two voices share a staff, the upper's stems go up and the lower's down.
  // A reported part holds its staff down to two ledgers into the gap (the
  // telegraph's lane lies beyond); a note that would go further prints on
  // the other staff, where it sits (a part kept on its own staff, the
  // trombones', folds back an octave instead: foldFor). A note with no
  // such part (the strings' root, fifth and octave, the clarinet, the
  // bells) takes the staff its pitch belongs to, middle C and above on the
  // treble.
  var PART_STAFF = { S: "T", A: "T", T: "B", B: "B" };
  var PART_DIR = { S: 1, A: -1, T: 1, B: -1 };
  var GAP_T = 8, GAP_B = 12;                       // the deepest a part reaches into the gap: two ledgers
  // (a composed hymn's tune goes further, and keeps its staff: to a step
  // over its third ledger — THE HYMNAL ON THE STAFF)
  var TUNE_T = 5, TUNE_B = 15;
  function staffOf(n, q, strict) {
    var ps = PART_STAFF[n.part];
    if (!ps) return q >= Q_MID ? "T" : "B";
    if (strict) return ps;
    if (ps === "T" && q < GAP_T) return "B";
    if (ps === "B" && q > GAP_B) return "T";
    return ps;
  }
  function queueIntake(x) {
    intake.push(x);
    if (!intakeArmed) {
      intakeArmed = true;
      Promise.resolve().then(flushIntake);
    }
  }
  // (a note or event that says logged: false — an unlogged guest's, the
  // Hosanna's shout — is never engraved: SCORE §6, PLAN §8.12)
  // (the Hosanna is audio-only whatever it says: the owner's ruling)
  function onNote(n) {
    if (VS.freeze && holdsBack(onNote, n)) return;   // (dev: a capture asked — taken in by the moment it was written: THE FRAME-EXACT CAPTURE)
    if (!n || n.logged === false || n.hosanna) return;
    if (n.layer === "telegraph") { if (n.marks && n.marks.length) queueIntake({ note: n }); return; }
    if (n.layer === "band") { if (n.freq > 20) queueIntake({ note: n }); return; }
    if (VS.NEW_GUEST_LAYERS[n.layer] || (n.layer === "voice" && n.speech)) { if (n.freq > 20) queueIntake({ note: n }); return; }   // (THE NEW GUESTS ON THE STAFF, kolob-viz-guests.js)
    if (!n.freq || n.freq < 20 || !MELODIC[n.layer]) return;
    if (n.layer === "organ" && (n.part === "pedal" || n.pedal) && !n.variations) return;   // the 16′ under the bass: a stop drawn, not a note written (the variations' own pedal line: takeVariations)
    queueIntake({ note: n });
  }
  // the typed bus (SCORE.md §6): the page reads the event's type, never its
  // label — STOP; the hymn board's announcement, each verse's performance,
  // and each composed line told with its Score, which comes in with its
  // notes
  function onEvent(ev) {
    if (VS.freeze && holdsBack(onEvent, ev)) return;   // (dev: as onNote's)
    if (!ev || ev.logged === false) return;
    if (ev.type === "transport" && ev.action === "stop") queueIntake({ stop: ev.t != null ? ev.t : audioNow() });
    else if (ev.type === "hymn-announced" && ev.hymn && ev.hymn.id) announceHymn(ev.hymn);
    else if (ev.type === "verse-start" && ev.hymnId) verseBegins(ev);
    else if (ev.type === "verse-line" && ev.composed && ev.score && ev.hymnId) queueIntake({ ev: ev });
  }

  // the beat of a line: the length that makes its notes the simplest values
  // (quarters, halves, dotted, eighths), held between 0.75 and 1.65 s with a
  // gentle pull toward hymn time
  var GRID = [0.25, 0.5, 1, 1.5, 2, 3, 4];
  function estimateBeat(durs, fallback) {
    var ds = durs.filter(function (d) { return d > 0.08 && d < 7; });
    if (ds.length < 3) return fallback;
    var best = fallback, bc = 1e9;
    for (var b = 0.75; b <= 1.651; b += 0.01) {
      var cost = 0.5 * Math.abs(Math.log2(b / 1.15)) * ds.length * 0.25;
      for (var i = 0; i < ds.length; i++) {
        var r = ds[i] / b, e = 9;
        for (var j = 0; j < GRID.length; j++) e = Math.min(e, Math.abs(Math.log2(r / GRID[j])));
        cost += e;
      }
      if (cost < bc) { bc = cost; best = b; }
    }
    return best;
  }
  // seconds → a note value against the line's beat. A line whose beat is
  // the tune's own (fine: the old tune's notes say where they fall in it)
  // can also print a dotted eighth, three quarters of a beat (MARTYR's
  // dotted figure). Against a beat estimated from the lengths, that is too
  // fine to tell from a quarter sung short, and the line reads as before.
  function valueOf(beats, layer, fine) {
    if (layer === "strings" && beats >= 7) return { open: true, stem: false, breve: true, dots: 0, flags: 0 };
    if (beats >= 3.5) return { open: true, stem: false, dots: 0, flags: 0 };
    if (beats >= 2.6) return { open: true, stem: true, dots: 1, flags: 0 };
    if (beats >= 1.75) return { open: true, stem: true, dots: 0, flags: 0 };
    if (beats >= 1.3) return { open: false, stem: true, dots: 1, flags: 0 };
    if (fine && beats >= 0.62 && beats < 0.87) return { open: false, stem: true, dots: 1, flags: 1 };
    if (beats >= 0.72) return { open: false, stem: true, dots: 0, flags: 0 };
    if (beats >= 0.36) return { open: false, stem: true, dots: 0, flags: 1 };
    return { open: false, stem: true, dots: 0, flags: 2 };
  }
  var SCALE = { choir: 1, strings: 1, bells: 1, clarinet: 0.75, harmonium: 0.6, trombones: 1, oldtune: 1,
                organ: 1, handbells: 1, ward: 1, cast: 1 };

  function flushIntake() {
    intakeArmed = false;
    var batch = intake; intake = [];
    var byLayer = {}, stopAt = null, i;
    var hymnLines = {}, lineEvs = {}, lineOrder = [], fugs = [];
    function lineNotes(k) { if (!hymnLines[k]) { hymnLines[k] = []; if (!lineEvs[k]) lineOrder.push(k); } return hymnLines[k]; }
    for (i = 0; i < batch.length; i++) {
      var it = batch[i];
      if (it.stop != null) { stopAt = stopAt == null ? it.stop : Math.min(stopAt, it.stop); continue; }
      if (it.ev) {
        if (it.ev.type === "verse-line") {
          var ek = lineKey(it.ev);
          if (!lineEvs[ek] && !hymnLines[ek]) lineOrder.push(ek);
          lineEvs[ek] = it.ev;
        }
        continue;
      }
      var n = it.note;
      if (n.layer === "telegraph") { takeTape(n); continue; }
      if (n.fuging && n.hymnId && CHOIR_LAYERS[n.layer]) { fugs.push(n); continue; }   // the fuge between the verses: takeFuging
      // a composed hymn's notes are engraved from its Score, a line at a time
      var route = scoreRoute(n);
      if (route) { lineNotes(lineKey(n)).push({ n: n, under: route === "under" }); continue; }
      (byLayer[n.layer] = byLayer[n.layer] || []).push(n);
    }
    lineOrder.forEach(function (k) {
      var ns = hymnLines[k] || [];
      if (takeHymnLine(ns, lineEvs[k] || null)) return;
      // no Score to read it by: the notes print as the page hears them (never the organ under the ward)
      ns.forEach(function (x) { if (!x.under) (byLayer[x.n.layer] = byLayer[x.n.layer] || []).push(x.n); });
    });
    if (fugs.length && !takeFuging(fugs)) fugs.forEach(function (fn) { (byLayer[fn.layer] = byLayer[fn.layer] || []).push(fn); });
    if (byLayer.band) takeBand(byLayer.band);
    if (byLayer.trombones) takeTrombones(byLayer.trombones);
    if (byLayer.oldtune) takeOldTune(byLayer.oldtune);
    takeNewGuests(byLayer);                          // (it takes its own out of byLayer)
    Object.keys(byLayer).forEach(function (layer) {
      if (layer === "band" || layer === "trombones" || layer === "oldtune") return;
      var ns = byLayer[layer];
      var beat = estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat[layer] || lastBeat.choir || 1.15);
      if (ns.length >= 3) lastBeat[layer] = beat;
      takeLayer(layer, ns, beat);
    });
    if (stopAt != null) silence(stopAt);
    // bounded memory: the page shows ~15 s; keep generously more
    if (groups.length > 900) groups.splice(0, groups.length - 900);
    if (marks.length > 900) marks.splice(0, marks.length - 900);
    if (bandNotes.length > 500) bandNotes.splice(0, bandNotes.length - 500);
  }

  // STOP: nothing more is printed. Ink the engine had scheduled (a choir
  // line runs up to ~36 s ahead, the band's whole crossing) that will not
  // now sound is lifted from the page; what was sounding keeps its place,
  // its length cut to the voices' fade (the engine closes their bus over
  // 0.6 s), and a message being keyed is cut where the key stopped. Called
  // with the stop's audio time, from the "■" transport event or, failing
  // that, when the conductor first reports the meeting stopped.
  var STOP_FADE = 0.6;
  function silence(cut) {
    var end = cut + STOP_FADE, i, k;
    for (i = 0, k = 0; i < groups.length; i++) {
      var gr = groups[i];
      if (gr.tp > cut) continue;
      if (gr.tp + gr.dur > end) gr.dur = end - gr.tp;
      if (gr.beam) gr.beam.members = gr.beam.members.filter(function (m) { return m.tp <= cut; });
      groups[k++] = gr;
    }
    groups.length = k;
    // the hymn's own marks: a bar, a rest, a fermata, a tie or slur not yet reached is lifted
    for (i = 0, k = 0; i < marks.length; i++) {
      var mk0 = marks[i];
      if (mk0.tp > cut || (mk0.tp2 != null && mk0.tp2 > end)) continue;
      marks[k++] = mk0;
    }
    marks.length = k;
    VS.wardSpans = VS.wardSpans.filter(function (w) { return w.tp0 <= cut; });
    for (i = 0, k = 0; i < bandNotes.length; i++) {
      var n = bandNotes[i];
      if (n.tp > cut) continue;
      if (n.tp + n.dur > end) n.dur = end - n.tp;
      bandNotes[k++] = n;
    }
    bandNotes.length = k;
    for (i = visits.length - 1; i >= 0; i--) {
      var bd = visits[i];
      if (bd.tp0 > cut) { visits.splice(i, 1); continue; }
      bd.tp1 = Math.min(bd.tp1, end);
      bd.bass = bd.bass.filter(function (bb) { return bb.tp <= cut; });
    }
    for (i = tapes.length - 1; i >= 0; i--) {      // a message being keyed is cut where the key stopped
      var T = tapes[i], lim = cut - T.tp;
      if (lim < 0) { tapes.splice(i, 1); continue; }
      if (T.Tt > lim) {
        T.marks = T.marks.filter(function (m) { return m.tp <= end; });   // only what was punched before the key fell silent
        if (!T.marks.length) { tapes.splice(i, 1); continue; }
        var lm = T.marks[T.marks.length - 1];
        T.Tt = lm.at + lm.len;
      }
    }
  }

  // one layer's notes from one call → groups of heads on shared stems.
  // opt, for the guests: staff — one staff for the whole call; strict — a
  // part keeps its own staff however deep in the gap (foldFor keeps it off
  // the telegraph's line); shift — a written octave per staff ({T, B}, in
  // steps of the staff); shape — one head for every note; ink, thin, dry —
  // its ink, its line weight and how fast it dries, against the ward's (1
  // each); fineBeat — the beat is the tune's own (valueOf); qOf —
  // a note's place and shape where it names them in a key of its own
  // (keyedQ); head — a guest's own mark on a head; scale — its size
  function takeLayer(layer, ns, beat, opt) {
    opt = opt || {};
    var byT = {}, voices = { T: {}, B: {} };
    ns.forEach(function (n) {
      var nq = (opt.qOf && opt.qOf(n)) || taggedQ(n) || noteQ(n.freq), st = opt.staff || staffOf(n, nq.q, opt.strict);
      var p = { n: n, q: nq.q + (opt.shift ? opt.shift[st] || 0 : 0), shape: opt.shape || nq.shape, st: st };
      if (PART_DIR[n.part]) voices[st][n.part] = 1;
      var k = Math.round(n.startTime * 50);
      (byT[k] = byT[k] || []).push(p);
    });
    // two parts or more on one staff in this call are voices: each keeps
    // its own stem when it moves alone (the alto's passing note stems down)
    var voiced = { T: Object.keys(voices.T).length > 1, B: Object.keys(voices.B).length > 1 };
    Object.keys(byT).sort(function (a, b) { return a - b; }).forEach(function (k) {
      var parts = byT[k].slice().sort(function (a, b) { return b.n.freq - a.n.freq; });
      var t0 = parts[0].n.startTime;
      ["T", "B"].forEach(function (st) {
        var onSt = parts.filter(function (p) { return p.st === st; });
        if (!onSt.length) return;
        // heads that last alike share a stem; a different length gets its own
        var byDur = {};
        onSt.forEach(function (p) { var dk = Math.round(p.n.duration * 20); (byDur[dk] = byDur[dk] || []).push(p); });
        var keys = Object.keys(byDur), closed = parts.length >= 3 && (!!CHOIR_LAYERS[layer] || layer === "organ");
        // (a unison of the whole ward: one head, however many throats — where
        // a crowd reports one place at several lengths, the longest wins it;
        // a quartet's two voices on one pitch keep their two heads)
        if (keys.length > 1 && onSt.length > 4) {
          var bestAt = {};
          keys.forEach(function (dk) { byDur[dk].forEach(function (p) { if (!bestAt[p.q] || +dk > +bestAt[p.q]) bestAt[p.q] = dk; }); });
          keys.forEach(function (dk) { byDur[dk] = byDur[dk].filter(function (p) { return bestAt[p.q] === dk; }); if (!byDur[dk].length) delete byDur[dk]; });
          keys = Object.keys(byDur);
        }
        // two lengths at once on one staff are two voices, set the way a
        // hymnal sets them: the lower first with its stem down, the upper
        // with its stem up (if their heads would touch, the page moves the
        // later one aside at draw time — see placeColumn)
        var meanQ = {};
        keys.forEach(function (dk) { var sq = 0; byDur[dk].forEach(function (p) { sq += p.q; }); meanQ[dk] = sq / byDur[dk].length; });
        keys.sort(function (a, b) { return meanQ[a] - meanQ[b] || a - b; });
        var atOnce = [];
        keys.forEach(function (dk, gi) {
          var ps = byDur[dk], dur = ps[0].n.duration;
          var v = valueOf(dur / beat, layer, opt.fineBeat);
          var seen = {}, heads = [];
          ps.forEach(function (p) {
            if (seen[p.q]) return; seen[p.q] = 1;               // unison parts share a head
            var hd = { q: p.q, shape: p.shape, open: v.open, dots: v.dots };
            if (opt.head) opt.head(p.n, hd);                     // (a guest's own mark on its head: the fiddle's tune, a stressed syllable)
            heads.push(hd);
          });
          var grp = {
            layer: layer, tp: t0, dur: dur, st: st, heads: heads, v: v,
            scale: opt.scale || SCALE[layer] || 1, dir: 0, noStem: !v.stem, flags: v.flags
          };
          if (opt.ink != null && opt.ink !== 1) grp.ink = opt.ink;
          if (opt.thin) grp.thin = opt.thin;
          if (opt.dry) grp.dry = opt.dry;
          if (layer === "bells" || layer === "handbells") { grp.noStem = true; grp.ring = true; grp.flags = 0; heads.forEach(function (h) { h.open = true; h.dots = 0; }); }
          if (layer === "organ") grp.alone = true;             // printed only where no one sings over it (organAlone)
          if (!grp.dir) {
            var vd = voiced[st] ? voiceDir(ps) : 0, pd = posDir(heads, st);
            if (vd) {
              grp.dir = vd;
              if (pd !== vd && keys.length === 1) grp.alt = pd;   // alone on its staff: if the voice's stem would be stubby (layoutGroup)
            }
            else if (keys.length > 1) grp.dir = gi === keys.length - 1 ? 1 : -1;
            else if (closed) grp.dir = st === "T" ? 1 : -1;
            else grp.dir = pd;
          }
          groups.push(grp);
          if (!grp.noStem) atOnce.push(grp);
        });
        // (two voices at once on a staff whose parts would stem
        // them alike — the organist's canon, both voices the tune, one of them
        // an octave down on the bass staff — are set as two voices share a
        // staff: the lower's stem down, the upper's up. Stemmed alike, the
        // lower's stem ran up through the upper's head, the page set it aside,
        // and the canon drifted from its time)
        if (atOnce.length > 1 && atOnce.every(function (gp) { return gp.dir === atOnce[0].dir; })) {
          atOnce[0].dir = -1; atOnce[0].alt = 0;
          atOnce[atOnce.length - 1].dir = 1; atOnce[atOnce.length - 1].alt = 0;
        }
      });
    });
  }
  // the position rule: the stem turns away from the head that lies furthest
  // from its staff's middle line (down from a high note, up from a low one)
  function posDir(heads, st) {
    var mq = st === "T" ? 16 : 4, far = heads[0];
    heads.forEach(function (h) { if (Math.abs(h.q - mq) > Math.abs(far.q - mq)) far = h; });
    return far.q >= mq ? -1 : 1;
  }
  // the stem the parts on one stem agree on (S and T up, A and B down), or
  // 0 when they don't agree or report no part: a shared stem goes the
  // closed score's way, a lone line the way its heads lie. A voice's own
  // stem that the plate's edge or the gap would cut short (a lone high
  // soprano's, stem up over the treble) takes the position rule instead:
  // see layoutGroup.
  function voiceDir(ps) {
    var d = 0;
    for (var i = 0; i < ps.length; i++) {
      var pd = PART_DIR[ps[i].n.part];
      if (!pd || (d && pd !== d)) return 0;
      d = pd;
    }
    return d;
  }

  // ---- the trombone choir at dawn ------------------------------------------------
  // A four-part chorale, the day's first hymn, printed as the hymnal prints
  // it before anyone sings it: a closed score, the soprano and alto
  // trombones on the treble, tenor and bass on the bass, each part on its
  // own staff the whole chorale through. Parts that move together share a
  // stem, turned the way the chord lies (the bass's low chords stem up
  // into the gap, not down onto the console); a part that moves alone keeps
  // its voice's stem (the alto's and the bass's down). The two choirs
  // answer each other across the town, and the page shows which is which by
  // its ink alone: the far choir's lines are pale, the near choir's full.
  // When the far choir joins the near one's last chord it doubles it, and
  // unison parts share a head: the chord is printed once.
  //
  // The chorale is set where the trombones are warm, which is not where a
  // hymnal's voices sit: often the tenor and alto lie a third to a fifth
  // under their singers'. So the page chooses, for the whole chorale and
  // for each staff, the octave it is written in: as it sounds, unless an
  // octave up (or down) spares the reader at least a quarter of a ledger
  // line a note — the way a men's choir's tenors are printed on the treble
  // an octave above their sound. The bass staff never climbs over the
  // treble's octave. The engine plays the whole chorale in one call, so the
  // page reads it whole.
  var TROMBONE_INK = { far: 0.42, near: 1 };
  function ledgerCost(st, q) {                     // ledger lines a note needs, the gap's weighing more; past the plate, more again
    if (st === "T") return q < 12 ? 1.5 * Math.floor((12 - q) / 2) : q > 20 ? Math.floor((q - 20) / 2) + (q > 24 ? 3 : 0) : 0;
    return q > 8 ? 1.5 * Math.floor((q - 8) / 2) : q < 0 ? Math.floor(-q / 2) + (q < -4 ? 3 : 0) : 0;
  }
  function writtenOctaves(ns) {
    var out = { T: 0, B: 0 };
    ["T", "B"].forEach(function (st) {
      var qs = [];
      ns.forEach(function (n) { if (PART_STAFF[n.part] === st) qs.push(noteQ(n.freq).q); });
      if (!qs.length) return;
      var cost = {}, best = 0;
      [-7, 0, 7].forEach(function (k) {
        var c = 0;
        qs.forEach(function (q) { c += ledgerCost(st, q + k); });
        cost[k] = c / qs.length;
        if (cost[k] < cost[best]) best = k;
      });
      if (best && cost[best] < cost[0] - 0.25) out[st] = best;
    });
    if (out.B > out.T) out.B = out.T;
    return out;
  }
  function takeTrombones(ns) {
    var near = ns.filter(function (n) { return n.choir !== "far"; });
    ns = ns.filter(function (n) {
      if (n.choir !== "far") return true;
      for (var i = 0; i < near.length; i++) {
        var m = near[i];
        if (m.part === n.part && m.startTime <= n.startTime + 1e-6 && n.startTime - m.startTime < 0.3 &&
            Math.abs(Math.log2(n.freq / m.freq)) < 0.03) return false;   // the far choir, joining: already printed
      }
      return true;
    });
    var shift = writtenOctaves(ns);
    ["far", "near"].forEach(function (ch) {
      var mine = ns.filter(function (n) { return (n.choir === "far") === (ch === "far"); });
      if (!mine.length) return;
      // each choir has its own beat (the far one drags a little)
      var key = "trombones:" + ch;
      var beat = choraleBeat(mine) || estimateBeat(mine.map(function (n) { return n.duration; }), lastBeat[key] || lastBeat.choir || 1.15);
      if (mine.length >= 3) lastBeat[key] = beat;
      takeLayer("trombones", mine, beat, { strict: true, shift: shift, ink: TROMBONE_INK[ch] });
    });
  }
  // A chorale moves in its beat: its commonest length is the quarter, so a
  // brisk dawn reads in quarters and halves as the chorale book prints it,
  // not in eighths pulled toward hymn time. Null when no length is common
  // enough to be sure (then the line's own estimate stands).
  function choraleBeat(ns) {
    var bins = {}, n = 0, best = null, bc = 0;
    ns.forEach(function (x) {
      if (!(x.duration > 0.2 && x.duration < 2.5)) return;
      var k = Math.round(Math.log2(x.duration) * 25);          // bins of about 3 %
      bins[k] = (bins[k] || 0) + 1; n++;
    });
    Object.keys(bins).forEach(function (k) {
      k = +k;
      var c = bins[k] + 0.5 * ((bins[k - 1] || 0) + (bins[k + 1] || 0));
      if (c > bc) { bc = c; best = k; }
    });
    return best != null && n >= 6 && bc >= 0.25 * n ? clamp(Math.pow(2, best / 25), 0.35, 1.8) : null;
  }

  // ---- the old tune -----------------------------------------------------------------
  // An Earth tune remembered: the colony's own hymn, from the tunebook, but
  // from the Earth of three thousand years ago, and the memory prints it
  // the way Earth's hymnals had come to print it — in round notes (the
  // book of 1985 among them), before the colony took up the shapes again.
  // It is engraved finely and faintly, a hairline of green that dries twice
  // as fast as the ward's ink, so the tune fades from the page as it fades
  // from the air; the second try, the head alone trailing off, is fainter
  // still. One staff for the whole memory: the one its line needs the
  // fewest ledger lines on. Its beat is the book's own: the notes report
  // where they fall in the tune, and the wear (a note dropped, one held
  // wrong) moves the time but not the beat, so the middle of the ratios is
  // the beat.
  var OLDTUNE_INK = { 1: 0.5, 2: 0.3 };
  function takeOldTune(ns) {
    ns = ns.slice().sort(function (a, b) { return a.startTime - b.startTime; });
    var rs = [], qs = [];
    for (var i = 0; i < ns.length; i++) {
      qs.push(noteQ(ns[i].freq).q);
      var a = ns[i - 1], b = ns[i];
      if (a && a.tryNo === b.tryNo && a.line === b.line && typeof a.beat === "number" && typeof b.beat === "number" && b.beat > a.beat)
        rs.push((b.startTime - a.startTime) / (b.beat - a.beat));
    }
    rs.sort(function (x, y) { return x - y; });
    var beat = rs.length >= 2 ? clamp(rs[rs.length >> 1], 0.3, 3)
      : estimateBeat(ns.map(function (n) { return n.duration; }), lastBeat.oldtune || lastBeat.choir || 1.15);
    lastBeat.oldtune = beat;
    var cT = 0, cB = 0;
    qs.forEach(function (q) { cT += ledgerCost("T", q); cB += ledgerCost("B", q); });
    var st = cT <= cB ? "T" : "B";
    [1, 2].forEach(function (tryNo) {
      var mine = ns.filter(function (n) { return (n.tryNo === 2 ? 2 : 1) === tryNo; });
      if (mine.length) takeLayer("oldtune", mine, beat, { staff: st, shape: "round", ink: OLDTUNE_INK[tryNo], thin: 0.7, dry: 2, fineBeat: rs.length >= 2 });
    });
  }
  // (the marks are the page's, as its notes are: the hymnal sets a composed
  // line's, the guests their bars and slurs, STOP lifts what is not yet
  // reached, and kolob-viz.js places and draws them)
  var marks = [];                                  // a composed line's own marks: bars, rests, fermatas, ties and slurs

  // ---- the telegraph ------------------------------------------------------------
  function takeTape(n) {
    var U = 1e9;
    n.marks.forEach(function (m) { if (m.len > 0) U = Math.min(U, m.len); });
    if (!(U < 1e8)) U = 0.08;
    var last = n.marks[n.marks.length - 1];
    // each hole keeps the time it is punched, and dries from it like a note
    var marks = n.marks.map(function (m) { return { at: m.at, len: m.len, dah: !!m.dah, tp: n.startTime + m.at + m.len }; });
    tapes.push({ tp: n.startTime, marks: marks, U: U, Tt: last.at + last.len });
    if (tapes.length > 12) tapes.shift();
  }
  // ---- the band -------------------------------------------------------------------
  // Round notes on their own layer, sliding through the ward's page
  // at the band's own (quicker) rate; ink follows its approach and recession.
  function takeBand(ns) {
    ns.sort(function (a, b) { return a.startTime - b.startTime; });
    // (the tune and the tuba are written; the after-beats, the
    // second cornet and the doublings are heard, not printed — and a march
    // laid out a bar at a time is one visit, per band, while it plays)
    ns = ns.filter(function (n) { return n.part !== "alto" && n.part !== "cornet2" && !n.doubling; });
    if (!ns.length) return;
    var beat = ns[0].beat || 0.46;
    var r = clamp(1.1 / beat, 1.6, 2.6);
    var bd = null;
    for (var vi = visits.length - 1; vi >= 0 && !bd; vi--) if (visits[vi].band === (ns[0].band || 0) && ns[0].startTime - visits[vi].tp1 < 4) bd = visits[vi];
    if (!bd) { bd = { tp0: ns[0].startTime, beat: beat, r: r, tp1: 0, bass: [], band: ns[0].band || 0 }; visits.push(bd); if (visits.length > 4) visits.shift(); }
    ns.forEach(function (n) {
      var mel = n.part !== "bass", q = bandQ(n.freq);
      if (mel) { q -= 7; while (q > 26) q -= 7; while (q < 11) q += 7; }
      else { while (q > 9) q -= 7; while (q < -2) q += 7; }
      var v = valueOf(n.duration / beat, "band");
      var nb = { tp: n.startTime, dur: n.duration, q: q, loud: n.loud == null ? 0.6 : n.loud, mel: mel, v: v, bd: bd };
      if (!mel && n.downbeat !== false) bd.bass.push({ tp: nb.tp });   // its barlines fall on each bar's oom
      bd.tp1 = Math.max(bd.tp1, n.startTime + n.duration);
      bandNotes.push(nb);
    });
  }

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  VS.COLLECTIONS = COLLECTIONS;
  VS.Q_MID = Q_MID;
  VS.noteQ = noteQ;
  VS.groups = groups;
  VS.tapes = tapes;
  VS.bandNotes = bandNotes;
  VS.visits = visits;
  VS.CHOIR_LAYERS = CHOIR_LAYERS;
  VS.lastBeat = lastBeat;
  VS.GAP_T = GAP_T;
  VS.GAP_B = GAP_B;
  VS.TUNE_T = TUNE_T;
  VS.TUNE_B = TUNE_B;
  VS.onNote = onNote;
  VS.onEvent = onEvent;
  VS.estimateBeat = estimateBeat;
  VS.flushIntake = flushIntake;
  VS.silence = silence;
  VS.takeLayer = takeLayer;
  VS.posDir = posDir;
  VS.ledgerCost = ledgerCost;
  VS.marks = marks;
})();

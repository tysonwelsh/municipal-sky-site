// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE WARD'S HANDBELL CHOIR (KOLOB.GuestHandbells)
//
// Handbells were made so that tower ringers could practise their changes
// indoors, in the warm, without waking the parish. In Boston in 1923
// Margaret Shurcliff's Beacon Hill ringers turned them into a choir of their
// own — a row of ringers behind a padded table, each covering two notes of
// the scale (a bell in each hand, their sharps and flats waiting on the
// pad in front of them), the bass bells at one end and the treble at the
// other, playing hymn tunes by passing the melody down the line from hand
// to hand. Many wards of
// the Church keep such a choir; so does the Tabernacle Choir (the Bells at
// Temple Square). At the rim of Kolob's light, so does this one.
//
// It is the first guest that stands IN the room. Everything else that has
// visited the meeting came from far off — the trombones across the town,
// the steeples across the valley, the old tune from three thousand years
// away. The bells are close, bright and dry: eight to twelve ringers in a
// line from low to high across the front of the chapel, so the tune HOPS
// across the stereo field as it climbs and falls, from ringer to ringer.
//
// WHAT THEY RING. The day's hymn (a composed Hymn from KOLOB.Composer, or any
// SCORE §5 Hymn — the engine hands it over), or a round: a short canon the
// choir sets in three or four octaves, each entry a different stretch of the
// line (so the round's voices enter from different places in the room).
//
// HOW THEY RING IT — the ringers' own techniques (kolob-voices-folk.js,
// HANDBELLS): rung and damped at the shoulder, note by note; rung and let
// ring (LV) until the director's hand stops the line at a breath; martellato
// (the bell struck down on the padded table: a bright stroke and a thump,
// stopped at once); the thumb damp (a short plink); the shake on a long note
// (the clapper rattled, a sustained trembling bell); and, to finish, the
// CASCADE — every bell of the set, or every bell of the home chord, rung in
// turn from the top of the line to the bottom, the sound pouring across the
// room from one side to the other, and the lowest bell left to ring.
//
// THE ARRANGEMENT (a hymn), drawn per performance:
//   · an introduction, or none: the top bells rung in ROUNDS twice (the
//     tower's own opening — a nod to what handbells were made for), or the
//     hymn's last line given out, as the organist would;
//   · verse one, plain: all the parts, an octave up where bells sing, each
//     note damped as the next begins; long notes of the tune let ring; each
//     line's last chord let ring through the breath;
//   · verse two (when the hymn is short enough), one of three settings:
//       MARTELLATO — the lower bells struck on the table on the beat under a
//         ringing tune, the tune's long notes and the lines' last chords
//         shaken;
//       THE TUNE IN THE BASS — the melody taken down into the big bells, the
//         harmony above it rung as chords and let ring to the next change;
//       DESCANT — verse one again, with a slow counter-melody in the top bells;
//   · the last chord let ring (or shaken), and the cascade.
// In the sacrament's seat the choir plays softly and never uses the table.
//
// THE ROUND. A ground of two chords, one a bar (just in every mode: I–V in
// ionian, I–IV in mixolydian and hexatonic, i–IV in dorian, i–iv in aeolian,
// I–vi in the pentatonic — the bells are fixed pitches, so the round is
// written on chords whose every tone the set holds pure), and three or four
// two-bar phrases over it: long notes let ring to the bar; walking quarters
// damped; running eighths thumb-damped; and, with four voices, a low
// "ding-dong" struck martellato. Every phrase's strong beats are tones of
// its bar's chord, so the canon fits wherever the voices stand. Each voice
// goes round twice; they drop out in the order they came in, and the whole
// line rings the home chord before the cascade.
//
// THE BELLS. A handbell is a fixed pitch: the choir's set is every note of
// the mode between the arrangement's lowest and highest, tuned justly to the
// day's key (the exact ratios the hymn's Score names — where the Score's
// harmony leans a note a syntonic comma, the colony's set has the comma bell
// too, held by the same ringer: "re" at 9/8 and at 10/9). Each bell's twelfth
// is tuned exactly 3:1 (the voice), so every bell carries its own pure fifth.
// The ringers take the set in order from the bottom, as real choirs assign
// one: each covers a stretch of the scale — two places as a rule (a place
// is a letter: its bell, its sharp or flat, and here its comma bell, which
// wait on the pad until they are wanted) — and never more than four bells,
// which is what two hands and a table can manage; a set too big for the
// ringers drawn brings more ringers (up to twelve). They stand in a line
// across the field: the bass at the audience's right as a rule (the
// ringers face us with the bells laid out like a keyboard), sometimes the
// other way round. Where a ringer would need a third hand (three of their
// bells struck at once — a close chord inside one ringer's stretch), the
// neighbour reaches over and rings it: the bell sounds where it lies, and
// the score says who rang it (reached: true).
//
// THE PHONE'S BUDGET. A ring is 11 nodes (the voice; its bell's panner is
// kept for the piece), however many times it is re-struck or shaken. At most
// MAX_LIVE rings sound at once (20; 12 on a phone): past that, the oldest
// ringing bell is damped as the new one strikes, as a ringer would. score()
// reports the live count at its peak; the lab measures it.
//
// PURE PLANNING. plan(), decide(), prepare(), score() and round() touch no
// AudioContext, DOM, clock or Math.random; every die comes from the stream
// passed in (guest:handbells:<n>), on forks: "seat" (the odds, the section,
// the moment), "shape" (the piece, the ringers, the settings, the tempo —
// drawn the same by plan() and perform() without passing anything between
// them), "material" (the round, or a hymn composed here when the engine
// hands none) and "synth" (where each ringer's hand actually lands — a few
// milliseconds — and how hard: sound-level, never reported).
//
// Public surface: window.KOLOB.GuestHandbells
//   plan(meetingInfo, stream) → { guest, seat, at, dur, holdUntil, piece,
//        ringers, estimated, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}], guests:
//       [{type, section}], material? (prepare()'s), force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the arrangement, ready to ring (pure; itself
//     material): material = { hymn, keynoteHz, seat?, phone? } |
//     { round, keynoteHz } | { keynoteHz, mode, piece? }
//   score(material, stream, t0) → the whole performance as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { onNote({freq, t, dur, part, role, ringer, bell, tech, pan,
//              loud, reached}), onStage({stage, t0, t1, label}), maxLive,
//              defer(at, fn) (the engine's clock: the rings of each second
//              laid out at `at`, 2.5 s before they sound, instead of the
//              whole piece inside one cue — the hook the trombones take) }
//   round(mode, stream, opts) → a round (pure)
//   ODDS, EXCLUDES, BELL_GUESTS, SEATS, MAX_LIVE, NAME, LABEL, LEVEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestHandbells = (function () {
  "use strict";

  var NAME = "handbells";
  var LABEL = "guest:handbells:";                 // + the meeting number

  // ==========================================================================
  // THE ODDS — about one meeting in eight, for the owner's ear
  // ==========================================================================
  // p = base × weight[sunday or kind], capped. The base is conditional: the
  // choir is refused when the steeples ring (one bell guest a meeting), and
  // when no seat is free — its three seats are the invocation, the opening
  // of the sacrament and the postlude, and a seat is free only when neither
  // it nor a section beside it holds another guest (PLAN §8.13: never two
  // guests in adjacent sections). The lab's odds card runs plan() over a
  // stand-in of the engine's planner (its guests' own dice and seats): at a
  // base of 0.2 it seated 18 % of meetings (the steeples refuse 7.5 %, a
  // crowded meeting 2 %); at 0.14, one meeting in eight.
  var ODDS = {
    base: 0.14,
    weight: {
      ordinary: 1, fast: 0.4, conference: 1.1, jubilee: 1.5,
      // the calendar's Sundays (PLAN §7.1), when the engine names them
      christmas: 2.8, easter: 2.4, wedding: 2.4, dedication: 1.4,
      pioneer: 1.1, funeral: 0.6,
    },
    cap: 0.9,
  };
  // never with the steeples, and one bell guest a meeting: the Primary (§8.7)
  // brings its own handbells
  var BELL_GUESTS = ["steeples", "primary", "handbells"];
  var EXCLUDES = BELL_GUESTS;
  var SEATS = ["invocation", "sacrament", "postlude"];
  var SEAT_W = { invocation: 1, sacrament: 0.9, postlude: 1.1 };
  var AT = { invocation: [4, 16], sacrament: [2, 6], postlude: [2, 8] };
  var MAX_DUR = 78;                               // a longer hymn is rung once, or in part
  var MAX_LIVE = { desktop: 20, phone: 12 };      // rings sounding at once
  // the choir's bus, against the organ reference (the instruments lab's:
  // the house organ's chord as the prelude plays it; in the meeting the
  // house organ plays 2.3 dB under it), the loudest three seconds (a shaken
  // final chord and the cascade), in the guests lab as the engine seats the
  // bells (a step nearer than the choir; "as seated"). Measured: at 0.47
  // the hymns sat +3.7 and +3.9 LU over the reference and the reverent seat
  // level with it (−0.5 to +0.3); at 0.37 (2.1 dB down), with the
  // sacrament's stroke softer (SACRAMENT), the hymns sit about level with
  // the reference and the reverent seat about four under it. The owner took
  // the trombones 4 dB down after hearing them; the bells begin nearer
  // where the trombones ended.
  var LEVEL = 0.37;
  // the reverent seat: every stroke at this share of the ringers' mf — a
  // softer stroke is a darker bell (fewer upper partials), as it is in the
  // bronze (about 0.6 is right for the seat; 0.78 rang too bright)
  var SACRAMENT = 0.62;
  var RANGE = [165, 2640];                        // the colony's set: E3 to E7

  function oddsFor(info) {
    // (the meeting hands this room its odds from Calendar.GUEST_ODDS,
    // info.odds; a lab without them reads the room's own ODDS)
    if (info && info.odds != null) return Math.max(0, Math.min(1, +info.odds));
    var w = ODDS.weight;
    var k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestHandbells: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }

  // ==========================================================================
  // THE SHAPE — the musical dice of one performance, all drawn, in order
  // ==========================================================================
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      pieceU: r.next(),                  // hymn or round (read against the seat)
      ringers: r.rint(8, 12),
      lowRight: r.chance(0.75),          // the bass bells at the audience's right
      width: r.rnd(0.62, 0.85),          // how far across the field the line stands
      tempo: r.rnd(0.86, 1.04),          // the hymn's pace × this (a little broader: bells ring on)
      roundBeat: r.rnd(0.44, 0.56),      // the round's beat, s
      introU: r.next(),
      verse2U: r.next(),
      twoVerses: r.chance(0.75),
      finalShake: r.chance(0.55),
      cascade: r.pickW([["chord", 6], ["scale", 4]]),
      cascadeRate: r.rnd(8, 11.5),       // bells a second, down the line
      ending: r.pickW([["ring", 6], ["damp", 4]]),
      dyn: r.rnd(0.56, 0.68),            // mf, as the ringers mean it
      roundVoices: r.pickW([[3, 3], [4, 1.2]]),
      roundMeter: r.pickW([["4/4", 3], ["3/4", 2]]),
      roundLate: r.chance(0.5),          // the round's last voice holds its final note under the chord
      descantStep: r.pickW([[2, 3], [4, 1]]),
    };
  }
  function pieceOf(sh, seat, hasHymn) {
    if (!hasHymn) return "round";
    var pHymn = seat === "sacrament" ? 0.85 : seat === "postlude" ? 0.4 : 0.6;
    return sh.pieceU < pHymn ? "hymn" : "round";
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), seatU = rs.next(), atU = rs.next();          // DICE: every die, first
    var sh = shapeOf(stream);
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [];
    var order = secs.map(function (s) { return s && s.type; });
    var held = {};
    guests.forEach(function (g) { if (g && g.section) held[g.section] = true; });
    // a section, or one beside it, holds a guest (sections of one type —
    // the hymns — count together: a guest names the type, not the hymn)
    function crowded(type) {
      if (held[type]) return true;
      for (var i = 0; i < order.length; i++) {
        if (order[i] !== type) continue;
        if ((i > 0 && held[order[i - 1]]) || (i + 1 < order.length && held[order[i + 1]])) return true;
      }
      return false;
    }
    var free = SEATS.filter(function (s) { return order.indexOf(s) >= 0 && !crowded(s); });
    var bell = null;
    guests.forEach(function (g) { if (g && BELL_GUESTS.indexOf(g.type) >= 0 && !bell) bell = g.type; });
    if (bell) why = bell === "steeples" ? "the steeples ring today" : "one bell guest a meeting (" + bell + ")";
    else if (!free.length) why = "no seat free (" + SEATS.filter(function (s) { return order.indexOf(s) >= 0; }).map(function (s) { return s + (held[s] ? " taken" : " beside a guest"); }).join(", ") + ")";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var tot = 0; free.forEach(function (s) { tot += SEAT_W[s]; });
    var u = seatU * tot, seat = free[free.length - 1];
    for (var i = 0; i < free.length; i++) { u -= SEAT_W[free[i]]; if (u <= 0) { seat = free[i]; break; } }
    var at = AT[seat][0] + (AT[seat][1] - AT[seat][0]) * atU;
    var mat = info.material && info.material.prepared ? info.material : null;
    var piece = mat ? mat.piece : pieceOf(sh, seat, true);
    var dur = mat ? score(mat, stream, 0).end : estimate(piece, sh);
    return {
      seat: {
        guest: NAME, seat: seat, section: seat, at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 3).toFixed(2),       // the section should last at least this long
        piece: piece, ringers: sh.ringers, estimated: !mat,
        odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }
  // (without the arrangement: a Common Meter hymn at 0.7 s a beat, rung
  // twice with an introduction, or a three-voice round)
  function estimate(piece, sh) {
    if (piece === "round") {
      var P = sh.roundVoices === 4 ? 4 : 3, ph = 2 * (sh.roundMeter === "3/4" ? 3 : 4) * sh.roundBeat;
      return ((2 * P + sh.roundVoices - 1) * ph < 26 ? 3 * P : 2 * P) * ph + (sh.roundVoices - 1) * ph + 10;
    }
    var verse = 4 * (8 + 1.4) * 0.7 / sh.tempo;
    return (sh.twoVerses ? 2 : 1) * verse + 5 + 9;
  }

  // ==========================================================================
  // PITCH — the mode's degrees, as the composer spells them (7-degree space,
  // 0 the final), and their just ratios (kolob-pitch.js's parent scales)
  // ==========================================================================
  var PARENT = window.KOLOB.Pitch.PARENT_RATIOS;   // the parent scale of each mode, just
  var CLASSES = window.KOLOB.Pitch.CLASSES;        // the degrees a bell set holds
  function modeName(m) { return window.KOLOB.Pitch.modeName(m); }
  function mod(a, n) { return window.KOLOB.Num.mod(a, n); }
  function degRatio(mode, d) { return PARENT[modeName(mode)][mod(d, 7)] * Math.pow(2, Math.floor(d / 7)); }
  function monzoRatio(m) { return window.KOLOB.Pitch.ratio(m || [0, 0, 0, 0]); }   // (no monzo: the unison)
  // (Math.log over LN2, where KOLOB.Pitch.centsOf takes Math.log2: the two
  // can differ in the last bit, so the room's cents stay its own)
  function cents(r) { return 1200 * Math.log(r) / Math.LN2; }
  function num(x, d) { return window.KOLOB.Num.positive(x, d); }
  // THE GROUND of a round, per mode: two chords, one a bar, every tone of
  // each just against the set (a bell is a fixed pitch; see the header)
  var GROUND = {
    ionian: [[0, 2, 4], [4, 6, 1]], mixolydian: [[0, 2, 4], [3, 5, 0]], hexa: [[0, 2, 4], [3, 5, 0]],
    dorian: [[0, 2, 4], [3, 5, 0]], aeolian: [[0, 2, 4], [3, 5, 0]], penta: [[0, 2, 4], [5, 0, 2]],
  };
  var GROUND_NAME = { ionian: "I–V", mixolydian: "I–IV", hexa: "I–IV", dorian: "i–IV", aeolian: "i–iv", penta: "I–vi" };

  // the voice's decay law (KOLOB.VoicesFolk.bell.tau), copied so a score is
  // pure in Node; the lab checks that the two agree
  function bellTau(f) { return Math.max(0.35, Math.min(3.6, 1.2 * Math.pow(523 / f, 0.62))); }
  function lifeOf(f, tech) {
    var tau = bellTau(f);
    if (tech === "mart") tau = Math.min(tau, 0.085);
    if (tech === "thumb") tau = Math.min(tau, 0.15);
    return 6.9 * tau;
  }

  // ==========================================================================
  // THE ROUND — composed for the bells (pure)
  // ==========================================================================
  // Rhythm cells per phrase kind and meter, in beats; the strong beats of a
  // bar (1 and 3 in 4/4, 1 in 3/4) take a tone of the bar's chord, the others
  // a chord tone or a step between two notes.
  var CELLS = {
    "4/4": { long: [[2, 2], [2, 2]], walk: [[1, 1, 1, 1], [1, 1, 2]], run: [[0.5, 0.5, 0.5, 0.5, 1, 1], [0.5, 0.5, 0.5, 0.5, 2]], low: [[2, 2], [2, 2]] },
    "3/4": { long: [[3], [2, 1]], walk: [[1, 1, 1], [2, 1]], run: [[0.5, 0.5, 0.5, 0.5, 1], [1, 1, 1]], low: [[3], [3]] },
  };
  var KIND_TECH = { long: "ring", walk: "damp", run: "thumb", low: "mart" };
  var KIND_SPAN = { long: [0, 7], walk: [1, 8], run: [0, 9], low: [-3, 4] };
  function round(mode, stream, opts) {
    opts = opts || {};
    mode = modeName(mode);
    var meter = opts.meter === "3/4" ? "3/4" : "4/4", bpb = meter === "3/4" ? 3 : 4;
    var voices = opts.voices === 4 ? 4 : 3;
    var r = need(stream).fork("round:" + mode + ":" + meter + ":" + voices);
    var ground = GROUND[mode], cls = CLASSES[mode];
    var kinds = voices === 4 ? ["long", "walk", "run", "low"] : ["long", "walk", "run"];
    function isChord(d, bar) { return ground[bar].indexOf(mod(d, 7)) >= 0; }
    function inMode(d) { return cls.indexOf(mod(d, 7)) >= 0; }
    function strong(beat) { return beat === 0 || (bpb === 4 && beat === 2); }
    var phrases = [];
    kinds.forEach(function (kind, ki) {
      var rk = r.fork("phrase:" + ki), cells = CELLS[meter][kind], span = KIND_SPAN[kind];
      var slots = [];
      cells.forEach(function (cell, bar) { var b = 0; cell.forEach(function (len) { slots.push({ bar: bar, beat: b, beats: len }); b += len; }); });
      var best = null, bestScore = -1e9;
      for (var tr = 0; tr < 260; tr++) {
        var degs = [], ok = true;
        for (var s = 0; s < slots.length; s++) {
          var sl = slots[s], pool = [];
          for (var d = span[0]; d <= span[1]; d++) {
            if (!inMode(d)) continue;
            var onStrong = strong(sl.beat) || sl.beats >= 2;
            if (onStrong && !isChord(d, sl.bar)) continue;
            if (s > 0 && Math.abs(d - degs[s - 1]) > 4) continue;           // no leap past a fifth
            pool.push(d);
          }
          if (!pool.length) { ok = false; break; }
          degs.push(rk.pick(pool));
        }
        if (!ok) continue;
        // a weak-beat note that is no chord tone must pass or turn by step
        var sc = 0;
        for (var i = 0; i < degs.length; i++) {
          var sl2 = slots[i];
          if (!isChord(degs[i], sl2.bar)) {
            var p = degs[i - 1], nx = degs[i + 1];
            var stepIn = p != null && Math.abs(degs[i] - p) === 1, stepOut = nx != null && Math.abs(nx - degs[i]) === 1;
            if (!(stepIn && stepOut)) { sc -= 40; }
          }
          if (i > 0) {
            var iv = Math.abs(degs[i] - degs[i - 1]);
            sc += iv === 1 ? 3 : iv === 2 ? 1.5 : iv === 0 ? (kind === "low" ? 0 : -2.5) : iv <= 4 ? -0.5 * iv : -6;
          }
        }
        // the kinds' own characters
        var lo = Math.min.apply(null, degs), hi = Math.max.apply(null, degs);
        if (kind === "run") sc += (hi - lo >= 4 ? 4 : -4);
        if (kind === "long") sc += (degs[0] === 0 || degs[0] === 2 || degs[0] === 4 ? 3 : 0) + (hi - lo <= 5 ? 2 : -2);
        if (kind === "low") sc += (mod(degs[0], 7) === 0 ? 4 : 0) + (hi - lo >= 3 ? 2 : 0);
        // against the phrases already written: on a strong beat, another tone
        // of the chord (the canon should sound a triad, not a unison)
        phrases.forEach(function (ph) {
          ph.notes.forEach(function (n2) {
            slots.forEach(function (sl3, j) {
              if (sl3.bar === n2.bar && sl3.beat === n2.beat && strong(sl3.beat)) sc += mod(degs[j], 7) === mod(n2.deg, 7) ? -2 : 1;
            });
          });
        });
        // the join from the phrase before (and, for the last, round again
        // into the first): by step, or near
        if (phrases.length) { var pl = phrases[phrases.length - 1].notes, jn = Math.abs(degs[0] - pl[pl.length - 1].deg); sc += jn <= 2 ? 2 : jn <= 4 ? 0 : -2; }
        if (ki === kinds.length - 1 && phrases.length) { var jf = Math.abs(phrases[0].notes[0].deg - degs[degs.length - 1]); sc += jf <= 2 ? 2 : jf <= 4 ? 0 : -2; }
        if (sc > bestScore) { bestScore = sc; best = degs.slice(); }
      }
      if (!best) best = slots.map(function (sl4) { return ground[sl4.bar][0]; });
      phrases.push({ kind: kind, tech: KIND_TECH[kind], notes: slots.map(function (sl5, j) { return { bar: sl5.bar, beat: sl5.beat, beats: sl5.beats, deg: best[j] }; }) });
    });
    return { mode: mode, meter: meter, beatsPerBar: bpb, bars: 2, ground: ground, groundName: GROUND_NAME[mode], voices: voices, phrases: phrases };
  }

  // ==========================================================================
  // READING THE HYMN — every part's notes on one timeline (pure)
  // ==========================================================================
  var PARTS = ["S", "A", "T", "B"];
  function lineLength(ln) { return window.KOLOB.Score.lineLength(ln); }
  // → { lines: [{ b0, beats, hold, breath, parts: {P: [{beat, beats, ratio, deg, alt}]}, chords, peak }], beats }
  // beat: from the hymn's start, with each line's fermata held (hold beats
  // added after the fermata note) and a breath after a line that asks one
  function readHymn(h) {
    var lines = [], at = 0;
    (h.lines || []).forEach(function (ln, li) {
      var len = lineLength(ln), next = h.lines[li + 1];
      if (next && next.startBeat != null && ln.startBeat != null) len = Math.max(len, next.startBeat - ln.startBeat);
      var fermata = (ln.fermataBeats || []).length ? Math.max.apply(null, ln.fermataBeats) : null;
      var parts = {}, lastLen = 1;
      PARTS.forEach(function (p) {
        var src = (ln.notes && ln.notes[p]) || [], out = [];
        for (var k = 0; k < src.length; k++) {
          var n = src[k];
          if (!n || n.monzo == null) continue;
          var b1 = n.beat + n.beats;
          // (a tie joins only where the pitch holds, in beats, on no clock: not KOLOB.Score.sungNotes)
          while (src[k].tie && k + 1 < src.length && src[k + 1] && src[k + 1].monzo && Math.abs(monzoRatio(src[k + 1].monzo) - monzoRatio(n.monzo)) < 1e-9) { k++; b1 = src[k].beat + src[k].beats; }
          out.push({ beat: n.beat, beats: b1 - n.beat, ratio: monzoRatio(n.monzo), deg: n.deg != null ? n.deg : null, alt: n.alt || 0 });
          if (b1 >= len - 1e-6) lastLen = Math.max(lastLen, b1 - n.beat);
        }
        if (out.length) parts[p] = out;
      });
      var hold = fermata != null ? Math.min(2, 0.6 * lastLen) : 0;
      var breath = ln.breathAfter !== false ? 0.35 : 0;
      lines.push({ b0: at, beats: len, hold: hold, breath: breath, parts: parts, chords: ln.chords || [], peak: !!ln.peak, fermata: fermata });
      at += len + hold + breath;
    });
    return { lines: lines, beats: at };
  }

  // ==========================================================================
  // PREPARE — the arrangement, ready to ring (pure; itself material)
  // ==========================================================================
  // a fault is told, never hidden (kolob-core.js, THE FAULTS): through the
  // house's confess, once per what, where the house is loaded; plainly on a
  // bench without it
  function confess(what, err) { var S = window.KOLOB._s; if (S && S.confess) S.confess(what, err); else if (typeof console !== "undefined") console.error("Kolob: " + what, err); }
  function prepare(material, stream) {
    if (material && material.prepared) return material;
    var M = material || {};
    var sh = shapeOf(stream);
    var seat = M.seat || "invocation";
    var K = num(M.keynoteHz, 260);
    var h = M.hymn && M.hymn.lines && M.hymn.lines.length ? M.hymn : null;
    var source = h ? (h.provenance === "earth" ? "an Earth tune" : "the day's hymn") : null;
    if (!h && M.piece !== "round" && !M.round && window.KOLOB.Composer && window.PJ2) {
      // no hymn handed over: the choir rings one of the colony's (pure)
      try { h = window.KOLOB.Composer.compose(need(stream).fork("material").fork("hymn"), { dialect: "tabernacle", mode: M.mode ? modeName(M.mode) : undefined }); source = "a hymn composed for the bells"; }
      catch (e) { h = null; confess("the handbells' hymn could not be composed (they ring without one)", e); }
    }
    var piece = M.piece === "round" || M.round ? "round" : M.piece === "hymn" && h ? "hymn" : pieceOf(sh, seat, !!h);
    var mode = modeName((h && h.mode) || M.mode || "ionian");
    var keyR = h ? monzoRatio(h.keyMonzo) : 1;
    var out = { prepared: true, piece: piece, seat: seat, keynoteHz: K, mode: mode, finalHz: K * keyR, phone: !!M.phone, source: null };
    if (piece === "round") {
      var rd = M.round && M.round.phrases ? M.round : round(mode, need(stream).fork("material"), { meter: sh.roundMeter, voices: sh.roundVoices });
      out.round = rd; out.source = M.round ? "the round handed over" : "a round for the bells (" + rd.groundName + ", " + rd.meter + ", " + rd.voices + " voices)";
      out.mode = rd.mode;
      if (h) { out.hymnId = h.id; out.hymnName = h.nameEn || null; }
    } else {
      out.hymn = readHymn(h);
      out.melodyPart = h.melodyPart || "S";
      out.beatS = num(h.beatS, 0.7);
      out.hymnId = h.id; out.hymnName = h.nameEn || null; out.dialect = h.dialect || null;
      out.source = source + (h.nameEn ? " (" + h.nameEn + ", " + (h.dialect || "?") + ")" : "");
    }
    return out;
  }

  // ==========================================================================
  // THE LINE OF RINGERS — the set, who holds what, where each stands (pure)
  // ==========================================================================
  // bells: from every sounded pitch of the arrangement (with its 7-degree
  // letter) and every degree of the mode between the lowest and the highest
  function bellSet(notes, mode, finalHz) {
    var byKey = {}, letters = {}, cls = CLASSES[mode];
    notes.forEach(function (n) {
      var key = n.f.toFixed(2);
      if (!byKey[key]) byKey[key] = { f: n.f, letter: n.letter, alt: n.alt || 0 };
      letters[n.letter] = true;
    });
    var ls = Object.keys(letters).map(Number);
    var lo = Math.min.apply(null, ls), hi = Math.max.apply(null, ls);
    for (var d = lo; d <= hi; d++) {
      if (cls.indexOf(mod(d, 7)) < 0) continue;
      var have = false;
      Object.keys(byKey).forEach(function (k) { if (byKey[k].letter === d && !byKey[k].alt) have = true; });
      if (!have) { var f = finalHz * degRatio(mode, d); byKey[f.toFixed(2)] = { f: f, letter: d, alt: 0, spare: true }; }
    }
    var bells = Object.keys(byKey).map(function (k) { return byKey[k]; });
    bells.sort(function (a, b) { return a.f - b.f; });
    bells.forEach(function (b, i) { b.i = i; });
    return bells;
  }
  function line(bells, sh) {
    // THE PLACES: one a letter, low to high, and how many bells each holds
    var letters = [];
    bells.forEach(function (b) { if (letters.indexOf(b.letter) < 0) letters.push(b.letter); });
    letters.sort(function (a, b) { return a - b; });
    var w = letters.map(function (L) { return bells.filter(function (b) { return b.letter === L; }).length; });
    var n = letters.length;
    var R = Math.max(1, Math.min(sh.ringers, n));
    // (a small set: fewer ringers, two places each where the set allows —
    // but eight still stand in the line, and then some ring a single bell)
    if (n < 2 * R) R = Math.max(Math.min(8, n), Math.ceil(n / 2));
    R = Math.min(R, n);
    // THE STRETCHES: the places cut into R runs, none heavier than it must
    // be (the lightest possible heaviest hand), and among those cuts the
    // most even — the bells spread, and two places a ringer where it can
    // be. A set whose hands would hold more than four bells brings more
    // ringers, up to twelve.
    function cut(R) {
      var C = 0; w.forEach(function (x) { C = Math.max(C, x); });
      // the least cap at which R runs suffice (greedy is exact for a cap)
      function runs(cap) { var k = 1, acc = 0; for (var i = 0; i < n; i++) { if (acc + w[i] > cap) { k++; acc = 0; } acc += w[i]; } return k; }
      while (runs(C) > R) C++;
      // exactly R runs, each ≤ C, the most even (additive cost, so a DP)
      var INF = 1e18, best = [], from = [];
      for (var r = 0; r <= R; r++) { best.push([]); from.push([]); for (var i = 0; i <= n; i++) { best[r].push(INF); from[r].push(-1); } }
      best[0][0] = 0;
      for (r = 1; r <= R; r++) {
        for (i = 1; i <= n; i++) {
          var sw = 0;
          for (var j = i - 1; j >= 0; j--) {
            sw += w[j];
            if (sw > C) break;
            if (best[r - 1][j] >= INF) continue;
            var places = i - j, c = best[r - 1][j] + sw * sw + 0.5 * (places - 2) * (places - 2);
            if (c < best[r][i] - 1e-9) { best[r][i] = c; from[r][i] = j; }
          }
        }
      }
      var bounds = [], at = n;
      for (r = R; r > 0; r--) { var j0 = from[r][at]; bounds.unshift([j0, at]); at = j0; }
      return { cap: C, bounds: bounds };
    }
    var cu = cut(R);
    while (cu.cap > 4 && R < Math.min(12, n)) { R++; cu = cut(R); }
    var ringers = [];
    cu.bounds.forEach(function (bd, r) { ringers.push({ i: r, letters: letters.slice(bd[0], bd[1]), bells: [] }); });
    var W = sh.width, side = sh.lowRight ? 1 : -1;
    ringers.forEach(function (rg) { rg.pan = R === 1 ? 0 : side * (W - 2 * W * rg.i / (R - 1)); });
    bells.forEach(function (b) {
      var rg = null;
      ringers.forEach(function (x) { if (x.letters.indexOf(b.letter) >= 0) rg = x; });
      b.ringer = rg.i;
      rg.bells.push(b.i);
      // the left hand the lower place, the right the higher (as the ringer
      // faces us: the audience's right is the ringer's left)
      var place = rg.letters.indexOf(b.letter), nPl = rg.letters.length;
      b.pan = Math.max(-1, Math.min(1, rg.pan + (nPl > 1 ? side * (0.035 - 0.07 * place / (nPl - 1)) : 0)));
    });
    return ringers;
  }
  // TWO HANDS: a ringer can strike two bells at once, not three. A stroke
  // that would be a ringer's third within 30 ms is rung by the neighbour on
  // the side of the line it lies toward (or the other, if that one's hands
  // are full): the bell sounds where it lies on the pad; the strike records
  // who rang it. Returns how many strokes were reached for.
  function twoHands(strikes, ringers, bells) {
    var byR = {}, reached = 0;
    function busy(r, t, bell) {
      var seen = {};
      (byR[r] || []).forEach(function (s) { if (Math.abs(s.t - t) < 0.03 && s.bell !== bell) seen[s.bell] = true; });
      return Object.keys(seen).length;
    }
    strikes.forEach(function (s) {
      var r = s.ringer;
      if (busy(r, s.t, s.bell) >= 2) {
        var rg = ringers[r], b = bells[s.bell], high = rg.letters.indexOf(b.letter) >= rg.letters.length / 2;
        var tries = high ? [r + 1, r - 1] : [r - 1, r + 1];
        for (var k = 0; k < tries.length; k++) {
          var q = tries[k];
          if (q < 0 || q >= ringers.length || busy(q, s.t, s.bell) >= 2) continue;
          s.ringer = q; s.reached = true; reached++;
          break;
        }
      }
      (byR[s.ringer] = byR[s.ringer] || []).push(s);
    });
    return reached;
  }

  // ==========================================================================
  // THE SCORE — the whole performance as data (pure)
  // ==========================================================================
  // A strike: { t, f, letter, alt, v, tech, damp (s, absolute | null: let
  // ring), shake (s long | 0), part, role }. Strikes become RINGS — one per
  // bell for as long as it sounds, re-struck in place — and the live cap is
  // applied to the rings.
  function score(material, stream, t0, opts) {
    opts = opts || {};
    t0 = +t0 || 0;
    var sh = shapeOf(stream);
    var M = prepare(material, stream);
    var strikes = [], stages = [];
    var dyn = sh.dyn * (M.seat === "sacrament" ? SACRAMENT : 1);
    var finalHz = M.finalHz, mode = M.mode;
    // (every stroke lands on a bell the set holds: a note past either end of
    // the set is rung an octave in)
    function strike(o) {
      while (o.f < RANGE[0] * 0.985) { o.f *= 2; o.letter += 7; }
      while (o.f > RANGE[1] * 1.015) { o.f /= 2; o.letter -= 7; }
      strikes.push(o); return o;
    }
    function stage(name, a, b, label) { stages.push({ stage: name, t0: t0 + a, t1: t0 + b, label: label }); }
    var end = 0;
    if (M.piece === "round") end = ringRound(M, sh, dyn, strike, stage);
    else end = ringHymn(M, sh, dyn, strike, stage);
    // THE BELLS, THE LINE
    var bells = bellSet(strikes, mode, finalHz);
    var ringers = line(bells, sh);
    var byF = {};
    bells.forEach(function (b) { byF[b.f.toFixed(2)] = b; });
    // THE CASCADE — down the whole line (or the home chord's bells in it)
    var lastT = end;
    var fall = bells.filter(function (b) {
      if (b.alt) return false;
      if (sh.cascade === "chord") return [0, 2, 4].indexOf(mod(b.letter, 7)) >= 0;
      return true;
    });
    // one bell per letter — the plain one (the comma bell stays in the
    // ringer's other hand)
    var seen = {};
    fall.forEach(function (b) {
      var plain = Math.abs(cents(b.f / (finalHz * degRatio(mode, b.letter)))) < 2;
      if (!seen[b.letter] || (plain && !seen[b.letter].plain)) seen[b.letter] = { b: b, plain: plain };
    });
    fall = Object.keys(seen).map(function (k) { return seen[k].b; }).sort(function (a, b) { return b.f - a.f; });
    var cT = lastT, step = 1 / sh.cascadeRate;
    stage("cascade", cT, cT + fall.length * step + 0.5, "the cascade, " + (sh.cascade === "chord" ? "the home chord's bells" : "every bell") + ", from the top of the line to the bottom");
    fall.forEach(function (b, k) {
      var last = k === fall.length - 1, x = k / Math.max(1, fall.length - 1);
      strikes.push({ t: cT + k * step * (1 + 0.25 * x * x), f: b.f, letter: b.letter, alt: 0, v: Math.min(1, dyn * (last ? 1.12 : 0.95 - 0.12 * x + 0.1 * x * x)), tech: "ring", damp: null, shake: 0, part: "cascade", role: "cascade" });
    });
    var lastStrike = cT + (fall.length - 1) * step * 1.25;
    var hold = sh.ending === "damp" ? 3.2 : 5.5;
    var fin = lastStrike + hold;
    // the director's last gesture: the whole line damped together, or let
    // ring away — faded under the silence where it would outlast the seat
    strikes.forEach(function (s) {
      if (s.damp == null || s.damp > fin) s.damp = sh.ending === "damp" ? fin : null;
      if (sh.ending !== "damp") s.until = fin + 1.2;
    });
    // EVERY STRIKE placed on its bell
    strikes.forEach(function (s) {
      var b = byF[s.f.toFixed(2)];
      s.bell = b.i; s.ringer = b.ringer; s.pan = b.pan;
    });
    strikes.sort(function (a, b) { return a.t - b.t || a.f - b.f; });
    var reached = twoHands(strikes, ringers, bells);
    // THE RINGS: a bell struck while it rings is the same ring, struck again
    var rings = [], current = {};
    strikes.forEach(function (s) {
      var cur = current[s.bell];
      // (a bell damped at the very moment it is struck again — a repeated
      // note, legato — is simply struck again: the hand never lets it stop)
      var sounding = cur && ringStop(cur) > s.t - 0.03;
      var merge = sounding && s.tech !== "mart" && s.tech !== "thumb" && cur.tech !== "mart" && cur.tech !== "thumb" && (cur.damp == null || cur.damp >= s.t - 0.03);
      if (merge) {
        cur.hits.push({ at: +(s.t - cur.t).toFixed(4), v: s.v });
        cur.damp = s.damp;
        if (s.until != null) cur.until = s.until;
        if (s.tech === "shake") { cur.tech = "shake"; cur.shake = { at: +(s.t - cur.t).toFixed(4), dur: s.shake }; }
        cur.notes.push(s);
        return;
      }
      if (sounding) cur.until = Math.min(cur.until != null ? cur.until : Infinity, s.t);   // (a stroke on the table stops what was ringing)
      var rg = { bell: s.bell, f: s.f, t: s.t, v: s.v, tech: s.tech, hits: [], damp: s.damp, until: s.until != null ? s.until : null, shake: s.tech === "shake" ? { at: 0, dur: s.shake } : null, pan: s.pan, ringer: s.ringer, notes: [s] };
      rings.push(rg);
      current[s.bell] = rg;
    });
    // THE LIVE CAP: past it, the oldest ringing bell is damped as the new one
    // strikes (it fades in 50 ms: a ringer's hand, not a cut)
    var cap = opts.maxLive || (M.phone ? MAX_LIVE.phone : MAX_LIVE.desktop), live = [], peak = 0, stolen = 0;
    rings.forEach(function (rg) {
      live = live.filter(function (x) { return ringStop(x) > rg.t + 1e-6; });
      if (live.length >= cap) {
        live.sort(function (a, b) { return a.t - b.t; });
        var victim = live.shift();
        victim.until = Math.min(victim.until != null ? victim.until : Infinity, rg.t);
        stolen++;
      }
      live.push(rg);
      if (live.length > peak) peak = live.length;
    });
    // the rings as the voice takes them (times relative to each ring)
    var outRings = rings.map(function (rg) {
      var stop = ringStop(rg);
      return {
        bell: rg.bell, ringer: rg.ringer, f: rg.f, t: t0 + rg.t, v: rg.v, tech: rg.tech, pan: rg.pan,
        hits: rg.hits, shake: rg.shake,
        damp: rg.damp != null && rg.damp - rg.t < stop - rg.t + 1e-6 ? +(rg.damp - rg.t).toFixed(4) : null,
        until: rg.until != null ? +(Math.max(0.02, rg.until - rg.t)).toFixed(4) : null,
        stop: t0 + stop, notes: rg.notes.length,
      };
    });
    var notes = strikes.map(function (s) {
      var rgEnd = s.damp != null ? s.damp : s.t + lifeOf(s.f, s.tech);
      return { freq: s.f, t: t0 + s.t, dur: Math.max(0.05, Math.min(rgEnd, s.until != null ? s.until : Infinity) - s.t), part: s.part, role: s.role, ringer: s.ringer, bell: s.bell, tech: s.tech, pan: s.pan, v: s.v, reached: !!s.reached };
    });
    var stopMax = 0;
    outRings.forEach(function (rg) { stopMax = Math.max(stopMax, rg.stop); });
    return {
      prepared: M, shape: sh, piece: M.piece, seat: M.seat, source: M.source, mode: mode,
      bells: bells.map(function (b) { return { i: b.i, f: b.f, letter: b.letter, alt: b.alt, spare: !!b.spare, ringer: b.ringer, pan: b.pan }; }),
      ringers: ringers.map(function (r) { return { i: r.i, pan: r.pan, bells: r.bells.slice(), places: r.letters.length }; }),
      reached: reached,
      strikes: notes, rings: outRings, stages: stages,
      t0: t0, end: t0 + fin, until: Math.max(stopMax, t0 + fin),
      live: { cap: cap, peak: peak, stolen: stolen, nodesPerRing: 11, peakNodes: peak * 11 + bells.length + 3 },
    };
  }
  function ringStop(rg) {
    var last = rg.t + (rg.hits.length ? rg.hits[rg.hits.length - 1].at : 0);
    var shakeEnd = rg.shake ? rg.t + rg.shake.at + rg.shake.dur : 0;
    var nat = Math.max(last, shakeEnd) + lifeOf(rg.f, rg.tech);
    var s = nat;
    if (rg.damp != null) s = Math.min(s, rg.damp);
    if (rg.until != null) s = Math.min(s, rg.until);
    return s;
  }

  // ---- the hymn, arranged ----------------------------------------------------
  function ringHymn(M, sh, dyn, strike, stage) {
    var H = M.hymn, mp = M.melodyPart, spb = Math.max(0.5, Math.min(0.95, M.beatS / sh.tempo));
    var sacr = M.seat === "sacrament";
    // THE BELLS' OCTAVE: the hymn an octave up (where handbells sing), unless
    // that would take the tune past the set; a part-line still outside the
    // set folds by an octave
    function allNotes(p) { var a = []; H.lines.forEach(function (ln) { (ln.parts[p] || []).forEach(function (n) { a.push(n); }); }); return a; }
    var tuneAll = allNotes(mp), fz = M.finalHz;
    function spanCost(k) {
      var c = 0;
      PARTS.forEach(function (p) { allNotes(p).forEach(function (n) { var f = fz * n.ratio * Math.pow(2, k); if (f < RANGE[0]) c += cents(RANGE[0] / f) / 100; if (f > RANGE[1]) c += cents(f / RANGE[1]) / 100; }); });
      var med = tuneAll.map(function (n) { return fz * n.ratio * Math.pow(2, k); }).sort(function (a, b) { return a - b; })[Math.floor(tuneAll.length / 2)] || 800;
      return c + Math.abs(Math.log(med / 800) / Math.LN2) * 6;
    }
    var oct = spanCost(1) <= spanCost(0) + 1e-9 ? 1 : 0;
    if (spanCost(2) < spanCost(oct) - 1e-9) oct = 2;
    var foldOf = {};
    H.lines.forEach(function (ln, li) {
      PARTS.forEach(function (p) {
        var ns = ln.parts[p]; if (!ns) return;
        var lo = Infinity, hi = 0;
        ns.forEach(function (n) { var f = fz * n.ratio * Math.pow(2, oct); lo = Math.min(lo, f); hi = Math.max(hi, f); });
        var k = 0;
        if (lo < RANGE[0] && hi * 2 <= RANGE[1] * 1.03) k = 1;
        else if (hi > RANGE[1] && lo / 2 >= RANGE[0] * 0.97) k = -1;
        foldOf[li + ":" + p] = k;
      });
    });
    function fOf(n, li, p, extra) { return fz * n.ratio * Math.pow(2, oct + (foldOf[li + ":" + p] || 0) + (extra || 0)); }
    function letterOf(n, li, p, extra) { return (n.deg != null ? n.deg : Math.round(cents(n.ratio) / 171.4)) + 7 * (oct + (foldOf[li + ":" + p] || 0) + (extra || 0)); }
    var t = 0;
    // (a line's clock: its beats from the line's start, a fermata held)
    function T(ln, beat) { return (beat + (ln.fermata != null && beat > ln.fermata + 1e-6 ? ln.hold : 0)) * spb; }
    function lineDur(ln) { return (ln.beats + ln.hold) * spb; }
    function isLast(ln, n) { return n.beat + n.beats >= ln.beats - 1e-6; }
    // A TUNE SUNG IN UNISON (the Old Way, an Earth tune printed without its
    // parts, the Shaker and Primary songs): the bells' own open fifth, do
    // and sol low in the line, rung at each line's start and again at its
    // middle, let ring to the breath — the tunebooks' drone — and the tune
    // over it; in the second verse the tune in octaves, its long notes shaken
    var unison = PARTS.filter(function (p) { return H.lines.some(function (ln) { return ln.parts[p] && ln.parts[p].length; }); }).length === 1;
    var droneK = 0;
    while (fz * Math.pow(2, droneK) > 330) droneK--;
    while (fz * Math.pow(2, droneK) < 190) droneK++;
    function ringDrone(ln, t0, v, nextStart, lastLine) {
      var mid = null, ns = ln.parts[mp] || [];
      ns.forEach(function (n) { if (mid == null && n.beat >= ln.beats / 2 - 1e-6 && n.beats >= 1 - 1e-6 && n.beat + n.beats < ln.beats - 1e-6) mid = n.beat; });
      [0, mid].forEach(function (b) {
        if (b == null) return;
        [0, 4].forEach(function (d) {
          strike({ t: t0 + T(ln, b), f: fz * degRatio(M.mode, d) * Math.pow(2, droneK), letter: d + 7 * droneK, alt: 0, v: Math.min(1, v * (b ? 0.62 : 0.72)), tech: "ring", damp: lastLine ? null : nextStart, shake: 0, part: "drone", role: "drone (the open fifth)" });
        });
      });
    }
    // THE TUNE IN THE BASS BELLS: an octave down, if the whole tune fits the
    // set there (a tune that would fall off the bottom stays where it is
    // rather than breaking its line into octave leaps)
    var bassShift = -1;
    H.lines.forEach(function (ln, li) { (ln.parts[mp] || []).forEach(function (n) { if (fOf(n, li, mp, -1) < RANGE[0] * 0.985) bassShift = 0; }); });
    // THE LINES, ONE SETTING AT A TIME
    function ringLine(ln, li, t0, set, v, opts2) {
      opts2 = opts2 || {};
      var nextStart = t0 + lineDur(ln) + ln.breath * spb;       // where the next line's first stroke falls
      var damps = {};
      if (unison) ringDrone(ln, t0, v, nextStart, opts2.lastLine);
      PARTS.forEach(function (p) {
        var ns = ln.parts[p]; if (!ns) return;
        var tune = p === mp;
        if (set === "bass" && !tune) return;                     // (the harmony is rung as chords below)
        ns.forEach(function (n, k) {
          var a = t0 + T(ln, n.beat), b = t0 + T(ln, n.beat + n.beats), last = isLast(ln, n), long = n.beats >= 2 - 1e-6;
          var extra = set === "bass" && tune ? bassShift : 0;
          var vv = v * (tune ? 1.12 : p === "B" ? 0.92 : 0.8) * (ln.peak ? 1.06 : 1);
          var tech = "damp", damp = b, shake = 0;
          if (set === "mart" && !tune) {
            // the table on the beat: notes shorter than a beat are left to the tune
            if (n.beats < 1 - 1e-6 && !(n.beat % 1 === 0)) return;
            tech = last ? (sh.finalShake || li === H.lines.length - 1 ? "shake" : "ring") : "mart";
            vv = v * (p === "B" ? 1.05 : 0.9);
            damp = last ? nextStart : null;
            if (tech === "shake") shake = Math.max(0.3, b - a - 0.08);
          } else if (last) {
            // the line's last chord: let ring through the breath (a shaken
            // chord in the table's verse)
            tech = set === "mart" ? "shake" : "ring";
            if (tech === "shake") shake = Math.max(0.3, b - a - 0.06);
            damp = nextStart;
          } else if (tune && long) {
            tech = set === "mart" && !sacr ? "shake" : "ring";
            if (tech === "shake") shake = Math.max(0.3, b - a - 0.08);
            damp = b + (tech === "ring" ? Math.min(0.5, 0.4 * (b - a)) : 0);
          } else if (tune && set === "bass") {
            tech = "ring"; damp = b + 0.06;                      // the big bells, legato
          }
          if (opts2.lastLine && last) damp = null;                // the final chord: to the cascade
          strike({ t: a, f: fOf(n, li, p, extra), letter: letterOf(n, li, p, extra), alt: n.alt, v: Math.min(1, vv), tech: tech, damp: damp, shake: shake, part: p, role: tune ? (set === "bass" ? "tune (bass bells)" : "tune") : "harmony" });
          if (set === "octaves" && tune) {
            // the tune doubled an octave over, by the ringers at the top of the line
            strike({ t: a, f: fOf(n, li, p, 1), letter: letterOf(n, li, p, 1), alt: n.alt, v: Math.min(1, vv * 0.72), tech: long && !last && !sacr ? "shake" : tech === "shake" ? "ring" : tech, damp: damp, shake: long && !last && !sacr ? Math.max(0.3, b - a - 0.08) : 0, part: p, role: "tune (octave)" });
          }
          damps[p] = damp;
        });
      });
      if (set === "bass") {
        // THE HARMONY AS CHORDS: at each change, the parts' tones above the
        // tune, rung together and let ring to the next change — every tone
        // over the highest note the tune reaches while the chord rings (a
        // tone that would fall under it goes up an octave, or, past the top
        // of the set, is left out): the tune is the bass, always
        var onsets = {};
        PARTS.forEach(function (p) { if (p === mp || !ln.parts[p]) return; ln.parts[p].forEach(function (n) { onsets[n.beat.toFixed(3)] = true; }); });
        var times = Object.keys(onsets).map(Number).sort(function (a, b) { return a - b; });
        // (one chord a beat at most: a passing note in an inner part is not a new chord)
        var chordAt = times.filter(function (b, i) { return i === 0 || b - times[i - 1] >= 1 - 1e-6 || b % 1 === 0; });
        chordAt.forEach(function (b, i) {
          var b2 = i + 1 < chordAt.length ? chordAt[i + 1] : ln.beats, a = t0 + T(ln, b), e = t0 + T(ln, b2), last = i === chordAt.length - 1;
          var tuneTop = 0;
          (ln.parts[mp] || []).forEach(function (x) { if (x.beat < b2 - 1e-6 && x.beat + x.beats > b + 1e-6) tuneTop = Math.max(tuneTop, fOf(x, li, mp, bassShift)); });
          var rung = {};
          PARTS.forEach(function (p) {
            if (p === mp || !ln.parts[p]) return;
            var n = null;
            ln.parts[p].forEach(function (x) { if (x.beat <= b + 1e-6 && x.beat + x.beats > b + 1e-6) n = x; });
            if (!n) return;
            var extra = p === "B" ? 1 : 0;
            while (fOf(n, li, p, extra) <= tuneTop * 1.015) extra++;
            var f = fOf(n, li, p, extra);
            if (f > RANGE[1] * 1.015 || rung[f.toFixed(2)]) return;
            rung[f.toFixed(2)] = true;
            strike({ t: a, f: f, letter: letterOf(n, li, p, extra), alt: n.alt, v: Math.min(1, v * 0.7), tech: "ring", damp: last ? (opts2.lastLine ? null : nextStart) : e, shake: 0, part: p, role: "harmony (chords)" });
          });
        });
      }
      if (set === "descant") {
        // THE DESCANT: a slow line in the top bells, a tone of the chord a
        // third to a sixth over the tune, by step where it can
        var prev = null;
        for (var b = 0; b < ln.beats - 1e-6; b += sh.descantStep) {
          var sounding = [];
          PARTS.forEach(function (p) { (ln.parts[p] || []).forEach(function (x) { if (x.beat <= b + 1e-6 && x.beat + x.beats > b + 1e-6) sounding.push({ n: x, p: p }); }); });
          var tuneN = null; sounding.forEach(function (s) { if (s.p === mp) tuneN = s; });
          if (!tuneN || tuneN.n.deg == null) continue;
          var tl = letterOf(tuneN.n, li, mp, 0), cands = [];
          sounding.forEach(function (s) {
            if (s.n.deg == null) return;
            var c = mod(s.n.deg, 7);
            for (var L = tl + 2; L <= tl + 5; L++) if (mod(L, 7) === c) cands.push({ L: L, s: s });
          });
          if (!cands.length) continue;
          cands.sort(function (x, y) { return (prev == null ? 0 : Math.abs(x.L - prev) - Math.abs(y.L - prev)) || x.L - y.L; });
          var c0 = cands[0], octs = Math.round((c0.L - letterOf(c0.s.n, li, c0.s.p, 0)) / 7);
          var fD = fOf(c0.s.n, li, c0.s.p, octs);
          if (fD > RANGE[1]) continue;
          var a2 = t0 + T(ln, b), e2 = t0 + T(ln, Math.min(ln.beats, b + sh.descantStep));
          strike({ t: a2, f: fD, letter: c0.L, alt: c0.s.n.alt, v: Math.min(1, v * 0.62), tech: "ring", damp: b + sh.descantStep >= ln.beats - 1e-6 ? (opts2.lastLine ? null : nextStart) : e2 + 0.05, shake: 0, part: "descant", role: "descant" });
          prev = c0.L;
        }
      }
      return nextStart;
    }
    // THE INTRODUCTION
    var intro = sacr ? "none" : sh.introU < 0.5 ? "none" : sh.introU < 0.75 ? "rounds" : "giveout";
    if (intro === "rounds") {
      // six bells down from the top of the tune, rung in rounds twice,
      // treble first (a scale: rounds are the bells in order)
      var topL = -Infinity, topF = 0;
      H.lines.forEach(function (ln, li) { (ln.parts[mp] || []).forEach(function (n) { if (n.alt) return; var L0 = letterOf(n, li, mp, 0); if (L0 > topL) { topL = L0; topF = fOf(n, li, mp, 0); } }); });
      var tops = [], clsR = CLASSES[M.mode];
      for (var L = topL; tops.length < 6 && L > topL - 12; L--) {
        if (clsR.indexOf(mod(L, 7)) < 0) continue;
        var fr = topF * degRatio(M.mode, L) / degRatio(M.mode, topL);
        if (fr >= RANGE[0]) tops.push({ L: L, f: fr });
      }
      var gap = 0.24, rowT = 0;
      stage("intro", 0, 2 * (tops.length + 1) * gap + 0.8, "rounds on " + tops.length + " bells, twice — the tower's own opening");
      for (var row = 0; row < 2; row++) {
        tops.forEach(function (x, k) { strike({ t: rowT + k * gap, f: x.f, letter: x.L, alt: 0, v: dyn * 0.8, tech: "ring", damp: row === 1 ? 2 * (tops.length + 1) * gap + 0.35 : null, shake: 0, part: "intro", role: "rounds" }); });
        rowT += (tops.length + 1) * gap;                          // the handstroke's gap
      }
      t = rowT + 0.9;
    } else if (intro === "giveout") {
      var gl = H.lines[H.lines.length - 1];
      stage("intro", 0, lineDur(gl) + 0.3, "the last line given out");
      ringLine(gl, H.lines.length - 1, 0, "plain", dyn * 0.85);
      t = lineDur(gl) + gl.breath * spb + 0.9;
    }
    // THE VERSES
    var verseDur = 0;
    H.lines.forEach(function (ln) { verseDur += lineDur(ln) + ln.breath * spb; });
    // (a hymn too long for the seat is rung once; a very long one, its first half)
    var nLines = H.lines.length;
    if (t + verseDur + 9 > MAX_DUR) {
      nLines = Math.max(2, Math.ceil(H.lines.length / 2));
      verseDur = 0;
      for (var q = 0; q < nLines; q++) verseDur += lineDur(H.lines[q]) + H.lines[q].breath * spb;
    }
    // (a short hymn is always rung twice; a long one once)
    var two = (sh.twoVerses || t + verseDur + 9 < 36) && t + 2 * verseDur + 9 <= MAX_DUR;
    // DICE: the second setting (verse2U) is drawn whether or not a second
    // verse is rung: rung once, the verse changes setting halfway (the arranger's way — the
    // first couplet plain, the second on the table or in the bass bells), so
    // every hymn the bells ring shows more than one technique
    var ws = unison ? [["octaves", 1]] : sacr ? [["bass", 1], ["descant", 1]] : [["mart", 4], ["bass", 3], ["descant", 3]];
    var tot = 0; ws.forEach(function (w) { tot += w[1]; });
    var u = sh.verse2U * tot, v2 = ws[ws.length - 1][0];
    for (var i = 0; i < ws.length; i++) { u -= ws[i][1]; if (u <= 0) { v2 = ws[i][0]; break; } }
    var half = Math.max(1, Math.ceil(nLines / 2));
    var parts = two ? [{ set: "plain", from: 0, to: nLines }, { set: v2, from: 0, to: nLines }]
      : unison ? [{ set: "octaves", from: 0, to: nLines }]
      : [{ set: "plain", from: 0, to: half }, { set: v2, from: half, to: nLines }];
    var LABELS = { octaves: "the tune in octaves over the open fifth, its long notes shaken",
      plain: unison ? "the tune over the bells' open fifth, do and sol, rung at each line's start" : "the hymn, plain: every part, each note damped as the next begins", mart: "the table: the lower bells martellato on the beat, the tune's long notes shaken", bass: "the tune in the bass bells, the harmony rung above it and let ring", descant: "the hymn again, with a descant in the top bells" };
    parts.forEach(function (pt, vi) {
      var vStart = t, lastPart = vi === parts.length - 1;
      for (var li = pt.from; li < pt.to; li++) {
        var ln = H.lines[li];
        var vv = dyn * (vi === 1 ? 1.1 : 1) * (sacr ? 0.9 : 1);
        t = ringLine(ln, li, t, pt.set, vv, { lastLine: lastPart && li === pt.to - 1 });
      }
      var label = LABELS[pt.set];
      if (!two && parts.length > 1) label = (vi === 0 ? "lines 1–" + pt.to + ": " : "lines " + (pt.from + 1) + "–" + pt.to + ": ") + label.replace("the hymn again, with", "with");
      stage(vi === 0 ? "verse" : "verse2", vStart, t, label);
      if (!lastPart && two) t += 0.5 * spb;
    });
    // THE LAST CHORD (let ring; the cascade begins a beat after it)
    return t + (sh.finalShake ? 0.4 : 0.1);
  }

  // ---- the round --------------------------------------------------------------
  function ringRound(M, sh, dyn, strike, stage) {
    var rd = M.round, spb = sh.roundBeat, bar = rd.beatsPerBar * spb, P = rd.phrases.length, V = rd.voices || P;
    // each voice goes round twice — three times when the round is short, so
    // the choir's round is not over before the room has heard it whole
    var phraseS = rd.bars * bar, times = (2 * P + V - 1) * phraseS < 26 ? 3 : 2;
    // each voice its own octave of the line: the middle, above, below (and,
    // with four, the bass bells) — so the round's voices enter from
    // different places in the room
    // (the base octave is the one that leaves fewest notes off the set;
    // a voice still off it is folded, and may then share a neighbour's octave)
    var fz = M.finalHz, OCT = [1, 2, 0, -1];
    function fOf(d, v) { return fz * degRatio(rd.mode, d) * Math.pow(2, OCT[v]); }
    var baseBest = 0, baseCost = Infinity;
    [-1, 0, 1].forEach(function (e0) {
      var c = 0;
      for (var v = 0; v < V; v++) rd.phrases.forEach(function (ph) { ph.notes.forEach(function (n) { var f = fOf(n.deg, v) * Math.pow(2, e0); if (f < RANGE[0]) c += cents(RANGE[0] / f); if (f > RANGE[1]) c += cents(f / RANGE[1]); }); });
      c += Math.abs(e0) * 50;
      if (c < baseCost - 1e-9) { baseCost = c; baseBest = e0; }
    });
    var voiceOct = [];
    for (var v = 0; v < V; v++) {
      var lo = Infinity, hi = 0;
      rd.phrases.forEach(function (ph) { ph.notes.forEach(function (n) { var f = fOf(n.deg, v) * Math.pow(2, baseBest); lo = Math.min(lo, f); hi = Math.max(hi, f); }); });
      var k = baseBest;
      while (hi * Math.pow(2, k - baseBest) > RANGE[1] && k > baseBest - 3) k--;
      while (lo * Math.pow(2, k - baseBest) < RANGE[0] && k < baseBest + 3) k++;
      voiceOct.push(k);
    }
    var lastEnd = 0;
    for (var v2 = 0; v2 < V; v2++) {
      var entry = v2 * phraseS;
      stage("round-entry", entry, entry + times * P * phraseS, "voice " + (v2 + 1) + " enters" + (v2 === 0 ? " (the middle of the line)" : v2 === 1 ? " (the top of the line)" : v2 === 2 ? " (the bottom of the line)" : " (the bass bells)"));
      for (var rep = 0; rep < times; rep++) {
        rd.phrases.forEach(function (ph, pi) {
          var p0 = entry + (rep * P + pi) * phraseS;
          ph.notes.forEach(function (n, k) {
            var a = p0 + (n.bar * rd.beatsPerBar + n.beat) * spb, b = a + n.beats * spb;
            var endBar = p0 + (n.bar + 1) * bar;
            var finalNote = rep === times - 1 && pi === P - 1 && k === ph.notes.length - 1;
            var tech = ph.tech, damp = b;
            if (tech === "ring") damp = endBar;                          // LV to the bar
            if (tech === "mart" || tech === "thumb") damp = null;         // the table and the thumb stop it
            if (finalNote) { tech = "ring"; damp = null; }
            var f = fOf(n.deg, v2) * Math.pow(2, voiceOct[v2]);
            var vv = dyn * (ph.kind === "long" ? 0.95 : ph.kind === "run" ? 0.72 : ph.kind === "low" ? 0.95 : 0.82) * (v2 === 1 ? 0.9 : 1);
            strike({ t: a, f: f, letter: n.deg + 7 * (OCT[v2] + voiceOct[v2]), alt: 0, v: Math.min(1, vv), tech: tech, damp: damp, shake: 0, part: "voice " + (v2 + 1), role: "round:" + ph.kind });
            lastEnd = Math.max(lastEnd, b);
          });
        });
      }
    }
    // THE WHOLE LINE on the home chord, under the last voice's last note
    // (shaken or let ring), and the cascade after it
    var chordT = lastEnd - (sh.roundLate ? rd.phrases[P - 1].notes[rd.phrases[P - 1].notes.length - 1].beats * spb : 0);
    stage("final", chordT, chordT + 2.2, "the whole line on the home chord" + (sh.finalShake ? ", shaken" : ""));
    [0, 2, 4, 7].forEach(function (d, k) {
      [0, 1].forEach(function (o) {
        var f = fz * degRatio(rd.mode, d) * Math.pow(2, o);
        if (f < RANGE[0] || f > RANGE[1]) return;
        strike({ t: chordT, f: f, letter: d + 7 * o, alt: 0, v: Math.min(1, dyn * 0.72), tech: sh.finalShake ? "shake" : "ring", damp: null, shake: sh.finalShake ? 1.6 : 0, part: "all", role: "final chord" });
      });
    });
    return chordT + (sh.finalShake ? 2.0 : 1.2);
  }

  // ==========================================================================
  // PERFORM — the line of ringers, placed at t (synthesis; reads no clock)
  // ==========================================================================
  function perform(ctx, dest, t, material, stream, hooks) {
    var VF = window.KOLOB.VoicesFolk;
    if (!VF || !VF.create) throw new Error("KOLOB.GuestHandbells: load kolob-voices-folk.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t, { maxLive: hooks.maxLive });
    var synth = need(stream).fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    // THE ROOM'S NEAR WALLS: two early reflections, dark and soft (the bells
    // stand in the chapel, not across the valley — the hall does the rest)
    var air = null;
    if (hooks.air !== false) {
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; lp.Q.value = 0.5;
      var d1 = ctx.createDelay(0.1), d2 = ctx.createDelay(0.1), ag = ctx.createGain();
      d1.delayTime.value = 0.011; d2.delayTime.value = 0.023; ag.gain.value = 0.22;
      bus.connect(d1); bus.connect(d2); d1.connect(lp); d2.connect(lp); lp.connect(ag); ag.connect(dest);
      air = [lp, d1, d2, ag];
    }
    var folk = VF.create(ctx, bus, { rand: synth.fork("folk"), gain: 1 });
    // each bell keeps its panner for the piece (its place in the line)
    var pans = {};
    function panOf(b, p, at) {
      if (pans[b]) return pans[b];
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.setValueAtTime(Math.max(-1, Math.min(1, p)), Math.max(0, at - 0.05));
      sp.connect(folk.out);
      return (pans[b] = sp);
    }
    // where each ringer's hand actually lands (sound-level: a few ms, a
    // little harder or softer — never reported). DICE: drawn for every ring
    // now, in order, so a performance laid out in slices is the same
    // performance
    var hand = synth.fork("hands");
    var lands = sc.rings.map(function (rg) {
      return { dt: hand.rnd(-0.006, 0.006), dv: hand.rnd(0.94, 1.06), hv: rg.hits.map(function () { return hand.rnd(0.94, 1.06); }) };
    });
    function ringIt(k) {
      var rg = sc.rings[k], L = lands[k], t1 = Math.max(t, rg.t + L.dt);
      folk.ring(t1, {
        f: rg.f, v: Math.min(1, rg.v * L.dv), tech: rg.tech,
        hits: rg.hits.map(function (h, j) { return { at: h.at, v: Math.min(1, h.v * L.hv[j]) }; }),
        damp: rg.damp, until: rg.until, shake: rg.shake, dest: panOf(rg.bell, rg.pan, t1),
      });
    }
    function tellStrike(s) {
      hooks.onNote({ freq: s.freq, t: s.t, dur: s.dur, part: s.part, role: s.role, ringer: s.ringer, bell: s.bell, tech: s.tech, pan: s.pan, loud: s.v, reached: s.reached });
    }
    // LAID OUT A SLICE AT A TIME (hooks.defer — the engine's clock): the
    // rings that begin within each SLICE seconds are built AHEAD seconds
    // before the first of them sounds, each slice in a tick of the clock of
    // its own, and their strokes told then (as the trombones' phrases are).
    // Built in one cue, a hymn's bells cost 200–530 ms of main thread
    // (measured in a live context: every ring's partials, automation and,
    // for a shake, its train of clapper knocks); a lab with no clock lays it
    // all out at once.
    var AHEAD = 2.5, SLICE = 1.0, slices = [];
    sc.rings.forEach(function (rg, k) {
      var cur = slices[slices.length - 1];
      if (!cur || rg.t >= cur.t0 + SLICE) slices.push(cur = { t0: rg.t, rings: [], strikes: [] });
      cur.rings.push(k);
    });
    sc.strikes.forEach(function (st) {
      var home = slices[0];
      for (var q = 0; q < slices.length && slices[q].t0 <= st.t + 1e-9; q++) home = slices[q];
      if (home) home.strikes.push(st);
    });
    slices.forEach(function (sl) {
      function layIt() {
        sl.rings.forEach(ringIt);
        if (hooks.onNote) sl.strikes.forEach(tellStrike);
      }
      var when = sl.t0 - AHEAD;
      if (hooks.defer && when > t + 0.05) hooks.defer(when, layIt);
      else layIt();
    });
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    // when the last bell has gone, let the line go
    var tail = sc.until + 0.6;
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () {
      try {
        Object.keys(pans).forEach(function (k) { pans[k].disconnect(); });
        folk.out.disconnect(); sg.disconnect(); sent.disconnect(); bus.disconnect();
        if (air) air.forEach(function (n) { n.disconnect(); });
      } catch (e) { /* gone already */ }
    };
    sent.start(Math.max(0, t)); sent.stop(tail);
    perform.last = { folk: folk, score: sc };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform, round: round,
    ODDS: ODDS, EXCLUDES: EXCLUDES, BELL_GUESTS: BELL_GUESTS, SEATS: SEATS, MAX_LIVE: MAX_LIVE, RANGE: RANGE,
    NAME: NAME, LABEL: LABEL, GROUND: GROUND, bellTau: bellTau,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-handbells.js"] = true;   // the load guard's roll call

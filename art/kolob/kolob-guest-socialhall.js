// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE SOCIAL HALL (KOLOB.GuestSocialHall)
//
// Brigham Young told the Saints to dance. At Winter Quarters, on the frozen
// Missouri in the winter of 1846, the camp cleared the floor of the council
// house and danced to William Pitt's brass band; on the trail the companies
// danced at night inside the circle of wagons, to a fiddle, on the prairie
// grass; and when the valley was theirs they built SOCIAL HALLS — the one in
// Great Salt Lake City was dedicated in 1853 with a ball — and the wards
// built their chapels with a hall beside them, or made the chapel one: the
// benches pushed back to the walls, the floor swept, a fiddler on a chair.
// At the rim of Kolob's light the ward keeps the custom. On some Sundays —
// Pioneer Day most of all, a jubilee, a wedding — the benediction is said,
// and nobody goes home.
//
// WHAT YOU HEAR, in order:
//   · THE BENCHES pushed back: wood scraping on the boards, three or four,
//     across the room; feet;
//   · THE FIDDLER TUNING: the two low strings bowed together, one a little
//     flat and brought up until the fifth is pure; then the next pair;
//   · THE CALLER: "HON-our your PART-ners" — on its vowels, chanted on the
//     tune's fifth (no English: the call's shape, its stresses and its lift,
//     are what a dancer hears first anyway);
//   · THE POTATOES: two bars of the fiddle chopping the home chord, the old
//     kick-off, so the dancers find the tempo;
//   · THE DANCE — a REEL (2/4, running eighths, the shuffle's off-beat
//     accent), a JIG (6/8, long–short), or a QUADRILLE (a statelier 6/8 or
//     2/4, a call before every figure) — made from ONE OF THE MEETING'S OWN
//     HYMNS, the one the ward has just sung more often than not: its first
//     two lines become the A strain, its last two (or its refrain) the B
//     strain, eight bars each, AABB, two or three times through. Every
//     hymn note keeps its place and its exact pitch; between them the
//     fiddle runs — passing notes, neighbours, the chord's own tones (the
//     hymn's harmony, read beat by beat from its four parts), cuts on the
//     repeated notes, a slide into the long ones — and it leans its bow on
//     an open string tuned to the tune's tonic (cross-tuned, as the old
//     fiddlers did for every key), rocking onto the drone on the long notes
//     and off it through the runs;
//   · THE FLOOR: the dancers' feet on the boards, on the beat, heaviest on
//     the bar; hands clapping the back-beat once the dance is going; a stamp
//     at the end of the last B strain;
//   · THE CALLS before each figure (swing your partner, promenade, do-si-do,
//     allemande left, balance, grand right and left, ladies' chain, circle
//     left) — each its own shape of vowels and stresses; a dancer's whoop;
//   · THE END: the last phrase played again (the tag), the final double
//     stop ringing the harmonic seventh over the tonic (4:7) before it
//     settles on the fifth, a stamp, the caller's shout, applause.
//
// THE SEVENTH HARMONIC. Three places, all the fiddle's (PLAN §3.4, the
// Social Hall's ringing chord): the BLUE SLIDE — the tune's major third,
// where it is long and strong, approached from the septimal minor third
// (7/6) under it, the old fiddlers' bent third; the DOMINANT'S SEVENTH as a
// double stop at a half cadence on sol (sol with 7/4 above it: 4:7, the
// barbershop's own ring); and the FINAL — the tonic with its harmonic
// seventh, then with its fifth. The hymn's own notes stay in the 5-limit
// the composer wrote them in.
//
// IT REPLACES THE POSTLUDE. It is seated only there: never at a funeral or
// on a fast Sunday; never with a guest in the postlude or in the doxology
// beside it (PLAN §8.13: no two guests in adjacent sections); weighted to
// Pioneer Day, the jubilees and weddings (ODDS). About one meeting in
// sixteen overall, a fifth of Pioneer Days and of weddings (the lab's odds
// card measures it).
//
// PURE PLANNING. plan(), decide(), prepare(), tune() and score() touch no
// AudioContext, DOM, clock or Math.random; every die comes from the stream
// passed in (guest:socialhall:<n>), on forks: "seat" (the odds, the moment),
// "shape" (the dance, its tempo, how many times through, which hymn, the
// arrangement), "tune" (the figuration: every slot's figure, drawn
// unconditionally), "people" (the fiddler, the caller, who whoops) and
// "synth" (the feet's and hands' scatter, the benches: sound-level, never
// reported).
//
// Public surface: window.KOLOB.GuestSocialHall
//   plan(meetingInfo, stream) → { guest, seat: "postlude", section, at, dur,
//        holdUntil, replaces: "postlude", piece, times, estimated, odds,
//        logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}], guests:
//       [{type, section}], material? (prepare()'s), force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the dance, ready to play (pure; itself
//     material): material = { hymns: [Hymn | {hymn, section}] | hymn,
//     keynoteHz, ward? (KOLOB.Cast's), phone? }
//   tune(hymn, piece, stream) → the dance tune: strains A and B (pure)
//   score(material, stream, t0) → the whole performance as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { onNote({layer, freq, t, dur, part, strain, bar, deg, monzo,
//              septimal, member}), onStage({stage, t0, t1, label}),
//              onCast({memberId, nameDs, action, t}), defer(at, fn) (the
//              engine's clock: each phrase laid out AHEAD s before it
//              sounds, a phrase a tick), dests: {fiddle, floor, caller} }
//   ODDS, NEVER, SEATS, NAME, LABEL, LEVEL, CALLS
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestSocialHall = (function () {
  "use strict";

  var NAME = "socialhall";
  var LABEL = "guest:socialhall:";                // + the meeting number

  // ==========================================================================
  // THE ODDS — rare, and where the colony would dance
  // ==========================================================================
  // p = base × weight[sunday, else kind], capped. Never at a funeral, never
  // on a fast Sunday (the fast is kept until the evening). The base is
  // conditional: the dance is refused when the postlude or the doxology
  // holds another guest — on Pioneer Day the bands cross the doxology often,
  // and that refusal halves the day's odds. The lab's odds card (20,000
  // meetings of a stand-in planner) measured 4.3 % of meetings at a base of
  // 0.05; at 0.07, about one meeting in sixteen, a fifth of Pioneer Days and
  // of weddings (the handoff has the table).
  var ODDS = {
    base: 0.07,
    weight: {
      ordinary: 1, conference: 0.5, jubilee: 2.4, fast: 0,
      // the calendar's Sundays (kolob-calendar.js), when the engine names them
      pioneer: 7, wedding: 5.5, christmas: 2.4, easter: 1.6, dedication: 1.2, funeral: 0,
    },
    cap: 0.6,
  };
  var NEVER = { fast: true, funeral: true };
  var SEATS = ["postlude"];
  var AT = [1.2, 3.2];                            // s into the postlude: the benediction's amen has died away
  // the stereo seats (the dance fills the room): the fiddler on a chair by
  // the wall, the caller beside him, the floor across the whole width
  var FIDDLE_PAN = -0.22, CALLER_PAN = 0.18;
  // THE LEVEL (the whole hall's bus), against the v0.30 organ reference as
  // the guests lab 3c measures it (the loudest 3 s, as seated): the owner
  // took the organ 2.3 dB and the trombones 4 dB down after hearing them (the
  // trombones ended about 2 LU under the reference), and the handbells sit
  // at −1.3 to +1.0; the dance is set to about −1.5 LU at its loudest (the
  // lab's first render, at 0.5, measured +1.8 LU). Round 3c's table in the
  // handoff has every number.
  var LEVEL = 0.36;

  function oddsFor(info) {
    // (round 3c: a meeting hands its odds in, info.odds, from the calendar's
    // one table — KOLOB.Calendar.GUEST_ODDS; a lab without it reads this
    // room's own, below)
    if (info && info.odds != null) return Math.max(0, Math.min(1, +info.odds));
    var w = ODDS.weight;
    var k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function barred(info) {
    return !!(NEVER[info.sunday] || NEVER[info.kind]);
  }
  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestSocialHall: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }

  // ==========================================================================
  // THE SHAPE — the arrangement's dice, all drawn, in order (plan() and
  // perform() draw the same, passing nothing between them)
  // ==========================================================================
  var PIECES = {
    //            meter   eighths a beat   the beat (s): its range
    reel:      { meter: "2/4", per: 2, beat: [0.46, 0.53] },
    jig:       { meter: "6/8", per: 3, beat: [0.5, 0.58] },
    quadrille: { meter: "6/8", per: 3, beat: [0.55, 0.62] },
  };
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      piece: r.pickW([["reel", 5], ["jig", 3], ["quadrille", 2]]),
      quadMeter: r.pickW([["6/8", 1], ["2/4", 1]]),   // a quadrille's figure: in six, or in two
      timesU: r.next(),            // two or three times through (the Sunday reads it)
      beatU: r.next(),             // the tempo, within the piece's range
      swing: r.rnd(1.03, 1.1),     // the reel's lilt: the first eighth of a pair a little long
      hymnU: r.next(),             // which of the meeting's hymns becomes the dance
      refrainB: r.chance(0.6),     // a refrain, where the hymn has one, is the B strain
      highB: r.chance(0.7),        // the B strain up an octave, when its lines lie under the A's
      droneA: r.rnd(0.5, 0.9),     // how often the bow leans on the drone: the A strain…
      droneB: r.rnd(0.25, 0.7),    // …and the B (it runs higher, and drones less)
      stops: r.rnd(0.25, 0.8),     // double stops on the long notes: sparing … generous
      blue: r.chance(0.7),         // the blue slide into the third
      tuneUp: r.chance(0.8),       // the fiddler tunes where we can hear it
      potatoes: r.pickW([["chop", 3], ["stomp", 2]]),
      callRate: r.rnd(0.55, 0.9),  // how many of the figures the caller calls
      whoops: r.rint(1, 3),
      clapFrom: r.pickW([[2, 3], [1, 1]]),   // the time through from which the floor claps
      dyn: r.rnd(0.62, 0.74),
      benches: r.rint(3, 5),
      tag: r.chance(0.75),         // the last phrase played again
      applause: r.chance(0.85),
    };
  }
  function pieceSpec(sh) {
    var P = PIECES[sh.piece];
    if (sh.piece === "quadrille" && sh.quadMeter === "2/4") P = { meter: "2/4", per: 2, beat: P.beat };
    return P;
  }
  var FESTIVE = { pioneer: true, wedding: true, jubilee: true, christmas: true, easter: true };
  function timesFor(sh, info) {
    var festive = FESTIVE[info && info.sunday] || FESTIVE[info && info.kind];
    return sh.timesU < (festive ? 0.5 : 0.25) ? 3 : 2;
  }
  function beatOf(sh) { var P = pieceSpec(sh); return P.beat[0] + (P.beat[1] - P.beat[0]) * sh.beatU; }
  // the intro's and the ending's lengths (s), the dance's in bars
  var INTRO = { benches: 4.4, tuning: 2.8, honour: 2.2 };
  var OUTRO = { final: 3.4, applause: 2.2 };
  function estimate(sh, info) {
    var bar = 2 * beatOf(sh), times = timesFor(sh, info);
    return INTRO.benches + (sh.tuneUp ? INTRO.tuning : 0) + INTRO.honour + 2 * bar + times * 32 * bar + (sh.tag ? 2 * bar : 0) + OUTRO.final + (sh.applause ? OUTRO.applause : 0);
  }

  // ==========================================================================
  // THE SEAT — the postlude, or nothing
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), atU = rs.next();                           // every die, first
    var sh = shapeOf(stream);
    var p = barred(info) ? 0 : oddsFor(info), why = null;
    var order = (info.sections || []).map(function (s) { return s && s.type; });
    var held = {};
    (info.guests || []).forEach(function (g) { if (g && g.section) held[g.section] = g.type || true; });
    var last = order.lastIndexOf("postlude"), before = last > 0 ? order[last - 1] : null;
    if (barred(info)) why = info.sunday === "funeral" || info.kind === "funeral" ? "never at a funeral" : "never on a fast Sunday";
    else if (last < 0) why = "no postlude";
    else if (held.postlude) why = "a guest holds the postlude (" + held.postlude + ")";
    else if (before && held[before]) why = "beside a guest (the " + held[before] + " in the " + before + ")";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var at = AT[0] + (AT[1] - AT[0]) * atU;
    var mat = info.material && info.material.prepared ? info.material : null;
    var dur = mat ? score(mat, stream, 0).end : estimate(sh, info);
    return {
      seat: {
        guest: NAME, seat: "postlude", section: "postlude", at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 2).toFixed(2),        // the postlude lasts at least this long
        replaces: "postlude", piece: mat ? mat.piece : sh.piece, times: mat ? mat.times : timesFor(sh, info),
        estimated: !mat, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // PITCH — the hymn's own lattice. A degree is the composer's (seven
  // letters, 0 the final, negative below); its monzo is exact, relative to
  // the hymn's key. The fiddle's added notes take the spelling the hymn
  // itself uses most for that letter (else the mode's parent scale).
  // ==========================================================================
  var PARENT_FR = {
    ionian:     ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "15/8"],
    mixolydian: ["1/1", "9/8", "5/4", "4/3", "3/2", "5/3", "16/9"],
    dorian:     ["1/1", "9/8", "6/5", "4/3", "3/2", "5/3", "16/9"],
    aeolian:    ["1/1", "9/8", "6/5", "4/3", "3/2", "8/5", "16/9"],
  };
  PARENT_FR.penta = PARENT_FR.hexa = PARENT_FR.ionian;
  var CLASSES = {
    ionian: [0, 1, 2, 3, 4, 5, 6], mixolydian: [0, 1, 2, 3, 4, 5, 6], dorian: [0, 1, 2, 3, 4, 5, 6],
    aeolian: [0, 1, 2, 3, 4, 5, 6], penta: [0, 1, 2, 4, 5], hexa: [0, 1, 2, 3, 4, 5],
  };
  var PRIMES = [2, 3, 5, 7];
  function mod(a, n) { return ((a % n) + n) % n; }
  function fromFraction(s) {
    var p = String(s).split("/"), m = [0, 0, 0, 0];
    [+p[0], -(+(p[1] || 1))].forEach(function (x, side) {
      var v = Math.abs(x), sg = side ? -1 : 1;
      PRIMES.forEach(function (q, i) { while (v % q === 0 && v > 1) { v /= q; m[i] += sg; } });
    });
    return m;
  }
  function mRatio(m) { m = m || [0, 0, 0, 0]; return Math.pow(2, m[0] || 0) * Math.pow(3, m[1] || 0) * Math.pow(5, m[2] || 0) * Math.pow(7, m[3] || 0); }
  function mAdd(a, b) { return [0, 1, 2, 3].map(function (i) { return (a[i] || 0) + (b[i] || 0); }); }
  function mOct(m, k) { return mAdd(m, [k, 0, 0, 0]); }
  function modeOf(h) { return PARENT_FR[h && h.mode] ? h.mode : "ionian"; }
  function num(x, d) { x = +x; return isFinite(x) && x > 0 ? x : d; }

  // ==========================================================================
  // READING THE HYMN (pure) — the melody part's notes line by line (ties
  // joined), each line's length, and the harmony sounding at each beat
  // (every part's notes: the fiddle's figures and double stops are the
  // hymn's own chord tones). A unison tune (the Old Way, the Shakers) has no
  // parts under it: the harmony is guessed as a fiddler would, the home
  // chord or the chord of its fifth, from the note.
  // ==========================================================================
  var PARTS = ["S", "A", "T", "B"];
  function lineLen(ln) {
    var K = window.KOLOB;
    if (K.Score && K.Score.lineLength) return K.Score.lineLength(ln);
    var end = 0;
    PARTS.forEach(function (p) { ((ln.notes && ln.notes[p]) || []).forEach(function (n) { end = Math.max(end, n.beat + n.beats); }); });
    return end;
  }
  function readLine(ln, P) {
    var src = (ln.notes && ln.notes[P]) || [], mel = [];
    for (var k = 0; k < src.length; k++) {
      var n = src[k];
      if (!n || n.monzo == null) continue;
      var b1 = n.beat + n.beats;
      while (src[k].tie && k + 1 < src.length && src[k + 1] && src[k + 1].monzo && mRatio(src[k + 1].monzo) === mRatio(n.monzo)) { k++; b1 = src[k].beat + src[k].beats; }
      mel.push({ beat: n.beat, beats: b1 - n.beat, d: n.deg, m: n.monzo.slice(0, 4), stress: n.stress != null ? n.stress : 1 });
    }
    var all = [];
    PARTS.forEach(function (p) { ((ln.notes && ln.notes[p]) || []).forEach(function (n) { if (n && n.monzo) all.push({ p: p, beat: n.beat, beats: n.beats, d: n.deg, m: n.monzo.slice(0, 4) }); }); });
    return { mel: mel, all: all, beats: lineLen(ln), chords: ln.chords || [], cadence: ln.cadence ? ln.cadence.kind : null };
  }
  // the spelling the hymn uses most for each letter (by class), an octave's
  // worth; the parent scale where the hymn never sounds the letter
  function spellings(lines, mode) {
    var count = {};
    lines.forEach(function (L) {
      L.all.forEach(function (n) {
        if (n.d == null) return;
        var c = mod(n.d, 7), m = mOct(n.m, -Math.floor(n.d / 7)), key = c + ":" + m.join(",");
        count[key] = (count[key] || 0) + (n.p === "S" || n.p === "T" ? 2 : 1);
      });
    });
    var tbl = PARENT_FR[mode].map(fromFraction);
    for (var c = 0; c < 7; c++) {
      var best = null, bw = 0;
      Object.keys(count).forEach(function (k) { if (+k.split(":")[0] === c && count[k] > bw) { bw = count[k]; best = k; } });
      if (best) tbl[c] = best.split(":")[1].split(",").map(Number);
    }
    return tbl;
  }

  // the classes sounding at a beat of the line (the hymn's own chord); for a
  // tune with no parts, the fiddler's guess from the note
  function chordAt(L, beat, mode) {
    var cls = {};
    L.all.forEach(function (n) { if (n.d != null && n.beat <= beat + 1e-6 && n.beat + n.beats > beat + 1e-6) cls[mod(n.d, 7)] = true; });
    var list = Object.keys(cls).map(Number);
    if (list.length >= 2) return list;
    var c = list.length ? list[0] : 0;
    var guess = [0, 2, 4].indexOf(c) >= 0 ? [0, 2, 4] : [4, 6, 1].indexOf(c) >= 0 ? [4, 6, 1] : [3, 5, 0];
    return guess.filter(function (x) { return CLASSES[mode].indexOf(x) >= 0; });
  }
  function inMode(mode, d) { return CLASSES[mode].indexOf(mod(d, 7)) >= 0; }
  // the next degree of the mode from d, up (dir 1) or down (−1)
  function stepOf(mode, d, dir) { var x = d + dir; while (!inMode(mode, x)) x += dir; return x; }
  // the nearest tone of the chord strictly above or below d
  function chordNear(mode, cls, d, dir) {
    for (var x = d + dir, i = 0; i < 9; i++, x += dir) if (cls.indexOf(mod(x, 7)) >= 0 && inMode(mode, x)) return x;
    return stepOf(mode, d, dir);
  }
  function sgn(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

  // ==========================================================================
  // A HYMN LINE, FITTED TO A DANCE LINE (pure). Four bars: six beats for the
  // line's notes, the seventh for its last note (the cadence, on the fourth
  // bar's downbeat), the eighth a pickup into whatever comes next. A beat
  // (a slot) holds one hymn note, or two (in a reel, two eighths; in a jig,
  // long–short), or none (the note before it, still sounding, figured).
  // The notes keep their order and, as nearly as fits, their place: each is
  // put where it fell in the hymn's own line. Where there are more notes
  // than six beats hold one, the ones closest together in the hymn share a
  // beat (the fewest, closest pairs: a small dynamic program); where there
  // are more than twelve, the weakest go (unstressed, short — melisma).
  // ==========================================================================
  function slotBody(body, span, nS) {
    var notes = body.slice();
    while (notes.length > 2 * nS) {
      var wi = 1, wv = Infinity;
      for (var i = 1; i < notes.length; i++) { var v = notes[i].stress * 2 + notes[i].beats; if (v < wv) { wv = v; wi = i; } }
      notes.splice(wi, 1);
    }
    var n = notes.length, P = Math.max(0, n - nS);
    // dp[i][k]: the least total gap pairing k disjoint neighbours among the first i notes
    var dp = [], how = [];
    for (var a = 0; a <= n; a++) { dp.push([]); how.push([]); for (var k = 0; k <= P; k++) { dp[a].push(Infinity); how[a].push(0); } }
    dp[0][0] = 0;
    for (var i2 = 1; i2 <= n; i2++) {
      for (var k2 = 0; k2 <= P; k2++) {
        dp[i2][k2] = dp[i2 - 1][k2]; how[i2][k2] = 1;
        if (k2 > 0 && i2 >= 2) {
          var c = dp[i2 - 2][k2 - 1] + (notes[i2 - 1].beat - notes[i2 - 2].beat);
          if (c < dp[i2][k2]) { dp[i2][k2] = c; how[i2][k2] = 2; }
        }
      }
    }
    var units = [], ii = n, kk = P;
    while (ii > 0) {
      if (how[ii][kk] === 2) { units.unshift([notes[ii - 2], notes[ii - 1]]); ii -= 2; kk--; }
      else { units.unshift([notes[ii - 1]]); ii--; }
    }
    var slots = [], prev = -1;
    for (var s = 0; s < nS; s++) slots.push([]);
    units.forEach(function (u, k3) {
      var want = Math.round(u[0].beat / Math.max(1e-6, span) * nS - 0.2);
      var at = Math.max(prev + 1, Math.min(nS - (units.length - k3), want));
      slots[at] = u; prev = at;
    });
    return slots;
  }

  // ==========================================================================
  // THE FIGURES (pure) — what the fiddle plays in one beat: `per` eighths
  // (two in a reel, three in a jig), the beat's hymn notes, where the tune
  // goes next, the chord sounding, and two dice drawn whether used or not.
  // An event: {d, n8 (eighths), kind: tune | fig | cad | pick, stress, m?
  // (the hymn's own monzo, for its own notes), cut?, tie?}
  // ==========================================================================
  function ev(d, n8, kind, stress, m) { var e = { d: d, n8: n8, kind: kind, stress: stress != null ? stress : 0.4 }; if (m) e.m = m; return e; }
  function pickW(u, pool) {
    var tot = 0, i;
    for (i = 0; i < pool.length; i++) tot += pool[i][1];
    var x = u * tot;
    for (i = 0; i < pool.length; i++) { x -= pool[i][1]; if (x < 0 && pool[i][1] > 0) return pool[i][0]; }
    for (i = pool.length - 1; i >= 0; i--) if (pool[i][1] > 0) return pool[i][0];
    return pool[0][0];
  }
  // run: how many eighths running have sounded the pitch `held` (a fourth
  // repeat is a tie, or a neighbour: a fiddler rocks, he does not saw)
  function figure(mode, cls, unit, held, nextD, per, u1, u2, run) {
    if (unit.length === 2) {
      return per === 2 ? [ev(unit[0].d, 1, "tune", unit[0].stress, unit[0].m), ev(unit[1].d, 1, "tune", unit[1].stress, unit[1].m)]
                       : [ev(unit[0].d, 2, "tune", unit[0].stress, unit[0].m), ev(unit[1].d, 1, "tune", unit[1].stress, unit[1].m)];
    }
    var a = unit.length ? unit[0].d : held, iv = nextD - a, s = sgn(iv) || 1;
    var toward = stepOf(mode, nextD, -s);
    if (toward === a) toward = stepOf(mode, nextD, s);          // (a step away already: the escape past it)
    // the beat's first eighth: the hymn's note — or, where the hymn holds a
    // note through this beat, the note tied on (a long note in a reel) or
    // bowed again with a cut
    var first = unit.length ? ev(a, 1, "tune", unit[0].stress, unit[0].m) : u2 < 0.45 || run >= 2 ? { tie: true, n8: 1, d: a } : ev(a, 1, "fig", 0.3);
    if (!unit.length && !first.tie) first.cut = true;
    if (per === 2) {
      // (a held note — the hymn's long one — is figured with more motion than
      // a note the hymn itself strikes: a long note is never four cuts running)
      var hold = !unit.length, cn = chordNear(mode, cls, a, s);
      if (Math.abs(cn - a) > 3) cn = stepOf(mode, a, s);                   // (never a leap wider than a fourth)
      var x = pickW(u1, [
        [stepOf(mode, a, s), Math.abs(iv) === 2 ? 5 : 0],                 // the passing note
        [toward, iv !== 0 ? 1.5 : 0],                                     // a step before the next
        [stepOf(mode, a, 1), iv === 0 ? (hold ? 3 : 2) : 0.5],            // the upper neighbour
        [stepOf(mode, a, -1), iv === 0 ? (hold ? 1.5 : 1) : 0.3],         // the lower
        ["again", hold ? (iv === 0 ? 1 : 0.6) : iv === 0 ? 3 : 1.5],      // the note again, with a cut
        [cn, Math.abs(iv) >= 3 ? 3 : Math.abs(iv) === 2 ? 1.5 : hold ? 2 : 1],   // the chord's next tone
      ]);
      if (x === "again" && (run >= 1 || !unit.length) && (unit.length ? 1 : run + 1) + 1 > 2) x = stepOf(mode, a, 1);
      var second = x === "again" ? ev(a, 1, "fig", 0.2) : ev(x, 1, "fig", 0.25);
      if (x === "again") second.cut = true;
      return [first, second];
    }
    var c1 = chordNear(mode, cls, a, s), c2 = chordNear(mode, cls, c1, s);
    if (Math.abs(c2 - a) > 5) { c1 = stepOf(mode, a, s); c2 = chordNear(mode, cls, c1, s); }
    var s1 = stepOf(mode, a, s), s2 = stepOf(mode, s1, s);
    var fig = pickW(u1, [
      ["lilt", 2.5],                                                      // long–short: the note held, a step into the next
      ["run", Math.abs(iv) === 3 ? 5 : 0],                                // two passing notes to a fourth
      ["turn", Math.abs(iv) === 2 ? 3 : 0],                               // away, then past, to a third
      ["nbr", iv === 0 ? 3 : Math.abs(iv) === 1 ? 1.5 : 0.3],             // the neighbour and back
      ["arp", Math.abs(nextD - c2) <= 2 ? 2 : 0.4],                       // the chord's tones
    ]);
    if (fig === "lilt") return first.tie ? [{ tie: true, n8: 2, d: a }, ev(toward, 1, "fig", 0.25)] : [(first.n8 = 2, first), ev(toward, 1, "fig", 0.25)];
    if (fig === "run") return [first, ev(s1, 1, "fig", 0.2), ev(s2, 1, "fig", 0.25)];
    if (fig === "turn") return [first, ev(stepOf(mode, a, -s), 1, "fig", 0.2), ev(s1, 1, "fig", 0.25)];
    if (fig === "nbr") return [first, ev(stepOf(mode, a, u2 < 0.7 ? 1 : -1), 1, "fig", 0.2), ev(a, 1, "fig", 0.25)];
    return [first, ev(c1, 1, "fig", 0.2), ev(c2, 1, "fig", 0.25)];
  }
  // the cadence: the line's last note, on the fourth bar's downbeat — held
  // the whole beat, or (now and then) bowed again with a cut
  function cadence(last, per, u) {
    var c = ev(last.d, per, "cad", 1, last.m);
    if (u < 0.3) { c.n8 = per - 1; var r = ev(last.d, 1, "cad", 0.3, last.m); r.cut = true; return [c, r]; }
    return [c];
  }
  // the pickup: a run of steps into the next note (the next line's first, the
  // strain's own first on its repeat, the next strain's) — or, at the very
  // end, nothing: the bow comes off
  function pickup(mode, c, target, per, u) {
    if (target == null) return [{ rest: true, n8: per }];
    var s = sgn(target - c) || (u < 0.5 ? 1 : -1);
    var z = stepOf(mode, target, -s), y = stepOf(mode, z, -s);
    if (per === 2) return u < 0.55 || y === c ? [ev(y, 1, "pick", 0.3), ev(z, 1, "pick", 0.35)] : [ev(c, 1, "pick", 0.3), ev(z, 1, "pick", 0.35)];
    return [ev(stepOf(mode, y, -s), 1, "pick", 0.3), ev(y, 1, "pick", 0.3), ev(z, 1, "pick", 0.35)];
  }

  // one line of the dance: six beats of the line's notes and their figures,
  // the cadence, and the pickup's die (the pickup itself is written when
  // the score knows what follows). Every die is drawn, beat by beat.
  function danceLine(L, mode, per, R) {
    var mel = L.mel, NS = 6;
    var last = mel[mel.length - 1], body = mel.slice(0, -1);
    var span = last.beat > 0 ? last.beat : Math.max(1, L.beats);
    var slots = slotBody(body, span, NS), beats = [];
    var held = body.length ? body[0].d : last.d;
    for (var k = 0; k < NS; k++) {
      var u1 = R.next(), u2 = R.next(), unit = slots[k];
      var nextD = last.d;
      for (var j = k + 1; j < NS; j++) if (slots[j].length) { nextD = slots[j][0].d; break; }
      var hymnBeat = unit.length ? unit[0].beat : span * k / NS;
      var run = 0;
      for (var q = beats.length - 1, stop = false; q >= 0 && !stop; q--) for (var q2 = beats[q].length - 1; q2 >= 0; q2--) { var e0 = beats[q][q2]; if (e0.tie) continue; if (e0.d === held) run++; else { stop = true; break; } }
      var cls = chordAt(L, hymnBeat, mode);
      var evs = figure(mode, cls, unit, held, nextD, per, u1, u2, run);
      evs.forEach(function (e) { e.hb = hymnBeat; e.cls = cls; });
      beats.push(evs);
      held = evs[evs.length - 1].d;
    }
    var cad = cadence(last, per, R.next());
    var cadCls = chordAt(L, last.beat, mode);
    cad.forEach(function (e) { e.hb = last.beat; e.cls = cadCls; });
    beats.push(cad);
    return {
      beats: beats, firstD: mel[0].d, firstM: mel[0].m, cadD: last.d, cadM: last.m, pickU: R.next(),
      cadence: L.cadence, cadCls: cadCls, hymnNotes: mel.length, kept: slots.reduce(function (a, s) { return a + s.length; }, 0) + 1,
    };
  }

  // ==========================================================================
  // THE TUNE (pure) — a hymn turned into a dance: strains A and B, two lines
  // each (eight bars). A is the hymn's first two lines; B its refrain (when
  // it has one, and the shape says so) or its last two — or, a short hymn,
  // what it has. The melody's notes are the hymn's; every added note takes
  // the hymn's own spelling of its letter.
  // ==========================================================================
  function tune(h, pieceName, stream, opts) {
    opts = opts || {};
    var R = need(stream).fork("tune");
    var mode = modeOf(h), P = h.melodyPart || "S";
    var per = opts.per || (PIECES[pieceName] || PIECES.reel).per;
    var lines = (h.lines || []).map(function (ln) { return readLine(ln, P); }).filter(function (L) { return L.mel.length; });
    var refr = (h.refrain || []).map(function (ln) { return readLine(ln, P); }).filter(function (L) { return L.mel.length; });
    if (!lines.length) throw new Error("KOLOB.GuestSocialHall: the hymn has no tune to dance to");
    var tbl = spellings(lines.concat(refr), mode);
    var fromRefrain = !!(opts.refrainB && refr.length);
    var srcA = [lines[0], lines[1] || lines[0]];
    var srcB = fromRefrain ? [refr[0], refr[1] || refr[0]]
      : lines.length >= 4 ? [lines[lines.length - 2], lines[lines.length - 1]]
      : lines.length === 3 ? [lines[2], lines[1]] : [lines[lines.length - 1], lines[0]];
    var A = srcA.map(function (L) { return danceLine(L, mode, per, R); });
    var B = srcB.map(function (L) { return danceLine(L, mode, per, R); });
    // every event its exact pitch: the hymn's own notes keep theirs
    [A, B].forEach(function (S) {
      S.forEach(function (ln) { ln.beats.forEach(function (bt) { bt.forEach(function (e) { if (!e.rest && !e.m) e.m = mOct(tbl[mod(e.d, 7)], Math.floor(e.d / 7)); }); }); });
    });
    return {
      mode: mode, per: per, table: tbl, melodyPart: P, A: A, B: B, fromRefrain: fromRefrain,
      source: { lines: lines.length, refrain: refr.length, B: fromRefrain ? "the refrain" : lines.length >= 4 ? "its last two lines" : "what it has" },
    };
  }

  // ==========================================================================
  // THE PEOPLE (pure) — from the Sunday's ward, when the engine hands it
  // (KOLOB.Cast's): the CALLER is the enthusiast if the Sunday seated him
  // (too loud, a little sharp, joyful: born to call a dance), else the
  // surest man in the pews; the FIDDLER the old bass if he is there (the
  // patriarch fiddled on the trail), else one of the ward; three of the
  // young whoop. Without a ward, voices of no one in particular.
  // ==========================================================================
  function peopleOf(ward, stream) {
    var r = need(stream).fork("people");
    var callerU = r.next(), fidU = r.next(), wU = [r.next(), r.next(), r.next()];      // every die, first
    var anon = { caller: { id: null, nameDs: null, voice: { part: "T", age: "mid", confidence: 0.95, brightness: 0.6, breath: 0.3 } },
                 fiddler: { id: null, nameDs: null }, whoopers: [{ id: null, voice: { part: "S", age: "young", confidence: 0.9, brightness: 0.7 } }, { id: null, voice: { part: "T", age: "young", confidence: 0.9 } }] };
    if (!ward || !ward.members || !ward.byId) return anon;
    var pews = ward.members.filter(function (m) { return m.k != null && m.voice; });
    var roles = ward.roles || {};
    var caller = roles.enthusiast ? ward.byId[roles.enthusiast] : null;
    if (!caller || !caller.voice) {
      var men = pews.filter(function (m) { return m.part === "T" || m.part === "B"; });
      men.sort(function (a, b) { return (b.voice.confidence || 0) - (a.voice.confidence || 0) || (a.id < b.id ? -1 : 1); });
      men = men.slice(0, 4);
      caller = men.length ? men[Math.floor(callerU * men.length)] : null;
    }
    var fiddler = roles.oldbass ? ward.byId[roles.oldbass] : null;
    if (!fiddler || fiddler === caller) {
      var cand = pews.filter(function (m) { return m !== caller; });
      fiddler = cand.length ? cand[Math.floor(fidU * cand.length)] : null;
    }
    var young = pews.filter(function (m) { return m !== caller && m !== fiddler && m.voice.age === "young"; });
    if (young.length < 2) young = pews.filter(function (m) { return m !== caller && m !== fiddler; });
    var whoopers = [];
    wU.forEach(function (u) {
      var left = young.filter(function (m) { return whoopers.indexOf(m) < 0; });
      if (left.length) whoopers.push(left[Math.floor(u * left.length)]);
    });
    function who(m) { return m ? { id: m.id, nameDs: m.nameDs, nameEn: m.nameEn, part: m.part, voice: m.voice, role: m.role || null } : null; }
    return { caller: who(caller) || anon.caller, fiddler: who(fiddler) || anon.fiddler, whoopers: whoopers.length ? whoopers.map(who) : anon.whoopers };
  }

  // ==========================================================================
  // PREPARE (pure) — which of the meeting's hymns becomes the dance, the
  // dance itself, and the people. material = { hymns: [Hymn | {hymn,
  // section}] | hymn, keynoteHz, ward?, sunday?, kind?, phone? }. The hymn
  // the ward has just sung (the doxology: the last on offer) likeliest; the
  // day's first next; the rest after.
  // ==========================================================================
  function prepare(material, stream) {
    if (material && material.prepared) return material;
    var M = material || {}, sh = shapeOf(stream);
    var K = num(M.keynoteHz, 260);
    var offers = (M.hymns || (M.hymn ? [M.hymn] : [])).map(function (x) { return x && x.lines ? { hymn: x, section: null } : x; })
      .filter(function (x) { return x && x.hymn && x.hymn.lines && x.hymn.lines.length; });
    var composed = false;
    if (!offers.length && window.KOLOB.Composer && window.PJ2) {
      // no hymn handed over (a lab, a page without the hymnal): a hymn of the
      // colony's, written here on the guest's own stream (pure)
      offers = [{ hymn: window.KOLOB.Composer.compose(need(stream).fork("material").fork("hymn"), { dialect: "tabernacle" }), section: null }];
      composed = true;
    }
    if (!offers.length) throw new Error("KOLOB.GuestSocialHall: no hymn to dance to");
    var W = offers.map(function (o, i) { return o.section === "doxology" || (o.section == null && i === offers.length - 1) ? 5 : i === 0 ? 3 : 2; });
    var pick = offers[0], tot = W.reduce(function (a, b) { return a + b; }, 0), u = sh.hymnU * tot;
    for (var i = 0; i < offers.length; i++) { u -= W[i]; if (u < 0) { pick = offers[i]; break; } }
    // (a dev may name the dance and how many times through: the lab's menus;
    // the dice are drawn all the same)
    if (M.piece && PIECES[M.piece]) { var sh2 = {}; for (var x in sh) sh2[x] = sh[x]; sh2.piece = M.piece; sh = sh2; }
    var h = pick.hymn, P = pieceSpec(sh);
    var T = tune(h, sh.piece, stream, { per: P.per, refrainB: sh.refrainB });
    return {
      prepared: true, piece: sh.piece, meter: P.meter, per: P.per, beat: beatOf(sh), times: M.times === 2 || M.times === 3 ? M.times : timesFor(sh, M),
      swing: P.per === 2 ? (sh.piece === "quadrille" ? 1 + (sh.swing - 1) * 0.5 : sh.swing) : 1,
      tune: T, keynoteHz: K, finalHz: K * mRatio(h.keyMonzo), mode: T.mode,
      hymnId: h.id || null, hymnName: h.nameEn || null, hymnDs: h.nameDs || null, dialect: h.dialect || null, section: pick.section || null,
      people: peopleOf(M.ward, stream), phone: !!M.phone, sunday: M.sunday || null, kind: M.kind || null,
      source: (composed ? "a hymn composed for the dance" : pick.section === "doxology" ? "the doxology's hymn" : pick.section === "hymn" ? "a hymn of the day" : pick.section ? "the " + pick.section + "'s hymn" : "the day's hymn") + (h.nameEn ? " (" + h.nameEn + ", " + (h.dialect || "?") + ")" : "") + ", B from " + T.source.B,
    };
  }

  // ==========================================================================
  // THE CALLS — each figure's call as a dancer hears it before the words:
  // its vowels, its stresses, its rhythm (in half-beats), and whether its
  // last syllable lifts or falls. [syllable, half-beats, stress]; every
  // syllable one the voice speaks (kolob-voices-vocal.js SPOKEN): vowels,
  // and the soft m and l — the call's shape, never its English.
  // ==========================================================================
  var CALLS = {
    honour:    { en: "honour your partners",  end: "fall", syl: [["ah", 2, 1], ["meh", 1, 0.3], ["moo", 1, 0.3], ["ah", 2, 1], ["meh", 2, 0.4]] },
    swing:     { en: "swing your partner",    end: "fall", syl: [["ee", 2, 1], ["loo", 1, 0.3], ["ah", 2, 1], ["meh", 3, 0.4]] },
    promenade: { en: "promenade",             end: "lift", syl: [["ah", 2, 1], ["meh", 1, 0.3], ["ah", 5, 1]] },
    dosido:    { en: "do-si-do",              end: "lift", syl: [["oh", 2, 1], ["lee", 2, 0.4], ["oh", 4, 1]] },
    allemande: { en: "allemande left",        end: "fall", syl: [["ah", 2, 1], ["leh", 1, 0.3], ["ma", 2, 0.6], ["leh", 3, 1]] },
    balance:   { en: "balance all",           end: "lift", syl: [["ah", 2, 1], ["leh", 1, 0.3], ["ah", 1, 0.4], ["ah", 4, 1]] },
    grand:     { en: "grand right and left",  end: "fall", syl: [["ah", 2, 1], ["ee", 2, 0.8], ["meh", 1, 0.3], ["leh", 3, 1]] },
    chain:     { en: "ladies' chain",         end: "lift", syl: [["eh", 2, 1], ["lee", 1, 0.3], ["eh", 5, 1]] },
    circle:    { en: "circle left",           end: "fall", syl: [["eh", 2, 1], ["loo", 1, 0.3], ["leh", 5, 1]] },
    home:      { en: "all the way home",      end: "lift", syl: [["ah", 2, 0.6], ["meh", 1, 0.3], ["eh", 2, 1], ["oh", 4, 1]] },
  };
  var FIGURES = ["swing", "promenade", "dosido", "allemande", "balance", "grand", "chain", "circle"];

  // ==========================================================================
  // THE SCORE (pure) — the whole evening as data, seconds from t0
  // ==========================================================================
  //   fiddle: [{t, stage, notes (VoicesFolk.fiddle's, `at` from t), drone,
  //            droneLevel, dyn, report: [onNote rows]}]
  //   floor:  [{t, kind: step | light | heavy | stamp, v, pan}]
  //   claps:  [{t, v, pan, kind: clap | applause}]
  //   calls:  [{t, call, who: caller | whoop, notes (VoicesVocal's), pan}]
  //   scrapes:[{t, dur, pan, v, variant}]
  //   stages, cast, end (the last sound), until (the last ring)
  var TOP = 1100;
  function registers(M) {
    var T = M.tune;
    function ratios(S) { var rs = []; S.forEach(function (ln) { ln.beats.forEach(function (bt) { bt.forEach(function (e) { if (!e.rest && !e.tie) rs.push(mRatio(e.m)); }); }); }); rs.sort(function (a, b) { return a - b; }); return rs; }
    var ra = ratios(T.A), rb = ratios(T.B), F = M.finalHz;
    // (the old-time fiddler's first position: G3 to about C6 — TOP)
    var octA = Math.round(Math.log(520 / (F * ra[ra.length >> 1])) / Math.LN2);
    while (F * ra[0] * Math.pow(2, octA) < 190 && F * ra[ra.length - 1] * Math.pow(2, octA + 1) <= TOP) octA++;
    while (F * ra[ra.length - 1] * Math.pow(2, octA) > TOP && F * ra[0] * Math.pow(2, octA - 1) >= 190) octA--;
    var octB = Math.round(Math.log(520 / (F * rb[rb.length >> 1])) / Math.LN2);
    // THE HIGH PART: a B strain whose lines lie no higher than the A's goes up
    // an octave, as a fiddle tune's second strain so often does
    if (M.highB !== false && rb[rb.length >> 1] * Math.pow(2, octB) <= ra[ra.length >> 1] * Math.pow(2, octA) * 1.12 && F * rb[rb.length - 1] * Math.pow(2, octB + 1) <= TOP) octB++;
    while (F * rb[0] * Math.pow(2, octB) < 190 && F * rb[rb.length - 1] * Math.pow(2, octB + 1) <= TOP) octB++;
    while (F * rb[rb.length - 1] * Math.pow(2, octB) > TOP && F * rb[0] * Math.pow(2, octB - 1) >= 190) octB--;
    // THE DRONE: the tune's tonic, cross-tuned onto an open string, 175–350 Hz
    var drone = F; while (drone < 175) drone *= 2; while (drone >= 350) drone /= 2;
    return { A: octA, B: octB, drone: drone };
  }
  function score(material, stream, t0) {
    var M = material && material.prepared ? material : prepare(material, stream);
    var sh = shapeOf(stream);                                   // the same dice as the plan's
    var T = M.tune, per = M.per, beat = M.beat, e8 = beat / per, bar = 2 * beat;
    t0 = t0 || 0;
    var reg = registers({ tune: T, finalHz: M.finalHz, highB: sh.highB }), dr = reg.drone;
    var arr = need(stream).fork("arrange"), room = need(stream).fork("room");   // the arrangement's own dice; the room's (sound-level) scatter
    var out = { fiddle: [], floor: [], claps: [], calls: [], scrapes: [], stages: [], cast: [], notes: [] };
    function stage(name, a, b, label) { out.stages.push({ stage: name, t0: t0 + a, t1: t0 + b, label: label }); }
    var t = 0, ppl = M.people || {};
    // THE BENCHES pushed back to the walls, across the room, and the feet
    for (var b = 0; b < sh.benches; b++) out.scrapes.push({ t: t0 + 0.2 + b * (3.3 / sh.benches) + room.rnd(0, 0.3), dur: room.rnd(0.45, 0.85), pan: room.rnd(-0.85, 0.85), v: room.rnd(0.6, 1), variant: room.rint(0, 2) });
    for (var s0 = 0; s0 < 9; s0++) out.floor.push({ t: t0 + 0.3 + room.rnd(0, 3.8), kind: "step", v: room.rnd(0.35, 0.6), pan: room.rnd(-0.8, 0.8) });
    stage("benches", 0, INTRO.benches, "the benches pushed back");
    t = INTRO.benches;
    if (ppl.fiddler && ppl.fiddler.id) out.cast.push({ memberId: ppl.fiddler.id, nameDs: ppl.fiddler.nameDs, action: "takes up the fiddle", t: t0 + t - 0.5 });
    // THE FIDDLER TUNES: the two low strings together, the upper a little
    // flat and pulled up in small steps until the fifth stands pure (you
    // hear its beating slow, and stop); then the next pair
    if (sh.tuneUp) {
      var tf = dr * 3 / 2, flat = room.rnd(18, 30), tn = [];
      [1, 0.62, 0.3, 0.1, 0].forEach(function (x, i) { tn.push({ f: tf * Math.pow(2, -flat * x / 1200), dur: i === 4 ? 0.55 : 0.17, at: i ? 0.33 + (i - 1) * 0.17 : 0, slur: i > 0, also: [dr], v: 0.75 }); });
      tn[0].dur = 0.33;
      tn.push({ f: 0, dur: 0.3, at: 1.39 }, { f: tf * 3 / 2, dur: 0.9, at: 1.69, also: [tf], v: 0.7 });
      out.fiddle.push({ t: t0 + t, stage: "tuning", notes: tn, drone: [], dyn: 0.5, report: [] });
      stage("tuning", t, t + INTRO.tuning, "the fiddler tunes");
      t += INTRO.tuning;
    }
    // THE CALLER: honour your partners
    var tHon = t;
    stage("honour", t, t + INTRO.honour, "the caller: honour your partners");
    t += INTRO.honour;
    // THE POTATOES: two bars of the home chord chopped on the open strings
    // (or the fiddler's foot, four times), so the floor finds the tempo
    var tPot = t;
    if (sh.potatoes === "chop") {
      var pn = [], q8 = 0;
      for (var pb = 0; pb < 2; pb++) (per === 2 ? [2, 1, 1] : [2, 1, 2, 1]).forEach(function (n8, i) {
        pn.push({ f: dr * 3 / 2, also: [dr], dur: n8 * e8 * 0.92, at: q8 * e8, acc: i === 0, v: i === 0 ? 0.9 : 0.7 }); pn.push({ f: 0, dur: n8 * e8 * 0.08, at: (q8 + n8 * 0.92) * e8 }); q8 += n8;
      });
      out.fiddle.push({ t: t0 + t, stage: "potatoes", notes: pn, drone: [], dyn: sh.dyn, report: [] });
    } else for (var ps = 0; ps < 4; ps++) out.floor.push({ t: t0 + t + ps * beat, kind: "step", v: 0.85, pan: FIDDLE_PAN });
    stage("potatoes", t, t + 2 * bar, sh.potatoes === "chop" ? "the potatoes: the fiddle chops the home chord" : "the fiddler's foot, four times");
    t += 2 * bar;

    // THE DANCE: AABB, two or three times through. Each played line is one
    // bowed phrase of four bars, the pickup into what follows inside it.
    var tbl = T.table, mode = T.mode, dAmt = { A: sh.droneA, B: sh.droneB };
    function mOf(d) { return mOct(tbl[mod(d, 7)], Math.floor(d / 7)); }
    function fOf(m, oct) { return M.finalHz * mRatio(m) * Math.pow(2, oct); }
    function red(r) { while (r >= 2 - 1e-12) r /= 2; while (r < 1 - 1e-12) r *= 2; return r; }
    // the eighth q of a line, in seconds from its start (a reel's pairs lilt)
    function tq(q) { var bi = Math.floor(q / per), w = q - bi * per; return bi * beat + (per === 2 ? (w ? e8 * M.swing : 0) : w * e8); }
    function phrase(p, evs, tl) {
      var notes = [], report = [], q = 0, prev = null, prevRep = null, lastTime = p.time === M.times;
      var dyn = Math.min(0.86, sh.dyn + (p.strain === "B" ? 0.05 : 0) + (lastTime ? 0.04 : 0)), dA = dAmt[p.strain], ln = p.ln;
      evs.forEach(function (e) {
        var at = tq(q), dur = tq(q + e.n8) - at;
        if (e.tie && prev) { prev.dur += dur; if (prevRep) prevRep.dur += dur; q += e.n8; return; }
        if (e.rest || e.tie) { notes.push({ f: 0, dur: dur, at: at }); prev = prevRep = null; q += e.n8; return; }
        var f = fOf(e.m, p.oct), long = e.n8 >= 2, main = e.kind === "tune" || e.kind === "cad", i8 = q % (2 * per), r = red(mRatio(e.m));
        var nt = { f: f, dur: dur, at: at, v: e.kind === "cad" ? 1.05 : main && e.stress >= 1 ? 1 : e.kind === "pick" ? 0.9 : 0.86 };
        // the bowing: a reel's shuffle (the bar's first two eighths in one bow,
        // the back-beat dug in); a jig's long–short in one bow, the bar's start leaned on
        if ((per === 2 ? i8 % 4 === 1 : i8 % 3 === 1) && prev && !e.cut) nt.slur = true;
        if (per === 2 ? i8 % 4 === 2 : i8 === 0) nt.acc = true;
        if (e.cut) nt.orn = "cut";
        var u = arr.next(), u2 = arr.next(), u3 = arr.next(), sept = false, also = null, alsoM = null;
        // THE BLUE SLIDE: the tune's major third, long and strong, reached from
        // the septimal minor third under it (7/6 → 5/4)
        if (sh.blue && long && main && Math.abs(r - 1.25) < 1e-9 && u < 0.65) { nt.orn = "slide"; nt.from = f * 14 / 15; sept = true; }
        else if (long && main && u < 0.2) nt.orn = "slide";
        // DOUBLE STOPS: the dominant's harmonic seventh over sol at a half
        // cadence (4:7); else the hymn's own chord tone a third to a sixth under
        if (e.kind === "cad" && ln.cadence === "half" && Math.abs(r - 1.5) < 1e-9 && u2 < 0.7) { also = f * 7 / 4; alsoM = mAdd(e.m, [-2, 0, 0, 1]); sept = true; }
        else if ((e.kind === "cad" && u2 < 0.8) || (long && main && u2 < sh.stops)) {
          var cls = e.cls || [0, 2, 4], d2 = chordNear(mode, cls, e.d, -1);
          if (e.d - d2 < 2) d2 = chordNear(mode, cls, d2, -1);
          var f2 = fOf(mOf(d2), p.oct);
          if (e.d - d2 <= 5 && f2 >= 190) { also = f2; alsoM = mOf(d2); }
        }
        if (also) nt.also = [also];
        // THE DRONE: leaned on under the long notes and the strong ones, lifted through the runs
        nt.droneV = long || e.kind === "cad" || (main && e.stress >= 1 && i8 === 0) ? (u3 < dA ? 1 : 0.55) : (u3 < dA * 0.4 ? 0.6 : 0);
        notes.push(nt); prev = nt;
        prevRep = { layer: "fiddle", freq: f, t: tl + at, dur: dur, part: e.kind, strain: p.strain, time: p.time, line: p.li, bar: Math.floor(q / (2 * per)) + 1, deg: e.d, monzo: e.m, septimal: sept, orn: nt.orn || null, hymnId: M.hymnId };
        report.push(prevRep);
        if (also) report.push({ layer: "fiddle", freq: also, t: tl + at, dur: dur, part: "stop", strain: p.strain, time: p.time, line: p.li, monzo: alsoM, septimal: !!alsoM && alsoM[3] !== 0, hymnId: M.hymnId });
        q += e.n8;
      });
      report.push({ layer: "fiddle", freq: dr, t: tl, dur: tq(q), part: "drone", strain: p.strain, time: p.time, line: p.li, hymnId: M.hymnId });
      return { t: t0 + tl, stage: p.strain, notes: notes, drone: [dr], droneLevel: 0.36, dyn: dyn, report: report, strain: p.strain, time: p.time, line: p.li };
    }
    var played = [];
    for (var k = 1; k <= M.times; k++) ["A", "A", "B", "B"].forEach(function (S, i) {
      T[S].forEach(function (ln, li) { played.push({ strain: S, time: k, rep: i % 2, li: li, ln: ln, oct: S === "A" ? reg.A : reg.B }); });
    });
    var tDance = t, lastI = played.length - 1, lineStarts = [];
    played.forEach(function (p, pi) {
      var nx = pi < lastI ? played[pi + 1] : null, ln = p.ln;
      // the pickup leads into the next line's first note (in its own register),
      // the tag's first (the last line's third bar), or nothing
      var target = nx ? nx.ln.firstD + 7 * (nx.oct - p.oct) : sh.tag ? ln.beats[4][0].d : null;
      var evs = [];
      ln.beats.forEach(function (bt, k2) { bt.forEach(function (e) { var c = {}; for (var x in e) c[x] = e[x]; c.slot = k2; evs.push(c); }); });
      pickup(mode, ln.cadD, target, per, ln.pickU).forEach(function (e) { e.slot = 7; if (!e.rest) e.m = mOf(e.d); evs.push(e); });
      lineStarts.push(t);
      out.fiddle.push(phrase(p, evs, t));
      if (p.li === 0) stage(p.strain, t, t + 8 * bar, "the " + p.strain + " strain" + (p.rep ? " again" : "") + (M.times > 1 ? " (" + ["", "first", "second", "third"][p.time] + " time through)" : ""));
      t += 4 * bar;
    });

    // THE TAG: the last line's third bar played again, and THE FINAL on the
    // next downbeat — the octave of the drone's tonic with its harmonic
    // seventh (4:7:8, the ring), then with its fifth (2:3:4), the bow lifted
    var lastLn = played[lastI].ln, tFinal;
    if (sh.tag) {
      var tagEvs = [];
      [4, 5].forEach(function (k2) { lastLn.beats[k2].forEach(function (e) { var c = {}; for (var x in e) c[x] = e[x]; tagEvs.push(c); }); });
      // (a tag that begins on a held note has nothing before it to tie to:
      // the note is bowed afresh)
      if (tagEvs[0].tie) { tagEvs[0] = ev(tagEvs[0].d, tagEvs[0].n8, "fig", 0.5, mOf(tagEvs[0].d)); }
      var tp = phrase(played[lastI], tagEvs, t); tp.stage = "tag"; tp.tag = true;
      out.fiddle.push(tp);
      stage("tag", t, t + bar, "the last phrase again");
      t += bar;
    }
    tFinal = t;
    var fin = [{ f: dr * 2, dur: 1.25, at: 0, also: [dr * 7 / 4], acc: true, v: 1.05, droneV: 1 },
               { f: dr * 2, dur: 1.65, at: 1.25, also: [dr * 3 / 2], slur: true, v: 0.92, droneV: 1 }];
    var finRep = [{ layer: "fiddle", freq: dr * 2, t: t0 + t, dur: 2.9, part: "final", septimal: false, hymnId: M.hymnId },
                  { layer: "fiddle", freq: dr * 7 / 4, t: t0 + t, dur: 1.25, part: "stop", septimal: true, hymnId: M.hymnId },
                  { layer: "fiddle", freq: dr * 3 / 2, t: t0 + t + 1.25, dur: 1.65, part: "stop", septimal: false, hymnId: M.hymnId },
                  { layer: "fiddle", freq: dr, t: t0 + t, dur: 2.9, part: "drone", hymnId: M.hymnId }];
    out.fiddle.push({ t: t0 + t, stage: "final", notes: fin, drone: [dr], droneLevel: 0.4, dyn: Math.min(0.86, sh.dyn + 0.08), report: finRep });
    stage("final", t, t + OUTRO.final, "the final: the tonic's seventh, then its fifth");
    // THE FLOOR: every beat of the dance, the bar's first the heaviest; the
    // hands on the back-beat once the dance is going (the B strains, and all
    // of the last time through); a stamp to end the last B, and the final
    var clapsFrom = Math.min(sh.clapFrom, M.times);
    played.forEach(function (p, pi) {
      var ls = lineStarts[pi], lastLine = pi === lastI;
      for (var bt = 0; bt < 8; bt++) {
        var tb = ls + bt * beat, down = bt % 2 === 0, stampIt = lastLine && bt >= 6;
        out.floor.push({ t: t0 + tb, kind: stampIt ? "stamp" : down ? "heavy" : "light", v: room.rnd(0.8, 1) * (p.time === M.times ? 1.08 : 1), pan: room.rnd(-0.5, 0.5) });
        var clapping = p.time > clapsFrom || (p.time === clapsFrom && (p.strain === "B" || p.time === M.times));
        if (!down && clapping) out.claps.push({ t: t0 + tb, v: room.rnd(0.8, 1), pan: room.rnd(-0.4, 0.4), kind: "clap" });
      }
    });
    if (sh.tag) for (var tb2 = 0; tb2 < 2; tb2++) out.floor.push({ t: t0 + tFinal - bar + tb2 * beat, kind: tb2 ? "light" : "heavy", v: 1, pan: room.rnd(-0.5, 0.5) });
    out.floor.push({ t: t0 + tFinal, kind: "stamp", v: 1.15, pan: 0 });
    // THE CALLS: honour your partners, before the potatoes; then a call ending
    // on the downbeat of each strain as the figure changes (not every one);
    // the last, "all the way home"
    var callR = need(stream).fork("calls"), lastCall = null, strainStarts = [];
    played.forEach(function (p, pi) { if (p.li === 0 && pi > 0) strainStarts.push({ t: lineStarts[pi], last: pi === lastI - 1 }); });
    out.calls.push(callLine("honour", tHon + 0.15, true));
    out.cast.push({ memberId: ppl.caller && ppl.caller.id, nameDs: ppl.caller && ppl.caller.nameDs, action: "calls the dance", t: t0 + tHon });
    strainStarts.forEach(function (ss) {
      var u = callR.next(), w = callR.next();
      if (!(u < sh.callRate || ss.last)) return;
      var names = FIGURES.filter(function (n) { return n !== lastCall; }), name = ss.last ? "home" : names[Math.floor(w * names.length)];
      lastCall = name;
      out.calls.push(callLine(name, ss.t, false));
    });
    // a dancer's whoop (the last time through, as it starts and as its B
    // strain starts; at the end), and the caller's shout over the final
    var wAt = [lineStarts[played.length - 8], lineStarts[played.length - 4], tFinal + 0.45];
    for (var wi = 0; wi < sh.whoops; wi++) out.calls.push(whoop(wAt[wi] + 0.05, (ppl.whoopers || [])[wi % Math.max(1, (ppl.whoopers || []).length)], wi));
    out.calls.push(shout(tFinal + 0.2));
    if (sh.applause) {
      out.claps.push({ t: t0 + tFinal + 1.5, v: 1, pan: 0, kind: "applause", dur: OUTRO.applause });
      stage("applause", tFinal + 1.5, tFinal + 1.5 + OUTRO.applause, "applause");
    }
    // (the voices: the caller chants on the tune's fifth, a stressed syllable
    // a step up on its sixth — both as the hymn spells them — in his own
    // register; a call is half-sung, so a little vibrato; a whoop is free)
    function callPitch() {
      var who = ppl.caller || {}, part = (who.voice && who.voice.part) || who.part || "T";
      var mid = { S: 349, A: 262, T: 196, B: 147, child: 440 }[part] || 196;
      var sol = M.finalHz * mRatio(mOf(4)), la = M.finalHz * mRatio(mOf(5)), k = Math.round(Math.log(mid / sol) / Math.LN2);
      return { sol: sol * Math.pow(2, k), la: la * Math.pow(2, k) };
    }
    function voiceOf(who, over) {
      var v = {}, src = (who && who.voice) || { part: "T", age: "mid" };
      for (var x in src) v[x] = src[x];
      for (var y in over) v[y] = over[y];
      return v;
    }
    function tell(c) {
      var tt = c.t;
      c.report = c.notes.map(function (n) { var r = { layer: "choir", freq: n.f, t: tt, dur: n.dur, part: c.who, member: c.member || null, call: c.call, hymnId: null }; tt += n.dur; out.notes.push(r); return r; });
      return c;
    }
    function callLine(name, at, fromStart) {
      var C = CALLS[name], half = beat / 2, P = callPitch(), pre = 0;
      C.syl.forEach(function (sy, i) { if (i < C.syl.length - 1) pre += sy[1]; });
      var notes = C.syl.map(function (sy, i) {
        var lastS = i === C.syl.length - 1;
        return { f: sy[2] >= 1 && !lastS ? P.la : P.sol, dur: sy[1] * half * (lastS ? 1.1 : 1), vowel: sy[0], stress: sy[2],
                 glide: lastS ? (C.end === "lift" ? [[0, 1], [0.35, 1], [1, 1.12]] : [[0, 1.02], [1, 0.84]]) : [[0, 1], [1, 0.985]] };
      });
      return tell({ t: t0 + (fromStart ? at : at - pre * half), call: name, en: C.en, who: "caller", member: ppl.caller && ppl.caller.id, pan: CALLER_PAN, level: 1.15,
                    voice: voiceOf(ppl.caller, { vibrato: { rate: 5.2, depth: 9, onsetDelay: 0.22 }, confidence: 0.96, breath: 0.3 }), notes: notes });
    }
    function whoop(at, who, i) {
      var part = (who && who.voice && who.voice.part) || "S", base = part === "S" || part === "A" ? 440 : 262;
      return tell({ t: t0 + at, call: "whoop", who: "whoop", member: who && who.id, pan: [0.45, -0.5, 0.2][i % 3], level: 0.8,
                    voice: voiceOf(who, { vibrato: { depth: 0 }, confidence: 0.9 }),
                    notes: [{ f: base, dur: 0.1, vowel: "ee", stress: 0.6, glide: [[0, 1], [1, 1.15]] }, { f: base, dur: 0.46, vowel: "oo", stress: 1, glide: [[0, 1.28], [0.3, 1.55], [1, 1.15]] }] });
    }
    function shout(at) {
      var P = callPitch();
      return tell({ t: t0 + at, call: "hoo", who: "caller", member: ppl.caller && ppl.caller.id, pan: CALLER_PAN, level: 1.1,
                    voice: voiceOf(ppl.caller, { vibrato: { depth: 0 }, confidence: 0.96 }),
                    notes: [{ f: P.sol, dur: 0.55, vowel: "oo", stress: 1, glide: [[0, 1], [0.3, 1.2], [1, 0.9]] }] });
    }
    var end = tFinal + OUTRO.final + (sh.applause ? OUTRO.applause - 0.6 : 0);
    out.fiddle.forEach(function (ph) { ph.report.forEach(function (r) { out.notes.push(r); }); });
    out.notes.sort(function (a, b) { return a.t - b.t; });
    out.end = t0 + end; out.until = t0 + end + 0.8;
    out.tDance = t0 + tDance; out.tFinal = t0 + tFinal; out.bar = bar; out.beat = beat;
    out.registers = reg; out.piece = M.piece; out.meter = M.meter; out.times = M.times;
    return out;
  }

  // ==========================================================================
  // THE ROOM'S OWN SOUNDS — baked once per context (sound-level; a fixed
  // seed: every social hall's boards are the same boards). A footfall is a
  // heel on a sprung wooden floor: a low thump (the joists, 70–110 Hz, dying
  // in 40–55 ms), the board's knock (250–400 Hz, 15 ms) and the scuff of a
  // sole (a breath of noise); the floor on a beat is ten or twelve of them
  // within a few hundredths, a stamp all of them at once. A clap is a burst
  // of noise ringing in the cupped hands (1.2–2.2 kHz, ~10 ms). A bench
  // dragged is stick–slip: the leg catching and letting go forty to eighty
  // times a second, each catch ringing the bench's wood.
  // ==========================================================================
  // BAKED A KIND AT A TIME, when first wanted (the benches at the press, the
  // floor as the dance nears, the applause at the end — each in the clock's
  // tick that first needs it: all at once cost 54 ms of main thread in the
  // lab), each kind on a seed of its own, so the order they are first wanted
  // in never changes how they sound
  var BAKED = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var KINDS = ["step", "light", "heavy", "stamp", "clap", "applause", "scrape"];
  function mulberry(seed) {
    var s = seed >>> 0;
    return function () { s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function bakeKind(ctx, kind) {
    var shelf = BAKED ? BAKED.get(ctx) : null;
    if (!shelf) { shelf = {}; if (BAKED) BAKED.set(ctx, shelf); }
    if (shelf[kind]) return shelf[kind];
    var SR = ctx.sampleRate, rnd = mulberry(1847 + 7919 * KINDS.indexOf(kind));
    function buf(sec, fill) { var n = Math.ceil(sec * SR), bb = ctx.createBuffer(1, n, SR), d = bb.getChannelData(0); fill(d, n); return bb; }
    function ring(d, at, f, tau, amp) {              // a damped resonance struck at `at` (samples), cut 48 dB down
      var w = 2 * Math.PI * f / SR, n = Math.min(d.length - at, Math.ceil(tau * 5.5 * SR));
      for (var i = 0; i < n; i++) d[at + i] += amp * Math.exp(-i / (tau * SR)) * Math.sin(w * i);
    }
    function burst(d, at, tau, amp, lp) {            // a noise burst through a one-pole lowpass
      var y = 0, a2 = Math.min(0.99, lp), n = Math.min(d.length - at, Math.ceil(tau * 5.5 * SR));
      for (var i = 0; i < n; i++) { y += a2 * ((rnd() * 2 - 1) - y); d[at + i] += amp * Math.exp(-i / (tau * SR)) * y; }
    }
    function foot(d, at, amp) {
      ring(d, at, 70 + rnd() * 40, 0.04 + rnd() * 0.015, amp);
      ring(d, at + 2, 250 + rnd() * 150, 0.015, amp * 0.35);
      burst(d, at, 0.006, amp * 0.25, 0.35);
    }
    function clap(d, at, amp) {
      var f = 1200 + rnd() * 1000, tau = 0.008 + rnd() * 0.006, w = 2 * Math.PI * f / SR, r = Math.exp(-Math.PI * f / 3 / SR);
      var y1 = 0, y2 = 0, n = Math.min(d.length - at, Math.ceil(tau * 5.5 * SR));
      for (var i = 0; i < n; i++) { var x = (rnd() * 2 - 1) * Math.exp(-i / (tau * SR)), y = x + 2 * r * Math.cos(w) * y1 - r * r * y2; y2 = y1; y1 = y; d[at + i] += amp * 0.25 * y; }
      ring(d, at, 280 + rnd() * 80, 0.01, amp * 0.15);
    }
    function norm(d, peak) { var m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i])); if (m > 0) for (var j = 0; j < d.length; j++) d[j] *= peak / m; }
    function cluster(sec, n, spread, fn, peak) {
      return buf(sec, function (d) { for (var k = 0; k < n; k++) fn(d, Math.floor((0.03 + Math.max(0, (rnd() + rnd() - 1) * spread + spread)) * SR), 0.55 + rnd() * 0.45); norm(d, peak); });
    }
    var MAKE = {
      step: function () { return [0, 1, 2, 3].map(function () { return buf(0.3, function (d) { foot(d, 10, 1); norm(d, 0.5); }); }); },
      light: function () { return [0, 1, 2].map(function () { return cluster(0.35, 8, 0.03, foot, 0.55); }); },
      heavy: function () { return [0, 1, 2].map(function () { return cluster(0.38, 12, 0.025, foot, 0.8); }); },
      stamp: function () { return [0, 1].map(function () { return cluster(0.4, 14, 0.012, foot, 1); }); },
      clap: function () { return [0, 1, 2].map(function () { return cluster(0.25, 8, 0.015, clap, 0.6); }); },
      applause: function () {
        return [buf(2.6, function (d) {
          for (var q = 0; q < 12; q++) { var rate = 4.5 + rnd() * 2.5, tt = rnd() * 0.2; while (tt < 2.45) { var env = Math.min(1, tt / 0.18) * Math.min(1, (2.5 - tt) / 0.9); clap(d, Math.floor(tt * SR), env * (0.6 + rnd() * 0.4)); tt += (1 / rate) * (0.8 + rnd() * 0.4); } }
          norm(d, 0.7);
        })];
      },
      scrape: function () {
        return [0, 1, 2].map(function () {
          return buf(1.1, function (d) {
            var tt = 0.02, len = 0.95, base = 40 + rnd() * 40;
            while (tt < len) {
              var at = Math.floor(tt * SR), x = tt / len, env = Math.min(1, x / 0.08) * Math.min(1, (1 - x) / 0.15) * (0.7 + 0.3 * Math.sin(tt * 9 + rnd()));
              ring(d, at, 160 + rnd() * 50, 0.008, env); ring(d, at, 650 + rnd() * 200, 0.004, env * 0.5); burst(d, at, 0.003, env * 0.3, 0.5);
              tt += 1 / (base * (0.75 + rnd() * 0.5));
            }
            norm(d, 0.5);
          });
        });
      },
    };
    return (shelf[kind] = MAKE[kind]());
  }
  // every kind at once (a lab, or an engine with an idle moment to spend)
  function bake(ctx) { var B = {}; KINDS.forEach(function (k) { B[k] = bakeKind(ctx, k); }); return B; }

  // ==========================================================================
  // PERFORM — the hall, placed at t (synthesis; reads no clock)
  // ==========================================================================
  // the parts' balance within the hall (under LEVEL)
  // (soloed at LEVEL 0.5, seed 4: the fiddle's loudest 3 s +0.3 LU, the
  // caller −1.4, the floor −6.4 — the caller too forward for a dance heard
  // across the room: 2.4 dB down; the floor 0.8 up, a rhythm under the tune)
  var MIX = { fiddle: 1, floor: 0.55, caller: 0.42 };
  function perform(ctx, dest, t, material, stream, hooks) {
    var VF = window.KOLOB.VoicesFolk, VV = window.KOLOB.VoicesVocal;
    if (!VF || !VF.create) throw new Error("KOLOB.GuestSocialHall: load kolob-voices-folk.js first");
    hooks = hooks || {};
    var M = material && material.prepared ? material : prepare(material, stream);
    var sc = score(M, stream, t), synth = need(stream).fork("synth"), ds = hooks.dests || {}, made = [];
    function bus(key) { var g = ctx.createGain(); g.gain.value = LEVEL * MIX[key]; g.connect(ds[key] || dest); made.push(g); return g; }
    var fidBus = bus("fiddle"), floorBus = bus("floor"), callBus = bus("caller");
    // THE FLOOR'S NEAR WALLS: two early reflections, dark (the feet are in the
    // room with us; the hall does the rest)
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400; lp.Q.value = 0.5;
    var d1 = ctx.createDelay(0.1), d2 = ctx.createDelay(0.1), ag = ctx.createGain();
    d1.delayTime.value = 0.013; d2.delayTime.value = 0.029; ag.gain.value = 0.25;
    floorBus.connect(d1); floorBus.connect(d2); d1.connect(lp); d2.connect(lp); lp.connect(ag); ag.connect(ds.floor || dest);
    made.push(lp, d1, d2, ag);
    var pans = [-0.6, -0.3, 0, 0.3, 0.6].map(function (p) {
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.value = p;
      sp.connect(floorBus); made.push(sp); return sp;
    });
    function panIx(p) { return Math.max(0, Math.min(4, Math.round(((p || 0) + 0.6) / 0.3))); }
    var folk = VF.create(ctx, fidBus, { rand: synth.fork("folk"), fiddlePan: FIDDLE_PAN, gain: 1 });
    // which of the baked sounds each event takes, and a hair of its speed
    // (sound-level, never reported): drawn for every event now, in order, so a
    // performance laid out in slices is the same performance
    var hand = synth.fork("hands"), floorNodes = 0;
    function lands(n) { var a = []; for (var i = 0; i < n; i++) a.push({ u: hand.next(), rate: hand.rnd(0.94, 1.06) }); return a; }
    var LF = lands(sc.floor.length), LC = lands(sc.claps.length), LS = lands(sc.scrapes.length);
    function sound(arr, L, at, v, pan, dur) {
      var src = ctx.createBufferSource(), g = ctx.createGain();
      arr = bakeKind(ctx, arr);
      src.buffer = arr[Math.floor(L.u * arr.length)]; src.playbackRate.value = L.rate;
      g.gain.value = v; src.connect(g); g.connect(pans[panIx(pan)]);
      src.start(Math.max(0, at));
      if (dur) { g.gain.setValueAtTime(v, at + Math.max(0.05, dur - 0.14)); g.gain.linearRampToValueAtTime(0, at + dur); src.stop(at + dur + 0.02); }
      src.onended = function () { try { g.disconnect(); } catch (e) { /* gone */ } };
      floorNodes += 2;
    }
    var FLOOR_V = { step: 0.5, light: 0.55, heavy: 0.8, stamp: 1 };
    // the people's voices: one singer each, the same throat for all their calls
    var singers = {};
    function singerOf(c) {
      var key = c.member || c.who + ":" + c.call;
      if (!singers[key]) { var sp = {}; for (var x in c.voice) sp[x] = c.voice[x]; sp.rand = synth.fork("voice:" + key); sp.pan = c.pan; singers[key] = VV.singer(sp); }
      return singers[key];
    }
    var items = [];
    sc.scrapes.forEach(function (s, i) { items.push({ t: s.t, go: function () { sound("scrape", LS[i], s.t, 0.7 * s.v, s.pan, s.dur); } }); });
    sc.floor.forEach(function (f, i) { items.push({ t: f.t, go: function () { sound(FLOOR_V[f.kind] ? f.kind : "light", LF[i], f.t, (FLOOR_V[f.kind] || 0.6) * f.v, f.pan); } }); });
    sc.claps.forEach(function (c, i) { items.push({ t: c.t, go: function () { sound(c.kind === "applause" ? "applause" : "clap", LC[i], c.t, 0.55 * c.v, c.pan, c.dur || 0); } }); });
    sc.fiddle.forEach(function (ph) { items.push({ t: ph.t, notes: ph.report, go: function () { folk.fiddle(ph.t, ph.notes, { drone: ph.drone, droneLevel: ph.droneLevel, dyn: ph.dyn }); } }); });
    if (VV) sc.calls.forEach(function (c) { items.push({ t: c.t - 0.45, notes: c.report, go: function () { singerOf(c).sing(ctx, callBus, c.t, c.notes, c.level, { breathBefore: 0.35, inhale: 0.5, pan: c.pan }); } }); });
    items.sort(function (a, b) { return a.t - b.t; });
    // LAID OUT A SLICE AT A TIME (hooks.defer — the engine's clock): what
    // begins within each SLICE seconds is built AHEAD seconds before the
    // first of it sounds, each slice in a tick of the clock of its own, and
    // its notes told then; a lab with no clock lays it all out at once
    var AHEAD = 2.5, SLICE = 1.5, slices = [];
    items.forEach(function (it) { var cur = slices[slices.length - 1]; if (!cur || it.t >= cur.t0 + SLICE) slices.push(cur = { t0: it.t, items: [] }); cur.items.push(it); });
    slices.forEach(function (sl) {
      function lay() { sl.items.forEach(function (it) { it.go(); if (hooks.onNote && it.notes) it.notes.forEach(hooks.onNote); }); }
      var when = sl.t0 - AHEAD;
      if (hooks.defer && when > t + 0.05) hooks.defer(when, lay); else lay();
    });
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    if (hooks.onCast) sc.cast.forEach(function (c) { if (c.memberId) hooks.onCast(c); });
    // when the last sound has gone, let the hall go
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain();
    sg.gain.value = 0; sent.connect(sg); sg.connect(dest);
    sent.onended = function () { try { made.forEach(function (n) { n.disconnect(); }); folk.out.disconnect(); sg.disconnect(); sent.disconnect(); } catch (e) { /* gone already */ } };
    sent.start(Math.max(0, t)); sent.stop(sc.until + 1.5);
    perform.last = { folk: folk, score: sc, slices: slices.length, floorNodes: function () { return floorNodes; } };
    return sc.end;
  }


  return {
    plan: plan, decide: decide, prepare: prepare, tune: tune, score: score, perform: perform, bake: bake, bakeKind: bakeKind, KINDS: KINDS, MIX: MIX, CALLS: CALLS, FIGURES: FIGURES, PIECES: PIECES,
    NAME: NAME, LABEL: LABEL, ODDS: ODDS, NEVER: NEVER, SEATS: SEATS,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-socialhall.js"] = true;   // the load guard's roll call

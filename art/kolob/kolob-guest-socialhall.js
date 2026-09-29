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
// fifteen overall (the lab's odds card measures it).
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
  // holds another guest. Over the calendar's shares (PLAN §7.1) this is about
  // one meeting in fifteen before the refusals (the lab measures after).
  var ODDS = {
    base: 0.05,
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
  // THE LEVEL (the whole hall's bus), against the organ reference as the
  // guests lab measures it (the loudest 3 s, as seated): set in round 3c's
  // check so the dance sits about level with the organ at its loudest (the
  // owner lowered the organ and the trombones; the bells sit near level)
  var LEVEL = 0.5;

  function oddsFor(info) {
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
    else if (held.postlude) why = "the postlude is the " + held.postlude + "'s";
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
      var evs = figure(mode, chordAt(L, hymnBeat, mode), unit, held, nextD, per, u1, u2, run);
      evs.forEach(function (e) { e.hb = hymnBeat; });
      beats.push(evs);
      held = evs[evs.length - 1].d;
    }
    var cad = cadence(last, per, R.next());
    cad.forEach(function (e) { e.hb = last.beat; });
    beats.push(cad);
    return {
      beats: beats, firstD: mel[0].d, firstM: mel[0].m, cadD: last.d, cadM: last.m, pickU: R.next(),
      cadence: L.cadence, cadCls: chordAt(L, last.beat, mode), hymnNotes: mel.length, kept: slots.reduce(function (a, s) { return a + s.length; }, 0) + 1,
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

  // @@MORE

  return {
    plan: plan, decide: decide, tune: tune,
    NAME: NAME, LABEL: LABEL, ODDS: ODDS, NEVER: NEVER, SEATS: SEATS,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-socialhall.js"] = true;   // the load guard's roll call

// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE GIFT OF TONGUES (KOLOB.GuestTongues)
//
// In Kirtland, Ohio, in the winter of 1833, the Saints' meetings were
// sometimes broken open by a gift: a man or a woman would rise and sing,
// unbidden, in a language no one in the room knew, and someone else might
// rise to interpret. The clerks wrote it down as "singing in tongues", and
// the minutes of the School of the Prophets, the Relief Society's first
// meetings and the Kirtland Temple's dedication (1836) are full of it. The
// Shakers, a few hundred miles east, were receiving "vision songs" the same
// decade — melodies given in dreams, in wordless syllables, sung once and
// then written down with their "unknown tongue" spelled as it sounded.
//
// At the rim of Kolob's light the gift still comes. In the testimony, when
// the room is quiet between speakers, one of the ward — one of those who
// came to bear testimony, if the Sunday seated them — rises and sings: a
// free, unmetered song, melismatic, in syllables that are no one's words.
// They are Deseret sounds, one sound a letter as the 1859 chart spells
// them, drawn from a small tongue of their own (three to five consonants,
// all voiced and soft; three to five vowels), made into a handful of words
// that come back as words do, the first of them returning at the head of a
// later phrase like a name. The song rises in arches to a peak about two
// thirds of the way through and comes down to rest; its last note is held.
// Then the ward, moved, hums it: the singer's own section first, in unison
// with her, then the rest of the room filling it into a chord — bare fifths
// in a Sacred Harp or an Old Way house, the full triad in a Tabernacle one,
// the tune's note over a hummed do in a Shaker one — and, as the hum
// holds, the harmonium softly takes up the song's opening, slower, over a
// held do, and lets it go.
//
// Sometimes (the seat's `seeds` flag) the song is the seed of the next hymn:
// its opening, in the Score's degrees (gesture()), is what the composer is
// handed for line one. That is the integrator's to wire (the hymnal writes
// every hymn when the meeting is planned, and this song is known then: its
// score is pure).
//
// THE SEAT. plan(meetingInfo, stream) decides: the testimony only, most
// often on a fast Sunday (and at a dedication — the Kirtland Temple's own
// day), seldom at a conference or a jubilee. Never when the testimony was
// cut, holds a guest or has one beside it (PLAN §8.13). Every die is thrown
// before any refusal, on its own fork, so a refusal moves nothing else.
//
// PURE PLANNING. plan(), decide(), score(), tongue() and gesture() touch no
// AudioContext, DOM, clock or Math.random. The dice live on forks of the
// guest's stream (guest:tongues:<n>): "seat" (the odds, the moment, which
// testimony-bearer, whether it seeds), "shape" (every length and time: the
// phrases, the syllables, the melismas' lengths, the breaths, the hum's and
// the harmonium's timing — so plan() knows the exact length without the
// material), "tongue" (the sounds and the words), "melody" (the pitches),
// "ward" (a ward of its own when none is handed in) and "synth" (the
// voices' sound-level dice). perform() reads no clock: everything it places
// is at or after the t it is given, laid out a phrase at a time through
// hooks.defer when the engine gives it a clock.
//
// Public surface: window.KOLOB.GuestTongues
//   plan(meetingInfo, stream) → { guest: "tongues", seat: "testimony",
//        section: "testimony", at, dur, holdUntil, singer, part, seeds,
//        odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, house?, sections: [{type}],
//       guests: [{type, section}], ward? (KOLOB.Cast's ward: the singer is
//       one of its testimony-bearers), force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   score(material, stream, t0) → the performance as data (pure)
//     material: { mode, keynoteHz, house?, ward?, singer? (a member id),
//                 part? ("S"|"A"|"T"|"B"), harmonium? (false: the rite's
//                 seating has none — the hum ends it) }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onNote(n), onStage(st), harmonium(t, notes,
//              gainMul) (the engine's own reed, if it would rather) }
//   gesture(score) → [[deg, …]] the song's opening for the composer
//   tongue(stream) → the syllables and words of one song (pure)
//   ODDS, EXCLUDES, NAME, LABEL, LEVEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestTongues = (function () {
  "use strict";

  var NAME = "tongues";
  var LABEL = "guest:tongues:";                   // the stream's label: + the meeting number

  // ==========================================================================
  // THE ODDS — a starting point, for the owner's ear
  // ==========================================================================
  // p = base × weight[sunday, or the kind], capped: about one testimony in
  // fourteen as a rule, one in four on a fast Sunday (the plan's own lean,
  // §8.13: "Fast Sunday: tongues"), and at a dedication; seldom at a
  // conference or a jubilee, where the testimony is short and the room full
  var ODDS = {
    base: 0.07,
    weight: {
      ordinary: 1, fast: 3.8, conference: 0.5, jubilee: 0.6,
      pioneer: 0.5, christmas: 0.5, easter: 0.9, wedding: 0.4, funeral: 1.2, dedication: 3.5,
    },
    cap: 0.5,
  };
  var EXCLUDES = ["question"];                    // (the Question is shelved; were it asked in the testimony, the song would wait)
  var AT = [4, 24];                               // s into the testimony: between speakers
  var SEEDS = { base: 0.3, fast: 0.45 };          // how often the song seeds the next hymn
  // the song's bus. Calibrated in guests3c-lab against the organ reference
  // (loudest 3 s): the singer alone about 2–3 LU under it — one voice in the
  // room, heard — and the ward's hum softer still
  // (a person of the hum at 0.046 is the engine's own ward's level, a
  // singer's WARD_GAIN × WARD_LEVEL ≈ 0.057, a shade under for a closed mouth)
  var LEVEL = 1.0;
  var SING_GAIN = 0.44, HUM_GAIN = 0.046, REED_GAIN = 0.07;

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestTongues: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  function mod(a, n) { return ((a % n) + n) % n; }
  function pickW(R, pool) {                       // (the substrate's pickW, spelt out: the same one die)
    var tot = 0, i; for (i = 0; i < pool.length; i++) tot += pool[i][1];
    var x = R.rnd(0, tot);
    for (i = 0; i < pool.length; i++) { x -= pool[i][1]; if (x <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), at = rs.rnd(AT[0], AT[1]), whoDie = rs.next(), seedDie = rs.next(), partDie = rs.next();
    var sh = shapeOf(stream, info.house);
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [], ti = -1;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === "testimony") { ti = i; break; }
    function near(g) {
      if (!g || g.type === NAME) return false;
      if (EXCLUDES.indexOf(g.type) >= 0 && g.section === "testimony") return true;
      var gi = typeof g.index === "number" ? g.index : -1;
      if (gi < 0) for (var j = 0; j < secs.length; j++) if (secs[j] && secs[j].type === g.section) { gi = j; if (Math.abs(j - ti) <= 1) break; }
      return gi >= 0 && Math.abs(gi - ti) <= 1;
    }
    if (ti < 0) why = "no testimony";
    else if (guests.some(near)) why = "a guest is in or beside the testimony";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    // the singer: one of the Sunday's testimony-bearers, when the ward is
    // known; else a voice of the ward's own parts (the performer seats it)
    var ward = info.ward || null, bearers = ward && ward.roles && ward.roles.testimony ? [].concat(ward.roles.testimony) : [];
    var singer = bearers.length ? bearers[Math.min(bearers.length - 1, Math.floor(whoDie * bearers.length))] : null;
    var part = singer && ward.byId && ward.byId[singer] ? ward.byId[singer].part : pickPart(partDie);
    var tl = timeline(sh);
    var seedP = info.sunday === "fast" || info.kind === "fast" ? SEEDS.fast : SEEDS.base;
    return {
      seat: {
        guest: NAME, seat: "testimony", section: "testimony", at: +at.toFixed(2), dur: +tl.end.toFixed(2),
        holdUntil: +(at + tl.end + 4).toFixed(2), singer: singer, part: part, seeds: seedDie < seedP,
        phrases: tl.phrases.length, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }
  function pickWith(u, pool) { return pickW({ rnd: function (a, b) { return a + u * (b - a); } }, pool); }   // (a die already thrown)
  function pickPart(u) { return u < 0.34 ? "S" : u < 0.56 ? "A" : u < 0.8 ? "T" : "B"; }

  // ==========================================================================
  // THE SHAPE — every length and every time, from the "shape" fork alone
  // (so plan() knows the song's exact length before any pitch is chosen)
  // ==========================================================================
  var CAP_S = 58;                                 // the song at most this long: middle phrases let go first
  var SLOTS = 6;                                  // phrases drawn (the last one sung is always slot 5)
  function styleOf(house) {
    return house === "shaker" ? "shaker" : house === "sacredharp" || house === "oldway" || house === "psalmody" ? "old" : "house";
  }
  function shapeOf(stream, house) {
    var r = need(stream).fork("shape"), style = styleOf(house);
    var nP = r.rint(4, 6);
    var sb = r.rnd(0.42, 0.68);                   // a syllable's time, s (the singer's pace)
    var mn = r.rnd(0.12, 0.18);                   // a melisma's note, s
    // (a Shaker vision song is plainer and steadier; an Old Way singer's
    // gift runs to ornament)
    var melP = r.rnd(0.22, 0.36) * (style === "old" ? 1.25 : style === "shaker" ? 0.45 : 1);
    var peakAt = r.rnd(0.5, 0.72);                // where the song is highest (a share of its phrases)
    var refrain = r.rint(2, 3);                   // how many of the opening's syllables come back, like a name
    var phrases = [];
    for (var k = 0; k < SLOTS; k++) {
      var pr = r.fork("phrase:" + k), syl = [];
      var m = pr.rint(5, 9);
      for (var j = 0; j < 10; j++) {
        var d = style === "shaker" ? pickW(pr, [[1, 5], [2, 2], [0.5, 1]]) : pickW(pr, [[0.7, 3], [1, 4], [1.5, 2], [2, 0.8]]);
        syl.push({ d: d, mel: pr.next(), n: pr.rint(3, style === "old" ? 7 : 6) });
      }
      phrases.push({ m: m, syl: syl, hold: pr.rnd(1.4, 2.6), breath: pr.rnd(0.55, 1.3) });
    }
    return {
      style: style, nP: nP, sb: sb, mn: mn, melP: melP, peakAt: peakAt, refrain: refrain, phrases: phrases,
      finalHold: r.rnd(2.4, 3.4),
      hum: { enter: r.rnd(0.5, 1.1), bass: r.rnd(0.4, 0.9), inner: r.rnd(0.9, 1.8), hold: r.rnd(5, 8), fade: r.rnd(1.6, 2.6),
             scatter: r.rnd(0.12, 0.3), stay: r.rnd(1.2, 2.0) },
      reed: { after: r.rnd(0.6, 1.8), slow: r.rnd(1.35, 1.7), notes: r.rint(5, 8), last: r.rnd(1.8, 2.8) },
    };
  }
  // a melisma's notes: slower at its ends, quicker in the middle (a run that
  // takes flight and lands)
  function melDurs(n, mn) {
    var out = [];
    for (var j = 0; j < n; j++) out.push(mn * (1.3 - 0.6 * Math.sin(Math.PI * (j + 0.5) / n)));
    return out;
  }
  // the timeline: when every syllable, melisma, breath, entry and release
  // falls, in seconds from the singer's rising (pure: the shape alone)
  function timeline(sh) {
    function build(used) {
      var order = []; for (var k = 0; k < used - 1; k++) order.push(k); order.push(SLOTS - 1);
      var t = 0.6, out = [], pk = clamp(Math.round(sh.peakAt * (order.length - 1)), 1, order.length - 2);
      order.forEach(function (slot, i) {
        var ph = sh.phrases[slot], last = i === order.length - 1, m = ph.m;
        // the name comes back: the third phrase and the last begin as the first did
        var echo = i > 0 && (i === 2 || last) && order.length > 3;
        var bell = i === pk ? 1 : Math.max(0, 1 - Math.abs(i - pk) * 0.45);   // the height, and how near to it
        var p = { i: i, slot: slot, t0: t, syl: [], echo: echo, last: last, bell: bell };
        for (var j = 0; j < m; j++) {
          var s = echo && j < sh.refrain ? sh.phrases[order[0]].syl[j] : ph.syl[j], fin = j === m - 1;
          // (and a flourish on the way into the height's last note and the
          // song's: the gift's melismas gather where it soars and where it rests)
          var flourish = sh.style !== "shaker" && j === m - 2 && (bell >= 1 || last);
          var mel = !fin && (flourish || s.mel < sh.melP * (1 + 0.8 * bell)) ? melDurs(s.n, sh.mn) : [];
          var d = fin ? (last ? sh.finalHold : ph.hold) : sh.sb * s.d * (mel.length ? 0.7 : 1);
          p.syl.push({ t: r4(t), d: r4(d), mel: mel.map(r4) });
          t += d; mel.forEach(function (x) { t += x; });
        }
        p.t1 = t;
        out.push(p);
        if (!last) t += ph.breath;
      });
      return out;
    }
    var used = sh.nP, phrases = build(used);
    while (used > 4 && phrases[phrases.length - 1].t1 > CAP_S) phrases = build(--used);
    var L = phrases[phrases.length - 1], tL = L.syl[L.syl.length - 1].t, H = sh.hum;
    var first = tL + H.enter + 0.6, full = first + Math.max(H.bass, H.inner) + H.scatter;
    var singerEnd = Math.max(tL + sh.finalHold, full + H.stay), holdEnd = full + H.hold;
    var reedAt = full + sh.reed.after, p0 = phrases[0].syl, nR = Math.min(sh.reed.notes, p0.length), reed = [], rt = reedAt;
    for (var q = 0; q < nR; q++) {
      var gap = q + 1 < p0.length ? p0[q + 1].t - p0[q].t : p0[q].d;
      var dd = q === nR - 1 ? sh.reed.last : gap * sh.reed.slow;
      reed.push({ t: r4(rt), d: r4(dd), of: q });
      rt += dd;
    }
    var reedEnd = rt + 1.5;
    return {
      phrases: phrases, lastOnset: r4(tL), singerEnd: r4(singerEnd),
      hum: { first: r4(first), bass: r4(first + H.bass), inner: r4(first + H.inner), full: r4(full), holdEnd: r4(holdEnd), fade: H.fade, scatter: H.scatter },
      reed: reed, reedEnd: r4(reedEnd), end: r4(Math.max(reedEnd, holdEnd + H.fade + H.scatter) + 0.5),
      endNoReed: r4(holdEnd + H.fade + H.scatter + 0.5),
    };
  }

  // ==========================================================================
  // THE TONGUE — a small language of its own for each song (pure)
  // ==========================================================================
  // The sounds a singer may be given: only voiced, soft consonants (the
  // owner heard the ward's s and f as a hiss; none here), weighted as the
  // Kirtland clerks' spellings and the Shaker vision songs lean — l, m and n
  // most, the glides and the voiced stops now and then; every tongue has
  // "ah" and two to four vowels more.
  var CONS_W = [["l", 3], ["m", 2], ["n", 2.2], ["y", 1], ["w", 0.9], ["d", 1], ["b", 0.7], ["r", 0.8], ["h", 0.6], ["g", 0.4]];
  var VOW_W = [["ee", 2], ["oh", 2], ["oo", 1.2], ["eh", 1.4]];
  var DS_VOWEL = { ah: "ah", ee: "ee", oh: "oh", oo: "oo", eh: "e" };   // the voice's vowel → the Deseret chart's
  // NO ONE'S WORDS. A word made here is refused if it is a word of English
  // or of the meeting's own speech (the shape notes, the Hebrew and the
  // Book of Mormon's sacred names, amen and hosanna), or a name of the ward
  // — the song must be in syllables no one knows. Spelt as the voice spells
  // them, a syllable to a dot. (A one-syllable word is always someone's
  // word in English — la, me, no, you, go — so a word here has two to four.)
  var BLOCK = {};
  ("m-ah.m-ah d-ah.d-ah b-eh.b-ee b-ee.b-ee y-eh.l-oh m-eh.l-oh h-eh.l-oh b-eh.l-oh h-ah.l-oh l-ah.m-ah m-ah.n-ah ah.m-eh-n " +
   "ah.m-eh-n ah.m-ah-n h-oh.l-ee h-oh.m-ee m-oo.d-ee n-ee.d-ee b-oh.d-ee b-ah.n-ah.n-ah ah.n-ah eh.l-ah l-ee.n-ah d-ee.n-ah " +
   "n-ee.n-ah w-ee.n-ee h-oo.l-ah l-oo.l-oo y-oo.m-ah r-oh.m-ah eh.d-ee eh.m-ee oh.b-oh ah.b-ah eh.l-oh.h-ee-m m-oh.r-oh.n-ee " +
   "l-eh.h-ee h-eh.l-ah.m-ah-n ah.l-eh.l-oo.y-ah h-ah.l-eh.l-oo.y-ah m-ah.r-ee m-ah.r-ee.ah n-oh.b-oh.d-ee d-oo.d-oo d-ah.d-ee " +
   "m-oh.m-ee m-ah.m-ee n-ah.n-ah n-ah.n-ee l-ah.d-ee l-eh.d-ee r-eh.d-ee r-ah.d-ee b-ah.b-ee w-ah.d-ee y-ah.w-eh y-ah.h-oo " +
   "h-ah.b-ee h-oo.r-ah b-oo.b-oo n-oo.d-ee b-oo.d-ee m-ee.l-oh b-eh.r-ee m-eh.r-ee w-eh.r-ee h-ah.r-ee l-ah.r-ee y-eh.r-ee " +
   "b-oh.n-ee d-oh.n-ah l-oh.n-ee m-oh.n-ee h-oh.n-ee r-oh.b-ee ah.l-ee oh.l-ee w-ee.l-ee l-ee.l-ee eh.l-ee eh.n-ee m-ee.n-ee " +
   "d-oh.m-ee h-ee.l-ee w-oo.l-ee b-ee.l-ee r-ee.l-ee n-oh.m-ah d-ee.l-ah l-oo.n-ah d-ah.n-ah g-oh.l-ee g-ah.l-ah l-ah.l-ah-l " +
   "d-oh.r-ee m-ee.m-oh l-ee.m-oh m-eh.m-oh d-eh.m-oh r-ee.m-oh h-eh.m-oh b-eh.l-ee m-oh.l-ah l-ah.w-ah h-ah.w-ah").split(" ").forEach(function (w) { if (w) BLOCK[w] = 1; });
  function drawSet(r, pool, n) {
    var left = pool.slice(), out = [];
    for (var i = 0; i < n && left.length; i++) {
      var got = pickW(r, left);
      out.push(got);
      left = left.filter(function (x) { return x[0] !== got; });
    }
    return out;
  }
  function sounds(s) { return (s.c ? s.c + "-" : "") + s.v + (s.coda ? "-" + s.coda : ""); }
  function dsOf(syls) {
    var C = window.KOLOB.Cast;
    if (!C || !C.deseret) return null;
    var codes = [];
    syls.forEach(function (s) { if (s.c) codes.push(s.c); codes.push(DS_VOWEL[s.v] || "ah"); if (s.coda) codes.push(s.coda); });
    try { return C.deseret(codes.join("-")); } catch (e) { return null; }
  }
  // tongue(stream, avoid?) — avoid: {deseret word: 1} the ward's names
  function tongue(stream, avoid) {
    avoid = avoid || {};
    var r = need(stream).fork("tongue");
    var nC = r.rint(3, 5), nV = r.rint(3, 5);
    var cons = drawSet(r, CONS_W, nC), vows = ["ah"].concat(drawSet(r, VOW_W, nV - 1));
    var codas = cons.filter(function (c) { return c === "m" || c === "n" || c === "l"; });
    // (within the tongue, each consonant is used as often as it is common)
    var cW = CONS_W.filter(function (x) { return cons.indexOf(x[0]) >= 0; });
    var vW = [["ah", 3]].concat(VOW_W.filter(function (x) { return vows.indexOf(x[0]) >= 0; }));
    var words = [], seen = {};
    for (var w = 0; w < 8; w++) {
      var got = null, tries = 0;
      for (var a = 0; a < 10 && !got; a++) {
        var wr = r.fork("word:" + w + ":" + a), nS = pickW(wr, [[2, 4], [3, 3], [4, 0.7]]), syls = [];
        tries++;
        for (var s = 0; s < 4; s++) {
          var onset = wr.next(), cD = wr.next(), vD = wr.next(), redup = wr.next();
          if (s >= nS) continue;
          var prev = syls[s - 1], v = pickWith(vD, vW);
          if (prev && prev.c && redup < 0.12) { syls.push({ c: prev.c, v: prev.v }); continue; }     // a syllable said twice, as a child would
          // (a bare vowel only after a consonant's syllable, and never on the
          // vowel before it: two of the same vowel with nothing between are
          // one long vowel, not two syllables)
          var bare = onset >= 0.8 && prev && prev.c && prev.v !== v;
          syls.push({ c: bare ? null : pickWith(cD, cW), v: v });
        }
        var cdD = wr.next(), cdW = wr.next();
        if (codas.length && cdD < 0.18) syls[syls.length - 1].coda = codas[Math.floor(cdW * codas.length)];
        var key = syls.map(sounds).join("."), ds = dsOf(syls);
        if (BLOCK[key] || seen[key] || (ds && avoid[ds])) continue;
        got = { syl: syls.map(sounds), sounds: key, ds: ds, tries: tries };
        seen[key] = 1;
      }
      if (!got) {                                  // (never: ten tries; but a guest never throws)
        var fb = [{ c: cons[0], v: vows[w % vows.length] }, { c: cons[(w + 1) % nC], v: vows[(w + 2) % vows.length] }, { c: cons[(w + 2) % nC], v: "ah" }];
        got = { syl: fb.map(sounds), sounds: fb.map(sounds).join("."), ds: dsOf(fb), tries: tries, fallback: true };
      }
      words.push(got);
    }
    // how often each word comes (the first words are the song's own; a few
    // come back again and again, as words do)
    // (the first word is the song's name: it opens the song and the phrases
    // that call it back, and is not drawn among the others)
    var weights = words.map(function (x, i) { return [i, i === 0 ? 0 : 1 / (i + 1)]; });
    return { consonants: cons, vowels: vows, words: words, weights: weights };
  }

  // ==========================================================================
  // THE PITCHES — the day's mode, in just intonation, in the singer's compass
  // ==========================================================================
  // a part's comfortable compass (Hz) and where its voice sits
  var RANGE = { S: [240, 700], A: [185, 560], T: [135, 430], B: [92, 330], child: [260, 720] };
  var MID = { S: 392, A: 294, T: 220, B: 147, child: 440 };
  function col(mode) {
    var P = window.KOLOB.Pitch;
    if (!P || !P.COLLECTIONS) throw new Error("KOLOB.GuestTongues: load kolob-pitch.js first");
    return P.COLLECTIONS[mode] || P.COLLECTIONS.ionian;
  }
  function modeName(mode) { var P = window.KOLOB.Pitch; return P && P.COLLECTIONS && P.COLLECTIONS[mode] ? mode : "ionian"; }
  function ratioAt(c, idx) { var n = c.ratios.length; return c.ratios[mod(idx, n)] * Math.pow(2, Math.floor(idx / n)); }
  // a collection index → the Score's degree (0 = the mode's final, 7 a step
  // an octave: the d7 space every hymn is spelled in)
  function d7Of(c, idx) {
    var n = c.ratios.length, cls = mod(idx, n), o = Math.floor(idx / n);
    for (var d = 0; d < 7; d++) if (c.map[d] === cls) return o * 7 + d;
    return o * 7;
  }
  function idxOfRatio(c, r) { for (var i = 0; i < c.ratios.length; i++) if (Math.abs(c.ratios[i] - r) < 1e-6) return i; return -1; }
  function classes(c) {
    var third = idxOfRatio(c, 5 / 4); if (third < 0) third = idxOfRatio(c, 6 / 5);
    return { doI: 0, sol: idxOfRatio(c, 3 / 2), mi: third, re: idxOfRatio(c, 9 / 8) };
  }
  // the singer's do: the keynote's octave that sets the song's middle in the
  // middle of the voice
  function rootFor(keynoteHz, part) {
    var want = (MID[part] || 294) / 1.4, f = keynoteHz;
    while (f > want * Math.SQRT2) f /= 2;
    while (f < want / Math.SQRT2) f *= 2;
    return f;
  }
  function compass(c, root, part) {
    var rg = RANGE[part] || RANGE.A, lo = null, hi = null;
    for (var i = -14; i <= 24; i++) { var f = root * ratioAt(c, i); if (f >= rg[0] && f <= rg[1]) { if (lo === null) lo = i; hi = i; } }
    return [lo, hi];
  }
  // A MELISMA: n notes after a syllable's note a, on the way to the next
  // syllable's b — a run toward it (overshooting and turning), a turn, a
  // shake, a leap and a fall, an arabesque — in scale steps, kept in the voice
  var FIGS = {
    old: [["turn", 2], ["run", 2], ["shake", 1.5], ["leap", 1], ["arabesque", 1]],
    house: [["run", 2], ["turn", 2], ["leap", 1], ["arabesque", 1], ["shake", 0.6]],
    shaker: [["run", 1], ["turn", 1]],
  };
  function melisma(fig, a, b, n, lo, hi) {
    var out = [], s = b > a ? 1 : b < a ? -1 : 1, x = a;
    for (var j = 0; j < n; j++) {
      if (fig === "run") { x += s; if ((s > 0 && x > b + 1) || (s < 0 && x < b - 1) || x > hi || x < lo) { s = -s; x += 2 * s; } }
      else if (fig === "turn") x = a + [1, 0, -1, 0][j % 4];
      else if (fig === "shake") x = a + (j % 2 ? 0 : 1);
      else if (fig === "leap") x = j === 0 ? a + 3 : x - 1;
      else x = a + [1, 2, 1, 0, -1, 0][j % 6];
      out.push(x);
    }
    // (a figure that would leave the voice turns the other way about its
    // note — a shake at the top of the compass shakes below it)
    var over = out.some(function (y) { return y > hi; }), under = out.some(function (y) { return y < lo; });
    if (over !== under) out = out.map(function (y) { return fig === "run" ? y : 2 * a - y; });
    return out.map(function (y) { return clamp(y, lo, hi); });
  }

  // ==========================================================================
  // THE SCORE — the whole gift as data (pure)
  // ==========================================================================
  function namesOf(ward) {
    var out = {};
    if (ward && ward.members) ward.members.forEach(function (m) { String(m.nameDs || "").split(" ").forEach(function (w) { if (w) out[w] = 1; }); });
    return out;
  }
  // the song's contour: arches rising to the peak phrase and coming down to
  // rest; each phrase ends on an open tone (sol, re, mi), the last on the
  // song's final; the name comes back on the notes it was first sung to
  function contour(R, tl, sh, c, lo, hi, fin, cl) {
    var n = c.ratios.length, span = hi - lo, anchors = [];
    function nearestOf(cls, at) { var best = null; for (var i = lo; i <= hi; i++) if (mod(i, n) === cls && (best === null || Math.abs(i - at) < Math.abs(best - at))) best = i; return best === null ? Math.round(at) : best; }
    var startIdx = Math.round(lo + span * R.rnd(0.2, 0.4)), prevEnd = startIdx;
    tl.phrases.forEach(function (p, k) {
      var pr = R.fork("phrase:" + k), m = p.syl.length;
      var topDie = pr.rnd(-0.6, 0.6), peakDie = pr.next(), oc = pickW(pr, [["sol", 3], ["re", 2], ["mi", 1.5]]), jPk = Math.min(Math.max(1, m - 3), Math.round((m - 1) * pr.rnd(0.3, 0.65)));
      var step = pickW(pr, [[-1, 1], [0, 1], [1, 2], [2, 1]]);
      var top = Math.round(lo + span * (0.56 + 0.34 * p.bell) + topDie);
      if (p.bell >= 1) top = hi - (peakDie < 0.5 ? 0 : 1);
      var ci = oc === "sol" ? cl.sol : oc === "re" ? cl.re : cl.mi; if (ci < 0) ci = cl.sol;
      var endIdx = p.last ? fin : nearestOf(ci, Math.min(lo + span * 0.5, top - 2.5));
      var start = k === 0 ? startIdx : clamp(prevEnd + step, lo, hi), a = [];
      if (top < start + 2) top = Math.min(hi, start + 2);                  // every phrase is an arch
      for (var j = 0; j < m; j++) {
        var target = j <= jPk ? start + (top - start) * (jPk ? Math.sin(Math.PI / 2 * j / jPk) : 1) : top + (endIdx - top) * (j - jPk) / Math.max(1, m - 1 - jPk);
        var noise = pickW(pr, [[-1, 1], [0, 3], [1, 1]]);
        var x = j === m - 1 ? endIdx : Math.round(target) + noise;
        if (j > 0 && j < m - 1) x = clamp(x, a[j - 1] - 4, a[j - 1] + 4);
        a.push(clamp(x, lo, hi));
      }
      if (p.echo) for (var q = 0; q < sh.refrain && q < m - 1 && q < anchors[0].length - 1; q++) a[q] = anchors[0][q];
      // (the way down to the phrase's last note is a step or a third, never a
      // plunge: the note before it is brought near)
      if (m >= 2 && Math.abs(a[m - 1] - a[m - 2]) > 3 && !(p.echo && m - 2 < sh.refrain)) a[m - 2] = a[m - 1] + (a[m - 2] > a[m - 1] ? 2 : -1);
      anchors.push(a); prevEnd = endIdx;
    });
    return anchors;
  }
  // the ward's chord under the last note: the singer's section in unison
  // with her; the others fill the house's chord (bare fifths in an old
  // house, the triad in the Tabernacle's, do under the tune in a Shaker's),
  // every part in its own compass, the parts in order, top to bottom
  function voicing(c, K, fHz, fClass, part, style, cl) {
    var n = c.ratios.length, parts = ["S", "A", "T", "B"], sp = part === "child" ? "S" : part;
    var want = style === "old" ? [0, cl.sol] : [0, cl.mi, cl.sol];
    function tones(p, onlyCls) {
      var rg = RANGE[p], out = [];
      for (var i = -21; i <= 28; i++) {
        var cls = mod(i, n), f = K * ratioAt(c, i);
        if (f < rg[0] || f > rg[1]) continue;
        if (onlyCls ? onlyCls.indexOf(cls) >= 0 : want.indexOf(cls) >= 0) out.push({ f: f, cls: cls });
      }
      return out;
    }
    var fixed = {};
    (function () { var f = fHz, rg = RANGE[sp]; while (f > rg[1]) f /= 2; while (f < rg[0]) f *= 2; fixed[sp] = f; })();
    var cand = parts.map(function (p) {
      if (fixed[p]) return [{ f: fixed[p], cls: fClass }];
      if (style === "shaker") return (p === "S" || p === "A") ? tones(p, [fClass]) : tones(p, [0]);
      return tones(p);
    });
    var best = null, bestS = -1e9;
    (function walk(i, pick) {
      if (i === parts.length) {
        var s = 0, seen = {};
        pick.forEach(function (x, j) { seen[x.cls] = 1; s -= Math.abs(Math.log(x.f / MID[parts[j]])) * 2; });
        s += Object.keys(seen).length * 10;
        for (var j = 1; j < pick.length; j++) if (pick[j].f > pick[j - 1].f + 0.01) s -= 25;
        if (pick[3] && pick[3].cls !== 0) s -= 8;                          // the bass on do
        if (s > bestS) { bestS = s; best = pick.slice(); }
        return;
      }
      (cand[i].length ? cand[i] : [{ f: fixed[sp], cls: fClass }]).forEach(function (x) { pick.push(x); walk(i + 1, pick); pick.pop(); });
    })(0, []);
    var out = {}; parts.forEach(function (p, j) { out[p] = best[j]; });
    return out;
  }
  // a ward to hum, when the meeting hands none in (a lab): the Cast's own
  // seating on this guest's fork, else thirty-two plain voices
  function wardOf(material, stream) {
    if (material.ward && material.ward.members) return material.ward;
    var C = window.KOLOB.Cast;
    if (C && C.seat) return C.seat(stream.fork("ward"), {});
    var r = stream.fork("ward"), members = [], byId = {};
    ["S", "A", "T", "B"].forEach(function (p) {
      for (var k = 0; k < 8; k++) {
        var m = { id: p + k, part: p, k: k, pew: { x: r.rnd(-0.8, 0.8) }, voice: { part: p, age: r.pick(["young", "mid", "mid", "old"]), confidence: r.rnd(0.45, 0.9), brightness: r.rnd(0.3, 0.65), breath: r.rnd(0.2, 0.55), pitchHabitCents: r.rnd(-12, 12), timingHabitMs: r.rnd(0, 70), tractScale: r.rnd(0.95, 1.05) } };
        members.push(m); byId[m.id] = m;
      }
    });
    return { members: members, byId: byId, roles: { testimony: ["A2", "B5", "T3"] } };
  }
  function score(material, stream, t0) {
    material = material || {};
    t0 = t0 || 0;
    need(stream);
    var mode = modeName(material.mode), c = col(mode), n = c.ratios.length, K = material.keynoteHz || 260;
    var sh = shapeOf(stream, material.house || null), tl = timeline(sh), cl = classes(c);
    var ward = wardOf(material, stream), sid = material.singer || null;
    if (!sid || !ward.byId[sid]) sid = null;
    var m0 = sid ? ward.byId[sid] : null;
    var part = m0 ? (m0.part === "child" ? "S" : m0.part) : (RANGE[material.part] ? material.part : "A");
    var root = rootFor(K, part), cmp = compass(c, root, part), lo = cmp[0], hi = cmp[1];
    var ko = Math.round(Math.log(root / K) / Math.LN2);
    var tg = tongue(stream, namesOf(ward));
    var R = stream.fork("melody");
    // the song's last note: do most often, else sol or mi — below the top of the voice
    var finName = pickW(R, [["do", 6], ["sol", 2.5], ["mi", 1.5]]), finUp = R.next();
    var fc = finName === "do" ? 0 : finName === "sol" ? cl.sol : cl.mi, cands = [];
    for (var i = lo; i <= hi - 3; i++) if (mod(i, n) === fc) cands.push(i);
    if (!cands.length) for (var i2 = lo; i2 <= hi; i2++) if (mod(i2, n) === fc) cands.push(i2);
    var fin = cands.length ? cands[finUp < 0.5 ? 0 : cands.length - 1] : lo;
    var anchors = contour(R, tl, sh, c, lo, hi, fin, cl);
    // the syllables: word after word from the tongue, the name (its first
    // word) opening the song and every phrase that echoes it
    var Rw = stream.fork("words"), Rf = stream.fork("figures");
    function fOf(idx) { return root * ratioAt(c, idx); }
    function spelled(idx) {
      var d = d7Of(c, idx) + 7 * ko, Cm = window.KOLOB.Composer;
      return { deg: d, monzo: Cm && Cm.spelledMonzo ? Cm.spelledMonzo(mode, d, 0) : null };
    }
    var lines = [], notes = [];
    tl.phrases.forEach(function (p, k) {
      var a = anchors[k], line = [], word = null, wi = 0, fresh = true, said = {};
      p.syl.forEach(function (s, j) {
        var pickDie = Rw.next();
        if (!word || wi >= word.syl.length) {
          var wix = fresh && (k === 0 || p.echo) ? 0 : pickWith(pickDie, tg.weights);
          // (a word once in a phrase, while the tongue has others to give)
          for (var tr = 0; tr < tg.words.length && (said[wix] || (word && tg.words[wix] === word)); tr++) wix = 1 + (wix % (tg.words.length - 1));
          word = tg.words[wix]; said[wix] = 1;
          wi = 0; fresh = false;
        }
        var nm = word.syl[wi], first = wi === 0; wi++;
        var fin2 = p.last && j === p.syl.length - 1, d = fin2 ? tl.singerEnd - s.t : s.d, sp = spelled(a[j]);
        var nt = { t: r4(t0 + s.t), dur: r4(d), f: fOf(a[j]), idx: a[j], deg: sp.deg, monzo: sp.monzo, vowel: nm, stress: first ? 1 : 0.55,
                   word: tg.words.indexOf(word), wordDs: first ? word.ds : null, phrase: k };
        line.push(nt); notes.push(nt);
        if (s.mel.length) {
          var fig = pickW(Rf, FIGS[sh.style]), xs = melisma(fig, a[j], a[j + 1] != null ? a[j + 1] : a[j], s.mel.length, lo, hi), tt = s.t + s.d;
          s.mel.forEach(function (md, q) {
            var sq = spelled(xs[q]), mnote = { t: r4(t0 + tt), dur: md, f: fOf(xs[q]), idx: xs[q], deg: sq.deg, monzo: sq.monzo, vowel: nm, stress: 0.5, slur: true, fig: fig, phrase: k };
            line.push(mnote); notes.push(mnote); tt += md;
          });
        }
      });
      lines.push({ phrase: k, t0: r4(t0 + p.t0), t1: r4(t0 + p.t1), breathBefore: r4(k === 0 ? 0.6 : p.t0 - tl.phrases[k - 1].t1), echo: p.echo, peak: p.bell >= 1, notes: line });
    });
    // the ward hums the last note: the singer's section first, in unison
    // with her, then the basses, then the rest, each in their own moment;
    // they let it go one by one across the fade
    var fHz = fOf(fin), V4 = voicing(c, K, fHz, mod(fin, n), part, sh.style, cl), H = tl.hum, Rh = stream.fork("hum"), hum = [];
    var spart = part;
    ward.members.forEach(function (m) {
      var eDie = Rh.next(), xDie = Rh.next();
      if (m.k == null || m.id === sid || !V4[m.part]) return;             // (the Primary's children are not among the thirty-two)
      var at = m.part === spart ? H.first + eDie * 0.5 : m.part === "B" ? H.bass + eDie * H.scatter * 2 : H.inner + eDie * H.scatter * 3;
      var end = H.holdEnd + xDie * H.fade;
      hum.push({ memberId: m.id, part: m.part, voice: m.voice, pan: m.pew ? m.pew.x : 0, at: r4(t0 + at), dur: r4(end - at), f: V4[m.part].f });
    });
    // the harmonium takes up the opening, slower, over a held do
    var p0 = notes.filter(function (x) { return x.phrase === 0 && !x.slur; }), rn = tl.reed.map(function (x) { return { t: r4(t0 + x.t), dur: x.d, f: p0[x.of] ? p0[x.of].f : fHz, of: x.of }; });
    var gm = 0; rn.forEach(function (x) { gm += Math.log(x.f); }); gm = Math.exp(gm / Math.max(1, rn.length));
    var sh8 = Math.pow(2, Math.round(Math.log(300 / gm) / Math.LN2)), lowest = 1e9;
    rn.forEach(function (x) { x.f *= sh8; lowest = Math.min(lowest, x.f); });
    var droneF = K; while (droneF > lowest / 1.2) droneF /= 2; while (droneF * 2 <= lowest / 1.2) droneF *= 2;
    var reed = { notes: rn, drone: rn.length ? { f: droneF, t: rn[0].t, dur: r4(rn[rn.length - 1].t + rn[rn.length - 1].dur - rn[0].t) } : null };
    // the singer's own voice, moved: surer than on an ordinary Sunday, on her
    // own pitch (the song is hers), nobody's lateness to be late against
    var base = m0 ? m0.voice : { part: part, age: "mid", confidence: 0.8, brightness: 0.5, breath: 0.35, tractScale: 1 }, spec = {};
    for (var kk in base) spec[kk] = base[kk];
    spec.confidence = Math.max(0.86, spec.confidence || 0); spec.pitchHabitCents = 0; spec.timingHabitMs = 0;
    var pan = clamp((m0 && m0.pew ? m0.pew.x : 0) * 0.6, -0.5, 0.5);
    var stages = [
      { stage: "rises", t: t0 },
      { stage: "sings", t: lines[0].t0 },
      { stage: "the height", t: (lines.filter(function (l) { return l.peak; })[0] || lines[1]).t0 },
      { stage: "the ward hums", t: r4(t0 + H.first) },
      { stage: "the harmonium", t: rn.length ? rn[0].t : r4(t0 + H.full) },
    ];
    var gest = p0.slice(0, 8).map(function (x) { return x.deg - 7 * ko; });
    return {
      guest: NAME, mode: mode, keynoteHz: K, style: sh.style, part: part, singer: sid, singerNameDs: m0 ? m0.nameDs || null : null,
      singerSpec: spec, pan: pan, root: root, compass: [lo, hi], tongue: tg,
      final: { idx: fin, name: finName, f: fHz, deg: d7Of(c, fin) + 7 * ko }, chord: V4,
      lines: lines, notes: notes, hum: hum, reed: reed, stages: stages, gesture: gest,
      shape: { phrases: tl.phrases.length, melismas: notes.filter(function (x) { return x.slur; }).length },
      end: r4(t0 + tl.end), endNoReed: r4(t0 + tl.endNoReed), singerEnd: r4(t0 + tl.singerEnd),
    };
  }
  // gesture(score) → [[deg, …]]: the song's opening — the first syllables'
  // notes, in the Score's degrees from the mode's final — as the composer
  // takes the day's material for a hymn's first line (compose opts.gestures)
  function gesture(sc) { return [sc.gesture.slice()]; }

  // ==========================================================================
  // THE REED — the parlor harmonium's voice, after kolob-voices-winds.js's
  // (two sawtooth reeds a few cents apart through a still reed formant, the
  // bellows breathing), with a body beneath the formant, so a soft single
  // line is not thin. Used when the engine does not lend its own (hooks.harmonium).
  // ==========================================================================
  function reedLine(ctx, dest, notes, gain, R, drone) {
    if (!notes.length) return;
    var t = notes[0].t, end = notes[notes.length - 1].t + notes[notes.length - 1].dur;
    var mix = ctx.createGain(), bp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    mix.gain.value = 0.5;
    bp.type = "bandpass"; bp.frequency.value = 1500 + R.rnd(0, 700); bp.Q.value = 2.6;
    body.type = "lowpass"; body.frequency.value = 900; body.Q.value = 0.5;
    lp.type = "lowpass"; lp.frequency.value = 2600;
    var bpG = ctx.createGain(); bpG.gain.value = 0.9;
    mix.connect(bp); bp.connect(bpG); bpG.connect(lp); mix.connect(body); body.connect(lp); lp.connect(g);
    var os = [];
    for (var d = 0; d < 2; d++) {
      var o = ctx.createOscillator(); o.type = "sawtooth";
      var det = d ? 1 + R.rnd(0.002, 0.004) : 1 - R.rnd(0.002, 0.004);
      o.frequency.setValueAtTime(notes[0].f * det, t);
      notes.forEach(function (x, i) { if (i) { o.frequency.setValueAtTime(notes[i - 1].f * det, x.t - 0.012); o.frequency.linearRampToValueAtTime(x.f * det, x.t + 0.012); } });
      o.connect(mix); os.push(o);
    }
    var peak = gain * (drone ? 0.5 : 1), atk = drone ? 1.4 : 0.45, rel = drone ? 2.2 : 1.4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + atk);
    g.gain.setValueAtTime(peak, Math.max(t + atk, end - 0.2));
    g.gain.linearRampToValueAtTime(0, end + rel);
    // the bellows: a slow breath in the level (a gain of its own after the envelope)
    var bel = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    g.connect(bel); bel.connect(dest); bel.gain.value = 1;
    lfo.frequency.value = R.rnd(0.2, 0.38); lg.gain.value = 0.08;
    lfo.connect(lg); lg.connect(bel.gain);
    os.forEach(function (o) { o.start(t); o.stop(end + rel + 0.05); });
    lfo.start(t); lfo.stop(end + rel + 0.05);
  }

  // ==========================================================================
  // PERFORM — the singer phrase by phrase, the ward's hum in small handfuls,
  // the reed; each laid out a little before it sounds when the engine lends
  // its clock (hooks.defer), never a whole gift inside one callback
  // ==========================================================================
  var AHEAD = 2.5;
  // ARMING (VoicesVocal's): with the engine's clock, each line is built a
  // little ahead and joins the room only just before it sounds, each mouth
  // only around its own moments; one arm-tick cue at a time from t to the
  // end joins what is due and parts what has rung out (the ward's own pump
  // may call VoicesVocal.arm too: it is one queue). With no clock (an
  // offline render), every line joins at once.
  var ARM_STEP = 0.1, ARM_LEAD = 0.8;
  function armTicker(V, ctx, hooks, t, end) {
    if (!hooks.defer || !V.arm) return false;
    (function tick(at) {
      hooks.defer(at, function () {
        V.arm(ctx, at + ARM_LEAD, at);
        if (at < end + 1.5) tick(at + ARM_STEP);
      });
    })(t);
    return true;
  }
  function perform(ctx, dest, t, material, stream, hooks) {
    var V = window.KOLOB.VoicesVocal;
    if (!V || !V.singer) throw new Error("KOLOB.GuestTongues: load kolob-voices-vocal.js first");
    hooks = hooks || {};
    material = material || {};
    var sc = score(material, stream, t), synth = stream.fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    function later(at, fn) { if (hooks.defer && at - AHEAD > t) hooks.defer(at - AHEAD, fn); else fn(); }
    function stage(st) { if (hooks.onStage) later(st.t, function () { hooks.onStage({ stage: st.stage, t: st.t, guest: NAME }); }); }
    sc.stages.forEach(function (st, i) { if (i < 4 || material.harmonium !== false) stage(st); });
    var armed = armTicker(V, ctx, hooks, t, sc.end);
    // the singer
    var spec = {}; for (var k in sc.singerSpec) spec[k] = sc.singerSpec[k];
    spec.rand = synth.fork("singer"); spec.pan = sc.pan; spec.kind = "tongues"; spec.name = "tongues";
    var voice = V.singer(spec);
    sc.lines.forEach(function (ln) {
      later(ln.t0, function () {
        voice.sing(ctx, bus, ln.notes[0].t, ln.notes.map(function (x) { return { f: x.f, dur: x.dur, vowel: x.vowel, stress: x.stress, slur: !!x.slur }; }),
                   SING_GAIN, { breathBefore: ln.breathBefore, inhale: 0.9, pan: sc.pan, defer: armed });
        if (hooks.onNote) ln.notes.forEach(function (x) {
          hooks.onNote({ layer: "choir", freq: x.f, t: x.t, dur: x.dur, part: sc.part, member: sc.singer, role: "tongues", guest: NAME, deg: x.deg, monzo: x.monzo, syl: x.vowel, wordDs: x.wordDs, slur: !!x.slur });
        });
      });
    });
    // the ward's hum: eight at a time
    var hum = sc.hum.slice().sort(function (a, b) { return a.at - b.at; });
    for (var g0 = 0; g0 < hum.length; g0 += 8) (function (grp) {
      later(grp[0].at, function () {
        grp.forEach(function (h) {
          var hs = {}; for (var kk in h.voice) hs[kk] = h.voice[kk];
          hs.rand = synth.fork("hum:" + h.memberId); hs.sharedThroat = true; hs.sharedPan = true; hs.pan = h.pan; hs.name = "hum:" + h.memberId; hs.kind = "tongues-hum";
          V.singer(hs).sing(ctx, bus, h.at, [{ f: h.f, dur: h.dur, vowel: "hum", stress: 1 }], HUM_GAIN, { breathBefore: 0.6, breathe: false, defer: armed });
          if (hooks.onNote) hooks.onNote({ layer: "choir", freq: h.f, t: h.at, dur: h.dur, part: h.part, member: h.memberId, role: "hum", guest: NAME });
        });
      });
    })(hum.slice(g0, g0 + 8));
    // the harmonium
    var reedR = synth.fork("reed"), end = sc.end;
    if (material.harmonium === false || !sc.reed.notes.length) end = sc.endNoReed;
    else later(sc.reed.notes[0].t, function () {
      if (hooks.harmonium) { hooks.harmonium(sc.reed.notes[0].t, sc.reed.notes.map(function (x) { return { f: x.f, dur: x.dur }; }), REED_GAIN); if (sc.reed.drone) hooks.harmonium(sc.reed.drone.t, [{ f: sc.reed.drone.f, dur: sc.reed.drone.dur }], REED_GAIN * 0.5); }
      else { reedLine(ctx, bus, sc.reed.notes, REED_GAIN, reedR.fork("line"), false); if (sc.reed.drone) reedLine(ctx, bus, [sc.reed.drone], REED_GAIN, reedR.fork("drone"), true); }
      if (hooks.onNote) sc.reed.notes.forEach(function (x) { hooks.onNote({ layer: "harmonium", freq: x.f, t: x.t, dur: x.dur, part: "S", role: "tongues-reed", guest: NAME }); });
    });
    // when the room has let the last of it go, let the bus go
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain();
    sg.gain.value = 0; sent.connect(sg); sg.connect(bus);
    sent.onended = function () { try { sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) { /* gone */ } };
    sent.start(Math.max(0, t)); sent.stop(end + 4);
    perform.last = { score: sc, end: end };
    return end;
  }

  return {
    plan: plan, decide: decide, score: score, perform: perform, gesture: gesture, tongue: tongue, timeline: function (stream, house) { return timeline(shapeOf(stream, house)); },
    ODDS: ODDS, EXCLUDES: EXCLUDES, NAME: NAME, LABEL: LABEL, BLOCK: BLOCK,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-tongues.js"] = true;   // the load guard's roll call (round 3c)

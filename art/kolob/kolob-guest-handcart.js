// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE HANDCART COMPANY (KOLOB.GuestHandcart)
//
// From 1856 to 1860 some three thousand Saints walked from Iowa City to the
// Salt Lake Valley pulling handcarts: two wheels, a box, a crossbar to lean
// into, five hundred pounds of flour and bedding and children's shoes. They
// sang as they walked, and what they sang most was William Clayton's hymn of
// the 1846 trek, "Come, Come, Ye Saints", to the English tune the Saints
// call ALL IS WELL — "Gird up your loins, fresh courage take … All is well!
// All is well!" — the song of a people walking toward a place they had not
// yet seen.
//
// At the rim of Kolob's light a company still passes now and then, far off
// across the fields beyond the meetinghouse: first the carts — a dry axle
// creaking once a turn, iron tires on gravel, a knock where the ground is
// rutted — and then, when they are nearer, the leader strikes up and the
// company sings ALL IS WELL in unison as it walks (the men an octave under
// the women, a child among them), a verse or two, and passes, and the
// singing goes on out of hearing while the wheels are still faintly heard.
// It never comes near. The meeting inside hushes to listen (the house rests
// its hands; the drone and the valley stay): it is the pastoral cousin of
// the bands, and never comes on a Sunday the band marches.
//
// THE TUNE is the Earth tune in kolob-tunes.js ("earth:all-is-well", the
// 1889 Psalmody's No. 327, pitch for pitch the Saints' ALL IS WELL), in 3/4
// at a walking pace — a step a beat, a turn of the wheel a bar. The company
// sings it where a walking company would pitch it (its do near A-flat, as
// the hymnbook has it), in the day's own key or its dominant's or
// subdominant's, whichever lies there: a key the day's drone agrees with.
// The words are Clayton's (verse 1, and verse 4 when they sing a second:
// "And should we die before our journey's through, Happy day! All is
// well!"), sung — at that distance — as their vowels.
//
// THE ROAD is the band's (KOLOB.VoicesBand.road): the company is a point on
// a road far across the fields, nearest (0.48–0.6 on the distance scale:
// always far off) about half way through; the town's air and the echo off
// the houses are the band's too.
//
// PURE PLANNING. plan(), decide(), prepare() and score() touch no
// AudioContext, DOM, clock or Math.random: every die is the stream's —
// guest:handcart:<n>, forked "seat" (the odds, the section, the moment),
// "shape" (the verses, the pace, the road, the carts, the company), and
// "synth" (the singers' own throats, the axles' creak). perform() reads no
// clock: everything is placed at or after the t it is given, a line at a
// time through hooks.defer, a little ahead of the sound.
//
// Public surface: window.KOLOB.GuestHandcart
//   plan(meetingInfo, stream) → { guest: "handcart", seat, section, at, dur,
//        holdUntil, verses, odds, logged: true } | null
//     meetingInfo: { n, kind, sunday?, sections: [{type, dur}],
//       guests: [{type, section}], force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   prepare(material, stream) → the company's passage (pure; material)
//     material: { homeHz (the day's tonic; else keynoteHz), tune? (a SCORE
//       Hymn; else KOLOB.Tunes' ALL IS WELL) }
//   score(material, stream, t0) → the whole passage as data (pure)
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onNote({freq, t, dur, part, voice, verse,
//              line, beat, syl, loud}), onStage({stage, t0, side, label,
//              detail}), only: "carts" | "singers" (a lab's) }
//   ODDS, EXCLUDES, SEATS, LEVEL, LABEL, NAME, VOWELS
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestHandcart = (function () {
  "use strict";

  var NAME = "handcart";
  var LABEL = "guest:handcart:";                  // the stream's label: + the meeting number

  // ==========================================================================
  // THE ODDS — a starting point, for the owner's ear
  // ==========================================================================
  // About one meeting in twenty over the calendar; on Pioneer Day (the
  // handcarts remembered: kolob-calendar.js's own words for the day) the odds
  // are 0.6 — the band marches on three Pioneer Days in four and the company
  // never comes with it, so about one Pioneer Day in seven hears the carts;
  // a funeral now and then ("all is well" is a funeral's hymn); seldom at
  // Christmas (no one walks the plains in the snow). It is refused whenever
  // the band is seated (the band is planned first).
  var ODDS = {
    base: 0.07,
    weight: {
      ordinary: 1, fast: 0.7, conference: 1, jubilee: 1.5,
      pioneer: 8.5, funeral: 2.4, christmas: 0.3, easter: 1, wedding: 0.7, dedication: 0.6,
    },
    cap: 0.6,
  };
  var EXCLUDES = ["bands"];                       // one procession a Sunday
  var MAX_GUESTS = 2;                             // a meeting's guests, at most (PLAN §8: 0–2)
  // where it passes: the gathering, a quiet rite, or as the room empties;
  // the sacrament only at a funeral. A section a guest holds, or one next to
  // it, is passed over (PLAN §8.13).
  var SEATS = [["prelude", 1], ["testimony", 1], ["interlude", 0.8], ["postlude", 1.2]];
  var FUNERAL_SEATS = [["sacrament", 1.4], ["prelude", 0.8], ["testimony", 1], ["postlude", 1]];
  var AT = [0.1, 0.35], AT_MIN = 6;
  // the company's bus into the tabernacle's wide send (calibrated in the lab
  // against the organ reference: the handoff's table)
  var LEVEL = 0.74;
  var NEAR_EVEN = 0.54;
  var RISE_DB = -14;                              // over the rise, by the time the wheels are gone

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestHandcart: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function oddsFor(info) {
    var w = ODDS.weight, k = info.sunday && w[info.sunday] != null ? info.sunday : info.kind;
    return Math.min(ODDS.cap, ODDS.base * (w[k] != null ? w[k] : 1));
  }
  // ==========================================================================
  // THE SHAPE — the musical dice of one passage, all drawn, in order
  // ==========================================================================
  function shapeOf(stream) {
    var r = need(stream).fork("shape");
    return {
      verses: r.pickW([[2, 3], [1, 1]]),
      beatS: r.rnd(0.56, 0.66),            // a step a beat: a walking pace
      hold: r.rnd(1.15, 1.5),              // how long a walking company holds a fermata
      fromWest: r.chance(0.5),
      nearD: r.rnd(0.48, 0.6),             // always far off
      farD: r.rnd(0.9, 0.97),
      crossAt: r.rnd(0.45, 0.6),
      leadIn: r.rnd(5, 9),                 // the carts heard before anyone sings
      tail: r.rnd(7, 11),                  // …and after
      gap: r.pickW([[1, 2], [2, 1]]),      // bars walked between two verses
      carts: r.pickW([[2, 3], [3, 1]]),
      creak: r.rnd(0.45, 0.8),
      leader: r.chance(0.75),              // the captain strikes up the first line alone
      leaderLow: r.chance(0.6),            // …a bass, else a tenor
      child: r.chance(0.65),               // a child among them, a hair behind
      childLate: r.rnd(0.06, 0.16),
    };
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next(), seatDie = rs.next(), atU = rs.next();       // every die, first
    var sh = shapeOf(stream);
    var p = oddsFor(info), why = null;
    var secs = info.sections || [], guests = info.guests || [];
    function has(fn) { for (var j = 0; j < guests.length; j++) if (guests[j] && fn(guests[j])) return true; return false; }
    // a section is free when no guest holds it or either neighbour
    function free(i) {
      var near = [secs[i - 1], secs[i], secs[i + 1]].filter(Boolean).map(function (s) { return s.type; });
      return !has(function (g) { return g.type !== NAME && near.indexOf(g.section) >= 0; });
    }
    var funeral = info.sunday === "funeral" || info.kind === "funeral";
    var pool = [], tot = 0;
    (funeral ? FUNERAL_SEATS : SEATS).forEach(function (sw) {
      for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === sw[0]) { if (free(i)) { pool.push([i, sw[1]]); tot += sw[1]; } break; }
    });
    var pick = null, x = seatDie * tot;
    for (var k = 0; k < pool.length && pick == null; k++) { x -= pool[k][1]; if (x <= 1e-12) pick = pool[k][0]; }
    if (pick == null && pool.length) pick = pool[pool.length - 1][0];
    // (a meeting carries two guests at most, PLAN §8: planned after every
    // other guest, the company never makes a third — unless it was asked for)
    var others = guests.filter(function (g) { return g && g.type !== NAME; }).length;
    if (has(function (g) { return EXCLUDES.indexOf(g.type) >= 0; })) why = "the band is marching";
    else if (others >= MAX_GUESTS && !info.force) why = "two guests already";
    else if (pick == null) why = "no quiet rite free";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var sec = secs[pick], secDur = sec.dur > 0 ? sec.dur : 90;
    var at = Math.max(AT_MIN, secDur * (AT[0] + (AT[1] - AT[0]) * atU));
    var dur = score(info.material || {}, stream, 0).end;
    return {
      seat: {
        guest: NAME, seat: sec.type, section: sec.type, at: +at.toFixed(2), dur: +dur.toFixed(2),
        holdUntil: +(at + dur + 2).toFixed(2), verses: sh.verses, odds: +p.toFixed(3), logged: true,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE WORDS, AS THEIR VOWELS (William Clayton, 1846): verse 1, and verse 4
  // for a second — one vowel a syllable, the throat's five (ah oh oo ee eh)
  // ==========================================================================
  var VOWELS = [
    [ // Come, come, ye Saints, no toil nor labor fear; / But with joy wend your way. / Though hard to you this journey may appear, / Grace shall be as your day. / 'Tis better far for us to strive / Our useless cares from us to drive; / Do this, and joy your hearts will swell— / All is well! All is well!
      "ah ah ee eh oh oh oh eh oh ee", "ah ee oh eh oo eh", "oh ah oo oo ee eh ee eh ah ee", "eh ah ee ah oo eh",
      "ee eh eh ah oh ah oo ah", "ah oo eh eh ah ah oo ah", "oo ee ah oh oo ah ee eh", "ah ee eh ah ee eh"],
    [ // And should we die before our journey's through, / Happy day! All is well! / We then are free from toil and sorrow, too; / With the just we shall dwell! / But if our lives are spared again / To see the Saints their rest obtain, / Oh, how we'll make this chorus swell— / All is well! All is well!
      "ah oo ee ah ee oh ah eh ee oo", "ah ee eh ah ee eh", "ee eh ah ee ah oh ah ah oh oo", "ee ah ah ee ah eh",
      "ah ee ah ah ah eh ah eh", "oo ee ah eh eh eh ah eh", "oh ah ee eh ee oh ah eh", "ah ee eh ah ee eh"],
  ].map(function (v) { return v.map(function (l) { return l.split(" "); }); });

  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function tuneOf(material) {
    var h = material.tune || (window.KOLOB.Tunes && window.KOLOB.Tunes.byId ? window.KOLOB.Tunes.byId("earth:all-is-well") : null);
    if (!h || !h.lines) throw new Error("KOLOB.GuestHandcart: ALL IS WELL is not to be had (load kolob-tunes.js)");
    return h;
  }
  // where a walking company pitches it: the tune's middle near A-flat above
  // middle C (415 Hz, as the hymnbook has it), in the day's own key or its
  // dominant's or subdominant's — whichever octave of the three lies nearest.
  // → the frequency of the tune's 1/1 (a note sounds at it × its monzo)
  var PITCH_MID = 415, KEYS = [[1, 0], [3 / 2, 0.04], [4 / 3, 0.06]];
  function companyBase(homeHz, mid) {
    var best = null;
    KEYS.forEach(function (k) {
      var f = homeHz * k[0], g = f * Math.pow(2, Math.round(Math.log(PITCH_MID / (f * mid)) / Math.LN2));
      var cost = Math.abs(Math.log(g * mid / PITCH_MID) / Math.LN2) + k[1];
      if (!best || cost < best.cost) best = { base: g, key: k[0], cost: cost };
    });
    return best;
  }

  // ==========================================================================
  // PREPARE — the company's verses, in seconds from the first sung note (pure)
  // ==========================================================================
  function prepare(material, stream) {
    material = material || {};
    if (material.prepared) return material;
    var sh = shapeOf(stream), h = tuneOf(material), mp = h.melodyPart || "S";
    var home = material.homeHz || material.keynoteHz || 260;
    var src = h.lines.map(function (L) { return (L.notes[mp] || L.notes.S || []).filter(function (n) { return n && n.monzo && n.beats > 0; }).map(function (n) { return { beat: L.startBeat + n.beat, beats: n.beats, monzo: n.monzo, syl: n.syl, fermata: !!n.fermata }; }); });
    var rs = []; src.forEach(function (ln) { ln.forEach(function (n) { rs.push(ratio(n.monzo)); }); });
    var mid = Math.sqrt(Math.min.apply(null, rs) * Math.max.apply(null, rs)), cb = companyBase(home, mid);
    var lines = [], t = 0, bs = sh.beatS, verseLen = 0;
    for (var v = 0; v < sh.verses; v++) {
      var extra = 0, v0 = t;
      src.forEach(function (ln, li) {
        var vw = (VOWELS[v % VOWELS.length][li] || ["ah"]), k = -1, notes = [], lt0 = null, lastVowel = "ah";
        ln.forEach(function (n) {
          var on = v0 + (n.beat - src[0][0].beat) * bs + extra;
          var d = n.beats * bs * (n.fermata ? sh.hold : 1);
          if (n.fermata) extra += n.beats * bs * (sh.hold - 1);
          if (n.syl != null) { k++; lastVowel = vw[Math.min(k, vw.length - 1)] || "ah"; }
          if (lt0 == null) lt0 = on;
          notes.push({ t: on, dur: d, f: cb.base * ratio(n.monzo), vowel: lastVowel, slur: n.syl == null, beat: n.beat, syl: n.syl });
        });
        // (a breath at the end of the line: its last note lets go a little early)
        var last = notes[notes.length - 1];
        if (last && li < src.length - 1) last.dur = Math.max(last.dur * 0.6, last.dur - 0.18);
        lines.push({ verse: v, line: li, t0: lt0, t1: last ? last.t + last.dur : lt0, notes: notes });
      });
      var lastLine = lines[lines.length - 1];
      t = lastLine.t1 + sh.gap * 3 * bs;              // (walking on a bar or two before the next verse)
      if (!verseLen) verseLen = lastLine.t1 - v0;
    }
    return { prepared: true, shape: sh, base: cb.base, key: cb.key, homeHz: home, lines: lines, singS: lines[lines.length - 1].t1, verseS: verseLen, tuneId: h.id || null };
  }

  // ==========================================================================
  // SCORE — the passage as data (pure): the road, who sings which line, when
  // ==========================================================================
  var R0 = 6, RSPAN = 80;
  function dOfR(r) { return Math.max(0, Math.min(1, Math.log(r / R0) / Math.log(RSPAN))); }
  function rOfD(d) { return R0 * Math.pow(RSPAN, d); }
  function score(material, stream, t0) {
    t0 = t0 || 0;
    var P = prepare(material, stream), sh = P.shape;
    var sing0 = t0 + sh.leadIn, end = sing0 + P.singS + sh.tail, len = end - t0, tc = sh.crossAt * len;
    var D = rOfD(sh.nearD), vel = Math.sqrt(Math.max(1, rOfD(sh.farD) * rOfD(sh.farD) - D * D)) / Math.max(1, tc), sign = sh.fromWest ? 1 : -1, path = [];
    function at(tt) { var x = vel * (tt - tc), r = Math.sqrt(D * D + x * x); return { t: +(t0 + tt).toFixed(3), d: +dOfR(r).toFixed(4), side: +(sign * 0.85 * x / r).toFixed(4) }; }
    for (var tt = 0; tt < len + 1; tt += 1) path.push(at(tt));
    function dAt(x) { var i = Math.max(0, Math.min(path.length - 2, Math.floor(x - t0))), a = path[i], b = path[i + 1]; return a.d + (b.d - a.d) * Math.max(0, Math.min(1, (x - a.t) / (b.t - a.t))); }
    // OVER THE RISE: past its nearest point the road takes the company over
    // the rise beyond the fields — RISE_DB more by the time the wheels are
    // gone, deepening with the square of the way gone (the distance stage's
    // scale ends at the colony's far end, 13.5 dB down: no road alone
    // carries a song out of hearing) → dB at x (absolute)
    function riseDb(x) { var u = Math.max(0, Math.min(1, (x - t0 - tc) / Math.max(1, len - tc))); return RISE_DB * u * u; }
    // who sings: the leader alone on the first line (when he strikes up),
    // then everyone; the child from the second line, a hair behind
    var parts = [];
    P.lines.forEach(function (L, i) {
      var first = L.verse === 0 && L.line === 0;
      function put(voice, mul, late) {
        parts.push({ voice: voice, verse: L.verse, line: L.line, t0: sing0 + L.t0 + late, notes: L.notes.map(function (n) {
          var x = sing0 + n.t;
          return { t: x + late, dur: n.dur, f: n.f * mul, vowel: n.vowel, slur: n.slur, beat: n.beat, syl: n.syl,
                   loud: +(Math.max(0, Math.min(1, (0.99 - dAt(x)) / (0.99 - sh.nearD))) * Math.pow(10, riseDb(x) / 20)).toFixed(3) };
        }) });
      }
      // (the captain, a bass or a tenor, sings the tune where the men do, an
      // octave under the women: an octave lower still, the tune's foot would
      // lie near 65 Hz, under any bass's walking voice — a bass captain is
      // told by his throat, darker and heavier, not by his octave)
      if (sh.leader && first) { put("leader", 0.5, 0); return; }
      put("women", 1, 0);
      put("men", 0.5, 0);
      if (sh.leader) put("leader", 0.5, 0);
      if (sh.child && i >= 1) put("child", 1, sh.childLate);
    });
    var side = sh.fromWest ? "west" : "east";
    var stages = [
      { stage: "approaches", t0: t0, side: side, label: "⇋ a handcart company", detail: "from the " + side + " · the wheels" },
      { stage: "sings", t0: sing0, side: side, label: "♪ all is well", detail: sh.leader ? "the captain strikes up" : "the company sings" },
      { stage: "passes", t0: t0 + tc, side: side, label: "⇋ the handcarts pass", detail: "far across the fields" },
      { stage: "gone", t0: end, side: sh.fromWest ? "east" : "west", label: "⇋ out of hearing", detail: "" },
    ];
    // (the rise as points a second apart, for perform's gain)
    var rise = [];
    for (var rt = tc; rt < len + 1; rt += 1) rise.push({ t: +(t0 + Math.min(rt, len)).toFixed(3), db: +riseDb(t0 + Math.min(rt, len)).toFixed(2) });
    return { start: t0, end: end, sing0: sing0, path: path, rise: rise, parts: parts, stages: stages, prepared: P, tc: t0 + tc, beatS: sh.beatS };
  }

  // ==========================================================================
  // PERFORM — the carts and the company on their road, placed at t
  // ==========================================================================
  // The company is four pews of the ward's own voice (KOLOB.VoicesVocal: two
  // of women on the tune, a pew of tenors and one of basses an octave under
  // it), the captain, and a child; the carts are KOLOB.VoicesFolk's wheels,
  // standing still in the company while the road carries them all. Each
  // group's line is laid out AHEAD seconds before it is sung, one throat to
  // a callback (hooks.defer), STAGGER apart; each cart's whole roll in one
  // callback of its own.
  var AHEAD = 2.5, STAGGER = 0.06, G_DESK = 0.42, G_LEAD = 0.7, G_CHILD = 0.5, G_CARTS = 0.55;
  function perform(ctx, dest, t, material, stream, hooks) {
    var K = window.KOLOB, VB = K.VoicesBand, VV = K.VoicesVocal, VF = K.VoicesFolk;
    if (!VB || !VB.road) throw new Error("KOLOB.GuestHandcart: load kolob-voices-band.js first");
    if (!VV || !VV.desk || !VF) throw new Error("KOLOB.GuestHandcart: load kolob-voices-vocal.js and kolob-voices-folk.js first");
    hooks = hooks || {};
    var sc = score(material, stream, t), sh = sc.prepared.shape, synth = need(stream).fork("synth");
    // (the company is heard at about the same level whichever road it took:
    // half of what its nearest point gave or took, against a road at 0.54,
    // given back — the trombones' NEAR_EVEN)
    var trim = VB.distanceDb ? 0.5 * (VB.distanceDb(NEAR_EVEN) - VB.distanceDb(sh.nearD)) : 0;
    // (…and whoever is in it: a company with no captain or no child is a
    // throat or two fewer, and half of what they would have added is given back)
    var full = 4 * G_DESK * G_DESK + G_LEAD * G_LEAD + G_CHILD * G_CHILD;
    var here = 4 * G_DESK * G_DESK + (sh.leader ? G_LEAD * G_LEAD : 0) + (sh.child ? G_CHILD * G_CHILD : 0);
    if (hooks.only !== "carts") trim += 0.5 * 10 * Math.log10(full / here);
    var bus = ctx.createGain(), lvl = LEVEL * Math.pow(10, trim / 20); bus.gain.value = lvl; bus.connect(dest);
    // (over the rise: the company's gain follows the score's rise, a point a second)
    sc.rise.forEach(function (p, i) {
      var g = lvl * Math.pow(10, p.db / 20);
      if (i === 0) bus.gain.setValueAtTime(g, Math.max(t, p.t)); else bus.gain.linearRampToValueAtTime(g, p.t);
    });
    // (the town's air borrowed: made ahead by VoicesBand.warm, never in a callback)
    var town = VB.lendTown ? VB.lendTown(ctx, bus, { seconds: 2.6 }) : VB.townRoom(ctx, bus, { seconds: 2.6 });
    var rd = VB.road(ctx, bus, { room: town, echoDelay: synth.rnd(0.19, 0.31) });
    rd.path(sc.path);
    var folk = null;
    function later(at, fn) { if (hooks.defer && at > t) hooks.defer(at, fn); else fn(); }
    if (hooks.only !== "singers") {
      folk = VF.create(ctx, rd.input, { rand: synth.fork("carts"), gain: G_CARTS });
      // (the carts roll from 0.8 s in — far off, no one hears them start — each
      // laid out in a callback of its own, before any line is)
      for (var c = 0; c < sh.carts; c++) (function (c) {
        later(t + 0.3 + 0.15 * c, function () { folk.wheels(t + 0.8, sc.end - t - 0.8, { beat: 1.5 * sh.beatS, carts: sh.carts, creak: sh.creak, still: true, spread: 0.3, only: c }); });
      })(c);
    }
    var throats = null;
    if (hooks.only !== "carts") {
      var who = synth.fork("company");
      function pew(part, name, pan) {
        return VV.desk({ part: part, voices: 3, rand: who.fork(name), name: "handcart-" + name, age: who.pick(["young", "mid", "mid", "old"]),
                         confidence: who.rnd(0.6, 0.85), brightness: who.rnd(0.35, 0.55), breath: who.rnd(0.12, 0.22),
                         lag: who.rnd(0, 0.05), spreadMs: who.rnd(18, 34), detuneCents: who.rnd(7, 12), pan: pan });
      }
      throats = {
        women: [[pew("S", "women-1", -0.18), G_DESK], [pew("A", "women-2", 0.08), G_DESK]],
        men: [[pew("T", "men-1", 0.16), G_DESK], [pew("B", "men-2", -0.06), G_DESK]],
        leader: [[VV.singer({ part: sh.leaderLow ? "B" : "T", age: "mid", confidence: 0.95, brightness: 0.55, breath: 0.2, rand: who.fork("leader"), name: "handcart-captain", pan: 0 }), G_LEAD]],
        child: [[VV.singer({ part: "child", age: "young", confidence: 0.7, brightness: 0.6, breath: 0.2, rand: who.fork("child"), name: "handcart-child", pan: 0.12 }), G_CHILD]],
      };
      // (a throat's first line costs it about twice what its next does —
      // its people's waves made, its mouth's first shapes — so each sings
      // one note into nothing first, in a callback of its own, a second in,
      // long before the company strikes up: measured, a first line primed
      // costs 0.5–1.0 ms where a cold one cost 0.8–2.2)
      var hush = ctx.createGain(); hush.gain.value = 0;
      Object.keys(throats).forEach(function (v, i) {
        throats[v].forEach(function (th, k) {
          var j = i * 2 + k;
          later(t + 1 + STAGGER * j, function () { th[0].sing(ctx, hush, t + 2 + 0.1 * j, [{ f: 220, dur: 0.1, vowel: "ah" }], 0); });
        });
      });
      // (each throat's line a callback of its own, and each at a moment of
      // its own: the engine's clock fires every cue inside its quarter-second
      // look-ahead in one wake, so the throats of a line — the women's two
      // pews, the men's two, the captain, the child — are laid STAGGER
      // apart, the first AHEAD seconds before the line is sung)
      var nth = {}, lineAt = {};
      sc.parts.forEach(function (p) {
        var key = p.verse + ":" + p.line;
        if (lineAt[key] == null) { lineAt[key] = p.t0; nth[key] = 0; }
        (throats[p.voice] || []).forEach(function (th, k) {
          later(lineAt[key] - AHEAD + STAGGER * nth[key]++, function () {
            th[0].sing(ctx, rd.input, p.notes[0].t, p.notes.map(function (n) { return { f: n.f, dur: n.dur, vowel: n.vowel, slur: n.slur }; }), th[1]);
            if (k === 0 && hooks.onNote) p.notes.forEach(function (n) {
              hooks.onNote({ freq: n.f, t: n.t, dur: n.dur, part: "tune", voice: p.voice, verse: p.verse, line: p.line, beat: n.beat, syl: n.syl, loud: n.loud, octave: p.voice === "men" || p.voice === "leader" ? -1 : 0 });
            });
          });
        });
      });
    }
    if (hooks.onStage) sc.stages.forEach(function (st) { hooks.onStage(st); });
    // when the last of the town's air has died, let the road and the town go
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator();
    var sg = ctx.createGain(); sg.gain.value = 0;
    sent.connect(sg); sg.connect(bus);
    sent.onended = function () { rd.dispose(); town.dispose(); try { sg.disconnect(); sent.disconnect(); bus.disconnect(); } catch (e) {} };
    sent.start(Math.max(0, t)); sent.stop(sc.end + 5);
    perform.last = { score: sc, folk: folk, road: rd, throats: throats };
    return sc.end;
  }

  // ==========================================================================
  // WARM — the company's throat, sung once and silently, before any company
  // can pass (at the engine's start-up, beside VoicesBand.warm)
  // ==========================================================================
  // The first line any voice of KOLOB.VoicesVocal sings in a context bakes
  // the breath's noise and compiles the voice (5–7 ms of main thread,
  // measured, where a warm line costs under 2), and the first line that
  // BREATHES bakes the inhale (1.9 MB, and 5–16 ms in a live page: it was
  // the company's second line, every time). The carts' first roll bakes the
  // folk voice's noise the same way. In a meeting that has not yet sung — a
  // company passing in the prelude — each would land in one wake of the
  // clock. So here, at the button press: one short line with a breath in
  // it, sung into a gain of nothing, and the carts' noise; the company
  // finds its throats warm and its wheels greased. (Its own stream, not the
  // meeting's: no die of the meeting is drawn.)
  function warm(ctx) {
    var K = window.KOLOB, VV = K.VoicesVocal, R = window.PJ2 && window.PJ2.Rand;
    if (!ctx || !VV || !VV.singer || !R || ctx.__kolobHandcartWarm) return false;
    ctx.__kolobHandcartWarm = true;
    if (K.VoicesFolk && K.VoicesFolk.warm) K.VoicesFolk.warm(ctx);
    var hush = ctx.createGain(); hush.gain.value = 0;
    var s = VV.singer({ part: "T", age: "mid", confidence: 0.9, brightness: 0.5, breath: 0.2, rand: R.stream(0x5a17).fork("handcart:warm"), name: "handcart-warm", pan: 0 });
    s.sing(ctx, hush, ctx.currentTime + 0.6, [{ f: 220, dur: 0.25, vowel: "ah" }, { rest: true, dur: 0.45 }, { f: 247, dur: 0.25, vowel: "ee" }], 0,
           { breathBefore: 0.45, inhale: 1 });
    return true;
  }

  return {
    plan: plan, decide: decide, prepare: prepare, score: score, perform: perform, shape: shapeOf, warm: warm,
    ODDS: ODDS, EXCLUDES: EXCLUDES, MAX_GUESTS: MAX_GUESTS, SEATS: SEATS, NAME: NAME, LABEL: LABEL, VOWELS: VOWELS,
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-handcart.js"] = true;   // the load guard's roll call (round 3c: the handcart company)

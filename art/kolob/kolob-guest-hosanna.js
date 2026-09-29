// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE HOSANNA (KOLOB.GuestHosanna)
//
// At the dedication of the Kirtland Temple, on the 27th of March 1836, the
// congregation stood, and at the word of the one presiding they shouted,
// together, "Hosanna, Hosanna, Hosanna, to God and the Lamb", three times,
// and sealed it "Amen, Amen, and Amen"; and then they sang W. W. Phelps's
// new hymn, "The Spirit of God like a fire is burning". Every temple of the
// Latter-day Saints has been dedicated so since: the Hosanna Shout, white
// handkerchiefs waving, and then "The Spirit of God", the whole house
// singing with the organ full.
//
// At the rim of Kolob's light it is kept for the two days that are most
// like a dedication: Easter, and the dedication of a house. It is not
// announced and not written down (the owner's ruling, PLAN §8.12): no row in
// the minutes, no direction on the hymn board, no word on the staff for the
// shout. It just happens, low-key, at the close of the doxology — the ward
// on its feet — and is over.
//
// THE SHOUT. The whole ward (the thirty-two, and the Primary's children
// when they are seated) shouts the three-fold Hosanna and the amens as one
// crowd: each person in their own speaking voice raised (a pressed, brighter
// source — VoicesVocal's `effort`, round 3c), on their own pitch, a moment
// early or late against the rest, each syllable a spoken contour (the
// stressed "SAN" and "GOD" higher, "LAMB" falling away) rather than a sung
// note — so what is heard is a massed crowd on vowel formants, "Ho-san-na"
// and not a chord. The rhythm and the three-fold shape are the thing: the
// three shouts rising a little each time, the room ringing between them.
// No intelligible English is asked for; the syllables are the voices' own
// sounds (h-oh, s-ah, n-ah …), the s said lightly by a crowd.
//
// THE HYMN. Then THE SPIRIT OF GOD — ASSEMBLY, the Earth tune in
// kolob-tunes.js, in the day's key — by the full ward in its four parts and
// the full organ: the organ gives out the last line, and the ward sings the
// first verse and the chorus, the vowels of Phelps's own words (1836), the
// chorus's second line on the shout's own syllables — "Ho-san-na, ho-san-na
// to God and the Lamb" — and the last on its amens. A broadening at the end.
//
// THE SEAT. plan(meetingInfo, stream) decides: ONLY on Easter or a
// dedication (the calendar's `hosanna` hook; nothing, not even the dev
// force, seats it on another Sunday); on nearly every dedication and about
// half of Easters; at the close of the (last) doxology. Its die is the one
// the meeting already throws for the hook: stream guest:hosanna:<n>, fork
// "seat", its first next() — so building it moves nothing else.
//
// UNLOGGED. `logged: false` on the seat and on every stage it tells
// (hooks.onStage); it emits nothing of its own. The hymn's written notes are
// offered to hooks.onNote with `hosanna: true` (PLAN §8.12: "the hymn is
// engraved normally; the shout is not engraved" — the shout offers none),
// marked logged: true while ENGRAVE_HYMN stands (the owner's switch: false
// hides the hymn from the staff too, the Hosanna then wholly audio-only).
//
// PURE PLANNING. plan(), decide(), score() and words() touch no
// AudioContext, DOM, clock or Math.random; the dice live on forks of the
// guest's stream: "seat", "shape", "crowd", "hymn", "synth". perform()
// reads no clock: it lays the shout and the hymn out a line at a time
// through hooks.defer, a few seconds before each sounds.
//
// Public surface: window.KOLOB.GuestHosanna
//   plan(meetingInfo, stream) → { guest: "hosanna", seat: "doxology",
//        section: "doxology", sectionIndex, at: "close", dur, verses, odds,
//        logged: false } | null
//     meetingInfo: { n, kind, sunday, sections: [{type}], force? }
//   decide(meetingInfo, stream) → { seat, why, odds, roll }
//   score(material, stream, t0) → the shout and the hymn as data (pure)
//     material: { keynoteHz, ward? (KOLOB.Cast's), tune? (default
//                 KOLOB.Tunes.byId("earth:assembly")) }
//   perform(ctx, dest, t, material, stream, hooks?) → end time (s, absolute)
//     hooks: { defer(at, fn), onStage(st) (every one logged: false),
//              onNote(n) (the hymn's notes only), organDest (the organ's
//              own way into the rooms; else dest) }
//   words() → the syllables the ward sings ASSEMBLY's verse and chorus on
//   ODDS, NAME, LABEL, LOGGED (false), ENGRAVE_HYMN, LEVEL
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.GuestHosanna = (function () {
  "use strict";

  var NAME = "hosanna";
  var LABEL = "guest:hosanna:";
  var LOGGED = false;                              // the owner's ruling: never told
  var ENGRAVE_HYMN = true;                         // PLAN §8.12: the hymn engraved, the shout not

  // ==========================================================================
  // THE ODDS — only two Sundays; everywhere else, never
  // ==========================================================================
  var ODDS = { weight: { dedication: 0.95, easter: 0.5 }, cap: 0.95 };
  function mayCome(info) {
    // the calendar's own hook (kolob-calendar.js SUNDAYS[id].hosanna), else the two by name
    var Cal = window.KOLOB.Calendar, sun = info && info.sunday;
    if (!sun) return false;
    if (Cal && Cal.SUNDAYS && Cal.SUNDAYS[sun]) return !!Cal.SUNDAYS[sun].hosanna;
    return sun === "easter" || sun === "dedication";
  }
  function oddsFor(info) { return mayCome(info) ? Math.min(ODDS.cap, ODDS.weight[info.sunday] != null ? ODDS.weight[info.sunday] : 0.5) : 0; }
  // the bus: the shout and the ward calibrated in guests3c-lab against the
  // organ reference (the shout's loudest 3 s about level with it; the hymn,
  // full organ and full ward, 2–3 LU over it, as a doxology on full organ is)
  var LEVEL = 1.0;
  // (measured, seed 7: the shout at 0.05 a voice sat 6.7 LU under the
  // reference — a whisper of a crowd; at 0.09, about 1.5 LU under it. The
  // hymn at 0.057 a voice and the organ at 0.8 sat level with it; a shade up)
  var SHOUT_GAIN = 0.09, WARD_GAIN = 0.064, ORGAN_GAIN = 1.0;
  // THE WORDS' CONSONANTS in the hymn: "all" (the words' voiced consonants,
  // as written), "liquids" (l, m, n and h only: the stops, r, w and y folded
  // into their vowels — about a third fewer nodes a singer), "none" (vowels,
  // as the ward sings every other hymn). The owner's to choose by ear and cost.
  var HYMN_CONSONANTS = "all";
  function sounded(syl) {
    if (HYMN_CONSONANTS === "all") return syl;
    var x = String(syl).split("-"), keep = HYMN_CONSONANTS === "liquids" ? { l: 1, m: 1, n: 1, h: 1 } : {};
    var V5 = { ah: 1, oh: 1, oo: 1, ee: 1, eh: 1 };
    return x.filter(function (p) { return V5[p] || keep[p]; }).join("-") || "ah";
  }

  function need(stream) {
    if (!stream || typeof stream.fork !== "function") throw new Error("KOLOB.GuestHosanna: a PJ2.Rand stream is required (label " + LABEL + "<n>)");
    return stream;
  }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function r4(x) { return Math.round(x * 1e4) / 1e4; }
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }

  // ==========================================================================
  // THE SHAPE — the shout's pace and rise, the room's breath between, the
  // hymn's pace and its broadening (every die, in order)
  // ==========================================================================
  function shapeOf(stream, sunday) {
    var r = need(stream).fork("shape");
    return {
      hush: r.rnd(1.6, 2.6),                      // the ward rises; the doxology's last chord clears the room
      pace: r.rnd(0.92, 1.08),                    // the one presiding's pace for the shout
      between: [r.rnd(1.1, 1.6), r.rnd(1.1, 1.6)],   // the room rings between the three
      rise: r.rnd(0.6, 1.2),                      // semitones each shout rises over the one before
      amenGap: r.rnd(0.5, 0.8),
      settle: r.rnd(2.2, 3.4),                    // the room settles before the organ
      tempo: r.rnd(0.95, 1.04) * (sunday === "dedication" ? 0.97 : 1),
      broaden: r.rnd(0.18, 0.32),                 // the last line's ritardando
    };
  }

  // ==========================================================================
  // THE SEAT
  // ==========================================================================
  function decide(info, stream) {
    info = info || {};
    var rs = need(stream).fork("seat");
    var roll = rs.next();                          // (the hook's die: kolob-meeting.js throws exactly this)
    var p = oddsFor(info), why = null, secs = info.sections || [], di = -1;
    for (var i = 0; i < secs.length; i++) if (secs[i] && secs[i].type === "doxology") di = i;
    if (!mayCome(info)) why = "not Easter or a dedication";
    else if (di < 0) why = "no doxology";
    else if (!(info.force || roll < p)) why = "not this Sunday";
    if (why) return { seat: null, why: why, odds: p, roll: roll };
    var tl = timeline(shapeOf(stream, info.sunday), tuneOf(info.material));
    return {
      seat: {
        guest: NAME, seat: "doxology", section: "doxology", sectionIndex: di, at: "close",
        dur: +tl.end.toFixed(2), holdUntil: +(tl.end + 3).toFixed(2), verses: 1, odds: +p.toFixed(3), logged: LOGGED,
      },
      why: "seated", odds: p, roll: roll,
    };
  }
  function plan(info, stream) { return decide(info, stream).seat; }

  // ==========================================================================
  // THE SHOUT — "Ho-san-na, Ho-san-na, Ho-san-na, to God and the Lamb", and
  // "A-men, A-men, and A-men": [the voice's syllable, its length (s), the
  // speaking pitch it starts on and the one it ends on (× the person's own),
  // its weight]. A null is a breath. The stressed syllables (SAN, GOD, LAMB,
  // MEN) are the high ones; LAMB and the last MEN fall away.
  // ==========================================================================
  var CRY = [
    ["h-oh", 0.2, 1.0, 1.03, 0.7], ["s-ah", 0.36, 1.12, 1.2, 1], ["n-ah", 0.3, 1.0, 0.9, 0.6], [null, 0.14],
    ["h-oh", 0.2, 1.0, 1.03, 0.7], ["s-ah", 0.36, 1.13, 1.21, 1], ["n-ah", 0.3, 1.0, 0.9, 0.6], [null, 0.14],
    ["h-oh", 0.2, 1.01, 1.04, 0.7], ["s-ah", 0.36, 1.14, 1.22, 1], ["n-ah", 0.3, 1.0, 0.92, 0.6], [null, 0.12],
    ["d-oo", 0.18, 1.0, 1.0, 0.6], ["g-ah", 0.44, 1.22, 1.14, 1], ["eh-n", 0.2, 1.0, 0.98, 0.6], ["d-eh", 0.16, 0.98, 0.96, 0.5], ["l-ah-m", 0.95, 1.14, 0.78, 1],
  ];
  var AMEN = [
    ["ah", 0.32, 1.02, 1.04, 0.8], ["m-eh-n", 0.55, 1.14, 0.96, 1], [null, 0.2],
    ["ah", 0.3, 1.04, 1.06, 0.8], ["m-eh-n", 0.55, 1.16, 0.98, 1], [null, 0.22],
    ["eh-n", 0.2, 1.0, 1.0, 0.6], ["ah", 0.32, 1.06, 1.08, 0.8], ["m-eh-n", 0.9, 1.18, 0.8, 1],
  ];
  function cryLen(c) { var s = 0; c.forEach(function (x) { s += x[1]; }); return s; }
  // a raised speaking voice, by part (Hz: where a shout sits, not a song)
  var SPEAK = { S: [290, 360], A: [255, 315], T: [175, 225], B: [140, 185], child: [340, 430] };

  // ==========================================================================
  // THE WORDS — W. W. Phelps, "The Spirit of God" (1836), the first verse and
  // the chorus, as the voices can sound them: one syllable a note of the tune
  // (ASSEMBLY's 12.11.12.11 R), the vowel of the word and its voiced
  // consonants — no s or f, which a ward says as a hiss — so what is heard is
  // the colour of the words, not the words. The chorus's second line is the
  // shout's own, sung; its last, the amens.
  // ==========================================================================
  var WORDS = [
    "d-eh ee r-ee ah g-ah l-ah ah ah r-eh ee b-eh-n ee-n",            // The Spir-it of God like a fi-re is burn-ing
    "d-eh l-ah d-eh d-eh g-oh r-ee b-ee g-ee-n d-oo g-ah-m oh",       // The lat-ter-day glo-ry be-gins to come forth;
    "d-eh ah n-eh-n ah-n b-eh ee-n ah oh ah r-ee d-eh-n ee-n",       // The vi-sions and bless-ings of old are re-turn-ing,
    "ah-n eh-n l-eh ah g-ah m-ee-n d-oo ee ee d-eh eh",               // And an-gels are com-ing to vis-it the earth.
    "w-ee-l ee-n ah-n w-ee-l ah w-ee d-eh ah m-ee ah h-eh eh-n",      // We'll sing and we'll shout with the ar-mies of hea-ven,
    "h-oh ah n-ah h-oh ah n-ah d-oo g-ah eh-n d-eh l-ah-m",           // Ho-san-na, ho-san-na to God and the Lamb!
    "l-eh g-oh r-ee d-oo d-eh-m ee-n d-eh h-ah ee b-ee g-ee eh-n",    // Let glo-ry to them in the high-est be giv-en,
    "h-eh-n oh ah-n oh eh ah ah m-eh-n ah-n ah m-eh-n",               // Hence-forth and for-ev-er, A-men and a-men!
  ].map(function (l) { return l.split(" "); });
  function words() { return WORDS.map(function (l) { return l.slice(); }); }
  function tuneOf(material) {
    if (material && material.tune) return material.tune;
    var T = window.KOLOB.Tunes;
    return T && T.byId ? T.byId("earth:assembly") : null;
  }

  // ==========================================================================
  // THE TIMELINE — when the shouts, the amens, the organ and each line fall
  // (seconds from the seat; pure: the shape and the tune)
  // ==========================================================================
  function lineLen(line) {
    var S = window.KOLOB.Score;
    if (S && S.lineLength) return S.lineLength(line);
    var end = 0; for (var p in line.notes) (line.notes[p] || []).forEach(function (n) { end = Math.max(end, n.beat + n.beats); });
    return end;
  }
  function timeline(sh, tune) {
    var t = sh.hush, cries = [];
    for (var k = 0; k < 3; k++) {
      var len = cryLen(CRY) * sh.pace;
      cries.push({ k: k, t0: r4(t), t1: r4(t + len) });
      t += len + (k < 2 ? sh.between[k] : sh.amenGap);
    }
    var amen = { t0: r4(t), t1: r4(t + cryLen(AMEN) * sh.pace) };
    t = amen.t1 + sh.settle;
    var lines = tune ? tune.lines.concat(tune.refrain || []) : null, bs = (tune ? tune.beatS : 0.6) * sh.tempo;
    var lens = lines ? lines.map(lineLen) : [16, 16, 16, 16, 16, 16, 16, 16];
    var giving = { t0: r4(t), t1: r4(t + lens[lens.length - 1] * bs) };
    t = giving.t1 + 0.9 * bs;
    var at = [];
    lens.forEach(function (L, i) {
      var last = i === lens.length - 1, d = last ? L * bs * (1 + sh.broaden / 2) : L * bs;   // (the broadening: the last line's beat stretches to 1 + broaden)
      at.push({ i: i, t0: r4(t), t1: r4(t + d), beats: L });
      t += d;
    });
    return { cries: cries, amen: amen, giving: giving, lines: at, beatS: r4(bs), end: r4(t + 2.5) };
  }

  // ==========================================================================
  // THE SCORE — the shout and the hymn as data (pure)
  // ==========================================================================
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
    return { members: members, byId: byId, primary: [] };
  }
  // one person's cry: each syllable a spoken contour (its onset pitch, then a
  // glide to its end pitch), each a hair longer or shorter than the leader's
  function cryLine(cry, F, rise, pace, jit) {
    var out = [], j = 0;
    cry.forEach(function (x) {
      var d = x[1] * pace * (1 + (jit[j++ % jit.length] - 0.5) * 0.12);
      if (!x[0]) { out.push({ rest: true, dur: d }); return; }
      var f0 = F * x[2] * rise, f1 = F * x[3] * rise;
      out.push({ f: f0, dur: d * 0.38, vowel: x[0], stress: x[4] });
      out.push({ f: f1, dur: d * 0.62, vowel: x[0], stress: x[4] * 0.9, slur: true });
    });
    return out;
  }
  function score(material, stream, t0) {
    material = material || {};
    t0 = t0 || 0;
    need(stream);
    var tune = tuneOf(material);
    if (!tune) throw new Error("KOLOB.GuestHosanna: load kolob-tunes.js first (ASSEMBLY)");
    var K = material.keynoteHz || 260, sh = shapeOf(stream, material.sunday), tl = timeline(sh, tune), ward = wardOf(material, stream);
    var crowd = ward.members.filter(function (m) { return m.k != null || (ward.primary && ward.primary.indexOf(m.id) >= 0); });
    // THE CROWD: each person's raised voice, pitch, lateness and loudness
    var Rc = stream.fork("crowd"), people = crowd.map(function (m) {
      var r = Rc.fork("person:" + m.id), rg = SPEAK[m.part] || SPEAK.A;
      var F = r.rnd(rg[0], rg[1]), lag = clamp(0.09 + (r.rnd(0, 1) + r.rnd(0, 1) + r.rnd(0, 1) - 1.5) * 0.06, 0.01, 0.24), lvl = r.rnd(0.8, 1.05), eff = r.rnd(0.6, 0.95);
      var jit = []; for (var q = 0; q < 24; q++) jit.push(r.next());
      var spec = {}; for (var k in m.voice) spec[k] = m.voice[k];
      spec.effort = eff; spec.brightness = clamp((spec.brightness || 0.5) + 0.2, 0, 1); spec.vibrato = { depth: 0, rate: 5, onsetDelay: 1 };
      spec.confidence = Math.max(0.8, spec.confidence || 0); spec.pitchHabitCents = 0; spec.timingHabitMs = 0; spec.level = lvl;
      var lines = tl.cries.map(function (c) { return { t: r4(t0 + c.t0 + lag + (jit[c.k] - 0.5) * 0.04), notes: cryLine(CRY, F, Math.pow(2, c.k * sh.rise / 12), sh.pace, jit) }; });
      lines.push({ t: r4(t0 + tl.amen.t0 + lag + (jit[3] - 0.5) * 0.04), notes: cryLine(AMEN, F, Math.pow(2, 2.4 * sh.rise / 12), sh.pace, jit.slice(5)) });
      return { memberId: m.id, part: m.part, pan: m.pew ? m.pew.x : 0, spec: spec, F: r4(F), lag: r4(lag), lines: lines };
    });
    var hymn = hymnScore(tune, tl, K, t0, ward);
    var stages = [{ stage: "the ward rises", t: r4(t0) }]
      .concat(tl.cries.map(function (c) { return { stage: ["the first Hosanna", "the second", "the third"][c.k], t: r4(t0 + c.t0) }; }))
      .concat([{ stage: "amen, amen, and amen", t: r4(t0 + tl.amen.t0) }, { stage: "the organ gives out the hymn", t: r4(t0 + tl.giving.t0) },
               { stage: "The Spirit of God", t: r4(t0 + tl.lines[0].t0) }, { stage: "the chorus", t: r4(t0 + tl.lines[4].t0) }])
      .map(function (s) { s.logged = LOGGED; s.guest = NAME; return s; });
    return { guest: NAME, keynoteHz: K, tune: { id: tune.id, nameDs: tune.nameDs, number: tune.number }, shape: sh, timeline: tl, people: people, hymn: hymn, stages: stages, end: r4(t0 + tl.end), logged: LOGGED };
  }
  // THE HYMN: every part's notes, line by line, on the chorister's clock —
  // the last line broadening (its beat stretching from 1 to 1 + broaden) —
  // each note on the word's syllable: the tune's own, and an inner part's the
  // syllable the tune is on when it moves (a moving note inside a syllable is
  // sung through, no new consonant)
  function hymnScore(tune, tl, K, t0, ward) {
    var base = K * ratio(tune.keyMonzo || [0, 0, 0, 0]), all = tune.lines.concat(tune.refrain || []), bs = tl.beatS, mp = tune.melodyPart || "S";
    var br = tl.lines.length && tl.lines[tl.lines.length - 1].t1 - tl.lines[tl.lines.length - 1].t0 > tl.lines[tl.lines.length - 1].beats * bs + 1e-6;
    function events(line, part, at, L, stretch) {
      var ns = line.notes[part] || [], ev = [];
      function clk(b) { return bs * (b + (stretch ? stretch * b * b / (2 * L) : 0)); }
      for (var k = 0; k < ns.length; k++) {
        var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
        while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
        var d = clk(b1) - clk(b0);
        if (k === ns.length - 1 && line.breathAfter !== false) d -= Math.min(0.3 * bs, 0.25 * d);
        ev.push({ t: at + clk(b0), dur: d, n: n });
      }
      return ev;
    }
    function sylAt(line, li) {
      var ons = (line.notes[mp] || []).filter(function (n) { return n.syl !== null; }).map(function (n) { return n.beat; }), W = WORDS[li] || [];
      return function (beat) { var k = 0; for (var i = 0; i < ons.length; i++) if (ons[i] <= beat + 1e-6) k = i; return { k: k, word: sounded(W[Math.min(k, W.length - 1)] || "ah") }; };
    }
    function hz(n) { return base * ratio(n.monzo); }
    var lines = all.map(function (line, i) {
      var L = tl.lines[i], stretch = i === all.length - 1 && br ? 2 * ((L.t1 - L.t0) / (L.beats * bs) - 1) : 0, at = t0 + L.t0, sa = sylAt(line, i), parts = {}, organ = [];
      ["S", "A", "T", "B"].forEach(function (p) {
        var prevK = -1;
        parts[p] = events(line, p, at, L.beats, stretch).map(function (e) {
          var s = sa(e.n.beat), slur = s.k === prevK || (p === mp && e.n.syl === null);
          prevK = s.k;
          organ.push({ f: r4(hz(e.n)), dur: r4(e.dur), at: r4(e.t - at), pedal: p === "B", v: p === mp ? 1 : 0.8 });
          return { t: r4(e.t), dur: r4(e.dur), f: hz(e.n), vowel: s.word, slur: slur, stress: e.n.stress, deg: e.n.deg, monzo: e.n.monzo, beat: e.n.beat };
        });
      });
      return { i: i, t0: r4(at), t1: r4(t0 + L.t1), parts: parts, organ: organ };
    });
    var gl = all[all.length - 1], gat = t0 + tl.giving.t0, giving = [];
    ["S", "A", "T", "B"].forEach(function (p) { events(gl, p, gat, tl.lines[all.length - 1].beats, 0).forEach(function (e) { giving.push({ f: r4(hz(e.n)), dur: r4(e.dur), at: r4(e.t - gat), pedal: p === "B", v: p === mp ? 1 : 0.8, part: p }); }); });
    // who sings what: the thirty-two their own parts; the Primary's children the tune
    var singers = ward.members.filter(function (m) { return m.k != null || (ward.primary && ward.primary.indexOf(m.id) >= 0); }).map(function (m) {
      return { memberId: m.id, part: m.part, sings: m.part === "child" ? mp : m.part, voice: m.voice, pan: m.pew ? m.pew.x : 0 };
    });
    return { beatS: bs, lines: lines, giving: { t0: r4(gat), notes: giving }, singers: singers, registration: "full organ" };
  }

  // ==========================================================================
  // PERFORM — the shout a handful of the ward at a time, then the organ and
  // the ward line by line; each laid out a little before it sounds. It
  // tells nothing but its stages, each logged: false
  // ==========================================================================
  var AHEAD = 2.5, ORGAN_AHEAD = 1.2, ARM_STEP = 0.1, ARM_LEAD = 0.8;
  // the arm-tick: one cue on the engine's clock at a time, from t to the
  // end, each joining what is due within ARM_LEAD and parting what has rung
  // out (VoicesVocal.arm; the ward's own pump may call it too — it is the
  // same queue). With no clock (an offline render), every line joins at once.
  function armTicker(V, ctx, hooks, t, end) {
    if (!hooks.defer || !V.arm || hooks.arm === false) return false;
    (function tick(at) {
      hooks.defer(at, function () {
        V.arm(ctx, at + ARM_LEAD, at);
        if (at < end + 1.5) tick(at + ARM_STEP);
      });
    })(t);
    return true;
  }
  function perform(ctx, dest, t, material, stream, hooks) {
    var V = window.KOLOB.VoicesVocal, VO = window.KOLOB.VoicesOrgan;
    if (!V || !V.singer) throw new Error("KOLOB.GuestHosanna: load kolob-voices-vocal.js first");
    hooks = hooks || {};
    material = material || {};
    var sc = score(material, stream, t), synth = stream.fork("synth");
    var bus = ctx.createGain(); bus.gain.value = LEVEL; bus.connect(dest);
    var obus = ctx.createGain(); obus.gain.value = LEVEL; obus.connect(hooks.organDest || dest);
    // (with a clock, every slice is a cue of its own — even one due now — so
    // the moment the Hosanna is cued costs only its score)
    function later(at, fn) { if (hooks.defer) hooks.defer(Math.max(t, at - AHEAD), fn); else fn(); }
    function laterBy(at, lead, fn) { if (hooks.defer) hooks.defer(Math.max(t, at - lead), fn); else fn(); }
    sc.stages.forEach(function (st) { if (hooks.onStage) later(st.t, function () { hooks.onStage({ stage: st.stage, t: st.t, t0: st.t, label: st.stage, guest: NAME, logged: LOGGED }); }); });
    // ARMING (VoicesVocal's): with the engine's clock, every line is built a
    // little ahead but joins the room only just before it sounds, and each of
    // its mouths only around its own moments — forty voices' consonants and
    // vowels cost the audio thread only while they speak
    var armed = armTicker(V, ctx, hooks, t, sc.end);
    // THE SHOUT
    var shouters = {};
    function shouter(p) {
      if (shouters[p.memberId]) return shouters[p.memberId];
      var spec = {}; for (var k in p.spec) spec[k] = p.spec[k];
      spec.rand = synth.fork("shout:" + p.memberId); spec.sharedThroat = true; spec.sharedPan = true; spec.pan = p.pan; spec.name = "hosanna:" + p.memberId; spec.kind = "hosanna-shout";
      return (shouters[p.memberId] = V.singer(spec));
    }
    var nCries = sc.people.length ? sc.people[0].lines.length : 0;
    for (var c = 0; c < nCries; c++) for (var g0 = 0; g0 < sc.people.length; g0 += 5) (function (c, grp) {
      var first = Math.min.apply(null, grp.map(function (p) { return p.lines[c].t; }));
      later(first, function () {
        grp.forEach(function (p) {
          var ln = p.lines[c];
          shouter(p).sing(ctx, bus, ln.t, ln.notes, SHOUT_GAIN, { breathBefore: c ? 0.8 : 1.2, inhale: 0.25, fric: 0.35, defer: armed });
        });
      });
    })(c, sc.people.slice(g0, g0 + 5));
    // THE HYMN: the organ on its own way into the rooms, full; the ward
    // (the organ is built in its first slice, not in the cue)
    var organ = null, orgR = synth.fork("organ");
    function org() { return organ || (organ = VO && VO.create ? VO.create(ctx, obus, { gain: ORGAN_GAIN, rand: orgR, t0: sc.hymn.giving.t0 - 0.5 }) : null); }
    var H = sc.hymn, ward = {};
    function voice(s) {
      if (ward[s.memberId]) return ward[s.memberId];
      var spec = {}; for (var k in s.voice) spec[k] = s.voice[k];
      spec.rand = synth.fork("sing:" + s.memberId); spec.sharedThroat = true; spec.sharedPan = true; spec.pan = s.pan; spec.name = "hosanna-hymn:" + s.memberId; spec.kind = "hosanna-hymn";
      return (ward[s.memberId] = V.singer(spec));
    }
    function report(ln) {
      if (!hooks.onNote) return;
      ["S", "A", "T", "B"].forEach(function (p) { ln.parts[p].forEach(function (n) { hooks.onNote({ layer: "choir", freq: n.f, t: n.t, dur: n.dur, part: p, hymnId: sc.tune.id, line: ln.i, beat: n.beat, deg: n.deg, monzo: n.monzo, hosanna: true, engrave: ENGRAVE_HYMN, logged: ENGRAVE_HYMN }); }); });   // (logged: the engine's word for "the staff may show it")
    }
    // the organ a bar at a time, each piece handed ORGAN_AHEAD before it
    // sounds (a whole line of full organ laid at once kept some four hundred
    // keys' nodes waiting on the audio thread): the tremulant set by the
    // first piece of a line, the level law fixed for four voices throughout
    function organLine(t0, notes, first) {
      if (!VO || !VO.create) return;
      var bar = 4 * H.beatS, pieces = {};
      notes.forEach(function (nt) { var k = Math.floor((nt.at + 1e-6) / bar); (pieces[k] = pieces[k] || []).push(nt); });
      Object.keys(pieces).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k, i) {
        var at0 = t0 + k * bar, ns = pieces[k].map(function (nt) { return { f: nt.f, dur: nt.dur, at: +(t0 + nt.at - at0).toFixed(4), pedal: nt.pedal, v: nt.v }; });
        laterBy(at0, ORGAN_AHEAD, function () { org().play(at0, ns, H.registration, { trem: first && i === 0 ? undefined : false, texture: 4 }); });
      });
    }
    organLine(H.giving.t0, H.giving.notes, true);
    H.lines.forEach(function (ln) {
      organLine(ln.t0, ln.organ, false);
      later(ln.t0, function () { report(ln); });
      // the ward a handful at a time (four singers a slice)
      ["S", "A", "T", "B"].forEach(function (p, pi) {
        var notes = ln.parts[p]; if (!notes.length) return;
        var sung = [], tt = notes[0].t;
        notes.forEach(function (n) { if (n.t > tt + 0.004) sung.push({ rest: true, dur: n.t - tt }); sung.push({ f: n.f, dur: n.dur, vowel: n.vowel, stress: n.stress, slur: !!n.slur }); tt = n.t + n.dur; });
        var who = H.singers.filter(function (s) { return s.sings === p; });
        for (var h0 = 0; h0 < who.length; h0 += 4) (function (grp, k) {
          later(ln.t0 + 0.02 + k * 0.03, function () { grp.forEach(function (s) { voice(s).sing(ctx, bus, notes[0].t, sung, WARD_GAIN, { breathBefore: ln.i ? 0.3 : 0.9, defer: armed }); }); });
        })(who.slice(h0, h0 + 4), pi * 3 + h0 / 4);
      });
    });
    // when the room has let the last chord go, let the buses and the organ go
    var sent = ctx.createConstantSource ? ctx.createConstantSource() : ctx.createOscillator(), sg = ctx.createGain();
    sg.gain.value = 0; sent.connect(sg); sg.connect(bus);
    sent.onended = function () { if (organ && organ.dispose) organ.dispose(sc.end + 5); try { sg.disconnect(); sent.disconnect(); bus.disconnect(); obus.disconnect(); } catch (e) { /* gone */ } };
    sent.start(Math.max(0, t)); sent.stop(sc.end + 5);
    perform.last = { score: sc, organ: function () { return organ; } };
    return sc.end;
  }

  return {
    plan: plan, decide: decide, score: score, perform: perform, words: words, mayCome: mayCome, timeline: function (stream, sunday) { return timeline(shapeOf(stream, sunday), tuneOf(null)); },
    ODDS: ODDS, NAME: NAME, LABEL: LABEL, LOGGED: LOGGED, CRY: CRY, AMEN: AMEN,
    get ENGRAVE_HYMN() { return ENGRAVE_HYMN; }, set ENGRAVE_HYMN(v) { ENGRAVE_HYMN = !!v; },
    get HYMN_CONSONANTS() { return HYMN_CONSONANTS; }, set HYMN_CONSONANTS(v) { HYMN_CONSONANTS = v === "liquids" || v === "none" ? v : "all"; },
    get LEVEL() { return LEVEL; }, set LEVEL(v) { LEVEL = +v; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-guest-hosanna.js"] = true;   // the load guard's roll call (round 3c)

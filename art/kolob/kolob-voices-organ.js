// ============================================================================
// KOLOB — kolob-voices-organ.js: the organ
//
// The tabernacle instrument: its chords and its cycle. Split from
// kolob-audio.js (v0.30); see the room list in kolob-core.js.
//
// ONE ORGAN THROUGHOUT (round 3b, step 2). Until now the meeting had two
// organs and no organist: the house's additive organ (organChord — sines an
// octave down, swelling in like a pad) played the prelude, the joints and
// everything between, and the same sines doubled the hymns' four parts.
// Now the meetinghouse has one instrument — the registrable pipe organ
// (kolob-voices-pipeorgan.js: seven stops, a swell box, a wind you can feel)
// — and one person on its bench, the Sunday's organist (kolob-organist.js:
// the plain organist, the Victorian or the improviser, seated with the
// ward). The organist plays the hymns — the walk into a hymn's key, the
// giving-out, the verses under the ward, the fills between the lines (the
// ward waits for them), the interludes, the amen — and, on some Sundays,
// the chorale prelude on the day's first hymn. The house's own chords (the
// voluntaries, the joints' amens, a soft chord in the testimony, a guest's)
// are the same pipes, on the house registration the organ layer's own
// parameters set (stops, tremulant, pedal), the swell box opening on each
// chord as the organist's habit moves it.
//
// The old organ is kept whole, with its tremulant mended (request R1), as
// the owner's A/B (?organ=house) and as the fallback when the pipe organ or
// the organist is not loaded (a lab without them).
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var KOLOB = window.KOLOB;
  // The house's shared state. Each room lends what the others need onto S
  // (see the LENT block at the foot of this file); a name written S.x belongs
  // to another room; a bare name is this room's own or borrowed below.
  var S = KOLOB._s = KOLOB._s || {};

  // ---- BORROWED — the other rooms' functions, bound late through S (every
  // room is loaded before the first note, so the call always finds its owner) ----
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function silenceMul() { return S.silenceMul(); }
  function hallListens() { return S.hallListens(); }
  function houseRests(layer) { return S.houseRests(layer); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function turn(label) { return S.turn(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
  function cueIn(lane, dtS, fn) { return S.cueIn(lane, dtS, fn); }
  function cueLayer(layer, baseS, fn) { return S.cueLayer(layer, baseS, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.Harmony (the chord desk), S.Meeting (the chorister's book))

  // ==========================================================================
  // THE OLD ORGAN — v0.30's tabernacle instrument, kept as the A/B. Additive
  // drawbar ranks (no biquad anywhere in this chain, by design); principal
  // chorus crossfading toward flutes; a slow shallow tremulant; a pedal sine
  // under the bass.
  //
  // R1 (round 3b, step 2; the organist crew's request, r3-organist-1): the
  // tremulant rides a gain of its own AFTER the envelope. It used to be
  // added straight to the envelope's gain, so when the envelope reached
  // nothing the chord went on sounding at ±1.5 % for 0.3 s and every
  // oscillator then stopped dead — a faint click at each chord's end
  // (−81 to −93 dBFS through the room: real, and not the owner's brushing).
  // Its depth is scaled to the chord's own level, so it trembles exactly as
  // deep as before (±0.39 dB against ±0.38 in the organist lab's check).
  // ==========================================================================
  function houseOrganChord(t, dur, chord, gainMul) {
    if (!chord) return;
    var stops = getLayerParam("organ", "stops", 0.5);
    var trem = getLayerParam("organ", "tremulant", 0.15);
    var pedal = getLayerParam("organ", "pedal", 0.6);
    var dest = panAt("organ", 0);
    var peak = (gainMul || 1) * 0.7;                          // (first: the tremulant's depth is scaled to it)
    var master = S.ctx.createGain(), tremG = S.ctx.createGain();
    tremG.gain.value = 1;
    master.connect(tremG); tremG.connect(dest);
    // drawbar recipe, softened aloft — and the whole chord AN OCTAVE DOWN:
    // the organ lives in the warm low-middle now, an instrument among the
    // others, not a bright bed over them
    var RANKS = [1, 2, 3, 4];
    var P = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
    var nTones = chord.freqs.length;
    for (var v = 0; v < nTones; v++) {
      var f = chord.freqs[v] * 0.5;
      for (var r = 0; r < RANKS.length; r++) {
        var g = P[r] * (1 - stops) + FL[r] * stops;
        if (g < 0.05) continue;
        var pair = r === 0 ? 2 : 1;                            // chorus detune on the unison rank only
        for (var d = 0; d < pair; d++) {
          var o = S.ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(f * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), t);
          var og = S.ctx.createGain();
          og.gain.setValueAtTime(g * 0.16 / Math.sqrt(nTones) / pair, t);
          o.connect(og); og.connect(master);
          o.start(t); o.stop(t + dur + 0.3);
        }
      }
    }
    if (pedal > 0.05) {
      var sub = S.ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(chord.freqs[0] * 0.25, t);
      var sg = S.ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, t);
      sub.connect(sg); sg.connect(master);
      sub.start(t); sub.stop(t + dur + 0.3);
    }
    if (trem > 0.02) {
      var lfo = S.ctx.createOscillator(); lfo.frequency.setValueAtTime(synth("organ").rnd(5, 6), t);
      var lg = S.ctx.createGain(); lg.gain.setValueAtTime(Math.min(0.3, trem * 0.1 / (0.92 * peak)), t);
      lfo.connect(lg); lg.connect(tremG.gain);
      lfo.start(t); lfo.stop(t + dur + 0.3);
    }
    var atk = Math.min(2.2, dur * 0.3);
    env(master, t, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    // every pipe that speaks is a note (round 2): each voice of the chord an
    // octave down, and the pedal an octave under the bass — with the chord
    // book's id for the chord (the raspberry's cluster and the rail's
    // audition are no chord of the book's, and say none)
    for (var pv = 0; pv < nTones; pv++) emitNote("organ", chord.freqs[pv] * 0.5, t, dur, organTag(chord, nTones === 4 ? ORGAN_PART[pv] : null));
    if (pedal > 0.05) emitNote("organ", chord.freqs[0] * 0.25, t, dur, organTag(chord, "pedal"));
  }

  // ==========================================================================
  // THE PIPE ORGAN IN THE MEETING (round 3b, step 2)
  // ==========================================================================
  function VO() { return KOLOB.VoicesOrgan; }
  function OG() { return KOLOB.Organist; }
  // the meeting plays the pipe organ — unless the owner asks for the old one
  // (?organ=house: the A/B), or a page has not loaded it and its organist
  function pipeOn() { return !S.houseOrgan && !!(VO() && VO().create && OG() && OG().perform && S.ctx); }
  // every chord the house plays — the voluntaries, the joints, the testimony's
  // soft chord, a guest's, the rail's audition — comes here
  function organChord(t, dur, chord, gainMul) {
    if (pipeOn()) return pipeChord(t, dur, chord, gainMul);
    return houseOrganChord(t, dur, chord, gainMul);
  }

  // THE CASE. The organ enters the hall through the organ's HANDS (kolob-
  // core.js, THE HOUSE LETS GO): when a guest comes in, the hands let go of
  // everything written through them and the next note comes in by new ones;
  // STOP closes the meeting's doors. A pipe organ is built once and wired to
  // one door, so the meeting keeps a case for each pair of hands the organ
  // has had: a note is laid on the case whose hands are the organ's now,
  // and the case the hands let go of is shut (its tremulant's motor and its
  // wind stopped) once the last pipe written through it has spoken.
  // Thirteen standing nodes a case; a new one in a meeting only at a guest's
  // entrance.
  var cases = [], caseN = 0;
  function caseAt(t) {
    var dest = panAt("organ", 0), cur = cases.length ? cases[cases.length - 1] : null;
    if (cur && cur.dest === dest) return cur.organ;
    var organ = VO().create(S.ctx, dest, {
      gain: OG().ORGAN_GAIN, rand: synth("organ").fork("case:" + (caseN++)), t0: Math.max(0, t - 0.05),
      swell: cur ? cur.organ.swell() : HOUSE_SWELL,
    });
    if (cur) shut(cur, t);
    cases.push({ organ: organ, dest: dest });
    return organ;
  }
  function shut(c, t) {
    var st = c.organ.stats();
    c.organ.dispose(Math.max(t, st.until || 0) + 0.5);
    c.shut = true;
    cases = cases.filter(function (x) { return x !== c; });
    spent.created += st.created; spent.peak = Math.max(spent.peak, st.peakLive);
  }
  var spent = { created: 0, peak: 0 };
  // STOP: nothing more is laid, and every case is shut at t (the fade's end)
  function organStop(t) {
    desk = []; deskTicking = false;
    houseSwell.until = -1e9;
    cases.slice().forEach(function (c) { var st = c.organ.stats(); c.organ.dispose(t); spent.created += st.created; spent.peak = Math.max(spent.peak, st.peakLive); });
    cases = [];
  }
  // what the pipes cost (for the silent checks): the live case, and every
  // case shut before it
  function organStats() {
    var c = cases.length ? cases[cases.length - 1].organ.stats() : null;
    return { pipe: pipeOn(), cases: caseN, standing: c ? c.standing : 0, created: spent.created + (c ? c.created : 0), peakLive: Math.max(spent.peak, c ? c.peakLive : 0),
             desk: desk.length, organist: S.Meeting && S.Meeting.organist && S.Meeting.organist() ? S.Meeting.organist().style : null };
  }

  // ==========================================================================
  // THE HOUSE'S CHORDS ON THE PIPES. Everything the organ played between
  // the hymns — the prelude's and the postlude's voluntaries, the joints'
  // amens, a soft chord in the invocation or the testimony, the fuging's
  // amen, a guest's — was organChord's sines, swelling in like a pad. The
  // same chords are the pipes' now, as the chord desk voices them: every
  // voice of the chord an octave down, as before (the organ still lives in
  // the warm low-middle), the bass on the pedal too, on the HOUSE
  // REGISTRATION the organ layer's parameters set (stops: the principal ↔
  // the flutes; the tremulant; the pedal's bourdon). A pipe speaks when its key goes
  // down — it cannot fade in — so the SWELL BOX is how a chord comes and
  // goes: shut as the keys go down, opening over the old organ's attack,
  // shutting over its release before the hands lift; as far as the Sunday's
  // organist moves it (the plain organist hardly at all, the Victorian from
  // nearly shut). In the chords of one phrase (a joint's amen, the
  // raspberry) the box, closing on one chord, opens again over the next.
  // THE LEVEL: at gainMul HOUSE_REF (the prelude's middle, 0.513) the house
  // registration sits where organChord sat at the same gainMul, through the
  // same organ layer (0.40, the owner's), the loudest 3 s within ±2 LU; any
  // other gainMul scales from it as organChord's did. HOUSE_TRIM is that
  // measurement, taken IN THE MEETING, the organ layer alone, against the
  // old organ on the same Sunday (handoff r3b-organ-1). (Rendered offline
  // through a stand-in room it had come out at +2.2 dB; the meeting's own
  // rooms and glue then put the pipes' chords 2.8–2.9 LU over the old
  // organ's at a joint's amen and a voluntary's — seeds 8 and 7 — and
  // 0.5 over in seed 25's postlude. At 0 they sit either side of it.)
  // ==========================================================================
  var HOUSE_REF = 0.513, HOUSE_TRIM = 0, HOUSE_SWELL = 0.62;
  var houseSwell = { until: -1e9 };
  // THE HOUSE'S STOPS BY THE LIGHT (round 3b, step 4; PLAN §7.3): the
  // organ layer's registration, leaned by the light of the rite and the
  // Sunday (kolob-calendar.js regLean, −1 … +1): at dawn and in the
  // stillness the principal steps back and the flutes carry the chord; in
  // full light the 4′, the pedal and a share of the mixture are drawn — the
  // daylight in the full organ. Held to its level (HOUSE_LEAN_DB a decibel
  // and a little per unit of lean, against the way the stops move it), so
  // the light changes the colour more than the loudness.
  var HOUSE_LEAN_DB = 1.2;
  function houseLean() {
    var CAL = KOLOB.Calendar, M = S.Meeting;
    if (!CAL || !M || !M.light) return 0;
    var L = M.light(), day = M.day ? M.day() : null;
    return L == null ? 0 : CAL.regLean(L, day ? day.id : null);
  }
  function houseReg() {
    var stops = getLayerParam("organ", "stops", 0.5), trem = getLayerParam("organ", "tremulant", 0.15), pedal = getLayerParam("organ", "pedal", 0.6);
    var reg = { principal8: 1 - stops, flute8: 0.35 + 0.65 * stops, flute4: 0.2 + 0.4 * stops, bourdon16: +pedal, trem: trem * 0.5 };
    var lean = houseLean();
    if (lean < 0) { reg.principal8 *= 1 + 0.65 * lean; reg.flute4 *= 1 + 0.4 * lean; reg.bourdon16 *= 1 + 0.3 * lean; }
    else if (lean > 0) { reg.principal8 = Math.min(1, reg.principal8 + 0.4 * lean); reg.flute4 += 0.3 * lean; reg.mixture = 0.5 * lean * lean; reg.bourdon16 = Math.min(1, reg.bourdon16 + 0.3 * lean); }
    for (var k in reg) reg[k] = +reg[k].toFixed(3);
    return reg;
  }
  // the chord on an organ (the meeting's case, or a lab's): freqs as the
  // desk voices them (bass first); o = { reg, depth (how far the box moves,
  // 0–1), phrase: {until} (a chord still sounding: the box opens again from
  // where its closing has got to) }
  function pipeChordOn(organ, t, dur, freqs, gainMul, o) {
    o = o || {};
    var reg = o.reg || houseReg(), n = freqs.length, ph = o.phrase || { until: -1e9 };
    var leanDb = o.reg ? 0 : -HOUSE_LEAN_DB * houseLean();
    var G = (gainMul || 1) / HOUSE_REF * Math.pow(10, (HOUSE_TRIM + leanDb) / 20);
    var depth = o.depth != null ? o.depth : 0.6, eOpen = HOUSE_SWELL, eShut = Math.max(0, eOpen - 0.4 * depth);
    var atk = Math.min(2.2, dur * 0.3), rel = dur * 0.28;
    // (a chord that comes while the last still sounds finds the box already
    // closing on it: it opens again over this chord's own attack, from
    // wherever it has got to — the old organ's cross-fade between the
    // chords of an amen, not a box held open over them)
    if (t < ph.until - 0.05) organ.setSwell(eOpen, t, atk, true);
    else { organ.setSwell(eShut, t - 0.03, 0.03, true); organ.setSwell(eOpen, t + 0.02, atk); }
    organ.setSwell(eShut, t + dur - rel, rel);
    ph.until = Math.max(ph.until, t + dur);
    organ.play(t, freqs.map(function (f, v) { return { f: f * 0.5, dur: dur, v: G, pedal: v === 0 }; }), reg, { texture: n });
    return reg;
  }
  function pipeChord(t, dur, chord, gainMul) {
    if (!chord || !chord.freqs || !chord.freqs.length) return;
    var org = S.Meeting && S.Meeting.organist ? S.Meeting.organist() : null;
    var reg = pipeChordOn(caseAt(t), t, dur, chord.freqs, gainMul, { depth: org ? Math.max(0.3, org.habits.swell) : 0.6, phrase: houseSwell });
    var nTones = chord.freqs.length;
    // (round 3b, step 4: the house's stops as the light drew them — told on
    // its notes for the measuring tools: "flutes" at dawn and in the
    // stillness, "full" in full light, "principal" between)
    var lean = houseLean(), stops = lean <= -0.4 ? "flutes" : lean >= 0.5 ? "full" : "principal";
    for (var pv = 0; pv < nTones; pv++) { var tg = organTag(chord, nTones === 4 ? ORGAN_PART[pv] : null); tg.houseStops = stops; emitNote("organ", chord.freqs[pv] * 0.5, t, dur, tg); }
    // the pedal's 16′ under the bass (where the bourdon is drawn), sounding
    // an octave under its key unless that would fall below the case's floor
    if ((reg.bourdon16 || 0) > 0) {
      var fk = chord.freqs[0] * 0.5;
      emitNote("organ", fk / 2 >= 38 ? fk / 2 : fk, t, dur, organTag(chord, "pedal"));
    }
  }

  // ==========================================================================
  // THE ORGANIST'S DESK. A plan of the organist's (kolob-organist.js: a
  // prelude, a modulation, a giving-out, a verse, an interlude, an amen) is
  // laid on the organ a few seconds ahead of the music by its own performer,
  // one pump every ORGANIST_PUMP_S of the music's time on a lane of its own
  // (never the organ's lane: the rail's rate slider bends that one). The
  // pump reads the music's now, never the audio clock.
  //   organistPlays(plan, t0, tag) — tag says what each note is told as:
  //     { hymnId, key (the hymn's keyMonzo: a note's monzo is told relative
  //       to it, SCORE §10.3), verse, amenLine, givingOut | modulation |
  //       interlude | amen | prelude, style, alive() (false: a hymn left —
  //       nothing more is laid) }
  // ==========================================================================
  var desk = [], deskTicking = false;
  var ORGANIST_PUMP_S = 0.2, ORGANIST_REACH_S = 3;
  // THE ORGAN UNDER THE WARD (the level in a hymn). The organist's plans are
  // balanced (organist-lab) against v0.34's organChord — the organ the owner
  // found "pretty loud" and set at the 0.40 layer — and the prelude, the
  // chorale prelude and the house's chords sit there still. Under a hymn,
  // though, the meeting has played since v0.35 the old organ's part lines
  // (organPartLine: each voice doubled, the giving-out at 1.7), and the ward
  // was set level with THAT organ (r3b-ward-1). Measured in the meeting,
  // the organ layer alone through the rooms and the glue, the loudest 3 s:
  // the organist's hymn sat 5.3–5.7 LU under it (seed 7, the Victorian:
  // the giving-out 5.6, the verses 5.3, 6.4 and 5.7 — the quiet middle verse
  // his own). So everything the organist plays in a hymn — the walk into its
  // key, the giving-out, the verses, the fills, the interludes, the amen — is
  // lifted by UNDER_WARD_DB, back to where the owner's organ sat under the
  // singing (handoff r3b-organ-1: ±2 LU, seed by seed). Measured again once
  // every piece carried its style's own hymn level (HYMN_LIFT, kolob-
  // organist.js — the Victorian's half a decibel under the plain
  // organist's, as the lab centres them): the loudest 3 s of the
  // Victorian's hymns 1.1 LU under the old organ's, the plain organist's
  // 0.9, the improviser's 0.2 — a shade soft of it, as the owner's "pretty
  // loud" asks rather than over. The knob, for the owner's ear: 0 is the organist lab's level, some
  // 5 dB softer.
  var UNDER_WARD_DB = 5.0;
  function organistPlays(plan, t0, tag) {
    if (!pipeOn() || !plan || !plan.phrases) return null;
    tag = tag || {};
    if (tag.hymnId && !tag.prelude && !plan._underWard) { plan.liftDb = (plan.liftDb || 0) + UNDER_WARD_DB; plan._underWard = true; }
    // the organist's hands always find the case the organ's hands are on now
    var hands = {
      play: function (t, notes, reg, o) { return caseAt(t).play(t, notes, reg, o); },
      setSwell: function (e, t, r) { caseAt(t).setSwell(e, t, r); },
    };
    var perf = OG().perform(hands, plan, t0, {
      keynoteHz: S.F0 * S.ROOT_MULT, hymnId: tag.hymnId || null,
      onNote: function (layer, f, st, dur, x) { tellOrganNote(f, st, dur, x, tag); },
      onEvent: function (e) { tellOrganist(e, tag); },
    });
    if (!perf.pump(S.now(), ORGANIST_REACH_S)) desk.push({ perf: perf, tag: tag });
    if (desk.length && !deskTicking) { deskTicking = true; cueAt("organist", S.now() + ORGANIST_PUMP_S, organistTick); }
    return perf;
  }
  function organistTick(t) {
    deskTicking = false;
    if (!S.playing) { desk = []; return; }
    desk = desk.filter(function (d) {
      if (d.tag.alive && !d.tag.alive()) return false;
      return !d.perf.pump(t, ORGANIST_REACH_S);
    });
    if (desk.length) { deskTicking = true; cueAt("organist", t + ORGANIST_PUMP_S, organistTick); }
  }
  // every written note the organist sounds (SCORE §6: doublings reported),
  // in the Score's own terms — under a hymn its monzo relative to the
  // hymn's key; the pedal's 16′ as a note of its own
  function tellOrganNote(f, st, dur, x, tag) {
    var n = { part: x.part, organist: x.organist }, key = tag.key || null, m = x.monzo;
    if (tag.hymnId) n.hymnId = tag.hymnId;
    n.monzo = key ? [m[0] - key[0], m[1] - key[1], m[2] - key[2], (m[3] || 0) - (key[3] || 0)] : [m[0], m[1], m[2], m[3] || 0];
    n.keyMonzo = key ? [key[0], key[1], key[2], key[3] || 0] : [0, 0, 0, 0];
    if (x.line != null) n.line = x.line === "amen" && tag.amenLine != null ? tag.amenLine : x.line;
    if (x.beat != null) n.beat = x.beat;
    if (x.deg != null) n.deg = x.deg;
    if (x.orn) n.orn = x.orn;
    if (tag.verse != null) n.verse = tag.verse;
    ["givingOut", "modulation", "interlude", "amen", "prelude", "partner"].forEach(function (k) { if (tag[k]) n[k] = true; });
    if (!x.pedalOnly) emitNote("organ", f, st, dur, n);
    if (x.pedal) {
      var p = {}; for (var k in n) p[k] = n[k];
      var down = f / 2 >= 38;
      p.part = "pedal";
      if (down) p.monzo = [n.monzo[0] - 1, n.monzo[1], n.monzo[2], n.monzo[3]];
      emitNote("organ", down ? f / 2 : f, st, dur, p);
    }
  }
  // the organist's own doings, told at their moment (a `cast` event: the
  // organist is a person of the ward — the minutes give the moments that
  // matter a row, in Deseret)
  function tellOrganist(e, tag) {
    var C = KOLOB.Cast, key = C && C.actionKey ? C.actionKey(e.action) : e.action;
    var ev = { type: "cast", memberId: "organist", nameDs: e.nameDs, action: e.action, role: "organist",
               actionDs: C && C.ACTION_DS ? C.ACTION_DS[key] || null : null, style: tag.style || null,
               cat: "cast", label: "✦ the organist " + e.action, detail: e.nameDs };
    if (tag.hymnId) ev.hymnId = tag.hymnId;
    if (tag.verse != null) ev.verse = tag.verse;
    if (e.registration) ev.registration = e.registration;
    if (e.manner) ev.manner = e.manner;
    var alive = tag.alive;
    cueAt("organist", Math.max(S.now(), e.t), function () { if (!alive || alive()) emitEvent(ev); });
  }

  // ==========================================================================
  // THE CHORALE PRELUDE (PLAN-COMPOSITION §15, item 2: approved, as a draw,
  // never the fixed opening; the organist crew's kolob-organist.js prelude).
  // On a Sunday seated for it (kolob-meeting.js, THE PRELUDE'S SEATING:
  // "chorale"), the organist's first touch is the day's first hymn — the
  // plain organist's hymn once or twice through on soft flutes, the
  // Victorian's tune on the vox humana or the trumpet with a suspension at
  // every close, the improviser's tune deep in the pedals under running
  // flutes — thirty to fifty seconds, while the house listens (the strings,
  // the harmonium and the deacon wait for it; the drone and the valley do
  // not). The hymn was written ahead, off the audio path (kolob-hymnal.js);
  // a late one is written here, and counted. → how long it sounds (0: it
  // could not be played)
  // ==========================================================================
  function choralePrelude(t) {
    var M = S.Meeting, ch = M.chorale ? M.chorale() : null, org = M.organist ? M.organist() : null;
    if (!ch || ch.begun || !org || !pipeOn() || !KOLOB.Hymnal) return 0;
    var h = KOLOB.Hymnal.get(ch.hymnId);
    if (!h) return 0;
    var n = M.meetingNum(), plan = OG().prelude(org, h, S.castStream(n));
    var t0 = t + 0.1, until = t0 + plan.dur;
    M.choraleBegins(t0, until, { style: plan.style, manner: plan.manner, dur: plan.dur, beatS: plan.beatS, hymnId: h.id, bitonal: !!plan.bitonal });
    // (a later meeting's house is already awake: it lets go as the organist
    // begins, as it does for a guest — THE HOUSE LETS GO, kolob-core.js)
    if (S.houseLetsGo) S.houseLetsGo(t, "chorale", true);
    // a first hymn keyed away from home: the drone steps back under it, as
    // it does under the hymn
    var home = !h.keyMonzo || (h.keyMonzo[0] === 0 && h.keyMonzo[1] === 0 && h.keyMonzo[2] === 0 && !(h.keyMonzo[3] || 0));
    if (!home && S.droneDuck) {
      S.droneDuck.gain.cancelScheduledValues(t0);
      S.droneDuck.gain.setValueAtTime(1, t0);
      S.droneDuck.gain.linearRampToValueAtTime(0.22, t0 + 3);
      S.droneDuck.gain.setValueAtTime(0.22, until);
      S.droneDuck.gain.linearRampToValueAtTime(1, until + 6);
    }
    organistPlays(plan, t0, { hymnId: h.id, key: h.keyMonzo, prelude: true, style: org.style,
                              alive: function () { return !!S.playing && M.meetingNum() === n && M.section() === "prelude"; } });
    return until - t;
  }

  // THE ORGAN UNDER A COMPOSED HYMN (round 3): one part of the Score played
  // as written — legato, as an organist doubles a hymn's voices, each pipe
  // speaking at the pitch the ward sings (the 8′ principal, a 4′ above it,
  // and, for "full", the twelfth and fifteenth), the bass with a 16′ pedal
  // under it. A new pitch is taken almost at once (a pipe has no glide: a
  // few milliseconds' ramp so the oscillator does not click); a repeated
  // note is struck again, the key let up for an instant. Every pipe that
  // speaks is reported, with the tag the caller gives each note (its part,
  // its hymn, the beat, its monzo and the hymn's key).
  // (Round 3b, step 2: the old organ's — the A/B and the fallback. In the
  // meeting the organist plays the hymn on the pipes.)
  //   notes: [{at, dur, f, syl, tag}] (at: s from t); opts: {reg, pedal}
  function organPartLine(t, notes, gainMul, opts) {
    opts = opts || {};
    if (!notes || !notes.length) return 0;
    var stops = getLayerParam("organ", "stops", 0.5);
    var full = opts.reg === "full";
    var RANKS = full ? [1, 2, 3, 4] : [1, 2];
    var P = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
    var dest = panAt("organ", 0);
    var master = S.ctx.createGain();
    master.connect(dest);
    var t0 = t + notes[0].at, end = t + notes[notes.length - 1].at + notes[notes.length - 1].dur;
    var oscs = [];
    RANKS.forEach(function (rk, r) {
      var g = P[r] * (1 - stops) + FL[r] * stops;
      if (g < 0.05) return;
      var o = S.ctx.createOscillator();
      o.type = "sine";
      var og = S.ctx.createGain(); og.gain.setValueAtTime(g * 0.075 * (full ? 1.15 : 1), t0);
      o.connect(og); og.connect(master);
      oscs.push({ o: o, mul: rk });
    });
    if (opts.pedal) {
      var ped = S.ctx.createOscillator();
      ped.type = "sine";
      var pg = S.ctx.createGain(); pg.gain.setValueAtTime(getLayerParam("organ", "pedal", 0.6) * 0.07, t0);
      ped.connect(pg); pg.connect(master);
      oscs.push({ o: ped, mul: 0.5 });
    }
    // the pitches, note by note
    oscs.forEach(function (x) { x.o.frequency.setValueAtTime(notes[0].f * x.mul, t0 - 0.01); });
    var g = master.gain, peak = (gainMul || 1) * 0.5;
    g.setValueAtTime(0, t0 - 0.04);                            // (silent before the pipes start: a gain is 1 until its first event)
    g.setValueAtTime(0, t0 - 0.01);
    g.linearRampToValueAtTime(peak, t0 + 0.05);
    var gT = t0 + 0.05;
    for (var i = 1; i < notes.length; i++) {
      var n = notes[i], p = notes[i - 1], c = t + n.at;
      if (Math.abs(n.f - p.f) > 0.01) {
        oscs.forEach(function (x) { x.o.frequency.setValueAtTime(p.f * x.mul, c - 0.006); x.o.frequency.linearRampToValueAtTime(n.f * x.mul, c + 0.006); });
      } else if (n.syl && c - 0.05 > gT) {
        // the key let up and pressed again
        g.setValueAtTime(peak, c - 0.05);
        g.linearRampToValueAtTime(peak * 0.25, c - 0.012);
        g.linearRampToValueAtTime(peak, c + 0.02);
        gT = c + 0.02;
      }
      // (a rest in the part: the key let up for its length)
      var gapS = c - (t + p.at + p.dur);
      if (gapS > 0.08 && c - gapS > gT) {
        g.setValueAtTime(peak, t + p.at + p.dur);
        g.linearRampToValueAtTime(0, t + p.at + p.dur + 0.04);
        g.setValueAtTime(0, c - 0.03);
        g.linearRampToValueAtTime(peak, c + 0.02);
        gT = c + 0.02;
      }
    }
    g.setValueAtTime(peak, Math.max(gT + 0.005, end - 0.01));
    g.linearRampToValueAtTime(0, end + 0.18);
    oscs.forEach(function (x) { x.o.start(t0 - 0.02); x.o.stop(end + 0.3); });
    notes.forEach(function (n) {
      emitNote("organ", n.f, t + n.at, n.dur, n.tag || null);
      if (opts.pedal) {
        var pt = {}; for (var k in (n.tag || {})) pt[k] = n.tag[k];
        pt.part = "pedal";
        if (pt.monzo) pt.monzo = [pt.monzo[0] - 1, pt.monzo[1], pt.monzo[2], pt.monzo[3] || 0];
        emitNote("organ", n.f * 0.5, t + n.at, n.dur, pt);
      }
    });
    return end - t;
  }
  var ORGAN_PART = ["B", "T", "A", "S"];
  function organTag(chord, part) { var x = { part: part }; if (chord.id != null) x.chord = chord.id; return x; }
  // The organist's turn, at scheduled time t (the organ's lane on the clock);
  // every die of the turn is the turn's own.
  function organCycle(t) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    if (s === "sacrament") { cueIn("organ", 6, organCycle); return; }
    // the organist rests while the house listens (the trombones at dawn play
    // chords of their own; a composed hymn is the organist's own; so is the
    // chorale prelude) and comes back when they have gone by
    if (hallListens() || houseRests("organ")) { cueIn("organ", 6, organCycle); return; }
    var R = turn("organ");
    // every chord the organist plays is voiced from, and written into, the
    // chord book at the moment it sounds: t + 0.1
    if (s === "invocation" || s === "testimony" || s === "interlude") {
      // mostly tacet — a rare soft open chord, like the organist resting hands
      if (R.chance(0.25)) {
        var ch = S.Harmony.advance({ open: true }, R, t + 0.1, "organ");
        organChord(t + 0.1, R.rnd(10, 16), ch, 0.35);
      }
      cueLayer("organ", R.rnd(20, 36) * silenceMul(), organCycle);
      return;
    }
    // The organ is an INSTRUMENT here, never a bed. In the prelude and the
    // postlude the organist plays phrases — a chord, a breath, a chord —
    // with real silence between. In the singing sections it only punctuates,
    // a swell under a cadence moment, then hands the hymn back to the voices.
    // The sustained ground of this piece is the sine DRONE, nothing else.
    if (s === "prelude" || s === "postlude") {
      // the prelude's seating (kolob-meeting.js): the brush arbor has no
      // organ; and the day's first chord may be full, its third sung
      var seat = s === "prelude" ? S.Meeting.seating() : null;
      if (seat && seat.sits.organ) { cueIn("organ", 6, organCycle); return; }
      // the ward hums first (the humming seating): the organist waits for
      // the hum, writes no chord under it, and comes in when it has ended
      if (seat && ((seat.hum && !seat.hum.sung) || S.Harmony.sungUntil() > t + 0.1)) { cueIn("organ", 3, organCycle); return; }
      // THE CHORALE PRELUDE (round 3b, step 2): on a Sunday seated for it,
      // the organist's first touch is the day's first hymn; the house's own
      // chords follow it, after a breath, leaning as the Sunday was seated
      if (seat && seat.name === "chorale" && pipeOn()) {
        var cd = choralePrelude(t);
        if (cd > 0) { cueIn("organ", cd + R.rnd(4, 9) * silenceMul(), organCycle); return; }
      }
      var first = {};
      if (seat && !S.Harmony.at(t + 0.1)) {
        first.spread = seat.spread;
        if (seat.full) { first.open = false; first.third = true; }
      }
      var chord = S.Harmony.advance(first, R, t + 0.1, "organ");
      // the seating's texture: an organ voluntary WALKS in short chords, or
      // breathes in long ones; a valley morning leaves the organist long rests
      var dur = R.rnd(6, 11) * (seat ? seat.organDur : 1);
      organChord(t + 0.1, dur, chord, 0.75 * (0.6 + intensity() * 0.4));
      cueLayer("organ", dur + R.rnd(4, 10) * silenceMul() * S.Meeting.lean("organ"), organCycle);
      return;
    }
    if (R.chance(0.6)) {
      // under the singing: the chord the congregation is on when the swell
      // begins (the book's, at t + 0.1), or a fresh one if none stands yet
      var ch2 = S.Harmony.at(t + 0.1) || S.Harmony.advance({}, R, t + 0.1, "organ");
      var d2 = R.rnd(7, 12);
      organChord(t + 0.1, d2, ch2, (s === "doxology" ? 0.65 : 0.5) * (0.6 + intensity() * 0.5));
    }
    cueLayer("organ", R.rnd(12, 24) * gapMul() * 0.6, organCycle);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.organChord = organChord;
  S.houseOrganChord = houseOrganChord;
  S.organPartLine = organPartLine;
  S.organCycle = organCycle;
  // the pipe organ and its organist (round 3b, step 2)
  S.pipeOn = pipeOn;
  S.organistPlays = organistPlays;
  S.organStop = organStop;
  S.organStats = organStats;
  S.pipeChordOn = pipeChordOn;                   // (a lab's: the house's chord on an organ of its own)
  S.houseReg = houseReg;
  S.HOUSE_ORGAN = { ref: HOUSE_REF, trim: HOUSE_TRIM, swell: HOUSE_SWELL, underWardDb: UNDER_WARD_DB };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-organ.js"] = true;   // the load guard's roll call
})();

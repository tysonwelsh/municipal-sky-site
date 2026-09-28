// ============================================================================
// KOLOB — kolob-guests.js: the visitations
//
// The raspberry amen's cluster, the cumulative assembly, and the Ives
// guests: the unanswered question, two bands crossing, the steeples, the
// old tune half-remembered (an Earth tune, from kolob-tunes.js) — and, from
// round 2, the trombone choir at dawn (kolob-guest-trombones.js plays it;
// it is placed and told here). Split from kolob-audio.js (v0.30); see the
// room list in _engine.php.
//
// Each guest is called by the conductor's cue at its scheduled time t and
// throws its dice from its own stream, guest:<type>:<n> (round 2): a guest
// that throws more or fewer never alters a hymn.
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
  // from kolob-pitch.js
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  function harm(h) { return S.harm(h); }
  // from kolob-voices-organ.js
  function organChord(t, dur, chord, gainMul) { return S.organChord(t, dur, chord, gainMul); }
  // from kolob-voices-choir.js
  function choirVoiceLine(t, notes, vi, gainMul) { return S.choirVoiceLine(t, notes, vi, gainMul); }
  function activeVoices() { return S.activeVoices(); }
  function choirHarmonizedLine(t, harmonized, beat, gainMul) { return S.choirHarmonizedLine(t, harmonized, beat, gainMul); }
  // from kolob-voices-winds.js
  function renderClarinetLine(t, notes, gainMul, R) { return S.renderClarinetLine(t, notes, gainMul, R); }
  function renderHarmonium(t, notes, gainMul) { return S.renderHarmonium(t, notes, gainMul); }
  // from kolob-voices-ground.js
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
  function bellStrike(t, gainMul, base, dest, opts) { return S.bellStrike(t, gainMul, base, dest, opts); }
  // from kolob-meeting.js
  function localArc() { return S.localArc(); }
  // from kolob-core.js
  function stream(label) { return S.stream(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function wideSend() { return S.wideSend(); }
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.mode,
  // S.Harmony (the chord desk), S.Meeting (the chorister's book), S.moment,
  // S.VI_TO_CHORDPOS, S.CHOIR_PART, S.reportLine)
  var Motif = KOLOB.Melody.Motif;
  // A guest's word to the minutes (SCORE §6): typed, and carrying whether the
  // page may name the guest at all — a guest the meeting marked unlogged
  // (V.logged false: the Hosanna) says so on every event it sends.
  function tell(V, ev) {
    ev.logged = !(V && V.logged === false);
    return emitEvent(ev);
  }
  // …and its notes say the same (round 2, the critic): each note a visitor
  // sounds names the guest and whether the page may show it. A note that
  // says logged: false is neither printed in the minutes nor engraved; the
  // steeples' first bell and the band's steps used to reach the page untagged
  // when their events had been hushed. extra: the note's own fields.
  function guestNote(V, guest, extra) {
    var o = extra || {};
    o.guest = guest;
    o.logged = !(V && V.logged === false);
    return o;
  }

  // THE RASPBERRY AMEN's cluster — two hands of neighboring seconds, every
  // tone a collection ratio, so the wrongness is spelled in the meeting's
  // own tuning. Warm JI beating, not a smear: dissonant, never broken.
  function razzCluster() {
    var n = colN();
    var idxs = [-1, 0, 1, n + 1, n + 2, n + 4];
    return { freqs: idxs.map(function (i) { return degFreq(i); }) };
  }

  // ==========================================================================
  // CUMULATIVE ASSEMBLY — the payoff of a withheld meeting. After twenty
  // minutes of tails, heads, and mirrors, the whole tune arrives for the
  // first time: a breath, then the theme VERBATIM in four parts — never
  // poured through the meter; this is a tune-statement, not a verse —
  // clarinet doubling above, organ beneath, strings holding the fifth,
  // closed with the plagal amen. The withholding lifts when it ends.
  // ==========================================================================
  function cumulativeAssembly(tc) {
    var theme = Motif.theme();
    if (!theme) return 8;
    var R = stream("guest:cumulative");
    var t = tc + 0.4;
    var breath = R.rnd(2, 3);                      // the room inhales
    // if the hour is late (the x>0.7 fallback), the statement compresses
    var beat = localArc() > 0.7 ? R.rnd(0.95, 1.15) : R.rnd(1.3, 1.6);
    var line = theme.notes.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
    var at = t + breath;
    var hz = S.Harmony.harmonize(line, R, at, beat, "assembly");   // each chord written where it is sung
    var total = choirHarmonizedLine(at, hz, beat, 0.95);
    // the deacon doubles the melody an octave above the sopranos
    var cnotes = theme.notes.map(function (n) {
      return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.max(0.4, Math.min(beat * 3.5, n.durBeats * beat)) };
    });
    renderClarinetLine(at + 0.1, cnotes, 0.8, R);
    // the ground beneath the arrival
    if (hz.length) organChord(at, Math.max(6, total * 0.55), hz[0].chord, 0.5);
    var chDur = R.rnd(2.8, 3.4);
    stringsPad(at, total + chDur * 2 + 2, 0.85, true);
    // the plagal amen — every voice lands together
    var cadAt = at + total + R.rnd(0.4, 0.9);
    var chords = S.Harmony.cadence("plagal", R, cadAt, "assembly");
    var avs = activeVoices();
    for (var ci = 0; ci < chords.length; ci++) {
      var amenDur = chDur * (ci ? 1.7 : 1.02);
      S.Harmony.write(chords[ci], cadAt + ci * chDur, "assembly", amenDur);
      for (var v = 0; v < avs.length; v++) {
        var vi = avs[v];
        var cf = chords[ci].freqs[S.VI_TO_CHORDPOS[vi]];
        choirVoiceLine(cadAt + ci * chDur, [{ f: cf, dur: amenDur }], vi, 0.9);
        emitNote("choir", cf, cadAt + ci * chDur, amenDur, { part: S.CHOIR_PART[vi], chord: chords[ci].id });   // every voice of the amen
      }
    }
    // the organ follows the amen as it is sung (round 2: it used to sound
    // the final chord under the first), ending where it always did
    organChord(cadAt, chDur * 1.02, chords[0], 0.55);
    organChord(cadAt + chDur, chDur * 1.2, chords[chords.length - 1], 0.55);
    var dur = (cadAt + chDur * 2.2) - t;
    claimAir(dur, 6);
    tell(null, { type: "guest", guest: "assembly", stage: "whole-tune", theme: theme.name, gesture: theme.gesture || null, dur: dur,
                 cat: "visitation", label: "✶ the whole tune, at last", detail: theme.name + " · " + (theme.gesture || "") + " · " + Math.round(dur) + "s" });
    // the span the conductor holds is the SOUND's, counted from the cue: the
    // held amen (its last chord, ×1.7) and the strings under it both outlast
    // the air claimed above, which is unchanged (round 2)
    return Math.max(cadAt + chDur * 2.7, at + total + chDur * 2 + 2) - tc;
  }

  // ==========================================================================
  // IVES VISITATIONS — rare guests, drawn at planMeeting on independent dice.
  //
  // THE UNANSWERED QUESTION (after Ives, 1908): the drone is the eternal
  // ground and never changes; the clarinet asks ONE fixed phrase over and
  // over — it refuses the motif engine's development, which is the point;
  // the harmonium answers, each time faster, denser, higher, more scattered.
  // The last asking gets no answer. The air is claimed, so the meeting holds
  // back and the drone is left alone with it.
  // ==========================================================================
  function unansweredQuestion(V, tc) {
    var R = stream("guest:question");
    var t = tc + 0.5;
    var beat = R.rnd(0.8, 0.95);
    // the perennial question: rising, angular, ending high and unresolved
    // (a 9th above the root — a step past the octave, asking)
    var QDEGS = [[4, 1.3], [5, 0.9], [8, 1.0], [6, 0.8], [8, 2.8]];
    var qNotes = QDEGS.map(function (q) {
      return { f: degFreq(projDeg(q[0]) + colN()), dur: q[1] * beat };
    });
    var qdur = 0;
    for (var qq = 0; qq < qNotes.length; qq++) qdur += qNotes[qq].dur;
    var N = R.rint(4, 5);
    var cursor = t;
    for (var k = 0; k < N; k++) {
      renderClarinetLine(cursor, qNotes, 0.9, R);
      var afterQ = cursor + qdur;
      if (k < N - 1) {
        // the answer: more notes, quicker, higher, less patient each time
        var aAt = afterQ + R.rnd(1.2, 2.2);
        var count = 3 + k * 2;
        var abeat = 1.25 * Math.pow(0.75, k);
        var lift = k >= 2 ? colN() : 0;
        var adeg = 2, anotes = [];
        for (var an = 0; an < count; an++) {
          adeg += R.rint(-(1 + k), 1 + k) || 1;
          adeg = Math.max(0, Math.min(9 + k, adeg));
          anotes.push({ f: degFreq(projDeg(adeg) + colN() + lift), dur: Math.max(0.3, abeat * R.rnd(0.7, 1.2)) });
        }
        var adur = renderHarmonium(aAt, anotes, 0.5 + k * 0.12);
        // (FOR WHOEVER UNSHELVES THE QUESTION: the answers are told as the
        // guest's; the clarinet's askings are told inside renderClarinetLine,
        // which takes no tag — an unlogged Question must pass one there)
        S.reportLine("harmonium", aAt, anotes, guestNote(V, "question"));
        // from the third answer the answerers argue among themselves
        // (FOR WHOEVER UNSHELVES THE QUESTION: the second rank is a PURE
        // fifth above each answer, and above a degree whose fifth is not in
        // the collection it is a pitch outside the day's tuning — the harness
        // lists it as off the tuning; take the collection's own fifth, as the
        // strings' pureFifth guard does, or rule that the argument may leave it)
        if (k >= 2) {
          var bnotes = anotes.map(function (n) { return { f: n.f * 1.5, dur: n.dur * R.rnd(0.8, 1) }; });
          renderHarmonium(aAt + abeat * 0.5, bnotes, 0.3 + k * 0.08);
          S.reportLine("harmonium", aAt + abeat * 0.5, bnotes, guestNote(V, "question", { part: "doubling" }));
        }
        cursor = aAt + adur + R.rnd(2.5, 4.5) * Math.pow(0.85, k);
      } else {
        cursor = afterQ;                       // the last asking hangs
      }
    }
    var tail = 10;                             // the drone alone — no answer comes
    var total = (cursor - t) + tail;
    claimAir(total - 4, 6);
    // (SCORE §6: one event for the askings — v0.32's question is the old
    // one, q:old — and one when the drone is left alone)
    tell(V, { type: "question-asking", k: 0, questionId: "q:old", askings: N, dur: total,
              cat: "visitation", label: "? the question", detail: "×" + N + " askings · " + Math.round(total) + "s" });
    cueAt("guests", tc + (cursor - t + 1.5), function () {
      tell(V, { type: "question-unanswered", cat: "visitation", label: "? unanswered", detail: "the drone alone" });
    });
    return total;
  }

  // ==========================================================================
  // TWO BANDS CROSSING (after the Danbury green; Putnam's Camp): a visiting
  // band enters from one side of the valley in ITS OWN key and ITS OWN
  // marching tempo, swells as it approaches, crosses the meeting, and
  // recedes. It claims no air and defers to no one; the resident voices
  // carry on exactly as they were. The collision is the piece. The visitor
  // is engraved on its own layer, in round notes — not one of ours (v0.31:
  // its notes are reported to the page with layer "band"; the report draws
  // no dice and moves nothing).
  // ==========================================================================
  function twoBandsCross(V, tc) {
    var R = stream("guest:bands");
    // under the withholding the visiting band gets a lesser hymn — even a
    // stranger's quickstep must not give the tune away
    var theme = S.Meeting.withheld() ? Motif.anyWorking(S.moment(), R) : Motif.theme();
    var t = tc + 0.4;
    var dur = R.rnd(45, 65);
    var beat = R.rnd(0.4, 0.52);               // quickstep — unrelated to the meeting's time
    var trans = R.pickW([[9 / 8, 3], [4 / 3, 2], [16 / 9, 1]]);   // its own key, justly tuned to itself
    var fromLeft = R.chance(0.5);

    // the visiting band's own wire into the hall
    var bus = S.ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    var pan = S.ctx.createStereoPanner();
    pan.pan.setValueAtTime(fromLeft ? -0.95 : 0.95, t);
    pan.pan.linearRampToValueAtTime(fromLeft ? 0.95 : -0.95, t + dur);
    bus.connect(pan);
    pan.connect(wideSend());                    // outside the windows: all tabernacle
    // approach — cross — recede
    bus.gain.linearRampToValueAtTime(0.4, t + dur * 0.45);
    bus.gain.setValueAtTime(0.4, t + dur * 0.6);
    bus.gain.linearRampToValueAtTime(0.0001, t + dur);

    // the tune: the day's theme as a quickstep, or a jaunty default
    var degs = theme && theme.notes.length >= 4
      ? theme.notes.map(function (n) { return n.deg; })
      : [0, 2, 4, 4, 5, 4, 2, 0, 2, 4, 5, 7, 5, 4, 2, 1];

    // fife: one continuous reed, tongued with the gain gate
    var fife = S.ctx.createOscillator();
    fife.type = "sawtooth";
    var flp = S.ctx.createBiquadFilter();
    flp.type = "lowpass";
    flp.frequency.setValueAtTime(2000, t);
    var fart = S.ctx.createGain();
    fart.gain.setValueAtTime(0, t);
    fife.connect(flp); flp.connect(fart); fart.connect(bus);
    // bass: the oom and the pah
    var oom = S.ctx.createOscillator();
    oom.type = "sine";
    var og = S.ctx.createGain();
    og.gain.setValueAtTime(0, t);
    oom.connect(og); og.connect(bus);

    // how near the band is (0..1) at a moment — the same approach/cross/recede
    // as its bus gain, for the page's ink
    function nearness(at) {
      var x = (at - t) / dur;
      return x < 0.45 ? x / 0.45 : x < 0.6 ? 1 : Math.max(0, 1 - (x - 0.6) / 0.4);
    }
    var tt = t, di = 0, soundEnd = t + dur;         // (the last note told, for the span)
    while (tt < t + dur - beat) {
      var deg = degs[di % degs.length];
      var nd = Math.min(2, 0.9 + (di % 4 === 0 ? 0.5 : 0)) * beat;
      var f = degFreq(projDeg(deg)) * trans * 2;               // fife register
      fife.frequency.setValueAtTime(f, tt);
      fart.gain.setValueAtTime(0.0001, tt);
      fart.gain.linearRampToValueAtTime(0.5, tt + 0.03);
      fart.gain.setValueAtTime(0.5, tt + nd * 0.7);
      fart.gain.linearRampToValueAtTime(0.08, tt + nd * 0.95); // the tongue lifts
      emitNote("band", f, tt, nd, guestNote(V, "bands", { part: "melody", beat: beat, loud: nearness(tt) }));
      tt += nd; di++;
      if (tt > soundEnd) soundEnd = tt;
    }
    var bt = t, bar = 0;
    while (bt < t + dur - beat) {
      var bf = degFreq(projDeg(bar % 2 === 0 ? 0 : 4)) * trans / 2;   // oom on the root, pah on the fifth
      oom.frequency.setValueAtTime(bf, bt);
      og.gain.setValueAtTime(0.0001, bt);
      og.gain.linearRampToValueAtTime(0.55, bt + 0.02);
      og.gain.linearRampToValueAtTime(0.0001, bt + beat * 0.8);
      emitNote("band", bf, bt, beat, guestNote(V, "bands", { part: "bass", beat: beat, loud: nearness(bt) }));
      if (bt + beat > soundEnd) soundEnd = bt + beat;
      bt += beat * 2; bar++;
    }
    fife.start(t); fife.stop(t + dur + 0.5);
    oom.start(t); oom.stop(t + dur + 0.5);

    tell(V, { type: "guest", guest: "bands", stage: "approaches", from: fromLeft ? "west" : "east",
              cat: "visitation", label: "⇋ a band approaches", detail: (fromLeft ? "from the west" : "from the east") + " · its own key" });
    cueAt("guests", tc + dur * 0.5, function () {
      tell(V, { type: "guest", guest: "bands", stage: "cross", cat: "visitation", label: "⇋ the bands cross", detail: "two times at once" });
    });
    cueAt("guests", tc + dur, function () {
      tell(V, { type: "guest", guest: "bands", stage: "passes", cat: "visitation", label: "⇋ passes on", detail: "" });
    });
    // the span is the band's sound, counted from the cue: it steps off 0.4 s
    // after it, and its last note may ring a moment past the fade (round 2)
    return soundEnd - tc;
  }

  // ==========================================================================
  // FROM THE STEEPLES (after Ives, 'From the Steeples and the Mountains'):
  // the meetinghouse bell rings, and two or three far steeples answer from
  // the edges of the valley — each in ITS OWN key, each keeping its one fixed
  // pitch on its own slow period, phasing against the home bell for a minute.
  // Bells are landscape, not conversation: no air is claimed, the meeting
  // carries on beneath them, and the visitors are never engraved on the page
  // (not one of ours). The home bell has the first word and the last.
  // ==========================================================================
  // (the steeples' keys and the times of their strikes are musical; where
  // each stands in the valley and how loud it carries are synth:steeples)
  var BELL_RING_S = 7;                           // how long a strike is told as ringing
  function steeplesAnswer(V, tc) {
    var R = stream("guest:steeples");
    var Y = synth("steeples");
    var t = tc + 0.3;
    // the whole minute: the section waits for the last bell (round 2 — the
    // conductor holds the joint while a guest sounds), so the steeples are no
    // longer cut short to fit what was left of it
    var dur = R.rnd(45, 75);

    // the home steeple — center field, the same bell the joints ring
    var homeBase = harm(R.pick([4, 5, 6]));
    while (homeBase > 700) homeBase /= 2;
    while (homeBase < 300) homeBase *= 2;
    var ringAmt = getLayerParam("bells", "ring", 0.55);
    var homeGain = 0.6 * ringAmt;

    // the visitors: fixed transposed bases drawn without replacement — a bell
    // keeps its key; a festive Sunday wakes a third steeple
    var pool = [9 / 8, 4 / 3, 16 / 9, 6 / 5];
    var nVis = S.Meeting.sunday().bells >= 0.8 && R.chance(0.7) ? 3 : 2;
    var visitors = [];
    for (var v = 0; v < nVis; v++) {
      var trans = pool.splice(R.rint(0, pool.length - 1), 1)[0];
      var base = homeBase * trans;
      while (base > 700) base /= 2;
      while (base < 300) base *= 2;
      // its own wire: the haze of distance, one fixed seat at a field edge
      var g = S.ctx.createGain();
      g.gain.setValueAtTime(1, t);
      var lp = S.ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(2400, t);
      var pan = S.ctx.createStereoPanner();
      pan.pan.setValueAtTime((v % 2 === 0 ? 1 : -1) * Y.rnd(0.7, 0.95), t);
      g.connect(lp); lp.connect(pan); pan.connect(wideSend());                   // a far steeple: all tabernacle
      visitors.push({ base: base, dest: g, period: R.rnd(5.5, 11), gain: homeGain * Y.rnd(0.35, 0.5) });
    }

    // every strike scheduled upfront at absolute times (the bands precedent)
    var all = [];
    // the home steeple: first word, steady period, and the last bell alone
    var homeTimes = [t];
    var ht = t + R.rnd(7, 9);
    while (ht < t + dur - 6) { homeTimes.push(ht + R.rnd(-0.4, 0.4)); ht += R.rnd(7, 9); }
    homeTimes.push(t + dur - R.rnd(0.5, 1.5));
    for (var h = 0; h < homeTimes.length; h++) {
      all.push({ at: homeTimes[h], base: homeBase, home: true, gain: homeGain * (h === homeTimes.length - 1 ? 0.9 : 1) });
    }
    for (var v2 = 0; v2 < visitors.length; v2++) {
      var vis = visitors[v2];
      var times = [];
      var vt = t + 3.5 + v2 * R.rnd(2, 4);                     // each answers in turn
      var lastAt = t + dur * R.rnd(0.72, 0.85);                // gone before the last bell
      while (vt < lastAt) { times.push(vt + R.rnd(-0.4, 0.4)); vt += vis.period; }
      for (var k = 0; k < times.length; k++) {
        // ring in over the first two strikes, taper over the final two
        var m = k === 0 ? 0.55 : k === 1 ? 0.85 : k >= times.length - 1 ? 0.45 : k >= times.length - 2 ? 0.75 : 1;
        all.push({ at: times[k], base: vis.base, home: false, dest: vis.dest, gain: vis.gain * m });
      }
    }
    // sparse overlap is the texture; simultaneity is clangor — nudge collisions
    all.sort(function (a, b) { return a.at - b.at; });
    for (var s2 = 1; s2 < all.length; s2++) {
      if (all[s2].at - all[s2 - 1].at < 0.6) all[s2].at = all[s2 - 1].at + 0.7;
    }
    var ringEnd = t + dur;
    for (var s3 = 0; s3 < all.length; s3++) {
      var st = all[s3];
      if (st.home) {
        bellStrike(st.at, st.gain, st.base, panAt("bells", Y.rnd(-0.2, 0.2)), { hum: true });
        emitNote("bells", 0, st.at, BELL_RING_S, guestNote(V, "steeples"));
      } else {
        bellStrike(st.at, st.gain, st.base, st.dest, { hum: false });
      }
      if (st.at + BELL_RING_S > ringEnd) ringEnd = st.at + BELL_RING_S;
    }

    tell(V, { type: "guest", guest: "steeples", stage: "answer", bells: nVis, dur: dur,
              cat: "visitation", label: "◎ the steeples answer", detail: nVis + " far bells · " + Math.round(dur) + "s" });
    cueAt("guests", tc + dur, function () {
      tell(V, { type: "guest", guest: "steeples", stage: "last-bell", cat: "visitation", label: "◎ the last bell", detail: "" });
    });
    // the span runs until the last bell has rung out, not until it is struck:
    // the prelude or the postlude waits for the ring (round 2)
    return ringEnd - tc;
  }

  // ==========================================================================
  // THE OLD TUNE, HALF-REMEMBERED (after Ives's borrowings): once in a great
  // while, far off at the edge of the field, a REAL hymn — one the colony
  // carried out from Earth — surfaces for its first line or two, maybe a
  // fainter second try at its head, and is gone. The engine's only
  // quotation of pre-existing music.
  //
  // THE TUNES are the Earth tunes (kolob-tunes.js, KOLOB.Tunes; round 2,
  // milestone 3): every one taken down again from a public-domain printing
  // and heard by the owner in the Earth Tunes Lab. v0.30's seven incipits,
  // drafted from hymnary.org's digits with guessed rhythms, were wrong, and
  // are gone. The guest sings the MELODY of the tune's first line, or of its
  // first two, in the book's own rhythm — a tie held, a rest between lines
  // kept, a breath at the line's end — at a remembered tempo, slower than
  // the book's. It reads only KOLOB.Tunes' public surface (list, byId), so a
  // tune added there joins the pool with nothing to change here.
  //
  // Unengraved: the memory comes from outside the valley (or outside the
  // present), so the page never prints it and the clerk's row is its only
  // record — its notes are reported on a layer of their own, "oldtune",
  // which the page does not engrave (round 2: every sounded note is told;
  // each names the Earth tune, the line and the beat it was written at).
  //
  // THE MODE LAW (v0.30's inversion rule, made exact). A memory surfaces only
  // on a Sunday of its own colour: the minor tunes (the Earth tune's mode
  // aeolian or dorian) on dark Sundays, the major ones on bright Sundays — a
  // minor tune recoloured major is the wrong tune, and so is the reverse.
  // And only where the day's tuning holds EVERY note of the melody it will
  // sing, exactly: each note's pitch (its monzo, with the comma the book's
  // harmony leaned it by taken back out — the harmony is not heard) must be
  // the day's own pitch for its degree. So a line that sings ti waits for an
  // ionian Sunday (the mixolydian ti is flat); one that sings fa or ti never
  // comes on a pentatonic Sunday (penta folds them away), nor ti on a
  // hexatonic one; a minor line that sings le waits for aeolian (dorian
  // raises it); and a chromatic note keeps a line out altogether. Computed
  // from the tunes, never hand-listed. KINGSFOLD — the house hymn, "If You
  // Could Hie to Kolob" (LDS #284) — is weighed double among the tunes the
  // Saints sing, and those above the tradition's tunes they do not.
  //
  // A MEMORY IS A WHOLE THOUGHT (round 2, the critic's ear). A tune whose
  // opening the day holds only in a short first line — SIMPLE GIFTS on a
  // mixolydian or hexatonic Sunday (its second line sings ti); DESERET,
  // MARTYR and NETTLETON on a pentatonic one — came and went in five or six
  // seconds, where v0.30's memories lasted twelve to sixteen. So a tune
  // surfaces only where the lines the day holds last MIN_MEMORY_S even at
  // the quickest remembered tempo; every mode keeps tunes enough (the pool
  // is printed by the harness), so the old tune comes as often as it did.
  // ==========================================================================
  var COMMA = [-4, 4, -1, 0];                          // 81/80, the syntonic comma
  var DARK = { aeolian: true, dorian: true };
  var HOUSE_HYMN = "earth:kingsfold";
  var OLD_TUNE_CENTRE = 8;                             // where the memory sits: a 7-space degree above the keynote (v0.30's register)
  var OLD_TUNE_CEILING = 14;                           // …and never above do two octaves up, where the far voice's lowpass stands
  var TEMPO_MIN = 1.15, TEMPO_MAX = 1.45;              // the remembered tempo: the book's beat held this much longer
  var MIN_MEMORY_S = 8;                                // the shortest memory, at the quickest remembered tempo
  function earthTunes() { return (KOLOB.Tunes && KOLOB.Tunes.list) || []; }
  function openingLines(h) { return (h.lines || []).concat(h.refrain || []); }
  // does the day's tuning hold this melody note, exactly?
  function holds(mode, n) {
    if (n.alt) return false;                           // a chromatic note: no day holds it
    var P = KOLOB.Pitch, col = P.COLLECTIONS[mode], cls = ((n.deg % 7) + 7) % 7;
    if (cls > 0 && col.map[cls] === col.map[cls - 1]) return false;   // folded away (penta's fa and ti, hexa's ti)
    var c = n.comma || 0;
    var plain = P.octaveReduce(P.mul(n.monzo, [-c * COMMA[0], -c * COMMA[1], -c * COMMA[2], 0]));
    return plain.join() === P.MODE_MONZOS[mode][col.map[cls]].join();
  }
  // how many of a tune's opening lines this Sunday can hold: 0, 1 or 2
  function linesHeld(h, mode) {
    if (!!DARK[h.mode] !== !!DARK[mode]) return 0;
    var ls = openingLines(h), k = 0;
    while (k < 2 && ls[k] && (ls[k].notes[h.melodyPart] || []).every(function (n) { return holds(mode, n); })) k++;
    return k;
  }
  function tuneWeight(h) {
    if (h.id === HOUSE_HYMN) return 6;
    var L = h.lds;
    var sung = !!(L && ((L.hymns1985 && L.hymns1985.length) || (L.homeAndChurch && L.homeAndChurch.length)));
    return sung ? 3 : 1.5;
  }
  // how many opening lines the memory may sing on this Sunday: the lines the
  // law lets the day hold, if they make a whole thought — else none
  function linesAdmitted(h, mode) {
    var k = linesHeld(h, mode);
    return k > 0 && beatsOf(excerpt(h, k)) * h.beatS * TEMPO_MIN >= MIN_MEMORY_S ? k : 0;
  }
  // the pool for the day's mode: [[{id, lines}, weight], …] in the book's order
  function oldTuneCandidates(mode) {
    var m = mode || S.mode, pool = [];
    earthTunes().forEach(function (h) {
      var k = linesAdmitted(h, m);
      if (k > 0) pool.push([{ id: h.id, lines: k }, tuneWeight(h)]);
    });
    return pool;
  }
  // The melody of a tune's first k lines, as the memory holds it: ties
  // held as one note, each note's rest after it (a line's start in the book,
  // less where the line before it ended), a breath at every line's end.
  //   → [{ deg, beats, restAfter, breath, line, index, beat, monzo }]
  function excerpt(h, k) {
    var ls = openingLines(h), out = [], at = 0;
    for (var li = 0; li < k && li < ls.length; li++) {
      var ln = ls[li], mel = ln.notes[h.melodyPart] || [];
      var start = ln.startBeat != null ? ln.startBeat : at;
      if (out.length) out[out.length - 1].restAfter += Math.max(0, start - at);
      for (var i = 0; i < mel.length; i++) {
        var n = mel[i], prev = out[out.length - 1];
        if (prev && prev.tie && prev.line === li) { prev.beats += n.beats; prev.tie = n.tie; continue; }
        out.push({ deg: n.deg, beats: n.beats, restAfter: 0, breath: false, tie: n.tie, line: li, index: i, beat: n.beat, monzo: n.monzo, comma: n.comma || 0 });
      }
      if (out.length) out[out.length - 1].breath = true;
      at = start + KOLOB.Score.lineLength(ln);
    }
    return out;
  }
  function beatsOf(notes) { var b = 0; notes.forEach(function (n) { b += n.beats + n.restAfter; }); return b; }
  // The register: the octave that sets the excerpt's middle nearest where
  // v0.30's memories sat. A tune's tenor melody (the Sacred Harp's) is
  // written low; it rises to the same far place. On a tie the lower octave,
  // and a lower one again where the top would pass the ceiling, if the
  // bottom stays at the keynote or above (round 2, the critic: MARTYR's tie
  // rounded up and sang to 1.3 kHz, over the far voice's lowpass and far
  // over v0.30's memories, which never passed about 880 Hz).
  function octaveFor(notes) {
    var lo = Infinity, hi = -Infinity;
    notes.forEach(function (n) { if (n.deg < lo) lo = n.deg; if (n.deg > hi) hi = n.deg; });
    var o = Math.ceil((OLD_TUNE_CENTRE - (lo + hi) / 2) / 7 - 0.5);
    while (hi + 7 * o > OLD_TUNE_CEILING && lo + 7 * (o - 1) >= 0) o--;
    return o;
  }
  // THE LEAP SUNG PURE (round 2, the critic's ear; PLAN §2.4's comma
  // tracking). The day's fixed tuning makes one fourth and one fifth a comma
  // wide — te to me in the minor modes (27/20: KINGSFOLD's "voice of
  // Je-sus", in the house hymn), re to la in the major (40/27) — and no
  // singer leaps a wolf. Where the memory leaps a fourth or a fifth within
  // a line (a breath between lines lets the singer take the next pitch from
  // the drone again) that the day's pitches make a wolf, one of the two
  // notes leans a syntonic comma and the leap rings pure: the one whose
  // leaned pitch is the simpler ratio over the keynote, the drone's nearer
  // kin — so te rises to 9/5 (not me falling to 32/27), and re falls to
  // 10/9, the choir's own ii re (not la rising to 27/16). A lean that takes
  // a note further from the drone than a hair is never taken (in practice
  // only re and te ever lean, as a just choir leans them: a note of the
  // drone's own chords never wavers); nor one that would sour the other
  // neighbour; a run of one note leans together (never a comma jump on a
  // repeated note). The law is unchanged — the day holds every note; the
  // lean is how a singer tunes the leap. No die is thrown.
  //   ms: the day's monzos, in the order sung; joined[i]: note i follows
  //   note i-1 in the same breath → the comma each leans (-1, 0, +1)
  var LEAN_HAIR = 0.5;                                  // how much further from the drone a lean may take a note (bits of Tenney height)
  function leanBy(m, c) { return c ? KOLOB.Pitch.mul(m, [COMMA[0] * c, COMMA[1] * c, COMMA[2] * c, 0]) : m; }
  function wolfLeap(a, b) {
    var d = KOLOB.Pitch.div(b, a), c = KOLOB.Pitch.cents(d);
    var semi = Math.round((((c % 1200) + 1200) % 1200) / 100) % 12;
    if (semi === 7) return !(d[1] === 1 && d[2] === 0 && d[3] === 0);       // a fifth: 3/2, or the wolf 40/27
    if (semi === 5) return !(d[1] === -1 && d[2] === 0 && d[3] === 0);      // a fourth: 4/3, or the wolf 27/20
    return false;
  }
  function tenney(m) {                                   // how far a pitch is from the drone: log2 of n·d
    var r = KOLOB.Pitch.octaveReduce(m);
    return Math.abs(r[0]) + Math.abs(r[1]) * Math.log2(3) + Math.abs(r[2]) * Math.log2(5) + Math.abs(r[3]) * Math.log2(7);
  }
  function leapLeans(ms, joined) {
    var lean = ms.map(function () { return 0; });
    function at(i) { return leanBy(ms[i], lean[i]); }
    function tied(i) { return !joined || !!joined[i]; }   // note i follows i-1 in one breath
    function same(i, j) { return ms[i].join() === ms[j].join() && lean[i] === lean[j]; }
    // a neighbour in the same breath that the lean would sour
    function sours(x, y, m, left) { return left ? wolfLeap(at(x), m) && !wolfLeap(at(x), at(y)) : wolfLeap(m, at(y)) && !wolfLeap(at(x), at(y)); }
    for (var i = 1; i < ms.length; i++) {
      if (!tied(i) || !wolfLeap(at(i - 1), at(i))) continue;
      var best = null;
      [i - 1, i].forEach(function (j) {
        if (lean[j]) return;                             // a note leans once
        var lo = j, hi = j;
        while (lo > 0 && tied(lo) && same(lo - 1, j)) lo--;
        while (hi < ms.length - 1 && tied(hi + 1) && same(hi + 1, j)) hi++;
        [-1, 1].forEach(function (c) {
          var m = leanBy(ms[j], c), ok = tenney(m) <= tenney(ms[j]) + LEAN_HAIR;
          // the leap it is for rings pure, and neither neighbour of the run sours
          if (j === i ? wolfLeap(at(i - 1), m) : wolfLeap(m, at(i))) ok = false;
          if (lo > 0 && lo - 1 !== i - 1 && tied(lo) && sours(lo - 1, lo, m, true)) ok = false;
          if (hi < ms.length - 1 && hi + 1 !== i && tied(hi + 1) && sours(hi, hi + 1, m, false)) ok = false;
          if (ok && (!best || tenney(m) < best.h - 1e-9)) best = { lo: lo, hi: hi, c: c, h: tenney(m) };
        });
      });
      if (best) for (var k = best.lo; k <= best.hi; k++) lean[k] = best.c;
    }
    return lean;
  }
  // The pool as the tune lab reads it (KolobAudio.getOldTunes): v0.30's
  // shape — name, weight, minor, [[deg, beats]] of the first line, in the
  // lab's register (it adds an octave, as v0.30's farVoice did) — and, new,
  // the Earth tune's id and the modes the law lets it surface in.
  function oldTunePool() {
    var MODES = KOLOB.Pitch.MODE_NAMES;
    return earthTunes().map(function (h) {
      var ex = excerpt(h, 1), o = octaveFor(ex);
      return {
        id: h.id, name: String(h.nameEn || h.id).toLowerCase(), w: tuneWeight(h), minor: !!DARK[h.mode],
        notes: ex.map(function (n) { return [n.deg + 7 * o - 7, n.beats]; }),
        modes: MODES.filter(function (m) { return linesAdmitted(h, m) > 0; }),
      };
    });
  }

  // the far voice — a self-contained carrier for the memory: soft triangle
  // with a breath of octave, dulled by distance, at the field's edge, all
  // tail. Not one of the console's instruments; it has no stop. Its notes
  // are {f, dur, restAfter, breath, tell}; a line's end draws a breath (the
  // swell dips and comes back), a rest lets the sound down between lines.
  //
  // THE PRE-v0.34 POLISH (the round-2 Listener; PLAN-COMPOSITION §15). The
  // memory was as loud as the hymn (−25 dB in the 300 Hz–4 kHz band against
  // the hymn's −28) and could not say a repeated note: it glided into every
  // note and dipped only at breaths, so MARTYR's "Praise to the" (do–do–do)
  // was one 1.8 s swell, and 76 of the 367 steps in the tunes' first two
  // lines are repeated notes. Now:
  //   · it sits OLD_TUNE_DB (−7 dB) under where it stood — a memory, not a
  //     second hymn;
  //   · every note is struck: the level dips for about 50 ms at each onset,
  //     a light lift between two pitches and a real re-strike (down to a
  //     fifth of itself) where a note repeats, so the rhythm of the book is
  //     heard — the dotted pickup, the repeated tones;
  //   · the glide into a new pitch is short (at most 60 ms, inside the dip),
  //     a voice placing its note, not a slide;
  //   · the first note speaks at once (an attack of 0.12 s, not a 1.2 s
  //     swell that swallowed the pickup), and the memory still fades as it
  //     goes.
  var OLD_TUNE_DB = -7;
  var ONSET_DIP = { lift: 0.62, restrike: 0.2, down: 0.03, up: 0.045 };
  function farVoice(t, notes, gainMul, side) {
    var o = S.ctx.createOscillator(); o.type = "triangle";
    var o2 = S.ctx.createOscillator(); o2.type = "sine";
    var g2 = S.ctx.createGain(); g2.gain.setValueAtTime(0.1, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1200, t);
    var g = S.ctx.createGain();
    var pn = S.ctx.createStereoPanner(); pn.pan.setValueAtTime(side, t);
    o.connect(lp); o2.connect(g2); g2.connect(lp);
    lp.connect(g); g.connect(pn); pn.connect(wideSend());                    // the memory, at the field's edge: all tabernacle
    var tt = t, prevF = 0, dips = [], onsets = [];
    for (var i = 0; i < notes.length; i++) {
      var f = notes[i].f;
      if (i === 0) {
        o.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f * 2, t);
      } else {
        // a new pitch is placed inside the onset's dip; a repeated one is
        // struck again on the same pitch (the glide v0.32 made of it is gone)
        var same = Math.abs(f / prevF - 1) < 1e-4;
        if (!same) {
          var port = Math.min(0.06, notes[i].dur * 0.1);
          o.frequency.setValueAtTime(prevF, tt);
          o.frequency.linearRampToValueAtTime(f, tt + port);
          o2.frequency.setValueAtTime(prevF * 2, tt);
          o2.frequency.linearRampToValueAtTime(f * 2, tt + port);
        }
        // (an onset that follows a breath or a rest is already articulated)
        var prev = notes[i - 1];
        if (!(prev.breath || prev.restAfter > 0)) onsets.push({ at: tt, depth: same ? ONSET_DIP.restrike : ONSET_DIP.lift });
      }
      if (notes[i].tell) notes[i].tell(tt);
      prevF = f;
      tt += notes[i].dur;
      if (i < notes.length - 1 && (notes[i].breath || notes[i].restAfter > 0)) dips.push({ at: tt, rest: notes[i].restAfter || 0 });
      tt += notes[i].restAfter || 0;
    }
    var total = tt - t;
    // the swell: in at once, easing to 0.85 of itself, out over the last
    // 1.6 s — a breath at each line's end and a lift at each onset on the way
    var ATK = 0.12;
    var peak = 0.14 * Math.pow(10, OLD_TUNE_DB / 20) * (gainMul || 1);
    var relAt = t + ATK + Math.max(0.4, total - 1.5);
    function level(x) { return peak * (1 - 0.15 * Math.min(1, Math.max(0, (x - t - ATK) / Math.max(0.4, total - 1.5)))); }
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + ATK);
    // the breaths and the onsets, in time order, never overlapping each other
    var marks = dips.map(function (d) { return { t0: d.at - 0.18, t1: d.at + d.rest + 0.22, breath: d }; })
      .concat(onsets.map(function (n) { return { t0: n.at - ONSET_DIP.down, t1: n.at + ONSET_DIP.up, onset: n }; }))
      .sort(function (a, b) { return a.t0 - b.t0; });
    var cursor = t + ATK;
    marks.forEach(function (m) {
      if (m.t0 <= cursor + 0.005 || m.t1 >= relAt - 0.05) return;         // nothing inside the attack, the fade, or another mark
      g.gain.linearRampToValueAtTime(level(m.t0), m.t0);
      if (m.breath) {
        var d = m.breath;
        g.gain.linearRampToValueAtTime(level(d.at) * (d.rest > 0 ? 0.12 : 0.35), d.at + Math.min(0.1, d.rest));
        if (d.rest > 0.25) g.gain.linearRampToValueAtTime(level(d.at) * 0.12, d.at + d.rest - 0.05);
      } else {
        g.gain.linearRampToValueAtTime(level(m.onset.at) * m.onset.depth, m.onset.at + 0.004);
      }
      g.gain.linearRampToValueAtTime(level(m.t1), m.t1);
      cursor = m.t1;
    });
    g.gain.linearRampToValueAtTime(peak * 0.85, relAt);
    g.gain.linearRampToValueAtTime(0, relAt + 1.6);
    o.start(t); o.stop(t + total + 2);
    o2.start(t); o2.stop(t + total + 2);
    return total;
  }

  function oldTuneRemembered(V, tc) {
    var R = stream("guest:oldtune");
    // every die first, whether it is used or not (SCORE §3)
    var tempoDie = R.rnd(TEMPO_MIN, TEMPO_MAX);  // its own remembered tempo: slower than the book's
    var twoDie = R.chance(0.5);                  // the second line too
    var dropDie = R.chance(0.5), dropAt = R.rnd(0, 1);
    var holdDie = R.chance(0.4), holdAt = R.rnd(0, 1);
    var againDie = R.chance(0.6), gapS = R.rnd(6, 10);
    var side = synth("oldtune").pick([-0.85, 0.85]);   // which edge of the field: sound-level
    var det = Math.pow(2, 8 / 1200);             // 8 cents sharp of true — worn
    var pick = V && V.tune, h = pick && KOLOB.Tunes && KOLOB.Tunes.byId(pick.id);
    if (!h) return 4;
    var t = tc + 0.6;
    var beatS = h.beatS * tempoDie;
    // a line, or two: two when the dice say so or the first alone is short
    // (a six-syllable line is half a thought), when the day holds the
    // second, and when the two are not so long that the memory outstays
    var one = excerpt(h, 1), two = pick.lines >= 2 ? excerpt(h, 2) : null;
    var nLines = two && (twoDie || beatsOf(one) * beatS < 9) && beatsOf(two) * beatS <= 26 ? 2 : 1;
    var notes = nLines === 2 ? two : one;
    var oct = octaveFor(notes);
    // seeded wear — never the first two notes; recognition lives in the head
    var dropped = null, held = null;
    if (dropDie && notes.length > 4) {
      var di = 2 + Math.floor(dropAt * (notes.length - 3));
      var gone = notes[di], keep = notes[di - 1];
      keep.beats += keep.restAfter + gone.beats;  // a note dropped, its neighbour held wrong in its place
      keep.restAfter = gone.restAfter; keep.breath = gone.breath;
      notes.splice(di, 1);
      dropped = gone.index + (gone.line ? "@" + gone.line : "");
    }
    if (holdDie && notes.length > 2) {
      var hi = 2 + Math.floor(holdAt * (notes.length - 2));
      notes[hi].beats *= 1.6;
      held = notes[hi].index + (notes[hi].line ? "@" + notes[hi].line : "");
    }
    var perf = KOLOB.Score.performance({
      hymnId: h.id, verse: 0, practice: "hummed", tempoMul: tempoDie, rubato: 0, organ: null, singers: [],
      // (round 2's additions: which lines, the octave it is set in, the wear, the worn tuning)
      lines: nLines === 2 ? [0, 1] : [0], octave: oct, beatS: beatS, wear: { dropped: dropped, held: held }, detuneCents: 8,
    });
    // each note, as the far voice sings it: its pitch the day's own for its
    // degree (the law made sure), set an octave `oct` from where it is
    // written — and a leap the day would sing as a wolf, sung pure (each try
    // is tuned as it is sung: the head alone leaps only what the head leaps)
    function sung(ns, try2) {
      var idxs = ns.map(function (n) { return projDeg(n.deg + 7 * oct); });
      var ms = idxs.map(function (idx) { return KOLOB.Pitch.degMonzo(S.mode, idx); });
      var lean = leapLeans(ms, ns.map(function (n, i) { return i > 0 && n.line === ns[i - 1].line; }));
      return ns.map(function (n, i) {
        var d = n.deg + 7 * oct, c = lean[i];
        var f = degFreq(idxs[i]) * det * (c ? Math.pow(81 / 80, c) : 1), dur = n.beats * beatS;
        return {
          f: f, dur: dur, restAfter: try2 ? 0 : n.restAfter * beatS, breath: !try2 && n.breath,
          tell: function (at) {
            emitNote("oldtune", f, at, dur, guestNote(V, "oldtune", { part: h.melodyPart, hymnId: h.id, line: n.line, index: n.index, beat: n.beat,
                                                                      deg: d, monzo: leanBy(ms[i], c), comma: c, tryNo: try2 ? 2 : 1 }));
          },
        };
      });
    }
    var dur1 = farVoice(t, sung(notes, false), 1.0, side);
    var total = dur1;
    var name = String(h.nameEn || h.id).toLowerCase();
    tell(V, { type: "guest", guest: "oldtune", stage: "remembered", tune: h.id, nameDs: h.nameDs, section: S.Meeting.section(), lines: nLines, performance: perf,
              cat: "visitation", label: "✧ an old tune remembered", detail: name + " · " + S.Meeting.section() });
    if (againDie) {
      // a fainter second try — the head only, trailing off
      var head = notes.slice(0, Math.min(5, notes.length - 1));
      var t2 = t + dur1 + gapS;
      var dur2 = farVoice(t2, sung(head, true), 0.6, side);
      total = dur1 + gapS + dur2;
      cueAt("guests", t2 + dur2, function () {
        tell(V, { type: "guest", guest: "oldtune", stage: "gives-out", tune: h.id, cat: "visitation", label: "✧ the memory gives out", detail: name });
      });
    }
    return total + 4;
  }

  // ==========================================================================
  // THE TROMBONE CHOIR AT DAWN (round 2; PLAN-COMPOSITION §14, item 3). In
  // Bethlehem the Moravians' trombones climb the belfry to play chorales
  // down onto the sleeping town; in Salem the Easter sunrise begins with
  // brass choirs in different streets, playing a hymn to one another, a
  // phrase here and the next phrase there. The colony keeps the custom. The
  // plan drew the moment and wrote the chorale (the day's first hymn, as
  // Harmony sets the day's theme — see dawnChorale in kolob-meeting.js); the
  // guest's own room (kolob-guest-trombones.js) places the two choirs, one
  // far across the settlement and one near on the other side, through the
  // guests' door into the tabernacle. Here it is played at t and told:
  //   · the far choir's first call    — ♪ trombones at dawn
  //   · the near choir's first answer — ♪ the near choir answers
  //   · the far choir joining the last chord, when it does
  //                                   — ♪ the two choirs together
  // Its notes are reported on their own layer (trombones), named as the
  // guest's; the staff does not engrave them (a visitor's, like the old
  // tune's). It claims the air for its length, and the organ, the harmonium
  // and the strings rest their hands while it sounds (S.hallListens): the
  // first hymn is heard before anyone sings it.
  // ==========================================================================
  function trombonesAtDawn(V, tc) {
    var G = KOLOB.GuestTrombones;
    if (!G || !V || !V.material || !V.stream) return 4;
    var calls = [];                               // [stage, t, side] — the rows to tell
    var end = G.perform(S.ctx, wideSend(), tc, V.material, V.stream, {
      onNote: function (x) {
        emitNote("trombones", x.freq, x.t, x.dur, guestNote(V, "trombones", { part: x.part, choir: x.choir, line: x.line, loud: x.loud }));
      },
      onPhrase: function (ph) {
        var side = ph.pan < 0 ? "west" : "east";
        if (ph.joins) calls.push(["together", ph.t0, side]);
        else if (ph.choir === "far" && !calls.some(function (c) { return c[0] === "far"; })) calls.push(["far", ph.t0, side]);
        else if (ph.choir === "near" && !calls.some(function (c) { return c[0] === "answer"; })) calls.push(["answer", ph.t0, side]);
      },
    });
    claimAir(end - tc, 3);
    var ROWS = {
      far: ["♪ trombones at dawn", function (c) { return "far to the " + c[2]; }],
      answer: ["♪ the near choir answers", function (c) { return "from the " + c[2]; }],
      together: ["♪ the two choirs together", function () { return "the last chord"; }],
    };
    calls.forEach(function (c) {
      function say() {
        tell(V, { type: "guest", guest: "trombones", stage: c[0], side: c[2], section: S.Meeting.section(),
                  cat: "visitation", label: ROWS[c[0]][0], detail: ROWS[c[0]][1](c) });
      }
      if (c[1] <= tc + 1e-6) say();               // the far choir's first call is now
      else cueAt("guests", c[1], say);
    });
    // the span: the choirs' last chord, and the town's air a moment after it
    return end - tc + 2;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.razzCluster = razzCluster;
  S.cumulativeAssembly = cumulativeAssembly;
  S.unansweredQuestion = unansweredQuestion;
  S.twoBandsCross = twoBandsCross;
  S.steeplesAnswer = steeplesAnswer;
  S.oldTunePool = oldTunePool;
  S.oldTuneCandidates = oldTuneCandidates;
  S.oldTuneRemembered = oldTuneRemembered;
  S.trombonesAtDawn = trombonesAtDawn;
  // the room's public face on the KOLOB namespace (the old tune's law and
  // excerpt are here for the harness and the labs: linesHeld(tune, mode),
  // linesAdmitted(tune, mode), excerpt(tune, k), octaveFor(notes),
  // leapLeans(monzos, joined), wolfLeap(a, b))
  KOLOB.Guests = {
    cumulativeAssembly: cumulativeAssembly, unansweredQuestion: unansweredQuestion, twoBandsCross: twoBandsCross, steeplesAnswer: steeplesAnswer,
    oldTuneRemembered: oldTuneRemembered, oldTuneCandidates: oldTuneCandidates, oldTunePool: oldTunePool, trombonesAtDawn: trombonesAtDawn,
    linesHeld: linesHeld, linesAdmitted: linesAdmitted, excerpt: excerpt, octaveFor: octaveFor, leapLeans: leapLeans, wolfLeap: wolfLeap,
    MIN_MEMORY_S: MIN_MEMORY_S, TEMPO_MIN: TEMPO_MIN,
  };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-guests.js"] = true;   // the load guard's roll call
})();

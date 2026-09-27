// ============================================================================
// KOLOB — kolob-guests.js: the visitations
//
// The raspberry amen's cluster, the cumulative assembly, and the Ives
// guests: the unanswered question, two bands crossing, the steeples, the
// old tune half-remembered. Split from kolob-audio.js (v0.30); see the room
// list in kolob-core.js.
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
    emitEvent({ cat: "visitation", label: "✶ the whole tune, at last", detail: theme.name + " · " + (theme.gesture || "") + " · " + Math.round(dur) + "s" });
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
        S.reportLine("harmonium", aAt, anotes);
        // from the third answer the answerers argue among themselves
        // (FOR WHOEVER UNSHELVES THE QUESTION: the second rank is a PURE
        // fifth above each answer, and above a degree whose fifth is not in
        // the collection it is a pitch outside the day's tuning — the harness
        // lists it as off the tuning; take the collection's own fifth, as the
        // strings' pureFifth guard does, or rule that the argument may leave it)
        if (k >= 2) {
          var bnotes = anotes.map(function (n) { return { f: n.f * 1.5, dur: n.dur * R.rnd(0.8, 1) }; });
          renderHarmonium(aAt + abeat * 0.5, bnotes, 0.3 + k * 0.08);
          S.reportLine("harmonium", aAt + abeat * 0.5, bnotes, { part: "doubling" });
        }
        cursor = aAt + adur + R.rnd(2.5, 4.5) * Math.pow(0.85, k);
      } else {
        cursor = afterQ;                       // the last asking hangs
      }
    }
    var tail = 10;                             // the drone alone — no answer comes
    var total = (cursor - t) + tail;
    claimAir(total - 4, 6);
    emitEvent({ cat: "visitation", label: "? the question", detail: "×" + N + " askings · " + Math.round(total) + "s" });
    cueAt("guests", tc + (cursor - t + 1.5), function () {
      emitEvent({ cat: "visitation", label: "? unanswered", detail: "the drone alone" });
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
      emitNote("band", f, tt, nd, { part: "melody", beat: beat, loud: nearness(tt) });
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
      emitNote("band", bf, bt, beat, { part: "bass", beat: beat, loud: nearness(bt) });
      if (bt + beat > soundEnd) soundEnd = bt + beat;
      bt += beat * 2; bar++;
    }
    fife.start(t); fife.stop(t + dur + 0.5);
    oom.start(t); oom.stop(t + dur + 0.5);

    emitEvent({ cat: "visitation", label: "⇋ a band approaches", detail: (fromLeft ? "from the west" : "from the east") + " · its own key" });
    cueAt("guests", tc + dur * 0.5, function () {
      emitEvent({ cat: "visitation", label: "⇋ the bands cross", detail: "two times at once" });
    });
    cueAt("guests", tc + dur, function () {
      emitEvent({ cat: "visitation", label: "⇋ passes on", detail: "" });
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
        emitNote("bells", 0, st.at, BELL_RING_S);
      } else {
        bellStrike(st.at, st.gain, st.base, st.dest, { hum: false });
      }
      if (st.at + BELL_RING_S > ringEnd) ringEnd = st.at + BELL_RING_S;
    }

    emitEvent({ cat: "visitation", label: "◎ the steeples answer", detail: nVis + " far bells · " + Math.round(dur) + "s" });
    cueAt("guests", tc + dur, function () {
      emitEvent({ cat: "visitation", label: "◎ the last bell", detail: "" });
    });
    // the span runs until the last bell has rung out, not until it is struck:
    // the prelude or the postlude waits for the ring (round 2)
    return ringEnd - tc;
  }

  // ==========================================================================
  // THE OLD TUNE, HALF-REMEMBERED (after Ives's borrowings): once in a great
  // while, far off at the edge of the field, a REAL hymn — one the colony
  // would carry — surfaces for one worn phrase and maybe a fainter second
  // try, then is gone. The engine's only quotation of pre-existing music.
  //
  // The pool: public-domain melodies (all 19th-century or older) that live in
  // BOTH the LDS hymnal and the shared American congregational tradition.
  // Each entry is the tune's opening incipit only, in 7-degree space (deg 0 =
  // tonic; negatives below), verified against hymnary.org incipit indices.
  // Unengraved: the memory comes from outside the valley (or outside the
  // present), so the page never prints it and the clerk's row is its only
  // record — its notes are reported on a layer of their own, "oldtune",
  // which the page does not engrave (round 2: every sounded note is told).
  //
  // MODE LAW (the inversion rule): major memories surface only on major-ish
  // Sundays. KINGSFOLD — the house hymn, "If You Could Hie to Kolob" (LDS
  // #284), the traditional English tune of the Dives-and-Lazarus family —
  // is modal MINOR, so the rule inverts for it alone: it is the ONLY tune
  // that may surface on aeolian/dorian Sundays, and it never appears on
  // bright ones (a minor tune recolored major is the wrong tune, and so is
  // the reverse). On penta/hexa Sundays a tune is quotable only if its
  // degree classes survive the collection's fold (penta folds classes 3 and
  // 6; hexa folds 6) — computed, not hand-flagged.
  //
  // TODO (owner, 2026-07-06): ALL SEVEN INCIPITS NEED A TUNING PASS. The
  // owner ear-checked the pool in the tune lab (/art/kolob/tune-lab) and
  // judged every transcription off to some degree — these were drafted from
  // hymnary.org incipit digit indices with reconstructed rhythms, which is
  // not enough. Plan: re-transcribe each opening phrase against public-
  // domain sheet music of these tunes (all melodies predate 1900), degree by
  // degree and duration by duration, then re-verify in the lab's "plain"
  // mode. Only the OLD_TUNES arrays below should need to change; the lab
  // reads this table live via KolobAudio.getOldTunes().
  // ==========================================================================
  var OLD_TUNES = [
    { name: "all is well",     w: 3,   minor: false, notes: [[0, 1], [0, 1], [1, 1], [2, 1], [0, 2], [-1, 1], [0, 1], [1, 1], [2, 1], [3, 2]] },
    { name: "kingsfold",       w: 3,   minor: true,  notes: [[2, 1], [1, 1], [0, 1], [0, 1], [0, 2], [-1, 1], [2, 1], [2, 1], [3, 1], [2, 3]] },
    { name: "bethany",         w: 2.5, minor: false, notes: [[2, 1.5], [1, 0.5], [0, 1], [0, 1], [-2, 2], [-2, 1.5], [-3, 0.5], [0, 1], [2, 1], [1, 3]] },
    { name: "foundation",      w: 2,   minor: false, notes: [[-3, 1], [-2, 0.5], [0, 0.5], [-2, 1], [0, 1], [-3, 1], [0, 0.5], [0, 0.5], [2, 1], [0, 2]] },
    { name: "nettleton",       w: 1,   minor: false, notes: [[2, 1], [1, 0.5], [0, 0.5], [0, 1], [2, 1], [4, 1], [1, 0.5], [1, 0.5], [2, 1], [4, 2]] },
    { name: "simple gifts",    w: 2,   minor: false, notes: [[-3, 1], [-3, 1], [0, 1], [0, 0.5], [1, 0.5], [2, 0.5], [0, 0.5], [2, 0.5], [3, 0.5], [4, 1], [4, 0.5], [4, 0.5], [2, 1], [1, 0.5], [0, 0.5]] },  // Shaker; the Copland tune. From the Traditional Tune Archive incipit (C major): G G | c cd ec ef | g gg e dc — "'Tis the gift to be simple, 'tis the gift to be free"
    { name: "god be with you", w: 1,   minor: false, notes: [[2, 1], [2, 0.5], [2, 0.5], [2, 1], [2, 0.5], [2, 0.5], [4, 1], [1, 1], [2, 1], [5, 2]] },
  ];
  function tuneFitsMode(tn) {
    if (S.mode === "aeolian" || S.mode === "dorian") return !!tn.minor;  // dark Sundays: only the house hymn
    if (tn.minor) return false;                                      // and never elsewhere
    if (S.mode === "penta" || S.mode === "hexa") {
      for (var ci = 0; ci < tn.notes.length; ci++) {
        var cls = ((tn.notes[ci][0] % 7) + 7) % 7;
        if (cls === 6 || (S.mode === "penta" && cls === 3)) return false;
      }
    }
    return true;
  }
  function oldTuneCandidates() {
    var pool = [];
    for (var i = 0; i < OLD_TUNES.length; i++) if (tuneFitsMode(OLD_TUNES[i])) pool.push([OLD_TUNES[i], OLD_TUNES[i].w]);
    return pool;
  }

  // the far voice — a self-contained carrier for the memory: soft triangle
  // with a breath of octave, dulled by distance, at the field's edge, all
  // tail. Not one of the console's instruments; it has no stop.
  function farVoice(t, notes, gainMul, side, det) {
    var told = [];
    var o = S.ctx.createOscillator(); o.type = "triangle";
    var o2 = S.ctx.createOscillator(); o2.type = "sine";
    var g2 = S.ctx.createGain(); g2.gain.setValueAtTime(0.1, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(1200, t);
    var g = S.ctx.createGain();
    var pn = S.ctx.createStereoPanner(); pn.pan.setValueAtTime(side, t);
    o.connect(lp); o2.connect(g2); g2.connect(lp);
    lp.connect(g); g.connect(pn); pn.connect(wideSend());                    // the memory, at the field's edge: all tabernacle
    var tt = t, total = 0, prevF = 0;
    for (var i = 0; i < notes.length; i++) {
      var f = degFreq(projDeg(notes[i].deg) + colN()) * det;
      if (i === 0) {
        o.frequency.setValueAtTime(f, t);
        o2.frequency.setValueAtTime(f * 2, t);
      } else {
        var port = Math.min(0.15, notes[i].dur * 0.2);
        o.frequency.setValueAtTime(prevF, tt);
        o.frequency.linearRampToValueAtTime(f, tt + port);
        o2.frequency.setValueAtTime(prevF * 2, tt);
        o2.frequency.linearRampToValueAtTime(f * 2, tt + port);
      }
      told.push({ f: f, dur: notes[i].dur });
      prevF = f;
      tt += notes[i].dur;
      total += notes[i].dur;
    }
    S.reportLine("oldtune", t, told);
    var peak = 0.14 * (gainMul || 1);
    env(g, t, [[1.2, peak], [Math.max(0.4, total - 2.6), peak * 0.85], [1.6, 0]]);
    o.start(t); o.stop(t + total + 2);
    o2.start(t); o2.stop(t + total + 2);
    return total;
  }

  function oldTuneRemembered(V, tc) {
    var R = stream("guest:oldtune");
    var tune = (V && V.tune) || OLD_TUNES[0];
    var t = tc + 0.6;
    var beat = R.rnd(1.1, 1.4);                  // its own remembered tempo
    var side = synth("oldtune").pick([-0.85, 0.85]);   // which edge of the field: sound-level
    var det = Math.pow(2, 8 / 1200);             // 8 cents sharp of true — worn
    var notes = tune.notes.map(function (n) { return { deg: n[0], dur: n[1] * beat }; });
    // seeded wear — never the first two notes; recognition lives in the head
    if (R.chance(0.5) && notes.length > 4) {
      var di = R.rint(2, notes.length - 2);
      notes[di - 1].dur += notes[di].dur;        // a note dropped, its neighbor held wrong in its place
      notes.splice(di, 1);
    }
    if (R.chance(0.4)) notes[R.rint(2, notes.length - 1)].dur *= 1.6;
    var dur1 = farVoice(t, notes, 1.0, side, det);
    var total = dur1;
    emitEvent({ cat: "visitation", label: "✧ an old tune remembered", detail: tune.name + " · " + S.Meeting.section() });
    if (R.chance(0.6)) {
      // a fainter second try — the head only, trailing off
      var gap = R.rnd(6, 10);
      var head = notes.slice(0, Math.min(5, notes.length - 1));
      var t2 = t + dur1 + gap;
      var dur2 = farVoice(t2, head, 0.6, side, det);
      total = dur1 + gap + dur2;
      cueAt("guests", t2 + dur2, function () {
        emitEvent({ cat: "visitation", label: "✧ the memory gives out", detail: tune.name });
      });
    }
    return total + 4;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.razzCluster = razzCluster;
  S.cumulativeAssembly = cumulativeAssembly;
  S.unansweredQuestion = unansweredQuestion;
  S.twoBandsCross = twoBandsCross;
  S.steeplesAnswer = steeplesAnswer;
  S.OLD_TUNES = OLD_TUNES;
  S.oldTuneCandidates = oldTuneCandidates;
  S.oldTuneRemembered = oldTuneRemembered;
  // the room's public face on the KOLOB namespace
  KOLOB.Guests = { OLD_TUNES: OLD_TUNES, cumulativeAssembly: cumulativeAssembly, unansweredQuestion: unansweredQuestion, twoBandsCross: twoBandsCross, steeplesAnswer: steeplesAnswer, oldTuneRemembered: oldTuneRemembered };
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-guests.js"] = true;   // the load guard's roll call
})();

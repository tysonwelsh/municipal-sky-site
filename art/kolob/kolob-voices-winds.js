// ============================================================================
// KOLOB — kolob-voices-winds.js: clarinet and harmonium
//
// The deacon's clarinet and the parlor pump organ that shadows it. Split
// from kolob-audio.js (v0.30); see the room list in kolob-core.js.
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
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function inFuging() { return S.inFuging(); }
  function inQuestion() { return S.inQuestion(); }
  function hallListens() { return S.hallListens(); }
  function houseRests(layer) { return S.houseRests(layer); }
  function silenceMul() { return S.silenceMul(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function turn(label) { return S.turn(label); }
  function wait(label) { return S.wait(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function cueIn(lane, dtS, fn) { return S.cueIn(lane, dtS, fn); }
  function cueLayer(layer, baseS, fn) { return S.cueLayer(layer, baseS, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function airFree() { return S.airFree(); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.Harmony (the chord desk), S.Meeting (the chorister's book), S.moment)
  // the composers, on the KOLOB namespace
  var Motif = KOLOB.Melody.Motif, Prosody = KOLOB.Melody.Prosody, METERS = KOLOB.Melody.METERS;

  // ==========================================================================
  // VOICE: CLARINET — the deacon. Copland clarity: triangle + one soft octave
  // sine through a gentle fixed lowpass; delayed shallow vibrato; single
  // grace notes, no trills. Lines out the hymn for the choir; speaks alone
  // in testimony with real silence around it.
  // ==========================================================================
  // R: the caller's stream — the grace notes are the deacon's choice, so
  // they are musical dice; where he stands and how he breathes are synth:clarinet
  // leanOn (optional): the chord the line leaned onto — told with the
  // line's first note, the moment it was read
  function renderClarinetLine(t, notes, gainMul, R, leanOn) {
    var Y = synth("clarinet");
    var vib = getLayerParam("clarinet", "vibrato", 0.4);
    var graceAmt = getLayerParam("clarinet", "grace", 0.5);
    var dest = panAt("clarinet", Y.rnd(-0.25, 0.25));
    var o = S.ctx.createOscillator();
    o.type = "triangle";
    var oct = S.ctx.createOscillator();
    oct.type = "sine";
    var og2 = S.ctx.createGain(); og2.gain.setValueAtTime(0.12, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(notes[0].f * 5, t);            // fixed — no filter automation at all
    var g = S.ctx.createGain();
    o.connect(lp); oct.connect(og2); og2.connect(lp);
    lp.connect(g); g.connect(dest);
    o.frequency.setValueAtTime(notes[0].f, t);
    oct.frequency.setValueAtTime(notes[0].f * 2, t);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.04, Math.min(0.2, n.dur * 0.25));
        o.frequency.setValueAtTime(notes[i - 1].f, tt);
        o.frequency.linearRampToValueAtTime(n.f, tt + port);
        oct.frequency.setValueAtTime(notes[i - 1].f * 2, tt);
        oct.frequency.linearRampToValueAtTime(n.f * 2, tt + port);
      }
      // a single grace note into longer notes — an upper neighbor, lightly
      if (n.dur > 1.6 && i > 0 && R.chance(graceAmt * 0.5)) {
        var gf = n.f * Math.pow(2, 1 / 12 * 2);
        o.frequency.setValueAtTime(gf, tt - 0.09);
        o.frequency.linearRampToValueAtTime(n.f, tt + 0.05);
      }
      emitNote("clarinet", n.f, tt, n.dur, i === 0 && leanOn ? { chord: leanOn.id } : null);
      tt += n.dur;
      total += n.dur;
    }
    // delayed vibrato: fades in after 40% of the line, stays shallow.
    // LESSON (Bardo's conch): keep LFO depth well under the fundamental so
    // frequency never goes negative — depth here is f*0.004, tiny by design.
    if (vib > 0.05) {
      var lfo = S.ctx.createOscillator();
      lfo.frequency.setValueAtTime(Y.rnd(4.5, 5.5), t);
      var lg = S.ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + total * 0.4);
      lg.gain.linearRampToValueAtTime(notes[0].f * 0.004 * vib * 2, t + total * 0.7);
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + total + 0.5);
    }
    var peak = (gainMul || 1) * 0.34;
    env(g, t, [[Y.rnd(0.4, 0.8), peak], [Math.max(0.2, total - 1.8), peak * 0.9], [Y.rnd(0.9, 1.4), 0]]);
    o.start(t); o.stop(t + total + 1.6);
    oct.start(t); oct.stop(t + total + 1.6);
    return total;
  }
  function clarinetToNotes(motif, beat, R) {
    return motif.notes.map(function (n, i) {
      var d = n.durBeats * beat;
      if (i === 0 || i === motif.notes.length - 1) d = Math.max(d, beat * R.rnd(1.6, 2.4));
      // a wind player's phrase keeps moving: interior notes ≤ ~3 beats, the
      // ends ≤ ~4 — augmented material sings long in the choir, not here
      d = Math.min(d, beat * (i === motif.notes.length - 1 ? 4 : 2.8));
      return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.max(0.4, d) };  // an octave above the choir root
    });
  }
  // The deacon's turn, at scheduled time tc.
  function clarinetPhrase(tc) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    // (round 3b, step 4: a rite seated LINED OUT ONLY — the deacon gives its
    // lines and the ward answers, the invocation or an interlude too)
    var scene = S.Meeting.scene ? S.Meeting.scene() : null, linedRite = !!(scene && scene.lined);
    var speaks = s === "prelude" || s === "hymn" || s === "testimony" || s === "doxology" || s === "postlude" || linedRite;
    if (!speaks || inFuging() || inQuestion() || hallListens() || houseRests("clarinet")) { cueIn("clarinet", 6, clarinetPhrase); return; }
    if (!airFree()) { cueIn("clarinet", wait("clarinet").rnd(5, 11), clarinetPhrase); return; }
    var R = turn("clarinet");
    // in the prelude the deacon only occasionally tries a line over the organ
    // — more often on a parlor or arbor morning, seldom in an organ
    // voluntary (the prelude's seating: its speak)
    var seat = s === "prelude" ? S.Meeting.seating() : null;
    var speak = seat && seat.speak != null ? seat.speak : 0.45;
    if (s === "prelude" && R.chance(1 - speak)) { cueIn("clarinet", R.rnd(10, 18) * S.Meeting.lean("clarinet"), clarinetPhrase); return; }

    var pace = getLayerParam("clarinet", "pace", 1);
    var beat = R.rnd(1.0, 1.4) / pace;
    var mo = S.moment();
    var motif = Motif.overdueFor("clarinet", mo) ? Motif.claim("clarinet", mo, R) : Motif.request("clarinet", mo, R);
    if (!motif) { cueIn("clarinet", 6, clarinetPhrase); return; }

    var t = tc + 0.12;
    var total;
    var lined = false;
    var spoken = motif;                                        // what actually sounded (the shadow reads this)
    if ((s === "hymn" || linedRite) && R.chance(linedRite ? 0.85 : 0.5)) {
      // LINING-OUT: state the first line of the hymn plainly, then post it to
      // the choir, which sings it back harmonized and slower.
      var nSyl = (METERS[S.Meeting.meter()] || METERS.CM)[0];
      var line = Prosody.pourIntoLine(motif, nSyl, R);
      var lm = { name: motif.name, gen: motif.gen, chain: motif.chain.slice(), gesture: motif.gesture, notes: line };
      total = renderClarinetLine(t, clarinetToNotes(lm, beat, R), 1, R);
      Motif.post("clarinet", "choir", lm, "line-out", mo, R);
      emitEvent({ type: "lining-out", meter: S.Meeting.meter(), syllables: nSyl, motif: motif.name, hymnId: S.Meeting.hymnId(),
                  cat: "verse", label: "☞ the deacon lines out", detail: S.Meeting.meter() + " · " + nSyl + " syllables · " + motif.name });
      lined = true;
      spoken = lm;
    } else {
      // chord-tone gravity: strong-position notes lean onto the chord that
      // stands when the line begins (the book's, at t)
      var leanOn = S.Harmony.at(t);
      var tones = S.Harmony.chordTones(t);
      var m2 = JSON.parse(JSON.stringify(motif));
      if (tones) {
        for (var i = 0; i < m2.notes.length; i += 2) {
          var pd = projDeg(m2.notes[i].deg);
          var cls = ((pd % colN()) + colN()) % colN();
          if (!tones[cls] && R.chance(0.7)) {
            var up = ((pd + 1) % colN() + colN()) % colN();
            m2.notes[i].deg += tones[up] ? 1 : -1;
          }
        }
      }
      // A SPEECH, not a fragment: pour the idea into a full metered line —
      // a short gesture walks on toward its rest tone — and usually answer
      // it with a consequent after a breath. Antecedent–consequent: the
      // period form the hymns think in.
      var nSy = Math.max(m2.notes.length, R.pickW([[6, 1], [8, 3], [10, 2], [12, 1]]));
      var line1 = Prosody.pourIntoLine(m2, nSy, R);
      var gm2 = s === "testimony" ? 0.8 : 1;
      spoken = { name: m2.name, gen: m2.gen, chain: [], gesture: m2.gesture, notes: line1 };
      total = renderClarinetLine(t, clarinetToNotes(spoken, beat, R), gm2, R, leanOn);
      if (R.chance(s === "testimony" ? 0.35 : 0.6)) {
        var cons = Motif.develop("clarinet", motif, 1, mo, R);
        var line2 = Prosody.pourIntoLine(cons, Math.max(4, nSy - R.pickW([[0, 2], [2, 2]])), R);
        var breath2 = R.rnd(1.4, 2.4);
        total += breath2 + renderClarinetLine(t + total + breath2, clarinetToNotes({ notes: line2 }, beat, R), gm2 * 0.95, R);
      }
      if (R.chance(0.4) && !lined) Motif.post("clarinet", R.pickW([["choir", 2], ["bells", 2], ["harmonium", 1]]), motif, R.pickW([["imitate", 3], ["invert", 2], ["develop", 2]]), mo, R);
    }
    // the harmonium shadows the deacon a breath behind, in the parlor —
    // reading the line as actually spoken, not the raw motif (and never in
    // a prelude that has no harmonium: the brush arbor — round 2 of the
    // polish; the dice are thrown all the same)
    if (R.chance(getLayerParam("harmonium", "shadow", 0.5)) && s !== "testimony") {
      var shadowAt = t + R.rnd(0.4, 0.9);
      if (!(seat && seat.sits.harmonium) && !houseRests("harmonium")) harmoniumShadow(shadowAt, spoken, beat);
    }
    claimAir(total, (s === "testimony" ? R.rnd(10, 22) : R.rnd(4, 10)) * silenceMul());
    var gap = (s === "testimony" ? R.rnd(18, 40) : R.rnd(9, 20)) * gapMul() * S.Meeting.lean("clarinet");
    cueLayer("clarinet", total + gap, clarinetPhrase);
  }

  // ==========================================================================
  // VOICE: HARMONIUM — the parlor pump organ. Detuned saw pair through a
  // still reed formant; the bellows breathe at 0.2-0.4 Hz. Plays the inner
  // voices (alto+tenor) of the sounding chord, close and warm; shadows the
  // deacon's lines a breath behind.
  // ==========================================================================
  // (every die here is sound-level: synth:harmonium)
  function renderHarmonium(t, notes, gainMul) {
    var Y = synth("harmonium");
    var reed = getLayerParam("harmonium", "reed", 0.5);
    var bellows = getLayerParam("harmonium", "bellows", 0.5);
    var dest = panAt("harmonium", Y.rnd(-0.2, 0.2));
    var mix = S.ctx.createGain();
    var os = [];
    for (var d = 0; d < 2; d++) {
      var o = S.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(notes[0].f * (d ? 1 + Y.rnd(0.003, 0.005) : 1 - Y.rnd(0.003, 0.005)), t);
      var og = S.ctx.createGain(); og.gain.setValueAtTime(0.5, t);
      o.connect(og); og.connect(mix);
      os.push(o);
    }
    var bp = S.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600 + reed * 800, t);         // the reed formant sits still
    bp.Q.setValueAtTime(2 + reed * 3, t);
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
    var g = S.ctx.createGain();
    mix.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
    // pitch walk
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        for (var oi = 0; oi < os.length; oi++) {
          var det = oi ? 1.004 : 0.996;
          os[oi].frequency.setValueAtTime(notes[i - 1].f * det, tt);
          os[oi].frequency.linearRampToValueAtTime(n.f * det, tt + Math.min(0.3, n.dur * 0.3));
        }
      }
      tt += n.dur; total += n.dur;
    }
    // bellows: slow AM + a matching breath of pitch wobble
    if (bellows > 0.05) {
      var lfo = S.ctx.createOscillator();
      lfo.frequency.setValueAtTime(Y.rnd(0.2, 0.4), t);
      var lg = S.ctx.createGain(); lg.gain.setValueAtTime(bellows * 0.12, t);
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(t); lfo.stop(t + total + 0.5);
    }
    var peak = (gainMul || 1) * 0.22;
    env(g, t, [[Y.rnd(0.8, 1.4), peak], [Math.max(0.2, total - 3), peak * 0.9], [Y.rnd(1.4, 2), 0]]);
    for (var oi2 = 0; oi2 < os.length; oi2++) { os[oi2].start(t); os[oi2].stop(t + total + 2.2); }
    return total;
  }
  function harmoniumShadow(t, motif, beat) {
    // the parlor echo of the deacon: same page, +8 cents, quieter
    var det = Math.pow(2, 8 / 1200);
    var notes = motif.notes.map(function (n) {
      return { f: degFreq(projDeg(n.deg) + colN()) * det, dur: Math.max(0.4, n.durBeats * beat) };
    });
    renderHarmonium(t, notes, 0.5);
    reportLine("harmonium", t, notes);
    emitEvent({ type: "motif-shadow", voice: "harmonium", of: "clarinet", name: motif.name, gen: motif.gen,
                cat: "motif", label: "〰 harmonium shadows the deacon", detail: motif.name + "·g" + motif.gen });
  }
  // every note of a line the harmonium walks, as it walks it (v0.32 told
  // the page only the first, held for the length of the line)
  function reportLine(layer, t, notes, extra) {
    for (var i = 0, tt = t; i < notes.length; tt += notes[i].dur, i++) emitNote(layer, notes[i].f, tt, notes[i].dur, extra);
  }
  // The parlor organ's turn, at scheduled time t.
  function harmoniumCycle(t) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    var plays = s === "prelude" || s === "hymn" || s === "doxology" || s === "postlude";
    var seat = s === "prelude" ? S.Meeting.seating() : null;             // (the brush arbor has no harmonium)
    if (!plays || inQuestion() || hallListens() || houseRests("harmonium") || (seat && seat.sits.harmonium)) { cueIn("harmonium", 8, harmoniumCycle); return; }
    var R = turn("harmonium");
    // the parlor ANSWERS the deacon when an obligation stands — a fourth
    // conversational timbre, close and warm
    var mo = S.moment();
    if (Motif.overdueFor("harmonium", mo) && airFree()) {
      var ans = Motif.claim("harmonium", mo, R);
      if (ans) {
        var abeat = R.rnd(1.1, 1.5);
        var poured = Prosody.pourIntoLine(ans, Math.max(ans.notes.length, R.rint(6, 8)), R);
        var anotes = poured.map(function (n) {
          return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.min(abeat * 3.5, Math.max(0.5, n.durBeats * abeat)) };
        });
        var atot = renderHarmonium(t + 0.1, anotes, 0.7);
        reportLine("harmonium", t + 0.1, anotes);
        claimAir(atot, R.rnd(4, 9) * silenceMul());
        cueLayer("harmonium", atot + R.rnd(14, 26) * gapMul() * S.Meeting.lean("harmonium"), harmoniumCycle);
        return;
      }
    }
    // the chord standing when the reeds speak (the book's, at t + 0.1) — or,
    // on a parlor Sunday's morning (the prelude's seating), the day's first
    // chord, which the harmonium sets before the organ is heard
    var ch = S.Harmony.at(t + 0.1), opening = false;
    if (!ch && seat && seat.name === "parlor") {
      ch = S.Harmony.advance(seat.full ? { open: false, third: true, spread: seat.spread } : { spread: seat.spread }, R, t + 0.1, "harmonium");
      opening = true;
    }
    // (the prelude's seating: a parlor morning sets a chord on nearly every
    // turn, an organ voluntary seldom)
    if (ch && (R.chance(seat && seat.chord != null ? seat.chord : 0.55) || opening)) {
      var dur = R.rnd(9, 15);
      // the inner voices: tenor + alto, sustained — an occasional warmth,
      // not a constant one; the hymn keeps its sky (the alto's loose entry
      // and release are the player's hands: sound-level, so the page is
      // told the chord as written — both voices at t + 0.1, for dur)
      var Y = synth("harmonium");
      renderHarmonium(t + 0.1, [{ f: ch.freqs[1], dur: dur }], 0.6 * (0.5 + intensity() * 0.6));
      renderHarmonium(t + Y.rnd(0.2, 0.6), [{ f: ch.freqs[2], dur: dur * Y.rnd(0.85, 1) }], 0.5 * (0.5 + intensity() * 0.6));
      emitNote("harmonium", ch.freqs[1], t + 0.1, dur, { part: "T", chord: ch.id });
      emitNote("harmonium", ch.freqs[2], t + 0.1, dur, { part: "A", chord: ch.id });
    }
    cueLayer("harmonium", R.rnd(14, 26) * gapMul() * S.Meeting.lean("harmonium"), harmoniumCycle);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.renderClarinetLine = renderClarinetLine;
  S.clarinetPhrase = clarinetPhrase;
  S.renderHarmonium = renderHarmonium;
  S.reportLine = reportLine;
  S.harmoniumCycle = harmoniumCycle;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-winds.js"] = true;   // the load guard's roll call
})();

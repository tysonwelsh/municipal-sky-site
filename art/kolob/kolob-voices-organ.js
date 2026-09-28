// ============================================================================
// KOLOB — kolob-voices-organ.js: the organ
//
// The tabernacle instrument: its chords and its cycle. Split from
// kolob-audio.js (v0.30); see the room list in kolob-core.js.
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
  function cueIn(lane, dtS, fn) { return S.cueIn(lane, dtS, fn); }
  function cueLayer(layer, baseS, fn) { return S.cueLayer(layer, baseS, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.Harmony (the chord desk), S.Meeting (the chorister's book))

  // ==========================================================================
  // VOICE: ORGAN — the tabernacle instrument. Additive drawbar ranks (no
  // biquad anywhere in this chain, by design); principal chorus crossfading
  // toward flutes; a slow shallow tremulant; a pedal sine under the bass.
  // Soloist in prelude and postlude; the harmonic bed under the singing.
  // ==========================================================================
  function organChord(t, dur, chord, gainMul) {
    if (!chord) return;
    var stops = getLayerParam("organ", "stops", 0.5);
    var trem = getLayerParam("organ", "tremulant", 0.15);
    var pedal = getLayerParam("organ", "pedal", 0.6);
    var dest = panAt("organ", 0);
    var master = S.ctx.createGain();
    master.connect(dest);
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
      var lg = S.ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, t);
      lfo.connect(lg); lg.connect(master.gain);
      lfo.start(t); lfo.stop(t + dur + 0.3);
    }
    var peak = (gainMul || 1) * 0.7;
    var atk = Math.min(2.2, dur * 0.3);
    env(master, t, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    // every pipe that speaks is a note (round 2): each voice of the chord an
    // octave down, and the pedal an octave under the bass — with the chord
    // book's id for the chord (the raspberry's cluster and the rail's
    // audition are no chord of the book's, and say none)
    for (var pv = 0; pv < nTones; pv++) emitNote("organ", chord.freqs[pv] * 0.5, t, dur, organTag(chord, nTones === 4 ? ORGAN_PART[pv] : null));
    if (pedal > 0.05) emitNote("organ", chord.freqs[0] * 0.25, t, dur, organTag(chord, "pedal"));
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
    // chords of their own) and comes back when they have gone by
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
  S.organCycle = organCycle;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-organ.js"] = true;   // the load guard's roll call
})();

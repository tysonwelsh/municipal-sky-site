// ============================================================================
// KOLOB — kolob-voices-ground.js: tuba, drone, strings, bells
//
// The ground of the hall and its tower: the tuba (reserved for the raspberry
// amen), the La Monte Young drone, the prairie strings, the meetinghouse bell
// and the tines. Split from kolob-audio.js (v0.30); see the room list in
// kolob-core.js.
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
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function inFuging() { return S.inFuging(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function turn(label) { return S.turn(label); }
  function wait(label) { return S.wait(label); }
  function synth(voice) { return S.synth(voice); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function cueIn(lane, dtS, fn) { return S.cueIn(lane, dtS, fn); }
  function cueLayer(layer, baseS, fn) { return S.cueLayer(layer, baseS, fn); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function noiseSource() { return S.noiseSource(); }
  function noiseOffset() { return S.noiseOffset(); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function airFree() { return S.airFree(); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.F0, S.ROOT_MULT, S.Harmony, S.MEETINGS, S.C, S.Motif)

  // ==========================================================================
  // VOICE: TUBA — the visiting brass.
  //
  // THE TUBA IS RESERVED FOR THE RASPBERRY AMEN ONLY. It has a stop in the
  // rail and a sample blat, but NO cycle — it must never be given a
  // scheduled voice in ordinary sections; the whole joke is that the stop
  // sits there doing nothing, meeting after meeting, until the amen goes
  // wrong. (Maintainers: do not "fix" this by wiring it into play().)
  //
  // His one entrance: a low committed blat — a scoop from under the note
  // that settles nearly on it, held beneath the cluster, released with the
  // organist's hands.
  // ==========================================================================
  function tubaBlat(t, gainMul) {
    var target = degFreq(1 - colN() * 2);          // the second, two octaves down
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(target * 6, t);    // brassy at the attack…
    lp.frequency.linearRampToValueAtTime(target * 3, t + 0.35);   // …then dark
    // the blat: in from below, past the note, settling almost on it
    o.frequency.setValueAtTime(target * 0.86, t);
    o.frequency.linearRampToValueAtTime(target * 1.02, t + 0.12);
    o.frequency.linearRampToValueAtTime(target, t + 0.3);
    var g = S.ctx.createGain();
    o.connect(lp); lp.connect(g); g.connect(panAt("tuba", 0));
    var peak = 0.64 * (gainMul || 1);              // doubled again by owner request — the blat WILL be heard
    env(g, t, [[0.05, peak], [2.4, peak * 0.77], [0.7, 0]]);
    o.start(t); o.stop(t + 3.6);
    emitNote("tuba", target, t, 3.0);
  }

  // ==========================================================================
  // VOICE: DRONE — the La Monte Young register. Pure sines on the harmonic
  // series of F0, in very long crossfading cycles. It never stops — in the
  // sacrament it is all there is. The stillness is the point.
  // ==========================================================================
  // at scheduled time t — the downbeat, then each overlap
  function droneCycle(t) {
    if (!S.playing) return;
    var R = turn("drone");
    var dur = R.rnd(60, 90);
    var overlap = 20;
    var presence = getLayerParam("drone", "presence", 0.5);
    var fifthAmt = getLayerParam("drone", "fifth", 0.4);
    var bright = S.C.meeting ? S.MEETINGS[S.C.meeting.activity].bright : 0.5;
    var partials = [
      { h: 1, g: 0.4 }, { h: 2, g: 0.24 }, { h: 3, g: 0.12 }, { h: 4, g: 0.07 },
    ];
    if (fifthAmt > 0.1 && bright > 0.4) partials.push({ h: 3, g: fifthAmt * 0.1, oct: 1 });  // 3/2 above, one octave up
    var dest = panAt("drone", 0);
    var master = S.ctx.createGain();
    master.connect(dest);
    for (var i = 0; i < partials.length; i++) {
      var o = S.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(harm(partials[i].h) * (partials[i].oct ? 2 : 1), t);
      var og = S.ctx.createGain();
      og.gain.setValueAtTime(partials[i].g, t);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + dur + 0.5);
    }
    var peak = 0.5 * (0.5 + presence * 0.8);
    // the drone holds through everything, even the sacrament — softer, never gone
    if (S.C.section === "sacrament") peak *= 0.8;
    env(master, t, [[overlap * 0.7, peak], [dur - overlap * 1.4, peak * 0.95], [overlap * 0.7, 0]]);
    emitNote("drone", S.F0, t, dur);
    cueLayer("drone", dur - overlap, droneCycle);
  }

  // ==========================================================================
  // VOICE: STRINGS — the prairie. Open fifths of the sounding chord in long
  // trapezoid pads; one quiet high "lonesome" partial riding above. Widest in
  // the doxology; silent in the invocation and the sacrament.
  // ==========================================================================
  // (the bows' detune is sound-level: synth:strings)
  function stringsPad(t, dur, gainMul, fifthOnly) {
    var Y = synth("strings");
    var warmth = getLayerParam("strings", "warmth", 0.5);
    var lonesome = getLayerParam("strings", "lonesome", 0.4);
    var ch = S.Harmony.current();
    var rootF = ch ? ch.freqs[0] * 2 : S.F0 * S.ROOT_MULT;
    var fifthF = rootF * 1.5;
    var pitches = fifthOnly ? [rootF, fifthF] : [rootF, fifthF, rootF * 2];
    var master = S.ctx.createGain();
    master.connect(panAt("strings", 0));
    var lp = S.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700 + (1 - warmth) * 900 + intensity() * 900, t);  // set once, never swept
    lp.connect(master);
    for (var p = 0; p < pitches.length; p++) {
      for (var d = 0; d < 3; d++) {
        var o = S.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(pitches[p] * (1 + (d - 1) * Y.rnd(0.002, 0.0035)), t);
        var og = S.ctx.createGain();
        og.gain.setValueAtTime(0.09 / pitches.length, t);
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t + dur + 0.5);
      }
    }
    if (lonesome > 0.05) {
      var lo = S.ctx.createOscillator();
      lo.type = "sine";
      lo.frequency.setValueAtTime(fifthF * 4, t);
      var lg = S.ctx.createGain(); lg.gain.setValueAtTime(lonesome * 0.05, t);
      lo.connect(lg); lg.connect(master);
      lo.start(t); lo.stop(t + dur + 0.5);
    }
    var peak = (gainMul || 1) * 0.7 * (0.4 + intensity() * 0.7);
    var edge = Math.min(8, dur * 0.3);
    env(master, t, [[edge, peak], [Math.max(0.5, dur - edge * 2), peak * 0.92], [edge, 0]]);
    emitNote("strings", rootF, t, dur);
  }
  function stringsCycle(t) {
    if (!S.playing) return;
    var s = S.C.section;
    if (s === "invocation" || s === "sacrament" || s === "interlude") { cueIn("strings", 8, stringsCycle); return; }
    var R = turn("strings");
    var dur = R.rnd(22, 34);
    var overlap = 8;
    stringsPad(t + 0.1, dur, s === "doxology" ? 1 : 0.75, R.chance(0.7));
    cueLayer("strings", (dur - overlap) * (s === "doxology" ? 0.9 : 1.3), stringsCycle);
  }

  // ==========================================================================
  // VOICE: BELLS — the meetinghouse bell (section joints, festival peals) and
  // the muted TINE (the Cage nod: a prepared, damped, music-box tone that
  // taps motif heads between speeches, quantized to the sounding chord).
  // ==========================================================================
  // One bell, one strike — extracted so far steeples can ring the same KIND
  // of bell at their own bases and down their own wires. The partial stack
  // and beating doublets are the meetinghouse bell's, untouched. opts.hum
  // adds the 0.5× hum partial (the home bell keeps its hum; visitors don't,
  // so transposed hums never pile up under the drone).
  // (the doublets' beating and the partials' decay are sound-level: synth:bells)
  function bellStrike(t, gainMul, base, dest, opts) {
    var Y = synth("bells");
    var ratios = [1, 2.0, 2.76, 3.98, 5.4];
    var g0 = (gainMul || 0.6) * 0.55;
    for (var i = 0; i < ratios.length; i++) {
      for (var d = 0; d < 2; d++) {                            // beating doublets — a real bell shimmers
        var o = S.ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(base * ratios[i] + (d ? Y.rnd(0.4, 2.2) : 0), t);
        var og = S.ctx.createGain();
        o.connect(og); og.connect(dest);
        var pg = g0 * 0.5 / (1 + i * 1.0);
        env(og, t, [[0.005, pg], [Y.rnd(3.5, 8) / (1 + i * 0.55), 0]]);
        o.start(t); o.stop(t + 10);
      }
    }
    if (opts && opts.hum) {
      var hum = S.ctx.createOscillator();
      hum.type = "sine"; hum.frequency.setValueAtTime(base * 0.5, t);
      var hg = S.ctx.createGain();
      hum.connect(hg); hg.connect(dest);
      env(hg, t, [[0.012, g0 * 0.28], [Y.rnd(5, 9), 0]]);
      hum.start(t); hum.stop(t + 10);
    }
  }
  // R: the caller's stream (the joint's, or the audition's) — which bell is a pitch
  function meetinghouseBell(t, gainMul, R) {
    if (!S.ctx) return;
    var ringAmt = getLayerParam("bells", "ring", 0.55);
    var base = harm(R.pick([4, 5, 6]));
    while (base > 700) base /= 2;
    while (base < 300) base *= 2;
    bellStrike(t, (gainMul || 0.6) * ringAmt, base, panAt("bells", synth("bells").rnd(-0.2, 0.2)), { hum: true });
    emitNote("bells", 0, t, 7);
  }
  // (where the tine sits and how long it rings are sound-level)
  function tineTap(t, f, amp) {
    var Y = synth("bells");
    var dest = panAt("bells", Y.rnd(-0.4, 0.4));
    var partials = [[1, 1], [5.43, 0.35]];
    for (var i = 0; i < partials.length; i++) {
      var o = S.ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f * partials[i][0], t);
      var og = S.ctx.createGain();
      o.connect(og); og.connect(dest);
      env(og, t, [[0.003, amp * partials[i][1]], [i === 0 ? Y.rnd(0.7, 1.2) : Y.rnd(0.12, 0.2), 0]]);
      o.start(t); o.stop(t + 1.5);
    }
    // the fingernail thump — the felt against the tine
    var n = noiseSource();
    var nf = S.ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.setValueAtTime(500, t);
    var ng = S.ctx.createGain();
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    env(ng, t, [[0.003, amp * 0.2], [0.06, 0]]);
    n.start(t, noiseOffset()); n.stop(t + 0.15);
    emitNote("bells", f, t, 1);
  }
  // The tines' turn, at scheduled time tc.
  function tineCycle(tc) {
    if (!S.playing) return;
    var s = S.C.section;
    if (s === "invocation" || s === "sacrament" || inFuging()) { cueIn("bells", 9, tineCycle); return; }
    if (!airFree()) { cueIn("bells", wait("bells").rnd(6, 12), tineCycle); return; }
    var R = turn("bells");
    var tineAmt = getLayerParam("bells", "tine", 0.5);
    var motif = S.Motif.overdueFor("bells") ? S.Motif.claim("bells", R) : S.Motif.request("bells", R);
    if (!motif) { cueIn("bells", 9, tineCycle); return; }
    var head = motif.notes.slice(0, R.rint(4, 6));
    var t = tc + 0.1;
    var beat = R.rnd(0.55, 0.85);
    var tones = S.Harmony.chordTones();
    var total = 0;
    for (var i = 0; i < head.length; i++) {
      var pd = projDeg(head[i].deg) + colN();                  // up where a music box lives
      if (tones) {
        var cls = ((pd % colN()) + colN()) % colN();
        if (!tones[cls]) pd += 1;                              // lean onto the chord
      }
      var f = degFreq(pd) * 2;
      tineTap(t + total, f, 0.3 * tineAmt * 2);
      total += Math.max(0.35, head[i].durBeats * beat * 0.6);
    }
    claimAir(total, R.rnd(3, 7));
    var gap = R.rnd(20, 45) * gapMul();
    cueLayer("bells", total + gap, tineCycle);
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.tubaBlat = tubaBlat;
  S.droneCycle = droneCycle;
  S.stringsPad = stringsPad;
  S.stringsCycle = stringsCycle;
  S.bellStrike = bellStrike;
  S.meetinghouseBell = meetinghouseBell;
  S.tineTap = tineTap;
  S.tineCycle = tineCycle;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-ground.js"] = true;   // the load guard's roll call
})();

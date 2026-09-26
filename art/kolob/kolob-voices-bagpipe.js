// ============================================================================
// KOLOB — kolob-voices-bagpipe.js: the bagpipe (SHELVED)
//
// Kept whole and never scheduled (see SHELVED in kolob-core.js). Split from
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
  // from kolob-pitch.js
  function colN() { return S.colN(); }
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function silenceMul() { return S.silenceMul(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function rnd(a, b) { return S.rnd(a, b); }
  function chance(p) { return S.chance(p); }
  function pickW(pool) { return S.pickW(pool); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function scheduleLayer(fn, baseMs, layer) { return S.scheduleLayer(fn, baseMs, layer); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function noiseSource() { return S.noiseSource(); }
  function noiseOffset() { return S.noiseOffset(); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function airFree() { return S.airFree(); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.F0, S.ROOT_MULT, S.SHELVED, S.Harmony, S.Prosody, S.C, S.seasonPos,
  // S.Motif)

  // ==========================================================================
  // VOICE: BAGPIPE — SHELVED (see SHELVED, top of file): kept whole, never
  // scheduled, gain pinned at zero. The piper on the bluff. A double-reed CHANTER: a detuned
  // sawtooth pair driven through a waveshaper's reed-BUZZ, coloured by two
  // fixed nasal FORMANTS and a breath of filtered air — the one voice with
  // grain against the meetinghouse's smooth organs and drones. (The Highland
  // patch, dialed in on the bagpipe-lab bench.)
  //
  // But it speaks KOLOB, not the Highlands. Its ROLE turns with the order of
  // service: in the hymns and doxology it either LINES the tune (a melodic
  // voice, claiming the air like the deacon) or SUSTAINS the sounding chord's
  // open fifths (harmony, a landscape voice that never claims the air). And it
  // keeps to its SEASONS — out in force at conference and jubilee, hardly heard
  // on the fast day, gone entirely in the sacrament's stillness.
  // ==========================================================================
  var bagpipeCurveCache = {};
  function bagpipeCurve(amount) {
    var key = amount.toFixed(2);
    if (bagpipeCurveCache[key]) return bagpipeCurveCache[key];
    var n = 1024, c = new Float32Array(n), k = 3 + amount * 12, i, x;
    for (i = 0; i < n; i++) { x = (i / (n - 1)) * 2 - 1; c[i] = (1 - amount) * x + amount * (Math.tanh(k * x) / Math.tanh(k)); }
    bagpipeCurveCache[key] = c;
    return c;
  }
  // One reed tone with the Highland timbre. opts: { pan, prevFreq, swell }.
  // No grace-note flick — Kolob phrases smoothly; a short slur carries the
  // pitch in from prevFreq. `swell` gives the long, breathed attack of a
  // sustained harmony note; otherwise the reed speaks promptly.
  function bagpipeReed(t, freq, dur, gainMul, opts) {
    opts = opts || {};
    var grit = getLayerParam("bagpipe", "grit", 0.42);
    var reed = getLayerParam("bagpipe", "reed", 0.5);
    var breathAmt = getLayerParam("bagpipe", "breath", 0.32);
    var dest = panAt("bagpipe", opts.pan || 0);
    var out = S.ctx.createGain(); out.connect(dest);
    var mix = S.ctx.createGain(); mix.gain.setValueAtTime(0.5, t);
    for (var d = 0; d < 2; d++) {
      var o = S.ctx.createOscillator(); o.type = "sawtooth";
      o.detune.setValueAtTime(d ? 3.5 : -3.5, t);                 // the reed's beat
      if (opts.prevFreq && opts.prevFreq > 20) {
        o.frequency.setValueAtTime(opts.prevFreq, t);
        o.frequency.exponentialRampToValueAtTime(Math.max(20, freq), t + 0.05);
      } else o.frequency.setValueAtTime(freq, t);
      o.connect(mix); o.start(t); o.stop(t + dur + 0.5);
    }
    var shaper = S.ctx.createWaveShaper(); shaper.curve = bagpipeCurve(grit);
    mix.connect(shaper);
    // dry body + two bandpass formants, summed — the nasal reed color
    var fmix = S.ctx.createGain();
    var dry = S.ctx.createGain(); dry.gain.setValueAtTime(0.5, t); shaper.connect(dry); dry.connect(fmix);
    var bp1 = S.ctx.createBiquadFilter(); bp1.type = "bandpass";
    bp1.frequency.setValueAtTime(2100 + reed * 700, t); bp1.Q.setValueAtTime(6, t);
    var g1 = S.ctx.createGain(); g1.gain.setValueAtTime(0.8, t); shaper.connect(bp1); bp1.connect(g1); g1.connect(fmix);
    var bp2 = S.ctx.createBiquadFilter(); bp2.type = "bandpass";
    bp2.frequency.setValueAtTime(3200 + reed * 800, t); bp2.Q.setValueAtTime(7, t);
    var g2 = S.ctx.createGain(); g2.gain.setValueAtTime(0.5, t); shaper.connect(bp2); bp2.connect(g2); g2.connect(fmix);
    var lp = S.ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(3600 + reed * 2000, t);
    fmix.connect(lp); lp.connect(out);
    if (breathAmt > 0.02) {
      var nz = noiseSource();
      var nbp = S.ctx.createBiquadFilter(); nbp.type = "bandpass"; nbp.frequency.setValueAtTime(3200, t); nbp.Q.setValueAtTime(1.4, t);
      var ng = S.ctx.createGain();
      nz.connect(nbp); nbp.connect(ng); ng.connect(out);
      var npk = breathAmt * 0.12 * (gainMul || 1);
      env(ng, t, [[0.06, npk], [Math.max(0.1, dur - 0.2), npk * 0.8], [0.2, 0]]);
      nz.start(t, noiseOffset()); nz.stop(t + dur + 0.3);
    }
    var peak = (gainMul || 1) * 0.5;
    var atk = opts.swell ? Math.min(1.6, dur * 0.32) : 0.05;
    var rel = opts.swell ? Math.min(0.8, 0.2 + dur * 0.06) : 0.22;
    env(out, t, [[atk, peak], [Math.max(0.06, dur - atk - rel), peak * 0.9], [rel, 0]]);
  }
  // A melodic line — the deacon's register (an octave above the choir root),
  // slurred note to note. Returns the total sounded length.
  function bagpipeLine(t, notes, gainMul, pan) {
    var tt = t, total = 0, prev = 0;
    for (var i = 0; i < notes.length; i++) {
      bagpipeReed(tt, notes[i].f, notes[i].dur, gainMul, { pan: pan, prevFreq: prev });
      emitNote("bagpipe", notes[i].f, tt, notes[i].dur);
      prev = notes[i].f; tt += notes[i].dur; total += notes[i].dur;
    }
    return total;
  }
  function bagpipeToNotes(motif, beat) {
    return motif.notes.map(function (n, i) {
      var d = n.durBeats * beat;
      if (i === 0 || i === motif.notes.length - 1) d = Math.max(d, beat * rnd(1.4, 2.2));
      d = Math.min(d, beat * (i === motif.notes.length - 1 ? 4 : 3));
      return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.max(0.4, d) };
    });
  }
  // Harmony role — the sounding chord's open fifth (no third: the bright,
  // parallel-fifth pipe sound the tradition rewards), sustained and swelling.
  function bagpipeChord(t, dur, gainMul) {
    var ch = S.Harmony.current() || S.Harmony.advance();
    var rootF = ch ? ch.freqs[0] * 2 : S.F0 * S.ROOT_MULT;           // into the chanter register
    var fifthF = rootF * 1.5;
    var pan = rnd(-0.3, 0.3);
    bagpipeReed(t, rootF, dur, gainMul, { pan: pan, swell: true });
    bagpipeReed(t + rnd(0.02, 0.08), fifthF, dur, gainMul * 0.85, { pan: pan, swell: true });
    if (chance(0.5)) bagpipeReed(t + rnd(0.02, 0.1), rootF * 2, dur, gainMul * 0.55, { pan: pan, swell: true });
    emitNote("bagpipe", rootF, t, dur);
    emitNote("bagpipe", fifthF, t, dur);
  }
  // How much the piper plays in this section (0 = tacet), before the season
  // scales it. THE ORDER OF SERVICE governs the reed's frequency of use.
  function bagpipePresence() {
    var base;
    switch (S.C.section) {
      case "prelude":    base = 0.3;  break;
      case "invocation": base = 0.12; break;
      case "hymn":       base = 0.7;  break;
      case "interlude":  base = 0.7;  break;
      case "testimony":  base = 0.06; break;   // hardly — the pipe is loud, this room is intimate
      case "sacrament":  base = 0;    break;   // gone — the stillness is the point
      case "doxology":   base = 0.95; break;   // out in force — the whole gathering praising
      case "postlude":   base = 0.6;  break;
      default:           base = 0.25;
    }
    // The piper is a festival creature: seasonPos 0 (fast-day trough) → quieter,
    // 1 (conference/jubilee peak) → out on the bluff.
    var seasonMul = 0.55 + 0.75 * S.seasonPos;
    var act = S.C.meeting ? S.C.meeting.activity : "ordinary";
    if (act === "fast") seasonMul *= 0.4;
    else if (act === "jubilee") seasonMul *= 1.15;
    return Math.max(0, Math.min(1, base * seasonMul));
  }
  // Which role this section wants — melodic line vs. sustained harmony.
  function bagpipeRole() {
    switch (S.C.section) {
      case "doxology":   return chance(0.7) ? "harmony" : "melody";  // swells the final praise
      case "hymn":       return chance(0.5) ? "harmony" : "melody";
      case "invocation": return chance(0.55) ? "harmony" : "melody";
      default:           return "melody";                            // prelude, interlude, postlude
    }
  }
  function bagpipeCycle() {
    if (!S.playing || S.SHELVED.bagpipe) return;     // shelved: the piper never comes down off the bluff
    var pres = bagpipePresence();
    if (pres <= 0.001 || S.C.section === "sacrament") {
      scheduleLayer(bagpipeCycle, rnd(6, 12) * 1000, "bagpipe"); return;
    }
    // gate by presence: some turns the piper simply stays his hand, and comes
    // back around soon to try again
    if (!chance(pres)) { scheduleLayer(bagpipeCycle, rnd(3, 7) * 1000, "bagpipe"); return; }
    var gm = 0.9 * (0.6 + intensity() * 0.5);
    var role = bagpipeRole();
    // the melodic line wants the open air; when it's taken (the choir and the
    // deacon are singing), the piper sustains harmony under them instead of
    // competing for the line — so the reed is present either way
    if (role === "melody" && !airFree()) role = "harmony";
    if (role === "harmony") {
      // a landscape voice: it does not claim the air
      var dur = rnd(6, 11);
      bagpipeChord(S.ctx.currentTime + 0.1, dur, gm * 0.85);
      scheduleLayer(bagpipeCycle, (dur + rnd(2, 6) * gapMul()) * 1000, "bagpipe");
      return;
    }
    // melodic role — claims the air like the deacon
    var pace = getLayerParam("bagpipe", "pace", 1);
    var beat = rnd(0.9, 1.25) / pace;
    var motif = S.Motif.overdueFor("bagpipe") ? S.Motif.claim("bagpipe") : S.Motif.request("bagpipe");
    if (!motif) { scheduleLayer(bagpipeCycle, 5000, "bagpipe"); return; }
    var nSy = Math.max(motif.notes.length, pickW([[6, 2], [8, 3], [10, 1]]));
    var line = S.Prosody.pourIntoLine(motif, nSy);
    var pan = rnd(-0.35, 0.35);
    var total = bagpipeLine(S.ctx.currentTime + 0.12, bagpipeToNotes({ notes: line }, beat), gm, pan);
    if (chance(0.4)) S.Motif.post("bagpipe", pickW([["choir", 2], ["clarinet", 2], ["bells", 1]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    claimAir(total, rnd(3, 8) * silenceMul());
    var gap = rnd(6, 14) * gapMul();
    scheduleLayer(bagpipeCycle, (total + gap) * 1000, "bagpipe");
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.bagpipeLine = bagpipeLine;
  S.bagpipeCycle = bagpipeCycle;
})();

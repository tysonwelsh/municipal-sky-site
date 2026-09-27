// ============================================================================
// KOLOB — kolob-voices-choir.js: the choir
//
// SATB from the harmony engine — the formant voices, the metered verse, and
// the fuging entries. Split from kolob-audio.js (v0.30); see the room list
// in kolob-core.js.
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
  // from kolob-voices-organ.js
  function organChord(t, dur, chord, gainMul) { return S.organChord(t, dur, chord, gainMul); }
  // from kolob-voices-ground.js
  function stringsPad(t, dur, gainMul, fifthOnly) { return S.stringsPad(t, dur, gainMul, fifthOnly); }
  // from kolob-meeting.js
  function inFuging() { return S.inFuging(); }
  function inQuestion() { return S.inQuestion(); }
  function silenceMul() { return S.silenceMul(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function rnd(a, b) { return S.rnd(a, b); }
  function rint(a, b) { return S.rint(a, b); }
  function chance(p) { return S.chance(p); }
  function pickW(pool) { return S.pickW(pool); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function scheduleLayer(fn, baseMs, layer) { return S.scheduleLayer(fn, baseMs, layer); }
  function scheduleRaw(fn, ms) { return S.scheduleRaw(fn, ms); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  function airFree() { return S.airFree(); }
  function claimAir(durS, marginS) { return S.claimAir(durS, marginS); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.Harmony, S.METERS, S.Prosody, S.MEETINGS, S.C, S.Motif)

  // ==========================================================================
  // VOICE: CHOIR — SATB from the harmony engine. Formant-filtered "ah"/"oo",
  // congregational scoops between chords, dispersed voicings. Sings verses in
  // the hymns (poured through the meter), answers lining-out calls, gathers
  // for the fuging entries, amens the doxology.
  // ==========================================================================
  var CHOIR_FORMANTS = {
    ah: [[700, 1080, 2650], [600, 1040, 2250], [440, 1800, 2700], [340, 870, 2250]],  // S A T B
    oo: [[325, 700, 2530], [370, 630, 2750], [300, 870, 2240], [280, 630, 2340]],
  };
  var CHOIR_PANS = [0.35, -0.35, 0.55, -0.55];   // S A T B — spread wide; the frontier is broad
  function choirVoiceLine(t, notes, vi, gainMul) {
    // one SATB voice walks a line of {f, dur} with scoops between pitches
    var vowelAmt = getLayerParam("choir", "vowel", 0.4);
    var scoop = getLayerParam("choir", "scoop", 0.5);
    var dest = panAt("choir", CHOIR_PANS[vi]);
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    // LESSON (Bardo, hard-won): pre-attenuate before resonant formants — the
    // Q boosts ~9x and will rail the master via the compressor's auto-makeup.
    var pre = S.ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var fAh = CHOIR_FORMANTS.ah[vi], fOo = CHOIR_FORMANTS.oo[vi];
    var vg = S.ctx.createGain();
    for (var fi = 0; fi < 3; fi++) {
      var bq = S.ctx.createBiquadFilter();
      bq.type = "bandpass";
      // vowel blend is FIXED per phrase — formant frequencies never chase
      // automation mid-note (setValueAtTime only; biquads stay stable)
      bq.frequency.setValueAtTime(fAh[fi] * (1 - vowelAmt) + fOo[fi] * vowelAmt, t);
      bq.Q.setValueAtTime(fi === 0 ? 6 : fi === 1 ? 9 : 5, t);
      var bg = S.ctx.createGain();
      bg.gain.setValueAtTime(fi === 0 ? 1 : fi === 1 ? 0.6 : 0.1, t);
      pre.connect(bq); bq.connect(bg); bg.connect(vg);
    }
    vg.connect(dest);
    // the line: pitch moves by scoops (short linearRamps on the OSCILLATOR,
    // never on a biquad), a breath of portamento into each syllable
    var det = 1 + rnd(-0.004, 0.004);
    o.frequency.setValueAtTime(notes[0].f * det, t);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.1, Math.min(0.45, n.dur * 0.3)) * (0.4 + scoop);
        o.frequency.setValueAtTime(notes[i - 1].f * det, tt);
        o.frequency.linearRampToValueAtTime(n.f * det, tt + port);
      }
      tt += n.dur;
      total += n.dur;
    }
    var peak = (gainMul || 1) * 0.5;
    env(vg, t, [[rnd(0.6, 1.2), peak], [Math.max(0.2, total - 2.4), peak * 0.88], [rnd(1, 1.6), 0]]);
    o.start(t); o.stop(t + total + 1.8);
    return total;
  }
  function activeVoices() {
    var size = Math.round(getLayerParam("choir", "size", 3));
    var meet = S.C.meeting ? S.MEETINGS[S.C.meeting.activity].choirSize : 3;
    var n = Math.max(1, Math.min(4, Math.min(size, meet)));
    return n === 1 ? [0] : n === 2 ? [0, 3] : n === 3 ? [0, 1, 3] : [0, 1, 2, 3];
  }
  // Render a harmonized line: chords per syllable from Harmony.harmonize.
  // voiceIdx order in chord.voicing is [b,t,a,s]; CHOIR vi is [s,a,t,b]=[0..3].
  var VI_TO_CHORDPOS = [3, 2, 1, 0];
  function choirHarmonizedLine(t, harmonized, beat, gainMul) {
    var vis = activeVoices();
    var lineNotes = { 0: [], 1: [], 2: [], 3: [] };
    for (var i = 0; i < harmonized.length; i++) {
      var ch = harmonized[i].chord;
      var dur = harmonized[i].dur * beat;
      for (var v = 0; v < vis.length; v++) {
        var vi = vis[v];
        lineNotes[vi].push({ f: ch.freqs[VI_TO_CHORDPOS[vi]], dur: dur });
      }
    }
    var total = 0;
    for (var v2 = 0; v2 < vis.length; v2++) {
      var vi2 = vis[v2];
      var stagger = vi2 === 0 ? 0 : rnd(0.05, 0.25);           // the congregation breathes together, loosely
      var tot = choirVoiceLine(t + stagger, lineNotes[vi2], vi2, gainMul * (vi2 === 0 ? 1 : 0.8));
      if (tot > total) total = tot;
    }
    for (var i2 = 0; i2 < harmonized.length; i2++) {
      var at = t; for (var k = 0; k < i2; k++) at += harmonized[k].dur * beat;
      var ch2 = harmonized[i2].chord, dur2 = harmonized[i2].dur * beat;
      // report EVERY singing voice to the visualizer (not just the soprano), so
      // the grand staff shows the full four-part harmony — the bass voice fills
      // the bass staff, the soprano the treble. emitNote is view-only; the sound
      // is unchanged (the voices already sang above).
      for (var vv = 0; vv < vis.length; vv++) {
        emitNote("choir", ch2.freqs[VI_TO_CHORDPOS[vis[vv]]], at, dur2);
      }
    }
    return total;
  }
  function choirVerse() {
    if (!S.playing) return;
    var s = S.C.section;
    var sings = s === "hymn" || s === "doxology";
    if (!sings || inFuging() || inQuestion()) { scheduleRaw(choirVerse, 6000); return; }
    if (!airFree()) { scheduleRaw(choirVerse, rnd(4, 9) * 1000); return; }

    var t = S.ctx.currentTime + 0.15;
    var beat = rnd(1.05, 1.5);                                 // slow — hymn time, prairie time
    var meterLines = S.METERS[S.C.meter] || S.METERS.CM;

    // Lining-out answer takes precedence: sing back the deacon's line, slower.
    if (S.Motif.pendingLineOut("choir")) {
      var call = S.Motif.claim("choir");
      if (call) {
        var ln = call.notes.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
        var hz = S.Harmony.harmonize(ln);
        var total = choirHarmonizedLine(t, hz, beat * 1.4, 0.95);  // 0.7x tempo of the call
        claimAir(total, rnd(4, 9) * silenceMul());
        emitNote("choir", 0, t, total);
        scheduleLayer(choirVerse, (total + rnd(6, 14) * gapMul()) * 1000, "choir");
        return;
      }
    }

    // A verse: 2 lines of the meter per speech (whole verses would crowd the
    // air; the field hears the hymn in couplets, with sky between).
    var motif = S.Motif.overdueFor("choir") ? S.Motif.claim("choir") : S.Motif.request("choir");
    if (!motif) { scheduleRaw(choirVerse, 6000); return; }
    var nLines = s === "doxology" ? 1 : 2;
    var lineStart = t, sungTotal = 0;
    for (var li = 0; li < nLines; li++) {
      var nSyl = meterLines[(S.C.verseLine + li) % meterLines.length];
      var line = S.Prosody.pourIntoLine(motif, nSyl);
      var ln2 = line.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
      var hz2 = S.Harmony.harmonize(ln2);
      var lt = choirHarmonizedLine(lineStart, hz2, beat, 0.9);
      emitEvent({ cat: "verse", label: "¶ " + S.C.meter + " line " + (li + 1), detail: nSyl + " syllables · " + motif.name + "·g" + motif.gen });
      sungTotal += lt;
      lineStart += lt + rnd(1.8, 3.4);                         // the breath between lines
      sungTotal += 2.5;
    }
    S.C.verseLine = (S.C.verseLine || 0) + nLines;                 // the hymn walks its stanza
    // the doxology closes each speech with the amen
    if (s === "doxology") {
      var cadChords = S.Harmony.cadence("plagal");
      var cd = rnd(2.8, 3.8);
      for (var ci = 0; ci < cadChords.length; ci++) {
        var vis = activeVoices();
        for (var v = 0; v < vis.length; v++) {
          var vi = vis[v];
          var vf = cadChords[ci].freqs[VI_TO_CHORDPOS[vi]];
          choirVoiceLine(lineStart + ci * cd, [{ f: vf, dur: cd * (ci ? 1.6 : 1.02) }], vi, 0.9);
          emitNote("choir", vf, lineStart + ci * cd, cd);       // print every voice of the amen
        }
      }
      sungTotal += cd * 2 + 1;
    }
    claimAir(sungTotal, rnd(5, 12) * silenceMul());
    if (chance(0.4)) S.Motif.post("choir", pickW([["clarinet", 3], ["bells", 1]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    var gap = rnd(10, 22) * gapMul();
    scheduleLayer(choirVerse, (sungTotal + gap) * 1000, "choir");
  }

  // ==========================================================================
  // FUGING ENTRY — the voices go out one by one (bass first, at the fifth and
  // the octave by turns) and gather again into homophony. Strings hold the
  // open fifth beneath. After the convergence: the stillness.
  // ==========================================================================
  function fugingEntry() {
    var theme = S.Motif.theme();
    if (!theme) return 4;
    // under the withholding a fuging head may quote at most 3 notes — the
    // imitation foreshadows, it must not announce
    var headCap = S.C.cumulative && !S.C.assemblyFired ? 3 : 6;
    var head = theme.notes.slice(0, Math.min(headCap, theme.notes.length));
    var t = S.ctx.currentTime + 0.3;
    var beat = rnd(1.0, 1.3);
    var vis = [3, 2, 1, 0];                                    // B, T, A, S — bottom up
    var stagger = rnd(2.4, 3.2);
    var octForVi = { 0: 7, 1: 7, 2: 0, 3: 0 };                 // upper voices an octave up (7-space)
    var entryCount = Math.min(4, rint(2, activeVoices().length + 1));
    var lastEnd = t;
    for (var e = 0; e < entryCount; e++) {
      var vi = vis[e % 4];
      var shift = (e % 2 === 1 ? 4 : 0) + octForVi[vi];        // alternating tonic / fifth entries
      var notes = head.map(function (n) {
        return { f: degFreq(projDeg(n.deg + shift) - (vi >= 2 ? colN() : 0)), dur: n.durBeats * beat };
      });
      var at = t + e * stagger;
      var tot = choirVoiceLine(at, notes, vi, 0.85);
      // report the head this voice sings, note by note, as choirVoiceLine
      // walks it (view-only: no dice, no timing — the page prints the head)
      for (var hn = 0, ht = at; hn < notes.length; ht += notes[hn].dur, hn++) emitNote("choir", notes[hn].f, ht, notes[hn].dur);
      if (at + tot > lastEnd) lastEnd = at + tot;
    }
    // strings hold the open fifth under the imitation
    stringsPad(t, (lastEnd - t) + 4, 0.7, true);
    // convergence: all voices land a plagal amen together
    var cadAt = lastEnd + rnd(0.5, 1.2);
    var chords = S.Harmony.cadence("plagal");
    var cd = rnd(2.6, 3.4);
    for (var ci = 0; ci < chords.length; ci++) {
      var avs = activeVoices();
      for (var v = 0; v < avs.length; v++) {
        var vvi = avs[v];
        choirVoiceLine(cadAt + ci * cd, [{ f: chords[ci].freqs[VI_TO_CHORDPOS[vvi]], dur: cd * (ci ? 1.7 : 1.02) }], vvi, 0.95);
      }
    }
    organChord(cadAt, cd * 2.4, chords[chords.length - 1], 0.55);
    var totalDur = (cadAt + cd * 2.4) - t;
    claimAir(totalDur, 4);
    emitEvent({ cat: "fuging", label: "⁂ fuging entry ×" + entryCount, detail: "stagger " + stagger.toFixed(1) + "s · at the fifth · " + (theme.gesture || "") });
    return totalDur;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.choirVoiceLine = choirVoiceLine;
  S.activeVoices = activeVoices;
  S.VI_TO_CHORDPOS = VI_TO_CHORDPOS;
  S.choirHarmonizedLine = choirHarmonizedLine;
  S.choirVerse = choirVerse;
  S.fugingEntry = fugingEntry;
})();

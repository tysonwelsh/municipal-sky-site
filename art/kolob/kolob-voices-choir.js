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
  // (the singer's own detune and breath are sound-level: synth:choir)
  function choirVoiceLine(t, notes, vi, gainMul) {
    var Y = synth("choir");
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
    var det = 1 + Y.rnd(-0.004, 0.004);
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
    env(vg, t, [[Y.rnd(0.6, 1.2), peak], [Math.max(0.2, total - 2.4), peak * 0.88], [Y.rnd(1, 1.6), 0]]);
    o.start(t); o.stop(t + total + 1.8);
    return total;
  }
  function activeVoices() {
    var size = Math.round(getLayerParam("choir", "size", 3));
    var sunday = S.Meeting.sunday();
    var meet = sunday ? sunday.choirSize : 3;
    var n = Math.max(1, Math.min(4, Math.min(size, meet)));
    return n === 1 ? [0] : n === 2 ? [0, 3] : n === 3 ? [0, 1, 3] : [0, 1, 2, 3];
  }
  // Render a harmonized line: chords per syllable from Harmony.harmonize.
  // voiceIdx order in chord.voicing is [b,t,a,s]; CHOIR vi is [s,a,t,b]=[0..3].
  var VI_TO_CHORDPOS = [3, 2, 1, 0];
  var PART = ["S", "A", "T", "B"];                 // the part each choir voice sings (the note's report)
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
      var stagger = vi2 === 0 ? 0 : synth("choir").rnd(0.05, 0.25);   // the congregation breathes together, loosely
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
        emitNote("choir", ch2.freqs[VI_TO_CHORDPOS[vis[vv]]], at, dur2, { part: PART[vis[vv]], chord: ch2.id });
      }
    }
    return total;
  }
  // The choir's turn, at scheduled time tc. Waiting for the air draws from
  // the choir's waiting stream; a turn it sings is a fork of its own.
  function choirVerse(tc) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    var sings = s === "hymn" || s === "doxology";
    // no couplet is begun under the joint's amen: the hymn's time is up, and
    // the next line belongs to the next section (round 2 — v0.32 could start
    // a couplet here and sing it half a minute into whatever came next)
    if (!sings || inFuging() || inQuestion() || S.Meeting.jointing()) { cueIn("choir", 6, choirVerse); return; }
    if (!airFree()) { cueIn("choir", wait("choir").rnd(4, 9), choirVerse); return; }

    var R = turn("choir");
    var t = tc + 0.15;
    var beat = R.rnd(1.05, 1.5);                               // slow — hymn time, prairie time
    var meterLines = METERS[S.Meeting.meter()] || METERS.CM;
    var mo = S.moment();

    // Lining-out answer takes precedence: sing back the deacon's line, slower.
    if (Motif.pendingLineOut("choir")) {
      var call = Motif.claim("choir", mo, R);
      if (call) {
        var ln = call.notes.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
        var hz = S.Harmony.harmonize(ln, R, t, beat * 1.4, "choir");
        var total = choirHarmonizedLine(t, hz, beat * 1.4, 0.95);  // 0.7x tempo of the call
        claimAir(total, R.rnd(4, 9) * silenceMul());
        emitNote("choir", 0, t, total);
        // THE LINE AS LINED (SCORE §5.1's practice "lined"; round 2, the
        // critic): the deacon gave the hymn's first line and the choir sings
        // it back — told with its Score like every sung line, as the first
        // line of the verse the hymn stands in, and practice "lined". It is
        // the precentor's line again, not the next of the stanza: the verse's
        // walk (the couplets, practice "sung") does not count it. Typed only
        // (SCORE §6: new words carry no label); the minutes keep the row
        // they always gave it (the deacon's ☞), and write none for this.
        var linedMeter = S.Meeting.meter(), linedLines = METERS[linedMeter] || METERS.CM;
        emitEvent({
          type: "verse-line", hymnId: S.Meeting.hymnId(), verse: Math.floor(S.Meeting.verseLine() / linedLines.length), line: 0, speechLine: 1,
          practice: "lined", meter: linedMeter, syllables: call.notes.length, motif: call.name, gen: call.gen, start: t, beatS: beat * 1.4,
          score: KOLOB.Harmony.toLine(hz, S.moment(), { trochee: linedMeter === "87.87" }),
        });
        cueLayer("choir", total + R.rnd(6, 14) * gapMul(), choirVerse);
        return;
      }
    }

    // A verse: 2 lines of the meter per speech (whole verses would crowd the
    // air; the field hears the hymn in couplets, with sky between).
    var motif = Motif.overdueFor("choir", mo) ? Motif.claim("choir", mo, R) : Motif.request("choir", mo, R);
    if (!motif) { cueIn("choir", 6, choirVerse); return; }
    var nLines = s === "doxology" ? 1 : 2;
    var lineStart = t, sungTotal = 0;
    var hymnId = S.Meeting.hymnId(), meterName = S.Meeting.meter();
    for (var li = 0; li < nLines; li++) {
      var at = S.Meeting.verseLine() + li;                     // the line's place in the hymn, from its first
      var nSyl = meterLines[at % meterLines.length];
      var line = Prosody.pourIntoLine(motif, nSyl, R);
      var ln2 = line.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
      // each line's chords are written into the book where they are sung
      var hz2 = S.Harmony.harmonize(ln2, R, lineStart, beat, "choir");
      var lt = choirHarmonizedLine(lineStart, hz2, beat, 0.9);
      // THE LINE AS WRITTEN (SCORE §5, §6): a stanza begins, and each line
      // is told with its Score — four parts, spelled and pitched, and its
      // chords (a transcription: no die is thrown for it)
      var verse = Math.floor(at / meterLines.length), inStanza = at % meterLines.length;
      if (inStanza === 0) emitEvent({ type: "verse-start", hymnId: hymnId, verse: verse, practice: "sung" });
      emitEvent({
        type: "verse-line", hymnId: hymnId, verse: verse, line: inStanza, speechLine: li + 1, practice: "sung",
        meter: meterName, syllables: nSyl, motif: motif.name, gen: motif.gen, start: lineStart, beatS: beat,
        score: KOLOB.Harmony.toLine(hz2, S.moment(), { trochee: meterName === "87.87" }),
        cat: "verse", label: "¶ " + meterName + " line " + (li + 1), detail: nSyl + " syllables · " + motif.name + "·g" + motif.gen,
      });
      sungTotal += lt;
      lineStart += lt + R.rnd(1.8, 3.4);                       // the breath between lines
      sungTotal += 2.5;
    }
    S.Meeting.advanceVerse(nLines);                              // the hymn walks its stanza
    // the doxology closes each speech with the amen
    if (s === "doxology") {
      var cadChords = S.Harmony.cadence("plagal", R, lineStart, "choir");
      var cd = R.rnd(2.8, 3.8);
      for (var ci = 0; ci < cadChords.length; ci++) {
        var amenDur = cd * (ci ? 1.6 : 1.02);                    // the amen's last chord is held
        S.Harmony.write(cadChords[ci], lineStart + ci * cd, "choir", amenDur);
        var vis = activeVoices();
        for (var v = 0; v < vis.length; v++) {
          var vi = vis[v];
          var vf = cadChords[ci].freqs[VI_TO_CHORDPOS[vi]];
          choirVoiceLine(lineStart + ci * cd, [{ f: vf, dur: amenDur }], vi, 0.9);
          // print every voice of the amen, as long as it is sung (round 2:
          // the held last chord was told as long as the first)
          emitNote("choir", vf, lineStart + ci * cd, amenDur, { part: PART[vi], chord: cadChords[ci].id });
        }
      }
      sungTotal += cd * 2 + 1;
    }
    claimAir(sungTotal, R.rnd(5, 12) * silenceMul());
    if (R.chance(0.4)) Motif.post("choir", R.pickW([["clarinet", 3], ["bells", 1]]), motif, R.pickW([["imitate", 3], ["invert", 2], ["develop", 2]]), mo, R);
    var gap = R.rnd(10, 22) * gapMul();
    cueLayer("choir", sungTotal + gap, choirVerse);
  }

  // ==========================================================================
  // FUGING ENTRY — the voices go out one by one (bass first, at the fifth and
  // the octave by turns) and gather again into homophony. Strings hold the
  // open fifth beneath. After the convergence: the stillness.
  // ==========================================================================
  // at scheduled time tc (the conductor's cue); its dice are a fuging turn
  function fugingEntry(tc) {
    var theme = Motif.theme();
    if (!theme) return 4;
    var R = turn("fuging");
    // under the withholding a fuging head may quote at most 3 notes — the
    // imitation foreshadows, it must not announce
    var headCap = S.Meeting.withheld() ? 3 : 6;
    var head = theme.notes.slice(0, Math.min(headCap, theme.notes.length));
    var t = tc + 0.3;
    var beat = R.rnd(1.0, 1.3);
    var vis = [3, 2, 1, 0];                                    // B, T, A, S — bottom up
    var stagger = R.rnd(2.4, 3.2);
    var octForVi = { 0: 7, 1: 7, 2: 0, 3: 0 };                 // upper voices an octave up (7-space)
    var entryCount = Math.min(4, R.rint(2, activeVoices().length + 1));
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
      for (var hn = 0, ht = at; hn < notes.length; ht += notes[hn].dur, hn++) emitNote("choir", notes[hn].f, ht, notes[hn].dur, { part: PART[vi] });
      if (at + tot > lastEnd) lastEnd = at + tot;
    }
    // strings hold the open fifth under the imitation
    stringsPad(t, (lastEnd - t) + 4, 0.7, true);
    // convergence: all voices land a plagal amen together (written into
    // the chord book where it is sung, and every voice of it reported)
    var cadAt = lastEnd + R.rnd(0.5, 1.2);
    var chords = S.Harmony.cadence("plagal", R, cadAt, "fuging");
    var cd = R.rnd(2.6, 3.4);
    for (var ci = 0; ci < chords.length; ci++) {
      var amenDur = cd * (ci ? 1.7 : 1.02);
      S.Harmony.write(chords[ci], cadAt + ci * cd, "fuging", amenDur);
      var avs = activeVoices();
      for (var v = 0; v < avs.length; v++) {
        var vvi = avs[v];
        var cf = chords[ci].freqs[VI_TO_CHORDPOS[vvi]];
        choirVoiceLine(cadAt + ci * cd, [{ f: cf, dur: amenDur }], vvi, 0.95);
        emitNote("choir", cf, cadAt + ci * cd, amenDur, { part: PART[vvi], chord: chords[ci].id });
      }
    }
    // the organ follows the amen as it is sung (round 2: it used to sound
    // the final chord under the first) and holds the last as long as ever
    organChord(cadAt, cd * 1.02, chords[0], 0.55);
    organChord(cadAt + cd, cd * 1.4, chords[chords.length - 1], 0.55);
    var totalDur = (cadAt + cd * 2.4) - t;
    claimAir(totalDur, 4);
    emitEvent({ type: "fuging", entries: entryCount, stagger: stagger, cat: "fuging", label: "⁂ fuging entry ×" + entryCount, detail: "stagger " + stagger.toFixed(1) + "s · at the fifth · " + (theme.gesture || "") });
    return totalDur;
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.choirVoiceLine = choirVoiceLine;
  S.activeVoices = activeVoices;
  S.VI_TO_CHORDPOS = VI_TO_CHORDPOS;
  S.CHOIR_PART = PART;
  S.choirHarmonizedLine = choirHarmonizedLine;
  S.choirVerse = choirVerse;
  S.fugingEntry = fugingEntry;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-choir.js"] = true;   // the load guard's roll call
})();

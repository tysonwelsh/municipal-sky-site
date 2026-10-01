// ============================================================================
// KOLOB — kolob-voices-choir.js: the choir
//
// The singing in the meeting. The ward (THE WARD, below: thirty-two throats
// from kolob-voices-vocal.js, the people of kolob-cast.js) sings the
// composed hymns (singHymnWard) and everything the choir sings around them
// — the hum of the gathering, the answers to the deacon, the fuging, the
// amens — a section of the ward for each house voice (choirVoiceLine). The
// house's four formant voices (houseVoiceLine, singHymnHouse) are the
// owner's A/B (?choir=house) and the fallback when the cast is not loaded
// (hymnPlan returns null: a lab without it). Lends choirVoiceLine,
// choirVerse, fugingEntry, singHymn, hymnPlan and the ward's desk (the LENT
// block at the foot).
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
  function organPartLine(t, notes, gainMul, opts) { return S.organPartLine(t, notes, gainMul, opts); }
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
  function cueAt(lane, t, fn) { return S.cueAt(lane, t, fn); }
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
  // THE HUM (the humming seating): lips closed, the sound through the nose
  // — one broad resonance where each voice sits, the
  // upper formants all but gone (S A T B: centre, Hz; then the faint two)
  var HUM_FORMANTS = [[500, 1150, 2500], [400, 1050, 2400], [300, 950, 2300], [220, 900, 2200]];
  // (the singer's own detune and breath are sound-level: synth:choir)
  // ONE SATB VOICE WALKS A LINE — a SECTION of the ward (its eight people,
  // each in their own voice: THE WARD, below); the house's formant voice is
  // the fallback (no cast loaded, or ?choir=house)
  function choirVoiceLine(t, notes, vi, gainMul, vowel) {
    if (wardOn()) return wardSectionLine(t, notes, vi, gainMul, vowel);
    return houseVoiceLine(t, notes, vi, gainMul, vowel);
  }
  function houseVoiceLine(t, notes, vi, gainMul, vowel) {
    var Y = synth("choir");
    // one SATB voice walks a line of {f, dur} with scoops between pitches
    var vowelAmt = getLayerParam("choir", "vowel", 0.4);
    var scoop = getLayerParam("choir", "scoop", 0.5);
    var hum = vowel === "hum";
    var dest = panAt("choir", CHOIR_PANS[vi] * (hum ? 0.6 : 1));
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    // pre-attenuate before resonant formants — the Q boosts ~9x and would
    // rail the master through the compressor's auto-makeup
    var pre = S.ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var fAh = CHOIR_FORMANTS.ah[vi], fOo = CHOIR_FORMANTS.oo[vi];
    var vg = S.ctx.createGain();
    for (var fi = 0; fi < 3; fi++) {
      var bq = S.ctx.createBiquadFilter();
      bq.type = "bandpass";
      // vowel blend is FIXED per phrase — formant frequencies never chase
      // automation mid-note (setValueAtTime only; biquads stay stable)
      bq.frequency.setValueAtTime(hum ? HUM_FORMANTS[vi][fi] : fAh[fi] * (1 - vowelAmt) + fOo[fi] * vowelAmt, t);
      bq.Q.setValueAtTime(hum ? (fi === 0 ? 1.6 : 5) : fi === 0 ? 6 : fi === 1 ? 9 : 5, t);
      var bg = S.ctx.createGain();
      bg.gain.setValueAtTime(hum ? (fi === 0 ? 0.8 : fi === 1 ? 0.08 : 0.012) : fi === 0 ? 1 : fi === 1 ? 0.6 : 0.1, t);
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
    env(vg, t, [[Y.rnd(0.6, 1.2) * (hum ? 1.8 : 1), peak], [Math.max(0.2, total - 2.4), peak * 0.88], [Y.rnd(1, 1.6), 0]]);
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
  function choirHarmonizedLine(t, harmonized, beat, gainMul, vowel) {
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
      var tot = choirVoiceLine(t + stagger, lineNotes[vi2], vi2, gainMul * (vi2 === 0 ? 1 : 0.8), vowel);
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
  // THE HUM (the humming seating): the ward hums as it gathers, before the
  // organist has touched a key — the voices of the
  // day's choir on "mm", two to four of the day's chords, each written
  // into the chord book as the choir's (so the organist waits for the hum
  // to end, and a prelude cannot turn over under it). Once a prelude; its
  // dice are its own stream's (hum:<n>), so the verses keep theirs.
  function choirHum(tc, seat) {
    var R = turn("hum");
    var t = tc + 0.15, hum = seat.hum, harmonized = [];
    hum.sung = true;                               // (the seating is this meeting's own: a new meeting, a new hum)
    // (each chord written where the line will sing it: the same running
    // sum choirHarmonizedLine takes, to the last bit)
    for (var i = 0, at = t; i < hum.n; i++, at += 1 * hum.s) {
      var first = i === 0 && !S.Harmony.at(t) ? (seat.full ? { open: false, third: true, spread: seat.spread } : { spread: seat.spread }) : {};
      harmonized.push({ chord: S.Harmony.advance(first, R, at, "choir", hum.s), dur: 1 });
    }
    var total = choirHarmonizedLine(t, harmonized, hum.s, synth("choir").rnd(0.5, 0.65), "hum");   // (how loud: sound-level)
    cueLayer("choir", total + 6, choirVerse);
  }
  // The choir's turn, at scheduled time tc. Waiting for the air draws from
  // the choir's waiting stream; a turn it sings is a fork of its own.
  function choirVerse(tc) {
    if (!S.playing) return;
    var s = S.Meeting.section();
    if (s === "prelude" && !S.Meeting.jointing()) {
      var seat = S.Meeting.seating();
      if (seat && seat.hum && !seat.hum.sung) { choirHum(tc, seat); return; }
    }
    var sings = s === "hymn" || s === "doxology";
    // a rite seated for THE CHOIR ALONE: the ward hums a few of the day's
    // chords, once, early in the rite, the organ, the
    // harmonium and the deacon waiting (kolob-calendar.js SCENES); a rite
    // LINED OUT ONLY: the ward answers the deacon's lines, as in a hymn
    var scene = !sings && S.Meeting.scene ? S.Meeting.scene() : null;
    if (scene && scene.hum && !scene.hum.sung && !S.Meeting.jointing() && !S.hallListens() && !inQuestion() && S.localArc() > 0.06 && S.localArc() < 0.6) {
      choirHum(tc, scene); return;
    }
    var answers = !!(scene && scene.lined);
    // a composed hymn owns its section's singing (THE COMPOSED HYMN, below):
    // the choir's own turns wait for the next section — except, once the
    // hymn is sung, to answer the deacon if he lines out a line of the
    // day's material (the lining-out's old conversation, around the hymn)
    var composedHere = sings && !!S.Meeting.hymn();
    if (composedHere && (S.Meeting.hymnSounding() || !Motif.pendingLineOut("choir"))) { cueIn("choir", 6, choirVerse); return; }
    // no couplet is begun under the joint's amen: the hymn's time is up, and
    // the next line belongs to the next section (begun here, a couplet would
    // sing half a minute into whatever came next)
    // (nor while a planned fuging waits for its window: the verses leave it
    // free — see the conductor's fuging)
    if ((!sings && !(answers && Motif.pendingLineOut("choir"))) || inFuging() || inQuestion() || S.Meeting.jointing() || S.Meeting.fugingNear()) { cueIn("choir", 6, choirVerse); return; }
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
        // THE LINE AS LINED (SCORE §5.1's practice "lined"): the deacon gave
        // the hymn's first line and the choir sings
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
    if (composedHere || !sings) { cueIn("choir", 6, choirVerse); return; }

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
          // print every voice of the amen, as long as it is sung (the held
          // last chord for its whole hold, not for the first chord's length)
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
    // the organ follows the amen as it is sung (each chord under the chord
    // the voices are on, never the final one under the first) and holds the
    // last as long as ever
    organChord(cadAt, cd * 1.02, chords[0], 0.55);
    organChord(cadAt + cd, cd * 1.4, chords[chords.length - 1], 0.55);
    var totalDur = (cadAt + cd * 2.4) - t;
    claimAir(totalDur, 4);
    emitEvent({ type: "fuging", entries: entryCount, stagger: stagger, cat: "fuging", label: "⁂ fuging entry ×" + entryCount, detail: "stagger " + stagger.toFixed(1) + "s · at the fifth · " + (theme.gesture || "") });
    return totalDur;
  }

  // ==========================================================================
  // THE COMPOSED HYMN (PLAN-COMPOSITION §3, §4, §7; SCORE §5–§6). The day's
  // hymnal (kolob-hymnal.js) has had each hymn
  // written ahead; a singing section hands its hymn here, and the ward sings
  // it VERSE BY VERSE, in its dialect's own practice:
  //
  //   the Tabernacle  the organ gives out the tune (its last line, alone —
  //                   after a modulation through a shared chord when the
  //                   hymn is keyed away from home), then plays the four
  //                   parts under the ward; the plagal A-men (Hymn.amen)
  //                   after the last verse
  //   the Sacred Harp the tune in the tenor; the first verse sung "on the
  //                   notes" (fa sol la mi), the words after; no organ, no
  //                   amen — the closes are the bare fifths the composer
  //                   wrote
  //   the Old Way     lined out: the deacon's clarinet gives each line, the
  //                   ward answers it slowly, everyone on the tune (the men
  //                   an octave down), each singer ornamenting at the
  //                   places the composer marked, each in their own way
  //
  // The ward sings it (singHymnWard: THE WARD SINGS THE HYMN, below) — the
  // meeting's default. The house's four formant voices sing it
  // (singHymnHouse, below) as the owner's A/B (?choir=house) and as the
  // fallback when hymnPlan returns null (no cast loaded): the voices take
  // the Score's parts as the dialect asks — the Sacred Harp gives its tenor
  // the tune whoever else is missing — and each line is laid out in seconds
  // the way the hymn lab lays it (a fermata holds; the last note of a line
  // gives up a breath), handed to the voices a little ahead of when it
  // sounds. Every sounded note is reported as the Score writes it — its
  // part, its hymn, verse, line and beat, its syllable, its degree and
  // exact monzo — and every line is told with its Score (verse-line), so
  // the staff engraves real parts.
  //
  // Between two verses: a breath; and, where the section drew them, the
  // fuging (on this hymn's own head) and a guest seated in the section (the
  // conductor waits for the hymn: the hymn gives the guest its gap). Every
  // die is the hymn's own — hymn:<n>:<i>'s performance fork — and every
  // time is the music's: a chain of cues, each placing what follows from
  // what it knows.
  // ==========================================================================
  var AHEAD_S = 2.5;                                     // a line is handed to the voices this long before it sounds
  // the four-shape syllable of a degree (do is fa, re sol, mi la, fa fa,
  // sol sol, la la, ti mi), and the vowel it is sung on
  var SHAPE = ["fa", "sol", "la", "fa", "sol", "la", "mi"];
  var SHAPE_VOWEL = { fa: "ah", sol: "oh", la: "ah", mi: "ee" };
  // the vowels a verse is sung on until the ward has words (PLAN §6.5)
  var VERSE_VOWELS = [["ah", 3], ["oh", 2], ["ee", 1.3], ["oo", 1.5], ["eh", 1.5]];
  // the rest of the vowels, S A T B (ah and oo are the house's own, above)
  var HYMN_FORMANTS = {
    ah: CHOIR_FORMANTS.ah, oo: CHOIR_FORMANTS.oo,
    oh: [[450, 800, 2830], [440, 820, 2700], [400, 750, 2500], [360, 700, 2450]],
    ee: [[310, 2300, 3000], [320, 2150, 2900], [290, 2050, 2700], [270, 1950, 2550]],
    eh: [[550, 1800, 2700], [520, 1700, 2600], [480, 1650, 2500], [440, 1550, 2450]],
  };
  // where each voice's register sits, as a multiple of the key's do (for
  // placing the fuging's head and its amen)
  var REG = [1.55, 1.12, 0.74, 0.46];
  var STRETCH = { ordinary: [1.05, 1.3], fast: [1.15, 1.4], conference: [1.0, 1.2], jubilee: [0.95, 1.15] };
  function Hy() { return KOLOB.Hymnal; }
  function Cm() { return KOLOB.Composer; }
  function mzRatio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function mzAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2], (a[3] || 0) + (b[3] || 0)]; }
  function cls7(d) { return ((d % 7) + 7) % 7; }

  // The voices of today's choir, and the Score part each sings (oct: the
  // octave it sings it in — the men take the Old Way's tune an octave down;
  // a Sacred Harp alto with no alto part doubles the tenor's tune above).
  function hymnVoices(h) {
    var vis = activeVoices(), n = vis.length;
    var parts = {};
    h.lines.forEach(function (l) { for (var p in l.notes) if (l.notes[p] && l.notes[p].length) parts[p] = true; });
    if (Object.keys(parts).length === 1) {
      return vis.map(function (vi) { return { vi: vi, part: h.melodyPart, oct: vi >= 2 ? 0.5 : 1 }; });
    }
    if (h.melodyPart === "T") {
      var hasA = h.lines.every(function (l) { return l.notes.A && l.notes.A.length; });
      if (n === 1) return [{ vi: 2, part: "T", oct: 1 }];
      if (n === 2) return [{ vi: 2, part: "T", oct: 1 }, { vi: 3, part: "B", oct: 1 }];
      if (n === 3) return [{ vi: 0, part: "S", oct: 1 }, { vi: 2, part: "T", oct: 1 }, { vi: 3, part: "B", oct: 1 }];
      return [{ vi: 0, part: "S", oct: 1 }, { vi: 1, part: hasA ? "A" : "T", oct: hasA ? 1 : 2 }, { vi: 2, part: "T", oct: 1 }, { vi: 3, part: "B", oct: 1 }];
    }
    return vis.map(function (vi) { return { vi: vi, part: PART[vi], oct: 1 }; });
  }

  // ONE VOICE SINGS A RUN OF NOTES — a formant voice as the house's, but
  // articulated for a hymn: a quicker onset, a small dip at each new
  // syllable (the consonant, without a breath of noise: a repeated note is
  // sung again, not held), a short glide into a new pitch, and the vowel of
  // each syllable — two formant banks, the silent one re-shaped while the
  // other sings, crossfaded inside the dip. Formant frequencies are only
  // ever SET, never swept (the biquads stay stable).
  //   notes: [{at, dur, f, vowel, syl (a new syllable), slide}] (at: s from t)
  function formantsOf(vowel, vi, cover) {
    var f = (HYMN_FORMANTS[vowel] || HYMN_FORMANTS.ah)[vi], oo = CHOIR_FORMANTS.oo[vi];
    return f.map(function (x, k) { return x * (1 - cover) + oo[k] * cover; });
  }
  function choirSingLine(t, notes, vi, gainMul, opts) {
    opts = opts || {};
    if (!notes.length) return 0;
    var Y = synth("choir");
    var scoop = getLayerParam("choir", "scoop", 0.5);
    var cover = getLayerParam("choir", "vowel", 0.4) * (opts.cover != null ? opts.cover : 0.5);
    var dest = panAt("choir", CHOIR_PANS[vi] * (opts.panMul != null ? opts.panMul : 1));
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    var pre = S.ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var vg = S.ctx.createGain();
    var QS = [6, 9, 5], GS = [1, 0.6, 0.1];
    var banks = [0, 1].map(function () {
      var gate = S.ctx.createGain(), fs = [];
      for (var fi = 0; fi < 3; fi++) {
        var bq = S.ctx.createBiquadFilter();
        bq.type = "bandpass";
        bq.Q.setValueAtTime(QS[fi], t);
        var bg = S.ctx.createGain(); bg.gain.setValueAtTime(GS[fi], t);
        pre.connect(bq); bq.connect(bg); bg.connect(gate);
        fs.push(bq);
      }
      gate.connect(vg);
      return { gate: gate, fs: fs };
    });
    vg.connect(dest);
    var det = 1 + Y.rnd(-0.0015, 0.0015);
    var t0 = t + notes[0].at, end = t + notes[notes.length - 1].at + notes[notes.length - 1].dur;
    // the vowels: bank 0 sings the first; each change re-shapes the idle bank
    var cur = 0, curV = notes[0].vowel || "ah", freeAt = t0;
    function shape(b, vowel, at) { var fq = formantsOf(vowel, vi, cover); for (var k = 0; k < 3; k++) banks[b].fs[k].frequency.setValueAtTime(fq[k], at); }
    shape(0, curV, t0 - 0.05); shape(1, curV, t0 - 0.05);
    banks[0].gate.gain.setValueAtTime(1, t0 - 0.05);
    banks[1].gate.gain.setValueAtTime(0, t0 - 0.05);
    // the pitch: a small scoop into the first note, a glide into each new one
    var fr = o.frequency, fT = t0;
    fr.setValueAtTime(notes[0].f * det * Math.pow(2, -28 / 1200), t0 - 0.02);
    fr.linearRampToValueAtTime(notes[0].f * det, t0 + 0.08);
    fT = t0 + 0.08;
    // the level: onset, the syllables' dips, the release
    var peak = (gainMul || 1) * 0.5, g = vg.gain, gT = t0;
    var atk = opts.atk != null ? opts.atk : 0.1 + Y.rnd(0, 0.08);
    // (silent from before the oscillator starts: a gain's value before its
    // first event is 1, and 10 ms of the bare sawtooth at full level is a
    // click at every line)
    g.setValueAtTime(0, t0 - 0.05);
    g.setValueAtTime(0, t0 - 0.02);
    g.linearRampToValueAtTime(peak, t0 + atk);
    gT = t0 + atk;
    for (var i = 1; i < notes.length; i++) {
      var n = notes[i], p = notes[i - 1], c = t + n.at;
      var moved = Math.abs(n.f - p.f) > 0.01;
      if (moved) {
        var port = (n.slide ? Math.min(0.42, n.dur * 0.4) : Math.max(0.04, Math.min(0.12, 0.035 + 0.05 * p.dur)) * (0.6 + 0.8 * scoop));
        port = Math.min(port, 0.8 * Math.min(p.dur, n.dur) + (n.slide ? 0.2 : 0));
        var a0 = Math.max(c - port * 0.5, fT + 0.002);
        fr.setValueAtTime(p.f * det, a0);
        fr.linearRampToValueAtTime(n.f * det, Math.max(a0 + 0.004, c + port * 0.5));
        fT = Math.max(a0 + 0.004, c + port * 0.5);
      }
      if (n.syl && c - 0.07 > gT + 0.005 && p.dur > 0.12) {
        var dip = moved ? 0.72 : 0.5;
        g.setValueAtTime(peak, c - 0.07);
        g.linearRampToValueAtTime(peak * dip, c - 0.012);
        g.linearRampToValueAtTime(peak, c + 0.055);
        gT = c + 0.055;
        // a new vowel, crossfaded at the bottom of the dip
        var v = n.vowel || curV;
        if (v !== curV && c - 0.1 > freeAt) {
          var other = 1 - cur;
          shape(other, v, Math.max(freeAt + 0.005, c - 0.1));
          banks[cur].gate.gain.setValueAtTime(1, c - 0.04);
          banks[cur].gate.gain.linearRampToValueAtTime(0, c + 0.02);
          banks[other].gate.gain.setValueAtTime(0, c - 0.04);
          banks[other].gate.gain.linearRampToValueAtTime(1, c + 0.02);
          cur = other; curV = v; freeAt = c + 0.02;
        }
      }
    }
    var rel = opts.rel != null ? opts.rel : 0.28 + Y.rnd(0, 0.12);
    g.setValueAtTime(peak, Math.max(gT + 0.005, end - 0.02));
    g.linearRampToValueAtTime(0, end + rel);
    o.start(t0 - 0.03); o.stop(end + rel + 0.1);
    return end + rel - t;
  }

  // THE PERFORMANCE PLAN — every die of the singing, from the hymn's own
  // performance fork (hymn:<n>:<i> → performance).
  // DICE: every die here is thrown whether used or not — the ward's path
  // reads P but never P.vowels, and the draws must stay, or every Sunday
  // re-seeds
  function performancePlan(h, row, R, sectionDur) {
    var dox = row.section === "doxology", D = h.dialect;
    var kind = S.Meeting.activity() || "ordinary";
    var st = STRETCH[kind] || STRETCH.ordinary;
    var tempoDie = R.fork("tempo").next(), versesDie = R.fork("verses").next();
    var lead = R.fork("lead").rnd(2.5, 6), tail = R.fork("tail").rnd(5, 12);
    var beatS = h.beatS * (D === "oldway" ? 1 + 0.1 * tempoDie : st[0] + (st[1] - st[0]) * tempoDie);
    var lined = D === "oldway";
    var vl = Hy().verseLines(h), tl = Hy().timeline(h, vl, beatS);
    var verseLen = lined ? tl.lines.reduce(function (a, x) { return a + x.len * 1.42 + 0.85; }, 0) : tl.len;
    var gap = lined ? 0.5 : (D === "tabernacle" ? 1.1 : 1.0) * beatS;
    // (the organ plays where the dialect's own profile says it does — the
    // Tabernacle alone; gospel's says no organ)
    var Dp = KOLOB.Dialects && KOLOB.Dialects.get ? KOLOB.Dialects.get(D) : null;
    var organ = Dp && Dp.organ != null ? !!Dp.organ : D === "tabernacle";
    // (a round is sung unaccompanied, as rounds are — the chorister keys it
    // and the ward goes in group by group; its "verse"
    // is the whole canon: once through together, sometimes, then round)
    if (h.round) {
      organ = false;
      var segS = (h.round.delayBeats || 8) * beatS, k = h.lines.length;
      verseLen = (2.5 * k + Math.max(1, (h.round.entries || 2) - 1)) * segS;
    }
    var pivot = organ && row.key !== "home";
    var intro = organ ? (pivot ? 6 * beatS : 0) + Hy().partLine(h.lines[h.lines.length - 1], h.melodyPart, beatS, null).len + 0.9 * beatS : 0;
    var amen = h.amen ? Hy().partLine(h.amen, h.melodyPart, beatS, null).len + 0.3 * beatS : 0;
    // how many verses: two to four as the section has room (one for a
    // doxology, sometimes two); a long verse — a double meter lined out in
    // the Old Way runs to three minutes — is sung once, and no hymn runs on
    // past half again its section's planned length
    var range = h.round ? [2, 2] : dox ? [1, lined ? 1 : 2] : (D === "tabernacle" ? [2, 4] : D === "sacredharp" ? [2, 3] : [1, 2]);
    if (h.round) { /* (the canon's own: the plan says whether it is sung once through first) */ }
    else if (verseLen > 100) range = [1, 1];
    else if (verseLen > 55) range[1] = Math.min(range[1], 2);
    var room = sectionDur - lead - tail - intro - amen;
    var V = Math.round(room / (verseLen + gap) + versesDie - 0.5);
    while (V > range[0] && lead + intro + V * verseLen + (V - 1) * gap + amen > sectionDur * 1.5) V--;
    V = Math.max(range[0], Math.min(range[1], V));
    // the vowels of each verse (until the ward has words): a palette of its
    // own, one vowel a syllable. DICE: thrown for four verses, always
    var vowels = [];
    for (var v = 0; v < 4; v++) {
      var Rv = R.fork("vowels:" + v), per = [];
      for (k = 0; k < 160; k++) per.push(Rv.pickW(VERSE_VOWELS));
      vowels.push(per);
    }
    var fugDie = R.fork("fuging").next();
    return {
      beatS: beatS, tempoMul: +(h.beatS / beatS).toFixed(3), lined: lined, organ: organ, pivot: pivot, verses: V,
      lead: lead, tail: tail, gap: gap, verseLen: verseLen, intro: intro, amenLen: amen,
      vowels: vowels, voices: hymnVoices(h),
      // the fuging (the section's die: the planner's fugingPlanned) comes
      // after the middle verse; never in the Old Way, never in a doxology
      fugingAfter: !dox && !lined && !h.round && V >= 2 && S.Meeting.hands.fugingPlanned() ? (V === 4 ? (fugDie < 0.5 ? 1 : 2) : V === 3 ? 1 : 0) : -1,
      // a guest seated here comes after the middle verse (after the hymn
      // when there is only one)
      guestAfter: V >= 2 ? Math.ceil(V / 2) - 1 : -1,
      estimate: lead + intro + V * verseLen + (V - 1) * gap + amen,
    };
  }

  // THE PRACTICE of verse v (SCORE §5.1)
  function practiceOf(h, P, v) { return P.lined ? "lined" : (h.dialect === "sacredharp" && v === 0 ? "notes" : "sung"); }

  // One line, sung by the choir as its practice asks (and, in the
  // Tabernacle, doubled by the organ): the voices, the notes reported as
  // written, the line told with its Score. → the line's length (s)
  function singHymnLine(h, P, R, line, next, t0, v, li, practice, opts) {
    opts = opts || {};
    var K = S.F0 * S.ROOT_MULT, base = K * mzRatio(h.keyMonzo), bs = P.beatS;
    var doDeg = Cm().doOf(h.mode), hymnId = h.id, amen = !!opts.amen;
    var vowels = P.vowels[Math.min(v, P.vowels.length - 1)];
    var len = 0;
    P.voices.forEach(function (mv, k) {
      var pl = Hy().partLine(line, mv.part, bs, next);
      if (pl.len > len) len = pl.len;
      var lastV = "ah";
      var notes = pl.ev.map(function (e) {
        var vw;
        if (amen) vw = e.n.beat === 0 ? "ah" : "eh";
        else if (practice === "notes") vw = SHAPE_VOWEL[SHAPE[cls7(e.n.deg - doDeg)]];
        else if (e.n.syl != null) vw = vowels[e.n.syl % vowels.length];
        else vw = lastV;
        lastV = vw;
        return { at: e.at, dur: e.dur, f: base * mzRatio(e.n.monzo) * mv.oct, vowel: vw, syl: e.n.syl !== null, n: e.n };
      });
      // the Old Way's ornaments, at the composer's marks, by each singer's
      // own appetite (the performer's work, PLAN §3 F: heard, not written)
      if (P.lined) notes = ornament(h, notes, base * mv.oct, R.fork("ornament:" + v + ":" + li + ":" + mv.vi), P.appetite ? P.appetite[mv.vi] : 0.6);
      // a singer's own slack (sound-level): the Old Way's slow cloud spreads
      var slack = P.lined ? synth("choir").rnd(0, 0.25) * bs : (mv.part === h.melodyPart ? 0 : synth("choir").rnd(0.01, 0.06));
      // (a run is broken where a part rests)
      var run = [];
      function flush() { if (run.length) choirSingLine(t0 + slack, run, mv.vi, gainOf(h, mv, opts), { cover: P.lined ? 0.8 : h.dialect === "sacredharp" ? 0.25 : 0.5, panMul: P.lined ? 0.7 : 1 }); run = []; }
      notes.forEach(function (x, j) {
        var prev = notes[j - 1];
        if (prev && x.at > prev.at + prev.dur + 0.03) flush();
        run.push(x);
      });
      flush();
      // every note as written (a Score part's note; the octave it was sung in)
      pl.ev.forEach(function (e) {
        var n = e.n, x = { part: PART[mv.vi], sings: mv.part, hymnId: hymnId, verse: v, line: li, beat: n.beat, syl: n.syl, deg: n.deg, monzo: n.monzo.slice(), keyMonzo: h.keyMonzo.slice(), comma: n.comma || 0 };
        if (mv.oct !== 1) x.octave = mv.oct > 1 ? 1 : -1;
        if (amen) x.amen = true;
        emitNote("choir", base * mzRatio(n.monzo) * mv.oct, t0 + e.at, e.dur, x);
      });
    });
    // the organ under the parts (the Tabernacle; never under a lined verse)
    if (P.organ && !opts.noOrgan) organUnder(h, P, line, next, t0, opts.reg || "principal", opts.organGain || 1, { hymnId: hymnId, verse: v, line: li, amen: amen });
    // the line, told with its Score (SCORE §6: verse-line — a composed line,
    // as the composer wrote it, in the hymn's key)
    emitEvent({
      type: "verse-line", hymnId: hymnId, verse: v, line: li, speechLine: li + 1, practice: practice, composed: true, amen: amen,
      meter: h.meter, syllables: (line.notes[h.melodyPart] || []).filter(function (n) { return n.syl !== null; }).length,
      start: t0, beatS: bs, keyMonzo: h.keyMonzo.slice(), dialect: h.dialect, score: line,
    });
    return len;
  }
  function gainOf(h, mv, opts) {
    var tune = mv.part === h.melodyPart;
    var g = h.dialect === "sacredharp" ? (tune ? 1.0 : 0.88) : h.dialect === "oldway" ? 0.78 : (tune ? 0.92 : 0.74);
    return g * (opts.gain || 1);
  }
  // the organ doubles each part as written (the Tabernacle's hymn principal)
  function organUnder(h, P, line, next, t0, reg, gainMul, tag) {
    var base = S.F0 * S.ROOT_MULT * mzRatio(h.keyMonzo);
    ["S", "A", "T", "B"].forEach(function (p) {
      if (!line.notes[p] || !line.notes[p].length) return;
      var pl = Hy().partLine(line, p, P.beatS, next);
      var ns = pl.ev.map(function (e) {
        return { at: e.at, dur: e.dur, f: base * mzRatio(e.n.monzo), syl: e.n.syl !== null,
                 tag: { part: p, hymnId: tag.hymnId, verse: tag.verse, line: tag.line, beat: e.n.beat, deg: e.n.deg, monzo: e.n.monzo.slice(), keyMonzo: h.keyMonzo.slice(), givingOut: !!tag.givingOut, amen: !!tag.amen } };
      });
      organPartLine(t0, ns, gainMul * (p === "S" ? 1 : 0.85), { reg: reg, pedal: p === "B" });
    });
  }
  // the Old Way's decorations (hymn-lab's, per singer): a turn inside a long
  // marked note, a slide into a marked leap, a grace before a marked line
  function ornament(h, notes, base, R, appetite) {
    var out = [];
    notes.forEach(function (x) {
      var d1 = R.next(), d2 = R.next();
      var n = x.n;
      if (!n || !n.ornament || d1 > appetite) { out.push(x); return; }
      function nb(step) { return base * mzRatio(Cm().spelledMonzo(h.mode, n.deg + step, 0)); }
      function c(o) { var y = {}; for (var k in x) y[k] = x[k]; for (k in o) y[k] = o[k]; return y; }
      if (n.ornament === "turn" && x.dur > 0.9) {
        var q = Math.min(0.2, x.dur * 0.1);
        if (d2 < 0.6) out.push(c({ dur: x.dur - 4 * q }), c({ at: x.at + x.dur - 4 * q, f: nb(1), dur: q, syl: false }), c({ at: x.at + x.dur - 3 * q, dur: q, syl: false }), c({ at: x.at + x.dur - 2 * q, f: nb(-1), dur: q, syl: false }), c({ at: x.at + x.dur - q, dur: q, syl: false }));
        else out.push(c({ dur: x.dur * 0.6 }), c({ at: x.at + x.dur * 0.6, f: nb(1), dur: x.dur * 0.22, syl: false, slide: true }), c({ at: x.at + x.dur * 0.82, dur: x.dur * 0.18, syl: false }));
      } else if (n.ornament === "slide") out.push(c({ slide: true }));
      else if (n.ornament === "grace" && x.dur > 0.4) out.push(c({ f: nb(1), dur: 0.1 }), c({ at: x.at + 0.1, dur: x.dur - 0.1, syl: false }));
      else out.push(x);
    });
    return out;
  }

  // THE ORGAN BRINGS THE NEW KEY (§3.7): the day's own tonic chord — a
  // chord the two keys share (IV of the dominant's key, V of the
  // subdominant's) — then the new key's dominant seventh; the giving-out
  // follows in the new key. → its length
  function voiceChord(tones, K, prev) {
    // tones: monzos relative to the keynote, the root first; the bass takes
    // the root in the bass's register, the others each the tone nearest where
    // that voice last stood (or its register). → [{f, m}] bass up, each m
    // the tone's monzo moved by the octaves it was placed in
    function near(m, target) {
      var o = 0, f = K * mzRatio(m);
      while (f * Math.pow(2, o) > target * 1.41) o--;
      while (f * Math.pow(2, o) < target / 1.41) o++;
      return { f: f * Math.pow(2, o), m: mzAdd(m, [o, 0, 0, 0]) };
    }
    var out = [near(tones[0], K * REG[3])];
    var pool = tones.slice(1).concat(tones.length < 4 ? [tones[0]] : []), used = {};
    [2, 1, 0].forEach(function (vi, j) {
      var target = prev ? prev[j + 1].f : K * REG[vi], best = null, bi = -1;
      pool.forEach(function (m, i) {
        if (used[i]) return;
        var x = near(m, target);
        if (!best || Math.abs(Math.log(x.f / target)) < Math.abs(Math.log(best.f / target))) { best = x; bi = i; }
      });
      used[bi] = true;
      out.push(best);
    });
    // (a voice never crosses the one below it)
    for (var i = 2; i < 4; i++) while (out[i].f <= out[i - 1].f) { out[i] = { f: out[i].f * 2, m: mzAdd(out[i].m, [1, 0, 0, 0]) }; }
    return out;
  }
  function organModulates(h, P, t0) {
    var K = S.F0 * S.ROOT_MULT, bs = P.beatS;
    var home = [0, 2, 4].map(function (d) { return Cm().spelledMonzo(S.mode, d, 0); });
    var root = mzAdd(h.keyMonzo, [-1, 1, 0, 0]);                          // the new key's dominant
    var dom7 = [root, mzAdd(root, [-2, 0, 1, 0]), mzAdd(root, [-1, 1, 0, 0]), mzAdd(root, [4, -2, 0, 0])];
    var c1 = voiceChord(home, K, null), c2 = voiceChord(dom7, K, c1);
    var d1 = 2.5 * bs, d2 = 2.5 * bs;
    ["B", "T", "A", "S"].forEach(function (p, j) {
      function tag(x) { return { part: p, hymnId: h.id, modulation: true, monzo: x.m, keyMonzo: [0, 0, 0, 0] }; }
      organPartLine(t0, [{ at: 0, dur: d1 - 0.05, f: c1[j].f, syl: true, tag: tag(c1[j]) }, { at: d1, dur: d2 - 0.1, f: c2[j].f, syl: true, tag: tag(c2[j]) }],
                    1.3 * (p === "S" ? 1 : 0.85), { reg: "principal", pedal: p === "B" });
    });
    return d1 + d2 + 1.0 * bs;
  }

  // THE ORGANIST'S HANDS ON A HYMN: the Sunday's organist
  // (S.Meeting.organist — kolob-organist.js's seat), writing the hymn in
  // pieces (hymnHands) on the hymn's own stream (hymn:<n>:<i> →
  // organist:<style>), at the chorister's beat — or null: an unaccompanied
  // hymn, the house organ asked for (?organ=house), no organist or no pipes
  // on the page, or a fuge sung twice (the ward's order of lines, which the
  // organist's writer does not keep: the house organ plays that one)
  function organistAt(h, row, P, plan) {
    if (!P.organ || !S.pipeOn || !S.pipeOn() || !S.organistPlays) return null;
    var O = KOLOB.Organist, who = S.Meeting.organist ? S.Meeting.organist() : null;
    if (!O || !O.hymnHands || !who) return null;
    if (h.fuge && h.fuge.repeatFrom != null) return null;
    // (the stops lean by the light of the hymn's rite and the Sunday —
    // kolob-calendar.js regLean; 0 without the calendar)
    var CAL = KOLOB.Calendar, day = S.Meeting.day ? S.Meeting.day() : null;
    var reg = CAL && row.light != null ? CAL.regLean(row.light, day ? day.id : null) : 0;
    return O.hymnHands(who, h, S.hymnStream(S.Meeting.meetingNum(), row.i),
                       { verses: plan.verses.length, beatS: P.beatS / (plan.tempoMul || 1), hymnIndex: row.i - 1, accompanied: true, reg: reg });
  }
  // …and the walk into a keyed hymn's key: from the day's own tonic chord
  // (where the joint's amen left the organ) to the new key, through a chord
  // the two keys share — its common tone held — the new key's V7, and I
  // (the Victorian leans a 4–3 on the dominant; the improviser now and then
  // detours by a chromatic mediant), at the hymn's own level (org.liftDb:
  // the style's, as the organist's hands carry it). → its length
  function organistModulates(h, row, P, plan, t0, who, org) {
    var mp = KOLOB.Organist.modulate(who, { keyMonzo: [0, 0, 0, 0], mode: S.mode }, { keyMonzo: h.keyMonzo, mode: h.mode },
                                     S.hymnStream(S.Meeting.meetingNum(), row.i), { beatS: P.beatS / (plan.tempoMul || 1) });
    if (!mp.phrases.length) return 0;
    mp.liftDb = org && org.liftDb || 0;
    S.organistPlays(mp, t0, { hymnId: h.id, key: null, modulation: true, style: who.style, alive: function () { return S.Meeting.hands.owns(h.id); } });
    var end = 0; mp.sections.forEach(function (s) { end = Math.max(end, s.end); });
    return end;
  }

  // THE FUGING, ON THE HYMN'S OWN HEAD (PLAN §3.B): the voices go out one by
  // one — the bass first, then each above it, at the fifth and the octave by
  // turns, a diatonic answer — on the first notes of the hymn's first line,
  // and gather into the dialect's own close: the Tabernacle's amen (IV–I),
  // the Sacred Harp's bare fifth (V–I, no third). → its length
  function hymnFuging(tc, h, P, R) {
    var t = tc + 0.3, K = S.F0 * S.ROOT_MULT, base = K * mzRatio(h.keyMonzo), bs = P.beatS;
    var mel = (h.lines[0].notes[h.melodyPart] || []).filter(function (n) { return n.syl !== null; });
    var head = mel.slice(0, Math.min(mel.length, R.rint(4, 6)));
    if (head.length < 3) return 0;
    var stagger = R.rnd(2.4, 3.2);
    var order = P.voices.slice().sort(function (a, b) { return b.vi - a.vi; });          // bass up
    var entries = Math.min(4, order.length, R.rint(2, order.length + 1));
    var lastEnd = t, lastF = {};
    var headBeats = head.map(function (n) { return Math.max(0.5, Math.min(2, n.beats)); });
    for (var e = 0; e < entries; e++) {
      var mv = order[e], shift = e % 2 === 1 ? 4 : 0;
      var fs = head.map(function (n) { return base * mzRatio(Cm().spelledMonzo(h.mode, n.deg + shift, 0)); });
      // the head in this voice's register
      var mean = Math.exp(fs.reduce(function (a, f) { return a + Math.log(f); }, 0) / fs.length), target = K * REG[mv.vi];
      var o = 1; while (mean * o > target * 1.41) o /= 2; while (mean * o < target / 1.41) o *= 2;
      var at = t + e * stagger, x = 0;
      var notes = fs.map(function (f, j) { var nt = { at: x, dur: headBeats[j] * bs, f: f * o, vowel: "ah", syl: true }; x += headBeats[j] * bs; return nt; });
      choirSingLine(at, notes, mv.vi, 0.85);
      notes.forEach(function (nt, j) {
        emitNote("choir", nt.f, at + nt.at, nt.dur, { part: PART[mv.vi], sings: mv.part, hymnId: h.id, fuging: true, deg: head[j].deg + shift, monzo: mzAdd(Cm().spelledMonzo(h.mode, head[j].deg + shift, 0), [Math.round(Math.log2(o)), 0, 0, 0]), keyMonzo: h.keyMonzo.slice() });
      });
      lastF[mv.vi] = notes[notes.length - 1].f;
      if (at + x > lastEnd) lastEnd = at + x;
    }
    // the convergence: every voice together, the dialect's own close
    var sh = h.dialect === "sacredharp";
    var kind = sh ? "openfifth" : "plagal";
    var chords = sh ? [[4, 8], [0, 4]] : [[3, 5, 7], [0, 2, 4]];
    var cadAt = lastEnd + R.rnd(0.5, 1.2), cd = R.rnd(2.2, 3.0) * Math.max(0.8, bs / 0.8);
    var prevF = {};
    P.voices.forEach(function (mv) { prevF[mv.vi] = lastF[mv.vi] || K * REG[mv.vi]; });
    chords.forEach(function (degs, ci) {
      var at = cadAt + ci * cd, dur = cd * (ci ? 1.6 : 1.02);
      P.voices.forEach(function (mv) {
        // the bass on the root; the others on the chord tone nearest them
        var cands = mv.vi === 3 ? [degs[0]] : degs;
        var best = null, bd = null;
        cands.forEach(function (d) {
          [-14, -7, 0, 7, 14].forEach(function (oc) {
            var f = base * mzRatio(Cm().spelledMonzo(h.mode, d + oc, 0));
            var dist = Math.abs(Math.log(f / (mv.vi === 3 ? K * REG[3] : prevF[mv.vi])));
            if (mv.vi !== 3 && Math.abs(Math.log(f / (K * REG[mv.vi]))) > 0.6) return;
            if (bd == null || dist < bd) { bd = dist; best = { f: f, d: d + oc }; }
          });
        });
        if (!best) return;
        choirSingLine(at, [{ at: 0, dur: dur, f: best.f, vowel: ci ? "eh" : "ah", syl: true }], mv.vi, 0.9, { atk: 0.25, rel: 0.6 });
        emitNote("choir", best.f, at, dur, { part: PART[mv.vi], sings: mv.part, hymnId: h.id, fuging: true, deg: best.d, monzo: Cm().spelledMonzo(h.mode, best.d, 0), keyMonzo: h.keyMonzo.slice() });
        prevF[mv.vi] = best.f;
      });
    });
    emitEvent({ type: "cadence", kind: kind, by: "fuging", at: cadAt + cd, hymnId: h.id,
                cat: "harmony", label: "∴ " + kind + " cadence", detail: "the fuging gathers" });
    var total = cadAt + cd * 2.6 - tc;
    emitEvent({ type: "fuging", entries: entries, stagger: stagger, hymnId: h.id, head: head.map(function (n) { return n.deg; }),
                cat: "fuging", label: "⁂ fuging entry ×" + entries, detail: "stagger " + stagger.toFixed(1) + "s · on the hymn's head · " + h.nameEn });
    return total;
  }

  // THE LINED LINE (the Old Way): the deacon's clarinet gives the line,
  // quick and plain, and the ward answers it at the hymn's slow pace.
  // → the length of the pair
  function linedLine(h, P, R, line, next, tp, v, li) {
    var bs = P.beatS, base = S.F0 * S.ROOT_MULT * mzRatio(h.keyMonzo);
    var pre = Hy().partLine(line, h.melodyPart, bs * 0.42, next);
    var cn = pre.ev.map(function (e) { return { f: base * mzRatio(e.n.monzo), dur: Math.max(0.18, e.dur) }; });
    if (cn.length && S.renderClarinetLine) S.renderClarinetLine(tp, cn, 0.85, R.fork("precentor:" + v + ":" + li));
    emitEvent({ type: "lining-out", meter: h.meter, syllables: cn.length, hymnId: h.id, verse: v, line: li, composed: true,
                cat: "verse", label: "☞ the deacon lines out", detail: h.meter + " · line " + (li + 1) + " · " + h.nameEn });
    var tw = tp + pre.len + 0.35;
    var len = singHymnLine(h, P, R, line, next, tw, v, li, "lined", { noOrgan: true, gain: 0.95 });
    return (tw - tp) + len + 0.5;
  }

  // singHymn(h, row, t, pre): the section at t hands its hymn to the ward
  // (THE WARD SINGS THE HYMN, below) — or, as the A/B and the fallback, to
  // the house's four formant voices (singHymnHouse).
  // → { end (the last chord's end, as far as it can be told now), tail }
  function singHymn(h, row, tc, pre) {
    if (wardOn() && KOLOB.Cast.segment) return singHymnWard(h, row, tc, pre);
    return singHymnHouse(h, row, tc);
  }
  function singHymnHouse(h, row, tc) {
    if (!S.playing || !h || !Hy() || !Cm()) return null;
    var hands = S.Meeting.hands, id = h.id;
    var R = S.hymnStream(S.Meeting.meetingNum(), row.i).fork("performance");
    var P = performancePlan(h, row, R, S.Meeting.sectionDur());
    // DICE: each singer's appetite for ornament (the Old Way; four, always drawn)
    var Ra = R.fork("appetite");
    P.appetite = [Ra.rnd(0.3, 1), Ra.rnd(0.3, 1), Ra.rnd(0.3, 1), Ra.rnd(0.3, 1)];
    var vl = Hy().verseLines(h);
    var start = tc + P.lead;
    var dox = row.section === "doxology";
    var cumulative = dox && S.Meeting.cumulative() && !S.Meeting.assemblyFired();
    // the house lets go as the hymn begins (its held notes: the organist's
    // free chord, the strings' pad) — the release done as the first note
    // sounds, so the joint's amen keeps its own ending — and the hall
    // listens until it is done
    if (S.houseLetsGo) S.houseLetsGo(Math.max(tc, start - 1.5), "hymn", true);
    // a hymn keyed away from home: the drone (the day's keynote) steps back
    // while it is sung, and comes home with the hymn's end
    var keyed = row.key !== "home";
    if (keyed && S.droneDuck) {
      S.droneDuck.gain.cancelScheduledValues(start);
      S.droneDuck.gain.setValueAtTime(1, start);
      S.droneDuck.gain.linearRampToValueAtTime(0.22, start + 3);
    }
    claimAir(P.estimate + 2, 1);
    var t = start;
    // the Tabernacle: the modulation, then the organ gives out the tune
    if (P.organ) {
      if (P.pivot) t += organModulates(h, P, t);
      var last = h.lines[h.lines.length - 1];
      var goLen = Hy().partLine(last, h.melodyPart, P.beatS, null).len;
      var goAt = t;
      cueAt("choir", Math.max(tc, goAt - AHEAD_S), function () {
        if (!hands.owns(id)) return;
        organUnder(h, P, last, null, goAt, "principal", 1.7, { hymnId: id, verse: -1, line: h.lines.length - 1, givingOut: true });
      });
      t += goLen + 0.9 * P.beatS;
    }
    hands.until(id, t);
    cueAt("choir", Math.max(tc, t - AHEAD_S), function () { verse(0, t); });
    return { end: tc + P.estimate, tail: P.tail, verses: P.verses, plan: P };

    function verse(v, tv) {
      if (!S.playing || !hands.owns(id)) return;
      var practice = practiceOf(h, P, v);
      var tl = Hy().timeline(h, vl, P.beatS);
      // the whole tune at last: a composed doxology on a withheld Sunday is
      // the assembly (its first verse; the deacon doubles the tune above)
      var assembly = cumulative && v === 0;
      // (told just before the verse's first line is handed to the voices:
      // the lines are told as they are handed on, ahead of their sound)
      cueAt("choir", Math.max(S.now(), tv - AHEAD_S - 0.01), function () {
        if (!hands.owns(id)) return;
        emitEvent({ type: "verse-start", hymnId: id, verse: v, practice: practice, composed: true,
                    performance: { hymnId: id, verse: v, practice: practice, tempoMul: P.tempoMul, rubato: 0, organ: P.organ ? { registration: [v === P.verses - 1 && P.verses >= 3 ? "full" : "principal"] } : null, singers: P.voices.map(function (mv) { return "choir:" + PART[mv.vi]; }), beatS: +P.beatS.toFixed(3) } });
      });
      var ends = tv, reg = v === P.verses - 1 && P.verses >= 3 ? "full" : "principal";
      if (P.lined) {
        // the line pairs follow one another: each is handed on when the one
        // before it is placed (its length is known once it is laid out)
        var tl0 = tv;
        vl.forEach(function (line, li) {
          var pre = Hy().partLine(line, h.melodyPart, P.beatS * 0.42, vl[li + 1]).len, rep = Hy().partLine(line, h.melodyPart, P.beatS, vl[li + 1]).len;
          var at = tl0;
          cueAt("choir", Math.max(S.now(), at - AHEAD_S), function () { if (hands.owns(id)) linedLine(h, P, R, line, vl[li + 1], at, v, li); });
          tl0 += pre + 0.35 + rep + 0.5;
        });
        ends = tl0;
      } else {
        tl.lines.forEach(function (x, li) {
          var at = tv + x.at;
          cueAt("choir", Math.max(S.now(), at - AHEAD_S), function () {
            if (!hands.owns(id)) return;
            singHymnLine(h, P, R, x.line, vl[li + 1], at, v, li, practice, { reg: reg });
            if (assembly && S.renderClarinetLine) {
              var base = S.F0 * S.ROOT_MULT * mzRatio(h.keyMonzo);
              var pl = Hy().partLine(x.line, h.melodyPart, P.beatS, vl[li + 1]);
              var cn = pl.ev.map(function (e) { return { f: base * mzRatio(e.n.monzo) * (h.melodyPart === "T" ? 4 : 2), dur: Math.max(0.2, e.dur) }; });
              if (cn.length) S.renderClarinetLine(at + 0.05, cn, 0.7, R.fork("assembly:" + li));
            }
          });
        });
        ends = tv + tl.len;
      }
      if (assembly) {
        cueAt("conductor", tv, function () {
          if (!hands.owns(id)) return;
          if (hands.assemblyBegins(tv, ends - tv + 1)) {
            var th = KOLOB.Melody.Motif.theme();
            emitEvent({ type: "guest", guest: "assembly", stage: "whole-tune", logged: true, theme: th ? th.name : null, hymnId: id, dur: ends - tv,
                        cat: "visitation", label: "✶ the whole tune, at last", detail: (th ? th.name + " · " : "") + h.nameEn });
            emitEvent({ type: "payoff", kind: "assembly", section: S.Meeting.section(), hymnId: id });
          }
        });
      }
      hands.until(id, ends);
      claimAir(ends - S.now(), 1);
      cueAt("choir", ends, function (te) { afterVerse(v, te); });
    }
    function closeOf(v, te) {
      var lastLine = vl[vl.length - 1], kind = lastLine.cadence ? lastLine.cadence.kind : "none";
      if (kind && kind !== "none" && kind !== "half") {
        emitEvent({ type: "cadence", kind: kind, by: "hymn", at: te, hymnId: id, verse: v,
                    cat: "harmony", label: "∴ " + kind + " cadence", detail: "verse " + (v + 1) + " · " + h.nameEn });
      }
    }
    function afterVerse(v, te) {
      if (!S.playing || !hands.owns(id)) return;
      closeOf(v, te);
      var steps = [];
      if (v === P.fugingAfter) steps.push("fuging");
      if (v === P.guestAfter && hands.guestWaiting()) steps.push("guest");
      if (v < P.verses - 1) steps.push("verse"); else steps.push("end");
      run(0, te);
      function run(k, t) {
        var step = steps[k];
        if (step === "fuging") {
          var at = t + 0.6 * P.beatS;
          cueAt("choir", at, function (tf) {
            if (!hands.owns(id)) return;
            var fd = hymnFuging(tf, h, P, R.fork("fuging:" + v));
            if (fd > 0) { S.Meeting.hands.fuging(tf, fd); hands.until(id, tf + fd); claimAir(fd, 1); }
            run(k + 1, tf + fd + 1.2 * P.beatS);
          });
        } else if (step === "guest") {
          var ag = t + 1.5;
          cueAt("conductor", ag, function (tg) {
            if (!hands.owns(id)) return;
            var span = hands.guestInGap(tg);
            if (span > 0) hands.until(id, tg + span);
            run(k + 1, tg + span + (span > 0 ? 2.5 : 0));
          });
        } else if (step === "verse") {
          var nv = t + P.gap;
          hands.until(id, nv);
          cueAt("choir", Math.max(S.now(), nv - AHEAD_S), function () { verse(v + 1, nv); });
        } else finish(t);
      }
    }
    function finish(tf) {
      var endAt = tf;
      if (h.amen) {
        var ta = tf + 0.3 * P.beatS;
        var alen = Hy().partLine(h.amen, h.melodyPart, P.beatS, null).len;
        cueAt("choir", Math.max(S.now(), ta - AHEAD_S), function () {
          if (!hands.owns(id)) return;
          singHymnLine(h, P, R, h.amen, null, ta, P.verses - 1, vl.length, "sung", { amen: true, reg: P.verses >= 3 ? "full" : "principal" });
        });
        cueAt("choir", ta + alen, function (tc2) {
          emitEvent({ type: "cadence", kind: "plagal", by: "hymn", at: tc2, hymnId: id, amen: true,
                      cat: "harmony", label: "∴ plagal cadence", detail: "A-men · " + h.nameEn });
        });
        endAt = ta + alen + 0.6;
      }
      var after = function (te2) {
        if (keyed && S.droneDuck) {
          S.droneDuck.gain.cancelScheduledValues(te2);
          S.droneDuck.gain.setValueAtTime(0.22, te2);
          S.droneDuck.gain.linearRampToValueAtTime(1, te2 + 6);
        }
        hands.done(id, te2);
      };
      // a guest still waiting (a one-verse doxology) comes when the hymn is done
      if (P.guestAfter < 0 && hands.guestWaiting()) {
        cueAt("conductor", endAt + 1.5, function (tg) {
          if (!hands.owns(id)) return;
          var span = hands.guestInGap(tg);
          after(tg + Math.max(0, span));
        });
        hands.until(id, endAt + 1.5);
      } else {
        hands.until(id, endAt);
        cueAt("choir", endAt, function (te2) { if (hands.owns(id)) after(te2); });
      }
    }
  }

  // ==========================================================================
  // THE WARD (PLAN-COMPOSITION §5) — the Sunday's thirty-two, eight to a
  // part, each a person with a throat of
  // their own (kolob-voices-vocal.js), and among them the eight to twelve
  // people you come to know (kolob-cast.js): the chorister who keys the
  // hymns, the precentor who lines out the Old Way, the soloist and her
  // descant, the old bass, the harmony alto, the enthusiast, the child, the
  // newcomer. They are the meeting's one congregation: the hymns are theirs,
  // and so is everything the house's choir sings around them — the hum of
  // the gathering, the answers to the deacon, the amens — a section of the
  // ward for each of the house voices (choirVoiceLine, above).
  //
  // THE OWNER'S RULING (2026-09-28): the full ward, as though there were no
  // phone to carry it; the cost is measured and reported, and the owner
  // scales back by ear. So nothing here is thinned for a device.
  //
  // THE DESK. A ward's line is thirty-two graphs; built all at once in a
  // clock callback it is a long task. So every piece the ward sings — a
  // hymn's intro, each verse, the amen, a fuging, the hum, a section's line
  // — is laid out as a cue sheet (pure, on the meeting's dice) and put on the
  // desk at its start on the audio clock, and the ward's own pump (a cue on
  // the "ward" lane every WARD_PUMP_S of the music's time) hands the lines
  // to the voices WARD_REACH_S ahead, at most WARD_MAX a call unless they
  // are due inside WARD_URGENT_S, and joins each to the room only
  // WARD_ARM_S before it sounds (the voices' ARMING: a built line not yet
  // joined costs the audio thread nothing). The pump reads the music's now
  // (the cue's scheduled time), never the audio clock: the same seed hands
  // the same lines at the same moments, however late the timers run.
  //
  // THE SWITCH. ?choir=house (dev) sings everything with the house's four
  // formant voices — the owner's A/B, and the fallback when the cast is not
  // loaded (a lab without it).
  // ==========================================================================
  var WARD_PUMP_S = 0.12, WARD_REACH_S = 3.0, WARD_ARM_S = 0.6, WARD_URGENT_S = 1.2, WARD_MAX = 12;
  var PREP_S = 4.5;                                      // a piece is written and put on the desk this long before it sounds
  // a section of eight standing in for one house voice (choirVoiceLine):
  // its level against the house voice it replaces (measured; the ward's own
  // level in the mix is the core's WARD_LEVEL)
  var HOUSE_SECTION_GAIN = 0.68;
  function VV() { return KOLOB.VoicesVocal; }
  function Cs() { return KOLOB.Cast; }
  function wardOn() { return !S.houseChoir && !!(Cs() && VV() && S.ctx && S.wardBuses); }
  var desks = [];                                        // [{ward, perf}] — the meetings' performers (the last is the sitting one)
  var ticking = false, auditionWard = null;
  // the ward sitting now: the meeting's (seated with its plan, cast:<n>); a
  // press of the rail with no meeting called seats a ward of its own
  function theWard() {
    var W = S.Meeting && S.Meeting.ward ? S.Meeting.ward() : null;
    if (W) return W;
    return auditionWard || (auditionWard = Cs().seat(S.castStream(0)));
  }
  function deskOf(W) {
    for (var i = desks.length - 1; i >= 0; i--) if (desks[i].ward === W) return desks[i];
    var n = S.Meeting ? S.Meeting.meetingNum() : 0;
    var d = { ward: W, perf: Cs().performer(W, { V: VV(), synth: S.synth("vocal").fork("meeting:" + n), organ: wardOrgan }) };
    desks.push(d);
    if (desks.length > 4) desks.shift();
    return d;
  }
  // a piece of the ward's singing, on the desk from t0 (the pump is woken;
  // a piece that begins inside WARD_URGENT_S — a section's line of the
  // choir's turn, written a moment before it sounds — is handed at once)
  function onDesk(W, t0, sheet) {
    deskOf(W).perf.enqueue(t0, sheet);
    if (t0 - S.now() < WARD_URGENT_S) pump(S.now());
    if (!ticking) { ticking = true; cueAt("ward", Math.max(S.now(), Math.min(t0, S.now() + WARD_PUMP_S)), wardTick); }
  }
  // THE PUMP, at the music's now t: every desk's lines due within reach
  // (a piece whose hymn no longer owns its section — a dev jump — is let go
  // by the performer). → whether any line is still to hand
  function pump(t) {
    var b = S.wardBuses(), busy = false;
    for (var i = 0; i < desks.length; i++) {
      var p = desks[i].perf;
      p.tick(S.ctx, b, t + WARD_REACH_S, { max: WARD_MAX, urgent: t + WARD_URGENT_S, arm: t + WARD_ARM_S, now: t });
      if (p.pending()) busy = true;
    }
    return busy;
  }
  // …and its cue, every WARD_PUMP_S of the music's time while there is work
  function wardTick(t) {
    ticking = false;
    if (!S.playing || !S.ctx) return;
    var busy = pump(t);
    // (and on while a line still waits to be joined or parted)
    if (busy || VV().pending(S.ctx) || VV().parting(S.ctx)) { ticking = true; cueAt("ward", t + WARD_PUMP_S, wardTick); }
  }
  // STOP: nothing more of this meeting is handed or joined
  function wardStop() {
    desks.forEach(function (d) { d.perf.clear(); });
    desks = []; ticking = false;
    if (S.ctx && VV() && VV().forget) VV().forget(S.ctx);
  }
  function wardStats() {
    var out = { desks: desks.length, handed: 0, tight: 0, late: 0, tightest: null, most: 0, pending: 0, joined: S.ctx && VV() ? VV().joined(S.ctx) : 0 };
    desks.forEach(function (d) {
      var s = d.perf.stats();
      out.handed += s.handed; out.tight += s.tight; out.late += s.late; out.most = Math.max(out.most, s.most); out.pending += s.pieces;
      if (s.tightest != null && (out.tightest == null || s.tightest < out.tightest)) out.tightest = s.tightest;
    });
    return out;
  }
  // the organ's lines on a ward's sheet (the giving-out, under the verses,
  // under the A-men): the house organ plays each part legato
  // (organPartLine), on the chorister's clock
  function wardOrgan(t0, o, sheet) {
    if (sheet.hymnId && !S.Meeting.hands.owns(sheet.hymnId)) return;
    var h = sheet.hymn, base = S.F0 * S.ROOT_MULT * mzRatio(h.keyMonzo);
    var reg = /full/.test(o.registration || "") ? "full" : "principal", gain = o.giveOut ? 1.7 : 1;
    ["S", "A", "T", "B"].forEach(function (p) {
      var ns = o.notes.filter(function (n) { return n.part === p; }).map(function (n) {
        return { at: n.at, dur: n.dur, f: base * mzRatio(n.monzo), syl: n.syl,
                 tag: { part: p, hymnId: h.id, verse: o.verse, line: o.line, beat: n.beat, deg: n.deg, monzo: n.monzo.slice(), keyMonzo: h.keyMonzo.slice(), givingOut: !!o.giveOut, amen: !!o.amen } };
      });
      if (ns.length) organPartLine(t0, ns, gain * (p === "S" ? 1 : 0.85), { reg: reg, pedal: p === "B" });
    });
  }

  // A SECTION OF THE WARD SINGS A LINE (the house's primitive, choirVoiceLine:
  // the hum of the gathering, the answers to the deacon, the fuging on the
  // day's theme, the amens) — its eight people each sing it, in their own
  // voices; the notes as given ({f, dur}), on "ah", or "mm" for the hum.
  // → the line's length (s), as the house voice returned it
  function wardSectionLine(t, notes, vi, gainMul, vowel) {
    var W = theWard(), part = PART[vi], total = 0, cues = [];
    notes.forEach(function (n) { total += n.dur; });
    var sung = notes.map(function (n) { return { f: n.f, dur: n.dur, vowel: vowel === "hum" ? "hum" : "ah", stress: 1 }; });
    W.members.forEach(function (m) {
      if (m.k == null || m.part !== part) return;
      cues.push({ at: 0, memberId: m.id, bus: "hall", pan: m.pew.x, gain: +(Cs().WARD_GAIN * (gainMul || 1) * HOUSE_SECTION_GAIN).toFixed(4), notes: sung, breathBefore: 0.3, what: vowel === "hum" ? "hum" : "house", verse: -1, line: -1 });
    });
    // (a press of the rail with no meeting playing has no pump: the section
    // sings at once, joined as it is handed)
    if (!S.playing) {
      var perf = deskOf(W).perf, b = S.wardBuses();
      cues.forEach(function (c) { perf.voiceOf(c.memberId).sing(S.ctx, b.hall, t + c.at, c.notes, c.gain, { breathBefore: c.breathBefore, pan: c.pan }); });
      return total;
    }
    onDesk(W, t, { cues: cues, organ: [], hymnId: null });
    return total;
  }

  // ==========================================================================
  // THE WARD SINGS THE HYMN — the composed hymn, verse by verse,
  // by the thirty-two and the people among them, in the practice the plan
  // gives each verse (kolob-cast.js planHymn):
  //
  //   the Tabernacle   the organ modulates (a keyed hymn) and gives out the
  //                    tune; the chorister now and then hums the first note
  //                    under its last chord; the verses in four parts with
  //                    the organ under them — a middle verse now and then
  //                    hummed, or in unison — and the last of three or four
  //                    with the soloist's descant (or, now and then, her
  //                    treble verse alone over the organ); the plagal A-men
  //   the Sacred Harp  the pitching (the keyer's tonic, each section's first
  //   and the psalmody note on top of it: a chord of thirty-two, building);
  //                    the hollow square; verse 1 on the notes (the Sacred
  //                    Harp's), the tenors and the trebles doubled in
  //                    octaves; the fuging tune sings its fuge twice
  //   the Old Way      the chorister hums the key; the precentor lines out
  //                    each line, ornamented, and the ward answers slowly,
  //                    everyone on the tune (the men an octave down), each
  //                    their own way at the places the composer marked
  //   gospel           the chorister keys it; the quartet in the ward (the
  //                    lead with the altos, the tenor harmony over it, the
  //                    baritone and the bass), the men's echo, the refrain
  //                    after every verse and the tag at the end
  //   the Shakers      keyed; one tune in unison, a little ragged, and now
  //                    and then a few men humming a drone under it; a gift
  //                    song on its wordless syllables
  //
  // One or two people come forward on a line, never more (the plan's rule),
  // each told as they do it (a `cast` event, in Deseret), and named on the
  // hymn's announcement. Between verses: the breath, and the section's
  // fuging on the hymn's head — the ward's sections going out one by one —
  // or a guest seated in the section. Everything musical is
  // drawn on the hymn's performance fork (hymn:<n>:<i> → performance) and
  // the ward's (cast:<n>); every sound-level die on synth:vocal.
  //
  // The meeting asks for the plan before it announces the hymn
  // (S.hymnPlan), so the board can name the chorister and who will come
  // forward; then hands the hymn over (singHymn → singHymnWard).
  // ==========================================================================
  function hymnPlan(h, row) {
    if (!wardOn() || !h || !Hy() || !Cm() || !KOLOB.Cast.segment) return null;
    var W = theWard(), R = S.hymnStream(S.Meeting.meetingNum(), row.i).fork("performance");
    var P = performancePlan(h, row, R, S.Meeting.sectionDur());
    var plan = Cs().planHymn(W, h, R, { verses: P.verses, organ: P.organ, first: row.i === 1 });
    var ch = W.byId[plan.chorister] || W.members[0];
    var fwd = [];
    plan.verses.forEach(function (Pv, v) {
      (Pv.forward || []).forEach(function (f) {
        var m = W.byId[f.memberId];
        if (m) fwd.push({ memberId: m.id, nameDs: m.nameDs, role: f.role, verse: v, action: f.action, actionDs: Cs().ACTION_DS[f.action] || null });
      });
    });
    var keyer = plan.keying ? W.byId[plan.keying.by] : null;
    return {
      P: P, plan: plan, R: R, ward: W, leaderDs: ch.nameDs,
      announce: { chorister: ch.id, keying: plan.keying ? { kind: plan.keying.kind, habit: plan.keying.habit, under: !!plan.keying.under, by: plan.keying.by, byDs: keyer ? keyer.nameDs : null } : null,
                  practices: plan.verses.map(function (Pv) { return Pv.practice; }), forward: fwd, layout: plan.layout },
    };
  }
  function singHymnWard(h, row, tc, pre) {
    if (!S.playing || !h || !Hy() || !Cm()) return null;
    pre = pre || hymnPlan(h, row);
    if (!pre) return singHymnHouse(h, row, tc);
    var hands = S.Meeting.hands, id = h.id, W = pre.ward, plan = pre.plan, P = pre.P, R = pre.R;
    var K = S.F0 * S.ROOT_MULT, vl = Hy().verseLines(h);
    var carry = { lastEnd: {} };
    var start = tc + P.lead;
    var dox = row.section === "doxology";
    var cumulative = dox && S.Meeting.cumulative() && !S.Meeting.assemblyFired();
    var pre0 = (KOLOB.Cast.who(W, "precentor") || W.members[0]);
    // the house lets go as the hymn begins, and listens while it is sung
    if (S.houseLetsGo) S.houseLetsGo(Math.max(tc, start - 1.5), "hymn", true);
    // a hymn keyed away from home: the drone steps back while it is sung —
    // and (the reckoning) so it does under a hymn at home
    // while the drone stands on the key's third or fifth, not its tonic: the
    // cantus note keeps sounding, softly, under the hymn's own harmony
    var dn = S.droneNote ? S.droneNote() : null;
    var keyed = row.key !== "home" || !!(dn && (dn.role === "third" || dn.role === "fifth"));
    if (keyed && S.droneDuck) {
      S.droneDuck.gain.cancelScheduledValues(start);
      S.droneDuck.gain.setValueAtTime(1, start);
      S.droneDuck.gain.linearRampToValueAtTime(0.22, start + 3);
    }
    claimAir(P.estimate + 2, 1);
    var t = start;
    // THE ORGANIST AT THE HYMN: in an accompanied hymn the Sunday's
    // organist plays the organ's part on the pipes — the walk
    // into a keyed hymn's key by a common tone, the giving-out in their own
    // manner, the Score's four parts under every verse on the chorister's
    // clock (the same arithmetic as the ward's, note for note), a fill
    // between two lines now and then (the ward waits for it), an interlude
    // between the verses, the amen. Without the pipes or the organist (the
    // A/B, ?organ=house; a lab without them), the house organ's part lines
    // (wardOrgan, on the sheet).
    var org = organistAt(h, row, P, plan), who = org ? S.Meeting.organist() : null, V = plan.verses.length;
    // (THE FAR WARD — another congregation across the valley may sing this
    // hymn with us, a line behind, verse by verse; the meeting
    // makes it ready and the desk tells it each verse as it writes it)
    var far = S.farWardFor ? S.farWardFor(h, V) : null;
    function tagFor(extra) {
      var o = { hymnId: id, key: h.keyMonzo, style: who ? who.style : null, alive: function () { return hands.owns(id); } };
      for (var k in extra) o[k] = extra[k];
      return o;
    }
    // the modulation, then the intro: the organ's giving-out, the keying or
    // the pitching
    if (P.organ && P.pivot) t += org ? organistModulates(h, row, P, plan, t, who, org) : organModulates(h, P, t);
    var gp = org ? org.giveOut(0) : null;
    if (gp) S.organistPlays(gp, t, tagFor({ givingOut: true, verse: -1 }));
    var intro = piece("intro", t, gp ? { giveOut: gp.next } : null);
    t += intro.end;
    hands.until(id, t);
    var beatS = intro.beatS;
    // the first verse is written as soon as its start is known (the pieces
    // are pure; the desk hands their lines paced)
    if (t - tc > PREP_S + 0.5) cueAt("choir", t - PREP_S, function () { verse(0, t); });
    else verse(0, t);
    return { end: tc + P.estimate, tail: P.tail, verses: P.verses, plan: P, cast: plan };

    // one piece of the sheet, from t0: on the desk, and told as it goes
    // (orgst: the organist's hands — the sheet then carries no organ lines,
    // and the ward waits where the organist asks: kolob-cast.js)
    function piece(which, t0, orgst) {
      var sg = KOLOB.Cast.segment(W, h, plan, which, { stream: R, keynoteHz: K, beatS: P.beatS, carry: carry, at: t0, organist: org ? (orgst || {}) : null });
      sg.hymn = h; sg.hymnId = id;
      sg.alive = function () { return hands.owns(id); };
      onDesk(W, t0, sg);
      // who comes forward, and the rest of their moment: told as it happens
      sg.events.forEach(function (e) {
        if (e.type === "round-entry") {
          // (a round's groups going in, one after another)
          cueAt("choir", Math.max(S.now(), t0 + e.t), function () {
            if (!hands.owns(id)) return;
            emitEvent({ type: "round-entry", hymnId: id, verse: e.verse, entry: e.entry, group: e.group, singers: e.singers,
                        cat: "verse", label: "⟳ the round: " + e.group + " go in", detail: "entry " + e.entry + " · " + h.nameEn });
          });
          return;
        }
        if (e.type !== "cast") return;
        cueAt("choir", Math.max(S.now(), t0 + e.t), function () {
          if (!hands.owns(id)) return;
          var o = { type: "cast", memberId: e.memberId, nameDs: e.nameDs, action: e.action, role: e.role, actionDs: e.actionDs, hymnId: id,
                    cat: "cast", label: "✦ " + (KOLOB.Cast.ROLE_NAME[e.role] || e.memberId) + " " + e.action, detail: e.nameDs + " · " + h.nameEn };
          if (e.verse != null) { o.verse = e.verse; o.line = e.line; }
          emitEvent(o);
        });
      });
      // the intro's written notes (the keying, the pitching), told a
      // little ahead of their sound, as every line is
      var introNotes = sg.notes.filter(function (n) { return n.verse < 0; });
      if (introNotes.length) cueAt("choir", Math.max(S.now(), t0 + introNotes[0].at - AHEAD_S), function () {
        if (hands.owns(id)) introNotes.forEach(function (n) { tellNote(n, t0); });
      });
      // each line: told (its Score, its notes) AHEAD_S before it sounds; a
      // lined line with the precentor's (the deacon's row), AHEAD_S before
      // he gives it out — the two are one telling
      sg.lines.forEach(function (L) {
        if (L.lined) cueAt("choir", Math.max(S.now(), t0 + L.lined.at - AHEAD_S), function () { if (hands.owns(id)) { tellLining(sg, L, t0); tellLine(sg, L, t0); } });
        else cueAt("choir", Math.max(S.now(), t0 + L.at - AHEAD_S), function () { if (hands.owns(id)) tellLine(sg, L, t0); });
      });
      return sg;
    }
    function tellNote(n, t0) {
      var x = { part: n.part, sings: n.sings, hymnId: id, verse: n.verse, line: n.line, beat: n.beat, syl: n.syl, deg: n.deg, monzo: n.monzo.slice(), keyMonzo: h.keyMonzo.slice(), comma: n.comma || 0 };
      if (n.octave) x.octave = n.octave;
      ["member", "role", "amen", "tag", "repeat", "pitching", "liningOut", "group", "pass", "primary"].forEach(function (k) { if (n[k] != null) x[k] = n[k]; });
      emitNote("choir", K * mzRatio(h.keyMonzo) * mzRatio(n.monzo) * Math.pow(2, n.octave || 0), t0 + n.at, n.dur, x);
    }
    function tellLine(sg, L, t0) {
      var amen = !!L.amen, tag = !!L.tag;
      sg.notes.forEach(function (n) {
        if (n.verse !== L.verse || n.line !== L.line || n.liningOut) return;
        if (!!n.repeat !== !!L.repeat || !!n.amen !== amen || !!n.tag !== tag) return;
        if (L.group != null && (n.group !== L.group || n.pass !== L.pass)) return;       // (a round: this group's time round)
        tellNote(n, t0);
      });
      var line = amen ? h.amen : tag ? h.tag : vl[L.line];
      emitEvent({
        type: "verse-line", hymnId: id, verse: L.verse, line: L.line, speechLine: L.line + 1, practice: L.practice, composed: true, amen: amen, tag: tag, repeat: !!L.repeat,
        group: L.group != null ? L.group : undefined, pass: L.pass != null ? L.pass : undefined,
        meter: h.meter, syllables: (line.notes[h.melodyPart] || []).filter(function (n) { return n.syl !== null; }).length,
        start: t0 + L.at, beatS: L.beatS, keyMonzo: h.keyMonzo.slice(), dialect: h.dialect, score: line,
      });
      // the whole tune at last (a withheld Sunday's doxology): the deacon
      // doubles the tune above the ward's first verse
      if (cumulative && L.verse === 0 && !amen && !tag && S.renderClarinetLine) {
        var pl = Hy().partLine(line, h.melodyPart, L.beatS, vl[L.line + 1] || null);
        var cn = pl.ev.map(function (e) { return { f: K * mzRatio(h.keyMonzo) * mzRatio(e.n.monzo) * (h.melodyPart === "T" ? 4 : 2), dur: Math.max(0.2, e.dur) }; });
        if (cn.length) S.renderClarinetLine(t0 + L.at + 0.05, cn, 0.7, R.fork("assembly:" + L.line));
      }
    }
    function tellLining(sg, L, t0) {
      var mine = sg.notes.filter(function (n) { return n.liningOut && n.verse === L.verse && n.line === L.line; });
      mine.forEach(function (n) { tellNote(n, t0); });
      emitEvent({ type: "lining-out", meter: h.meter, syllables: mine.length, hymnId: id, verse: L.verse, line: L.line, composed: true, by: pre0.id, nameDs: pre0.nameDs, start: t0 + L.lined.at,
                  cat: "verse", label: "☞ the precentor lines out", detail: h.meter + " · line " + (L.line + 1) + " · " + pre0.nameDs + " · " + h.nameEn });
    }
    // the chorister's clock, as the ward's writer keeps it (kolob-cast.js):
    // the verse's beat (a hummed verse a little broader), each line's
    // broadening (the hymn's last line most), her fermatas
    function verseBeat(v) { return beatS * (plan.verses[v].practice === "hummed" ? 1.06 : 1); }
    function lineClock(v, i) { return { rit: (plan.rubato || 0) * (v === V - 1 && i === vl.length - 1 ? 2.2 : 0.35), hold: plan.holdMul }; }
    function verse(v, tv) {
      if (!S.playing || !hands.owns(id)) return;
      var Pv = plan.verses[v], op = null;
      if (org) {
        // the organist's verse first: the ward waits for its fills
        op = org.verse(v, 0, { bs: verseBeat(v), clock: function (i) { return lineClock(v, i); }, rest: !Pv.organ });
        S.organistPlays(op, tv, tagFor({ verse: v }));
      }
      var sg = piece({ verse: v }, tv, op ? { waits: op.waits } : null), ends = tv + sg.end;
      if (far) { var fu = far.verse(v, tv, sg.lines.length ? sg.lines[0].beatS : verseBeat(v)); if (fu) hands.until(id, fu); }
      var assembly = cumulative && v === 0;
      // THE PARTNER HYMN'S LAST VERSE: the first hymn played against it —
      // the two tunes turn out to be one piece
      if (h.partner && v === V - 1) partnerVerse(h, row, plan, sg, tv, v, org, who, R);
      cueAt("choir", Math.max(S.now(), tv - AHEAD_S - 0.01), function () {
        if (!hands.owns(id)) return;
        var bs = sg.lines.length ? sg.lines[0].beatS : beatS, perf = {};
        for (var k in Pv) perf[k] = Pv[k];
        // (the organ's registration is the organist's own)
        if (org && perf.organ) perf.organ = { registration: [org.regs[v]], organist: who.style };
        perf.tempoMul = +(h.beatS / bs).toFixed(3); perf.beatS = +bs.toFixed(3);
        emitEvent({ type: "verse-start", hymnId: id, verse: v, practice: Pv.practice, composed: true, performance: perf });
      });
      if (assembly) {
        cueAt("conductor", tv, function () {
          if (!hands.owns(id)) return;
          if (hands.assemblyBegins(tv, ends - tv + 1)) {
            var th = KOLOB.Melody.Motif.theme();
            emitEvent({ type: "guest", guest: "assembly", stage: "whole-tune", logged: true, theme: th ? th.name : null, hymnId: id, dur: ends - tv,
                        cat: "visitation", label: "✶ the whole tune, at last", detail: (th ? th.name + " · " : "") + h.nameEn });
            emitEvent({ type: "payoff", kind: "assembly", section: S.Meeting.section(), hymnId: id });
          }
        });
      }
      hands.until(id, ends);
      claimAir(ends - S.now(), 1);
      cueAt("choir", ends, function (te) { if (S.playing && hands.owns(id)) closeOf(v, te); });
      // what follows the verse is decided (and written) PREP_S before it ends
      cueAt("choir", Math.max(S.now(), ends - PREP_S), function () { after(v, ends); });
    }
    function closeOf(v, te) {
      var lastLine = vl[vl.length - 1], kind = lastLine.cadence ? lastLine.cadence.kind : "none";
      if (kind && kind !== "none" && kind !== "half") {
        emitEvent({ type: "cadence", kind: kind, by: "hymn", at: te, hymnId: id, verse: v,
                    cat: "harmony", label: "∴ " + kind + " cadence", detail: "verse " + (v + 1) + " · " + h.nameEn });
      }
    }
    function after(v, te) {
      if (!S.playing || !hands.owns(id)) return;
      var steps = [];
      if (v === P.fugingAfter) steps.push("fuging");
      if (v === P.guestAfter && hands.guestWaiting()) steps.push("guest");
      // (the wandering refrain, after the hymn's last verse — before its
      // A-men, as a chorus is sung — when a statement follows it)
      var stmt = v === plan.verses.length - 1 && S.Meeting.refrainAfter ? S.Meeting.refrainAfter(id) : null;
      if (stmt) steps.push("refrain");
      if (v < plan.verses.length - 1) steps.push("verse"); else steps.push("end");
      run(0, te);
      function run(k, t) {
        var step = steps[k];
        if (step === "refrain") {
          var tr = t + 1.1 * beatS, rl = singRefrain(stmt, tr, W, id);
          if (rl > 0) { hands.until(id, tr + rl); claimAir(tr + rl - S.now(), 1); }
          var nr = tr + Math.max(0, rl) + (rl > 0 ? 0.9 * beatS : 0);
          later(nr, function () { run(k + 1, nr); });
        } else if (step === "fuging") {
          var tf = t + 0.6 * beatS, fd = wardFuging(tf, h, P, R.fork("fuging:" + v), W);
          if (fd > 0) {
            hands.until(id, tf + fd); claimAir(tf + fd - S.now(), 1);
            cueAt("choir", tf, function (ft) { if (hands.owns(id)) S.Meeting.hands.fuging(ft, fd); });
          }
          var nx = tf + Math.max(0, fd) + 1.2 * beatS;
          later(nx, function () { run(k + 1, nx); });
        } else if (step === "guest") {
          var ag = t + 1.5;
          hands.until(id, ag);
          cueAt("conductor", ag, function (tg) {
            if (!hands.owns(id)) return;
            var span = hands.guestInGap(tg);
            if (span > 0) hands.until(id, tg + span);
            run(k + 1, tg + span + (span > 0 ? 2.5 : 0));
          });
        } else if (step === "verse") {
          // the organist bridges the verses — the plain organist's breath,
          // the Victorian's close played again softly, the improviser's
          // first line sequenced over a pedal point — except after the
          // fuging, whose amen has already gathered the ward
          var gapS = P.gap;
          if (org && steps[k - 1] !== "fuging") {
            var ip = org.interlude(v, 0);
            S.organistPlays(ip, t, tagFor({ verse: v, interlude: true }));
            gapS = ip.next;
          }
          var nv = t + gapS;
          hands.until(id, nv);
          later(nv, function () { verse(v + 1, nv); });
        } else finish(t);
      }
    }
    // (a step that begins at `at` is written PREP_S before it, or now)
    function later(at, fn) {
      if (at - S.now() > PREP_S + 0.5) cueAt("choir", at - PREP_S, function () { if (hands.owns(id)) fn(); });
      else fn();
    }
    function finish(tf) {
      var endAt = tf;
      if (h.amen && plan.amen) {
        var ta = tf + 0.3 * beatS;
        // the organ under the ward's amen, as written (the organist's)
        if (org) S.organistPlays(org.amen(0, { bs: beatS, ck: { rit: (plan.rubato || 0) * 1.5, hold: plan.holdMul } }), ta, tagFor({ verse: V - 1, amen: true, amenLine: vl.length }));
        var am = piece("amen", ta), alen = am.end;
        if (far) { var fa = far.amen(ta, beatS); if (fa) hands.until(id, fa); }
        cueAt("choir", ta + alen, function (tc2) {
          if (!hands.owns(id)) return;
          emitEvent({ type: "cadence", kind: "plagal", by: "hymn", at: tc2, hymnId: id, amen: true,
                      cat: "harmony", label: "∴ plagal cadence", detail: "A-men · " + h.nameEn });
        });
        endAt = ta + alen + 0.6;
      }
      if (h.tag) {
        // the barbershop's tag: the lead holds home's note, the chords turn
        // round it, and the last one rings
        var tt = endAt + 0.4 * beatS, tg = piece("tag", tt), tlen = tg.end, tk = h.tag.cadence ? h.tag.cadence.kind : "authentic";
        cueAt("choir", tt + tlen, function (tc3) {
          if (!hands.owns(id)) return;
          emitEvent({ type: "cadence", kind: tk, by: "hymn", at: tc3, hymnId: id, tag: true,
                      cat: "harmony", label: "∴ " + tk + " cadence", detail: "the tag · " + h.nameEn });
        });
        endAt = tt + tlen + 0.8;
      }
      var fin = function (te2) {
        if (far) { var fc = far.close(te2); if (fc) hands.until(id, fc); }
        if (keyed && S.droneDuck) {
          S.droneDuck.gain.cancelScheduledValues(te2);
          S.droneDuck.gain.setValueAtTime(0.22, te2);
          S.droneDuck.gain.linearRampToValueAtTime(1, te2 + 6);
        }
        hands.done(id, te2);
      };
      // a guest still waiting (a one-verse doxology) comes when the hymn is done
      if (P.guestAfter < 0 && hands.guestWaiting()) {
        cueAt("conductor", endAt + 1.5, function (tg) {
          if (!hands.owns(id)) return;
          var span = hands.guestInGap(tg);
          fin(tg + Math.max(0, span));
        });
        hands.until(id, endAt + 1.5);
      } else {
        hands.until(id, endAt);
        cueAt("choir", endAt, function (te2) { if (hands.owns(id)) fin(te2); });
      }
    }
  }

  // ==========================================================================
  // THE PARTNER HYMN'S LAST VERSE (PLAN-COMPOSITION §14 item 2). The
  // doxology was written on the first hymn's chords, in its
  // meter, mode and key (the composer's partner()); where the composer's
  // strict fit check let the two be sung together (h.partner.combined), the
  // first hymn's tune — retuned to the partner's chords, note for note
  // (h.partner.firstTune) — is played against the ward's last verse: by the
  // organist on the trumpet stop, over the organ's own verse; or, in a
  // hymn sung without the organ (and on the organist's die), by a cornet of
  // the ward's band, a man in the front pew (the Nauvoo band's lead
  // instrument). It is laid on the chorister's own clock, line by line on
  // the ward's lines as told (their fills and fermatas included), so the two
  // tunes meet on every beat; each line 2.5 s before it sounds. Not combined
  // (the fit check's fallback): nothing is played against it, and the page
  // is told so. This is the doxology's payoff (the rule: one a doxology).
  // ==========================================================================
  var PARTNER_ORGAN = 0.6;       // the organist plays it, where there is an organ, this often (else the cornet)
  var CORNET_GAIN = 0.55;        // the cornet in the room: about the trumpet stop's weight over the ward
  function partnerVerse(h, row, plan, sg, tv, v, org, who, R) {
    // DICE: the organ die and the player die are drawn first, whether or not
    // the hymn is combined
    var Rp = R.fork("partner"), organDie = Rp.next(), whoDie = Rp.next();
    var id = h.id, hands = S.Meeting.hands, W = theWard();
    if (!h.partner.combined || !h.partner.firstTune) {
      cueAt("choir", Math.max(S.now(), tv - 0.01), function () {
        if (hands.owns(id)) emitEvent({ type: "partner", hymnId: id, of: h.partner.of, by: "none", combined: false, verse: v, cat: "verse", label: "⚭ the partner hymn (not combined)", detail: h.nameEn });
      });
      return;
    }
    var byOrgan = !!(org && who && S.organistPlays) && organDie < PARTNER_ORGAN;
    var K = S.F0 * S.ROOT_MULT, vl = Hy().verseLines(h), ft = h.partner.firstTune, ev = [];
    ft.forEach(function (notes, i) {
      var L = null;
      sg.lines.forEach(function (x) { if (x.line === i && !x.repeat && !x.amen && !x.tag && !L) L = x; });
      if (!L || !vl[i] || !notes || !notes.length) return;
      var rit = (plan.rubato || 0) * (v === plan.verses.length - 1 && i === vl.length - 1 ? 2.2 : 0.35);
      var clk = Cs().clock(vl[i], L.beatS, rit, plan.holdMul);
      for (var k = 0; k < notes.length; k++) {
        var n = notes[k], b0 = n.beat, b1 = n.beat + n.beats;
        while (notes[k].tie && k + 1 < notes.length) { k++; b1 = notes[k].beat + notes[k].beats; }
        var st = clk(b0), dur = clk(b1) - st;
        if (k === notes.length - 1 && vl[i].breathAfter !== false) dur -= Math.min(0.3 * L.beatS, 0.25 * dur);
        ev.push({ at: L.at + st, dur: Math.max(0.08, dur), n: n, line: i });
      }
    });
    if (!ev.length) return;
    // (the tune where a treble instrument sings it: a tenor's tune an octave up)
    var mean = 0; ev.forEach(function (e) { mean += Math.log(K * mzRatio(h.keyMonzo) * mzRatio(e.n.monzo)); }); mean = Math.exp(mean / ev.length);
    var oct = mean < 240 ? 1 : 0;
    function mzOf(e) { var m = mzAdd(h.keyMonzo, e.n.monzo); m[0] += oct; return m; }
    var endAt = 0; ev.forEach(function (e) { endAt = Math.max(endAt, e.at + e.dur); });
    var by = byOrgan ? "organ" : "cornet", player = null;
    if (!byOrgan) {
      var men = W.members.filter(function (m) { return m.k != null && !m.role && (m.part === "T" || m.part === "B"); });
      player = men.length ? men[Math.min(men.length - 1, Math.floor(whoDie * men.length))] : null;
    }
    cueAt("choir", Math.max(S.now(), tv - 0.01), function () {
      if (!hands.owns(id)) return;
      emitEvent({ type: "partner", hymnId: id, of: h.partner.of, by: by, combined: true, verse: v, player: player ? player.id : "organist",
                  cat: "verse", label: "⚭ the first hymn against it", detail: (byOrgan ? "the organ's trumpet" : "a cornet") + " · " + h.nameEn });
      emitEvent({ type: "payoff", kind: "partner", section: S.Meeting.section(), hymnId: id });
      if (player) emitEvent({ type: "cast", memberId: player.id, nameDs: player.nameDs, action: "plays the first hymn on the cornet", role: null, hymnId: id, verse: v, line: 0,
                              actionDs: Cs().ACTION_DS["plays the first hymn on the cornet"] || null, cat: "cast", label: "✦ a man of the ward plays the first hymn on the cornet", detail: player.nameDs + " · " + h.nameEn });
    });
    if (byOrgan) {
      var notes = ev.map(function (e) { return { at: +e.at.toFixed(3), dur: +e.dur.toFixed(3), m: mzOf(e), part: "S", v: 1 }; });
      var report = ev.map(function (e) { return { at: +e.at.toFixed(3), dur: +e.dur.toFixed(3), m: mzOf(e), part: "partner", line: e.line, beat: e.n.beat, deg: e.n.deg }; });
      var pp = { kind: "partner", style: who.style, organist: { nameDs: who.nameDs, nameEn: who.nameEn }, hymnId: id, dur: endAt,
                 phrases: [{ t: 0, reg: "trumpet solo", label: "the first hymn against the partner, on the trumpet", texture: 1, notes: notes, report: report }],
                 swell: [], events: [{ t: 0, action: "plays the first hymn against it", nameDs: who.nameDs }], ward: [], fills: [], sections: [], verseDyn: [], counts: {},
                 liftDb: org && org.liftDb || 0 };
      S.organistPlays(pp, tv, { hymnId: id, key: h.keyMonzo, verse: v, style: who.style, partner: true, alive: function () { return hands.owns(id); } });
      return;
    }
    // the cornet: its own few nodes, laid a line at a time, let go after
    var band = KOLOB.VoicesBand && S.seatedSend ? KOLOB.VoicesBand.create(S.ctx, S.seatedSend("cornet"), { rand: S.synth("band").fork("partner:" + id), gain: CORNET_GAIN }) : null;
    if (!band) return;
    var byLine = {};
    ev.forEach(function (e) { (byLine[e.line] = byLine[e.line] || []).push(e); });
    Object.keys(byLine).forEach(function (li) {
      var es = byLine[li], t1 = tv + es[0].at;
      cueAt("choir", Math.max(S.now(), t1 - 2.5), function () {
        if (!S.playing || !hands.owns(id)) return;
        band.play(t1, es.map(function (e) { return { f: K * mzRatio(mzOf(e)), dur: e.dur, at: e.at - es[0].at }; }), "cornet", "mf");
        es.forEach(function (e) {
          emitNote("cornet", K * mzRatio(mzOf(e)), tv + e.at, e.dur, { part: "partner", partner: true, hymnId: id, of: h.partner.of, line: e.line, beat: e.n.beat, deg: e.n.deg,
                                                                       monzo: e.n.monzo.slice(), octave: oct, keyMonzo: h.keyMonzo.slice(), verse: v });
        });
      });
    });
    cueAt("choir", tv + endAt + 4, function () { try { band.dispose(); } catch (e) {} });
  }

  // ==========================================================================
  // THE WANDERING REFRAIN, ONE STATEMENT (PLAN-COMPOSITION §15 item 4). The
  // meeting's own two lines in the camp-meeting lilt (the
  // composer's wanderingRefrain(), fitted to the day's keys), set in the key
  // and dialect of the hymn it follows (refrainIn), sung after that hymn's
  // last verse: the first time the enthusiast starts it ALONE and the ward
  // takes it up; after a later hymn the ward sings it, the enthusiast singing
  // out; in the doxology the ward sings it unprompted — the doxology's
  // payoff. Nobody keys it and the organ lets it be. Its sheet is the ward's
  // as a hymn's is (kolob-cast.js planRefrain), on the ward's desk; told
  // as a hymn's lines are, under its own id (r:<n>:<k>). → its length (s)
  // ==========================================================================
  function singRefrain(stmt, t0, W, ownerId) {
    var rh = Hy().get(stmt.id);
    if (!rh || !Cs().planRefrain) return 0;
    var n = S.Meeting.meetingNum(), Rr = S.formStream("refrain:" + n + ":" + (stmt.k + 1)).fork("performance");
    var plan2 = Cs().planRefrain(W, rh, Rr, { k: stmt.k, dox: stmt.dox });
    var carry = { lastEnd: {} }, t = t0, K = S.F0 * S.ROOT_MULT, hands = S.Meeting.hands, rvl = Hy().verseLines(rh);
    var alive = function () { return hands.owns(ownerId); };
    var starter = plan2.refrain.starter ? W.byId[plan2.refrain.starter] : null;
    cueAt("choir", Math.max(S.now(), t0 - 0.01), function () {
      if (!alive()) return;
      emitEvent({ type: "refrain", refrainId: rh.id, statement: stmt.k, after: stmt.after, dox: !!stmt.dox, by: starter ? starter.nameDs : null, key: stmt.key, dialect: rh.dialect,
                  cat: "verse", label: "↺ the refrain" + (stmt.dox ? ", unprompted" : stmt.k === 0 ? ", begun by one voice" : ", again"), detail: (rh.nameEn || "") + " · " + stmt.key });
      if (stmt.dox) emitEvent({ type: "payoff", kind: "refrain", section: S.Meeting.section(), hymnId: ownerId });
    });
    plan2.verses.forEach(function (Pv, v) {
      var sg = Cs().segment(W, rh, plan2, { verse: v }, { stream: Rr, keynoteHz: K, beatS: rh.beatS, carry: carry, at: t });
      sg.hymn = rh; sg.hymnId = rh.id; sg.alive = alive;
      onDesk(W, t, sg);
      tellPiece(sg, rh, t, alive, rvl, v, Pv);
      t += sg.end + (v < plan2.verses.length - 1 ? 0.9 * sg.beatS : 0);
    });
    return t - t0;
  }
  // a piece of the ward's sheet that is not a hymn's own (a statement of
  // the refrain), told as a hymn's is: who comes forward, the verse, each
  // line and its written notes, a little ahead of their sound
  function tellPiece(sg, h, t0, alive, vl, v, Pv) {
    var K = S.F0 * S.ROOT_MULT;
    sg.events.forEach(function (e) {
      if (e.type !== "cast") return;
      cueAt("choir", Math.max(S.now(), t0 + e.t), function () {
        if (!alive()) return;
        emitEvent({ type: "cast", memberId: e.memberId, nameDs: e.nameDs, action: e.action, role: e.role, actionDs: e.actionDs, hymnId: h.id, verse: e.verse, line: e.line,
                    cat: "cast", label: "✦ " + (KOLOB.Cast.ROLE_NAME[e.role] || e.memberId) + " " + e.action, detail: e.nameDs + " · the refrain" });
      });
    });
    cueAt("choir", Math.max(S.now(), t0 - AHEAD_S - 0.01), function () {
      if (alive()) emitEvent({ type: "verse-start", hymnId: h.id, verse: v, practice: Pv.practice, composed: true, refrain: true, performance: { practice: Pv.practice, beatS: +sg.beatS.toFixed(3) } });
    });
    sg.lines.forEach(function (L) {
      cueAt("choir", Math.max(S.now(), t0 + L.at - AHEAD_S), function () {
        if (!alive()) return;
        sg.notes.forEach(function (n) {
          if (n.verse !== L.verse || n.line !== L.line || !!n.repeat !== !!L.repeat) return;
          var x = { part: n.part, sings: n.sings, hymnId: h.id, verse: n.verse, line: n.line, beat: n.beat, syl: n.syl, deg: n.deg, monzo: n.monzo.slice(), keyMonzo: h.keyMonzo.slice(), comma: n.comma || 0, refrain: true };
          if (n.octave) x.octave = n.octave;
          ["member", "role"].forEach(function (k) { if (n[k] != null) x[k] = n[k]; });
          emitNote("choir", K * mzRatio(h.keyMonzo) * mzRatio(n.monzo) * Math.pow(2, n.octave || 0), t0 + n.at, n.dur, x);
        });
        var line = vl[L.line];
        emitEvent({ type: "verse-line", hymnId: h.id, verse: L.verse, line: L.line, speechLine: L.line + 1, practice: L.practice, composed: true, amen: false, tag: false, repeat: !!L.repeat, refrain: true,
                    meter: h.meter, syllables: (line.notes[h.melodyPart] || []).filter(function (q) { return q.syl !== null; }).length,
                    start: t0 + L.at, beatS: L.beatS, keyMonzo: h.keyMonzo.slice(), dialect: h.dialect, score: line });
      });
    });
  }

  // THE FUGING, ON THE HYMN'S OWN HEAD — by the ward (the house's
  // hymnFuging, above, with sections for voices): the sections go out one
  // by one, the basses first, then each above them, at the fifth and the
  // octave by turns, on the first notes of the hymn's first line; then all
  // thirty-two gather into the dialect's own close (the Sacred Harp's and
  // the psalmody's bare fifth; elsewhere the amen, IV–I). The piece is
  // written when it is decided, PREP_S ahead, and put on the desk.
  // → its length (from tc)
  var WARD_VOICES = [{ vi: 0, part: "S" }, { vi: 1, part: "A" }, { vi: 2, part: "T" }, { vi: 3, part: "B" }];
  function wardFuging(tc, h, P, R, W) {
    var t = 0.3, Kn = S.F0 * S.ROOT_MULT, base = Kn * mzRatio(h.keyMonzo), bs = P.beatS;
    var mel = (h.lines[0].notes[h.melodyPart] || []).filter(function (n) { return n.syl !== null; });
    var head = mel.slice(0, Math.min(mel.length, R.rint(4, 6)));
    if (head.length < 3) return 0;
    var stagger = R.rnd(2.4, 3.2);
    var order = WARD_VOICES.slice().sort(function (a, b) { return b.vi - a.vi; });          // bass up
    var entries = Math.min(4, R.rint(2, order.length + 1));
    var cues = [], told = [], lastEnd = t, lastF = {};
    var sections = {};
    W.members.forEach(function (m) { if (m.k != null) (sections[m.part] = sections[m.part] || []).push(m); });
    function sing(mv, at, notes, gain, vowel) {
      (sections[mv.part] || []).forEach(function (m) {
        cues.push({ at: +at.toFixed(4), memberId: m.id, bus: "hall", pan: m.pew.x, gain: +(Cs().WARD_GAIN * gain).toFixed(4), breathBefore: 0.4, what: "fuging", verse: -1, line: -1,
                    notes: notes.map(function (n, j) { return { f: n.f, dur: n.dur, vowel: vowel || "ah", stress: 1, slur: false }; }) });
      });
    }
    var headBeats = head.map(function (n) { return Math.max(0.5, Math.min(2, n.beats)); });
    for (var e = 0; e < entries; e++) {
      var mv = order[e], shift = e % 2 === 1 ? 4 : 0;
      var fs = head.map(function (n) { return base * mzRatio(Cm().spelledMonzo(h.mode, n.deg + shift, 0)); });
      var mean = Math.exp(fs.reduce(function (a, f) { return a + Math.log(f); }, 0) / fs.length), target = Kn * REG[mv.vi];
      var o = 1; while (mean * o > target * 1.41) o /= 2; while (mean * o < target / 1.41) o *= 2;
      var at = t + e * stagger, x = 0;
      var notes = fs.map(function (f, j) { var nt = { at: x, dur: headBeats[j] * bs, f: f * o }; x += headBeats[j] * bs; return nt; });
      sing(mv, at, notes, 0.85, "ah");
      notes.forEach(function (nt, j) {
        told.push([nt.f, at + nt.at, nt.dur, { part: mv.part, sings: mv.part, hymnId: h.id, fuging: true, deg: head[j].deg + shift, monzo: mzAdd(Cm().spelledMonzo(h.mode, head[j].deg + shift, 0), [Math.round(Math.log2(o)), 0, 0, 0]), keyMonzo: h.keyMonzo.slice() }]);
      });
      lastF[mv.vi] = notes[notes.length - 1].f;
      if (at + x > lastEnd) lastEnd = at + x;
    }
    // the convergence: every section together, the dialect's own close
    var open = h.dialect === "sacredharp" || h.dialect === "psalmody";
    var kind = open ? "openfifth" : "plagal";
    var chords = open ? [[4, 8], [0, 4]] : [[3, 5, 7], [0, 2, 4]];
    var cadAt = lastEnd + R.rnd(0.5, 1.2), cd = R.rnd(2.2, 3.0) * Math.max(0.8, bs / 0.8);
    var prevF = {};
    WARD_VOICES.forEach(function (mv) { prevF[mv.vi] = lastF[mv.vi] || Kn * REG[mv.vi]; });
    chords.forEach(function (degs, ci) {
      var at = cadAt + ci * cd, dur = cd * (ci ? 1.6 : 1.02);
      WARD_VOICES.forEach(function (mv) {
        var cands = mv.vi === 3 ? [degs[0]] : degs, best = null, bd = null;
        cands.forEach(function (d) {
          [-14, -7, 0, 7, 14].forEach(function (oc) {
            var f = base * mzRatio(Cm().spelledMonzo(h.mode, d + oc, 0));
            var dist = Math.abs(Math.log(f / (mv.vi === 3 ? Kn * REG[3] : prevF[mv.vi])));
            if (mv.vi !== 3 && Math.abs(Math.log(f / (Kn * REG[mv.vi]))) > 0.6) return;
            if (bd == null || dist < bd) { bd = dist; best = { f: f, d: d + oc }; }
          });
        });
        if (!best) return;
        sing(mv, at, [{ at: 0, dur: dur, f: best.f }], 0.9, ci ? "eh" : "ah");
        told.push([best.f, at, dur, { part: mv.part, sings: mv.part, hymnId: h.id, fuging: true, deg: best.d, monzo: Cm().spelledMonzo(h.mode, best.d, 0), keyMonzo: h.keyMonzo.slice() }]);
        prevF[mv.vi] = best.f;
      });
    });
    cues.sort(function (a, b) { return a.at - b.at; });
    onDesk(W, tc, { cues: cues, organ: [], hymnId: h.id, alive: function () { return S.Meeting.hands.owns(h.id); } });
    // told as the house's fuging is — its notes, its close, the entry
    var hands = S.Meeting.hands;
    cueAt("choir", Math.max(S.now(), tc - AHEAD_S), function () {
      if (!hands.owns(h.id)) return;
      told.forEach(function (x) { emitNote("choir", x[0], tc + x[1], x[2], x[3]); });
      emitEvent({ type: "fuging", entries: entries, stagger: stagger, hymnId: h.id, head: head.map(function (n) { return n.deg; }), by: "ward",
                  cat: "fuging", label: "⁂ fuging entry ×" + entries, detail: "stagger " + stagger.toFixed(1) + "s · on the hymn's head · the ward's sections · " + h.nameEn });
    });
    cueAt("choir", tc + cadAt + cd, function (tq) {
      if (!hands.owns(h.id)) return;
      emitEvent({ type: "cadence", kind: kind, by: "fuging", at: tq, hymnId: h.id,
                  cat: "harmony", label: "∴ " + kind + " cadence", detail: "the fuging gathers" });
    });
    return cadAt + cd * 2.6;
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
  S.singHymn = singHymn;
  // the ward
  S.hymnPlan = hymnPlan;
  S.wardOn = wardOn;
  S.theWard = function () { return wardOn() ? theWard() : null; };
  S.wardStop = wardStop;
  S.wardStats = wardStats;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-choir.js"] = true;   // the load guard's roll call
})();

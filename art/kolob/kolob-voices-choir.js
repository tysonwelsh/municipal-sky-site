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
  // THE HUM (the humming seating, round 2 of the polish): lips closed, the
  // sound through the nose — one broad resonance where each voice sits, the
  // upper formants all but gone (S A T B: centre, Hz; then the faint two)
  var HUM_FORMANTS = [[500, 1150, 2500], [400, 1050, 2400], [300, 950, 2300], [220, 900, 2200]];
  // (the singer's own detune and breath are sound-level: synth:choir)
  function choirVoiceLine(t, notes, vi, gainMul, vowel) {
    var Y = synth("choir");
    // one SATB voice walks a line of {f, dur} with scoops between pitches
    var vowelAmt = getLayerParam("choir", "vowel", 0.4);
    var scoop = getLayerParam("choir", "scoop", 0.5);
    var hum = vowel === "hum";
    var dest = panAt("choir", CHOIR_PANS[vi] * (hum ? 0.6 : 1));
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
  // THE HUM (the humming seating; round 2 of the polish): the ward hums as
  // it gathers, before the organist has touched a key — the voices of the
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
    // a composed hymn owns its section's singing (THE COMPOSED HYMN, below):
    // the choir's own turns wait for the next section — except, once the
    // hymn is sung, to answer the deacon if he lines out a line of the
    // day's material (the lining-out's old conversation, around the hymn)
    var composedHere = sings && !!S.Meeting.hymn();
    if (composedHere && (S.Meeting.hymnSounding() || !Motif.pendingLineOut("choir"))) { cueIn("choir", 6, choirVerse); return; }
    // no couplet is begun under the joint's amen: the hymn's time is up, and
    // the next line belongs to the next section (round 2 — v0.32 could start
    // a couplet here and sing it half a minute into whatever came next)
    // (nor while a planned fuging waits for its window: the verses leave it
    // free — round 2 of the polish; see the conductor's fuging)
    if (!sings || inFuging() || inQuestion() || S.Meeting.jointing() || S.Meeting.fugingNear()) { cueIn("choir", 6, choirVerse); return; }
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
    if (composedHere) { cueIn("choir", 6, choirVerse); return; }

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
  // THE COMPOSED HYMN (round 3's integration; PLAN-COMPOSITION §3, §4, §7;
  // SCORE §5–§6). The day's hymnal (kolob-hymnal.js) has had each hymn
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
  // Today's choir is the house's four formant voices (the full ward of
  // thirty-two is the CAST crew's, integrated later): the voices take the
  // Score's parts as the dialect asks — the Sacred Harp gives its tenor the
  // tune whoever else is missing — and each line is laid out in seconds the
  // way the hymn lab lays it (a fermata holds; the last note of a line gives
  // up a breath), handed to the voices a little ahead of when it sounds.
  // Every sounded note is reported as the Score writes it — its part, its
  // hymn, verse, line and beat, its syllable, its degree and exact monzo —
  // and every line is told with its Score (verse-line), so the staff
  // engraves real parts.
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
    // first event is 1, and 10 ms of the bare sawtooth at full level was a
    // click at every line — found in the capture, round 3)
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
  // performance fork (hymn:<n>:<i> → performance), thrown whether used or not
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
    var organ = D === "tabernacle";
    var pivot = organ && row.key !== "home";
    var intro = organ ? (pivot ? 6 * beatS : 0) + Hy().partLine(h.lines[h.lines.length - 1], h.melodyPart, beatS, null).len + 0.9 * beatS : 0;
    var amen = h.amen ? Hy().partLine(h.amen, h.melodyPart, beatS, null).len + 0.3 * beatS : 0;
    // how many verses: two to four as the section has room (one for a
    // doxology, sometimes two); a long verse — a double meter lined out in
    // the Old Way runs to three minutes — is sung once, and no hymn runs on
    // past half again its section's planned length
    var range = dox ? [1, lined ? 1 : 2] : (D === "tabernacle" ? [2, 4] : D === "sacredharp" ? [2, 3] : [1, 2]);
    if (verseLen > 100) range = [1, 1];
    else if (verseLen > 55) range[1] = Math.min(range[1], 2);
    var room = sectionDur - lead - tail - intro - amen;
    var V = Math.round(room / (verseLen + gap) + versesDie - 0.5);
    while (V > range[0] && lead + intro + V * verseLen + (V - 1) * gap + amen > sectionDur * 1.5) V--;
    V = Math.max(range[0], Math.min(range[1], V));
    // the vowels of each verse (until the ward has words): a palette of its
    // own, one vowel a syllable (dice thrown for four verses, always)
    var vowels = [];
    for (var v = 0; v < 4; v++) {
      var Rv = R.fork("vowels:" + v), per = [];
      for (var k = 0; k < 160; k++) per.push(Rv.pickW(VERSE_VOWELS));
      vowels.push(per);
    }
    var fugDie = R.fork("fuging").next();
    return {
      beatS: beatS, tempoMul: +(h.beatS / beatS).toFixed(3), lined: lined, organ: organ, pivot: pivot, verses: V,
      lead: lead, tail: tail, gap: gap, verseLen: verseLen, intro: intro, amenLen: amen,
      vowels: vowels, voices: hymnVoices(h),
      // the fuging (the section's die, drawn in round 2) comes after the
      // middle verse; never in the Old Way, never in a doxology
      fugingAfter: !dox && !lined && V >= 2 && S.Meeting.hands.fugingPlanned() ? (V === 4 ? (fugDie < 0.5 ? 1 : 2) : V === 3 ? 1 : 0) : -1,
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
    // the line, told with its Score (SCORE §6: verse-line; round 3 — a
    // composed line, as the composer wrote it, in the hymn's key)
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

  // singHymn(h, row, t): the section at t hands its hymn to the ward.
  // → { end (the last chord's end, as far as it can be told now), tail }
  function singHymn(h, row, tc) {
    if (!S.playing || !h || !Hy() || !Cm()) return null;
    var hands = S.Meeting.hands, id = h.id;
    var R = S.hymnStream(S.Meeting.meetingNum(), row.i).fork("performance");
    var P = performancePlan(h, row, R, S.Meeting.sectionDur());
    // each singer's appetite for ornament (the Old Way; four, always drawn)
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
  S.choirSingLine = choirSingLine;
  S.hymnVoices = hymnVoices;
  (KOLOB._rooms = KOLOB._rooms || {})["kolob-voices-choir.js"] = true;   // the load guard's roll call
})();

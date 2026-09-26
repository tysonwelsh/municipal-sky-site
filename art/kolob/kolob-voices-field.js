// ============================================================================
// KOLOB — kolob-voices-field.js: the still small voice, the wire, the valley
//
// The near-threshold murmur, the Deseret telegraph, and the far-field
// events of the valley. Split from kolob-audio.js (v0.30); see the room list
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
  function projDeg(d7) { return S.projDeg(d7); }
  function degFreq(i) { return S.degFreq(i); }
  function harm(h) { return S.harm(h); }
  // from kolob-meeting.js
  function intensity() { return S.intensity(); }
  function silenceMul() { return S.silenceMul(); }
  function gapMul() { return S.gapMul(); }
  // from kolob-core.js
  function rnd(a, b) { return S.rnd(a, b); }
  function rint(a, b) { return S.rint(a, b); }
  function chance(p) { return S.chance(p); }
  function pick(arr) { return S.pick(arr); }
  function pickW(pool) { return S.pickW(pool); }
  function emitNote(layer, freq, startTime, duration, extra) { return S.emitNote(layer, freq, startTime, duration, extra); }
  function emitEvent(ev) { return S.emitEvent(ev); }
  function scheduleLayer(fn, baseMs, layer) { return S.scheduleLayer(fn, baseMs, layer); }
  function scheduleRaw(fn, ms) { return S.scheduleRaw(fn, ms); }
  function panAt(layer, p) { return S.panAt(layer, p); }
  function getLayerParam(layer, key, fallback) { return S.getLayerParam(layer, key, fallback); }
  function fieldDest(key, pan) { return S.fieldDest(key, pan); }
  function noiseSource() { return S.noiseSource(); }
  function noiseOffset() { return S.noiseOffset(); }
  function env(g, t, pts) { return S.env(g, t, pts); }
  // (the other rooms' state, read and written through S: S.ctx, S.playing,
  // S.F0, S.C, S.Motif)

  // ==========================================================================
  // VOICE: THE STILL SMALL VOICE — a near-threshold murmur, close to the ear.
  // Not a wind, not an earthquake, not a fire. Speaks in the invocation and
  // the sacrament; in the sacrament it is the only moving thing over the
  // drone. Never words.
  // ==========================================================================
  var VOICE_VOWELS = [[320, 850], [430, 1100], [540, 1450], [660, 1800], [790, 2050]];
  function stillVoiceRender(t, dur) {
    var dest = panAt("voice", 0);
    var presence = getLayerParam("voice", "presence", 0.4);
    var sylAmt = getLayerParam("voice", "syllables", 0.4);
    var sylRate = 2 + sylAmt * 1.5;                            // 2-3.5 syl/s — slower than speech
    var o = S.ctx.createOscillator();
    o.type = "sawtooth";
    // recitation-tone drift — prosody, not song
    o.frequency.setValueAtTime(S.F0 * 2, t);
    o.frequency.linearRampToValueAtTime(S.F0 * 2 * rnd(0.985, 1.02), t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(S.F0 * 2 * 0.985, t + dur);
    // LESSON: pre-attenuate before high-Q formants (they boost ~9x).
    var pre = S.ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var f1 = S.ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.setValueAtTime(5, t);
    var f2 = S.ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.setValueAtTime(6, t);
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(1400, t);
    var f1g = S.ctx.createGain(); f1g.gain.setValueAtTime(1, t);
    var f2g = S.ctx.createGain(); f2g.gain.setValueAtTime(0.6, t);
    var gate = S.ctx.createGain();
    var og = S.ctx.createGain();
    pre.connect(f1); f1.connect(f1g); f1g.connect(gate);
    pre.connect(f2); f2.connect(f2g); f2g.connect(gate);
    gate.connect(og); og.connect(dest);
    gate.gain.setValueAtTime(0, t);
    var st = t + 0.05, end = t + dur - 0.5;
    // formant jumps as short linearRamps, NEVER setTargetAtTime (biquad
    // frequency under exponential-approach automation destabilizes — measured)
    var pv1 = 500, pv2 = 1400;
    while (st < end) {
      var syl = 1 / (sylRate * rnd(0.8, 1.25));
      var v = pick(VOICE_VOWELS);
      f1.frequency.setValueAtTime(pv1, st); f1.frequency.linearRampToValueAtTime(v[0], st + 0.035);
      f2.frequency.setValueAtTime(pv2, st); f2.frequency.linearRampToValueAtTime(v[1], st + 0.035);
      pv1 = v[0]; pv2 = v[1];
      var on = Math.max(0.04, syl * 0.24);
      var hold = syl * rnd(0.4, 0.62);
      gate.gain.setValueAtTime(0, st);
      gate.gain.linearRampToValueAtTime(1, st + on);
      gate.gain.linearRampToValueAtTime(0, st + on + hold);
      st += syl + (chance(0.2) ? rnd(0.3, 1.1) : 0);           // long breath commas
    }
    // The real governor of the voice's loudness. It was pinned near-threshold
    // here (0.24), so raising only the layer trim doubled a near-silent source
    // and read as no change. Lifted at the source by owner request so the still
    // small voice actually sits in the room.
    var peak = 0.55 * presence;
    env(og, t, [[1.6, peak], [Math.max(0.4, dur - 3.4), peak * 0.9], [1.8, 0]]);
    o.start(t); o.stop(t + dur + 0.3);
    emitNote("voice", 0, t, dur);
    return dur;
  }
  function stillVoicePhrase() {
    if (!S.playing) return;
    var s = S.C.section;
    var speaks = s === "invocation" || s === "sacrament" || (s === "testimony" && chance(0.3));
    if (!speaks) { scheduleRaw(stillVoicePhrase, 7000); return; }
    var dur = rnd(7, 15);
    stillVoiceRender(S.ctx.currentTime + 0.05, dur);
    scheduleLayer(stillVoicePhrase, (dur + rnd(6, 16) * silenceMul()) * 1000, "voice");
  }

  // ==========================================================================
  // VOICE: TELEGRAPH — the Deseret wire. It flashes a real word or two toward
  // home in International Morse: dits and dahs on a soft keyed tone, panned far
  // to one side, in the parlor. Historical and interstellar at once. The same
  // mark run drives the keyed audio and the tape drawn on the page. No pitch.
  // ==========================================================================
  var MORSE = {
    A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".", F: "..-.", G: "--.",
    H: "....", I: "..", J: ".---", K: "-.-", L: ".-..", M: "--", N: "-.",
    O: "---", P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-", U: "..-",
    V: "...-", W: ".--", X: "-..-", Y: "-.--", Z: "--..",
  };
  // short messages a colony at the rim of Kolob might wire home — faith, place,
  // and the refrains of the pioneer hymn ("Come, Come, Ye Saints … all is well")
  var TELEGRAPH_WORDS = [
    "HOME", "ZION", "KOLOB", "AMEN", "DESERET", "SEGO", "GLORY", "GRACE",
    "LIGHT", "HOLY", "WEST", "SNOW", "SAFE", "SOON", "WELL", "HOPE", "DAWN",
    "PRAY", "SING", "STAR", "ALL IS WELL", "COME HOME", "GONE WEST",
    "HOME SOON", "O ZION",
  ];
  var TEL_DIT = 0.07;                                // one Morse unit, in seconds
  // Encode a word into a mark run: each mark is { dah, gap }, where gap is the
  // space AFTER it — 'i' intra-letter (1 unit), 'l' between letters (3), 'w'
  // between words (7), 'e' end (none). Both the audio and the tape read this.
  // Each mark also carries its timing: `at` (start offset from the message's
  // start, in seconds) and `len` (its own length). The tape uses these to key
  // itself out mark-by-mark in step with the sound.
  function telegraphMessage(word) {
    var chars = word.toUpperCase().split(""), seq = [], t = 0;
    for (var ci = 0; ci < chars.length; ci++) {
      var code = MORSE[chars[ci]];
      if (!code) continue;                            // spaces / unknowns → 'w' gaps below
      for (var mi = 0; mi < code.length; mi++) {
        var gap = "i";
        if (mi === code.length - 1) {                 // last element of this letter
          var rest = chars.slice(ci + 1).join("").replace(/[^A-Z]/g, "");
          gap = !rest ? "e" : (chars[ci + 1] === " " ? "w" : "l");
        }
        var dah = code.charAt(mi) === "-";
        var len = dah ? TEL_DIT * 3 : TEL_DIT;
        seq.push({ dah: dah, gap: gap, at: t, len: len });
        t += len + (gap === "e" ? 0 : gap === "w" ? TEL_DIT * 7 : gap === "l" ? TEL_DIT * 3 : TEL_DIT);
      }
    }
    return seq;
  }
  // Key a mark run as audio from time t, panned to `side`; returns the end time.
  function keyMorse(t, seq, side, peak) {
    var carrier = S.F0 * 8;
    while (carrier > 720) carrier /= 2;
    while (carrier < 480) carrier *= 2;
    var end = t;
    for (var i = 0; i < seq.length; i++) {
      var mt = t + seq[i].at, len = seq[i].len;
      var o = S.ctx.createOscillator();
      o.type = "square"; o.frequency.setValueAtTime(carrier, mt);
      var lp = S.ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(carrier * 2.5, mt);
      var g = S.ctx.createGain();
      o.connect(lp); lp.connect(g); g.connect(panAt("telegraph", side));
      env(g, mt, [[0.004, peak], [len, peak * 0.9], [0.02, 0]]);
      o.start(mt); o.stop(mt + len + 0.1);
      if (mt + len > end) end = mt + len;
    }
    return end;
  }
  function telegraphCycle() {
    if (!S.playing) return;
    var s = S.C.section;
    var taps = s === "prelude" || s === "hymn" || s === "testimony" || s === "postlude";
    if (!taps || chance(0.4)) { scheduleRaw(telegraphCycle, rnd(20, 40) * 1000); return; }
    var clack = getLayerParam("telegraph", "clack", 0.5);
    var t = S.ctx.currentTime + 0.1;
    var word = pick(TELEGRAPH_WORDS);
    var seq = telegraphMessage(word);
    if (!seq.length) { scheduleRaw(telegraphCycle, 15000); return; }
    var side = pick([-0.8, 0.8]);
    var tt = keyMorse(t, seq, side, 0.055);
    // the relay clack — the instrument's wooden body speaking
    if (chance(clack)) {
      var n = noiseSource();
      var nf = S.ctx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.setValueAtTime(rnd(1800, 2600), tt); nf.Q.setValueAtTime(5, tt);
      var ng = S.ctx.createGain();
      n.connect(nf); nf.connect(ng); ng.connect(panAt("telegraph", side));
      env(ng, tt, [[0.003, 0.04], [0.05, 0]]);
      n.start(tt, noiseOffset()); n.stop(tt + 0.12);
    }
    // once in a long while, a REPLY comes from home — the same word, fainter,
    // from the other side of the sky
    if (chance(0.1)) {
      tt = keyMorse(tt + rnd(1.5, 2.5), seq, -side, 0.033);
      emitEvent({ cat: "telegraph", label: "⌁ a reply from home", detail: word });
    }
    emitNote("telegraph", 0, t, tt - t, { marks: seq });
    emitEvent({ cat: "telegraph", label: "⌁ the wire flashes home", detail: word });
    scheduleLayer(telegraphCycle, (tt - t + rnd(45, 90) * gapMul()) * 1000, "telegraph");
  }

  // ==========================================================================
  // AMBIENT — the valley. Six far-field events, most of them nearly nothing:
  // wind off the benches, crickets after dark, the meetinghouse clock, a
  // tuning fork giving the pitch, a far bell, and the KOLOB BEACON — the
  // meeting's theme flashed home as light-Morse behind a narrow static.
  // ==========================================================================
  function evWind(t) {
    var dur = rnd(12, 24);
    var n = noiseSource();
    var f = S.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(rnd(260, 520), t);
    var g = S.ctx.createGain();
    n.connect(f); f.connect(g); g.connect(fieldDest("wind", rnd(-0.5, 0.5)));
    env(g, t, [[dur * 0.45, 0.055], [dur * 0.55, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.3);
    emitNote("ambient", 0, t, dur);
    return "wind off the benches";
  }
  function evCrickets(t) {
    if (intensity() > 0.5) return evWind(t);                   // crickets keep still when the hall is full
    var span = rnd(4, 9);
    var f = rnd(4200, 4800);
    var period = rnd(0.38, 0.5);
    var tt = t;
    while (tt < t + span) {
      for (var c = 0; c < 2; c++) {                            // the paired chirp
        var o = S.ctx.createOscillator();
        o.type = "sine"; o.frequency.setValueAtTime(f, tt + c * 0.045);
        var g = S.ctx.createGain();
        o.connect(g); g.connect(fieldDest("crickets", 0.5));
        env(g, tt + c * 0.045, [[0.004, 0.016], [0.035, 0]]);
        o.start(tt + c * 0.045); o.stop(tt + c * 0.045 + 0.08);
      }
      tt += period * rnd(0.9, 1.15);
    }
    emitNote("ambient", 0, t, span);
    return "crickets";
  }
  function evClock(t) {
    var ticks = rint(4, 8);
    for (var i = 0; i < ticks; i++) {
      var tt = t + i * rnd(0.96, 1.04);
      var o = S.ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(i % 2 ? 430 : 480, tt);
      var g = S.ctx.createGain();
      o.connect(g); g.connect(fieldDest("clock", -0.55));
      env(g, tt, [[0.002, 0.03], [0.06, 0]]);
      o.start(tt); o.stop(tt + 0.12);
    }
    emitNote("ambient", 0, t, ticks);
    return "the meetinghouse clock";
  }
  function evTuningFork(t) {
    var f = harm(8);
    while (f > 900) f /= 2;
    var o = S.ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    var g = S.ctx.createGain();
    o.connect(g); g.connect(fieldDest("fork", 0));
    env(g, t, [[0.01, 0.05], [rnd(6, 10), 0]]);
    o.start(t); o.stop(t + 11);
    emitNote("ambient", f, t, 8);
    return "a tuning fork, giving the pitch";
  }
  function evFarBell(t) {
    var base = harm(pick([4, 5]));
    while (base > 520) base /= 2;
    var ratios = [1, 2.0, 2.76];
    for (var i = 0; i < ratios.length; i++) {
      var o = S.ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(base * ratios[i] + (i ? rnd(0.3, 1.4) : 0), t);
      var g = S.ctx.createGain();
      o.connect(g); g.connect(fieldDest("bell", pick([-0.6, 0.6])));
      env(g, t, [[0.02, 0.035 / (1 + i * 0.8)], [rnd(6, 11) / (1 + i * 0.5), 0]]);
      o.start(t); o.stop(t + 12);
    }
    emitNote("ambient", base, t, 8);
    return "a bell across the valley";
  }
  function evBeacon(t) {
    // the colony flashes the day's theme toward home — sine Morse behind a
    // narrow-band static that is not quite there
    var theme = S.Motif.theme();
    var head = theme ? theme.notes.slice(0, rint(3, 5)) : [{ deg: 0, durBeats: 1 }, { deg: 4, durBeats: 2 }];
    var side = pick([-0.7, 0.7]);
    var st = noiseSource();
    var sf = S.ctx.createBiquadFilter();
    sf.type = "bandpass"; sf.frequency.setValueAtTime(rnd(950, 1200), t); sf.Q.setValueAtTime(14, t);
    var sg = S.ctx.createGain();
    st.connect(sf); sf.connect(sg); sg.connect(fieldDest("beacon", side));
    var span = head.length * 0.5 + 1.5;
    // The beacon is quiet by design — it rides the shared ambient layer (gain
    // 0.5) and is washed into the tabernacle reverb, so it reads as far-off.
    // No hidden cap here (unlike the voice): these envelope values ARE the
    // source gain. Pushed hard by owner request, weighting the Morse tones
    // (the signal) over the static bed (the hiss) so it carries without the
    // hiss swelling.
    env(sg, t, [[0.4, 0.05], [span, 0.041], [0.6, 0]]);
    st.start(t, noiseOffset()); st.stop(t + span + 1.2);
    var tt = t + 0.5;
    for (var i = 0; i < head.length; i++) {
      var f = degFreq(projDeg(head[i].deg));
      while (f > 1000) f /= 2;
      while (f < 600) f *= 2;
      var isDah = head[i].durBeats >= 1;
      var o = S.ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(f, tt);
      var g = S.ctx.createGain();
      o.connect(g); g.connect(fieldDest("beacon", side));
      env(g, tt, [[0.01, 0.15], [isDah ? 0.3 : 0.1, 0.127], [0.05, 0]]);
      o.start(tt); o.stop(tt + 0.6);
      emitNote("ambient", f, tt, isDah ? 0.35 : 0.15);
      tt += (isDah ? 0.42 : 0.22) + rnd(0.05, 0.12);
    }
    return "the Kolob beacon";
  }
  // rain on the roof — a rare visitor; the patter is an LFO on lowpassed noise
  function evRain(t) {
    var dur = rnd(8, 16);
    var n = noiseSource();
    var f = S.ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(rnd(900, 1400), t);
    var patter = S.ctx.createGain();
    patter.gain.setValueAtTime(0.7, t);
    var lfo = S.ctx.createOscillator(); lfo.frequency.setValueAtTime(rnd(0.5, 1), t);
    var lg = S.ctx.createGain(); lg.gain.setValueAtTime(0.3, t);
    lfo.connect(lg); lg.connect(patter.gain);
    var g = S.ctx.createGain();
    n.connect(f); f.connect(patter); patter.connect(g); g.connect(fieldDest("rain", 0));
    env(g, t, [[dur * 0.35, 0.04], [dur * 0.65, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.3);
    lfo.start(t); lfo.stop(t + dur + 0.3);
    emitNote("ambient", 0, t, dur);
    return "rain on the roof";
  }
  // a far coyote — a falling fifth, very quiet, once in a great while
  function evCoyote(t) {
    var f = harm(6);
    while (f > 700) f /= 2;
    while (f < 380) f *= 2;
    var o = S.ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.linearRampToValueAtTime(f * 1.5, t + 0.25);
    o.frequency.linearRampToValueAtTime(f, t + rnd(1.2, 1.8));
    var g = S.ctx.createGain();
    o.connect(g); g.connect(fieldDest("coyote", pick([-0.7, 0.7])));
    env(g, t, [[0.2, 0.02], [1.2, 0.014], [0.5, 0]]);
    o.start(t); o.stop(t + 2.4);
    emitNote("ambient", 0, t, 2);                              // a gliss owns no single pitch
    return "a far coyote";
  }
  var FIELD_FNS = { wind: evWind, crickets: evCrickets, clock: evClock, fork: evTuningFork, rain: evRain, coyote: evCoyote, bell: evFarBell, beacon: evBeacon };
  function ambientEvent() {
    if (!S.playing) return;
    var s = S.C.section;
    if (s === "sacrament") { scheduleRaw(ambientEvent, 9000); return; }
    var pool = s === "invocation"
      ? [[evWind, 4], [evCrickets, 3], [evTuningFork, 2]]
      : [[evWind, 4], [evCrickets, 3], [evClock, 3], [evTuningFork, 2], [evFarBell, 3], [evBeacon, 2.5], [evRain, 0.3], [evCoyote, 0.3]];
    var fn = pickW(pool);
    var name = fn(S.ctx.currentTime + 0.1);
    emitEvent({ cat: "ambient", label: "⋆ " + name, detail: s });
    var gap = rnd(25, 70) * (1.15 - intensity() * 0.35) * silenceMul();
    scheduleLayer(ambientEvent, gap * 1000, "ambient");
  }

  // ==========================================================================
  // LENT — what this room shares with the rest of the house (KOLOB._s)
  // ==========================================================================
  S.stillVoiceRender = stillVoiceRender;
  S.stillVoicePhrase = stillVoicePhrase;
  S.TELEGRAPH_WORDS = TELEGRAPH_WORDS;
  S.telegraphMessage = telegraphMessage;
  S.keyMorse = keyMorse;
  S.telegraphCycle = telegraphCycle;
  S.evTuningFork = evTuningFork;
  S.evFarBell = evFarBell;
  S.FIELD_FNS = FIELD_FNS;
  S.ambientEvent = ambientEvent;
})();

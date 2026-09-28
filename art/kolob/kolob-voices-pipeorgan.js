// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE ORGAN (a registrable pipe organ; KOLOB.VoicesOrgan)
//
// The tabernacle organ at the rim of Kolob's light: a frontier instrument,
// built by the colony's own joiners from the one set of plans that came up
// in the hold — two manuals, a pedal, and seven stops, which is all a
// meetinghouse ever needed:
//
//   Principal 8′   the diapason: the organ's own voice, round and singing
//   Flute 8′       a stopped wood flute: hollow, gentle, a little breath
//   Flute 4′       the same flute an octave up: light on the water
//   Vox Humana 8′  a short-resonator reed that almost sings, drawn with the
//                  TREMULANT (every Victorian ward had one; every organist
//                  was told not to overdo it; every organist did)
//   Trumpet 8′     the chorus reed: gold, not brass — the hymn's last verse
//   Mixture II–III the upper work, pure harmonics 12th/15th/19th: the
//                  daylight in the full organ; it BREAKS back an octave in
//                  the treble, as real mixtures do, so it never screams
//   Bourdon 16′    the pedal: a stopped pipe, odd harmonics only, the floor
//
// Behind them, a SWELL BOX: the shutters close (filter down, level down) and
// open (the room floods). And a WIND SYSTEM that can be felt: a big chord on
// full organ drops the pressure for an instant — pitch sags a few cents, the
// level dips, then the reservoir catches up. Nothing here is perfect; that
// is what makes it a place.
//
// Synthesis, frugally (SCORE §1 — ctx, destination, scheduled t; never reads
// ctx.currentTime to decide when anything happens):
//  · Every flue rank is an exact harmonic of the pipe it doubles, and the
//    frequencies arrive already in just intonation — so the whole flue
//    registration of one key folds into TWO PeriodicWaves: the foundation
//    (8′ ranks) and the upper work (4′ + mixture), a hair apart in tuning so
//    the ranks drift in and out of phase the way separate pipes do. One key
//    of full organ is two flue oscillators, one reed, one gain each — not a
//    rank per oscillator.
//  · CHIFF: a flue pipe speaks with a breath before the tone settles — the
//    pipe briefly overblowing. An open pipe (the principal) spits at its
//    octave; a stopped pipe (the wood flutes, the bourdon) at its twelfth,
//    since a stopped pipe has no even harmonics to overblow to. It is a short
//    band of the shared noise buffer, 20–50 ms long, about 25 dB under the
//    tone: heard as the pipe's consonant, never as a hiss. Flutes chiff more
//    than principals; reeds do not chiff at all. And only a pipe that speaks
//    out of silence is heard to spit: played legato, its breath is masked
//    (round 3 — see CHIFF_LEGATO. The old chiff, full on every key of every
//    chord, was one of the things under the owner's "breath, or brushing
//    sound, in between the notes when the hymns are being sung"; the larger
//    one, in the labs, was the ward's own breath — VoicesVocal's, the CAST
//    crew's to mend, and mended on their branch).
//  · THE TOUCH (round 3): one pipe per key. A note that lands on a key
//    already down — truly down, well past the new note's start (a unison
//    between parts, a common tone held across a chord) — holds that key on;
//    it never speaks a second pipe over the first. A repeated note that only
//    ABUTS the one before it (a part handed over note by note, onset to
//    onset) is struck again, after a short lift the organ takes for the
//    player (AUTO_LIFT): a ward's repeated notes are re-struck.
//  · C and C♯ SIDES: pipes stand on two chests, left and right, alternating
//    by semitone — so a line walks gently across the case. Two panners for
//    the whole organ, not one per note.
//  · Just intonation is the caller's: every frequency passed in is sounded
//    exactly (plus the wind's few cents, and the tremulant's).
//  · Pitch automation (the wind, the tremulant) is read once per 128-sample
//    block (k-rate): the wind moves over tens of milliseconds, so nothing is
//    lost, and every pipe stays on the oscillator's fast path.
//
// LEVEL. At opts.gain 1, "hymn principal" leaves the organ at the level the
// v0.30 organChord left it in the prelude (gainMul ≈ 0.51, before the organ
// layer's volume): the same loudest-3-seconds loudness through the app's
// chain, −21.2 LUFS in the lab's tabernacle. So the new organ drops into the
// organ layer where the old one sat, at gain 1. Against it (loudest 3 s):
// quiet flute −7 LU, flutes 8 & 4 and vox humana −5, trumpet −2.6, full
// organ +3 — with the brightness of the mixture and the reed on top.
//
// Cost (reported by stats(), counted from the nodes actually built): 13
// standing nodes per organ (12 without ConstantSource). Per manual key: a
// gain, one or two flue oscillators and 3 for the chiff (5–6); each reed adds
// 2 — so 5 (one flute) to 8 (full organ). A pedal note is 5. A four-part hymn
// chord on full organ with pedal is 37 short-lived nodes.
//
// Public surface: KOLOB.VoicesOrgan.create(ctx, destination, opts) → organ
//   opts: { gain (1), swell (0.8), wind (0–1, 1 = the default sag; 0 steady),
//           rand (a PJ2.Rand stream, "synth:organ") | seed, t0,
//           chiff (1: the breath's size; 0 none — a lab's A/B), legatoChiff }
//   organ.play(t, notes, registration, {texture, trem})
//                                    notes: [{f, dur, at?, v?, pedal?, pedalOnly?}]
//     texture: the voices the music carries — fixes the level law for the
//     call, so a voice moving alone is no louder than its chord
//     trem: false leaves the tremulant as it stands (a phrase laid in
//     pieces: only its first piece draws the tremulant, at the phrase's t)
//   organ.chord(t, freqs, dur, registration, {pedal: true, v})
//   organ.setSwell(expression 0..1, t, rampS)
//   organ.dispose(t)                 the tremulant's motor and the wind stop at t
//   organ.stats() → { standing, created, peakLive, until }   (kept as it goes)
//   KOLOB.VoicesOrgan.REGISTRATIONS (frozen) / STOPS / resolve(registration) / CHIFF
//     resolve() always returns a fresh object; an unknown name, or a stop
//     misspelt in an object, warns once (a name draws "hymn principal").
//
// Round 3 (the organist's crew): the reed's release no longer snaps (the
// anchor that cut a blooming trumpet down 3–13 % in one sample on short
// notes is gone); the touch; the legato chiff; dispose(); stats kept as they
// go; the misspelt-stop warning; texture. The organist (kolob-organist.js)
// plays this organ; organist-lab.php hears and measures it. Its round 2: an
// abutting repeat is re-struck (the auto-lift), not tied — hymn-lab hands
// its parts over onset to onset, and the first touch had quietly tied a
// tenth of the tunes' notes and more than a quarter of the inner voices';
// and play(…, {trem: false}), so a long phrase can be laid in pieces.
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.VoicesOrgan = (function () {
  "use strict";

  // ---- the stops: harmonic recipes relative to the KEY's 8′ pitch --------
  // Each entry is [harmonic, amplitude]. A 4′ rank's pipes speak an octave
  // up, so its harmonics are the 8′'s even ones; the mixture's ranks are the
  // 3rd, 4th and 6th harmonics (12th, 15th, 19th), each with a whisper of
  // its own octave. `level` is the stop's loudness in the whole; `chiff` its
  // speech; `upper` puts the rank on the second (upper-work) oscillator.
  var STOPS = {
    principal8: { level: 0.44, chiff: 0.9,  upper: false, harm: [[1, 1], [2, 0.6], [3, 0.4], [4, 0.28], [5, 0.18], [6, 0.12], [7, 0.08], [8, 0.06], [9, 0.04], [10, 0.03], [11, 0.02], [12, 0.015]] },
    flute8:     { level: 0.55, chiff: 1.0,  upper: false, harm: [[1, 1], [2, 0.05], [3, 0.2], [4, 0.02], [5, 0.055], [7, 0.018]] },
    flute4:     { level: 0.32, chiff: 0.8,  upper: true,  harm: [[2, 1], [4, 0.05], [6, 0.18], [10, 0.04]] },
    mixture:    { level: 0.24, chiff: 0.35, upper: true,  harm: [[3, 0.9], [4, 1], [6, 0.8], [8, 0.35], [12, 0.18]] },
    bourdon16:  { level: 0.30, chiff: 0.5,  upper: false, harm: [[1, 1], [3, 0.22], [5, 0.07], [7, 0.025]] },  // sounded an octave under the pedal key
    vox8:       { level: 0.54, reed: "vox" },
    trumpet8:   { level: 0.60, reed: "trumpet" },
  };

  // Named registrations — the organist's shorthand. Values are stop levels
  // (0–1); `trem` is the tremulant's depth; `swell` a suggested expression.
  // Frozen: a caller who wants a variant passes its own {stop: level} object.
  var REGISTRATIONS = {
    "quiet flute":    { flute8: 1, trem: 0, swell: 0.55 },
    "flutes 8 & 4":   { flute8: 0.9, flute4: 0.8, trem: 0, swell: 0.7 },
    "hymn principal": { principal8: 1, flute8: 0.5, flute4: 0.35, bourdon16: 0.8, trem: 0, swell: 0.85 },
    "vox humana":     { vox8: 1, flute8: 0.55, trem: 1, swell: 0.6 },
    "trumpet":        { trumpet8: 1, flute8: 0.35, bourdon16: 0.5, trem: 0, swell: 0.85 },
    "full organ":     { principal8: 1, flute8: 0.6, flute4: 0.7, mixture: 1, trumpet8: 0.8, bourdon16: 1, trem: 0, swell: 1 },
  };
  if (Object.freeze) { for (var rn in REGISTRATIONS) Object.freeze(REGISTRATIONS[rn]); Object.freeze(REGISTRATIONS); }

  // a wrong name should be heard about once, not four hundred times a hymn
  var warned = {};
  function warnOnce(key, msg) {
    if (warned[key]) return;
    warned[key] = true;
    if (window.console && console.warn) console.warn(msg);
  }
  // resolve(name | [stop, …] | {stop: level}) → a FRESH {stop: level, trem}
  // (never the table's own entry, so nobody's edit can leak into it)
  function resolve(reg) {
    var src = reg || "hymn principal";
    if (typeof src === "string") {
      var named = REGISTRATIONS[src] || REGISTRATIONS[src.trim().toLowerCase()];
      if (!named) {
        warnOnce("reg:" + src, "KOLOB.VoicesOrgan: no registration named “" + src + "” — drawing hymn principal");
        named = REGISTRATIONS["hymn principal"];
      }
      src = named;
    }
    var o = { trem: 0 };
    if (Object.prototype.toString.call(src) === "[object Array]") {
      src.forEach(function (s) {
        if (s === "tremulant") o.trem = 1;
        else if (STOPS[s]) o[s] = 1;
        else warnOnce("stop:" + s, "KOLOB.VoicesOrgan: no stop named “" + s + "” — ignored");
      });
      return o;
    }
    // an object's keys are stops, or the two words a registration may carry;
    // a misspelt stop ({principle8: 1}) is named once, not played as silence
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) {
      if (!STOPS[k] && k !== "trem" && k !== "swell") warnOnce("stop:" + k, "KOLOB.VoicesOrgan: no stop named “" + k + "” — ignored");
      o[k] = src[k];
    }
    return o;
  }
  function sigOf(reg, keys) { return keys.map(function (k) { return k + (reg[k] || 0).toFixed(2); }).join(","); }

  // ---- sound-level randomness (never the music's) -------------------------
  function mulberry(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function streamOf(opts) {
    if (opts.rand && opts.rand.rnd) return opts.rand;
    var next = (window.PJ2 && PJ2.Rand) ? PJ2.Rand.stream(opts.seed || 1847).fork("synth:organ").next : mulberry(opts.seed || 1847);
    return { rnd: function (a, b) { return a + next() * (b - a); }, chance: function (p) { return next() < p; } };
  }
  // one shared noise buffer per AudioContext (texture, not music: unseeded
  // content is fine, and it is the same two seconds for every voice file)
  var NOISE = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function noiseBuf(ctx) {
    var b = NOISE && NOISE.get(ctx);
    if (b) return b;
    var n = Math.floor(ctx.sampleRate * 2), r = mulberry(0x5eed);
    b = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = r() * 2 - 1;
    if (NOISE) NOISE.set(ctx, b);
    return b;
  }

  // one key's level at v = 1. Calibrated (lab: instruments-lab.php, "level
  // reference") so that at opts.gain 1 "hymn principal" is as loud as the
  // v0.30 organChord in the prelude — gainMul ≈ 0.51, linear envelope, both
  // measured before the organ layer's volume. The new organ is a drop-in for
  // the old one's layer, not a louder instrument in its chair.
  var KEY_LEVEL = 0.0695;
  // the chiff's level against a key, and its time constants (s): a flue
  // pipe's consonant is 20–50 ms long and ~25 dB under the tone it starts
  // (round 3: 1.0 → 0.55, −5 dB — one part of the owner's "breath between
  // the notes"; the ward's own breath was the larger, in the labs)
  var CHIFF_LEVEL = 0.55;
  // …but only a pipe that speaks OUT OF SILENCE is heard to spit. Played
  // legato — another key still down, or let go a moment ago — the wind is
  // already moving in the chest and the new pipe's breath is masked by the
  // ones sounding; it speaks almost clean. Round 3: under a hymn, every
  // moving part used to cough at full strength on every beat — at the joins
  // about 1 dB over the flutes' own treble, one of the things under the
  // owner's "breath, or a brushing sound, in between the notes when the
  // hymns are being sung" (the ward's breath, 4–12 dB louder still, was the
  // other, and the larger: see handoff/r3-organist-1.md, round 2). The
  // legato attack keeps a fifth of it
  // (−14 dB); the first chord out of real silence keeps it all. A quarter
  // second of lift — the ward's breath at a line's end — is not silence:
  // the wind is still up in the chest, and the next chord speaks legato.
  var CHIFF_LEGATO = 0.2;
  var LEGATO_S = 0.25;                 // a key let go this recently still counts as "down"
  // THE AUTO-LIFT (round 3, round 2). A key already sounding counts as held
  // for a new note on it only if it stays down more than OVERLAP_S past the
  // new note's start (a true overlap: a unison, a tone common to two
  // chords). One that merely abuts — let go at the new note's start, give or
  // take — is lifted AUTO_LIFT early (never more than a third of its
  // length) and struck again, its release quickened to LIFT_TAU so the new
  // pipe speaks into near-silence rather than over its own tail.
  var OVERLAP_S = 0.02, AUTO_LIFT = 0.05, LIFT_TAU = 0.018;

  // ---- create -------------------------------------------------------------
  function create(ctx, destination, opts) {
    opts = opts || {};
    var R = streamOf(opts);
    var created = 0, standing = 0;
    // the stats are kept as they go (round 3): the spans still sounding, the
    // peak and the last stop — so a meeting-long instance never sorts an
    // ever-growing history on every stats() call (wave-1 open issue)
    var live = [], liveN = 0, peakN = 0, untilT = 0;
    function count(n, t0, t1) {
      created += n;
      if (t1 > untilT) untilT = t1;
      // plays arrive in (nearly) time order: what ended before this one
      // began has left the case
      live = live.filter(function (s) { if (s[0] > t0) return true; liveN -= s[1]; return false; });
      live.push([t1, n]); liveN += n;
      if (liveN > peakN) peakN = liveN;
    }
    var t0 = opts.t0 != null ? opts.t0 : 0;           // when the standing nodes wake (scheduled, not read)
    // the breath's size (a lab's A/B: 0 is no chiff at all), and how much of
    // it a legato key keeps
    var chiffMul = opts.chiff != null ? Math.max(0, opts.chiff) : 1;
    var legatoChiff = opts.legatoChiff != null ? opts.legatoChiff : CHIFF_LEGATO;
    var windDepth = opts.wind != null ? Math.max(0, opts.wind) : 1;

    // standing graph:  sideL/sideR → manual → trem → windGain → swellLP → swellGain → out
    //                  pedalBus ──────────────────────────────────────────────────→ out
    // (the pedal is unenclosed: it stands behind the case, past the shutters)
    var out = ctx.createGain(); out.gain.value = opts.gain != null ? opts.gain : 1;
    out.connect(destination);
    var swellGain = ctx.createGain(); swellGain.connect(out);
    var swellLP = ctx.createBiquadFilter(); swellLP.type = "lowpass"; swellLP.Q.value = 0.5; swellLP.connect(swellGain);
    var windGain = ctx.createGain(); windGain.gain.value = 1; windGain.connect(swellLP);
    var pedalBus = ctx.createGain(); pedalBus.gain.value = 1; pedalBus.connect(out);
    var trem = ctx.createGain(); trem.gain.value = 1; trem.connect(windGain);
    var manual = ctx.createGain(); manual.gain.value = 1; manual.connect(trem);
    var sides = [-0.32, 0.32].map(function (p) {
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.value = p;
      sp.connect(manual);
      return sp;
    });
    // the wind: a ConstantSource summed into the detune (cents) of every pipe
    // on a registration big enough to draw it down
    var wind = null;
    if (ctx.createConstantSource && windDepth > 0) { wind = ctx.createConstantSource(); wind.offset.value = 0; wind.start(t0); }
    // the tremulant: one LFO; its depth lives on two gains (amplitude, pitch)
    var tremLfo = ctx.createOscillator(); tremLfo.frequency.value = R.rnd(5.4, 6.1);
    var tremAmp = ctx.createGain(); tremAmp.gain.value = 0;
    var tremPitch = ctx.createGain(); tremPitch.gain.value = 0;
    tremLfo.connect(tremAmp); tremAmp.connect(trem.gain);
    tremLfo.connect(tremPitch);
    tremLfo.start(t0);
    // out, swellGain, swellLP, windGain, pedalBus, trem, manual, 2 sides,
    // tremLfo, tremAmp, tremPitch — and the wind, when there is one
    standing = 12 + (wind ? 1 : 0);

    var swellNow = opts.swell != null ? opts.swell : 0.8;
    function swellCut(e) { return 650 * Math.pow(2, e * 4.3); }   // ≈ 650 Hz shut … 13 kHz open
    function swellLevel(e) { return 0.32 + 0.68 * Math.pow(e, 1.3); }
    swellLP.frequency.value = swellCut(swellNow);
    swellGain.gain.value = swellLevel(swellNow);
    function setSwell(e, t, rampS) {
      e = Math.max(0, Math.min(1, e)); swellNow = e;
      var tau = Math.max(0.02, (rampS == null ? 0.4 : rampS) / 3);
      swellLP.frequency.setTargetAtTime(swellCut(e), t, tau);
      swellGain.gain.setTargetAtTime(swellLevel(e), t, tau);
    }

    // ---- wave tables, cached by registration × quarter-octave band ------
    var waveCache = {};
    function makeWave(pairs) {                       // pairs: {harmonic: amp}
      var top = 1; for (var h in pairs) top = Math.max(top, +h);
      var real = new Float32Array(top + 1), imag = new Float32Array(top + 1);
      for (var k in pairs) imag[+k] = pairs[k];
      try { return ctx.createPeriodicWave(real, imag, { disableNormalization: true }); }
      catch (e) { return ctx.createPeriodicWave(real, imag); }
    }
    function addHarm(acc, h, a, fKey, ceil) {
      var hz = h * fKey;
      if (hz > ceil) return;
      var roll = hz > 5000 ? Math.pow(5000 / hz, 1.5) : 1;       // voicing: the treble is regulated gently
      acc[h] = (acc[h] || 0) + a * roll;
    }
    // flue waves for one key: {found, upper, chiff}
    function flueWaves(reg, fKey) {
      var band = Math.round(Math.log(fKey) / Math.LN2 * 4);
      var key = sigOf(reg, ["principal8", "flute8", "flute4", "mixture"]) + "|" + band;
      if (waveCache[key]) return waveCache[key];
      var found = {}, upper = {}, gF = 0, gU = 0, chiff = 0, fb = Math.pow(2, band / 4);
      ["principal8", "flute8", "flute4", "mixture"].forEach(function (s) {
        var lv = reg[s] || 0; if (lv <= 0) return;
        var st = STOPS[s], acc = st.upper ? upper : found;
        st.harm.forEach(function (p) {
          var h = p[0];
          // the mixture breaks back: ranks that would sound above ~4.2 kHz
          // drop an octave (and above c‴ the 12th drops out entirely)
          if (s === "mixture") { while (h * fb > 4200 && h % 2 === 0) h /= 2; if (h * fb > 4200) return; }
          addHarm(acc, h, p[1] * lv * st.level, fb, 11000);
        });
        if (st.upper) gU += lv * st.level; else gF += lv * st.level;
        chiff += lv * st.chiff * st.level;
      });
      var w = {
        found: gF > 0 ? makeWave(found) : null, upper: gU > 0 ? makeWave(upper) : null,
        chiff: chiff,
      };
      waveCache[key] = w;
      return w;
    }
    // reed waves: brassy trumpet (formant ~1.6–2.6 kHz), vocal vox humana
    // (formants ~600 and ~1150 Hz, the short resonator's nasal "aw")
    function reedWave(kind, fKey) {
      var band = Math.round(Math.log(fKey) / Math.LN2 * 4);
      var key = kind + "|" + band;
      if (waveCache[key]) return waveCache[key];
      var fb = Math.pow(2, band / 4), acc = {};
      for (var h = 1; h <= 40; h++) {
        var hz = h * fb; if (hz > 9000) break;
        var a;
        if (kind === "trumpet") {
          a = Math.pow(h, -0.75) * (1 + 1.4 * Math.exp(-Math.pow((hz - 2000) / 900, 2)));
          if (hz > 4200) a *= Math.pow(4200 / hz, 2);
        } else {
          a = Math.pow(h, -0.55) * (0.35 + Math.exp(-Math.pow((hz - 620) / 260, 2)) + 0.7 * Math.exp(-Math.pow((hz - 1150) / 320, 2)));
          if (hz > 2600) a *= Math.pow(2600 / hz, 2.2);
        }
        acc[h] = a;
      }
      // normalise the reed to unit-ish RMS so stop levels mean something
      var ss = 0; for (var k in acc) ss += acc[k] * acc[k];
      var nrm = 1 / Math.sqrt(ss * 2) * 0.9;
      for (var k2 in acc) acc[k2] *= nrm;
      waveCache[key] = makeWave(acc);
      return waveCache[key];
    }

    // pitch params are read once a block: the wind and the tremulant move over
    // tens of milliseconds, and a k-rate pipe keeps the oscillator's fast path
    function kRate(p) { try { p.automationRate = "k-rate"; } catch (e) {} }
    // one voiced oscillator, wired to the wind (when this registration can
    // draw it down) and to the tremulant (when drawn). Its param links are
    // cut when it ends, so a long meeting never leaves the wind holding ten
    // thousand dead pipes.
    function pipeOsc(wave, f, t, tEnd, dest, tremOn, windOn) {
      var o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      kRate(o.frequency); kRate(o.detune);
      o.frequency.setValueAtTime(f, t);
      windOn = windOn && wind;
      if (windOn) wind.connect(o.detune);
      if (tremOn) tremPitch.connect(o.detune);
      o.connect(dest);
      if (windOn || tremOn) o.onended = function () {
        try { if (windOn) wind.disconnect(o.detune); } catch (e) {}
        try { if (tremOn) tremPitch.disconnect(o.detune); } catch (e2) {}
      };
      o.start(t); o.stop(tEnd);
      return o;
    }
    function sideOf(f) { return sides[((Math.round(12 * Math.log(f / 16.3516) / Math.LN2) % 2) + 2) % 2]; }

    // chiff: the pipe overblowing for an instant — a band of breath at the
    // harmonic it would jump to (the octave for an open pipe, the twelfth
    // for a stopped one), broad enough to read as breath, pitched enough to
    // read as the pipe's own
    function chiff(t, f, amt, dest, harmonic, tau) {
      var off = R.rnd(0, 1.7);                     // thrown every time, so a lab's A/B stays aligned
      amt *= chiffMul;
      if (amt < 0.004) return 0;
      var fc = Math.min(4800, Math.max(500, f * harmonic));
      // a constant-Q band passes more noise the higher it sits; level it so
      // the breath is the same size against the tone up and down the compass
      amt *= Math.sqrt(780 / fc);
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.value = fc; bp.Q.value = 1.4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amt, t + 0.006);
      g.gain.setTargetAtTime(0, t + 0.014, tau);
      src.connect(bp); bp.connect(g); g.connect(dest);
      src.start(t, off); src.stop(t + 0.014 + tau * 8);
      return 3;
    }
    // a pipe's gain envelope: speech, hold, release (never a step). The
    // release is a setTarget from WHEREVER the gain stands when it begins:
    // no anchor. (Round 3 — the wave-1 critic's reed click: the old anchor,
    // setValueAtTime(lv, rel), snapped a reed that was still blooming down to
    // its level, 3–13 % in one sample, on every note shorter than ~0.12 s —
    // up to 27 dB of spray above 4 kHz on the trumpet. The bloom's own
    // setTarget now runs on until the release takes over from its value.)
    function envelope(g, t, atk, lv, rel, tau, over) {
      g.gain.setValueAtTime(0, t);
      if (over) {                                   // reeds speak with a small bloom
        g.gain.linearRampToValueAtTime(lv * over, t + atk);
        g.gain.setTargetAtTime(lv, t + atk, 0.05);
      } else g.gain.linearRampToValueAtTime(lv, t + atk);
      var r = Math.max(t + atk + 0.01, rel);
      g.gain.setTargetAtTime(0, r, tau);
      return { g: g, rel: r, tau: tau, min: t + atk + 0.01 };
    }
    // a key held longer than first written (the same key struck again while
    // it is still down: the finger simply stays): the release moves, the
    // pipes play on. Oscillators accept a later stop() until they have ended.
    function holdLonger(k, rel) {
      k.envs.forEach(function (e) {
        e.g.gain.cancelScheduledValues(e.rel);
        e.g.gain.setTargetAtTime(0, rel, e.tau);
        e.rel = rel;
      });
      k.oscs.forEach(function (o) { try { o.stop(rel + 0.4); } catch (x) {} });
      k.rel = rel;
    }
    // …and the other way: a key let go a little EARLIER than written (the
    // auto-lift before a re-strike). Its release is moved up, never into its
    // own speech, and quickened; the oscillators run out as they were.
    function liftEarlier(k, rel) {
      k.envs.forEach(function (e) {
        var r = Math.max(e.min, rel);
        if (r >= e.rel) return;
        e.g.gain.cancelScheduledValues(r);
        e.g.gain.setTargetAtTime(0, r, LIFT_TAU);
        e.rel = r; e.tau = LIFT_TAU;
      });
      k.rel = Math.min(k.rel, rel);
    }

    // one key at 8′ pitch f — every drawn stop on it. → the key's record
    // { n (nodes built), envs, oscs, rel } (the touch below may hold it longer)
    function key(t, f, dur, reg, v, pedal, windOn, legato) {
      var n = 0, rel = t + dur, tEnd = rel + 0.4, envs = [], oscs = [];
      var ck = legato ? legatoChiff : 1;             // the breath: out of silence, or masked
      if (pedal) {
        var bl = reg.bourdon16 || 0; if (bl <= 0) return null;
        var fp = f / 2 >= 38 ? f / 2 : f;           // the 16′ an octave under, unless that is below the floor
        if (!waveCache.bourdon) {
          var acc = {}; STOPS.bourdon16.harm.forEach(function (p) { acc[p[0]] = p[1]; });
          waveCache.bourdon = makeWave(acc);
        }
        var gp = ctx.createGain(); gp.connect(pedalBus);
        oscs.push(pipeOsc(waveCache.bourdon, fp, t, tEnd, gp, false, windOn));
        envs.push(envelope(gp, t, 0.07, KEY_LEVEL * bl * STOPS.bourdon16.level * v, rel, 0.06));
        // the stopped 16′ coughs at its twelfth, softly — a big pipe's breath
        n += 2 + chiff(t, fp, ck * 0.35 * CHIFF_LEVEL * KEY_LEVEL * bl * STOPS.bourdon16.chiff * v, pedalBus, 3, 0.03);
        count(n, t, tEnd);
        return { n: n, envs: envs, oscs: oscs, rel: envs[0].rel };
      }
      var tremOn = (reg.trem || 0) > 0.02;
      var dest = sideOf(f);
      // pipe speech: ~25 ms in the treble … ~60 ms in the bass
      var atk = Math.min(0.06, Math.max(0.022, 0.034 * Math.pow(262 / f, 0.4)));
      var w = flueWaves(reg, f);
      if (w.found || w.upper) {
        var g = ctx.createGain(); g.connect(dest); n++;
        if (w.found) { oscs.push(pipeOsc(w.found, f, t, tEnd, g, tremOn, windOn)); n++; }
        if (w.upper) { oscs.push(pipeOsc(w.upper, f * (1 + R.rnd(0.0003, 0.0008)), t, tEnd, g, tremOn, windOn)); n++; }
        envs.push(envelope(g, t, atk, KEY_LEVEL * v, rel, 0.035));
        // open pipes (the principal) spit at the octave, stopped flutes at
        // the twelfth, and a little longer; a reed drawn over them masks the
        // breath, so it thins under the trumpet
        var open = (reg.principal8 || 0) > 0;
        var ch = w.chiff * (1 - 0.6 * Math.min(1, reg.trumpet8 || 0)) * (open ? 1 : 1.4);
        n += chiff(t, f, ck * CHIFF_LEVEL * KEY_LEVEL * ch * v, dest, open ? 2 : 3, open ? 0.016 : 0.022);
      }
      ["trumpet8", "vox8"].forEach(function (s) {
        var lv = reg[s] || 0; if (lv <= 0) return;
        var kind = STOPS[s].reed;
        var gr = ctx.createGain(); gr.connect(dest);
        oscs.push(pipeOsc(reedWave(kind, f), f, t, tEnd, gr, tremOn, windOn));
        envs.push(envelope(gr, t, kind === "trumpet" ? 0.016 : 0.028, KEY_LEVEL * lv * STOPS[s].level * v, rel, 0.03, kind === "trumpet" ? 1.25 : 1.1));
        n += 2;
      });
      if (!envs.length) return null;
      count(n, t, tEnd);
      return { n: n, envs: envs, oscs: oscs, rel: envs[0].rel };
    }

    // ---- the wind ---------------------------------------------------------
    // How hard a chord draws on the reservoir: the drawn stops × the keys
    // that are NEWLY put down. Keys already held (a common tone, a repeated
    // note played legato) draw nothing new — so a hymn that moves one voice
    // at a time barely stirs the wind, and a full chord out of silence makes
    // the whole case sag.
    function load(reg, nKeys) {
      var s = 0; for (var k in STOPS) s += (reg[k] || 0) * STOPS[k].level;
      return s * Math.sqrt(nKeys);
    }
    var down = [];                                   // keys still sounding: [{f, until}]
    function newKeys(tt, fs) {
      down = down.filter(function (k) { return k.until > tt - 0.06; });
      var n = 0;
      fs.forEach(function (f) {
        for (var i = 0; i < down.length; i++) if (Math.abs(down[i].f / f - 1) < 0.003) return;
        n++;
      });
      return n;
    }
    // The reservoir refills over ~1.5 s: a chord in a brisk hymn finds the
    // regulator still moving and barely lurches it (2–3 cents), while a full
    // chord out of silence, or after a long breath, sags the whole case
    // (~8 cents, a 7 % dip) and recovers audibly. opts.wind scales it all.
    var lastSag = -1e9;
    function sag(t, amount) {
      if (!wind || amount <= 0) return;
      var ready = t > lastSag ? 1 - Math.exp(-(t - lastSag) / 1.5) : 0;
      var a = amount * ready * windDepth;
      if (a < 0.05) return;
      lastSag = t;
      var cents = Math.min(8, a * 3.2);
      wind.offset.setTargetAtTime(-cents, t, 0.012);
      wind.offset.setTargetAtTime(0, t + 0.07, 0.11);
      windGain.gain.setTargetAtTime(1 - Math.min(0.07, a * 0.03), t, 0.015);
      windGain.gain.setTargetAtTime(1, t + 0.07, 0.12);
    }
    var tremWas = -1;
    function tremTo(depth, t) {
      if (depth === tremWas) return;
      tremWas = depth;
      tremAmp.gain.setTargetAtTime(depth * 0.2, t, 0.08);      // ±20 % level at full depth
      tremPitch.gain.setTargetAtTime(depth * 7, t, 0.08);      // ±7 cents
    }

    // THE TOUCH (round 3). An organ has one pipe per key per stop, and a key
    // that is already down cannot be struck again: the finger stays. So a
    // note that lands on a key still sounding on the same registration — a
    // unison between two parts, a common tone written twice, a repeated note
    // played without lifting — sounds nothing new: the key is held on to the
    // later of the two releases. (Before, the pipe spoke twice over itself:
    // two oscillators on one pitch with unrelated phases, a flutter and a
    // second chiff at every such join.) A note that begins after the key's
    // release speaks again. A note that begins just as the key is let go —
    // within OVERLAP_S either side, the way a part handed over onset to
    // onset writes a repeated note — is a repeat, and a player lifts for it:
    // the organ lifts the old key AUTO_LIFT early and strikes the new one
    // (round 3, round 2 — it used to tie them, and hymn-lab's ward lost the
    // re-attack on its repeated notes). Only a key that stays down past that
    // (a unison, a common tone) is held on.
    // A key that speaks while the hands are already down speaks legato, its
    // breath masked (CHIFF_LEGATO); the first chord out of silence chiffs.
    var held = [];                                  // {sig, f, t, k}: keys sounding
    var lastT = -1e9;
    function heldAt(sig, f, tt) {
      for (var i = held.length - 1; i >= 0; i--) {
        var h = held[i];
        if (h.sig === sig && h.t <= tt + 1e-6 && h.k.rel >= tt - 0.005 && Math.abs(h.f / f - 1) < 0.002) return h;
      }
      return null;
    }
    // the key h, met by a new note at tt ending at `end`: held on (true), or
    // lifted for a re-strike (false: the caller speaks a new key)
    function holdOrLift(h, tt, end) {
      if (h.k.rel > tt + OVERLAP_S || h.t >= tt - 1e-6) {        // truly down, or struck together (a unison)
        if (end > h.k.rel) holdLonger(h.k, end);
        return true;
      }
      liftEarlier(h.k, tt - Math.min(AUTO_LIFT, (tt - h.t) / 3));
      return false;
    }
    function handsDown(pedal, tt) {
      for (var i = held.length - 1; i >= 0; i--) {
        var h = held[i];
        if (!!h.pedal === !!pedal && h.t < tt - 1e-4 && h.k.rel > tt - LEGATO_S) return true;
      }
      return false;
    }
    // play(t, notes, registration, o): notes = [{f, dur, at?, v?, pedal?, pedalOnly?}]
    // Chords are notes sharing an `at`; lines are notes walking in `at`.
    // o.texture (round 3): the number of voices the music carries. Given, it
    // fixes the level law for the whole call (texture^−0.3 on every key), so
    // an inner voice moving alone is no louder than the chord it moves in;
    // left out, each onset is levelled by how many keys it puts down.
    function play(t, notes, registration, o) {
      var reg = resolve(registration);
      if (!notes || !notes.length) return 0;
      o = o || {};
      // the reservoir gives only so much: every stop adds, but a big
      // registration is not the plain sum of its ranks
      var S = 0; for (var sk in STOPS) if (sk !== "bourdon16") S += (reg[sk] || 0) * STOPS[sk].level;
      var regScale = 1 / Math.sqrt(Math.max(1, S / 1.1));
      // only a registration that can draw the wind down is wired to it
      var windOn = !!wind && load(reg, 4) > 1.6;
      if (o.trem !== false) tremTo(reg.trem || 0, t);
      var sig = sigOf(reg, Object.keys(STOPS).concat(["trem"])), psig = "P" + (reg.bourdon16 || 0).toFixed(2);
      var fixedV = o.texture ? Math.pow(Math.max(1, o.texture), -0.3) : 0;
      var groups = {}, n = 0;
      notes.forEach(function (nt) { var k = (nt.at || 0).toFixed(3); (groups[k] = groups[k] || []).push(nt); });
      Object.keys(groups).sort(function (x, y) { return x - y; }).forEach(function (k) {
        var g = groups[k], tt = t + (+k);
        if (tt > lastT) lastT = tt;
        var fresh = newKeys(tt, g.map(function (nt) { return nt.f; }));
        if (windOn && fresh > 0) sag(tt, load(reg, fresh) - 1.6);
        var vScale = fixedV || Math.pow(g.length, -0.3);   // more keys, louder — but not linearly
        var legM = handsDown(false, tt), legP = handsDown(true, tt);
        g.forEach(function (nt) {
          var v = (nt.v != null ? nt.v : 1) * vScale, end = tt + nt.dur, h, kr;
          if (!nt.pedalOnly) {
            if ((h = heldAt(sig, nt.f, tt)) && holdOrLift(h, tt, end)) { /* the finger stays */ }
            else if ((kr = key(tt, nt.f, nt.dur, reg, v * regScale, false, windOn, legM))) { n += kr.n; held.push({ sig: sig, f: nt.f, t: tt, k: kr }); }
          }
          if (nt.pedal) {
            if ((h = heldAt(psig, nt.f, tt)) && holdOrLift(h, tt, end)) { /* the foot stays */ }
            else if ((kr = key(tt, nt.f, nt.dur, reg, (nt.v != null ? nt.v : 1), true, windOn, legP))) { n += kr.n; held.push({ sig: psig, f: nt.f, t: tt, k: kr, pedal: true }); }
          }
          down.push({ f: nt.f, until: end });
        });
      });
      // the keys long let go leave the list (kept small for a meeting-long organ)
      if (held.length > 192) held = held.filter(function (h) { return h.k.rel > lastT - 8; });
      return n;
    }
    // chord(t, freqs, dur, registration, {pedal, v}): the bass doubled in the pedal
    function chord(t, freqs, dur, registration, o) {
      o = o || {};
      if (!freqs || !freqs.length) return 0;
      var lo = Math.min.apply(null, freqs);
      return play(t, freqs.map(function (f) {
        return { f: f, dur: dur, v: o.v, pedal: o.pedal !== false && f === lo };
      }), registration);
    }

    // dispose(t): the organ is shut at scheduled time t — the tremulant's
    // motor and the wind stop, and the case leaves the graph once they have
    // (wave-1 open issue: every organ built left two sources running for
    // ever). Without t it is shut at once.
    var disposed = false;
    function dispose(t) {
      if (disposed) return;
      disposed = true;
      var tt = t != null ? t : 0;
      tremLfo.onended = function () { try { out.disconnect(); } catch (e) {} };
      try { tremLfo.stop(tt); } catch (e) {}
      if (wind) { try { wind.stop(tt); } catch (e2) {} }
    }

    return {
      out: out,
      play: play,
      chord: chord,
      setSwell: setSwell,
      swell: function () { return swellNow; },
      dispose: dispose,
      stats: function () { return { standing: standing, created: created, peakLive: peakN + standing, until: untilT }; },
    };
  }

  return { create: create, STOPS: STOPS, REGISTRATIONS: REGISTRATIONS, resolve: resolve,
           CHIFF: { level: CHIFF_LEVEL, legato: CHIFF_LEGATO, legatoS: LEGATO_S } };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-voices-pipeorgan.js"] = true;   // the load guard's roll call (for the day it joins the engine)

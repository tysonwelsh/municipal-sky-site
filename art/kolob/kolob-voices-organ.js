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
//  · CHIFF: a flue pipe speaks with a breath of noise before the tone
//    settles — a short band of the shared noise buffer at a harmonic of the
//    pipe. Flutes chiff more than principals; reeds do not chiff at all.
//  · C and C♯ SIDES: pipes stand on two chests, left and right, alternating
//    by semitone — so a line walks gently across the case. Two panners for
//    the whole organ, not one per note.
//  · Just intonation is the caller's: every frequency passed in is sounded
//    exactly (plus the wind's few cents, and the tremulant's).
//
// Cost (reported by stats()): ~14 standing nodes per organ; per key, 3 (one
// stop) to 9 (full organ with chiff); per pedal note 4–7. A four-part hymn
// chord on full organ with pedal is ≈ 40 short-lived nodes.
//
// Public surface: KOLOB.VoicesOrgan.create(ctx, destination, opts) → organ
//   organ.play(t, notes, registration)      notes: [{f, dur, at?, v?, pedal?}]
//   organ.chord(t, freqs, dur, registration, {pedal: true, v})
//   organ.setSwell(expression 0..1, t, rampS)
//   organ.stats() → { standing, created, perKey, peakLive }
//   KOLOB.VoicesOrgan.REGISTRATIONS / STOPS / resolve(registration)
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
    principal8: { level: 0.44, chiff: 0.55, upper: false, harm: [[1, 1], [2, 0.6], [3, 0.4], [4, 0.28], [5, 0.18], [6, 0.12], [7, 0.08], [8, 0.06], [9, 0.04], [10, 0.03], [11, 0.02], [12, 0.015]] },
    flute8:     { level: 0.55, chiff: 1.0,  upper: false, harm: [[1, 1], [2, 0.05], [3, 0.2], [4, 0.02], [5, 0.055], [7, 0.018]] },
    flute4:     { level: 0.32, chiff: 0.8,  upper: true,  harm: [[2, 1], [4, 0.05], [6, 0.18], [10, 0.04]] },
    mixture:    { level: 0.24, chiff: 0.35, upper: true,  harm: [[3, 0.9], [4, 1], [6, 0.8], [8, 0.35], [12, 0.18]] },
    bourdon16:  { level: 0.30, chiff: 0.5,  upper: false, harm: [[1, 1], [3, 0.22], [5, 0.07], [7, 0.025]] },  // sounded an octave under the pedal key
    vox8:       { level: 0.54, reed: "vox" },
    trumpet8:   { level: 0.50, reed: "trumpet" },
  };

  // Named registrations — the organist's shorthand. Values are stop levels
  // (0–1); `trem` is the tremulant's depth; `swell` a suggested expression.
  var REGISTRATIONS = {
    "quiet flute":    { flute8: 1, trem: 0, swell: 0.55 },
    "flutes 8 & 4":   { flute8: 0.9, flute4: 0.8, trem: 0, swell: 0.7 },
    "hymn principal": { principal8: 1, flute8: 0.5, flute4: 0.35, bourdon16: 0.8, trem: 0, swell: 0.85 },
    "vox humana":     { vox8: 1, flute8: 0.55, trem: 1, swell: 0.6 },
    "trumpet":        { trumpet8: 1, flute8: 0.35, bourdon16: 0.5, trem: 0, swell: 0.85 },
    "full organ":     { principal8: 1, flute8: 0.6, flute4: 0.7, mixture: 1, trumpet8: 0.8, bourdon16: 1, trem: 0, swell: 1 },
  };

  // resolve(name | [stop, …] | {stop: level}) → {stop: level, trem}
  function resolve(reg) {
    if (!reg) reg = "hymn principal";
    if (typeof reg === "string") reg = REGISTRATIONS[reg] || REGISTRATIONS["hymn principal"];
    if (Object.prototype.toString.call(reg) === "[object Array]") {
      var o = { trem: 0 };
      reg.forEach(function (s) { if (s === "tremulant") o.trem = 1; else if (STOPS[s]) o[s] = 1; });
      return o;
    }
    return reg;
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

  // one key's level at v = 1 — balanced against the v0.30 organ chord (the
  // lab's reference) so a hymn principal sits where the old organ sat
  var KEY_LEVEL = 0.2;

  // ---- create -------------------------------------------------------------
  function create(ctx, destination, opts) {
    opts = opts || {};
    var R = streamOf(opts);
    var created = 0, spans = [], standing = 0;
    function count(n, t0, t1) { created += n; spans.push([t0, t1, n]); }
    var t0 = opts.t0 != null ? opts.t0 : 0;           // when the standing nodes wake (scheduled, not read)

    // standing graph:  manual → trem → windGain → swellLP → swellGain → out
    //                  pedal ───────→ windGain            (pedal is unenclosed: past the shutters)
    //                  sideL/sideR panners feed manual
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
    // the wind: a ConstantSource summed into every pipe's detune (cents)
    var wind = null;
    if (ctx.createConstantSource) { wind = ctx.createConstantSource(); wind.offset.value = 0; wind.start(t0); }
    // the tremulant: one LFO; its depth lives on two gains (amplitude, pitch)
    var tremLfo = ctx.createOscillator(); tremLfo.frequency.value = R.rnd(5.4, 6.1);
    var tremAmp = ctx.createGain(); tremAmp.gain.value = 0;
    var tremPitch = ctx.createGain(); tremPitch.gain.value = 0;
    tremLfo.connect(tremAmp); tremAmp.connect(trem.gain);
    tremLfo.connect(tremPitch);
    tremLfo.start(t0);
    standing = 14 + (wind ? 1 : 0);

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
    // flue waves for one key: {found, upper, gFound, gUpper, chiff}
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

    // one voiced oscillator, wired to the wind and (when drawn) the tremulant.
    // Its param links are cut when it ends, so a long meeting never leaves
    // the wind holding ten thousand dead pipes.
    function pipeOsc(wave, f, t, tEnd, dest, tremOn) {
      var o = ctx.createOscillator();
      o.setPeriodicWave(wave);
      o.frequency.setValueAtTime(f, t);
      if (wind) wind.connect(o.detune);
      if (tremOn) tremPitch.connect(o.detune);
      o.connect(dest);
      o.onended = function () {
        try { if (wind) wind.disconnect(o.detune); } catch (e) {}
        try { if (tremOn) tremPitch.disconnect(o.detune); } catch (e2) {}
      };
      o.start(t); o.stop(tEnd);
      return o;
    }
    function sideOf(f) { return sides[((Math.round(12 * Math.log(f / 16.3516) / Math.LN2) % 2) + 2) % 2]; }

    // chiff: a short band of breath at a harmonic of the pipe
    function chiff(t, f, amt, dest, harmonic) {
      if (amt < 0.004) return 0;
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass";
      bp.frequency.setValueAtTime(Math.min(6500, Math.max(600, f * harmonic)), t); bp.Q.value = 4;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amt, t + 0.008);
      g.gain.setTargetAtTime(0, t + 0.016, 0.02);
      src.connect(bp); bp.connect(g); g.connect(dest);
      src.start(t, R.rnd(0, 1.8)); src.stop(t + 0.16);
      return 3;
    }
    // a pipe's gain envelope: speech, hold, release (never a step)
    function envelope(g, t, atk, lv, rel, tau, over) {
      g.gain.setValueAtTime(0, t);
      if (over) {                                   // reeds speak with a small bloom
        g.gain.linearRampToValueAtTime(lv * over, t + atk);
        g.gain.setTargetAtTime(lv, t + atk, 0.05);
      } else g.gain.linearRampToValueAtTime(lv, t + atk);
      g.gain.setValueAtTime(lv, Math.max(t + atk + 0.01, rel));
      g.gain.setTargetAtTime(0, Math.max(t + atk + 0.01, rel), tau);
    }

    // one key at 8′ pitch f — every drawn stop on it
    function key(t, f, dur, reg, v, pedal) {
      var n = 0, rel = t + dur, tEnd = rel + 0.4;
      if (pedal) {
        var bl = reg.bourdon16 || 0; if (bl <= 0) return 0;
        var fp = f / 2 >= 38 ? f / 2 : f;           // the 16′ an octave under, unless that is below the floor
        if (!waveCache.bourdon) {
          var acc = {}; STOPS.bourdon16.harm.forEach(function (p) { acc[p[0]] = p[1]; });
          waveCache.bourdon = makeWave(acc);
        }
        var gp = ctx.createGain(); gp.connect(pedalBus);
        pipeOsc(waveCache.bourdon, fp, t, tEnd, gp, false);
        envelope(gp, t, 0.07, KEY_LEVEL * bl * STOPS.bourdon16.level * v, rel, 0.06);
        n += 2 + chiff(t, fp, 0.07 * KEY_LEVEL * bl * v, pedalBus, 3);
        count(n, t, tEnd);
        return n;
      }
      var tremOn = (reg.trem || 0) > 0.02;
      var dest = sideOf(f);
      // pipe speech: ~25 ms in the treble … ~60 ms in the bass
      var atk = Math.min(0.06, Math.max(0.022, 0.034 * Math.pow(262 / f, 0.4)));
      var w = flueWaves(reg, f);
      if (w.found || w.upper) {
        var g = ctx.createGain(); g.connect(dest); n++;
        if (w.found) { pipeOsc(w.found, f, t, tEnd, g, tremOn); n++; }
        if (w.upper) { pipeOsc(w.upper, f * (1 + R.rnd(0.0003, 0.0008)), t, tEnd, g, tremOn); n++; }
        envelope(g, t, atk, KEY_LEVEL * v, rel, 0.035);
        // flutes chiff at the 2nd harmonic, principals at the 3rd; reeds
        // drawn over them mask the breath, so it thins under the trumpet
        var ch = w.chiff * (1 - 0.6 * Math.min(1, reg.trumpet8 || 0)) * (reg.principal8 ? 1 : 1.4);
        n += chiff(t, f, 0.1 * KEY_LEVEL * ch * v, dest, reg.principal8 ? 3 : 2);
      }
      ["trumpet8", "vox8"].forEach(function (s) {
        var lv = reg[s] || 0; if (lv <= 0) return;
        var kind = STOPS[s].reed;
        var gr = ctx.createGain(); gr.connect(dest);
        pipeOsc(reedWave(kind, f), f, t, tEnd, gr, tremOn);
        envelope(gr, t, kind === "trumpet" ? 0.016 : 0.028, KEY_LEVEL * lv * STOPS[s].level * v, rel, 0.03, kind === "trumpet" ? 1.25 : 1.1);
        n += 2;
      });
      count(n, t, tEnd);
      return n;
    }

    // how hard a chord draws on the wind (stop count × keys)
    function load(reg, nKeys) {
      var s = 0; for (var k in STOPS) s += (reg[k] || 0) * STOPS[k].level;
      return s * Math.sqrt(nKeys);
    }
    var lastSag = -1;
    function sag(t, amount) {
      if (!wind || amount <= 0 || t < lastSag + 0.12) return;
      lastSag = t;
      var cents = Math.min(9, amount * 3.2);
      wind.offset.setTargetAtTime(-cents, t, 0.012);
      wind.offset.setTargetAtTime(0, t + 0.07, 0.11);
      windGain.gain.setTargetAtTime(1 - Math.min(0.08, amount * 0.03), t, 0.015);
      windGain.gain.setTargetAtTime(1, t + 0.07, 0.12);
    }
    var tremWas = -1;
    function tremTo(depth, t) {
      if (depth === tremWas) return;
      tremWas = depth;
      tremAmp.gain.setTargetAtTime(depth * 0.2, t, 0.08);      // ±20 % level at full depth
      tremPitch.gain.setTargetAtTime(depth * 7, t, 0.08);      // ±7 cents
    }

    // play(t, notes, registration): notes = [{f, dur, at?, v?, pedal?}]
    // Chords are notes sharing an `at`; lines are notes walking in `at`.
    function play(t, notes, registration) {
      var reg = resolve(registration);
      // the reservoir gives only so much: every stop adds, but a big
      // registration is not the plain sum of its ranks
      var S = 0; for (var sk in STOPS) if (sk !== "bourdon16") S += (reg[sk] || 0) * STOPS[sk].level;
      var regScale = 1 / Math.sqrt(Math.max(1, S / 1.1));
      tremTo(reg.trem || 0, t);
      var groups = {}, n = 0;
      notes.forEach(function (nt) { var k = (nt.at || 0).toFixed(3); (groups[k] = groups[k] || []).push(nt); });
      Object.keys(groups).forEach(function (k) {
        var g = groups[k], tt = t + (+k);
        var ld = load(reg, g.length);
        if (ld > 1.6) sag(tt, ld - 1.6);
        var vScale = Math.pow(g.length, -0.3);   // more keys, louder — but not linearly
        g.forEach(function (nt) {
          var v = (nt.v != null ? nt.v : 1) * vScale;
          if (!nt.pedalOnly) n += key(tt, nt.f, nt.dur, reg, v * regScale, false);
          if (nt.pedal) n += key(tt, nt.f, nt.dur, reg, (nt.v != null ? nt.v : 1), true);
        });
      });
      return n;
    }
    // chord(t, freqs, dur, registration, {pedal, v}): the bass doubled in the pedal
    function chord(t, freqs, dur, registration, o) {
      o = o || {};
      var lo = Math.min.apply(null, freqs);
      return play(t, freqs.map(function (f) {
        return { f: f, dur: dur, v: o.v, pedal: o.pedal !== false && f === lo };
      }), registration);
    }

    return {
      out: out,
      play: play,
      chord: chord,
      setSwell: setSwell,
      swell: function () { return swellNow; },
      stats: function () { return report(); },
    };

    function report() {
      var ev = [];
      spans.forEach(function (s) { ev.push([s[0], s[2]], [s[1], -s[2]]); });
      ev.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var live = 0, peak = 0;
      ev.forEach(function (e) { live += e[1]; if (live > peak) peak = live; });
      return { standing: standing, created: created, peakLive: peak + standing };
    }
  }

  return { create: create, STOPS: STOPS, REGISTRATIONS: REGISTRATIONS, resolve: resolve };
})();

// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — FOLK VOICES (KOLOB.VoicesFolk)
//
// Everything in the colony that is not the meetinghouse's own: the fiddle
// that comes out when the benches are pushed back, the Primary's handbells,
// the gulls, and the carts. Four small instruments, each built from the
// one physical fact that makes it recognisable, and nothing more.
//
//  FIDDLE   — a bowed string is a sawtooth (Helmholtz motion: the string
//             sticks to the bow, slips, sticks), shaped by the bow's place
//             on the string (a comb of weak harmonics) and by the BODY — a
//             wooden box with an air resonance near 280 Hz, the main wood
//             mode near 460 Hz and the bridge hill near 2.8 kHz. The body
//             is one filter chain per fiddle, not per note. A reel is ONE
//             bowed voice that changes pitch, not a string of separate
//             notes: bow changes dip and dig; slurs glide; rosin hisses.
//             Double stops and drones are extra strings on the same bow,
//             tuned to whatever exact ratio the caller hands over — 7/4 and
//             7/6 ring as the old fiddlers' "blue" intervals do.
//  HANDBELLS — English handbells are tuned so the twelfth (3×) sings over
//             the fundamental; a few inharmonic upper partials die fast;
//             the leather-padded clapper gives a soft knock. Children damp
//             them against their shoulders, or forget to.
//  GULLS    — a gull's cry is a nasal, harsh, harmonic tone that scoops up
//             to a pitch and falls off it ("kee-ow"), with a rasp of
//             irregular amplitude. Heard closely, the lead bird's held
//             pitches are the notes of a tune (PLAN §8.10).
//  WHEELS   — a wooden wheel on a dry axle: stick-slip friction (a buzzing
//             creak whose rate wanders) through the wheel's wooden
//             resonances, once a revolution; iron tire on gravel beneath;
//             the knock of a rut now and then; the cart bed rattling.
//             The revolution is the rhythm (two beats a turn).
//
// Cost: fiddle ≈ 7 standing + ~9 per bowed line (not per note) + 2 per
// double-stop string; handbell 10 per strike; gull cry 8; a cart ≈ 18
// standing for the whole roll + 4 per rut knock. Reported by stats().
//
// Public surface: KOLOB.VoicesFolk.create(ctx, destination, opts) → folk
//   folk.fiddle(t, notes, {drone: [f…], droneLevel, dyn, pan})
//       notes: [{f, dur, at?, slur?, acc?, also?: [f…], orn?: "cut"}]
//   folk.handbell(t, f, {dur?, v, pan})           dur omitted: let it ring
//   folk.handbells(t, notes)                      notes: [{f, at, dur?, v?, pan?}]
//   folk.gull(t, f, {hold, v, pan, dist, kind: "long"|"ha"})
//   folk.gulls(t, {notes: [f…], beat, birds, from, to, dist, v})
//   folk.wheels(t, dur, {beat, carts, from, to, creak, v})
//   folk.out · folk.stats()
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.VoicesFolk = (function () {
  "use strict";

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
    var next = (window.PJ2 && PJ2.Rand) ? PJ2.Rand.stream(opts.seed || 1848).fork("synth:folk").next : mulberry(opts.seed || 1848);
    return {
      rnd: function (a, b) { return a + next() * (b - a); },
      chance: function (p) { return next() < p; },
      pick: function (arr) { return arr[Math.floor(next() * arr.length)]; },
    };
  }
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

  function create(ctx, destination, opts) {
    opts = opts || {};
    var R = streamOf(opts);
    var created = 0, spans = [], standing = 1;
    function count(n, t0, t1) { created += n; spans.push([t0, t1, n]); }

    var out = ctx.createGain(); out.gain.value = opts.gain != null ? opts.gain : 1;
    out.connect(destination);
    function panner(p, t, dest) {
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.setValueAtTime(Math.max(-1, Math.min(1, p || 0)), t || 0);
      sp.connect(dest || out);
      return sp;
    }
    function wave(harms) {                          // harms: [[h, a], …]
      var top = 1; harms.forEach(function (p) { top = Math.max(top, p[0]); });
      var re = new Float32Array(top + 1), im = new Float32Array(top + 1);
      harms.forEach(function (p) { im[p[0]] += p[1]; });
      try { return ctx.createPeriodicWave(re, im, { disableNormalization: true }); }
      catch (e) { return ctx.createPeriodicWave(re, im); }
    }
    function noise(t, dur, dest) {
      var s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx); s.loop = true;
      s.connect(dest); s.start(t, R.rnd(0, 1.9)); s.stop(t + dur);
      return s;
    }

    // ======================================================================
    // THE FIDDLE
    // ======================================================================
    var fidBody = null;
    function body() {
      if (fidBody) return fidBody;
      // air · wood · (a small dip where boxy fiddles honk) · bridge hill · top
      var chain = [
        ["peaking", 280, 1.4, 5], ["peaking", 460, 1.6, 4], ["peaking", 1300, 1.2, -3],
        ["peaking", 2800, 0.9, 6], ["lowpass", 7200, 0.6, 0],
      ].map(function (s) {
        var b = ctx.createBiquadFilter(); b.type = s[0]; b.frequency.value = s[1]; b.Q.value = s[2]; b.gain.value = s[3];
        return b;
      });
      for (var i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
      var p = panner(opts.fiddlePan != null ? opts.fiddlePan : -0.12, 0);
      chain[chain.length - 1].connect(p);
      standing += chain.length + 1;
      fidBody = chain[0];
      return fidBody;
    }
    var bowWaves = {};
    function bowWave(f) {
      var band = Math.round(Math.log(f) / Math.LN2 * 3), key = band;
      if (bowWaves[key]) return bowWaves[key];
      var fb = Math.pow(2, band / 3), beta = 1 / 7.3, hs = [], ss = 0;
      for (var h = 1; h * fb < 9000 && h <= 60; h++) {
        var a = (1 / h) * (0.22 + 0.78 * Math.abs(Math.sin(Math.PI * h * beta)));
        if (h * fb > 5000) a *= 5000 / (h * fb);
        hs.push([h, a]); ss += a * a;
      }
      var nrm = 0.7 / Math.sqrt(ss / 2);
      hs.forEach(function (p) { p[1] *= nrm; });
      return (bowWaves[key] = wave(hs));
    }
    // one bowed string playing a sequence of pitches under one bow arm
    function bowedString(t0, tEnd, steps, lv, into, n0) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.setPeriodicWave(bowWave(steps[0].f));
      o.frequency.setValueAtTime(steps[0].f, t0);
      g.gain.setValueAtTime(0, t0);
      o.connect(g); g.connect(into);
      // vibrato: one LFO per string, its depth automated per note
      var lfo = ctx.createOscillator(), vd = ctx.createGain();
      lfo.frequency.value = R.rnd(5.2, 6.2); vd.gain.setValueAtTime(0, t0);
      lfo.connect(vd); vd.connect(o.detune);
      steps.forEach(function (s, i) {
        var t = s.t, end = s.t + s.dur;
        if (i > 0) {
          if (s.f !== steps[i - 1].f) {
            // left hand: a finger lands — a quick glide, faster when slurred
            o.frequency.setTargetAtTime(s.f, t - 0.004, s.slur ? 0.012 : 0.006);
          }
        }
        var v = lv * (s.v != null ? s.v : 1);
        if (i === 0) {
          g.gain.setTargetAtTime(v * (s.acc ? 1.35 : 1.12), t, 0.012);
          g.gain.setTargetAtTime(v, t + 0.05, 0.05);
        } else if (s.newBow) {
          // right hand: a bow change — the string stops for an instant, then
          // the bow digs in (harder on accents), then settles
          g.gain.setTargetAtTime(v * 0.18, t - 0.02, 0.008);
          g.gain.setTargetAtTime(v * (s.acc ? 1.35 : 1.12), t + 0.004, 0.012);
          g.gain.setTargetAtTime(v, t + 0.05, 0.05);
        } else {
          g.gain.setTargetAtTime(v, t, 0.03);
        }
        // grace-note cut: a flick to the note above and back
        if (s.orn === "cut" && s.dur > 0.12) {
          o.frequency.setValueAtTime(s.f * 9 / 8, t);
          o.frequency.setTargetAtTime(s.f, t + 0.035, 0.006);
        }
        // vibrato only on held notes, and late (old-time fiddlers are sparing)
        var vib = s.dur > 0.42 ? 11 : 0;
        vd.gain.setTargetAtTime(0, t, 0.02);
        if (vib) vd.gain.setTargetAtTime(vib, t + Math.min(0.28, s.dur * 0.4), 0.12);
        if (s.rest) g.gain.setTargetAtTime(0, t, 0.02);
        void end;
      });
      g.gain.setTargetAtTime(0, tEnd - 0.03, 0.03);
      o.start(t0); o.stop(tEnd + 0.2);
      lfo.start(t0); lfo.stop(tEnd + 0.2);
      count(4, t0, tEnd + 0.2);
      return 4 + (n0 || 0);
    }
    function fiddle(t, notes, o) {
      o = o || {};
      var into = body();
      var dyn = o.dyn != null ? o.dyn : 0.7;
      var lv = 0.09 * (0.4 + 0.6 * dyn), n = 0;
      var steps = notes.map(function (nt, i) {
        return { t: t + (nt.at || 0), dur: nt.dur, f: nt.f, slur: !!nt.slur, newBow: i === 0 || !nt.slur,
                 acc: !!nt.acc, v: nt.v, orn: nt.orn, rest: !nt.f };
      });
      // rests hold the previous pitch silently
      for (var i = 0; i < steps.length; i++) if (steps[i].rest) steps[i].f = i ? steps[i - 1].f : (notes[1] || {}).f || 440;
      var t0 = steps[0].t, tEnd = steps[steps.length - 1].t + steps[steps.length - 1].dur;
      n += bowedString(t0, tEnd, steps, lv, into);
      // double stops: a second string, sounding only under notes that ask
      var hasAlso = notes.some(function (nt) { return nt.also && nt.also.length; });
      if (hasAlso) {
        var ds = steps.map(function (s, i) {
          var a = notes[i].also && notes[i].also[0];
          return { t: s.t, dur: s.dur, f: a || s.f, slur: s.slur, newBow: s.newBow, acc: s.acc, v: a ? (s.v != null ? s.v : 1) * 0.8 : 0.0001, rest: false };
        });
        n += bowedString(t0, tEnd, ds, lv, into);
      }
      // drones: open strings bowed alongside, the fiddler leaning on them
      (o.drone || []).forEach(function (df) {
        var dl = (o.droneLevel != null ? o.droneLevel : 0.45);
        var dsteps = steps.map(function (s) { return { t: s.t, dur: s.dur, f: df, slur: s.slur, newBow: s.newBow, acc: s.acc, v: dl, rest: false }; });
        n += bowedString(t0, tEnd, dsteps, lv, into);
      });
      // rosin: bow noise, a band of hiss that follows the bow's pressure
      var bn = ctx.createBiquadFilter(); bn.type = "bandpass"; bn.frequency.value = 3400; bn.Q.value = 0.8;
      var bg = ctx.createGain(); bg.gain.setValueAtTime(0, t0);
      noise(t0, tEnd - t0 + 0.2, bn); bn.connect(bg); bg.connect(into);
      steps.forEach(function (s) {
        if (!s.newBow || s.rest) return;
        bg.gain.setTargetAtTime(lv * (s.acc ? 0.34 : 0.22), s.t, 0.004);
        bg.gain.setTargetAtTime(lv * 0.06, s.t + 0.03, 0.03);
      });
      bg.gain.setTargetAtTime(0, tEnd - 0.03, 0.03);
      count(3, t0, tEnd + 0.2);
      return n + 3;
    }

    // ======================================================================
    // HANDBELLS
    // ======================================================================
    var bellW = null, bellHi = null;
    function handbell(t, f, o) {
      o = o || {};
      var v = (o.v != null ? o.v : 1) * 0.16;
      var dest = panner(o.pan || 0, t); var n = 1;
      if (!bellW) {
        bellW = wave([[2, 0.12], [3, 0.55]]);                       // octave (weak), twelfth (sung)
        bellHi = wave([[21, 0.2], [27, 0.26], [34, 0.1]]);         // 4.2×, 5.4×, 6.8× over a fifth-of-f base
      }
      var ring = o.dur != null ? o.dur : 3.4 * Math.pow(523 / f, 0.45);   // lower bells ring longer
      var damp = o.dur != null;
      var tEnd = t + (damp ? o.dur + 0.3 : ring * 1.6 + 0.2);
      function part(type, fr, pw, amp, tau, atk) {
        var os = ctx.createOscillator(), g = ctx.createGain();
        if (pw) os.setPeriodicWave(pw); else os.type = type;
        os.frequency.setValueAtTime(fr, t);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + atk);
        g.gain.setTargetAtTime(0, t + atk, tau);
        if (damp) g.gain.setTargetAtTime(0, t + o.dur, 0.06);
        os.connect(g); g.connect(dest);
        os.start(t); os.stop(tEnd);
        n += 2;
      }
      part("sine", f, null, v, ring * 0.45, 0.004);
      part("sine", f + R.rnd(0.4, 1.1), null, v * 0.5, ring * 0.4, 0.004);   // the shimmer
      part(null, f, bellW, v, ring * 0.22, 0.004);
      part(null, f / 5, bellHi, v * 0.8, 0.09, 0.004);
      // the clapper's padded knock
      var bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = Math.min(2400, f * 1.5); bp.Q.value = 1.5;
      var kg = ctx.createGain();
      kg.gain.setValueAtTime(0, t); kg.gain.linearRampToValueAtTime(v * 0.3, t + 0.003);
      kg.gain.setTargetAtTime(0, t + 0.004, 0.01);
      noise(t, 0.06, bp); bp.connect(kg); kg.connect(dest);
      n += 3;
      count(n, t, tEnd);
      return n;
    }
    function handbells(t, notes) {
      var n = 0;
      notes.forEach(function (nt) { n += handbell(t + (nt.at || 0), nt.f, nt); });
      return n;
    }

    // ======================================================================
    // GULLS
    // ======================================================================
    var gullW = null;
    function gull(t, f, o) {
      o = o || {};
      if (!gullW) {
        var hs = [];
        for (var h = 1; h <= 14; h++) hs.push([h, (h === 1 ? 0.6 : 1) * Math.pow(h, -0.7)]);
        gullW = wave(hs);
      }
      var dist = o.dist != null ? o.dist : 0.3;            // 0 close … 1 far
      var v = (o.v != null ? o.v : 1) * 0.1 * (1 - 0.6 * dist);
      var kind = o.kind || "long";
      var hold = kind === "ha" ? R.rnd(0.05, 0.08) : (o.hold != null ? o.hold : R.rnd(0.18, 0.32));
      var up = kind === "ha" ? 0.025 : R.rnd(0.05, 0.09);
      var fall = kind === "ha" ? 0.07 : R.rnd(0.14, 0.24);
      var tEnd = t + up + hold + fall + 0.05;
      var os = ctx.createOscillator(); os.setPeriodicWave(gullW);
      // kee — the scoop up to the pitch — hold — ow, the fall away
      os.frequency.setValueAtTime(f * (kind === "ha" ? 0.86 : 0.72), t);
      os.frequency.exponentialRampToValueAtTime(f * 1.015, t + up);
      os.frequency.setTargetAtTime(f, t + up, 0.02);
      os.frequency.setValueAtTime(f, t + up + hold);
      os.frequency.exponentialRampToValueAtTime(f * (kind === "ha" ? 0.8 : 0.58), t + up + hold + fall);
      // the rasp: a fast, uneven amplitude flutter
      // (on its own gain AFTER the envelope, so silence stays silent)
      var am = ctx.createOscillator(), amg = ctx.createGain(), g = ctx.createGain(), rasp = ctx.createGain();
      am.type = "triangle"; am.frequency.value = R.rnd(38, 62);
      amg.gain.value = 0.28; rasp.gain.value = 0.72;
      am.connect(amg); amg.connect(rasp.gain);
      // the nasal throat: a formant band, darker with distance
      var bp = ctx.createBiquadFilter(); bp.type = "peaking"; bp.frequency.value = R.rnd(2000, 2500); bp.Q.value = 1.4; bp.gain.value = 6;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 5200 - 3200 * dist; lp.Q.value = 0.5;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(v * 0.7, t + up * 0.6);
      g.gain.linearRampToValueAtTime(v, t + up);
      g.gain.setValueAtTime(v, t + up + hold);
      g.gain.linearRampToValueAtTime(v * 0.55, t + up + hold + fall * 0.6);
      g.gain.linearRampToValueAtTime(0, t + up + hold + fall);
      var pn = panner(o.pan || 0, t);
      os.connect(bp); bp.connect(lp); lp.connect(g); g.connect(rasp); rasp.connect(pn);
      os.start(t); os.stop(tEnd); am.start(t); am.stop(tEnd);
      count(9, t, tEnd);
      return 9;
    }
    // a flock crossing: the lead bird traces the notes; the others chatter
    function gulls(t, o) {
      o = o || {};
      var notes = o.notes || [];
      var beat = o.beat || 0.42, birds = o.birds || 5;
      var from = o.from != null ? o.from : -0.8, to = o.to != null ? o.to : 0.8;
      var dist = o.dist != null ? o.dist : 0.3, v = o.v != null ? o.v : 1;
      var span = Math.max(notes.length * beat, 2.5) + 1.5, n = 0;
      function panAt(tt) { var x = Math.max(0, Math.min(1, (tt - t) / span)); return from + (to - from) * x; }
      function distAt(tt) { var x = Math.max(0, Math.min(1, (tt - t) / span)); return dist + (1 - dist) * 0.55 * Math.pow(2 * x - 1, 2); }
      // gulls' register: fold the tune into ~650–1400 Hz
      function reg(f) { while (f < 650) f *= 2; while (f > 1400) f /= 2; return f; }
      var tt = t + 0.6;
      notes.forEach(function (f, i) {
        var at = tt + i * beat + R.rnd(-0.03, 0.03);
        n += gull(at, reg(f), { hold: beat * 0.55, pan: panAt(at), dist: distAt(at), v: v });
      });
      // the chatter: short cries and laughs from the rest of the flock
      var chatter = Math.round(birds * span * 0.55);
      for (var c = 0; c < chatter; c++) {
        var ct = t + R.rnd(0, span);
        var base = reg(notes.length ? R.pick(notes) * R.pick([1, 1.5, 0.75]) : R.rnd(700, 1200));
        var kind = R.chance(0.45) ? "ha" : "long";
        var d = Math.min(1, distAt(ct) + R.rnd(0.1, 0.35));
        if (kind === "ha") {
          var k = Math.floor(R.rnd(2, 5));
          for (var j = 0; j < k; j++) n += gull(ct + j * R.rnd(0.12, 0.16), base * (1 - j * 0.03), { kind: "ha", pan: panAt(ct) + R.rnd(-0.25, 0.25), dist: d, v: v * 0.8 });
        } else n += gull(ct, base * R.rnd(0.97, 1.03), { pan: panAt(ct) + R.rnd(-0.25, 0.25), dist: d, v: v * 0.75 });
      }
      return n;
    }

    // ======================================================================
    // CART WHEELS
    // ======================================================================
    function cart(t, dur, o, ci) {
      var beat = o.beat || 0.6, turn = beat * 2 * (ci ? R.rnd(0.97, 1.05) : 1);
      var creakAmt = o.creak != null ? o.creak : 0.7, v = (o.v != null ? o.v : 1) * 3;
      var from = (o.from != null ? o.from : -0.7) + ci * 0.18, to = (o.to != null ? o.to : 0.7) + ci * 0.18;
      var tEnd = t + dur, n = 0;
      // the whole cart travels: one panner, one approach-and-recede gain
      var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (pn.pan) { pn.pan.setValueAtTime(from, t); pn.pan.linearRampToValueAtTime(to, tEnd); }
      var near = ctx.createGain();
      near.gain.setValueAtTime(0, t);
      near.gain.linearRampToValueAtTime(v, t + dur * 0.4);
      near.gain.setValueAtTime(v, t + dur * 0.6);
      near.gain.linearRampToValueAtTime(0, tEnd);
      var air = ctx.createBiquadFilter(); air.type = "lowpass"; air.Q.value = 0.5;   // distance darkens
      air.frequency.setValueAtTime(1800, t); air.frequency.linearRampToValueAtTime(6500, t + dur * 0.45);
      air.frequency.setValueAtTime(6500, t + dur * 0.55); air.frequency.linearRampToValueAtTime(1800, tEnd);
      near.connect(air); air.connect(pn); pn.connect(out);
      n += 3;
      // iron tire on gravel: a continuous low crunch, lumpy with the ground
      var cr = ctx.createBiquadFilter(); cr.type = "bandpass"; cr.frequency.value = R.rnd(380, 520); cr.Q.value = 0.9;
      var cg = ctx.createGain(); cg.gain.setValueAtTime(0, t);
      noise(t, dur + 0.1, cr); cr.connect(cg); cg.connect(near);
      for (var gt = t; gt < tEnd; gt += beat / 2) cg.gain.linearRampToValueAtTime(0.05 * R.rnd(0.5, 1.2), gt + beat / 2);
      cg.gain.linearRampToValueAtTime(0, tEnd + 0.05);
      n += 3;
      // the axle: stick-slip friction — a buzz whose rate wanders — through
      // the wheel's wooden resonances, voiced once a turn
      var ax = ctx.createOscillator(); ax.type = "sawtooth";
      var jit = ctx.createBiquadFilter(); jit.type = "lowpass"; jit.frequency.value = 22;
      var jg = ctx.createGain(); jg.gain.value = R.rnd(18, 30);
      noise(t, dur + 0.1, jit); jit.connect(jg); jg.connect(ax.frequency);
      var w1 = ctx.createBiquadFilter(); w1.type = "bandpass"; w1.frequency.value = R.rnd(850, 1100); w1.Q.value = 6;
      var w2 = ctx.createBiquadFilter(); w2.type = "bandpass"; w2.frequency.value = R.rnd(1700, 2300); w2.Q.value = 7;
      var ag = ctx.createGain(); ag.gain.setValueAtTime(0, t);
      ax.connect(w1); ax.connect(w2); w1.connect(ag); w2.connect(ag); ag.connect(near);
      var r0 = R.rnd(95, 150);
      ax.frequency.setValueAtTime(r0, t);
      for (var k = 0, wt = t + R.rnd(0, turn * 0.5); wt < tEnd - 0.3; wt += turn, k++) {
        var cl = creakAmt * 0.5 * R.rnd(0.6, 1.1);
        var len = turn * R.rnd(0.28, 0.42);
        var rUp = r0 * R.rnd(1.3, 1.9);
        // eee — rrk: the rate climbs as the wheel binds, then lets go
        ax.frequency.setValueAtTime(r0 * R.rnd(0.8, 1), wt);
        ax.frequency.linearRampToValueAtTime(rUp, wt + len * 0.7);
        ax.frequency.linearRampToValueAtTime(r0 * 0.6, wt + len);
        ag.gain.setValueAtTime(0, wt);
        ag.gain.linearRampToValueAtTime(cl, wt + len * 0.25);
        ag.gain.linearRampToValueAtTime(cl * 0.7, wt + len * 0.8);
        ag.gain.linearRampToValueAtTime(0, wt + len);
        // the wheel's knock: every turn a soft thud where the felloe joins,
        // and sometimes a rut, which rattles the bed
        n += knock(wt + turn * 0.5, near, 0.35 + (R.chance(0.25) ? 0.5 : 0));
      }
      ax.start(t); ax.stop(tEnd + 0.1);
      n += 7;
      count(13, t, tEnd + 0.1);
      return n;
    }
    function knock(t, dest, amt) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(R.rnd(95, 130), t); o.frequency.exponentialRampToValueAtTime(60, t + 0.08);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12 * amt, t + 0.005);
      g.gain.setTargetAtTime(0, t + 0.006, 0.035);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + 0.3);
      var nn = 2;
      if (amt > 0.6) {                             // the bed rattles: three dry ticks
        var hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = R.rnd(1400, 2200); hp.Q.value = 2;
        var rg = ctx.createGain(); rg.gain.setValueAtTime(0, t);
        for (var i = 0; i < 3; i++) {
          var tt = t + 0.02 + i * R.rnd(0.035, 0.06);
          rg.gain.setValueAtTime(0, tt); rg.gain.linearRampToValueAtTime(0.06 * amt, tt + 0.002);
          rg.gain.linearRampToValueAtTime(0, tt + 0.02);
        }
        noise(t, 0.3, hp); hp.connect(rg); rg.connect(dest);
        nn += 3;
      }
      count(nn, t, t + 0.3);
      return nn;
    }
    function wheels(t, dur, o) {
      o = o || {};
      var n = 0;
      for (var c = 0; c < (o.carts || 2); c++) n += cart(t + c * (o.beat || 0.6) * 1.3, dur, o, c);
      return n;
    }

    function report() {
      var ev = [];
      spans.forEach(function (s) { ev.push([s[0], s[2]], [s[1], -s[2]]); });
      ev.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var live = 0, peak = 0;
      ev.forEach(function (e) { live += e[1]; if (live > peak) peak = live; });
      return { standing: standing, created: created, peakLive: peak + standing };
    }

    return {
      out: out,
      fiddle: fiddle, handbell: handbell, handbells: handbells,
      gull: gull, gulls: gulls, wheels: wheels,
      stats: report,
    };
  }

  return { create: create };
})();

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
//             notes: bow changes dip and dig; slurs glide; rosin hisses; a
//             rest lifts the bow off every string it was on. Double stops
//             and drones are extra strings on the same bow, tuned to whatever
//             exact ratio the caller hands over — 7/4 and 7/6 ring as the old
//             fiddlers' "blue" intervals do — and a SLIDE lands a finger
//             below the note (7/6 under a 5/4, say) and slides it home.
//  HANDBELLS — English handbells are tuned so the twelfth (3×) sings over
//             the fundamental; a few inharmonic upper partials die fast;
//             the leather-padded clapper gives a soft knock. Children damp
//             them against their shoulders, or forget to — and a forgotten
//             bell rings until it has all but gone before it lets go.
//             (Round 3, for the ward's handbell choir: a bell is a RING
//             that can be struck again while it sounds, and every ringer's
//             technique — let ring, damped, martellato on the padded table,
//             the thumb damp, the shake.)
//  GULLS    — a gull's cry is a nasal, harsh, harmonic tone that scoops up
//             to a pitch and falls off it ("kee-ow"), with a rasp of
//             irregular amplitude. Heard closely, the lead bird's held
//             pitches are the notes of a tune (PLAN §8.10) — the whole tune
//             moved by one octave into the gulls' register, so its shape
//             survives, last rise and all.
//  WHEELS   — a wooden wheel on a dry axle: stick-slip friction (a buzzing
//             creak whose rate wanders) through the wheel's wooden
//             resonances, once a revolution; iron tire on gravel beneath;
//             the knock of a rut now and then; the cart bed rattling.
//             The revolution is the rhythm (two beats a turn).
//
// Cost (reported by stats(), counted from the nodes actually built): the
// fiddle's body is 7 standing nodes (5 filters, a panner, and the out gain
// every folk instance has); a bowed line is 4 per string (oscillator, gain,
// vibrato LFO and its depth) + 3 for the rosin — 7 for a plain line, 4 more
// for each double-stop string or drone. A handbell ring is 11 nodes however
// often it is struck (12 when it makes its own panner); a gull cry 8; a
// cart 13 for the whole roll, + 2 per knock (5 when the bed rattles).
// Pitch automation (glides, slides, vibrato, the axle's rate) is read once
// per 128-sample block (k-rate); amplitude stays sample-accurate.
//
// Public surface: KOLOB.VoicesFolk.create(ctx, destination, opts) → folk
//   opts: { gain (1), fiddlePan (−0.12), rand (a PJ2.Rand stream,
//           "synth:folk") | seed }
//   folk.fiddle(t, notes, {drone: [f…], droneLevel, dyn})
//       notes: [{f, dur, at?, slur?, acc?, v?, also?: [f…],
//                orn?: "cut" | "slide", from?: f}]      f 0/null = a rest
//   folk.handbell(t, f, {dur?, v, pan})           dur omitted: let it ring
//   folk.handbells(t, notes)                      notes: [{f, at, dur?, v?, pan?}]
//   folk.ring(t, {f, v, tech, hits, damp, until, shake, pan | dest}) → nodes
//       tech: "ring" | "damp" | "mart" | "thumb" | "shake" (see HANDBELLS)
//   KOLOB.VoicesFolk.bell.{tau, life, casting}(f)  the bronze's own laws (pure)
//   folk.gull(t, f, {hold, up, fall, v, pan, dist, kind: "long"|"ha"})
//   folk.gulls(t, {notes: [f… | {f, dur}…], beat, birds, from, to, dist, v})
//       birds: the flock around the lead bird (default 5; 0 = the lead alone)
//   folk.wheels(t, dur, {beat, carts, from, to, creak, v, still, spread, dest})
//       still: no travel of its own (a road carries it); dest: where the carts roll
//   folk.out · folk.stats() → { standing, created, peakLive, until, maxRing }
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

  // THE HANDBELL'S CASTING (pure; the guest's score reads it too): the bell's own casting, fixed by its pitch: where its untuned partials
  // lie, and how fast its doublet warbles (a property of the bronze, not
  // of the stroke — so the same bell is the same bell all afternoon)
  function casting(f) {
    var h = Math.round(f * 100) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    var u1 = (h & 1023) / 1023, u2 = ((h >>> 10) & 1023) / 1023, u3 = ((h >>> 20) & 1023) / 1023;
    return { r1: 5.2 + 0.6 * u1, r2: 8.2 + 0.7 * u2, beat: 0.35 + 0.75 * u3 };
  }
  function bellTau(f) { return Math.max(0.35, Math.min(3.6, 1.2 * Math.pow(523 / f, 0.62))); }
  function bellLife(f) { return 6.9 * bellTau(f); }       // the fundamental 60 dB down

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
    // pitch automation is read once a block (see the header)
    function kRate(p) { try { p.automationRate = "k-rate"; } catch (e) {} }
    // a rest holds its string's last pitch silently (a leading rest takes
    // the first sounded one), so the finger is already there when it sounds
    function fillRests(steps) {
      var first = null;
      for (var i = 0; i < steps.length; i++) if (!steps[i].rest) { first = steps[i].f; break; }
      for (var j = 0; j < steps.length; j++) if (steps[j].rest) steps[j].f = j ? steps[j - 1].f : first;
      return first != null;
    }
    // one bowed string playing a sequence of pitches under one bow arm
    function bowedString(t0, tEnd, steps, lv, into) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      kRate(o.frequency); kRate(o.detune);
      o.setPeriodicWave(bowWave(steps[0].f));
      var s0 = steps[0];
      o.frequency.setValueAtTime(s0.orn === "slide" && s0.dur > 0.12 ? (s0.from || s0.f * 15 / 16) : s0.f, t0);
      g.gain.setValueAtTime(0, t0);
      o.connect(g); g.connect(into);
      // vibrato: one LFO per string, its depth automated per note
      var lfo = ctx.createOscillator(), vd = ctx.createGain();
      lfo.frequency.value = R.rnd(5.2, 6.2); vd.gain.setValueAtTime(0, t0);
      lfo.connect(vd); vd.connect(o.detune);
      var off = true;                                // the bow is off this string
      steps.forEach(function (s, i) {
        var t = s.t;
        if (s.rest) {
          // the bow lifts: the string rings down in a few hundredths
          if (!off) { g.gain.setTargetAtTime(0, t, 0.02); vd.gain.setTargetAtTime(0, t, 0.02); }
          off = true;
          return;
        }
        // a slide lands the finger below the note and slides it home
        var slide = s.orn === "slide" && s.dur > 0.12;
        var startF = slide ? (s.from || s.f * 15 / 16) : s.f;
        if (i > 0 && startF !== steps[i - 1].f) {
          // left hand: a finger lands — a quick glide, faster when slurred;
          // after a rest it is simply there (the bow finds it waiting)
          if (off) o.frequency.setValueAtTime(startF, Math.max(t0, t - 0.01));
          else o.frequency.setTargetAtTime(startF, t - 0.004, s.slur ? 0.012 : 0.006);
        }
        if (slide) {
          var hold = Math.min(0.05, s.dur * 0.2), glide = Math.min(0.11, s.dur * 0.35);
          o.frequency.setValueAtTime(startF, t + hold);
          o.frequency.exponentialRampToValueAtTime(s.f, t + hold + glide);
        }
        var v = lv * (s.v != null ? s.v : 1);
        if (off) {
          // the bow lands on the string: it bites (harder on accents), settles
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
        off = false;
        // grace-note cut: a flick to the note above and back
        if (s.orn === "cut" && s.dur > 0.12) {
          o.frequency.setValueAtTime(s.f * 9 / 8, t);
          o.frequency.setTargetAtTime(s.f, t + 0.035, 0.006);
        }
        // vibrato only on held notes, and late (old-time fiddlers are sparing)
        var vib = s.dur > 0.42 ? 11 : 0;
        vd.gain.setTargetAtTime(0, t, 0.02);
        if (vib) vd.gain.setTargetAtTime(vib, t + Math.min(0.28, s.dur * 0.4), 0.12);
      });
      g.gain.setTargetAtTime(0, tEnd - 0.03, 0.03);
      o.start(t0); o.stop(tEnd + 0.2);
      lfo.start(t0); lfo.stop(tEnd + 0.2);
      count(4, t0, tEnd + 0.2);
      return 4;
    }
    function fiddle(t, notes, o) {
      o = o || {};
      if (!notes || !notes.length) return 0;
      var steps = notes.map(function (nt, i) {
        return { t: t + (nt.at || 0), dur: nt.dur, f: nt.f, slur: !!nt.slur, newBow: i === 0 || !nt.slur,
                 acc: !!nt.acc, v: nt.v, orn: nt.orn, from: nt.from, rest: !nt.f };
      });
      if (!fillRests(steps)) return 0;                // all rests: the fiddler sits this one out
      var into = body();
      var dyn = o.dyn != null ? o.dyn : 0.7;
      var lv = 0.09 * (0.4 + 0.6 * dyn), n = 0;
      var t0 = steps[0].t, tEnd = steps[steps.length - 1].t + steps[steps.length - 1].dur;
      n += bowedString(t0, tEnd, steps, lv, into);
      // double stops: a second string, bowed only under the notes that ask
      if (notes.some(function (nt) { return nt.f && nt.also && nt.also.length; })) {
        var ds = steps.map(function (s, i) {
          var a = !s.rest && notes[i].also && notes[i].also[0];
          return { t: s.t, dur: s.dur, f: a || 0, slur: s.slur, newBow: s.newBow, acc: s.acc, v: (s.v != null ? s.v : 1) * 0.8, rest: !a };
        });
        fillRests(ds);
        n += bowedString(t0, tEnd, ds, lv, into);
      }
      // drones: open strings bowed alongside, the fiddler leaning on them —
      // and lifted with the bow at every rest
      (o.drone || []).forEach(function (df) {
        var dl = (o.droneLevel != null ? o.droneLevel : 0.45);
        var dsteps = steps.map(function (s) { return { t: s.t, dur: s.dur, f: df, slur: s.slur, newBow: s.newBow, acc: s.acc, v: dl, rest: s.rest }; });
        n += bowedString(t0, tEnd, dsteps, lv, into);
      });
      // rosin: bow noise, a band of hiss that follows the bow's pressure
      var bn = ctx.createBiquadFilter(); bn.type = "bandpass"; bn.frequency.value = 3400; bn.Q.value = 0.8;
      var bg = ctx.createGain(); bg.gain.setValueAtTime(0, t0);
      noise(t0, tEnd - t0 + 0.2, bn); bn.connect(bg); bg.connect(into);
      var lifted = true;
      steps.forEach(function (s) {
        if (s.rest) { if (!lifted) bg.gain.setTargetAtTime(0, s.t, 0.02); lifted = true; return; }
        if (s.newBow || lifted) {
          bg.gain.setTargetAtTime(lv * (s.acc ? 0.34 : 0.22), s.t, 0.004);
          bg.gain.setTargetAtTime(lv * 0.06, s.t + 0.03, 0.03);
        }
        lifted = false;
      });
      bg.gain.setTargetAtTime(0, tEnd - 0.03, 0.03);
      count(3, t0, tEnd + 0.2);
      return n + 3;
    }

    // ======================================================================
    // HANDBELLS (round 3: the ward's handbell choir — every technique a
    // ringer has, and a bell that can be struck again while it rings)
    // ======================================================================
    // THE CASTING. An English handbell is a thin bronze bell turned on a
    // lathe until its second mode — the (3,0), which rings a twelfth over
    // the fundamental — sits at exactly three times it (Rossing & Sathoff,
    // "Modes of vibration and sound radiation from tuned handbells", 1980).
    // That tuned twelfth is why a handbell choir sounds bright and never
    // sour: a bell carries its own pure fifth an octave up, and in Kolob's
    // tuning the twelfth of do lands exactly on the octave of the choir's
    // sol, the twelfth of fa on do. So here the fundamental and the twelfth
    // are exact (1 and 3 — no detune, ever), and what is left of the casting
    // is a little untuned: a pair of upper partials near 5.4× and 8.6× that
    // die in a tenth of a second (their exact places a property of each bell,
    // fixed by its pitch — every G5 in the colony is the same G5), and a
    // faint doublet under the fundamental, the slow warble of a bell whose
    // bronze is a hair thicker on one side.
    //
    // THE STRIKE. A padded clapper knocks the inside of the lip: a short,
    // soft knock (lower for the big bells, whose clappers are bigger), and
    // the harder the stroke the more of the upper partials and the twelfth.
    // A bell rings a long time — a C5 about eight seconds before it has gone
    // 60 dB down, the bass bells longer, the treble shorter — unless the
    // ringer stops it.
    //
    // THE TECHNIQUES (tech):
    //   "ring"   rung, and let vibrate (LV): it rings to its natural end, or
    //            until damp (the director's hand at a phrase's end)
    //   "damp"   rung, and damped at the shoulder at `damp` (R: the ordinary
    //            way — each note stopped when the next begins)
    //   "mart"   martellato: the bell's lip struck down onto the padded
    //            table — a bright stroke and a dull thump, stopped at once
    //   "thumb"  thumb damp: rung with a thumb on the casting — a short,
    //            clear plink
    //   "shake"  shaken: the clapper rattled against both walls, ~9–11
    //            strokes a second, for `shake.dur` seconds — a trembling,
    //            sustained bell; then damped, or let ring
    // A bell struck again while it still rings is ONE ring re-struck (hits):
    // the bronze takes the new stroke on top of what is still sounding —
    // never a second set of partials beating against the first.
    //
    // THE BUDGET. One ring is 11 nodes — a gain for the bell, four partials
    // (an oscillator and a gain each) and the clapper (a buffer and a gain)
    // — however many times it is struck; 12 when it makes its own panner
    // (give it `dest`, a panner the ringer's bell keeps for the whole piece,
    // and it makes none). The shake's strokes and a re-strike are automation,
    // not nodes: a phone pays per ring, never per stroke.
    //
    // ring(t, o) → nodes
    //   o: { f, v (0–1, the first stroke), tech, hits: [{at, v}] (more
    //        strokes, s after t), damp (s after t | null), until (s after t:
    //        a hard stop, faded — a natural end or a steal), shake: {rate,
    //        dur, at (s after t: a shake begun on a later stroke)}, pan | dest }
    // handbell(t, f, {dur?, v, pan}) — the round-2 call: dur given, damped
    //   then; omitted, let ring
    var BELL_KNOCKS = typeof WeakMap !== "undefined" ? new WeakMap() : null;
    function knockBuf(kind, reg) {
      var cache = BELL_KNOCKS && BELL_KNOCKS.get(ctx);
      if (!cache) { cache = {}; if (BELL_KNOCKS) BELL_KNOCKS.set(ctx, cache); }
      var key = kind + reg;
      if (cache[key]) return cache[key];
      // (a fixed recipe: the knock is a texture, the same every stroke)
      var r = mulberry(0x6e11 + key.length * 131 + reg * 977 + (kind === "pad" ? 7 : kind === "thumb" ? 13 : 0));
      var sr = ctx.sampleRate, len = Math.floor(sr * (kind === "pad" ? 0.07 : 0.03));
      var b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
      // the knock's colour: a padded clapper low for the bass bells, higher
      // in the treble; the table's pad a dull thump under a small click
      var fc = [900, 1500, 2400][reg], lp = 0, lp2 = 0, a = 1 - Math.exp(-2 * Math.PI * fc / sr), aT = 1 - Math.exp(-2 * Math.PI * 240 / sr);
      var peak = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, w = r() * 2 - 1;
        lp += a * (w - lp); lp2 += aT * (w - lp2);
        var click = lp * Math.exp(-t / (kind === "thumb" ? 0.0018 : 0.0025));
        var v = kind === "pad" ? 0.35 * click + 2.6 * lp2 * Math.exp(-t / 0.016) : click;
        // the first samples rise over 0.4 ms (a knock, not a step)
        v *= Math.min(1, i / (0.0004 * sr));
        d[i] = v; peak = Math.max(peak, Math.abs(v));
      }
      // …and the last 3 ms fall away, so a knock buffer ends at zero
      var tailN = Math.floor(0.003 * sr);
      for (var j = 0; j < tailN; j++) d[len - 1 - j] *= j / tailN;
      for (var k = 0; k < len; k++) d[k] /= peak || 1;
      return (cache[key] = b);
    }
    // a train of knocks — every stroke of a re-struck or shaken ring, in one
    // buffer (one source, however many strokes)
    function knockTrain(base, hits) {
      var sr = ctx.sampleRate, src = base.getChannelData(0), lastAt = hits[hits.length - 1].at;
      var len = Math.floor((lastAt + base.duration) * sr) + 2;
      var b = ctx.createBuffer(1, len, sr), d = b.getChannelData(0);
      hits.forEach(function (h) {
        var o = Math.floor(h.at * sr), g = h.k;
        for (var i = 0; i < src.length && o + i < len; i++) d[o + i] += src[i] * g;
      });
      return b;
    }
    var upperWaves = {};
    function upperWave(r1, r2) {
      var key = r1 + ":" + r2;
      if (upperWaves[key]) return upperWaves[key];
      return (upperWaves[key] = r2 ? wave([[r1, 1], [r2, 0.45]]) : wave([[r1, 1]]));
    }
    var maxRingNodes = 0;
    function ring(t, o) {
      o = o || {};
      var f = o.f, tech = o.tech || (o.damp != null ? "damp" : "ring");
      if (!(f > 0)) return 0;
      var v0 = Math.max(0.02, Math.min(1, o.v != null ? o.v : 0.7));
      var cast = casting(f), sr = ctx.sampleRate;
      var n = 0;
      // the strokes: the first, then any re-strikes, then a shake's clapper
      var hits = [{ at: 0, v: v0 }];
      (o.hits || []).forEach(function (h) { if (h && h.at > 0.02) hits.push({ at: h.at, v: Math.max(0.02, Math.min(1, h.v != null ? h.v : v0)) }); });
      if (tech === "shake") {
        // (the shake may begin on a later stroke of the same ring: shake.at)
        var sk = o.shake || {}, rate = sk.rate || R.rnd(9, 11), sdur = sk.dur != null ? sk.dur : 1, sat = sk.at || 0;
        for (var a = sat + 1 / rate; a < sat + sdur; a += (1 / rate) * R.rnd(0.88, 1.12)) hits.push({ at: a, v: v0 * R.rnd(0.42, 0.55), shake: true });
      }
      hits.sort(function (x, y) { return x.at - y.at; });
      // (strokes closer than 12 ms are one stroke to the ear, and to the
      // automation — each stroke's attack must end before the next begins)
      hits = hits.filter(function (h, i) { return i === 0 || h.at - hits[i - 1].at >= 0.012; });
      // how the bronze decays under this technique (s): the pad and the
      // thumb take the ring away at once
      var tau1 = bellTau(f), tau3 = tau1 * 0.45, tauU = 0.07 + 0.08 * Math.pow(523 / f, 0.5), tauD = tau1 * 0.85;
      if (tech === "mart") { tau1 = Math.min(tau1, 0.085); tau3 = 0.045; tauU = 0.022; tauD = 0.06; }
      if (tech === "thumb") { tau1 = Math.min(tau1, 0.15); tau3 = 0.07; tauU = 0.03; tauD = 0.12; }
      // when it stops: damped, a hard stop (faded), or its natural end —
      // and no stroke after it (a stroke the hand never makes)
      var stopAt = 0, natural = 0, damped = false;
      for (var pass = 0; pass < 2; pass++) {
        natural = hits[hits.length - 1].at + 6.9 * tau1;
        stopAt = natural; damped = false;
        if (o.damp != null && o.damp < stopAt) { stopAt = o.damp; damped = true; }
        if (o.until != null && o.until < stopAt) { stopAt = o.until; damped = false; }
        stopAt = Math.max(stopAt, 0.02);
        hits = hits.filter(function (h, i) { return i === 0 || h.at < stopAt - 0.012; });
      }
      var cut = stopAt < natural - 1e-6;
      var dampTau = tech === "mart" ? 0.03 : damped ? 0.022 : 0.05;
      var tEnd = t + stopAt + 8 * dampTau + 0.02;

      // the bell's bus: damping and a shake's tremble live here
      var bus = ctx.createGain(); n++;
      bus.gain.setValueAtTime(1, t);
      if (o.dest) bus.connect(o.dest);
      else { var pn = panner(o.pan || 0, t); bus.connect(pn); n++; }
      if (tech === "shake") {
        // the bell swings back and forth in the hand: each stroke lifts it,
        // the swing away lowers it (linear ramps: a trembling, never a step;
        // every ramp ends before the damp begins)
        hits.forEach(function (h) {
          if (!h.shake || h.at + 0.055 > stopAt - 0.004) return;
          bus.gain.linearRampToValueAtTime(1, t + h.at + 0.006);
          bus.gain.linearRampToValueAtTime(0.8, t + h.at + 0.055);
        });
      }
      // the stop begins from wherever the bus stands (a target, never a
      // step): the shoulder's damp, a steal's quick fade, or — at the
      // natural end — a last fade under the silence
      if (cut) bus.gain.setTargetAtTime(0, t + Math.max(0.004, stopAt), dampTau);
      else bus.gain.setTargetAtTime(0, t + Math.max(0.01, stopAt - 0.25), 0.05);

      var A1 = 0.16 * Math.pow(v0, 1.1);
      function amp(kind, v) {
        var a1 = 0.16 * Math.pow(v, 1.1);
        if (kind === "f") return a1;
        if (kind === "d") return tech === "mart" ? 0 : a1 * 0.2;
        if (kind === "3") return a1 * (0.3 + 0.3 * v);
        return a1 * (0.04 + 0.22 * v * v) * (tech === "mart" ? 1.6 : tech === "thumb" ? 0.5 : 1);
      }
      // one partial: every stroke adds to what is still ringing (energy
      // adds; the phases are the bronze's business)
      function partial(kind, fr, pw, tau) {
        if (!(fr > 0) || fr > sr * 0.45) return;
        var os = ctx.createOscillator(), g = ctx.createGain(); n += 2;
        g.gain.value = 0;                     // (silent from birth, not from its first event)
        if (pw) os.setPeriodicWave(pw); else os.type = "sine";
        os.frequency.setValueAtTime(fr, t);
        var peak = 0, tp = t, atk = kind === "u" ? 0.0015 : 0.0025;
        g.gain.setValueAtTime(0, t);
        hits.forEach(function (h) {
          var at = t + h.at, add = amp(kind, h.v);
          if (!(add > 0)) return;
          var cur = peak * Math.exp(-Math.max(0, at - tp) / tau);
          var next = Math.sqrt(cur * cur + add * add);
          if (h.at > 0) g.gain.setValueAtTime(cur, at);
          g.gain.linearRampToValueAtTime(next, at + atk);
          g.gain.setTargetAtTime(0, at + atk, tau);
          peak = next; tp = at + atk;
        });
        os.connect(g); g.connect(bus);
        os.start(t); os.stop(tEnd);
      }
      partial("f", f, null, tau1);
      partial("d", f + cast.beat, null, tauD);
      partial("3", 3 * f, null, tau3);
      var h1 = Math.round(cast.r1 * 10), h2 = Math.round(cast.r2 * 10);
      if (f * h1 / 10 < sr * 0.45) partial("u", f / 10, upperWave(h1, f * h2 / 10 < sr * 0.45 ? h2 : 0), tauU);

      // the clapper (and, for a martellato, the table's pad)
      var reg = f < 400 ? 0 : f < 900 ? 1 : 2;
      var kind = tech === "mart" ? "pad" : tech === "thumb" ? "thumb" : "clapper";
      var base = knockBuf(kind, reg);
      var kLvl = A1 * (tech === "mart" ? 1.1 : tech === "thumb" ? 0.2 : 0.18 + 0.22 * v0);
      var src = ctx.createBufferSource(), kg = ctx.createGain(); n += 2;
      if (hits.length > 1) {
        src.buffer = knockTrain(base, hits.map(function (h) { return { at: h.at, k: Math.pow(h.v / v0, 1.1) * (h.shake ? 0.55 : 1) }; }));
      } else src.buffer = base;
      kg.gain.value = kLvl;
      src.connect(kg); kg.connect(bus);
      src.start(t);
      if (n > maxRingNodes) maxRingNodes = n;
      count(n, t, tEnd);
      return n;
    }
    function handbell(t, f, o) {
      o = o || {};
      return ring(t, { f: f, v: o.v != null ? Math.min(1, o.v) : 1, tech: o.tech || (o.dur != null ? "damp" : "ring"), damp: o.dur != null ? o.dur : null, pan: o.pan || 0, dest: o.dest, hits: o.hits, shake: o.shake, until: o.until });
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
      // (the dice are thrown whatever the caller hands over — a gull's throat
      // is its own; a tune's bird, round 3c, may set its scoop and fall
      // shorter, so a quick phrase keeps each held pitch clear of the next)
      var hold0 = R.rnd(0.18, 0.32), up0 = R.rnd(0.05, 0.09), fall0 = R.rnd(0.14, 0.24);
      var hold = kind === "ha" ? 0.05 + 0.03 * (hold0 - 0.18) / 0.14 : (o.hold != null ? o.hold : hold0);
      var up = kind === "ha" ? 0.025 : (o.up != null ? o.up : up0);
      var fall = kind === "ha" ? 0.07 : (o.fall != null ? o.fall : fall0);
      var tEnd = t + up + hold + fall + 0.05;
      var os = ctx.createOscillator(); os.setPeriodicWave(gullW);
      // kee — the scoop up to the pitch — hold — ow, the fall away
      kRate(os.frequency);
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
      count(8, t, tEnd);
      return 8;
    }
    // a flock crossing: the lead bird traces the notes; the others chatter.
    // notes: frequencies, or {f, dur} (the tune's own rhythm: a note's cry is
    // held for about half its length). (The guest, kolob-guest-gulls.js,
    // lays out each cry itself and calls gull(); this is the lab's flock.)
    function gulls(t, o) {
      o = o || {};
      var notes = (o.notes || []).map(function (x) { return typeof x === "number" ? { f: x } : x; }).filter(function (x) { return x && x.f > 0; });
      var beat = o.beat || 0.42, birds = o.birds != null ? Math.max(0, o.birds) : 5;
      var from = o.from != null ? o.from : -0.8, to = o.to != null ? o.to : 0.8;
      var dist = o.dist != null ? o.dist : 0.3, v = o.v != null ? o.v : 1;
      var len = 0; notes.forEach(function (x) { len += x.dur || beat; });
      var span = Math.max(len, 2.5) + 1.5, n = 0;
      function panAt(tt) { var x = Math.max(0, Math.min(1, (tt - t) / span)); return from + (to - from) * x; }
      function distAt(tt) { var x = Math.max(0, Math.min(1, (tt - t) / span)); return dist + (1 - dist) * 0.55 * Math.pow(2 * x - 1, 2); }
      // the gulls' register is ~650–1400 Hz. The TUNE moves there by one
      // octave shift for the whole head, chosen to put its middle (the
      // geometric mean of its lowest and highest notes) nearest 954 Hz — so
      // every step and leap keeps its direction. (Folding note by note would
      // send a tune's last rise down a seventh.) The chatter is only pitches
      // drawn from the tune, kept within the lead's own span (an octave from
      // just under its lowest note), so the flock never contradicts it.
      var shift = 1, fs = notes.map(function (x) { return x.f; });
      if (fs.length) shift = Math.pow(2, Math.round(Math.log(954 / Math.sqrt(Math.min.apply(null, fs) * Math.max.apply(null, fs))) / Math.LN2));
      var lo = fs.length ? Math.min.apply(null, fs) * shift * 0.94 : 650;
      function fold(f) { while (f < lo) f *= 2; while (f >= lo * 2) f /= 2; return f; }
      var tt = t + 0.6;
      notes.forEach(function (x) {
        var d = x.dur || beat, at = tt + R.rnd(-0.03, 0.03);
        n += gull(at, x.f * shift, { hold: d * 0.55, pan: panAt(at), dist: distAt(at), v: v });
        tt += d;
      });
      // the chatter: short cries and laughs from the rest of the flock
      var chatter = Math.round(birds * span * 0.55);
      for (var c = 0; c < chatter; c++) {
        var ct = t + R.rnd(0, span);
        var base = fold(fs.length ? R.pick(fs) * shift * R.pick([1, 1.5, 0.75]) : R.rnd(700, 1200));
        var kind = R.chance(0.45) ? "ha" : "long";
        var d2 = Math.min(1, distAt(ct) + R.rnd(0.1, 0.35));
        if (kind === "ha") {
          var k = Math.floor(R.rnd(2, 5));
          for (var j = 0; j < k; j++) n += gull(ct + j * R.rnd(0.12, 0.16), base * (1 - j * 0.03), { kind: "ha", pan: panAt(ct) + R.rnd(-0.25, 0.25), dist: d2, v: v * 0.8 });
        } else n += gull(ct, base * R.rnd(0.97, 1.03), { pan: panAt(ct) + R.rnd(-0.25, 0.25), dist: d2, v: v * 0.75 });
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
      // the whole cart travels: one panner, one approach-and-recede gain —
      // or (o.still, round 3c) it stands in the company and the company's
      // road carries it (KOLOB.VoicesBand.road: the handcart guest): a level
      // held (in and out over half a second), the carts a little apart
      var pn = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      var near = ctx.createGain();
      var air = ctx.createBiquadFilter(); air.type = "lowpass"; air.Q.value = 0.5;   // distance darkens
      if (o.still) {
        if (pn.pan) pn.pan.setValueAtTime(Math.max(-1, Math.min(1, (o.spread != null ? o.spread : 0.25) * (ci % 2 ? 1 : -1) * (1 + ci) / 2)), t);
        near.gain.setValueAtTime(0, t);
        near.gain.linearRampToValueAtTime(v, t + 0.5);
        near.gain.setValueAtTime(v, tEnd - 0.5);
        near.gain.linearRampToValueAtTime(0, tEnd);
        air.frequency.setValueAtTime(6500, t);
      } else {
        if (pn.pan) { pn.pan.setValueAtTime(from, t); pn.pan.linearRampToValueAtTime(to, tEnd); }
        near.gain.setValueAtTime(0, t);
        near.gain.linearRampToValueAtTime(v, t + dur * 0.4);
        near.gain.setValueAtTime(v, t + dur * 0.6);
        near.gain.linearRampToValueAtTime(0, tEnd);
        air.frequency.setValueAtTime(1800, t); air.frequency.linearRampToValueAtTime(6500, t + dur * 0.45);
        air.frequency.setValueAtTime(6500, t + dur * 0.55); air.frequency.linearRampToValueAtTime(1800, tEnd);
      }
      near.connect(air); air.connect(pn); pn.connect(o.dest || out);
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
      kRate(ax.frequency);
      var r0 = R.rnd(95, 150);
      // stick-slip is never steady: the rate stumbles — 2.5–3.5 % RMS, peaks
      // near ±10 % (a tone either way), up to ~20 times a second — the
      // difference between a creak and a buzz. The noise through the 22 Hz
      // lowpass is 0.025 RMS, so the depth is scaled to the axle's own rate.
      var jit = ctx.createBiquadFilter(); jit.type = "lowpass"; jit.frequency.value = 22;
      var jg = ctx.createGain(); jg.gain.value = r0 * R.rnd(1.0, 1.4);
      noise(t, dur + 0.1, jit); jit.connect(jg); jg.connect(ax.frequency);
      var w1 = ctx.createBiquadFilter(); w1.type = "bandpass"; w1.frequency.value = R.rnd(850, 1100); w1.Q.value = 6;
      var w2 = ctx.createBiquadFilter(); w2.type = "bandpass"; w2.frequency.value = R.rnd(1700, 2300); w2.Q.value = 7;
      var ag = ctx.createGain(); ag.gain.setValueAtTime(0, t);
      ax.connect(w1); ax.connect(w2); w1.connect(ag); w2.connect(ag); ag.connect(near);
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
      n += 7;                                       // ax, jit, jg + its noise, w1, w2, ag
      count(13, t, tEnd + 0.1);                     // + near, air, pn and the gravel's cr, cg, noise
      return n;
    }
    function knock(t, dest, amt) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      kRate(o.frequency);
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
      var live = 0, peak = 0, until = 0;
      ev.forEach(function (e) { live += e[1]; if (live > peak) peak = live; if (e[1] < 0 && e[0] > until) until = e[0]; });
      return { standing: standing, created: created, peakLive: peak + standing, until: until, maxRing: maxRingNodes };
    }

    return {
      out: out,
      fiddle: fiddle, handbell: handbell, handbells: handbells, ring: ring,
      gull: gull, gulls: gulls, wheels: wheels,
      stats: report,
    };
  }

  return { create: create, bell: { tau: bellTau, life: bellLife, casting: casting } };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-voices-folk.js"] = true;   // the load guard's roll call (round 3b, step 3: the handbells ring in the meeting)

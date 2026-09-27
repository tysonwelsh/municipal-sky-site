// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — THE BRASS BAND (KOLOB.VoicesBand)
//
// The Nauvoo Brass Band crossed the plains in 1846 and played the camps to
// sleep; the colony kept the name and the instrumentation, because a
// saxhorn band is the right size for a town square at the edge of the
// light. Cornet on the tune, alto horns on the after-beats, the tuba's
// oom-pah under everything, and a snare and bass drum kept LIGHT — this is
// a parade, not a battle.
//
// What makes brass sound like brass, done cheaply:
//  · BRIGHTNESS FOLLOWS BREATH. A lip-buzzed horn grows richer in upper
//    harmonics as it gets louder — the one physical fact the ear uses to
//    tell brass from an organ reed. Each note runs a harmonic-rich wave
//    through a lowpass whose cutoff rises with the note's attack and its
//    dynamic, then settles back as the lips relax.
//  · THE LIP FINDS THE NOTE. Every tongued note starts a few cents flat and
//    locks on within ~30 ms: the slot of the harmonic series catching.
//  · SECTIONS HAVE A GRAIN. The cornet and tuba buses run a soft saturator
//    — at forte the edge (cuivré) comes up on its own; at piano it is
//    transparent. The alto horns stay clean: they play chords, and a shared
//    saturator would beat the chord's notes against each other.
//  · Conical bores: cornet and alto horn (saxhorns) are mellower than a
//    trumpet — the waves fall off faster and the formant sits lower.
//
//  · THE CORNET BITES. Its wave is the ff spectrum and the lowpass makes
//    every softer dynamic out of it; a tongued note flares brighter for its
//    first ~15 ms, then settles. At ff the upper harmonics stand up (H5 8–14
//    dB and H10 about 20–23 dB under the fundamental) — the lead has to cut
//    through a town square. At piano it stays round.
//
// THE TROMBONES (Kolob 2, round 2: the trombone choir at dawn). The
// Moravians brought the trombone choir to Bethlehem in 1754 — soprano,
// alto, tenor and bass trombones, which played chorales from the belfry to
// announce a death, a feast, the new year — and to Salem, where brass
// choirs have answered each other across the town before the Easter
// sunrise since 1772. The colony has three of the four: the alto, the
// tenor and the bass. They are not the band's saxhorns and they do not
// march; they play hymns, slowly, and soft.
//  · A ROUND, WARM BORE. A trombone's tone at piano is almost all
//    fundamental and the first few harmonics, gathered under a formant
//    near 500 Hz (the bass lower, the alto higher); it only opens up as the
//    player leans in — at forte the harmonics to the tenth stand within
//    ~20 dB of the fundamental. The wave is the forte spectrum, and a gentle
//    lowpass makes every softer dynamic out of it: its cutoff is a multiple
//    of the pitch, but never under the bell's own brightness, which rises
//    with the dynamic in absolute terms (so a bass note is dark at piano and
//    still opens at forte).
//  · THE BELL CANNOT SING ITS LOWEST PARTIAL. Below about 100 Hz the bell
//    radiates poorly, so a bass trombone's pedal register speaks through
//    its second and third harmonics: the wave's low partials are rolled
//    off (a radiation high-pass per instrument), so the choir is deep
//    without booming.
//  · BREATH AND LEGATO. A note can begin on a slow breath attack (atk up to
//    half a second), a soft tongue (the default), or legato — re-struck
//    under a gentle dip while the note before it lets go (a crossfade, never
//    a gap). The harmonics lag the breath a little: the cutoff opens over
//    the first ~1.3 attacks. A note can swell or fade across its length
//    (dynEnd): a chorale phrase is an arch, and a fermata dies away. No
//    vibrato — the Moravian chorale is played straight — only the slide
//    placed by hand (±2 cents, the synth stream's) and a slow drift of a
//    cent or two on long notes.
//  · A WIDER DYNAMIC. Level follows (d/0.6)^1.5: pp is 14 dB under mf and
//    ff 6 dB over it (the saxhorns' 7.7 dB pp→ff was the wave-1 critic's
//    complaint; the trombones do not inherit it). At mf a four-part choir
//    matches the calibrated organ reference in the instruments lab (the
//    v0.30 organChord at mid-prelude): see the trombone lab's calibration.
//
// FAR ACROSS THE TOWN (create opts.distance, 0–1): a band can stand in the
// hall's doorway (0) or at the far end of the colony (1). Distance is four
// things at once, as the ear judges it — the direct sound falls (−22·d^1.5
// dB: −3 at 0.25, −17 at 0.85) and loses its air (a gentle lowpass sliding
// from 16 kHz down to 340 Hz; 6.4 kHz at 0.25, 600 Hz at 0.85: a soft brass
// choir has little above a kilohertz to lose, so the veil has to reach down
// into its body); the town's own reverberance
// rises against it (from 8 dB under the direct sound to 8 dB over: a send
// into a shared
// "town room", KOLOB.VoicesBand.townRoom — an outdoor tail of ~2.6 s,
// dark, with a few early reflections off the houses); the gap between the
// direct sound and that tail SHRINKS (pre-delay 50 ms near, 10 ms far: a far
// source and its reverberance arrive nearly together); and beyond 0.4 an
// echo comes back off the facing houses (0.19–0.31 s, dark, from the other
// side). opts.side seats the whole band left or right; opts.spread narrows
// the players' own seating (a far choir is one point; a near one has width).
// A band made with no distance is built exactly as before — no extra nodes.
//
// Cost (reported by stats(), counted from the nodes actually built): 3 per
// brass note (osc → lowpass → gain); a snare stroke 5, a bass-drum stroke 5,
// a flam 10, a roll 25; 8 standing nodes per band (plus 1 per trombone
// section, built on its first note; plus the distance stage: 5 near, 9
// beyond 0.4, and 4 for a town room of its own when none is shared). The
// quickstep strain in the lab peaks at about 45 live nodes; a four-part
// trombone chorale about 30. The per-note brightness sweeps are read once
// per 128-sample block (k-rate): they move over tens of milliseconds, and it
// keeps each note's filter off the per-sample path.
//
// Public surface: KOLOB.VoicesBand.create(ctx, destination, opts) → band
//   opts: { gain (1), rand (a PJ2.Rand stream, "synth:band") | seed,
//           distance (0–1; omit for none), room (a shared townRoom),
//           side (−1…1: where the whole band stands), spread (1: the
//           players' own seating, scaled) }
//   band.play(t, notes, instrument, dynamics)
//      notes: [{f, dur, at?, acc?, stacc?, dyn?}]  instrument: "cornet"|"alto"|"tuba"
//      trombones ("altoTrombone"|"tenorTrombone"|"bassTrombone") also read
//        { atk (s: the attack; 0.3–0.5 is a breath attack), legato (a soft
//          re-strike: this note's attack overlaps the last one's release),
//          dynEnd (the dynamic the note swells or fades to by its end),
//          rel (s: the release's time constant; 0.06 by default) }
//      dynamics: "pp"…"ff" or 0–1
//   band.dispose()  — disconnect the band (and its distance stage) at once
//   KOLOB.VoicesBand.townRoom(ctx, destination, {seconds, gain}) → room
//      { input, out, dispose() } — one shared outdoor tail for several bands
//   KOLOB.VoicesBand.warm(ctx) — build the town's tail ahead of time (a few
//      tens of ms, once per context: do it at start-up, not in a callback)
//   KOLOB.VoicesBand.distanceDb(d), .dynamicDb(dyn) — pure: how much quieter
//      a band sounds at distance d than in the doorway, and a trombone's
//      level at a dynamic against mf (dB)
//   band.drum(t, kind, dynamics)             kind: "snare"|"flam"|"roll"|"bass"
//      Every stroke sounds AT OR AFTER t — nothing reaches back before the
//      time it was asked for, so a clock callback can never schedule into
//      the past. The accent lands KOLOB.VoicesBand.LEAD[kind] seconds after
//      t (flam 0.028, roll 0.2, snare and bass 0): to put a roll's accent on
//      beat b, call drum(b - LEAD.roll, "roll").
//   band.out (a gain — fade and pan the whole band from outside)
//   band.stats() → { standing, created, peakLive }
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.VoicesBand = (function () {
  "use strict";

  var DYN = { ppp: 0.12, pp: 0.2, p: 0.32, mp: 0.45, mf: 0.6, f: 0.78, ff: 0.95, fff: 1 };
  function dynOf(d) { return typeof d === "number" && isFinite(d) ? Math.max(0, Math.min(1, d)) : (DYN[d] != null ? DYN[d] : 0.6); }   // anything unreadable is mf: a note never throws

  // the sections: spectral tilt of the wave, the formant the bell throws,
  // cutoff range (× f) from piano to forte, attack, where they stand, level
  // The attack's brightness: the cutoff runs from lo×f up to its peak —
  // lo + (hi − lo) × dyn^curve, times f — times a FLARE (bloom, or bloomAcc
  // on an accent; bloomDyn lets the flare grow with the dynamic), reached at
  // flareAt × atk, then settles to `settle` × peak with time constant
  // settleTau. The alto horns and the tuba keep the round attack they had;
  // the cornet bites (a steeper curve, a higher top, a real flare).
  var INSTR = {
    cornet: { tilt: 0.7,  formant: 1250, fw: 1100, lo: 2.2, hi: 16, curve: 3.0, settle: 0.85, bloom: 1.7,  bloomAcc: 2.0,  bloomDyn: 0.3, flareAt: 0.6, settleTau: 0.06, atk: 0.022, scoop: 22, pan: -0.28, level: 0.11,  grain: 1.6, vib: 4 },
    alto:   { tilt: 1.25, formant: 800,  fw: 500, lo: 1.8, hi: 5.5, curve: 1.4, settle: 0.72, bloom: 1.05, bloomAcc: 1.15, bloomDyn: 0,   flareAt: 1.2, settleTau: 0.08, atk: 0.034, scoop: 14, pan: 0.22,  level: 0.055, grain: 0,   vib: 0 },
    tuba:   { tilt: 1.05, formant: 420,  fw: 320, lo: 2.5, hi: 9,   curve: 1.4, settle: 0.72, bloom: 1.05, bloomAcc: 1.15, bloomDyn: 0,   flareAt: 1.2, settleTau: 0.08, atk: 0.045, scoop: 18, pan: 0.04,  level: 0.12,  grain: 1.2, vib: 0 },
  };
  // how far ahead of t each drum stroke's accent lands (every stroke sounds
  // at or after t)
  var LEAD = { snare: 0, bass: 0, flam: 0.028, roll: 0.2 };

  // THE TROMBONES: spectral tilt and formant as above (the forte
  // spectrum); rad, the bell's radiation corner (Hz) under which the low
  // partials roll off; the lowpass runs lo…hi × f from pp to ff (dyn^curve)
  // but never under the bell's own brightness, bell × (300 + 1500 · dyn^1.6)
  // Hz — a trombone opens up in absolute terms as it is blown harder, so a
  // bass note is not starved of its upper partials; atk, the soft-tongued
  // attack; scoop, the cents the lip settles through; pan, the player's seat
  // (scaled by opts.spread); level at mf (0.6), where the four-part choir
  // meets the organ reference.
  var TBN = {
    altoTrombone:  { tilt: 0.75, formant: 690, fw: 560, rad: 150, lo: 1.4, hi: 13, curve: 1.6, bell: 1.1, atk: 0.05,  scoop: 9, pan: -0.3,  level: 0.037 },
    tenorTrombone: { tilt: 0.7,  formant: 540, fw: 500, rad: 110, lo: 1.4, hi: 13, curve: 1.6, bell: 1.0, atk: 0.055, scoop: 8, pan: -0.04, level: 0.037 },
    bassTrombone:  { tilt: 0.7,  formant: 390, fw: 420, rad: 78,  lo: 1.5, hi: 13, curve: 1.6, bell: 0.9, atk: 0.065, scoop: 7, pan: 0.3,   level: 0.037 },
  };
  // amplitude against the dynamic, relative to mf: pp −14 dB, ff +6 dB
  function tbnAmp(d) { return Math.pow(Math.max(0.05, d) / 0.6, 1.5); }

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
    var next = (window.PJ2 && PJ2.Rand) ? PJ2.Rand.stream(opts.seed || 1846).fork("synth:band").next : mulberry(opts.seed || 1846);
    return { rnd: function (a, b) { return a + next() * (b - a); }, chance: function (p) { return next() < p; } };
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

  // ---- the town's own air ----------------------------------------------------
  // An outdoor tail, not a hall: a few early reflections off the nearest
  // houses (23–97 ms), then decorrelated noise dying away over `seconds`
  // (RT60 ≈ 0.85 × seconds) and darkening as it goes — high frequencies die
  // first in open air. The right channel is the left through two Schroeder
  // allpasses (below): decorrelated, with the same spectrum, so a choir on
  // either side gets the same air. One factor sets unit power gain where the
  // music lives (150 Hz – 1.5 kHz), so a send's gain is the wet level a brass
  // choir actually gets. The same town for every seed (a fixed noise seed): it is a place,
  // not a performance. Cached per context and length; building one takes a
  // few tens of milliseconds, so an engine should call warm(ctx) at start-up
  // rather than let the first performance build it inside a clock callback.
  var TOWN = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  // a Schroeder allpass: a flat magnitude response and a dense, scattered
  // phase — the right channel is the left one through two of these, so the
  // two sides of the town are decorrelated yet have IDENTICAL spectra (a
  // choir on the left gets exactly the air a choir on the right does; two
  // independent noise tails differ by a decibel or two in any one band)
  function allpass(x, D, g) {
    var y = new Float32Array(x.length);
    for (var i = 0; i < x.length; i++) {
      var xd = i >= D ? x[i - D] : 0, yd = i >= D ? y[i - D] : 0;
      y[i] = -g * x[i] + xd + g * yd;
    }
    return y;
  }
  function townIR(ctx, seconds) {
    var cache = TOWN && TOWN.get(ctx);
    if (!cache) { cache = {}; if (TOWN) TOWN.set(ctx, cache); }
    var key = String(seconds);
    if (cache[key]) return cache[key];
    var sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * seconds));
    var buf = ctx.createBuffer(2, len, sr), rt = seconds * 0.85;
    var EARLY = [[0.023, 0.5], [0.041, -0.36], [0.067, 0.28], [0.097, -0.2]];
    var L = buf.getChannelData(0), r = mulberry(0x70776e), lp = 0;
    for (var i = 0; i < len; i++) {
      var tt = i / sr;
      var env = Math.exp(-6.9 * tt / rt) * Math.min(1, tt / 0.012);
      var a = 0.08 + 0.55 * Math.exp(-tt / 0.9);              // the one-pole's coefficient: darker with time
      lp += a * ((r() * 2 - 1) - lp);
      L[i] = lp * env;
    }
    EARLY.forEach(function (e) { var ix = Math.floor(e[0] * sr); if (ix < len) L[ix] += e[1] * 0.35; });
    var Rt = allpass(allpass(L, Math.round(0.0061 * sr), 0.5), Math.round(0.0087 * sr), 0.5);
    buf.getChannelData(1).set(Rt);
    // one factor for both: unit power gain where the music lives — 32
    // Goertzel probes, 150 Hz–1.5 kHz (a dark tail keeps its energy low, so a
    // whole-band normalisation would leave it ~8 dB hot there)
    var band = 0;
    for (var pb = 0; pb < 32; pb++) {
      var w = 2 * Math.PI * 150 * Math.pow(10, pb / 31) / sr, cw = 2 * Math.cos(w), s1 = 0, s2 = 0;
      for (var j = 0; j < len; j++) { var s0 = L[j] + cw * s1 - s2; s2 = s1; s1 = s0; }
      band += s1 * s1 + s2 * s2 - cw * s1 * s2;
    }
    var nrm = 1 / Math.sqrt(band / 32 + 1e-12);
    for (var c2 = 0; c2 < 2; c2++) { var dd = buf.getChannelData(c2); for (var q = 0; q < len; q++) dd[q] *= nrm; }
    cache[key] = buf;
    return buf;
  }
  function townRoom(ctx, destination, o) {
    o = o || {};
    var input = ctx.createGain();
    var conv = ctx.createConvolver();
    conv.normalize = false;
    conv.buffer = townIR(ctx, o.seconds || 2.6);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3800; lp.Q.value = 0.5;
    var g = ctx.createGain(); g.gain.value = o.gain != null ? o.gain : 1;
    input.connect(conv); conv.connect(lp); lp.connect(g); g.connect(destination);
    return {
      input: input, out: g, nodes: 4,
      dispose: function () { [input, conv, lp, g].forEach(function (n) { try { n.disconnect(); } catch (e) {} }); },
    };
  }

  // ---- distance: the direct sound, the town's air, and the echo ---------------
  // (see the header, FAR ACROSS THE TOWN). The curves, pure:
  function dirDbAt(d) { return -22 * Math.pow(d, 1.5); }             // −3 dB at 0.25, −17 at 0.85, −22 at 1
  function airDbAt(d) { return dirDbAt(d) - 8 + 16 * d; }            // the town's air: 8 under the direct … 8 over
  function veilAt(d) { return 16000 * Math.pow(340 / 16000, d); }    // the lowpass: 6.4 kHz at 0.25, 600 Hz at 0.85
  function echoAt(d) { return d > 0.4 ? 0.3 * ((d - 0.4) / 0.6) : 0; }
  // how loud a band sounds at distance d, in dB against the same band with
  // no distance stage — MEASURED, not modelled: a four-part trombone choir
  // (OLD HUNDRED at mf, dry chain, integrated LUFS, the mean of three seeds,
  // which agree within ±0.4 dB; p gives the same curve) rendered in the
  // trombone lab at each distance. (A power sum of direct +
  // air + echo tracks it to d = 0.5 and then over-states the loss: a wet
  // sound fills its own breaths, and loudness counts them.) A performer uses
  // it to set two bands a chosen number of LU apart, whatever their drawn
  // distances.
  // (where the echo's comb makes the curve wobble, 0.6–0.7, the running
  // minimum keeps it monotone)
  var DIST_DB = [[0, 0.73], [0.15, -0.83], [0.25, -1.4], [0.35, -3.4], [0.5, -4.1], [0.6, -7.33], [0.7, -7.33], [0.75, -8.1], [0.8, -9.73], [0.85, -11.37], [0.9, -12.47], [1, -16.9]];
  function distanceDb(d) {
    d = Math.max(0, Math.min(1, +d || 0));
    for (var i = 1; i < DIST_DB.length; i++) {
      var a = DIST_DB[i - 1], b = DIST_DB[i];
      if (d <= b[0]) return a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]);
    }
    return DIST_DB[DIST_DB.length - 1][1];
  }
  // Built once per band.
  function distanceStage(ctx, destination, d, room, side, R) {
    var nodes = [], echoDelay = R.rnd(0.19, 0.31);             // drawn always: a die is never skipped
    var input = ctx.createGain(); nodes.push(input);
    var dirDb = dirDbAt(d);
    var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.5;
    lp.frequency.value = veilAt(d); nodes.push(lp);
    var direct = ctx.createGain(); direct.gain.value = Math.pow(10, dirDb / 20); nodes.push(direct);
    input.connect(lp); lp.connect(direct); direct.connect(destination);
    var own = null;
    if (!room) { own = townRoom(ctx, destination, {}); room = own; }
    var pre = ctx.createDelay(0.2); pre.delayTime.value = 0.05 - 0.04 * d; nodes.push(pre);
    // the town's air against the direct sound: 8 dB under it in the doorway,
    // 8 dB over it at the far end of the colony
    var send = ctx.createGain(); send.gain.value = Math.pow(10, airDbAt(d) / 20); nodes.push(send);
    lp.connect(pre); pre.connect(send); send.connect(room.input);
    if (d > 0.4) {
      var ed = ctx.createDelay(0.6); ed.delayTime.value = echoDelay;
      var elp = ctx.createBiquadFilter(); elp.type = "lowpass"; elp.frequency.value = 1500; elp.Q.value = 0.5;
      var eg = ctx.createGain(); eg.gain.value = echoAt(d) * direct.gain.value;
      var ep = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (ep.pan) ep.pan.value = Math.max(-1, Math.min(1, -side * 0.5));      // off the houses across the way
      lp.connect(ed); ed.connect(elp); elp.connect(eg); eg.connect(ep); ep.connect(destination);
      nodes.push(ed, elp, eg, ep);
    }
    return {
      input: input, nodes: nodes.length + (own ? own.nodes : 0),
      dispose: function () {
        nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        if (own) own.dispose();
      },
    };
  }

  function create(ctx, destination, opts) {
    opts = opts || {};
    var R = streamOf(opts);
    var created = 0, spans = [];
    function count(n, t0, t1) { created += n; spans.push([t0, t1, n]); }

    var side = Math.max(-1, Math.min(1, +opts.side || 0));
    var spread = opts.spread != null ? Math.max(0, +opts.spread) : 1;
    var out = ctx.createGain(); out.gain.value = 0.8 * (opts.gain != null ? opts.gain : 1);
    var stage = null;
    if (opts.distance != null) {
      stage = distanceStage(ctx, destination, Math.max(0, Math.min(1, +opts.distance)), opts.room || null, side, R);
      out.connect(stage.input);
    } else out.connect(destination);
    function panner(p) {
      var sp = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      if (sp.pan) sp.pan.value = Math.max(-1, Math.min(1, side + p * spread));
      sp.connect(out);
      return sp;
    }
    // soft saturation: transparent at piano, an edge at forte
    function grain(drive) {
      var ws = ctx.createWaveShaper(), c = new Float32Array(1024);
      for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * drive) / Math.tanh(drive); }
      ws.curve = c; ws.oversample = "2x";
      return ws;
    }
    var buses = {}, standing = 1;
    Object.keys(INSTR).forEach(function (k) {
      var spec = INSTR[k], p = panner(spec.pan);
      if (spec.grain) { var ws = grain(spec.grain); ws.connect(p); buses[k] = ws; standing += 2; }
      else { buses[k] = p; standing += 1; }
    });
    var drums = panner(0.08); standing += 1;
    var drumLP = ctx.createBiquadFilter(); drumLP.type = "lowpass"; drumLP.frequency.value = 7500; drumLP.connect(drums); standing += 1;
    if (stage) standing += stage.nodes;
    // a trombone section's seat is built on its first note (a saxhorn band
    // that never plays a chorale pays nothing for it)
    function tbnBus(k) {
      if (!buses[k]) { buses[k] = panner(TBN[k].pan); standing += 1; }
      return buses[k];
    }

    // one wave per section and register (cached by quarter-octave band)
    var waves = {};
    function waveFor(k, f) {
      var band = Math.round(Math.log(f) / Math.LN2 * 4), key = k + band;
      if (waves[key]) return waves[key];
      var spec = INSTR[k] || TBN[k], fb = Math.pow(2, band / 4);
      var n = Math.min(48, Math.floor(10000 / fb)), real = new Float32Array(n + 1), imag = new Float32Array(n + 1), ss = 0;
      for (var h = 1; h <= n; h++) {
        var hz = h * fb;
        var a = Math.pow(h, -spec.tilt) * (0.55 + Math.exp(-Math.pow((hz - spec.formant) / spec.fw, 2)));
        if (spec.rad) a *= hz * hz / (hz * hz + spec.rad * spec.rad);   // the bell's radiation (trombones)
        imag[h] = a; ss += a * a;
      }
      var nrm = 0.8 / Math.sqrt(ss / 2 + 1e-9);
      for (var j = 1; j <= n; j++) imag[j] *= nrm;
      try { waves[key] = ctx.createPeriodicWave(real, imag, { disableNormalization: true }); }
      catch (e) { waves[key] = ctx.createPeriodicWave(real, imag); }
      return waves[key];
    }

    // pitch and brightness automation is read once a block (see the header)
    function kRate(p) { try { p.automationRate = "k-rate"; } catch (e) {} }
    // one tongued brass note
    function note(t, f, dur, k, dyn, acc, stacc) {
      var spec = INSTR[k];
      var d = Math.min(1, dyn * (acc ? 1.18 : 1));
      var len = stacc ? Math.min(dur, Math.max(0.09, dur * 0.45)) : dur * 0.94;
      var rel = t + len, tEnd = rel + 0.25;
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.setPeriodicWave(waveFor(k, f));
      kRate(o.frequency); kRate(o.detune); kRate(lp.frequency);
      // the lip finds the slot: a few cents flat, locked within ~30 ms
      var sc = spec.scoop * (0.6 + 0.8 * d) * R.rnd(0.7, 1.2);
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(-sc, t);
      o.detune.setTargetAtTime(0, t + 0.004, 0.012);
      if (spec.vib && len > 0.5) {                     // a little cornet vibrato on held notes only
        o.detune.setValueAtTime(0, t + 0.25);
        for (var vt = t + 0.3, ph = 0; vt < rel - 0.05; vt += 0.09, ph++) o.detune.linearRampToValueAtTime(ph % 2 ? -spec.vib : spec.vib, vt);
      }
      // brightness follows breath: the cutoff flares with the tongue, then
      // settles where the dynamic holds it
      var cLo = Math.min(9000, f * spec.lo);
      var cPk = Math.min(14000, f * (spec.lo + (spec.hi - spec.lo) * Math.pow(d, spec.curve)));
      var flare = (acc ? spec.bloomAcc : spec.bloom) * (1 - spec.bloomDyn + spec.bloomDyn * d);
      lp.type = "lowpass"; lp.Q.value = 1.1;
      lp.frequency.setValueAtTime(cLo, t);
      lp.frequency.linearRampToValueAtTime(Math.min(16000, cPk * flare), t + spec.atk * spec.flareAt);
      lp.frequency.setTargetAtTime(cPk * spec.settle, t + spec.atk * spec.flareAt, spec.settleTau);
      lp.frequency.setTargetAtTime(cLo, rel, 0.03);
      var lv = spec.level * (0.25 + 0.75 * d);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lv * (acc ? 1.2 : 1.05), t + spec.atk);
      g.gain.setTargetAtTime(lv, t + spec.atk, 0.06);
      // the release starts from wherever the accent's bloom has got to — no
      // anchor: pinning lv here snapped a still-decaying bloom down by up to
      // 10 % in one sample, a click on every short accented note (wave-1
      // critic, round 2)
      g.gain.setTargetAtTime(0, Math.max(t + spec.atk + 0.01, rel), stacc ? 0.018 : 0.035);
      o.connect(lp); lp.connect(g); g.connect(buses[k]);
      o.start(t); o.stop(tEnd);
      count(3, t, tEnd);
      return 3;
    }

    // one trombone note (see THE TROMBONES in the header). dur is the note's
    // full written length: it lets go at t + dur, and a legato successor
    // placed there crossfades with its release — there is never a gap.
    function tromboneNote(t, f, dur, k, d, nt) {
      var spec = TBN[k];
      var dEnd = nt.dynEnd != null ? dynOf(nt.dynEnd) : d;
      if (nt.acc) { d = Math.min(1, d * 1.12); }
      var legato = !!nt.legato;
      var atk = nt.atk != null ? +nt.atk : (legato ? 0.035 : spec.atk);
      atk = Math.max(0.012, Math.min(atk, dur * 0.5));
      var tau = nt.rel != null ? Math.max(0.012, +nt.rel) : 0.06;
      var rel = t + dur, tEnd = rel + tau * 9 + 0.02;
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.setPeriodicWave(waveFor(k, f));
      kRate(o.frequency); kRate(o.detune); kRate(lp.frequency);
      // the slide, placed by hand; the lip settles into the slot from below
      var det = (nt.det || 0) + R.rnd(-2.2, 2.2);
      var sc = spec.scoop * (legato ? 0.4 : 1) * (0.6 + 0.6 * d) * R.rnd(0.7, 1.2);
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(det - sc, t);
      o.detune.setTargetAtTime(det, t + 0.004, 0.018 + Math.min(0.03, atk * 0.1));
      if (dur > 1.2) {                                // a long note breathes: a cent or two, slowly
        var w = R.rnd(-1.6, 1.6);
        o.detune.setValueAtTime(det, t + Math.min(0.35, dur * 0.3));
        o.detune.linearRampToValueAtTime(det + w, t + dur * 0.55);
        o.detune.linearRampToValueAtTime(det - w * 0.5, rel);
      }
      // brightness follows breath, and lags it a little
      function cut(dd) {
        return Math.min(12000, Math.max(f * (spec.lo + (spec.hi - spec.lo) * Math.pow(dd, spec.curve)), spec.bell * (300 + 1500 * Math.pow(dd, 1.6))));
      }
      var cSus = cut(d), cEnd = cut(dEnd), cLo = Math.min(cSus, Math.max(f * spec.lo, spec.bell * 260));
      var open = t + atk * 1.3;
      lp.type = "lowpass"; lp.Q.value = 0.75;
      lp.frequency.setValueAtTime(legato ? cSus * 0.8 : cLo, t);
      lp.frequency.linearRampToValueAtTime(cSus * (nt.acc ? 1.25 : 1.06), open);
      lp.frequency.setTargetAtTime(cSus, open, 0.08);
      var mid = Math.max(open + 0.2, t + dur * 0.5);
      if (mid < rel && Math.abs(cEnd - cSus) > 1) lp.frequency.setTargetAtTime(cEnd, mid, Math.max(0.05, (rel - mid) / 2.5));
      lp.frequency.setTargetAtTime(cLo, rel, tau * 1.5);
      // the breath: in, across the note (a swell or a fade), and away
      var lv = spec.level * tbnAmp(d), lvEnd = spec.level * tbnAmp(dEnd);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(lv, t + atk);
      g.gain.linearRampToValueAtTime(lvEnd, rel);
      g.gain.setTargetAtTime(0, rel, tau);
      o.connect(lp); lp.connect(g); g.connect(tbnBus(k));
      o.start(t); o.stop(tEnd);
      count(3, t, tEnd);
      return 3;
    }

    function play(t, notes, instrument, dynamics) {
      var dyn = dynOf(dynamics), n = 0;
      if (TBN[instrument]) {
        notes.forEach(function (nt) {
          var d = nt.dyn != null ? dynOf(nt.dyn) : dyn;
          if (nt.f > 0 && nt.dur > 0) n += tromboneNote(t + (nt.at || 0), nt.f, nt.dur, instrument, d, nt);
        });
        return n;
      }
      var k = INSTR[instrument] ? instrument : "cornet";
      notes.forEach(function (nt) {
        var d = nt.dyn != null ? dynOf(nt.dyn) : dyn;
        n += note(t + (nt.at || 0), nt.f, nt.dur, k, d, !!nt.acc, !!nt.stacc);
      });
      return n;
    }

    // ---- the drums, kept light ------------------------------------------
    function snare(t, lv) {
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var hp = ctx.createBiquadFilter(); hp.type = "bandpass"; hp.frequency.value = R.rnd(3200, 3800); hp.Q.value = 0.7;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(lv * 0.5, t + 0.002);
      gn.gain.setTargetAtTime(0, t + 0.004, 0.045);
      src.connect(hp); hp.connect(gn); gn.connect(drumLP);
      src.start(t, R.rnd(0, 1.7)); src.stop(t + 0.35);
      var o = ctx.createOscillator(), go = ctx.createGain();
      o.type = "triangle"; o.frequency.setValueAtTime(215, t); o.frequency.exponentialRampToValueAtTime(175, t + 0.05);
      go.gain.setValueAtTime(0, t); go.gain.linearRampToValueAtTime(lv * 0.35, t + 0.002);
      go.gain.setTargetAtTime(0, t + 0.004, 0.025);
      o.connect(go); go.connect(drumLP);
      o.start(t); o.stop(t + 0.2);
      count(5, t, t + 0.35);
      return 5;
    }
    function bassDrum(t, lv) {
      var o = ctx.createOscillator(), go = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(92, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.12);
      go.gain.setValueAtTime(0, t); go.gain.linearRampToValueAtTime(lv * 0.8, t + 0.004);
      go.gain.setTargetAtTime(0, t + 0.01, 0.13);
      o.connect(go); go.connect(drums);
      o.start(t); o.stop(t + 0.9);
      var src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(lv * 0.25, t + 0.002);
      gn.gain.setTargetAtTime(0, t + 0.004, 0.02);
      src.connect(lp); lp.connect(gn); gn.connect(drums);
      src.start(t, R.rnd(0, 1.7)); src.stop(t + 0.15);
      count(5, t, t + 0.9);
      return 5;
    }
    // every stroke at or after t: the accent lands LEAD[kind] later
    function drum(t, kind, dynamics) {
      var lv = 0.3 * (0.25 + 0.75 * dynOf(dynamics));
      if (kind === "bass") return bassDrum(t, lv);
      if (kind === "flam") return snare(t, lv * 0.45) + snare(t + LEAD.flam, lv);
      if (kind === "roll") {                         // a five-stroke roll from t to its accent at t + 0.2
        var n = 0;
        for (var i = 0; i < 4; i++) n += snare(t + i * 0.05, lv * (0.35 + i * 0.06));
        return n + snare(t + LEAD.roll, lv);
      }
      return snare(t, lv);
    }

    function report() {
      var ev = [];
      spans.forEach(function (s) { ev.push([s[0], s[2]], [s[1], -s[2]]); });
      ev.sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
      var live = 0, peak = 0, until = 0;
      ev.forEach(function (e) { live += e[1]; if (live > peak) peak = live; if (e[1] < 0 && e[0] > until) until = e[0]; });
      return { standing: standing, created: created, peakLive: peak + standing, until: until };
    }

    // let the band go at once: every standing node and the distance stage
    // (a performer calls this once the last note has rung out)
    function dispose() {
      try { out.disconnect(); } catch (e) {}
      Object.keys(buses).forEach(function (k) { try { buses[k].disconnect(); } catch (e) {} });
      try { drumLP.disconnect(); drums.disconnect(); } catch (e) {}
      if (stage) stage.dispose();
    }

    return { out: out, play: play, drum: drum, stats: report, dispose: dispose };
  }

  return {
    create: create, townRoom: townRoom,
    warm: function (ctx, seconds) { townIR(ctx, seconds || 2.6); },
    // pure level curves, for a performer placing bands against each other
    distanceDb: distanceDb, dynamicDb: function (dyn) { return 20 * Math.log10(tbnAmp(dynOf(dyn))); },
    INSTRUMENTS: Object.keys(INSTR), TROMBONES: Object.keys(TBN),
    DYNAMICS: DYN, LEAD: LEAD,
  };
})();

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
// march; they play hymns, slowly.
//
// THE PRE-v0.34 POLISH (PLAN-COMPOSITION §15). The owner listened to round
// 2's choir and heard "a muted, muddy organ". He was right, and the
// measurements say why: at the near choir's p–mp the lowpass stood near
// 900 Hz on a tenor (about the fourth harmonic), the far choir sat behind a
// 600 Hz blanket, every attack was a soft 50–65 ms swell with no tongue in
// it, and a legato note was a crossfade between two pitches — which is what
// an organ does. A trombone is a buzzing lip on a long bright tube. Now:
//  · A BRIGHT, SINGING BORE. The wave is the forte spectrum, richer than
//    before (a gentler tilt), and the lowpass that makes the softer
//    dynamics out of it stands two to three times higher: a tenor's cutoff
//    runs about 0.9 kHz at pp, 1.6 at mp, 2.1 at mf and 2.8 at f (it is a
//    multiple of the pitch, but never under the bell's own brightness,
//    which rises with the dynamic in absolute terms, so a bass note opens
//    too).
//  · THE BRASS OPENS WITH THE BREATH. A peaking band at the brass's own
//    region (about 1.1 kHz on a tenor, 1.35 on the alto, 0.95 on the bass)
//    swings from −2 dB at pp to +8 dB at ff, so the spectrum's balance
//    point climbs with loudness the way real brass does — the one physical
//    fact the ear uses to tell brass from an organ, whose colour does not
//    change with its level.
//  · THE TONGUE AND THE LIP. A tongued note starts on a short "t": a 20 ms
//    breath of band-limited noise near the seventh harmonic, then the lip
//    finds its slot from a few cents under (a scoop that settles in ~20
//    ms), and the upper partials bloom a little past where they settle
//    (brass speaks bright and relaxes). A breath attack (the phrase's first
//    chord, atk ≥ 0.12 s) has no tongue: air first, the tone after.
//  · LEGATO IS TONGUED. A trombone cannot slur without a glissando, so the
//    chorale's joined notes are legato-tongued: the note before lets go
//    quickly (its release set by the performer), the next speaks within
//    ~25 ms on a soft tongue and a smaller scoop — a line with a pulse in
//    it, never the organ's crossfade.
//  · THE BELL CANNOT SING ITS LOWEST PARTIAL. Below about 100 Hz the bell
//    radiates poorly, so a bass trombone's pedal register speaks through
//    its second and third harmonics (a radiation high-pass per instrument):
//    the choir is deep without booming.
//  · A NOTE CAN SWELL OR FADE (dynEnd): a chorale phrase is an arch, and a
//    fermata dies away — and its colour darkens as it fades. No vibrato:
//    the Moravian chorale is played straight, only the slide placed by hand
//    (±2 cents, the synth stream's) and a slow drift of a cent or two.
//  · A WIDER DYNAMIC. Level follows (d/0.6)^1.5: pp is 14 dB under mf and
//    ff 6 dB over it. At mf a four-part choir matches the calibrated organ
//    reference in the instruments lab (the v0.30 organChord at
//    mid-prelude): see the trombone lab's calibration.
//
// FAR ACROSS THE TOWN (create opts.distance, 0–1): a band can stand in the
// hall's doorway (0) or at the far end of the colony (1). Distance is what
// the ear judges it by — and it is NOT a blanket lowpass (round 2's veil
// fell to 600 Hz at 0.85, and the far choir came through it as a hum):
//  · the direct sound falls (−22·d^1.5 dB: −3 at 0.25, −17 at 0.85);
//  · the air takes the top gently: a high shelf above 2.5 kHz, −14·d dB
//    (−3.5 at 0.25, −12 at 0.85), under a lowpass that only closes to
//    5 kHz at the far end — the body and the brass of the tone stay;
//  · the town's own reverberance rises against it (from 8 dB under the
//    direct sound to 8 dB over: a send into a shared "town room",
//    KOLOB.VoicesBand.townRoom — an outdoor tail of ~2.6 s, darkening, with
//    early reflections off the houses);
//  · the gap between the direct sound and that tail SHRINKS (pre-delay 50
//    ms near, 10 ms far: a far source and its reverberance arrive nearly
//    together);
//  · beyond 0.4 an echo comes back off the facing houses (0.19–0.31 s, from
//    the other side);
//  · and the performer seats it: opts.side sets the band left or right, and
//    opts.spread narrows the players' own seating (a far choir is one
//    point; a near one has width).
// A band made with no distance is built exactly as before — no extra nodes.
//
// Cost (reported by stats(), counted from the nodes actually built): 3 per
// saxhorn note (osc → lowpass → gain); a trombone note 4 (osc → lowpass →
// brass band → gain) and 3 more for its tongue (noise → bandpass → gain,
// 90 ms); a snare stroke 5, a bass-drum stroke 5, a flam 10, a roll 25; 8
// standing nodes per band (plus 1 per trombone section, built on its first
// note; plus the distance stage: 6 near, 10 beyond 0.4, and 4 for a town
// room of its own when none is shared). The quickstep strain in the lab
// peaks at about 45 live nodes. The per-note brightness sweeps are read once
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
//   KOLOB.VoicesBand.road(ctx, destination, {room, echoDelay}) → road
//      { input, path([{t, d, side}, …]), nodes, dispose() } — a traveller
//      (round 3c: the Nauvoo band marching past, the handcart company):
//      the distance stage's four curves and the side, laid along a path
//      (see A ROAD THROUGH THE TOWN). Make the band with no distance and
//      play it into road.input.
//   KOLOB.VoicesBand.lendTown(ctx, destination, {seconds}) → a town room made
//      ahead by warm(), joined to destination; its dispose() gives it back
//      (round 3c: no guest makes a convolver inside a clock callback)
//   KOLOB.VoicesBand.warm(ctx) — build the town's tail, one town room to lend,
//      the noise and the saxhorns' waves, ahead of time (a few tens of ms,
//      once per context: do it at start-up, not in a callback)
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

  // THE TROMBONES: spectral tilt and formant of the wave (the forte
  // spectrum); rad, the bell's radiation corner (Hz) under which the low
  // partials roll off; the lowpass runs (lo + span · dyn^curve) × f, but
  // never under the bell's own brightness, bell × (700 + 2600 · dyn^1.5) Hz;
  // brass, the centre of the band that opens with the dynamic; atk and
  // legAtk, a tongued and a legato-tongued attack; bloom, how far the
  // partials overshoot as a tongued note speaks, and settle, how fast they
  // relax; scoop, the cents the lip settles through; pan, the player's seat
  // (scaled by opts.spread); level at mf (0.6), where the four-part choir
  // meets the organ reference (the trombone lab's calibration).
  var TBN = {
    altoTrombone:  { tilt: 0.35, formant: 800, fw: 900, rad: 150, lo: 2.5, span: 20, curve: 1.3, bell: 1.1, brass: 1400, atk: 0.026, legAtk: 0.022, bloom: 1.35, settle: 0.07, scoop: 16, pan: -0.3,  level: 0.03 },
    tenorTrombone: { tilt: 0.3,  formant: 650, fw: 850, rad: 110, lo: 2.5, span: 20, curve: 1.3, bell: 1.0, brass: 1200, atk: 0.03,  legAtk: 0.024, bloom: 1.35, settle: 0.07, scoop: 15, pan: -0.04, level: 0.03 },
    bassTrombone:  { tilt: 0.3,  formant: 480, fw: 700, rad: 78,  lo: 2.7, span: 20, curve: 1.3, bell: 0.9, brass: 1000, atk: 0.036, legAtk: 0.028, bloom: 1.3,  settle: 0.08, scoop: 13, pan: 0.3,   level: 0.03 },
  };
  // amplitude against the dynamic, relative to mf: pp −14 dB, ff +6 dB
  function tbnAmp(d) { return Math.pow(Math.max(0.05, d) / 0.6, 1.5); }
  // the air under a held trombone tone, against the tone's own gain (see THE
  // BREATH in tromboneNote; the trombone lab's hold check measures it)
  var BREATH = 0.1;

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
    input.connect(conv); conv.connect(lp); lp.connect(g);
    if (destination) g.connect(destination);
    return {
      input: input, out: g, nodes: 4,
      dispose: function () { [input, conv, lp, g].forEach(function (n) { try { n.disconnect(); } catch (e) {} }); },
    };
  }

  // ---- the town's air, LENT (round 3c) -------------------------------------------
  // A convolver takes its impulse when it is made — 5–6 ms of main thread for
  // the 2.6 s town, too much for one clock callback. So warm(ctx) makes one
  // town room ahead (at start-up, with the impulse), unconnected, and
  // lendTown(ctx, destination) lends it to a performer at its press: joined
  // to that performer's bus, and given back (unjoined) by the performer's
  // dispose(). A second performer at the same time gets a room made there
  // and then (and it joins the pool when given back).
  var POOL = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function pooled(ctx, seconds) {
    var list = POOL ? POOL.get(ctx) : null;
    if (!list) { list = []; if (POOL) POOL.set(ctx, list); }
    for (var i = 0; i < list.length; i++) if (!list[i].busy && list[i].seconds === seconds) return list[i];
    var r = townRoom(ctx, null, { seconds: seconds });
    r.seconds = seconds; r.busy = false; list.push(r);
    return r;
  }
  function lendTown(ctx, destination, o) {
    var r = pooled(ctx, (o && o.seconds) || 2.6), given = false;
    r.busy = true; r.out.connect(destination);
    return {
      input: r.input, out: r.out, nodes: 0, lent: true,
      dispose: function () { if (given) return; given = true; try { r.out.disconnect(destination); } catch (e) {} r.busy = false; },
    };
  }

  // ---- distance: the direct sound, the town's air, and the echo ---------------
  // (see the header, FAR ACROSS THE TOWN). The curves, pure:
  function dirDbAt(d) { return -22 * Math.pow(d, 1.5); }             // −3 dB at 0.25, −17 at 0.85, −22 at 1
  function airDbAt(d) { return dirDbAt(d) - 8 + 16 * d; }            // the town's air: 8 under the direct … 8 over
  function veilAt(d) { return 16000 * Math.pow(5000 / 16000, d); }   // a gentle lowpass: 12 kHz at 0.25, 6 kHz at 0.85, 5 kHz at 1
  function shelfDbAt(d) { return -14 * d; }                          // the air's loss above 2.5 kHz: −3.5 dB at 0.25, −12 at 0.85
  function echoAt(d) { return d > 0.4 ? 0.3 * ((d - 0.4) / 0.6) : 0; }
  // how loud a band sounds at distance d, in dB against the same band with
  // no distance stage — MEASURED, not modelled: a four-part trombone choir
  // (OLD HUNDRED at mf, dry chain, integrated LUFS, the mean of seeds 1–3)
  // rendered in the trombone lab at each distance, re-measured for the
  // pre-v0.34 polish's stage (the gentle high-cut in place of round 2's
  // blanket lowpass loses less at the far end: −10.8 dB at 0.85 where the
  // veil lost −11.4, −13.5 at 1 where it lost −16.9). (A power sum of
  // direct + air + echo tracks it to d = 0.5 and then over-states the loss:
  // a wet sound fills its own breaths, and loudness counts them.) A
  // performer uses it to set two bands a chosen number of LU apart,
  // whatever their drawn distances.
  var DIST_DB = [[0, 0.83], [0.15, -0.6], [0.25, -1.83], [0.35, -3.37], [0.5, -4.7], [0.6, -7.43], [0.7, -8.13], [0.75, -8.77], [0.8, -9.7], [0.85, -10.83], [0.9, -11.4], [1, -13.5]];
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
    var veil = ctx.createBiquadFilter(); veil.type = "lowpass"; veil.Q.value = 0.5;
    veil.frequency.value = veilAt(d); nodes.push(veil);
    var lp = ctx.createBiquadFilter(); lp.type = "highshelf"; lp.frequency.value = 2500;
    lp.gain.value = shelfDbAt(d); nodes.push(lp);
    var direct = ctx.createGain(); direct.gain.value = Math.pow(10, dirDb / 20); nodes.push(direct);
    input.connect(veil); veil.connect(lp); lp.connect(direct); direct.connect(destination);
    var own = null;
    if (!room) { own = townRoom(ctx, destination, {}); room = own; }
    var pre = ctx.createDelay(0.2); pre.delayTime.value = 0.05 - 0.04 * d; nodes.push(pre);
    // the town's air against the direct sound: 8 dB under it in the doorway,
    // 8 dB over it at the far end of the colony
    var send = ctx.createGain(); send.gain.value = Math.pow(10, airDbAt(d) / 20); nodes.push(send);
    lp.connect(pre); pre.connect(send); send.connect(room.input);
    if (d > 0.4) {
      var ed = ctx.createDelay(0.6); ed.delayTime.value = echoDelay;
      var elp = ctx.createBiquadFilter(); elp.type = "lowpass"; elp.frequency.value = 2500; elp.Q.value = 0.5;
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

  // ---- A ROAD THROUGH THE TOWN (round 3c): a source that TRAVELS ------------
  // The distance stage above stands still: a choir placed once, far or near.
  // A marching band does not. It comes up the road from one end of the
  // colony, passes the meetinghouse and goes on out of the other, and the
  // ear follows it by the same four facts, now moving: the direct sound
  // rises and falls (dirDbAt), the air takes less of its top as it nears
  // (veilAt, shelfDbAt), the town's reverberance stands against it and
  // then under it (airDbAt, through one shared townRoom — and leaning
  // toward the traveller, AIR_LEAN of its own side: the street it is
  // walking rings nearest it, so a band far off at one end of the colony
  // is heard at that end, not all around), and the echo off the facing houses fades
  // in as it goes far (echoAt, from the other side). Its place in the field
  // (side, −1 … 1) turns with it. road(ctx, destination, {room, echoDelay})
  // → { input, path(points), nodes, dispose() }: path([{t, d, side}, …])
  // lays every one of those curves along the points (a straight ramp between
  // two, so a point a second or so apart draws a smooth passage). Built
  // once per traveller: 12 nodes (16 with a town room of its own).
  var AIR_LEAN = 0.5;
  function road(ctx, destination, o) {
    o = o || {};
    var nodes = [];
    function mk(n) { nodes.push(n); return n; }
    var input = mk(ctx.createGain());
    var veil = mk(ctx.createBiquadFilter()); veil.type = "lowpass"; veil.Q.value = 0.5; veil.frequency.value = veilAt(1);
    var shelf = mk(ctx.createBiquadFilter()); shelf.type = "highshelf"; shelf.frequency.value = 2500; shelf.gain.value = shelfDbAt(1);
    var direct = mk(ctx.createGain()); direct.gain.value = 0;
    var pan = mk(ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain());
    input.connect(veil); veil.connect(shelf); shelf.connect(direct); direct.connect(pan); pan.connect(destination);
    var own = null, room = o.room || null;
    if (!room) { own = townRoom(ctx, destination, {}); room = own; }
    var pre = mk(ctx.createDelay(0.2)); pre.delayTime.value = 0.03;
    var send = mk(ctx.createGain()); send.gain.value = 0;
    var airPan = mk(ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain());
    shelf.connect(pre); pre.connect(send); send.connect(airPan); airPan.connect(room.input);
    var ed = mk(ctx.createDelay(0.6)); ed.delayTime.value = o.echoDelay != null ? o.echoDelay : 0.25;
    var elp = mk(ctx.createBiquadFilter()); elp.type = "lowpass"; elp.frequency.value = 2500; elp.Q.value = 0.5;
    var eg = mk(ctx.createGain()); eg.gain.value = 0;
    var ep = mk(ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain());
    shelf.connect(ed); ed.connect(elp); elp.connect(eg); eg.connect(ep); ep.connect(destination);
    function lay(param, pts, fn) {
      pts.forEach(function (p, i) {
        var v = fn(p);
        if (i === 0) param.setValueAtTime(v, p.t); else param.linearRampToValueAtTime(v, p.t);
      });
    }
    function path(points) {
      var pts = (points || []).filter(function (p) { return p && isFinite(p.t) && isFinite(p.d); });
      if (!pts.length) return;
      function dd(p) { return Math.max(0, Math.min(1, p.d)); }
      function sd(p) { return Math.max(-1, Math.min(1, p.side || 0)); }
      lay(veil.frequency, pts, function (p) { return veilAt(dd(p)); });
      lay(shelf.gain, pts, function (p) { return shelfDbAt(dd(p)); });
      lay(direct.gain, pts, function (p) { return Math.pow(10, dirDbAt(dd(p)) / 20); });
      // (a stereo panner sums a band's near-alike channels into one side:
      // up to 1 + sin(πp/2) in power. The send gives that back, so the lean
      // moves the air and adds nothing to it)
      lay(send.gain, pts, function (p) { return Math.pow(10, airDbAt(dd(p)) / 20) / (airPan.pan ? Math.sqrt(1 + Math.sin(Math.abs(sd(p) * AIR_LEAN) * Math.PI / 2)) : 1); });
      lay(eg.gain, pts, function (p) { return echoAt(dd(p)) * Math.pow(10, dirDbAt(dd(p)) / 20); });
      if (pan.pan) lay(pan.pan, pts, sd);
      if (ep.pan) lay(ep.pan, pts, function (p) { return -sd(p) * 0.5; });
      if (airPan.pan) lay(airPan.pan, pts, function (p) { return sd(p) * AIR_LEAN; });
    }
    return {
      input: input, path: path, nodes: nodes.length + (own ? own.nodes : 0),
      dispose: function () {
        nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        if (own) own.dispose();
      },
    };
  }

  // THE WAVES (round 3c): one PeriodicWave per section and quarter-octave
  // band, kept per context (they were kept per band, and a band's first bars
  // built a dozen of them inside a clock callback); warm() builds the
  // saxhorns' ahead, across their compass
  var WAVES = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  function waveOf(ctx, k, f) {
    var waves = WAVES ? WAVES.get(ctx) : null;
    if (!waves) { waves = {}; if (WAVES) WAVES.set(ctx, waves); }
    var band = Math.round(Math.log(f) / Math.LN2 * 4), key = k + band;
    if (waves[key]) return waves[key];
    var spec = INSTR[k] || TBN[k], fb = Math.pow(2, band / 4);
    var n = Math.min(48, Math.floor(10000 / fb)), real = new Float32Array(n + 1), imag = new Float32Array(n + 1), ss = 0;
    for (var h = 1; h <= n; h++) {
      var hz = h * fb;
      var a = Math.pow(h, -spec.tilt) * ((spec.rad ? 0.35 : 0.55) + Math.exp(-Math.pow((hz - spec.formant) / spec.fw, 2)));
      if (spec.rad) a *= hz * hz / (hz * hz + spec.rad * spec.rad);   // the bell's radiation (trombones)
      imag[h] = a; ss += a * a;
    }
    var nrm = 0.8 / Math.sqrt(ss / 2 + 1e-9);
    for (var j = 1; j <= n; j++) imag[j] *= nrm;
    try { waves[key] = ctx.createPeriodicWave(real, imag, { disableNormalization: true }); }
    catch (e) { waves[key] = ctx.createPeriodicWave(real, imag); }
    return waves[key];
  }
  // the saxhorns' compass, for warm(): [lo, hi] Hz
  var COMPASS = { cornet: [220, 1100], alto: [180, 1000], tuba: [38, 240] };
  function warmAll(ctx, seconds) {
    townIR(ctx, seconds || 2.6); pooled(ctx, seconds || 2.6); noiseBuf(ctx);
    Object.keys(COMPASS).forEach(function (k) {
      for (var b = Math.round(Math.log(COMPASS[k][0]) / Math.LN2 * 4); b <= Math.round(Math.log(COMPASS[k][1]) / Math.LN2 * 4); b++) waveOf(ctx, k, Math.pow(2, b / 4));
    });
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

    // one wave per section and register (cached by quarter-octave band, per
    // context: every band on the context shares them — see WAVES)
    function waveFor(k, f) { return waveOf(ctx, k, f); }

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
    // full written length: it lets go at t + dur (its release, nt.rel, is the
    // performer's: quick before a legato-tongued successor, long on a
    // fermata). 7 nodes: the tone 4, and the breath 3 (the tongue's "t" and
    // the air under the tone are one noise path), all for the note's length.
    function tromboneNote(t, f, dur, k, d, nt) {
      var spec = TBN[k];
      var dEnd = nt.dynEnd != null ? dynOf(nt.dynEnd) : d;
      if (nt.acc) { d = Math.min(1, d * 1.12); }
      var legato = !!nt.legato;
      var atk = nt.atk != null ? +nt.atk : (legato ? spec.legAtk : spec.atk);
      atk = Math.max(0.012, Math.min(atk, dur * 0.5));
      var breath = atk >= 0.12;                        // a breath attack: air first, no tongue
      var tau = nt.rel != null ? Math.max(0.012, +nt.rel) : 0.05;
      var rel = t + dur, tEnd = rel + tau * 9 + 0.02;
      var o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), g = ctx.createGain();
      o.setPeriodicWave(waveFor(k, f));
      kRate(o.frequency); kRate(o.detune); kRate(lp.frequency); kRate(pk.gain);
      // THE HELD TONE LIVES (round 2 of the polish; the critic: a held note
      // was a perfectly steady wave — 0.08 dB of movement over 2.4 s of a
      // tenor's fermata, which is what an organ pipe does, and the organ at
      // least has a tremulant). A player's breath is never still: past the
      // attack the level wanders, irregularly, by about ±0.5 dB (±0.3 dB of
      // breath, and the brightness's swing on top of it: the brass band goes
      // with the breath, a little more air a little brighter), and the pitch
      // moves by a cent or two around a slow drift.
      // The wander's points fall every 0.22–0.6 s (synth dice), and the note
      // still lands exactly on its written dynamic at the release.
      var tS = Math.min(rel, t + atk + 0.07);          // the spring of the attack has settled
      var wand = [];
      for (var wt = tS + R.rnd(0.22, 0.6); wt < rel - 0.08; wt += R.rnd(0.22, 0.6)) wand.push({ t: wt, db: R.rnd(-0.3, 0.3), c: R.rnd(-1.8, 1.8) });
      function along(a, b, x) { return a + (b - a) * Math.max(0, Math.min(1, x)); }
      // THE LIP: the slide placed by hand, and the lip settling into the
      // slot from below — a real scoop on a tongued note, less on a legato
      // one, and gentle under a breath
      var det = (nt.det || 0) + R.rnd(-2.2, 2.2);
      var sc = spec.scoop * (legato ? 0.45 : breath ? 0.6 : 1) * (0.7 + 0.8 * d) * R.rnd(0.75, 1.2);
      o.frequency.setValueAtTime(f, t);
      o.detune.setValueAtTime(det - sc, t);
      o.detune.setTargetAtTime(det, t + 0.003, legato ? 0.012 : 0.018 + Math.min(0.03, atk * 0.1));
      if (wand.length) {                               // a held note breathes: a slow drift, and the lip's small unrest on it
        var tP = t + Math.min(0.35, dur * 0.3), w = R.rnd(-1, 1);
        o.detune.setValueAtTime(det, tP);
        wand.forEach(function (p) { if (p.t > tP) o.detune.linearRampToValueAtTime(det + w * (p.t - t) / dur + p.c, p.t); });
        o.detune.linearRampToValueAtTime(det + w, rel);
      }
      // BRIGHTNESS FOLLOWS BREATH: the partials bloom as the note speaks,
      // settle where the dynamic holds them, and follow a swell or a fade
      function cut(dd) {
        return Math.min(14000, Math.max(f * (spec.lo + spec.span * Math.pow(dd, spec.curve)), spec.bell * (800 + 3200 * Math.pow(dd, 1.5))));
      }
      var cSus = cut(d), cEnd = cut(dEnd), cLo = breath ? Math.max(f * 1.3, Math.min(cSus * 0.35, spec.bell * 420)) : Math.max(f * 2, cSus * 0.55);
      var bloomAt = t + atk * (breath ? 1.1 : 0.6);
      var bloom = breath ? 1.05 : legato ? 1.15 : spec.bloom * (nt.acc ? 1.12 : 1);
      lp.type = "lowpass"; lp.Q.value = 1.0;
      lp.frequency.setValueAtTime(legato ? cSus * 0.7 : cLo, t);
      lp.frequency.linearRampToValueAtTime(Math.min(16000, cSus * bloom), bloomAt);
      lp.frequency.setTargetAtTime(cSus, bloomAt, spec.settle);
      var mid = Math.max(bloomAt + 0.2, t + dur * 0.5);
      if (mid < rel && Math.abs(cEnd - cSus) > 1) lp.frequency.setTargetAtTime(cEnd, mid, Math.max(0.05, (rel - mid) / 2.5));
      lp.frequency.setTargetAtTime(cLo, rel, tau * 1.5);
      // THE BRASS OPENS WITH THE BREATH: the brass band's gain climbs with
      // the dynamic, a little further as a tongued note speaks
      // (and the band itself climbs as it opens — the blare of a loud brass
      // note sits higher than the warmth of a soft one)
      function brassDb(dd) { return -3 + 13 * Math.pow(dd, 1.5); }
      pk.type = "peaking"; pk.frequency.value = spec.brass * (0.85 + 0.6 * d); pk.Q.value = 0.8;
      pk.gain.setValueAtTime(brassDb(d) - (legato || breath ? 0 : 2), t);
      pk.gain.linearRampToValueAtTime(brassDb(d) + (breath ? 0 : 1.5), bloomAt);
      pk.gain.setTargetAtTime(brassDb(d), bloomAt, 0.08);
      var tB = bloomAt + 0.4;                          // (the bloom has settled: five of its time constants)
      var bright = wand.filter(function (p) { return p.t > tB; });
      if (bright.length) {
        // the brightness wanders with the breath (the band swings twice the
        // breath's dB) along the note's swell or fade
        pk.gain.setValueAtTime(brassDb(d), tB);
        bright.forEach(function (p) { pk.gain.linearRampToValueAtTime(brassDb(along(d, dEnd, (p.t - t) / dur)) + 2 * p.db, p.t); });
        pk.gain.linearRampToValueAtTime(brassDb(dEnd), rel);
      } else if (mid < rel && Math.abs(dEnd - d) > 0.01) pk.gain.setTargetAtTime(brassDb(dEnd), mid, Math.max(0.05, (rel - mid) / 2.5));
      // the breath: in (a small spring on a tongued note), across the note
      // (a swell or a fade, and the wander), and away
      var lv = spec.level * tbnAmp(d), lvEnd = spec.level * tbnAmp(dEnd);
      g.gain.setValueAtTime(0, t);
      if (breath) g.gain.linearRampToValueAtTime(lv, t + atk);
      else {
        g.gain.linearRampToValueAtTime(lv * (legato ? 1.04 : 1.12), t + atk);
        g.gain.linearRampToValueAtTime(lv, tS);
      }
      wand.forEach(function (p) { if (p.t > tS) g.gain.linearRampToValueAtTime(along(lv, lvEnd, (p.t - tS) / (rel - tS)) * Math.pow(10, p.db / 20), p.t); });
      g.gain.linearRampToValueAtTime(lvEnd, rel);
      g.gain.setTargetAtTime(0, rel, tau);
      var bus = tbnBus(k);
      o.connect(lp); lp.connect(pk); pk.connect(g); g.connect(bus);
      o.start(t); o.stop(tEnd);
      // THE BREATH: band-limited noise near the seventh harmonic. On a
      // tongued note it opens as a "t" (a soft "d" on a legato one) as the
      // tongue lets the air go; under a breath attack it comes first, the
      // tone after. Then it stays, faint — the air through the lips under
      // every held tone, about 30 dB under it at mf and a little nearer
      // the tone as the player blows harder — and follows the note's
      // dynamic to its release (round 2 of the polish: it was 90 ms of "t"
      // and then nothing)
      var bed = lv * BREATH * (0.45 + 0.9 * d), bedEnd = lvEnd * BREATH * (0.45 + 0.9 * dEnd);
      var ns = ctx.createBufferSource(); ns.buffer = noiseBuf(ctx); ns.loop = true;
      var nb = ctx.createBiquadFilter(); nb.type = "bandpass"; nb.frequency.value = Math.min(4000, Math.max(1400, f * 7)); nb.Q.value = 0.9;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(0, t);
      if (breath) {
        ng.gain.linearRampToValueAtTime(bed * 2.2, t + atk * 0.6);
        ng.gain.linearRampToValueAtTime(bed, t + atk + 0.05);
      } else {
        var tl = lv * (legato ? 0.2 : 0.55) * (0.5 + d);
        ng.gain.linearRampToValueAtTime(tl, t + 0.004);
        ng.gain.setTargetAtTime(bed, t + 0.006, 0.012);
        ng.gain.setValueAtTime(bed, t + 0.09);
      }
      ng.gain.linearRampToValueAtTime(bedEnd, Math.max(rel, t + atk + 0.1));
      ng.gain.setTargetAtTime(0, Math.max(rel, t + atk + 0.1), tau);
      ns.connect(nb); nb.connect(ng); ng.connect(bus);
      ns.start(t, R.rnd(0, 1.7)); ns.stop(tEnd);
      count(7, t, tEnd);
      return 7;
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
    create: create, townRoom: townRoom, road: road,
    warm: warmAll,
    lendTown: lendTown,
    // pure level curves, for a performer placing bands against each other
    distanceDb: distanceDb, dynamicDb: function (dyn) { return 20 * Math.log10(tbnAmp(dynOf(dyn))); },
    INSTRUMENTS: Object.keys(INSTR), TROMBONES: Object.keys(TBN),
    DYNAMICS: DYN, LEAD: LEAD,
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-voices-band.js"] = true;   // the load guard's roll call (the engine plays it from round 2: the trombones at dawn)

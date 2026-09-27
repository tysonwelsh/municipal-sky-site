/* pachinko-audio.js — MOTHER LODE's sound (PLAN §8; the contract is in PLAN §12).
 *
 * Procedural Web Audio: no samples, no deps. Every sound is either a small
 * modal synthesis rendered by this file into an AudioBuffer (the clatter,
 * the chimes, the coins, the music box) or live oscillators and seeded
 * noise through biquads (the whistles, the hum, the crack). Deterministic:
 * variation is seeded from the event's own fields and a counter, never
 * Math.random, never Date.
 *
 *   window.PachinkoAudio.attach(handle, unlockEl, opts?)
 *     → { destroy(), setMuted(bool), isUnlocked() }
 *
 *   handle.onEvent(fn)  → unsubscribe (optional). Every event below.
 *   handle.getState()   { mode } (optional; read once, at attach)
 *   handle.view.board   the live board (optional; else PachinkoBoard.base()):
 *                       where the specimens and the tunnel mouths are
 *   unlockEl            a gesture on it (capture phase) creates and resumes
 *                       the AudioContext; so does an `input` event, but only
 *                       inside a live user activation (HOLLER ROLLER's rule)
 *   opts.context        an injected (Offline)AudioContext: the graph is built
 *                       at once, nothing is suspended or resumed, and the
 *                       caller drives api._pump() once a frame (the lab)
 *   opts.seed           the session seed (the distant train's schedule)
 *   opts.train          false: no distant train; or [t, …] (audio s) to force it
 *   opts.room           false: no hum and no mine air (the lab measures contacts dry)
 *
 * ═══════════════════════ THE EVENT CONTRACT ═══════════════════════
 * TIMING. Send `t` (seconds, the sim clock, the same clock as the physics'
 * events) on every event you can. The sound maps sim time onto the audio
 * clock with a 35 ms lead, so the ticks inside one frame keep their true
 * spacing instead of landing as a chord. Events without `t` play at once.
 *
 * PHYSICS (PachinkoPhysics world.events, forwarded verbatim, in order):
 *   drop    {m, x}                         the hopper lets a marble go
 *   pin     {m, id, material, dress, speed, x, y}   THE CLATTER: one tuned tick
 *   rail    {m, id, material, dress, speed, x, y}   floors, track, timbers, faces,
 *                                          dividers, the cart's bucket (id 'cart')
 *   roll    {m, id, material, speed}       rolling along a rail (every 9 px)
 *   wheel   {m, id, material, dress, speed, x, y}   the sheave, the pump, the vent door
 *   ride    {m, id}                        carried over the top of the sheave
 *   clack   {m, other, speed, x, y}        marble on marble (glass on glass)
 *   cart    {m, id, what: 'catch'|'dump', x, y}
 *   tunnel  {m, id, what: 'in'|'out', x, y}
 *   pocket  {m, id, value, legend, x, y}   the lunch pail PLINKs, the powder box
 *                                          tonks; then the shift whistle (below)
 *   slot    {m, id, value, legend, x}      a bay: a thud; a chime per scrip; 13 = the lode
 *   teeter  {m, id, x, y}                  the held breath on the bone over the 13
 *   knock   {m, n, x, y}                   the anti-stall knock: three knocks in the rock
 *   timeout {m, x} · done {m, outcome}
 * GAME (pachinko-main.js and the later phases):
 *   input   {kind}                         any user gesture (unlocks the sound)
 *   mode    {mode: 'attract'|'dive'|'play'|'payout'|'work'}   the music box plays
 *                                          in attract only; the mine's air in play
 *   coin    {tokens?} · nocoin             a token in / an empty pocket
 *   dive    {dir: 1 | -1}                  the push through the glass (−1: back out)
 *   hopper  {x, from?, glide?}             the hopper slides along its rail (glide s)
 *   reload  {left}                         the next marble drops from the feed tube
 *   payout  {n?, total?}                   ONE scrip into the plastic bucket (a
 *                                          count-up is queued ≥ 45 ms apart)
 *   gameover {scrip}                       the closing phrase; the pocket watch ticks
 *   whistle {value?}                       the shift whistle (small wins). Until the
 *                                          game sends one, pockets blow it by themselves.
 *   lode    {x?}                           THE MOTHER LODE. Until the game sends one,
 *                                          the 13 slot sets it off by itself.
 *   stolen  {m, x, y}                      a knocker grabs the marble and runs for it
 *   dark    {region, what: 'flicker'|'out'|'on'}   lamps telegraph / go out / relight
 *   lost    {m, x?}                        the marble never comes out of the dark
 *   cavein  {region, x?, what: 'telegraph'|'fall'|'clear'}
 *   work    {edits}                        the knockers get their tools out
 *   figure  {what: 'step'|'tap'|'pull'|'lay'|'set'|'cheer', x?, y?, who?}   a figurine
 *   rare    {}                             the rare tier's hook: silent on purpose
 * Anything else is ignored.
 * ══════════════════════════════════════════════════════════════════
 *
 * Graph:
 *   ticks, knocks … ─ lane[0..6] (StereoPanner by x) ─┬─ sfx ────────────┐
 *                    └─ send[0..2] (by depth) ─ sendAll ─ mine IR ────────┤
 *   rolls (3 voices, own panners) ────────────────────┘                   │
 *   whistle, chimes, coins, crack … ─ lane / sfx                           ├─ master ─ comp ─ trim ─ soft clip ─ out(mute) ─ dest
 *   train ─ pan ─ lowpass ─┬─ dry ────────────────────────────────────────┤
 *                          └─ far IR (a valley, the ridge echoes) ───────┤
 *   room (hum, the tube's flutter) ─ roomLP ─────────────────────────────┤
 *   air (the mine breathing through the vent door; play only) ───────────┤
 *   music (the music box, attract only) ─────────────────────────────────┘
 *
 * LEVELS (peak dBFS at the output, HOLLER ROLLER's house levels): a pin tick
 * −31…−14 by speed (median ≈ −21), the marble-on-marble clack −30…−15, the
 * pail's PLINK −13, the shift whistle −17, the distant train ≈ −27 with a
 * four-second tail, the hum ≈ −30, the music box −24, the lode ≈ −5 at its
 * crest. The master compressor and soft clip keep everything under −0.5.
 */
(function (root) {
  'use strict';

  /* ── small deterministic helpers ─────────────────────────────────── */
  function lcg(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hashStr(str) {
    var h = 2166136261;
    str = String(str);
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mixh(a, b) {
    var h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h >>> 0;
  }
  function h01(a, b) { return mixh(a, b) / 4294967296; }
  function evSeed(ev, k) {
    var parts = [];
    for (var key in ev) if (Object.prototype.hasOwnProperty.call(ev, key)) {
      var v = ev[key];
      if (typeof v === 'number') parts.push(key + '=' + Math.round(v * 1000));
      else if (typeof v === 'string' || typeof v === 'boolean') parts.push(key + '=' + v);
    }
    parts.sort();
    return hashStr(parts.join('&') + '#' + k);
  }
  function db(x) { return Math.pow(10, x / 20); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function cents(c) { return Math.pow(2, c / 1200); }

  /* ── the tuning: the whole machine is one instrument ──────────────
   * G major pentatonic (G A B D E). Every pin is a tuned nail, every bay a
   * tuned bar, the whistles an E-minor chord of the same notes, the music
   * box in G. A marble falling from the sky to the vein plays a descending
   * run, because each pin's register falls with its depth. */
  var PENTA = [0, 2, 4, 7, 9];
  function inScale(m) { return PENTA.indexOf(((m - 67) % 12 + 12) % 12) >= 0; }
  function scaleBetween(lo, hi) { var out = []; for (var m = lo; m <= hi; m++) if (inScale(m)) out.push(m); return out; }

  /* ── the timbres of the clatter ────────────────────────────────────
   * modes [ratio × f0, amplitude, t60 s]; body [absolute Hz, amp, t60]
   * (a resonance that doesn't follow the pin's pitch); reg [lo, hi] MIDI
   * (the register the pins span, top at the surface, bottom in the vein) or
   * `fixed` (one object, one note); click: the glass marble's own contact
   * click relative to the modes (dB); lvl: trim (dB); att: attack (s). */
  var TB = {
    // steel, the brightest: rusted rail spikes, blued, galvanised
    spike:  { modes: [[1, 1, 0.24], [2.76, 0.45, 0.1], [5.4, 0.22, 0.05], [8.93, 0.08, 0.025]], reg: [84, 98], click: -4, lvl: -1, jit: 0.012 },
    // roof bolts through bearing plates: the plate answers, lower
    bolt:   { modes: [[1, 1, 0.15], [1.51, 0.7, 0.12], [2.93, 0.3, 0.05], [4.7, 0.12, 0.02]], reg: [74, 86], click: -6, lvl: 0 },
    // lamp hooks ring longest, and the lamp on the hook jiggles after
    hook:   { modes: [[1, 1, 0.42], [2.76, 0.4, 0.16], [5.4, 0.2, 0.06]], reg: [86, 98], click: -5, lvl: -2, echo: [0.047, 0.28] },
    // thin nails: the backdrop's, the pockets' lips
    nail:   { modes: [[1, 1, 0.2], [2.76, 0.5, 0.09], [5.4, 0.3, 0.045]], reg: [91, 103], click: -3, lvl: -3 },
    // the headframe's riveted plate: clangy
    rivet:  { modes: [[1, 1, 0.32], [1.59, 0.55, 0.22], [2.14, 0.4, 0.13], [2.31, 0.3, 0.1]], reg: [81, 91], click: -5, lvl: -2 },
    // brass tacks: warm, nearly harmonic, a long ring
    brass:  { modes: [[1, 1, 0.8], [2.02, 0.42, 0.4], [3.03, 0.2, 0.2], [4.1, 0.1, 0.09]], reg: [84, 96], click: -6, lvl: -3 },
    // pit props, end-grain: hollow
    prop:   { modes: [[1, 1, 0.075], [2.31, 0.45, 0.045], [3.9, 0.2, 0.02]], body: [[180, 0.35, 0.05]], reg: [62, 74], click: -9, lvl: 2, att: 0.0015 },
    // roots in the soil: dull and short
    root:   { modes: [[1, 1, 0.045], [2.6, 0.3, 0.022]], reg: [57, 69], click: -11, lvl: 2, att: 0.002 },
    fencepost: { modes: [[1, 1, 0.065], [2.4, 0.5, 0.035], [4.1, 0.2, 0.015]], reg: [67, 79], click: -9, lvl: 1, att: 0.0012 },
    // coal: dull and glassy (a brittle knuckle; the glass click is most of it)
    coal:   { modes: [[1, 1, 0.055], [1.47, 0.6, 0.04], [2.63, 0.5, 0.022], [4.2, 0.3, 0.012]], reg: [74, 86], click: -1, lvl: 0 },
    // rock faces, pillars, the legend's rib: dead stone
    stone:  { modes: [[1, 1, 0.03], [1.8, 0.5, 0.016], [3.1, 0.2, 0.008]], reg: [62, 72], click: -6, lvl: 1, att: 0.001 },
    // quartz with gold in it: crystalline, and it glints (a beating twin)
    ore:    { modes: [[1, 1, 0.18], [1.003, 0.5, 0.18], [1.52, 0.55, 0.13], [2.31, 0.35, 0.07], [3.6, 0.2, 0.04]], reg: [91, 103], click: -3, lvl: -2 },
    // bone: a dry click with a little knock under it
    bone:   { modes: [[1, 1, 0.028], [2.2, 0.5, 0.016], [3.7, 0.3, 0.009], [0.28, 0.45, 0.035]], reg: [79, 91], click: 0, lvl: -1 },
    // the haulage track: a steel rail rings long and low
    track:  { modes: [[1, 1, 0.32], [1.34, 0.6, 0.26], [2.9, 0.3, 0.11], [4.4, 0.15, 0.05]], reg: [72, 84], click: -4, lvl: -1 },
    // planking over dirt: a dull tup
    plank:  { modes: [[1, 1, 0.045], [2.1, 0.4, 0.022]], body: [[120, 0.5, 0.06]], reg: [50, 62], click: -10, lvl: 3, att: 0.002 },
    // posts, braces, walls, the bays' dividers
    wood:   { modes: [[1, 1, 0.055], [2.3, 0.5, 0.03], [3.7, 0.25, 0.015]], reg: [57, 69], click: -8, lvl: 2, att: 0.0015 },
    // tin: the pail's base
    tin:    { modes: [[1, 1, 0.35], [1.0052, 0.5, 0.3], [2.27, 0.4, 0.2], [3.58, 0.2, 0.1]], reg: [84, 88], click: -3, lvl: -2 },
    // the sheave: cast iron, one note (E5)
    spoke:  { modes: [[1, 1, 0.5], [1.62, 0.6, 0.38], [2.47, 0.4, 0.22], [3.3, 0.25, 0.12]], fixed: 76, click: -6, lvl: -1 },
    // the pump wheel's paddles (A3) and the ventilation door (G3): boards
    paddle: { modes: [[1, 1, 0.07], [2.2, 0.5, 0.035]], body: [[140, 0.5, 0.05]], fixed: 57, click: -10, lvl: 2, att: 0.0015 },
    door:   { modes: [[1, 1, 0.06], [1.7, 0.6, 0.045], [2.9, 0.3, 0.022]], body: [[95, 0.5, 0.07]], fixed: 55, click: -10, lvl: 2, att: 0.0015 },
    // the ore cart's steel bucket (G4)
    bucket: { modes: [[1, 1, 0.28], [1.41, 0.7, 0.22], [2.07, 0.5, 0.15], [2.9, 0.3, 0.1], [4.1, 0.15, 0.05]], fixed: 67, click: -4, lvl: 0 },
    // glass on glass: each marble colour has its own note
    glass:  { modes: [[1, 1, 0.045], [2.93, 0.35, 0.018], [5.1, 0.15, 0.008]], reg: [91, 103], click: 0, lvl: -1 }
  };
  for (var tk in TB) if (TB[tk].reg) TB[tk].notes = scaleBetween(TB[tk].reg[0], TB[tk].reg[1]);

  // which timbre a contact is
  function timbreKey(kind, ev) {
    var mat = ev.material, dr = ev.dress, id = String(ev.id || '');
    if (kind === 'wheel' || dr === 'hub') {
      if (id === 'ventdoor' || dr === 'door') return 'door';
      if (mat === 'spoke' || id === 'sheave' || dr === 'sheave') return 'spoke';
      return 'paddle';
    }
    if (id === 'cart') return 'bucket';
    switch (mat) {
      case 'steel':
        if (dr === 'bolt' || dr === 'hook' || dr === 'nail' || dr === 'rivet') return dr;
        if (dr === 'lamphook') return 'hook';
        if (dr === 'pail') return 'tin';
        if (dr === 'powderbox') return 'wood';
        return 'spike';
      case 'brass': return 'brass';
      case 'timber': return (dr === 'root' || dr === 'fencepost' || dr === 'prop') ? dr : (dr === 'powderbox' ? 'prop' : 'wood');
      case 'track': return 'track';
      case 'plank': return 'plank';
      case 'rock': return dr === 'coal' ? 'coal' : 'stone';
      case 'ore': return 'ore';
      case 'bone': return 'bone';
      case 'spoke': return 'spoke';
      case 'glass': return 'glass';
    }
    return 'spike';
  }

  /* ── synthesis kernels (pure JS into Float32Arrays) ──────────────── */
  // damped sinusoids in sine phase (silent at t = 0), by a rotating phasor;
  // `wrap` writes modulo the buffer (a loop's tails come round again)
  function addModes(out, s0, sr, modes, amp, wrap) {
    var len = out.length;
    for (var i = 0; i < modes.length; i++) {
      var f = modes[i][0], a = modes[i][1] * (amp == null ? 1 : amp), t60 = modes[i][2];
      if (!(f > 20) || f >= sr * 0.45 || !a) continue;
      var w = 2 * Math.PI * f / sr, c = Math.cos(w), s = Math.sin(w);
      var d = Math.exp(-6.907755 / (t60 * sr));
      var re = 1, im = 0, n = Math.ceil(t60 * 1.08 * sr);
      if (!wrap) n = Math.min(n, len - s0);
      for (var j = 0; j < n; j++) {
        var k = s0 + j; if (wrap) k %= len;
        out[k] += a * im;
        var r2 = (re * c - im * s) * d; im = (re * s + im * c) * d; re = r2;
      }
    }
  }
  // a mode whose pitch sags quickly after the strike (a flexing wall)
  function addGlideMode(out, s0, sr, f, a, t60, sag, tau) {
    var n = Math.min(out.length - s0, Math.ceil(t60 * 1.08 * sr)), ph = 0, k = -6.907755 / t60;
    for (var j = 0; j < n; j++) {
      var t = j / sr;
      ph += 2 * Math.PI * f * (1 + sag * Math.exp(-t / tau)) / sr;
      out[s0 + j] += a * Math.exp(k * t) * Math.sin(ph);
    }
  }
  // a noise burst, half-Hann shaped, one-pole lowpassed and optionally highpassed
  function addBurst(out, s0, sr, dur, amp, lpHz, hpHz, r, wrap) {
    var n = Math.max(2, Math.round(dur * sr)), lp = 0, hp = 0, prev = 0, len = out.length;
    var aL = lpHz ? 1 - Math.exp(-2 * Math.PI * lpHz / sr) : 1, aH = hpHz ? Math.exp(-2 * Math.PI * hpHz / sr) : 0;
    for (var j = 0; j < n; j++) {
      var k = s0 + j; if (wrap) k %= len; else if (k >= len) break;
      var w = Math.sin(Math.PI * j / n); w *= w;
      lp += aL * ((r() * 2 - 1) - lp);
      var y = lp;
      if (hpHz) { var hh = aH * (hp + y - prev); prev = y; hp = hh; y = hh; }
      out[k] += amp * w * y;
    }
  }
  function onePoleLP(out, sr, hz) {
    var a = 1 - Math.exp(-2 * Math.PI * hz / sr), y = 0;
    for (var i = 0; i < out.length; i++) { y += a * (out[i] - y); out[i] = y; }
  }
  function ramp(out, sr, att) {
    var n = Math.min(out.length, Math.round(att * sr));
    for (var i = 0; i < n; i++) out[i] *= i / n;
  }
  function normPeak(out, peak) {
    var pk = 0;
    for (var i = 0; i < out.length; i++) { var a = Math.abs(out[i]); if (a > pk) pk = a; }
    var g = (peak == null ? 1 : peak) / (pk || 1);
    for (var j = 0; j < out.length; j++) out[j] *= g;
    return out;
  }
  function fadeTail(out, sr, dur) {
    var n = Math.min(out.length, Math.round(dur * sr)), L = out.length;
    for (var i = 0; i < n; i++) out[L - 1 - i] *= i / n;
    return out;
  }

  // one tick: the pin's modes (and body), the rough edge of the strike
  function renderTick(sr, T, f0, seed) {
    var r = lcg(seed), maxT = 0, modes = [], i;
    for (i = 0; i < T.modes.length; i++) {
      var m = T.modes[i], j = T.jit || 0.008;
      modes.push([f0 * m[0] * (1 + (r() - 0.5) * 2 * j), m[1] * (0.85 + 0.3 * r()), m[2] * (0.9 + 0.2 * r())]);
      if (m[2] > maxT) maxT = m[2];
    }
    if (T.body) for (i = 0; i < T.body.length; i++) { var b = T.body[i]; modes.push([b[0] * (0.96 + 0.08 * r()), b[1], b[2]]); if (b[2] > maxT) maxT = b[2]; }
    var echo = T.echo ? T.echo[0] : 0;
    var out = new Float32Array(Math.ceil(sr * (maxT * 1.1 + echo + 0.01)));
    addModes(out, 0, sr, modes, 1);
    if (T.att) ramp(out, sr, T.att);
    // the strike's own edge, voiced by the pin (the marble's glass click is separate)
    addBurst(out, 0, sr, 0.0008, 0.25, Math.min(12000, f0 * 3), 0, r);
    if (echo) {                                           // the lamp on its hook jiggles
      var s1 = Math.round(echo * sr);
      addModes(out, s1, sr, modes.slice(0, 2), T.echo[1]);
    }
    return fadeTail(normPeak(out, 1), sr, 0.004);
  }
  // the glass marble's contact click: a bright, very short tic
  function renderClick(sr, seed) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 0.016));
    addBurst(out, 0, sr, 0.0006 + 0.0006 * r(), 1, 14000, 2600, r);
    addModes(out, 0, sr, [[5200 + 2200 * r(), 0.55, 0.009], [8400 + 2600 * r(), 0.35, 0.006], [3400 + 900 * r(), 0.2, 0.007]], 1);
    return fadeTail(normPeak(out, 1), sr, 0.002);
  }
  // a bay's chime: a small struck bar (glockenspiel-ish), a brass mallet
  function renderChime(sr, f, seed) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 1.9));
    addModes(out, 0, sr, [[f, 1, 1.7], [f * 1.0019, 0.35, 1.6], [f * 2.76, 0.26, 0.5], [f * 5.4, 0.1, 0.18], [f * 8.93, 0.04, 0.07]], 1);
    addBurst(out, 0, sr, 0.0015, 0.35, 6000, 800, r);
    return fadeTail(normPeak(out, 1), sr, 0.02);
  }
  // a music-box tine (into a buffer at s0). A broken tine: the pin plucks a stub.
  function tineInto(out, s0, sr, f, amp, r, broken, wrap) {
    if (broken) {
      addModes(out, s0, sr, [[880 + 60 * r(), 0.5 * amp, 0.025], [2250, 0.2 * amp, 0.012]], 1, wrap);
      addBurst(out, s0, sr, 0.0018, 0.45 * amp, 3500, 300, r, wrap);
      return;
    }
    var T1 = clamp(2.4 * Math.pow(262 / f, 0.55), 0.5, 3.0);
    addModes(out, s0, sr, [[f, amp, T1], [f * 2.0, 0.045 * amp, T1 * 0.45], [f * 5.93, 0.16 * amp, 0.13], [f * 13.3, 0.05 * amp, 0.03]], 1, wrap);
    addBurst(out, s0, sr, 0.001, 0.2 * amp, 7000, 1500, r, wrap);
  }
  // scrip and coins into a PLASTIC BUCKET. The bucket is the thing: a hollow
  // polyethylene bok whose walls flex (the pitch sags as it rings), a slappy
  // wall, then the coin ringing on its bounces. As it fills, the bottom is
  // coins: the bok deadens and coin chinks on coin.
  function renderCoin(sr, seed, fill) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 0.5));
    var damp = 1 - 0.7 * fill, fs = (1 + 0.05 * fill) * (1 + (r() - 0.5) * 0.06);
    var body = [[212, 1.3, 0.17], [338, 0.95, 0.12], [497, 0.7, 0.085], [721, 0.42, 0.06], [1040, 0.25, 0.04], [1530, 0.14, 0.025]];
    for (var i = 0; i < body.length; i++) {
      var b = body[i];
      addGlideMode(out, 0, sr, b[0] * fs * (1 + (r() - 0.5) * 0.04), b[1] * damp, b[2] * (1 - 0.45 * fill), 0.08, 0.009);
    }
    addBurst(out, 0, sr, 0.004, 0.7 * damp, 2600, 650, r);                // the wall slaps
    var fc = 2900 + 1500 * r();
    var cm = [[1, 1, 0.09], [1.72, 0.7, 0.07], [2.34, 0.5, 0.05], [3.9, 0.3, 0.03], [5.1, 0.15, 0.02]];
    var bounces = [[0, 0.75, 1], [0.02 + 0.02 * r(), 0.42, 1.8], [0.052 + 0.03 * r(), 0.2, 2.6]];
    for (var k = 0; k < bounces.length; k++) {
      var bo = bounces[k], s0 = Math.round(bo[0] * sr);
      addModes(out, s0, sr, cm.map(function (m) { return [fc * m[0] * (1 + (r() - 0.5) * 0.008), m[1] * bo[1], m[2] * bo[2]]; }), 1);
      addBurst(out, s0, sr, 0.0005, bo[1] * 0.5, 12000, 3000, r);
      if (k === 1) addModes(out, s0, sr, [[212 * fs, 0.35 * damp, 0.1], [338 * fs, 0.25 * damp, 0.07]], 1);
      if (k === 1 && fill > 0.12) {                                       // coin on coin
        var f2 = 2600 + 2400 * r();
        addModes(out, s0, sr, [[f2, 0.7 * fill, 0.14], [f2 * 1.73, 0.45 * fill, 0.09], [f2 * 2.36, 0.3 * fill, 0.05]], 1);
      }
    }
    return fadeTail(normPeak(out, 1), sr, 0.01);
  }
  // the lunch pail: tin, dented (a slow beating), the wire bail rattling in
  // its ears, and the marble rocking to a stop in the bottom. PLINK.
  function renderPail(sr, seed) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 1.0)), f = mtof(88) * (1 + (r() - 0.5) * 0.004);
    addModes(out, 0, sr, [[f, 1, 0.75], [f * 1.0053, 0.55, 0.7], [f * 2.27, 0.4, 0.4], [f * 2.41, 0.3, 0.32], [f * 3.58, 0.22, 0.2], [f * 4.93, 0.12, 0.12], [f * 0.51, 0.35, 0.45]], 1);
    addBurst(out, 0, sr, 0.0012, 0.9, 9000, 1800, r);
    [0.068, 0.124].forEach(function (t, i) {
      var s = Math.round(t * sr);
      addModes(out, s, sr, [[3150 + 400 * r(), 0.18 - 0.06 * i, 0.03], [5200 + 500 * r(), 0.1, 0.015]], 1);
      addBurst(out, s, sr, 0.0006, 0.12, 9000, 2000, r);
    });
    [0.11, 0.19, 0.255, 0.305, 0.34].forEach(function (t, i) {
      var s = Math.round(t * sr), a = 0.32 * Math.pow(0.62, i);
      addModes(out, s, sr, [[f * 2.27, a, 0.12], [f, a * 0.5, 0.2]], 1);
      addBurst(out, s, sr, 0.0008, a * 0.9, 8000, 2500, r);
    });
    return fadeTail(normPeak(out, 1), sr, 0.02);
  }
  // the powder box: a hollow wooden tonk, the lid chattering, a puff
  function renderPowder(sr, seed) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 0.5));
    addModes(out, 0, sr, [[245, 1, 0.14], [412, 0.7, 0.09], [688, 0.4, 0.05], [1130, 0.2, 0.025]], 1);
    ramp(out, sr, 0.0012);
    addBurst(out, 0, sr, 0.002, 0.5, 5000, 600, r);
    [0.045, 0.08, 0.105].forEach(function (t, i) {
      var s = Math.round(t * sr);
      addModes(out, s, sr, [[980 + 90 * i, 0.3 - 0.08 * i, 0.03], [1900, 0.12, 0.015]], 1);
    });
    var s2 = Math.round(0.03 * sr);
    addBurst(out, s2, sr, 0.25, 0.1, 900, 120, r);                     // black powder, puffed
    return fadeTail(normPeak(out, 1), sr, 0.01);
  }
  // a knuckle on rock, heard through the rock
  function renderKnock(sr, seed) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 0.26)), f1 = 95 + 25 * r();
    addGlideMode(out, 0, sr, f1, 1, 0.12, 0.45, 0.012);
    addModes(out, 0, sr, [[380 + 80 * r(), 0.75, 0.05], [610 + 90 * r(), 0.5, 0.035], [1150 + 200 * r(), 0.25, 0.018]], 1);
    addBurst(out, 0, sr, 0.003, 0.9, 1800, 150, r);
    onePoleLP(out, sr, 1500);
    return fadeTail(normPeak(out, 1), sr, 0.01);
  }
  // a pocket watch's escapement: tick (bright) and tock (a hair lower)
  function renderWatch(sr, seed, tock) {
    var r = lcg(seed), out = new Float32Array(Math.round(sr * 0.03));
    addBurst(out, 0, sr, 0.0005, 0.8, 11000, 3500, r);
    addModes(out, 0, sr, [[tock ? 4100 : 4700, 0.6, 0.008], [tock ? 6900 : 7600, 0.3, 0.005], [2250, 0.25, 0.012]], 1);
    return fadeTail(normPeak(out, 1), sr, 0.003);
  }

  /* ── the music box: a mine music box, in G, a little warped ────────
   * 16 bars of 2/4 in eighths (a parlour cheer, slowed down and put in a
   * box). One tine is broken, the high D, so the tune twice reaches for
   * its top note and gets a dull tk. The spring governor hunts (tempo
   * ±35 ms), the cylinder is warped (±9 cents), and the last bar sags. */
  var MB_MEL = [
    [74, 1], [79, 1], [83, 1], [81, 1],   [79, 2], [74, 1], [76, 1],
    [79, 1], [81, 1], [83, 1], [86, 1],   [83, 3], [0, 1],
    [88, 1], [86, 1], [83, 1], [81, 1],   [79, 1], [76, 1], [74, 2],
    [76, 1], [79, 1], [81, 1], [77, 1],   [79, 3], [0, 1],
    [71, 1], [74, 1], [79, 1], [71, 1],   [69, 1], [72, 1], [76, 1], [69, 1],
    [67, 1], [71, 1], [74, 1], [79, 1],   [77, 2], [76, 1], [74, 1],
    [76, 1], [79, 1], [83, 1], [81, 1],   [79, 1], [76, 1], [74, 1], [71, 1],
    [72, 1], [76, 1], [74, 1], [69, 1],   [67, 2], [0, 2]
  ];
  var MB_BASS = [[55, 62], [55, 62], [52, 59], [50, 57], [48, 55], [55, 62], [53, 60], [55, 62],
                 [55, 62], [57, 64], [55, 62], [53, 60], [48, 55], [52, 59], [50, 57], [55, 55]];
  var MB_EIGHTH = 60 / 108 / 2;
  var MB_BROKEN = 86;
  function renderMusicBox(sr, o) {
    o = o || {};
    var fixed = !!o.fixed, speed = o.speed || 1, bars = o.bars || 16, loop = o.loop !== false;
    var E = MB_EIGHTH / speed, r = lcg(o.seed || 0x6d62);
    function when(n) {                              // the governor hunts; the last bar sags
      var t = n * E + (loop ? 0.035 * Math.sin(2 * Math.PI * n * E / 5.3) : 0);
      if (loop && n > 60) t += (n - 60) * (n - 60) * 0.012;
      return t;
    }
    var total = bars * 4, len = Math.round(sr * (loop ? when(total) : when(total) + 2.6));
    var out = new Float32Array(len), n = 0, i;
    for (i = 0; i < MB_MEL.length && n < total; i++) {
      var m = MB_MEL[i][0];
      if (m) {
        var t = when(n) + (r() - 0.5) * 0.012;
        var warp = loop ? 9 * Math.sin(2 * Math.PI * t / 2.1) - (n > 60 ? 12 : 0) : 0;
        tineInto(out, Math.max(0, Math.round(t * sr)), sr, mtof(m) * cents(warp), 0.9, r, m === MB_BROKEN && !fixed, loop);
      }
      n += MB_MEL[i][1];
    }
    for (var b = 0; b < bars; b++) for (var k = 0; k < 2; k++) {
      var tb = when(b * 4 + k * 2) + 0.004 + (r() - 0.5) * 0.01;
      var wb = loop ? 9 * Math.sin(2 * Math.PI * tb / 2.1) : 0;
      tineInto(out, Math.round(tb * sr), sr, mtof(MB_BASS[b][k]) * cents(wb), k ? 0.4 : 0.55, r, false, loop);
    }
    return out;
  }

  /* ── rooms ─────────────────────────────────────────────────────────
   * The mine: a dark, dense 1.3 s space with rock close on both sides.
   * The valley (the train's): a 4 s dark tail with the ridge answering. */
  function renderIR(sr, spec) {
    var len = Math.round(sr * spec.len), chans = [];
    for (var c = 0; c < 2; c++) {
      var d = new Float32Array(len), r = lcg(spec.seed + c * 7919), lp = 0, a = 1 - Math.exp(-2 * Math.PI * spec.lp / sr), en = 0, j;
      for (j = 0; j < len; j++) {
        var t = j / sr - spec.pre;
        lp += a * ((r() * 2 - 1) - lp);
        d[j] = t < 0 ? 0 : lp * Math.exp(-t / spec.tau) * Math.min(1, t / spec.fade);
      }
      (spec.early || []).forEach(function (e) {
        var k = Math.round((e[0] + (c ? 0.0017 : 0)) * sr);
        if (k < len) d[k] += e[1] * (c ? -1 : 1) * 3;
      });
      (spec.echoes || []).forEach(function (e) {               // the ridge answers: a darker, diffuse copy
        var k0 = Math.round((e[0] + (c ? 0.03 : 0)) * sr), n = Math.round(0.09 * sr), l2 = 0;
        for (var q = 0; q < n && k0 + q < len; q++) {
          l2 += 0.12 * ((r() * 2 - 1) - l2);
          d[k0 + q] += e[1] * l2 * Math.sin(Math.PI * q / n) * 2;
        }
      });
      for (j = 0; j < len; j++) en += d[j] * d[j];
      en = 1 / Math.sqrt(en || 1);
      for (j = 0; j < len; j++) d[j] *= en;
      chans.push(d);
    }
    return chans;
  }
  var IR_MINE = { len: 1.3, tau: 0.17, lp: 3400, pre: 0.004, fade: 0.012, seed: 0x3a1e,
    early: [[0.007, 0.5], [0.013, -0.35], [0.019, 0.3], [0.029, -0.2], [0.041, 0.15]] };
  var IR_FAR = { len: 4.2, tau: 0.56, lp: 1300, pre: 0.05, fade: 0.25, seed: 0x7a11, echoes: [[0.92, 0.55], [2.05, 0.28]] };

  /* ═════════════════════════════════════════════════════════════════ */
  function attach(handle, unlockEl, opts) {
    opts = opts || {};
    var injected = opts.context || null;
    var ctx = null, G = null;
    var dead = false, muted = !!opts.muted, hidden = false, resuming = false;
    var evCount = 0, pumpTimer = null;
    var SEED = (opts.seed != null ? opts.seed : 0x10de) | 0;
    var LEAD = 0.035;
    var st = {
      mode: 'attract', fill: 0, tineFixed: false, gameWhistles: false, gameLodes: false,
      pending: [], lodeUntil: -1, dark: {}, lastPin: {}, recent: [], voices: [],
      tunnels: {}, cart: null, watchUntil: -1, watchNext: 0, trains: 0, nextTrain: null, nextFlicker: null,
      payNext: 0, lastDump: -1, marbles: {}, lastHopper: -1, teeterUntil: -1,
      clk: null, stats: { ticks: 0, dropped: 0, ducked: 0, maxVoices: 0, resync: 0, events: {}, maxDensity: 0 }
    };
    (function () {
      var s0 = null;
      try { s0 = handle && handle.getState && handle.getState(); } catch (e) { s0 = null; }
      if (s0 && s0.mode) st.mode = String(s0.mode).toLowerCase();
    })();
    var BI = boardInfo();

    function live() {
      if (dead || !ctx || !G) return false;
      if (injected) return true;
      if (muted || hidden) return false;
      return ctx.state === 'running' || resuming;
    }

    /* ── where things are (the specimens, the tunnels) ─────────────── */
    function boardInfo() {
      var PB = root.PachinkoBoard, b = null;
      try { b = (handle && handle.view && handle.view.board) || (PB && PB.base && PB.base()); } catch (e) { b = null; }
      var I = { watch: { x: 170, y: 256 }, strongbox: { x: 140, y: 372 }, tunnels: {}, regionAt: null };
      if (b) {
        (b.decor || []).forEach(function (d) {
          if (d.kind === 'specimen' && d.what === 'watch') I.watch = { x: d.x, y: d.y };
          if (d.kind === 'specimen' && d.what === 'strongbox') I.strongbox = { x: d.x, y: d.y };
        });
        (b.fixtures || []).forEach(function (f) {
          if (f.kind === 'tunnel') I.tunnels[f.id] = { a: f.a, b: f.b, delay: f.delay || 1 };
        });
      }
      if (PB && PB.regionAt) I.regionAt = PB.regionAt;
      return I;
    }

    /* ── the clock: sim seconds → audio seconds ────────────────────── */
    function when(ev) {
      var now = ctx.currentTime;
      if (typeof ev.t !== 'number' || !isFinite(ev.t)) return now + 0.012;
      var at = st.clk == null ? -1 : ev.t + st.clk;
      if (st.clk == null || at < now + 0.004 || at > now + 0.16) {
        if (st.clk != null) st.stats.resync++;
        st.clk = now + LEAD - ev.t; at = now + LEAD;
      }
      return at;
    }

    /* ── graph ─────────────────────────────────────────────────────── */
    function build() {
      var sr = ctx.sampleRate;
      G = { nodes: [], sources: [], bank: {} };
      var out = ctx.createGain(); out.gain.value = muted && !injected ? 0 : 1;
      var shaper = ctx.createWaveShaper();
      var n = 2048, curve = new Float32Array(n);
      for (var i = 0; i < n; i++) {           // linear to 0.6, a tanh knee, ceiling 0.95
        var x = i / (n - 1) * 2 - 1, ax = Math.abs(x);
        var y = ax < 0.6 ? ax : 0.6 + 0.35 * Math.tanh((ax - 0.6) / 0.35);
        curve[i] = x < 0 ? -y : y;
      }
      shaper.curve = curve; shaper.oversample = '2x';
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 4; comp.ratio.value = 12;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      var trim = ctx.createGain(); trim.gain.value = db(-4.8);   // take back the compressor's makeup gain
      var master = ctx.createGain(); master.gain.value = 1;
      master.connect(comp); comp.connect(trim); trim.connect(shaper); shaper.connect(out); out.connect(ctx.destination);

      var sfx = ctx.createGain(); sfx.connect(master);
      // the lanes: seven fixed pans across the glass (cheap: voices pick one)
      var lanes = [];
      for (var l = 0; l < 7; l++) {
        var lg = ctx.createGain();
        var pn = panner((l / 6 * 2 - 1) * 0.72);
        lg.connect(pn); pn.connect(sfx); lanes.push(lg);
        G.nodes.push(lg, pn);
      }
      // the mine's room, fed by depth: the deeper, the more cave
      var mineIR = ctx.createBuffer(2, Math.round(sr * IR_MINE.len), sr), irs = renderIR(sr, IR_MINE);
      mineIR.getChannelData(0).set(irs[0]); mineIR.getChannelData(1).set(irs[1]);
      var conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = mineIR;
      var sendAll = ctx.createGain(); sendAll.gain.value = 1;
      sendAll.connect(conv); conv.connect(master);
      var sends = [0.075, 0.15, 0.25].map(function (v) { var g = ctx.createGain(); g.gain.value = v; g.connect(sendAll); G.nodes.push(g); return g; });
      sfx.connect(sends[0]);                                        // (a little room on everything)
      // the valley: the train's own distance
      var farIR = ctx.createBuffer(2, Math.round(sr * IR_FAR.len), sr), fr = renderIR(sr, IR_FAR);
      farIR.getChannelData(0).set(fr[0]); farIR.getChannelData(1).set(fr[1]);
      var far = ctx.createGain(), farLP = ctx.createBiquadFilter(); farLP.type = 'lowpass'; farLP.frequency.value = 1500; farLP.Q.value = 0.5;
      var farConv = ctx.createConvolver(); farConv.normalize = false; farConv.buffer = farIR;
      var farDry = ctx.createGain(); farDry.gain.value = 0.3;
      var farWet = ctx.createGain(); farWet.gain.value = 0.85;
      far.connect(farLP); farLP.connect(farDry); farDry.connect(master); farLP.connect(farConv); farConv.connect(farWet); farWet.connect(master);
      var room = ctx.createGain(), roomLP = ctx.createBiquadFilter();
      roomLP.type = 'lowpass'; roomLP.frequency.value = 12000; roomLP.Q.value = 0.5;
      room.connect(roomLP); roomLP.connect(master);
      var air = ctx.createGain(); air.gain.value = 0; air.connect(master);
      var music = ctx.createGain(); music.gain.value = 0; music.connect(master);
      var musicSend = ctx.createGain(); musicSend.gain.value = 0.12; music.connect(musicSend); musicSend.connect(sendAll);
      var dry = ctx.createGain(); dry.connect(master);

      var nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0), nr = lcg(0xb0a7 ^ 0x1de);
      for (var k = 0; k < nd.length; k++) nd[k] = nr() * 2 - 1;

      G.out = out; G.master = master; G.comp = comp; G.sfx = sfx; G.lanes = lanes; G.sends = sends; G.sendAll = sendAll;
      G.conv = conv; G.far = far; G.room = room; G.roomLP = roomLP; G.air = air; G.music = music; G.dry = dry; G.noise = nb;
      G.nodes.push(out, shaper, comp, trim, master, sfx, conv, sendAll, far, farLP, farConv, farDry, farWet, room, roomLP, air, music, musicSend, dry);
      buildRoom();
      buildAir();
      buildRolls();
      var now = ctx.currentTime;
      st.nextTrain = trainPlan(now, 0);
      st.nextFlicker = now + 38 + 50 * h01(SEED, 77);
      setMode(st.mode, true);
      if (opts.room === false) { roomLP.disconnect(); air.disconnect(); }
      if (!injected) pumpTimer = setInterval(pump, 25);
      idle(function () { musicBuf(); flourishBuf(); });
    }
    function panner(p) {
      if (ctx.createStereoPanner) { var s = ctx.createStereoPanner(); s.pan.value = p; return s; }
      return ctx.createGain();
    }
    function keep(node) { G.nodes.push(node); return node; }
    function keepSrc(node) { G.sources.push(node); G.nodes.push(node); return node; }
    function idle(fn, ms) { if (injected) fn(); else setTimeout(function () { if (!dead && G) fn(); }, ms || 60); }
    function makeBuf(arr) { var b = ctx.createBuffer(1, arr.length, ctx.sampleRate); b.getChannelData(0).set(arr); return b; }
    function banked(key, fn) { return G.bank[key] || (G.bank[key] = makeBuf(fn())); }
    function laneOf(x) { return clamp(Math.round((x == null ? 160 : x) / 320 * 6), 0, 6); }
    function panOf(x) { return clamp(((x == null ? 160 : x) / 320 * 2 - 1) * 0.72, -0.8, 0.8); }
    function tierOf(y) { return y == null ? 1 : y < 142 ? 0 : y < 292 ? 1 : 2; }

    /* ── voice primitives ──────────────────────────────────────────── */
    function envGain(t, peak, a, d, hold) {
      var g = ctx.createGain(); a = a || 0.002; hold = hold || 0;
      g.gain.value = 0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + a);
      if (hold) g.gain.setValueAtTime(peak, t + a + hold);
      g.gain.exponentialRampToValueAtTime(peak * 1e-4 + 1e-7, t + a + hold + d);
      return { g: g, end: t + a + hold + d + 0.02 };
    }
    function tone(t, o) {
      var osc = ctx.createOscillator();
      if (o.wave) osc.setPeriodicWave(o.wave); else osc.type = o.type || 'sine';
      osc.frequency.value = o.f; osc.frequency.setValueAtTime(o.f, t);
      if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.d));
      if (o.detune) osc.detune.setValueAtTime(o.detune, t);
      var e = envGain(t, o.peak, o.a, o.d, o.hold);
      osc.connect(e.g); e.g.connect(o.dest || G.sfx);
      osc.start(t); osc.stop(e.end);
      osc.onended = function () { try { e.g.disconnect(); } catch (err) {} };
      return osc;
    }
    function noise(t, o) {
      var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
      var f = ctx.createBiquadFilter(); f.type = o.ft || 'bandpass';
      f.frequency.value = o.f; f.frequency.setValueAtTime(o.f, t);
      if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + (o.glide || o.d));
      f.Q.value = o.q == null ? 1 : o.q;
      var e = envGain(t, o.peak, o.a, o.d, o.hold);
      src.connect(f); f.connect(e.g); e.g.connect(o.dest || G.sfx);
      src.start(t, (o.off || 0) % 1.9); src.stop(e.end);
      src.onended = function () { try { f.disconnect(); e.g.disconnect(); } catch (err) {} };
      return src;
    }
    // a pre-rendered voice: buffer → gain → lane (+ a depth send)
    function play(buf, t, o) {
      var s = ctx.createBufferSource(); s.buffer = buf;
      if (o.rate && o.rate !== 1) s.playbackRate.value = o.rate;
      var g = ctx.createGain(); g.gain.value = o.gain;
      s.connect(g); g.connect(o.dest || G.lanes[o.lane == null ? 3 : o.lane]);
      if (o.tier != null) g.connect(G.sends[o.tier]);
      s.start(Math.max(t, 0));
      s.onended = function () { try { g.disconnect(); } catch (e) {} };
      return s;
    }

    /* ── banks (rendered on first use, then kept) ──────────────────── */
    function tickBuf(key, note, v) {
      return banked('t:' + key + ':' + note + ':' + v, function () { return renderTick(ctx.sampleRate, TB[key], mtof(note), hashStr(key + note) + v * 7919); });
    }
    function clickBuf(v) { return banked('c:' + v, function () { return renderClick(ctx.sampleRate, 0xc11c + v * 131); }); }
    function chimeBuf(note) { return banked('ch:' + note, function () { return renderChime(ctx.sampleRate, mtof(note), 0xc4e + note); }); }
    function coinBuf(v, fq) { return banked('co:' + v + ':' + fq, function () { return renderCoin(ctx.sampleRate, 0xc01 + v * 977 + fq * 31, fq / 4); }); }
    function pailBuf(v) { return banked('pa:' + v, function () { return renderPail(ctx.sampleRate, 0x9a11 + v * 53); }); }
    function powderBuf(v) { return banked('pw:' + v, function () { return renderPowder(ctx.sampleRate, 0x90d + v * 53); }); }
    function knockBuf(v) { return banked('kn:' + v, function () { return renderKnock(ctx.sampleRate, 0x4e0c + v * 71); }); }
    function watchBuf(tock) { return banked('w:' + tock, function () { return renderWatch(ctx.sampleRate, 0x3a7c + tock, tock); }); }
    function tineBuf(note, broken) {
      return banked('ti:' + note + ':' + (broken ? 1 : 0), function () {
        var sr = ctx.sampleRate, out = new Float32Array(Math.round(sr * 2.8));
        tineInto(out, 0, sr, mtof(note), 1, lcg(0x7e + note), broken, false);
        return fadeTail(normPeak(out, 1), sr, 0.02);
      });
    }
    function musicBuf() {
      var key = 'mb:' + (st.tineFixed ? 1 : 0);
      return banked(key, function () { return normPeak(renderMusicBox(ctx.sampleRate, { fixed: st.tineFixed }), db(-24)); });
    }
    function flourishBuf() {
      return banked('fl', function () { return normPeak(renderMusicBox(ctx.sampleRate, { fixed: true, speed: 1.55, bars: 8, loop: false, seed: 0xf1 }), 1); });
    }

    /* ── continuous: the house (the hum of electricity) ───────────── */
    function buildRoom() {
      var t = ctx.currentTime, room = G.room;
      room.gain.value = 0; room.gain.setValueAtTime(0, t);
      room.gain.linearRampToValueAtTime(1, t + 1.2);
      var hum = keep(ctx.createGain()); hum.connect(room);
      // mains: 60 Hz and its partials (the transformer in the base)
      [[60, -33.5], [120, -35], [180, -43], [240, -47], [300, -52]].forEach(function (p, i) {
        var o = keepSrc(ctx.createOscillator()); o.frequency.value = p[0]; o.detune.value = i ? 0.4 * i : 0;
        var g = keep(ctx.createGain()); g.gain.value = db(p[1]);
        o.connect(g); g.connect(hum); o.start(t);
        if (i === 1) G.h120 = g;
      });
      // the 120 breathes (the tube's slow flutter) and shimmers
      var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 0.19;
      var lfoD = keep(ctx.createGain()); lfoD.gain.value = db(-35) * 0.45;
      lfo.connect(lfoD); lfoD.connect(G.h120.gain);
      var lfo2 = keepSrc(ctx.createOscillator()); lfo2.frequency.value = 3.7;
      var lfo2D = keep(ctx.createGain()); lfo2D.gain.value = db(-35) * 0.14;
      lfo2.connect(lfo2D); lfo2D.connect(G.h120.gain);
      // the case light's fluorescent: a 120 Hz saw through the ballast's whine
      var saw = keepSrc(ctx.createOscillator()); saw.type = 'sawtooth'; saw.frequency.value = 120;
      var bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 2300; bp.Q.value = 1.3;
      var tube = keep(ctx.createGain()); tube.gain.value = db(-21);
      var flick = keep(ctx.createGain()); flick.gain.value = 1;           // the flicker automates this
      saw.connect(bp); bp.connect(tube); tube.connect(flick); flick.connect(hum);
      var lfo3 = keepSrc(ctx.createOscillator()); lfo3.frequency.value = 0.063;
      var lfo3D = keep(ctx.createGain()); lfo3D.gain.value = db(-21) * 0.55;
      lfo3.connect(lfo3D); lfo3D.connect(tube.gain);
      lfo.start(t); lfo2.start(t); saw.start(t); lfo3.start(t);
      G.hum = hum; G.flick = flick;
    }
    // the mine's air: it breathes through the ventilation door (a 2.8 s swing,
    // two breaths a swing), and something very low under it. Play only.
    function buildAir() {
      var t = ctx.currentTime;
      var src = keepSrc(ctx.createBufferSource()); src.buffer = G.noise; src.loop = true;
      var bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.7;
      var am = keep(ctx.createGain()); am.gain.value = 0.55;
      var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 1 / 1.4;
      var ld = keep(ctx.createGain()); ld.gain.value = 0.45;
      lfo.connect(ld); ld.connect(am.gain);
      var g = keep(ctx.createGain()); g.gain.value = db(-26);
      src.connect(bp); bp.connect(am); am.connect(g); g.connect(G.air);
      var src2 = keepSrc(ctx.createBufferSource()); src2.buffer = G.noise; src2.loop = true;
      var lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 90; lp.Q.value = 0.6;
      var g2 = keep(ctx.createGain()); g2.gain.value = db(-22);
      src2.connect(lp); lp.connect(g2); g2.connect(G.air);
      src.start(t, 0.3); src2.start(t, 1.1); lfo.start(t);
    }

    /* ── continuous: the rolls (three voices, handed to marbles) ──── */
    function buildRolls() {
      G.rolls = [];
      for (var i = 0; i < 3; i++) {
        var src = keepSrc(ctx.createBufferSource()); src.buffer = G.noise; src.loop = true;
        var bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1;
        var am = keep(ctx.createGain()); am.gain.value = 0.7;
        var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 9;
        var ld = keep(ctx.createGain()); ld.gain.value = 0.3;
        var g = keep(ctx.createGain()); g.gain.value = 0;
        var pn = keep(panner(0));
        lfo.connect(ld); ld.connect(am.gain);
        src.connect(bp); bp.connect(am); am.connect(g); g.connect(pn); pn.connect(G.sfx);
        var t = ctx.currentTime; src.start(t, 0.41 * (i + 1)); lfo.start(t);
        G.rolls.push({ m: null, last: -1, bp: bp, g: g, pn: pn, lfo: lfo, n: 0 });
      }
    }
    function rollVoice(m) {
      var best = null;
      for (var i = 0; i < G.rolls.length; i++) {
        var v = G.rolls[i];
        if (v.m === m) return v;
        if (!best || v.last < best.last) best = v;
      }
      best.m = m; return best;
    }

    /* ── the music box (attract only) ──────────────────────────────── */
    function setMusic(on, immediate) {
      var t = ctx.currentTime, g = G.music.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(immediate ? 0 : g.value, t);
      if (on) {
        var key = st.tineFixed ? 1 : 0;
        if (G.musicSrc && G.musicKey !== key) { stopMusicSrc(t + 0.05); }
        if (!G.musicSrc) {
          var s = ctx.createBufferSource(); s.buffer = musicBuf(); s.loop = true;
          s.connect(G.music); s.start(t + 0.02); G.musicSrc = s; G.musicKey = key;
        }
        g.linearRampToValueAtTime(1, t + 1.5);
      } else {
        g.linearRampToValueAtTime(0, t + 0.9);
        if (G.musicSrc) stopMusicSrc(t + 1.0);
      }
    }
    function stopMusicSrc(t) {
      var old = G.musicSrc; G.musicSrc = null;
      try { old.stop(t); } catch (e) {}
      old.onended = function () { try { old.disconnect(); } catch (e) {} };
    }
    function setMode(m, immediate) {
      st.mode = m;
      var t = ctx.currentTime, inside = m === 'dive' || m === 'play' || m === 'work';
      setMusic(m === 'attract', immediate);
      var ag = G.air.gain;
      ag.cancelScheduledValues(t); ag.setValueAtTime(immediate ? 0 : ag.value, t);
      ag.linearRampToValueAtTime(inside ? (m === 'work' ? 0.6 : 1) : 0, t + (immediate ? 0.01 : 1.2));
      var lf = G.roomLP.frequency;               // through the glass the tube's whine dulls
      lf.cancelScheduledValues(t); lf.setValueAtTime(lf.value, t);
      lf.exponentialRampToValueAtTime(inside ? 1700 : 12000, t + (immediate ? 0.01 : 0.8));
    }

    /* ── THE CLATTER ───────────────────────────────────────────────── */
    // voice room: prune the finished, count the living
    function voicesAt(at) {
      var v = st.voices, now = ctx.currentTime, keepV = [];
      for (var i = 0; i < v.length; i++) if (v[i] > now) keepV.push(v[i]);
      st.voices = keepV;
      return keepV.length;
    }
    // ticks per second over the last quarter second (audio time)
    function density(at) {
      var r = st.recent, i = 0;
      while (i < r.length && r[i] < at - 0.25) i++;
      if (i) r.splice(0, i);
      return r.length / 0.25;
    }
    function noteFor(T, id, y) {
      if (T.fixed) return T.fixed;
      var ns = T.notes, depth = clamp(((y == null ? 200 : y) - 10) / 390, 0, 1);
      var pos = (1 - depth) * (ns.length - 1) + (h01(hashStr(id), 7) - 0.5) * 4;
      return ns[clamp(Math.round(pos), 0, ns.length - 1)];
    }
    function contact(ev, at, kind, r) {
      var key = timbreKey(kind, ev), T = TB[key];
      var sp = ev.speed || 60, k = clamp(Math.log(sp / 16) / Math.log(420 / 16), 0, 1);
      var id = String(ev.id || key), x = ev.x, y = ev.y;
      var L = -31 + 17 * k + (T.lvl || 0);
      if (kind === 'rail') L -= 1;
      // the same pin still ringing from a moment ago: it takes less
      var last = st.lastPin[id];
      if (last != null && at - last < 0.09) { L -= 6; st.stats.ducked++; }
      st.lastPin[id] = at;
      // density: many marbles at once get quieter one by one, and the cave fills
      var dens = density(at);
      if (dens > st.stats.maxDensity) st.stats.maxDensity = dens;
      if (dens > 14) L += 20 * Math.log(Math.pow(14 / dens, 0.42)) / Math.LN10;
      var region = dark(x, y);
      if (region) L += 3;                              // in the dark you only hear it, and you hear it close
      var nv = voicesAt(at);
      if ((nv >= 30 && L < -24) || nv >= 44) { st.stats.dropped++; return; }
      st.recent.push(at);
      st.stats.ticks++;
      var note = noteFor(T, id, y);
      var v = Math.floor(r() * 3);
      var rate = cents((h01(hashStr(id), 3) - 0.5) * 28 + 20 * k);   // old nails aren't tuned; a hard hit rings a hair sharp
      var lane = laneOf(x), tier = region ? null : tierOf(y);
      var b = tickBuf(key, note, v);
      play(b, at, { rate: rate, gain: db(L), lane: lane, tier: tier });
      var cl = clickBuf(Math.floor(r() * 6));
      play(cl, at, { rate: 0.94 + 0.12 * r(), gain: db(L + T.click + 8 * (k - 0.5)), lane: lane, tier: null });
      st.voices.push(at + b.duration / rate);
      if (st.voices.length > st.stats.maxVoices) st.stats.maxVoices = st.voices.length;
      touches(ev, at, key, L, r);
    }

    // the small things that listen to the clatter (unrequested; PLAN §12)
    function touches(ev, at, key, L, r) {
      var x = ev.x, y = ev.y;
      if (x == null || y == null) return;
      // the painted sky is a board nailed up: hit a nail in it and the sky thrums
      if (key === 'nail' && y < 64) {
        tone(at + 0.004, { f: 88 + 10 * r(), f1: 80, peak: db(L - 6), a: 0.004, d: 0.4, dest: G.lanes[laneOf(x)] });
        tone(at + 0.004, { f: 141 + 8 * r(), peak: db(L - 13), a: 0.003, d: 0.22, dest: G.lanes[laneOf(x)] });
      }
      // Fig. 7, the pocket watch, still going: pass close and you can hear it
      var dw = Math.hypot(x - BI.watch.x, y - BI.watch.y);
      if (dw < 40) st.watchUntil = Math.max(st.watchUntil, at + 3.4);
      // Fig. 11, the strongbox (locked): the company's coins rattle inside it
      var ds = Math.hypot(x - BI.strongbox.x, y - BI.strongbox.y);
      if (ds < 22 && r() < 0.4) {
        for (var i = 0; i < 3; i++) {
          var tt = at + 0.03 + i * (0.028 + 0.02 * r()), f = 3300 + 1400 * r();
          tone(tt, { f: f, peak: db(-39 - 3 * i), a: 0.0005, d: 0.05, dest: G.lanes[laneOf(x)] });
          tone(tt, { f: f * 1.73, peak: db(-45 - 3 * i), a: 0.0005, d: 0.035, dest: G.lanes[laneOf(x)] });
        }
      }
    }
    function dark(x, y) {
      if (x == null || y == null || !BI.regionAt) return null;
      var any = false; for (var k in st.dark) if (st.dark[k]) { any = true; break; }
      if (!any) return null;
      var rg = BI.regionAt(x, y);
      return st.dark[rg] ? rg : null;
    }

    function roll(ev, at, r) {
      var v = rollVoice(ev.m); v.last = at; v.n++;
      var sp = ev.speed || 50, k = clamp(sp / 260, 0, 1), mat = ev.material;
      var f = mat === 'track' ? 2500 : mat === 'plank' ? 480 : mat === 'rock' ? 850 : mat === 'bone' ? 1500 : 1000;
      var lvl = db(-25 + 12 * k + (mat === 'plank' ? 4 : 0));
      v.bp.frequency.setTargetAtTime(f * (0.8 + 0.4 * k), at, 0.02);
      v.bp.Q.setTargetAtTime(mat === 'track' ? 1.8 : 0.9, at, 0.02);
      if (v.pn.pan) v.pn.pan.setTargetAtTime(panOf(ev.x), at, 0.05);
      v.lfo.frequency.setTargetAtTime(5 + 22 * k, at, 0.05);
      var g = v.g.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(lvl, at, 0.015);
      g.setTargetAtTime(0, at + 0.13, 0.05);           // no news: it has stopped rolling
      // the haulage track has joints: the marble goes clickety like a tiny train
      if (mat === 'track') {
        var strong = (v.n % 2) === 0;
        play(tickBuf('track', strong ? 74 : 79, v.n % 3), at, { gain: db(strong ? -30 : -35), lane: laneOf(ev.x), tier: 1, rate: 1.0 + 0.02 * r() });
        play(clickBuf(v.n % 6), at, { gain: db(strong ? -33 : -38), lane: laneOf(ev.x) });
      } else if (r() < 0.5) {
        play(clickBuf(v.n % 6), at, { gain: db(-42 + 6 * k), lane: laneOf(ev.x), rate: 0.7 });
      }
    }

    function clack(ev, at, r) {
      var sp = ev.speed || 60, k = clamp(Math.log(sp / 16) / Math.log(420 / 16), 0, 1);
      var L = -30 + 15 * k, dens = density(at);
      if (dens > 14) L += 20 * Math.log(Math.pow(14 / dens, 0.42)) / Math.LN10;
      var nv = voicesAt(at);
      if (nv >= 44 || (nv >= 30 && L < -24)) { st.stats.dropped++; return; }
      st.recent.push(at);
      var ns = TB.glass.notes, lane = laneOf(ev.x);
      // each marble colour has its own note: two marbles meeting ring a dyad
      var a = ns[((ev.m | 0) % 5 + 5) % 5], b = ns[((ev.other | 0) % 5 + 5) % 5];
      play(tickBuf('glass', a, 0), at, { gain: db(L), lane: lane, tier: tierOf(ev.y) });
      play(tickBuf('glass', b, 1), at + 0.0007, { gain: db(L - 2), lane: lane });
      play(clickBuf(Math.floor(r() * 6)), at, { gain: db(L + 2), lane: lane });
      play(clickBuf(Math.floor(r() * 6)), at + 0.0021 + 0.001 * r(), { gain: db(L - 7), lane: lane });   // the second touch
      st.voices.push(at + 0.06);
    }

    function wheel(ev, at, r) {
      contact(ev, at, 'wheel', r);
      var x = ev.x, lane = laneOf(x), k = clamp((ev.speed || 60) / 300, 0, 1);
      if (ev.id === 'ventdoor') {
        // the door slams on its hinge, and the draught whistles through the gap
        creak(at + 0.01, { rate: 38, rate1: 30, f: 820, peak: db(-31), d: 0.12, lane: lane });
        if (at - (st.lastDraught || -9) > 0.45) { draught(at + 0.03, x, 1, r); st.lastDraught = at; }
      } else if (ev.id === 'sheave') {
        creak(at + 0.02, { rate: 22 + 6 * r(), rate1: 17, f: 640, peak: db(-32 + 4 * k), d: 0.22, lane: lane });
      } else {
        noise(at, { ft: 'lowpass', f: 700, q: 0.7, peak: db(-31 + 5 * k), a: 0.002, d: 0.08, dest: G.lanes[lane] });   // dust off the paddle
      }
    }
    // stick-slip: a pulse train through a wooden body (a creak, a hinge)
    function creak(t, o) {
      var osc = ctx.createOscillator(); osc.type = 'sawtooth';
      osc.frequency.value = o.rate; osc.frequency.setValueAtTime(o.rate, t);
      osc.frequency.linearRampToValueAtTime(o.rate1 || o.rate, t + o.d);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = o.f; bp.Q.value = o.q || 6;
      var e = envGain(t, o.peak, o.a || 0.02, o.d * 0.6, o.d * 0.4);
      osc.connect(bp); bp.connect(e.g); e.g.connect(o.dest || G.lanes[o.lane == null ? 3 : o.lane]);
      osc.start(t); osc.stop(e.end);
      osc.onended = function () { try { bp.disconnect(); e.g.disconnect(); } catch (err) {} };
    }
    // air through the door's gap: a breathy whistle that bends as the door swings
    function draught(t, x, amt, r) {
      var f = 1150 + 250 * r();
      var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
      var b1 = ctx.createBiquadFilter(); b1.type = 'bandpass'; b1.Q.value = 22;
      b1.frequency.setValueAtTime(f, t); b1.frequency.linearRampToValueAtTime(f * 1.3, t + 0.22); b1.frequency.linearRampToValueAtTime(f * 1.12, t + 0.55);
      var b2 = ctx.createBiquadFilter(); b2.type = 'bandpass'; b2.Q.value = 26;
      b2.frequency.setValueAtTime(f * 2.02, t); b2.frequency.linearRampToValueAtTime(f * 2.6, t + 0.22); b2.frequency.linearRampToValueAtTime(f * 2.25, t + 0.55);
      var g2 = ctx.createGain(); g2.gain.value = 0.3;
      var e = envGain(t, db(-17) * amt, 0.07, 0.35, 0.12);
      src.connect(b1); b1.connect(e.g); src.connect(b2); b2.connect(g2); g2.connect(e.g);
      e.g.connect(G.lanes[laneOf(x)]); e.g.connect(G.sends[1]);
      src.start(t, 0.77); src.stop(e.end);
      src.onended = function () { try { b1.disconnect(); b2.disconnect(); g2.disconnect(); e.g.disconnect(); } catch (err) {} };
    }

    /* ── knocks: three dry knocks in the rock ─────────────────────── */
    function knocks(at, x, o) {
      o = o || {};
      var lane = laneOf(x), base = o.level == null ? -17 : o.level, gaps = o.gaps || [0, 0.17, 0.31], r = lcg(hashStr('kn' + at.toFixed(3)));
      for (var i = 0; i < gaps.length; i++) {
        var lv = base + (i === gaps.length - 1 ? 1 : -1.5 * i);
        play(knockBuf(Math.floor(r() * 4)), at + gaps[i] + (r() - 0.5) * 0.012, { gain: db(lv), lane: lane, tier: 2, rate: (o.rate || 1) * (0.94 + 0.12 * r()) });
      }
    }

    /* ── the whistles: a distant train, and the mine's near cousin ────
     * A steam chime whistle: nearly pure, breathy at the edge, QUILLED (the
     * pitch climbs as the valve opens and sags as it shuts), and its chimes
     * are never quite in tune with each other, which is the lonesome part. */
    function chimeWhistle(t, f, dur, o) {
      var dest = o.dest;
      var osc = ctx.createOscillator(); osc.type = 'sine';
      var o2 = ctx.createOscillator(); o2.type = 'sine';
      var o3 = ctx.createOscillator(); o3.type = 'sine';
      var fq = [[osc, 1], [o2, 2], [o3, 3]];
      var sh = o.sharp || 0, dop = o.doppler || 0, q = 0.2 + 0.1 * (o.slow || 0);
      fq.forEach(function (p) {
        var fr = p[0].frequency, ff = f * p[1];
        fr.value = ff * cents(sh - 80);
        fr.setValueAtTime(ff * cents(sh - 80), t);               // the valve cracks: flat
        fr.exponentialRampToValueAtTime(ff * cents(sh), t + q);   // …quilled up to pitch
        if (dop) fr.exponentialRampToValueAtTime(ff * cents(sh + dop), t + dur - 0.14);   // the train going away
        else fr.setValueAtTime(ff * cents(sh), t + dur - 0.14);
        fr.exponentialRampToValueAtTime(ff * cents(sh + dop - 45), t + dur + 0.1);        // and sagging as it shuts
      });
      // pressure flutter: a steady wobble and a slower drift
      var v1 = ctx.createOscillator(); v1.frequency.value = 5.2 + (o.vib || 0);
      var v1d = ctx.createGain(); v1d.gain.value = 6;
      var v2 = ctx.createOscillator(); v2.frequency.value = 1.3 + (o.vib || 0) * 0.3;
      var v2d = ctx.createGain(); v2d.gain.value = 4;
      v1.connect(v1d); v2.connect(v2d);
      fq.forEach(function (p) { v1d.connect(p[0].detune); v2d.connect(p[0].detune); });
      var g1 = ctx.createGain(); g1.gain.value = 1;
      var g2 = ctx.createGain(); g2.gain.value = 0.14 + 0.25 * (o.bright || 0);
      var g3 = ctx.createGain(); g3.gain.value = 0.05 + 0.12 * (o.bright || 0);
      osc.connect(g1); o2.connect(g2); o3.connect(g3);
      var e = ctx.createGain(); e.gain.value = 0;
      e.gain.setValueAtTime(0, t);
      e.gain.linearRampToValueAtTime(o.peak * 0.7, t + 0.06);
      e.gain.linearRampToValueAtTime(o.peak, t + 0.24);
      e.gain.setValueAtTime(o.peak, t + dur - 0.1);
      e.gain.linearRampToValueAtTime(0, t + dur + 0.12);
      g1.connect(e); g2.connect(e); g3.connect(e); e.connect(dest);
      // the breath at the lip, tuned to the chime
      var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 9;
      var ng = ctx.createGain(); ng.gain.value = 2.6 + 3 * (o.bright || 0);
      src.connect(bp); bp.connect(ng); ng.connect(e);
      var end = t + dur + 0.2;
      [osc, o2, o3, v1, v2].forEach(function (s) { s.start(t); s.stop(end); });
      src.start(t, (f * 0.001) % 1.5); src.stop(end);
      osc.onended = function () { [g1, g2, g3, e, v1d, v2d, bp, ng].forEach(function (n) { try { n.disconnect(); } catch (err) {} }); };
    }
    // the steam itself: a hiss as the valve cracks, a sigh as it shuts
    function steam(t, dur, peak, dest) {
      noise(t, { ft: 'highpass', f: 2600, q: 0.6, peak: peak, a: 0.015, d: 0.3, dest: dest });
      noise(t + dur - 0.05, { ft: 'bandpass', f: 1800, f1: 900, q: 0.8, peak: peak * 0.6, a: 0.02, d: 0.25, dest: dest });
    }
    var WHISTLE = [64, 67, 71];              // E G B: the train's chord (E minor, in G)
    var WHISTLE_TUNE = [8, -6, 13];          // …and none of the three chimes agree
    // THE DISTANT TRAIN: far off, low, one side of the valley; the ridge answers
    function train(t, k) {
      var r = lcg(mixh(SEED, 4000 + k));
      var pan = (r() < 0.5 ? -1 : 1) * (0.35 + 0.3 * r());
      var pn = panner(pan); pn.connect(G.far);
      var bus = ctx.createGain(); bus.gain.value = 1; bus.connect(pn);
      // two long, lonesome blasts; now and then the crossing call (long, long, short, long)
      var pat = r() < 0.4 ? [[0, 1.2], [1.55, 1.2], [3.05, 0.42], [3.7, 2.0]] : [[0, 1.6], [2.0, 2.5]];
      var doppler = -18 - 16 * r(), peak = db(-19);
      pat.forEach(function (p, i) {
        for (var c = 0; c < 3; c++) chimeWhistle(t + p[0] + 0.012 * c, mtof(WHISTLE[c]), p[1], { peak: peak * (c === 1 ? 1 : 0.8), sharp: WHISTLE_TUNE[c], doppler: doppler * (i + 1) / pat.length, bright: 0, slow: 1, vib: c * 0.4, dest: bus });
      });
      // the train itself, rolling, far below the whistle
      var len = pat[pat.length - 1][0] + pat[pat.length - 1][1] + 3;
      var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 95;
      var g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t - 1.5); g.gain.linearRampToValueAtTime(db(-24), t + len * 0.4); g.gain.linearRampToValueAtTime(0, t + len);
      src.connect(lp); lp.connect(g); g.connect(bus);
      src.start(Math.max(0, t - 1.5), 0.2); src.stop(t + len + 0.1);
      src.onended = function () { try { lp.disconnect(); g.disconnect(); bus.disconnect(); pn.disconnect(); } catch (e) {} };
      st.trains++;
      return t + len;
    }
    // the shift whistle at the tipple: the train's cousin, closer, brighter,
    // and an octave up (it's a model; its whistle is the size of a thumb)
    function shiftWhistle(t, pat, level) {
      var bus = ctx.createGain(); bus.gain.value = 1;
      var pn = panner(panOf(84)); bus.connect(pn); pn.connect(G.sfx); bus.connect(G.sends[0]);
      var peak = db(level == null ? -23 : level);
      var end = t;
      pat.forEach(function (p) {
        for (var c = 0; c < 3; c++) chimeWhistle(t + p[0] + 0.006 * c, mtof(WHISTLE[c] + 12), p[1], { peak: peak * (c === 1 ? 1 : 0.75), sharp: WHISTLE_TUNE[c] * 0.6, bright: 0.85, vib: c * 0.5, dest: bus });
        steam(t + p[0], p[1], peak * 0.5, bus);
        end = Math.max(end, t + p[0] + p[1] + 0.4);
      });
      setTimeoutAudio(end, function () { try { bus.disconnect(); pn.disconnect(); } catch (e) {} });
    }
    function whistleFor(value) {
      if (value >= 13) return [[0, 1.2], [1.45, 0.3], [1.85, 0.55]];
      if (value >= 3) return [[0, 0.32], [0.44, 0.62]];
      return [[0, 0.55]];
    }
    // audio-time callbacks for cleanup: checked by the pump
    function setTimeoutAudio(t, fn) { st.pending.push({ at: t + 0.1, fn: fn, kind: 'gc' }); }

    /* ── the bucket, the chimes ────────────────────────────────────── */
    function coinIntoBucket(t, lvl, x, r) {
      var fq = Math.min(4, Math.round(st.fill * 4));
      play(coinBuf(Math.floor(r() * 4), fq), t, { gain: db(lvl), lane: laneOf(x == null ? 250 : x), tier: 0, rate: 0.97 + 0.06 * r() });
      st.fill = Math.min(1, st.fill + 1 / 70);
    }
    var BAY_NOTE = [79, 81, 83, 86, 88, 91, 93, 91, 95, 98, 100, 103, 105];
    function chime(t, note, lvl, x) { play(chimeBuf(note), t, { gain: db(lvl), lane: laneOf(x), tier: 1 }); }

    /* ── THE MOTHER LODE ───────────────────────────────────────────── */
    function lode(at, x, r) {
      st.lodeUntil = at + 8;
      x = x == null ? 177 : x;
      var lane = laneOf(x);
      // the held breath: the room and the music drop away
      [G.room.gain, G.music.gain, G.air.gain].forEach(function (g) {
        var v = g.value;
        g.cancelScheduledValues(at); g.setValueAtTime(v, at);
        g.linearRampToValueAtTime(v * 0.2, at + 0.06);
        g.setValueAtTime(v * 0.2, at + 1.0);
        g.linearRampToValueAtTime(v || (g === G.room.gain ? 1 : 0), at + 2.4);
      });
      var t = at + 0.3;
      // the vein splits: a crack, the ground dropping under it, rock tearing
      noise(t, { ft: 'highpass', f: 380, q: 0.7, peak: db(-9), a: 0.0008, d: 0.07, dest: G.lanes[lane] });
      noise(t, { f: 1700, q: 0.7, peak: db(-14), a: 0.001, d: 0.15, dest: G.lanes[lane] });
      tone(t, { f: 54, f1: 29, glide: 0.6, peak: db(-8), a: 0.004, d: 1.0 });
      noise(t + 0.02, { ft: 'lowpass', f: 120, q: 0.6, peak: db(-13), a: 0.08, hold: 0.5, d: 2.2, dest: G.sfx });
      for (var i = 0; i < 30; i++) {
        var tc = t + 0.02 + 0.5 * Math.pow(i / 30, 0.75), ln = clamp(lane + Math.round((r() - 0.5) * (2 + i / 6)), 0, 6);
        if (i % 3 === 0) play(tickBuf('stone', TB.stone.notes[i % TB.stone.notes.length], i % 3), tc, { gain: db(-17 - 6 * r()), lane: ln, tier: 2 });
        else noise(tc, { f: 700 + 2800 * r(), q: 2, peak: db(-15 - 7 * r()), a: 0.0004, d: 0.005 + 0.01 * r(), dest: G.lanes[ln] });
      }
      for (var p = 0; p < 22; p++) {                   // the loose rock comes down
        var tp = t + 0.35 + 1.4 * Math.pow(p / 22, 1.3), key = p % 2 ? 'coal' : 'stone';
        play(tickBuf(key, TB[key].notes[(p * 3) % TB[key].notes.length], p % 3), tp, { gain: db(-20 - p * 0.5), lane: clamp(lane + ((p % 5) - 2), 0, 6), tier: 2 });
      }
      // every lamp flares
      noise(t + 0.15, { f: 330, q: 0.8, peak: db(-21), a: 0.12, d: 0.5, dest: G.sfx });
      noise(t + 0.15, { ft: 'highpass', f: 3000, peak: db(-29), a: 0.05, d: 0.6, dest: G.sfx });
      // the cascade: every bay's bar rings, up the scale and tumbling back down
      var tc0 = at + 0.55, notes = scaleBetween(79, 103), n = 0, tt;
      for (i = 0; i < notes.length; i++) { tt = tc0 + i * 0.045; chime(tt, notes[i], -17 + i * 0.12, 20 + i * 26); n++; }
      var t2 = tc0 + notes.length * 0.045 + 0.05;
      for (i = notes.length - 2; i >= 0; i--) { tt = t2 + (notes.length - 2 - i) * 0.072; chime(tt, notes[i], -18.5, 300 - i * 26); }
      var t3 = t2 + (notes.length - 1) * 0.072 + 0.08;
      [91, 95, 98, 103].forEach(function (m, j) { chime(t3 + j * 0.012, m, -16.5, 177); });
      // the scrip pours: coins into the plastic bucket, fast, then the stragglers
      for (i = 0; i < 30; i++) coinIntoBucket(at + 0.8 + 2.7 * Math.pow(i / 30, 1.6) + 0.02 * r(), -17 - 3 * r(), 150 + 140 * r(), r);
      // the whistle, long, then toot-toot
      shiftWhistle(at + 0.95, whistleFor(13), -18);
      // carts race: the haulage way rattles end to end
      noise(at + 1.0, { ft: 'lowpass', f: 180, q: 0.8, peak: db(-24), a: 0.2, hold: 1.4, d: 0.5, dest: G.lanes[1] });
      for (i = 0; i < 26; i++) play(tickBuf('track', i % 2 ? 79 : 74, i % 3), at + 1.05 + i * 0.07, { gain: db(i % 2 ? -32 : -28), lane: clamp(Math.round(i / 5), 0, 6), tier: 1 });
      // the crew cheers: six carved men, tiny voices, not supposed to be alive
      cheer(at + 1.15, r);
      // and the music box plays the tune through, the broken tine ringing for once
      play(flourishBuf(), at + 3.1, { gain: db(-19), lane: 3, tier: 1 });
      st.tineFixed = true;                             // the knockers fixed it; for the rest of the visit
      idle(musicBuf, 9000);
    }

    // formant voices: a glottal pulse through three vowel bands, a breath for the h
    var GLOTTAL = null;
    function glottal() {
      if (GLOTTAL) return GLOTTAL;
      var N = 40, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (var i = 1; i <= N; i++) im[i] = 1 / Math.pow(i, 1.35);
      GLOTTAL = ctx.createPeriodicWave(re, im);
      return GLOTTAL;
    }
    var VOWEL = { u: [330, 900, 2300], a: [700, 1200, 2600], e: [560, 1800, 2550], i: [320, 2250, 2950], o: [520, 920, 2450] };
    function toyVoice(t, o) {
      var sc = o.scale || 1.35, f0 = o.f0, dest = G.lanes[o.lane == null ? 3 : o.lane];
      var src = ctx.createOscillator(); src.setPeriodicWave(glottal());
      var nz = ctx.createBufferSource(); nz.buffer = G.noise; nz.loop = true;
      var vib = ctx.createOscillator(); vib.frequency.value = 5.5 + (o.shake || 0) * 2;
      var vd = ctx.createGain(); vd.gain.value = 25 + (o.shake || 0) * 60;   // cents; old Jory's is all wobble
      vib.connect(vd); vd.connect(src.detune);
      var pre = ctx.createGain(); pre.gain.value = 1;
      var nzg = ctx.createGain(); nzg.gain.value = 0;
      src.connect(pre);
      var sum = ctx.createGain(); sum.gain.value = 0;
      var F = [0, 1, 2].map(function (i) {
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [5, 9, 12][i];
        var g = ctx.createGain(); g.gain.value = [1, 0.55, 0.3][i];
        pre.connect(bp); nzg.connect(bp); bp.connect(g); g.connect(sum);
        return bp;
      });
      nz.connect(nzg);
      sum.connect(dest); sum.connect(G.sends[1]);
      var fr = src.frequency, end = t;
      function vowel(tt, v, glide) {
        for (var i = 0; i < 3; i++) {
          var hz = VOWEL[v][i] * sc;
          if (glide) F[i].frequency.linearRampToValueAtTime(hz, tt); else F[i].frequency.setValueAtTime(hz, tt);
        }
      }
      function syl(tt, dur, v0, v1, p0, p1, pk, h) {
        if (h) { nzg.gain.setValueAtTime(0, tt - 0.06); nzg.gain.linearRampToValueAtTime(pk * 0.9, tt - 0.03); nzg.gain.linearRampToValueAtTime(0, tt + 0.02); }
        vowel(tt, v0, false); vowel(tt + dur * 0.8, v1, true);
        fr.setValueAtTime(f0 * p0, tt); fr.exponentialRampToValueAtTime(f0 * p1, tt + dur);
        sum.gain.setValueAtTime(0, tt); sum.gain.linearRampToValueAtTime(pk, tt + 0.03);
        sum.gain.setValueAtTime(pk, tt + dur - 0.05); sum.gain.linearRampToValueAtTime(0, tt + dur);
        end = Math.max(end, tt + dur);
      }
      var pk = o.peak;
      fr.value = f0;
      if (o.kind === 'whoop') {
        syl(t, 0.42, 'u', 'i', 0.9, 1.9, pk, false);
      } else if (o.kind === 'hey') {
        syl(t, 0.3, 'e', 'i', 1.3, 1.1, pk, true);
      } else {                                          // hoo-RAY
        syl(t, 0.17, 'u', 'u', 1.0, 0.95, pk * 0.8, true);
        var t2 = t + 0.22;
        syl(t2, 0.4 * (o.slow || 1), 'e', 'i', 1.12, 1.5, pk, false);
        F[2].frequency.setValueAtTime(1600 * sc, t2);  // the r, then into the ay
        F[2].frequency.linearRampToValueAtTime(VOWEL.e[2] * sc, t2 + 0.06);
      }
      [src, nz, vib].forEach(function (s) { s.start(t - 0.08); s.stop(end + 0.05); });
      src.onended = function () { [pre, nzg, sum, vd].concat(F).forEach(function (n) { try { n.disconnect(); } catch (e) {} }); };
    }
    function cheer(t, r) {
      var crew = [
        { f0: 245, kind: 'hooray', lane: 2 },             // Absalom, the tall one
        { f0: 285, kind: 'hooray', lane: 4 },             // Tobias, the lantern man
        { f0: 265, kind: 'hey', lane: 3 },                // Ezra, the pick
        { f0: 228, kind: 'hooray', lane: 1, shake: 1, slow: 1.3 },   // Old Jory
        { f0: 390, kind: 'whoop', lane: 5 },              // the little one
        { f0: 315, kind: 'hey', lane: 4 }                 // the tallyman
      ];
      crew.forEach(function (c, i) {
        var tt = t + [0, 0.05, 0.11, 0.2, 0.03, 0.15][i] + 0.03 * r();
        toyVoice(tt, { f0: c.f0 * (0.97 + 0.06 * r()), kind: c.kind, lane: c.lane, shake: c.shake, slow: c.slow, peak: db(-21) });
      });
      toyVoice(t + 0.75, { f0: 400, kind: 'whoop', lane: 5, peak: db(-23) });   // and the little one again
      toyVoice(t + 0.9, { f0: 318, kind: 'hey', lane: 4, peak: db(-25) });
    }

    /* ── event routing ─────────────────────────────────────────────── */
    function onEvent(ev) {
      if (dead || !ev || !ev.type) return;
      var type = ev.type;
      st.stats.events[type] = (st.stats.events[type] | 0) + 1;
      if (type === 'input') { if (!injected) unlock(); return; }
      var k = evCount++;
      // state first (tracked even before unlock)
      if (type === 'mode') {
        var m = String(ev.mode || '').toLowerCase();
        if (m && m !== st.mode) { if (G) setMode(m); else st.mode = m; }
      }
      if (type === 'whistle') { st.gameWhistles = true; dropPending('whistle'); }
      if (type === 'lode') { st.gameLodes = true; dropPending('lode'); }
      if (!live()) return;
      var r = lcg(evSeed(ev, k)), at = when(ev);
      try { route(type, ev, at, r); } catch (e) { if (root.console) console.warn('pachinko-audio', type, e); }
    }
    function dropPending(kind) { st.pending = st.pending.filter(function (p) { return p.kind !== kind; }); }

    function route(type, ev, at, r) {
      var x = ev.x, lane = laneOf(x);
      switch (type) {
        case 'pin': case 'rail': contact(ev, at, type, r); return;
        case 'roll': roll(ev, at, r); return;
        case 'clack': clack(ev, at, r); return;
        case 'wheel': wheel(ev, at, r); return;
        case 'ride':                                       // carried over the top: the sheave groans
          creak(at, { rate: 14, rate1: 26, f: 560, q: 5, peak: db(-27), d: 0.9, lane: laneOf(84) });
          for (var i = 0; i < 9; i++) play(tickBuf('spoke', 76, i % 3), at + 0.1 + i * 0.085, { gain: db(-36 + i * 0.4), lane: laneOf(84), tier: 0, rate: 1 + i * 0.004 });
          return;
        case 'drop': {
          if (ev.m != null && st.marbles[ev.m]) return;       // one drop per marble
          if (ev.m != null) st.marbles[ev.m] = 1;
          // the hopper's gate: a latch, a brass tick, the marble off the lip
          noise(at, { ft: 'highpass', f: 2800, q: 0.7, peak: db(-29), a: 0.0004, d: 0.012, dest: G.lanes[lane] });
          tone(at, { type: 'triangle', f: 1450 + 80 * r(), f1: 1200, peak: db(-31), a: 0.0005, d: 0.03, dest: G.lanes[lane] });
          play(tickBuf('brass', 91, 0), at + 0.012, { gain: db(-29), lane: lane, tier: 0 });
          play(clickBuf(Math.floor(r() * 6)), at + 0.012, { gain: db(-27), lane: lane });
          return;
        }
        case 'cart': return cart(ev, at, r);
        case 'tunnel': return ev.what === 'out' ? tunnelOut(ev, at, r) : tunnelIn(ev, at, r);
        case 'pocket': {
          if (ev.id === 'powder') play(powderBuf(Math.floor(r() * 3)), at, { gain: db(-14), lane: lane, tier: 1 });
          else play(pailBuf(Math.floor(r() * 3)), at, { gain: db(-13), lane: lane, tier: 1 });
          if (!st.gameWhistles) st.pending.push({ at: at + 0.38, kind: 'whistle', fn: function (t) { shiftWhistle(t, whistleFor(ev.value | 0)); } });
          return;
        }
        case 'slot': return slot(ev, at, r);
        case 'teeter': {
          // the held breath: the room goes quiet, the marble rocks on the worn bone
          var g = G.room.gain, v0 = g.value || 1;
          g.cancelScheduledValues(at); g.setValueAtTime(v0, at);
          g.linearRampToValueAtTime(0.25, at + 0.08); g.setValueAtTime(0.25, at + 0.55); g.linearRampToValueAtTime(1, at + 0.9);
          [0, 0.15, 0.27, 0.36, 0.43, 0.48].forEach(function (d, j) {
            play(tickBuf('bone', 84 - (j % 2) * 2, j % 3), at + d, { gain: db(-35 + j * 0.8), lane: lane, tier: 2, rate: 0.9 });
          });
          return;
        }
        case 'knock': {
          var n = ev.n || 1;
          knocks(at, x, { level: -18 + Math.min(3, n - 1), gaps: n >= 3 ? [0, 0.11, 0.2] : [0, 0.17, 0.31] });
          return;
        }
        case 'timeout':
          noise(at, { ft: 'highpass', f: 2200, q: 0.7, peak: db(-22), a: 0.0005, d: 0.012 });
          tone(at, { f: 110, f1: 80, peak: db(-22), a: 0.001, d: 0.09 });
          return;
        case 'done': {
          var m = ev.m;
          if (st.tunnels[m]) st.tunnels[m].end = Math.min(st.tunnels[m].end, at);
          for (var q = 0; q < G.rolls.length; q++) if (G.rolls[q].m === m) G.rolls[q].m = null;
          delete st.marbles[m];
          return;
        }
        case 'coin': {
          // a token down the chute: brass pings, the slide, the mechanism, then
          // the cabinet wakes (the relay, the tube's starter, the hum swelling)
          [[0, 1], [0.1, 0.5], [0.17, 0.28]].forEach(function (b) {
            tone(at + b[0], { f: 2650 * (1 + (r() - 0.5) * 0.02), peak: db(-21) * b[1], a: 0.0005, d: 0.3 * b[1] + 0.05 });
            tone(at + b[0], { f: 4390, peak: db(-25) * b[1], a: 0.0005, d: 0.2 * b[1] + 0.04 });
            tone(at + b[0], { f: 6120, peak: db(-29) * b[1], a: 0.0005, d: 0.14 * b[1] + 0.03 });
          });
          noise(at + 0.22, { f: 2600, f1: 1500, q: 1.5, peak: db(-26), a: 0.02, hold: 0.1, d: 0.18 });
          play(knockBuf(1), at + 0.52, { gain: db(-20), lane: 5, rate: 1.4 });
          noise(at + 0.66, { ft: 'highpass', f: 2200, q: 0.7, peak: db(-21), a: 0.0005, d: 0.012 });
          tone(at + 0.66, { f: 110, f1: 80, peak: db(-21), a: 0.001, d: 0.09 });
          noise(at + 0.78, { ft: 'highpass', f: 4000, peak: db(-26), a: 0.0005, d: 0.01 });
          noise(at + 0.86, { ft: 'highpass', f: 4000, peak: db(-28), a: 0.0005, d: 0.01 });
          tone(at + 0.86, { type: 'sawtooth', f: 120, peak: db(-31), a: 0.03, hold: 0.25, d: 0.4 });
          return;
        }
        case 'nocoin':
          for (var c = 0; c < 4; c++) {
            noise(at + c * 0.05 + 0.01 * r(), { f: 1700 + 500 * r(), q: 3, peak: db(-12 - 2 * c), a: 0.0005, d: 0.03, dest: G.lanes[5] });
            tone(at + c * 0.05, { type: 'triangle', f: 540 + 60 * r(), peak: db(-22 - 2 * c), a: 0.0005, d: 0.04, dest: G.lanes[5] });
          }
          return;
        case 'dive': {
          var out = ev.dir === -1;                           // the air in the case, then the mine's
          noise(at, { ft: 'lowpass', f: out ? 400 : 1400, f1: out ? 1400 : 300, glide: 0.7, q: 0.7, peak: db(-27), a: 0.35, d: 0.45 });
          tone(at + 0.1, { f: 70, f1: 52, peak: db(-31), a: 0.2, d: 0.6 });
          if (!out && st.mode !== 'play' && st.mode !== 'dive') setMode('dive');
          return;
        }
        case 'hopper': {
          // the carriage runs along its brass rack: a ratchet tick every 6 px
          var dx = Math.abs((ev.x || 0) - (ev.from == null ? st.lastHopper : ev.from));
          if (!(dx >= 0) || st.lastHopper < 0 && ev.from == null) dx = 30;
          var nt = clamp(Math.round(dx / 6), 1, 40), gl = ev.glide || 0.2;
          for (var h = 0; h < nt; h++) {
            var th = at + gl * Math.pow((h + 0.5) / nt, 0.8), xx = ev.from == null ? x : ev.from + (x - ev.from) * h / nt;
            noise(th, { f: 5200 + 400 * r(), q: 5, peak: db(-30 - 3 * (h % 2)), a: 0.0004, d: 0.006, dest: G.lanes[laneOf(xx)] });
          }
          tone(at + gl, { type: 'triangle', f: 900, f1: 760, peak: db(-31), a: 0.0006, d: 0.03, dest: G.lanes[lane] });
          st.lastHopper = x == null ? st.lastHopper : x;
          return;
        }
        case 'reload': {
          // the column in the feed tube shuffles down one: glass knocks on glass
          var left = ev.left == null ? 6 : ev.left, nn = clamp(left, 1, 12);
          for (var j = 0; j < nn; j++) play(tickBuf('glass', TB.glass.notes[(j * 2) % TB.glass.notes.length], j % 2), at + j * 0.018, { gain: db(-33 - j * 0.7), lane: 0, rate: 0.8 });
          play(tickBuf('brass', 86, 1), at + nn * 0.018 + 0.03, { gain: db(-29), lane: 0 });
          return;
        }
        case 'payout': {
          var now = ctx.currentTime, tq = Math.max(at, st.payNext);
          if (tq - now > 1.0) return;                       // a fast count-up: keep up, drop the backlog
          st.payNext = tq + 0.045;
          coinIntoBucket(tq, -17 - 2.5 * r(), 290, r);
          return;
        }
        case 'gameover': {
          var scrip = ev.scrip | 0;
          // the closing phrase on the music box; with nothing won it reaches the broken tine
          var ph = scrip > 0 ? [74, 71, 67] : [79, 81, MB_BROKEN];
          ph.forEach(function (m2, i2) { play(tineBuf(m2, m2 === MB_BROKEN && !st.tineFixed), at + 0.25 + i2 * 0.3, { gain: db(-22 - i2), lane: 3, tier: 1 }); });
          st.watchUntil = Math.max(st.watchUntil, at + 5.5);   // and in the lull, the watch is still going
          return;
        }
        case 'whistle': shiftWhistle(at + 0.05, whistleFor(ev.value | 0)); return;
        case 'lode':
          if (st.lodeUntil > at) return;
          lode(at, ev.x, r); return;
        case 'stolen': {
          // caught in two wooden hands; then little carved feet, at the toy's eight steps a second
          play(clickBuf(1), at, { gain: db(-24), lane: lane });
          play(tickBuf('wood', 69, 0), at + 0.02, { gain: db(-27), lane: lane, rate: 1.7 });
          play(tickBuf('wood', 67, 1), at + 0.05, { gain: db(-29), lane: lane, rate: 1.8 });
          for (var s = 0; s < 7; s++) play(tickBuf('wood', s % 2 ? 67 : 69, s % 3), at + 0.14 + s * 0.125, { gain: db(-28 - s * 1.6), lane: lane, tier: 2, rate: 2.1 + (s % 2) * 0.15 });
          return;
        }
        case 'dark': {
          var w = ev.what || 'out';
          if (w === 'flicker') {
            [0, 0.19].forEach(function (d) {
              noise(at + d, { ft: 'highpass', f: 2400, q: 0.7, peak: db(-29), a: 0.002, d: 0.08, dest: G.lanes[lane] });
              noise(at + d + 0.02, { f: 420, q: 1, peak: db(-31), a: 0.005, d: 0.06, dest: G.lanes[lane] });
            });
          } else if (w === 'out') {
            noise(at, { ft: 'highpass', f: 2000, f1: 5000, q: 0.7, peak: db(-27), a: 0.005, d: 0.45, dest: G.lanes[lane] });
            for (var d2 = 0; d2 < 5; d2++) noise(at + 0.05 + d2 * 0.07 * (1 + r()), { f: 2500 + 2000 * r(), q: 3, peak: db(-32 - d2 * 2), a: 0.0005, d: 0.006, dest: G.lanes[lane] });
            st.dark[ev.region || '?'] = true;
            duckRoom(at, 0.55, 0.4);
          } else {
            noise(at, { f: 260, f1: 520, q: 0.9, peak: db(-26), a: 0.03, d: 0.35, dest: G.lanes[lane] });   // the carbide catches
            st.dark[ev.region || '?'] = false;
            duckRoom(at, 1, 0.6);
          }
          return;
        }
        case 'lost': {
          // the marble never comes out. Much later, much further down: one tick.
          if (st.tunnels[ev.m]) st.tunnels[ev.m].end = Math.min(st.tunnels[ev.m].end, at);
          var fb = tickBuf('stone', 67, 2), fg = ctx.createGain(); fg.gain.value = db(-26);
          var fs = ctx.createBufferSource(); fs.buffer = fb; fs.playbackRate.value = 0.7;
          fs.connect(fg); fg.connect(G.far); fs.start(at + 2.4);
          fs.onended = function () { try { fg.disconnect(); } catch (e) {} };
          tone(at + 2.4, { f: 46, peak: db(-36), a: 0.02, d: 0.9, dest: G.far });
          return;
        }
        case 'cavein': {
          var cw = ev.what || 'fall', cx = x == null ? 160 : x;
          if (cw === 'telegraph') {
            // knocking in the rock for a second and a half, from more than one place; dust sifting
            knocks(at, cx - 30, { level: -19, gaps: [0, 0.16, 0.3] });
            knocks(at + 0.5, cx + 40, { level: -22, gaps: [0, 0.14, 0.27], rate: 0.85 });
            knocks(at + 1.0, cx, { level: -17, gaps: [0, 0.12, 0.23] });
            noise(at + 0.2, { ft: 'highpass', f: 3500, q: 0.5, peak: db(-40), a: 0.4, hold: 0.6, d: 0.4, dest: G.lanes[laneOf(cx)] });
            for (var g2 = 0; g2 < 16; g2++) noise(at + 0.2 + 1.3 * r(), { f: 3000 + 3000 * r(), q: 4, peak: db(-38 - 6 * r()), a: 0.0003, d: 0.004, dest: G.lanes[laneOf(cx + (r() - 0.5) * 60)] });
          } else if (cw === 'fall') {
            noise(at, { ft: 'highpass', f: 500, peak: db(-14), a: 0.001, d: 0.06, dest: G.lanes[laneOf(cx)] });
            tone(at, { f: 60, f1: 34, glide: 0.5, peak: db(-12), a: 0.005, d: 0.8 });
            noise(at + 0.02, { ft: 'lowpass', f: 160, peak: db(-16), a: 0.05, hold: 0.3, d: 1.2 });
            for (var p2 = 0; p2 < 28; p2++) {
              var key2 = p2 % 3 ? 'stone' : 'coal';
              play(tickBuf(key2, TB[key2].notes[(p2 * 5) % TB[key2].notes.length], p2 % 3), at + 0.05 + 1.1 * Math.pow(p2 / 28, 1.25), { gain: db(-18 - p2 * 0.45), lane: laneOf(cx + (r() - 0.5) * 70), tier: 2 });
            }
            noise(at + 0.3, { ft: 'highpass', f: 3000, q: 0.5, peak: db(-36), a: 0.2, hold: 0.8, d: 1.0 });
          } else {
            for (var sc2 = 0; sc2 < 3; sc2++) noise(at + sc2 * 0.4, { f: 1100, f1: 1700, q: 1.4, peak: db(-30), a: 0.03, d: 0.22, dest: G.lanes[laneOf(cx)] });   // a shovel
          }
          return;
        }
        case 'work': {
          // the toolbox opens: a wooden clack, a tool set down
          play(tickBuf('wood', 64, 0), at, { gain: db(-27), lane: 3, tier: 1 });
          play(tickBuf('wood', 62, 1), at + 0.09, { gain: db(-30), lane: 3, tier: 1 });
          play(tickBuf('spike', 91, 2), at + 0.3, { gain: db(-33), lane: 3, tier: 1 });
          return;
        }
        case 'figure': {
          var fw = ev.what || 'step', nv = voicesAt(at);
          if (nv > 36) return;
          if (fw === 'step') play(tickBuf('wood', 69, Math.floor(r() * 3)), at, { gain: db(-38 + 3 * r()), lane: lane, rate: 2.0 + 0.3 * r(), tier: tierOf(ev.y) });
          else if (fw === 'tap' || fw === 'set') {         // a mallet on a pin: the pin's own note
            play(tickBuf('spike', noteFor(TB.spike, 'tap' + Math.round(x || 0), ev.y), 0), at, { gain: db(-29), lane: lane, tier: tierOf(ev.y) });
            play(tickBuf('wood', 64, 2), at, { gain: db(-33), lane: lane, rate: 1.5 });
          } else if (fw === 'pull') creak(at, { rate: 60, rate1: 110, f: 2400, q: 8, peak: db(-33), d: 0.14, lane: lane });   // a nail out of wood
          else if (fw === 'lay') play(tickBuf('prop', 64, 1), at, { gain: db(-28), lane: lane, tier: tierOf(ev.y) });
          else if (fw === 'cheer') toyVoice(at, { f0: 260 + 120 * r(), kind: r() < 0.5 ? 'hey' : 'whoop', lane: lane, peak: db(-27) });
          return;
        }
        case 'rare': return;       // the rare tier's hook: silent until the adventure fills it
      }
    }

    function slot(ev, at, r) {
      var v = ev.value | 0, x = ev.x == null ? 160 : ev.x, lane = laneOf(x), idx = ((ev.legend | 0) - 20);
      if (!(idx >= 0 && idx < 13)) idx = clamp(Math.floor(x / 320 * 13), 0, 12);
      // the drop into the bay: a wooden thud, the marble rattling between the dividers
      play(tickBuf('wood', TB.wood.notes[idx % TB.wood.notes.length], idx % 3), at, { gain: db(v >= 13 ? -15 : -20), lane: lane, tier: 2 });
      play(clickBuf(idx % 6), at + 0.004, { gain: db(-25), lane: lane });
      play(tickBuf('wood', TB.wood.notes[(idx + 2) % TB.wood.notes.length], (idx + 1) % 3), at + 0.06 + 0.02 * r(), { gain: db(-29), lane: lane, tier: 2 });
      if (v <= 0) {
        noise(at + 0.01, { ft: 'lowpass', f: 900, q: 0.6, peak: db(-33), a: 0.004, d: 0.14, dest: G.lanes[lane] });   // into the gob pile: dust
        return;
      }
      if (v >= 13) {
        if (!st.gameLodes) st.pending.push({ at: at + 0.12, kind: 'lode', fn: function (t) { if (st.lodeUntil < t) lode(t - 0.12, x, r); } });
        return;
      }
      // a chime per scrip, up the scale from the bay's own bar
      var base = BAY_NOTE[idx], ns = scaleBetween(base, base + 14);
      for (var i = 0; i < Math.min(v, 5); i++) chime(at + 0.07 + i * 0.09, ns[Math.min(i, ns.length - 1)], -16 - i, x);
      if (!st.gameWhistles && v >= 5) st.pending.push({ at: at + 0.4, kind: 'whistle', fn: function (t) { shiftWhistle(t, whistleFor(v)); } });
    }

    function cart(ev, at, r) {
      var x = ev.x, lane = laneOf(x);
      if (ev.what === 'catch') {
        play(tickBuf('bucket', 67, Math.floor(r() * 3)), at, { gain: db(-18), lane: lane, tier: 1 });
        play(clickBuf(Math.floor(r() * 6)), at, { gain: db(-24), lane: lane });
        [0.07, 0.12, 0.155].forEach(function (d, i) { play(tickBuf('bucket', 67, i), at + d, { gain: db(-28 - 4 * i), lane: lane, rate: 1.3 }); });
        var C = st.cart;
        if (!C) {
          var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
          var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 0.8;
          var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 4;
          var am = ctx.createGain(); am.gain.value = 0.5;
          var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9;
          var ld = ctx.createGain(); ld.gain.value = 0.45;
          var g = ctx.createGain(); g.gain.value = 0;
          lfo.connect(ld); ld.connect(am.gain);
          src.connect(lp); lp.connect(g); src.connect(bp); bp.connect(am); am.connect(g);
          g.connect(G.lanes[laneOf(60)]); g.connect(G.sends[1]);
          src.start(at, 0.9); lfo.start(at);
          C = st.cart = { n: 0, until: at + 3, next: at + 0.2, src: src, lfo: lfo, g: g, nodes: [lp, bp, am, ld, g] };
        }
        C.n++; C.until = at + 3;
        C.g.gain.cancelScheduledValues(at); C.g.gain.setTargetAtTime(db(-26 + 2 * Math.min(2, C.n - 1)), at + 0.1, 0.08);
      } else {
        // the tip: the pivot squeals, the marble slides out over the lip, the bucket hits its stop
        if (at - st.lastDump > 0.15) {
          creak(at, { rate: 70, rate1: 45, f: 1400, q: 7, peak: db(-29), d: 0.16, lane: lane });
          play(tickBuf('bucket', 67, 2), at + 0.13, { gain: db(-19), lane: lane, tier: 1, rate: 0.95 });
          st.lastDump = at;
        }
        noise(at + 0.02, { f: 3200, f1: 1600, q: 1.2, peak: db(-29), a: 0.01, d: 0.12, dest: G.lanes[lane] });
        var C2 = st.cart;
        if (C2) { C2.n--; if (C2.n <= 0) C2.until = at + 0.05; }
      }
    }

    function tunnelIn(ev, at, r) {
      var info = BI.tunnels[ev.id] || { a: { x: ev.x, y: ev.y }, b: { x: 160, y: 330 }, delay: 1.0 };
      var x = ev.x == null ? info.a.x : ev.x, lane = laneOf(x), delay = info.delay || 1;
      var old = st.tunnels[ev.m];
      if (old) { old.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} }); delete st.tunnels[ev.m]; }
      // the mouth takes it: a hollow thoonk
      play(tickBuf('prop', 62, 0), at, { gain: db(-22), lane: lane, tier: 2, rate: 0.85 });
      play(clickBuf(3), at, { gain: db(-27), lane: lane });
      // then its rattle through the rock: down a pipe, darker as it goes deeper, moving across
      var inp = ctx.createGain(); inp.gain.value = 1;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(2400, at);
      lp.frequency.exponentialRampToValueAtTime(380, at + delay * 0.55);
      lp.frequency.exponentialRampToValueAtTime(1500, at + delay * 0.97);
      var dl = ctx.createDelay(0.05); dl.delayTime.value = 0.0042 + 0.0015 * r();
      var fb = ctx.createGain(); fb.gain.value = 0.55;
      var pn = panner(panOf(x));
      if (pn.pan) { pn.pan.setValueAtTime(panOf(x), at); pn.pan.linearRampToValueAtTime(panOf(info.b.x), at + delay); }
      var g = ctx.createGain(); g.gain.value = 1;
      inp.connect(lp); lp.connect(pn); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(pn);
      pn.connect(g); g.connect(G.sfx); g.connect(G.sends[2]);
      st.tunnels[ev.m] = { at: at, end: at + delay, next: at + 0.08, inp: inp, g: g, nodes: [inp, lp, dl, fb, pn, g], delay: delay, n: 0, id: ev.id };
    }
    function tunnelOut(ev, at, r) {
      var T = st.tunnels[ev.m];
      if (T) T.end = Math.min(T.end, at);
      var lane = laneOf(ev.x);
      // out it pops, onto the rock
      play(tickBuf('stone', 69, 1), at, { gain: db(-24), lane: lane, tier: 2 });
      play(clickBuf(4), at + 0.003, { gain: db(-23), lane: lane });
      noise(at, { ft: 'lowpass', f: 600, q: 0.7, peak: db(-32), a: 0.002, d: 0.06, dest: G.lanes[lane] });
    }

    function duckRoom(at, to, dur) {
      var g = G.hum.gain;
      g.cancelScheduledValues(at); g.setValueAtTime(g.value, at);
      g.linearRampToValueAtTime(to, at + dur);
    }

    /* ── the pump: what keeps going between events ─────────────────── */
    function pump() {
      if (dead || !G) return;
      if (!injected && !live()) return;
      var now = ctx.currentTime, ahead = now + 0.15, i, k;
      // tunnels: the rattle through the rock, a tick at a time
      for (k in st.tunnels) {
        var T = st.tunnels[k];
        while (T.next < ahead && T.next < T.end - 0.04) {
          var u = (T.next - T.at) / T.delay, rr = lcg(mixh(hashStr(k), T.n));
          var key = T.n % 3 ? 'stone' : 'prop';
          play(tickBuf(key, TB[key].notes[(T.n * 2) % TB[key].notes.length], T.n % 3), T.next, { gain: db(-21 - 9 * Math.sin(Math.PI * clamp(u, 0, 1))), dest: T.inp, rate: 0.9 + 0.2 * rr() });
          T.n++; T.next += 0.05 + 0.1 * rr();
        }
        if (now > T.end + 0.05 && !T.closing) {
          T.closing = true;
          T.g.gain.setTargetAtTime(0, Math.max(now, T.end), 0.08);
        }
        if (now > T.end + 0.8) {
          T.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
          delete st.tunnels[k];
        }
      }
      // the cart: rumbling while it carries; marbles tick in the bucket
      var C = st.cart;
      if (C) {
        while (C.n > 0 && C.next < ahead && C.next < C.until) {
          var rc = lcg(mixh(0xca27, Math.round(C.next * 1000)));
          play(tickBuf('bucket', 67, Math.floor(rc() * 3)), C.next, { gain: db(-35 - 4 * rc()), lane: laneOf(60 + 20 * rc()), rate: 1.4 + 0.3 * rc() });
          C.next += 0.11 + 0.13 * rc();
        }
        if (now > C.until && !C.closing) { C.closing = true; C.g.gain.cancelScheduledValues(now); C.g.gain.setTargetAtTime(0, now, 0.07); C.stopAt = now + 0.5; }
        if (C.closing && now > C.stopAt) {
          try { C.src.stop(); C.lfo.stop(); } catch (e) {}
          C.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
          st.cart = null;
        }
      }
      // Fig. 7: the watch ticks five times a second, on the audio clock
      if (st.watchUntil > now) {
        var g0 = Math.ceil(Math.max(now, st.watchNext) / 0.2);
        for (var gt = g0; gt * 0.2 < Math.min(ahead, st.watchUntil); gt++) {
          var tt = gt * 0.2, fade = clamp((st.watchUntil - tt) / 1.2, 0, 1);
          play(watchBuf(gt % 2), tt, { gain: db(-33) * fade, lane: laneOf(BI.watch.x), tier: 1 });
          st.watchNext = tt + 0.01;
        }
      }
      // the distant train
      if (st.nextTrain != null && now >= st.nextTrain - 0.2) {
        if (st.lodeUntil > now) st.nextTrain = st.lodeUntil + 6;
        else { train(Math.max(now + 0.05, st.nextTrain), st.trains); st.nextTrain = trainPlan(now, st.trains); }
      }
      // the case light stutters, now and then
      if (st.nextFlicker != null && now >= st.nextFlicker) {
        flicker(now + 0.05, lcg(mixh(SEED, 900 + Math.round(now))));
        st.nextFlicker = now + 55 + 85 * h01(SEED, 901 + Math.round(now));
      }
      // held-back whistles and lodes, and cleanups
      if (st.pending.length) {
        var keepP = [];
        for (i = 0; i < st.pending.length; i++) {
          var p = st.pending[i];
          if (now >= p.at - 0.12) { try { p.fn(Math.max(p.at, now + 0.01)); } catch (e) { if (root.console) console.warn('pachinko-audio pending', e); } }
          else keepP.push(p);
        }
        st.pending = keepP;
      }
      // many marbles: the cave fills up (more room on the send)
      var dens = density(now);
      G.sendAll.gain.setTargetAtTime(1 + 0.7 * clamp((dens - 10) / 40, 0, 1), now, 0.3);
      // tidy the pin memory now and then
      if ((evCount & 511) === 0) for (var id in st.lastPin) if (now - st.lastPin[id] > 2) delete st.lastPin[id];
    }
    function trainPlan(now, n) {
      if (opts.train === false) return null;
      if (opts.train && opts.train.length) return n < opts.train.length ? opts.train[n] : null;
      // a few times a session, at seeded moments: the first within the first two minutes
      return now + (n === 0 ? 55 + 60 * h01(SEED, 1) : 150 + 170 * h01(SEED, 10 + n));
    }
    function flicker(t, r) {
      var g = G.flick.gain, n = 4 + Math.floor(r() * 5), tt = t;
      g.cancelScheduledValues(t); g.setValueAtTime(1, t);
      for (var i = 0; i < n; i++) {
        g.setValueAtTime(r() < 0.5 ? 0.1 : 2.2, tt); tt += 0.03 + 0.09 * r();
        g.setValueAtTime(1, tt); tt += 0.02 + 0.08 * r();
        if (i % 2 === 0) noise(tt, { ft: 'highpass', f: 4200, peak: db(-36), a: 0.0005, d: 0.008, dest: G.room });   // the starter ticks
      }
      g.setValueAtTime(1, tt);
    }

    /* ── unlock, visibility, mute (HOLLER ROLLER's rules) ──────────── */
    var GESTURES = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'click', 'keydown'];
    function activated() {
      var ua = typeof navigator !== 'undefined' && navigator.userActivation;
      return !ua || !!ua.isActive;
    }
    function unlock() {
      if (dead || injected || !activated()) return;
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
        build();
        try { var b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0); } catch (e3) {}
      }
      if (ctx.state !== 'running' && !hidden && !muted) {
        resuming = true;
        try {
          var pr = ctx.resume();
          if (pr && pr.then) pr.then(function () { resuming = false; }, function () { resuming = false; });
        } catch (e4) { resuming = false; }
      }
    }
    function onGesture() { unlock(); }
    function onVis() {
      hidden = document.visibilityState === 'hidden';
      if (!ctx || injected || dead) return;
      try { if (hidden) ctx.suspend(); else if (!muted) ctx.resume(); } catch (e) {}
    }
    function setMuted(m) {
      muted = !!m;
      if (!G || dead) return;
      var t = ctx.currentTime, g = G.out.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(muted ? 0 : 1, t + 0.05);
      if (injected) return;
      if (muted) setTimeout(function () { if (muted && ctx && !dead) try { ctx.suspend(); } catch (e) {} }, 80);
      else if (!hidden) try { ctx.resume(); } catch (e) {}
    }
    function destroy() {
      if (dead) return;
      dead = true;
      if (pumpTimer) clearInterval(pumpTimer);
      if (unsub) try { unsub(); } catch (e) {}
      if (unlockEl) GESTURES.forEach(function (n) { unlockEl.removeEventListener(n, onGesture, true); });
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      if (G) {
        var t = ctx.currentTime;
        G.out.gain.cancelScheduledValues(t); G.out.gain.setValueAtTime(0, t);
        try { G.out.disconnect(); } catch (e) {}
        G.sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
        G.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        if (G.musicSrc) try { G.musicSrc.stop(); G.musicSrc.disconnect(); } catch (e) {}
        if (st.cart) try { st.cart.src.stop(); st.cart.lfo.stop(); } catch (e) {}
      }
      if (ctx && !injected && ctx.close) try { ctx.close(); } catch (e) {}
      G = null;
    }

    /* ── wire up ───────────────────────────────────────────────────── */
    var unsub = null;
    if (handle && handle.onEvent) { var u = handle.onEvent(onEvent); if (typeof u === 'function') unsub = u; }
    if (unlockEl && unlockEl.addEventListener) GESTURES.forEach(function (n) { unlockEl.addEventListener(n, onGesture, true); });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
      hidden = document.visibilityState === 'hidden';
    }
    if (injected) { ctx = injected; build(); }

    var api = {
      destroy: destroy,
      setMuted: setMuted,
      isUnlocked: function () { return !!ctx && !dead && (injected ? true : ctx.state === 'running'); }
    };
    if (injected) {                         // test hooks (offline render only)
      api._pump = pump;
      api._graph = function () { return G; };
      api._stats = function () { var s = JSON.parse(JSON.stringify(st.stats)); s.fill = st.fill; s.trains = st.trains; s.tineFixed = st.tineFixed; s.bank = Object.keys(G.bank).length; return s; };
      api._event = onEvent;
      api._train = function (t) { return train(t, 99); };
    }
    return api;
  }

  var PachinkoAudio = {
    attach: attach,
    // pure kernels, for the lab (Node can render these without Web Audio)
    _synth: { renderTick: renderTick, renderClick: renderClick, renderChime: renderChime, renderCoin: renderCoin,
      renderPail: renderPail, renderKnock: renderKnock, renderMusicBox: renderMusicBox, renderIR: renderIR, TB: TB, timbreKey: timbreKey }
  };
  root.PachinkoAudio = PachinkoAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = PachinkoAudio;
})(typeof window !== 'undefined' ? window : globalThis);

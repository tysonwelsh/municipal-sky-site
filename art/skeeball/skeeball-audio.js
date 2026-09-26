/* skeeball-audio.js — HOLLER ROLLER's sound (PLAN-2 §6).
 *
 * Procedural Web Audio, no samples, no deps. Every sound is oscillators,
 * seeded noise buffers and biquads; the only convolution is a generated
 * room IR. Deterministic: variation is seeded from the event's own fields
 * (a small LCG), never Math.random.
 *
 *   window.SkeeBallAudio.attach(handle, unlockEl, opts?)
 *     → { destroy(), setMuted(bool), isUnlocked() }
 *
 *   handle.onEvent(fn)   game + physics events (PLAN-2 §8, §11)
 *   handle.getState()    { mode, score, … } (optional)
 *   handle.getPose()     physics pose (optional): drives the roll sound
 *   unlockEl             a gesture on it (capture) creates and resumes the
 *                        AudioContext; so does an `input` event — but only
 *                        inside a live user activation (see unlock())
 *   opts.context         an injected (Offline)AudioContext — the graph is
 *                        built at once and nothing is suspended/resumed;
 *                        the caller drives api._pump() for the roll sound
 *
 * Graph:  sfx ─┬───────────────┐
 *              └─ room IR send ┤
 *         roll ────────────────┤
 *         room (hum, insects) ─┼─ master ─ compressor ─ soft clip ─ out(mute) ─ dest
 *         music (waltz) ───────┘
 * Levels are baked into the voices so each bus reads directly in dBFS:
 * SFX peaks −20…−12, room tone ≈ −30, waltz ≈ −20 (ATTRACT only).
 */
(function () {
  'use strict';

  /* ── small deterministic helpers ─────────────────────────────────── */
  function lcg(seed) {
    var s = (seed >>> 0) || 0x9e3779b9;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function evSeed(ev, k) {
    var parts = [];
    for (var key in ev) if (Object.prototype.hasOwnProperty.call(ev, key)) {
      var v = ev[key];
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' || v === null) parts.push(key + '=' + v);
    }
    parts.sort();
    return hashStr(parts.join('&') + '#' + k);
  }
  function db(x) { return Math.pow(10, x / 20); }
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function semis(n) { return Math.pow(2, n / 12); }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  var MODE_FADE = 1.5;          // waltz in/out on mode change (s)
  var BELL_BASE = 587.33;       // D5 — the 10's bell
  var BELL_STEPS = { 10: 0, 20: 3, 30: 5, 40: 7, 50: 10, 100: 12 };
  var BELL_WORN = -8;           // the bell is always a little flat (cents)
  var SULK_FLAT = -30;          // …and 30 cents flatter when the machine sulks
  var DRUM_T = 0.15, TENS_LAG = 0.2;   // mirrors skeeball-render.js drum roll

  // the game says 'attract' | 'play' | 'payout'; PLAN-2 says ATTRACT …
  function normMode(m) { return m ? String(m).toUpperCase() : m; }

  function attach(handle, unlockEl, opts) {
    opts = opts || {};
    var injected = opts.context || null;
    var ctx = null, G = null;          // G: graph, built once ctx exists
    var dead = false, muted = false, hidden = false;
    var evCount = 0, drumEvents = false, pumpTimer = null;
    var initState = safeState();
    var st = {
      mode: normMode(initState.mode) || 'ATTRACT',
      score: 0, sulk: false, moon: false, moonThrown: false,
      rollFallback: 0          // no getPose: roll level from the throw
    };

    function safeState() {
      try { return (handle && handle.getState && handle.getState()) || {}; } catch (e) { return {}; }
    }
    function live() {
      if (dead || !ctx || !G) return false;
      if (injected) return true;
      return ctx.state === 'running' && !muted && !hidden;
    }

    /* ── graph ─────────────────────────────────────────────────────── */
    function build() {
      var sr = ctx.sampleRate;
      G = { nodes: [], sources: [] };
      var out = ctx.createGain(); out.gain.value = muted ? 0 : 1;
      var shaper = ctx.createWaveShaper();
      var n = 2048, curve = new Float32Array(n);
      for (var i = 0; i < n; i++) {           // linear to 0.6, tanh knee, ceiling 0.95
        var x = i / (n - 1) * 2 - 1, ax = Math.abs(x);
        var y = ax < 0.6 ? ax : 0.6 + 0.35 * Math.tanh((ax - 0.6) / 0.35);
        curve[i] = x < 0 ? -y : y;
      }
      shaper.curve = curve; shaper.oversample = '2x';
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10; comp.knee.value = 4; comp.ratio.value = 12;
      comp.attack.value = 0.003; comp.release.value = 0.2;
      // the spec'd compressor adds automatic makeup gain ((1/fullRangeGain)^0.6,
      // +4.8 dB at these settings): take it back so the buses read true
      var trim = ctx.createGain(); trim.gain.value = db(-4.8);
      var master = ctx.createGain(); master.gain.value = 1;
      master.connect(comp); comp.connect(trim); trim.connect(shaper); shaper.connect(out); out.connect(ctx.destination);

      var sfx = ctx.createGain(), roll = ctx.createGain(), room = ctx.createGain(), music = ctx.createGain();
      sfx.connect(master); roll.connect(master); room.connect(master); music.connect(master);
      music.gain.value = 0;

      // a small wooden room: 0.7 s generated IR on a send from the SFX bus
      // (unit energy per channel, normalize off: the send gain is the level)
      var ir = ctx.createBuffer(2, Math.floor(sr * 0.7), sr);
      for (var c = 0; c < 2; c++) {
        var d = ir.getChannelData(c), r = lcg(0x51ee + c), lp = 0, en = 0;
        for (var j = 0; j < d.length; j++) {
          var tt = j / sr;
          lp += 0.35 * ((r() * 2 - 1) - lp);            // darken
          d[j] = lp * Math.exp(-tt / 0.16) * (tt < 0.012 ? tt / 0.012 : 1);
          en += d[j] * d[j];
        }
        en = 1 / Math.sqrt(en || 1);
        for (var j2 = 0; j2 < d.length; j2++) d[j2] *= en;
      }
      var conv = ctx.createConvolver(); conv.normalize = false; conv.buffer = ir;
      var send = ctx.createGain(); send.gain.value = 0.2;
      sfx.connect(send); send.connect(conv); conv.connect(master);

      // shared white noise (2 s, seeded)
      var nb = ctx.createBuffer(1, sr * 2, sr), nd = nb.getChannelData(0), nr = lcg(0xb0a7);
      for (var k = 0; k < nd.length; k++) nd[k] = nr() * 2 - 1;

      G.out = out; G.master = master; G.comp = comp; G.shaper = shaper;
      G.sfx = sfx; G.roll = roll; G.room = room; G.music = music; G.send = send; G.conv = conv;
      G.noise = nb;
      G.nodes.push(out, shaper, trim, comp, master, sfx, roll, room, music, send, conv);
      buildRoom();
      buildRoll();
      setMusic(st.mode === 'ATTRACT', true);
      if (!injected) pumpTimer = setInterval(pump, 33);
    }

    function keep(node) { G.nodes.push(node); return node; }
    function keepSrc(node) { G.sources.push(node); G.nodes.push(node); return node; }

    /* ── voice primitives ──────────────────────────────────────────── */
    // envelope on a fresh gain: 0 → peak in a, exponential tail of length d
    // (≈ −80 dB at the end). Returns the gain node and the stop time.
    function envGain(t, peak, a, d, hold) {
      // .value = 0 first: a gain reads 1 until its first event, and a source
      // starting on a sub-sample time leaks its first sample through at 1
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
      osc.type = o.type || 'sine';
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

    /* ── the solenoid bell ─────────────────────────────────────────── */
    var BELL = [[1, 1, 1.9], [2.32, 0.42, 0.9], [4.25, 0.22, 0.45], [6.63, 0.1, 0.25], [0.5, 0.16, 1.4]];
    function bell(t, f, peak, cents, dest) {
      noise(t, { ft: 'highpass', f: 3200, q: 0.7, peak: peak * 0.6, a: 0.0005, d: 0.02, dest: dest });
      for (var i = 0; i < BELL.length; i++) {
        var p = BELL[i];
        tone(t, { f: f * p[0], peak: peak * p[1], a: 0.001, d: p[2], detune: cents, dest: dest });
        // the solenoid bounces: a second, weaker strike 19 ms later
        if (i < 3) tone(t + 0.019, { f: f * p[0], peak: peak * p[1] * 0.3, a: 0.001, d: p[2] * 0.6, detune: cents, dest: dest });
      }
    }
    function bellCents() { return BELL_WORN + (st.sulk ? SULK_FLAT : 0); }

    /* ── continuous: room tone ─────────────────────────────────────── */
    function buildRoom() {
      var t = ctx.currentTime, room = G.room;
      room.gain.value = 0; room.gain.setValueAtTime(0, t);
      room.gain.linearRampToValueAtTime(1, t + 1.0);
      var hum = keep(ctx.createGain()); hum.connect(room);
      var o60 = keepSrc(ctx.createOscillator()); o60.frequency.value = 60;
      var g60 = keep(ctx.createGain()); g60.gain.value = db(-31);
      o60.connect(g60); g60.connect(hum);
      var o120 = keepSrc(ctx.createOscillator()); o120.frequency.value = 120;
      var g120 = keep(ctx.createGain()); g120.gain.value = db(-33);
      o120.connect(g120); g120.connect(hum);
      // slow flutter on the 120 (the tube breathing) and a faster shimmer
      var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 0.23;
      var lfoD = keep(ctx.createGain()); lfoD.gain.value = db(-33) * 0.45;
      lfo.connect(lfoD); lfoD.connect(g120.gain);
      var lfo2 = keepSrc(ctx.createOscillator()); lfo2.frequency.value = 3.1;
      var lfo2D = keep(ctx.createGain()); lfo2D.gain.value = db(-33) * 0.15;
      lfo2.connect(lfo2D); lfo2D.connect(g120.gain);
      // the fluorescent's buzz: a 120 Hz saw, band-limited to the ballast's whine
      var saw = keepSrc(ctx.createOscillator()); saw.type = 'sawtooth'; saw.frequency.value = 120;
      var bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.2;
      var gb = keep(ctx.createGain()); gb.gain.value = db(-34);
      saw.connect(bp); bp.connect(gb); gb.connect(hum);
      var lfo3 = keepSrc(ctx.createOscillator()); lfo3.frequency.value = 0.071;
      var lfo3D = keep(ctx.createGain()); lfo3D.gain.value = db(-34) * 0.6;
      lfo3.connect(lfo3D); lfo3D.connect(gb.gain);

      // swamp insects: a seeded 13.7 s loop of sparse cricket chirps
      var sr = ctx.sampleRate, len = Math.floor(sr * 13.7);
      var ib = ctx.createBuffer(1, len, sr), id = ib.getChannelData(0), r = lcg(0x1a5ec7);
      var tc = 0.4;
      while (tc < 13.2) {
        var clicks = 3 + Math.floor(r() * 6), rate = 26 + r() * 30, fc = 3900 + r() * 1800, amp = 0.35 + r() * 0.65;
        for (var c = 0; c < clicks; c++) {
          var s0 = Math.floor((tc + c / rate) * sr), dur = Math.floor(sr * 0.006);
          for (var j = 0; j < dur && s0 + j < len; j++) {
            var w = Math.sin(Math.PI * j / dur);
            id[s0 + j] += amp * w * w * Math.sin(2 * Math.PI * fc * j / sr);
          }
        }
        tc += clicks / rate + 0.35 + r() * 1.9;
      }
      var ins = keepSrc(ctx.createBufferSource()); ins.buffer = ib; ins.loop = true;
      var ilp = keep(ctx.createBiquadFilter()); ilp.type = 'lowpass'; ilp.frequency.value = 5200; // distance
      var ig = keep(ctx.createGain()); ig.gain.value = db(-30);
      ins.connect(ilp); ilp.connect(ig); ig.connect(room);

      o60.start(t); o120.start(t); lfo.start(t); lfo2.start(t); saw.start(t); lfo3.start(t); ins.start(t);
      G.hum = { o60: o60, o120: o120, saw: saw, gb: gb, ins: ig };
    }

    // moon: the hum sags and the insects hush; a low bruise-coloured drone
    function moonRoom(on, t) {
      var H = G.hum, cents = on ? -70 : 0;
      [H.o60, H.o120, H.saw].forEach(function (o) {
        o.detune.cancelScheduledValues(t); o.detune.setValueAtTime(o.detune.value, t);
        o.detune.linearRampToValueAtTime(cents, t + 1.5);
      });
      H.ins.gain.cancelScheduledValues(t); H.ins.gain.setValueAtTime(H.ins.gain.value, t);
      H.ins.gain.linearRampToValueAtTime(on ? db(-30) * 0.15 : db(-30), t + 1.5);
      if (on) {
        var dr = { g: ctx.createGain(), o: [] };
        dr.g.gain.value = 0; dr.g.gain.setValueAtTime(0, t); dr.g.gain.linearRampToValueAtTime(db(-27), t + 1.5);
        [[110, 0], [164.81, -14], [55, 0]].forEach(function (p) {
          var o = ctx.createOscillator(); o.frequency.value = p[0]; o.detune.value = p[1];
          o.connect(dr.g); o.start(t); dr.o.push(o);
        });
        dr.g.connect(G.room); G.drone = dr;
      } else if (G.drone) {
        var d0 = G.drone; G.drone = null;
        d0.g.gain.cancelScheduledValues(t); d0.g.gain.setValueAtTime(d0.g.gain.value, t);
        d0.g.gain.linearRampToValueAtTime(0, t + 1.5);
        d0.o.forEach(function (o) { o.stop(t + 1.6); });
        d0.o[0].onended = function () { try { d0.g.disconnect(); } catch (e) {} };
      }
    }

    /* ── continuous: the attract waltz ─────────────────────────────── */
    // 12 bars of 3/4 in A minor, chiptune: a 25 % pulse melody, a triangle
    // bass on the one, 12.5 % pulse "pah-pah" chords — and the chords are
    // tuned +9 cents, so the machine is just out of tune with itself.
    var MEL = [
      [[76, 2], [81, 1]], [[84, 1], [83, 1], [81, 1]], [[77, 2], [74, 1]], [[80, 1], [76, 1], [80, 1]],
      [[81, 2], [76, 1]], [[77, 1], [81, 1], [84, 1]], [[83, 2], [80, 1]], [[81, 3]],
      [[79, 1], [84, 1], [88, 1]], [[86, 2], [83, 1]], [[80, 1], [83, 1], [86, 1]], [[81, 2], [0, 1]]
    ];
    var BASS = [45, 45, 50, 40, 45, 41, 40, 45, 48, 43, 40, 45];
    var CHORD = [[57, 60, 64], [57, 60, 64], [57, 62, 65], [56, 62, 64], [57, 60, 64], [57, 60, 65],
                 [56, 62, 64], [57, 60, 64], [55, 60, 64], [55, 59, 65], [56, 62, 64], [57, 60, 64]];
    var BEAT = 60 / 132;
    function waltzBuffer() {
      if (G.waltz) return G.waltz;
      var sr = ctx.sampleRate, len = Math.round(36 * BEAT * sr);
      var buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
      function blep(tph, dt) {           // polyBLEP residual
        if (tph < dt) { tph /= dt; return tph + tph - tph * tph - 1; }
        if (tph > 1 - dt) { tph = (tph - 1) / dt; return tph * tph + tph + tph + 1; }
        return 0;
      }
      function note(t0, dur, f, wave, duty, amp, vib, rel) {
        var s0 = Math.round(t0 * sr), n = Math.round((dur + rel) * sr), ph = 0;
        for (var i = 0; i < n; i++) {
          var tt = i / sr, idx = (s0 + i) % len;        // tails wrap round the loop
          var fv = f * (vib && tt > 0.15 ? Math.pow(2, 0.012 * Math.sin(2 * Math.PI * 5.3 * tt) / 1.2) : 1);
          var dt = fv / sr; ph += dt; if (ph >= 1) ph -= 1;
          var v;
          if (wave === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
          else {
            v = (ph < duty ? 1 : -1) + blep(ph, dt);
            var p2 = ph - duty; if (p2 < 0) p2 += 1;
            v -= blep(p2, dt);
          }
          var env = tt < 0.004 ? tt / 0.004 : (tt < dur ? 0.62 + 0.38 * Math.exp(-(tt - 0.004) / 0.09) : 0.62 * Math.exp(-(tt - dur) / (rel / 4)));
          out[idx] += v * env * amp;
        }
      }
      var beat = 0;
      for (var b = 0; b < 12; b++) {
        var t0 = b * 3 * BEAT, bb = beat;
        MEL[b].forEach(function (m) {
          if (m[0]) note(bb * BEAT, m[1] * BEAT * 0.86, mtof(m[0]), 'pulse', 0.25, 0.30, true, 0.06);
          bb += m[1];
        });
        note(t0, BEAT * 0.8, mtof(BASS[b]), 'tri', 0, 0.55, false, 0.05);
        for (var k = 1; k < 3; k++) CHORD[b].forEach(function (m) {
          note(t0 + k * BEAT, 0.11, mtof(m) * Math.pow(2, 9 / 1200), 'pulse', 0.125, 0.10, false, 0.04);
        });
        beat += 3;
      }
      var pk = 0;
      for (var i = 0; i < len; i++) { var a = Math.abs(out[i]); if (a > pk) pk = a; }
      var norm = db(-20) / (pk || 1);
      for (var q = 0; q < len; q++) out[q] *= norm;
      G.waltz = buf;
      return buf;
    }
    function setMusic(on, immediate) {
      if (!G) return;
      var t = ctx.currentTime, g = G.music.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(immediate ? 0 : g.value, t);
      if (on) {
        if (!G.waltzSrc) {
          var s = ctx.createBufferSource(); s.buffer = waltzBuffer(); s.loop = true;
          s.connect(G.music); s.start(t); G.waltzSrc = s;
        }
        g.linearRampToValueAtTime(1, t + MODE_FADE);
      } else {
        g.linearRampToValueAtTime(0, t + MODE_FADE);
        if (G.waltzSrc) {
          var old = G.waltzSrc; G.waltzSrc = null;
          old.stop(t + MODE_FADE + 0.05);
          old.onended = function () { try { old.disconnect(); } catch (e) {} };
        }
      }
    }

    /* ── continuous: the roll ──────────────────────────────────────── */
    function buildRoll() {
      var src = keepSrc(ctx.createBufferSource()); src.buffer = G.noise; src.loop = true;
      var lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = 0.5;
      var am = keep(ctx.createGain()); am.gain.value = 1;
      var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 4;
      var lfoD = keep(ctx.createGain()); lfoD.gain.value = 0.3;
      lfo.connect(lfoD); lfoD.connect(am.gain);
      var gRoll = keep(ctx.createGain()); gRoll.gain.value = 0;
      src.connect(lp); lp.connect(am); am.connect(gRoll); gRoll.connect(G.roll);
      // the hop: the same rumble through a hollow wooden body resonance
      var bp = keep(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 310; bp.Q.value = 6;
      var tri = keepSrc(ctx.createOscillator()); tri.type = 'triangle'; tri.frequency.value = 155;
      var gTri = keep(ctx.createGain()); gTri.gain.value = 0.12;
      var gHop = keep(ctx.createGain()); gHop.gain.value = 0;
      am.connect(bp); bp.connect(gHop); tri.connect(gTri); gTri.connect(gHop); gHop.connect(G.roll);
      var t = ctx.currentTime;
      src.start(t); lfo.start(t); tri.start(t);
      G.rollN = { lp: lp, lfo: lfo, gRoll: gRoll, gHop: gHop, bp: bp, tri: tri };
    }
    function hopness(p) {
      var P = window.SkeeBallPhysics, z0 = 3.5, z1 = 4.2;
      if (P && P.GEO && P.GEO.zHop != null && P.GEO.L != null) { z0 = P.GEO.zHop; z1 = P.GEO.L; }
      return clamp((p.z - z0) / Math.max(0.05, z1 - z0), 0, 1);
    }
    function pump() {
      if (dead || !G) return;
      var t = ctx.currentTime, p = null, base = 0, hop = 0, speed = 0, cut = 1;
      try { p = handle.getPose ? handle.getPose() : null; } catch (e) { p = null; }
      if (p && typeof p === 'object' && p.phase) {
        speed = Math.sqrt((p.vx || 0) * (p.vx || 0) + (p.vy || 0) * (p.vy || 0) + (p.vz || 0) * (p.vz || 0));
        var s = clamp(speed / 6, 0, 1);
        if (p.phase === 'roll' || p.phase === 'hop') {          // lane, then up the hop
          base = s; hop = p.z != null ? hopness(p) : (p.phase === 'hop' ? 1 : 0);
        } else if (p.phase === 'return') base = s;
        else if (p.phase === 'bed' && p.onBed) { base = s * 0.55; cut = 0.6; }
      } else if (!handle.getPose) {
        base = st.rollFallback; speed = base * 6;
      }
      var R = G.rollN, lvl = Math.pow(base, 0.7);
      R.gRoll.gain.setTargetAtTime(db(-21) * lvl * (1 - 0.7 * hop), t, 0.03);
      R.gHop.gain.setTargetAtTime(db(-6) * lvl * Math.sqrt(hop), t, 0.02);   // the narrow body resonance needs the lift
      R.lp.frequency.setTargetAtTime((260 + 1500 * base) * cut, t, 0.03);
      R.lfo.frequency.setTargetAtTime(clamp(speed / (2 * Math.PI * 0.11), 0.5, 20), t, 0.05);
      R.tri.frequency.setTargetAtTime(140 + 40 * base, t, 0.05);
    }

    /* ── the event sounds ──────────────────────────────────────────── */
    function speedDb(x, lo, hi) { return -18.5 + 5.5 * clamp((x - lo) / (hi - lo), 0, 1); }

    function drumTicks(t, from, to) {
      var a = digits(from), b = digits(to);
      for (var i = 0; i < 4; i++) {
        var steps = (b[i] - a[i] + 10) % 10, start = t + (i === 2 ? TENS_LAG : 0);
        for (var k = 0; k < steps; k++) {
          var tk = start + DRUM_T * (k + 0.5) / steps;
          noise(tk, { f: 3000 + 180 * i, q: 4, peak: db(-7), a: 0.0005, d: 0.014 });
          tone(tk, { type: 'square', f: 1750 - 90 * i, peak: db(-27), a: 0.0005, d: 0.012 });
        }
      }
    }
    function digits(v) {
      var s = String(Math.max(0, Math.min(9999, v | 0)));
      while (s.length < 4) s = '0' + s;
      return [+s[0], +s[1], +s[2], +s[3]];
    }
    function relay(t, pk) {
      noise(t, { ft: 'highpass', f: 2200, q: 0.7, peak: pk, a: 0.0005, d: 0.012 });
      tone(t, { f: 110, f1: 80, peak: pk * 0.8, a: 0.001, d: 0.09 });
    }
    function clack(t, pk, f) {
      f = f || 520;
      tone(t, { type: 'triangle', f: f, f1: f * 0.73, peak: pk, a: 0.0008, d: 0.07 });
      noise(t, { f: f * 3.6, q: 3, peak: pk * 1.6, a: 0.0005, d: 0.045 });
    }
    function thud(t, pk, f, lp) {
      tone(t, { f: f || 120, f1: (f || 120) * 0.66, peak: pk, a: 0.002, d: 0.18 });
      noise(t, { ft: 'lowpass', f: lp || 500, q: 0.7, peak: pk * 0.9, a: 0.001, d: 0.09 });
    }
    function tok(t, pk, f, metal) {
      tone(t, { f: f, f1: f * 0.85, peak: pk, a: 0.0008, d: 0.075 });
      noise(t, { f: 1100 + f, q: 2, peak: pk * 0.8, a: 0.0005, d: 0.03 });
      if (metal) {
        tone(t, { f: 2130, peak: pk * 0.35, a: 0.0005, d: 0.14 });
        tone(t, { f: 3410, peak: pk * 0.2, a: 0.0005, d: 0.09 });
      }
    }
    function rumble(t, dur, pk, f, wob) {
      var src = ctx.createBufferSource(); src.buffer = G.noise; src.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = f; lp.Q.value = 0.8;
      var g = ctx.createGain(), am = ctx.createGain(), lfo = ctx.createOscillator(), ld = ctx.createGain();
      lfo.frequency.value = wob; ld.gain.value = 0.4; am.gain.value = 0.6;
      lfo.connect(ld); ld.connect(am.gain);
      g.gain.value = 0; g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(pk, t + Math.min(0.2, dur * 0.25));
      g.gain.setValueAtTime(pk, t + dur * 0.7);
      g.gain.linearRampToValueAtTime(0, t + dur);
      src.connect(lp); lp.connect(am); am.connect(g); g.connect(G.sfx);
      src.start(t, (wob * 0.37) % 1.9); src.stop(t + dur + 0.02); lfo.start(t); lfo.stop(t + dur + 0.02);
      src.onended = function () { try { lp.disconnect(); am.disconnect(); g.disconnect(); ld.disconnect(); } catch (e) {} };
    }

    var SFX = {
      coin: function (t, r) {           // a nickel: pings, a slide, the mechanism
        var bounces = [[0, 1], [0.11, 0.5], [0.19, 0.3], [0.24, 0.18]];
        bounces.forEach(function (b) {
          var j = 1 + (r() - 0.5) * 0.02;
          tone(t + b[0], { f: 3120 * j, peak: db(-20) * b[1], a: 0.0005, d: 0.35 * b[1] + 0.05 });
          tone(t + b[0], { f: 4730 * j, peak: db(-23) * b[1], a: 0.0005, d: 0.25 * b[1] + 0.04 });
          tone(t + b[0], { f: 6590 * j, peak: db(-27) * b[1], a: 0.0005, d: 0.18 * b[1] + 0.03 });
          noise(t + b[0], { ft: 'highpass', f: 5000, peak: db(-24) * b[1], a: 0.0003, d: 0.01 });
        });
        // down the vertical slit: a longer slide, ticking off the walls
        noise(t + 0.26, { f: 2800, f1: 1700, q: 1.5, peak: db(-24), a: 0.02, hold: 0.12, d: 0.2 });
        for (var k = 0; k < 3; k++) tone(t + 0.3 + k * 0.07 + 0.02 * r(), { f: 2900 - 300 * k, peak: db(-28), a: 0.0005, d: 0.05 });
        thud(t + 0.58, db(-15), 95, 700);
        relay(t + 0.72, db(-20));
      },
      /* the ball-return rack filling after the button (1-D physics in main) */
      rackRelease: function (t, r, ev) {  // a ball through the gate at the trough's left end
        var n = ev.n || 1;
        relay(t, db(-19));
        tone(t + 0.01, { type: 'triangle', f: 210 + 6 * n + 10 * r(), f1: 150, peak: db(-18), a: 0.0008, d: 0.07 });
        modal(t + 0.05, WOOD, db(-17.5), 0.97 + 0.012 * (n % 5), r);   // the drop onto the trough floor
      },
      rackRoll: function (t, r, ev) { rackRumble(t, ev.energy || 0); },
      rackWall: function (t, r, ev) {      // the first ball meets the right end wall
        var k = clamp(((ev.speed || 100) - 30) / 230, 0, 1);
        modal(t, WOOD, db(-19 + 4 * k), 0.95 + 0.1 * k, r);
      },
      rackClack: function (t, r, ev) {     // ball on ball: a solid, polished-wood tok with weight
        var k = clamp(((ev.speed || 60) - 20) / 100, 0, 1);
        rackDuck(t);
        modal(t, BALL, db(-15.5 + 2.6 * k), 0.97 + 0.1 * k, r, ev.i);    // −16 … −12 dBFS, ±5 % pitch
      },
      rackSettled: function (t, r) {       // the last one rocks still
        tone(t, { type: 'triangle', f: 600 + 30 * r(), f1: 520, peak: db(-17), a: 0.0006, d: 0.035 });
        tone(t + 0.06, { type: 'triangle', f: 590, f1: 515, peak: db(-25), a: 0.0006, d: 0.03 });
      },
      button: function (t, r, ev) {
        if (ev.credited) {                 // chunky microswitch, the solenoid, the balls let go
          noise(t, { ft: 'highpass', f: 2600, q: 0.8, peak: db(-21), a: 0.0004, d: 0.012 });
          tone(t, { type: 'square', f: 1650 + 80 * r(), peak: db(-26), a: 0.0004, d: 0.012 });
          tone(t, { type: 'triangle', f: 340, f1: 260, peak: db(-21), a: 0.0006, d: 0.05 });
          noise(t + 0.075, { ft: 'highpass', f: 3000, q: 0.8, peak: db(-22), a: 0.0004, d: 0.01 });  // the key lets go
          relay(t + 0.05, db(-17));
          thud(t + 0.1, db(-21), 115, 800);           // soft: rackRelease voices each ball
        } else {                           // nothing behind it: a dead plastic click
          tone(t, { type: 'triangle', f: 900 + 60 * r(), f1: 700, peak: db(-19), a: 0.0005, d: 0.025 });
          noise(t, { f: 1200, q: 2, peak: db(-17), a: 0.0004, d: 0.015 });
        }
      },
      launch: function (t, r, ev) { clack(t, db(speedDb(ev.v || 4, 2, 7)), 500 + 40 * r()); },
      wall: function (t, r, ev) {
        var pk = db(speedDb(ev.speed || 1, 0.2, 4) + 1);
        tone(t, { type: 'triangle', f: 700 + 50 * r(), f1: 600, peak: pk, a: 0.0006, d: 0.045 });
        noise(t, { f: 1400, q: 2, peak: pk * 1.3, a: 0.0005, d: 0.03 });
      },
      rim: function (t, r, ev) {
        var sp = ev.speed || 1.5;
        var f = 360 + 55 * clamp(sp, 0, 5) + 18 * (ev.ring == null ? 3 : ev.ring) + 20 * r();
        tok(t, db(speedDb(sp, 1, 4)), f, ev.ring == null);
      },
      bed: function (t, r, ev) {
        var sp = ev.speed || 1, pk = db(speedDb(sp, 0.3, 4));
        if (ev.surface === 'rim' || ev.surface === 'hole') {   // came down on a rim / a lip
          tok(t, pk * 0.5, (ev.surface === 'rim' ? 380 : 420) + 40 * sp, ev.surface === 'hole');
          pk *= 0.5;
        }
        thud(t, pk, 120 + 20 * r(), 500);
      },
      backstop: function (t, r, ev) { thud(t, db(speedDb(ev.speed || 1, 0.2, 5)), 75 + 8 * r(), 350); },
      captured: function (t, r, ev) {
        var sc = ev.score || 0, cents = bellCents();
        if (ev.dent) tone(t, { f: 2600, peak: db(-26), a: 0.0005, d: 0.09 });
        if (sc === 100) {
          thud(t, db(-17), 140, 400);                         // the hollow drop into the hole
          for (var i = 0; i < 3; i++) bell(t + 0.08 + i * 0.16, BELL_BASE * semis(12), db(i === 2 ? -21 : -22), cents);
          neon(t + 0.05);
        } else {
          thud(t, db(-16), 170, 600);                         // the cup thunk
          if (sc > 0) bell(t + 0.08, BELL_BASE * semis(BELL_STEPS[sc] != null ? BELL_STEPS[sc] : 0), db(-19), cents);
        }
        if (sc > 0 && !drumEvents) drumTicks(t + 0.02, st.score, st.score + sc);
      },
      gutter: function (t, r) {           // a hollow drop and a rattle down the return
        tone(t, { f: 150, f1: 85, peak: db(-15), a: 0.002, d: 0.38 });
        noise(t, { f: 420, q: 2, peak: db(-17), a: 0.003, d: 0.2 });
        var tc = t + 0.26, gap = 0.05;
        for (var i = 0; i < 11; i++) {
          noise(tc, { f: 1500 + 400 * r(), q: 5, peak: db(-14 - i * 0.9), a: 0.0005, d: 0.022 });
          tc += gap * (0.8 + 0.5 * r()); gap *= 1.08;
        }
      },
      'return': function (t, r) {       // a long wooden rumble back to the rail
        tone(t, { type: 'triangle', f: 300, f1: 200, peak: db(-17), a: 0.001, d: 0.06 });
        rumble(t, 1.75, db(-20), 240 + 40 * r(), 8 + 2 * r());
        clack(t + 1.72, db(-18), 300);
      },
      stall: function (t) {
        tone(t, { type: 'triangle', f: 260, f1: 220, peak: db(-19), a: 0.001, d: 0.05 });
        tone(t + 0.2, { type: 'triangle', f: 250, f1: 215, peak: db(-24), a: 0.001, d: 0.05 });
      },
      bounceback: function (t, r) {
        clack(t, db(-17), 330);
        rumble(t + 0.02, 0.45, db(-24), 300, 7 + 3 * r());
      },
      stuck: function (t) {                // propped on a 100's lip: a dead cork thunk, no bell
        thud(t, db(-16), 105, 380);
        tone(t, { f: 330, f1: 260, peak: db(-22), a: 0.001, d: 0.06 });
      },
      rest: function (t) {
        tone(t, { f: 420, f1: 380, peak: db(-17), a: 0.0008, d: 0.045 });
        tone(t + 0.07, { f: 410, f1: 370, peak: db(-23), a: 0.0008, d: 0.04 });
      },
      timeout: function (t) {
        relay(t, db(-18)); relay(t + 0.09, db(-20));
        tone(t, { type: 'sawtooth', f: 50, peak: db(-24), a: 0.01, d: 0.35, hold: 0.15 });
      },
      done: function (t) { relay(t, db(-19)); },
      ballstart: function (t, r, ev) {    // gate latch, the ball rolls into the tray
        thud(t, db(-17), 140, 900);
        rumble(t + 0.03, 0.4, db(-25), 380, 10 + 2 * r());
        tone(t + 0.42, { type: 'triangle', f: 260 + 10 * ((ev.ballsLeft || 0) % 5), peak: db(-21), a: 0.001, d: 0.06 });
      },
      'throw': function (t, r, ev) {
        thud(t, db(speedDb(ev.v || 4, 2, 7)), 180, 800);
        st.rollFallback = clamp((ev.v || 4) / 6, 0, 1);
      },
      mode: function (t, r, ev) {
        if (ev.mode === 'PAYOUT') {       // the dispenser motor spins up
          relay(t, db(-18));
          tone(t, { type: 'sawtooth', f: 30, f1: 85, glide: 0.5, peak: db(-18), a: 0.15, hold: 0.35, d: 0.35 });
        } else if (ev.mode === 'PLAY') {  // relay + the tube starter ticks, the ballast flares
          relay(t, db(-16));
          noise(t + 0.09, { ft: 'highpass', f: 4000, peak: db(-20), a: 0.0005, d: 0.01 });
          noise(t + 0.16, { ft: 'highpass', f: 4000, peak: db(-22), a: 0.0005, d: 0.01 });
          tone(t + 0.16, { type: 'sawtooth', f: 120, peak: db(-26), a: 0.02, hold: 0.2, d: 0.3 });
        } else relay(t, db(-17));
      },
      gameover: function (t, r, ev) {
        var up = (ev.hundreds || 0) > 0, steps = up ? [0, 4, 7, 12] : [7, 3, 0];
        steps.forEach(function (s, i) {
          var last = i === steps.length - 1;
          bell(t + i * 0.22, BELL_BASE * semis(s), db(last ? -19 : -21), BELL_WORN + (!up && last ? -25 : 0));
        });
      },
      jackpot: function (t) {              // the jackpot relay, then (after the 100's
        relay(t, db(-18));                 // three strikes) the bell rings itself silly
        for (var i = 0; i < 14; i++) bell(t + 0.56 + i / 13, BELL_BASE * semis(19), db(-22 - i * 0.5), BELL_WORN);
      },
      nocoin: function (t, r) {            // empty pocket: the coin door rattles
        for (var i = 0; i < 4; i++) {
          noise(t + i * 0.045 + 0.01 * r(), { f: 1900 + 500 * r(), q: 3, peak: db(-9 - 2 * i), a: 0.0005, d: 0.03 });
          tone(t + i * 0.045, { type: 'triangle', f: 480 + 60 * r(), peak: db(-20 - 2 * i), a: 0.0005, d: 0.04 });
        }
      },
      ticket: function (t, r) {            // pawl over the gear, then paper
        for (var i = 0; i < 3; i++) {
          var tk = t + i * 0.014;
          noise(tk, { f: 3400 + 300 * r(), q: 6, peak: db(-2), a: 0.0003, d: 0.009 });
          tone(tk, { f: 1400 + 80 * i, peak: db(-26), a: 0.0003, d: 0.01 });
        }
        noise(t + 0.03, { ft: 'highpass', f: 5000, peak: db(-26), a: 0.005, d: 0.06 });
      },
      jam: function (t, r) {               // clunk, then the gears grind and sag
        thud(t, db(-15), 90, 600);
        var o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = 47; o.frequency.setValueAtTime(47, t); o.frequency.linearRampToValueAtTime(38, t + 0.8);
        var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 1.2;
        var am = ctx.createGain(); am.gain.value = 0.5;
        var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 23 + 4 * r();
        var ld = ctx.createGain(); ld.gain.value = 0.5;
        var e = envGain(t, db(-14), 0.03, 0.4, 0.45);
        lfo.connect(ld); ld.connect(am.gain);
        o.connect(bp); bp.connect(am); am.connect(e.g); e.g.connect(G.sfx);
        o.start(t); o.stop(e.end); lfo.start(t); lfo.stop(e.end);
        o.onended = function () { try { bp.disconnect(); am.disconnect(); e.g.disconnect(); ld.disconnect(); } catch (err) {} };
      },
      unjam: function (t, r, ev) {         // whacked loose (or it gives by itself): the crank resumes
        var hit = !!ev.whacked;
        thud(t, db(hit ? -15 : -18), hit ? 95 : 120, hit ? 700 : 450);
        for (var i = 0; i < (hit ? 6 : 3); i++) {
          var tk = t + 0.07 + i * 0.016;
          noise(tk, { f: 3400 + 300 * r(), q: 6, peak: db(-2 - 0.5 * i), a: 0.0003, d: 0.009 });
          tone(tk, { f: 1400 + 60 * i, peak: db(-26), a: 0.0003, d: 0.01 });
        }
      },
      possum: function (t, r) {            // the animatronic head tilts: a little servo whine
        var o = ctx.createOscillator(); o.type = 'square';
        o.frequency.value = 900; o.frequency.setValueAtTime(900, t);
        o.frequency.exponentialRampToValueAtTime(700, t + 0.12);
        var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2500; lp.Q.value = 0.7;
        var e = envGain(t, db(-19), 0.008, 0.05, 0.1);
        o.connect(lp); lp.connect(e.g); e.g.connect(G.sfx);
        o.start(t); o.stop(e.end);
        o.onended = function () { try { lp.disconnect(); e.g.disconnect(); } catch (err) {} };
        noise(t + 0.13, { f: 2600 + 300 * r(), q: 4, peak: db(-12), a: 0.0005, d: 0.012 });   // it clicks home
      },
      moon: function (t) { tone(t, { f: 60, f1: 45, peak: db(-16), a: 0.004, d: 0.6 }); },
      sulk: function (t) {                 // the bell slumps, the machine sighs
        var f = BELL_BASE * semis(7);
        for (var i = 0; i < 3; i++) {
          var p = BELL[i];
          tone(t, { f: f * p[0], f1: f * p[0] * 0.89, glide: 0.9, peak: db(-23) * p[1], a: 0.002, d: 1.1, detune: BELL_WORN + SULK_FLAT });
        }
        tone(t, { f: 90, f1: 58, peak: db(-19), a: 0.01, d: 0.5 });
      },
      drum: function (t, r, ev) { drumTicks(t, ev.from || 0, ev.to || 0); }
    };

    /* ── modal impacts: a 2–4 ms exciter + a few damped modes ────────
     * Heavy 3-inch phenolic/hardwood balls. Each mode is [Hz, amplitude,
     * −20 dB decay s]; the exciter is a lowpassed noise burst (the crack,
     * rolled off above ~5 kHz). `scale` moves every mode together (speed,
     * ≤ ±8 %); each ball (seeded) nudges its modes ±2 % so a train of
     * clacks is a family, not a loop. */
    var BALL = {                          // ball on ball: a tok with weight, no ring
      exc: { lp: 5000, amp: 1.0, t20: 0.004, off: 0.371 },
      modes: [[185, 0.45, 0.04], [760, 0.8, 0.055], [1080, 0.8, 0.048], [1560, 0.9, 0.036], [2350, 0.6, 0.022], [3300, 0.3, 0.01]],
      body: 1.15
    };
    var WOOD = {                          // ball on the trough: the wood is the soundboard
      exc: { lp: 3000, amp: 0.42, t20: 0.002, off: 1.113 },
      modes: [[180, 0.4, 0.12], [290, 0.8, 0.11], [420, 0.9, 0.1], [580, 0.6, 0.085], [820, 0.3, 0.06]],
      body: 1.2
    };
    // The modes' peak depends on how their phases happen to line up (±3 dB
    // across a ball's seeded tuning), so each hit's modal sum is evaluated
    // numerically over its first 25 ms and normalised: level follows speed only.
    function modalPeak(fs, M) {
      var sr = 22050, n = Math.round(sr * 0.025), pk = 0;
      for (var j = 0; j < n; j++) {
        var tt = j / sr, v = 0;
        for (var i = 0; i < fs.length; i++) v += M.modes[i][1] * Math.pow(10, -tt / M.modes[i][2]) * Math.sin(2 * Math.PI * fs[i] * tt);
        if (Math.abs(v) > pk) pk = Math.abs(v);
      }
      return pk || 1;
    }
    function modal(t, M, peak, scale, r, ballI) {
      var pr = ballI != null ? lcg(0xba11 + (ballI | 0) * 7919) : r, fs = [];
      for (var i = 0; i < M.modes.length; i++) fs.push(M.modes[i][0] * scale * (1 + (pr() - 0.5) * 0.04));   // a ball's own tuning (±2 %)
      var norm = peak * M.body / modalPeak(fs, M);
      // the exciter: a 2–4 ms lowpassed noise crack
      noise(t, { ft: 'lowpass', f: M.exc.lp, q: 0.7, peak: peak * M.exc.amp, a: 0.0002, d: M.exc.t20 * 4, off: M.exc.off });   // same material, same crack
      // exponential tails to −80 dB over 4 × t20 → −20 dB at t20
      for (var k = 0; k < fs.length; k++) tone(t, { f: fs[k], peak: norm * M.modes[k][1], a: 0.0004, d: M.modes[k][2] * 4 });
    }

    // the rack's rolling rumble: one long-lived voice, driven every ~100 ms by
    // rackRoll {energy}; with no fresh event it fades out by itself
    function rackRumble(t, energy) {
      if (!G.rack) {
        var src = keepSrc(ctx.createBufferSource()); src.buffer = G.noise; src.loop = true;
        var lp = keep(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.9;
        var bp = keep(ctx.createBiquadFilter()); bp.type = 'peaking'; bp.frequency.value = 115; bp.Q.value = 2.5; bp.gain.value = 8;   // under the balls' 185 Hz thump
        var am = keep(ctx.createGain()); am.gain.value = 0.7;
        var lfo = keepSrc(ctx.createOscillator()); lfo.frequency.value = 11;
        var ld = keep(ctx.createGain()); ld.gain.value = 0.3;
        var g = keep(ctx.createGain()); g.gain.value = 0;
        lfo.connect(ld); ld.connect(am.gain);
        var duck = keep(ctx.createGain()); duck.gain.value = 1;
        src.connect(lp); lp.connect(bp); bp.connect(am); am.connect(g); g.connect(duck); duck.connect(G.sfx);
        src.start(t, 0.77); lfo.start(t);
        G.rack = { g: g, lp: lp, lfo: lfo, duck: duck };
      }
      var e = clamp(energy / 500, 0, 1), R = G.rack;
      R.g.gain.cancelScheduledValues(t);
      R.g.gain.setTargetAtTime(db(-14) * Math.sqrt(e), t, 0.03);
      R.g.gain.setTargetAtTime(0, t + 0.16, 0.08);          // no news: it's stopping
      R.lp.frequency.setTargetAtTime(150 + 170 * e, t, 0.05);
      R.lfo.frequency.setTargetAtTime(6 + 12 * e, t, 0.05);
    }

    // a clack hands the momentum on: the rolling dips for a moment, and the
    // clack's low thump gets the room it needs (its own gain, so the level
    // automation above is untouched)
    function rackDuck(t) {
      if (!G.rack) return;
      var d = G.rack.duck.gain;
      d.cancelScheduledValues(t); d.setValueAtTime(d.value, t);
      d.setTargetAtTime(0.3, t, 0.003);
      d.setTargetAtTime(1, t + 0.035, 0.04);
    }

    function neon(t) {                     // the pink tube: mains buzz swelling up
      var g = ctx.createGain(); g.gain.value = 0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(db(-20), t + 0.9);
      g.gain.setValueAtTime(db(-20), t + 1.5);
      g.gain.exponentialRampToValueAtTime(db(-80), t + 2.8);
      var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.3;
      var fl = ctx.createGain(); fl.gain.value = 0.75;
      var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 7.3;
      var ld = ctx.createGain(); ld.gain.value = 0.25;
      lfo.connect(ld); ld.connect(fl.gain);
      var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 120;
      var o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 240; o2.detune.value = 6;
      o1.connect(bp); o2.connect(bp); bp.connect(fl); fl.connect(g); g.connect(G.sfx);
      [o1, o2, lfo].forEach(function (o) { o.start(t); o.stop(t + 2.9); });
      o1.onended = function () { try { bp.disconnect(); fl.disconnect(); g.disconnect(); ld.disconnect(); } catch (e) {} };
    }

    /* ── event routing ─────────────────────────────────────────────── */
    function onEvent(ev) {
      if (dead || !ev || !ev.type) return;
      var type = ev.type;
      if (type === 'input') { if (!injected) unlock(); return; }
      if (type === 'mode') ev = { type: 'mode', mode: normMode(ev.mode) };
      if (type === 'cage') return;
      if (type === 'drum') drumEvents = true;
      var k = evCount++;
      var can = live();
      var t = can ? ctx.currentTime : 0;

      // state first (tracked even before unlock)
      var prevScore = st.score;
      if (type === 'mode') {
        var was = st.mode; st.mode = ev.mode;
        if (ev.mode === 'PLAY') st.score = 0;
        if (ev.mode === 'ATTRACT' || ev.mode === 'PAYOUT') { st.sulk = false; }
        if (G && (was === 'ATTRACT') !== (ev.mode === 'ATTRACT')) setMusic(ev.mode === 'ATTRACT');
        if (ev.mode !== 'PLAY' && st.moon) endMoon(t);
      } else if (type === 'coin') st.score = 0;
      else if (type === 'ballstart') {
        var s0 = safeState().score;
        if (typeof s0 === 'number') st.score = s0;
      }

      if (can && SFX[type]) {
        try { SFX[type](t, lcg(evSeed(ev, k)), ev); } catch (e) { if (window.console) console.warn('skeeball-audio', type, e); }
      }

      if (type === 'captured') {
        st.score = prevScore + (ev.score || 0);
        if (st.sulk) st.sulk = false;      // the flat bell has rung
      } else if (type === 'sulk') st.sulk = true;
      else if (type === 'moon') {
        if (!st.moon && G) moonRoom(true, can ? t : ctx.currentTime);
        st.moon = true; st.moonThrown = false;
      } else if (type === 'throw') { if (st.moon) st.moonThrown = true; }
      else if (type === 'done' || type === 'gameover') { if (st.moon && (st.moonThrown || type === 'gameover')) endMoon(t); }
      if (type === 'launch' || type === 'stall' || type === 'gutter' || type === 'stuck' || type === 'captured' || type === 'return' || type === 'done' || type === 'timeout') st.rollFallback = 0;
      if (type === 'gameover') st.sulk = false;
    }
    function endMoon(t) {
      st.moon = false; st.moonThrown = false;
      if (G) moonRoom(false, ctx.currentTime);
    }

    /* ── unlock, visibility, mute ──────────────────────────────────── */
    // Only inside a live user activation. A touch pointerdown is NOT one
    // (the HTML spec counts pointerup/touchend, mousedown/mouse pointerdown,
    // keydown, click): creating the context there gets it refused, with a
    // console warning per node started. So the game's `input {kind:'down'}`
    // creates it on a mouse or key, and a touch waits for its own touchend.
    // Browsers without navigator.userActivation are trusted to be in one.
    var GESTURES = ['pointerdown', 'pointerup', 'touchend', 'mousedown', 'click', 'keydown'];
    function activated() {
      var ua = typeof navigator !== 'undefined' && navigator.userActivation;
      return !ua || !!ua.isActive;
    }
    function unlock() {
      if (dead || injected || !activated()) return;
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { return; } }
        build();
        // iOS: a one-sample silent buffer inside the gesture wakes the output
        try { var b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate); b.connect(ctx.destination); b.start(0); } catch (e3) {}
      }
      if (ctx.state !== 'running' && !hidden && !muted) { try { var pr = ctx.resume(); if (pr && pr.catch) pr.catch(function () {}); } catch (e4) {} }
    }
    function onGesture() { unlock(); }
    function onVis() {
      hidden = document.visibilityState === 'hidden';
      if (!ctx || injected || dead) return;
      try {
        if (hidden) ctx.suspend();
        else if (!muted) ctx.resume();
      } catch (e) {}
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
      else if (handle && handle.offEvent) try { handle.offEvent(onEvent); } catch (e) {}
      if (unlockEl) GESTURES.forEach(function (n) { unlockEl.removeEventListener(n, onGesture, true); });
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVis);
      if (G) {
        var t = ctx.currentTime;
        G.out.gain.cancelScheduledValues(t); G.out.gain.setValueAtTime(0, t);
        try { G.out.disconnect(); } catch (e) {}
        G.sources.forEach(function (s) { try { s.stop(); } catch (e) {} });
        G.nodes.forEach(function (n) { try { n.disconnect(); } catch (e) {} });
        if (G.waltzSrc) try { G.waltzSrc.stop(); G.waltzSrc.disconnect(); } catch (e) {}
        if (G.drone) G.drone.o.forEach(function (o) { try { o.stop(); } catch (e) {} });
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
    }
    return api;
  }

  window.SkeeBallAudio = { attach: attach };
})();

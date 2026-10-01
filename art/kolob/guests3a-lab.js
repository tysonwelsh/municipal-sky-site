// ============================================================================
// GUESTS LAB 3a — audition bench for the guests from outside the windows (dev,
// unlinked): the Nauvoo Brass Band going by (KOLOB.GuestBands), the handcart
// company (KOLOB.GuestHandcart) and the gulls (KOLOB.GuestGulls), each with
// hymns KOLOB.Composer writes here — seed, dialect and keynote on the
// controls. The band: its march laid out strain by strain, its road, a
// second band, the band standing still in the street, and the meeting's own
// hymn under it on a plain organ (the collision). The company: the carts
// and the singers together or apart. The gulls: the flock, the lead bird
// alone, and the trace — the lead bird's cries pitch-tracked against the
// hymn's head.
//
// Everything plays through the app's own master chain (glue → master 0.6 →
// tanh → compressor, as kolob-core.js builds it) plus a brick-wall guard at
// −1 dBFS, in the app's rooms (the guests lab's chain, line for line): the
// lab never plays louder than the app. AS SEATED is how the engine seats a
// guest from outside the windows: the tabernacle's wide send. CHECK renders
// offline (the same graph) and measures loudness against the v0.30 organ
// reference heard in the same room, peak, clipping, clicks, nodes; the band
// its crossing, the gulls their trace.
//
// Dev console: Guests3a.play(id, o), .check(id, o), .odds(N), .purity(),
// .hymns(), .score(id), .stop(). Public surface: window.Guests3a
// ============================================================================
window.Guests3a = (function () {
  "use strict";

  var SR = 48000;
  var K = window.KOLOB, GB = K.GuestBands, GH = K.GuestHandcart, GG = K.GuestGulls;
  function mod(a, n) { return ((a % n) + n) % n; }

  // ==========================================================================
  // THE CHAIN — the guests lab's (kolob-core.js init()'s): rooms → voicesBus
  // → glue → master 0.6 → tanh(1.15) → compressor(−18/3:1) — then a
  // brick-wall guard at −1 dBFS. THE ROOMS: the tabernacle (St Margaret's,
  // wet 0.40) — as the engine seats a guest outside the windows (its wide
  // send) — the meetinghouse (short, wet 0.28), dry.
  // ==========================================================================
  function fetchIR(ctx) {
    var url = "../prosperos-jukebox-v2/ir/rooms/library-wide-st-margarets.wav";
    return fetch(url).then(function (r) { if (!r.ok) throw new Error("ir " + r.status); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, rej); }); })
      .catch(function () { return null; });
  }
  var TAPS = [[0.008, 0.9], [0.013, 0.7], [0.019, 0.62], [0.026, 0.5], [0.033, 0.42], [0.041, 0.34], [0.052, 0.27], [0.064, 0.2]];
  function pour(ctx, decayS, bright) {
    var len = Math.floor(ctx.sampleRate * decayS), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    var s = 12345;
    function r() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff * 2 - 1; }
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch), lp = 0, a = Math.min(0.95, 0.35 * bright);
      for (var i = 0; i < len; i++) {
        var tt = i / ctx.sampleRate;
        var env = Math.pow(1 - i / len, 2.2) * Math.min(1, tt / 0.06);
        lp += a * (r() - lp);
        d[i] = lp * env * 0.5;
      }
      TAPS.forEach(function (tp, k) { var ix = Math.floor((tp[0] + (ch ? 0.0013 * (k % 3) : 0)) * ctx.sampleRate); if (ix < len) d[ix] += tp[1] * 0.5 * (k % 2 ? -1 : 1); });
    }
    return buf;
  }
  function buildChain(ctx, room, irBuf, dest, balance) {
    var t = 0;
    var session = ctx.createGain(), voicesBus = ctx.createGain();
    // one room: a send → its dry (1) and its wet (pre-delay → convolver)
    function roomUnit(src, which) {
      var dry = ctx.createGain(); dry.gain.value = 1;
      src.connect(dry); dry.connect(voicesBus);
      if (which === "dry") return;
      var spec = which === "close" ? { pre: 0.012, wet: 0.28 } : { pre: 0.063, wet: 0.40 };
      var pre = ctx.createDelay(0.25); pre.delayTime.value = spec.pre;
      var conv = ctx.createConvolver();
      conv.buffer = which === "close" ? pour(ctx, 1.4, 1.2) : (irBuf || pour(ctx, 5.5, 0.8));
      var wet = ctx.createGain(); wet.gain.value = spec.wet;
      src.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(voicesBus);
    }
    if (room === "seated") {
      var th = Math.max(0, Math.min(1, balance != null ? balance : 0.5)) * Math.PI / 2;
      var gc = ctx.createGain(), gw = ctx.createGain();
      gc.gain.value = Math.cos(th); gw.gain.value = Math.sin(th);
      session.connect(gc); session.connect(gw);
      roomUnit(gc, "close"); roomUnit(gw, "wide");
    } else roomUnit(session, room);
    var glue = ctx.createDynamicsCompressor();
    glue.threshold.setValueAtTime(-20, t); glue.knee.setValueAtTime(22, t); glue.ratio.setValueAtTime(1.7, t);
    glue.attack.setValueAtTime(0.025, t); glue.release.setValueAtTime(0.22, t);
    var master = ctx.createGain(); master.gain.value = 0.6;
    var sat = ctx.createWaveShaper(), c = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; c[i] = Math.tanh(x * 1.15) / Math.tanh(1.15); }
    sat.curve = c; sat.oversample = "2x";
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-18, t); comp.knee.setValueAtTime(16, t); comp.ratio.setValueAtTime(3, t);
    comp.attack.setValueAtTime(0.015, t); comp.release.setValueAtTime(0.25, t);
    var guard = ctx.createDynamicsCompressor();
    guard.threshold.setValueAtTime(-1, t); guard.knee.setValueAtTime(0, t); guard.ratio.setValueAtTime(20, t);
    guard.attack.setValueAtTime(0.002, t); guard.release.setValueAtTime(0.1, t);
    var fade = ctx.createGain(); fade.gain.value = 1;
    voicesBus.connect(glue); glue.connect(master); master.connect(sat); sat.connect(comp); comp.connect(guard);
    guard.connect(fade); fade.connect(dest);
    return { input: session, out: fade, room: room, balance: balance };
  }

  // ==========================================================================
  // THE HYMNS — the day's first and second, composed here from the controls
  // ==========================================================================
  var hymns = null, hymnsKey = null;
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = document.getElementById(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function checked(id) { var e = document.getElementById(id); return !!(e && e.checked); }
  function settings(o) {
    o = o || {};
    return {
      seed: o.seed != null ? o.seed : Math.round(num("kg3-seed", 2)),
      dialect: o.dialect || val("kg3-dialect", "tabernacle"),
      keynote: Math.max(200, Math.min(320, o.keynote != null ? o.keynote : num("kg3-key", 260))),
    };
  }
  function composed(st) {
    var key = st.seed + ":" + st.dialect;
    if (hymns && hymnsKey === key) return hymns;
    var R = window.PJ2.Rand.stream(st.seed);
    hymns = [K.Composer.compose(R.fork("hymn:1:1"), { dialect: st.dialect }), K.Composer.compose(R.fork("hymn:1:2"), { dialect: st.dialect })];
    hymnsKey = key;
    return hymns;
  }
  function streamOf(G, seed) { return window.PJ2.Rand.stream(seed >>> 0).fork(G.LABEL + 1); }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o) → { dur, stats?, score?, expect }
  //   expect: the windows (s, from t) in which a transient is asked for
  // ==========================================================================
  var P = {};
  function bandMaterial(st, o) {
    var hs = composed(st), which = o.which != null ? o.which : +val("kg3-which", "0");
    return { hymn: hs[which], homeHz: st.keynote, second: (o.second != null ? o.second : checked("kg3-second")) ? { hymn: hs[1 - which] } : null };
  }
  P.band = function (ctx, into, t, o) {
    var st = settings(o), still = o.still != null ? o.still : checked("kg3-still");
    var hooks = { defer: o.defer || null, onNote: o.onNote || null, onStage: o.onStage || null, still: still };
    var end = GB.perform(ctx, into, t, bandMaterial(st, o), streamOf(GB, st.seed), hooks);
    var last = GB.perform.last, ex = [], created = 0, peak = 0;
    last.score.bands.forEach(function (bd) { bd.drums.forEach(function (d) { ex.push(d.kind === "rollTo" ? [d.t - t - 0.22, d.t - t + 0.05] : [d.t - t - 0.005, d.t - t + (d.kind === "flam" ? 0.08 : 0.05)]); }); });
    last.made.forEach(function (m) { if (!m.band) return; var s = m.band.stats(); created += s.created; peak += s.peakLive + m.road.nodes; });
    if ((o.meeting != null ? o.meeting : checked("kg3-meeting")) && !o.noMeeting) hymnOrgan(ctx, into, t, composed(st)[0], st.keynote);
    // (the march ends at its stinger — what the meeting waits for; the drums
    // carry the band out of hearing after it, and the lab hears them out)
    return { dur: Math.max(end, last.score.gone || end) - t + 5, end: end - t, score: last.score, expect: ex, stats: { created: created, peakLive: peak, bands: last.made.length } };
  };
  // THE MEETING CARRIES ON: the day's first hymn on a plain organ (three
  // partials a pipe, the four parts as written, the hymn's own tempo and the
  // meeting's key), two verses, so the band can be heard crossing it
  function hymnOrgan(ctx, into, t, h, keynote) {
    var bus = ctx.createGain(); bus.gain.value = 0.16; bus.connect(into);
    var tt = t + 2, bs = h.beatS, total = 0;
    for (var v = 0; v < 2; v++) {
      var t0 = tt, lastEnd = 0;
      h.lines.forEach(function (L) {
        Object.keys(L.notes).forEach(function (p) {
          L.notes[p].forEach(function (n) {
            if (!n.monzo) return;
            var f = keynote * K.Pitch.ratio(h.keyMonzo || [0, 0, 0, 0]) * K.Pitch.ratio(n.monzo) * (p === "B" ? 0.5 : 1), on = t0 + (L.startBeat + n.beat) * bs, d = n.beats * bs * (n.fermata ? 1.6 : 1) * 0.96;
            var g = ctx.createGain(); g.gain.setValueAtTime(0, on); g.gain.linearRampToValueAtTime(0.25, on + 0.04); g.gain.setValueAtTime(0.25, on + d - 0.05); g.gain.linearRampToValueAtTime(0, on + d);
            g.connect(bus);
            [[1, 1], [2, 0.35], [3, 0.12]].forEach(function (pr) { var os = ctx.createOscillator(); os.frequency.value = f * pr[0]; var og = ctx.createGain(); og.gain.value = pr[1]; os.connect(og); og.connect(g); os.start(on); os.stop(on + d + 0.02); });
            lastEnd = Math.max(lastEnd, on + d);
          });
        });
      });
      tt = lastEnd + 1.2; total = lastEnd - t;
    }
    return total;
  }
  P.handcart = function (ctx, into, t, o) {
    var st = settings(o), only = o.only !== undefined ? o.only : (val("kg3-hc-only", "") || null);
    if (K.VoicesVocal.budget) K.VoicesVocal.budget.reset();
    var end = GH.perform(ctx, into, t, { homeHz: st.keynote }, streamOf(GH, st.seed), { defer: o.defer || null, onNote: o.onNote || null, onStage: o.onStage || null, only: only });
    var last = GH.perform.last, fs = last.folk ? last.folk.stats() : { created: 0, peakLive: 0 };
    var bud = K.VoicesVocal.budget ? K.VoicesVocal.budget.report(t, end) : null;
    return { dur: end - t + 5, score: last.score, expect: [], stats: { created: fs.created, peakLive: fs.peakLive + last.road.nodes + (bud ? bud.peak : 0), singers: bud ? bud.peak : 0 } };
  };
  P.gulls = function (ctx, into, t, o) {
    var st = settings(o), lead = o.only === "lead";
    var end = GG.perform(ctx, into, t, { hymn: composed(st)[0], keynoteHz: st.keynote }, streamOf(GG, st.seed), { defer: o.defer || null, onNote: o.onNote || null, onStage: o.onStage || null, only: lead ? "lead" : null });
    var last = GG.perform.last, ex = [];
    last.score.cries.forEach(function (c) { if (!lead || c.role === "lead") ex.push([c.t - t - 0.005, c.t - t + (c.up || 0.03) + 0.06]); });
    var s = last.folk.stats();
    return { dur: end - t + 3, score: last.score, expect: ex, stats: { created: s.created, peakLive: s.peakLive } };
  };
  P.lead = function (ctx, into, t, o) { return P.gulls(ctx, into, t, Object.assign({}, o, { only: "lead" })); };

  // ---- the level reference: the v0.30 organChord, line for line (the
  // instruments and trombone labs' P.reference) ------------------------------
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, oct = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, oct); }
  var REF_GAINMUL = 0.75 * (0.6 + 0.4 * 0.21), REF_DUR = 6, REF_STEP = 6.4;
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  P.reference = function (ctx, into, t) {
    var chords = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(260, d); });
      var tt = t + i * REF_STEP, dur = REF_DUR, stops = 0.5, trem = 0.15, pedal = 0.6;
      var master = ctx.createGain(); master.connect(into);
      var RANKS = [1, 2, 3, 4], PP = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
      for (var v = 0; v < freqs.length; v++) {
        var f0 = freqs[v] * 0.5;
        for (var r = 0; r < RANKS.length; r++) {
          var g = PP[r] * (1 - stops) + FL[r] * stops;
          if (g < 0.05) continue;
          var pair = r === 0 ? 2 : 1;
          for (var d = 0; d < pair; d++) {
            var osc = ctx.createOscillator(); osc.type = "sine";
            osc.frequency.setValueAtTime(f0 * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), tt);
            var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(freqs.length) / pair, tt);
            osc.connect(og); og.connect(master); osc.start(tt); osc.stop(tt + dur + 0.3);
          }
        }
      }
      var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, tt);
      var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, tt);
      sub.connect(sg); sg.connect(master); sub.start(tt); sub.stop(tt + dur + 0.3);
      var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, tt);
      var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, tt);
      lfo.connect(lg); lg.connect(master.gain); lfo.start(tt); lfo.stop(tt + dur + 0.3);
      var peak = REF_GAINMUL * 0.7, atk = Math.min(2.2, dur * 0.3);
      env(master, tt, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    });
    return { dur: (chords.length - 1) * REF_STEP + REF_DUR + 0.5, expect: [] };
  };


  // ==========================================================================
  // LIVE PLAYBACK — one context; phrases play into `labIn`, which feeds the
  // current room chain; the meter sits after it. A room change crossfades.
  // ==========================================================================
  var actx = null, chain = null, irBuf = null, room = "wide", current = null, analyser = null, labIn = null, lights = [], lightTimer = null;
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    labIn = actx.createGain();
    // (the town's air built now, as the engine builds it at start-up: tens of ms, never in a cue)
    if (K.VoicesBand && K.VoicesBand.warm) K.VoicesBand.warm(actx);
    // (…and the company's throat sung once, silently, as the recipe has the
    // engine do at start-up — so a company's first line is not a cold one)
    if (GH.warm) GH.warm(actx);
    return fetchIR(actx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild(balance) {
    var old = chain, t = actx.currentTime, XF = 0.25;
    chain = buildChain(actx, room, irBuf, analyser, balance != null ? balance : old ? old.balance : 0.5);
    labIn.connect(chain.input);
    if (!old) return;
    chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + XF);
    old.out.gain.setValueAtTime(1, t); old.out.gain.linearRampToValueAtTime(0, t + XF);
    setTimeout(function () { try { labIn.disconnect(old.input); } catch (e) { /* gone already */ } try { old.out.disconnect(); } catch (e2) { /* gone already */ } }, (XF + 0.15) * 1000);
  }
  function stop() {
    lights = [];
    if (!current) return;
    var c = current;
    if (clock) clock.lane(c.lane).cancelAll();
    c.gain.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) { /* gone already */ } }, 400);
    current = null;
  }
  // the engine's clock, made once for the lab's context; its wake-up timed
  // whole (every callback due in it), for the wakes that did any work
  var clock = null, plays = 0, woke = null;
  function clockOf() {
    if (clock) return clock;
    clock = window.PJ2.Clock.create(actx, {
      tickMs: 25, aheadS: 0.25,
      setInterval: function (fn, ms) {
        return setInterval(function () {
          woke = null;
          var a = performance.now(); fn(); var d = performance.now() - a;
          if (woke) woke.cost.wakes.push(d);
        }, ms);
      },
      clearInterval: function (x) { clearInterval(x); },
    });
    clock.start();
    return clock;
  }
  function play(id, o) {
    o = o || {};
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      var g = actx.createGain(); g.connect(labIn);
      lights = [];
      // THE LAB'S CLOCK: the guests lay themselves out a slice at a time
      // (hooks.defer) on the engine's own clock (clockOf: PJ2.Clock, a wake
      // every 25 ms firing every cue inside its quarter-second look-ahead at
      // once); what each callback costs the main thread is kept, and what
      // each WAKE costs — the number the engine feels (cost())
      var me = { gain: g, id: id, lane: "guest" + (++plays), cost: { press: 0, slices: [], wakes: [] } };
      var oo = Object.assign({}, o, {
        onNote: function (n) { lights.push(n); },
        defer: function (at, fn) {
          clockOf().lane(me.lane).at(at, function () {
            if (current !== me) return;
            woke = me;
            var c0 = performance.now(); fn(); me.cost.slices.push(performance.now() - c0);
          });
        },
      });
      current = me;
      var c1 = performance.now();
      var res = P[id](actx, g, actx.currentTime + 0.15, oo);
      me.cost.press = performance.now() - c1;
      me.score = res.score || null;
      me.until = actx.currentTime + res.dur;
      res.cost = me.cost;
      return res;
    });
  }
  function setRoom(r) { room = r; if (actx) rebuild(); }
  // the main thread each live performance cost: at the press, and each slice
  function cost() {
    if (!current) return null;
    var c = current.cost, mx = 0, mw = 0;
    c.slices.forEach(function (x) { mx = Math.max(mx, x); });
    c.wakes.forEach(function (x) { mw = Math.max(mw, x); });
    return { id: current.id, press: +c.press.toFixed(1), slices: c.slices.length, largest: +mx.toFixed(1), wakes: c.wakes.length, largestWake: +mw.toFixed(1) };
  }
  function meter() {
    if (!analyser) return null;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var pk = 0; for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > pk) pk = x; }
    return { peak: 20 * Math.log10(pk + 1e-9) };
  }

  // ==========================================================================
  // CHECK — offline render, and the trombone lab's measures
  // ==========================================================================
  var offlineIR = null;
  function render(id, o) {
    o = o || {};
    var probe = new OfflineAudioContext(2, SR, SR);
    var irP = offlineIR ? Promise.resolve(offlineIR) : fetchIR(probe).then(function (b) { offlineIR = b; return b; });
    return irP.then(function (ir) {
      var dummy = new OfflineAudioContext(2, SR, SR);
      var est = P[id](dummy, dummy.destination, 0.1, o);
      var rm = o.room || room;
      var len = Math.ceil((est.dur + 1.2 + (rm === "dry" ? 0 : 3)) * SR);
      var off = new OfflineAudioContext(2, len, SR);
      var ch = buildChain(off, rm, ir, off.destination, null);
      var res = P[id](off, ch.input, 0.1, o);
      return off.startRendering().then(function (buf) { return { buf: buf, res: res }; });
    });
  }
  function db(x) { return 20 * Math.log10(x + 1e-12); }
  function biquad(x, b, a) {
    var y = new Float32Array(x.length), x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (var i = 0; i < x.length; i++) {
      var v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  }
  function kWeight(x) {
    var s1 = biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]);
    return biquad(s1, [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]);
  }
  function highpass(x, fc) {
    var w = Math.tan(Math.PI * fc / SR), q = Math.SQRT1_2, nn = 1 / (1 + w / q + w * w);
    var bb = [nn, -2 * nn, nn], aa = [1, 2 * (w * w - 1) * nn, (1 - w / q + w * w) * nn];
    return biquad(biquad(x, bb, aa), bb, aa);
  }
  // BS.1770-4 over [a, b): integrated (gated) and the loudest 3-second window
  function loudnessOf(k, a, b) {
    a = a || 0; b = b || k[0].length;
    var n = b - a, sq = new Float64Array(n + 1);
    for (var i = 0; i < n; i++) { var e = 0; for (var c = 0; c < k.length; c++) e += k[c][a + i] * k[c][a + i]; sq[i + 1] = sq[i] + e; }
    function L(s, len) { return -0.691 + 10 * Math.log10((sq[s + len] - sq[s]) / len + 1e-20); }
    var B = Math.round(0.4 * SR), H = Math.round(0.1 * SR), S3 = Math.round(3 * SR), blocks = [];
    for (var s = 0; s + B <= n; s += H) blocks.push(L(s, B));
    var abs = blocks.filter(function (l) { return l > -70; });
    function meanL(ls) { var m = 0; ls.forEach(function (l) { m += Math.pow(10, (l + 0.691) / 10); }); return -0.691 + 10 * Math.log10(m / Math.max(1, ls.length) + 1e-20); }
    var gate = meanL(abs) - 10;
    var I = meanL(abs.filter(function (l) { return l > gate; }));
    var sMax = -Infinity;
    for (var s3 = 0; s3 + S3 <= n; s3 += H) { var l3 = L(s3, S3); if (l3 > sMax) sMax = l3; }
    if (!isFinite(sMax)) sMax = L(0, n);
    return { I: abs.length ? I : -Infinity, S: sMax };
  }
  function analyse(buf, res, id) {
    var L = buf.getChannelData(0), R = buf.getChannelData(1), n = L.length, pk = 0, clip = 0;
    var mono = new Float32Array(n);
    for (var i = 0; i < n; i++) { mono[i] = (L[i] + R[i]) * 0.5; var a = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (a > pk) pk = a; if (a > 0.989) clip++; }
    var kw = [kWeight(L), kWeight(R)], lu = loudnessOf(kw);
    // CLICKS: 1 ms blocks above 4 kHz standing 12× (21.6 dB) over the loudest
    // block of the 30 ms on each side (the instruments lab's measure) — and
    // then sorted: a burst inside a window the phrase asked for (a clapper,
    // a knock, a consonant, a rap) is a stroke; any other is a click
    var hp = highpass(mono, 4000), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) { var e2 = 0; for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q]; hf.push(Math.sqrt(e2 / H)); }
    function maxOf(arr) { var mx = 0; for (var z0 = 0; z0 < arr.length; z0++) if (arr[z0] > mx) mx = arr[z0]; return mx; }
    var ex = (res.expect || []).map(function (w) { return [w[0] + 0.1 - 0.012, w[1] + 0.1 + 0.012]; });
    var strokes = 0, clicks = [];
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = Math.max(maxOf(hf.slice(z - 30, z - 2)), maxOf(hf.slice(z + 3, z + 30)));
      if (hf[z] > ref * 12) {
        var tz = z * H / SR, asked = ex.some(function (w) { return tz >= w[0] && tz <= w[1]; });
        if (asked) strokes++; else clicks.push(+(tz - 0.1).toFixed(3));
      }
    }
    var out = { id: id, seconds: +(n / SR).toFixed(1), lufs: +lu.I.toFixed(1), lufsShortMax: +lu.S.toFixed(1), peakDb: +db(pk).toFixed(2), clipped: clip, strokes: strokes, clicks: clicks.length, clickTimes: clicks.slice(0, 12) };
    if (res.stats) out.nodes = res.stats;
    if (res.score) extras(out, res, L, R, id);
    return out;
  }
  function fft(re, im) {
    var n = re.length, i, j = 0, k, len, tr, ti;
    for (i = 1; i < n; i++) {
      var bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { tr = re[i]; re[i] = re[j]; re[j] = tr; tr = im[i]; im[i] = im[j]; im[j] = tr; }
    }
    for (len = 2; len <= n; len <<= 1) {
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (i = 0; i < n; i += len) {
        var cr = 1, ci = 0;
        for (k = 0; k < len / 2; k++) {
          var ar = re[i + k + len / 2], ai = im[i + k + len / 2];
          tr = ar * cr - ai * ci; ti = ar * ci + ai * cr;
          re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti;
          re[i + k] += tr; im[i + k] += ti;
          var ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
  }
  var refLufs = {};                                // the reference's loudest 3 s, by room
  function reference(rm) {
    rm = rm || room;
    if (refLufs[rm] != null) return Promise.resolve(refLufs[rm]);
    return render("reference", { room: rm }).then(function (r) { refLufs[rm] = analyse(r.buf, r.res, "reference").lufsShortMax; return refLufs[rm]; });
  }
  function check(id, o) {
    o = o || {};
    return reference(o.room).then(function (ref) {
      return render(id, o).then(function (r) {
        var out = analyse(r.buf, r.res, id);
        out.refShortMax = ref; out.vsRef = +(out.lufsShortMax - ref).toFixed(1);
        if (r.res.score) out.score = r.res.score;
        return out;
      });
    });
  }


  // ==========================================================================
  // THE EXTRAS — what each guest must show besides its loudness
  // ==========================================================================
  // THE CROSSING (the band, the company): the level and the side at three
  // moments — as it is first heard, where it passes nearest, as it goes —
  // each a 3 s window of the rendered output: it should come in on one side,
  // swell, stand near the middle, and go out quiet on the other
  function windowDb(L, R, t0, t1) {
    var a = Math.max(0, Math.floor(t0 * SR)), b = Math.min(L.length, Math.floor(t1 * SR)), eL = 0, eR = 0;
    for (var i = a; i < b; i++) { eL += L[i] * L[i]; eR += R[i] * R[i]; }
    var n = Math.max(1, b - a);
    return { db: +(10 * Math.log10((eL + eR) / (2 * n) + 1e-12)).toFixed(1), side: +(10 * Math.log10((eR + 1e-12) / (eL + 1e-12))).toFixed(1) };
  }
  // (and, since round 2, how it goes out of hearing: the band's last 3 s
  // before its stinger and the last 3 s of its drums; the company's last
  // sung line and the last of its wheels)
  function crossing(L, R, start, tc, end, gone, sung) {
    var c = { first: windowDb(L, R, start + 2, start + 5), nearest: windowDb(L, R, tc - 1.5, tc + 1.5), last: windowDb(L, R, end - 3.5, end - 0.5) };
    if (sung) c.sung = windowDb(L, R, sung - 3.5, sung - 0.5);
    if (gone) c.gone = windowDb(L, R, gone - 4, gone - 1);
    return c;
  }
  // THE TRACE (the gulls): each of the lead bird's held cries pitch-tracked
  // (an FFT peak near the expected pitch, ±250 cents, interpolated), and each
  // interval between two cries against the head's own interval
  function trackAt(mono, t0, t1, fGuess) {
    var N = 8192, a = Math.floor(t0 * SR), len = Math.min(N, Math.floor((t1 - t0) * SR));
    if (len < 256) return null;
    var re = new Float32Array(N), im = new Float32Array(N);
    for (var u = 0; u < len; u++) re[u] = (mono[a + u] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * u / len));
    fft(re, im);
    var lo = Math.floor(fGuess * Math.pow(2, -250 / 1200) * N / SR), hi = Math.ceil(fGuess * Math.pow(2, 250 / 1200) * N / SR), bi = lo, bv = 0;
    for (var j = lo; j <= hi; j++) { var pw = re[j] * re[j] + im[j] * im[j]; if (pw > bv) { bv = pw; bi = j; } }
    function lp(k) { return Math.log(re[k] * re[k] + im[k] * im[k] + 1e-30); }
    var y0 = lp(bi - 1), y1 = lp(bi), y2 = lp(bi + 1), d = 0.5 * (y0 - y2) / ((y0 - 2 * y1 + y2) || 1);
    return (bi + d) * SR / N;
  }
  function extras(out, res, L, R, id) {
    var sc = res.score;
    if (sc.bands) out.crossing = sc.bands.map(function (bd) { return crossing(L, R, bd.start, bd.tc, bd.end, bd.gone); });
    else if (sc.path && sc.tc) out.crossing = [crossing(L, R, sc.start, sc.tc, sc.end, sc.end, sc.sing0 + sc.prepared.singS)];
    if (sc.cries && id === "lead") {
      var mono = new Float32Array(L.length);
      for (var i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5;
      var lead = sc.cries.filter(function (c) { return c.role === "lead"; });
      var got = lead.map(function (c) { return trackAt(mono, c.t + c.up + 0.012, c.t + c.up + c.hold - 0.005, c.f); });
      var kept = 0, worst = 0;
      for (var k = 1; k < lead.length; k++) {
        if (!got[k] || !got[k - 1]) continue;
        var heard = 1200 * Math.log(got[k] / got[k - 1]) / Math.LN2, meant = 1200 * Math.log(lead[k].f / lead[k - 1].f) / Math.LN2;
        worst = Math.max(worst, Math.abs(heard - meant));
        if (Math.abs(heard - meant) < 20 && (Math.sign(heard) === Math.sign(meant) || Math.abs(meant) < 1)) kept++;
      }
      out.trace = { meant: lead.map(function (c) { return +c.f.toFixed(1); }), heard: got.map(function (f) { return f ? +f.toFixed(1) : null; }), kept: kept, of: lead.length - 1, worstCents: +worst.toFixed(1) };
    }
  }

  // ==========================================================================
  // THE ODDS — each guest's plan() over a stand-in of the engine's planner
  // ==========================================================================
  // The stand-in throws what the meeting's plan (kolob-plan.js) throws for a
  // seat, in its order: the calendar's Sunday (KOLOB.Calendar.draw), the order of
  // service (the Sunday's hymns; the testimony cut, the interlude), then the
  // guests as the recipe seats them — THE BAND (GuestBands.plan, in the old
  // band's place), the steeples (7.5 % × the Sunday's welcome), the old tune
  // (15 % × the welcome, when the mode admits a tune: 80 %), the trombones
  // (their own plan()), the singing school (10 % of preludes, never a
  // funeral), the handbells (12 % in the invocation, the sacrament or the
  // postlude, never beside a guest), and last THE HANDCART and THE GULLS.
  var SEC_DUR = { prelude: 60, invocation: 60, hymn: 120, interlude: 60, testimony: 100, sacrament: 90, doxology: 110, postlude: 70 };
  function standIn(i, R) {
    var CAL = K.Calendar, id = CAL.draw(R.next()), kind = CAL.kindOf(id), sun = CAL.sunday(id), GW = sun.guests || {};
    var nh = (sun.plan && sun.plan.hymns) || (kind === "conference" || kind === "jubilee" ? 3 : kind === "fast" ? 1 : 2);
    var cutT = R.chance(0.25), inter = R.chance(0.15);
    var secs = [{ type: "prelude" }, { type: "invocation" }];
    for (var h = 0; h < nh; h++) { secs.push({ type: "hymn" }); if (h === 0 && nh >= 2 && inter) secs.push({ type: "interlude" }); }
    if (!cutT) secs.push({ type: "testimony" });
    secs.push({ type: "sacrament" }, { type: "doxology" }, { type: "postlude" });
    secs.forEach(function (s) { s.dur = SEC_DUR[s.type]; });
    var info = { n: i, kind: kind, sunday: id, sections: secs, guests: [] }, G = info.guests, seat;
    function S(label) { return window.PJ2.Rand.stream(i).fork(label + i); }
    function free(type) { var k = -1; secs.forEach(function (s, j) { if (s.type === type && k < 0) k = j; }); var near = [secs[k - 1], secs[k], secs[k + 1]].filter(Boolean).map(function (s) { return s.type; }); return k >= 0 && !G.some(function (g) { return near.indexOf(g.section) >= 0; }); }
    if ((seat = GB.plan(info, S(GB.LABEL)))) G.push({ type: "bands", section: seat.section, second: seat.second });
    var st = R.chance(Math.min(0.9, 0.075 * (GW.steeples != null ? GW.steeples : 1))), stSeat = R.chance(0.55);
    if (st) G.push({ type: "steeples", section: stSeat ? "prelude" : "postlude" });
    var od = R.chance(Math.min(0.9, 0.15 * (GW.oldtune != null ? GW.oldtune : 1))), oSeat = R.chance(0.65), pool = R.chance(0.8);
    if (od && pool) G.push({ type: "oldtune", section: oSeat ? "prelude" : "testimony" });
    if (K.GuestTrombones && (seat = K.GuestTrombones.plan(info, S(K.GuestTrombones.LABEL)))) G.push({ type: "trombones", section: "prelude" });
    var ss = R.chance(0.1), hb = R.chance(0.12), hbSeat = R.pick(["invocation", "sacrament", "postlude"]);
    if (ss && id !== "funeral" && !G.some(function (g) { return g.section === "prelude"; }) && !G.some(function (g) { return g.section === "invocation"; })) G.push({ type: "singingschool", section: "prelude" });
    if (hb && free(hbSeat) && !G.some(function (g) { return g.type === "steeples"; })) G.push({ type: "handbells", section: hbSeat });
    if ((seat = GH.plan(info, S(GH.LABEL)))) G.push({ type: "handcart", section: seat.section });
    if ((seat = GG.plan(info, S(GG.LABEL)))) G.push({ type: "gulls", section: seat.section });
    return info;
  }
  function odds(N) {
    N = N || 20000;
    var R = window.PJ2.Rand.stream(99).fork("lab:odds3a"), res = { n: N, bySunday: {}, seats: { bands: {}, handcart: {}, gulls: {} }, second: 0, any: 0, anyBefore: 0, broken: { bandsHandcart: 0, bandsTrombones: 0, besideAGuest: 0, gullsFuneral: 0 } };
    for (var i = 1; i <= N; i++) {
      var m = standIn(i, R), G = m.guests, row = res.bySunday[m.sunday] = res.bySunday[m.sunday] || { n: 0, bands: 0, handcart: 0, gulls: 0 };
      row.n++;
      if (G.length) res.any++;
      if (G.some(function (g) { return g.type !== "handcart" && g.type !== "gulls"; })) res.anyBefore++;
      function has(t) { return G.some(function (g) { return g.type === t; }); }
      ["bands", "handcart", "gulls"].forEach(function (t) { G.forEach(function (g) { if (g.type === t) { row[t]++; res.seats[t][g.section] = (res.seats[t][g.section] || 0) + 1; if (g.second) res.second++; } }); });
      if (has("bands") && has("handcart")) res.broken.bandsHandcart++;
      if (has("bands") && has("trombones")) res.broken.bandsTrombones++;
      if (has("gulls") && m.sunday === "funeral") res.broken.gullsFuneral++;
      G.forEach(function (g) {
        if (g.type !== "handcart" && g.type !== "gulls") return;
        var k = -1; m.sections.forEach(function (s, j) { if (s.type === g.section && k < 0) k = j; });
        var near = [m.sections[k - 1], m.sections[k], m.sections[k + 1]].filter(Boolean).map(function (s) { return s.type; });
        if (G.some(function (o) { return o !== g && near.indexOf(o.section) >= 0; })) res.broken.besideAGuest++;
      });
    }
    return res;
  }
  // PURITY: the same stream, the same plan and score, twice; no Math.random
  function purity() {
    var st = settings(), hs = composed(st), info = { n: 1, kind: "ordinary", sections: Object.keys(SEC_DUR).map(function (k) { return { type: k, dur: SEC_DUR[k] }; }), guests: [], force: true };
    var real = Math.random, calls = 0, a = [], b = [];
    Math.random = function () { calls++; return real(); };
    try {
      [a, b].forEach(function (out) {
        out.push(JSON.stringify([GB.plan(info, streamOf(GB, st.seed)), GB.score({ hymn: hs[0], homeHz: st.keynote, second: { hymn: hs[1] } }, streamOf(GB, st.seed), 0).bands.map(function (x) { return [x.events.length, x.events[x.events.length - 1], x.drums.length, x.path.length]; })]));
        out.push(JSON.stringify([GH.plan(info, streamOf(GH, st.seed)), GH.score({ homeHz: st.keynote }, streamOf(GH, st.seed), 0).parts]));
        out.push(JSON.stringify([GG.plan(info, streamOf(GG, st.seed)), GG.score({ hymn: hs[0], keynoteHz: st.keynote }, streamOf(GG, st.seed), 0).cries]));
      });
    } finally { Math.random = real; }
    return { bands: a[0] === b[0], handcart: a[1] === b[1], gulls: a[2] === b[2], mathRandomCalls: calls };
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function mmss(s) { var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function table(head, rows) {
    var wrap = el("div", "kg3-scroll"), t = el("table", "kg3-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    t.appendChild(tr);
    rows.forEach(function (r) { var row = el("tr"); r.forEach(function (c) { row.appendChild(el("td", null, c == null ? "—" : String(c))); }); t.appendChild(row); });
    wrap.appendChild(t);
    return wrap;
  }
  function sgn(x) { return (x > 0 ? "+" : "") + x; }
  function measLine(r) {
    var s = "loudness " + r.lufs + " LUFS (loudest 3 s " + r.lufsShortMax + ", " + sgn(r.vsRef) + " LU against the organ reference) · peak " + r.peakDb + " dBFS · clipped " + r.clipped +
      " · strokes " + r.strokes + " · clicks " + r.clicks + (r.clicks ? " (at " + r.clickTimes.join(", ") + " s)" : "");
    if (r.nodes) s += " · nodes: " + r.nodes.created + " made, ≈" + r.nodes.peakLive + " live at the peak" + (r.nodes.singers ? " (the singers' " + r.nodes.singers + ")" : "");
    if (r.crossing) s += " · the crossing: " + r.crossing.map(function (c, k) {
      return (r.crossing.length > 1 ? "band " + (k + 1) + " " : "") + "first heard " + c.first.db + " dB (side " + sgn(c.first.side) + "), nearest " + c.nearest.db + " dB (" + sgn(c.nearest.side) + "), going " + c.last.db + " dB (" + sgn(c.last.side) + ")" + (c.sung ? ", its last line " + c.sung.db + " dB" : "") + (c.gone ? ", " + (c.sung ? "the last of the wheels " : "the drums' last ") + c.gone.db + " dB" : "");
    }).join("; ");
    if (r.trace) s += " · the trace: " + r.trace.kept + " of " + r.trace.of + " intervals as the head has them (worst " + r.trace.worstCents + " cents) — heard " + r.trace.heard.join(" ") + " Hz for " + r.trace.meant.join(" ");
    return s;
  }
  function button(txt, cls, fn) { var b = el("button", cls || null, txt); b.type = "button"; b.addEventListener("click", fn); return b; }
  function busy(btn, p) { btn.disabled = true; return p.then(function (x) { btn.disabled = false; return x; }, function (e) { btn.disabled = false; throw e; }); }
  function showErr(host) { return function (e) { host.textContent = "error: " + (e && e.message ? e.message : e); if (window.console) console.warn(e); }; }
  function checkbox(id, label) { var cb = el("input"); cb.type = "checkbox"; cb.id = id; var l = el("label"); l.appendChild(cb); l.appendChild(document.createTextNode(" " + label)); return l; }
  function select(id, opts, label) {
    var s = el("select"); s.id = id;
    opts.forEach(function (x) { var op = el("option", null, x[1]); op.value = x[0]; s.appendChild(op); });
    var l = el("label", null, label + " "); l.appendChild(s); return l;
  }
  var KEYW = { fifth: "a fifth above", fourth: "a fourth above", tone: "a tone above" };
  function hymnLine() {
    var hs = composed(settings()), e = document.getElementById("kg3-hymn");
    e.textContent = "";
    hs.forEach(function (h, i) {
      e.appendChild(document.createTextNode(i ? " · and " : "The day's hymns: "));
      e.appendChild(el("b", null, h.nameEn || h.id));
      e.appendChild(document.createTextNode(" (" + h.meter + ", " + h.mode + ", " + h.modeOfTime + ", " + h.lines.length + " lines" + (h.refrain ? " and a refrain" : "") + ")"));
    });
  }

  // ---- the band's card -----------------------------------------------------------
  var bandView = {}, hcView = {}, gView = {};
  function bandCard() {
    var card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The Nauvoo Brass Band goes by"));
    card.appendChild(el("p", "kg3-phrase", "A saxhorn band comes up the road playing one of the day's hymns as a march — its own key, its own pace — in real strains: an introduction, the first strain twice, the second strain twice (half the time the first of them down in the tuba), the trio in the subdominant, softly, sometimes once more full, and the stinger. It is heard far off at one end of the colony, passes the meetinghouse partway through the second strain, and goes on toward the other end; after the stinger its drums alone carry it round the last houses and out of hearing."));
    var row = el("div", "kg3-row");
    row.appendChild(select("kg3-which", [["0", "the first hymn"], ["1", "the second hymn"]], "the march made from"));
    row.appendChild(checkbox("kg3-second", "a second band, the other way"));
    row.appendChild(checkbox("kg3-still", "standing in the street (no road)"));
    row.appendChild(checkbox("kg3-meeting", "the meeting carries on (the first hymn under it, on a plain organ)"));
    card.appendChild(row);
    var row2 = el("div", "kg3-row");
    var bPlay = button("▶ the band goes by", "kg3-play", function () { play("band").then(function () { if (current) current.costEl = bandView.cost; }); });
    var bCheck = button("check", "kg3-check", function () { busy(bCheck, check("band", { meeting: false })).then(function (r) { bandView.meas.textContent = measLine(r); }).catch(showErr(bandView.meas)); });
    row2.appendChild(bPlay); row2.appendChild(bCheck);
    card.appendChild(row2);
    bandView.strains = el("div", "kg3-strains"); card.appendChild(bandView.strains);
    bandView.road = el("div", "kg3-road"); card.appendChild(bandView.road);
    bandView.stat = el("p", "kg3-stat"); card.appendChild(bandView.stat);
    bandView.plan = el("ol", "kg3-plan"); card.appendChild(bandView.plan);
    bandView.meas = el("p", "kg3-meas"); card.appendChild(bandView.meas);
    bandView.cost = el("p", "kg3-stat"); card.appendChild(bandView.cost);
    ["kg3-which", "kg3-second", "kg3-still"].forEach(function (id) { card.querySelector("#" + id).addEventListener("change", bandPlan); });
    return card;
  }
  function bandScore() { var st = settings(); return GB.score(bandMaterial(st, {}), streamOf(GB, st.seed), 0, { still: checked("kg3-still") }); }
  function bandPlan() {
    var sc;
    try { sc = bandScore(); } catch (e) { bandView.stat.textContent = "score: " + e.message; return; }
    bandView.score = sc;
    var b0 = sc.bands[0];
    bandView.strains.textContent = "";
    b0.sections.forEach(function (s) {
      var sp = el("span", null, (s.name === "grandioso" ? "grand." : s.name) + " " + mmss(s.t0));
      sp.style.flexGrow = String(Math.max(1, s.t1 - s.t0)); sp.dataset.t0 = s.t0; sp.dataset.t1 = s.t1; sp.title = s.name + (s.role ? " (" + s.role + ")" : "");
      bandView.strains.appendChild(sp);
    });
    bandView.road.textContent = "";
    bandView.road.appendChild(el("b", null, "west")).style.left = "0.3rem";
    var eb = bandView.road.appendChild(el("b", null, "east")); eb.style.right = "0.3rem";
    sc.bands.forEach(function () { bandView.road.appendChild(el("i")); });
    bandView.stat.textContent = sc.bands.map(function (bd, k) {
      return (k ? "The second band: " : "") + (bd.name || bd.hymnId) + " as " + (bd.meter === "6/8" ? "a quickstep in 6/8" : "a march in 2/4") + " at " + Math.round(60 / bd.beatS) + " a minute, " + KEYW[bd.key] + " the meeting's key; introduction: " + bd.intro +
        "; strains " + bd.strains.join(" ") + "; from the " + bd.from + ", nearest at " + mmss(bd.tc) + " (" + bd.nearD.toFixed(2) + " on the distance scale), " + mmss(bd.end - bd.start) + " in all";
    }).join(" · ");
    bandView.plan.textContent = "";
    sc.stages.forEach(function (sg) { bandView.plan.appendChild(el("li", null, mmss(sg.t0) + " — " + sg.label + (sg.detail ? " · " + sg.detail : "") + (sg.what ? " (" + sg.what + ")" : ""))); });
  }

  // ---- the handcart company's card ---------------------------------------------------
  function hcCard() {
    var card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The handcart company"));
    card.appendChild(el("p", "kg3-phrase", "Far across the fields: first the carts — a dry axle creaking once a turn of the wheel, iron on gravel — then the captain strikes up and the company sings ALL IS WELL in unison as it walks, the men an octave under the women, a child a hair behind; a verse or two, the last of it already over the rise, and the wheels after it out of hearing. The meeting hushes to listen."));
    var row = el("div", "kg3-row");
    row.appendChild(select("kg3-hc-only", [["", "the whole company"], ["carts", "the carts alone"], ["singers", "the singers alone"]], "hear"));
    var bPlay = button("▶ the company passes", "kg3-play", function () { play("handcart").then(function () { if (current) current.costEl = hcView.cost; }); });
    var bCheck = button("check", "kg3-check", function () { busy(bCheck, check("handcart")).then(function (r) { hcView.meas.textContent = measLine(r); }).catch(showErr(hcView.meas)); });
    row.appendChild(bPlay); row.appendChild(bCheck);
    card.appendChild(row);
    hcView.stat = el("p", "kg3-stat"); card.appendChild(hcView.stat);
    hcView.plan = el("ol", "kg3-plan"); card.appendChild(hcView.plan);
    hcView.meas = el("p", "kg3-meas"); card.appendChild(hcView.meas);
    hcView.cost = el("p", "kg3-stat"); card.appendChild(hcView.cost);
    return card;
  }
  function hcPlan() {
    var st = settings(), sc;
    try { sc = GH.score({ homeHz: st.keynote }, streamOf(GH, st.seed), 0); } catch (e) { hcView.stat.textContent = "score: " + e.message; return; }
    var P = sc.prepared, sh = P.shape;
    hcView.stat.textContent = "ALL IS WELL, " + sh.verses + " verse" + (sh.verses > 1 ? "s" : "") + " (Clayton's 1" + (sh.verses > 1 ? " and 4" : "") + "), a step every " + sh.beatS.toFixed(2) + " s, its do at " + (P.base * 2).toFixed(0) + " Hz (" + ({ 1: "the day's own key", 1.5: "the dominant's", 1.3333333333333333: "the subdominant's" }[P.key] || P.key) + "); " +
      sh.carts + " carts; " + (sh.leader ? "the captain (a " + (sh.leaderLow ? "bass" : "tenor") + ") strikes up; " : "") + (sh.child ? "a child among them; " : "") + "from the " + (sh.fromWest ? "west" : "east") + ", nearest " + sh.nearD.toFixed(2) + " at " + mmss(sc.tc) + "; " + mmss(sc.end) + " in all";
    hcView.plan.textContent = "";
    sc.stages.forEach(function (sg) { hcView.plan.appendChild(el("li", null, mmss(sg.t0) + " — " + sg.label + (sg.detail ? " · " + sg.detail : ""))); });
  }

  // ---- the gulls' card -------------------------------------------------------------------
  var SOLF = ["do", "re", "mi", "fa", "sol", "la", "ti"];
  function gCard() {
    var card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The gulls"));
    card.appendChild(el("p", "kg3-phrase", "A flock crosses over the meetinghouse (the miracle of the gulls, 1848): a few seconds of harsh bright cries from one side of the sky to the other. Heard closely, the loudest bird's held cries are the head of the day's first hymn, in its rhythm, two octaves up — the whole head moved by one octave shift, so its shape survives."));
    var row = el("div", "kg3-row");
    var bPlay = button("▶ the gulls fly over", "kg3-play", function () { play("gulls").then(function () { if (current) current.costEl = gView.cost; }); });
    var bLead = button("▶ the lead bird alone", null, function () { play("lead").then(function () { if (current) current.costEl = gView.cost; }); });
    var bCheck = button("check", "kg3-check", function () { busy(bCheck, check("gulls")).then(function (r) { gView.meas.textContent = measLine(r); }).catch(showErr(gView.meas)); });
    var bTrace = button("check the trace", "kg3-check", function () { busy(bTrace, check("lead", { room: "dry" })).then(function (r) { gView.meas2.textContent = measLine(r); }).catch(showErr(gView.meas2)); });
    [bPlay, bLead, bCheck, bTrace].forEach(function (b) { row.appendChild(b); });
    card.appendChild(row);
    gView.stat = el("p", "kg3-stat"); card.appendChild(gView.stat);
    gView.meas = el("p", "kg3-meas"); card.appendChild(gView.meas);
    gView.meas2 = el("p", "kg3-meas"); card.appendChild(gView.meas2);
    gView.cost = el("p", "kg3-stat"); card.appendChild(gView.cost);
    return card;
  }
  function gPlan() {
    var st = settings(), h = composed(st)[0], sc;
    try { sc = GG.score({ hymn: h, keynoteHz: st.keynote }, streamOf(GG, st.seed), 0); } catch (e) { gView.stat.textContent = "score: " + e.message; return; }
    var sh = sc.prepared.shape, roles = {};
    sc.cries.forEach(function (c) { roles[c.role] = (roles[c.role] || 0) + 1; });
    var doOf = { ionian: 0, penta: 0, hexa: 0, mixolydian: 3, dorian: 6, aeolian: 2 };   // (a mode's own do, in shape-note solfège)
    gView.stat.textContent = "the head of " + (h.nameEn || h.id) + ": " + sc.head.map(function (n) { return SOLF[mod(n.deg - (doOf[h.mode] || 0), 7)] + (n.deg >= 7 ? "′" : n.deg < 0 ? "," : ""); }).join(" ") +
      " — moved up ×" + sc.shift + " (" + sc.notes.map(function (f) { return f.toFixed(0); }).join(" ") + " Hz) · " + sh.birds + " birds around the lead, " + (roles.chatter || 0) + " cries of theirs" +
      (sh.echo ? " · a second bird answers the end of the phrase" : "") + (sh.wheel ? " · the flock wheels round and one calls the first notes again" : "") + " · from the " + (sh.fromWest ? "west" : "east") + " · " + mmss(sc.end) + " in all";
  }

  // ---- the odds and purity -----------------------------------------------------------------
  function oddsCard() {
    var card = el("section", "kg3-card");
    card.appendChild(el("h2", "kg3-name", "The odds, and purity"));
    card.appendChild(el("p", "kg3-phrase", "Each guest's plan() over 20,000 meetings of a stand-in for the engine's planner (the calendar's Sundays, the order of service, the other guests' own dice and seats, in the order the recipe seats them), with the rules checked; and the pure parts run twice on the same stream, with Math.random watched."));
    var out = el("div"), pOut = el("p", "kg3-meas"), row = el("div", "kg3-row");
    var bOdds = button("run the odds", null, function () {
      busy(bOdds, new Promise(function (res) { setTimeout(function () { res(odds(20000)); }, 20); })).then(function (r) {
        out.textContent = "";
        var ids = Object.keys(r.bySunday).sort(function (a, b) { return r.bySunday[b].n - r.bySunday[a].n; });
        function pc(x, n) { return (100 * x / Math.max(1, n)).toFixed(1) + " %"; }
        var all = { n: 0, bands: 0, handcart: 0, gulls: 0 };
        ids.forEach(function (k) { ["n", "bands", "handcart", "gulls"].forEach(function (f) { all[f] += r.bySunday[k][f]; }); });
        out.appendChild(table(["Sunday", "meetings", "the band", "the handcarts", "the gulls"], [["all", all.n, pc(all.bands, all.n), pc(all.handcart, all.n), pc(all.gulls, all.n)]].concat(ids.map(function (k) { var x = r.bySunday[k]; return [k, x.n, pc(x.bands, x.n), pc(x.handcart, x.n), pc(x.gulls, x.n)]; }))));
        function seats(t) { var s = r.seats[t], n = 0; Object.keys(s).forEach(function (k) { n += s[k]; }); return Object.keys(s).map(function (k) { return k + " " + pc(s[k], n); }).join(" · "); }
        out.appendChild(el("p", "kg3-stat", "the band's sections: " + seats("bands") + " · a second band: " + pc(r.second, all.bands) + " of the bands · the handcarts': " + seats("handcart") + " · the gulls': " + seats("gulls")));
        out.appendChild(el("p", "kg3-stat", "meetings with any guest: " + pc(r.any, r.n) + " (without the handcarts and the gulls: " + pc(r.anyBefore, r.n) + ") · the rules broken — the band with the handcarts: " + r.broken.bandsHandcart + ", the band with the trombones: " + r.broken.bandsTrombones + ", the handcarts or the gulls in or beside another guest's section: " + r.broken.besideAGuest + ", the gulls at a funeral: " + r.broken.gullsFuneral));
      });
    });
    var bPure = button("check purity", null, function () {
      var r = purity();
      pOut.textContent = "the same stream, the same plan and score — the band: " + (r.bands ? "yes" : "NO") + " · the handcarts: " + (r.handcart ? "yes" : "NO") + " · the gulls: " + (r.gulls ? "yes" : "NO") + " · Math.random calls while planning and scoring: " + r.mathRandomCalls;
    });
    row.appendChild(bOdds); row.appendChild(bPure);
    card.appendChild(row); card.appendChild(out); card.appendChild(pOut);
    return card;
  }

  // ---- the live loop: the meter, the cost, where the band is -------------------------------
  function lightLoop() {
    if (lightTimer) return;
    lightTimer = setInterval(function () {
      var m = meter(), me = document.getElementById("kg3-meter");
      if (me) me.textContent = m ? "out " + (m.peak < -90 ? "—" : m.peak.toFixed(1) + " dBFS") : "out —";
      if (current && current.costEl) {
        var c = cost();
        current.costEl.textContent = "laid out on the engine's clock: " + c.press + " ms of main thread at the press, then " + c.slices + " slice" + (c.slices === 1 ? "" : "s") + " a little ahead of the sound in " + c.wakes + " wake" + (c.wakes === 1 ? "" : "s") + " of the clock, the largest wake " + c.largestWake + " ms";
      }
      if (!actx || !current || current.id !== "band" || !current.score) return;
      var now = actx.currentTime, sc = current.score;
      Array.prototype.forEach.call(bandView.strains.querySelectorAll("span"), function (sp) {
        var t0 = sc.bands[0].start + +sp.dataset.t0, t1 = sc.bands[0].start + +sp.dataset.t1;
        sp.className = now >= t0 && now < t1 ? "lit" : "";
      });
      Array.prototype.forEach.call(bandView.road.querySelectorAll("i"), function (dot, k) {
        var bd = sc.bands[k]; if (!bd) return;
        var pts = bd.path, p = pts[0];
        for (var i = 0; i < pts.length && pts[i].t <= now; i++) p = pts[i];
        dot.style.left = (50 + 46 * p.side) + "%";
        dot.style.opacity = now < bd.start || now > bd.end ? 0.15 : (0.25 + 0.75 * (1 - p.d)).toFixed(2);
      });
    }, 80);
  }

  function refresh() {
    try { hymnLine(); } catch (e) { document.getElementById("kg3-hymn").textContent = "compose: " + e.message; return; }
    bandPlan(); hcPlan(); gPlan();
  }
  function init() {
    var cards = document.getElementById("kg3-cards");
    cards.appendChild(bandCard());
    cards.appendChild(hcCard());
    cards.appendChild(gCard());
    cards.appendChild(oddsCard());
    ["kg3-seed", "kg3-dialect", "kg3-key"].forEach(function (id) { document.getElementById(id).addEventListener("change", function () { stop(); refresh(); }); });
    document.getElementById("kg3-room").addEventListener("change", function (e) { setRoom(e.target.value); });
    document.getElementById("kg3-stop").addEventListener("click", stop);
    document.getElementById("kg3-compose").addEventListener("click", function () { var s = document.getElementById("kg3-seed"); s.value = Math.round(num("kg3-seed", 2)) + 1; stop(); refresh(); });
    // a link can carry the settings: ?seed=4&dialect=gospel&key=270&which=1&second=1&still=1
    var q = window.location.search;
    [["seed", "kg3-seed"], ["dialect", "kg3-dialect"], ["key", "kg3-key"], ["which", "kg3-which"]].forEach(function (p) {
      var m = new RegExp("[?&]" + p[0] + "=([^&#]*)").exec(q);
      if (m) { var e = document.getElementById(p[1]); if (e) e.value = decodeURIComponent(m[1]); }
    });
    [["second", "kg3-second"], ["still", "kg3-still"], ["meeting", "kg3-meeting"]].forEach(function (p) {
      if (new RegExp("[?&]" + p[0] + "=1").test(q)) document.getElementById(p[1]).checked = true;
    });
    refresh();
    lightLoop();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  return {
    play: play, stop: stop, check: check, render: render, odds: odds, purity: purity, setRoom: setRoom,
    cost: function () { return current ? { id: current.id, press: current.cost.press, slices: current.cost.slices.slice(), wakes: current.cost.wakes.slice(), until: current.until, now: actx.currentTime } : null; },
    hymns: function () { return composed(settings()); },
    score: function (id) { var st = settings(); return id === "handcart" ? GH.score({ homeHz: st.keynote }, streamOf(GH, st.seed), 0) : id === "gulls" ? GG.score({ hymn: composed(st)[0], keynoteHz: st.keynote }, streamOf(GG, st.seed), 0) : bandScore(); },
    refresh: refresh, _P: P,
  };
})();

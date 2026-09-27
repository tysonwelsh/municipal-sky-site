// ============================================================================
// TROMBONE LAB — audition bench for the trombone choir at dawn (dev, unlinked).
//
// The alto, tenor and bass trombones of KOLOB.VoicesBand, alone and as a
// four-part choir, and KOLOB.GuestTrombones' whole dawn exchange — a choir
// far across the settlement playing a line of the day's first hymn, a nearer
// one answering the next from the other side — over a chorale in any of
// Kolob's six modes: a sample hymn harmonized by the guest's own fallback, the
// same hymn as v0.32's Harmony voices it (captured from the harness: the
// chords the engine would pass today), or an Earth tune with every part its
// source prints.
//
// Everything plays through the app's own master chain (glue → master 0.6 →
// tanh → compressor, as kolob-core.js builds it) plus a brick-wall guard at
// −1 dBFS, in the app's rooms: the lab never plays louder than the app. The
// chain, the v0.30 organ level reference and the measurements are the
// instruments lab's, copied line for line so the two benches read the same
// numbers (and the trombones are calibrated against that same reference).
//
// CHECK renders offline (OfflineAudioContext, the same graph) and reports:
// loudness (BS.1770 integrated, and the loudest 3 s), peak, RMS, the peak
// before the chain, clipped samples, clicks, the spectrum and a spectrogram;
// for the dawn it also measures every phrase — its loudness, its brightness
// (spectral centroid, 200 Hz–8 kHz) and where it stands (left/right balance)
// — which is where the antiphony shows: the far choir quieter, darker and on
// one side, the near one present and on the other. "check all six" renders
// the dawn in every mode; "calibrate" sets the choir beside the reference.
//
// Dev console: TromboneLab.check(id, o), TromboneLab.render(id, o),
// TromboneLab.all(), TromboneLab.calibrate(), TromboneLab.odds().
// Public surface: window.TromboneLab
// ============================================================================
window.TromboneLab = (function () {
  "use strict";

  var SR = 48000;
  var G = window.KOLOB.GuestTrombones, VB = window.KOLOB.VoicesBand;
  var MODES = ["ionian", "mixolydian", "dorian", "aeolian", "hexa", "penta"];

  // v0.32's Harmony, harmonizing G.SAMPLES line by line (as choirVerse
  // does), captured from the harness with Harmony's state carried across
  // lines: [[voicing [b, t, a, s] in collection indices, beats], …] per line.
  // Regenerate: see handoff/r2-trombones-1.md.
  var ENGINE = {
    ionian: [[[[-2,2,5,7],1],[[0,2,4,9],1],[[-7,-3,0,4],1],[[-2,2,5,7],1],[[-2,2,5,5],1],[[-3,1,4,4],1],[[-7,-3,0,9],1],[[-3,1,4,4],2]],[[[-3,1,4,4],1],[[-2,2,5,5],1],[[-4,3,5,7],1],[[-4,3,5,5],1],[[-3,1,4,4],1],[[-2,2,5,9],2]],[[[-7,-3,0,9],1],[[-8,-5,2,4],1],[[-4,0,3,7],1],[[-7,0,4,9],1],[[-1,3,6,8],1],[[-4,3,5,7],1],[[-6,-2,1,5],1],[[-3,1,4,4],2]],[[[-7,-3,0,7],1],[[-4,0,3,5],1],[[-3,1,4,4],1],[[-7,-3,0,9],1],[[-3,1,4,8],1],[[-7,-3,0,7],2]]],
    mixolydian: [[[[-7,-3,0,7],1],[[-7,-3,0,4],1],[[-5,-1,2,4],1],[[-4,0,3,5],1],[[-5,-1,2,6],1],[[-4,0,3,5],1],[[-7,0,2,4],1],[[-3,-1,1,4],2]],[[[-4,-2,0,7],1],[[-3,1,4,6],1],[[-3,0,4,4],1],[[-4,0,3,5],1],[[-7,0,4,4],1],[[-2,2,5,9],2]],[[[-3,1,4,4],1],[[-1,3,6,6],1],[[-4,0,3,7],1],[[-3,1,4,8],1],[[-2,2,5,9],1],[[-6,-2,1,8],1],[[-4,0,3,7],1],[[-3,1,4,6],2]],[[[-7,-3,0,4],1],[[-2,2,5,5],1],[[-5,2,4,6],1],[[-7,-3,0,4],1],[[-3,1,4,8],1],[[-2,2,5,7],2]]],
    dorian: [[[[-4,0,3,7],1],[[-7,0,4,7],1],[[-5,-1,2,9],1],[[-5,-1,2,4],1],[[-4,0,3,5],1],[[-5,-1,2,4],1],[[-2,2,5,9],1],[[-3,1,4,4],2]],[[[-4,0,3,7],1],[[-1,3,6,6],1],[[-6,-2,1,5],1],[[-3,1,4,4],1],[[-6,1,3,3],1],[[-9,0,2,9],2]],[[[-3,1,4,4],1],[[-4,0,3,5],1],[[-4,0,3,7],1],[[-3,1,4,8],1],[[-7,-3,0,7],1],[[-5,-1,2,6],1],[[-4,0,3,5],1],[[-3,1,4,4],2]],[[[-2,2,5,5],1],[[-3,1,4,4],1],[[-7,-3,0,9],1],[[-6,-2,1,3],1],[[-3,1,4,8],1],[[-2,2,5,7],2]]],
    aeolian: [[[[-2,2,5,7],1],[[-5,-1,2,9],1],[[-3,1,4,4],1],[[-7,-3,0,4],1],[[-2,2,5,5],1],[[-5,2,4,4],1],[[-2,2,5,9],1],[[-6,-2,1,8],2]],[[[-7,-3,0,9],1],[[-3,1,4,4],1],[[-2,2,5,5],1],[[-5,2,4,4],1],[[-5,-1,2,9],1],[[-7,0,2,7],2]],[[[-3,1,4,4],1],[[-2,2,5,7],1],[[-2,2,5,7],1],[[-1,3,6,6],1],[[-4,0,3,5],1],[[-7,0,2,4],1],[[-4,0,3,5],1],[[-7,0,2,4],2]],[[[-7,0,2,9],1],[[-7,-3,0,4],1],[[-4,0,3,3],1],[[-7,-3,0,9],1],[[-6,-2,1,8],1],[[-4,0,3,7],2]]],
    hexa: [[[[-1,2,5,6],1],[[0,2,4,2],1],[[-6,-2,0,4],1],[[-8,-2,1,4],1],[[-1,3,5,5],1],[[-6,-2,0,4],1],[[-3,0,3,3],1],[[-2,1,4,7],2]],[[[-6,-2,0,2],1],[[-3,0,3,3],1],[[-6,0,2,4],1],[[-6,0,2,2],1],[[-1,3,5,7],1],[[0,2,4,6],2]],[[[0,2,4,4],1],[[-1,3,5,5],1],[[-6,-2,0,6],1],[[-6,-2,0,6],1],[[-5,-1,1,5],1],[[-4,-1,2,4],1],[[-7,-1,2,5],1],[[-8,-1,1,4],2]],[[[-3,-1,0,3],1],[[-1,2,5,2],1],[[-6,-2,0,4],1],[[-1,2,5,2],1],[[-2,1,4,7],1],[[-1,2,5,6],2]]],
    penta: [[[[-1,2,4,5],1],[[-2,1,3,6],1],[[-3,0,2,2],1],[[-2,1,4,3],1],[[-1,2,4,4],1],[[-5,-2,0,3],1],[[-6,-3,2,2],1],[[-2,1,4,3],2]],[[[-1,2,5,5],1],[[-1,2,5,4],1],[[-2,1,3,3],1],[[-1,2,4,2],1],[[-1,2,4,6],1],[[-1,2,4,2],2]],[[[-5,-2,0,3],1],[[-6,-3,0,4],1],[[-6,-3,2,5],1],[[-6,-1,1,6],1],[[-5,-2,0,5],1],[[-1,2,4,4],1],[[-5,-2,0,3],1],[[-3,0,2,4],2]],[[[-5,-2,0,3],1],[[-3,0,2,2],1],[[-2,1,4,6],1],[[-1,2,5,2],1],[[-4,-1,1,6],1],[[-3,0,2,5],2]]],
  };

  // ==========================================================================
  // THE CHAIN — the instruments lab's, which is kolob-core.js init()'s:
  // rooms → voicesBus → glue → masterGain(0.6) → tanh(1.15) →
  // compressor(−18/3:1) — then a brick-wall guard at −1 dBFS.
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
  function buildChain(ctx, room, irBuf, dest) {
    var t = 0;
    var session = ctx.createGain();
    var voicesBus = ctx.createGain();
    var dry = ctx.createGain(); dry.gain.value = 1;
    session.connect(dry); dry.connect(voicesBus);
    if (room !== "dry") {
      var spec = room === "close" ? { pre: 0.012, wet: 0.28 } : { pre: 0.063, wet: 0.40 };
      var pre = ctx.createDelay(0.25); pre.delayTime.value = spec.pre;
      var conv = ctx.createConvolver();
      conv.buffer = room === "close" ? pour(ctx, 1.4, 1.2) : (irBuf || pour(ctx, 5.5, 0.8));
      var wet = ctx.createGain(); wet.gain.value = spec.wet;
      session.connect(pre); pre.connect(conv); conv.connect(wet); wet.connect(voicesBus);
    }
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
    return { input: session, out: fade };
  }

  // ==========================================================================
  // THE MATERIAL — what the page is set to: mode, source, keynote, seed
  // ==========================================================================
  function earthTunes() {
    var T = window.KOLOB.Tunes;
    if (!T || !T.list) return [];
    return T.list.filter(function (h) {
      var parts = {};
      h.lines.forEach(function (ln) { ["S", "A", "T", "B"].forEach(function (p) { if (ln.notes[p] && ln.notes[p].length) parts[p] = 1; }); });
      return Object.keys(parts).length >= 2;
    });
  }
  function settings(o) {
    o = o || {};
    var mode = o.mode || val("ktl-mode", "ionian"), src = o.source || val("ktl-source", "sample");
    var K = o.keynote != null ? o.keynote : num("ktl-key", 260), seed = o.seed != null ? o.seed : num("ktl-seed", 1847);
    return { mode: mode, source: src, keynote: Math.max(150, Math.min(400, K)), seed: seed, room: o.room || room };
  }
  function material(st) {
    if (st.source.indexOf("earth:") === 0) {
      var h = window.KOLOB.Tunes && window.KOLOB.Tunes.byId(st.source);
      if (h) return { hymn: h, keynoteHz: st.keynote, mode: h.mode };
    }
    if (st.source === "engine") {
      return {
        mode: st.mode, keynoteHz: st.keynote,
        lines: ENGINE[st.mode].map(function (ln) { return ln.map(function (c) { return { degs: c[0], beats: c[1] }; }); }),
        tune: { space: "d7", lines: G.SAMPLES[st.mode].map(function (ln) { return ln.map(function (x) { return x[0]; }); }) },
      };
    }
    return G.sample(st.mode, st.keynote);
  }
  function streamFor(seed) { return window.PJ2.Rand.stream(seed >>> 0).fork(G.LABEL + 1); }

  // ==========================================================================
  // THE PHRASES — each: (ctx, into, t, o) → { dur, stats, score? }
  // ==========================================================================
  var P = {};
  function tail(t, dur, st) { return Math.max(dur, (st.until || 0) - t + 0.1); }
  function merge(a, b) {
    return { standing: a.standing + b.standing, created: a.created + b.created, peakLive: a.peakLive + b.peakLive, until: Math.max(a.until || 0, b.until || 0) };
  }

  // ---- one trombone alone: its own part of the chorale, two lines ----------
  var SOLO_PART = { altoTrombone: "S", tenorTrombone: "T", bassTrombone: "B" };
  var ATTACK = { tongued: null, soft: 0.16, breath: 0.42 };
  P.solo = function (ctx, into, t, o) {
    var st = settings(o), ch = G.chorale(material(st));
    var inst = o.inst || "tenorTrombone", part = SOLO_PART[inst] || "T";
    var band = VB.create(ctx, into, { seed: st.seed });
    var spb = 1.12, at = 0, dyn = o.dyn || "mf", atk = ATTACK[o.attack || "tongued"];
    ch.lines.slice(0, 2).forEach(function (ln) {
      var ns = ln.parts[part].length ? ln.parts[part] : ln.parts.S;
      var notes = ns.map(function (nt, i) {
        var last = i === ns.length - 1;
        return { f: nt.f, at: at + nt.beat * spb, dur: (last ? nt.beats * 2 : nt.beats) * spb, legato: i > 0, atk: i === 0 ? atk : null, dynEnd: last ? VB.DYNAMICS[dyn] * 0.72 : null, rel: last ? 0.25 : 0.05 };
      });
      band.play(t, notes, inst, dyn);
      var lastN = ns[ns.length - 1];
      at += (lastN.beat + lastN.beats * 2) * spb + 1.2;
    });
    var s = band.stats();
    return { dur: tail(t, at, s), stats: s };
  };

  // ---- the four-part choir at mf: OLD HUNDRED, as the organ plays it --------
  // The instruments lab's organ phrase (Genevan Psalter, 1551, two lines,
  // SATB, C = 260 Hz), so the choir and the calibrated organ are heard on the
  // same notes. Near, in the doorway: no distance. The calibration phrase.
  var MAJ = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
  function deg(key, d) { var i = d - 1, oct = Math.floor(i / 7), k = ((i % 7) + 7) % 7; return key * MAJ[k] * Math.pow(2, oct); }
  function fo(d, oct) { return deg(260, d) * Math.pow(2, oct || 0); }
  var OLD100 = [
    [[fo(1, 1), fo(3), fo(5, -1), fo(1, -1)], 2], [[fo(1, 1), fo(3), fo(6, -1), fo(6, -2)], 1], [[fo(7), fo(2), fo(5, -1), fo(5, -2)], 1],
    [[fo(6), fo(3), fo(1), fo(6, -2)], 1], [[fo(5), fo(3), fo(1), fo(1, -1)], 1], [[fo(1, 1), fo(4), fo(6, -1), fo(4, -2)], 1],
    [[fo(2, 1), fo(5), fo(7, -1), fo(5, -2)], 1], [[fo(3, 1), fo(5), fo(1), fo(1, -1)], 2], null,
    [[fo(3, 1), fo(5), fo(1), fo(1, -1)], 2], [[fo(3, 1), fo(1, 1), fo(3), fo(6, -2)], 1], [[fo(3, 1), fo(5), fo(1), fo(3, -1)], 1],
    [[fo(2, 1), fo(5), fo(7, -1), fo(5, -2)], 1], [[fo(1, 1), fo(5), fo(3), fo(1, -1)], 1], [[fo(4, 1), fo(6), fo(1), fo(4, -2)], 1],
    [[fo(3, 1), fo(5), fo(1), fo(1, -1)], 1], [[fo(2, 1), fo(5), fo(7, -1), fo(5, -2)], 3],
  ];
  var INST4 = ["altoTrombone", "tenorTrombone", "tenorTrombone", "bassTrombone"];
  // (console: o.dist, o.side, o.spread set the choir at a distance — the
  // level-curve fit)
  P.choir = function (ctx, into, t, o) {
    var st = settings(o), band = VB.create(ctx, into, o.dist != null ? { seed: st.seed, distance: o.dist, side: o.side || 0, spread: o.spread != null ? o.spread : 1 } : { seed: st.seed });
    var beat = o.beat || 0.82, dyn = o.dyn || "mf";
    var parts = [[], [], [], []], at = 0, first = true;
    OLD100.forEach(function (row) {
      if (!row) { at += beat * 0.6; first = true; return; }
      var d = row[1] * beat;
      row[0].forEach(function (f, v) {
        parts[v].push({ f: f, at: at, dur: d, legato: !first, atk: first ? 0.08 : null, rel: 0.05 });
      });
      at += d; first = false;
    });
    var dv = typeof dyn === "number" ? dyn : VB.DYNAMICS[dyn];
    parts.forEach(function (ns) { var l = ns[ns.length - 1]; l.rel = 0.2; l.dynEnd = dv * 0.8; });
    parts.forEach(function (ns, v) { band.play(t, ns, INST4[v], dyn); });
    var s = band.stats();
    return { dur: tail(t, at + 0.5, s), stats: s };
  };

  // ---- the level reference: the v0.30 organChord, line for line -------------
  // (the instruments lab's P.reference: gainMul at mid-prelude, I–IV–V–I,
  // SATB as Harmony spreads it, 6 s chords, env()'s linear ramps)
  var REF_GAINMUL = 0.75 * (0.6 + 0.4 * 0.21);
  var REF_DUR = 6, REF_STEP = 6.4;
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }
  P.reference = function (ctx, into, t, o) {
    var chords = [[-6, -2, 3, 8], [-3, 1, 6, 8], [-2, 0, 5, 9], [-6, -2, 3, 8]];
    var gainMul = o.gainMul != null ? o.gainMul : REF_GAINMUL, n = 0;
    chords.forEach(function (c, i) {
      var freqs = c.map(function (d) { return deg(260, d); });
      var tt = t + i * REF_STEP, dur = REF_DUR, stops = 0.5, trem = 0.15, pedal = 0.6;
      var master = ctx.createGain(); master.connect(into); n++;
      var RANKS = [1, 2, 3, 4], PP = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
      var nTones = freqs.length;
      for (var v = 0; v < nTones; v++) {
        var f0 = freqs[v] * 0.5;
        for (var r = 0; r < RANKS.length; r++) {
          var g = PP[r] * (1 - stops) + FL[r] * stops;
          if (g < 0.05) continue;
          var pair = r === 0 ? 2 : 1;
          for (var d = 0; d < pair; d++) {
            var osc = ctx.createOscillator(); osc.type = "sine";
            osc.frequency.setValueAtTime(f0 * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), tt);
            var og = ctx.createGain(); og.gain.setValueAtTime(g * 0.16 / Math.sqrt(nTones) / pair, tt);
            osc.connect(og); og.connect(master);
            osc.start(tt); osc.stop(tt + dur + 0.3); n += 2;
          }
        }
      }
      if (pedal > 0.05) {
        var sub = ctx.createOscillator(); sub.type = "sine"; sub.frequency.setValueAtTime(freqs[0] * 0.25, tt);
        var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, tt);
        sub.connect(sg); sg.connect(master); sub.start(tt); sub.stop(tt + dur + 0.3); n += 2;
      }
      if (trem > 0.02) {
        var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(5.5, tt);
        var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, tt);
        lfo.connect(lg); lg.connect(master.gain); lfo.start(tt); lfo.stop(tt + dur + 0.3); n += 2;
      }
      var peak = gainMul * 0.7;
      var atk = Math.min(2.2, dur * 0.3);
      env(master, tt, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    });
    return { dur: (chords.length - 1) * REF_STEP + REF_DUR + 0.5, stats: { standing: 0, created: n, peakLive: n } };
  };

  // ---- the dawn exchange: KOLOB.GuestTrombones.perform, as the engine calls it
  P.dawn = function (ctx, into, t, o) {
    var st = settings(o), mat = material(st);
    var end = G.perform(ctx, into, t, mat, streamFor(st.seed), { only: o.only || null });
    var last = G.perform.last;
    var s = merge(last.far.stats(), last.near.stats());
    return { dur: tail(t, end - t + 3, s), stats: s, score: last.score };
  };

  var PHRASES = [
    { id: "solo", name: "The trombones alone", phrase: "each instrument on its own part of the chorale, two lines, at a dynamic and an attack you choose" },
    { id: "choir", name: "The choir at mf", phrase: "OLD HUNDRED, two lines, four parts — the organ's phrase, so it can be set beside the level reference" },
    { id: "reference", name: "The v0.30 organ (level reference)", phrase: "organChord as the prelude plays it, line for line: the choir at mf matches its loudness" },
    { id: "dawn", name: "The dawn exchange", phrase: "the far choir plays a line, the near one answers the next, from the other side — the whole guest, as the engine will call it" },
  ];

  // ==========================================================================
  // LIVE PLAYBACK — one context; phrases play into `labIn`, which feeds the
  // current room chain; the meter sits after it. A room change crossfades.
  // ==========================================================================
  var actx = null, chain = null, irBuf = null, room = "wide", current = null, analyser = null, labIn = null;
  function ensure() {
    if (actx) return Promise.resolve();
    actx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = actx.createAnalyser(); analyser.fftSize = 2048; analyser.connect(actx.destination);
    labIn = actx.createGain();
    return fetchIR(actx).then(function (b) { irBuf = b; rebuild(); });
  }
  function rebuild() {
    var old = chain, t = actx.currentTime, X = 0.25;
    chain = buildChain(actx, room, irBuf, analyser);
    labIn.connect(chain.input);
    if (!old) return;
    chain.out.gain.setValueAtTime(0, t); chain.out.gain.linearRampToValueAtTime(1, t + X);
    old.out.gain.setValueAtTime(1, t); old.out.gain.linearRampToValueAtTime(0, t + X);
    setTimeout(function () {
      try { labIn.disconnect(old.input); } catch (e) {}
      try { old.out.disconnect(); } catch (e2) {}
    }, (X + 0.15) * 1000);
  }
  function stop() {
    if (!current) return;
    var c = current;
    c.gain.gain.setTargetAtTime(0, actx.currentTime, 0.03);
    setTimeout(function () { try { c.gain.disconnect(); } catch (e) {} }, 400);
    current = null;
  }
  function play(id, o) {
    return ensure().then(function () {
      if (actx.state === "suspended") actx.resume();
      stop();
      var g = actx.createGain(); g.connect(labIn);
      var res = P[id](actx, g, actx.currentTime + 0.12, o || {});
      current = { gain: g, id: id, until: actx.currentTime + res.dur };
      return res;
    });
  }
  function setRoom(r) { room = r; if (actx) rebuild(); }
  function meter() {
    if (!analyser) return null;
    var a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
    var pk = 0; for (var i = 0; i < a.length; i++) { var x = Math.abs(a[i]); if (x > pk) pk = x; }
    return { peak: 20 * Math.log10(pk + 1e-9) };
  }

  // ==========================================================================
  // CHECK — offline render + the instruments lab's measures (+ per phrase)
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
      var off = new OfflineAudioContext(4, len, SR);
      off.destination.channelCount = 4; off.destination.channelInterpretation = "discrete";
      var merger = off.createChannelMerger(4); merger.connect(off.destination);
      var ch = buildChain(off, rm, ir, merger);
      var split = off.createChannelSplitter(2);
      ch.input.connect(split); split.connect(merger, 0, 2); split.connect(merger, 1, 3);
      var mainSplit = off.createChannelSplitter(2);
      ch.out.disconnect(); ch.out.connect(mainSplit); mainSplit.connect(merger, 0, 0); mainSplit.connect(merger, 1, 1);
      var res = P[id](off, ch.input, 0.1, o);
      return off.startRendering().then(function (buf) { return { buf: buf, res: res }; });
    });
  }
  function check(id, o) {
    o = o || {};
    var main = render(id, o).then(function (r) { return analyse(r.buf, r.res, id, o); });
    if (id !== "dawn" || o.only) return main;
    // THE ANTIPHONY, measured clean: each choir rendered alone (a phrase
    // window of the full render also holds the other choir's reverberant
    // tail), and heard as a listener hears it — its loudness WHILE IT PLAYS,
    // the energy mean of its own phrases (integrated over a solo render, a
    // far choir's long wet tails and silences would pull it ~2 LU low)
    return main.then(function (r) {
      return check("dawn", Object.assign({}, o, { only: "far" })).then(function (f) {
        return check("dawn", Object.assign({}, o, { only: "near" })).then(function (nr) {
          function side(x) { return x.balanceDb; }
          function playing(x, who) {
            var ls = (x.phrases || []).filter(function (p) { return p.choir === who && isFinite(p.lufs); }).map(function (p) { return p.lufs; });
            var m = 0; ls.forEach(function (v) { m += Math.pow(10, v / 10); });
            return ls.length ? +(10 * Math.log10(m / ls.length)).toFixed(1) : x.lufs;
          }
          var fl = playing(f, "far"), nl = playing(nr, "near");
          r.antiphony = {
            farLufs: fl, nearLufs: nl, gapLu: +(nl - fl).toFixed(1), targetGapLu: r.score ? r.score.gapLu : null,
            farCentroid: f.centroidHz, nearCentroid: nr.centroidHz, farPresence: f.presenceDb, nearPresence: nr.presenceDb,
            farBalance: side(f), nearBalance: side(nr), farSide: r.score ? r.score.farSide : null,
            exchanges: r.score ? r.score.exchanges : null, source: r.score ? r.score.chorale.source : null,
          };
          return r;
        });
      });
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
  function highpass4k(x) {
    var w = Math.tan(Math.PI * 4000 / SR), q = Math.SQRT1_2, nn = 1 / (1 + w / q + w * w);
    var bb = [nn, -2 * nn, nn], aa = [1, 2 * (w * w - 1) * nn, (1 - w / q + w * w) * nn];
    return biquad(biquad(x, bb, aa), bb, aa);
  }
  // BS.1770-4 over [a, b) samples (whole buffer by default): integrated
  // (gated at −70 LUFS and −10 LU) and the loudest 3-second window
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
    for (var s3 = 0; s3 + S3 <= n; s3 += H) sMax = Math.max(sMax, L(s3, S3));
    if (!isFinite(sMax)) sMax = L(0, n);
    return { I: abs.length ? I : -Infinity, S: sMax };
  }
  function loudness(chs) { return loudnessOf(chs.map(kWeight)); }
  // brightness of a stretch: spectral centroid 200 Hz – 8 kHz, and its
  // presence — the share of 60 Hz – 6 kHz energy that lies above 1 kHz, in
  // dB (the air a far sound loses first) (Welch, 4096)
  function spectrumOf(mono, a, b) {
    var N = 4096, win = new Float32Array(N), re = new Float32Array(N), im = new Float32Array(N), num = 0, den = 0, hi = 0, all = 0;
    for (var w = 0; w < N; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / N);
    for (var st = a; st + N <= b; st += N / 2) {
      for (var u = 0; u < N; u++) { re[u] = mono[st + u] * win[u]; im[u] = 0; }
      fft(re, im);
      for (var bin = 1; bin < N / 2; bin++) {
        var hz = bin * SR / N, pw = re[bin] * re[bin] + im[bin] * im[bin];
        if (hz >= 200 && hz <= 8000) { num += pw * hz; den += pw; }
        if (hz >= 60 && hz <= 6000) { all += pw; if (hz >= 1000) hi += pw; }
      }
    }
    return { centroid: den ? num / den : 0, presenceDb: 10 * Math.log10((hi + 1e-20) / (all + 1e-20)) };
  }
  function analyse(buf, res, id, o) {
    var L = buf.getChannelData(0), Rr = buf.getChannelData(1), PL = buf.getChannelData(2), PR = buf.getChannelData(3);
    var n = L.length, pk = 0, ppk = 0, clip = 0, ss = 0, act = 0;
    var mono = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var m = (L[i] + Rr[i]) * 0.5; mono[i] = m;
      var a = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (a > pk) pk = a; if (a > 0.989) clip++;
      var b = Math.max(Math.abs(PL[i]), Math.abs(PR[i])); if (b > ppk) ppk = b;
    }
    var kw = [kWeight(L), kWeight(Rr)];
    var lu = loudnessOf(kw);
    var B = 2400, blocks = [];
    for (var s = 0; s + B <= n; s += B) { var e = 0; for (var j = s; j < s + B; j++) e += mono[j] * mono[j]; blocks.push(e / B); }
    var bmax = Math.max.apply(null, blocks);
    blocks.forEach(function (e) { if (e > bmax * 0.001) { ss += e; act++; } });
    var rms = Math.sqrt(ss / Math.max(1, act));
    // CLICKS, as the instruments lab counts them: 1 ms blocks above 4 kHz; a
    // click stands 12× (21.6 dB) over the loudest block of the 30 ms on EACH
    // side; floor −100 dBFS (Chrome's own zero-snap sits under it)
    var hp = highpass4k(mono), H = 48, hf = [];
    for (var k = 0; k + H <= n; k += H) {
      var e2 = 0;
      for (var q = k; q < k + H; q++) e2 += hp[q] * hp[q];
      hf.push(Math.sqrt(e2 / H));
    }
    function maxOf(arr) { var mx = 0; for (var z0 = 0; z0 < arr.length; z0++) if (arr[z0] > mx) mx = arr[z0]; return mx; }
    var spikes = [], worst = null;
    for (var z = 30; z < hf.length - 30; z++) {
      if (hf[z] < 1e-5) continue;
      var ref = Math.max(maxOf(hf.slice(z - 30, z - 2)), maxOf(hf.slice(z + 3, z + 30)));
      if (hf[z] > ref * 12) {
        spikes.push(+(z * H / SR).toFixed(3));
        if (!worst || hf[z] > worst.hf) worst = { t: +(z * H / SR).toFixed(3), hf: hf[z], db: +db(hf[z]).toFixed(1), overDb: +db(hf[z] / (ref + 1e-20)).toFixed(1) };
      }
    }
    // the spectrogram, and the whole buffer's centroid
    var N = 4096, spec = [], win = new Float32Array(N); for (var w = 0; w < N; w++) win[w] = 0.5 - 0.5 * Math.cos(2 * Math.PI * w / N);
    var re = new Float32Array(N), im = new Float32Array(N), tnum = 0, tden = 0;
    for (var st = 0; st + N <= n; st += N / 2) {
      for (var u = 0; u < N; u++) { re[u] = mono[st + u] * win[u]; im[u] = 0; }
      fft(re, im);
      var col = new Float32Array(N / 2);
      for (var bin = 1; bin < N / 2; bin++) {
        var pw = re[bin] * re[bin] + im[bin] * im[bin], hz = bin * SR / N;
        col[bin] = pw;
        if (hz >= 200 && hz <= 8000) { tnum += pw * hz; tden += pw; }
      }
      spec.push(col);
    }
    var out = {
      id: id, room: o.room || room, seconds: +(n / SR).toFixed(2),
      lufs: +lu.I.toFixed(1), lufsShortMax: +lu.S.toFixed(1),
      peakDb: +db(pk).toFixed(2), rmsDb: +db(rms).toFixed(2), preChainPeakDb: +db(ppk).toFixed(2),
      clippedSamples: clip, transients: spikes.length, transientTimes: spikes.slice(0, 24), worstTransient: worst,
      centroidHz: Math.round(tnum / (tden || 1)), nodes: res.stats,
    };
    var spAll = spectrumOf(mono, 0, n), eLa = 0, eRa = 0;
    for (var x2 = 0; x2 < n; x2++) { eLa += L[x2] * L[x2]; eRa += Rr[x2] * Rr[x2]; }
    out.presenceDb = +spAll.presenceDb.toFixed(1);
    if (res.score) out.score = { exchanges: res.score.exchanges, farSide: res.score.farSide, gapLu: +res.score.shape.gapLu.toFixed(1), chorale: { source: res.score.chorale.source } };
    out.balanceDb = +(10 * Math.log10((eRa + 1e-12) / (eLa + 1e-12))).toFixed(1);
    // EVERY PHRASE of the dawn, as heard in the full render: its loudness
    // (integrated over the phrase), brightness, presence and side (the
    // output's left/right balance, dB; negative = left). A phrase's window
    // also holds the other choir's reverberant tail, so the clean far/near
    // comparison comes from each choir rendered alone (see check). The render
    // began at 0.1 s, as the score's t0.
    if (res.score) {
      var t0 = res.score.t0;
      out.phrases = res.score.phrases.filter(function (ph) { return !ph.joins; }).map(function (ph) {
        var a0 = Math.max(0, Math.floor((ph.t0 - t0 + 0.1) * SR)), b0 = Math.min(n, Math.floor((ph.t1 - t0 + 0.1) * SR));
        var eL = 0, eR = 0;
        for (var x = a0; x < b0; x++) { eL += L[x] * L[x]; eR += Rr[x] * Rr[x]; }
        var pl = loudnessOf(kw, a0, b0), sp = spectrumOf(mono, a0, b0);
        return { choir: ph.choir, line: ph.line + 1, at: +(ph.t0 - t0).toFixed(1), lufs: +pl.I.toFixed(1), centroidHz: Math.round(sp.centroid), presenceDb: +sp.presenceDb.toFixed(1), balanceDb: +(10 * Math.log10((eR + 1e-12) / (eL + 1e-12))).toFixed(1), repeat: !!ph.repeat };
      });
    }
    out._spec = spec; out._n = N;
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
  function drawSpectrogram(canvas, res) {
    var spec = res._spec, N = res._n, W = canvas.width, Hh = canvas.height, c2 = canvas.getContext("2d");
    var img = c2.createImageData(W, Hh), mx = 0;
    spec.forEach(function (col) { for (var b = 1; b < col.length; b++) if (col[b] > mx) mx = col[b]; });
    for (var x = 0; x < W; x++) {
      var col2 = spec[Math.min(spec.length - 1, Math.floor(x / W * spec.length))];
      for (var y = 0; y < Hh; y++) {
        var hz = 60 * Math.pow(200, 1 - y / (Hh - 1));
        var bin = Math.max(1, Math.min(N / 2 - 1, Math.round(hz * N / SR)));
        var v = 10 * Math.log10((col2[bin] + 1e-20) / mx);
        var a = Math.max(0, Math.min(1, (v + 70) / 70));
        var p = (y * W + x) * 4;
        img.data[p] = 245 - a * (245 - 30); img.data[p + 1] = 240 - a * (240 - 77); img.data[p + 2] = 228 - a * (228 - 59); img.data[p + 3] = 255;
      }
    }
    c2.putImageData(img, 0, 0);
  }

  // ---- the batteries (short: seconds, not hours) ------------------------------
  var refCache = {};
  function reference(rm) {
    rm = rm || room;
    if (refCache[rm]) return Promise.resolve(refCache[rm]);
    return check("reference", { room: rm }).then(function (r) { refCache[rm] = r; return r; });
  }
  // the choir at mf, each trombone at mf, and the dawn in this mode, beside
  // the organ reference (loudest 3 s: the instruments lab's calibration rule)
  function calibrate(o) {
    o = o || {};
    var out = {};
    return reference(o.room).then(function (ref) {
      out.reference = ref;
      return check("choir", o);
    }).then(function (r) {
      out.choir = r;
      return ["altoTrombone", "tenorTrombone", "bassTrombone"].reduce(function (p, inst) {
        return p.then(function () { return check("solo", Object.assign({}, o, { inst: inst, dyn: "mf" })).then(function (s) { out[inst] = s; }); });
      }, Promise.resolve());
    }).then(function () { return check("dawn", o); }).then(function (d) { out.dawn = d; return out; });
  }
  function all(o) {
    o = o || {};
    var rows = [];
    return reference(o.room).then(function (ref) {
      return MODES.reduce(function (p, m) {
        return p.then(function () { return check("dawn", Object.assign({}, o, { mode: m })).then(function (r) { r.mode = m; r.vsRef = +(r.lufsShortMax - ref.lufsShortMax).toFixed(1); rows.push(r); }); });
      }, Promise.resolve()).then(function () { return { reference: ref, rows: rows }; });
    });
  }
  // THE ODDS: plan() per Sunday, and a stand-in planner's mix (the engine's
  // measured shares: ordinary 38 %, fast 28 %, conference 22 %, jubilee 13 %;
  // bands 35 %; another prelude guest 11 %) — the harness measures the same
  // against the real planMeeting
  function odds(N) {
    N = N || 20000;
    var R0 = window.PJ2.Rand.stream(99).fork("lab:odds");
    var kinds = [["ordinary", 0.38], ["fast", 0.28], ["conference", 0.22], ["jubilee", 0.13]];
    var rows = {}, seated = 0, withBands = 0;
    for (var i = 1; i <= N; i++) {
      var kind = R0.pickW(kinds), bands = R0.chance(0.35), pre = R0.chance(0.11);
      var guests = []; if (bands) guests.push({ type: "bands", section: "doxology" }); if (pre) guests.push({ type: "steeples", section: "prelude" });
      var seat = G.plan({ n: i, kind: kind, sections: [{ type: "prelude", dur: 75 }], guests: guests }, window.PJ2.Rand.stream(i).fork(G.LABEL + i));
      var r = rows[kind] = rows[kind] || { n: 0, seated: 0 };
      r.n++;
      if (seat) { r.seated++; seated++; if (bands) withBands++; }
    }
    var sundays = Object.keys(G.ODDS.weight).map(function (k) { return { sunday: k, p: Math.min(G.ODDS.cap, G.ODDS.base * G.ODDS.weight[k]) }; });
    return { n: N, rate: seated / N, withBands: withBands, byKind: rows, sundays: sundays };
  }

  // ==========================================================================
  // THE PAGE
  // ==========================================================================
  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function val(id, d) { var e = document.getElementById(id); return e && e.value ? e.value : d; }
  function num(id, d) { var e = document.getElementById(id); var v = e ? parseFloat(e.value) : NaN; return isFinite(v) ? v : d; }
  function statLine(st) { return "nodes: " + st.created + " created · ≈" + st.peakLive + " live at peak (incl. " + st.standing + " standing)"; }
  function mmss(s) { var m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); }
  function measLine(r) {
    return "loudness " + r.lufs + " LUFS (loudest 3 s " + r.lufsShortMax + ")" + (r.vsRef != null ? " · " + (r.vsRef > 0 ? "+" : "") + r.vsRef + " LU against the organ" : "") +
      " · peak " + r.peakDb + " dBFS · before the chain " + r.preChainPeakDb + " dBFS · clipped " + r.clippedSamples +
      " · clicks " + r.transients + (r.transients ? " (first at " + r.transientTimes[0] + " s)" : "") + " · centroid " + r.centroidHz + " Hz";
  }
  function table(head, rows) {
    var wrap = el("div", "ktl-scroll"), t = el("table", "ktl-table"), tr = el("tr");
    head.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    t.appendChild(tr);
    rows.forEach(function (r) { var row = el("tr"); r.forEach(function (c) { row.appendChild(el("td", null, c == null ? "—" : String(c))); }); t.appendChild(row); });
    wrap.appendChild(t);
    return wrap;
  }
  function phraseTable(r) {
    return table(["phrase", "choir", "line", "at", "LUFS", "centroid", "over 1 kHz", "L/R dB"], r.phrases.map(function (p, i) {
      return [i + 1, p.choir + (p.repeat ? " (again)" : ""), p.line, mmss(p.at), p.lufs, p.centroidHz + " Hz", p.presenceDb + " dB", (p.balanceDb > 0 ? "+" : "") + p.balanceDb];
    }));
  }
  function antiphonyLine(a) {
    return "far (" + a.farSide + "): " + a.farLufs + " LUFS while playing, " + a.farCentroid + " Hz, " + a.farPresence + " dB over 1 kHz, L/R " + a.farBalance + " dB · near: " + a.nearLufs + " LUFS, " + a.nearCentroid + " Hz, " + a.nearPresence + " dB over 1 kHz, L/R " + a.nearBalance +
      " dB · the near choir " + a.gapLu + " LU louder (drawn: " + a.targetGapLu + "), with " + (a.nearPresence - a.farPresence).toFixed(1) + " dB more above 1 kHz, on the other side";
  }
  // the dawn's plan, as the score lays it out (pure: no audio needed)
  function planList(host) {
    var st = settings(), sc = G.score(material(st), streamFor(st.seed), 0);
    host.textContent = "";
    var sh = sc.shape, ch = sc.chorale;
    var vs = ch.voices.slice().reverse();                  // S, A, T, B: top down, as a score reads
    host.appendChild(el("p", "ktl-stat", ch.source + " · " + ch.mode + " · " + vs.join("") + " on " + vs.map(function (v) { return { S: "alto", A: "tenor", T: "tenor", B: "bass" }[v]; }).join(", ") + " trombones · " +
      (ch.octave ? (ch.octave < 0 ? "an octave down" : "an octave up") + " for the trombones · " : "") + sc.exchanges + " exchanges · " + sh.beatS.toFixed(2) + " s a note · the far choir to the " + sc.farSide +
      (sh.together ? " · joins the last chord" : "") + ((ch.mode === "aeolian" || ch.mode === "dorian") && sh.picardy ? " · ends major" : "") + " · " + Math.round(sc.end) + " s"));
    var ol = el("ol", "ktl-plan");
    sc.phrases.forEach(function (ph) {
      var li = el("li", ph.choir === "far" ? "far" : null, mmss(ph.t0) + " — " + (ph.joins ? "the far choir joins the last chord" : (ph.choir === "far" ? "the far choir, " + sc.farSide + ", plays" : "the near choir, " + sc.nearSide + ", answers") + " line " + (ph.line + 1) + (ph.repeat ? " again, softer" : "")));
      ol.appendChild(li);
    });
    host.appendChild(ol);
  }

  function mount() {
    var host = document.getElementById("ktl-cards");
    if (!host) return;
    // the chorale menu: the two sample paths, then every Earth tune with parts
    var srcSel = document.getElementById("ktl-source"), modeSel = document.getElementById("ktl-mode");
    var tunes = earthTunes();
    if (srcSel && tunes.length) {
      var og = document.createElement("optgroup"); og.label = "Earth tunes (their own mode)";
      tunes.forEach(function (h) { var op = el("option", null, (h.nameEn || h.id) + " · " + h.mode); op.value = h.id; og.appendChild(op); });
      srcSel.appendChild(og);
    }
    var planHosts = [];
    function refreshPlans() { planHosts.forEach(function (h) { try { planList(h); } catch (e) { h.textContent = "plan: " + e.message; } }); }
    function syncMode() {
      var s = srcSel.value, h = s.indexOf("earth:") === 0 && window.KOLOB.Tunes ? window.KOLOB.Tunes.byId(s) : null;
      if (h) { modeSel.value = h.mode; modeSel.disabled = true; } else modeSel.disabled = false;
      refreshPlans();
    }
    if (srcSel) srcSel.addEventListener("change", syncMode);
    if (modeSel) modeSel.addEventListener("change", refreshPlans);
    ["ktl-seed", "ktl-key"].forEach(function (id) { var e = document.getElementById(id); if (e) e.addEventListener("change", refreshPlans); });

    PHRASES.forEach(function (ph) {
      var card = el("section", "ktl-card");
      card.appendChild(el("h2", "ktl-name", ph.name));
      card.appendChild(el("p", "ktl-phrase", ph.phrase));
      var row = el("div", "ktl-row"), readout = el("p", "ktl-stat", ""), report = el("div", "ktl-report");
      var get = function () { return {}; };
      if (ph.id === "solo") {
        var inst = el("select"); [["altoTrombone", "alto trombone"], ["tenorTrombone", "tenor trombone"], ["bassTrombone", "bass trombone"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; inst.appendChild(op); });
        inst.value = "tenorTrombone";
        var dyn = el("select"); ["pp", "p", "mp", "mf", "f"].forEach(function (d) { var op = el("option", null, d); op.value = d; dyn.appendChild(op); }); dyn.value = "mp";
        var atk = el("select"); [["tongued", "soft-tongued"], ["soft", "soft (0.16 s)"], ["breath", "breath (0.42 s)"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; atk.appendChild(op); });
        [["instrument ", inst], ["dynamic ", dyn], ["attack ", atk]].forEach(function (lb) { var l = el("label", null, lb[0]); l.appendChild(lb[1]); row.appendChild(l); });
        get = function () { return { inst: inst.value, dyn: dyn.value, attack: atk.value }; };
      }
      if (ph.id === "choir") {
        var cdyn = el("select"); ["p", "mp", "mf", "f"].forEach(function (d) { var op = el("option", null, d); op.value = d; cdyn.appendChild(op); }); cdyn.value = "mf";
        var cl = el("label", null, "dynamic "); cl.appendChild(cdyn); row.appendChild(cl);
        get = function () { return { dyn: cdyn.value }; };
      }
      var btn = el("button", "ktl-play", "play"); btn.type = "button";
      btn.addEventListener("click", function () { play(ph.id, get()).then(function (res) { readout.textContent = statLine(res.stats); }); });
      row.appendChild(btn);
      if (ph.id === "dawn") {
        ["far", "near"].forEach(function (c) {
          var b2 = el("button", "ktl-play", c + " only"); b2.type = "button";
          b2.addEventListener("click", function () { play("dawn", { only: c }).then(function (res) { readout.textContent = statLine(res.stats); }); });
          row.appendChild(b2);
        });
      }
      var chk = el("button", "ktl-check", "check"); chk.type = "button";
      chk.addEventListener("click", function () {
        chk.disabled = true; report.textContent = "rendering offline…";
        var pr = ph.id === "reference" ? Promise.resolve(null) : reference();
        pr.then(function (ref) {
          return check(ph.id, get()).then(function (r) {
            if (ref) r.vsRef = +(r.lufsShortMax - ref.lufsShortMax).toFixed(1);
            chk.disabled = false; report.textContent = "";
            report.appendChild(el("p", "ktl-meas", "seed " + settings().seed + " · " + measLine(r)));
            if (r.antiphony) { report.appendChild(el("p", "ktl-meas", antiphonyLine(r.antiphony))); report.appendChild(phraseTable(r)); }
            var cv = el("canvas", "ktl-spec"); cv.width = 640; cv.height = 160; report.appendChild(cv);
            drawSpectrogram(cv, r);
            readout.textContent = statLine(r.nodes);
          });
        }).catch(function (err) { chk.disabled = false; report.textContent = "check failed: " + err; });
      });
      row.appendChild(chk);
      card.appendChild(row);
      if (ph.id === "dawn") { var ph2 = el("div", "ktl-planbox"); card.appendChild(ph2); planHosts.push(ph2); }
      card.appendChild(readout); card.appendChild(report);
      host.appendChild(card);
    });

    // calibration, six modes, and the odds
    var cal = el("section", "ktl-card");
    cal.appendChild(el("h2", "ktl-name", "Calibration"));
    cal.appendChild(el("p", "ktl-phrase", "the choir at mf, each trombone at mf, and this mode's dawn, set beside the organ reference (the loudest 3 s, as the instruments lab calibrates)"));
    var calRow = el("div", "ktl-row"), calB = el("button", "ktl-check", "calibrate"), calOut = el("div", "ktl-report");
    calB.type = "button"; calRow.appendChild(calB); cal.appendChild(calRow); cal.appendChild(calOut);
    calB.addEventListener("click", function () {
      calB.disabled = true; calOut.textContent = "rendering offline…";
      calibrate().then(function (o) {
        calB.disabled = false; calOut.textContent = "";
        var ref = o.reference.lufsShortMax;
        function d(r) { var x = +(r.lufsShortMax - ref).toFixed(1); return (x > 0 ? "+" : "") + x; }
        calOut.appendChild(table(["phrase", "LUFS", "loudest 3 s", "vs organ (LU)", "peak dBFS", "clipped", "clicks"], [
          ["v0.30 organ (reference)", o.reference.lufs, ref, "0", o.reference.peakDb, o.reference.clippedSamples, o.reference.transients],
          ["the choir at mf", o.choir.lufs, o.choir.lufsShortMax, d(o.choir), o.choir.peakDb, o.choir.clippedSamples, o.choir.transients],
          ["alto trombone at mf", o.altoTrombone.lufs, o.altoTrombone.lufsShortMax, d(o.altoTrombone), o.altoTrombone.peakDb, o.altoTrombone.clippedSamples, o.altoTrombone.transients],
          ["tenor trombone at mf", o.tenorTrombone.lufs, o.tenorTrombone.lufsShortMax, d(o.tenorTrombone), o.tenorTrombone.peakDb, o.tenorTrombone.clippedSamples, o.tenorTrombone.transients],
          ["bass trombone at mf", o.bassTrombone.lufs, o.bassTrombone.lufsShortMax, d(o.bassTrombone), o.bassTrombone.peakDb, o.bassTrombone.clippedSamples, o.bassTrombone.transients],
          ["the dawn (" + settings().mode + ")", o.dawn.lufs, o.dawn.lufsShortMax, d(o.dawn), o.dawn.peakDb, o.dawn.clippedSamples, o.dawn.transients],
        ]));
      }).catch(function (err) { calB.disabled = false; calOut.textContent = "calibration failed: " + err; });
    });
    host.appendChild(cal);

    var six = el("section", "ktl-card");
    six.appendChild(el("h2", "ktl-name", "All six modes"));
    six.appendChild(el("p", "ktl-phrase", "the dawn exchange rendered in every mode on this seed and source (an Earth tune keeps its own mode, so this uses the sample hymn)"));
    var sixRow = el("div", "ktl-row"), sixB = el("button", "ktl-check", "check all six"), sixOut = el("div", "ktl-report");
    sixB.type = "button"; sixRow.appendChild(sixB); six.appendChild(sixRow); six.appendChild(sixOut);
    sixB.addEventListener("click", function () {
      sixB.disabled = true; sixOut.textContent = "rendering six dawns offline…";
      var src = settings().source; if (src.indexOf("earth:") === 0) src = "sample";
      all({ source: src }).then(function (o) {
        sixB.disabled = false; sixOut.textContent = "";
        sixOut.appendChild(table(["mode", "exch.", "length", "loudest 3 s", "vs organ", "peak", "clicks", "clipped", "far LUFS", "near LUFS", "far >1k", "near >1k", "far L/R", "near L/R"], o.rows.map(function (r) {
          var a = r.antiphony;
          return [r.mode, a.exchanges, Math.round(r.seconds) + " s", r.lufsShortMax, (r.vsRef > 0 ? "+" : "") + r.vsRef, r.peakDb, r.transients, r.clippedSamples, a.farLufs, a.nearLufs, a.farPresence, a.nearPresence, a.farBalance, a.nearBalance];
        })));
      }).catch(function (err) { sixB.disabled = false; sixOut.textContent = "failed: " + err; });
    });
    host.appendChild(six);

    var od = el("section", "ktl-card");
    od.appendChild(el("h2", "ktl-name", "The odds"));
    od.appendChild(el("p", "ktl-phrase", "plan(): the chance per Sunday (before refusals), and 20,000 meetings from a stand-in planner with the engine's measured mix — never with the bands"));
    var odOut = el("div", "ktl-report");
    od.appendChild(odOut);
    try {
      var r0 = odds(20000);
      odOut.appendChild(el("p", "ktl-meas", "seated in " + (100 * r0.rate).toFixed(1) + " % of meetings · with the bands: " + r0.withBands + " · by kind: " +
        Object.keys(r0.byKind).map(function (k) { return k + " " + (100 * r0.byKind[k].seated / r0.byKind[k].n).toFixed(0) + " %"; }).join(", ")));
      odOut.appendChild(table(["Sunday", "chance"], r0.sundays.map(function (s) { return [s.sunday, (100 * s.p).toFixed(0) + " %"]; })));
    } catch (e) { odOut.textContent = "odds: " + e.message; }
    host.appendChild(od);

    refreshPlans();
    var stopB = document.getElementById("ktl-stop");
    if (stopB) stopB.addEventListener("click", stop);
    var roomSel = document.getElementById("ktl-room");
    if (roomSel) roomSel.addEventListener("change", function () { setRoom(roomSel.value); });
    var mEl = document.getElementById("ktl-meter");
    if (mEl) setInterval(function () {
      var m = meter(); if (!m) return;
      mEl.textContent = m.peak > -90 ? ("out " + m.peak.toFixed(1) + " dBFS peak") : "out —";
    }, 250);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  return { play: play, stop: stop, check: check, render: render, calibrate: calibrate, all: all, odds: odds, loudness: loudness, setRoom: setRoom, material: function (o) { return material(settings(o)); }, _P: P };
})();

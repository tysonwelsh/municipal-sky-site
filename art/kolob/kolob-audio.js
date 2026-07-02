// ============================================================================
// KOLOB 𐐗𐐄𐐢𐐉𐐒 — an American-utopian aleatoric hymn-engine (audio)
//
// A generative jukebox in the lineage of Prospero's Jukebox, Antariksh, ZANKYŌ
// and BARDO — but this one is close to home: the meetinghouse of a functioning
// colony out at the rim of Kolob's light. Bright where its siblings are dark.
// The congregation is out in the fields; the organ still plays prelude; the
// telegraph taps hymns toward home. Nothing here is derelict. Everything waits,
// hopeful, in enormous open air.
//
// The traditions flowing in (informing, never quoted):
//  · LDS hymnody + English dissenting psalmody — hymn METERS (8.6.8.6 …)
//    govern phrase structure; plagal (IV→I "amen") cadential gravity.
//  · Sacred Harp / camp-meeting — dispersed harmony (parallel fifths LEGAL and
//    lightly rewarded), open/third-less voicings, gapped scales, FUGING
//    entries, LINING-OUT call-and-response.
//  · Aaron Copland — open fifths, prairie strings, clarinet clarity.
//  · John Cage — chance as diegetic oracle (the LIAHONA), scheduled true
//    silence (the stillness), muted-tine prepared-piano timbre.
//  · La Monte Young (Bern, Idaho) — 5-limit just intonation over a fixed
//    tonic; pure sine drones that never stop. The ambient anchor.
//
// Architecture (what makes this one different from its siblings):
//  · A real FOUR-PART HARMONY engine: SATB voice-leading (common tones kept,
//    parallel octaves rejected, parallel fifths rewarded — the tradition).
//  · A hymn-meter PROSODY engine: melodic phrases are poured into metrical
//    lines with fermatas and breath at the line ends.
//  · THE AIR: a courtesy protocol. Melodic voices claim the open air before
//    speaking and defer while another holds it. Space is structural here —
//    as expansive as the frontier. If a motif never gets its turn in a
//    session, that is the piece working.
//  · Sections: prelude → invocation → hymn×n → testimony → sacrament →
//    doxology → postlude, conducted by THE CHORISTER; meetings drift across
//    META-SEASONS (ordinary / fast day / conference / jubilee).
//  · Everything seeded (mulberry32): a meeting is reproducible and shareable.
//
// Layers: organ, drone, choir, clarinet, harmonium, strings, bells, voice,
// telegraph, ambient.   Public surface: window.KolobAudio
// ============================================================================

window.KolobAudio = (function () {
  "use strict";

  // ----- Core audio graph -----
  var ctx = null;
  var masterGain = null, compressorNode = null, masterSat = null;
  // voicesBus sits between every layer path and the master. STOP silences it
  // and LEAVES it silent — long drone cycles keep their oscillators running
  // for up to 90s after a stop, and the siblings' pattern of restoring the
  // master gain after the fade let them come back from the dead. Not here.
  var voicesBus = null;
  // Two spaces: the TABERNACLE (vast, bright, famous pin-drop hall) and the
  // PARLOR (close, warm, a front room with a pump organ).
  var tabSend = null, tabDry = null, tabWet = null, tabConv = null, tabPre = null;
  var parSend = null, parDry = null, parWet = null, parConv = null, parPre = null;
  var sharedNoiseBuf = null;
  var NOISE_BUF_DURATION = 30;

  var playing = false;
  var masterVolume = 0.6;

  // ==========================================================================
  // SEEDED RNG — every choice flows through rng(); meetings are reproducible.
  // ==========================================================================
  var seed = (function () {
    try {
      if (typeof location !== "undefined" && location.search) {
        var m = location.search.match(/[?&]seed=(\d+)/);
        if (m) return (parseInt(m[1], 10) >>> 0) || 1847;
      }
    } catch (e) {}
    return (Date.now() % 0xffffffff) >>> 0;
  })();
  var rngState = seed;
  function mulberry32() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rng() { return mulberry32(); }
  function rnd(a, b) { return a + rng() * (b - a); }
  function rint(a, b) { return Math.floor(rnd(a, b + 1)); }
  function chance(p) { return rng() < p; }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function pickW(pool) {              // pool = [[value, weight], ...]
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i][1];
    var r = rng() * total;
    for (i = 0; i < pool.length; i++) { r -= pool[i][1]; if (r <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // TUNING — 5-limit just intonation over a fixed per-meeting tonic.
  // ==========================================================================
  // Everything is a ratio of F0 (La Monte Young's discipline). The COLLECTION
  // is the meeting's mode — hymnbook major, the English folk modes, and the
  // gapped folk-hymn scales. One gesture pool is authored in 7-degree space
  // and projected onto smaller collections via DEG_MAP.
  var F0 = 65;                                   // set per meeting in planMeeting()
  var ROOT_MULT = 4;                             // melodic root = F0 * 4 (~260 Hz)
  var COLLECTIONS = {
    ionian:     { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8], map: [0,1,2,3,4,5,6] },
    mixolydian: { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    dorian:     { ratios: [1, 9/8, 6/5, 4/3, 3/2, 5/3, 16/9], map: [0,1,2,3,4,5,6] },
    aeolian:    { ratios: [1, 9/8, 6/5, 4/3, 3/2, 8/5, 16/9], map: [0,1,2,3,4,5,6] },
    penta:      { ratios: [1, 9/8, 5/4, 3/2, 5/3],            map: [0,1,2,2,3,4,4] },
    hexa:       { ratios: [1, 9/8, 5/4, 4/3, 3/2, 5/3],       map: [0,1,2,3,4,5,5] },
  };
  var MODE_NAMES = Object.keys(COLLECTIONS);
  var mode = "ionian";
  function COL() { return COLLECTIONS[mode]; }
  function colN() { return COL().ratios.length; }
  // Project a 7-degree index (gestures, chord roots) into the current collection.
  function projDeg(d7) {
    var n = colN();
    if (n === 7) return d7;
    var oct = Math.floor(d7 / 7);
    var d = ((d7 % 7) + 7) % 7;
    return COL().map[d] + oct * n;
  }
  function degFreq(i) {                          // i = collection-degree index; octaves fold at n
    var n = colN();
    var oct = Math.floor(i / n);
    var d = ((i % n) + n) % n;
    return F0 * ROOT_MULT * COL().ratios[d] * Math.pow(2, oct);
  }
  // Ascending frequency table across ~3.5 octaves for nearest-pitch work.
  var SCALE = [];
  function rebuildScale() {
    SCALE.length = 0;
    var n = colN();
    for (var i = -2 * n; i <= 2 * n + 3; i++) SCALE.push({ deg: ((i % n) + n) % n, idx: i, freq: degFreq(i) });
  }
  function scaleIndexOf(i) {
    for (var k = 0; k < SCALE.length; k++) if (SCALE[k].idx === i) return k;
    return Math.floor(SCALE.length / 2);
  }
  function harm(h) { return F0 * h; }            // harmonic h of the fundamental
  // Gravity: do and sol. Phrases rest on do / mi / sol (collection-degree classes).
  function gravityDegs() { var n = colN(); return n === 5 ? { 0: true, 3: true } : { 0: true, 4: true }; }
  function restDegs() { var n = colN(); return n === 5 ? { 0: true, 2: true, 3: true } : { 0: true, 2: true, 4: true }; }

  // ==========================================================================
  // LAYERS + STATE
  // ==========================================================================
  var LAYERS = ["organ", "drone", "choir", "clarinet", "harmonium", "strings", "bells", "voice", "telegraph", "ambient"];
  var PARLOR_SPACE = { harmonium: true, telegraph: true };  // close and warm; the rest sing in the tabernacle
  var DRY_CLOSE = { voice: true };                          // the still small voice, near the ear

  var layerGains = {};
  var layerVolumes = { organ: 0.52, drone: 0.55, choir: 0.8, clarinet: 0.55, harmonium: 0.45, strings: 0.5, bells: 0.5, voice: 0.35, telegraph: 0.25, ambient: 0.5 };
  var layerMuted = {}; LAYERS.forEach(function (l) { layerMuted[l] = false; });
  var layerRate = {}; LAYERS.forEach(function (l) { layerRate[l] = 1; });

  var LAYER_PARAM_DEFAULTS = {
    organ:     { stops: 0.5, tremulant: 0.15, pedal: 0.6 },
    drone:     { presence: 0.5, fifth: 0.4 },
    choir:     { size: 3, vowel: 0.4, scoop: 0.5 },
    clarinet:  { vibrato: 0.4, pace: 1.0, grace: 0.5 },
    harmonium: { bellows: 0.5, reed: 0.5, shadow: 0.5 },
    strings:   { warmth: 0.5, lonesome: 0.4 },
    bells:     { ring: 0.55, tine: 0.5 },
    voice:     { presence: 0.4, syllables: 0.4 },
    telegraph: { clack: 0.5 },
    ambient:   {},
  };
  var layerParams = JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS));
  // telegraph 0.5: the wire should be an occasional visitor, not a speaker —
  // half the event density while its RATE slider still reads a clean 1.00x.
  var LAYER_RATE_TRIM = { telegraph: 0.5, bells: 0.7 };
  var LAYER_VOL_TRIM = { choir: 1.1, voice: 0.9 };

  // The tabernacle is brighter than Bardo's nave (hfDamp 0.8 vs 1.2) and
  // breathes slowly; the parlor is small, warm, and quick to forgive.
  var TAB_REVERB = { decay: 7.6, preDelay: 55, wet: 0.34, hfDamp: 0.8 };
  var PAR_REVERB = { decay: 1.6, preDelay: 18, wet: 0.22, hfDamp: 1.6 };

  // ==========================================================================
  // LISTENERS / LOG
  // ==========================================================================
  var noteListeners = [], eventListeners = [];
  function emitNote(layer, freq, startTime, duration) {
    for (var i = 0; i < noteListeners.length; i++) {
      try { noteListeners[i]({ layer: layer, freq: freq, startTime: startTime, duration: duration || 0 }); } catch (e) {}
    }
  }
  function emitEvent(ev) {
    ev.t = ctx ? ctx.currentTime : 0;
    for (var i = 0; i < eventListeners.length; i++) {
      try { eventListeners[i](ev); } catch (e) {}
    }
  }

  // ==========================================================================
  // INIT — signal chain
  //   layers → layerGain → tabSend or parSend → dry + (preDelay→convolver→wet)
  //   → master → masterSat (gentle tanh) → compressor → out.
  //   NO grit bus in Zion: brightness comes from voicing and the hall, not
  //   saturation. (The one dangerous component of the siblings, deleted.)
  // ==========================================================================
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    var noiseSamples = Math.floor(ctx.sampleRate * NOISE_BUF_DURATION);
    sharedNoiseBuf = ctx.createBuffer(1, noiseSamples, ctx.sampleRate);
    var nd = sharedNoiseBuf.getChannelData(0);
    for (var ni = 0; ni < noiseSamples; ni++) nd[ni] = Math.random() * 2 - 1;

    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    voicesBus = ctx.createGain();
    voicesBus.gain.setValueAtTime(1, ctx.currentTime);
    voicesBus.connect(masterGain);
    compressorNode = ctx.createDynamicsCompressor();
    compressorNode.threshold.setValueAtTime(-18, ctx.currentTime);
    compressorNode.knee.setValueAtTime(16, ctx.currentTime);
    compressorNode.ratio.setValueAtTime(3, ctx.currentTime);
    compressorNode.attack.setValueAtTime(0.015, ctx.currentTime);
    compressorNode.release.setValueAtTime(0.25, ctx.currentTime);
    masterSat = ctx.createWaveShaper();
    var msc = new Float32Array(1024);
    for (var mi = 0; mi < 1024; mi++) { var mx = (mi / 1023) * 2 - 1; msc[mi] = Math.tanh(mx * 1.15) / Math.tanh(1.15); }
    masterSat.curve = msc; masterSat.oversample = "2x";
    masterGain.connect(masterSat);
    masterSat.connect(compressorNode);
    compressorNode.connect(ctx.destination);

    var effectsReady = false;
    try {
      tabSend = ctx.createGain(); tabDry = ctx.createGain(); tabWet = ctx.createGain();
      tabConv = ctx.createConvolver(); tabPre = ctx.createDelay(0.25);
      tabSend.connect(tabDry); tabSend.connect(tabPre); tabPre.connect(tabConv); tabConv.connect(tabWet);
      tabDry.connect(voicesBus); tabWet.connect(voicesBus);
      buildIR(tabConv, tabPre, tabWet, TAB_REVERB, true);

      parSend = ctx.createGain(); parDry = ctx.createGain(); parWet = ctx.createGain();
      parConv = ctx.createConvolver(); parPre = ctx.createDelay(0.25);
      parSend.connect(parDry); parSend.connect(parPre); parPre.connect(parConv); parConv.connect(parWet);
      parDry.connect(voicesBus); parWet.connect(voicesBus);
      buildIR(parConv, parPre, parWet, PAR_REVERB, false);

      effectsReady = true;
    } catch (e) {
      tabSend = ctx.createGain(); tabSend.connect(voicesBus); parSend = tabSend;
      if (window.console) console.warn("Kolob effects init failed, dry fallback:", e);
    }

    for (var li = 0; li < LAYERS.length; li++) {
      var layer = LAYERS[li];
      var node = ctx.createGain();
      node.gain.setValueAtTime(1, ctx.currentTime);
      if (DRY_CLOSE[layer] && effectsReady) {
        node.connect(voicesBus);                               // intimate: mostly dry…
        var whisper = ctx.createGain();
        whisper.gain.setValueAtTime(0.3, ctx.currentTime);
        node.connect(whisper); whisper.connect(tabSend);       // …with a breath of the hall
      }
      else if (PARLOR_SPACE[layer] && effectsReady) node.connect(parSend);
      else node.connect(tabSend);
      layerGains[layer] = node;
      applyLayerGain(layer);
    }
  }

  function buildIR(conv, pre, wet, R, breathe) {
    var len = Math.floor(ctx.sampleRate * R.decay);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = buf.getChannelData(ch);
      var ph1 = Math.random() * Math.PI * 2;
      for (var i = 0; i < len; i++) {
        var t = i / ctx.sampleRate;
        var env = Math.exp(-2.2 * t / R.decay);
        var hf = Math.exp(-(R.hfDamp * 2.6) * t / R.decay);
        // The tabernacle breathes — a slow swell ripple, the hall inhaling.
        var color = breathe ? 1 + 0.07 * Math.sin(2 * Math.PI * 0.5 * t + ph1) : 1;
        data[i] = (Math.random() * 2 - 1) * env * hf * color;
      }
    }
    conv.buffer = buf;
    pre.delayTime.setValueAtTime(R.preDelay / 1000, ctx.currentTime);
    wet.gain.setValueAtTime(R.wet, ctx.currentTime);
  }

  // ==========================================================================
  // SCHEDULING + HELPERS
  // ==========================================================================
  var timers = new Set();
  function scheduleLayer(fn, baseMs, layer) {
    var ms = baseMs / (getRate(layer) || 1);
    var id = setTimeout(function () { timers.delete(id); if (playing) fn(); }, ms);
    timers.add(id);
  }
  function scheduleRaw(fn, ms) {
    var id = setTimeout(function () { timers.delete(id); if (playing) fn(); }, ms);
    timers.add(id);
  }
  function clearAllTimers() { timers.forEach(function (id) { clearTimeout(id); }); timers.clear(); }

  var panPool = {};
  function panAt(layer, p) {
    var pool = panPool[layer];
    if (!pool) {
      // Wider positions than the siblings: the frontier is broad.
      pool = panPool[layer] = [-0.65, 0, 0.65].map(function (pp) {
        var sp = ctx.createStereoPanner(); sp.pan.setValueAtTime(pp, ctx.currentTime); sp.connect(layerGains[layer]); return sp;
      });
    }
    var cl = p < -1 ? -1 : (p > 1 ? 1 : p);
    return pool[cl < -0.2 ? 0 : cl > 0.2 ? 2 : 1];
  }
  function getRate(layer) {
    var base = (layerRate[layer] != null ? layerRate[layer] : 1);
    var trim = LAYER_RATE_TRIM[layer] != null ? LAYER_RATE_TRIM[layer] : 1;
    return base * trim;
  }
  function getLayerParam(layer, key, fallback) {
    if (layerParams[layer] && layerParams[layer][key] != null) return layerParams[layer][key];
    return fallback;
  }
  function applyLayerGain(layer) {
    var node = layerGains[layer];
    if (!node) return;
    var trim = LAYER_VOL_TRIM[layer] != null ? LAYER_VOL_TRIM[layer] : 1;
    node.gain.setValueAtTime(layerMuted[layer] ? 0 : layerVolumes[layer] * trim, ctx.currentTime);
  }
  function noiseSource() {
    var n = ctx.createBufferSource();
    n.buffer = sharedNoiseBuf; n.loop = true;
    n.loopStart = 0; n.loopEnd = NOISE_BUF_DURATION;
    return n;
  }
  function noiseOffset() { return rng() * 20; }
  // Click-safe gain envelope: always from true zero, linear on/off ramps.
  function env(g, t, pts) {
    g.gain.setValueAtTime(0, t);
    var tt = t;
    for (var i = 0; i < pts.length; i++) { tt += pts[i][0]; g.gain.linearRampToValueAtTime(pts[i][1], tt); }
    return tt;
  }

  // ==========================================================================
  // THE AIR — the courtesy protocol. This engine's answer to clutter.
  // ==========================================================================
  // A melodic voice claims the air for the length of its phrase plus a margin
  // of silence after; other melodic voices defer and try again later. In hymn
  // sections two voices may share the air (lining-out is a conversation);
  // everywhere else, one speaker at a time and real space between speeches.
  // The landscape voices (organ, drone, strings) never claim it — they are
  // the prairie the speeches happen in.
  var air = { busyUntil: 0, holders: 0 };
  function airLimit() { return C.section === "hymn" || C.section === "doxology" ? 2 : 1; }
  function airFree() {
    if (!ctx) return true;
    if (ctx.currentTime >= air.busyUntil) { air.holders = 0; return true; }
    return air.holders < airLimit();
  }
  function claimAir(durS, marginS) {
    if (!ctx) return;
    var until = ctx.currentTime + durS + (marginS != null ? marginS : rnd(3, 8));
    if (ctx.currentTime >= air.busyUntil) air.holders = 1;
    else air.holders++;
    air.busyUntil = Math.max(air.busyUntil, until);
  }

  // ==========================================================================
  // HARMONY — the four-part engine. No sibling has this.
  // ==========================================================================
  // Chords are stacked diatonic triads in 7-degree space (root, +2, +4),
  // projected into the current collection — so the same machine yields major,
  // minor and modal color as the mode changes. Roots move by a weighted
  // grammar with PLAGAL GRAVITY (IV→I, the amen). Voicing keeps common tones,
  // rejects parallel octaves, and lightly REWARDS parallel fifths — dispersed
  // harmony, the Sacred Harp sound, asserted rather than forbidden.
  var Harmony = (function () {
    var ROMAN = ["I", "ii", "iii", "IV", "V", "vi", "vii"];
    var CHORD_MOVES = {                 // row = current root (7-space); [nextRoot, weight]
      0: [[3, 3], [4, 2], [5, 2], [1, 1], [2, 0.5], [0, 1.5]],
      1: [[4, 4], [3, 2.5], [0, 2], [5, 1.5]],
      2: [[5, 3.5], [3, 3], [1, 2], [0, 1.5]],
      3: [[0, 4.5], [4, 2], [1, 1.5], [5, 1], [3, 1]],     // IV→I: the amen leads home
      4: [[0, 4], [5, 2.5], [3, 1.5], [4, 1], [2, 0.5]],
      5: [[3, 3], [1, 2.5], [4, 2], [0, 1.5], [2, 1]],
      6: [[0, 3], [5, 2]],
    };
    // Voice ranges as absolute collection-index windows (rebuilt per mode).
    function ranges() {
      var n = colN();
      return {
        b: [-n - 2, 1],
        t: [-Math.ceil(n * 0.6), n - 1],
        a: [0, n + 2],
        s: [Math.floor(n * 0.45), 2 * n + 1],
      };
    }
    var cur = null;                     // { root, tones{}, voicing[b,t,a,s], freqs[], open }
    var parallelFifths = 0;             // counted, reported — they should be > 0

    function toneClasses(root7, open) {
      var n = colN(), set = {};
      set[((projDeg(root7) % n) + n) % n] = "root";
      if (!open) set[((projDeg(root7 + 2) % n) + n) % n] = "third";
      set[((projDeg(root7 + 4) % n) + n) % n] = "fifth";
      return set;
    }
    // The one 5-limit wolf: over 9/8 re, the ii chord's fifth (re–la) is
    // 40/27. When the sounding chord is ii, re is played at 10/9 instead —
    // a tiny adaptive-tuning override, inaudible as a shift, pure as a fifth.
    function chordFreq(idx, root7) {
      var n = colN();
      var d = ((idx % n) + n) % n;
      var oct = Math.floor(idx / n);
      var ratio = COL().ratios[d];
      if (root7 === 1 && n >= 6 && d === ((projDeg(1) % n) + n) % n && Math.abs(ratio - 9/8) < 1e-9) ratio = 10/9;
      return F0 * ROOT_MULT * ratio * Math.pow(2, oct);
    }
    function classOf(idx) { var n = colN(); return ((idx % n) + n) % n; }
    function nearestOfClass(from, classes, lo, hi, dir) {
      // nearest absolute index whose class is a chord tone, within [lo,hi];
      // dir (optional) restricts search direction (for contrary motion).
      for (var off = 0; off <= colN() + 2; off++) {
        var cands = off === 0 ? [from] : (dir === 1 ? [from + off] : dir === -1 ? [from - off] : [from - off, from + off]);
        for (var i = 0; i < cands.length; i++) {
          var c = cands[i];
          if (c < lo || c > hi) continue;
          if (classes[classOf(c)]) return c;
        }
      }
      return null;
    }
    function foldRatio(r) { while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; }
    function near(a, b, cents) { return Math.abs(1200 * Math.log2(a / b)) < (cents || 22); }

    // Score a candidate voicing against the previous one. Returns null = illegal.
    function scoreVoicing(prev, next, classes, wantThird) {
      var R = ranges(), keys = ["b", "t", "a", "s"], lims = [R.b, R.t, R.a, R.s];
      var i, j, score = 0, fifthsHere = 0;
      for (i = 0; i < 4; i++) {
        if (next[i] == null) return null;
        if (next[i] < lims[i][0] || next[i] > lims[i][1]) return null;
        if (i > 0 && next[i] <= next[i - 1]) return null;          // no crossing / unison stacking
        score += Math.abs(next[i] - prev[i]);                      // motion economy
      }
      var thirdSeen = false, rootCount = 0;
      for (i = 0; i < 4; i++) {
        var role = classes[classOf(next[i])];
        if (role === "third") thirdSeen = true;
        if (role === "root") rootCount++;
      }
      if (wantThird && !thirdSeen) score += 2.5;
      if (rootCount === 0) return null;
      score -= rootCount * 0.3;                                    // doubling: root > fifth > third
      // parallel motion checks on actual frequency ratios (mode-agnostic)
      for (i = 0; i < 4; i++) {
        for (j = i + 1; j < 4; j++) {
          var moved = next[i] !== prev[i] && next[j] !== prev[j];
          if (!moved) continue;
          var sameDir = (next[i] - prev[i]) * (next[j] - prev[j]) > 0;
          if (!sameDir) continue;
          var r0 = foldRatio(degFreq(prev[j]) / degFreq(prev[i]));
          var r1 = foldRatio(degFreq(next[j]) / degFreq(next[i]));
          if (near(r0, 1, 12) && near(r1, 1, 12)) return null;     // parallel octaves/unisons: rejected
          if (near(r0, 1.5) && near(r1, 1.5)) { score -= 1.6; fifthsHere++; }  // parallel fifths: rewarded
        }
      }
      return { score: score, fifths: fifthsHere };
    }
    function defaultVoicing(root7, classes) {
      // a fresh seat: bass on the root an octave down, upper voices stacked near
      var n = colN();
      var rootIdx = projDeg(root7);
      var b = ((rootIdx % n) + n) % n - n;
      var t = nearestOfClass(b + Math.round(n * 0.6), classes, b + 2, b + n + 2);
      var a = nearestOfClass(t + Math.round(n * 0.5), classes, t + 1, t + n);
      var s = nearestOfClass(a + Math.round(n * 0.5), classes, a + 1, a + n + 2);
      return [b, t, a, s];
    }
    function voice(root7, opts) {
      opts = opts || {};
      var bright = C.meeting ? MEETINGS[C.meeting.activity].bright : 0.5;
      var open = opts.open != null ? opts.open : chance(0.25 + 0.35 * (1 - bright));
      var classes = toneClasses(root7, open);
      var R = ranges();
      var prev = cur ? cur.voicing.slice() : null;
      var next;
      if (!prev) next = defaultVoicing(root7, classes);
      else {
        // candidates: nearest-motion / contrary soprano / open-dropped alto
        var n = colN();
        var rootIdx = projDeg(root7);
        var bClasses = {}; bClasses[classOf(rootIdx)] = "root";
        if (!opts.cadence && chance(0.1)) bClasses[classOf(projDeg(root7 + 4))] = "fifth";  // inversion, never at cadence
        var b = nearestOfClass(prev[0], bClasses, R.b[0], R.b[1]);
        var cands = [];
        var c1 = [b,
          nearestOfClass(prev[1], classes, R.t[0], R.t[1]),
          nearestOfClass(prev[2], classes, R.a[0], R.a[1]),
          nearestOfClass(prev[3], classes, R.s[0], R.s[1])];
        cands.push(c1);
        var bassDir = b === prev[0] ? 0 : (b > prev[0] ? 1 : -1);
        if (bassDir !== 0) {
          var sContr = nearestOfClass(prev[3] - bassDir, classes, R.s[0], R.s[1], -bassDir);
          cands.push([b,
            nearestOfClass(prev[1], classes, R.t[0], R.t[1]),
            nearestOfClass(prev[2], classes, R.a[0], R.a[1]),
            sContr != null ? sContr : c1[3]]);
        }
        if (c1[2] != null && c1[2] - n >= R.a[0]) {
          cands.push([b, c1[1], c1[2] - n, c1[3]]);              // dropped alto: the dispersed spread
        }
        // a PLANING candidate: when two upper voices already stand a fifth
        // apart, offer to carry the pair along with the bass — Sacred Harp
        // parallel motion, legal here and welcome
        var bd = b - prev[0];
        if (bd !== 0) {
          for (var pi2 = 1; pi2 < 3; pi2++) {
            var r5 = foldRatio(degFreq(prev[pi2 + 1]) / degFreq(prev[pi2]));
            if (near(r5, 1.5)) {
              var cp = c1.slice();
              cp[pi2] = prev[pi2] + bd;
              cp[pi2 + 1] = prev[pi2 + 1] + bd;
              if (classes[classOf(cp[pi2])] && classes[classOf(cp[pi2 + 1])]) cands.push(cp);
              break;
            }
          }
        }
        var best = null, bestScore = 1e9, bestFifths = 0;
        for (var ci = 0; ci < cands.length; ci++) {
          var sc = scoreVoicing(prev, cands[ci], classes, !open);
          if (sc && sc.score < bestScore) { best = cands[ci]; bestScore = sc.score; bestFifths = sc.fifths; }
        }
        next = best || defaultVoicing(root7, classes);
        if (bestFifths > 0) parallelFifths += bestFifths;
      }
      var freqs = next.map(function (idx) { return chordFreq(idx, root7); });
      cur = { root: root7, tones: classes, voicing: next, freqs: freqs, open: open };
      emitEvent({
        cat: "harmony",
        label: "♮ " + ROMAN[root7] + (open ? " open" : ""),
        detail: "b" + next[0] + " t" + next[1] + " a" + next[2] + " s" + next[3] +
          (parallelFifths ? " · 5ths " + parallelFifths : ""),
      });
      return cur;
    }
    function advance(opts) {
      opts = opts || {};
      var from = cur ? cur.root : 0;
      var pool = (CHORD_MOVES[from] || CHORD_MOVES[0]).map(function (m) { return m.slice(); });
      if (C.section === "doxology") pool.forEach(function (m) { if (from === 3 && m[0] === 0) m[1] *= 2.5; });
      if (C.section === "testimony") pool.forEach(function (m) { if (m[0] !== from) m[1] *= 0.5; });
      var root7 = opts.root != null ? opts.root : pickW(pool);
      return voice(root7, opts);
    }
    // A cadence is a two-chord act. Plagal is the house style — the amen.
    function cadence(kind) {
      var seq = kind === "authentic" ? [4, 0] : kind === "half" ? [cur ? cur.root : 0, 4] : [3, 0];
      var out = [];
      for (var i = 0; i < seq.length; i++) out.push(voice(seq[i], { cadence: true, open: i === seq.length - 1 ? chance(0.55) : false }));
      emitEvent({ cat: "harmony", label: "∴ " + (kind || "plagal") + " cadence", detail: kind === "half" ? "resting on the dominant" : "amen" });
      return out;
    }
    // Set an SATB frame under a melodic line (the lining-out answer): the
    // soprano is pinned to the line; the machine voices beneath it.
    function harmonize(lineNotes) {
      var out = [], prevRoot = cur ? cur.root : 0;
      for (var i = 0; i < lineNotes.length; i++) {
        var idx = projDeg(lineNotes[i].deg);
        var cls = classOf(idx);
        // candidate roots whose triads contain this melody class
        var roots = [];
        for (var r = 0; r < 7; r++) {
          var tc = toneClasses(r, false);
          if (tc[cls]) {
            var w = 1;
            var moves = CHORD_MOVES[prevRoot] || [];
            for (var mi = 0; mi < moves.length; mi++) if (moves[mi][0] === r) w = moves[mi][1];
            roots.push([r, w]);
          }
        }
        var root7 = roots.length ? pickW(roots) : 0;
        var ch = voice(root7, { open: chance(0.3) });
        // pin the soprano: replace with the melody index (kept within range by octave)
        var R = ranges();
        var sIdx = idx;
        while (sIdx < R.s[0]) sIdx += colN();
        while (sIdx > R.s[1]) sIdx -= colN();
        ch = { root: ch.root, tones: ch.tones, open: ch.open, voicing: [ch.voicing[0], ch.voicing[1], ch.voicing[2], sIdx] };
        ch.freqs = ch.voicing.map(function (ix) { return chordFreq(ix, ch.root); });
        cur = ch;
        out.push({ chord: ch, dur: lineNotes[i].dur });
        prevRoot = root7;
      }
      return out;
    }
    function chordToneClasses() {
      if (!cur) return null;
      var out = {}; for (var k in cur.tones) out[k] = true;
      return out;
    }
    function reset() { cur = null; }
    return {
      advance: advance, voice: voice, cadence: cadence, harmonize: harmonize,
      current: function () { return cur; },
      chordTones: chordToneClasses,
      fifthCount: function () { return parallelFifths; },
      reset: reset,
    };
  })();

  // ==========================================================================
  // PROSODY — hymn meters. A verse is lines of counted syllables; the melody
  // is POURED into the line; the last syllable is a fermata on a rest tone.
  // ==========================================================================
  var METERS = {
    "CM":    [8, 6, 8, 6],              // Common Meter
    "LM":    [8, 8, 8, 8],              // Long Meter
    "SM":    [6, 6, 8, 6],              // Short Meter
    "87.87": [8, 7, 8, 7],
    "CMD":   [8, 6, 8, 6, 8, 6, 8, 6],  // doubled — conference and jubilee verses
  };
  var Prosody = (function () {
    function nearestRest7(d) {
      var REST7 = { 0: true, 2: true, 4: true };
      var dd = ((d % 7) + 7) % 7;
      if (REST7[dd]) return d;
      for (var off = 1; off <= 3; off++) {
        if (REST7[(((d + off) % 7) + 7) % 7]) return d + off;
        if (REST7[(((d - off) % 7) + 7) % 7]) return d - off;
      }
      return d;
    }
    // Fit a motif to exactly n syllable-notes (7-degree space).
    function pourIntoLine(motif, n) {
      var src = motif.notes.map(function (x) { return { deg: x.deg, durBeats: x.durBeats }; });
      var out;
      if (src.length === n) out = src;
      else if (src.length > n) {
        // elide the shortest interior notes — keep the head and the goal
        out = src.slice();
        while (out.length > n) {
          var kill = -1, min = 1e9;
          for (var i = 1; i < out.length - 1; i++) if (out[i].durBeats < min) { min = out[i].durBeats; kill = i; }
          if (kill < 0) break;
          out.splice(kill, 1);
        }
      } else {
        // extend by stepwise sequence toward the line's rest tone
        out = src.slice();
        var goal = nearestRest7(out[out.length - 1].deg);
        while (out.length < n) {
          var lastD = out[out.length - 1].deg;
          var step = goal === lastD ? pick([-1, 1]) : (goal > lastD ? 1 : -1);
          if (chance(0.2)) step *= -1;                           // a wayward syllable
          out.push({ deg: lastD + step, durBeats: pickW([[1, 5], [1.5, 2], [0.5, 2]]) });
        }
      }
      // the fermata: last syllable lands on a rest tone and holds
      var tail = out[out.length - 1];
      tail.deg = nearestRest7(tail.deg);
      // the fermata breathes but never stalls: an augmented final note times a
      // big multiplier was producing 20-beat holds. Absolute cap at 5 beats.
      tail.durBeats = Math.min(5, Math.max(2.2, tail.durBeats * rnd(1.4, 2)));
      tail.fermata = true;
      return out;
    }
    return { pourIntoLine: pourIntoLine, nearestRest7: nearestRest7 };
  })();

  // ==========================================================================
  // THE CHORISTER — meeting conductor.
  // ==========================================================================
  // A meeting is a seeded plan of sections. Sections are unmetered inside;
  // their joints are organ cadences and a single bell — not percussion.
  // Every layer reads C (the conductor state) when it fires.
  var SECTION_TYPES = ["prelude", "invocation", "hymn", "testimony", "sacrament", "doxology", "postlude"];
  // The meeting-activity axis: what kind of Sunday is it?
  var MEETINGS = {
    ordinary:   { silenceMul: 1.0, hymns: 2, bells: 0.5, choirSize: 3, bright: 0.5,  meterW: [["CM", 3], ["LM", 2], ["SM", 2], ["87.87", 2], ["CMD", 1]] },
    fast:       { silenceMul: 1.7, hymns: 1, bells: 0.2, choirSize: 2, bright: 0.3,  meterW: [["CM", 3], ["SM", 3], ["LM", 2], ["87.87", 1], ["CMD", 0.5]] },
    conference: { silenceMul: 0.75, hymns: 3, bells: 0.8, choirSize: 4, bright: 0.75, meterW: [["CMD", 3], ["87.87", 3], ["CM", 2], ["LM", 2], ["SM", 1]] },
    jubilee:    { silenceMul: 0.6, hymns: 3, bells: 1.0, choirSize: 4, bright: 0.9,  meterW: [["CMD", 3], ["87.87", 2.5], ["CM", 2], ["LM", 1.5], ["SM", 1]] },
  };
  var C = {
    meetingNum: 0,
    meeting: null,               // { activity }
    plan: [],
    si: 0,
    section: "prelude",
    meter: "CM",                 // current hymn's meter
    sectionStart: 0,
    sectionDur: 120,
    jointing: false,
    fugingFired: false,
    fugingPlanned: false,
    fugingUntil: 0,
    hushUntil: 0,
    verseLine: 0,
  };
  // META-SEASONS — the journey across meetings. A slow seeded cosine swings
  // the colony from quiet fast-day troughs to conference/jubilee peaks over
  // 4-7 meetings, the way ZANKYŌ's meta-arc drifts its cycles dark and back.
  var metaPhase = 0, metaPeriod = 5, seasonPos = 0;

  function planMeeting() {
    C.meetingNum++;
    if (C.meetingNum === 1) { metaPeriod = rnd(4, 7); metaPhase = rnd(0, 0.3); }
    else { metaPhase += 1 / metaPeriod; if (metaPhase >= 1) { metaPhase -= 1; metaPeriod = rnd(4, 7); } }
    seasonPos = 0.5 - 0.5 * Math.cos(2 * Math.PI * metaPhase);   // 0 trough … 1 festival peak

    F0 = rnd(58, 74);
    var activity = pickW([
      ["ordinary", 3],
      ["fast", 1 + 2.5 * (1 - seasonPos)],
      ["conference", 0.6 + 2.6 * seasonPos],
      ["jubilee", 0.2 + 1.8 * seasonPos],
    ]);
    C.meeting = { activity: activity };
    var A = MEETINGS[activity];
    // Mode lottery, tilted bright or modal by the kind of Sunday.
    var b = A.bright;
    mode = pickW([
      ["ionian", 2 + 2 * b],
      ["penta", 2.5],
      ["hexa", 1.5],
      ["mixolydian", 1 + b],
      ["dorian", 1.4 - b * 0.8],
      ["aeolian", 1.2 - b * 0.8],
    ]);
    rebuildScale();
    Harmony.reset();

    var plan = [];
    plan.push({ type: "prelude", dur: rnd(60, 90) });
    plan.push({ type: "invocation", dur: rnd(60, 100) });
    for (var h = 0; h < A.hymns; h++) {
      plan.push({ type: "hymn", dur: rnd(120, 180), meter: pickW(A.meterW) });
    }
    plan.push({ type: "testimony", dur: rnd(110, 160) });
    plan.push({ type: "sacrament", dur: rnd(100, 150) });
    plan.push({ type: "doxology", dur: rnd(70, 110) });
    plan.push({ type: "postlude", dur: rnd(40, 70) });
    // THE ORDER IS NOT FIXED — seeded mutations keep the ritual itself
    // aleatoric. Some Sundays have no testimony; some hold an interlude of
    // organ and tines between hymns; testimony and sacrament may trade
    // places; a jubilee may sing the doxology twice.
    if (chance(0.25)) {
      for (var ti = plan.length - 1; ti >= 0; ti--) if (plan[ti].type === "testimony") plan.splice(ti, 1);
    }
    if (A.hymns >= 2 && chance(0.15)) {
      for (var hi = 0; hi < plan.length; hi++) {
        if (plan[hi].type === "hymn") { plan.splice(hi + 1, 0, { type: "interlude", dur: rnd(50, 80) }); break; }
      }
    }
    if (chance(0.1)) {
      var tIdx = -1, sIdx = -1;
      for (var pi = 0; pi < plan.length; pi++) {
        if (plan[pi].type === "testimony") tIdx = pi;
        if (plan[pi].type === "sacrament") sIdx = pi;
      }
      if (tIdx >= 0 && sIdx >= 0) { var tmp = plan[tIdx]; plan[tIdx] = plan[sIdx]; plan[sIdx] = tmp; }
    }
    if (activity === "jubilee" && chance(0.5)) {
      plan.splice(plan.length - 1, 0, { type: "doxology", dur: rnd(40, 60) });
    }
    C.plan = plan;
    C.si = 0;
    Motif.newMeeting();
    enterSection(0);
    // The Liahona: the load-bearing draws, surfaced as the oracle's pointing.
    emitEvent({
      cat: "liahona", label: "⌖ the Liahona points",
      detail: mode + " · " + activity + " · F0 " + F0.toFixed(1) + " Hz",
    });
    emitEvent({
      cat: "meeting", label: "☀ meeting " + C.meetingNum,
      detail: "F0 " + F0.toFixed(1) + " Hz · " + mode + " · " + activity + " · season " + seasonPos.toFixed(2),
    });
  }

  function enterSection(i) {
    var s = C.plan[i];
    C.si = i;
    C.section = s.type;
    C.sectionStart = ctx ? ctx.currentTime : 0;
    C.sectionDur = s.dur;
    C.jointing = false;
    C.fugingFired = false;
    C.fugingUntil = 0;
    // the fuging entry is an EVENT, not a fixture — some hymns are meadows
    C.fugingPlanned = s.type === "hymn" && chance(0.6);
    if (s.type === "hymn") C.verseLine = 0;
    if (s.type === "hymn" && s.meter) {
      C.meter = s.meter;
      emitEvent({ cat: "liahona", label: "⌖ the meter is given", detail: C.meter + " — " + METERS[C.meter].join(".") });
    }
    // the doxology SUNRISE: a dark-mode meeting may lift into major at the
    // last — rare, and the most audible surprise the engine owns
    if (s.type === "doxology" && (mode === "aeolian" || mode === "dorian") && chance(0.4)) {
      mode = pick(["ionian", "mixolydian"]);
      rebuildScale();
      Harmony.reset();
      emitEvent({
        cat: "meeting", label: "☀ sunrise",
        detail: "F0 " + F0.toFixed(1) + " Hz · " + mode + " · " + (C.meeting ? C.meeting.activity : "") + " · season " + seasonPos.toFixed(2),
      });
    }
    emitEvent({ cat: "section", label: "§ " + s.type.toUpperCase(), detail: (s.type === "hymn" ? C.meter + " · " : "") + Math.round(s.dur) + "s" });
    Motif.onSection(s.type);
  }

  function localArc() {
    if (!ctx) return 0;
    return Math.max(0, Math.min(1, (ctx.currentTime - C.sectionStart) / C.sectionDur));
  }
  // Global intensity 0..1 — ceilings kept LOW. This is open country; even the
  // doxology's full gathering leaves sky above it.
  function intensity() {
    var x = localArc();
    switch (C.section) {
      case "prelude": return 0.12 + 0.18 * smooth(x);
      case "invocation": return 0.06 + 0.08 * x;
      case "hymn": {
        var base = 0.28 + 0.34 * (x < 0.75 ? smooth(x / 0.75) : 1 - 0.25 * smooth((x - 0.75) / 0.25));
        if (ctx && ctx.currentTime < C.fugingUntil) base += 0.12;
        return Math.min(0.75, base);
      }
      case "testimony": return 0.2;
      case "interlude": return 0.14 + 0.08 * smooth(x);
      case "sacrament": return 0.05;
      case "doxology": return Math.min(0.8, 0.32 + 0.48 * smooth(x < 0.8 ? x / 0.8 : 1 - 0.4 * smooth((x - 0.8) / 0.2)));
      case "postlude": return 0.28 * (1 - x);
    }
    return 0.25;
  }
  function smooth(z) { z = Math.max(0, Math.min(1, z)); return z * z * (3 - 2 * z); }
  function inHush() { return ctx && ctx.currentTime < C.hushUntil; }
  function inFuging() { return ctx && ctx.currentTime < C.fugingUntil; }
  function silenceMul() { return C.meeting ? MEETINGS[C.meeting.activity].silenceMul : 1; }
  // The airy multiplier applied to every phrase gap: wide at rest, still wide
  // at the peaks. The frontier never crowds.
  function gapMul() { return (2.2 - intensity() * 0.9) * silenceMul(); }

  // --- conductor poll: advances sections, fires fuging entries, keeps time ---
  function conductorTick() {
    if (!playing) return;
    var x = localArc();
    // Fuging entry: once per hymn, past the shoulder — the voices go their
    // ways and gather again. A stillness follows the convergence.
    if (C.section === "hymn" && C.fugingPlanned && !C.fugingFired && x > 0.6 && x < 0.8 && !inHush()) {
      C.fugingFired = true;
      var fugDur = fugingEntry();
      C.fugingUntil = ctx.currentTime + fugDur;
      if (chance(0.6)) scheduleRaw(function () { stillness("after the gathering"); }, (fugDur + 1.5) * 1000);
    }
    // Testimony: the Cage silences — rare, long, authoritative.
    if (C.section === "testimony" && !inHush() && chance(0.015)) {
      stillness("testimony");
    }
    // And once in a great while a silence falls where none was scheduled —
    // about once a meeting, somewhere, unannounced.
    if (C.section !== "sacrament" && C.section !== "testimony" && !C.jointing && !inHush() && chance(0.0008)) {
      stillness("unbidden");
    }
    // Section end → joint → advance.
    if (!C.jointing && x >= 1) {
      C.jointing = true;
      var last = C.si >= C.plan.length - 1;
      var jointDur = runJoint(last);
      scheduleRaw(function () {
        if (C.si >= C.plan.length - 1) planMeeting();
        else enterSection(C.si + 1);
      }, (jointDur + 0.5) * 1000);
    }
    scheduleRaw(conductorTick, 600);
  }

  // Dev aid: jump the meeting to a section of the plan. Voices notice on
  // their next scheduled fire; a few tail notes from the old section may
  // ring over the seam — acceptable for a rehearsal skip.
  function skipToSection(type) {
    if (!playing) return false;
    var idx = -1;
    for (var i = 0; i < C.plan.length; i++) if (C.plan[i].type === type) { idx = i; break; }
    if (idx < 0) return false;
    C.hushUntil = 0;
    air.busyUntil = 0; air.holders = 0;
    if (masterGain && ctx) {
      // release any stillness dip that was in flight
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    }
    enterSection(idx);
    emitEvent({ cat: "conductor", label: "↷ skipped", detail: "to " + type + " (dev)" });
    return true;
  }

  // The stillness — the still small voice's room. Master dips low and holds;
  // sometimes a tuning fork rings alone in it; voices breathe back after.
  function stillness(why) {
    if (!playing) return;
    var t = ctx.currentTime;
    var holdS = rnd(10, 22) * silenceMul();
    C.hushUntil = t + holdS + 2.5;
    masterGain.gain.cancelScheduledValues(t);
    masterGain.gain.setValueAtTime(masterGain.gain.value || masterVolume, t);
    masterGain.gain.linearRampToValueAtTime(masterVolume * 0.18, t + 1.4);
    if (chance(0.5)) evTuningFork(t + rnd(2, holdS * 0.5));
    masterGain.gain.setValueAtTime(masterVolume * 0.18, t + 1.4 + holdS);
    masterGain.gain.linearRampToValueAtTime(masterVolume, t + 1.4 + holdS + 3);
    emitEvent({ cat: "conductor", label: "◦ the still small voice", detail: why + " · " + holdS.toFixed(1) + "s" });
  }

  // ==========================================================================
  // SECTION JOINTS — an organ cadence and a single bell. No cymbals in Zion.
  // ==========================================================================
  function runJoint(isLast) {
    var t = ctx.currentTime + 0.2;
    var dur = 4;
    var next = !isLast && C.plan[C.si + 1] ? C.plan[C.si + 1].type : null;
    if (next === "sacrament" || C.section === "sacrament") {
      // fade into (or out of) the quietest room through pure drone — no chord
      dur = rnd(4, 7);
      emitEvent({ cat: "cadence", label: "∴ the room empties", detail: "into stillness" });
    } else {
      var kind = isLast || C.section === "doxology" ? "plagal" : (C.section === "prelude" || C.section === "hymn" ? pickW([["plagal", 3], ["authentic", 2], ["half", 1]]) : "plagal");
      var chords = Harmony.cadence(kind);
      var chDur = rnd(2.6, 3.6);
      for (var i = 0; i < chords.length; i++) {
        organChord(t + i * chDur, chDur * (i === chords.length - 1 ? 1.7 : 1.02), chords[i], 0.6);
      }
      dur = chDur * chords.length + 1.5;
      if (chance(MEETINGS[C.meeting.activity].bells)) {
        meetinghouseBell(t + dur * 0.7, isLast ? 1.0 : rnd(0.5, 0.8));
        if (C.meeting.activity === "jubilee" && chance(0.6)) {
          // a small peal for a festival Sunday
          for (var p = 1; p <= rint(2, 4); p++) meetinghouseBell(t + dur * 0.7 + p * rnd(1.4, 2.2), rnd(0.4, 0.7));
          dur += 5;
        }
      }
    }
    emitEvent({ cat: "cadence", label: "∴ joint", detail: (isLast ? "meeting ends" : "toward " + next) + " · " + Math.round(dur) + "s" });
    return dur;
  }

  // ==========================================================================
  // MOTIF ENGINE — gestures, transform algebra, genealogy, ledger.
  // ==========================================================================
  // Motifs live in 7-DEGREE space ({deg, durBeats}) and are projected into
  // the meeting's collection only at render time — one gesture pool serves
  // every mode. Identity + genealogy: { name, gen, chain[] }.
  var Motif = (function () {
    var NAMES = ["𐐀", "𐐁", "𐐂"];               // the first three letters of the Deseret alphabet
    // THE GESTURE POOL — cultural DNA, abstracted from the tradition's
    // rhetoric, never quoted. Twelve gestures; each meeting draws only three,
    // so most sessions never hear most of them. That is the diversity: no two
    // visits work the same material.
    var GESTURES = [
      { name: "gathering",   notes: [[-3, 1], [0, 2], [1, 1], [0, 3]] },                            // the rising-fourth call
      { name: "kolob arch",  notes: [[0, 1], [2, 1], [4, 1], [5, 2], [4, 1], [2, 1], [0, 3]] },     // arch litany, KINGSFOLD-shaped
      { name: "amen",        notes: [[3, 2], [2, 1], [0, 4]] },                                     // the plagal fall
      { name: "revival",     notes: [[0, 1], [2, 1], [4, 1], [7, 3]] },                             // gapped camp-meeting ascent
      { name: "sweet hour",  notes: [[4, 2], [3, 1], [2, 1], [1, 1], [0, 3]] },                     // stepwise evening descent
      { name: "fuging",      notes: [[0, 1], [4, 1], [3, 0.5], [2, 0.5], [1, 1], [0, 2]] },         // the imitative subject
      { name: "handcart",    notes: [[0, 1], [1, 1], [2, 2], [1, 1], [0, 1], [-1, 1], [0, 3]] },    // walking, patient
      { name: "wayfarer",    notes: [[5, 1], [4, 1], [2, 2], [3, 1], [1, 1], [0, 3]] },             // the lonesome stranger
      { name: "sego lily",   notes: [[2, 1], [4, 0.5], [2, 0.5], [1, 1], [2, 1], [0, 2]] },         // a light gapped lilt
      { name: "bells of Zion", notes: [[6, 1], [4, 1], [5, 1], [3, 1], [4, 1], [2, 1], [0, 2]] },   // falling thirds, pealing
      { name: "morning star", notes: [[0, 1], [5, 2], [4, 1], [3, 1], [4, 3]] },                    // the upward sixth, held
      { name: "still small", notes: [[1, 2], [0, 1], [1, 1], [2, 2], [1, 1], [0, 3]] },             // a narrow murmur
      { name: "cumorah",     notes: [[7, 2], [4, 1], [2, 1], [0, 3]] },                             // the falling-octave call
      { name: "beehive",     notes: [[2, 1], [2, 1], [2, 0.5], [3, 0.5], [2, 1], [0, 3]] },         // repeated-note industry
      { name: "ensign peak", notes: [[0, 1], [4, 1], [7, 2], [5, 1], [4, 3]] },                     // the wide climb, held high
      { name: "lullaby",     notes: [[0, 2], [-2, 1], [0, 1], [-1, 2], [0, 3]] },                   // low rocking, evening
      { name: "sego road",   notes: [[0, 1.5], [1, 0.5], [3, 1.5], [2, 0.5], [1, 1], [0, 3]] },     // dotted walking figure
    ];
    var working = { theme: null, subs: [] };      // the whole meeting works ≤3 ideas
    var ledger = [];                              // [{from, to, motif, deadline, type}]
    var stats = { developments: 0, answers: 0, transformsUsed: {}, gestures: [] };

    function clone(m) { return JSON.parse(JSON.stringify(m)); }
    function fromGesture(g, name) {
      return {
        name: name, gesture: g.name, gen: 0, chain: [],
        notes: g.notes.map(function (n) { return { deg: n[0], durBeats: n[1] }; }),
      };
    }

    // ---- the transform algebra (each returns a NEW motif, chain appended) ----
    var TRANSFORMS = {
      invert: function (m) {
        var axis = m.notes[0].deg;
        m.notes.forEach(function (n) { n.deg = axis - (n.deg - axis); });
        return m;
      },
      transpose: function (m) {
        var by = pickW([[1, 3], [2, 3], [-1, 3], [-2, 2], [3, 1], [4, 1], [-4, 1]]);
        m.notes.forEach(function (n) { n.deg += by; });
        return m;
      },
      fragmentHead: function (m) {
        m.notes = m.notes.slice(0, Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      fragmentTail: function (m) {
        m.notes = m.notes.slice(-Math.max(2, Math.ceil(m.notes.length / 2)));
        return m;
      },
      augment: function (m) {
        var f = rnd(1.35, 1.9);
        m.notes.forEach(function (n) { n.durBeats = Math.min(7, n.durBeats * f); });
        return m;
      },
      diminish: function (m) {
        var f = rnd(0.55, 0.75);
        m.notes.forEach(function (n) { n.durBeats = Math.max(0.4, n.durBeats * f); });
        return m;
      },
      retrograde: function (m) {
        m.notes.reverse();
        return m;
      },
      sequence: function (m) {                     // restate at a transposition — real sequencing
        var step = pickW([[1, 3], [2, 2], [-1, 3], [-2, 2]]);
        var rep = clone(m).notes.map(function (n) { return { deg: n.deg + step, durBeats: n.durBeats }; });
        m.notes = m.notes.concat(rep).slice(0, 12);
        return m;
      },
      ornament: function (m) {                     // passing tones between leaps — grace, not filigree
        var res = [];
        for (var i = 0; i < m.notes.length; i++) {
          var n = m.notes[i], nx = m.notes[i + 1];
          if (nx && res.length < 9 && Math.abs(nx.deg - n.deg) >= 2 && n.durBeats >= 1 && chance(0.55)) {
            res.push({ deg: n.deg, durBeats: n.durBeats * 0.65 });
            res.push({ deg: n.deg + Math.sign(nx.deg - n.deg), durBeats: Math.max(0.4, n.durBeats * 0.35) });
          } else res.push({ deg: n.deg, durBeats: n.durBeats });
        }
        m.notes = res;
        return m;
      },
    };

    // ---- chain grammar: which transform, given voice + section + chain ----
    var VOICE_WEIGHTS = {
      clarinet:  { sequence: 3, ornament: 3, transpose: 2.5, fragmentHead: 2, invert: 2, diminish: 1.5, augment: 1.5, retrograde: 1, fragmentTail: 1.5 },
      choir:     { augment: 3.5, invert: 2.5, transpose: 2.5, retrograde: 1.5, fragmentTail: 1.5, sequence: 1, ornament: 0.5, diminish: 0.5, fragmentHead: 1 },
      bells:     { fragmentHead: 3.5, diminish: 3, transpose: 2, retrograde: 1.5, sequence: 1.5, invert: 1, augment: 0.3, ornament: 0.3, fragmentTail: 2 },
      telegraph: { diminish: 3, fragmentHead: 3, retrograde: 2, sequence: 2, transpose: 1, invert: 0.5, augment: 0.2, ornament: 0.2, fragmentTail: 1.5 },
      harmonium: { augment: 3, transpose: 2.5, invert: 2, fragmentTail: 1.5, sequence: 1, ornament: 0.5, diminish: 0.5, retrograde: 1, fragmentHead: 1 },
    };
    var SECTION_TILT = {
      prelude:    { augment: 1.6, transpose: 1.4, ornament: 0.4, diminish: 0.4, sequence: 0.6 },
      invocation: { augment: 1.8, fragmentTail: 1.3, sequence: 0.2, ornament: 0.3 },
      hymn:       { sequence: 1.5, invert: 1.3, ornament: 1.3 },
      testimony:  { fragmentHead: 1.6, fragmentTail: 1.5, augment: 1.3, sequence: 0.4 },
      sacrament:  { augment: 2, ornament: 0.2, diminish: 0.2 },
      doxology:   { invert: 1.4, sequence: 1.5, transpose: 1.3 },
      postlude:   { augment: 1.7, fragmentTail: 1.6, ornament: 0.4 },
    };
    var AFFINITY = {
      fragmentHead: { sequence: 2.4, ornament: 1.6 },
      fragmentTail: { sequence: 2.4, ornament: 1.6 },
      invert:       { augment: 1.7, transpose: 1.5 },
      sequence:     { diminish: 1.6 },
      ornament:     { augment: 1.4 },
    };
    function beatsOf(m) { var b = 0; m.notes.forEach(function (n) { b += n.durBeats; }); return b; }
    function isPalindromic(m) {
      var s = m.notes.map(function (n) { return n.deg; });
      for (var i = 0; i < s.length; i++) if (s[i] !== s[s.length - 1 - i]) return false;
      return true;
    }
    function lastRealLink(chain) {
      for (var i = chain.length - 1; i >= 0; i--)
        if (chain[i] !== "dissolve" && chain[i] !== "tether" && chain[i] !== "seed") return chain[i];
      return null;
    }
    function allowedTransform(name, m, chain) {
      var len = m.notes.length;
      var last = lastRealLink(chain);
      if (name === last) return false;             // never twice running
      if (name === "fragmentHead" || name === "fragmentTail") {
        if (len <= 4) return false;
        var frags = 0;
        for (var i = 0; i < chain.length; i++) if (chain[i].indexOf("fragment") === 0) frags++;
        if (frags >= 1 && len <= 6) return false;
      }
      if (name === "sequence" && len >= 7) return false;
      if (name === "ornament" && len >= 8) return false;
      if (name === "retrograde" && isPalindromic(m)) return false;
      if (name === "augment" && beatsOf(m) > 20) return false;
      return true;
    }
    function pickTransform(voice, m, chain) {
      var w = VOICE_WEIGHTS[voice] || VOICE_WEIGHTS.clarinet;
      var tilt = SECTION_TILT[C.section] || {};
      var last = lastRealLink(chain);
      var pool = [];
      for (var name in w) {
        if (!allowedTransform(name, m, chain)) continue;
        var wt = w[name] * (tilt[name] || 1);
        if (last && AFFINITY[last] && AFFINITY[last][name]) wt *= AFFINITY[last][name];
        pool.push([name, wt]);
      }
      return pool.length ? pickW(pool) : null;
    }
    // Keep the centre of mass in the singable window by whole octaves —
    // internal intervals untouched, the contour survives intact.
    function recentre(m) {
      if (!m.notes.length) return m;
      var sum = 0; m.notes.forEach(function (n) { sum += n.deg; });
      var mean = sum / m.notes.length;
      while (mean > 8) { m.notes.forEach(function (n) { n.deg -= 7; }); mean -= 7; }
      while (mean < -1) { m.notes.forEach(function (n) { n.deg += 7; }); mean += 7; }
      return m;
    }

    // ---- genealogy ----
    var lineage = {};
    var climaxReprised = false;
    function ancestorOf(name) {
      if (working.theme && working.theme.name === name) return working.theme;
      for (var i = 0; i < working.subs.length; i++) if (working.subs[i] && working.subs[i].name === name) return working.subs[i];
      return working.theme;
    }
    function remember(m) {
      var cur = lineage[m.name];
      if (!cur || m.gen >= cur.gen) lineage[m.name] = clone(m);
    }
    // Identity tether: every 3rd generation, the ancestor's opening is grafted
    // back on — development may wander the valley, but the head returns.
    function tether(m) {
      var anc = ancestorOf(m.name);
      if (!anc) return m;
      var k = Math.min(3, anc.notes.length, Math.max(1, m.notes.length - 1));
      m.notes = clone(anc).notes.slice(0, k).concat(m.notes.slice(k));
      m.chain = m.chain.concat(["tether"]);
      stats.transformsUsed.tether = (stats.transformsUsed.tether || 0) + 1;
      return m;
    }
    function develop(voice, m, maxChain) {
      if (m.gen >= 9) {                            // renewal: the line returns to its source
        var anc = ancestorOf(m.name);
        if (anc) m = anc;
      }
      var out = clone(m);
      var links = rint(1, maxChain || 2);
      var used = [];
      for (var i = 0; i < links; i++) {
        var name = pickTransform(voice, out, out.chain.concat(used));
        if (!name) break;
        out = TRANSFORMS[name](out);
        used.push(name);
        stats.transformsUsed[name] = (stats.transformsUsed[name] || 0) + 1;
      }
      if (!used.length) {
        out = TRANSFORMS.transpose(out);
        used.push("transpose");
        stats.transformsUsed.transpose = (stats.transformsUsed.transpose || 0) + 1;
      }
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(used);
      if (out.gen >= 3 && out.gen % 3 === 0) out = tether(out);
      recentre(out);
      stats.developments++;
      remember(out);
      emitEvent({ cat: "motif", label: "◆ " + out.name + "·g" + out.gen, detail: used.join("+") + " · " + (out.gesture || "") });
      return out;
    }
    // Which motif should a voice work right now?
    function request(voice) {
      var m;
      switch (C.section) {
        case "prelude": case "invocation":
          m = chance(0.7) ? working.theme : pick(working.subs); break;
        case "hymn":
          m = pickW([[working.theme, 3], [working.subs[0], 2], [working.subs[1] || working.theme, 2]]); break;
        case "testimony": case "sacrament":
          m = chance(0.55) ? pick(working.subs) : working.theme; break;
        case "doxology":
          m = chance(0.65) ? working.theme : pick(working.subs); break;
        default:
          m = working.theme;
      }
      if (!m) m = working.theme;
      // Work the LINEAGE (what the meeting has built) about half the time in
      // the singing sections; the tether keeps it recognizable.
      if (C.section === "hymn" || C.section === "doxology") {
        var line = lineage[m.name];
        if (line && line.gen > 0 && line.gen < 6 && chance(0.45)) m = line;
      }
      // State it plainly first — the tradition trusts its tunes.
      if ((C.section === "prelude" || C.section === "invocation") && m.gen === 0 && chance(0.5)) return clone(m);
      if (C.section === "doxology" && !climaxReprised && localArc() > 0.55) {
        // THE reprise: once per meeting, at the doxology's height, something
        // returns whole — usually the literal theme, sometimes its deepest
        // descendant, sometimes the lesser hymn. Recognition, varied.
        climaxReprised = true;
        var roll = rng();
        var deepLine = lineage[working.theme.name];
        if (roll < 0.25 && deepLine && deepLine.gen >= 3) {
          emitEvent({ cat: "motif", label: "✸ reprise " + working.theme.name, detail: "the theme returns, transfigured — g" + deepLine.gen });
          return clone(deepLine);
        }
        if (roll < 0.4 && working.subs.length) {
          var subRe = pick(working.subs);
          emitEvent({ cat: "motif", label: "✸ reprise " + subRe.name, detail: "the lesser hymn returns — " + (subRe.gesture || "") });
          return clone(subRe);
        }
        emitEvent({ cat: "motif", label: "✸ reprise " + working.theme.name, detail: "the theme returns, verbatim — " + (working.theme.gesture || "") });
        return clone(working.theme);
      }
      if (C.section === "postlude") {
        var deep = lineage[m.name];
        return decompose((deep && deep.gen > m.gen) ? clone(deep) : clone(m));
      }
      return develop(voice, m, C.section === "doxology" ? 3 : 2);
    }
    // Postlude: the motif releases its notes one at a time into the evening.
    function decompose(m) {
      var out = clone(m);
      var x = localArc();
      var keep = Math.max(1, Math.round(out.notes.length * (1 - 0.8 * x)));
      while (out.notes.length > keep) out.notes.splice(rint(1, Math.max(1, out.notes.length - 1)), 1);
      out.notes.forEach(function (n) { n.durBeats *= 1 + x; });
      out.gen = m.gen + 1;
      out.chain = m.chain.concat(["dissolve"]);
      emitEvent({ cat: "motif", label: "࿙ " + out.name + " disperses", detail: "notes let go into the dusk" });
      return out;
    }

    // ---- dialogue ledger: real obligations between voices ----
    function post(fromVoice, toVoice, motif, type) {
      ledger.push({ from: fromVoice, to: toVoice, motif: clone(motif), type: type, deadline: ctx.currentTime + rnd(8, 20) });
      if (ledger.length > 6) ledger.shift();
    }
    function claim(voice) {
      var i, ob = null;
      for (i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) { ob = ledger.splice(i, 1)[0]; break; }
      }
      if (!ob) {
        // An obligation past its deadline is taken up by whichever voice
        // speaks next (never the caller itself) — the answer is always heard.
        for (i = 0; i < ledger.length; i++) {
          if (ledger[i].from !== voice && ctx.currentTime > ledger[i].deadline) { ob = ledger.splice(i, 1)[0]; break; }
        }
      }
      if (!ob) return null;
      var m = ob.motif;
      if (m.gen >= 9) {
        var anc = ancestorOf(m.name);
        if (anc) m = clone(anc);
      }
      var ans;
      if (ob.type === "line-out") {
        // lining-out: the answer is the same line, sung back in harmony —
        // the caller's notes verbatim; the choir sets them (renderer's job).
        ans = clone(m);
        ans.linedOut = true;
      } else if (ob.type === "imitate") ans = develop(voice, m, 1);
      else if (ob.type === "invert") {
        var op = "invert";
        if (lastRealLink(m.chain) === "invert") op = isPalindromic(m) ? "transpose" : "retrograde";
        ans = TRANSFORMS[op](clone(m)); ans.gen = m.gen + 1; ans.chain = m.chain.concat([op]);
        stats.transformsUsed[op] = (stats.transformsUsed[op] || 0) + 1;
        recentre(ans); remember(ans);
      }
      else ans = develop(voice, m, 2);
      stats.answers++;
      emitEvent({ cat: "motif", label: "⇄ " + voice + " answers " + ob.from, detail: ob.type + " · " + ans.name + "·g" + ans.gen });
      return ans;
    }
    function overdueFor(voice) {
      for (var i = 0; i < ledger.length; i++) {
        if (ledger[i].to === voice) return true;
        if (ledger[i].from !== voice && ctx && ctx.currentTime > ledger[i].deadline) return true;
      }
      return false;
    }
    function pendingLineOut(voice) {
      for (var i = 0; i < ledger.length; i++) if (ledger[i].to === voice && ledger[i].type === "line-out") return true;
      return false;
    }

    function newMeeting() {
      // Draw DISTINCT gestures from the pool. Most stay home today — and a
      // lean fast Sunday sometimes carries only two hymns in its pocket.
      var draw = (C.meeting && C.meeting.activity === "fast" && chance(0.5)) ? 2 : 3;
      var idxs = [];
      while (idxs.length < draw) {
        var gi = rint(0, GESTURES.length - 1);
        if (idxs.indexOf(gi) < 0) idxs.push(gi);
      }
      working.theme = fromGesture(GESTURES[idxs[0]], NAMES[0]);
      working.subs = [];
      for (var si = 1; si < idxs.length; si++) working.subs.push(fromGesture(GESTURES[idxs[si]], NAMES[si]));
      // Perturb each once, gently, so no two meetings state a gesture the same.
      [working.theme].concat(working.subs).forEach(function (m) {
        var op = pickW([["transpose", 3], ["augment", 2], ["ornament", 1], ["diminish", 1]]);
        if (allowedTransform(op, m, [])) { TRANSFORMS[op](m); m.chain = ["seed"]; }
      });
      ledger.length = 0;
      lineage = {};
      climaxReprised = false;
      stats.gestures = idxs.map(function (g2) { return GESTURES[g2].name; });
      emitEvent({
        cat: "motif", label: "❁ the day's hymns",
        detail: stats.gestures.map(function (g3, k) { return NAMES[k] + " " + g3; }).join(" · "),
      });
    }
    function onSection(type) {
      if (type === "doxology") climaxReprised = false;
    }
    function theme() { return working.theme; }
    function anyWorking() {
      return (chance(0.7) || !working.subs.length) ? working.theme : pick(working.subs);
    }

    return {
      newMeeting: newMeeting, onSection: onSection, theme: theme, anyWorking: anyWorking,
      request: request, post: post, claim: claim, overdueFor: overdueFor, pendingLineOut: pendingLineOut,
      decompose: decompose, develop: develop,
      stats: function () {
        return {
          developments: stats.developments, answers: stats.answers,
          transforms: Object.keys(stats.transformsUsed),
          gestures: stats.gestures.slice(),
          working: { theme: working.theme && working.theme.name, gen: working.theme && working.theme.gen },
        };
      },
    };
  })();

  // ==========================================================================
  // VOICE: ORGAN — the tabernacle instrument. Additive drawbar ranks (no
  // biquad anywhere in this chain, by design); principal chorus crossfading
  // toward flutes; a slow shallow tremulant; a pedal sine under the bass.
  // Soloist in prelude and postlude; the harmonic bed under the singing.
  // ==========================================================================
  function organChord(t, dur, chord, gainMul) {
    if (!chord) return;
    var stops = getLayerParam("organ", "stops", 0.5);
    var trem = getLayerParam("organ", "tremulant", 0.15);
    var pedal = getLayerParam("organ", "pedal", 0.6);
    var dest = panAt("organ", 0);
    var master = ctx.createGain();
    master.connect(dest);
    // drawbar recipe, softened aloft — and the whole chord AN OCTAVE DOWN:
    // the organ lives in the warm low-middle now, an instrument among the
    // others, not a bright bed over them
    var RANKS = [1, 2, 3, 4];
    var P = [1, 0.48, 0.22, 0.1], FL = [1, 0.65, 0.09, 0.32];
    var nTones = chord.freqs.length;
    for (var v = 0; v < nTones; v++) {
      var f = chord.freqs[v] * 0.5;
      for (var r = 0; r < RANKS.length; r++) {
        var g = P[r] * (1 - stops) + FL[r] * stops;
        if (g < 0.05) continue;
        var pair = r === 0 ? 2 : 1;                            // chorus detune on the unison rank only
        for (var d = 0; d < pair; d++) {
          var o = ctx.createOscillator();
          o.type = "sine";
          o.frequency.setValueAtTime(f * RANKS[r] * (pair === 2 ? (d ? 1.0015 : 0.9985) : 1), t);
          var og = ctx.createGain();
          og.gain.setValueAtTime(g * 0.16 / Math.sqrt(nTones) / pair, t);
          o.connect(og); og.connect(master);
          o.start(t); o.stop(t + dur + 0.3);
        }
      }
    }
    if (pedal > 0.05) {
      var sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.setValueAtTime(chord.freqs[0] * 0.25, t);
      var sg = ctx.createGain(); sg.gain.setValueAtTime(pedal * 0.15, t);
      sub.connect(sg); sg.connect(master);
      sub.start(t); sub.stop(t + dur + 0.3);
    }
    if (trem > 0.02) {
      var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(rnd(5, 6), t);
      var lg = ctx.createGain(); lg.gain.setValueAtTime(trem * 0.1, t);
      lfo.connect(lg); lg.connect(master.gain);
      lfo.start(t); lfo.stop(t + dur + 0.3);
    }
    var peak = (gainMul || 1) * 0.7;
    var atk = Math.min(2.2, dur * 0.3);
    env(master, t, [[atk, peak], [Math.max(0.1, dur - atk - dur * 0.28), peak * 0.92], [dur * 0.28, 0]]);
    emitNote("organ", chord.freqs[0] * 0.5, t, dur);
  }
  function organCycle() {
    if (!playing) return;
    var s = C.section;
    if (s === "invocation" || s === "testimony" || s === "interlude") {
      // mostly tacet — a rare soft open chord, like the organist resting hands
      if (chance(0.25) && !inHush()) {
        var ch = Harmony.advance({ open: true });
        organChord(ctx.currentTime + 0.1, rnd(10, 16), ch, 0.35);
      }
      scheduleLayer(organCycle, rnd(20, 36) * 1000 * silenceMul(), "organ");
      return;
    }
    if (s === "sacrament" || inHush()) { scheduleRaw(organCycle, 6000); return; }
    // The organ is an INSTRUMENT here, never a bed. In the prelude and the
    // postlude the organist plays phrases — a chord, a breath, a chord —
    // with real silence between. In the singing sections it only punctuates,
    // a swell under a cadence moment, then hands the hymn back to the voices.
    // The sustained ground of this piece is the sine DRONE, nothing else.
    if (s === "prelude" || s === "postlude") {
      var chord = Harmony.advance();
      var dur = rnd(6, 11);
      organChord(ctx.currentTime + 0.1, dur, chord, 0.75 * (0.6 + intensity() * 0.4));
      scheduleLayer(organCycle, (dur + rnd(4, 10) * silenceMul()) * 1000, "organ");
      return;
    }
    if (chance(0.6)) {
      var ch2 = Harmony.current() || Harmony.advance();
      var d2 = rnd(7, 12);
      organChord(ctx.currentTime + 0.1, d2, ch2, (s === "doxology" ? 0.65 : 0.5) * (0.6 + intensity() * 0.5));
    }
    scheduleLayer(organCycle, rnd(12, 24) * 1000 * gapMul() * 0.6, "organ");
  }

  // ==========================================================================
  // VOICE: DRONE — the La Monte Young register. Pure sines on the harmonic
  // series of F0, in very long crossfading cycles. It never stops — in the
  // sacrament it is all there is. The stillness is the point.
  // ==========================================================================
  function droneCycle() {
    if (!playing) return;
    var t = ctx.currentTime;
    var dur = rnd(60, 90);
    var overlap = 20;
    var presence = getLayerParam("drone", "presence", 0.5);
    var fifthAmt = getLayerParam("drone", "fifth", 0.4);
    var bright = C.meeting ? MEETINGS[C.meeting.activity].bright : 0.5;
    var partials = [
      { h: 1, g: 0.4 }, { h: 2, g: 0.24 }, { h: 3, g: 0.12 }, { h: 4, g: 0.07 },
    ];
    if (fifthAmt > 0.1 && bright > 0.4) partials.push({ h: 3, g: fifthAmt * 0.1, oct: 1 });  // 3/2 above, one octave up
    var dest = panAt("drone", 0);
    var master = ctx.createGain();
    master.connect(dest);
    for (var i = 0; i < partials.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(harm(partials[i].h) * (partials[i].oct ? 2 : 1), t);
      var og = ctx.createGain();
      og.gain.setValueAtTime(partials[i].g, t);
      o.connect(og); og.connect(master);
      o.start(t); o.stop(t + dur + 0.5);
    }
    var peak = 0.5 * (0.5 + presence * 0.8);
    // the drone holds through everything, even the sacrament — softer, never gone
    if (C.section === "sacrament") peak *= 0.8;
    env(master, t, [[overlap * 0.7, peak], [dur - overlap * 1.4, peak * 0.95], [overlap * 0.7, 0]]);
    emitNote("drone", F0, t, dur);
    scheduleLayer(droneCycle, (dur - overlap) * 1000, "drone");
  }

  // ==========================================================================
  // VOICE: CHOIR — SATB from the harmony engine. Formant-filtered "ah"/"oo",
  // congregational scoops between chords, dispersed voicings. Sings verses in
  // the hymns (poured through the meter), answers lining-out calls, gathers
  // for the fuging entries, amens the doxology.
  // ==========================================================================
  var CHOIR_FORMANTS = {
    ah: [[700, 1080, 2650], [600, 1040, 2250], [440, 1800, 2700], [340, 870, 2250]],  // S A T B
    oo: [[325, 700, 2530], [370, 630, 2750], [300, 870, 2240], [280, 630, 2340]],
  };
  var CHOIR_PANS = [0.35, -0.35, 0.55, -0.55];   // S A T B — spread wide; the frontier is broad
  function choirVoiceLine(t, notes, vi, gainMul) {
    // one SATB voice walks a line of {f, dur} with scoops between pitches
    var vowelAmt = getLayerParam("choir", "vowel", 0.4);
    var scoop = getLayerParam("choir", "scoop", 0.5);
    var dest = panAt("choir", CHOIR_PANS[vi]);
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    // LESSON (Bardo, hard-won): pre-attenuate before resonant formants — the
    // Q boosts ~9x and will rail the master via the compressor's auto-makeup.
    var pre = ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var fAh = CHOIR_FORMANTS.ah[vi], fOo = CHOIR_FORMANTS.oo[vi];
    var vg = ctx.createGain();
    for (var fi = 0; fi < 3; fi++) {
      var bq = ctx.createBiquadFilter();
      bq.type = "bandpass";
      // vowel blend is FIXED per phrase — formant frequencies never chase
      // automation mid-note (setValueAtTime only; biquads stay stable)
      bq.frequency.setValueAtTime(fAh[fi] * (1 - vowelAmt) + fOo[fi] * vowelAmt, t);
      bq.Q.setValueAtTime(fi === 0 ? 6 : fi === 1 ? 9 : 5, t);
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(fi === 0 ? 1 : fi === 1 ? 0.6 : 0.1, t);
      pre.connect(bq); bq.connect(bg); bg.connect(vg);
    }
    vg.connect(dest);
    // the line: pitch moves by scoops (short linearRamps on the OSCILLATOR,
    // never on a biquad), a breath of portamento into each syllable
    var det = 1 + rnd(-0.004, 0.004);
    o.frequency.setValueAtTime(notes[0].f * det, t);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.1, Math.min(0.45, n.dur * 0.3)) * (0.4 + scoop);
        o.frequency.setValueAtTime(notes[i - 1].f * det, tt);
        o.frequency.linearRampToValueAtTime(n.f * det, tt + port);
      }
      tt += n.dur;
      total += n.dur;
    }
    var peak = (gainMul || 1) * 0.5;
    env(vg, t, [[rnd(0.6, 1.2), peak], [Math.max(0.2, total - 2.4), peak * 0.88], [rnd(1, 1.6), 0]]);
    o.start(t); o.stop(t + total + 1.8);
    return total;
  }
  function activeVoices() {
    var size = Math.round(getLayerParam("choir", "size", 3));
    var meet = C.meeting ? MEETINGS[C.meeting.activity].choirSize : 3;
    var n = Math.max(1, Math.min(4, Math.min(size, meet)));
    return n === 1 ? [0] : n === 2 ? [0, 3] : n === 3 ? [0, 1, 3] : [0, 1, 2, 3];
  }
  // Render a harmonized line: chords per syllable from Harmony.harmonize.
  // voiceIdx order in chord.voicing is [b,t,a,s]; CHOIR vi is [s,a,t,b]=[0..3].
  var VI_TO_CHORDPOS = [3, 2, 1, 0];
  function choirHarmonizedLine(t, harmonized, beat, gainMul) {
    var vis = activeVoices();
    var lineNotes = { 0: [], 1: [], 2: [], 3: [] };
    for (var i = 0; i < harmonized.length; i++) {
      var ch = harmonized[i].chord;
      var dur = harmonized[i].dur * beat;
      for (var v = 0; v < vis.length; v++) {
        var vi = vis[v];
        lineNotes[vi].push({ f: ch.freqs[VI_TO_CHORDPOS[vi]], dur: dur });
      }
    }
    var total = 0;
    for (var v2 = 0; v2 < vis.length; v2++) {
      var vi2 = vis[v2];
      var stagger = vi2 === 0 ? 0 : rnd(0.05, 0.25);           // the congregation breathes together, loosely
      var tot = choirVoiceLine(t + stagger, lineNotes[vi2], vi2, gainMul * (vi2 === 0 ? 1 : 0.8));
      if (tot > total) total = tot;
    }
    for (var i2 = 0; i2 < harmonized.length; i2++) {
      var at = t; for (var k = 0; k < i2; k++) at += harmonized[k].dur * beat;
      emitNote("choir", harmonized[i2].chord.freqs[3], at, harmonized[i2].dur * beat);
    }
    return total;
  }
  function choirVerse() {
    if (!playing) return;
    var s = C.section;
    var sings = s === "hymn" || s === "doxology";
    if (!sings || inHush() || inFuging()) { scheduleRaw(choirVerse, 6000); return; }
    if (!airFree()) { scheduleRaw(choirVerse, rnd(4, 9) * 1000); return; }

    var t = ctx.currentTime + 0.15;
    var beat = rnd(1.05, 1.5);                                 // slow — hymn time, prairie time
    var meterLines = METERS[C.meter] || METERS.CM;

    // Lining-out answer takes precedence: sing back the deacon's line, slower.
    if (Motif.pendingLineOut("choir")) {
      var call = Motif.claim("choir");
      if (call) {
        var ln = call.notes.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
        var hz = Harmony.harmonize(ln);
        var total = choirHarmonizedLine(t, hz, beat * 1.4, 0.95);  // 0.7x tempo of the call
        claimAir(total, rnd(4, 9) * silenceMul());
        emitNote("choir", 0, t, total);
        scheduleLayer(choirVerse, (total + rnd(6, 14) * gapMul()) * 1000, "choir");
        return;
      }
    }

    // A verse: 2 lines of the meter per speech (whole verses would crowd the
    // air; the field hears the hymn in couplets, with sky between).
    var motif = Motif.overdueFor("choir") ? Motif.claim("choir") : Motif.request("choir");
    if (!motif) { scheduleRaw(choirVerse, 6000); return; }
    var nLines = s === "doxology" ? 1 : 2;
    var lineStart = t, sungTotal = 0;
    for (var li = 0; li < nLines; li++) {
      var nSyl = meterLines[(C.verseLine + li) % meterLines.length];
      var line = Prosody.pourIntoLine(motif, nSyl);
      var ln2 = line.map(function (n) { return { deg: n.deg, dur: n.durBeats }; });
      var hz2 = Harmony.harmonize(ln2);
      var lt = choirHarmonizedLine(lineStart, hz2, beat, 0.9);
      emitEvent({ cat: "verse", label: "¶ " + C.meter + " line " + (li + 1), detail: nSyl + " syllables · " + motif.name + "·g" + motif.gen });
      sungTotal += lt;
      lineStart += lt + rnd(1.8, 3.4);                         // the breath between lines
      sungTotal += 2.5;
    }
    C.verseLine = (C.verseLine || 0) + nLines;                 // the hymn walks its stanza
    // the doxology closes each speech with the amen
    if (s === "doxology") {
      var cadChords = Harmony.cadence("plagal");
      var cd = rnd(2.8, 3.8);
      for (var ci = 0; ci < cadChords.length; ci++) {
        var vis = activeVoices();
        for (var v = 0; v < vis.length; v++) {
          var vi = vis[v];
          choirVoiceLine(lineStart + ci * cd, [{ f: cadChords[ci].freqs[VI_TO_CHORDPOS[vi]], dur: cd * (ci ? 1.6 : 1.02) }], vi, 0.9);
        }
        emitNote("choir", cadChords[ci].freqs[3], lineStart + ci * cd, cd);
      }
      sungTotal += cd * 2 + 1;
    }
    claimAir(sungTotal, rnd(5, 12) * silenceMul());
    if (chance(0.4)) Motif.post("choir", pickW([["clarinet", 3], ["bells", 1]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    var gap = rnd(10, 22) * gapMul();
    scheduleLayer(choirVerse, (sungTotal + gap) * 1000, "choir");
  }

  // ==========================================================================
  // FUGING ENTRY — the voices go out one by one (bass first, at the fifth and
  // the octave by turns) and gather again into homophony. Strings hold the
  // open fifth beneath. After the convergence: the stillness.
  // ==========================================================================
  function fugingEntry() {
    var theme = Motif.theme();
    if (!theme) return 4;
    var head = theme.notes.slice(0, Math.min(6, theme.notes.length));
    var t = ctx.currentTime + 0.3;
    var beat = rnd(1.0, 1.3);
    var vis = [3, 2, 1, 0];                                    // B, T, A, S — bottom up
    var stagger = rnd(2.4, 3.2);
    var octForVi = { 0: 7, 1: 7, 2: 0, 3: 0 };                 // upper voices an octave up (7-space)
    var entryCount = Math.min(4, rint(2, activeVoices().length + 1));
    var lastEnd = t;
    for (var e = 0; e < entryCount; e++) {
      var vi = vis[e % 4];
      var shift = (e % 2 === 1 ? 4 : 0) + octForVi[vi];        // alternating tonic / fifth entries
      var notes = head.map(function (n) {
        return { f: degFreq(projDeg(n.deg + shift) - (vi >= 2 ? colN() : 0)), dur: n.durBeats * beat };
      });
      var at = t + e * stagger;
      var tot = choirVoiceLine(at, notes, vi, 0.85);
      emitNote("choir", notes[0].f, at, tot);
      if (at + tot > lastEnd) lastEnd = at + tot;
    }
    // strings hold the open fifth under the imitation
    stringsPad(t, (lastEnd - t) + 4, 0.7, true);
    // convergence: all voices land a plagal amen together
    var cadAt = lastEnd + rnd(0.5, 1.2);
    var chords = Harmony.cadence("plagal");
    var cd = rnd(2.6, 3.4);
    for (var ci = 0; ci < chords.length; ci++) {
      var avs = activeVoices();
      for (var v = 0; v < avs.length; v++) {
        var vvi = avs[v];
        choirVoiceLine(cadAt + ci * cd, [{ f: chords[ci].freqs[VI_TO_CHORDPOS[vvi]], dur: cd * (ci ? 1.7 : 1.02) }], vvi, 0.95);
      }
    }
    organChord(cadAt, cd * 2.4, chords[chords.length - 1], 0.55);
    var totalDur = (cadAt + cd * 2.4) - t;
    claimAir(totalDur, 4);
    emitEvent({ cat: "fuging", label: "⁂ fuging entry ×" + entryCount, detail: "stagger " + stagger.toFixed(1) + "s · at the fifth · " + (theme.gesture || "") });
    return totalDur;
  }

  // ==========================================================================
  // VOICE: CLARINET — the deacon. Copland clarity: triangle + one soft octave
  // sine through a gentle fixed lowpass; delayed shallow vibrato; single
  // grace notes, no trills. Lines out the hymn for the choir; speaks alone
  // in testimony with real silence around it.
  // ==========================================================================
  function renderClarinetLine(t, notes, gainMul) {
    var vib = getLayerParam("clarinet", "vibrato", 0.4);
    var graceAmt = getLayerParam("clarinet", "grace", 0.5);
    var dest = panAt("clarinet", rnd(-0.25, 0.25));
    var o = ctx.createOscillator();
    o.type = "triangle";
    var oct = ctx.createOscillator();
    oct.type = "sine";
    var og2 = ctx.createGain(); og2.gain.setValueAtTime(0.12, t);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(notes[0].f * 5, t);            // fixed — no filter automation at all
    var g = ctx.createGain();
    o.connect(lp); oct.connect(og2); og2.connect(lp);
    lp.connect(g); g.connect(dest);
    o.frequency.setValueAtTime(notes[0].f, t);
    oct.frequency.setValueAtTime(notes[0].f * 2, t);
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        var port = Math.max(0.04, Math.min(0.2, n.dur * 0.25));
        o.frequency.setValueAtTime(notes[i - 1].f, tt);
        o.frequency.linearRampToValueAtTime(n.f, tt + port);
        oct.frequency.setValueAtTime(notes[i - 1].f * 2, tt);
        oct.frequency.linearRampToValueAtTime(n.f * 2, tt + port);
      }
      // a single grace note into longer notes — an upper neighbor, lightly
      if (n.dur > 1.6 && i > 0 && chance(graceAmt * 0.5)) {
        var gf = n.f * Math.pow(2, 1 / 12 * 2);
        o.frequency.setValueAtTime(gf, tt - 0.09);
        o.frequency.linearRampToValueAtTime(n.f, tt + 0.05);
      }
      emitNote("clarinet", n.f, tt, n.dur);
      tt += n.dur;
      total += n.dur;
    }
    // delayed vibrato: fades in after 40% of the line, stays shallow.
    // LESSON (Bardo's conch): keep LFO depth well under the fundamental so
    // frequency never goes negative — depth here is f*0.004, tiny by design.
    if (vib > 0.05) {
      var lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(rnd(4.5, 5.5), t);
      var lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t);
      lg.gain.setValueAtTime(0, t + total * 0.4);
      lg.gain.linearRampToValueAtTime(notes[0].f * 0.004 * vib * 2, t + total * 0.7);
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + total + 0.5);
    }
    var peak = (gainMul || 1) * 0.34;
    env(g, t, [[rnd(0.4, 0.8), peak], [Math.max(0.2, total - 1.8), peak * 0.9], [rnd(0.9, 1.4), 0]]);
    o.start(t); o.stop(t + total + 1.6);
    oct.start(t); oct.stop(t + total + 1.6);
    return total;
  }
  function clarinetToNotes(motif, beat) {
    return motif.notes.map(function (n, i) {
      var d = n.durBeats * beat;
      if (i === 0 || i === motif.notes.length - 1) d = Math.max(d, beat * rnd(1.6, 2.4));
      // a wind player's phrase keeps moving: interior notes ≤ ~3 beats, the
      // ends ≤ ~4 — augmented material sings long in the choir, not here
      d = Math.min(d, beat * (i === motif.notes.length - 1 ? 4 : 2.8));
      return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.max(0.4, d) };  // an octave above the choir root
    });
  }
  function clarinetPhrase() {
    if (!playing) return;
    var s = C.section;
    var speaks = s === "prelude" || s === "hymn" || s === "testimony" || s === "doxology" || s === "postlude";
    if (!speaks || inHush() || inFuging()) { scheduleRaw(clarinetPhrase, 6000); return; }
    if (!airFree()) { scheduleRaw(clarinetPhrase, rnd(5, 11) * 1000); return; }
    // in the prelude the deacon only occasionally tries a line over the organ
    if (s === "prelude" && chance(0.55)) { scheduleRaw(clarinetPhrase, rnd(10, 18) * 1000); return; }

    var pace = getLayerParam("clarinet", "pace", 1);
    var beat = rnd(1.0, 1.4) / pace;
    var motif = Motif.overdueFor("clarinet") ? Motif.claim("clarinet") : Motif.request("clarinet");
    if (!motif) { scheduleRaw(clarinetPhrase, 6000); return; }

    var t = ctx.currentTime + 0.12;
    var total;
    var lined = false;
    var spoken = motif;                                        // what actually sounded (the shadow reads this)
    if (s === "hymn" && chance(0.5)) {
      // LINING-OUT: state the first line of the hymn plainly, then post it to
      // the choir, which sings it back harmonized and slower.
      var nSyl = (METERS[C.meter] || METERS.CM)[0];
      var line = Prosody.pourIntoLine(motif, nSyl);
      var lm = { name: motif.name, gen: motif.gen, chain: motif.chain.slice(), gesture: motif.gesture, notes: line };
      total = renderClarinetLine(t, clarinetToNotes(lm, beat), 1);
      Motif.post("clarinet", "choir", lm, "line-out");
      emitEvent({ cat: "verse", label: "☞ the deacon lines out", detail: C.meter + " · " + nSyl + " syllables · " + motif.name });
      lined = true;
      spoken = lm;
    } else {
      // chord-tone gravity: strong-position notes lean onto the sounding chord
      var tones = Harmony.chordTones();
      var m2 = JSON.parse(JSON.stringify(motif));
      if (tones) {
        for (var i = 0; i < m2.notes.length; i += 2) {
          var pd = projDeg(m2.notes[i].deg);
          var cls = ((pd % colN()) + colN()) % colN();
          if (!tones[cls] && chance(0.7)) {
            var up = ((pd + 1) % colN() + colN()) % colN();
            m2.notes[i].deg += tones[up] ? 1 : -1;
          }
        }
      }
      // A SPEECH, not a fragment: pour the idea into a full metered line —
      // a short gesture walks on toward its rest tone — and usually answer
      // it with a consequent after a breath. Antecedent–consequent: the
      // period form the hymns think in.
      var nSy = Math.max(m2.notes.length, pickW([[6, 1], [8, 3], [10, 2], [12, 1]]));
      var line1 = Prosody.pourIntoLine(m2, nSy);
      var gm2 = s === "testimony" ? 0.8 : 1;
      spoken = { name: m2.name, gen: m2.gen, chain: [], gesture: m2.gesture, notes: line1 };
      total = renderClarinetLine(t, clarinetToNotes(spoken, beat), gm2);
      if (chance(s === "testimony" ? 0.35 : 0.6)) {
        var cons = Motif.develop("clarinet", motif, 1);
        var line2 = Prosody.pourIntoLine(cons, Math.max(4, nSy - pickW([[0, 2], [2, 2]])));
        var breath2 = rnd(1.4, 2.4);
        total += breath2 + renderClarinetLine(t + total + breath2, clarinetToNotes({ notes: line2 }, beat), gm2 * 0.95);
      }
      if (chance(0.4) && !lined) Motif.post("clarinet", pickW([["choir", 2], ["bells", 2], ["harmonium", 1]]), motif, pickW([["imitate", 3], ["invert", 2], ["develop", 2]]));
    }
    // the harmonium shadows the deacon a breath behind, in the parlor —
    // reading the line as actually spoken, not the raw motif
    if (chance(getLayerParam("harmonium", "shadow", 0.5)) && s !== "testimony") {
      harmoniumShadow(t + rnd(0.4, 0.9), spoken, beat);
    }
    claimAir(total, (s === "testimony" ? rnd(10, 22) : rnd(4, 10)) * silenceMul());
    var gap = (s === "testimony" ? rnd(18, 40) : rnd(9, 20)) * gapMul();
    scheduleLayer(clarinetPhrase, (total + gap) * 1000, "clarinet");
  }

  // ==========================================================================
  // VOICE: HARMONIUM — the parlor pump organ. Detuned saw pair through a
  // still reed formant; the bellows breathe at 0.2-0.4 Hz. Plays the inner
  // voices (alto+tenor) of the sounding chord, close and warm; shadows the
  // deacon's lines a breath behind.
  // ==========================================================================
  function renderHarmonium(t, notes, gainMul) {
    var reed = getLayerParam("harmonium", "reed", 0.5);
    var bellows = getLayerParam("harmonium", "bellows", 0.5);
    var dest = panAt("harmonium", rnd(-0.2, 0.2));
    var mix = ctx.createGain();
    var os = [];
    for (var d = 0; d < 2; d++) {
      var o = ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(notes[0].f * (d ? 1 + rnd(0.003, 0.005) : 1 - rnd(0.003, 0.005)), t);
      var og = ctx.createGain(); og.gain.setValueAtTime(0.5, t);
      o.connect(og); og.connect(mix);
      os.push(o);
    }
    var bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(1600 + reed * 800, t);         // the reed formant sits still
    bp.Q.setValueAtTime(2 + reed * 3, t);
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.setValueAtTime(2600, t);
    var g = ctx.createGain();
    mix.connect(bp); bp.connect(lp); lp.connect(g); g.connect(dest);
    // pitch walk
    var tt = t, total = 0;
    for (var i = 0; i < notes.length; i++) {
      var n = notes[i];
      if (i > 0) {
        for (var oi = 0; oi < os.length; oi++) {
          var det = oi ? 1.004 : 0.996;
          os[oi].frequency.setValueAtTime(notes[i - 1].f * det, tt);
          os[oi].frequency.linearRampToValueAtTime(n.f * det, tt + Math.min(0.3, n.dur * 0.3));
        }
      }
      tt += n.dur; total += n.dur;
    }
    // bellows: slow AM + a matching breath of pitch wobble
    if (bellows > 0.05) {
      var lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(rnd(0.2, 0.4), t);
      var lg = ctx.createGain(); lg.gain.setValueAtTime(bellows * 0.12, t);
      lfo.connect(lg); lg.connect(g.gain);
      lfo.start(t); lfo.stop(t + total + 0.5);
    }
    var peak = (gainMul || 1) * 0.22;
    env(g, t, [[rnd(0.8, 1.4), peak], [Math.max(0.2, total - 3), peak * 0.9], [rnd(1.4, 2), 0]]);
    for (var oi2 = 0; oi2 < os.length; oi2++) { os[oi2].start(t); os[oi2].stop(t + total + 2.2); }
    return total;
  }
  function harmoniumShadow(t, motif, beat) {
    // the parlor echo of the deacon: same page, +8 cents, quieter
    var det = Math.pow(2, 8 / 1200);
    var notes = motif.notes.map(function (n) {
      return { f: degFreq(projDeg(n.deg) + colN()) * det, dur: Math.max(0.4, n.durBeats * beat) };
    });
    renderHarmonium(t, notes, 0.5);
    emitNote("harmonium", notes[0].f, t, notes.length * beat);
    emitEvent({ cat: "motif", label: "〰 harmonium shadows the deacon", detail: motif.name + "·g" + motif.gen });
  }
  function harmoniumCycle() {
    if (!playing) return;
    var s = C.section;
    var plays = s === "prelude" || s === "hymn" || s === "doxology" || s === "postlude";
    if (!plays || inHush()) { scheduleRaw(harmoniumCycle, 8000); return; }
    // the parlor ANSWERS the deacon when an obligation stands — a fourth
    // conversational timbre, close and warm
    if (Motif.overdueFor("harmonium") && airFree()) {
      var ans = Motif.claim("harmonium");
      if (ans) {
        var abeat = rnd(1.1, 1.5);
        var poured = Prosody.pourIntoLine(ans, Math.max(ans.notes.length, rint(6, 8)));
        var anotes = poured.map(function (n) {
          return { f: degFreq(projDeg(n.deg) + colN()), dur: Math.min(abeat * 3.5, Math.max(0.5, n.durBeats * abeat)) };
        });
        var atot = renderHarmonium(ctx.currentTime + 0.1, anotes, 0.7);
        emitNote("harmonium", anotes[0].f, ctx.currentTime + 0.1, atot);
        claimAir(atot, rnd(4, 9) * silenceMul());
        scheduleLayer(harmoniumCycle, (atot + rnd(14, 26) * gapMul()) * 1000, "harmonium");
        return;
      }
    }
    var ch = Harmony.current();
    if (ch && chance(0.55)) {
      var dur = rnd(9, 15);
      // the inner voices: tenor + alto, sustained — an occasional warmth,
      // not a constant one; the hymn keeps its sky
      renderHarmonium(ctx.currentTime + 0.1, [{ f: ch.freqs[1], dur: dur }], 0.6 * (0.5 + intensity() * 0.6));
      renderHarmonium(ctx.currentTime + rnd(0.2, 0.6), [{ f: ch.freqs[2], dur: dur * rnd(0.85, 1) }], 0.5 * (0.5 + intensity() * 0.6));
      emitNote("harmonium", ch.freqs[1], ctx.currentTime + 0.1, dur);
    }
    scheduleLayer(harmoniumCycle, rnd(14, 26) * 1000 * gapMul(), "harmonium");
  }

  // ==========================================================================
  // VOICE: STRINGS — the prairie. Open fifths of the sounding chord in long
  // trapezoid pads; one quiet high "lonesome" partial riding above. Widest in
  // the doxology; silent in the invocation and the sacrament.
  // ==========================================================================
  function stringsPad(t, dur, gainMul, fifthOnly) {
    var warmth = getLayerParam("strings", "warmth", 0.5);
    var lonesome = getLayerParam("strings", "lonesome", 0.4);
    var ch = Harmony.current();
    var rootF = ch ? ch.freqs[0] * 2 : F0 * ROOT_MULT;
    var fifthF = rootF * 1.5;
    var pitches = fifthOnly ? [rootF, fifthF] : [rootF, fifthF, rootF * 2];
    var master = ctx.createGain();
    master.connect(panAt("strings", 0));
    var lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(700 + (1 - warmth) * 900 + intensity() * 900, t);  // set once, never swept
    lp.connect(master);
    for (var p = 0; p < pitches.length; p++) {
      for (var d = 0; d < 3; d++) {
        var o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(pitches[p] * (1 + (d - 1) * rnd(0.002, 0.0035)), t);
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.09 / pitches.length, t);
        o.connect(og); og.connect(lp);
        o.start(t); o.stop(t + dur + 0.5);
      }
    }
    if (lonesome > 0.05) {
      var lo = ctx.createOscillator();
      lo.type = "sine";
      lo.frequency.setValueAtTime(fifthF * 4, t);
      var lg = ctx.createGain(); lg.gain.setValueAtTime(lonesome * 0.05, t);
      lo.connect(lg); lg.connect(master);
      lo.start(t); lo.stop(t + dur + 0.5);
    }
    var peak = (gainMul || 1) * 0.7 * (0.4 + intensity() * 0.7);
    var edge = Math.min(8, dur * 0.3);
    env(master, t, [[edge, peak], [Math.max(0.5, dur - edge * 2), peak * 0.92], [edge, 0]]);
    emitNote("strings", rootF, t, dur);
  }
  function stringsCycle() {
    if (!playing) return;
    var s = C.section;
    if (s === "invocation" || s === "sacrament" || s === "interlude" || inHush()) { scheduleRaw(stringsCycle, 8000); return; }
    var dur = rnd(22, 34);
    var overlap = 8;
    stringsPad(ctx.currentTime + 0.1, dur, s === "doxology" ? 1 : 0.75, chance(0.7));
    scheduleLayer(stringsCycle, (dur - overlap) * 1000 * (s === "doxology" ? 0.9 : 1.3), "strings");
  }

  // ==========================================================================
  // VOICE: BELLS — the meetinghouse bell (section joints, festival peals) and
  // the muted TINE (the Cage nod: a prepared, damped, music-box tone that
  // taps motif heads between speeches, quantized to the sounding chord).
  // ==========================================================================
  function meetinghouseBell(t, gainMul) {
    if (!ctx) return;
    var ringAmt = getLayerParam("bells", "ring", 0.55);
    var dest = panAt("bells", rnd(-0.2, 0.2));
    var base = harm(pick([4, 5, 6]));
    while (base > 700) base /= 2;
    while (base < 300) base *= 2;
    var ratios = [1, 2.0, 2.76, 3.98, 5.4];
    var g0 = (gainMul || 0.6) * ringAmt * 0.55;
    for (var i = 0; i < ratios.length; i++) {
      for (var d = 0; d < 2; d++) {                            // beating doublets — a real bell shimmers
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(base * ratios[i] + (d ? rnd(0.4, 2.2) : 0), t);
        var og = ctx.createGain();
        o.connect(og); og.connect(dest);
        var pg = g0 * 0.5 / (1 + i * 1.0);
        env(og, t, [[0.005, pg], [rnd(3.5, 8) / (1 + i * 0.55), 0]]);
        o.start(t); o.stop(t + 10);
      }
    }
    var hum = ctx.createOscillator();
    hum.type = "sine"; hum.frequency.setValueAtTime(base * 0.5, t);
    var hg = ctx.createGain();
    hum.connect(hg); hg.connect(dest);
    env(hg, t, [[0.012, g0 * 0.28], [rnd(5, 9), 0]]);
    hum.start(t); hum.stop(t + 10);
    emitNote("bells", 0, t, 7);
  }
  function tineTap(t, f, amp) {
    var dest = panAt("bells", rnd(-0.4, 0.4));
    var partials = [[1, 1], [5.43, 0.35]];
    for (var i = 0; i < partials.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(f * partials[i][0], t);
      var og = ctx.createGain();
      o.connect(og); og.connect(dest);
      env(og, t, [[0.003, amp * partials[i][1]], [i === 0 ? rnd(0.7, 1.2) : rnd(0.12, 0.2), 0]]);
      o.start(t); o.stop(t + 1.5);
    }
    // the fingernail thump — the felt against the tine
    var n = noiseSource();
    var nf = ctx.createBiquadFilter(); nf.type = "lowpass"; nf.frequency.setValueAtTime(500, t);
    var ng = ctx.createGain();
    n.connect(nf); nf.connect(ng); ng.connect(dest);
    env(ng, t, [[0.003, amp * 0.2], [0.06, 0]]);
    n.start(t, noiseOffset()); n.stop(t + 0.15);
    emitNote("bells", f, t, 1);
  }
  function tineCycle() {
    if (!playing) return;
    var s = C.section;
    if (s === "invocation" || s === "sacrament" || inHush() || inFuging()) { scheduleRaw(tineCycle, 9000); return; }
    if (!airFree()) { scheduleRaw(tineCycle, rnd(6, 12) * 1000); return; }
    var tineAmt = getLayerParam("bells", "tine", 0.5);
    var motif = Motif.overdueFor("bells") ? Motif.claim("bells") : Motif.request("bells");
    if (!motif) { scheduleRaw(tineCycle, 9000); return; }
    var head = motif.notes.slice(0, rint(4, 6));
    var t = ctx.currentTime + 0.1;
    var beat = rnd(0.55, 0.85);
    var tones = Harmony.chordTones();
    var total = 0;
    for (var i = 0; i < head.length; i++) {
      var pd = projDeg(head[i].deg) + colN();                  // up where a music box lives
      if (tones) {
        var cls = ((pd % colN()) + colN()) % colN();
        if (!tones[cls]) pd += 1;                              // lean onto the chord
      }
      var f = degFreq(pd) * 2;
      tineTap(t + total, f, 0.3 * tineAmt * 2);
      total += Math.max(0.35, head[i].durBeats * beat * 0.6);
    }
    claimAir(total, rnd(3, 7));
    var gap = rnd(20, 45) * gapMul();
    scheduleLayer(tineCycle, (total + gap) * 1000, "bells");
  }

  // ==========================================================================
  // VOICE: THE STILL SMALL VOICE — a near-threshold murmur, close to the ear.
  // Not a wind, not an earthquake, not a fire. Speaks in the invocation and
  // the sacrament; in the sacrament it is the only moving thing over the
  // drone. Never words.
  // ==========================================================================
  var VOICE_VOWELS = [[320, 850], [430, 1100], [540, 1450], [660, 1800], [790, 2050]];
  function stillVoiceRender(t, dur) {
    var dest = panAt("voice", 0);
    var presence = getLayerParam("voice", "presence", 0.4);
    var sylAmt = getLayerParam("voice", "syllables", 0.4);
    var sylRate = 2 + sylAmt * 1.5;                            // 2-3.5 syl/s — slower than speech
    var o = ctx.createOscillator();
    o.type = "sawtooth";
    // recitation-tone drift — prosody, not song
    o.frequency.setValueAtTime(F0 * 2, t);
    o.frequency.linearRampToValueAtTime(F0 * 2 * rnd(0.985, 1.02), t + dur * 0.5);
    o.frequency.linearRampToValueAtTime(F0 * 2 * 0.985, t + dur);
    // LESSON: pre-attenuate before high-Q formants (they boost ~9x).
    var pre = ctx.createGain(); pre.gain.setValueAtTime(0.16, t);
    o.connect(pre);
    var f1 = ctx.createBiquadFilter(); f1.type = "bandpass"; f1.Q.setValueAtTime(5, t);
    var f2 = ctx.createBiquadFilter(); f2.type = "bandpass"; f2.Q.setValueAtTime(6, t);
    f1.frequency.setValueAtTime(500, t); f2.frequency.setValueAtTime(1400, t);
    var f1g = ctx.createGain(); f1g.gain.setValueAtTime(1, t);
    var f2g = ctx.createGain(); f2g.gain.setValueAtTime(0.6, t);
    var gate = ctx.createGain();
    var og = ctx.createGain();
    pre.connect(f1); f1.connect(f1g); f1g.connect(gate);
    pre.connect(f2); f2.connect(f2g); f2g.connect(gate);
    gate.connect(og); og.connect(dest);
    gate.gain.setValueAtTime(0, t);
    var st = t + 0.05, end = t + dur - 0.5;
    // formant jumps as short linearRamps, NEVER setTargetAtTime (biquad
    // frequency under exponential-approach automation destabilizes — measured)
    var pv1 = 500, pv2 = 1400;
    while (st < end) {
      var syl = 1 / (sylRate * rnd(0.8, 1.25));
      var v = pick(VOICE_VOWELS);
      f1.frequency.setValueAtTime(pv1, st); f1.frequency.linearRampToValueAtTime(v[0], st + 0.035);
      f2.frequency.setValueAtTime(pv2, st); f2.frequency.linearRampToValueAtTime(v[1], st + 0.035);
      pv1 = v[0]; pv2 = v[1];
      var on = Math.max(0.04, syl * 0.24);
      var hold = syl * rnd(0.4, 0.62);
      gate.gain.setValueAtTime(0, st);
      gate.gain.linearRampToValueAtTime(1, st + on);
      gate.gain.linearRampToValueAtTime(0, st + on + hold);
      st += syl + (chance(0.2) ? rnd(0.3, 1.1) : 0);           // long breath commas
    }
    var peak = 0.24 * presence;                                // truly near-threshold
    env(og, t, [[1.6, peak], [Math.max(0.4, dur - 3.4), peak * 0.9], [1.8, 0]]);
    o.start(t); o.stop(t + dur + 0.3);
    emitNote("voice", 0, t, dur);
    return dur;
  }
  function stillVoicePhrase() {
    if (!playing) return;
    var s = C.section;
    var speaks = s === "invocation" || s === "sacrament" || (s === "testimony" && chance(0.3));
    if (!speaks || inHush()) { scheduleRaw(stillVoicePhrase, 7000); return; }
    var dur = rnd(7, 15);
    stillVoiceRender(ctx.currentTime + 0.05, dur);
    scheduleLayer(stillVoicePhrase, (dur + rnd(6, 16) * silenceMul()) * 1000, "voice");
  }

  // ==========================================================================
  // VOICE: TELEGRAPH — the Deseret wire. The current theme's RHYTHM tapped as
  // dits and dahs on a soft keyed tone, panned far to one side, in the parlor.
  // Historical and interstellar at once. Rhythm only — no pitch risk.
  // ==========================================================================
  function telegraphCycle() {
    if (!playing) return;
    var s = C.section;
    var taps = s === "prelude" || s === "hymn" || s === "testimony" || s === "postlude";
    if (!taps || inHush() || chance(0.4)) { scheduleRaw(telegraphCycle, rnd(20, 40) * 1000); return; }
    var clack = getLayerParam("telegraph", "clack", 0.5);
    var theme = chance(0.7) ? Motif.theme() : Motif.anyWorking();
    if (!theme) { scheduleRaw(telegraphCycle, 15000); return; }
    var t = ctx.currentTime + 0.1;
    var carrier = F0 * 8;
    while (carrier > 720) carrier /= 2;
    while (carrier < 480) carrier *= 2;
    var side = pick([-0.8, 0.8]);
    var tt = t;
    var beats = theme.notes.slice(0, rint(4, 6));
    for (var i = 0; i < beats.length; i++) {
      var isDah = beats[i].durBeats >= 1;
      var len = isDah ? 0.19 : 0.07;
      var o = ctx.createOscillator();
      o.type = "square"; o.frequency.setValueAtTime(carrier, tt);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.setValueAtTime(carrier * 2.5, tt);
      var g = ctx.createGain();
      o.connect(lp); lp.connect(g); g.connect(panAt("telegraph", side));
      env(g, tt, [[0.004, 0.055], [len, 0.05], [0.02, 0]]);
      o.start(tt); o.stop(tt + len + 0.1);
      tt += len + rnd(0.08, 0.14);
      if (chance(0.25)) tt += 0.22;                            // letter space
    }
    // the relay clack — the instrument's wooden body speaking
    if (chance(clack)) {
      var n = noiseSource();
      var nf = ctx.createBiquadFilter();
      nf.type = "bandpass"; nf.frequency.setValueAtTime(rnd(1800, 2600), tt); nf.Q.setValueAtTime(5, tt);
      var ng = ctx.createGain();
      n.connect(nf); nf.connect(ng); ng.connect(panAt("telegraph", side));
      env(ng, tt, [[0.003, 0.04], [0.05, 0]]);
      n.start(tt, noiseOffset()); n.stop(tt + 0.12);
    }
    // once in a long while, a REPLY comes from home — the same marks,
    // fainter, from the other side of the sky
    if (chance(0.1)) {
      var rt = tt + rnd(1.5, 2.5);
      for (var ri = 0; ri < beats.length; ri++) {
        var rDah = beats[ri].durBeats >= 1;
        var rLen = rDah ? 0.19 : 0.07;
        var ro = ctx.createOscillator();
        ro.type = "square"; ro.frequency.setValueAtTime(carrier, rt);
        var rlp = ctx.createBiquadFilter();
        rlp.type = "lowpass"; rlp.frequency.setValueAtTime(carrier * 2.5, rt);
        var rg = ctx.createGain();
        ro.connect(rlp); rlp.connect(rg); rg.connect(panAt("telegraph", -side));
        env(rg, rt, [[0.004, 0.033], [rLen, 0.03], [0.02, 0]]);
        ro.start(rt); ro.stop(rt + rLen + 0.1);
        rt += rLen + rnd(0.08, 0.14);
      }
      tt = rt;
      emitEvent({ cat: "telegraph", label: "⌁ a reply from home", detail: theme.name });
    }
    emitNote("telegraph", 0, t, tt - t);
    emitEvent({ cat: "telegraph", label: "⌁ the wire taps the theme", detail: theme.name + " · " + beats.length + " marks" });
    scheduleLayer(telegraphCycle, (tt - t + rnd(45, 90) * gapMul()) * 1000, "telegraph");
  }

  // ==========================================================================
  // AMBIENT — the valley. Six far-field events, most of them nearly nothing:
  // wind off the benches, crickets after dark, the meetinghouse clock, a
  // tuning fork giving the pitch, a far bell, and the KOLOB BEACON — the
  // meeting's theme flashed home as light-Morse behind a narrow static.
  // ==========================================================================
  function evWind(t) {
    var dur = rnd(12, 24);
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(rnd(260, 520), t);
    var g = ctx.createGain();
    n.connect(f); f.connect(g); g.connect(panAt("ambient", rnd(-0.5, 0.5)));
    env(g, t, [[dur * 0.45, 0.055], [dur * 0.55, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.3);
    emitNote("ambient", 0, t, dur);
    return "wind off the benches";
  }
  function evCrickets(t) {
    if (intensity() > 0.5) return evWind(t);                   // crickets keep still when the hall is full
    var span = rnd(4, 9);
    var f = rnd(4200, 4800);
    var period = rnd(0.38, 0.5);
    var tt = t;
    while (tt < t + span) {
      for (var c = 0; c < 2; c++) {                            // the paired chirp
        var o = ctx.createOscillator();
        o.type = "sine"; o.frequency.setValueAtTime(f, tt + c * 0.045);
        var g = ctx.createGain();
        o.connect(g); g.connect(panAt("ambient", 0.5));
        env(g, tt + c * 0.045, [[0.004, 0.016], [0.035, 0]]);
        o.start(tt + c * 0.045); o.stop(tt + c * 0.045 + 0.08);
      }
      tt += period * rnd(0.9, 1.15);
    }
    emitNote("ambient", 0, t, span);
    return "crickets";
  }
  function evClock(t) {
    var ticks = rint(4, 8);
    for (var i = 0; i < ticks; i++) {
      var tt = t + i * rnd(0.96, 1.04);
      var o = ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(i % 2 ? 430 : 480, tt);
      var g = ctx.createGain();
      o.connect(g); g.connect(panAt("ambient", -0.55));
      env(g, tt, [[0.002, 0.03], [0.06, 0]]);
      o.start(tt); o.stop(tt + 0.12);
    }
    emitNote("ambient", 0, t, ticks);
    return "the meetinghouse clock";
  }
  function evTuningFork(t) {
    var f = harm(8);
    while (f > 900) f /= 2;
    var o = ctx.createOscillator();
    o.type = "sine"; o.frequency.setValueAtTime(f, t);
    var g = ctx.createGain();
    o.connect(g); g.connect(panAt("ambient", 0));
    env(g, t, [[0.01, 0.05], [rnd(6, 10), 0]]);
    o.start(t); o.stop(t + 11);
    emitNote("ambient", f, t, 8);
    return "a tuning fork, giving the pitch";
  }
  function evFarBell(t) {
    var base = harm(pick([4, 5]));
    while (base > 520) base /= 2;
    var ratios = [1, 2.0, 2.76];
    for (var i = 0; i < ratios.length; i++) {
      var o = ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(base * ratios[i] + (i ? rnd(0.3, 1.4) : 0), t);
      var g = ctx.createGain();
      o.connect(g); g.connect(panAt("ambient", pick([-0.6, 0.6])));
      env(g, t, [[0.02, 0.035 / (1 + i * 0.8)], [rnd(6, 11) / (1 + i * 0.5), 0]]);
      o.start(t); o.stop(t + 12);
    }
    emitNote("ambient", base, t, 8);
    return "a bell across the valley";
  }
  function evBeacon(t) {
    // the colony flashes the day's theme toward home — sine Morse behind a
    // narrow-band static that is not quite there
    var theme = Motif.theme();
    var head = theme ? theme.notes.slice(0, rint(3, 5)) : [{ deg: 0, durBeats: 1 }, { deg: 4, durBeats: 2 }];
    var side = pick([-0.7, 0.7]);
    var st = noiseSource();
    var sf = ctx.createBiquadFilter();
    sf.type = "bandpass"; sf.frequency.setValueAtTime(rnd(950, 1200), t); sf.Q.setValueAtTime(14, t);
    var sg = ctx.createGain();
    st.connect(sf); sf.connect(sg); sg.connect(panAt("ambient", side));
    var span = head.length * 0.5 + 1.5;
    env(sg, t, [[0.4, 0.014], [span, 0.011], [0.6, 0]]);
    st.start(t, noiseOffset()); st.stop(t + span + 1.2);
    var tt = t + 0.5;
    for (var i = 0; i < head.length; i++) {
      var f = degFreq(projDeg(head[i].deg));
      while (f > 1000) f /= 2;
      while (f < 600) f *= 2;
      var isDah = head[i].durBeats >= 1;
      var o = ctx.createOscillator();
      o.type = "sine"; o.frequency.setValueAtTime(f, tt);
      var g = ctx.createGain();
      o.connect(g); g.connect(panAt("ambient", side));
      env(g, tt, [[0.01, 0.028], [isDah ? 0.3 : 0.1, 0.024], [0.05, 0]]);
      o.start(tt); o.stop(tt + 0.6);
      emitNote("ambient", f, tt, isDah ? 0.35 : 0.15);
      tt += (isDah ? 0.42 : 0.22) + rnd(0.05, 0.12);
    }
    return "the Kolob beacon";
  }
  // rain on the roof — a rare visitor; the patter is an LFO on lowpassed noise
  function evRain(t) {
    var dur = rnd(8, 16);
    var n = noiseSource();
    var f = ctx.createBiquadFilter();
    f.type = "lowpass"; f.frequency.setValueAtTime(rnd(900, 1400), t);
    var patter = ctx.createGain();
    patter.gain.setValueAtTime(0.7, t);
    var lfo = ctx.createOscillator(); lfo.frequency.setValueAtTime(rnd(0.5, 1), t);
    var lg = ctx.createGain(); lg.gain.setValueAtTime(0.3, t);
    lfo.connect(lg); lg.connect(patter.gain);
    var g = ctx.createGain();
    n.connect(f); f.connect(patter); patter.connect(g); g.connect(panAt("ambient", 0));
    env(g, t, [[dur * 0.35, 0.04], [dur * 0.65, 0]]);
    n.start(t, noiseOffset()); n.stop(t + dur + 0.3);
    lfo.start(t); lfo.stop(t + dur + 0.3);
    emitNote("ambient", 0, t, dur);
    return "rain on the roof";
  }
  // a far coyote — a falling fifth, very quiet, once in a great while
  function evCoyote(t) {
    var f = harm(6);
    while (f > 700) f /= 2;
    while (f < 380) f *= 2;
    var o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.linearRampToValueAtTime(f * 1.5, t + 0.25);
    o.frequency.linearRampToValueAtTime(f, t + rnd(1.2, 1.8));
    var g = ctx.createGain();
    o.connect(g); g.connect(panAt("ambient", pick([-0.7, 0.7])));
    env(g, t, [[0.2, 0.02], [1.2, 0.014], [0.5, 0]]);
    o.start(t); o.stop(t + 2.4);
    emitNote("ambient", 0, t, 2);                              // a gliss owns no single pitch
    return "a far coyote";
  }
  function ambientEvent() {
    if (!playing) return;
    var s = C.section;
    if (s === "sacrament" || inHush()) { scheduleRaw(ambientEvent, 9000); return; }
    var pool = s === "invocation"
      ? [[evWind, 4], [evCrickets, 3], [evTuningFork, 2]]
      : [[evWind, 4], [evCrickets, 3], [evClock, 3], [evTuningFork, 2], [evFarBell, 3], [evBeacon, 2.5], [evRain, 0.3], [evCoyote, 0.3]];
    var fn = pickW(pool);
    var name = fn(ctx.currentTime + 0.1);
    emitEvent({ cat: "ambient", label: "⋆ " + name, detail: s });
    var gap = rnd(25, 70) * (1.15 - intensity() * 0.35) * silenceMul();
    scheduleLayer(ambientEvent, gap * 1000, "ambient");
  }

  // ==========================================================================
  // SAMPLE — one short isolated gesture per layer, playable while stopped
  // (touch an instrument on the stop rail, hear it alone).
  // ==========================================================================
  function sample(layer) {
    init();
    if (!SCALE.length) rebuildScale();
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    if (!playing && voicesBus) {
      // stopped: reopen the bus and only this layer's gain, so the audition
      // sounds alone
      voicesBus.gain.cancelScheduledValues(ctx.currentTime);
      voicesBus.gain.setValueAtTime(1, ctx.currentTime);
      applyLayerGain(layer);
    }
    var t = ctx.currentTime + 0.08;
    switch (layer) {
      case "organ": {
        var ch = Harmony.voice(0, { open: false });
        organChord(t, 6, ch, 0.85);
        break;
      }
      case "drone": {
        var master = ctx.createGain();
        master.connect(panAt("drone", 0));
        [[1, 0.4], [2, 0.24], [3, 0.12]].forEach(function (p) {
          var o = ctx.createOscillator();
          o.type = "sine"; o.frequency.setValueAtTime(harm(p[0]), t);
          var og = ctx.createGain(); og.gain.setValueAtTime(p[1], t);
          o.connect(og); og.connect(master);
          o.start(t); o.stop(t + 7);
        });
        env(master, t, [[2.4, 0.5], [2, 0.46], [2.2, 0]]);
        emitNote("drone", F0, t, 6.5);
        break;
      }
      case "choir": {
        var ch2 = Harmony.voice(0, { open: false });
        [0, 1, 3].forEach(function (vi, k) {
          choirVoiceLine(t + k * 0.12, [{ f: ch2.freqs[VI_TO_CHORDPOS[vi]], dur: 4.5 }], vi, 0.85);
        });
        emitNote("choir", ch2.freqs[3], t, 4.5);
        break;
      }
      case "clarinet": {
        var notes = [[-3, 1], [0, 2], [1, 1], [0, 2.6]].map(function (n) {
          return { f: degFreq(projDeg(n[0]) + colN()), dur: n[1] };
        });
        renderClarinetLine(t, notes, 1);
        break;
      }
      case "harmonium": {
        renderHarmonium(t, [{ f: degFreq(projDeg(2)), dur: 5 }], 0.8);
        emitNote("harmonium", degFreq(projDeg(2)), t, 5);
        break;
      }
      case "strings": stringsPad(t, 9, 0.9, false); break;
      case "bells":
        meetinghouseBell(t, 0.8);
        tineTap(t + 2.2, degFreq(projDeg(4) + colN()) * 2, 0.3);
        break;
      case "voice": stillVoiceRender(t, 4.5); break;
      case "telegraph": {
        var tt = t, marks = [1, 0.5, 1, 2];
        var carrier = F0 * 8;
        while (carrier > 720) carrier /= 2;
        while (carrier < 480) carrier *= 2;
        marks.forEach(function (mLen) {
          var isDah = mLen >= 1;
          var len = isDah ? 0.19 : 0.07;
          var o = ctx.createOscillator();
          o.type = "square"; o.frequency.setValueAtTime(carrier, tt);
          var lp = ctx.createBiquadFilter();
          lp.type = "lowpass"; lp.frequency.setValueAtTime(carrier * 2.5, tt);
          var g = ctx.createGain();
          o.connect(lp); lp.connect(g); g.connect(panAt("telegraph", 0.6));
          env(g, tt, [[0.004, 0.055], [len, 0.05], [0.02, 0]]);
          o.start(tt); o.stop(tt + len + 0.1);
          tt += len + 0.11;
        });
        emitNote("telegraph", 0, t, tt - t);
        break;
      }
      case "ambient": evFarBell(t); break;
      default: return;
    }
    emitEvent({ cat: "transport", label: "◈ sample " + layer, detail: "" });
  }

  // ==========================================================================
  // TRANSPORT
  // ==========================================================================
  function play() {
    init();
    if (playing) return;
    if (ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
    playing = true;
    air.busyUntil = 0; air.holders = 0;
    if (voicesBus) {
      voicesBus.gain.cancelScheduledValues(ctx.currentTime);
      voicesBus.gain.setValueAtTime(1, ctx.currentTime);
    }
    masterGain.gain.setValueAtTime(masterVolume, ctx.currentTime);
    LAYERS.forEach(applyLayerGain);
    planMeeting();
    // staggered assembly — the valley wakes the way a Sunday begins
    droneCycle();
    scheduleRaw(organCycle, 2500);
    scheduleRaw(stillVoicePhrase, 12000);
    scheduleRaw(ambientEvent, 16000);
    scheduleRaw(choirVerse, 20000);
    scheduleRaw(stringsCycle, 24000);
    scheduleRaw(harmoniumCycle, 30000);
    scheduleRaw(clarinetPhrase, 34000);
    scheduleRaw(tineCycle, 42000);
    scheduleRaw(telegraphCycle, 55000);
    scheduleRaw(conductorTick, 1000);
    emitEvent({ cat: "transport", label: "▶ the meeting is called", detail: "seed " + seed });
  }
  function stop() {
    playing = false;
    clearAllTimers();
    if (voicesBus && ctx) {
      var t = ctx.currentTime;
      // fade the voices bus to zero and LEAVE it there — the drone's
      // oscillators keep running for up to 90s, silently, until they end
      voicesBus.gain.cancelScheduledValues(t);
      voicesBus.gain.setValueAtTime(voicesBus.gain.value != null ? voicesBus.gain.value : 1, t);
      voicesBus.gain.linearRampToValueAtTime(0, t + 0.6);
      // a stop during a stillness would otherwise strand the master at its
      // hushed level; restore it silently behind the closed bus
      masterGain.gain.cancelScheduledValues(t);
      masterGain.gain.setValueAtTime(masterVolume, t + 0.7);
      scheduleForStop();
    }
    emitEvent({ cat: "transport", label: "■ the benches empty", detail: "" });
  }
  function scheduleForStop() {
    setTimeout(function () {
      if (!playing && ctx) {
        // belt and braces: zero the layer gains too, so a later sample() of
        // one stop cannot resurrect another layer's lingering cycle
        LAYERS.forEach(function (l) {
          if (layerGains[l]) layerGains[l].gain.setValueAtTime(0, ctx.currentTime);
        });
      }
    }, 800);
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================
  return {
    init: init,
    play: play,
    stop: stop,
    isPlaying: function () { return playing; },
    sample: sample,
    setMasterVolume: function (v) { masterVolume = v; if (masterGain && ctx && playing) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1); },
    setLayerVolume: function (layer, v) { layerVolumes[layer] = v; if (ctx) applyLayerGain(layer); },
    toggleLayer: function (layer) { layerMuted[layer] = !layerMuted[layer]; if (ctx) applyLayerGain(layer); return !layerMuted[layer]; },
    setLayerRate: function (layer, r) { layerRate[layer] = r; },
    setLayerParam: function (layer, key, v) { if (!layerParams[layer]) layerParams[layer] = {}; layerParams[layer][key] = v; },
    getLayerParam: getLayerParam,
    getLayerDefaults: function () { return JSON.parse(JSON.stringify(LAYER_PARAM_DEFAULTS)); },
    getLayers: function () { return LAYERS.slice(); },
    getVolumes: function () { return JSON.parse(JSON.stringify(layerVolumes)); },
    getSeed: function () { return seed; },
    reseed: function (s) { seed = (s >>> 0) || 1847; rngState = seed; },
    getConductor: function () {
      return {
        meeting: C.meetingNum, activity: C.meeting ? C.meeting.activity : null,
        section: C.section, meter: C.meter, mode: mode,
        local: localArc(), intensity: intensity(),
        hush: inHush(), fuging: inFuging(),
        f0: F0, season: seasonPos,
        sectionIndex: C.si, planLength: C.plan.length,
        fifths: Harmony.fifthCount(),
      };
    },
    getHarmony: function () { return Harmony.current(); },
    getAudioTime: function () { return ctx ? ctx.currentTime : 0; },
    skipToSection: skipToSection,
    getMotifStats: function () { return Motif.stats(); },
    setNoteListener: function (fn) { noteListeners.push(fn); },
    setEventListener: function (fn) { eventListeners.push(fn); },
    attachAnalyser: function () {
      if (!ctx || !masterGain) return null;
      var an = ctx.createAnalyser(); an.fftSize = 1024;
      masterGain.connect(an);
      return an;
    },
  };
})();

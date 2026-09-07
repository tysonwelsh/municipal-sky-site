// ============================================================================
// ZANKYŌ 逸脱 ITSUDATSU — zk-far.js: the far tail's law, registry and naming.
//
// One seeded draw at PLAY sets the night's DISTANCE FROM HOME, d ∈ [0, 1].
// About four nights in five come out below 0.15 and are HOME — the engine as
// it shipped at 2.1.0-rc.1, note for note. The rest depart: one or two
// moderate departures in the middle band, several stacked past 0.7, and past
// 0.9 (about one night in fifty) the station is somewhere else entirely.
//
// This module is the law and the LEDGER OF DEPARTURES, and nothing else. It
// holds no audio, touches no DOM, reads no clock, and makes no decision the
// engine could not have made itself — it just makes every one of them in one
// readable place, so the owner and the critic can see what a far night IS
// before hearing it. `zankyo-audio.js` asks it one question at PLAY (what is
// tonight?) and one per cycle (does this cycle lean further out?), and from
// then on only ever READS the answer. No RNG at query time, ever: a hook
// asked ten thousand times consumes zero draws, which is what keeps the far
// stream from ever perturbing the streams that make the music.
//
// The registry declares ALL departures from the first commit, including the
// ones no phase has wired yet — and every drawn departure draws its
// parameters on its own sub-fork ("dep:<id>"). So wiring a hook later, or
// re-tuning one departure's numbers, cannot re-roll any other departure, any
// other night, or the home nights. That isolation is the whole architecture.
//
// PURE: depends only on PJ2.Rand, at call time. Loadable headless.
// ============================================================================

window.ZK_FAR = (function () {
  "use strict";

  // Below this, the night is home: the draw is taken, nothing else happens,
  // and the note stream is byte-identical to 2.1.0-rc.1.
  var D_HOME = 0.15;
  // The lowest departure threshold, and it sits exactly ON D_HOME (critic's
  // W0 ruling): otherwise nights just above 0.15 would unlock nothing and
  // sound like home too, and the plan's 80 % would really be 81.4 %. With
  // 撓 sagging clock reaching down to here, every night that is not home
  // carries at least one departure, and the table is the table.
  var D_MIN = 0.15;

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  // ==========================================================================
  // THE LAW — a piecewise-linear quantile function on one uniform draw.
  //
  // Not a fitted Pareto: the plan states the shares as a table, and a
  // quantile function reproduces that table EXACTLY and can be audited by
  // eye. Densities run 5.33 → 0.27 → 0.15 → 0.20 across the four pieces, so
  // the tail is heavy by construction.
  //
  //   u < 0.80          → d ∈ [0, 0.15)     80 %   home
  //   0.80 ≤ u < 0.95   → d ∈ [0.15, 0.70)  15 %   one or two departures
  //   0.95 ≤ u < 0.98   → d ∈ [0.70, 0.90)   3 %   far: several stacked
  //   0.98 ≤ u          → d ∈ [0.90, 1.00]   2 %   interstellar
  //
  // P(d ≥ 0.8) = 3.5 % — the hidden switch's hunt costs ~29 evaluations.
  // ==========================================================================
  function law(u) {
    if (!(u >= 0)) u = 0; else if (u >= 1) u = 0.9999999;
    if (u < 0.80) return 0.15 * (u / 0.80);
    if (u < 0.95) return 0.15 + 0.55 * ((u - 0.80) / 0.15);
    if (u < 0.98) return 0.70 + 0.20 * ((u - 0.95) / 0.03);
    return 0.90 + 0.10 * ((u - 0.98) / 0.02);
  }

  // The night's distance as a PURE FUNCTION OF THE SEED. The engine forks
  // "far" off the master stream and d is that fork's first draw, so this
  // reproduces it without building an engine — which is what lets the hidden
  // switch hunt for a far seed at ~29 evaluations instead of 29 performances.
  function dForSeed(seed) {
    var R = window.PJ2 && window.PJ2.Rand;
    if (!R) return 0;
    return law(R.stream(seed >>> 0).fork("far").next());
  }

  // Walk seeds upward from `from` until one lands at or past minD. Returns
  // the seed, or null if the cap is reached (never expected: at P = 3.5 % the
  // chance of 5 000 consecutive misses is ~10^-77).
  function seek(from, minD, maxTries) {
    var s = (from >>> 0), n = maxTries || 5000;
    for (var i = 1; i <= n; i++) {
      var c = (s + i) >>> 0;
      if (dForSeed(c) >= minD) return c;
    }
    return null;
  }

  // ==========================================================================
  // THE BANDS — what the VFD calls the night before it has a proper name.
  // ==========================================================================
  var BANDS = [
    { at: 0.90, kana: "星間", label: "interstellar" },
    { at: 0.70, kana: "深",   label: "the deep" },
    { at: 0.45, kana: "遠",   label: "far out" },
    { at: D_HOME, kana: "漂", label: "adrift" },
    { at: 0,    kana: "家",   label: "home" },
  ];
  function band(d) {
    for (var i = 0; i < BANDS.length; i++) if (d >= BANDS[i].at) return BANDS[i];
    return BANDS[BANDS.length - 1];
  }

  // ==========================================================================
  // THE REGISTRY — every departure the plan names, declared from the start.
  //
  //   id      the engine's handle: FAR.on("sag")
  //   kana    the VFD's word for it
  //   family  音律 pitch · 時間 time · 形 form · 合奏 ensemble · 音色 spectrum
  //   d       unlock threshold — the night's distance must REACH it (>=, so a
  //           night at exactly D_HOME, which is not home, still carries 撓)
  //   w       draw weight once unlocked
  //   no      incompatible ids (normalised symmetric below)
  //   phase   which build phase wires the hook (documentation only)
  //   params  seeded parameters, drawn on this departure's OWN sub-fork
  //
  // `amt` (0…1) is how far this departure goes tonight: how far past its own
  // threshold d sits, jittered. A departure at its threshold barely leans;
  // the same departure at d = 0.95 is unmistakable.
  // ==========================================================================
  // The voices 双 bitonality may send across to the second field. "sho2" is
  // the shō's odd pipes — the cluster straddling both fields, which is what
  // the plan asks the shō to do.
  var BITO_VOICES = ["shakuhachi", "hichiriki", "koto", "shamisen", "biwa", "sho2"];

  var REGISTRY = [
    // ---- 音律 pitch and tuning ----
    { id: "sag", kana: "撓", name: "sagging clock", family: "音律", d: 0.15, w: 3.0, phase: "W1",
      // The octave itself leaves 1200 cents (the plan's 1180–1230 band, pulled
      // toward 1200 at low amt). Everything stays self-consistent: nothing is
      // out of tune with itself, the whole field is somewhere else.
      params: function (R, d, amt) { var c = 1180 + R.rnd(0, 50); return { cents: 1200 + (c - 1200) * amt }; } },
    { id: "ear", kana: "耳", name: "koto by ear", family: "音律", d: 0.30, w: 2.6, phase: "W1",
      // Just intonation for the plucked bodies while the winds stay tempered —
      // a real ensemble's disagreement. `depth` is how far the snap is taken.
      // 5-LIMIT ONLY (critic, W0 r1 §4): the hirajoshi thirds as 6/5 and 5/4,
      // the fourths as 4/3 and 3/2. A 7-limit interval reads as blues, which is
      // the wrong country — the draw chooses which degrees are taken, not how
      // far out the prime limit goes.
      params: function (R, d, amt) { return { depth: 0.35 + 0.65 * amt, limit: 5, strict: R.chance(0.35) }; } },
    { id: "meri", kana: "減", name: "meri quarter-tones", family: "音律", d: 0.40, w: 2.2, phase: "W1",
      // The semitone steps split. PJ2.Pitch's equal-tempered path already
      // accepts fractional mode steps, so this needs no substrate change.
      params: function (R, d, amt) { return { split: 0.5, walk: 0.25 + 0.5 * amt, which: R.chance(0.5) ? "low" : "all" }; } },
    { id: "bito", kana: "双", name: "two modes at once", family: "音律", d: 0.60, w: 1.8, phase: "W1", no: ["spiral"],
      // One voice on the tonic, another a fourth, a fifth or — at the far end —
      // a tritone away. The plan's example is the tritone, but a fourth or a
      // fifth shares more tones and is the more Japanese disagreement (the sea
      // change already travels by fourths), so the tritone is where this goes
      // when it goes furthest, not where it starts: its weight rises with amt
      // (critic, W0 r1 §4).
      params: function (R, d, amt) {
        var share = 0.3 + 0.35 * amt, camp = {}, i;
        // who crosses to the second field. Every voice draws, unconditionally;
        // the shō straddles by alternating pipes ("sho2" is its odd half), so
        // it is drawn separately and can be the only crossing there is.
        for (i = 0; i < BITO_VOICES.length; i++) if (R.chance(share)) camp[BITO_VOICES[i]] = 1;
        // A PREFERENCE, not a decision. Measured on the probe: a second field
        // a fifth up in in-sen has exactly hirajoshi's pitch classes — it is
        // not bitonality, it is the same scale spelled differently, and
        // neither the metric nor the ear can tell. So the night draws an
        // ordered preference and the ENGINE picks, at each cycle, the pairing
        // that shares fewest pitch classes with the mode actually in force.
        // No new draws: the ordering is the draw.
        return { interval: R.pickW([[5, 3], [7, 3], [6, 6 * amt * amt]]),
          modes: R.shuffle(["insen", "iwato", "kumoi", "hirajoshi"]),
          intervals: R.shuffle([5, 6, 7]), share: share, camp: camp };
      } },
    { id: "spiral", kana: "螺", name: "the spiral", family: "音律", d: 0.75, w: 1.5, phase: "W1", no: ["bito"],
      // The tonic glides, a few cents a second: a key that never arrives.
      params: function (R, d, amt) { return { centsPerS: (R.chance(0.5) ? 1 : -1) * (0.6 + 3.4 * amt), wrap: 1200 }; } },

    // ---- 時間 time ----
    { id: "dilate", kana: "遅", name: "dilation", family: "時間", d: 0.25, w: 3.0, phase: "W1",
      // A cycle at 0.4× speed (a forty-minute jo of single notes) or at 2.5×.
      // NAMED AS TIME, not as speed, because that is what the engine multiplies
      // and the first version got it backwards for exactly that reason (the
      // critic caught it): a cycle at 0.4× SPEED is time stretched 2.5×. So
      // `slowMul` ≥ 1 is the glacial side and `fastMul` ≤ 1 the frantic one,
      // and at amt 1 they are the plan's own 2.5 and 0.4. `slow` says which
      // side the night leans. Under 雲 clouds the glacial side is forbidden.
      params: function (R, d, amt) { return { slowMul: 1 + 1.5 * amt, fastMul: 1 - 0.6 * amt, slow: R.chance(0.55) }; } },
    { id: "vari", kana: "弛", name: "varispeed", family: "時間", d: 0.50, w: 2.2, phase: "W1",
      // The whole ensemble sags in pitch AND time like a dying tape, then
      // snaps or crawls back. Drones and reverb tails included.
      params: function (R, d, amt) { return { semis: -(1 + 3 * amt), overS: 60 + R.rnd(0, 180), snap: R.chance(0.45) }; } },
    { id: "canon", kana: "影", name: "tempo canons", family: "時間", d: 0.60, w: 1.8, phase: "W1",
      // The same motif in koto / shamisen / biwa at 3:4:5 — they converge,
      // pass, diverge. Nancarrow on a pentatonic.
      params: function (R, d, amt) { return { ratios: R.pick([[3, 4, 5], [4, 5, 6], [2, 3, 5]]), spreadS: 0.5 + 2 * amt }; } },

    // ---- 形 form ----
    { id: "erode", kana: "蝕", name: "eroded arc", family: "形", d: 0.30, w: 2.8, phase: "W1", no: ["disint"],
      // kyū-ha-jo: the cycle opens at the wall and decomposes. Or a jo that
      // never arrives. Or a double kyū.
      params: function (R, d, amt) { return { shape: R.pickW([["reversed", 3], ["nojo", 2], ["doublekyu", 2], ["stalled", 1.5]]) }; } },
    { id: "nokiru", kana: "未斬", name: "the KIRU fails", family: "形", d: 0.50, w: 2.2, phase: "W1", no: ["disint"],
      // The cut does not come. The wall runs straight into the next cycle's
      // jo, which is born inside it.
      params: function (R, d, amt) { return { every: R.chance(0.4) ? 1 : 2, bleedS: 8 + 24 * amt }; } },
    { id: "disint", kana: "崩", name: "disintegration", family: "形", d: 0.65, w: 1.8, phase: "W1", no: ["erode", "nokiru"],
      // The station gets stuck: one motif fragment loops like a locked groove
      // and decays — each pass loses notes, gains grit, drifts in pitch, until
      // only the room is left. Then the next cycle begins from the residue.
      params: function (R, d, amt) { return { passes: 8 + Math.floor(24 * amt), lossPer: 0.04 + 0.06 * amt, driftCents: 2 + 10 * amt } ; } },
    { id: "mainv", kana: "間", name: "ma inverted", family: "形", d: 0.40, w: 2.0, phase: "W1", no: ["swarm", "clouds"],
      // Silence is the material and sound is the interruption: single events
      // minutes apart.
      params: function (R, d, amt) { return { restMul: 3 + 9 * amt, singleton: R.chance(0.6) }; } },

    // ---- 合奏 ensemble ----
    { id: "hetero", kana: "重", name: "gagaku heterophony at scale", family: "合奏", d: 0.35, w: 2.6, phase: "W2",
      // All five melodic voices read the same phrase at once, each in its own
      // ornaments and lag. Real gagaku, taken all the way.
      params: function (R, d, amt) { return { lagS: 0.15 + 0.9 * amt, ornMul: 1 + amt }; } },
    { id: "poly", kana: "多", name: "polymeter", family: "合奏", d: 0.40, w: 2.4, phase: "W2",
      // 3 against 4 against 7 across the kit's three drums; the pulse magnet
      // pulls each voice to a different drum.
      params: function (R, d, amt) { return { meters: R.pick([[3, 4, 7], [3, 4, 5], [4, 5, 7], [2, 3, 7]]) }; } },
    { id: "hocket", kana: "継", name: "hocket", family: "合奏", d: 0.45, w: 2.2, phase: "W2",
      // One melody split note by note across all the voices there are.
      params: function (R, d, amt) { return { strict: R.chance(0.4 + 0.4 * amt) }; } },
    { id: "mirror", kana: "鏡", name: "strict mirror", family: "合奏", d: 0.50, w: 2.0, phase: "W2",
      // Every phrase answered by its exact retrograde-inversion; the ledger
      // enforces it instead of merely hoping for it.
      params: function (R, d, amt) { return { axis: R.pick(["tonic", "fifth", "last"]), lagBeats: R.rnd(0.5, 3) }; } },
    { id: "swarm", kana: "群", name: "swarm", family: "合奏", d: 0.55, w: 2.0, phase: "W2", no: ["mainv"],
      // The air's limit is lifted and the motif engine runs a canon of 6–10
      // entries at short delays: Ligeti micropolyphony on a dark pentatonic.
      params: function (R, d, amt) { return { entries: 6 + Math.floor(4 * amt), gapS: 1.6 - 1.1 * amt }; } },
    { id: "clouds", kana: "雲", name: "clouds", family: "合奏", d: 0.70, w: 1.6, phase: "W2", no: ["mainv"],
      // Xenakis: the plucked bodies as stochastic glissando clouds — hundreds
      // of short notes on distributions, not phrases.
      params: function (R, d, amt) { return { rateHz: 3 + 12 * amt, spanOct: 1 + 2 * amt, glissS: 0.4 + R.rnd(0, 1.2) }; } },

    // ---- 音色 spectrum ----
    { id: "metal", kana: "金", name: "metal", family: "音色", d: 0.35, w: 2.6, phase: "W3",
      // Ring modulation of the shō by the sub-drone; the bells and the koto
      // through FM. Inharmonic, gong-like, still pitched.
      // §10 (owner, 2026-09-07): the roughness gate is TIERED by distance and
      // 金 is named as allowed to be abrasive above 0.7. `bite` is that ruling
      // as a number — nothing at or below 0.70, rising across the loosened
      // 0.70–0.85 band, full where there is no roughness gate at all. Below
      // 0.70 every value here is exactly what it was, because that band was
      // ruled unchanged.
      params: function (R, d, amt) {
        var bite = d <= 0.70 ? 0 : d >= 0.85 ? 1 : (d - 0.70) / 0.15;
        var targets = R.pick([["sho"], ["sho", "koto"], ["koto"]]);   // the draw is kept, and kept FIRST, so the low band is untouched
        if (bite > 0) {
          // In the loosened band both of the pitched targets are metal; at the
          // top the plucked trio goes with them and the ensemble is struck
          // rather than blown. Widening, never narrowing, so a night that drew
          // ["sho"] keeps its shō.
          if (targets.indexOf("sho") < 0) targets = targets.concat(["sho"]);
          if (targets.indexOf("koto") < 0) targets = targets.concat(["koto"]);
          // NO FURTHER, and the reason is the peak cap, which §10 kept hard.
          // FM costs an oscillator and a gain PER NOTE and the strings are the
          // dense bodies: adding shamisen and biwa took seed 810 from 107
          // concurrent sources to 116, and shamisen alone still left only one
          // source of headroom on seeds 810 and 122 (108 and 109 against 110).
          // A gate with a margin of one is a gate that an unsampled seed
          // breaches. So the whole of the top tier's escalation goes into the
          // RING, which costs nothing per note — one modulator serves the
          // night — and into the FM index on the two targets already there.
        }
        return {
          // THE RING IS THE DARKENING TERM and it is the one to push. dry is
          // 1 - ringMix, so ringMix 1 leaves no pipe at all — only its own
          // sidebands, which sit symmetrically about each partial with the
          // carrier multiplied away. That is a struck bell instead of a blown
          // pipe, and it costs the centroid nothing: the critic measured the
          // ratio at 0.85 over 900 s, DARKER than home. The centroid gate is
          // not tiered and does not need to be.
          ringMix: Math.min(1, 0.2 + 0.5 * amt + 0.30 * bite),
          // FM is the term that BRIGHTENS — index buys sidebands and width —
          // so it rises far less. This is the one place 金 can still fail a
          // gate that stayed hard everywhere.
          fmIndex: 0.5 + 3 * amt + 1.5 * bite,
          targets: targets, bite: bite };
      } },
    { id: "rev", kana: "逆", name: "reverse", family: "音色", d: 0.40, w: 2.2, phase: "W3",
      // Envelopes reversed: plucks that swell, breaths that end in the attack.
      // A tape played backwards.
      params: function (R, d, amt) { return { share: 0.25 + 0.6 * amt, swellS: 0.3 + 1.2 * amt }; } },
    { id: "freeze", kana: "凍", name: "freeze", family: "音色", d: 0.50, w: 2.0, phase: "W3",
      // A shakuhachi note held into a drone for a minute — jittered sustained
      // partials — and the ensemble re-tunes around it.
      params: function (R, d, amt) { return { holdS: 20 + 60 * amt, jitterC: 3 + 9 * amt }; } },
    { id: "nlead", kana: "騒", name: "noise leads", family: "音色", d: 0.60, w: 1.8, phase: "W3",
      // The japanoise vocabulary becomes the soloist, claims the air, and the
      // melodic voices become the texture behind it.
      // §10 (owner, 2026-09-07): above 0.85 there is no roughness gate at all
      // and 騒 is named as allowed to be abrasive. `bite` carries that the same
      // way 金's does — nothing at or below 0.70, so the band the ruling left
      // alone is left alone.
      params: function (R, d, amt) {
        var bite = d <= 0.70 ? 0 : d >= 0.85 ? 1 : (d - 0.70) / 0.15;
        return { share: 0.3 + 0.5 * amt, holdS: 12 + 40 * amt, bite: bite };
      } },
    { id: "phase", kana: "相", name: "phasing", family: "音色", d: 0.60, w: 1.6, phase: "W3",
      // Two copies of a signal's two-second window drift out of phase (Reich)
      // instead of the receiver's usual tune-in / hold / loss.
      params: function (R, d, amt) { return { driftMs: 6 + 40 * amt, passes: 8 + Math.floor(20 * amt) }; } },
    { id: "reelrm", kana: "室", name: "the reel as the room", family: "音色", d: 0.70, w: 1.4, phase: "W3",
      // A two-second slice of a broadcast reel becomes the convolution
      // impulse: the whole station played through the voice of the past.
      // Audio only — the set stays dark.
      params: function (R, d, amt) { return { sliceS: 1.2 + R.rnd(0, 1.2), wet: 0.2 + 0.3 * amt }; } },
  ];

  // Incompatibility is symmetric whether or not both sides declared it.
  var COMPAT = {};
  (function () {
    var i, j, r;
    for (i = 0; i < REGISTRY.length; i++) COMPAT[REGISTRY[i].id] = {};
    for (i = 0; i < REGISTRY.length; i++) {
      r = REGISTRY[i];
      for (j = 0; r.no && j < r.no.length; j++) {
        COMPAT[r.id][r.no[j]] = 1;
        if (COMPAT[r.no[j]]) COMPAT[r.no[j]][r.id] = 1;
      }
    }
  })();
  var BY_ID = {};
  for (var ri = 0; ri < REGISTRY.length; ri++) BY_ID[REGISTRY[ri].id] = REGISTRY[ri];

  // The night's name at the far end: the STRANGEST thing present names it —
  // the drawn departure with the highest threshold. Deterministic, no draw.
  var NAMES = {
    clouds: ["渦", "the vortex"], swarm: ["渦", "the vortex"],
    disint: ["崩", "the collapse"], erode: ["崩", "the collapse"], nokiru: ["崩", "the collapse"],
    freeze: ["凍", "the freeze"], mainv: ["凍", "the freeze"],
    mirror: ["鏡", "the mirror"], hocket: ["鏡", "the mirror"], hetero: ["鏡", "the mirror"],
    nlead: ["塵", "the dust"], metal: ["塵", "the dust"], rev: ["塵", "the dust"],
    phase: ["塵", "the dust"], reelrm: ["塵", "the dust"],
    spiral: ["螺", "the helix"], sag: ["螺", "the helix"], ear: ["螺", "the helix"],
    meri: ["螺", "the helix"], bito: ["螺", "the helix"],
    dilate: ["潮", "the drift"], vari: ["潮", "the drift"], canon: ["潮", "the drift"], poly: ["潮", "the drift"],
  };

  // How many departures a night carries. base runs 0 at the first threshold
  // to 1 at d = 1, so d 0.30 → 1, 0.50 → 2, 0.75 → 3, 0.95 → 4 — the plan's
  // table. Both jitter draws are taken unconditionally (stream discipline).
  function count(R, d) {
    var base = clamp01((d - D_MIN) / (1 - D_MIN));
    var n = 1 + Math.floor(base * 3.6);
    var jitter = R.chance(0.30), up = R.chance(0.5);
    if (jitter) n += up ? 1 : -1;
    return n < 1 ? 1 : n > 5 ? 5 : n;
  }

  // ==========================================================================
  // night(farStream, forcedD) → the night
  //
  // ONE call, at PLAY. `forcedD` (from ?far= / setFar) overrides the VALUE
  // but never skips the draw, so a forced night and a natural one leave the
  // far stream in exactly the same place.
  // ==========================================================================
  function night(rng, forcedD) {
    var u = rng.next();                                    // always drawn
    var d = (forcedD != null && isFinite(forcedD)) ? clamp01(+forcedD) : law(u);
    var b = band(d);
    var out = { d: d, u: u, home: d < D_HOME, band: b, ids: [], dep: {},
      kana: b.kana, name: b.label, detail: "", label: "" };
    if (out.home) { out.detail = "d " + d.toFixed(2); out.label = "家 home · d " + d.toFixed(2); return out; }

    // the pool: everything this distance unlocks
    var pool = [], i;
    for (i = 0; i < REGISTRY.length; i++) if (d >= REGISTRY[i].d) pool.push(REGISTRY[i]);
    var want = count(rng, d), banned = {}, chosen = [];
    while (chosen.length < want && pool.length) {
      var w = [], k;
      for (i = 0; i < pool.length; i++) if (!banned[pool[i].id]) w.push([pool[i], pool[i].w]);
      if (!w.length) break;
      var pick = rng.pickW(w);
      chosen.push(pick);
      banned[pick.id] = 1;
      for (k in COMPAT[pick.id]) banned[k] = 1;
      var np = [];
      for (i = 0; i < pool.length; i++) if (pool[i] !== pick) np.push(pool[i]);
      pool = np;
    }
    // Parameters in REGISTRY order, each on its own sub-fork: re-tuning one
    // departure can never disturb another, or another night.
    var order = [];
    for (i = 0; i < REGISTRY.length; i++) if (chosen.indexOf(REGISTRY[i]) >= 0) order.push(REGISTRY[i]);
    for (i = 0; i < order.length; i++) {
      var r = order[i], F = rng.fork("dep:" + r.id);
      var span = clamp01((d - r.d) / Math.max(0.05, 1 - r.d));
      var amt = clamp01(0.4 + 0.6 * span + F.rnd(-0.12, 0.12));
      var p = {};
      try { p = r.params(F, d, amt) || {}; } catch (e) { p = {}; }
      p.id = r.id; p.kana = r.kana; p.name = r.name; p.family = r.family; p.amt = amt;
      out.dep[r.id] = p;
      out.ids.push(r.id);
    }
    // 雲 clouds against a GLACIAL dilation is mud, not music: hundreds of short
    // notes stretched to nothing. The plan's composition rule, enforced on the
    // parameter rather than the pairing so both departures survive. (This was
    // inverted too, for the same naming reason — it pinned the fast side.)
    if (out.dep.clouds && out.dep.dilate) { out.dep.dilate.slowMul = 1; out.dep.dilate.slow = false; }

    // The name: the strangest departure present speaks for the night — the
    // highest threshold, and on a tie the LATER one in the registry, because
    // the registry runs pitch → time → form → ensemble → spectrum and a night
    // whose noise has taken the lead is the dust, not a tempo canon.
    var top = null;
    for (i = 0; i < out.ids.length; i++) { var rr = BY_ID[out.ids[i]]; if (!top || rr.d >= top.d) top = rr; }
    if (d > 0.85 && top && NAMES[top.id]) { out.kana = NAMES[top.id][0]; out.name = NAMES[top.id][1]; }
    else { out.kana = b.kana; out.name = b.label; }
    // `detail` is the VFD's second half — the name is already the first half,
    // so it must not repeat it, and the departures go in as KANA only: four
    // full names is 120 characters and wraps the log to three rows. Each
    // departure names itself in full on the VFD when it acts (W1+).
    // `label` is the whole line, for the probe and the handoffs.
    var words = [], full = [];
    for (i = 0; i < out.ids.length; i++) { words.push(BY_ID[out.ids[i]].kana); full.push(BY_ID[out.ids[i]].kana + " " + BY_ID[out.ids[i]].name); }
    out.detail = "d " + d.toFixed(2) + (words.length ? " · " + words.join(" ") : "");
    out.label = out.kana + " " + out.name + " · d " + d.toFixed(2) + (full.length ? " · " + full.join(" · ") : "");
    return out;
  }

  // ==========================================================================
  // lift(farStream, cycleN, d) → this cycle's own distance
  //
  // The meta-tide's per-cycle excursion: about two cycles in five lean, half
  // of those further out and half back toward home — so a far night can have
  // one calm cycle and an adrift night one strange one. All three draws are
  // taken unconditionally, on a per-cycle sub-fork, so the cycle's draw count
  // is independent of everything else in the night.
  //
  // A HOME night never lifts: d < D_HOME returns 0 without forking. That is
  // what makes "the median is byte-identical" true rather than nearly true.
  // Declared here from W0; the engine calls it from W4.
  // ==========================================================================
  function lift(rng, cycleN, d) {
    if (!(d >= D_HOME)) return 0;
    var R = rng.fork("cycle:" + cycleN);
    var u = R.next(), mag = R.rnd(0.10, 0.32), out = R.chance(0.5);
    if (u >= 0.40) return d;
    return clamp01(d + (out ? mag : -mag));
  }

  return {
    D_HOME: D_HOME, D_MIN: D_MIN,
    law: law, dForSeed: dForSeed, seek: seek, band: band,
    REGISTRY: REGISTRY, BY_ID: BY_ID, COMPAT: COMPAT, NAMES: NAMES,
    night: night, lift: lift, count: count,
  };
})();

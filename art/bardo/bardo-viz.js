// ============================================================================
// BARDO (བར་དོ) — visualizer. Two instruments of seeing:
//
//   THE MANDALA — a sand mandala that constructs itself ring by ring over the
//   ceremony (each section lays a band, motifs add petals, cadences pulse it,
//   tutti makes it breathe) and is swept away at dissolution — every grain
//   detaching into wind. Dedication leaves one dim ring. A new ceremony
//   derives fresh geometry from the decimals of its fundamental.
//
//   THE YANG-YIG RIBBON — live notation. The chant's melodic line drawn as a
//   scrolling calligraphic brush-stroke in the spirit of yang-yig manuscript
//   curves: pitch as height (log scale), analyser energy as brush pressure,
//   gyaling as light ticks above, dungchen as broad swells below.
//
// Around them: void, vignette, dust. No glitch here. Contemplative, vast.
// Reads window.BardoAudio but never requires it — renders an idle emptiness
// until the ritual engine wakes.  Public surface: window.BardoViz.init(canvas)
// ============================================================================
(function () {
  "use strict";

  // ---- palette --------------------------------------------------------------
  var BONE      = { r: 230, g: 224, b: 209 };   // #e6e0d1 — sand grains, brush ink
  var VERDIGRIS = { r: 79,  g: 168, b: 153 };   // #4fa899 — structure lines
  var GOLD      = { r: 185, g: 154, b: 78  };   // #b99a4e — motif petal accents
  var WRATH     = { r: 157, g: 47,  b: 51  };   // #9d2f33 — destroy/magnetize tint
  var VOID_FILL = "#050607";

  var MAX_PARTICLES = 2500;                     // total sand budget (mandala + petals)
  var DUST_COUNT    = 60;                       // background motes
  var RIBBON_FRAC   = 0.20;                     // lower band height fraction
  var MANDALA_FRAC  = 0.72;                     // mandala diameter vs min-dimension

  function rgba(c, a) { return "rgba(" + c.r + "," + c.g + "," + c.b + "," + a.toFixed(3) + ")"; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function mixC(a, b, t) { return { r: Math.round(lerp(a.r, b.r, t)), g: Math.round(lerp(a.g, b.g, t)), b: Math.round(lerp(a.b, b.b, t)) }; }

  // ==========================================================================
  // INIT — everything lives inside; init is idempotent-ish (second call no-ops)
  // ==========================================================================
  var booted = false;

  function init(canvasElOrId) {
    if (booted) return;
    var canvas = typeof canvasElOrId === "string" ? document.getElementById(canvasElOrId) : canvasElOrId;
    if (!canvas || !canvas.getContext) return;
    var ctx2d = canvas.getContext("2d");
    if (!ctx2d) return;
    booted = true;

    // ---- geometry / DPR ----------------------------------------------------
    var W = 0, H = 0, dpr = 1;
    var cx = 0, cy = 0, R = 0;                  // mandala center + radius
    var stripTop = 0, stripH = 0;               // ribbon band (CSS px, main canvas)

    // The ribbon draws into its own offscreen canvas so scrolling is a cheap
    // self-blit; it persists like ink on paper rather than being redrawn.
    var rcv = document.createElement("canvas");
    var rctx = rcv.getContext("2d");

    function resize() {
      dpr = window.devicePixelRatio || 1;
      var r = canvas.getBoundingClientRect();
      W = Math.max(1, r.width); H = Math.max(1, r.height);
      canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
      ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      stripH = H * RIBBON_FRAC;
      stripTop = H - stripH;
      cx = W * 0.5;
      cy = stripTop * 0.5;                      // centered in the space above the ribbon
      R = Math.min(W, stripTop) * MANDALA_FRAC * 0.5;
      rcv.width = Math.max(1, Math.floor(W * dpr));
      rcv.height = Math.max(1, Math.floor(stripH * dpr));
      rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rctx.clearRect(0, 0, W, stripH);
      vignette = null; ribbonFade = null;       // rebuild cached gradients
    }
    window.addEventListener("resize", resize);
    resize();

    // ---- audio engine hookup (all guarded — B may not exist yet) -----------
    var subscribed = false;
    var analyser = null, freqData = null;

    function engine() { return window.BardoAudio || null; }

    function ensureSubscribed(B) {
      if (subscribed || !B) return;
      try {
        if (typeof B.setNoteListener === "function") B.setNoteListener(onNote);
        if (typeof B.setEventListener === "function") B.setEventListener(onEvent);
        subscribed = true;
      } catch (e) { /* engine mid-load; try again next frame */ }
    }

    function ensureAnalyser(B) {
      if (analyser || !B || typeof B.attachAnalyser !== "function") return;
      try {
        var an = B.attachAnalyser();            // returns analyser or null pre-start
        if (an) {
          an.smoothingTimeConstant = 0.85;
          analyser = an;
          freqData = new Uint8Array(an.frequencyBinCount);
        }
      } catch (e) { /* not fatal — breathe without ears */ }
    }

    function pollConductor(B) {
      if (!B || typeof B.getConductor !== "function") return null;
      try { return B.getConductor(); } catch (e) { return null; }
    }

    // low-frequency energy 0..1 — vignette breath + brush pressure
    function lowEnergy() {
      if (!analyser || !freqData) return 0;
      try {
        analyser.getByteFrequencyData(freqData);
        var s = 0, n = Math.min(14, freqData.length);
        for (var i = 1; i < n; i++) s += freqData[i];
        return s / ((n - 1) * 255);
      } catch (e) { return 0; }
    }

    // ========================================================================
    // MANDALA — particle pool, preallocated; zero per-frame allocation.
    // Home positions are stored polar (rFrac, ang) so resize costs nothing.
    // ========================================================================
    var pool = [];
    for (var pi = 0; pi < MAX_PARTICLES; pi++) {
      pool.push({
        active: false, revealed: false, detached: false,
        rFrac: 0, ang: 0,                       // home, relative to center/R
        px: 0, py: 0, vx: 0, vy: 0,             // free-fall state once detached
        size: 1, col: 0,                        // 0 bone, 1 gold, 2 verdigris
        reveal: 0,                              // local-progress threshold to appear
        detachT: 1,                             // local-progress threshold to sweep away
        alpha: 1, phase: 0, ring: -1, birthSec: -1,
      });
    }
    var poolNext = 0;                           // bump allocator; reset per ceremony
    function grab() {
      if (poolNext >= MAX_PARTICLES) return null;
      var p = pool[poolNext++];
      p.active = true; p.revealed = false; p.detached = false;
      p.alpha = 1; p.vx = 0; p.vy = 0;
      return p;
    }

    // per-ceremony geometry, derived from the decimals of f0 — stable per
    // ceremony, fresh each rebirth. Tibetan orders: 4 gates, 6 realms,
    // 8 spokes, 12 links, 16 (the doubled gates).
    var ORDERS = [4, 6, 8, 12, 16];
    var geo = { order: 8, order2: 12, seed: 108 };
    var rings = [];                             // { rFrac, sectionIdx, done }
    var ceremonyKey = "";                       // detects rebirth
    var lastSectionIdx = -1;
    var dissolving = false, dissolved = false;
    var pulse = 0, tuttiAmt = 0, wrathAmt = 0;

    // tiny deterministic rng seeded from f0 decimals
    var rngS = 1;
    function srand(seed) { rngS = (seed >>> 0) || 1; }
    function rng() { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; }

    function rebuildGeometry(cond) {
      var f0 = (cond && cond.f0 > 0) ? cond.f0 : 60;
      var dec = Math.floor((f0 % 1) * 100000);  // the fundamental's fingerprint
      srand(dec + Math.floor(f0) * 7919);
      geo.order = ORDERS[dec % ORDERS.length];
      geo.order2 = ORDERS[(dec + 2 + Math.floor(rng() * 2)) % ORDERS.length];
      geo.seed = dec;
      rings.length = 0;
      poolNext = 0;
      for (var i = 0; i < MAX_PARTICLES; i++) { pool[i].active = false; pool[i].detached = false; }
      lastSectionIdx = -1;
      dissolving = false; dissolved = false;
      pulse = 0;
    }

    // one new ring band per building section. Pattern alternates: ring of
    // dots / radial arms / lotus arcs — each in strict k-fold symmetry, each
    // grain given a reveal threshold so it accretes with local progress.
    function addRing(sectionIdx) {
      var n = rings.length;
      var rFrac = 0.16 + 0.84 * (n + 1) / (n + 3.2);   // asymptotic — always fits
      rings.push({ rFrac: rFrac, sectionIdx: sectionIdx });
      var k = (n % 2 === 0) ? geo.order : geo.order2;
      var pattern = n % 3;                      // 0 dots · 1 arms · 2 lotus
      var perArm = pattern === 1 ? 7 : (pattern === 2 ? 9 : 11);
      for (var arm = 0; arm < k; arm++) {
        var base = (arm / k) * Math.PI * 2 + (n * 0.13); // slight inter-ring rotation
        for (var j = 0; j < perArm; j++) {
          var p = grab(); if (!p) return;
          var u = perArm > 1 ? j / (perArm - 1) : 0;
          if (pattern === 0) {                  // dots strung along the circle
            p.ang = base + ((u - 0.5) * 0.8) * (Math.PI * 2 / k);
            p.rFrac = rFrac + (rng() - 0.5) * 0.015;
          } else if (pattern === 1) {           // short radial arm
            p.ang = base + (rng() - 0.5) * 0.02;
            p.rFrac = rFrac - 0.06 + u * 0.12;
          } else {                              // lotus petal arc
            var pa = (u - 0.5) * 0.5 * (Math.PI * 2 / k);
            p.ang = base + pa;
            p.rFrac = rFrac + Math.cos(pa * k * 0.8) * 0.035;
          }
          p.size = 0.8 + rng() * 1.2;
          p.col = 0;                            // bone sand
          p.ring = n; p.birthSec = sectionIdx;
          // accretion sweeps around the wheel, grain by grain — and finishes
          // by ~65% of the section, so the ring is never still under
          // construction when the next one begins
          p.reveal = clamp01((arm + u) / k + (rng() - 0.5) * 0.06) * 0.65;
          p.detachT = 1; p.phase = rng() * Math.PI * 2;
        }
      }
    }

    // motif event → a small petal cluster, replicated at every gate.
    // Clusters alternate verdigris / gold so gold stays an accent, not a coat.
    var petalAlt = 0;
    function spawnPetals() {
      if (dissolving || dissolved || rings.length === 0) return;
      var host = rings[rings.length - 1];
      var rBase = host.rFrac * (0.72 + rng() * 0.4);
      var offA = rng() * Math.PI * 2;
      var k = geo.order;
      var col = (petalAlt++ % 3 === 0) ? 1 : 2; // gold every third motif only
      for (var arm = 0; arm < k; arm++) {
        for (var j = 0; j < 3; j++) {
          var p = grab(); if (!p) return;
          p.ang = offA + (arm / k) * Math.PI * 2 + (rng() - 0.5) * 0.09;
          p.rFrac = rBase + (rng() - 0.5) * 0.05;
          p.size = 1 + rng() * 1.3;
          p.col = col;
          p.ring = -1; p.birthSec = -2;
          p.reveal = animT + rng() * 1.8;       // blooms over ~2s from now
          p.detachT = 1; p.phase = rng() * Math.PI * 2;
        }
      }
    }

    // dissolution: every grain receives its hour. Outer rings loosen first,
    // with enough randomness that the sweep reads as wind, not machinery.
    function assignDetach() {
      for (var i = 0; i < poolNext; i++) {
        var p = pool[i];
        if (!p.active) continue;
        p.detachT = clamp01(0.05 + (1 - p.rFrac) * 0.35 + Math.random() * 0.55);
      }
      dissolving = true;
    }
    function detachAll() {                      // dedication mops up stragglers
      for (var i = 0; i < poolNext; i++) {
        var p = pool[i];
        if (p.active && !p.detached) detachGrain(p, 1);
      }
    }
    function detachGrain(p, inten) {
      p.detached = true;
      p.px = cx + Math.cos(p.ang) * p.rFrac * R;
      p.py = cy + Math.sin(p.ang) * p.rFrac * R;
      var sp = (0.15 + Math.random() * 0.5) * (0.5 + inten);
      p.vx = Math.cos(p.ang) * sp * 18 + 6;     // outward + a prevailing wind
      p.vy = Math.sin(p.ang) * sp * 10 + 8 + Math.random() * 10; // and down
      p.alpha = 0.9;
    }

    // ========================================================================
    // YANG-YIG RIBBON — voices write at a fixed head; the paper scrolls left.
    // ========================================================================
    var scrollSpeed = 14;                       // css px/sec — slow enough that
                                                // a minute of liturgy stays on the page
    var scrollAcc = 0;                          // fractional device-px carry
    var headX = 0;                              // set per-frame: W - margin
    var fadeTick = 0;

    // chant: one phrase-note at a time; we synthesize its yang-yig contour by
    // gliding between harmonic targets drawn from the conductor's spectral set
    var chant = { until: 0, start: 0, freq: 0, y: 0, prevY: -1, target: 0, nextHop: 0, wob1: 0, wob2: 0, lw: 2 };
    var GYA_MAX = 6, DUN_MAX = 4;
    var gyal = [], dung = [];
    for (var gi = 0; gi < GYA_MAX; gi++) gyal.push({ until: 0, start: 0, y: 0, prevY: -1 });
    for (var di = 0; di < DUN_MAX; di++) dung.push({ until: 0, start: 0, prevY: -1 });
    var baselinePrevY = -1;

    function pitchY(freq, f0) {
      // log-scale: f0 at the floor of the band, ~4.5 octaves of headroom
      var lo = (f0 > 0 ? f0 : 60);
      var oct = Math.log(Math.max(freq, lo * 0.5) / lo) / Math.LN2;
      return stripH * 0.88 - clamp01(oct / 4.5) * stripH * 0.74;
    }

    function onNote(n) {
      try {
        if (!n || !n.freq) return;
        var now = performance.now();
        var durMs = Math.max(200, (n.duration || 1) * 1000);
        if (n.layer === "chant") {
          chant.freq = n.freq;
          chant.start = now;
          chant.until = now + durMs;
          chant.target = n.freq;
          chant.nextHop = now + 900;
          chant.wob1 = Math.random() * Math.PI * 2;
          chant.wob2 = Math.random() * Math.PI * 2;
        } else if (n.layer === "gyaling") {
          for (var i = 0; i < GYA_MAX; i++) {
            if (gyal[i].until < now) { gyal[i].until = now + durMs; gyal[i].start = now; gyal[i].y = n.freq; gyal[i].prevY = -1; break; }
          }
        } else if (n.layer === "dungchen") {
          for (var j = 0; j < DUN_MAX; j++) {
            if (dung[j].until < now) { dung[j].until = now + Math.min(durMs, 20000); dung[j].start = now; dung[j].prevY = -1; break; }
          }
        }
      } catch (e) { /* never let a note break the frame */ }
    }

    function onEvent(ev) {
      try {
        if (!ev || !ev.cat) return;
        if (ev.cat === "cadence") pulse = 1;
        else if (ev.cat === "motif") spawnPetals();
        else if (ev.cat === "ceremony") ceremonyKey = ""; // force rebuild next frame
        else if (ev.cat === "transport" && ev.label && ev.label.indexOf("■") === 0) {
          chant.until = 0;                       // stilled — lift the brush
        }
      } catch (e) { /* likewise */ }
    }

    // ---- background dust — the only thing that never stops ------------------
    var dust = [];
    for (var du = 0; du < DUST_COUNT; du++) {
      dust.push({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2.5, s: 0.5 + Math.random() * 1.3, a: 0.04 + Math.random() * 0.1, ph: Math.random() * Math.PI * 2 });
    }

    var vignette = null, ribbonFade = null;
    function getVignette() {
      if (!vignette) {
        vignette = ctx2d.createRadialGradient(cx, cy, R * 0.4, cx, cy, Math.max(W, H) * 0.75);
        vignette.addColorStop(0, "rgba(0,0,0,0)");
        vignette.addColorStop(1, "rgba(0,0,0,0.55)");
      }
      return vignette;
    }

    // ========================================================================
    // FRAME
    // ========================================================================
    var lastT = performance.now();
    var animT = 0;                              // ceremony clock — pauses in hush

    function draw() {
      var now = performance.now();
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      var B = engine();
      ensureSubscribed(B);
      var playing = false;
      try { playing = !!(B && typeof B.isPlaying === "function" && B.isPlaying()); } catch (e) {}
      if (playing) ensureAnalyser(B);
      var cond = playing ? pollConductor(B) : null;

      var hush = !!(cond && cond.hush);
      var dim = hush ? 0.6 : 1;                 // everything dims 40% in hush
      if (!hush) animT += dt;

      var energy = playing ? lowEnergy() : 0;

      // ---- the void ----------------------------------------------------------
      ctx2d.fillStyle = VOID_FILL;
      ctx2d.fillRect(0, 0, W, H);
      // vignette breath: low bins lift the darkness almost imperceptibly
      ctx2d.fillStyle = getVignette();
      ctx2d.fillRect(0, 0, W, H);
      if (energy > 0.01) {
        ctx2d.fillStyle = rgba(BONE, energy * 0.022 * dim);
        ctx2d.fillRect(0, 0, W, H);
      }

      // ---- dust motes (immune to hush — the room keeps its air) ---------------
      ctx2d.fillStyle = rgba(BONE, 1);
      for (var d = 0; d < DUST_COUNT; d++) {
        var m = dust[d];
        m.x += (m.vx + Math.sin(now * 0.0003 + m.ph) * 1.5) * dt / W;
        m.y += m.vy * dt / H;
        if (m.y < -0.02) { m.y = 1.02; m.x = Math.random(); }
        if (m.x < -0.02) m.x = 1.02; else if (m.x > 1.02) m.x = -0.02;
        ctx2d.globalAlpha = m.a * (0.7 + 0.3 * Math.sin(now * 0.001 + m.ph));
        ctx2d.fillRect(m.x * W, m.y * H, m.s, m.s);
      }
      ctx2d.globalAlpha = 1;

      if (!playing || !cond) {
        // ---- idle: emptiness, and the promise of a circle ---------------------
        ctx2d.strokeStyle = rgba(VERDIGRIS, 0.16 + 0.05 * Math.sin(now * 0.0008));
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, R, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.strokeStyle = rgba(VERDIGRIS, 0.07 + 0.03 * Math.sin(now * 0.0008 + 1.7));
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, R * 0.36, 0, Math.PI * 2);
        ctx2d.stroke();
        ctx2d.fillStyle = rgba(BONE, 0.3 + 0.1 * Math.sin(now * 0.0011));
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, 1.4, 0, Math.PI * 2);
        ctx2d.fill();
        compositeRibbon(0, dim);
        requestAnimationFrame(draw);
        return;
      }

      // ---- conductor bookkeeping ----------------------------------------------
      var key = String(cond.ceremony) + "·" + (cond.f0 ? cond.f0.toFixed(3) : "");
      if (key !== ceremonyKey) { ceremonyKey = key; rebuildGeometry(cond); }

      var sec = cond.section || "generation";
      var local = clamp01(cond.local || 0);
      if (cond.sectionIndex !== lastSectionIdx) {
        lastSectionIdx = cond.sectionIndex;
        if (sec === "generation" || sec === "offering" || sec === "action") {
          if (!dissolving && !dissolved) addRing(cond.sectionIndex);
        } else if (sec === "dissolution") {
          if (!dissolving) assignDetach();
        } else if (sec === "dedication") {
          dissolved = true; detachAll();
        }
      }

      // wrathful tint eases in during destroy (full) / magnetize (half)
      var wrathTarget = cond.activity === "destroy" ? 1 : (cond.activity === "magnetize" ? 0.45 : 0);
      wrathAmt += (wrathTarget - wrathAmt) * Math.min(1, dt * 1.5);
      tuttiAmt += ((cond.tutti ? 1 : 0) - tuttiAmt) * Math.min(1, dt * 2);
      if (!hush) pulse *= Math.pow(0.05, dt);   // cadence flash decays fast (frozen in hush)

      drawMandala(cond, sec, local, dt, dim, hush);

      // ---- ribbon: scroll + write, then composite ------------------------------
      var shiftCss = 0;
      if (!hush) {
        scrollAcc += scrollSpeed * dt * dpr;
        var shiftDev = Math.floor(scrollAcc);
        if (shiftDev > 0) {
          scrollAcc -= shiftDev;
          shiftCss = shiftDev / dpr;
          rctx.setTransform(1, 0, 0, 1, 0, 0);
          rctx.drawImage(rcv, -shiftDev, 0);
          rctx.clearRect(rcv.width - shiftDev, 0, shiftDev, rcv.height);
          rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          // slow ink fade so the manuscript never clogs
          if (++fadeTick >= 24) {
            fadeTick = 0;
            rctx.fillStyle = "rgba(5,6,7,0.03)";
            rctx.fillRect(0, 0, W, stripH);
          }
          writeRibbon(cond, now, dt, shiftCss, energy);
        }
      }
      compositeRibbon(energy, dim);

      requestAnimationFrame(draw);
    }

    // ========================================================================
    // MANDALA RENDER
    // ========================================================================
    function drawMandala(cond, sec, local, dt, dim, hush) {
      var inten = clamp01(cond.intensity || 0);
      var breath = 1 + tuttiAmt * 0.02 * Math.sin(animT * 1.3);   // tutti breathing
      var bright = (1 + pulse * 0.55) * dim;                       // cadence flash
      var scale = R * breath;
      var structC = mixC(VERDIGRIS, WRATH, wrathAmt * 0.8);

      // the enclosing circle — the mandala's eventual extent, carried over
      // from idle so play never feels like a jump-cut. Concentric with all.
      ctx2d.strokeStyle = rgba(structC, ((dissolved || sec === "dedication") ? 0.05 : 0.09) * dim);
      ctx2d.lineWidth = 1;
      ctx2d.beginPath();
      ctx2d.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx2d.stroke();

      // dedication: nearly empty — a single dim ring where it all was
      if (dissolved || sec === "dedication") {
        ctx2d.strokeStyle = rgba(structC, 0.12 * dim);
        ctx2d.lineWidth = 1;
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, scale * 0.55, 0, Math.PI * 2);
        ctx2d.stroke();
      } else {
        // structure lines — a faint full chalk-guide appears at once, then the
        // inked circle sweeps open with its accretion; the whole scaffold
        // thins as dissolution advances
        var structA = (dissolving ? (1 - local) : 1) * dim;
        for (var ri = 0; ri < rings.length; ri++) {
          var ring = rings[ri];
          var prog = ring.sectionIdx < cond.sectionIndex ? 1 : (ring.sectionIdx === cond.sectionIndex ? local : 0);
          if (dissolving) prog = 1;
          ctx2d.strokeStyle = rgba(structC, 0.06 * structA);
          ctx2d.lineWidth = 0.7;
          ctx2d.beginPath();
          ctx2d.arc(cx, cy, ring.rFrac * scale, 0, Math.PI * 2);
          ctx2d.stroke();
          if (prog <= 0.01) continue;
          ctx2d.strokeStyle = rgba(structC, (0.16 + 0.06 * bright * 0.5) * structA);
          ctx2d.lineWidth = 0.9;
          ctx2d.beginPath();
          ctx2d.arc(cx, cy, ring.rFrac * scale, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
          ctx2d.stroke();
        }
        // gate spokes, from near the bindu to the outermost ring — the
        // dharma-wheel armature is legible from the first ring on
        if (rings.length >= 1) {
          var rOut = rings[rings.length - 1].rFrac * scale;
          ctx2d.strokeStyle = rgba(structC, 0.08 * structA * bright);
          ctx2d.lineWidth = 0.7;
          ctx2d.beginPath();
          for (var sp = 0; sp < geo.order; sp++) {
            var a = (sp / geo.order) * Math.PI * 2 - Math.PI / 2;
            ctx2d.moveTo(cx + Math.cos(a) * rings[0].rFrac * scale * 0.3, cy + Math.sin(a) * rings[0].rFrac * scale * 0.3);
            ctx2d.lineTo(cx + Math.cos(a) * rOut, cy + Math.sin(a) * rOut);
          }
          ctx2d.stroke();
        }
        // center point — the bindu, always first
        ctx2d.fillStyle = rgba(BONE, 0.7 * bright);
        ctx2d.beginPath();
        ctx2d.arc(cx, cy, 1.6 + pulse * 1.2, 0, Math.PI * 2);
        ctx2d.fill();
      }

      // ---- the sand itself ----------------------------------------------------
      var wind = Math.sin(animT * 0.7) * 12 + 18;
      var lastCol = -1;
      for (var i = 0; i < poolNext; i++) {
        var p = pool[i];
        if (!p.active) continue;

        // reveal: grains of the current building ring accrete with local;
        // petals (birthSec -2) bloom on the ceremony clock; older rings are done
        if (!p.revealed) {
          if (p.birthSec === -2) { if (animT >= p.reveal) p.revealed = true; }
          else if (p.birthSec < cond.sectionIndex) p.revealed = true;
          else if (p.birthSec === cond.sectionIndex && local >= p.reveal) p.revealed = true;
          if (!p.revealed) continue;
        }
        // dissolution: the grain's hour arrives
        if (dissolving && !p.detached && sec === "dissolution" && local >= p.detachT) detachGrain(p, inten);

        var x, y, a;
        if (p.detached) {
          if (!hush) {                          // hush freezes even the falling sand
            p.vx += (wind * 0.4 + Math.sin(p.py * 0.02 + animT * 0.9) * 14) * dt;
            p.vy += 22 * dt;                    // gentle gravity — sand, not stones
            p.px += p.vx * dt;
            p.py += p.vy * dt;
            p.alpha -= dt * 0.28;
          }
          if (p.alpha <= 0 || p.py > H + 10 || p.px > W + 10) { p.active = false; continue; }
          x = p.px; y = p.py; a = p.alpha * 0.8;
        } else {
          x = cx + Math.cos(p.ang) * p.rFrac * scale;
          y = cy + Math.sin(p.ang) * p.rFrac * scale;
          a = 0.55 + 0.25 * Math.sin(animT * 0.8 + p.phase);   // grain shimmer
        }

        if (p.col !== lastCol) {
          lastCol = p.col;
          ctx2d.fillStyle = p.col === 1
            ? rgba(mixC(GOLD, WRATH, wrathAmt * 0.5), 0.9)
            : (p.col === 2
              ? rgba(mixC(VERDIGRIS, WRATH, wrathAmt * 0.6), 0.85)
              : rgba(mixC(BONE, WRATH, wrathAmt * 0.25), 1));
        }
        ctx2d.globalAlpha = clamp01(a * bright);
        ctx2d.fillRect(x - p.size * 0.5, y - p.size * 0.5, p.size, p.size);
      }
      ctx2d.globalAlpha = 1;
    }

    // ========================================================================
    // RIBBON WRITE — one head-column per frame on the offscreen paper
    // ========================================================================
    function writeRibbon(cond, now, dt, shiftCss, energy) {
      headX = W - W * 0.05;
      var xPrev = headX - shiftCss;
      var f0 = cond.f0 > 0 ? cond.f0 : 60;

      // --- chant: the main brush -------------------------------------------
      if (chant.until > now && chant.freq > 0) {
        // yang-yig sweep: hop between harmonics of the phrase pitch, drawn
        // from the conductor's spectral triple, gliding rather than stepping
        if (now >= chant.nextHop) {
          chant.nextHop = now + 1200 + Math.random() * 2200;
          var sp = (cond.spectral && cond.spectral.length) ? cond.spectral : [2, 3, 4];
          var h = sp[Math.floor(Math.random() * sp.length)] || 2;
          var base = sp[0] || 2;
          chant.target = chant.freq * (h / base);
        }
        var ty = pitchY(chant.target, f0)
          + Math.sin(now * 0.0011 + chant.wob1) * stripH * 0.03
          + Math.sin(now * 0.0027 + chant.wob2) * stripH * 0.012;
        if (chant.prevY < 0) { chant.y = ty; chant.prevY = ty; }
        chant.y += (ty - chant.y) * Math.min(1, dt * 2.2);       // the glide

        // brush pressure: phrase envelope tapers entry and release (a stroke,
        // not a trace); energy widens it gently; smoothed so it never jumps
        var cu = clamp01((now - chant.start) / Math.max(1, chant.until - chant.start));
        var envC = 0.35 + 0.65 * Math.sin(cu * Math.PI);
        var lwT = (2.2 + energy * 4 + Math.sin(now * 0.004) * 0.5) * envC;
        chant.lw += (lwT - chant.lw) * Math.min(1, dt * 4);
        rctx.strokeStyle = rgba(BONE, (0.5 + energy * 0.22 + (Math.random() - 0.5) * 0.06) * (0.55 + 0.45 * envC));
        rctx.lineWidth = Math.max(1.1, chant.lw);
        rctx.lineCap = "round";
        rctx.beginPath();
        rctx.moveTo(xPrev, chant.prevY);
        rctx.quadraticCurveTo((xPrev + headX) / 2, (chant.prevY + chant.y) / 2, headX, chant.y);
        rctx.stroke();
        chant.prevY = chant.y;
        baselinePrevY = -1;
      } else {
        // between phrases: the faint held baseline — breath, not silence
        var by = stripH * 0.82 + Math.sin(now * 0.0009) * 2.5 + Math.sin(now * 0.0031) * 0.8;
        if (baselinePrevY < 0) baselinePrevY = by;
        rctx.strokeStyle = rgba(BONE, 0.22 + energy * 0.1 + (Math.random() - 0.5) * 0.03);
        rctx.lineWidth = 0.8;
        rctx.beginPath();
        rctx.moveTo(xPrev, baselinePrevY);
        rctx.lineTo(headX, by);
        rctx.stroke();
        baselinePrevY = by;
        chant.prevY = -1;
      }

      // --- gyaling: light curve-ticks in the upper register ------------------
      for (var g = 0; g < GYA_MAX; g++) {
        var gy = gyal[g];
        if (gy.until <= now) { gy.prevY = -1; continue; }
        var gu = clamp01((now - gy.start) / Math.max(1, gy.until - gy.start));
        var yy = Math.max(stripH * 0.06, Math.min(stripH * 0.4, pitchY(gy.y, f0)))
          + Math.sin(gu * Math.PI * 3 + g) * stripH * 0.02;
        if (gy.prevY < 0) gy.prevY = yy;
        rctx.strokeStyle = rgba(BONE, 0.28 * Math.sin(gu * Math.PI));
        rctx.lineWidth = 1;
        rctx.beginPath();
        rctx.moveTo(xPrev, gy.prevY);
        rctx.lineTo(headX, yy);
        rctx.stroke();
        gy.prevY = yy;
      }

      // --- dungchen: broad low swells — the ground of the page ---------------
      for (var dd = 0; dd < DUN_MAX; dd++) {
        var dn = dung[dd];
        if (dn.until <= now) { dn.prevY = -1; continue; }
        var du2 = clamp01((now - dn.start) / Math.max(1, dn.until - dn.start));
        var env = Math.sin(du2 * Math.PI);                        // swell in, swell out
        var dy = stripH * 0.93 + Math.sin(now * 0.0006 + dd * 2) * 2;
        if (dn.prevY < 0) dn.prevY = dy;
        rctx.strokeStyle = rgba(mixC(BONE, VERDIGRIS, 0.4), 0.07 + env * 0.06);
        rctx.lineWidth = 3 + env * 5;
        rctx.lineCap = "round";
        rctx.beginPath();
        rctx.moveTo(xPrev, dn.prevY);
        rctx.lineTo(headX, dy);
        rctx.stroke();
        dn.prevY = dy;
      }
    }

    // paste the paper onto the main canvas + fade its oldest (leftmost) content
    function compositeRibbon(energy, dim) {
      ctx2d.globalAlpha = dim;
      ctx2d.drawImage(rcv, 0, 0, rcv.width, rcv.height, 0, stripTop, W, stripH);
      ctx2d.globalAlpha = 1;
      // the manuscript sinks back into void as it scrolls off
      if (!ribbonFade) {
        ribbonFade = ctx2d.createLinearGradient(0, 0, W * 0.25, 0);
        ribbonFade.addColorStop(0, "rgba(5,6,7,0.78)");
        ribbonFade.addColorStop(1, "rgba(5,6,7,0)");
      }
      ctx2d.fillStyle = ribbonFade;
      ctx2d.fillRect(0, stripTop, W * 0.25, stripH);
      // hairline separating page from void — barely there
      ctx2d.fillStyle = rgba(VERDIGRIS, 0.06 + energy * 0.04);
      ctx2d.fillRect(0, stripTop, W, 1);
    }

    requestAnimationFrame(draw);
  }

  window.BardoViz = { init: init };
})();

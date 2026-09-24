// ============================================================================
// ZANKYŌ — zk-set.js: 隣 THE SECOND SET (映像管 MSHI CRT-9 · 受信専用)
//
// The station's second, older, receive-only tube, bolted to the right of the
// scope (S0 of PLAN-SIGNAL-INTEGRATION.md; the look is mockup 1,
// mockups/monitor-1-second-set.html, ported faithfully). This module owns
// ONLY the picture: a 192×144 source → P39 long-persistence phosphor → a
// full-resolution frame with real persistence, bloom, band tearing, vertical-
// hold roll, a multipath ghost, snow, Paik's line — composed through a
// cracked glass (an SVG fracture, seeded per night from four patterns, the
// picture sliced into shards that refract along it, a chip where the phosphor
// is gone). It never touches audio.
//
// IDLE IS A FIRST-CLASS MODE (99 % of the night): a faint raster crawls with a
// slow vignette and sparse thermal sparks, a green retrace echoes the scope's
// sweep, an MSHI test card surfaces from the depth every ~20 s with the hold
// slipping, and now and then the raster folds into one line of light (Paik,
// Zen for TV) and goes out or shrinks to a dot. Its timings draw from their
// own PJ2.Rand fork ("set:idle") off the engine's master seed — the engine's
// streams are never touched, so the music is bit-identical with the set
// running. Per-pixel snow and thermal sparks are texture and stay unseeded
// (the character contract's allowance).
//
// THE GESTURE (S2 lights it): a signal descriptor { t0, holdS, lossD, drops }
// in AUDIO time; the phase (tuning 0.4 s → hold → loss → collapse 0.42 s →
// burst 0.32 s → dead 1.6 s) is derived from Z.getAudioTime() every frame, so
// the picture cannot drift from the sound and a throttled tab catches up.
// In S0 no descriptor arrives; the set idles. ZankyoSet._dev.tune() runs the
// gesture on the test card for the bench.
//
// 映り THE FRAME IN PASSES (PLAN-SIGNAL-PICTURE §5.1, P0). What a reception
// looks like — its snow, its tear, its ghosts, its breath — is a CHARACTER
// drawn per reception by zk-picture.js (loaded first); this file keeps the
// phase machine, the canvases and the compositing, and runs every frame as
// five ordered passes: 1 source (luma + drive + noise, 192×144), 2 geometry
// (the hold's roll, the squash, the per-line offset map), 3 ghosts (the echo
// list), 4 the tube (the P39 ramp), 5 the full-resolution composite, then the
// crack. At P0 there is one character, rc.91's look, and the frame is
// pixel-identical to rc.91's under seeded texture (_picture-probe.js).
//
// THE BENCH HOOKS (§6.2): _dev.character(), _dev.force(), _dev.seedTexture(),
// _dev.freeze()/step()/thaw() — a virtual clock and a frame-step, because a
// headless tab's rAF runs at ~1 fps and a capture must not depend on it. A
// page may also set window.ZK_SET_DEV = { manual, clock, texture, noFilter }
// BEFORE this file loads so the init-time timings are virtual too (the probe
// does; production never sets it).
//
// Headless: the probe loads every zk-*.js from index.php — no DOM, no-op.
// ============================================================================
(function () {
  "use strict";
  if (typeof document === "undefined" || typeof window === "undefined") return;
  var Z = window.ZankyoAudio, PJ = window.PJ2, ZP = window.ZankyoPicture;
  var tcv = document.getElementById("zankyo-set");
  if (!Z || !PJ || !PJ.Rand || !ZP || !tcv) return;
  var crackSvg = document.getElementById("zankyo-crack");
  var rx = document.getElementById("zankyo-rx");
  var tuneBtn = document.getElementById("zankyo-tune");
  var tube = document.getElementById("zankyo-tube") || tcv.parentNode;

  var realNow = function () { return (window.performance && performance.now) ? performance.now() : Date.now(); };
  // THE BENCH'S VIRTUAL CLOCK (§6.2). null in production: now() is the page's
  // clock. Frozen (_dev.freeze / ZK_SET_DEV.manual), now() is whatever the last
  // _dev.step() said, the rAF loop draws nothing, and the SIGNAL clock is the
  // virtual one too — a frozen tube is driven by bench descriptors in virtual
  // time; a real reception's t0 is in AudioContext time, so thaw first.
  var DEV = window.ZK_SET_DEV || null;
  var vclock = (DEV && DEV.manual) ? (+DEV.clock || 0) : null;
  var now = function () { return vclock != null ? vclock : realNow(); };
  // the signal clock: the AudioContext's, once it exists (the engine creates it
  // on PLAY or a ♪ press); before that, the wall clock in seconds — the bench
  // gesture can run on a page that has never played
  var atime = function () { if (vclock != null) return vclock / 1000; var c = Z.getAudioContext && Z.getAudioContext(); return c ? c.currentTime : now() / 1000; };
  var wallTime = function () { return now() / 1000; };
  // a signal remembers the clock it started on (critic S0 r1 §2.7a): a bench
  // signal started before PLAY keeps its wall clock even after the context appears
  var sigTime = function () { return (sig && sig.wall) ? wallTime() : atime(); };
  var clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  // texture only (snow, sparks, tear jitter, the dial pointer): Math.random,
  // by the character contract — or, on the bench, a seeded stream
  // (_dev.seedTexture) so a capture is pixel-reproducible
  var rnd = (DEV && DEV.texture != null) ? ZP.textureRng(+DEV.texture) : Math.random;

  // ---- seeded streams: forks off the engine's master seed, labels of our own ----
  var seed = (Z.getSeed && Z.getSeed()) || 3042;
  var master = PJ.Rand.stream(seed);
  var Ridle = master.fork("set:idle"), Rcrack = master.fork("set:crack");

  // ==========================================================================
  // THE CRACK — point data in a 400×300 space. Four patterns, one per night.
  // Each: the impact P0 (with its star of hairlines), the fractures (the first
  // four are the deep ones — a run to an edge and its branches — the rest are
  // dead-end hairlines), a corner chip where the phosphor is gone, and four
  // shards that tile the rectangle, each with its own slip. Pattern A is the
  // designer's, verbatim; B–D follow its grammar.
  // ==========================================================================
  var CRACK_W = [1.1, 1.4, 1.0, 1.1, 0.5, 0.45, 0.5];
  var CRACK_DASH = ["11 7 4 15 19 5", "16 6 9 13 5 21 12 4", "8 10 14 5 6 17", "13 9 6 4 18 7 10 12", "6 9 4 11", "5 8", "7 6 3 9"];
  var PATTERNS = (function () {
    var A0 = [296, 74];
    var A = {
      name: "A · upper-right impact, the run to the floor",
      stars: [[A0[0], A0[1], 7]],
      cracks: [
        [[322, -2], [312, 28], [310, 40], A0],                                       // up to the top edge
        [A0, [262, 118], [250, 130], [228, 160], [215, 175], [200, 214], [190, 240], [178, 272], [170, 302]],   // the main run
        [A0, [318, 82], [340, 90], [366, 92], [402, 105]],                           // off to the right edge
        [[215, 175], [186, 170], [160, 168], [136, 176], [110, 180], [84, 172], [60, 176], [30, 186], [-2, 190]],   // the branch left
        [[250, 130], [258, 146], [262, 150], [259, 162], [258, 172]],                // hairlines (dead-end)
        [[340, 90], [346, 108], [343, 122]],
        [[110, 180], [104, 196], [108, 212]],
      ],
      chip: [[0, 262], [16, 268], [26, 282], [40, 288], [48, 302], [-2, 302]],
      shards: [
        { poly: [[0, 0], [322, 0], [312, 28], [310, 40], A0, [262, 118], [250, 130], [228, 160], [215, 175], [186, 170], [160, 168], [136, 176], [110, 180], [84, 172], [60, 176], [30, 186], [0, 190]], dx: 0, dy: 0, a: 1 },
        { poly: [[322, 0], [400, 0], [400, 105], [366, 92], [340, 90], [318, 82], A0, [310, 40], [312, 28]], dx: 3, dy: -2, a: 0.93 },
        { poly: [A0, [318, 82], [340, 90], [366, 92], [400, 105], [400, 300], [170, 300], [178, 272], [190, 240], [200, 214], [215, 175], [228, 160], [250, 130], [262, 118]], dx: -4, dy: 3, a: 1 },
        { poly: [[0, 190], [30, 186], [60, 176], [84, 172], [110, 180], [136, 176], [160, 168], [186, 170], [215, 175], [200, 214], [190, 240], [178, 272], [170, 300], [0, 300]], dx: 2, dy: 5, a: 0.96 },
      ],
    };
    var B0 = [96, 222];
    var B = {
      name: "B · lower-left impact, the run to the top",
      stars: [[B0[0], B0[1], 7]],
      cracks: [
        [B0, [108, 190], [118, 160], [112, 128], [124, 96], [130, 60], [122, 30], [128, -2]],   // the main run, up to the top edge
        [[118, 160], [150, 166], [190, 158], [230, 164], [270, 156], [310, 162], [350, 150], [402, 156]],   // the branch right, to the edge
        [B0, [70, 228], [44, 236], [20, 232], [-2, 240]],                            // to the left edge
        [B0, [104, 246], [98, 270], [106, 302]],                                     // to the bottom edge
        [[124, 96], [140, 100], [148, 112]],                                         // hairlines
        [[230, 164], [236, 180], [232, 196]],
        [[70, 228], [64, 212], [68, 200]],
      ],
      chip: [[352, -2], [366, 10], [378, 16], [390, 28], [402, 36], [402, -2]],
      shards: [
        { poly: [[0, 0], [128, 0], [122, 30], [130, 60], [124, 96], [112, 128], [118, 160], [108, 190], B0, [70, 228], [44, 236], [20, 232], [0, 240]], dx: 0, dy: 0, a: 1 },
        { poly: [[128, 0], [400, 0], [400, 156], [350, 150], [310, 162], [270, 156], [230, 164], [190, 158], [150, 166], [118, 160], [112, 128], [124, 96], [130, 60], [122, 30]], dx: -3, dy: 2, a: 0.95 },
        { poly: [[118, 160], [150, 166], [190, 158], [230, 164], [270, 156], [310, 162], [350, 150], [400, 156], [400, 300], [106, 300], [98, 270], [104, 246], B0, [108, 190]], dx: 2, dy: -4, a: 1 },
        { poly: [[0, 240], [20, 232], [44, 236], [70, 228], B0, [104, 246], [98, 270], [106, 300], [0, 300]], dx: -2, dy: 3, a: 0.93 },
      ],
    };
    var C0 = [344, 138];
    var C = {
      name: "C · struck from the right, the long run across",
      stars: [[C0[0], C0[1], 7]],
      cracks: [
        [C0, [312, 146], [280, 140], [244, 152], [206, 146], [170, 158], [130, 150], [96, 162], [60, 156], [28, 166], [-2, 160]],   // the main run, clear across to the left edge
        [[280, 140], [286, 110], [278, 80], [290, 48], [284, 20], [292, -2]],        // up to the top edge
        [[170, 158], [176, 190], [166, 224], [178, 258], [170, 302]],                // down to the bottom edge
        [C0, [372, 132], [402, 128]],                                                // the short way out, to the right edge
        [C0, [338, 120], [344, 104]],                                                // hairlines
        [[96, 162], [90, 180], [96, 196]],
        [[244, 152], [250, 170], [246, 184]],
      ],
      chip: [[402, 262], [388, 270], [378, 284], [368, 302], [402, 302]],
      shards: [
        { poly: [[0, 0], [292, 0], [284, 20], [290, 48], [278, 80], [286, 110], [280, 140], [244, 152], [206, 146], [170, 158], [130, 150], [96, 162], [60, 156], [28, 166], [0, 160]], dx: 0, dy: 0, a: 1 },
        { poly: [[292, 0], [400, 0], [400, 128], [372, 132], C0, [312, 146], [280, 140], [286, 110], [278, 80], [290, 48], [284, 20]], dx: 3, dy: -2, a: 0.94 },
        { poly: [[0, 160], [28, 166], [60, 156], [96, 162], [130, 150], [170, 158], [176, 190], [166, 224], [178, 258], [170, 300], [0, 300]], dx: -2, dy: 4, a: 0.96 },
        { poly: [[170, 158], [206, 146], [244, 152], [280, 140], [312, 146], C0, [372, 132], [400, 128], [400, 300], [170, 300], [178, 258], [166, 224], [176, 190]], dx: 4, dy: 2, a: 1 },
      ],
    };
    var D0 = [212, 58], D1 = [330, 230];
    var D = {
      name: "D · struck twice, the run down the left",
      stars: [[D0[0], D0[1], 7], [D1[0], D1[1], 5]],
      cracks: [
        [D0, [196, 84], [176, 110], [162, 146], [140, 176], [126, 212], [104, 244], [92, 276], [86, 302]],   // the main run, down-left to the floor
        [D0, [240, 66], [272, 60], [304, 70], [336, 64], [366, 74], [402, 68]],      // the branch right, to the edge
        [[162, 146], [130, 140], [96, 148], [60, 140], [30, 150], [-2, 144]],        // the branch left
        [D0, [218, 30], [210, -2]],                                                  // the short stub to the top edge
        [[272, 60], [278, 80], [272, 96]],                                           // hairline
        [D1, [318, 214], [312, 200]],                                                // the second, smaller blow: two hairlines, nothing runs
        [D1, [346, 244], [352, 260]],
      ],
      chip: [[-2, 268], [12, 276], [24, 290], [30, 302], [-2, 302]],
      shards: [
        { poly: [[0, 0], [210, 0], [218, 30], D0, [196, 84], [176, 110], [162, 146], [130, 140], [96, 148], [60, 140], [30, 150], [0, 144]], dx: -2, dy: -2, a: 0.96 },
        { poly: [[210, 0], [400, 0], [400, 68], [366, 74], [336, 64], [304, 70], [272, 60], [240, 66], D0, [218, 30]], dx: -4, dy: 2, a: 0.93 },
        { poly: [[0, 144], [30, 150], [60, 140], [96, 148], [130, 140], [162, 146], [140, 176], [126, 212], [104, 244], [92, 276], [86, 300], [0, 300]], dx: 2, dy: 3, a: 1 },
        { poly: [D0, [240, 66], [272, 60], [304, 70], [336, 64], [366, 74], [400, 68], [400, 300], [86, 300], [92, 276], [104, 244], [126, 212], [140, 176], [162, 146], [176, 110], [196, 84]], dx: 3, dy: -3, a: 1 },
      ],
    };
    return [A, B, C, D];
  })();
  var patternIdx = Math.floor(Rcrack.next() * PATTERNS.length);   // one draw: the night's crack
  var P = PATTERNS[patternIdx];

  function ptsToPath(pl) { return "M" + pl.map(function (p) { return p[0] + " " + p[1]; }).join(" L"); }
  function buildCrackSVG() {
    if (!crackSvg) return;
    var paths = P.cracks.map(ptsToPath), d = paths.join(" ");
    var chip = ptsToPath(P.chip) + " Z";
    // the impact(s): short radial hairlines around the blow
    var star = "";
    P.stars.forEach(function (s) {
      for (var i = 0; i < s[2]; i++) {
        var a = -0.4 + i * (6.5 / s[2]), r0 = 2 + (i % 3), r1 = 7 + ((i * 5) % 9);
        star += "M" + (s[0] + Math.cos(a) * r0).toFixed(1) + " " + (s[1] + Math.sin(a) * r0).toFixed(1) + " L" + (s[0] + Math.cos(a + 0.1) * r1).toFixed(1) + " " + (s[1] + Math.sin(a + 0.1) * r1).toFixed(1) + " ";
      }
    });
    var html =
      '<defs><filter id="zk-ck-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.1"/></filter></defs>' +
      // the chip: dark tube behind the glass, a rim of glass thickness
      '<path d="' + chip + '" fill="#040605"/>' +
      '<path d="' + chip + '" fill="none" stroke="rgba(120,140,120,0.32)" stroke-width="2.4" vector-effect="non-scaling-stroke"/>' +
      '<path d="' + chip + '" fill="none" stroke="rgba(230,255,235,0.5)" stroke-width="0.8" vector-effect="non-scaling-stroke" stroke-dasharray="9 4 14 3"/>' +
      // the shadow side of every fracture
      '<path d="' + d + '" fill="none" stroke="rgba(0,0,0,0.6)" stroke-width="2" vector-effect="non-scaling-stroke" transform="translate(1.1 1.3)" filter="url(#zk-ck-blur)"/>';
    // each crack: a soft body at its own weight, and a sharp glint that only catches the light in places
    P.cracks.forEach(function (pl, i) {
      var w = CRACK_W[i % CRACK_W.length], dash = CRACK_DASH[i % CRACK_DASH.length], deep = i < 4;
      html += '<path d="' + paths[i] + '" fill="none" stroke="rgba(190,215,200,0.2)" stroke-width="' + (w * 1.7).toFixed(2) + '" vector-effect="non-scaling-stroke" filter="url(#zk-ck-blur)"/>';
      html += '<path d="' + paths[i] + '" fill="none" stroke="rgba(235,250,240,' + (deep ? 0.34 : 0.22) + ')" stroke-width="' + w.toFixed(2) + '" vector-effect="non-scaling-stroke" stroke-linecap="round"/>';
      html += '<path d="' + paths[i] + '" fill="none" stroke="rgba(255,255,250,' + (deep ? 0.7 : 0.45) + ')" stroke-width="' + (w * 0.8).toFixed(2) + '" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-dasharray="' + dash + '"/>';
    });
    html += '<path d="' + star + '" fill="none" stroke="rgba(240,255,245,0.55)" stroke-width="0.6" vector-effect="non-scaling-stroke"/>';
    P.stars.forEach(function (s) { html += '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + (s[2] >= 7 ? 2.2 : 1.4) + '" fill="rgba(240,255,245,0.3)" filter="url(#zk-ck-blur)"/>'; });
    crackSvg.innerHTML = html;
  }

  // ==========================================================================
  // CANVASES — source 192×144 → phosphor 192×144 → frame (full res) → the tube
  //
  // SETTLED (PLAN-MONITOR-2 §1): the reels on disk are 192 × 144 and the shader
  // was throwing three quarters of every one of them away. Raising the raster
  // to the files' own size costs no new bytes and no downloads, and it more
  // than pays for the bigger tube: at 488 px wide this is 2.5 screen px per
  // source pixel — FINER than the 96 × 72 raster was at the old 276 px tube.
  // ==========================================================================
  var SW = 192, SH = 144;
  var src = document.createElement("canvas"); src.width = SW; src.height = SH;
  var scx = src.getContext("2d", { willReadFrequently: true });
  var phos = document.createElement("canvas"); phos.width = SW; phos.height = SH; var pcx = phos.getContext("2d");
  var pimg = pcx.createImageData(SW, SH), pdata = pimg.data;
  var frame = document.createElement("canvas"), fcx = frame.getContext("2d");
  var tcx = tcv.getContext("2d");
  var hasFilter = (typeof fcx.filter === "string") && !(DEV && DEV.noFilter);   // canvas filters (the bloom); older Safari lacks them (ZK_SET_DEV.noFilter: the bench takes that path in Chrome)
  var blurCv = null, bcx = null;                          // the no-filter bloom: a 24×18 pre-shrunk copy, upscaled smooth
  if (!hasFilter) { blurCv = document.createElement("canvas"); blurCv.width = 24; blurCv.height = 18; bcx = blurCv.getContext("2d"); }
  var TW = 0, TH = 0, dpr = 1;

  // P39 ramp — long-persistence yellow-green; gamma 1.3 keeps the mid-tones
  // dark. The tube's constants live in zk-picture.js (ZP.TUBE, §3.4: P4 ages
  // them per night on "set:tube"); the tables are built there.
  var LUT = ZP.tubeLUT(ZP.TUBE);
  // the frame's working buffers at source resolution: one luma byte per
  // pixel (pass 1 → pass 4), and the per-line offset map (pass 2 → 5) — two
  // of them, because rc.91 tears the roll's wrapped copy with its own draw
  // (see geometryPass)
  var luma = new Uint8Array(SW * SH);
  var mapA = new Float64Array(SH), mapB = new Float64Array(SH);
  var ghosts = [];

  // ==========================================================================
  // 輝度 BRIGHT — the ledge's left rocker, four steps.
  // Not a multiply. On a real tube brightness is how hard the beam is driven
  // and how far the phosphor spreads, so one step moves the black lift and the
  // gain the LUT is fed ((l − lift) × gain), the bloom pass's alpha and blur
  // radius, and how warm the idle raster glows — together.
  // ==========================================================================
  var BRI = [
    { lift: 25, gain: 1.03, bloom: 0.55, blur: -0.30, idle: 0.55 },
    { lift: 18, gain: 1.22, bloom: 1.00, blur: 0.00, idle: 1.00 },   // ← the live tube's settings before the ledge existed
    { lift: 12, gain: 1.44, bloom: 1.45, blur: 0.30, idle: 1.35 },
    { lift: 6,  gain: 1.70, bloom: 1.95, blur: 0.62, idle: 1.70 }
  ];
  var briV = 1, B = BRI[1];

  var shardPaths = null, chipPath = null, crackPath = null;
  function buildPaths() {
    var sx = TW / 400, sy = TH / 300;
    function poly(pts, close) { var p = new Path2D(); pts.forEach(function (pt, i) { if (i) p.lineTo(pt[0] * sx, pt[1] * sy); else p.moveTo(pt[0] * sx, pt[1] * sy); }); if (close) p.closePath(); return p; }
    shardPaths = P.shards.map(function (s) { return poly(s.poly, true); });
    chipPath = poly(P.chip, true);
    crackPath = new Path2D(); P.cracks.forEach(function (pl) { pl.forEach(function (pt, i) { if (i) crackPath.lineTo(pt[0] * sx, pt[1] * sy); else crackPath.moveTo(pt[0] * sx, pt[1] * sy); }); });
  }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    var tr = tcv.getBoundingClientRect(); TW = tr.width; TH = tr.height;
    if (TW < 8 || TH < 8) return;
    tcv.width = Math.floor(TW * dpr); tcv.height = Math.floor(TH * dpr); tcx.setTransform(dpr, 0, 0, dpr, 0, 0);
    frame.width = tcv.width; frame.height = tcv.height; fcx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fcx.fillStyle = "#030503"; fcx.fillRect(0, 0, TW, TH);
    buildPaths();
  }

  // ==========================================================================
  // THE SIGNAL — a descriptor in audio time; the phase is derived each frame
  // ==========================================================================
  var TUNE_S = 0.4, COLLAPSE_S = 0.42, BURST_S = 0.32, DEAD_S = 1.6;
  var sig = null;             // { t0, holdS, lossD, drops: [[t, d], …], id, title, year, video?, lossD }
  var S = { phase: "idle", phaseAt: 0, strength: 0, seed: 0, drop: 0, holdFrame: 0, roll: 0, rollV: 0, ch: null };
  // 映り THE CHARACTER (§4). A reception's look, drawn when it arrives on its
  // own fork of the master seed ("set:rx:<desc.seed>" — desc.seed is already
  // the receiver's draw, so the same night gives the same characters and no
  // engine stream is touched). The idle and dead tube keep the resting one.
  // At P0 every draw is 今, rc.91's look.
  var force = null;                                          // the bench's override (_dev.force)
  var restCh = ZP.drawCharacter(null, {});
  S.ch = restCh;
  var chDeg = -40;
  // 形 THE SHAPE OF A RECEPTION (PLAN-SIGNAL-SHAPES.md §4.3). The tube used to
  // derive its phase from three numbers — tune, hold, loss — which was the
  // whole of what a reception could be. It is handed the reception PLAN now and
  // walks it: the arrival (a snap, a hunt through the snow, a slow surfacing),
  // each piece, each carrier-lost gap between pieces with its relock, and the
  // exit. A one-piece plan gives back exactly the five phases it always gave,
  // at exactly the same moments, which is what R0's identity gate rests on.
  //
  // THE ENTRY IS DRAWN AS ONE OF THREE. 即 the snap is today's 0.4 s tune-in;
  // 探 the hunt is the dial hunting 3–8 s, with glimpses of a picture flickering
  // out of the snow at times the plan names; 浮 the drift-in is the signal
  // surfacing over 6–10 s with no snap at all.
  function phaseOf(a) {
    if (!sig) return ["idle", 0];
    var P = sig.rx, e = a - sig.t0;
    if (e < 0) return ["idle", 0];
    if (e < P.entryS) return [P.entry === "tan" ? "hunting" : P.entry === "fu" ? "drifting" : "tuning", e];
    var segs = P.segments, gaps = P.gaps;
    for (var i = 0; i < segs.length; i++) {
      if (i > 0) {
        var g = gaps[i - 1];
        if (e < g.atS + g.durS) return [g.sweep ? "sweeping" : "lost", e - g.atS];   // 走's dial sweep, or 戻's dead carrier
      }
      if (e < segs[i].atS) return ["relock", e - segs[i].lockAtS];
      if (e < segs[i].atS + segs[i].onS) return ["hold", e - segs[i].atS];
    }
    if (e < P.spanS) return ["loss", e - P.lossAtS];
    e -= P.spanS; if (e < COLLAPSE_S) return ["collapse", e];
    e -= COLLAPSE_S; if (e < BURST_S) return ["burst", e];
    e -= BURST_S; if (e < DEAD_S) return ["dead", e];
    return ["over", e];
  }
  // today's clip, in the plan's grammar — for a descriptor that carries no
  // plan (an old caller, or the ♪ audition before §4.3 reached it)
  function planOne(holdS, lossD) {
    return { body: "jou", entry: "soku", exit: "setsu", entryS: TUNE_S, exitS: lossD,
      lossAtS: TUNE_S + holdS, spanS: TUNE_S + holdS + lossD, presenceS: holdS,
      segments: [{ atS: TUNE_S, onS: holdS, lockS: 0, lockAtS: TUNE_S }], gaps: [], holes: [], glimpses: null, porous: null, callback: false };
  }
  // is the picture inside a 断 hole — a real loss and recovery inside a piece?
  function inHole(e) {
    var h = sig && sig.rx && sig.rx.holes;
    if (!h) return 0;
    for (var i = 0; i < h.length; i++) { if (e >= h[i].atS && e < h[i].atS + h[i].durS) return Math.min(1, (e - h[i].atS) / 0.35); if (h[i].atS > e) break; }
    return 0;
  }
  function stepTunePointer() {
    chDeg += 30 + rnd() * 25; if (chDeg > 135) chDeg = -135 + (chDeg - 135);
    if (tuneBtn) tuneBtn.style.setProperty("--ch", chDeg.toFixed(0) + "deg");
  }
  function enterPhase(ph, t) {
    S.phase = ph; S.phaseAt = t;
    if (!rx) return;
    if (ph === "tuning" || ph === "hunting" || ph === "sweeping") { rx.classList.add("is-flicker"); rx.classList.remove("is-lit"); stepTunePointer(); }
    else if (ph === "drifting" || ph === "lost") { rx.classList.add("is-flicker"); rx.classList.remove("is-lit"); }
    else if (ph === "relock") { rx.classList.add("is-flicker"); }
    else if (ph === "hold") { rx.classList.remove("is-flicker"); rx.classList.add("is-lit"); }
    else if (ph === "loss") { rx.classList.add("is-flicker"); }
    else if (ph === "collapse") { rx.classList.remove("is-lit"); }
    else if (ph === "dead" || ph === "idle") { rx.classList.remove("is-flicker"); rx.classList.remove("is-lit"); }
  }
  // ---- 掃引 THE SWEEP (plan §7): while the tuning dial turns, the tube shows
  // snow. It follows the HAND: every bit of rotation raises it, and it decays
  // over ~0.7 s, so the picture is loud while the fingers move and settles the
  // moment they stop. It only ever paints on an idle or dead tube — a signal
  // already up owns the screen and the dial must not scribble on it.
  var sweepAmt = 0, sweepAt = 0;
  function sweep(a) {
    a = +a; if (!(a > 0)) return;
    var tn = now();                                          // the set's clock (the bench's, when frozen)
    if (tn - sweepAt > 900) sweepAmt = 0;                    // a fresh gesture starts from nothing
    sweepAt = tn;
    sweepAmt = Math.min(1, Math.max(sweepAmt, a));
  }
  // The decayed sweep level. It reads its OWN wall clock rather than taking a
  // timestamp, because the two callers are in different clocks (sourcePass
  // gets the frame time, compose gets nothing) and a snow level does not need
  // the audio clock's precision — it needs to follow a hand.
  function sweepNow() {
    if (sweepAmt <= 0) return 0;
    var dt = (now() - sweepAt) / 1000;
    if (dt > 3) { sweepAmt = 0; return 0; }
    return sweepAmt * Math.exp(-dt / 0.7);
  }
  function endSignal(t) {
    sig = null;                                              // the receiver owns the element; the set never pauses it
    S.roll = 0; S.rollV = 0; S.drop = 0; S.holdFrame = 0; S.strength = 0; S.ch = restCh;
    idle.nextCard = t + 6000 + Ridle.next() * 10000; idle.nextLine = t + 8000 + Ridle.next() * 12000;
    enterPhase("idle", t);
  }
  function inDrop(a) {
    var d = sig && sig.drops;
    if (!d) return false;
    for (var i = 0; i < d.length; i++) { if (a >= d[i][0] && a < d[i][0] + d[i][1]) return true; if (d[i][0] > a) break; }
    return false;
  }
  // per-frame strength + weather, from the audio clock
  function tickSignal(t) {
    var a = sigTime(), pe = phaseOf(a), ph = pe[0], el = pe[1];
    if (ph === "over") { endSignal(t); return; }
    if (ph !== S.phase) enterPhase(ph, t);
    if (ph === "tuning") {
      S.strength = clamp01(el / TUNE_S) * 0.85;
    } else if (ph === "hunting") {
      // 探 THE HUNT: the dial hunting through the snow. The picture resolves for
      // a glimpse at each of the times the plan drew and loses again — the
      // vertical hold slipping every time it nearly catches. The glimpses are
      // not on-air time and the audio is only a syllable, so the tube is the
      // instrument that sells this one.
      var gl = sig.rx.glimpses, str = 0;
      if (gl) for (var gi = 0; gi < gl.length; gi++) {
        var gk = (el - gl[gi][0]) / gl[gi][1];
        if (gk >= 0 && gk < 1) { str = Math.max(str, 0.78 * Math.sin(Math.PI * gk)); if (gk < 0.12) S.rollV += 1.4; }
      }
      S.strength = str;
    } else if (ph === "drifting") {
      // 浮 THE DRIFT-IN: no snap at all. The signal surfaces from under the
      // static, condensing out of snow over the whole entry.
      var dk = clamp01(el / Math.max(0.01, sig.rx.entryS));
      S.strength = 0.85 * dk * dk;
    } else if (ph === "lost" || ph === "sweeping") {
      // 戻 / 走: the carrier is GONE. Snow, the last frame ghosting away, the
      // hold rolling. A sweep rolls harder — the dial is moving.
      S.strength = 0;
      if (rnd() < (ph === "sweeping" ? 0.5 : 0.18)) S.rollV += (rnd() - 0.35) * (ph === "sweeping" ? 4 : 2);
    } else if (ph === "relock") {
      S.strength = clamp01(el / Math.max(0.05, sig.rx.segments[0].lockS || 0.2)) * 0.85;
    } else if (ph === "hold") {
      var ch = S.ch, dr = ch.drop;
      var breath = ZP.breath(ch.breath, el, S.seed);
      var dropping = inDrop(a);
      if (dropping && S.drop <= 0 && rnd() < dr.holdP) S.holdFrame = t + dr.holdMs[0] + rnd() * dr.holdMs[1];   // a frame-hold rides some dropouts
      S.drop = dropping ? 1 : 0;
      // 断 A HOLE is not a dropout: the picture tears and rolls through a real
      // loss of one to three seconds and comes back where it would be.
      var hk = inHole(a - sig.t0);
      if (hk > 0) { S.rollV += (rnd() - 0.4) * 2.2; if (rnd() < 0.25) S.holdFrame = t + 90 + rnd() * 180; }
      S.strength = clamp01(breath - (dropping ? dr.depth : 0) - hk * 0.75);
    } else if (ph === "loss") {
      var k = clamp01(el / Math.max(0.02, sig.rx.exitS));    // 0..1 through the loss
      S.strength = clamp01(0.85 * (1 - k * k) - (rnd() < k * 0.5 ? 0.4 : 0));
      if (rnd() < k * 0.25) S.holdFrame = t + 80 + rnd() * 160;
      S.rollV += (rnd() - 0.4) * k * 3;                      // the hold slips
    } else if (ph === "collapse") {
      S.strength = 0.9;
    } else if (ph === "burst" || ph === "dead") {
      S.strength = 0;
    }
  }

  // ==========================================================================
  // THE SOURCE PICTURE (192×144 greyscale): the reel, the test card, the idle
  // ==========================================================================
  var idle = { nextCard: now() + 6000 + Ridle.next() * 8000, cardAt: -1, nextLine: now() + 9000 + Ridle.next() * 10000, lineAt: -1, lineMode: 0, lineHold: 1 };
  function drawTestCard(alpha, drift) {
    // an MSHI test card: circle, crosshair, greyscale steps, the yard's mark
    scx.save(); scx.globalAlpha = alpha;
    // The card is laid out in the 96 × 72 coordinates it was drawn for. The
    // raster is 192 × 144 now, so the card is SCALED onto it rather than
    // re-typed — every figure below still means what it meant, and the drift
    // still moves the card exactly as far as it used to.
    var CW = 96, CH = 72;
    scx.scale(SW / CW, SH / CH);
    if (drift) scx.translate(drift, 0);
    scx.fillStyle = "#3a3a3a"; scx.fillRect(-4, 0, CW + 8, CH);
    for (var i = 0; i < 8; i++) { scx.fillStyle = "rgb(" + (i * 32) + "," + (i * 32) + "," + (i * 32) + ")"; scx.fillRect(i * 12, 6, 12, 10); }
    scx.strokeStyle = "#cfcfcf"; scx.lineWidth = 1.2;
    scx.beginPath(); scx.arc(48, 40, 26, 0, Math.PI * 2); scx.stroke();
    scx.beginPath(); scx.moveTo(48, 14); scx.lineTo(48, 66); scx.moveTo(22, 40); scx.lineTo(74, 40); scx.stroke();
    scx.strokeStyle = "#8a8a8a"; for (var g = 0; g < CW; g += 12) { scx.beginPath(); scx.moveTo(g + 0.5, 18); scx.lineTo(g + 0.5, 62); scx.stroke(); }
    scx.fillStyle = "#e8e8e8"; scx.fillRect(38, 34, 20, 12); scx.fillStyle = "#101010"; scx.fillRect(40, 36, 16, 8);
    scx.fillStyle = "#e0e0e0"; scx.font = '700 7px "Orbitron", sans-serif'; scx.fillText("MSHI", 36, 62);
    scx.font = '6px "Shippori Mincho", serif'; scx.fillText("映像管 試験", 60, 56);
    scx.fillStyle = "#0a0a0a"; scx.fillRect(0, 64, CW, 8); scx.fillStyle = "#d0d0d0"; scx.fillRect(4, 66, 30, 4); scx.fillRect(62, 66, 30, 4);
    scx.restore();
  }
  // PASS 1 — SOURCE (192×144). The picture onto the source canvas — the reel,
  // the test card, or the idle raster — then luma, the beam's drive and the
  // noise into `luma` (zk-picture.js sourcePass: the character's snow).
  function sourcePass(t) {
    var ph = S.phase;
    scx.globalAlpha = 1;
    // The picture is drawn for every phase in which there is a picture to draw
    // — including the ones where its strength is zero, because a carrier-lost
    // gap should show the last frame ghosting away under the snow rather than
    // cutting to the idle raster (the tube has not been switched off; it has
    // lost the station). burst and dead are black by design.
    if (ph === "tuning" || ph === "hold" || ph === "loss" || ph === "collapse" ||
        ph === "hunting" || ph === "drifting" || ph === "relock" || ph === "lost" || ph === "sweeping") {
      if (t < S.holdFrame) { /* frame hold: keep the last picture */ }
      else if (sig.video) { try { scx.drawImage(sig.video, 0, 0, SW, SH); } catch (e) { scx.fillStyle = "#000"; scx.fillRect(0, 0, SW, SH); } }
      else drawTestCard(0.9, Math.sin(t / 700) * 3);          // the bench: the test card stands in for a reel
    } else if (ph === "burst" || ph === "dead") {
      scx.fillStyle = "#000"; scx.fillRect(0, 0, SW, SH);
    } else {
      // idle: a faint raster, breathing, crawling; the test card surfaces now and then
      scx.fillStyle = "#000"; scx.fillRect(0, 0, SW, SH);
      var card = idle.cardAt >= 0 ? (t - idle.cardAt) / 1000 : -1;
      if (card >= 0 && card < 1.3) { var ca = card < 0.3 ? card / 0.3 : card > 0.9 ? (1.3 - card) / 0.4 : 1; drawTestCard(0.32 * ca, 0); }
      else if (card >= 1.3) { idle.cardAt = -1; idle.nextCard = t + 14000 + Ridle.next() * 12000; }
      if (idle.cardAt < 0 && t > idle.nextCard) { idle.cardAt = t; S.rollV = 2.5 + Ridle.next() * 3; }
    }
    var sdata = scx.getImageData(0, 0, SW, SH).data;
    // luminance → drive → snow. 掃引: on an idle or dead tube the snow is the dial's.
    var sw = (ph === "idle" || ph === "dead") ? sweepNow() : 0;
    var snow = ph === "burst" ? 1 : (ph === "idle" || ph === "dead") ? sw : clamp01(1 - S.strength);
    ZP.sourcePass(sdata, luma, SW * SH, ph === "idle" ? "idle" : ph === "dead" ? "dead" : "lit", snow, B, S.ch.snow, rnd);
  }

  // PASS 2 — GEOMETRY. The vertical hold's roll, the collapse's squash, and
  // the per-line offset map (§3.2) the composite reads. A dead tube draws
  // nothing but its persistence (rc.91's early return), so it has no geometry.
  //
  // TWO MAPS, ON PURPOSE (for now). When the picture rolls, rc.91 draws it
  // twice — the frame and its wrapped copy above the blanking bar — and each
  // copy drew its OWN tear. Physically they are the same scan lines and
  // should share one map; P0 keeps the second draw because the identity gate
  // is byte equality with rc.91 and that second draw consumes texture. P1,
  // where the look may move, makes it one map.
  var G = { roll: 0, sy: 1, dyBase: 0, pel: 0 };
  function geometryPass(t) {
    var ph = S.phase;
    if (ph === "dead") return;
    // vertical hold
    if (ph !== "idle" || S.rollV !== 0) {
      S.roll += S.rollV; S.rollV *= (ph === "loss" ? 0.985 : 0.9);
      if (Math.abs(S.rollV) < 0.05) S.rollV = 0;
      S.roll = ((S.roll % TH) + TH) % TH; if (S.rollV === 0 && ph !== "loss") S.roll += (0 - S.roll) * 0.2;
    }
    var roll = S.roll | 0, sy = 1, ch = S.ch;
    var pel = (t - S.phaseAt) / 1000;                          // seconds into the phase, for the shapes below
    if (ph === "collapse") { var ck = clamp01(pel / COLLAPSE_S); sy = Math.max(0.01, 1 - Math.pow(ck, ch.exit.squash)); }
    var tearAmt = ZP.tearAmount(ch.tear, ph, S.strength, S.drop > 0, pel, sig ? sig.lossD : 1);
    ZP.tearMap(mapA, SH, ch.tear, tearAmt, t, rnd);
    if (roll) ZP.tearMap(mapB, SH, ch.tear, tearAmt, t, rnd);
    G.roll = roll; G.sy = sy; G.pel = pel; G.dyBase = (TH - TH * sy) / 2;
  }

  // PASS 3 — GHOSTS: this frame's echo list, from the character (§3.3).
  function ghostPass(t) { ZP.ghostList(S.ch, S.phase, S.strength, t, ghosts); }

  // PASS 4 — THE TUBE: luma → the P39 ramp → the phosphor canvas, with the
  // idle raster's warm glow added under nothing (after the LUT, as rc.91 did).
  function tubePass(t) {
    var idleGlow = S.phase === "idle" ? (9 + 3 * Math.sin(t / 2300)) * B.idle : 0;
    ZP.tubePass(luma, pdata, SW, SH, LUT, idleGlow, B.idle, t / 240);
    pcx.putImageData(pimg, 0, 0);
  }

  // ==========================================================================
  // PASS 5 — THE FRAME (full resolution): persistence, bloom, the offset map,
  // the blanking bar, the ghosts, the line. Then compose() puts it through
  // the crack.
  // ==========================================================================
  function drawBloom(dy, sy, alpha, blurPx) {
    fcx.globalAlpha = Math.min(0.92, alpha * B.bloom);        // 輝度: how hard the phosphor is driven
    if (hasFilter) {
      fcx.filter = "blur(" + Math.max(0.5, blurPx + B.blur * 2.7).toFixed(1) + "px)";
      fcx.drawImage(phos, 0, dy, TW, TH * sy);
      fcx.filter = "none";
    } else {
      bcx.imageSmoothingEnabled = true; bcx.clearRect(0, 0, 24, 18); bcx.drawImage(phos, 0, 0, 24, 18);
      fcx.imageSmoothingEnabled = true; fcx.drawImage(blurCv, 0, dy, TW, TH * sy); fcx.imageSmoothingEnabled = false;
    }
    fcx.globalAlpha = 1;
  }
  // The offset map, drawn: one slice per run of `SH / map.bands` source rows,
  // each at its row's offset. Today's tear fills nine runs of 16 rows (the
  // SOURCE slice is a ninth of the raster, not a hard-coded 8 rows: a literal
  // 8 drew the top half nine times at 192 × 144); a line-accurate map is 144
  // runs of one. The slice geometry is rc.91's expressions verbatim —
  // `b * (TH / 9) * sy`, not `r0 * TH / SH` — because the two round
  // differently in the last bit and the gate is byte equality.
  function drawMap(map, dy, sy) {
    var nb = map.bands, bh = TH / nb, sbh = SH / nb, rows = SH / nb;
    for (var b = 0; b < nb; b++) fcx.drawImage(phos, 0, b * sbh, SW, sbh, map[b * rows], dy + b * bh * sy, TW, bh * sy + 0.5);
  }
  function composite(t) {
    var ph = S.phase, strength = S.strength, D = ZP.TUBE.decay, ex = S.ch.exit;
    fcx.globalCompositeOperation = "source-over";
    // persistence: the old frame decays under the new one (P39)
    var decay = ph === "idle" ? D.idle : ph === "dead" ? D.dead : ph === "burst" ? D.burst : D.lit;
    fcx.fillStyle = "rgba(3,5,3," + decay + ")"; fcx.fillRect(0, 0, TW, TH);
    // A dead tube shows only its decay. NOTE (§1.10, §5.5): the source pass
    // does compute the dial's sweep snow while dead, and it is never shown
    // here. The owner's ruling (§11.5, §9 Q7) is to draw it faintly; that is
    // a visible change and lands in P1, not in this refactor.
    if (ph === "dead") return;

    fcx.imageSmoothingEnabled = false;
    var roll = G.roll, sy = G.sy, pel = G.pel, dyBase = G.dyBase;

    // bloom under, sharp over
    fcx.globalCompositeOperation = "lighter";
    drawBloom(dyBase + roll * sy, sy, ph === "idle" ? 0.35 : 0.22 + strength * 0.14, 3 + strength * 2);
    if (roll) drawBloom(dyBase + (roll - TH) * sy, sy, ph === "idle" ? 0.35 : 0.22 + strength * 0.14, 3 + strength * 2);
    fcx.globalCompositeOperation = "source-over";
    drawMap(mapA, dyBase + roll * sy, sy);
    if (roll) { drawMap(mapB, dyBase + (roll - TH) * sy, sy); fcx.fillStyle = "rgba(0,0,0,0.75)"; fcx.fillRect(0, dyBase + roll * sy - 6, TW, 7); }   // the blanking bar
    // ghosts — multipath (the list is empty outside tuning, hold and loss)
    for (var gi = 0; gi < ghosts.length; gi++) {
      var gh = ghosts[gi];
      fcx.globalCompositeOperation = "lighter"; fcx.globalAlpha = gh.alpha;
      fcx.drawImage(phos, 0, 0, SW, SH, gh.dx, dyBase + roll * sy + gh.dy, TW, TH * sy);
      fcx.globalAlpha = 1; fcx.globalCompositeOperation = "source-over";
    }
    // Paik's line — the loss collapse, and now and then in the idle
    var lineK = 0, dotK = 0;
    if (ph === "collapse") lineK = clamp01((pel - ex.lineAt) / ex.lineRise);
    if (ph === "burst") lineK = 1 - clamp01(pel / ex.lineFall);
    if (ph === "idle") {
      if (idle.lineAt < 0 && t > idle.nextLine) { idle.lineAt = t; idle.lineMode = Ridle.next() < 0.5 ? 1 : 0; idle.lineHold = 0.6 + Ridle.next() * 1.6; }
      if (idle.lineAt >= 0) {
        var le = (t - idle.lineAt) / 1000, H = idle.lineHold;
        if (le < 0.15) lineK = le / 0.15;
        else if (le < 0.15 + H) lineK = 1;
        else if (idle.lineMode === 1 && le < 0.15 + H + 0.35) { lineK = 1 - (le - 0.15 - H) / 0.35; dotK = 1; }   // shrinks to a dot
        else if (le < 0.15 + H + 0.6) { lineK = 0; dotK = idle.lineMode === 1 ? 1 - (le - 0.15 - H - 0.35) / 0.25 : 0; }
        else { idle.lineAt = -1; idle.nextLine = t + 12000 + Ridle.next() * 18000; }
        if (lineK > 0 || dotK > 0) { fcx.fillStyle = "rgba(3,5,3,0.9)"; fcx.fillRect(0, 0, TW, TH); }   // the raster is gone while the line is up
      }
    }
    if (lineK > 0) {
      var lw = TW * (dotK > 0 ? lineK : 1) * 0.94, lx = (TW - lw) / 2, ly = TH / 2 + Math.sin(t / 60) * 0.4;
      fcx.globalCompositeOperation = "lighter";
      if (hasFilter) fcx.filter = "blur(6px)";
      fcx.fillStyle = "rgba(120,240,150," + (0.55 * (dotK > 0 ? 1 : lineK) * B.idle).toFixed(2) + ")"; fcx.fillRect(lx, ly - (hasFilter ? 5 : 3), lw, hasFilter ? 10 : 6);
      if (hasFilter) fcx.filter = "none";
      fcx.fillStyle = "rgba(225,255,230," + (0.95 * (dotK > 0 ? 1 : lineK)).toFixed(2) + ")"; fcx.fillRect(lx, ly - 1, lw, 2);
      fcx.globalCompositeOperation = "source-over";
    } else if (dotK > 0) {
      fcx.globalCompositeOperation = "lighter";
      if (hasFilter) fcx.filter = "blur(4px)";
      fcx.fillStyle = "rgba(160,255,190," + (0.8 * dotK).toFixed(2) + ")"; fcx.beginPath(); fcx.arc(TW / 2, TH / 2, 5, 0, 7); fcx.fill();
      if (hasFilter) fcx.filter = "none";
      fcx.fillStyle = "rgba(240,255,245," + dotK.toFixed(2) + ")"; fcx.beginPath(); fcx.arc(TW / 2, TH / 2, 1.6, 0, 7); fcx.fill();
      fcx.globalCompositeOperation = "source-over";
    }
    // idle retrace — the scope's sweep, echoed in green, slower
    if (ph === "idle" && lineK === 0) {
      var sw = (t / 1000 * 22) % (TH + 40) - 20;
      fcx.fillStyle = "rgba(90,220,120," + (0.045 * B.idle).toFixed(3) + ")"; fcx.fillRect(0, sw, TW, 3);
    }
  }

  // ---- compose through the crack ----
  function compose() {
    tcx.clearRect(0, 0, TW, TH);
    tcx.fillStyle = "#030503"; tcx.fillRect(0, 0, TW, TH);
    var lit = S.phase === "idle" ? 0.08 : S.phase === "dead" ? 0.02 : 0.3 + S.strength * 0.7;
    if (S.phase === "idle" || S.phase === "dead") lit = Math.max(lit, sweepNow() * 0.5);   // 掃引: the lamp stirs under the hand
    for (var i = 0; i < P.shards.length; i++) {
      var s = P.shards[i];
      tcx.save(); tcx.clip(shardPaths[i]);
      tcx.globalAlpha = s.a;
      // the shard slips a little more when the picture is bright (refraction reads on light)
      tcx.drawImage(frame, s.dx * (0.6 + lit * 0.6), s.dy * (0.6 + lit * 0.6), TW, TH);
      tcx.restore();
    }
    // the phosphor bleeds along the fracture — a refraction edge that carries the picture's light
    tcx.globalCompositeOperation = "lighter";
    tcx.lineWidth = 2.4; tcx.strokeStyle = "rgba(150,255,180," + (0.02 + lit * 0.3).toFixed(2) + ")"; tcx.stroke(crackPath);
    tcx.lineWidth = 0.8; tcx.strokeStyle = "rgba(230,255,235," + (0.01 + lit * 0.34).toFixed(2) + ")"; tcx.stroke(crackPath);
    tcx.globalCompositeOperation = "source-over";
    // the chip: no phosphor there at all
    tcx.fillStyle = "#040605"; tcx.fill(chipPath);
  }

  // ==========================================================================
  // the loop — its own rAF (the scope owns zankyo-viz.js's); half rate on
  // low-power devices; nothing drawn while hidden (the audio does not care)
  // ==========================================================================
  var lowPower = (navigator.hardwareConcurrency || 4) <= 2, frameN = 0, running = false;
  var perf = { n: 0, ms: 0, worst: 0, first: 0, last: 0 };    // frame cost + rate telemetry for the bench
  // ONE FRAME: the five passes and the crack, timed on the REAL clock (a
  // frozen bench's virtual clock would time every frame at zero).
  function render(t) {
    var t1 = realNow();
    sourcePass(t); geometryPass(t); ghostPass(t); tubePass(t); composite(t); compose();
    var c = realNow() - t1; if (!perf.n) perf.first = t; perf.last = t; perf.n++; perf.ms += c; if (c > perf.worst) perf.worst = c;
  }
  var loopOn = false;
  function loop() {
    if (vclock != null) { loopOn = false; return; }          // frozen: the bench steps the frames (_dev.step)
    var t = now();
    frameN++;
    tickSignal(t);
    if (TW > 8 && (!lowPower || frameN % 2 === 0) && document.visibilityState === "visible") render(t);
    requestAnimationFrame(loop);
  }
  function kick() { if (!loopOn && running) { loopOn = true; requestAnimationFrame(loop); } }
  function start() {
    if (running) return; running = true;
    buildCrackSVG(); resize();
    if (window.ResizeObserver) { try { new ResizeObserver(function () { resize(); }).observe(tube); } catch (e) { window.addEventListener("resize", resize); } }
    else window.addEventListener("resize", resize);
    kick();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start, start); else start();
  // a safety net if the fonts promise never settles (offline font CDN)
  setTimeout(start, 2500);

  // ---- the 選局 control: real hardware in S0 (its pointer steps), wired to the engine in S2 ----
  if (tuneBtn) tuneBtn.addEventListener("click", function () {
    if (Z.tune) { try { Z.tune(); } catch (e) {} }
    stepTunePointer();
  });

  // ---- a signal arrives (S2: the engine's rx events carry the descriptor) ----
  function signal(desc) {
    if (!desc || !(desc.t0 >= 0)) return false;
    if (desc.picture === false) return false;                   // sound only (a descriptor without a picture)
    var a = sigTime();
    if (sig && phaseOf(a)[0] !== "idle") return false;        // never two at once
    var c = Z.getAudioContext && Z.getAudioContext();
    sig = { t0: +desc.t0, holdS: Math.max(1, +desc.holdS || 10), lossD: Math.max(0.5, +desc.lossD || 2.2), drops: (desc.drops || []).slice(), id: desc.id || null, title: desc.title || "", year: desc.year || "", video: desc.video || null, wall: !c };
    sig.rx = desc.rx || planOne(sig.holdS, sig.lossD);
    sig.drops.sort(function (p, q) { return p[0] - q[0]; });
    S.seed = (desc.seed != null ? +desc.seed : Ridle.next() * 1000); S.drop = 0; S.holdFrame = 0; S.strength = 0;
    // 映り: this reception's character, on its own fork (§5.2). A fork is
    // derived from the master's ORIGINAL seed and consumes nothing from it.
    S.ch = ZP.drawCharacter(master.fork("set:rx:" + S.seed), { force: force, desc: desc });
    return true;
  }
  if (Z.setEventListener) { try { Z.setEventListener(function (ev) { if (ev && ev.cat === "rx" && ev.signal) signal(ev.signal); }); } catch (e) {} }   // 受信 and ♪ 受信 both carry a descriptor

  // ---- 輝度 BRIGHT: the ledge's left rocker. The plastic is wired in
  //      zankyo-ui.js (one hand for both rockers); what a step MEANS is here,
  //      with the shader that answers it. ----
  var briSteps = document.getElementById("zankyo-bri-steps");
  var briRead = document.getElementById("zankyo-bri-read");
  if (briSteps && !briSteps.children.length) {
    briSteps.innerHTML = "<i class='zk-step'></i><i class='zk-step'></i><i class='zk-step'></i><i class='zk-step'></i>";
  }
  function setBright(v) {
    briV = v < 0 ? 0 : v > 3 ? 3 : v | 0;
    B = BRI[briV];
    if (briSteps) for (var bi = 0; bi < 4; bi++) if (briSteps.children[bi]) briSteps.children[bi].classList.toggle("on", bi <= briV);
    if (briRead) briRead.textContent = "輝度 " + (briV + 1) + " / 4";
    return briV;
  }
  setBright(briV);

  // ---- public surface ----
  window.ZankyoSet = {
    signal: signal,
    setBright: setBright,
    getBright: function () { return briV; },
    brightSteps: BRI.length,
    sweep: sweep,                                            // 掃引 (plan §7): the tuning dial's snow, 0..1, follows the hand
    warm: function (v) { try { scx.drawImage(v, 0, 0, SW, SH); } catch (e) {} },   // S3: a first drawImage off-screen at prefetch (the decoder's first frame stalled ~250 ms)
    getState: function () { return { phase: S.phase, strength: S.strength, pattern: patternIdx, patternName: P.name, seed: seed, tube: [TW, TH], fps: perf.n > 1 ? +((perf.n - 1) * 1000 / Math.max(1, perf.last - perf.first)).toFixed(1) : 0, frameMs: perf.n ? +(perf.ms / perf.n).toFixed(2) : 0, worstMs: +perf.worst.toFixed(2), lowPower: lowPower, hasFilter: hasFilter }; },
    _dev: {
      // the bench: run the gesture on the test card, mockup timings, seeded
      // dropouts of the mockup's density (≈ 0.36/s, 0.12–0.37 s each)
      tune: function (opts) {
        opts = opts || {};
        var a = atime(), holdS = opts.holdS != null ? +opts.holdS : 8 + rnd() * 4, lossD = opts.lossD != null ? +opts.lossD : 1.6 + rnd() * 1.2;
        var drops = [], td = a + 0.4;
        while (td < a + 0.4 + holdS) { td += 1.2 + rnd() * 3.2; if (td < a + 0.4 + holdS) drops.push([td, 0.12 + rnd() * 0.25]); }
        return signal({ t0: a + (opts.delayS || 0.1), holdS: holdS, lossD: lossD, drops: drops, seed: rnd() * 1000, id: "bench" });
      },
      patterns: PATTERNS.map(function (p) { return p.name; }),
      setPattern: function (i) { P = PATTERNS[((i % PATTERNS.length) + PATTERNS.length) % PATTERNS.length]; patternIdx = PATTERNS.indexOf(P); buildCrackSVG(); if (TW > 8) buildPaths(); },
      resetPerf: function () { perf.n = 0; perf.ms = 0; perf.worst = 0; perf.first = perf.last = 0; },
      idle: idle,
      // ---- 映り the picture bench (PLAN-SIGNAL-PICTURE §6.2) ----
      // the current reception's character (a copy — editing it changes nothing)
      character: function () { return JSON.parse(JSON.stringify(S.ch)); },
      // override the draw for the NEXT reception: { axes } merged over the
      // draw; { archetype } / { impairment } are refused by name until P1/P2
      // give the draw something to force. null clears. Returns {ok, why?}.
      force: function (f) {
        var r = ZP.checkForce(f);
        if (r.ok) force = f || null;
        return r;
      },
      // Math.random texture → a seeded stream (n), or back (null). Dev only.
      seedTexture: function (n) { rnd = (n == null) ? Math.random : ZP.textureRng(+n); return n == null ? null : +n; },
      // THE FRAME-STEP. freeze(ms) stops the rAF loop from drawing and pins
      // the clock (the signal clock included); step(ms) advances it to ms and
      // runs exactly the frame the loop would (tick, five passes, crack —
      // ignoring the low-power half rate and visibility); thaw() hands the
      // tube back to the page's clock and rAF.
      freeze: function (ms) { vclock = ms != null ? +ms : realNow(); return vclock; },
      step: function (ms) {
        if (vclock == null) vclock = realNow();
        if (ms != null) vclock = +ms;
        var t = now();
        frameN++; tickSignal(t);
        if (TW > 8) render(t);
        return { t: t, phase: S.phase, strength: S.strength };
      },
      thaw: function () { vclock = null; kick(); },
      clock: function () { return now(); },
      signalClock: function () { return atime(); },          // the clock a descriptor's t0 is in (s)
      frozen: function () { return vclock != null; },
      // the buffers, for the probe's metrics (read-only by convention)
      buffers: function () { return { SW: SW, SH: SH, luma: luma, map: mapA, phos: phos, frame: frame, tube: tcv, ghosts: ghosts.slice(), geo: { roll: G.roll, sy: G.sy } }; },
    },
  };
})();

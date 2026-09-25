// ============================================================================
// ZANKYŌ — zk-set.js: 隣 THE SECOND SET (映像管 MSHI CRT-9 · 受信専用)
//
// The station's second, older, receive-only tube, bolted to the right of the
// scope (S0 of PLAN-SIGNAL-INTEGRATION.md; the look is mockup 1,
// mockups/monitor-1-second-set.html, ported faithfully). This module owns
// ONLY the picture: a 192×144 source → P39 long-persistence phosphor → a
// full-resolution frame with real persistence, bloom, line tearing, vertical-
// hold roll, multipath ghosts, snow, Paik's line — composed through a
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
// five ordered passes: 1 source (luma, the echoes, drive, wash, snow — all at
// 192×144), 2 geometry (the roll, the squash, the raster's swell, and the
// line-accurate offset map, applied while copying rows at 192×144), 3 ghosts
// (the echo list — applied inside pass 1, in the signal), 4 the tube (the P39
// ramp), 5 the full-resolution composite (one raster draw), then the crack.
// P0 held rc.91's look, pixel for pixel; P1 draws a character per reception
// and per piece (zk-picture.js), and the crack is lit by the picture itself;
// P2 adds ten kinds — in the signal (混 the other station, 滲 the IF), at
// the detector (飽, 縞, 点), on the tube (帯) and in the offset map (横 旗 揺
// 捩) — and the frame memory 混 draws its other picture from (§5.4); P3
// draws the lock-in, each glimpse, the loss and what the collapse shows, and
// 焼 the burn-in, all inside the receiver's windows (phaseOf is untouched).
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
  // 焼 (P3): does tonight's tube burn? One draw on the set's own fork — like
  // the crack, a property of the set for the night (§3.4 "on some nights";
  // P4's "set:tube" ages the rest of the tube)
  var burnNight = master.fork("set:burn").next() < ZP.BURN.nightP;

  // ==========================================================================
  // THE CRACK — point data in a 400×300 space. Four patterns, one per night.
  // Each: the impact P0 (with its star of hairlines), the fractures (the first
  // four are the deep ones — a run to an edge and its branches — the rest are
  // dead-end hairlines), a corner chip where the phosphor is gone, and four
  // shards that tile the rectangle, each with its own slip. Pattern A is the
  // designer's, verbatim; B–D follow its grammar.
  // ==========================================================================
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

  // ==========================================================================
  // 縁 THE CRACK'S RENDERING — the owner's pick (2026-09-24, mockups/
  // crack-1-options.html): option C's two edges for the glass, and option D's
  // idea that the light IN the break is the picture's own light — with the
  // owner's correction that a dark tube shows NO green along the crack at all
  // (D's color-dodge layer glowed faintly green over the dark tube and the
  // sheen; "that ruins it"). So:
  //   · the SVG (this function) is C, ported: every fracture wanders at small
  //     scale, runs in stretches of its own weight, the dead-end hairlines die
  //     out toward their tips; each stretch is a shadowed far edge, a dark gap
  //     and a near edge that catches the room's light in some stretches and not
  //     others; the blow is a frosted crush with spall flakes knocked out.
  //   · the room's light off the glass is NEUTRAL (a cool white, G never above
  //     B): the green on this set comes from the phosphor and nowhere else.
  //     C's strokes were a faint green-white; the owner's rule makes them grey.
  //   · the light from the picture is not in the SVG at all — compose() lifts
  //     it off the composed picture along the same wandered paths (below).
  // The pattern data above is untouched; the wander is a LOCAL seeded hash
  // (the mockup's own seeds, so A and D look exactly as the owner approved
  // them), not an engine stream and not a fork — "set:crack" still makes the
  // night's one draw, and nothing else.
  // ==========================================================================
  function ptsToPath(pl) { return "M" + pl.map(function (p) { return (+p[0]).toFixed(1) + " " + (+p[1]).toFixed(1); }).join(" L"); }
  function crng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // the wander a real fracture has at small scale: every segment subdivided at
  // ~4 units, pushed sideways by two slow sines and a little grit; the
  // pattern's own vertices stay exactly where they are. Returns the points and,
  // per segment, its interior points (the shards' edges borrow them).
  function wander(pl, seed) {
    var R = crng(seed), out = [pl[0]], segs = [], ph1 = R() * 6.3, ph2 = R() * 6.3, s = 0;
    for (var i = 1; i < pl.length; i++) {
      var p = pl[i - 1], q = pl[i], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy), n = Math.max(1, Math.round(L / 4));
      var nx = -dy / L, ny = dx / L, mid = [];
      for (var k = 1; k <= n; k++) {
        var t = k / n; s += L / n;
        var off = (k === n) ? 0 : (0.9 * Math.sin(s / 7 + ph1) + 0.5 * Math.sin(s / 2.3 + ph2) + (R() - 0.5) * 0.9);
        var pt = k === n ? q : [p[0] + dx * t + nx * off, p[1] + dy * t + ny * off];
        out.push(pt); if (k < n) mid.push(pt);
      }
      segs.push(mid);
    }
    return { pts: out, segs: segs };
  }
  // split a polyline into runs of n points, each with its own weight
  function runs(pl, n) { var o = []; for (var i = 0; i < pl.length - 1; i += n) o.push(pl.slice(i, Math.min(pl.length, i + n + 1))); return o; }
  var WP = null;                                             // the night's wandered cracks (per pattern)
  function wandered() {
    if (WP && WP.P === P) return WP;
    WP = { P: P, cracks: P.cracks.map(function (pl, i) { return wander(pl, 101 + i * 17); }) };
    // each break in runs of three points, each run with its own weight w
    // (tip × swell) and its own catch of the room's light: the SVG's edges AND
    // the canvas's light are drawn from this one list (critic P1 r1 item 2 —
    // the light agrees with the edges in weight, not only in position), so a
    // dead-end hairline's light dies out toward its tip with its edges
    WP.runs = P.cracks.map(function (pl, i) {
      var R = crng(900 + i), deep = i < 4, rs = runs(WP.cracks[i].pts, 3);
      return rs.map(function (seg, k) {
        var u = k / Math.max(1, rs.length - 1);
        var tip = deep ? 1 : Math.max(0.08, 1 - u * 0.95);        // hairlines die out
        var w = tip * (0.7 + 0.5 * R()), lit = R();               // no two runs the same weight (the mockup's draw order: swell, then lit)
        return { pts: seg, w: w, lit: lit, deep: deep };
      });
    });
    // the shards' edges follow the same wander: every shard edge that is a
    // crack segment (either way round; the pattern's border points sit at
    // −2/402 on the crack and 0/400 on the shard) takes that segment's points
    var key = function (p) { return Math.max(0, Math.min(400, p[0])) + "," + Math.max(0, Math.min(300, p[1])); };
    var edge = {};
    P.cracks.forEach(function (pl, i) {
      for (var j = 1; j < pl.length; j++) {
        var mid = WP.cracks[i].segs[j - 1];
        edge[key(pl[j - 1]) + "|" + key(pl[j])] = mid;
        edge[key(pl[j]) + "|" + key(pl[j - 1])] = mid.slice().reverse();
      }
    });
    WP.shards = P.shards.map(function (sh) {
      var out = [], pl = sh.poly;
      for (var j = 0; j < pl.length; j++) {
        var a = pl[j], b = pl[(j + 1) % pl.length];
        out.push(a);
        var mid = edge[key(a) + "|" + key(b)];
        if (mid) for (var m = 0; m < mid.length; m++) out.push(mid[m]);
      }
      return out;
    });
    return WP;
  }
  // the room's light off the glass: neutral, never green (the owner's rule)
  var GLASS_LIT = "236,240,242", GLASS_FROST = "226,230,232", GLASS_RIM = "128,132,134";
  function buildCrackSVG() {
    if (!crackSvg) return;
    var W = wandered(), NS = ' vector-effect="non-scaling-stroke"';
    // no chip (owner, 2026-09-24): the glass is cracked but all four corners
    // are there — a missing corner "ruins the effect", a tube does not break
    // like that. P.chip stays in the pattern data, drawn nowhere.
    var html =
      '<defs><radialGradient id="zk-ck-frost"><stop offset="0" stop-color="rgba(' + GLASS_FROST + ',0.55)"/><stop offset="0.6" stop-color="rgba(' + GLASS_FROST + ',0.18)"/><stop offset="1" stop-color="rgba(' + GLASS_FROST + ',0)"/></radialGradient>' +
      '<filter id="zk-ck-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="0.7"/></filter></defs>';
    // 縁 each break, run by run: its shadowed far edge (soft, offset), the
    // dark gap, and the near edge catching the light — a different amount on
    // every run, and dying out along a dead-end hairline
    W.runs.forEach(function (rs) {
      rs.forEach(function (run) {
        var w = run.w, lit = run.lit, d = ptsToPath(run.pts);
        html += '<path d="' + d + '" fill="none" stroke="rgba(0,0,0,' + (0.5 * Math.min(1, w + 0.2)).toFixed(2) + ')" stroke-width="' + (1.3 * w + 0.4).toFixed(2) + '"' + NS + ' transform="translate(0.55 0.6)" filter="url(#zk-ck-soft)"/>';
        html += '<path d="' + d + '" fill="none" stroke="rgba(0,0,0,' + (0.6 * Math.min(1, w + 0.2)).toFixed(2) + ')" stroke-width="' + (0.7 * w + 0.25).toFixed(2) + '"' + NS + '/>';
        html += '<path d="' + d + '" fill="none" stroke="rgba(' + GLASS_LIT + ',' + ((0.08 + 0.38 * lit * lit) * w).toFixed(2) + ')" stroke-width="0.5"' + NS + ' transform="translate(-0.5 -0.45)"/>';
      });
    });
    // the crushed spot at each blow: a frosted core, spall flakes knocked out
    // of the surface, and the radial hairlines, wandering and dying out
    var strength = 0.85;
    P.stars.forEach(function (s, si) {
      var R = crng(55 + si), big = s[2] >= 7;
      html += '<circle cx="' + s[0] + '" cy="' + s[1] + '" r="' + (big ? 4.5 : 3) + '" fill="url(#zk-ck-frost)" opacity="' + strength + '"/>';
      for (var k = 0, n = big ? 7 : 4; k < n; k++) {
        var a = R() * 6.3, r = 3 + R() * (big ? 7 : 4), sz = 1.2 + R() * 2.2, pts = [];
        for (var j = 0; j < 3 + (R() < 0.5 ? 1 : 0); j++) { var b = a + j * 2.1 + R() * 0.6; pts.push([s[0] + Math.cos(a) * r + Math.cos(b) * sz, s[1] + Math.sin(a) * r + Math.sin(b) * sz]); }
        html += '<path d="' + ptsToPath(pts) + ' Z" fill="rgba(' + GLASS_FROST + ',' + ((0.08 + R() * 0.1) * strength).toFixed(3) + ')" stroke="rgba(0,0,0,' + (0.5 * strength).toFixed(3) + ')" stroke-width="0.5"' + NS + '/>';
      }
      for (var i = 0; i < s[2]; i++) {
        var a2 = -0.4 + i * (6.5 / s[2]), r0 = 2 + (i % 3), r1 = 7 + ((i * 5) % 9) + R() * 5;
        var line = wander([[s[0] + Math.cos(a2) * r0, s[1] + Math.sin(a2) * r0], [s[0] + Math.cos(a2 + 0.1) * r1, s[1] + Math.sin(a2 + 0.1) * r1]], 300 + i + si * 20).pts;
        html += '<path d="' + ptsToPath(line) + '" fill="none" stroke="rgba(0,0,0,' + (0.5 * strength).toFixed(3) + ')" stroke-width="0.6"' + NS + '/>';
        html += '<path d="' + ptsToPath(line.slice(0, Math.ceil(line.length / 2) + 1)) + '" fill="none" stroke="rgba(' + GLASS_LIT + ',' + (0.35 * strength).toFixed(3) + ')" stroke-width="0.5"' + NS + ' transform="translate(-0.5 -0.4)"/>';
      }
    });
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
  var scx = src.getContext("2d", { willReadFrequently: true }), srcCx = scx;
  var phos = document.createElement("canvas"); phos.width = SW; phos.height = SH; var pcx = phos.getContext("2d");
  var pimg = pcx.createImageData(SW, SH), pdata = pimg.data;
  var frame = document.createElement("canvas"), fcx = frame.getContext("2d");
  var tcx = tcv.getContext("2d");
  var hasFilter = (typeof fcx.filter === "string") && !(DEV && DEV.noFilter);   // canvas filters (the bloom); older Safari lacks them (ZK_SET_DEV.noFilter: the bench takes that path in Chrome)
  var blurCv = null, bcx = null;                          // the no-filter bloom: a 24×18 pre-shrunk copy, upscaled smooth
  if (!hasFilter) { blurCv = document.createElement("canvas"); blurCv.width = 24; blurCv.height = 18; bcx = blurCv.getContext("2d"); }
  var TW = 0, TH = 0, dpr = 1;

  // P39 ramp — long-persistence yellow-green; gamma 1.3 keeps the mid-tones
  // dark. The tube's constants live in zk-picture.js (ZP.TUBE); the tables are
  // built there.
  // 管 (P4, §3.4) THE NIGHT'S TUBE: the same set every night, aged
  // differently — gamma, a tint that stays inside the green family (owner
  // §11.1), persistence, focus, keystone, pincushion, tilt and on some nights a
  // tired dim band — one draw on the set's own fork "set:tube", like the
  // crack. ZK_SET_DEV.tube "base" (or _dev.tube("base")) is rc.104's tube.
  // G2L: a green → the least luma this ramp lights it at (the afterglow's
  // way back down the ramp, P3)
  var TB = null, LUT = null, G2L = new Uint8Array(256);
  function setTube(tb) {
    TB = tb; LUT = ZP.tubeLUT(TB);
    for (var g = 0, l = 0; g < 256; g++) { while (l < 255 && LUT.G[l] < g) l++; G2L[g] = l; }
    return TB;
  }
  var nightTube = ZP.drawTube(master.fork("set:tube"));
  setTube(DEV && DEV.tube === "base" ? ZP.drawTube(null) : nightTube);
  // the frame's working buffers, all at source resolution (§5.1, P1: the
  // ghosts and the offset map moved here from the full-resolution composite,
  // so their cost no longer grows with how many lines differ): the picture's
  // luma (Lsrc), the same with its echoes (Lgh), the driven and snowed luma
  // bytes (luma), the same after the per-line offsets (lumaG), and the map —
  // ONE map now: the roll's wrapped copy is the same scan lines, drawn from
  // the same raster
  var Lsrc = new Float32Array(SW * SH), Lgh = new Float32Array(SW * SH);
  var luma = new Uint8Array(SW * SH), lumaG = new Uint8Array(SW * SH);
  var map = new Float32Array(SH), mapLive = false;
  var ghosts = [];
  // 光 THE CRACK'S LIGHT (compose): a mask of the wandered cracks and a
  // scratch canvas, at the tube's CSS size
  var glowCv = document.createElement("canvas"), gcx = glowCv.getContext("2d");
  var maskCv = document.createElement("canvas"), mcx = maskCv.getContext("2d");
  var glow2Cv = document.createElement("canvas"), g2cx = glow2Cv.getContext("2d");   // the picture once, at CSS size (one read of the full-resolution tube per frame, not three)
  var GLOW = { k: 0.65, wide: 3.2, wideA: 0.45, core: 1.1, on: true, flat: false };

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
  // the canvas's crack and shards come from the SAME wandered points as the
  // SVG's, so the glass's edges and the light in them line up
  function buildPaths() {
    var sx = TW / 400, sy = TH / 300, W = wandered();
    function poly(pts, close) { var p = new Path2D(); pts.forEach(function (pt, i) { if (i) p.lineTo(pt[0] * sx, pt[1] * sy); else p.moveTo(pt[0] * sx, pt[1] * sy); }); if (close) p.closePath(); return p; }
    shardPaths = W.shards.map(function (pl) { return poly(pl, true); });
    chipPath = poly(P.chip, true);
    crackPath = new Path2D(); W.cracks.forEach(function (c) { c.pts.forEach(function (pt, i) { if (i) crackPath.lineTo(pt[0] * sx, pt[1] * sy); else crackPath.moveTo(pt[0] * sx, pt[1] * sy); }); });
    // the glow's mask: a soft body and a bright core along every fracture,
    // RUN BY RUN at the run's weight w (critic P1 r1 item 2). rc.P1 stroked
    // the whole crackPath at one width and one alpha, so over a bright picture
    // every dead-end hairline stayed lit, round-capped, to its very end after
    // its SVG edges had faded: a drawn neon line. The approved D lit each run
    // at width 1.2·w + 0.4 and alpha 0.55·w; here the body is GLOW.wide·w at
    // GLOW.wideA·w and the core GLOW.core·w at w (so a deep run, w ≈ 1, is
    // rc.P1's 3.2 px at 0.45 and 1.1 px at 1, and a hairline's last run,
    // w ≈ 0.06–0.1, is a tenth of that in width and alpha both). Butt caps:
    // round caps overlap at every joint of two runs and bead the light.
    glowCv.width = glow2Cv.width = maskCv.width = Math.max(1, Math.ceil(TW)); glowCv.height = glow2Cv.height = maskCv.height = Math.max(1, Math.ceil(TH));
    mcx.clearRect(0, 0, maskCv.width, maskCv.height); mcx.lineCap = "butt"; mcx.lineJoin = "round";
    if (GLOW.flat) {                                          // the bench's proof: rc.P1's one-weight mask, put back
      mcx.lineCap = "round";
      mcx.strokeStyle = "rgba(255,255,255," + GLOW.wideA + ")"; mcx.lineWidth = GLOW.wide; mcx.stroke(crackPath);
      mcx.strokeStyle = "#fff"; mcx.lineWidth = GLOW.core; mcx.stroke(crackPath);
      return;
    }
    W.runs.forEach(function (rs) {
      rs.forEach(function (run) {
        var p = poly(run.pts, false), w = run.w;
        mcx.strokeStyle = "rgba(255,255,255," + Math.min(1, GLOW.wideA * w).toFixed(3) + ")"; mcx.lineWidth = GLOW.wide * w; mcx.stroke(p);
        mcx.strokeStyle = "rgba(255,255,255," + Math.min(1, w).toFixed(3) + ")"; mcx.lineWidth = GLOW.core * w; mcx.stroke(p);
      });
    });
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
  var S = { phase: "idle", phaseAt: 0, strength: 0, seed: 0, drop: 0, holdFrame: 0, roll: 0, rollV: 0, ch: null,
            piece: 0, dropIdx: -1, dropKind: null, shear: null, tears: [], lastT: 0, swell: 0,
            env: null, lull: 0, hlock: null,
            // P2: the reception's clock (s since t0: 点's bursts and 横's losses
            // run on it), the source's mean level last frame, 飽's AGC (its
            // lagged level and this frame's gain) and a negative flash's end
            re: 0, meanL: 0, agcM: 0, agcG: 1, negUntil: 0,
            // P3: this frame's lock-in (the AGC's entry gain, a leading echo
            // and the direct path's level), the exit's blank and negative
            // flags, and the reception's burn depth
            entGain: 1, entA: 0, entD: 0, entDirect: 1, entLevel: 1, entSnow: 0, blank: false, negX: false, burnK: 0,
            // P4: the very rare takeover's progress (0..1; held through the
            // loss, reset by a new station)
            take: 0 };
  // 映り THE CHARACTER (§4). A reception's look, drawn when it arrives on its
  // own fork of the master seed ("set:rx:<desc.seed>" — desc.seed is already
  // the receiver's draw, so the same night gives the same characters and no
  // engine stream is touched); a 戻 relock or a 走 swap is a new station, so
  // each later piece draws its own ("set:rx:<desc.seed>:<piece>", §4.2). The
  // idle and dead tube keep the resting one (今).
  var force = null;                                          // the bench's override (_dev.force)
  var sigDesc = null;
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
  // Returns [phase, seconds into it, the piece it belongs to].
  //
  // FIXED AT P1 (critic P0 r1, coder P0 open item 1): a 断 piece OCCUPIES
  // onS + holeS (the receiver's planTimes, zk-broadcast.js:346-347 — its
  // holes are inside the piece and on air). rc.91 tested only onS, so the last
  // holeS seconds of every 断 piece showed as LOSS — the tear ramping, the lamp
  // flickering — while the audio was still on air, and a hole in that tail was
  // never drawn as a hole.
  function phaseOf(a) {
    if (!sig) return ["idle", 0, 0];
    var P = sig.rx, e = a - sig.t0;
    if (e < 0) return ["idle", 0, 0];
    if (sig.cutE != null && e >= sig.cutE) e = P.spanS + (e - sig.cutE);   // (QF) STOPped: straight to the collapse (cut())
    if (e < P.entryS) return [P.entry === "tan" ? "hunting" : P.entry === "fu" ? "drifting" : "tuning", e, 0];
    var segs = P.segments, gaps = P.gaps;
    for (var i = 0; i < segs.length; i++) {
      if (i > 0) {
        var g = gaps[i - 1];
        if (e < g.atS + g.durS) return [g.sweep ? "sweeping" : "lost", e - g.atS, i - 1];   // 走's dial sweep, or 戻's dead carrier
      }
      if (e < segs[i].atS) return ["relock", e - segs[i].lockAtS, i];
      if (e < segs[i].atS + segs[i].onS + (segs[i].holeS || 0)) return ["hold", e - segs[i].atS, i];
    }
    var last = segs.length - 1;
    if (e < P.spanS) return ["loss", e - P.lossAtS, last];
    e -= P.spanS; if (e < COLLAPSE_S) return ["collapse", e, last];
    e -= COLLAPSE_S; if (e < BURST_S) return ["burst", e, last];
    e -= BURST_S; if (e < DEAD_S) return ["dead", e, last];
    return ["over", e, last];
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
    sig = null; sigDesc = null;                              // the receiver owns the element; the set never pauses it
    S.roll = 0; S.rollV = 0; S.drop = 0; S.holdFrame = 0; S.strength = 0; S.ch = restCh;
    S.piece = 0; S.dropIdx = -1; S.dropKind = null; S.shear = null; S.tears.length = 0; S.swell = 0;
    S.burnK = 0; S.blank = false; S.negX = false; S.entGain = 1; S.entA = 0; S.entDirect = 1;
    idle.nextCard = t + 6000 + Ridle.next() * 10000; idle.nextLine = t + 8000 + Ridle.next() * 12000;
    enterPhase("idle", t);
  }
  // 切 STOP MID-RECEPTION (QF, 2026-09-25). The receiver's stop() pauses the
  // reel and cuts its sound, but nothing told the set, so the tube walked the
  // dead plan to its end on the audio clock — a frozen frame held for up to
  // ~25 s after STOP — and, still "on air", refused the next reception's
  // descriptor (never two at once), so the first press after PLAY sounded
  // with no picture of its own. Measured on rc.F1, seed 3042: STOP at 9.5 s,
  // the tube in hold to 21.7 s and idle at 35.1 s; the press at 17.1 s
  // refused. Now STOP is the set losing its signal: the plan jumps to its
  // collapse, burst and dead (the character's own exit, rc.91's lengths),
  // and a reception that has not come up yet is simply dropped. The
  // receiver's timings are untouched; this only runs when the station stops.
  function cut() {
    if (!sig) return false;
    var e = sigTime() - sig.t0;
    if (e < 0) { endSignal(now()); return true; }
    if (e >= sig.rx.spanS || sig.cutE != null) return false;   // already in its exit
    sig.cutE = e;
    return true;
  }
  // which dropout of the plan is on at audio time a (its index), or −1
  function dropAt(a) {
    var d = sig && sig.drops;
    if (!d) return -1;
    for (var i = 0; i < d.length; i++) { if (a >= d[i][0] && a < d[i][0] + d[i][1]) return i; if (d[i][0] > a) break; }
    return -1;
  }
  // a new piece is a new station (§4.2): its own character, its own tears
  function newPiece(pc) {
    S.piece = pc;
    if (pc > 0) S.ch = ZP.drawCharacter(master.fork("set:rx:" + S.seed + ":" + pc), { force: force, desc: sigDesc, piece: pc, burnNight: burnNight });
    S.tears.length = 0; S.shear = null; S.dropIdx = -1; S.dropKind = null;
    S.agcM = 0; S.negUntil = 0;                              // a new station: the AGC catches it afresh
    S.take = 0;
  }
  var ENV1 = { snow: 1, ghost: 1, tear: 1, wash: 1, swell: 1, imp: 1, herr: 1, hum: 1, xt: 1, skew: 1, flag: 1, jit: 1, wave: 1, agc: 1 };
  S.env = ENV1;
  var WALK = {};                                             // (P3) 浮's walked-down levels, this frame
  var LV = {};                                               // (P3) the lock-in's / a glimpse's levels, this frame (ZP.lockLevels)
  // per-frame strength, weather and the character's levels, from the audio clock
  function tickSignal(t) {
    var a = sigTime(), pe = phaseOf(a), ph = pe[0], el = pe[1];
    S.re = sig ? a - sig.t0 : 0;
    var dtS = S.lastT ? Math.max(0, Math.min(0.25, (t - S.lastT) / 1000)) : 1 / 30; S.lastT = t;
    if (ph === "over") { endSignal(t); return; }
    if ((ph === "relock" || ph === "hold") && pe[2] !== S.piece) newPiece(pe[2]);
    if (ph !== S.phase) enterPhase(ph, t);
    var ch = S.ch, TP = ZP.TEAR_PHASE, tearRate = 0, tearMin = 0;
    S.env = ENV1; S.lull = 0; S.shear = null;
    S.entGain = 1; S.entA = 0; S.entDirect = 1; S.entLevel = 1; S.entSnow = 0; S.blank = false; S.negX = false;
    var xm = ZP.exitMode(ch);                                  // (P3) the loss this character ends in
    if (ph === "tuning") {
      S.strength = clamp01(el / TUNE_S) * 0.85;
      tearRate = TP.rate * 0.6; tearMin = TP.jump;
    } else if (ph === "hunting") {
      // 探 THE HUNT: the dial hunting through the snow. The picture resolves for
      // a glimpse at each of the times the plan drew and loses again — the
      // vertical hold slipping every time it nearly catches. The glimpses are
      // not on-air time and the audio is only a syllable, so the tube is the
      // instrument that sells this one.
      // (P3, §3.5) EACH GLIMPSE DRAWS ITS OWN: glimpse i takes the
      // character's slot i — a roll kick of its own size and sense, bars that
      // nearly straighten, an echo that nearly gives way, or a soft rise with
      // no kick; 今 (no slots) is rc.91's glimpse exactly
      var gl = sig.rx.glimpses, str = 0, GLs = ch.glimpses, gtear = 1;
      if (gl) for (var gi = 0; gi < gl.length; gi++) {
        var gk = (el - gl[gi][0]) / gl[gi][1];
        if (gk >= 0 && gk < 1) {
          var GV = ZP.glimpseLevels(GLs ? GLs[gi % GLs.length] : null, gk, el - gl[gi][0], LV);
          if (GV.str >= str) {
            str = GV.str; gtear = GV.tear;
            if (GV.shS || GV.shC) S.shear = { c: GV.shC, s: GV.shS };
            S.entA = GV.eA; S.entD = GV.eD; S.entDirect = GV.direct;
          }
          S.rollV += GV.kick;
        }
      }
      S.strength = str;
      tearRate = TP.rate * 0.5 * clamp01(1 - str) * gtear;
    } else if (ph === "drifting") {
      // 浮 THE DRIFT-IN: no snap at all. The signal surfaces from under the
      // static, condensing out of snow over the whole entry.
      var dk = clamp01(el / Math.max(0.01, sig.rx.entryS));
      S.strength = 0.85 * dk * dk;
      tearRate = TP.rate * 0.4 * (1 - dk);
      // (P3, §3.5) its impairments WALK DOWN as it drifts in: every kind at
      // × walk at the start of the drift, × 1 at the lock (ZP.walkAt; the
      // character's own levels, envelopes aside — the hold's take over at the lock)
      var wkk = ZP.walkAt(ch.entry, dk);
      if (wkk !== 1) { for (var ek in ENV1) WALK[ek] = ek === "swell" || ek === "agc" ? 1 : wkk; S.env = WALK; }
      // THE DRIFT'S TEAR (r2, critic P3 r1 item 2a — decided): rc.91's term
      // above is the weak carrier's (the sync pulses sinking into the noise,
      // gone by the lock). The walk now adds the character's own 裂 — its
      // sync's impulses — by the walk's EXCESS: own rate × (walk − 1), the
      // drawn (walk − 1) at the drift's start and 0 at the lock. So a tired
      // set's drift-in tears up to (walk − 1)× its own rate over the search
      // term, and the tear walks down with the other geometry. Not own × walk outright (which would hand
      // the hold its rate continuously at the lock): that adds own × 1 to
      // EVERY drift, 今's and a walk-1 drift's included, and those are rc.91's
      // drift exactly and must stay so — the walk-off control is what proves
      // the walk (item 2b). The step to the hold's rate at the lock is rc.91's.
      tearRate += (ch.tear.rate || 0) * (S.env.tear - 1);
    } else if (ph === "lost" || ph === "sweeping") {
      // 戻 / 走: the carrier is GONE. Snow, the last frame ghosting away, the
      // hold rolling. A sweep rolls harder — the dial is moving.
      S.strength = 0;
      if (rnd() < (ph === "sweeping" ? 0.5 : 0.18)) S.rollV += (rnd() - 0.35) * (ph === "sweeping" ? 4 : 2);
    } else if (ph === "relock") {
      // FIXED AT P1 (§1.10, §5.5): the ramp reads THIS piece's lockS. rc.91
      // read segments[0].lockS, which is always 0, so every relock took the
      // 0.2 s fallback (the receiver's MOD_RELOCK_S is also 0.2, so today the
      // two agree; they would not if the receiver's relock ever moved).
      S.strength = clamp01(el / Math.max(0.05, sig.rx.segments[pe[2]].lockS || 0.2)) * 0.85;
      tearRate = TP.rate * 0.6; tearMin = TP.jump;
    } else if (ph === "hold") {
      // THE HOLD, per the character (§4.2): each impairment on its own
      // envelope, the conditions easing now and then (the lull: §11.2, the
      // picture always comes up), the drawn breath, and what each dropout DOES.
      // THE LULL (§11.2), REWRITTEN AT r2 (critic P1 r1 item 1). rc.P1's lull
      // pinned the carrier flat at 0.85 and eased every impairment by 70–88 %:
      // a clearing. Now it is a SURFACING TO A LEVEL. In a good moment of the
      // fading the carrier comes up BY LULL.lift (× the lull's height, in L;
      // capped at liftCap) with its breath still moving under it, and each
      // impairment eases only as far as its TARGET — the snow's spark density
      // to pT, the fog's lost contrast (or crush) to wT, the echoes' summed
      // amplitude to gT, the sync's tear rate to tT — so whatever buried the
      // reception, a lull brings it up to about the same place: a face
      // through a veil of snow, not a clean picture. An impairment already
      // under its target is not touched (a lightly buried reception barely
      // changes), and the most buried eases the most.
      var L = ZP.lullAt(ch.lull, el), E = ch.env || {}, LL = ZP.LULL;
      var eS = ZP.envAt(E["雪"], el), eG = ZP.envAt(E["影"], el), eT = ZP.envAt(E["裂"], el), eW = ZP.envAt(E["霞"], el);
      S.lull = L;
      // 伸 has no envelope (critic P1 r1 recommendation, taken at r2): its
      // cause is the beam current, so the picture's own level through the lag
      // is its only driver — with E["伸"] on top, the raster breathed on a
      // still picture. E["伸"] is still drawn (the fork is consumed alike).
      var br = ZP.breath(ch.breath, el, S.seed);
      // (P4, §5.3) the carrier fades with the sound: at the audio LFO's rate,
      // in phase with its gain (both run from t0), a few points of strength
      if (ch.fade) br += ch.fade.a * Math.sin(6.2832 * ch.fade.hz * S.re);
      if (L > 0) {
        br = Math.min(br + LL.lift * L, Math.max(br, LL.liftCap));
        var lv = 1 - clamp01(br), sn0 = ch.snow, wa0 = ch.wash || { lift: 0, gain: 1 }, gsum = 0;
        for (var gq = 0; gq < ch.ghosts.length; gq++) gsum += Math.abs(ch.ghosts[gq].a);
        var toT = function (v, T) { return v > T ? 1 - L * (1 - T / v) : 1; };   // the factor that brings v to T at the lull's top
        eS *= toT((lv * lv * (sn0.sq || 0) + lv * (sn0.lin || 0)) * (sn0.gain || 0) * eS, LL.pT);
        eW *= toT((Math.abs(1 - wa0.gain) + Math.max(0, wa0.lift) / 100) * eW, LL.wT);
        eG *= toT(gsum * eG, LL.gT);
        eT *= toT((ch.tear.rate || 0) * eT, LL.tT);
      }
      // P2's kinds on their own envelopes, eased the same way in a lull (each
      // to its own target, zk-picture.js LULL); 横 is knocked down like a
      // dropout (sync holds better in a good moment); 飽's excess gain eases
      // toward agT; 滲 is the tuner's and has no envelope
      var eI = ZP.envAt(E["点"], el), eH = ZP.envAt(E["縞"], el), eB = ZP.envAt(E["帯"], el), eX = ZP.envAt(E["混"], el);
      var eF = ZP.envAt(E["旗"], el), eJ = ZP.envAt(E["揺"], el), eV = ZP.envAt(E["捩"], el), eK = 1, eA = 1;
      if (L > 0) {
        if (ch.impulse) eI *= toT((ch.impulse.pulsed ? ch.impulse.K : ch.impulse.dens) * eI, LL.iT);
        if (ch.herring) eH *= toT(ch.herring.amp * eH, LL.hbT);
        if (ch.hum) eB *= toT(ch.hum.depth * eB, LL.humT);
        if (ch.xtalk) eX *= toT(ch.xtalk.depth * eX, LL.xtT);
        if (ch.flag) eF *= toT(ch.flag.depth * eF, LL.flagT);
        if (ch.jitter) eJ *= toT(ch.jitter.amt * eJ, LL.jitT);
        if (ch.wave) eV *= toT(ch.wave.amp * eV, LL.waveT);
        if (ch.agc) eA *= toT(ch.agc.hot - 1, LL.agT);
        eK = 1 - LL.dropEase * L;
      }
      S.env = { snow: eS, ghost: eG, tear: eT, wash: eW, swell: 1, imp: eI, herr: eH, hum: eB, xt: eX, skew: eK, flag: eF, jit: eJ, wave: eV, agc: eA };
      // 飽: now and then the sync crushes — a brief negative picture, and the
      // line oscillator takes the knock (one hard impulse). Its rate is the
      // character's; the moment is texture. Not inside a good moment.
      if (ch.agc && ch.agc.negRate > 0 && t >= S.negUntil && rnd() < ch.agc.negRate * dtS * (1 - L)) {
        S.negUntil = t + ch.agc.negMs[0] + rnd() * (ch.agc.negMs[1] - ch.agc.negMs[0]);
        ZP.tearStep(S.tears, ch.tear.jump ? ch.tear : { rows: 12, jump: 6, rec: 0.12 }, 30, 1 / 30, t, rnd, 6);
      }
      var dr = ch.drop, di = dropAt(a), dropping = di >= 0, dd = 0;
      if (dropping) {
        var kind = dr.kinds[di % dr.kinds.length];
        if (di !== S.dropIdx) {
          // a dropout begins: what it does is the character's (drawn per
          // reception, indexed by its place in the plan); how big is texture
          S.dropIdx = di; S.dropKind = kind;
          var dur = (sig.drops[di][1] || 0.2) * 1000;
          if (kind === "snow" && rnd() < dr.holdP) S.holdFrame = t + dr.holdMs[0] + rnd() * dr.holdMs[1];   // a frame-hold rides some snow dropouts, as it always did
          else if (kind === "roll") S.rollV += (rnd() < 0.5 ? -1 : 1) * (1.4 + rnd() * 1.8) * (1 - ZP.LULL.dropEase * L);   // the vertical hold slips (less in a good moment)
          else if (kind === "tear") ZP.tearStep(S.tears, ch.tear, 30, 1 / 30, t, rnd, 8);                         // one hard impulse on the sync
          else if (kind === "hold") S.holdFrame = t + dur;                                                        // the picture freezes for the dropout
          else if (kind === "hlock") S.hlock = { c: rnd() * (ZP.SW + ZP.HBLANK), s: (rnd() < 0.5 ? -1 : 1) * (0.4 + rnd() * 1.2), v: (rnd() - 0.5) * 240 };   // horizontal lock lost: the lines shear into diagonal bars
        }
        dd = (kind === "snow" ? dr.depth : kind === "roll" ? 0.15 : kind === "tear" ? 0.2 : kind === "hold" ? 0.1 : 0.22) * (1 - ZP.LULL.dropEase * L);   // a good moment of the fading is not knocked as deep
        if (kind === "hlock" && S.hlock) { S.hlock.c += S.hlock.v * dtS; S.shear = { c: S.hlock.c, s: S.hlock.s * (1 - ZP.LULL.dropEase * L) }; }   // the lock holds better in a good moment
      } else { S.hlock = null; }
      S.drop = dropping ? 1 : 0;
      // 断 A HOLE is not a dropout: the picture tears and rolls through a real
      // loss of one to three seconds and comes back where it would be.
      var hk = inHole(a - sig.t0);
      if (hk > 0) { S.rollV += (rnd() - 0.4) * 2.2; if (rnd() < 0.25) S.holdFrame = t + 90 + rnd() * 180; }
      S.strength = clamp01(br - dd - hk * 0.75);
      // (P4, §4.3) rare: the vertical hold a hair off — the picture rolls
      // slowly and steadily through the hold, the blanking bar crossing it
      if (ch.roll) S.rollV = ch.roll.dir * ch.roll.hz * TH * dtS;
      // very rare: the other station's takeover, from `at` of this piece over
      // `dur` s (at most 45 % of the piece); it stays taken through the loss
      if (ch.take) { var onS = sig.rx.segments[pe[2]].onS || 0; S.take = clamp01((el - ch.take.at * onS) / Math.min(ch.take.dur, Math.max(1, 0.45 * onS))); }
      // the sync: the character's own impulses on their envelope, and a weak
      // carrier's (1 − strength) — rc.91's hold tear grew the same way
      tearRate = (ch.tear.rate || 0) * S.env.tear + clamp01(1 - S.strength) * 0.8 + hk * TP.rate;
      if (hk > 0) tearMin = TP.jump;
    } else if (ph === "loss") {
      // (P3, §3.5) THE LOSS, as the character's exit draws it (ZP.EXIT). The
      // window is the receiver's; only what happens inside it varies.
      var k = clamp01(el / Math.max(0.02, sig.rx.exitS)), ex = ch.exit;    // 0..1 through the loss
      if (xm === "snow") {
        // 溶: the carrier sinks smoothly into the noise — no stutter, no slip;
        // the picture's contrast goes with it and the snow comes up to the
        // tuner's own (full gain), so it dissolves rather than dims
        S.strength = 0.85 * Math.pow(1 - k, 1.3);
        S.entLevel = 1 - 0.7 * k; S.entSnow = k;
        tearRate = TP.rate * 0.3 * k;
      } else if (xm === "freeze" || xm === "burn") {
        // 凍: the station's frame store holds its last frame and the snow
        // eats it; 焼: the picture lingers, dimming, and is not torn apart
        if (xm === "freeze") S.holdFrame = Infinity;
        S.strength = xm === "freeze" ? 0.85 * Math.pow(1 - k, 1.1) : 0.85 * (1 - 0.55 * k * k);
        tearRate = TP.rate * 0.2;
      } else {
        // rc.91's loss — the stutter, the frame holds, the hold slipping —
        // under 縮 (squash) and 反 (neg) and 縦 (vline), which differ only in
        // how they end; 転 lets the vertical hold go, 裂 the horizontal
        S.strength = clamp01(0.85 * (1 - k * k) - (rnd() < k * 0.5 ? 0.4 : 0));
        if (xm !== "roll" && xm !== "bars" && rnd() < k * 0.25) S.holdFrame = t + 80 + rnd() * 160;
        if (xm === "roll") S.rollV = ex.dir * (0.3 + ex.rollH * Math.pow(k, 1.6)) * TH * dtS;   // rolling away, faster and faster
        else S.rollV += (rnd() - 0.4) * k * 3;                                               // the hold slips
        if (xm === "bars") S.shear = { c: ex.slide * el * (0.4 + k), s: ex.dir * ex.bars * (ZP.SW + ZP.HBLANK) / ZP.SH * Math.pow(k, 1.2) };
        tearRate = TP.rate * (0.5 + k * 1.5); tearMin = TP.jump;
      }
    } else if (ph === "collapse") {
      S.strength = 0.9;
      // (P3) what the collapse window shows: rc.91's squash (squash, roll —
      // still rolling — and freeze), the sideways squash (vline), all snow
      // (snow), black (bars; burn, with its afterglow in compose), or the
      // negative flash and then black (neg)
      if (xm === "snow") { S.strength = 0; S.entSnow = 1; S.entLevel = 0.3 * (1 - clamp01(el / COLLAPSE_S)); }
      else if (xm === "bars" || xm === "burn") { S.blank = true; S.strength = 1; }
      else if (xm === "neg") { if (el < ch.exit.negT) S.negX = true; else { S.blank = true; S.strength = 1; } }
      else if (xm === "roll") S.rollV = ch.exit.dir * (0.3 + ch.exit.rollH) * TH * dtS;
    } else if (ph === "burst" || ph === "dead") {
      S.strength = 0;
    }
    // 出入 THE LOCK-IN (P3, §3.5): the character's entry, over the arrival's
    // window (即's tuning, 浮's drift) or a relock's, and its settle at the
    // head of the hold — or, with no window of its own (探's catch after the
    // hunt; a 走 swap), over the head of the hold. Levels: ZP.lockLevels.
    var en = ch.entry;
    if (sig && en && en.mode !== "snap") {
      var winS = -1, lu = 1, lw = -1, lsec = 0, inWin = false;
      if (ph === "tuning" || ph === "drifting") { winS = sig.rx.entryS; inWin = true; }
      else if (ph === "relock") { winS = sig.rx.segments[pe[2]].lockS || 0; inWin = true; }
      else if (ph === "hold") winS = pe[2] > 0 ? (sig.rx.segments[pe[2]].lockS || 0) : sig.rx.entry === "tan" ? 0 : sig.rx.entryS;
      if (inWin) { lu = clamp01(el / Math.max(0.01, winS)); lsec = el; }
      else if (ph === "hold") {
        var lt = ZP.lockTail(en, winS);
        if (el < lt) { if (winS < 0.05) lu = el / lt; else lw = el / lt; lsec = Math.max(0, winS) + el; }
        else winS = -1;
      }
      if (winS >= 0) {
        var LK = ZP.lockLevels(en, lu, lw, lsec, winS, LV);
        if (LK.sSet) { if (inWin) S.strength = 0.85 * LK.sK; else S.strength *= LK.sK; S.entLevel = LK.level; S.entSnow = LK.snowUp; }
        if (LK.rollH !== 0) {
          if (LK.rollH === LK.rollH) S.rollV = LK.rollH * TH * dtS;
          else {                                               // the hold catches: slide into place the way it was rolling
            var rr0 = ((S.roll % TH) + TH) % TH, dist = en.dir > 0 ? TH - rr0 : rr0;
            if (rr0 < 1 || rr0 > TH - 1 || dist < 1) { S.roll = 0; S.rollV = 0; } else S.rollV = en.dir * Math.max(0.8, dist * 0.25);
          }
        }
        if (LK.shS || LK.shC) S.shear = S.shear ? { c: S.shear.c + LK.shC, s: S.shear.s + LK.shS } : { c: LK.shC, s: LK.shS };
        S.entGain = LK.gain;
        if (LK.eA > 0) { S.entA = LK.eA; S.entD = LK.eD; }
        S.entDirect = LK.direct;
        tearRate *= LK.tear;
      }
    }
    if (tearRate > 0) ZP.tearStep(S.tears, ph === "hold" ? ch.tear : { rows: TP.rows, jump: ch.tear.jump || TP.jump, rec: TP.rec }, tearRate, dtS, t, rnd, tearMin);
    // 飽 THE AGC, while there is a carrier: it follows the picture's level
    // (last frame's source mean) with lag tau, so the gain runs high for a
    // moment when a station (it starts wide open: agcM from 0.55 × the level)
    // or a brighter scene arrives, and settles; `hot` is the overload, eased
    // in a lull; the pump rides on it (P4 locks its rate to the audio's LFO)
    if (ch.agc && CARRIER_PH[ph]) {
      var ag = ch.agc, m = Math.max(1, S.meanL);
      if (!(S.agcM > 0)) { if (!S.meanOk) return; S.agcM = 0.55 * m; }   // seeded from a frame of the station, never the idle tube's
      S.agcM += (m - S.agcM) * Math.min(1, dtS / ag.tau);
      var over = Math.pow(m / Math.max(1, S.agcM), 0.7); over = over < 0.7 ? 0.7 : over > 1.8 ? 1.8 : over;
      var eAg = ph === "hold" ? S.env.agc : 1;
      S.agcG = (1 + (ag.hot - 1) * eAg) * over * (1 + ag.pumpD * Math.sin(6.2832 * ag.pumpHz * (ag.lock ? S.re : t / 1000) + ag.ph));   // (P4) a locked pump runs on the reception's clock, with the sound's swell
    }
  }

  // ==========================================================================
  // THE SOURCE PICTURE (192×144 greyscale): the reel, the test card, the idle
  // ==========================================================================
  var idle = { nextCard: now() + 6000 + Ridle.next() * 8000, cardAt: -1, nextLine: now() + 9000 + Ridle.next() * 10000, lineAt: -1, lineMode: 0, lineHold: 1 };
  function drawTestCard(alpha, drift, cx) {
    // an MSHI test card: circle, crosshair, greyscale steps, the yard's mark
    // (cx: another 192×144 context — 混's card, P2 — or the source's)
    var scx = cx || srcCx;
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
  // the test card, or the idle raster — then, in the order a signal meets
  // them: luma; 影 the echoes (PASS 3's list, applied HERE because a multipath
  // echo is in the transmitted signal, before the receiver adds its noise — a
  // ghost of the snow would be a ghost of nothing); the beam's drive, 霞 and
  // 雪 into the luma bytes.
  var CARRIER_PH = { tuning: 1, hold: 1, loss: 1, collapse: 1, hunting: 1, drifting: 1, relock: 1 };
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
      if (S.blank) { scx.fillStyle = "#000"; scx.fillRect(0, 0, SW, SH); }   // (P3) an exit that goes to black
      else if (t < S.holdFrame) { /* frame hold: keep the last picture */ }
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
    var sdata = scx.getImageData(0, 0, SW, SH).data, n = SW * SH, ch = S.ch, env = S.env || ENV1;
    S.meanL = ZP.lumaPass(sdata, Lsrc, n); S.meanOk = !!CARRIER_PH[ph];
    // 憶 THE FRAME MEMORY (§5.4): every tenth hold frame of a reel, the clean
    // picture is kept; when the next reception arrives it becomes the memory
    // 混 draws its other station from (and P3's burn-in, later)
    if (ph === "hold" && sig && sig.video && t >= S.holdFrame && frameN % 10 === 0) { memNext.set(Lsrc); memNextOk = true; }
    if (ph === "idle" || ph === "dead") {
      // 掃引: on an idle or dead tube the snow is the dial's
      ZP.sourcePass(Lsrc, luma, n, ph, sweepNow(), B, restCh.snow, null, 1, rnd);
      ghosts.length = 0;
      return;
    }
    // PASS 3's list, applied in the signal
    ZP.ghostList(ch, ph, S.strength, t, env.ghost, ghosts, S.re);
    // (P3) a ghost-first lock-in's (or glimpse's) leading echo, and the
    // direct path still coming up under it
    if (S.entA > 0) ghosts.push({ d: S.entD, a: S.entA });
    ZP.ghostPass(Lsrc, Lgh, SW, SH, ghosts, S.entDirect);
    // P2, while there is a carrier. 混: the other station arrives with ours,
    // at the antenna; 滲: the IF (and a mistuned tuner) shapes both
    // (`hold`: the phases whose levels come from S.env — the hold's
    // envelopes and lull, and since P3 浮's walk-down; every other phase's
    // S.env is ENV1)
    var ck = CARRIER_PH[ph] ? 1 : 0, ts = t / 1000, hold = ph === "hold" || ph === "drifting";
    xtLive = false;
    // (P4) the takeover's other station is absent until it begins, then
    // comes by S.take, whatever the phase (it stays through the loss)
    if (ck && ch.xtalk && ch.take) { if (S.take > 0) { ZP.xtalkPass(Lgh, xtImage(ch.xtalk.src), ch.xtalk, ts, 1, XT, S.take); xtLive = true; } }
    else if (ck && ch.xtalk && env.xt > 0) { ZP.xtalkPass(Lgh, xtImage(ch.xtalk.src), ch.xtalk, ts, hold ? env.xt : 1, XT); xtLive = true; }
    if (ck && ch.smear) ZP.smearPass(Lgh, ch.smear);
    var X = SRCX; X.ag = null; X.hb = null; X.hum = null;
    if (ck && ch.agc) { AG.g = S.agcG * S.entGain; AG.blk = ch.agc.blk * (hold ? env.agc : 1); AG.neg = t < S.negUntil || S.negX; X.ag = AG; }
    else if (ck && (S.entGain !== 1 || S.negX)) { AG.g = S.entGain; AG.blk = 0; AG.neg = S.negX; X.ag = AG; }   // (P3) any set's AGC on a bloom lock-in; the neg exit's crushed sync
    if (ck && ch.herring && env.herr > 0) X.hb = ZP.herringRows(ch.herring, ts, hold ? env.herr : 1, HB);
    if (ck && ch.hum && env.hum > 0) { ZP.humRows(ch.hum, ch.hum.lock ? S.re : ts, hold ? env.hum : 1, HUM.g, HUM.a); X.hum = HUM; }   // (P4) a locked hum on the reception's clock
    // 雪: the snow level is the carrier's weakness; this frame's multiplier is
    // the envelope and the flicker (texture). The burst is all snow.
    var level = ph === "burst" ? 1 : clamp01(1 - S.strength);
    var sn = ch.snow, fl = (hold ? env.snow : 1) * (1 + (sn.flicker || 0) * (rnd() * 2 - 1));
    // (P3) WITH NO CARRIER THE SNOW IS THE TUNER'S, at full gain: the burst,
    // a 戻 gap's dead carrier, a 走 sweep — and, as far as the carrier is
    // weak, the arrival (tuning, the hunt between its glimpses, the drift), a
    // relock, the loss and the collapse. The station's own snow (its gain,
    // drawn with its character) is the HOLD's. FIXED AT P3: since P1 all of
    // these drew the station's gain, so on a clean station (清: 0.26–0.4 of
    // rc.91's density) the burst was a sprinkle and the hunt showed the
    // picture plainly between its glimpses. Plus a fade-in's or the
    // dissolve's own (S.entSnow).
    var snowUp = (ph === "burst" || ph === "lost" || ph === "sweeping") ? 1 : ph === "hold" ? S.entSnow : Math.max(S.entSnow, clamp01(1 - S.strength / 0.85));
    if (snowUp > 0) fl *= 1 + (Math.max(1, 1 / Math.max(0.3, sn.gain || 1)) - 1) * snowUp;
    // 霞: only while there is a carrier to be veiled (never on the burst's or a lost gap's pure noise)
    var wk = CARRIER_PH[ph] ? (hold ? env.wash : 1) : 0, wa = ch.wash || { lift: 0, gain: 1 };
    WASH.lift = wa.lift * wk; WASH.gain = (1 + (wa.gain - 1) * wk) * S.entLevel;   // (P3) × a fade-in's weak picture
    ZP.sourcePass(Lgh, luma, n, "lit", level, B, sn, WASH, fl, rnd, X);
    // 点: the sparks, over the snow, on the reception's own burst schedule
    if (ck && ch.impulse) ZP.impulsePass(luma, ch.impulse, S.re, hold ? env.imp : 1, rnd);
  }
  var WASH = { lift: 0, gain: 1 };
  // 焼 the burn exit's afterglow: the phosphor's last image (192×144), and its level this frame.
  // ON THE RAMP (r2, critic P3 r1 item 1; §11.1 "always green, never white"):
  // r1 kept the last lit frame as the P39 RGBA and added it at alpha aftA, and
  // the ramp's near-white top (222,255,226) scaled by α is R ≈ G ≈ B — a grey
  // (DESAT 7–86 % over the collapse, burst and dead against the squash's
  // ≤ 6.7 %). A phosphor giving less light sits further DOWN THE SAME CURVE:
  // the image is kept as the phosphor's GREEN (aftG — exactly what the tube
  // showed, the burn-in's wear and all), and each frame green × aftA is
  // taken back through the ramp (G2L: a green → the least luma the LUT lights
  // it at) to the ramp's own colour at that green, into aftCv. The glow keeps
  // r1's light (its green, frame by frame, is r1's) and loses r1's grey.
  // DECIDED against the critic's literal "luma × aftA through the LUT": the
  // ramp is steep (gamma 1.3 over stops that sit dark until 0.45), so luma ×
  // 0.125 lands at ~1/4 of r1's green — the dead tube's afterglow, the whole
  // point of 残's burn, went under the burst's persistence (meanG on the dead
  // tube read the squash's to ±1). The ramp's black floor LUT(0) = (2,6,3) is
  // taken off what is added (added every frame on a dead tube it would lift
  // the whole black glass to the floor's colour); the lookup is offset by it,
  // so the green ADDED is green × aftA.
  var aftCv = document.createElement("canvas"); aftCv.width = SW; aftCv.height = SH;
  var acx = aftCv.getContext("2d"), aftOk = false, aftA = 0;
  var aftG = new Uint8Array(SW * SH), aftImg = acx.createImageData(SW, SH), aftData = aftImg.data;
  // P2's per-frame scratch: the source pass's extras, 飽's gain, 縞's row
  // phases, 帯's row gain and offset, 混's other picture as placed
  var SRCX = { ag: null, hb: null, hum: null }, AG = { g: 1, blk: 0, neg: false };
  var HB = { amp: 0, dp: 0, ph0: new Float32Array(SH) }, HUM = { g: new Float32Array(SH), a: new Float32Array(SH) };
  var XT = new Float32Array(SW * SH), xtLive = false;
  // the memory (§5.4): the last reception's picture, or — before there was
  // one — the test card, a station's slide (drawn once, lazily)
  var mem = new Float32Array(SW * SH), memOk = false, memNext = new Float32Array(SW * SH), memNextOk = false, cardL = null;
  function xtImage(which) {
    if (which === "mem" && memOk) return mem;
    if (!cardL) {
      var cc = document.createElement("canvas"); cc.width = SW; cc.height = SH;
      var cx = cc.getContext("2d", { willReadFrequently: true });
      cx.fillStyle = "#000"; cx.fillRect(0, 0, SW, SH); drawTestCard(0.9, 0, cx);
      cardL = new Float32Array(SW * SH); ZP.lumaPass(cx.getImageData(0, 0, SW, SH).data, cardL, SW * SH);
    }
    return cardL;
  }

  // PASS 2 — GEOMETRY. The vertical hold's roll, the collapse's squash, 伸
  // the raster's breathing, and the per-line offset map (§3.2): line-accurate
  // now, filled from the tear's events and a lost horizontal lock, and applied
  // at source resolution while copying rows (zk-picture.js geometryCopy). ONE
  // map: rc.91 tore the roll's wrapped copy with a second, independent draw;
  // they are the same scan lines, and now they are drawn from the same raster.
  // A dead tube draws nothing but its persistence, so it has no geometry.
  var G = { roll: 0, sy: 1, sx: 1, dyBase: 0, pel: 0, sc: 1 };
  function geometryPass(t) {
    var ph = S.phase;
    mapLive = false;
    if (ph === "dead") return;
    // vertical hold
    if (ph !== "idle" || S.rollV !== 0) {
      S.roll += S.rollV; S.rollV *= (ph === "loss" ? 0.985 : 0.9);
      if (Math.abs(S.rollV) < 0.05) S.rollV = 0;
      S.roll = ((S.roll % TH) + TH) % TH; if (S.rollV === 0 && ph !== "loss") S.roll += (0 - S.roll) * 0.2;
    }
    var roll = S.roll | 0, sy = 1, sx = 1, ch = S.ch;
    var pel = (t - S.phaseAt) / 1000;                          // seconds into the phase, for the shapes below
    // the collapse: rc.91's squash to a line across — or (P3) sideways, to a
    // line down the middle (vline), or none at all (the exits that end in
    // snow or black)
    if (ph === "collapse") {
      var ck = clamp01(pel / COLLAPSE_S), sq = Math.max(0.01, 1 - Math.pow(ck, ch.exit.squash)), xmg = ZP.exitMode(ch);
      if (xmg === "vline") sx = sq; else if (ZP.EXIT.line[xmg]) sy = sq;
    }
    // 伸: the raster swells with the beam current (the frame's mean level),
    // lagged by the supply's regulation
    var sw = ch.swell, target = 0;
    if (ph !== "idle" && sw && sw.amt > 0) {
      var lsum = 0; for (var i = 0; i < SW * SH; i += 7) lsum += luma[i];
      target = sw.amt * (ph === "hold" ? S.env.swell : 1) * (lsum / Math.ceil(SW * SH / 7) / 255);
    }
    var lagK = sw && sw.lag > 0 ? Math.min(1, (1 / 30) / sw.lag) : 1;
    S.swell += (target - S.swell) * lagK;
    mapLive = ph !== "idle" && ZP.lineMap(map, S.tears, t, S.shear);
    // P2: 旗 捩 揺 横, while there is a carrier (lineMap has cleared the map).
    // (r2, critic P3 r1 item 2) the drift's walked levels too: r1 handed the
    // map ENV1 outside the hold, so 浮's walk-down never reached the offset-map
    // kinds and a 同 drift-in (all its primaries are geometry) did not walk
    // down at all. S.env is ENV1 in every other carrier phase, so only the
    // drift moves — and a walk-1 drift (S.env stays ENV1) not at all.
    if (CARRIER_PH[ph] && ZP.geoMap(map, ch, S.re, t / 1000, ph === "hold" || ph === "drifting" ? S.env : ENV1, rnd)) mapLive = true;
    if (mapLive) ZP.geometryCopy(luma, lumaG, map, SW, SH);
    G.roll = roll; G.sy = sy; G.sx = sx; G.pel = pel; G.sc = 1 + S.swell; G.dyBase = (TH - TH * sy * G.sc) / 2;
  }

  // PASS 4 — THE TUBE: luma → the P39 ramp → the phosphor canvas, with the
  // idle raster's warm glow added under nothing (after the LUT, as rc.91 did).
  function tubePass(t) {
    var idleGlow = S.phase === "idle" ? (9 + 3 * Math.sin(t / 2300)) * B.idle : 0;
    // 焼 (P3): a burned tube's imprint, on every lit frame of the reception,
    // at the GLASS position each source row and column lands on this frame
    // (after the roll — and its wrapped copy — the squash and the swell,
    // exactly as composite() will draw them), so it holds still while the
    // picture rolls and squashes over it
    var burn = null;
    if (S.burnK > 0 && sig && S.phase !== "idle" && S.phase !== "dead" && TH > 8) {
      var rs = G.sy * G.sc, hS = TH * rs, w = TW * G.sc * G.sx, x0 = (TW - w) / 2, y;
      for (y = 0; y < SH; y++) {
        var ys = G.dyBase + G.roll * rs + (y + 0.5) * hS / SH;
        if (G.roll && ys >= TH) ys -= TH * rs;                  // the wrapped copy's row
        var br = Math.floor(ys * SH / TH); burnRow[y] = br >= 0 && br < SH ? br : -1;
      }
      for (var x = 0; x < SW; x++) { var bc = Math.floor((x0 + (x + 0.5) * w / SW) * SW / TW); burnCol[x] = bc >= 0 && bc < SW ? bc : -1; }
      burn = burnImg;
    }
    // (P4, §3.4) the night's raster shape — keystone and pincushion, on the
    // glass row each line lands on after the roll
    var lsrc = mapLive ? lumaG : luma;
    if (TB.trap || TB.pin) { ZP.keystone(lsrc, lumaK, TB, TH > 8 ? G.roll * SH / TH : 0); lsrc = lumaK; }
    ZP.tubePass(lsrc, pdata, SW, SH, LUT, idleGlow, B.idle, t / 240, burn, burnRow, burnCol);
    pcx.putImageData(pimg, 0, 0);
  }
  var burnImg = new Uint8Array(SW * SH), burnRow = new Int16Array(SH), burnCol = new Int16Array(SW), lumaK = new Uint8Array(SW * SH);

  // ==========================================================================
  // PASS 5 — THE FRAME (full resolution): persistence, bloom, the raster (one
  // draw — the offsets and the echoes are already in it), the blanking bar,
  // the line. Then compose() puts it through the crack.
  // ==========================================================================
  function drawBloom(x0, w, dy, h, alpha, blurPx) {
    fcx.globalAlpha = Math.min(0.92, alpha * B.bloom);        // 輝度: how hard the phosphor is driven
    if (hasFilter) {
      fcx.filter = "blur(" + Math.max(0.5, blurPx + B.blur * 2.7).toFixed(1) + "px)";
      fcx.drawImage(phos, x0, dy, w, h);
      fcx.filter = "none";
    } else {
      bcx.imageSmoothingEnabled = true; bcx.clearRect(0, 0, 24, 18); bcx.drawImage(phos, 0, 0, 24, 18);
      fcx.imageSmoothingEnabled = true; fcx.drawImage(blurCv, x0, dy, w, h); fcx.imageSmoothingEnabled = false;
    }
    fcx.globalAlpha = 1;
  }
  function composite(t) {
    var ph = S.phase, strength = S.strength, D = TB.decay, ex = S.ch.exit;
    fcx.globalCompositeOperation = "source-over";
    // persistence: the old frame decays under the new one (P39)
    var decay = ph === "idle" ? D.idle : ph === "dead" ? D.dead : ph === "burst" ? D.burst : D.lit;
    fcx.fillStyle = "rgba(3,5,3," + decay + ")"; fcx.fillRect(0, 0, TW, TH);
    // 焼 THE AFTERGLOW (P3, the burn exit — 残 only): while the picture
    // lingers the phosphor keeps its image (aftCv, the last lit frame of the
    // hold or the loss's first half); once the carrier goes, that image stays
    // on the long-persistence screen, decaying from glowA over glowTau s,
    // through the collapse, under the burst's snow and on the dead tube
    // (drawn over the raster — drawAfterglow, below — so the burst's snow
    // lies on it rather than hiding it)
    var xmc = ZP.exitMode(S.ch);
    aftA = 0;
    if (xmc === "burn" && sig && (ph === "hold" || (ph === "loss" && S.strength > 0.6))) { for (var ap = 0, an = SW * SH; ap < an; ap++) aftG[ap] = pdata[(ap << 2) + 1]; aftOk = true; }
    // A dead tube shows its decay — and, FAINTLY, the dial's sweep snow while a
    // hand is on the dial (§11.5 / §9 Q7, the owner's default: "a dead tube
    // that answers the dial hand is more alive"). rc.91 computed it and never
    // drew it. Nothing is added when no hand is moving.
    if (ph === "dead") {
      drawAfterglow(t, ph, xmc, ex);
      var swd = sweepNow();
      if (swd > 0.02) {
        fcx.imageSmoothingEnabled = false; fcx.globalCompositeOperation = "lighter"; fcx.globalAlpha = Math.min(0.4, swd * 0.5);
        fcx.drawImage(phos, 0, 0, TW, TH);
        fcx.globalAlpha = 1; fcx.globalCompositeOperation = "source-over";
      }
      return;
    }

    fcx.imageSmoothingEnabled = false;
    var roll = G.roll, sy = G.sy, pel = G.pel, dyBase = G.dyBase, sc = G.sc;
    var w = TW * sc * G.sx, x0 = (TW - w) / 2, h = TH * sy * sc, rs = sy * sc;
    // (P4, §3.4) the night's yoke: the raster turned a fraction of a degree,
    // overscanned just enough that its corners stay off the glass; and the
    // beam's focus — the tube's, softened further by a narrow band (the
    // reception's `soft`): a soft beam blurs the sharp raster, a sharp tube
    // tightens the bloom instead
    var rot = TB.tilt ? TB.tilt * Math.PI / 180 : 0, fpx = TB.focus + (S.ch.soft || 0);
    if (rot) { var ovs = Math.cos(rot) + Math.max(TW / TH, TH / TW) * Math.abs(Math.sin(rot)); fcx.save(); fcx.translate(TW / 2, TH / 2); fcx.rotate(rot); fcx.scale(ovs, ovs); fcx.translate(-TW / 2, -TH / 2); }

    // bloom under, sharp over
    fcx.globalCompositeOperation = "lighter";
    var ba = ph === "idle" ? 0.35 : 0.22 + strength * 0.14, bb = 3 + strength * 2;
    if (fpx < 0) { ba *= 1 + 0.3 * fpx; bb += 2 * fpx; }
    drawBloom(x0, w, dyBase + roll * rs, h, ba, bb);
    if (roll) drawBloom(x0, w, dyBase + (roll - TH) * rs, h, ba, bb);
    fcx.globalCompositeOperation = "source-over";
    var soft = hasFilter && fpx > 0.15;
    if (soft) fcx.filter = "blur(" + fpx.toFixed(2) + "px)";
    fcx.drawImage(phos, x0, dyBase + roll * rs, w, h);
    if (roll) fcx.drawImage(phos, x0, dyBase + (roll - TH) * rs, w, h);
    if (soft) fcx.filter = "none";
    if (roll) { fcx.fillStyle = "rgba(0,0,0,0.75)"; fcx.fillRect(0, dyBase + roll * rs - 6, TW, 7); }   // the blanking bar
    if (rot) fcx.restore();
    // (P4) a tired capacitor: a dim band across the glass at a fixed height,
    // breathing slowly (some nights)
    if (TB.dim) {
      var dm = TB.dim, dk = dm.depth * (0.7 + 0.3 * Math.sin(6.2832 * dm.hz * t / 1000 + dm.ph)), yc = dm.y * TH, hh = Math.max(1.5, dm.h * TH);
      fcx.fillStyle = "rgba(0,0,0," + dk.toFixed(3) + ")"; fcx.fillRect(0, yc - hh / 2, TW, hh);
      fcx.fillStyle = "rgba(0,0,0," + (dk * 0.45).toFixed(3) + ")"; fcx.fillRect(0, yc - hh, TW, hh / 2); fcx.fillRect(0, yc + hh / 2, TW, hh / 2);
    }
    drawAfterglow(t, ph, xmc, ex);
    // Paik's line — the loss collapse, and now and then in the idle
    var lineK = 0, dotK = 0, hasLine = !!ZP.EXIT.line[xmc], vert = xmc === "vline";   // (P3) not every exit ends in the line; vline's is down the middle
    if (ph === "collapse" && hasLine) lineK = clamp01((pel - ex.lineAt) / ex.lineRise);
    if (ph === "burst" && hasLine) lineK = 1 - clamp01(pel / ex.lineFall);
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
    if (lineK > 0 && vert) {
      // 縦 the horizontal deflection gone: the same line, stood on end
      var vh = TH * 0.94, vy = (TH - vh) / 2, vx = TW / 2 + Math.sin(t / 60) * 0.4;
      fcx.globalCompositeOperation = "lighter";
      if (hasFilter) fcx.filter = "blur(6px)";
      fcx.fillStyle = "rgba(120,240,150," + (0.55 * lineK * B.idle).toFixed(2) + ")"; fcx.fillRect(vx - (hasFilter ? 5 : 3), vy, hasFilter ? 10 : 6, vh);
      if (hasFilter) fcx.filter = "none";
      fcx.fillStyle = "rgba(225,255,230," + (0.95 * lineK).toFixed(2) + ")"; fcx.fillRect(vx - 1, vy, 2, vh);
      fcx.globalCompositeOperation = "source-over";
    } else if (lineK > 0) {
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
      var swp = (t / 1000 * 22) % (TH + 40) - 20;
      fcx.fillStyle = "rgba(90,220,120," + (0.045 * B.idle).toFixed(3) + ")"; fcx.fillRect(0, swp, TW, 3);
    }
  }

  function drawAfterglow(t, ph, xmc, ex) {
    if (xmc !== "burn" || !aftOk || !(ph === "collapse" || ph === "burst" || ph === "dead")) return;
    var since = (t - S.phaseAt) / 1000 + (ph === "burst" ? COLLAPSE_S : ph === "dead" ? COLLAPSE_S + BURST_S : 0);
    aftA = ex.glowA * Math.exp(-since / ex.glowTau);
    // over the collapse and the burst the raster is redrawn each frame and the
    // glow lies on it at aftA; the dead tube has no raster, only its slow
    // persistence (D.dead a frame), so the glow is added at that rate — added
    // at aftA every frame it piled up toward aftA / D.dead, the whole picture
    // back at full light on a dead tube
    var dd = ph === "dead" ? TB.decay.dead : 1;
    if (aftA * 255 < 1) return;                                // every pixel is below the ramp's first step: nothing is lit
    // the glow's level moves it DOWN THE RAMP (green × aftA → the ramp's
    // colour there), not toward grey (RGB × aftA)
    var R = LUT.R, Gn = LUT.G, Bl = LUT.B, r0 = R[0], g0 = Gn[0], b0 = Bl[0];
    for (var p = 0, n = SW * SH; p < n; p++) {
      var gg = ((aftG[p] * aftA) | 0) + g0, l = G2L[gg > 255 ? 255 : gg], q = p << 2;
      aftData[q] = R[l] - r0; aftData[q + 1] = Gn[l] - g0; aftData[q + 2] = Bl[l] - b0; aftData[q + 3] = 255;
    }
    acx.putImageData(aftImg, 0, 0);
    fcx.imageSmoothingEnabled = false; fcx.globalCompositeOperation = "lighter"; fcx.globalAlpha = dd;
    fcx.drawImage(aftCv, 0, 0, TW, TH);
    fcx.globalAlpha = 1; fcx.globalCompositeOperation = "source-over";
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
    // 光 THE LIGHT IN THE BREAK (the owner's pick, option D, corrected). rc.91
    // stroked the fracture in a constant green — alpha 0.02 + lit·0.3 — so it
    // glowed even on an idle tube. Now the light comes FROM THE PICTURE: the
    // composed picture, cubed (multiplied by itself twice: 8-bit values under
    // ~16/255 go to zero, so a black, idle or dead tube gives nothing, and the
    // idle raster's warm glow — ~18/255 at its brightest — rounds to zero
    // where a square would have left it a level or two), cut to the wandered
    // cracks' mask, added back. The break scatters what is behind it: dark
    // where the picture is dark, bright where it is bright, and it moves with
    // the picture.
    if (GLOW.on === "rc91") {
      tcx.globalCompositeOperation = "lighter";
      tcx.lineWidth = 2.4; tcx.strokeStyle = "rgba(150,255,180," + (0.02 + lit * 0.3).toFixed(2) + ")"; tcx.stroke(crackPath);
      tcx.lineWidth = 0.8; tcx.strokeStyle = "rgba(230,255,235," + (0.01 + lit * 0.34).toFixed(2) + ")"; tcx.stroke(crackPath);
      tcx.globalCompositeOperation = "source-over";
    } else if (GLOW.on && glowCv.width > 1) {
      var gw = glowCv.width, gh = glowCv.height, cw = tcv.width, chh = tcv.height;
      g2cx.globalCompositeOperation = "copy"; g2cx.drawImage(tcv, 0, 0, cw, chh, 0, 0, gw, gh);
      gcx.globalCompositeOperation = "copy"; gcx.drawImage(glow2Cv, 0, 0);
      gcx.globalCompositeOperation = "multiply"; gcx.drawImage(glow2Cv, 0, 0); gcx.drawImage(glow2Cv, 0, 0);
      gcx.globalCompositeOperation = "destination-in"; gcx.drawImage(maskCv, 0, 0);
      gcx.globalCompositeOperation = "source-over";
      tcx.globalCompositeOperation = "lighter"; tcx.globalAlpha = GLOW.k;
      tcx.drawImage(glowCv, 0, 0, TW, TH);
      tcx.globalAlpha = 1; tcx.globalCompositeOperation = "source-over";
    }
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
    sourcePass(t); geometryPass(t); tubePass(t); composite(t); compose();
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
    // never two at once — but a reception already in its exit (collapse,
    // burst, dead: its sound is over) gives way to the next, as a new station
    // on the dial would (QF: a press in those 2.3 s sounded with no picture)
    if (sig) { var ph0 = phaseOf(a)[0]; if (ph0 === "collapse" || ph0 === "burst" || ph0 === "dead") endSignal(now()); else if (ph0 !== "idle") return false; }
    var c = Z.getAudioContext && Z.getAudioContext();
    sig = { t0: +desc.t0, holdS: Math.max(1, +desc.holdS || 10), lossD: Math.max(0.5, +desc.lossD || 2.2), drops: (desc.drops || []).slice(), id: desc.id || null, title: desc.title || "", year: desc.year || "", video: desc.video || null, wall: !c };
    sig.rx = desc.rx || planOne(sig.holdS, sig.lossD);
    sig.drops.sort(function (p, q) { return p[0] - q[0]; });
    S.seed = (desc.seed != null ? +desc.seed : Ridle.next() * 1000); S.drop = 0; S.holdFrame = 0; S.strength = 0;
    S.piece = 0; S.dropIdx = -1; S.dropKind = null; S.shear = null; S.hlock = null; S.tears.length = 0; S.swell = 0; S.lastT = 0;
    S.agcM = 0; S.agcG = 1; S.negUntil = 0; S.re = 0; S.take = 0;
    // the last reception's picture becomes the memory (§5.4)
    if (memNextOk) { var mt = mem; mem = memNext; memNext = mt; memOk = true; memNextOk = false; }
    // 映り: this reception's character, on its own fork (§5.2). A fork is
    // derived from the master's ORIGINAL seed and consumes nothing from it.
    sigDesc = desc;
    S.ch = ZP.drawCharacter(master.fork("set:rx:" + S.seed), { force: force, desc: desc, burnNight: burnNight });
    // 焼 (P3): the imprint this reception shows is the LAST reception's
    // picture (the memory just swapped in), or on a night's first the test
    // card; it belongs to the tube, so a relock's new station keeps it
    S.burnK = ZP.burnDepth(S.ch);
    if (S.burnK > 0) ZP.burnImage(memOk ? mem : xtImage("card"), S.burnK, burnImg);
    aftOk = false;
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
    cut: cut,                                                // (QF) the station stopped: lose the signal
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
        // (P4) the sound's reads may ride along, as startSignal hands them over
        return signal({ t0: a + (opts.delayS || 0.1), holdS: holdS, lossD: lossD, drops: drops, seed: rnd() * 1000, id: "bench",
          band: opts.band, flutter: opts.flutter, grit: opts.grit, lfoHz: opts.lfoHz, d: opts.d, genPic: opts.genPic });
      },
      patterns: PATTERNS.map(function (p) { return p.name; }),
      setPattern: function (i) { P = PATTERNS[((i % PATTERNS.length) + PATTERNS.length) % PATTERNS.length]; patternIdx = PATTERNS.indexOf(P); buildCrackSVG(); if (TW > 8) buildPaths(); },
      resetPerf: function () { perf.n = 0; perf.ms = 0; perf.worst = 0; perf.first = perf.last = 0; },
      idle: idle,
      // ---- 映り the picture bench (PLAN-SIGNAL-PICTURE §6.2) ----
      // the current reception's character (a copy — editing it changes nothing)
      character: function () { return JSON.parse(JSON.stringify(S.ch)); },
      // override the draw for EVERY later reception (and piece) until
      // force(null) — critic P0 r1 item 5: it persists; the lab re-sends its
      // field on every receive. { axes } merged over the draw; { archetype }
      // (a §4.1 id, or "今"); { impairment, sev } one P1 kind alone at median
      // axes; { clean: true } the probe's reference. P2 kinds are refused by
      // name. Returns {ok, why?}.
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
      // (P4) 管 the tube: no argument returns tonight's (a copy); "base" puts
      // rc.104's tube back, a number draws the tube that seed's night gets
      // ("set:tube" off that master seed), null returns to tonight's
      tube: function (n) {
        if (n === undefined) return JSON.parse(JSON.stringify(TB));
        setTube(n === null ? nightTube : n === "base" ? ZP.drawTube(null) : ZP.drawTube(PJ.Rand.stream(+n).fork("set:tube")));
        return JSON.parse(JSON.stringify(TB));
      },
      clock: function () { return now(); },
      signalClock: function () { return atime(); },          // the clock a descriptor's t0 is in (s)
      frozen: function () { return vclock != null; },
      // the buffers, for the probe's metrics (read-only by convention)
      buffers: function () { return { SW: SW, SH: SH, luma: mapLive ? lumaG : luma, map: map, mapLive: mapLive, phos: phos, frame: frame, tube: tcv, ghosts: ghosts.slice(), geo: { roll: G.roll, sy: G.sy, sc: G.sc }, env: S.env, lull: S.lull, dropKind: S.dropKind, piece: S.piece, tears: S.tears.length, mask: maskCv, xt: xtLive ? XT : null, agcG: S.agcG, neg: S.negUntil > now() || S.negX,
        // (P3) the lock-in and the exit, this frame: the entry's AGC gain, its
        // leading echo and direct path, the shear, a frozen frame, a blanked
        // source, the sideways squash, the afterglow's level, the burn
        entGain: S.entGain, entA: S.entA, entDirect: S.entDirect, shear: S.shear ? { c: S.shear.c, s: S.shear.s } : null, rollPx: S.roll, rollV: S.rollV,
        frozen: S.holdFrame === Infinity, blank: S.blank, sx: G.sx, aftA: aftA, burnK: S.burnK, burn: S.burnK > 0 ? burnImg : null, burnNight: burnNight,
        // (P4) the takeover's progress, this frame's 帯 row gains (when on), the reception's clock
        take: S.take, hum: SRCX.hum ? HUM.g : null, re: S.re }; },
      // 光 the crack's light, last frame: the largest value the glow layer
      // added (0..255 per channel, before GLOW.k) and how many pixels it lit —
      // the probe's check that a dark tube's crack carries no light at all
      // pic: the brightest G of the picture itself under the mask (what the
      // light is lifted from), so a check can hold the glow to its source
      glow: function () {
        var d = gcx.getImageData(0, 0, glowCv.width, glowCv.height).data, q = g2cx.getImageData(0, 0, glowCv.width, glowCv.height).data, m = mcx.getImageData(0, 0, glowCv.width, glowCv.height).data;
        // PREMULTIPLIED (colour × alpha / 255): that is what 'lighter' adds.
        // getImageData un-premultiplies, and at the hairlines' faint alphas
        // (r2: the mask is run-weighted) an 8-bit colour divided by an alpha
        // of 2/255 reads as up to 255 — light that is not there.
        var mx = [0, 0, 0], lit = 0, pic = 0;
        for (var i = 0; i < d.length; i += 4) { var al = d[i + 3] / 255, r0 = d[i] * al, g0 = d[i + 1] * al, b0 = d[i + 2] * al; if (r0 > mx[0]) mx[0] = r0; if (g0 > mx[1]) mx[1] = g0; if (b0 > mx[2]) mx[2] = b0; if (g0 >= 0.5) lit++; if (m[i + 3] > 0 && q[i + 1] > pic) pic = q[i + 1]; }
        mx = mx.map(function (v) { return Math.round(v); });
        return { max: mx, lit: lit, pic: pic, k: GLOW.k, on: GLOW.on, size: [glowCv.width, glowCv.height] };
      },
      // the wandered runs in mask px (CSS px of the tube), each with its crack
      // index, its weight and whether it is a deep break — the probe measures
      // the mask along them (critic P1 r1 item 2: a hairline's light dies out)
      crackRuns: function () { var sx = TW / 400, sy = TH / 300; return wandered().runs.map(function (rs, i) { return rs.map(function (r) { return { i: i, deep: r.deep, w: +r.w.toFixed(4), pts: r.pts.map(function (p) { return [p[0] * sx, p[1] * sy]; }) }; }); }); },
      // true puts back rc.P1's one-weight mask (the whole crackPath at one
      // width and alpha) — the proof that the run-weight check can fail
      maskFlat: function (on) { GLOW.flat = !!on; if (TW > 8) buildPaths(); return GLOW.flat; },
      // the SVG's room-light colours ("r,g,b" strings; null keeps one) — the
      // probe's check that the crack's glass adds no green, and its proof that
      // the check would catch C's original green-white
      crackColors: function (lit, frost, rim) { if (lit) GLASS_LIT = lit; if (frost) GLASS_FROST = frost; if (rim) GLASS_RIM = rim; buildCrackSVG(); return [GLASS_LIT, GLASS_FROST, GLASS_RIM]; },
      // the probe's switch: true (the picture's light), false (none), or "rc91"
      // (rc.91's constant green stroke, put back so the probe can prove it would catch it)
      setGlow: function (on) { GLOW.on = on === "rc91" ? "rc91" : !!on; return GLOW.on; },
    },
  };
})();

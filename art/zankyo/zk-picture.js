// ============================================================================
// ZANKYŌ — zk-picture.js: 映り HOW A PICTURE COMES IN (PLAN-SIGNAL-PICTURE §5.1)
//
// The second set's impairment library, its character draw, and the constants
// block. zk-set.js keeps the phase machine, the canvases and the compositing;
// everything that decides what a reception LOOKS like lives here, so that a
// reception's damage can be drawn per reception (P1) instead of being the
// same nine bands and one ghost every time (the §1 audit).
//
// P0 (this file's first state): a REFACTOR ONLY. There is exactly one
// character — 今 TODAY — and it is rc.91's look, number for number: the same
// snow curve, the same nine-band tear, the same one ghost, the same breath,
// the same squash. The gate for P0 is that a frame rendered through these
// functions is PIXEL-IDENTICAL to rc.91's pipeline under seeded texture
// (_picture-probe.js identity). So every expression below that touches a
// pixel keeps rc.91's operand order exactly — `snow * snow * sq + snow * lin`,
// not a tidier `snow * (snow * sq + lin)` — because floating point is not
// algebra and the gate is byte equality. Anyone "cleaning up" an expression
// here should re-run the identity mode first.
//
// THE CONTRACT WITH THE MUSIC (§2.2). Nothing here reads or writes an engine
// stream. The character draw takes a PJ2.Rand FORK the set hands it (the
// set's own labels, "set:rx:<seed>"); texture takes whatever `rnd` the set
// passes (Math.random in production — the character contract's allowance —
// or a seeded stream on the bench). The file does no work at load beyond
// building constant tables, and it touches no DOM, so the headless harness
// and probe (which load every zk-*.js from index.php) load it harmlessly.
// ============================================================================
(function (root) {
  "use strict";

  // ==========================================================================
  // THE CONSTANTS BLOCK (§6.5). rc.91's values, named. The per-reception
  // RANGES that P1+ draw from will sit beside these; today every "axis" is a
  // single point, which is precisely the §1 complaint.
  // ==========================================================================

  // 今 TODAY — rc.91's one look, as a character. Axis names follow §3.
  var TODAY = {
    name: "今",                   // bench/commit name only — the VFD never names a character (§11.3)
    archetype: null,              // no archetype yet: P1 draws them (§4.1)
    tier: "common",
    // 雪 snow: a pixel is either the picture or a spark. Density grows with
    // the square of (1 − strength): p = snow²·sq + snow·lin; a spark keeps
    // `keep` of the picture under it and adds rnd·255·(floor + span·rnd).
    snow: { sq: 0.85, lin: 0.08, keep: 0.35, floor: 0.45, span: 0.55 },
    // the hold's breath: base + Σ amp·sin(el·rate + seed·mul). rc.91 fixed
    // it at 1.1 and 4.3 rad/s and seeded only the phase (§1.5).
    breath: { base: 0.82, parts: [[0.13, 1.1, 1], [0.05, 4.3, 2]] },
    // a dropout: strength − depth; `holdP` of them also freeze the frame for
    // holdMs[0] + rnd·holdMs[1] ms. Every dropout is the same (§1, §4.2).
    drop: { depth: 0.45, holdP: 0.3, holdMs: [100, 200] },
    // 裂 tear — nine equal bands, each shifted
    //   tearAmt · (amp·sin(t/rate + b·phase) + [rnd < tearAmt·jumpP] (rnd − ½)·jump)
    // in tube px. tearAmt per phase: tuning `tuning`; hold (1 − strength)·holdK
    // + (dropping ? holdDrop : holdRest); loss lossBase + k; anything else 0.
    tear: { bands: 9, rate: 170, phase: 1.9, amp: 3, jumpP: 0.25, jump: 26,
            tuning: 0.6, holdK: 0.8, holdDrop: 0.4, holdRest: 0.05, lossBase: 0.5 },
    // 影 ghosts — one right-shifted echo, dx + wob·sin(t/per) tube px, dy down,
    // alpha a0 + a1·(1 − strength), additive. Drawn in tuning, hold and loss.
    ghosts: [{ dx: 5, wob: 3, per: 900, dy: 1, a0: 0.16, a1: 0.14 }],
    // the exit (§3.5 "today's squash to a Paik line"): the raster squashes
    // with exponent `squash` over the collapse, the line rises lineAt s into
    // it over lineRise s, and falls over lineFall s of the burst
    exit: { squash: 1.6, lineAt: 0.22, lineRise: 0.2, lineFall: 0.12 },
  };

  // 管 THE TUBE (§3.4) — the same set every night at P0; P4 ages it per night
  // on "set:tube". Persistence is the alpha of the black laid over the last
  // frame each frame, per phase; the P39 ramp is the stops below at gamma 1.3.
  var TUBE = {
    gamma: 1.3,
    stops: [[0, 2, 6, 3], [0.2, 4, 20, 9], [0.45, 12, 72, 30], [0.7, 40, 152, 72], [0.88, 120, 226, 146], [1, 222, 255, 226]],
    decay: { idle: 0.5, dead: 0.11, burst: 0.7, lit: 0.62 },
  };

  // ==========================================================================
  // THE CHARACTER DRAW. drawCharacter(forkRng, ctx) → a character object.
  // P0 draws nothing: it returns 今 (a deep copy, so a bench `force` can never
  // mutate the constant), with ctx.force's axes merged over it. `forkRng` is
  // the set's "set:rx:<seed>" fork and is untouched at P0 — P1 is the first
  // phase to draw from it.
  //
  // ctx.force (the bench's `_dev.force`):
  //   { axes: { tear: { amp: 6 }, … } }   merge these axes over the draw
  //   { archetype: "遠" }                 P1+ — refused at P0, by name
  //   { impairment: "縞", axes }          P2+ — refused at P0, by name
  // ==========================================================================
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(dst, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) merge(dst[k], src[k]);
      else dst[k] = clone(src[k]);
    }
    return dst;
  }
  var ARCHETYPES = [];            // §4.1 — P1 fills this; P0 has only 今
  var IMPAIRMENTS = [];           // §3 kinds — P1/P2 fill this
  function checkForce(f) {
    if (!f) return { ok: true };
    if (f.archetype != null && ARCHETYPES.indexOf(f.archetype) < 0) return { ok: false, why: "no archetype '" + f.archetype + "' yet (P0 has one character, 今 today)" };
    if (f.impairment != null && IMPAIRMENTS.indexOf(f.impairment) < 0) return { ok: false, why: "no impairment '" + f.impairment + "' yet (P0 has one character, 今 today)" };
    return { ok: true };
  }
  function drawCharacter(forkRng, ctx) {
    var ch = clone(TODAY);
    var f = ctx && ctx.force;
    if (f && f.axes) merge(ch, f.axes);
    return ch;
  }

  // ==========================================================================
  // THE IMPAIRMENT LIBRARY — pure functions over the 192×144 buffers.
  // ==========================================================================

  // P39 lookup tables for a tube. Built with rc.91's exact arithmetic (the
  // Uint8Array stores truncate, as they always did).
  function tubeLUT(tube) {
    var R = new Uint8Array(256), G = new Uint8Array(256), Bl = new Uint8Array(256);
    var stops = tube.stops, gamma = tube.gamma;
    for (var i = 0; i < 256; i++) {
      var t = Math.pow(i / 255, gamma), a = stops[0], b = stops[1];
      for (var k = 1; k < stops.length; k++) { if (t <= stops[k][0]) { a = stops[k - 1]; b = stops[k]; break; } }
      var u = (t - a[0]) / (b[0] - a[0] || 1);
      R[i] = a[1] + (b[1] - a[1]) * u; G[i] = a[2] + (b[2] - a[2]) * u; Bl[i] = a[3] + (b[3] - a[3]) * u;
    }
    return { R: R, G: G, B: Bl };
  }

  // PASS 1 — SOURCE. RGBA from the source canvas → one luma byte per pixel,
  // with the drive (輝度) and the noise applied. `mode` is "idle", "dead" or
  // "lit" (every phase that carries a picture, plus the burst's pure snow);
  // `snow` is the snow level 0..1; `bri` is the 輝度 step ({lift, gain});
  // `sn` the character's snow axes. rnd is consumed in raster order, one
  // pixel at a time, exactly as rc.91 consumed it.
  function sourcePass(sdata, luma, n, mode, snow, bri, sn, rnd) {
    var sq = sn.sq, lin = sn.lin, keep = sn.keep, floor = sn.floor, span = sn.span;
    var lift = bri.lift, gain = bri.gain;
    for (var i = 0, p = 0; p < n; p++, i += 4) {
      var l = 0.299 * sdata[i] + 0.587 * sdata[i + 1] + 0.114 * sdata[i + 2];
      if (mode === "idle") {
        l = l * 0.9 + (rnd() < 0.002 ? 30 + rnd() * 50 : 0);   // thermal sparks
        if (snow > 0 && rnd() < snow * snow * sq + snow * lin) l = l * keep + rnd() * 255 * (floor + span * rnd());   // 掃引
      }
      else if (mode === "dead") { l = snow > 0 && rnd() < snow * snow * sq + snow * lin ? rnd() * 255 * (floor + span * rnd()) : 0; }
      else {
        l = (l - lift) * gain;                              // 輝度: the beam's drive
        if (snow > 0 && rnd() < snow * snow * sq + snow * lin) l = l * keep + rnd() * 255 * (floor + span * rnd());
      }
      luma[p] = l < 0 ? 0 : l > 255 ? 255 : l | 0;
    }
  }

  // PASS 4 — THE TUBE. Luma → P39 RGBA. On an idle tube a faint raster glow
  // is added AFTER the LUT (the tube is warm, not lit): a breathing level, a
  // crawl down the rows, a vignette. The glow arithmetic is rc.91's verbatim
  // (idleGlow, the 0.55 row frequency, the 0.7 and 0.6 vignettes).
  function tubePass(luma, pdata, SW, SH, lut, idleGlow, idleK, crawl) {
    var LR = lut.R, LG = lut.G, LB = lut.B;
    for (var p = 0, y = 0; y < SH; y++) {
      if (idleGlow > 0) {
        var rowGlow = idleGlow + 3.5 * idleK * Math.sin(y * 0.55 - crawl);
        var vign = 1 - Math.abs(y - SH / 2) / SH * 0.7;
        for (var x = 0; x < SW; x++, p++) {
          var l = luma[p], q = p << 2;
          var g = rowGlow * vign * (1 - Math.abs(x - SW / 2) / SW * 0.6);
          pdata[q] = LR[l] + g * 0.22; pdata[q + 1] = LG[l] + g; pdata[q + 2] = LB[l] + g * 0.42; pdata[q + 3] = 255;
        }
      } else {
        for (var x2 = 0; x2 < SW; x2++, p++) {
          var l2 = luma[p], q2 = p << 2;
          pdata[q2] = LR[l2]; pdata[q2 + 1] = LG[l2]; pdata[q2 + 2] = LB[l2]; pdata[q2 + 3] = 255;
        }
      }
    }
  }

  // PASS 2 — GEOMETRY: THE PER-LINE OFFSET MAP (§3.2). `map` is SH entries,
  // one per SOURCE row, each that row's horizontal shift in TUBE px (tube px,
  // not source px: today's tear lands at sub-source-pixel positions and the
  // identity gate needs them). `map.bands` (set by the fill) tells the
  // compositor how many slices to draw, each SH / bands rows: 9 slices of 16
  // rows for today's tear, 144 of one for a line-accurate map (P2's skew,
  // flagging, jitter, tears). Today's tear
  // fills the map band by band, drawing rnd once per band (twice when it
  // jumps), in band order — rc.91's order.
  function tearMap(map, SH, tr, tearAmt, t, rnd) {
    var nb = tr.bands, rows = SH / nb;
    for (var b = 0; b < nb; b++) {
      var off = tearAmt * (Math.sin(t / tr.rate + b * tr.phase) * tr.amp + (rnd() < tearAmt * tr.jumpP ? (rnd() - 0.5) * tr.jump : 0));
      for (var r = b * rows, r1 = r + rows; r < r1; r++) map[r] = off;
    }
    map.bands = nb;
    return map;
  }
  // how hard the picture tears, per phase (rc.91's tearAmt, from the character)
  function tearAmount(tr, ph, strength, dropping, pel, lossD) {
    return ph === "tuning" ? tr.tuning
         : ph === "hold" ? clamp01(1 - strength) * tr.holdK + (dropping ? tr.holdDrop : tr.holdRest)
         : ph === "loss" ? tr.lossBase + clamp01(pel / lossD) : 0;
  }

  // PASS 3 — GHOSTS: the echo list for this frame. Each is { dx, dy, alpha }
  // in tube px. P0 composites them at full resolution as rc.91 did (moving
  // them to 192×144 would change their sub-pixel landing and break the
  // identity gate); §5.1's cheaper source-resolution ghost is P1's, where
  // the look is allowed to move.
  function ghostList(ch, ph, strength, t, out) {
    out.length = 0;
    if (ph !== "hold" && ph !== "loss" && ph !== "tuning") return out;
    for (var i = 0; i < ch.ghosts.length; i++) {
      var g = ch.ghosts[i];
      out.push({ dx: g.dx + g.wob * Math.sin(t / g.per), dy: g.dy, alpha: g.a0 + g.a1 * (1 - strength) });
    }
    return out;
  }

  // the hold's breath (§4.2: P1 draws its partials)
  function breath(br, el, seed) {
    var v = br.base;
    for (var i = 0; i < br.parts.length; i++) { var q = br.parts[i]; v = v + q[0] * Math.sin(el * q[1] + seed * q[2]); }
    return v;
  }

  // a seeded texture stream for the bench (`_dev.seedTexture`): mulberry32.
  // NEVER used in production — texture there is Math.random, by contract.
  function textureRng(n) {
    var a = (n >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  var API = {
    TODAY: TODAY, TUBE: TUBE, ARCHETYPES: ARCHETYPES, IMPAIRMENTS: IMPAIRMENTS,
    drawCharacter: drawCharacter, checkForce: checkForce,
    tubeLUT: tubeLUT, sourcePass: sourcePass, tubePass: tubePass,
    tearMap: tearMap, tearAmount: tearAmount, ghostList: ghostList, breath: breath,
    textureRng: textureRng,
  };
  if (root) root.ZankyoPicture = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : null);

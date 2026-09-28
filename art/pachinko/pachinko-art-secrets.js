/* MOTHER LODE — the secrets' art (wave 6b; the map is EGGS.md)
 *
 * What the machine keeps to itself, drawn. Everything here is guarded: a
 * failure costs its layer for the frame, never the view. render.js calls
 * A.drawSecrets(g, view, layer) for:
 *   'under'    (albedo, before the crew's shadows) the painted moon on its
 *              nail (#2), the red fish, Fig. 12 (#4: always painted here)
 *   'albedo'   (after the shadows) the shadow of the one at the glass (#1)
 *   'glass'    (lit, before the glass's tint) the one at the glass, close up;
 *              his knuckle prints and the coal dust off them (#1); the
 *              painted train's answer (#8)
 *   'cabinet'  (the paper outside the glass) the crayon through the lit
 *              legend card (#5); the second man for scale (#7)
 *
 * THE KNOCK ON THE GLASS (EGGS.md #1). One of the crew, close up: the only
 * time any of them is seen from the front. He is the same toy as ever (the
 * turned peg-doll head, two dots of black paint for eyes set a little too
 * wide and a little too high, the peg joints, the mitten hands, the carbide
 * lamp on his cap), painted again at whatever size he is as he comes up to
 * the glass: never a scaled sprite, always whole board pixels. His lantern
 * lights him (a warm key in flat bands, no dither: a painted toy lit by one
 * lamp); the room's purple-black is the fill. His shadow grows on the rock
 * behind him. His knuckles leave prints on the inside of the glass.
 *   A.closeRig(g)          his joints in his own units (× s from his feet):
 *                          {lantern, fist, capLamp, head}
 *   A.drawCloseKnocker(g, gk)   into the glass scene (board px)
 * view.fx.glassKnock = {who, view: front|back, s, x, y (his feet), pose,
 *   lamp 0..1, fist 0|1|2|3, tilt (degrees), nod, shiver, lantern {x, y}}
 * view.fx.glassMarks = [{x, y, n, seed, t0}]; view.fx.moon = {a, x, y};
 * view.fx.fish = {t0, rel}; view.fx.train = {t0}; view.fx.cardLamp;
 * view.ui.gamesEver; view.eggs (main's switches).
 *
 * Deterministic: no Math.random, no Date.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt; if (!A) return;
  var S = A.S, P = A.PAL;
  A.liveFish = true;          // (pachinko-art-mine.js leaves Fig. 12 to us: it can be warmed)
  var D2R = Math.PI / 180;
  var OUT = [10, 8, 12];
  var PEG = '#d8bc8a', PEG_D = '#a88a5a', GLOSS = '#fff4e0', APRON = '#4e2e1c', APRON2 = '#6e4428';

  function rgb(h) { return A.rgb(h); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ══ the close-up rig: where his parts are, in his own units ════════
   * Feet at (0, 0), y up is negative, x is the viewer's right (from the
   * front, his left hand; from behind, his right). One unit is one board
   * pixel at his own size in the mine; × s at the glass. */
  function crewOf(who) { return (A.CREW && A.CREW[who]) || (A.CREW && A.CREW.lamp); }
  function body(c) {
    var hipY = -(c.leg + 1), neckY = hipY - c.torso, shY = neckY + 2;
    var hc = [0, neckY - c.head + Math.min(2.4, c.stoop / 12)];
    return { hipY: hipY, neckY: neckY, shY: shY, hw: c.width / 2, hc: hc, r: c.head };
  }
  // arms: the lamp hand (his right: the viewer's left from the front) and
  // the free hand, by pose; hands in units
  function arms(c, B, pose, fist, view) {
    var hw = B.hw, sh = B.shY, L, Rr, lanternUp = false, fistK = 1;
    var lamp = [-hw - 1.6, sh + c.arm - 2.8];
    var free = [hw + 1.4, sh + c.arm - 3.2];
    if (pose === 'walkA') { lamp = [lamp[0] - 0.7, lamp[1] - 0.4]; free = [free[0] + 0.4, free[1] - 1.2]; }
    if (pose === 'walkB') { lamp = [lamp[0] + 0.5, lamp[1] - 0.2]; free = [free[0] - 0.2, free[1] + 0.2]; }
    if (pose === 'liftHalf') lamp = [-hw - 4.2, sh + 1.2];
    if (pose === 'lift') { lamp = [-hw - 4.6, B.hc[1] - 5.6]; lanternUp = true; }
    if (pose === 'knockUp' || pose === 'knock') { lamp = [-hw - 4.6, B.hc[1] - 5.6]; lanternUp = true; }
    // (the knock, seen through the glass: wound back beside his head, then
    // forward against the pane in front of his shoulder, nearer, bigger)
    if (fist === 1) { free = [hw + 3.4, B.hc[1] - 0.2]; fistK = 0.95; }
    if (fist === 2) { free = [hw + 1.7, B.hc[1] + 2.4]; fistK = 1.6; }
    // …and after the third, the hand opens flat against the glass
    if (fist === 3) { free = [hw + 1.8, B.hc[1] + 2.1]; fistK = 1.7; }
    if (view === 'back') { var q = lamp; lamp = [-q[0], q[1]]; free = [-free[0], free[1]]; }
    return { lamp: lamp, free: free, lanternUp: lanternUp, fistK: fistK };
  }
  // the lantern hangs from the lamp hand by its bail: its globe's centre
  function lanternAt(ar) { return [ar.lamp[0], ar.lamp[1] + 3.4]; }
  A.closeRig = function (g) {
    var c = crewOf(g.who), B = body(c), ar = arms(c, B, g.pose, g.fist | 0, g.view || 'front');
    return { lantern: lanternAt(ar), fist: ar.free, capLamp: [B.hc[0], B.hc[1] - B.r - 0.2], head: B.hc };
  };

  /* ══ the painter: shapes in his units, rasterised at pixel centres ══ */
  function Painter(W, H, ox, oy, s) {
    var c = A.makeCanvas(W, H), g = c.getContext('2d');
    var ang = 0, pvx = 0, pvy = 0, ca = 1, sa = 0, tx = 0, ty = 0;
    function rot(a, x, y) { ang = a || 0; pvx = x || 0; pvy = y || 0; ca = Math.cos(ang); sa = Math.sin(ang); }
    function shift(x, y) { tx = x || 0; ty = y || 0; }
    function T(x, y) {
      x += tx; y += ty;
      if (ang) { var dx = x - pvx, dy = y - pvy; x = pvx + dx * ca - dy * sa; y = pvy + dx * sa + dy * ca; }
      return [ox + x * s, oy + y * s];
    }
    function fill(x0, y0, x1, y1, inside, col) {
      g.fillStyle = col;
      x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
      for (var y = y0; y <= y1; y++) {
        var run = -1;
        for (var x = x0; x <= x1 + 1; x++) {
          var ins = x <= x1 && inside(x + 0.5, y + 0.5);
          if (ins && run < 0) run = x;
          else if (!ins && run >= 0) { g.fillRect(run, y, x - run, 1); run = -1; }
        }
      }
    }
    // a polygon (units)
    function poly(pts, col) {
      var q = pts.map(function (p) { return T(p[0], p[1]); });
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      q.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      fill(x0, y0, x1, y1, function (cx, cy) {
        var inside = false;
        for (var i = 0, j = q.length - 1; i < q.length; j = i++)
          if ((q[i][1] > cy) !== (q[j][1] > cy) && cx < (q[j][0] - q[i][0]) * (cy - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) inside = !inside;
        return inside;
      }, col);
    }
    // an ellipse (units; rotation moves its centre only: they're all round-ish)
    function ell(x, y, rx, ry, col, minPx) {
      var p = T(x, y), a = Math.max(minPx || 0.5, rx * s), b = Math.max(minPx || 0.5, ry * s);
      if (a < 0.9 && b < 0.9) { g.fillStyle = col; g.fillRect(Math.floor(p[0]), Math.floor(p[1]), 1, 1); return; }
      fill(p[0] - a, p[1] - b, p[0] + a, p[1] + b, function (cx, cy) { var u = (cx - p[0]) / a, v = (cy - p[1]) / b; return u * u + v * v <= 1; }, col);
    }
    // a thick segment with round ends (units; w in units, at least a pixel)
    function seg(xa, ya, xb, yb, w, col) {
      var p = T(xa, ya), q = T(xb, yb), r = Math.max(0.5, w * s / 2), dx = q[0] - p[0], dy = q[1] - p[1], L2 = dx * dx + dy * dy || 1e-9;
      fill(Math.min(p[0], q[0]) - r, Math.min(p[1], q[1]) - r, Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r, function (cx, cy) {
        var u = clamp(((cx - p[0]) * dx + (cy - p[1]) * dy) / L2, 0, 1), ex = p[0] + dx * u - cx, ey = p[1] + dy * u - cy;
        return ex * ex + ey * ey <= r * r;
      }, col);
    }
    // one pixel at a point (the smallest mark of paint)
    function dot(x, y, col) { var p = T(x, y); g.fillStyle = col; g.fillRect(Math.floor(p[0]), Math.floor(p[1]), 1, 1); }
    // the shaded side of a turned shape: inside the disc, outside the same disc
    // moved toward the light (the crescent the lamp doesn't reach)
    function lune(x, y, r, dx, dy, col) {
      var p = T(x, y), q = T(x + dx, y + dy), R2 = (r * s) * (r * s);
      fill(p[0] - r * s, p[1] - r * s, p[0] + r * s, p[1] + r * s, function (cx, cy) {
        var a = (cx - p[0]) * (cx - p[0]) + (cy - p[1]) * (cy - p[1]), b = (cx - q[0]) * (cx - q[0]) + (cy - q[1]) * (cy - q[1]);
        return a <= R2 && b > R2;
      }, col);
    }
    return { c: c, g: g, rot: rot, shift: shift, T: T, poly: poly, ell: ell, seg: seg, dot: dot, lune: lune, s: s, ox: ox, oy: oy, W: W, H: H };
  }

  // the beard's rows (the small figures' own: pachinko-art-figures.js BEARDS)
  var BEARDS = {
    knees: [5, 5, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1],
    belt: [5, 5, 7, 7, 7, 6, 6, 5, 5, 4, 3, 2, 1],
    spade: [5, 5, 7, 7, 7, 7, 7, 6],
    walrus: [6, 0, 0],
    goatee: [4, 2, 2, 2, 1]
  };

  /* ── from the front ─────────────────────────────────────────────── */
  function paintFront(Pn, c, g) {
    var B = body(c), hw = B.hw, hy = B.hipY, sh = B.shY, hc = B.hc, r = B.r;
    var ar = arms(c, B, g.pose, g.fist | 0, 'front'), E = [];      // E: emissive, drawn after the light
    var lu = lanternAt(ar), toL = [lu[0] - hc[0], lu[1] - hc[1]], tl = Math.hypot(toL[0], toL[1]) || 1; toL = [toL[0] / tl, toL[1] / tl];
    var roll = g.pose === 'walkA' ? -4 * D2R : g.pose === 'walkB' ? 4 * D2R : 0;
    var lift = g.pose === 'walkA' ? 1 : g.pose === 'walkB' ? -1 : 0;   // which boot is off the floor (1: the viewer's right)
    // legs: turned pegs, boots with a toe to them
    var fl = [-2.1, lift < 0 ? -0.9 : 0], fr = [2.1, lift > 0 ? -0.9 : 0];
    Pn.seg(-2.1, hy + 1, fl[0], fl[1] - 1, 2.9, c.trousers);
    Pn.seg(2.1, hy + 1, fr[0], fr[1] - 1, 2.9, c.trousers);
    [fl, fr].forEach(function (f) {
      Pn.ell(f[0], f[1] - 0.8, 1.9, 1.05, P.BOOT);
      Pn.ell(f[0] - 0.4, f[1] - 1.2, 0.8, 0.35, '#3a3440');             // the toe cap's shine
    });
    // everything above the hips rolls with the waddle
    Pn.rot(roll, 0, hy);
    // the body: a turned barrel, rounder at the belly
    Pn.poly([[-hw + 0.8, sh - 2.4], [hw - 0.8, sh - 2.4], [hw + 0.2, sh - 1], [hw + 0.8, hy - c.torso * 0.4], [hw + 0.3, hy + 1],
      [-hw - 0.3, hy + 1], [-hw - 0.8, hy - c.torso * 0.4], [-hw - 0.2, sh - 1]], c.coat);
    // the barrel's far side, away from the lamp, in shade
    var farX = toL[0] < 0 ? 1 : -1;
    Pn.poly([[farX * (hw - 1.6), sh - 2.2], [farX * (hw - 0.6), sh - 2.3], [farX * (hw + 0.3), sh - 1], [farX * (hw + 0.9), hy - c.torso * 0.4], [farX * (hw + 0.4), hy + 1], [farX * (hw - 1.2), hy + 1], [farX * (hw - 0.9), hy - c.torso * 0.4]], A.mix(c.coat, '#000000', 0.35));
    Pn.seg(-farX * (hw - 0.4), sh - 1.4, -farX * (hw + 0.3), hy - c.torso * 0.4, 0.6, c.coat2);
    // the coat's front edge and its buttons, where the apron doesn't cover it
    Pn.seg(0, sh - 1.8, 0, hy + 0.6, 0.35, c.coat2);
    if (c.apron) {
      // the leather apron: a bib at the chest, down past the knees; the neck strap
      var aw = hw - 1.1;
      Pn.poly([[-aw + 0.6, sh - 0.2], [aw - 0.6, sh - 0.2], [aw + 0.5, hy + 4.2], [-aw - 0.5, hy + 4.2]], APRON);
      Pn.seg(-aw + 0.6, sh - 0.2, aw - 0.6, sh - 0.2, 0.45, APRON2);
      Pn.seg(-aw + 0.8, sh - 0.1, -1.1, sh - 2.4, 0.4, APRON2); Pn.seg(aw - 0.8, sh - 0.1, 1.1, sh - 2.4, 0.4, APRON2);
      Pn.poly([[-1.6, hy + 0.4], [0.6, hy + 0.4], [0.5, hy + 2.3], [-1.5, hy + 2.3]], '#5e3822');          // a pocket, stitched on
      Pn.seg(-1.6, hy + 0.4, 0.6, hy + 0.4, 0.3, '#3a2012');
      Pn.seg(-aw - 0.4, hy + 4.1, aw + 0.4, hy + 4.1, 0.4, '#3a2012');                                    // the hem
    } else {
      Pn.seg(-hw, hy - 1.2, hw, hy - 1.2, 0.8, '#1a1410');                                               // a belt
      Pn.ell(0, hy - 1.2, 0.55, 0.45, P.BRASS3);
      [sh + 1.5, sh + 4, hy - 3].forEach(function (y) { Pn.ell(0.6, y, 0.35, 0.35, '#b8a888'); });
      if (c.patch) Pn.poly([[-2.6, hy - 5.2], [-0.6, hy - 5.2], [-0.6, hy - 3.2], [-2.6, hy - 3.2]], '#5e5440');
    }
    // the arms: straight pegs from the shoulder, a peg at the joint
    var shL = [-hw + 0.2, sh - 0.8], shR = [hw - 0.2, sh - 0.8], aw2 = 2.2 * (g.fist === 2 ? 1.2 : 1);
    // (each arm a peg with its own dark edge, so it stands off the body)
    Pn.seg(shL[0], shL[1], ar.lamp[0], ar.lamp[1], 2.2 + 0.7, '#161219');
    Pn.seg(shL[0], shL[1], ar.lamp[0], ar.lamp[1], 2.2, c.coat);
    Pn.seg(shL[0] - 0.3, shL[1], ar.lamp[0] - 0.3, ar.lamp[1], 0.8, c.coat2);
    if (!g.fist) {
      Pn.seg(shR[0], shR[1], ar.free[0], ar.free[1], aw2 + 0.7, '#161219');
      Pn.seg(shR[0], shR[1], ar.free[0], ar.free[1], aw2, c.coat);
    }
    Pn.ell(shL[0], shL[1] - 0.2, 0.7, 0.7, PEG); Pn.ell(shR[0], shR[1] - 0.2, 0.7, 0.7, PEG);
    Pn.dot(shR[0] - 0.9, shR[1] + 0.9, PEG);                                                            // paint chipped off: bare linden
    // the beard: wider than the chin, down the chest (a ginger gone to salt
    // for Tobias: streaks of the old colour in it)
    var rows = BEARDS[c.beard] || BEARDS.belt, by0 = hc[1] + 1.3;
    if (c.beard === 'walrus') {
      Pn.poly([[-3.4, by0 + 0.2], [-1, by0 - 0.5], [0, by0 - 0.2], [1, by0 - 0.5], [3.4, by0 + 0.2], [3.1, by0 + 2.2], [2.2, by0 + 1.2], [0, by0 + 0.9], [-2.2, by0 + 1.2], [-3.1, by0 + 2.2]], c.beardC);
    } else {
      var left = [], right = [];
      for (var k = 0; k < rows.length; k++) { var w = rows[k] / 2 + 0.35, y = by0 + k; left.push([-w, y]); right.unshift([w, y]); }
      left.push([0, by0 + rows.length + 0.6]);
      var bp = left.concat(right);
      Pn.poly(bp.map(function (q) { return [q[0] * 1.06 + (q[0] < 0 ? -0.25 : 0.25), q[1] + 0.25]; }), c.beardD);
      Pn.poly(bp, c.beardC);
      // strokes of the darker paint down it, and a lick of white
      for (k = 2; k < rows.length - 1; k += 3) { var ww = rows[k] / 2 - 0.4; Pn.seg(-ww + 0.4, by0 + k, -ww + 0.9, by0 + k + 1.6, 0.4, c.beardD); Pn.seg(ww - 0.2, by0 + k + 0.5, ww - 0.6, by0 + k + 2, 0.4, c.beardD); }
      if (rows.length > 6) Pn.seg(-0.4, by0 + 4.5, 0.2, by0 + 7.5, 0.35, '#ffffff');
    }
    // the head: turned wood, painted
    Pn.rot(roll + (g.tilt || 0) * D2R, 0, B.neckY);
    Pn.shift(0, g.nod ? 0.8 : 0);                                                                          // a nod: the head dips
    Pn.ell(hc[0] - 4.05, hc[1] + 0.3, 0.8, 1.0, P.FACE_D); Pn.ell(hc[0] + 4.05, hc[1] + 0.3, 0.8, 1.0, P.FACE_D);   // ears
    Pn.ell(hc[0], hc[1], r, r, P.FACE);
    // turned wood: the side of the head away from his lamp in its own shade
    Pn.lune(hc[0], hc[1], r, toL[0] * 1.3, toL[1] * 1.3, P.FACE_D);
    Pn.ell(hc[0], hc[1] + r - 0.9, r - 1.2, 0.8, P.FACE_D);                                              // under the chin, in its own shade
    // grey hair at the sides, under the cap
    Pn.poly([[-r - 0.3, hc[1] - 2.2], [-r + 1.2, hc[1] - 2.2], [-r + 0.8, hc[1] + 0.2], [-r - 0.1, hc[1] + 0.8]], c.beardC);
    Pn.poly([[r + 0.3, hc[1] - 2.2], [r - 1.2, hc[1] - 2.2], [r - 0.8, hc[1] + 0.2], [r + 0.1, hc[1] + 0.8]], c.beardC);
    // the moustache over it all, and the mouth in it
    if (c.beard !== 'walrus' && c.beard !== 'goatee') {
      Pn.poly([[-2.9, hc[1] + 2.3], [-1.1, hc[1] + 1.1], [0, hc[1] + 1.35], [1.1, hc[1] + 1.1], [2.9, hc[1] + 2.3], [2.2, hc[1] + 2.6], [0, hc[1] + 2.0], [-2.2, hc[1] + 2.6]], c.beardC);
      Pn.seg(-0.5, hc[1] + 2.45, 0.5, hc[1] + 2.45, 0.35, '#8a5a4a');
    }
    if (c.beard === 'walrus') Pn.seg(-0.4, hc[1] + 3.0, 0.4, hc[1] + 3.0, 0.35, '#8a5a4a');
    // the nose, the cheeks, the brows: the old men are all frown and eyebrow
    var nose = c.nose ? '#c85048' : '#d09878';
    Pn.ell(hc[0], hc[1] + 0.25, c.nose ? 1.05 : 0.75, c.nose ? 0.95 : 0.7, nose);
    Pn.ell(hc[0] + 0.35, hc[1] - 0.05, 0.25, 0.25, c.nose ? '#e87870' : '#e8b894');
    Pn.ell(hc[0] - 2.6, hc[1] + 0.6, 0.55, 0.42, '#d8808a'); Pn.ell(hc[0] + 2.6, hc[1] + 0.6, 0.55, 0.42, '#d8808a');
    Pn.seg(hc[0] - 2.9, hc[1] - 1.85, hc[0] - 1.2, hc[1] - 1.55, 0.6, c.beardD);
    Pn.seg(hc[0] + 2.9, hc[1] - 1.85, hc[0] + 1.2, hc[1] - 1.55, 0.6, c.beardD);
    // eyes: two dots of black paint, a little too wide and a little too high
    var eyeY = hc[1] - 0.95, eyeR = 0.46;
    Pn.ell(hc[0] - 1.95, eyeY, eyeR, eyeR, P.INK); Pn.ell(hc[0] + 1.95, eyeY, eyeR, eyeR, P.INK);
    if (c.specs) { Pn.ell(hc[0] - 1.95, eyeY, 1.05, 0.9, 'rgba(200,208,216,0.55)'); Pn.ell(hc[0] + 1.95, eyeY, 1.05, 0.9, 'rgba(200,208,216,0.55)'); Pn.seg(hc[0] - 0.9, eyeY, hc[0] + 0.9, eyeY, 0.3, '#8a8a96'); Pn.ell(hc[0] - 1.95, eyeY, eyeR, eyeR, P.INK); Pn.ell(hc[0] + 1.95, eyeY, eyeR, eyeR, P.INK); }
    // the cap and its lamp
    cap(Pn, c, hc, r, E, 'front');
    Pn.shift(0, 0);
    Pn.rot(roll, 0, hy);
    // the hands: mittens. The lamp hand holds the lantern by its bail
    lantern(Pn, ar, E, g);
    Pn.ell(ar.lamp[0], ar.lamp[1], 1.3, 1.3, P.FACE);
    if (g.fist) {
      // the knocking arm comes up toward the glass, in front of it all
      Pn.seg(shR[0], shR[1], ar.free[0], ar.free[1], aw2 + 0.7, '#161219');
      Pn.seg(shR[0], shR[1], ar.free[0], ar.free[1], aw2, c.coat);
      Pn.ell(ar.free[0], ar.free[1], 1.3 * ar.fistK + 0.35, 1.3 * ar.fistK + 0.35, '#161219');
    }
    if (g.fist === 3) {
      // the open hand, flat to the pane: the thumb out, the palm pressed pale
      var pk = ar.fistK, px0 = ar.free[0], py0 = ar.free[1];
      Pn.ell(px0 - 1.25 * pk, py0 + 0.5 * pk, 0.6 * pk + 0.3, 0.55 * pk + 0.3, '#161219');
      Pn.ell(px0 - 1.25 * pk, py0 + 0.5 * pk, 0.6 * pk, 0.55 * pk, P.FACE);
      Pn.ell(px0, py0, 1.3 * pk, 1.5 * pk, P.FACE);
      Pn.ell(px0 + 0.1 * pk, py0 + 0.1 * pk, 0.75 * pk, 0.9 * pk, '#f0caa8');
      Pn.seg(px0 - 0.9 * pk, py0 + 0.9 * pk, px0 - 0.3 * pk, py0 - 0.2 * pk, 0.25 * pk, P.FACE_D);
    } else Pn.ell(ar.free[0], ar.free[1], 1.3 * ar.fistK, 1.3 * ar.fistK, P.FACE);
    if (g.fist && g.fist !== 3) {
      // a mitten balled up: the thumb folded across, the knuckles to the glass
      var fk = ar.fistK, fx = ar.free[0], fy = ar.free[1];
      Pn.lune(fx, fy, 1.3 * fk, -0.5 * fk, -0.55 * fk, P.FACE_D);
      Pn.seg(fx - 0.95 * fk, fy + 0.45 * fk, fx + 0.2 * fk, fy + 0.7 * fk, 0.55 * fk, P.FACE_D);
      Pn.seg(fx - 0.9 * fk, fy - 0.75 * fk, fx + 0.5 * fk, fy - 0.95 * fk, 0.4 * fk, '#f4d0b0');
    }
    Pn.rot(0);
    return E;
  }

  /* ── from behind (going back to work) ───────────────────────────── */
  function paintBack(Pn, c, g) {
    var B = body(c), hw = B.hw, hy = B.hipY, sh = B.shY, hc = B.hc, r = B.r;
    var ar = arms(c, B, g.pose, 0, 'back'), E = [];
    var roll = g.pose === 'walkA' ? 4 * D2R : g.pose === 'walkB' ? -4 * D2R : 0;
    var lift = g.pose === 'walkA' ? -1 : g.pose === 'walkB' ? 1 : 0;
    var fl = [-2.1, lift < 0 ? -0.9 : 0], fr = [2.1, lift > 0 ? -0.9 : 0];
    Pn.seg(-2.1, hy + 1, fl[0], fl[1] - 1, 2.9, c.trousers);
    Pn.seg(2.1, hy + 1, fr[0], fr[1] - 1, 2.9, c.trousers);
    [fl, fr].forEach(function (f) { Pn.ell(f[0], f[1] - 0.7, 1.7, 0.9, P.BOOT); Pn.seg(f[0] - 1, f[1] - 0.2, f[0] + 1, f[1] - 0.2, 0.4, '#3a3440'); });
    Pn.rot(roll, 0, hy);
    Pn.poly([[-hw + 0.8, sh - 2.4], [hw - 0.8, sh - 2.4], [hw + 0.2, sh - 1], [hw + 0.8, hy - c.torso * 0.4], [hw + 0.3, hy + 1],
      [-hw - 0.3, hy + 1], [-hw - 0.8, hy - c.torso * 0.4], [-hw - 0.2, sh - 1]], c.coat);
    Pn.seg(0, sh - 1, 0, hy + 0.8, 0.35, c.coat2);                                                       // the back seam
    if (c.apron) {
      // the apron's ties cross the back and knot in a bow above the belt
      Pn.seg(-hw + 0.9, sh - 0.6, hw - 1.3, hy - 2.2, 0.45, APRON); Pn.seg(hw - 0.9, sh - 0.6, -hw + 1.3, hy - 2.2, 0.45, APRON);
      Pn.ell(-0.9, hy - 2.3, 0.9, 0.6, APRON2); Pn.ell(0.9, hy - 2.3, 0.9, 0.6, APRON2); Pn.ell(0, hy - 2.3, 0.45, 0.45, '#8a5a34');
      Pn.seg(-0.3, hy - 2, -0.9, hy - 0.3, 0.35, APRON); Pn.seg(0.3, hy - 2, 1, hy - 0.2, 0.35, APRON);
      // and the apron's edge shows either side of the knees
      Pn.seg(-hw + 0.2, hy + 1.4, -hw + 0.4, hy + 4, 0.5, APRON); Pn.seg(hw - 0.2, hy + 1.4, hw - 0.4, hy + 4, 0.5, APRON);
    } else Pn.seg(-hw, hy - 1.2, hw, hy - 1.2, 0.8, '#1a1410');
    var shL = [-hw + 0.2, sh - 0.8], shR = [hw - 0.2, sh - 0.8];
    Pn.seg(shL[0], shL[1], ar.free[0], ar.free[1], 2.2, c.coat);
    Pn.seg(shR[0], shR[1], ar.lamp[0], ar.lamp[1], 2.2, c.coat);
    Pn.ell(shL[0], shL[1] - 0.2, 0.7, 0.7, PEG_D); Pn.ell(shR[0], shR[1] - 0.2, 0.7, 0.7, PEG);
    // the beard is wider than his head: it shows either side
    var rows = BEARDS[c.beard] || [], tuft = rows.length > 6 ? 4 : rows.length > 3 ? 2 : 0;
    if (tuft) { Pn.poly([[-r - 1.1, hc[1] + 1], [-r + 0.4, hc[1] + 1.5], [-r + 0.2, hc[1] + 1 + tuft], [-r - 0.6, hc[1] + tuft]], c.beardC); Pn.poly([[r + 1.1, hc[1] + 1], [r - 0.4, hc[1] + 1.5], [r - 0.2, hc[1] + 1 + tuft], [r + 0.6, hc[1] + tuft]], c.beardC); }
    Pn.rot(roll, 0, B.neckY);
    Pn.ell(hc[0] - 4, hc[1] + 0.3, 0.8, 1.0, P.FACE_D); Pn.ell(hc[0] + 4, hc[1] + 0.3, 0.8, 1.0, P.FACE_D);
    // the back of the turned head: grey hair from the cap down to the collar,
    // a stroke of the darker grey through it, the ears either side
    Pn.ell(hc[0], hc[1], r, r, P.FACE_D);
    Pn.ell(hc[0], hc[1] + 0.2, r - 0.25, r - 0.35, c.beardC);
    Pn.seg(hc[0] - 1.6, hc[1] - 1.5, hc[0] - 1.1, hc[1] + 2.6, 0.45, c.beardD);
    Pn.seg(hc[0] + 0.4, hc[1] - 1.2, hc[0] + 0.7, hc[1] + 3.0, 0.45, c.beardD);
    Pn.seg(hc[0] + 2.2, hc[1] - 1.4, hc[0] + 1.8, hc[1] + 2.4, 0.4, c.beardD);
    Pn.poly([[-r + 0.9, hc[1] + r - 0.9], [r - 0.9, hc[1] + r - 0.9], [r - 1.6, hc[1] + r + 0.3], [-r + 1.6, hc[1] + r + 0.3]], c.beardD);   // the nape, in shade
    cap(Pn, c, hc, r, E, 'back');
    Pn.rot(roll, 0, hy);
    lantern(Pn, ar, E, g);
    Pn.ell(ar.lamp[0], ar.lamp[1], 1.3, 1.3, P.FACE_D);
    Pn.ell(ar.free[0], ar.free[1], 1.3, 1.3, P.FACE_D);
    Pn.rot(0);
    return E;
  }

  function cap(Pn, c, hc, r, E, view) {
    var top = hc[1] - r, cc = c.capC, c2 = c.capC2;
    if (c.cap === 'skull') {
      Pn.ell(hc[0], top + 1.4, r + 0.3, 2.2, cc); Pn.poly([[-r - 0.4, top + 1.4], [r + 0.4, top + 1.4], [r + 0.2, top + 2.3], [-r - 0.2, top + 2.3]], cc);
      Pn.seg(hc[0], top - 0.7, hc[0], top + 2.2, 0.35, '#3a2416');
    } else if (c.cap === 'flat') {
      Pn.ell(hc[0], top + 1.2, r + 0.6, 1.9, cc); Pn.ell(hc[0] - 0.8, top + 0.6, r - 1.2, 1.1, c2);
      Pn.poly([[-r - 0.6, top + 1.6], [r + 0.6, top + 1.6], [r + 0.2, top + 2.5], [-r - 0.2, top + 2.5]], cc);
    } else {
      // the soft miner's cap (a tall slumped crown for Absalom), a band, a short peak
      var tall = c.cap === 'tallsoft' ? 1.6 : 0;
      Pn.ell(hc[0], top - 0.1 - tall * 0.5, r + 0.1, 2.2 + tall, cc);
      Pn.ell(hc[0] - 1, top - 0.9 - tall, r - 1.9, 0.9, c2);
      Pn.poly([[-r - 0.6, top + 0.5], [r + 0.6, top + 0.5], [r + 0.4, top + 1.5], [-r - 0.4, top + 1.5]], cc);
      Pn.seg(-r - 0.4, top + 1.45, r + 0.4, top + 1.45, 0.35, '#1c1a20');
    }
    if (view === 'back') {
      // the lamp's strap over the crown; the reflector's rim just shows over the top
      Pn.seg(-r + 0.3, top + 2, r - 0.3, top + 2, 0.45, '#2a2018');
      Pn.ell(hc[0], top - 0.9, 1.1, 0.5, P.BRASS2);
      E.push({ kind: 'backflame', x: hc[0], y: top - 1.2 });
      return;
    }
    // the carbide lamp on the front: a brass reflector, the flame in its middle,
    // the water tank under it
    var ly = top - 0.7;
    Pn.poly([[-0.45, ly + 1.3], [0.45, ly + 1.3], [0.45, ly + 2.2], [-0.45, ly + 2.2]], P.BRASS1);
    Pn.ell(hc[0], ly, 1.45, 1.45, P.BRASS1);
    Pn.ell(hc[0], ly, 1.15, 1.15, P.BRASS3);
    Pn.ell(hc[0], ly, 0.7, 0.7, P.BRASS2);
    E.push({ kind: 'flame', x: hc[0], y: ly - 0.1 });
  }
  function lantern(Pn, ar, E, g) {
    var h = ar.lamp, cx = h[0], top = h[1] + 1.2, gy = h[1] + 3.4;
    // the bail from his fist, the cap, the globe in its guard wires, the base
    Pn.seg(cx - 1.1, top, cx, h[1] - 0.2, 0.3, P.IRON3); Pn.seg(cx + 1.1, top, cx, h[1] - 0.2, 0.3, P.IRON3);
    Pn.poly([[cx - 1.2, top], [cx + 1.2, top], [cx + 1.6, top + 0.9], [cx - 1.6, top + 0.9]], P.IRON2);
    Pn.ell(cx, top - 0.1, 0.5, 0.3, P.IRON3);
    Pn.poly([[cx - 1.9, gy + 1.6], [cx + 1.9, gy + 1.6], [cx + 2.0, gy + 2.6], [cx - 2.0, gy + 2.6]], P.IRON2);
    Pn.seg(cx - 1.9, gy + 2.6, cx + 1.9, gy + 2.6, 0.35, P.IRON1);
    E.push({ kind: 'globe', x: cx, y: gy, lit: g.lamp || 0 });
  }

  /* ── the light on him: his lantern (warm, in flat bands), the room ── */
  var AMB = [0.16, 0.13, 0.25], KEY = [1.0, 0.80, 0.50], BANDS = 6;
  function lightPass(Pn, keyU, keyK, bonus) {
    var W = Pn.W, H = Pn.H, g = Pn.g, im = g.getImageData(0, 0, W, H), d = im.data, s = Pn.s;
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var o = (y * W + x) * 4; if (!d[o + 3]) continue;
      var ux = (x + 0.5 - Pn.ox) / s, uy = (y + 0.5 - Pn.oy) / s;
      var dx = ux - keyU[0], dy = uy - keyU[1], dz = 2.2, dd = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // one scalar, in flat bands (a hue must never band: the paint stays its colour)
      var f0 = keyK / (1 + (dd / 8.5) * (dd / 8.5));
      // (the fist at the glass catches the room's light as well as his lamp's)
      for (var bi = 0; bi < bonus.length; bi++) { var bq = bonus[bi], bx = ux - bq.x, by = uy - bq.y; if (bx * bx + by * by < bq.r * bq.r) f0 += bq.k; }
      var f = Math.round(f0 * BANDS) / BANDS;
      // a cool rim from the case light, on edges that face up
      var up = y > 0 && !d[o - W * 4 + 3] ? 0.14 : 0;
      for (var ch = 0; ch < 3; ch++) {
        var L = AMB[ch] + KEY[ch] * f + up * (ch === 2 ? 1.2 : 0.8);
        d[o + ch] = Math.min(255, d[o + ch] * L);
      }
    }
    g.putImageData(im, 0, 0);
  }
  function outline(Pn) {
    var W = Pn.W, H = Pn.H, g = Pn.g, im = g.getImageData(0, 0, W, H), d = im.data, mark = new Uint8Array(W * H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x; if (d[i * 4 + 3]) continue;
      if ((x > 0 && d[(i - 1) * 4 + 3]) || (x < W - 1 && d[(i + 1) * 4 + 3]) || (y > 0 && d[(i - W) * 4 + 3]) || (y < H - 1 && d[(i + W) * 4 + 3])) mark[i] = 1;
    }
    for (i = 0; i < W * H; i++) if (mark[i]) { d[i * 4] = OUT[0]; d[i * 4 + 1] = OUT[1]; d[i * 4 + 2] = OUT[2]; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  }
  function emissive(Pn, E, t) {
    E.forEach(function (e) {
      if (e.kind === 'flame' || e.kind === 'backflame') {
        var big = Pn.s >= 2;
        if (e.kind === 'backflame') { Pn.ell(e.x, e.y - 0.3, 0.35, 0.5, 'rgba(255,208,96,0.9)'); return; }
        Pn.ell(e.x, e.y + 0.1, 0.5, 0.55, P.FLAME2);
        Pn.ell(e.x, e.y - 0.7, 0.32, 0.45, P.FLAME1);
        if (big) Pn.dot(e.x + 0.15, e.y - 1.25, P.FLAME0);
      } else if (e.kind === 'globe') {
        // the lantern's glass, lit from inside, its guard wires across it
        Pn.poly([[e.x - 1.5, e.y - 1.9], [e.x + 1.5, e.y - 1.9], [e.x + 1.8, e.y + 1.6], [e.x - 1.8, e.y + 1.6]], '#f2b44a');
        Pn.ell(e.x, e.y + 0.2, 1.1, 1.4, P.FLAME1);
        Pn.ell(e.x, e.y + 0.4, 0.55, 0.8, P.FLAME2);
        Pn.seg(e.x - 1.6, e.y - 1.8, e.x - 1.8, e.y + 1.5, 0.3, P.IRON2); Pn.seg(e.x + 1.6, e.y - 1.8, e.x + 1.8, e.y + 1.5, 0.3, P.IRON2);
        Pn.seg(e.x, e.y - 1.9, e.x, e.y - 1.2, 0.3, P.IRON2);
        Pn.dot(e.x - 1.0, e.y - 1.2, '#fff8e0');
      }
    });
  }

  /* ── one close-up, cached by everything that shapes it ─────────── */
  var cache = {}, cacheN = 0;
  function closeSprite(gk) {
    var s = Math.round(gk.s * 50) / 50;
    var key = gk.who + '|' + gk.view + '|' + s + '|' + gk.pose + '|' + (gk.fist | 0) + '|' + (gk.tilt | 0) + (gk.nod ? 'n' : '') + '|' + Math.round((gk.lamp || 0) * 2);
    var e = cache[key]; if (e) return e;
    if (cacheN > 120) { cache = {}; cacheN = 0; }
    var c = crewOf(gk.who);
    var W = Math.ceil(28 * s) + 6, H = Math.ceil((c.leg + c.torso + c.head * 2 + 9) * s) + 6;
    var ox = Math.floor(W / 2), oy = H - Math.max(2, Math.ceil(0.6 * s)) - 1;
    var Pn = Painter(W, H, ox, oy, s);
    var E = gk.view === 'back' ? paintBack(Pn, c, gk) : paintFront(Pn, c, gk);
    var rig = A.closeRig(gk), lu = rig.lantern;
    var bonus = gk.fist && gk.view !== 'back' ? [{ x: rig.fist[0], y: rig.fist[1], r: gk.fist >= 2 ? 2.8 : 2.0, k: gk.fist >= 2 ? 0.42 : 0.2 }] : [];
    lightPass(Pn, lu, 0.9 + 0.6 * (gk.lamp || 0), bonus);
    emissive(Pn, E);
    // varnish: the turned head and the barrel catch the lamp where they face it
    if (gk.view !== 'back' && s >= 1.8) {
      var B = body(c), hc = B.hc, dx = lu[0] - hc[0], dy = lu[1] - hc[1], dl = Math.hypot(dx, dy) || 1;
      Pn.rot((gk.tilt || 0) * D2R, 0, B.neckY); Pn.shift(0, gk.nod ? 0.8 : 0);
      // (on the crown, toward the lamp's side: a glint low on the face reads as a tooth)
      Pn.dot(hc[0] + dx / dl * B.r * 0.55, hc[1] - B.r * 0.55, GLOSS);
      // the painted eyes take the light too: a speck of varnish in each
      if (s >= 2.6) { Pn.dot(hc[0] - 1.95 + 0.2, hc[1] - 0.95 - 0.22, '#e8dcc8'); Pn.dot(hc[0] + 1.95 + 0.2, hc[1] - 0.95 - 0.22, '#e8dcc8'); }
      Pn.rot(0); Pn.shift(0, 0);
    }
    outline(Pn);
    // his shadow's silhouette
    var sh = A.makeCanvas(W, H), sg = sh.getContext('2d');
    sg.drawImage(Pn.c, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = '#000'; sg.fillRect(0, 0, W, H);
    e = cache[key] = { c: Pn.c, sh: sh, ox: ox, oy: oy, W: W, H: H };
    cacheN++;
    return e;
  }
  A.closeSprite = closeSprite;

  function drawCloseKnocker(g, gk) {
    var e = closeSprite(gk);
    g.drawImage(e.c, Math.round(gk.x) - e.ox, Math.round(gk.y) - e.oy);
  }
  A.drawCloseKnocker = drawCloseKnocker;
  // his shadow on the rock behind: thrown by his own lantern, away from it,
  // bigger and softer the further he comes from the rock (the albedo pass:
  // the light multiplies it after)
  function drawCloseShadow(g, gk) {
    var e = closeSprite(gk), far = gk.s - 1;
    if (far < 0.05) return;
    var lx = gk.lantern ? gk.lantern.x : gk.x - 6, ly = gk.lantern ? gk.lantern.y : gk.y - 4;
    var cx = gk.x, cy = gk.y - e.oy * 0.45;
    var dx = cx - lx, dy = cy - ly, dl = Math.hypot(dx, dy) || 1;
    var k = 1 + 0.07 * far, off = 2 + 3.2 * far;
    var w = e.W * k, h = e.H * k;
    var x = Math.round(gk.x - e.ox * k + dx / dl * off), y = Math.round(gk.y - e.oy * k + dy / dl * off * 0.6);
    g.save();
    g.globalAlpha = Math.max(0.18, 0.46 - 0.06 * far);
    g.imageSmoothingEnabled = false;
    g.drawImage(e.sh, x, y, Math.round(w), Math.round(h));
    g.restore();
  }
  // the lantern's light hanging in the air of the case round it (the haze)
  var glowC = {};
  function glowSprite(r, k) {
    var key = r + ':' + k; if (glowC[key]) return glowC[key];
    var n = r * 2 + 1, c = A.makeCanvas(n, n), g = c.getContext('2d'), im = g.createImageData(n, n), d = im.data;
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      var dd = Math.hypot(x - r, y - r) / r; if (dd >= 1) continue;
      var q = Math.floor(Math.pow(1 - dd, 1.6) * k * 5 + A.bayer(x, y) * 0.999) / 5; if (q <= 0) continue;
      var o = (y * n + x) * 4; d[o] = 255 * q * 0.42; d[o + 1] = 170 * q * 0.42; d[o + 2] = 70 * q * 0.42; d[o + 3] = 255;
    }
    g.putImageData(im, 0, 0);
    return (glowC[key] = c);
  }
  // his knuckle prints on the inside of the glass: each knock a little row
  // of four in a shallow arc, greasy, catching the light (the way prints on a
  // window do), with a speck or two of coal dust in them. They stay the visit
  function drawMarks(g, marks) {
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], x = m.x, y = m.y;
      // the haze of the print
      for (var yy = -3; yy <= 3; yy++) for (var xx = -6; xx <= 6; xx++) {
        var q = (xx * xx) / 36 + (yy * yy) / 9; if (q >= 1) continue;
        var X = Math.round(x) + xx, Y = Math.round(y) + yy;
        if (A.bayer(X + 1, Y) < (1 - q) * 0.5) { g.fillStyle = 'rgba(214,204,186,0.1)'; g.fillRect(X, Y, 1, 1); }
      }
      // the four knuckles
      for (var k = 0; k < 4; k++) {
        var kx = Math.round(x - 4 + k * 2.7 + (A.hash01(m.seed, k, 1) - 0.5)), ky = Math.round(y - 1 + Math.abs(k - 1.5) * 0.7 + (A.hash01(m.seed, k, 2) - 0.5));
        g.fillStyle = 'rgba(226,216,198,0.42)'; g.fillRect(kx, ky, 2, 1);
        g.fillStyle = 'rgba(226,216,198,0.16)'; g.fillRect(kx, ky + 1, 2, 1);
        if (A.hash01(m.seed, k, 3) < 0.45) { g.fillStyle = 'rgba(16,12,16,0.55)'; g.fillRect(kx + (A.hash01(m.seed, k, 4) < 0.5 ? 0 : 1), ky, 1, 1); }
      }
    }
  }
  // coal dust knocked off his knuckles, drifting down inside the glass (on the shutter)
  function drawDust(g, marks, t) {
    for (var i = 0; i < marks.length; i++) {
      var m = marks[i], a = t - m.t0; if (a < 0 || a > 0.9 || m.t0 == null) continue;
      var fa = Math.floor(a * 8) / 8;
      for (var j = 0; j < 5; j++) {
        var vx = (A.hash01(m.seed, j, 5) - 0.5) * 14, vy = 6 + A.hash01(m.seed, j, 6) * 16;
        var x = Math.round(m.x + vx * fa), y = Math.round(m.y + 1 + vy * fa + 20 * fa * fa);
        g.fillStyle = a < 0.45 ? 'rgba(40,34,40,0.8)' : 'rgba(40,34,40,0.45)';
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  /* ══ THE PAINTED MOON (EGGS.md #2) ═══════════════════════════════
   * A cut-out on a nail near its top edge. When it swings, the board behind
   * it shows: the painters painted the sky round it and left the moon's
   * place in primer, with the pencil line they drew it by. */
  var MOON_R = 8;
  function drawMoon(g, mo) {
    var a = mo.a; if (!(Math.abs(a) >= 0.01)) return;
    var mx = Math.round(mo.x), my = Math.round(mo.y), E = S.ellipse, px = S.px;
    E(g, mx, my, MOON_R, MOON_R, '#8e8470'); E(g, mx, my, MOON_R - 1, MOON_R - 1, '#a89e86');
    for (var i = 0; i < 40; i++) { var q = i / 40 * Math.PI * 2; if (i % 9 === 4) continue; px(g, Math.round(mx + Math.cos(q) * (MOON_R - 0.4)), Math.round(my + Math.sin(q) * (MOON_R - 0.4)), '#6e6656'); }
    px(g, mx - 1, my - 5, '#6e6656'); px(g, mx + 1, my - 5, '#6e6656'); px(g, mx, my - 6, '#6e6656'); px(g, mx, my - 4, '#6e6656');   // where the nail goes, marked
    // the disc, turned about the nail
    var nx = mx, ny = my - 5, ca = Math.cos(a), sa = Math.sin(a);
    var cx = Math.round(nx + sa * 5), cy = Math.round(ny + ca * 5);
    function R(dx, dy) { return [Math.round(cx + dx * ca + dy * sa), Math.round(cy - dx * sa + dy * ca)]; }
    E(g, cx + 1, cy + 1, MOON_R, MOON_R, 'rgba(10,6,22,0.55)');             // a card's thickness off the board
    E(g, cx, cy, MOON_R, MOON_R, '#fff6d4'); E(g, cx, cy, MOON_R - 1, MOON_R - 1, P.MOONP);
    var sh = R(1, 1); E(g, sh[0], sh[1], 6, 6, '#eedc9e');
    var c1 = R(-3, -2), c2 = R(3, 3), c3 = R(4, -4);
    E(g, c1[0], c1[1], 2, 2, '#e2cc8a'); E(g, c2[0], c2[1], 2, 1, '#e2cc8a'); px(g, c3[0], c3[1], '#e2cc8a');
    px(g, nx, ny, P.BRASS4); px(g, nx + 1, ny + 1, P.BRASS1);                     // the nail
  }

  /* ══ THE FORTUNE FISH (Fig. 12; EGGS.md #4) ═══════════════════════
   * The red cellophane fish, curled at both ends. Hold a finger on the glass
   * over it and it warms: it quivers, lies out stiff as a needle, and swings
   * round like one, to point out of the case and down the hall, where the
   * one machine is still lit. It tells no fortune. When the warmth goes it
   * curls again where it lies, and later it's as it was. */
  var FISHC = { F: P.FISH, f: P.FISH2, d: P.FISH_D, e: P.INK, s: '#ffd0d0' };
  var FISH_REST = ['..........F', 'f...s....F.', 'Fe.FFfF..dF', '.FfddddFfd.', '.dd....dd..'];
  var FISH_Q1 = ['...........', 'f...s......', 'Fe.FFfFFfdF', '.FfdddddddF', '.dd.....d..'];
  var FISH_Q2 = ['..........F', 'Ff..s....F.', '.eFFFfF..dF', '.FfddddFfd.', '.dd....dd..'];
  function fishRows(g, rows, x, y) {
    for (var j = 0; j < rows.length; j++) for (var i = 0; i < rows[j].length; i++) { var c = FISHC[rows[j][i]]; if (c) S.px(g, x - 1 + i, y - 3 + j, c); }
  }
  // stiff as a needle, its head along phi (degrees; 0 right, 90 up), curled: its ends lift
  function fishNeedle(g, cx, cy, phi, curled) {
    var a = phi * D2R, dx = Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;   // n: the underside
    if (ny < 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }
    for (var sd = -5; sd <= 5; sd++) {
      var lift = curled && (sd >= 4 || sd <= -4) ? -1 : 0;
      var x = Math.round(cx + dx * sd + nx * lift), y = Math.round(cy + dy * sd + ny * lift);
      S.px(g, x, y, sd % 3 === 1 ? P.FISH2 : P.FISH);
      if (sd > -4 && sd < 5) S.px(g, Math.round(x + nx), Math.round(y + ny), P.FISH_D);
    }
    // the head (a pixel thicker) and its eye; the forked tail; the cellophane's shine
    var hx = cx + dx * 5, hy = cy + dy * 5 + (curled ? -ny : 0);
    S.px(g, Math.round(hx + dx - nx * 0), Math.round(hy + dy), P.FISH);
    S.px(g, Math.round(cx + dx * 4 - nx), Math.round(cy + dy * 4 - ny + (curled ? -1 : 0)), P.INK);
    S.px(g, Math.round(cx - dx * 6 - nx), Math.round(cy - dy * 6 - ny + (curled ? -1 : 0)), P.FISH);
    S.px(g, Math.round(cx - dx * 6 + nx), Math.round(cy - dy * 6 + ny + (curled ? -1 : 0)), P.FISH);
    S.px(g, Math.round(cx + dx * 1 - nx), Math.round(cy + dy * 1 - ny), '#ffd0d0');
  }
  var FISH_AT = { x: 188, y: 289 }, FISH_MID = { x: 190, y: 288 }, FISH_POINT = 15;
  function drawFish(g, f, t) {
    if (!f) { fishRows(g, FISH_REST, FISH_AT.x, FISH_AT.y); return; }
    var fr = Math.floor((t - f.t0) * 8);
    if (f.rel != null && t - f.rel > 1.0) { fishNeedle(g, FISH_MID.x, FISH_MID.y, FISH_POINT, true); return; }
    if (fr < 4) { fishRows(g, fr % 2 ? FISH_Q2 : FISH_Q1, FISH_AT.x, FISH_AT.y); return; }
    var SW = [180, 180, 135, 90, 55, 25];
    var phi = fr - 4 < SW.length ? SW[fr - 4] : FISH_POINT + ((fr >> 3) % 5 === 2 ? 3 : 0);
    fishNeedle(g, FISH_MID.x, FISH_MID.y, phi, false);
  }

  /* ══ THE BACK OF THE CARD (EGGS.md #5) ════════════════════════════
   * The legend card is cut from something that was a child's drawing
   * first. Lit from behind (the lantern man reading it; a marble going down
   * the old drift behind it), the crayon shows through, the wrong way
   * round: a big figure with a light on his cap, holding a small one's
   * hand, and a sun. Nobody says whose. */
  var CRAYON = null;
  function crayonStrokes() {
    if (CRAYON) return CRAYON;
    var st = [];
    function pl(pts, c) { st.push({ pts: pts, c: c }); }
    function circ(cx, cy, r, c, n) { var p = []; for (var i = 0; i <= (n || 14); i++) { var q = i / (n || 14) * Math.PI * 2 + 0.4; p.push([cx + Math.cos(q) * r, cy + Math.sin(q) * r * 1.08]); } pl(p, c); }
    var K = 'k', Y = 'y', R = 'r', G = 'g';
    // the ground, pressed hard, twice
    pl([[10, 71], [24, 70], [40, 71], [58, 69], [76, 70]], G); pl([[12, 72], [30, 72], [52, 71], [74, 72]], G);
    // him: a big round head, a cap, the lamp on it (rays), stick body, arms out
    circ(30, 30, 4.2, K); pl([[25, 26], [27, 24], [30, 23], [33, 24], [35, 26]], K); pl([[25, 27], [35, 27]], K);
    pl([[30, 22], [30, 17]], Y); pl([[30, 22], [26, 18]], Y); pl([[30, 22], [34, 18]], Y); pl([[30, 22], [24, 21]], Y); pl([[30, 22], [36, 21]], Y);
    pl([[30, 34], [30, 51]], K); pl([[30, 39], [21, 45]], K); pl([[30, 39], [41, 44]], K);
    pl([[30, 51], [25, 63], [23, 63]], K); pl([[30, 51], [35, 63], [37, 63]], K);
    // the small one, holding his hand
    circ(47, 43, 3, K); pl([[47, 46], [47, 56]], K); pl([[47, 49], [41, 44]], K); pl([[47, 49], [53, 53]], K);
    pl([[47, 56], [44, 64]], K); pl([[47, 56], [50, 64]], K);
    pl([[46, 42], [46, 42]], K); pl([[48, 42], [48, 42]], K); pl([[46, 44.5], [48, 44.5]], R);   // a face on this one
    // a sun in the corner, coloured in hard
    circ(69, 14, 5, Y, 16); for (var r = 1; r < 5; r++) circ(69, 14, r, Y, 10);
    for (var k = 0; k < 8; k++) { var q = k / 8 * Math.PI * 2; pl([[69 + Math.cos(q) * 7, 14 + Math.sin(q) * 7], [69 + Math.cos(q) * 10, 14 + Math.sin(q) * 10]], Y); }
    return (CRAYON = st);
  }
  var CRAYON_C = { k: [40, 22, 30], y: [214, 110, 10], r: [170, 34, 30], g: [60, 84, 26] };
  function drawCrayon(g, cl) {
    var L = A.CAB && A.CAB.legend; if (!L || !cl) return;
    var lx = cl.x + A.CAB.GX, ly = cl.y + A.CAB.GY, r = (cl.r || 34) * 1.05, k = Math.max(0, Math.min(1, cl.k == null ? 1 : cl.k)), seen = {};
    crayonStrokes().forEach(function (stk, si) {
      var col = CRAYON_C[stk.c];
      for (var i = 0; i < stk.pts.length - 1; i++) {
        var a = stk.pts[i], b = stk.pts[i + 1], n = Math.max(1, Math.ceil(Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]))));
        for (var j = 0; j <= n; j++) {
          var cx = a[0] + (b[0] - a[0]) * j / n, cy = a[1] + (b[1] - a[1]) * j / n;
          // (seen through the paper from the front: the wrong way round)
          // a child pressing hard: a crayon's width is two pixels here
          for (var w2 = 0; w2 < 4; w2++) {
            var X = Math.round(L.x + L.w - 1 - cx) + (w2 & 1), Y = Math.round(L.y + cy) + (w2 >> 1), key = X + ',' + Y;
            if (seen[key] || X <= L.x || X >= L.x + L.w - 1 || Y <= L.y || Y >= L.y + L.h - 1) continue;
            seen[key] = 1;
            if (A.hash01(si * 131 + i, X, Y) < (w2 ? 0.45 : 0.12)) continue;       // the wax skips on the paper's tooth
            var d = Math.hypot(X - lx, Y - ly) / r; if (d >= 1) continue;
            var al = Math.min(0.85, Math.pow(1 - d, 0.55) * 0.95 * k);
            g.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + al.toFixed(2) + ')';
            g.fillRect(X, Y, 1, 1);
          }
        }
      }
    });
  }

  /* ══ FOR SCALE (EGGS.md #7) ═══════════════════════════════════════
   * The thirteenth game on this machine: someone has pencilled a second
   * little man beside the one for scale, and corrected the note. */
  function drawForScale(g) {
    var L = A.CAB && A.CAB.legend; if (!L) return;
    var pk = A.paperK != null ? A.paperK : 0.78, c = 'rgba(' + Math.round(96 * pk) + ',' + Math.round(96 * pk) + ',' + Math.round(112 * pk) + ',0.95)';
    var x = L.x, sy = L.y + L.h - 5;
    g.fillStyle = c;
    g.fillRect(x + 47, sy - 2, 1, 3);                                    // the second man, in pencil
    g.fillRect(x + 59, sy - 2, 5, 1);                                    // MAN struck through at the A…
    A.text(g, 'E', x + 60, sy - 10, c);                                  // …and E above it: MEN
  }

  /* ══ WAVE AT THE TRAIN (EGGS.md #8) ═══════════════════════════════
   * The little train painted on the middle ridge, going left. Tap it (the
   * way you'd wave at one from a porch) and its headlamp blinks twice with
   * two short puffs of steam: two short toots, the railroad's "acknowledged". */
  function ridgeY(base, amp, seed, ph, x) {
    return Math.round(base - amp * (3 * Math.sin(x * 0.021 + ph) + 1.6 * Math.sin(x * 0.057 + ph * 2) + 0.8 * Math.sin(x * 0.13 + seed)));
  }
  var ENGINE = { x: 176, y: ridgeY(53, 1.0, 2, 1.7, 179) - 3 };
  function drawTrain(g, tr, t) {
    var u = t - tr.t0, hx = ENGINE.x - 1, hy = ENGINE.y + 1;
    [0.7, 1.1].forEach(function (at, i) {
      var v = u - at; if (v < 0 || v > 0.9) return;
      // the headlamp blinks
      if (v < 0.2) {
        S.px(g, hx, hy, '#ffffff'); S.px(g, hx - 1, hy, P.FLAME2); S.px(g, hx, hy - 1, 'rgba(255,246,208,0.7)'); S.px(g, hx, hy + 1, 'rgba(255,246,208,0.7)');
        S.px(g, hx - 2, hy, 'rgba(255,220,140,0.45)'); S.px(g, hx - 3, hy, 'rgba(255,220,140,0.25)');
      }
      // a short puff of white out of the stack, drifting back along the train
      var f = Math.floor(v * 8), sx = ENGINE.x + 2 + f, sy = ENGINE.y - 4 - Math.min(2, f >> 1), rr = 1 + (f > 2 ? 1 : 0);
      for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) if (dx * dx + dy * dy <= rr * rr + 0.5 && A.bayer(sx + dx, sy + dy) < 0.9 - f * 0.1) S.px(g, sx + dx, sy + dy, 'rgba(236,232,240,0.8)');
    });
  }

  /* ══ the layers ═══════════════════════════════════════════════════ */
  A.drawSecrets = function (g, view, layer) {
    var fx = view.fx || {}, gk = fx.glassKnock;
    var eg = view.eggs || {};
    if (layer === 'under') {
      if (fx.moon) drawMoon(g, fx.moon);
      drawFish(g, eg.fortuneFish === false ? null : fx.fish, view.t || 0);
    } else if (layer === 'albedo') {
      if (gk) drawCloseShadow(g, gk);
    } else if (layer === 'glass') {
      if (gk) {
        // the patch of floor he stands on, in front of the section, in shade
        var fw = Math.round(3.6 * gk.s), fx0 = Math.round(gk.x), fy0 = Math.round(gk.y);
        for (var yy = -1; yy <= Math.max(1, Math.round(gk.s * 0.5)); yy++) for (var xx = -fw; xx <= fw; xx++) {
          var q = (xx * xx) / (fw * fw) + (yy * yy) / Math.max(1, gk.s * gk.s * 0.36);
          if (q < 1 && A.bayer(fx0 + xx, fy0 + yy) < (1 - q) * 0.75) { g.fillStyle = 'rgba(4,3,8,0.5)'; g.fillRect(fx0 + xx, fy0 + yy, 1, 1); }
        }
        drawCloseKnocker(g, gk);
        if (gk.lantern && gk.view === 'front') {
          var r = Math.round(10 + 6 * gk.s), sp = glowSprite(r, Math.round((0.55 + 0.45 * (gk.lamp || 0)) * 10) / 10);
          g.save(); g.globalCompositeOperation = 'lighter'; g.drawImage(sp, Math.round(gk.lantern.x) - r, Math.round(gk.lantern.y) - r); g.restore();
        }
      }
      if (fx.glassMarks) { drawMarks(g, fx.glassMarks); drawDust(g, fx.glassMarks, view.t || 0); }
      if (fx.train) drawTrain(g, fx.train, view.t || 0);
    } else if (layer === 'cabinet') {
      if (eg.crayon !== false && fx.cardLamp) drawCrayon(g, fx.cardLamp);
      if (eg.forScale && view.ui && view.ui.gamesEver >= 13) drawForScale(g);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

/* MOTHER LODE — the tommyknockers (painted figurines)
 *
 * Jointed wooden toys of little old miners, ~28–31 px tall: a big turned
 * head (peg-doll proportions), a soft cap with a carbide lamp on the front
 * (its flame is each knocker's signature pixel), a grey or white beard in
 * one confident stroke of paint, a stooped back, a leather apron, arms a
 * little too long (the hands hang at the knee), short legs, boots. Dull
 * earth-colour paint gone soft with handling; a varnish glint on the head
 * and down the barrel of the body; pale wooden pegs at shoulder and hip.
 * They are models. They should not be able to do what they do.
 *
 * drawFigure(g, fig) draws one into a context in board space:
 *   fig = { x, y,            // feet on the ground at (x, y)
 *           facing: 1 | -1,  // which way the painted face looks
 *           who,             // 'tall' | 'lamp' | 'pick' | 'old' | 'little' | 'tally'
 *           pose: { lean, head, armL, armR, legL, legR, toolA },   // radians
 *           tool,            // 'pick' | 'shovel' | 'mallet' | 'lantern' | 'spike' |
 *                            // 'timber' | 'tally' | 'cane' | 'marble' | 'coil' |
 *                            // 'oilcan' | 'pail' | null          (the right hand)
 *           tool2,           // 'pencil' | 'bread' | 'cap' | 'rag' | null (the left hand)
 *           lamp,            // the cap lamp is lit (default true)
 *           lampK,           // 0..1 how bright it burns (under 0.35: guttering)
 *           shadow,          // cast a shadow on the rock behind (default true)
 *           back,            // seen from behind (on a ladder): no face, the
 *                            // apron's bow, both arms up; pose.armL/armR then
 *                            // measure outward from straight down, and
 *                            // fig.liftL/liftR raise a boot onto a higher rung
 *           rot,             // degrees: ±90 = knocked over flat, a dropped toy
 *           capOff,          // the cap is off (in the left hand: tool2 'cap')
 *           tallyN,          // the tally card's marks (the tallyman's count)
 *           hold }           // optional {x, y, id}: a carried thing's centre (the marble)
 * Angles: arms and legs measure from straight down, positive swings
 * toward `facing`; lean tips the body about the hips (positive = forward,
 * added to each knocker's own stoop); head nods (positive = down).
 * Quantise angles to ~15° when animating and hold poses (~8 fps): they
 * move like stop-motion toys, pose to pose.
 *
 * Sprites are cached by everything that shapes them (who, facing, pose to the
 * degree, tool, lamp, back, cap), so a posed knocker costs one blit a frame.
 *
 * figureLamp(fig) → {x, y} the lamp flame (for the lightmap);
 * figureHands(fig) → {l, r} hand positions; figureShoulders(fig) → {l, r};
 * CREW: the six individuals. drawProps(g, view, layer): the knockers' kit
 * (view.props: ladders, rope ladders, their little doors, pins in hand, the
 * lunch pail, dust, the glow of a lamp moving behind the rock).
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, thick = A.thick, disc = A.disc;
  var d2r = Math.PI / 180;

  // six old men, six silhouettes
  var CREW = {
    // Absalom: the tall thin one, a grey beard to the belt, a brown coat,
    // a stovepipe of a cap that has lost its shape
    tall: { name: 'Absalom', leg: 10, torso: 11, width: 7, arm: 14, stoop: 14, head: 3.8,
      coat: '#5a4632', coat2: '#766046', trousers: '#2e2620', cap: 'tallsoft', capC: '#3a3028', capC2: '#524436',
      beard: 'belt', beardC: '#d8d4c8', beardD: '#9a9484', apron: true },
    // Tobias: short, carries the big lantern, a ginger beard gone to salt, faded denim
    lamp: { name: 'Tobias', leg: 8, torso: 10, width: 8, arm: 13, stoop: 10, head: 4,
      coat: '#3e4a58', coat2: '#56657a', trousers: '#2a2a30', cap: 'soft', capC: '#4a4a50', capC2: '#62626a',
      beard: 'belt', beardC: '#e0d0b8', beardD: '#b08a64', apron: true },
    // Ezra: broad as a door, a charcoal coat, the grey spade beard, the pick
    pick: { name: 'Ezra', leg: 8, torso: 10, width: 11, arm: 13, stoop: 14, head: 4,
      coat: '#34322e', coat2: '#4c4840', trousers: '#262420', cap: 'soft', capC: '#26221e', capC2: '#3a342c',
      beard: 'spade', beardC: '#b4b0a6', beardD: '#7a766c', apron: true },
    // the old one: bent nearly double, a white beard to the knees, a cane
    old: { name: 'Old Jory', leg: 7, torso: 10, width: 8, arm: 13, stoop: 28, head: 4,
      coat: '#4a4438', coat2: '#625a4a', trousers: '#2a2622', cap: 'skull', capC: '#5a3a24', capC2: '#7a5232',
      beard: 'knees', beardC: '#f4f0e6', beardD: '#b8b2a2', apron: false, patch: true },
    // the little one: short and round, a big nose, a white walrus moustache,
    // a rust-brown coat, a shovel twice his size
    little: { name: 'Pip', leg: 6, torso: 9, width: 10, arm: 12, stoop: 8, head: 4,
      coat: '#6a3e26', coat2: '#8a5634', trousers: '#2e2420', cap: 'soft', capC: '#3a3a2e', capC2: '#52523e',
      beard: 'walrus', beardC: '#e6e2d8', beardD: '#aaa498', apron: true, nose: true },
    // the tallyman: spectacles, a white goatee, olive-grey coat, a pencil behind the ear
    tally: { name: 'Mr. Pengelly', leg: 9, torso: 10, width: 7, arm: 13, stoop: 18, head: 3.8,
      coat: '#5a5048', coat2: '#766a5e', trousers: '#2e2a26', cap: 'flat', capC: '#6a5e4c', capC2: '#827460',
      beard: 'goatee', beardC: '#dcd8cc', beardD: '#a09a8c', apron: false, specs: true }
  };
  A.CREW = CREW;

  var OUT = '#0a080c';   // the outline: every figure keeps one readable silhouette
  var PEG = '#d8bc8a', PEG_D = '#a88a5a', GLOSS = '#fff4e0';
  var APRON = '#4e2e1c', APRON2 = '#6e4428';

  function rot(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }
  function limbEnd(o, a, len) { return [o[0] + Math.sin(a) * len, o[1] + Math.cos(a) * len]; }

  // the rig's joints in local space (facing +1, feet at 0,0)
  function rig(fig) {
    var c = CREW[fig.who] || CREW.pick, p = fig.pose || {};
    var lean = (p.lean || 0) + c.stoop * d2r, hipY = -c.leg - 1;
    function body(x, y) { var r = rot(x, y - hipY, lean); return [r[0], r[1] + hipY]; }
    var hw = Math.floor(c.width / 2);
    var neck = body(0, hipY - c.torso);
    var shL = body(-hw + 1, hipY - c.torso + 2), shR = body(hw - 1, hipY - c.torso + 2);
    var headA = lean * 0.6 + (p.head || 0);   // old necks don't follow the back all the way
    var hr = c.head;
    var headC = [neck[0] + Math.sin(headA) * hr, neck[1] - Math.cos(headA) * hr];
    return { c: c, p: p, lean: lean, hip: [0, hipY], neck: neck, shL: shL, shR: shR, headC: headC, headA: headA, body: body, hipY: hipY };
  }
  function armAngle(R, a) { return a + R.lean * 0.25; }
  // the back view's rig: upright (the stoop drops the head between the shoulders)
  function rigBack(fig) {
    var c = CREW[fig.who] || CREW.pick, p = fig.pose || {};
    var hw = c.width / 2, hy = -c.leg - 1, ty = hy - c.torso, drop = Math.round(c.stoop / 12);
    var shL = [-hw + 1, ty + 2], shR = [hw - 1, ty + 2];
    var aL = p.armL || 0, aR = p.armR || 0;
    return { c: c, p: p, hw: hw, hy: hy, ty: ty, shL: shL, shR: shR, aL: aL, aR: aR,
      handL: [shL[0] - Math.sin(aL) * c.arm, shL[1] + Math.cos(aL) * c.arm],
      handR: [shR[0] + Math.sin(aR) * c.arm, shR[1] + Math.cos(aR) * c.arm],
      headC: [0, ty - c.head + 1 + drop] };
  }

  /* ── the sprite cache ─────────────────────────────────────────────── */
  var SZ = 72, O = 36, OY = 54;
  var cache = {}, cacheN = 0, FKEYS = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function deg(v) { return Math.round((v || 0) / d2r); }
  function keyOf(fig) {
    var p = fig.pose || {};
    return (fig.who || 'pick') + (fig.facing < 0 ? '-' : '+') + (fig.back ? 'B' : '') + '|' + (fig.tool || '') + '|' + (fig.tool2 || '') + '|' +
      (fig.lamp === false ? 0 : (fig.lampK != null && fig.lampK < 0.35 ? 1 : 2)) + (fig.capOff ? 'c' : '') + '|' +
      (fig.tool === 'tally' ? (fig.tallyN | 0) + 'n' + (fig.nearly | 0) : '') + '|' + deg(p.lean) + ',' + deg(p.head) + ',' + deg(p.armL) + ',' + deg(p.armR) + ',' +
      deg(p.legL) + ',' + deg(p.legR) + ',' + deg(p.toolA) + (fig.back ? ',' + (fig.liftL | 0) + ',' + (fig.liftR | 0) : '');
  }
  function sprite(fig) {
    // (a figure object lives for one frame and is asked for several times:
    // key it once. A WeakMap, not a property: copies of a figure with a new
    // pose must never inherit the old key)
    var key = FKEYS ? FKEYS.get(fig) : undefined;
    if (key === undefined) { key = keyOf(fig); if (FKEYS) FKEYS.set(fig, key); }
    var e = cache[key];
    if (e) return e;
    if (cacheN > 900) { cache = {}; cacheN = 0; }
    var spr = A.makeCanvas(SZ, SZ), s = spr.getContext('2d');
    paint(s, fig);
    outline(spr, SZ);
    // the cast shadow's silhouette (drawn at 42 % onto the rock)
    var shd = A.makeCanvas(SZ, SZ), h = shd.getContext('2d');
    h.drawImage(spr, 0, 0);
    h.globalCompositeOperation = 'source-in'; h.fillStyle = '#000000'; h.fillRect(0, 0, SZ, SZ);
    e = cache[key] = { spr: spr, shd: shd };
    cacheN++;
    return e;
  }
  A.figureCacheSize = function () { return cacheN; };
  // the figure's silhouette canvas (72 × 72, feet at 36, 54): a shadow puppet
  // thin: without the outline (a shadow thrown through paper has no ink line)
  A.figureSilhouette = function (fig, thin) {
    var e = sprite(fig);
    if (!thin) return e.shd;
    if (!e.thin) {
      var c = A.makeCanvas(SZ, SZ), g = c.getContext('2d');
      var im = e.spr.getContext('2d').getImageData(0, 0, SZ, SZ), d = im.data, o = A.rgb(OUT);
      for (var i = 0; i < d.length; i += 4) {
        if (d[i + 3] && !(d[i] === o[0] && d[i + 1] === o[1] && d[i + 2] === o[2])) { d[i] = 58; d[i + 1] = 34; d[i + 2] = 16; d[i + 3] = 255; }
        else d[i + 3] = 0;
      }
      g.putImageData(im, 0, 0);
      e.thin = c;
    }
    return e.thin;
  };

  // drawFigure(g, fig): the shadow and the toy together, unlit (the old
  // single pass). The renderer uses the two halves: the shadow goes on the
  // rock before the light (the lamps decide how dark it is), the toy after
  // it, painted in ONE flat colour of light (a model is lit as a whole: no
  // dither of a lamp's pool across his face)
  function drawFigure(g, fig) { drawFigureShadow(g, fig); drawFigureBody(g, fig, null); }
  function drawFigureShadow(g, fig) {
    if (fig.shadow === false) return;
    var e = sprite(fig);
    var fx = Math.round(fig.x), fy = Math.round(fig.y);
    g.save();
    if (fig.rot) {
      var r = fig.rot > 0 ? 1 : -1;
      g.translate(fx, fy - 4); g.rotate(r * Math.PI / 2);
      g.globalAlpha = 0.42; g.drawImage(e.shd, -O + 2 * r, -OY - 3);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 0.5; g.fillStyle = '#000'; g.fillRect(fx - (r > 0 ? 2 : 24), fy, 26, 1);
      g.restore();
      return;
    }
    // the cast shadow: a toy stood a little way in front of the painted
    // rock throws its silhouette onto it, down and to the right
    g.globalAlpha = 0.42; g.drawImage(e.shd, fx - O + 3, fy - OY + 2);
    // and the dark patch it stands in
    g.globalAlpha = 0.5; g.fillStyle = '#000';
    g.fillRect(fx - 5, fy, 11, 1); g.fillRect(fx - 3, fy + 1, 7, 1);
    g.restore();
  }
  var tintC = null, tintG = null;
  function drawFigureBody(g, fig, tint) {
    var e = sprite(fig), spr = e.spr;
    if (tint) {
      if (!tintC) { tintC = A.makeCanvas(SZ, SZ); tintG = tintC.getContext('2d'); }
      tintG.globalCompositeOperation = 'copy'; tintG.drawImage(spr, 0, 0);
      tintG.globalCompositeOperation = 'multiply'; tintG.fillStyle = tint; tintG.fillRect(0, 0, SZ, SZ);
      tintG.globalCompositeOperation = 'destination-in'; tintG.drawImage(spr, 0, 0);
      tintG.globalCompositeOperation = 'source-over';
      spr = tintC;
    }
    var fx = Math.round(fig.x), fy = Math.round(fig.y);
    if (fig.rot) {
      // knocked over: the toy lies stiff on its side, its back to the floor
      var r = fig.rot > 0 ? 1 : -1;
      g.save(); g.translate(fx, fy - 4); g.rotate(r * Math.PI / 2);
      g.drawImage(spr, -O, -OY);
      g.restore();
      return;
    }
    g.drawImage(spr, fx - O, fy - OY);
  }

  /* ── painting one pose into a 72 × 72 sprite (feet at 36, 54) ────── */
  function paint(s, fig) {
    var f = fig.facing < 0 ? -1 : 1;
    var X = function (v) { return O + v[0] * f; }, Y = function (v) { return OY + v[1]; };
    function L(a, b, w, col) { thick(s, X(a), Y(a), X(b), Y(b), w, col); }
    function D(v, r, col) { disc(s, X(v) + 0.5, Y(v) + 0.5, r, col); }
    function P1(v, col) { px(s, Math.round(X(v)), Math.round(Y(v)), col); }
    // fill a polygon given in local space (tested at pixel centres: crisp, no holes)
    function F(pts, col) {
      var q = pts.map(function (v) { return [X(v), Y(v)]; });
      var x0 = Math.floor(Math.min.apply(null, q.map(function (v) { return v[0]; }))), x1 = Math.ceil(Math.max.apply(null, q.map(function (v) { return v[0]; })));
      var y0 = Math.floor(Math.min.apply(null, q.map(function (v) { return v[1]; }))), y1 = Math.ceil(Math.max.apply(null, q.map(function (v) { return v[1]; })));
      s.fillStyle = col;
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        var cx = xx + 0.5, cy = yy + 0.5, inside = false;
        for (var i = 0, j = q.length - 1; i < q.length; j = i++)
          if ((q[i][1] > cy) !== (q[j][1] > cy) && cx < (q[j][0] - q[i][0]) * (cy - q[i][1]) / (q[j][1] - q[i][1]) + q[i][0]) inside = !inside;
        if (inside) s.fillRect(xx, yy, 1, 1);
      }
    }
    var ctx = { s: s, f: f, X: X, Y: Y, L: L, D: D, P1: P1, F: F, fig: fig };
    if (fig.back) paintBack(ctx); else paintSide(ctx);
  }

  function paintSide(K) {
    var fig = K.fig, R = rig(fig), c = R.c, p = R.p, L = K.L, D = K.D, P1 = K.P1, F = K.F;
    var legL = p.legL || 0, legR = p.legR || 0;
    var hipL = [-2, R.hipY], hipR = [2, R.hipY];
    var footL = limbEnd(hipL, legL, c.leg), footR = limbEnd(hipR, legR, c.leg);
    var aL = armAngle(R, p.armL || 0), aR = armAngle(R, p.armR || 0);
    var handL = limbEnd(R.shL, aL, c.arm), handR = limbEnd(R.shR, aR, c.arm);

    // the far arm, behind everything (and what it holds)
    tool2(K, c, fig.tool2, handL, true);
    arm(R.shL, handL, true);
    // legs: stubby turned pegs, boots
    L(hipL, footL, 3, c.trousers); L(hipR, footR, 3, c.trousers);
    boot(footL); boot(footR);
    // the body: a turned barrel, wider at the belly, shoulders rounded off
    var hw = c.width / 2, hy = R.hipY, ty = R.hipY - c.torso, B = R.body;
    F([B(-hw + 1, hy + 1), B(hw - 1, hy + 1), B(hw + 0.5, hy - c.torso * 0.45), B(hw - 1, ty + 1), B(hw - 2.5, ty - 0.5),
      B(-hw + 2.5, ty - 0.5), B(-hw + 1, ty + 1), B(-hw - 0.5, hy - c.torso * 0.45)], c.coat);
    // the lit side of the barrel, and one catch of varnish
    L(B(-hw + 0.5, hy - 1), B(-hw + 0.5, ty + 2), 1, c.coat2);
    P1(B(-hw + 1.5, ty + 3), GLOSS);
    if (c.patch) F([B(-1.5, hy - 3), B(1.5, hy - 3), B(1.5, hy - 6), B(-1.5, hy - 6)], '#5e5440');   // a patch, sewn on square
    // the leather apron: from the chest to the knees, a strap round the neck
    if (c.apron) {
      var aw = hw - 1.5;
      F([B(-aw, hy + 4), B(aw, hy + 4), B(aw, ty + 4), B(-aw + 1, ty + 4)], APRON);
      L(B(-aw, ty + 4), B(aw - 1, ty + 4), 1, APRON2);
      L(B(-aw + 1, ty + 4), B(-1, ty + 1), 1, APRON2);
      P1(B(aw - 1, hy + 3), '#3a2012');
    } else {
      L(B(-hw, hy - 2), B(hw, hy - 2), 1, '#1a1410');       // a belt
      P1(B(0, hy - 2), P.BRASS3);
    }
    // a chip of paint off the coat's shoulder: bare linden underneath
    P1(R.body(hw - 2, R.hipY - c.torso + 3), PEG);
    // hip pegs
    P1(hipL, PEG_D); P1(hipR, PEG);
    // the head and all its paint
    head();
    // the near arm and the tool
    tool(K, c, fig.tool, handR, aR + (p.toolA || 0));
    arm(R.shR, handR, false);

    function arm(shp, hand, far) {
      L(shp, hand, 2, far ? c.coat : c.coat2);
      if (!far) L(shp, [shp[0] + (hand[0] - shp[0]) * 0.5, shp[1] + (hand[1] - shp[1]) * 0.5], 1, c.coat);
      D(hand, 1.3, far ? P.FACE_D : P.FACE);               // a mitten of a hand
      P1(shp, far ? PEG_D : PEG);                         // the shoulder peg
    }
    function boot(ft) {
      L([ft[0] - 1, ft[1]], [ft[0] + 2, ft[1]], 2, P.BOOT);
      P1([ft[0] + 2, ft[1] - 1], '#3a3440');
    }
    function head() {
      var hc = R.headC, r = c.head, fx = 1;
      D(hc, r, P.FACE);
      // turned-wood shading: the back of the head in shadow, a varnish glint up top
      P1([hc[0] - r + 1, hc[1]], P.FACE_D); P1([hc[0] - r + 1, hc[1] + 1], P.FACE_D); P1([hc[0] - r + 2, hc[1] + 2], P.FACE_D);
      // eyes: two dots of black paint, set a little too wide and a little too high
      P1([hc[0] + fx - 1, hc[1] - 1], P.INK); P1([hc[0] + fx + 2, hc[1] - 1], P.INK);
      if (c.specs) {
        P1([hc[0] + fx - 2, hc[1] - 1], '#c8d0d8'); P1([hc[0] + fx + 3, hc[1] - 1], '#c8d0d8'); P1([hc[0] + fx, hc[1] - 1], '#8a8a96'); P1([hc[0] + fx + 1, hc[1] - 1], '#8a8a96');
      }
      // brows: the old men are all frown and eyebrow
      P1([hc[0] + fx - 1, hc[1] - 2], c.beardD); P1([hc[0] + fx + 2, hc[1] - 2], c.beardD); P1([hc[0] + fx + 3, hc[1] - 2], c.beardD);
      // a rosy cheek, a nose
      P1([hc[0] + fx + 3, hc[1]], P.CHEEK);
      if (c.nose) { P1([hc[0] + fx + 1, hc[1]], '#c85048'); P1([hc[0] + fx + 2, hc[1]], '#d86058'); P1([hc[0] + fx + 1, hc[1] - 1 + 1], '#c85048'); }
      else { P1([hc[0] + fx + 1, hc[1]], '#d09878'); P1([hc[0] + fx + 2, hc[1]], P.FACE_D); }
      beard(hc, fx);
      if (fig.capOff) bald(hc, r);
      else cap(hc, fx, r);
      P1([hc[0] - 1, hc[1] - r + 2], GLOSS);                // varnish on the dome (under the cap's edge)
    }
    // no cap: a bald turned dome, a fringe of grey round the back, and the
    // pale ring where the cap sat for sixty years
    function bald(hc, r) {
      var top = hc[1] - r;
      P1([hc[0], top], P.FACE); P1([hc[0] - 1, top], P.FACE); P1([hc[0] + 1, top], P.FACE);
      P1([hc[0] - 1, top + 1], GLOSS); P1([hc[0], top + 1], '#f4d8bc');
      P1([hc[0] - r, hc[1] - 1], c.beardC); P1([hc[0] - r, hc[1] - 2], c.beardD); P1([hc[0] - r + 1, hc[1] - 2], c.beardC);
    }
    function beard(hc, fx) {
      var bc = c.beardC, bd = c.beardD, r = c.head, k;
      function row(y, cx, w, col) { if (w <= 0) return; L([cx - (w - 1) / 2, y], [cx + (w - 1) / 2, y], 1, col); }
      var mx = hc[0] + fx + 1;                            // the mouth's centre, toward `facing`
      // grey hair under the back of the cap, and a sideburn down to the jaw
      P1([hc[0] - r + 1, hc[1] - 1], bc); P1([hc[0] - r + 1, hc[1]], bd); P1([hc[0] - r + 2, hc[1] + 1], bc);
      // widths row by row from the moustache down: the face shows above it
      // (gnome logic: the beard is wider than the chin and spills down the chest)
      var W = BEARDS[c.beard] || [];
      for (k = 0; k < W.length; k++) {
        var y = hc[1] + 1 + k, w = W[k], cx = mx + (k > 3 ? (k - 3) * 0.08 : 0);
        if (c.beard === 'walrus' && k === 0) { row(y, mx, 6, bc); P1([mx - 3, y + 1], bc); P1([mx + 3, y + 1], bc); P1([mx - 3, y + 2], bd); P1([mx + 3, y + 2], bd); continue; }
        if (k === 1 && c.beard !== 'walrus') { row(y, cx, w, bc); P1([mx, y], '#8a5a4a'); continue; }  // the mouth, in the beard
        row(y, cx, w, k % 4 === 3 ? bd : bc);
        if (k > 1 && w > 1) P1([cx + (w - 1) / 2, y], bd);   // a stroke of shadow down the far side
        if (k > 3 && k % 3 === 1 && w > 2) P1([cx - (w - 1) / 2 + 1, y], '#ffffff'); // a lick of white paint
      }
    }
    function cap(hc, fx, r) {
      var top = hc[1] - r + 1, k, cc = c.capC, c2 = c.capC2;
      function row(y, x0, x1, col) { L([x0, y], [x1, y], 1, col); }
      if (c.cap === 'tallsoft') {
        // a tall soft cap, its crown slumped over to the back
        for (k = 0; k < 4; k++) row(top - k, hc[0] - r + 1 - Math.max(0, k - 1), hc[0] + r - 1 - k * 1.5, k === 3 ? c2 : cc);
        P1([hc[0] - r - 1, top - 3], c2); P1([hc[0] - r - 2, top - 2], cc);
        row(top + 1, hc[0] - r, hc[0] + r + 2, cc);
      } else if (c.cap === 'skull') {
        // a leather skullcap, stitched down the middle
        for (k = 0; k < 3; k++) row(top - k, hc[0] - r + k, hc[0] + r - k, k === 2 ? c2 : cc);
        row(top + 1, hc[0] - r, hc[0] + r - 1, cc);
        P1([hc[0], top - 1], '#3a2416'); P1([hc[0], top], '#3a2416');
      } else if (c.cap === 'flat') {
        // a flat tweed cap pulled down to the spectacles
        row(top, hc[0] - r, hc[0] + r, cc); row(top - 1, hc[0] - r + 1, hc[0] + r - 1, c2);
        row(top + 1, hc[0] - r, hc[0] + r + 3, cc); P1([hc[0] + r + 3, top + 1], c2);
        P1([hc[0] - r - 1, hc[1]], '#e8dcc0'); P1([hc[0] - r - 1, hc[1] + 1], '#c8b8a0');   // the pencil behind his ear
      } else {
        // the soft miner's cap: a felt dome, a short peak
        for (k = 0; k < 3; k++) row(top - k, hc[0] - r + (k === 2 ? 1 : 0), hc[0] + r - (k === 2 ? 1 : 0), k === 2 ? c2 : cc);
        row(top + 1, hc[0] - r, hc[0] + r + 2, cc);
        P1([hc[0] - r + 1, top - 1], c2);
      }
      // the carbide lamp on the front: a brass reflector, a flame in its middle
      var lx = hc[0] + fx + 1, ly = top - 1;
      P1([lx - 1, ly], P.BRASS1); P1([lx + 1, ly], P.BRASS1); P1([lx, ly - 1], P.BRASS3); P1([lx, ly + 1], P.BRASS1);
      P1([lx - 1, ly - 1], P.BRASS2); P1([lx + 1, ly + 1], P.BRASS0);
      P1([lx, ly + 2], P.BRASS2);                         // the water tank below it
      if (fig.lamp === false) P1([lx, ly], '#3a3440');
      else if (fig.lampK != null && fig.lampK < 0.35) P1([lx, ly], '#9a5a24');   // guttering
      else { P1([lx, ly], P.FLAME2); P1([lx + 1, ly - 1], P.FLAME1); }
    }
  }

  var BEARDS = {
    knees: [5, 5, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1],
    belt: [5, 5, 7, 7, 7, 6, 6, 5, 5, 4, 3, 2, 1],
    spade: [5, 5, 7, 7, 7, 7, 7, 6],
    short: [5, 5, 6, 5, 3],
    walrus: [6, 0, 0],
    goatee: [4, 2, 2, 2, 1]
  };

  /* the back view: on a ladder, climbing a rope, working a pin beside the
   * rungs. No face; the back of a turned head, the cap from behind with the
   * lamp's strap, the beard showing either side of it (it is that wide),
   * the apron tied in a bow at the small of the back, both arms up */
  function paintBack(K) {
    var fig = K.fig, B = rigBack(fig), c = B.c, p = B.p, L = K.L, D = K.D, P1 = K.P1, F = K.F;
    var hw = B.hw, hy = B.hy, ty = B.ty;
    var lL = p.legL || 0, lR = p.legR || 0, liftL = fig.liftL | 0, liftR = fig.liftR | 0;
    var hipL = [-2, hy], hipR = [2, hy];
    var footL = [hipL[0] - Math.sin(lL) * c.leg, hy + Math.cos(lL) * (c.leg - liftL)];
    var footR = [hipR[0] + Math.sin(lR) * c.leg, hy + Math.cos(lR) * (c.leg - liftR)];
    L(hipL, footL, 3, c.trousers); L(hipR, footR, 3, c.trousers);
    // boots from behind: the heels and a sole
    L([footL[0] - 1, footL[1]], [footL[0] + 1, footL[1]], 2, P.BOOT); P1([footL[0], footL[1] + 1], '#3a3440');
    L([footR[0] - 1, footR[1]], [footR[0] + 1, footR[1]], 2, P.BOOT); P1([footR[0], footR[1] + 1], '#3a3440');
    // the barrel of the body
    F([[-hw + 1, hy + 1], [hw - 1, hy + 1], [hw + 0.5, hy - c.torso * 0.45], [hw - 1, ty + 1], [hw - 2.5, ty - 0.5],
      [-hw + 2.5, ty - 0.5], [-hw + 1, ty + 1], [-hw - 0.5, hy - c.torso * 0.45]], c.coat);
    L([-hw + 0.5, hy - 1], [-hw + 0.5, ty + 2], 1, c.coat2);
    P1([-hw + 1.5, ty + 3], GLOSS);
    if (c.apron) {
      // the apron's ties cross the back and knot in a bow above the belt
      L([-hw + 1.5, ty + 2], [hw - 1.5, hy - 3], 1, APRON);
      L([hw - 1.5, ty + 2], [-hw + 1.5, hy - 3], 1, APRON);
      P1([-1, hy - 3], APRON2); P1([1, hy - 3], APRON2); P1([0, hy - 3], '#8a5a34');
      P1([-2, hy - 4], APRON2); P1([2, hy - 4], APRON2); P1([-1, hy - 2], APRON); P1([1, hy - 1], APRON);
    } else {
      L([-hw, hy - 2], [hw, hy - 2], 1, '#1a1410');
      if (c.patch) F([[-1.5, hy - 5], [1.5, hy - 5], [1.5, hy - 8], [-1.5, hy - 8]], '#5e5440');
    }
    P1([hw - 2, ty + 3], PEG);                            // the chipped shoulder
    P1(hipL, PEG_D); P1(hipR, PEG);
    // the head from behind
    var hc = B.headC, r = c.head;
    D(hc, r, P.FACE_D);
    P1([hc[0] - 1, hc[1] - 1], P.FACE);                   // the lit crown of the neck
    // ears
    P1([hc[0] - r, hc[1]], P.FACE); P1([hc[0] + r, hc[1]], P.FACE_D);
    // grey hair at the nape
    L([hc[0] - r + 1, hc[1] + r - 1], [hc[0] + r - 1, hc[1] + r - 1], 1, c.beardD);
    L([hc[0] - r + 2, hc[1] + r - 2], [hc[0] + r - 2, hc[1] + r - 2], 1, c.beardC);
    // the beard is wider than the head: it shows either side
    var bw = BEARDS[c.beard] || [], tuft = Math.min(4, bw.length > 6 ? 4 : bw.length > 3 ? 2 : 0);
    for (var k = 0; k < tuft; k++) {
      P1([hc[0] - r - 1, hc[1] + 1 + k], k % 2 ? c.beardD : c.beardC);
      P1([hc[0] + r + 1, hc[1] + 1 + k], k % 2 ? c.beardC : c.beardD);
    }
    if (c.beard === 'walrus') { P1([hc[0] - r - 1, hc[1] + 1], c.beardC); P1([hc[0] + r + 1, hc[1] + 1], c.beardC); }
    // the cap from behind, and the lamp's strap over the crown
    if (!fig.capOff) {
      var top = hc[1] - r + 1, cc = c.capC, c2 = c.capC2;
      for (k = 0; k < 3; k++) L([hc[0] - r + (k === 2 ? 1 : 0), top - k], [hc[0] + r - (k === 2 ? 1 : 0), top - k], 1, k === 2 ? c2 : cc);
      L([hc[0] - r, top + 1], [hc[0] + r, top + 1], 1, cc);
      if (c.cap === 'tallsoft') { P1([hc[0] - 1, top - 3], c2); P1([hc[0], top - 3], cc); P1([hc[0] + 1, top - 4], cc); }
      if (c.cap === 'skull') { P1([hc[0], top - 1], '#3a2416'); P1([hc[0], top], '#3a2416'); }
      P1([hc[0], top - 3], P.BRASS2); P1([hc[0] + 1, top - 3], P.BRASS1);     // the reflector's rim, peeking over
    } else {
      P1([hc[0], hc[1] - r], P.FACE); P1([hc[0] - 1, hc[1] - r + 1], GLOSS);
    }
    // arms, up the rungs (drawn over the head's edge: they are beside it)
    var aL = B.aL, aR = B.aR;
    L(B.shL, B.handL, 2, c.coat); D(B.handL, 1.3, P.FACE_D); P1(B.shL, PEG_D);
    tool(K, c, fig.tool, B.handR, aR + (p.toolA || 0));
    L(B.shR, B.handR, 2, c.coat2); D(B.handR, 1.3, P.FACE); P1(B.shR, PEG);
    tool2(K, c, fig.tool2, B.handL, false);
  }

  // a direction snapped to the nearest of the eight (for heads that must
  // stay crisp lines at any angle)
  function oct(x, y) { var a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * (Math.PI / 4); return [Math.round(Math.cos(a)), Math.round(Math.sin(a))]; }
  function tool(K, c, kind, hand, a) {
    if (!kind) return;
    var s = K.s, X = K.X, Y = K.Y, L = K.L, P1 = K.P1, fig = K.fig;
    var dir = [Math.sin(a), Math.cos(a)];
    function along(dd, off) { return [hand[0] + dir[0] * dd - dir[1] * (off || 0), hand[1] + dir[1] * dd + dir[0] * (off || 0)]; }
    var k;
    switch (kind) {
      case 'pick': {
        // the handle: one clean line; the head: square to it, snapped to the
        // nearest 45 degrees so it is always a straight or a true diagonal
        // line (a pick at 30 degrees drawn exactly turns into a fork)
        L(along(-4), along(10), 1, P.TIM4);
        var hd = along(11), q = oct(-dir[1], dir[0]), dq = oct(dir[0], dir[1]);
        var hx = Math.round(hd[0]), hy = Math.round(hd[1]);
        for (k = -4; k <= 4; k++) P1([hx + q[0] * k, hy + q[1] * k], k === 0 ? P.IRON4 : (k < 0 ? P.IRON4 : P.IRON3));
        // the points curve back toward the hands a pixel; the eye is thick
        P1([hx + q[0] * 5 - dq[0], hy + q[1] * 5 - dq[1]], P.IRON3); P1([hx - q[0] * 5 - dq[0], hy - q[1] * 5 - dq[1]], P.IRON4);
        P1([hx + dq[0], hy + dq[1]], P.IRON2); P1([hx - dq[0], hy - dq[1]], P.IRON2);
        break;
      }
      case 'shovel': {
        L(along(-3), along(15), 1, P.TIM4);
        // the blade: a filled quad (no gaps at any angle), a lit edge
        var b0 = along(16);
        K.F([[b0[0] - dir[1] * 2.6, b0[1] + dir[0] * 2.6], [b0[0] + dir[1] * 2.6, b0[1] - dir[0] * 2.6],
          [b0[0] + dir[1] * 2.2 + dir[0] * 6, b0[1] - dir[0] * 2.2 + dir[1] * 6], [b0[0] - dir[1] * 2.2 + dir[0] * 6, b0[1] + dir[0] * 2.2 + dir[1] * 6]], P.IRON3);
        L([b0[0] - dir[1] * 2.4, b0[1] + dir[0] * 2.4], [b0[0] + dir[1] * 2.4, b0[1] - dir[0] * 2.4], 1, P.IRON4);
        L(along(-3, -1.5), along(-3, 1.5), 1, P.TIM3);   // the D-grip
        break;
      }
      case 'mallet': {
        L(along(-1), along(7), 1, P.TIM4);
        // the head: a solid block square to the handle (filled, never slats)
        var m0 = along(7);
        K.F([[m0[0] - dir[1] * 2.5, m0[1] + dir[0] * 2.5], [m0[0] + dir[1] * 2.5, m0[1] - dir[0] * 2.5],
          [m0[0] + dir[1] * 2.5 + dir[0] * 3.2, m0[1] - dir[0] * 2.5 + dir[1] * 3.2], [m0[0] - dir[1] * 2.5 + dir[0] * 3.2, m0[1] + dir[0] * 2.5 + dir[1] * 3.2]], P.TIM3);
        P1([m0[0] - dir[1] * 2 + dir[0] * 0.5, m0[1] + dir[0] * 2 + dir[1] * 0.5], P.END); P1([m0[0] + dir[1] * 2 + dir[0] * 2.5, m0[1] - dir[0] * 2 + dir[1] * 2.5], P.TIM2);
        break;
      }
      case 'cane':
        L(along(-2), along(c.leg + 6), 1, P.TIM3); P1(along(-2, 1), P.TIM4); P1(along(-2, 2), P.TIM3);
        break;
      case 'lantern': {
        var lh = [hand[0], hand[1] + 2];
        P1([hand[0], hand[1] + 1], P.IRON3);
        rect(s, Math.round(X(lh) - 2), Math.round(Y(lh)), 5, 6, P.IRON2);
        rect(s, Math.round(X(lh) - 1), Math.round(Y(lh) + 1), 3, 4, P.FLAME1);
        px(s, Math.round(X(lh)), Math.round(Y(lh) + 2), P.FLAME2);
        L([lh[0] - 2, lh[1] - 1], [lh[0] + 2, lh[1] - 1], 1, P.IRON3);
        P1([lh[0], lh[1] + 6], P.IRON3);
        break;
      }
      case 'spike':
        L(along(-2), along(5), 1, P.IRON3); P1(along(-2), P.IRON4); L(along(-2, -1), along(-2, 1), 1, P.IRON3);
        break;
      case 'timber':
        L(along(-12), along(12), 3, P.TIM3); L(along(-12, -1), along(12, -1), 1, P.TIM4); P1(along(12), P.END); P1(along(-12), P.END);
        break;
      case 'plank':
        L(along(-7), along(7), 2, P.TIM3); L(along(-7, -1), along(7, -1), 1, P.TIM4); P1(along(7), P.END); P1(along(-7), P.END);
        break;
      case 'tally': {
        // a tally card on a board; his count is on it, a pencil dot a job
        rect(s, Math.round(X(hand) - 2), Math.round(Y(hand) - 5), 5, 6, P.PAPER); rect(s, Math.round(X(hand) - 2), Math.round(Y(hand) - 6), 5, 1, P.TIM2);
        var n = fig.tallyN == null ? 4 : Math.max(0, fig.tallyN | 0);
        for (k = 0; k < Math.min(n, 12); k++) px(s, Math.round(X(hand) - 1 + (k % 3) * (K.f > 0 ? 1 : -1)), Math.round(Y(hand) - 4 + Math.floor(k / 3)), P.INK_L);
        if (n > 12) px(s, Math.round(X(hand) + 1), Math.round(Y(hand) - 5), P.RED1);   // a second card, clipped behind
        // a near miss at the 13 marked in red pencil along the bottom: NEARLY
        for (k = 0; k < Math.min(fig.nearly | 0, 5); k++) px(s, Math.round(X(hand) - 2 + k * (K.f > 0 ? 1 : -1)), Math.round(Y(hand)), '#c83a3a');
        break;
      }
      case 'coil': {
        // a rope ladder rolled up: a fat coil with rungs sticking out
        var cc = [hand[0], hand[1] + 2];
        K.D(cc, 2.6, '#6a5a40'); K.D(cc, 1.4, '#9a8a64'); P1(cc, '#3a3024');
        P1([cc[0] - 3, cc[1] - 1], P.TIM3); P1([cc[0] + 3, cc[1] + 1], P.TIM3);
        break;
      }
      case 'ladder': {
        // a short ladder over the shoulder
        L(along(-9, -1.5), along(9, -1.5), 1, P.TIM3); L(along(-9, 1.5), along(9, 1.5), 1, P.TIM2);
        for (k = -8; k <= 8; k += 4) L(along(k, -1.5), along(k, 1.5), 1, P.TIM4);
        break;
      }
      case 'oilcan': {
        var ob = [hand[0], hand[1] + 1];
        rect(s, Math.round(X(ob) - 1), Math.round(Y(ob)), 3, 3, P.IRON3); px(s, Math.round(X(ob) - 1), Math.round(Y(ob)), P.IRON4);
        L([ob[0] + 1, ob[1]], [ob[0] + 4, ob[1] - 3], 1, P.IRON2);                   // the spout
        break;
      }
      case 'pail': {
        var pb = [hand[0], hand[1] + 2];
        rect(s, Math.round(X(pb) - 2), Math.round(Y(pb)), 5, 4, P.IRON3); rect(s, Math.round(X(pb) - 2), Math.round(Y(pb)), 5, 1, P.IRON4);
        px(s, Math.round(X(pb) + 2 * K.f), Math.round(Y(pb) + 1), P.IRON1);
        break;
      }
      case 'marble':
        break; // the renderer draws the marble at fig.hold
    }
  }
  // the left hand's small things
  function tool2(K, c, kind, hand, far) {
    if (!kind) return;
    var P1 = K.P1, h = hand;
    switch (kind) {
      case 'pencil': P1([h[0] + 1, h[1] - 1], '#e8dcc0'); P1([h[0] + 2, h[1] - 2], '#c8b8a0'); P1([h[0] + 3, h[1] - 3], P.INK); break;
      case 'bread': P1([h[0], h[1] - 1], '#e8d4a0'); P1([h[0] + 1, h[1] - 1], '#d8b878'); P1([h[0] + 1, h[1] - 2], '#e8d4a0'); break;
      case 'rag': P1([h[0], h[1] + 1], '#c8c0b0'); P1([h[0] + 1, h[1] + 1], '#a8a090'); P1([h[0], h[1] + 2], '#a8a090'); break;
      case 'cap': {
        // his cap against his chest, the lamp still burning on it
        var cc = CREW[K.fig.who] || CREW.pick;
        K.L([h[0] - 2, h[1]], [h[0] + 2, h[1]], 1, cc.capC); K.L([h[0] - 1, h[1] - 1], [h[0] + 1, h[1] - 1], 1, cc.capC2);
        P1([h[0] + 1, h[1] - 2], P.BRASS2);
        break;
      }
    }
  }

  function outline(cv, n) {
    var g = cv.getContext('2d'), im = g.getImageData(0, 0, n, n), d = im.data, o = A.rgb(OUT);
    var mark = new Uint8Array(n * n);
    for (var y = 1; y < n - 1; y++) for (var x = 1; x < n - 1; x++) {
      var i = y * n + x;
      if (d[i * 4 + 3]) continue;
      if (d[(i - 1) * 4 + 3] || d[(i + 1) * 4 + 3] || d[(i - n) * 4 + 3] || d[(i + n) * 4 + 3]) mark[i] = 1;
    }
    for (i = 0; i < n * n; i++) if (mark[i]) { d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  }

  // where the cap lamp's flame is (board space). `out` (optional) is filled
  // and returned instead of a new object (the renderer asks every frame):
  // the offset depends only on the pose, so it's kept with the pose's sprite
  function figureLamp(fig, out) {
    if (out && !fig.rot) {
      var e = sprite(fig), lo = e.lamp;
      if (!lo) { var z = {}; for (var k in fig) z[k] = fig[k]; z.x = 0; z.y = 0; lo = e.lamp = figureLampAt(z, {}); if (lo.lantern) lo.lantern = { x: lo.lantern.x, y: lo.lantern.y }; }
      out.x = fig.x + lo.x; out.y = fig.y + lo.y; out.back = !!lo.back; out.fallen = false; out.inHand = !!lo.inHand;
      if (lo.lantern) { var ln = out._lan || (out._lan = {}); ln.x = fig.x + lo.lantern.x; ln.y = fig.y + lo.lantern.y; out.lantern = ln; } else out.lantern = null;
      return out;
    }
    return figureLampAt(fig, out);
  }
  function figureLampAt(fig, out) {
    var f = fig.facing < 0 ? -1 : 1;
    if (out) { out.back = false; out.fallen = false; out.inHand = false; out.lantern = null; }
    else out = {};
    if (fig.rot) {
      // knocked over: the lamp lies on the floor at the head's end
      var c0 = CREW[fig.who] || CREW.pick, len = c0.leg + c0.torso + c0.head * 2;
      out.x = fig.x + (fig.rot > 0 ? 1 : -1) * len; out.y = fig.y - 3; out.fallen = true;
      return out;
    }
    if (fig.back) {
      var B = rigBack(fig), top = B.headC[1] - B.c.head + 1;
      out.x = fig.x + B.headC[0] * f; out.y = fig.y + top - 2; out.back = true;
      if (fig.capOff) { out.x = fig.x + B.handL[0] * -f; out.y = fig.y + B.handL[1] - 2; }
      return out;
    }
    var R = rig(fig), c = R.c, hc = R.headC;
    var tp = hc[1] - c.head + 1, lx = hc[0] + 2, ly = tp - 1;
    out.x = fig.x + lx * f; out.y = fig.y + ly;
    if (fig.capOff) {
      var hl = limbEnd(R.shL, armAngle(R, (fig.pose && fig.pose.armL) || 0), c.arm);
      out.x = fig.x + (hl[0] + 1) * f; out.y = fig.y + hl[1] - 2; out.inHand = true;
    }
    if (fig.tool === 'lantern') {
      var hand = limbEnd(R.shR, armAngle(R, (fig.pose && fig.pose.armR) || 0), c.arm);
      var ln = out._lan || (out._lan = {});
      ln.x = fig.x + hand[0] * f; ln.y = fig.y + hand[1] + 5;
      out.lantern = ln;
    }
    return out;
  }
  // the chest: where a figure takes his one flat colour of light from
  function figureChest(fig, out) {
    var c = CREW[fig.who] || CREW.pick;
    out = out || {};
    if (fig.rot) { out.x = fig.x + (fig.rot > 0 ? 1 : -1) * (c.leg + 4); out.y = fig.y - 3; return out; }
    out.x = fig.x; out.y = fig.y - c.leg - Math.round(c.torso * 0.6);
    return out;
  }
  function figureHands(fig) {
    var f = fig.facing < 0 ? -1 : 1;
    if (fig.back) {
      var B = rigBack(fig);
      return { l: { x: fig.x + B.handL[0] * f, y: fig.y + B.handL[1] }, r: { x: fig.x + B.handR[0] * f, y: fig.y + B.handR[1] } };
    }
    var R = rig(fig), c = R.c, p = R.p;
    var hL = limbEnd(R.shL, armAngle(R, p.armL || 0), c.arm), hR = limbEnd(R.shR, armAngle(R, p.armR || 0), c.arm);
    return { l: { x: fig.x + hL[0] * f, y: fig.y + hL[1] }, r: { x: fig.x + hR[0] * f, y: fig.y + hR[1] } };
  }
  // the shoulders (for aiming an arm at a pin) and the lean the rig used
  function figureShoulders(fig) {
    var f = fig.facing < 0 ? -1 : 1;
    if (fig.back) { var B = rigBack(fig); return { l: { x: fig.x + B.shL[0] * f, y: fig.y + B.shL[1] }, r: { x: fig.x + B.shR[0] * f, y: fig.y + B.shR[1] }, lean: 0 }; }
    var R = rig(fig);
    return { l: { x: fig.x + R.shL[0] * f, y: fig.y + R.shL[1] }, r: { x: fig.x + R.shR[0] * f, y: fig.y + R.shR[1] }, lean: R.lean };
  }
  // the figure's bounding box (for placing them clear of pins)
  function figureBox(fig) {
    var c = CREW[fig.who] || CREW.pick, h = c.leg + c.torso + c.head * 2 + 6;
    return { x: fig.x - 8, y: fig.y - h, w: 16, h: h };
  }

  A.drawFigure = drawFigure;
  A.drawFigureShadow = drawFigureShadow;
  A.drawFigureBody = drawFigureBody;
  A.figureChest = figureChest;
  A.figureLamp = figureLamp;
  A.figureHands = figureHands;
  A.figureShoulders = figureShoulders;
  A.figureBox = figureBox;

  var d = d2r;
  // named poses (lean is added to each knocker's own stoop)
  A.POSES = {
    stand:   { lean: 0, head: 0, armL: -6 * d, armR: 6 * d, legL: -6 * d, legR: 6 * d },
    swingUp: { lean: -18 * d, head: -15 * d, armL: 150 * d, armR: 165 * d, legL: -14 * d, legR: 14 * d, toolA: 0 },
    swingDn: { lean: 18 * d, head: 10 * d, armL: 60 * d, armR: 70 * d, legL: -14 * d, legR: 14 * d, toolA: 30 * d },
    carry:   { lean: 5 * d, head: 0, armL: 90 * d, armR: 90 * d, legL: -18 * d, legR: 18 * d },
    push:    { lean: 25 * d, head: -10 * d, armL: 95 * d, armR: 100 * d, legL: -30 * d, legR: 20 * d },
    walkA:   { lean: 4 * d, head: 0, armL: 25 * d, armR: -20 * d, legL: 22 * d, legR: -22 * d },
    walkB:   { lean: 4 * d, head: 0, armL: -20 * d, armR: 25 * d, legL: -22 * d, legR: 22 * d },
    cheer:   { lean: -12 * d, head: -15 * d, armL: 165 * d, armR: -165 * d, legL: -15 * d, legR: 15 * d },
    point:   { lean: -6 * d, head: -12 * d, armL: -5 * d, armR: 120 * d, legL: -6 * d, legR: 6 * d },
    sit:     { lean: -10 * d, head: 10 * d, armL: 30 * d, armR: 40 * d, legL: 90 * d, legR: 80 * d },
    hold:    { lean: 6 * d, head: 15 * d, armL: 45 * d, armR: 60 * d, legL: -6 * d, legR: 6 * d, toolA: -40 * d },
    lamp:    { lean: -4 * d, head: -8 * d, armL: -6 * d, armR: 60 * d, legL: -6 * d, legR: 6 * d },
    lean:    { lean: 4 * d, head: 12 * d, armL: 20 * d, armR: 10 * d, legL: -4 * d, legR: 10 * d, toolA: -10 * d }
  };

  /* ══ the knockers' kit (view.props) ═══════════════════════════════════
   * layer 'back' (before the figures, lit): ladders, rope ladders, the
   * little doors, planks, the lunch pail set down; 'front' (after the
   * figures, lit): pins in hand or held to the rock, dust, crumbs;
   * 'glow' (emissive, after the light): a lamp moving behind the rock, the
   * warm inside of an open door, sleep. */
  var ROPE = '#9a8a64', ROPE_D = '#5e5038';
  function drawProps(g, view, layer) {
    var props = view.props; if (!props || !props.length) return;
    var t = view.t || 0;
    for (var i = 0; i < props.length; i++) {
      var q = props[i];
      if ((q.layer || LAYER[q.kind] || 'back') !== layer) continue;
      // lamps out: nothing glows in a dark section (the renderer's soft dark)
      if (layer === 'glow' && A.darkAt && A.darkAt(q.x, q.y) >= 0.85) continue;
      var fn = PROP[q.kind]; if (fn) fn(g, q, t);
    }
  }
  var LAYER = { ladder: 'back', rope: 'back', door: 'back', plank: 'back', pail: 'back', coil: 'back', pin: 'front', dust: 'front', crumb: 'front', glint: 'glow',
    glow: 'glow', doorglow: 'glow', zzz: 'glow', halo: 'glow', drip: 'front' };
  var PROP = {
    // a wooden ladder (fixed in a raise or propped up): stiles and rungs, its
    // shadow on the rock behind
    ladder: function (g, q) {
      var x = Math.round(q.x), y0 = Math.round(q.y0), y1 = Math.round(q.y1);
      if (y1 <= y0) return;
      g.save(); g.globalAlpha = 0.35; g.fillStyle = '#000';
      g.fillRect(x - 1, y0 + 1, 1, y1 - y0); g.fillRect(x + 3, y0 + 1, 1, y1 - y0);
      g.restore();
      rect(g, x - 2, y0, 1, y1 - y0 + 1, P.TIM3); rect(g, x + 2, y0, 1, y1 - y0 + 1, P.TIM1);
      for (var y = y1 - 1; y > y0; y -= 4) { rect(g, x - 1, y, 3, 1, P.TIM3); px(g, x - 1, y, P.TIM4); }
      if (q.feet) { px(g, x - 2, y1, P.TIM1); px(g, x + 2, y1, P.TIM0); }
    },
    // a rope ladder hung from a floor's lip: hooks over the edge, rope
    // stiles with a little sag, wooden rungs every four px
    rope: function (g, q, t) {
      var x = Math.round(q.x), y0 = Math.round(q.y0), y1 = Math.round(q.y1);
      if (y1 <= y0) return;
      var sway = q.sway || 0;
      g.save(); g.globalAlpha = 0.3; g.fillStyle = '#000';
      for (var ys = y0 + 1; ys <= y1; ys++) { var ws = Math.round(Math.sin((ys - y0) * 0.35) * 0.5 + sway * (ys - y0) / Math.max(12, y1 - y0)); g.fillRect(x - 1 + ws, ys + 1, 1, 1); g.fillRect(x + 3 + ws, ys + 1, 1, 1); }
      g.restore();
      for (var y = y0; y <= y1; y++) {
        var w = Math.round(Math.sin((y - y0) * 0.35) * 0.5 + sway * (y - y0) / Math.max(12, y1 - y0));
        px(g, x - 2 + w, y, (y & 1) ? ROPE : ROPE_D); px(g, x + 2 + w, y, (y & 1) ? ROPE_D : ROPE);
        if ((y1 - y) % 4 === 0 && y > y0 + 1) { rect(g, x - 1 + w, y, 3, 1, P.TIM3); }
      }
      // the hooks over the lip
      px(g, x - 2, y0 - 1, P.IRON3); px(g, x + 2, y0 - 1, P.IRON3); px(g, x - 3, y0, P.IRON2); px(g, x + 3, y0, P.IRON2);
    },
    coil: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y);
      disc(g, x + 0.5, y - 1.5, 2.6, ROPE_D); disc(g, x + 0.5, y - 1.5, 1.4, ROPE); px(g, x, y - 2, '#3a3024');
      px(g, x - 3, y - 1, P.TIM3); px(g, x + 3, y - 2, P.TIM3);
    },
    // their little doors in the rock: shut, a hairline arch you'd miss and
    // a pin of a ring; ajar; open, a black arch with a timber sill
    door: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y), w = q.w || 7, h = q.h || 11, hw = (w - 1) / 2;
      function arch(fn) {
        for (var yy = 0; yy < h; yy++) for (var xx = -hw; xx <= hw; xx++) {
          var ay = h - 1 - yy, inside = ay < h - hw - 1 ? true : (xx * xx + (ay - (h - hw - 1)) * (ay - (h - hw - 1)) <= hw * hw + 0.5);
          if (inside) fn(x + xx, y - 1 - yy, xx, ay);
        }
      }
      if (!q.open) {
        // shut: only the crack round it, dithered, and its ring
        arch(function (X, Y, xx, ay) {
          var edge = Math.abs(xx) === hw || ay === h - 1 || (ay >= h - hw - 1 && (xx * xx + (ay - (h - hw - 1) + 1) * (ay - (h - hw - 1) + 1) > hw * hw + 0.5));
          if (edge && ((X + Y) & 1)) px(g, X, Y, 'rgba(0,0,0,0.42)');
        });
        px(g, x + hw - 2, y - 5, q.ring || '#6a4a2a');
        return;
      }
      if (q.open === 1) {
        // ajar: a black slit, the door swung out on its hinge
        arch(function (X, Y, xx) { if (xx >= hw - 1) px(g, X, Y, P.VOID0); });
        rect(g, x - hw - 1, y - h, 2, h, P.TIM1); px(g, x - hw - 1, y - h, P.TIM2);
        return;
      }
      arch(function (X, Y, xx, ay) { px(g, X, Y, ay > h - 3 ? P.VOID1 : P.VOID0); });
      // the frame (pale new-cut timber, so it shows in a dark gallery) and the sill
      arch(function (X, Y, xx, ay) {
        var edge = Math.abs(xx) === hw || (ay >= h - hw - 1 && (xx * xx + (ay - (h - hw - 1) + 1) * (ay - (h - hw - 1) + 1) > hw * hw + 0.5));
        if (edge) px(g, X, Y, xx < 0 || ay > h - 3 ? P.TIM4 : P.TIM3);
      });
      rect(g, x - hw - 1, y, w + 2, 1, P.TIM3); px(g, x - hw - 1, y, P.END);
      // the door itself, swung back flat against the rock
      rect(g, x - hw - 3, y - h + 2, 2, h - 2, P.TIM1); px(g, x - hw - 3, y - h + 2, P.TIM2); px(g, x - hw - 2, y - 5, '#6a4a2a');
    },
    doorglow: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y), k = q.k == null ? 1 : q.k;
      for (var j = 2; j < 9; j++) for (var i = -2; i <= 2; i++) {
        var dd = (i * i) / 6 + Math.abs(j - 5) / 4;
        if (dd < 1 && A.bayer(x + i, y - j) < (1 - dd) * 1.1 * k) px(g, x + i, y - j, j > 6 ? P.FLAME0 : dd < 0.4 ? P.FLAME1 : P.LAMP);
      }
    },
    plank: function (g, q) {
      A.thick(g, q.x1, q.y1, q.x2, q.y2, 2, P.TIM3);
      A.line(g, q.x1, q.y1 - 1, q.x2, q.y2 - 1, P.TIM4);
      px(g, Math.round(q.x1), Math.round(q.y1), P.END); px(g, Math.round(q.x2), Math.round(q.y2), P.END);
      if (q.nails) { px(g, Math.round(q.x1) + 1, Math.round(q.y1), P.IRON4); px(g, Math.round(q.x2) - 1, Math.round(q.y2), P.IRON4); }
    },
    // the lunch pail, set down: a tin can with a bail, the lid off beside it
    pail: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y);
      rect(g, x - 2, y - 4, 5, 4, P.IRON3); rect(g, x - 2, y - 4, 5, 1, P.IRON4); px(g, x + 2, y - 3, P.IRON1); px(g, x + 2, y - 2, P.IRON1);
      px(g, x - 1, y - 4, P.VOID0); px(g, x, y - 4, P.VOID0); px(g, x + 1, y - 4, P.VOID1);
      px(g, x - 3, y - 6, P.IRON2); px(g, x - 2, y - 7, P.IRON2); px(g, x, y - 7, P.IRON2); px(g, x + 2, y - 7, P.IRON2); px(g, x + 3, y - 6, P.IRON2);
      if (q.lid !== false) { px(g, x + 4, y - 1, P.IRON3); px(g, x + 5, y - 1, P.IRON4); px(g, x + 4, y - 2, P.IRON4); }
      g.save(); g.globalAlpha = 0.45; g.fillStyle = '#000'; g.fillRect(x - 2, y, 6, 1); g.restore();
    },
    // a pin in a hand, or held to the rock before the mallet: the board's own
    // sprite of it where the renderer can lend one
    pin: function (g, q) {
      if (q.spr) { g.drawImage(q.spr, Math.round(q.x) - (q.spr.width >> 1), Math.round(q.y) - (q.spr.height >> 1)); return; }
      var x = Math.round(q.x), y = Math.round(q.y);
      var pal = PIN_PAL[q.dress] || PIN_PAL.spike;
      rect(g, x - 1, y - 2, 3, 1, '#0a080c'); rect(g, x - 2, y - 1, 5, 3, '#0a080c'); rect(g, x - 1, y + 2, 3, 1, '#0a080c');
      px(g, x - 1, y - 1, pal[0]); px(g, x, y - 1, pal[1]); px(g, x + 1, y - 1, pal[2]);
      px(g, x - 1, y, pal[1]); px(g, x, y, pal[2]); px(g, x + 1, y, pal[3]); px(g, x, y + 1, pal[3]);
    },
    dust: function (g, q, t) {
      var n = q.n || 4, age = q.age || 0;
      for (var i = 0; i < n; i++) {
        var hx = A.hash01(Math.round(q.x * 7 + q.y), i, 1), hy = A.hash01(Math.round(q.y * 5 + q.x), i, 2);
        var X = Math.round(q.x + (hx - 0.5) * 6 + (q.dx || 0) * age), Y = Math.round(q.y + hy * 2 + age * (1 + hy) * 1.5);
        px(g, X, Y, i % 2 ? '#6a5a4a' : '#8a7a66');
      }
    },
    crumb: function (g, q) { px(g, Math.round(q.x), Math.round(q.y), '#e8d4a0'); },
    drip: function (g, q) { px(g, Math.round(q.x), Math.round(q.y), '#1a1410'); },
    glint: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y);
      px(g, x, y, '#ffffff'); if (q.big) { px(g, x - 1, y, P.GLINT); px(g, x + 1, y, P.GLINT); px(g, x, y - 1, P.GLINT); px(g, x, y + 1, P.GLINT); }
    },
    // a lamp going along behind the rock (a knocker in his tunnels): a
    // dithered warm smudge, and a hard pixel where the flame is
    glow: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y), k = q.k == null ? 1 : q.k;
      for (var j = -3; j <= 3; j++) for (var i = -3; i <= 3; i++) {
        var dd = (i * i + j * j) / 10;
        if (dd < 1 && A.bayer(x + i, y + j) < (1 - dd) * 0.45 * k) px(g, x + i, y + j, 'rgba(255,196,106,0.5)');
      }
      if (q.marble) { px(g, x + 2, y + 1, 'rgba(190,220,255,0.8)'); }
    },
    // the back of a knocker's head, rimmed by his own lamp's light
    halo: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y);
      px(g, x, y, P.FLAME1); px(g, x - 1, y + 1, 'rgba(255,208,96,0.5)'); px(g, x + 1, y + 1, 'rgba(255,208,96,0.5)');
    },
    zzz: function (g, q) {
      var x = Math.round(q.x), y = Math.round(q.y);
      // a small z (3 × 3, never the font's z, which is a 2 on a tag)
      var zc = 'rgba(216,204,240,0.8)';
      px(g, x, y, zc); px(g, x + 1, y, zc); px(g, x + 2, y, zc); px(g, x + 1, y + 1, zc); px(g, x, y + 2, zc); px(g, x + 1, y + 2, zc); px(g, x + 2, y + 2, zc);
    }
  };
  var PIN_PAL = {
    spike: ['#f0c8a0', '#b07a50', '#7a4a2e', '#3a2014'], hook: ['#e0ecff', '#8898c0', '#4c5a80', '#20283c'],
    bolt: ['#ffffff', '#c0c4c8', '#8a8e96', '#44484e'], nail: ['#fff4c8', '#e0c070', '#a8843c', '#4e3814'],
    prop: ['#f4dca8', '#c8a060', '#a07c48', '#5a3e20'], fencepost: ['#e8c890', '#a8804a', '#7a5a34', '#3a2816'],
    root: ['#d8b080', '#9a7448', '#6e5030', '#3a2616'], coal: ['#dfe6ff', '#5a6480', '#22222e', '#08080c'],
    ore: ['#fffbe8', '#e0dac4', '#a8a290', '#4a4436'], bone: ['#fffaf0', '#e0d8c0', '#b8ae94', '#6a6254'], rib: ['#fffaf0', '#e0d8c0', '#b8ae94', '#6a6254']
  };
  A.drawProps = drawProps;
})(typeof window !== 'undefined' ? window : globalThis);

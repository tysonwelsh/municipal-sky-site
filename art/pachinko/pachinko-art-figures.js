/* MOTHER LODE — the tommyknockers (painted figurines)
 *
 * Jointed wooden toys of little old miners, ~30 px tall: turned-wood
 * bodies, peg joints you can see, painted faces (dot eyes, a rosy cheek,
 * the beard in one confident stroke), leather aprons, arms a little too
 * long, and a hardened-felt or soft cap with a candle lamp at the front.
 * They are models. They should not be able to do what they do.
 *
 * drawFigure(g, fig) draws one into a context in board space:
 *   fig = { x, y,            // feet on the ground at (x, y)
 *           facing: 1 | -1,  // which way the painted face looks
 *           who,             // 'tall' | 'lamp' | 'pick' | 'old' | 'little' | 'tally'
 *           pose: { lean, head, armL, armR, legL, legR, toolA },   // radians
 *           tool,            // 'pick' | 'shovel' | 'mallet' | 'lantern' | 'spike' |
 *                            // 'timber' | 'tally' | 'cane' | 'marble' | null
 *           lamp,            // the cap candle is lit (default true)
 *           hold }           // optional {x, y} a carried thing's centre (e.g. the marble)
 * Angles: arms and legs measure from straight down, positive swings
 * toward `facing`; lean tips the body about the hips (positive = forward);
 * head nods (positive = down/forward). Quantise angles to ~15° steps
 * when animating: they move like stop-motion toys, pose to pose.
 *
 * figureLamp(fig) → {x, y} the candle flame (for the lightmap).
 * CREW: the six individuals' proportions and paint.
 */
(function (root) {
  'use strict';
  var A = root.PachinkoArt, S = A.S, P = A.PAL;
  var px = S.px, rect = S.rect, line = A.line, thick = A.thick, disc = A.disc;

  var CREW = {
    // Absalom, the tall one: long legs, oxblood coat, the Cornish felt hat
    tall: { leg: 12, torso: 11, width: 7, arm: 13, coat: P.COAT_R, coat2: P.COAT_R2, trousers: '#2a2230', hat: 'felt', beard: 'chops', beardC: '#9a948a', apron: true },
    // Tobias carries the big lantern: ginger beard, faded blue coat
    lamp: { leg: 9, torso: 10, width: 8, arm: 12, coat: P.COAT_B, coat2: P.COAT_B2, trousers: '#3a3028', hat: 'soft', beard: 'short', beardC: '#c0602a', apron: true },
    // Ezra with the pick: broad, olive coat, a black spade beard
    pick: { leg: 9, torso: 10, width: 10, arm: 13, coat: P.COAT_G, coat2: P.COAT_G2, trousers: '#282420', hat: 'soft', beard: 'spade', beardC: '#2a2226', apron: true },
    // the old one: stooped, black coat, a white beard to the knees
    old: { leg: 8, torso: 10, width: 8, arm: 12, coat: P.COAT_K, coat2: P.COAT_K2, trousers: '#26222c', hat: 'soft', beard: 'long', beardC: P.BEARD, apron: false },
    // the little one: short and round, ochre coat, a shovel twice his size
    little: { leg: 7, torso: 9, width: 9, arm: 11, coat: P.COAT_O, coat2: P.COAT_O2, trousers: '#3a2e26', hat: 'soft', beard: 'none', beardC: null, apron: true, nose: true },
    // the tallyman: grey coat, spectacles, a pencil behind the ear
    tally: { leg: 9, torso: 10, width: 7, arm: 12, coat: '#4a4a52', coat2: '#66666e', trousers: '#2a2a30', hat: 'bowler', beard: 'mustache', beardC: '#6a5a4a', apron: false, specs: true }
  };
  A.CREW = CREW;

  var OUT = '#0a080c'; // the outline: every figure keeps one readable silhouette

  // rotate (x, y) about origin
  function rot(x, y, a) { var c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; }

  // compute the rig's joint positions in local space (facing +1, feet at 0,0)
  function rig(fig) {
    var c = CREW[fig.who] || CREW.pick, p = fig.pose || {};
    var lean = p.lean || 0, hipY = -c.leg - 1;
    var hip = [0, hipY];
    function body(x, y) { var r = rot(x, y - hipY, lean); return [r[0], r[1] + hipY]; }
    var neck = body(0, hipY - c.torso);
    var sh = body(0, hipY - c.torso + 2);
    var hw = Math.floor(c.width / 2);
    var shL = body(-hw + 1, hipY - c.torso + 2), shR = body(hw - 1, hipY - c.torso + 2);
    var headA = lean + (p.head || 0);
    var headC = [neck[0] + Math.sin(headA) * 4, neck[1] - Math.cos(headA) * 4];
    return { c: c, p: p, lean: lean, hip: hip, neck: neck, sh: sh, shL: shL, shR: shR, headC: headC, headA: headA, body: body, hipY: hipY };
  }
  function limbEnd(o, a, len) { return [o[0] + Math.sin(a) * len, o[1] + Math.cos(a) * len]; }

  // everything in local space is mirrored by `facing`, then offset
  function drawFigure(g, fig) {
    var R = rig(fig), c = R.c, p = R.p, f = fig.facing < 0 ? -1 : 1;
    // draw into a scratch canvas so the silhouette can be outlined
    var SZ = 64, O = 32, sc = scratch(SZ), s = sc.getContext('2d');
    s.clearRect(0, 0, SZ, SZ);
    var X = function (v) { return O + v[0] * f; }, Y = function (v) { return O + 16 + v[1]; };
    function L(a, b, w, col) { thick(s, X(a), Y(a), X(b), Y(b), w, col); }
    function D(v, r, col) { disc(s, X(v) + 0.5, Y(v) + 0.5, r, col); }
    function P1(v, col) { px(s, Math.round(X(v)), Math.round(Y(v)), col); }

    var legL = p.legL || 0, legR = p.legR || 0, armL = p.armL || 0, armR = p.armR || 0;
    var hipL = [R.hip[0] - 2, R.hip[1]], hipR = [R.hip[0] + 2, R.hip[1]];
    var footL = limbEnd(hipL, legL, c.leg), footR = limbEnd(hipR, legR, c.leg);
    var handL = limbEnd(R.shL, armL + R.lean * 0.3, c.arm), handR = limbEnd(R.shR, armR + R.lean * 0.3, c.arm);

    // the far arm (L) behind everything
    arm(R.shL, handL, true);
    // legs: trousers, boots, the peg at each hip
    L(hipL, footL, 3, c.trousers); L(hipR, footR, 3, c.trousers);
    boot(footL, legL); boot(footR, legR);
    // torso: a turned barrel, lit on the left, a belt, the apron
    var hw = c.width / 2;
    for (var k = 0; k <= c.torso; k++) {
      var yy = R.hipY - k, bulge = k < 2 ? -1 : k > c.torso - 2 ? -1 : 0;
      var a = R.body(-hw - bulge, yy), b = R.body(hw + bulge, yy);
      L(a, b, 1, c.coat);
      P1(R.body(-hw - bulge + 1, yy), c.coat2);
    }
    // buttons down the front, a belt
    var belt = R.hipY - 2;
    L(R.body(-hw, belt), R.body(hw, belt), 1, '#1a1410');
    P1(R.body(1, belt), P.BRASS3);
    if (c.apron) {
      for (k = 0; k < 7; k++) { var ay = R.hipY - 3 + k; L(R.body(-hw + 1, ay), R.body(hw - 1, ay), 1, k === 0 ? P.APRON2 : P.APRON); }
      P1(R.body(-hw + 2, R.hipY - 2), P.APRON2);
    } else {
      P1(R.body(0, R.hipY - c.torso + 4), P.BRASS3); P1(R.body(0, R.hipY - c.torso + 7), P.BRASS3);
    }
    // a chip of paint gone from the coat: bare linden underneath
    P1(R.body(hw - 2, R.hipY - c.torso + 5), P.WOOD_BARE);
    // hip pegs
    P1(hipL, P.WOOD_BARE_D); P1(hipR, P.WOOD_BARE);
    // head: a turned ball, painted face
    head(R);
    // the near arm and the tool
    tool(fig.tool, handR, armR + R.lean * 0.3 + (p.toolA || 0), fig);
    arm(R.shR, handR, false);

    // outline the silhouette and blit it
    outline(sc, SZ);
    g.drawImage(sc, Math.round(fig.x - O), Math.round(fig.y - O - 16));

    function arm(shp, hand, far) {
      L(shp, hand, 2, far ? c.coat : c.coat2);
      if (!far) L([shp[0], shp[1]], [shp[0] + (hand[0] - shp[0]) * 0.4, shp[1] + (hand[1] - shp[1]) * 0.4], 1, c.coat);
      D(hand, 1.2, far ? P.FACE_D : P.FACE);           // the mitten hand
      P1(shp, far ? P.WOOD_BARE_D : P.WOOD_BARE);      // the shoulder peg
    }
    function boot(ft, a) {
      var tx = ft[0] + 2, ty = ft[1];
      L([ft[0] - 1, ty], [tx, ty], 2, P.BOOT);
      P1([tx, ty - 1], '#3a3440');
    }
    function head(Rg) {
      var hc = Rg.headC, fx = 1; // painted face offset toward `facing`
      D(hc, 3.6, P.FACE);
      P1([hc[0] - 3, hc[1] - 1], P.FACE_D); P1([hc[0] - 3, hc[1]], P.FACE_D); P1([hc[0] - 2, hc[1] + 2], P.FACE_D);
      // eyes: two dots of black paint, a little too far apart
      P1([hc[0] + fx - 1, hc[1] - 1], P.INK); P1([hc[0] + fx + 2, hc[1] - 1], P.INK);
      if (c.specs) { P1([hc[0] + fx - 1, hc[1] - 2], '#c8d8e8'); P1([hc[0] + fx + 2, hc[1] - 2], '#c8d8e8'); P1([hc[0] + fx, hc[1] - 1], '#8a8a96'); }
      // a rosy cheek, a nose
      P1([hc[0] + fx + 2, hc[1] + 1], P.CHEEK);
      if (c.nose) { P1([hc[0] + fx + 1, hc[1]], '#d05050'); P1([hc[0] + fx + 1, hc[1] + 1], '#e06060'); }
      else P1([hc[0] + fx + 1, hc[1]], P.FACE_D);
      beard(hc, fx);
      cap(hc, fx);
    }
    function beard(hc, fx) {
      var bc = c.beardC, bd = A.mix(bc || '#000000', '#000000', 0.3);
      switch (c.beard) {
        case 'long': // to the knees, a wedge that narrows
          for (var k = 0; k < 16; k++) {
            var w = Math.max(1, 3 - Math.floor(k / 5));
            L([hc[0] + fx - w + 1 + k * 0.08, hc[1] + 2 + k], [hc[0] + fx + w + k * 0.08, hc[1] + 2 + k], 1, k % 4 === 3 ? P.BEARD_D : bc);
          }
          P1([hc[0] + fx + 1, hc[1] + 1], bc); P1([hc[0] + fx - 1, hc[1] + 1], bc);
          break;
        case 'spade':
          for (k = 0; k < 5; k++) L([hc[0] + fx - 2, hc[1] + 2 + k], [hc[0] + fx + 3, hc[1] + 2 + k], 1, k === 4 ? bd : bc);
          break;
        case 'short':
          L([hc[0] + fx - 2, hc[1] + 2], [hc[0] + fx + 3, hc[1] + 2], 1, bc); L([hc[0] + fx - 1, hc[1] + 3], [hc[0] + fx + 2, hc[1] + 3], 1, bc);
          P1([hc[0] - 2, hc[1] + 1], bc);
          break;
        case 'chops':
          L([hc[0] - 3, hc[1]], [hc[0] - 2, hc[1] + 3], 1, bc); L([hc[0] + 3, hc[1]], [hc[0] + 3, hc[1] + 2], 1, bc);
          L([hc[0] + fx - 1, hc[1] + 1], [hc[0] + fx + 2, hc[1] + 1], 1, bc);
          break;
        case 'mustache':
          L([hc[0] + fx - 1, hc[1] + 1], [hc[0] + fx + 3, hc[1] + 1], 1, bc);
          break;
      }
    }
    function cap(hc, fx) {
      var top = hc[1] - 3;
      if (c.hat === 'felt') {
        // a hardened felt hat, tall and slightly crushed, candle stuck on with clay
        L([hc[0] - 4, top + 1], [hc[0] + 4, top + 1], 1, P.CAP);          // brim
        for (var k = 0; k < 6; k++) L([hc[0] - 3 + (k > 4 ? 1 : 0), top - k], [hc[0] + 3 - (k > 3 ? 1 : 0), top - k], 1, k === 5 ? P.CAP2 : P.CAP);
        P1([hc[0] - 3, top - 2], P.CAP2);
        candle([hc[0] + fx + 1, top - 3]);
      } else if (c.hat === 'bowler') {
        L([hc[0] - 4, top + 1], [hc[0] + 4, top + 1], 1, P.CAP);
        for (k = 0; k < 3; k++) L([hc[0] - 3 + (k === 2 ? 1 : 0), top - k], [hc[0] + 3 - (k === 2 ? 1 : 0), top - k], 1, P.CAP);
        P1([hc[0] - 2, top - 1], P.CAP2);
        candle([hc[0] + fx + 2, top - 1]);
      } else {
        // a soft cloth cap with a peak, the lamp on the front
        for (k = 0; k < 3; k++) L([hc[0] - 4 + (k === 2 ? 1 : 0), top - k + 1], [hc[0] + 3 - (k === 2 ? 1 : 0), top - k + 1], 1, k === 2 ? P.CAP2 : P.CAP);
        L([hc[0] + 2, top + 1], [hc[0] + 5, top + 1], 1, P.CAP);            // the peak
        P1([hc[0] - 4, top + 2], P.CAP);
        candle([hc[0] + fx + 1, top - 1]);
      }
    }
    function candle(v) {
      // brass clip, a stub of candle, the flame (flame is emissive in render)
      P1([v[0], v[1] + 1], P.BRASS3); P1([v[0], v[1]], P.BONE);
      if (fig.lamp !== false) { P1([v[0], v[1] - 1], P.FLAME1); P1([v[0], v[1] - 2], P.FLAME2); }
      else P1([v[0], v[1] - 1], '#3a3440');
    }
    function tool(kind, hand, a, fg) {
      if (!kind) return;
      var dir = [Math.sin(a), Math.cos(a)];
      function along(d, off) { return [hand[0] + dir[0] * d - dir[1] * (off || 0), hand[1] + dir[1] * d + dir[0] * (off || 0)]; }
      switch (kind) {
        case 'pick': {
          var e1 = along(-4), e2 = along(10);
          L(e1, e2, 1, P.TIM4);
          // the head: a curved steel bar across the handle's end
          var hd = along(10);
          L([hd[0] - dir[1] * 5, hd[1] + dir[0] * 5], [hd[0] + dir[1] * 4, hd[1] - dir[0] * 4], 1, P.IRON3);
          P1([hd[0] - dir[1] * 5 + dir[0], hd[1] + dir[0] * 5 + dir[1]], P.IRON3);
          P1([hd[0] + dir[1] * 4 + dir[0], hd[1] - dir[0] * 4 + dir[1]], P.IRON4);
          break;
        }
        case 'shovel': {
          L(along(-3), along(15), 1, P.TIM4);
          var bl = along(16);
          for (var k = 0; k < 5; k++) L([bl[0] - dir[1] * 2 + dir[0] * k, bl[1] + dir[0] * 2 + dir[1] * k], [bl[0] + dir[1] * 2 + dir[0] * k, bl[1] - dir[0] * 2 + dir[1] * k], 1, k === 0 ? P.IRON4 : P.IRON3);
          L(along(-3, -1), along(-3, 1), 1, P.TIM3); // the D-grip
          break;
        }
        case 'mallet': {
          L(along(-1), along(7), 1, P.TIM4);
          var mh = along(8);
          for (k = -2; k <= 2; k++) L([mh[0] - dir[1] * k, mh[1] + dir[0] * k], [mh[0] - dir[1] * k + dir[0] * 3, mh[1] + dir[0] * k + dir[1] * 3], 1, k === -2 ? P.END : P.TIM3);
          break;
        }
        case 'cane':
          L(along(-2), along(c.leg + 5), 1, P.TIM3); P1(along(-2, 1), P.TIM4);
          break;
        case 'lantern': {
          // a tin lantern swinging from the hand on its bail
          var lh = [hand[0], hand[1] + 2];
          P1([hand[0], hand[1] + 1], P.IRON3);
          rect(s, Math.round(X(lh) - 2), Math.round(Y(lh)), 5, 6, P.IRON2);
          rect(s, Math.round(X(lh) - 1), Math.round(Y(lh) + 1), 3, 4, P.FLAME1);
          px(s, Math.round(X(lh)), Math.round(Y(lh) + 2), P.FLAME2);
          L([lh[0] - 2, lh[1] - 1], [lh[0] + 2, lh[1] - 1], 1, P.IRON3);
          break;
        }
        case 'spike':
          L(along(-2), along(5), 1, P.IRON3); P1(along(-2), P.IRON4); L(along(-2, -1), along(-2, 1), 1, P.IRON3);
          break;
        case 'timber':
          L(along(-12), along(12), 3, P.TIM3); L(along(-12, -1), along(12, -1), 1, P.TIM4); P1(along(12), P.END); P1(along(-12), P.END);
          break;
        case 'tally':
          rect(s, Math.round(X(hand) - 1), Math.round(Y(hand) - 4), 4, 5, P.PAPER); px(s, Math.round(X(hand)), Math.round(Y(hand) - 3), P.INK_L);
          break;
        case 'marble':
          break; // the renderer draws the marble at fig.hold
      }
    }
  }

  var scr = null;
  function scratch(n) { if (!scr) scr = A.makeCanvas(n, n); return scr; }
  function outline(cv, n) {
    var g = cv.getContext('2d'), im = g.getImageData(0, 0, n, n), d = im.data, o = OUT.slice(1);
    var r = parseInt(o.slice(0, 2), 16), gg = parseInt(o.slice(2, 4), 16), b = parseInt(o.slice(4, 6), 16);
    var mark = new Uint8Array(n * n);
    for (var y = 1; y < n - 1; y++) for (var x = 1; x < n - 1; x++) {
      var i = y * n + x;
      if (d[i * 4 + 3]) continue;
      if (d[(i - 1) * 4 + 3] || d[(i + 1) * 4 + 3] || d[(i - n) * 4 + 3] || d[(i + n) * 4 + 3]) mark[i] = 1;
    }
    for (i = 0; i < n * n; i++) if (mark[i]) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
  }

  // where the candle flame is (board space)
  function figureLamp(fig) {
    var R = rig(fig), c = R.c, f = fig.facing < 0 ? -1 : 1, hc = R.headC;
    var top = hc[1] - 3, v;
    if (c.hat === 'felt') v = [hc[0] + 2, top - 5];
    else if (c.hat === 'bowler') v = [hc[0] + 3, top - 3];
    else v = [hc[0] + 2, top - 3];
    var out = { x: fig.x + v[0] * f, y: fig.y + v[1] };
    if (fig.tool === 'lantern') {
      var hand = limbEnd(R.shR, (fig.pose && fig.pose.armR || 0) + R.lean * 0.3, c.arm);
      out.lantern = { x: fig.x + hand[0] * f, y: fig.y + hand[1] + 5 };
    }
    return out;
  }
  // the hands, for carrying things (the marble in a theft)
  function figureHands(fig) {
    var R = rig(fig), c = R.c, p = R.p, f = fig.facing < 0 ? -1 : 1;
    var hL = limbEnd(R.shL, (p.armL || 0) + R.lean * 0.3, c.arm), hR = limbEnd(R.shR, (p.armR || 0) + R.lean * 0.3, c.arm);
    return { l: { x: fig.x + hL[0] * f, y: fig.y + hL[1] }, r: { x: fig.x + hR[0] * f, y: fig.y + hR[1] } };
  }

  A.drawFigure = drawFigure;
  A.figureLamp = figureLamp;
  A.figureHands = figureHands;

  var d = Math.PI / 180;
  // named poses (degrees → radians), a starting vocabulary for the animator
  A.POSES = {
    stand:   { lean: 0, head: 0, armL: -8 * d, armR: 8 * d, legL: -6 * d, legR: 6 * d },
    swingUp: { lean: -10 * d, head: -10 * d, armL: 150 * d, armR: 165 * d, legL: -12 * d, legR: 14 * d, toolA: 0 },
    swingDn: { lean: 20 * d, head: 15 * d, armL: 60 * d, armR: 70 * d, legL: -12 * d, legR: 14 * d, toolA: 30 * d },
    carry:   { lean: 5 * d, head: 0, armL: 90 * d, armR: 90 * d, legL: -18 * d, legR: 18 * d },
    push:    { lean: 30 * d, head: -10 * d, armL: 95 * d, armR: 100 * d, legL: -30 * d, legR: 20 * d },
    walkA:   { lean: 4 * d, head: 0, armL: 25 * d, armR: -20 * d, legL: 22 * d, legR: -22 * d },
    walkB:   { lean: 4 * d, head: 0, armL: -20 * d, armR: 25 * d, legL: -22 * d, legR: 22 * d },
    cheer:   { lean: -5 * d, head: -15 * d, armL: 165 * d, armR: -165 * d, legL: -15 * d, legR: 15 * d },
    point:   { lean: 0, head: -5 * d, armL: -5 * d, armR: 100 * d, legL: -6 * d, legR: 6 * d },
    sit:     { lean: -8 * d, head: 10 * d, armL: 30 * d, armR: 40 * d, legL: 90 * d, legR: 80 * d },
    hold:    { lean: 10 * d, head: 20 * d, armL: 50 * d, armR: 60 * d, legL: -6 * d, legR: 6 * d, toolA: -40 * d },
    lamp:    { lean: 0, head: -5 * d, armL: -8 * d, armR: 70 * d, legL: -6 * d, legR: 6 * d }
  };
})(typeof window !== 'undefined' ? window : globalThis);

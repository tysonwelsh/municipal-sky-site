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
 *                            // 'timber' | 'tally' | 'cane' | 'marble' | null
 *           lamp,            // the cap lamp is lit (default true)
 *           shadow,          // cast a shadow on the rock behind (default true)
 *           hold }           // optional {x, y}: a carried thing's centre (the marble)
 * Angles: arms and legs measure from straight down, positive swings
 * toward `facing`; lean tips the body about the hips (positive = forward,
 * added to each knocker's own stoop); head nods (positive = down).
 * Quantise angles to ~15° when animating and hold poses (~8 fps): they
 * move like stop-motion toys, pose to pose.
 *
 * figureLamp(fig) → {x, y} the lamp flame (for the lightmap);
 * figureHands(fig) → {l, r} hand positions; CREW: the six individuals.
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

  var scr = null, shd = null;
  function scratch(n) { if (!scr) { scr = A.makeCanvas(n, n); shd = A.makeCanvas(n, n); } return scr; }

  function drawFigure(g, fig) {
    var R = rig(fig), c = R.c, p = R.p, f = fig.facing < 0 ? -1 : 1;
    var SZ = 72, O = 36, OY = 54, sc = scratch(SZ), s = sc.getContext('2d');
    s.clearRect(0, 0, SZ, SZ);
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

    var legL = p.legL || 0, legR = p.legR || 0;
    var hipL = [-2, R.hipY], hipR = [2, R.hipY];
    var footL = limbEnd(hipL, legL, c.leg), footR = limbEnd(hipR, legR, c.leg);
    var aL = armAngle(R, p.armL || 0), aR = armAngle(R, p.armR || 0);
    var handL = limbEnd(R.shL, aL, c.arm), handR = limbEnd(R.shR, aR, c.arm);

    // the far arm, behind everything
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
    tool(fig.tool, handR, aR + (p.toolA || 0));
    arm(R.shR, handR, false);

    outline(sc, SZ);
    var ox = Math.round(fig.x - O), oy = Math.round(fig.y - OY);
    // the cast shadow: a toy stood a little way in front of the painted
    // rock throws its silhouette onto it, down and to the right
    if (fig.shadow !== false) {
      var h = shd.getContext('2d');
      h.globalCompositeOperation = 'copy'; h.drawImage(sc, 0, 0);
      h.globalCompositeOperation = 'source-in'; h.fillStyle = '#000000'; h.fillRect(0, 0, SZ, SZ);
      h.globalCompositeOperation = 'source-over';
      g.save(); g.globalAlpha = 0.42; g.drawImage(shd, ox + 3, oy + 2); g.restore();
      // and the dark patch it stands in
      g.save(); g.globalAlpha = 0.5; g.fillStyle = '#000';
      g.fillRect(Math.round(fig.x - 5), Math.round(fig.y), 11, 1); g.fillRect(Math.round(fig.x - 3), Math.round(fig.y) + 1, 7, 1);
      g.restore();
    }
    g.drawImage(sc, ox, oy);

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
      cap(hc, fx, r);
      P1([hc[0] - 1, hc[1] - r + 2], GLOSS);                // varnish on the dome (under the cap's edge)
    }
    function beard(hc, fx) {
      var bc = c.beardC, bd = c.beardD, r = c.head, k;
      function row(y, cx, w, col) { if (w <= 0) return; L([cx - (w - 1) / 2, y], [cx + (w - 1) / 2, y], 1, col); }
      var mx = hc[0] + fx + 1;                            // the mouth's centre, toward `facing`
      // grey hair under the back of the cap, and a sideburn down to the jaw
      P1([hc[0] - r + 1, hc[1] - 1], bc); P1([hc[0] - r + 1, hc[1]], bd); P1([hc[0] - r + 2, hc[1] + 1], bc);
      // widths row by row from the moustache down: the face shows above it
      // (gnome logic: the beard is wider than the chin and spills down the chest)
      var W = {
        knees: [5, 5, 7, 7, 7, 7, 6, 6, 6, 5, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 1],
        belt: [5, 5, 7, 7, 7, 6, 6, 5, 5, 4, 3, 2, 1],
        spade: [5, 5, 7, 7, 7, 7, 7, 6],
        short: [5, 5, 6, 5, 3],
        walrus: [6, 0, 0],
        goatee: [4, 2, 2, 2, 1]
      }[c.beard] || [];
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
      } else if (c.cap === 'peaked') {
        // a peaked cloth cap with a stiff visor (the tallyman's)
        for (k = 0; k < 3; k++) row(top - k, hc[0] - r + (k === 2 ? 1 : 0), hc[0] + r - (k === 2 ? 1 : 0), k === 2 ? c2 : cc);
        row(top + 1, hc[0] - r, hc[0] + r + 3, '#141418');
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
      if (fig.lamp !== false) { P1([lx, ly], P.FLAME2); P1([lx + 1, ly - 1], P.FLAME1); }
      else P1([lx, ly], '#3a3440');
    }
    function tool(kind, hand, a) {
      if (!kind) return;
      var dir = [Math.sin(a), Math.cos(a)];
      function along(dd, off) { return [hand[0] + dir[0] * dd - dir[1] * (off || 0), hand[1] + dir[1] * dd + dir[0] * (off || 0)]; }
      switch (kind) {
        case 'pick': {
          L(along(-4), along(11), 1, P.TIM4);
          var hd = along(11);
          L([hd[0] - dir[1] * 5, hd[1] + dir[0] * 5], [hd[0] + dir[1] * 5, hd[1] - dir[0] * 5], 1, P.IRON3);
          P1([hd[0] - dir[1] * 5 + dir[0], hd[1] + dir[0] * 5 + dir[1]], P.IRON3);
          P1([hd[0] + dir[1] * 5 + dir[0], hd[1] - dir[0] * 5 + dir[1]], P.IRON4);
          P1(hd, P.IRON4);
          break;
        }
        case 'shovel': {
          L(along(-3), along(16), 1, P.TIM4);
          var bl = along(17);
          for (var k = 0; k < 6; k++) L([bl[0] - dir[1] * 2.5 + dir[0] * k, bl[1] + dir[0] * 2.5 + dir[1] * k], [bl[0] + dir[1] * 2.5 + dir[0] * k, bl[1] - dir[0] * 2.5 + dir[1] * k], 1, k === 0 ? P.IRON4 : (k === 5 ? P.IRON2 : P.IRON3));
          L(along(-3, -1.5), along(-3, 1.5), 1, P.TIM3);   // the D-grip
          break;
        }
        case 'mallet': {
          L(along(-1), along(7), 1, P.TIM4);
          var mh = along(8);
          for (k = -2; k <= 2; k++) L([mh[0] - dir[1] * k, mh[1] + dir[0] * k], [mh[0] - dir[1] * k + dir[0] * 3, mh[1] + dir[0] * k + dir[1] * 3], 1, k === -2 ? P.END : P.TIM3);
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
        case 'tally':
          // a tally board, a column of strokes on it
          rect(s, Math.round(X(hand) - 2), Math.round(Y(hand) - 5), 5, 6, P.PAPER); rect(s, Math.round(X(hand) - 2), Math.round(Y(hand) - 6), 5, 1, P.TIM2);
          for (k = 0; k < 4; k++) px(s, Math.round(X(hand) - 1 + (k % 2) * 2), Math.round(Y(hand) - 4 + (k >> 1) * 2), P.INK_L);
          break;
        case 'marble':
          break; // the renderer draws the marble at fig.hold
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

  // where the cap lamp's flame is (board space)
  function figureLamp(fig) {
    var R = rig(fig), c = R.c, f = fig.facing < 0 ? -1 : 1, hc = R.headC;
    var top = hc[1] - c.head + 1, lx = hc[0] + 2, ly = top - 1;
    var out = { x: fig.x + lx * f, y: fig.y + ly };
    if (fig.tool === 'lantern') {
      var hand = limbEnd(R.shR, armAngle(R, (fig.pose && fig.pose.armR) || 0), c.arm);
      out.lantern = { x: fig.x + hand[0] * f, y: fig.y + hand[1] + 5 };
    }
    return out;
  }
  function figureHands(fig) {
    var R = rig(fig), c = R.c, p = R.p, f = fig.facing < 0 ? -1 : 1;
    var hL = limbEnd(R.shL, armAngle(R, p.armL || 0), c.arm), hR = limbEnd(R.shR, armAngle(R, p.armR || 0), c.arm);
    return { l: { x: fig.x + hL[0] * f, y: fig.y + hL[1] }, r: { x: fig.x + hR[0] * f, y: fig.y + hR[1] } };
  }
  // the figure's bounding box (for placing them clear of pins)
  function figureBox(fig) {
    var c = CREW[fig.who] || CREW.pick, h = c.leg + c.torso + c.head * 2 + 6;
    return { x: fig.x - 8, y: fig.y - h, w: 16, h: h };
  }

  A.drawFigure = drawFigure;
  A.figureLamp = figureLamp;
  A.figureHands = figureHands;
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
})(typeof window !== 'undefined' ? window : globalThis);

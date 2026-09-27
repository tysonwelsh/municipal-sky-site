/* MOTHER LODE — the mine as data (PLAN §3)
 *
 * Pure: no DOM, no Math.random, no Date. Loads in the browser
 * (window.PachinkoBoard) and in Node (module.exports) for the lab.
 *
 * BOARD SPACE = the glass interior, 320 × 416 px, origin top-left, y down.
 * The physics and the renderer share it (a flat cross-section, no projection).
 *
 * THE MINE (top to bottom; see REGIONS):
 *   surface    painted sky and ridge, the headframe over the main shaft
 *              (two posts, a back-leg brace, the sheave wheel spinning at
 *              the top), fence posts, the tipple's rivets.
 *   overburden the first rock band: the ground crust, pierced by the main
 *              shaft (under the headframe), an air shaft and old prospect
 *              pits. Its top is the grass line.
 *   haulage    the main haulage way: the big level-1 gallery, pin field
 *              of rail spikes and lamp hooks, timber sets, the ore cart on
 *              its track along the floor, the ventilation door swinging
 *              on the right, and behind it the scratched-out tunnel.
 *   floor1     rock band under the haulage way (the cart dumps into its chute).
 *   workings   the old workings: crooked props, bones, the lunch pail
 *              pocket, the old drift's mouth on the far left.
 *   floor2     rock band under the old workings.
 *   sump       bottom left: the dry sump and the old pump wheel.
 *   vein       bottom right: ore knuckles along the seam, the big ribs,
 *              and the guarded 13 (THE MOTHER LODE).
 *   payout     the slot floor: thirteen slots between timber props.
 *
 * FIXTURES (board.fixtures, each {id, kind, region, material, dress, …}):
 *   pin    {x, y, r}                             a circle
 *   rail   {x1, y1, x2, y2, r}                   a capsule segment (both faces collide)
 *   cart   {x1, x2, y, w, h, period, phase, dump:'right'|'left'}
 *          a kinematic ore cart on a track at height y (the track top);
 *          pose(cart, t) says where it is
 *   wheel  {x, y, r, hub, paddles, mode:'spin'|'swing', omega | amp+period, theta0}
 *          kinematic paddles around a hub (the sheave wheel, the pump
 *          wheel) or a hinged flap (the ventilation door: paddles 1, swing)
 *   tunnel {a:{x,y,r}, b:{x,y,vx,vy}, delay, open} a hidden path
 *   pocket {x, y, w, value, legend}               a catcher on a ledge
 *   slot   {x0, x1, value, legend, label}         a payout slot (y ≥ SLOT_Y)
 *
 * The `dress` string is the art hint: pins are 'spike' | 'lamphook' |
 * 'prop' | 'ore' | 'coal' | 'rib' | 'rivet' | 'fencepost' | 'root' | 'bolt';
 * rails are 'floor' | 'track' | 'timber' | 'post' | 'brace' | 'rock' |
 * 'ceiling' | 'wall' | 'chute' | 'divider' | 'pillar'. Materials drive the
 * physics (restitution, friction) and the sound: 'steel' | 'timber' |
 * 'rock' | 'ore' | 'bone' | 'brass'.
 *
 * board.bands: the rock bands as polygons (for the art to fill, and where
 * the specimens sit). board.decor: non-colliding things the art may draw
 * (ladders, lamps, specimens, the headframe outline, the seam line).
 *
 * DRIFT (PLAN §3): EDITS lists the legal edit types; drawEdits(board, seed, n)
 * draws n of them; applyEdit(board, edit) returns a NEW board; validate(board,
 * physics, opts) runs the fairness gates (§10) with the physics module passed in.
 */
(function (root) {
  'use strict';

  var W = 320, H = 416;
  var SLOT_Y = 398;      // a marble whose centre passes this line has resolved into a slot
  var MARBLE_R = 4;

  function hash01(seed, i) {
    var h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((i | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function strSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

  var REGIONS = [
    { id: 'surface',    name: 'Surface',              x: 0,   y: 0,   w: 320, h: 58,  depth: 0 },
    { id: 'overburden', name: 'Overburden',           x: 0,   y: 58,  w: 320, h: 18,  depth: 1 },
    { id: 'haulage',    name: 'Main haulage way',     x: 0,   y: 76,  w: 250, h: 68,  depth: 2 },
    { id: 'ventdoor',   name: 'Ventilation door',     x: 250, y: 76,  w: 70,  h: 68,  depth: 2 },
    { id: 'floor1',     name: 'Rock (No. 1 floor)',   x: 0,   y: 144, w: 320, h: 20,  depth: 3 },
    { id: 'workings',   name: 'The old workings',     x: 0,   y: 164, w: 320, h: 72,  depth: 4 },
    { id: 'floor2',     name: 'Rock (No. 2 floor)',   x: 0,   y: 236, w: 320, h: 18,  depth: 5 },
    { id: 'sump',       name: 'The sump (dry)',       x: 0,   y: 254, w: 104, h: 118, depth: 6 },
    { id: 'vein',       name: 'The vein',             x: 104, y: 254, w: 216, h: 118, depth: 6 },
    { id: 'payout',     name: 'Payout floor',         x: 0,   y: 372, w: 320, h: 44,  depth: 7 }
  ];
  function regionAt(x, y) {
    for (var i = 0; i < REGIONS.length; i++) {
      var r = REGIONS[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r.id;
    }
    return y < 0 ? 'surface' : 'payout';
  }

  /* ── the base layout ─────────────────────────────────────────────── */

  function buildBase() {
    var F = [];              // fixtures
    var bands = [];          // rock band polygons
    var decor = [];          // things drawn but not collided
    function pin(id, x, y, material, dress, extra) {
      var p = { id: id, kind: 'pin', x: x, y: y, r: 1.5, region: regionAt(x, y), material: material, dress: dress };
      if (extra) for (var k in extra) p[k] = extra[k];
      F.push(p); return p;
    }
    function rail(id, x1, y1, x2, y2, material, dress, extra) {
      var r = { id: id, kind: 'rail', x1: x1, y1: y1, x2: x2, y2: y2, r: 1, region: regionAt((x1 + x2) / 2, (y1 + y2) / 2), material: material, dress: dress };
      if (extra) for (var k in extra) r[k] = extra[k];
      F.push(r); return r;
    }

    // the glass case's side walls (the art draws the case frame over them)
    rail('wall.l', -1, -40, -1, H + 20, 'timber', 'wall', { region: 'surface' });
    rail('wall.r', W + 1, -40, W + 1, H + 20, 'timber', 'wall', { region: 'surface' });

    /* a rock band: a floor with openings. Each piece between openings is a
     * low mound (its crest in the middle, falling ~crest px to each
     * opening) so a marble on it rolls to the nearer opening. Pieces are
     * closed with rock end-walls and a ceiling underneath. */
    function band(id, yTop, yBot, openings, opts) {
      opts = opts || {};
      var crest = opts.crest == null ? 4 : opts.crest;
      var edges = [0];
      openings.forEach(function (o) { edges.push(o.x - o.w / 2, o.x + o.w / 2); });
      edges.push(W);
      var pieces = [];
      for (var i = 0; i < edges.length; i += 2) {
        var a = edges[i], b = edges[i + 1];
        if (b - a < 2) continue;
        var pid = id + '.' + (i / 2);
        var ov = (opts.pieces && opts.pieces[i / 2]) || {};
        var cx = ov.crestX != null ? ov.crestX : (a === 0 ? a : b === W ? b : (a + b) / 2);
        var yEdge = yTop + crest, yC = yTop;
        var mat = ov.material || opts.material || 'timber', dr = ov.dress || opts.dress || 'floor';
        var poly = [];
        if (cx > a + 0.5) { rail(pid + '.fl', a, yEdge, cx, yC, mat, dr); poly.push([a, yEdge], [cx, yC]); }
        else poly.push([a, yC]);
        if (cx < b - 0.5) { rail(pid + '.fr', cx, yC, b, yEdge, mat, dr); poly.push([b, yEdge]); }
        else poly.push([b, yC]);
        if (a > 0) rail(pid + '.el', a, a === cx ? yC : yEdge, a, yBot, 'rock', 'rock');
        if (b < W) rail(pid + '.er', b, b === cx ? yC : yEdge, b, yBot, 'rock', 'rock');
        rail(pid + '.c', a, yBot, b, yBot, 'rock', 'ceiling');
        poly.push([b, yBot], [a, yBot]);
        pieces.push({ id: pid, x0: a, x1: b, crestX: cx, poly: poly });
      }
      bands.push({ id: id, yTop: yTop, yBot: yBot, openings: openings, pieces: pieces, region: regionAt(W / 2, (yTop + yBot) / 2) });
    }

    /* a staggered pin field */
    function field(prefix, rows, dressFn, matFn, opts) {
      opts = opts || {};
      var jit = opts.jitter || 0;
      rows.forEach(function (row, ri) {
        for (var x = row.x0, ci = 0; x <= row.x1 + 0.01; x += row.dx, ci++) {
          var id = prefix + '.' + ri + '.' + ci;
          if (opts.skip && opts.skip(x, row.y, ri, ci)) continue;
          var s = strSeed(id);
          var jx = jit ? Math.round((hash01(s, 1) * 2 - 1) * jit) : 0;
          var jy = jit ? Math.round((hash01(s, 2) * 2 - 1) * jit) : 0;
          var d = dressFn(x, row.y, ri, ci, s);
          pin(id, x + jx, row.y + jy, matFn(d), d, { drift: true });
        }
      });
    }
    var MAT = { spike: 'steel', lamphook: 'steel', rivet: 'steel', bolt: 'steel', prop: 'timber', fencepost: 'timber', root: 'timber', ore: 'ore', coal: 'rock', rib: 'bone' };
    function mat(d) { return MAT[d] || 'steel'; }

    /* ── surface ──────────────────────────────────────────────────── */
    // the headframe over the main shaft: two posts, the back-leg brace, the sheave wheel
    rail('headframe.postL', 74, 30, 74, 58, 'timber', 'post');
    rail('headframe.postR', 94, 30, 94, 58, 'timber', 'post');
    rail('headframe.brace', 96, 30, 132, 58, 'timber', 'brace');
    F.push({ id: 'sheave', kind: 'wheel', x: 84, y: 20, r: 11, hub: 2.5, paddles: 6, mode: 'spin', omega: 2.4, theta0: 0,
      region: 'surface', material: 'steel', dress: 'sheave' });
    // fence posts and the tipple's rivets (two staggered rows)
    field('surface', [
      { y: 34, x0: 16, x1: 304, dx: 24 },
      { y: 47, x0: 28, x1: 304, dx: 24 }
    ], function (x, y) { return x > 150 && x < 250 && y < 40 ? 'rivet' : 'fencepost'; }, mat, {
      skip: function (x, y) { return (x > 62 && x < 140); }
    });
    decor.push({ kind: 'headframe', x: 84, y: 20, posts: [74, 94], top: 30, ground: 58, brace: [96, 30, 132, 58] });

    /* ── overburden (the ground crust) ────────────────────────────── */
    band('overburden', 60, 76, [
      { x: 22, w: 14, name: 'air shaft' },
      { x: 84, w: 18, name: 'main shaft' },
      { x: 146, w: 14, name: 'prospect pit' },
      { x: 204, w: 14, name: 'old pit' },
      { x: 262, w: 14, name: 'dog hole' },
      { x: 306, w: 14, name: 'sinkhole' }
    ], { material: 'rock', dress: 'floor', crest: 3 });

    /* ── the main haulage way ─────────────────────────────────────── */
    field('haulage', [
      { y: 88, x0: 12, x1: 244, dx: 16 },
      { y: 100, x0: 20, x1: 244, dx: 16 },
      { y: 112, x0: 12, x1: 244, dx: 16 },
      { y: 124, x0: 20, x1: 236, dx: 16 }
    ], function (x, y, ri, ci) {
      if (ri === 0 && ci % 4 === 1) return 'lamphook';
      return 'spike';
    }, mat, { skip: function (x, y, ri) { return ri === 3 && x > 36 && x < 120; } });
    // timber sets (the lower half of each post collides; the cap is the ceiling)
    rail('haulage.set1', 128, 120, 128, 144, 'timber', 'post');
    rail('haulage.set2', 192, 120, 192, 144, 'timber', 'post');
    decor.push({ kind: 'timberset', x0: 124, x1: 132, y0: 76, y1: 144 }, { kind: 'timberset', x0: 188, x1: 196, y0: 76, y1: 144 });
    // the ventilation door, swinging from its lintel
    F.push({ id: 'ventdoor', kind: 'wheel', x: 270, y: 78, r: 40, hub: 2, paddles: 1, mode: 'swing', amp: 0.55, period: 3.4, theta0: Math.PI / 2,
      region: 'ventdoor', material: 'timber', dress: 'door' });
    field('ventdoor', [
      { y: 100, x0: 294, x1: 310, dx: 16 },
      { y: 124, x0: 254, x1: 310, dx: 16 }
    ], function () { return 'bolt'; }, mat);

    /* ── floor 1 (under the haulage way) ─────────────────────────── */
    band('floor1', 144, 164, [
      { x: 20, w: 14, name: 'ladderway' },
      { x: 128, w: 16, name: 'cart chute' },
      { x: 192, w: 14, name: 'manway' },
      { x: 244, w: 14, name: 'raise' },
      { x: 300, w: 16, name: 'tunnel', tunnel: 'tunnel.door' }
    ], { material: 'timber', dress: 'floor', crest: 3, pieces: { 1: { crestX: 27, dress: 'track', material: 'steel' } } });
    // the ore cart runs the track from the ladderway to the chute and tips into it
    F.push({ id: 'cart', kind: 'cart', x1: 46, x2: 108, y: 144, w: 24, h: 9, period: 7.0, phase: 0.1, dump: 'right',
      region: 'haulage', material: 'steel', dress: 'orecart' });

    /* ── the old workings ─────────────────────────────────────────── */
    field('workings', [
      { y: 176, x0: 14, x1: 306, dx: 18 },
      { y: 190, x0: 23, x1: 306, dx: 18 },
      { y: 204, x0: 14, x1: 306, dx: 18 },
      { y: 218, x0: 23, x1: 306, dx: 18 }
    ], function (x, y, ri, ci, s) {
      var h = hash01(s, 7);
      if (h < 0.12) return 'rib';
      if (h < 0.34) return 'prop';
      if (ri === 0 && h > 0.85) return 'lamphook';
      return 'spike';
    }, mat, { jitter: 2, skip: function (x, y, ri) { return (ri === 3 && x > 212 && x < 240); } });
    // a crooked timber chute and a slumped prop
    rail('workings.chute', 150, 196, 176, 206, 'timber', 'chute');
    rail('workings.slump', 262, 202, 276, 222, 'timber', 'timber');
    // the lunch pail sits on the No. 2 floor, its lip two rivets
    pin('pail.lipL', 219, 228, 'steel', 'bolt');
    pin('pail.lipR', 235, 228, 'steel', 'bolt');
    F.push({ id: 'pail', kind: 'pocket', x: 227, y: 229, w: 13, value: 2, legend: 6,
      region: 'workings', material: 'steel', dress: 'lunchpail' });

    /* ── floor 2 (under the old workings) ────────────────────────── */
    band('floor2', 236, 254, [
      { x: 14, w: 14, name: 'old drift', tunnel: 'tunnel.drift' },
      { x: 66, w: 14, name: 'winze' },
      { x: 120, w: 14, name: 'chute' },
      { x: 174, w: 14, name: 'raise' },
      { x: 272, w: 14, name: 'manway' },
      { x: 308, w: 12, name: 'crack' }
    ], { material: 'timber', dress: 'floor', crest: 3, pieces: { 4: { crestX: 227 } } });

    /* ── the tunnels ──────────────────────────────────────────────── */
    // behind the ventilation door: the one scratched out of the legend
    F.push({ id: 'tunnel.door', kind: 'tunnel', a: { x: 300, y: 150, r: 7 }, b: { x: 14, y: 262, vx: 30, vy: 20 }, delay: 1.4, open: true,
      region: 'ventdoor', material: 'rock', dress: 'tunnel', legend: 4 });
    // the old drift, from the far left of the workings to the vein
    F.push({ id: 'tunnel.drift', kind: 'tunnel', a: { x: 14, y: 242, r: 7 }, b: { x: 150, y: 262, vx: 24, vy: 16 }, delay: 1.1, open: true,
      region: 'workings', material: 'rock', dress: 'tunnel', legend: 5 });

    /* ── the sump (dry) ───────────────────────────────────────────── */
    F.push({ id: 'pump', kind: 'wheel', x: 50, y: 306, r: 18, hub: 3, paddles: 4, mode: 'spin', omega: -1.3, theta0: 0.3,
      region: 'sump', material: 'timber', dress: 'pumpwheel' });
    field('sump', [
      { y: 272, x0: 14, x1: 94, dx: 20 },
      { y: 340, x0: 12, x1: 92, dx: 16 },
      { y: 354, x0: 20, x1: 92, dx: 16 }
    ], function (x, y) { return y > 330 ? 'root' : 'spike'; }, mat);
    rail('sump.pillar', 104, 262, 104, 318, 'rock', 'pillar');

    /* ── the vein ─────────────────────────────────────────────────── */
    field('vein', [
      { y: 268, x0: 118, x1: 306, dx: 16 },
      { y: 281, x0: 126, x1: 306, dx: 16 },
      { y: 294, x0: 118, x1: 306, dx: 16 },
      { y: 307, x0: 126, x1: 306, dx: 16 },
      { y: 320, x0: 118, x1: 306, dx: 16 },
      { y: 333, x0: 126, x1: 306, dx: 16 },
      { y: 346, x0: 110, x1: 306, dx: 16 }
    ], function (x, y) {
      // the seam runs down-left to up-right through the field: ore along it
      var seam = y - (360 - (x - 110) * 0.42);
      if (Math.abs(seam) < 8) return 'ore';
      if (x > 244 && y > 296) return 'rib';
      return 'coal';
    }, mat, { skip: function (x, y) { return (x > 230 && x < 280 && y > 300 && y < 330 && ((x + y) % 32 === 0)); } });

    /* ── the payout floor ─────────────────────────────────────────── */
    // thirteen slots; the 13 (THE MOTHER LODE) is the narrow one right of centre
    var DIV = [0, 26, 50, 74, 98, 122, 146, 170, 184, 208, 232, 256, 282, 320];
    var SLOTS = [
      { value: 0,  label: 'GOB' },
      { value: 1,  label: 'SLATE' },
      { value: 0,  label: 'BONY' },
      { value: 2,  label: 'STEAM' },
      { value: 0,  label: 'SLACK' },
      { value: 1,  label: 'STOKER' },
      { value: 3,  label: 'SMITHING' },
      { value: 13, label: 'THE MOTHER LODE' },
      { value: 3,  label: 'BLOCK' },
      { value: 1,  label: 'CANNEL' },
      { value: 0,  label: 'CULM' },
      { value: 2,  label: 'EGG' },
      { value: 0,  label: 'OVERBURDEN' }
    ];
    for (var i = 1; i < DIV.length - 1; i++) {
      rail('div.' + i, DIV[i], 378, DIV[i], H + 8, 'timber', 'divider', { r: 1.5 });
      pin('divcap.' + i, DIV[i], 376, 'brass', 'bolt');
    }
    for (var j = 0; j < SLOTS.length; j++) {
      F.push({ id: 'slot.' + j, kind: 'slot', x0: DIV[j], x1: DIV[j + 1], y: SLOT_Y, value: SLOTS[j].value,
        legend: 20 + j, label: SLOTS[j].label, region: 'payout', material: 'timber', dress: SLOTS[j].value === 13 ? 'lode' : 'slot' });
    }
    // the guard over the 13: two ore knuckles and a bone
    pin('guard.l', 165, 362, 'ore', 'ore', { drift: true });
    pin('guard.r', 189, 362, 'ore', 'ore', { drift: true });
    pin('guard.top', 177, 352, 'bone', 'rib', { drift: true });
    // a last row of props over the other slots
    [38, 62, 86, 110, 134, 220, 244, 269, 301].forEach(function (x, k) {
      pin('payout.' + k, x, 364 + (k % 2) * 4, 'timber', 'prop', { drift: true });
    });

    /* ── decor: lamps, ladders, specimens ─────────────────────────── */
    decor.push(
      { kind: 'ladder', x: 20, y0: 144, y1: 236 },
      { kind: 'ladder', x: 192, y0: 144, y1: 200 },
      { kind: 'ladder', x: 272, y0: 236, y1: 300 },
      { kind: 'lamp', x: 60, y: 80, region: 'haulage' },
      { kind: 'lamp', x: 160, y: 80, region: 'haulage' },
      { kind: 'lamp', x: 232, y: 80, region: 'haulage' },
      { kind: 'lamp', x: 290, y: 82, region: 'ventdoor' },
      { kind: 'lamp', x: 100, y: 168, region: 'workings' },
      { kind: 'lamp', x: 250, y: 168, region: 'workings' },
      { kind: 'lamp', x: 40, y: 262, region: 'sump' },
      { kind: 'lamp', x: 200, y: 260, region: 'vein' },
      { kind: 'seam', x1: 110, y1: 360, x2: 310, y2: 276 },
      { kind: 'moon', x: 262, y: 14 },
      // specimens set in the rock (Fig. numbers match the legend)
      { kind: 'specimen', what: 'keys',        x: 176, y: 68,  fig: 1, label: 'Fig. 1: keys (ring of 3), house unknown' },
      { kind: 'specimen', what: 'plaque',      x: 236, y: 68,  fig: 2, label: 'Fig. 2: company plaque, name removed' },
      { kind: 'specimen', what: 'fern',        x: 60,  y: 156, fig: 3, label: 'Fig. 3: seed fern, Carboniferous' },
      { kind: 'specimen', what: 'payroll',     x: 218, y: 156, fig: 4, label: 'Fig. 4: payroll, sealed' },
      { kind: 'specimen', what: 'dollarm',     x: 300, y: 188, fig: 5, label: "Fig. 5: doll's arm (left)" },
      { kind: 'specimen', what: 'trilobite',   x: 148, y: 246, fig: 6, label: 'Fig. 6: trilobite, surprised' },
      { kind: 'specimen', what: 'watch',       x: 96,  y: 246, fig: 7, label: 'Fig. 7: pocket watch, still going' },
      { kind: 'specimen', what: 'ring',        x: 214, y: 300, fig: 8, label: 'Fig. 8: wedding ring' },
      { kind: 'specimen', what: 'ribs',        x: 276, y: 318, fig: 9, label: 'Fig. 9: ribs, something large' },
      { kind: 'specimen', what: 'ledgers',     x: 28,  y: 360, fig: 10, label: 'Fig. 10: ledgers, 1921–1923' },
      { kind: 'specimen', what: 'strongbox',   x: 140, y: 360, fig: 11, label: 'Fig. 11: strongbox (locked)' }
    );

    var legend = [
      { n: 1, text: 'Headframe and sheave wheel', ref: 'sheave' },
      { n: 2, text: 'Main haulage way', ref: 'haulage' },
      { n: 3, text: 'Ventilation door', ref: 'ventdoor' },
      { n: 4, text: 'Tunnel to the company office', ref: 'tunnel.door', scratched: true },
      { n: 5, text: 'The old drift (abandoned 1923)', ref: 'tunnel.drift' },
      { n: 6, text: "Miner's lunch pail", ref: 'pail' },
      { n: 7, text: 'The sump (dry)', ref: 'sump' },
      { n: 8, text: 'Pump wheel', ref: 'pump' },
      { n: 9, text: 'The vein', ref: 'vein' },
      { n: 10, text: 'Ore cart (4 ton)', ref: 'cart' }
    ];
    for (var s = 0; s < SLOTS.length; s++) legend.push({ n: 20 + s, text: SLOTS[s].label + (SLOTS[s].value ? ' — ' + SLOTS[s].value : ' — nothing'), ref: 'slot.' + s, slot: true });

    return finish({ W: W, H: H, SLOT_Y: SLOT_Y, MARBLE_R: MARBLE_R, drop: { y: 8, x0: 10, x1: W - 10 },
      regions: REGIONS, fixtures: F, bands: bands, decor: decor, legend: legend, edits: [], gen: 0 });
  }

  // index the fixtures by id and by kind (not serialised; rebuilt after edits)
  function finish(b) {
    var byId = {}, byKind = { pin: [], rail: [], cart: [], wheel: [], tunnel: [], pocket: [], slot: [], rubble: [] };
    b.fixtures.forEach(function (f) { byId[f.id] = f; (byKind[f.kind] = byKind[f.kind] || []).push(f); });
    Object.defineProperty(b, 'byId', { value: byId, enumerable: false, configurable: true });
    Object.defineProperty(b, 'byKind', { value: byKind, enumerable: false, configurable: true });
    return b;
  }

  /* ── kinematics (pure functions of time; physics and render share them) ── */

  // the ore cart: dwell at the left, roll right, dwell and TIP at the dump end, roll back
  var CART_PHASES = { dwellA: 0.14, go: 0.34, dwellB: 0.18, back: 0.34 };
  function smooth(u) { return u * u * (3 - 2 * u); }
  function cartPose(c, t) {
    var u = ((t / c.period + c.phase) % 1 + 1) % 1, P = CART_PHASES, s, tilt = 0, dumping = false;
    var dirR = c.dump !== 'left';
    if (u < P.dwellA) s = 0;
    else if (u < P.dwellA + P.go) s = smooth((u - P.dwellA) / P.go);
    else if (u < P.dwellA + P.go + P.dwellB) {
      s = 1; var k = (u - P.dwellA - P.go) / P.dwellB;
      tilt = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 1.05; dumping = k > 0.12 && k < 0.8;
    } else s = 1 - smooth((u - P.dwellA - P.go - P.dwellB) / P.back);
    var xs = dirR ? c.x1 + (c.x2 - c.x1) * s : c.x2 - (c.x2 - c.x1) * s;
    // velocity by a tiny finite difference (the pose is smooth)
    return { x: xs, y: c.y, tilt: dirR ? tilt : -tilt, dumping: dumping, s: s, u: u };
  }
  function cartVel(c, t) {
    var a = cartPose(c, t - 0.002), b = cartPose(c, t + 0.002);
    return { vx: (b.x - a.x) / 0.004, vtilt: (b.tilt - a.tilt) / 0.004 };
  }
  // the cart's bucket as three segments in board space (left wall, floor, right wall);
  // it tips about the bottom corner on the dump side
  function cartSegments(c, t) {
    var p = cartPose(c, t), hw = c.w / 2, fy = p.y - 3;        // bucket floor sits 3 px above the track (wheels)
    var local = [[-hw, -c.h], [-hw, 0], [hw, 0], [hw, -c.h]];
    var px = c.dump === 'left' ? -hw : hw, py = 0;
    var ca = Math.cos(p.tilt), sa = Math.sin(p.tilt);
    var pts = local.map(function (q) {
      var dx = q[0] - px, dy = q[1] - py;
      return [p.x + px + dx * ca - dy * sa, fy + py + dx * sa + dy * ca];
    });
    return { pose: p, pts: pts, segs: [[pts[0], pts[1]], [pts[1], pts[2]], [pts[2], pts[3]]] };
  }
  function wheelAngle(w, t) {
    if (w.mode === 'swing') return w.theta0 + w.amp * Math.sin(2 * Math.PI * t / w.period);
    return w.theta0 + w.omega * t;
  }
  function wheelOmega(w, t) {
    if (w.mode === 'swing') return w.amp * (2 * Math.PI / w.period) * Math.cos(2 * Math.PI * t / w.period);
    return w.omega;
  }
  // paddle segments from the hub's rim to the tip
  function wheelSegments(w, t) {
    var th = wheelAngle(w, t), out = [];
    for (var i = 0; i < w.paddles; i++) {
      var a = th + i * 2 * Math.PI / w.paddles, ca = Math.cos(a), sa = Math.sin(a);
      out.push([[w.x + ca * w.hub, w.y + sa * w.hub], [w.x + ca * w.r, w.y + sa * w.r]]);
    }
    return out;
  }
  function pose(f, t) {
    if (f.kind === 'cart') return cartSegments(f, t);
    if (f.kind === 'wheel') return { angle: wheelAngle(f, t), omega: wheelOmega(f, t), segs: wheelSegments(f, t) };
    return null;
  }

  function slotAt(b, x) {
    var s = b.byKind.slot;
    for (var i = 0; i < s.length; i++) if (x >= s[i].x0 && x < s[i].x1) return s[i];
    return x < 0 ? s[0] : s[s.length - 1];
  }

  /* ── drift: the knockers' edits ──────────────────────────────────── */

  var EDITS = ['nudge', 'dress', 'rail', 'mouth', 'pocket'];
  var PIN_DRESS_SWAP = { spike: 'lamphook', lamphook: 'spike', prop: 'spike', coal: 'ore', ore: 'coal', rib: 'prop', fencepost: 'root', root: 'fencepost', rivet: 'bolt', bolt: 'rivet' };

  function clone(b) {
    var c = JSON.parse(JSON.stringify(b));
    return finish(c);
  }

  // edit: {type:'nudge', id, dx, dy} | {type:'dress', id, dress} |
  //       {type:'rail', id, end:1|2, d} | {type:'mouth', id, open} | {type:'pocket', id, dx}
  function applyEdit(b, e) {
    var c = clone(b), f = c.byId[e.id];
    if (!f) return c;
    var home = f.home || (f.home = { x: f.x, y: f.y, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 });
    if (e.type === 'nudge' && f.kind === 'pin') {
      f.x = clampTo(f.x + e.dx, home.x - 3, home.x + 3);
      f.y = clampTo(f.y + e.dy, home.y - 3, home.y + 3);
    } else if (e.type === 'dress' && f.kind === 'pin') {
      f.dress = e.dress; f.material = ({ spike: 'steel', lamphook: 'steel', rivet: 'steel', bolt: 'steel', prop: 'timber', fencepost: 'timber', root: 'timber', ore: 'ore', coal: 'rock', rib: 'bone' })[e.dress] || f.material;
    } else if (e.type === 'rail' && f.kind === 'rail') {
      // lengthen or shorten by d px along the rail at one end, within ±6 of home
      var dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      if (e.end === 1) { f.x1 -= ux * e.d; f.y1 -= uy * e.d; } else { f.x2 += ux * e.d; f.y2 += uy * e.d; }
    } else if (e.type === 'mouth' && f.kind === 'tunnel') {
      f.open = !!e.open;
    } else if (e.type === 'pocket' && f.kind === 'pocket') {
      f.x = clampTo(f.x + e.dx, home.x - 4, home.x + 4);
      var L2 = c.byId[f.id === 'pail' ? 'pail.lipL' : ''], R2 = c.byId[f.id === 'pail' ? 'pail.lipR' : ''];
      if (L2) L2.x = f.x - 8; if (R2) R2.x = f.x + 8;
    }
    c.edits = (c.edits || []).concat([e]);
    c.gen = (c.gen | 0) + 1;
    return c;
  }
  function clampTo(v, a, b) { return v < a ? a : v > b ? b : v; }

  // the rails the knockers may lengthen or shorten (never the floors or walls)
  var EDITABLE_RAILS = ['workings.chute', 'workings.slump', 'headframe.brace', 'haulage.set1', 'haulage.set2'];

  // draw n candidate edits from the legal set for the game `seed`
  function drawEdits(b, seed, n, salt) {
    var out = [], pins = b.byKind.pin.filter(function (p) { return p.drift; });
    salt = salt | 0;
    for (var k = 0; k < n; k++) {
      var i = k * 7 + salt * 131;
      var r = hash01(seed, i);
      var e;
      if (r < 0.62) {
        // the favourite job: nudge a pin. Every other game they fuss over the vein.
        var pool = hash01(seed, i + 1) < 0.45 ? pins.filter(function (p) { return p.region === 'vein' || p.region === 'payout'; }) : pins;
        var p = pool[Math.floor(hash01(seed, i + 2) * pool.length)];
        var dx = Math.round(hash01(seed, i + 3) * 6 - 3), dy = Math.round(hash01(seed, i + 4) * 4 - 2);
        if (!dx && !dy) dx = hash01(seed, i + 5) < 0.5 ? -2 : 2;
        e = { type: 'nudge', id: p.id, dx: dx, dy: dy };
      } else if (r < 0.74) {
        var q = pins[Math.floor(hash01(seed, i + 2) * pins.length)];
        e = { type: 'dress', id: q.id, dress: PIN_DRESS_SWAP[q.dress] || 'spike' };
      } else if (r < 0.88) {
        var rid = EDITABLE_RAILS[Math.floor(hash01(seed, i + 2) * EDITABLE_RAILS.length)];
        e = { type: 'rail', id: rid, end: hash01(seed, i + 3) < 0.5 ? 1 : 2, d: hash01(seed, i + 4) < 0.5 ? -6 : 6 };
      } else if (r < 0.94) {
        var tn = b.byKind.tunnel[Math.floor(hash01(seed, i + 2) * b.byKind.tunnel.length)];
        e = { type: 'mouth', id: tn.id, open: !tn.open };
      } else {
        e = { type: 'pocket', id: 'pail', dx: hash01(seed, i + 3) < 0.5 ? -3 : 3 };
      }
      out.push(e);
    }
    return out;
  }

  /* validate(board, physics, opts) → {ok, reasons[], stats}
   * Runs `drops` drops spread over the hopper range (opts.drops, default 300)
   * and checks the fairness gates (PLAN §10): nothing stuck or timed out, every
   * slot reachable, the 13 neither too easy nor impossible.
   * For in-browser use, validator(...) returns {step(k) → done?, result}. */
  function validator(b, P, opts) {
    opts = opts || {};
    var N = opts.drops || 300, seed = opts.seed | 0, i = 0;
    var hits = {}, timeouts = 0, lost = 0, pocket = 0, tMax = 0;
    b.byKind.slot.forEach(function (s) { hits[s.id] = 0; });
    var api = {
      done: false, result: null,
      step: function (k) {
        for (var n = 0; n < k && i < N; n++, i++) {
          var x = b.drop.x0 + (b.drop.x1 - b.drop.x0) * (i + 0.5) / N;
          var r = P.simulate(b, x, seed * 7919 + i, { maxT: 14 });
          if (r.timeout) timeouts++;
          if (r.outcome && r.outcome.kind === 'slot') hits[r.outcome.id]++;
          else if (r.outcome && r.outcome.kind === 'pocket') pocket++;
          else lost++;
          if (r.t > tMax) tMax = r.t;
        }
        if (i >= N && !api.done) {
          var reasons = [];
          if (timeouts) reasons.push('timeouts ' + timeouts);
          if (tMax > 8) reasons.push('slow drop ' + tMax.toFixed(1) + 's');
          var dead = [];
          for (var id in hits) if (!hits[id] && (b.byId[id].value > 0)) dead.push(id);
          if (dead.length) reasons.push('unreachable ' + dead.join(','));
          var lode = b.byKind.slot.filter(function (s) { return s.value === 13; })[0];
          var lodeRate = lode ? hits[lode.id] / N : 0;
          if (lodeRate > (opts.lodeMax || 0.04)) reasons.push('13 too easy ' + (lodeRate * 100).toFixed(1) + '%');
          if (lodeRate <= 0) reasons.push('13 impossible');
          api.done = true;
          api.result = { ok: !reasons.length, reasons: reasons, stats: { hits: hits, timeouts: timeouts, pocket: pocket, lost: lost, tMax: tMax, lodeRate: lodeRate } };
        }
        return api.done;
      }
    };
    return api;
  }
  function validate(b, P, opts) { var v = validator(b, P, opts); while (!v.step(50)) { } return v.result; }

  var BASE = buildBase();
  function base() { return clone(BASE); }

  var api = {
    W: W, H: H, SLOT_Y: SLOT_Y, MARBLE_R: MARBLE_R,
    REGIONS: REGIONS, regionAt: regionAt,
    base: base, finish: finish, clone: clone,
    pose: pose, cartPose: cartPose, cartVel: cartVel, cartSegments: cartSegments,
    wheelAngle: wheelAngle, wheelOmega: wheelOmega, wheelSegments: wheelSegments,
    slotAt: slotAt,
    EDITS: EDITS, drawEdits: drawEdits, applyEdit: applyEdit,
    validate: validate, validator: validator,
    hash01: hash01, strSeed: strSeed
  };
  root.PachinkoBoard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

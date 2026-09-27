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
  var SLOT_Y = 402;      // a marble whose centre passes this line has resolved into a slot
  var MARBLE_R = 4;

  function hash01(seed, i) {
    var h = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((i | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  function strSeed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; }

  /* The strata (the art director's painted depths, art-1 request 1). Rock
   * bands hold the pin fields; the three coal seams are the galleries, and
   * only their FLOORS collide (the marble rides the glass plane, in front of
   * the painted rock, so it crosses a gallery's roof line freely). */
  var STRATA = [
    { y0: 0,   y1: 12,  what: 'hopper rail' },
    { y0: 12,  y1: 64,  what: 'painted backdrop (sky, ridge, moon)' },
    { y0: 64,  y1: 84,  what: 'soil' },
    { y0: 84,  y1: 120, what: 'sandstone' },
    { y0: 120, y1: 142, what: 'roof shale (ferns)' },
    { y0: 142, y1: 160, what: 'coal seam A: the main haulage way' },
    { y0: 160, y1: 206, what: 'fireclay and limestone (trilobite)' },
    { y0: 206, y1: 222, what: 'shale' },
    { y0: 222, y1: 240, what: 'coal seam B: the ventilation door' },
    { y0: 240, y1: 292, what: 'sandstone and shale (fossils, lost things)' },
    { y0: 292, y1: 320, what: 'coal seam C: the old workings (room and pillar)' },
    { y0: 320, y1: 384, what: 'deep rock: the ribs, the vein, the sump' },
    { y0: 384, y1: 416, what: 'payout bays' }
  ];

  var REGIONS = [
    { id: 'headframe',   name: 'Headframe',             x: 56,  y: 0,   w: 84,  h: 64,  depth: 0 },
    { id: 'surface',     name: 'Surface',               x: 0,   y: 0,   w: 320, h: 64,  depth: 0 },
    { id: 'overburden',  name: 'Overburden',            x: 0,   y: 64,  w: 320, h: 78,  depth: 1 },
    { id: 'haulage',     name: 'Main haulage way',      x: 0,   y: 142, w: 320, h: 18,  depth: 2 },
    { id: 'measures',    name: 'The middle measures',   x: 0,   y: 160, w: 320, h: 62,  depth: 3 },
    { id: 'ventilation', name: 'Ventilation door',      x: 0,   y: 222, w: 320, h: 18,  depth: 4 },
    { id: 'legend',      name: '(behind the legend card)', x: 0, y: 240, w: 64,  h: 90,  depth: 5 },
    { id: 'barren',      name: 'The barren measures',   x: 64,  y: 240, w: 256, h: 52,  depth: 5 },
    { id: 'workings',    name: 'The old workings',      x: 64,  y: 292, w: 256, h: 28,  depth: 6 },
    { id: 'sump',        name: 'The sump (dry)',        x: 0,   y: 320, w: 104, h: 64,  depth: 7 },
    { id: 'vein',        name: 'The vein',              x: 104, y: 320, w: 216, h: 64,  depth: 7 },
    { id: 'payout',      name: 'Payout bays',           x: 0,   y: 384, w: 320, h: 32,  depth: 8 }
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
    var floors = [];         // gallery floors (for the art: polylines + openings)
    var decor = [];          // things drawn but not collided
    function pin(id, x, y, material, dress, extra) {
      var p = { id: id, kind: 'pin', x: x, y: y, r: 1.5, region: regionAt(x, y), material: material, dress: dress };
      if (extra) for (var k in extra) p[k] = extra[k];
      F.push(p); return p;
    }
    function rail(id, x1, y1, x2, y2, material, dress, extra) {
      var r = { id: id, kind: 'rail', x1: x1, y1: y1, x2: x2, y2: y2, r: 1.5, region: regionAt((x1 + x2) / 2, (y1 + y2) / 2), material: material, dress: dress };
      if (extra) for (var k in extra) r[k] = extra[k];
      F.push(r); return r;
    }

    // the glass case's side walls (the art draws the case frame over them)
    rail('wall.l', -1.5, -40, -1.5, H + 20, 'timber', 'wall', { region: 'surface' });
    rail('wall.r', W + 1.5, -40, W + 1.5, H + 20, 'timber', 'wall', { region: 'surface' });

    /* a gallery floor with openings between x0 and x1 at height y (the top
     * of the timber). Each piece between openings has a crest (by default
     * its middle; an edge crest makes it a single slope) and falls `drop`
     * px to its ends, so a marble on it rolls to an opening. */
    function floor(id, y, x0, x1, openings, opts) {
      opts = opts || {};
      var dropPx = opts.drop == null ? 8 : opts.drop;
      var edges = [x0];
      openings.forEach(function (o) { edges.push(o.x - o.w / 2, o.x + o.w / 2); });
      edges.push(x1);
      var pieces = [], y0 = y + 1.5;           // the rail's centre line sits r below the walking surface
      for (var i = 0; i < edges.length; i += 2) {
        var a = edges[i], b = edges[i + 1];
        if (b - a < 2) continue;
        var pid = id + '.' + (i / 2);
        var ov = (opts.pieces && opts.pieces[i / 2]) || {};
        var cx = ov.crestX != null ? ov.crestX : (a <= x0 ? a : b >= x1 ? b : (a + b) / 2);
        var mat = ov.material || opts.material || 'timber', dr = ov.dress || opts.dress || 'floor';
        // the crest rises with the piece's length (≈ 8°), between 2 and `drop` px
        var run = Math.max(cx - a, b - cx), rise = Math.max(2, Math.min(dropPx, run * (ov.grade || opts.grade || 0.2)));
        var yc = y0 - rise, pts = [];
        if (cx > a + 0.5) { rail(pid + '.l', a, y0, cx, yc, mat, dr); pts.push([a, y0 - 1.5], [cx, yc - 1.5]); }
        else pts.push([a, yc - 1.5]);
        if (cx < b - 0.5) { rail(pid + '.r', cx, yc, b, y0, mat, dr); pts.push([b, y0 - 1.5]); }
        else pts.push([b, yc - 1.5]);
        pieces.push({ id: pid, x0: a, x1: b, crestX: cx, top: pts, dress: dr, material: mat });
      }
      floors.push({ id: id, y: y, x0: x0, x1: x1, openings: openings, pieces: pieces, region: regionAt((x0 + x1) / 2, y - 2) });
    }

    /* a staggered pin field */
    function field(prefix, rows, dressFn, opts) {
      opts = opts || {};
      var jit = opts.jitter || 0;
      rows.forEach(function (row, ri) {
        for (var x = row.x0, ci = 0; x <= row.x1 + 0.01; x += row.dx, ci++) {
          if (opts.skip && opts.skip(x, row.y, ri, ci)) continue;
          var id = prefix + '.' + ri + '.' + ci;
          var s = strSeed(id);
          var jx = jit ? Math.round((hash01(s, 1) * 2 - 1) * jit) : 0;
          var jy = jit ? Math.round((hash01(s, 2) * 2 - 1) * jit) : 0;
          var d = dressFn(x, row.y, ri, ci, s);
          pin(id, x + jx, row.y + jy, MAT[d] || 'steel', d, { drift: true });
        }
      });
    }
    // staggered rows: every other row shifted half a pitch
    function rows(y0, n, dy, x0, x1, dx) {
      var out = [];
      for (var i = 0; i < n; i++) out.push({ y: y0 + i * dy, x0: x0 + (i % 2 ? dx / 2 : 0), x1: x1, dx: dx });
      return out;
    }

    /* ── surface: the painted backdrop, nailed up, and the headframe ── */
    // the sheave wheel turns at the top of the headframe; posts and the back-leg brace below
    F.push({ id: 'sheave', kind: 'wheel', x: 84, y: 42, r: 11, hub: 2.5, paddles: 6, mode: 'spin', omega: 2.2, theta0: 0,
      region: 'headframe', material: 'spoke', dress: 'sheave', legend: 1 });
    rail('headframe.postL', 72, 50, 72, 64, 'timber', 'post');
    rail('headframe.postR', 96, 50, 96, 64, 'timber', 'post');
    rail('headframe.brace', 99, 46, 128, 64, 'timber', 'brace', { drift: true });
    decor.push({ kind: 'headframe', x: 84, y: 42, posts: [72, 96], top: 50, ground: 64, brace: [99, 46, 128, 64] });
    // the backdrop's nails (the sky is painted on a board, and the board is nailed up)
    [[28, 28], [196, 24], [300, 30]].forEach(function (q, i) { pin('nail.' + i, q[0], q[1], 'steel', 'nail'); });
    // fence posts along the ridge line
    [20, 44, 148, 172, 196, 220, 244, 268, 292].forEach(function (x, i) { pin('fence.' + i, x, 57 + (i % 2), 'timber', 'fencepost', { drift: true }); });

    /* ── the overburden: soil (roots), sandstone (spikes), roof shale (bolts) ── */
    field('over', rows(72, 5, 16, 10, 312, 20), function (x, y, ri, ci, s) {
      if (y < 84) return 'root';
      if (y > 120) return hash01(s, 9) < 0.18 ? 'bone' : 'bolt';
      return 'spike';
    }, { skip: function (x, y, ri, ci) { return (ri === 0 && x > 66 && x < 102); } });

    /* The galleries are driven PART WAY along their seams (a gallery ends at
     * its face; beyond the face the seam is still solid coal, and its coal
     * knuckles are pins). So some lanes fall through galleries and some
     * through rock the whole way down, and where you drop decides which. */
    function face(id, x, y0, y1) { rail(id, x, y0, x, y1, 'rock', 'face'); }

    /* ── seam A: the main haulage way (x 0 → the face at 212) ─────── */
    // lamp hooks hang under roof bolts (a hook right under a bolt leaves no gap to wedge in)
    [52, 172].forEach(function (x, i) { pin('hook.' + i, x, 143, 'steel', 'hook'); });
    floor('floorA', 157, 0, 212, [
      { x: 16, w: 14, name: 'ladderway' },
      { x: 100, w: 16, name: 'cart chute' },
      { x: 150, w: 14, name: 'manway' },
      { x: 196, w: 14, name: 'raise' }
    ], { dress: 'track', material: 'track', pieces: { 1: { crestX: 23, grade: 0.12 } } });
    face('faceA', 213, 146, 157);
    field('coalA', [{ y: 152, x0: 222, x1: 308, dx: 20 }], function () { return 'coal'; });
    // the ore cart runs the track from the ladderway to the chute and tips into it
    F.push({ id: 'cart', kind: 'cart', x1: 38, x2: 80, y: 155.5, w: 22, h: 9, period: 2.6, phase: 0.1, dump: 'right',
      region: 'haulage', material: 'steel', dress: 'ore', legend: 10 });

    /* ── the middle measures: fireclay, limestone, shale ──────────── */
    field('mid', rows(170, 3, 16, 10, 312, 20), function (x, y, ri, ci, s) {
      var h = hash01(s, 7);
      if (y > 204) return h < 0.2 ? 'bone' : 'bolt';
      if (h < 0.1) return 'bone';
      return 'spike';
    }, { jitter: 1 });

    /* ── seam B: the ventilation door (x 0 → the face at 262) ─────── */
    F.push({ id: 'ventdoor', kind: 'wheel', x: 176, y: 223.5, r: 10, hub: 1.5, paddles: 1, mode: 'swing', amp: 0.75, period: 2.8, theta0: Math.PI / 2,
      region: 'ventilation', material: 'timber', dress: 'door', legend: 3 });
    floor('floorB', 237, 0, 262, [
      { x: 78, w: 14, name: 'winze' },
      { x: 128, w: 14, name: 'chute' },
      { x: 204, w: 14, name: 'manway' }
    ], { dress: 'floor', material: 'plank', pieces: { 0: { crestX: 40 }, 3: { crestX: 226 } } });
    face('faceB', 263, 224, 237);
    field('coalB', [{ y: 220, x0: 282, x1: 312, dx: 20 }, { y: 236, x0: 292, x1: 312, dx: 20 }], function () { return 'coal'; });
    // the old drift runs off the far end of seam B, down to the vein;
    // the other one, at the face, is the one scratched off the legend
    F.push({ id: 'tunnel.drift', kind: 'tunnel', a: { x: 9, y: 231, r: 7 }, b: { x: 132, y: 322, vx: 5, vy: 40 }, delay: 0.9, open: true,
      region: 'ventilation', material: 'rock', dress: 'adit', legend: 5 });
    F.push({ id: 'tunnel.office', kind: 'tunnel', a: { x: 256, y: 231, r: 7 }, b: { x: 8, y: 330, vx: 4, vy: 30 }, delay: 1.1, open: true,
      region: 'ventilation', material: 'rock', dress: 'door', legend: 4 });

    /* ── the barren measures (and the rib that keeps the legend corner clear) ── */
    rail('legend.rib', 65, 239, 65, 330, 'rock', 'pillar');
    field('barren', rows(252, 3, 14, 82, 308, 20), function (x, y, ri, ci, s) {
      var h = hash01(s, 5);
      if (h < 0.14) return 'bone';
      if (h < 0.3) return 'prop';
      return 'spike';
    }, { jitter: 1, skip: function (x, y) { return x > 204 && x < 258 && y > 258 && y < 286; } });
    // the lunch pail, hung on a nail in the rock: a pocket in the pin field
    pin('pail.lipL', 223, 268, 'steel', 'nail');
    pin('pail.lipR', 239, 268, 'steel', 'nail');
    rail('pail.base', 224, 280, 238, 280, 'steel', 'pail');
    F.push({ id: 'pail', kind: 'pocket', x: 231, y: 270, w: 14, value: 2, legend: 6,
      region: 'barren', material: 'steel', dress: 'pail' });

    /* ── seam C: the old workings, room and pillar (x 65 → the face at 246) ── */
    [124, 184].forEach(function (x, i) { rail('pillar.' + i, x, 301, x, 312, 'rock', 'pillar', { r: 3 }); });
    floor('floorC', 317, 65, 246, [
      { x: 94, w: 14, name: 'sump raise' },
      { x: 142, w: 14, name: 'chute' },
      { x: 226, w: 14, name: 'chute' }
    ], { dress: 'floor', material: 'plank', pieces: { 0: { crestX: 65 }, 1: { crestX: 124 }, 2: { crestX: 184 }, 3: { crestX: 246 } } });
    face('faceC', 247, 296, 317);
    field('coalC', [{ y: 300, x0: 258, x1: 308, dx: 20 }, { y: 314, x0: 268, x1: 308, dx: 20 }], function () { return 'coal'; });
    [[96, 300], [144, 300], [228, 300]].forEach(function (q, i) { pin('prop.' + i, q[0], q[1], 'timber', 'prop'); });

    /* ── the sump (dry) ───────────────────────────────────────────── */
    // the old pump wheel sits under the sump raise and bats what falls down it
    F.push({ id: 'pump', kind: 'wheel', x: 72, y: 352, r: 14, hub: 3, paddles: 4, mode: 'spin', omega: -2.6, theta0: 0.3,
      region: 'sump', material: 'timber', dress: 'fan', legend: 8 });
    [[34, 336], [40, 362], [22, 374], [100, 338], [104, 368]].forEach(function (q, i) { pin('sump.' + i, q[0], q[1], 'timber', 'root', { drift: true }); });

    /* ── the vein: ore along the seam, the big ribs, the guarded 13 ── */
    var LODE_X = 177;
    field('vein', [
      { y: 330, x0: 122, x1: 312, dx: 20 },
      { y: 344, x0: 132, x1: 302, dx: 20 },
      { y: 358, x0: 122, x1: 312, dx: 20 },
      { y: 372, x0: 132, x1: 302, dx: 20 }
    ], function (x, y) {
      var seam = y - (384 - (x - 104) * 0.24);
      if (Math.abs(seam) < 8) return 'ore';
      if (x > 246) return 'bone';          // the ribs of something large
      return 'coal';
    }, { jitter: 2, skip: function (x, y) { return (y > 350 && Math.abs(x - LODE_X) < 16) || (y > 340 && Math.abs(x - LODE_X) < 8); } });

    /* ── the payout bays ──────────────────────────────────────────── */
    // thirteen bays; the 13 (THE MOTHER LODE) is the narrow one just right of centre
    var DIV = [0, 24, 49, 73, 97, 121, 146, 170, 184, 211, 238, 265, 292, 320];
    // the bays are named for what comes out of a mine: most of it is waste
    // (gob, slate, bony, slack, culm, overburden) and pays nothing; the two
    // grades beside the lode pay 1; the lode pays 13 (lab-tuned, PLAN §12)
    var SLOTS = [
      { value: 0,  label: 'GOB' },
      { value: 0,  label: 'SLATE' },
      { value: 0,  label: 'BONY' },
      { value: 0,  label: 'STEAM' },
      { value: 0,  label: 'SLACK' },
      { value: 0,  label: 'STOKER' },
      { value: 1,  label: 'SMITHING' },
      { value: 13, label: 'THE MOTHER LODE' },
      { value: 1,  label: 'BLOCK' },
      { value: 0,  label: 'CANNEL' },
      { value: 0,  label: 'CULM' },
      { value: 0,  label: 'EGG' },
      { value: 0,  label: 'OVERBURDEN' }
    ];
    for (var i = 1; i < DIV.length - 1; i++) {
      // the 13's two dividers stand taller: a cup the marble must drop into squarely
      var lode = DIV[i] === 170 || DIV[i] === 184;
      rail('div.' + i, DIV[i], lode ? 370 : 388, DIV[i], H + 8, 'timber', 'divider', { r: lode ? 1.5 : 1 });
      pin('divcap.' + i, DIV[i], lode ? 368 : 386, lode ? 'ore' : 'brass', lode ? 'ore' : 'nail', lode ? { drift: true } : null);
    }
    for (var j = 0; j < SLOTS.length; j++) {
      F.push({ id: 'slot.' + j, kind: 'slot', x0: DIV[j], x1: DIV[j + 1], y: SLOT_Y, value: SLOTS[j].value,
        legend: 20 + j, label: SLOTS[j].label, region: 'payout', material: 'timber', dress: SLOTS[j].value === 13 ? 'lode' : 'bay' });
    }
    // the guard over the 13: a knuckle of bone right over the cup
    pin('guard.top', LODE_X, 354, 'bone', 'bone', { drift: true, teeter: true });
    pin('guard.l', LODE_X - 12, 356, 'ore', 'ore', { drift: true });
    pin('guard.r', LODE_X + 14, 362, 'ore', 'ore', { drift: true });

    /* ── decor: lamps, ladders, specimens ─────────────────────────── */
    decor.push(
      { kind: 'ladder', x: 16, y0: 142, y1: 222 },
      { kind: 'ladder', x: 204, y0: 222, y1: 292 },
      { kind: 'lamp', x: 44, y: 150, region: 'haulage' },
      { kind: 'lamp', x: 176, y: 150, region: 'haulage' },
      { kind: 'lamp', x: 290, y: 150, region: 'haulage' },
      { kind: 'lamp', x: 150, y: 228, region: 'ventilation' },
      { kind: 'lamp', x: 270, y: 228, region: 'ventilation' },
      { kind: 'lamp', x: 150, y: 298, region: 'workings' },
      { kind: 'lamp', x: 270, y: 298, region: 'workings' },
      { kind: 'lamp', x: 30, y: 344, region: 'sump' },
      { kind: 'seam', x1: 104, y1: 380, x2: 320, y2: 332 },
      { kind: 'moon', x: 262, y: 26 },
      { kind: 'cardzone', x: 0, y: 250, w: 60, h: 80 },
      // specimens set in the rock (Fig. numbers for the labels)
      { kind: 'specimen', what: 'keys',      x: 180, y: 74,  fig: 1,  label: 'Fig. 1: keys (ring of 3), house unknown' },
      { kind: 'specimen', what: 'fern',      x: 60,  y: 131, fig: 2,  label: 'Fig. 2: seed fern, Carboniferous' },
      { kind: 'specimen', what: 'plaque',    x: 236, y: 102, fig: 3,  label: 'Fig. 3: company plaque, name removed' },
      { kind: 'specimen', what: 'trilobite', x: 120, y: 190, fig: 4,  label: 'Fig. 4: trilobite, surprised' },
      { kind: 'specimen', what: 'payroll',   x: 262, y: 176, fig: 5,  label: 'Fig. 5: payroll, sealed' },
      { kind: 'specimen', what: 'dollarm',   x: 110, y: 270, fig: 6,  label: "Fig. 6: doll's arm (left)" },
      { kind: 'specimen', what: 'watch',     x: 170, y: 256, fig: 7,  label: 'Fig. 7: pocket watch, still going' },
      { kind: 'specimen', what: 'ring',      x: 290, y: 262, fig: 8,  label: 'Fig. 8: wedding ring' },
      { kind: 'specimen', what: 'ribs',      x: 276, y: 362, fig: 9,  label: 'Fig. 9: ribs, something large' },
      { kind: 'specimen', what: 'ledgers',   x: 24,  y: 372, fig: 10, label: 'Fig. 10: ledgers, 1921 to 1923' },
      { kind: 'specimen', what: 'strongbox', x: 140, y: 372, fig: 11, label: 'Fig. 11: strongbox (locked)' }
    );

    var legend = [
      { n: 1, text: 'Headframe and sheave wheel', ref: 'sheave' },
      { n: 2, text: 'Main haulage way', ref: 'haulage' },
      { n: 3, text: 'Ventilation door', ref: 'ventdoor' },
      { n: 4, text: 'Tunnel to the company office', ref: 'tunnel.office', scratched: true },
      { n: 5, text: 'The old drift (abandoned 1923)', ref: 'tunnel.drift' },
      { n: 6, text: "Miner's lunch pail", ref: 'pail' },
      { n: 7, text: 'The old workings', ref: 'workings' },
      { n: 8, text: 'Sump pump (dry)', ref: 'pump' },
      { n: 9, text: 'The vein', ref: 'vein' },
      { n: 10, text: 'Ore cart, 4 ton', ref: 'cart' }
    ];
    for (var s = 0; s < SLOTS.length; s++) legend.push({ n: 20 + s, text: SLOTS[s].label + (SLOTS[s].value ? ', ' + SLOTS[s].value : ', nothing'), ref: 'slot.' + s, slot: true });

    return finish({ W: W, H: H, SLOT_Y: SLOT_Y, MARBLE_R: MARBLE_R, drop: { y: 16, x0: 10, x1: W - 10 },
      strata: STRATA, regions: REGIONS, fixtures: F, floors: floors, decor: decor, legend: legend, edits: [], gen: 0 });
  }
  var MAT = { coal: 'rock', spike: 'steel', hook: 'steel', lamphook: 'steel', rivet: 'steel', bolt: 'steel', nail: 'steel', prop: 'timber', fencepost: 'timber', root: 'timber', ore: 'ore', coal: 'rock', rib: 'bone', bone: 'bone' };

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
  function cartLoading(c, t) {
    // the cart takes on load only at the loading end and on its way to the chute
    var u = ((t / c.period + c.phase) % 1 + 1) % 1;
    return u < CART_PHASES.dwellA + CART_PHASES.go * 0.8;
  }
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
  var PIN_DRESS_SWAP = { spike: 'hook', hook: 'spike', prop: 'spike', ore: 'spike', bone: 'prop', fencepost: 'root', root: 'fencepost', bolt: 'spike', nail: 'bolt' };

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
      f.dress = e.dress; f.material = MAT[e.dress] || f.material;
    } else if (e.type === 'rail' && f.kind === 'rail') {
      // lengthen or shorten by d px along the rail at one end, within ±6 of home
      var dx = f.x2 - f.x1, dy = f.y2 - f.y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      if (e.end === 1) { f.x1 -= ux * e.d; f.y1 -= uy * e.d; } else { f.x2 += ux * e.d; f.y2 += uy * e.d; }
    } else if (e.type === 'mouth' && f.kind === 'tunnel') {
      f.open = !!e.open;
    } else if (e.type === 'pocket' && f.kind === 'pocket') {
      f.x = clampTo(f.x + e.dx, home.x - 4, home.x + 4);
      var L2 = c.byId[f.id + '.lipL'], R2 = c.byId[f.id + '.lipR'], B2 = c.byId[f.id + '.base'];
      if (L2) L2.x = f.x - 8; if (R2) R2.x = f.x + 8;
      if (B2) { B2.x1 = f.x - 7; B2.x2 = f.x + 7; }
    }
    c.edits = (c.edits || []).concat([e]);
    c.gen = (c.gen | 0) + 1;
    return c;
  }
  function clampTo(v, a, b) { return v < a ? a : v > b ? b : v; }

  // the rails the knockers may lengthen or shorten (never the floors or walls)
  var EDITABLE_RAILS = ['headframe.brace'];

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
          var sd = seed * 7919 + i;
          var r = P.simulate(b, x, sd, { maxT: 14, t0: hash01(sd, 99991) * 60 });
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
    REGIONS: REGIONS, STRATA: STRATA, regionAt: regionAt,
    base: base, finish: finish, clone: clone,
    pose: pose, cartPose: cartPose, cartLoading: cartLoading, cartVel: cartVel, cartSegments: cartSegments,
    wheelAngle: wheelAngle, wheelOmega: wheelOmega, wheelSegments: wheelSegments,
    slotAt: slotAt,
    EDITS: EDITS, drawEdits: drawEdits, applyEdit: applyEdit,
    validate: validate, validator: validator,
    hash01: hash01, strSeed: strSeed
  };
  root.PachinkoBoard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

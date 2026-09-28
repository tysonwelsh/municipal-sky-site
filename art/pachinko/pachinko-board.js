/* MOTHER LODE — the mine as data (PLAN §3)
 *
 * Pure: no DOM, no Math.random, no Date. Loads in the browser
 * (window.PachinkoBoard) and in Node (module.exports) for the lab.
 *
 * BOARD SPACE = the glass interior, 320 × 416 px, origin top-left, y down.
 * The physics and the renderer share it (a flat cross-section, no projection).
 *
 * THE MINE (top to bottom; see REGIONS and STRATA — the art director's
 * painted depths). The pins are the mine's furniture, laid in figures, not
 * a grid:
 *   surface     the headframe over the main shaft (posts, back-leg brace,
 *               the sheave spinning, a fan of rivets on its throwing side),
 *               fence posts on the ridge, the nails holding the painted sky up.
 *   overburden  a wavy line of roots under the grass; the MAIN SHAFT lined
 *               with timber sets straight down from the headframe to the
 *               ore cart; hard sandstone (sparse spikes) on the left; a fault
 *               running down-right with broken, chattery rock below it; a V
 *               of spikes over the raise; bedded coal-lane rock beyond the
 *               haulage way's face; a line of roof bolts over the gallery.
 *   haulage     seam A, driven from the ladderway to its face at x 213: the
 *               track, the ore cart (pays 1 when it takes a marble), hooks.
 *   measures    the ladderway (two stiles: a marble rattles down to the old
 *               drift), broken limestone under the cart chute, a V down to
 *               the chute, the POWDER BOX (a tulip pocket), open limestone,
 *               roof bolts over seam B.
 *   ventilation seam B to its face at x 263: the swinging door; the old
 *               drift's mouth at the far left (it comes out over the lode),
 *               the scratched-out office tunnel at the face (it empties into
 *               the GOB bay).
 *   barren      an ammonite's dome, broken shale, the LUNCH PAIL (a tulip),
 *               coal-lane beds; the rock rib that keeps the legend card clear.
 *   workings    seam C, room and pillar, to its face at x 247.
 *   sump        the pump wheel with a fan of roots.
 *   vein        coal knuckles, the seam itself (a sieve of ore knuckles the
 *               marble skips along or drops through), three great ribs, the
 *               lode's two ore knuckles, and the 13's cup behind the
 *               teetering bone.
 *   payout      thirteen bays between timber dividers.
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

  // layout knobs the lab tunes (local-dev/pachinko-lab); see PLAN §12
  var LAYOUT = { deepPitch: 19, knuckle: 10, guard: 12, driftX: 190, driftVx: 13, driftSpread: 31 };
  function buildBase(knobs) {
    var T_ = {}; for (var kk in LAYOUT) T_[kk] = LAYOUT[kk];
    if (knobs) for (var k2 in knobs) T_[k2] = knobs[k2];
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
        pieces.push({ id: pid, x0: a, x1: b, crestX: cx, crest0: cx, top: pts, dress: dr, material: mat, grade: ov.grade || opts.grade || 0.2, drop: dropPx });
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

    function face(id, x, y0, y1) { rail(id, x, y0, x, y1, 'rock', 'face'); }

    /* ── composition helpers: the pins are the mine's furniture ────── *
     * line   a row of pins along a timber, a bolt line, a fault, a rib
     * arc    a curve of pins (a fan round a wheel, a fossil's dome)
     * vee    two arms converging on a shaft opening (a funnel, gap ≥ 12)
     * patch  a jittered lattice clipped to a box: pitch 13–15 is broken,
     *        chattery ground; 24–28 is hard rock where a marble flies */
    function line(prefix, x1, y1, x2, y2, n, material, dress, extra) {
      for (var i = 0; i < n; i++) {
        var u = n === 1 ? 0.5 : i / (n - 1);
        pin(prefix + '.' + i, Math.round((x1 + (x2 - x1) * u) * 2) / 2, Math.round((y1 + (y2 - y1) * u) * 2) / 2, material, dress, extra);
      }
    }
    function arc(prefix, cx, cy, r, a0, a1, n, material, dress, extra) {
      for (var i = 0; i < n; i++) {
        var a = (a0 + (a1 - a0) * (n === 1 ? 0.5 : i / (n - 1))) * Math.PI / 180;
        pin(prefix + '.' + i, Math.round((cx + Math.cos(a) * r) * 2) / 2, Math.round((cy + Math.sin(a) * r) * 2) / 2, material, dress, extra);
      }
    }
    function vee(prefix, ax, ay, spread, height, n, material, dress) {
      // apex gap 12 (a marble passes, just); arms rise `height` and open to ±spread
      line(prefix + '.l', ax - 6 - spread, ay - height, ax - 6, ay, n, material, dress);
      line(prefix + '.r', ax + 6 + spread, ay - height, ax + 6, ay, n, material, dress);
    }
    function patch(prefix, x0, y0, x1, y1, pitch, dressFn, opts) {
      opts = opts || {};
      var dy = Math.round(pitch * 0.8), ri = 0;
      for (var y = y0; y <= y1 + 0.01; y += dy, ri++) {
        var off = (ri % 2) ? pitch / 2 : 0;
        for (var x = x0 + off, ci = 0; x <= x1 + 0.01; x += pitch, ci++) {
          var id = prefix + '.' + ri + '.' + ci, s = strSeed(id);
          if (opts.skip && opts.skip(x, y)) continue;
          if (opts.thin && hash01(s, 11) < opts.thin) continue;
          var j = opts.jitter == null ? 2 : opts.jitter;
          var px = Math.round(x + (hash01(s, 1) * 2 - 1) * j), py = Math.round(y + (opts.dip || 0) * (x - x0) + (hash01(s, 2) * 2 - 1) * j);
          var d = dressFn(px, py, s);
          pin(id, px, py, MAT[d] || 'steel', d, { drift: true });
        }
      }
    }
    // a pocket with two lips and a base, optionally with two petals above (a tulip)
    function pocket(id, x, y, value, legendN, dress, petals) {
      pin(id + '.lipL', x - 9, y - 2, 'steel', 'nail');
      pin(id + '.lipR', x + 9, y - 2, 'steel', 'nail');
      rail(id + '.base', x - 8, y + 10, x + 8, y + 10, 'steel', dress);
      if (petals) { pin(id + '.petalL', x - 15, y - 10, 'steel', 'nail', { drift: true }); pin(id + '.petalR', x + 15, y - 10, 'steel', 'nail', { drift: true }); }
      F.push({ id: id, kind: 'pocket', x: x, y: y, w: 18, value: value, legend: legendN, region: regionAt(x, y), material: 'steel', dress: dress });
    }

    /* ── surface: the painted backdrop, nailed up, and the headframe ── */
    // the sheave wheel turns at the top of the headframe; posts and the back-leg brace below
    F.push({ id: 'sheave', kind: 'wheel', x: 84, y: 42, r: 11, hub: 2.5, paddles: 6, mode: 'spin', omega: 2.2, theta0: 0,
      region: 'headframe', material: 'spoke', dress: 'sheave', legend: 1 });
    rail('headframe.postL', 72, 50, 72, 64, 'timber', 'post');
    rail('headframe.postR', 96, 50, 96, 64, 'timber', 'post');
    rail('headframe.brace', 99, 46, 128, 64, 'timber', 'brace', { drift: true });
    decor.push({ kind: 'headframe', x: 84, y: 42, posts: [72, 96], top: 50, ground: 64, brace: [99, 46, 128, 64] });
    // a fan of rivets on the sheave's throwing side (it spins clockwise, and flings left)
    arc('sheavefan', 84, 42, 21, 185, 235, 3, 'steel', 'rivet');
    // the backdrop's nails (the sky is painted on a board, and the board is nailed up)
    [[28, 28], [196, 24], [300, 30]].forEach(function (q, i) { pin('nail.' + i, q[0], q[1], 'steel', 'nail'); });
    // fence posts along the ridge line
    [20, 44, 148, 172, 196, 220, 244, 268, 292].forEach(function (x, i) { pin('fence.' + i, x, 57 + (i % 2), 'timber', 'fencepost', { drift: true }); });

    /* ── the overburden ───────────────────────────────────────────── */
    // roots, in a wavy line under the grass
    for (var rx = 12, rk = 0; rx <= 308; rx += 20, rk++) {
      if (rx > 64 && rx < 104) continue;
      pin('root.' + rk, rx, 72 + Math.round(3 * Math.sin(rx * 0.13)), 'timber', 'root', { drift: true });
    }
    // the MAIN SHAFT goes down under the headframe, lined with timber sets:
    // drop between the posts and it rattles straight down to the ore cart
    line('shaft.l', 73, 80, 73, 134, 7, 'timber', 'prop');
    line('shaft.r', 95, 80, 95, 134, 7, 'timber', 'prop');
    // hard sandstone on the left: a few spikes, far apart
    [[18, 90], [48, 94], [32, 110], [60, 114], [14, 126], [44, 130]].forEach(function (q, i) { pin('sand.' + i, q[0], q[1], 'steel', 'spike', { drift: true }); });
    // the fault: a crack running down to the right, and broken rock below it
    line('fault', 112, 86, 164, 114, 5, 'steel', 'spike', { drift: true });
    patch('broken1', 110, 100, 160, 132, 15, function () { return 'spike'; }, { skip: function (x, y) { return y < 86 + (x - 112) * 0.53 + 8; } });
    patch('sand2', 176, 84, 206, 104, 24, function () { return 'spike'; });
    // a funnel of spikes over the raise at x 196
    vee('veeA', 196, 136, 12, 20, 3, 'steel', 'spike');
    // the coal lane (beyond the haulage way's face): bedded rock dipping right
    patch('bedA', 230, 84, 309, 134, 20, function (x, y, s) { return hash01(s, 4) < 0.2 ? 'bone' : 'spike'; }, { dip: 0.06 });
    // the roof bolts over the haulage way
    for (var bx = 10, bk = 0; bx <= 170; bx += 20, bk++) { if (bx > 64 && bx < 104) continue; pin('bolt.' + bk, bx, 138, 'steel', 'bolt', { drift: true }); }

    /* ── seam A: the main haulage way (x 0 → the face at 212) ─────── */
    [52, 172].forEach(function (x, i) { pin('hook.' + i, x, 143, 'steel', 'hook'); });
    floor('floorA', 157, 0, 212, [
      { x: 16, w: 14, name: 'ladderway' },
      { x: 100, w: 16, name: 'cart chute' },
      { x: 150, w: 14, name: 'manway' },
      { x: 196, w: 14, name: 'raise' }
    ], { dress: 'track', material: 'track', pieces: { 1: { crestX: 23, grade: 0.12 } } });
    face('faceA', 213, 146, 157);
    line('coalA', 234, 152, 309, 152, 4, 'rock', 'coal', { drift: true });
    // the ore cart runs the track from the ladderway to the chute and tips into it
    F.push({ id: 'cart', kind: 'cart', x1: 38, x2: 80, y: 155.5, w: 22, h: 9, period: 2.6, phase: 0.1, dump: 'right',
      region: 'haulage', material: 'steel', dress: 'ore', legend: 10, award: 1 });

    /* ── the middle measures ──────────────────────────────────────── */
    // the ladderway: two stiles; a marble rattles down between them to the old drift
    line('ladder.l', 10, 168, 10, 212, 5, 'timber', 'prop');
    line('ladder.r', 26, 168, 26, 212, 5, 'timber', 'prop');
    // the powder box: a tulip pocket (keep your matches away)
    pocket('powder', 174, 198, 2, 11, 'powderbox', true);
    // broken limestone under the cart chute: dense, chattery
    patch('broken2', 84, 168, 106, 196, 15, function (x, y, s) { return hash01(s, 6) < 0.25 ? 'bone' : 'spike'; });
    // a funnel down to the chute at x 128
    vee('veeB', 128, 214, 12, 20, 3, 'steel', 'spike');
    // the trilobite's limestone: medium, open
    patch('lime', 150, 168, 256, 206, 20, function (x, y, s) { return hash01(s, 6) < 0.12 ? 'bone' : 'spike'; }, { thin: 0.15, skip: function (x, y) { return y > 198 && x > 160 && x < 192; } });
    // the coal lane
    patch('bedB', 280, 170, 309, 214, 20, function () { return 'spike'; }, { dip: 0.06 });
    // roof bolts over seam B
    [36, 58, 80, 154, 200, 222, 244].forEach(function (x, i) { pin('boltB.' + i, x, 217, 'steel', 'bolt', { drift: true }); });

    /* ── seam B: the ventilation door (x 0 → the face at 262) ─────── */
    F.push({ id: 'ventdoor', kind: 'wheel', x: 176, y: 223.5, r: 10, hub: 1.5, paddles: 1, mode: 'swing', amp: 0.75, period: 2.8, theta0: Math.PI / 2,
      region: 'ventilation', material: 'timber', dress: 'door', legend: 3 });
    floor('floorB', 237, 0, 262, [
      { x: 78, w: 14, name: 'winze' },
      { x: 128, w: 14, name: 'chute' },
      { x: 204, w: 14, name: 'manway' }
    ], { dress: 'floor', material: 'plank', pieces: { 0: { crestX: 40 }, 3: { crestX: 226 } } });
    face('faceB', 263, 224, 237);
    field('coalB', [{ y: 220, x0: 284, x1: 309, dx: 20 }, { y: 236, x0: 294, x1: 309, dx: 20 }], function () { return 'coal'; });
    // (wave 5c: its route through the rock, for the light that crawls along it:
    // down behind the legend card, under the old workings' floor, out over the
    // lode; and a transit slow enough to follow, 1.4 s)
    F.push({ id: 'tunnel.drift', kind: 'tunnel', a: { x: 9, y: 231, r: 7 }, b: { x: T_.driftX, y: 324, vx: T_.driftVx, vy: 40, spread: T_.driftSpread }, delay: 1.4, open: true,
      path: [[9, 231], [12, 244], [22, 262], [34, 282], [46, 300], [58, 315], [80, 326], [110, 330], [140, 329], [168, 326], [T_.driftX, 324]],
      floor: { id: 'floorB', piece: 0, shut: 0 },
      region: 'ventilation', material: 'rock', dress: 'adit', legend: 5 });
    // (its exit sits just under the legend card, never behind it: integration, wave 2)
    // and it throws them out sideways, into the GOB or the SLATE: the company's waste either way
    F.push({ id: 'tunnel.office', kind: 'tunnel', a: { x: 256, y: 231, r: 7 }, b: { x: 9, y: 341, vx: 45, vy: 30, spread: 45 }, delay: 1.5, open: true,
      path: [[256, 231], [250, 246], [228, 251], [190, 249], [150, 247], [110, 246], [72, 247], [40, 262], [22, 290], [12, 320], [9, 341]],
      floor: { id: 'floorB', piece: 3, shut: 262 },
      region: 'ventilation', material: 'rock', dress: 'door', legend: 4 });

    /* ── the barren measures ──────────────────────────────────────── */
    rail('legend.rib', 65, 239, 65, 330, 'rock', 'pillar');
    // a fossil's dome (an ammonite, the size of a hubcap): marbles roll off it either way
    arc('ammonite', 108, 276, 15, 205, 335, 4, 'bone', 'bone');
    [[80, 252], [92, 284]].forEach(function (q, i) { pin('barrenL.' + i, q[0], q[1], 'steel', 'spike', { drift: true }); });
    // broken shale over the old workings' middle room: chattery
    patch('broken3', 140, 248, 196, 284, 15, function (x, y, s) { return hash01(s, 8) < 0.2 ? 'bone' : 'spike'; });
    // the lunch pail, hung on a nail, with two petals: a tulip pocket
    pocket('pail', 214, 272, 1, 6, 'pail', true);
    // the coal lane
    patch('bedC', 258, 250, 309, 286, 20, function () { return 'spike'; }, { dip: 0.06, skip: function (x, y) { return x < 262 && y > 262; } });

    /* ── seam C: the old workings, room and pillar (x 65 → the face at 246) ── */
    [124, 184].forEach(function (x, i) { rail('pillar.' + i, x, 301, x, 312, 'rock', 'pillar', { r: 3 }); });
    floor('floorC', 317, 65, 246, [
      { x: 94, w: 14, name: 'sump raise' },
      { x: 142, w: 14, name: 'chute' },
      { x: 226, w: 14, name: 'chute' }
    ], { dress: 'floor', material: 'plank', pieces: { 0: { crestX: 65 }, 1: { crestX: 124 }, 2: { crestX: 184 }, 3: { crestX: 246 } } });
    face('faceC', 247, 296, 317);
    field('coalC', [{ y: 300, x0: 258, x1: 309, dx: 20 }, { y: 314, x0: 268, x1: 309, dx: 20 }], function () { return 'coal'; });
    [[96, 300], [144, 300], [228, 300]].forEach(function (q, i) { pin('prop.' + i, q[0], q[1], 'timber', 'prop'); });

    /* ── the sump (dry) ───────────────────────────────────────────── */
    F.push({ id: 'pump', kind: 'wheel', x: 72, y: 352, r: 14, hub: 3, paddles: 4, mode: 'spin', omega: -2.6, theta0: 0.3,
      region: 'sump', material: 'timber', dress: 'fan', legend: 8 });
    // a fan of roots round the pump's throwing side
    arc('pumpfan', 72, 352, 23, 150, 250, 4, 'timber', 'root', { drift: true });
    [[100, 338], [104, 368], [22, 374]].forEach(function (q, i) { pin('sump.' + i, q[0], q[1], 'timber', 'root', { drift: true }); });

    /* ── the vein: ore knuckles along the seam, the big ribs, the guarded 13 ── */
    var LODE_X = 177;
    // the seam itself: a line of ore knuckles, a sieve a marble skips along or drops through
    (function () {
      var k = 0;
      for (var x = 116; x <= 309; x += 14) {
        if (Math.abs(x - LODE_X) < 26) continue;
        pin('seam.' + (k++), x, Math.round(380 - (x - 104) * 0.235), 'ore', 'ore', { drift: true });
      }
    })();
    // coal above the seam, all the way across: the marble is shuffled on its way to the bays
    patch('coalV', 112, 328, 309, 346, T_.deepPitch, function () { return 'coal'; }, { skip: function (x, y) { return y > 380 - (x - 104) * 0.235 - 11 || Math.abs(Math.abs(x - LODE_X) - T_.knuckle) < 9 && Math.abs(y - 340) < 9; } });
    // the lode's own knuckles: two ore knobs over the bone
    pin('knuckle.l', LODE_X - T_.knuckle, 340, 'ore', 'ore', { drift: true });
    pin('knuckle.r', LODE_X + T_.knuckle, 340, 'ore', 'ore', { drift: true });
    // the ribs of something large: three curved ribs, marbles fall between them
    for (var rb = 0; rb < 3; rb++) line('rib' + rb, 254 + rb * 20, 351, 261 + rb * 20, 371, 3, 'bone', 'bone');
    // sparse coal under the seam, left of the lode
    [[124, 358], [150, 356], [212, 370]].forEach(function (q, i) { pin('coalL.' + i, q[0], q[1], 'rock', 'coal', { drift: true }); });


    /* ── the payout bays ──────────────────────────────────────────── */
    // thirteen bays; the 13 (THE MOTHER LODE) is the narrow one just right of centre
    var DIV = [0, 24, 49, 73, 97, 121, 146, 170, 184, 211, 238, 265, 292, 320];
    // the bays are named for what comes out of a mine: most of it is waste
    // (gob, slate, bony, slack, refuse, culm, overburden) and pays nothing;
    // the coal grades pay 1–2; the lode pays 13 (lab-tuned, PLAN §12)
    var SLOTS = [
      { value: 0,  label: 'GOB' },
      { value: 0,  label: 'SLATE' },
      { value: 0,  label: 'BONY' },
      { value: 1,  label: 'STEAM' },
      { value: 0,  label: 'SLACK' },
      { value: 0,  label: 'STOKER' },     // was 1: the broad centre bay handed a novice free scrip (integration, wave 2)
      { value: 1,  label: 'SMITHING' },
      { value: 13, label: 'THE MOTHER LODE' },
      { value: 0,  label: 'REFUSE' },
      { value: 1,  label: 'CANNEL' },
      { value: 0,  label: 'CULM' },
      { value: 2,  label: 'EGG' },
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
    pin('guard.top', LODE_X, 352, 'bone', 'bone', { drift: true, teeter: true });
    pin('guard.l', LODE_X - T_.guard, 362, 'ore', 'ore', { drift: true });
    pin('guard.r', LODE_X + T_.guard, 362, 'ore', 'ore', { drift: true });

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

    // nothing sits in the mouth of a shaft (a marble would wedge in the opening)
    var pockets = F.filter(function (f) { return f.kind === 'pocket'; });
    F = F.filter(function (f) {
      if (f.kind !== 'pin' || !f.drift) return true;
      // …and nothing crowds a pocket but its own lips and petals
      if (pockets.some(function (pk) { return f.id.indexOf(pk.id + '.') !== 0 && Math.abs(f.x - pk.x) < 27 && f.y > pk.y - 20 && f.y < pk.y + 16; })) return false;
      return !floors.some(function (fl) {
        return fl.openings.some(function (o) { return Math.abs(f.x - o.x) < o.w / 2 + 5 && f.y > fl.y && f.y < fl.y + 14; });
      });
    });
    // the chute boards' places: under a floor opening with no ladder through
    // it, where the crew can set a board slanting left or right (wave 5c)
    var chutes = [
      { id: 'A.raise', floor: 'floorA', x: 196 }, { id: 'B.winze', floor: 'floorB', x: 78 }, { id: 'B.manway', floor: 'floorB', x: 204 },
      { id: 'C.chute', floor: 'floorC', x: 142 }, { id: 'C.chute2', floor: 'floorC', x: 226 }
    ].map(function (c) { var fl = floors.filter(function (f) { return f.id === c.floor; })[0], o = fl.openings.filter(function (q) { return q.x === c.x; })[0]; c.fy = fl.y; c.w = o.w; return c; });
    return finish({ W: W, H: H, SLOT_Y: SLOT_Y, MARBLE_R: MARBLE_R, drop: { y: 16, x0: 10, x1: W - 10 },
      strata: STRATA, regions: REGIONS, fixtures: F, floors: floors, decor: decor, legend: legend, chutes: chutes, edits: [], gen: 0 });
  }
  var MAT = { coal: 'rock', spike: 'steel', powderbox: 'timber', hook: 'steel', lamphook: 'steel', rivet: 'steel', bolt: 'steel', nail: 'steel', prop: 'timber', fencepost: 'timber', root: 'timber', ore: 'ore', rib: 'bone', bone: 'bone' };

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

  /* ── drift, wave 5c: fewer, bigger, legible edits ──────────────────
   * The crew used to nudge pins 1–3 px (78 edits in 131), which no player
   * could see. Now a WORK carries out one or two (now and then three) of:
   *   move    a pin carried a whole cell (9–13 px), sometimes a new one put
   *           in its place (a spike for a hook); within 16 px of home
   *   mouth   the old drift or the office door boarded up (and the floor
   *           beside it re-laid to run away from it, so nothing stalls in a
   *           dead end), or prised open again; a shut mouth is usually
   *           reopened the next shift
   *   chute   a board set under a floor opening, slanting the stream left or
   *           right, flipped, or taken up (two at most at once)
   *   pocket  the dinner pail or the powder box shoved ~10 px along
   *           (lips, base and petals together; within 12 of home)
   *   rail    the headframe's back-leg brace, a timber longer or shorter
   *           (each end within 6 px of home, never into the sheave)
   * nudge and dress still apply (old saves, the lab) but aren't drawn. */
  var EDITS = ['move', 'mouth', 'chute', 'pocket', 'rail'];
  var PIN_DRESS_SWAP = { spike: 'hook', hook: 'spike', prop: 'spike', ore: 'spike', bone: 'prop', fencepost: 'root', root: 'fencepost', bolt: 'spike', nail: 'bolt', coal: 'ore', rivet: 'bolt' };
  var MOVE_HOME = 16, POCKET_HOME = 12, RAIL_HOME = 6, CHUTES_MAX = 2;

  function clone(b) {
    var c = JSON.parse(JSON.stringify(b));
    return finish(c);
  }

  /* ── cave-ins (the mischief phase, wave 4) ────────────────────────
   * The roof of a payout bay comes down: broken rock heaps over the bay
   * from divider to divider (two sloped rails of rubble and a capstone on
   * top, or one slope against a wall), so a marble landing on it rolls off
   * into the next bay. It stays for the rest of the game; the WORK that
   * follows digs it out ({type: 'clear', id}: the crew's job, knockers).
   * Never the 13, never the bays either side of it (their dividers stand
   * tall: a heap there would make a pocket a marble could sit in).
   *   caveIn(board, {slot, id?}) → a NEW board with board.caveins[] + the
   *   rubble fixtures (kind 'rail' dress 'rubble', kind 'rubble' circles),
   *   each carrying `cave: id` */
  var CAVE_BAYS = [0, 1, 2, 3, 4, 5, 9, 10, 11, 12];
  var CAVE_TOP = 375, CAVE_FOOT = 385.5;
  function caveIn(b, spec) {
    var c = clone(b), s = c.byId['slot.' + spec.slot];
    if (!s || CAVE_BAYS.indexOf(spec.slot) < 0) return c;
    var n = (c.caveSeq | 0) + 1, id = spec.id || ('cave.' + n);
    var x0 = s.x0, x1 = s.x1, cx = (x0 + x1) / 2, F = c.fixtures;
    function rr(rid, ax, ay, bx, by) { F.push({ id: rid, kind: 'rail', x1: ax, y1: ay, x2: bx, y2: by, r: 1.5, region: 'payout', material: 'rock', dress: 'rubble', cave: id }); }
    function stone(rid, x, y, r) { F.push({ id: rid, kind: 'rubble', x: x, y: y, r: r, region: 'payout', material: 'rock', dress: 'rubble', cave: id }); }
    // the pins in the roof over the bay come down with it (buried in the
    // heap; the dig-out puts them back where they were)
    // (flagged, not removed: a drift nudge on a buried pin still lands, so
    // the dig-out and the drift edits commute)
    var buried = [];
    F.forEach(function (f) {
      if (f.kind !== 'pin' || f.buried || f.id.indexOf('divcap.') === 0) return;
      if (f.y > CAVE_TOP - 12 && f.y < CAVE_FOOT && f.x > x0 - 6 && f.x < x1 + 6) { f.buried = id; buried.push(f.id); }
    });
    var shape;
    if (x0 <= 0) { rr(id + '.r', 0, CAVE_TOP - 2, x1, CAVE_FOOT); shape = 'right'; }            // against the left wall: one slope
    else if (x1 >= W) { rr(id + '.l', x0, CAVE_FOOT, W, CAVE_TOP - 2); shape = 'left'; }      // against the right wall
    else { rr(id + '.l', x0, CAVE_FOOT, cx, CAVE_TOP); rr(id + '.r', cx, CAVE_TOP, x1, CAVE_FOOT); stone(id + '.cap', cx, CAVE_TOP - 1, 2.5); shape = 'roof'; }
    c.caveins = (c.caveins || []).concat([{ id: id, slot: s.id, n: spec.slot, x0: x0, x1: x1, cx: cx, top: CAVE_TOP, foot: CAVE_FOOT, shape: shape, seed: spec.seed | 0, buried: buried }]);
    c.caveSeq = n;
    c.gen = (c.gen | 0) + 1;
    return finish(c);
  }
  function clearCave(b, id) {
    var c = clone(b);
    c.fixtures = c.fixtures.filter(function (f) { return f.cave !== id; });
    c.fixtures.forEach(function (f) { if (f.buried === id) delete f.buried; });
    c.caveins = (c.caveins || []).filter(function (q) { return q.id !== id; });
    c.gen = (c.gen | 0) + 1;
    return finish(c);
  }

  // edit: {type:'move', id, dx, dy, dress?} | {type:'mouth', id, open} |
  //       {type:'chute', id: site, set: 'L'|'R'|null} | {type:'pocket', id, dx} |
  //       {type:'rail', id, end:1|2, d} | {type:'nudge', id, dx, dy} | {type:'dress', id, dress}
  //       | {type:'clear', id} (a cave-in dug out: not drift, never drawn by drawEdits)
  function applyEdit(b, e) {
    if (e.type === 'clear') return clearCave(b, e.id);
    var c = clone(b);
    if (e.type === 'chute') {
      setChute(c, e.id, e.set || null);
    } else {
      var f = c.byId[e.id];
      if (!f) return c;
      var home = f.home || (f.home = { x: f.x, y: f.y, x1: f.x1, y1: f.y1, x2: f.x2, y2: f.y2 });
      if (e.type === 'move' && f.kind === 'pin') {
        var nx = f.x + e.dx, ny = f.y + e.dy, dh = Math.hypot(nx - home.x, ny - home.y);
        if (dh > MOVE_HOME) { nx = home.x + (nx - home.x) * MOVE_HOME / dh; ny = home.y + (ny - home.y) * MOVE_HOME / dh; }
        e = copyEdit(e, { from: { x: f.x, y: f.y } });
        f.x = Math.round(nx * 2) / 2; f.y = Math.round(ny * 2) / 2; f.region = regionAt(f.x, f.y);
        if (e.dress) { f.dress = e.dress; f.material = MAT[e.dress] || f.material; }
        e.to = { x: f.x, y: f.y };
      } else if (e.type === 'nudge' && f.kind === 'pin') {
        f.x = clampTo(f.x + e.dx, home.x - 3, home.x + 3);
        f.y = clampTo(f.y + e.dy, home.y - 3, home.y + 3);
      } else if (e.type === 'dress' && f.kind === 'pin') {
        f.dress = e.dress; f.material = MAT[e.dress] || f.material;
      } else if (e.type === 'rail' && f.kind === 'rail') {
        // lengthen or shorten by d px along the rail at one end, each end
        // within ±RAIL_HOME of home along the rail (wave 5c: it random-walked
        // to 58 px and through the sheave's spokes)
        var hdx = home.x2 - home.x1, hdy = home.y2 - home.y1, HL = Math.hypot(hdx, hdy) || 1, ux = hdx / HL, uy = hdy / HL;
        var s1 = (f.x1 - home.x1) * ux + (f.y1 - home.y1) * uy, s2 = (f.x2 - home.x2) * ux + (f.y2 - home.y2) * uy;
        if (e.end === 1) s1 = clampTo(s1 - e.d, -RAIL_HOME, RAIL_HOME); else s2 = clampTo(s2 + e.d, -RAIL_HOME, RAIL_HOME);
        // …and never into a wheel's spokes: an end is pulled back until it's clear
        var wheels = c.byKind.wheel;
        function clearOfWheels(x, y) { return !wheels.some(function (w) { return Math.hypot(x - w.x, y - w.y) < w.r + 5; }); }
        for (var g1 = 0; g1 < 12 && !clearOfWheels(home.x1 + ux * s1, home.y1 + uy * s1); g1++) s1 += s1 < 0 ? 1 : -1;
        for (var g2 = 0; g2 < 12 && !clearOfWheels(home.x2 + ux * s2, home.y2 + uy * s2); g2++) s2 += s2 < 0 ? 1 : -1;
        f.x1 = home.x1 + ux * s1; f.y1 = home.y1 + uy * s1; f.x2 = home.x2 + ux * s2; f.y2 = home.y2 + uy * s2;
      } else if (e.type === 'mouth' && f.kind === 'tunnel') {
        f.open = !!e.open;
        // the floor beside it: re-laid to run away from a shut mouth (a dead
        // end the marbles would sit in), back as it was when it's opened
        if (f.floor) reslope(c, f.floor.id, f.floor.piece, f.open ? null : f.floor.shut);
      } else if (e.type === 'pocket' && f.kind === 'pocket') {
        f.x = clampTo(f.x + e.dx, home.x - POCKET_HOME, home.x + POCKET_HOME);
        placePocket(c, f);
      }
    }
    c.edits = (c.edits || []).concat([e]);
    c.gen = (c.gen | 0) + 1;
    return c;
  }
  function copyEdit(e, extra) { var o = {}; for (var k in e) o[k] = e[k]; for (var q in extra) o[q] = extra[q]; return o; }
  function clampTo(v, a, b) { return v < a ? a : v > b ? b : v; }
  // a pocket's lips, base and petals follow it (the shape it was built with)
  function placePocket(c, f) {
    var L = c.byId[f.id + '.lipL'], R = c.byId[f.id + '.lipR'], B = c.byId[f.id + '.base'], PL = c.byId[f.id + '.petalL'], PR = c.byId[f.id + '.petalR'];
    if (L) L.x = f.x - 9; if (R) R.x = f.x + 9;
    if (B) { B.x1 = f.x - 8; B.x2 = f.x + 8; }
    if (PL) PL.x = f.x - 15; if (PR) PR.x = f.x + 15;
  }
  // re-lay a floor piece with its crest at crestX (null: as it was built)
  function reslope(c, floorId, pi, crestX) {
    var fl = (c.floors || []).filter(function (q) { return q.id === floorId; })[0]; if (!fl) return;
    var pc = fl.pieces[pi]; if (!pc) return;
    var a = pc.x0, b = pc.x1, cx = crestX == null ? pc.crest0 : clampTo(crestX, a, b), y0 = fl.y + 1.5;
    var run = Math.max(cx - a, b - cx), rise = Math.max(2, Math.min(pc.drop || 8, run * (pc.grade || 0.2))), yc = y0 - rise, pts = [];
    c.fixtures = c.fixtures.filter(function (q) { return q.id !== pc.id + '.l' && q.id !== pc.id + '.r'; });
    function rl(id, x1, y1, x2, y2) { c.fixtures.push({ id: id, kind: 'rail', x1: x1, y1: y1, x2: x2, y2: y2, r: 1.5, region: regionAt((x1 + x2) / 2, (y1 + y2) / 2), material: pc.material, dress: pc.dress }); }
    if (cx > a + 0.5) { rl(pc.id + '.l', a, y0, cx, yc); pts.push([a, y0 - 1.5], [cx, yc - 1.5]); } else pts.push([a, yc - 1.5]);
    if (cx < b - 0.5) { rl(pc.id + '.r', cx, yc, b, y0); pts.push([b, y0 - 1.5]); } else pts.push([b, yc - 1.5]);
    pc.crestX = cx; pc.top = pts;
    finish(c);
  }
  // a chute board under a floor opening: set 'L' (it runs the marbles off to
  // the left) or 'R', or null (taken up)
  function chuteBoard(site, set) {
    var x = site.x, fy = site.fy, k = set === 'L' ? -1 : 1;
    // from the high end under the opening's far lip to the low end well past
    // its near one, hung low enough that a marble rolls out under the floor's
    // end (13 px under the lip: a marble and two timbers need 11)
    return { x1: x - k * 9, y1: fy + 9, x2: x + k * 13, y2: fy + 19 };
  }
  // a board may go in only where its run-out is clear: nothing within a
  // marble's width of where it drops off the low end (a pin there makes a
  // pocket the marble sits in)
  function chuteOk(b, site, set) {
    var g = chuteBoard(site, set), k = set === 'L' ? -1 : 1, ex = g.x2 + k * 5, ey = g.y2 + 5, fs = b.fixtures;
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      if (f.buried || f.chute === site.id) continue;
      if (f.kind === 'pin' || f.kind === 'rubble') { if (Math.hypot(g.x2 - f.x, g.y2 - f.y) < 11) return false; }
      else if (f.kind === 'rail' && !(f.y1 < site.fy + 4 && f.y2 < site.fy + 4)) {
        var dx = f.x2 - f.x1, dy = f.y2 - f.y1, L2 = dx * dx + dy * dy, u = L2 ? clampTo(((ex - f.x1) * dx + (ey - f.y1) * dy) / L2, 0, 1) : 0;
        if (Math.hypot(ex - (f.x1 + dx * u), ey - (f.y1 + dy * u)) < 12) return false;
      }
    }
    return true;
  }
  function setChute(c, id, set) {
    var site = (c.chutes || []).filter(function (q) { return q.id === id; })[0]; if (!site) return;
    c.fixtures = c.fixtures.filter(function (q) { return q.id !== 'chute.' + id; });
    site.set = set || null;
    if (set) { var g = chuteBoard(site, set); c.fixtures.push({ id: 'chute.' + id, kind: 'rail', x1: g.x1, y1: g.y1, x2: g.x2, y2: g.y2, r: 1.5, region: regionAt(site.x, site.fy + 8), material: 'timber', dress: 'chute', chute: id }); }
    finish(c);
  }

  // the rails the knockers may lengthen or shorten (never the floors or walls)
  var EDITABLE_RAILS = ['headframe.brace'];

  /* where a pin may be carried to: in the rock it came from, clear of the
   * other pins (a marble's width, or it would wedge), the rails, the wheels,
   * the pockets, the galleries, a shaft's mouth and the chute places, the
   * tunnel mouths, the legend card's corner and the bays */
  // the 13's own guard: the ore knuckles over the bone, the bone, the ore
  // knobs either side of the cup, and the coal right under the old drift's
  // exit. The crew never carry these, and never set a pin down in the cup's
  // mouth (wave 8: one drift moved knuckle.r over the cup and turned the old
  // drift's route into a lode lane, 35.7 scrip a token)
  var LODE_GUARD = { 'knuckle.l': 1, 'knuckle.r': 1, 'guard.top': 1, 'guard.l': 1, 'guard.r': 1 };
  function lodeZone(b, x, y) {
    var s = null, sl = b.byKind && b.byKind.slot || [];
    for (var i = 0; i < sl.length; i++) if (sl[i].value >= 13) s = sl[i];
    if (!s) return false;
    var cx = (s.x0 + s.x1) / 2;
    return Math.abs(x - cx) <= 14 && y >= 328 && y <= 384;
  }
  function pinSpotOk(b, p, x, y) {
    if (x < 6 || x > W - 6 || y < 68 || y > 380) return false;
    if (LODE_GUARD[p.id] || lodeZone(b, x, y) || lodeZone(b, p.home ? p.home.x : p.x, p.home ? p.home.y : p.y)) return false;
    if (regionAt(x, y) !== regionAt(p.home ? p.home.x : p.x, p.home ? p.home.y : p.y)) return false;
    if (x < 68 && y > 236 && y < 334) return false;                                   // behind the legend card
    var fs = b.fixtures;
    for (var i = 0; i < fs.length; i++) {
      var f = fs[i];
      if (f === p || f.buried) continue;
      if (f.kind === 'pin' || f.kind === 'rubble') { if (Math.hypot(x - f.x, y - f.y) < 11.5) return false; }
      else if (f.kind === 'rail') {
        var dx = f.x2 - f.x1, dy = f.y2 - f.y1, L2 = dx * dx + dy * dy, u = L2 ? clampTo(((x - f.x1) * dx + (y - f.y1) * dy) / L2, 0, 1) : 0;
        if (Math.hypot(x - (f.x1 + dx * u), y - (f.y1 + dy * u)) < 11.5) return false;
      } else if (f.kind === 'wheel') { if (Math.hypot(x - f.x, y - f.y) < f.r + 11) return false; }
      else if (f.kind === 'pocket') { if (Math.abs(x - f.x) < 27 && y > f.y - 20 && y < f.y + 16) return false; }
      else if (f.kind === 'tunnel') { if (Math.hypot(x - f.a.x, y - f.a.y) < f.a.r + 9 || Math.hypot(x - f.b.x, y - f.b.y) < 11) return false; }
      else if (f.kind === 'cart') { if (x > f.x1 - 18 && x < f.x2 + 18 && y > f.y - 20 && y < f.y + 6) return false; }
    }
    var fl = b.floors || [];
    for (var j = 0; j < fl.length; j++) {
      var F = fl[j];
      if (x >= F.x0 - 2 && x <= F.x1 + 2 && y > F.y - 20 && y < F.y + 4) return false;  // in a gallery
      for (var k = 0; k < F.openings.length; k++) { var o = F.openings[k]; if (Math.abs(x - o.x) < o.w / 2 + 7 && y > F.y && y < F.y + 18) return false; }
    }
    return true;
  }
  // a candidate place for a pocket: its lips and petals clear of other pins
  function pocketOk(b, pk, nx) {
    var ids = [pk.id + '.lipL', pk.id + '.lipR', pk.id + '.petalL', pk.id + '.petalR'], offs = [-9, 9, -15, 15], ys = [pk.y - 2, pk.y - 2, pk.y - 10, pk.y - 10];
    for (var i = 0; i < 4; i++) {
      if (!b.byId[ids[i]]) continue;
      var x = nx + offs[i], y = ys[i];
      if (x < 6 || x > W - 6) return false;
      for (var j = 0; j < b.fixtures.length; j++) {
        var f = b.fixtures[j];
        if (f.buried || f.id.indexOf(pk.id + '.') === 0) continue;
        if (f.kind === 'pin' && Math.hypot(x - f.x, y - f.y) < 10) return false;
      }
    }
    return true;
  }
  // may this brace end go d px along? (inside its envelope, clear of the sheave)
  function railOk(b, r, end, d) {
    var h = r.home || { x1: r.x1, y1: r.y1, x2: r.x2, y2: r.y2 }, hdx = h.x2 - h.x1, hdy = h.y2 - h.y1, HL = Math.hypot(hdx, hdy) || 1, ux = hdx / HL, uy = hdy / HL;
    var s = end === 1 ? (r.x1 - h.x1) * ux + (r.y1 - h.y1) * uy - d : (r.x2 - h.x2) * ux + (r.y2 - h.y2) * uy + d;
    if (s < -RAIL_HOME - 0.01 || s > RAIL_HOME + 0.01) return false;
    var ex = (end === 1 ? h.x1 : h.x2) + ux * s, ey = (end === 1 ? h.y1 : h.y2) + uy * s;
    return !b.byKind.wheel.some(function (w) { return Math.hypot(ex - w.x, ey - w.y) < w.r + 6; });
  }

  // draw n candidate edits from the legal set for the game `seed`
  var DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  function drawEdits(b, seed, n, salt) {
    var out = [], pins = b.byKind.pin.filter(function (p) { return p.drift && !p.buried && !LODE_GUARD[p.id] && p.id.indexOf('divcap.') !== 0 && p.id.indexOf('pail.') !== 0 && p.id.indexOf('powder.') !== 0; });
    var tunnels = b.byKind.tunnel, shut = tunnels.filter(function (t) { return t.open === false; });
    var chutes = b.chutes || [], setN = chutes.filter(function (c) { return c.set; }).length;
    salt = salt | 0;
    for (var k = 0; k < n; k++) {
      var i = k * 7 + salt * 131, r = hash01(seed, i), e = null;
      // a shut mouth is the first job on the next shift, most times: CLOSED FOR REPAIRS lasts a game
      if (k === 0 && shut.length && hash01(seed, i + 9) < 0.75) e = { type: 'mouth', id: shut[0].id, open: true };
      else if (r < 0.46) e = drawMove(b, pins, seed, i);
      else if (r < 0.68) {
        var site = chutes[Math.floor(hash01(seed, i + 2) * chutes.length)];
        if (site) {
          var sets = (site.set ? [null, site.set === 'L' ? 'R' : 'L'] : setN < CHUTES_MAX ? ['L', 'R'] : [])
            .filter(function (q) { return q === null || chuteOk(b, site, q); });
          if (sets.length) e = { type: 'chute', id: site.id, set: sets[Math.floor(hash01(seed, i + 3) * sets.length)] };
        }
      } else if (r < 0.78) {
        var tn = tunnels[Math.floor(hash01(seed, i + 2) * tunnels.length)];
        if (tn) e = { type: 'mouth', id: tn.id, open: !tn.open };
      } else if (r < 0.92) {
        var pks = b.byKind.pocket, pk = pks[Math.floor(hash01(seed, i + 2) * pks.length)];
        if (pk) {
          var home = pk.home ? pk.home.x : pk.x, opts = [-10, -8, 8, 10].filter(function (d) { return Math.abs(pk.x + d - home) <= POCKET_HOME && pocketOk(b, pk, pk.x + d); });
          if (opts.length) e = { type: 'pocket', id: pk.id, dx: opts[Math.floor(hash01(seed, i + 3) * opts.length)] };
        }
      } else {
        var rid = EDITABLE_RAILS[Math.floor(hash01(seed, i + 2) * EDITABLE_RAILS.length)], rf = b.byId[rid];
        if (rf) {
          var ro = [];
          [1, 2].forEach(function (end) { [-6, 6].forEach(function (d) { if (railOk(b, rf, end, d)) ro.push({ end: end, d: d }); }); });
          if (ro.length) { var q = ro[Math.floor(hash01(seed, i + 3) * ro.length)]; e = { type: 'rail', id: rid, end: q.end, d: q.d }; }
        }
      }
      if (!e) e = drawMove(b, pins, seed, i + 1);
      if (e) out.push(e);
    }
    return out;
  }
  // a pin carried a whole cell: every other game they fuss over the vein
  function drawMove(b, pins, seed, i) {
    for (var tries = 0; tries < 12; tries++) {
      var j = i + tries * 17;
      var pool = hash01(seed, j + 1) < 0.45 ? pins.filter(function (p) { return p.region === 'vein' || p.region === 'payout'; }) : pins;
      if (!pool.length) pool = pins;
      var p = pool[Math.floor(hash01(seed, j + 2) * pool.length)];
      var d0 = Math.floor(hash01(seed, j + 3) * 8), dist = 9 + Math.round(hash01(seed, j + 4) * 4);
      for (var q = 0; q < 8; q++) {
        var D = DIRS[(d0 + q) % 8], len = D[0] && D[1] ? dist * 0.75 : dist;
        var dx = Math.round(D[0] * len * 2) / 2, dy = Math.round(D[1] * len * 2) / 2, h = p.home || p;
        if (Math.hypot(p.x + dx - h.x, p.y + dy - h.y) > MOVE_HOME) continue;
        if (!pinSpotOk(b, p, p.x + dx, p.y + dy)) continue;
        var e = { type: 'move', id: p.id, dx: dx, dy: dy };
        if (hash01(seed, j + 6) < 0.3 && PIN_DRESS_SWAP[p.dress]) e.dress = PIN_DRESS_SWAP[p.dress];
        return e;
      }
    }
    return null;
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
  function base(knobs) { return knobs ? buildBase(knobs) : clone(BASE); }

  var api = {
    W: W, H: H, SLOT_Y: SLOT_Y, MARBLE_R: MARBLE_R,
    REGIONS: REGIONS, STRATA: STRATA, regionAt: regionAt,
    base: base, finish: finish, clone: clone,
    pose: pose, cartPose: cartPose, cartLoading: cartLoading, cartVel: cartVel, cartSegments: cartSegments,
    wheelAngle: wheelAngle, wheelOmega: wheelOmega, wheelSegments: wheelSegments,
    slotAt: slotAt,
    EDITS: EDITS, drawEdits: drawEdits, applyEdit: applyEdit, pinSpotOk: pinSpotOk, chuteBoard: chuteBoard, chuteOk: chuteOk,
    CAVE_BAYS: CAVE_BAYS, caveIn: caveIn, clearCave: clearCave,
    validate: validate, validator: validator,
    hash01: hash01, strSeed: strSeed
  };
  root.PachinkoBoard = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

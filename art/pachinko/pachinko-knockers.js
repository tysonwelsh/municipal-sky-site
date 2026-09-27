/* MOTHER LODE — the tommyknockers (PLAN §6, wave 3)
 *
 * Six carved and painted figurines of old miners who should not be alive
 * and are. This file is their minds and their legs: where they can stand,
 * how they get there, what they do between games (the board's drift, done
 * by hand), what they potter at when nobody is playing, how they flinch and
 * duck and hop while you play, and the two tricks the mischief phase asks
 * of them (a theft, a knock). pachinko-art-figures.js paints them.
 *
 * DETERMINISTIC. Everything runs on the sim clock (api.now()) and seeded
 * hashes; no Math.random, no Date. The core (nav, stances, routes) loads in
 * Node (module.exports) for the lab.
 *
 * STOP MOTION. The crew move on a shared shutter at FPS (8) frames a second,
 * the way a stop-motion film is shot: every knocker's pose holds between
 * frames and snaps to the next; limbs are quantised to 15°. Old Jory moves
 * on every other frame. Marbles, lamps and the machine are smooth; the
 * figurines are not. That contrast is the "shouldn't be alive".
 *
 * WHERE THEY CAN BE (buildNav): feet are always on a floor or a rung.
 *   walks   the surface (y 64), every gallery floor piece longer than 12 px
 *           (its own slope), the dry sump's floor, and the sills of their doors
 *   links   hops over the openings between floor pieces (a toy's hop);
 *           ladders: the main shaft, the ladderway, two manways, a ladder down
 *           the old chute, one down the sump raise (the knockers' own, drawn
 *           as props where the art has none); and THE ROCK: their little doors
 *           (the tunnel mouths, a door in the back wall of each gallery, three
 *           beyond the working faces where the company stopped) join up
 *           through the rock. A knocker in the rock is hidden; his lamp is a
 *           glow moving behind it.
 *   stances to work a point: standing within reach, on a rope ladder hung
 *           from the walk above, or on a ladder propped up from the walk
 *           below. They pass in front of the rock as toys in a model; never
 *           through it.
 *
 * THE PART (main's PARTS api): PachinkoKnockers.attach(api) → part with
 *   step(t, dt), gameStart(seed), gameEnd(r), work(ctx) → performer,
 *   figures(view), fx(view), destroy(), and for the mischief phase (wave 4):
 *
 *   part.doors()                          [{id, x, y, kind}] their doors
 *   part.canSteal(m, opts?)               a plan or null, no side effects: the
 *                                         marble's path is predicted ~1.5 s
 *                                         ahead (a copy of it in the real
 *                                         physics) and a door found that it
 *                                         passes within a knocker's reach of,
 *                                         at least opts.lead (0.45) s ahead.
 *                                         plan = {m, door, t, x, y, who}
 *   part.theft({m, who?, door?, to?, mode?, v?, relay?})
 *                                         a knocker steps out of `door` (the
 *                                         planned one by default), waits with
 *                                         his arms out, catches the marble in
 *                                         two hands (event `stolen {m, x, y}`),
 *                                         runs back in; a glow crosses the rock;
 *                                         at door `to` (default: by seed) he
 *                                         (or `relay`, another knocker) steps
 *                                         out and sets the marble down on the
 *                                         floor (mode 'set') or throws it
 *                                         (mode 'toss', v {vx, vy}) or lets it
 *                                         drop ('drop'). → {ok, plan} | {ok:false}
 *                                         While held the marble is frozen in
 *                                         the world (phase 'pocket', m.stolen)
 *                                         and drawn in his hands; its age is
 *                                         given back on release (no timeout).
 *   part.knockListen({x, y, who?, n?, alarm?})
 *                                         the nearest free knocker (or who)
 *                                         goes to the rock at (x, y) — out of a
 *                                         door if it is far — knocks three times,
 *                                         puts his ear to it, knocks, listens;
 *                                         alarm: he backs off, arms up. The
 *                                         cave-in telegraph. → {ok, who, tKnock}
 *   part.nightShift()                     who is in the rock during a game
 *   part.busy(who)                        is he doing something scripted
 *   api.knockers                          the same part (set at attach)
 *   PachinkoKnockers.live                 the last attached part (the lab)
 *
 * HARNESS (?harness=1): ?force=theft plays a theft the moment a game is
 * dived in (a free marble, stolen from the first door it passes, set down
 * again elsewhere); ?force=knock a knock and listen; ?force=playdead taps
 * the glass. ?mode=work shows the crew at the drift edits.
 *
 * EVENTS OUT (api.emit): figure {what, x, y, who} with what ∈ step · climb ·
 * hop · land · pull · tap · set (the TOCK: the edit lands) · lay · push ·
 * toss · knock · listen · door (open|close in `how`) · rope (a rope ladder
 * unrolled or hauled up) · pick · oil · eat · snore · wake · flick · mark
 * (a tally stroke) · topple · upright · release (a stolen marble put back) ·
 * sweep · dig · capoff; stolen {m, x, y}. PLAN §12 and requests.md list
 * which the sound already knows.
 */
(function (root) {
  'use strict';

  var PB = root.PachinkoBoard || (typeof require !== 'undefined' ? require('./pachinko-board.js') : null);
  var FPS = 8, D = Math.PI / 180, SURF = 64, RUNG = 4;

  function hash01(a, b) { return PB.hash01(a | 0, b | 0); }
  function h3(a, b, c) { return PB.hash01((a | 0) * 7919 + (c | 0), b | 0); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function sgn(v) { return v < 0 ? -1 : 1; }

  /* ══ the crew ═════════════════════════════════════════════════════════
   * gait: px a frame walking, frames between moves (Jory: every other one),
   * a rung a move climbing. post: where each stands for a game. */
  var CREW = [
    { who: 'tall',   name: 'Absalom',      tool: null,      step: 4, every: 1, post: { floor: 'surface', x: 52 },  zone: ['surface'],            job: 1.0 },
    { who: 'pick',   name: 'Ezra',         tool: 'pick',    step: 4, every: 1, post: { floor: 'floorA', x: 176 },  zone: ['floorA'],             job: 0.8 },
    { who: 'lamp',   name: 'Tobias',       tool: 'lantern', step: 3, every: 1, post: { floor: 'floorB', x: 164 },  zone: ['floorB'],             job: 1.5 },
    { who: 'old',    name: 'Old Jory',     tool: 'cane',    step: 2, every: 2, post: { floor: 'floorC', x: 160 },  zone: ['floorC'],             job: 4.0 },
    { who: 'little', name: 'Pip',          tool: 'shovel',  step: 3, every: 1, post: { floor: 'floorC', x: 78 },   zone: ['floorC', 'sump'],     job: 0.9 },
    { who: 'tally',  name: 'Mr. Pengelly', tool: 'tally',   step: 3, every: 1, post: { floor: 'surface', x: 238 }, zone: ['surface'],            job: 99 }
  ];
  var BY_WHO = {}; CREW.forEach(function (c, i) { BY_WHO[c.who] = i; });

  /* ══ poses (degrees; quantised at display) ═══════════════════════════ */
  var P = {
    stand:   { lean: 0, head: 0, armL: -6, armR: 6, legL: -6, legR: 6 },
    shift:   { lean: 4, head: 5, armL: 0, armR: 12, legL: 0, legR: 10 },
    walk1:   { lean: 5, head: 0, armL: 30, armR: -30, legL: 30, legR: -30 },
    walk2:   { lean: 5, head: 0, armL: 15, armR: -15, legL: 0, legR: 0 },
    walk3:   { lean: 5, head: 0, armL: -30, armR: 30, legL: -30, legR: 30 },
    walk4:   { lean: 5, head: 0, armL: -15, armR: 15, legL: 0, legR: 0 },
    crouch:  { lean: 30, head: -10, armL: 30, armR: 45, legL: 30, legR: -30 },
    air:     { lean: 5, head: -15, armL: 120, armR: 135, legL: 60, legR: 15 },
    land:    { lean: 25, head: 0, armL: 60, armR: 75, legL: 30, legR: -15 },
    duck:    { lean: 45, head: 30, armL: 150, armR: 150, legL: 30, legR: -30 },
    flinch:  { lean: -25, head: -20, armL: 75, armR: 120, legL: -15, legR: 15 },
    look:    { lean: -5, head: -30, armL: -6, armR: 6, legL: -6, legR: 6 },
    reach:   { lean: 15, head: 10, armL: 75, armR: 90, legL: 15, legR: -10 },
    tugBack: { lean: -20, head: -10, armL: 75, armR: 75, legL: 30, legR: -15 },
    tugFwd:  { lean: 10, head: 5, armL: 90, armR: 90, legL: 15, legR: -10 },
    pop:     { lean: -30, head: -25, armL: 60, armR: 150, legL: 45, legR: -15 },
    inspect: { lean: -5, head: 20, armL: 45, armR: 105, legL: -6, legR: 6 },
    rummage: { lean: 20, head: 30, armL: 30, armR: 15, legL: -6, legR: 6 },
    holdPin: { lean: 10, head: 10, armL: 90, armR: 60, legL: 15, legR: -10 },
    up:      { lean: -5, head: -10, armL: 90, armR: 165, legL: 15, legR: -10 },
    upBig:   { lean: -20, head: -20, armL: 90, armR: 195, legL: 30, legR: -15 },
    hit:     { lean: 20, head: 10, armL: 90, armR: 75, legL: 15, legR: -10 },
    wait:    { lean: -5, head: -15, armL: 90, armR: 150, legL: 0, legR: 0 },
    admire:  { lean: -15, head: 15, armL: -15, armR: 30, legL: -10, legR: 10 },
    flick:   { lean: 10, head: 10, armL: 0, armR: 90, legL: -6, legR: 6 },
    push:    { lean: 30, head: -5, armL: 90, armR: 90, legL: -30, legR: 30 },
    shove:   { lean: 40, head: 0, armL: 75, armR: 75, legL: -45, legR: 30 },
    carry:   { lean: 5, head: 0, armL: 90, armR: 90, legL: -15, legR: 15 },
    overhead:{ lean: 0, head: -10, armL: 165, armR: 165, legL: -6, legR: 6 },
    toss1:   { lean: -20, head: -15, armL: 45, armR: 180, legL: 15, legR: -15 },
    toss2:   { lean: 25, head: 0, armL: 15, armR: 60, legL: -15, legR: 30 },
    point:   { lean: -6, head: -12, armL: -5, armR: 120, legL: -6, legR: 6 },
    pointUp: { lean: -15, head: -30, armL: -5, armR: 150, legL: -6, legR: 6 },
    cheer:   { lean: -15, head: -15, armL: 165, armR: 165, legL: -15, legR: 15 },
    cheer2:  { lean: -10, head: -30, armL: 150, armR: 180, legL: 0, legR: 0 },
    stiff:   { lean: 0, head: 0, armL: 0, armR: 0, legL: 0, legR: 0 },
    knock1:  { lean: 10, head: 5, armL: -6, armR: 105, legL: 0, legR: 0 },
    knock2:  { lean: 15, head: 5, armL: -6, armR: 75, legL: 0, legR: 0 },
    listen:  { lean: 35, head: 25, armL: 150, armR: 60, legL: -15, legR: 15 },
    alarm:   { lean: -25, head: -20, armL: 120, armR: 150, legL: 30, legR: -15 },
    sitEdge: { lean: -10, head: 10, armL: 30, armR: 45, legL: 15, legR: 30 },
    eat1:    { lean: -5, head: 5, armL: 60, armR: 30, legL: 15, legR: 30 },
    eat2:    { lean: -5, head: -5, armL: 150, armR: 30, legL: 30, legR: 15 },
    doze:    { lean: 20, head: 45, armL: 15, armR: 15, legL: 15, legR: 30 },
    yawn:    { lean: -20, head: -30, armL: 165, armR: 180, legL: -10, legR: 10 },
    lookMoon:{ lean: -15, head: -40, armL: -6, armR: 6, legL: -6, legR: 6 },
    capoff:  { lean: 5, head: 15, armL: 60, armR: 6, legL: -6, legR: 6 },
    bend:    { lean: 45, head: 35, armL: 30, armR: 45, legL: -10, legR: 15 },
    oil:     { lean: -15, head: -30, armL: 30, armR: 165, legL: -6, legR: 6 },
    rub1:    { lean: 5, head: 0, armL: 30, armR: 105, legL: -6, legR: 6 },
    rub2:    { lean: 5, head: 0, armL: 30, armR: 120, legL: -6, legR: 6 },
    dig1:    { lean: 30, head: 15, armL: 60, armR: 30, legL: -15, legR: 30, toolA: 30 },
    dig2:    { lean: -10, head: -10, armL: 120, armR: 135, legL: -15, legR: 15, toolA: 0 },
    sweep1:  { lean: 25, head: 20, armL: 45, armR: 60, legL: -15, legR: 15, toolA: 45 },
    sweep2:  { lean: 25, head: 20, armL: 30, armR: 30, legL: 15, legR: -15, toolA: 60 },
    swingUp: { lean: -20, head: -15, armL: 150, armR: 165, legL: -15, legR: 15, toolA: 0 },
    swingTop:{ lean: -30, head: -25, armL: 180, armR: 195, legL: -15, legR: 20, toolA: -15 },
    swingDn: { lean: 20, head: 10, armL: 60, armR: 75, legL: -15, legR: 15, toolA: 30 },
    lanternUp:{ lean: -5, head: -15, armL: -6, armR: 135, legL: -6, legR: 6 },
    lanternOut:{ lean: 5, head: 5, armL: -6, armR: 75, legL: -6, legR: 6 },
    lanternLow:{ lean: 0, head: 0, armL: -6, armR: 45, legL: -6, legR: 6 },
    caneWalk1:{ lean: 0, head: 0, armL: -15, armR: 30, legL: 15, legR: -15, toolA: -30 },
    caneWalk2:{ lean: 0, head: 0, armL: -15, armR: 15, legL: -15, legR: 15, toolA: -15 },
    caneRest:{ lean: -10, head: -5, armL: -45, armR: 25, legL: -6, legR: 6, toolA: -25 },
    read:    { lean: 5, head: 30, armL: 45, armR: 60, legL: -6, legR: 6 },
    write:   { lean: 5, head: 35, armL: 75, armR: 60, legL: -6, legR: 6 },
    ready:   { lean: 20, head: -10, armL: 75, armR: 90, legL: 30, legR: -30 },
    grab:    { lean: 10, head: 15, armL: 75, armR: 75, legL: 15, legR: -15 },
    holdUp:  { lean: -10, head: -10, armL: 120, armR: 120, legL: -6, legR: 6 },
    run1:    { lean: 25, head: 0, armL: 75, armR: 75, legL: 45, legR: -30 },
    run2:    { lean: 25, head: 0, armL: 75, armR: 75, legL: -30, legR: 45 },
    set:     { lean: 40, head: 25, armL: 45, armR: 45, legL: 15, legR: -15 },
    shrug:   { lean: -5, head: 10, armL: 45, armR: 45, legL: -6, legR: 6 },
    // at rest, each his own way (the tools planted, not through the floor)
    restTall:  { lean: 0, head: 5, armL: -30, armR: -30, legL: -6, legR: 6 },        // hands behind his back
    restPick:  { lean: -5, head: 0, armL: 30, armR: 45, legL: -6, legR: 6, toolA: -45 }, // leaning on the pick
    restLamp:  { lean: -5, head: 0, armL: 30, armR: 45, legL: -6, legR: 6 },           // the lantern out in front
    restOld:   { lean: -5, head: 0, armL: -30, armR: 45, legL: -6, legR: 6, toolA: -45 },// on his cane, a hand on his back
    restLittle:{ lean: 0, head: 0, armL: -6, armR: 150, legL: -6, legR: 6, toolA: -150 },// on the shovel's grip, blade down
    restTally: { lean: -5, head: 15, armL: 30, armR: 45, legL: -6, legR: 6 },          // reading his card
    duckLamp:  { lean: 45, head: 30, armL: 150, armR: 60, legL: 30, legR: -30 },       // the light kept low and safe
    // on a ladder, from behind (arms measure outward from straight down)
    climbA:  { armL: 195, armR: 180, legL: 5, legR: 5 },
    climbB:  { armL: 180, armR: 195, legL: 5, legR: 5 },
    hang:    { armL: 190, armR: 190, legL: 0, legR: 0 },
    ladderReach: { armL: 165, armR: 90, legL: 0, legR: 0 },
    ladderUp:{ armL: 165, armR: 150, legL: 0, legR: 0 },
    ladderHit:{ armL: 165, armR: 75, legL: 0, legR: 0 },
    ladderTug:{ armL: 165, armR: 105, legL: 5, legR: 0 },
    ladderLamp:{ armL: 165, armR: 120, legL: 0, legR: 0 }
  };

  /* ══ NAV: walks, links, doors ══════════════════════════════════════════ */
  // fixed ladders: the art paints some; the knockers bring the rest
  var LADDERS = [
    { id: 'shaft',  x: 90,  top: 'surface', topX: 90,  bot: 'floorA', botX: 89, lx: 88, w: 4, paint: [140, 158] },
    { id: 'ladderway', x: 17, top: 'floorA', topX: 26, topY: 149.5, bot: 'floorB', botX: 17, lx: 15, w: 4, paint: [217, 235] },
    { id: 'manwayA', x: 150, top: 'floorA', topX: [140, 160], bot: 'floorB', botX: 150, paint: [158, 235] },
    { id: 'chuteB', x: 130, top: 'floorB', topX: [118, 138], bot: 'floorC', botX: 130, paint: [238, 317] },
    { id: 'eastB',  x: 240, top: 'floorB', topX: 240, bot: 'floorC', botX: 240, paint: [238, 316] },
    { id: 'raise',  x: 93,  top: 'floorC', topX: [84, 104], bot: 'sump', botX: 93, paint: [318, 384] }
  ];
  // their doors: the two tunnel mouths, one in the back wall of each gallery
  // (a hairline arch until it opens), three beyond the working faces
  var DOORS = [
    { id: 'drift',  floor: 'floorB', x: 10, mouth: 'tunnel.drift', kind: 'mouth' },
    { id: 'office', floor: 'floorB', x: 254, mouth: 'tunnel.office', kind: 'mouth' },
    { id: 'a1', floor: 'floorA', x: 118 }, { id: 'a2', floor: 'floorA', x: 166 },
    { id: 'b1', floor: 'floorB', x: 105 }, { id: 'b2', floor: 'floorB', x: 228 },
    { id: 'c1', floor: 'floorC', x: 114 }, { id: 'c2', floor: 'floorC', x: 172 },
    { id: 's1', floor: 'sump', x: 30 },
    { id: 'rA', sill: [263, 275], y: 158, x: 269, kind: 'face' }, { id: 'rA2', sill: [288, 300], y: 162, x: 294, kind: 'face' },
    { id: 'rB', sill: [265, 277], y: 242, x: 270, kind: 'face' }, { id: 'rB2', sill: [296, 308], y: 241, x: 302, kind: 'face' },
    { id: 'rC', sill: [271, 283], y: 329, x: 277, kind: 'face' }, { id: 'rC2', sill: [292, 304], y: 329, x: 298, kind: 'face' }
  ];

  function ptsY(pts, x) {
    if (x <= pts[0][0]) return pts[0][1];
    for (var k = 0; k < pts.length - 1; k++) if (x <= pts[k + 1][0]) {
      var u = (x - pts[k][0]) / Math.max(0.001, pts[k + 1][0] - pts[k][0]);
      return pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u;
    }
    return pts[pts.length - 1][1];
  }
  function walkY(w, x) {
    x = clamp(x, w.x0, w.x1);
    var y = ptsY(w.pts, x), yl = ptsY(w.pts, x - 5), yr = ptsY(w.pts, x + 5);
    return Math.round(Math.min(y, (yl + yr) / 2));
  }

  function buildNav(board) {
    var walks = {}, list = [], links = [], doors = {}, ladders = {};
    function addWalk(w) { walks[w.id] = w; list.push(w); return w; }
    addWalk({ id: 'surface', floor: 'surface', kind: 'surface', x0: 5, x1: 315, pts: [[5, SURF], [315, SURF]] });
    (board.floors || []).forEach(function (f) {
      f.pieces.forEach(function (p) {
        if (p.x1 - p.x0 < 12) return;
        addWalk({ id: p.id, floor: f.id, kind: 'floor', x0: p.x0 + 3, x1: p.x1 - 3, pts: p.top });
      });
    });
    // the dry sump's floor (the pit bottom above the bays)
    addWalk({ id: 'sump', floor: 'sump', kind: 'sump', x0: 12, x1: 90, pts: [[12, 383], [90, 383]] });
    function walkAt(floor, x) {
      var best = null, bd = 1e9;
      list.forEach(function (w) {
        if (w.floor !== floor) return;
        var d = x < w.x0 ? w.x0 - x : x > w.x1 ? x - w.x1 : 0;
        if (d < bd) { bd = d; best = w; }
      });
      return best;
    }
    // hops over the openings (a toy's hop; they don't hop the ladderway)
    var byFloor = {};
    list.forEach(function (w) { if (w.kind === 'floor') (byFloor[w.floor] = byFloor[w.floor] || []).push(w); });
    for (var fid in byFloor) {
      var ws = byFloor[fid].sort(function (a, b) { return a.x0 - b.x0; });
      for (var i = 0; i < ws.length - 1; i++) {
        var gap = ws[i + 1].x0 - ws[i].x1;
        if (gap > 0 && gap <= 24) links.push({ kind: 'hop', a: { w: ws[i].id, x: ws[i].x1 }, b: { w: ws[i + 1].id, x: ws[i + 1].x0 }, gap: gap });
      }
    }
    // ladders
    LADDERS.forEach(function (L) {
      var bw = walkAt(L.bot, L.botX);
      if (!bw) return;
      var yb = walkY(bw, L.botX);
      var tops = [].concat(L.topX).map(function (tx) { return walkAt(L.top, tx) && { w: walkAt(L.top, tx), x: clamp(tx, walkAt(L.top, tx).x0, walkAt(L.top, tx).x1) }; }).filter(Boolean);
      if (!tops.length) return;
      var yt = L.topY != null ? L.topY : Math.min.apply(null, tops.map(function (q) { return walkY(q.w, q.x); }));
      var lad = { id: L.id, x: L.x, y0: Math.round(yt), y1: yb, lx: L.lx, w: L.w || 5, paint: L.paint, fixed: true };
      ladders[L.id] = lad;
      tops.forEach(function (q) {
        links.push({ kind: 'ladder', ladder: lad.id, a: { w: q.w.id, x: q.x }, b: { w: bw.id, x: clamp(L.botX, bw.x0, bw.x1) } });
      });
    });
    // doors and the rock between them
    DOORS.forEach(function (d0) {
      var d = { id: d0.id, kind: d0.kind || 'wall', mouth: d0.mouth || null };
      var mouth = d0.mouth && board.byId && board.byId[d0.mouth];
      if (d0.sill) {
        var w = addWalk({ id: 'sill.' + d0.id, floor: 'sill.' + d0.id, kind: 'sill', x0: d0.sill[0], x1: d0.sill[1], pts: [[d0.sill[0], d0.y], [d0.sill[1], d0.y]] });
        d.w = w.id; d.x = d0.x; d.y = d0.y;
      } else {
        var ww = walkAt(d0.floor, d0.x);
        if (!ww) return;
        d.w = ww.id; d.x = clamp(d0.x, ww.x0, ww.x1); d.y = walkY(ww, d.x);
      }
      if (mouth) { d.mx = mouth.a.x; d.my = mouth.a.y; d.x = clamp(mouth.a.x + 3, walks[d.w].x0, walks[d.w].x1); d.y = walkY(walks[d.w], d.x); }
      doors[d.id] = d;
    });
    var dl = Object.keys(doors).map(function (k) { return doors[k]; });
    for (var a = 0; a < dl.length; a++) for (var b2 = a + 1; b2 < dl.length; b2++) {
      links.push({ kind: 'rock', door: dl[a].id, door2: dl[b2].id, a: { w: dl[a].w, x: dl[a].x }, b: { w: dl[b2].w, x: dl[b2].x },
        dist: Math.abs(dl[a].x - dl[b2].x) + Math.abs(dl[a].y - dl[b2].y) });
    }
    return { walks: walks, list: list, links: links, doors: doors, ladders: ladders, walkAt: walkAt, board: board };
  }

  /* ── routes: Dijkstra over link endpoints ─────────────────────────── */
  // in WORK they hurry: a longer step, two rungs a frame, quick through the rock
  function speeds(c, hurry) {
    var walk = stepOf(c, hurry) * FPS / c.every, climb = RUNG * (hurry ? 2 : 1) * FPS / c.every;
    return { walk: walk, climb: climb, hop: 0.6 * c.every, rock: hurry ? 150 : 80, door: 0.9 };
  }
  function stepOf(c, hurry) { return hurry && c.who !== 'old' ? c.step + 1 : c.step; }
  function linkCost(L, sp, nav) {
    if (L.kind === 'hop') return sp.hop;
    if (L.kind === 'ladder') { var ld = nav.ladders[L.ladder]; return (ld.y1 - ld.y0) / sp.climb + 0.5; }
    if (L.kind === 'rock') return sp.door * 2 + L.dist / sp.rock;
    return 1;
  }
  // from {w, x} to {w, x}; returns [moves] or null. opts.noRock: walk only
  function route(nav, from, to, c, opts) {
    opts = opts || {};
    var sp = speeds(c, opts.hurry);
    if (from.w === to.w) { var same = [{ type: 'walk', w: to.w, x: to.x }]; same.cost = Math.abs(from.x - to.x) / sp.walk; return same; }
    var nodes = [{ w: from.w, x: from.x }, { w: to.w, x: to.x }], edges = [];
    function node(p) { nodes.push({ w: p.w, x: p.x }); return nodes.length - 1; }
    nav.links.forEach(function (L, li) {
      if (opts.noRock && L.kind === 'rock') return;
      var ia = node(L.a), ib = node(L.b), cost = linkCost(L, sp, nav);
      edges.push([ia, ib, cost, li, 1]); edges.push([ib, ia, cost, li, -1]);
    });
    // along each walk: every pair of nodes on the same walk
    var byW = {};
    nodes.forEach(function (n, i) { (byW[n.w] = byW[n.w] || []).push(i); });
    for (var wid in byW) {
      var ids = byW[wid];
      for (var i = 0; i < ids.length; i++) for (var j = 0; j < ids.length; j++) if (i !== j) {
        edges.push([ids[i], ids[j], Math.abs(nodes[ids[i]].x - nodes[ids[j]].x) / sp.walk, -1, 0]);
      }
    }
    var dist = nodes.map(function () { return Infinity; }), prev = nodes.map(function () { return null; }), done = nodes.map(function () { return false; });
    var out = nodes.map(function () { return []; });
    edges.forEach(function (e) { out[e[0]].push(e); });
    dist[0] = 0;
    for (var it = 0; it < nodes.length; it++) {
      var u = -1, bd = Infinity;
      for (var q = 0; q < nodes.length; q++) if (!done[q] && dist[q] < bd) { bd = dist[q]; u = q; }
      if (u < 0 || u === 1) break;
      done[u] = true;
      out[u].forEach(function (e) { if (dist[u] + e[2] < dist[e[1]]) { dist[e[1]] = dist[u] + e[2]; prev[e[1]] = e; } });
    }
    if (!isFinite(dist[1])) return null;
    var chain = [], cur = 1;
    while (cur !== 0) { var e = prev[cur]; chain.unshift(e); cur = e[0]; }
    var moves = [];
    chain.forEach(function (e) {
      var a = nodes[e[0]], b = nodes[e[1]];
      if (e[3] < 0) { if (moves.length && moves[moves.length - 1].type === 'walk' && moves[moves.length - 1].w === b.w) moves[moves.length - 1].x = b.x; else moves.push({ type: 'walk', w: b.w, x: b.x }); return; }
      var L = nav.links[e[3]];
      if (moves.length === 0 || moves[moves.length - 1].w !== a.w || moves[moves.length - 1].x !== a.x) moves.push({ type: 'walk', w: a.w, x: a.x });
      if (L.kind === 'hop') moves.push({ type: 'hop', w: b.w, x: b.x });
      else if (L.kind === 'ladder') moves.push({ type: 'ladder', ladder: L.ladder, w: b.w, x: b.x, down: e[4] > 0 });
      else if (L.kind === 'rock') moves.push({ type: 'rock', from: e[4] > 0 ? L.door : L.door2, to: e[4] > 0 ? L.door2 : L.door, w: b.w, x: b.x });
    });
    moves.cost = dist[1];
    return moves;
  }

  /* ── stances: where to stand to work a point P ────────────────────── */
  // shoulder height over the feet, per knocker (the rig's, rounded)
  var SHOULDER = { tall: 19, lamp: 16, pick: 16, old: 13, little: 13, tally: 17 };
  var ARM = { tall: 14, lamp: 13, pick: 13, old: 13, little: 12, tally: 13 };
  function stances(nav, P, who, opts) {
    opts = opts || {};
    var out = [], sh = SHOULDER[who] || 16, arm = ARM[who] || 13;
    nav.list.forEach(function (w) {
      if (w.kind === 'sill' && !opts.sills) return;
      for (var side = -1; side <= 1; side += 2) {
        // standing beside it: the shoulder about an arm's length off
        for (var dx = 6; dx <= 13; dx += 1) {
          var x = P.x - side * dx;
          if (x < w.x0 || x > w.x1) continue;
          var y = walkY(w, x), sy = y - sh, d = Math.hypot(P.x - x, P.y - sy);
          if (P.y > y - 3) continue;                          // at or below his boots: not standing
          if (d <= arm + 1 && P.y > y - sh - arm + 2) { out.push({ kind: 'stand', w: w.id, x: x, y: y, face: side, cost: Math.abs(d - arm * 0.8) * 0.02 }); break; }
        }
        // a rope ladder from this walk, down beside it; or a ladder stood on
        // it, up beside it (the nearest place along the walk that will do)
        for (var off = 6; off <= 11; off++) {
          var rx = P.x - side * off;
          if (rx < w.x0 || rx > w.x1) continue;
          var ry = walkY(w, rx), feet = P.y + sh - 2;
          if (feet > ry + 8 && feet - ry <= (opts.maxRope || 150)) out.push({ kind: 'rope', w: w.id, x: rx, y: ry, face: side, feet: ry + Math.round((feet - ry) / RUNG) * RUNG, cost: 1.4 + (feet - ry) / 45 + (off - 6) * 0.02 });
          else if (feet < ry - 6 && ry - feet <= (opts.maxStep || 70)) out.push({ kind: 'step', w: w.id, x: rx, y: ry, face: side, feet: ry - Math.round((ry - feet) / RUNG) * RUNG, cost: 1.2 + (ry - feet) / 45 + (off - 6) * 0.02 });
          else continue;
          break;
        }
      }
    });
    return out;
  }

  var core = { FPS: FPS, CREW: CREW, POSES: P, LADDERS: LADDERS, DOORS: DOORS, buildNav: buildNav, route: route, stances: stances, walkY: walkY, speeds: speeds };

  /* ══ THE PART ══════════════════════════════════════════════════════════ */
  function attach(api) {
    var search = (root.location && root.location.search) || '';
    var HARNESS = /[?&]harness=1/.test(search);
    var FORCE = {};
    if (HARNESS) { var fm = /[?&]force=([^&]*)/.exec(search); if (fm) decodeURIComponent(fm[1]).split(',').forEach(function (k) { FORCE[k.split(':')[0]] = true; }); }
    var ART = root.PachinkoArt, R = root.PachinkoRender, PP = root.PachinkoPhysics;

    var S = {
      nav: null, boardRef: null, tick: Math.floor(api.now() * FPS), mode: 'attract', seed: 1913, games: 0,
      lifted: {}, props: [], ropes: {}, doorState: {}, glows: [], dust: [], marks: 0, work: null,
      freeze: null, lode: null, lookUp: null, cardLamp: null, moth: null, thefts: [], nightShift: null, forced: {}
    };
    function nav() {
      var b = api.board();
      if (S.boardRef !== b) {
        // a new layout (a drift edit landed): the walks stay put, the doors follow
        S.nav = buildNav(b); S.boardRef = b;
      }
      return S.nav;
    }
    nav();

    /* ── the knockers ──────────────────────────────────────────────── */
    var K = CREW.map(function (c, i) {
      var k = { i: i, c: c, who: c.who, name: c.name, own: c.tool, tool: c.tool, tool2: null, facing: i % 2 ? -1 : 1,
        pose: P.stand, over: null, x: 0, y: 0, dy: 0, back: false, liftL: 0, liftR: 0, rot: 0, capOff: false,
        lamp: true, lampK: 1, hidden: false, at: null, gen: null, wait: 0, busy: null, hold: null, carry: null,
        tallyN: c.who === 'tally' ? 0 : null, sit: false, look: null, react: {}, lastStep: 0, noPlant: false };
      return k;
    });
    function post(k) {
      var n = nav(), w = n.walkAt(k.c.post.floor, k.c.post.x);
      return { w: w.id, x: clamp(k.c.post.x, w.x0, w.x1) };
    }
    function place(k, p) {
      var n = nav(), w = n.walks[p.w];
      k.at = { w: p.w, x: p.x }; k.x = p.x; k.y = walkY(w, p.x); k.dy = 0; k.back = false; k.hidden = false; k.rot = 0;
    }
    function snapHome(k) {
      clearKnocker(k);
      place(k, post(k));
      k.facing = k.c.post.x > 160 ? -1 : 1;
      if (k.who === 'tall') k.facing = 1;
      k.pose = P.stand; k.tool = k.own; k.tool2 = null; k.gen = null; k.wait = 0; k.busy = null;
    }
    function clearKnocker(k) {
      if (k.carry && k.carry.lifted) delete S.lifted[k.carry.lifted];
      k.carry = null; k.hold = null; k.capOff = false; k.sit = false; k.lampK = 1; k.lamp = true; k.over = null; k.liftL = k.liftR = 0;
      delete S.ropes[k.i];
    }
    K.forEach(snapHome);

    function emit(k, what, extra) {
      var e = { type: 'figure', what: what, x: Math.round(k.x), y: Math.round(k.y), who: k.who };
      if (extra) for (var q in extra) e[q] = extra[q];
      api.emit(e);
    }
    function now() { return api.now(); }
    function hurry() { return S.mode === 'work'; }
    function seedN(a, b) { return h3(S.seed + S.games * 131, a, b); }

    /* ── moves (generators: `yield n` holds the pose n frames) ─────── */
    function* walkTo(k, w, x) {
      var n = nav(), W = n.walks[w];
      if (!k.at || k.at.w !== w) { place(k, { w: w, x: clamp(x, W.x0, W.x1) }); return; }
      x = clamp(x, W.x0, W.x1);
      var ph = 0;
      while (Math.abs(k.x - x) > 0.5) {
        var dir = sgn(x - k.x), st = Math.min(stepOf(k.c, hurry()), Math.abs(x - k.x));
        k.facing = dir; k.back = false;
        k.x += dir * st; k.at.x = k.x; k.y = walkY(W, k.x);
        ph = (ph + 1) % 4;
        k.pose = gaitPose(k, ph);
        if (ph === 0 || ph === 2) emit(k, 'step');
        yield k.c.every;
        // the tallyman stops every so often to check his card
        if (k.who === 'tally' && hash01(Math.round(k.x), S.tick) < 0.06) { k.pose = P.read; yield 4; }
        if (k.who === 'old' && hash01(Math.round(k.x) * 3, S.tick) < 0.05) { k.pose = P.caneRest; yield 6; }
      }
      k.x = x; k.at.x = x; k.y = walkY(W, x);
      k.pose = restPose(k);
    }
    function gaitPose(k, ph) {
      var w = [P.walk1, P.walk2, P.walk3, P.walk4][ph];
      if (k.who === 'old') return ph % 2 ? P.caneWalk2 : P.caneWalk1;
      var q = copy(w);
      if (k.who === 'lamp') { q.armR = 45; q.lean = 10; q.head = 5; }                  // careful with the light
      if (k.who === 'pick' && k.tool === 'pick') { q.armR = 165; q.toolA = 45; q.lean = 10; } // the pick up, eager
      if (k.who === 'little' && k.tool === 'shovel') { q.armR = 165; q.toolA = 45; }      // the shovel over his shoulder, twice his size
      if (k.who === 'tall' && !k.tool && !k.carry) { q.armL = -30; q.armR = -30; }       // hands behind his back, even walking
      if (k.who === 'tally' && k.tool === 'tally') { q.armR = 60; q.head = 20; }          // reading as he goes
      if (k.carry) { q.armR = 90; q.armL = 75; }
      if (k.hold) { q = copy(ph % 2 ? P.run1 : P.run2); }
      if (k.tool === 'coil' || k.tool === 'ladder' || k.tool === 'plank') { q.armR = 150; q.toolA = 90; }
      return q;
    }
    var REST = { tall: 'restTall', pick: 'restPick', lamp: 'restLamp', old: 'restOld', little: 'restLittle', tally: 'restTally' };
    function restPose(k) {
      if (k.tool !== k.own && k.who !== 'tall') return P.stand;
      return P[REST[k.who]] || P.stand;
    }
    function* hopTo(k, w, x) {
      var n = nav(), W = n.walks[w], x0 = k.x, dir = sgn(x - x0);
      k.facing = dir;
      k.pose = P.crouch; yield 1 * k.c.every;
      k.pose = P.air; k.x = x0 + (x - x0) * 0.35; k.dy = -6; emit(k, 'hop'); yield 1;
      k.x = x0 + (x - x0) * 0.7; k.dy = -7; yield 1;
      k.at = { w: w, x: x }; k.x = x; k.y = walkY(W, x); k.dy = 0; k.pose = P.land; emit(k, 'land'); yield 1 * k.c.every;
      k.pose = restPose(k);
    }
    // up or down a ladder (a fixed one, or one of their own): from behind, a rung a move
    function* climb(k, lad, yTo, down) {
      k.back = true; k.x = lad.x; k.at = { ladder: lad.id, y: k.y };
      var n = 0;
      while (Math.abs(k.y - yTo) > 0.5) {
        var st = Math.min(RUNG * (hurry() ? 2 : 1), Math.abs(yTo - k.y));
        k.y += st * sgn(yTo - k.y); k.at.y = k.y;
        n++;
        k.pose = n % 2 ? P.climbA : P.climbB; k.liftL = n % 2 ? 3 : 0; k.liftR = n % 2 ? 0 : 3;
        if (n % 2) emit(k, 'climb');
        yield k.c.every;
      }
      k.y = yTo; k.liftL = k.liftR = 0; k.pose = P.hang;
    }
    function* ladderMove(k, m) {
      var n = nav(), lad = n.ladders[m.ladder], W = n.walks[m.w];
      // step onto it (at its top or its foot), climb, step off
      var yFrom = m.down ? lad.y0 : lad.y1, yTo = m.down ? lad.y1 : lad.y0;
      k.x = lad.x; k.y = yFrom; k.back = true; k.pose = P.hang; yield 1;
      yield* climb(k, lad, yTo, m.down);
      k.back = false; k.at = { w: m.w, x: clamp(m.x, W.x0, W.x1) }; k.x = k.at.x; k.y = walkY(W, k.x);
      k.pose = restPose(k); yield 1;
    }
    // into a door, through the rock (a glow moving behind it), out of another
    function* rockMove(k, from, to) {
      var n = nav(), d1 = n.doors[from], d2 = n.doors[to];
      yield* enterDoor(k, d1);
      var dist = Math.abs(d1.x - d2.x) + Math.abs(d1.y - d2.y), frames = Math.max(4, Math.round(dist / (hurry() ? 150 : 80) * FPS));
      for (var f = 0; f < frames; f++) {
        var u = (f + 1) / frames;
        k.glow = { x: d1.x + (d2.x - d1.x) * u, y: d1.y - 8 + (d2.y - d1.y) * u + Math.sin(u * Math.PI) * 6 };
        yield 1;
      }
      k.glow = null;
      yield* leaveDoor(k, d2);
    }
    function doorOpen(d, v) { S.doorState[d.id] = { open: v, t: now() }; }
    function* enterDoor(k, d) {
      if (Math.abs(k.x - d.x) > 0.5 && k.at && k.at.w === d.w) yield* walkTo(k, d.w, d.x);
      k.facing = d.mx != null ? sgn(d.mx - k.x) || -1 : k.facing;
      if (!d.mouth) { doorOpen(d, 1); emit(k, 'door', { how: 'open' }); yield 1; doorOpen(d, 2); }
      k.pose = P.duck; yield 1;
      k.hidden = true; k.inDoor = d.id; yield 1;
      if (!d.mouth) { doorOpen(d, 1); yield 1; doorOpen(d, 0); emit(k, 'door', { how: 'close' }); }
    }
    function* leaveDoor(k, d) {
      if (!d.mouth) { doorOpen(d, 1); emit(k, 'door', { how: 'open' }); yield 1; doorOpen(d, 2); yield 1; }
      k.at = { w: d.w, x: d.x }; k.x = d.x; k.y = d.y; k.back = false;
      k.hidden = false; k.inDoor = null; k.pose = P.duck; yield 1;
      k.pose = P.crouch; yield 1;
      k.pose = restPose(k);
      if (!d.mouth) { yield 1; doorOpen(d, 1); yield 1; doorOpen(d, 0); emit(k, 'door', { how: 'close' }); }
    }
    // get back onto a walk from wherever he is (a ladder of his own, the rock)
    function* getOff(k) {
      var n = nav();
      if (k.hidden && k.inDoor) { yield* leaveDoor(k, n.doors[k.inDoor]); return; }
      if (k.at && k.at.rope != null) {
        var rp = S.ropes[k.i];
        if (rp) {
          var lad = { id: 'rope' + k.i, x: rp.x };
          var yTo = rp.kind === 'rope' ? rp.y0 : rp.y1;
          yield* climb(k, lad, yTo, false);
          yield* stowRope(k, rp);
        }
        return;
      }
      if (k.at && k.at.ladder) {
        var L = n.ladders[k.at.ladder];
        if (L) {
          var up = Math.abs(k.y - L.y0) < Math.abs(k.y - L.y1);
          var lk = n.links.filter(function (q) { return q.kind === 'ladder' && q.ladder === L.id; })[0];
          yield* climb(k, L, up ? L.y0 : L.y1, !up);
          var dest = up ? lk.a : lk.b;
          k.back = false; k.at = { w: dest.w, x: dest.x }; k.x = dest.x; k.y = walkY(n.walks[dest.w], dest.x);
        }
      }
    }
    function* goTo(k, w, x) {
      if (k.hidden && k.inDoor) {
        // already in the rock: along it to the door that serves best, and out
        var n1 = nav(), bestD = null, bc = Infinity;
        for (var id in n1.doors) {
          var d = n1.doors[id], r0 = route(n1, { w: d.w, x: d.x }, { w: w, x: x }, k.c, { hurry: hurry(), noRock: true });
          var c0 = (r0 ? r0.cost : 99) + (Math.abs(d.x - n1.doors[k.inDoor].x) + Math.abs(d.y - n1.doors[k.inDoor].y)) / 150;
          if (c0 < bc) { bc = c0; bestD = d; }
        }
        if (bestD && bestD.id !== k.inDoor) {
          var d0 = n1.doors[k.inDoor], fr = Math.max(3, Math.round((Math.abs(d0.x - bestD.x) + Math.abs(d0.y - bestD.y)) / 150 * FPS));
          for (var f = 0; f < fr; f++) { var u = (f + 1) / fr; k.glow = { x: d0.x + (bestD.x - d0.x) * u, y: d0.y - 9 + (bestD.y - d0.y) * u }; yield 1; }
          k.glow = null; k.inDoor = bestD.id;
        }
      }
      yield* getOff(k);
      if (!k.at || k.at.w == null) { place(k, { w: w, x: x }); return; }
      var moves = route(nav(), { w: k.at.w, x: k.x }, { w: w, x: x }, k.c, { hurry: hurry() });
      if (!moves) { yield* teleportVia(k, w, x); return; }
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i];
        if (m.type === 'walk') yield* walkTo(k, m.w, m.x);
        else if (m.type === 'hop') yield* hopTo(k, m.w, m.x);
        else if (m.type === 'ladder') yield* ladderMove(k, m);
        else if (m.type === 'rock') yield* rockMove(k, m.from, m.to);
      }
    }
    function* teleportVia(k, w, x) { place(k, { w: w, x: x }); yield 1; }

    /* ── their own ladders: a rope ladder hung from a lip, a ladder stood up ── */
    function* rigRope(k, st) {
      // st: {kind:'rope'|'step', w, x, y, feet}
      yield* goTo(k, st.w, st.x + (st.kind === 'rope' ? 0 : -sgn(st.face || 1) * 0));
      var saved = k.tool;
      k.tool = st.kind === 'rope' ? 'coil' : 'ladder';
      k.facing = st.face || k.facing;
      k.pose = P.bend; yield 2;
      if (st.kind === 'rope') {
        // the coil goes over the lip and unrolls, a few rungs a frame
        var rp = S.ropes[k.i] = { kind: 'rope', x: st.x, y0: st.y, y1: st.y + 2, full: st.feet + 6 };
        k.tool = saved; emit(k, 'rope', { how: 'down' });
        while (rp.y1 < rp.full) { rp.y1 = Math.min(rp.full, rp.y1 + (hurry() ? 24 : 12)); k.pose = rp.y1 < rp.full ? P.bend : P.stand; yield 1; }
        k.at = { rope: k.i, y: k.y };
        k.pose = P.hang; k.back = true; k.x = st.x; yield 1;
        yield* climb(k, { id: 'rope' + k.i, x: st.x }, st.feet, true);
      } else {
        var sp = S.ropes[k.i] = { kind: 'step', x: st.x, y0: st.feet - 20, y1: st.y };
        k.tool = saved; emit(k, 'lay');
        k.pose = P.stand; yield 1;
        k.at = { rope: k.i, y: k.y }; k.back = true; k.x = st.x; k.pose = P.hang; yield 1;
        yield* climb(k, { id: 'step' + k.i, x: st.x }, st.feet, false);
        sp.y0 = Math.min(sp.y0, st.feet - 12);
      }
    }
    function* stowRope(k, rp) {
      var n = nav();
      k.back = false;
      var w = null;
      n.list.forEach(function (q) { if (!w && rp.x >= q.x0 - 1 && rp.x <= q.x1 + 1 && Math.abs(walkY(q, rp.x) - (rp.kind === 'rope' ? rp.y0 : rp.y1)) < 3) w = q; });
      if (w) { k.at = { w: w.id, x: clamp(rp.x, w.x0, w.x1) }; k.x = k.at.x; k.y = walkY(w, k.x); }
      k.pose = P.bend; yield 1;
      if (rp.kind === 'rope') { emit(k, 'rope', { how: 'up' }); while (rp.y1 > rp.y0 + 3) { rp.y1 = Math.max(rp.y0 + 2, rp.y1 - 14); yield 1; } }
      delete S.ropes[k.i];
      k.pose = restPose(k); yield 1;
    }
    // go to a stance and be ready to work the point P from it
    function* toStance(k, st, P0) {
      if (st.kind === 'stand') {
        yield* goTo(k, st.w, st.x);
        k.facing = st.face; k.back = false;
      } else {
        yield* rigRope(k, st);
        // on the ladder, turned half round to the work: a side view, one hand on the rope
        k.facing = st.face; k.back = false; k.onLadder = true;
      }
    }
    function* leaveStance(k) {
      k.onLadder = false;
      var rp = S.ropes[k.i];
      if (rp) {
        k.back = true;
        yield* climb(k, { id: 'r' + k.i, x: rp.x }, rp.kind === 'rope' ? rp.y0 : rp.y1, false);
        yield* stowRope(k, rp);
      }
    }

    /* ── aiming an arm at a point ─────────────────────────────────── */
    function figOf(k, pose) {
      return { x: k.x, y: k.y + k.dy, facing: k.facing, who: k.who, pose: rad(pose), back: k.back };
    }
    // the right arm pointed at P (quantised to 15°); returns a pose
    function aim(k, base, P0, arm, off) {
      var q = copy(base), A2 = ART || root.PachinkoArt;
      if (!A2 || !A2.figureShoulders) return q;
      var sh = A2.figureShoulders(figOf(k, q)), S0 = arm === 'L' ? sh.l : sh.r;
      var dx = (P0.x - S0.x) * (k.facing < 0 ? -1 : 1), dy = P0.y - S0.y;
      var a = Math.atan2(dx, dy) / D - sh.lean / D * 0.25 + (off || 0);
      if (arm === 'L') q.armL = a; else q.armR = a;
      return q;
    }

    /* ══ WORK: the drift, done by hand ═════════════════════════════════ */
    function startWork(ctx) {
      var W = S.work = { ctx: ctx, t0: now(), jobs: [], applied: 0, done: false, cancelled: false, seen: 0, closing: null, lit: null };
      // everyone downs what they were doing
      K.forEach(function (k) {
        if (k.busy === 'theft') return;
        clearKnocker(k); k.gen = null; k.wait = 0; k.busy = null;
      });
      // the tallyman reads out the job from his card
      var pg = K[BY_WHO.tally];
      pg.gen = foreman(pg, W); pg.busy = 'work';
      return {
        step: function () { return W.done; },
        finish: function () { endWork(true); }
      };
    }
    function* foreman(k, W) {
      k.pose = P.read; yield 6;
      k.pose = P.point; k.facing = 1; yield 4;
      k.pose = P.read;
      while (!W.done && !W.cancelled) yield 2;
    }
    function stepWork() {
      var W = S.work; if (!W || W.done || W.cancelled) return;
      var ctx = W.ctx, acc = ctx.plan.accepted;
      while (W.seen < acc.length) {
        var i = W.seen++;
        W.jobs.push({ i: i, edit: acc[i].edit, board: acc[i].board, state: 'queued', who: null });
      }
      // hand out the queued jobs, in order, to whoever is free and nearest
      W.jobs.forEach(function (j) {
        if (j.state !== 'queued') return;
        var best = null, bc = Infinity;
        K.forEach(function (k) {
          if (k.busy || k.who === 'tally') return;
          var c = jobCost(k, j);
          if (c < bc) { bc = c; best = k; }
        });
        if (best) { j.state = 'going'; j.who = best.who; best.busy = 'work'; best.gen = jobScript(best, j, W); }
      });
      // the lantern man goes and holds the light for the first job under way
      var lamp = K[BY_WHO.lamp];
      if (!lamp.busy && !W.lit) {
        var lj = W.jobs.filter(function (j) { return j.state === 'going' && j.who !== 'lamp'; })[0];
        if (lj) { W.lit = lj; lamp.busy = 'work'; lamp.gen = holdLight(lamp, lj, W); }
      }
      var allSet = ctx.plan.done && W.applied >= acc.length && W.jobs.every(function (j) { return j.state === 'set' || j.state === 'done'; });
      if (allSet && W.closing == null) W.closing = now();
      if (W.closing != null && now() - W.closing > 1.4 && now() - W.t0 > 5.5) {
        W.done = true;
        endWork(false);
      }
    }
    function target(j) {
      var e = j.edit, b = api.board(), f = b.byId[e.id] || j.board.byId[e.id];
      if (!f) return null;
      if (f.kind === 'pin') return { x: f.x, y: f.y };
      if (f.kind === 'rail') { var e1 = e.end === 1; return { x: e1 ? f.x1 : f.x2, y: e1 ? f.y1 : f.y2 }; }
      if (f.kind === 'tunnel') return { x: f.a.x, y: f.a.y };
      if (f.kind === 'pocket') return { x: f.x - sgn(e.dx) * 10, y: f.y + 5 };
      return null;
    }
    function jobCost(k, j) {
      var T = target(j); if (!T) return Infinity;
      var st = bestStance(k, T, j);
      if (!st) return Infinity;
      return (st.cost + st.travel) * k.c.job;
    }
    function bestStance(k, T, j) {
      var n = nav(), sts = stances(n, T, k.who, { sills: true }), best = null;
      var from = k.at && k.at.w ? { w: k.at.w, x: k.x } : post(k);
      sts.forEach(function (st) {
        var r = route(n, from, { w: st.w, x: st.x }, k.c, { hurry: true });
        if (!r) return;
        var c = st.cost + r.cost;
        if (!best || c < best.cost + best.travel) { best = st; best.travel = r.cost; }
      });
      return best;
    }
    function* holdLight(k, j, W) {
      var T = target(j); if (!T) { k.busy = null; return; }
      var n = nav(), sts = stances(n, { x: T.x + 16 * (T.x > 160 ? 1 : -1), y: T.y - 6 }, k.who, {}).filter(function (s) { return s.kind === 'stand'; });
      var from = { w: k.at && k.at.w || post(k).w, x: k.x }, best = null;
      sts.forEach(function (s) { var r = route(n, from, { w: s.w, x: s.x }, k.c); if (r && (!best || r.cost < best.r)) { best = s; best.r = r.cost; } });
      if (best && best.r < 6) {
        yield* goTo(k, best.w, best.x);
        k.facing = sgn(T.x - k.x);
        while (j.state !== 'done' && !W.cancelled) { k.pose = P.lanternUp; yield 3; k.pose = P.lanternOut; yield 2; }
        k.pose = P.lanternLow; yield 2;
      }
      k.busy = null;
    }
    function* jobScript(k, j, W) {
      var e = j.edit, T = target(j), n = nav();
      if (!T) { j.state = 'done'; k.busy = null; return; }
      var st = bestStance(k, T, j);
      if (!st) { yield* waitTurn(k, j, W); apply(j, W); j.state = 'done'; k.busy = null; return; }
      yield* toStance(k, st, T);
      var f = api.board().byId[e.id];
      if (e.type === 'nudge' || e.type === 'dress') yield* pinWork(k, j, W, f, T, st);
      else if (e.type === 'rail') yield* railWork(k, j, W, f, T);
      else if (e.type === 'mouth') yield* mouthWork(k, j, W, f, T);
      else if (e.type === 'pocket') yield* pailWork(k, j, W, f, T);
      else { yield* waitTurn(k, j, W); apply(j, W); }
      j.state = 'done';
      markTally();
      k.pose = P.admire; yield 3;
      yield* leaveStance(k);
      k.tool = k.own; k.tool2 = null;
      k.busy = null;
    }
    // the TOCK: this job's edit lands on the board as it stands (the edits
    // commute, so the last TOCK leaves exactly the layout the planner
    // validated, in whatever order the crew finish)
    function apply(j, W) {
      if (W.cancelled || j.state === 'set') return;
      api.setBoard(PB.applyEdit(api.board(), j.edit));
      api.emit({ type: 'edit', edit: j.edit, i: j.i, who: j.who });
      W.applied++;
      j.state = 'set';
    }
    function* waitTurn(k, j, W) { if (false) yield 1; }
    function toolFor(k) { return k.who === 'pick' ? 'pick' : k.who === 'little' ? 'shovel' : 'mallet'; }
    // pull a pin, carry it, tap it into its new place: tick, tick, TOCK
    function* pinWork(k, j, W, f, T, st) {
      var e = j.edit, nb = PB.applyEdit(api.board(), e).byId[e.id], NP = { x: nb.x, y: nb.y };
      var spr = R && R.pinSprite ? R.pinSprite(e.id) : null;
      var ladder = st.kind !== 'stand';
      // the tool out of the apron (on a ladder he came down with it ready)
      if (!ladder) { k.pose = P.rummage; yield 1; }
      k.tool = toolFor(k);
      // hands on it
      var reach = aim(k, P.reach, T, 'R'); reach = aim(k, reach, T, 'L');
      k.pose = reach; k.tool = null; yield 2;
      // three tugs; it wobbles on the second
      for (var t2 = 0; t2 < 2; t2++) {
        var back = copy(reach); back.lean -= 20; back.head -= 10;
        k.pose = back; yield 1;
        if (t2 === 0) { S.lifted[e.id] = 1; k.carry = { spr: spr, dress: f.dress, lifted: e.id, at: { x: T.x + k.facing, y: T.y } }; }
        k.pose = reach; yield 1;
      }
      // POP: out it comes, he staggers back a step with it
      emit(k, 'pull');
      S.lifted[e.id] = 1;
      S.dust.push({ kind: 'dust', x: T.x, y: T.y, n: 4, t0: now(), dx: -k.facing });
      k.carry = { spr: spr, dress: f.dress, lifted: e.id, inHand: true };
      k.pose = ladder ? P.inspect : P.pop; yield 2;
      k.pose = P.inspect; yield 2;
      if (e.type === 'dress') {
        // the old one goes over his shoulder; a new one out of the apron
        k.pose = P.toss1; yield 1;
        k.pose = P.toss2; emit(k, 'toss');
        S.dust.push({ kind: 'flying', x: k.x, y: k.y - 18, vx: -k.facing * 40, vy: -70, t0: now(), spr: spr, dress: f.dress });
        k.carry = { spr: null, dress: e.dress, lifted: e.id, inHand: true };
        yield 2;
        k.pose = P.rummage; yield 2;
        var ns = R && R.pinSpriteByDress ? R.pinSpriteByDress(e.dress) : null;
        k.carry = { spr: ns, dress: e.dress, lifted: e.id, inHand: true };
        k.pose = P.inspect; yield 2;
      }
      // to the new place (a nudge is a step at most) and hold it to the rock
      if (!ladder && Math.abs(NP.x - T.x) >= 2) {
        var nx = clamp(k.x + (NP.x - T.x), n0(k).x0, n0(k).x1);
        k.x = nx; k.at.x = nx; k.y = walkY(nav().walks[k.at.w], nx); k.pose = gaitPose(k, 0); emit(k, 'step'); yield 1;
      }
      var hold = aim(k, P.holdPin, NP, 'L');
      k.carry = { spr: k.carry.spr, dress: k.carry.dress, lifted: e.id, at: { x: NP.x, y: NP.y } };
      k.tool = toolFor(k);
      k.pose = hold; yield 2;
      // tick, tick
      var up = copy(hold); up.armR = 165; up.lean -= 5;
      var hit = aim(k, hold, { x: NP.x - k.facing * 2, y: NP.y + 2 }, 'R', -30);
      for (var tp = 0; tp < 2; tp++) { k.pose = up; yield 1; k.pose = hit; emit(k, 'tap'); S.dust.push({ kind: 'dust', x: NP.x, y: NP.y, n: 2, t0: now() }); yield 1; }
      // …wait your turn (the TOCKs go in order)…
      yield* waitTurn(k, j, W);
      if (W.cancelled) return;
      // TOCK
      var big = copy(hold); big.armR = 195; big.lean -= 15; big.head -= 10;
      k.pose = big; yield 3;
      k.pose = hit;
      apply(j, W); j.state = 'set';
      emit(k, 'set');
      delete S.lifted[e.id];
      k.carry = null;
      S.dust.push({ kind: 'dust', x: NP.x, y: NP.y, n: 5, t0: now() });
      S.dust.push({ kind: 'glint', x: NP.x - 1, y: NP.y - 1, t0: now(), big: true });
      yield 2;
      // and a flick of the finger to hear it ring
      if (k.who === 'pick' || hash01(e.id.length * 7, S.tick) < 0.4) { var fl = aim(k, P.flick, NP, 'R'); k.tool = null; k.pose = fl; emit(k, 'flick'); yield 2; }
      k.tool = k.own;
    }
    function n0(k) { return nav().walks[k.at.w]; }
    // the headframe's back-leg brace: a timber knocked along, or a length added
    function* railWork(k, j, W, f, T) {
      var e = j.edit;
      k.facing = sgn(T.x - k.x) || 1;
      if (e.d > 0) { k.tool = 'plank'; k.pose = P.carry; yield 3; k.pose = aim(k, P.holdPin, T, 'L'); yield 2; emit(k, 'lay'); }
      k.tool = 'mallet';
      var hold = aim(k, P.holdPin, T, 'L'), hit = aim(k, hold, T, 'R', -30), up = copy(hold); up.armR = 165;
      for (var i = 0; i < 2; i++) { k.pose = up; yield 1; k.pose = hit; emit(k, 'tap'); yield 1; }
      yield* waitTurn(k, j, W);
      if (W.cancelled) return;
      var big = copy(hold); big.armR = 195; big.lean -= 15;
      k.pose = big; yield 3; k.pose = hit; apply(j, W); emit(k, 'set'); S.dust.push({ kind: 'dust', x: T.x, y: T.y, n: 5, t0: now() }); yield 2;
      k.tool = k.own;
    }
    // a tunnel mouth boarded up, or the boards prised off
    function* mouthWork(k, j, W, f, T) {
      var e = j.edit;
      k.facing = sgn(T.x - k.x) || 1;
      if (!e.open) {
        k.tool = 'plank'; k.pose = P.carry; yield 2;
        k.pose = aim(k, P.bend, T, 'R'); yield 2; emit(k, 'lay');
        k.tool = 'mallet';
        var up = copy(P.bend); up.armR = 150; var hit = aim(k, P.bend, T, 'R', -30);
        for (var i = 0; i < 2; i++) { k.pose = up; yield 1; k.pose = hit; emit(k, 'tap'); yield 1; }
        yield* waitTurn(k, j, W); if (W.cancelled) return;
        k.pose = up; yield 3; k.pose = hit; apply(j, W); emit(k, 'set'); yield 2;
      } else {
        k.tool = toolFor(k);
        var pry = aim(k, P.bend, T, 'R');
        for (var t2 = 0; t2 < 3; t2++) { k.pose = pry; yield 1; var b2 = copy(pry); b2.lean -= 25; k.pose = b2; emit(k, 'pull'); yield 1; }
        yield* waitTurn(k, j, W); if (W.cancelled) return;
        k.pose = P.pop; apply(j, W); emit(k, 'toss');
        S.dust.push({ kind: 'flying', x: T.x, y: T.y - 4, vx: -k.facing * 30, vy: -50, t0: now(), plank: true });
        yield 3;
      }
      k.tool = k.own;
    }
    // the dinner pail shoved along its ledge
    function* pailWork(k, j, W, f, T) {
      k.facing = sgn(j.edit.dx) || 1;
      k.tool = null;
      k.pose = P.push; yield 2;
      for (var i = 0; i < 2; i++) { k.pose = P.shove; emit(k, 'push'); yield 1; k.pose = P.push; yield 2; }
      yield* waitTurn(k, j, W); if (W.cancelled) return;
      k.pose = P.shove; apply(j, W); emit(k, 'push'); emit(k, 'set'); yield 3;
      k.tool = k.own;
    }
    function markTally() {
      var pg = K[BY_WHO.tally];
      pg.tallyN = (pg.tallyN | 0) + 1;
      S.marks++;
      emit(pg, 'mark');
      pg.over = { pose: P.write, until: S.tick + 4, tool2: 'pencil' };
    }
    function endWork(hurried) {
      var W = S.work; if (!W) return;
      W.cancelled = hurried; W.done = true;
      S.work = null;
      S.lifted = {};
      if (hurried) K.forEach(function (k) { if (k.busy !== 'theft') snapHome(k); });
      // otherwise they finish up (off the ladders, tools away) in their own time
      else K.forEach(function (k) { if (k.busy === 'work') k.busy = 'packing'; });
    }

    /* ══ ATTRACT: pottering ═══════════════════════════════════════════ */
    function nextActivity(k) {
      var r = seedN(k.i * 17 + 3, Math.floor(S.tick / 7) + (k.acts = (k.acts | 0) + 1)), p = post(k);
      var far = !k.at || !k.at.w || (k.at.w !== p.w) || Math.abs(k.x - p.x) > 60;
      if (far) return homeward(k);
      switch (k.who) {
        case 'tall': return r < 0.22 ? moon(k) : r < 0.42 ? oilSheave(k) : r < 0.58 ? scaleMan(k) : r < 0.76 ? fence(k) : idle(k, 18 + ((r * 100) | 0) % 10);
        case 'pick': return r < 0.35 ? pickFace(k) : r < 0.55 ? pushCart(k) : r < 0.72 ? polishHook(k) : idle(k, 16);
        case 'lamp': return r < 0.3 ? readCard(k) : r < 0.55 ? mothWalk(k) : r < 0.75 ? ventDoor(k) : idle(k, 16);
        case 'old': return r < 0.35 ? lunch(k) : r < 0.6 ? doze(k) : r < 0.8 ? amble(k) : knockPillar(k);
        case 'little': return r < 0.3 ? dig(k) : r < 0.5 ? knockRib(k) : r < 0.7 ? sumpVisit(k) : r < 0.85 ? sweep(k) : hopHole(k);
        case 'tally': return r < 0.45 ? countFence(k) : r < 0.7 ? idle(k, 20) : surveyHouses(k);
      }
      return idle(k, 12);
    }
    function* homeward(k) { var p = post(k); yield* goTo(k, p.w, p.x); k.pose = restPose(k); yield 4; }
    function* idle(k, n) {
      for (var i = 0; i < n; i++) {
        var r = hash01(k.i * 31 + i, S.tick);
        k.pose = r < 0.15 ? P.shift : r < 0.22 ? P.look : restPose(k);
        if (r > 0.93) k.facing = -k.facing;
        yield 3;
      }
      if (hash01(k.i, S.tick) < 0.3) { k.pose = P.yawn; yield 4; }
    }
    // Absalom looks at the painted moon a while, and takes his cap off to it
    function* moon(k) {
      yield* goTo(k, 'surface', 196 + ((seedN(k.i, 5) * 30) | 0));
      k.facing = 1; k.pose = P.lookMoon; yield 14;
      k.capOff = true; k.tool2 = 'cap'; k.pose = P.capoff; emit(k, 'capoff'); yield 20;
      k.pose = P.lookMoon; yield 6;
      k.capOff = false; k.tool2 = null; k.pose = P.stand; yield 3;
    }
    function* oilSheave(k) {
      yield* goTo(k, 'surface', 70);
      k.facing = 1; k.tool = 'oilcan';
      k.pose = P.oil; yield 3;
      for (var i = 0; i < 3; i++) { var q = copy(P.oil); q.armR = 180; k.pose = q; emit(k, 'oil'); yield 1; k.pose = P.oil; yield 2; }
      S.dust.push({ kind: 'drip', x: 80, y: 50, t0: now() });
      k.pose = P.stand; yield 2; k.tool = k.own;
    }
    // …and crouches to look at the little man for scale, who is to scale
    function* scaleMan(k) {
      yield* goTo(k, 'surface', 67);
      k.facing = -1; k.pose = P.bend; yield 18;
      var q = copy(P.bend); q.head = 50; k.pose = q; yield 10;
      k.pose = P.stand; yield 3;
    }
    function* fence(k) {
      var xs = [44, 20];
      for (var i = 0; i < xs.length; i++) {
        yield* goTo(k, 'surface', xs[i] + 7);
        k.facing = -1; k.pose = P.knock1; yield 1; k.pose = P.knock2; emit(k, 'knock', { soft: true }); yield 1; k.pose = P.knock1; yield 1; k.pose = P.knock2; emit(k, 'knock', { soft: true }); yield 2;
        k.pose = P.listen; yield 5;
      }
    }
    function* pickFace(k) {
      yield* goTo(k, 'floorA.3', 184);
      k.facing = 1; k.tool = 'pick';
      var n = 3 + ((seedN(k.i, S.tick) * 3) | 0);
      for (var i = 0; i < n; i++) {
        k.pose = P.swingUp; yield 1; k.pose = P.swingTop; yield 2;
        k.pose = P.swingDn; emit(k, 'pick'); S.dust.push({ kind: 'dust', x: k.x + 12, y: k.y - 2, n: 3, t0: now(), coal: true }); yield 2;
      }
      k.pose = P.stand; yield 4;
    }
    // Ezra shoves the ore cart down to the chute and back, matching its pace
    function* pushCart(k) {
      var b = api.board(), cart = b.byId.cart;
      if (!cart) return;
      yield* goTo(k, 'floorA.1', 30);
      k.facing = 1;
      // wait for the cart to come back to the loading end
      var guard = 0;
      while (guard++ < 40) { var cp = PB.cartPose(cart, now()); if (cp.x < cart.x1 + 3 && PB.cartVel(cart, now()).vx >= 0) break; k.pose = P.shift; yield 1; }
      for (var i = 0; i < 16; i++) {
        var p2 = PB.cartPose(cart, now()), v = PB.cartVel(cart, now());
        if (v.vx < -1 || Math.abs(p2.tilt) > 0.2) break;
        var nx = clamp(p2.x - cart.w / 2 - 5, nav().walks['floorA.1'].x0, nav().walks['floorA.1'].x1);
        k.x = nx; k.at.x = nx; k.y = walkY(nav().walks['floorA.1'], nx);
        k.pose = i % 2 ? P.push : P.shove; if (i % 2) emit(k, 'step');
        yield 1;
      }
      k.pose = P.admire; yield 6;
    }
    function* polishHook(k) {
      var hx = 172;
      yield* goTo(k, 'floorA.3', hx - 8);
      k.facing = 1; k.tool2 = 'rag'; k.tool = null;
      for (var i = 0; i < 5; i++) { k.pose = P.rub1; yield 1; k.pose = P.rub2; yield 1; }
      S.dust.push({ kind: 'glint', x: hx, y: 142, t0: now(), big: true });
      k.pose = P.admire; yield 4;
      k.tool2 = null; k.tool = k.own;
    }
    // Tobias reads the legend card by his lantern, from behind: the paper
    // glows and his shadow is on it
    function* readCard(k) {
      var rx = 24;
      yield* goTo(k, 'floorB.0', rx);
      k.facing = -1; k.pose = P.bend; yield 3;
      var ry = walkY(nav().walks['floorB.0'], rx);
      var rp = S.ropes[k.i] = { kind: 'rope', x: rx, y0: ry, y1: ry + 2, full: ry + 64 };
      emit(k, 'rope', { how: 'down' });
      while (rp.y1 < rp.full) { rp.y1 = Math.min(rp.full, rp.y1 + 12); yield 1; }
      k.at = { rope: k.i, y: k.y }; k.back = true; k.x = rx; k.pose = P.hang; yield 1;
      yield* climb(k, { id: 'card', x: rx }, ry + 56, true);
      // turned sideways on the rope, the lantern up to the paper
      k.back = false; k.facing = -1; k.onLadder = true;
      // down the card a line at a time, the lantern held out to it; at the
      // scratched-out line he stops, holds the light closer, and tilts his head
      var lines = [10, 15, 20, 25, 25, 35, 40];
      for (var i = 0; i < lines.length; i++) {
        var q = { lean: -5, head: lines[i], armL: 165, armR: 90, legL: 0, legR: 0 };
        k.pose = q; S.cardLamp = k.i; yield i === 3 ? 10 : 5;
        if (i === 3) { var qq = copy(q); qq.armR = 75; qq.head = 5; qq.lean = 5; k.pose = qq; yield 8; }
      }
      var q2 = { lean: -10, head: -10, armL: 165, armR: 75, legL: 0, legR: 0 }; k.pose = q2; yield 6;
      S.cardLamp = null;
      k.onLadder = false; k.back = true;
      yield* climb(k, { id: 'card', x: rx }, ry, false);
      yield* stowRope(k, rp);
    }
    // the moth leaves its lamp for his lantern, and goes back when he does
    function* mothWalk(k) {
      var lampX = 150;
      yield* goTo(k, 'floorB.2', lampX + 6);
      k.facing = -1; k.pose = P.lanternUp; yield 4;
      S.moth = k.i;
      yield* walkTo(k, 'floorB.2', 180);
      k.pose = P.lanternUp; yield 10;
      yield* walkTo(k, 'floorB.2', 165);
      k.pose = P.lanternUp; yield 6;
      S.moth = null;
      k.pose = P.lanternLow; yield 4;
    }
    // he times the ventilation door's swing and walks through when it's open
    function* ventDoor(k) {
      var b = api.board(), vd = b.byId.ventdoor;
      yield* goTo(k, 'floorB.2', 162);
      k.facing = 1; k.pose = P.lanternOut;
      var g = 0;
      while (g++ < 30) { var a = vd ? PB.wheelAngle(vd, now()) : 0; if (Math.cos(a) < 0.2 || !vd) break; yield 1; }
      yield* walkTo(k, 'floorB.2', 190);
      k.pose = P.lanternOut; yield 8;
      k.facing = -1; yield 4;
    }
    function* lunch(k) {
      // on the lip of the chute, legs over the hole, lunch out
      var w = nav().walks['floorC.1'], x = w.x1;
      yield* goTo(k, 'floorC.1', x);
      k.facing = 1; k.sit = 'edge'; k.tool = null;
      S.pail = { x: x - 7, y: walkY(w, x - 7), owner: k.i };
      k.pose = P.sitEdge; yield 4;
      k.tool2 = 'bread';
      for (var i = 0; i < 6; i++) {
        k.pose = P.eat2; emit(k, 'eat'); yield 3; k.pose = P.eat1; yield 3;
        if (i === 3) S.dust.push({ kind: 'crumb', x: k.x + 3, y: k.y - 4, t0: now(), fall: true });
      }
      k.tool2 = null; k.pose = P.sitEdge; yield 8;
      S.pail = null; k.sit = false; k.tool = k.own; k.pose = P.caneRest; yield 3;
    }
    // …or dozes against a pillar, and his lamp burns down
    function* doze(k) {
      yield* goTo(k, 'floorC.2', 178);
      k.facing = 1; k.sit = 'floor';
      k.pose = P.sitEdge; yield 4;
      for (var i = 0; i < 10; i++) {
        k.pose = P.doze; k.lampK = Math.max(0.3, 1 - i * 0.08);
        if (i % 3 === 2) { emit(k, 'snore'); S.dust.push({ kind: 'zzz', x: k.x + 4, y: k.y - 26, t0: now() }); }
        yield 5;
      }
      // wakes with a start
      k.pose = P.flinch; k.lampK = 1; emit(k, 'wake'); yield 2;
      k.pose = P.sitEdge; yield 4;
      k.sit = false; k.pose = P.caneRest; yield 3;
    }
    function* amble(k) {
      var w = nav().walks['floorC.2'];
      yield* walkTo(k, 'floorC.2', k.x > 180 ? w.x0 + 4 : w.x1 - 4);
      k.pose = P.caneRest; yield 10;
    }
    function* knockPillar(k) { yield* knockAt(k, { x: 184, y: 306 }, false, 'floorC.2'); }
    function* knockRib(k) { yield* knockAt(k, { x: 65, y: 300 }, false, 'floorC.0'); }
    function* knockAt(k, T, alarm, wid) {
      var n = nav(), W = n.walks[wid];
      var side = T.x > k.x ? 1 : -1, x = clamp(T.x - side * 9, W.x0, W.x1);
      yield* goTo(k, wid, x);
      k.facing = sgn(T.x - k.x) || side;
      for (var r = 0; r < 2; r++) {
        for (var i = 0; i < 3; i++) { k.pose = P.knock1; yield 1; k.pose = P.knock2; emit(k, 'knock', { n: i + 1 }); yield 1; }
        k.pose = P.listen; emit(k, 'listen'); yield 8;
      }
      if (alarm) { k.pose = P.alarm; yield 3; yield* walkTo(k, wid, clamp(k.x - k.facing * 12, W.x0, W.x1)); k.facing = sgn(T.x - k.x) || 1; k.pose = P.alarm; yield 4; }
      else { k.pose = P.stand; yield 2; }
    }
    function* dig(k) {
      var w = nav().walks['floorC.0'];
      yield* goTo(k, 'floorC.0', w.x1 - 3);
      k.facing = 1; k.tool = 'shovel';
      for (var i = 0; i < 4; i++) {
        k.pose = P.dig1; emit(k, 'dig'); yield 2;
        k.pose = P.dig2; S.dust.push({ kind: 'dust', x: k.x + 10, y: k.y - 4, n: 4, t0: now(), dx: 1.5 }); yield 2;
      }
      k.pose = P.stand; yield 3;
    }
    function* sweep(k) {
      var w = nav().walks[k.at && k.at.w] || nav().walks['floorC.0'];
      k.tool = 'shovel';
      for (var i = 0; i < 6; i++) {
        k.pose = i % 2 ? P.sweep1 : P.sweep2; if (i % 2) { emit(k, 'sweep'); S.dust.push({ kind: 'dust', x: k.x + 8 * k.facing, y: k.y - 1, n: 2, t0: now() }); }
        k.x = clamp(k.x + k.facing, w.x0, w.x1); k.at.x = k.x; k.y = walkY(w, k.x);
        yield 2;
      }
    }
    // Pip hops back and forth over the sump raise, for no reason at all
    function* hopHole(k) {
      yield* goTo(k, 'floorC.0', nav().walks['floorC.0'].x1);
      for (var i = 0; i < 2; i++) {
        yield* hopTo(k, 'floorC.1', nav().walks['floorC.1'].x0);
        k.pose = P.stand; yield 3;
        yield* hopTo(k, 'floorC.0', nav().walks['floorC.0'].x1);
        k.pose = P.stand; yield 3;
      }
    }
    // Pip goes down to the dry sump to see the pump wheel (and up again)
    function* sumpVisit(k) {
      yield* goTo(k, 'sump', 64);
      k.facing = 1; k.pose = P.lookMoon; yield 8;
      k.pose = P.point; yield 6;
      yield* goTo(k, post(k).w, post(k).x);
    }
    function* countFence(k) {
      var xs = [268, 292, 244];
      for (var i = 0; i < xs.length; i++) {
        yield* goTo(k, 'surface', xs[i] - 8);
        k.facing = 1; k.pose = P.point; yield 3;
        k.tool2 = 'pencil'; k.pose = P.write; yield 3; k.tool2 = null;
      }
    }
    function* surveyHouses(k) {
      yield* goTo(k, 'surface', 250);
      k.facing = 1; k.pose = P.read; yield 10; k.pose = P.pointUp; yield 6;
    }

    /* ══ PLAY: at their posts, reacting ═══════════════════════════════ */
    function* playIdle(k) {
      for (var i = 0; i < 400; i++) {
        var r = hash01(k.i * 13 + i, S.tick);
        if (k.who === 'old' && r < 0.05) { k.sit = 'floor'; k.pose = P.sitEdge; yield 40; k.sit = false; }
        else if (k.who === 'tally' && r < 0.1) { k.pose = P.read; yield 12; }
        else if (k.who === 'lamp' && r < 0.08) { k.pose = P.lanternUp; yield 10; }
        else k.pose = r < 0.12 ? P.shift : restPose(k);
        yield 4;
      }
    }

    /* ── reactions: sensed every physics step, shown on the next frame ── */
    function sense(t) {
      var w = api.world(); if (!w) return;
      var ms = w.marbles;
      K.forEach(function (k) {
        if (k.hidden || k.back || k.busy === 'theft' || k.rot) return;
        var rc = k.react, hx = k.x, hy = k.y - 22, near = null, nd = 1e9;
        for (var i = 0; i < ms.length; i++) {
          var m = ms[i];
          if (m.done || m.phase === 'tunnel' || m.phase === 'pocket' || m.stolen) continue;
          var d = Math.hypot(m.x - hx, m.y - hy);
          if (d < nd) { nd = d; near = m; }
          // a marble about to pass his head: duck (0.12 s ahead)
          var px2 = m.x + m.vx * 0.12, py2 = m.y + m.vy * 0.12;
          if (Math.abs(px2 - hx) < 11 && Math.abs(py2 - hy) < 13 && !(rc.duck > t) && !(rc.hop > t - 0.2)) { rc.duck = t + 0.45; rc.flicker = t + 0.25; }
          // one coming along the floor at his boots, or dropping on them: hop
          var feetY = k.y - 4, dx = m.x - k.x;
          if (!k.sit && Math.abs(m.y - feetY) < 7 && Math.abs(dx) < 18 && dx * m.vx < 0 && Math.abs(m.vx) > 12 && !(rc.hop > t - 0.9)) rc.hop = t;
          if (!k.sit && m.vy > 60 && Math.abs(dx) < 7 && k.y - m.y > 0 && k.y - m.y < 34 && !(rc.hop > t - 0.9)) rc.hop = t;
        }
        k.look = near && nd < 95 ? { x: near.x, y: near.y } : null;
      });
    }

    /* ══ THEFT ═══════════════════════════════════════════════════════ */
    function predict(m, T) {
      var w = api.world(); if (!w || !PP) return [];
      var c = JSON.parse(JSON.stringify(m));
      var w2 = { board: w.board, seed: w.seed, T: w.T, t: w.t, acc: 0, nextId: w.nextId, marbles: [c], events: [], grid: w.grid, contactN: 0, cartLoad: JSON.parse(JSON.stringify(w.cartLoad || {})), _near: [] };
      var out = [], dt = 1 / 60;
      for (var s = 0; s < T / dt; s++) {
        PP.stepWorld(w2, dt);
        if (c.done || c.phase === 'tunnel' || c.phase === 'cart' || c.phase === 'pocket') break;
        out.push({ t: (s + 1) * dt, x: c.x, y: c.y });
      }
      return out;
    }
    function reachPoint(d, side) { return { x: d.x + side * 9, y: d.y - 12 }; }
    function canSteal(mid, opts) {
      opts = opts || {};
      var w = api.world(); if (!w) return null;
      var m = null; w.marbles.forEach(function (q) { if (q.id === mid) m = q; });
      if (!m || m.done || m.stolen || m.phase === 'tunnel' || m.phase === 'cart' || m.phase === 'pocket') return null;
      var lead = opts.lead == null ? 0.45 : opts.lead, path = predict(m, opts.horizon || 1.6), n = nav(), best = null;
      var ds = Object.keys(n.doors).map(function (id) { return n.doors[id]; }).filter(function (d) { return !opts.door || d.id === opts.door; });
      path.forEach(function (p) {
        if (p.t < lead || (best && p.t >= best.t)) return;
        ds.forEach(function (d) {
          for (var side = -1; side <= 1; side += 2) {
            var R0 = reachPoint(d, side);
            if (Math.hypot(p.x - R0.x, p.y - R0.y) < 11 && (!best || p.t < best.t)) best = { m: mid, door: d.id, side: side, t: p.t, x: p.x, y: p.y, at: now() + p.t };
          }
        });
      });
      return best;
    }
    function theft(opts) {
      opts = opts || {};
      var plan = opts.plan || canSteal(opts.m, opts);
      if (!plan) return { ok: false, reason: 'no door on its path' };
      var who = opts.who != null ? opts.who : S.nightShift != null ? K[S.nightShift].who : 'pick';
      var k = K[BY_WHO[who]];
      if (!k || k.busy === 'theft') return { ok: false, reason: 'busy' };
      var n = nav(), to = opts.to || pickExit(plan.door);
      var relay = opts.relay != null ? K[BY_WHO[opts.relay]] : null;
      clearKnocker(k);
      k.tool = null; k.tool2 = null;                     // empty-handed: this needs both hands
      k.busy = 'theft'; k.gen = thiefScript(k, plan, n.doors[to], opts, relay); k.wait = 0;
      S.thefts.push({ m: plan.m, who: k.who, plan: plan, to: to });
      return { ok: true, plan: plan, who: k.who, to: to };
    }
    function pickExit(from) {
      var n = nav(), ids = Object.keys(n.doors).filter(function (id) { return id !== from && !n.doors[id].mouth; });
      return ids[Math.floor(seedN(ids.length * 97, S.tick) * ids.length)];
    }
    function marbleById(id) { var w = api.world(), r = null; if (w) w.marbles.forEach(function (q) { if (q.id === id) r = q; }); return r; }
    function* thiefScript(k, plan, exit, opts, relay) {
      var n = nav(), d = n.doors[plan.door], m = marbleById(plan.m);
      // out of the rock, if he isn't already in it: he goes in by the nearest door first
      if (!k.hidden) {
        k.hidden = true; k.inDoor = d.id;
      }
      // the door opens ~0.45 s before the marble arrives
      var wakeAt = plan.at - 0.45;
      while (now() < wakeAt - 1 / FPS) yield 1;
      k.x = d.x; k.y = d.y;
      doorOpen(d, 1); emit(k, 'door', { how: 'open' }); yield 1;
      doorOpen(d, 2);
      k.at = { w: d.w, x: d.x }; k.x = clamp(d.x + plan.side * 2, n.walks[d.w].x0, n.walks[d.w].x1); k.y = walkY(n.walks[d.w], k.x);
      k.hidden = false; k.inDoor = null; k.facing = plan.side; k.back = false;
      k.pose = P.crouch; yield 1;
      k.pose = P.ready;
      // hands out, waiting: the catch is sensed every physics step (see stepThief)
      k.thief = { m: plan.m, until: plan.at + 0.35, state: 'wait' };
      while (k.thief.state === 'wait' && now() < k.thief.until) yield 1;
      if (k.thief.state !== 'got') {
        // missed it: a swipe at the air, a shrug, back in
        k.thief = null;
        var sw = copy(P.ready); sw.lean = 40; k.pose = sw; yield 2;
        k.pose = P.shrug; yield 4;
        yield* enterDoor(k, d); doorOpen(d, 0);
        k.busy = null; k.hidden = true; k.inDoor = d.id;
        return;
      }
      // got it: up to his lamp for a look, then off with it
      k.pose = P.grab; yield 1;
      k.pose = P.holdUp; yield 2;
      k.facing = -plan.side;
      k.pose = P.run1; yield 1;
      k.pose = P.duck; yield 1;
      k.hidden = true; k.inDoor = d.id; yield 1;
      doorOpen(d, 1); yield 1; doorOpen(d, 0);
      // through the rock, the marble's light with his
      var dist = Math.abs(d.x - exit.x) + Math.abs(d.y - exit.y), frames = Math.max(6, Math.round(dist / 110 * FPS));
      for (var f = 0; f < frames; f++) {
        var u = (f + 1) / frames;
        k.glow = { x: d.x + (exit.x - d.x) * u, y: d.y - 10 + (exit.y - d.y) * u + Math.sin(u * Math.PI) * 8, marble: true };
        yield 1;
      }
      k.glow = null;
      // (a relay: another knocker takes it out of the far door)
      var out = k;
      if (relay && relay !== k && relay.busy !== 'theft') {
        clearKnocker(relay); relay.busy = 'theft'; relay.hidden = true; relay.gen = null;
        relay.hold = k.hold; k.hold = null; out = relay;
      }
      out.x = exit.x; out.y = exit.y;
      doorOpen(exit, 1); emit(out, 'door', { how: 'open' }); yield 1; doorOpen(exit, 2);
      out.at = { w: exit.w, x: exit.x }; out.x = exit.x; out.y = exit.y; out.hidden = false; out.inDoor = null; out.back = false;
      out.facing = opts.face || (exit.x < 160 ? 1 : -1);
      out.pose = P.crouch; yield 1;
      out.pose = P.grab; yield 2;
      var mode = opts.mode || 'set', mm = marbleById(plan.m);
      if (mode === 'toss') { out.pose = P.toss1; yield 2; out.pose = P.toss2; }
      else if (mode === 'set') { out.pose = P.set; }
      else out.pose = P.grab;
      // let go
      if (mm) {
        var hands = handsOf(out), hx = hands.x, hy = hands.y, W = nav().walks[exit.w];
        if (mode === 'set') { hx = out.x + out.facing * 8; hy = walkY(W, clamp(hx, W.x0 - 6, W.x1 + 6)) - 6; }
        var v = opts.v || (mode === 'toss' ? { vx: out.facing * 110, vy: -90 } : mode === 'set' ? { vx: out.facing * 22, vy: 0 } : { vx: 0, vy: 10 });
        mm.phase = 'board'; mm.x = hx; mm.y = hy; mm.vx = v.vx; mm.vy = v.vy; mm.slowT = 0; mm.stolen = false;
        if (mm.heldAge != null) { mm.age = mm.heldAge; mm.heldAge = null; }
        emit(out, 'release', { m: plan.m, how: mode });
      }
      out.hold = null; k.hold = null;
      yield 3;
      k.tool = k.own; if (out !== k) out.tool = out.own;
      out.pose = P.admire; yield 3;
      // and back in
      yield* enterDoor(out, exit); doorOpen(exit, 0);
      out.busy = null; out.hidden = true; out.inDoor = exit.id;
      if (out !== k) { k.busy = null; }
    }
    function handsOf(k) { return handsOfFig({ x: k.x, y: k.y + (k.dy || 0), facing: k.facing, who: k.who, pose: rad(k.pose), back: k.back }); }
    function handsOfFig(fig) {
      var A2 = ART || root.PachinkoArt;
      if (!A2 || !A2.figureHands) return { x: fig.x + fig.facing * 9, y: fig.y - 14 };
      var h = A2.figureHands(fig);
      return { x: (h.l.x + h.r.x) / 2 + (fig.facing < 0 ? -2 : 2), y: (h.l.y + h.r.y) / 2 - 1 };
    }
    // the catch, sensed every physics step while he waits with his hands out
    function stepThief(t) {
      K.forEach(function (k) {
        var th = k.thief; if (!th || th.state !== 'wait') return;
        var m = marbleById(th.m);
        if (!m || m.done) { th.state = 'lost'; return; }
        var h = handsOf(k);
        if (Math.hypot(m.x - h.x, m.y - h.y) < 13) {
          th.state = 'got';
          m.phase = 'pocket'; m.stolen = true; m.vx = 0; m.vy = 0; m.heldAge = m.age;
          k.hold = { id: m.id, spin: m.spin };
          api.emit({ type: 'stolen', m: m.id, x: Math.round(m.x), y: Math.round(m.y), who: k.who });
          if (api.flags && api.flags.set) try { api.flags.set('pachinko.was-robbed'); } catch (e) { }
        }
      });
      // a held marble rides in his hands
      K.forEach(function (k) {
        if (!k.hold) return;
        var m = marbleById(k.hold.id); if (!m) return;
        if (!k.hidden) { var h = handsOf(k); m.x = h.x; m.y = h.y; }
        else if (k.glow) { m.x = k.glow.x; m.y = k.glow.y; }
        m.heldAge = m.heldAge == null ? m.age : m.heldAge; m.age = m.heldAge;
      });
    }

    /* ══ KNOCK AND LISTEN (the cave-in telegraph) ═══════════════════ */
    function knockListen(opts) {
      opts = opts || {};
      var T = { x: opts.x, y: opts.y }, n = nav(), best = null;
      // the stance: a walk within reach of the rock at (x, y), else a door near it
      K.forEach(function (k) {
        if (opts.who && k.who !== opts.who) return;
        if (k.busy === 'theft' || (k.busy && !opts.who)) return;
        var sts = stances(n, T, k.who, { sills: true }).filter(function (s) { return s.kind === 'stand'; });
        sts.forEach(function (st) {
          var from = k.at && k.at.w ? { w: k.at.w, x: k.x } : post(k);
          var r = k.hidden ? { cost: 0.8 } : route(n, from, { w: st.w, x: st.x }, k.c);
          if (r && (!best || r.cost < best.cost)) best = { k: k, st: st, cost: r.cost };
        });
      });
      if (!best) return { ok: false };
      var k = best.k;
      clearKnocker(k); k.busy = 'knock';
      k.gen = (function* () {
        if (k.hidden || best.cost > 2.2) {
          // too far to walk: out of the nearest door to it
          var dn = null, dd = 1e9;
          for (var id in n.doors) { var d = n.doors[id], q = Math.hypot(d.x - best.st.x, d.y - best.st.y); if (q < dd) { dd = q; dn = d; } }
          if (!k.hidden) { yield* enterDoor(k, nearestDoor(k)); }
          yield* leaveDoor(k, dn);
        }
        yield* goTo(k, best.st.w, best.st.x);
        k.facing = best.st.face;
        for (var r = 0; r < (opts.n || 2); r++) {
          for (var i = 0; i < 3; i++) { k.pose = P.knock1; yield 1; k.pose = P.knock2; emit(k, 'knock', { n: i + 1, tx: T.x, ty: T.y }); yield 1; }
          k.pose = P.listen; emit(k, 'listen'); yield 7;
        }
        if (opts.alarm) { k.pose = P.alarm; yield 4; }
        k.pose = restPose(k); yield 2;
        k.busy = null;
      })();
      k.wait = 0;
      return { ok: true, who: k.who, tKnock: now() + best.cost };
    }
    function nearestDoor(k) {
      var n = nav(), best = null, bd = 1e9;
      for (var id in n.doors) { var d = n.doors[id]; if (k.at && k.at.w === d.w) { var q = Math.abs(d.x - k.x); if (q < bd) { bd = q; best = d; } } }
      if (!best) for (id in n.doors) { d = n.doors[id]; q = Math.hypot(d.x - k.x, d.y - k.y); if (q < bd) { bd = q; best = d; } }
      return best;
    }

    /* ══ the frame: a shutter tick ═════════════════════════════════════ */
    function frame() {
      var t = now();
      if (S.work) stepWork();
      K.forEach(function (k) {
        if (S.freeze && S.freeze.until > t && !(k.busy === 'theft')) return;   // playing dead: nothing moves
        if (S.lode && t - S.lode.t0 < 1.0 && k.busy !== 'theft') return;        // the held breath
        if (k.wait > 0) { k.wait--; return; }
        if (!k.gen) k.gen = schedule(k);
        if (!k.gen) return;
        var r = k.gen.next();
        if (r.done) { k.gen = null; if (k.busy !== 'theft' && k.busy !== 'work') k.busy = null; }
        if (r.done && k.busy === 'packing') k.busy = null;
        else k.wait = Math.max(0, (r.value | 0) - 1);
      });
      // things that fall and fade
      S.dust = S.dust.filter(function (q) { return t - q.t0 < (q.kind === 'zzz' ? 1.4 : q.kind === 'flying' ? 1.2 : 0.6); });
    }
    function schedule(k) {
      if (k.busy === 'theft') return null;
      if (S.mode === 'play' || S.mode === 'dive' || S.mode === 'payout') {
        if (S.nightShift === k.i) return null;
        return playIdle(k);
      }
      if (S.mode === 'work') {
        if (k.busy) return null;
        // not on a job: back towards his post, then stand by (one in the rock stays there, ready)
        if (k.hidden) return (function* () { yield 4; })();
        var p = post(k);
        if (!k.at || k.at.w !== p.w || Math.abs(k.x - p.x) > 3 || k.hidden) return (function* () { yield* goTo(k, p.w, p.x); k.pose = restPose(k); yield 4; })();
        return (function* () { k.pose = hash01(k.i, S.tick) < 0.3 ? P.shift : restPose(k); yield 6; })();
      }
      return nextActivity(k);
    }

    /* ── events from the game ─────────────────────────────────────── */
    var unsub = api.on(function (e) {
      var t = e.t != null ? e.t : now();
      switch (e.type) {
        case 'mode':
          S.mode = e.mode;
          if (e.mode === 'attract') {
            if (S.work) endWork(false);
            S.lode = null;
            // the night shift comes back out
            if (S.nightShift != null) { var ns = K[S.nightShift]; S.nightShift = null; if (ns.busy !== 'theft') { ns.gen = null; ns.busy = null; } }
          }
          if (e.mode === 'play' && FORCE.theft && !S.forced.theft) { S.forced.theft = true; S.forced.theftAt = now() + 0.3; }
          if (e.mode === 'play' && FORCE.knock && !S.forced.knock) { S.forced.knock = true; S.forced.knockAt = now() + 0.5; }
          if (e.mode === 'play' && FORCE.playdead && !S.forced.dead) { S.forced.dead = true; S.freeze = { t0: now(), until: now() + 2.4, topple: 3 }; }
          break;
        case 'dive':
          if (e.dir === 1) {
            // pushed in through the glass: they are at their posts (and one is on the night shift)
            K.forEach(function (k) { if (k.busy !== 'theft') snapHome(k); });
            S.lifted = {}; S.ropes = {}; S.pail = null; S.cardLamp = null; S.moth = null;
            S.nightShift = BY_WHO[seedN(3, S.games) < 0.5 ? 'pick' : 'little'];
            var nk = K[S.nightShift]; nk.hidden = true; nk.inDoor = nearestDoor(nk).id; nk.gen = null;
          }
          break;
        case 'release':
          S.lookUp = { t0: t, x: e.x };
          break;
        case 'clack':
          K.forEach(function (k) { if (!k.hidden && Math.hypot(k.x - e.x, k.y - 20 - e.y) < 60) k.react.flinch = t + 0.28; });
          break;
        case 'pin':
          if (e.speed > 220) K.forEach(function (k) { if (!k.hidden && Math.hypot(k.x - e.x, k.y - 18 - e.y) < 24) k.react.flinch = t + 0.2; });
          break;
        case 'lode':
          S.lode = { t0: t };
          break;
        case 'win':
          if (S.mode === 'play') { var pg = K[BY_WHO.tally]; if (!pg.hidden) pg.over = { pose: P.write, until: S.tick + 3, tool2: 'pencil' }; }
          break;
        case 'knock':
          // the anti-stall knock: it's one of them, in the rock, right there
          if (e.m != null && S.nightShift != null) { var nk2 = K[S.nightShift]; if (nk2.hidden && !nk2.glow) S.glows.push({ x: e.x + 5, y: e.y + 3, t0: t }); }
          break;
        case 'glasstap':
          if (!S.freeze || S.freeze.until < t) S.freeze = { t0: t, until: t + 1.6 + 0.3 * (e.n || 1), topple: e.n >= 3 ? 1 : 0 };
          else { S.freeze.until = Math.max(S.freeze.until, t + 1.4); if (e.n >= 3 && !S.freeze.topple) S.freeze.topple = 1; }
          break;
      }
    });

    /* ══ the part ═════════════════════════════════════════════════════ */
    var part = {
      step: function (t) {
        nav();
        if (S.work && S.work.ctx.plan && !S.work.done) { /* stepWork runs on frames */ }
        sense(t);
        stepThief(t);
        var tn = Math.floor(t * FPS);
        while (S.tick < tn) { S.tick++; frame(); }
        // forced harness demos
        if (S.forced.theftAt && t >= S.forced.theftAt && S.mode === 'play') forcedTheft(t);
        if (S.forced.knockAt && t >= S.forced.knockAt && S.mode === 'play') { S.forced.knockAt = null; knockListen({ x: 184, y: 306, alarm: true }); }
      },
      gameStart: function (seed) { S.seed = seed | 0; S.games++; },
      gameEnd: function () { },
      work: function (ctx) { return startWork(ctx); },
      figures: function (view) { return figures(view); },
      fx: function (view) { fx(view); },
      destroy: function () { if (unsub) unsub(); },
      // the mischief phase's hooks (wave 4)
      doors: function () { var n = nav(); return Object.keys(n.doors).map(function (id) { var d = n.doors[id]; return { id: id, x: d.x, y: d.y, kind: d.kind, w: d.w }; }); },
      canSteal: canSteal,
      theft: theft,
      knockListen: knockListen,
      nightShift: function () { return S.nightShift != null ? K[S.nightShift].who : null; },
      busy: function (who) { var k = K[BY_WHO[who]]; return k ? k.busy : null; },
      knockers: K, state: S, nav: nav, core: core
    };
    // a free marble for ?force=theft: dropped where it passes a door, stolen
    function forcedTheft(t) {
      var st = S.forced;
      if (!st.mid) {
        var w = api.world(), b = api.board();
        var xs = [14, 250, 120, 196, 40, 150, 230, 90];
        var x = xs[(st.tries = (st.tries | 0) + 1) % xs.length];
        var m = PP.addMarble(w, x);
        st.mid = m.id; st.dropT = t;
      }
      var plan = canSteal(st.mid, { lead: 0.5 });
      if (plan) {
        // the demo: out of a door on a gallery floor, set down gently
        var floorDoors = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].filter(function (id) { return id !== plan.door; });
        theft({ plan: plan, who: 'pick', mode: 'set', to: floorDoors[Math.floor(seedN(5, st.mid) * floorDoors.length)] });
        S.forced.theftAt = null; return;
      }
      var mm = marbleById(st.mid);
      if (!mm || mm.done || t - st.dropT > 5) { st.mid = null; if ((st.tries | 0) > 12) S.forced.theftAt = null; }
    }
    api.knockers = part;
    PachinkoKnockers.live = part;

    /* ══ drawing: the figures and their kit, this frame ═══════════════ */
    function rad(p) {
      var o = {};
      for (var q in p) o[q] = p[q] * D;
      return o;
    }
    var QN = { lean: 5, head: 5, armL: 15, armR: 15, legL: 15, legR: 15, toolA: 15 };
    function quant(p) {
      var o = {};
      for (var q in p) { var s = QN[q] || 15; o[q] = Math.round(p[q] / s) * s * D; }
      return o;
    }
    function shownPose(k, t) {
      var rc = k.react, base = k.pose || P.stand, q;
      if (k.over && k.over.until > S.tick) base = k.over.pose;
      var free = !k.back && !k.sit && !k.busy && !k.onLadder;
      // playing dead: stiff as the toys they are
      if (S.freeze && S.freeze.until > t && k.busy !== 'theft') return k.freezePose || base;
      if (S.lode && k.busy !== 'theft') {
        var lu = t - S.lode.t0;
        if (lu < 1.0) return k.freezePose || base;
        if (lu < 3.0 && !k.back) {
          if (k.who === 'old') return P.capoff;
          return (Math.floor(lu * FPS) + k.i) % 3 === 0 ? P.cheer2 : P.cheer;
        }
      }
      if (rc.hop != null && t - rc.hop < 0.5 && free) {
        var hu = Math.floor((t - rc.hop) * FPS);
        return [P.crouch, P.air, P.air, P.land][Math.min(3, hu)];
      }
      if (rc.duck > t && free) return k.who === 'lamp' ? P.duckLamp : P.duck;
      if (rc.flinch > t && free) return P.flinch;
      q = base;
      if ((S.mode === 'play' || S.mode === 'dive') && free) {
        // looking up at the hopper when a marble is let go
        if (S.lookUp && t - S.lookUp.t0 < 0.7) { q = copy(base); q.head = -45; q.lean = Math.min(q.lean || 0, -10); return q; }
        if (k.look) {
          q = copy(base);
          var dy = k.look.y - (k.y - 22), dx = Math.abs(k.look.x - k.x);
          q.head = clamp(Math.atan2(dy, Math.max(6, dx)) / D * 0.7, -45, 40);
          return q;
        }
      }
      return q;
    }
    function lookFacing(k, t) {
      if (S.freeze && S.freeze.until > t) return k.freezeFacing || k.facing;
      if ((S.mode === 'play' || S.mode === 'dive') && !k.busy && !k.back && !k.sit && !k.onLadder) {
        if (S.lookUp && t - S.lookUp.t0 < 0.7 && S.lookUp.x != null && Math.abs(S.lookUp.x - k.x) > 8) return sgn(S.lookUp.x - k.x);
        if (k.look && Math.abs(k.look.x - k.x) > 5) return sgn(k.look.x - k.x);
      }
      return k.facing;
    }
    var lastFrameTick = -1;
    function figures(view) {
      var t = view.t != null ? view.t : now(), out = [];
      // shown poses change only on the shutter
      var tickNow = Math.floor(t * FPS);
      K.forEach(function (k) {
        if (k.hidden) return;
        if (tickNow !== k.shownTick) {
          k.shownTick = tickNow;
          if (S.freeze && S.freeze.until > t) { if (!k.frozen) { k.frozen = true; k.freezePose = k.shown || k.pose; k.freezeFacing = k.shownFacing || k.facing; } }
          else if (S.lode && t - S.lode.t0 < 1.0) { if (!k.frozen) { k.frozen = true; k.freezePose = k.shown || k.pose; k.freezeFacing = k.shownFacing || k.facing; } }
          else k.frozen = false;
          k.shown = shownPose(k, t);
          k.shownFacing = lookFacing(k, t);
        }
        var pose = k.shown || k.pose, hopUp = 0;
        if (k.react.hop != null && t - k.react.hop < 0.5 && !k.busy && !k.back && !k.sit) { var hf = Math.floor((t - k.react.hop) * FPS); hopUp = hf === 1 ? -6 : hf === 2 ? -4 : 0; }
        var fig = {
          x: Math.round(k.x), y: Math.round(k.y + k.dy + hopUp), facing: k.shownFacing || k.facing, who: k.who,
          pose: quant(pose), tool: k.tool, tool2: (k.over && k.over.until > S.tick && k.over.tool2) || k.tool2, lamp: k.lamp,
          lampK: k.lampK, back: k.back, liftL: k.liftL, liftR: k.liftR, capOff: k.capOff || (S.lode && k.who === 'old' && t - S.lode.t0 >= 1.0 && t - S.lode.t0 < 3.0),
          tallyN: k.tallyN, shadow: true
        };
        if (fig.capOff && !k.capOff) fig.tool2 = 'cap';
        // a flicker when he ducks
        if (k.react.flicker > t) fig.lampK = 0.25;
        // knocked flat by a tapped glass
        if (S.freeze && S.freeze.until > t && S.freeze.topple && k.i === (S.freeze.toppler != null ? S.freeze.toppler : (S.freeze.toppler = pickToppler())) && !k.back && !k.onLadder) {
          fig.rot = fig.facing > 0 ? -90 : 90; fig.pose = quant(P.stiff);
        }
        // feet planted: a straight-legged toy's lower boot on the floor
        if (!fig.back && !k.sit && !fig.rot && ART && ART.CREW) {
          var cr = ART.CREW[k.who], lg = Math.min(Math.abs(fig.pose.legL || 0), Math.abs(fig.pose.legR || 0));
          fig.y += Math.round(cr.leg * (1 - Math.cos(lg)));
        }
        if (k.sit === 'edge' || k.sit === 'floor') { var cr2 = ART && ART.CREW[k.who]; fig.y = Math.round(k.y + (cr2 ? cr2.leg + 1 : 8)) - (k.sit === 'floor' ? 3 : 0); }
        if (k.hold) { var hh = handsOfFig(fig); fig.hold = { x: hh.x, y: hh.y, id: k.hold.id, spin: k.hold.spin }; fig.tool = null; }
        k.fig = fig;
        out.push(fig);
      });
      return out;
    }
    function pickToppler() {
      var cands = K.filter(function (k) { return !k.hidden && !k.back && !k.onLadder && !k.sit && k.busy !== 'theft'; });
      if (!cands.length) return -1;
      return cands[Math.floor(seedN(77, S.freeze.t0 * 10) * cands.length)].i;
    }
    // when a freeze ends, the toppled toy snaps back up in one frame
    var toppledLast = false;
    function fx(view) {
      var fx0 = view.fx || (view.fx = {}), t = view.t != null ? view.t : now();
      fx0.noStillLife = true;
      var n = nav(), props = [];
      // the fixed ladders the art doesn't paint
      for (var id in n.ladders) {
        var L = n.ladders[id];
        if (L.paint) props.push({ kind: 'ladder', x: L.x, y0: L.paint[0], y1: L.paint[1], lx: L.lx, w: L.w, fixed: true });
      }
      // their doors
      for (id in n.doors) {
        var d = n.doors[id]; if (d.mouth) continue;
        var ds = S.doorState[id], open = ds ? ds.open : 0;
        props.push({ kind: 'door', x: d.x, y: d.y, open: open, face: d.kind === 'face' });
        if (open === 2) props.push({ kind: 'doorglow', x: d.x, y: d.y, k: 0.8 });
      }
      // rope ladders and propped ladders
      for (var ri in S.ropes) {
        var rp = S.ropes[ri];
        if (rp.kind === 'rope') props.push({ kind: 'rope', x: rp.x, y0: rp.y0, y1: rp.y1, sway: 0 });
        else props.push({ kind: 'ladder', x: rp.x, y0: rp.y0, y1: rp.y1, feet: true });
      }
      if (S.pail) props.push({ kind: 'pail', x: S.pail.x, y: S.pail.y });
      // pins in hand, pins held to the rock
      K.forEach(function (k) {
        if (k.hidden || !k.carry) return;
        var c = k.carry, spr = c.spr;
        if (c.at) props.push({ kind: 'pin', x: c.at.x, y: c.at.y, spr: spr, dress: c.dress });
        else if (c.inHand && k.fig) {
          var hh = ART && ART.figureHands ? ART.figureHands(k.fig) : null;
          if (hh) props.push({ kind: 'pin', x: hh.r.x, y: hh.r.y - 2, spr: spr, dress: c.dress });
        }
      });
      // things in the air: dust, crumbs, a tossed pin, sleep
      S.dust.forEach(function (q) {
        var age = t - q.t0;
        if (q.kind === 'dust') props.push({ kind: 'dust', x: q.x, y: q.y, n: q.n, age: Math.floor(age * FPS), dx: q.dx });
        else if (q.kind === 'crumb') props.push({ kind: 'crumb', x: q.x, y: q.y + Math.floor(age * FPS) * 3 });
        else if (q.kind === 'glint') { if (Math.floor(age * FPS) % 2 === 0) props.push({ kind: 'glint', x: q.x, y: q.y, big: q.big }); }
        else if (q.kind === 'drip') props.push({ kind: 'drip', x: q.x, y: q.y + Math.floor(age * FPS) * 2 });
        else if (q.kind === 'zzz') props.push({ kind: 'zzz', x: q.x + Math.floor(age * FPS) % 2, y: q.y - Math.floor(age * FPS) });
        else if (q.kind === 'flying') {
          var fa = Math.floor(age * FPS) / FPS;
          if (q.plank) props.push({ kind: 'plank', x1: q.x + q.vx * fa - 5, y1: q.y + q.vy * fa + 300 * fa * fa, x2: q.x + q.vx * fa + 5, y2: q.y + q.vy * fa + 300 * fa * fa - 2 });
          else props.push({ kind: 'pin', x: q.x + q.vx * fa, y: q.y + q.vy * fa + 300 * fa * fa, spr: q.spr, dress: q.dress });
        }
      });
      // a lamp moving behind the rock
      var lamps = fx0.extraLamps || (fx0.extraLamps = []);
      K.forEach(function (k) {
        if (k.glow) {
          props.push({ kind: 'glow', x: k.glow.x, y: k.glow.y, k: 1, marble: k.glow.marble });
          lamps.push({ x: k.glow.x, y: k.glow.y, r: 16, c: '#ffc46a', k: 0.35 });
        }
      });
      S.glows = S.glows.filter(function (g) { return t - g.t0 < 0.7; });
      S.glows.forEach(function (g) { props.push({ kind: 'glow', x: g.x, y: g.y, k: 1 - (t - g.t0) / 0.7 }); lamps.push({ x: g.x, y: g.y, r: 14, c: '#ffc46a', k: 0.3 }); });
      // the moth leaves its lamp for Tobias's lantern
      if (S.moth != null) {
        var mk = K[S.moth], mf = mk.fig;
        if (mf && ART) { var lp = ART.figureLamp(mf); if (lp.lantern) fx0.moth = { x: lp.lantern.x, y: lp.lantern.y - 3, region: 'ventilation' }; }
      } else fx0.moth = null;
      // the legend card, lit from behind
      if (S.cardLamp != null) {
        var ck = K[S.cardLamp], cf = ck.fig;
        if (cf && ART) { var cl = ART.figureLamp(cf), lx = cl.lantern || cl; fx0.cardLamp = { x: lx.x, y: lx.y, k: 1, r: 36, fig: cf }; }
      } else fx0.cardLamp = null;
      fx0.lifted = S.lifted;
      view.props = props;
      // a stolen marble is in his hands (drawn there) or in the rock with him: not loose
      var held = {};
      K.forEach(function (k) { if (k.hold) held[k.hold.id] = 1; });
      (view.marbles || []).forEach(function (m) { if (held[m.id]) m.hidden = true; });
    }
    return part;
  }

  function copy(o) { var r = {}; for (var k in o) r[k] = o[k]; return r; }

  var PachinkoKnockers = { attach: attach, core: core, live: null };
  root.PachinkoKnockers = PachinkoKnockers;
  if (typeof module !== 'undefined' && module.exports) module.exports = PachinkoKnockers;
})(typeof window !== 'undefined' ? window : globalThis);

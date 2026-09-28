/* MOTHER LODE — mischief, the shift whistle and the mother lode (PLAN §7, wave 4)
 *
 * The machine misbehaves, with personality, and pays out the thing it is
 * named for. Three kinds of mischief, each telegraphed, each rate-limited
 * per game, each a pure function of (state, seed):
 *
 *   KNOCKER THEFT (the cheat). The knocker on the night shift is in the rock.
 *     In about one game in two he means to (the game's plan, by seed): from
 *     its marble on, each is looked at twice (at 0.3 s and 1.4 s old), and
 *     the first whose path passes one of their doors in reach is his: he steps
 *     out ~0.45 s early (the telegraph), catches it in two hands, runs it
 *     through the rock and comes out of another door, where he sets it down,
 *     lobs it or lets it drop: good or bad by seed (EXITS, lab-measured). The
 *     knockers do the running (pachinko-knockers.js theft()); this file says
 *     when and where to. One a game at most; never in a visit's first game.
 *   LAMPS GO OUT. A section of the mine (SECTIONS) is picked by seed; when a
 *     marble is about to fall into it, its lamps flicker twice, then it goes
 *     dark: the marble falls through unseen (the physics carries on; you hear
 *     the ticks). Every light in it goes, the knockers' caps too. Then the
 *     carbide catches and it comes back, brighter for a moment. About one
 *     game in four has a dark, and one of those in two keeps a marble (never
 *     in a visit's first game): it never comes out (no score), and when the
 *     light returns it is set in the rock where it went, a new exhibit,
 *     pencilled onto the figures card (Fig. 13).
 *   CAVE-IN (an event, not a cheat). A knocker goes to the floor over a bay,
 *     knocks, puts his ear to it, and backs off; dust sifts down; the roof over
 *     the bay comes down (PachinkoBoard.caveIn: a heap from divider to
 *     divider, the pins over it buried) for the rest of the game. The next
 *     WORK digs it out (the {type:'clear'} job, knockers; planned by main).
 *
 * THE JACKPOT TIERS
 *   small wins   the shift whistle (main sends `whistle` on a pocket catch):
 *                steam from the whistle on the hoist house's stack in time with
 *                the toots, the galleries' chase of bulbs (main), the crew look
 *                up (knockers), and the cage goes down the main shaft with the
 *                next shift's two cap lamps in it.
 *   the lode     part.lode(ctx) takes the 13 over, on the sound's clock (PLAN
 *                §12, LODE below): the held breath; the vein cracks open along
 *                a pre-drawn fracture; every lamp flares; ore spills; the bays
 *                ring; carts race the galleries; the crew cheer (knockers);
 *                +13 scrip rolls onto the drum a tick at a time with the coins;
 *                the marquee goes wild and the camera steps back to see it; the
 *                marquee's dead bulbs come on and stay on for the visit.
 *   the rare     a hook only: rare(state) → false; REWARD.rare is empty.
 *
 * FLAGS (Arcade.flags): pachinko.was-robbed (knockers, and here),
 *   pachinko.lights-out, pachinko.cave-in, pachinko.struck-the-lode (main).
 *
 * EVENTS OUT (the audio contract, PLAN §12): dark {region, regions, what:
 *   flicker|out|on, section} · lost {m, x, y} · cavein {region, x, slot, what:
 *   telegraph|fall|clear} · stolen comes from the knockers · mischief {what:
 *   theft, m, door, to, mode, good} (silent: the log) · rare (main).
 *
 * VIEW (fx, for pachinko-art-mischief.js): view.fx.mis = {…} and the light
 *   API (lights, dark, flare, extraLamps), view.fx.shake, view.fx.camOut,
 *   view.fx.wild, view.fx.mended. Marbles in the dark are hidden.
 *
 * HARNESS (?harness=1&force=…): theft (every eligible marble, up to the max),
 *   dark[:haulage|ventilation|deep], vanish (a dark that keeps one), cavein
 *   [:slot], lode (a real marble set over the 13), pocket (a real marble set
 *   over the pail: the whistle). Deterministic: no Math.random, no Date.
 *
 * PURE CORE (Node, the lab's sim.js): RATES, SECTIONS, EXITS, planGame(seed,
 *   force, {game}), wantTheft(plan, n), exitFor(seed, n), doorReach(nav), theftAt(…),
 *   releaseOf(nav, exit), rare(state).
 */
(function (root) {
  'use strict';

  var req = typeof require !== 'undefined' ? require : null;
  function mod(name, file) { return root[name] || (req ? req('./' + file) : null); }

  /* ══ the rules (tuned in local-dev/pachinko-lab/sim.js mischief; PLAN §12) ══ */
  // (wave 5c: the machine OCCASIONALLY cheats. It was ~2.2 events a game,
  // which made the mischief weather. Now each game the machine decides, by
  // seed, whether it will: a theft in about one game in two (one at most), a
  // dark in about one in four (and one of those in two keeps a marble: about
  // one game in eight), a cave-in in one in five. The first game of a visit
  // is clean of cheats: no theft, no vanish. ~0.9 events a game after it.)
  var RATES = {
    theft: { p: 0.5, from: 2, to: 9, max: 1, lead: 0.6, horizon: 1.6, checks: [0.3, 1.4] },
    dark: { p: 0.26, from: 3, to: 9, flicker: 0.55, out: [2.6, 3.6], relight: 0.7, vanish: 0.6 },
    cave: { p: 0.2, from: 3, to: 9, telegraph: 1.5 }
  };
  // the dark takes a section: its regions (the light API's), the band of rock
  // a lost marble is kept in, and where a marble about to fall in is watched
  var SECTIONS = {
    haulage:     { id: 'haulage', regions: ['haulage', 'measures'], primary: 'measures', y0: 142, y1: 222, rock: [166, 214] },
    ventilation: { id: 'ventilation', regions: ['ventilation', 'barren'], primary: 'barren', y0: 222, y1: 292, rock: [246, 286] },
    deep:        { id: 'deep', regions: ['workings', 'vein', 'sump'], primary: 'vein', y0: 292, y1: 384, rock: [326, 378] }
  };
  var SECTION_ORDER = ['haulage', 'ventilation', 'deep'];
  // where a thief comes out, and how he puts it back (door ids: the knockers'
  // DOORS). Outcomes measured in the lab (mis/sites.js exits, 200 releases):
  // the weights are set so a stolen marble finds the 13 and pays on average
  // what it would have left alone (sim.js mischief; PLAN §12)
  var EXITS = [
    { door: 'c1', mode: 'toss', face: 1,  w: 0.26, good: true,  note: 'lobbed at the lode (13 one time in ten)' },
    { door: 'b1', mode: 'set',  face: 1,  w: 0.08, good: true,  note: 'set down over the middle' },
    { door: 'rC', mode: 'set',  face: -1, w: 0.10, good: true,  note: 'rolled into the EGG chute' },
    { door: 'b2', mode: 'set',  face: -1, w: 0.12, good: true,  note: 'into the dinner pail' },
    { door: 's1', mode: 'set',  face: -1, w: 0.16, good: false, note: 'dumped in the sump (GOB)' },
    { door: 'rC2', mode: 'set', face: 1,  w: 0.14, good: false, note: 'down the overburden' },
    { door: 'b2', mode: 'set',  face: 1,  w: 0.14, good: false, note: 'down the company office tunnel' }
  ];
  // the lode's clock: the sound's, re-timed around the crew (pachinko-audio.js
  // lode(), PLAN §12): the held breath 0–1.0; the crack +0.30; the whistle as
  // the alarm +0.35 (0.8 s), toot-toot +2.75/+3.05; the flare +0.45; the
  // cascade +0.55–1.9; the scrip +0.55–3.55; the choir +1.0–2.6 (boots to
  // +3.0, the knockers' cheer); the carts +1.0–3.0; the music box +3.4
  var LODE = { crack: 0.30, whistle: 0.35, flare: 0.45, cascade: 0.55, coins: 0.55, coinsEnd: 3.55, carts: 1.0, cheer: 1.0, box: 3.4, hold: 4.2, end: 6.5,
    toots: [[0, 0.8], [2.4, 0.3], [2.7, 0.55]] };
  // the shift whistle's toots (the sound's whistleFor), played 0.38 s after `whistle`
  function whistleFor(value) {
    if (value >= 13) return [[0, 1.2], [1.45, 0.3], [1.85, 0.55]];
    if (value >= 3) return [[0, 0.32], [0.44, 0.62]];
    return [[0, 0.55]];
  }
  var REWARD = { rare: null };             // the rare tier's slot: empty until the adventure fills it

  /* ── hashes ─────────────────────────────────────────────────────── */
  function h3(a, b, c) {
    var h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x7F4A7C15, 0x85EBCA77) ^ Math.imul((c | 0) + 0x165667B1, 0xC2B2AE3D);
    h ^= h >>> 16; h = Math.imul(h, 0x85EBCA6B); h ^= h >>> 13; h = Math.imul(h, 0xC2B2AE35); h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  function pick(list, u) {
    var tot = 0, i; for (i = 0; i < list.length; i++) tot += list[i].w;
    var a = u * tot; for (i = 0; i < list.length; i++) { a -= list[i].w; if (a < 0) return list[i]; }
    return list[list.length - 1];
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(u) { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); }

  /* ── the per-game plan: a pure function of the game's seed ──────── */
  // info.game: this game's number in the visit (1 = the first: no cheats)
  function planGame(seed, force, info) {
    force = force || {};
    var R = RATES, p = { seed: seed | 0 }, first = !!(info && info.game === 1);
    // the theft: whether he'll try this game, and from which marble he watches
    if (force.theft) p.theft = { from: 1, max: 3 };
    else if (!first && h3(seed, 13, 1) < R.theft.p) p.theft = { from: R.theft.from + Math.floor(h3(seed, 13, 2) * (R.theft.to - R.theft.from + 1)), max: R.theft.max };
    else p.theft = null;
    var dk = force.dark || force.vanish ? true : h3(seed, 11, 1) < R.dark.p;
    if (dk) {
      var sec = typeof force.dark === 'string' && SECTIONS[force.dark] ? force.dark : SECTION_ORDER[Math.floor(h3(seed, 11, 3) * 3)];
      p.dark = {
        n: force.dark || force.vanish ? 1 : R.dark.from + Math.floor(h3(seed, 11, 2) * (R.dark.to - R.dark.from + 1)),
        section: sec,
        dur: R.dark.out[0] + (R.dark.out[1] - R.dark.out[0]) * h3(seed, 11, 4),
        vanish: force.vanish ? true : force.dark || first ? false : h3(seed, 11, 5) < R.dark.vanish
      };
    } else p.dark = null;
    var cv = force.cavein ? true : h3(seed, 12, 1) < R.cave.p;
    if (cv) {
      var fs = typeof force.cavein === 'number' && PBk().CAVE_BAYS.indexOf(force.cavein) >= 0 ? force.cavein : null;
      var bays = PBk().CAVE_BAYS;
      p.cave = {
        n: force.cavein ? 1 : R.cave.from + Math.floor(h3(seed, 12, 2) * (R.cave.to - R.cave.from + 1)),
        slot: fs != null ? fs : bays[Math.floor(h3(seed, 12, 3) * bays.length)]
      };
      // never on top of the dark
      if (p.dark && Math.abs(p.cave.n - p.dark.n) < 3 && !force.cavein) p.cave.n = p.dark.n <= 6 ? p.dark.n + 3 : p.dark.n - 3;
    } else p.cave = null;
    return p;
  }
  function PBk() { return mod('PachinkoBoard', 'pachinko-board.js'); }
  // is this marble (the n-th of the game) one they'd take? (the game's plan:
  // from its marble on, the first that passes a door in reach is his)
  function wantTheft(plan, n) { var T = plan && plan.theft; return !!T && n >= T.from; }
  // where it comes out, good or bad by seed (never the door it went in by)
  function exitFor(seed, n, notDoor) {
    var e = pick(EXITS, h3(seed, 3000 + n, 1));
    if (e.door === notDoor) e = EXITS[(EXITS.indexOf(e) + 1) % EXITS.length];
    return e;
  }
  // where a thief's hands are in the ready pose, from his feet (measured from
  // the rig, pachinko-art-figures.js; the knockers compute it live)
  var HANDS = { pick: { x: 19.36, y: -16.86 }, little: { x: 17.18, y: -14.08 } };
  // their doors, each with the floor it opens onto
  function doorReach(nav) {
    var out = [];
    for (var id in nav.doors) { var d = nav.doors[id]; out.push({ id: id, x: d.x, y: d.y, W: nav.walks[d.w] }); }
    return out;
  }
  // would a knocker stepping out of one of them (a step or two along the
  // floor) have the marble come right into his hands here? (canSteal's test)
  function nearDoor(doors, x, y, who) {
    var KC = mod('PachinkoKnockers', 'pachinko-knockers.js').core, H0 = HANDS[who] || HANDS.pick;
    for (var i = 0; i < doors.length; i++) {
      var d = doors[i], W = d.W;
      for (var s = -1; s <= 1; s += 2) {
        var ox = H0.x * s, sx = clamp(Math.round(x - ox), Math.max(W.x0, d.x - 9), Math.min(W.x1, d.x + 9));
        if (Math.abs(x - (sx + ox)) <= 3 && Math.abs(y - (KC.walkY(W, sx) + H0.y)) <= 4) return { door: d.id, side: s };
      }
    }
    return null;
  }
  // the lab's version of canSteal over a recorded path [[t, x, y, phase]…]:
  // the first point between age c+lead and c+horizon within reach of a door,
  // before the marble leaves the board (a tunnel, the cart, a pocket)
  function theftAt(doors, path, c, who) {
    var T = RATES.theft;
    for (var i = 0; i < path.length; i++) {
      var q = path[i];
      if (q[0] < c) continue;
      if (q[3] !== 'board' && q[3] !== 'drop') return null;
      if (q[0] > c + T.horizon) return null;
      if (q[0] < c + T.lead) continue;
      var nd = nearDoor(doors, q[1], q[2], who);
      if (nd) return { i: i, t: q[0], x: q[1], y: q[2], door: nd.door };
    }
    return null;
  }
  // where a thief lets it go: the knockers' own releasePoint, the very one the
  // live thief uses (wave 5c: the lab used to model the throw from a point 8 px
  // off the real one, inside a coal pillar, and measured a game nobody played)
  // (seed: the marble's; the lab passes the one it simulates)
  function releaseOf(nav, exit, board, seed) {
    var KC = mod('PachinkoKnockers', 'pachinko-knockers.js').core;
    return KC.releasePoint(nav, exit, board || nav.board, seed == null ? null : KC.throwU({ seed: seed }));
  }
  // the rare tier's trigger: nothing, in this build (the adventure fills it)
  function rare(state) { return false; }

  /* ══ THE PART ══════════════════════════════════════════════════════ */
  function attach(api) {
    var PB = root.PachinkoBoard, PP = root.PachinkoPhysics;
    var search = (root.location && root.location.search) || '';
    var HARNESS = /[?&]harness=1/.test(search), FORCE = {};
    if (HARNESS) {
      var fm = /[?&]force=([^&]*)/.exec(search);
      if (fm) decodeURIComponent(fm[1]).split(',').forEach(function (kv) {
        var q = kv.split(':'); if (!q[0]) return;
        FORCE[q[0]] = q.length > 1 ? (isNaN(+q[1]) ? q[1] : +q[1]) : true;
      });
    }
    var S = {
      mode: 'attract', seed: 1913, games: 0, plan: null,
      idx: {}, born: {}, looked: {}, released: 0, thefts: 0, log: [], stolenAt: {},
      dark: null, darkDone: false, cave: null, caveDone: false,
      lode: null, crack: null, lodes: 0,
      whistles: [], cage: null, mended: false, lost: [], lostN: 0,
      forced: {}
    };
    function now() { return api.now(); }
    function flag(name) { try { if (api.flags && api.flags.set) api.flags.set(name); } catch (e) { } }
    function kn() { return api.knockers || null; }
    function world() { return api.world(); }
    function marble(id) { var w = world(), r = null; if (w) w.marbles.forEach(function (m) { if (m.id === id) r = m; }); return r; }
    function mine(m) { return api.game && api.game.mine && api.game.mine[m.id]; }
    function lodeOn(t) { return S.lode && t - S.lode.t0 < LODE.hold; }

    /* ── a new game ─────────────────────────────────────────────── */
    function newGame(seed) {
      S.seed = seed | 0; S.games++;
      S.plan = planGame(S.seed, FORCE, { game: S.games });
      S.idx = {}; S.born = {}; S.looked = {}; S.released = 0; S.thefts = 0; S.stolenAt = {};
      S.dark = null; S.darkDone = false; S.cave = null; S.caveDone = false;
      S.crack = null; S.lode = null; S.forced = {};
    }

    /* ── THEFT ──────────────────────────────────────────────────── */
    function lookAt(m, check, t) {
      var K = kn(); if (!K || !K.canSteal || !K.theft) return;
      var n = S.idx[m.id];
      var TP = S.plan && S.plan.theft;
      if (!TP || S.thefts >= TP.max || !wantTheft(S.plan, n)) return;
      if (S.dark || lodeOn(t) || (S.cave && !S.cave.fallT)) return;      // one piece of mischief at a time
      var who = K.nightShift && K.nightShift();
      if (!who || (K.busy && K.busy(who))) return;
      var plan = K.canSteal(m.id, { lead: RATES.theft.lead, horizon: RATES.theft.horizon });
      if (!plan) return;
      var ex = exitFor(S.seed, n, plan.door);
      var res = K.theft({ plan: plan, who: who, to: ex.door, mode: ex.mode, face: ex.face });
      if (!res || !res.ok) return;
      S.thefts++;
      S.log.push({ t: t, m: m.id, n: n, door: plan.door, to: ex.door, mode: ex.mode, good: ex.good, entry: res.entry || null });
      api.emit({ type: 'mischief', what: 'theft', m: m.id, door: plan.door, to: ex.door, mode: ex.mode, good: ex.good });
    }
    function stepTheft(t) {
      var w = world(); if (!w) return;
      // a theft he called off before showing himself (the marble was knocked
      // off its line) never happened: it doesn't count against the game's two
      S.log.forEach(function (l) { if (l.entry && l.entry.state === 'aborted' && !l.refunded) { l.refunded = true; S.thefts = Math.max(0, S.thefts - 1); } });
      var checks = RATES.theft.checks;
      w.marbles.forEach(function (m) {
        if (m.done || S.idx[m.id] == null) return;
        if (m.stolen) {
          // a watchdog: a marble never stays in their hands (the game would never end)
          if (S.stolenAt[m.id] == null) S.stolenAt[m.id] = t;
          else if (t - S.stolenAt[m.id] > 6) { m.stolen = false; m.phase = 'board'; m.vx = 0; m.vy = 20; if (m.heldAge != null) { m.age = m.heldAge; m.heldAge = null; } delete S.stolenAt[m.id]; }
          return;
        }
        delete S.stolenAt[m.id];
        if (m.phase === 'tunnel' || m.phase === 'cart' || m.phase === 'pocket') return;
        var age = t - S.born[m.id], lk = S.looked[m.id] | 0;
        if (lk < checks.length && age >= checks[lk]) { S.looked[m.id] = lk + 1; lookAt(m, lk, t); }
      });
    }

    /* ── LAMPS GO OUT ───────────────────────────────────────────── */
    function darkEvent(what) {
      var d = S.dark, sec = SECTIONS[d.section];
      api.emit({ type: 'dark', region: sec.primary, regions: sec.regions.slice(), what: what, section: d.section });
    }
    function stepDark(t) {
      var P = S.plan && S.plan.dark, d = S.dark;
      if (!d) {
        if (!P || S.darkDone || S.mode !== 'play' || S.released < P.n || lodeOn(t) || (S.cave && S.cave.tTele != null && !S.cave.fallT)) return;
        // a marble of the game about to fall into the section: that's the moment
        var sec = SECTIONS[P.section], w = world(), trig = null;
        w.marbles.forEach(function (m) {
          if (trig || m.done || m.stolen || !mine(m) || m.phase === 'tunnel' || m.phase === 'cart' || m.phase === 'pocket') return;
          if (m.y > sec.y0 - 48 && m.y < sec.y0 - 14 && m.vy > 0) trig = m;
        });
        if (!trig) return;
        d = S.dark = { section: P.section, t0: t, tOut: t + RATES.dark.flicker, tOn: null, tEnd: null, dur: P.dur, trigger: trig.id, vanish: P.vanish, lost: null, inRock: {} };
        d.tOn = d.tOut + d.dur; d.tEnd = d.tOn + RATES.dark.relight;
        darkEvent('flicker');
        return;
      }
      if (!d.out && t >= d.tOut) { d.out = true; darkEvent('out'); flag('pachinko.lights-out'); }
      // the lode lights up the dark (the crack opens right through it)
      // (only a dark that was already out when the flare fired, and only in the
      // lode's own window: a dark that starts after the lode keeps its course)
      if (S.lode && d.out && !d.on && d.section === 'deep' && d.tOn > t) {
        var lu0 = t - S.lode.t0;
        if (lu0 >= LODE.flare && lu0 < LODE.hold && d.tOut <= S.lode.t0 + LODE.flare) { d.tOn = t; d.tEnd = t + RATES.dark.relight; }
      }
      if (d.out && !d.on && d.vanish && !d.lost && t < d.tOn - 0.3) findVictim(d, t);
      if (!d.on && t >= d.tOn) {
        d.on = true; darkEvent('on');
        if (d.lost) keepLost(d.lost);
      }
      if (t >= d.tEnd) { S.dark = null; S.darkDone = true; }
    }
    // one marble the dark keeps: the first of the game's deep in the rock
    function findVictim(d, t) {
      var sec = SECTIONS[d.section], w = world();
      w.marbles.forEach(function (m) {
        if (d.lost || m.done || m.stolen || !mine(m) || m.phase !== 'board') return;
        var inside = m.y > sec.rock[0] && m.y < sec.rock[1] && m.x > 70 && m.x < 312;
        if (!inside) { delete d.inRock[m.id]; return; }
        if (d.inRock[m.id] == null) { d.inRock[m.id] = t; return; }
        if (t - d.inRock[m.id] < 0.12) return;
        // gone: no score, no slot; the game counts it done
        m.done = true; m.phase = 'done'; m.lost = true; m.outcome = { kind: 'lost', id: null, value: 0 }; m.tDone = w.t;
        w.events.push({ type: 'done', m: m.id, t: w.t, outcome: m.outcome, lost: true });
        d.lost = { id: m.id, x: Math.round(m.x), y: Math.round(m.y), t: t };
        api.emit({ type: 'lost', m: m.id, x: Math.round(m.x), y: Math.round(m.y) });
      });
    }
    // …and when the light comes back, there it is, set in the rock: an exhibit
    function keepLost(L) {
      S.lostN++;
      // (set in the rock where it went, but never right over the 13's cup,
      // where its bone tag "13" read as the jackpot: moved along the band)
      var x = L.x, y = Math.min(L.y, 368);
      if (Math.abs(x - 177) < 30 && y > 320) x = x < 177 ? 142 : 216;
      if (S.lost.length < 3) S.lost.push({ x: x, y: y, id: L.id, t: now(), n: S.lostN });
      api.emit({ type: 'kept', m: L.id, x: x, y: y, n: S.lostN });
    }

    /* ── CAVE-IN ────────────────────────────────────────────────── */
    function knockSpot(cx) {
      if (cx > 65 && cx < 246) return { x: cx, y: 316 };
      if (cx < 97) return { x: clamp(cx, 16, 88), y: 382 };
      return { x: cx, y: 328 };
    }
    // (main plans the dig-out in WORK and rebuilds the physics' static hash
    // mid-game; the knockers dig: the `clear` job)
    function stepCave(t) {
      var P = S.plan && S.plan.cave, c = S.cave;
      if (!c) {
        if (!P || S.caveDone || S.mode !== 'play' || S.released < P.n || S.dark || lodeOn(t)) return;
        var b = api.board(), s = b.byId['slot.' + P.slot]; if (!s) { S.caveDone = true; return; }
        var cx = (s.x0 + s.x1) / 2, spot = knockSpot(cx);
        c = S.cave = { slot: P.slot, x0: s.x0, x1: s.x1, cx: cx, t0: t, tTele: null, tFall: null, fallT: null, who: null, spot: spot, seed: h3(S.seed, 12, 9) * 1e9 | 0 };
        // the nearest knocker who's about (never the one on the night shift)
        var K = kn();
        if (K && K.knockListen && K.knockers) {
          var ns = K.nightShift && K.nightShift();
          var cands = K.knockers.filter(function (k) { return !k.hidden && k.who !== ns && !k.busy; })
            .sort(function (a, b2) { return Math.hypot(a.x - spot.x, a.y - spot.y) - Math.hypot(b2.x - spot.x, b2.y - spot.y); });
          for (var i = 0; i < cands.length && !c.who; i++) {
            var r = K.knockListen({ x: spot.x, y: spot.y, who: cands[i].who, n: 1, alarm: true });
            if (r && r.ok) c.who = r.who;
          }
        }
        if (!c.who) { c.tTele = t + 0.3; teleEvent(c); }
        return;
      }
      if (c.tTele == null && t - c.t0 > 5) { c.tTele = t; teleEvent(c); }
      if (c.tTele != null && c.tFall == null) c.tFall = c.tTele + RATES.cave.telegraph;
      if (c.tFall != null && !c.fallT && t >= c.tFall) {
        // not on top of a marble: it waits (a little) for the bay to be clear
        var busy = world().marbles.some(function (m) { return !m.done && m.phase !== 'tunnel' && m.x > c.x0 - 7 && m.x < c.x1 + 7 && m.y > 362 && m.y < 400; });
        if (busy && t - c.tFall < 1.4) return;
        c.fallT = t;
        api.setBoard(PB.caveIn(api.board(), { slot: c.slot, seed: c.seed }));
        api.emit({ type: 'cavein', region: 'payout', x: Math.round(c.cx), slot: 'slot.' + c.slot, what: 'fall' });
        flag('pachinko.cave-in');
      }
      if (c.fallT && t - c.fallT > 2.5) S.caveDone = true;
    }
    function teleEvent(c) { api.emit({ type: 'cavein', region: 'payout', x: Math.round(c.cx), slot: 'slot.' + c.slot, what: 'telegraph' }); }

    /* ── forced demos (the harness) ─────────────────────────────── */
    function stepForced(t) {
      if (S.mode !== 'play') return;
      var w = world(), b = api.board();
      function place(x, y) { var m = PP.addMarble(w, x); m.x = x; m.y = y; m.vx = 0; m.vy = 30; m.phase = 'board'; return m; }
      if (FORCE.lode && !S.forced.lode && t - S.playT0 > 0.6) {
        S.forced.lode = true;
        var s = b.byKind.slot.filter(function (q) { return q.value >= 13; })[0];
        place((s.x0 + s.x1) / 2, 376);          // into the cup, squarely
      }
      if (FORCE.pocket && !S.forced.pocket && t - S.playT0 > 0.6) {
        S.forced.pocket = true;
        var pk = b.byId.pail; if (pk) place(pk.x, pk.y - 12);
      }
    }

    /* ── the lode: the 13 taken over ────────────────────────────── */
    function startLode(ctx) {
      var t0 = ctx.t0;
      S.lodes++;
      S.lode = { t0: t0, x: ctx.x == null ? 177 : ctx.x, seed: (h3(S.seed, 4000 + S.lodes, 1) * 1e9) | 0, n: S.lodes };
      S.crack = { t0: t0, seed: S.lode.seed };
      S.mendAt = t0 + LODE.flare;
      S.whistles.push({ t0: t0 + LODE.whistle, pat: LODE.toots });          // the alarm, and later toot-toot
      if (ctx.holdTally) ctx.holdTally(13);
      var done = false;
      return {
        step: function (t) {
          var u = t - t0;
          if (u >= LODE.flare && !S.mended) S.mended = true;          // the marquee's dead bulbs: for the rest of the visit
          // the 13 onto the drum a tick at a time, with the coins in the bucket
          if (ctx.holdTally) {
            var k = 0;
            for (var i = 0; i < 13; i++) if (u >= LODE.coins + (LODE.coinsEnd - LODE.coins) * Math.pow(i / 13, 1.3)) k++;
            ctx.holdTally(13 - k);
          }
          // (the lode's state ends here, in the sim: never from the view)
          if (u >= LODE.end) { done = true; if (S.lode && S.lode.t0 === t0) S.lode = null; }
          return done;
        },
        busy: function (t) { return t - t0 < LODE.hold; }
      };
    }

    /* ── the shift whistle ──────────────────────────────────────── */
    function onWhistle(e) {
      var t = e.t != null ? e.t : now();
      S.whistles.push({ t0: t + 0.38, pat: whistleFor(e.value | 0) });
      if (!S.cage || t - S.cage.t0 > 3.6) S.cage = { t0: t + 0.3 };
    }

    /* ── events in ──────────────────────────────────────────────── */
    var unsub = api.on(function (e) {
      var t = e.t != null ? e.t : now();
      switch (e.type) {
        case 'mode':
          S.mode = e.mode;
          if (e.mode === 'play') S.playT0 = t;
          if (e.mode === 'payout' || e.mode === 'attract') { if (S.dark && !S.dark.on) { S.dark.tOn = Math.min(S.dark.tOn, t); } }
          break;
        case 'release':
          if (e.m != null) { S.released++; S.idx[e.m] = e.n || S.released; S.born[e.m] = t; }
          break;
        case 'whistle': onWhistle(e); break;
        case 'figure':
          if (S.cave && S.cave.tTele == null && e.what === 'knock' && e.who === S.cave.who) { S.cave.tTele = t; teleEvent(S.cave); }
          break;
        case 'stolen': flag('pachinko.was-robbed'); break;
      }
    });

    /* ── the view ───────────────────────────────────────────────── */
    var ALL = (PB && PB.REGIONS ? PB.REGIONS.map(function (r) { return r.id; }) : ['surface', 'headframe', 'overburden', 'haulage', 'measures', 'ventilation', 'barren', 'workings', 'sump', 'vein', 'payout', 'legend']);
    function fx(view) {
      var fxo = view.fx || (view.fx = {}), t = view.t != null ? view.t : now();
      // (main rebuilds lights and lamps each frame; the blackouts are ours, fresh each frame too)
      var lights = fxo.lights || (fxo.lights = {}), dark = fxo.dark = {}, lamps = fxo.extraLamps || (fxo.extraLamps = []);
      var mis = fxo.mis = { t: t, lost: S.lost, lostN: S.lostN };
      function mul(rg, k) { lights[rg] = (lights[rg] == null ? 1 : lights[rg]) * k; }

      // the dark
      var d = S.dark;
      if (d) {
        var sec = SECTIONS[d.section], lk = 1, dk = 0, u0 = t - d.t0;
        if (!d.out || t < d.tOut) {
          // the telegraph: two flickers (with the sound's, at 0 and 0.19)
          lk = (u0 < 0.08 || (u0 > 0.19 && u0 < 0.27)) ? 0.1 : (u0 > 0.42 ? 0.55 : 1);
        } else if (t < d.tOn) {
          var uo = t - d.tOut;
          lk = 0; dk = uo < 0.05 ? 0.7 : 1;
        } else {
          // the carbide catches: a stutter, then brighter than before, settling
          var ur = t - d.tOn;
          if (ur < 0.05) { lk = 1.3; dk = 0.3; } else if (ur < 0.11) { lk = 0.15; dk = 0.9; }
          else { lk = 1 + 0.55 * Math.max(0, 1 - (ur - 0.11) / (RATES.dark.relight - 0.11)); dk = Math.max(0, 1 - (ur - 0.11) / 0.12); }
        }
        sec.regions.forEach(function (rg) { if (lk === 0) lights[rg] = 0; else mul(rg, lk); if (dk > 0) dark[rg] = Math.max(dark[rg] || 0, dk); });
        mis.dark = { section: d.section, k: dk, regions: sec.regions, out: dk >= 1 };
      }
      // the cave-in: dust sifting down over the bay, then the fall
      var c = S.cave;
      if (c) {
        if (c.tTele != null && !c.fallT) mis.sift = { x0: c.x0, x1: c.x1, cx: c.cx, t0: c.tTele, t1: c.tFall, seed: c.seed };
        if (c.fallT && t - c.fallT < 2.5) {
          mis.fall = { x0: c.x0, x1: c.x1, cx: c.cx, t0: c.fallT, seed: c.seed, slot: c.slot };
          var fu = t - c.fallT;
          if (fu < 0.5) mul('payout', fu < 0.08 ? 0.3 : fu < 0.16 ? 1.3 : fu < 0.24 ? 0.6 : 1);
          if (fu < 0.4) fxo.shake = { t0: c.fallT, dur: 0.4, amp: 1 };
        }
      }
      // the shift whistle's steam, and the cage going down with the next shift
      S.whistles = S.whistles.filter(function (q) { return t - q.t0 < 4.5; });
      var steam = [];
      S.whistles.forEach(function (q) { q.pat.forEach(function (p) { steam.push({ t0: q.t0 + p[0], dur: p[1] }); }); });
      if (S.cage && t - S.cage.t0 < 3.6 && t >= S.cage.t0) mis.cage = { u: t - S.cage.t0 };
      // the lode
      var L = S.lode;
      if (L) {
        var u = t - L.t0;
        mis.lode = { u: u, t0: L.t0, x: L.x, seed: L.seed, n: L.n };
        // the held breath: the room dims; then every lamp flares, and settles
        var fl = u < LODE.flare ? 0 : u < LODE.flare + 0.08 ? (u - LODE.flare) / 0.08 : u < 2.6 ? 1 : Math.max(0, 1 - (u - 2.6) / 1.9);
        var hold = u < LODE.flare ? Math.min(1, u / 0.12) : 0;
        fxo.flare = Math.max(fxo.flare || 0, fl);
        ALL.forEach(function (rg) {
          var k = hold > 0 ? 1 - 0.72 * hold : 1 + 0.9 * fl;
          if (lights[rg] === 0) return;                               // (a section still dark stays dark until the flare)
          mul(rg, k);
        });
        if (u >= LODE.flare && dark) for (var rg in dark) if (u < LODE.flare + 0.15) dark[rg] = 0;
        // the 13's cup glows through the held breath
        var cupK = u < LODE.crack ? 0.4 + 0.6 * (u / LODE.crack) : Math.max(0.3, 1 - (u - 3) / 3);
        lamps.push({ x: L.x, y: 394, r: 30, c: '#ffd24a', k: 1.4 * cupK });
        // the fuse's own light, climbing the stringer to the vein
        if (u > 0.04 && u < LODE.crack + 0.1) { var fk = Math.min(1, (u - 0.04) / (LODE.crack - 0.06)); lamps.push({ x: L.x + 2, y: 388 - 25 * fk, r: 16, c: '#ffc84a', k: 1.2 }); }
        if (u < LODE.crack + 0.35) fxo.shake = u >= LODE.crack ? { t0: L.t0 + LODE.crack, dur: 0.35, amp: 2 } : fxo.shake;
        // the marquee goes wild, and the camera steps back to see it
        fxo.wild = u < LODE.flare ? 0 : u < 3.4 ? 1 : Math.max(0, 1 - (u - 3.4) / 1.4);
        fxo.camOut = u < 0.5 ? 0 : u < 1.1 ? ease((u - 0.5) / 0.6) : u < 3.3 ? 1 : 1 - ease((u - 3.3) / 0.9);
      }
      if (S.crack) {
        mis.crack = { t0: S.crack.t0, seed: S.crack.seed, u: t - S.crack.t0 };
        // gold light along the open vein: bright at the flare, then an ember that stays
        var cu = t - S.crack.t0, seam = seamOf(api.board());
        if (seam && cu >= LODE.crack) {
          var open = cu < LODE.crack + 0.45 ? (cu - LODE.crack) / 0.45 : cu < 3 ? 1 : Math.max(0.22, 1 - (cu - 3) / 2.5);
          for (var sx = seam.x1 + 6; sx < seam.x2; sx += 18) {
            var front = Math.abs(sx - crackOrigin(seam).x) / 600;
            if (cu - LODE.crack < front) continue;
            lamps.push({ x: sx, y: seamY(seam, sx) - 1, r: open > 0.5 ? 22 : 16, c: '#ffc84a', k: 1.15 * open });
          }
        }
      }
      if (steam.length) mis.steam = steam;
      // the curator's cool pin spot on each marble the dark kept (as on every figure in the rock)
      // (the moment it's found: the spot clicks on, bright, and settles)
      S.lost.forEach(function (q) { var qa = t - q.t; lamps.push({ x: q.x, y: q.y, r: 15, c: '#b8c4ff', k: qa >= 0 && qa < 0.12 ? 0 : qa < 0.5 ? 1.5 : 0.6 }); });
      // and a work light on a cave-in's heap, so the bay that's shut reads as shut
      (api.board().caveins || []).forEach(function (cv) { lamps.push({ x: cv.cx, y: cv.top + 4, r: 20, c: '#ffe0a0', k: 0.55 }); });
      fxo.mended = S.mended && (!S.mendAt || t >= S.mendAt);
      // the carts and the ore carry their own light (the art reads mis.lode.u)
      if (L && t - L.t0 > LODE.carts && t - L.t0 < 3.3) CARTS.forEach(function (ct) { var p = cartAt(ct, t - L.t0, api.board()); if (p) lamps.push({ x: p.x, y: p.y - 4, r: 24, c: '#ffd070', k: 1.25 }); });
      // marbles in the dark are not seen (a marble in the rock's tunnel neither)
      if (d && dk_(dark)) (view.marbles || []).forEach(function (m) {
        var x = m.x, y = m.y;
        if (m.phase === 'tunnel' && m.tunnel) { var k2 = m.tunnel.k; x = m.tunnel.from.x + (m.tunnel.to.x - m.tunnel.from.x) * k2; y = m.tunnel.from.y + (m.tunnel.to.y - m.tunnel.from.y) * k2; }
        var rg2 = PB.regionAt(x, y);
        if ((dark[rg2] || 0) >= 0.85) { m.hidden = true; if (m.phase === 'tunnel') m.phase = 'unseen'; }
      });
      fxo.misDark = dark;
    }
    function dk_(dark) { for (var k in dark) if (dark[k] > 0) return true; return false; }

    var part = {
      step: function (t) {
        if (S.mode === 'play' || S.mode === 'dive') { stepTheft(t); stepDark(t); stepCave(t); stepForced(t); }
        else if (S.dark) stepDark(t);
      },
      gameStart: function (seed) { newGame(seed); },
      gameEnd: function () { },
      lode: function (ctx) { return startLode(ctx); },
      fx: fx,
      rare: function (ctx) { return rare(ctx) ? REWARD.rare : false; },
      destroy: function () { if (unsub) unsub(); },
      state: S, plan: function () { return S.plan; }
    };
    PachinkoMischief.live = part;
    return part;
  }

  /* ══ geometry the art shares: the vein's fracture, the racing carts ══ */
  function seamOf(board) {
    var ds = (board && board.decor) || [];
    for (var i = 0; i < ds.length; i++) if (ds[i].kind === 'seam') return ds[i];
    return null;
  }
  // the vein's centre line (the art's own: pachinko-art-mine.js paintVein)
  function seamY(sm, x) { var u = (x - sm.x1) / (sm.x2 - sm.x1); return sm.y1 + (sm.y2 - sm.y1) * u + Math.sin(u * 9) * 2; }
  // the fracture starts where the stringer from the 13 meets the vein
  function crackOrigin(sm) { var x = sm.x1 + (sm.x2 - sm.x1) * 0.35; return { x: x, y: seamY(sm, x) }; }
  // the carts that race the galleries at the lode: [floor, from x, to x, start s, dur s]
  var CARTS = [
    { floor: 'floorB', x0: 252, x1: 12, t0: 1.0, dur: 1.7 },
    { floor: 'floorC', x0: 70, x1: 240, t0: 1.25, dur: 1.5 }
  ];
  // where a racing cart is at lode time u (on the floor's planks; over an
  // opening it flies, a toy's leap), or null
  function cartAt(ct, u, board) {
    var k = (u - ct.t0) / ct.dur;
    if (k < 0 || k > 1.12) return null;
    var fl = null; (board.floors || []).forEach(function (f) { if (f.id === ct.floor) fl = f; });
    if (!fl) return null;
    var kk = Math.min(1, k), x = ct.x0 + (ct.x1 - ct.x0) * (kk * kk * (1.6 - 0.6 * kk)), dir = ct.x1 > ct.x0 ? 1 : -1;
    var y = floorTop(fl, x), air = 0;
    fl.openings.forEach(function (o) {
      var a = o.x - o.w / 2 - 3, b = o.x + o.w / 2 + 3;
      if (x > a && x < b) { var q = (x - a) / (b - a); air = Math.sin(q * Math.PI) * 6; y = Math.min(floorTop(fl, a), floorTop(fl, b)); }
    });
    // off the end: it tips and spills
    var tip = k > 1 ? (k - 1) / 0.12 : 0;
    return { x: x, y: y - air, dir: dir, air: air, tip: tip, k: k };
  }
  function floorTop(fl, x) {
    for (var i = 0; i < fl.pieces.length; i++) {
      var p = fl.pieces[i]; if (x < p.x0 - 0.5 || x > p.x1 + 0.5) continue;
      var pts = p.top;
      for (var j = 0; j < pts.length - 1; j++) if (x <= pts[j + 1][0] + 0.01) { var q = (x - pts[j][0]) / Math.max(0.01, pts[j + 1][0] - pts[j][0]); return pts[j][1] + (pts[j + 1][1] - pts[j][1]) * clamp(q, 0, 1); }
      return pts[pts.length - 1][1];
    }
    return fl.y;
  }

  var PachinkoMischief = {
    attach: attach, live: null,
    RATES: RATES, SECTIONS: SECTIONS, EXITS: EXITS, HANDS: HANDS, LODE: LODE, REWARD: REWARD, CARTS: CARTS,
    planGame: planGame, wantTheft: wantTheft, exitFor: exitFor, doorReach: doorReach, nearDoor: nearDoor, theftAt: theftAt,
    releaseOf: releaseOf, rare: rare, whistleFor: whistleFor, hash: h3,
    seamOf: seamOf, seamY: seamY, crackOrigin: crackOrigin, cartAt: cartAt, floorTop: floorTop
  };
  root.PachinkoMischief = PachinkoMischief;
  if (typeof module !== 'undefined' && module.exports) module.exports = PachinkoMischief;
})(typeof window !== 'undefined' ? window : globalThis);

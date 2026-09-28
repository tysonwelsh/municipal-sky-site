/* MOTHER LODE — boot, input, the game, the cabinet API
 *
 * MotherLode.mount(container, opts) makes the canvas, runs the fixed-step
 * loop over the physics (pachinko-physics.js) and the layout
 * (pachinko-board.js), keeps the game (tokens in through Arcade core, scrip
 * out), owns the camera (the dive) and fills the `view` the renderer draws.
 *
 * THE GAME (PLAN §5, owner rulings §11)
 *   ATTRACT  the whole cabinet. The coin door's lamp blinks, the flip sign
 *            on its nail says INSERT TOKEN, the feed tube is full (13).
 *            Click the coin door (or your token stack on the ledge; keys
 *            Enter, C or space) → Arcade.tokens.spend(1, 'pachinko').
 *            An empty pocket: the door rattles, and a moment later the
 *            machine finds a nickel in its own coin return (WORLD.md): the
 *            pocket refills to 5 (flag pachinko.found-a-nickel).
 *   DIVE     the token clunks in, the sign flips to MODEL IN USE, and the
 *            camera pushes into the glass (DIVE_T, eased; crisp at rest).
 *   PLAY     tap the spot you want. A chalk ghost of the hopper follows the
 *            pointer over the glass; a click sends the hopper gliding along
 *            its rail (0.09–0.24 s by distance, a ratchet tick every 7 px)
 *            and it lets the marble go at exactly that x. It reloads from
 *            the feed tube in RELOAD s; a click while it is busy queues (one
 *            only; a newer click replaces it). 13 marbles a token; the game
 *            ends when the 13th resolves. Every win rolls the SCRIP drum
 *            counter on the right pillar, one mechanical tick per scrip, and
 *            lights the bay or pocket it came from. Keys: ←/→ nudge the
 *            ghost (shift: 1 px), space drops, M mutes.
 *   PAYOUT   a beat, the camera pulls back out, and the counter counts DOWN
 *            as pink scrip feeds out of the ticket mouth one ticket at a
 *            time; the strip is torn off and joins the fold of scrip on the
 *            ledge. The scrip is credited (Arcade.scrip.add) the moment the
 *            game ends, so a reload never loses it. Stats and flags here.
 *   WORK     the crew rebuild the board: 2–4 drift edits drawn by seed
 *            (PachinkoBoard.drawEdits), each validated in slices against
 *            the fairness gates (PachinkoBoard.validator, 300 drops) while
 *            the figures work, then carried out one by one; the feed tube
 *            refills. A placeholder performer until pachinko-knockers.js
 *            takes it over (PARTS, below). Then ATTRACT again.
 *
 * THE CAMERA. The renderer paints the whole cabinet (CAB_W × CAB_H) at 1:1
 * into an offscreen canvas; main blits a crop of it to the screen canvas in
 * device px. At rest the scale is an integer: sA (the whole cabinet) in
 * ATTRACT/WORK, sP (PLAY_RECT: the glass + 3 px, extended on the long axis)
 * in PLAY, and a smootherstep push between the two.
 *
 * ════════════════════════ THE RENDER CONTRACT ════════════════════════
 *   window.PachinkoRender = { GLASS_W 320, GLASS_H 416, CAB_W, CAB_H, GLASS_X,
 *     GLASS_Y, build(board), draw(ctx, view), coinRect(), tubeRect(), … }
 * view = {
 *   mode: 'attract' | 'dive' | 'play' | 'payout' | 'work',
 *   t,                       sim seconds (deterministic under ?harness=1)
 *   cam: {k, s, x, y, w, h}, k 0 whole cabinet … 1 dived (eased)
 *   board,                   the current layout (drifts between games)
 *   marbles: [{x, y, r, spin, id, phase, tunnel?, trail?}],
 *   hopper: {x, ghostX, loaded, speed, rattle, queued},
 *   figures: [],             knockers (empty → the renderer's still life)
 *   fx: {lights, dark, flare, extraLamps, bays, pockets, lode, …},
 *   hits: [{id, t, speed}],  contacts in the last 0.4 s (pins spark)
 *   score, marblesLeft,
 *   ui: {…}                  the machine's own dials (pachinko-art-counters.js):
 *                            tally {value, prev, roll, dir}, tokens, scrip,
 *                            sign {side, t0}, coin {t0}, tongue {n, t0, torn},
 *                            found, noTokens, tap, muted, hoverCoin
 * }
 * ═════════════════════════════════════════════════════════════════════
 *
 * EVENTS (opts.onEvent, handle.onEvent(fn) → unsubscribe, and
 * Arcade.emit('pachinko', ev)); every event has {type, t}:
 *   the physics' own, with `m` (marble id): drop {x} · pin {id, material,
 *     dress, speed, x, y} · rail {…} · roll {id, speed} · wheel {…} · clack
 *     {other, speed} · cart {what: catch|dump} · tunnel {what: in|out} ·
 *     pocket {id, value, legend} · slot {id, value, legend, x} · award {id,
 *     value} · knock {n, x, y} · teeter · ride · timeout · done {outcome}
 *   the game's: mode {mode} · coin {tokens} · nocoin · found {tokens} ·
 *     dive {dir: 1 in | -1 out} · glide {from, to, dur} · ratchet {x} ·
 *     release {x, n, left} · reload {left} · queue {x} · empty (a click with
 *     no marbles left) · win {value, total, source, x, y} · whistle {id} ·
 *     tally {value, dir} (one drum tick) · lode {x, n} · gameover {scrip,
 *     lodes, best} · ticket {n, left} · tear {n} · work {edits} · edit
 *     {edit, i} · feed {n} (a marble rattling back into the tube) ·
 *     glasstap · mute {muted} · rare {reward: null} (never, this build)
 *
 * PARTS (the later phases plug in here, no edits to this file needed):
 *   window.PachinkoKnockers / PachinkoMischief / PachinkoSpectacle, each
 *   {attach(api) → part}. api = {view, emit, on, now(), board(), world(),
 *   setBoard(b), stats(), flags}. A part may implement any of:
 *     step(t, dt)          every fixed step (120 Hz)
 *     gameStart(seed)      gameEnd(result)
 *     work(ctx) → {step(t) → true when done}   takes WORK over; ctx = {t0,
 *                          seed, board, plan (the drift planner: .done,
 *                          .accepted [{edit, board}]), apply(i), emit}
 *     lode(ctx) → {step(t) → true when done}   takes the 13 over
 *     figures(view) → [figure]                 the crew this frame
 *     fx(view)             add to view.fx after the game's own
 *     rare(ctx) → reward | false               the rare tier (a hook only)
 *     destroy()
 *
 * ?harness=1  no rAF loop: window.__pachinko.harness owns the clock:
 *             {stepTo(t), render(), coin(), request(x), drop(x) (a free
 *             marble, outside the count), play(xs), lode(), setMode(m),
 *             setBoard(b), world, state, events, view, canvas, cab}
 *             ?mode=attract|play|payout|work previews a state (harness only)
 * ?seed=N     the game seed (else derived from the save, per game)
 * ?debug=1    the debug view; ?debug=2 overlays it on the art
 */
(function (root) {
  'use strict';

  var FALLBACK = { GLASS_W: 320, GLASS_H: 416, CAB_W: 376, CAB_H: 560, GLASS_X: 28, GLASS_Y: 72 };
  var STEP = 1 / 120;
  var DIVE_T = 0.7;          // the push into the glass (and back out)
  var COIN_T = 0.55;         // the token down the chute and the clunk, before the dive
  var MARBLES = 13;          // a token's worth (owner ruling, the house number)
  var RELOAD = 0.35;         // the hopper's reload from the feed tube
  var GLIDE_MIN = 0.09, GLIDE_MAX = 0.24, GLIDE_FULL = 200, RATCHET_PX = 7;
  var END_BEAT = 0.9;        // the 13th resolves … the machine thinks … the camera pulls back
  var TICKET_T = 0.11, TICKET_ALL = 3.4, TEAR_HOLD = 0.55, AFTER_TEAR = 0.7;
  var WORK_MIN = 3.4, WORK_MAX = 9, EDIT_EVERY = 0.85, VAL_PER_STEP = 4, VAL_PAYOUT = 2, VAL_DROPS = 300;
  var FEED_EVERY = 0.07;     // the tube refilling, marble by marble
  var TALLY_T = 0.085, TALLY_FAST = 0.04, TALLY_ROLL = 0.07;
  var REFILL = 5, FIND_T = 1.6;
  var SEED0 = 1913;
  var MUTE_KEY = 'mother-lode.muted';
  var MODES = { attract: 1, dive: 1, play: 1, payout: 1, work: 1 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smooth(u) { return u * u * (3 - 2 * u); }
  function hashSeed(a, b) {
    var h = Math.imul((a | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x632be5ab, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
    return h | 0;
  }
  function parseForce(search) {
    var m = /[?&]force=([^&]*)/.exec(search || ''), f = {};
    if (!m) return f;
    decodeURIComponent(m[1]).split(',').forEach(function (kv) { var p = kv.split(':'); if (p[0]) f[p[0]] = p.length > 1 ? +p[1] : true; });
    return f;
  }

  function mount(container, opts) {
    opts = opts || {};
    var search = (root.location && root.location.search) || '';
    var HARNESS = !!opts.harness || /[?&]harness=1/.test(search);
    var dm = /[?&]debug=(\d)/.exec(search);
    var DEBUG = opts.debug != null ? opts.debug : dm ? +dm[1] : 0;
    var sm = /[?&]seed=(-?\d+)/.exec(search);
    var FIXED_SEED = opts.seed != null ? opts.seed | 0 : sm ? +sm[1] : null;
    var FORCE = HARNESS ? parseForce(search) : {};
    var A = root.Arcade || null;
    var FREE = !!opts.free || !A;
    var VERSION = (container.getAttribute && container.getAttribute('data-version') || 'dev').trim();

    var PB = root.PachinkoBoard, PP = root.PachinkoPhysics;
    // (the board or the physics didn't load: the machine is out of order, and says so)
    if (!PB || !PP || !PB.base || !PP.createWorld) {
      var ooo = document.createElement('p');
      ooo.className = 'pachinko-ooo';
      ooo.textContent = 'OUT OF ORDER. The attendant has been notified.';
      container.appendChild(ooo);
      if (root.console) console.warn('MOTHER LODE: pachinko-board.js or pachinko-physics.js did not load');
      return { VERSION: 'out-of-order', destroy: function () { ooo.remove(); }, pause: function () { }, resume: function () { }, getState: function () { return { mode: 'out-of-order' }; }, onEvent: function () { return function () { }; }, drop: function () { return false; } };
    }
    var R = root.PachinkoRender && typeof root.PachinkoRender.draw === 'function' ? root.PachinkoRender : null;
    var G = {};
    for (var fk in FALLBACK) G[fk] = FALLBACK[fk];
    if (R) { G.CAB_W = R.CAB_W | 0 || G.CAB_W; G.CAB_H = R.CAB_H | 0 || G.CAB_H; if (R.GLASS_X != null) G.GLASS_X = R.GLASS_X; if (R.GLASS_Y != null) G.GLASS_Y = R.GLASS_Y; }
    G.PLAY_RECT = (R && R.PLAY_RECT) || { x: G.GLASS_X, y: G.GLASS_Y - 3, w: G.GLASS_W, h: G.GLASS_H + 6 };
    var COIN = (R && R.coinRect) ? R.coinRect() : { x: 350, y: 300, w: 20, h: 44 };

    var board = PB.base();
    var renderOK = !!R;
    if (R && R.build) { try { R.build(board); } catch (e) { renderOK = false; warn('build', e); } }

    // the cabinet canvas (logical, 1:1) and the screen canvas (device px)
    var cab = document.createElement('canvas'); cab.width = G.CAB_W; cab.height = G.CAB_H;
    var cctx = cab.getContext('2d'); cctx.imageSmoothingEnabled = false;
    var canvas = document.createElement('canvas');
    canvas.className = 'pachinko-canvas';
    canvas.setAttribute('aria-label', 'MOTHER LODE, a pachinko machine. Put a token in the coin door on the right, then click where you want each marble to fall. Space drops, arrow keys aim, M mutes.');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    var ctx = canvas.getContext('2d');

    /* ── events ──────────────────────────────────────────────────── */
    var listeners = opts.onEvent ? [opts.onEvent] : [];
    var ring = [];
    var emitQ = [], emitting = false;
    function emit(ev) {
      if (ev.t == null) ev.t = simT;
      // (an edit landed: whoever carried it out, main knows it's set)
      if (ev.type === 'edit' && game && game.work) {
        if (ev.i != null && !ev.hurried) game.work.landed[ev.i] = true;
        if (ev.edit && ev.edit.type !== 'clear') game.alts.push({ edit: ev.edit, t0: simT });
      }
      emitQ.push(ev);
      if (emitting) return;
      emitting = true;
      try {
        while (emitQ.length) {
          var e = emitQ.shift();
          if (HARNESS) { ring.push(e); if (ring.length > 4000) ring.splice(0, 1000); }
          for (var i = 0; i < listeners.length; i++) { try { listeners[i](e); } catch (x) { if (root.console) console.error(x); } }
          if (A) A.emit('pachinko', e);
        }
      } finally { emitting = false; }
    }
    function subscribe(fn) {
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }

    /* ── state ───────────────────────────────────────────────────── */
    var simT = 0;
    var world = PP.createWorld(board, FIXED_SEED != null ? FIXED_SEED : SEED0);
    var game = {
      mode: 'attract', modeT0: 0, seed: FIXED_SEED != null ? FIXED_SEED : SEED0, games: 0,
      dropped: 0, resolved: 0, score: 0, lodes: 0, wins: 0, mine: {}, endAt: null,
      findAt: null, payout: null, work: null, lode: null, taps: [], lastWin: null,
      lastDropT: null, hintOn: false, credited: 0, owed: null, alts: [], playT0: null, diveDur: DIVE_T, near: {}, drift: {}, outAt: {}
    };
    var hopper = { x: 160, from: 160, to: 160, g0: -1, dur: 0, gliding: false, loaded: true, reloadAt: 0, queue: null, tickX: 160, speed: 0 };
    var tally = { value: 0, shown: 0, nextAt: 0, rollT0: -1, dir: 1, prev: 0 };
    var trails = {};

    function stats() {
      var s = A ? A.stats('pachinko') : {};
      if (s.games == null) { s.games = 0; s.best = 0; s.lifetimeScrip = 0; s.motherLodes = 0; }
      return s;
    }
    function tokensNow() { return A ? A.tokens.get() : null; }
    function scripNow() { return A ? A.scrip.get() : null; }

    var view = {
      mode: 'attract', t: 0, cam: { k: 0, s: 1, x: 0, y: 0, w: G.CAB_W, h: G.CAB_H }, board: board,
      marbles: [], hopper: { x: 160, ghostX: null, loaded: true, speed: 0, rattle: null, queued: null },
      figures: [], fx: {}, hits: [], score: 0, marblesLeft: MARBLES,
      ui: {
        tally: { value: 0, prev: 0, roll: 1, dir: 1 }, tokens: tokensNow(), scrip: scripNow(), scripHeld: 0,
        sign: { side: 'insert', t0: -10 }, coin: null, tongue: null, found: null, noTokens: null, tap: null,
        muted: false, hoverCoin: false, free: FREE, version: VERSION, best: 0, bestT0: null
      }
    };

    /* ── parts: knockers, mischief, spectacle (later phases) ─────── */
    var parts = [];
    var partApi = {
      view: view, emit: emit, on: subscribe, now: function () { return simT; },
      board: function () { return board; }, world: function () { return world; },
      setBoard: function (b) { setBoard(b); }, stats: stats, flags: A ? A.flags : null, game: game
    };
    ['PachinkoKnockers', 'PachinkoMischief', 'PachinkoSpectacle'].forEach(function (name) {
      var M = root[name];
      if (M && typeof M.attach === 'function') { try { var p = M.attach(partApi); if (p) { p.__name = name; parts.push(p); } } catch (e) { warn(name, e); } }
    });
    function partsCall(fn, a, b) { for (var i = 0; i < parts.length; i++) if (typeof parts[i][fn] === 'function') { try { parts[i][fn](a, b); } catch (e) { warn(parts[i].__name + '.' + fn, e); } } }
    function partsFirst(fn, a) {
      for (var i = 0; i < parts.length; i++) if (typeof parts[i][fn] === 'function') {
        try { var r = parts[i][fn](a); if (r) return r; } catch (e) { warn(parts[i].__name + '.' + fn, e); }
      }
      return null;
    }

    /* ── modes ───────────────────────────────────────────────────── */
    function setMode(m) {
      game.mode = m; view.mode = m; game.modeT0 = simT;
      var locked = m === 'dive' || m === 'play' || m === 'payout';
      document.documentElement.classList.toggle('pachinko-playing', locked);
      if (locked && !HARNESS && m === 'dive') {
        // don't lock the page with the machine half off-screen
        var r = container.getBoundingClientRect(), vh = root.innerHeight || 0;
        if (r.top < -1 || r.bottom > vh + 1) try { container.scrollIntoView({ block: 'end' }); } catch (e) { }
      }
      emit({ type: 'mode', mode: m });
    }
    function toAttract() {
      setMode('attract');
      view.figures = [];
      view.ui.sign = { side: game.owed ? 'credit' : 'insert', t0: view.ui.sign && view.ui.sign.side === 'insert' && !game.owed ? view.ui.sign.t0 : simT };
      view.ui.coinOpen = true; view.ui.work = false;
      view.marblesLeft = game.owed ? MARBLES - game.owed.dropped : MARBLES;
      hopper.loaded = true; hopper.queue = null;
      game.payout = null; game.work = null;
      if (A && !FREE && A.tokens.get() <= 0 && !game.owed) noTokens();
    }

    /* ── a game left open (a reload, a phone evicting the tab): the token
     *    isn't lost and neither is the scrip. Every win is credited to your
     *    pocket the moment it lands (the drum and the ledge still count it
     *    out at the end), and the game is saved as it goes; the next page
     *    starts in ATTRACT with the marbles still owed in the feed tube, and
     *    the coin door takes up the game again without a token. Marbles that
     *    were still on the glass come back. (HOLLER ROLLER's saveOpen, and its
     *    owner's rule: a reload starts the flow from the top.) ──────────── */
    function saveOpen() {
      if (!A) return;
      try {
        var st = stats();
        st.open = { v: 1, seed: game.seed | 0, dropped: game.resolved | 0, score: game.score | 0, credited: game.credited | 0, lodes: game.lodes | 0 };
        A.persist();
      } catch (e) { }
    }
    function clearOpen() {
      if (!A) return;
      try { var st = stats(); if (st.open) { delete st.open; A.persist(); } } catch (e) { }
    }

    /* ── the start ───────────────────────────────────────────────── */
    function insertCoin() {
      if (game.mode === 'work') {
        // a player who wants the next game doesn't wait on the crew (but an
        // empty pocket doesn't stop them either: the door just rattles)
        if (!game.owed && !FREE && A.tokens.get() <= 0) { noTokens(); emit({ type: 'nocoin' }); return false; }
        finishWork();
      }
      if (game.mode !== 'attract') return false;
      if (game.owed) { resumeGame(game.owed); return true; }
      if (!FREE && !A.tokens.spend(1, 'pachinko')) { noTokens(); emit({ type: 'nocoin' }); return false; }
      view.ui.tokens = tokensNow();
      view.ui.coin = { t0: simT };
      game.findAt = null; view.ui.noTokens = null;
      emit({ type: 'coin', tokens: tokensNow() });
      startGame();
      return true;
    }
    function noTokens() {
      view.ui.noTokens = simT;
      if (game.findAt == null) game.findAt = simT + FIND_T;
    }
    function findNickel() {
      game.findAt = null;
      if (!A || FREE || A.tokens.get() > 0) return;
      A.tokens.add(REFILL, 'pachinko-return');
      A.flags.set('pachinko.found-a-nickel');
      view.ui.found = { t0: simT, n: REFILL };
      view.ui.tokens = tokensNow();
      emit({ type: 'found', tokens: tokensNow() });
    }
    function newGameSeed() {
      if (FIXED_SEED != null) return hashSeed(FIXED_SEED, game.games);
      var st = stats();
      return hashSeed(SEED0 * 1000003 + (st.games | 0) * 7919 + (st.lifetimeScrip | 0), game.games);
    }
    function startGame(resume) {
      game.games++;
      game.seed = resume ? resume.seed | 0 : newGameSeed();
      world = PP.createWorld(board, game.seed);
      world.t = simT;
      game.dropped = 0; game.resolved = 0; game.score = 0; game.lodes = 0; game.wins = 0; game.mine = {}; game.credited = 0; game.near = {}; game.drift = {}; game.outAt = {};
      game.endAt = null; game.lode = null; game.lastWin = null; game.lastDropT = null; game.tallyHold = 0;
      tally.value = 0; tally.shown = 0; tally.prev = 0; tally.rollT0 = -1;
      trails = {};
      view.score = 0; view.marblesLeft = MARBLES; view.fx = {};
      view.ui.tongue = null; view.ui.scripHeld = 0;
      hopper.loaded = true; hopper.queue = null; hopper.gliding = false; hopper.reloadAt = 0;
      if (resume) {
        game.dropped = game.resolved = clamp(resume.dropped | 0, 0, MARBLES - 1);
        game.score = resume.score | 0; game.credited = resume.credited | 0; game.lodes = resume.lodes | 0;
        tally.value = tally.shown = tally.prev = game.score;
        view.score = game.score; view.marblesLeft = MARBLES - game.dropped;
        view.ui.scripHeld = game.credited;
      }
      game.owed = null;
      view.ui.sign = { side: 'inuse', t0: simT + 0.12 };
      view.ui.coinOpen = false; view.ui.work = false;
      // (a coin during WORK: the camera is in already; no second push)
      var inAlready = camK() >= 0.999;
      setMode('dive');
      game.modeT0 = simT + COIN_T;           // the camera waits for the clunk
      game.diveDur = inAlready ? 0.2 : DIVE_T;
      camGo(1, simT + COIN_T);
      game.diveOut = inAlready;
      partsCall('gameStart', game.seed, { resumed: resume ? game.dropped : 0 });
      saveOpen();
    }
    function resumeGame(o) {
      view.ui.coin = { t0: simT };
      game.findAt = null; view.ui.noTokens = null;
      emit({ type: 'resume', dropped: o.dropped | 0, score: o.score | 0 });
      startGame(o);
    }

    /* ── the hopper: tap the spot you want ───────────────────────── */
    function committed() { return game.dropped + (hopper.gliding ? 1 : 0); }
    function requestDrop(x) {
      // (during the coin's clunk and the push into the glass a click is held,
      // and the hopper goes there the moment the game is under way)
      if (game.mode === 'dive') {
        hopper.queue = clamp(Math.round(x * 2) / 2, board.drop.x0, board.drop.x1);
        emit({ type: 'queue', x: hopper.queue });
        return true;
      }
      if (game.mode !== 'play') return false;
      x = clamp(Math.round(x * 2) / 2, board.drop.x0, board.drop.x1);
      if (committed() >= MARBLES) {
        hopper.queue = null;
        view.hopper.rattle = simT;
        emit({ type: 'empty' });
        return false;
      }
      if (hopper.gliding || !hopper.loaded) {
        hopper.queue = x;
        emit({ type: 'queue', x: x });
        return true;
      }
      startGlide(x);
      return true;
    }
    function startGlide(x) {
      var dx = x - hopper.x;
      if (Math.abs(dx) < 1.5) { hopper.x = x; release(x); return; }
      hopper.from = hopper.x; hopper.to = x; hopper.g0 = simT;
      hopper.dur = GLIDE_MIN + (GLIDE_MAX - GLIDE_MIN) * Math.min(1, Math.abs(dx) / GLIDE_FULL);
      hopper.gliding = true; hopper.tickX = hopper.x;
      emit({ type: 'hopper', x: x, from: hopper.from, glide: hopper.dur });
      emit({ type: 'glide', from: hopper.from, to: x, dur: hopper.dur });
    }
    function stepHopper() {
      var x0 = hopper.x;
      if (hopper.gliding) {
        var u = clamp((simT - hopper.g0) / hopper.dur, 0, 1);
        hopper.x = hopper.from + (hopper.to - hopper.from) * smooth(u);
        // the trolley's ratchet: a tick every RATCHET_PX of rail
        if (Math.abs(hopper.x - hopper.tickX) >= RATCHET_PX) {
          hopper.tickX += RATCHET_PX * (hopper.x > hopper.tickX ? 1 : -1);
          emit({ type: 'ratchet', x: hopper.tickX });
        }
        if (u >= 1) { hopper.gliding = false; hopper.x = hopper.to; release(hopper.to); }
      }
      hopper.speed = (hopper.x - x0) / STEP;
      if (!hopper.loaded && !hopper.gliding && simT >= hopper.reloadAt && game.mode === 'play') {
        if (game.dropped < MARBLES) {
          hopper.loaded = true;
          emit({ type: 'reload', left: MARBLES - game.dropped });
          if (hopper.queue != null) { var q = hopper.queue; hopper.queue = null; startGlide(q); }
        } else hopper.queue = null;
      }
    }
    function release(x) {
      var m = PP.addMarble(world, x);
      game.mine[m.id] = true;
      game.dropped++; game.lastDropT = simT;
      view.marblesLeft = MARBLES - game.dropped;
      hopper.loaded = false; hopper.reloadAt = simT + RELOAD;
      emit({ type: 'release', x: x, n: game.dropped, left: MARBLES - game.dropped, m: m.id });
      saveOpen();
      return m;
    }

    /* ── the chalk on the glass: how to play, for a first game or a
     *    player who has stopped ─────────────────────────────────────── */
    function stepHint() {
      var on = false;
      if (game.mode === 'play' && game.dropped < MARBLES && !hopper.gliding && hopper.queue == null) {
        if (game.dropped === 0) on = game.games <= 1 || simT - game.modeT0 > 4;
        else on = simT - game.lastDropT > 9;
      }
      if (on !== game.hintOn) { game.hintOn = on; view.ui.hint = { on: on, t0: simT }; }
    }

    /* ── wins, the tally, the lode ───────────────────────────────── */
    function win(value, source, e) {
      if (!(value > 0)) return;
      game.score += value; game.wins++;
      // (into your pocket now: a reload can't lose it; the drum still counts it out)
      if (A) { A.scrip.add(value, 'pachinko'); game.credited += value; view.ui.scripHeld = game.credited; }
      view.score = game.score;
      tally.value = game.score;
      game.lastWin = { t: simT, value: value, source: source };
      emit({ type: 'win', value: value, total: game.score, source: source, id: e.id, x: e.x, y: e.y, m: e.m });
    }
    function stepTally() {
      // (the lode rolls its 13 on a tick at a time with the coins: held back until then)
      var target = tally.value - (game.mode === 'play' || game.mode === 'dive' ? (game.tallyHold | 0) : 0);
      if (tally.shown === target || simT < tally.nextAt) return;
      var dir = target > tally.shown ? 1 : -1, behind = Math.abs(target - tally.shown);
      tally.prev = tally.shown; tally.shown += dir; tally.dir = dir; tally.rollT0 = simT;
      tally.nextAt = simT + (behind > 5 ? TALLY_FAST : TALLY_T);
      emit({ type: 'tally', value: tally.shown, dir: dir });
    }
    function startLode(e) {
      game.lodes++;
      if (A) A.flags.set('pachinko.struck-the-lode');
      emit({ type: 'lode', x: e.x, n: game.lodes, m: e.m });
      var ctxL = { t0: simT, x: e.x, emit: emit, view: view, board: board, holdTally: function (n) { game.tallyHold = Math.max(0, n | 0); } };
      var takeover = partsFirst('lode', ctxL);
      game.lode = { t0: simT, part: takeover, cheered: takeover ? 2 : 0, taken: !!takeover };
    }

    /* ── physics events → the game ───────────────────────────────── */
    var LIT_BY = { slot: 'bays', pocket: 'pockets' };
    // the ore knobs either side of the 13's cup: a marble that rattles them
    // and doesn't go in is a near miss (the crew groan, the tallyman marks it)
    var NEAR_IDS = { 'guard.l': 1, 'guard.r': 1, 'guard.top': 1 };
    function onPhysics(e) {
      if (e.type === 'pin' || e.type === 'rail' || e.type === 'wheel') view.hits.push({ id: e.id, t: e.t, speed: e.speed, x: e.x, y: e.y });
      if (e.m != null && game.mine[e.m]) {
        if ((e.type === 'pin' || e.type === 'teeter') && NEAR_IDS[e.id]) game.near[e.m] = true;
        if (e.type === 'tunnel' && e.what === 'out' && e.id === 'tunnel.drift') game.drift[e.m] = true;
        if (e.type === 'tunnel' && e.what === 'out') game.outAt[e.m] = e.t;
        if (e.type === 'slot' && !(e.value >= 13) && game.near[e.m]) emit({ type: 'nearmiss', m: e.m, slot: e.id, x: e.x, value: e.value, drift: !!game.drift[e.m] });
      }
      if (e.type === 'slot' || e.type === 'pocket') {
        var bag = view.fx[LIT_BY[e.type]] || (view.fx[LIT_BY[e.type]] = {});
        bag[e.id] = { t0: simT, value: e.value };
        if (e.type === 'slot' && e.value >= 13) { win(e.value, 'lode', e); startLode(e); }
        else win(e.value, e.type, e);
        if (e.type === 'pocket') emit({ type: 'whistle', id: e.id, value: e.value });
      } else if (e.type === 'award') {
        var cb = view.fx.awards || (view.fx.awards = {});
        cb[e.id] = { t0: simT, value: e.value };
        win(e.value, 'award', e);
      } else if (e.type === 'done' && game.mine[e.m]) {
        game.resolved++;
        saveOpen();
        delete trails[e.m];
        if (game.resolved >= MARBLES && game.mode === 'play' && game.endAt == null) game.endAt = simT + END_BEAT;
      }
    }

    /* ── the end, the payout ─────────────────────────────────────── */
    function gameOver() {
      game.endAt = null; game.tallyHold = 0;
      var n = game.score, prevBest = stats().best || 0, best = false;
      if (A) {
        if (n > game.credited) A.scrip.add(n - game.credited, 'pachinko');    // (the wins went in as they landed)
        game.credited = n;
        var st = stats();
        delete st.open;
        st.games++; st.best = Math.max(st.best || 0, n); st.lifetimeScrip = (st.lifetimeScrip | 0) + n;
        st.motherLodes = (st.motherLodes | 0) + game.lodes;
        best = n > prevBest && n > 0;
        A.persist();
      }
      view.ui.scripHeld = n;        // on the tongue, not yet on the ledge
      view.ui.scrip = scripNow();
      emit({ type: 'gameover', scrip: n, lodes: game.lodes, best: best, dropped: game.dropped });
      partsCall('gameEnd', { scrip: n, lodes: game.lodes });
      var reward = partsFirst('rare', { scrip: n, lodes: game.lodes, seed: game.seed });
      if (reward) emit({ type: 'rare', reward: reward });
      setMode('payout');
      // the count happens dived in (the SCRIP counter, the ticket mouth and
      // the strip are all in the play framing), then the camera pulls back
      var per = n > 0 ? Math.min(TICKET_T, TICKET_ALL / n) : 0;
      // nothing won: the machine issues a slip anyway, stamped NIL
      game.payout = { n: n, paid: 0, per: per, nextAt: simT + 0.25, tearAt: n ? null : simT + 1.5, backAt: null, backT0: null, doneAt: null, fast: false };
      view.ui.tongue = n ? { n: 0, t0: simT + 0.25, torn: null } : { n: 0, nil: true, t0: simT + 0.35, torn: null };
      if (best) { view.ui.bestPrev = prevBest | 0; view.ui.bestT0 = simT + 0.6; }
      view.ui.best = stats().best | 0;
      // the crew's plan for the next shift starts now, while the scrip is
      // counted out (the board can't change in PAYOUT): WORK opens with it
      // done or nearly (wave 5c: its first 1.5 s used to stutter)
      game.plan = beginPlan();
    }
    function beginPlan() {
      // a cave-in this game: the crew dig it out first, and the drift is planned on the cleared board
      var b0 = board, pre = [];
      (board.caveins || []).forEach(function (cv) { b0 = PB.clearCave(b0, cv.id); pre.push({ edit: { type: 'clear', id: cv.id }, board: b0 }); });
      return { board: board, plan: planDrift(b0, hashSeed(game.seed, 77), pre) };
    }
    function stepPayout() {
      var p = game.payout; if (!p) return;
      if (game.plan && !game.plan.plan.done) game.plan.plan.step(VAL_PAYOUT);
      if (p.paid < p.n && simT >= p.nextAt) {
        p.paid++;
        tally.value = p.n - p.paid;
        view.ui.tongue.n = p.paid;
        emit({ type: 'ticket', n: p.paid, left: p.n - p.paid });
        emit({ type: 'payout', n: p.paid, total: p.n });
        p.nextAt += p.fast ? Math.min(p.per, 0.03) : p.per;
        if (p.paid >= p.n) p.tearAt = simT + TEAR_HOLD;
      }
      if (p.tearAt != null && simT >= p.tearAt) {
        p.tearAt = null;
        view.ui.tongue.torn = simT;
        view.ui.scripHeld = 0;
        emit({ type: 'tear', n: p.n, nil: !p.n });
        p.backAt = simT + AFTER_TEAR;
      }
      // (the crew's WORK is watched from here, dived in: you see what they
      // change. The camera pulls back when they're done: wave 5c)
      if (p.backAt != null && simT >= p.backAt && tally.shown === tally.value) { p.backAt = null; startWork(); }
    }

    /* ── WORK: the crew rebuild the board ────────────────────────── */
    // the drift planner: draw candidate edits by seed, validate each (on top
    // of the ones already accepted) in slices, keep the ones that pass
    // `pre`: jobs that come first and need no validating (a cave-in dug out);
    // `b` is the board as it will be after them
    function planDrift(b, seed, pre) {
      pre = pre || [];
      // one or two a shift, now and then three: fewer and bigger, so you can
      // see what they changed (wave 5c; it was two to four 1–3 px nudges)
      var hw = PB.hash01(seed, 4242), want = hw < 0.45 ? 1 : hw < 0.9 ? 2 : 3;
      var cands = PB.drawEdits(b, seed, want * 4, 0);
      var plan = { want: want + pre.length, cands: cands, ci: 0, cur: b, accepted: pre.slice(), rejected: [], v: null, cand: null, done: false };
      plan.step = function (k) {
        while (k > 0 && !plan.done) {
          if (!plan.v) {
            if (plan.accepted.length >= plan.want || plan.ci >= plan.cands.length) { plan.done = true; break; }
            var e = plan.cands[plan.ci++];
            plan.cand = { edit: e, board: PB.applyEdit(plan.cur, e) };
            plan.v = PB.validator(plan.cand.board, PP, { drops: VAL_DROPS, seed: hashSeed(seed, plan.ci) });
          }
          var n = Math.min(k, 10);
          k -= n;
          if (plan.v.step(n)) {
            if (plan.v.result.ok) { plan.accepted.push(plan.cand); plan.cur = plan.cand.board; }
            else plan.rejected.push({ edit: plan.cand.edit, reasons: plan.v.result.reasons });
            plan.v = null; plan.cand = null;
          }
        }
        return plan.done;
      };
      return plan;
    }
    function startWork() {
      game.payout = null;
      setMode('work');
      view.ui.tongue = null;
      game.alts = [];
      // the card flips back: the machine takes a token while the crew work
      view.ui.sign = { side: 'insert', t0: simT }; view.ui.coinOpen = true; view.ui.work = true;
      if (!game.plan || game.plan.board !== board) game.plan = beginPlan();
      var w = game.work = { t0: simT, plan: game.plan.plan, applied: 0, landed: {}, nextEditAt: simT + 1.0, feedAt: simT + 0.6, fed: 0, performer: null, emitted: false };
      game.plan = null;
      view.marblesLeft = 0;
      var ctxW = {
        t0: simT, seed: game.seed, board: board, plan: w.plan, emit: emit, view: view,
        apply: function (i) { return applyPlanned(i); }
      };
      w.performer = partsFirst('work', ctxW);
      emit({ type: 'work', edits: [], what: 'start' });
    }
    // stop the crew: whatever has passed validation is set at once (one
    // rebuild), whatever hasn't is dropped, the tube is full
    function finishWork() {
      var w = game.work; if (!w) return;
      if (w.performer && w.performer.finish) { try { w.performer.finish(); } catch (e) { warn('work.finish', e); } }
      var acc = w.plan.accepted, rest = 0;
      // (only the ones not already set: the knockers land theirs in any order)
      for (var i = 0; i < acc.length; i++) if (!w.landed[i]) { rest++; emit({ type: 'edit', edit: acc[i].edit, i: i, hurried: true }); }
      if (rest) { setBoard(acc[acc.length - 1].board); w.applied = acc.length; }
      view.marblesLeft = MARBLES;
      toAttract();
    }
    function applyPlanned(i) {
      var w = game.work; if (!w) return null;
      var a = w.plan.accepted[i]; if (!a) return null;
      setBoard(a.board);
      w.applied = Math.max(w.applied, i + 1);
      emit({ type: 'edit', edit: a.edit, i: i });
      return a.edit;
    }
    function stepWork() {
      var w = game.work; if (!w) return;
      if (!w.plan.done) w.plan.step(VAL_PER_STEP);
      if (w.plan.done && !w.emitted) { w.emitted = true; emit({ type: 'workplan', edits: w.plan.accepted.map(function (a) { return a.edit; }), rejected: w.plan.rejected.length }); }
      // the feed tube refills while they work
      if (w.fed < MARBLES && simT >= w.feedAt) { w.fed++; view.marblesLeft = w.fed; w.feedAt = simT + FEED_EVERY; emit({ type: 'feed', n: w.fed }); }
      var done;
      if (w.performer) {
        done = !!w.performer.step(simT);
      } else {
        // the placeholder performer: an edit carried out every EDIT_EVERY s once validated
        if (w.applied < w.plan.accepted.length && simT >= w.nextEditAt) {
          var a = w.plan.accepted[w.applied];
          var f = a.board.byId[a.edit.id];
          if (f) {
            var fx = f.x != null ? f.x : (f.x1 + f.x2) / 2, fy = f.y != null ? f.y : (f.y1 + f.y2) / 2;
            if (f.kind === 'tunnel') { fx = f.a.x; fy = f.a.y; }
            emit({ type: 'figure', what: 'set', x: fx, y: fy });
            view.hits.push({ id: a.edit.id, t: simT, speed: 120, x: fx, y: fy });
          }
          applyPlanned(w.applied);
          w.nextEditAt = simT + EDIT_EVERY;
        }
        done = w.plan.done && w.applied >= w.plan.accepted.length && simT - w.t0 >= WORK_MIN && w.fed >= MARBLES;
        view.figures = workFigures(simT - w.t0);
        // the placeholder crew's mallets: a tap on each down-stroke
        var beat = Math.floor((simT - w.t0) * 4);
        if (beat !== w.beat) {
          w.beat = beat;
          view.figures.forEach(function (f, i) {
            if ((f.tool === 'pick' || f.tool === 'shovel') && Math.floor((simT - w.t0) * 4 + i * 1.7) % 2 === 1 && (beat + i) % 3 === 0) emit({ type: 'figure', what: 'tap', x: f.x, y: f.y, who: f.who });
          });
        }
      }
      if (simT - w.t0 > WORK_MAX + (w.performer ? 6 : 0)) done = true;   // never stuck
      if (done) {
        // whatever passed validation but wasn't carried out is dropped
        view.marblesLeft = MARBLES;
        toAttract();
        // …and the camera pulls back to the whole cabinet
        camGo(0, simT);
        emit({ type: 'dive', dir: -1 });
      }
    }
    // the placeholder: the still-life crew at work in stop motion (the
    // knockers phase replaces this with the real jobs)
    function workFigures(u) {
      if (!R || !R.stillLife || !R.POSES) return [];
      var base = R.stillLife() || [], P = R.POSES, out = [];
      for (var i = 0; i < base.length; i++) {
        var f = base[i], g = {}; for (var k in f) g[k] = f[k];
        var beat = Math.floor(u * 4 + i * 1.7);
        if (f.tool === 'pick' || f.tool === 'shovel') g.pose = beat % 2 ? P.swingDn : P.swingUp;
        else if (f.tool === 'cane' || f.tool === 'tally') g.pose = beat % 3 === 0 ? P.point : f.pose;
        else g.pose = beat % 4 === 1 ? P.hold : f.pose;
        out.push(g);
      }
      return out;
    }
    function setBoard(b) {
      board = b; view.board = b;
      if (renderOK && R.build) { try { R.build(b); } catch (e) { renderOK = false; warn('build', e); } }
      // a fresh world on the new layout, on the same clock (no marbles are in play in WORK)
      var live = world.marbles.filter(function (m) { return !m.done; });
      if (!live.length && game.mode !== 'play' && game.mode !== 'dive') { world = PP.createWorld(b, game.seed); world.t = simT; }
      // mid-game (a cave-in): the marbles stay put and the static hash is rebuilt, so the rubble collides
      else if (PP.setBoard) PP.setBoard(world, b); else world.board = b;
    }

    /* ── the fixed step ──────────────────────────────────────────── */
    function stepGame() {
      if (game.mode === 'dive' && !game.diveOut && simT >= game.modeT0) { game.diveOut = true; emit({ type: 'dive', dir: 1 }); }
      if (game.mode === 'dive' && simT - game.modeT0 >= game.diveDur) {
        setMode('play');
        game.playT0 = simT;
        // a click (or Space) held from the dive: the hopper sets off at once
        if (hopper.queue != null && hopper.loaded && !hopper.gliding) { var q0 = hopper.queue; hopper.queue = null; startGlide(q0); }
      }
      if (game.mode === 'play') stepHopper();
      stepHint();
      stepTally();
      // (the mother lode plays out before the machine counts up: the game ends after it)
      if (game.endAt != null && simT >= game.endAt && !(game.lode && game.lode.part && game.lode.part.busy && game.lode.part.busy(simT))) gameOver();
      if (game.mode === 'payout') stepPayout();
      if (game.mode === 'work') stepWork();
      if (game.findAt != null && simT >= game.findAt) findNickel();
      if (game.lode && game.lode.part && game.lode.part.step(simT)) { game.lode.part = null; if (game.lode.taken) game.lode = null; }
      // (main's own fallback lode, when no part takes the 13: over after 4.2 s, in the sim)
      if (game.lode && !game.lode.part && !game.lode.taken && simT - game.lode.t0 > 4.2) game.lode = null;
      // the placeholder crew cheer the 13 (twice, toy voices)
      if (game.lode && !game.lode.part && game.lode.cheered < 2 && simT - game.lode.t0 > 0.5 + game.lode.cheered * 1.1 && R && R.stillLife) {
        var fg = (R.stillLife() || [])[game.lode.cheered * 3 % 6];
        game.lode.cheered++;
        if (fg) emit({ type: 'figure', what: 'cheer', x: fg.x, y: fg.y, who: fg.who });
      }
      partsCall('step', simT, STEP);
    }
    function advance(t) {
      while (simT + STEP <= t + 1e-9) {
        simT += STEP;
        PP.stepWorld(world, STEP);
        var evs = world.events;
        for (var i = 0; i < evs.length; i++) { var e = evs[i]; onPhysics(e); emit(e); }
        evs.length = 0;
        stepGame();
        // trails: the last few places each marble was, sampled at 60 Hz
        if (Math.round(simT / STEP) % 2 === 0) {
          for (var j = 0; j < world.marbles.length; j++) {
            var m = world.marbles[j];
            if (m.done || m.phase === 'tunnel' || m.phase === 'cart' || m.phase === 'pocket') { delete trails[m.id]; continue; }
            var tr = trails[m.id] || (trails[m.id] = []);
            tr.push(m.x, m.y); if (tr.length > 10) tr.splice(0, 2);
          }
        }
      }
      view.t = simT;
      while (view.hits.length && view.t - view.hits[0].t > 0.4) view.hits.shift();
      if (world.marbles.length > 40) world.marbles = world.marbles.filter(function (m) { return !m.done || view.t - m.tDone < 1; });
    }

    /* ── the fit and the camera ──────────────────────────────────── */
    var devW = 1, devH = 1, sA = 1, sP = 1, fitKey = '';
    var MQ = (R && root.PachinkoArt && root.PachinkoArt.CAB && root.PachinkoArt.CAB.marquee) || { y0: 20, y1: 66 };
    var PANEL_Y = 494;                         // the lower panel's top rim (the figures card, the plates below it)
    var FRAC_MIN = 1.35;                       // the least a fractional PLAY scale may be (orchestrator's ruling)
    function fit() {
      var dpr = root.devicePixelRatio || 1;
      var w = Math.max(1, Math.round(container.clientWidth * dpr)), h = Math.max(1, Math.round(container.clientHeight * dpr));
      // (reassigning the canvas size blanks it: only when it really changed, and paint straight away)
      var key = w + 'x' + h + '@' + dpr;
      if (key === fitKey) return;
      fitKey = key; devW = w; devH = h;
      canvas.width = devW; canvas.height = devH;
      canvas.style.width = (devW / dpr) + 'px'; canvas.style.height = (devH / dpr) + 'px';
      sA = Math.max(1, Math.floor(Math.min(devW / G.CAB_W, devH / G.CAB_H)));
      var fitP = Math.min(devW / G.PLAY_RECT.w, devH / G.PLAY_RECT.h);
      sP = Math.max(sA, Math.floor(fitP));
      // a common 1× laptop (1366 × 768, 1280 × 720) would never dive: the glass
      // stays a postage stamp at 1:1. There (only), PLAY takes a fractional
      // nearest-neighbour scale: a slightly uneven pixel beats no dive
      // (orchestrator's ruling, wave 5c). Everywhere else, integers.
      if (sP === 1 && fitP >= FRAC_MIN) sP = Math.floor(fitP * 16) / 16;
      ctx.imageSmoothingEnabled = false;
      carpetCache = null;
      if (booted) render();
    }
    // the camera's push in and pull back: a tween of the dive progress k
    // (0 the whole cabinet, 1 the glass), so a game can start from a camera
    // that's already in (a coin during WORK) without jumping out and back
    var camT = { from: 0, to: 0, t0: 0, dur: DIVE_T };
    function camGo(to, t0) { camT = { from: camK(), to: to, t0: t0 == null ? simT : t0, dur: DIVE_T }; }
    function camK() {
      var u = clamp((simT - camT.t0) / camT.dur, 0, 1);
      return camT.from + (camT.to - camT.from) * u;
    }
    // where the crop's top edge goes, dived in: the glass whole; the marquee
    // all or none (never sliced through its lettering); the lower panel all
    // or none (never through the figures card's type) — the nearest to
    // centred that keeps all three rules; the spare goes to the room
    function playTop(hP) {
      var PR = G.PLAY_RECT, c0 = PR.y + PR.h / 2 - hP / 2, gTop = PR.y, gBot = PR.y + PR.h;
      function ok(t) {
        var b = t + hP;
        if (t > gTop + 0.01 || b < gBot - 0.01) return false;                       // the glass, whole
        if (t > MQ.y0 - 2 + 0.01 && t < MQ.y1 - 1 - 0.01) return false;             // the marquee, whole or none
        if (b > PANEL_Y + 0.01 && b < G.CAB_H - 0.01) return false;                 // the panel, whole or none
        return true;
      }
      var cands = [c0, MQ.y0 - 2, MQ.y1 - 1, G.CAB_H - hP, PANEL_Y - hP, gTop, gBot - hP], best = null;
      cands.forEach(function (t) { if (ok(t) && (best == null || Math.abs(t - c0) < Math.abs(best - c0))) best = t; });
      if (best != null) return best;
      // a small screen: show the marquee's bottom frame (its bulbs, no
      // lettering) rather than slice the figures card through its title
      var t2 = PANEL_Y + 3 - hP;
      if (t2 <= gTop + 0.01 && t2 + hP >= gBot - 0.01 && t2 >= MQ.y1 - 9) return t2;
      // too short for the rules: the marquee all or none, as before
      var t = c0;
      if (t > MQ.y0 - 2 && t < MQ.y1 - 1) t = hP >= gBot - (MQ.y0 - 2) ? MQ.y0 - 2 : MQ.y1 - 1;
      return t;
    }
    // the crop rect (cabinet px) and the scale for a dive progress k
    function camera(k) {
      var e = k <= 0 ? 0 : k >= 1 ? 1 : k * k * k * (k * (k * 6 - 15) + 10);   // smootherstep
      // interpolate the zoom in log space so the push feels even
      var s = Math.exp(Math.log(sA) + (Math.log(sP) - Math.log(sA)) * e);
      if (e === 0) s = sA; if (e === 1) s = sP;
      var w = devW / s, h = devH / s;
      var cxA = G.CAB_W / 2, cyA = G.CAB_H / 2, PR = G.PLAY_RECT;
      var cxP = PR.x + PR.w / 2;
      var hP = devH / sP, cyP = playTop(hP) + hP / 2;
      var cx = cxA + (cxP - cxA) * e, cy = cyA + (cyP - cyA) * e;
      var c = { k: e, s: s, x: cx - w / 2, y: cy - h / 2, w: w, h: h };
      if (e === 0 || e === 1) {  // at rest: land the crop on whole device pixels
        c.x = Math.round(c.x * s) / s; c.y = Math.round(c.y * s) / s;
      }
      // the mother lode: the camera steps back to take in the marquee too
      // (view.fx.camOut 0..1, eased by the part). It holds its climax for
      // two seconds, so it lands on a whole scale (a crisp pixel), and eases
      // between the two whole scales on the way (visual critic, wave 5)
      var co = e === 1 && view.fx ? view.fx.camOut || 0 : 0;
      if (co > 0) {
        var top = MQ.y0 - 3, bot = PR.y + PR.h, s2 = Math.max(1, Math.floor(Math.min(devH / (bot - top), devW / (PR.w + 16))));
        if (s2 < c.s) {
          var sC = co >= 1 ? s2 : Math.exp(Math.log(c.s) + (Math.log(s2) - Math.log(c.s)) * co), w2 = devW / sC, h2 = devH / sC;
          var cyC = c.y + c.h / 2, cy2 = cyC + ((top + bot) / 2 - cyC) * co, cx2 = c.x + c.w / 2;
          c = { k: 1, s: sC, x: cx2 - w2 / 2, y: cy2 - h2 / 2, w: w2, h: h2, out: co };
          if (co >= 1) { c.x = Math.round(c.x * sC) / sC; c.y = Math.round(c.y * sC) / sC; c.rest = true; }
        }
      }
      return c;
    }

    /* ── input ───────────────────────────────────────────────────── */
    function toCab(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var dpr = root.devicePixelRatio || 1;
      var c = camera(camK());
      var px = (clientX - rect.left) * dpr, py = (clientY - rect.top) * dpr;
      return { x: c.x + px / c.s, y: c.y + py / c.s };
    }
    // the till: the pilot bulb, the INSERT TOKEN card, the coin door and
    // your pocket's readout under it all start a game
    function onCoin(p) {
      return p.x >= COIN.x - 5 && p.x <= COIN.x + COIN.w + 5 && p.y >= COIN.y - 54 && p.y <= COIN.y + COIN.h + 26;
    }
    function onLedgeTokens(p) {
      var L = R && R.ledgeTokens ? R.ledgeTokens() : null;
      return L && p.x >= L.x - 3 && p.x <= L.x + L.w + 3 && p.y >= L.y - 3 && p.y <= L.y + L.h + 3;
    }
    function inGlass(p, padX, padTop, padBot) {
      var gx = p.x - G.GLASS_X, gy = p.y - G.GLASS_Y;
      return gx >= -padX && gx <= G.GLASS_W + padX && gy >= -padTop && gy <= G.GLASS_H + padBot;
    }
    var pointerIn = false;
    function onMove(ev) {
      pointerIn = true;
      var p = toCab(ev.clientX, ev.clientY);
      var gx = p.x - G.GLASS_X;
      if (game.mode === 'play' || game.mode === 'dive') {
        view.hopper.ghostX = inGlass(p, 6, 30, 0) ? clamp(gx, board.drop.x0, board.drop.x1) : null;
        canvas.style.cursor = view.hopper.ghostX != null ? 'crosshair' : 'default';
        view.ui.hoverCoin = false;
      } else {
        view.hopper.ghostX = null;
        var hc = (game.mode === 'attract' || game.mode === 'work') && (onCoin(p) || onLedgeTokens(p));
        view.ui.hoverCoin = hc;
        canvas.style.cursor = hc ? 'pointer' : 'default';
      }
    }
    function onLeave() { pointerIn = false; view.hopper.ghostX = null; view.ui.hoverCoin = false; }
    function onDown(ev) {
      if (ev.button != null && ev.button > 0) return;
      container.classList.remove('pachinko-kbd');       // a mouse or a finger: no focus ring
      try { canvas.focus({ preventScroll: true, focusVisible: false }); } catch (e) { }
      emit({ type: 'input', kind: 'pointer' });
      var p = toCab(ev.clientX, ev.clientY);
      pointerDown(p, ev.pointerType || 'mouse');
    }
    function pointerDown(p, kind) {
      if (game.mode === 'attract') {
        if (onCoin(p) || onLedgeTokens(p)) { insertCoin(); return 'coin'; }
        if (inGlass(p, 0, 0, 0)) { tapGlass(); return 'tap'; }
        return 'none';
      }
      if (game.mode === 'play' || game.mode === 'dive') {
        if (onCoin(p)) { emit({ type: 'input', kind: 'coin-ignored' }); return 'coin-ignored'; }
        if (inGlass(p, 8, 40, 8)) {
          var gx = clamp(p.x - G.GLASS_X, board.drop.x0, board.drop.x1);
          if (kind !== 'mouse') view.hopper.ghostX = gx;
          requestDrop(gx);
          return game.mode === 'dive' ? 'queued' : 'drop';
        }
        return 'none';
      }
      if (game.mode === 'payout' && game.payout) { game.payout.fast = true; return 'fast'; }
      if (game.mode === 'work') {
        if (onCoin(p)) { insertCoin(); return 'coin'; }
        if (inGlass(p, 0, 0, 0)) { tapGlass(); return 'tap'; }
      }
      return 'none';
    }
    // PLEASE DO NOT TAP GLASS. The sticker shivers; the coin door's lamp
    // flares (that's where the game starts)
    function tapGlass() {
      view.ui.tap = simT;
      game.taps.push(simT);
      game.taps = game.taps.filter(function (t) { return simT - t < 3; });
      emit({ type: 'glasstap', n: game.taps.length });
    }
    // The keys belong to the machine only while it's the thing you're using:
    // the canvas has the focus (a click on it, or a Tab to it) or the pointer
    // is over the stage, at least half the stage is on screen, no modifier is
    // held, and the key isn't aimed at one of the page's own controls (a
    // link's Enter, a button's Space). HOLLER ROLLER's keysAreOurs
    // (skeeball-main.js), plus the focus-or-pointer rule (wave 5c).
    function keysAreOurs(ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return false;
      var t = ev.target;
      if (t && t.tagName && (/^(INPUT|TEXTAREA|SELECT|BUTTON|A|SUMMARY|OPTION|LABEL)$/.test(t.tagName) || t.isContentEditable)) return false;
      if (HARNESS && !t) return true;                     // harness.key(): a synthetic key, no target
      var ae = document.activeElement;
      var focused = !!ae && (ae === canvas || (container.contains && container.contains(ae)));
      if (!focused && !pointerIn) return false;
      var r = container.getBoundingClientRect(), vh = root.innerHeight || 0;
      var seen = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      return r.height > 0 && seen >= r.height * 0.5;
    }
    function onKey(ev) {
      // (a Tab means someone is finding their way by keyboard: show the focus ring)
      if (ev.key === 'Tab') { container.classList.add('pachinko-kbd'); return; }
      if (!keysAreOurs(ev)) return;
      var k = ev.key;
      if (k === ' ' || k === 'Enter' || k.indexOf('Arrow') === 0 || /^[cCmM]$/.test(k)) emit({ type: 'input', kind: 'key' });
      if (k === 'm' || k === 'M') { setMuted(!muted); ev.preventDefault(); return; }
      if (game.mode === 'attract' || game.mode === 'work') {
        if (k === 'Enter' || k === ' ' || k === 'c' || k === 'C') { if (!ev.repeat) insertCoin(); ev.preventDefault(); }
        return;
      }
      if (game.mode === 'play' || game.mode === 'dive') {
        if (k === 'ArrowLeft' || k === 'ArrowRight') {
          var gx = view.hopper.ghostX == null ? (hopper.queue != null ? hopper.queue : hopper.to) : view.hopper.ghostX;
          var d = ev.shiftKey ? 1 : 4;
          view.hopper.ghostX = clamp(gx + (k === 'ArrowLeft' ? -d : d), board.drop.x0, board.drop.x1);
          ev.preventDefault();
        } else if (k === ' ' || k === 'Enter') {
          // (the key that put the coin in, still held down, isn't a drop)
          if (!(game.mode === 'dive' && ev.repeat)) requestDrop(view.hopper.ghostX == null ? hopper.x : view.hopper.ghostX);
          ev.preventDefault();
        }
        return;
      }
      if (game.mode === 'payout' && (k === ' ' || k === 'Enter') && game.payout) { game.payout.fast = true; ev.preventDefault(); }
    }
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerleave', onLeave);
    root.addEventListener('keydown', onKey);

    /* ── mute (M), remembered ────────────────────────────────────── */
    var muted = false;
    try { muted = root.localStorage && root.localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { muted = false; }
    view.ui.muted = muted;
    function setMuted(on) {
      muted = !!on; view.ui.muted = muted; view.ui.muteT0 = simT;
      try { root.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) { }
      syncMute();
      emit({ type: 'mute', muted: muted });
    }
    var hostPaused = false, hiddenPaused = false;
    function syncMute() {
      if (audio && audio.setMuted) { try { audio.setMuted(muted || hostPaused || hiddenPaused); } catch (e) { } }
    }

    /* ── render ──────────────────────────────────────────────────── */
    var shakeT0 = -10;
    function gameFx() {
      var fx = view.fx, t = simT;
      // drop spent entries
      ['bays', 'pockets', 'awards'].forEach(function (k) { var b = fx[k]; if (b) for (var id in b) if (t - b[id].t0 > 2.5) delete b[id]; });
      var lamps = [], lights = {}, glows = [];
      // the shift whistle: after a pocket catch the galleries light in sequence
      var pk = fx.pockets, lastPocket = -10;
      if (pk) for (var pid in pk) lastPocket = Math.max(lastPocket, pk[pid].t0);
      var ws = t - lastPocket;
      if (ws < 1.6) {
        // …as a chase of warm light along each gallery floor, the haulage way
        // first and then on down the mine, like the company's bulbs coming on
        (board.floors || []).forEach(function (fl, gi) {
          var start = gi * 0.22, span = fl.x1 - fl.x0;
          for (var bx = fl.x0 + 8; bx < fl.x1; bx += 22) {
            var u = ws - start - (bx - fl.x0) / Math.max(1, span) * 0.35;
            if (u < 0 || u > 0.55) continue;
            var kk0 = Math.sin(Math.PI * u / 0.55);
            lamps.push({ x: bx, y: fl.y - 8, r: 15, c: '#ffcf70', k: 1.25 * kk0 });
            glows.push({ x: bx, y: fl.y - 9, k: kk0 });
          }
        });
      }
      // the 13: every lamp flares, gold light pours out of the cup (the
      // placeholder for the spectacle phase's mother lode)
      var flare = 0;
      if (game.lode && !game.lode.part && !game.lode.taken) {
        var lu = t - game.lode.t0;
        flare = lu < 0.15 ? lu / 0.15 : lu < 2.6 ? 1 - 0.25 * Math.max(0, Math.sin(lu * 9)) * 0.4 : Math.max(0, 1 - (lu - 2.6) / 1.4);
        if (lu < 4) {
          var ex = board.byKind.slot.filter(function (s) { return s.value >= 13; })[0];
          var lx = ex ? (ex.x0 + ex.x1) / 2 : 177;
          lamps.push({ x: lx, y: 392, r: Math.round(40 + 50 * Math.min(1, lu * 2)), c: '#ffd24a', k: 1.3 * flare });
          lamps.push({ x: lx, y: 350, r: 30, c: '#fff0a0', k: flare });
        }
        // the fuse: gold light runs out along the vein from the cup, both ways
        var seam = null; (board.decor || []).forEach(function (dd) { if (dd.kind === 'seam') seam = dd; });
        if (seam && lu < 3.4) {
          var slope = (seam.y2 - seam.y1) / (seam.x2 - seam.x1), front = lu * 150;
          for (var sx = seam.x1 + 4; sx < seam.x2; sx += 12) {
            var dist = Math.abs(sx - lx);
            if (dist > front) continue;
            var age = (front - dist) / 150, kk = Math.max(0, 1 - age / 1.6) * (lu < 2.6 ? 1 : 1 - (lu - 2.6) / 0.8);
            if (kk > 0.05) { lamps.push({ x: sx, y: seam.y1 + (sx - seam.x1) * slope - 2, r: 16, c: '#ffc84a', k: 1.4 * kk }); glows.push({ x: sx, y: seam.y1 + (sx - seam.x1) * slope - 1, k: kk, gold: true }); }
          }
        }
        if (flare > 0) board.regions.forEach(function (rg) { if (rg.id !== 'payout' && rg.id !== 'legend') lights[rg.id] = Math.max(lights[rg.id] || 1, 1 + 0.9 * flare); });
      }
      // what the crew changed: a bone-white spot on each alteration, from its
      // TOCK through the push into the glass and the first seconds of the
      // next game, then a faint one for the rest of it (wave 5c: drift you can see)
      var altOut = [];
      if (game.alts.length) {
        var fade = 1;
        if (game.mode === 'play' && game.playT0 != null) { var pu = t - game.playT0; fade = pu < 6 ? 1 : pu < 14 ? 1 - 0.7 * (pu - 6) / 8 : 0.3; }
        else if (game.mode === 'payout') fade = 0;
        for (var ai = 0; ai < game.alts.length; ai++) {
          var al = game.alts[ai], ap = altPlace(al.edit); if (!ap) continue;
          var au = t - al.t0, flash = game.mode === 'work' && au < 0.3 ? 1.4 : 1;
          // (a pin's spot is tight; a board, a mouth or a pail gets a wider one)
          var big = al.edit.type !== 'move' && al.edit.type !== 'nudge' && al.edit.type !== 'dress';
          if (fade > 0) lamps.push({ x: ap.x, y: ap.y, r: big ? 20 : 14, c: '#fff2dc', k: (big ? 1.15 : 0.95) * fade * flash });
          altOut.push({ x: ap.x, y: ap.y, type: al.edit.type, id: al.edit.id, t0: al.t0, from: ap.from || null, k: fade });
        }
      }
      fx.alterations = altOut;
      // the route made visible (wave 5c): a marble in the old drift (or any
      // tunnel) is a lamp crawling through the rock along the tunnel's route;
      // its mouth flashes as it goes in; the exit brightens just before it
      // comes out; behind the legend card, the paper glows as it passes
      var transits = [], card = null;
      for (var wi = 0; wi < world.marbles.length; wi++) {
        var wm = world.marbles[wi];
        if (wm.phase === 'tunnel' && wm.tunnel) {
          var tr = transitOf(wm), fix = board.byId[tr.id];
          // (a short comet: the marble's glint at the head, the light fading behind it)
          var gl = [{ x: tr.x, y: tr.y, k: 2.2, marble: true }];
          if (tr.path) for (var gi = 1; gi <= 4; gi++) { var pq = pathAt(tr.path, tr.k - gi * 0.03); if (tr.k - gi * 0.03 > 0) gl.push({ x: pq.x, y: pq.y, k: 1.8 - gi * 0.35 }); }
          transits.push({ id: tr.id, m: wm.id, x: tr.x, y: tr.y, u: tr.k, exitIn: tr.exitIn, path: tr.path, glows: gl });
          lamps.push({ x: tr.x, y: tr.y, r: 24, c: '#ffcf80', k: 1.35 });
          var since = t - wm.tunnel.tIn;
          if (since < 0.3 && fix) lamps.push({ x: fix.a.x, y: fix.a.y, r: 16, c: '#ffd890', k: 1.2 * (1 - since / 0.3) });
          if (tr.exitIn < 0.45) lamps.push({ x: tr.exit.x, y: tr.exit.y, r: 16, c: '#ffe0a0', k: 1.3 * (1 - Math.max(0, tr.exitIn) / 0.45) });
          if (tr.x < 64 && tr.y > 247 && tr.y < 333) card = { x: tr.x, y: tr.y, k: 1, r: 26 };
        } else if (!wm.done && wm.phase === 'board' && game.outAt[wm.id] != null && t - game.outAt[wm.id] < 0.3) {
          lamps.push({ x: wm.x, y: wm.y, r: 16, c: '#ffe0a0', k: 1.2 * (1 - (t - game.outAt[wm.id]) / 0.3) });
        }
      }
      fx.transits = transits;
      fx.transitCard = card;
      // a hit strikes a little light off the pin (the clatter lights the mine)
      for (var i = Math.max(0, view.hits.length - 24); i < view.hits.length; i++) {
        var h = view.hits[i], a = t - h.t;
        if (a < 0.14 && h.x != null && h.speed > 40) lamps.push({ x: h.x, y: h.y, r: 7, c: '#c8d4ff', k: Math.min(0.9, h.speed / 400) * (1 - a / 0.14) });
      }
      // lit bays: the work light over a bay that paid
      var bays = fx.bays;
      if (bays) for (var sid in bays) {
        var s = board.byId[sid], b = bays[sid], ba = t - b.t0;
        if (!s || !(b.value > 0) || ba > 1.6) continue;
        lamps.push({ x: (s.x0 + s.x1) / 2, y: 396, r: 22, c: '#ffc46a', k: 1.2 * (ba < 0.1 ? ba / 0.1 : 1 - (ba - 0.1) / 1.5) });
      }
      if (pk) for (var pid2 in pk) {
        var P = board.byId[pid2], pa = t - pk[pid2].t0;
        if (!P || pa > 1.2) continue;
        lamps.push({ x: P.x, y: P.y + 2, r: 20, c: '#ffd060', k: 1.3 * (1 - pa / 1.2) });
      }
      var aw = fx.awards;
      if (aw) for (var aid in aw) {
        var C = board.byId[aid], aa = t - aw[aid].t0;
        if (!C || aa > 0.9) continue;
        var cp = PB.pose(C, t);
        lamps.push({ x: cp.pose.x, y: cp.pose.y - 6, r: 16, c: '#ffd060', k: 1.1 * (1 - aa / 0.9) });
      }
      fx.extraLamps = lamps;
      fx.glows = glows;
      fx.lights = lights;
      fx.flare = flare;
      fx.lode = game.lode ? { t0: game.lode.t0 } : null;
      // the crew during the 13: arms up, toy-stiff, in stop motion
      if (game.lode && !game.lode.part && !game.lode.taken && game.mode !== 'work' && R && R.stillLife && R.POSES) {
        var lu2 = t - game.lode.t0;
        if (lu2 < 3.2) {
          view.figures = (R.stillLife() || []).map(function (f, i) {
            var g = {}; for (var k in f) g[k] = f[k];
            g.pose = Math.floor(lu2 * 5 + i) % 2 ? R.POSES.cheer : R.POSES.stand;
            return g;
          });
        } else if (game.mode !== 'work') view.figures = [];
      }
      partsCall('fx', view);
    }
    // a marble in a tunnel: where it is along the tunnel's own route through
    // the rock (board tunnel.path), how far (u), and how long until it comes
    // out. from/to are both the point itself, lifted by the renderer's own
    // arch, so its light sits on the route (the renderer can read x/y/path)
    function pathAt(path, u) {
      var L = 0, i, seg = [];
      for (i = 1; i < path.length; i++) { var d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(d); L += d; }
      var a = clamp(u, 0, 1) * L;
      for (i = 0; i < seg.length; i++) { if (a <= seg[i] || i === seg.length - 1) { var q = seg[i] ? a / seg[i] : 0; return { x: path[i][0] + (path[i + 1][0] - path[i][0]) * q, y: path[i][1] + (path[i + 1][1] - path[i][1]) * q }; } a -= seg[i]; }
      return { x: path[0][0], y: path[0][1] };
    }
    function transitOf(m) {
      var tu = m.tunnel, fix = board.byId[tu.id], k = clamp((view.t - tu.tIn) / Math.max(0.01, tu.tOut - tu.tIn), 0, 1);
      var pt = fix && fix.path ? pathAt(fix.path, k) : { x: tu.from.x + (tu.to.x - tu.from.x) * k, y: tu.from.y + (tu.to.y - tu.from.y) * k };
      var lift = Math.sin(k * Math.PI) * 10, at = { x: pt.x, y: pt.y - lift };
      return { id: tu.id, from: at, to: at, k: k, x: pt.x, y: pt.y, path: fix && fix.path, exitIn: tu.tOut - view.t, exit: tu.to };
    }
    // where an alteration is on the board as it stands (for its spot)
    function altPlace(e) {
      var f = board.byId[e.id];
      if (e.type === 'move' || e.type === 'nudge' || e.type === 'dress') return f ? { x: f.x, y: f.y, from: e.dx != null ? { x: f.x - e.dx, y: f.y - e.dy } : null } : null;
      if (e.type === 'chute') { var st = (board.chutes || []).filter(function (q) { return q.id === e.id; })[0]; return st ? { x: st.x, y: st.fy + 14 } : null; }
      if (e.type === 'mouth') return f ? { x: f.a.x, y: f.a.y } : null;
      if (e.type === 'pocket') return f ? { x: f.x, y: f.y + 2 } : null;
      if (e.type === 'rail') return f ? (e.end === 1 ? { x: f.x1, y: f.y1 } : { x: f.x2, y: f.y2 }) : null;
      return null;
    }
    function prepView() {
      var cam = camera(camK());
      view.cam.k = cam.k; view.cam.s = cam.s; view.cam.x = cam.x; view.cam.y = cam.y; view.cam.w = cam.w; view.cam.h = cam.h;
      view.marbles = world.marbles.filter(function (m) { return !m.done || (m.phase === 'pocket' && view.t - m.tDone < 0.6); }).map(function (m) {
        var o = { x: m.x, y: m.y, r: m.r, spin: m.spin, id: m.id, phase: m.phase };
        if (m.phase === 'tunnel') o.tunnel = transitOf(m);
        if (trails[m.id]) o.trail = trails[m.id];
        return o;
      });
      var hv = view.hopper;
      if (game.mode !== 'play' && game.mode !== 'dive') hv.ghostX = null;
      // in PLAY the bucket carries a marble from the reload until the release;
      // after the game it's empty until the crew refill the tube
      hv.x = hopper.x; hv.loaded = game.mode === 'play' ? hopper.loaded : game.mode === 'attract' || game.mode === 'dive';
      hv.speed = hopper.speed; hv.queued = hopper.queue; hv.gliding = hopper.gliding;
      var ui = view.ui;
      ui.tally.value = tally.shown; ui.tally.prev = tally.prev; ui.tally.dir = tally.dir;
      ui.tally.roll = clamp((simT - tally.rollT0) / TALLY_ROLL, 0, 1);
      ui.tokens = tokensNow();
      ui.scrip = A ? A.scrip.get() - (ui.scripHeld | 0) : null;
      ui.mode = game.mode; ui.t = simT;
      ui.marblesLeft = view.marblesLeft;
      gameFx();
      if (game.lode && !game.lode.taken && simT - game.lode.t0 < 0.35) shakeT0 = game.lode.t0;
      var pf = partsFirst('figures', view);
      if (pf) view.figures = pf;
      return cam;
    }
    function render() {
      var cam = prepView();
      var drew = false;
      if (renderOK && DEBUG !== 1) {
        try {
          cctx.setTransform(1, 0, 0, 1, 0, 0); cctx.imageSmoothingEnabled = false;
          R.draw(cctx, view);
          if (DEBUG === 2) debugDraw(cctx, true);
          drew = true;
        } catch (e) { renderOK = false; warn('draw', e); }
      }
      if (!drew) {
        cctx.setTransform(1, 0, 0, 1, 0, 0);
        cctx.fillStyle = '#07060d'; cctx.fillRect(0, 0, G.CAB_W, G.CAB_H); debugDraw(cctx, false);
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#07060d'; ctx.fillRect(0, 0, devW, devH);
      blit(cam);
    }
    // the room around the machine, in cabinet pixels so it scales with the
    // camera. The wall is the purple-black night with the marquee's light
    // spilling down it (Bayer-dithered, like the machine); a skirting board
    // runs the width of the room; the cabinet stands on the carpet every
    // arcade had (stars, squiggles, rings), faded nearly to the floor colour,
    // stuck here and there with gum. The carpet and the skirting are drawn
    // screen-wide; the spill and the cabinet's shadow come from roomC, which
    // is laid over the cabinet canvas's own room pixels with the case cut out.
    var ROOM_M = 340, roomC = null, carpet = null;
    var BAY16 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    var ROOMCOL = { N0: [7, 6, 13], N1: [16, 14, 30], N2: [26, 23, 48], P1: [44, 35, 71], SK0: [18, 13, 17], SK1: [31, 22, 26],
      STAR: [30, 25, 52], SQUIG: [40, 20, 38], RING: [22, 19, 40], GUM: [2, 1, 4], FL: [10, 8, 17] };
    var FLOOR_Y = null, SKIRT = 7;
    function rgbStr(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }
    function buildRoom() {
      var W = G.CAB_W + ROOM_M * 2, H = G.CAB_H + ROOM_M * 2, FLOOR = FLOOR_Y = G.CAB_H, K = ROOMCOL;
      var c = document.createElement('canvas'); c.width = W; c.height = H;
      var g = c.getContext('2d'), im = g.createImageData(W, H), d = im.data;
      function cut(x, y) { return (x >= 2 && x <= 374 && y >= 20 && y < FLOOR) || (x >= 124 && x <= 252 && y >= 0 && y < 21); }
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var cx = x - ROOM_M, cy = y - ROOM_M, o = (y * W + x) * 4;
        if (cut(cx, cy)) continue;
        var b = BAY16[((cy & 3) * 4) + (cx & 3)] / 16, col = null;
        if (cy < FLOOR) {
          var mx = Math.max(2 - cx, 0, cx - 374), my = Math.max(20 - cy, 0, cy - 66);
          var bx = Math.max(4 - cx, 0, cx - 371), by = Math.max(66 - cy, 0);
          var dm = Math.hypot(mx, my * 1.25), db = Math.hypot(bx, by);
          // the spill, windowed so it is exactly nothing well inside the canvas
          var glow = 0.6 * Math.exp(-dm / 38) * Math.max(0, 1 - dm / 190) + 0.13 * Math.exp(-db / 80) * Math.max(0, 1 - db / 230);
          if (glow < 0.012 && !(cx > -6 && cx < G.CAB_W + 6 && cy > -6)) continue;
          col = K.N0;
          if (b < (glow - 0.5) * 1.6) col = K.P1; else if (b < glow * 0.55) col = K.N2; else if (b < glow * 1.3) col = K.N1;
          if (cy >= FLOOR - SKIRT) col = cy === FLOOR - SKIRT ? K.SK1 : cy === FLOOR - 1 ? K.N0 : K.SK0;
        } else {
          // the cabinet's shadow on the carpet in front of its foot
          var fy = cy - FLOOR;
          if (cx >= -4 && cx <= G.CAB_W + 3 && fy < 8 && b > fy / 9) col = K.N0;
          else continue;
        }
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    }
    // one tile of carpet, 48 × 24 cabinet px (two staggered rows of motifs)
    function buildCarpet() {
      var K = ROOMCOL, c = document.createElement('canvas'); c.width = 48; c.height = 24;
      var g = c.getContext('2d'), im = g.createImageData(48, 24), d = im.data;
      var M = {};
      function put(pts, col, ox, oy) { pts.forEach(function (q) { M[((q[0] + ox) % 48) + ',' + ((q[1] + oy) % 24)] = col; }); }
      [[0, 0], [24, 12]].forEach(function (o) {
        put([[3, 1], [2, 2], [3, 2], [4, 2], [3, 3]], K.STAR, o[0], o[1]);
        put([[10, 6], [11, 5], [12, 6], [13, 7], [14, 6], [15, 5]], K.SQUIG, o[0], o[1]);
        put([[17, 8], [18, 7], [19, 8], [18, 9]], K.RING, o[0], o[1]);
        put([[18, 2], [21, 9], [7, 9]], K.N2, o[0], o[1]);
      });
      for (var y = 0; y < 24; y++) for (var x = 0; x < 48; x++) {
        var col = M[x + ',' + y] || K.FL, o = (y * 48 + x) * 4;
        if ((hashSeed(x, y + 7) & 511) < 2) col = K.GUM;          // gum
        d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    }
    // the wall's skirting and the carpet, the width of the screen
    var carpetCache = null;
    function drawFloor(cam, jx, jy) {
      if (!carpet) carpet = buildCarpet();
      var fy = Math.round((G.CAB_H - cam.y) * cam.s + jy);
      if (fy >= devH + 1) return;
      var sy0 = Math.round((G.CAB_H - SKIRT - cam.y) * cam.s + jy);
      ctx.fillStyle = rgbStr(ROOMCOL.SK0); ctx.fillRect(0, sy0, devW, fy - sy0);
      ctx.fillStyle = rgbStr(ROOMCOL.SK1); ctx.fillRect(0, sy0, devW, Math.max(1, Math.round(cam.s)));
      ctx.fillStyle = rgbStr(ROOMCOL.N0); ctx.fillRect(0, fy - Math.max(1, Math.round(cam.s)), devW, Math.max(1, Math.round(cam.s)));
      if (fy >= devH) return;
      var s = Math.max(1, Math.round(cam.s));
      if (!carpetCache || carpetCache.s !== s) {
        var t = document.createElement('canvas'); t.width = 48 * s; t.height = 24 * s;
        var tg = t.getContext('2d'); tg.imageSmoothingEnabled = false; tg.drawImage(carpet, 0, 0, t.width, t.height);
        carpetCache = { s: s, pat: ctx.createPattern(t, 'repeat') };
      }
      var pat = carpetCache.pat, ox = Math.round(-cam.x * cam.s + jx), k = cam.s / s;
      if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([k, 0, 0, k, ox, fy]));
      ctx.fillStyle = pat; ctx.fillRect(0, fy, devW, devH - fy);
    }
    function blitRoom(cam, jx, jy) {
      if (!roomC) roomC = buildRoom();
      var ox = cam.x + ROOM_M, oy = cam.y + ROOM_M;
      var sx = Math.max(0, ox), sy = Math.max(0, oy), ex = Math.min(roomC.width, ox + cam.w), ey = Math.min(roomC.height, oy + cam.h);
      if (ex <= sx || ey <= sy) return;
      var dx = (sx - ox) * cam.s + jx, dy = (sy - oy) * cam.s + jy;
      if (cam.k === 0 || cam.k === 1) { dx = Math.round(dx); dy = Math.round(dy); }
      ctx.drawImage(roomC, sx, sy, ex - sx, ey - sy, dx, dy, (ex - sx) * cam.s, (ey - sy) * cam.s);
    }
    function blit(cam) {
      ctx.imageSmoothingEnabled = false;
      // the 13 lands with a thump: the whole case jolts a device pixel or two
      var jx = 0, jy = 0, su = simT - shakeT0, dur = 0.3, sa = 1, sh = view.fx && view.fx.shake;
      // (a part may shake it too: the vein cracking, a roof coming down)
      if (sh && simT - sh.t0 >= 0 && simT - sh.t0 < sh.dur) { su = simT - sh.t0; dur = sh.dur; sa = sh.amp || 1; }
      if (su >= 0 && su < dur && cam.k === 1) {
        var amp = Math.round((1 - su / dur) * Math.max(1, cam.s / 2) * sa);
        jx = Math.floor(su * 60) % 2 ? amp : -amp; jy = Math.floor(su * 45) % 2 ? amp : 0;
      }
      view.jolt = [jx, jy];          // (the room overlay jolts with the case, exactly)
      // the room overlay (pachinko-art-room.js) paints everything outside the
      // case: main's own floor and wall spill would only be painted under it
      var roomOn = !!(root.PachinkoRoom && root.PachinkoRoom.CUT);
      if (!roomOn) drawFloor(cam, jx, jy);
      var sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
      var ex = Math.min(G.CAB_W, cam.x + cam.w), ey = Math.min(G.CAB_H, cam.y + cam.h);
      if (ex > sx && ey > sy) {
        var dx = (sx - cam.x) * cam.s + jx, dy = (sy - cam.y) * cam.s + jy;
        if (cam.k === 0 || cam.k === 1) { dx = Math.round(dx); dy = Math.round(dy); }
        ctx.drawImage(cab, sx, sy, ex - sx, ey - sy, dx, dy, (ex - sx) * cam.s, (ey - sy) * cam.s);
      }
      if (!roomOn) blitRoom(cam, jx, jy);
    }

    /* the debug view: the board's primitives, regions tinted */
    var REG_TINT = { surface: '#1c2440', overburden: '#2b2230', haulage: '#1d1a2c', measures: '#22182a', ventilation: '#22182a',
      barren: '#2b2230', workings: '#1b1a24', sump: '#151a22', vein: '#1e1a16', payout: '#191422', legend: '#101010' };
    var MAT_COL = { steel: '#b8c4d8', brass: '#d8b25a', timber: '#a0703c', rock: '#6b5f6e', ore: '#e0c060', bone: '#e8dfc8' };
    function debugDraw(c, overlay) {
      c.save();
      c.translate(G.GLASS_X, G.GLASS_Y);
      c.beginPath(); c.rect(0, 0, G.GLASS_W, G.GLASS_H); c.clip();
      if (!overlay) {
        board.regions.forEach(function (r) { c.fillStyle = REG_TINT[r.id] || '#111'; c.fillRect(r.x, r.y, r.w, r.h); });
        c.fillStyle = '#6f5d95'; c.font = '6px monospace';
        board.regions.forEach(function (r) { c.fillText(r.id, r.x + 2, r.y + 7); });
      }
      var t = view.t, hot = {};
      view.hits.forEach(function (h) { hot[h.id] = 1; });
      board.fixtures.forEach(function (f) {
        var col = MAT_COL[f.material] || '#fff';
        if (f.kind === 'pin') { c.fillStyle = hot[f.id] ? '#ff4fa8' : col; c.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3); }
        else if (f.kind === 'rail') { line(c, f.x1, f.y1, f.x2, f.y2, hot[f.id] ? '#ff4fa8' : col, Math.max(1, f.r * 2)); }
        else if (f.kind === 'wheel') {
          var p = PB.pose(f, t);
          p.segs.forEach(function (s) { line(c, s[0][0], s[0][1], s[1][0], s[1][1], col, 2); });
        } else if (f.kind === 'cart') {
          PB.pose(f, t).segs.forEach(function (s) { line(c, s[0][0], s[0][1], s[1][0], s[1][1], '#c0c8d8', 2); });
        } else if (f.kind === 'tunnel') {
          c.strokeStyle = f.open ? '#ff4fa8' : '#553344'; c.beginPath(); c.arc(f.a.x, f.a.y, f.a.r, 0, 7); c.stroke();
          c.strokeStyle = '#a63a70'; c.beginPath(); c.arc(f.b.x, f.b.y, 4, 0, 7); c.stroke();
        } else if (f.kind === 'pocket') {
          c.fillStyle = '#d8b25a'; c.fillRect(f.x - f.w / 2, f.y, f.w, 6);
        } else if (f.kind === 'slot') {
          c.fillStyle = f.value === 13 ? '#ffd24a' : f.value ? '#6f5d95' : '#2c2347';
          c.fillRect(f.x0 + 1, f.y + 8, f.x1 - f.x0 - 2, 8);
        }
      });
      c.fillStyle = '#e8dfc8'; c.fillRect(Math.round(view.hopper.x) - 4, 0, 9, 3);
      view.marbles.forEach(function (m) {
        if (m.phase === 'tunnel') return;
        c.fillStyle = '#9fe3ff'; c.beginPath(); c.arc(m.x, m.y, m.r, 0, 7); c.fill();
      });
      c.restore();
      c.fillStyle = '#e8dfc8'; c.font = '8px monospace';
      c.fillText('DEBUG ' + game.mode + ' t ' + view.t.toFixed(2) + ' scrip ' + game.score + ' left ' + view.marblesLeft, 4, 10);
    }
    function line(c, x1, y1, x2, y2, col, wd) { c.strokeStyle = col; c.lineWidth = wd; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    function warn(where, e) { if (root.console) console.warn('MOTHER LODE: ' + where + ' failed', e); }

    /* ── loop ────────────────────────────────────────────────────── */
    var dead = false, rafId = 0, lastNow = null, clock = 0, booted = false;
    function frame(now) {
      if (dead) return;
      rafId = root.requestAnimationFrame(frame);
      if (hostPaused || hiddenPaused) { lastNow = null; return; }
      if (lastNow === null) lastNow = now;          // resume: no catch-up burst
      clock += Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
      lastNow = now;
      advance(clock);
      render();
    }
    function onVisibility() {
      hiddenPaused = document.hidden;
      if (!hiddenPaused) lastNow = null;
      syncMute();
    }
    document.addEventListener('visibilitychange', onVisibility);
    fit();
    root.addEventListener('resize', fit);
    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { fit(); }) : null;
    if (ro) ro.observe(container);
    var dprMq = null;
    function watchDpr() {
      if (!root.matchMedia) return;
      mqOff();
      dprMq = root.matchMedia('(resolution: ' + (root.devicePixelRatio || 1) + 'dppx)');
      // (Safari before 14 has only the old addListener)
      if (dprMq.addEventListener) dprMq.addEventListener('change', onDpr); else if (dprMq.addListener) dprMq.addListener(onDpr);
    }
    function mqOff() { if (!dprMq) return; if (dprMq.removeEventListener) dprMq.removeEventListener('change', onDpr); else if (dprMq.removeListener) dprMq.removeListener(onDpr); }
    function onDpr() { fit(); watchDpr(); }
    watchDpr();

    view.ui.best = stats().best | 0;
    // a game the last page left open: owed, waiting behind the coin door
    try {
      var open0 = A ? stats().open : null;
      if (open0 && open0.v === 1 && (open0.dropped | 0) < MARBLES) {
        game.owed = open0;
        tally.value = tally.shown = tally.prev = open0.score | 0;
      } else if (open0) clearOpen();
    } catch (e) { game.owed = null; }
    toAttract();
    var qm = HARNESS && /[?&]mode=(attract|play|payout|work)/.exec(search);
    if (qm && qm[1] !== 'attract') forceMode(qm[1]);
    booted = true;
    if (!HARNESS) rafId = root.requestAnimationFrame(frame);

    // preview a state (harness): play = a free game dived in; payout = a
    // game that won 17 ending now; work = the crew at work
    function forceMode(m) {
      if (!MODES[m]) return false;
      if (m === 'attract') { toAttract(); return true; }
      if (game.mode === 'attract') { var free = FREE; FREE = true; insertCoin(); FREE = free; }
      if (m === 'dive') return true;
      advance(simT + COIN_T + DIVE_T + STEP * 2);
      if (m === 'play') return true;
      if (m === 'payout') { game.score = FORCE.scrip != null ? FORCE.scrip : 17; tally.value = tally.shown = game.score; gameOver(); return true; }
      if (m === 'work') { game.score = 0; gameOver(); startWork(); return true; }
      return true;
    }

    var audio = null;
    var handle = {
      VERSION: VERSION,
      view: view,
      drop: function (x) { return requestDrop(x); },
      insertCoin: insertCoin,
      getState: function () {
        return {
          mode: game.mode, t: simT, scrip: game.score, dropped: game.dropped, resolved: game.resolved,
          marblesLeft: view.marblesLeft, inPlay: world.marbles.filter(function (m) { return !m.done; }).length,
          hopper: { x: hopper.x, loaded: hopper.loaded, gliding: hopper.gliding, queued: hopper.queue },
          tokens: tokensNow(), scripBalance: scripNow(), lodes: game.lodes, games: game.games, muted: muted,
          boardGen: board.gen | 0, edits: (board.edits || []).length,
          audio: audio ? (audio.isUnlocked ? (audio.isUnlocked() ? 'unlocked' : 'locked') : 'attached') : 'none'
        };
      },
      onEvent: subscribe,
      setMuted: setMuted,
      pause: function () { hostPaused = true; syncMute(); },
      resume: function () { hostPaused = false; lastNow = null; syncMute(); },
      destroy: function () {
        dead = true;
        if (rafId) root.cancelAnimationFrame(rafId);
        if (audio && audio.destroy) { try { audio.destroy(); } catch (e) { } }
        partsCall('destroy');
        root.removeEventListener('resize', fit); root.removeEventListener('keydown', onKey);
        document.removeEventListener('visibilitychange', onVisibility);
        mqOff();
        if (ro) ro.disconnect();
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointerleave', onLeave);
        document.documentElement.classList.remove('pachinko-playing');
        canvas.remove();
        listeners = [];
        // (nothing of this machine stays reachable once it's gone)
        if (root.__pachinko === handle) root.__pachinko = null;
        if (root.PachinkoKnockers && root.PachinkoKnockers.live && parts.indexOf(root.PachinkoKnockers.live) >= 0) root.PachinkoKnockers.live = null;
        if (root.PachinkoMischief && root.PachinkoMischief.live && parts.indexOf(root.PachinkoMischief.live) >= 0) root.PachinkoMischief.live = null;
      }
    };

    if (HARNESS) {
      var H = handle.harness = {
        stepTo: function (t) { advance(t); return simT; },
        step: function (dt) { advance(simT + dt); return simT; },
        render: function () { render(); return simT; },
        coin: function () { return insertCoin(); },
        request: function (x) { return requestDrop(x); },
        // a free marble straight onto the board (outside the 13; for film.js)
        drop: function (x) { x = clamp(x, board.drop.x0, board.drop.x1); hopper.x = x; return PP.addMarble(world, x).id; },
        // a pointer press at cabinet px (the same path as a click)
        press: function (cx, cy, kind) { return pointerDown({ x: cx, y: cy }, kind || 'mouse'); },
        hover: function (gx) { view.hopper.ghostX = gx; },
        key: function (key, shift) { onKey({ key: key, shiftKey: !!shift, preventDefault: function () { }, target: null }); },
        // a whole game: coin, a drop at each x (queued as fast as the hopper
        // allows unless `gap` s apart), payout, work, back to attract
        play: function (xs, gap) {
          xs = xs && xs.length ? xs : [160];
          var t0 = simT, log = [];
          var sub = subscribe(function (e) { if (e.type === 'win' || e.type === 'lode' || e.type === 'gameover' || e.type === 'edit' || e.type === 'work') log.push(e); });
          if (!insertCoin()) { sub(); return { ok: false, reason: 'no tokens', state: handle.getState() }; }
          while (game.mode !== 'play' && simT - t0 < 5) advance(simT + 0.05);
          for (var i = 0; i < MARBLES; i++) {
            var x = xs[i % xs.length];
            if (gap) { requestDrop(x); advance(simT + gap); }
            else { var n0 = game.dropped; requestDrop(x); while (game.dropped === n0 && simT - t0 < 60) advance(simT + 0.02); }
          }
          var tEnd = simT;
          while (game.mode !== 'attract' && simT - t0 < 120) advance(simT + 0.05);
          sub();
          return { ok: true, scrip: log.filter(function (e) { return e.type === 'gameover'; }).map(function (e) { return e.scrip; })[0],
            wins: log.filter(function (e) { return e.type === 'win'; }).map(function (e) { return e.source + ':' + e.value; }),
            lodes: game.lodes, edits: log.filter(function (e) { return e.type === 'edit'; }).map(function (e) { return e.edit; }),
            tPlay: tEnd - t0, t: simT, state: handle.getState() };
        },
        lode: function () { var s = board.byKind.slot.filter(function (q) { return q.value >= 13; })[0]; onPhysics({ type: 'slot', id: s.id, value: 13, legend: s.legend, x: (s.x0 + s.x1) / 2, y: 400, m: -1 }); },
        setMode: forceMode,
        setBoard: function (b) { setBoard(b); },
        setMuted: setMuted,
        get world() { return world; },
        get board() { return board; },
        get game() { return game; },
        get state() { return handle.getState(); },
        events: ring, view: view, canvas: canvas, cab: cab,
        camera: function () { return camera(camK()); },
        toCss: function (cx, cy) {   // cabinet px → css px on the page (for real mouse events)
          var c = camera(camK()), rect = canvas.getBoundingClientRect(), dpr = root.devicePixelRatio || 1;
          return { x: rect.left + (cx - c.x) * c.s / dpr, y: rect.top + (cy - c.y) * c.s / dpr };
        }
      };
    }

    // the sound (pachinko-audio.js) hears everything through the handle;
    // not under the harness (its play() fires a whole game in one burst)
    // unless ?audio=1 asks for it
    if ((!HARNESS || /[?&]audio=1/.test(search)) && root.PachinkoAudio && root.PachinkoAudio.attach) {
      try { audio = root.PachinkoAudio.attach(handle, canvas, { muted: muted, version: VERSION, seed: game.seed }); } catch (e) { warn('audio', e); audio = null; }
      syncMute();
    }
    return handle;
  }

  root.MotherLode = { mount: mount };

  // auto-mount on the page
  function boot() {
    var el = document.getElementById('pachinko-mount');
    if (!el || el.__mounted) return;
    el.__mounted = true;
    root.__pachinko = mount(el, {});
    if (root.console) console.log('MOTHER LODE ' + (el.getAttribute('data-version') || 'dev'));
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
  }
})(window);

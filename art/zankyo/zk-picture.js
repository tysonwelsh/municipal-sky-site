// ============================================================================
// ZANKYŌ — zk-picture.js: 映り HOW A PICTURE COMES IN (PLAN-SIGNAL-PICTURE §5.1)
//
// The second set's impairment library, its character draw, and the constants
// block. zk-set.js keeps the phase machine, the canvases and the compositing;
// everything that decides what a reception LOOKS like lives here, so that a
// reception's damage is drawn per reception instead of being the same nine
// bands and one ghost every time (the §1 audit).
//
// P0 split rc.91's frame into passes and held its look as one character, 今.
// P1 (this state) DRAWS the character (§4.1–4.2): an archetype — the condition
// the signal arrives in — and from it the impairments, each with its own axes
// drawn from a range, its own envelope on its own timeline, a slow fade, a
// drawn breath, a list of what each dropout does, and a surfacing lull (§11.2:
// every reception lets the picture come up now and then). The P1 kinds are the
// EXISTING effects, enriched:
//   雪 snow   sparks that streak sideways, dark specks, band-limited grain,
//             flicker — not one formula of white per-pixel sparks
//   影 ghosts one to three echoes at fixed delays, some negative, a leading
//             pre-ghost, and the aircraft flutter; at SOURCE resolution now
//   裂 tear   line-accurate: a sync impulse displaces the lines below a random
//             height and they pull back down the frame and over time — not
//             nine equal bands; the horizontal blanking shows when a line is
//             displaced past it
//   霞 wash   lifted blacks and low contrast (a weak signal with the contrast
//             up) — or, in its hot corner, crushed whites (overload's stand-in
//             until P2's 飽)
//   伸 swell  the raster breathes with the beam current, lagged
// The P2 kinds (点 縞 帯 混 横 旗 揺 捩 滲 飽) are refused by name until they
// exist; the archetypes whose true primaries are P2 kinds (混 co-channel, 電
// local noise, 同 bad sync, 過 overload) are drawn from the P1 kinds that
// share their cause until then — each noted where it is defined.
//
// THE CONTRACT WITH THE MUSIC (§2.2). Nothing here reads or writes an engine
// stream. The character draw takes a PJ2.Rand FORK the set hands it (the
// set's own labels, "set:rx:<seed>" and "set:rx:<seed>:<piece>"); texture —
// which pixel sparks, where a tear lands, a roll kick's size — takes whatever
// `rnd` the set passes (Math.random in production, the character contract's
// allowance, or a seeded stream on the bench). The file does no work at load
// beyond building constant tables, and it touches no DOM, so the headless
// harness and probe (which load every zk-*.js from index.php) load it
// harmlessly.
// ============================================================================
(function (root) {
  "use strict";

  var SW = 192, SH = 144;          // the raster (zk-set.js owns the canvases)
  var HBLANK = 14;                  // source px of horizontal blanking: what a displaced line shows at its left edge

  // ==========================================================================
  // THE CONSTANTS BLOCK (§6.5). The owner's knobs are here and only here.
  // ==========================================================================

  // §4.1's archetypes, with §4.1's weights as starting values (§9.9, §11.5).
  // prim: the kinds it always has, at the reception's severity; sec: the pool
  // one light secondary is drawn from; style: which corner of each kind's
  // ranges it draws from; drops: what its dropouts do (§4.2), by weight.
  var ARCHETYPES = [
    { id: "遠", w: 0.22, story: "fringe: a distant station at the edge of range",
      prim: ["雪", "霞"], sec: ["裂", "影"], style: "fringe",
      drops: { snow: 4, roll: 3, tear: 1, hold: 1, hlock: 0 } },
    { id: "反", w: 0.18, story: "multipath: city or mountain reflections",
      prim: ["影"], sec: ["裂", "雪"], style: "multi",
      drops: { snow: 2, hold: 3, roll: 1, tear: 1, hlock: 0 } },
    // co-channel's true primaries are 縞 and 混 (P2). Until then: a second
    // carrier's weak, long, often inverted echo and the veil it lays down.
    { id: "混", w: 0.12, story: "co-channel: two stations on one channel",
      prim: ["影", "霞"], sec: ["雪"], style: "cochan",
      drops: { snow: 3, hold: 1, roll: 1, tear: 0, hlock: 1 } },
    // local noise's true primaries are 点 and 帯 (P2). Until then: snow in
    // its impulse corner — long white dashes arriving in bursts — and tears.
    { id: "電", w: 0.13, story: "local noise: machinery or a car nearby",
      prim: ["雪", "裂"], sec: ["影"], style: "spark",
      drops: { snow: 2, tear: 4, roll: 1, hold: 1, hlock: 0 } },
    // bad sync's 横 旗 捩 are P2; 縦 (the roll) and 裂 exist, and its
    // dropouts are where the hold slips and the lock is lost.
    { id: "同", w: 0.15, story: "bad sync: a tired set, an unstable transmitter",
      prim: ["裂"], sec: ["伸", "雪"], style: "sync",
      drops: { roll: 4, hlock: 3, tear: 3, snow: 1, hold: 1 } },
    // overload's 飽 is P2. Until then: 霞 in its hot corner (the whites crush)
    // and 伸 (a hard-driven beam breathes).
    { id: "過", w: 0.08, story: "overload: too close, too strong",
      prim: ["霞", "伸"], sec: ["影"], style: "hot",
      drops: { snow: 1, hold: 2, roll: 1, tear: 1, hlock: 0 } },
    { id: "清", w: 0.07, story: "clean: a rare perfect catch",
      prim: [], sec: ["影", "伸"], style: "clean",
      drops: { snow: 3, hold: 1, roll: 0, tear: 0, hlock: 0 } },
    { id: "嵐", w: 0.05, story: "storm: everything at once, briefly",
      prim: null, sec: [], style: "storm",
      drops: { snow: 2, roll: 2, tear: 2, hold: 1, hlock: 2 } },
  ];
  var ARCH_BY_ID = {}; ARCHETYPES.forEach(function (a) { ARCH_BY_ID[a.id] = a; });

  // the P1 kinds, and the P2 kinds the force hook refuses by name until P2
  var IMPAIRMENTS = ["雪", "影", "裂", "霞", "伸"];
  var LATER = { "点": "P2", "縞": "P2", "帯": "P2", "混": "P2", "横": "P2", "旗": "P2", "揺": "P2", "捩": "P2", "滲": "P2", "飽": "P2" };

  // the severity draw (§4.3's "common: one to three impairments at modest
  // severity"; tiers proper are P4): sev = lo + span·u^pow
  var SEV = { lo: 0.28, span: 0.62, pow: 1.1, uncommonP: 1 / 6, secP: 0.55 };
  // 雪: the carrier strength a reception rests at, from its snow severity:
  // base = top − drop·k. rc.91 rested at 0.82 (k ≈ 0.25 here).
  var CARRIER = { top: 0.9, drop: 0.34 };
  // the surfacing lull (§11.2): now and then the conditions ease and a face
  // or a shape rises out of the noise for a moment and sinks back.
  // REWRITTEN AT r2 (critic P1 r1 item 1): rc.P1's lull was a CLEARING on a
  // METRONOME — the carrier pinned flat at 0.85, every impairment eased by
  // 70–88 %, one fixed period per reception, and on 69 % of receptions. Now:
  //  · a SURFACING TO A LEVEL: the carrier is lifted BY `lift` × the lull's
  //    height (not TO a level, so the breath keeps moving inside it; capped
  //    at liftCap), and each impairment eases only as far as its target at
  //    the lull's top — spark density to pT, the fog's lost contrast (or a
  //    hot picture's crush) to wT, the echoes' summed amplitude to gT, the
  //    tear rate to tT (zk-set.js, the hold). Whatever buried a reception, a
  //    lull brings it up to about the same place: a face through a veil of
  //    snow, never a clean picture; an impairment already under its target
  //    is not touched. Dropouts inside a lull are knocked dropEase less deep;
  //  · IRREGULAR: every lull's rise, flat, fall and the rest after it are
  //    drawn per lull from a hash of the reception's `key` and the lull's
  //    index (deterministic, infinite, no fork draws per frame); its height h
  //    too. The rest after a lull is either short (pairP of the time: a
  //    quick second rise, ≤ pairRest of the room left) or long (≥ longRest
  //    of it), so lulls come in pairs and long waits, not on a beat. The
  //    guarantee: the time from one flat's end to the next flat's start
  //    (fall + rest + rise) never exceeds `gapMax` 3.6 s and no flat is under
  //    0.7 s, so any 5 s of hold contains ≥ 0.6 s of flat (a window that just
  //    misses one flat's last 0.6 s meets the next flat's first 0.6 s within
  //    0.6 + 3.6 + 0.6 ≤ 5 s); the first flat starts by `off` + rise ≤ 3.3 s;
  //  · ONLY WHERE NEEDED: needsLull(ch) below — a reception that surfaces on
  //    its own breath and envelopes gets none (a lull there only makes every
  //    tube pulse alike).
  //  Tuned on _picture-probe.js lull (遠/嵐 at sev 1, john-cage; near-clean
  //  share = the median share of hold at SSIM ≥ 0.7, worst = the worst 5 s
  //  window's surfaced run): a relative ease (depth 0.36–0.56, lift 0.08)
  //  could not do both — the snow-bound 遠s cleared (near-clean 0.14–0.19)
  //  while the worst 嵐s barely surfaced (worst 0.2–0.7 s). Targets: pT 0.05
  //  → near-clean 0.24, worst 1.0; pT 0.07 wT 0.16 → 0.06, 0.6; pT 0.065
  //  wT 0.15 gT 0.12 with dropEase 0.9 → 0.07, 1.0 (these).
  var LULL = { lift: 0.08, pT: 0.065, wT: 0.15, gT: 0.12, tT: 0.4, h: [0.9, 1], rise: [0.25, 0.6], flat: [0.7, 1.5], fall: [0.3, 0.8],
               gapMax: 3.6, pairP: 0.4, pairRest: 0.12, longRest: 0.6, off: [0.2, 2.7], liftCap: 0.84, dropEase: 0.9 };
  // the tear outside the hold (tuning, loss): today's amounts drive an event
  // rate, with jumps at least this big — the loss must still tear itself apart
  var TEAR_PHASE = { rate: 4.5, jump: 7, rows: 10, rec: 0.14 };

  // 今 TODAY — rc.91's look, restated in P1's axes (the nine bands are gone:
  // its tear is the event tear at rc.91's density). Never drawn; reachable on
  // the bench as force { archetype: "今" }, and the resting character of the
  // idle and dead tube (where only its snow and exit are read).
  var TODAY = {
    name: "今", archetype: "今", tier: "common", sev: 0.35, kinds: { "雪": 0.25, "影": 0.3, "裂": 0.2, "霞": 0, "伸": 0 },
    breath: { base: 0.82, parts: [[0.13, 1.1, 1], [0.05, 4.3, 2]] },
    snow: { gain: 1, sq: 0.85, lin: 0.08, keep: 0.35, floor: 0.45, span: 0.55, streak: 1, dark: 0, grain: 0, corr: 0, flicker: 0 },
    // one right-shifted echo: rc.91's 5 + 3·sin(t/900) tube px is 2 ± 1.2 source px
    ghosts: [{ d: 2, a: 0.186, drift: 1.2, per: 900, flut: 0, flutD: 0, ph: 0 }],
    tear: { rate: 0.6, rows: 16, jump: 5, rec: 0.12 },
    wash: { lift: 0, gain: 1 },
    swell: { amt: 0, lag: 0.5 },
    drop: { depth: 0.45, holdP: 0.3, holdMs: [100, 200], kinds: ["snow"] },
    env: {}, lull: null,
    // the exit (§3.5 "today's squash to a Paik line"): the raster squashes
    // with exponent `squash` over the collapse, the line rises lineAt s into
    // it over lineRise s, and falls over lineFall s of the burst
    exit: { squash: 1.6, lineAt: 0.22, lineRise: 0.2, lineFall: 0.12 },
  };
  // the clean reference (the probe's; force { clean: true }): no snow, no
  // ghosts, no tear, no wash, no swell, no lull; rc.91's breath
  var CLEAN_AXES = { name: "clean", archetype: null, kinds: { "雪": 0, "影": 0, "裂": 0, "霞": 0, "伸": 0 },
    snow: { gain: 0, grain: 0 }, ghosts: [], tear: { rate: 0, jump: 0 }, wash: { lift: 0, gain: 1 }, swell: { amt: 0 }, lull: null, env: {},
    drop: { depth: 0, holdP: 0, kinds: ["snow"] } };

  // 管 THE TUBE (§3.4) — the same set every night until P4 ages it per night
  // on "set:tube". Persistence is the alpha of the black laid over the last
  // frame each frame, per phase; the P39 ramp is the stops below at gamma 1.3.
  var TUBE = {
    gamma: 1.3,
    stops: [[0, 2, 6, 3], [0.2, 4, 20, 9], [0.45, 12, 72, 30], [0.7, 40, 152, 72], [0.88, 120, 226, 146], [1, 222, 255, 226]],
    decay: { idle: 0.5, dead: 0.11, burst: 0.7, lit: 0.62 },
  };

  // ==========================================================================
  // THE CHARACTER DRAW. drawCharacter(forkRng, ctx) → a character object.
  //
  // forkRng is the set's "set:rx:<seed>[:<piece>]" fork (PJ2.Rand stream);
  // null gives the resting character (今). Every draw below is on the fork, in
  // a fixed order, so a seed reproduces its reception's look exactly.
  //
  // ctx.force (the bench's `_dev.force`):
  //   { axes: { tear: { jump: 9 }, … } }  merged over the draw, last
  //   { archetype: "遠", sev? }           draw this archetype (or "今"); sev
  //                                       pins its severity (0..1) — "at its worst"
  //                                       is sev 1
  //   { impairment: "影", sev: 0.5 }       ONE kind alone at median axes (the
  //                                       "does it render" check, §6.3.2)
  //   { clean: true }                     the probe's clean reference
  // ==========================================================================
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(dst, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === "object" && !Array.isArray(dst[k])) merge(dst[k], src[k]);
      else dst[k] = clone(src[k]);
    }
    return dst;
  }
  function checkForce(f) {
    if (!f) return { ok: true };
    if (f.archetype != null && f.archetype !== "今" && !ARCH_BY_ID[f.archetype])
      return { ok: false, why: "no archetype '" + f.archetype + "' (P1 has " + ARCHETYPES.map(function (a) { return a.id; }).join(" ") + ", and 今)" };
    if (f.impairment != null && IMPAIRMENTS.indexOf(f.impairment) < 0)
      return { ok: false, why: LATER[f.impairment] ? "impairment '" + f.impairment + "' arrives in " + LATER[f.impairment] : "no impairment '" + f.impairment + "'" };
    return { ok: true };
  }
  // a fixed "draw" for median axes: every u is ½
  var MID = { next: function () { return 0.5; } };
  function lerp(a, b, u) { return a + (b - a) * u; }
  function rr(R, a, b) { return a + (b - a) * R.next(); }
  function pickW(R, pairs) { var tot = 0, i; for (i = 0; i < pairs.length; i++) tot += pairs[i][1]; var r = R.next() * tot; for (i = 0; i < pairs.length; i++) { r -= pairs[i][1]; if (r <= 0) return pairs[i][0]; } return pairs[pairs.length - 1][0]; }

  // ---- one kind's axes, at severity k (0..1), in a style's corner ----
  function drawSnow(R, k, style) {
    var s = { gain: 1, sq: 0.85, lin: 0.08, keep: 0.35, floor: 0.45, span: 0.55, streak: 1, dark: 0, grain: 0, corr: 0, flicker: 0 };
    if (style === "fringe" || style === "storm") {          // weak signal: grain smeared sideways by the IF bandwidth, black and white specks
      s.streak = rr(R, 1.4, 3.2); s.dark = rr(R, 0.08, 0.22); s.grain = rr(R, 0.35, 0.9) * (0.5 + k * 0.5); s.corr = rr(R, 0.3, 0.72); s.flicker = rr(R, 0.04, 0.2); s.keep = rr(R, 0.25, 0.45);
    } else if (style === "spark") {                          // impulse corner: long white dashes, in bursts
      s.streak = rr(R, 3, 7); s.dark = rr(R, 0, 0.08); s.grain = rr(R, 0, 0.15); s.corr = 0; s.flicker = rr(R, 0.3, 0.65); s.floor = rr(R, 0.55, 0.75); s.span = 1 - s.floor;
    } else {                                                 // a light secondary snow, any corner
      s.streak = rr(R, 1, 2.2); s.dark = rr(R, 0, 0.1); s.grain = rr(R, 0, 0.35) * k; s.corr = rr(R, 0, 0.45); s.flicker = rr(R, 0, 0.15);
    }
    s.gain = lerp(0.75, 1.25, R.next()) * (0.6 + 0.6 * k);
    return s;
  }
  function drawGhosts(R, k, style) {
    var out = [], n = 1, i;
    if (style === "multi" || style === "storm") n = 2 + (R.next() < 0.45 ? 1 : 0);
    for (i = 0; i < n; i++) {
      var g = { d: 0, a: 0, drift: 0, per: 900, flut: 0, flutD: 0, ph: 0 };
      if (style === "cochan") { g.d = rr(R, 10, 22); g.a = rr(R, 0.12, 0.26) * (0.6 + 0.6 * k); }
      else if (i === 0) { g.d = rr(R, 1.5, 5); g.a = rr(R, 0.16, 0.36) * (0.55 + 0.6 * k); }
      else { g.d = rr(R, 4, 16); g.a = rr(R, 0.08, 0.26) * (0.55 + 0.6 * k); }
      // a negative ghost: the reflection arrives half a cycle out (common, and convincing)
      var negP = style === "cochan" ? 0.5 : style === "multi" ? 0.35 : 0.2;
      if (R.next() < negP) g.a = -g.a * 0.9;
      // the aircraft: the reflector moves, the ghost's strength swings at 1–4 Hz
      var flP = style === "multi" ? 0.45 : style === "cochan" ? 0.2 : 0.15;
      if (R.next() < flP) { g.flut = style === "cochan" ? rr(R, 0.3, 1) : rr(R, 1, 4); g.flutD = rr(R, 0.4, 0.85); }
      g.drift = rr(R, 0, 0.5); g.per = rr(R, 700, 2600); g.ph = R.next() * 6.283;
      out.push(g);
    }
    // a leading echo (pre-ghost): the direct path is not always the first to arrive
    if ((style === "multi" || style === "storm") && R.next() < 0.22) out.push({ d: -rr(R, 1, 2.8), a: rr(R, 0.06, 0.14), drift: 0, per: 900, flut: 0, flutD: 0, ph: 0 });
    return out;
  }
  function drawTear(R, k, style) {
    if (style === "sync" || style === "storm") return { rate: rr(R, 0.8, 2.6) * (0.5 + 0.7 * k), rows: rr(R, 5, 22), jump: rr(R, 5, 16), rec: rr(R, 0.08, 0.35) };
    if (style === "spark") return { rate: rr(R, 0.6, 2) * (0.5 + 0.7 * k), rows: rr(R, 2, 6), jump: rr(R, 3, 10), rec: rr(R, 0.04, 0.1) };
    return { rate: rr(R, 0.2, 0.8) * (0.5 + 0.7 * k), rows: rr(R, 4, 14), jump: rr(R, 2.5, 8), rec: rr(R, 0.06, 0.2) };
  }
  function drawWash(R, k, style) {
    if (style === "hot") return { lift: -rr(R, 10, 30) * (0.5 + 0.5 * k), gain: 1 + rr(R, 0.25, 0.6) * (0.5 + 0.5 * k) };   // the whites crush
    if (style === "cochan") return { lift: rr(R, 10, 30) * (0.5 + 0.5 * k), gain: 1 - rr(R, 0.1, 0.25) * (0.5 + 0.5 * k) };
    return { lift: rr(R, 18, 55) * (0.4 + 0.6 * k), gain: 1 - rr(R, 0.15, 0.4) * (0.4 + 0.6 * k) };   // fog: lifted blacks, low contrast
  }
  function drawSwell(R, k) { return { amt: rr(R, 0.012, 0.045) * (0.5 + 0.6 * k), lag: rr(R, 0.15, 1.0) }; }
  // an envelope: its own slow life (the fade, §4.2) — 1 + Σ amp·sin(2π·hz·el + ph),
  // with an onset: the impairment arrives over `on` s after the lock
  function drawEnv(R, kind, style) {
    var parts = [[rr(R, 0.12, 0.4), rr(R, 0.025, 0.12), R.next() * 6.283], [rr(R, 0.05, 0.25), rr(R, 0.13, 0.45), R.next() * 6.283]];
    if (kind === "雪" && style === "spark") parts.push([rr(R, 0.4, 0.8), rr(R, 0.5, 1.4), R.next() * 6.283]);   // bursts
    if (kind === "影") parts.push([rr(R, 0, 0.15), rr(R, 0.3, 0.9), R.next() * 6.283]);
    return { parts: parts, on: R.next() < 0.35 ? rr(R, 0.5, 3) : 0 };
  }

  function drawCharacter(forkRng, ctx) {
    var f = (ctx && ctx.force) || null;
    var ch;
    if (!forkRng || (f && f.archetype === "今")) ch = clone(TODAY);
    else if (f && f.clean) ch = merge(clone(TODAY), CLEAN_AXES);
    else if (f && f.impairment) ch = single(f.impairment, f.sev != null ? +f.sev : 0.5, f.style || null);
    else ch = drawn(forkRng, f && f.archetype, f && f.sev != null ? +f.sev : null);
    if (f && f.axes) merge(ch, f.axes);
    return ch;
  }
  // ONE kind alone at median axes (every u = ½), on a clean reception — §6.3.2
  function single(kind, k, style) {
    var ch = merge(clone(TODAY), CLEAN_AXES);
    ch.name = kind + " alone"; ch.kinds[kind] = k;
    if (kind === "雪") { ch.snow = drawSnow(MID, k, style || "fringe"); ch.breath.base = CARRIER.top - CARRIER.drop * k; }
    if (kind === "影") ch.ghosts = drawGhosts(MID, k, style || "multi");
    if (kind === "裂") ch.tear = drawTear(MID, k, style || "sync");
    if (kind === "霞") ch.wash = drawWash(MID, k, style || "fringe");
    if (kind === "伸") ch.swell = drawSwell(MID, k);
    return ch;
  }
  function drawn(R, forcedArch, forcedSev) {
    var ch = clone(TODAY);
    var arch = forcedArch ? ARCH_BY_ID[forcedArch] : ARCH_BY_ID[pickW(R, ARCHETYPES.map(function (a) { return [a.id, a.w]; }))];
    if (forcedArch) R.next();                                 // the same draw count either way: forcing never shifts what follows
    ch.archetype = arch.id; ch.name = arch.id;
    var sev = SEV.lo + SEV.span * Math.pow(R.next(), SEV.pow);
    if (forcedSev != null) sev = forcedSev;                   // the bench's "at its worst" (force { archetype, sev })
    ch.tier = R.next() < SEV.uncommonP ? "uncommon" : "common";
    // the kinds and their severities: primaries at the reception's severity,
    // one light secondary (sometimes), and an uncommon reception's secondary
    // arrives at full strength
    var kinds = {}, styles = {};
    var prim = arch.prim, i;
    if (!prim) {                                               // 嵐: two primaries from two different archetypes
      var pool = ARCHETYPES.filter(function (a) { return a.prim && a.prim.length; });
      var a1 = pool[Math.floor(R.next() * pool.length)], rest = pool.filter(function (a) { return a !== a1; }), a2 = rest[Math.floor(R.next() * rest.length)];
      sev = 0.7 + 0.3 * R.next();
      if (forcedSev != null) sev = forcedSev;
      prim = [];
      [a1, a2].forEach(function (a) { a.prim.forEach(function (kk) { if (prim.indexOf(kk) < 0) { prim.push(kk); styles[kk] = a.style; } }); });
    }
    for (i = 0; i < prim.length; i++) { kinds[prim[i]] = Math.min(1, sev * (0.85 + 0.3 * R.next())); if (!styles[prim[i]]) styles[prim[i]] = arch.style; }
    // (清 stays clean: its one secondary is always light, whatever the tier)
    var secK = ch.tier === "uncommon" && arch.id !== "清" ? 0.75 + 0.25 * R.next() : arch.id === "清" ? 0.1 + 0.15 * R.next() : 0.15 + 0.3 * R.next();
    var secPick = arch.sec.length ? arch.sec[Math.floor(R.next() * arch.sec.length)] : null;
    var secOn = R.next() < (ch.tier === "uncommon" ? 1 : SEV.secP);
    if (secPick && secOn && kinds[secPick] == null) { kinds[secPick] = secK; styles[secPick] = "sec"; }
    ch.sev = +sev.toFixed(4);
    // every kind's axes are drawn whether or not the kind is on, in a fixed
    // order, so a forced archetype and a drawn one consume the fork alike
    var sn = drawSnow(R, kinds["雪"] || 0, styles["雪"] || "sec");
    var gh = drawGhosts(R, kinds["影"] || 0, styles["影"] || "sec");
    var te = drawTear(R, kinds["裂"] || 0, styles["裂"] || "sec");
    var wa = drawWash(R, kinds["霞"] || 0, styles["霞"] || "sec");
    var swl = drawSwell(R, kinds["伸"] || 0);
    // a kind that is off still has snow (a carrier always has some) at the
    // clean corner; ghosts, tears, wash and swell are simply absent
    var kSnow = kinds["雪"] != null ? kinds["雪"] : 0.08 + 0.12 * R.next();
    if (kinds["雪"] == null) { sn.gain = 0.55 + 0.25 * R.next(); sn.grain = 0; sn.streak = 1 + R.next(); }
    if (arch.id === "清") { kSnow *= 0.3; sn.gain *= 0.5; sn.dark = 0; }   // 清: a perfect catch — the faintest snow, no black specks
    ch.snow = sn;
    ch.ghosts = kinds["影"] != null ? gh : [];
    ch.tear = kinds["裂"] != null ? te : { rate: 0.12 + 0.2 * R.next(), rows: te.rows, jump: te.jump * 0.6, rec: te.rec };
    ch.wash = kinds["霞"] != null ? wa : { lift: 0, gain: 1 };
    ch.swell = kinds["伸"] != null ? swl : { amt: 0, lag: 0.5 };
    ch.kinds = { "雪": +(kinds["雪"] || 0).toFixed(4), "影": +(kinds["影"] || 0).toFixed(4), "裂": +(kinds["裂"] || 0).toFixed(4), "霞": +(kinds["霞"] || 0).toFixed(4), "伸": +(kinds["伸"] || 0).toFixed(4) };
    // the carrier rests where its snow says (§4.2 "the breath is drawn"):
    // one to three partials, their rates and depths drawn, not 1.1 and 4.3
    var np = 1 + Math.floor(R.next() * 3), parts = [];
    for (i = 0; i < np; i++) parts.push([+(rr(R, 0.02, 0.12) / (1 + i * 0.4)).toFixed(4), +rr(R, 0.4, 5).toFixed(3), 1 + Math.floor(R.next() * 3)]);
    ch.breath = { base: +(CARRIER.top - CARRIER.drop * kSnow).toFixed(4), parts: parts };
    // the envelopes, one per kind, each on its own timeline
    ch.env = {};
    IMPAIRMENTS.forEach(function (kk) { ch.env[kk] = drawEnv(R, kk, styles[kk]); });
    // the dropouts: what each one DOES, drawn once for the reception (§4.2),
    // indexed by the dropout's place in the plan
    var dw = []; for (var dk in arch.drops) if (arch.drops[dk] > 0) dw.push([dk, arch.drops[dk]]);
    var dl = []; for (i = 0; i < 16; i++) dl.push(pickW(R, dw));
    ch.drop = { depth: +rr(R, 0.3, 0.58).toFixed(3), holdP: 0.3, holdMs: [100, 200], kinds: dl };
    // the surfacing lull (§11.2): drawn either way, so the fork is consumed
    // alike; kept only where the reception would not surface without it
    var lull = { key: Math.floor(R.next() * 4294967296) >>> 0, off: +rr(R, LULL.off[0], LULL.off[1]).toFixed(3) };
    ch.lull = needsLull(ch) ? lull : null;
    return ch;
  }

  // ==========================================================================
  // PER-FRAME LEVELS — the character, at `el` s into its piece
  // ==========================================================================
  function envAt(E, el) {
    if (!E) return 1;
    var v = 1, p = E.parts;
    for (var i = 0; i < p.length; i++) v += p[i][0] * Math.sin(6.2832 * p[i][1] * el + p[i][2]);
    if (E.on > 0 && el < E.on) v *= 0.4 + 0.6 * el / E.on;
    return v < 0 ? 0 : v;
  }
  // the lull's schedule: lull n is [start, flatStart, flatEnd, end, h], each
  // drawn from hash(key, n) — built lazily as the hold runs on, cached per
  // lull object (a WeakMap: the character stays plain JSON)
  function hashU(key, n, j) {
    var a = (key ^ Math.imul(n + 1, 0x9E3779B1) ^ Math.imul(j + 1, 0x85EBCA77)) >>> 0;
    a = Math.imul(a ^ (a >>> 16), 0x7FEB352D); a = Math.imul(a ^ (a >>> 15), 0x846CA68B); a ^= a >>> 16;
    return (a >>> 0) / 4294967296;
  }
  var SCHED = typeof WeakMap === "function" ? new WeakMap() : null;
  function lullSchedule(L, until) {
    var sc = SCHED && SCHED.get(L);
    if (!sc) { sc = []; if (SCHED) SCHED.set(L, sc); }
    while (!sc.length || sc[sc.length - 1][3] <= until) {
      var n = sc.length, u = function (j) { return hashU(L.key, n, j); };
      var rise = lerp(LULL.rise[0], LULL.rise[1], u(0)), flat = lerp(LULL.flat[0], LULL.flat[1], u(1)), fall = lerp(LULL.fall[0], LULL.fall[1], u(2)), h = lerp(LULL.h[0], LULL.h[1], u(3));
      var start;
      if (!n) start = L.off;
      else {
        var prev = sc[n - 1], span = Math.max(0, LULL.gapMax - (prev[3] - prev[2]) - rise);   // fall + rest + rise ≤ gapMax
        var v = u(4), rest = u(5) < LULL.pairP ? LULL.pairRest * v : LULL.longRest + (1 - LULL.longRest) * v;   // a quick second rise, or a long wait
        start = prev[3] + span * rest;
      }
      sc.push([start, start + rise, start + rise + flat, start + rise + flat + fall, h]);
      if (sc.length > 4000) break;
    }
    return sc;
  }
  // the lull's level at `el` s into the piece: 0, or rising to h, h through
  // the flat, falling back (smoothstep); lulls never overlap
  function lullAt(L, el) {
    if (!L || el < L.off) return 0;
    var sc = lullSchedule(L, el), lo = 0, hi = sc.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (sc[mid][0] <= el) lo = mid; else hi = mid - 1; }
    var e = sc[lo], k;
    if (el >= e[3]) return 0;
    if (el < e[1]) k = (el - e[0]) / (e[1] - e[0]); else if (el < e[2]) k = 1; else k = 1 - (el - e[2]) / (e[3] - e[2]);
    return e[4] * k * k * (3 - 2 * k);
  }
  // WHO GETS A LULL (critic P1 r1 item 1c): a reception whose picture would
  // stay buried without one. The estimate, from the character alone:
  //   3·p          the spark density at the carrier's resting level (p is
  //                sourcePass's before envelopes: (lvl²·sq + lvl·lin)·gain)
  //   + 0.5·g·lvl  the band-limited grain at that level
  //   + 1.5·Σ|a|   the echoes (a strong multipath fan buries a face as surely
  //                as snow does: a 反 with three echoes summing 0.57 failed)
  //   + 2·(1 − wash gain)   the fog's lost contrast
  //   + 1·(wash gain − 1)   or the crush of a hot picture's whites
  //   + rate·min(1.5, jump/10)·lvl   the sync's tears, as far as the carrier
  //                is weak (an uncommon 同 with a full-strength secondary snow
  //                failed on snow and tears together; a 同 on a strong
  //                carrier surfaces between its tears)
  // Fitted (weights on a grid, for the lowest incidence that still covers
  // every need) on 226 receptions run with the lull OFF: _picture-probe.js
  // lullcal (144: three reels + 遠/嵐 at sev 0.7–1), the lull mode's 24, and
  // the receptions of two legibility runs that drew no lull (58). Every one
  // that failed to surface, or surfaced with a worst window under 0.8 s (38),
  // scored ≥ 0.951; BURY_LINE sits 10 % under that. 20,000 drawn receptions:
  // 32 % get a lull (嵐 80 %, 遠 54 %, 反 39 %, 電 32 %, 混 20 %, 過 11 %,
  // 同 9 %, 清 none). 嵐 is not given one by name. Checked on fresh seeds
  // (lullcal --built --seed0 2001) — see the r2 handoff.
  var BURY_LINE = 0.856;
  function burial(ch) {
    var lvl = 1 - (ch.breath ? ch.breath.base : 0.82), sn = ch.snow || {}, wa = ch.wash || { lift: 0, gain: 1 }, te = ch.tear || {}, gs = 0;
    var p = (lvl * lvl * (sn.sq != null ? sn.sq : 0.85) + lvl * (sn.lin != null ? sn.lin : 0.08)) * (sn.gain || 0);
    (ch.ghosts || []).forEach(function (g) { gs += Math.abs(g.a); });
    return 3 * p + 0.5 * (sn.grain || 0) * lvl + 1.5 * gs + 2 * Math.max(0, 1 - wa.gain) + Math.max(0, wa.gain - 1) + (te.rate || 0) * Math.min(1.5, (te.jump || 0) / 10) * lvl;
  }
  function needsLull(ch) { return burial(ch) > BURY_LINE; }
  // the hold's breath (§4.2: drawn partials)
  function breath(br, el, seed) {
    var v = br.base;
    for (var i = 0; i < br.parts.length; i++) { var q = br.parts[i]; v = v + q[0] * Math.sin(el * q[1] + seed * q[2]); }
    return v;
  }

  // ==========================================================================
  // THE IMPAIRMENT LIBRARY — pure functions over the 192×144 buffers.
  // ==========================================================================

  // P39 lookup tables for a tube (the Uint8Array stores truncate).
  function tubeLUT(tube) {
    var R = new Uint8Array(256), G = new Uint8Array(256), Bl = new Uint8Array(256);
    var stops = tube.stops, gamma = tube.gamma;
    for (var i = 0; i < 256; i++) {
      var t = Math.pow(i / 255, gamma), a = stops[0], b = stops[1];
      for (var k = 1; k < stops.length; k++) { if (t <= stops[k][0]) { a = stops[k - 1]; b = stops[k]; break; } }
      var u = (t - a[0]) / (b[0] - a[0] || 1);
      R[i] = a[1] + (b[1] - a[1]) * u; G[i] = a[2] + (b[2] - a[2]) * u; Bl[i] = a[3] + (b[3] - a[3]) * u;
    }
    return { R: R, G: G, B: Bl };
  }

  // a unit-variance Gaussian by table (inverse CDF at 1024 midpoints) — the
  // band-limited grain's raw noise; one rnd per sample
  var GAUSS = (function () {
    var t = new Float32Array(1024);
    for (var i = 0; i < 1024; i++) {
      var p = (i + 0.5) / 1024, q = p < 0.5 ? p : 1 - p, s = Math.sqrt(-2 * Math.log(q));
      var z = s - (2.515517 + 0.802853 * s + 0.010328 * s * s) / (1 + 1.432788 * s + 0.189269 * s * s + 0.001308 * s * s * s);
      t[i] = p < 0.5 ? -z : z;
    }
    return t;
  })();

  // PASS 1a — LUMA. RGBA from the source canvas → luma (float), and the
  // picture's mean level (for 伸).
  function lumaPass(sdata, L, n) {
    var sum = 0;
    for (var i = 0, p = 0; p < n; p++, i += 4) { var l = 0.299 * sdata[i] + 0.587 * sdata[i + 1] + 0.114 * sdata[i + 2]; L[p] = l; sum += l; }
    return sum / n;
  }
  // PASS 1b — 影 GHOSTS, at source resolution, IN the signal (a multipath
  // echo is a copy of the transmitted picture, so it carries no snow and it
  // moves with the content, not the clock). Each echo: `d` source px late
  // (fractional; negative = a pre-ghost), amplitude `a` (negative = inverted).
  // The receiver's AGC takes back some of the extra light. out = L + Σ a·L(x−d).
  function ghostPass(L, out, SWp, SHp, list) {
    out.set(L);
    if (!list.length) return;
    var agc = 0, gi, x, y;
    for (gi = 0; gi < list.length; gi++) if (list[gi].a > 0) agc += list[gi].a;
    for (gi = 0; gi < list.length; gi++) {
      var g = list[gi], a = g.a, di = Math.floor(g.d), f = g.d - di, a0 = a * (1 - f), a1 = a * f;
      for (y = 0; y < SHp; y++) {
        var base = y * SWp;
        for (x = 0; x < SWp; x++) {
          var xs = x - di, v = 0;
          if (xs >= 0 && xs < SWp) v += a0 * L[base + xs];
          if (xs - 1 >= 0 && xs - 1 < SWp) v += a1 * L[base + xs - 1];
          out[base + x] += v;
        }
      }
    }
    if (agc > 0) { var k = 1 / (1 + 0.5 * agc), n = SWp * SHp; for (x = 0; x < n; x++) out[x] *= k; }
  }
  // PASS 1c — DRIVE, 霞 WASH and 雪 SNOW into the luma bytes. `mode` "idle",
  // "dead" or "lit"; `level` the snow level 0..1 (1 − carrier); `bri` the 輝度
  // step ({lift, gain}); `sn` the snow axes, `wa` the wash (lift, gain) at this
  // frame's strength; `fl` this frame's snow multiplier (envelope × flicker).
  //
  // THE SNOW, enriched (§3.1). A spark STARTS with probability p/streak and
  // runs on sideways for ~streak px, fading (weak-signal snow streaks because
  // the IF bandwidth smears it); a `dark` share of them are black specks
  // instead; under them, band-limited grain: Gaussian noise through a one-pole
  // filter along the line (corr), scaled to the snow level. Density at streak
  // 1 is rc.91's p = level²·sq + level·lin.
  function sourcePass(L, luma, n, mode, level, bri, sn, wa, fl, rnd) {
    var lift = bri.lift, gain = bri.gain, i, l;
    if (mode === "idle" || mode === "dead") {
      var sq = sn.sq, lin = sn.lin, keep = sn.keep, floor = sn.floor, span = sn.span, ps = level * level * sq + level * lin;
      for (i = 0; i < n; i++) {
        if (mode === "idle") {
          l = L[i] * 0.9 + (rnd() < 0.002 ? 30 + rnd() * 50 : 0);   // thermal sparks
          if (level > 0 && rnd() < ps) l = l * keep + rnd() * 255 * (floor + span * rnd());   // 掃引
        } else l = level > 0 && rnd() < ps ? rnd() * 255 * (floor + span * rnd()) : 0;
        luma[i] = l < 0 ? 0 : l > 255 ? 255 : l | 0;
      }
      return;
    }
    var p = (level * level * sn.sq + level * sn.lin) * sn.gain * fl; if (p > 0.95) p = 0.95;
    var st = sn.streak > 1 ? sn.streak : 1, pStart = p / st, dark = sn.dark, keepS = sn.keep, fS = sn.floor, spS = sn.span;
    var gAmp = sn.grain * level * 70 * fl, c = sn.corr, gNorm = Math.sqrt((1 + c) / (1 - c + 1e-6)), wl = wa.lift, wg = wa.gain;
    var run = 0, sv = 0, g = 0;
    for (i = 0; i < n; i++) {
      if (i % SW === 0) { run = 0; g = 0; }
      l = (L[i] - lift) * gain;                              // 輝度: the beam's drive
      l = l * wg + wl;                                       // 霞: the veil (or the crush)
      if (run > 0) { run--; sv *= 0.82; var lr = l * keepS + sv; if (lr > l) l = lr; }   // the streak's tail only ever adds light
      else if (p > 0 && rnd() < pStart) {
        if (dark > 0 && rnd() < dark) l = l * 0.3;            // a dark speck (weak-signal snow is black as well as white)
        else { sv = rnd() * 255 * (fS + spS * rnd()); l = l * keepS + sv; run = st > 1 ? (rnd() * 2 * (st - 1) + 0.5) | 0 : 0; }
      }
      if (gAmp > 0) { g = c * g + (1 - c) * GAUSS[(rnd() * 1024) | 0]; l += g * gNorm * gAmp; }
      luma[i] = l < 0 ? 0 : l > 255 ? 255 : l | 0;
    }
  }

  // PASS 2 — GEOMETRY: THE PER-LINE OFFSET MAP (§3.2), line-accurate, in
  // SOURCE px, applied while copying rows (one pass; §5.1). A displaced line
  // shows the horizontal blanking at its leading edge and, displaced further
  // than the blanking, the end of the line wrapping in — as a real line does.
  // Offsets are fractional (linear between the two nearest pixels).
  function geometryCopy(src, dst, map, SWp, SHp) {
    var P = SWp + HBLANK;
    for (var y = 0; y < SHp; y++) {
      var base = y * SWp, off = map[y];
      if (off === 0) { for (var x0 = 0; x0 < SWp; x0++) dst[base + x0] = src[base + x0]; continue; }
      var oi = Math.floor(off), f = off - oi;
      for (var x = 0; x < SWp; x++) {
        var k0 = ((x - oi) % P + P) % P, k1 = k0 === 0 ? P - 1 : k0 - 1;
        var v0 = k0 < SWp ? src[base + k0] : 0, v1 = k1 < SWp ? src[base + k1] : 0;
        dst[base + x] = (v0 + (v1 - v0) * f) | 0;
      }
    }
  }
  // 裂 THE TEAR, line-accurate (§3.2). A sync impulse at row y0 kicks the
  // line oscillator: the lines below are displaced by J and pull back down
  // the frame (e-fold over `rows` lines) and over time (e-fold over `rec` s).
  // Events are texture (where and how big, from rnd); how often, how far and
  // how fast they recover are the character's axes. `tears` persists in the
  // set between frames; this spawns (rate · dt), ages, and fills the map.
  function tearStep(tears, tr, rate, dtS, t, rnd, minJump) {
    var n = rate * dtS, jump = Math.max(tr.jump, minJump || 0);
    while (n > 0) { if (rnd() < Math.min(1, n)) tears.push({ y0: (rnd() * SH) | 0, J: (rnd() < 0.5 ? -1 : 1) * jump * (0.5 + rnd()), rows: tr.rows * (0.6 + 0.8 * rnd()), t0: t, rec: tr.rec }); n -= 1; }
    if (tears.length > 12) tears.splice(0, tears.length - 12);
  }
  function lineMap(map, tears, t, shear) {
    for (var r = 0; r < SH; r++) map[r] = 0;
    var any = false;
    for (var i = tears.length - 1; i >= 0; i--) {
      var e = tears[i], k = Math.exp(-(t - e.t0) / 1000 / e.rec);
      if (k < 0.03) { tears.splice(i, 1); continue; }
      var J = e.J * k, r1 = Math.min(SH, e.y0 + Math.ceil(e.rows * 4));
      for (var r2 = e.y0; r2 < r1; r2++) map[r2] += J * Math.exp(-(r2 - e.y0) / e.rows);
      any = true;
    }
    // a brief loss of horizontal lock (a dropout's; §4.2): the lines shear
    if (shear) { for (var r3 = 0; r3 < SH; r3++) map[r3] += shear.c + shear.s * (r3 - SH / 2); any = true; }
    return any;
  }

  // 影 this frame's echo list, from the character: delay (with a slow drift —
  // a moving reflector), amplitude through its envelope, the flutter, and the
  // direct signal's weakness (a weak direct path lets the echo read louder)
  function ghostList(ch, ph, strength, t, envG, out) {
    out.length = 0;
    if (ph !== "hold" && ph !== "loss" && ph !== "tuning" && ph !== "relock") return out;
    for (var i = 0; i < ch.ghosts.length; i++) {
      var g = ch.ghosts[i];
      var fl = g.flut > 0 ? 1 + g.flutD * Math.sin(6.2832 * g.flut * t / 1000 + g.ph) : 1;
      out.push({ d: g.d + g.drift * Math.sin(t / g.per + g.ph), a: g.a * envG * fl * (0.85 + 0.8 * (1 - strength)) });
    }
    return out;
  }

  // PASS 4 — THE TUBE. Luma → P39 RGBA. On an idle tube a faint raster glow
  // is added AFTER the LUT (the tube is warm, not lit): a breathing level, a
  // crawl down the rows, a vignette (rc.91's arithmetic).
  function tubePass(luma, pdata, SWp, SHp, lut, idleGlow, idleK, crawl) {
    var LR = lut.R, LG = lut.G, LB = lut.B;
    for (var p = 0, y = 0; y < SHp; y++) {
      if (idleGlow > 0) {
        var rowGlow = idleGlow + 3.5 * idleK * Math.sin(y * 0.55 - crawl);
        var vign = 1 - Math.abs(y - SHp / 2) / SHp * 0.7;
        for (var x = 0; x < SWp; x++, p++) {
          var l = luma[p], q = p << 2;
          var g = rowGlow * vign * (1 - Math.abs(x - SWp / 2) / SWp * 0.6);
          pdata[q] = LR[l] + g * 0.22; pdata[q + 1] = LG[l] + g; pdata[q + 2] = LB[l] + g * 0.42; pdata[q + 3] = 255;
        }
      } else {
        for (var x2 = 0; x2 < SWp; x2++, p++) {
          var l2 = luma[p], q2 = p << 2;
          pdata[q2] = LR[l2]; pdata[q2 + 1] = LG[l2]; pdata[q2 + 2] = LB[l2]; pdata[q2 + 3] = 255;
        }
      }
    }
  }

  // a seeded texture stream for the bench (`_dev.seedTexture`): mulberry32.
  // NEVER used in production — texture there is Math.random, by contract.
  function textureRng(n) {
    var a = (n >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  var API = {
    SW: SW, SH: SH, HBLANK: HBLANK,
    TODAY: TODAY, TUBE: TUBE, ARCHETYPES: ARCHETYPES, IMPAIRMENTS: IMPAIRMENTS, LATER: LATER,
    SEV: SEV, CARRIER: CARRIER, LULL: LULL, TEAR_PHASE: TEAR_PHASE,
    drawCharacter: drawCharacter, checkForce: checkForce,
    envAt: envAt, lullAt: lullAt, lullSchedule: lullSchedule, burial: burial, needsLull: needsLull, BURY_LINE: BURY_LINE, breath: breath,
    tubeLUT: tubeLUT, lumaPass: lumaPass, ghostPass: ghostPass, sourcePass: sourcePass,
    geometryCopy: geometryCopy, tearStep: tearStep, lineMap: lineMap, ghostList: ghostList, tubePass: tubePass,
    textureRng: textureRng,
  };
  if (root) root.ZankyoPicture = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : null);

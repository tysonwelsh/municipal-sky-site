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
// P1 DRAWS the character (§4.1–4.2): an archetype — the condition the signal
// arrives in — and from it the impairments, each with its own axes drawn from
// a range, its own envelope on its own timeline, a slow fade, a drawn breath,
// a list of what each dropout does, and a surfacing lull (§11.2: every
// reception lets the picture come up now and then). The P1 kinds are the
// EXISTING effects, enriched:
//   雪 snow   sparks that streak sideways, dark specks (streaked too, P2),
//             band-limited grain, flicker — not one formula of white sparks
//   影 ghosts one to three echoes at fixed delays, some negative, a leading
//             pre-ghost, and the aircraft flutter; at SOURCE resolution now
//   裂 tear   line-accurate: a sync impulse displaces the lines below a random
//             height and they pull back down the frame and over time — not
//             nine equal bands; the horizontal blanking shows when a line is
//             displaced past it
//   霞 wash   lifted blacks and low contrast (a weak signal with the contrast up)
//   伸 swell  the raster breathes with the beam current, lagged
// P2 (this state) adds the NEW kinds (§3.1–3.3, §5.4), each with its physical
// cause, each moving the way that cause moves:
//   点 impulse  ignition and switch arcs: short white dashes, one line tall,
//               with the IF's dark ring after them, arriving in BURSTS (a car
//               passing) — or, an engine idling, at a steady rate that lands
//               them on slowly crawling heights
//   縞 herring  a co-channel carrier's beat: fine diagonal stripes drifting at
//               the beat, zig-zagged (the herringbone) where the sound
//               carrier's FM wobbles it, wandering slowly in angle
//   帯 hum      mains ripple: one or two broad soft bars, darker or lighter,
//               rolling at a slow CONSTANT beat (P4 locks it to the audio LFO)
//   混 xtalk    a second station on the channel: its picture faintly under
//               ours (the set's frame memory, §5.4, or the test card), sliding
//               on its own unlocked sync with its own blanking bars, behind
//               venetian-blind stripes (the two carriers' beat)
//   横 skew     horizontal sync lost: the lines shear into diagonal bars that
//               slide, then straighten with a wobble as the AFC relocks —
//               episodes, not a state
//   旗 flag     timebase error at the top of the field: the top rows hook
//               sideways, fluttering
//   揺 jitter   noisy sync: every line shivers, neighbours correlated
//   捩 wave     hum on the sync / AFC hunting: verticals ripple as a slow
//               S-curve crawling down the frame
//   滲 smear    narrow IF bandwidth or mistuning: a resonant low-pass along
//               each line — edges drag right with a ringing outline after them
//   飽 agc      overload: the gain too high (whites clip, blacks crush), a
//               lagging AGC that overshoots when a station (or a scene)
//               arrives and pumps, and now and then the sync crushes into a
//               brief NEGATIVE picture
// Every kind is a pure function over the 192×144 buffers or the per-line
// offset map (below); nothing is RGB, nothing is a block (§2.1).
// P3 (§3.5) draws what happens INSIDE the receiver's windows, per reception:
// the lock-in (snap, roll, bars, fade, bloom, ghost — from the pool its entry
// shape allows; 浮's impairments walk down as it drifts in), each 探 glimpse's
// own (roll, bars, ghost, fade), a relock's as a new station's, the loss
// (squash, roll, snow, bars, freeze, neg, vline, burn — from its exit shape's
// pool; 絶 keeps its hard cut), and 焼 burn-in (the last reception's picture
// worn into the phosphor, on some nights). The windows themselves are the
// receiver's and do not move (_picture-probe.js bounds).
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
  // prim: the kinds it always has, at the reception's severity (pick [lo, hi]:
  // only that many of them, drawn — so a bad-sync night is not always the same
  // three faults); sec: the pool one light secondary is drawn from; style:
  // which corner of each kind's ranges it draws from; drops: what its dropouts
  // do (§4.2), by weight.
  // P2: the stand-ins are gone — every archetype draws §4.1's own primaries
  // and secondary pool (遠's 縦 slips are its roll dropouts; 同's 縦 too).
  var ARCHETYPES = [
    { id: "遠", w: 0.22, story: "fringe: a distant station at the edge of range",
      prim: ["雪", "霞"], sec: ["点", "揺", "滲"], style: "fringe",
      drops: { snow: 4, roll: 3, tear: 1, hold: 1, hlock: 0 } },
    { id: "反", w: 0.18, story: "multipath: city or mountain reflections",
      prim: ["影"], sec: ["滲", "裂"], style: "multi",
      drops: { snow: 2, hold: 3, roll: 1, tear: 1, hlock: 0 } },
    { id: "混", w: 0.12, story: "co-channel: two stations on one channel",
      prim: ["縞", "混"], pick: [1, 2], sec: ["帯", "雪"], style: "cochan",
      drops: { snow: 3, hold: 1, roll: 1, tear: 0, hlock: 1 } },
    { id: "電", w: 0.13, story: "local noise: machinery or a car nearby",
      prim: ["点", "帯"], sec: ["裂", "揺"], style: "spark",
      drops: { snow: 2, tear: 4, roll: 1, hold: 1, hlock: 0 } },
    { id: "同", w: 0.15, story: "bad sync: a tired set, an unstable transmitter",
      prim: ["横", "旗", "捩"], pick: [1, 2], sec: ["揺", "裂"], style: "sync",
      drops: { roll: 4, hlock: 3, tear: 3, snow: 1, hold: 1 } },
    { id: "過", w: 0.08, story: "overload: too close, too strong",
      prim: ["飽"], sec: ["伸", "影"], style: "hot",
      drops: { snow: 1, hold: 2, roll: 1, tear: 1, hlock: 0 } },
    { id: "清", w: 0.07, story: "clean: a rare perfect catch",
      prim: [], sec: ["影", "伸", "滲"], style: "clean",
      drops: { snow: 3, hold: 1, roll: 0, tear: 0, hlock: 0 } },
    { id: "嵐", w: 0.05, story: "storm: everything at once, briefly",
      prim: null, sec: [], style: "storm",
      drops: { snow: 2, roll: 2, tear: 2, hold: 1, hlock: 2 } },
  ];
  var ARCH_BY_ID = {}; ARCHETYPES.forEach(function (a) { ARCH_BY_ID[a.id] = a; });

  // every kind the library draws (P1's five, then P2's ten), and the field of
  // the character that holds each P2 kind's axes (null when the kind is off)
  var IMPAIRMENTS = ["雪", "影", "裂", "霞", "伸", "点", "縞", "帯", "混", "横", "旗", "揺", "捩", "滲", "飽"];
  var FIELD = { "点": "impulse", "縞": "herring", "帯": "hum", "混": "xtalk", "横": "skew", "旗": "flag", "揺": "jitter", "捩": "wave", "滲": "smear", "飽": "agc" };
  var P2_KINDS = ["点", "縞", "帯", "混", "横", "旗", "揺", "捩", "滲", "飽"];
  var LATER = {};                    // P2: nothing is refused by name any more

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
  //  P2: the new kinds ease the same way, each to its own target at the
  //  lull's top — 点's sparks per frame to iT, 縞's stripe amplitude (luma
  //  levels) to hbT, 帯's bar depth to humT, 混's other picture to xtT, 旗's
  //  hook (px) to flagT, 揺's shiver (px) to jitT, 捩's ripple (px) to
  //  waveT, 飽's excess gain to agT; 横's losses of lock are knocked down by
  //  dropEase like a dropout (a good moment of the fading holds sync better);
  //  滲 is the tuner's bandwidth and does not ease.
  var LULL = { lift: 0.08, pT: 0.065, wT: 0.15, gT: 0.12, tT: 0.4, h: [0.9, 1], rise: [0.25, 0.6], flat: [0.7, 1.5], fall: [0.3, 0.8],
               gapMax: 3.6, pairP: 0.4, pairRest: 0.12, longRest: 0.6, off: [0.2, 2.7], liftCap: 0.84, dropEase: 0.9,
               iT: 0.8, hbT: 4, humT: 0.08, xtT: 0.07, flagT: 2.5, jitT: 0.5, waveT: 1.0, agT: 0.15 };
  // the tear outside the hold (tuning, loss): today's amounts drive an event
  // rate, with jumps at least this big — the loss must still tear itself apart
  var TEAR_PHASE = { rate: 4.5, jump: 7, rows: 10, rec: 0.14 };

  // 出入 ENTRIES AND EXITS (§3.5, P3). The receiver owns every window (§2.3):
  // the arrival (即 0.4 s · 探 3–8 · 浮 6–10), a relock (戻 0.2 s), the loss
  // (切 1.6–2.8 · 残 6–12 · 絶 0.02), then collapse 0.42, burst 0.32, dead
  // 1.6. Nothing here reads or moves one of them — zk-set.js's phaseOf is
  // untouched and the probe's `bounds` mode holds every phase boundary of 48
  // shapes to rc.P4's and rc.91's frame for frame. What is DRAWN inside them
  // is drawn per reception, from the pool its shape allows:
  //
  // THE LOCK-IN (a reception's first piece; a relock or a 走 swap is a new
  // station and draws from `relock`):
  //   snap   rc.91's: the carrier comes up over the window, the sync kicking
  //   roll   the vertical hold is loose on arrival: the picture rolls in with
  //          its blanking bar, slows, and slides into place the way it was
  //          rolling (the hold catching)
  //   bars   the line oscillator arrives off frequency: diagonal bars sliding
  //          sideways that straighten as the AFC pulls in, relocking on the
  //          nearest whole line, with a last swing as the loop settles
  //   fade   a clean carrier rising out of the noise, no kicks — for 即 it
  //          runs on past the 0.4 s window into the hold's first second or so
  //          (the window is the receiver's; how far the carrier has come up
  //          when the audio opens is ours)
  //   bloom  the AGC was wide open on the empty channel: the station arrives
  //          blown out, whites crushed into the clip, and the AGC pulls it
  //          down with a little undershoot
  //   ghost  the reflected path locks first: the picture arrives as its own
  //          echo, displaced, and the direct path comes up through it
  // 浮's native lock-in is the fade (its drift IS a fade); whichever it draws,
  // its impairments also WALK DOWN as it drifts in (× `walk` at the start of
  // the drift, × 1 at the lock). 探 hunts through glimpses that each draw
  // their own (§3.5 "each glimpse draws its own mix": roll, bars, ghost or
  // fade, a peak and an amount — each nearly catches and loses again); the
  // hunt's final catch, having no window of its own, plays over the hold's
  // first moment. An archetype LEANS its lock-in toward its own cause (§4:
  // coherent damage — a multipath station tends to arrive ghost-first, an
  // overload blown out, a tired set rolling or in bars).
  var ENTRY = {
    modes: ["snap", "roll", "bars", "fade", "bloom", "ghost"],
    pools: {
      soku:   { snap: 0.34, roll: 0.14, bars: 0.14, fade: 0.14, bloom: 0.12, ghost: 0.12 },
      tan:    { snap: 0.30, roll: 0.20, bars: 0.20, bloom: 0.15, ghost: 0.15 },
      fu:     { fade: 0.40, roll: 0.20, bars: 0.20, ghost: 0.20 },
      relock: { snap: 0.40, roll: 0.15, bars: 0.20, bloom: 0.10, ghost: 0.15 },
    },
    glimpse: { roll: 0.30, bars: 0.25, ghost: 0.20, fade: 0.25 },
    lean: { "反": { ghost: 3 }, "過": { bloom: 4 }, "同": { roll: 2, bars: 2.5 }, "遠": { fade: 2, roll: 1.5 },
            "電": { bars: 1.5 }, "混": { ghost: 1.5, fade: 1.5 }, "清": { snap: 2 } },
  };
  // THE LOSS (the loss window) and what the collapse and burst windows show:
  //   squash rc.91's: the carrier sinks with stutters, the hold slipping, the
  //          raster squashes to Paik's line, the line falls in the burst
  //   roll   the vertical hold lets go: the picture rolls away, faster and
  //          faster, still rolling as it squashes to the line
  //   snow   the carrier sinks smoothly into the noise — no slips, no
  //          stutter — and the collapse is all snow: nothing is left to squash
  //   bars   horizontal lock goes: the lines shear into more and more
  //          diagonal bars, sliding faster, then black (the collapse is dark)
  //   freeze the station's own frame store holds its last frame and the snow
  //          eats it; the frozen, eaten frame is what squashes
  //   neg    the sync crushes on the way out: a flash of the NEGATIVE picture
  //          at the head of the collapse, then black
  //   vline  the HORIZONTAL deflection fails: the raster squashes sideways to
  //          a line down the middle instead of across (very rare, §4.3)
  //   burn   (残 only) the picture lingers and dims; when the carrier goes,
  //          the last image stays on the long-persistence phosphor as an
  //          afterglow through the collapse, the burst and the dead tube
  // 絶 keeps its hard cut (§3.5): squash, a negative flash, or the sideways
  // collapse — nothing that lingers. 残 lingers: a dissolve, a freeze or the
  // afterglow suit it. `line`: the exits that end in Paik's line.
  var EXIT = {
    modes: ["squash", "roll", "snow", "bars", "freeze", "neg", "vline", "burn"],
    pools: {
      setsu: { squash: 0.40, roll: 0.16, snow: 0.15, bars: 0.14, freeze: 0.08, neg: 0.06, vline: 0.01 },
      zan:   { snow: 0.32, freeze: 0.24, burn: 0.24, squash: 0.18, vline: 0.015 },
      zetsu: { squash: 0.72, neg: 0.25, vline: 0.03 },
    },
    lean: { "過": { neg: 3 }, "同": { roll: 2, bars: 2 }, "遠": { snow: 2 }, "電": { bars: 1.5 }, "嵐": { bars: 1.5, neg: 1.5 } },
    line: { squash: 1, roll: 1, freeze: 1, vline: 1 },
  };
  // 焼 BURN-IN (§3.4, §5.4): the tube remembering. Phosphor that showed one
  // picture for a long time is WORN where it was bright — it gives less light
  // there for ever after — so the previous reception's picture (the set's
  // frame memory; on a night's first reception, the test card, the picture a
  // real set burned most) shows as a faint darker imprint in every lit frame
  // of the next one, fixed to the GLASS: it does not roll, tear or squash with
  // the picture. Some nights' tubes burn (nightP, one draw on the set's own
  // fork "set:burn"); on those, a reception shows it with probability p, at
  // depth k (the brightest remembered pixel loses k of its light; the
  // remembered level through gamma). nightP × p = 1/6: §4.3's uncommon tier.
  // k tops out at 0.18: at 0.28 a face burned over a face lost a tenth of its
  // hold SSIM (0.915 → 0.822) — more than the faint imprint §3.4 asks for;
  // at 0.18 the probe holds it within 0.9× (p3render, 焼 legibility)
  var BURN = { nightP: 0.5, p: 1 / 3, k: [0.06, 0.18], gamma: 1.3 };

  // 今 TODAY — rc.91's look, restated in P1's axes (the nine bands are gone:
  // its tear is the event tear at rc.91's density). Never drawn; reachable on
  // the bench as force { archetype: "今" }, and the resting character of the
  // idle and dead tube (where only its snow and exit are read).
  // the P2 kinds, all off: 今 (and the clean reference) carry none of them
  var P2_OFF = { impulse: null, herring: null, hum: null, xtalk: null, skew: null, flag: null, jitter: null, wave: null, smear: null, agc: null };
  function kindsZero() { var o = {}; IMPAIRMENTS.forEach(function (k) { o[k] = 0; }); return o; }
  var TODAY = {
    name: "今", archetype: "今", tier: "common", sev: 0.35, kinds: kindsZero(),
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
  TODAY.kinds["雪"] = 0.25; TODAY.kinds["影"] = 0.3; TODAY.kinds["裂"] = 0.2;
  for (var pk in P2_OFF) TODAY[pk] = null;
  // (P3) 今's lock-in is the snap and its loss the squash, its glimpses rc.91's
  // (null: 0.78·sin and a roll kick), no burn, no walk; the variants' axes sit
  // at their medians so a force of one mode (the bench) has something to run
  // (filled in below, once the draw functions exist)
  // the clean reference (the probe's; force { clean: true }): no snow, no
  // ghosts, no tear, no wash, no swell, no lull, none of P2's kinds; rc.91's breath
  var CLEAN_AXES = { name: "clean", archetype: null, kinds: kindsZero(),
    snow: { gain: 0, grain: 0 }, ghosts: [], tear: { rate: 0, jump: 0 }, wash: { lift: 0, gain: 1 }, swell: { amt: 0 }, lull: null, env: {},
    drop: { depth: 0, holdP: 0, kinds: ["snow"] } };
  for (pk in P2_OFF) CLEAN_AXES[pk] = null;

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
  //                                       "does it render" check, §6.3.2) —
  //                                       any of the fifteen
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
      return { ok: false, why: "no archetype '" + f.archetype + "' (there are " + ARCHETYPES.map(function (a) { return a.id; }).join(" ") + ", and 今)" };
    if (f.impairment != null && IMPAIRMENTS.indexOf(f.impairment) < 0)
      return { ok: false, why: LATER[f.impairment] ? "impairment '" + f.impairment + "' arrives in " + LATER[f.impairment] : "no impairment '" + f.impairment + "'" };
    if (f.entry != null && ENTRY.modes.indexOf(f.entry) < 0) return { ok: false, why: "no lock-in '" + f.entry + "' (there are " + ENTRY.modes.join(" ") + ")" };
    if (f.exit != null && EXIT.modes.indexOf(f.exit) < 0) return { ok: false, why: "no loss '" + f.exit + "' (there are " + EXIT.modes.join(" ") + ")" };
    if (f.glimpse != null && f.glimpse !== "今" && !ENTRY.glimpse[f.glimpse]) return { ok: false, why: "no glimpse '" + f.glimpse + "' (there are " + Object.keys(ENTRY.glimpse).join(" ") + ", and 今)" };
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
    // (P1's "hot" corner — crushed whites, overload's stand-in — is 飽's now)
    if (style === "cochan") return { lift: rr(R, 10, 30) * (0.5 + 0.5 * k), gain: 1 - rr(R, 0.1, 0.25) * (0.5 + 0.5 * k) };
    return { lift: rr(R, 18, 55) * (0.4 + 0.6 * k), gain: 1 - rr(R, 0.15, 0.4) * (0.4 + 0.6 * k) };   // fog: lifted blacks, low contrast
  }
  function drawSwell(R, k) { return { amt: rr(R, 0.012, 0.045) * (0.5 + 0.6 * k), lag: rr(R, 0.15, 1.0) }; }

  // ---- P2's kinds (§3.1–3.3). Each draws the same number of values whatever
  // its style and severity (a fixed count per kind), so the fork is consumed
  // alike however the reception comes out. `key`s seed the episode schedules
  // (点's bursts, 横's losses of lock): hashed, never drawn per frame.
  function key32(R) { return Math.floor(R.next() * 4294967296) >>> 0; }
  // 点 IMPULSE — ignition, motors, switch arcs. Each spark is one line tall (an
  // impulse lasts microseconds: part of one scan line), bright, a few to ~30
  // px long, with the IF's dark ring just after it. They come in BURSTS — a
  // car passing, a motor switching — on an episode schedule; or, pulsed, an
  // engine idling nearby: K sparks a field at a steady rate, which lands them
  // on heights that crawl slowly up or down the frame (the firing rate beating
  // against the field rate), bursts long.
  function drawImpulse(R, k, style) {
    var pulsed = R.next() < (style === "spark" ? 0.45 : 0.25);
    var g0 = rr(R, 0.8, 2.2) / (0.5 + k), gm = rr(R, 1.8, 3.5), d0 = rr(R, 0.3, 0.7), dm = rr(R, 1.6, 3);
    return { key: key32(R), pulsed: pulsed,
      first: [0.1, 1.2],
      dur: pulsed ? [1.5 * d0 + 1, (1.5 * d0 + 1) * dm] : [d0, d0 * dm],
      gap: [g0, g0 * gm],
      dens: rr(R, 3, 9) * (0.5 + 0.8 * k),                      // sparks per frame at a burst's height (irregular)
      K: 3 + Math.floor(R.next() * 5),                          // sparks per field (pulsed)
      crawl: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.08, 0.6),      // frames per second the pulsed heights crawl
      jit: rr(R, 0.5, 4),                                       // rows of scatter about a pulsed height
      len: Math.min(40, rr(R, 6, 22) * (0.7 + 0.6 * k)),        // px
      bright: rr(R, 200, 255), tail: rr(R, 0.35, 0.7), ph: R.next() };
  }
  // 縞 HERRINGBONE — a co-channel (or adjacent-channel) carrier beating with
  // ours: fine diagonal stripes, pitch 2.6–6.5 px along their normal at an
  // angle off the vertical, drifting at the beat; the sound carrier's FM
  // wobbles the beat, which zig-zags the stripes down the frame (the
  // herringbone proper, not on every one); the angle wanders slowly.
  function drawHerring(R, k, style) {
    var zOn = R.next() < 0.6, zig = rr(R, 0.6, 2.4), wOn = R.next() < 0.6;
    return { amp: rr(R, 5, 12) * (0.5 + 0.8 * k), pitch: rr(R, 2.6, 6.5),
      ang: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.35, 1.2),        // radians of the stripes' normal off the horizontal
      drift: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.15, 1.6),      // cycles per second
      zig: zOn ? zig : 0, zigRows: rr(R, 5, 16),
      wander: wOn ? rr(R, 0.04, 0.18) : 0, wHz: rr(R, 0.03, 0.2), ph: R.next() * 6.2832 };
  }
  // 帯 HUM BARS — mains ripple on the signal or the set's supply: one bar a
  // field (50 Hz half-wave) or two (full-wave), broad and soft, darkening (or,
  // less often, lightening), rolling at a slow constant beat — the mains
  // against the field rate. P4 will lock `speed` to the audio's AM LFO.
  function drawHum(R, k, style) {
    return { n: R.next() < 0.6 ? 1 : 2, depth: rr(R, 0.14, 0.32) * (0.6 + 0.6 * k), sign: R.next() < 0.72 ? -1 : 1,
      sharp: rr(R, 1, 3), speed: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.04, 0.35), ph: R.next() };
  }
  // 混 CROSSTALK — a second station on the channel (§5.4). Its picture — the
  // set's memory of the last reception's frame, or the test card, a station's
  // slide — lies faintly under ours, on its own sync: it slides and rolls
  // slowly (the two stations' line and field rates are not locked), and its
  // own blanking shows as a dark bar each way. Over it the two carriers'
  // beat draws venetian-blind stripes, drifting up or down.
  function drawXtalk(R, k, style) {
    return { depth: rr(R, 0.1, 0.24) * (0.6 + 0.6 * k), src: R.next() < 0.7 ? "mem" : "card",
      vx: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.5, 6), vy: (R.next() < 0.5 ? -1 : 1) * rr(R, 0, 2.5),
      ox: Math.floor(R.next() * SW), oy: Math.floor(R.next() * SH),
      blind: rr(R, 3, 9) * (0.6 + 0.6 * k), bPitch: rr(R, 2.5, 9), bHz: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.05, 1) };
  }
  // 横 HORIZONTAL SKEW — the line oscillator loses horizontal sync: every line
  // starts a little later than the last, so the picture shears into diagonal
  // bars (bars = how many times the shear wraps a whole line, blanking and
  // all) that slide sideways; then the AFC pulls it back in and the bars
  // straighten, swinging (wob Hz) as the loop settles. Episodes on a hashed
  // schedule — a sync fault comes and goes, it is not a state.
  function drawSkew(R, k, style) {
    var g0 = rr(R, 1.8, 4.5) / (0.5 + k), gm = rr(R, 1.5, 2.6), d0 = rr(R, 0.4, 0.8), dm = rr(R, 1.4, 2.2);
    return { key: key32(R), first: [0.3, 2.2], dur: [d0, d0 * dm], gap: [g0, g0 * gm],
      bars: rr(R, 0.8, 3) * (0.7 + 0.5 * k), dir: R.next() < 0.5 ? -1 : 1,
      slide: rr(R, 20, 120), lockF: rr(R, 0.35, 0.7), wob: rr(R, 2, 6), wobD: rr(R, 0, 0.6) };
  }
  // 旗 FLAGGING — a timebase error right after the field's sync: the top
  // 12–30 rows hook sideways (deepest at the top), and the hook flutters.
  function drawFlag(R, k, style) {
    return { depth: rr(R, 3.5, 11) * (0.6 + 0.6 * k), rows: rr(R, 12, 30), dir: R.next() < 0.5 ? -1 : 1,
      pow: rr(R, 1.6, 3), flut: rr(R, 0.5, 5), flutD: rr(R, 0.15, 0.6), ph: R.next() * 6.2832 };
  }
  // 揺 LINE JITTER — noisy sync: each line lands ± a pixel or two off, anew
  // every field; `corr` ties neighbouring lines together (noise on the sync
  // is band-limited too). The shiver itself is texture.
  function drawJitter(R, k, style) { return { amt: rr(R, 0.4, 1.3) * (0.6 + 0.6 * k), corr: rr(R, 0, 0.85) }; }
  // 捩 WAVY VERTICALS — hum on the sync, or the AFC hunting: every vertical
  // edge ripples in a slow S-curve down the frame (wavelength 0.5–1.6 frame
  // heights, a touch of second harmonic) that crawls at the hum's beat.
  function drawWave(R, k, style) {
    return { amp: rr(R, 1.2, 3.6) * (0.6 + 0.6 * k), lam: rr(R, 0.5, 1.6), speed: (R.next() < 0.5 ? -1 : 1) * rr(R, 0.05, 0.5),
      h2: rr(R, 0, 0.45), ph: R.next() * 6.2832 };
  }
  // 滲 SMEAR AND RINGING — narrow IF bandwidth or a mistuned tuner: a two-pole
  // resonant low-pass run along each line (causal: edges drag to the RIGHT),
  // its ringing period `per` px and its pole radius `r` (how long the
  // bright-then-dark outline after an edge rings on). Unity at DC.
  function drawSmear(R, k, style) { return { per: rr(R, 3.2, 6.5) * (0.8 + 0.4 * k), r: Math.min(0.86, rr(R, 0.45, 0.68) + 0.15 * k) }; }
  // 飽 AGC AND OVERLOAD — a station too strong: the gain runs `hot` (whites
  // clip on a soft shoulder, blacks crush by `blk`); the AGC follows the
  // picture's level with lag `tau` s, so when a station (or a scene) arrives
  // brighter the picture blooms and settles; it pumps (`pumpHz` — P4 locks it
  // to the audio's LFO); and on some receptions the sync now and then crushes
  // into a brief NEGATIVE picture (negRate per s; the moment is texture).
  function drawAgc(R, k, style) {
    var negOn = R.next() < 0.3 + 0.3 * k, neg = rr(R, 0.04, 0.25);
    return { hot: 1 + rr(R, 0.25, 0.6) * (0.5 + 0.6 * k), blk: rr(R, 4, 18) * (0.5 + 0.5 * k), tau: rr(R, 0.15, 1.2),
      pumpHz: rr(R, 0.2, 1.2), pumpD: rr(R, 0.03, 0.14) * (0.5 + 0.7 * k), ph: R.next() * 6.2832,
      negRate: negOn ? neg : 0, negMs: [60, 200] };
  }
  var DRAW2 = { "点": drawImpulse, "縞": drawHerring, "帯": drawHum, "混": drawXtalk, "横": drawSkew, "旗": drawFlag, "揺": drawJitter, "捩": drawWave, "滲": drawSmear, "飽": drawAgc };
  // the style a P2 kind is drawn in when forced alone (the render check)
  var STYLE2 = { "点": "spark", "縞": "cochan", "帯": "spark", "混": "cochan", "横": "sync", "旗": "sync", "揺": "sync", "捩": "sync", "滲": "multi", "飽": "hot" };
  // an envelope: its own slow life (the fade, §4.2) — 1 + Σ amp·sin(2π·hz·el + ph),
  // with an onset: the impairment arrives over `on` s after the lock
  function drawEnv(R, kind, style) {
    var parts = [[rr(R, 0.12, 0.4), rr(R, 0.025, 0.12), R.next() * 6.283], [rr(R, 0.05, 0.25), rr(R, 0.13, 0.45), R.next() * 6.283]];
    if (kind === "雪" && style === "spark") parts.push([rr(R, 0.4, 0.8), rr(R, 0.5, 1.4), R.next() * 6.283]);   // bursts
    if (kind === "影") parts.push([rr(R, 0, 0.15), rr(R, 0.3, 0.9), R.next() * 6.283]);
    return { parts: parts, on: R.next() < 0.35 ? rr(R, 0.5, 3) : 0 };
  }

  // ---- 出入 P3's draws (§3.5). Like P2's kinds, each takes a FIXED number of
  // values whatever mode it lands on, so a forced mode (the bench) and a drawn
  // one consume the fork alike, and every variant's axes exist to be forced.
  function pickPool(R, pool, lean) {
    var pairs = [];
    for (var m in pool) if (Object.prototype.hasOwnProperty.call(pool, m)) pairs.push([m, pool[m] * ((lean && lean[m]) || 1)]);
    return pickW(R, pairs);
  }
  // the lock-in: dir (the roll's / the shear's sense), rollH (frame heights a
  // second the picture arrives rolling at), bars (how many times the shear
  // wraps a line), slide (px/s the bars slide), wob (Hz of the loop's last
  // swing), gamma (the fade's curve), bloomA/tau (the AGC's overshoot and its
  // time constant), gd/ga (the leading echo's delay, source px, and level),
  // tailU (where in its mode's range the settle runs), walk (浮: the
  // impairments' multiplier at the start of the drift) — 14 values
  function drawEntry(R, pool, lean) {
    var mode = pickPool(R, pool, lean);
    return { mode: mode, dir: R.next() < 0.5 ? -1 : 1, rollH: +rr(R, 0.8, 2.4).toFixed(4), bars: +rr(R, 1.2, 4).toFixed(4),
      slide: +((R.next() < 0.5 ? -1 : 1) * rr(R, 40, 160)).toFixed(3), wob: +rr(R, 2, 5).toFixed(4), gamma: +rr(R, 1.6, 2.6).toFixed(4),
      bloomA: +rr(R, 0.5, 1.1).toFixed(4), tau: +rr(R, 0.25, 0.6).toFixed(4), gd: +rr(R, 5, 18).toFixed(3), ga: +rr(R, 0.45, 0.8).toFixed(4),
      tailU: +R.next().toFixed(4), walk: +rr(R, 1.8, 3).toFixed(4) };
  }
  // 探's glimpses: four slots (the receiver draws two to four; glimpse i takes
  // slot i), each its own mode, peak strength, sense and amount — 4 values each
  function drawGlimpses(R) {
    var out = [];
    for (var i = 0; i < 4; i++) out.push({ mode: pickW(R, Object.keys(ENTRY.glimpse).map(function (m) { return [m, ENTRY.glimpse[m]]; })),
      peak: +rr(R, 0.55, 0.9).toFixed(4), dir: R.next() < 0.5 ? -1 : 1, amt: +R.next().toFixed(4) });
    return out;
  }
  // the loss: dir, rollH (frame heights a second the roll-away reaches),
  // bars (the shear's wraps at the end of the loss), slide (px/s), negT (s of
  // negative at the head of the collapse), glowA/glowTau (the afterglow's
  // level and decay) — 9 values, over 今's squash and line constants
  function drawExit(R, pool, lean) {
    var ex = clone(TODAY.exit);
    ex.mode = pickPool(R, pool, lean); ex.dir = R.next() < 0.5 ? -1 : 1; ex.rollH = +rr(R, 2.5, 6).toFixed(4); ex.bars = +rr(R, 2, 5).toFixed(4);
    ex.slide = +((R.next() < 0.5 ? -1 : 1) * rr(R, 60, 200)).toFixed(3); ex.negT = +rr(R, 0.1, 0.22).toFixed(4);
    ex.glowA = +rr(R, 0.35, 0.6).toFixed(4); ex.glowTau = +rr(R, 0.6, 1.3).toFixed(4);
    return ex;
  }
  // 今's (and the clean reference's, and a kind forced alone): the snap and
  // the squash, their axes at the medians, no walk, rc.91's glimpses, no burn
  TODAY.entry = drawEntry(MID, { snap: 1 }, null); TODAY.entry.walk = 1; TODAY.entry.shape = "soku";
  TODAY.exit = drawExit(MID, { squash: 1 }, null); TODAY.exit.shape = "setsu";
  TODAY.glimpses = null; TODAY.burn = null;

  function drawCharacter(forkRng, ctx) {
    var f = (ctx && ctx.force) || null;
    var ch;
    if (!forkRng || (f && f.archetype === "今")) ch = clone(TODAY);
    else if (f && f.clean) ch = merge(clone(TODAY), CLEAN_AXES);
    else if (f && f.impairment) ch = single(f.impairment, f.sev != null ? +f.sev : 0.5, f.style || null);
    else ch = drawn(forkRng, f && f.archetype, f && f.sev != null ? +f.sev : null, ctx);
    // (P3) the bench may pin the lock-in, the loss, every glimpse ("今":
    // rc.91's) and the burn (a depth k, or 0/null for none) — the mode only:
    // the axes stay as drawn (or at the medians on 今, clean and alone)
    if (f && f.entry) ch.entry.mode = f.entry;
    if (f && f.exit) ch.exit.mode = f.exit;
    if (f && f.glimpse) { if (f.glimpse === "今") ch.glimpses = null; else { if (!ch.glimpses) ch.glimpses = drawGlimpses(MID); ch.glimpses.forEach(function (g) { g.mode = f.glimpse; }); } }
    if (f && f.burn !== undefined) ch.burn = +f.burn > 0 ? { k: +f.burn } : null;
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
    if (FIELD[kind]) {
      ch[FIELD[kind]] = DRAW2[kind](MID, k, style || STYLE2[kind]);
      // alone, 混's other picture is the test card (a known reference the
      // probe can hold the residual against), and 飽 has no negative flash
      // unless the axes ask for one (the probe forces it separately)
      if (kind === "混") ch.xtalk.src = "card";
      if (kind === "飽") ch.agc.negRate = 0;
    }
    return ch;
  }
  // an archetype's primaries: all of them, or (pick [lo, hi]) that many, drawn
  // — every primary gets one ordering draw either way, so the count consumed
  // depends only on the archetype
  function pickPrims(R, a) {
    var order = a.prim.map(function (kk) { return [kk, R.next()]; });
    if (!a.pick) return a.prim.slice();
    var n = a.pick[0] + Math.floor(R.next() * (a.pick[1] - a.pick[0] + 1));
    order.sort(function (p, q) { return p[1] - q[1]; });
    return order.slice(0, n).map(function (p) { return p[0]; }).sort(function (p, q) { return a.prim.indexOf(p) - a.prim.indexOf(q); });
  }
  function drawn(R, forcedArch, forcedSev, ctx) {
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
      [a1, a2].forEach(function (a) { pickPrims(R, a).forEach(function (kk) { if (prim.indexOf(kk) < 0) { prim.push(kk); styles[kk] = a.style; } }); });
    } else prim = pickPrims(R, arch);
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
    // P2's kinds, in a fixed order, all of them, on or off
    var p2 = {};
    P2_KINDS.forEach(function (kk) { p2[kk] = DRAW2[kk](R, kinds[kk] || 0, styles[kk] || "sec"); });
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
    P2_KINDS.forEach(function (kk) { ch[FIELD[kk]] = kinds[kk] != null ? p2[kk] : null; });
    ch.kinds = {}; IMPAIRMENTS.forEach(function (kk) { ch.kinds[kk] = +(kinds[kk] || 0).toFixed(4); });
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
    // 出入 (P3), drawn LAST, so every axis above is exactly what rc.P4 drew
    // for the same seed (every P1/P2 seed, strip and fit stays valid). The
    // pools come from the shape the receiver drew (ctx.desc.rx: read, never
    // written); a later piece (ctx.piece > 0) is a relock; a descriptor with
    // no plan is today's 即…切.
    var rxp = ctx && ctx.desc && ctx.desc.rx, piece = (ctx && ctx.piece) || 0;
    var ek = piece > 0 ? "relock" : rxp && ENTRY.pools[rxp.entry] ? rxp.entry : "soku";
    ch.entry = drawEntry(R, ENTRY.pools[ek], ENTRY.lean[arch.id]); ch.entry.shape = ek;
    ch.glimpses = drawGlimpses(R);
    var xk = rxp && EXIT.pools[rxp.exit] ? rxp.exit : "setsu";
    ch.exit = drawExit(R, EXIT.pools[xk], EXIT.lean[arch.id]); ch.exit.shape = xk;
    // 焼: on a night whose tube burns (ctx.burnNight, the set's "set:burn"
    // draw), one reception in three shows the last one's imprint
    var bu = R.next(), bk = rr(R, BURN.k[0], BURN.k[1]);
    ch.burn = ctx && ctx.burnNight && bu < BURN.p ? { k: +bk.toFixed(4) } : null;
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
  // P2's EPISODES — 点's bursts and 横's losses of lock: episode n is
  // [start, end, u, v] (u, v: two more hashed uniforms for that episode's own
  // character), the first starting in E.first s, each lasting E.dur, the rest
  // after it E.gap — all from hashU(E.key, n, ·), so deterministic, unbounded,
  // with no draws per frame (the lull's method); cached per axes object.
  var SCHED2 = typeof WeakMap === "function" ? new WeakMap() : null;
  function episodes(E, until) {
    var sc = SCHED2 && SCHED2.get(E);
    if (!sc) { sc = []; if (SCHED2) SCHED2.set(E, sc); }
    while (!sc.length || sc[sc.length - 1][0] <= until) {
      var n = sc.length, u = function (j) { return hashU(E.key, n + 7919, j); };
      var start = n ? sc[n - 1][1] + lerp(E.gap[0], E.gap[1], u(0)) : lerp(E.first[0], E.first[1], u(0));
      sc.push([start, start + lerp(E.dur[0], E.dur[1], u(1)), u(2), u(3)]);
      if (sc.length > 4000) break;
    }
    return sc;
  }
  // the episode under way at `e` s, or null
  function episodeAt(E, e) {
    if (!E || e < 0) return null;
    var sc = episodes(E, e), lo = 0, hi = sc.length - 1;
    while (lo < hi) { var mid = (lo + hi + 1) >> 1; if (sc[mid][0] <= e) lo = mid; else hi = mid - 1; }
    return sc[lo][0] <= e && e < sc[lo][1] ? sc[lo] : null;
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
  // 32 % got a lull at P1 (嵐 80 %, 遠 54 %, 反 39 %, 電 32 %, 混 20 %, 過
  // 11 %, 同 9 %, 清 none). 嵐 is not given one by name. Checked on fresh seeds
  // (lullcal --built --seed0 2001) — see the r2 handoff. P2 adds BURY2 below.
  var BURY_LINE = 0.856;
  // the spark density at the carrier's resting level (sourcePass's p before
  // envelopes) — shared by P1's snow term and P2's herringbone term
  function snowP(ch) {
    var lvl = 1 - (ch.breath ? ch.breath.base : 0.82), sn = ch.snow || {};
    return (lvl * lvl * (sn.sq != null ? sn.sq : 0.85) + lvl * (sn.lin != null ? sn.lin : 0.08)) * (sn.gain || 0);
  }
  function burial(ch) {
    var lvl = 1 - (ch.breath ? ch.breath.base : 0.82), sn = ch.snow || {}, wa = ch.wash || { lift: 0, gain: 1 }, te = ch.tear || {}, gs = 0;
    var p = snowP(ch);
    (ch.ghosts || []).forEach(function (g) { gs += Math.abs(g.a); });
    return 3 * p + 0.5 * (sn.grain || 0) * lvl + 1.5 * gs + 2 * Math.max(0, 1 - wa.gain) + Math.max(0, wa.gain - 1) + (te.rate || 0) * Math.min(1.5, (te.jump || 0) / 10) * lvl +
      burial2(ch);
  }
  // P2's terms: one weight per kind, on the kind's own "how much of the
  // picture it takes". FITTED (_picture-probe.js lullfit, greedy, the P1 terms
  // and BURY_LINE held) on 384 lull-OFF receptions: lullcal --archs
  // 遠,嵐,混,電,同,過 at --seed0 1001 (P2 r1) and 3001 (P2 r2) — three reels ×
  // 40 drawn, and every archetype but 反/清 forced at sev 0.7–1, 12 each. 20
  // needed a lull (14 failed to surface, 6 more surfaced with a worst window
  // under 0.8 s).
  //   飽 agc 1     an overexposed, rippling 嵐 (捩 + 飽 hot 1.57, crush 17)
  //                scores 0.08 on P1's terms and med SSIM 0.30 (1001).
  //   縞 herr 1    ON SNOW (critic P2 r1, required item 1): a 混 with an
  //                uncommon-tier 雪 0.80 on a carrier resting at 0.63 and 縞
  //                amp 8.5 (john-cage·3025.37) never surfaced — the snow alone
  //                scores 0.565 and leaves a face, the stripes alone leave a
  //                face (every 縞 on a clean carrier in both sets surfaced),
  //                together they veil it for the whole hold. So the term is
  //                the stripes' amplitude times the snow's own term (3p): a
  //                clean-carrier 縞 costs nothing, and 混 stays mostly
  //                lull-free (5 % of drawn 混, not "every co-channel").
  //   横 skew 0.2, 揺 jit 0.2   a 遠 whose lines shiver (3013, 揺 0.38) and a
  //                嵐 of snow + skew + hook (嵐·cal·8) surfaced too thinly
  //                (worst window 0.4–0.7 s) on P1's terms alone.
  //   滲 smear 0.05  a trace.
  // Two 3001 receptions fail the SSIM test and are EXEMPT (--exempt): 嵐s
  // of fine 縞 over 混 on a strong carrier (ddr1·3230.37, 嵐·cal·5), legible
  // by eye in every tile (critic P2 r1's strips) — 8×8 SSIM reads stripes of
  // pitch 2.6–6.5 px as lost structure. 20,000 drawn: 21.0 % get a lull (嵐
  // 57 %, 遠 43 %, 反 32 %, 過 29 %, 混 5 %, 電/同/清 0). Validated on fresh
  // seeds 4001 before any look at them — see the P2 r2 handoff.
  var BURY2 = { imp: 0, herr: 1, hum: 0, xt: 0, skew: 0.2, flag: 0, jit: 0.2, wave: 0, smear: 0.05, agc: 1 };
  function duty(E) { var d = (E.dur[0] + E.dur[1]) / 2, g = (E.gap[0] + E.gap[1]) / 2; return d / (d + g); }
  function burial2(ch) {
    var b = 0, W = BURY2;
    if (ch.impulse) b += W.imp * ch.impulse.len * (ch.impulse.pulsed ? ch.impulse.K : ch.impulse.dens) / 60 * duty(ch.impulse);
    if (ch.herring) b += W.herr * ch.herring.amp / 10 * 3 * snowP(ch);   // stripes ON snow (P2 r2, above)
    if (ch.hum) b += W.hum * ch.hum.depth;
    if (ch.xtalk) b += W.xt * (ch.xtalk.depth + ch.xtalk.blind / 60);
    if (ch.skew) b += W.skew * ch.skew.bars * duty(ch.skew);
    if (ch.flag) b += W.flag * ch.flag.depth * ch.flag.rows / 144 / 4;
    if (ch.jitter) b += W.jit * ch.jitter.amt;
    if (ch.wave) b += W.wave * ch.wave.amp / 2;
    if (ch.smear) b += W.smear * (ch.smear.per / 6) * ch.smear.r;
    if (ch.agc) b += W.agc * (ch.agc.hot - 1 + ch.agc.blk / 40);
    return b;
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
  // (P3) `direct` (default 1): the direct path's level — a ghost-first lock-in
  // arrives with its echo up and the direct path still low; the AGC then
  // takes back direct + half the positive echoes' light (at direct 1, exactly
  // rc.91's 1 + 0.5·Σa).
  function ghostPass(L, out, SWp, SHp, list, direct) {
    out.set(L);
    var dr = direct != null && direct !== 1 ? direct : 1;
    if (!list.length && dr === 1) return;
    var agc = 0, gi, x, y;
    if (dr !== 1) for (x = 0; x < SWp * SHp; x++) out[x] *= dr;
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
    if (agc > 0 || dr !== 1) { var k = 1 / (dr + 0.5 * agc), n = SWp * SHp; for (x = 0; x < n; x++) out[x] *= k; }
  }
  // PASS 1c — DRIVE, 霞 WASH, 飽 OVERLOAD, 縞 HERRINGBONE, 雪 SNOW and 帯 HUM
  // into the luma bytes. `mode` "idle", "dead" or "lit"; `level` the snow
  // level 0..1 (1 − carrier); `bri` the 輝度 step ({lift, gain}); `sn` the
  // snow axes, `wa` the wash (lift, gain) at this frame's strength; `fl` this
  // frame's snow multiplier (envelope × flicker); `X` (P2, optional) this
  // frame's { ag: {g, blk, neg}, hb: {amp, dp, ph0}, hum: {g, a} } — each null
  // when that kind is off, so an off kind costs one test per pixel.
  //
  // THE SNOW, enriched (§3.1). A spark STARTS with probability p/streak and
  // runs on sideways for ~streak px, fading (weak-signal snow streaks because
  // the IF bandwidth smears it); a `dark` share of them are black specks
  // instead — P2 (critic P1 r1/r2 recommendation): smeared by the same IF, so
  // a dark speck runs on for ~streak px too, its darkening decaying as a
  // spark's light does (a tail that only ever removes light), where it was one
  // square source pixel (5 × 5 at dpr 2); under them, band-limited grain:
  // Gaussian noise through a one-pole filter along the line (corr), scaled to
  // the snow level. Density at streak 1 is rc.91's p = level²·sq + level·lin.
  //
  // THE ORDER is the signal's: the beam's drive, the veil (霞), the overload
  // (飽: the AGC's gain, the crushed blacks, the whites on a soft shoulder into
  // the clip; a negative flash inverts what the sync-crushed detector hands
  // on), the co-channel beat (縞, added at RF), the receiver's own noise (雪),
  // and last the mains ripple (帯), which modulates everything on the tube.
  var SIN = (function () { var t = new Float32Array(1024); for (var i = 0; i < 1024; i++) t[i] = Math.sin(i / 1024 * 6.283185307); return t; })();
  function sourcePass(L, luma, n, mode, level, bri, sn, wa, fl, rnd, X) {
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
    var ag = X && X.ag, agG = ag ? ag.g : 1, agB = ag ? ag.blk : 0, agN = ag ? ag.neg : false;
    var hb = X && X.hb, hbA = hb ? hb.amp : 0, hbD = hb ? hb.dp : 0, hbP = hb ? hb.ph0 : null, acc = 0;
    var hum = X && X.hum, hG = hum ? hum.g : null, hA = hum ? hum.a : null, rg = 1, ra = 0;
    var run = 0, sv = 0, dv = 0, g = 0, y = -1;
    for (i = 0; i < n; i++) {
      if (i % SW === 0) { run = 0; g = 0; y++; if (hb) acc = hbP[y]; if (hum) { rg = hG[y]; ra = hA[y]; } }
      l = (L[i] - lift) * gain;                              // 輝度: the beam's drive
      l = l * wg + wl;                                       // 霞: the veil
      if (ag) {                                              // 飽: overload
        l = (l - agB) * agG; if (l > 225) l = 225 + (l - 225) * 0.5;
        if (agN) l = 235 - 0.85 * (l > 255 ? 255 : l < 0 ? 0 : l);   // the sync crushed: a negative picture
      }
      if (hb) { l += hbA * SIN[(acc | 0) & 1023]; acc += hbD; }   // 縞: the beat
      if (run > 0) {
        run--;
        if (sv > 0) { sv *= 0.82; var lr = l * keepS + sv; if (lr > l) l = lr; }   // a spark's tail only ever adds light
        else { dv *= 0.72; l = l * (1 - dv); }                                   // a dark speck's only ever takes it away (and dies faster: on a bright picture a long black dash reads as a mark, not noise)
      }
      else if (p > 0 && rnd() < pStart) {
        run = st > 1 ? (rnd() * 2 * (st - 1) + 0.5) | 0 : 0;
        if (dark > 0 && rnd() < dark) { sv = 0; dv = 0.6; l = l * 0.4; }   // a dark speck (weak-signal snow is black as well as white)
        else { dv = 0; sv = rnd() * 255 * (fS + spS * rnd()); l = l * keepS + sv; }
      }
      if (gAmp > 0) { g = c * g + (1 - c) * GAUSS[(rnd() * 1024) | 0]; l += g * gNorm * gAmp; }
      if (hum) l = l * rg + ra;                              // 帯: the ripple
      luma[i] = l < 0 ? 0 : l > 255 ? 255 : l | 0;
    }
  }

  // ---- P2's per-frame pieces for the source pass ----
  // 縞 this frame's row phases (in SIN-table units, 1024 a cycle) and the step
  // along a row: phase(x, y) = (x·cos a + y·sin a)/pitch − drift·t + the zig
  function herringRows(hb, t, env, out) {
    var a = hb.ang + hb.wander * Math.sin(6.2832 * hb.wHz * t + hb.ph), ca = Math.cos(a), sa = Math.sin(a);
    out.amp = hb.amp * env; out.dp = 1024 * ca / hb.pitch;
    var base = -hb.drift * t;
    for (var y = 0; y < SH; y++) {
      var z = 0;
      if (hb.zig > 0) { var u = y / hb.zigRows; u -= Math.floor(u); z = hb.zig * (Math.abs(u - 0.5) * 2 - 0.5) / 6.2832; }   // a triangle: the herringbone's zig-zag
      out.ph0[y] = 1024 * (y * sa / hb.pitch + base + z);
    }
    return out;
  }
  // 帯 this frame's per-row gain and offset: n raised-cosine bars a field,
  // rolling at `speed` cycles a second; darker bars cut the gain and pull the
  // level down, lighter ones the opposite
  function humRows(hu, t, env, g, a) {
    var d0 = hu.depth * env;
    for (var y = 0; y < SH; y++) {
      var u = hu.n * y / SH - hu.speed * t + hu.ph; u -= Math.floor(u);
      var bar = Math.pow(0.5 + 0.5 * Math.cos(6.2832 * u), hu.sharp), d = d0 * bar;
      g[y] = 1 + hu.sign * d * 0.6; a[y] = hu.sign * d * 55;
    }
  }
  // 混 the other station, IN THE SIGNAL (after the echoes, before the IF): its
  // picture X (192×144 luma) slid by its own unlocked sync, its blanking dark
  // (a sync level) where its line and field wrap, mixed in at `depth`, and the
  // carriers' beat as horizontal venetian-blind stripes. `out` (optional)
  // receives the other picture as placed this frame — the probe's reference.
  var VBLANK = 8;                    // rows of the other station's field blanking
  function xtalkPass(L, X, xt, t, env, out) {
    var d = xt.depth * env, bA = xt.blind * env;
    var P = SW + HBLANK, PV = SH + VBLANK;
    var ox = Math.floor(xt.ox + xt.vx * t), oy = Math.floor(xt.oy + xt.vy * t);
    ox = ((ox % P) + P) % P; oy = ((oy % PV) + PV) % PV;
    for (var y = 0; y < SH; y++) {
      var ys = y - oy; if (ys < 0) ys += PV;
      var bl = bA * Math.sin(6.2832 * (y / xt.bPitch - xt.bHz * t)), row = ys < SH ? ys * SW : -1, base = y * SW;
      var xs = -ox; if (xs < 0) xs += P;
      for (var x = 0; x < SW; x++) {
        var v = row >= 0 && xs < SW ? X[row + xs] : -25;
        if (out) out[base + x] = v;
        L[base + x] = L[base + x] * (1 - 0.5 * d) + d * v + bl;
        if (++xs >= P) xs = 0;
      }
    }
  }
  // 滲 a two-pole resonant low-pass along each line, in place: edges drag to
  // the right and ring (period `per` px, pole radius `r`); unity at DC
  function smearPass(L, sm) {
    var th = 6.2832 / sm.per, r = sm.r, a1 = 2 * r * Math.cos(th), a2 = -r * r, b = 1 - a1 - a2;
    for (var y = 0; y < SH; y++) {
      var base = y * SW, y1 = L[base], y2 = y1;
      for (var x = 0; x < SW; x++) { var v = b * L[base + x] + a1 * y1 + a2 * y2; y2 = y1; y1 = v; L[base + x] = v; }
    }
  }
  // 点 this frame's sparks, drawn straight into the luma bytes after the snow:
  // `e` s into the reception (the burst schedule's clock), `env` the kind's
  // envelope (and the lull); returns how many were drawn
  function impulsePass(luma, im, e, env, rnd) {
    var ep = episodeAt(im, e);
    if (!ep || env <= 0) return 0;
    var k = (e - ep[0]) / (ep[1] - ep[0]), lv = Math.sqrt(Math.sin(Math.PI * k)) * env, n = 0, y;   // the burst rises and dies away (a car passing)
    if (im.pulsed) {
      for (var j = 0; j < im.K; j++) if (rnd() < lv) {
        var u = im.ph + j / im.K + im.crawl * e; u -= Math.floor(u);
        y = u * SH + (rnd() - 0.5) * im.jit;
        dash(luma, y, rnd() * SW, im.len * (0.5 + rnd()), im.bright, im.tail); n++;
      }
    } else {
      for (var cnt = im.dens * lv; cnt > 0; cnt -= 1) if (rnd() < Math.min(1, cnt)) {
        dash(luma, rnd() * SH, rnd() * SW, im.len * (0.5 + rnd()), im.bright, im.tail); n++;
      }
    }
    return n;
  }
  function dash(luma, y, x0, len, br, tail) {
    y = y | 0; if (y < 0 || y >= SH) return;
    var base = y * SW, xa = x0 | 0, x1 = Math.min(SW, xa + (len | 0) + 1), x;
    for (x = xa; x < x1; x++) { var v = br * (1 - 0.45 * (x - xa) / (x1 - xa)); if (v > luma[base + x]) luma[base + x] = v; }
    for (var e2 = Math.min(SW, x1 + 3); x < e2; x++) luma[base + x] = luma[base + x] * tail;   // the IF's ring after the impulse: a dark tail
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

  // P2's GEOMETRY, added into the per-line offset map after lineMap (which
  // clears it): 旗 the hook at the top of the field, 捩 the slow S-curve, 揺
  // the shiver (texture), 横 an episode of lost horizontal sync. `e` s into the
  // reception (横's schedule), `t` s (the oscillators: a constant beat does not
  // restart with a phase), `env` this frame's levels. Returns whether it drew.
  function geoMap(map, ch, e, t, env, rnd) {
    var any = false, y;
    var f = ch.flag;
    if (f && env.flag > 0) {
      var D = f.dir * f.depth * env.flag * (1 + f.flutD * Math.sin(6.2832 * f.flut * t + f.ph)), rows = Math.min(SH, Math.ceil(f.rows));
      for (y = 0; y < rows; y++) map[y] += D * Math.pow(1 - y / f.rows, f.pow);
      any = true;
    }
    var w = ch.wave;
    if (w && env.wave > 0) {
      var A = w.amp * env.wave, L0 = w.lam * SH, sh = -w.speed * t;
      for (y = 0; y < SH; y++) { var q = 6.2832 * (y / L0 + sh) + w.ph; map[y] += A * (Math.sin(q) + w.h2 * Math.sin(2 * q)); }
      any = true;
    }
    var j = ch.jitter;
    if (j && env.jit > 0) {
      var c = j.corr, s = Math.sqrt(1 - c * c), a = j.amt * env.jit, v = 0;
      for (y = 0; y < SH; y++) { v = c * v + s * GAUSS[(rnd() * 1024) | 0]; map[y] += v * a; }
      any = true;
    }
    var k = ch.skew, ep = k && env.skew > 0 ? episodeAt(k, e) : null;
    if (ep) {
      // lost: the shear s0 (bars × a whole line with its blanking, over the
      // frame), its phase c sliding; then the AFC pulls in: shear and phase
      // die away to nothing, the shear swinging at wob Hz as the loop settles
      var P = SW + HBLANK, D2 = ep[1] - ep[0], kk = e - ep[0], lost = D2 * (1 - k.lockF);
      var s0 = k.dir * k.bars * (0.6 + 0.7 * ep[2]) * P / SH * env.skew, sl = (ep[3] < 0.5 ? -1 : 1) * k.slide * env.skew;   // (a lull knocks both down)
      var cc, ss;
      if (kk < lost) { ss = s0; cc = sl * kk; }
      else {
        var u = (kk - lost) / Math.max(0.01, D2 - lost), dec = Math.exp(-3 * u) * (1 - u), cl = sl * lost;
        cl -= Math.round(cl / P) * P;                                          // the nearest whole line: it relocks where it lands
        ss = s0 * dec * ((1 - k.wobD) + k.wobD * Math.cos(6.2832 * k.wob * (kk - lost)));
        cc = cl * dec;
      }
      for (y = 0; y < SH; y++) map[y] += cc + ss * y;
      any = true;
    }
    return any;
  }

  // 影 this frame's echo list, from the character: delay (with a slow drift —
  // a moving reflector), amplitude through its envelope, the flutter, and the
  // direct signal's weakness (a weak direct path lets the echo read louder)
  function ghostList(ch, ph, strength, t, envG, out) {
    out.length = 0;
    // (P3) and while 浮 drifts in: its echoes arrive with it, walked down
    if (ph !== "hold" && ph !== "loss" && ph !== "tuning" && ph !== "relock" && ph !== "drifting") return out;
    for (var i = 0; i < ch.ghosts.length; i++) {
      var g = ch.ghosts[i];
      var fl = g.flut > 0 ? 1 + g.flutD * Math.sin(6.2832 * g.flut * t / 1000 + g.ph) : 1;
      out.push({ d: g.d + g.drift * Math.sin(t / g.per + g.ph), a: g.a * envG * fl * (0.85 + 0.8 * (1 - strength)) });
    }
    return out;
  }

  // ==========================================================================
  // 出入 THE LOCK-IN'S LEVELS (P3, §3.5) — pure, per frame
  // ==========================================================================
  // How long a lock-in runs on after its window (the settle), by mode. With no
  // window of its own (探's catch after the hunt, a 走 swap's lockS 0) the
  // lock itself plays over this long at the head of the hold.
  function lockTail(en, winS) {
    var u = en.tailU, none = winS < 0.05;
    switch (en.mode) {
      case "fade":  return winS >= 2.5 ? 0 : lerp(0.8, 1.6, u);
      case "roll":  return none ? lerp(1.0, 1.6, u) : lerp(0.6, 1.0, u);
      case "bars":  return none ? lerp(0.7, 1.2, u) : lerp(0.35, 0.6, u);
      case "bloom": return Math.max(0.3, 4 * en.tau - winS);
      case "ghost": return none ? lerp(0.6, 1.1, u) : lerp(0.3, 0.6, u);
      default:      return 0;
    }
  }
  // the nearest whole line: a relocked oscillator lands on a line boundary,
  // so a phase of c px reads the same as c − (the nearest multiple of a line)
  function wrapNear(c) { var P = SW + HBLANK; return c - Math.round(c / P) * P; }
  // This frame's levels, into `o`. u: 0..1 through the lock (the window, or
  // with no window the head of the hold); w: 0..1 through the settle after a
  // windowed lock (−1 outside it); secs: s since the lock began; winS: the
  // window. Out:
  //   sSet, sK    the fade's strength: in a window the level (× 0.85, the
  //               carrier's tune-in top); in the hold a multiplier
  //   level, snowUp  (fade) a carrier this weak is a weak PICTURE as well as
  //               snow — the video comes up from 0.3 of its contrast, and the
  //               snow runs at full gain (the tuner's own noise, not the
  //               station's: a clean station fades up from real snow too)
  //   rollH       frame heights a second the picture rolls; NaN = catch it now
  //   shS, shC    the shear: px per row, and the phase in px (bars)
  //   gain        the AGC's gain (bloom)
  //   eA, eD      a leading echo's level and delay (source px); direct: the
  //               direct path's level (ghost)
  //   tear        the sync's tear-rate multiplier (a lock-in that IS the
  //               sync's damage does not also kick)
  function lockLevels(en, u, w, secs, winS, o) {
    o.sSet = false; o.sK = 1; o.level = 1; o.snowUp = 0; o.rollH = 0; o.shS = 0; o.shC = 0; o.gain = 1; o.eA = 0; o.eD = 0; o.direct = 1; o.tear = 1;
    var m = en.mode, none = winS < 0.05, P = SW + HBLANK;
    if (m === "fade") {
      var F = Math.max(0.2, Math.min(1, winS / 2.5));        // how far up the carrier is when the window ends
      o.sSet = true; o.tear = 0.25;
      o.sK = w >= 0 ? F + (1 - F) * Math.pow(w, 0.8) : none ? Math.pow(u, en.gamma) : F * Math.pow(u, en.gamma);
      o.level = 0.3 + 0.7 * o.sK; o.snowUp = 1 - o.sK;
    } else if (m === "roll") {
      var h = en.rollH * (winS > 2 ? 0.35 : 1);              // a drift-in rolls slowly; a snap arrives spinning
      o.tear = 0.4;
      if (w >= 0) o.rollH = NaN;                             // the settle: slide into place
      else if (none) o.rollH = u < 0.45 ? en.dir * h * (1 - 0.7 * u / 0.45) : NaN;
      else o.rollH = en.dir * h * (1 - 0.7 * u);
    } else if (m === "bars") {
      var s0 = en.bars * P / SH;
      o.tear = 0.4;
      if (w >= 0) { o.shS = en.dir * s0 * 0.25 * Math.exp(-3 * w) * (1 - w) * Math.cos(6.2832 * en.wob * (secs - winS)); }
      else { var q = Math.pow(1 - u, 1.3); o.shS = en.dir * s0 * q; o.shC = wrapNear(en.slide * secs) * q; }
    } else if (m === "bloom") {
      var x = secs / en.tau;
      o.gain = 1 + en.bloomA * Math.exp(-x) * Math.cos(1.3 * x);   // blown out, pulled down, a little under, settled
    } else if (m === "ghost") {
      o.eD = en.gd;
      if (w >= 0) { o.eA = en.ga * 0.2 * (1 - w); }
      else { o.eA = en.ga * (1 - Math.pow(u, 1.2)); o.direct = 0.25 + 0.75 * Math.pow(u, 1.5); }
    }
    return o;
  }
  // one 探 glimpse's levels, gk 0..1 through it, secs into it: its strength
  // (rc.91's 0.78·sin at 今), a roll kick while it catches (rc.91's +1.4 a
  // frame, now its own size and sense), the bars nearly straightening, the
  // echo nearly giving way, or a soft rise with no kick at all
  function glimpseLevels(g, gk, secs, o) {
    o.str = 0; o.kick = 0; o.shS = 0; o.shC = 0; o.eA = 0; o.eD = 0; o.direct = 1; o.tear = 1;
    var s = Math.sin(Math.PI * gk);
    if (!g) { o.str = 0.78 * s; if (gk < 0.12) o.kick = 1.4; return o; }
    o.str = g.peak * (g.mode === "fade" ? Math.pow(s, 1.6) : s);
    if (g.mode === "roll") { if (gk < 0.12) o.kick = g.dir * (1.4 + 2.2 * g.amt); o.tear = 0.5; }
    else if (g.mode === "bars") { o.shS = g.dir * (1.5 + 2.5 * g.amt) * (SW + HBLANK) / SH * (1 - 0.85 * s); o.shC = wrapNear(g.dir * (40 + 80 * g.amt) * secs); o.tear = 0.4; }
    else if (g.mode === "ghost") { o.eA = (0.4 + 0.4 * g.amt) * (1 - 0.8 * s); o.eD = 6 + 12 * g.amt; o.direct = 0.3 + 0.7 * s; }
    else if (g.mode === "fade") o.tear = 0.2;
    return o;
  }
  // 浮's walk-down at dk (0..1 through the drift): every impairment's level
  // multiplier — (1 − dk²): the kinds stay up while the picture surfaces
  // through them and ease into the lock (walked down on (1 − dk)^1.2 they had
  // mostly gone before the picture was out of the snow, and it did not show)
  function walkAt(en, dk) { return 1 + (((en && en.walk) || 1) - 1) * (1 - dk * dk); }
  // the loss a character ends in, and the depth of its reception's burn —
  // the set reads both only through these (one place for the probe's kill
  // run to switch them off and prove its checks can fail)
  function exitMode(ch) { return (ch && ch.exit && ch.exit.mode) || "squash"; }
  function burnDepth(ch) { return ch && ch.burn && ch.burn.k > 0 ? ch.burn.k : 0; }
  // 焼 the imprint (Uint8, 0..255 = the share of light the worn phosphor
  // loses, ×255) from a remembered picture's luma: k × (level)^gamma
  function burnImage(L, k, out) {
    var n = SW * SH;
    for (var p = 0; p < n; p++) { var v = L[p] / 255; v = v < 0 ? 0 : v > 1 ? 1 : v; out[p] = Math.round(255 * k * Math.pow(v, BURN.gamma)); }
    return out;
  }

  // PASS 4 — THE TUBE. Luma → P39 RGBA. On an idle tube a faint raster glow
  // is added AFTER the LUT (the tube is warm, not lit): a breathing level, a
  // crawl down the rows, a vignette (rc.91's arithmetic).
  // (P3) 焼: `burn` (optional, Uint8 SW×SH, the worn phosphor's loss ×255,
  // in GLASS coordinates) with rowMap/colMap — for each source row/column,
  // the glass row/column it lands on this frame after the roll, the squash
  // and the swell (−1: off the glass) — so the imprint stays on the glass
  // while the picture moves over it. The luma is dimmed before the ramp:
  // worn phosphor gives less light for the same beam.
  function tubePass(luma, pdata, SWp, SHp, lut, idleGlow, idleK, crawl, burn, rowMap, colMap) {
    var LR = lut.R, LG = lut.G, LB = lut.B;
    for (var p = 0, y = 0; y < SHp; y++) {
      if (burn && !(idleGlow > 0)) {
        var br = rowMap[y], bb = br * SWp;
        for (var x3 = 0; x3 < SWp; x3++, p++) {
          var l3 = luma[p], q3 = p << 2, cm = colMap[x3];
          if (br >= 0 && cm >= 0) l3 = (l3 * (255 - burn[bb + cm]) / 255) | 0;
          pdata[q3] = LR[l3]; pdata[q3 + 1] = LG[l3]; pdata[q3 + 2] = LB[l3]; pdata[q3 + 3] = 255;
        }
        continue;
      }
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
    ENTRY: ENTRY, EXIT: EXIT, BURN: BURN, lockTail: lockTail, lockLevels: lockLevels, glimpseLevels: glimpseLevels, burnImage: burnImage, wrapNear: wrapNear, exitMode: exitMode, burnDepth: burnDepth, walkAt: walkAt,
    drawCharacter: drawCharacter, checkForce: checkForce,
    envAt: envAt, lullAt: lullAt, lullSchedule: lullSchedule, burial: burial, burial2: burial2, BURY2: BURY2, needsLull: needsLull, BURY_LINE: BURY_LINE, breath: breath,
    P2_KINDS: P2_KINDS, FIELD: FIELD, episodes: episodes, episodeAt: episodeAt,
    tubeLUT: tubeLUT, lumaPass: lumaPass, ghostPass: ghostPass, sourcePass: sourcePass,
    herringRows: herringRows, humRows: humRows, xtalkPass: xtalkPass, smearPass: smearPass, impulsePass: impulsePass, geoMap: geoMap,
    geometryCopy: geometryCopy, tearStep: tearStep, lineMap: lineMap, ghostList: ghostList, tubePass: tubePass,
    textureRng: textureRng,
  };
  if (root) root.ZankyoPicture = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : null);

// ============================================================================
// ZANKYŌ — zk-broadcast.js: 受信 THE RECEIVER (S1 of PLAN-SIGNAL-INTEGRATION.md)
//
// The station occasionally picks up a signal from the distant past — for a
// machine in 3042, our time. A real reel from broadcast/ (PLAN-BROADCAST-
// SIGNAL.md §5: 6–10 non-contiguous ~12 s windows per source in one small
// MP4) is played through a <video> element whose audio enters the station's
// own receiver chain — the radio band, the receiver's grit, AM flutter, the
// seeded dropouts, the 3042 codec's staircase, the tuning envelope — and is
// heard IN the reactor hall (the broadcast layer registers deep in the hull,
// with a low send to the far wall). Then it is lost again.
//
// It is a VISITATION: the Conductor's plan seats "the broadcast" (zankyo-
// audio.js §4.6) and the engine's signal seam hands it here — arm() at plan
// time (the reel, window, in-point, hold and loss lengths and the dropout
// schedule are drawn on the engine's "signal" stream, so ?seed= reproduces
// the same signal at the same second), fire(t0) at the hosting scene's
// entry (the static rises at t0 − 4, the AIR is held from t0 − 6, the reel
// is decided at t0 − 1: ready → the signal; not ready → the synthetic gagaku
// broadcast the engine already had, the graceful-thinning rule).
//
// THE AIR: from t0 − 6 to loss + 2 the melodic voices may not claim it (the
// crew stops to listen); the drones, shō, noise and ambient continue. The
// shakuhachi is first back; the others 3–6 s later.
//
// Draw discipline: every draw of a signal comes off S.signal or its per-
// cycle fork; the reel choice's draws are taken whether or not the pool has
// loaded, so the network never moves the stream. Headless (the probe, the
// harness) this module runs against whatever document / fetch it is given
// and falls back cleanly when there is none.
// ============================================================================
(function () {
  "use strict";
  var Z = window.ZankyoAudio, PJ = window.PJ2;
  if (!Z || !Z._signal || !PJ || !PJ.Voice) return;
  var hasDOM = typeof document !== "undefined" && !!document && typeof document.createElement === "function";
  var hasFetch = typeof fetch === "function";

  var MANIFEST_URL = "broadcast/manifest.json", REEL_DIR = "broadcast/reels/";
  // ---- CACHE BUSTING (2026-09-09) ------------------------------------------
  // The manifest is served with a long max-age by the host, and both it and the
  // reels were fetched with NO version. So a RE-CUT reel — same file name, new
  // bytes and new windows — stayed stale in the owner's browser for six hours:
  // the Cage reel went five windows to three and Safari kept showing five.
  // Two different problems, two different keys:
  //   the MANIFEST is one file that changes whenever anything does, so it rides
  //     the page's own asset fingerprint (window.ZK_ASSET_V, set by index.php);
  //   a REEL is immutable content at a fixed name, so it rides its OWN rev —
  //     the first 8 hex of its sha256, written into the manifest by
  //     build-manifest.sh. An unchanged reel keeps its long cache; a re-cut one
  //     gets a new URL and is fetched fresh.
  // Both fall back to no query at all if the field is missing, so an old
  // manifest or a page that does not set the global still works.
  function manifestUrl() {
    var v = null;
    try { v = window.ZK_ASSET_V || null; } catch (e) {}
    return v ? MANIFEST_URL + "?v=" + encodeURIComponent(v) : MANIFEST_URL;
  }
  function reelUrl(reelOrId) {
    var id = (reelOrId && reelOrId.id) ? reelOrId.id : String(reelOrId);
    var rev = (reelOrId && reelOrId.rev) ? reelOrId.rev : revOf(id);
    return REEL_DIR + id + ".mp4" + (rev ? "?v=" + encodeURIComponent(rev) : "");
  }
  function revOf(id) {
    if (!pool) return null;
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i].rev || null;
    return null;
  }
  var TUNE_S = 0.4, COLLAPSE_S = 0.42, BURST_S = 0.32, DEAD_S = 1.6;
  var HOLD_LEAD_S = 6, STATIC_LEAD_S = 4, DECIDE_LEAD_S = 1, PREFETCH_LEAD_S = 12;   // from the hosting scene's start (t0 ≥ start + 8)
  var PLAN_REL_MAX = 6;                              // the largest per-voice release offset weather() can draw

  // ---- the tone vocabulary, in ONE place ------------------------------------
  // `tone` was tested by open-coded string comparison in two places, and when
  // the pool went from 52 reels to 207 it gained a value neither of them knew:
  // `drone`, carried by exactly one reel — cham-tashi-lhunpo-ignca, a Tibetan
  // ritual horn drone, tuned, four measured pitches, the most drone-like thing
  // in the pool. It matched NEITHER tide arm, so alone of 207 reels it got no
  // tide multiplier at all; and it failed §11.3's eligibility test, so the one
  // reel the sea-change path was designed for was the one excluded from it.
  //
  // The orchestrator's ruling: drone is handled exactly as tone is, everywhere.
  // The tables are here so that "everywhere" is one edit and not three, and so
  // an unknown value is LOUD rather than silently unweighted — the librarian
  // will add more reels, and this is a data-shape assumption about a file that
  // is not ours.
  var RAGGED_WINDOW_S = 0.25;                            // the tuned reels sit at 0.090 s today; the pool reaches 2.0
  var TONE_DARK = { voice: 1, noise: 1, tone: 1, drone: 1 };
  var TONE_LIGHT = { music: 1, sung: 1 };
  var TONE_PITCHED = { tone: 1, sung: 1, drone: 1 };     // §11.3: the kinds that may pull the field to themselves
  function toneKnown(t) { return !!(TONE_DARK[t] || TONE_LIGHT[t]); }
  var RECENT_CYCLES = 3;
  var DITHER_DB = -3;   // the dither into the staircase, relative to one step (S3; 0 = a whole step, −∞ = the bare squelch)
  // ---- the dropout holes: a duck under static, not a mute (the owner's ear, 2026-09-13) ----
  // The seeded holes (weather(): one every 1.2–4.5 s, each 0.12–0.37 s, denser
  // through the loss) are what the picture stutters on — the set drops its
  // strength by 0.45 in a hole, so the snow rises. The gate under the reel used
  // to ramp its gain to EXACTLY ZERO for the same span, and 120–370 ms of
  // nothing is a syllable or a whole word: Cage would say "silence" and the
  // set would hand you "si—ce". A hard mute is also the one thing a receiver
  // losing its signal does not do — the carrier weakens and the noise floor
  // comes up over what is left of the voice. So a hole is now two things at
  // once: the reel DUCKS to DROP_FLOOR of its level (still there, buried),
  // and a burst of band-limited static rises for exactly the hole the picture
  // shows, so the ear hears static swelling, not a gap. The holes' timing is
  // untouched: same draws, same picture, same stream.
  //   DROP_FLOOR — the reel under a hole, as a fraction of its level (0 would
  //                be the old mute; 1 would be no hole at all)
  //   DROP_HISS  — the static in a hole, relative to the reel's own tuning
  //                envelope (it rides sg, so it fades through the loss and
  //                scales with the reel's gain like everything else)
  var DROP_FLOOR = 0.35, DROP_HISS = 0.5;

  // ==========================================================================
  // 形 THE SHAPES OF A RECEPTION — the owner's constants, in ONE block
  // ==========================================================================
  // PLAN-SIGNAL-SHAPES.md §3.6. Every weight the owner tunes by ear is here, so
  // moving one value means the same thing on every night. The frequency and the
  // silence between receptions live beside BC_JO_P in zankyo-audio.js, because
  // they are decisions the PLACEMENT makes and this file never sees.
  //
  // §2 THE LENGTH RULE. A reception's ON-AIR time — the sum of the seconds you
  // actually hear the signal, summed over its pieces — is at least 8 s and at
  // most the Cage reel's 40 s. The budget is drawn at plan time from this
  // table; the receiver then fills it with a shape. Where the pool cannot serve
  // a budget the budget DEGRADES to the longest the pool can serve, which until
  // the reels are re-cut (§5) is 12 s on every reel but Cage — so the spread
  // below is only reachable as the long windows arrive, and the harness's
  // achieved-distribution line is the measure of the gap.
  var BUDGET_TABLE = [   // [lo, hi, share]
    [8, 12, 0.15],       // today's clip
    [12, 18, 0.25],
    [18, 25, 0.25],
    [25, 32, 0.20],
    [32, 40, 0.15]       // the Cage thoughts' range
  ];
  var BUDGET_MIN_S = 8, BUDGET_MAX_S = 40;   // §7 q1/q6: 8 s is the floor, there is no glimpse
  // §3.1 THE BODIES — what the signal DOES.
  var BODY_W = { jou: 0.67, modori: 0.16, dan: 0.09, sou: 0.08 };   // 常 · 戻 · 断 · 走
  var ENTRY_W = { soku: 0.65, tan: 0.20, fu: 0.15 };                // 即 · 探 · 浮
  var EXIT_W  = { setsu: 0.65, zan: 0.25, zetsu: 0.10 };            // 切 · 残 · 絶
  var KANA = { jou: "常", modori: "戻", dan: "断", sou: "走", soku: "即", tan: "探", fu: "浮", setsu: "切", zan: "残", zetsu: "絶" };
  var POROUS_P = 0.30;                       // §3.5: one melodic voice left OUT of the hold, and it may play over the signal
  var POROUS_VOICES = ["shakuhachi", "biwa", "hichiriki", "koto", "shamisen"];   // weighted to the sparse ones; NEVER vox — the intercom is a second speaker and would read as part of the broadcast
  var POROUS_W      = [0.30, 0.25, 0.25, 0.10, 0.10];
  var CALLBACK_P = 0.25;                     // 同: a later reception in the same cycle is the SAME reel, a later window
  // 戻 the return: the piece lengths, the carrier-lost gap, the relock
  var MOD_PIECE_MIN_S = 3, MOD_PIECE_MAX_S = 10;
  var MOD_GAP_MIN_S = 6, MOD_GAP_MAX_S = 15;
  var MOD_RELOCK_S = 0.2;                    // the same frequency, found again — no 4 s static rise
  var MOD_ADV_MIN = 1, MOD_ADV_MAX = 3;      // the in-point advances by the gap × this (time collapsing while the carrier was lost)
  var MOD_TWO_BUDGET_S = 26;                 // two returns only on a budget this large
  // 断 the broken carrier: real losses of 1–3 s inside one piece
  var HOLE_MIN_S = 1, HOLE_MAX_S = 3, HOLE_FLOOR = 0.12;   // below DROP_FLOOR: this is a loss, not a duck
  // 走 the scan: two different reels, the dial sweeping between them
  var SCAN_SWEEP_MIN_S = 2, SCAN_SWEEP_MAX_S = 3, SCAN_PIECE_MIN_S = 4;
  // 探 the hunt / 浮 the drift-in
  var HUNT_MIN_S = 3, HUNT_MAX_S = 8, HUNT_GLIMPSE_MIN = 2, HUNT_GLIMPSE_MAX = 4;
  var DRIFT_MIN_S = 6, DRIFT_MAX_S = 10;
  // 残 the lingering loss / 絶 mid-word
  var ZAN_MIN_S = 6, ZAN_MAX_S = 12, ZETSU_S = 0.02;
  var GAP_FLOOR = 0;                         // the carrier IS lost in a gap — not ducked, gone
  // §6 R1 vs R2, IN ONE SWITCH. R1 is the budget, the frequency, the drawn
  // silence and the queue, with every reception still 常 the ordinary — so the
  // owner hears ONE change at a time and the harness measures one variable
  // against the same seeds. The draws are taken either way, so turning this on
  // does not move the stream by itself; it changes what the numbers MEAN.
  var SHAPES_ON = false;

  // ---- §4.1 THE DRAW AT PLAN TIME ------------------------------------------
  // WHO DRAWS WHAT, and why the line falls here. The placement in
  // zankyo-audio.js has to know a reception's FOOTPRINT before it can seat it,
  // 55 s before the receiver arms; the receiver has to know the REEL before it
  // can know anything else, and the pool has not loaded when the cycle is
  // planned. So the decision is split along the only seam that is real:
  //
  //   PLAN draws the footprint — the on-air budget, the body, the entry and
  //     the exit with their lengths, the gaps between pieces and the holes
  //     inside them, and the silence before the whole thing. Those and only
  //     those decide how much room a reception needs.
  //   ARM draws everything that depends on the reel — which reel, which
  //     window, the in-points, how the budget divides between the pieces, where
  //     the holes fall, the porous voice, the callback.
  //
  // PLAN-SIGNAL-SHAPES.md §4.1 had the whole shape drawn at arm and the
  // placement reserving the WORST CASE per budget. Measured, that does not
  // work: the worst case is an entry of 10 s, thirty seconds of gaps and a 12 s
  // exit, so an 8 s budget would reserve 45 s and a 40 s budget 92 s, and a
  // seven-minute cycle with ~270 s of legal time then holds two receptions
  // where the owner asked for 1.75× today's number. Drawing the footprint where
  // the footprint is needed gives the placement an EXACT span instead of a
  // ceiling, and the frequency the owner asked for becomes reachable. The
  // weights are still all in the one block above; zankyo-audio.js supplies
  // random numbers and never a constant.
  //
  // The count is FIXED. Every broadcast takes SHAPE_DRAWS numbers off the
  // cycle's fork whether or not it is ever seated, so a refusal cannot shift
  // the night.
  var SHAPE_DRAWS = 9;
  function pickW(tbl, r) {
    var k, tot = 0, acc = 0, keys = [];
    for (k in tbl) { keys.push(k); tot += tbl[k]; }
    for (var i = 0; i < keys.length; i++) { acc += tbl[keys[i]] / tot; if (r < acc) return keys[i]; }
    return keys[keys.length - 1];
  }
  // §2: the on-air budget, from ONE number. The number picks the bucket and
  // the position inside it, so the whole table costs a single draw.
  function drawBudget(r) {
    var acc = 0;
    for (var i = 0; i < BUDGET_TABLE.length; i++) {
      var b = BUDGET_TABLE[i], last = i === BUDGET_TABLE.length - 1;
      if (r < acc + b[2] || last) {
        var k = b[2] > 0 ? Math.min(0.999999, Math.max(0, (r - acc) / b[2])) : 0;
        return b[0] + k * (b[1] - b[0]);
      }
      acc += b[2];
    }
    return BUDGET_MIN_S;
  }
  // The shape, and the room it needs. Everything the placement has to know.
  function drawShape(r) {
    var budgetS = drawBudget(r[0]);
    var body = pickW(BODY_W, r[1]);
    var entry = pickW(ENTRY_W, r[2]);
    var exit = pickW(EXIT_W, r[4]);
    var entryS = entry === "soku" ? TUNE_S : entry === "tan" ? (HUNT_MIN_S + r[3] * (HUNT_MAX_S - HUNT_MIN_S)) : (DRIFT_MIN_S + r[3] * (DRIFT_MAX_S - DRIFT_MIN_S));
    var exitS = exit === "setsu" ? (LOSS_MIN_S + r[5] * LOSS_SPAN_S) : exit === "zan" ? (ZAN_MIN_S + r[5] * (ZAN_MAX_S - ZAN_MIN_S)) : ZETSU_S;
    var gaps = [], holes = [], pieces = 1;
    if (!SHAPES_ON) {
      body = "jou"; entry = "soku"; exit = "setsu";
      entryS = TUNE_S; exitS = LOSS_MIN_S + r[5] * LOSS_SPAN_S;
    } else if (body === "modori") {
      pieces = (budgetS >= MOD_TWO_BUDGET_S && r[8] < 0.4) ? 3 : 2;
      for (var g = 0; g < pieces - 1; g++) gaps.push(MOD_GAP_MIN_S + (g ? r[7] : r[6]) * (MOD_GAP_MAX_S - MOD_GAP_MIN_S));
    } else if (body === "sou") {
      pieces = 2;
      gaps.push(SCAN_SWEEP_MIN_S + r[6] * (SCAN_SWEEP_MAX_S - SCAN_SWEEP_MIN_S));
    } else if (body === "dan") {
      var nh = r[6] < 0.45 ? 1 : 2;
      for (var h = 0; h < nh; h++) holes.push(HOLE_MIN_S + (h ? r[8] : r[7]) * (HOLE_MAX_S - HOLE_MIN_S));
    }
    // 戻 relocks on the same frequency (short); 走 locks at the end of its sweep
    var lockS = body === "modori" ? MOD_RELOCK_S : 0;
    var gapS = 0, i;
    for (i = 0; i < gaps.length; i++) gapS += gaps[i] + lockS;
    var holeS = 0; for (i = 0; i < holes.length; i++) holeS += holes[i];
    var spanS = entryS + budgetS + gapS + holeS + exitS;
    return { budgetS: budgetS, body: body, entry: entry, exit: exit, entryS: entryS, exitS: exitS,
      gaps: gaps, holes: holes, pieces: pieces, lockS: lockS,
      spanS: spanS,
      // what the placement has to keep clear either side of t0
      leadS: STATIC_LEAD_S, holdLeadS: HOLD_LEAD_S, tailS: COLLAPSE_S + BURST_S + DEAD_S,
      reachS: spanS + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S) };
  }

  // ---- the plan object -----------------------------------------------------
  // ONE object describes a reception — today's clip and every shape §3 adds —
  // and everything downstream reads it: the graph, the air hold, the tube, the
  // VFD, the harness. A reception with a gap in it is then not a special case
  // anywhere. Times are WALL SECONDS RELATIVE TO t0.
  //
  //   entryS    the arrival, before the first piece sounds (即 0.4 · 探 3–8 · 浮 6–10)
  //   segments  [{ inS, onS, reel, lockS }] the pieces in order; lockS is the
  //             relock in front of a piece that follows a gap (0 for the first)
  //   gaps      [{ durS, sweep }] the carrier lost BETWEEN pieces, one per join
  //   holes     [{ atS, durS }] the carrier lost INSIDE a piece (断)
  //   exitS     the loss ramp (切 1.6–2.8 · 残 6–12 · 絶 ~0)
  //   presenceS Σ onS — the ON-AIR time, §2's budget as achieved
  //   spanS     t0 to the cut
  //
  // planTimes() is the ONE place the timeline is derived, so the graph, the
  // tube and the air hold cannot disagree about when a piece starts.
  function planTimes(P) {
    var cur = P.entryS, on = 0, i;
    for (i = 0; i < P.segments.length; i++) {
      var s = P.segments[i];
      if (i > 0) { P.gaps[i - 1].atS = cur; cur += P.gaps[i - 1].durS; }
      s.lockAtS = cur; cur += (s.lockS || 0);
      s.atS = cur; cur += s.onS; on += s.onS;
      // the source runs under the entry for the first piece (the tune-in is
      // heard OVER the reel, as it always was) and from the relock after that
      s.srcFromS = (i === 0) ? 0 : s.lockAtS;
    }
    P.lossAtS = cur;
    P.spanS = cur + P.exitS;
    P.presenceS = on;
    for (i = 0; i < P.segments.length; i++) {
      P.segments[i].srcToS = (i === P.segments.length - 1) ? P.spanS + 0.2 : P.segments[i].atS + P.segments[i].onS + 0.05;
    }
    return P;
  }
  // A RECEPTION FROM ITS SHAPE. At R1 every shape is still 常 the ordinary —
  // one piece, the whole budget — because SHAPES_ON is false and drawShape
  // forces it; R2 turns that on and this is where the pieces are cut.
  function planFor(sh, reel, inS, onS, exitS) {
    if (!sh || sh.body === "jou") {
      var P = planOne(reel, inS, onS, exitS);
      if (sh) { P.entry = sh.entry; P.entryS = sh.entryS; P.exit = sh.exit; planTimes(P); }
      return P;
    }
    return planOne(reel, inS, onS, exitS);   // R2 fills this in
  }
  // today's clip, exactly: one piece, a snap in, a cut out
  function planOne(reel, inS, onS, exitS) {
    return planTimes({ body: "jou", entry: "soku", exit: "setsu", entryS: TUNE_S, exitS: exitS,
      segments: [{ inS: inS, onS: onS, reel: reel, lockS: 0 }], gaps: [], holes: [], porous: null, callback: false });
  }
  // is t (relative to t0) inside a carrier-lost gap, an entry or an exit —
  // anywhere the reel is not sounding?
  function inGap(P, t) {
    if (t < P.entryS || t >= P.lossAtS) return false;
    for (var i = 0; i < P.gaps.length; i++) {
      var g = P.gaps[i], seg = P.segments[i + 1];
      if (t >= g.atS && t < (seg ? seg.atS : g.atS + g.durS)) return true;   // the relock counts as lost too
    }
    return false;
  }
  function planReels(P) { var o = [], i; for (i = 0; i < P.segments.length; i++) if (P.segments[i].reel && o.indexOf(P.segments[i].reel) < 0) o.push(P.segments[i].reel); return o; }
  // What the set and the harness are handed: the shape, in plain numbers, with
  // no reel objects in it.
  function planWire(P) {
    var segs = [], i;
    for (i = 0; i < P.segments.length; i++) segs.push({ atS: +P.segments[i].atS.toFixed(3), onS: +P.segments[i].onS.toFixed(3), lockS: P.segments[i].lockS || 0 });
    var gaps = []; for (i = 0; i < P.gaps.length; i++) gaps.push({ atS: +P.gaps[i].atS.toFixed(3), durS: +P.gaps[i].durS.toFixed(3), sweep: !!P.gaps[i].sweep });
    var holes = []; for (i = 0; i < P.holes.length; i++) holes.push({ atS: +P.holes[i].atS.toFixed(3), durS: +P.holes[i].durS.toFixed(3) });
    return { body: P.body, entry: P.entry, exit: P.exit, entryS: +P.entryS.toFixed(3), exitS: +P.exitS.toFixed(3),
      lossAtS: +P.lossAtS.toFixed(3), spanS: +P.spanS.toFixed(3), presenceS: +P.presenceS.toFixed(3),
      budgetS: P.budgetS != null ? +P.budgetS.toFixed(2) : null, segments: segs, gaps: gaps, holes: holes,
      glimpses: P.glimpses || null, porous: P.porous || null, callback: !!P.callback };
  }
  // a 50 ms silent MP4: the media element is "primed" with it inside the PLAY
  // gesture (the ▶ play event is emitted synchronously from the click), so
  // later timer-driven play() calls are allowed where autoplay policy would
  // otherwise refuse (iOS). Replaced at build time by the real bytes.
  var PRIME_SRC = "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAxZtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAB9AAAABkAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACQXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAABkAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAZAAAAQAAAEAAAAAAbltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAB9AAAAFkFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFkbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEoc3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAB9AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAA+gAAAECQWAgIAFFYhW5QAGgICAAQIAAAAUYnRydAAAAAAAAA+gAAAECQAAACBzdHRzAAAAAAAAAAIAAAABAAAEAAAAAAEAAAGQAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAAAEwAAAAQAAAAUc3RjbwAAAAAAAAABAAADQgAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAACAAAAAQAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDEAAAAIZnJlZQAAAB9tZGF03ABMYXZjNjMuMS4xMDEAAjBADgEYIAc=";

  function tl() { return Z._signal.tools(); }
  function db2lin(db) { return Math.pow(10, (+db || 0) / 20); }

  // ---- the pool ----
  var pool = null, poolState = "idle", poolError = null, poolUnknownTones = {};   // idle | loading | ready | failed
  function loadPool() {
    if (poolState === "loading" || poolState === "ready") return;
    if (!hasFetch) { poolState = "failed"; poolError = "no fetch"; return; }
    poolState = "loading";
    try {
      fetch(manifestUrl()).then(function (r) { return r.json(); }).then(function (m) {
        var arr = Array.isArray(m) ? m : (m && m.reels) || [];
        var out = [];
        var unknown = {}, ragged = [], wholeTuned = [];
        for (var i = 0; i < arr.length; i++) { var e = arr[i]; if (e && e.id && !e.takedown && e.windows && e.windows.length) {
          if (!toneKnown(e.tone)) unknown[e.tone] = (unknown[e.tone] || 0) + 1;
          // A TUNED REEL'S WINDOWS MUST BE THE SAME LENGTH, near enough.
          // §11.2 re-aims a tuned reel onto whichever window sits nearest the
          // field, and holdS is derived from THAT window's length — so on a
          // reel whose windows differ, re-aiming changes the hold, which
          // changes the air hold, which denies a different melodic claim, and
          // HOME NIGHTS MOVE. Today they do not, because the tuned reels vary
          // by at most 0.090 s (tvdx-pik1-cyprus) which is under a percent of
          // a hold. But the pool's true spread is 2.000 s — gbc-accra
          // alternates 12 s and 10 s windows — and TEN reels over 0.2 s are
          // untuned only because no pitch was found in them. The bound is a
          // property of a neighbouring fact, not of anything here, exactly like
          // §11's cap being unreachable only because there are two degrees a
          // fifth apart. One `tuned: true` from the librarian on any of those
          // ten and byte-identity starts failing with no visible cause, so the
          // assumption says so out loud instead of resting quietly.
          if (e.tuned && (e.whole || e.wholeWindows)) wholeTuned.push(e.id);
          if (e.tuned && e.windows.length > 1) {
            var wlo = 1e9, whi = -1e9;
            for (var wj = 0; wj < e.windows.length; wj++) {
              var wln = e.windows[wj][1] - e.windows[wj][0];
              if (wln < wlo) wlo = wln; if (wln > whi) whi = wln;
            }
            if (whi - wlo > RAGGED_WINDOW_S) ragged.push(e.id + " (" + (whi - wlo).toFixed(2) + "s)");
          }
          out.push(e);
        } }
        // LOUD, not silent. A tone the receiver does not know gets no tide
        // weighting and no §11.3 eligibility, which is invisible in every gate
        // we own — it is simply a reel that never quite behaves.
        var uk = Object.keys(unknown);
        if (uk.length && typeof console !== "undefined" && console.error) {
          console.error("ZankyoBroadcast: manifest carries " + uk.length + " UNKNOWN tone value(s) — " +
            uk.map(function (k) { return k + "×" + unknown[k]; }).join(", ") +
            ". They get no tide weighting and cannot sea-change. Add them to TONE_DARK/TONE_LIGHT/TONE_PITCHED in zk-broadcast.js.");
        }
        // A typo in ?reel= would otherwise be a night that quietly ignores the
        // owner: the pin never matches and the lottery runs as if the lever
        // were not there. Say so.
        (function () {
          var pid = pinnedId(); if (!pid) return;
          for (var pi = 0; pi < out.length; pi++) if (out[pi].id === pid) return;
          if (typeof console !== "undefined" && console.error) {
            console.error("ZankyoBroadcast: ?reel=" + pid + " matches no reel in the manifest — the pin is ignored and " +
              "the lottery runs as usual. Check the id against broadcast/manifest.json.");
          }
        })();
        if (wholeTuned.length && typeof console !== "undefined" && console.error) {
          console.error("ZankyoBroadcast: " + wholeTuned.length + " reel(s) are BOTH whole and tuned — " +
            wholeTuned.slice(0, 6).join(", ") + ". §14 decides the hold on the UNBENT window length (as §11.2 does, " +
            "deliberately), so at rate ≠ 1 the hold would not cover the thought on the wall clock. Untested: " +
            "either untune the reel or teach §14 the rate, in a commit that measures it.");
        }
        if (ragged.length && typeof console !== "undefined" && console.error) {
          console.error("ZankyoBroadcast: " + ragged.length + " TUNED reel(s) have windows of differing length — " +
            ragged.slice(0, 6).join(", ") + ". §11.2 re-aims across windows and derives the hold from the one it picks, " +
            "so this moves home nights. Either give the reel equal windows or leave it untuned.");
        }
        poolUnknownTones = unknown;
        pool = out; poolState = out.length ? "ready" : "failed"; if (!out.length) poolError = "empty manifest";
      }).catch(function (e) { poolState = "failed"; poolError = String(e && e.message || e); });
    } catch (e) { poolState = "failed"; poolError = String(e && e.message || e); }
  }

  // ==========================================================================
  // 経路 ?reels=buffer — THE REEL WITHOUT A MEDIA ELEMENT (the Bluetooth switch)
  // ==========================================================================
  // Suspect 2 and suspect 4 of the skipping report are the same object seen
  // twice: the reel <video>. On Safari a media element with an audio track is
  // a thing the OS is told about — it joins Now Playing, it is offered to the
  // route manager, and on a Bluetooth sink that is exactly where a codec or
  // route renegotiation would come from. "Every time the TV turns on" is what
  // that would sound like. createMediaElementSource is supposed to take the
  // element's audio away from the OS and give it to the graph, but the
  // ELEMENT is still an element, and WebKit's bookkeeping is not Chrome's.
  //
  // This switch removes the question instead of arguing it. The reel's audio
  // arrives as an ArrayBuffer, is decoded once, and is played by an
  // AudioBufferSourceNode into the same receiver chain — the band, the grit,
  // the flutter, the dropouts, the staircase, the tuning envelope, all of it
  // unchanged, because only the FIRST node differs. The <video> is kept for
  // the picture alone and given no voice at all: muted, volume 0, its
  // AudioTrackList disabled where the UA has one, and never once passed to
  // createMediaElementSource. Nothing new is announced to the OS when the
  // second set lights up.
  //
  // It is not free — the whole reel is decoded (a 72-120 s file is 30-45 MB of
  // float) and fetched a second time for the picture. Two buffers are kept.
  // That is the price of an answer.
  // ---- ?reel=<id> — the owner's pin (2026-09-09) ----------------------------
  // The night's FIRST SEATED broadcast is this reel; the lottery resumes after
  // it. "Seated" means ON THE AIR, not merely armed: the pin is spent where
  // stats.signals++ is, so an arm that falls back to the gagaku does not eat
  // it. While stopped, 選局 auditions the pinned reel on every press.
  // No new draws anywhere: choose() takes its six as always and the pin only
  // replaces the reel the weighting landed on, so the signal stream is
  // untouched and a pinned night is still reproducible from its seed.
  var pinUsed = false;
  // ---- the reel bench (reel-lab.php) ---------------------------------------
  // A forced choice for ONE seating: this reel, this window, whole or sliced.
  // It bypasses the LOTTERY and the cooldown and NOTHING ELSE — legality, the
  // footprint check, the deadlines, the hold, the AIR and the tube are all the
  // production path, because a bench that takes a shortcut past those is a
  // bench that agrees with itself and tells the owner nothing.
  var benchForce = null, benchQueued = null, benchWholeOverride = null;
  // 1.5 s, not 2.0. MEASURED: at a 2.0 s lead the press-to-SOUND latency in
  // WebKit was 2.97 s — the lead plus the tune-in ramp climbing to audibility —
  // which passes a 3 s gate by thirty milliseconds, i.e. by luck. The element is
  // pre-warmed by prefetchReel when the reel is chosen and after every seat, so
  // the lead only has to cover fire()'s scheduling and the lane's 0.25 s
  // lookahead. 1.5 s lands it near 2.4 s with real margin.
  var BENCH_NOW_LEAD_S = 1.5;   // press → tune-in, the bench default
  function pinnedId() {
    try { return (window.ZankyoAudio && ZankyoAudio.getRoute && ZankyoAudio.getRoute().pinnedReel) || null; } catch (e) { return null; }
  }
  function pinnedReel() {
    var id = pinnedId(); if (!id || !pool) return null;
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
    return null;
  }
  function reelsBuffered() {
    try { return !!(window.ZankyoAudio && ZankyoAudio.getRoute && ZankyoAudio.getRoute().reelsMode === "buffer"); } catch (e) { return false; }
  }
  // Take the element's voice away, as far as each engine allows. muted and
  // volume are the portable half; audioTracks is WebKit's own, and is the
  // only one that removes the TRACK rather than silencing it — which is the
  // difference between an element the OS route manager still counts and one
  // it does not. Re-applied on every metadata load: a new src brings new
  // tracks, and a track list that arrives after the src is set would
  // otherwise come back enabled.
  function hushElement(v) {
    if (!v) return;
    try { v.muted = true; v.volume = 0; } catch (e) {}
    try {
      var at = v.audioTracks;
      if (at && at.length) for (var i = 0; i < at.length; i++) { try { at[i].enabled = false; } catch (e2) {} }
    } catch (e3) {}
  }
  // the decoded reels: at most two, the live one and the one before it
  var bufCache = {}, bufOrder = [], bufPending = {};
  function decodeReel(id, ctx) {
    if (bufCache[id]) return Promise.resolve(bufCache[id]);
    if (bufPending[id]) return bufPending[id];
    if (!hasFetch || !ctx || typeof ctx.decodeAudioData !== "function") return Promise.reject(new Error("no decoder"));
    var pr = fetch(reelUrl(id)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      // Safari has only recently had the promise form; the callback form is
      // the one both engines have always had, so ask for it explicitly.
      return new Promise(function (res, rej) { ctx.decodeAudioData(ab, res, function (e) { rej(e || new Error("decode failed")); }); });
    }).then(function (buf) {
      bufCache[id] = buf; bufOrder.push(id);
      while (bufOrder.length > 2) { var old = bufOrder.shift(); if (old !== id) delete bufCache[old]; }
      delete bufPending[id];
      return buf;
    }, function (e) { delete bufPending[id]; throw e; });
    bufPending[id] = pr;
    return pr;
  }

  // ---- THE ELEMENTS AND THEIR NODES: A PAIR, NOT ONE ------------------------
  // §4.2. One media element cannot prefetch the next reel while it is playing
  // the current one — a src change or a seek is exactly what "playing" means —
  // and that single element is the reason two receptions had to sit 95 s apart.
  // There are TWO now, A and B, taken in turn: a reception owns one for its
  // whole life (prefetch, play, teardown) and the next one loads into the
  // other. Reception n uses element n % 2, so n + 2 reuses n's element, which
  // finished long before n + 1 began — the pair is enough for any spacing the
  // placement can produce, because no two receptions ever overlap.
  //
  // createMediaElementSource is PERMANENT per element (WebKit re-routes it for
  // the life of the page), so each element gets its own node, made once.
  // In ?reels=buffer mode neither element is ever given to the graph at all.
  var ELEMS = 2;
  var videos = [null, null], mediaSrcs = [null, null], videoSrcIds = [null, null], primed = false, elemTurn = 0;
  function ensureVideo(ix) {
    ix = (ix | 0) % ELEMS;
    if (videos[ix] || !hasDOM) return videos[ix];
    try {
      var v = document.createElement("video");
      v.setAttribute("playsinline", ""); v.playsInline = true; v.preload = "none"; v.crossOrigin = "anonymous";
      var buffered = reelsBuffered();
      if (buffered) { v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.volume = 0; }
      else { v.muted = false; v.volume = 1; }
      if (buffered) {
        // a new src brings a new track list; hush it every time one lands
        v.addEventListener("loadedmetadata", function () { hushElement(v); });
        v.addEventListener("loadeddata", function () { hushElement(v); });
        try { if (v.audioTracks && v.audioTracks.addEventListener) v.audioTracks.addEventListener("addtrack", function () { hushElement(v); }); } catch (e2) {}
      }
      if (v.style) v.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:0";
      var host = document.body || document.documentElement; if (host && host.appendChild) host.appendChild(v);
      videos[ix] = v;
      if (buffered) hushElement(v);
    } catch (e) { videos[ix] = null; }
    return videos[ix];
  }
  function ensureMediaSource(ctx, ix) {
    // 経路: in buffer mode the element is NEVER given to the graph. One call
    // is permanent — WebKit re-routes the element for the life of the page —
    // so this is the single gate that keeps the two worlds apart.
    ix = (ix | 0) % ELEMS;
    if (reelsBuffered()) return null;
    if (mediaSrcs[ix] || !videos[ix] || !ctx || typeof ctx.createMediaElementSource !== "function") return mediaSrcs[ix];
    try { mediaSrcs[ix] = ctx.createMediaElementSource(videos[ix]); } catch (e) { mediaSrcs[ix] = null; }
    return mediaSrcs[ix];
  }
  function onPlay() {
    loadPool();
    pinUsed = false;          // one pin per night, re-armed by ▶ play

    // BOTH elements are primed inside the PLAY gesture, or the second one would
    // be the first to meet iOS's autoplay policy halfway through a night.
    var any = false;
    for (var ix = 0; ix < ELEMS; ix++) {
      var v = ensureVideo(ix); if (!v) continue;
      any = true;
      ensureMediaSource(tl().ctx, ix);
      if (primed) continue;
      try {
        if (!v.src) { v.src = PRIME_SRC; videoSrcIds[ix] = null; }
        var p = v.play();
        if (p && typeof p.then === "function") p.then((function (vv) { return function () { try { vv.pause(); } catch (e) {} }; })(v), function () {});
      } catch (e) {}
    }
    if (any) primed = true;
  }
  try { Z.setEventListener(function (ev) { if (ev && ev.label === "▶ play") onPlay(); }); } catch (e) {}
  loadPool();   // the manifest is the one thing fetched at page load (plan §2.1) — so the first ♪ or 選局 finds a reel (critic S2 r1)

  // ---- the recent ring: reels heard in the last RECENT_CYCLES cycles ----
  var recent = [];   // [{ id, cycle }]
  function recentIds(cycle) { var out = {}; for (var i = 0; i < recent.length; i++) if (recent[i].cycle >= cycle - RECENT_CYCLES) out[recent[i].id] = true; return out; }   // heard at cycle c → out for c+1, c+2, c+3 (critic S1 r1: > kept it out two)
  function remember(id, cycle) { recent.push({ id: id, cycle: cycle }); lastCycleSeen = cycle; while (recent.length > 12) recent.shift(); }
  var lastCycleSeen = 0;

  // §8.1: reels WITH a picture are weighted in the lottery, and 85 % of
  // received reels carrying one is the target the weight serves — not the
  // weight itself. On the old 32-reel pool (21 video) that took 3×; on the
  // wider 52-reel pool (41 video) 3× overshoots to 90 % and starts crowding
  // out the numbers stations, the Buzzer and the time signals, which are the
  // receiver's core and must keep surfacing. 1.5× lands the same 85 % on the
  // new pool. The synthetic gagaku broadcast stays the fallback only — this
  // weights WHICH real reel is chosen, never whether a real one is.
  var VIDEO_WEIGHT = 1.5;

  // ---- §14 WHOLE-THOUGHT WINDOWS (owner, 2026-09-09) ------------------------
  // A reel cut on complete sentences says so with "whole": true, and then a
  // window is not a field to take a slice out of — it IS the thought, and the
  // receiver plays it from its start to its end. john-cage-interview is the
  // first: five windows, 18–25 s, each a finished sentence.
  //
  // A per-window override rides in an OPTIONAL PARALLEL ARRAY `wholeWindows`,
  // index for index, exactly as pitchHz does — and for the same reason. Five
  // call sites index a window positionally; a window that had grown a third
  // element or turned into an object would read win[0] as undefined and put
  // NaN into inS, which is the shape of the fault that cost this crew a phase.
  // `windows` stays [start, end] and nothing else, forever.
  //
  // THE CEILING IS NOT TASTE, IT IS THE SPACING. Two broadcasts sit
  // BC_GAP_S = 95 s apart (zankyo-audio.js) and each arms BC_ARM_LEAD_S = 55 s
  // early, so a broadcast owns exactly 40 s before the NEXT one's arm calls
  // airHoldClear() and drops its hold out from under it. The planned hold
  // reaches TUNE_S + holdS + lossD + 2 + max(rel) past t0 — with lossD ≤ 2.8
  // and rel ≤ 6 that is holdS + 11.2 — so holdS ≤ 28.8, and 27.8 leaves a
  // second of margin. The owner asked for a 40 s cap: 40 IS NOT REACHABLE
  // without widening BC_GAP_S, and a 40 s hold would let the next arm clear a
  // live broadcast's hold and put melodic notes inside it, which is the §12
  // sweep's whole subject. Every window on the only whole reel today is
  // 18–25 s, so nothing is lost. To raise this, raise BC_GAP_S in the same
  // commit and re-derive both numbers together.
  // 42 s — the owner's three Cage thoughts are 40.0 / 32.4 / 33.0 s. This is no
  // longer bounded by BC_GAP_S, because the spacing is no longer a single
  // global number: see fitsRoom(). A footprint this big is simply refused
  // wherever it does not fit, which is most places when a cycle carries two
  // broadcasts, and allowed where it does.
  var WHOLE_MAX_HOLD_S = 42;
  // The KIRU margin the harness gate uses: a signal is "within a KIRU's reach"
  // if the cut falls between t0 − 20 and the loss ramp's end + 15. t0 is the
  // seating's to choose; the tail is ours, so this is the number a footprint
  // must clear.
  var KIRU_CLEAR_S = 15;
  // THE DRAWS' OWN BOUNDS, named so the reach below cannot drift from them.
  // mulberry32 returns [0, 1), so these are STRICT upper bounds, not typical
  // values: lossD < 2.8 and rel < 6, always. Anyone retuning a draw retunes
  // the constant beside it and the exported reach follows for free.
  var LOSS_MIN_S = 1.6, LOSS_SPAN_S = 1.2;      // lossD = LOSS_MIN_S + r * LOSS_SPAN_S
  var REL_MIN_S = 3, REL_SPAN_S = 3;            // rel   = REL_MIN_S  + r * REL_SPAN_S (the four plucked/reed voices)
  var HOLD_TAIL_S = 2;                          // the flat +2 the planned and real holds both add past the cut
  // How far past t0 the receiver's hold can ever reach. zankyo-audio.js checks
  // this against BC_GAP_S − BC_ARM_LEAD_S at play, so the two files cannot
  // disagree the way a comment did.
  function maxReachPastT0() {
    return TUNE_S + WHOLE_MAX_HOLD_S + (LOSS_MIN_S + LOSS_SPAN_S) + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S);
  }
  function wholeAt(reel, i) {
    var wa = reel.wholeWindows;
    if (wa && wa[i] != null) return !!wa[i];
    return !!reel.whole;
  }
  function wholeFits(reel, i) { return (reel.windows[i][1] - reel.windows[i][0]) <= WHOLE_MAX_HOLD_S; }
  function longestWindow(reel) { var m = 0; for (var i = 0; i < reel.windows.length; i++) { var l = reel.windows[i][1] - reel.windows[i][0]; if (l > m) m = l; } return m; }
  // ---- §14 FOOTPRINT-AWARE LEGALITY ----------------------------------------
  // THE SPACING IS FOOTPRINT-DEPENDENT (orchestrator, 2026-09-09), not a wider
  // global gap: an ordinary 8–12 s hold needs what it always needed and W4's
  // 1.69 broadcasts a cycle is untouched on every night that plays no whole
  // reel; a 40 s thought needs ~113 s of room and simply does not get seated
  // where that is not there. BC_GAP_S stays 95.
  //
  // Two different reaches matter and they are not the same number:
  //   the HOLD reaches TUNE_S + holdS + lossD + tail + max(rel) past t0 — that
  //     is what the next broadcast's arm would clear out from under it;
  //   the SIGNAL reaches TUNE_S + holdS + lossD, and the KIRU gate wants
  //     KIRU_CLEAR_S beyond THAT.
  // Both are checked, against whichever deadlines the engine handed us. A null
  // deadline is "nothing to clear", not "zero".
  var ORDINARY_MAX_HOLD_S = 12;      // the 8 + r*4 draw's ceiling; the global spacing is still sized for THIS
  // FAIL SAFE WHEN THE ENGINE PASSES NO DEADLINES. seatScan (the 選局 button)
  // and any future caller that does not know the cycle's shape get the OLD
  // single-gap ceiling instead of a free pass: a hold may reach 40 s past t0,
  // which allows a whole thought up to 28.8 s and refuses the 32–40 s ones.
  // That is a real limit on the manual path and it is deliberate — a footprint
  // nobody has checked against a KIRU is exactly what caused this regression.
  // §14 (rc.57): the manual paths get the SAME deadlines the plan path is
  // handed, whenever there is a cycle to clear. Without this they fell to the
  // stopped-path fail-safe and could not seat the owner's 32–40 s thoughts on
  // air at all — the 選局 knob and the ♪ button being exactly where they would
  // want to hear them. When the station is STOPPED there is no cycle, no KIRU
  // and no neighbour, so the fail-safe stays: nothing to clear, nothing known.
  function withDeadlines(base, t0) {
    base.t0 = t0;
    try {
      var d = tl().bcDeadlines && tl().bcDeadlines(t0);
      if (d) { base.kiruT = d.kiruT; base.guestT = d.guestT; base.nextBcT = d.nextBcT; base.cycleEndT = d.cycleEndT; base.armLeadS = d.armLeadS; }
    } catch (e) {}
    return base;
  }
  function noContract(info) { return !info || (info.cycleEndT == null && info.nextBcT == null && info.kiruT == null); }
  // A reception's SPAN is the quantity the room has to hold — t0 to the cut —
  // and since §14 it has been the only thing fitsRoom needed. It used to be
  // handed the hold and the loss and add TUNE_S itself, which was correct while
  // every reception was tune + hold + loss and wrong the moment one of them
  // could carry an entry, a gap or a lingering exit. Callers that still think
  // in holds go through fitsHold.
  // A HOLD, TURNED INTO A SPAN. The entry, the gaps and the exit are the
  // reception's too, so "does this hold fit" is only answerable with the shape
  // beside it. Callers that have no shape get today's tune + hold + loss.
  function fitsHold(info, holdS, lossD, sh) {
    var extra = 0, i;
    if (sh) { for (i = 0; i < sh.gaps.length; i++) extra += sh.gaps[i] + (sh.lockS || 0);
              for (i = 0; i < sh.holes.length; i++) extra += sh.holes[i];
              return fitsRoom(info, sh.entryS + holdS + extra + sh.exitS); }
    return fitsRoom(info, TUNE_S + holdS + lossD);
  }
  function fitsRoom(info, spanS) {
    if (!info) return true;
    // THE BENCH'S "PLAY NOW", and the ONLY thing that can set this is
    // _dev.seatWindowNow on reel-lab.php. It says: the owner pressed a button
    // and wants to hear this thought in two seconds, so do not look for a legal
    // position — there isn't time. A bench-now signal may overlap a guest or
    // run into the kyū, and the page says so above the buttons. Nothing on the
    // production path sets benchNow, so the seating rules are untouched by it.
    if (info.benchNow) return true;
    var t0 = info.t0; if (t0 == null) return true;
    if (noContract(info)) {
      return spanS + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S) <= 40;
    }
    var sigEnd = t0 + spanS;
    var holdEnd = sigEnd + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S);
    if (info.kiruT != null && info.kiruT > t0 && sigEnd + KIRU_CLEAR_S > info.kiruT) return false;
    // §4.2 — the next reception's ARM used to clear this one's hold, so a hold
    // that reached within its arm lead was a hold that would VANISH. Holds are
    // per reception now, so what is left is the plain thing: two receptions
    // must not be on the air at once. The placement already drew 15–90 s of
    // quiet between them; this is the receiver refusing to overrun it.
    if (info.nextBcT != null && sigEnd + (COLLAPSE_S + BURST_S + DEAD_S) > info.nextBcT - STATIC_LEAD_S) return false;
    if (info.guestT != null && info.guestT > t0 && holdEnd > info.guestT) return false;
    if (info.cycleEndT != null && holdEnd > info.cycleEndT) return false;
    return true;
  }

  // ---- the choice (arm time): six draws, always ----
  // §4.1: the SHAPE arrived with the seating — the budget, the entry, the exit,
  // the gaps and the holes, all drawn 55 s ago when the room for them was
  // reserved. What is drawn here is everything that depends on the REEL, and
  // the six draws below are the same six, in the same order, they have always
  // been: a night with no shape (a manual path, an old caller) still gets
  // today's 8–12 s clip from rHold.
  function choose(R, cycle, tidePos, info) {
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next(), rBell = R.next();
    var holdS = 8 + rHold * 4, lossD = LOSS_MIN_S + rLoss * LOSS_SPAN_S, bell = rBell < 0.25;
    var sh = (info && info.shape) || null;
    var entryS = sh ? sh.entryS : TUNE_S;
    var exitS  = sh ? sh.exitS  : lossD;
    var holeS = 0, gapS = 0, gi0;
    if (sh) { for (gi0 = 0; gi0 < sh.holes.length; gi0++) holeS += sh.holes[gi0];
              for (gi0 = 0; gi0 < sh.gaps.length; gi0++) gapS += sh.gaps[gi0] + (sh.lockS || 0); }
    var budgetS = sh ? sh.budgetS : holdS;             // what was ASKED for
    var askedS = budgetS;
    var c = { reel: null, win: null, inS: 0, holdS: holdS, lossD: lossD, bell: bell, budgetS: askedS, shape: sh };
    if (!pool || !pool.length) return c;
    var skip = recentIds(cycle), cands = [];
    for (var i = 0; i < pool.length; i++) if (!skip[pool[i].id]) cands.push(pool[i]);
    if (!cands.length) cands = pool;
    var dark = tidePos, w = [], tot = 0;
    for (i = 0; i < cands.length; i++) {
      var e = cands[i], x = +e.weight > 0 ? +e.weight : 1, tone = e.tone;
      if (!e.audioOnly) x *= VIDEO_WEIGHT;                                                        // §8.1: a reel with a picture is three times as likely to be the one
      if (TONE_DARK[tone]) x *= 0.7 + 0.6 * dark;                                                // the dark tide leans to voices, noise, tones and drones
      else if (TONE_LIGHT[tone]) x *= 0.7 + 0.6 * (1 - dark);                                     // the light tide to music and singing
      w.push(x); tot += x;
    }
    // §2 THE FLOOR IS 8 SECONDS ON AIR, and 28 reels of 208 cannot serve it:
    // their longest window is 8–10.5 s, which after the entry and the exit
    // leaves under seven seconds of signal. A reel that cannot hold a reception
    // is not a candidate for one — it stays in the pool for the ♪ audition and
    // for the day its windows are re-cut (§5). The test is on the LONGEST window
    // and costs no draw; if it ever empties the candidate set (a one-reel bench
    // pool) the floor yields rather than the night going silent.
    var need0 = entryS + BUDGET_MIN_S + holeS + exitS, served = [];
    for (i = 0; i < cands.length; i++) { if (wholeAt(cands[i], 0) || longestWindow(cands[i]) >= need0) served.push(cands[i]); }
    if (served.length && served.length < cands.length) {
      var w2 = [], t2 = 0;
      for (i = 0; i < served.length; i++) { var si = cands.indexOf(served[i]); w2.push(w[si]); t2 += w[si]; }
      cands = served; w = w2; tot = t2;
    }
    var r = rReel * tot, reel = cands[cands.length - 1], reelIdx = cands.length - 1;
    for (i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { reel = cands[i]; reelIdx = i; break; } }
    // THE BENCH'S FORCED CHOICE, ahead of the pin and the lottery. Same rule:
    // rReel is already spent, so this costs no randomness.
    if (benchForce) {
      for (var bfi = 0; bfi < cands.length; bfi++) if (cands[bfi].id === benchForce.reelId) { reel = cands[bfi]; reelIdx = bfi; break; }
      if (reel.id !== benchForce.reelId) { for (var bpi = 0; bpi < pool.length; bpi++) if (pool[bpi].id === benchForce.reelId) { reel = pool[bpi]; reelIdx = 0; break; } }
      c.bench = true;
    }
    // THE PIN, applied after the weighting and before anything reads `reel`:
    // rReel is already spent, so this costs no randomness and moves no stream.
    var pinR = pinUsed ? null : pinnedReel();
    if (pinR) { reel = pinR; c.pinned = true; for (i = 0; i < cands.length; i++) if (cands[i] === pinR) { reelIdx = i; break; } }
    // §11.2 TUNED SIGNALS. The drawn window is still DRAWN — rWin is consumed
    // above whatever happens here, so the signal stream never moves — but on a
    // reel that holds a pitch the receiver prefers the window it can land on
    // the field with, and bends it there tape-style.
    //
    // windows stay [start, end] ARRAYS. pitchHz is a PARALLEL array, index for
    // index, because five call sites index a window positionally and a
    // half-converted window would read win[0] as undefined and put NaN into
    // inS — the same shape as the fault that cost the crew a phase.
    var wi = Math.floor(rWin * reel.windows.length);
    var tune = farTune(reel, wi);
    if (tune.wi !== wi) wi = tune.wi;
    // §2 THE WINDOW MUST BE ABLE TO HOLD THE RECEPTION. rWin is spent above
    // whatever happens here — the stream never moves — but a budget of 30 s
    // seated on a 12 s window is 12 s of signal and 18 s of nothing, and the
    // owner asked for the spread, not for a number in a log line. So: the drawn
    // window if it serves the budget; else, walking from the drawn index, the
    // FIRST that does; else the longest this reel has. Deterministic, no draws.
    // A whole reel is exempt — §14 decides its window on the thought, and a
    // thought is never sliced to fit a budget.
    if (!wholeAt(reel, wi)) {
      var needW = entryS + budgetS + holeS + exitS, wiBest = wi, wiLong = wi, wl0 = -1, wq, wjj, lq;
      for (wq = 0; wq < reel.windows.length; wq++) {
        wjj = (wi + wq) % reel.windows.length;
        if (wholeAt(reel, wjj)) continue;
        lq = reel.windows[wjj][1] - reel.windows[wjj][0];
        if (lq > wl0) { wl0 = lq; wiLong = wjj; }
        if (lq >= needW && wiBest === wi && (reel.windows[wi][1] - reel.windows[wi][0]) < needW) { wiBest = wjj; }
      }
      if ((reel.windows[wi][1] - reel.windows[wi][0]) < needW) wi = (wiBest !== wi) ? wiBest : wiLong;
    }
    // §14 WINDOW SELECTION, now against the ROOM and not just the ceiling.
    // Order, and it is the orchestrator's: the drawn window if it fits; else
    // the LONGEST whole window that fits (a shorter thought rather than a
    // shorter reach); else another reel — NEVER a slice of a whole window.
    // Deterministic from the drawn index, NO new draws.
    if (benchForce && reel.id === benchForce.reelId) {
      if (benchForce.wi >= 0 && benchForce.wi < reel.windows.length) wi = benchForce.wi;
      benchWholeOverride = benchForce.whole;   // false = "slice instead", for the owner's A/B
    } else benchWholeOverride = null;
    var whole = benchWholeOverride == null ? wholeAt(reel, wi) : !!benchWholeOverride;
    if (whole) {
      var okHere = wholeFits(reel, wi) && fitsHold(info, Math.min(reel.windows[wi][1] - reel.windows[wi][0], WHOLE_MAX_HOLD_S), lossD, sh);
      if (!okHere) {
        var best = -1, bestL = -1, ww, wj2, l2;
        for (ww = 0; ww < reel.windows.length; ww++) {
          wj2 = (wi + ww) % reel.windows.length;
          if (!wholeAt(reel, wj2) || !wholeFits(reel, wj2)) continue;
          l2 = reel.windows[wj2][1] - reel.windows[wj2][0];
          if (fitsHold(info, Math.min(l2, WHOLE_MAX_HOLD_S), lossD, sh) && l2 > bestL) { bestL = l2; best = wj2; }
        }
        if (best >= 0) wi = best;
        else {
          // NOTHING OF THIS REEL FITS HERE. Take the next candidate reel that
          // can be seated at all — a whole reel whose thoughts all overrun, or
          // an ordinary reel, whichever comes first walking from the drawn
          // index. The alternative would be a mid-sentence slice, which is the
          // one thing §14 exists to prevent.
          var swapped = false;
          for (var ci = 1; ci < cands.length && !swapped; ci++) {
            var cand = cands[(reelIdx + ci) % cands.length];
            if (!cand || !cand.windows || !cand.windows.length) continue;
            for (var cw = 0; cw < cand.windows.length; cw++) {
              var cl = cand.windows[cw][1] - cand.windows[cw][0];
              var chold = wholeAt(cand, cw) ? Math.min(cl, WHOLE_MAX_HOLD_S) : Math.min(budgetS, Math.max(3, cl - entryS - holeS - exitS));
              if (fitsHold(info, chold, lossD, sh)) { reel = cand; wi = cw; swapped = true; break; }
            }
          }
          // AND IF NOTHING FITS, REFUSE. Falling through would seat the
          // over-long window anyway — which is exactly what it did on a
          // one-reel pool, where the swap loop has nothing to walk to, and is
          // how a 32.4 s thought ran straight through the KIRU at 641 s on
          // seed 34. A position that cannot hold a whole thought is not a
          // position for this reel; the caller falls back to the gagaku, which
          // is the graceful path that already exists.
          if (!swapped) { c.unfit = true; c.reel = null; return c; }
        }
        whole = wholeAt(reel, wi);
      }
    }
    var win = reel.windows[wi], wl = win[1] - win[0];
    // THE HOLD IS DECIDED ON THE UNBENT WINDOW, DELIBERATELY. At rate r a
    // window of wl source seconds lasts wl / r on the wall clock, so the
    // "honest" test is need > wl / r — and it moves holdS by a tenth of a
    // second on a bent reel, which moves the air hold, which denies a melodic
    // claim that was granted before, which moves the note stream on a HOME
    // night. Measured: seeds 3042 and 7 both changed their note counts, and
    // §11.2 is the default path so it fires at home. Byte-identity is worth
    // more than a tenth of a second of hold, so the decision stays on wl and
    // the rate is spent on the in-point instead.
    // §2 THE BUDGET, AND WHAT THE POOL CAN ACTUALLY SERVE. The budget was drawn
    // from the owner's table 55 s ago; this window may not be able to hold it,
    // and until the reels are re-cut (§5) it usually cannot — 1 164 of the
    // pool's 1 349 windows are 12 s, which after an entry and an exit serves
    // about 8.8 s of signal. DEGRADE, NEVER REFUSE: the budget shrinks to the
    // longest this window can carry and the harness reports ASKED against
    // ACHIEVED, so the gap between the owner's table and the pool is a number
    // and not an impression. It closes as the long windows arrive.
    holdS = budgetS;
    var need = entryS + holdS + holeS + exitS;
    if (whole) {
      // The thought sets the hold, not the budget. rHold and rIn are still
      // CONSUMED above — six draws, always — so a whole reel entering the pool
      // moves no other night's stream.
      holdS = Math.min(wl, WHOLE_MAX_HOLD_S);
      need = entryS + holdS + holeS + exitS;
    } else if (need > wl) { holdS = Math.max(3, wl - entryS - holeS - exitS); need = entryS + holdS + holeS + exitS; }
    c.reel = reel; c.win = win; c.holdS = holdS; c.whole = whole; c.degraded = +(askedS - holdS).toFixed(3);
    // The in-point does carry the rate: `need` wall seconds eat need × r
    // SOURCE seconds, so a sped-up reel starts nearer the window's head. When
    // need × r exceeds the window the in-point pins to the head and the last
    // fraction of a second runs past the edge — inside the loss ramp, where
    // the signal is already under 6 % of peak.
    // From the window's START on a whole reel — there is no slice to place.
    c.inS = whole ? win[0] : win[0] + rIn * Math.max(0, wl - need * tune.rate);
    c.entryS = entryS; c.exitS = exitS;
    c.rate = tune.rate; c.pitchHz = tune.pitchHz; c.degHz = tune.degHz; c.cents = tune.cents;
    // THE RECEPTION PLAN. At R0 it is today's clip said in the new grammar —
    // one piece, a snap in, a cut out — and everything downstream reads it
    // instead of the three loose numbers. The shapes of §3 fill it in later
    // without a second code path anywhere.
    c.rx = planFor(sh, reel, c.inS, holdS, exitS);
    c.rx.budgetS = askedS;
    c.lossD = c.rx.exitS;
    return c;
  }

  // ---- §11 the bend ---------------------------------------------------------
  // Given a reel and the window the draw landed on, decide which window is
  // actually seated and at what playback rate.
  //
  // THE CAP IS A REFUSAL, NOT A CLAMP. Past ±4 semitones the reel plays at
  // rate EXACTLY 1 and unbent — clamping would leave it still bent and still
  // wrong, which is worse than not trying: a reel a fifth away from the field
  // dragged four semitones toward it is out of tune with both.
  // THE CAP IS INSURANCE AGAINST A CHANGE TO THE DEGREE SET, NOT AGAINST THE
  // REELS, and it is unreachable as the code stands. Two degrees a fifth apart
  // divide the octave into a 700-cent gap and a 500-cent one, so the furthest
  // any pitch can sit from the NEARER of them — octave-free, as the search
  // below computes it — is half the larger gap: 350 cents, tonic-independent.
  // 350 < 400, so the refusal below has never executed and cannot. The largest
  // bend the pool actually needs is 244.3 cents.
  //
  // Do NOT delete it on the strength of "it never fires". The 350-cent bound is
  // a property of the DEGREE SET on the line above and of nothing here: narrow
  // the field to the tonic alone and the worst case jumps to 600 cents, the cap
  // starts binding, and this becomes live code that has never once run. (The
  // warped fifth keeps the bound too — at 690.4 to 716.8 cents the worst case
  // is 345.2 to 358.4.) The comment is the protection, not the code.
  var TUNE_CAP_CENTS = 400;
  function farTune(reel, wi) {
    var flat = { wi: wi, rate: 1, pitchHz: null, degHz: 0, cents: 0 };
    var T = tl();
    if (!reel || !reel.tuned || !reel.pitchHz || !T.fieldTonic) return flat;
    var tonic = T.fieldTonic(); if (!(tonic > 0)) return flat;
    // the degrees a signal may land on: the tonic and its fifth (§11.2)
    // The degrees a signal may land on: the tonic and its fifth AS THE STATION
    // IS SOUNDING THEM TONIGHT. Under 撓 the fifth is 700·k cents rather than
    // 700, up to 16.8 cents from tempered, which is 1.7× the gate this feature
    // is held to; the tonic is unaffected for any k. Falls back to the
    // tempered fifth if the engine is too old to answer.
    var degs = [tonic, (T.degreeHz ? T.degreeHz(700) : tonic * 1.4983070768766815)];
    var best = null;
    for (var i = 0; i < reel.pitchHz.length && i < reel.windows.length; i++) {
      var p = reel.pitchHz[i]; if (!(p > 0)) continue;
      for (var k = 0; k < degs.length; k++) {
        // octave-free: a 587 Hz tone may land on the tonic three octaves down
        var c = 1200 * Math.log(degs[k] / p) / Math.LN2;
        c = c - 1200 * Math.round(c / 1200);
        if (!best || Math.abs(c) < Math.abs(best.cents)) best = { wi: i, cents: c, pitchHz: p, degHz: degs[k] };
      }
    }
    if (!best) return flat;
    if (Math.abs(best.cents) > TUNE_CAP_CENTS) { flat.pitchHz = best.pitchHz; return flat; }
    // §11.3's decision is NOT made here. It lives at the one site that acts on
    // it, in the graph build, where the night and the reel's tag are both to
    // hand. A `sea` flag here was computed, never copied by arm() and never
    // read by anything — dead, and worse than absent, because the day someone
    // simplifies that site to read it, it is undefined, the branch goes falsy
    // and §11.3 stops firing in silence. (The critic's static field-contract
    // check found it on rc.23; it is the precondition for a fourth instance of
    // a fault we have now had three times.)
    return { wi: best.wi, rate: Math.pow(2, best.cents / 1200), pitchHz: best.pitchHz,
             degHz: best.degHz, cents: best.cents };
  }
  // the dropout schedule (relative to t0) and the voices' return offsets, on the cycle's own fork
  // The dropout schedule now runs across the PLAN'S WHOLE SPAN rather than
  // across "the tune-in, the hold and the loss": an entry that hunts for eight
  // seconds and an exit that lingers for twelve are both weather, and a
  // schedule that stopped at a fixed 0.4 + hold would have left them dry. The
  // draws are unchanged — two per step, taken whether or not the step is kept —
  // so a one-piece reception gets exactly the schedule it always got, and a
  // drop that would fall inside a carrier-lost gap is simply not kept (there is
  // no signal there to drop out).
  function weather(R, cycle, P) {
    var D = R.fork("signal:" + cycle), drops = [], t = P.entryS + 0.6, end = P.spanS;
    var lossAt = P.lossAtS, exitS = P.exitS;
    while (true) {
      var k = (exitS > 0 && t >= lossAt) ? Math.min(1, (t - lossAt) / exitS) : 0;
      t += (1.2 + D.next() * 3.3) * (1 - 0.8 * k);
      if (t >= end - 0.1) break;
      var d = 0.12 + D.next() * 0.25;
      if (!inGap(P, t)) drops.push([t, d]);
    }
    var rel = { shakuhachi: 0, koto: REL_MIN_S + D.next() * REL_SPAN_S, shamisen: REL_MIN_S + D.next() * REL_SPAN_S, hichiriki: REL_MIN_S + D.next() * REL_SPAN_S, biwa: REL_MIN_S + D.next() * REL_SPAN_S,
      vox: REL_MIN_S + REL_SPAN_S };   // 内線 (2026-09-14): the intercom is the LAST to speak again after a signal — the full span, no draw, so the reel's own draws stay where they were
    return { drops: drops, rel: rel, lfoHz: 0.4 + D.next() * 2.6, seed: D.next() * 1000 };
  }

  // ---- the state ----
  // THE RECEIVER KEEPS A QUEUE (§4.2). It used to have one armed slot, which
  // is the second reason two receptions had to sit 95 s apart: a broadcast
  // arming 55 s before its t0 would overwrite the one still on the air. Now
  // each armed reception is its own entry, owns its own media element and its
  // own air hold, and lives from arm to teardown. `armed` is the HEAD of that
  // queue — the next one to fire — kept as a name because a dozen readers ask
  // "what is coming".
  var armedQ = [];    // the armed receptions, in the order they will fire
  var armed = null;   // armedQ[0]: the next to fire (or the one on the air)
  var live = null;    // the nodes of the signal in progress
  var stats = { armed: 0, fired: 0, signals: 0, fallbacks: 0, scans: 0, lastReason: "", refusedBudget: 0 };
  var rxSeq = 0;      // one id per reception, for its own air hold
  function qHead() { armed = armedQ.length ? armedQ[0] : null; return armed; }
  function qDrop(a) { var i = armedQ.indexOf(a); if (i >= 0) armedQ.splice(i, 1); qHead(); }
  function qClear() { armedQ.length = 0; armed = null; }
  // "is a reception up" — on the air, or fired and counting down to it. With a
  // queue this is no longer the same question as "is anything armed": one may
  // be armed 55 s out while nothing at all is sounding.
  function rxUp() { if (live) return true; for (var i = 0; i < armedQ.length; i++) if (armedQ[i].t0 != null) return true; return false; }
  // SHRINK A RECEPTION INTO THE ROOM IT HAS. The manual paths (the dial, the
  // bench) can be handed less room than the plan asked for, and the honest
  // answer is a shorter reception rather than a refused one: the last piece
  // gives up seconds first, then the one before it, down to the §2 floor and
  // then below it if the room truly is that small. Degrade, never refuse.
  function rxShrinkTo(a, room) {
    var P = a.rx; if (!P) return;
    var over = P.spanS - room; if (over <= 0) return;
    for (var i = P.segments.length - 1; i >= 0 && over > 0; i--) {
      var give = Math.min(over, Math.max(0, P.segments[i].onS - (i === 0 ? 3 : 2)));
      P.segments[i].onS -= give; over -= give;
    }
    if (over > 0 && P.exitS > 0.5) { var g2 = Math.min(over, P.exitS - 0.5); P.exitS -= g2; over -= g2; }
    planTimes(P);
    a.holdS = P.presenceS; a.lossD = P.exitS;
  }

  function arm(info, rng) {
    var T = tl(); if (!T.S) return false;
    var R = rng || T.S.signal; if (!R) return false;
    loadPool();
    var c = choose(R, info.cycle, info.tidePos || 0, info);
    var wx = weather(R, info.cycle, c.rx || planOne(null, 0, c.holdS, c.lossD));
    // THE DRAWS ARE ABOVE THIS LINE, deliberately: weather() must take its
    // stream whether or not the position turns out to be unusable, or a
    // refusal here would shift every later signal on the night.
    if (c.unfit) { stats.lastReason = "no reel fits this position (footprint)"; return false; }
    if (c.rx) c.rx.budgetS = c.budgetS;
    // §11's four fields ride here too, and the reason they are called out is
    // that this literal is EXACTLY the shape that cost the crew a phase: a
    // fresh object built field by field from a contract declared somewhere
    // else, which silently drops whatever the author forgot. It dropped them
    // on the first pass — 同調 never fired once and the harness output was
    // byte-identical to the old build, which reads like a pass. Anything
    // choose() adds must be added here in the same commit.
    var a = { cycle: info.cycle, kind: info.kind, hostStartT: info.hostStartT, hostDurS: info.hostDurS, tidePos: info.tidePos || 0,
      reel: c.reel, win: c.win, inS: c.inS, holdS: c.holdS, lossD: c.lossD, bell: c.bell, drops: wx.drops, rel: wx.rel, lfoHz: wx.lfoHz, seed: wx.seed,
      rate: c.rate || 1, pitchHz: c.pitchHz || 0, degHz: c.degHz || 0, cents: c.cents || 0, whole: !!c.whole, pinned: !!c.pinned,
      rx: c.rx || null, budgetS: c.budgetS || null,
      // EACH RECEPTION OWNS AN ELEMENT AND AN AIR HOLD, and both are named here
      // so nothing downstream has to guess which. The hold id is what replaces
      // the global airHoldClear(): a reception clears its OWN claim on a
      // fallback and lets it expire otherwise, so an arm can never drop the
      // hold out from under the broadcast that is on the air.
      vidx: (elemTurn++) % ELEMS, holdId: "signal:" + info.cycle + ":" + (++rxSeq),
      ready: false, t0: null, decided: false, dead: false };   // (`bench: !!rng` lived here, written and never read — the critic's fourth dead field; deleted rather than carried)
    armedQ.push(a); qHead();
    stats.armed++;
    // W4 §12 — THE PLANNED HOLD. The defect this repairs: the long-note bodies
    // commit notes 33–46 s ahead of the audio clock, and the real hold was only
    // written at fire(), ~15.5 s before t0. The claim was legitimate when it
    // was made and no render-time guard could have caught it — measured with
    // the engine printing its own state: `NOTE hichiriki t=322.13 dur=8.54
    // ctxNow=275.68 holds=[] signalUp=false`.
    //
    // So the receiver declares its INTENT as soon as it has one. It does not
    // know t0 yet — the visitation fires at hostStartT + rnd(8, 25), drawn at
    // the scene boundary — so the planned window covers the whole of that
    // uncertainty, about 46 s against the real 21 s. That over-denial for the
    // arm→fire gap is the price, and it is what the deliberate re-base buys.
    //
    // It is a separate owner from the real hold, which matters twice over:
    // fire() replaces it exactly rather than leaving two overlapping claims,
    // and signalUp() ignores it — a PLAN must not silence 崩's groove or
    // trigger §11.3, because a plan can still fall back to the gagaku and then
    // nothing was ever on the air.
    // NO GLOBAL CLEAR (§4.2). This line used to read `T.airHoldClear()` — every
    // hold any signal had ever written, dropped the moment the next one armed.
    // That single call is why a broadcast owned exactly BC_GAP_S −
    // BC_ARM_LEAD_S = 40 s past its t0, why the spacing had to be 95 s, and why
    // WHOLE_MAX_HOLD_S had a ceiling written in another file. Each reception
    // writes under its own id now and clears only that id, on a fallback; an
    // ordinary one simply expires, which is what a time-based hold does.
    // THE PLANNED HOLD IS NOW THE REAL HOLD. t0 arrives WITH the arm — every
    // broadcast's time is drawn at plan now — so there is nothing left to be
    // uncertain about and nothing to over-deny: 18.0 to 29.2 s where it was
    // 41.0 to 46.2, and the difference was never air a broadcast used. The
    // WRITE stays at arm, which is what catches the long-note bodies that
    // commit 33 to 46 s ahead (plan §12): narrowing the window is safe,
    // moving the write would put that defect straight back.
    //
    // Two things that had to agree have become one thing, which matters more
    // than the seconds do.
    var t0k = (info.t0 != null) ? info.t0 : (info.hostStartT + 16);
    var pFrom = t0k - HOLD_LEAD_S;
    var pUntil = t0k + (c.rx ? c.rx.spanS : TUNE_S + c.holdS + c.lossD) + 2;
    // THE PLAN'S LANES ARE DERIVED FROM THE SAME OBJECT THE REAL HOLD USES,
    // never from a second list. fire() builds its hold by looping over a.rel
    // and bolting on the PA; if the plan looped over a constant instead, the
    // two would agree only by inspection — and the day a sixth melodic body
    // joins `rel` (this crew has added TWO in this program, the hichiriki and
    // the biwa) that voice would get the real hold and not the planned one.
    // That is exactly the pre-W4 defect, reintroduced for one voice, invisible
    // on every seed where it does not happen to sing over a broadcast. Derived
    // here, the two lists cannot drift: anything added to weather()'s `rel` is
    // held both at arm and at fire, in the same commit, without anyone
    // remembering to.
    var plan = {}, pk = Object.keys(wx.rel);
    for (var pv = 0; pv < pk.length; pv++) plan[pk[pv]] = { from: pFrom, until: pUntil + wx.rel[pk[pv]] };
    plan.pa = { from: pFrom, until: pUntil };                 // the PA is held too, and for the same reason fire() holds it
    // Written as the SIGNAL'S hold, not as a "plan" — because it is not a plan
    // any more, it is the exact window. That also makes signalUp() see it,
    // which is what lets 崩, 鏡 and the melodic bodies yield to a broadcast
    // that has not aired yet: signalUp asks about a TIME, so a note scheduled
    // 40 s early and landing inside the window is refused now rather than
    // after the fact.
    T.airHold(plan, a.holdId);
    a.wantT0 = (info.t0 != null) ? info.t0 : null;
    var when = Math.max(T.ctx ? T.ctx.currentTime + 0.05 : 0, info.hostStartT - PREFETCH_LEAD_S);
    T.lane("broadcast").at(when, function () { prefetch(a); });
    return a;
  }
  // 経路 buffer mode: which decoded buffer a piece plays from. 走 puts two
  // different reels in one reception, so this is a lookup by id rather than
  // the single `a.buf` it used to be.
  function bufFor(a, reel) {
    var id = (reel && reel.id) || (a.reel && a.reel.id);
    if (a.bufs && a.bufs[id]) return a.bufs[id];
    return a.buf || null;
  }
  function prefetch(a) {
    if (!a) a = armed;
    if (!a || !a.reel) return;
    var ix = a.vidx || 0, v = ensureVideo(ix); if (!v) return;
    var url = reelUrl(a.reel);
    // 経路 buffer mode: the AUDIO's readiness is the decode, not the seek. The
    // picture below still loads and seeks exactly as it always did — but it is
    // decoration now, and a picture that stalls must not deny the signal.
    if (reelsBuffered()) {
      a.buf = null; a.bufErr = null;
      a.bufs = {};
      decodeReel(a.reel.id, tl().ctx).then(function (b) { if (!a.dead) { a.buf = b; a.bufs[a.reel.id] = b; a.ready = true; } },
                                          function (e) { if (!a.dead) a.bufErr = String((e && e.message) || e); });
      // 走 the scan crosses to a SECOND reel inside one reception, so its
      // buffer has to be there too — decoded on the same lead, never fetched
      // mid-signal.
      var r2 = a.rx && a.rx.reel2;
      if (r2 && r2.id !== a.reel.id) decodeReel(r2.id, tl().ctx).then(function (b2) { if (!a.dead) a.bufs[r2.id] = b2; }, function () {});
    }
    function seekIn() {
      try {
        var once = function () { try { v.removeEventListener("seeked", once); } catch (e) {} if (!a.dead) a.ready = true; warmPicture(v); };
        v.addEventListener("seeked", once, { once: true });
        v.currentTime = a.inS;
      } catch (e) {}
    }
    try {
      if (videoSrcIds[ix] !== a.reel.id) {
        videoSrcIds[ix] = a.reel.id; v.src = url; v.preload = "auto";
        var onCan = function () { try { v.removeEventListener("canplay", onCan); } catch (e) {} seekIn(); };
        v.addEventListener("canplay", onCan, { once: true });
        v.load();
      } else if (v.readyState >= 3) seekIn();
      else { var onCan2 = function () { try { v.removeEventListener("canplay", onCan2); } catch (e) {} seekIn(); }; v.addEventListener("canplay", onCan2, { once: true }); }
    } catch (e) {}
  }
  // WHICH reception is this t0? The queue may hold two, so the caller's time is
  // matched against the t0 each was armed with rather than assumed to be the
  // head's. An unmatched call takes the earliest unfired — the manual paths
  // (選局, the bench) arm and fire in the same breath.
  function armedFor(t0) {
    var best = null, i;
    for (i = 0; i < armedQ.length; i++) { var q = armedQ[i];
      if (q.t0 != null) continue;
      if (q.wantT0 != null && Math.abs(q.wantT0 - t0) < 0.5) return q;
      if (!best || (q.wantT0 != null && best.wantT0 != null && q.wantT0 < best.wantT0)) best = q;
    }
    return best;
  }
  function fire(t0) {
    var a = armedFor(t0); if (!a || a.t0 != null) return false;
    var T = tl(); if (!T.ctx || !T.playing()) return false;
    a.t0 = t0; stats.fired++;
    var cut = t0 + (a.rx ? a.rx.spanS : TUNE_S + a.holdS + a.lossD);
    // the hold is time-based, so it is set now and applies to claims from t0 − 6
    var hold = {}, from = t0 - HOLD_LEAD_S;
    for (var vname in a.rel) hold[vname] = { from: from, until: cut + 2 + a.rel[vname] };
    // The PA was never held — `rel` covers the five melodic voices and the
    // engine's own gate counts the tannoy too, so a kakegoe could land inside a
    // signal. It comes back with the shakuhachi, first of the crew to speak
    // again. (No new draw: it borrows the shakuhachi's zero offset rather than
    // taking one of its own, so the signal stream is untouched.)
    hold.pa = { from: from, until: cut + 2 };
    // NOT WRITTEN AGAIN HERE. arm() already wrote this exact window, 55 s ago,
    // from the same t0 and the same wx.rel — writing it a second time would
    // restore precisely the two-things-that-must-agree shape this change
    // removed, and the second copy would be the one nobody updated. `hold` is
    // still built above because the descriptor below reads its span.
    if (a.wantT0 == null) T.airHold(hold, a.holdId);    // only if this signal never went through a t0-bearing arm
    // 即 the snap rises 4 s of static before t0; 探 the hunt and 浮 the
    // drift-in ARE the arrival and bring their own noise, so the dial does not
    // also turn in front of them.
    if (!a.rx || a.rx.entry === "soku") T.lane("broadcast").at(t0 - STATIC_LEAD_S, function (t) { staticRise(t, t0); });
    T.lane("broadcast").at(t0 - DECIDE_LEAD_S, function () { decide(a, t0); });
    return true;
  }
  function decide(a, t0) {
    var T = tl(); if (!a || a.decided || !T.playing()) return;
    a.decided = true;
    var v = videos[a.vidx || 0], ms = ensureMediaSource(T.ctx, a.vidx || 0), reason = null;
    if (poolState !== "ready") reason = "pool " + poolState + (poolError ? " (" + poolError + ")" : "");
    else if (!a.reel) reason = "no reel drawn";
    else if (!v) reason = "no media element";
    // 経路: in buffer mode the reel's readiness is its DECODE. The element is
    // still required — it carries the picture — but its audio is not asked
    // about, because it does not have any.
    else if (reelsBuffered()) { if (!a.buf) reason = a.bufErr ? ("reel decode failed · " + a.reel.id + " · " + a.bufErr) : ("reel not decoded · " + a.reel.id); }
    else if (!ms) reason = "no media element";
    if (!reason && !a.ready) reason = "reel not ready · " + a.reel.id;
    if (reason) {
      stats.fallbacks++; stats.lastReason = reason;
      T.airHoldClear(a.holdId);   // ONLY this reception's claim — another may be armed behind it
      T.emitEvent({ cat: "rx", label: "受信 fallback", detail: reason }, t0);
      a.dead = true; qDrop(a);
      try { T.fallback(t0); } catch (e) {}
      return;
    }
    startSignal(a, t0);
  }

  // ---- the static rises: the dial turning (t0 − 4 … t0) ----
  function staticRise(t, t0) {
    var T = tl(), c = T.ctx; if (!c || !T.playing()) return;
    try {
      var nz = T.noiseSource(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = "bandpass"; bp.Q.setValueAtTime(3, t);
      bp.frequency.setValueAtTime(600, t); bp.frequency.exponentialRampToValueAtTime(2400, t0 - 0.3); bp.frequency.exponentialRampToValueAtTime(1200, t0 + 0.4);
      nz.connect(bp); bp.connect(g); g.connect(T.lg("broadcast"));
      PJ.Voice.env(g.gain, t, [[1.2, 0.045], [1.8, 0.03], [0.6, 0.018], [0.5, 0]]);
      nz.start(t, 0); nz.stop(t0 + 0.6);
    } catch (e) {}
  }

  // ==========================================================================
  // 掃引 THE TUNING DIAL (plan §7)
  // ==========================================================================
  // Fidgeting is what makes it work. Every bit of rotation raises a band of
  // receiver noise whose centre wanders with the hand — the sound of sweeping
  // a dial past nothing — and once about a turn and a half has gone by within
  // a few seconds, a real reel locks in AT ONCE. Not at the next legal moment:
  // that is 選局's manners, and the whole point of the dial is that it does not
  // wait. It is rate-limited to one lock in 30 s; past that, fidgeting is
  // snow and hiss, which is the honest thing for a receiver to do.
  //
  // The noise is scheduled one short burst per gesture-tick rather than held
  // open, so it costs nothing when nobody is touching it, and it cannot leak a
  // running oscillator if the page is closed mid-turn.
  var dialLast = -1e9;                                       // audio time of the last lock
  var dialCold = 0;                                          // the drawn cooldown for the press just made
  var dialPresses = 0;
  var dialNoiseUntil = -1e9;
  // §8.2: 45–60 s, drawn with SEEDED jitter — the same seed gives the same
  // cooldowns, so a press schedule is reproducible like everything else here.
  function dialDrawCold() {
    var T = tl(), R = (T.S && T.S.signal) ? T.S.signal.fork("button:" + dialPresses) : PJ.Rand.stream(dialPresses + 1);
    return 45 + R.next() * 15;
  }
  // Is the button ready? The lens reads this every frame.
  function dialReady() {
    var T = tl(), c = T.ctx;
    if (!c) return true;                                     // nothing has happened yet
    return (c.currentTime - dialLast) >= dialCold;
  }
  function dialNoise(amt) {
    var T = tl(), c = T.ctx; if (!c) return;
    var t = c.currentTime + 0.02, durS = 0.16;
    if (t < dialNoiseUntil - 0.02) return;                   // one burst at a time: the hand is faster than the ear
    dialNoiseUntil = t + durS;
    try {
      var nz = T.noiseSource(), bp = c.createBiquadFilter(), g = c.createGain();
      bp.type = "bandpass"; bp.Q.setValueAtTime(4.5, t);
      // the band wanders with the motion: that is what a dial sounds like
      var f0 = 500 + 2600 * amt * (0.5 + 0.5 * Math.sin(t * 3.1));
      bp.frequency.setValueAtTime(Math.max(200, f0), t);
      bp.frequency.exponentialRampToValueAtTime(Math.max(200, f0 * (0.7 + 0.6 * amt)), t + durS);
      nz.connect(bp); bp.connect(g); g.connect(T.lg("broadcast"));
      var peak = 0.010 + 0.030 * amt;                        // well under the reel's own 0.35 peak
      PJ.Voice.env(g.gain, t, [[0.02, peak], [durS - 0.05, peak * 0.7], [0.03, 0]]);
      nz.start(t, Math.random() * 20); nz.stop(t + durS + 0.05);
    } catch (e) {}
  }
  // The dial asks for a lock. Returns "locked" | "snow" | "wait" — the caller
  // makes snow either way; this only says whether a reel came with it.
  // §8.2: the button's audition, while the station is stopped — a full window
  // as §7's addendum established, and a reel with a picture as §8.2 asks.
  function dialAudition(now) {
    for (var attempt = 0; attempt < 6; attempt++) {
      if (!sampleTune(now)) return false;
      if (!lastSampleAudioOnly) return true;
    }
    return true;
  }
  var lastSampleAudioOnly = false;
  function dialLock() {
    var T = tl(), c = T.ctx;
    if (!c) return "snow";
    var now = c.currentTime;
    if (now - dialLast < dialCold) return "wait";            // §8.2: cold for the drawn 45–60 s
    if (!T.playing()) {                                      // stopped: the audition, a full window
      if (!dialAudition(now)) return "snow";
      dialLast = now; dialPresses++; dialCold = dialDrawCold(); stats.dial = (stats.dial || 0) + 1;
      return "locked";
    }
    // A signal is up, OR one is ARMED AND WAITING — which is exactly how a
    // planned broadcast lives between plan time and its host scene. Locking in
    // that window replaces `armed`, and then the visitation's own fire()
    // refuses and the engine falls back to the synthesized Etenraku: the cycle
    // keeps a broadcast but silently loses the reel the plan drew. 選局 has
    // this guard; the dial did not. (Critic W1 r2, D1.)
    if (live || armed) return "snow";
    var sc = T.scene(), cy = T.cycle();
    if (!sc || sc.type === "kyu" || sc.type === "release" || sc.type === "oroshi") return "snow";   // the wall and the hush are not the dial's to interrupt
    // IMMEDIATELY, not at the next legal moment: t0 is now + the static lead,
    // and the window is trimmed to whatever room the scene has left.
    var t0 = now + STATIC_LEAD_S + 0.5;
    var room = (sc.startT + sc.durS - 3) - (t0 + TUNE_S + 2.8 + COLLAPSE_S + BURST_S);
    if (room < 4) return "snow";                             // no room before the scene turns
    var R = T.S.signal.fork("button:" + dialPresses + ":" + Math.max(0, cy.n));
    // §8.2, the owner's words: "a real reel WITH A PICTURE". The lottery is
    // already weighted 3× toward video by §8.1; a deliberate press asks for one
    // outright, so the button re-draws (up to a few times, deterministically)
    // until the choice carries a picture. If the pool holds nothing but
    // audio-only reels it takes what there is rather than refusing — the button
    // must always DO something.
    var got = false, da = null;
    for (var attempt = 0; attempt < 6; attempt++) {
      if (da) { da.dead = true; qDrop(da); try { tl().airHoldClear(da.holdId); } catch (e) {} }   // each retry is a whole reception; the ones not taken leave no claim behind
      da = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, t0), R.fork("try:" + attempt));
      if (!da) return "snow";
      if (!da.reel || !da.reel.audioOnly) { got = true; break; }
    }
    if (!got && !da) return "snow";
    if (da.rx && da.rx.spanS > room) rxShrinkTo(da, room);
    if (!fire(t0)) { da.dead = true; qDrop(da); return "snow"; }
    dialLast = now; dialPresses++; dialCold = dialDrawCold(); stats.dial = (stats.dial || 0) + 1;
    T.emitEvent({ cat: "rx", label: "受信 locked on", detail: "the set finds one · " + Math.round(t0 - now) + " s" }, now);
    return "locked";
  }

  // ---- 相 phasing, and 室 the reel as the room (W3) ----
  // Both read the night from the engine rather than keeping their own copy of
  // it: the receiver is a module, and which departures a night carries is the
  // engine's business.
  function farDep(id) {
    try { var f = Z.getFar && Z.getFar(); return (f && !f.home && f.dep && f.dep[id]) || null; } catch (e) { return null; }
  }
  function farPhaseTap(src, t0, cut, N) {
    var p = farDep("phase"); if (!p) return null;
    // N is the caller's node registrar: the comb has to be torn down with the
    // signal that made it. Without it the three nodes outlive every broadcast
    // and accumulate for the life of the page — silent, because `src` is
    // disconnected, but never collected. (Found in the browser, W3b; the
    // symbolic probe counts sources, not gains.)
    var T = tl(), c = T.ctx, sum = N(c.createGain()), dly = N(c.createDelay(1.5)), wet = N(c.createGain());
    var total = (p.driftMs / 1000) * p.passes;                 // where the two copies end up
    dly.delayTime.setValueAtTime(0.0005, t0);
    dly.delayTime.linearRampToValueAtTime(Math.min(1.4, total), cut);
    wet.gain.setValueAtTime(0.85, t0);                          // near-equal copies: the comb is deep
    src.connect(sum);                                           // the first loop
    src.connect(dly); dly.connect(wet); wet.connect(sum);       // the second, sliding behind it
    T.emitEvent({ cat: "far", label: "相 the loops drift", detail: p.passes.toFixed(0) + " passes · " + p.driftMs.toFixed(0) + " ms each · " + Math.round(total * 1000) + " ms apart by the end" }, t0);
    return sum;
  }

  // 室 THE REEL AS THE ROOM (W3). "A two-second slice of a broadcast reel
  // becomes the convolution impulse — the whole station played through the
  // voice of Duck and Cover or the Buzzer. Audio only; the set stays dark."
  //
  // The slice has to be the REEL'S OWN AUDIO, not a synthesised stand-in, so it
  // is tapped live: a ScriptProcessor sits on the signal's output for sliceS
  // seconds and writes what it hears into a buffer. That buffer, windowed and
  // normalised, becomes a ConvolverNode's impulse, and a share of the station's
  // dry sum goes through it for the rest of the cycle. The processor is torn
  // down the moment it has enough — it exists for two seconds, not for a night.
  //
  // Windowing matters more than it looks: an impulse that starts or ends
  // abruptly convolves a click onto every sound in the station, so the slice
  // gets a short fade at both ends and is normalised to a fixed energy — the
  // room must change its CHARACTER without changing the station's level.
  var farRoomConv = null, farRoomWet = null, farRoomTap = null;
  //
  // WHEN the tap listens is the whole departure. The graph is built a second
  // or more ahead of t0 (the lookahead lead), and the signal's own gain is at
  // zero until t0 and only reaches full level after TUNE_S — so a tap that
  // starts the moment it is connected records the silence before the
  // broadcast and the whisper of it tuning in, and is finished before the
  // reel is properly up. Measured in a real browser at rc.19: 1.1 s of exact
  // digital silence, then a step, with the median energy 2.1 s into a 2.34 s
  // impulse. Convolved, that is not a room — it is a one-second slap-back
  // with a click on its front edge, which is precisely what the windowing
  // below exists to prevent.
  //
  // So the handler gates on `startT`: it drops every block that begins before
  // the reel is up and starts accumulating at the first one that does not.
  // ev.playbackTime is the context time of the block's first sample, which is
  // the same clock startT is written in. The tap is connected early because
  // that is when the graph is built; it simply does not listen yet.
  // 経路 ?capture=off — 室 DOES NOT BUILD ITS TAP.
  //
  // On a reelrm night this ScriptProcessor is, for about two seconds in the
  // middle of a reel, THE ONLY NODE CONNECTED TO ctx.destination: the master
  // leaves through the MediaStreamDestination (background-audio.js), so on a
  // default night nothing else touches the destination at all. The tap
  // therefore does not merely add a main-thread audio callback every 85 ms —
  // it gives the context's hardware output a graph where it had none, and
  // takes it away again two seconds later, at the exact moment the owner says
  // they hear something.
  //
  // ITS LEVEL IS NOT THE WORRY, and that was worth checking rather than
  // assuming. Measured in WKWebView (seed 12, ?far=0.9, a night that draws
  // 室), with AudioNode.prototype.connect patched to catch every connection
  // to the destination and meter it:
  //
  //   · exactly ONE connection to ctx.destination in the whole night, and it
  //     is this one — a GainNode, from farRoomCapture. Not the processor
  //     direct: it does go through `sink`.
  //   · peak at the sink's output (what the speakers would get): 0.00000000
  //     over 463 blocks. Peak at the PROCESSOR's own output, before the
  //     gain: also 0.00000000 — WebKit zero-fills an outputBuffer the
  //     handler never writes. Nothing is added to anything.
  //   · sink.gain.value reads 1 at the instant connect() is called, because
  //     setValueAtTime schedules rather than assigns; it is 0 by the first
  //     sample of the first quantum, and 0 at every poll thereafter. The
  //     window is arithmetic, not audible.
  //
  // What IS true, and is why the switch exists: on a default night the master
  // leaves through the MediaStreamDestination, so NOTHING is connected to
  // ctx.destination at all — and then, mid-reel, this is. The destination
  // goes from no inputs to one. `sink` is never disconnected (sp is, at
  // completion), so it is a ONE-TIME transition per night rather than one per
  // reel — which is a mark AGAINST it explaining a per-reel symptom, and is
  // recorded here so the next reader does not have to re-derive it.
  //
  // With the switch off, 室 simply does not sound: there is no synthetic
  // reel-room to fall back to, so the station keeps the hull and the
  // corridor it already has. It says so in the log rather than going quietly
  // missing.
  function captureOff() {
    try { return !!(window.ZankyoAudio && ZankyoAudio.getRoute && ZankyoAudio.getRoute().capture === "off"); } catch (e) { return false; }
  }
  function farRoomCapture(srcNode, startT) {
    var p = farDep("reelrm"); if (!p || farRoomConv) return;
    var T = tl(), c = T.ctx;
    if (captureOff()) {
      T.emitEvent({ cat: "far", label: "室 not taken", detail: "?capture=off · no tap on ctx.destination · the station keeps the hull and the corridor" }, startT);
      return;
    }
    if (!c.createScriptProcessor) return;
    var sr = c.sampleRate, want = Math.round(p.sliceS * sr), got = 0;
    var acc = new Float32Array(want);
    var sp = c.createScriptProcessor(4096, 1, 1), sink = c.createGain();
    sink.gain.setValueAtTime(0, c.currentTime);            // the tap is silent: it listens only
    var done = false;
    sp.onaudioprocess = function (ev) {
      if (done) return;
      if (ev.playbackTime + 1e-4 < startT) return;         // not yet: the reel is not up
      var inp = ev.inputBuffer.getChannelData(0), n = Math.min(inp.length, want - got);
      for (var i = 0; i < n; i++) acc[got + i] = inp[i];
      got += n;
      if (got >= want) { done = true; try { srcNode.disconnect(sp); sp.disconnect(); } catch (e) {} farRoomBuild(acc, sr); }
    };
    try { srcNode.connect(sp); sp.connect(sink); sink.connect(c.destination); } catch (e) { return; }
    farRoomTap = sp;
  }
  function farRoomBuild(acc, sr) {
    var p = farDep("reelrm"); if (!p) return;
    var T = tl(), c = T.ctx, dry = T.dryBus && T.dryBus(), out = T.masterIn && T.masterIn();
    if (!dry || !out) return;
    var n = acc.length, fade = Math.min(Math.round(0.02 * sr), n >> 2), i, e = 0;
    for (i = 0; i < fade; i++) { acc[i] *= i / fade; acc[n - 1 - i] *= i / fade; }
    for (i = 0; i < n; i++) e += acc[i] * acc[i];
    var rms = Math.sqrt(e / n);
    if (!(rms > 1e-6)) return;                             // silence makes no room
    var k = 0.06 / rms;                                    // a fixed energy: the character changes, the level does not
    for (i = 0; i < n; i++) acc[i] *= k;
    try {
      var buf = c.createBuffer(1, n, sr);
      buf.getChannelData(0).set(acc);
      farRoomConv = c.createConvolver(); farRoomConv.normalize = false; farRoomConv.buffer = buf;
      farRoomWet = c.createGain(); farRoomWet.gain.setValueAtTime(0, c.currentTime);
      farRoomWet.gain.linearRampToValueAtTime(p.wet, c.currentTime + 4);
      dry.connect(farRoomConv); farRoomConv.connect(farRoomWet); farRoomWet.connect(out);
      T.emitEvent({ cat: "far", label: "室 the reel becomes the room", detail: (n / sr).toFixed(2) + "s impulse · wet " + p.wet.toFixed(2) }, c.currentTime);
    } catch (e2) {}
  }
  function farRoomTeardown() {
    try { if (farRoomTap) { farRoomTap.onaudioprocess = null; farRoomTap.disconnect(); } } catch (e) {}
    try { if (farRoomWet) farRoomWet.disconnect(); } catch (e) {}
    try { if (farRoomConv) farRoomConv.disconnect(); } catch (e) {}
    farRoomTap = null; farRoomWet = null; farRoomConv = null;
  }

  // ---- the signal itself ----
  function startSignal(a, t0) {
    var T = tl(), c = T.ctx, vix = a.vidx || 0, v = videos[vix], ms = mediaSrcs[vix];
    var buffered = reelsBuffered(), bufSrc = null, bufSrcs = [];   // 経路: the reel's first node is the only thing this switch moves
    var band = T.getLayerParam("broadcast", "band", 0.5), flutter = T.getLayerParam("broadcast", "flutter", 0.5), grit = T.getLayerParam("broadcast", "grit", 0.5);
    // THE PLAN IS THE TIMELINE. Every time below is derived from it, so a
    // reception with an eight-second hunt in front of it, a hole in the middle
    // and a lingering loss at the end is the same code path as today's clip.
    var P = a.rx || planOne(a.reel, a.inS, a.holdS, a.lossD);
    var holdS = P.presenceS, lossD = P.exitS, lossStart = t0 + P.lossAtS, cut = t0 + P.spanS, burstAt = cut + COLLAPSE_S, end = burstAt + BURST_S + DEAD_S;
    // §11.3 THE STATION TUNES TO THE SIGNAL. On a far night at d ≥ 0.5, a reel
    // that is TAGGED as holding a pitch (TONE_PITCHED: tone, sung and drone —
    // `drone` arrived with the 207-reel pool and this comment used to say it
    // did not exist, which was true of 52 reels and false of 207) and MEASURED
    // as holding one may pull the field to itself instead of being pulled. Tag
    // and measurement both, because a tag is an assertion and the flag is a
    // fact. The engine refuses in a KIRU's hush, at home, and below 0.5 — all
    // three tested there rather than here, so this cannot forget one.
    var rate = a.rate || 1, seaHz = 0;
    if (a.pitchHz > 0 && TONE_PITCHED[a.reel.tone] && T.seaToward) {
      var got = T.seaToward(a.pitchHz, t0 + TUNE_S);
      if (got) { seaHz = got; rate = 1; }                 // the tape is not warped; the station moves
    }
    // The live band must open low enough to PASS the fundamental the tool
    // measured. A tuned reel whose pitch is 97 Hz played behind a 300 Hz
    // highpass is a reel tuned to something the listener cannot hear — the
    // bend would be arithmetically perfect and inaudible. So the floor drops
    // for a tuned reel and the band knob still narrows above it; an untuned
    // reel keeps exactly the band it had, which is also why no untuned
    // broadcast changes by a sample here.
    var hpHold = (a.reel.tuned ? 80 + 60 * band : 200 + 120 * band), lpHold = 6000 - 2600 * band;
    var nodes = [];
    function N(n) { nodes.push(n); return n; }
    try {
      // the radio band: opens with the tuning, narrows again in the loss
      var hp = N(c.createBiquadFilter()); hp.type = "highpass"; hp.Q.setValueAtTime(0.7, t0);
      var lp = N(c.createBiquadFilter()); lp.type = "lowpass"; lp.Q.setValueAtTime(0.7, t0);
      // exponential Hz ramps (S3, critic S1 §2.7c): a band opening in pitch, not in Hz
      hp.frequency.setValueAtTime(800, t0); hp.frequency.exponentialRampToValueAtTime(hpHold, t0 + P.entryS + 1.0);
      lp.frequency.setValueAtTime(1600, t0); lp.frequency.exponentialRampToValueAtTime(lpHold, t0 + P.entryS + 1.0);
      hp.frequency.setValueAtTime(hpHold, lossStart); hp.frequency.exponentialRampToValueAtTime(900, cut);
      lp.frequency.setValueAtTime(lpHold, lossStart); lp.frequency.exponentialRampToValueAtTime(1500, cut);
      // the receiver: pre-attenuated tanh, makeup after (the grit knob is the drive)
      var pre = N(c.createGain()); pre.gain.setValueAtTime(0.5, t0);
      var sh = N(c.createWaveShaper()); var k = 1 + 5 * grit, curve = new Float32Array(1024), tk = Math.tanh(k);
      for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; curve[i] = Math.tanh(x * k) / tk; }
      sh.curve = curve; sh.oversample = "2x";
      var mk = N(c.createGain()); mk.gain.setValueAtTime(1.6, t0);
      // AM flutter: gain = (1 − d/2) + (d/2)·sin, deeper in the loss
      var depth = 0.1 + 0.4 * flutter;
      var fl = N(c.createGain()); fl.gain.setValueAtTime(1 - depth / 2, t0);
      var lfo = N(c.createOscillator()); lfo.type = "sine"; lfo.frequency.setValueAtTime(a.lfoHz, t0);
      var dg = N(c.createGain()); dg.gain.setValueAtTime(depth / 2, t0); dg.gain.setValueAtTime(depth / 2, lossStart); dg.gain.linearRampToValueAtTime(Math.min(0.5, depth), cut);
      lfo.connect(dg); dg.connect(fl.gain); lfo.start(t0); lfo.stop(end);
      // the dropout gate: the same seeded holes the picture shows. A hole is a
      // DUCK to DROP_FLOOR, never a mute (see the constants) — the voice stays
      // under the static that rises in the same span, from the hiss branch
      // below, which is built here so the two share one loop and one clock.
      var gate = N(c.createGain()); gate.gain.setValueAtTime(1, t0);
      var hn = N(T.noiseSource()), hb = N(c.createBiquadFilter()), hz = N(c.createGain());
      hb.type = "bandpass"; hb.Q.setValueAtTime(1.6, t0);
      hz.gain.setValueAtTime(0, t0);
      var absDrops = [];
      for (i = 0; i < a.drops.length; i++) {
        var da = t0 + a.drops[i][0], dd = a.drops[i][1];
        gate.gain.setValueAtTime(1, da); gate.gain.linearRampToValueAtTime(DROP_FLOOR, da + 0.006);
        gate.gain.setValueAtTime(DROP_FLOOR, da + dd); gate.gain.linearRampToValueAtTime(1, da + dd + 0.006);
        // the static swells in over the head of the hole and drops out with
        // it; its band wanders hole to hole on the signal's own seed (no draw)
        var hf = 700 + 1900 * (((a.seed || 0) * 0.618 * (i + 1)) % 1);
        hb.frequency.setValueAtTime(hf, da); hb.frequency.exponentialRampToValueAtTime(hf * 1.4, da + dd);
        hz.gain.setValueAtTime(0, da); hz.gain.linearRampToValueAtTime(DROP_HISS, da + Math.min(0.03, dd * 0.25));
        hz.gain.setValueAtTime(DROP_HISS, da + dd); hz.gain.linearRampToValueAtTime(0, da + dd + 0.03);
        absDrops.push([da, dd]);
      }
      hn.connect(hb); hb.connect(hz); hn.start(t0, 11); hn.stop(cut + 0.3);
      // the 3042 codec: a staircase, coarser with the grit. A whisper of dither
      // (texture, unseeded) rides in ahead of it so the quiet between words
      // hisses instead of gating to digital silence — the critic's softener
      // (S1 §2.7c); the owner's ear sets it (DITHER_DB)
      var cr = N(c.createWaveShaper()); var steps = Math.round(48 - 40 * grit), cc = new Float32Array(1024);
      for (i = 0; i < 1024; i++) { var cx = (i / 1023) * 2 - 1; cc[i] = Math.round(cx * steps) / steps; }
      cr.curve = cc;
      var dn = N(T.noiseSource()), dg2 = N(c.createGain()); dg2.gain.setValueAtTime(db2lin(DITHER_DB) / steps, t0);
      dn.connect(dg2); dg2.connect(cr); dn.start(t0, 7); dn.stop(end);
      // THE TUNING ENVELOPE, WALKED FROM THE PLAN. In over the entry + 1.0 s,
      // flat across each piece, to nothing in each carrier-lost gap and back up
      // over the relock, out as (1 − k²) through the exit, a hard cut. A
      // one-piece reception produces exactly the list this used to hold
      // literally — in over 0.4 + 1.0, hold, the four-step loss, the 0.02 cut.
      var sg = N(c.createGain());
      var peak = 0.35 * db2lin(a.reel.gain);
      var env = [[P.entryS, peak * 0.85], [1.0, peak], [Math.max(0, P.segments[0].onS - 1.0), peak]];
      for (i = 1; i < P.segments.length; i++) {
        var gseg = P.segments[i], ggap = P.gaps[i - 1];
        env.push([0.12, peak * GAP_FLOOR]);                              // the carrier goes
        env.push([Math.max(0, ggap.durS - 0.12), peak * GAP_FLOOR]);     // …and stays gone
        env.push([Math.max(0.02, gseg.lockS), peak]);                    // the relock: found again, short
        env.push([gseg.onS, peak]);
      }
      if (P.exitS > 0.05) {
        env.push([P.exitS * 0.5, peak * 0.75]); env.push([P.exitS * 0.25, peak * 0.44]);
        env.push([P.exitS * 0.15, peak * 0.19]); env.push([P.exitS * 0.1, peak * 0.06]);
      }
      env.push([0.02, 0]);                                               // 絶 mid-word is this line alone
      PJ.Voice.env(sg.gain, t0, env);
      // THE HEAD OF THE CHAIN, and the whole of the ?reels=buffer difference.
      // Everything downstream — band, receiver, flutter, dropouts, staircase,
      // envelope, phasing, room tap — is the same graph on the same schedule;
      // the reel simply arrives from a buffer instead of from an element. The
      // in-point becomes start()'s offset and the tape rate becomes the
      // source's playbackRate, which are the two things v.currentTime and
      // v.playbackRate were doing.
      // ONE SOURCE PER PIECE. In buffer mode each piece of the plan is its own
      // BufferSource, started at its own moment with its own in-point — which
      // is what makes 戻's "the same broadcast, later in the source" and 走's
      // second reel fall out of the plan rather than needing a mechanism. In
      // element mode there is still ONE head (the media element cannot be in
      // two places at once) and the pieces are seeks, scheduled below.
      var head = ms;
      if (buffered) {
        for (i = 0; i < P.segments.length; i++) {
          var sgi = P.segments[i], bi = bufFor(a, sgi.reel);
          if (!bi) continue;
          var bs = N(c.createBufferSource());
          bs.buffer = bi;
          bs.playbackRate.setValueAtTime(rate * (T.glideMul ? T.glideMul(t0) : 1), t0 + sgi.srcFromS);
          bs.start(t0 + sgi.srcFromS, sgi.inS);
          bs.stop(t0 + sgi.srcToS);
          bufSrcs.push(bs);
          bs.connect(hp);
        }
        bufSrc = bufSrcs[0] || null;
        head = null;
      }
      if (head) head.connect(hp);
      hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(mk); mk.connect(fl); fl.connect(gate); gate.connect(cr); cr.connect(sg);
      hz.connect(sg);   // the holes' static joins past the staircase, under the same envelope as the reel
      // 相 PHASING (W3): two copies of the same window drifting apart. Reich
      // ran two tape loops at almost the same speed; here one copy goes through
      // a delay whose time ramps from nothing to driftMs × passes across the
      // hold, which is the same relationship expressed as a comb that sweeps —
      // and it is the comb, not the delay, that is the sound. It costs one
      // delay and one gain, and only while a signal is up.
      var phased = farPhaseTap(sg, t0, cut, N);
      (phased || sg).connect(T.lg("broadcast"));
      farRoomCapture(sg, t0 + TUNE_S + 1.0);      // 室: two seconds of the reel, once it is properly tuned in
      // 螺 / 弛 — THE REEL RIDES THE GLIDE. The station's whole field slides
    // under a spiral or a varispeed: 螺 reaches 200–700 cents, 弛 100–400, and
    // together up to 1100. The air hold silences the five melodic voices and
    // the PA, but NOT the sub-drone and NOT the shō — and both follow the
    // glide explicitly through glidePartial. So a reel that held still would
    // be the one thing in the room not moving, against precisely the two
    // sustained pitched voices left sounding under it.
    //
    // Evaluating the degree once at "air time" does not fix this and is the
    // wrong shape of answer: 螺's drawn slope is 0.6–4.0 cents/s, so the field
    // moves up to 48 cents across a 12 s hold — five times the gate — and a
    // snapshot is in tune for one instant. Tracking dissolves the question of
    // WHICH instant to snapshot, which is also why it is the right design and
    // not merely the thorough one.
    //
    // The tuning bend stays unglided and stays capped; the glide multiplies on
    // top, exactly as it does for every voice. It is always downward, so the
    // reel runs SLOWER and consumes less of its window than `need × rate`
    // reserved — the in-point stays conservative. Nothing is scheduled at all
    // unless the night glides, so home nights add no events.
    // The reel must SOUND at degreeHz × glide(t); its rate is degreeHz/pitchHz,
    // so the playback rate is simply rate × glide(t) — no reference value and
    // nothing to divide out.
    if (T.gliding && T.gliding() && T.glideMul) {
      for (var gt = t0 + 0.5; gt < cut; gt += 0.5) {
        (function (tt) {
          T.lane("broadcast").at(tt - 0.05, function () {
            try { if (v && !v.paused) v.playbackRate = rate * T.glideMul(tt); } catch (e) {}
            try { for (var bq = 0; bq < bufSrcs.length; bq++) bufSrcs[bq].playbackRate.setValueAtTime(rate * T.glideMul(tt), tt); } catch (e) {}
          });
        })(gt);
      }
    }
    // the burst after the collapse: pure static, then the afterglow
      var bn = N(T.noiseSource()), bh = N(c.createBiquadFilter()), bg = N(c.createGain());
      bh.type = "highpass"; bh.frequency.setValueAtTime(1800, burstAt);
      bn.connect(bh); bh.connect(bg); bg.connect(T.lg("broadcast"));
      PJ.Voice.env(bg.gain, burstAt, [[0.005, 0.07], [BURST_S - 0.04, 0.05], [0.035, 0]]);
      bn.start(burstAt, 3); bn.stop(burstAt + BURST_S + 0.1);
    } catch (e) {
      for (i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e2) {} }
      stats.fallbacks++; stats.lastReason = "graph: " + (e && e.message);
      T.airHoldClear(a.holdId); a.dead = true; qDrop(a);
      try { T.fallback(t0); } catch (e3) {}
      return;
    }
    live = { a: a, nodes: nodes, hp: hp, end: end, bufSrc: bufSrc, bufSrcs: bufSrcs };
    stats.signals++;
    if (a.pinned && !pinUsed) {
      pinUsed = true;   // spent ON AIR, not at arm: a fallback must not eat it
      T.emitEvent({ cat: "rx", label: "受信 pinned", detail: a.reel.id + (a.whole ? " · whole · " : " · ") + a.holdS.toFixed(1) + "s · the lottery resumes" }, t0);
    }
    remember(a.reel.id, a.cycle);
    // the crew's duck and notch for the signal's span
    try { T.roomSpeak("broadcast", t0, P.spanS, 800); } catch (e) {}
    // one bonshō may ring under it in a rite cycle (the machine answering the past)
    // — under the FIRST piece, at its midpoint, so a reception that breaks and
    // returns does not ring in the silence where the carrier was lost.
    if (a.bell && a.kind === "rite") { try { T.bonsho(t0 + P.segments[0].atS + P.segments[0].onS * 0.45); } catch (e) {} }
    // the element starts on the audio clock's cue (a setTimeout for the lookahead lead)
    T.lane("broadcast").at(t0 - 0.12, function (t) {
      var lead = Math.max(0, (t - c.currentTime) * 1000);
      setTimeout(function () { try {
        if (!v) return;                                     // 経路 buffer mode with no DOM: the sound is already away
        if (buffered) hushElement(v);                       // …and the picture stays voiceless right up to the moment it moves
        if (Math.abs(v.currentTime - P.segments[0].inS) > 0.5) v.currentTime = P.segments[0].inS;
        // TAPE-STYLE: the pitch and the speed move together, which is the
        // whole idiom — a reel bent to the field also runs slow or fast, and
        // that is the sound of a machine, not a pitch-shifter.
        try { v.preservesPitch = false; v.mozPreservesPitch = false; v.webkitPreservesPitch = false; } catch (e2) {}
        v.playbackRate = rate * (T.glideMul ? T.glideMul(t0) : 1);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } catch (e) {} }, lead);
    });
    // THE PIECES AFTER THE FIRST, in element mode: the reception returns to the
    // same frequency at a later moment of the source (戻) or crosses to another
    // reel entirely (走), and either way that is a src change and/or a seek on
    // the one element. Scheduled on the lane at the RELOCK, under an envelope
    // that is already at the carrier-lost floor, so the seek itself is silent.
    for (i = 1; i < P.segments.length; i++) {
      (function (sgm) {
        T.lane("broadcast").at(t0 + sgm.lockAtS - 0.12, function (t) {
          var lead2 = Math.max(0, (t - c.currentTime) * 1000);
          setTimeout(function () { try {
            if (!v) return;
            var rid = (sgm.reel && sgm.reel.id) || (a.reel && a.reel.id);
            if (videoSrcIds[vix] !== rid) { videoSrcIds[vix] = rid; v.src = reelUrl(sgm.reel || a.reel); v.preload = "auto"; v.load(); }
            v.currentTime = sgm.inS;
            var p2 = v.play(); if (p2 && p2.catch) p2.catch(function () {});
          } catch (e) {} }, lead2);
        });
      })(P.segments[i]);
    }
    // the descriptor for the set and the VFD line 「受信 · title · year」
    var wire = planWire(P);
    var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: absDrops, id: a.reel.id, title: shortTitle(a.reel.title), year: a.reel.year, seed: a.seed, picture: true, video: v, rx: wire };
    T.lane("broadcast").at(t0 - 0.15, function () {
      T.emitEvent({ cat: "rx", label: "受信", detail: shortTitle(a.reel.title) + " · " + a.reel.year, signal: desc, link: a.reel.src || null }, t0);
    });
    // 同調 — the tuning line, and the critic's arithmetic gate reads it. It is
    // emitted ONLY when something was actually tuned: an untuned reel, and a
    // reel past the ±4 semitone cap, play at rate exactly 1 and say nothing,
    // so the absence of this line is itself a claim that can be checked.
    if (seaHz) {
      T.emitEvent({ cat: "rx", label: "同調", detail: "the station tunes to the signal · reel " + a.pitchHz.toFixed(2) +
        " Hz · tonic → " + seaHz.toFixed(2) + " Hz · reel unbent" }, t0 + TUNE_S);
    } else if (rate !== 1 && a.pitchHz > 0) {
      // The line must describe what is SOUNDING, not what was drawn. On a
      // gliding night the element's rate is rate × glide(t) and the reel
      // follows the field down all through the hold, so a reader comparing
      // this line against the element — or against an FFT — would otherwise
      // find a discrepancy that is the glide doing its job. Say so.
      var gl = (T.gliding && T.gliding()) ? T.glideMul(t0 + TUNE_S) : 1;
      T.emitEvent({ cat: "rx", label: "同調", detail: "reel " + a.pitchHz.toFixed(2) + " Hz → " + (a.pitchHz * rate).toFixed(2) +
        " Hz · " + (a.cents > 0 ? "+" : "") + a.cents.toFixed(1) + " cents · rate " + rate.toFixed(4) +
        (gl !== 1 ? " · riding the glide, ×" + gl.toFixed(4) + " at air (" + (1200 * Math.log(gl) / Math.LN2).toFixed(1) + " cents) and tracking" : "") }, t0 + TUNE_S);
    }
    T.lane("broadcast").at(cut, function () {
      T.emitEvent({ cat: "rx", label: "消失", detail: "signal lost · " + holdS.toFixed(1) + " s" + (P.segments.length > 1 || P.body !== "jou" ? " on air · " + P.spanS.toFixed(1) + " s" : "") }, cut);
    });
    T.lane("broadcast").at(end + 0.5, function () { teardown(); });
  }
  function warmPicture(v) { try { if (window.ZankyoSet && ZankyoSet.warm) ZankyoSet.warm(v); } catch (e) {} }   // S3: one offscreen drawImage now, so the first frame at t0 does not stall
  function shortTitle(t) { t = String(t || ""); var i = t.indexOf(" ("); if (i > 0) t = t.slice(0, i); i = t.indexOf(","); if (i > 0) t = t.slice(0, i); return t; }
  function teardown() {
    var L = live; live = null;
    if (!L) return;
    var vix = L.a.vidx || 0;
    if (videos[vix]) { try { videos[vix].pause(); } catch (e) {} }
    if (L.bufSrcs) for (var bs2 = 0; bs2 < L.bufSrcs.length; bs2++) { try { L.bufSrcs[bs2].stop(); } catch (e) {} }
    try { if (mediaSrcs[vix] && L.hp) mediaSrcs[vix].disconnect(L.hp); } catch (e) {}
    for (var i = 0; i < L.nodes.length; i++) { try { L.nodes[i].disconnect(); } catch (e2) {} }
    L.a.dead = true; qDrop(L.a);
  }
  function stop() {
    teardown();
    farRoomTeardown();                            // 室: the room goes back to being a room
    qClear(); scanWanted = false; scanCycle = -1;
  }

  // ---- 選局 SCAN NOW (S2): the listener turns the dial. Never in a KIRU or its
  // hush (the kyū, the release and a jo's first 12 s are out), never two in a
  // cycle (if the plan already carries the broadcast this cycle, that one is
  // the answer; if one has played, the scan waits for the next cycle), the
  // signal seated ≥ 14 s out so the prefetch and the static rise have room.
  // Draws on a per-cycle fork of the signal stream: a user's act, but a
  // reproducible one for a given cycle.
  var scanWanted = false, scanCycle = -1;
  function legalT0(sc, now) {
    if (!sc || !sc.type) return null;
    if (sc.type === "kyu" || sc.type === "oroshi" || sc.type === "release") return null;
    var t0 = Math.max(now + 14, sc.type === "jo" ? sc.startT + 12 + 8 : sc.startT + 8);
    var end = sc.startT + sc.durS - 3;
    return (t0 + TUNE_S + 12 + 2.8 + COLLAPSE_S + BURST_S <= end) ? t0 : null;
  }
  function seatScan(sc, cy) {
    var T = tl(), now = T.ctx.currentTime, t0 = legalT0(sc, now);
    if (t0 == null) return false;
    var R = T.S.signal.fork("scan:" + cy.n);
    var sa = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, t0), R);
    if (!sa) return false;
    if (!fire(t0)) { sa.dead = true; qDrop(sa); return false; }
    scanWanted = false; scanCycle = cy.n; stats.scans++;
    T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal in " + Math.round(t0 - now) + " s" }, now);
    return true;
  }
  function scan() {
    var T = tl(); if (!T.ctx || !T.playing() || !T.S) return false;
    var cy = T.cycle(), sc = T.scene(), now = T.ctx.currentTime;
    if (rxUp()) { T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal is up" }, now); return true; }
    if (cy.visit === "the broadcast" && armedQ.length && armedQ[0].cycle === cy.n) { T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal is already on its way this cycle" }, now); return true; }
    if (scanCycle === cy.n || (recent.length && recent[recent.length - 1].cycle === cy.n)) { scanWanted = true; T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "nothing more on the air this cycle · the next" }, now); return true; }
    if (seatScan(sc, cy)) return true;
    scanWanted = true; T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "not now (" + (sc.type || "—") + ") · at the next scene" }, now);
    return true;
  }
  // ONE ATTEMPT at the bench's request, at the next legal moment. benchForce is
  // live only for the duration of the attempt — never across it — so a failed
  // bench seat cannot leak into the next ordinary broadcast.
  function benchTry() {
    var T = tl();
    if (!benchQueued) return { ok: false, state: "idle" };
    if (!T.ctx || !T.playing() || !T.S) return { ok: false, state: "queued", why: "the station is stopped" };
    if (rxUp()) return { ok: false, state: "queued", why: "a signal is already up" };
    var now = T.ctx.currentTime, sc = T.scene(), cy = T.cycle();
    var t0 = legalT0(sc, now);
    if (t0 == null) return { ok: false, state: "queued", why: "the " + ((sc && sc.type) || "—") + " cannot host one" };
    var R = T.S.signal.fork("bench:" + Math.floor(now * 1000));
    benchForce = benchQueued;
    var ok = false, why = "";
    try {
      var ba = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, t0), R);
      if (!ba) why = "the footprint does not fit here";
      else if (!fire(t0)) { ba.dead = true; qDrop(ba); why = "the seat was refused"; }
      else ok = true;
    } catch (e) { why = String(e && e.message || e); }
    benchForce = null;
    if (!ok) return { ok: false, state: "queued", why: why };
    var a = armed || {};
    benchQueued = null;
    return { ok: true, state: "seated", t0: +t0.toFixed(2), inS: +(a.inS || 0).toFixed(2),
      holdS: +(a.holdS || 0).toFixed(2), whole: !!a.whole, reel: a.reel && a.reel.id, inS_s: a.inS };
  }
  function onScene(sc) {
    if (benchQueued) { var br = benchTry(); if (br.ok) return; }
    if (!scanWanted) return;
    var T = tl(); if (!T.playing()) return;
    var cy = T.cycle();
    if (sc.planned || rxUp() || scanCycle === cy.n) return;   // a planned one is the answer; one per cycle
    seatScan(sc, cy);
  }

  // ---- the ♪ audition (S2; plan §7 addendum): a FULL reel window while the
  // station is stopped — the whole 10–12 s with the complete tune-in / hold /
  // loss gesture on the tube, not the 2 s tune-in it used to be. The owner's
  // note: an audition should show what a signal IS. It draws the same hold and
  // loss as a real one (8–12 s and 1.6–2.8 s), and the same dropout plan, so
  // the picture breathes and stutters the way it does in a performance.
  // No lanes — the clock is not running — so Web Audio times and timeouts.
  function sampleTune(t) {
    var T = tl(), c = T.ctx; if (!c) return false;
    loadPool();
    // 経路 buffer mode: the element is the picture only, and the audition's
    // audio comes from the same decoded buffer a real signal uses.
    var buffered = reelsBuffered();
    var v = ensureVideo(0), ms = ensureMediaSource(c, 0);
    var R = T.S ? T.S.sample : PJ.Rand.stream((Date.now() % 4294967295) >>> 0);
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next();
    var holdS = 8 + rHold * 4, lossD = LOSS_MIN_S + rLoss * LOSS_SPAN_S;
    if (poolState !== "ready" || !v || (!buffered && !ms) || !pool.length) { staticRise(t, t + 1.0); return true; }   // the dial turns, nothing found
    // ?reel= pins the audition too, and on EVERY press — unlike the on-air pin,
    // which is spent once. rReel is still drawn above, so the sample stream is
    // where it would have been.
    var pinA = pinnedReel();
    var reel = pinA || pool[Math.floor(rReel * pool.length)];
    var awi = Math.floor(rWin * reel.windows.length);
    // §14 in the audition too: a whole reel is auditioned whole, so the button
    // plays what the air would play.
    var awhole = wholeAt(reel, awi);
    if (awhole && !wholeFits(reel, awi)) {
      var aAlt = -1, aShort = awi, aSl = 1e9, aw, aj, al;
      for (aw = 0; aw < reel.windows.length; aw++) {
        aj = (awi + aw) % reel.windows.length;
        if (!wholeAt(reel, aj)) continue;
        al = reel.windows[aj][1] - reel.windows[aj][0];
        if (al < aSl) { aSl = al; aShort = aj; }
        if (aAlt < 0 && wholeFits(reel, aj)) aAlt = aj;
      }
      awi = aAlt >= 0 ? aAlt : aShort; awhole = wholeAt(reel, awi);
    }
    var win = reel.windows[awi];
    var wl = (win[1] - win[0]), need = TUNE_S + holdS + lossD;
    if (awhole) { holdS = Math.min(wl, WHOLE_MAX_HOLD_S); need = TUNE_S + holdS + lossD; }
    else if (need > wl) { holdS = Math.max(3, wl - TUNE_S - lossD); need = TUNE_S + holdS + lossD; }
    var inS = awhole ? win[0] : win[0] + rIn * Math.max(0, wl - need - 0.5);
    if (pinA) T.emitEvent({ cat: "rx", label: "受信 pinned", detail: reel.id + (awhole ? " · whole · " : " · ") + holdS.toFixed(1) + "s · audition" }, t);
    // the same dropout plan a real signal gets, so the picture stutters
    var adrops = [], dt = TUNE_S + 0.6;
    while (dt < TUNE_S + holdS) { dt += 1.2 + R.next() * 3.2; if (dt < TUNE_S + holdS) adrops.push([dt, 0.12 + R.next() * 0.25]); }
    // EVERY DRAW IS ABOVE THIS LINE. build() may run now or a fetch later, and
    // it takes no draws of its own — so a deferred audition is the same
    // audition, just further down the clock, and the sample stream is left
    // exactly where an undeferred one would leave it.
    function build(tt) {
      var t0 = tt + 1.0, tuneEnd = t0 + TUNE_S + holdS + lossD;
      var nodes = [], hp, lp, pre, sh, sg, bufSrc = null;
      try {
        hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(700, t0); hp.frequency.linearRampToValueAtTime(260, t0 + 0.8);
        lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1600, t0); lp.frequency.linearRampToValueAtTime(4700, t0 + 0.8);
        pre = c.createGain(); pre.gain.setValueAtTime(0.5, t0);
        sh = c.createWaveShaper(); var cv = new Float32Array(1024); for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; cv[i] = Math.tanh(x * 3.5) / Math.tanh(3.5); } sh.curve = cv;
        sg = c.createGain(); var peak = 0.35 * db2lin(reel.gain) * 1.6;
        PJ.Voice.env(sg.gain, t0, [[TUNE_S, peak * 0.85], [1.0, peak], [holdS - 1.0, peak], [lossD * 0.6, peak * 0.4], [lossD * 0.4, 0]]);
        nodes = [hp, lp, pre, sh, sg];
        var head = ms;
        if (buffered) {
          head = bufSrc = c.createBufferSource(); bufSrc.buffer = bufCache[reel.id];
          nodes.push(bufSrc); bufSrc.start(t0, inS); bufSrc.stop(tuneEnd + 0.2);
        }
        head.connect(hp); hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(sg); sg.connect(T.lg("broadcast"));
      } catch (e) { return false; }
      staticRise(tt, t0);
      var startMs = Math.max(0, (t0 - c.currentTime) * 1000);
      var url = reelUrl(reel), srcChanged = videoSrcIds[0] !== reel.id;
      videoSrcIds[0] = reel.id;
      try {
        if (srcChanged) { v.src = url; v.preload = "auto"; v.load(); }
        var go = function () { try { if (buffered) hushElement(v); v.currentTime = inS; warmPicture(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} };
        if (srcChanged || v.readyState < 3) { var once = function () { try { v.removeEventListener("canplay", once); } catch (e) {} setTimeout(go, Math.max(0, (t0 - c.currentTime) * 1000)); }; v.addEventListener("canplay", once, { once: true }); }
        else setTimeout(go, startMs);
      } catch (e) {}
      lastSampleAudioOnly = !!reel.audioOnly;
      var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: adrops, id: reel.id, title: shortTitle(reel.title), year: reel.year, seed: rIn * 1000, picture: true, video: v };
      T.emitEvent({ cat: "rx", label: "♪ 受信", detail: shortTitle(reel.title) + " · " + reel.year, signal: desc, link: reel.src || null }, t0);
      setTimeout(function () { try { if (bufSrc) bufSrc.stop(); } catch (e0) {} try { if (mediaSrcs[0] && hp) mediaSrcs[0].disconnect(hp); } catch (e) {} for (var k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e2) {} } try { v.pause(); } catch (e3) {} }, (tuneEnd - c.currentTime) * 1000 + COLLAPSE_S * 1000 + 400);
      return true;
    }
    // In buffer mode an undecoded reel means a fetch of a megabyte or so
    // before there is anything to sound. The dial turns NOW — the press must
    // answer immediately — and the reel arrives behind it.
    if (buffered && !bufCache[reel.id]) {
      staticRise(t, t + 1.0);
      decodeReel(reel.id, c).then(function () { try { build(tl().ctx.currentTime + 0.15); } catch (e) {} }, function () {});
      return true;
    }
    return build(t);
  }

  Z._signal.install({ arm: arm, fire: fire, stop: stop, sample: sampleTune, scan: scan, scene: onScene, dialNoise: dialNoise, dialLock: dialLock, dialReady: dialReady });

  // ---- public / bench ----
  window.ZankyoBroadcast = {
    // The spacing contract, computed rather than written down twice. See
    // BC_GAP_S in zankyo-audio.js, which asserts against this at play.
    // §4.1 — THE PLACEMENT'S HALF OF THE DRAW. zankyo-audio.js hands over
    // SHAPE_DRAWS numbers off the cycle's own fork and gets back the reception's
    // shape and the room it needs. The weights stay in ONE block in this file,
    // which is the point: the owner moves a value here and it means the same
    // thing on every night, in both files.
    SHAPE_DRAWS: SHAPE_DRAWS,
    drawShape: drawShape,
    drawBudget: drawBudget,
    limits: function () { return { tuneS: TUNE_S, wholeMaxHoldS: WHOLE_MAX_HOLD_S, lossMaxS: LOSS_MIN_S + LOSS_SPAN_S,
      budgetMinS: BUDGET_MIN_S, budgetMaxS: BUDGET_MAX_S, shapeDraws: SHAPE_DRAWS,
      entryMaxS: Math.max(TUNE_S, HUNT_MAX_S, DRIFT_MAX_S), exitMaxS: ZAN_MAX_S,
      staticLeadS: STATIC_LEAD_S, holdLeadS: HOLD_LEAD_S, deadTailS: COLLAPSE_S + BURST_S + DEAD_S,
      relMaxS: REL_MIN_S + REL_SPAN_S, tailS: HOLD_TAIL_S, maxReachPastT0S: maxReachPastT0(),
      // What the GLOBAL spacing still has to cover: an ordinary hold, seated by
      // BC_GAP_S alone. A whole thought's reach is checked per-position at arm
      // (fitsRoom), not against this.
      ordinaryMaxHoldS: ORDINARY_MAX_HOLD_S,
      ordinaryReachPastT0S: TUNE_S + ORDINARY_MAX_HOLD_S + (LOSS_MIN_S + LOSS_SPAN_S) + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S) }; },
    getState: function () {
      return { pool: poolState, poolSize: pool ? pool.length : 0, poolError: poolError, primed: primed, video: !!videos[0], mediaSource: !!mediaSrcs[0],
        // 経路 — what the reel path actually is, read from the objects. `muted`
        // / `volume` / `audioTracks` are the element's real state, so "the
        // <video> has no voice" is a fact a reader can check rather than a
        // claim this switch makes about itself.
        reelsMode: reelsBuffered() ? "buffer" : "element",
        element: videos.map(function (vv) { return vv ? { muted: !!vv.muted, volume: vv.volume, readyState: vv.readyState,
                           audioTracks: vv.audioTracks ? vv.audioTracks.length : null,
                           audioTracksEnabled: (function () { var at = vv.audioTracks, n = 0; if (at) for (var i = 0; i < at.length; i++) if (at[i].enabled) n++; return at ? n : null; })(),
                           src: vv.currentSrc ? vv.currentSrc.split("/").pop() : null } : null; }),
        decoded: bufOrder.slice(), decoding: Object.keys(bufPending),
        armed: armedQ.map(function (q) { return { cycle: q.cycle, reel: q.reel && q.reel.id, inS: +q.inS.toFixed(2), holdS: +q.holdS.toFixed(2), lossD: +q.lossD.toFixed(2), budgetS: q.budgetS, body: q.rx && q.rx.body, drops: q.drops.length, ready: q.ready, t0: q.t0, vidx: q.vidx, decided: q.decided }; }),
        queueDepth: armedQ.length, elements: ELEMS,
        live: !!live, stats: stats, recent: recent.slice(-4),
        // the ring under pressure: at ~1 signal per cycle a four-hour night is
        // about 32 reels from a pool of 32, so "the ring is working" and "the
        // ring is exhausted and repeating" need to be tellable apart
        ring: { keptForCycles: RECENT_CYCLES, held: recent.length, cap: 12, poolSize: pool ? pool.length : 0,
                excludedNow: Object.keys(recentIds(lastCycleSeen)).length } };
    },
    _dev: {
      // §8.1, for the critic: n reel choices through the REAL choose(), with
      // nothing armed and nothing fired. The video-share gate wants ~40 chosen
      // reels and at one signal a cycle that is five hours of browser
      // wall-clock; this makes it a second. It draws on its own fork, so it
      // cannot perturb a performance, and it walks the same candidate list,
      // the same recent-ring exclusion and the same tide weighting the live
      // path walks — the point is that it is not a re-implementation.
      // Validate it against a real capture rather than trusting it.
      drawReels: function (n, seed) {
        if (!pool || !pool.length) return { error: "pool " + poolState, ids: [] };
        n = Math.max(1, Math.min(2000, n | 0 || 40));
        var R = PJ.Rand.stream((seed >>> 0) || 3042).fork("dev:drawReels");
        var saved = recent.slice(), ids = [], video = 0, i;
        recent = [];
        for (i = 0; i < n; i++) {
          var c = choose(R, i, (i % 7) / 6);      // walk the tide across the sample
          if (!c.reel) break;
          ids.push(c.reel.id);
          if (!c.reel.audioOnly) video++;
          remember(c.reel.id, i);                 // so the ring exerts the same pressure it would live
        }
        recent = saved;
        return { n: ids.length, ids: ids, video: video, videoShare: ids.length ? +(video / ids.length).toFixed(4) : 0,
                 distinct: Object.keys(ids.reduce(function (o, x) { o[x] = 1; return o; }, {})).length,
                 poolSize: pool.length, videoInPool: pool.filter(function (p2) { return !p2.audioOnly; }).length,
                 videoWeight: VIDEO_WEIGHT, keptForCycles: RECENT_CYCLES };
      },
      // the bench: seat a signal delayS from now on the current cycle (bypasses the plan; draws on a bench fork, never on S.signal)
      seatNow: function (delayS) {
        var T = tl(); if (!T.ctx || !T.playing() || !T.S) return false;
        delayS = delayS != null ? +delayS : 30;
        if (delayS < 8) delayS = 8;
        var now = T.ctx.currentTime, cy = T.cycle();
        var R = T.S.signal.fork("bench:" + Math.floor(now * 1000));
        if (!arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: now + delayS - 8, hostDurS: 60, tidePos: 0.5 }, now + delayS), R)) return false;
        return fire(now + delayS);
      },
      loadPool: loadPool,
      scan: scan,
      // ---- reel-lab.php ----
      // Seat ONE named window as a real broadcast at the next legal moment,
      // through the production path. Bypasses the lottery and the cooldown;
      // never the legality, the footprint, the hold or the AIR. Returns
      // {ok, state: "seated"|"queued", why} — "queued" means it did not fit
      // yet and will be retried at the next scene.
      seatWindow: function (reelId, wi, opts) {
        opts = opts || {};
        benchQueued = { reelId: String(reelId), wi: (wi == null ? -1 : +wi), whole: opts.whole !== false };
        var r = benchTry();
        if (!r.ok && r.state !== "queued") benchQueued = null;
        return r;
      },
      // PLAY NOW (the bench's default): tune in ~2 s from the press. Ignores the
      // seating deadlines — legality is what makes a real signal wait, and the
      // owner is not waiting 55 s to hear a window. Everything else is the
      // production path: the same arm(), the same fire(), the same hold, AIR,
      // tube and VFD. If a signal is already up, its LOSS is allowed to finish
      // and this one follows it rather than cutting it off.
      seatWindowNow: function (reelId, wi, opts) {
        opts = opts || {};
        var T = tl();
        if (!T.ctx || !T.playing() || !T.S) return { ok: false, state: "stopped", why: "press PLAY first" };
        var now = T.ctx.currentTime, cy = T.cycle(), lead = BENCH_NOW_LEAD_S;
        if (live && live.a && live.a.t0 != null) {
          var lossEnd = live.a.t0 + TUNE_S + live.a.holdS + live.a.lossD;
          if (lossEnd + 0.4 - now > lead) lead = lossEnd + 0.4 - now;   // let the one on the air finish its fade
        }
        var t0 = now + lead;
        benchForce = { reelId: String(reelId), wi: (wi == null ? -1 : +wi), whole: opts.whole !== false };
        var ok = false, why = "";
        try {
          var R = T.S.signal.fork("benchnow:" + Math.floor(now * 1000));
          var na = arm({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: 60, tidePos: 0.5, t0: t0, benchNow: true }, R);
          if (!na) why = "the receiver refused the choice";
          else {
            try { prefetch(na); } catch (e0) {}     // the element is usually already warm; this covers a cold one
            if (!fire(t0)) { na.dead = true; qDrop(na); why = "the seat was refused"; } else ok = true;
          }
        } catch (e) { why = String((e && e.message) || e); }
        benchForce = null;
        if (!ok) return { ok: false, state: "refused", why: why };
        var a = armed || {};
        return { ok: true, state: "seated", now: true, t0: +t0.toFixed(2), inS: +(a.inS || 0).toFixed(2),
          holdS: +(a.holdS || 0).toFixed(2), whole: !!a.whole, reel: a.reel && a.reel.id, leadS: +lead.toFixed(2) };
      },
      // Warm the element for a reel the owner is about to press, so "2 s" is
      // two seconds of tune-in and not two seconds of loading.
      prefetchReel: function (reelId, inS) {
        var v = ensureVideo(0); if (!v) return false;
        var id = String(reelId);
        try {
          if (videoSrcIds[0] !== id) { videoSrcIds[0] = id; v.src = reelUrl(id); v.preload = "auto"; v.load(); }
          var seek = function () { try { v.currentTime = +inS || 0; warmPicture(v); } catch (e) {} };
          if (v.readyState >= 3) seek(); else v.addEventListener("canplay", function once() { try { v.removeEventListener("canplay", once); } catch (e) {} seek(); }, { once: true });
        } catch (e) { return false; }
        return true;
      },
      benchCancel: function () { benchQueued = null; benchForce = null; return true; },
      benchState: function () {
        var T = tl(), now = null;
        try { now = T.ctx ? T.ctx.currentTime : null; } catch (e) {}
        var a = armed;
        return {
          queued: benchQueued ? { reel: benchQueued.reelId, wi: benchQueued.wi, whole: benchQueued.whole } : null,
          armed: a ? { reel: a.reel && a.reel.id, inS: a.inS, holdS: a.holdS, whole: !!a.whole, t0: a.t0,
                       inS_left: (a.t0 != null && now != null) ? +(a.t0 - now).toFixed(1) : null } : null,
          live: !!live, playing: (function () { try { return tl().playing(); } catch (e) { return false; } })(),
          scene: (function () { try { var sc = tl().scene(); return sc ? sc.type : null; } catch (e) { return null; } })(),
          pool: poolState, poolSize: pool ? pool.length : 0,
          limits: { wholeMaxHoldS: WHOLE_MAX_HOLD_S }
        };
      },
    },
  };
})();

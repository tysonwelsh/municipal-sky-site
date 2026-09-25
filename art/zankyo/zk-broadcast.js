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
  var GEO_URL = "broadcast/geo.json";
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
  // geo.json rides the page's asset fingerprint the way the manifest does: it
  // is one file, rebuilt whenever the pool is, and index.php lists it.
  function geoUrl() {
    var v = null;
    try { v = window.ZK_ASSET_V || null; } catch (e) {}
    return v ? GEO_URL + "?v=" + encodeURIComponent(v) : GEO_URL;
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
  // Q0: the static that covers a media element running dry mid-reception, on
  // the same scale as DROP_HISS (relative to the reception's own envelope)
  var STALL_HISS = 0.4;

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
  var SHAPES_ON = true;

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
  // §7 q5 — THE MANUAL PATHS DRAW A SHAPE TOO. The ♪ audition, the 選局 scan
  // and the tuning dial are how the owner finds out what a signal is, and what
  // a signal is has changed. They draw from the same table on whatever stream
  // they already use, so a manual seat is as reproducible as a planned one.
  function manualShape(R) {
    var r = [], i;
    for (i = 0; i < SHAPE_DRAWS; i++) r.push(R.next());
    return drawShape(r);
  }
  // §4.1 THE LADDER AT PLAN TIME. A shaped reception needs more room than a
  // plain one — 戻's two gaps alone are six to thirty seconds — so a seating
  // that simply LOSES what will not fit ends up seating mostly 常, and the
  // owner's "one reception in three is shaped" quietly becomes one in six.
  // MEASURED before this existed: 24 shaped draws of 144 seated receptions,
  // 17 %, against the 33 % §3.6 asks for. So the seating walks the same ladder
  // the receiver walks: the shape gives up its parts in order rather than
  // giving up its seat. Returns null when there is nothing left to give.
  function shrinkShape(sh) {
    var s2 = { budgetS: sh.budgetS, body: sh.body, entry: sh.entry, exit: sh.exit, entryS: sh.entryS, exitS: sh.exitS,
      gaps: sh.gaps.slice(), holes: sh.holes.slice(), pieces: sh.pieces, lockS: sh.lockS,
      leadS: sh.leadS, holdLeadS: sh.holdLeadS, tailS: sh.tailS, silS: sh.silS, fell: (sh.fell || []).slice() };
    var what = null;
    if (s2.pieces > 2) { s2.pieces = 2; s2.gaps = s2.gaps.slice(0, 1); what = "second return"; }
    else if (s2.holes.length > 1) { s2.holes = s2.holes.slice(0, 1); what = "second hole"; }
    else if (s2.exit === "zan") { s2.exit = "setsu"; s2.exitS = LOSS_MIN_S + LOSS_SPAN_S * 0.5; what = "the lingering exit"; }
    else if (s2.entry !== "soku") { s2.entry = "soku"; s2.entryS = TUNE_S; what = "the hunt"; }
    else if (s2.body !== "jou") { s2.body = "jou"; s2.gaps = []; s2.holes = []; s2.pieces = 1; what = "the shape"; }
    else if (s2.budgetS > BUDGET_MIN_S + 2) { s2.budgetS = Math.max(BUDGET_MIN_S, s2.budgetS * 0.7); what = "some of the budget"; }
    else return null;
    s2.fell.push(what);
    var gapS = 0, i;
    for (i = 0; i < s2.gaps.length; i++) gapS += s2.gaps[i] + (s2.body === "modori" ? MOD_RELOCK_S : 0);
    var holeS = 0; for (i = 0; i < s2.holes.length; i++) holeS += s2.holes[i];
    s2.spanS = s2.entryS + s2.budgetS + gapS + holeS + s2.exitS;
    s2.reachS = s2.spanS + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S);
    return s2;
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
  // WHAT THE ARRIVAL AND THE DEPARTURE COST THE WINDOW. A reception's entry and
  // exit are wall time; only part of them is time the REEL is running, and that
  // part is all the window has to pay for.
  //   即 the snap  — 0.4 s, as it always was: the reel is under the tune-in.
  //   浮 the drift — the last three seconds. The signal surfaces over six to
  //     ten, but below a tenth of peak there is nothing on the window to hear,
  //     so the reel joins for the audible part and the static carries the rest.
  //   探 the hunt  — 0.4 s. The hunt is the DIAL, not the station: the glimpses
  //     are bursts of the band's own noise and the picture tearing out of the
  //     snow, and the station itself arrives at the lock. Paying for the whole
  //     hunt out of a 12 s window would cost eight seconds of broadcast to hear
  //     four bursts of static, which is the wrong trade in both directions.
  // The EXIT is capped at three seconds for the same reason: past that the
  // envelope is under 20 % of peak and falling, and the reel running off the
  // end of its window there is the tolerance §11.2 already documents for the
  // loss ramp — stated here rather than discovered later.
  var ENTRY_COST = { soku: TUNE_S, tan: TUNE_S, fu: 3 }, EXIT_MAX_COST_S = 3;
  // Q0 r2 — …EXCEPT THAT 残 IS NOT UNDER 20 %. The cap above is true of 切,
  // whose whole ramp is 1.6–2.8 s. A 残 holds 75 % of peak for half its 6–12 s
  // and 44 % a quarter later: the envelope is at or above HALF of peak for the
  // first 70 % of it (0.5 + 0.25 × 0.25 / 0.31). Capped at three seconds, a
  // 12 s window "served" an 8.6 s hold and a 12 s linger, the reel ran off the
  // window's edge four to nine seconds into the linger, and the page faded it
  // out there (below) — measured by the critic, 5.2–8.0 s of band static at
  // envelope 0.81–0.86 where the station was meant to be lingering (4 of 31
  // receptions). So a 残 costs the window its AUDIBLE part. That makes the
  // window selection walk to a window that can carry the linger — 224 of the
  // 252 reels have one of 16 s or more — and makes the degrade ladder give up
  // the linger where none can, which is the ladder's own second rung. It moves
  // the plan of every 残 that took a short window: a declared re-base (Q0 r2).
  var EXIT_AUDIBLE = 0.7;
  function exitCost(exit, exitS) { return exit === "zan" ? Math.max(Math.min(exitS, EXIT_MAX_COST_S), EXIT_AUDIBLE * exitS) : Math.min(exitS, EXIT_MAX_COST_S); }
  function entryCostOf(P) { return Math.min(P.entryS, ENTRY_COST[P.entry] != null ? ENTRY_COST[P.entry] : TUNE_S); }
  function exitCostOf(P) { return exitCost(P.exit, P.exitS); }
  function planTimes(P) {
    var cur = P.entryS, on = 0, i;
    for (i = 0; i < P.segments.length; i++) {
      var s = P.segments[i];
      if (i > 0) { P.gaps[i - 1].atS = cur; cur += P.gaps[i - 1].durS; }
      s.lockAtS = cur; cur += (s.lockS || 0);
      s.atS = cur;
      // 断 A HOLE IS WALL TIME THAT IS NOT ON-AIR TIME. The reel keeps running
      // through it — no seek, honest time, it comes back where it would be — so
      // the piece OCCUPIES onS + its holes and CONTRIBUTES onS.
      cur += s.onS + (s.holeS || 0); on += s.onS;
      // The source joins where the reel becomes audible — under the tune-in for
      // a snap, three seconds into a drift, at the lock after a hunt — and at
      // the relock for every piece after the first.
      s.srcFromS = (i === 0) ? Math.max(0, P.entryS - entryCostOf(P)) : s.lockAtS;
    }
    P.lossAtS = cur;
    P.spanS = cur + P.exitS;
    P.presenceS = on;
    for (i = 0; i < P.segments.length; i++) {
      // (+0.15 past a piece that a gap follows: the carrier takes 0.12 s to
      // leave, and a decoded piece stopped at +0.05 was cut off at 56 % of
      // peak halfway down that ramp — Q0, a 走 audition, slow 4G)
      P.segments[i].srcToS = (i === P.segments.length - 1) ? P.spanS + 0.2 : P.segments[i].atS + P.segments[i].onS + 0.15;
    }
    return P;
  }
  // §3 THE SHAPE, CUT FROM THE REEL. The seating drew what the reception DOES
  // (§4.1); this is where the doing meets a particular window of a particular
  // reel, which is the only place it can be decided. F is a FORK of the signal
  // stream — pj2-rand derives a fork from the ORIGINAL seed and consumes
  // nothing from its parent — so every draw here is free: the six draws
  // choose() has always taken, and weather()'s schedule, stay exactly where
  // they were. What moves a night is the SHAPE, which is the point, and not a
  // shift in the stream, which would not be.
  //
  // DEGRADE, NEVER REFUSE (§4.1). A budget too small to carry its body, a
  // window with no later moment left in it, a pool with no second reel for a
  // scan — each loses the part it cannot have and keeps the rest, down to a
  // plain hold. A reception always happens.
  function planShaped(sh, F, o) {
    var reel = o.reel, win = o.win, rate = o.rate || 1, onS = o.onS, exitS = o.exitS;
    var body = sh.body, entry = sh.entry;
    var P = { body: body, entry: entry, exit: sh.exit, entryS: sh.entryS, exitS: exitS,
      segments: [], gaps: [], holes: [], porous: null, callback: false, glimpses: null, reel2: null };
    // 探 THE HUNT: two to four glimpses of the picture and a syllable flickering
    // out of the snow before it locks. Not on-air time — they are the arrival.
    if (entry === "tan" && P.entryS > 1) {
      var ng = HUNT_GLIMPSE_MIN + Math.floor(F.next() * (HUNT_GLIMPSE_MAX - HUNT_GLIMPSE_MIN + 1));
      P.glimpses = [];
      for (var gj = 0; gj < ng; gj++) {
        var gd = 0.3 + F.next() * 0.5;
        var gat = 0.25 + ((gj + F.next() * 0.7) / ng) * Math.max(0.1, P.entryS - gd - 0.4);
        P.glimpses.push([+gat.toFixed(3), +gd.toFixed(3)]);
      }
      P.glimpses.sort(function (a, b) { return a[0] - b[0]; });
    }
    if (body === "modori") {
      // 戻 THE RETURN. A piece of three to ten seconds, the carrier lost, then
      // the SAME broadcast again LATER IN THE SOURCE — the in-point advances by
      // the gap × 1–3 (time collapsing: the transmission went on while we lost
      // it), or, when the window has no room left, the reel's NEXT window,
      // which is a genuinely later moment because the windows are cut in source
      // order. If neither is available this is a plain hold instead, which is
      // also what makes the "always later" assertion in the harness true by
      // construction rather than by luck.
      // HOW THE BUDGET IS CUT. Each piece has to fit its own window, so the
      // ceiling on a piece is what the window can carry after that piece's own
      // ends (the entry for the first, the relock for the rest, the exit for
      // the last). Within that, the FIRST piece is the owner's example — "a
      // piece of 3–10 s, then the carrier lost" — and what is left is shared
      // across the pieces that follow, evenly enough that none of them is a
      // fragment and the sum is still the budget.
      var want = Math.min(sh.pieces, 1 + sh.gaps.length), cuts = [], leftOn = onS, k;
      var wlHere = win[1] - win[0], ecHere = entryCostOf(P), xcHere = exitCost(sh.exit, exitS);
      var capFirst = Math.max(MOD_PIECE_MIN_S, wlHere - ecHere);
      var capMid = Math.max(MOD_PIECE_MIN_S, wlHere - MOD_RELOCK_S);
      var capLast = Math.max(MOD_PIECE_MIN_S, wlHere - MOD_RELOCK_S - xcHere);
      var p0 = Math.min(capFirst, MOD_PIECE_MIN_S + F.next() * (MOD_PIECE_MAX_S - MOD_PIECE_MIN_S));
      // …but never so small that what follows cannot fit in the windows it has
      var restCap = capLast + Math.max(0, want - 2) * capMid;
      if (leftOn - p0 > restCap) p0 = Math.min(capFirst, leftOn - restCap);
      p0 = Math.max(MOD_PIECE_MIN_S, Math.min(p0, leftOn - MOD_PIECE_MIN_S * (want - 1)));
      cuts.push(p0); leftOn -= p0;
      for (k = 1; k < want; k++) {
        var share = (k === want - 1) ? leftOn : leftOn / (want - k);
        var capK = (k === want - 1) ? capLast : capMid;
        var pc = Math.max(MOD_PIECE_MIN_S, Math.min(capK, share));
        cuts.push(pc); leftOn -= pc;
      }
      if (leftOn > 0.05) cuts[cuts.length - 1] += Math.min(leftOn, Math.max(0, capLast - cuts[cuts.length - 1]));
      var wi = o.wi, ok = true;
      for (k = 0; k < cuts.length; k++) {
        var lockS = k === 0 ? 0 : MOD_RELOCK_S;
        var needK = (k === 0 ? P.entryS : lockS) + cuts[k] + (k === cuts.length - 1 ? exitS : 0);
        if (k === 0) { P.segments.push({ inS: o.inS, onS: cuts[k], reel: reel, lockS: 0 }); continue; }
        var gapS = sh.gaps[k - 1], adv = MOD_ADV_MIN + F.next() * (MOD_ADV_MAX - MOD_ADV_MIN);
        var prev = P.segments[k - 1];
        var used = (k - 1 === 0 ? P.entryS : MOD_RELOCK_S) + prev.onS + (prev.holeS || 0);
        var nextIn = prev.inS + (used + gapS * adv) * rate;
        if (nextIn + needK * rate <= win[1]) {
          P.segments.push({ inS: nextIn, onS: cuts[k], reel: reel, lockS: lockS, laterS: +(gapS * adv).toFixed(1), sameWindow: true });
        } else {
          var nj = -1, nb = -1, wq, lq;
          for (wq = wi + 1; wq < reel.windows.length; wq++) {
            if (wholeAt(reel, wq)) continue;
            lq = reel.windows[wq][1] - reel.windows[wq][0];
            if (lq >= needK * rate && lq > nb) { nb = lq; nj = wq; }
          }
          if (nj < 0) { ok = false; break; }
          var laterS = null;
          try { if (reel.srcWindows && reel.srcWindows[nj] && reel.srcWindows[wi]) laterS = +(reel.srcWindows[nj][0] - reel.srcWindows[wi][1]).toFixed(0); } catch (e) {}
          P.segments.push({ inS: reel.windows[nj][0], onS: cuts[k], reel: reel, lockS: lockS, laterS: laterS, sameWindow: false });
          wi = nj; win = reel.windows[nj];
        }
      }
      if (!ok || P.segments.length < 2) return planOneFit(reel, o, onS, exitS, sh.exit);
      for (k = 0; k < P.segments.length - 1; k++) P.gaps.push({ durS: sh.gaps[k], sweep: false });
    } else if (body === "sou") {
      // 走 THE SCAN: the first station is lost, the dial sweeps, a second locks.
      // The second reel is drawn from the SAME candidate list the first came
      // from, so it takes the recent ring and the tide weighting too. Each
      // piece is at least SCAN_PIECE_MIN_S; a budget that cannot carry two
      // locks stays one.
      var wlS = win[1] - win[0], ecS = entryCostOf(P), xcS = exitCost(sh.exit, exitS);
      var capA = Math.max(SCAN_PIECE_MIN_S, wlS - ecS);
      var half = Math.min(capA, SCAN_PIECE_MIN_S + F.next() * Math.max(0, onS - 2 * SCAN_PIECE_MIN_S));
      if (onS - half > capA) half = Math.max(SCAN_PIECE_MIN_S, onS - capA);
      var r2 = o.pickOther ? o.pickOther(F.next()) : null;
      var need2 = onS - half + xcS;
      var w2 = -1, w2b = -1, v2, l2b;
      if (r2) for (v2 = 0; v2 < r2.windows.length; v2++) {
        if (wholeAt(r2, v2)) continue;
        l2b = r2.windows[v2][1] - r2.windows[v2][0];
        if (l2b >= need2 && l2b > w2b) { w2b = l2b; w2 = v2; }
      }
      if (onS < 2 * SCAN_PIECE_MIN_S || !r2 || w2 < 0) return planOneFit(reel, o, onS, exitS, sh.exit);
      P.segments.push({ inS: o.inS, onS: half, reel: reel, lockS: 0 });
      P.segments.push({ inS: r2.windows[w2][0] + F.next() * Math.max(0, w2b - need2), onS: onS - half, reel: r2, lockS: 0 });
      P.gaps.push({ durS: sh.gaps[0], sweep: true });
      P.reel2 = r2;
    } else if (body === "dan") {
      // 断 THE BROKEN CARRIER: one piece with one or two real losses in it. Not
      // a dropout — the band narrows, the voice ducks under rising static, the
      // picture tears and rolls, and it comes back WHERE IT WOULD BE.
      var hs = sh.holes.slice(), tot = 0, hz;
      for (hz = 0; hz < hs.length; hz++) tot += hs[hz];
      if (onS < 6 || !hs.length) return planOneFit(reel, o, onS, exitS, sh.exit);
      P.segments.push({ inS: o.inS, onS: onS, reel: reel, lockS: 0, holeS: tot });
      // placed inside the piece, in order, never within 1.5 s of an end or of
      // each other — a hole at the very edge reads as the entry or the exit
      var room = onS + tot - 3, at = 1.5;
      for (hz = 0; hz < hs.length; hz++) {
        var slot = room / hs.length;
        var pos = at + F.next() * Math.max(0, slot - hs[hz] - 1.5);
        P.holes.push({ durS: hs[hz], relS: pos });
        at = pos + hs[hz] + 1.5;
      }
    } else {
      P.segments.push({ inS: o.inS, onS: onS, reel: reel, lockS: 0 });
    }
    planTimes(P);
    for (var hh = 0; hh < P.holes.length; hh++) P.holes[hh].atS = +(P.segments[0].atS + P.holes[hh].relS).toFixed(3);
    return P;
  }
  // A RECEPTION FROM ITS SHAPE.
  function planFor(sh, reel, inS, onS, exitS, F, o) {
    if (!sh) return planOne(reel, inS, onS, exitS);
    if (sh.body === "jou" || !F) {
      var P = planOne(reel, inS, onS, exitS);
      P.entry = sh.entry; P.entryS = sh.entryS; P.exit = sh.exit; planTimes(P);
      if (F && sh.entry === "tan") { var Q = planShaped(sh, F, o); return Q; }
      return P;
    }
    return planShaped(sh, F, o);
  }
  // Q0 — THE FALLBACK HOLD MUST FIT ITS WINDOW. When a 戻 finds no later
  // moment, a 走 no second station or a 断 no room, planShaped falls back to a
  // plain hold — carrying the budget the SHAPE was sized for. choose() sized
  // that budget with windowServes(), which for 戻 and 走 is two or three
  // windows' worth, so the one piece that was left ran straight off the end of
  // its window at full level: into the next window of the file (a jump cut)
  // and, on a reel's last window, off the end of the file into silence with
  // the envelope still open. Measured on the probe: a 26 s hold on a 19 s
  // window — 7.3 s of nothing, env 1.0; a 28 s hold on 18.7 s — three jump
  // cuts. The degrade ladder's own rule is that a plain hold is what ONE
  // window serves (§4.1: "a plain hold of 8.8 s fits any 12 s window"), so the
  // fallback now holds that. This moves the plan — a shorter hold, a shorter
  // span — on exactly the receptions that took this path, and nowhere else.
  //
  // Q0 r2 — AND ITS EXIT IS THE EXIT IT SAYS IT IS. planOne() below writes
  // 切 on every plain hold, and the fallback handed it the SHAPE's exitS — so
  // a 残 that fell back was labelled 切 and still lingered 6–12 s, fitted
  // against a three-second exit. Measured by the critic: an audition labelled
  // 即常切 with exitS 11.0 on a 12 s window, 8.0 s of band static where the
  // reel should have been. The exit now goes with the label. A 絶 keeps its
  // cut (0.02 s: nothing to fit). A 残 is kept where the window carries its
  // audible part and a hold at the §2 floor, as the ladder would keep it;
  // otherwise it becomes 切 at the loss choose() drew in the 切 range (o.lossD,
  // rLoss — a draw already taken, so nothing moves in the stream). A re-base on
  // exactly the rc.92 path, declared with it.
  function planOneFit(reel, o, onS, exitS, exit) {
    var w = o.win || windowOf(reel, o.inS), rate = o.rate || 1;
    exit = exit || "setsu";
    if (exit === "zan") {
      var room = w ? (w[1] - o.inS) / rate - TUNE_S : Infinity;
      if (room - exitCost("zan", exitS) < Math.min(onS, BUDGET_MIN_S)) { exit = "setsu"; exitS = o.lossD != null ? o.lossD : Math.min(exitS, LOSS_MIN_S + LOSS_SPAN_S); }
    }
    if (w) {
      var fit = (w[1] - o.inS) / rate - TUNE_S - exitCost(exit, exitS);
      if (onS > fit) onS = Math.max(3, fit);
    }
    var P = planOne(reel, o.inS, onS, exitS);
    P.exit = exit;   // (the timeline reads exitS alone; for 絶 and a kept 残 the label is the only difference)
    return P;
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
  // THE TUNING ENVELOPE AS A LIST OF DURATIONS, walked from the plan. One
  // builder for the air and for the ♪ audition, because the audition's whole
  // job is to show what a signal IS (§7 q5) and an audition with its own
  // envelope would drift away from the thing it is auditioning.
  function planEnv(P, peak) {
    var env = [], eAcc = 0, eg, i;
    if (P.entry === "tan" && P.glimpses && P.glimpses.length) {
      // 探 THE HUNT: the dial hunting. Each glimpse is a syllable out of the
      // snow — a short rise to a fraction of peak and straight back down — and
      // then the station locks at the end of the entry.
      for (eg = 0; eg < P.glimpses.length; eg++) {
        var ga = P.glimpses[eg][0], gdur = P.glimpses[eg][1];
        env.push([Math.max(0.01, ga - eAcc), 0]);
        env.push([0.05, peak * 0.55]);
        env.push([Math.max(0.02, gdur - 0.1), peak * 0.5]);
        env.push([0.05, 0]);
        eAcc = ga + gdur;
      }
      env.push([Math.max(0.02, P.entryS - eAcc), 0]);
      env.push([0.25, peak * 0.85]);
      env.push([Math.max(0, P.segments[0].onS - 0.25 - 1.0), peak]);
      env.push([1.0, peak]);
    } else if (P.entry === "fu") {
      // 浮 THE DRIFT-IN: no snap at all. The signal surfaces from under the
      // static over the whole entry, a curve rather than a ramp.
      env.push([P.entryS * 0.45, peak * 0.10]);
      env.push([P.entryS * 0.35, peak * 0.42]);
      env.push([P.entryS * 0.20, peak * 0.85]);
      env.push([1.0, peak]);
      env.push([Math.max(0, P.segments[0].onS - 1.0), peak]);
    } else {
      env.push([P.entryS, peak * 0.85]);
      env.push([1.0, peak]);
      env.push([Math.max(0, P.segments[0].onS - 1.0), peak]);
    }
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
    return env;
  }
  // What the set and the harness are handed: the shape, in plain numbers, with
  // no reel objects in it.
  function planWire(P) {
    var segs = [], i;
    for (i = 0; i < P.segments.length; i++) segs.push({ atS: +P.segments[i].atS.toFixed(3), onS: +P.segments[i].onS.toFixed(3), lockS: P.segments[i].lockS || 0,
      inS: +P.segments[i].inS.toFixed(3), laterS: P.segments[i].laterS != null ? P.segments[i].laterS : null,
      reel: (P.segments[i].reel && P.segments[i].reel.id) || null, holeS: P.segments[i].holeS || 0 });
    var gaps = []; for (i = 0; i < P.gaps.length; i++) gaps.push({ atS: +P.gaps[i].atS.toFixed(3), durS: +P.gaps[i].durS.toFixed(3), sweep: !!P.gaps[i].sweep });
    var holes = []; for (i = 0; i < P.holes.length; i++) holes.push({ atS: +P.holes[i].atS.toFixed(3), durS: +P.holes[i].durS.toFixed(3) });
    return { body: P.body, entry: P.entry, exit: P.exit, entryS: +P.entryS.toFixed(3), exitS: +P.exitS.toFixed(3),
      lossAtS: +P.lossAtS.toFixed(3), spanS: +P.spanS.toFixed(3), presenceS: +P.presenceS.toFixed(3),
      budgetS: P.budgetS != null ? +P.budgetS.toFixed(2) : null, fell: P.fell || null, segments: segs, gaps: gaps, holes: holes,
      glimpses: P.glimpses || null, porous: P.porous || null, callback: !!P.callback };
  }
  // a 50 ms silent MP4: the media element is "primed" with it inside the PLAY
  // gesture (the ▶ play event is emitted synchronously from the click), so
  // later timer-driven play() calls are allowed where autoplay policy would
  // otherwise refuse (iOS). Replaced at build time by the real bytes.
  var PRIME_SRC = "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAxZtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAB9AAAABkAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACQXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAABkAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAZAAAAQAAAEAAAAAAbltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAB9AAAAFkFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFkbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEoc3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAB9AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAA+gAAAECQWAgIAFFYhW5QAGgICAAQIAAAAUYnRydAAAAAAAAA+gAAAECQAAACBzdHRzAAAAAAAAAAIAAAABAAAEAAAAAAEAAAGQAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAAAEwAAAAQAAAAUc3RjbwAAAAAAAAABAAADQgAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAACAAAAAQAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDEAAAAIZnJlZQAAAB9tZGF03ABMYXZjNjMuMS4xMDEAAjBADgEYIAc=";

  function tl() { return Z._signal.tools(); }
  function db2lin(db) { return Math.pow(10, (+db || 0) / 20); }
  // the reels' own sound, a tenth down on every reception and every 受信
  // press (owner, 2026-09-24: "turn down the volume of the video clips by
  // 10 %"). The noise around a reception keeps its level.
  var REEL_VOL = 0.9;

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
  //
  // Q0 (rc.93): THIS IS NOW THE DEFAULT PATH, for a second reason that has
  // nothing to do with Bluetooth. The element's own pipeline is what chops
  // when the machine is busy: measured with _rx-probe.js on the owner's
  // laptop at a load average of 26–35, element-fed receptions went silent for
  // 30–280 ms at a time with the reel wholly buffered (`waiting`,
  // readyState 2), and every element start and seek rides a main-thread timer
  // that ran up to 0.9 s late in a busy kyū. A BufferSource is started on the
  // audio clock by the audio thread and has neither problem. The cost, also
  // measured: the whole reel must be fetched and decoded before decide(), and
  // a 受信 press that seats a reception 4.9 s out on a slow-4G line (180 KB/s)
  // cannot do that for a 1 MB reel — it falls back to the gagaku, the
  // graceful path, where the element would have played. `?reels=element`
  // brings the old path back.
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
  var benchForce = null, benchQueued = null, benchWholeOverride = null, benchShape = null;
  // 1.5 s, not 2.0. MEASURED: at a 2.0 s lead the press-to-SOUND latency in
  // WebKit was 2.97 s — the lead plus the tune-in ramp climbing to audibility —
  // which passes a 3 s gate by thirty milliseconds, i.e. by luck. The element is
  // pre-warmed by prefetchReel when the reel is chosen and after every seat, so
  // the lead only has to cover fire()'s scheduling and the lane's 0.25 s
  // lookahead. 1.5 s lands it near 2.4 s with real margin.
  var BENCH_NOW_LEAD_S = 1.5;   // press → tune-in, the bench default
  function pinnedId() {
    try { var ZA = window.ZankyoAudio; return (ZA && ZA.getRoute && ZA.getRoute().pinnedReel) || null; } catch (e) { return null; }
  }
  function pinnedReel() {
    var id = pinnedId(); if (!id || !pool) return null;
    for (var i = 0; i < pool.length; i++) if (pool[i].id === id) return pool[i];
    return null;
  }
  function reelsBuffered() {
    // (window.ZankyoAudio, never the bare name: under _harness.js and _probe.js
    // the page's window is not Node's global, the bare name threw, and every
    // run there was element mode whatever the route said — Q0)
    if (demoted) return false;
    try { var ZA = window.ZankyoAudio; return !!(ZA && ZA.getRoute && ZA.getRoute().reelsMode === "buffer"); } catch (e) { return false; }
  }
  // Q0 r2 — A DECODER THAT REFUSES A REEL DEMOTES THE PAGE. The decoded path
  // is the default since rc.93 and is unmeasured in Safari, the owner's
  // browser: if WebKit's decodeAudioData ever refuses a reel, every reception
  // of it would fall back to the gagaku, for the whole night. A decoded page
  // has never handed an element to createMediaElementSource (the one call that
  // cannot be undone), so it can still become an element page: the first
  // refusal switches the receiver to element mode for the rest of the session
  // — every later reception, and an armed one whose decode was the refusal,
  // sounds through its element as ?reels=element does. Counted in stats,
  // written to the console once; nothing on the tube or the VFD says so.
  var demoted = null;
  function demote(id, why) {
    if (demoted) return;
    demoted = { id: id, why: String(why || ""), t: (function () { try { return +tl().ctx.currentTime.toFixed(2); } catch (e) { return null; } })() };
    stats.demoted = demoted;
    try { console.warn("ZANKYŌ: the browser could not decode reel " + id + " (" + demoted.why + ") — reels play through their media elements for the rest of this session"); } catch (e) {}
  }
  // …and an element that is given to the graph gets its voice back: after
  // createMediaElementSource its sound goes to the graph, not to the speakers,
  // so this is the only moment it is safe to unmute it.
  function unhushElement(v) {
    if (!v) return;
    try { v.muted = false; v.defaultMuted = false; v.removeAttribute("muted"); v.volume = 1; } catch (e) {}
    try { var at = v.audioTracks; if (at && at.length) for (var i = 0; i < at.length; i++) { try { at[i].enabled = true; } catch (e2) {} } } catch (e3) {}
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
  // A value already in hand, as a thenable that answers AT ONCE. In a browser
  // it behaves as a resolved promise that does not wait for the microtask
  // queue; under _harness.js and _probe.js, whose virtual clock never lets the
  // stack empty, it is the difference between a decoded reel and a reel that
  // is never ready (Q0: the harness could not see ?reels=buffer at all).
  function nowThen(v) {
    return { then: function (ok) { try { var r = ok ? ok(v) : v; return (r && typeof r.then === "function") ? r : nowThen(r); } catch (e) { return Promise.reject(e); } },
             catch: function () { return this; } };
  }
  // Q0 r3 — WHAT A REEL COSTS HERE: audio seconds per byte of the fetches so
  // far (spb: the average, spbLast: the last) and the decode (dec, decLast).
  // Before any is measured, a conservative 1 MB/s and 0.3 s.
  var reelNet = { spb: 1e-6, spbLast: 1e-6, n: 0, dec: 0.3, decLast: 0.3, nd: 0 };
  var bytesIn = {}, bytesWait = {};
  function onReelBytes(id, cb) { if (bufCache[id] || bytesIn[id]) { cb(); return; } (bytesWait[id] = bytesWait[id] || []).push(cb); }
  function decodeReel(id, ctx) {
    if (bufCache[id]) return nowThen(bufCache[id]);
    if (bufPending[id]) return bufPending[id];
    if (!hasFetch || !ctx || typeof ctx.decodeAudioData !== "function") return Promise.reject(new Error("no decoder"));
    var clk = function () { try { return ctx.currentTime; } catch (e) { return 0; } }, f0 = clk(), f1 = null;
    var pr = fetch(reelUrl(id)).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.arrayBuffer();
    }).then(function (ab) {
      // Q0 r3: what the fetch took, for audEta — and the bytes announced, so
      // the audition's picture can read them from the cache beside the decode
      f1 = clk();
      if (ab && ab.byteLength > 1e5 && f1 > f0) { var spb = (f1 - f0) / ab.byteLength; reelNet.spbLast = spb; reelNet.spb = reelNet.n ? reelNet.spb + 0.35 * (spb - reelNet.spb) : spb; reelNet.n++; }
      bytesIn[id] = true; var bw = bytesWait[id]; delete bytesWait[id];
      if (bw) for (var bi = 0; bi < bw.length; bi++) { try { bw[bi](); } catch (e0) {} }
      // Safari has only recently had the promise form; the callback form is
      // the one both engines have always had, so ask for it explicitly. A
      // decoder that answers inside the call (the harness's) is taken at its
      // word; a real one is waited for. The promise the modern form ALSO
      // returns is caught, or its rejection is reported a second time.
      var got = null, bad = null, w = null;
      var refused = function (e) { var x = new Error("decode refused: " + ((e && (e.message || e.name)) || e || "?")); x.zkDecode = true; return x; };
      var rp = ctx.decodeAudioData(ab, function (b) { got = b; if (w) w.res(b); }, function (e) { bad = refused(e); if (w) w.rej(bad); });
      if (rp && typeof rp.catch === "function") rp.catch(function () {});
      if (got) return got;
      if (bad) throw bad;
      return new Promise(function (res, rej) { w = { res: res, rej: rej }; });
    }).then(function (buf) {
      if (f1 != null) { var dd = Math.max(0, clk() - f1); reelNet.decLast = dd; reelNet.dec = reelNet.nd ? reelNet.dec + 0.35 * (dd - reelNet.dec) : dd; reelNet.nd++; }
      stats.reelNet = { kBps: +(1 / Math.max(1e-9, reelNet.spb) / 1000).toFixed(0), dec: +reelNet.dec.toFixed(2) };
      bufCache[id] = buf; bufOrder.push(id);
      while (bufOrder.length > 2) { var old = bufOrder.shift(); if (old !== id) delete bufCache[old]; }
      delete bufPending[id];
      return buf;
    }, function (e) {
      delete bufPending[id]; delete bytesWait[id];
      if (e && e.zkDecode) demote(id, e.message);             // the decoder's refusal, never the network's
      throw e;
    });
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
  //
  // Q0 (2026-09-24) — "n + 2 reuses n's element, which finished long before"
  // WAS NOT TRUE, and the owner heard what it cost. Two things broke it:
  //   1. the ARM order is not the air order. A reception armed 55 s out owns
  //      its element from that moment, and a manual seat (the bench, the dial)
  //      can arm and air in between; the next arm then took the element of the
  //      reception still waiting, loaded its own reel into it, and the first
  //      one went to air playing the second one's file. Measured on the probe:
  //      two receptions on one element, one of them 20 s of silence under a
  //      full envelope when the other's teardown paused the element.
  //   2. the AUDITION borrowed element 0 whatever it was doing. A press of 受信
  //      while a broadcast is armed (for 55 s before every one of them) is
  //      answered by an audition — on element 0, which is the armed
  //      reception's half the time. Its src swap, its seeks and its teardown's
  //      pause() then landed on a broadcast: the audio of a reception chopping
  //      in and out, which is the owner's report.
  // So: an arm takes an element NO queued or live reception holds (freeElem),
  // and the audition has an element of its own (AUD), primed with the pair.
  var ELEMS = 2, AUD = 2;
  var videos = [null, null, null], mediaSrcs = [null, null, null], videoSrcIds = [null, null, null], primed = false, elemTurn = 0;
  function elemIx(ix) { ix = ix | 0; return ix === AUD ? AUD : ix % ELEMS; }
  // The element for a new reception: the next in turn that nothing queued or
  // on the air is holding. With two elements and a queue of two (the live one
  // stays in the queue until its teardown) there is always one — unless a
  // third reception is armed, which the placement does not do; then the old
  // alternation stands and the clash is counted, never silent.
  function freeElem(peek) {
    for (var k = 0; k < ELEMS; k++) {
      var ix = (elemTurn + k) % ELEMS, held = false;
      for (var q = 0; q < armedQ.length; q++) if (!armedQ[q].dead && armedQ[q].vidx === ix) { held = true; break; }
      if (!held && live && live.a && live.a.vidx === ix) held = true;
      if (!held) { if (!peek) elemTurn = ix + 1; return ix; }
    }
    if (peek) return elemTurn % ELEMS;
    stats.elemClash = (stats.elemClash || 0) + 1;
    return (elemTurn++) % ELEMS;
  }
  function ensureVideo(ix) {
    ix = elemIx(ix);
    if (videos[ix] || !hasDOM) return videos[ix];
    try {
      var v = document.createElement("video");
      watchSeeks(v);                                         // Q0 r3: every seek's landing time, for picSync
      v.setAttribute("playsinline", ""); v.playsInline = true; v.preload = "none"; v.crossOrigin = "anonymous";
      var buffered = reelsBuffered();
      if (buffered) { v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.volume = 0; }
      else { v.muted = false; v.volume = 1; }
      if (buffered) {
        // a new src brings a new track list; hush it every time one lands
        // (only while the page is decoded: after a demotion the element carries
        // the sound, and a new src must not take its voice away again)
        var hushIf = function () { if (reelsBuffered()) hushElement(v); };
        v.addEventListener("loadedmetadata", hushIf);
        v.addEventListener("loadeddata", hushIf);
        try { if (v.audioTracks && v.audioTracks.addEventListener) v.audioTracks.addEventListener("addtrack", hushIf); } catch (e2) {}
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
    ix = elemIx(ix);
    if (reelsBuffered()) return null;
    if (mediaSrcs[ix] || !videos[ix] || !ctx || typeof ctx.createMediaElementSource !== "function") return mediaSrcs[ix];
    try { mediaSrcs[ix] = ctx.createMediaElementSource(videos[ix]); } catch (e) { mediaSrcs[ix] = null; }
    if (mediaSrcs[ix] && demoted) unhushElement(videos[ix]);   // Q0 r2: a demoted page's element carries the sound from here
    return mediaSrcs[ix];
  }
  function onPlay() {
    loadPool();
    pinUsed = false;          // one pin per night, re-armed by ▶ play

    // ALL THREE elements are primed inside the PLAY gesture, or the second one
    // (or the audition's) would be the first to meet iOS's autoplay policy
    // halfway through a night.
    var any = false;
    for (var ix = 0; ix <= AUD; ix++) {
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

  // ==========================================================================
  // 選局番号 — THE NUMBER ON THE LEDGE (2026-09-17)
  // ==========================================================================
  // The set's middle rocker steps a two-digit readout 00…10 and says nothing
  // about itself, on the faceplate or in the log — that is the owner's whole
  // brief for it. What it does here is narrow, on purpose:
  //
  //   00  the whole pool. The receiver behaves EXACTLY as it did before this
  //       control existed — same weighting, same cooldown, same legality, same
  //       tide. Nothing below runs.
  //   01–10  the lottery's candidate set is filtered to one locale and the
  //       EXISTING weighting runs over what is left. The footprint check, the
  //       cooldown, the recent ring, the callback, the pin and the tide
  //       weighting are untouched — this is one narrowing, in one place, before
  //       the weights are computed.
  //
  // If the narrowed set is empty, or holds nothing that could serve a reception
  // at all, the full set stands: the station must never go silent because of
  // this control. Same if broadcast/geo.json does not load — the number then
  // steps and means nothing, silently, which is exactly today's behaviour.
  //
  // The table is DATA, in one place, keyed by the ISO-3166-1 alpha-2 `country`
  // in geo.json; a reel carrying a `realm` (orbit, moon, deep space) is 10
  // whatever its country says. Verified against the live pool 2026-09-17: of
  // 250 playable reels, 249 place and exactly one — tibetan-ritual-nyingmapa-1971,
  // country "XX" — belongs to no locale and so is reachable only at 00. There
  // is deliberately NO fallback bucket: a country that turns up in a later
  // curation round without a home here becomes unreachable by number, which is
  // a thing the next round should see rather than have folded into a neighbour.
  var LOCALE_MAX = 10, REALM_LOCALE = 10;
  var LOCALE_OF = (function () {
    var t = {
      1: "US CA",                                                                     // NORTH AMERICA
      2: "MX CU BR AR CL CO PE VE",                                                   // LATIN AMERICA
      3: "GB DE FR NL BE AT CH IT ES PT IE DK SE FI GR CY PL CZ HU RO RS AL EE LT UA",// EUROPE
      4: "RU KZ",                                                                     // RUSSIA & CENTRAL ASIA
      5: "IL IR TR IQ JO KW LB SY QA EG DZ TN",                                       // MIDDLE EAST & NORTH AFRICA
      6: "ZA GH NG AO SN TZ CD ET KE ZW",                                             // AFRICA
      7: "IN PK LK",                                                                  // SOUTH ASIA
      8: "JP CN KP KR TW HK MO",                                                      // EAST ASIA
      9: "ID PH SG MY TH VN AU NZ"                                                    // SE ASIA & OCEANIA
    }, out = {}, n, cc, i;
    for (n in t) if (Object.prototype.hasOwnProperty.call(t, n)) {
      cc = t[n].split(" ");
      for (i = 0; i < cc.length; i++) out[cc[i]] = +n;
    }
    return out;                                                                       // 10 = OFF-EARTH, by `realm`
  })();

  var localeN = 0;                       // the number on the readout
  var geoLoc = null, geoState = "idle";  // reel id → locale number; idle | loading | ready | failed
  function loadGeo() {
    if (geoState !== "idle") return;
    if (!hasFetch) { geoState = "failed"; return; }
    geoState = "loading";
    try {
      fetch(geoUrl()).then(function (r) { return r.json(); }).then(function (g) {
        var m = {}, n = 0, id, e, loc;
        for (id in g) {
          if (!Object.prototype.hasOwnProperty.call(g, id) || id === "_meta") continue;
          e = g[id]; if (!e) continue;
          loc = e.realm ? REALM_LOCALE : LOCALE_OF[e.country];
          if (loc) { m[id] = loc; n++; }
        }
        geoLoc = n ? m : null;
        geoState = n ? "ready" : "failed";
      }).catch(function () { geoLoc = null; geoState = "failed"; });      // silent: the number simply means nothing
    } catch (e) { geoLoc = null; geoState = "failed"; }
  }
  function setLocale(n) {
    n = n | 0; if (n < 0) n = 0; if (n > LOCALE_MAX) n = LOCALE_MAX;
    localeN = n;
    loadGeo();                           // a no-op unless the page-load fetch never started
    return localeN;
  }
  // The narrowing. null means "leave the candidates exactly as they are".
  function localeNarrow(cands) {
    if (!localeN || !geoLoc) return null;
    var need = TUNE_S + BUDGET_MIN_S + (LOSS_MIN_S + LOSS_SPAN_S), out = [], ok = false, i, e;
    for (i = 0; i < cands.length; i++) {
      e = cands[i];
      if (geoLoc[e.id] !== localeN) continue;
      out.push(e);
      if (!ok && (wholeAt(e, 0) || longestWindow(e) >= need)) ok = true;   // could this one actually hold a reception?
    }
    return ok ? out : null;
  }
  // …and the file is fetched at page load beside the manifest, so the number
  // bites on the very first press. 40 KB; a failure leaves the number inert and
  // everything else exactly as it was. (It sits HERE, below the vars it reads —
  // a call up beside loadPool() would run before `geoState` was assigned and
  // return silently on its own guard.)
  loadGeo();

  // ---- the recent ring: reels heard in the last RECENT_CYCLES cycles ----
  var recent = [];   // [{ id, cycle }]
  function recentIds(cycle) { var out = {}; for (var i = 0; i < recent.length; i++) if (recent[i].cycle >= cycle - RECENT_CYCLES) out[recent[i].id] = true; return out; }   // heard at cycle c → out for c+1, c+2, c+3 (critic S1 r1: > kept it out two)
  function remember(id, cycle) { recent.push({ id: id, cycle: cycle }); lastCycleSeen = cycle; while (recent.length > 12) recent.shift(); }
  // 同 the callback: the last station heard in THIS cycle, if there was one
  function recentInCycle(cycle) {
    for (var i = recent.length - 1; i >= 0; i--) if (recent[i].cycle === cycle) {
      if (!pool) return null;
      for (var j = 0; j < pool.length; j++) if (pool[j].id === recent[i].id) return pool[j];
      return null;
    }
    return null;
  }
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
  // HOW MUCH ON-AIR TIME A WINDOW CAN SERVE FOR THIS SHAPE — and this is where
  // the shapes stop being decoration and start being the answer to §2.
  //
  // A plain hold is bounded by ONE window: twelve seconds, less the entry and
  // the exit, is 8.8 s of broadcast and that is the whole of what today's pool
  // can give a 常. But 戻 takes its pieces from DIFFERENT in-points of the same
  // window (or from a later window), and 走 takes its second piece from another
  // reel entirely — so each piece is bounded separately and the reception's
  // capacity is the SUM. Two pieces of a twelve-second window carry about
  // 20 s on air; three carry about 32. The owner's spread of 8 to 40 seconds is
  // partly reachable on today's reels after all, through the shapes rather than
  // through the re-cut, and the re-cut (§5) then widens 常 to match.
  //
  // 断 is the one that costs: it keeps a single piece and the reel runs through
  // its holes, so its holes come out of the same window.
  function windowServes(sh, wl, ec, xc) {
    if (!sh || sh.body === "jou") return wl - ec - xc;
    var i, holeS = 0;
    for (i = 0; i < sh.holes.length; i++) holeS += sh.holes[i];
    if (sh.body === "dan") return wl - ec - holeS - xc;
    if (sh.body === "sou") return (wl - ec) + (wl - xc);
    var n = Math.max(2, Math.min(sh.pieces, 1 + sh.gaps.length));
    var cap = (wl - ec) + (wl - MOD_RELOCK_S - xc);
    for (i = 2; i < n; i++) cap += wl - MOD_RELOCK_S;
    return cap;
  }
  // §4.1 DEGRADE, NEVER REFUSE — AND IN THIS ORDER. The seating reserved room
  // for the whole shape; what it could not know is which window the reel would
  // turn out to have. When the window cannot hold the reception at the §2 floor
  // of eight seconds on air, the shape gives up its parts one at a time: the
  // second return, then the lingering exit, then the hunt or the drift, then
  // the return itself. A plain hold of 8.8 s fits any 12 s window, so the
  // ladder always ends somewhere.
  //
  // Today this ladder runs often, because 1 164 of the pool's 1 349 windows are
  // twelve seconds long and an 18 s budget with a 9 s exit needs thirty. As the
  // reels are re-cut (§5) it runs less, and the shapes the owner tuned are the
  // shapes the owner hears. The harness counts how often each rung is taken.
  function degradeShape(sh, wl, lossD) {
    if (!sh) return sh;
    var s2 = { budgetS: sh.budgetS, body: sh.body, entry: sh.entry, exit: sh.exit, entryS: sh.entryS, exitS: sh.exitS,
      gaps: sh.gaps.slice(), holes: sh.holes.slice(), pieces: sh.pieces, lockS: sh.lockS, spanS: sh.spanS, fell: [] };
    var ec = function () { return Math.min(s2.entryS, ENTRY_COST[s2.entry] != null ? ENTRY_COST[s2.entry] : TUNE_S); };
    var xc = function () { return exitCost(s2.exit, s2.exitS); };
    var served = function () { return windowServes(s2, wl, ec(), xc()); };
    var rungs = [
      function () { if (s2.pieces > 2) { s2.pieces = 2; s2.gaps = s2.gaps.slice(0, 1); return "second return"; } if (s2.holes.length > 1) { s2.holes = s2.holes.slice(0, 1); return "second hole"; } return null; },
      function () { if (s2.exit !== "setsu") { s2.exit = "setsu"; s2.exitS = lossD; return "the lingering exit"; } return null; },
      function () { if (s2.entry !== "soku") { s2.entry = "soku"; s2.entryS = TUNE_S; return "the hunt"; } return null; },
      // 断's holes come out of the SAME window as its piece — the reel runs
      // through them, honestly — so on a twelve-second window a three-second
      // loss is three seconds of broadcast the reception cannot have. Shorten
      // the losses before giving up the body: a one-second break in the carrier
      // is still a break in the carrier, and 断 at all is worth more than 断 at
      // its drawn length. (Without this rung 断 was seated four times an hour
      // and aired once: the pool, not the design, was refusing it.)
      function () { if (s2.holes.length && s2.holes[0] > HOLE_MIN_S) { for (var q = 0; q < s2.holes.length; q++) s2.holes[q] = HOLE_MIN_S; return "the losses shortened"; } return null; },
      function () { if (s2.body !== "jou") { s2.body = "jou"; s2.gaps = []; s2.holes = []; s2.pieces = 1; return "the shape"; } return null; }
    ];
    for (var r = 0; r < rungs.length; r++) {
      if (served() >= BUDGET_MIN_S) break;
      var name = rungs[r](); if (name) s2.fell.push(name);
    }
    return s2;
  }
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
    var entryCostS = Math.min(entryS, ENTRY_COST[sh ? sh.entry : "soku"] != null ? ENTRY_COST[sh ? sh.entry : "soku"] : TUNE_S);
    var exitCostS = exitCost(sh ? sh.exit : "setsu", exitS);
    // §3 THE SHAPE'S OWN STREAM. A fork is derived from the ORIGINAL seed and
    // takes nothing from its parent, so everything the receiver drew before the
    // shapes existed — the six draws above, weather()'s schedule in arm() — is
    // exactly where it was. The fork is named for the reception, so two
    // receptions in a cycle get different shapes and the same seed gets the
    // same ones. Its first draw is always the callback, taken whether or not it
    // can be used, so the draws after it never shift.
    var F = R.fork ? R.fork("shape:" + cycle + ":" + Math.round((info && info.t0 != null ? info.t0 : 0) * 10) + ":" + (info && info.n != null ? info.n : 0)) : null;
    var rCall = F ? F.next() : 1;
    var c = { reel: null, win: null, inS: 0, holdS: holdS, lossD: lossD, bell: bell, budgetS: askedS, shape: sh };
    if (!pool || !pool.length) return c;
    var skip = recentIds(cycle), cands = [];
    for (var i = 0; i < pool.length; i++) if (!skip[pool[i].id]) cands.push(pool[i]);
    if (!cands.length) cands = pool;
    // 選局番号: the ledge's number, and the only thing it touches. At 00 this is
    // a no-op; otherwise everything below runs on the narrowed set exactly as
    // it ran on the wide one.
    var narrowed = localeNarrow(cands);
    if (narrowed) cands = narrowed;
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
    var need0 = TUNE_S + BUDGET_MIN_S + (LOSS_MIN_S + LOSS_SPAN_S), served = [];
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
    // 同 THE CALLBACK (§3.4). The most direct answer to "one signal has no
    // relation to the next": when a cycle carries more than one reception, a
    // later one is the SAME station with a later window, one time in four. The
    // station kept the frequency, and a minute later the same voice is back.
    // The recent ring has already excluded this reel from the candidates —
    // that is the ring doing its job — so the callback overrides it the way the
    // pin does, and costs no draw beyond the one already taken.
    if (SHAPES_ON && !c.pinned && !benchForce && rCall < CALLBACK_P) {
      var back = recentInCycle(cycle);
      if (back && back !== reel) { reel = back; c.callback = true; for (i = 0; i < cands.length; i++) if (cands[i] === back) { reelIdx = i; break; } }
    }
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
      var wiBest = -1, wiLong = wi, wl0 = -1, wq, wjj, lq;
      var here = reel.windows[wi][1] - reel.windows[wi][0];
      for (wq = 0; wq < reel.windows.length; wq++) {
        wjj = (wi + wq) % reel.windows.length;
        if (wholeAt(reel, wjj)) continue;
        lq = reel.windows[wjj][1] - reel.windows[wjj][0];
        if (lq > wl0) { wl0 = lq; wiLong = wjj; }
        if (wiBest < 0 && windowServes(sh, lq, entryCostS, exitCostS) >= budgetS) wiBest = wjj;
      }
      if (windowServes(sh, here, entryCostS, exitCostS) < budgetS) wi = (wiBest >= 0) ? wiBest : wiLong;
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
              var chold = wholeAt(cand, cw) ? Math.min(cl, WHOLE_MAX_HOLD_S) : Math.min(budgetS, Math.max(3, cl - entryCostS - holeS - exitCostS));
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
    // §4.1 THE LADDER, walked before the budget is cut. A shape that cannot
    // reach the §2 floor on this window gives up its parts in order rather than
    // giving up its seconds; only when it is a plain hold does the budget
    // itself shrink.
    if (sh && !whole) {
      sh = degradeShape(sh, wl, lossD);
      entryS = sh.entryS; exitS = sh.exitS;
      entryCostS = Math.min(entryS, ENTRY_COST[sh.entry] != null ? ENTRY_COST[sh.entry] : TUNE_S);
      exitCostS = exitCost(sh.exit, exitS);
      holeS = 0; for (var hq = 0; hq < sh.holes.length; hq++) holeS += sh.holes[hq];
      c.fell = sh.fell;
    }
    holdS = budgetS;
    var canServe = windowServes(sh, wl, entryCostS, exitCostS);
    if (whole) {
      // The thought sets the hold, not the budget. rHold and rIn are still
      // CONSUMED above — six draws, always — so a whole reel entering the pool
      // moves no other night's stream.
      holdS = Math.min(wl, WHOLE_MAX_HOLD_S);
    } else if (holdS > canServe) {
      holdS = Math.max(3, canServe);
    }
    // the FIRST piece's share of the window, which is what the in-point below
    // has to leave room for
    var need = entryCostS + (sh && sh.body !== "jou" && sh.body !== "dan" ? Math.min(holdS, wl - entryCostS) : holdS) + (sh && sh.body === "dan" ? holeS : 0) + ((!sh || sh.body === "jou" || sh.body === "dan") ? exitCostS : 0);
    if (need > wl) need = wl;
    c.reel = reel; c.win = win; c.holdS = holdS; c.whole = whole; c.degraded = +(askedS - holdS).toFixed(3);
    // The in-point does carry the rate: `need` wall seconds eat need × r
    // SOURCE seconds, so a sped-up reel starts nearer the window's head. When
    // need × r exceeds the window the in-point pins to the head and the last
    // fraction of a second runs past the edge — inside the loss ramp, where
    // the signal is already under 6 % of peak.
    // From the window's START on a whole reel — there is no slice to place.
    c.inS = whole ? win[0] : win[0] + rIn * Math.max(0, wl - need * tune.rate);
    if (sh) { c.shape = sh; }
    c.entryS = entryS; c.exitS = exitS;
    c.rate = tune.rate; c.pitchHz = tune.pitchHz; c.degHz = tune.degHz; c.cents = tune.cents;
    // THE RECEPTION PLAN. At R0 it is today's clip said in the new grammar —
    // one piece, a snap in, a cut out — and everything downstream reads it
    // instead of the three loose numbers. The shapes of §3 fill it in later
    // without a second code path anywhere.
    // §3 THE SHAPE'S OWN DRAWS, on a fork of the signal stream. A fork is
    // derived from the ORIGINAL seed and takes nothing from its parent, so
    // everything above this line — the six draws, and weather()'s schedule in
    // arm() — is exactly where it was before the shapes existed.
    var self = reel;
    c.rx = planFor(sh, reel, c.inS, holdS, exitS, F, {
      reel: reel, win: win, wi: wi, rate: tune.rate || 1, inS: c.inS, onS: holdS, exitS: exitS, lossD: lossD,   // (lossD: the 切 a fallback hold takes, Q0 r2)
      // 走 draws its second station from the SAME candidate list, so the recent
      // ring and the tide weighting apply to it too. Never the reel it is
      // leaving — a scan that lands back on the same station is not a scan.
      pickOther: function (u) {
        if (cands.length < 2) return null;
        var j = Math.floor(u * cands.length); if (cands[j] === self) j = (j + 1) % cands.length;
        return cands[j];
      }
    });
    c.rx.budgetS = askedS;
    c.rx.fell = (c.fell && c.fell.length) ? c.fell : null;
    // §3.5 THE POROUS HOLD and §3.4 THE CALLBACK are drawn here and USED later:
    // the porous voice by arm(), which leaves it out of the hold; the callback
    // by the reel choice above, through recentInCycle().
    if (F && SHAPES_ON) {
      if (F.next() < POROUS_P && !c.rx.porous) {
        var pu = F.next(), pacc = 0, pv = POROUS_VOICES[0];
        for (var pq = 0; pq < POROUS_VOICES.length; pq++) { pacc += POROUS_W[pq]; if (pu < pacc) { pv = POROUS_VOICES[pq]; break; } }
        c.rx.porous = pv;
      }
      c.rx.callback = !!c.callback;
    }
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
      vidx: freeElem(), holdId: "signal:" + info.cycle + ":" + (++rxSeq),
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
    // §3.5 THE GAPS ARE RELEASED. A reception's hold is the SPANS its pieces
    // occupy, not one block from the first static to the last: where the
    // carrier is lost for six to fifteen seconds the crew may come in, and
    // because a claim is tested against its whole footprint a phrase only lands
    // there if it fits in the gap and is finished before the station returns.
    // The relock keeps a second of margin either side so a note cannot be
    // playing into the moment the signal comes back.
    var GAP_EDGE_S = 1.0;
    var spans = null, P0 = c.rx;
    if (P0 && P0.gaps.length) {
      spans = []; var cursor = pFrom;
      for (var gq = 0; gq < P0.gaps.length; gq++) {
        var gStart = t0k + P0.gaps[gq].atS, gEnd = t0k + (P0.segments[gq + 1] ? P0.segments[gq + 1].atS : P0.gaps[gq].atS + P0.gaps[gq].durS);
        if (gEnd - gStart > 2 * GAP_EDGE_S + 1.5) { spans.push({ from: cursor, until: gStart + GAP_EDGE_S }); cursor = gEnd - GAP_EDGE_S; }
      }
      spans.push({ from: cursor, until: pUntil });
    }
    var spansFor = function (rel) {
      if (!spans) return { from: pFrom, until: pUntil + rel };
      var out = [], sq;
      for (sq = 0; sq < spans.length; sq++) out.push({ from: spans[sq].from, until: spans[sq].until + (sq === spans.length - 1 ? rel : 0) });
      return out;
    };
    for (var pv = 0; pv < pk.length; pv++) {
      // §3.5 THE POROUS HOLD: thirty receptions in a hundred leave ONE melodic
      // voice out of the hold altogether, drawn toward the sparse ones — the
      // shakuhachi, the biwa, the hichiriki — and never the intercom, which is
      // a second speaker and would read as part of the broadcast. It is not
      // asked to play over the signal; it is simply not forbidden to, so what
      // the listener hears is the crew occasionally deciding the transmission
      // is worth answering. Most receptions still silence them all.
      if (P0 && P0.porous === pk[pv]) continue;
      plan[pk[pv]] = spansFor(wx.rel[pk[pv]]);
    }
    plan.pa = spansFor(0);                 // the PA is held too, and for the same reason fire() holds it
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
    // Q0: the FIRST reel's buffer only stands in for the first reel. It used
    // to stand in for any piece whose own buffer had not arrived, so a 走 whose
    // second reel was still decoding (slow 4G) played the first reel's audio
    // from the second reel's in-point — the wrong station, and silence where
    // that in-point ran past the first reel's end. null lets startSignal start
    // the piece when its own decode lands.
    return (a.reel && id === a.reel.id) ? (a.buf || null) : null;
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
    // Q0: the element is threaded where the head STARTS (headPlan), which for a
    // hunt or a drift is before the in-point — so the play at the cue is a
    // play, not a seek.
    var startPos = a.inS;
    try { if (a.rx) startPos = headPlan(a.rx, (a.rate || 1) * headGlide(a.wantT0))[0].cuePos; } catch (e0) {}
    // …and a 走's second reel is fetched once now, into the cache, so the swap
    // inside the sweep is a cache read rather than a cold load mid-signal. (The
    // reels are served immutable for a year; a failure here costs nothing but
    // the warm-up.)
    var r2w = a.rx && a.rx.reel2;
    if (r2w && r2w.id !== a.reel.id && !reelsBuffered() && hasFetch) {
      try { fetch(reelUrl(r2w)).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).catch(function () {}); } catch (e1) {}
    }
    function seekIn() {
      try {
        var once = function () { try { v.removeEventListener("seeked", once); } catch (e) {} if (!a.dead) a.ready = true; warmPicture(v); };
        v.addEventListener("seeked", once, { once: true });
        v.currentTime = startPos;
      } catch (e) {}
    }
    // Q0 r2: sought as soon as the METADATA is in, not at `canplay`. A paused
    // player may be suspended at readyState 1 with the whole file buffered and
    // never say `canplay` (measured: loadedmetadata, suspend, then nothing for
    // 20 s); it was then first sought at its cue, and that seek never landed.
    // A seek is what wakes it, and it has twenty seconds to do so here.
    try {
      if (videoSrcIds[ix] !== a.reel.id) {
        videoSrcIds[ix] = a.reel.id; v.src = url; v.preload = "auto";
        var onMeta = function () { try { v.removeEventListener("loadedmetadata", onMeta); } catch (e) {} seekIn(); };
        v.addEventListener("loadedmetadata", onMeta, { once: true });
        v.load();
      } else if (v.readyState >= 1) seekIn();
      else { var onMeta2 = function () { try { v.removeEventListener("loadedmetadata", onMeta2); } catch (e) {} seekIn(); }; v.addEventListener("loadedmetadata", onMeta2, { once: true }); }
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
      var got = sampleTune(now, attempt < 5);   // the sixth takes what it draws
      if (!got) return false;
      if (got === "blocked") return "blocked";
      if (got !== "retry") return true;
    }
    return true;
  }
  var lastSampleAudioOnly = false;
  // A DELIBERATE PRESS (force = true) — the 受信 button on the ledge, rc.77.
  // It bypasses the COOLDOWN and NOTHING ELSE on the way in: the legality (the
  // scene, the KIRU, the D1 guard), the footprint check, choose()'s narrowing
  // by 選局番号, the whole-window hold, the AIR and the tube are all the
  // production path, unchanged. What force DOES add is on the way out: where an
  // ordinary dial press gives up and returns "snow", a deliberate press falls
  // back to the audition — the same full window the stopped press gives, on the
  // same tube, through the same receiver chain — because the owner's rule for
  // this button is that a press is never a no-op. A press therefore always
  // sounds a reel; whether it was SEATED as a broadcast is what the return
  // value tells the caller ("locked" vs "audition").
  // …and it does not stack. An audition holds the air for its whole window,
  // so a second press inside one is a press onto a clip that is ALREADY
  // playing: it answers "live" rather than laying a second reel over the
  // first. (A seated broadcast is covered by `live` a few lines down; this is
  // the audition's own version of the same courtesy.)
  var auditionEnd = -1e9;
  function forceFallback(now) {
    if (now < auditionEnd) return "live";
    var got = dialAudition(now);
    return got === "blocked" ? "live" : got ? "audition" : "snow";
  }
  // Q0 — AN AUDITION NEVER SHARES THE AIR WITH A BROADCAST. A press while a
  // broadcast is armed auditions a window (above), and nothing stopped that
  // window from running on into the broadcast when it came: measured, press
  // 3042, three times in 600 s — an audition still sounding 1.4 s into the
  // Cage reel, one built 0.5 s before a broadcast's t0, and one whose reel
  // arrived late on slow 4G and was built 1.9 s INTO a broadcast. Two stations
  // at once, which is not a thing a receiver does. rc.95 answered that by not
  // starting an audition that would reach a broadcast's static lead, which
  // left the press with nothing for up to 27 s (critic, Q0 r1). Since Q0 r2
  // the audition is FITTED into the room before the broadcast instead —
  // audRoom() and audFit(), beside sampleTune — and only a broadcast under
  // six seconds away takes the press.
  function onAirNow(now) {
    for (var i = 0; i < lives.length; i++) { var A = lives[i].a, P = A && A.rx; if (A && A.t0 != null && now < A.t0 + (P ? P.spanS : TUNE_S + A.holdS + A.lossD) + COLLAPSE_S + BURST_S) return true; }
    return false;
  }
  function dialLock(force) {
    var T = tl(), c = T.ctx;
    if (!c) return "snow";
    var now = c.currentTime;
    if (!force && now - dialLast < dialCold) return "wait";  // §8.2: cold for the drawn 45–60 s (the ledge button has none)
    if (!T.playing()) {                                      // stopped: the audition, a full window
      if (!dialAudition(now)) return "snow";
      dialLast = now; dialPresses++; dialCold = dialDrawCold(); stats.dial = (stats.dial || 0) + 1;
      return "locked";
    }
    // (Q0 r3) …and an AUDITION on the air is a clip already playing too. A
    // press in one seated a broadcast 4.5 s on, over the audition's tail —
    // two stations at once (press 555 host: an audition built late to 279.9,
    // a lock pressed at 274.9 aired at 279.4). auditionEnd is the audition's
    // real end once it is built.
    if (now < auditionEnd) return force ? "live" : "snow";
    // A signal is up, OR one is ARMED AND WAITING — which is exactly how a
    // planned broadcast lives between plan time and its host scene. Locking in
    // that window replaces `armed`, and then the visitation's own fire()
    // refuses and the engine falls back to the synthesized Etenraku: the cycle
    // keeps a broadcast but silently loses the reel the plan drew. 選局 has
    // this guard; the dial did not. (Critic W1 r2, D1.)
    // …and a deliberate press does not shout over the reel that is already
    // there: while one is ON THE AIR the press has its clip already, and while
    // one is merely ARMED the fallback audition answers the hand.
    // (Q0 r2: "on the air" ends with the burst. The reception stays `live`
    // through its 1.6 s of dead tube and its teardown, and a press in there
    // was answered "live" with nothing sounding — a press that did nothing.
    // It is answered by an audition instead, fitted before whatever is next.)
    if (live && onAirNow(now)) return force ? "live" : "snow";
    if (live) return force ? forceFallback(now) : "snow";
    if (armed) return force ? forceFallback(now) : "snow";
    var sc = T.scene(), cy = T.cycle();
    if (!sc || sc.type === "kyu" || sc.type === "release" || sc.type === "oroshi") return force ? forceFallback(now) : "snow";   // the wall and the hush are not the dial's to interrupt
    // IMMEDIATELY, not at the next legal moment: t0 is now + the static lead,
    // and the window is trimmed to whatever room the scene has left.
    var t0 = now + STATIC_LEAD_S + 0.5;
    var room = (sc.startT + sc.durS - 3) - (t0 + TUNE_S + 2.8 + COLLAPSE_S + BURST_S);
    if (room < 4) return force ? forceFallback(now) : "snow";  // no room before the scene turns
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
      da = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5, shape: manualShape(R.fork("shape:" + attempt)) }, t0), R.fork("try:" + attempt));
      if (!da) return force ? forceFallback(now) : "snow";
      if (!da.reel || !da.reel.audioOnly) { got = true; break; }
    }
    if (!got && !da) return force ? forceFallback(now) : "snow";
    if (da.rx && da.rx.spanS > room) rxShrinkTo(da, room);
    // (Q0 r3) A LOCK IS ONLY SEATED IF ITS REEL CAN BE DECODED BY decide(),
    // DECIDE_LEAD_S before t0 — on this page's measured fetch and decode
    // rates, with the audition's margin. Otherwise the seat falls back to the
    // gagaku at t0 and the press sounds no reel for 20 s or more (press 777
    // host: a 1.47 MB reel locked at 520.8, "reel not decoded" at 525.3, the
    // next reel at 543.7). The press goes to the audition instead, which can
    // answer from a reel already decoded.
    if (force && reelsBuffered() && decEta(da.rx ? planReels(da.rx) : [da.reel]) * 1.25 + 0.2 > t0 - DECIDE_LEAD_S - now) {
      da.dead = true; qDrop(da); try { tl().airHoldClear(da.holdId); } catch (e) {}
      stats.lockSlow = (stats.lockSlow || 0) + 1;
      return forceFallback(now);
    }
    if (!fire(t0)) { da.dead = true; qDrop(da); return force ? forceFallback(now) : "snow"; }
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
    try { var ZA = window.ZankyoAudio; return !!(ZA && ZA.getRoute && ZA.getRoute().capture === "off"); } catch (e) { return false; }
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

  // Q0 — OVERLAPPING DROPS ARE ONE DUCK. weather() packs the drops tighter
  // through the loss — steps fall to 0.24 s while a drop lasts up to 0.37 s —
  // so on a lingering exit two drops overlap routinely. Scheduled one by one,
  // the second's setValueAtTime(1) landed INSIDE the first: the gate jumped
  // from the floor to full for 6 ms (a click), the first's end then lifted it
  // back to full while the second was still meant to be down, and the second's
  // end dropped it again with a bare step — a stutter of clicks where the draw
  // asked for one longer hole, and the hiss did the same thing on its own gain.
  // The UNION of the drawn spans is ducked instead. The draws, the schedule and
  // the picture's drops (desc.drops) are untouched; only the audio's automation
  // stops fighting itself. [start, dur, index of the first drop in the group].
  function mergeDrops(drops) {
    var out = [], i, cur = null;
    var d = drops.map(function (x, k) { return [x[0], x[1], k]; }).sort(function (p, q) { return p[0] - q[0]; });
    for (i = 0; i < d.length; i++) {
      // the hiss takes 30 ms to leave, so a drop that starts inside that tail
      // is part of the same duck
      if (cur && d[i][0] <= cur[0] + cur[1] + 0.04) { cur[1] = Math.max(cur[1], d[i][0] + d[i][1] - cur[0]); continue; }
      cur = [d[i][0], d[i][1], d[i][2]]; out.push(cur);
    }
    return out;
  }
  // Q0 — WHERE THE HEAD STARTS, piece by piece: the reel position each piece
  // plays from and the moment (seconds after t0) it is there. One answer for
  // the element, the buffer and the audition, so they cannot drift apart.
  //
  //   THE FIRST PIECE reaches its in-point at srcFromS — the lock after a
  //   hunt, three seconds into a drift, t0 for a snap — which is the moment the
  //   plan has the station arriving. It used to START at t0 from the in-point
  //   in element mode, so a hunt of 3–8 s or a drift of 6–10 s ran that much
  //   of the window before the station even locked, and the hold ran the same
  //   distance PAST the window's end: into the next window of the file (a jump
  //   cut, at full level) or off the end of the file (the element ends; the
  //   rest of the hold is silence). Measured on the probe before this: a 探
  //   hold 1.6 s past its window, a 残 loss 6.1 s past its, env 0.7. So the
  //   head now PRE-ROLLS: it starts at t0 far enough before the in-point to
  //   arrive there on time, which is also what lets the hunt's glimpses carry
  //   "a syllable flickering out of the snow" (PLAN-SIGNAL-SHAPES §3.2) — they
  //   are the moments just before the station, as a dial passing over it
  //   would catch them. Where the window has no room before its in-point the
  //   pre-roll reaches back into the file before it — the reels are windows
  //   cut back to back, so that is an earlier moment of the same broadcast, and
  //   a jump inside a hunt is the dial's own business (the glimpses are
  //   fragments under an envelope that is shut between them). Only at the
  //   head of the FILE does it start later instead, still on time for the lock.
  //   THE LAST PIECE is placed so the whole of its run, through the exit, stays
  //   inside the window where the window has the room: the in-point was chosen
  //   against an exit capped at EXIT_MAX_COST_S (3 s), and 残 lingers for 6–12
  //   at 75 % then 44 % of peak — which is not the "under 20 %" that cap
  //   assumed. The run is shifted earlier by the overrun, never past the
  //   window's start; what cannot be absorbed is reported as `overrunS`.
  //   LATER PIECES are sought PREROLL_S before their relock (seekAt/seekPos),
  //   inside the carrier-lost gap, so the element is running when the relock
  //   opens the envelope.
  // No draw, no plan field and no event changes here: inS, the segments and
  // the timeline are the plan's. What moves is where the tape is threaded.
  var PREROLL_S = 1.0;
  // THE CUE. A play() takes its time to reach the graph — measured 80 ms in
  // Chrome from the call to the element's clock moving — so the first piece is
  // started CUE_LEAD_S before its moment, threaded CUE_LEAD_S − CUE_LAT_S
  // before its point, and is where the plan says at the moment the plan says.
  // (Unthreaded, a 0.2 s lead ran every reel 0.12 s ahead of its plan, which a
  // window cut to the frame then paid for at its far end.)
  var CUE_LEAD_S = 0.2, CUE_LAT_S = 0.08;
  function windowOf(reel, inS) {
    var ws = (reel && reel.windows) || [], i;
    for (i = 0; i < ws.length; i++) if (inS >= ws[i][0] - 1e-3 && inS < ws[i][1]) return ws[i];
    return null;
  }
  // On a 螺/弛 night every reel runs at rate × glideMul(t) — up to 26 % slow —
  // so the pre-roll has to be threaded at the rate the reel will actually run
  // at, or the head reaches its in-point that much late (measured, seed 4 at
  // far 0.9: 0.6 s behind at the lock, into the window's splice at full level).
  // The glide moves a few cents a second; its value at t0 is the rate for the
  // seconds that matter.
  function headGlide(t) { try { var T = tl(); return (T.gliding && T.gliding() && T.glideMul && t != null) ? T.glideMul(t) : 1; } catch (e) { return 1; } }
  function headPlan(P, rate) {
    rate = rate || 1;
    var out = [], n = P.segments.length, i;
    for (i = 0; i < n; i++) {
      var sg = P.segments[i], reel = sg.reel, w = windowOf(reel, sg.inS);
      var w0 = w ? w[0] : sg.inS, w1 = w ? Math.min(w[1], reel && reel.durS ? reel.durS : w[1]) : Infinity;
      var h = { at: 0, pos: sg.inS, seekAt: 0, seekPos: sg.inS, overrunS: 0, edgePos: w1 };
      if (i === 0) {
        var pre = (sg.srcFromS || 0) * rate, room = Math.max(0, sg.inS);
        if (pre <= room) { h.pos = sg.inS - pre; h.at = 0; }
        else { h.pos = sg.inS - room; h.at = (sg.srcFromS || 0) - room / rate; }
      } else {
        h.at = sg.lockAtS; h.pos = sg.inS;
      }
      if (i === n - 1) {
        var over = h.pos + (P.spanS - h.at) * rate - w1;
        if (over > 0) { var sh = Math.min(over, Math.max(0, h.pos - w0)); h.pos -= sh; h.overrunS = +(over - sh).toFixed(3); }
      }
      if (i > 0) {
        // (the pre-roll runs under a SHUT envelope — the carrier is lost until
        // the relock — so it may reach back past the window's start; only the
        // file's head bounds it. Bounded by the window, a piece cut from the
        // head of its window was sought AT the relock and came in 27 ms late.)
        var gap = P.gaps[i - 1], lead = Math.min(PREROLL_S, Math.max(0, h.pos / rate), Math.max(0, (gap ? gap.durS : 0) + (sg.lockS || 0) - 0.3));
        h.seekAt = h.at - lead; h.seekPos = h.pos - lead * rate;
      }
      // THE CUE — the first piece's, and (decoded, Q0 r3) every later piece's:
      // threaded CUE_LEAD_S − CUE_LAT_S before its point, started CUE_LEAD_S
      // before its moment. (Q0 r3: a point nearer the file's head than that
      // lead is threaded at 0 and started that much later. It was started at
      // the full lead from 0 and ran up to 0.12 s ahead of its plan: +140 ms
      // measured on bbc1-testcard's decoded picture, a window at its file's head.)
      h.cuePos = Math.max(0, h.pos - (CUE_LEAD_S - CUE_LAT_S) * rate);
      h.cueAt = h.at - CUE_LAT_S - (h.pos - h.cuePos) / rate;
      out.push(h);
    }
    return out;
  }
  // Q0 r2 — THE PICTURE FOLLOWS THE SOUND (decoded reels). In ?reels=buffer
  // mode — the default since rc.93 — the sound is a BufferSource on the audio
  // clock and the picture is a muted element started by a timer, and nothing
  // tied the two together after the cue. Measured by the critic on rc.95: 26
  // of 30 receptions had the picture more than 150 ms off its sound for over a
  // tenth of the hold; −3.6 s on a broadcast for all 31 s of it (the element's
  // clock ran at 0.93× the audio clock, readyState 4, no `waiting`), −4.6 s on
  // an audition (loaded at its cue). An element with no voice can be moved
  // without anyone hearing it, so every SYNC_TICK_MS the element is compared
  // with where the head is — headPlan's pos, run at the piece's rate (and the
  // glide's steps, where the night glides) from the moment it started.
  // Only on SETTLED pieces: from 0.3 s after a piece's head starts to the end
  // of its run; in a gap the element is being moved to the next piece, and the
  // tube is snow there anyway. It owns the element's rate for the reception —
  // the glide's lane leaves a decoded reception's element alone.
  //
  // Q0 r3 — A FROZEN PICTURE IS WORSE THAN A LATE ONE. r2's loop sought
  // whenever the picture was 0.3 s off, sought again after 1.2 s "stuck" (a
  // seek still in flight counted as stuck), and set the rate every 150 ms.
  // Measured by the critic at a load average of ~55: seeks took p50 0.54 s,
  // p90 2.18 s, max 6.41 s to land; each landed behind, and the next seek
  // followed — 14.4 % of the settled picture was a held frame, every second of
  // it beginning at a seek this loop made (atc-malvinas: 8 seeks, 7.4 s frozen
  // in 9.2 s). And the rate nudges made the offsets they corrected: over the
  // critic's four runs, a playbackRate set in the last 0.35 s is followed by a
  // stalled element clock (a 50 ms poll that advanced under 40 % of its time,
  // readyState 4, no seek near) 5.0–5.6 % of the time, against 0.3–0.8 % with
  // none — at 66–91 sets a minute the loop was its own disturbance
  // (prelinger-operation-cue, host: +29 ms for 2 s of rate flicker, then
  // −289 ms in 0.6 s, then five seeks). A proportional loop that decided every
  // 0.9 s on the samples before it overshot on them instead (tibet-tv, force
  // 31: a −241 ms hiccup answered with 1.27× for 0.9 s, closed to +150 ms, then
  // six seconds at +100). So picSync is a small machine, every SYNC_TICK_MS:
  //   READ    the offset is the median of the last three samples since the
  //           last move — a hiccup is one sample, not an offset — read only
  //           when those three sit within SYNC_STILL_S of each other (below),
  //           and none is taken until SYNC_SETTLE_S after a landing or a rate
  //           change
  //   STEADY  inside SYNC_DEAD_S the element runs at the steady rate: the
  //           piece's rate over the element's clock (picClk), MEASURED — the
  //           slope of the offset over 0.6 s or more at a held rate says
  //           how fast the element really runs against the audio clock (the
  //           critic's ran at 0.78–0.95 under load). The slope is Theil–Sen
  //           (the median of the pairwise slopes), and it is not believed
  //           where a sample sits more than SYNC_FIT_S off its line: a hiccup
  //           is not a slow clock. The clock is the MACHINE's, shared by every
  //           element and reception, so each piece is cued at the rate that
  //           undoes it.
  //   CATCH   outside it, under the seek threshold: the steady rate moved by
  //           δ = |offset| / SYNC_CATCH_S, never more than SYNC_BAND (20 %, a
  //           film at 20 fps against 24, which reads as the same motion) —
  //           for exactly the time that closes the offset at that δ, then
  //           back to steady and read again. A timed catch cannot overshoot on
  //           stale samples. Two rate sets per correction, not 66–91 a minute.
  //   SEEK    only when a seek can help: never while one is in flight (this
  //           loop's or anyone's: the relock's, the audition's thread); only
  //           beyond max(SYNC_SEEK_MIN_S, SYNC_SEEK_K × the landing time the
  //           machine is showing now — seekLand, from every seek on every
  //           element); only with that landing time and a second to spare in
  //           the piece; at most SYNC_SEEK_BUDGET a piece. Where seeks land in
  //           60 ms (this machine at a load of ~35) a 0.15 s error is a seek,
  //           which holds the frame for 60 ms and lands on the sound; where
  //           they take 0.6 s it takes 1.2 s of error to be worth one, and the
  //           rate closes the rest. It aims at where the sound will be when
  //           it lands, by the same measure.
  //   RELOAD  only on a real stall: a seek in flight SYNC_RELOAD_S, or no
  //           frame and no progress that long with none in flight; once a
  //           reception.
  var SYNC_TICK_MS = 100, SYNC_SETTLE_S = 0.35, SYNC_DEAD_S = 0.03, SYNC_CATCH_S = 0.6, SYNC_CATCH_MAX_S = 1.5, SYNC_BAND = 0.2, SYNC_BAND_MIN = 0.04, SYNC_FIT_S = 0.05;
  var SYNC_CLK_MIN = 0.5, SYNC_CLK_MAX = 1.33, SYNC_SEEK_MIN_S = 0.15, SYNC_SEEK_K = 2, SYNC_STILL_S = 0.04, SYNC_SEEK_BUDGET = 2, SYNC_RELOAD_S = 5.0;
  var picClk = 1;                                      // the elements' clock against the audio clock, learnt (picSync)
  function picSteady() { return Math.round(200 / picClk) / 200; }
  // THE MACHINE'S SEEK TIME, audio seconds from `seeking` to `seeked`, over
  // every WARM seek on every element (the relocks', the auditions' threads,
  // picSync's — a seek in a file the element already has open): an average
  // that follows the load, and the last landing, whichever is longer, is what
  // a seek is expected to cost. It is the load, measured. A seek within
  // SEEK_COLD_S of a src change is a fetch and a parse as well (0.3 s where
  // a warm one took 0.05, at a load of 35) and says nothing about the next
  // seek picSync might make in the same file, so it is not counted.
  var seekLand = { est: 0.12, last: 0.12, n: 0 }, SEEK_COLD_S = 1.5;
  function landUp() { return Math.max(seekLand.est, seekLand.last); }
  function watchSeeks(v) {
    var from = null, loadAt = -1e9;
    var clk = function () { try { return tl().ctx ? tl().ctx.currentTime : null; } catch (e) { return null; } };
    v.addEventListener("loadstart", function () { var n = clk(); if (n != null) loadAt = n; });
    v.addEventListener("seeking", function () { if (from == null) from = clk(); });   // a seek on a seek: the picture has been held since the first
    v.addEventListener("seeked", function () {
      var n = clk(), d = (from != null && n != null) ? n - from : -1, cold = from != null && from - loadAt < SEEK_COLD_S; from = null;
      if (!(d >= 0 && d < 30) || cold) return;
      seekLand.last = d; seekLand.est = seekLand.n ? seekLand.est + 0.35 * (d - seekLand.est) : d; seekLand.n++;
      stats.seekLand = +seekLand.est.toFixed(3);
    });
    v.addEventListener("emptied", function () { from = null; });
  }
  function median(a) { var s = a.slice().sort(function (x, y) { return x - y; }); return s[s.length >> 1]; }
  function picSync(o) {
    // o: { v, t0, P, HP, rate, timers, alive() }
    var c = tl().ctx, T = tl(), mul = picSteady(), samp = [], pending = null, landAt = -1e9, setAt = -1e9, catchEnd = null;
    var seeks = {}, reloads = 0, dryAt = null, dryCur = null, lastK = -1, gmSet = 1;
    var gl = !!(T.gliding && T.gliding() && T.glideMul);
    var gm = function (t) { try { return gl ? T.glideMul(t) : 1; } catch (e) { return 1; } };
    // where the decoded head of piece k is at audio time t: the start's value
    // until the first lane step after it, then the step values (startSignal's
    // BufferSource automation, exactly)
    function sndPos(k, t) {
      var from = o.t0 + o.HP[k].at, pos = o.HP[k].pos;
      if (t <= from) return pos - o.rate * gm(o.t0) * (from - t);
      if (!gl) return pos + o.rate * (t - from);
      var x = from, g = gm(o.t0);
      while (x < t) {
        var nx = o.t0 + (Math.floor((x - o.t0) / 0.5 + 1e-9) + 1) * 0.5;
        if (nx > t) nx = t;
        pos += o.rate * g * (nx - x); x = nx; g = gm(o.t0 + Math.floor((x - o.t0) / 0.5 + 1e-9) * 0.5);
      }
      return pos;
    }
    function pieceEnd(k) { var sg = o.P.segments[k]; return (k === o.P.segments.length - 1) ? o.P.spanS : sg.atS + sg.onS + (sg.holeS || 0); }
    function pieceAt(rel) {
      for (var k = o.P.segments.length - 1; k >= 0; k--) {
        var a = Math.max(o.HP[k].at, k === 0 ? 0 : o.P.segments[k].atS) + 0.3;
        if (rel >= a && rel <= pieceEnd(k)) return k;
      }
      return -1;
    }
    function setRate(m, now) {
      gmSet = gm(now);
      try { o.v.playbackRate = o.rate * gmSet * m; } catch (e) {}
      mul = m; samp = []; setAt = now;
    }
    function seekTo(k, now) {
      try { o.v.currentTime = Math.max(0, sndPos(k, now + seekLand.est)); } catch (e) {}
      catchEnd = null; setRate(picSteady(), now);            // in the same breath as the seek, which resets the pipeline anyway
      pending = now; seeks[k] = (seeks[k] || 0) + 1;
      stats.picSeeks = (stats.picSeeks || 0) + 1;
    }
    // the element's clock, from the samples at one held rate: element seconds
    // per audio second = base · mul · clk, so an offset sloping at s gives
    // clk = (1 + s / base) / mul
    function learnClock(now, catching) {
      var n = samp.length, i, j, sl = [];
      if (n < 6 || samp[n - 1][0] - samp[0][0] < 0.6) return;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) { var dt = samp[j][0] - samp[i][0]; if (dt > 0.25) sl.push((samp[j][1] - samp[i][1]) / dt); }
      if (sl.length < 10) return;
      var s = median(sl), ts = [], xs = [];
      for (i = 0; i < n; i++) { ts.push(samp[i][1] - s * (samp[i][0] - samp[0][0])); }
      var b0 = median(ts);
      for (i = 0; i < n; i++) xs.push(Math.abs(ts[i] - b0));
      if (Math.max.apply(null, xs) > SYNC_FIT_S) return;       // a hiccup inside: not a clock
      var base = o.rate * gm(now), r = (1 + s / base) / mul;
      if (!(r > 0.25 && r < 1.6) || Math.abs(r / picClk - 1) < 0.01) return;
      picClk = Math.max(SYNC_CLK_MIN, Math.min(SYNC_CLK_MAX, picClk + 0.6 * (r - picClk)));
      stats.picClk = +picClk.toFixed(3);
      if (catching) { catchEnd = null; setRate(picSteady(), now); }   // the catch was sized on the old clock: read again
      else if (Math.abs(picSteady() - mul) >= 0.005) setRate(picSteady(), now);
      else samp = samp.slice(-3);
    }
    function play() { try { var p = o.v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }
    function reload(k) {
      if (reloads >= 1) return;
      reloads++; pending = null; dryAt = null; stats.picReloads = (stats.picReloads || 0) + 1;
      var v = o.v;
      try {
        v.addEventListener("loadedmetadata", function once() {
          try { v.removeEventListener("loadedmetadata", once); } catch (e0) {}
          if (!o.alive()) return;
          seekTo(k, c.currentTime); play();
        });
        v.load();
      } catch (e1) {}
    }
    function tick() {
      if (!o.alive()) return;
      var v = o.v, now = c.currentTime, rel = now - o.t0;
      if (rel > o.P.spanS + 0.1) { try { v.playbackRate = o.rate * gm(now); } catch (e) {} return; }
      o.timers.push(setTimeout(tick, SYNC_TICK_MS));
      var k = pieceAt(rel);
      if (k < 0 || !v) { samp = []; dryAt = null; catchEnd = null; return; }
      if (k !== lastK) { lastK = k; catchEnd = null; mul = picSteady(); gmSet = gm(now); samp = []; setAt = now; }   // each piece is cued at the steady rate
      // a seek in flight is left to land, whoever made it
      if (v.seeking) {
        if (pending == null) pending = now;
        else if (now - pending > SYNC_RELOAD_S) reload(k);
        return;
      }
      if (pending != null) { pending = null; landAt = now; samp = []; }
      if (v.paused) { play(); return; }
      if (v.readyState < 2) {                        // no frame and nothing in flight: an underrun, let be — unless it never moves again
        if (dryAt == null || v.currentTime !== dryCur) { dryAt = now; dryCur = v.currentTime; }
        else if (now - dryAt > SYNC_RELOAD_S) reload(k);
        samp = []; return;
      }
      dryAt = null;
      if (catchEnd != null && now >= catchEnd) { catchEnd = null; setRate(picSteady(), now); return; }
      if (gl && Math.abs(gm(now) / gmSet - 1) > 0.004) { setRate(mul, now); return; }   // the glide moved: the same multiple of the new rate
      if (now - landAt < SYNC_SETTLE_S || now - setAt < SYNC_SETTLE_S) return;
      samp.push([now, v.currentTime - sndPos(k, now)]); if (samp.length > 30) samp.shift();
      // a catch runs its time out, but its samples are read for the clock too:
      // an element that cannot keep up even at +20 % (force 31, two
      // receptions on two elements at a load of ~35: 0.8 of its rate for 12 s)
      // is a slow clock, and the steady rate is what answers it
      if (catchEnd != null) { learnClock(now, true); return; }
      if (samp.length < 3) return;
      // a reading, only once it holds still: the last three within
      // SYNC_STILL_S of each other. An element mid-hiccup (its clock stopped
      // for 0.1–0.4 s, readyState 4, no event — at a load of ~35, every few
      // seconds) reads as an offset that is still growing, and the correction
      // it asked for was the wrong size, or the wrong way (hk-atv, press 2024:
      // +38, −15, −73 read as "ahead", and the picture slowed into the stall).
      var l3 = samp.slice(-3).map(function (x) { return x[1]; });
      if (Math.max.apply(null, l3) - Math.min.apply(null, l3) > SYNC_STILL_S) return;
      var off = median(l3), L = landUp(), base = o.rate * gm(now);
      if (Math.abs(off) > Math.max(SYNC_SEEK_MIN_S, SYNC_SEEK_K * L) && (seeks[k] || 0) < SYNC_SEEK_BUDGET && o.t0 + pieceEnd(k) - now > L + 1.0) { seekTo(k, now); return; }
      if (Math.abs(off) > SYNC_DEAD_S) {
        var d = Math.max(SYNC_BAND_MIN, Math.min(SYNC_BAND, Math.abs(off) / SYNC_CATCH_S));
        setRate(Math.round(picSteady() * (1 - (off > 0 ? d : -d)) * 1000) / 1000, now);
        catchEnd = now + Math.min(SYNC_CATCH_MAX_S, Math.abs(off) / (d * base));   // then read again: under load the element may not be running at all
        stats.picCatches = (stats.picCatches || 0) + 1;
        return;
      }
      learnClock(now);
    }
    o.timers.push(setTimeout(tick, Math.max(0, (o.t0 + Math.max(0, o.HP[0].at) + 0.3 - c.currentTime) * 1000)));
  }
  // ---- the signal itself ----
  function startSignal(a, t0) {
    var T = tl(), c = T.ctx, vix = a.vidx || 0, v = videos[vix], ms = mediaSrcs[vix];
    var buffered = reelsBuffered(), bufSrc = null, bufSrcs = [];   // 経路: the reel's first node is the only thing this switch moves
    var own = { timers: [], off: [] };                                // Q0: this reception's pending element moves and listeners, undone by its teardown
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
      var absDrops = [], duckDrops = mergeDrops(a.drops);
      for (i = 0; i < a.drops.length; i++) absDrops.push([t0 + a.drops[i][0], a.drops[i][1]]);
      for (i = 0; i < duckDrops.length; i++) {
        var da = t0 + duckDrops[i][0], dd = duckDrops[i][1];
        gate.gain.setValueAtTime(1, da); gate.gain.linearRampToValueAtTime(DROP_FLOOR, da + 0.006);
        gate.gain.setValueAtTime(DROP_FLOOR, da + dd); gate.gain.linearRampToValueAtTime(1, da + dd + 0.006);
        // the static swells in over the head of the hole and drops out with
        // it; its band wanders hole to hole on the signal's own seed (no draw)
        var hf = 700 + 1900 * (((a.seed || 0) * 0.618 * (duckDrops[i][2] + 1)) % 1);
        hb.frequency.setValueAtTime(hf, da); hb.frequency.exponentialRampToValueAtTime(hf * 1.4, da + dd);
        hz.gain.setValueAtTime(0, da); hz.gain.linearRampToValueAtTime(DROP_HISS, da + Math.min(0.03, dd * 0.25));
        hz.gain.setValueAtTime(DROP_HISS, da + dd); hz.gain.linearRampToValueAtTime(0, da + dd + 0.03);
      }
      hn.connect(hb); hb.connect(hz); hn.start(t0, 11); hn.stop(cut + 0.3);
      // 無信号 THE CARRIER LOST — the sound of a gap and of a hole (§3.1). The
      // seeded dropouts above duck the reel under a burst of static; this is the
      // other thing, and it has to be louder and wider, because the station is
      // actually GONE for six to fifteen seconds and the receiver is left with
      // the band's own noise. It is its own branch and not the holes' louder
      // cousin for one reason: it joins BEFORE the tuning envelope so the gap's
      // static does not fade with the reel, which is what makes a gap sound
      // like a lost carrier rather than like a fade-out.
      //
      // 走's gap is the 掃引 sweep: the same noise with its band swept across
      // the dial, which is what the ear reads as a hand on the knob.
      var lostSpans = [], lz = null;
      for (i = 0; i < P.gaps.length; i++) {
        var seg1 = P.segments[i + 1];
        lostSpans.push({ at: P.gaps[i].atS, dur: (seg1 ? seg1.atS : P.gaps[i].atS + P.gaps[i].durS) - P.gaps[i].atS, sweep: !!P.gaps[i].sweep, deep: true });
      }
      for (i = 0; i < P.holes.length; i++) lostSpans.push({ at: P.holes[i].atS, dur: P.holes[i].durS, sweep: false, deep: false });
      if (lostSpans.length) {
        // ONE NOISE SOURCE, TWO BRANCHES. `hn` above already runs from t0 to
        // cut + 0.3, which is exactly the span this needs, and the critic's
        // ceiling of 110 concurrent sources is the tightest budget the station
        // has — measured at 104 on seed 3042 with a second source here, six
        // short of the bound. A BufferSource is not free and a second copy of
        // the same white noise is not a different sound; the two branches get
        // their own filter and their own gain, which is where the difference
        // actually lives.
        var lb = N(c.createBiquadFilter());
        lz = N(c.createGain());
        lb.type = "bandpass"; lb.Q.setValueAtTime(0.9, t0);
        lb.frequency.setValueAtTime(1400, t0);
        lz.gain.setValueAtTime(0, t0);
        hn.connect(lb); lb.connect(lz); lz.connect(T.lg("broadcast"));
        for (i = 0; i < lostSpans.length; i++) {
          var LS = lostSpans[i], la = t0 + LS.at, ld = Math.max(0.1, LS.dur);
          var lvl = (LS.deep ? 0.16 : 0.09) * db2lin(a.reel.gain);
          lz.gain.setValueAtTime(0, la);
          lz.gain.linearRampToValueAtTime(lvl, la + Math.min(0.5, ld * 0.25));
          lz.gain.setValueAtTime(lvl, la + ld - Math.min(0.35, ld * 0.25));
          lz.gain.linearRampToValueAtTime(0, la + ld);
          if (LS.sweep) {
            // the dial crossing the band: 400 Hz to 3.2 kHz and back down onto
            // the station it finds
            lb.frequency.setValueAtTime(420, la);
            lb.frequency.exponentialRampToValueAtTime(3200, la + ld * 0.6);
            lb.frequency.exponentialRampToValueAtTime(1100, la + ld);
          } else {
            var lf = 800 + 1400 * (((a.seed || 0) * 0.318 * (i + 1)) % 1);
            lb.frequency.setValueAtTime(lf, la);
            lb.frequency.exponentialRampToValueAtTime(lf * 0.7, la + ld);
          }
        }
      }
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
      var peak = 0.35 * db2lin(a.reel.gain) * REEL_VOL;
      var env = planEnv(P, peak);
      PJ.Voice.env(sg.gain, t0, env);
      // 断 THE HOLES, written over the envelope rather than into it: a hole can
      // fall anywhere inside a piece and the envelope is a list of durations, so
      // scheduling them absolutely is both simpler and impossible to get out of
      // step with the picture, which reads the same numbers. A hole is a real
      // loss — HOLE_FLOOR is well below DROP_FLOOR — and the band closes over it.
      for (i = 0; i < P.holes.length; i++) {
        var ha = t0 + P.holes[i].atS, hd = P.holes[i].durS;
        sg.gain.setValueAtTime(peak, ha);
        sg.gain.linearRampToValueAtTime(peak * HOLE_FLOOR, ha + 0.18);
        sg.gain.setValueAtTime(peak * HOLE_FLOOR, ha + hd - 0.12);
        sg.gain.linearRampToValueAtTime(peak, ha + hd + 0.22);
        hp.frequency.setValueAtTime(hpHold, ha); hp.frequency.exponentialRampToValueAtTime(hpHold * 2.2, ha + 0.18);
        lp.frequency.setValueAtTime(lpHold, ha); lp.frequency.exponentialRampToValueAtTime(Math.max(900, lpHold * 0.3), ha + 0.18);
        hp.frequency.setValueAtTime(hpHold * 2.2, ha + hd - 0.12); hp.frequency.exponentialRampToValueAtTime(hpHold, ha + hd + 0.22);
        lp.frequency.setValueAtTime(Math.max(900, lpHold * 0.3), ha + hd - 0.12); lp.frequency.exponentialRampToValueAtTime(lpHold, ha + hd + 0.22);
      }
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
        var HPb = headPlan(P, rate * headGlide(t0));        // Q0: the same starts the element takes, so the two modes cannot drift
        var startPiece = function (k, bk) {
          var sk = P.segments[k];
          var bs = N(c.createBufferSource());
          bs.buffer = bk;
          bs.playbackRate.setValueAtTime(rate * (T.glideMul ? T.glideMul(t0) : 1), t0 + HPb[k].at);
          bs.start(t0 + HPb[k].at, HPb[k].pos);
          bs.stop(t0 + sk.srcToS);
          bufSrcs.push(bs);
          bs.connect(hp);
          return bs;
        };
        for (i = 0; i < P.segments.length; i++) {
          var sgi = P.segments[i], bi = bufFor(a, sgi.reel);
          if (bi) { startPiece(i, bi); continue; }
          // Q0: a 走's second reel whose decode has not landed yet was simply
          // SKIPPED — its whole piece silent under an open envelope. Its decode
          // is already under way (prefetch); the piece is started when it lands,
          // provided that is still before the relock. Too late is the silence it
          // was, and the harness sees a piece that never sounded.
          if (i > 0 && sgi.reel) (function (k, sk) {
            decodeReel(sk.reel.id, c).then(function (bk) {
              if (a.dead || c.currentTime > t0 + HPb[k].at - 0.05) return;
              try { if (!a.bufs) a.bufs = {}; a.bufs[sk.reel.id] = bk; startPiece(k, bk); } catch (e) {}
            }, function () {});
          })(i, sgi);
        }
        bufSrc = bufSrcs[0] || null;
        head = null;
      }
      if (head) head.connect(hp);
      hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(mk); mk.connect(fl); fl.connect(gate); gate.connect(cr);
      hz.connect(sg);   // the holes' static joins past the staircase, under the same envelope as the reel
      // Q0 — A STALL IS A LOST SIGNAL, NEVER A STUTTER. A media element that
      // runs dry mid-reception (a slow network under the reel, or a starved
      // decoder on a loaded machine: measured 30–130 ms underruns with the file
      // wholly buffered, at a load average of 30) hands the graph digital
      // silence under an open envelope — the voice simply stops and starts,
      // which is the one thing a receiver losing its station never does. So
      // the element's own `waiting` brings the band's static up over the hole
      // until `playing` lets it go, through the envelope like the drops'
      // static, so it is as loud as the reception is and silent where the
      // reception is. The event arrives after the underrun has begun — tens of
      // milliseconds of it are still silence — but what follows is the carrier
      // failing, not the tape skipping. Its own filter and gain off the SAME
      // noise source: no new source against the 110 ceiling.
      var sb = N(c.createBiquadFilter()), sz = N(c.createGain());
      sb.type = "bandpass"; sb.frequency.setValueAtTime(1300, t0); sb.Q.setValueAtTime(1.2, t0);
      sz.gain.setValueAtTime(0, t0);
      hn.connect(sb); sb.connect(sz); sz.connect(sg);
      if (v && !buffered) {
        var onDry = function () {
          if (a.dead) return;
          var n = c.currentTime; if (n < t0 - 0.3 || n > cut) return;
          try { sz.gain.cancelScheduledValues(n); sz.gain.setTargetAtTime(STALL_HISS, n, 0.012); } catch (e0) {}
          stats.stallCovered = (stats.stallCovered || 0) + 1;
        };
        var onWet = function () {
          if (a.dead) return;
          var n = c.currentTime;
          try { sz.gain.cancelScheduledValues(n); sz.gain.setTargetAtTime(0, n, 0.02); } catch (e0) {}
        };
        v.addEventListener("waiting", onDry); v.addEventListener("playing", onWet);
        own.off.push(function () { try { v.removeEventListener("waiting", onDry); v.removeEventListener("playing", onWet); } catch (e1) {} });
      }
      // Q0 — THE END OF THE MATERIAL IS THE END OF THE STATION. Where the last
      // piece's run cannot be kept inside its window (headPlan's overrunS: a
      // whole thought with a lingering exit after it, a window at the file's
      // head), the reel no longer runs on into the next window at full level —
      // a jump cut to another moment — or off the end of the file into
      // silence. It fades out over 0.35 s as it reaches the window's edge and
      // the band's static takes its place until the cut. The cut, the burst
      // and the dead tube keep their times.
      var HPe = headPlan(P, rate * headGlide(t0)), hLast = HPe[HPe.length - 1];
      if (hLast.overrunS > 0.05 && isFinite(hLast.edgePos)) {
        var tEdge = t0 + hLast.at + (hLast.edgePos - hLast.pos) / rate;
        if (tEdge < cut - 0.05) {
          var eg = N(c.createGain()), eA = Math.max(t0 + hLast.at, tEdge - 0.35);
          eg.gain.setValueAtTime(1, t0); eg.gain.setValueAtTime(1, eA); eg.gain.linearRampToValueAtTime(0, tEdge);
          sz.gain.setValueAtTime(0, eA); sz.gain.linearRampToValueAtTime(STALL_HISS, tEdge);
          cr.connect(eg); eg.connect(sg);
        } else cr.connect(sg);
      } else cr.connect(sg);
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
            if (a.dead) return;
            try { if (v && !v.paused && !buffered) v.playbackRate = rate * T.glideMul(tt); } catch (e) {}   // (decoded: picSync owns the picture's rate)
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
    var myLive = live = { a: a, nodes: nodes, hp: hp, end: end, bufSrc: bufSrc, bufSrcs: bufSrcs, timers: own.timers, off: own.off };
    lives.push(myLive);
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
    // THE HEAD, ON THE AUDIO CLOCK'S CUE (a setTimeout for the lookahead lead).
    // Where each piece starts in its reel and when is headPlan()'s (Q0): the
    // element is PAUSED on the in-point by the prefetch, and every move it makes
    // on the air is one of the moments below. Each action checks that this
    // reception is still alive and is recorded on its handle, so a teardown
    // cancels what has not happened yet instead of letting it land on an
    // element the next reception now owns.
    var HP = headPlan(P, rate * headGlide(t0));
    function onCue(at, fn) {
      T.lane("broadcast").at(at, function (t) {
        var lead = Math.max(0, (t - c.currentTime) * 1000);
        own.timers.push(setTimeout(function () { if (a.dead || !v) return; try { fn(); } catch (e) {} }, lead));
      });
    }
    onCue(t0 + HP[0].cueAt, function () {                    // CUE_LEAD_S early, threaded to match: on the plan when the snap opens
      if (buffered) hushElement(v);                         // 経路: the picture stays voiceless right up to the moment it moves
      if (Math.abs(v.currentTime - HP[0].cuePos) > 0.25) v.currentTime = HP[0].cuePos;
      // TAPE-STYLE: the pitch and the speed move together, which is the
      // whole idiom — a reel bent to the field also runs slow or fast, and
      // that is the sound of a machine, not a pitch-shifter.
      try { v.preservesPitch = false; v.mozPreservesPitch = false; v.webkitPreservesPitch = false; } catch (e2) {}
      v.playbackRate = rate * (T.glideMul ? T.glideMul(t0) : 1) * (buffered ? picSteady() : 1);   // (decoded: at the rate that undoes the machine's element clock, picSync's)
      var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
    // THE PIECES AFTER THE FIRST, in element mode: the reception returns to the
    // same frequency at a later moment of the source (戻) or crosses to another
    // reel entirely (走), and either way that is a src change and/or a seek on
    // the one element.
    //
    // Q0: THE MOVE IS MADE INSIDE THE GAP, NOT AT THE RELOCK. It used to be
    // scheduled 0.12 s before the relock, and a seek or a src swap takes what
    // it takes — a cold 走 reel is a fetch, a parse and a seek — while the
    // envelope climbs back to full over 0.2 s (戻) or 0.02 s (走) regardless.
    // Whatever the element had not finished was heard as the new piece arriving
    // late and snapping in under a full envelope. Now: a 走 swap loads its reel
    // as soon as the carrier has gone (0.15 s into the sweep, the reel warmed
    // into the cache at prefetch), and every piece is sought PREROLL_S before
    // its relock, to the point that reaches its in-point exactly at the lock —
    // so the element is already running when the envelope opens.
    for (i = 1; i < P.segments.length; i++) {
      (function (sgm, hp1, gp) {
        var rid = (sgm.reel && sgm.reel.id) || (a.reel && a.reel.id);
        if (videoSrcIds[vix] !== rid || (P.segments[0].reel && P.segments[0].reel.id !== rid)) {
          onCue(t0 + gp.atS + 0.15, function () {
            if (videoSrcIds[vix] !== rid) { videoSrcIds[vix] = rid; v.src = reelUrl(sgm.reel || a.reel); v.preload = "auto"; v.load(); }
          });
        }
        if (buffered) {
          // Q0 r3 — DECODED, THE PICTURE IS THREADED AND CUED, NOT PRE-ROLLED.
          // The pre-roll exists for a head that must be RUNNING when the
          // envelope opens; a decoded reel's head is a BufferSource, and the
          // element is only its picture. Pre-rolled, the picture ran from
          // wherever the seek landed: a landing that took L came in L late
          // (at-scope, host: −724 ms at the relock), and aiming L ahead lands
          // it ahead by the error in L (es-nodo's 走: +221 ms). So the element
          // is paused and sought to the relock's cue point as soon as the
          // carrier has gone (the tube is snow in a gap), and started at its
          // cue, as the first piece is: exact whenever the seek has landed by
          // then, which a whole gap usually allows.
          var seekB = Math.max(gp.atS + 0.02, Math.min(gp.atS + 0.2, hp1.cueAt - 0.05));
          onCue(t0 + seekB, function () {
            if (videoSrcIds[vix] !== rid) { videoSrcIds[vix] = rid; v.src = reelUrl(sgm.reel || a.reel); v.preload = "auto"; v.load(); }
            try { v.pause(); } catch (e0) {}
            v.currentTime = hp1.cuePos;
          });
          onCue(t0 + hp1.cueAt, function () {
            try { v.playbackRate = rate * (T.glideMul ? T.glideMul(t0 + hp1.at) : 1) * picSteady(); } catch (e1) {}
            var p2b = v.play(); if (p2b && p2b.catch) p2b.catch(function () {});
          });
          return;
        }
        onCue(t0 + hp1.seekAt, function () {
          if (videoSrcIds[vix] !== rid) { videoSrcIds[vix] = rid; v.src = reelUrl(sgm.reel || a.reel); v.preload = "auto"; v.load(); }
          v.currentTime = hp1.seekPos;
          var p2 = v.play(); if (p2 && p2.catch) p2.catch(function () {});
        });
      })(P.segments[i], HP[i], P.gaps[i - 1]);
    }
    // Q0 r2: a decoded reception's picture is kept on its sound (picSync)
    if (buffered && v) picSync({ v: v, t0: t0, P: P, HP: HP, rate: rate, timers: own.timers, alive: function () { return !a.dead; } });
    // the descriptor for the set and the VFD line 「受信 · title · year」
    var wire = planWire(P);
    var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: absDrops, id: a.reel.id, title: shortTitle(a.reel.title), year: a.reel.year, seed: a.seed, picture: true, video: v, rx: wire, reels: buffered ? "buffer" : "element",   // (reels: which head this one used — the page can be demoted mid-session, Q0 r2)
      head: HP.map(function (h) { return { at: +h.at.toFixed(3), pos: +h.pos.toFixed(3), overrunS: h.overrunS, edgePos: isFinite(h.edgePos) ? h.edgePos : null }; }) };   // Q0: where the tape was threaded (read by the probe; nothing reads it back)
    // §4.3 THE VFD SAYS WHAT SHAPE ARRIVED. 「受信 · title · year · 戻 47 s later
    // · 尺 over it」— the kanji is the log line, as it is everywhere else in this
    // station, and the plain words after it say what it means.
    var shapeLine = "";
    if (P.body !== "jou" || P.entry !== "soku" || P.exit !== "setsu" || P.porous || P.callback) {
      var bits = [];
      if (P.callback) bits.push("同 the same station again");
      if (P.entry !== "soku") bits.push(KANA[P.entry] + (P.entry === "tan" ? " hunting " : " drifting in ") + P.entryS.toFixed(1) + "s");
      if (P.body === "modori") { var lt = P.segments[1] && P.segments[1].laterS; bits.push(KANA.modori + " " + P.segments.length + " pieces" + (lt != null ? " · " + lt + " s later" : "")); }
      else if (P.body === "dan") bits.push(KANA.dan + " " + P.holes.length + " carrier loss" + (P.holes.length > 1 ? "es" : ""));
      else if (P.body === "sou") bits.push(KANA.sou + " scanning to " + (P.segments[1] && P.segments[1].reel ? shortTitle(P.segments[1].reel.title) : "another"));
      if (P.exit !== "setsu") bits.push(KANA[P.exit] + (P.exit === "zan" ? " lingering " + P.exitS.toFixed(1) + "s" : " cut mid-word"));
      if (P.porous) bits.push("尺 " + P.porous + " over it");
      shapeLine = bits.length ? " · " + bits.join(" · ") : "";
    }
    T.lane("broadcast").at(t0 - 0.15, function () {
      T.emitEvent({ cat: "rx", label: "受信", detail: shortTitle(a.reel.title) + " · " + a.reel.year + shapeLine, signal: desc, link: a.reel.src || null }, t0);
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
      T.emitEvent({ cat: "rx", label: "消失", detail: "signal lost · " + holdS.toFixed(1) + " s on air" +
        (P.spanS - holdS > 4 ? " · " + P.spanS.toFixed(1) + " s from the first static" : "") }, cut);
    });
    T.lane("broadcast").at(end + 0.5, function () { teardown(myLive); });   // THIS reception's, never whichever is `live` by then (Q0)
  }
  function warmPicture(v) { try { if (window.ZankyoSet && ZankyoSet.warm) ZankyoSet.warm(v); } catch (e) {} }   // S3: one offscreen drawImage now, so the first frame at t0 does not stall
  function shortTitle(t) { t = String(t || ""); var i = t.indexOf(" ("); if (i > 0) t = t.slice(0, i); i = t.indexOf(","); if (i > 0) t = t.slice(0, i); return t; }
  // Q0 — A TEARDOWN TEARS DOWN ITS OWN RECEPTION. It used to take whatever
  // `live` held when its lane fired, so a reception seated before the last one
  // had finished (the bench's PLAY NOW, whose lead still reads the loss off the
  // pre-shape hold and so undershoots a shaped one) was killed by its
  // PREDECESSOR's teardown a few seconds after it came up: element paused,
  // graph cut, the rest of its hold silent. Each reception now carries its own
  // handle; `live` is only "the latest", and stop() walks them all.
  var lives = [];
  function teardown(L) {
    if (!L) L = live;
    if (!L) return;
    var li = lives.indexOf(L); if (li >= 0) lives.splice(li, 1);
    if (live === L) live = lives.length ? lives[lives.length - 1] : null;
    for (var ti = 0; ti < (L.timers || []).length; ti++) { try { clearTimeout(L.timers[ti]); } catch (e0) {} }
    for (var oi = 0; oi < (L.off || []).length; oi++) { try { L.off[oi](); } catch (e1) {} }
    var vix = L.a.vidx || 0;
    if (videos[vix]) { try { videos[vix].pause(); } catch (e) {} }
    if (L.bufSrcs) for (var bs2 = 0; bs2 < L.bufSrcs.length; bs2++) { try { L.bufSrcs[bs2].stop(); } catch (e) {} }
    try { if (mediaSrcs[vix] && L.hp) mediaSrcs[vix].disconnect(L.hp); } catch (e) {}
    for (var i = 0; i < L.nodes.length; i++) { try { L.nodes[i].disconnect(); } catch (e2) {} }
    L.a.dead = true; qDrop(L.a);
  }
  function stop() {
    while (lives.length) teardown(lives[lives.length - 1]);
    live = null;
    audCancel(true);                              // an audition does not outlive the station either
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
    var sa = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5, shape: manualShape(R.fork("shape")) }, t0), R);
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
      var ba = arm(withDeadlines({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5, shape: benchShape || manualShape(R.fork("shape")) }, t0), R);
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
  //
  // Q0: the audition plays on its OWN element (AUD), never on one a broadcast
  // may hold — a press of 受信 while a broadcast is armed lands here, and it
  // used to take element 0 out from under it (see the elements' header). One
  // audition at a time: starting one hands over from the last cleanly (its
  // envelope closed over 30 ms, its pending seeks and pause cancelled), where
  // the old one's timers used to keep firing into the new one's element.
  // `needPicture` is dialAudition's retry: when the reel drawn has no picture
  // this returns "retry" AFTER every draw and BEFORE building anything, so the
  // sample stream advances exactly as it did — where the old loop built each
  // audio-only audition it passed over and left it running under the next.
  var aud = null, audSeq = 0;
  function audCancel(pauseToo) {
    audSeq++;
    var A = aud; aud = null;
    if (!A) return;
    var c = tl().ctx;
    for (var i = 0; i < A.timers.length; i++) { try { clearTimeout(A.timers[i]); } catch (e) {} }
    try { var n = c.currentTime; A.sg.gain.cancelScheduledValues(n); A.sg.gain.setValueAtTime(A.sg.gain.value, n); A.sg.gain.linearRampToValueAtTime(0, n + 0.03); } catch (e1) {}
    setTimeout(function () {
      try { if (A.bufSrc) A.bufSrc.stop(); } catch (e0) {}
      try { if (mediaSrcs[AUD] && A.hp) mediaSrcs[AUD].disconnect(A.hp); } catch (e2) {}
      for (var k = 0; k < A.nodes.length; k++) { try { A.nodes[k].disconnect(); } catch (e3) {} }
    }, 80);
    if (pauseToo) { try { if (videos[AUD]) videos[AUD].pause(); } catch (e4) {} }
  }
  function sampleTune(t, needPicture) {
    var T = tl(), c = T.ctx; if (!c) return false;
    loadPool();
    // 経路 buffer mode: the element is the picture only, and the audition's
    // audio comes from the same decoded buffer a real signal uses.
    var buffered = reelsBuffered();
    var v = ensureVideo(AUD), ms = ensureMediaSource(c, AUD);
    var R = T.S ? T.S.sample : PJ.Rand.stream((Date.now() % 4294967295) >>> 0);
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next();
    var holdS = 8 + rHold * 4, lossD = LOSS_MIN_S + rLoss * LOSS_SPAN_S;
    // how long this audition owns the air: the ledge's button reads it so a
    // second press inside the window does not lay a second reel over this one
    auditionEnd = t + TUNE_S + holdS + lossD + COLLAPSE_S + BURST_S;
    if (poolState !== "ready" || !v || (!buffered && !ms) || !pool.length) { auditionEnd = t + 1.0; staticRise(t, t + 1.0); return true; }   // the dial turns, nothing found
    // ?reel= pins the audition too, and on EVERY press — unlike the on-air pin,
    // which is spent once. rReel is still drawn above, so the sample stream is
    // where it would have been.
    var pinA = pinnedReel();
    // 選局番号 bites on the audition as well (rc.77): the button on the ledge
    // reaches this path whenever a real seat cannot be had, and a press at 08
    // that came back with a Brazilian reel would make the number a liar. ONE
    // narrowing, the SAME localeNarrow() the lottery uses — and the same
    // retreat to the whole pool when the number holds nothing usable.
    var cands = localeNarrow(pool) || pool;
    var reel = pinA || cands[Math.floor(rReel * cands.length)];
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
    var wl = (win[1] - win[0]);
    // §7 q5 — THE ♪ BUTTON PLAYS THE NEW SHAPES. The audition's job is to show
    // what a signal IS, and what a signal is has changed: a budget from §2's
    // table, a body, an entry and an exit, and the same degrade ladder when
    // this window cannot carry them. It draws on the SAMPLE stream, so the
    // button is reproducible from the seed like everything else, and it walks
    // the same planShaped() the air walks — an audition with its own idea of a
    // reception would be an audition of something the station never plays.
    var aSh = SHAPES_ON ? manualShape(R.fork("shape:" + dialPresses + ":" + Math.floor(t * 100))) : null;
    var aEc = TUNE_S, aXc = lossD, lossD0 = lossD;   // lossD0: the 切 this audition drew, for a fallback or a fit (Q0 r2)
    if (aSh && !awhole) {
      aSh = degradeShape(aSh, wl, lossD);
      aEc = Math.min(aSh.entryS, ENTRY_COST[aSh.entry] != null ? ENTRY_COST[aSh.entry] : TUNE_S);
      aXc = exitCost(aSh.exit, aSh.exitS);
      lossD = aSh.exitS;
      holdS = Math.min(aSh.budgetS, Math.max(3, windowServes(aSh, wl, aEc, aXc)));
    }
    var need = aEc + holdS + aXc;
    if (awhole) { holdS = Math.min(wl, WHOLE_MAX_HOLD_S); need = TUNE_S + holdS + lossD; aSh = null; }
    else if (need > wl) need = wl;
    var inS = awhole ? win[0] : win[0] + rIn * Math.max(0, wl - need - 0.5);
    var aP = aSh ? planShaped(aSh, R.fork("apieces:" + dialPresses + ":" + Math.floor(t * 100)), {
      reel: reel, win: win, wi: awi, rate: 1, inS: inS, onS: holdS, exitS: lossD, lossD: lossD0,
      pickOther: function (u) { if (pool.length < 2) return null; var j = Math.floor(u * pool.length); if (pool[j] === reel) j = (j + 1) % pool.length; return pool[j]; }
    }) : planOne(reel, inS, holdS, lossD);
    holdS = aP.presenceS; lossD = aP.exitS;
    // the same dropout plan a real signal gets, so the picture stutters
    var adrops = [], dt = aP.entryS + 0.6;
    while (dt < aP.lossAtS) { dt += 1.2 + R.next() * 3.2; if (dt < aP.lossAtS && !inGap(aP, dt)) adrops.push([dt, 0.12 + R.next() * 0.25]); }
    // EVERY DRAW IS ABOVE THIS LINE. build() may run now or a fetch later, and
    // it takes no draws of its own — so a deferred audition is the same
    // audition, just further down the clock, and the sample stream is left
    // exactly where an undeferred one would leave it.
    if (needPicture && reel.audioOnly) { lastSampleAudioOnly = true; return "retry"; }
    // Q0 r2 — THE PRESS IS ANSWERED, AND STILL NEVER OVER A BROADCAST. rc.95
    // refused any audition that would reach an armed broadcast's static lead
    // and answered the press "live", with the broadcast up to 27 s away:
    // measured by the critic, 7 of 44 presses made while nothing was on the
    // air got no reel for 6.0–26.7 s, three of them after dial() had already
    // said "audition" (the late decode was then refused at build). rc.91 on the
    // same seed: 0 of 25. The owner's rule for this button since rc.77 is "play
    // a clip 100 % when pushed right when pushed". So the audition is FITTED
    // into the room before the broadcast (audFit): its reel is cut, collapses
    // and bursts AUD_CLEAR_S ahead of the broadcast's t0 — over the broadcast's
    // own static rise, which is the dial leaving one station for the next,
    // never two stations at once. Only when even the shortest audition (an
    // AUD_MIN_HOLD_S glimpse) cannot fit, which is a broadcast under six
    // seconds away, is the press left to the broadcast. A decode that lands
    // late is re-fitted to the room it lands in rather than dropped. The
    // audition takes no engine draws, so none of this can move the music.
    var playing = !!(T.playing && T.playing());
    var roomAt = function (t0a) { return playing ? audRoom(t0a) : Infinity; };   // the room an audition starting at t0a has
    var adrops0 = adrops, HP = null;
    var apply = function (P2) {
      aP = P2; holdS = aP.presenceS; lossD = aP.exitS; HP = headPlan(aP, 1);
      adrops = adrops0.filter(function (d) { return d[0] < aP.lossAtS && !inGap(aP, d[0]); });   // drawn on the unfitted plan: the stream stays where it was
    };
    var fitted = audFit(aP, reel, lossD0, roomAt(t + 1.0));
    if (!fitted) { stats.audBlocked = (stats.audBlocked || 0) + 1; return "blocked"; }   // after every draw, as the retry is
    // Q0 r3 — AND FITTED TO WHEN THE REEL WILL BE HERE, NOT WHEN THE HAND WAS.
    // r2 fitted the audition at the press and re-fitted it when its decode
    // landed; on the host profile the decode took 3.2–3.8 s of a 6.5 s room,
    // the re-fit found 2.5 s (under the 3.7 s glimpse) and the press that
    // dial() had answered "audition" sounded nothing — 3 of 8 presses made with
    // nothing on the air, the next reel 6.1–8.7 s after the hand (critic, r2,
    // press 777 host). So the fit is made at the press against the room that
    // will be left when the reel can sound: audEta(), from what the last
    // fetches and decodes on this page actually took. Where the drawn reel
    // cannot sound within AUD_ANSWER_S of the press, or will not fit when it
    // does, the press is answered from a reel ALREADY DECODED (audStandIn):
    // the dial finding a station it has had before. It is planned as a plain
    // hold at the window and in-point this press drew, with its drops on a
    // fork of the sample stream, so the stream is where the drawn audition
    // leaves it. Only where there is none is the drawn reel sent anyway.
    // (and if the estimate was wrong — a machine under load decoded a local
    // reel in 7.4 s against 0.25 s measured — the same stand-in answers the
    // press AUD_RESCUE_S after it, below: the drawn reel is never waited on
    // past the six seconds)
    var standIns = 0;
    var standInFor = function (room) {
      return audStandIn(reel, pinA ? [] : cands, rWin, rIn, lossD0, R.fork("aud-standin:" + dialPresses + ":" + Math.floor(t * 100) + (standIns ? ":" + standIns : "")), room);
    };
    var takeStandIn = function (sub) {
      // …and the reel this press drew is still fetched and decoded, into the
      // cache: the next stand-in is the station this hand reached for (without
      // it the cache never turns over, and every stand-in on a slow night was
      // the same reel — cfu-dollar-bill six times in 600 s)
      var drawnReels = planReels(aP);
      for (var dq = 0; dq < drawnReels.length; dq++) decodeReel(drawnReels[dq].id, c).then(null, function () {});
      reel = sub.reel; adrops0 = sub.drops; awhole = false; standIns++; stats.audStandIn = (stats.audStandIn || 0) + 1;
      return sub.P;
    };
    if (buffered && playing) {
      // (the estimate with a margin: a quarter again and 0.2 s, since a reel
      // that lands later than its estimate is the dead press this is here for)
      var eta = audEta(planReels(aP)), t0p = Math.max(t + 1.0, eta > 0 ? t + eta * 1.25 + 0.2 + AUD_LATE_S : 0);
      if (t0p - t > AUD_ANSWER_S || !audFit(aP, reel, lossD0, roomAt(t0p))) {
        var sub = standInFor(roomAt(t + 1.0));
        if (sub) { fitted = takeStandIn(sub); aP = fitted; }
        else if (roomAt(t) + AUD_CLEAR_S <= AUD_WAIT_S) {
          // no stand-in, and a broadcast within six seconds of the hand: the
          // press is the broadcast's ("live"), not a reel that would land too
          // late to fit before it and be dropped
          stats.audBlocked = (stats.audBlocked || 0) + 1; return "blocked";
        }
      }
    }
    apply(fitted);
    auditionEnd = t + 1.0 + aP.spanS + COLLAPSE_S + BURST_S;
    if (pinA) T.emitEvent({ cat: "rx", label: "受信 pinned", detail: reel.id + (awhole ? " · whole · " : " · ") + holdS.toFixed(1) + "s · audition" }, t);
    audCancel(false);                     // the last audition hands over; this one owns AUD from here
    var tok = ++audSeq;
    var audBufs = {};                     // this audition's buffers, held here: the two-reel cache may turn over while it waits
    var lateRescue = null;                // (Q0 r3) set by the decoded path: a stand-in for a reel that came too late
    function build(tt, staticDone, lead) {
      if (tok !== audSeq) return false;   // a newer press has the element
      lead = lead || 1.0;
      if (playing) {                      // landed late: re-fitted to the room it has now (Q0 r2), never dropped for being late
        var P2 = audFit(aP, reel, lossD0, roomAt(tt + lead));
        if (!P2) {
          if (lateRescue && lateRescue()) return true;   // (Q0 r3: whatever still fits, from the decode cache)
          stats.audLate = (stats.audLate || 0) + 1; (stats.audLateAt = stats.audLateAt || []).push(+t.toFixed(2)); return false;
        }
        apply(P2);
      }
      var me = { timers: [], nodes: null, hp: null, sg: null, bufSrc: null };
      var t0 = tt + lead, tuneEnd = t0 + aP.spanS;
      var nodes = [], hp, lp, pre, sh, sg, bufSrc = null;
      try {
        hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(700, t0); hp.frequency.linearRampToValueAtTime(260, t0 + 0.8);
        lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1600, t0); lp.frequency.linearRampToValueAtTime(4700, t0 + 0.8);
        pre = c.createGain(); pre.gain.setValueAtTime(0.5, t0);
        sh = c.createWaveShaper(); var cv = new Float32Array(1024); for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; cv[i] = Math.tanh(x * 3.5) / Math.tanh(3.5); } sh.curve = cv;
        sg = c.createGain(); var peak = 0.35 * db2lin(reel.gain) * 1.6 * REEL_VOL;
        PJ.Voice.env(sg.gain, t0, planEnv(aP, peak));
        nodes = [hp, lp, pre, sh, sg];
        var head = ms;
        if (buffered) {
          // one source per piece, exactly as the air does it
          for (var aq = 0; aq < aP.segments.length; aq++) {
            var aid = (aP.segments[aq].reel && aP.segments[aq].reel.id) || reel.id, abuf = audBufs[aid] || bufCache[aid];
            if (!abuf) continue;
            var abs = c.createBufferSource(); abs.buffer = abuf;
            nodes.push(abs); abs.start(t0 + HP[aq].at, HP[aq].pos); abs.stop(t0 + aP.segments[aq].srcToS);
            abs.connect(hp); if (!bufSrc) bufSrc = abs;
          }
          head = null;
        }
        if (head) head.connect(hp);
        hp.connect(lp); lp.connect(pre); pre.connect(sh);
        // the window's edge, as on the air (Q0): a run the window cannot hold
        // fades out as it reaches the edge instead of jumping the cut (audEdge
        // keeps that edge past the audible part of the exit, Q0 r2)
        var hLa = HP[HP.length - 1], tEa = t0 + hLa.at + (hLa.edgePos - hLa.pos);
        if (hLa.overrunS > 0.05 && isFinite(hLa.edgePos) && tEa < tuneEnd - 0.05) {
          var ega = c.createGain(); nodes.push(ega);
          ega.gain.setValueAtTime(1, t0); ega.gain.setValueAtTime(1, Math.max(t0, tEa - 0.35)); ega.gain.linearRampToValueAtTime(0, tEa);
          sh.connect(ega); ega.connect(sg);
        } else sh.connect(sg);
        sg.connect(T.lg("broadcast"));
      } catch (e) { return false; }
      me.nodes = nodes; me.hp = hp; me.sg = sg; me.bufSrc = bufSrc; aud = me;
      auditionEnd = tuneEnd + COLLAPSE_S + BURST_S;         // the real end, if the reel arrived late
      if (!staticDone) staticRise(tt, t0);
      // Q0 r2 — ON THE AUDIO CLOCK, NOT THE WALL'S. A timeout is wall time and
      // the moments here are audio time, and the two part company whenever the
      // audio thread falls behind: measured on the probe, the context clock ran
      // at about 0.6× the wall for several seconds (host profile, load ~50),
      // and the audition's own end — its audCancel — fired 2.55 s early in
      // audio time: the reel cut to silence mid-word at full level, 1.6 s of
      // nothing before the tube's collapse. (A Bluetooth route, whose clock the
      // context follows, can do the same.) So a timeout that wakes before its
      // moment on the audio clock sleeps again for what is left.
      var at = function (ts, fn) {
        var arm = function () {
          if (aud !== me) return;
          var left = ts - c.currentTime;
          if (left > 0.015) { me.timers.push(setTimeout(arm, left * 1000)); return; }
          try { fn(); } catch (e) {}
        };
        me.timers.push(setTimeout(arm, Math.max(0, (ts - c.currentTime) * 1000)));
      };
      // THE ELEMENT, on the plan's moments (headPlan): the first piece from
      // where it has to start to reach its in-point at the lock, the later
      // ones sought inside their gap, and a 走 swapped onto its SECOND REEL —
      // which it never was: the audition sought reel 1 to reel 2's in-point,
      // and a reel 2 window past reel 1's end played nothing at all.
      at(t0 + HP[0].cueAt, function () {
        if (buffered) hushElement(v);
        if (videoSrcIds[AUD] !== reel.id) { videoSrcIds[AUD] = reel.id; v.src = reelUrl(reel); v.preload = "auto"; v.load(); }
        if (Math.abs(v.currentTime - HP[0].cuePos) > 0.25) v.currentTime = HP[0].cuePos;
        try { v.playbackRate = buffered ? picSteady() : 1; } catch (e1) {}   // (a decoded audition's picture was nudged; the next one starts square — at the steady rate, Q0 r3)
        warmPicture(v);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
      for (var sq = 1; sq < aP.segments.length; sq++) (function (sgm, h, gp) {
        var rid = (sgm.reel && sgm.reel.id) || reel.id;
        if (rid !== reel.id && gp) at(t0 + gp.atS + 0.15, function () { if (videoSrcIds[AUD] !== rid) { videoSrcIds[AUD] = rid; v.src = reelUrl(sgm.reel); v.preload = "auto"; v.load(); } });
        if (buffered) {                   // (Q0 r3: threaded and cued, as the air's decoded relock)
          at(t0 + Math.max(gp.atS + 0.02, Math.min(gp.atS + 0.2, h.cueAt - 0.05)), function () {
            if (videoSrcIds[AUD] !== rid) { videoSrcIds[AUD] = rid; v.src = reelUrl(sgm.reel || reel); v.preload = "auto"; v.load(); }
            try { v.pause(); } catch (e0) {}
            v.currentTime = h.cuePos;
          });
          at(t0 + h.cueAt, function () { try { v.playbackRate = picSteady(); } catch (e1) {} var p3b = v.play(); if (p3b && p3b.catch) p3b.catch(function () {}); });
          return;
        }
        at(t0 + h.seekAt, function () {
          if (videoSrcIds[AUD] !== rid) { videoSrcIds[AUD] = rid; v.src = reelUrl(sgm.reel || reel); v.preload = "auto"; v.load(); }
          v.currentTime = h.seekPos; var p3 = v.play(); if (p3 && p3.catch) p3.catch(function () {});
        });
      })(aP.segments[sq], HP[sq], aP.gaps[sq - 1]);
      // Q0 r2: a decoded audition's picture is kept on its sound, as the air's is
      if (buffered) picSync({ v: v, t0: t0, P: aP, HP: HP, rate: 1, timers: me.timers, alive: function () { return aud === me; } });
      lastSampleAudioOnly = !!reel.audioOnly; lastAudId = reel.id;
      var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: adrops, id: reel.id, title: shortTitle(reel.title), year: reel.year, seed: rIn * 1000, picture: true, video: v, rx: planWire(aP), reels: buffered ? "buffer" : "element",
        head: HP.map(function (h) { return { at: +h.at.toFixed(3), pos: +h.pos.toFixed(3), overrunS: h.overrunS, edgePos: isFinite(h.edgePos) ? h.edgePos : null }; }) };
      T.emitEvent({ cat: "rx", label: "♪ 受信", detail: shortTitle(reel.title) + " · " + reel.year +
        (aP.body !== "jou" || aP.entry !== "soku" || aP.exit !== "setsu" ? " · " + KANA[aP.entry] + KANA[aP.body] + KANA[aP.exit] + " · " + aP.presenceS.toFixed(1) + "s on air" : ""),
        signal: desc, link: reel.src || null }, t0);
      at(tuneEnd + COLLAPSE_S + 0.4, function () { audCancel(true); });
      return true;
    }
    // Q0 — THE ELEMENT PATH. The audition used to build its envelope for one
    // second after the press and ask the element to be there by then; a reel
    // that took longer (a cold fetch on the host, a slow connection) came in
    // late under an envelope already at full, snapping in mid-word. If the
    // element is not already threaded on this reel at the start point, the
    // dial turns now and the audition is built the moment the seek lands — or
    // not at all, if that takes longer than AUD_WAIT_S: a reception that
    // arrives six seconds after the hand has left the button is not an answer
    // to it.
    function viaElement() {
      auditionEnd = t + 1.0;
      var asked = c.currentTime;
      try {
        if (videoSrcIds[AUD] !== reel.id) { videoSrcIds[AUD] = reel.id; v.src = reelUrl(reel); v.preload = "auto"; v.load(); }
        var seek = function () {
          if (tok !== audSeq) return;
          var landed = function () {
            try { v.removeEventListener("seeked", landed); } catch (e) {}
            if (tok !== audSeq || c.currentTime - asked > AUD_WAIT_S) return;
            // in time for the tune-in the press already started: the audition
            // it would have been; later, a fresh tune-in from where it landed
            try { if (c.currentTime < t + 0.85) build(t, true); else build(c.currentTime + 0.15); } catch (e2) {}
          };
          v.addEventListener("seeked", landed);
          v.currentTime = HP[0].cuePos;
        };
        if (v.readyState >= 1) seek();
        else v.addEventListener("loadedmetadata", function once() { try { v.removeEventListener("loadedmetadata", once); } catch (e) {} seek(); });
      } catch (e3) {}
    }
    // In buffer mode an undecoded reel means a fetch of a megabyte or so
    // before there is anything to sound. The dial turns NOW — the press must
    // answer immediately — and the reel arrives behind it.
    // (Q0: every reel the audition plays, which for a 走 is two — the second
    // used to fall back to the FIRST reel's buffer at the second's in-point.)
    // Q0 r2 — AND THE PICTURE IS THREADED BEFORE THE SOUND STARTS. It used to
    // be loaded at the cue, 0.2 s before the sound, and a load and a seek take
    // 0.2–1.1 s: the critic measured every decoded audition's picture running
    // 0.2–4.6 s behind its sound for the whole audition. Now the element is
    // loaded and sought to the cue point as soon as the reel's bytes are in —
    // AFTER the decode's fetch, so it reads them from the cache rather than
    // halving a slow connection with a second download of the same file
    // (measured on the host profile: a press answered 9.1 s later with both
    // at once) — and the audition starts when both are ready, or
    // AUD_PIC_WAIT_S after the sound is if the picture is slower than that
    // (picSync then brings it in: the picture is decoration, and it does not
    // get to hold the press).
    if (buffered) {
      var aReels = planReels(aP), aMissing = [], ri;
      for (ri = 0; ri < aReels.length; ri++) { if (bufCache[aReels[ri].id]) audBufs[aReels[ri].id] = bufCache[aReels[ri].id]; else aMissing.push(aReels[ri]); }
      var decReady = !aMissing.length, picReady = false, decAt = decReady ? c.currentTime : null, started = false, waitT = null;
      var go = function () {
        if (tok !== audSeq || started || !decReady) return;
        if (!picReady && c.currentTime < decAt + AUD_PIC_WAIT_S) {
          if (waitT == null) waitT = setTimeout(function () { picReady = true; go(); }, Math.max(0, (decAt + AUD_PIC_WAIT_S - c.currentTime) * 1000));
          return;
        }
        started = true;
        // (Q0 r3: a late one tunes in on a short rise — the dial already turned
        // at the press — rather than a second full second of it)
        try { if (c.currentTime < t + 0.85) build(t, true); else build(c.currentTime + 0.05, false, AUD_LATE_S); } catch (e) {}
      };
      staticRise(t, t + 1.0);
      var thread = function () { if (started) return; threadAud(v, reel, HP[0].cuePos, function () { return tok === audSeq; }, function () { picReady = true; go(); }); };
      // Q0 r3 — THE RESCUE. A drawn reel still not sounding AUD_RESCUE_S after
      // the press (the estimate was wrong: a starved decoder, a fetch queued
      // behind another), or one that lands where it no longer fits, gives the
      // press to a decoded stand-in: tuned in AUD_LATE_S later, its picture
      // left to picSync. Once a press; the drawn reel's decode runs on into
      // the cache.
      var rescued = false;
      var rescue = function (fromBuild) {
        if (tok !== audSeq || rescued || (started && !fromBuild)) return false;
        var tt = c.currentTime + 0.05, sub = standInFor(roomAt(tt + AUD_LATE_S));
        if (!sub) return false;
        rescued = true; started = true; decReady = true; picReady = true;
        apply(takeStandIn(sub)); audBufs[reel.id] = bufCache[reel.id];
        stats.audRescued = (stats.audRescued || 0) + 1;
        try { return build(tt, false, AUD_LATE_S) !== false; } catch (e) { return false; }
      };
      lateRescue = function () { return rescue(true); };
      if (aMissing.length) {
        (function poll() {
          if (tok !== audSeq || started) return;
          if (c.currentTime >= t + AUD_RESCUE_S) { rescue(false); return; }
          setTimeout(poll, 200);
        })();
        // (Q0 r3: the picture is threaded the moment the first reel's BYTES
        // are in — from the cache, beside the decode — not after the decode)
        var r0id = (aP.segments[0].reel && aP.segments[0].reel.id) || reel.id;
        if (!bufCache[r0id]) onReelBytes(r0id, thread); else thread();
        Promise.all(aMissing.map(function (r) { return decodeReel(r.id, c).then(function (b) { audBufs[r.id] = b; }); })).then(function () {
          decReady = true; decAt = c.currentTime; go();
        }, function () {
          // Q0 r2: a decoder that refused the reel has demoted the page (decodeReel);
          // this press is then answered through the element, like every one after it
          if (tok !== audSeq || started || reelsBuffered()) return;
          buffered = false; ms = ensureMediaSource(c, AUD);
          if (ms) viaElement();
        });
      } else { thread(); go(); }
      return true;
    }
    if (!(videoSrcIds[AUD] === reel.id && v.readyState >= 3 && Math.abs(v.currentTime - HP[0].cuePos) < 0.25)) {
      staticRise(t, t + 1.0);
      viaElement();
      return true;
    }
    return build(t);
  }
  var AUD_WAIT_S = 6, AUD_PIC_WAIT_S = 1.5, lastAudId = null;
  // Q0 r3: a reel that lands after the press tunes in AUD_LATE_S after it
  // lands; a press must sound within AUD_ANSWER_S (the critic's six seconds,
  // less half a second for the estimate) or be answered by a decoded stand-in.
  var AUD_LATE_S = 0.6, AUD_ANSWER_S = 5.5, AUD_RESCUE_S = 4.5;
  // HOW LONG UNTIL THESE REELS CAN SOUND, in audio seconds from now: the bytes
  // at the rate this page's fetches have actually run (reelNet, the slower of
  // the last and the average), the decode, and the picture's thread — which
  // the audition waits for, up to AUD_PIC_WAIT_S. 0 when all are decoded.
  function decEta(reels) {                             // the bytes and the decode only (a broadcast's decide() waits for no picture)
    var bytes = 0, i;
    for (i = 0; i < reels.length; i++) if (reels[i] && !bufCache[reels[i].id]) bytes += reels[i].bytes || 1.2e6;
    return bytes ? bytes * Math.max(reelNet.spb, reelNet.spbLast) + Math.max(reelNet.dec, reelNet.decLast) : 0;
  }
  function audEta(reels) {
    var e = decEta(reels); if (!e) return 0;
    var dec = Math.max(reelNet.dec, reelNet.decLast);
    return e + Math.min(AUD_PIC_WAIT_S, Math.max(0, landUp() + 0.2 - dec));   // (the thread starts with the bytes, beside the decode)
  }
  // A DECODED STAND-IN: a reel in the decode cache with a picture, among the
  // reels this press could have drawn (選局番号's narrowing; none when ?reel=
  // pins it) — not one a queued broadcast is about to air, unless nothing
  // else is there — as a plain hold at the drawn window and in-point, fitted
  // to the room at the press. The drops are drawn on the fork it is handed.
  // null if none fits.
  function audStandIn(drawn, among, rWin, rIn, lossD0, Rf, room) {
    var held = {}, i, q, cand = [];
    for (q = 0; q < armedQ.length; q++) if (!armedQ[q].dead && armedQ[q].reel) { held[armedQ[q].reel.id] = 1; if (armedQ[q].rx && armedQ[q].rx.reel2) held[armedQ[q].rx.reel2.id] = 1; }
    for (i = bufOrder.length - 1; i >= 0; i--) {
      var r = null; for (q = 0; q < pool.length; q++) if (pool[q].id === bufOrder[i]) { r = pool[q]; break; }
      if (r && bufCache[r.id] && !r.audioOnly && r !== drawn && r.windows && r.windows.length && among.indexOf(r) >= 0) cand.push(r);
    }
    cand.sort(function (x, y) { return ((held[x.id] ? 2 : 0) + (x.id === lastAudId ? 1 : 0)) - ((held[y.id] ? 2 : 0) + (y.id === lastAudId ? 1 : 0)); });   // not the one about to air, nor the last audition's, where there is a choice
    for (i = 0; i < cand.length; i++) {
      var rr = cand[i], wi = Math.floor(rWin * rr.windows.length), w = rr.windows[wi], wl = w[1] - w[0];
      var hold = Math.max(3, Math.min(8, wl - TUNE_S - lossD0 - 0.5)), inS = w[0] + rIn * Math.max(0, wl - (TUNE_S + hold + lossD0) - 0.5);
      var P0 = planOneFit(rr, { win: w, inS: inS, rate: 1, lossD: lossD0 }, hold, lossD0, "setsu");
      var P1 = audFit(P0, rr, lossD0, room);
      if (!P1) continue;
      var drops = [], dt = P1.entryS + 0.6;
      while (dt < P1.lossAtS) { dt += 1.2 + Rf.next() * 3.2; if (dt < P1.lossAtS) drops.push([dt, 0.12 + Rf.next() * 0.25]); }
      return { reel: rr, P: P1, drops: drops };
    }
    return null;
  }
  // The element threaded on a reel at a position, paused, and cb() once it is
  // there (at once, if it already is). `live()` says whether the caller still
  // wants it.
  function threadAud(v, reel, pos, live, cb) {
    try {
      try { v.pause(); } catch (e0) {}
      if (videoSrcIds[AUD] !== reel.id) { videoSrcIds[AUD] = reel.id; v.src = reelUrl(reel); v.preload = "auto"; v.load(); }
      else if (v.readyState >= 2 && !v.seeking && Math.abs(v.currentTime - pos) < 0.05) { cb(); return; }
      var seek = function () {
        if (!live()) return;
        var landed = function () { try { v.removeEventListener("seeked", landed); } catch (e) {} if (live()) cb(); };
        v.addEventListener("seeked", landed);
        v.currentTime = pos;
      };
      if (v.readyState >= 1) seek();
      else v.addEventListener("loadedmetadata", function once() { try { v.removeEventListener("loadedmetadata", once); } catch (e) {} seek(); });
    } catch (e) { cb(); }
  }
  // Q0 r2 — THE ROOM AN AUDITION HAS, from its t0 to the latest moment its
  // reel may still be cut: AUD_CLEAR_S before the next broadcast that has not
  // finished (its collapse and burst included), so the audition's own collapse
  // and burst are over half a second before that broadcast tunes in. One on
  // the air stays in the queue until its teardown, so it makes the room
  // negative until its burst is over — and no longer: a press in its dead
  // tube is a press onto nothing. (rc.95's airClash read the same queue.)
  var AUD_MIN_HOLD_S = 2.5, AUD_MIN_EXIT_S = 0.8, AUD_CLEAR_S = 0.5 + COLLAPSE_S + BURST_S;
  function audRoom(t0a) {
    var cutMax = Infinity;
    for (var i = 0; i < armedQ.length; i++) {
      var q = armedQ[i]; if (q.dead) continue;
      var st = q.t0 != null ? q.t0 : q.wantT0; if (st == null) continue;
      var sp = q.rx ? q.rx.spanS : TUNE_S + q.holdS + q.lossD;
      if (st + sp + COLLAPSE_S + BURST_S <= t0a - 1.0) continue;   // over before the press
      cutMax = Math.min(cutMax, st - AUD_CLEAR_S);
    }
    return cutMax - t0a;
  }
  function planCopy(P) {
    var Q = {}, k, i;
    for (k in P) if (Object.prototype.hasOwnProperty.call(P, k)) Q[k] = P[k];
    Q.segments = []; for (i = 0; i < P.segments.length; i++) { var s = {}; for (k in P.segments[i]) s[k] = P.segments[i][k]; Q.segments.push(s); }
    Q.gaps = []; for (i = 0; i < P.gaps.length; i++) Q.gaps.push({ atS: P.gaps[i].atS, durS: P.gaps[i].durS, sweep: P.gaps[i].sweep });
    Q.holes = []; for (i = 0; i < P.holes.length; i++) Q.holes.push({ atS: P.holes[i].atS, durS: P.holes[i].durS, relS: P.holes[i].relS });
    return Q;
  }
  // AN AUDITION IN THE ROOM IT HAS. Unchanged if it fits; else its pieces give
  // up seconds, the last first, down to three (the first) and two (the rest),
  // keeping the shape; else a plain hold from the same in-point with the 切 it
  // drew — the degrade ladder's last rung; else null (not even a glimpse
  // fits). Every audition then goes through audEdge. No draws.
  function audFit(P, reel, lossD0, room) {
    if (!P) return null;
    if (P.spanS <= room) return audEdge(planCopy(P));
    if (room < TUNE_S + AUD_MIN_HOLD_S + AUD_MIN_EXIT_S) return null;
    if (!P.holes.length) {
      var Q = planCopy(P), over = Q.spanS - room;
      for (var i = Q.segments.length - 1; i >= 0 && over > 0; i--) {
        var give = Math.min(over, Math.max(0, Q.segments[i].onS - (i === 0 ? 3 : 2)));
        Q.segments[i].onS -= give; over -= give;
      }
      planTimes(Q);
      if (Q.spanS <= room + 1e-6) return audEdge(Q);
    }
    var xS = (P.exit === "setsu") ? Math.min(P.exitS, lossD0) : lossD0;
    xS = Math.max(AUD_MIN_EXIT_S, Math.min(xS, room - TUNE_S - AUD_MIN_HOLD_S));
    var R1 = planOne(reel, P.segments[0].inS, Math.min(P.presenceS, room - TUNE_S - xS), xS);
    R1.budgetS = P.budgetS; R1.fell = (P.fell || []).concat(["the room before a broadcast"]);
    return audEdge(R1);
  }
  // Q0 r2 — AN AUDITION IS NEVER FADED OUT WHILE IT IS STILL AUDIBLE. Its
  // in-point and its hold are free (no engine draw rests on either), so where
  // the window's edge would come before the envelope falls under half of peak
  // (EXIT_AUDIBLE of the exit) the last piece gives up the difference, and
  // then the exit does. The critic measured 5.2–8.0 s of static at envelope
  // 0.81–0.86 on three auditions in 14; the gate for auditions is zero.
  function audEdge(P) {
    for (var n = 0; n < 4; n++) {
      var H = headPlan(P, 1), h = H[H.length - 1];
      if (!(h.overrunS > 0.05) || !isFinite(h.edgePos)) return P;
      var tEdge = h.at + (h.edgePos - h.pos), want = P.lossAtS + EXIT_AUDIBLE * P.exitS + 0.2;
      var short = want - tEdge; if (short <= 0.02) return P;
      var sg = P.segments[P.segments.length - 1], floor = P.segments.length === 1 ? 3 : 2;
      if (P.holes.length) { var lh = P.holes[P.holes.length - 1]; floor = Math.max(floor, lh.relS + lh.durS + 1.5 - (sg.holeS || 0)); }
      var give = Math.min(short, Math.max(0, sg.onS - floor));
      sg.onS -= give; short -= give;
      if (short > 0.02) P.exitS = Math.max(AUD_MIN_EXIT_S, P.exitS - short / EXIT_AUDIBLE);
      planTimes(P);
      for (var hh = 0; hh < P.holes.length; hh++) P.holes[hh].atS = +(P.segments[0].atS + P.holes[hh].relS).toFixed(3);
    }
    return P;
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
    // 選局番号 — the ledge's unlabelled stepper. zankyo-ui.js owns the plastic;
    // what a number MEANS lives here, with the lottery that answers it.
    setLocale: setLocale,
    getLocale: function () { return localeN; },
    localeMax: LOCALE_MAX,
    localeState: function () { return { n: localeN, geo: geoState, placed: geoLoc ? Object.keys(geoLoc).length : 0 }; },
    drawShape: drawShape,
    shrinkShape: shrinkShape,
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
      // §4.3 THE BENCH SEATS A SHAPE. The owner asks for a body, a budget, an
      // entry and an exit by name and hears exactly that reception on exactly
      // that window — the only way to A/B 戻 against 常 on the same material,
      // which is the whole reason the lab exists. Everything else is still the
      // production path: the same choose(), the same ladder when the window is
      // too short, the same hold, tube and VFD.
      shapeFor: function (opts) {
        opts = opts || {};
        var b = opts.budgetS != null ? Math.max(BUDGET_MIN_S, Math.min(BUDGET_MAX_S, +opts.budgetS)) : 20;
        var body = opts.body || "jou", entry = opts.entry || "soku", exit = opts.exit || "setsu";
        var entryS = entry === "soku" ? TUNE_S : entry === "tan" ? (HUNT_MIN_S + HUNT_MAX_S) / 2 : (DRIFT_MIN_S + DRIFT_MAX_S) / 2;
        var exitS = exit === "setsu" ? (LOSS_MIN_S + LOSS_SPAN_S * 0.5) : exit === "zan" ? (ZAN_MIN_S + ZAN_MAX_S) / 2 : ZETSU_S;
        var gaps = [], holes = [], pieces = 1;
        if (body === "modori") { pieces = opts.pieces === 3 ? 3 : 2; for (var g = 0; g < pieces - 1; g++) gaps.push((MOD_GAP_MIN_S + MOD_GAP_MAX_S) / 2); }
        else if (body === "sou") { pieces = 2; gaps.push((SCAN_SWEEP_MIN_S + SCAN_SWEEP_MAX_S) / 2); }
        else if (body === "dan") { holes = [(HOLE_MIN_S + HOLE_MAX_S) / 2]; }
        var lockS = body === "modori" ? MOD_RELOCK_S : 0, gapS = 0, i;
        for (i = 0; i < gaps.length; i++) gapS += gaps[i] + lockS;
        var holeS = 0; for (i = 0; i < holes.length; i++) holeS += holes[i];
        var spanS = entryS + b + gapS + holeS + exitS;
        return { budgetS: b, body: body, entry: entry, exit: exit, entryS: entryS, exitS: exitS, gaps: gaps, holes: holes,
          pieces: pieces, lockS: lockS, spanS: spanS, leadS: STATIC_LEAD_S, holdLeadS: HOLD_LEAD_S,
          tailS: COLLAPSE_S + BURST_S + DEAD_S, reachS: spanS + HOLD_TAIL_S + (REL_MIN_S + REL_SPAN_S) };
      },
      setBenchShape: function (sh) { benchShape = sh || null; return true; },
      bodies: function () { return { body: Object.keys(BODY_W), entry: Object.keys(ENTRY_W), exit: Object.keys(EXIT_W), kana: KANA,
        budget: [BUDGET_MIN_S, BUDGET_MAX_S] }; },
      seatWindow: function (reelId, wi, opts) {
        opts = opts || {};
        if (opts.shape !== undefined) benchShape = opts.shape;
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
        if (opts.shape !== undefined) benchShape = opts.shape;
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
          var na = arm({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: 60, tidePos: 0.5, t0: t0, benchNow: true, shape: benchShape || manualShape(R.fork("shape")) }, R);
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
      // Q0: into the element the next seat will TAKE (freeElem, peeked), never
      // blindly element 0 — which may be holding an armed broadcast's reel.
      prefetchReel: function (reelId, inS) {
        var ix = freeElem(true), v = ensureVideo(ix); if (!v) return false;
        var id = String(reelId);
        // 経路 buffer mode: the sound is the DECODE, so that is what is warmed
        if (reelsBuffered()) { try { decodeReel(id, tl().ctx).catch(function () {}); } catch (e0) {} }
        try {
          if (videoSrcIds[ix] !== id) { videoSrcIds[ix] = id; v.src = reelUrl(id); v.preload = "auto"; v.load(); }
          var seek = function () { try { v.currentTime = +inS || 0; warmPicture(v); } catch (e) {} };
          if (v.readyState >= 3) seek(); else v.addEventListener("canplay", function once() { try { v.removeEventListener("canplay", once); } catch (e) {} seek(); }, { once: true });
        } catch (e) { return false; }
        return true;
      },
      benchCancel: function () { benchQueued = null; benchForce = null; benchShape = null; return true; },
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

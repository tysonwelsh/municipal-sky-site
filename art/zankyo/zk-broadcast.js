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
  // a 50 ms silent MP4: the media element is "primed" with it inside the PLAY
  // gesture (the ▶ play event is emitted synchronously from the click), so
  // later timer-driven play() calls are allowed where autoplay policy would
  // otherwise refuse (iOS). Replaced at build time by the real bytes.
  var PRIME_SRC = "data:video/mp4;base64,AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAxZtb292AAAAbG12aGQAAAAAAAAAAAAAAAAAAB9AAAABkAABAAABAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACQXRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAEAAAAAAAABkAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAAZAAAAQAAAEAAAAAAbltZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAB9AAAAFkFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAFkbWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAEoc3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAB9AAAAAAAA2ZXNkcwAAAAADgICAJQABAASAgIAXQBUAAAAAAA+gAAAECQWAgIAFFYhW5QAGgICAAQIAAAAUYnRydAAAAAAAAA+gAAAECQAAACBzdHRzAAAAAAAAAAIAAAABAAAEAAAAAAEAAAGQAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAACAAAAAQAAABxzdHN6AAAAAAAAAAAAAAACAAAAEwAAAAQAAAAUc3RjbwAAAAAAAAABAAADQgAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAAACAAAAAQAAAGF1ZHRhAAAAWW1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALGlsc3QAAAAkqXRvbwAAABxkYXRhAAAAAQAAAABMYXZmNjMuMS4xMDEAAAAIZnJlZQAAAB9tZGF03ABMYXZjNjMuMS4xMDEAAjBADgEYIAc=";

  function tl() { return Z._signal.tools(); }
  function db2lin(db) { return Math.pow(10, (+db || 0) / 20); }

  // ---- the pool ----
  var armedT0 = null;                                   // the t0 arm() was given, if any
  var pool = null, poolState = "idle", poolError = null, poolUnknownTones = {};   // idle | loading | ready | failed
  function loadPool() {
    if (poolState === "loading" || poolState === "ready") return;
    if (!hasFetch) { poolState = "failed"; poolError = "no fetch"; return; }
    poolState = "loading";
    try {
      fetch(MANIFEST_URL).then(function (r) { return r.json(); }).then(function (m) {
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
    var pr = fetch(REEL_DIR + id + ".mp4").then(function (r) {
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

  // ---- the element and its node ----
  var video = null, mediaSrc = null, primed = false, videoSrcId = null;
  function ensureVideo() {
    if (video || !hasDOM) return video;
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
      video = v;
      if (buffered) hushElement(v);
    } catch (e) { video = null; }
    return video;
  }
  function ensureMediaSource(ctx) {
    // 経路: in buffer mode the element is NEVER given to the graph. One call
    // is permanent — WebKit re-routes the element for the life of the page —
    // so this is the single gate that keeps the two worlds apart.
    if (reelsBuffered()) return null;
    if (mediaSrc || !video || !ctx || typeof ctx.createMediaElementSource !== "function") return mediaSrc;
    try { mediaSrc = ctx.createMediaElementSource(video); } catch (e) { mediaSrc = null; }
    return mediaSrc;
  }
  function onPlay() {
    loadPool();
    pinUsed = false;          // one pin per night, re-armed by ▶ play

    var v = ensureVideo(); if (!v) return;
    ensureMediaSource(tl().ctx);
    if (primed) return;
    primed = true;
    try {
      if (!v.src) { v.src = PRIME_SRC; videoSrcId = null; }
      var p = v.play();
      if (p && typeof p.then === "function") p.then(function () { try { v.pause(); } catch (e) {} }, function () {});
    } catch (e) {}
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
  var WHOLE_MAX_HOLD_S = 27.8;
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

  // ---- the choice (arm time): six draws, always ----
  function choose(R, cycle, tidePos) {
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next(), rBell = R.next();
    var holdS = 8 + rHold * 4, lossD = LOSS_MIN_S + rLoss * LOSS_SPAN_S, bell = rBell < 0.25;
    var c = { reel: null, win: null, inS: 0, holdS: holdS, lossD: lossD, bell: bell };
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
    var r = rReel * tot, reel = cands[cands.length - 1];
    for (i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { reel = cands[i]; break; } }
    // THE PIN, applied after the weighting and before anything reads `reel`:
    // rReel is already spent, so this costs no randomness and moves no stream.
    var pinR = pinUsed ? null : pinnedReel();
    if (pinR) { reel = pinR; c.pinned = true; }
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
    // §14: prefer a whole window that FITS the room a broadcast owns; if none
    // fits, take the shortest whole one. The scan starts at the drawn index and
    // is deterministic — NO new draws, so the signal stream does not move.
    var whole = wholeAt(reel, wi);
    if (whole && !wholeFits(reel, wi)) {
      var alt = -1, shortest = wi, sl = 1e9, ww, wj2, l2;
      for (ww = 0; ww < reel.windows.length; ww++) {
        wj2 = (wi + ww) % reel.windows.length;
        if (!wholeAt(reel, wj2)) continue;
        l2 = reel.windows[wj2][1] - reel.windows[wj2][0];
        if (l2 < sl) { sl = l2; shortest = wj2; }
        if (alt < 0 && wholeFits(reel, wj2)) alt = wj2;
      }
      wi = alt >= 0 ? alt : shortest;
      whole = wholeAt(reel, wi);
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
    var need = TUNE_S + holdS + lossD;
    if (whole) {
      // The thought sets the hold, not the draw. rHold and rIn are still
      // CONSUMED above — six draws, always — so a whole reel entering the pool
      // moves no other night's stream.
      holdS = Math.min(wl, WHOLE_MAX_HOLD_S);
      need = TUNE_S + holdS + lossD;
    } else if (need > wl) { holdS = Math.max(3, wl - TUNE_S - lossD); need = TUNE_S + holdS + lossD; }
    c.reel = reel; c.win = win; c.holdS = holdS; c.whole = whole;
    // The in-point does carry the rate: `need` wall seconds eat need × r
    // SOURCE seconds, so a sped-up reel starts nearer the window's head. When
    // need × r exceeds the window the in-point pins to the head and the last
    // fraction of a second runs past the edge — inside the loss ramp, where
    // the signal is already under 6 % of peak.
    // From the window's START on a whole reel — there is no slice to place.
    c.inS = whole ? win[0] : win[0] + rIn * Math.max(0, wl - need * tune.rate);
    c.rate = tune.rate; c.pitchHz = tune.pitchHz; c.degHz = tune.degHz; c.cents = tune.cents;
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
  function weather(R, cycle, holdS, lossD) {
    var D = R.fork("signal:" + cycle), drops = [], t = TUNE_S + 0.6, end = TUNE_S + holdS + lossD;
    while (true) {
      var k = t < TUNE_S + holdS ? 0 : (t - TUNE_S - holdS) / lossD;
      t += (1.2 + D.next() * 3.3) * (1 - 0.8 * k);
      if (t >= end - 0.1) break;
      drops.push([t, 0.12 + D.next() * 0.25]);
    }
    var rel = { shakuhachi: 0, koto: REL_MIN_S + D.next() * REL_SPAN_S, shamisen: REL_MIN_S + D.next() * REL_SPAN_S, hichiriki: REL_MIN_S + D.next() * REL_SPAN_S, biwa: REL_MIN_S + D.next() * REL_SPAN_S };
    return { drops: drops, rel: rel, lfoHz: 0.4 + D.next() * 2.6, seed: D.next() * 1000 };
  }

  // ---- the state ----
  var armed = null;   // the coming signal (from arm to teardown)
  var live = null;    // the nodes of the signal in progress
  var stats = { armed: 0, fired: 0, signals: 0, fallbacks: 0, scans: 0, lastReason: "" };

  function arm(info, rng) {
    var T = tl(); if (!T.S) return false;
    var R = rng || T.S.signal; if (!R) return false;
    loadPool();
    var c = choose(R, info.cycle, info.tidePos || 0), wx = weather(R, info.cycle, c.holdS, c.lossD);
    // §11's four fields ride here too, and the reason they are called out is
    // that this literal is EXACTLY the shape that cost the crew a phase: a
    // fresh object built field by field from a contract declared somewhere
    // else, which silently drops whatever the author forgot. It dropped them
    // on the first pass — 同調 never fired once and the harness output was
    // byte-identical to the old build, which reads like a pass. Anything
    // choose() adds must be added here in the same commit.
    armed = { cycle: info.cycle, kind: info.kind, hostStartT: info.hostStartT, hostDurS: info.hostDurS, tidePos: info.tidePos || 0,
      reel: c.reel, win: c.win, inS: c.inS, holdS: c.holdS, lossD: c.lossD, bell: c.bell, drops: wx.drops, rel: wx.rel, lfoHz: wx.lfoHz, seed: wx.seed,
      rate: c.rate || 1, pitchHz: c.pitchHz || 0, degHz: c.degHz || 0, cents: c.cents || 0, whole: !!c.whole, pinned: !!c.pinned,
      ready: false, t0: null, decided: false };   // (`bench: !!rng` lived here, written and never read — the critic's fourth dead field; deleted rather than carried)
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
    T.airHoldClear();
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
    armedT0 = (info.t0 != null) ? info.t0 : null;
    var t0k = (info.t0 != null) ? info.t0 : (info.hostStartT + 16);
    var pFrom = t0k - HOLD_LEAD_S;
    var pUntil = t0k + TUNE_S + c.holdS + c.lossD + 2;
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
    T.airHold(plan, "signal");
    var when = Math.max(T.ctx ? T.ctx.currentTime + 0.05 : 0, info.hostStartT - PREFETCH_LEAD_S);
    T.lane("broadcast").at(when, prefetch);
    return true;
  }
  function prefetch() {
    var a = armed; if (!a || !a.reel) return;
    var v = ensureVideo(); if (!v) return;
    var url = REEL_DIR + a.reel.id + ".mp4";
    // 経路 buffer mode: the AUDIO's readiness is the decode, not the seek. The
    // picture below still loads and seeks exactly as it always did — but it is
    // decoration now, and a picture that stalls must not deny the signal.
    if (reelsBuffered()) {
      a.buf = null; a.bufErr = null;
      decodeReel(a.reel.id, tl().ctx).then(function (b) { if (armed === a) { a.buf = b; a.ready = true; } },
                                          function (e) { if (armed === a) a.bufErr = String((e && e.message) || e); });
    }
    function seekIn() {
      try {
        var once = function () { try { v.removeEventListener("seeked", once); } catch (e) {} if (armed === a) a.ready = true; warmPicture(v); };
        v.addEventListener("seeked", once, { once: true });
        v.currentTime = a.inS;
      } catch (e) {}
    }
    try {
      if (videoSrcId !== a.reel.id) {
        videoSrcId = a.reel.id; v.src = url; v.preload = "auto";
        var onCan = function () { try { v.removeEventListener("canplay", onCan); } catch (e) {} seekIn(); };
        v.addEventListener("canplay", onCan, { once: true });
        v.load();
      } else if (v.readyState >= 3) seekIn();
      else { var onCan2 = function () { try { v.removeEventListener("canplay", onCan2); } catch (e) {} seekIn(); }; v.addEventListener("canplay", onCan2, { once: true }); }
    } catch (e) {}
  }
  function fire(t0) {
    var a = armed; if (!a || a.t0 != null) return false;
    var T = tl(); if (!T.ctx || !T.playing()) return false;
    a.t0 = t0; stats.fired++;
    var cut = t0 + TUNE_S + a.holdS + a.lossD;
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
    if (armedT0 == null) T.airHold(hold);    // only if this signal never went through a t0-bearing arm
    T.lane("broadcast").at(t0 - STATIC_LEAD_S, function (t) { staticRise(t, t0); });
    T.lane("broadcast").at(t0 - DECIDE_LEAD_S, function () { decide(t0); });
    return true;
  }
  function decide(t0) {
    var a = armed, T = tl(); if (!a || a.decided || !T.playing()) return;
    a.decided = true;
    var v = video, ms = ensureMediaSource(T.ctx), reason = null;
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
      T.airHoldClear(); T.airHoldClear("signal-planned");   // a fallback releases the intent too
      T.emitEvent({ cat: "rx", label: "受信 fallback", detail: reason }, t0);
      armed = null;
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
    var got = false;
    for (var attempt = 0; attempt < 6; attempt++) {
      if (!arm({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, R.fork("try:" + attempt))) return "snow";
      if (!armed || !armed.reel || !armed.reel.audioOnly) { got = true; break; }
    }
    if (!got && !armed) return "snow";
    if (armed.holdS + armed.lossD > room) armed.holdS = Math.max(3, room - armed.lossD);
    if (!fire(t0)) { armed = null; return "snow"; }
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
  function farPhaseTap(src, t0, holdS, lossD, N) {
    var p = farDep("phase"); if (!p) return null;
    // N is the caller's node registrar: the comb has to be torn down with the
    // signal that made it. Without it the three nodes outlive every broadcast
    // and accumulate for the life of the page — silent, because `src` is
    // disconnected, but never collected. (Found in the browser, W3b; the
    // symbolic probe counts sources, not gains.)
    var T = tl(), c = T.ctx, sum = N(c.createGain()), dly = N(c.createDelay(1.5)), wet = N(c.createGain());
    var total = (p.driftMs / 1000) * p.passes;                 // where the two copies end up
    dly.delayTime.setValueAtTime(0.0005, t0);
    dly.delayTime.linearRampToValueAtTime(Math.min(1.4, total), t0 + TUNE_S + holdS + lossD);
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
    var T = tl(), c = T.ctx, v = video, ms = mediaSrc;
    var buffered = reelsBuffered(), bufSrc = null;   // 経路: the reel's first node is the only thing this switch moves
    var band = T.getLayerParam("broadcast", "band", 0.5), flutter = T.getLayerParam("broadcast", "flutter", 0.5), grit = T.getLayerParam("broadcast", "grit", 0.5);
    var holdS = a.holdS, lossD = a.lossD, lossStart = t0 + TUNE_S + holdS, cut = lossStart + lossD, burstAt = cut + COLLAPSE_S, end = burstAt + BURST_S + DEAD_S;
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
      hp.frequency.setValueAtTime(800, t0); hp.frequency.exponentialRampToValueAtTime(hpHold, t0 + TUNE_S + 1.0);
      lp.frequency.setValueAtTime(1600, t0); lp.frequency.exponentialRampToValueAtTime(lpHold, t0 + TUNE_S + 1.0);
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
      // the dropout gate: the same seeded holes the picture shows
      var gate = N(c.createGain()); gate.gain.setValueAtTime(1, t0);
      var absDrops = [];
      for (i = 0; i < a.drops.length; i++) {
        var da = t0 + a.drops[i][0], dd = a.drops[i][1];
        gate.gain.setValueAtTime(1, da); gate.gain.linearRampToValueAtTime(0, da + 0.004);
        gate.gain.setValueAtTime(0, da + dd); gate.gain.linearRampToValueAtTime(1, da + dd + 0.004);
        absDrops.push([da, dd]);
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
      // the tuning envelope: in over 0.4 + 1.0 s, out as (1 − k²) through the loss, a hard cut
      var sg = N(c.createGain());
      var peak = 0.35 * db2lin(a.reel.gain);
      PJ.Voice.env(sg.gain, t0, [[TUNE_S, peak * 0.85], [1.0, peak], [holdS - 1.0, peak],
        [lossD * 0.5, peak * 0.75], [lossD * 0.25, peak * 0.44], [lossD * 0.15, peak * 0.19], [lossD * 0.1, peak * 0.06], [0.02, 0]]);
      // THE HEAD OF THE CHAIN, and the whole of the ?reels=buffer difference.
      // Everything downstream — band, receiver, flutter, dropouts, staircase,
      // envelope, phasing, room tap — is the same graph on the same schedule;
      // the reel simply arrives from a buffer instead of from an element. The
      // in-point becomes start()'s offset and the tape rate becomes the
      // source's playbackRate, which are the two things v.currentTime and
      // v.playbackRate were doing.
      var head = ms;
      if (buffered) {
        head = bufSrc = N(c.createBufferSource());
        bufSrc.buffer = a.buf;
        bufSrc.playbackRate.setValueAtTime(rate * (T.glideMul ? T.glideMul(t0) : 1), t0);
        bufSrc.start(t0, a.inS);
        bufSrc.stop(cut + 0.2);
      }
      head.connect(hp); hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(mk); mk.connect(fl); fl.connect(gate); gate.connect(cr); cr.connect(sg);
      // 相 PHASING (W3): two copies of the same window drifting apart. Reich
      // ran two tape loops at almost the same speed; here one copy goes through
      // a delay whose time ramps from nothing to driftMs × passes across the
      // hold, which is the same relationship expressed as a comb that sweeps —
      // and it is the comb, not the delay, that is the sound. It costs one
      // delay and one gain, and only while a signal is up.
      var phased = farPhaseTap(sg, t0, holdS, lossD, N);
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
            try { if (video && !video.paused) video.playbackRate = rate * T.glideMul(tt); } catch (e) {}
            try { if (bufSrc) bufSrc.playbackRate.setValueAtTime(rate * T.glideMul(tt), tt); } catch (e) {}
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
      T.airHoldClear(); T.airHoldClear("signal-planned"); armed = null;
      try { T.fallback(t0); } catch (e3) {}
      return;
    }
    live = { a: a, nodes: nodes, hp: hp, end: end, bufSrc: bufSrc };
    stats.signals++;
    if (a.pinned && !pinUsed) {
      pinUsed = true;   // spent ON AIR, not at arm: a fallback must not eat it
      T.emitEvent({ cat: "rx", label: "受信 pinned", detail: a.reel.id + (a.whole ? " · whole · " : " · ") + a.holdS.toFixed(1) + "s · the lottery resumes" }, t0);
    }
    remember(a.reel.id, a.cycle);
    // the crew's duck and notch for the signal's span
    try { T.roomSpeak("broadcast", t0, TUNE_S + holdS + lossD, 800); } catch (e) {}
    // one bonshō may ring under it in a rite cycle (the machine answering the past)
    if (a.bell && a.kind === "rite") { try { T.bonsho(t0 + TUNE_S + holdS * 0.45); } catch (e) {} }
    // the element starts on the audio clock's cue (a setTimeout for the lookahead lead)
    T.lane("broadcast").at(t0 - 0.12, function (t) {
      var lead = Math.max(0, (t - c.currentTime) * 1000);
      setTimeout(function () { try {
        if (!v) return;                                     // 経路 buffer mode with no DOM: the sound is already away
        if (buffered) hushElement(v);                       // …and the picture stays voiceless right up to the moment it moves
        if (Math.abs(v.currentTime - a.inS) > 0.5) v.currentTime = a.inS;
        // TAPE-STYLE: the pitch and the speed move together, which is the
        // whole idiom — a reel bent to the field also runs slow or fast, and
        // that is the sound of a machine, not a pitch-shifter.
        try { v.preservesPitch = false; v.mozPreservesPitch = false; v.webkitPreservesPitch = false; } catch (e2) {}
        v.playbackRate = rate * (T.glideMul ? T.glideMul(t0) : 1);
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      } catch (e) {} }, lead);
    });
    // the descriptor for the set and the VFD line 「受信 · title · year」
    var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: absDrops, id: a.reel.id, title: shortTitle(a.reel.title), year: a.reel.year, seed: a.seed, picture: true, video: v };
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
      T.emitEvent({ cat: "rx", label: "消失", detail: "signal lost · " + holdS.toFixed(1) + " s" }, cut);
    });
    T.lane("broadcast").at(end + 0.5, function () { teardown(); });
  }
  function warmPicture(v) { try { if (window.ZankyoSet && ZankyoSet.warm) ZankyoSet.warm(v); } catch (e) {} }   // S3: one offscreen drawImage now, so the first frame at t0 does not stall
  function shortTitle(t) { t = String(t || ""); var i = t.indexOf(" ("); if (i > 0) t = t.slice(0, i); i = t.indexOf(","); if (i > 0) t = t.slice(0, i); return t; }
  function teardown() {
    var L = live; live = null;
    if (video) { try { video.pause(); } catch (e) {} }
    if (!L) return;
    try { if (L.bufSrc) L.bufSrc.stop(); } catch (e) {}
    try { if (mediaSrc && L.hp) mediaSrc.disconnect(L.hp); } catch (e) {}
    for (var i = 0; i < L.nodes.length; i++) { try { L.nodes[i].disconnect(); } catch (e2) {} }
    if (armed === L.a) armed = null;
  }
  function stop() {
    teardown();
    farRoomTeardown();                            // 室: the room goes back to being a room
    armed = null; scanWanted = false; scanCycle = -1;
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
    if (!arm({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, R)) return false;
    if (!fire(t0)) { armed = null; return false; }
    scanWanted = false; scanCycle = cy.n; stats.scans++;
    T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal in " + Math.round(t0 - now) + " s" }, now);
    return true;
  }
  function scan() {
    var T = tl(); if (!T.ctx || !T.playing() || !T.S) return false;
    var cy = T.cycle(), sc = T.scene(), now = T.ctx.currentTime;
    if (live || (armed && armed.t0 != null)) { T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal is up" }, now); return true; }
    if (cy.visit === "the broadcast" && armed && armed.cycle === cy.n) { T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "a signal is already on its way this cycle" }, now); return true; }
    if (scanCycle === cy.n || (recent.length && recent[recent.length - 1].cycle === cy.n)) { scanWanted = true; T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "nothing more on the air this cycle · the next" }, now); return true; }
    if (seatScan(sc, cy)) return true;
    scanWanted = true; T.emitEvent({ cat: "rx", label: "選局 scanning", detail: "not now (" + (sc.type || "—") + ") · at the next scene" }, now);
    return true;
  }
  function onScene(sc) {
    if (!scanWanted) return;
    var T = tl(); if (!T.playing()) return;
    var cy = T.cycle();
    if (sc.planned || live || (armed && armed.t0 != null) || scanCycle === cy.n) return;   // a planned one is the answer; one per cycle
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
    var v = ensureVideo(), ms = ensureMediaSource(c);
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
      var url = REEL_DIR + reel.id + ".mp4", srcChanged = videoSrcId !== reel.id;
      videoSrcId = reel.id;
      try {
        if (srcChanged) { v.src = url; v.preload = "auto"; v.load(); }
        var go = function () { try { if (buffered) hushElement(v); v.currentTime = inS; warmPicture(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} };
        if (srcChanged || v.readyState < 3) { var once = function () { try { v.removeEventListener("canplay", once); } catch (e) {} setTimeout(go, Math.max(0, (t0 - c.currentTime) * 1000)); }; v.addEventListener("canplay", once, { once: true }); }
        else setTimeout(go, startMs);
      } catch (e) {}
      lastSampleAudioOnly = !!reel.audioOnly;
      var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: adrops, id: reel.id, title: shortTitle(reel.title), year: reel.year, seed: rIn * 1000, picture: true, video: v };
      T.emitEvent({ cat: "rx", label: "♪ 受信", detail: shortTitle(reel.title) + " · " + reel.year, signal: desc, link: reel.src || null }, t0);
      setTimeout(function () { try { if (bufSrc) bufSrc.stop(); } catch (e0) {} try { if (mediaSrc && hp) mediaSrc.disconnect(hp); } catch (e) {} for (var k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e2) {} } try { v.pause(); } catch (e3) {} }, (tuneEnd - c.currentTime) * 1000 + COLLAPSE_S * 1000 + 400);
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
    limits: function () { return { tuneS: TUNE_S, wholeMaxHoldS: WHOLE_MAX_HOLD_S, lossMaxS: LOSS_MIN_S + LOSS_SPAN_S,
      relMaxS: REL_MIN_S + REL_SPAN_S, tailS: HOLD_TAIL_S, maxReachPastT0S: maxReachPastT0() }; },
    getState: function () {
      return { pool: poolState, poolSize: pool ? pool.length : 0, poolError: poolError, primed: primed, video: !!video, mediaSource: !!mediaSrc,
        // 経路 — what the reel path actually is, read from the objects. `muted`
        // / `volume` / `audioTracks` are the element's real state, so "the
        // <video> has no voice" is a fact a reader can check rather than a
        // claim this switch makes about itself.
        reelsMode: reelsBuffered() ? "buffer" : "element",
        element: video ? { muted: !!video.muted, volume: video.volume, readyState: video.readyState,
                           audioTracks: video.audioTracks ? video.audioTracks.length : null,
                           audioTracksEnabled: (function () { var at = video.audioTracks, n = 0; if (at) for (var i = 0; i < at.length; i++) if (at[i].enabled) n++; return at ? n : null; })(),
                           src: video.currentSrc ? video.currentSrc.split("/").pop() : null } : null,
        decoded: bufOrder.slice(), decoding: Object.keys(bufPending),
        armed: armed ? { cycle: armed.cycle, reel: armed.reel && armed.reel.id, inS: +armed.inS.toFixed(2), holdS: +armed.holdS.toFixed(2), lossD: +armed.lossD.toFixed(2), drops: armed.drops.length, ready: armed.ready, t0: armed.t0, decided: armed.decided } : null,
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
        if (!arm({ cycle: cy.n, kind: cy.kind, hostStartT: now + delayS - 8, hostDurS: 60, tidePos: 0.5 }, R)) return false;
        return fire(now + delayS);
      },
      loadPool: loadPool,
      scan: scan,
    },
  };
})();

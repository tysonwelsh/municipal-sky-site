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
  var pool = null, poolState = "idle", poolError = null;   // idle | loading | ready | failed
  function loadPool() {
    if (poolState === "loading" || poolState === "ready") return;
    if (!hasFetch) { poolState = "failed"; poolError = "no fetch"; return; }
    poolState = "loading";
    try {
      fetch(MANIFEST_URL).then(function (r) { return r.json(); }).then(function (m) {
        var arr = Array.isArray(m) ? m : (m && m.reels) || [];
        var out = [];
        for (var i = 0; i < arr.length; i++) { var e = arr[i]; if (e && e.id && !e.takedown && e.windows && e.windows.length) out.push(e); }
        pool = out; poolState = out.length ? "ready" : "failed"; if (!out.length) poolError = "empty manifest";
      }).catch(function (e) { poolState = "failed"; poolError = String(e && e.message || e); });
    } catch (e) { poolState = "failed"; poolError = String(e && e.message || e); }
  }

  // ---- the element and its node ----
  var video = null, mediaSrc = null, primed = false, videoSrcId = null;
  function ensureVideo() {
    if (video || !hasDOM) return video;
    try {
      var v = document.createElement("video");
      v.setAttribute("playsinline", ""); v.playsInline = true; v.preload = "none"; v.crossOrigin = "anonymous";
      v.muted = false; v.volume = 1;
      if (v.style) v.style.cssText = "position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:0";
      var host = document.body || document.documentElement; if (host && host.appendChild) host.appendChild(v);
      video = v;
    } catch (e) { video = null; }
    return video;
  }
  function ensureMediaSource(ctx) {
    if (mediaSrc || !video || !ctx || typeof ctx.createMediaElementSource !== "function") return mediaSrc;
    try { mediaSrc = ctx.createMediaElementSource(video); } catch (e) { mediaSrc = null; }
    return mediaSrc;
  }
  function onPlay() {
    loadPool();
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

  // §8.1: reels WITH a picture are weighted 3× in the lottery. The manifest is
  // 21 with a picture against 11 audio-only, so the share of received reels
  // carrying one goes from ~65 % to ~85 %. The synthetic gagaku broadcast stays
  // the fallback only — this weights which real reel is chosen, never whether
  // a real one is chosen.
  var VIDEO_WEIGHT = 3;

  // ---- the choice (arm time): six draws, always ----
  function choose(R, cycle, tidePos) {
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next(), rBell = R.next();
    var holdS = 8 + rHold * 4, lossD = 1.6 + rLoss * 1.2, bell = rBell < 0.25;
    var c = { reel: null, win: null, inS: 0, holdS: holdS, lossD: lossD, bell: bell };
    if (!pool || !pool.length) return c;
    var skip = recentIds(cycle), cands = [];
    for (var i = 0; i < pool.length; i++) if (!skip[pool[i].id]) cands.push(pool[i]);
    if (!cands.length) cands = pool;
    var dark = tidePos, w = [], tot = 0;
    for (i = 0; i < cands.length; i++) {
      var e = cands[i], x = +e.weight > 0 ? +e.weight : 1, tone = e.tone;
      if (!e.audioOnly) x *= VIDEO_WEIGHT;                                                        // §8.1: a reel with a picture is three times as likely to be the one
      if (tone === "voice" || tone === "noise" || tone === "tone") x *= 0.7 + 0.6 * dark;          // the dark tide leans to voices and noise
      else if (tone === "music" || tone === "sung") x *= 0.7 + 0.6 * (1 - dark);                  // the light tide to music
      w.push(x); tot += x;
    }
    var r = rReel * tot, reel = cands[cands.length - 1];
    for (i = 0; i < cands.length; i++) { r -= w[i]; if (r <= 0) { reel = cands[i]; break; } }
    var win = reel.windows[Math.floor(rWin * reel.windows.length)], wl = win[1] - win[0];
    var need = TUNE_S + holdS + lossD;
    if (need > wl) { holdS = Math.max(3, wl - TUNE_S - lossD); need = TUNE_S + holdS + lossD; }
    c.reel = reel; c.win = win; c.holdS = holdS; c.inS = win[0] + rIn * Math.max(0, wl - need);
    return c;
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
    var rel = { shakuhachi: 0, koto: 3 + D.next() * 3, shamisen: 3 + D.next() * 3, hichiriki: 3 + D.next() * 3, biwa: 3 + D.next() * 3 };
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
    armed = { cycle: info.cycle, kind: info.kind, hostStartT: info.hostStartT, hostDurS: info.hostDurS, tidePos: info.tidePos || 0,
      reel: c.reel, win: c.win, inS: c.inS, holdS: c.holdS, lossD: c.lossD, bell: c.bell, drops: wx.drops, rel: wx.rel, lfoHz: wx.lfoHz, seed: wx.seed,
      ready: false, t0: null, decided: false, bench: !!rng };
    stats.armed++;
    var when = Math.max(T.ctx ? T.ctx.currentTime + 0.05 : 0, info.hostStartT - PREFETCH_LEAD_S);
    T.lane("broadcast").at(when, prefetch);
    return true;
  }
  function prefetch() {
    var a = armed; if (!a || !a.reel) return;
    var v = ensureVideo(); if (!v) return;
    var url = REEL_DIR + a.reel.id + ".mp4";
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
    T.airHold(hold);
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
    else if (!v || !ms) reason = "no media element";
    else if (!a.ready) reason = "reel not ready · " + a.reel.id;
    if (reason) {
      stats.fallbacks++; stats.lastReason = reason;
      T.airHoldClear();
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
  var dialNoiseUntil = -1e9;
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
  function dialLock() {
    var T = tl(), c = T.ctx;
    if (!c) return "snow";
    var now = c.currentTime;
    if (now - dialLast < 30) return "wait";                  // one lock per 30 s
    if (!T.playing()) {                                      // stopped: the audition, a full window
      if (!sampleTune(now)) return "snow";
      dialLast = now; stats.dial = (stats.dial || 0) + 1;
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
    var R = T.S.signal.fork("dial:" + Math.max(0, cy.n) + ":" + Math.round(now));
    if (!arm({ cycle: cy.n, kind: cy.kind, hostStartT: t0 - 8, hostDurS: sc.durS, tidePos: 0.5 }, R)) return "snow";
    if (armed.holdS + armed.lossD > room) armed.holdS = Math.max(3, room - armed.lossD);
    if (!fire(t0)) { armed = null; return "snow"; }
    dialLast = now; stats.dial = (stats.dial || 0) + 1;
    T.emitEvent({ cat: "rx", label: "掃引 locked on", detail: "the dial finds one · " + Math.round(t0 - now) + " s" }, now);
    return "locked";
  }

  // ---- the signal itself ----
  function startSignal(a, t0) {
    var T = tl(), c = T.ctx, v = video, ms = mediaSrc;
    var band = T.getLayerParam("broadcast", "band", 0.5), flutter = T.getLayerParam("broadcast", "flutter", 0.5), grit = T.getLayerParam("broadcast", "grit", 0.5);
    var holdS = a.holdS, lossD = a.lossD, lossStart = t0 + TUNE_S + holdS, cut = lossStart + lossD, burstAt = cut + COLLAPSE_S, end = burstAt + BURST_S + DEAD_S;
    var hpHold = 200 + 120 * band, lpHold = 6000 - 2600 * band;
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
      ms.connect(hp); hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(mk); mk.connect(fl); fl.connect(gate); gate.connect(cr); cr.connect(sg); sg.connect(T.lg("broadcast"));
      // the burst after the collapse: pure static, then the afterglow
      var bn = N(T.noiseSource()), bh = N(c.createBiquadFilter()), bg = N(c.createGain());
      bh.type = "highpass"; bh.frequency.setValueAtTime(1800, burstAt);
      bn.connect(bh); bh.connect(bg); bg.connect(T.lg("broadcast"));
      PJ.Voice.env(bg.gain, burstAt, [[0.005, 0.07], [BURST_S - 0.04, 0.05], [0.035, 0]]);
      bn.start(burstAt, 3); bn.stop(burstAt + BURST_S + 0.1);
    } catch (e) {
      for (i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e2) {} }
      stats.fallbacks++; stats.lastReason = "graph: " + (e && e.message);
      T.airHoldClear(); armed = null;
      try { T.fallback(t0); } catch (e3) {}
      return;
    }
    live = { a: a, nodes: nodes, hp: hp, end: end };
    stats.signals++;
    remember(a.reel.id, a.cycle);
    // the crew's duck and notch for the signal's span
    try { T.roomSpeak("broadcast", t0, TUNE_S + holdS + lossD, 800); } catch (e) {}
    // one bonshō may ring under it in a rite cycle (the machine answering the past)
    if (a.bell && a.kind === "rite") { try { T.bonsho(t0 + TUNE_S + holdS * 0.45); } catch (e) {} }
    // the element starts on the audio clock's cue (a setTimeout for the lookahead lead)
    T.lane("broadcast").at(t0 - 0.12, function (t) {
      var lead = Math.max(0, (t - c.currentTime) * 1000);
      setTimeout(function () { try { if (Math.abs(v.currentTime - a.inS) > 0.5) v.currentTime = a.inS; var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} }, lead);
    });
    // the descriptor for the set and the VFD line 「受信 · title · year」
    var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: absDrops, id: a.reel.id, title: shortTitle(a.reel.title), year: a.reel.year, seed: a.seed, picture: true, video: v };
    T.lane("broadcast").at(t0 - 0.15, function () {
      T.emitEvent({ cat: "rx", label: "受信", detail: shortTitle(a.reel.title) + " · " + a.reel.year, signal: desc, link: a.reel.src || null }, t0);
    });
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
    try { if (mediaSrc && L.hp) mediaSrc.disconnect(L.hp); } catch (e) {}
    for (var i = 0; i < L.nodes.length; i++) { try { L.nodes[i].disconnect(); } catch (e2) {} }
    if (armed === L.a) armed = null;
  }
  function stop() {
    teardown();
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
    var v = ensureVideo(), ms = ensureMediaSource(c);
    var R = T.S ? T.S.sample : PJ.Rand.stream((Date.now() % 4294967295) >>> 0);
    var rReel = R.next(), rWin = R.next(), rIn = R.next(), rHold = R.next(), rLoss = R.next();
    var holdS = 8 + rHold * 4, lossD = 1.6 + rLoss * 1.2, t0 = t + 1.0, tuneEnd = t0 + TUNE_S + holdS + lossD;
    if (poolState !== "ready" || !v || !ms || !pool.length) { staticRise(t, t0); return true; }   // the dial turns, nothing found
    var reel = pool[Math.floor(rReel * pool.length)], win = reel.windows[Math.floor(rWin * reel.windows.length)];
    var wl = (win[1] - win[0]), need = TUNE_S + holdS + lossD;
    if (need > wl) { holdS = Math.max(3, wl - TUNE_S - lossD); need = TUNE_S + holdS + lossD; tuneEnd = t0 + need; }
    var inS = win[0] + rIn * Math.max(0, wl - need - 0.5);
    // the same dropout plan a real signal gets, so the picture stutters
    var adrops = [], dt = TUNE_S + 0.6;
    while (dt < TUNE_S + holdS) { dt += 1.2 + R.next() * 3.2; if (dt < TUNE_S + holdS) adrops.push([dt, 0.12 + R.next() * 0.25]); }
    var nodes = [], hp, lp, pre, sh, sg;
    try {
      hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.setValueAtTime(700, t0); hp.frequency.linearRampToValueAtTime(260, t0 + 0.8);
      lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(1600, t0); lp.frequency.linearRampToValueAtTime(4700, t0 + 0.8);
      pre = c.createGain(); pre.gain.setValueAtTime(0.5, t0);
      sh = c.createWaveShaper(); var cv = new Float32Array(1024); for (var i = 0; i < 1024; i++) { var x = (i / 1023) * 2 - 1; cv[i] = Math.tanh(x * 3.5) / Math.tanh(3.5); } sh.curve = cv;
      sg = c.createGain(); var peak = 0.35 * db2lin(reel.gain) * 1.6;
      PJ.Voice.env(sg.gain, t0, [[TUNE_S, peak * 0.85], [1.0, peak], [holdS - 1.0, peak], [lossD * 0.6, peak * 0.4], [lossD * 0.4, 0]]);
      nodes = [hp, lp, pre, sh, sg];
      ms.connect(hp); hp.connect(lp); lp.connect(pre); pre.connect(sh); sh.connect(sg); sg.connect(T.lg("broadcast"));
    } catch (e) { return false; }
    staticRise(t, t0);
    var startMs = Math.max(0, (t0 - c.currentTime) * 1000);
    var url = REEL_DIR + reel.id + ".mp4", srcChanged = videoSrcId !== reel.id;
    videoSrcId = reel.id;
    try {
      if (srcChanged) { v.src = url; v.preload = "auto"; v.load(); }
      var go = function () { try { v.currentTime = inS; warmPicture(v); var p = v.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {} };
      if (srcChanged || v.readyState < 3) { var once = function () { try { v.removeEventListener("canplay", once); } catch (e) {} setTimeout(go, Math.max(0, (t0 - c.currentTime) * 1000)); }; v.addEventListener("canplay", once, { once: true }); }
      else setTimeout(go, startMs);
    } catch (e) {}
    var desc = { t0: t0, holdS: holdS, lossD: lossD, drops: adrops, id: reel.id, title: shortTitle(reel.title), year: reel.year, seed: rIn * 1000, picture: true, video: v };
    T.emitEvent({ cat: "rx", label: "♪ 受信", detail: shortTitle(reel.title) + " · " + reel.year, signal: desc, link: reel.src || null }, t0);
    setTimeout(function () { try { if (mediaSrc && hp) mediaSrc.disconnect(hp); } catch (e) {} for (var k = 0; k < nodes.length; k++) { try { nodes[k].disconnect(); } catch (e2) {} } try { v.pause(); } catch (e3) {} }, (tuneEnd - c.currentTime) * 1000 + COLLAPSE_S * 1000 + 400);
    return true;
  }

  Z._signal.install({ arm: arm, fire: fire, stop: stop, sample: sampleTune, scan: scan, scene: onScene, dialNoise: dialNoise, dialLock: dialLock });

  // ---- public / bench ----
  window.ZankyoBroadcast = {
    getState: function () {
      return { pool: poolState, poolSize: pool ? pool.length : 0, poolError: poolError, primed: primed, video: !!video, mediaSource: !!mediaSrc,
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

// ============================================================================
// ZANKYŌ Q0 — the reception recorder, injected into the REAL page before any
// of its scripts run (Page.addScriptToEvaluateOnNewDocument). Dev tool only;
// index.php never loads it.
//
// Nothing here is a mock. The receiver's own media elements load the real
// reels over the real network, and this file only LISTENS:
//
//   the heads   createMediaElementSource is wrapped so that every element's
//               node ALSO feeds a tap — the raw reel as the graph receives it,
//               before the band, the gate or the envelope. A stalled element
//               shows up here as digital zero. The first three elements given
//               to the graph are tapped (A, B and, where there is one, the
//               audition's), in the order the page creates them.
//   the bus     the broadcast layer (attachLayerAnalyser) — what the receiver
//               actually sends on, after every duck, hole and envelope.
//   the clock   a ConstantSource ramp on its own channel, so every block
//               carries its exact context time (a buffer's playbackTime is
//               off by a buffer, and a tap that misses a callback would
//               otherwise shift everything after it without saying so).
//   the elements every media event (capture phase on document — they do not
//               bubble, but capture reaches them), every call the receiver
//               makes on an element (play, pause, load, currentTime, src,
//               playbackRate), and a 50 ms poll of each playing element's
//               currentTime against the audio clock.
//   the plan    every rx event the engine emits, with the descriptor the set
//               is handed — t0, the plan, the drops — which is what a gap is
//               lined up against.
//
// Everything lands in window.__rx. The driver (_rx-probe.js) pulls it in
// pieces.
// ============================================================================
(function () {
  "use strict";
  if (window.__rx) return;
  var R = window.__rx = { t0wall: Date.now(), sr: 0, block: 256, ev: [], calls: [], media: [], polls: [], taps: [],
    rows: [], clk: [], err: [], bus: false, heads: 0, headOf: {}, spMiss: 0, spN: 0, route: null };
  var BLOCK = 256, NH = 3, NCH = NH + 2;   // ch0–ch2 the first three elements given to the graph, ch3 the broadcast bus, ch4 the clock
  var ctxRef = null, merger = null, sp = null, clockSrc = null, clockBase = 0, busTap = null;
  var ids = [], rowsF = [], cur = null, curN = 0, CHUNK = 187 * 60, W = NH + 1;   // one Float32Array per minute of blocks; W values a block
  var srcs = [];                      // the src string table the poll indexes

  function now() { try { return ctxRef ? ctxRef.currentTime : null; } catch (e) { return null; } }
  function vid(v) { var i = ids.indexOf(v); if (i < 0) { ids.push(v); i = ids.length - 1; } return i; }
  function tail(s) { s = String(s || ""); if (s.indexOf("data:") === 0) return "data:"; var q = s.split("/").pop(); return q.split("?")[0]; }
  function bufStr(v) {
    try { var b = v.buffered, o = []; for (var i = 0; i < b.length; i++) o.push(b.start(i).toFixed(2) + "-" + b.end(i).toFixed(2)); return o.join(","); } catch (e) { return ""; }
  }
  function snap(v) {
    return { id: vid(v), cur: +(+v.currentTime || 0).toFixed(3), rs: v.readyState, ns: v.networkState, paused: !!v.paused,
      rate: v.playbackRate, src: tail(v.currentSrc || v.src), buf: bufStr(v), seeking: !!v.seeking };
  }

  function newChunk() { cur = new Float32Array(CHUNK * W); curN = 0; rowsF.push(cur); }
  function ensureTap(ctx) {
    if (sp || !ctx) return;
    ctxRef = ctx; R.sr = ctx.sampleRate;
    merger = ctx.createChannelMerger(NCH);
    sp = ctx.createScriptProcessor(8192, NCH, 1);
    sp.channelInterpretation = "discrete";
    var z = ctx.createGain(); z.gain.value = 0;
    merger.connect(sp); sp.connect(z); z.connect(ctx.destination);
    clockBase = ctx.currentTime;
    clockSrc = ctx.createConstantSource();
    clockSrc.offset.setValueAtTime(0, clockBase);
    clockSrc.offset.linearRampToValueAtTime(20000, clockBase + 20000);
    clockSrc.connect(merger, 0, NH + 1); clockSrc.start(clockBase);
    newChunk();
    var lastClk = null;
    sp.onaudioprocess = function (e) {
      var ib = e.inputBuffer, n = ib.length, ch = [], c, k, b, x, acc;
      for (c = 0; c < NCH; c++) ch.push(ib.getChannelData(c));
      var t = clockBase + ch[NH + 1][0];
      R.spN++;
      if (lastClk != null && Math.abs(t - (lastClk + n / ctx.sampleRate)) > 0.002) R.spMiss++;
      lastClk = t;
      R.clk.push(+t.toFixed(5));
      for (b = 0; b + BLOCK <= n; b += BLOCK) {
        if (curN >= CHUNK) newChunk();
        for (c = 0; c <= NH; c++) {
          var d = ch[c]; acc = 0;
          for (k = b; k < b + BLOCK; k++) { x = d[k]; acc += x * x; }
          cur[curN * W + c] = Math.sqrt(acc / BLOCK);
        }
        curN++;
      }
    };
    attachBus();
  }
  function attachBus() {
    if (R.bus || !ctxRef) return;
    try {
      if (window.ZankyoAudio && ZankyoAudio.attachLayerAnalyser) {
        busTap = ctxRef.createGain();
        if (ZankyoAudio.attachLayerAnalyser("broadcast", busTap)) { busTap.connect(merger, 0, NH); R.bus = true; }
      }
    } catch (e) { R.err.push("bus: " + e.message); }
  }
  // the wrap: the node is the receiver's, untouched; the tap is one more connection
  ["AudioContext", "webkitAudioContext"].forEach(function (k) {
    var C = window[k]; if (!C || !C.prototype.createMediaElementSource || C.prototype.__zkWrapped) return;
    var orig = C.prototype.createMediaElementSource;
    C.prototype.createMediaElementSource = function (el) {
      var n = orig.call(this, el);
      try { ensureTap(this); var ch = R.heads++; if (ch < NH) { n.connect(merger, 0, ch); R.headOf[vid(el)] = ch; } }
      catch (e) { R.err.push("head: " + e.message); }
      return n;
    };
    C.prototype.__zkWrapped = true;
  });
  // 経路 buffer mode: the reel arrives from decodeAudioData, not an element.
  // Every buffer the page decodes is remembered, and any BufferSource started
  // on one of them also feeds head channel 0 — the reel as the graph receives
  // it, exactly as the element's node does in element mode.
  var decoded = typeof WeakSet === "function" ? new WeakSet() : null;
  ["AudioContext", "webkitAudioContext"].forEach(function (k) {
    var C = window[k]; if (!C || !C.prototype.decodeAudioData || C.prototype.__zkDecWrapped) return;
    var od = C.prototype.decodeAudioData;
    C.prototype.decodeAudioData = function (ab, ok, err) {
      var self = this;
      var mark = function (b) { try { if (decoded && b) decoded.add(b); ensureTap(self); } catch (e) {} return b; };
      var p = od.call(this, ab, function (b) { mark(b); if (ok) ok(b); }, err);
      if (p && p.then) p = p.then(mark);
      return p;
    };
    C.prototype.__zkDecWrapped = true;
  });
  if (window.AudioBufferSourceNode && !AudioBufferSourceNode.prototype.__zkWrapped) {
    var ost = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function () {
      try { if (decoded && this.buffer && decoded.has(this.buffer) && merger) { this.connect(merger, 0, 0); R.bufHeads = (R.bufHeads || 0) + 1; } } catch (e) {}
      return ost.apply(this, arguments);
    };
    AudioBufferSourceNode.prototype.__zkWrapped = true;
  }
  // every call the receiver makes on an element
  var HM = HTMLMediaElement.prototype;
  ["play", "pause", "load"].forEach(function (m) {
    var o = HM[m];
    HM[m] = function () { try { R.calls.push({ t: now(), w: performance.now(), m: m, s: snap(this) }); } catch (e) {} return o.apply(this, arguments); };
  });
  ["currentTime", "src", "playbackRate"].forEach(function (p) {
    var d = Object.getOwnPropertyDescriptor(HM, p); if (!d || !d.set) return;
    Object.defineProperty(HM, p, { configurable: true, enumerable: d.enumerable, get: d.get,
      set: function (val) { try { R.calls.push({ t: now(), w: performance.now(), m: "set:" + p, v: p === "src" ? tail(val) : +val, s: snap(this) }); } catch (e) {} return d.set.call(this, val); } });
  });
  ["loadstart", "suspend", "abort", "error", "emptied", "stalled", "loadedmetadata", "loadeddata", "canplay", "canplaythrough",
   "playing", "waiting", "seeking", "seeked", "ended", "play", "pause", "ratechange"].forEach(function (ty) {
    document.addEventListener(ty, function (e) {
      var v = e.target; if (!v || !(v instanceof HTMLMediaElement) || v.tagName !== "VIDEO") return;
      var o = snap(v); o.ty = ty; o.t = now(); o.w = performance.now();
      if (ty === "error" && v.error) o.code = v.error.code;
      R.media.push(o);
    }, true);
  });
  // the poll: a playing element's position against the audio clock
  (function poll() {
    try {
      if (ctxRef) {
        for (var i = 0; i < ids.length; i++) { var v = ids[i]; if (!v.paused) { var st = tail(v.currentSrc || v.src), si = srcs.indexOf(st); if (si < 0) { srcs.push(st); si = srcs.length - 1; } R.polls.push([+ctxRef.currentTime.toFixed(4), i, +v.currentTime.toFixed(4), v.readyState, v.playbackRate, si]); } }
        attachBus();
      }
    } catch (e) {}
    setTimeout(poll, 50);
  })();
  // the plan: every rx event, with the descriptor the set is handed
  function hookEvents() {
    if (!window.ZankyoAudio || !ZankyoAudio.setEventListener) return setTimeout(hookEvents, 100);
    ZankyoAudio.setEventListener(function (ev) {
      try {
        var o = { cat: ev.cat, label: ev.label, detail: ev.detail, t: ev.t, at: now() };
        var s = ev.signal;
        if (s) o.signal = { t0: s.t0, holdS: s.holdS, lossD: s.lossD, drops: s.drops, id: s.id, seed: s.seed, rx: s.rx, head: s.head || null, vid: s.video ? vid(s.video) : null, ch: (R.route && R.route.reelsMode === "buffer") ? 0 : (s.video && R.headOf[vid(s.video)] != null ? R.headOf[vid(s.video)] : -1) };
        R.ev.push(o);
      } catch (e) {}
    });
    try { R.route = ZankyoAudio.getRoute ? ZankyoAudio.getRoute() : null; } catch (e) {}
  }
  hookEvents();
  window.addEventListener("error", function (e) { R.err.push("error: " + (e.message || e)); });
  window.addEventListener("unhandledrejection", function (e) { R.err.push("rejection: " + (e.reason && e.reason.message || e.reason)); });
  // the driver pulls the level rows in pieces, as base64 of the raw floats
  R.srcs = srcs;
  R.pullRows = function (from) {
    var out = [], i, all = 0;
    for (i = 0; i < rowsF.length; i++) all += (i === rowsF.length - 1 ? curN : CHUNK);
    from = from | 0;
    var arr = new Float32Array((all - from) * W), p = 0, skip = from;
    for (i = 0; i < rowsF.length; i++) {
      var n = (i === rowsF.length - 1 ? curN : CHUNK);
      if (skip >= n) { skip -= n; continue; }
      arr.set(rowsF[i].subarray(skip * W, n * W), p); p += (n - skip) * W; skip = 0;
    }
    var u8 = new Uint8Array(arr.buffer), s = "";
    for (i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { n: all, from: from, w: W, srcs: srcs, b64: btoa(s) };
  };
})();

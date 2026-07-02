// ============================================================================
// ZANKYŌ — visualizer. A gritty neon scope: spectrum bars + waveform, glitch
// displacement, color shifting with the jo-ha-kyū arc. Reads the master mix.
// ============================================================================
(function () {
  "use strict";
  var Z = window.ZankyoAudio;
  var canvas = document.getElementById("zankyo-viz");
  if (!Z || !canvas) return;
  var ctx2d = canvas.getContext("2d");

  // 動機 MOTIF window — the glyph's own little phosphor tube on the pitch
  // module (may be absent; the glyph no-ops gracefully without it)
  var gcanvas = document.getElementById("zankyo-motif");
  var gctx = gcanvas ? gcanvas.getContext("2d") : null;

  var W = 0, H = 0, GW = 0, GH = 0, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (gctx) {
      var gr = gcanvas.getBoundingClientRect();
      GW = gr.width; GH = gr.height;
      gcanvas.width = Math.max(1, Math.floor(GW * dpr));
      gcanvas.height = Math.max(1, Math.floor(GH * dpr));
      gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }
  window.addEventListener("resize", resize); resize();

  var analyser = null, freqData = null, timeData = null, tapped = false;
  function ensureTap() {
    if (tapped) return;
    var ac = Z.getAudioContext && Z.getAudioContext();
    if (!ac) return;
    analyser = ac.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.78;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Uint8Array(analyser.fftSize);
    if (Z.attachAnalyser(analyser)) tapped = true;
  }

  // ==========================================================================
  // MOTIF GENEALOGY GLYPH — the current working motif rendered as a piece of
  // neon signage in its own phosphor window (the 動機 canvas on the pitch
  // module): an angular polyline of its melodic
  // contour, named in katakana. Generation 0 is pristine tube-glass; each
  // development event corrupts it further (RGB split, segment dropouts,
  // vertex noise, horizontal tears) — one idea, watched decaying. Answers
  // flash an offset echo; shadows trail a dim lagged twin; the kyū reprise
  // snaps it back whole; after the KIRU it renders hollow and dissolves.
  // Contour comes from the real note stream when a phrase can be captured,
  // else from a stable per-name seeded hash — same base shape all cycle.
  // ==========================================================================
  var Glyph = (function () {
    var MAXPTS = 16, CAPMAX = 12;
    var NAME_RE = /[イロハ]/, GEN_RE = /·g(\d+)/;

    // shown = the motif currently on the sign
    var shown = null;                    // { name, gen, base(Float32Array), n }
    var lastNormal = null;               // { name, gen } — to revert after ghost
    var cycleBases = {};                 // name -> {arr,n} real captured contour
    var hashCache = {};                  // name -> {arr,n} pseudo contour (per cycle)
    var cycleNum = 0;
    var recentNames = [];                // last sightings, for dominance switching
    var genLabel = "";                   // cached "·g3" caption

    var mode = "normal";                 // "normal" | "ghost"
    var ghostStart = 0, ghostVX = 0, ghostVY = 0;
    var pristineUntil = 0, flashUntil = 0;
    var echoUntil = 0, echoAng = 0;
    var shadowUntil = 0;

    // preallocated per-frame vertex buffers (reused, never grown)
    var px = new Float32Array(MAXPTS), py = new Float32Array(MAXPTS);
    var dropped = new Uint8Array(MAXPTS);

    // note capture: grab the phrase scheduled right after a gen-0 statement
    var cap = null;                      // { name, layer, until }
    var capArr = new Float32Array(CAPMAX), capN = 0;

    var statsTick = 0;

    function tnow() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
    function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

    // ---- deterministic small-hash helpers (no allocation) ----
    function strSeed(s, extra) {
      var h = 2166136261 ^ extra;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return h >>> 0;
    }
    function mulberry(a) {
      return function () {
        a = (a + 0x6D2B79F5) | 0;
        var t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
    // time-quantized flicker: stable within a ~130ms slot, so dropouts and
    // tears buzz like failing neon instead of shimmering at 60fps
    function flick(i, tq, salt) {
      var h = (Math.imul(i, 374761393) + Math.imul(tq, 668265263) + Math.imul(salt, 2246822519)) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177) | 0;
      h = h ^ (h >>> 16);
      return (h >>> 0) / 4294967296;
    }

    // stable pseudo-contour from the motif's name — an angular melodic walk
    function hashContour(name) {
      var cached = hashCache[name];
      if (cached) return cached;
      var r = mulberry(strSeed(name, cycleNum * 7919));
      var n = 7 + ((r() * 5) | 0);                 // 7..11 vertices
      var arr = new Float32Array(MAXPTS);
      var v = (r() * 2 - 1) * 0.4, lo = v, hi = v;
      for (var i = 0; i < n; i++) {
        arr[i] = v;
        v += (r() * 2 - 1) * 0.85;
        if (r() < 0.25) v += (r() < 0.5 ? -1 : 1) * 0.9;   // occasional leap
      }
      for (i = 0; i < n; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; }
      var span = Math.max(0.001, hi - lo), mid = (hi + lo) / 2;
      for (i = 0; i < n; i++) arr[i] = ((arr[i] - mid) / span) * 2;   // -> [-1, 1]
      cached = { arr: arr, n: n };
      hashCache[name] = cached;
      return cached;
    }

    function baseFor(name) { return cycleBases[name] || hashContour(name); }

    function show(name, gen) {
      var b = baseFor(name);
      shown = { name: name, gen: gen | 0, base: b.arr, n: b.n };
      genLabel = "·g" + shown.gen;
      if (mode !== "ghost") lastNormal = shown;
    }
    function setGen(g) { if (shown) { shown.gen = g | 0; genLabel = "·g" + shown.gen; } }

    // ---- recent-name dominance: switch the sign when another idea takes over ----
    function seen(name) {
      recentNames.push(name);
      if (recentNames.length > 8) recentNames.shift();
    }
    function maybeSwitch(name, gen) {
      if (!shown) { show(name, gen == null ? 0 : gen); return; }
      if (name === shown.name) { if (gen != null) setGen(gen); return; }
      var mine = 0, theirs = 0;
      for (var i = 0; i < recentNames.length; i++) {
        if (recentNames[i] === shown.name) mine++;
        else if (recentNames[i] === name) theirs++;
      }
      if (theirs > mine) show(name, gen == null ? 1 : gen);
    }

    // ---- note capture ----
    function startCapture(name, layer) {
      if (layer !== "shakuhachi" && layer !== "koto") layer = null;
      cap = { name: name, layer: layer, until: tnow() + 4500 };
      capN = 0;
    }
    function finalizeCapture() {
      var c = cap; cap = null;
      if (!c || capN < 4) { capN = 0; return; }
      var lo = capArr[0], hi = capArr[0], i;
      for (i = 1; i < capN; i++) { if (capArr[i] < lo) lo = capArr[i]; if (capArr[i] > hi) hi = capArr[i]; }
      var span = Math.max(0.05, hi - lo), mid = (hi + lo) / 2;
      var arr = new Float32Array(MAXPTS);                       // event-time alloc only
      for (i = 0; i < capN; i++) arr[i] = ((capArr[i] - mid) / span) * 2;
      cycleBases[c.name] = { arr: arr, n: capN };
      if (shown && shown.name === c.name) { shown.base = arr; shown.n = capN; }
      capN = 0;
    }
    function onNote(n) {
      try {
        if (!cap || !n) return;
        if (cap.layer ? n.layer !== cap.layer : (n.layer !== "shakuhachi" && n.layer !== "koto")) return;
        if (tnow() > cap.until) { finalizeCapture(); return; }
        var f = +n.freq;
        if (!(f > 0)) return;
        if (capN < CAPMAX) capArr[capN++] = Math.log(f);
        if (capN >= CAPMAX) finalizeCapture();
      } catch (e) {}
    }

    function enterGhost() {
      if (!shown) return;
      if (mode !== "ghost" && shown) lastNormal = { name: shown.name, gen: shown.gen };
      mode = "ghost";
      ghostStart = tnow();
      var a = Math.random() * Math.PI * 2;
      ghostVX = Math.cos(a) * 0.008; ghostVY = (Math.sin(a) * 0.006) - 0.004;
    }
    function leaveGhost() {
      if (mode !== "ghost") return;
      mode = "normal";
      if (lastNormal) show(lastNormal.name, lastNormal.gen);
    }

    // ---- event stream (parse defensively; never throw) ----
    function onEvent(ev) {
      try {
        if (!ev) return;
        var label = String(ev.label || ""), detail = String(ev.detail || "");
        var s = label + " " + detail;
        var nm = s.match(NAME_RE), gm = s.match(GEN_RE);
        var name = nm ? nm[0] : null;
        var gen = gm ? parseInt(gm[1], 10) : null;
        if (gen != null && !isFinite(gen)) gen = null;

        if (label.indexOf("❁") >= 0 || label.indexOf("working set") >= 0) {   // ❁ new cycle
          cycleNum++;
          cycleBases = {}; hashCache = {};
          recentNames.length = 0;
          mode = "normal";
          var theme = (detail.match(NAME_RE) || ["イ"])[0];                    // イ
          show(theme, 0);
          pristineUntil = tnow() + 4000;
          flashUntil = tnow() + 1300;
          startCapture(theme, "shakuhachi");
          return;
        }
        if (label.indexOf("斬") >= 0 || label.indexOf("KIRU") >= 0) {          // 斬 the cut
          enterGhost();
          return;
        }
        if (label.indexOf("残") >= 0 || label.indexOf("ghost of") >= 0) {      // 残 decomposed memory
          enterGhost();                       // snapshot the revert target first
          if (name) { seen(name); show(name, gen == null ? (shown ? shown.gen : 1) : gen); }
          if (mode !== "ghost" && shown) enterGhost();   // nothing was shown before
          return;
        }
        if (label.indexOf("✸") >= 0 || label.indexOf("reprise") >= 0) {       // ✸ the theme whole
          mode = "normal";
          if (name) show(name, 0); else if (shown) setGen(0);
          pristineUntil = tnow() + 5000;
          flashUntil = tnow() + 1600;
          return;
        }
        if (label.indexOf("○") >= 0 || label.indexOf("stated plain") >= 0) {  // ○ gen-0 statement
          if (!name) return;
          seen(name);
          if (shown && shown.name === name && shown.gen === 0 && !cycleBases[name]) startCapture(name, ev.cat);
          return;
        }
        if (label.indexOf("⇄") >= 0 || label.indexOf("answers") >= 0) {       // ⇄ answer: echo flash
          if (name) { seen(name); maybeSwitch(name, gen); }
          echoUntil = tnow() + 900;
          echoAng = Math.random() * Math.PI * 2;
          return;
        }
        if (label.indexOf("〰") >= 0 || label.indexOf("shadows") >= 0) {       // 〰 shadow: lagged twin
          if (name) seen(name);
          shadowUntil = tnow() + 4500;
          return;
        }
        if (label.indexOf("◆") >= 0) {                                        // ◆ development
          if (!name) return;
          seen(name);
          if (mode === "ghost") leaveGhost();
          if (shown && name === shown.name) setGen(gen == null ? shown.gen + 1 : gen);
          else maybeSwitch(name, gen);
          return;
        }
        // 散 decompose and anything unrecognized: note the name, nothing more
        if (name) seen(name);
      } catch (e) {}
    }

    // ---- polyline pass: fill px/py/dropped for a time + corruption level ----
    var vN = 0;
    function fillVerts(tms, corrupt, arc, gx, gw, midY, ampY, salt) {
      vN = shown.n;
      var tq = (tms / 130) | 0;
      var jamp = corrupt * 3.6 + (arc > 0.6 ? (arc - 0.6) * 9 : 0);
      var tearRow = -1, tearOff = 0;
      if (flick(97, tq, salt) < corrupt * 0.28 + (arc > 0.6 ? (arc - 0.6) * 0.25 : 0)) {
        tearRow = (flick(53, tq, salt) * vN) | 0;
        tearOff = (flick(31, tq, salt) - 0.5) * gw * 0.3 * (corrupt + 0.25);
      }
      for (var i = 0; i < vN; i++) {
        var bx = gx + gw * (vN > 1 ? i / (vN - 1) : 0.5);
        var by = midY - shown.base[i] * ampY;
        var jx = (flick(i * 2, tq, salt) - 0.5) * 2 * jamp;
        var jy = (flick(i * 2 + 1, tq, salt) - 0.5) * 2 * jamp;
        if (tearRow >= 0 && i >= tearRow) jx += tearOff;
        px[i] = bx + jx; py[i] = by + jy;
        dropped[i] = (i > 0 && flick(i + 100, tq, salt + 17) < corrupt * 0.34) ? 1 : 0;
      }
    }
    function strokePoly(ox, oy) {
      gctx.beginPath();
      for (var i = 0; i < vN; i++) {
        if (i === 0 || dropped[i]) gctx.moveTo(px[i] + ox, py[i] + oy);
        else gctx.lineTo(px[i] + ox, py[i] + oy);
      }
      gctx.stroke();
    }

    // ---- per-frame render into the 動機 window (shares the main rAF loop) ----
    function frame(arc) {
      if (!gctx) return;                                   // no window fitted
      var tms = tnow();
      if (cap && tms > cap.until) finalizeCapture();

      // phosphor trails: fade the prior frame instead of clearing
      gctx.fillStyle = "rgba(2,2,4,0.32)";
      gctx.fillRect(0, 0, GW, GH);

      // engine-stats fallback: if events never arrived, seed from getMotifStats
      if (!shown && ++statsTick > 150) {
        statsTick = 0;
        try {
          var st = Z.getMotifStats && Z.getMotifStats();
          if (st && st.working && st.working.theme) show(String(st.working.theme), st.working.themeGen | 0);
        } catch (e) {}
      }
      if (!shown) return;
      if (GW < 64 || GH < 40) return;                      // too small to read
      var ghost = (mode === "ghost");
      var ghostAge = ghost ? (tms - ghostStart) : 0;
      if (ghost && ghostAge > 14000) { leaveGhost(); ghost = false; ghostAge = 0; }

      var corrupt = clamp01(shown.gen / 8);
      if (tms < pristineUntil) corrupt = 0;

      // hush/ma dims with everything else; the flash after a reprise burns hot
      var dim = 0.5 + arc * 0.5;
      if (tms < flashUntil) dim = Math.min(1.25, dim + 0.6);
      if (ghost) dim *= Math.max(0, 1 - ghostAge / 14000);
      if (dim <= 0.02) return;

      // ghost marker — the 動機 label itself is printed on the bezel outside
      if (ghost) {
        gctx.fillStyle = "rgba(107,100,115," + (0.5 * Math.min(1, dim)).toFixed(2) + ")";
        gctx.font = '8px "JetBrains Mono", monospace';
        gctx.fillText("残", 5, 11);
      }

      // layout: polyline to the left, katakana nameplate to the right
      var kanaW = GW * 0.26;
      var gx = 8, gw = GW - kanaW - 18;
      var midY = GH * 0.56, ampY = GH * 0.32;
      var gox = 0, goy = 0;
      if (ghost) { gox = ghostVX * ghostAge; goy = ghostVY * ghostAge; }

      gctx.globalCompositeOperation = "lighter";
      gctx.lineJoin = "miter";

      if (ghost) {
        // hollow outline, drifting and dissolving through the ma
        var ga = 0.55 * dim;
        fillVerts(tms, Math.min(1, corrupt + ghostAge / 9000), arc, gx, gw, midY, ampY, 5);
        gctx.lineWidth = 3.2;
        gctx.strokeStyle = "rgba(22,224,224," + (ga * 0.16).toFixed(3) + ")";
        strokePoly(gox, goy);
        gctx.lineWidth = 1;
        gctx.strokeStyle = "rgba(190,235,240," + ga.toFixed(3) + ")";
        strokePoly(gox, goy);
      } else {
        // shadow twin: dim, lagged flicker, offset low-right
        if (tms < shadowUntil) {
          fillVerts(tms - 260, corrupt, arc, gx, gw, midY, ampY, 5);
          gctx.lineWidth = 1.2;
          gctx.strokeStyle = "rgba(22,224,224," + (0.20 * dim).toFixed(3) + ")";
          strokePoly(6, 5);
        }
        fillVerts(tms, corrupt, arc, gx, gw, midY, ampY, 5);
        // RGB split grows with generation + arc — the tube's yoke failing
        var split = 0.4 + corrupt * 5 + arc * 2.5;
        var la = Math.min(1, (0.5 + 0.5 * (1 - corrupt * 0.45)) * dim);
        gctx.lineWidth = 3.4;                               // glow pass
        gctx.strokeStyle = "rgba(22,224,224," + (la * 0.14).toFixed(3) + ")";
        strokePoly(0, 0);
        gctx.lineWidth = 1.4;
        gctx.strokeStyle = "rgba(255,45,85," + (la * 0.85).toFixed(3) + ")"; strokePoly(-split, 0);
        gctx.strokeStyle = "rgba(255,61,240," + (la * 0.7).toFixed(3) + ")"; strokePoly(split, split * 0.4);
        gctx.strokeStyle = "rgba(22,224,224," + la.toFixed(3) + ")"; strokePoly(0, 0);

        // answer echo: a second sign flashes offset, then fades
        if (tms < echoUntil) {
          var k = (echoUntil - tms) / 900;
          var eo = 8 + (1 - k) * 22;
          gctx.lineWidth = 1.2;
          gctx.strokeStyle = "rgba(255,61,240," + (k * 0.55 * dim).toFixed(3) + ")";
          strokePoly(Math.cos(echoAng) * eo, Math.sin(echoAng) * eo * 0.5);
        }
      }

      // katakana nameplate + generation caption
      var kx = GW - kanaW + 2, ky = GH * 0.58;
      var ksz = (GW * 0.24) | 0;
      gctx.font = "700 " + ksz + 'px "Shippori Mincho", serif';
      if (ghost) {
        gctx.strokeStyle = "rgba(190,235,240," + (0.6 * dim).toFixed(3) + ")";
        gctx.lineWidth = 1;
        gctx.strokeText(shown.name, kx + gox * 0.4, ky + goy * 0.4);
      } else {
        var ks = 0.4 + corrupt * 2.6;
        gctx.fillStyle = "rgba(255,45,85," + (0.6 * dim).toFixed(3) + ")";
        gctx.fillText(shown.name, kx - ks, ky);
        gctx.fillStyle = "rgba(22,224,224," + (0.75 * dim).toFixed(3) + ")";
        gctx.fillText(shown.name, kx + ks, ky);
      }
      gctx.font = '9px "JetBrains Mono", monospace';
      gctx.fillStyle = "rgba(107,100,115," + (0.8 * Math.min(1, dim)).toFixed(2) + ")";
      gctx.fillText(ghost ? "残" + genLabel : genLabel, kx, ky + 14);

      gctx.globalCompositeOperation = "source-over";
    }

    // register listeners (both APIs append, so the UI log keeps working)
    try {
      if (typeof Z.setEventListener === "function") Z.setEventListener(onEvent);
      if (typeof Z.setNoteListener === "function") Z.setNoteListener(onNote);
    } catch (e) {}

    return { frame: frame };
  })();

  // draw the waveform path, offset horizontally (for RGB channel split)
  function strokeWave(xoff, arc) {
    ctx2d.beginPath();
    var step = Math.max(1, (timeData.length / W) | 0), tear = 0;
    for (var sx = 0, idx = 0; sx < W; sx++, idx += step) {
      if (arc > 0.6 && Math.random() < 0.012) tear = (Math.random() * 2 - 1) * arc * 16;
      var y = H * 0.5 + ((timeData[idx % timeData.length] - 128) / 128) * H * 0.4 + tear;
      if (sx === 0) ctx2d.moveTo(sx + xoff, y); else ctx2d.lineTo(sx + xoff, y);
    }
    ctx2d.stroke();
  }

  function draw() {
    ensureTap();
    var arc = Z.getArc ? Z.getArc() : 0;

    // ---- datamosh: smear a horizontal band of the previous frame (kyū) ----
    if (arc > 0.55 && Math.random() < arc * 0.1) {
      ctx2d.save(); ctx2d.setTransform(1, 0, 0, 1, 0, 0);
      var bandH = (16 + Math.random() * 70) * dpr, bandY = Math.random() * (H * dpr - bandH);
      var jit = (Math.random() * 2 - 1) * 40 * dpr * arc;
      ctx2d.globalAlpha = 0.85;
      ctx2d.drawImage(canvas, 0, bandY, W * dpr, bandH, jit, bandY, W * dpr, bandH);
      ctx2d.restore();
    }
    // ---- phosphor trails: fade the prior frame instead of clearing ----
    ctx2d.fillStyle = "rgba(3,3,5,0.35)";
    ctx2d.fillRect(0, 0, W, H);

    if (analyser) {
      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // ---- spectrum bars (lower half) ----
      var bins = 64, bw = W / bins;
      for (var i = 0; i < bins; i++) {
        var v = freqData[(i * freqData.length / bins) | 0] / 255;
        var h = v * H * 0.62;
        var glitch = (arc > 0.5 && Math.random() < arc * 0.07) ? (Math.random() * 2 - 1) * 12 * arc : 0;
        var x = i * bw + glitch, mix = i / bins;
        var r = Math.round(255 * (1 - mix * 0.4)), g = Math.round(45 + mix * 120), b = Math.round(85 + mix * 150);
        ctx2d.fillStyle = "rgba(" + r + "," + g + "," + b + "," + (0.35 + v * 0.5).toFixed(2) + ")";
        ctx2d.fillRect(x, H - h, Math.max(1, bw - 1.5), h);
      }

      // ---- waveform with RGB channel-split (aberration grows with arc) ----
      var off = arc * 6;
      ctx2d.globalCompositeOperation = "lighter";
      ctx2d.lineWidth = 1.3;
      ctx2d.strokeStyle = "rgba(255,45,85," + (0.4 + arc * 0.4).toFixed(2) + ")"; strokeWave(-off, arc);
      ctx2d.strokeStyle = "rgba(22,224,224," + (0.5 + arc * 0.4).toFixed(2) + ")"; strokeWave(0, arc);
      ctx2d.strokeStyle = "rgba(255,61,240," + (0.4 + arc * 0.4).toFixed(2) + ")"; strokeWave(off, arc);
      ctx2d.globalCompositeOperation = "source-over";

      // ---- red center-line pulsing with energy ----
      var energy = 0; for (var e = 0; e < freqData.length; e += 8) energy += freqData[e];
      energy = energy / (freqData.length / 8) / 255;
      ctx2d.fillStyle = "rgba(255,45,85," + (0.05 + energy * 0.18).toFixed(3) + ")";
      ctx2d.fillRect(0, H * 0.5 - 1, W, 2);

      // ---- scanline dropout bands at high arc ----
      if (arc > 0.5) {
        var nb = Math.floor(Math.random() * arc * 3);
        ctx2d.fillStyle = "rgba(0,0,0,0.7)";
        for (var b2 = 0; b2 < nb; b2++) ctx2d.fillRect(0, Math.random() * H, W, 1 + Math.random() * 3);
      }
    } else {
      ctx2d.fillStyle = "rgba(107,100,115,0.5)";
      ctx2d.font = '11px "JetBrains Mono", monospace';
      ctx2d.fillText("// awaiting signal — press PLAY", 14, H / 2);
    }

    // ---- motif genealogy glyph (drawn to its own 動機 window canvas) ----
    try { Glyph.frame(arc); } catch (e) {}

    var sweep = ((Z.getAudioTime ? Z.getAudioTime() : 0) * 40) % W;
    ctx2d.fillStyle = "rgba(255,61,240,0.06)";
    ctx2d.fillRect(sweep, 0, 2, H);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

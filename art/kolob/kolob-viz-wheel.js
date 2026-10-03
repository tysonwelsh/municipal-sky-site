// ============================================================================
// KOLOB — kolob-viz-wheel.js: the wheel — the order of service round the
// crown — and the organ facade standing inside it
//
// One of the page's six files (kolob-viz.js raises KolobViz over them; THE
// SIX FILES there, and _viz.php's list): THE WHEEL and THE ORGAN of
// kolob-viz.js's header. The section now playing lettered at the crown under
// one gilt arc that fills as it plays, the wheel turning a seat beneath it
// when the arc is full; inside the hour ring, the tabernacle's facade, black
// pipes breathing with the spectrum of the master bus. Drawn by the page's
// frame on the wheel's own canvas (drawWheel, after the staff). Lends
// drawWheel, wheelSeatAt and setWheelLabels (the last two on KolobViz's
// surface); reads the wheel's plate (VS.xctx, VS.XW, VS.XH), the conductor's
// report (VS.cond) and whether the meeting plays (VS.playing) from
// kolob-viz.js.
// ============================================================================

window.KOLOB = window.KOLOB || {};
(function () {
  "use strict";
  var K = window.KolobAudio;
  // The page's shared state. Each of the page's files lends what the others
  // need onto VS (the LENT block at its foot); a name written VS.x belongs to
  // another of them; a bare name is this file's own or borrowed below.
  var VS = window.KOLOB._viz = window.KOLOB._viz || {};

  // (the other files' state, read through VS: VS.xctx, VS.XW, VS.XH, VS.cond, VS.playing)

  var PIPE = "#17201a";                            // the black of the facade
  var PAPER = "#f5f0e4";                           // cream, for the pipe mouths

  // ---- the organ: spectrum → facade ------------------------------------------
  // Band k is seated the way real pipes are racked: the gravest pipe in the
  // middle, then alternating left/right outward, so the facade breathes from
  // its center. An AnalyserNode taps the master bus once audio exists.
  // Kept ODD so the seating below places the gravest pipe dead-center and pairs
  // the rest symmetrically outward; fewer pipes also widen `step`, so the bars
  // and the gaps between them both grow with the count.
  var NPIPES = 21;
  var analyser = null, freqData = null, bandBins = null;
  var bands = [], seatOf = [];
  (function () {
    var c = Math.floor(NPIPES / 2);
    for (var k = 0; k < NPIPES; k++) {
      bands.push(0);
      seatOf.push(c + Math.ceil(k / 2) * (k % 2 === 1 ? -1 : 1));
    }
  })();

  function ensureAnalyser() {
    if (analyser || !K || !K.attachAnalyser) return;
    analyser = K.attachAnalyser();                 // null until the audio ctx exists
    if (!analyser) return;
    analyser.smoothingTimeConstant = 0.82;
    freqData = new Uint8Array(analyser.frequencyBinCount);
    // log-spaced bands, ~55 Hz to ~3.6 kHz — the world the meeting sounds in
    var nyquist = analyser.context.sampleRate / 2;
    var perBin = nyquist / analyser.frequencyBinCount;
    bandBins = [];
    for (var k = 0; k < NPIPES; k++) {
      var lo = 55 * Math.pow(3600 / 55, k / NPIPES);
      var hi = 55 * Math.pow(3600 / 55, (k + 1) / NPIPES);
      var b0 = Math.max(1, Math.floor(lo / perBin));
      var b1 = Math.max(b0, Math.floor(hi / perBin));
      bandBins.push([b0, b1]);
    }
  }

  function drawPipe(c, cx, baseY, w, h) {
    // Rb: the foot — just slightly thinner than the shoulder (r) so the pipe
    // tapers gently inward toward the base without the heavy-footed look of the
    // original 0.5w base.
    var r = w * 0.4, Rb = w * 0.36;
    var topY = baseY - h;
    // body — a slightly tapered foot up to the shoulders, then a domed cap
    c.beginPath();
    c.moveTo(cx - Rb, baseY);
    c.lineTo(cx - r, topY + r);
    c.quadraticCurveTo(cx - r, topY, cx, topY);
    c.quadraticCurveTo(cx + r, topY, cx + r, topY + r);
    c.lineTo(cx + Rb, baseY);
    c.closePath();
    c.fillStyle = PIPE;
    c.fill();
    // the mouth — a paper-colored pointed arch near the foot, the one detail
    // that says "organ pipe" and not "bar graph"
    var mh = Math.min(w * 0.85, h * 0.3);
    var mw = w * 0.42;                               // a narrower mouth arch
    var my = baseY - Math.max(10, h * 0.13);
    c.beginPath();
    c.moveTo(cx - mw / 2, my);
    c.quadraticCurveTo(cx - mw * 0.18, my - mh * 0.55, cx, my - mh);
    c.quadraticCurveTo(cx + mw * 0.18, my - mh * 0.55, cx + mw / 2, my);
    c.closePath();
    c.fillStyle = PAPER;
    c.fill();
  }

  // sample the spectrum into the 21 bands, with an analyzer's feel: quick to
  // rise, slower to fall. Silent (every band settling to 0) when not playing.
  function updateBands(dt) {
    if (VS.playing) ensureAnalyser();
    var live = VS.playing && analyser;
    if (live) analyser.getByteFrequencyData(freqData);
    for (var k = 0; k < NPIPES; k++) {
      var target = 0;
      if (live) {
        var span = bandBins[k], peak = 0;
        for (var b = span[0]; b <= span[1] && b < freqData.length; b++) {
          if (freqData[b] > peak) peak = freqData[b];
        }
        target = Math.pow(peak / 255, 1.3);
      }
      bands[k] += (target - bands[k]) * Math.min(1, dt * (target > bands[k] ? 9 : 2.4));
    }
  }
  // The facade stands INSIDE the wheel: the pipes' feet on the horizon (the
  // impost is the horizon rule), seated across the hour ring's chord. Every
  // pipe may rise to the same ceiling — the crown of the hour ring — so the
  // outer pipes are no longer pinned under the arch where it bends down to
  // the horizon (the owner: "let the pipes ignore the arc for now"); a
  // tall outer pipe simply crosses the ring. The travel still favours the
  // centre (the outer seats reach ~55% of the crown), so the facade keeps
  // its shape. At rest the minimum heights alone draw the stepped skyline of
  // the hymnbook cover. Drawn on the wheel canvas by drawWheel, after the
  // ring and the seat labels and before the fixed arc and the horizon rule.
  function drawFacade(c, g) {
    var baseY = g.horizonY, cx = g.cx, cy = g.cy, rIn = g.rHour;
    var dy = cy - baseY;                                       // the wheel's centre is this far below the horizon
    var halfChord = Math.sqrt(Math.max(0, rIn * rIn - dy * dy)); // the hour ring's half-width at the horizon
    var span = Math.max(60, (halfChord - 8) * 2);
    var step = span / NPIPES;
    var x0 = cx - span / 2 + step / 2;
    var CEIL = 6;                                              // paper between the tallest cap and the ring's crown
    var maxH = Math.max(50, baseY - (cy - rIn) - CEIL);        // one ceiling for every pipe: the crown of the hour ring
    for (var k = 0; k < NPIPES; k++) {
      var seat = seatOf[k];
      var x = x0 + seat * step;
      // wider, graver pipes toward the center of the facade
      var centerness = 1 - Math.abs(seat - (NPIPES - 1) / 2) / ((NPIPES - 1) / 2);
      var w = step * (0.5 + centerness * 0.34);
      var minH = 18 + centerness * 22;
      var h = minH + bands[k] * (maxH - minH) * (0.55 + centerness * 0.45);
      drawPipe(c, x, baseY, w, Math.min(h, maxH));
    }
  }

  // ---- the wheel — the order of service round the crown -----------------------
  var SEATS = ["prelude", "invocation", "hymn", "testimony", "sacrament", "doxology", "postlude"];
  var NSEAT = SEATS.length, SEAT_STEP = Math.PI * 2 / NSEAT;
  var seatLabels = ["PRELUDE", "INVOCATION", "HYMN", "TESTIMONY", "SACRAMENT", "DOXOLOGY", "POSTLUDE"];
  var seatSpoken = seatLabels.slice();             // for the live region (always Latin)
  var reduceMotion = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  var wh = {
    seat: 0,                 // the seat at the crown (folded)
    offset: 0,               // the wheel's rotation, in seats — grows anticlockwise
    from: 0, to: 0, t: 1, dur: 0, e: 1, wrap: false,
    fill: 0, fillHold: 0,    // the arc: what is shown, and what it held when the turn began
    liveKey: "",
  };
  function seatOfType(t) { return t === "interlude" ? "hymn" : t; }
  // Fold the plan onto the seven seats: which seat is up, and how far through
  // it — several hymns (and the interlude) share one seat, so the arc fills in
  // parts, a tick between them.
  function wheelState() {
    var type = seatOfType(VS.cond.section || "prelude");
    var seat = Math.max(0, SEATS.indexOf(type));
    var plan = VS.cond.plan, si = VS.cond.sectionIndex || 0, k = 0, count = 1;
    if (plan && plan.length) {
      count = 0;
      for (var i = 0; i < plan.length; i++) if (seatOfType(plan[i]) === type) { if (i < si) k++; count++; }
      count = Math.max(1, count);
    }
    k = Math.min(k, count - 1);
    var local = Math.max(0, Math.min(1, VS.cond.local || 0));
    return { seat: seat, prog: (k + local) / count, count: count, k: k };
  }
  function wheelGeom() {
    var fontPx = Math.max(14, Math.min(24, VS.XW * 0.03));     // the type scales with the wheel
    var crownY = Math.round(VS.XH * 0.14);                     // the sky above the crown: a breath under the running head
    // the horizon is pinned to the plate (4px above its foot) so the divider
    // before the staff sits at one height at every width; the wheel's radius
    // follows from it — the crown shows 0.52 R above the horizon, deep enough
    // that the organ stands inside the hour ring with headroom — capped so a
    // narrow page still sees the neighbouring seats
    var horizonY = VS.XH - 4;                                  // at the band's foot: the staff plate is drawn up over it
    var R = Math.min((horizonY - crownY) / 0.52, VS.XW * 0.62);
    var rBanner = R - fontPx * 2.35;                        // the banner's inner rule
    return {
      fontPx: fontPx, R: R, cx: VS.XW / 2, cy: crownY + R, crownY: crownY,
      horizonY: horizonY,
      rBanner: rBanner,
      rHour: rBanner - fontPx * 1.3,                         // the hour ring: the arch the organ stands under
    };
  }
  // Set a string along a circle: glyph by glyph, each rotated to the tangent at
  // its own angle, the word centred on `centreA`. Deseret letters are astral
  // code points, so the string is split with Array.from, not charAt.
  function curvedText(c, txt, cx, cy, r, centreA, track) {
    var glyphs = Array.from(txt), widths = [], total = 0;
    for (var i = 0; i < glyphs.length; i++) { widths[i] = c.measureText(glyphs[i]).width; total += widths[i]; }
    total += track * (glyphs.length - 1);
    var ang = centreA - (total / 2) / r;
    for (var j = 0; j < glyphs.length; j++) {
      var ga = ang + (widths[j] / 2) / r;
      c.save();
      c.translate(cx + Math.cos(ga) * r, cy + Math.sin(ga) * r);
      c.rotate(ga + Math.PI / 2);
      c.fillText(glyphs[j], 0, 0);
      c.restore();
      ang += (widths[j] + track) / r;
    }
  }
  // (the wheel's ink and gilt at an alpha: each string built once for each
  // alpha asked, not toFixed every frame — the turn's fades ask a few
  // hundred; past TINT_KEEP they are built as asked, and not kept)
  var TINT_KEEP = 1024, inkOf = new Map(), giltOf = new Map();
  function tint(kept, rgb, a) {
    var str = kept.get(a);
    if (str === undefined) {
      str = "rgba(" + rgb + ", " + a.toFixed(3) + ")";
      if (kept.size < TINT_KEEP) kept.set(a, str);
    }
    return str;
  }
  function inkA(a) { return tint(inkOf, "30, 77, 59", a); }
  function giltA(a) { return tint(giltOf, "138, 122, 69", a); }
  function radial(c, cx, cy, a, r0, r1) {
    c.beginPath();
    c.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    c.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    c.stroke();
  }
  function drawWheel(dt) {
    if (!VS.xctx) return;
    var c = VS.xctx, st = wheelState();
    // a new seat is up: turn to it — always anticlockwise, always forward round
    // the wheel, so postlude → prelude is one seat and a rehearsal skip back
    // goes the long way round (faster, the further it has to go)
    if (VS.playing && st.seat !== wh.seat) {
      var steps = (st.seat - wh.seat + NSEAT) % NSEAT;
      wh.wrap = st.seat < wh.seat;
      wh.from = wh.offset; wh.to = wh.offset + steps; wh.t = 0;
      wh.dur = reduceMotion ? 0 : Math.min(3, 1.6 + 0.4 * (steps - 1));
      wh.fillHold = wh.fill;
      wh.seat = st.seat;
    }
    if (wh.t < 1) {
      wh.t = wh.dur > 0 ? Math.min(1, wh.t + dt / wh.dur) : 1;
      wh.e = wh.t < 0.5 ? 2 * wh.t * wh.t : 1 - Math.pow(-2 * wh.t + 2, 2) / 2;
      wh.offset = wh.from + (wh.to - wh.from) * wh.e;
      if (wh.t >= 1) { wh.offset = wh.offset % NSEAT; wh.wrap = false; wh.fill = 0; }
    }
    var turning = wh.t < 1;
    // the arc follows the conductor with a short lag; through a turn it holds
    // what it had and fades, then starts again from nothing for the risen seat
    if (turning) {
      wh.fill = wh.fillHold;
    } else {
      var target = VS.playing ? st.prog : 0;
      if (target < wh.fill - 0.3) wh.fill = target;          // a skip: no rewind
      else wh.fill += (target - wh.fill) * Math.min(1, dt * 5);
    }
    var fillAlpha = turning ? 1 - wh.e : 1;

    var g = wheelGeom(), R = g.R, cx = g.cx, cy = g.cy, fontPx = g.fontPx;
    var TRACK = fontPx * 0.14;
    c.clearRect(0, 0, VS.XW, VS.XH);
    c.font = fontPx + 'px "Noto Sans Deseret", "EB Garamond", serif';
    if ("letterSpacing" in c) c.letterSpacing = "0em";
    c.textAlign = "center"; c.textBaseline = "alphabetic";
    c.lineWidth = 1;

    c.save();
    c.beginPath(); c.rect(0, 0, VS.XW, g.horizonY); c.clip();  // the wheel lives above the horizon

    // the sun's body: a breath of gilt at the crown, fading to paper
    var grad = c.createRadialGradient(cx, g.crownY + R * 0.18, 0, cx, g.crownY + R * 0.18, R * 0.75);
    grad.addColorStop(0, giltA(0.10)); grad.addColorStop(1, giltA(0));
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
    // the rim, and the banner's inner rule
    c.strokeStyle = inkA(0.5);
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = inkA(0.3);
    c.beginPath(); c.arc(cx, cy, g.rBanner, 0, Math.PI * 2); c.stroke();
    // beneath the banner: the dial. A faint hour ring, a spoke to every seat
    // across the band between the ring and the banner, quarter-marks standing
    // out from the ring between the seats — the turning made visible. Nothing
    // is drawn inside the ring: that disc is the organ's.
    var rHour = g.rHour;
    c.strokeStyle = inkA(0.12);
    c.beginPath(); c.arc(cx, cy, rHour, 0, Math.PI * 2); c.stroke();
    for (var q = 0; q < NSEAT * 4; q++) {
      var qa = -Math.PI / 2 + (q / 4 - wh.offset) * SEAT_STEP;
      if (q % 4 === 0) { c.strokeStyle = inkA(0.2); radial(c, cx, cy, qa, rHour, g.rBanner); }
      else { var half = q % 4 === 2; c.strokeStyle = inkA(half ? 0.3 : 0.2); radial(c, cx, cy, qa, rHour, rHour + (half ? 9 : 5)); }
    }
    // the seats: a tick on the rim, the label lettered round the banner
    for (var i = 0; i < NSEAT; i++) {
      var a = -Math.PI / 2 + (i - wh.offset) * SEAT_STEP;
      c.strokeStyle = inkA(0.45); radial(c, cx, cy, a, R, R - 7);
      var alpha = 0.62;
      if (VS.playing) {
        if (i === wh.seat) alpha = 1;
        else if (i < wh.seat) alpha = 0.28;
        else if (wh.wrap && turning) alpha = 0.28 + 0.34 * wh.e;   // the finished seats clear as the new meeting rises
      }
      c.fillStyle = inkA(alpha);
      curvedText(c, seatLabels[i] || SEATS[i], cx, cy, R - fontPx * 1.6, a, TRACK);
    }
    // the organ, standing on the horizon inside the hour ring
    updateBands(dt);
    drawFacade(c, g);
    // THE arc — one, fixed to the page at the crown; the wheel turns beneath it.
    // It runs from the left neighbour's tick to the right neighbour's: the whole
    // crown of the wheel is the bar, and each section refills it.
    var span = SEAT_STEP * 2, a0 = -Math.PI / 2 - SEAT_STEP, rr = R + 6;
    c.save();
    c.setLineDash([1, 3]); c.strokeStyle = inkA(0.3);
    c.beginPath(); c.arc(cx, cy, rr, a0, a0 + span); c.stroke();
    c.restore();
    c.strokeStyle = inkA(0.4);
    radial(c, cx, cy, a0, rr - 3, rr + 3); radial(c, cx, cy, a0 + span, rr - 3, rr + 3);
    if (wh.fill > 0.002 && fillAlpha > 0.01) {
      c.lineWidth = 3; c.lineCap = "butt"; c.strokeStyle = giltA(fillAlpha);
      c.beginPath(); c.arc(cx, cy, rr, a0, a0 + span * wh.fill); c.stroke();
      c.lineWidth = 1;
    }
    // a seat that folds several hymns: ticks divide the arc, one hymn to a part
    if (VS.playing && st.count > 1) {
      c.strokeStyle = inkA(0.45);
      for (var k = 1; k < st.count; k++) radial(c, cx, cy, a0 + span * k / st.count, rr - 3, rr + 3);
    }
    c.restore();

    // the horizon: the letterpress rule the wheel sets behind and the organ
    // stands on (its impost) — one hairline; the double rule stays unique to
    // the title
    c.strokeStyle = inkA(0.42);
    c.beginPath(); c.moveTo(0, g.horizonY + 0.5); c.lineTo(VS.XW, g.horizonY + 0.5); c.stroke();

    // the live region, for readers who cannot see the wheel: on a new seat and
    // at the quarter-marks, never every frame
    var live = document.getElementById("kolob-wheel-live");
    if (live) {
      var key = VS.playing ? wh.seat + ":" + st.k + ":" + Math.floor(st.prog * 4) : "idle";
      if (key !== wh.liveKey) {
        wh.liveKey = key;
        live.textContent = VS.playing
          ? seatSpoken[wh.seat] + (st.count > 1 ? " " + (st.k + 1) + " of " + st.count : "") + " · " + Math.round(st.prog * 100) + "%"
          : "";
      }
    }
  }
  // Which seat is under a point of the wheel canvas (CSS px) — for the dev
  // jump menu. Null off the wheel or beneath the horizon.
  function wheelSeatAt(x, y) {
    if (!VS.xctx) return null;
    var g = wheelGeom();
    if (y > g.horizonY) return null;
    var d = Math.hypot(x - g.cx, y - g.cy);
    if (d < g.rBanner - 4 || d > g.R + 12) return null;
    var a = Math.atan2(y - g.cy, x - g.cx);
    var i = Math.round((a + Math.PI / 2) / SEAT_STEP + wh.offset);
    return SEATS[((i % NSEAT) + NSEAT) % NSEAT];
  }
  function setWheelLabels(display, spoken) {
    if (display && display.length === NSEAT) seatLabels = display.slice();
    if (spoken && spoken.length === NSEAT) seatSpoken = spoken.slice();
  }

  // ==========================================================================
  // LENT — what this file shares with the rest of the page (KOLOB._viz)
  // ==========================================================================
  VS.drawWheel = drawWheel;
  VS.wheelSeatAt = wheelSeatAt;
  VS.setWheelLabels = setWheelLabels;
})();

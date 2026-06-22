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

  var W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.floor(W * dpr); canvas.height = Math.floor(H * dpr);
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);
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

    var sweep = ((Z.getAudioTime ? Z.getAudioTime() : 0) * 40) % W;
    ctx2d.fillStyle = "rgba(255,61,240,0.06)";
    ctx2d.fillRect(sweep, 0, 2, H);

    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

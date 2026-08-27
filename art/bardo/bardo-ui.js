// ============================================================================
// BARDO — UI controller (conductor telemetry + liturgy meter + console + log)
// Talks only to window.BardoAudio (engine) and window.BardoViz (visual).
// ============================================================================
(function () {
  "use strict";
  var B = window.BardoAudio;
  if (!B) { if (window.console) console.error("Bardo UI: engine missing"); return; }

  // Which layers get a RATE slider
  var RATE_LAYERS = { murmur: true, dungchen: true, gyaling: true, kangling: true, floor: true, noise: true, ambient: true };

  var LAYER_META = {
    hull:     { label: "HULL",     tib: "ཧཱ", uchen: true },
    chant:    { label: "CHANT",    tib: "dbyangs" },
    murmur:   { label: "MURMUR",   tib: "'don" },
    dungchen: { label: "DUNGCHEN", tib: "dung chen" },
    gyaling:  { label: "GYALING",  tib: "rgya gling" },
    dungkar:  { label: "DUNGKAR",  tib: "dung dkar" },
    kangling: { label: "KANGLING", tib: "rkang gling" },
    umdze:    { label: "UMDZÉ",    tib: "rol mo" },
    floor:    { label: "FLOOR",    tib: "ḍāmaru·dril bu" },
    noise:    { label: "DUST",     tib: "" },
    ambient:  { label: "EVENTS",   tib: "" },
  };

  // Param slider ranges by key: [min, max, step, decimals, unit]
  function paramRange(key) {
    if (key === "monks")  return [1, 4, 1, 0, ""];
    if (key === "cutoff") return [60, 600, 5, 0, "Hz"];
    if (key === "pace")   return [0.4, 2.5, 0.05, 2, "×"];
    return [0, 1, 0.05, 2, ""];
  }
  function pct(v) { return Math.round(v * 100); }
  function fmt(v, m) { var s = Number(v).toFixed(m[3]); return m[4] ? s + " " + m[4] : s; }

  // ==========================================================================
  // Console (mixer)
  // ==========================================================================
  function renderMixer() {
    var host = document.getElementById("bardo-layers"); if (!host) return;
    var layers = B.getLayers ? B.getLayers() : [];
    var defaults = B.getLayerDefaults ? B.getLayerDefaults() : {};
    var volumes = B.getVolumes ? B.getVolumes() : {};
    host.innerHTML = "";

    layers.forEach(function (layer) {
      var meta = LAYER_META[layer] || { label: layer.toUpperCase(), tib: "" };
      var defs = defaults[layer] || {};
      var keys = Object.keys(defs);
      var vol = volumes[layer] != null ? volumes[layer] : 0.5;
      var row = document.createElement("div"); row.className = "bardo-layer";

      var tibHtml = meta.tib
        ? '<span class="bardo-layer-tib' + (meta.uchen ? ' bardo-layer-uchen' : '') + '">' + meta.tib + '</span>'
        : '';
      var rateHtml;
      if (RATE_LAYERS[layer]) {
        rateHtml = '<span class="bardo-layer-rate"><span class="bardo-ctl-label">RATE</span>' +
          '<span class="bardo-val-readout" data-rate-val="' + layer + '">1.00×</span>' +
          '<input type="range" class="bardo-range" min="0.25" max="3" step="0.05" value="1" data-rate="' + layer + '" /></span>';
      } else {
        // invisible twin keeps the VOL column aligned on rate-less rows
        rateHtml = '<span class="bardo-layer-rate bardo-rate-ghost" aria-hidden="true">' +
          '<span class="bardo-ctl-label">RATE</span>' +
          '<span class="bardo-val-readout">1.00×</span>' +
          '<input type="range" class="bardo-range" min="0.25" max="3" value="1" tabindex="-1" /></span>';
      }
      var expandHtml = keys.length
        ? '<button type="button" class="bardo-expand" data-expand="' + layer + '" aria-expanded="false" title="fine parameters">···</button>'
        : '<span class="bardo-expand bardo-expand-ghost" aria-hidden="true">···</span>';

      var head = document.createElement("div"); head.className = "bardo-layer-head";
      head.innerHTML =
        '<span class="bardo-layer-name">' + meta.label + tibHtml + '</span>' +
        '<button type="button" class="bardo-layer-sample" data-sample="' + layer + '" title="sample this voice"><span class="tri"></span></button>' +
        '<button type="button" class="bardo-layer-toggle" data-layer="' + layer + '">ON</button>' +
        '<span class="bardo-layer-vol"><span class="bardo-ctl-label">VOL</span>' +
          '<span class="bardo-val-readout" data-vol-val="' + layer + '">' + pct(vol) + '</span>' +
          '<input type="range" class="bardo-range" min="0" max="100" value="' + pct(vol) + '" data-vol="' + layer + '" /></span>' +
        rateHtml + expandHtml;
      row.appendChild(head);

      if (keys.length) {
        var params = document.createElement("div"); params.className = "bardo-params";
        keys.forEach(function (key) {
          var m = paramRange(key);
          var val = B.getLayerParam ? B.getLayerParam(layer, key, defs[key]) : defs[key];
          var wrap = document.createElement("label"); wrap.className = "bardo-param";
          wrap.innerHTML =
            '<span class="bardo-param-label">' + key + ' <b data-param-val="' + layer + ':' + key + '">' + fmt(val, m) + '</b></span>' +
            '<input type="range" class="bardo-range" min="' + m[0] + '" max="' + m[1] + '" step="' + m[2] + '" value="' + val + '" data-param="' + layer + ':' + key + '" />';
          params.appendChild(wrap);
        });
        row.appendChild(params);
      }
      host.appendChild(row);
    });
    wireMixer();
  }

  function wireMixer() {
    document.querySelectorAll("[data-vol]").forEach(function (el) {
      el.addEventListener("input", function () {
        var layer = el.getAttribute("data-vol");
        B.setLayerVolume(layer, parseInt(el.value, 10) / 100);
        var o = document.querySelector('[data-vol-val="' + layer + '"]'); if (o) o.textContent = el.value;
      });
    });
    document.querySelectorAll("[data-rate]").forEach(function (el) {
      el.addEventListener("input", function () {
        var layer = el.getAttribute("data-rate"); var v = parseFloat(el.value);
        B.setLayerRate(layer, v);
        var o = document.querySelector('[data-rate-val="' + layer + '"]'); if (o) o.textContent = v.toFixed(2) + "×";
      });
    });
    document.querySelectorAll("[data-layer]").forEach(function (el) {
      el.addEventListener("click", function () {
        var on = B.toggleLayer(el.getAttribute("data-layer"));   // returns new enabled state
        el.classList.toggle("off", !on);
        el.textContent = on ? "ON" : "OFF";
      });
    });
    document.querySelectorAll("[data-sample]").forEach(function (el) {
      el.addEventListener("click", function () { if (B.sample) B.sample(el.getAttribute("data-sample")); });
    });
    document.querySelectorAll("[data-expand]").forEach(function (el) {
      el.addEventListener("click", function () {
        var row = el.closest(".bardo-layer"); if (!row) return;
        var open = row.classList.toggle("is-open");
        el.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    document.querySelectorAll("[data-param]").forEach(function (el) {
      el.addEventListener("input", function () {
        var p = el.getAttribute("data-param").split(":"), layer = p[0], key = p[1], v = parseFloat(el.value);
        B.setLayerParam(layer, key, v);
        var o = document.querySelector('[data-param-val="' + layer + ':' + key + '"]');
        if (o) o.textContent = fmt(v, paramRange(key));
      });
    });
  }

  // ==========================================================================
  // Activity log — newest on top, capped, color-coded by cat
  // ==========================================================================
  var LOG_CAP = 80;
  var logStart = null;
  function fmtTime(t) {
    if (logStart === null) logStart = t;
    var s = Math.max(0, Math.floor(t - logStart));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function clearLog() {
    logStart = null;
    var l = document.getElementById("bardo-log");
    if (l) l.innerHTML = '<div class="bardo-log-empty">listening…</div>';
  }
  function logEvent(ev) {
    var log = document.getElementById("bardo-log"); if (!log) return;
    var empty = log.querySelector(".bardo-log-empty"); if (empty) empty.remove();
    var row = document.createElement("div");
    row.className = "bardo-log-row cat-" + (ev.cat || "conductor");
    row.innerHTML =
      '<span class="bardo-log-time">' + fmtTime(ev.t || 0) + '</span>' +
      '<span class="bardo-log-tag ' + (ev.cat || "") + '">' + (ev.cat || "·") + '</span>' +
      '<span class="bardo-log-text">' + (ev.label || "") +
        (ev.detail ? ' <span class="bardo-log-detail">— ' + ev.detail + '</span>' : '') + '</span>';
    log.insertBefore(row, log.firstChild);
    while (log.children.length > LOG_CAP) log.removeChild(log.lastChild);
  }
  if (B.setEventListener) B.setEventListener(logEvent);

  // ==========================================================================
  // Conductor telemetry + liturgy meter + seed (polled ~300ms)
  // ==========================================================================
  var sceneEl = document.querySelector(".bardo-scene");
  var ROMAN = ["", "I", "II", "III", "IV", "V"];
  var ACTIVITY_WORD = { pacify: "PACIFYING", enrich: "ENRICHING", magnetize: "MAGNETIZING", destroy: "DESTROYING" };
  var segCount = -1;

  function pad3(n) { n = Math.max(0, n | 0); return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }

  function sectionDisplay(c) {
    var s = String(c.section || "—").toUpperCase();
    if (c.section === "offering" && c.sectionIndex >= 1) s += " " + (ROMAN[c.sectionIndex] || c.sectionIndex);
    return s;
  }
  function isWrathful(c) {
    return (c.activity === "destroy" || c.activity === "magnetize") &&
           (c.section === "action" || c.section === "offering");
  }

  function updateTelemetry(c, playing) {
    var el = document.getElementById("bardo-telemetry"); if (!el) return;
    var SEP = '<span class="t-sep">·</span>';
    if (!playing) {
      el.innerHTML = '<span class="t-gold">CEREMONY ———</span>' + SEP + 'THE VESSEL IS STILL';
      return;
    }
    var parts = [
      '<span class="t-gold">CEREMONY ' + pad3(c.ceremony) + '</span>',
      sectionDisplay(c),
      ACTIVITY_WORD[c.activity] || String(c.activity || "").toUpperCase(),
      'F0 ' + (typeof c.f0 === "number" ? c.f0.toFixed(1) : "—") + ' HZ',
      'HARMONICS ' + (c.spectral && c.spectral.length ? c.spectral.join("·") : "—"),
    ];
    if (c.tutti) parts.push('<span class="t-flag' + (isWrathful(c) ? ' wrath' : '') + '">TUTTI</span>');
    else if (c.hush) parts.push('<span class="t-flag">MA — HELD SILENCE</span>');
    el.innerHTML = parts.map(function (p) { return '<span class="t-part">' + p + '</span>'; }).join(SEP);
  }

  function updateMotifLine(playing) {
    var el = document.getElementById("bardo-motifline"); if (!el) return;
    if (!playing || !B.getMotifStats) { el.textContent = ""; return; }
    var ms = B.getMotifStats() || {};
    var w = ms.working || {};
    el.innerHTML = '◆ <b>' + (ms.developments || 0) + '</b> developments · <b>' + (ms.answers || 0) +
      '</b> answers · working theme <b>' + (w.theme || "—") + (w.gens != null ? "·g" + w.gens : "") + '</b>';
  }

  function updateMeter(c, playing) {
    var track = document.getElementById("bardo-liturgy-track");
    var current = document.getElementById("bardo-liturgy-current");
    if (!track) return;
    var n = playing && c.planLength ? c.planLength : 6;   // default silhouette: gen + 2 offerings + act + diss + ded
    if (n !== segCount) {
      segCount = n;
      track.innerHTML = "";
      for (var i = 0; i < n; i++) {
        var seg = document.createElement("div"); seg.className = "bardo-seg";
        seg.innerHTML = '<div class="bardo-seg-fill"></div>';
        track.appendChild(seg);
      }
    }
    var segs = track.children;
    for (var j = 0; j < segs.length; j++) {
      var done = playing && j < c.sectionIndex;
      var cur = playing && j === c.sectionIndex;
      segs[j].classList.toggle("done", done);
      segs[j].classList.toggle("current", cur);
      segs[j].firstChild.style.width = cur ? Math.round(Math.max(0, Math.min(1, c.local)) * 100) + "%" : (done ? "0%" : "0%");
    }
    if (current) {
      current.textContent = playing
        ? sectionDisplay(c).toLowerCase() + " · " + (c.activity || "")
        : "idle";
    }
    if (sceneEl) {
      sceneEl.classList.toggle("is-tutti", !!(playing && c.tutti));
      sceneEl.classList.toggle("is-wrathful", !!(playing && isWrathful(c)));
    }
  }

  function updateSeed() {
    var el = document.getElementById("bardo-seed-current");
    if (el && B.getSeed) el.textContent = String(B.getSeed());
  }

  function poll() {
    var playing = !!(B.isPlaying && B.isPlaying());
    var playBtn = document.getElementById("bardo-play");
    if (playBtn) playBtn.classList.toggle("is-playing", playing);
    var c = (B.getConductor && B.getConductor()) || {};
    updateTelemetry(c, playing);
    updateMotifLine(playing);
    updateMeter(c, playing);
    updateSeed();
  }
  setInterval(poll, 300);

  // ==========================================================================
  // Transport + rebirth
  // ==========================================================================
  function wireTransport() {
    var playBtn = document.getElementById("bardo-play");
    var stopBtn = document.getElementById("bardo-stop");
    var vol = document.getElementById("bardo-master-vol");
    var volVal = document.getElementById("bardo-master-vol-val");
    var rebirth = document.getElementById("bardo-rebirth");
    var seedInput = document.getElementById("bardo-seed-input");

    if (playBtn) playBtn.addEventListener("click", function () {
      clearLog(); B.play(); playBtn.classList.add("is-playing");
    });
    if (stopBtn) stopBtn.addEventListener("click", function () {
      B.stop(); if (playBtn) playBtn.classList.remove("is-playing");
    });
    if (vol) vol.addEventListener("input", function () {
      var v = parseInt(vol.value, 10);
      B.setMasterVolume(v / 100);
      if (volVal) volVal.textContent = v;
    });
    if (rebirth) rebirth.addEventListener("click", function () {
      var v = seedInput ? parseInt(seedInput.value, 10) : NaN;
      if (isNaN(v)) v = Math.floor(Math.random() * 4294967295);
      var wasPlaying = !!(B.isPlaying && B.isPlaying());
      if (wasPlaying) B.stop();
      B.reseed(v);
      if (seedInput) seedInput.value = "";
      updateSeed();
      clearLog();
      if (wasPlaying) {
        // let the engine's stop-fade complete before the next incarnation
        setTimeout(function () { B.play(); }, 950);
      }
    });
    if (seedInput) seedInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && rebirth) { e.preventDefault(); rebirth.click(); }
    });
  }

  // ==========================================================================
  // Visualizer hand-off (bardo-viz.js is owned elsewhere; call defensively)
  // ==========================================================================
  function initViz() {
    var canvas = document.getElementById("bardo-viz");
    if (canvas && window.BardoViz && typeof window.BardoViz.init === "function") {
      try { window.BardoViz.init(canvas); }
      catch (e) { if (window.console) console.error("Bardo viz init failed", e); }
    }
  }

  renderMixer();
  wireTransport();
  initViz();
  poll();
})();

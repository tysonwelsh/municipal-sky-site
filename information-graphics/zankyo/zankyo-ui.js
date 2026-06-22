// ============================================================================
// ZANKYŌ — UI controller (console + scale panel + jo-ha-kyū meter + log)
// ============================================================================
(function () {
  "use strict";
  var Z = window.ZankyoAudio;
  if (!Z) { if (window.console) console.error("Zankyo UI: engine missing"); return; }

  var RATE_LAYERS = { shakuhachi: true, koto: true, shamisen: true, taiko: true, noise: true, ambient: true };
  var LAYER_META = {
    subDrone:   { label: "Sub-drone", kana: "重低音" },
    sho:        { label: "Shō",        kana: "笙" },
    shakuhachi: { label: "Shakuhachi", kana: "尺八" },
    koto:       { label: "Koto",       kana: "箏" },
    shamisen:   { label: "Shamisen",   kana: "三味線" },
    taiko:      { label: "Taiko",      kana: "太鼓" },
    noise:      { label: "Noise",      kana: "雑音" },
    ambient:    { label: "Ambient",    kana: "環境" },
  };
  var PARAM_META = {
    subDrone:   { cutoff: [80, 500, 5, 0, "Hz"], drive: [0, 1, 0.05, 2, ""], sub: [0, 1, 0.05, 2, ""], movement: [0, 0.5, 0.02, 2, ""] },
    sho:        { cutoff: [400, 3000, 20, 0, "Hz"], voices: [3, 7, 1, 0, ""], shimmer: [0, 1, 0.05, 2, ""], drift: [0, 1, 0.05, 2, ""] },
    shakuhachi: { breath: [0, 1, 0.05, 2, ""], muraiki: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"], glide: [0, 1, 0.05, 2, ""], ornament: [0, 1, 0.05, 2, ""] },
    koto:       { brightness: [2, 16, 0.5, 1, ""], pace: [0.5, 2, 0.05, 2, "×"], gliss: [0, 1, 0.05, 2, ""], sustain: [0.3, 2, 0.05, 2, ""] },
    shamisen:   { sawari: [0, 1, 0.05, 2, ""], drive: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"], attack: [0, 1, 0.05, 2, ""] },
    taiko:      { punch: [0, 1, 0.05, 2, ""], drive: [0, 1, 0.05, 2, ""], lowTune: [0.5, 2, 0.05, 2, "×"] },
    noise:      { density: [0, 1, 0.05, 2, ""], color: [0, 1, 0.05, 2, ""], crush: [0, 1, 0.05, 2, ""] },
    ambient:    {},
  };

  function pct(v) { return Math.round(v * 100); }
  function fmt(v, m) { var s = Number(v).toFixed(m[3]); return m[4] ? s + " " + m[4] : s; }

  // ---- Scale panel ----
  function renderScale() {
    var host = document.getElementById("zankyo-scale"); if (!host) return;
    var s = Z.SCALE_INFO;
    host.innerHTML =
      '<span class="zankyo-scale-name"><b>' + s.name + '</b> · ' + s.tonic + '</span>' +
      '<span class="zankyo-kana-row">' + s.kana.map(function (k) { return '<span class="zankyo-kana">' + k + '</span>'; }).join("") + '</span>' +
      '<span class="zankyo-scale-mood">' + s.mood + '</span>';
  }

  // ---- Mixer ----
  function renderMixer() {
    var host = document.getElementById("zankyo-layers"); if (!host) return;
    var state = Z.getState(); host.innerHTML = "";
    Z.LAYERS.forEach(function (layer) {
      var meta = LAYER_META[layer] || { label: layer, kana: "" };
      var defaults = Z.LAYER_PARAM_DEFAULTS[layer] || {};
      var vol = state.layerVolumes[layer] != null ? state.layerVolumes[layer] : Z.DEFAULT_LAYER_VOL;
      var row = document.createElement("div"); row.className = "zankyo-layer";

      var rateHtml = "";
      if (RATE_LAYERS[layer]) {
        var rv = state.layerRate[layer] != null ? state.layerRate[layer] : 1;
        rateHtml = '<span class="zankyo-layer-rate"><span class="zankyo-vol-label">RATE</span>' +
          '<span class="zankyo-val-readout" data-rate-val="' + layer + '">' + rv.toFixed(2) + '×</span>' +
          '<input type="range" class="zankyo-range" min="0.25" max="3" step="0.05" value="' + rv + '" data-rate="' + layer + '" /></span>';
      }
      var head = document.createElement("div"); head.className = "zankyo-layer-head";
      head.innerHTML =
        '<span class="zankyo-layer-name"><span class="zankyo-layer-kana">' + meta.kana + '</span>' + meta.label + '</span>' +
        '<button type="button" class="zankyo-layer-sample" data-sample="' + layer + '" title="sample this instrument"><span class="tri"></span></button>' +
        '<button type="button" class="zankyo-layer-mute" data-layer="' + layer + '">ON</button>' +
        '<span class="zankyo-layer-vol"><span class="zankyo-vol-label">VOL</span>' +
          '<span class="zankyo-val-readout" data-vol-val="' + layer + '">' + pct(vol) + '</span>' +
          '<input type="range" class="zankyo-range" min="0" max="100" value="' + pct(vol) + '" data-vol="' + layer + '" /></span>' +
        rateHtml;
      row.appendChild(head);

      var pm = PARAM_META[layer] || {}, keys = Object.keys(defaults);
      if (keys.length) {
        var params = document.createElement("div"); params.className = "zankyo-params";
        keys.forEach(function (key) {
          var m = pm[key] || [0, 1, 0.01, 2, ""];
          var val = Z.getLayerParam(layer, key, defaults[key]);
          var wrap = document.createElement("label"); wrap.className = "zankyo-param";
          wrap.innerHTML = '<span class="zankyo-param-label">' + key + ' <b data-param-val="' + layer + ':' + key + '">' + fmt(val, m) + '</b></span>' +
            '<input type="range" class="zankyo-range" min="' + m[0] + '" max="' + m[1] + '" step="' + m[2] + '" value="' + val + '" data-param="' + layer + ':' + key + '" />';
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
        var layer = el.getAttribute("data-vol"); Z.setLayerVolume(layer, parseInt(el.value, 10) / 100);
        var o = document.querySelector('[data-vol-val="' + layer + '"]'); if (o) o.textContent = el.value;
      });
    });
    document.querySelectorAll("[data-rate]").forEach(function (el) {
      el.addEventListener("input", function () {
        var layer = el.getAttribute("data-rate"); var v = parseFloat(el.value); Z.setLayerRate(layer, v);
        var o = document.querySelector('[data-rate-val="' + layer + '"]'); if (o) o.textContent = v.toFixed(2) + "×";
      });
    });
    document.querySelectorAll("[data-layer]").forEach(function (el) {
      el.addEventListener("click", function () {
        var layer = el.getAttribute("data-layer"); var muted = Z.toggleLayer(layer);
        el.classList.toggle("muted", muted); el.textContent = muted ? "OFF" : "ON";
      });
    });
    document.querySelectorAll("[data-sample]").forEach(function (el) {
      el.addEventListener("click", function () { if (Z.sample) Z.sample(el.getAttribute("data-sample")); });
    });
    document.querySelectorAll("[data-param]").forEach(function (el) {
      el.addEventListener("input", function () {
        var p = el.getAttribute("data-param").split(":"), layer = p[0], key = p[1], v = parseFloat(el.value);
        Z.setLayerParam(layer, key, v);
        var o = document.querySelector('[data-param-val="' + layer + ':' + key + '"]');
        if (o) o.textContent = fmt(v, (PARAM_META[layer] && PARAM_META[layer][key]) || [0, 1, 0.01, 2, ""]);
      });
    });
  }

  // ---- Activity log ----
  var CAT_TAG = { shakuhachi: "尺八 SHAKU", koto: "箏 KOTO", shamisen: "三味線 SHAMI", taiko: "太鼓 TAIKO", noise: "雑音 NOISE", ambient: "環境 AMB", mode: "旋法 MODE" };
  var logStart = null;
  function fmtTime(t) { if (logStart === null) logStart = t; var s = Math.max(0, Math.floor(t - logStart)); var m = Math.floor(s / 60); return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
  function clearLog() { logStart = null; var l = document.getElementById("zankyo-log"); if (l) l.innerHTML = '<div class="zankyo-log-empty">listening…</div>'; }
  function logEvent(ev) {
    var log = document.getElementById("zankyo-log"); if (!log) return;
    var empty = log.querySelector(".zankyo-log-empty"); if (empty) empty.remove();
    var row = document.createElement("div"); row.className = "zankyo-log-row";
    row.innerHTML = '<span class="zankyo-log-time">' + fmtTime(ev.t) + '</span>' +
      '<span class="zankyo-log-tag ' + ev.cat + '">' + (CAT_TAG[ev.cat] || ev.cat) + '</span>' +
      '<span class="zankyo-log-text">' + ev.label + (ev.detail ? ' · ' + ev.detail : '') + '</span>';
    log.insertBefore(row, log.firstChild);
    while (log.children.length > 120) log.removeChild(log.lastChild);
  }
  if (Z.setEventListener) Z.setEventListener(logEvent);

  // ---- Jo-ha-kyū meter ----
  var sceneEl = document.querySelector(".zankyo-scene");
  var lastMode = null;
  function pollArc() {
    if (!Z.getArcInfo) return; var info = Z.getArcInfo();
    var fill = document.getElementById("zankyo-arc-fill"); var phase = document.getElementById("zankyo-arc-phase");
    // empty when idle; while playing, never fully empty — light a segment or two
    if (fill) fill.style.width = (info.phase === "—" ? 0 : Math.max(2, Math.round(info.level * 100))) + "%";
    if (phase) phase.textContent = info.phase === "—" ? "idle" : info.phase;
    if (sceneEl) sceneEl.classList.toggle("is-kyu", info.phase === "kyū");   // climax destabilization
    if (Z.getMode) { var m = Z.getMode(); if (m.name !== lastMode) { lastMode = m.name; renderScale(); } }   // live modal modulation
  }
  setInterval(pollArc, 280);

  // ---- Transport ----
  function wireTransport() {
    var playBtn = document.getElementById("zankyo-play"), stopBtn = document.getElementById("zankyo-stop");
    var vol = document.getElementById("zankyo-master-vol"), volVal = document.getElementById("zankyo-master-vol-val");
    if (playBtn) playBtn.addEventListener("click", function () { clearLog(); Z.play(); playBtn.classList.add("is-playing"); });
    if (stopBtn) stopBtn.addEventListener("click", function () { Z.stop(); if (playBtn) playBtn.classList.remove("is-playing"); });
    if (vol) vol.addEventListener("input", function () { var v = parseInt(vol.value, 10); Z.setMasterVolume(v / 100); if (volVal) volVal.textContent = v; });
  }

  renderScale(); renderMixer(); wireTransport(); pollArc();
})();

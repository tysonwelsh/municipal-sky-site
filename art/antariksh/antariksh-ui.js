// ============================================================================
// ANTARIKSH — UI controller
//
// Renders the raga info panel + the mixing console from AntarikshAudio's public
// surface, and wires the transport. No canvas visualization (Phase 1).
// ============================================================================

(function () {
  "use strict";

  var A = window.AntarikshAudio;
  if (!A) { if (window.console) console.error("Antariksh UI: audio engine missing"); return; }

  // Swara display names (Hindustani sargam).
  var SWARA_FULL = {
    "S": "Sa", "g": "komal Ga", "M": "Ma", "d": "komal Dha", "n": "komal Ni", "S'": "Sa’",
  };

  // Layers that fire discrete events (vs. continuous drones) get a RATE control —
  // how often the instrument fires, like Prospero's rate.
  var RATE_LAYERS = { lead: true, bansuri: true, santoor: true, ambient: true };

  // Friendly layer labels + per-param slider metadata (range / step / unit).
  var LAYER_LABEL = {
    tanpura: "Tanpura", pad: "Pad · glow", lead: "Lead · neo-sitar",
    bansuri: "Bansuri · flute", santoor: "Santoor · shimmer", ambient: "Ambient · starship",
  };
  var PARAM_META = {
    tanpura: {
      tempo:      { min: 2.5, max: 7,  step: 0.1,  label: "Tempo",      unit: "s",  dec: 1 },
      brightness: { min: 2,   max: 12, step: 0.5,  label: "Brightness", unit: "",   dec: 1 },
      jivari:     { min: 0,   max: 1,  step: 0.05, label: "Jivari",     unit: "",   dec: 2 },
      decay:      { min: 1.5, max: 6,  step: 0.1,  label: "Decay",      unit: "s",  dec: 1 },
      width:      { min: 0,   max: 1,  step: 0.05, label: "Width",      unit: "",   dec: 2 },
    },
    pad: {
      cutoff:   { min: 120, max: 800, step: 10,   label: "Cutoff",   unit: "Hz", dec: 0 },
      detune:   { min: 0,   max: 25,  step: 1,    label: "Detune",   unit: "¢", dec: 0 },
      movement: { min: 0,   max: 0.6, step: 0.02, label: "Movement", unit: "",   dec: 2 },
      sub:      { min: 0,   max: 1,   step: 0.05, label: "Sub",      unit: "",   dec: 2 },
    },
    lead: {
      brightness: { min: 3,   max: 16, step: 0.5,  label: "Brightness", unit: "",  dec: 1 },
      resonance:  { min: 0.5, max: 14, step: 0.5,  label: "Resonance",  unit: "",  dec: 1 },
      pace:       { min: 0.5, max: 2,  step: 0.05, label: "Pace",       unit: "×", dec: 2 },
      ornament:   { min: 0,   max: 1,  step: 0.05, label: "Ornament",   unit: "",  dec: 2 },
      pakad:      { min: 0,   max: 1,  step: 0.05, label: "Pakad",      unit: "",  dec: 2 },
      glide:      { min: 0,   max: 1,  step: 0.05, label: "Glide",      unit: "",  dec: 2 },
    },
    bansuri: {
      breath: { min: 0, max: 1,   step: 0.05, label: "Breath", unit: "",  dec: 2 },
      pace:   { min: 0.5, max: 2,  step: 0.05, label: "Pace",   unit: "×", dec: 2 },
      glide:  { min: 0, max: 1,   step: 0.05, label: "Glide",  unit: "",  dec: 2 },
    },
    santoor: {
      shimmer: { min: 0, max: 1, step: 0.05, label: "Shimmer", unit: "", dec: 2 },
      spread:  { min: 0, max: 1, step: 0.05, label: "Spread",  unit: "", dec: 2 },
    },
  };

  // -------------------------------------------------------------------------
  // Raga info panel
  // -------------------------------------------------------------------------
  function renderRaga() {
    var host = document.getElementById("antariksh-raga");
    if (!host) return;
    var r = A.RAGA;
    var vadi = r.vadi, samvadi = r.samvadi;

    var chips = r.swaras.map(function (s) {
      var cls = "antariksh-swara" + (s === vadi ? " vadi" : "") + (s === samvadi ? " samvadi" : "");
      return '<span class="' + cls + '">' + s + '<span class="full">' + (SWARA_FULL[s] || "") + '</span></span>';
    }).join("");

    host.innerHTML =
      '<div class="antariksh-raga-top">' +
        '<span class="antariksh-raga-name">Raga <b>' + r.name + '</b></span>' +
        '<span class="antariksh-raga-mood">' + r.mood + '</span>' +
      '</div>' +
      '<div class="antariksh-swaras">' + chips + '</div>' +
      '<div class="antariksh-raga-meta">' +
        '<span>thaat <b>' + r.thaat + '</b></span>' +
        '<span>aroha <b>' + r.aroha.join(" ") + '</b></span>' +
        '<span>avaroha <b>' + r.avaroha.join(" ") + '</b></span>' +
        '<span>vadi <b>' + SWARA_FULL[vadi] + '</b></span>' +
        '<span>samvadi <b>' + SWARA_FULL[samvadi] + '</b></span>' +
        '<span>drone <b>' + r.drone.map(function (s) { return SWARA_FULL[s]; }).join(" + ") + '</b></span>' +
      '</div>';
  }

  // -------------------------------------------------------------------------
  // Mixer
  // -------------------------------------------------------------------------
  function pct(v) { return Math.round(v * 100); }

  function renderMixer() {
    var host = document.getElementById("antariksh-layers");
    if (!host) return;
    var state = A.getState();
    host.innerHTML = "";

    A.LAYERS.forEach(function (layer) {
      var defaults = A.LAYER_PARAM_DEFAULTS[layer] || {};
      var row = document.createElement("div");
      row.className = "antariksh-layer";

      // Head: name + mute + volume.
      var vol = state.layerVolumes[layer] != null ? state.layerVolumes[layer] : A.DEFAULT_LAYER_VOL;
      var rateHtml = "";
      if (RATE_LAYERS[layer]) {
        var rv = state.layerRate[layer] != null ? state.layerRate[layer] : 1;
        rateHtml =
          '<span class="antariksh-layer-rate">' +
            '<span class="antariksh-vol-label">RATE</span>' +
            '<span class="antariksh-val-readout" data-rate-val="' + layer + '">' + rv.toFixed(2) + '×</span>' +
            '<input type="range" class="antariksh-range" min="0.25" max="3" step="0.05" value="' + rv + '" data-rate="' + layer + '" />' +
          '</span>';
      }
      var head = document.createElement("div");
      head.className = "antariksh-layer-head";
      head.innerHTML =
        '<span class="antariksh-layer-name">' + (LAYER_LABEL[layer] || layer) + '</span>' +
        '<button type="button" class="antariksh-layer-mute" data-layer="' + layer + '">ON</button>' +
        '<span class="antariksh-layer-vol">' +
          '<span class="antariksh-vol-label">VOL</span>' +
          '<span class="antariksh-val-readout" data-vol-val="' + layer + '">' + pct(vol) + '</span>' +
          '<input type="range" class="antariksh-range" min="0" max="100" value="' + pct(vol) + '" data-vol="' + layer + '" />' +
        '</span>' +
        rateHtml;
      row.appendChild(head);

      // Param sliders.
      var meta = PARAM_META[layer] || {};
      var keys = Object.keys(defaults);
      if (keys.length) {
        var params = document.createElement("div");
        params.className = "antariksh-params";
        keys.forEach(function (key) {
          var m = meta[key] || { min: 0, max: 1, step: 0.01, label: key, unit: "", dec: 2 };
          var val = A.getLayerParam(layer, key, defaults[key]);
          var wrap = document.createElement("label");
          wrap.className = "antariksh-param";
          wrap.innerHTML =
            '<span class="antariksh-param-label">' + m.label +
              ' <b data-param-val="' + layer + ':' + key + '">' + fmt(val, m) + '</b></span>' +
            '<input type="range" class="antariksh-range" min="' + m.min + '" max="' + m.max +
              '" step="' + m.step + '" value="' + val + '" data-param="' + layer + ':' + key + '" />';
          params.appendChild(wrap);
        });
        row.appendChild(params);
      }

      host.appendChild(row);
    });

    wireMixer();
  }

  function fmt(v, m) {
    var s = Number(v).toFixed(m.dec);
    return m.unit ? s + " " + m.unit : s;
  }

  function wireMixer() {
    // Volume sliders.
    document.querySelectorAll("[data-vol]").forEach(function (el) {
      el.addEventListener("input", function () {
        var layer = el.getAttribute("data-vol");
        var v = parseInt(el.value, 10) / 100;
        A.setLayerVolume(layer, v);
        var out = document.querySelector('[data-vol-val="' + layer + '"]');
        if (out) out.textContent = el.value;
      });
    });
    // Rate sliders.
    document.querySelectorAll("[data-rate]").forEach(function (el) {
      el.addEventListener("input", function () {
        var layer = el.getAttribute("data-rate");
        var v = parseFloat(el.value);
        A.setLayerRate(layer, v);
        var out = document.querySelector('[data-rate-val="' + layer + '"]');
        if (out) out.textContent = v.toFixed(2) + "×";
      });
    });
    // Mute buttons.
    document.querySelectorAll("[data-layer]").forEach(function (el) {
      el.addEventListener("click", function () {
        var layer = el.getAttribute("data-layer");
        var muted = A.toggleLayer(layer);
        el.classList.toggle("muted", muted);
        el.textContent = muted ? "OFF" : "ON";
      });
    });
    // Param sliders.
    document.querySelectorAll("[data-param]").forEach(function (el) {
      el.addEventListener("input", function () {
        var parts = el.getAttribute("data-param").split(":");
        var layer = parts[0], key = parts[1];
        var v = parseFloat(el.value);
        A.setLayerParam(layer, key, v);
        var out = document.querySelector('[data-param-val="' + layer + ":" + key + '"]');
        if (out) out.textContent = fmt(v, (PARAM_META[layer] && PARAM_META[layer][key]) || { dec: 2, unit: "" });
      });
    });
  }

  // -------------------------------------------------------------------------
  // Transport
  // -------------------------------------------------------------------------
  function wireTransport() {
    var playBtn = document.getElementById("antariksh-play");
    var stopBtn = document.getElementById("antariksh-stop");
    var vol = document.getElementById("antariksh-master-vol");
    var volVal = document.getElementById("antariksh-master-vol-val");

    if (playBtn) playBtn.addEventListener("click", function () {
      clearLog();
      A.play();
      playBtn.classList.add("is-playing");
    });
    if (stopBtn) stopBtn.addEventListener("click", function () {
      A.stop();
      if (playBtn) playBtn.classList.remove("is-playing");
    });
    if (vol) vol.addEventListener("input", function () {
      var v = parseInt(vol.value, 10);
      A.setMasterVolume(v / 100);
      if (volVal) volVal.textContent = v;
    });
  }

  // -------------------------------------------------------------------------
  // Activity log — every phrase/event the engine fires, newest at top.
  // -------------------------------------------------------------------------
  var CAT_TAG = { lead: "SITAR", bansuri: "BANSURI", santoor: "SANTOOR", ambient: "SHIP", arc: "ARC" };
  var logStart = null;
  function fmtTime(t) {
    if (logStart === null) logStart = t;
    var s = Math.max(0, Math.floor(t - logStart));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function clearLog() {
    logStart = null;
    var log = document.getElementById("antariksh-log");
    if (log) log.innerHTML = '<div class="antariksh-log-empty">Listening…</div>';
  }
  function logEvent(ev) {
    var log = document.getElementById("antariksh-log");
    if (!log) return;
    var empty = log.querySelector(".antariksh-log-empty");
    if (empty) empty.remove();
    var row = document.createElement("div");
    row.className = "antariksh-log-row";
    var tag = CAT_TAG[ev.cat] || ev.cat.toUpperCase();
    row.innerHTML =
      '<span class="antariksh-log-time">' + fmtTime(ev.t) + '</span>' +
      '<span class="antariksh-log-tag ' + ev.cat + '">' + tag + '</span>' +
      '<span class="antariksh-log-text">' + ev.label + (ev.detail ? ' · ' + ev.detail : '') + '</span>';
    log.insertBefore(row, log.firstChild);
    while (log.children.length > 120) log.removeChild(log.lastChild);
  }
  if (A.setEventListener) A.setEventListener(logEvent);

  // -------------------------------------------------------------------------
  // Development meter — reflects the long-form performance arc.
  // -------------------------------------------------------------------------
  function pollArc() {
    if (!A.getArcInfo) return;
    var info = A.getArcInfo();
    var fill = document.getElementById("antariksh-arc-fill");
    var stage = document.getElementById("antariksh-arc-stage");
    if (fill) fill.style.width = Math.round(info.level * 100) + "%";
    if (stage) {
      stage.textContent = info.register === "—"
        ? "idle"
        : info.register.toUpperCase() + " · " + info.stage;
    }
  }
  setInterval(pollArc, 300);

  // -------------------------------------------------------------------------
  renderRaga();
  renderMixer();
  wireTransport();
  pollArc();
})();

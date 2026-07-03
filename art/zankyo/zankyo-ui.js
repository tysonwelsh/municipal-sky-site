// ============================================================================
// ZANKYŌ — UI controller (machine faceplate: knobs, switches, meters, VFD log)
// Physical-control layer: rotary knobs (pointer-drag / wheel / arrow keys),
// rocker switches, arcade transport, the segmented jo-ha-kyū LED bargraph.
// All control values still route to the same ZankyoAudio API as before.
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

  // ==========================================================================
  // Rotary knob — a physical control. role="slider"; drag up/down, mouse
  // wheel, arrow keys. Pointer indicator sweeps -135°..+135°. Purely
  // transform-driven while dragging (no layout reads/writes in the handler).
  // ==========================================================================
  var knobSeq = 0;
  function makeKnob(opts) {
    // opts: min, max, step, value, label, format(v)->string, onInput(v), cls
    var min = opts.min, max = opts.max, step = opts.step || 1;
    var value = clamp(opts.value);
    var wearClass = " zk-wear-" + (knobSeq++ % 4);

    var el = document.createElement("div");
    el.className = "zk-knob " + (opts.cls || "") + wearClass;
    el.setAttribute("role", "slider");
    el.tabIndex = 0;
    el.setAttribute("aria-label", opts.label);
    el.setAttribute("aria-valuemin", String(min));
    el.setAttribute("aria-valuemax", String(max));
    el.setAttribute("aria-orientation", "vertical");
    // static cap (specular light stays put) + rotating pointer layer
    el.innerHTML = '<span class="zk-knob-cap"></span><span class="zk-knob-rot"><span class="zk-knob-ind"></span></span>';
    var rot = el.children[1];

    function clamp(v) { return Math.min(max, Math.max(min, v)); }
    function quant(v) { var q = Math.round((v - min) / step) * step + min; return clamp(parseFloat(q.toFixed(6))); }
    function angle(v) { return -135 + 270 * (v - min) / (max - min); }
    function render() {
      rot.style.transform = "rotate(" + angle(value) + "deg)";
      el.setAttribute("aria-valuenow", String(value));
      el.setAttribute("aria-valuetext", opts.format ? opts.format(value) : String(value));
    }
    function set(v, silent) {
      v = quant(v);
      if (v === value) return;
      value = v; render();
      if (!silent && opts.onInput) opts.onInput(value);
    }

    // pointer drag: vertical, 160px of travel = full sweep
    var dragging = false, dragY = 0, dragVal = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      e.preventDefault();
      dragging = true; dragY = e.clientY; dragVal = value;
      el.classList.add("is-drag");
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
      el.focus({ preventScroll: true });
    });
    el.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      set(dragVal + (dragY - e.clientY) / 160 * (max - min));
    });
    function endDrag() { dragging = false; el.classList.remove("is-drag"); }
    el.addEventListener("pointerup", endDrag);
    el.addEventListener("pointercancel", endDrag);

    el.addEventListener("wheel", function (e) {
      e.preventDefault();
      set(value + (e.deltaY < 0 ? 1 : -1) * step * 2);
    }, { passive: false });

    el.addEventListener("keydown", function (e) {
      var big = (max - min) / 10;
      switch (e.key) {
        case "ArrowUp": case "ArrowRight": set(value + step); break;
        case "ArrowDown": case "ArrowLeft": set(value - step); break;
        case "PageUp": set(value + big); break;
        case "PageDown": set(value - big); break;
        case "Home": set(min); break;
        case "End": set(max); break;
        default: return;
      }
      e.preventDefault();
    });

    render();
    el._zkSet = set;   // programmatic updates (silent option)
    return el;
  }

  // ==========================================================================
  // Pitch-management module (音程管理) — left zone: backlit mode readout;
  // center zone: the 音階 SCALE degree LED array. Each cell is a scale degree;
  // it strikes when a melodic note on that degree actually sounds. Notes are
  // emitted at schedule time with a future audio-time start, so a small ring
  // buffer holds them until getAudioTime() catches up (no per-note timers).
  // ==========================================================================
  var TONIC_HZ = 146.83;                       // D3 — mirrors the engine tonic
  var MODE_OFFSETS = {                         // semitone offsets, per mode key
    hirajoshi: [0, 2, 3, 7, 8],
    insen:     [0, 1, 5, 7, 8],
    kumoi:     [0, 2, 3, 7, 9],
    iwato:     [0, 1, 5, 6, 10],
  };
  var MELODIC = { shakuhachi: true, koto: true, shamisen: true, sho: true };
  var curOffsets = MODE_OFFSETS.hirajoshi;
  var degEls = null;                           // live HTMLCollection of .zk-deg cells
  var litUntil = [0, 0, 0, 0, 0];
  var PEND = 96;                               // pending-note ring (preallocated)
  var pendDeg = new Uint8Array(PEND), pendAt = new Float64Array(PEND);
  var pendHead = 0, pendCount = 0;

  function nearestDegree(freq) {               // log2-nearest against the mode's pitch classes
    var st = 12 * (Math.log(freq / TONIC_HZ) / Math.LN2);
    st = ((st % 12) + 12) % 12;
    var best = 0, bd = 99;
    for (var i = 0; i < curOffsets.length; i++) {
      var d = Math.abs(st - curOffsets[i]);
      if (d > 6) d = 12 - d;                   // octave wraparound
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }
  function onDegNote(n) {
    try {
      if (!n || !MELODIC[n.layer]) return;
      var f = +n.freq;
      if (!(f > 0) || pendCount >= PEND) return;   // buffer full: drop, never grow
      var slot = (pendHead + pendCount) % PEND;
      pendDeg[slot] = nearestDegree(f);
      pendAt[slot] = +n.startTime || 0;
      pendCount++;
    } catch (e) {}
  }
  if (Z.setNoteListener) Z.setNoteListener(onDegNote);
  setInterval(function () {                    // ~16 Hz sweep: strike + decay
    try {
      if (!degEls) return;
      var at = Z.getAudioTime ? Z.getAudioTime() : 0, now = Date.now();
      var keep = 0;                            // layers interleave, so scan all pending
      for (var k = 0; k < pendCount; k++) {
        var s = (pendHead + k) % PEND;
        if (pendAt[s] <= at + 0.03) {
          var d = pendDeg[s];
          if (d < 5 && degEls[d]) { litUntil[d] = now + 340; degEls[d].classList.add("is-lit"); }
        } else {
          var t = (pendHead + keep) % PEND;
          pendDeg[t] = pendDeg[s]; pendAt[t] = pendAt[s]; keep++;
        }
      }
      pendCount = keep;
      for (var i = 0; i < 5; i++) {
        if (litUntil[i] && litUntil[i] <= now) { litUntil[i] = 0; if (degEls[i]) degEls[i].classList.remove("is-lit"); }
      }
    } catch (e) {}
  }, 60);

  // ---- Mode readout + LED cell kana (re-rendered on live modal modulation) ----
  function renderScale() {
    var s = Z.SCALE_INFO;
    var name = document.getElementById("zankyo-mode-name");
    var mood = document.getElementById("zankyo-mode-mood");
    if (name) name.innerHTML = '<b>' + s.name + '</b> · ' + s.tonic;
    if (mood) mood.textContent = s.mood;
    var row = document.getElementById("zankyo-degrees");
    if (row) {
      row.innerHTML = s.kana.map(function (k, i) { return '<span class="zk-deg" data-deg="' + i + '">' + k + '</span>'; }).join("");
      degEls = row.children;
      for (var i = 0; i < litUntil.length; i++) litUntil[i] = 0;
    }
    if (Z.getMode) { var m = Z.getMode(); curOffsets = MODE_OFFSETS[m.key] || MODE_OFFSETS.hirajoshi; }
  }

  // ==========================================================================
  // Mixer console — one machined strip per layer: name plate, sample button,
  // rocker switch (mute), VOL knob, RATE knob, and a service hatch (整備口)
  // holding the fine trim faders.
  // ==========================================================================
  function renderMixer() {
    var host = document.getElementById("zankyo-layers"); if (!host) return;
    var state = Z.getState(); host.innerHTML = "";
    Z.LAYERS.forEach(function (layer, li) {
      var meta = LAYER_META[layer] || { label: layer, kana: "" };
      var defaults = Z.LAYER_PARAM_DEFAULTS[layer] || {};
      var vol = state.layerVolumes[layer] != null ? state.layerVolumes[layer] : Z.DEFAULT_LAYER_VOL;
      var muted = !!(state.layerMuted && state.layerMuted[layer]);
      var row = document.createElement("div"); row.className = "zankyo-layer";

      var head = document.createElement("div"); head.className = "zankyo-layer-head";

      // name plate — doubles as the expander for the row's control cavity
      var name = document.createElement("button");
      name.type = "button"; name.className = "zankyo-layer-name";
      name.setAttribute("aria-expanded", "false");
      name.setAttribute("aria-label", meta.label + " controls");
      name.innerHTML = '<span class="zankyo-layer-kana">' + meta.kana + '</span>' +
        '<span class="zk-name-label">' + meta.label + '</span>' +
        '<i class="zk-ch">CH·0' + (li + 1) + '</i><span class="zk-name-latch" aria-hidden="true"></span>';
      name.addEventListener("click", function () {
        var open = row.classList.toggle("is-open");
        name.setAttribute("aria-expanded", open ? "true" : "false");
      });
      head.appendChild(name);

      // sample: momentary round button
      var sample = document.createElement("button");
      sample.type = "button"; sample.className = "zankyo-layer-sample";
      sample.setAttribute("data-sample", layer);
      sample.title = "sample this instrument";
      sample.setAttribute("aria-label", "Sample " + meta.label);
      sample.innerHTML = '<span class="tri"></span>';
      sample.addEventListener("click", function () {
        if (Z.sample) Z.sample(layer);
        sample.classList.add("is-hit");
        setTimeout(function () { sample.classList.remove("is-hit"); }, 320);
      });
      head.appendChild(sample);

      // mute: rocker switch
      var sw = document.createElement("button");
      sw.type = "button"; sw.className = "zk-switch zankyo-layer-mute" + (muted ? " muted" : "");
      sw.setAttribute("data-layer", layer);
      sw.setAttribute("aria-pressed", muted ? "false" : "true");
      sw.setAttribute("aria-label", meta.label + " on/off");
      sw.innerHTML = '<i class="zk-switch-on">ON</i><span class="zk-switch-slot"><span class="zk-switch-lever"></span></span><i class="zk-switch-off">OFF</i>';
      sw.addEventListener("click", function () {
        var m = Z.toggleLayer(layer);
        sw.classList.toggle("muted", m);
        sw.setAttribute("aria-pressed", m ? "false" : "true");
      });
      head.appendChild(sw);
      row.appendChild(head);

      // the control cavity — VOL/RATE knobs + fine trims, revealed by the name plate
      var cav = document.createElement("div"); cav.className = "zk-cavity";
      var knobRow = document.createElement("div"); knobRow.className = "zk-cavity-knobs";

      // VOL knob
      var volUnit = document.createElement("span"); volUnit.className = "zk-unit zk-unit-vol";
      var volOut = document.createElement("span"); volOut.className = "zankyo-val-readout";
      volOut.setAttribute("data-vol-val", layer); volOut.textContent = pct(vol);
      volUnit.appendChild(makeKnob({
        min: 0, max: 100, step: 1, value: pct(vol),
        label: meta.label + " volume", cls: "zk-knob-vol",
        format: function (v) { return v + " %"; },
        onInput: function (v) { Z.setLayerVolume(layer, v / 100); volOut.textContent = v; },
      }));
      var volLbl = document.createElement("span"); volLbl.className = "zk-unit-meta";
      volLbl.innerHTML = '<span class="zankyo-vol-label">VOL</span>';
      volLbl.appendChild(volOut);
      volUnit.appendChild(volLbl);
      knobRow.appendChild(volUnit);

      // RATE knob (thumb-sized)
      if (RATE_LAYERS[layer]) {
        var rv = state.layerRate[layer] != null ? state.layerRate[layer] : 1;
        var rateUnit = document.createElement("span"); rateUnit.className = "zk-unit zk-unit-rate";
        var rateOut = document.createElement("span"); rateOut.className = "zankyo-val-readout";
        rateOut.setAttribute("data-rate-val", layer); rateOut.textContent = rv.toFixed(2) + "×";
        rateUnit.appendChild(makeKnob({
          min: 0.25, max: 3, step: 0.05, value: rv,
          label: meta.label + " rate", cls: "zk-knob-rate",
          format: function (v) { return v.toFixed(2) + "×"; },
          onInput: function (v) { Z.setLayerRate(layer, v); rateOut.textContent = v.toFixed(2) + "×"; },
        }));
        var rateLbl = document.createElement("span"); rateLbl.className = "zk-unit-meta";
        rateLbl.innerHTML = '<span class="zankyo-vol-label">RATE</span>';
        rateLbl.appendChild(rateOut);
        rateUnit.appendChild(rateLbl);
        knobRow.appendChild(rateUnit);
      }
      cav.appendChild(knobRow);

      // fine trims
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
        cav.appendChild(params);
      }
      row.appendChild(cav);
      host.appendChild(row);
    });
    wireParams();
  }
  function wireParams() {
    document.querySelectorAll("[data-param]").forEach(function (el) {
      el.addEventListener("input", function () {
        var p = el.getAttribute("data-param").split(":"), layer = p[0], key = p[1], v = parseFloat(el.value);
        Z.setLayerParam(layer, key, v);
        var o = document.querySelector('[data-param-val="' + layer + ':' + key + '"]');
        if (o) o.textContent = fmt(v, (PARAM_META[layer] && PARAM_META[layer][key]) || [0, 1, 0.01, 2, ""]);
      });
    });
  }

  // ---- Activity log (VFD display; content logic unchanged) ----
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

  // ==========================================================================
  // 段階 DEVELOPMENT — segmented LED bargraph (full width, below the CRT).
  // Lit fill = arc level. The engine's phase cuts (arc position 0.45 and 0.82)
  // land on the level curve at 0.25 and 0.80, so the zone splits sit at cells
  // 14 and 45 of 56: jo cyan, ha amber, kyū red. Peak-hold segment holds ~2 s
  // then falls; the KIRU kills the whole bar for the hush (event-driven) and
  // it relights with the new jo. Segment nodes are preallocated once and the
  // 280 ms poll only touches classLists of cells that changed.
  // ==========================================================================
  var BAR_N = 56, BAR_JO = 14, BAR_HA = 45;      // zone splits: levels 0.25 / 0.80
  var barEl = document.getElementById("zankyo-bargraph");
  var barSegs = [];
  (function buildBar() {
    var host = document.getElementById("zankyo-bar-cells"); if (!host) return;
    var frag = document.createDocumentFragment();
    for (var i = 0; i < BAR_N; i++) {
      var s = document.createElement("span");
      s.className = "zk-seg " + (i < BAR_JO ? "zk-seg-jo" : i < BAR_HA ? "zk-seg-ha" : "zk-seg-kyu");
      frag.appendChild(s); barSegs.push(s);
    }
    host.appendChild(frag);
  })();
  var barLit = 0, barHead = -1, barPeak = -1, barPeakAt = 0, barPeakShown = -1, barDead = false;
  function showPeak(i) {                         // move the held-peak marker (one cell, classList only)
    if (i === barPeakShown) return;
    if (barPeakShown >= 0) barSegs[barPeakShown].classList.remove("is-peak");
    barPeakShown = i;
    if (i >= 0) barSegs[i].classList.add("is-peak");
  }
  function setBar(level, now) {
    var lit = barDead ? 0 : Math.max(0, Math.min(BAR_N, Math.round(level * BAR_N)));
    var i;
    if (lit !== barLit) {
      if (lit > barLit) { for (i = barLit; i < lit; i++) barSegs[i].classList.add("on"); }
      else { for (i = lit; i < barLit; i++) barSegs[i].classList.remove("on"); }
      barLit = lit;
    }
    var head = lit - 1;                          // the blooming head segment
    if (head !== barHead) {
      if (barHead >= 0) barSegs[barHead].classList.remove("is-head");
      if (head >= 0) barSegs[head].classList.add("is-head");
      barHead = head;
    }
    // peak hold: rides up with the head, lingers ~2 s, then steps back down
    if (barDead || head < 0) { barPeak = -1; showPeak(-1); return; }
    if (head >= barPeak) { barPeak = head; barPeakAt = now; }
    else if (now - barPeakAt > 2000) barPeak = Math.max(head, barPeak - 2);
    showPeak(barPeak > head ? barPeak : -1);
  }
  if (Z.setEventListener) Z.setEventListener(function (ev) {   // the 斬 KIRU — the bar dies for the hush
    if (barEl && ev && ev.label && ev.label.indexOf("KIRU") !== -1) { barDead = true; barEl.classList.add("is-dead"); }
  });

  // ---- the 280 ms arc poll (drives bargraph, kyū shake, mode re-render) ----
  var sceneEl = document.querySelector(".zankyo-scene");
  var lastMode = null;
  function pollArc() {
    if (!Z.getArcInfo) return; var info = Z.getArcInfo();
    if (barDead && (info.phase === "jo" || info.phase === "—")) {   // the hush ends: relight with the new jo
      barDead = false;
      if (barEl) barEl.classList.remove("is-dead");
    }
    if (barSegs.length) setBar(info.level, Date.now());
    if (sceneEl) sceneEl.classList.toggle("is-kyu", info.phase === "kyū");   // climax destabilization
    if (Z.getMode) { var m = Z.getMode(); if (m.name !== lastMode) { lastMode = m.name; renderScale(); } }   // live modal modulation
    // transport state can change outside the buttons (lock-screen pause via
    // the media session) — keep the arcade button and power LED honest
    if (Z.getState) {
      var on = !!Z.getState().playing;
      var pb = document.getElementById("zankyo-play");
      if (pb) pb.classList.toggle("is-playing", on);
      if (sceneEl) sceneEl.classList.toggle("is-on", on);
    }
  }
  setInterval(pollArc, 280);

  // ---- Transport (arcade buttons + master volume knob) ----
  function wireTransport() {
    var playBtn = document.getElementById("zankyo-play"), stopBtn = document.getElementById("zankyo-stop");
    if (playBtn) playBtn.addEventListener("click", function () {
      clearLog(); Z.play();
      playBtn.classList.add("is-playing");
      if (sceneEl) sceneEl.classList.add("is-on");   // power LED
    });
    if (stopBtn) stopBtn.addEventListener("click", function () {
      Z.stop();
      if (playBtn) playBtn.classList.remove("is-playing");
      if (sceneEl) sceneEl.classList.remove("is-on");
    });

    var mount = document.getElementById("zankyo-master-knob");
    var volVal = document.getElementById("zankyo-master-vol-val");
    if (mount) {
      var initial = 60;
      var st = Z.getState && Z.getState();
      if (st && st.masterVolume != null) initial = pct(st.masterVolume);
      if (volVal) volVal.textContent = initial;
      mount.appendChild(makeKnob({
        min: 0, max: 100, step: 1, value: initial,
        label: "Master volume", cls: "zk-knob-master",
        format: function (v) { return v + " %"; },
        onInput: function (v) { Z.setMasterVolume(v / 100); if (volVal) volVal.textContent = v; },
      }));
    }
  }

  renderScale(); renderMixer(); wireTransport(); pollArc();
})();

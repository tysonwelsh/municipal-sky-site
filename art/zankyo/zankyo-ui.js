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

  var RATE_LAYERS = { shakuhachi: true, hichiriki: true, koto: true, shamisen: true, biwa: true, taiko: true, noise: true, ambient: true, furin: true, pa: true, vox: true };
  var LAYER_META = {
    subDrone:   { label: "Sub-drone", kana: "重低音" },
    sho:        { label: "Shō",        kana: "笙" },
    shakuhachi: { label: "Shakuhachi", kana: "尺八" },
    hichiriki:  { label: "Hichiriki",  kana: "篳篥" },
    koto:       { label: "Koto",       kana: "箏" },
    shamisen:   { label: "Shamisen",   kana: "三味線" },
    biwa:       { label: "Biwa",       kana: "琵琶" },
    taiko:      { label: "Taiko",      kana: "太鼓" },
    noise:      { label: "Noise",      kana: "雑音" },
    ambient:    { label: "Ambient",    kana: "環境" },
    furin:      { label: "Fūrin",      kana: "風鈴" },   // the chime as a voice (2026-09-13)
    pa:         { label: "PA",         kana: "放送" },
    vox:        { label: "Intercom",   kana: "内線" },   // the comms vox as a voice (2026-09-14)
    broadcast:  { label: "Broadcast",  kana: "受信" },   // S1: the receiver — an ordinary console row (owner §4.6)
  };
  var PARAM_META = {
    subDrone:   { cutoff: [80, 500, 5, 0, "Hz"], drive: [0, 1, 0.05, 2, ""], sub: [0, 1, 0.05, 2, ""], movement: [0, 0.5, 0.02, 2, ""] },
    sho:        { cutoff: [400, 3000, 20, 0, "Hz"], voices: [3, 7, 1, 0, ""], shimmer: [0, 1, 0.05, 2, ""], drift: [0, 1, 0.05, 2, ""] },
    shakuhachi: { breath: [0, 1, 0.05, 2, ""], muraiki: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"], glide: [0, 1, 0.05, 2, ""], ornament: [0, 1, 0.05, 2, ""] },
    hichiriki:  { reed: [0, 1, 0.05, 2, ""], enbai: [0, 1, 0.05, 2, ""], breath: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"] },
    koto:       { brightness: [2, 16, 0.5, 1, ""], pace: [0.5, 2, 0.05, 2, "×"], gliss: [0, 1, 0.05, 2, ""], sustain: [0.3, 2, 0.05, 2, ""], pluck: [0, 1, 0.05, 2, ""] },
    shamisen:   { sawari: [0, 1, 0.05, 2, ""], drive: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"], attack: [0, 1, 0.05, 2, ""] },
    biwa:       { sawari: [0, 1, 0.05, 2, ""], tremolo: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"] },
    taiko:      { punch: [0, 1, 0.05, 2, ""], drive: [0, 1, 0.05, 2, ""], lowTune: [0.5, 2, 0.05, 2, "×"], kakegoe: [0, 1, 0.05, 2, ""] },
    noise:      { density: [0, 1, 0.05, 2, ""], color: [0, 1, 0.05, 2, ""], crush: [0, 1, 0.05, 2, ""] },
    ambient:    {},
    furin:      { wind: [0, 1, 0.05, 2, ""], tubes: [3, 7, 1, 0, ""], shimmer: [0, 1, 0.05, 2, ""], decay: [0.3, 2, 0.05, 2, "×"] },
    pa:         { presence: [0, 1, 0.05, 2, ""], static: [0, 1, 0.05, 2, ""] },
    vox:        { band: [0, 1, 0.05, 2, ""], stutter: [0, 1, 0.05, 2, ""], survive: [0, 1, 0.05, 2, ""], pace: [0.5, 2, 0.05, 2, "×"] },
    broadcast:  { band: [0, 1, 0.05, 2, ""], flutter: [0, 1, 0.05, 2, ""], grit: [0, 1, 0.05, 2, ""] },
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
  var TONIC_HZ = 146.83;                       // D3 — the opening tonic; the engine's field moves it (sea changes) and renderScale() follows
  var MODE_OFFSETS = {                         // semitone offsets, per mode key
    hirajoshi: [0, 2, 3, 7, 8],
    insen:     [0, 1, 5, 7, 8],
    kumoi:     [0, 2, 3, 7, 9],
    iwato:     [0, 1, 5, 6, 10],
  };
  var MELODIC = { shakuhachi: true, koto: true, shamisen: true, sho: true, hichiriki: true, biwa: true };
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

  // ---- the night's seed, under the mood line (owner, 2026-09-24). It can
  // change without a reload — 逸脱 re-seeds the station — so the poll below
  // re-reads it as well as the mode.
  var lastSeed = null;
  function renderSeed() {
    var el = document.getElementById("zankyo-seed");
    if (!el || !Z.getSeed) return;
    var sd = Z.getSeed();
    if (sd === lastSeed) return;
    lastSeed = sd; el.textContent = "seed " + sd;
  }

  // ---- Mode readout + LED cell kana (re-rendered on live modal modulation) ----
  function renderScale() {
    var s = Z.SCALE_INFO;
    var name = document.getElementById("zankyo-mode-name");
    var mood = document.getElementById("zankyo-mode-mood");
    // The tonic goes in its own monospace span. Orbitron's capital D is a
    // square with a rectangular counter and at 13px it is indistinguishable
    // from a .notdef box — the owner reported it as a missing glyph, and the
    // home default tonic IS D3, so every night showed it. The letter was never
    // missing; the face simply cannot carry a single letter unambiguously.
    //
    // NO CENTS OFFSET, and that is a measured decision rather than a shortcut.
    // The suggested fallback ("D −23¢") assumes a far tonic can sit between
    // named notes. It cannot: every tonic comes from an equal-tempered start
    // and moves only by whole semitones — foldTonic, the semitone sink, the sea
    // change and the pivots all preserve that — so the deviation is exactly 0.
    // Measured over 2 h on seeds 34 (far 0.9 and 0.0), 16 and 1 (far 0.95) and
    // 3042 at home: tonicC was 0 in every case. Shipping the offset would have
    // added a branch that cannot fire. 撓 stretches the octave and 螺 spirals
    // the field, but they move the intervals ABOVE the tonic, not the tonic.
    // The flat is written ASCII in the readout as well. It is NOT the reported
    // box — that is the D — but Orbitron has no U+266D either, so a flat tonic
    // reaches whatever the fallback supplies. On the critic's machine the
    // fallback has it and it renders; on the owner's it may not, and neither of
    // us can test the other's. "Eb" removes a character neither face owns.
    // The log keeps SCALE_INFO.tonic with the real ♭; this is display only.
    if (name) name.innerHTML = '<b>' + s.name + '</b> · <span class="zk-tonic">' +
      String(s.tonic).replace(/\u266d/g, "b") + '</span>';
    if (mood) mood.textContent = s.mood;
    renderSeed();
    var row = document.getElementById("zankyo-degrees");
    if (row) {
      row.innerHTML = s.kana.map(function (k, i) { return '<span class="zk-deg" data-deg="' + i + '">' + k + '</span>'; }).join("");
      degEls = row.children;
      for (var i = 0; i < litUntil.length; i++) litUntil[i] = 0;
    }
    if (Z.getMode) { var m = Z.getMode(); curOffsets = MODE_OFFSETS[m.key] || MODE_OFFSETS.hirajoshi; if (m.tonicHz > 0) TONIC_HZ = m.tonicHz; }
  }

  // ==========================================================================
  // Mixer console — one machined strip per layer: name plate, sample button,
  // rocker switch (mute), VOL knob, RATE knob, and a service hatch (整備口)
  // holding the fine trim faders.
  // ==========================================================================
  // The console folds to its title strip (owner, 2026-09-14) — the whole
  // console, over and above the rows' own cavities. Remembered per browser;
  // the rows are untouched, so unfolding shows them as they were.
  function wireMixerToggle() {
    var box = document.getElementById("zankyo-mixer"), btn = document.getElementById("zankyo-mixer-toggle");
    if (!box || !btn) return;
    var KEY = "zankyo.console.folded";
    function set(folded, remember) {
      box.classList.toggle("is-collapsed", folded);
      btn.setAttribute("aria-expanded", folded ? "false" : "true");
      if (remember) { try { localStorage.setItem(KEY, folded ? "1" : "0"); } catch (e) {} }
    }
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (saved === "1") set(true, false);
    btn.addEventListener("click", function () { set(!box.classList.contains("is-collapsed"), true); });
    btn.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); set(!box.classList.contains("is-collapsed"), true); }
    });
  }
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
        '<i class="zk-ch">CH·' + (li + 1 < 10 ? "0" : "") + (li + 1) + '</i><span class="zk-name-latch" aria-hidden="true"></span>';   // two digits: CH·01 … CH·13, not CH·013
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

      // mute: a flat console rocker — wordless. The thumb slides across a
      // two-colour well: thrown right it uncovers the green lamp (layer on),
      // thrown left it uncovers the red one (muted). Colour, not a legend.
      var sw = document.createElement("button");
      sw.type = "button"; sw.className = "zk-switch zankyo-layer-mute" + (muted ? " muted" : "");
      sw.setAttribute("data-layer", layer);
      sw.setAttribute("role", "switch");
      sw.setAttribute("aria-checked", muted ? "false" : "true");
      sw.setAttribute("aria-label", meta.label + " on/off");
      sw.innerHTML = '<span class="zk-switch-well" aria-hidden="true">' +
        '<i class="zk-switch-lamp zk-lamp-on"></i>' +
        '<i class="zk-switch-lamp zk-lamp-off"></i>' +
        '<span class="zk-switch-thumb"></span></span>';
      row.classList.toggle("is-muted", muted);
      sw.addEventListener("click", function () {
        var m = Z.toggleLayer(layer);
        sw.classList.toggle("muted", m);
        sw.setAttribute("aria-checked", m ? "false" : "true");
        row.classList.toggle("is-muted", m);
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
  var CAT_TAG = { far: "逸脱 ITSU", shakuhachi: "尺八 SHAKU", koto: "箏 KOTO", shamisen: "三味線 SHAMI", taiko: "太鼓 TAIKO", noise: "雑音 NOISE", ambient: "環境 AMB", furin: "風鈴 FŪRIN", vox: "内線 VOX", mode: "旋法 MODE", form: "序破急 FORM", sho: "笙 SHŌ", hichiriki: "篳篥 HICHI", biwa: "琵琶 BIWA", pa: "放送 PA", rx: "受信 RX", broadcast: "受信 RX" };
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
    // attribution (S2): a signal's source, opened in a new tab — never playback here
    if (ev.link && /^https?:\/\//.test(String(ev.link))) {
      var a = document.createElement("a"); a.className = "zk-log-src"; a.href = String(ev.link); a.target = "_blank"; a.rel = "noopener noreferrer";
      a.title = "the source of this signal"; a.setAttribute("aria-label", "open the source of this signal"); a.textContent = "\u25B6";
      row.appendChild(a);
    }
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
  function setBar(level, now, alive) {
    var lit = barDead ? 0 : Math.max(0, Math.min(BAR_N, Math.round(level * BAR_N)));
    // While playing (and not in the KIRU hush), never fully dark: hold at least
    // one lit segment so the machine reads as ALIVE through the slow jo opening,
    // where the arc level rounds to zero for the first ~40 s. Restores the old
    // "never fully empty while playing" floor lost when the dev bar was rebuilt.
    if (alive && !barDead && lit < 1) lit = 1;
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
    if (barSegs.length) setBar(info.level, Date.now(), info.phase !== "—");
    if (sceneEl) sceneEl.classList.toggle("is-kyu", info.phase === "kyū");   // climax destabilization
    if (Z.getMode) { var m = Z.getMode(); var mk = m.name + "@" + (m.tonic || ""); if (mk !== lastMode) { lastMode = mk; renderScale(); } }   // live modal modulation + sea changes
    renderSeed();                                                  // 逸脱 re-seeds without a reload
    // transport state can change outside the keys (lock-screen pause via the
    // media session) — keep the PLAY key's latch and the power LED honest
    if (Z.getState) {
      var on = !!Z.getState().playing;
      var pb = document.getElementById("zankyo-play");
      if (pb) { pb.classList.toggle("is-down", on); pb.setAttribute("aria-pressed", on ? "true" : "false"); }
      if (sceneEl) sceneEl.classList.toggle("is-on", on);
    }
  }
  setInterval(pollArc, 280);

  // ==========================================================================
  // 逸脱 THE HIDDEN SWITCH (plan §5)
  // ==========================================================================
  // Thrown, the station restarts on a far night: the engine hunts upward from
  // the current seed for the first one whose far fork yields d ≥ 0.8 (a pure
  // function of the seed — about 29 hashes, no audio), the address bar is
  // rewritten so that night can be sent to somebody, and it plays. While the
  // switch is on, PLAY goes the same way.
  //
  // AND IT MUST TURN OFF AGAIN — the second half of the owner's sentence, and
  // the thing round 0 got wrong. A hunt leaves the engine and the address on a
  // far seed; without undoing that, every later restart (and every reload, the
  // URL now carrying it) replayed a far night and the switch could not be
  // switched off. So the first hunt REMEMBERS what the page had — the seed the
  // engine held, and whether the address carried ?seed= at all — and OFF
  // restores it in two moves, because the two halves have different costs:
  //
  //   the ADDRESS goes back at once. It is DOM, it costs nothing, and it is
  //   what closes the reload hole: a reload after OFF is an ordinary night.
  //   The far link the owner copied while the switch was thrown still works —
  //   it is a seed, and seeds are forever.
  //
  //   the SEED goes back at the next PLAY, not now. Z.reseed() re-forks every
  //   stream, so calling it mid-performance would re-roll the music under the
  //   night that is still playing. The plan says the running night is left
  //   alone, so the restore waits for the moment the engine re-forks anyway.
  //
  // Where the page arrived with no ?seed=, "restore" means what a cold load
  // means: drop `seed` from the address and draw a fresh one off the clock.
  //
  // No persistence, deliberately: the rewritten ?seed= IS the memory, and it
  // is the one thing the owner can share. A stored flag would fight it — a
  // reload would hunt again and throw the shared night away.
  var FAR_MIN_D = 0.8;
  var farArmed = false;
  var farPre = null;        // what the page had before the first hunt: { seedParam }
  var farRestore = false;   // one-shot: the next PLAY while disarmed goes home

  function farSetSeedParam(v) {                // v = a seed string, or null to drop it
    try {
      var u = new URL(window.location.href);
      if (v == null) u.searchParams.delete("seed"); else u.searchParams.set("seed", String(v));
      u.searchParams.delete("far");            // an explicit ?far= would override whatever we just chose
      window.history.replaceState(null, "", u.toString());
    } catch (e) {}
  }
  function farHunt() {
    if (!Z.far || !Z.far.seek) return false;
    var s = Z.far.seek(FAR_MIN_D);
    if (s == null) return false;
    if (!farPre) {                             // remember the ordinary world, once per arming
      var had = null;
      try { had = new URL(window.location.href).searchParams.get("seed"); } catch (e) {}
      farPre = { seedParam: had };
    }
    Z.reseed(s);
    if (Z.setFar) Z.setFar(null);
    farSetSeedParam(s);
    return true;
  }
  function farGoHome() {                       // the one-shot, consumed at PLAY
    farRestore = false;
    var pre = farPre; farPre = null;
    if (!pre) return;
    if (pre.seedParam != null) Z.reseed(parseInt(pre.seedParam, 10) >>> 0);
    else Z.reseed((Date.now() % 0xffffffff) >>> 0);   // a cold load's own draw
  }
  // THE TUBE STOPS BEING A TITLE CARD WHENEVER THE STATION STARTS, by whichever
  // control started it. This lived inline in the play button's handler and the
  // hidden switch — which also starts the station — never called it. The
  // overlay is position:absolute, inset:0, z-index:2 over an opaque background,
  // so a listener who threw the switch WITHOUT pressing play first got a far
  // night playing correctly underneath a panel that hid the scope completely.
  // Measured on rc.23: boot still present, viz 100 % covered, station playing
  // 崩 the collapse. Owner-reported.
  //
  // One function, called by both, because "two controls that must do the same
  // thing" maintained in two places is the fault this crew has spent the week
  // finding in five other forms.
  function clearBoot() {
    var boot = document.getElementById("zankyo-boot");
    if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
  }

  function wireFarSwitch() {
    var sw = document.getElementById("zankyo-far-sw");
    if (!sw) return;
    sw.addEventListener("click", function () {
      farArmed = !farArmed;
      sw.setAttribute("aria-checked", farArmed ? "true" : "false");
      if (!farArmed) {                         // off: the running night finishes; the world goes back
        if (farPre) { farRestore = true; farSetSeedParam(farPre.seedParam); }
        return;
      }
      var playBtn = document.getElementById("zankyo-play");
      clearBoot();                             // the switch starts the station too
      Z.stop(); cutPicture();
      farHunt();
      clearLog(); Z.play();
      if (playBtn) { playBtn.classList.add("is-down"); playBtn.setAttribute("aria-pressed", "true"); }
      if (sceneEl) sceneEl.classList.add("is-on");
    });
  }
  // ==========================================================================
  // 受信 THE PUSH BUTTON — back on the ledge, rc.77
  // ==========================================================================
  // The owner: "let's add a button that when pressed plays a clip … have it
  // play a clip 100% when pushed right when pushed." So this is not §8.2's
  // rate-limited dial any more. There is NO cooldown, NO lottery gate and NO
  // probability: one press, one clip, every time.
  //
  //   1. a stopped set cannot answer, so the press STARTS the station first
  //      — the same start PLAY performs, not a subset of it;
  //   2. then the deliberate press, force = true. zk-broadcast.js seats a real
  //      broadcast through the production path — the same choose(), narrowed
  //      by the number on the station to its left, the same footprint check,
  //      the same whole-window hold — and where this scene cannot host one
  //      (a reel already armed, the kyū's wall, no room before the scene
  //      turns) it auditions a full window instead. Either way a reel sounds.
  //
  // The lens is the only thing the plastic says, and it says one thing: a
  // reception is on the air. It follows the TUBE's phase rather than the
  // receiver's `live` flag, because an audition is on the air as far as the
  // ear and the picture are concerned even though nothing was seated.
  // No print, no tooltip, no line in the 活動 log.
  function wirePush() {
    var b = document.getElementById("zankyo-push");
    if (!b || !Z.dial) return;
    b.addEventListener("click", function () {
      if (!isPlaying()) startStation();
      var got = "snow";
      try { got = Z.dial(1, true, true); } catch (e) {}
      // the click and the flicker happen whatever the answer — a dead press is
      // still a press, and a button that does nothing at all feels broken
      try { if (window.ZankyoSet && ZankyoSet.sweep) ZankyoSet.sweep(got === "snow" ? 0.45 : 1); } catch (e2) {}
      b.classList.add("is-down");
      setTimeout(function () { b.classList.remove("is-down"); }, 90);
      paintLens();
    });
    function onAir() {
      try {
        var st = window.ZankyoSet && ZankyoSet.getState && ZankyoSet.getState();
        if (st && st.phase && st.phase !== "idle") return true;
      } catch (e) {}
      try {
        var bs = window.ZankyoBroadcast && ZankyoBroadcast.getState && ZankyoBroadcast.getState();
        if (bs && bs.live) return true;
      } catch (e2) {}
      return false;
    }
    function paintLens() { b.classList.toggle("is-on", onAir()); }
    paintLens();
    setInterval(paintLens, 250);                 // the lamp follows the air
  }

  // ==========================================================================
  // 操作段 THE CONTROL LEDGE — the hand on the rockers
  // ==========================================================================
  // One moulded see-saw plate, two ends, and an invisible 44 px box over each
  // end; the painted cap is 36 px and never moves, so the ledge stays a shallow
  // band and a thumb still gets a thumb's worth of target. Pointer and
  // keyboard. The plate tilts even at the end of travel, because a control that
  // gives nothing back feels broken.
  function wireRocker(id, apply, get, max) {
    var host = document.getElementById(id);
    if (!host) return;
    var ends = [].slice.call(host.querySelectorAll(".zk-hit"));
    var tilt = 0;
    function fire(d) {
      var v = get() + d;
      host.classList.remove("tilt-l", "tilt-r");
      host.classList.add(d < 0 ? "tilt-l" : "tilt-r");
      clearTimeout(tilt);
      tilt = setTimeout(function () { host.classList.remove("tilt-l", "tilt-r"); }, 140);
      if (v < 0 || v > max) return;          // the end of travel: the plate moves, nothing else does
      apply(v);
    }
    ends.forEach(function (b) {
      var d = parseInt(b.getAttribute("data-d"), 10) < 0 ? -1 : 1;
      b.addEventListener("click", function () { fire(d); });
      b.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { fire(-1); e.preventDefault(); }
        else if (e.key === "ArrowRight" || e.key === "ArrowUp") { fire(1); e.preventDefault(); }
      });
    });
  }

  function wireLedge() {
    // 輝度 — NOT ON THE PANEL since rc.77: the owner took the left station for
    // the number and the middle one for the 受信 button. The implementation is
    // untouched — zk-set.js still owns setBright()/getBright() and the tube
    // still runs at its default step — and this call still stands, because the
    // owner said he will pick a variable for these stations later and a control
    // that is only missing its plastic should not also be missing its hand.
    // wireRocker no-ops on a null host.
    wireRocker("zankyo-rock-bri",
      function (v) { try { if (window.ZankyoSet && ZankyoSet.setBright) ZankyoSet.setBright(v); } catch (e) {} },
      function () { try { return (window.ZankyoSet && ZankyoSet.getBright) ? ZankyoSet.getBright() : 0; } catch (e) { return 0; } },
      3);

    // THE LEFT STATION. It steps a number, 00 to 10, and NOTHING is said
    // about it — no label on the panel, no legend, no tooltip, and no line in
    // the 活動 log. The two digits are the only feedback there is, which is the
    // owner's whole ask for this control. The lottery reads the number in
    // zk-broadcast.js; if broadcast/geo.json never loads it reads it and means
    // nothing, silently.
    var read = document.getElementById("zankyo-loc-read");
    var sr = document.getElementById("zankyo-loc-sr");
    var BC = window.ZankyoBroadcast;
    var locMax = (BC && BC.localeMax) || 10;
    var locN = 0;
    function paintLoc() {
      var two = (locN < 10 ? "0" : "") + locN;
      if (read) read.textContent = two;
      if (sr) sr.textContent = two;
    }
    wireRocker("zankyo-rock-loc",
      function (v) { locN = v; try { if (BC && BC.setLocale) BC.setLocale(v); } catch (e) {} paintLoc(); },
      function () { return locN; },
      locMax);
    paintLoc();
  }

  // ---- Transport (arcade buttons + master volume knob) ----
  // THE START, in one place. PLAY is not the only thing that starts the
  // station any more — the ledge's 受信 button starts it too, because a press
  // on a stopped set has to make a sound and not a silent picture — and both
  // must leave the page in the same state: the boot card gone, the log cleared,
  // 逸脱 honoured, the arcade cap lit and the power LED on.
  // (QF, 2026-09-25) every Z.stop() is followed by this: the receiver
  // silences a reception mid-air, and the tube has to lose it too (zk-set.js cut())
  function cutPicture() { try { if (window.ZankyoSet && ZankyoSet.cut) ZankyoSet.cut(); } catch (e) {} }
  function isPlaying() {
    try { var st = Z.getState && Z.getState(); return !!(st && st.playing); } catch (e) { return false; }
  }
  function startStation() {
    // the tube stops being a title card the moment the station plays, and
    // does not go back to one for the session (a STOP leaves the scope as
    // it has always been)
    clearBoot();
    if (farArmed) farHunt();                 // 逸脱: while the switch is thrown, every restart is far
    else if (farRestore) farGoHome();        // …and the first restart after it is thrown back is not
    clearLog(); Z.play();
    var pb = document.getElementById("zankyo-play");
    if (pb) { pb.classList.add("is-down"); pb.setAttribute("aria-pressed", "true"); }   // the key latches down for the run
    if (sceneEl) sceneEl.classList.add("is-on");   // power LED
  }
  function wireTransport() {
    var playBtn = document.getElementById("zankyo-play"), stopBtn = document.getElementById("zankyo-stop");
    if (playBtn) playBtn.addEventListener("click", startStation);
    if (stopBtn) stopBtn.addEventListener("click", function () {
      Z.stop(); cutPicture();
      // STOP releases the PLAY key: the latch pops back up, which is the
      // machine saying it has stopped even with every lamp dark
      if (playBtn) { playBtn.classList.remove("is-down"); playBtn.setAttribute("aria-pressed", "false"); }
      if (sceneEl) sceneEl.classList.remove("is-on");
      // STOP is momentary, so its red only flashes under the finger; hold it
      // a beat so a quick tap still reads
      stopBtn.classList.add("is-hit");
      setTimeout(function () { stopBtn.classList.remove("is-hit"); }, 260);
    });

    wireMasterWheel();
  }

  // ==========================================================================
  // 音量 THE MASTER THUMBWHEEL — a moulded rubber wheel on a vertical axle,
  // with the scale printed on it and a fixed pointer above reading it.
  //
  // Every tread and every numbered flat is placed by its ANGLE on the drum and
  // projected onto the flat panel — x = R·sin(θ), squashed by cos(θ), faded as
  // it turns away — so the marks crowd toward the edges the way a real
  // cylinder's do. This is the whole of the effect. The roller this replaced
  // scrolled an evenly-spaced repeating gradient, which is why it read as a
  // strip sliding sideways no matter how it was styled.
  // ==========================================================================
  // 3.2°/unit puts 0→100 across 320° and leaves a 40° blank sector behind the
  // scale. Two things fall out of that, and they are the same decision:
  //   · the printed tens sit further apart (50 px against 42), and the same
  //     finger travel turns fewer units, so the volume is finer to set;
  //   · at an end stop the far end of the scale has come round to exactly 40°
  //     off the pointer — inside the 52° slot, but out in the fade — so you
  //     catch the other side of the wheel peeking in at the edge while the
  //     value itself stops dead at 0 or 100.
  var WHEEL_DEG_PER_UNIT = 3.2;
  var WHEEL_WINDOW       = 52;   // degrees either side of the pointer still inside the slot
  var WHEEL_TREAD_DEG    = 5;    // one tread groove every 5° of drum
  var WHEEL_SEAM_DEG     = 340;  // the band's join, in the middle of the blank sector
  // the fade is tuned to the slot: opacity reaches 0 at 52°, just as the edge
  // cuts, so nothing is ever guillotined mid-stroke
  var WHEEL_FADE_C0      = 0.62;
  var WHEEL_FADE_SPAN    = 0.22;
  function wireMasterWheel() {
    var wheel = document.getElementById("zankyo-master-wheel");
    if (!wheel) return;
    var input  = document.getElementById("zankyo-master-vol");
    var barrel = wheel.querySelector(".zk-wheel-barrel");
    var RAD = Math.PI / 180;

    var initial = 60;
    var st = Z.getState && Z.getState();
    if (st && st.masterVolume != null) initial = pct(st.masterVolume);
    if (input) input.value = initial;

    // the tread, all the way round the wheel — the rubber is continuous even
    // where the printing stops, which is what makes the blank sector read as
    // the back of the wheel rather than as a gap
    var treads = [];
    for (var d = -180, ti = 0; d < 180; d += WHEEL_TREAD_DEG, ti++) {
      var t = document.createElement("span");
      t.className = "zk-wheel-tread";
      barrel.appendChild(t);
      // moulding and wear are never perfectly even; a mechanically identical
      // knurl is one of the things that gives away a drawn wheel
      treads.push({ el: t, deg: d, wear: 0.80 + (((ti * 29) % 13) / 13) * 0.32 });
    }
    // the band's join, out in the blank sector
    var seam = document.createElement("span");
    seam.className = "zk-wheel-seam";
    barrel.appendChild(seam);
    // one milled flat per ten, carrying its printed numeral
    var plates = [];
    for (var v = 0; v <= 100; v += 10) {
      var pl = document.createElement("span");
      pl.className = "zk-wheel-plate";
      var lab = document.createElement("i");
      lab.textContent = v;
      // wear, deterministic per numeral so it never shimmers as the wheel
      // turns: a slight tilt, a sub-pixel offset off register, and its own ink
      // density. Print laid down on a moulded part is never identical twice,
      // and identical numerals are what give away type pretending to be print.
      var wear = ((v * 37) % 11) / 11;
      lab.style.transform =
        "rotate(" + (wear * 1.7 - 0.85).toFixed(2) + "deg)" +
        " translate(" + (wear * 0.9 - 0.45).toFixed(2) + "px," + ((1 - wear) * 0.7 - 0.35).toFixed(2) + "px)";
      lab.style.opacity = (0.80 + wear * 0.18).toFixed(2);
      pl.appendChild(lab);
      barrel.appendChild(pl);
      plates.push({ el: pl, deg: v * WHEEL_DEG_PER_UNIT });
    }

    // wrap an angle into (-180, 180] so marks come round the back correctly
    function wrap(deg) { return ((deg + 180) % 360 + 360) % 360 - 180; }

    function draw(val) {
      var halfW = barrel.clientWidth / 2;
      if (!halfW) return;
      var R = halfW / Math.sin(WHEEL_WINDOW * RAD);

      function place(el, deg, squash, wear) {
        var a = wrap(deg - val * WHEEL_DEG_PER_UNIT);
        var c = Math.cos(a * RAD);
        if (Math.abs(a) > WHEEL_WINDOW || c <= 0.02) { el.style.opacity = 0; return; }
        var o = Math.max(0, Math.min(1, (c - WHEEL_FADE_C0) / WHEEL_FADE_SPAN));
        el.style.opacity = (wear ? Math.min(1, o * wear) : o).toFixed(3);
        el.style.left = (halfW + R * Math.sin(a * RAD)) + "px";
        // a flat squashes with the rubber it is milled into; a tread is a
        // hairline and only needs to fade
        if (squash) el.style.transform = "translate(-50%, -50%) scaleX(" + c.toFixed(3) + ")";
      }
      treads.forEach(function (t) { place(t.el, t.deg, false, t.wear); });
      plates.forEach(function (p) { place(p.el, p.deg, true); });
      place(seam, WHEEL_SEAM_DEG, false);
    }

    function set(val, fromInput) {
      val = Math.max(0, Math.min(100, Math.round(val)));
      if (input && !fromInput) input.value = val;
      if (Z.setMasterVolume) Z.setMasterVolume(val / 100);
      draw(val);
    }

    // drag the wheel: the finger's travel turns the drum, so the wheel moves
    // under the hand rather than jumping to wherever it was tapped
    var lastX = null;
    wheel.addEventListener("pointerdown", function (e) {
      wheel.setPointerCapture(e.pointerId); lastX = e.clientX; e.preventDefault();
    });
    wheel.addEventListener("pointermove", function (e) {
      if (lastX === null) return;
      var dx = e.clientX - lastX;
      if (!dx) return;
      lastX = e.clientX;
      var R = (barrel.clientWidth / 2) / Math.sin(WHEEL_WINDOW * RAD);
      // dragging RIGHT brings lower numbers round to the pointer, because the
      // scale climbs left-to-right across the face of the wheel
      set(Number(input.value) - ((dx / R) / RAD) / WHEEL_DEG_PER_UNIT);
    });
    function release(e) { if (lastX !== null) { lastX = null; try { wheel.releasePointerCapture(e.pointerId); } catch (_) {} } }
    wheel.addEventListener("pointerup", release);
    wheel.addEventListener("pointercancel", release);

    if (input) input.addEventListener("input", function () { set(Number(input.value), true); });

    set(initial);
    // the barrel has no width until layout settles; redraw once it does
    requestAnimationFrame(function () { draw(Number(input.value)); });
    window.addEventListener("resize", function () { draw(Number(input.value)); });
  }

  renderScale(); renderMixer(); wireMixerToggle(); wireTransport(); wireFarSwitch(); wirePush(); wireLedge(); pollArc();
})();

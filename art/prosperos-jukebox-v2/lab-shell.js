// ============================================================================
// Prospero's Jukebox v2 — lab-shell.js
// The sound-lab pages' shared shell (PLAN-SOUND-DIVERSITY §8). Dev-only,
// unlinked from the site: it exists so the owner can tune candidate voices
// ON A PHONE while a real evening plays.
//
// The shell knows NOTHING about any particular track. It owns:
//   - the sticky transport (play/stop, seed, master volume, output meter,
//     the "where is the evening" line, and the error bar),
//   - the tab strip,
//   - the knob component (a native range styled large, label above, value
//     right, default marked, ↺ / double-tap to reset),
//   - the hush chips built from engine.getLayers(),
//   - the decision log,
//   - COPY / PASTE / A-B over a state object the page provides,
//   - the self-test plumbing: ?autoplay=1 / ?seed= / ?tab= / ?fast= /
//     ?nobg=1, the once-a-second DIAG console line, and window.__lab.
//
// The PAGE owns the engine capture, the prototype voices and the shadow
// bodies; it hands the shell a state get/apply pair and an info() callback
// and the shell does the rest. lab-library.html is the first consumer;
// lab-sycorax.html and lab-ariel.html will reuse this file unchanged.
//
// House style: ES5-flavored IIFE, var/function, everything guarded — a lab
// page that throws is a lab page that lies about the sound.
// ============================================================================

window.PJ2Lab = (function () {
  "use strict";

  // ---- tiny DOM helpers ----------------------------------------------------
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function qp(name) {
    try {
      var m = new RegExp("[?&]" + name + "=([^&]*)").exec(window.location.search);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) { return null; }
  }
  function flag(name) { var v = qp(name); return v === "1" || v === "true"; }
  function fmtNum(v, dp) {
    if (v == null || !isFinite(v)) return "-";
    return (+v).toFixed(dp == null ? 2 : dp);
  }

  // The query parameters every lab page understands. Read once, at load.
  var PARAMS = {
    autoplay: flag("autoplay"),   // start without a click (needs the Chromium flag)
    fast: flag("fast"),           // presence 3 on every candidate — audition speed
    nobg: flag("nobg"),           // skip ../background-audio.js (plain ctx.destination)
    diag: flag("diag"),           // DIAG lines without autoplay
    seed: qp("seed"),
    tab: qp("tab"),
  };

  // ==========================================================================
  // THE KNOB — one row: label above-left, value right, default marked, a ↺
  // that resets, a double-tap on the slider that resets too. Specs:
  //   {key, label, min, max, step, def, dp}                 — a slider
  //   {key, label, type:"switch", choices:[[value,text],…], def}  — a switch
  // Values are read at SCHEDULE TIME by the page (never cached in a closure),
  // so a knob moved mid-note lands on the next one.
  // ==========================================================================
  function knobGroup(container, specs, onChange) {
    var rows = {};
    var vals = {};

    function markMoved(key) {
      var r = rows[key];
      if (!r) return;
      var moved = String(vals[key]) !== String(r.spec.def);
      r.valEl.className = "knob-val" + (moved ? " moved" : "");
    }

    function setVal(key, v, quiet) {
      var r = rows[key];
      if (!r) return;
      var sp = r.spec;
      if (sp.type === "switch") {
        vals[key] = v;
        for (var i = 0; i < r.btns.length; i++) {
          r.btns[i].classList.toggle("on", String(r.btns[i].getAttribute("data-v")) === String(v));
        }
        r.valEl.textContent = labelOfChoice(sp, v);
      } else {
        var n = clamp(+v, sp.min, sp.max);
        if (!isFinite(n)) n = sp.def;
        vals[key] = n;
        r.input.value = String(n);
        r.valEl.textContent = fmtNum(n, sp.dp);
      }
      markMoved(key);
      if (!quiet && onChange) { try { onChange(key, vals[key]); } catch (e) {} }
    }

    function labelOfChoice(sp, v) {
      for (var i = 0; i < sp.choices.length; i++) {
        if (String(sp.choices[i][0]) === String(v)) return sp.choices[i][1];
      }
      return String(v);
    }

    for (var si = 0; si < specs.length; si++) {
      (function (sp) {
        var box = el("div", "knob");
        var head = el("div", "knob-head");
        var lab = el("div", "knob-label", sp.label);
        var val = el("div", "knob-val");
        var def = el("div", "knob-def", "def " + (sp.type === "switch" ? labelOfChoice(sp, sp.def) : fmtNum(sp.def, sp.dp)));
        var rst = el("button", "knob-reset", "↺");
        rst.title = "reset to the default";
        rst.setAttribute("aria-label", "reset " + sp.label);
        head.appendChild(lab); head.appendChild(val); head.appendChild(def); head.appendChild(rst);
        box.appendChild(head);

        var row = { spec: sp, valEl: val };
        if (sp.type === "switch") {
          var seg = el("div", "seg");
          row.btns = [];
          for (var ci = 0; ci < sp.choices.length; ci++) {
            (function (ch) {
              var b = el("button", null, ch[1]);
              b.setAttribute("data-v", String(ch[0]));
              b.onclick = function () { setVal(sp.key, ch[0]); };
              seg.appendChild(b);
              row.btns.push(b);
            })(sp.choices[ci]);
          }
          box.appendChild(seg);
        } else {
          var inp = document.createElement("input");
          inp.type = "range";
          inp.min = String(sp.min); inp.max = String(sp.max);
          inp.step = String(sp.step != null ? sp.step : 0.01);
          inp.value = String(sp.def);
          inp.setAttribute("aria-label", sp.label);
          inp.oninput = function () { setVal(sp.key, +inp.value); };
          inp.ondblclick = function () { setVal(sp.key, sp.def); };
          box.appendChild(inp);
          row.input = inp;
        }
        rst.onclick = function () { setVal(sp.key, sp.def); };
        rows[sp.key] = row;
        container.appendChild(box);
        setVal(sp.key, sp.def, true);
      })(specs[si]);
    }

    return {
      get: function (k) { return vals[k]; },
      set: function (k, v) { setVal(k, v); },
      values: function () {
        var out = {};
        for (var k in vals) out[k] = vals[k];
        return out;
      },
      apply: function (obj) {
        if (!obj) return;
        for (var k in rows) { if (obj[k] !== undefined) setVal(k, obj[k], true); }
      },
      reset: function () { for (var k in rows) setVal(k, rows[k].spec.def, true); },
      keys: function () { var out = []; for (var k in rows) out.push(k); return out; },
    };
  }

  // ==========================================================================
  // CREATE — one shell per page.
  //
  //   opts = {
  //     track:  "library",
  //     engine: the track facade (play/stop/reseed/getInfo/getLayers/…),
  //     defaultSeed: number,
  //     timeS:  fn() -> audio seconds or null (for log stamps),
  //     info:   fn() -> { cap, gen, candidates, stops, activeNodes, diag },
  //     state:  { get: fn() -> json, apply: fn(json) },
  //     onTransport: fn("play" | "stop" | "reseed"),  // fired BEFORE the engine
  //     onTick: fn(engineInfo),                       // the 250 ms pulse
  //   }
  // ==========================================================================
  function create(opts) {
    opts = opts || {};
    var engine = opts.engine || null;
    var shell = {};
    var errors = [];
    var errbar = $("errbar");
    var logEl = $("log");
    var t0Wall = Date.now();

    // ---- errors are never silent: the page says why it is quiet -----------
    function error(msg) {
      msg = String(msg);
      if (errors.length < 40 && errors.indexOf(msg) < 0) errors.push(msg);
      if (errbar) errbar.textContent = errors.slice(-3).join("\n");
      try { console.warn("LAB " + msg); } catch (e) {}
    }
    shell.error = error;
    shell.errors = errors;

    // guard(label, fn) — wrap anything that touches audio or the engine, so a
    // surprise lands in the error list (and in window.__lab.errors) instead of
    // stopping the poll that keeps everything else alive.
    function guard(label, fn) {
      try { return fn(); }
      catch (e) { error(label + ": " + (e && e.message ? e.message : e)); return undefined; }
    }
    shell.guard = guard;

    try {
      window.addEventListener("error", function (ev) {
        error("JS ERROR " + (ev && ev.message ? ev.message : "?") +
              (ev && ev.filename ? " @ " + String(ev.filename).split("/").pop() + ":" + ev.lineno : ""));
      });
      window.addEventListener("unhandledrejection", function (ev) {
        error("PROMISE " + ((ev && ev.reason && ev.reason.message) || ev.reason || "?"));
      });
    } catch (e) {}

    // ---- the log ----------------------------------------------------------
    function stamp() {
      var s = null;
      if (opts.timeS) { try { s = opts.timeS(); } catch (e) { s = null; } }
      if (s == null || !isFinite(s)) return "";
      var w = Math.floor(s);
      return Math.floor(w / 60) + ":" + ("0" + (w % 60)).slice(-2) + " ";
    }
    function log(text, cls) {
      if (!logEl) return;
      var line = el("div", cls || null, stamp() + text);
      logEl.insertBefore(line, logEl.firstChild);
      while (logEl.children.length > 120) logEl.removeChild(logEl.lastChild);
    }
    shell.log = log;

    // ---- transport --------------------------------------------------------
    var playBtn = $("btnPlay");
    var seedInput = $("seed");
    var seedBtn = $("btnSeed");
    var master = $("master");

    function fire(kind) { if (opts.onTransport) guard("onTransport", function () { opts.onTransport(kind); }); }

    function doPlay() {
      if (!engine) return;
      fire("play");
      guard("play", function () { engine.play(); });
      ensureAnalyser();
      log("— play —", "hd");
    }
    function doStop() {
      if (!engine) return;
      fire("stop");
      guard("stop", function () { engine.stop(); });
      log("— stop —", "hd");
    }
    shell.play = doPlay;
    shell.stop = doStop;
    if (playBtn) {
      playBtn.onclick = function () {
        var on = false;
        try { on = engine && engine.isPlaying(); } catch (e) {}
        if (on) doStop(); else doPlay();
      };
    }
    function reseedTo(s) {
      fire("reseed");
      guard("reseed", function () { engine.reseed(s >>> 0); });
      log("— reseed " + (s >>> 0) + " —", "hd");
    }
    shell.reseed = reseedTo;
    if (seedInput) {
      if (PARAMS.seed) seedInput.value = String((+PARAMS.seed) >>> 0);
      else if (opts.defaultSeed != null) seedInput.value = String(opts.defaultSeed >>> 0);
      seedInput.onchange = function () { reseedTo(+seedInput.value); };
    }
    if (seedBtn) {
      seedBtn.onclick = function () {
        var s = Math.floor(Math.random() * 4294967295);
        if (seedInput) seedInput.value = String(s);
        reseedTo(s);
      };
    }
    shell.seed = function () { return seedInput ? ((+seedInput.value) >>> 0) : 0; };
    shell.setSeed = function (s) { if (seedInput) seedInput.value = String(s >>> 0); reseedTo(+s); };

    if (master) {
      master.oninput = function () {
        guard("master", function () { engine.setMasterVolume(+master.value); });
      };
    }
    shell.master = function () { return master ? +master.value : 1; };
    shell.setMaster = function (v) {
      if (!master) return;
      master.value = String(clamp(+v, 0, 1));
      guard("master", function () { engine.setMasterVolume(+master.value); });
    };

    // ---- the meter (the engine's own analyser tap, re-tapped per run) ------
    var analyser = null, meterBuf = null, rmsDb = -120;
    function ensureAnalyser() {
      if (analyser || !engine) return;
      guard("analyser", function () {
        var ctx = opts.ctx ? opts.ctx() : null;
        if (!ctx) return;
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        engine.attachAnalyser(analyser);
      });
    }
    shell.ensureAnalyser = ensureAnalyser;
    shell.rmsDb = function () { return rmsDb; };

    var fillEl = $("meterFill"), dbEl = $("meterDb");
    (function meterLoop() {
      if (analyser) {
        try {
          if (!meterBuf) meterBuf = new Float32Array(analyser.fftSize);
          analyser.getFloatTimeDomainData(meterBuf);
          var sum = 0;
          for (var i = 0; i < meterBuf.length; i++) sum += meterBuf[i] * meterBuf[i];
          var rms = Math.sqrt(sum / meterBuf.length);
          rmsDb = rms > 0 ? 20 * Math.log10(rms) : -120;
        } catch (e) {}
      }
      if (fillEl) fillEl.style.width = clamp((rmsDb + 70) / 70 * 100, 0, 100).toFixed(1) + "%";
      if (dbEl) dbEl.textContent = (rmsDb <= -119 ? "-inf" : rmsDb.toFixed(0)) + " dB";
      try { requestAnimationFrame(meterLoop); } catch (e) {}
    })();

    // ---- tabs -------------------------------------------------------------
    var tabsEl = $("tabs");
    function showTab(name) {
      var panels = document.querySelectorAll(".panel");
      var known = false;
      for (var q = 0; q < panels.length; q++) {
        if (panels[q].getAttribute("data-tab") === name) known = true;
      }
      // a ?tab= nobody recognizes must not leave the page blank
      if (!known && panels.length) name = panels[0].getAttribute("data-tab");
      for (var i = 0; i < panels.length; i++) {
        panels[i].hidden = (panels[i].getAttribute("data-tab") !== name);
      }
      if (tabsEl) {
        var btns = tabsEl.querySelectorAll(".tab");
        for (var j = 0; j < btns.length; j++) {
          btns[j].setAttribute("aria-selected", btns[j].getAttribute("data-tab") === name ? "true" : "false");
        }
      }
    }
    shell.showTab = showTab;
    if (tabsEl) {
      var tbtns = tabsEl.querySelectorAll(".tab");
      for (var ti = 0; ti < tbtns.length; ti++) {
        (function (b) { b.onclick = function () { showTab(b.getAttribute("data-tab")); }; })(tbtns[ti]);
      }
    }
    showTab(PARAMS.tab || (tabsEl && tabsEl.querySelector(".tab") ? tabsEl.querySelector(".tab").getAttribute("data-tab") : "instruments"));

    // ---- hush chips: the engine's own mixer, one chip per layer -----------
    // The point of the lab: a candidate must be judgeable against the drone
    // alone AND against the whole ensemble, without waiting for a scene.
    var chipEls = {};
    function buildHush(container) {
      if (!container || !engine) return;
      var layers = [];
      guard("getLayers", function () { layers = engine.getLayers() || []; });
      var chips = el("div", "chips");
      for (var i = 0; i < layers.length; i++) {
        (function (L) {
          var b = el("button", "chip", L.label);
          b.onclick = function () {
            guard("toggleLayer", function () {
              var info = engine.getInfo() || {};
              var muted = info.layers && info.layers[L.key] ? info.layers[L.key].muted : false;
              engine.toggleLayer(L.key, muted); // muted → audible, and back
            });
            refreshChips();
          };
          chips.appendChild(b);
          chipEls[L.key] = b;
        })(layers[i]);
      }
      container.appendChild(chips);
      var presets = el("div", "btnrow");
      function setAll(keys, on) {
        for (var k = 0; k < layers.length; k++) {
          var key = layers[k].key;
          var want = keys ? (keys.indexOf(key) >= 0) : on;
          guard("toggleLayer", function () { engine.toggleLayer(key, want); });
        }
        refreshChips();
      }
      var b1 = el("button", "wide", "drone only");
      b1.onclick = function () { setAll(["drone"], false); log("— hush: drone only —", "hd"); };
      var b2 = el("button", "wide", "no speakers");
      b2.onclick = function () { setAll(["drone", "cello", "hum", "ambient", "halo"], false); log("— hush: no speakers —", "hd"); };
      var b3 = el("button", "wide", "all on");
      b3.onclick = function () { setAll(null, true); log("— hush: all on —", "hd"); };
      presets.appendChild(b1); presets.appendChild(b2); presets.appendChild(b3);
      container.appendChild(presets);
    }
    function refreshChips() {
      if (!engine) return;
      var info = null;
      try { info = engine.getInfo(); } catch (e) { return; }
      if (!info || !info.layers) return;
      for (var k in chipEls) {
        var m = info.layers[k] ? info.layers[k].muted : false;
        chipEls[k].classList.toggle("off", !!m);
      }
    }
    shell.buildHush = buildHush;
    shell.refreshChips = refreshChips;
    shell.hushState = function () {
      var out = {};
      var info = null;
      try { info = engine.getInfo(); } catch (e) { return out; }
      if (info && info.layers) { for (var k in info.layers) out[k] = !info.layers[k].muted; }
      return out;
    };
    shell.applyHush = function (h) {
      if (!h || !engine) return;
      for (var k in h) { guard("toggleLayer", function () { engine.toggleLayer(k, !!h[k]); }); }
      refreshChips();
    };

    // ---- COPY / PASTE / A-B ----------------------------------------------
    // The hand-off: the owner tunes on the phone, taps COPY, pastes the JSON
    // into the chat, and the integration uses those exact numbers.
    var slotA = null, slotB = null, abSide = "A";
    var jsonOut = null, abState = null;
    var abRefresh = function () {};
    var abQuick = $("btnAB");   // the compact swap in the sticky bar (optional)

    function stateJson() {
      if (!opts.state || !opts.state.get) return {};
      var v = guard("state.get", function () { return opts.state.get(); });
      return v || {};
    }
    function applyJson(json) {
      if (!opts.state || !opts.state.apply) return false;
      var ok = guard("state.apply", function () { opts.state.apply(json); return true; });
      return !!ok;
    }
    shell.stateJson = stateJson;
    shell.applyJson = applyJson;

    function copyText(text) {
      var done = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
          done = true;
        }
      } catch (e) { done = false; }
      if (!done) {
        try {
          var ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          done = true;
        } catch (e2) { done = false; }
      }
      return done;
    }

    function buildMix(container) {
      if (!container) return;
      var row1 = el("div", "btnrow");
      var copyBtn = el("button", "wide", "COPY the tuning");
      copyBtn.onclick = function () {
        var text = JSON.stringify(stateJson());
        if (jsonOut) jsonOut.value = text;
        var ok = copyText(text);
        log(ok ? "— copied the tuning to the clipboard —" : "— clipboard refused; the JSON is in the box below —", "hd");
      };
      row1.appendChild(copyBtn);
      container.appendChild(row1);

      jsonOut = document.createElement("textarea");
      jsonOut.readOnly = true;
      jsonOut.setAttribute("aria-label", "the tuning as JSON");
      jsonOut.value = "";
      container.appendChild(jsonOut);

      container.appendChild(el("h3", null, "paste a tuning back"));
      var jsonIn = document.createElement("textarea");
      jsonIn.setAttribute("aria-label", "paste a tuning here");
      jsonIn.placeholder = '{"pj2-lab":1,…}';
      container.appendChild(jsonIn);
      var row2 = el("div", "btnrow");
      var loadBtn = el("button", "wide", "LOAD it");
      loadBtn.onclick = function () {
        var parsed = null;
        try { parsed = JSON.parse(jsonIn.value); }
        catch (e) { error("paste: that is not JSON (" + e.message + ")"); return; }
        if (applyJson(parsed)) log("— loaded a pasted tuning —", "hd");
      };
      row2.appendChild(loadBtn);
      container.appendChild(row2);

      container.appendChild(el("h3", null, "A / B — the fastest comparison"));
      abState = el("div", "ab-state", "A: empty · B: empty · now: —");
      container.appendChild(abState);
      var row3 = el("div", "btnrow");
      function refreshAb() {
        abState.textContent = "A: " + (slotA ? "held" : "empty") +
          " · B: " + (slotB ? "held" : "empty") + " · now: " + abSide;
        if (abQuick) {
          abQuick.textContent = (slotA || slotB) ? ("A⇄B:" + abSide) : "A⇄B";
          abQuick.classList.toggle("on", !!(slotA && slotB));
        }
      }
      abRefresh = refreshAb;
      /* eslint-disable no-inner-declarations */
      function save(which) {
        var s = stateJson();
        if (which === "A") slotA = s; else slotB = s;
        abSide = which;
        refreshAb();
        log("— saved snapshot " + which + " —", "hd");
      }
      function recall(which) {
        var s = (which === "A") ? slotA : slotB;
        if (!s) { error("snapshot " + which + " is empty"); return; }
        abSide = which;
        applyJson(s);
        refreshAb();
        log("— recalled snapshot " + which + " —", "hd");
      }
      var bs = [["SAVE A", function () { save("A"); }], ["SAVE B", function () { save("B"); }],
                ["RECALL A", function () { recall("A"); }], ["RECALL B", function () { recall("B"); }],
                ["A ⇄ B", function () { recall(abSide === "A" ? "B" : "A"); }]];
      for (var i = 0; i < bs.length; i++) {
        (function (spec) {
          var b = el("button", "wide", spec[0]);
          b.onclick = spec[1];
          row3.appendChild(b);
        })(bs[i]);
      }
      container.appendChild(row3);
      // the fastest comparison must not live one tab away: the sticky bar's
      // A⇄B recalls the other snapshot wherever the owner is
      if (abQuick) {
        abQuick.onclick = function () {
          if (!slotA && !slotB) {
            error("A⇄B: save a snapshot on the MIX tab first (SAVE A, then tune, then SAVE B)");
            return;
          }
          recall(abSide === "A" ? "B" : "A");
        };
      }
      refreshAb();
    }
    shell.buildMix = buildMix;

    // ==========================================================================
    // THE PULSE — one 250 ms timer drives the readout, the chips, __lab and
    // the page's own brain poll (the page hands its work in through onTick).
    // ==========================================================================
    var lab = window.__lab = {
      ready: false, playing: false, gen: 0,
      scene: null, intensity: null, chord: null,
      errors: errors,
      candidates: {}, stops: {},
      activeNodes: 0, rms: -120,
      state: function () { return stateJson(); },
      apply: function (json) { return applyJson(json); },
    };
    shell.lab = lab;

    var nowEl = $("nowline");
    var lastInfo = {};
    setInterval(function () {
      var info = {};
      if (engine) { try { info = engine.getInfo() || {}; } catch (e) { info = {}; } }
      lastInfo = info;
      var pageInfo = {};
      if (opts.info) { var pi = guard("info", function () { return opts.info(); }); if (pi) pageInfo = pi; }

      lab.ready = true;
      lab.playing = !!info.playing;
      lab.gen = pageInfo.gen || 0;
      lab.scene = info.sceneType || null;
      lab.sceneLabel = info.sceneLabel || null;
      lab.intensity = (info.intensity != null) ? info.intensity : null;
      lab.chord = info.harmony || null;
      lab.candidates = pageInfo.candidates || {};
      lab.stops = pageInfo.stops || {};
      lab.activeNodes = pageInfo.activeNodes || 0;
      lab.cap = !!pageInfo.cap;
      lab.rms = rmsDb;
      lab.maxGain = pageInfo.maxGain || 0;   // the loudest peak the page has scheduled
      lab.layers = info.layers || {};

      if (nowEl) {
        if (!info.playing) {
          nowEl.textContent = "stopped — press PLAY";
        } else {
          nowEl.textContent =
            (info.sceneLabel || info.sceneType || "…") +
            " · iv " + fmtNum(info.intensity, 2) +
            " · " + (info.harmony || "?") +
            (info.harmonyTones ? " [" + info.harmonyTones + "]" : "");
        }
      }
      refreshChips();
      if (opts.onTick) guard("onTick", function () { opts.onTick(info); });
    }, 250);
    shell.engineInfo = function () { return lastInfo; };

    // ==========================================================================
    // THE SELF-TEST — ?autoplay=1 plays without a click and runs the page's
    // timeline; a DIAG line each second carries everything a headless run
    // needs to judge the page (the mockup pages' proven idiom).
    // ==========================================================================
    shell.selfTest = function (steps) {
      if (!PARAMS.autoplay) return;
      log("— self-test: ?autoplay=1 —", "hd");
      setTimeout(function () { doPlay(); }, 1200);
      for (var i = 0; i < steps.length; i++) {
        (function (st) {
          setTimeout(function () {
            log("selftest: " + st[1], "hd");
            guard("selftest " + st[1], st[2]);
          }, st[0] * 1000);
        })(steps[i]);
      }
    };

    if (PARAMS.autoplay || PARAMS.diag) {
      setInterval(function () {
        var info = lastInfo || {};
        var pageInfo = {};
        if (opts.info) { try { pageInfo = opts.info() || {}; } catch (e) {} }
        var cands = pageInfo.candidates || {};
        var cLine = "";
        for (var k in cands) cLine += " " + k + "=" + (cands[k].entries || 0) + "/" + (cands[k].active || 0);
        var stops = pageInfo.stops || {};
        var sLine = [];
        for (var lk in stops) { if (stops[lk] && stops[lk].stop && stops[lk].stop !== "none") sLine.push(lk + ":" + stops[lk].stop); }
        var line = "DIAG t=" + Math.round((Date.now() - t0Wall) / 1000) +
          " ctx=" + (pageInfo.ctxState || "none") +
          " playing=" + (!!info.playing) +
          " cap=" + (!!pageInfo.cap) +
          " scene=" + (info.sceneType || "-") +
          " iv=" + fmtNum(info.intensity, 2) +
          " chord=" + (info.harmony || "-") +
          cLine +
          " stops=" + (sLine.length ? sLine.join(",") : "-") +
          " nodes=" + (pageInfo.activeNodes || 0) +
          " out=" + (rmsDb <= -119 ? "-inf" : rmsDb.toFixed(1)) + "dB" +
          " err=" + (errors.length ? errors.length + ":" + errors[errors.length - 1].slice(0, 60) : "none");
        try { console.log(line); } catch (e) {}
      }, 1000);
    }

    return shell;
  }

  return {
    create: create,
    knobs: knobGroup,
    params: PARAMS,
    el: el,
    $: $,
    clamp: clamp,
    fmtNum: fmtNum,
  };
})();

// ============================================================================
// ROOM LAB — the bench script (dev only; see room-lab.php).
//
// Drives the REAL engine through its room hooks — KolobAudio.getRooms /
// setRoom / setRoomBalance / setLayerDepth — and nothing else. No audio
// nodes are built here; the page is a remote control for kolob-audio.js.
// ============================================================================
(function () {
  "use strict";
  var K = window.KolobAudio;
  var errEl = document.getElementById("rml-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent = msg; }
  window.onerror = function (msg, src, line) { showErr("JS error: " + msg + " @ " + (src || "").split("/").pop() + ":" + line); return false; };
  if (!K) { showErr("Kolob engine missing — kolob-audio.js did not load."); return; }
  if (!window.PJ2 || !window.PJ2.Fx || !window.PJ2.Fx.roomBlend) showErr("pj2-fx.js did not load — the engine is running one room only; the balance and depth controls do nothing.");

  // ---- the candidate rooms ---------------------------------------------------
  // OpenAIR (AudioLab, University of York, CC BY-SA 3.0) — provenance and the
  // processing each file had in ../prosperos-jukebox-v2/ir/README.md.
  var IR = "../prosperos-jukebox-v2/ir/";
  var ROOMS = [
    { key: "pour", file: null, name: "the pour — Kolob's own", desc: "decaying noise under eight early taps; the engine's default, always the fallback", mb: 0 },
    { key: "st-margarets", file: IR + "candidates/st-margarets-ncem.wav", name: "St Margaret's, York — nave", desc: "a church nave heard 11 m back (the National Centre for Early Music); the Library's wide room, full-length file", mb: 3.2 },
    { key: "st-margarets-trim", file: IR + "rooms/library-wide-st-margarets.wav", name: "St Margaret's, York — as the Library ships it", desc: "the same nave, tail trimmed at −70 dB to 1.7 s; small and quick to load", mb: 0.3 },
    { key: "lady-chapel", file: IR + "candidates/lady-chapel-st-albans.wav", name: "Lady Chapel, St Albans", desc: "a gothic stone chapel, 6 s", mb: 1.5 },
    { key: "elveden", file: IR + "candidates/elveden-marble-hall.wav", name: "Elveden marble hall", desc: "an abandoned ornate hall, 8 s, ghostly", mb: 1.4 },
    { key: "guildhall", file: IR + "candidates/york-guildhall.wav", name: "York Guildhall", desc: "an oak-panelled medieval council chamber", mb: 0.9 },
    { key: "typing-room", file: IR + "candidates/terrys-typing-room.wav", name: "Terry's typing room", desc: "a chocolate factory's typing room — intimate wood and plaster, 5.8 s", mb: 3.2 },
    { key: "air-museum", file: IR + "candidates/ariel-air-museum.wav", name: "Yorkshire Air Museum hangar", desc: "a big open span, 2.5 s", mb: 0.5 },
    { key: "tvisongur", file: IR + "candidates/ariel-tvisongur.wav", name: "Tvísöngur domes, Iceland", desc: "tuned concrete singing domes (a model measurement); Ariel's sky", mb: 0.7 },
    { key: "hamilton", file: IR + "candidates/ariel-hamilton-mausoleum.wav", name: "Hamilton Mausoleum", desc: "a stone dome with a legendary ~15 s bloom — the far end of the scale", mb: 4.2 },
    { key: "r1", file: IR + "candidates/syc-r1-reactor-hall.wav", name: "R1 reactor hall, Stockholm", desc: "a vast void 25 m underground, 20 s — the nearest thing on disk to the Tabernacle", mb: 5.7 },
    { key: "maes-howe", file: IR + "candidates/syc-maes-howe.wav", name: "Maes Howe, Orkney", desc: "a Neolithic tomb chamber — 1 s of stone; a close-room candidate", mb: 0.3 },
    { key: "bottle-dungeon", file: IR + "candidates/syc-bottle-dungeon.wav", name: "Falkland bottle dungeon", desc: "a stone oubliette, 2.2 s; a close-room candidate", mb: 0.4 },
    { key: "lime-kiln", file: IR + "candidates/syc-lime-kiln.wav", name: "Hoffmann lime kiln", desc: "a circular brick industrial tunnel, 2 s", mb: 0.4 },
    { key: "mine", file: IR + "candidates/syc-gill-heads-mine.wav", name: "Gill Heads Mine", desc: "a disused lead-mine passage, Yorkshire Dales (mono)", mb: 1.4 },
    { key: "tunnel", file: IR + "candidates/syc-railway-tunnel.wav", name: "Innocent Railway tunnel", desc: "a long flutter-echo bore, Edinburgh (mono)", mb: 1.4 },
    { key: "gorge", file: IR + "candidates/ariel-trollers-gill.wav", name: "Trollers Gill", desc: "a limestone gorge — open sky between rock walls (mono)", mb: 1.4 },
    { key: "forest", file: IR + "candidates/ariel-koli-forest.wav", name: "Koli forest ridge, Finland", desc: "real open air over a forest ridge (mono)", mb: 1.4 },
  ];
  function roomByFile(file) {
    for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].file === file) return ROOMS[i];
    return ROOMS[0];
  }

  // ---- per-room controls ------------------------------------------------------
  var ROOM_CTLS = [
    { key: "wet", label: "wet", min: 0, max: 0.8, step: 0.01, hint: "how much of the room comes back with the voice", fmt: function (v) { return v.toFixed(2); } },
    { key: "preDelayS", label: "pre-delay", min: 0, max: 0.08, step: 0.001, hint: "ms before the first reflection — nearer walls, shorter", fmt: function (v) { return Math.round(v * 1000) + " ms"; } },
    { key: "decayS", label: "pour: decay", min: 0.4, max: 9, step: 0.1, hint: "the synthetic room's tail (a measured room brings its own)", pourOnly: true, fmt: function (v) { return v.toFixed(1) + " s"; } },
    { key: "brightness", label: "pour: darkening", min: 0.4, max: 2.2, step: 0.05, hint: "lower = a brighter tail (the tabernacle 0.8, a plastered hall 1.2)", pourOnly: true, fmt: function (v) { return v.toFixed(2); } },
  ];
  function el(sel) { return document.querySelector(sel); }
  function buildRoom(which) {
    var sel = el('[data-room-sel="' + which + '"]');
    var ctls = el('[data-room-ctls="' + which + '"]');
    ROOMS.forEach(function (r) {
      var o = document.createElement("option");
      o.value = r.key; o.textContent = r.name + (r.mb ? "  (" + r.mb + " MB)" : "");
      sel.appendChild(o);
    });
    var info = K.getRooms()[which];
    sel.value = roomByFile(info.irUrl).key;
    sel.addEventListener("change", function () {
      var r = null;
      for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].key === sel.value) r = ROOMS[i];
      K.setRoom(which, { irUrl: r ? r.file : null });
      refreshRoom(which);
    });
    var html = "";
    ROOM_CTLS.forEach(function (c) {
      html += '<div class="rml-ctl" data-ctl="' + c.key + '"><div class="rml-ctl-top"><span class="rml-ctl-label">' + c.label +
        '</span><span class="rml-ctl-val" data-val="' + c.key + '"></span></div>' +
        '<input type="range" min="' + c.min + '" max="' + c.max + '" step="' + c.step + '" data-room-ctl="' + c.key + '" />' +
        '<span class="rml-ctl-hint">' + c.hint + '</span></div>';
    });
    ctls.innerHTML = html;
    ROOM_CTLS.forEach(function (c) {
      var input = ctls.querySelector('[data-room-ctl="' + c.key + '"]');
      input.value = info[c.key];
      input.addEventListener("input", function () {
        var patch = {}; patch[c.key] = parseFloat(input.value);
        K.setRoom(which, patch);
        refreshRoom(which);
      });
    });
    refreshRoom(which);
  }
  function refreshRoom(which) {
    var info = K.getRooms()[which];
    var r = roomByFile(info.irUrl);
    el('[data-room-desc="' + which + '"]').textContent = r.desc;
    var st = el('[data-room-state="' + which + '"]');
    st.className = "rml-room-state";
    var was = info.loaded ? roomByFile(info.loaded).name : "the pour";
    if (!info.irUrl) { st.textContent = "the pour is playing"; }
    else if (info.loading) { st.textContent = "loading " + r.mb + " MB… (" + was + " plays meanwhile)"; st.classList.add("is-wait"); }
    else if (info.loaded === info.irUrl) { st.textContent = "measured room loaded and playing"; st.classList.add("is-ok"); }
    else if (info.error) { st.textContent = "could not load (" + info.error + ") — " + was + " plays on"; st.classList.add("is-bad"); }
    else st.textContent = "";
    var ctls = el('[data-room-ctls="' + which + '"]');
    ROOM_CTLS.forEach(function (c) {
      var v = info[c.key];
      ctls.querySelector('[data-val="' + c.key + '"]').textContent = c.fmt(v);
      var box = ctls.querySelector('[data-ctl="' + c.key + '"]');
      box.classList.toggle("is-dim", !!(c.pourOnly && info.loaded === info.irUrl && info.irUrl));
    });
  }

  // ---- balance ---------------------------------------------------------------
  var balance = document.getElementById("rml-balance");
  var balanceVal = document.getElementById("rml-balance-val");
  var follow = document.getElementById("rml-follow");
  var plan = document.getElementById("rml-balance-plan");
  function planText() {
    var sb = K.getRooms().sectionBalance;
    return "the sections' own seats: " + Object.keys(sb).map(function (s) { return s + " " + sb[s].toFixed(2); }).join(" · ");
  }
  plan.textContent = planText();
  balance.addEventListener("input", function () {
    follow.checked = false;
    K.setRoomBalance(parseInt(balance.value, 10) / 100, 0.4, true);
    balanceVal.textContent = (parseInt(balance.value, 10) / 100).toFixed(2);
  });
  follow.addEventListener("change", function () {
    if (follow.checked) {
      // hand it back: the current section's seat, ramped like a real boundary
      var R = K.getRooms(); var c = K.getConductor();
      var seat = (c && c.section && R.sectionBalance[c.section] != null) ? R.sectionBalance[c.section] : 0.45;
      K.setRoomBalance(seat, 4, false);
    } else K.setRoomBalance(K.getRooms().balance, 0.05, true);
  });

  // ---- auditions -------------------------------------------------------------
  var keys = document.getElementById("rml-keys");
  K.getLayers().forEach(function (layer) {
    if (layer === "ambient" || layer === "tuba") return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "rml-key"; b.textContent = layer;
    b.addEventListener("click", function () { K.sample(layer); });
    keys.appendChild(b);
  });
  ["wind", "bell", "crickets"].forEach(function (f) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "rml-key"; b.textContent = "field: " + f;
    b.addEventListener("click", function () { K.sample("field:" + f); });
    keys.appendChild(b);
  });

  // ---- depth -----------------------------------------------------------------
  var depthHost = document.getElementById("rml-depth");
  (function () {
    var depth = K.getRooms().depth;
    var html = "";
    K.getLayers().forEach(function (layer) {
      if (layer === "tuba") return;
      html += '<div class="rml-ctl"><div class="rml-ctl-top"><span class="rml-ctl-label">' + (layer === "ambient" ? "field" : layer) +
        '</span><span class="rml-ctl-val" data-depth-val="' + layer + '">' + depth[layer].toFixed(2) + '</span></div>' +
        '<input type="range" min="-0.45" max="0.45" step="0.01" value="' + depth[layer] + '" data-depth="' + layer + '" /></div>';
    });
    depthHost.innerHTML = html;
    depthHost.querySelectorAll("[data-depth]").forEach(function (input) {
      input.addEventListener("input", function () {
        var layer = input.getAttribute("data-depth"), v = parseFloat(input.value);
        K.setLayerDepth(layer, v);
        depthHost.querySelector('[data-depth-val="' + layer + '"]').textContent = v.toFixed(2);
        writeJSON();
      });
    });
  })();

  // ---- transport -------------------------------------------------------------
  var playBtn = document.getElementById("rml-play"), stopBtn = document.getElementById("rml-stop"), restartBtn = document.getElementById("rml-restart");
  var seedIn = document.getElementById("rml-seed"), skip = document.getElementById("rml-skip"), master = document.getElementById("rml-master");
  seedIn.value = K.getSeed();
  K.setMasterVolume(parseInt(master.value, 10) / 100);
  master.addEventListener("input", function () { K.setMasterVolume(parseInt(master.value, 10) / 100); });
  playBtn.addEventListener("click", function () {
    var s = parseInt(seedIn.value, 10);
    if (!K.isPlaying() && s > 0) K.reseed(s);
    K.play();
  });
  stopBtn.addEventListener("click", function () { K.stop(); });
  restartBtn.addEventListener("click", function () {
    var s = parseInt(seedIn.value, 10) || K.getSeed();
    K.stop();
    setTimeout(function () { K.reseed(s); K.play(); }, 750);   // let the stop's fade land first
  });
  skip.addEventListener("change", function () {
    if (skip.value && K.isPlaying()) K.skipToSection(skip.value);
    skip.value = "";
  });

  // ---- status + JSON ---------------------------------------------------------
  var status = document.getElementById("rml-status");
  var jsonEl = document.getElementById("rml-json");
  function writeJSON() {
    var R = K.getRooms();
    function roomOut(r) {
      var o = { irUrl: r.irUrl, wet: round(r.wet), preDelayS: round(r.preDelayS), decayS: round(r.decayS), brightness: round(r.brightness), ripple: r.ripple };
      if (r.irUrl) o.loaded = r.loaded === r.irUrl;
      return o;
    }
    function round(v) { return Math.round(v * 1000) / 1000; }
    var depth = {}; Object.keys(R.depth).forEach(function (k) { depth[k] = round(R.depth[k]); });
    jsonEl.value = JSON.stringify({ "kolob-rooms": 1, seed: K.getSeed(), close: roomOut(R.close), wide: roomOut(R.wide), balance: round(R.balance), balanceHeld: R.held, depth: depth }, null, 2);
  }
  function tick() {
    var R = K.getRooms(); var c = K.getConductor();
    var b = R.balance;
    if (follow.checked) { balance.value = Math.round(b * 100); }
    balanceVal.textContent = b.toFixed(2);
    playBtn.classList.toggle("is-on", K.isPlaying());
    status.innerHTML = (K.isPlaying() ? "<b>playing</b> · meeting " + c.meeting + " · <b>" + (c.section || "—") + "</b>" : "<b>stopped</b>") +
      " · balance <b>" + b.toFixed(2) + "</b>" + (R.held ? " (held by the bench)" : " (the sections')") +
      " · close: " + roomByFile(R.close.irUrl).name + " · wide: " + roomByFile(R.wide.irUrl).name;
    refreshRoom("close"); refreshRoom("wide");
    writeJSON();
  }
  document.getElementById("rml-copy").addEventListener("click", function () {
    writeJSON();
    var msg = document.getElementById("rml-copy-msg");
    function done() { msg.classList.add("show"); setTimeout(function () { msg.classList.remove("show"); }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(jsonEl.value).then(done, function () { jsonEl.select(); done(); });
    else { jsonEl.select(); try { document.execCommand("copy"); } catch (e) {} done(); }
  });

  // build the graph now so the room cards can read live state; the context
  // starts suspended until a click (autoplay policy) — play/sample resume it
  K.init();
  buildRoom("close"); buildRoom("wide");
  tick();
  setInterval(tick, 500);
})();

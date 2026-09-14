// ============================================================================
// ROOM LAB — an A/B bench (dev only; see room-lab.php).
//
// Two rooms, A and B. One of them is LIT — that is the room you are hearing.
// Play any instrument, or a whole meeting, and flip A/B whenever you like:
// the engine crossfades the tabernacle to the other room in 0.6 s while the
// music goes on. Both rooms are decoded the moment they are picked, so a
// flip never waits on a download.
//
// The bench only drives the real engine's room hooks (setRoom, setRoomBalance,
// preloadRoomIR, sample, play …). No audio nodes are built here.
// ============================================================================
(function () {
  "use strict";
  var K = window.KolobAudio;
  var errEl = document.getElementById("rml-err");
  function showErr(msg) { if (!errEl) return; errEl.hidden = false; errEl.textContent = msg; }
  window.onerror = function (msg, src, line) { showErr("JS error: " + msg + " @ " + (src || "").split("/").pop() + ":" + line); return false; };
  if (!K) { showErr("Kolob engine missing — kolob-audio.js did not load."); return; }
  if (!window.PJ2 || !window.PJ2.Fx || !window.PJ2.Fx.roomBlend) showErr("pj2-fx.js did not load — the room amount slider will do nothing.");

  // ---- the candidate rooms (OpenAIR, University of York, CC BY-SA 3.0) -------
  var IR = "../prosperos-jukebox-v2/ir/";
  var ROOMS = [
    { key: "st-margarets-stereo", file: IR + "rooms/library-wide-st-margarets.wav", name: "St Margaret's church, York — stereo take", desc: "what the page plays since v0.28: the same nave, stereo, trimmed (0.3 MB)" },
    { key: "st-margarets", file: IR + "candidates/st-margarets-ncem.wav", name: "St Margaret's church, York — mono take", desc: "the warm long nave you chose, mono, full-length (3 MB)" },
    { key: "pour", file: null, name: "Kolob's own synthetic room", desc: "the engine's fallback if a file can't load" },
    { key: "lady-chapel", file: IR + "candidates/lady-chapel-st-albans.wav", name: "Lady Chapel, St Albans", desc: "a gothic stone chapel (1.5 MB)" },
    { key: "elveden", file: IR + "candidates/elveden-marble-hall.wav", name: "Elveden marble hall", desc: "an abandoned ornate hall, ghostly (1.4 MB)" },
    { key: "hamilton", file: IR + "candidates/ariel-hamilton-mausoleum.wav", name: "Hamilton Mausoleum", desc: "a stone dome with a 15-second bloom (4 MB)" },
    { key: "r1", file: IR + "candidates/syc-r1-reactor-hall.wav", name: "R1 reactor hall, Stockholm", desc: "a vast underground void, 20 s — the biggest here (6 MB)" },
    { key: "tvisongur", file: IR + "candidates/ariel-tvisongur.wav", name: "Tvísöngur domes, Iceland", desc: "concrete singing domes (0.7 MB)" },
    { key: "air-museum", file: IR + "candidates/ariel-air-museum.wav", name: "Air museum hangar", desc: "a big open span (0.5 MB)" },
    { key: "guildhall", file: IR + "candidates/york-guildhall.wav", name: "York Guildhall", desc: "an oak-panelled council chamber (0.9 MB)" },
    { key: "typing-room", file: IR + "candidates/terrys-typing-room.wav", name: "Terry's typing room", desc: "wood and plaster, intimate (3 MB)" },
    { key: "lime-kiln", file: IR + "candidates/syc-lime-kiln.wav", name: "Hoffmann lime kiln", desc: "a circular brick tunnel (0.4 MB)" },
    { key: "bottle-dungeon", file: IR + "candidates/syc-bottle-dungeon.wav", name: "Falkland bottle dungeon", desc: "a small stone cell (0.4 MB)" },
    { key: "maes-howe", file: IR + "candidates/syc-maes-howe.wav", name: "Maes Howe, Orkney", desc: "a Neolithic tomb chamber, tiny (0.3 MB)" },
  ];
  function roomByKey(key) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].key === key) return ROOMS[i]; return ROOMS[0]; }

  // ---- state -------------------------------------------------------------------
  var slot = { A: "st-margarets-stereo", B: "st-margarets" };   // which room each side holds
  var lit = "A";                                   // which side you are hearing
  var ready = {};                                  // file → "ok" | "loading" | "failed"

  function warm(key) {
    var r = roomByKey(key);
    if (!r.file || ready[r.file] === "ok" || ready[r.file] === "loading") return;
    ready[r.file] = "loading"; paint();
    K.preloadRoomIR(r.file).then(function () { ready[r.file] = "ok"; paint(); }, function () { ready[r.file] = "failed"; paint(); });
  }
  function apply() {
    // the LIT room becomes the tabernacle; the meetinghouse stays the pour.
    // A candidate file carries its own travel time (the mono take: 39 ms), so
    // it takes the pour's 30 ms; the shipped stereo take keeps the engine's 63.
    var r = roomByKey(slot[lit]);
    K.setRoom("wide", { irUrl: r.file, preDelayS: r.key === "st-margarets-stereo" ? 0.063 : 0.030 });
    paint();
  }
  function light(side) { lit = side; apply(); }

  // ---- the two cards -----------------------------------------------------------
  ["A", "B"].forEach(function (side) {
    var sel = document.querySelector('[data-sel="' + side + '"]');
    ROOMS.forEach(function (r) { var o = document.createElement("option"); o.value = r.key; o.textContent = r.name; sel.appendChild(o); });
    sel.value = slot[side];
    sel.addEventListener("change", function () { slot[side] = sel.value; warm(sel.value); if (lit === side) apply(); else paint(); });
    document.querySelector('[data-hear="' + side + '"]').addEventListener("click", function () { light(side); });
  });
  document.addEventListener("keydown", function (e) {
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === "a" || e.key === "A") light("A");
    if (e.key === "b" || e.key === "B") light("B");
  });

  // ---- instruments + the meeting -------------------------------------------------
  var keys = document.getElementById("rml-keys");
  K.getLayers().forEach(function (layer) {
    if (layer === "ambient" || layer === "tuba") return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "rml-key"; b.textContent = layer;
    b.addEventListener("click", function () { K.sample(layer); });
    keys.appendChild(b);
  });
  var playBtn = document.getElementById("rml-play"), stopBtn = document.getElementById("rml-stop"), skip = document.getElementById("rml-skip");
  playBtn.addEventListener("click", function () { K.play(); });
  stopBtn.addEventListener("click", function () { K.stop(); });
  skip.addEventListener("change", function () { if (skip.value && K.isPlaying()) K.skipToSection(skip.value); skip.value = ""; });

  // ---- how much room -------------------------------------------------------------
  // The tabernacle is heard through the balance: held here so the sections
  // don't move it while you compare. 0.6 puts the room clearly in front.
  var amount = document.getElementById("rml-amount");
  function setAmount() { K.setRoomBalance(parseInt(amount.value, 10) / 100, 0.4, true); }
  amount.addEventListener("input", setAmount);

  // ---- paint ----------------------------------------------------------------------
  var status = document.getElementById("rml-status");
  function paint() {
    ["A", "B"].forEach(function (side) {
      var r = roomByKey(slot[side]);
      var card = document.querySelector('[data-card="' + side + '"]');
      card.classList.toggle("is-lit", lit === side);
      document.querySelector('[data-desc="' + side + '"]').textContent = r.desc;
      var st = document.querySelector('[data-state="' + side + '"]');
      var state = r.file ? ready[r.file] : "ok";
      st.className = "rml-state" + (state === "ok" ? " is-ok" : state === "failed" ? " is-bad" : " is-wait");
      st.textContent = state === "ok" ? "ready" : state === "failed" ? "could not load — the synthetic room stands in" : "loading…";
      document.querySelector('[data-hear="' + side + '"]').textContent = lit === side ? "hearing this one" : "hear this one";
    });
    var c = K.getConductor();
    status.innerHTML = "hearing <b>" + lit + "</b> · " + roomByKey(slot[lit]).name + (K.isPlaying() ? " · the meeting is playing, <b>" + (c.section || "") + "</b>" : "");
    playBtn.classList.toggle("is-on", K.isPlaying());
  }

  K.init();
  setAmount();
  warm(slot.A); warm(slot.B);
  apply();
  setInterval(paint, 500);
})();

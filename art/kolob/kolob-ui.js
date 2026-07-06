// ============================================================================
// KOLOB — UI controller (running head + order of service + hymn board +
// the stops + clerk's minutes + broadside)
//
// EVERYTHING the reader sees is set in the DESERET ALPHABET. The engine emits
// English event labels internally; this file maps them to Deseret renderings
// (glyph + transliterated word + numerals) before anything is printed. The
// piece does not explain itself. Latin survives only in numerals and in
// invisible aria-labels for screen readers.
//
// Talks only to window.KolobAudio, window.KolobViz, window.KolobText.
// ============================================================================
(function () {
  "use strict";
  var K = window.KolobAudio;
  if (!K) { if (window.console) console.error("Kolob UI: engine missing"); return; }

  // ==========================================================================
  // THE STRINGS — hand-transliterated, capitals (the 1859 chart).
  // ==========================================================================
  var STR = {
    play: "𐐑𐐢𐐁",                        // PLAY
    stop: "𐐝𐐓𐐉𐐑",                       // STOP
    vol: "𐐚𐐉𐐢",                          // VOL
    seed: "𐐝𐐀𐐔",                         // SEED
    gather: "𐐘𐐈𐐜𐐊𐐡",                    // GATHER (reseed & restart)
    meeting: "𐐣𐐀𐐓𐐆𐐥",                   // MEETING
    hertz: "𐐐𐐊𐐡𐐓𐐝",                     // HERTZ
    idle: "𐐜 𐐚𐐈𐐢𐐆 𐐆𐐞 𐐝𐐓𐐆𐐢",           // THE VALLEY IS STILL
    listening: "𐐜 𐐣𐐆𐐤𐐆𐐓𐐝 𐐒𐐆𐐘𐐆𐐤",      // THE MINUTES BEGIN
    stillness: "𐐝𐐓𐐆𐐢𐐤𐐇𐐝",              // STILLNESS
    fuging: "𐐙𐐧𐐘𐐆𐐥",                    // FUGING
    reprise: "𐐡𐐆𐐑𐐡𐐌𐐞",                  // REPRISE
    develops: "𐐔𐐆𐐚𐐇𐐢𐐊𐐑𐐝",              // DEVELOPS
    disperses: "𐐔𐐆𐐝𐐑𐐊𐐡𐐝𐐇𐐞",            // DISPERSES
    answers: "𐐈𐐤𐐝𐐊𐐡𐐞",                  // ANSWERS
    linesOut: "𐐢𐐌𐐤𐐞 𐐍𐐓",               // LINES OUT
    shadows: "𐐟𐐈𐐔𐐄𐐞",                   // SHADOWS
    theme: "𐐛𐐀𐐣",                        // THEME
    hymnsOfDay: "𐐜 𐐔𐐁𐐞 𐐐𐐆𐐣𐐞",          // THE DAY'S HYMNS
    amen: "𐐁𐐣𐐇𐐤",                        // AMEN
    verse: "𐐚𐐊𐐡𐐝",                       // VERSE
    speaks: "𐐝𐐑𐐀𐐗𐐝",                    // SPEAKS
    theQuestion: "𐐜 𐐗𐐎𐐇𐐝𐐕𐐊𐐤",          // THE QUESTION
    unanswered: "𐐊𐐤𐐈𐐤𐐝𐐊𐐡𐐔",            // UNANSWERED
    raspberry: "𐐡𐐈𐐞𐐒𐐇𐐡𐐆",              // RASPBERRY
    amenDash: "𐐁𐐣𐐇𐐤—",                  // AMEN—
    twoBands: "𐐓𐐅 𐐒𐐈𐐤𐐔𐐞",              // TWO BANDS
    bandNears: "𐐊 𐐒𐐈𐐤𐐔 𐐊𐐑𐐡𐐄𐐕𐐇𐐞",     // A BAND APPROACHES
    bandsCross: "𐐜 𐐒𐐈𐐤𐐔𐐞 𐐗𐐡𐐉𐐝",       // THE BANDS CROSS
    bandPasses: "𐐑𐐈𐐝𐐇𐐞 𐐉𐐤",            // PASSES ON
    theSteeples: "𐐜 𐐝𐐓𐐀𐐑𐐊𐐢𐐞 𐐈𐐤𐐝𐐊𐐡",  // THE STEEPLES ANSWER
    lastBell: "𐐜 𐐢𐐈𐐝𐐓 𐐒𐐇𐐢",           // THE LAST BELL
    steeplesFlag: "𐐝𐐓𐐀𐐑𐐊𐐢𐐞",           // STEEPLES
    oldTune: "𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤 𐐡𐐆𐐣𐐇𐐣𐐒𐐊𐐡𐐔", // AN OLD TUNE REMEMBERED
    memoryOut: "𐐜 𐐣𐐇𐐣𐐊𐐡𐐆 𐐘𐐆𐐚𐐞 𐐍𐐓",   // THE MEMORY GIVES OUT
    tuneWithheld: "𐐜 𐐓𐐅𐐤 𐐆𐐞 𐐎𐐆𐐛𐐐𐐇𐐢𐐔", // THE TUNE IS WITHHELD
    wholeTune: "𐐜 𐐐𐐄𐐢 𐐓𐐅𐐤 𐐈𐐓 𐐢𐐈𐐝𐐓",  // THE WHOLE TUNE, AT LAST
    wholeFlag: "𐐜 𐐐𐐄𐐢 𐐓𐐅𐐤",            // THE WHOLE TUNE (telemetry)
    liahona: "𐐢𐐀𐐊𐐐𐐄𐐤𐐊",                // LIAHONA
    sample: "𐐝𐐈𐐣𐐑𐐊𐐢",                   // SAMPLE
    orderOfService: "𐐃𐐡𐐔𐐊𐐡 𐐊𐐚 𐐝𐐊𐐡𐐚𐐆𐐝", // ORDER OF SERVICE
    theStops: "𐐜 𐐝𐐓𐐉𐐑𐐝",               // THE STOPS
    minutes: "𐐗𐐢𐐊𐐡𐐗𐐝 𐐣𐐆𐐤𐐆𐐓𐐝",         // CLERK'S MINUTES
    broadside: "𐐜 𐐒𐐡𐐃𐐔𐐝𐐌𐐔",            // THE BROADSIDE
    hymnBoard: "𐐐𐐆𐐣 𐐒𐐄𐐡𐐔",             // HYMN BOARD
  };
  var SECTIONS_DS = {
    prelude: "𐐑𐐡𐐇𐐢𐐧𐐔",
    invocation: "𐐆𐐤𐐚𐐄𐐗𐐁𐐟𐐊𐐤",
    hymn: "𐐐𐐆𐐣",
    interlude: "𐐆𐐤𐐓𐐊𐐡𐐢𐐅𐐔",
    testimony: "𐐓𐐇𐐝𐐓𐐆𐐣𐐄𐐤𐐆",
    sacrament: "𐐝𐐈𐐗𐐡𐐊𐐣𐐇𐐤𐐓",
    doxology: "𐐔𐐉𐐗𐐝𐐉𐐢𐐊𐐖𐐆",
    postlude: "𐐑𐐄𐐝𐐓𐐢𐐅𐐔",
  };
  var ACTIVITIES_DS = {
    ordinary: "𐐃𐐡𐐔𐐆𐐤𐐇𐐡𐐆",
    fast: "𐐙𐐈𐐝𐐓 𐐔𐐁",
    conference: "𐐗𐐉𐐤𐐙𐐡𐐇𐐤𐐝",
    jubilee: "𐐖𐐅𐐒𐐆𐐢𐐀",
  };
  var MODES_DS = {
    ionian: "𐐌𐐄𐐤𐐆𐐊𐐤",
    mixolydian: "𐐣𐐆𐐗𐐝𐐄𐐢𐐆𐐔𐐆𐐊𐐤",
    dorian: "𐐔𐐄𐐡𐐆𐐊𐐤",
    aeolian: "𐐀𐐄𐐢𐐆𐐊𐐤",
    penta: "𐐑𐐇𐐤𐐓𐐊𐐓𐐉𐐤𐐆𐐗",
    hexa: "𐐐𐐇𐐗𐐝𐐊𐐓𐐉𐐤𐐆𐐗",
  };
  var LAYERS_DS = {
    organ: "𐐃𐐡𐐘𐐊𐐤",
    drone: "𐐔𐐡𐐄𐐤",
    choir: "𐐗𐐎𐐌𐐊𐐡",
    clarinet: "𐐗𐐢𐐇𐐡𐐆𐐤𐐇𐐓",
    bagpipe: "𐐒𐐈𐐘𐐑𐐌𐐑",
    harmonium: "𐐐𐐂𐐡𐐣𐐄𐐤𐐆𐐊𐐣",
    strings: "𐐝𐐓𐐡𐐆𐐥𐐞",
    bells: "𐐒𐐇𐐢𐐞",
    voice: "𐐚𐐦𐐝",
    telegraph: "𐐓𐐇𐐢𐐊𐐘𐐡𐐈𐐙",
    tuba: "𐐓𐐅𐐒𐐊",                       // TUBA (raspberry amen only)
    ambient: "𐐙𐐀𐐢𐐔",                    // FIELD
  };
  var AMBIENT_DS = [
    [/wind/i, "𐐎𐐆𐐤𐐔", "WIND"],
    [/cricket/i, "𐐗𐐡𐐆𐐗𐐇𐐓𐐝", "CRICKETS"],
    [/clock/i, "𐐗𐐢𐐉𐐗", "CLOCK"],
    [/fork/i, "𐐓𐐅𐐤𐐆𐐥 𐐙𐐃𐐡𐐗", "TUNING FORK"],
    [/rain/i, "𐐡𐐁𐐤", "RAIN"],
    [/coyote/i, "𐐗𐐌𐐄𐐓𐐆", "COYOTE"],
    [/bell/i, "𐐒𐐇𐐢", "BELL"],
    [/beacon/i, "𐐒𐐀𐐗𐐊𐐤", "BEACON"],
  ];

  // ==========================================================================
  // DEV LATIN MODE — a development aid only. The piece speaks Deseret; this
  // switch (the tiny corner toggle, or ?latin=1) reveals the Latin labels so
  // the owner can debug. Persisted in localStorage.
  // ==========================================================================
  var STR_EN = {
    play: "PLAY", stop: "STOP", vol: "VOL", seed: "SEED", gather: "GATHER",
    meeting: "MEETING", hertz: "HZ", idle: "THE VALLEY IS STILL",
    listening: "THE MINUTES BEGIN", stillness: "STILLNESS", fuging: "FUGING",
    reprise: "REPRISE", develops: "DEVELOPS", disperses: "DISPERSES",
    answers: "ANSWERS", linesOut: "LINES OUT", shadows: "SHADOWS",
    theme: "THEME", hymnsOfDay: "THE DAY'S HYMNS", amen: "AMEN",
    verse: "VERSE", speaks: "SPEAKS", liahona: "LIAHONA", sample: "SAMPLE",
    theQuestion: "THE QUESTION", unanswered: "UNANSWERED",
    raspberry: "RASPBERRY", amenDash: "AMEN—",
    twoBands: "TWO BANDS", bandNears: "A BAND APPROACHES",
    bandsCross: "THE BANDS CROSS", bandPasses: "PASSES ON",
    theSteeples: "THE STEEPLES ANSWER", lastBell: "THE LAST BELL", steeplesFlag: "STEEPLES",
    oldTune: "AN OLD TUNE REMEMBERED", memoryOut: "THE MEMORY GIVES OUT",
    tuneWithheld: "THE TUNE IS WITHHELD", wholeTune: "THE WHOLE TUNE, AT LAST",
    wholeFlag: "THE WHOLE TUNE",
    orderOfService: "ORDER OF SERVICE", theStops: "THE STOPS",
    minutes: "CLERK'S MINUTES", broadside: "THE BROADSIDE", hymnBoard: "HYMN BOARD",
  };
  var SECTIONS_EN = {
    prelude: "PRELUDE", invocation: "INVOCATION", hymn: "HYMN", interlude: "INTERLUDE",
    testimony: "TESTIMONY", sacrament: "SACRAMENT", doxology: "DOXOLOGY", postlude: "POSTLUDE",
  };
  var ACTIVITIES_EN = { ordinary: "ORDINARY", fast: "FAST DAY", conference: "CONFERENCE", jubilee: "JUBILEE" };
  var MODES_EN = { ionian: "IONIAN", mixolydian: "MIXOLYDIAN", dorian: "DORIAN", aeolian: "AEOLIAN", penta: "PENTATONIC", hexa: "HEXATONIC" };
  var LAYERS_EN = {
    organ: "ORGAN", drone: "DRONE", choir: "CHOIR", clarinet: "CLARINET",
    bagpipe: "BAGPIPE", harmonium: "HARMONIUM", strings: "STRINGS", bells: "BELLS",
    voice: "VOICE", telegraph: "TELEGRAPH", tuba: "TUBA", ambient: "FIELD",
  };
  var MOTIF_EN = { "𐐀": "A", "𐐁": "B", "𐐂": "C" };

  var latinMode = false;
  try {
    latinMode = /[?&]latin=1/.test(location.search) || localStorage.getItem("kolobLatin") === "1";
  } catch (e) {}
  function TT(dsTable, enTable) { return latinMode ? enTable : dsTable; }
  function ambientName(entry) { return latinMode ? entry[2] : entry[1]; }
  function motifName(n) {
    if (!latinMode) return n;
    // 'u' flag: these are astral-plane code points; without it the character
    // class degenerates into unmatched surrogate halves
    return String(n).replace(/[𐐀𐐁𐐂]/gu, function (ch) { return MOTIF_EN[ch] || ch; });
  }

  // ==========================================================================
  // Deseret rendering of engine events → the clerk's minutes.
  // Returns null to omit an event entirely (harmony chatter, etc.).
  // ==========================================================================
  function dsEvent(ev) {
    var cat = ev.cat || "";
    var label = ev.label || "";
    if (cat === "harmony") return null;                       // too many; the page stays open
    if (cat === "meeting") {
      var mm = /meeting (\d+)/.exec(label);
      return { glyph: "☀", text: TT(STR, STR_EN).meeting + (mm ? " " + mm[1] : "") };
    }
    if (cat === "section") {
      var sec = label.replace("§", "").trim().toLowerCase();
      return { glyph: "§", text: TT(SECTIONS_DS, SECTIONS_EN)[sec] || sec };
    }
    if (cat === "liahona") return { glyph: "⌖", text: TT(STR, STR_EN).liahona };
    if (cat === "conductor") return { glyph: "◦", text: TT(STR, STR_EN).stillness };
    if (cat === "cadence") return { glyph: "∴", text: TT(STR, STR_EN).amen };
    if (cat === "fuging") return { glyph: "⁂", text: TT(STR, STR_EN).fuging };
    if (cat === "telegraph") return { glyph: "⌁", text: LAYERS_DS.telegraph };
    if (cat === "phrase") return { glyph: "♮", text: (TT(LAYERS_DS, LAYERS_EN)[label] || label) + " " + TT(STR, STR_EN).speaks };
    if (cat === "visitation") {
      var SV = TT(STR, STR_EN);
      if (label.indexOf("raspberry") >= 0) return { glyph: "∴", text: SV.raspberry };
      if (label.indexOf("amen—") >= 0) return { glyph: "∴", text: SV.amenDash };
      if (label.indexOf("unanswered") >= 0) return { glyph: "?", text: SV.unanswered };
      if (label.indexOf("question") >= 0) return { glyph: "?", text: SV.theQuestion };
      if (label.indexOf("approaches") >= 0) return { glyph: "⇋", text: SV.bandNears };
      if (label.indexOf("cross") >= 0) return { glyph: "⇋", text: SV.bandsCross };
      if (label.indexOf("passes") >= 0) return { glyph: "⇋", text: SV.bandPasses };
      if (label.indexOf("steeples") >= 0) return { glyph: "◎", text: SV.theSteeples };
      if (label.indexOf("last bell") >= 0) return { glyph: "◎", text: SV.lastBell };
      if (label.indexOf("old tune") >= 0) return { glyph: "✧", text: SV.oldTune };
      if (label.indexOf("memory gives out") >= 0) return { glyph: "✧", text: SV.memoryOut };
      if (label.indexOf("withheld") >= 0) return { glyph: "◌", text: SV.tuneWithheld };
      if (label.indexOf("whole tune") >= 0) return { glyph: "✶", text: SV.wholeTune };
      return { glyph: "⇋", text: SV.twoBands };
    }
    if (cat === "verse") {
      if (label.indexOf("lines out") >= 0) return { glyph: "☞", text: LAYERS_DS.clarinet + " " + TT(STR, STR_EN).linesOut };
      var lm = /line (\d+)/.exec(label);
      return { glyph: "¶", text: TT(STR, STR_EN).verse + (lm ? " " + lm[1] : "") };
    }
    if (cat === "ambient") {
      for (var i = 0; i < AMBIENT_DS.length; i++) {
        if (AMBIENT_DS[i][0].test(label)) return { glyph: "⋆", text: ambientName(AMBIENT_DS[i]) };
      }
      return { glyph: "⋆", text: TT(LAYERS_DS, LAYERS_EN).ambient };
    }
    if (cat === "motif") {
      if (label.indexOf("reprise") >= 0) return { glyph: "✸", text: TT(STR, STR_EN).reprise + " " + motifName(label.replace(/^.*reprise\s*/, "")) };
      if (label.indexOf("answers") >= 0) {
        var pa = /⇄ (\w+) answers (\w+)/.exec(label);
        if (pa) return { glyph: "⇄", text: (TT(LAYERS_DS, LAYERS_EN)[pa[1]] || pa[1]) + " " + TT(STR, STR_EN).answers + " " + (TT(LAYERS_DS, LAYERS_EN)[pa[2]] || pa[2]) };
        return { glyph: "⇄", text: TT(STR, STR_EN).answers };
      }
      if (label.indexOf("shadows") >= 0) return { glyph: "〰", text: LAYERS_DS.harmonium + " " + TT(STR, STR_EN).shadows };
      if (label.indexOf("disperses") >= 0) return { glyph: "࿙", text: TT(STR, STR_EN).disperses };
      if (label.indexOf("❁") >= 0) return { glyph: "❁", text: TT(STR, STR_EN).hymnsOfDay };
      var gm = /(𐐀|𐐁|𐐂)·g(\d+)/.exec(label);
      if (gm) return { glyph: "◆", text: motifName(gm[1]) + "·" + gm[2] + " " + TT(STR, STR_EN).develops };
      return { glyph: "◆", text: TT(STR, STR_EN).develops };
    }
    if (cat === "transport") {
      if (label.indexOf("▶") >= 0) return { glyph: "▶", text: TT(STR, STR_EN).meeting };
      if (label.indexOf("■") >= 0) return { glyph: "■", text: TT(STR, STR_EN).idle };
      if (label.indexOf("sample") >= 0) {
        var sl = label.replace("◈ sample", "").trim();
        return { glyph: "◈", text: TT(STR, STR_EN).sample + " " + (TT(LAYERS_DS, LAYERS_EN)[sl] || "") };
      }
      return null;
    }
    return null;
  }

  // ==========================================================================
  // The stops (mixer) — one drawknob + one slider per layer. Nothing more.
  // The airy console: no rate sliders, no parameter drawers.
  // ==========================================================================
  function renderMixer() {
    var host = document.getElementById("kolob-layers"); if (!host) return;
    var layers = K.getLayers ? K.getLayers() : [];
    var volumes = K.getVolumes ? K.getVolumes() : {};
    host.innerHTML = "";
    layers.forEach(function (layer) {
      var vol = volumes[layer] != null ? volumes[layer] : 0.5;
      var row = document.createElement("div"); row.className = "kolob-stop";
      row.innerHTML =
        '<button type="button" class="kolob-drawknob" data-layer="' + layer + '" aria-label="' + layer + ' on or off" aria-pressed="true"></button>' +
        '<button type="button" class="kolob-stop-name" data-sample="' + layer + '" aria-label="audition ' + layer + '">' + (TT(LAYERS_DS, LAYERS_EN)[layer] || layer) + '</button>' +
        '<input type="range" class="kolob-range" min="0" max="100" value="' + Math.round(vol * 100) + '" data-vol="' + layer + '" aria-label="' + layer + ' volume" />';
      host.appendChild(row);
    });
    host.querySelectorAll("[data-vol]").forEach(function (el) {
      el.addEventListener("input", function () {
        K.setLayerVolume(el.getAttribute("data-vol"), parseInt(el.value, 10) / 100);
      });
    });
    host.querySelectorAll("[data-layer]").forEach(function (el) {
      el.addEventListener("click", function () {
        var on = K.toggleLayer(el.getAttribute("data-layer"));
        el.classList.toggle("is-off", !on);
        el.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    host.querySelectorAll("[data-sample]").forEach(function (el) {
      el.addEventListener("click", function () { if (K.sample) K.sample(el.getAttribute("data-sample")); });
    });
  }

  // ==========================================================================
  // Clerk's minutes — newest on top, capped low (the page stays airy).
  // ==========================================================================
  var LOG_CAP = 40;
  var logStart = null;
  function fmtTime(t) {
    if (logStart === null) logStart = t;
    var s = Math.max(0, Math.floor(t - logStart));
    var m = Math.floor(s / 60);
    return (m < 10 ? "0" : "") + m + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
  }
  function clearLog() {
    logStart = null;
    var l = document.getElementById("kolob-log");
    if (l) l.innerHTML = '<div class="kolob-log-empty">' + TT(STR, STR_EN).listening + '</div>';
  }
  function logEvent(ev) {
    var log = document.getElementById("kolob-log"); if (!log) return;
    var d = dsEvent(ev);
    if (!d) return;
    var empty = log.querySelector(".kolob-log-empty"); if (empty) empty.remove();
    var row = document.createElement("div");
    row.className = "kolob-log-row cat-" + (ev.cat || "conductor");
    row.innerHTML =
      '<span class="kolob-log-time">' + fmtTime(ev.t || 0) + '</span>' +
      '<span class="kolob-log-glyph">' + d.glyph + '</span>' +
      '<span class="kolob-log-text">' + d.text + '</span>';
    log.insertBefore(row, log.firstChild);
    while (log.children.length > LOG_CAP) log.removeChild(log.lastChild);
  }
  if (K.setEventListener) K.setEventListener(logEvent);

  // ==========================================================================
  // Phrase log — every instrument that starts speaking gets a minutes row, so
  // a listener can always look down and see who they are hearing. The engine
  // emits notes at SCHEDULING time (often seconds early), so rows queue until
  // the audio clock reaches them; a "new phrase" is a note that starts after
  // a real gap in that layer's sound.
  // ==========================================================================
  var PHRASE_GAP_S = 3.0;                       // this much quiet = a fresh phrase
  var phraseLast = {};                          // layer -> when its last note ends
  var phraseQueue = [];                         // rows waiting for their startTime
  // the drone is the constant ground; the field and the wire already write
  // their own minutes (ambient + telegraph events) — don't double-book them
  // the tuba is never named here: his moment is logged as RASPBERRY instead
  var PHRASE_SKIP = { drone: 1, ambient: 1, telegraph: 1, tuba: 1 };
  function onNoteForLog(n) {
    if (!n || !n.layer || PHRASE_SKIP[n.layer]) return;
    var end = n.startTime + (n.duration || 0);
    var last = phraseLast[n.layer] != null ? phraseLast[n.layer] : -1e9;
    if (n.startTime > last + PHRASE_GAP_S) {
      if (phraseQueue.length > 80) phraseQueue.shift();
      phraseQueue.push({ layer: n.layer, at: n.startTime });
      phraseQueue.sort(function (a, b) { return a.at - b.at; });
    }
    if (end > last) phraseLast[n.layer] = end;
  }
  function flushPhraseLog() {
    if (!K.getAudioTime) return;
    if (!(K.isPlaying && K.isPlaying())) { phraseQueue.length = 0; return; }
    var now = K.getAudioTime();
    while (phraseQueue.length && phraseQueue[0].at <= now + 0.05) {
      var p = phraseQueue.shift();
      if (p.at > now - 3) logEvent({ cat: "phrase", t: p.at, label: p.layer });
    }
  }
  if (K.setNoteListener) K.setNoteListener(onNoteForLog);

  // ==========================================================================
  // The broadside — one Whitman line at long intervals, letterpress fade.
  // ==========================================================================
  var broadsideTimer = null;
  var lastBroadside = null;
  function setBroadside(ln, animate) {
    var el = document.getElementById("kolob-broadside-line");
    if (!el || !ln) return;
    if (animate) {
      el.classList.remove("is-set");
      void el.offsetWidth;                                    // force reflow so the ink animation re-runs
    }
    el.textContent = latinMode ? ln.en : ln.ds;
    if (animate) el.classList.add("is-set");
  }
  function broadsideTick() {
    if (window.KolobText && K.isPlaying && K.isPlaying()) {
      lastBroadside = window.KolobText.line();
      setBroadside(lastBroadside, true);
    }
    broadsideTimer = setTimeout(broadsideTick, 25000 + Math.random() * 35000);
  }

  // ==========================================================================
  // Running head + order of service + hymn board (polled ~300ms)
  // ==========================================================================
  var SECTION_ORDER = ["prelude", "invocation", "hymn", "testimony", "sacrament", "doxology", "postlude"];
  function pad3(n) { n = Math.max(0, n | 0); return (n < 10 ? "00" : n < 100 ? "0" : "") + n; }

  function updateTelemetry(c, playing) {
    var el = document.getElementById("kolob-telemetry"); if (!el) return;
    var SEP = '<span class="t-sep">·</span>';
    if (!playing) {
      el.innerHTML = '<span class="t-part">' + TT(STR, STR_EN).idle + '</span>';
      return;
    }
    var parts = [
      TT(STR, STR_EN).meeting + " " + pad3(c.meeting),
      TT(SECTIONS_DS, SECTIONS_EN)[c.section] || "",
      TT(ACTIVITIES_DS, ACTIVITIES_EN)[c.activity] || "",
      TT(MODES_DS, MODES_EN)[c.mode] || "",
      (typeof c.f0 === "number" ? c.f0.toFixed(1) : "—") + " " + TT(STR, STR_EN).hertz,
    ];
    if (c.section === "hymn" && c.meter) parts.splice(2, 0, metersDots(c.meter));
    if (c.hush) parts.push('<span class="t-flag">' + TT(STR, STR_EN).stillness + '</span>');
    else if (c.fuging) parts.push('<span class="t-flag">' + TT(STR, STR_EN).fuging + '</span>');
    else if (c.visit) parts.push('<span class="t-flag">' + TT(STR, STR_EN)[{ question: "theQuestion", bands: "twoBands", steeples: "steeplesFlag", assembly: "wholeFlag" }[c.visit] || "twoBands"] + '</span>');
    el.innerHTML = parts.filter(Boolean).map(function (p) { return '<span class="t-part">' + p + '</span>'; }).join(SEP);
  }
  var METER_DOTS = { CM: "8.6.8.6", LM: "8.8.8.8", SM: "6.6.8.6", "87.87": "8.7.8.7", CMD: "8.6.8.6 ×2" };
  function metersDots(m) { return METER_DOTS[m] || m; }

  function updateOrder(c, playing) {
    var host = document.getElementById("kolob-order"); if (!host) return;
    if (!host.childElementCount) {
      SECTION_ORDER.forEach(function (sec) {
        var row = document.createElement("div");
        row.className = "kolob-order-row";
        row.setAttribute("data-sec", sec);
        row.innerHTML =
          '<span class="kolob-order-hand" aria-hidden="true">☞</span>' +
          '<span class="kolob-order-name">' + TT(SECTIONS_DS, SECTIONS_EN)[sec] + '</span>' +
          '<span class="kolob-order-fill"><span></span></span>';
        host.appendChild(row);
      });
    }
    // an interlude is not on the printed program; the manicule rests on the
    // hymn it grew out of
    var curSec = c.section === "interlude" ? "hymn" : c.section;
    var rows = host.children;
    for (var i = 0; i < rows.length; i++) {
      var sec = rows[i].getAttribute("data-sec");
      var isCur = playing && sec === curSec;
      // multiple hymns share one program row; done = the plan has moved past all of that type
      rows[i].classList.toggle("current", isCur);
      var fill = rows[i].querySelector(".kolob-order-fill span");
      if (fill) fill.style.width = isCur ? Math.round(Math.max(0, Math.min(1, c.local)) * 100) + "%" : "0%";
      rows[i].classList.toggle("done", playing && SECTION_ORDER.indexOf(sec) < SECTION_ORDER.indexOf(curSec));
    }
  }

  function updateBoard(c, playing) {
    var seedEl = document.getElementById("kolob-seed-current");
    if (seedEl && K.getSeed) seedEl.textContent = String(K.getSeed());
    var numsEl = document.getElementById("kolob-board-nums");
    if (numsEl) {
      if (playing && K.getMotifStats) {
        var ms = K.getMotifStats() || {};
        var w = ms.working || {};
        numsEl.innerHTML =
          '<span class="kolob-board-card">' + motifName(w.theme || "𐐀") + (w.gen ? "·" + w.gen : "") + '</span>' +
          '<span class="kolob-board-card">' + (ms.developments || 0) + '</span>' +
          '<span class="kolob-board-card">' + (ms.answers || 0) + '</span>';
      } else {
        numsEl.innerHTML = '<span class="kolob-board-card">—</span>';
      }
    }
  }

  function poll() {
    var playing = !!(K.isPlaying && K.isPlaying());
    var playBtn = document.getElementById("kolob-play");
    if (playBtn) playBtn.classList.toggle("is-playing", playing);
    var scene = document.querySelector(".kolob-scene");
    var c = (K.getConductor && K.getConductor()) || {};
    if (scene) {
      scene.classList.toggle("is-sacrament", !!(playing && c.section === "sacrament"));
      scene.classList.toggle("is-hush", !!(playing && c.hush));
      scene.classList.toggle("is-dev", latinMode);
    }
    updateTelemetry(c, playing);
    updateOrder(c, playing);
    updateBoard(c, playing);
    flushPhraseLog();
    if (window.KolobViz && window.KolobViz.setConductor) window.KolobViz.setConductor(c, playing);
  }
  setInterval(poll, 300);

  // ==========================================================================
  // Transport + gather (reseed & restart)
  // ==========================================================================
  function wireTransport() {
    var playBtn = document.getElementById("kolob-play");
    var stopBtn = document.getElementById("kolob-stop");
    var vol = document.getElementById("kolob-master-vol");
    var gather = document.getElementById("kolob-gather");
    var seedInput = document.getElementById("kolob-seed-input");

    if (playBtn) playBtn.addEventListener("click", function () {
      clearLog(); K.play(); playBtn.classList.add("is-playing");
      if (window.KolobText) window.KolobText.init(K.getSeed());
      if (broadsideTimer) clearTimeout(broadsideTimer);
      broadsideTimer = setTimeout(broadsideTick, 12000);
    });
    if (stopBtn) stopBtn.addEventListener("click", function () {
      K.stop(); if (playBtn) playBtn.classList.remove("is-playing");
      if (broadsideTimer) { clearTimeout(broadsideTimer); broadsideTimer = null; }
    });
    if (vol) vol.addEventListener("input", function () {
      K.setMasterVolume(parseInt(vol.value, 10) / 100);
    });
    if (gather) gather.addEventListener("click", function () {
      var v = seedInput ? parseInt(seedInput.value, 10) : NaN;
      if (isNaN(v)) v = Math.floor(Math.random() * 4294967295);
      var wasPlaying = !!(K.isPlaying && K.isPlaying());
      if (wasPlaying) K.stop();
      K.reseed(v);
      if (window.KolobText) window.KolobText.init(v);
      if (seedInput) seedInput.value = "";
      clearLog();
      if (wasPlaying) {
        // let the stop-fade complete before the new meeting is called
        setTimeout(function () { K.play(); }, 950);
      }
    });
    if (seedInput) seedInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && gather) { e.preventDefault(); gather.click(); }
    });
  }

  // ==========================================================================
  // Dev Latin toggle — static page furniture in both scripts
  // ==========================================================================
  var STATIC_DS = {
    title: "𐐗𐐄𐐢𐐉𐐒",
    subtitle: "𐐊 𐐐𐐆𐐣 𐐇𐐤𐐖𐐆𐐤 𐐈𐐓 𐐜 𐐡𐐆𐐣 𐐊𐐚 𐐜 𐐢𐐌𐐓",
    ives: "𐐌𐐚𐐞",
    whole: "𐐐𐐄𐐢",
    art: "𐐂𐐡𐐓",
    placeholder: "𐑄 𐑂𐐰𐑊𐐮 𐐮𐑆 𐑅𐐻𐐮𐑊",
    pressPlay: "𐐑𐐡𐐇𐐝 𐐑𐐢𐐁",
  };
  var STATIC_EN = {
    title: "KOLOB",
    subtitle: "a hymn engine at the rim of the light",
    ives: "Ives",
    whole: "Whole",
    art: "art",
    placeholder: "the valley is still",
    pressPlay: "PRESS PLAY",
  };
  function applyScript() {
    var S = TT(STR, STR_EN), ST = TT(STATIC_DS, STATIC_EN);
    function setText(sel, txt) { var el = document.querySelector(sel); if (el) el.textContent = txt; }
    setText(".kolob-title", ST.title);
    setText(".kolob-subtitle", ST.subtitle);
    setText(".kolob-order-block .kolob-sec-head", S.orderOfService);
    setText(".kolob-board-block .kolob-sec-head", S.hymnBoard);
    setText(".kolob-stops-block .kolob-sec-head", S.theStops);
    setText(".kolob-broadside-block .kolob-sec-head", S.broadside);
    setText(".kolob-log-block .kolob-sec-head", S.minutes);
    setText("#kolob-art-link", ST.art);
    var ivesBtn = document.getElementById("kolob-ives");
    if (ivesBtn) { ivesBtn.textContent = ST.ives; ivesBtn.classList.toggle("is-deseret", !latinMode); }
    var cumBtn = document.getElementById("kolob-cumulative");
    if (cumBtn) { cumBtn.textContent = ST.whole; cumBtn.classList.toggle("is-deseret", !latinMode); }
    setText("#kolob-gather", S.gather);
    setText(".kolob-transport .kolob-ctl-label", S.vol);
    setText(".kolob-board .kolob-ctl-label", S.seed);
    var playBtn = document.getElementById("kolob-play");
    if (playBtn) playBtn.innerHTML = '<span class="kolob-btn-glyph">&#9654;&#xFE0E;</span>&nbsp; ' + S.play;
    var stopBtn = document.getElementById("kolob-stop");
    if (stopBtn) stopBtn.innerHTML = '<span class="kolob-btn-glyph kolob-glyph-stop">&#9632;&#xFE0E;</span>&nbsp; ' + S.stop;
    var empty = document.querySelector("#kolob-log .kolob-log-empty");
    if (empty) empty.textContent = ST.pressPlay;
    if (lastBroadside) setBroadside(lastBroadside, false);
    else setText("#kolob-broadside-line", ST.placeholder);
    var tog = document.getElementById("kolob-latin");
    if (tog) {
      // The toggle names the OTHER script, written in that script: in Deseret
      // mode it offers "Latin" (Latin letters); in Latin mode it offers the
      // Deseret word for Deseret (𐐔𐐇𐐞𐐊𐐡𐐇𐐓). Each alphabet names itself.
      tog.textContent = latinMode ? "𐐔𐐇𐐞𐐊𐐡𐐇𐐓" : "Latin";
      tog.setAttribute("aria-label", latinMode ? "switch to the Deseret alphabet" : "switch to the Latin alphabet");
      tog.classList.toggle("is-deseret", latinMode);
    }
  }
  // Dev aid: with the Latin toggle on, the printed program becomes a jump
  // menu — click a line of the order of service to skip the meeting there.
  function wireOrderSkip() {
    var host = document.getElementById("kolob-order");
    if (!host) return;
    host.addEventListener("click", function (e) {
      if (!latinMode) return;                                 // inert for the congregation
      var row = e.target.closest ? e.target.closest(".kolob-order-row") : null;
      if (!row) return;
      var sec = row.getAttribute("data-sec");
      if (sec && K.skipToSection && K.isPlaying && K.isPlaying()) K.skipToSection(sec);
    });
  }

  function wireLatinToggle() {
    var tog = document.getElementById("kolob-latin");
    if (!tog) return;
    tog.addEventListener("click", function () {
      latinMode = !latinMode;
      try { localStorage.setItem("kolobLatin", latinMode ? "1" : "0"); } catch (e) {}
      applyScript();
      renderMixer();
      var order = document.getElementById("kolob-order");
      if (order) order.innerHTML = "";                        // rebuilt in the new script on next poll
      poll();
    });
  }

  // ==========================================================================
  // Visualizer hand-off
  // ==========================================================================
  function initViz() {
    var canvas = document.getElementById("kolob-viz");
    var dial = document.getElementById("kolob-dial");
    var organ = document.getElementById("kolob-organ");
    if (window.KolobViz && typeof window.KolobViz.init === "function") {
      try { window.KolobViz.init(canvas, dial, organ); }
      catch (e) { if (window.console) console.error("Kolob viz init failed", e); }
    }
  }

  // ==========================================================================
  // The Ives switch — while armed, every meeting is guaranteed one visitation
  // (the unanswered question or the two bands). Arming it mid-meeting
  // restarts the meeting so the guarantee begins counting immediately.
  // ==========================================================================
  function wireIvesToggle() {
    var btn = document.getElementById("kolob-ives"); if (!btn) return;
    var on = false;
    try { on = localStorage.getItem("kolobIves") === "1"; } catch (e) {}
    function apply() {
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (K.setForceVisitation) K.setForceVisitation(on);
    }
    apply();
    btn.addEventListener("click", function () {
      on = !on;
      try { localStorage.setItem("kolobIves", on ? "1" : "0"); } catch (e) {}
      apply();
      if (on && K.isPlaying && K.isPlaying()) {
        // restart: stop fully settles (its 800ms layer-zeroing included),
        // then the meeting is called again with the guarantee armed
        K.stop();
        setTimeout(function () { K.play(); }, 900);
      }
    });
  }

  // ==========================================================================
  // The Whole switch — the cumulative-form governor. Cycles on click:
  // guaranteed (solid gilt) → natural 4% (outline) → never (struck) → …
  // Switching TO guaranteed restarts the meeting (the Ives-switch pattern);
  // the other states take effect at the next meeting without a restart.
  // ==========================================================================
  function wireCumulativeToggle() {
    var btn = document.getElementById("kolob-cumulative"); if (!btn) return;
    var mode = "natural";
    try {
      if (/[?&]kolobCumulative=1/.test(location.search)) mode = "always";
      else mode = localStorage.getItem("kolobCumulative") || "natural";
    } catch (e) {}
    if (mode !== "always" && mode !== "natural" && mode !== "never") mode = "natural";
    var LABELS = {
      always: "the tune withheld until the doxology — every meeting (restarts the meeting)",
      natural: "the tune withheld until the doxology — about one meeting in twenty-five",
      never: "the tune withheld until the doxology — off",
    };
    function apply() {
      btn.classList.toggle("is-always", mode === "always");
      btn.classList.toggle("is-never", mode === "never");
      btn.setAttribute("aria-pressed", mode === "always" ? "true" : "false");
      btn.setAttribute("aria-label", LABELS[mode]);
      if (K.setCumulativeMode) K.setCumulativeMode(mode);
    }
    apply();
    btn.addEventListener("click", function () {
      mode = mode === "always" ? "natural" : mode === "natural" ? "never" : "always";
      try { localStorage.setItem("kolobCumulative", mode); } catch (e) {}
      apply();
      if (mode === "always" && K.isPlaying && K.isPlaying()) {
        K.stop();
        setTimeout(function () { K.play(); }, 900);
      }
    });
  }

  renderMixer();
  wireTransport();
  wireLatinToggle();
  wireIvesToggle();
  wireCumulativeToggle();
  wireOrderSkip();
  applyScript();
  initViz();
  poll();
})();

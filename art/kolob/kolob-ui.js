// ============================================================================
// KOLOB — UI controller (running head + direction line + hymn board + the
// stops + clerk's minutes + broadside; the order of service is the WHEEL,
// drawn by the viz — this file only hands it the labels and the dev jump)
//
// EVERYTHING the reader sees is set in the DESERET ALPHABET. The engine emits
// typed events (SCORE.md §6); this file maps each type and its payload to a
// Deseret rendering (glyph + transliterated word + numerals) before anything
// is printed — it never reads the English labels the engine still sends. The
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
    pause: "𐐑𐐃𐐞",                        // PAUSE
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
    raspberry: "𐐡𐐈𐐞𐐒𐐇𐐡𐐆",              // RASPBERRY
    amenDash: "𐐁𐐣𐐇𐐤—",                  // AMEN—
    twoBands: "𐐓𐐅 𐐒𐐈𐐤𐐔𐐞",              // TWO BANDS
    bandFlag: "𐐜𐐊 𐐒𐐈𐐤𐐔",                // THE BAND (one band; "two bands" only when a second comes)
    bandNears: "𐐊 𐐒𐐈𐐤𐐔 𐐊𐐑𐐡𐐄𐐕𐐇𐐞",     // A BAND APPROACHES
    bandsCross: "𐐜 𐐒𐐈𐐤𐐔𐐞 𐐗𐐡𐐉𐐝",       // THE BANDS CROSS
    bandPasses: "𐐑𐐈𐐝𐐇𐐞 𐐉𐐤",            // PASSES ON
    theSteeples: "𐐜 𐐝𐐓𐐀𐐑𐐊𐐢𐐞 𐐈𐐤𐐝𐐊𐐡",  // THE STEEPLES ANSWER
    lastBell: "𐐜 𐐢𐐈𐐝𐐓 𐐒𐐇𐐢",           // THE LAST BELL
    steeplesFlag: "𐐝𐐓𐐀𐐑𐐊𐐢𐐞",           // STEEPLES
    oldTune: "𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤 𐐡𐐆𐐣𐐇𐐣𐐒𐐊𐐡𐐔", // AN OLD TUNE REMEMBERED
    oldTuneFlag: "𐐊𐐤 𐐄𐐢𐐔 𐐓𐐅𐐤",          // AN OLD TUNE (the direction line)
    memoryOut: "𐐜 𐐣𐐇𐐣𐐊𐐡𐐆 𐐘𐐆𐐚𐐞 𐐍𐐓",   // THE MEMORY GIVES OUT
    trombonesDawn: "𐐓𐐡𐐉𐐣𐐒𐐄𐐤𐐞 𐐈𐐓 𐐔𐐃𐐤",   // TROMBONES AT DAWN (the row, and the direction line)
    nearAnswers: "𐐜 𐐤𐐀𐐡 𐐗𐐎𐐌𐐊𐐡 𐐈𐐤𐐝𐐊𐐡𐐞", // THE NEAR CHOIR ANSWERS
    twoChoirs: "𐐜 𐐓𐐅 𐐗𐐎𐐌𐐊𐐡𐐞 𐐓𐐊𐐘𐐇𐐜𐐊𐐡", // THE TWO CHOIRS TOGETHER
    tuneWithheld: "𐐜 𐐓𐐅𐐤 𐐆𐐞 𐐎𐐆𐐛𐐐𐐇𐐢𐐔", // THE TUNE IS WITHHELD
    wholeTune: "𐐜 𐐐𐐄𐐢 𐐓𐐅𐐤 𐐈𐐓 𐐢𐐈𐐝𐐓",  // THE WHOLE TUNE, AT LAST
    wholeFlag: "𐐜 𐐐𐐄𐐢 𐐓𐐅𐐤",            // THE WHOLE TUNE (telemetry)
    // (round 3b, step 3: the handbells, the singing school, a round, the partner hymn, the refrain)
    handbells: "𐐜 𐐐𐐈𐐤𐐔𐐒𐐇𐐢𐐞",          // THE HANDBELLS
    cascade: "𐐜 𐐗𐐈𐐝𐐗𐐁𐐔",               // THE CASCADE
    singingSchool: "𐐜 𐐝𐐆𐐥𐐆𐐥 𐐝𐐗𐐅𐐢",     // THE SINGING SCHOOL
    stopsThem: "𐐜 𐐗𐐃𐐡𐐆𐐝𐐓𐐊𐐡 𐐝𐐓𐐉𐐑𐐝 𐐜𐐇𐐣", // THE CHORISTER STOPS THEM
    onTheNotes: "𐐉𐐤 𐐜 𐐤𐐄𐐓𐐝",            // ON THE NOTES
    again: "𐐊𐐘𐐇𐐤",                        // AGAIN
    aRound: "𐐝𐐊𐐥 𐐈𐐞 𐐊 𐐡𐐍𐐤𐐔",           // SUNG AS A ROUND
    againstIt: "𐐜 𐐙𐐊𐐡𐐝𐐓 𐐐𐐆𐐣 𐐊𐐘𐐇𐐤𐐝𐐓 𐐆𐐓", // THE FIRST HYMN AGAINST IT
    refrain: "𐐜 𐐡𐐆𐐙𐐡𐐁𐐤",               // THE REFRAIN
    // (round 3b, step 4: a rite's seating, and the drone's tune)
    linedOut: "𐐢𐐌𐐤𐐔 𐐍𐐓 𐐄𐐤𐐢𐐀",          // LINED OUT ONLY
    brushArbor: "𐐒𐐡𐐊𐐟 𐐂𐐡𐐒𐐊𐐡",           // BRUSH ARBOR
    organVoluntary: "𐐃𐐡𐐘𐐊𐐤 𐐚𐐉𐐢𐐊𐐤𐐓𐐇𐐡𐐀",  // ORGAN VOLUNTARY
    choirAlone: "𐐜 𐐗𐐎𐐌𐐊𐐡 𐐊𐐢𐐄𐐤",         // THE CHOIR ALONE
    dronesTune: "𐐜 𐐔𐐡𐐄𐐤𐐞 𐐓𐐅𐐤",          // THE DRONE'S TUNE
    liahona: "𐐢𐐀𐐊𐐐𐐄𐐤𐐊",                // LIAHONA
    sample: "𐐝𐐈𐐣𐐑𐐊𐐢",                   // SAMPLE
    orderOfService: "𐐃𐐡𐐔𐐊𐐡 𐐊𐐚 𐐝𐐊𐐡𐐚𐐆𐐝", // ORDER OF SERVICE
    theStops: "𐐜 𐐆𐐤𐐝𐐓𐐡𐐊𐐣𐐊𐐤𐐓𐐝",         // THE INSTRUMENTS
    copyParams: "𐐗𐐃𐐑𐐆 𐐑𐐊𐐡𐐈𐐣𐐊𐐓𐐊𐐡𐐞",     // COPY PARAMETERS
    copied: "𐐗𐐃𐐑𐐆𐐔 ✓",                   // COPIED
    minutes: "𐐗𐐢𐐊𐐡𐐗𐐝 𐐣𐐆𐐤𐐆𐐓𐐝",         // CLERK'S MINUTES
    broadside: "𐐜 𐐒𐐡𐐃𐐔𐐝𐐌𐐔",            // THE BROADSIDE
    hymnBoard: "𐐐𐐆𐐣 𐐒𐐄𐐡𐐔",             // HYMN BOARD
    hymnNo: "𐐐𐐆𐐣",                        // HYMN (the board's number, and its row)
    // (round 3c: the new guests' rows and the direction line — spelled by
    // kolob-cast.js's deseretCaps, as the clerk spells)
    bandGoesBy: "𐐜𐐊 𐐒𐐈𐐤𐐔 𐐘𐐄𐐞 𐐒𐐌",        // THE BAND GOES BY
    secondBand: "𐐊 𐐝𐐇𐐗𐐊𐐤𐐔 𐐒𐐈𐐤𐐔 𐐊𐐑𐐡𐐄𐐕𐐆𐐞", // A SECOND BAND APPROACHES
    handcartCo: "𐐊 𐐐𐐈𐐤𐐔𐐗𐐂𐐡𐐓 𐐗𐐊𐐣𐐑𐐊𐐤𐐀",  // A HANDCART COMPANY
    allIsWell: "𐐃𐐢 𐐆𐐞 𐐎𐐇𐐢",               // ALL IS WELL
    handcartsPass: "𐐜𐐊 𐐐𐐈𐐤𐐔𐐗𐐂𐐡𐐓𐐝 𐐑𐐈𐐝",   // THE HANDCARTS PASS
    handcartFlag: "𐐜𐐊 𐐐𐐈𐐤𐐔𐐗𐐂𐐡𐐓𐐝",         // THE HANDCARTS
    gulls: "𐐘𐐊𐐢𐐞",                          // GULLS
    farTower: "𐐊 𐐙𐐂𐐡 𐐓𐐍𐐊𐐡 𐐡𐐆𐐥𐐞",          // A FAR TOWER RINGS
    thatsAll: "𐐜𐐈𐐓𐐝 𐐃𐐢",                   // THAT'S ALL (the ringers' call: rounds)
    variationsFlag: "𐐚𐐇𐐡𐐀𐐁𐐟𐐊𐐤𐐞",           // VARIATIONS
    tonguesFlag: "𐐜𐐊 𐐘𐐆𐐙𐐓 𐐊𐐚 𐐓𐐊𐐥𐐞",        // THE GIFT OF TONGUES
    wardHums: "𐐜𐐊 𐐎𐐃𐐡𐐔 𐐐𐐊𐐣𐐞",             // THE WARD HUMS
    harmoniumAnswers: "𐐜𐐊 𐐐𐐂𐐡𐐣𐐄𐐤𐐀𐐊𐐣 𐐈𐐤𐐝𐐊𐐡𐐞", // THE HARMONIUM ANSWERS
    farWard: "𐐜𐐊 𐐙𐐂𐐡 𐐎𐐃𐐡𐐔",               // THE FAR WARD
    socialHall: "𐐜𐐊 𐐝𐐄𐐟𐐊𐐢 𐐐𐐃𐐢",            // THE SOCIAL HALL
    benches: "𐐜𐐊 𐐒𐐇𐐤𐐕𐐆𐐞 𐐂𐐡 𐐑𐐋𐐟𐐓 𐐒𐐈𐐗",    // THE BENCHES ARE PUSHED BACK
    honour: "𐐉𐐤𐐊𐐡 𐐏𐐃𐐡 𐐑𐐂𐐡𐐓𐐤𐐊𐐡",          // HONOUR YOUR PARTNER
    theDance: "𐐜𐐊 𐐔𐐈𐐤𐐝",                  // THE DANCE
    homeAgain: "𐐃𐐢 𐐜𐐊 𐐎𐐁 𐐐𐐄𐐣",             // ALL THE WAY HOME
    applause: "𐐊𐐑𐐢𐐃𐐞",                     // APPLAUSE
    wordsTune: "𐐜𐐊 𐐎𐐊𐐡𐐔𐐞 𐐣𐐁𐐔 𐐊 𐐓𐐅𐐤",       // THE WORDS MADE A TUNE (the testimony's reed)
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
  // THE SUNDAY (round 3b, step 4): the programme card names the calendar's
  // Sunday — its Deseret is the calendar's own (KOLOB.Calendar.SUNDAYS[id].ds,
  // read from the conductor), these the Latin switch's
  var SUNDAYS_EN = { ordinary: "AN ORDINARY SUNDAY", fast: "FAST SUNDAY", conference: "GENERAL CONFERENCE", pioneer: "PIONEER DAY",
                     christmas: "CHRISTMAS", easter: "EASTER", wedding: "A WEDDING", funeral: "A FUNERAL", dedication: "A DEDICATION" };
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
  // per-event FIELD labels, keyed to the audio engine's field keys
  var FIELD_DS = { wind: "𐐎𐐆𐐤𐐔", crickets: "𐐗𐐡𐐆𐐗𐐇𐐓𐐝", clock: "𐐗𐐢𐐉𐐗", fork: "𐐓𐐅𐐤𐐆𐐥 𐐙𐐃𐐡𐐗", rain: "𐐡𐐁𐐤", coyote: "𐐗𐐌𐐄𐐓𐐆", bell: "𐐒𐐇𐐢", beacon: "𐐒𐐀𐐗𐐊𐐤" };
  var FIELD_EN = { wind: "WIND", crickets: "CRICKETS", clock: "CLOCK", fork: "TUNING FORK", rain: "RAIN", coyote: "COYOTE", bell: "BELL", beacon: "BEACON" };

  // ==========================================================================
  // DEV LATIN MODE — a development aid only. The piece speaks Deseret; this
  // switch (the tiny corner toggle, or ?latin=1) reveals the Latin labels so
  // the owner can debug. Persisted in localStorage.
  // ==========================================================================
  var STR_EN = {
    play: "PLAY", pause: "PAUSE", stop: "STOP", vol: "VOL", seed: "SEED", gather: "GATHER",
    meeting: "MEETING", hertz: "HERTZ", idle: "THE VALLEY IS STILL",
    listening: "THE MINUTES BEGIN", stillness: "STILLNESS", fuging: "FUGING",
    reprise: "REPRISE", develops: "DEVELOPS", disperses: "DISPERSES",
    answers: "ANSWERS", linesOut: "LINES OUT", shadows: "SHADOWS",
    theme: "THEME", hymnsOfDay: "THE DAY'S HYMNS", amen: "AMEN",
    verse: "VERSE", speaks: "SPEAKS", liahona: "LIAHONA", sample: "SAMPLE",
    raspberry: "RASPBERRY", amenDash: "AMEN—",
    twoBands: "TWO BANDS", bandFlag: "THE BAND", bandNears: "A BAND APPROACHES",
    linedOut: "LINED OUT ONLY", brushArbor: "BRUSH ARBOR", organVoluntary: "ORGAN VOLUNTARY", choirAlone: "THE CHOIR ALONE",
    dronesTune: "THE DRONE'S TUNE",
    bandsCross: "THE BANDS CROSS", bandPasses: "PASSES ON",
    theSteeples: "THE STEEPLES ANSWER", lastBell: "THE LAST BELL", steeplesFlag: "STEEPLES",
    oldTune: "AN OLD TUNE REMEMBERED", oldTuneFlag: "AN OLD TUNE", memoryOut: "THE MEMORY GIVES OUT",
    trombonesDawn: "TROMBONES AT DAWN", nearAnswers: "THE NEAR CHOIR ANSWERS", twoChoirs: "THE TWO CHOIRS TOGETHER",
    tuneWithheld: "THE TUNE IS WITHHELD", wholeTune: "THE WHOLE TUNE, AT LAST",
    wholeFlag: "THE WHOLE TUNE",
    handbells: "THE HANDBELLS", cascade: "THE CASCADE", singingSchool: "THE SINGING SCHOOL", stopsThem: "THE CHORISTER STOPS THEM",
    onTheNotes: "ON THE NOTES", again: "AGAIN", aRound: "SUNG AS A ROUND", againstIt: "THE FIRST HYMN AGAINST IT", refrain: "THE REFRAIN",
    orderOfService: "ORDER OF SERVICE", theStops: "THE INSTRUMENTS",
    copyParams: "COPY PARAMETERS", copied: "COPIED ✓",
    minutes: "CLERK'S MINUTES", broadside: "THE BROADSIDE", hymnBoard: "HYMN BOARD",
    hymnNo: "HYMN",
    bandGoesBy: "THE BAND GOES BY", secondBand: "A SECOND BAND APPROACHES",
    handcartCo: "A HANDCART COMPANY", allIsWell: "ALL IS WELL", handcartsPass: "THE HANDCARTS PASS", handcartFlag: "THE HANDCARTS",
    gulls: "GULLS", farTower: "A FAR TOWER RINGS", thatsAll: "THAT'S ALL", variationsFlag: "VARIATIONS",
    tonguesFlag: "THE GIFT OF TONGUES", wardHums: "THE WARD HUMS", harmoniumAnswers: "THE HARMONIUM ANSWERS", farWard: "THE FAR WARD",
    socialHall: "THE SOCIAL HALL", benches: "THE BENCHES ARE PUSHED BACK", honour: "HONOUR YOUR PARTNER", theDance: "THE DANCE",
    homeAgain: "ALL THE WAY HOME", applause: "APPLAUSE", wordsTune: "THE WORDS MADE A TUNE",
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
  var MOTIF_EN = { "Ⅰ": "I", "Ⅱ": "II", "Ⅲ": "III" };   // roman numerals in both scripts; ASCII in latin mode

  var latinMode = false;
  try {
    latinMode = /[?&]latin=1/.test(location.search) || localStorage.getItem("kolobLatin") === "1";
  } catch (e) {}
  // Dev preview (?kolobPreview=1): with the engine idle, the running head and
  // the direction line show a sample conductor so the dressed page can be seen
  // (and screenshotted) without audio. The real conductor always wins once the
  // engine plays. Mirrors the ?latin=1 switch; not persisted.
  var previewMode = false;
  try { previewMode = /[?&]kolobPreview=1/.test(location.search); } catch (e) {}
  var PREVIEW_CONDUCTOR = { meeting: 3, section: "hymn", meter: "CM", activity: "conference", sunday: { id: "conference", nameDs: "𐐖𐐇𐐤𐐊𐐡𐐊𐐢 𐐗𐐉𐐤𐐙𐐡𐐇𐐤𐐝" }, mode: "mixolydian", f0: 65.4, fuging: true };
  function TT(dsTable, enTable) { return latinMode ? enTable : dsTable; }
  // gesture ciphers run 𐐀..𐐚 (the Deseret alphabet from its first letter);
  // the Latin equivalents run A..Z then & — the schoolroom's own 27th letter
  function gestureLatin(ds) {
    if (!ds) return "—";
    var i = ds.codePointAt(0) - 0x10400;
    return i >= 0 && i < 27 ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ&".charAt(i) : ds;
  }
  function motifName(n) {
    if (!latinMode) return n;
    return String(n).replace(/[ⅠⅡⅢ]/g, function (ch) { return MOTIF_EN[ch] || ch; });
  }

  // ==========================================================================
  // Deseret rendering of engine events → the clerk's minutes.
  // Returns null to omit an event entirely (harmony chatter, etc.).
  //
  // TYPED (round 2, milestone 3): every row is chosen by the event's TYPE and
  // written from its payload (SCORE.md §6; the words are KOLOB.Score.EVENTS)
  // — never by reading the English label, which the engine still sends
  // alongside for its dev tools. Each row keeps the class v0.32's category
  // gave it (the gilt glyphs of the Liahona, the fuging, the guests and the
  // meeting; the motif's ink), so the minutes look exactly as they did. A
  // guest the minutes may not name (logged: false — the Hosanna) prints
  // nothing, whatever it sends.
  // ==========================================================================
  // a guest's moments, by guest and stage → [glyph, the string's key]
  var GUEST_ROWS = {
    bands:     { approaches: ["⇋", "bandNears"], cross: ["⇋", "bandsCross"], passes: ["⇋", "bandPasses"] },
    steeples:  { answer: ["◎", "theSteeples"], "last-bell": ["◎", "lastBell"] },
    oldtune:   { remembered: ["✧", "oldTune"], "gives-out": ["✧", "memoryOut"] },
    trombones: { far: ["♪", "trombonesDawn"], answer: ["♪", "nearAnswers"], together: ["♪", "twoChoirs"] },
    assembly:  { withheld: ["◌", "tuneWithheld"], "whole-tune": ["✶", "wholeTune"] },
    // (round 3b, step 3) the ward's handbell choir: its first sound, and the
    // cascade; the singing school: the fork, the stop, the part alone, again
    handbells: { ring: ["♫", "handbells"], cascade: ["♫", "cascade"] },
    singingschool: { fork: ["♪", "singingSchool"], cut: ["♪", "stopsThem"], alone: ["♪", "onTheNotes"], again: ["♪", "again"] },
    raspberry: { blat: ["∴", "raspberry"], amen: ["∴", "amenDash"] },
    // (round 3c) the Nauvoo band (a second band; "cross" is the band going by,
    // or the bands crossing — dsEvent reads which); the handcart company; the
    // gulls; change ringing from a far tower (the steeples' variant); the gift
    // of tongues (the rise is the singer's own ✦ row, by name); the far ward;
    // the Social Hall. The organist's variations speak through the organist's
    // own rows (ORGANIST_ROW); the Hosanna writes nothing
    handcart:  { approaches: ["⇋", "handcartCo"], sings: ["♪", "allIsWell"], passes: ["⇋", "handcartsPass"] },
    gulls:     { gulls: ["∿", "gulls"] },
    tongues:   { "the ward hums": ["✦", "wardHums"], "the harmonium": ["✦", "harmoniumAnswers"] },
    farward:   { verse: ["♪", "farWard"] },
    socialhall: { benches: ["✦", "benches"], honour: ["✦", "honour"], A: ["✦", "theDance"], final: ["✦", "homeAgain"], applause: ["✦", "applause"] },
  };
  GUEST_ROWS.bands.second = ["⇋", "secondBand"];
  GUEST_ROWS.steeples["changes:rounds"] = ["◎", "farTower"];
  GUEST_ROWS.steeples["changes:round"] = ["◎", "thatsAll"];
  var ROMAN_MOTIF = { "Ⅰ": 1, "Ⅱ": 1, "Ⅲ": 1 };
  function minute(glyph, text, cls) { return { glyph: glyph, text: text, cls: cls }; }
  // (round 3b) the ward's people in the minutes: a name set in the clerk's
  // capitals (the Deseret small letters are the capitals + 0x28), and the
  // moments that earn a row — a person coming forward; not their stepping
  // back, nor the precentor's line-by-line (his ☞ row says it)
  function capsDs(s) {
    return String(s || "").replace(/[\u{10428}-\u{1044F}]/gu, function (ch) { return String.fromCodePoint(ch.codePointAt(0) - 0x28); });
  }
  var FORWARD_ROW = { "keys the hymn": 1, "hums the first note": 1, "pitches the tune": 1, "comes forward": 1, "sings the descant": 1,
                      "sings the treble verse": 1, "sings the tune": 1, "loses the words": 1, "finds them again": 1, "joins in": 1, "sings out": 1,
                      // (round 3b, step 3: the refrain begun, the quartet, the Primary, a round set going, the cornet against the partner)
                      "starts the refrain": 1, "leads the quartet": 1, "leads the Primary": 1, "sets the round going": 1, "plays the first hymn on the cornet": 1,
                      // (round 3b, step 4: a verse given to the men, or to the women)
                      "gives the verse to the men": 1, "gives the verse to the women": 1,
                      // (round 3c: a testimony-bearer rises; the Social Hall's fiddler and caller; one rises and sings in tongues)
                      "rises to bear testimony": 1, "takes up the fiddle": 1, "calls the dance": 1, "rises and sings in tongues": 1 };
  // (round 3b, step 4) a rite's seating in the minutes — the plain house
  // gives none
  var SCENE_ROW = { lined: "linedOut", arbor: "brushArbor", voluntary: "organVoluntary", choir: "choirAlone" };
  // (round 3b, step 2) the organist's moments that earn a row: the chorale
  // prelude, the walk into a new key, a fill between the lines, the strange
  // key, a line left to the ward — not every stop drawn, nor the giving-out
  // (the hymn's own rows say it has begun)
  var ORGANIST_ROW = { "plays the day's first hymn as a prelude": 1, "puts the tune in the pedals": 1, "lets the flutes run in another key": 1,
                       "modulates to the next hymn's key": 1, "links the lines": 1, "holds a note over into the next line": 1, "echoes the line on the echo flute": 1,
                       "quotes the next line between the lines": 1, "turns an arabesque between the lines": 1, "runs a sequence between the lines": 1,
                       "strays into a strange key": 1, "lifts both hands; the ward sings a line alone": 1, "plays the first hymn against it": 1,
                       // (round 3c: the organist's variations on a hymn, character by character)
                       "plays variations on the hymn": 1, "plays the hymn as a plain chorale": 1, "turns the tune into a minuet": 1, "turns the tune into a polonaise": 1,
                       "turns the tune into a march": 1, "sets the tune in canon": 1, "plays the tune in two keys at once": 1, "gives the hymn on the full organ": 1 };
  function actionKey(a) { return String(a || "").replace(/ \(.*\)$/, ""); }
  function layerName(l) { return TT(LAYERS_DS, LAYERS_EN)[l] || l; }
  function dsEvent(ev) {
    if (!ev || ev.logged === false) return null;             // the unlogged guest: not a word
    var S = TT(STR, STR_EN);
    switch (ev.type) {
      case "meeting-start": return minute("☀", S.meeting + (ev.n != null ? " " + ev.n : "") + (ev.sunday ? " · " + (latinMode ? SUNDAYS_EN[ev.sunday] || ev.sunday.toUpperCase() : ev.sundayDs || "") : ""), "meeting");
      case "scene":         return SCENE_ROW[ev.scene] ? minute("⌖", (TT(SECTIONS_DS, SECTIONS_EN)[ev.section] || ev.section) + " · " + S[SCENE_ROW[ev.scene]], "section") : null;
      case "drone-turn":    return ev.dox ? minute("∿", S.dronesTune, "liahona") : null;   // (the drone home under the doxology: the tune it has spelled; its other turns write no row)
      case "sunrise":       return minute("☀", S.meeting, "meeting");          // (v0.32: a sunrise is a meeting's row without its number)
      case "section-start": return minute("§", TT(SECTIONS_DS, SECTIONS_EN)[ev.section] || ev.section, "section");
      case "liahona":       return minute("⌖", S.liahona, "liahona");
      case "stillness":
      case "skip":          return minute("◦", S.stillness, "conductor");      // (v0.32 wrote the dev jump as a stillness too)
      case "joint":
      case "room-empties":  return minute("∴", S.amen, "cadence");
      case "fuging":        return minute("⁂", S.fuging, "fuging");
      case "telegraph":     return minute("⌁", LAYERS_DS.telegraph, "telegraph");
      case "phrase":        return minute("♮", layerName(ev.layer) + " " + S.speaks, "phrase");
      case "guest": {
        var g = GUEST_ROWS[ev.guest], st = g && g[ev.stage];
        // (round 3c: a lone band goes by; two bands cross — the band's own label says which)
        if (ev.guest === "bands" && ev.stage === "cross" && !/bands cross/.test(ev.label || "")) return minute("⇋", S.bandGoesBy, "visitation");
        return st ? minute(st[0], S[st[1]], "visitation") : null; // a guest the minutes do not know is not named as another
      }
      case "verse-line":                                     // (a line sung back to the deacon is his ☞ row's; it writes none of its own)
        // (a composed hymn's lines are told by its verses: one row a verse)
        if (ev.composed) return null;
        return ev.practice === "lined" ? null : minute("¶", S.verse + (ev.speechLine != null ? " " + ev.speechLine : ""), "verse");
      case "verse-start":                                    // (round 3: a composed hymn's verse — the motif couplets' stanzas keep their line rows)
        if (ev.refrain) return null;                         // (round 3b, step 3: the refrain has its own row)
        return ev.composed ? minute("¶", S.verse + " " + (ev.verse + 1), "verse") : null;
      case "round-entry":                                    // (round 3b, step 3: a hymn sung as a round — one row, as it begins)
        return ev.entry === 1 ? minute("⟳", S.aRound, "verse") : null;
      case "partner":                                        // (the partner hymn's last verse: the first hymn against it)
        return ev.combined ? minute("⚭", S.againstIt, "visitation") : null;
      case "refrain":                                        // (each statement of the wandering refrain)
        return minute("↺", S.refrain, "verse");
      case "hymn-announced":                                 // (round 3: the number and the Deseret name, as the board gives them)
        return ev.hymn && ev.hymn.number != null ? minute("№", S.hymnNo + " " + ev.hymn.number + (ev.hymn.nameDs ? " " + ev.hymn.nameDs : ""), "verse") : null;
      case "lining-out":                                     // (a composed hymn lined out: the deacon's row once a verse, at its first line)
        if (ev.composed && ev.line > 0) return null;
        // (round 3b: the ward's precentor lines out — his name, in the
        // minutes' capitals; the deacon's clarinet still lines out the
        // day's material around the hymns)
        return minute("☞", (ev.nameDs ? capsDs(ev.nameDs) : LAYERS_DS.clarinet) + " " + S.linesOut, "verse");
      case "cast":                                           // (round 3b: a person of the ward comes forward — their name and what they do)
        if (!ev.actionDs) return null;
        if (ev.memberId === "organist") {                    // (round 3b, step 2: the organist at the bench)
          if (!ORGANIST_ROW[actionKey(ev.action)]) return null;
          return minute("✦", capsDs(ev.nameDs) + " " + (latinMode ? actionKey(ev.action).toUpperCase() : ev.actionDs), "verse");
        }
        if (!FORWARD_ROW[ev.action]) return null;
        return minute("✦", capsDs(ev.nameDs) + " " + (latinMode ? String(ev.action).toUpperCase() : ev.actionDs), "verse");
      case "testimony":                                      // (round 3c: a bearer's words made a tune by the reed; the rise is the bearer's own ✦ row)
        return ev.stage === "tune" ? minute("♪", S.wordsTune, "motif") : null;
      case "field": {
        var fd = TT(FIELD_DS, FIELD_EN)[ev.field];
        return minute("⋆", fd || TT(LAYERS_DS, LAYERS_EN).ambient, "ambient");
      }
      case "motif-reprise": return minute("✸", S.reprise + " " + motifName(ev.name), "motif");
      case "motif-answer":  return minute("⇄", layerName(ev.voice) + " " + S.answers + " " + layerName(ev.from), "motif");
      case "motif-shadow":  return minute("〰", LAYERS_DS.harmonium + " " + S.shadows, "motif");
      case "motif-disperse": return minute("࿙", S.disperses, "motif");
      case "hymns-of-the-day": return minute("❁", S.hymnsOfDay, "motif");
      case "motif-develop":
        return ROMAN_MOTIF[ev.name] && ev.gen != null
          ? minute("◆", motifName(ev.name) + "·" + ev.gen + " " + S.develops, "motif")
          : minute("◆", S.develops, "motif");
      case "transport":
        if (ev.action === "play") return minute("▶", S.meeting, "transport");
        if (ev.action === "stop") return minute("■", S.idle, "transport");
        if (ev.action === "sample") return minute("◈", S.sample + " " + (TT(LAYERS_DS, LAYERS_EN)[ev.layer] || ""), "transport");
        return null;
    }
    return null;                                              // chords, cadences, spans: the page stays open
  }

  // ==========================================================================
  // The stops (mixer) — one drawknob + one slider per layer. Nothing more.
  // The airy console: no rate sliders, no parameter drawers.
  // ==========================================================================
  // one control row: a drawknob (mute), a name (audition), and a volume slider.
  function mixerRow(name, label, vol, kind, maxGain) {
    // kind: "layer" or "field" — chooses which engine call the controls drive.
    // maxGain: the gain the slider's full travel (100%) maps to (default 1.0).
    // Every slider stays an ordinary 0–100%; maxGain just sets what "full" means
    // for that row. The field events author at unity yet want room to be turned
    // UP, so they pass maxGain 2.0 — full reaches twice the default, which
    // therefore rests at the midpoint, free to move either way. The scale rides
    // along in data-scale so the input handler can convert back to a gain.
    maxGain = maxGain || 1;
    var pct = Math.max(0, Math.min(100, Math.round(vol / maxGain * 100)));
    return '<div class="kolob-stop">' +
      '<button type="button" class="kolob-drawknob" data-' + kind + '="' + name + '" aria-label="' + name + ' on or off" aria-pressed="true"></button>' +
      '<button type="button" class="kolob-stop-name" data-sample-' + kind + '="' + name + '" aria-label="audition ' + name + '">' + label + '</button>' +
      '<input type="range" class="kolob-range" min="0" max="100" value="' + pct + '" data-vol-' + kind + '="' + name + '" data-scale="' + maxGain + '" aria-label="' + name + ' volume" />' +
      '</div>';
  }
  function renderMixer() {
    var host = document.getElementById("kolob-layers"); if (!host) return;
    var layers = K.getLayers ? K.getLayers() : [];
    var volumes = K.getVolumes ? K.getVolumes() : {};
    var fieldKeys = K.getFieldKeys ? K.getFieldKeys() : [];
    var fieldVols = K.getFieldVolumes ? K.getFieldVolumes() : {};
    var html = "";
    // the instruments (every layer but the FIELD bus, which splits into events)
    layers.forEach(function (layer) {
      if (layer === "ambient") return;
      var vol = volumes[layer] != null ? volumes[layer] : 0.5;
      html += mixerRow(layer, TT(LAYERS_DS, LAYERS_EN)[layer] || layer, vol, "layer");
    });
    // the FIELD, now one control per event
    if (fieldKeys.length) {
      html += '<div class="kolob-field-head">' + (TT(LAYERS_DS, LAYERS_EN).ambient || "FIELD") + '</div>';
      fieldKeys.forEach(function (key) {
        var vol = fieldVols[key] != null ? fieldVols[key] : 1;
        html += mixerRow(key, TT(FIELD_DS, FIELD_EN)[key] || key, vol, "field", 2);
      });
    }
    host.innerHTML = html;

    host.querySelectorAll("[data-vol-layer]").forEach(function (el) {
      el.addEventListener("input", function () { K.setLayerVolume(el.getAttribute("data-vol-layer"), parseInt(el.value, 10) / 100 * (parseFloat(el.getAttribute("data-scale")) || 1)); });
    });
    host.querySelectorAll("[data-vol-field]").forEach(function (el) {
      el.addEventListener("input", function () { K.setFieldVolume(el.getAttribute("data-vol-field"), parseInt(el.value, 10) / 100 * (parseFloat(el.getAttribute("data-scale")) || 1)); });
    });
    host.querySelectorAll("[data-layer]").forEach(function (el) {
      el.addEventListener("click", function () {
        var on = K.toggleLayer(el.getAttribute("data-layer"));
        el.classList.toggle("is-off", !on); el.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    host.querySelectorAll("[data-field]").forEach(function (el) {
      el.addEventListener("click", function () {
        var on = K.toggleField(el.getAttribute("data-field"));
        el.classList.toggle("is-off", !on); el.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
    host.querySelectorAll("[data-sample-layer]").forEach(function (el) {
      el.addEventListener("click", function () { if (K.sample) K.sample(el.getAttribute("data-sample-layer")); });
    });
    host.querySelectorAll("[data-sample-field]").forEach(function (el) {
      el.addEventListener("click", function () { if (K.sample) K.sample("field:" + el.getAttribute("data-sample-field")); });
    });
  }
  // ---- the copy-parameters button + the collapsible panel --------------------
  function currentParamsText() {
    var vols = K.getVolumes ? K.getVolumes() : {};
    var fvols = K.getFieldVolumes ? K.getFieldVolumes() : {};
    function fmt(o) {
      return Object.keys(o).map(function (k) { return k + ": " + Math.round(o[k] * 100) / 100; }).join(", ");
    }
    return "layerVolumes = { " + fmt(vols) + " };\nfieldVolumes = { " + fmt(fvols) + " };";
  }
  function wireInstrumentsPanel() {
    var head = document.getElementById("kolob-instruments-head");
    var body = document.getElementById("kolob-instruments-body");
    if (head && body) {
      head.addEventListener("click", function () {
        var open = head.getAttribute("aria-expanded") !== "false";
        head.setAttribute("aria-expanded", open ? "false" : "true");
        body.hidden = open;
      });
    }
    var copy = document.getElementById("kolob-copy-params");
    if (copy) {
      copy.addEventListener("click", function () {
        var text = currentParamsText();
        var done = function () {
          var label = copy.querySelector(".kolob-copy-label") || copy;
          var prev = label.textContent;
          label.textContent = TT(STR, STR_EN).copied;
          setTimeout(function () { label.textContent = prev; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, done);
        } else {
          try { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); } catch (e) {}
          done();
        }
      });
    }
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
    noteHymn(ev);
    var log = document.getElementById("kolob-log"); if (!log) return;
    noteGuest(ev);
    var d = dsEvent(ev);
    if (!d) return;
    var empty = log.querySelector(".kolob-log-empty"); if (empty) empty.remove();
    var row = document.createElement("div");
    row.className = "kolob-log-row cat-" + (d.cls || "conductor");
    row.innerHTML =
      '<span class="kolob-log-time">' + fmtTime(ev.t || 0) + '</span>' +
      '<span class="kolob-log-glyph">' + d.glyph + '</span>' +
      '<span class="kolob-log-text">' + d.text + '</span>';
    log.insertBefore(row, log.firstChild);
    while (log.children.length > LOG_CAP) log.removeChild(log.lastChild);
  }
  if (K.setEventListener) K.setEventListener(logEvent);

  // THE UNLOGGED GUESTS (SCORE §6: logged: false — the Hosanna "just
  // happens, low-key": no row in the minutes, no direction on the board).
  // The engine does not tell the conductor's poll about such a guest; the
  // page keeps its own tally from the typed spans as well, so a guest that
  // says logged: false is never named here, whatever the poll says.
  var unloggedGuests = {};
  // THE HYMN ON THE BOARD (round 3) — from the typed hymn-announced: its
  // number, its Deseret name, its meter and its hymnist's name in Deseret
  // (SCORE §6). The English name is the composer's dev field and is never
  // shown, in either script; the board keeps the hymn up until the next is
  // announced, and clears when a meeting begins or the benches empty.
  var boardHymn = null;
  function noteHymn(ev) {
    if (!ev) return;
    if (ev.type === "hymn-announced" && ev.hymn && ev.hymn.number != null) boardHymn = ev.hymn;
    else if (ev.type === "meeting-start" || (ev.type === "transport" && ev.action === "stop")) boardHymn = null;
  }
  function noteGuest(ev) {
    if (!ev || (ev.type !== "guest-start" && ev.type !== "guest-end")) return;
    if (ev.type === "guest-start" && ev.logged === false) unloggedGuests[ev.guest] = true;
    if (ev.type === "guest-end") delete unloggedGuests[ev.guest];
  }

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
  // the tuba is never named here: his moment is logged as RASPBERRY instead;
  // the visiting band, the old tune and the trombones at dawn write their
  // own minutes (their visitation events)
  var PHRASE_SKIP = { drone: 1, ambient: 1, telegraph: 1, tuba: 1, band: 1, oldtune: 1, trombones: 1 };
  // (and a layer the minutes have no name for is not written in English;
  // a note an unlogged guest sounds — logged: false — writes no row)
  function onNoteForLog(n) {
    if (!n || !n.layer || PHRASE_SKIP[n.layer] || !LAYERS_DS[n.layer] || n.logged === false) return;
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
      if (p.at > now - 3) logEvent({ type: "phrase", t: p.at, layer: p.layer });
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

  // The programme card on the hymn board — what the running head used to say:
  //   day    ORDINARY           (letterspaced capitals; idle: THE VALLEY IS STILL)
  //   line   Ionian · 8.6.8.6   (the meter dots only during a hymn), then the
  //          direction as a gilt rubric (updateDirection below)
  // The section is not named here: the wheel names it. Latin mode sets the
  // mode in title case, as a hymnal prints it; Deseret has no case.
  var SEP = '<span class="t-sep">·</span>';
  function joinParts(parts) { return parts.filter(Boolean).join(SEP); }
  function titleCase(s) { return s ? s.charAt(0) + s.slice(1).toLowerCase() : s; }
  function updateRunningHead(c, playing) {
    var day = document.getElementById("kolob-rh-left");
    var mm = document.getElementById("kolob-rh-mm");
    if (!day || !mm) return;
    var prog = document.getElementById("kolob-running-head");
    if (prog) {
      prog.classList.toggle("is-live", !!playing);
      prog.classList.toggle("is-deseret", !latinMode);
    }
    if (!playing) {
      day.textContent = TT(STR, STR_EN).idle;
      mm.textContent = "";
      return;
    }
    // (round 3b, step 4: the calendar's Sunday — the kind of meeting where a
    // page has no calendar)
    var sd = c.sunday && c.sunday.id ? (latinMode ? SUNDAYS_EN[c.sunday.id] : c.sunday.nameDs) : null;
    day.textContent = sd || TT(ACTIVITIES_DS, ACTIVITIES_EN)[c.activity] || "";
    var mode = TT(MODES_DS, MODES_EN)[c.mode] || "";
    // (the meter: a composed hymn's, as it was announced — typed — while its
    // section lasts; else the conductor's, during a hymn)
    var sings = c.section === "hymn" || c.section === "doxology";
    var meter = sings && boardHymn && boardHymn.meter ? boardHymn.meter : (c.section === "hymn" ? c.meter : null);
    mm.innerHTML = joinParts([
      latinMode ? titleCase(mode) : mode,
      meter ? metersDots(meter) : "",
    ]);
  }
  var METER_DOTS = { CM: "8.6.8.6", LM: "8.8.8.8", SM: "6.6.8.6", "87.87": "8.7.8.7", CMD: "8.6.8.6 ×2", "87.87D": "8.7.8.7 ×2", "76.76D": "7.6.7.6 ×2", "11s": "11.11.11.11", "10.10R": "10.10 ℟" };
  function metersDots(m) { return METER_DOTS[m] || m; }

  // The direction line — the event flag printed as a rubric on the programme
  // card, after the mode · meter line: stillness, fuging, two bands, the
  // steeples answer, an old tune, trombones at dawn, the whole tune. Empty
  // when nothing fires — and for a guest this table does not name (v0.32
  // called the old tune "two bands").
  var VISIT_FLAG = { bands: "twoBands", steeples: "theSteeples", oldtune: "oldTuneFlag", trombones: "trombonesDawn", assembly: "wholeFlag", handbells: "handbells", singingschool: "singingSchool",
                     // (round 3c; the far ward sings inside a hymn, whose own line the board keeps; the Hosanna is never named)
                     handcart: "handcartFlag", gulls: "gulls", variations: "variationsFlag", tongues: "tonguesFlag", socialhall: "socialHall" };
  function directionFor(c, playing) {
    if (!playing) return "";
    var S = TT(STR, STR_EN);
    if (c.hush) return S.stillness;
    if (c.fuging) return S.fuging;
    if (c.visit === "bands" && !c.twoBands) return S.bandFlag;   // (one band goes by; the flag was "two bands" for every band)
    if (c.visit) return VISIT_FLAG[c.visit] && !unloggedGuests[c.visit] ? S[VISIT_FLAG[c.visit]] : "";
    return "";
  }
  function updateDirection(c, playing) {
    var el = document.getElementById("kolob-direction"); if (!el) return;
    var txt = directionFor(c, playing);
    // lower case, as a direction is set (rit., a tempo); Deseret keeps its capitals
    if (latinMode) txt = txt.toLowerCase();
    if (el.textContent !== txt) el.textContent = txt;
  }

  // The order of service is the wheel (kolob-viz.js drawWheel); it reads the
  // conductor straight from the viz hand-off below. Its labels are set here,
  // in the current script, and refreshed when the script toggles.
  function updateWheelLabels() {
    if (!window.KolobViz || !window.KolobViz.setWheelLabels) return;
    var tbl = TT(SECTIONS_DS, SECTIONS_EN);
    window.KolobViz.setWheelLabels(
      SECTION_ORDER.map(function (sec) { return tbl[sec]; }),
      SECTION_ORDER.map(function (sec) { return SECTIONS_EN[sec]; }));
  }

  function updateBoard(c, playing) {
    var seedEl = document.getElementById("kolob-seed-current");
    if (seedEl && K.getSeed) seedEl.textContent = String(K.getSeed());
    var hymnEl = document.getElementById("kolob-board-hymn");
    if (hymnEl) {
      var hy = playing ? boardHymn : null, html = "";
      if (hy) {
        var SS = TT(STR, STR_EN);
        html = '<span class="kolob-board-n">' + SS.hymnNo + '<b>' + hy.number + '</b></span>' +
          (hy.nameDs ? '<span class="kolob-board-n kolob-board-name">' + hy.nameDs + '</span>' : '') +
          (hy.authorDs ? '<span class="kolob-board-n kolob-board-author">' + hy.authorDs + '</span>' : '');
        // (its meter is printed on the mode line above it, from the same event)
      }
      if (hymnEl.getAttribute("data-html") !== html) { hymnEl.innerHTML = html; hymnEl.setAttribute("data-html", html); }
    }
    var numsEl = document.getElementById("kolob-board-nums");
    if (numsEl) {
      if (playing && K.getMotifStats) {
        var ms = K.getMotifStats() || {};
        var w = ms.working || {};
        // the first card is the day's theme as its GESTURE cipher — a letter
        // that is permanently that tune-shape's, so it changes meeting to
        // meeting. Latin mode uses the matching Latin letter; the 27th
        // gesture takes "&", the schoolroom's own 27th letter (the alphabet
        // was recited "...X, Y, Z, and per se and" in the pioneers' day).
        var themeCard = latinMode ? gestureLatin(w.letter) : (w.letter || "—");
        var S = TT(STR, STR_EN);
        numsEl.innerHTML =
          '<span class="kolob-board-n" title="' + (w.gesture || "") + '">' + S.theme + '<b>' + themeCard + (w.gen ? "·" + w.gen : "") + '</b></span>' +
          '<span class="kolob-board-n">' + S.develops + '<b>' + (ms.developments || 0) + '</b></span>' +
          '<span class="kolob-board-n">' + S.answers + '<b>' + (ms.answers || 0) + '</b></span>';
      } else {
        numsEl.innerHTML = '<span class="kolob-board-n">—</span>';
      }
    }
  }

  function poll() {
    var playing = !!(K.isPlaying && K.isPlaying());
    var paused = playing && !!(K.isPaused && K.isPaused());
    var playBtn = document.getElementById("kolob-play");
    if (playBtn) { playBtn.classList.toggle("is-playing", playing); playBtn.classList.toggle("is-held", paused); }
    var pauseBtn = document.getElementById("kolob-pause");
    if (pauseBtn) { pauseBtn.classList.toggle("is-paused", paused); pauseBtn.setAttribute("aria-pressed", paused ? "true" : "false"); }
    var scene = document.querySelector(".kolob-scene");
    var c = (K.getConductor && K.getConductor()) || {};
    if (scene) {
      scene.classList.toggle("is-sacrament", !!(playing && c.section === "sacrament"));
      scene.classList.toggle("is-hush", !!(playing && c.hush));
      scene.classList.toggle("is-dev", latinMode);
    }
    // the head and the direction line: the real meeting, or — idle, in
    // preview — the sample conductor, so the dressed page can be seen
    var shown = playing, cc = c;
    if (!playing && previewMode) { shown = true; cc = PREVIEW_CONDUCTOR; }
    updateRunningHead(cc, shown);
    updateDirection(cc, shown);
    updateBoard(c, playing);
    flushPhraseLog();
    if (window.KolobViz && window.KolobViz.setConductor) window.KolobViz.setConductor(c, playing, paused);
    if (cat) cat.tick();                               // the band's caterpillar (wireCaterpillar, below)
  }
  var cat = null;
  setInterval(poll, 300);

  // ==========================================================================
  // Transport + gather (reseed & restart)
  // ==========================================================================
  function wireTransport() {
    var playBtn = document.getElementById("kolob-play");
    var pauseBtn = document.getElementById("kolob-pause");
    var stopBtn = document.getElementById("kolob-stop");
    var vol = document.getElementById("kolob-master-vol");
    var leverWrap = vol ? vol.parentNode : null;
    var gather = document.getElementById("kolob-gather");
    var seedInput = document.getElementById("kolob-seed-input");

    if (playBtn) playBtn.addEventListener("click", function () {
      // a held meeting resumes; otherwise a meeting is called
      if (K.isPlaying && K.isPlaying()) { if (K.resume) K.resume(); poll(); return; }
      clearLog(); K.play(); playBtn.classList.add("is-playing");
      if (window.KolobText) window.KolobText.init(K.getSeed());
      if (broadsideTimer) clearTimeout(broadsideTimer);
      broadsideTimer = setTimeout(broadsideTick, 12000);
    });
    // pause holds the meeting where it stands (the clock and every scheduled
    // cue freeze with it); a second press, or PLAY, lets it go on
    if (pauseBtn) pauseBtn.addEventListener("click", function () {
      if (!(K.isPlaying && K.isPlaying()) || !K.pause) return;
      if (K.isPaused && K.isPaused()) K.resume(); else K.pause();
      poll();
    });
    if (stopBtn) stopBtn.addEventListener("click", function () {
      K.stop(); if (playBtn) playBtn.classList.remove("is-playing");
      if (broadsideTimer) { clearTimeout(broadsideTimer); broadsideTimer = null; }
    });
    // the volume slider: the engine follows it, and the ink fill and the
    // hexagon thumb (--f, 0..1, read by kolob.css on the wrap) follow the
    // invisible native thumb
    function leverFill() {
      var f = (parseInt(vol.value, 10) - vol.min) / (vol.max - vol.min);
      (leverWrap || vol).style.setProperty("--f", String(Math.max(0, Math.min(1, f))));
    }
    if (vol) {
      leverFill();
      vol.addEventListener("input", function () {
        K.setMasterVolume(parseInt(vol.value, 10) / 100);
        leverFill();
      });
    }
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
    ives: "𐐌𐐚𐐞",
    whole: "𐐐𐐄𐐢",
    art: "𐐂𐐡𐐓",
    placeholder: "𐑄 𐑂𐐰𐑊𐐮 𐐮𐑆 𐑅𐐻𐐮𐑊",
    pressPlay: "𐐑𐐡𐐇𐐝 𐐑𐐢𐐁",
  };
  var STATIC_EN = {
    title: "KOLOB",
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
    setText(".kolob-stops-block .kolob-sec-head-label", S.theStops);
    setText("#kolob-copy-params .kolob-copy-label", S.copyParams);
    setText(".kolob-log-block .kolob-sec-head", S.minutes);
    var ivesBtn = document.getElementById("kolob-ives");
    if (ivesBtn) { ivesBtn.textContent = ST.ives; ivesBtn.classList.toggle("is-deseret", !latinMode); }
    var cumBtn = document.getElementById("kolob-cumulative");
    if (cumBtn) { cumBtn.textContent = ST.whole; cumBtn.classList.toggle("is-deseret", !latinMode); }
    setText("#kolob-gather", S.gather);
    setText(".kolob-transport .kolob-ctl-label", S.vol);
    setText(".kolob-board .kolob-ctl-label", S.seed);
    // the drawknobs carry a glyph only; the words go to their labels
    var playBtn = document.getElementById("kolob-play");
    if (playBtn) playBtn.setAttribute("aria-label", latinMode ? "play" : S.play);
    var pauseBtn = document.getElementById("kolob-pause");
    if (pauseBtn) pauseBtn.setAttribute("aria-label", latinMode ? "pause" : S.pause);
    var stopBtn = document.getElementById("kolob-stop");
    if (stopBtn) stopBtn.setAttribute("aria-label", latinMode ? "stop" : S.stop);
    var empty = document.querySelector("#kolob-log .kolob-log-empty");
    if (empty) empty.textContent = ST.pressPlay;
    if (lastBroadside) setBroadside(lastBroadside, false);
    else setText("#kolob-broadside-line", ST.placeholder);
    // the running head and the direction line: idle text now; poll() re-sets
    // them in the current script from the conductor (or the preview) at once
    setText("#kolob-rh-left", S.idle);
    setText("#kolob-rh-mm", "");
    setText("#kolob-direction", "");
    var prog = document.getElementById("kolob-running-head");
    if (prog) prog.classList.toggle("is-deseret", !latinMode);
    updateWheelLabels();
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
  // Dev aid: with the Latin toggle on, the wheel becomes a jump menu — click a
  // seat of the order of service to skip the meeting there.
  function wireOrderSkip() {
    var wheel = document.getElementById("kolob-wheel");
    if (!wheel) return;
    wheel.addEventListener("click", function (e) {
      if (!latinMode) return;                                 // inert for the congregation
      if (!window.KolobViz || !window.KolobViz.wheelSeatAt) return;
      var r = wheel.getBoundingClientRect();
      var sec = window.KolobViz.wheelSeatAt(e.clientX - r.left, e.clientY - r.top);
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
      poll();
    });
  }

  // ==========================================================================
  // Visualizer hand-off
  // ==========================================================================
  function initViz() {
    var canvas = document.getElementById("kolob-viz");
    var wheel = document.getElementById("kolob-wheel");            // the organ facade rides inside the wheel; the Liahona dial is gone (v0.21)
    if (window.KolobViz && typeof window.KolobViz.init === "function") {
      try { window.KolobViz.init(canvas, wheel); }
      catch (e) { if (window.console) console.error("Kolob viz init failed", e); }
      // The canvases are measured at init, which can run before the page has
      // its final width (a pending webfont stylesheet, a late layout). The viz
      // re-measures on window resize, so nudge it once the page has settled
      // and once the fonts are in — otherwise the plates draw at the wrong
      // scale and their geometry (the wheel's radius) is off.
      var remeasure = function () { try { window.dispatchEvent(new Event("resize")); } catch (e2) {} };
      window.addEventListener("load", remeasure);
      if (document.fonts && document.fonts.ready && document.fonts.ready.then) document.fonts.ready.then(remeasure);
    }
  }

  // ==========================================================================
  // The Ives switch — while armed, every meeting is guaranteed one visitation
  // (the two bands, the steeples, the old tune or the trombones at dawn).
  // Arming it mid-meeting
  // restarts the meeting so the guarantee begins counting immediately.
  // ==========================================================================
  // (round 3c, dev — the owner's listening packet: ?guest=<name> asks for
  // that guest in every meeting of the visit, as the harness's force=<name>
  // does — bands, handcart, gulls, variations, changes, tongues, farward,
  // hosanna (on Easter or a dedication only), socialhall, testimony,
  // steeples, oldtune, trombones, handbells, singingschool. It wins over
  // the switch; the switch's own light is untouched.)
  var urlGuest = null;
  try { var gm = /[?&]guest=([a-z]+)/.exec(location.search || ""); urlGuest = gm ? gm[1] : null; } catch (e) {}
  function wireIvesToggle() {
    var btn = document.getElementById("kolob-ives");
    if (!btn) { if (urlGuest && K.setForceVisitation) K.setForceVisitation(urlGuest); return; }
    var on = false;
    try { on = localStorage.getItem("kolobIves") === "1"; } catch (e) {}
    function apply() {
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      if (K.setForceVisitation) K.setForceVisitation(urlGuest || on);
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
      natural: "the tune withheld until the doxology — about one meeting in twelve",
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

  // ==========================================================================
  // THE BAND'S CATERPILLAR (2026-09-29; PLAN-CATERPILLAR.md, the owner's
  // idea). While the Nauvoo band is in the street the listener is lent a
  // volume for the band alone. It comes as the band comes: a row of ink
  // segments with a small beehive for its head inches in from the paper's
  // left edge, behind the dots, the rear bunching up behind the head and
  // the head reaching on, and lies down between STOP and VOL as a slider.
  // Its body is the track and its head the thumb. Drag the head (or use the
  // keys) and the band follows, from silent to half again its own level:
  // the body bunches up as the band is turned down and stretches out as it
  // is turned up. When the band has gone out of hearing (its last drum, as
  // the engine reports it) it lets go, turns, and crawls back off the way it
  // came. The setting is kept for the visit, so the next band arrives
  // already set. Everything is read off the audio clock: the caterpillar
  // arrives when the band is heard, holds still when the meeting is held,
  // and a page that comes back from a hidden tab shows it where it would be
  // by now, never a crawl replayed late.
  // ==========================================================================
  function wireCaterpillar() {
    var el = document.getElementById("kolob-cat");
    if (!el || !K.setBandVolume || !el.animate) return null;
    var range = el.querySelector(".kolob-cat-range"), track = el.querySelector(".kolob-cat-track");
    var body = el.querySelector(".kolob-cat-body"), head = el.querySelector(".kolob-cat-head");
    var transport = el.parentNode;
    // ---- the knobs ----
    var N = 12;                      // body segments (the head is the thirteenth)
    var SPEED = 130;                 // px a second the crawl covers; each crawl is held to 2.5 … 3.6 s
    var CRAWL_MIN_S = 2.5, CRAWL_MAX_S = 3.6;
    var BUNCH = 0.42;                // of each pulse, the share the rear takes to bunch up (the head reaches in the rest)
    var SETTLE_S = 0.4;              // lying down at the listener's setting, once arrived
    var LETGO_S = 0.3, TURN_S = 0.36; // leaving: the head draws back to the tail, then it turns round
    var QUICK = 0.35;                // STOP or a jump: the same crawl off, this much of the time
    var LINGER_S = 1.5;              // the town's air after the last drum, before it goes
    var HUMP = { row: 7, rule: 5 };  // how high the body arches when fully bunched (px)
    var TRACK_MAX = 170, TRACK_MIN = 96, GAP = 22;   // the slider's length, and its room each side (row)
    var LANE_H = 48;                 // the lane's height; its line runs through the middle
    var DT = 0.02;                   // the crawl is sampled every 20 ms into keyframes
    var FEET = /[?&]catfeet=1/.test(location.search || "");
    var level = 100;                 // the listener's setting (0 … 150 %), kept for the visit
    var spans = [];                  // the bands heard: { t0, until } on the audio clock
    var state = "away";              // away · arriving · here · leaving
    var G = null, anims = [], run = null, held = false;
    var reduced = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

    // ---- the body ----
    var segs = [];
    for (var i = 0; i < N; i++) {
      var s = document.createElement("span");
      s.className = "kolob-cat-seg" + (i % 2 === 1 && i < N - 1 ? " has-feet" : "");
      body.appendChild(s); segs.push(s);
    }
    var parts = segs.concat([head]);
    el.classList.toggle("is-footed", FEET);

    // ---- where it lies: measured from the row as it stands ----
    // x is measured from the paper's left edge (the lane begins there, so
    // the caterpillar comes from beyond it). ROW: the free space between
    // STOP and VOL holds it mid-row, beside the master. RULE: on a phone the
    // master slider takes the whole row, so it walks the console's rule
    // beneath the dots, and lies down there, left of the master. Either way
    // nothing in the row moves.
    function measure() {
      var frame = el.closest(".kolob-frame") || document.body, con = transport.parentNode;
      var F = frame.getBoundingClientRect(), R = transport.getBoundingClientRect(), C = con.getBoundingClientRect();
      var stop = document.getElementById("kolob-stop").getBoundingClientRect();
      var label = transport.querySelector(".kolob-ctl-label"), lever = transport.querySelector(".kolob-lever-wrap");
      var lb = label ? label.getBoundingClientRect() : null, lv = lever.getBoundingClientRect();
      var right = lb && lb.width > 0 ? lb.left : lv.left, free = right - stop.right;
      var cs = getComputedStyle(el);
      var g = { seg: parseFloat(cs.getPropertyValue("--seg")) || 9, segH: parseFloat(cs.getPropertyValue("--seg-h")) || 8,
                headW: parseFloat(cs.getPropertyValue("--head")) || 13 };
      g.headH = g.headW * 1.1;
      g.laneLeft = F.left - R.left;
      if (free - 2 * GAP >= TRACK_MIN) {
        g.mode = "row";
        g.x1 = right - GAP - F.left;
        g.x0 = g.x1 - Math.min(TRACK_MAX, free - 2 * GAP);
        g.lineY = R.height / 2;
      } else {
        g.mode = "rule";
        g.x0 = R.left - F.left + 2;
        g.x1 = lv.left - F.left - 12;
        g.lineY = C.bottom - (parseFloat(getComputedStyle(con).borderBottomWidth) || 1) / 2 - R.top;
      }
      g.hump = HUMP[g.mode];
      // the body's lengths: fully bunched (0 %), as the band is seated (100 %),
      // and the head's travel from 0 to 150 %; the tail stays at the start
      g.T = g.x0 + g.seg / 2;
      g.Lmin = Math.max(26, 0.2 * (g.x1 - g.x0));
      g.travel = (g.x1 - g.headW / 2) - (g.T + g.Lmin);
      g.Ln = g.Lmin + g.travel * (100 / 150);
      return g;
    }
    function headAt(v) { return G.T + G.Lmin + G.travel * clamp(v, 0, 150) / 150; }
    function layout() {
      G = measure();
      el.style.left = G.laneLeft + "px";
      el.style.top = (G.lineY - LANE_H / 2) + "px";
      el.style.width = (G.x1 + G.headW) + "px";
      el.style.height = LANE_H + "px";
      el.setAttribute("data-mode", G.mode);
      track.style.left = G.T + "px";
      track.style.width = (G.x1 - G.T) + "px";
      track.style.top = (LANE_H / 2 - 1) + "px";
      var rh = range.offsetHeight || 32;
      range.style.left = (G.T + G.Lmin - G.headW / 2) + "px";
      range.style.width = (G.travel + G.headW) + "px";
      range.style.top = (LANE_H / 2 - rh / 2) + "px";
    }

    // ---- the body in a pose ----
    // A pose is where the tail (t) and the head (h) stand on the line; the
    // segments lie evenly between them. Bunched shorter than the band's own
    // length, the middle arches up (an inchworm's loop, kept low: it never
    // reaches the staff); stretched longer, the segments part. A turn (th,
    // 0 … π) is the body seen side-on as it turns round: foreshortened
    // about its middle (c) and back again, the head now at the other end.
    function lay(p) {
      var len = p.th != null ? p.len : Math.abs(p.h - p.t);
      var comp = clamp((G.Ln - len) / Math.max(1, G.Ln - G.Lmin), 0, 1), arch = G.hump * Math.pow(comp, 0.8);
      var out = [];
      for (var k = 0; k <= N; k++) {
        var u = k / N;
        var x = p.th != null ? p.c + (u - 0.5) * p.len * Math.cos(p.th) : p.t + (p.h - p.t) * u;
        out.push({ x: x, y: -arch * Math.sin(Math.PI * u) });
      }
      return out;
    }
    // the tail's end tapers; the head is its own size
    function taper(k) { var u = k / N; return u >= 0.45 ? 1 : 0.72 + 0.28 * (u / 0.45); }
    function tf(k, q) {
      var w = k < N ? G.seg : G.headW, hh = k < N ? G.segH : G.headH, sc = k < N ? taper(k) : 1;
      return "translate(" + (q.x - w / 2).toFixed(2) + "px," + (LANE_H / 2 - hh / 2 + q.y).toFixed(2) + "px)" + (sc < 1 ? " scale(" + sc.toFixed(3) + ")" : "");
    }
    function pose(p) { var q = lay(p); parts.forEach(function (e, k) { e.style.transform = tf(k, q[k]); }); }
    function settled() { return { t: G.T, h: headAt(level) }; }

    // ---- the gait ----
    // A crawl is a list of moves of the tail and the head, each eased, and
    // at most one turn. An inchworm's pulse: the rear draws up behind the
    // head (BUNCH of the pulse), then the head reaches on and the body
    // stretches after it. The stride is fitted so the last pulse lands it
    // exactly, and never bunches it tighter than 0 % does.
    function crawlTime(d) { return clamp(d / SPEED, CRAWL_MIN_S, CRAWL_MAX_S); }
    function pulses(moves, from, dist, dir, dur) {
      var p = Math.max(5, Math.ceil(dist / ((G.Ln - G.Lmin) * 0.8))), stride = dist / p, dt = dur / p;
      var t = from.t, h = from.h;
      for (var i = 0; i < p; i++) {
        t += dir * stride; moves.push({ dur: dt * BUNCH, t: t, h: h });
        h += dir * stride; moves.push({ dur: dt * (1 - BUNCH), t: t, h: h });
      }
      return { t: t, h: h };
    }
    // in: from wholly beyond the paper's edge to lying down at the setting
    function crawlIn() {
      var h1 = G.T + G.Ln, from = { t: -G.headW - G.Ln, h: -G.headW };
      var moves = [], at = pulses(moves, from, h1 - from.h, 1, crawlTime(h1 - from.h));
      var hv = headAt(level);
      if (Math.abs(hv - at.h) > 0.5) moves.push({ dur: SETTLE_S, t: at.t, h: hv });
      return { from: from, moves: moves };
    }
    // off: it lets go (the head draws back to the tail), turns round, and
    // crawls back off the paper's edge the way it came
    function crawlOff(from, quick) {
      var k = quick ? QUICK : 1, moves = [], lb = G.Lmin * 1.4, at = from;
      if (from.h >= from.t) {                               // (one already facing the edge just goes)
        moves.push({ dur: LETGO_S * k, t: from.t, h: from.t + lb });
        moves.push({ dur: TURN_S * k, turn: true });
        at = { t: from.t + lb, h: from.t };
      }
      moves.push({ dur: 0.35 * k, t: at.t, h: at.t - G.Ln }); // it reaches away first
      at = { t: at.t, h: at.t - G.Ln };
      var dist = Math.max(1, at.t + G.seg);                 // until its tail has passed the edge
      pulses(moves, at, dist, -1, crawlTime(dist) * k);
      return { from: from, moves: moves };
    }

    // ---- a crawl, sampled and played ----
    // Each move knows where it starts and ends; the crawl is sampled every
    // DT into one keyframe list per segment and played by the Web Animations
    // API (transforms only, off the main thread). It can start part-way (a
    // page that was away is shown where the caterpillar would be by now) and
    // is held while the meeting is held.
    function ease(x) { return 0.5 - 0.5 * Math.cos(Math.PI * clamp(x, 0, 1)); }
    function steps(r) {
      var list = [], cur = r.from, t0 = 0;
      r.moves.forEach(function (m) {
        var a = { t: cur.t, h: cur.h }, b, turn = null;
        if (m.turn) { turn = { c: (a.t + a.h) / 2, len: Math.abs(a.h - a.t) }; b = { t: turn.c + turn.len / 2, h: turn.c - turn.len / 2 }; }
        else b = { t: m.t, h: m.h };
        list.push({ t0: t0, dur: m.dur, a: a, b: b, turn: turn });
        cur = b; t0 += m.dur;
      });
      return { list: list, total: t0 };
    }
    function poseAt(S, tau) {
      var L = S.list, m = L[L.length - 1];
      for (var i = 0; i < L.length; i++) if (tau <= L[i].t0 + L[i].dur) { m = L[i]; break; }
      var x = ease((tau - m.t0) / Math.max(1e-6, m.dur));
      if (m.turn) return { th: Math.PI * x, c: m.turn.c, len: m.turn.len };
      return { t: m.a.t + (m.b.t - m.a.t) * x, h: m.a.h + (m.b.h - m.a.h) * x };
    }
    function play(r, since, then) {
      cancel();
      var S = steps(r), n = Math.max(2, Math.ceil(S.total / DT) + 1), frames = [];
      for (var j = 0; j < n; j++) frames.push(lay(poseAt(S, Math.min(S.total, j * DT))));
      var dur = (n - 1) * DT * 1000, at = Math.max(0, (since || 0) * 1000);
      run = { S: S, frames: frames, then: then };
      if (at >= dur || document.hidden) { done(); return; }   // (it would be there by now)
      anims = parts.map(function (e, k) {
        return e.animate(frames.map(function (q) { return { transform: tf(k, q[k]) }; }), { duration: dur, easing: "linear", fill: "both" });
      });
      anims.forEach(function (a) { a.currentTime = at; if (held) a.pause(); });
      var a0 = anims[0];
      a0.onfinish = function () { if (anims[0] === a0) done(); };
    }
    // (reduced motion: no crawl; it fades in and out where it lies)
    function fade(a, b, since, then) {
      cancel();
      run = { S: null, frames: null, then: then };
      var at = Math.max(0, (since || 0) * 1000);
      if (at >= 600 || document.hidden) { done(); return; }
      var an = el.animate([{ opacity: a }, { opacity: b }], { duration: 600, easing: "ease", fill: "both" });
      an.currentTime = at; if (held) an.pause();
      anims = [an];
      an.onfinish = function () { if (anims[0] === an) done(); };
    }
    // the crawl at its end: its last pose made the element's own, and on
    function done() {
      var r = run;
      if (!r) return;
      if (r.frames) { var last = r.frames[r.frames.length - 1]; parts.forEach(function (e, k) { e.style.transform = tf(k, last[k]); }); }
      cancel();
      if (r.then) r.then();
    }
    function cancel() {
      anims.forEach(function (a) { try { a.onfinish = null; a.cancel(); } catch (e) {} });
      anims = []; run = null;
    }
    function hold(on) {
      if (on === held) return;
      held = on;
      anims.forEach(function (a) { try { if (on) a.pause(); else a.play(); } catch (e) {} });
    }
    // where the body is now (a leave can begin mid-arrival)
    function current() {
      if (run && run.S && anims.length) return poseAt(run.S, Math.min(run.S.total, (anims[0].currentTime || 0) / 1000));
      return state === "away" ? null : settled();
    }

    // ---- coming and going ----
    // Only a lain-down caterpillar is a control: arriving and leaving it is
    // inert, out of the tab order, and takes no pointer.
    function setState(s) {
      state = s;
      el.setAttribute("data-state", s);
      el.classList.toggle("is-settled", s === "here");
      var live = s === "here";
      if (!live && document.activeElement === range) range.blur();
      el.inert = !live; range.disabled = !live; range.tabIndex = live ? 0 : -1;
    }
    function ariaText() { range.setAttribute("aria-valuetext", level + " percent"); }
    function lieDown() { pose(settled()); setState("here"); }
    function arrive(since) {
      cancel();
      el.hidden = false;
      layout();
      range.value = String(level); ariaText();
      setState("arriving");
      if (reduced.matches) { pose(settled()); fade(0, 1, since, lieDown); return; }
      play(crawlIn(), since, lieDown);
    }
    function leave(quick, since) {
      if (state !== "here" && state !== "arriving") return;
      var from = current() || settled();
      if (from.th != null) from = settled();
      cancel();
      setState("leaving");
      if (reduced.matches) { fade(1, 0, since, away); return; }
      play(crawlOff(from, quick), since, away);
    }
    function away() { cancel(); setState("away"); el.hidden = true; }

    // ---- is the band here? (the audio clock, and what the engine reports) ----
    // A band is here from its guest-start until its last note or drum has
    // stopped (the engine's heardUntil: the drums carry it off 16 to 21 s past
    // the stinger, well past guest-end) and the town's air after it
    // (LINGER_S). since: how long ago that last changed.
    function reading() {
      var now = K.getAudioTime ? K.getAudioTime() : 0, heard = K.getBandHeardUntil ? K.getBandHeardUntil() : 0;
      var last = spans.length - 1, here = null, left = -Infinity;
      spans.forEach(function (s, i) {
        var end = Math.max(s.until, i === last ? heard : 0) + LINGER_S;
        if (now >= s.t0 && now < end) here = now - s.t0;
        else if (now >= end && end > left) left = end;
      });
      spans = spans.filter(function (s, i) { return i === last || now < s.until + 60; });
      return here != null ? { here: true, since: here } : { here: false, since: now - left };
    }
    function tick() {
      var on = !!(K.isPlaying && K.isPlaying()), paused = on && !!(K.isPaused && K.isPaused());
      hold(paused);
      if (paused) return;
      var r = on ? reading() : { here: false, since: Infinity };
      if (r.here) {
        if (state === "leaving") away();              // (a band came while the last was leaving)
        if (state === "away") arrive(r.since);
      } else if (state === "here" || state === "arriving") leave(false, r.since);
    }

    // ---- the engine's word, and the listener's hand ----
    // Only the band brings it (the Hosanna and every other guest never do).
    // STOP or a dev jump sends it off at once, quickly; a new gathering
    // clears the page, and it is simply gone.
    if (K.setEventListener) K.setEventListener(function (ev) {
      if (!ev) return;
      if (ev.type === "guest-start" && ev.guest === "bands" && ev.logged !== false) {
        spans.push({ t0: ev.t || 0, until: ev.until != null ? ev.until : (ev.t || 0) + 60 });
      } else if ((ev.type === "transport" && ev.action === "stop") || ev.type === "skip") {
        spans = [];
        leave(true, 0);
      }
    });
    var gather = document.getElementById("kolob-gather");
    if (gather) gather.addEventListener("click", function () { spans = []; if (state !== "away") away(); });
    range.addEventListener("input", function () {
      level = clamp(parseInt(range.value, 10) || 0, 0, 150);
      K.setBandVolume(level / 100);
      ariaText();
      if (state === "here" && !anims.length) pose(settled());
    });
    // a new width: a crawl under way is finished where it was going, and
    // one lying down is measured and laid again
    window.addEventListener("resize", function () {
      if (anims.length) done();
      if (state === "here") { layout(); pose(settled()); }
    });
    // back from a hidden tab: the present, never a crawl replayed late. (A
    // change that fell due while the tab was hidden was made at once, with
    // no crawl: play() and fade() jump to the end in a hidden document; and
    // a crawl already under way runs on the page's timeline, which has kept
    // time, so it is simply where it would be by now.)
    document.addEventListener("visibilitychange", function () { if (!document.hidden) tick(); });
    setState("away");
    return { tick: tick, probe: function () { return { state: state, level: level, mode: G ? G.mode : null, spans: spans.slice(), geometry: G }; } };
  }

  renderMixer();
  wireInstrumentsPanel();
  wireTransport();
  cat = wireCaterpillar();
  wireLatinToggle();
  wireIvesToggle();
  wireCumulativeToggle();
  wireOrderSkip();
  applyScript();
  initViz();
  poll();
})();

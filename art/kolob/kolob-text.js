// ============================================================================
// KOLOB — the broadside (text engine)
//
// An aleatoric letterpress: catalog-verse in the manner of Whitman, assembled
// from a fixed lexicon and printed one line at a time in the DESERET ALPHABET.
// Every Deseret form below is hand-transliterated (phonemic, small letters —
// the 1859 chart). The `en` field is developer reference data only; nothing
// English is ever rendered. The engine keeps its own seeded RNG (fed from the
// audio seed) so the broadside is reproducible WITHOUT perturbing the music's
// own draw order.
//
// Public surface: window.KolobText = { init(seed), line() -> {en, ds} }
// ============================================================================

window.KolobText = (function () {
  "use strict";

  var rngState = 1847;
  function mulberry32() {
    rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rng() { return mulberry32(); }
  function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
  function chance(p) { return rng() < p; }

  // ---- the lexicon ----------------------------------------------------------
  // OPENERS — the poet turns to face the thing.
  var OPENERS = [
    { en: "i saw",            ds: "𐐴 𐑅𐐫" },
    { en: "i heard",          ds: "𐐴 𐐸𐐲𐑉𐐼" },
    { en: "i beheld",         ds: "𐐴 𐐺𐐮𐐸𐐯𐑊𐐼" },
    { en: "i dreamt of",      ds: "𐐴 𐐼𐑉𐐯𐑋𐐻 𐐲𐑂" },
    { en: "out of",           ds: "𐐵𐐻 𐐲𐑂" },
    { en: "a song of",        ds: "𐐲 𐑅𐐫𐑍 𐐲𐑂" },
    { en: "chants of",        ds: "𐐽𐐰𐑌𐐻𐑅 𐐲𐑂" },
    { en: "behold",           ds: "𐐺𐐮𐐸𐐬𐑊𐐼" },
    { en: "praise",           ds: "𐐹𐑉𐐩𐑆" },
    { en: "come, see",        ds: "𐐿𐐲𐑋, 𐑅𐐨" },
  ];
  // SUBJECTS — the commonwealth, cataloged. Valley things, colony things.
  var SUBJECTS = [
    { en: "the valley",            ds: "𐑄 𐑂𐐰𐑊𐐮" },
    { en: "the beehive",           ds: "𐑄 𐐺𐐨𐐸𐐴𐑂" },
    { en: "the sego lily",         ds: "𐑄 𐑅𐐨𐑀𐐬 𐑊𐐮𐑊𐐮" },
    { en: "the adobe wall",        ds: "𐑄 𐐲𐐼𐐬𐐺𐐮 𐐶𐐫𐑊" },
    { en: "the telegraph wire",    ds: "𐑄 𐐻𐐯𐑊𐐲𐑀𐑉𐐰𐑁 𐐶𐐴𐑉" },
    { en: "the tabernacle",        ds: "𐑄 𐐻𐐰𐐺𐐲𐑉𐑌𐐰𐐿𐐲𐑊" },
    { en: "the handcart",          ds: "𐑄 𐐸𐐰𐑌𐐼𐐿𐐪𐑉𐐻" },
    { en: "the orchard",           ds: "𐑄 𐐫𐑉𐐽𐐲𐑉𐐼" },
    { en: "the canal",             ds: "𐑄 𐐿𐐲𐑌𐐰𐑊" },
    { en: "the granite",           ds: "𐑄 𐑀𐑉𐐰𐑌𐐮𐐻" },
    { en: "the wheatfield",        ds: "𐑄 𐐶𐐨𐐻𐑁𐐨𐑊𐐼" },
    { en: "the meetinghouse",      ds: "𐑄 𐑋𐐨𐐻𐐮𐑍𐐸𐐵𐑅" },
    { en: "the empty benches",     ds: "𐑄 𐐯𐑋𐐹𐐻𐐮 𐐺𐐯𐑌𐐽𐐮𐑆" },
    { en: "the organ",             ds: "𐑄 𐐫𐑉𐑀𐐲𐑌" },
    { en: "the choir",             ds: "𐑄 𐐿𐐶𐐴𐐲𐑉" },
    { en: "the still water",       ds: "𐑄 𐑅𐐻𐐮𐑊 𐐶𐐫𐐻𐐲𐑉" },
    { en: "the morning star",      ds: "𐑄 𐑋𐐫𐑉𐑌𐐮𐑍 𐑅𐐻𐐪𐑉" },
    { en: "the outbound ships",    ds: "𐑄 𐐵𐐻𐐺𐐵𐑌𐐼 𐑇𐐮𐐹𐑅" },
    { en: "the new city",          ds: "𐑄 𐑌𐑏 𐑅𐐮𐐻𐐮" },
    { en: "the desert",            ds: "𐑄 𐐼𐐯𐑆𐐲𐑉𐐻" },
    { en: "the cottonwood",        ds: "𐑄 𐐿𐐱𐐻𐐲𐑌𐐶𐐳𐐼" },
    { en: "the far pastures",      ds: "𐑄 𐑁𐐪𐑉 𐐹𐐰𐑅𐐽𐐲𐑉𐑆" },
    { en: "the quiet dust",        ds: "𐑄 𐐿𐐶𐐴𐐲𐐻 𐐼𐐲𐑅𐐻" },
    { en: "the workshop",          ds: "𐑄 𐐶𐐲𐑉𐐿𐑇𐐱𐐹" },
    { en: "the printing press",    ds: "𐑄 𐐹𐑉𐐮𐑌𐐻𐐮𐑍 𐐹𐑉𐐯𐑅" },
    { en: "the schoolhouse",       ds: "𐑄 𐑅𐐿𐐭𐑊𐐸𐐵𐑅" },
    { en: "the observatory",       ds: "𐑄 𐐲𐐺𐑆𐐲𐑉𐑂𐐲𐐻𐐫𐑉𐐮" },
    { en: "the light of kolob",    ds: "𐑄 𐑊𐐴𐐻 𐐲𐑂 𐐿𐐬𐑊𐐱𐐺" },
    { en: "the burning glass",     ds: "𐑄 𐐺𐐲𐑉𐑌𐐮𐑍 𐑀𐑊𐐰𐑅" },
    { en: "the bright dominion",   ds: "𐑄 𐐺𐑉𐐴𐐻 𐐼𐐲𐑋𐐮𐑌𐐷𐐲𐑌" },
    { en: "the cricket",           ds: "𐑄 𐐿𐑉𐐮𐐿𐐮𐐻" },
    { en: "the evening bell",      ds: "𐑄 𐐨𐑂𐑌𐐮𐑍 𐐺𐐯𐑊" },
    { en: "the honest clay",       ds: "𐑄 𐐱𐑌𐐮𐑅𐐻 𐐿𐑊𐐩" },
    { en: "the covenant of wheat", ds: "𐑄 𐐿𐐲𐑂𐐲𐑌𐐲𐑌𐐻 𐐲𐑂 𐐶𐐨𐐻" },
    { en: "the strange sky",       ds: "𐑄 𐑅𐐻𐑉𐐩𐑌𐐾 𐑅𐐿𐐴" },
    { en: "the long meridian",     ds: "𐑄 𐑊𐐫𐑍 𐑋𐐲𐑉𐐮𐐼𐐮𐐲𐑌" },
  ];
  // QUALITIES — post-positive, the Whitman apposition.
  var QUALITIES = [
    { en: "patient and bright",     ds: "𐐹𐐩𐑇𐐲𐑌𐐻 𐐰𐑌𐐼 𐐺𐑉𐐴𐐻" },
    { en: "wide as morning",        ds: "𐐶𐐴𐐼 𐐰𐑆 𐑋𐐫𐑉𐑌𐐮𐑍" },
    { en: "unhurried",              ds: "𐐲𐑌𐐸𐐲𐑉𐐮𐐼" },
    { en: "full of light",          ds: "𐑁𐐳𐑊 𐐲𐑂 𐑊𐐴𐐻" },
    { en: "singing low",            ds: "𐑅𐐮𐑍𐐮𐑍 𐑊𐐬" },
    { en: "at rest",                ds: "𐐰𐐻 𐑉𐐯𐑅𐐻" },
    { en: "in blossom",             ds: "𐐮𐑌 𐐺𐑊𐐱𐑅𐐲𐑋" },
    { en: "sweet and plain",        ds: "𐑅𐐶𐐨𐐻 𐐰𐑌𐐼 𐐹𐑊𐐩𐑌" },
    { en: "gathering the light",    ds: "𐑀𐐰𐑄𐐲𐑉𐐮𐑍 𐑄 𐑊𐐴𐐻" },
    { en: "without fear",           ds: "𐐶𐐮𐑄𐐵𐐻 𐑁𐐮𐑉" },
    { en: "green in the dry land",  ds: "𐑀𐑉𐐨𐑌 𐐮𐑌 𐑄 𐐼𐑉𐐴 𐑊𐐰𐑌𐐼" },
    { en: "older than sorrow",      ds: "𐐬𐑊𐐼𐐲𐑉 𐑄𐐰𐑌 𐑅𐐱𐑉𐐬" },
    { en: "humming to itself",      ds: "𐐸𐐲𐑋𐐮𐑍 𐐻𐐭 𐐮𐐻𐑅𐐯𐑊𐑁" },
    { en: "kept and keeping",       ds: "𐐿𐐯𐐹𐐻 𐐰𐑌𐐼 𐐿𐐨𐐹𐐮𐑍" },
    { en: "far from want",          ds: "𐑁𐐪𐑉 𐑁𐑉𐐲𐑋 𐐶𐐱𐑌𐐻" },
    { en: "turning toward the sun", ds: "𐐻𐐲𐑉𐑌𐐮𐑍 𐐻𐐲𐐶𐐫𐑉𐐼 𐑄 𐑅𐐲𐑌" },
    { en: "content",                ds: "𐐿𐐲𐑌𐐻𐐯𐑌𐐻" },
    { en: "asking nothing",         ds: "𐐰𐑅𐐿𐐮𐑍 𐑌𐐲𐑃𐐮𐑍" },
    { en: "steady as a wheel",      ds: "𐑅𐐻𐐯𐐼𐐮 𐐰𐑆 𐐲 𐐶𐐨𐑊" },
    { en: "new every morning",      ds: "𐑌𐑏 𐐯𐑂𐑉𐐮 𐑋𐐫𐑉𐑌𐐮𐑍" },
    { en: "still small",            ds: "𐑅𐐻𐐮𐑊 𐑅𐑋𐐫𐑊" },
    { en: "unafraid of distance",   ds: "𐐲𐑌𐐲𐑁𐑉𐐩𐐼 𐐲𐑂 𐐼𐐮𐑅𐐻𐐲𐑌𐑅" },
  ];
  // CLOSERS — the line sets itself down.
  var CLOSERS = [
    { en: "and it was enough",        ds: "𐐰𐑌𐐼 𐐮𐐻 𐐶𐐱𐑆 𐐮𐑌𐐲𐑁" },
    { en: "world without end",        ds: "𐐶𐐲𐑉𐑊𐐼 𐐶𐐮𐑄𐐵𐐻 𐐯𐑌𐐼" },
    { en: "all is well",              ds: "𐐫𐑊 𐐮𐑆 𐐶𐐯𐑊" },
    { en: "and the evening came",     ds: "𐐰𐑌𐐼 𐑄 𐐨𐑂𐑌𐐮𐑍 𐐿𐐩𐑋" },
    { en: "and no one was a stranger", ds: "𐐰𐑌𐐼 𐑌𐐬 𐐶𐐲𐑌 𐐶𐐱𐑆 𐐲 𐑅𐐻𐑉𐐩𐑌𐐾𐐲𐑉" },
    { en: "there is no end to this",  ds: "𐑄𐐯𐑉 𐐮𐑆 𐑌𐐬 𐐯𐑌𐐼 𐐻𐐭 𐑄𐐮𐑅" },
    { en: "the work goes on",         ds: "𐑄 𐐶𐐲𐑉𐐿 𐑀𐐬𐑆 𐐱𐑌" },
    { en: "i also am here",           ds: "𐐴 𐐫𐑊𐑅𐐬 𐐰𐑋 𐐸𐐮𐑉" },
    { en: "and the bees went on believing", ds: "𐐰𐑌𐐼 𐑄 𐐺𐐨𐑆 𐐶𐐯𐑌𐐻 𐐱𐑌 𐐺𐐮𐑊𐐨𐑂𐐮𐑍" },
    { en: "come, come, ye saints",    ds: "𐐿𐐲𐑋, 𐐿𐐲𐑋, 𐐷𐐨 𐑅𐐩𐑌𐐻𐑅" },
    { en: "we are not late",          ds: "𐐶𐐨 𐐪𐑉 𐑌𐐱𐐻 𐑊𐐩𐐻" },
    { en: "the harvest is sure",      ds: "𐑄 𐐸𐐪𐑉𐑂𐐮𐑅𐐻 𐐮𐑆 𐑇𐐳𐑉" },
    { en: "amen",                     ds: "𐐩𐑋𐐯𐑌" },
  ];

  // ---- assembly -------------------------------------------------------------
  function join(parts, seps) {
    var en = [], ds = [];
    for (var i = 0; i < parts.length; i++) {
      en.push(parts[i].en);
      ds.push(parts[i].ds);
    }
    var sepEn = seps || " ";
    return { en: en.join(sepEn === "," ? ", " : " "), ds: ds.join(sepEn === "," ? ", " : " ") };
  }
  var TEMPLATES = [
    function () { return join([pick(OPENERS), pick(SUBJECTS), pick(QUALITIES)]); },
    function () {
      var a = pick(SUBJECTS), b = pick(SUBJECTS), c = pick(SUBJECTS);
      while (b.en === a.en) b = pick(SUBJECTS);
      while (c.en === a.en || c.en === b.en) c = pick(SUBJECTS);
      return join([a, b, c], ",");                            // the pure catalog
    },
    function () { return join([pick(OPENERS), pick(SUBJECTS), pick(CLOSERS)]); },
    function () { return join([pick(SUBJECTS), pick(QUALITIES), pick(CLOSERS)]); },
    function () { return join([pick(SUBJECTS), pick(QUALITIES)]); },
  ];

  var lastEn = "";
  function line() {
    var out = null, guard = 0;
    do {
      var t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
      out = t();
      guard++;
    } while (out.en === lastEn && guard < 5);
    lastEn = out.en;
    // an occasional terminal amen — the broadside signs itself
    if (chance(0.08)) { out.en += " — amen"; out.ds += " — 𐐩𐑋𐐯𐑌"; }
    return out;
  }

  return {
    init: function (seedVal) { rngState = (seedVal >>> 0) || 1847; lastEn = ""; },
    line: line,
  };
})();

// ============================================================================
// KOLOB 2 — THE CAST (KOLOB.Cast)
//
// A ward of people, not a choir. Every visit seats a different Sunday's ward:
// thirty-two members in the pews, eight to a part, each with a voice and
// habits of their own — and among them eight to twelve PEOPLE you come to
// know within one meeting: the chorister who keys the hymns and holds the
// fermatas as long as she likes; the precentor who lines out the Old Way;
// the soloist and her descant; the old bass, flat and late and enormous;
// the harmony alto who knows every part; the enthusiast, too loud, a little
// sharp, joyful; a child who sings the tune and loses the words and finds
// them again; a newcomer who doesn't know the first hymn and joins on its
// second line; the two or three who will rise at the testimony; and at the
// organ, someone with a style of their own (PLAN-COMPOSITION §5).
//
// Two halves:
//
//  · THE PLANNING — pure (SCORE §1): no AudioContext, no DOM, no clock, no
//    Math.random. The caller hands in PJ2.Rand streams and gets plain JSON
//    back, so the harness can seat a ward and lay out a hymn in Node.
//      seat(stream, opts)                  → the Ward (stream: cast:<n>)
//      planHymn(ward, hymn, stream, opts)  → the plan: the keying or the
//                                             pitching, then a Performance
//                                             per verse (SCORE §5.1), and
//                                             who comes forward, and when
//                                             (stream: hymn:<n>:<i> →
//                                             performance)
//      score(ward, hymn, plan, opts)       → the cue sheet: every singer's
//                                             line in seconds from the
//                                             hymn's start, the organ's
//                                             lines, the typed events
//  · THE PERFORMER — glue. It hands each cue of a sheet to the voices
//    (KOLOB.VoicesVocal) at the scheduled time the caller gives it; it reads
//    no clock of its own (the caller says how far ahead it may reach), and
//    all of its sound-level dice come from the caller's `synth` stream.
//      performer(ward, { V, synth, organ })  → { pump, schedule, … }
//
// WHO COMES FORWARD. One or two at a time, never more; never the same person
// two verses running; each has their moment (the alto a verse, the old bass
// the last lines, the child a verse of a tune she knows, the soloist the
// descant over the last verse, the enthusiast the last verse's joy, the
// newcomer arriving on the second line of the day's first hymn). "Forward"
// means their voice leaves the hall for the near bus, a few dB up: the
// same person, heard.
//
// THE KEYING AND THE PITCHING. Before an unaccompanied hymn the chorister
// gives the key in her own habit — a hummed do and the tune's first note,
// or "fa… sol… la" up the scale, or sol–do — and, before a Sacred Harp or
// psalmody tune, the keyer hums the tonic and each section finds its first
// note on top of it, a chord of thirty-two slightly different voices
// building for three or four seconds before the class draws breath and
// sings (the owner's ruling, PLAN §14.5).
// ============================================================================
window.KOLOB = window.KOLOB || {};
window.KOLOB.Cast = (function () {
  "use strict";
  var K = window.KOLOB;

  // --------------------------------------------------------------------------
  // THE DESERET ALPHABET — names are spelled here phonemically, one sound to
  // a hyphen, and set in Deseret by the letters' own order (U+10400, the
  // capitals; +0x28, the small letters). The codes:
  //   ee ay ah aw oh oo  (the long vowels: feet, ate, father, ought, oat, ooze)
  //   i e a o u uu       (the short: it, et, at, hot, but, book)
  //   ie ow w y h p b t d ch j k g f v th dh s z sh zh r l m n ng oi ew
  // --------------------------------------------------------------------------
  var DS_CODES = ["ee", "ay", "ah", "aw", "oh", "oo", "i", "e", "a", "o", "u", "uu", "ie", "ow", "w", "y",
    "h", "p", "b", "t", "d", "ch", "j", "k", "g", "f", "v", "th", "dh", "s", "z", "sh", "zh", "r", "l", "m", "n", "ng", "oi", "ew"];
  function deseret(spelling) {
    return spelling.split(" ").map(function (word) {
      return word.split("-").map(function (ph, i) {
        var at = DS_CODES.indexOf(ph);
        if (at < 0) throw new Error("kolob-cast: no Deseret letter for '" + ph + "' in " + spelling);
        return String.fromCodePoint(0x10400 + at + (i ? 0x28 : 0));
      }).join("");
    }).join(" ");
  }

  // THE NAMES: [English (dev only; never rendered in the app), phonemes].
  // Pioneer names, the Book of Mormon's, and a few the colony made its own.
  var WOMEN = [
    ["Eliza", "i-l-ie-z-u"], ["Lucy", "l-oo-s-ee"], ["Emma", "e-m-u"], ["Hannah", "h-a-n-u"], ["Rhoda", "r-oh-d-u"],
    ["Keziah", "k-i-z-ie-u"], ["Patience", "p-ay-sh-u-n-s"], ["Tamar", "t-ay-m-ah-r"], ["Abigail", "a-b-i-g-ay-l"],
    ["Louisa", "l-oo-ee-z-u"], ["Ruth", "r-oo-th"], ["Martha", "m-ah-r-th-u"], ["Clarissa", "k-l-u-r-i-s-u"],
    ["Harriet", "h-a-r-ee-u-t"], ["Sariah", "s-u-r-ie-u"], ["Rachel", "r-ay-ch-u-l"], ["Lydia", "l-i-d-ee-u"],
    ["Phebe", "f-ee-b-ee"], ["Electa", "i-l-e-k-t-u"], ["Olive", "o-l-i-v"], ["Vilate", "v-ie-l-ay-t"],
    ["Bathsheba", "b-a-th-sh-ee-b-u"], ["Temperance", "t-e-m-p-u-r-u-n-s"], ["Dorcas", "d-aw-r-k-u-s"],
    ["Adah", "ay-d-u"], ["Eunice", "y-oo-n-i-s"], ["Mehitable", "m-u-h-i-t-u-b-u-l"], ["Susannah", "s-oo-z-a-n-u"],
  ];
  var MEN = [
    ["Heber", "h-ee-b-u-r"], ["Parley", "p-ah-r-l-ee"], ["Hyrum", "h-ie-r-u-m"], ["Lorenzo", "l-u-r-e-n-z-oh"],
    ["Wilford", "w-i-l-f-u-r-d"], ["Amasa", "a-m-u-s-u"], ["Jedediah", "j-e-d-u-d-ie-u"], ["Erastus", "i-r-a-s-t-u-s"],
    ["Ezra", "e-z-r-u"], ["Moroni", "m-u-r-oh-n-ie"], ["Lehi", "l-ee-h-ie"], ["Helaman", "h-ee-l-u-m-u-n"],
    ["Abinadi", "u-b-i-n-u-d-ie"], ["Mosiah", "m-oh-z-ie-u"], ["Enos", "ee-n-u-s"], ["Levi", "l-ee-v-ie"],
    ["Silas", "s-ie-l-u-s"], ["Caleb", "k-ay-l-u-b"], ["Asa", "ay-s-u"], ["Zebedee", "z-e-b-u-d-ee"],
    ["Truman", "t-r-oo-m-u-n"], ["Willard", "w-i-l-u-r-d"], ["Newel", "n-oo-u-l"], ["Porter", "p-aw-r-t-u-r"],
    ["Josiah", "j-oh-s-ie-u"], ["Alma", "a-l-m-u"], ["Gideon", "g-i-d-ee-u-n"], ["Thomas", "t-o-m-u-s"],
  ];
  var CHILDREN = [
    ["Effie", "e-f-ee"], ["Lettie", "l-e-t-ee"], ["Hattie", "h-a-t-ee"], ["Willie", "w-i-l-ee"],
    ["Josie", "j-oh-z-ee"], ["Minnie", "m-i-n-ee"], ["Eddie", "e-d-ee"], ["Nell", "n-e-l"],
  ];
  var FAMILIES = [
    ["Tanner", "t-a-n-u-r"], ["Hatch", "h-a-ch"], ["Cluff", "k-l-u-f"], ["Openshaw", "oh-p-u-n-sh-aw"],
    ["Merrill", "m-e-r-u-l"], ["Farr", "f-ah-r"], ["Huish", "h-y-oo-i-sh"], ["Gee", "j-ee"], ["Pack", "p-a-k"],
    ["Burr", "b-u-r"], ["Whiting", "w-ie-t-i-ng"], ["Heap", "h-ee-p"], ["Lamoreaux", "l-a-m-u-r-oh"],
    ["Dunyon", "d-u-n-y-u-n"], ["Bybee", "b-ie-b-ee"], ["Allred", "aw-l-r-e-d"], ["Nuttall", "n-u-t-aw-l"],
    ["Tolley", "t-o-l-ee"], ["Kartchner", "k-ah-r-ch-n-u-r"], ["Zundel", "z-u-n-d-u-l"], ["Hafen", "h-ay-f-u-n"],
    ["Leavitt", "l-e-v-i-t"], ["Rigby", "r-i-g-b-ee"], ["Stoddard", "s-t-o-d-u-r-d"], ["Walser", "w-aw-l-s-u-r"],
    ["Fenn", "f-e-n"], ["Mecham", "m-ee-ch-u-m"], ["Bushman", "b-uu-sh-m-u-n"], ["Skousen", "s-k-ow-s-u-n"],
    ["Rowberry", "r-oh-b-e-r-ee"],
  ];

  // --------------------------------------------------------------------------
  // THE ROLES and THE ROSTER — about forty archetypes. A Sunday seats one
  // archetype per role it fills. Ranges are [lo, hi]; `parts` is where the
  // person may sit. `voice` becomes the VoicesVocal spec, `habit` the
  // musical habits the performer reads.
  // --------------------------------------------------------------------------
  var ROLE_ORDER = ["chorister", "precentor", "soloist", "oldbass", "alto", "enthusiast", "child", "newcomer", "testimony", "organist"];
  var ROLE_NAME = {
    chorister: "the chorister", precentor: "the precentor", soloist: "the soloist", oldbass: "the old bass", alto: "the harmony alto",
    enthusiast: "the enthusiast", child: "the child", newcomer: "the newcomer", testimony: "a testimony-bearer", organist: "the organist",
  };
  var ROSTER = {
    chorister: [
      { id: "brisk", en: "the brisk one: quick tempo, short holds, cuts off clean", parts: ["S", "A", "T"], voice: { confidence: [0.9, 0.97] }, habit: { tempoMul: [1.03, 1.08], rubato: [0.02, 0.06], holdMul: [1.2, 1.5], keying: "hum" } },
      { id: "patient", en: "the patient one: broad tempo, long fermatas, a ritard at every close", parts: ["S", "A"], voice: { confidence: [0.88, 0.95] }, habit: { tempoMul: [0.92, 0.97], rubato: [0.12, 0.2], holdMul: [1.9, 2.4], keying: "hum" } },
      { id: "master", en: "the singing-school master: keys on fa–sol–la, strict time", parts: ["T", "B"], voice: { confidence: [0.94, 0.99] }, habit: { tempoMul: [0.98, 1.03], rubato: [0.0, 0.04], holdMul: [1.4, 1.7], keying: "fasola" } },
      { id: "mother", en: "the young mother: hums the key softly, lets the ward find it", parts: ["S", "A"], voice: { confidence: [0.82, 0.9] }, habit: { tempoMul: [0.96, 1.02], rubato: [0.06, 0.12], holdMul: [1.5, 1.9], keying: "hum" } },
      { id: "teacher", en: "the retired schoolteacher: gives sol–do, then the note", parts: ["A", "T", "B"], voice: { confidence: [0.9, 0.96] }, habit: { tempoMul: [0.97, 1.01], rubato: [0.05, 0.1], holdMul: [1.6, 2.0], keying: "fifth" } },
    ],
    precentor: [
      { id: "deacon", en: "the old deacon: slow, heavy with ornament", parts: ["T", "B"], voice: { confidence: [0.9, 0.96], age: "old" }, habit: { appetite: [0.8, 0.95], pace: [0.44, 0.5] } },
      { id: "clear", en: "the clear tenor: a light turn here and there", parts: ["T"], voice: { confidence: [0.95, 0.99] }, habit: { appetite: [0.45, 0.6], pace: [0.36, 0.42] } },
      { id: "basso", en: "the bass who lines out an octave down", parts: ["B"], voice: { confidence: [0.92, 0.97] }, habit: { appetite: [0.6, 0.75], pace: [0.4, 0.46] } },
      { id: "keen", en: "the keen one: every leap a slide", parts: ["T"], voice: { confidence: [0.9, 0.95] }, habit: { appetite: [0.7, 0.85], pace: [0.38, 0.44] } },
    ],
    soloist: [
      { id: "stake", en: "the soprano from the stake choir", parts: ["S"], voice: { confidence: [0.96, 0.99], brightness: [0.66, 0.74], breath: [0.2, 0.28], vibrato: { rate: [5.5, 5.9], depth: [38, 46], onsetDelay: [0.25, 0.35] } }, habit: { descant: 0.75 } },
      { id: "girl", en: "the girl with the clear, plain voice", parts: ["S"], voice: { confidence: [0.9, 0.95], brightness: [0.6, 0.7], breath: [0.3, 0.4], age: "young", vibrato: { rate: [5.6, 6.0], depth: [14, 22], onsetDelay: [0.45, 0.6] } }, habit: { descant: 0.5 } },
      { id: "tenor", en: "the tenor who takes the treble verse", parts: ["T"], voice: { confidence: [0.95, 0.99], brightness: [0.62, 0.7], breath: [0.25, 0.32], vibrato: { rate: [5.3, 5.7], depth: [32, 42], onsetDelay: [0.3, 0.4] } }, habit: { descant: 0.35 } },
      { id: "mezzo", en: "the warm mezzo", parts: ["S"], voice: { confidence: [0.94, 0.98], brightness: [0.52, 0.6], breath: [0.25, 0.32], vibrato: { rate: [5.2, 5.6], depth: [36, 44], onsetDelay: [0.3, 0.4] } }, habit: { descant: 0.6 } },
    ],
    oldbass: [
      { id: "patriarch", en: "the patriarch: flat, late, huge", parts: ["B"], voice: { age: "old", confidence: [0.78, 0.85], brightness: [0.25, 0.32], pitchHabitCents: [-28, -16], timingHabitMs: [80, 110], level: [1.25, 1.4] } },
      { id: "rancher", en: "the rancher: late, and a little under the note", parts: ["B"], voice: { age: "old", confidence: [0.75, 0.82], brightness: [0.3, 0.38], pitchHabitCents: [-18, -10], timingHabitMs: [70, 95], level: [1.2, 1.3] } },
      { id: "cantor", en: "the old basso profundo, slow to move", parts: ["B"], voice: { age: "old", confidence: [0.85, 0.9], brightness: [0.22, 0.28], pitchHabitCents: [-22, -12], timingHabitMs: [90, 120], level: [1.3, 1.45] } },
    ],
    alto: [
      { id: "knows", en: "the alto who knows every part", parts: ["A"], voice: { confidence: [0.94, 0.98], brightness: [0.58, 0.66], pitchHabitCents: [-3, 3], timingHabitMs: [-5, 10], vibrato: { rate: [5.3, 5.7], depth: [30, 38], onsetDelay: [0.35, 0.45] } } },
      { id: "choir", en: "the choir alto, dark and steady", parts: ["A"], voice: { confidence: [0.93, 0.97], brightness: [0.45, 0.55], pitchHabitCents: [-4, 2], timingHabitMs: [0, 12], vibrato: { rate: [5.0, 5.4], depth: [34, 42], onsetDelay: [0.3, 0.4] } } },
      { id: "sister", en: "the sister who harmonizes by ear", parts: ["A"], voice: { confidence: [0.88, 0.94], brightness: [0.6, 0.7], pitchHabitCents: [-2, 5], timingHabitMs: [5, 20], vibrato: { rate: [5.6, 6.0], depth: [22, 30], onsetDelay: [0.4, 0.55] } } },
    ],
    enthusiast: [
      { id: "brother", en: "the loud brother, a little sharp, joyful", parts: ["T", "B"], voice: { confidence: [0.95, 0.99], brightness: [0.7, 0.8], pitchHabitCents: [8, 16], timingHabitMs: [-15, 0], level: [1.35, 1.5] } },
      { id: "sister", en: "the sister who sings sharp and gladly", parts: ["S"], voice: { confidence: [0.95, 0.99], brightness: [0.72, 0.8], pitchHabitCents: [10, 18], timingHabitMs: [-12, 2], level: [1.3, 1.45] } },
      { id: "convert", en: "the new convert who sings everything at full voice", parts: ["S", "T"], voice: { confidence: [0.9, 0.96], brightness: [0.68, 0.76], pitchHabitCents: [6, 12], timingHabitMs: [-5, 8], level: [1.35, 1.5] } },
    ],
    child: [
      { id: "loses", en: "the child who loses the words", parts: ["child"], voice: { age: "young", confidence: [0.5, 0.6], brightness: [0.55, 0.65], breath: [0.6, 0.75], timingHabitMs: [30, 55] }, habit: { loses: 0.7 } },
      { id: "high", en: "the child who sings a little too high", parts: ["child"], voice: { age: "young", confidence: [0.55, 0.65], brightness: [0.6, 0.7], breath: [0.55, 0.7], pitchHabitCents: [6, 14], timingHabitMs: [20, 40] }, habit: { loses: 0.4 } },
      { id: "shy", en: "the shy child, soft and late", parts: ["child"], voice: { age: "young", confidence: [0.42, 0.52], brightness: [0.5, 0.6], breath: [0.65, 0.8], timingHabitMs: [50, 80], level: [0.8, 0.9] }, habit: { loses: 0.55 } },
    ],
    newcomer: [
      { id: "convert", en: "the convert from the far ward: doesn't know the tune", parts: ["S", "A", "T", "B"], voice: { confidence: [0.3, 0.42], timingHabitMs: [70, 120], pitchHabitCents: [-12, 12], level: [0.8, 0.9] }, habit: { joinsLine: 1 } },
      { id: "visitor", en: "the visitor who follows a beat behind", parts: ["S", "A", "T", "B"], voice: { confidence: [0.35, 0.48], timingHabitMs: [90, 140], pitchHabitCents: [-8, 8], level: [0.85, 0.95] }, habit: { joinsLine: 1 } },
      { id: "shy", en: "the shy newcomer who comes in on the third line", parts: ["S", "A", "T", "B"], voice: { confidence: [0.28, 0.38], timingHabitMs: [60, 100], pitchHabitCents: [-10, 10], level: [0.75, 0.85] }, habit: { joinsLine: 2 } },
    ],
    testimony: [
      { id: "widow", en: "the widow", parts: ["S", "A"], voice: {}, habit: { rate: [2.4, 3.0], range: [3, 5], contour: "falling", pauses: [0.5, 0.9] } },
      { id: "missionary", en: "the returned missionary", parts: ["T", "B"], voice: {}, habit: { rate: [3.6, 4.4], range: [5, 8], contour: "arch", pauses: [0.2, 0.4] } },
      { id: "father", en: "the young father", parts: ["T", "B"], voice: {}, habit: { rate: [3.0, 3.6], range: [4, 6], contour: "rising", pauses: [0.3, 0.6] } },
      { id: "pioneer", en: "the old pioneer", parts: ["B", "T"], voice: { age: "old" }, habit: { rate: [2.2, 2.8], range: [4, 7], contour: "arch", pauses: [0.6, 1.1] } },
      { id: "teen", en: "the teenager, quick and bright", parts: ["S", "T"], voice: { age: "young" }, habit: { rate: [4.0, 4.8], range: [6, 9], contour: "rising", pauses: [0.15, 0.3] } },
      { id: "sister", en: "the Relief Society sister", parts: ["A", "S"], voice: {}, habit: { rate: [3.0, 3.5], range: [4, 6], contour: "arch", pauses: [0.3, 0.5] } },
      { id: "farmer", en: "the farmer of few words", parts: ["B"], voice: {}, habit: { rate: [2.0, 2.6], range: [2, 4], contour: "falling", pauses: [0.7, 1.2] } },
      { id: "teacher", en: "the Primary teacher", parts: ["S", "A"], voice: {}, habit: { rate: [3.3, 3.9], range: [5, 7], contour: "arch", pauses: [0.25, 0.45] } },
    ],
    organist: [
      { id: "victorian", en: "the Victorian: adds suspensions, swells to the amen", parts: [], habit: { style: "victorian" } },
      { id: "plain", en: "the plain one: four-square, no fuss", parts: [], habit: { style: "plain" } },
      { id: "improviser", en: "the improviser who wanders toward Ives", parts: [], habit: { style: "improviser" } },
      { id: "sister", en: "the sister at the reed organ, gentle and exact", parts: [], habit: { style: "plain" } },
      { id: "student", en: "the student, careful, a little slow", parts: [], habit: { style: "victorian" } },
    ],
  };
  var OPTIONAL = ["oldbass", "alto", "enthusiast", "child", "newcomer"];
  var PARTS = ["S", "A", "T", "B"];
  var PART_NAME = { S: "treble", A: "alto", T: "tenor", B: "bass", child: "child" };

  function rr(r, range) { return Array.isArray(range) ? r.rnd(range[0], range[1]) : range; }
  function round(x, n) { var m = Math.pow(10, n || 3); return Math.round(x * m) / m; }
  function shuffled(r, arr) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = r.rint(0, i); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // ==========================================================================
  // seat(stream, opts) → the Ward. stream: `cast:<n>` (SCORE §3); every
  // member's dice come from `member:<id>` below it, the roles' from
  // `role:<role>`, so a role left empty shifts nobody else's draws.
  //   Ward = { members: [Member…], byId, individuals: [ids…], roles: {role: id|[ids]} }
  //   Member = { id, part, k, nameDs, nameEn (dev), family, pew: {x, row},
  //              voice: {VoicesVocal spec}, role?, archetype?, habit? }
  // ==========================================================================
  function seat(stream, opts) {
    opts = opts || {};
    var fr = stream.fork("families");
    var fams = shuffled(fr, FAMILIES).slice(0, fr.rint(9, 12));
    // each family sits together: a place across the chapel, a row
    var famAt = fams.map(function () { return { x: fr.rnd(-0.8, 0.8), row: fr.rint(0, 7) }; });
    var members = [], byId = {};
    PARTS.forEach(function (part) {
      for (var k = 0; k < 8; k++) {
        var id = part + k, r = stream.fork("member:" + id);
        var woman = part === "S" || part === "A";
        var given = r.pick(woman ? WOMEN : MEN), fi = r.rint(0, fams.length - 1), fam = fams[fi];
        var m = {
          id: id, part: part, k: k,
          nameEn: given[0] + " " + fam[0], nameDs: deseret(given[1] + " " + fam[1]), family: fam[0],
          pew: { x: round(Math.max(-0.92, Math.min(0.92, famAt[fi].x + r.rnd(-0.14, 0.14))), 3), row: famAt[fi].row },
          voice: {
            part: part, age: r.pick(["young", "mid", "mid", "old"]),
            confidence: round(r.rnd(0.45, 0.9)), brightness: round(r.rnd(0.3, 0.65)), breath: round(r.rnd(0.2, 0.55)),
            pitchHabitCents: round(r.rnd(-12, 12), 2), timingHabitMs: round(r.rnd(0, 70) + r.rnd(-10, 25), 1), tractScale: round(r.rnd(0.95, 1.05)),
          },
          // how far this person strays in the Old Way, and how late they arrive
          appetite: round(r.rnd(0.3, 1)), spread: round(r.rnd(0, 0.3)),
        };
        members.push(m); byId[id] = m;
      }
    });
    // ---- the people you will come to know ----
    var roles = {}, individuals = [], taken = {};
    var pick = stream.fork("roles");
    var optional = shuffled(pick, OPTIONAL), nOpt = pick.rint(3, 5), nTest = pick.rint(2, 3);
    var filling = ["chorister", "precentor", "soloist"].concat(optional.slice(0, nOpt));
    // (keep the roster's own order, so the chart and the log read the same way every time)
    filling.sort(function (a, b) { return ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b); });
    for (var ti = 0; ti < nTest; ti++) filling.push("testimony");
    filling.push("organist");
    var testN = 0, usedArch = {};
    filling.forEach(function (role) {
      var label = role === "testimony" ? "role:testimony:" + testN++ : "role:" + role;
      // (the testimony-bearers are drawn without replacement: two young
      // fathers on one Sunday is one too many — the same single die, a
      // smaller pool)
      var pool = ROSTER[role].filter(function (a) { return !usedArch[role + ":" + a.id]; });
      var r = stream.fork(label), arch = r.pick(pool.length ? pool : ROSTER[role]);
      usedArch[role + ":" + arch.id] = true;
      var person;
      if (role === "child" || role === "organist") {
        // the child sits with a family (a mother or father in the pews); the
        // organist sits at the organ. Neither has a seat among the 32.
        var parent = members[r.rint(0, members.length - 1)];
        var nm = role === "child" ? r.pick(CHILDREN) : r.pick(r.chance(0.5) ? WOMEN : MEN);
        var fam = role === "child" ? FAMILIES.filter(function (f) { return f[0] === parent.family; })[0] : r.pick(FAMILIES);
        person = {
          id: role, part: role === "child" ? "child" : null, k: null,
          nameEn: nm[0] + " " + fam[0], nameDs: deseret(nm[1] + " " + fam[1]), family: fam[0],
          pew: role === "child" ? { x: round(Math.max(-0.92, Math.min(0.92, parent.pew.x + (r.chance(0.5) ? 0.06 : -0.06))), 3), row: parent.pew.row } : { x: 0.72, row: -1 },
          voice: role === "child" ? { part: "child", age: "young" } : null,
          appetite: round(r.rnd(0.2, 0.5)), spread: round(r.rnd(0, 0.2)),
          parent: role === "child" ? parent.id : null,
        };
        members.push(person); byId[person.id] = person;
      } else {
        var eligible = members.filter(function (m) { return m.k != null && arch.parts.indexOf(m.part) >= 0 && !taken[m.id]; });
        if (!eligible.length) eligible = members.filter(function (m) { return m.k != null && !taken[m.id]; });
        person = eligible[r.rint(0, eligible.length - 1)];
      }
      taken[person.id] = true;
      person.role = role; person.archetype = arch.id; person.archetypeEn = arch.en;
      // the archetype reshapes the voice…
      var v = arch.voice || {};
      if (person.voice) {
        Object.keys(v).forEach(function (key) {
          if (key === "vibrato") { var vb = v.vibrato; person.voice.vibrato = { rate: round(rr(r, vb.rate)), depth: round(rr(r, vb.depth)), onsetDelay: round(rr(r, vb.onsetDelay)) }; }
          else person.voice[key] = typeof v[key] === "string" ? v[key] : round(rr(r, v[key]), 3);
        });
      }
      // …and gives them habits
      var h = arch.habit || {}, habit = {};
      Object.keys(h).forEach(function (key) { habit[key] = typeof h[key] === "string" ? h[key] : round(rr(r, h[key]), 3); });
      person.habit = habit;
      // the people who lead keep time: the chorister (who sets the tempo
      // and cuts off), the precentor and the soloist are on the beat and on
      // the note, whatever habit the pew had given them (drawn last, so no
      // other die moves)
      if (LEADS[role] && person.voice) {
        person.voice.timingHabitMs = round(r.rnd(LEADS[role][0], LEADS[role][1]), 1);
        person.voice.pitchHabitCents = round(r.rnd(-LEADS[role][2], LEADS[role][2]), 2);
      }
      if (role === "testimony") (roles.testimony = roles.testimony || []).push(person.id); else roles[role] = person.id;
      individuals.push(person.id);
    });
    // who is who: no two of the people you come to know share a name, and
    // none shares one with anyone in the pews (the log and the chart name
    // them) — a clash re-draws the later one's given name, on a fork of its own
    var nameCount = {};
    members.forEach(function (m) { nameCount[m.nameDs] = (nameCount[m.nameDs] || 0) + 1; });
    individuals.forEach(function (id) {
      var m = byId[id];
      if (nameCount[m.nameDs] < 2) return;
      var rn = stream.fork("rename:" + id), list = m.part === "child" ? CHILDREN : m.part === "S" || m.part === "A" ? WOMEN : m.part === "T" || m.part === "B" ? MEN : WOMEN.concat(MEN);
      var fam = FAMILIES.filter(function (f) { return f[0] === m.family; })[0];
      for (var tries = 0; tries < 24 && nameCount[m.nameDs] > 1; tries++) {
        var g = rn.pick(list), ds = deseret(g[1] + " " + fam[1]);
        if (nameCount[ds]) continue;
        nameCount[m.nameDs]--; m.nameDs = ds; m.nameEn = g[0] + " " + fam[0]; nameCount[ds] = 1;
      }
    });
    return { members: members, byId: byId, individuals: individuals, roles: roles };
  }
  // [timing habit lo, hi (ms), pitch habit ± (cents)] for the roles that lead
  var LEADS = { chorister: [-4, 6, 4], precentor: [-5, 8, 5], soloist: [-5, 5, 4] };

  // who fills a role this Sunday (or null)
  function who(ward, role) { var id = ward.roles[role]; return id ? ward.byId[Array.isArray(id) ? id[0] : id] : null; }

  // ==========================================================================
  // THE LAYOUTS — where each member stands for a hymn. The pews (families
  // together, parts mixed, as a congregation sits); the hollow square for
  // the Sacred Harp and the psalmody (the trebles on one side, the basses
  // opposite, the tenors — with the tune — facing the leader in the middle,
  // the altos behind); the chorister before them all.
  // ==========================================================================
  var SQUARE = { S: -0.66, B: 0.66, T: 0.0, A: 0.0, child: -0.5 };
  function panOf(m, layout, ward) {
    if (ward && ward.roles.chorister === m.id) return 0;
    if (layout === "square") return Math.max(-0.9, Math.min(0.9, SQUARE[m.part] + (m.part === "T" || m.part === "A" ? (m.k % 4 - 1.5) * 0.12 : (m.k % 4 - 1.5) * 0.07)));
    return m.pew.x;
  }
  function layoutFor(dialect) { return dialect === "sacredharp" || dialect === "psalmody" ? "square" : "pews"; }

  // ==========================================================================
  // THE HYMN'S NOTES, IN SECONDS — the chorister's clock (tempo, rubato, how
  // long a fermata is held), and a part's notes laid out on it (hymn-lab's
  // way: a breath taken from each line's last note).
  // ==========================================================================
  function ratio(m) { return Math.pow(2, m[0]) * Math.pow(3, m[1]) * Math.pow(5, m[2]) * Math.pow(7, m[3] || 0); }
  function lineLenBeats(line, next) {
    if (next && next.startBeat != null && line.startBeat != null && next.startBeat > line.startBeat) return next.startBeat - line.startBeat;
    return K.Score && K.Score.lineLength ? K.Score.lineLength(line) : lengthOf(line);
  }
  function lengthOf(line) { var end = 0; for (var p in line.notes) (line.notes[p] || []).forEach(function (n) { end = Math.max(end, n.beat + n.beats); }); return end; }
  // clock(b) → seconds from the line's start to beat b: the chorister's beat,
  // a broadening toward the close (rit, 0 = strict), and the fermatas held
  // `hold` beats-worth longer than written
  function clockOf(line, beatS, rit, holdMul) {
    var len = Math.max(1, lengthOf(line)), holds = [];
    (line.fermataBeats || []).forEach(function (fb) {
      var l = 1;
      Object.keys(line.notes).forEach(function (p) { line.notes[p].forEach(function (n) { if (Math.abs(n.beat - fb) < 1e-6) l = Math.max(l, n.beats); }); });
      holds.push({ at: fb + l, extra: (holdMul - 1) * l * beatS });
    });
    return function (b) {
      var t = beatS * (b + rit * b * b * b / (3 * len * len));
      holds.forEach(function (x) { if (b >= x.at - 1e-6) t += x.extra; });
      return t;
    };
  }
  function lineSpan(line, next, beatS, rit, holdMul) {
    var clk = clockOf(line, beatS, rit, holdMul);
    return clk(lineLenBeats(line, next)) + ((line.fermataBeats || []).length ? 0.3 * beatS : 0);
  }
  // one part's notes of one line: [{t, dur, n}], t from the line's start
  function partNotes(line, next, part, beatS, rit, holdMul) {
    var clk = clockOf(line, beatS, rit, holdMul), ns = line.notes[part] || [], out = [];
    for (var k = 0; k < ns.length; k++) {
      var n = ns[k], b0 = n.beat, b1 = n.beat + n.beats;
      while (ns[k].tie && k + 1 < ns.length) { k++; b1 = ns[k].beat + ns[k].beats; }
      var st = clk(b0), dur = clk(b1) - st;
      if (k === ns.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * beatS, 0.25 * dur);   // the breath
      out.push({ t: st, dur: dur, n: n });
    }
    return out;
  }

  // who sings what, by dialect and practice: [the Score's part, octave factor]
  function assignment(hymn, m, practice) {
    var p = m.part, k = m.k, mel = hymn.melodyPart;
    if (p === "child") return [mel, mel === "T" ? 2 : 1];
    if (practice === "unison" || practice === "lined" || hymn.dialect === "oldway") {
      if (mel === "T") return [mel, p === "S" || p === "A" ? 2 : 1];
      return [mel, p === "T" || p === "B" ? 0.5 : 1];
    }
    if (hymn.dialect === "sacredharp" || hymn.dialect === "psalmody") {
      // the treble and the tenor doubled in octaves (six parts, really)
      if (p === "S") return k < 6 ? ["S", 1] : ["T", 2];
      if (p === "T") return k < 6 ? ["T", 1] : ["S", 0.5];
      if (p === "A") return hymn.lines[0].notes.A ? ["A", 1] : (k < 4 ? ["S", 1] : ["T", 2]);
      return ["B", 1];
    }
    if (!hymn.lines[0].notes[p]) return [mel, p === "T" || p === "B" ? 0.5 : 1];
    return [p, 1];
  }

  var SHAPES = ["fa", "sol", "la", "fa", "sol", "la", "mi"];
  var VOWELS = [["ah", 3], ["oh", 2], ["ee", 2], ["oo", 1.5], ["eh", 1.5]];
  function doOf(mode) { return K.Composer && K.Composer.doOf ? K.Composer.doOf(mode) : 0; }
  function shapeOf(hymn, deg) { return SHAPES[((deg - doOf(hymn.mode)) % 7 + 7) % 7]; }
  function spelled(hymn, deg, alt) {
    if (K.Composer && K.Composer.spelledMonzo) return K.Composer.spelledMonzo(hymn.mode, deg, alt || 0);
    return null;
  }

  // ==========================================================================
  // planHymn(ward, hymn, stream, opts) → the plan. stream: the hymn's
  // `performance` fork (hymn:<n>:<i> → performance). Every die is thrown
  // whether or not it is used.
  //   opts = { verses (default drawn by dialect), organ (the hymn is
  //            accompanied: the organ gives out the tune, no keying),
  //            first (the day's first hymn: the newcomer's) }
  // → { hymnId, dialect, layout, keying: {kind, by, habit} | null,
  //     verses: [Performance + { forward: [{memberId, role, action, lines, gainDb}], vowelsSeed }],
  //     tempoMul, rubato, holdMul, amen }
  // ==========================================================================
  var PRACTICE_DO = { sung: "sings", notes: "sings on the notes", lined: "lines out", hummed: "hums", unison: "sings in unison", descant: "sings the descant" };
  function planHymn(ward, hymn, stream, opts) {
    opts = opts || {};
    var dl = hymn.dialect, nLines = hymn.lines.length + (hymn.refrain ? hymn.refrain.length : 0);
    var ch = who(ward, "chorister") || ward.members[0], chH = ch.habit || {};
    var r = stream;
    // the dice
    var dVerses = r.rint(0, 99), dHum = r.rnd(0, 1), dUni = r.rnd(0, 1), dDesc = r.rnd(0, 1), dTreble = r.rnd(0, 1), dEnth = r.rnd(0, 1),
        dChildV = r.rnd(0, 1), dAltoV = r.rnd(0, 1), dBassV = r.rnd(0, 1), dKeyAcc = r.rnd(0, 1), dNotesAll = r.rnd(0, 1), dOrder = r.rnd(0, 1);
    var verses = opts.verses || (dl === "tabernacle" ? 3 + (dVerses % 2) : dl === "oldway" ? 2 : 2 + (dVerses % 2));
    var organ = !!opts.organ;
    var tempoMul = chH.tempoMul || 1, rubato = chH.rubato || 0.05, holdMul = chH.holdMul || 1.6;
    // ---- the keying ----
    var keying = null;
    if (dl === "sacredharp" || dl === "psalmody") keying = { kind: "pitching", by: ch.id, habit: "hum" };
    else if (!organ) keying = { kind: "keying", by: ch.id, habit: chH.keying || "hum" };
    else if (dKeyAcc < 0.2) keying = { kind: "keying", by: ch.id, habit: "hum", under: true };   // hummed to the ward as the organ's introduction ends
    // ---- the practices ----
    var practice = [];
    for (var v = 0; v < verses; v++) {
      var p = "sung";
      if (dl === "oldway") p = "lined";
      else if (dl === "sacredharp" && v === 0) p = "notes";
      else if (dl === "sacredharp" && dNotesAll < 0.1) p = "notes";                   // (some classes sing every verse on the notes)
      else if (dl === "tabernacle" && v === verses - 1 && verses >= 3 && who(ward, "soloist") && dDesc < (who(ward, "soloist").habit.descant || 0.5)) p = "descant";
      else if (dl === "tabernacle" && v > 0 && v < verses - 1 && dHum < 0.14) p = "hummed";
      else if (v > 0 && v < verses - 1 && dUni < 0.1) p = "unison";
      practice.push(p);
    }
    // ---- who comes forward ----
    var fwd = practice.map(function () { return []; });
    function busy(vv, lines) { var n = 0; fwd[vv].forEach(function (f) { if (f.lines.some(function (li) { return lines.indexOf(li) >= 0; })) n++; }); return n; }
    function add(vv, role, action, lines, gainDb) {
      var m = who(ward, role);
      if (!m || vv < 0 || vv >= verses) return false;
      if (busy(vv, lines) >= 2) return false;                                          // never more than two at once
      if (fwd[vv].some(function (f) { return f.action === "sings the treble verse"; })) return false;   // her verse is hers alone
      if (vv > 0 && fwd[vv - 1].some(function (f) { return f.memberId === m.id && role !== "precentor"; })) return false;   // never two verses running
      fwd[vv].push({ memberId: m.id, role: role, action: action, lines: lines, gainDb: gainDb });
      return true;
    }
    var all = []; for (var li = 0; li < nLines; li++) all.push(li);
    var tail = all.slice(Math.max(0, nLines - 2));
    if (dl === "oldway") for (var vo = 0; vo < verses; vo++) add(vo, "precentor", "lines out", all, 4);
    if (opts.first && who(ward, "newcomer")) {
      var jl = Math.min(nLines - 1, who(ward, "newcomer").habit.joinsLine || 1);
      add(0, "newcomer", "joins in", all.slice(jl, jl + 1), 3);
    }
    if (practice.indexOf("descant") >= 0) add(practice.indexOf("descant"), "soloist", "sings the descant", all, 5);
    else if (dl === "tabernacle" && verses >= 3 && dTreble < 0.22) add(1, "soloist", "sings the treble verse", all, 4);
    // the middle verses: the alto, the child, the old bass — in an order the dice choose
    var mids = []; for (var vm = dl === "sacredharp" ? 1 : 0; vm < verses; vm++) mids.push(vm);
    var order = dOrder < 0.33 ? ["alto", "child", "oldbass"] : dOrder < 0.66 ? ["child", "oldbass", "alto"] : ["oldbass", "alto", "child"];
    var wants = { alto: dAltoV, child: dChildV, oldbass: dBassV };
    order.forEach(function (role, oi) {
      if (!who(ward, role)) return;
      if (role === "alto" && !hymn.lines[0].notes.A) return;                            // no alto part to hear
      var start = Math.floor(wants[role] * mids.length);
      for (var tryN = 0; tryN < mids.length; tryN++) {
        var vv = mids[(start + tryN + oi) % mids.length];
        if (practice[vv] === "hummed" && role !== "alto") continue;
        var lines = role === "oldbass" ? tail : all;
        var act = role === "alto" ? "comes forward" : role === "child" ? "sings the tune" : "comes forward";
        if (add(vv, role, act, lines, role === "oldbass" ? 5 : role === "child" ? 4 : 4)) break;
      }
    });
    if (who(ward, "enthusiast") && dEnth < 0.75) add(verses - 1, "enthusiast", "sings out", all, 3);
    // ---- the Performances (SCORE §5.1) ----
    var singers = ward.members.filter(function (m) { return m.k != null; }).map(function (m) { return m.id; });
    var perf = practice.map(function (p, vi) {
      var o = {
        hymnId: hymn.id, verse: vi, practice: p, tempoMul: round(tempoMul * (dl === "oldway" ? 1 : 1), 3), rubato: round(rubato, 3),
        organ: organ && p !== "hummed" ? { registration: [verses >= 3 && vi === verses - 1 ? "full organ" : "hymn principal"] } : null,
        singers: singers.slice().concat(fwd[vi].some(function (f) { return f.role === "child"; }) ? ["child"] : []),
        forward: fwd[vi],
      };
      return K.Score && K.Score.performance ? K.Score.performance(o) : o;
    });
    return {
      hymnId: hymn.id, dialect: dl, layout: layoutFor(dl), keying: keying, verses: perf,
      tempoMul: round(tempoMul, 3), rubato: round(rubato, 3), holdMul: round(holdMul, 3), organ: organ,
      amen: !!hymn.amen, first: !!opts.first, chorister: ch.id,
    };
  }

  // ==========================================================================
  // THE DESCANT — the soloist's line over the last verse: a chord tone above
  // the tune for each chord, held (one note to a chord, repeats tied), close
  // to the note before (a common tone, else a step), ending on the third or
  // the octave above do. Pure; its only die is a tie-break.
  // ==========================================================================
  function descantLine(hymn, line, r) {
    var mel = line.notes[hymn.melodyPart] || [], d0 = doOf(hymn.mode), out = [], prev = null;
    var chords = (line.chords || []).slice().sort(function (a, b) { return a.beat - b.beat; });
    if (!chords.length || !mel.length) return mel.map(function (n) { return n; });
    chords.forEach(function (c, ci) {
      var melAt = mel.filter(function (n) { return n.beat <= c.beat + 1e-6; }).pop() || mel[0];
      var top = Math.max.apply(null, mel.filter(function (n) { return n.beat < c.beat + c.len - 1e-6 && n.beat + n.beats > c.beat + 1e-6; }).map(function (n) { return n.deg; }).concat([melAt.deg]));
      var tones = (c.tones || [[c.rootDeg, 0], [c.rootDeg + 2, 0], [c.rootDeg + 4, 0]]), cand = [];
      tones.forEach(function (tn) {
        for (var o = -1; o <= 3; o++) {
          var dg = ((tn[0] % 7) + 7) % 7 + 7 * o;
          // above the tune by a third or more, inside the descant's compass (do′ to sol″, relative to do)
          if (dg >= top + 2 && dg - d0 >= 7 && dg - d0 <= 11) cand.push({ deg: dg, alt: tn[1] || 0 });
        }
      });
      if (!cand.length) cand.push({ deg: Math.max(top + 2, d0 + 7), alt: 0 });
      var last = ci === chords.length - 1 && line.cadence && line.cadence.kind !== "half";
      var tie = r.rnd(0, 1);
      cand.sort(function (a, b) {
        function cost(x) { var c1 = prev ? Math.abs(x.deg - prev.deg) : Math.abs(x.deg - (d0 + 9)); if (last) c1 += Math.abs(x.deg - (d0 + 9)) * 0.8; return c1 + (x.alt ? 0.5 : 0); }
        return cost(a) - cost(b) || (tie < 0.5 ? a.deg - b.deg : b.deg - a.deg);
      });
      var pickC = cand[0];
      if (prev && prev.deg === pickC.deg && prev.alt === pickC.alt) { prev.beats += c.len; return; }
      var syl = melAt.syl != null ? melAt.syl : 0;
      prev = { beat: c.beat, beats: c.len, deg: pickC.deg, alt: pickC.alt, monzo: spelled(hymn, pickC.deg, pickC.alt), syl: syl, stress: melAt.stress, tie: false, fermata: false };
      out.push(prev);
    });
    // the melody's rests and fermatas stay the melody's: the descant ends with the line
    var endB = mel[mel.length - 1].beat + mel[mel.length - 1].beats;
    if (out.length) out[out.length - 1].beats = endB - out[out.length - 1].beat;
    return out.filter(function (n) { return n.monzo; });
  }

  // ==========================================================================
  // The Old Way's decorations, at the places the composer marked, by a
  // singer's own appetite (hymn-lab's; the performer's work, PLAN §3 F).
  // ==========================================================================
  function decorate(hymn, notes, r, appetite, base) {
    var out = [];
    notes.forEach(function (x) {
      var d1 = r.rnd(0, 1), d2 = r.rnd(0, 1);
      if (x.rest || !x._n || !x._n.ornament || d1 > appetite) { out.push(x); return; }
      var n = x._n, oct = x.f / (base * ratio(n.monzo));
      function nb(step) { var m = spelled(hymn, n.deg + step, 0); return m ? base * ratio(m) * oct : x.f; }
      var c = function (o) { var y = {}; for (var k in x) y[k] = x[k]; for (k in o) y[k] = o[k]; return y; };
      if (n.ornament === "turn" && x.dur > 0.9) {
        var q = Math.min(0.2, x.dur * 0.1);
        if (d2 < 0.6) out.push(c({ dur: x.dur - 4 * q }), c({ f: nb(1), dur: q, slur: true }), c({ dur: q, slur: true }), c({ f: nb(-1), dur: q, slur: true }), c({ dur: q, slur: true }));
        else out.push(c({ dur: x.dur * 0.6 }), c({ f: nb(1), dur: x.dur * 0.22, slur: true, slide: true }), c({ dur: x.dur * 0.18, slur: true }));
      } else if (n.ornament === "slide") out.push(c({ slide: true }));
      else if (n.ornament === "grace" && x.dur > 0.4) out.push(c({ f: nb(1), dur: 0.1 }), c({ dur: x.dur - 0.1, slur: true }));
      else out.push(x);
    });
    return out;
  }

  // ==========================================================================
  // score(ward, hymn, plan, opts) → the cue sheet. Pure.
  //   opts = { keynoteHz (the day's keynote, default 261.63), stream (the
  //            plan's stream again: the vowels of each verse and the Old
  //            Way's ornaments are drawn below it) }
  // → { cues: [Cue…], organ: [OrganCue…], events: [typed events], end,
  //     joins: [{t, kind: "note"|"line"}] (for the benches), forwardAt: [...] }
  //   Cue = { at, memberId, bus: "hall"|"near", pan, gain, notes: [{f, dur,
  //           vowel, stress, slur, slide}], breathBefore (the silence since
  //           this singer's own last note), what, verse, line }
  //   OrganCue = { at, notes: [{f, dur, at, pedal, v}], registration }
  // ==========================================================================
  var WARD_GAIN = 1 / Math.sqrt(8);
  function score(ward, hymn, plan, opts) {
    opts = opts || {};
    var R = opts.stream, keynote = opts.keynoteHz || 261.63, base = keynote * ratio(hymn.keyMonzo || [0, 0, 0, 0]);
    var cues = [], organ = [], events = [], joins = [], t = 0;
    var ch = ward.byId[plan.chorister] || ward.members[0];
    var beat0 = hymn.beatS / (plan.tempoMul || 1);
    var lines = hymn.lines.concat(hymn.refrain || []);
    var seated = ward.members.filter(function (m) { return m.k != null; });
    function ev(type, at, payload) { var e = { type: type, t: round(at, 3) }; for (var k in payload) e[k] = payload[k]; events.push(e); }
    function castEv(at, m, action) { ev("cast", at, { memberId: m.id, nameDs: m.nameDs, action: action }); }
    // a person's moment ends: they blend back into the ward (nobody moves —
    // "forward" is only how near they are heard); the newcomer, once in,
    // simply keeps singing
    function stepBack(at, id) {
      var m = ward.byId[id];
      if (m.role === "newcomer") return;
      castEv(at, m, m.role === "precentor" ? "falls silent" : "blends back into the ward");
    }
    function hz(monzo, oct) { return base * ratio(monzo) * oct; }
    function panFor(m) { return panOf(m, plan.layout, ward); }

    ev("hymn-announced", 0, { hymn: { id: hymn.id, number: hymn.number, nameDs: hymn.nameDs, meter: hymn.meter, dialect: hymn.dialect, authorDs: hymn.hymnist ? hymn.hymnist.nameDs : null }, leaderDs: ch.nameDs });

    // ---- the organ gives out the tune (accompanied hymns): its last line alone ----
    if (plan.organ) {
      var lastI = hymn.lines.length - 1, gl = hymn.lines[lastI];
      organ.push({ at: round(t, 4), notes: organNotes(gl, null, beat0, 0.02, plan.holdMul), registration: "hymn principal", giveOut: true });
      t += lineSpan(gl, null, beat0, 0.02, plan.holdMul) + 0.9 * beat0;
    }
    // ---- the keying, or the pitching ----
    var first = firstNotes(hymn, lines[0]);
    if (plan.keying && plan.keying.kind === "keying") t = keyIt(t, plan.keying);
    else if (plan.keying && plan.keying.kind === "pitching") t = pitchIt(t);

    // ---- the verses ----
    plan.verses.forEach(function (P, vi) {
      var lastVerse = vi === plan.verses.length - 1;
      var vr = R ? R.fork("vowels:" + vi) : null, vowels = [];
      for (var i = 0; i < 400; i++) vowels.push(vr ? pickW(vr, VOWELS) : "ah");
      var vowelOf = function (n) {
        if (P.practice === "notes") return shapeOf(hymn, n.deg);
        if (P.practice === "hummed") return "hum";
        return n.syl != null ? vowels[n.syl] : null;
      };
      ev("verse-start", t, { hymnId: hymn.id, verse: vi, practice: P.practice });
      var fwdOn = {};
      lines.forEach(function (line, li) {
        var next = lines[li + 1] || null, lastLine = lastVerse && li === lines.length - 1;
        var rit = lastLine ? (plan.rubato || 0) * 2.2 : (plan.rubato || 0) * 0.35;
        var bs = beat0 * (P.practice === "hummed" ? 1.06 : 1);
        // who is forward on this line
        var fw = {};
        (P.forward || []).forEach(function (f) { if (f.lines.indexOf(li) >= 0) fw[f.memberId] = f; });
        Object.keys(fw).forEach(function (id) { if (!fwdOn[id]) { castEv(t, ward.byId[id], fw[id].action); fwdOn[id] = true; } });
        Object.keys(fwdOn).forEach(function (id) { if (fwdOn[id] && !fw[id]) { stepBack(t, id); fwdOn[id] = false; } });

        if (P.practice === "lined") {
          // the precentor lines the line out, quickly, ornamented; the ward answers it slowly
          var pre = ward.byId[ward.roles.precentor] || ch, pace = (pre.habit && pre.habit.pace) || 0.42;
          var pn = partNotes(line, next, hymn.melodyPart, beat0 * pace, 0, 1.2);
          var pOct = hymn.melodyPart === "S" ? (pre.part === "T" || pre.part === "B" ? 0.5 : 1) : 1;
          var pSung = toSung(pn, 0, function (n) { return hz(n.monzo, pOct); }, function (n) { return vowels[n.syl != null ? n.syl : 0]; });
          var orn = R ? R.fork("precentor:" + vi + ":" + li) : null;
          if (orn && K.VoicesVocal && K.VoicesVocal.ornament) pSung = K.VoicesVocal.ornament(pSung, orn, { amount: (pre.habit && pre.habit.appetite) || 0.7, tonicHz: base, scale: K.Pitch ? K.Pitch.COLLECTIONS[hymn.mode].ratios : null });
          cues.push({ at: round(t, 4), memberId: pre.id, bus: "near", pan: 0.05, gain: 0.75, notes: strip(pSung), breathBefore: 0.4, what: "lines out", verse: vi, line: li, forward: true });
          pn.forEach(function (x, k) { joins.push({ t: round(t + x.t, 4), kind: k ? "note" : "line" }); });
          t += (pn.length ? pn[pn.length - 1].t + pn[pn.length - 1].dur : 0) + 0.35;
        }
        var t0 = t, span = lineSpan(line, next, bs, rit, plan.holdMul);
        var bb = li === 0 && vi === 0 ? 0.6 : Math.min(0.3 * bs, 0.35);
        // everyone who sings this line
        var singers = seated.slice();
        if (fw.child) singers.push(ward.byId.child);
        singers.forEach(function (m) {
          var f = fw[m.id], role = m.role;
          if (f && f.role === "precentor") f = null;                                     // (the reply is the ward's)
          // the newcomer does not know the day's first hymn: silent until the line they join on
          if (role === "newcomer" && plan.first && vi === 0) {
            var joinL = (m.habit && m.habit.joinsLine) || 1;
            if (li < joinL) return;
          }
          var asg = assignment(hymn, m, P.practice === "descant" && role === "soloist" ? "sung" : P.practice), part = asg[0], oct = asg[1];
          if (f && f.action === "sings the treble verse") { part = hymn.melodyPart; oct = hymn.melodyPart === "S" && (m.part === "T" || m.part === "B") ? 0.5 : 1; }
          var off = P.practice === "lined" ? m.spread * bs * 0.6 : 0;
          var pn2 = partNotes(line, next, part, bs, rit, plan.holdMul);
          var vOf = vowelOf;
          // the child loses the words of one line (hums), and finds them in the next
          if (role === "child" && m.habit && R) {
            var cr = R.fork("child:" + vi), lose = cr.rnd(0, 1) < (m.habit.loses || 0.5), lostLine = cr.rint(0, lines.length - 2);   // one fork, two draws
            if (lose && li === lostLine) { vOf = function () { return "hum"; }; castEv(t0, m, "loses the words"); }
            if (lose && li === lostLine + 1) castEv(t0, m, "finds them again");
          }
          var notes, gain = WARD_GAIN, bus = "hall";
          if (f && role === "soloist" && P.practice === "descant") {
            var dr = R ? R.fork("descant:" + li) : { rnd: function () { return 0.5; } };
            var dn = descantLine(hymn, line, dr), clk = clockOf(line, bs, rit, plan.holdMul);
            notes = dn.map(function (n, k) {
              var st = clk(n.beat), dur = clk(n.beat + n.beats) - st;
              if (k === dn.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * bs, 0.25 * dur);
              return { t: st, dur: dur, n: n };
            });
            notes = toSung(notes, 0, function (n) { return hz(n.monzo, 1); }, vOf);
          } else {
            notes = toSung(pn2, 0, function (n) { return hz(n.monzo, oct); }, vOf);
            if (P.practice === "lined" && R) notes = decorate(hymn, notes, R.fork("orn:" + m.id + ":" + vi + ":" + li), m.appetite, base);
          }
          if (!notes.length) return;
          if (f) { bus = "near"; gain = WARD_GAIN * Math.pow(10, (f.gainDb || 4) / 20); }
          // (a soloist singing the treble verse sings alone: the ward rests)
          cues.push({ at: round(t0 + off + (notes[0].rest ? 0 : 0), 4), memberId: m.id, bus: bus, pan: panFor(m), gain: round(gain * (P.practice === "lined" ? 0.9 : 1), 4),
                      notes: strip(notes), breathBefore: round(bb, 3), what: P.practice, verse: vi, line: li, forward: !!f });
        });
        // the soloist's treble verse: the rest of the ward is silent under her
        if ((P.forward || []).some(function (f) { return f.action === "sings the treble verse"; })) {
          var solo = ward.roles.soloist;
          for (var ci = cues.length - 1; ci >= 0 && cues[ci].verse === vi && cues[ci].line === li; ci--) if (cues[ci].memberId !== solo) cues.splice(ci, 1);
        }
        // the organ under the line (accompanied, and not while the ward hums)
        if (plan.organ && P.organ) organ.push({ at: round(t0, 4), notes: organNotes(line, next, bs, rit, plan.holdMul), registration: P.organ.registration[0] });
        // the joins, for the benches: every part's onsets
        var on = [];
        Object.keys(line.notes).forEach(function (p) { partNotes(line, next, p, bs, rit, plan.holdMul).forEach(function (x) { on.push(t0 + x.t); }); });
        on.sort(function (a, b) { return a - b; });
        var lastJ = -1;
        on.forEach(function (x) { if (x - lastJ > 0.03) { joins.push({ t: round(x, 4), kind: Math.abs(x - t0) < 0.01 ? "line" : "note" }); lastJ = x; } });
        t = t0 + span + (P.practice === "lined" ? 0.5 : 0);
      });
      Object.keys(fwdOn).forEach(function (id) { if (fwdOn[id]) stepBack(t, id); });
      if (P.practice !== "lined" && !lastVerse) t += 1.1 * beat0;
    });
    // ---- the amen (the Tabernacle's) ----
    if (plan.amen && hymn.amen) {
      t += 0.3 * beat0;
      var t0a = t;
      seated.forEach(function (m) {
        var asg = assignment(hymn, m, "sung"), pn3 = partNotes(hymn.amen, null, asg[0], beat0, (plan.rubato || 0) * 1.5, plan.holdMul);
        var notes = toSung(pn3, 0, function (n) { return hz(n.monzo, asg[1]); }, function (n) { return n.beat === 0 ? "ah" : "eh"; });
        if (notes.length) cues.push({ at: round(t0a, 4), memberId: m.id, bus: "hall", pan: panFor(m), gain: round(WARD_GAIN, 4), notes: strip(notes), breathBefore: 0.35, what: "amen", verse: plan.verses.length - 1, line: -1 });
      });
      if (plan.organ) organ.push({ at: round(t0a, 4), notes: organNotes(hymn.amen, null, beat0, (plan.rubato || 0) * 1.5, plan.holdMul), registration: "hymn principal" });
      t = t0a + lineSpan(hymn.amen, null, beat0, (plan.rubato || 0) * 1.5, plan.holdMul);
    }
    cues.sort(function (a, b) { return a.at - b.at; });
    // the breath each singer really has before each line: the silence since
    // their own last note (the voices fit the inhale inside it; the figures
    // above stand only for a singer's first line of the hymn)
    var lastEnd = {};
    cues.forEach(function (c) {
      var len = 0; c.notes.forEach(function (n) { len += n.dur; });
      if (lastEnd[c.memberId] != null) c.breathBefore = round(Math.max(0, Math.min(0.8, c.at - lastEnd[c.memberId])), 3);
      lastEnd[c.memberId] = Math.max(lastEnd[c.memberId] != null ? lastEnd[c.memberId] : -1e9, c.at + len);
    });
    events.sort(function (a, b) { return a.t - b.t; });
    return { hymnId: hymn.id, cues: cues, organ: organ, events: events, joins: joins, end: round(t, 3) };

    // --- the keying: the chorister gives the key in her habit, then a breath ---
    function keyIt(at, k) {
      var m = ward.byId[k.by] || ch, part = m.part;
      // her octave: do near the middle of her part
      var mid = { S: 392, A: 294, T: 220, B: 147 }[part] || 262, doHz = keynote * ratio(hymn.keyMonzo || [0, 0, 0, 0]);
      while (doHz < mid / 1.45) doHz *= 2; while (doHz > mid * 1.45) doHz /= 2;
      var firstM = first.melody || first.S || first.T, fHz = firstM ? keynote * ratio(hymn.keyMonzo || [0, 0, 0, 0]) * ratio(firstM.monzo) : doHz;
      while (fHz < doHz / 1.5) fHz *= 2; while (fHz > doHz * 1.9) fHz /= 2;
      var d0 = doOf(hymn.mode), notes;
      function deg(d) { var mz = spelled(hymn, d0 + d, 0); return mz ? doHz * ratio(mz) / ratio(spelled(hymn, d0, 0)) : doHz; }
      if (k.habit === "fasola") notes = [{ f: deg(0), dur: 0.5, vowel: "fa" }, { f: deg(1), dur: 0.5, vowel: "sol" }, { f: deg(2), dur: 0.7, vowel: "la" }, { rest: true, dur: 0.25 }, { f: fHz, dur: 0.9, vowel: firstM ? shapeOf(hymn, firstM.deg) : "fa" }];
      else if (k.habit === "fifth") notes = [{ f: deg(-3), dur: 0.6, vowel: "sol" }, { f: deg(0), dur: 0.9, vowel: "fa" }, { rest: true, dur: 0.3 }, { f: fHz, dur: 0.9, vowel: "hum" }];
      else notes = [{ f: deg(0), dur: 1.0, vowel: "hum" }].concat(Math.abs(fHz / deg(0) - 1) > 0.01 ? [{ rest: true, dur: 0.2 }, { f: fHz, dur: 0.9, vowel: "hum" }] : []);
      var at2 = k.under ? Math.max(0, at - 2.2) : at;
      cues.push({ at: round(at2, 4), memberId: m.id, bus: "near", pan: 0, gain: 0.5, notes: notes, breathBefore: 0.5, what: "keying", verse: -1, line: -1, forward: true });
      castEv(at2, m, k.under ? "hums the first note" : "keys the hymn");
      var len = notes.reduce(function (s, n) { return s + n.dur; }, 0);
      return k.under ? at : at2 + len + 0.75;
    }
    // --- the pitching (Sacred Harp, psalmody): the keyer's tonic, then each
    // section's first note on top of it, a chord of every voice, a breath ---
    function pitchIt(at) {
      var m = ward.byId[plan.keying.by] || ch, pr = R ? R.fork("pitching") : { rnd: function (a, b) { return (a + b) / 2; } };
      var tenorDo = base; while (tenorDo < 150) tenorDo *= 2; while (tenorDo > 300) tenorDo /= 2;
      var keyerHz = m.part === "S" || m.part === "A" ? tenorDo * 2 : tenorDo;
      var tonicLen = pr.rnd(0.8, 1.1);
      cues.push({ at: round(at, 4), memberId: m.id, bus: "near", pan: 0, gain: 0.42, notes: [{ f: keyerHz, dur: tonicLen + 0.3, vowel: "hum" }], breathBefore: 0.5, what: "pitching", verse: -1, line: -1, forward: true });
      castEv(at, m, "pitches the tune");
      var entries = { T: pr.rnd(0.65, 0.85), B: pr.rnd(1.05, 1.35), S: pr.rnd(1.4, 1.7), A: pr.rnd(1.75, 2.05) };
      var holdTo = pr.rnd(3.3, 4.1);
      seated.forEach(function (x) {
        if (x.id === m.id) return;
        var asg = assignment(hymn, x, "sung"), fn = (lines[0].notes[asg[0]] || [])[0];
        if (!fn) return;
        var enter = entries[x.part] + pr.rnd(-0.1, 0.18);
        cues.push({ at: round(at + enter, 4), memberId: x.id, bus: "hall", pan: panFor(x), gain: round(WARD_GAIN * 0.8, 4),
                    notes: [{ f: hz(fn.monzo, asg[1]), dur: Math.max(0.6, holdTo - enter + pr.rnd(-0.12, 0.12)), vowel: "hum" }], breathBefore: 0.4, what: "pitching", verse: -1, line: -1 });
      });
      // the keyer joins the chord on her own section's note
      var ka = assignment(hymn, m, "sung"), kf = (lines[0].notes[ka[0]] || [])[0];
      if (kf) cues.push({ at: round(at + tonicLen + 0.35, 4), memberId: m.id, bus: "hall", pan: 0, gain: round(WARD_GAIN, 4), notes: [{ f: hz(kf.monzo, ka[1]), dur: Math.max(0.6, holdTo - tonicLen - 0.35), vowel: "hum" }], breathBefore: 0.2, what: "pitching", verse: -1, line: -1 });
      return at + holdTo + pr.rnd(0.55, 0.8);
    }
    // --- the organ's notes for a line (every part, the bass on the pedal) ---
    function organNotes(line, next, bs, rit, hm) {
      var notes = [];
      ["S", "A", "T", "B"].forEach(function (p) {
        partNotes(line, next, p, bs, rit, hm).forEach(function (x) { notes.push({ f: round(hz(x.n.monzo, 1), 3), dur: round(x.dur, 4), at: round(x.t, 4), pedal: p === "B", v: p === "S" ? 1 : 0.8 }); });
      });
      return notes;
    }
  }
  function firstNotes(hymn, line) {
    var out = {};
    ["S", "A", "T", "B"].forEach(function (p) { if (line.notes[p] && line.notes[p][0]) out[p] = line.notes[p][0]; });
    out.melody = out[hymn.melodyPart];
    return out;
  }
  // a part's timed notes → a singer's line (rests between, from t0)
  function toSung(pn, t0, hzOf, vowelOf) {
    var out = [], t = t0, lastV = "ah";
    pn.forEach(function (x) {
      if (x.t > t + 0.004) out.push({ rest: true, dur: x.t - t });
      var v = vowelOf(x.n); if (v) lastV = v;
      out.push({ f: hzOf(x.n), dur: x.dur, vowel: lastV, stress: x.n.stress, slur: x.n.syl === null, _n: x.n });
      t = x.t + x.dur;
    });
    return out;
  }
  function strip(notes) {
    return notes.map(function (n) {
      var o = { dur: round(n.dur, 4) };
      if (n.rest) { o.rest = true; return o; }
      o.f = round(n.f, 3); o.vowel = n.vowel; if (n.stress != null) o.stress = n.stress; if (n.slur) o.slur = true; if (n.slide) o.slide = true;
      return o;
    });
  }
  function pickW(R, pool) {
    var tot = 0, i; for (i = 0; i < pool.length; i++) tot += pool[i][1];
    var x = R.rnd(0, tot);
    for (i = 0; i < pool.length; i++) { x -= pool[i][1]; if (x <= 0) return pool[i][0]; }
    return pool[pool.length - 1][0];
  }

  // ==========================================================================
  // performer(ward, opts) — the glue between a cue sheet and the voices.
  //   opts = { V: KOLOB.VoicesVocal, synth: a stream (synth:vocal; each
  //            member's sound-level dice fork `member:<id>` below it),
  //            organ: function (t, organCue) (optional) }
  // pump(ctx, buses, t0, sheet, horizon, pace) — hands every cue due to
  //   start before `horizon` (the caller's clock read, plus its lookahead)
  //   to its singer at t0 + cue.at; returns the cues handed. schedule()
  //   hands them all (offline). The glue never reads a clock of its own.
  //   pace = { max, urgent }: hand at most `max` cues a call (a line of the
  //   full ward is thirty-two graphs; built in one go it is a long task on a
  //   phone's main thread), except that every cue due before `urgent` goes
  //   now whatever the count.
  // ==========================================================================
  var LEAD = 0.7;   // how early a cue must be handed over: the inhale, the consonant
  var FORWARD_INHALE = 0.55;   // the chance a forward voice's breath is heard (the ward's is ~0.1)
  function performer(ward, opts) {
    opts = opts || {};
    var V = opts.V || K.VoicesVocal, synth = opts.synth, singers = {};
    function voiceOf(id) {
      if (singers[id]) return singers[id];
      var m = ward.byId[id], spec = {};
      for (var k in m.voice) spec[k] = m.voice[k];
      spec.name = "member:" + id; spec.sharedPan = true; spec.pan = m.pew ? m.pew.x : 0;
      if (synth) spec.rand = synth.fork("member:" + id); else spec.seed = 1;
      return (singers[id] = V.singer(spec));
    }
    function pump(ctx, buses, t0, sheet, horizon, pace) {
      var handed = [], max = pace && pace.max || Infinity, urgent = pace && pace.urgent != null ? pace.urgent : -Infinity;
      sheet._ci = sheet._ci || 0; sheet._oi = sheet._oi || 0;
      while (sheet._ci < sheet.cues.length && t0 + sheet.cues[sheet._ci].at - LEAD <= horizon) {
        if (handed.length >= max && t0 + sheet.cues[sheet._ci].at - LEAD > urgent) break;
        var c = sheet.cues[sheet._ci++];
        // a voice heard on its own breathes where a person would; in the
        // ward, only a few are heard to (the voices' own small share)
        voiceOf(c.memberId).sing(ctx, c.bus === "near" ? buses.near : buses.hall, t0 + c.at, c.notes, c.gain,
                                 { breathBefore: c.breathBefore, pan: c.pan, inhale: c.forward ? FORWARD_INHALE : null });
        handed.push(c);
      }
      while (sheet._oi < sheet.organ.length && t0 + sheet.organ[sheet._oi].at - LEAD <= horizon) {
        var o = sheet.organ[sheet._oi++];
        if (opts.organ) opts.organ(t0 + o.at, o);
      }
      return handed;
    }
    return {
      voiceOf: voiceOf,
      pump: pump,
      schedule: function (ctx, buses, t0, sheet) { return pump(ctx, buses, t0, sheet, Infinity); },
      reset: function (sheet) { sheet._ci = 0; sheet._oi = 0; },
    };
  }

  return {
    seat: seat, planHymn: planHymn, score: score, performer: performer,
    who: who, panOf: panOf, layoutFor: layoutFor, descantLine: descantLine, deseret: deseret,
    ROLES: ROLE_ORDER, ROLE_NAME: ROLE_NAME, ROSTER: ROSTER, PART_NAME: PART_NAME,
    PRACTICE_DO: PRACTICE_DO,
    rosterSize: function () { var n = 0; for (var r in ROSTER) n += ROSTER[r].length; return n; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-cast.js"] = true;   // the load guard's roll call

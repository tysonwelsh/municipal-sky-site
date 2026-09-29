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
//      planRefrain(ward, refrain, stream, {k, dox}) → a statement of the
//                                             wandering refrain's plan
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
// ROUND 3B, STEP 3 — THE STYLES' OWN WAYS. A gospel hymn is sung, on some
// Sundays, by a QUARTET of four of the ward standing (the tenor harmony, the
// lead, the baritone, the bass: on the note and together, so its sevenths
// ring), the ward coming in on the refrain and the tag. The PRIMARY — six to
// nine of the ward's children, seated with their families (seat's fork
// `primary`) — sings the Primary song, the ward joining its chorus. A hymn
// the composer wrote as a ROUND is sung as one: once through together, now
// and then, then the ward going in group by group (by its sections, or by
// the pews from one side of the chapel to the other), each going round and
// dropping out in turn. And the meeting's WANDERING REFRAIN is planned here
// as a small hymn (planRefrain): the enthusiast starts it alone, the ward
// takes it up.
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
  // WHAT THEY DO, in the minutes' own letters (the clerk writes in capitals:
  // "𐐢𐐌𐐤𐐞 𐐍𐐓", LINES OUT). The English words stay the event's `action`,
  // for the dev tools; the page prints these.
  function deseretCaps(spelling) {
    return spelling.split(" ").map(function (word) {
      return word.split("-").map(function (ph) {
        var at = DS_CODES.indexOf(ph);
        if (at < 0) throw new Error("kolob-cast: no Deseret letter for '" + ph + "' in " + spelling);
        return String.fromCodePoint(0x10400 + at);
      }).join("");
    }).join(" ");
  }
  var ACTION_DS = {};
  [["keys the hymn", "k-ee-z dh-u h-i-m"], ["hums the first note", "h-u-m-z dh-u f-u-r-s-t n-oh-t"], ["pitches the tune", "p-i-ch-i-z dh-u t-oo-n"],
   ["lines out", "l-ie-n-z ow-t"], ["comes forward", "k-u-m-z f-aw-r-w-u-r-d"], ["sings the descant", "s-i-ng-z dh-u d-e-s-k-a-n-t"],
   ["sings the treble verse", "s-i-ng-z dh-u t-r-e-b-u-l v-u-r-s"], ["sings the tune", "s-i-ng-z dh-u t-oo-n"], ["loses the words", "l-oo-z-i-z dh-u w-u-r-d-z"],
   ["finds them again", "f-ie-n-d-z dh-e-m u-g-e-n"], ["joins in", "j-oi-n-z i-n"], ["sings out", "s-i-ng-z ow-t"],
   ["blends back into the ward", "b-l-e-n-d-z b-a-k i-n-t-oo dh-u w-aw-r-d"], ["falls silent", "f-aw-l-z s-ie-l-u-n-t"],
   // (round 3b, step 3) the refrain, the quartet, the Primary, the round, the partner hymn
   ["starts the refrain", "s-t-ah-r-t-s dh-u r-i-f-r-ay-n"], ["leads the quartet", "l-ee-d-z dh-u k-w-aw-r-t-e-t"],
   ["sings in the quartet", "s-i-ng-z i-n dh-u k-w-aw-r-t-e-t"], ["leads the Primary", "l-ee-d-z dh-u p-r-ie-m-e-r-ee"],
   ["sets the round going", "s-e-t-s dh-u r-ow-n-d g-oh-i-ng"],
   // (round 3b, step 4) a verse given to one part of the ward
   ["gives the verse to the men", "g-i-v-z dh-u v-u-r-s t-oo dh-u m-e-n"], ["gives the verse to the women", "g-i-v-z dh-u v-u-r-s t-oo dh-u w-i-m-i-n"],
   ["plays the first hymn against it", "p-l-ay-z dh-u f-u-r-s-t h-i-m u-g-e-n-s-t i-t"],
   ["plays the first hymn on the cornet", "p-l-ay-z dh-u f-u-r-s-t h-i-m o-n dh-u k-aw-r-n-e-t"],
   // (round 3b, step 2) the organist at the bench (kolob-organist.js says
   // these; a parenthesis after one — which key he strays to — is the dev
   // tools' only)
   ["plays the day's first hymn as a prelude", "p-l-ay-z dh-u d-ay-z f-u-r-s-t h-i-m a-z u p-r-e-l-y-oo-d"],
   ["puts the tune in the pedals", "p-uu-t-s dh-u t-oo-n i-n dh-u p-e-d-u-l-z"], ["lets the flutes run in another key", "l-e-t-s dh-u f-l-oo-t-s r-u-n i-n u-n-u-dh-u-r k-ee"],
   ["gives out the tune", "g-i-v-z ow-t dh-u t-oo-n"], ["modulates to the next hymn's key", "m-o-j-u-l-ay-t-s t-oo dh-u n-e-k-s-t h-i-m-z k-ee"],
   ["links the lines", "l-i-ng-k-s dh-u l-ie-n-z"], ["holds a note over into the next line", "h-oh-l-d-z u n-oh-t oh-v-u-r i-n-t-oo dh-u n-e-k-s-t l-ie-n"],
   ["echoes the line on the echo flute", "e-k-oh-z dh-u l-ie-n o-n dh-u e-k-oh f-l-oo-t"], ["quotes the next line between the lines", "k-w-oh-t-s dh-u n-e-k-s-t l-ie-n b-i-t-w-ee-n dh-u l-ie-n-z"],
   ["turns an arabesque between the lines", "t-u-r-n-z a-n a-r-u-b-e-s-k b-i-t-w-ee-n dh-u l-ie-n-z"], ["runs a sequence between the lines", "r-u-n-z u s-ee-k-w-u-n-s b-i-t-w-ee-n dh-u l-ie-n-z"],
   ["strays into a strange key", "s-t-r-ay-z i-n-t-oo u s-t-r-ay-n-j k-ee"], ["lifts both hands; the ward sings a line alone", "l-i-f-t-s b-oh-th h-a-n-d-z dh-u w-aw-r-d s-i-ng-z u l-ie-n u-l-oh-n"],
   // …and the stops they draw (told, never given a row in the minutes)
   ["draws the soft flutes", "d-r-aw-z dh-u s-aw-f-t f-l-oo-t-s"], ["draws one quiet flute", "d-r-aw-z w-u-n k-w-ie-u-t f-l-oo-t"],
   ["draws the flutes, 8′ and 4′", "d-r-aw-z dh-u f-l-oo-t-s ay-t f-uu-t a-n-d f-aw-r f-uu-t"], ["draws the principal", "d-r-aw-z dh-u p-r-i-n-s-i-p-u-l"],
   ["draws the principal and the 4′ flute", "d-r-aw-z dh-u p-r-i-n-s-i-p-u-l a-n-d dh-u f-aw-r f-uu-t f-l-oo-t"],
   ["pulls the vox humana, with the tremulant", "p-uu-l-z dh-u v-o-k-s h-y-oo-m-a-n-u w-i-dh dh-u t-r-e-m-y-u-l-u-n-t"],
   ["pulls the vox humana over the flutes", "p-uu-l-z dh-u v-o-k-s h-y-oo-m-a-n-u oh-v-u-r dh-u f-l-oo-t-s"],
   ["sets the tune on the vox humana", "s-e-t-s dh-u t-oo-n o-n dh-u v-o-k-s h-y-oo-m-a-n-u"], ["draws the echo flute", "d-r-aw-z dh-u e-k-oh f-l-oo-t"],
   ["draws the trumpet", "d-r-aw-z dh-u t-r-u-m-p-i-t"], ["sets the tune on the trumpet", "s-e-t-s dh-u t-oo-n o-n dh-u t-r-u-m-p-i-t"],
   ["draws the full organ, mixtures and all", "d-r-aw-z dh-u f-uu-l aw-r-g-u-n m-i-k-s-ch-u-r-z a-n-d aw-l"],
   ["draws the principal and the mixture", "d-r-aw-z dh-u p-r-i-n-s-i-p-u-l a-n-d dh-u m-i-k-s-ch-u-r"],
   ["draws a 16′ and a 4′ with nothing between", "d-r-aw-z u s-i-k-s-t-ee-n f-uu-t a-n-d u f-aw-r f-uu-t w-i-dh n-u-th-i-ng b-i-t-w-ee-n"],
   ["draws the mixture alone", "d-r-aw-z dh-u m-i-k-s-ch-u-r u-l-oh-n"], ["sets the flutes running", "s-e-t-s dh-u f-l-oo-t-s r-u-n-i-ng"],
   ["draws the flutes with the tremulant", "d-r-aw-z dh-u f-l-oo-t-s w-i-dh dh-u t-r-e-m-y-u-l-u-n-t"], ["changes the stops", "ch-ay-n-j-i-z dh-u s-t-o-p-s"],
   // (round 3c) THE TESTIMONY-BEARERS PERFORM (kolob-testimony.js): each
   // rises, bears testimony — a speech-melody the harmonium or the clarinet
   // takes up — and sits down; and THE SOCIAL HALL (kolob-guest-socialhall.js):
   // one of the ward takes up the fiddle, another calls the dance
   ["rises to bear testimony", "r-ie-z-i-z t-oo b-e-r t-e-s-t-i-m-oh-n-ee"], ["sits down", "s-i-t-s d-ow-n"],
   ["takes up the fiddle", "t-ay-k-s u-p dh-u f-i-d-u-l"], ["calls the dance", "k-aw-l-z dh-u d-a-n-s"],
  ].forEach(function (a) { ACTION_DS[a[0]] = deseretCaps(a[1]); });
  // (an action's key: its words without the dev tools' parenthesis)
  function actionKey(action) { return String(action || "").replace(/ \(.*\)$/, ""); }
  // the actions a person COMES FORWARD with (the rest say how their moment
  // goes on, or ends): the minutes give these a row
  var ACTION_FORWARD = { "keys the hymn": 1, "hums the first note": 1, "pitches the tune": 1, "lines out": 1, "comes forward": 1, "sings the descant": 1,
                         "sings the treble verse": 1, "sings the tune": 1, "loses the words": 1, "finds them again": 1, "joins in": 1, "sings out": 1,
                         "starts the refrain": 1, "leads the quartet": 1, "leads the Primary": 1, "sets the round going": 1, "plays the first hymn on the cornet": 1,
                         "gives the verse to the men": 1, "gives the verse to the women": 1,
                         // (round 3c: the testimony's and the Social Hall's people come forward)
                         "rises to bear testimony": 1, "takes up the fiddle": 1, "calls the dance": 1 };
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
    // (round 3b, step 4: how many you come to know is the Sunday's —
    // opts.size {opt, testimony}, from the calendar: a fast Sunday's three
    // testimony-bearers, a dedication's every optional role, a funeral's
    // fewer — the same two dice, read over the Sunday's range)
    var sz = opts.size || {}, optR = sz.opt || [3, 5], testR = sz.testimony || [2, 3];
    var optional = shuffled(pick, OPTIONAL), nOpt = pick.rint(optR[0], Math.min(OPTIONAL.length, optR[1])), nTest = pick.rint(testR[0], testR[1]);
    var filling = ["chorister", "precentor", "soloist"].concat(optional.slice(0, nOpt));
    // (keep the roster's own order, so the chart and the log read the same way every time)
    filling.sort(function (a, b) { return ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b); });
    for (var ti = 0; ti < nTest; ti++) filling.push("testimony");
    // (round 3b, step 3: a Sunday of the wandering refrain needs the
    // enthusiast — he starts it — so one is seated if the draw left him out:
    // last of the pews' people, on his own role's fork, so everyone else is
    // who they would have been)
    if (opts.enthusiast && filling.indexOf("enthusiast") < 0) filling.push("enthusiast");
    filling.push("organist");
    var testN = 0, usedArch = {};
    filling.forEach(function (role) {
      var label = role === "testimony" ? "role:testimony:" + testN++ : "role:" + role;
      // (the testimony-bearers are drawn without replacement: two young
      // fathers on one Sunday is one too many — the same single die, a
      // smaller pool)
      var pool = ROSTER[role].filter(function (a) { return !usedArch[role + ":" + a.id]; });
      // (round 3b, step 2: the organist on the bench is the organist the
      // Sunday seated — kolob-organist.js draws the style, with the day's
      // own tilts; the ward's archetype is one of that style's — the same
      // single die, a smaller pool, so no other die moves)
      if (role === "organist" && opts.organist) {
        var own = pool.filter(function (a) { return a.habit && a.habit.style === opts.organist; });
        if (own.length) pool = own;
      }
      var r = stream.fork(label), arch = r.pick(pool.length ? pool : ROSTER[role]);
      usedArch[role + ":" + arch.id] = true;
      var person;
      if (role === "child" || role === "organist") {
        // the child sits with a family (a mother or father in the pews); the
        // organist sits at the organ. Neither has a seat among the 32.
        var parent = members[r.rint(0, members.length - 1)];
        // (the sister at the reed organ is a sister: her coin is thrown all
        // the same, first, so no other die moves — round 3b)
        var nm = role === "child" ? r.pick(CHILDREN) : r.pick(r.chance(0.5) || arch.id === "sister" ? WOMEN : MEN);
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
      var rn = stream.fork("rename:" + id), list = m.part === "child" ? CHILDREN : m.part === "S" || m.part === "A" || m.archetype === "sister" ? WOMEN : m.part === "T" || m.part === "B" ? MEN : WOMEN.concat(MEN);
      var fam = FAMILIES.filter(function (f) { return f[0] === m.family; })[0];
      for (var tries = 0; tries < 24 && nameCount[m.nameDs] > 1; tries++) {
        var g = rn.pick(list), ds = deseret(g[1] + " " + fam[1]);
        if (nameCount[ds]) continue;
        nameCount[m.nameDs]--; m.nameDs = ds; m.nameEn = g[0] + " " + fam[0]; nameCount[ds] = 1;
      }
    });
    // (the enthusiast seated late keeps the roster's order in the lists)
    individuals.sort(function (a, b) { return ROLE_ORDER.indexOf(byId[a].role) - ROLE_ORDER.indexOf(byId[b].role); });
    // THE PRIMARY (round 3b, step 3; PLAN-COMPOSITION §3.E, §5.2): the
    // ward's children, who sing the Primary song when the day's unison song
    // is one — six to nine of them, each sitting with a family of the pews,
    // each a child's voice of their own. Seated after everyone else, on the
    // fork `primary` (each child on primary:<k>), so no other die moves; a
    // child never takes a name already in the room. They are not among the
    // thirty-two (k is null) and sing nothing else; the child you come to
    // know, if the Sunday seated one, sings with them.
    var pr = stream.fork("primary"), primary = [], nP = pr.rint(6, 9);
    var fams2 = members.filter(function (m) { return m.k != null; });
    for (var pk = 0; pk < nP; pk++) {
      var rc = stream.fork("primary:" + pk), parent2 = fams2[rc.rint(0, fams2.length - 1)];
      var fam2 = FAMILIES.filter(function (f) { return f[0] === parent2.family; })[0], nm2 = null, ds2 = null;
      for (var tr2 = 0; tr2 < 16; tr2++) { var g2 = rc.pick(CHILDREN.concat(tr2 > 7 ? WOMEN.concat(MEN) : [])); ds2 = deseret(g2[1] + " " + fam2[1]); nm2 = g2[0]; if (!nameCount[ds2]) break; }
      nameCount[ds2] = (nameCount[ds2] || 0) + 1;
      var kid = {
        id: "p" + pk, part: "child", k: null, primary: true,
        nameEn: nm2 + " " + fam2[0], nameDs: ds2, family: fam2[0],
        pew: { x: round(Math.max(-0.92, Math.min(0.92, parent2.pew.x + rc.rnd(-0.1, 0.1))), 3), row: parent2.pew.row },
        voice: { part: "child", age: "young", confidence: round(rc.rnd(0.42, 0.72)), brightness: round(rc.rnd(0.5, 0.72)), breath: round(rc.rnd(0.45, 0.7)),
                 pitchHabitCents: round(rc.rnd(-14, 16), 2), timingHabitMs: round(rc.rnd(15, 75), 1), tractScale: round(rc.rnd(0.96, 1.06)) },
        appetite: round(rc.rnd(0.2, 0.5)), spread: round(rc.rnd(0.05, 0.3)), parent: parent2.id,
      };
      members.push(kid); byId[kid.id] = kid; primary.push(kid.id);
    }
    return { members: members, byId: byId, individuals: individuals, roles: roles, primary: primary };
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

  // THE BASSES IN THE MEN'S VERSE (round 3b, step 4): [part, octave] for a
  // line whose tune the tenors carry an octave down (tunePart at 0.5) —
  // the basses' own part where every note of it lies below the tune note
  // sounding with it (by more than MEN_MEET_C), else their part an octave
  // lower where that keeps above MEN_BASS_FLOOR_HZ, else the tune itself,
  // with the tenors. hz(monzo, oct) is the hymn's own.
  var MEN_MEET_C = 30, MEN_BASS_FLOOR_HZ = 73;
  function menBassFor(line, next, tunePart, beatS, rit, holdMul, hz) {
    var tn = partNotes(line, next, tunePart, beatS, rit, holdMul), bn = partNotes(line, next, "B", beatS, rit, holdMul);
    if (!bn.length || !tn.length) return [tunePart, 0.5];
    function under(oct) {
      return bn.every(function (b) {
        var bh = hz(b.n.monzo, oct);
        return tn.every(function (x) {
          if (x.t >= b.t + b.dur - 1e-3 || x.t + x.dur <= b.t + 1e-3) return true;
          return 1200 * Math.log2(hz(x.n.monzo, 0.5) / bh) > MEN_MEET_C;
        });
      });
    }
    if (under(1)) return ["B", 1];
    var low = Math.min.apply(null, bn.map(function (b) { return hz(b.n.monzo, 0.5); }));
    if (low >= MEN_BASS_FLOOR_HZ && under(0.5)) return ["B", 0.5];
    return [tunePart, 0.5];
  }

  // who sings what, by dialect and practice: [the Score's part, octave factor]
  // (the gospel's tune — the lead — is its second voice, written where the
  // women sing it: they take it at pitch, the men an octave down, and the
  // child with the women)
  function assignment(hymn, m, practice) {
    var p = m.part, k = m.k, mel = hymn.melodyPart, lead = hymn.dialect === "gospel";
    if (p === "child") return [mel, mel === "T" && !lead ? 2 : 1];
    if (practice === "unison" || practice === "lined" || hymn.dialect === "oldway") {
      if (mel === "T" && !lead) return [mel, p === "S" || p === "A" ? 2 : 1];
      return [mel, p === "T" || p === "B" ? 0.5 : 1];
    }
    if (lead) {
      // the quartet in the ward (hymn-lab's): the tenor harmony over the lead
      // with five of the trebles; the lead with the altos and the other three;
      // the tenors on the baritone under it; the basses on the bass — so the
      // men's echo is the men's
      if (p === "S") return k < 5 ? ["S", 1] : ["T", 1];
      if (p === "A") return ["T", 1];
      if (p === "T") return ["A", 1];
      return ["B", 1];
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
  // a gift song's wordless syllables, as the mouth sings them (hymn-lab's)
  var VOCABLE_SOUND = { lo: "oh", la: "la", lee: "ee", dee: "ee", de: "eh", vol: "oh", hey: "eh", loo: "oo", lum: "hum", dum: "oo", day: "eh" };
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
    // (a hummed verse, or one in unison, is ONE of the middle verses — the
    // die that chooses it also says which — never two running; round 3b.
    // Unison is the chorister's call in the Tabernacle and gospel; a Sacred
    // Harp class, a singing school and the Old Way keep their own ways)
    var mid = Math.max(1, verses - 2);
    var humV = dHum < 0.14 ? 1 + Math.min(mid - 1, Math.floor(dHum / 0.14 * mid)) : -1;
    var uniV = dUni < 0.1 && (dl === "tabernacle" || dl === "gospel") ? 1 + Math.min(mid - 1, Math.floor(dUni / 0.1 * mid)) : -1;
    for (var v = 0; v < verses; v++) {
      var p = "sung";
      if (dl === "oldway") p = "lined";
      else if (dl === "shaker") p = "unison";                                           // (one tune, everyone on it: the Shakers' way, and the Primary's)
      else if (dl === "sacredharp" && v === 0) p = "notes";
      else if (dl === "sacredharp" && dNotesAll < 0.1) p = "notes";                   // (some classes sing every verse on the notes)
      else if (dl === "tabernacle" && v === verses - 1 && verses >= 3 && who(ward, "soloist") && dDesc < (who(ward, "soloist").habit.descant || 0.5)) p = "descant";
      else if (dl === "tabernacle" && v > 0 && v < verses - 1 && v === humV) p = "hummed";
      else if (v > 0 && v < verses - 1 && v === uniV) p = "unison";
      practice.push(p);
    }
    // ---- the round, the Primary, the quartet (round 3b, step 3) ----
    // A ROUND (the composer's round(): h.round): sung unaccompanied — once
    // through together first, now and then, then as a canon: the ward goes
    // in by its sections (trebles, altos, tenors, basses — or women and men,
    // or trebles, altos and men) or by the pews (the room from one side to
    // the other), each group a segment behind the last, going round two or
    // three times and dropping out in the order it came in. Its dice on the
    // fork `round`, thrown for every hymn.
    var rd = r.fork("round"), rdBy = rd.chance(0.55) ? "parts" : "pews", rdTimes = rd.chance(0.6) ? 2 : 3, rdOnce = rd.chance(0.6), rdSide = rd.chance(0.5) ? 1 : -1;
    var canon = null;
    if (hymn.round) {
      var ents = Math.max(2, Math.min(4, hymn.round.entries || 2));
      canon = { by: rdBy, entries: ents, times: rdTimes, side: rdSide, segments: hymn.round.segments, delayBeats: hymn.round.delayBeats, groups: roundGroups(ward, rdBy, ents, rdSide) };
      practice = verses >= 2 && rdOnce ? ["unison", "round"] : ["round"];
      verses = practice.length;
      keying = { kind: "keying", by: ch.id, habit: chH.keying === "fasola" ? "hum" : (chH.keying || "hum") };
    }
    // THE PRIMARY SONG (the unison song's third kind, hymn.kind "primary"):
    // the Primary sings it — the ward's children, and the child you come to
    // know among them — the ward listening, and joining them on the chorus
    // after the first verse; a Primary teacher (the chorister) leads them.
    var primary = hymn.kind === "primary" && ward.primary && ward.primary.length ? ward.primary.concat(who(ward, "child") ? ["child"] : []) : null;
    // THE QUARTET (gospel, D): on some Sundays four of the ward stand up and
    // sing the verses as the parlour quartet sings them — the tenor harmony
    // over the lead, the baritone and the bass under it, close, on the note
    // and together, so the ringing sevenths ring — and the ward comes in on
    // the refrain and the tag (Moody and Sankey's meetings: the quartet on
    // the verse, everyone on the chorus). Else the quartet is the ward's
    // own, the lead in its second voice (assignment()). Its die on the fork
    // `quartet`, thrown for every hymn.
    var qd = r.fork("quartet"), qDie = qd.rnd(0, 1), qPick = [qd.rnd(0, 1), qd.rnd(0, 1), qd.rnd(0, 1), qd.rnd(0, 1)];
    var quartet = null;
    if (dl === "gospel" && hymn.voiceOrder && qDie < QUARTET_RATE) {
      quartet = {};
      // the Score's part → who sings it: the tenor harmony a treble, the
      // lead an alto, the baritone a tenor, the bass a bass — each the
      // surest of three in their section (the pews' own people, none of the
      // people you come to know: they keep their moments)
      [["S", "S"], ["T", "A"], ["A", "T"], ["B", "B"]].forEach(function (pp, qi) {
        var pool = ward.members.filter(function (m) { return m.k != null && m.part === pp[1] && !m.role; })
          .sort(function (a, b) { return b.voice.confidence - a.voice.confidence || (a.k - b.k); }).slice(0, 3);
        if (pool.length) quartet[pp[0]] = pool[Math.min(pool.length - 1, Math.floor(qPick[qi] * pool.length))].id;
      });
      if (Object.keys(quartet).length < 4) quartet = null;
      else for (var qv = 0; qv < verses; qv++) practice[qv] = "quartet";
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
    // (a round's groups are its texture, the Primary's children its voices,
    // and the quartet's verses are the four's: nobody else comes forward in
    // them — but the enthusiast sings out on the gospel refrain, the chorus
    // being everyone's)
    var solo = !!(canon || primary || quartet);
    if (quartet && who(ward, "enthusiast") && hymn.refrain && hymn.refrain.length && dEnth < 0.75) {
      var refL = []; for (var rl = hymn.lines.length; rl < nLines; rl++) refL.push(rl);
      add(verses - 1, "enthusiast", "sings out", refL, 3);
    }
    if (dl === "oldway") for (var vo = 0; vo < verses; vo++) add(vo, "precentor", "lines out", all, 4);
    if (solo) { /* (none of the moments below) */ }
    else if (opts.first && who(ward, "newcomer")) {
      var jl = Math.min(nLines - 1, who(ward, "newcomer").habit.joinsLine || 1);
      add(0, "newcomer", "joins in", all.slice(jl, jl + 1), 3);
    }
    if (solo) { /* (as above) */ }
    else if (practice.indexOf("descant") >= 0) add(practice.indexOf("descant"), "soloist", "sings the descant", all, 5);
    else if (dl === "tabernacle" && verses >= 3 && dTreble < 0.22) add(1, "soloist", "sings the treble verse", all, 4);
    // the middle verses: the alto, the child, the old bass — in an order the dice choose
    var mids = []; for (var vm = dl === "sacredharp" ? 1 : 0; vm < verses; vm++) mids.push(vm);
    var order = dOrder < 0.33 ? ["alto", "child", "oldbass"] : dOrder < 0.66 ? ["child", "oldbass", "alto"] : ["oldbass", "alto", "child"];
    var wants = { alto: dAltoV, child: dChildV, oldbass: dBassV };
    order.forEach(function (role, oi) {
      if (solo || !who(ward, role)) return;
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
    if (!solo && who(ward, "enthusiast") && dEnth < 0.75) add(verses - 1, "enthusiast", "sings out", all, 3);
    // ---- a verse by one part (round 3b, step 4; PLAN §7.4's sub-scenes) ----
    // Now and then a middle verse of a hymn (the first of a hymn of two) is the
    // men's alone (the tenors on the tune an octave down, the basses under
    // it: their own part, or an octave lower, or with the tenors on the
    // tune — menBassFor, line by line) or the women's (the trebles on theirs, the altos on
    // theirs) — the chorister's call, in the Tabernacle and in gospel sung
    // by the ward, on a verse that is plainly sung (not the soloist's treble
    // verse); whoever would have come forward in it from the other side of
    // the chapel keeps their seat this once. The organ plays on under it,
    // and the refrain after it is everyone's. Its dice on the fork
    // `onepart`, thrown for every hymn.
    var op = r.fork("onepart"), opDie = op.rnd(0, 1), opWhich = op.rnd(0, 1), opAt = op.rnd(0, 1);
    var onePart = null;
    if (!solo && (dl === "tabernacle" || dl === "gospel") && verses >= 2 && opDie < ONE_PART_RATE) {
      var opWho = opWhich < 0.55 ? "men" : "women", opParts = opWho === "men" ? { T: 1, B: 1 } : { S: 1, A: 1 }, opFree = [];
      // (a hymn of two verses gives its first to them, and all sing the last)
      for (var vp = verses >= 3 ? 1 : 0; vp < verses - 1; vp++) {
        if (practice[vp] !== "sung") continue;
        if (fwd[vp].some(function (f) { return f.action === "sings the treble verse"; })) continue;
        opFree.push(vp);
      }
      if (opFree.length) {
        onePart = { verse: opFree[Math.min(opFree.length - 1, Math.floor(opAt * opFree.length))], part: opWho };
        fwd[onePart.verse] = fwd[onePart.verse].filter(function (f) { var mm = ward.byId[f.memberId]; return mm && opParts[mm.part]; });
      }
    }
    // ---- the Performances (SCORE §5.1) ----
    var singers = ward.members.filter(function (m) { return m.k != null; }).map(function (m) { return m.id; });
    var perf = practice.map(function (p, vi) {
      var sing = singers.slice().concat(fwd[vi].some(function (f) { return f.role === "child"; }) ? ["child"] : []);
      if (p === "quartet") sing = ["S", "T", "A", "B"].map(function (q) { return quartet[q]; }).concat(hymn.refrain && hymn.refrain.length ? singers : []);
      if (primary) sing = primary.concat(vi > 0 && hymn.refrain && hymn.refrain.length ? singers : []);
      var o = {
        hymnId: hymn.id, verse: vi, practice: p, tempoMul: round(tempoMul * (dl === "oldway" ? 1 : 1), 3), rubato: round(rubato, 3),
        organ: organ && !canon && p !== "hummed" ? { registration: [verses >= 3 && vi === verses - 1 ? "full organ" : "hymn principal"] } : null,
        singers: sing.filter(function (x, i, a) { return a.indexOf(x) === i; }),
        forward: fwd[vi],
      };
      if (onePart && onePart.verse === vi) o.part = onePart.part;
      return K.Score && K.Score.performance ? K.Score.performance(o) : o;
    });
    return {
      hymnId: hymn.id, dialect: dl, layout: canon && canon.by === "pews" ? "pews" : layoutFor(dl), keying: keying, verses: perf, onePart: onePart,
      tempoMul: round(tempoMul, 3), rubato: round(rubato, 3), holdMul: round(holdMul, 3), organ: organ && !canon,
      amen: !!hymn.amen && !canon, first: !!opts.first, chorister: ch.id,
      round: canon, primary: primary, quartet: quartet,
    };
  }
  var QUARTET_RATE = 0.45;                         // the quartet sings a gospel hymn's verses about this often
  var ONE_PART_RATE = 0.3;                         // a hymn of two verses or more gives one to the men or the women (round 3b, step 4)
  // a refrain sung again rises (round 3b, step 4; PLAN §7.4): the ward sings
  // it out a little more each time — REFRAIN_RISE_DB a statement, the
  // refrain after each verse (gospel's), and each statement of the
  // wandering refrain; at most REFRAIN_RISE_MAX
  var REFRAIN_RISE_DB = 0.9, REFRAIN_RISE_MAX = 2.7;
  // the groups of a round: by the sections (2: the women and the men; 3:
  // the trebles, the altos and the men; 4: each section), or by the pews —
  // the thirty-two in the order they sit across the chapel, from one side
  // (side 1: the audience's left first) to the other, cut in `n`
  // ==========================================================================
  // planRefrain(ward, refrain, stream, opts) → the plan of one statement of
  // the meeting's wandering refrain (round 3b, step 3; PLAN §15 item 4), as
  // planHymn gives a hymn's: the refrain's Score is a small hymn (the
  // composer's, set in the key and dialect of the hymn it follows).
  //   opts.k 0 — after the first hymn's last verse: the enthusiast starts it
  //              ALONE, once through, and the ward takes it up;
  //   opts.k 1 — it comes back after a later hymn: the ward sings it, the
  //              enthusiast singing out;
  //   opts.dox — in the doxology: the ward sings it unprompted, everyone at
  //              once, nobody forward.
  // Nobody keys it (it is caught up, not given out) and the organ does not
  // play it. stream: the statement's own (r:<n>:<k> → performance).
  // ==========================================================================
  function planRefrain(ward, rh, stream, opts) {
    opts = opts || {};
    var ch = who(ward, "chorister") || ward.members[0], chH = ch.habit || {}, en = who(ward, "enthusiast");
    var nL = rh.lines.length + (rh.refrain ? rh.refrain.length : 0), all = [];
    for (var li = 0; li < nL; li++) all.push(li);
    var pr = rh.dialect === "shaker" ? "unison" : "sung", verses = [];
    if (!opts.dox && opts.k === 0 && en) verses.push({ practice: pr, forward: [{ memberId: en.id, role: "enthusiast", action: "starts the refrain", lines: all, gainDb: 5, alone: true }] });
    verses.push({ practice: pr, forward: !opts.dox && opts.k > 0 && en ? [{ memberId: en.id, role: "enthusiast", action: "sings out", lines: all, gainDb: 3 }] : [] });
    var singers = ward.members.filter(function (m) { return m.k != null; }).map(function (m) { return m.id; });
    var tempoMul = (chH.tempoMul || 1) * (stream ? stream.fork("tempo").rnd(1.0, 1.06) : 1);    // (caught up a shade quicker than the hymn)
    var perf = verses.map(function (V, vi) {
      var o = { hymnId: rh.id, verse: vi, practice: V.practice, tempoMul: round(tempoMul, 3), rubato: round(chH.rubato || 0.05, 3), organ: null,
                singers: V.forward.some(function (f) { return f.alone; }) ? [V.forward[0].memberId] : singers.slice(), forward: V.forward };
      return K.Score && K.Score.performance ? K.Score.performance(o) : o;
    });
    return {
      hymnId: rh.id, dialect: rh.dialect, layout: layoutFor(rh.dialect), keying: null, verses: perf,
      // (round 3b, step 4: each statement sung out a little more — the
      // doxology's the fullest)
      rise: round(opts.dox ? 2 * REFRAIN_RISE_DB : (opts.k || 0) * REFRAIN_RISE_DB, 3),
      tempoMul: round(tempoMul, 3), rubato: round(chH.rubato || 0.05, 3), holdMul: round(chH.holdMul || 1.6, 3), organ: false,
      amen: false, first: false, chorister: ch.id, refrain: { k: opts.k || 0, dox: !!opts.dox, starter: !opts.dox && opts.k === 0 && en ? en.id : null },
    };
  }
  function roundGroupName(ward, ids) {
    var parts = {}; ids.forEach(function (id) { var m = ward.byId[id]; if (m) parts[m.part] = true; });
    var p = Object.keys(parts).sort(function (a, b) { return PARTS.indexOf(a) - PARTS.indexOf(b); });
    var MANY = { S: "trebles", A: "altos", T: "tenors", B: "basses" };
    return p.length === 2 && parts.S && parts.A ? "the women" : p.length === 2 && parts.T && parts.B ? "the men" : p.map(function (x) { return MANY[x]; }).join(" and ");
  }
  function roundGroups(ward, by, n, side) {
    var seated = ward.members.filter(function (m) { return m.k != null; });
    if (by === "parts") {
      var cut = n === 2 ? [["S", "A"], ["T", "B"]] : n === 3 ? [["S"], ["A"], ["T", "B"]] : [["S"], ["A"], ["T"], ["B"]];
      return cut.map(function (ps) { return seated.filter(function (m) { return ps.indexOf(m.part) >= 0; }).map(function (m) { return m.id; }); });
    }
    var sorted = seated.slice().sort(function (a, b) { return side * (a.pew.x - b.pew.x) || (a.k - b.k) || (a.part < b.part ? -1 : 1); });
    var out = []; for (var g = 0; g < n; g++) out.push([]);
    sorted.forEach(function (m, i) { out[Math.min(n - 1, Math.floor(i * n / sorted.length))].push(m.id); });
    return out;
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
  //            Way's ornaments are drawn below it), beatS (the beat the
  //            chorister's tempo is taken from: the meeting's own, default
  //            the hymn's) }
  // → { cues: [Cue…], organ: [OrganCue…], events: [typed events], end,
  //     joins: [{t, kind: "note"|"line"}] (for the benches), notes, lines }
  //   Cue = { at, memberId, bus: "hall"|"near", pan, gain, notes: [{f, dur,
  //           vowel, stress, slur, slide}], breathBefore (the silence since
  //           this singer's own last note), what, verse, line }
  //   OrganCue = { at, notes: [{f, dur, at, pedal, v, part, beat, deg,
  //                monzo, syl}], registration, verse, line, giveOut?, amen? }
  //   notes: the written notes, as a meeting reports them (SCORE §6): once
  //     for each section singing a Score part in an octave (not once for each
  //     of its eight people), and once for each person's own line — the
  //     keying, the precentor's lining-out, the descant, the drone —
  //     { at, dur, f, part (the singer's section), sings (the Score part, or
  //     "key" | "descant" | "drone"), octave (±n: the octaves off the Score),
  //     verse, line, beat, syl, deg, monzo, comma, member?, role?, and
  //     pitching | liningOut | amen | tag | repeat when they apply }
  //   lines: where each line of a verse begins and how long it lasts, for
  //     the meeting's telling of it: { verse, line, at, len, beatS, practice,
  //     lined: {at, len} | null, repeat }
  //
  // THE PIECES. A meeting cannot write a hymn's sheet whole: it decides
  // between the verses whether a fuging or a guest comes into the gap. So
  // the sheet is written in pieces — segment(ward, hymn, plan, piece, opts),
  // the piece "intro" (the organ's giving-out, the keying or the pitching),
  // {verse: v}, "amen" or "tag" — each from its own start (t = 0), with the
  // same dice and the same arithmetic as the whole: score() lays them end to
  // end exactly as it always has (the cast lab hears the same hymn to the
  // sample). opts.carry = { lastEnd: {} } and opts.at (the piece's start on
  // the caller's clock) carry each singer's last note from one piece to the
  // next, for the breath before their first line in it.
  // ==========================================================================
  //
  // THE ORGANIST'S OWN HANDS (round 3b, step 2). In the meeting the Sunday's
  // organist plays the organ's part (kolob-organist.js, hymnHands), and the
  // sheet carries no organ lines of its own: opts.organist = { giveOut (the
  // organist's giving-out, s from the intro's start to where the ward may
  // begin; in place of the sheet's), waits ({line: s} — after that line of
  // this verse the ward waits while the organist plays a fill between the
  // lines) }. The organist lays the organ by the chorister's clock (below);
  // the ward waits where the organist asks it to. Nothing else moves.
  var WARD_GAIN = 1 / Math.sqrt(8);
  // (round 3b, step 3) the quartet: each of the four about a section's
  // strength, a step nearer; the tenor harmony and the lead at the centre's
  // left and right, the baritone and the bass beside them. The Primary: each
  // child a little over a pew's voice (a row of six to ten small voices
  // stands where a section would)
  var QUARTET_GAIN = 0.62, QUARTET_PAN = { S: -0.12, T: 0.06, A: 0.2, B: -0.26 };
  var PRIMARY_GAIN = WARD_GAIN * 1.5;
  function writer(ward, hymn, plan, opts) {
    opts = opts || {};
    var orgst = opts.organist || null;
    var R = opts.stream, keynote = opts.keynoteHz || 261.63, keyM = hymn.keyMonzo || [0, 0, 0, 0], base = keynote * ratio(keyM);
    var cues = [], organ = [], events = [], joins = [], written = [], told = [], t = 0;
    var ch = ward.byId[plan.chorister] || ward.members[0];
    var beat0 = (opts.beatS || hymn.beatS) / (plan.tempoMul || 1);
    var lines = hymn.lines.concat(hymn.refrain || []);
    var seated = ward.members.filter(function (m) { return m.k != null; });
    var first = firstNotes(hymn, lines[0]);
    function ev(type, at, payload) { var e = { type: type, t: round(at, 3) }; for (var k in payload) e[k] = payload[k]; events.push(e); }
    // (a cast event names the person in Deseret and says what they do, in
    // English for the dev tools and in Deseret for the minutes)
    function castEv(at, m, action, where) {
      var e = { memberId: m.id, nameDs: m.nameDs, action: action, role: m.role || null, actionDs: ACTION_DS[action] || null };
      if (where) { e.verse = where.verse; e.line = where.line; }
      ev("cast", at, e);
    }
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
    function octOf(oct) { return Math.round(Math.log(oct) / Math.LN2); }
    // a written note, for the meeting to report (the Score's own fields)
    function tell(at, x, part, sings, oct, where, extra) {
      var n = x.n, o = { at: round(at, 4), dur: round(x.dur, 4), f: round(hz(n.monzo, oct), 6), part: part, sings: sings, octave: octOf(oct),
                         verse: where.verse, line: where.line, beat: n.beat, syl: n.syl, deg: n.deg, monzo: n.monzo.slice(), comma: n.comma || 0 };
      for (var k in extra || {}) o[k] = extra[k];
      written.push(o);
    }

    // ---- THE INTRO: the hymn announced; the organ gives out the tune
    // (accompanied hymns: its last line, alone); the keying, or the pitching ----
    function intro() {
      ev("hymn-announced", t, { hymn: { id: hymn.id, number: hymn.number, nameDs: hymn.nameDs, meter: hymn.meter, dialect: hymn.dialect, authorDs: hymn.hymnist ? hymn.hymnist.nameDs : null }, leaderDs: ch.nameDs });
      if (plan.organ && orgst && orgst.giveOut != null) t += orgst.giveOut;       // (the organist gives it out)
      else if (plan.organ) {
        var lastI = hymn.lines.length - 1, gl = hymn.lines[lastI];
        organ.push({ at: round(t, 4), notes: organNotes(gl, null, beat0, 0.02, plan.holdMul), registration: "hymn principal", giveOut: true, verse: -1, line: lastI });
        t += lineSpan(gl, null, beat0, 0.02, plan.holdMul) + 0.9 * beat0;
      }
      if (plan.keying && plan.keying.kind === "keying") t = keyIt(t, plan.keying);
      else if (plan.keying && plan.keying.kind === "pitching") t = pitchIt(t);
    }

    // ---- A VERSE ----
    function verse(vi) {
      var P = plan.verses[vi], lastVerse = vi === plan.verses.length - 1;
      var vr = R ? R.fork("vowels:" + vi) : null, vowels = [];
      for (var i = 0; i < 400; i++) vowels.push(vr ? pickW(vr, VOWELS) : "ah");
      var vocables = hymn.vocablesEn || null;
      var vowelOf = function (n) {
        if (P.practice === "notes") return shapeOf(hymn, n.deg);
        if (P.practice === "hummed") return "hum";
        if (vocables && n.syl != null) return VOCABLE_SOUND[vocables[n.syl % vocables.length]] || "ah";
        return n.syl != null ? vowels[n.syl] : null;
      };
      ev("verse-start", t, { hymnId: hymn.id, verse: vi, practice: P.practice });
      if (P.practice === "round") { roundVerse(vi, P, vowelOf); return; }
      // (the one who leads a verse of their own kind: the chorister before
      // the Primary, the quartet's lead before the four — told once, at the
      // first verse they lead, and stepping back at its end)
      var leads = null, leadsEnd = null, lastV = plan.verses.length - 1;
      if (plan.primary) { if (vi === 0) leads = [ch, "leads the Primary"]; if (vi === lastV) leadsEnd = ch; }
      else if (P.practice === "quartet" && plan.quartet) {
        var qLead = ward.byId[plan.quartet.T];
        if (vi === 0 || plan.verses[vi - 1].practice !== "quartet") leads = [qLead, "leads the quartet"];
        if (vi === lastV || plan.verses[vi + 1].practice !== "quartet") leadsEnd = qLead;
      }
      if (leads && leads[0]) castEv(t, leads[0], leads[1], { verse: vi, line: 0 });
      // (round 3b, step 4) a verse given to the men or to the women: the
      // chorister says so as it begins
      if (P.part === "men" || P.part === "women") castEv(t, ch, P.part === "men" ? "gives the verse to the men" : "gives the verse to the women", { verse: vi, line: 0 });
      var fwdOn = {};
      // the order the lines are sung in: the stanza and its refrain — and a
      // fuging tune sings its fuge twice, as the books repeat it (the lines
      // from the fuge's start to the end of the stanza, again, before the
      // refrain)
      var order = lines.map(function (l, i) { return i; });
      if (hymn.fuge && hymn.fuge.repeatFrom != null) for (var q = hymn.fuge.repeatFrom; q < hymn.lines.length; q++) order.splice(hymn.lines.length + (q - hymn.fuge.repeatFrom), 0, q);
      var sungYet = {};
      // the unison song's drone (the Shakers'): a few of the men hum home's
      // note (and its fifth) under the verse instead of the tune — the
      // basses on the first, the tenors on the second, as the lab has them
      var droners = {};
      if (hymn.drone && P.practice !== "lined") {
        (hymn.drone.degs || [-7]).forEach(function (d, j) {
          seated.forEach(function (m) { if (j === 0 ? m.part === "B" && m.k < 3 : m.part === "T" && m.k < 2) droners[m.id] = d; });
        });
      }
      order.forEach(function (li, oi) {
        var line = lines[li], next = oi + 1 < order.length && order[oi + 1] === li + 1 ? lines[li + 1] : null;
        var lastLine = lastVerse && oi === order.length - 1;
        var repeat = !!sungYet[li]; sungYet[li] = true;
        var where = { verse: vi, line: li };
        var rit = lastLine ? (plan.rubato || 0) * 2.2 : (plan.rubato || 0) * 0.35;
        var bs = beat0 * (P.practice === "hummed" ? 1.06 : 1);
        // who is forward on this line
        var fw = {};
        (P.forward || []).forEach(function (f) { if (f.lines.indexOf(li) >= 0) fw[f.memberId] = f; });
        Object.keys(fw).forEach(function (id) { if (!fwdOn[id]) { castEv(t, ward.byId[id], fw[id].action, where); fwdOn[id] = true; } });
        Object.keys(fwdOn).forEach(function (id) { if (fwdOn[id] && !fw[id]) { stepBack(t, id); fwdOn[id] = false; } });

        var linedAt = null;
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
          pn.forEach(function (x) { tell(t + x.t, x, pre.part, hymn.melodyPart, pOct, where, { member: pre.id, role: "precentor", liningOut: true }); });
          var plen = pn.length ? pn[pn.length - 1].t + pn[pn.length - 1].dur : 0;
          linedAt = { at: round(t, 4), len: round(plen, 4) };
          t += plen + 0.35;
        }
        var t0 = t, span = lineSpan(line, next, bs, rit, plan.holdMul);
        var bb = li === 0 && vi === 0 && !repeat ? 0.6 : Math.min(0.3 * bs, 0.35);
        told.push({ verse: vi, line: li, at: round(t0, 4), len: round(span, 4), beatS: round(bs, 5), practice: P.practice, lined: linedAt, repeat: repeat });
        // everyone who sings this line
        var singers = seated.slice(), heard = {};
        if (fw.child) singers.push(ward.byId.child);
        // (round 3b, step 3) the quartet's verse: the four alone on the
        // stanza, the ward with them on the refrain; the Primary's song:
        // the children, the ward joining them on the chorus after the
        // first verse
        var stanza = li < hymn.lines.length, qOf = {};
        if (P.practice === "quartet" && plan.quartet) {
          Object.keys(plan.quartet).forEach(function (q) { qOf[plan.quartet[q]] = q; });
          if (stanza) singers = Object.keys(qOf).map(function (id) { return ward.byId[id]; });
        }
        if (plan.primary) {
          var kids = plan.primary.map(function (id) { return ward.byId[id]; }).filter(Boolean);
          singers = kids.concat(!stanza && vi > 0 ? seated : []);
        }
        // (round 3b, step 4) the men's verse, or the women's: only they sing
        // the stanza (the refrain is everyone's)
        var onePartOf = stanza && (P.part === "men" || P.part === "women") ? (P.part === "men" ? { T: 1, B: 1 } : { S: 1, A: 1 }) : null;
        if (onePartOf) singers = singers.filter(function (m) { return onePartOf[m.part]; });
        // (the men's verse: the tenors carry the tune an octave down, and
        // the basses stay under it — their own part where it lies below
        // the tune the whole line, else the whole line an octave lower
        // where that stays in a bass's compass, else the tune with the
        // tenors: never meeting it, never above it. The round-3b critic
        // heard gospel's bass part, written where the men sing it, cross
        // the lead brought down an octave — 7 of 60 notes above the tune)
        var menBass = onePartOf && P.part === "men" ? menBassFor(line, next, hymn.dialect === "gospel" ? "T" : hymn.melodyPart, bs, rit, plan.holdMul, hz) : null;
        // (and a refrain sung again rises: a little more each verse, and each
        // statement of the wandering refrain — plan.rise, its own)
        var riseDb = Math.min(REFRAIN_RISE_MAX, (!stanza ? REFRAIN_RISE_DB * vi : 0) + (plan.rise || 0));
        var riseMul = riseDb > 0 ? Math.pow(10, riseDb / 20) : 1;
        singers.forEach(function (m) {
          var f = fw[m.id], role = m.role;
          if (f && f.role === "precentor") f = null;                                     // (the reply is the ward's)
          // the newcomer does not know the day's first hymn: silent until the line they join on
          if (role === "newcomer" && plan.first && vi === 0) {
            var joinL = (m.habit && m.habit.joinsLine) || 1;
            if (li < joinL) return;
          }
          // the drone's men hum it under the verse (the whole line, one breath)
          if (droners[m.id] != null) {
            var dm = spelled(hymn, droners[m.id], 0);
            if (!dm) return;
            var dx = { t: 0, dur: Math.max(0.6, span - Math.min(0.3 * bs, 0.25 * span)), n: { monzo: dm, deg: droners[m.id], beat: 0, syl: null } };
            cues.push({ at: round(t0, 4), memberId: m.id, bus: "hall", pan: panFor(m), gain: round(WARD_GAIN * 0.55, 4),
                        notes: [{ f: round(hz(dm, 1), 3), dur: round(dx.dur, 4), vowel: "hum", stress: 1 }], breathBefore: round(bb, 3), what: "drone", verse: vi, line: li });
            var dkey = "drone|" + m.part + "|" + droners[m.id];
            if (!heard[dkey]) { heard[dkey] = true; tell(t0, dx, m.part, "drone", 1, where, repeat ? { repeat: true } : null); }
            return;
          }
          var asg = assignment(hymn, m, P.practice === "descant" && role === "soloist" ? "sung" : P.practice), part = asg[0], oct = asg[1];
          // (the men's verse: the tenors take the tune an octave under where
          // it is written — the Tabernacle's soprano, gospel's lead — and the
          // basses stay under it, menBassFor's way)
          if (onePartOf && P.part === "men" && m.part === "T") { part = hymn.dialect === "gospel" ? "T" : hymn.melodyPart; oct = 0.5; }
          if (menBass && m.part === "B") { part = menBass[0]; oct = menBass[1]; }
          if (f && (f.action === "sings the treble verse" || f.alone)) { part = hymn.melodyPart; oct = hymn.melodyPart === "S" && (m.part === "T" || m.part === "B") ? 0.5 : 1; }
          var inQuartet = qOf[m.id] && stanza;
          if (inQuartet) { part = qOf[m.id]; oct = 1; }
          var off = P.practice === "lined" ? m.spread * bs * 0.6 : hymn.dialect === "shaker" ? m.spread * bs * 0.35 : 0;
          var pn2 = partNotes(line, next, part, bs, rit, plan.holdMul);
          var vOf = vowelOf;
          // the child loses the words of one line (hums), and finds them in the next
          if (role === "child" && m.habit && R) {
            var cr = R.fork("child:" + vi), lose = cr.rnd(0, 1) < (m.habit.loses || 0.5), lostLine = cr.rint(0, lines.length - 2);   // one fork, two draws
            if (lose && li === lostLine && !repeat) { vOf = function () { return "hum"; }; castEv(t0, m, "loses the words", where); }
            if (lose && li === lostLine + 1 && !repeat) castEv(t0, m, "finds them again", where);
          }
          var notes, gain = WARD_GAIN, bus = "hall", descant = f && role === "soloist" && P.practice === "descant";
          if (descant) {
            var dr = R ? R.fork("descant:" + li) : { rnd: function () { return 0.5; } };
            var dn = descantLine(hymn, line, dr), clk = clockOf(line, bs, rit, plan.holdMul);
            notes = dn.map(function (n, k) {
              var st = clk(n.beat), dur = clk(n.beat + n.beats) - st;
              if (k === dn.length - 1 && line.breathAfter !== false) dur -= Math.min(0.3 * bs, 0.25 * dur);
              return { t: st, dur: dur, n: n };
            });
            notes.forEach(function (x) { tell(t0 + x.t, x, m.part, "descant", 1, where, { member: m.id, role: role }); });
            notes = toSung(notes, 0, function (n) { return hz(n.monzo, 1); }, vOf);
          } else {
            notes = toSung(pn2, 0, function (n) { return hz(n.monzo, oct); }, vOf);
            if (P.practice === "lined" && R) notes = decorate(hymn, notes, R.fork("orn:" + m.id + ":" + vi + ":" + li), m.appetite, base);
            // the written notes, once a section's part and octave (the
            // child only doubles the tune; a soloist alone is herself)
            var alone = f && (f.action === "sings the treble verse" || f.alone);
            var key = alone ? m.id : m.part + "|" + part + "|" + oct;
            if ((role !== "child" || plan.primary) && !heard[key] && pn2.length) {
              heard[key] = true;
              var extra = alone ? { member: m.id, role: role } : null;
              if (repeat) { extra = extra || {}; extra.repeat = true; }
              // (the Primary's children, told once for them all, as the
              // section of the tune they are: its part, and "primary")
              var sec = m.part;
              if (m.part === "child") { sec = hymn.melodyPart; extra = extra || {}; extra.primary = true; }
              pn2.forEach(function (x) { tell(t0 + x.t, x, sec, part, oct, where, extra); });
            }
          }
          if (!notes.length) return;
          if (f) { bus = "near"; gain = WARD_GAIN * Math.pow(10, (f.gainDb || 4) / 20); }
          var at0 = t0 + off, pan = panFor(m);
          // the quartet stands and sings on the note and together — the
          // ring wants it: each of the four sings the Score's exact pitch
          // (their own habit of pitch taken back out of it) and on the beat
          // (their lateness taken back), near, a section's strength each
          if (inQuartet) {
            var cor = Math.pow(2, -((m.voice && m.voice.pitchHabitCents) || 0) / 1200);
            notes = notes.map(function (x) { if (x.rest) return x; var y = {}; for (var k in x) y[k] = x[k]; y.f = x.f * cor; return y; });
            at0 = Math.max(0, at0 - Math.max(0, ((m.voice && m.voice.timingHabitMs) || 0) / 1000));
            bus = "near"; gain = QUARTET_GAIN; pan = QUARTET_PAN[qOf[m.id]];
          }
          // the Primary stands in a row at the front, the ward's children
          // (the child you know among them), a little louder than a pew
          if (m.primary || (plan.primary && role === "child")) {
            var pi = plan.primary.indexOf(m.primary ? m.id : "child");
            bus = "near"; gain = PRIMARY_GAIN; pan = round(-0.5 + (plan.primary.length > 1 ? pi / (plan.primary.length - 1) : 0.5), 3);
          }
          // (a soloist singing the treble verse sings alone: the ward rests)
          cues.push({ at: round(at0 + (notes[0].rest ? 0 : 0), 4), memberId: m.id, bus: bus, pan: pan, gain: round(gain * (P.practice === "lined" ? 0.9 : 1) * riseMul, 4),
                      notes: strip(notes), breathBefore: round(bb, 3), what: P.practice, verse: vi, line: li, forward: !!f || !!inQuartet });
        });
        // the soloist's treble verse (and the enthusiast starting the
        // refrain): the rest of the ward is silent under them
        var aloneF = (P.forward || []).filter(function (f) { return (f.action === "sings the treble verse" || f.alone) && f.lines.indexOf(li) >= 0; })[0];
        if (aloneF) {
          var solo = aloneF.memberId;
          for (var ci = cues.length - 1; ci >= 0 && cues[ci].verse === vi && cues[ci].line === li; ci--) if (cues[ci].memberId !== solo) cues.splice(ci, 1);
          for (var wi = written.length - 1; wi >= 0 && written[wi].verse === vi && written[wi].line === li; wi--) if (written[wi].member !== solo && !written[wi].liningOut) written.splice(wi, 1);
        }
        // the organ under the line (accompanied, and not while the ward hums;
        // the organist's own hands play it in the meeting)
        if (plan.organ && P.organ && !orgst) organ.push({ at: round(t0, 4), notes: organNotes(line, next, bs, rit, plan.holdMul), registration: P.organ.registration[0], verse: vi, line: li });
        // the joins, for the benches: every part's onsets
        var on = [];
        Object.keys(line.notes).forEach(function (p) { partNotes(line, next, p, bs, rit, plan.holdMul).forEach(function (x) { on.push(t0 + x.t); }); });
        on.sort(function (a, b) { return a - b; });
        var lastJ = -1;
        on.forEach(function (x) { if (x - lastJ > 0.03) { joins.push({ t: round(x, 4), kind: Math.abs(x - t0) < 0.01 ? "line" : "note" }); lastJ = x; } });
        // (and the ward waits for the organist's fill between the lines)
        t = t0 + span + (P.practice === "lined" ? 0.5 : 0) + (orgst && orgst.waits && orgst.waits[li] ? orgst.waits[li] : 0);
      });
      Object.keys(fwdOn).forEach(function (id) { if (fwdOn[id]) stepBack(t, id); });
      if (leadsEnd) stepBack(t, leadsEnd.id);
    }

    // ---- A ROUND (round 3b, step 3): the ward in its groups, each a
    // segment behind the last, each going round plan.round.times times on
    // the tune (the women at pitch, the men an octave down) and dropping out
    // in the order it came in; the chorister sets it going. One cue a
    // singer a time round (its segments sung straight on, a breath at the
    // top of the round) ----
    function roundVerse(vi, P, vowelOf) {
      var rp = plan.round, k = hymn.lines.length, bs = beat0;
      var segB = rp.delayBeats || lengthOf(hymn.lines[0]), segS = segB * bs, t00 = t, mp = hymn.melodyPart;
      castEv(t00, ch, "sets the round going", { verse: vi, line: 0 });
      rp.groups.forEach(function (ids, g) {
        var g0 = t00 + g * segS;
        ev("round-entry", g0, { hymnId: hymn.id, verse: vi, entry: g + 1, group: rp.by === "parts" ? roundGroupName(ward, ids) : "pews " + (g + 1) + " of " + rp.groups.length, singers: ids.length });
        for (var pass = 0; pass < rp.times; pass++) {
          var p0 = g0 + pass * k * segS, heard = {}, perLine = [];
          for (var li = 0; li < k; li++) {
            var line = hymn.lines[li], pn = partNotes(line, null, mp, bs, 0, plan.holdMul);
            // (a breath at the top of the round: the last segment's last note gives it up)
            if (li === k - 1 && pn.length) { var lx = pn[pn.length - 1]; pn = pn.slice(0, -1).concat([{ t: lx.t, dur: Math.max(0.12, lx.dur - Math.min(0.3 * bs, 0.25 * lx.dur)), n: lx.n }]); }
            perLine.push(pn);
            told.push({ verse: vi, line: li, at: round(p0 + li * segS, 4), len: round(segS, 4), beatS: round(bs, 5), practice: "round", lined: null, repeat: pass > 0 || g > 0, group: g, pass: pass });
          }
          ids.forEach(function (id) {
            var m = ward.byId[id], oct = mp === "S" && (m.part === "T" || m.part === "B") ? 0.5 : mp === "T" && (m.part === "S" || m.part === "A") ? 2 : 1, all = [];
            perLine.forEach(function (pn, li) { pn.forEach(function (x) { all.push({ t: li * segS + x.t, dur: x.dur, n: x.n }); }); });
            var notes = toSung(all, 0, function (n) { return hz(n.monzo, oct); }, vowelOf);
            if (!notes.length) return;
            cues.push({ at: round(p0 + (m.spread || 0) * bs * 0.25, 4), memberId: id, bus: "hall", pan: panFor(m), gain: round(WARD_GAIN, 4), notes: strip(notes),
                        breathBefore: round(pass ? 0.25 : 0.5, 3), what: "round", verse: vi, line: 0 });
            // the written notes: once for each group, time round and octave
            if (!heard[oct]) {
              heard[oct] = true;
              perLine.forEach(function (pn, li) { pn.forEach(function (x) { tell(p0 + li * segS + x.t, x, m.part, mp, oct, { verse: vi, line: li }, { group: g, pass: pass, repeat: pass > 0 || g > 0 ? true : undefined }); }); });
            }
          });
        }
        joins.push({ t: round(g0, 4), kind: "line" });
      });
      t = t00 + (rp.times * k + rp.groups.length - 1) * segS;
      stepBack(t, ch.id);
    }

    // ---- THE AMEN (the Tabernacle's), and THE TAG (the barbershop's: the
    // lead holds home's note while the chords turn round it, the last one
    // rings) — each a closing line sung by the whole ward, after the last verse ----
    function closing(line, which, bs, rit, vowelAt) {
      var t0a = t, vi = plan.verses.length - 1, where = { verse: vi, line: lines.length }, heard = {}, extra = {};
      extra[which] = true;
      seated.forEach(function (m) {
        var asg = assignment(hymn, m, "sung"), pn3 = partNotes(line, null, asg[0], bs, rit, plan.holdMul);
        var notes = toSung(pn3, 0, function (n) { return hz(n.monzo, asg[1]); }, vowelAt);
        if (notes.length) cues.push({ at: round(t0a, 4), memberId: m.id, bus: "hall", pan: panFor(m), gain: round(WARD_GAIN, 4), notes: strip(notes), breathBefore: 0.35, what: which, verse: vi, line: -1 });
        var key = m.part + "|" + asg[0] + "|" + asg[1];
        if (!heard[key] && pn3.length) { heard[key] = true; pn3.forEach(function (x) { tell(t0a + x.t, x, m.part, asg[0], asg[1], where, extra); }); }
      });
      if (plan.organ && which === "amen" && !orgst) organ.push({ at: round(t0a, 4), notes: organNotes(line, null, bs, rit, plan.holdMul), registration: "hymn principal", verse: vi, line: lines.length, amen: true });
      var span = lineSpan(line, null, bs, rit, plan.holdMul);
      told.push({ verse: vi, line: lines.length, at: round(t0a, 4), len: round(span, 4), beatS: round(bs, 5), practice: "sung", lined: null, repeat: false });
      told[told.length - 1][which] = true;
      t = t0a + span;
    }
    function amen() { closing(hymn.amen, "amen", beat0, (plan.rubato || 0) * 1.5, function (n) { return n.beat === 0 ? "ah" : "eh"; }); }
    function tag() { closing(hymn.tag, "tag", beat0 * 1.15, (plan.rubato || 0) * 1.5, function (n) { return n.syl != null ? ["oh", "ee", "ah", "oh"][n.syl % 4] : null; }); }

    // --- the keying: the chorister gives the key in her habit, then a breath ---
    function keyIt(at, k) {
      var m = ward.byId[k.by] || ch, part = m.part;
      // her octave: do near the middle of her part
      var mid = { S: 392, A: 294, T: 220, B: 147 }[part] || 262, doHz = keynote * ratio(keyM), doOct = 0;
      while (doHz < mid / 1.45) { doHz *= 2; doOct++; } while (doHz > mid * 1.45) { doHz /= 2; doOct--; }
      var firstM = first.melody || first.S || first.T, fHz = firstM ? keynote * ratio(keyM) * ratio(firstM.monzo) : doHz, fOct = 0;
      while (fHz < doHz / 1.5) { fHz *= 2; fOct++; } while (fHz > doHz * 1.9) { fHz /= 2; fOct--; }
      var d0 = doOf(hymn.mode), notes, said = [];
      // (each keyed pitch is written as the monzo it is: do's own, moved by
      // her octaves, and the scale's steps from it)
      function mzOf(d) { var a = spelled(hymn, d0 + d, 0), o = spelled(hymn, d0, 0); return a && o ? [a[0] - o[0] + doOct, a[1] - o[1], a[2] - o[2], (a[3] || 0) - (o[3] || 0)] : [doOct, 0, 0, 0]; }
      function deg(d) { var mz = spelled(hymn, d0 + d, 0); return mz ? doHz * ratio(mz) / ratio(spelled(hymn, d0, 0)) : doHz; }
      var fM = firstM ? [firstM.monzo[0] + fOct, firstM.monzo[1], firstM.monzo[2], firstM.monzo[3] || 0] : [doOct, 0, 0, 0];
      if (k.habit === "fasola") { notes = [{ f: deg(0), dur: 0.5, vowel: "fa" }, { f: deg(1), dur: 0.5, vowel: "sol" }, { f: deg(2), dur: 0.7, vowel: "la" }, { rest: true, dur: 0.25 }, { f: fHz, dur: 0.9, vowel: firstM ? shapeOf(hymn, firstM.deg) : "fa" }]; said = [[d0, mzOf(0)], [d0 + 1, mzOf(1)], [d0 + 2, mzOf(2)], null, [firstM ? firstM.deg : d0, fM]]; }
      else if (k.habit === "fifth") { notes = [{ f: deg(-3), dur: 0.6, vowel: "sol" }, { f: deg(0), dur: 0.9, vowel: "fa" }, { rest: true, dur: 0.3 }, { f: fHz, dur: 0.9, vowel: "hum" }]; said = [[d0 - 3, mzOf(-3)], [d0, mzOf(0)], null, [firstM ? firstM.deg : d0, fM]]; }
      else {
        var again = Math.abs(fHz / deg(0) - 1) > 0.01;
        notes = [{ f: deg(0), dur: 1.0, vowel: "hum" }].concat(again ? [{ rest: true, dur: 0.2 }, { f: fHz, dur: 0.9, vowel: "hum" }] : []);
        said = [[d0, mzOf(0)]].concat(again ? [null, [firstM ? firstM.deg : d0, fM]] : []);
      }
      var at2 = k.under ? Math.max(0, at - 2.2) : at;
      cues.push({ at: round(at2, 4), memberId: m.id, bus: "near", pan: 0, gain: 0.5, notes: notes, breathBefore: 0.5, what: "keying", verse: -1, line: -1, forward: true });
      castEv(at2, m, k.under ? "hums the first note" : "keys the hymn");
      var x = at2;
      notes.forEach(function (n, j) {
        if (!n.rest && said[j]) written.push({ at: round(x, 4), dur: round(n.dur, 4), f: round(n.f, 6), part: part, sings: "key", octave: 0, verse: -1, line: -1, beat: null, syl: null, deg: said[j][0], monzo: said[j][1], comma: 0, member: m.id, role: m.role || null });
        x += n.dur;
      });
      var len = notes.reduce(function (s, n) { return s + n.dur; }, 0);
      return k.under ? at : at2 + len + 0.75;
    }
    // --- the pitching (Sacred Harp, psalmody): the keyer's tonic, then each
    // section's first note on top of it, a chord of every voice, a breath ---
    function pitchIt(at) {
      var m = ward.byId[plan.keying.by] || ch, pr = R ? R.fork("pitching") : { rnd: function (a, b) { return (a + b) / 2; } };
      var tenorDo = base, tOct = 0; while (tenorDo < 150) { tenorDo *= 2; tOct++; } while (tenorDo > 300) { tenorDo /= 2; tOct--; }
      var keyerHz = m.part === "S" || m.part === "A" ? tenorDo * 2 : tenorDo, kOct = m.part === "S" || m.part === "A" ? tOct + 1 : tOct;
      var tonicLen = pr.rnd(0.8, 1.1);
      cues.push({ at: round(at, 4), memberId: m.id, bus: "near", pan: 0, gain: 0.42, notes: [{ f: keyerHz, dur: tonicLen + 0.3, vowel: "hum" }], breathBefore: 0.5, what: "pitching", verse: -1, line: -1, forward: true });
      written.push({ at: round(at, 4), dur: round(tonicLen + 0.3, 4), f: round(keyerHz, 6), part: m.part, sings: "key", octave: 0, verse: -1, line: -1, beat: null, syl: null, deg: 0, monzo: [kOct, 0, 0, 0], comma: 0, member: m.id, role: m.role || null, pitching: true });
      castEv(at, m, "pitches the tune");
      var entries = { T: pr.rnd(0.65, 0.85), B: pr.rnd(1.05, 1.35), S: pr.rnd(1.4, 1.7), A: pr.rnd(1.75, 2.05) };
      var holdTo = pr.rnd(3.3, 4.1), heard = {};
      seated.forEach(function (x) {
        if (x.id === m.id) return;
        var asg = assignment(hymn, x, "sung"), fn = (lines[0].notes[asg[0]] || [])[0];
        if (!fn) return;
        var enter = entries[x.part] + pr.rnd(-0.1, 0.18), dur = Math.max(0.6, holdTo - enter + pr.rnd(-0.12, 0.12));
        cues.push({ at: round(at + enter, 4), memberId: x.id, bus: "hall", pan: panFor(x), gain: round(WARD_GAIN * 0.8, 4),
                    notes: [{ f: hz(fn.monzo, asg[1]), dur: dur, vowel: "hum" }], breathBefore: 0.4, what: "pitching", verse: -1, line: -1 });
        // (each section's note, told once, where the section finds it)
        var key = x.part + "|" + asg[0] + "|" + asg[1];
        if (!heard[key]) { heard[key] = true; tell(at + entries[x.part], { t: 0, dur: holdTo - entries[x.part], n: fn }, x.part, asg[0], asg[1], { verse: -1, line: 0 }, { pitching: true }); }
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
        partNotes(line, next, p, bs, rit, hm).forEach(function (x) {
          notes.push({ f: round(hz(x.n.monzo, 1), 3), dur: round(x.dur, 4), at: round(x.t, 4), pedal: p === "B", v: p === "S" ? 1 : 0.8,
                       part: p, beat: x.n.beat, deg: x.n.deg, monzo: x.n.monzo.slice(), syl: x.n.syl !== null });
        });
      });
      return notes;
    }

    // what has been written since the last take, and the clock where it stands
    function take() {
      var out = { cues: cues, organ: organ, events: events, joins: joins, notes: written, lines: told, end: round(t, 3) };
      cues = []; organ = []; events = []; joins = []; written = []; told = [];
      return out;
    }
    return {
      intro: intro, verse: verse, amen: amen, tag: tag, take: take, beat: beat0,
      get t() { return t; }, set t(v) { t = v; },
    };
  }
  // the breath each singer really has before each line: the silence since
  // their own last note (the voices fit the inhale inside it; the figures
  // written above stand only for a singer's first line). `at` moves the
  // sheet onto the carry's clock (a piece written from its own start).
  function breaths(cues, carry, at) {
    var lastEnd = carry ? carry.lastEnd : {};
    at = at || 0;
    cues.sort(function (a, b) { return a.at - b.at; });
    cues.forEach(function (c) {
      var len = 0, t0 = at + c.at; c.notes.forEach(function (n) { len += n.dur; });
      if (lastEnd[c.memberId] != null) c.breathBefore = round(Math.max(0, Math.min(0.8, t0 - lastEnd[c.memberId])), 3);
      lastEnd[c.memberId] = Math.max(lastEnd[c.memberId] != null ? lastEnd[c.memberId] : -1e9, t0 + len);
    });
  }
  function score(ward, hymn, plan, opts) {
    var w = writer(ward, hymn, plan, opts);
    w.intro();
    plan.verses.forEach(function (P, vi) {
      w.verse(vi);
      if (P.practice !== "lined" && vi < plan.verses.length - 1) w.t += 1.1 * w.beat;
    });
    if (plan.amen && hymn.amen) { w.t += 0.3 * w.beat; w.amen(); }
    if (hymn.tag) { w.t += 0.4 * w.beat; w.tag(); }
    var out = w.take();
    breaths(out.cues, null, 0);
    out.events.sort(function (a, b) { return a.t - b.t; });
    out.hymnId = hymn.id;
    return out;
  }
  // segment(ward, hymn, plan, piece, opts) → one piece of the sheet (see THE
  // PIECES above): piece "intro" | "amen" | "tag" | {verse: v}
  function segment(ward, hymn, plan, piece, opts) {
    opts = opts || {};
    var w = writer(ward, hymn, plan, opts);
    if (piece === "intro") w.intro();
    else if (piece === "amen") { if (hymn.amen) w.amen(); }
    else if (piece === "tag") { if (hymn.tag) w.tag(); }
    else w.verse(piece.verse);
    var end = w.t, out = w.take();
    out.end = end;                                  // (exact: the pieces add up to the whole)
    breaths(out.cues, opts.carry, opts.at || 0);
    out.events.sort(function (a, b) { return a.t - b.t; });
    out.notes.sort(function (a, b) { return a.at - b.at; });
    out.hymnId = hymn.id; out.beatS = w.beat;
    return out;
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
  //   pace = { max, urgent, arm, now }: hand at most `max` cues a call (a
  //   line of the full ward is thirty-two graphs; built in one go it is a
  //   long task on a phone's main thread), except that every cue due before
  //   `urgent` goes now whatever the count; and with `arm` (the caller's
  //   clock plus a lead of at least five pump intervals — 0.6 s for a pump
  //   every 120 ms) a line is built when handed but joins the room only once
  //   it is due to sound before `arm`, each of its mouths only around the
  //   moments it may sound, parting once the caller's `now` has passed
  //   (VoicesVocal's ARMING: a built line not yet joined costs the audio
  //   thread nothing). Without `arm`, every line joins the room as handed.
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
      spec.name = "member:" + id; spec.sharedPan = true; spec.sharedThroat = true; spec.pan = m.pew ? m.pew.x : 0;
      if (synth) spec.rand = synth.fork("member:" + id); else spec.seed = 1;
      return (singers[id] = V.singer(spec));
    }
    function pump(ctx, buses, t0, sheet, horizon, pace) {
      var handed = [], max = pace && pace.max || Infinity, urgent = pace && pace.urgent != null ? pace.urgent : -Infinity;
      var defer = !!(pace && pace.arm != null && V.arm);
      sheet._ci = sheet._ci || 0; sheet._oi = sheet._oi || 0;
      while (sheet._ci < sheet.cues.length && t0 + sheet.cues[sheet._ci].at - LEAD <= horizon) {
        if (handed.length >= max && t0 + sheet.cues[sheet._ci].at - LEAD > urgent) break;
        var c = sheet.cues[sheet._ci++];
        // a voice heard on its own breathes where a person would; in the
        // ward, only a few are heard to (the voices' own small share)
        voiceOf(c.memberId).sing(ctx, c.bus === "near" ? buses.near : buses.hall, t0 + c.at, c.notes, c.gain,
                                 { breathBefore: c.breathBefore, pan: c.pan, inhale: c.forward ? FORWARD_INHALE : null, defer: defer });
        handed.push(c);
      }
      while (sheet._oi < sheet.organ.length && t0 + sheet.organ[sheet._oi].at - LEAD <= horizon) {
        var o = sheet.organ[sheet._oi++];
        if (opts.organ) opts.organ(t0 + o.at, o);
      }
      // the lines about to sound join the room (handed early, joined late)
      if (defer) V.arm(ctx, pace.arm, pace.now);
      return handed;
    }
    // THE DESK (the meeting's way). A meeting hands the ward many pieces
    // (a hymn's intro, its verses one by one, a fuging, the hum of the
    // gathering, an answer to the deacon), each placed at its own start on
    // the audio clock when the meeting reaches it; one pump hands them all
    // over, soonest first, the budget of `max` lines a call shared between
    // them. The caller's clock is the only clock (tick reads none).
    //   enqueue(t0, sheet)                     a piece to sing, from t0
    //   tick(ctx, buses, horizon, pace)        as pump(), for every piece
    //   clear()                                a stopped meeting: nothing more is handed
    //   pending()                              pieces with lines still to hand
    //   stats()                                lines handed; how many tight (handed
    //                                          under 0.3 s before they sound: an
    //                                          inhale's lead cut short) and how many
    //                                          late (after their time); the tightest
    //                                          margin; the most handed in one call
    var desk = [], st = { handed: 0, tight: 0, late: 0, tightest: Infinity, most: 0, organ: 0 };
    function enqueue(t0, sheet) {
      sheet._ci = sheet._ci || 0; sheet._oi = sheet._oi || 0;
      desk.push({ t0: t0, sheet: sheet });
    }
    function tick(ctx, buses, horizon, pace) {
      var handed = 0, max = pace && pace.max || Infinity, urgent = pace && pace.urgent != null ? pace.urgent : -Infinity;
      var defer = !!(pace && pace.arm != null && V.arm), nowT = pace && pace.now != null ? pace.now : null;
      // (a piece the caller has let go — sheet.alive() says no: a hymn whose
      // section was left — hands nothing more)
      desk.forEach(function (d) { if (d.sheet.alive && !d.sheet.alive()) { d.sheet._ci = d.sheet.cues.length; d.sheet._oi = d.sheet.organ.length; } });
      for (;;) {
        // the piece whose next line is soonest
        var best = null, bt = Infinity;
        for (var i = 0; i < desk.length; i++) {
          var d = desk[i], s = d.sheet;
          if (s._ci < s.cues.length && d.t0 + s.cues[s._ci].at < bt) { bt = d.t0 + s.cues[s._ci].at; best = d; }
        }
        if (!best || bt - LEAD > horizon) break;
        if (handed >= max && bt - LEAD > urgent) break;
        var c = best.sheet.cues[best.sheet._ci++];
        voiceOf(c.memberId).sing(ctx, c.bus === "near" ? buses.near : buses.hall, best.t0 + c.at, c.notes, c.gain,
                                 { breathBefore: c.breathBefore, pan: c.pan, inhale: c.forward ? FORWARD_INHALE : null, defer: defer });
        handed++; st.handed++;
        if (nowT != null) {
          var margin = best.t0 + c.at - nowT;
          if (margin < st.tightest) st.tightest = margin;
          if (margin < 0.3) st.tight++;
          if (margin < 0) st.late++;
        }
      }
      desk.forEach(function (d) {
        var s = d.sheet;
        while (s._oi < s.organ.length && d.t0 + s.organ[s._oi].at - LEAD <= horizon) {
          var o = s.organ[s._oi++];
          st.organ++;
          if (opts.organ) opts.organ(d.t0 + o.at, o, s);
        }
      });
      if (handed > st.most) st.most = handed;
      desk = desk.filter(function (d) { return d.sheet._ci < d.sheet.cues.length || d.sheet._oi < d.sheet.organ.length; });
      if (defer) V.arm(ctx, pace.arm, pace.now);
      return handed;
    }
    return {
      voiceOf: voiceOf,
      pump: pump,
      schedule: function (ctx, buses, t0, sheet) { return pump(ctx, buses, t0, sheet, Infinity); },
      reset: function (sheet) { sheet._ci = 0; sheet._oi = 0; },
      enqueue: enqueue, tick: tick,
      clear: function () { desk = []; },
      pending: function () { return desk.length; },
      stats: function () { return { handed: st.handed, tight: st.tight, late: st.late, tightest: st.tightest === Infinity ? null : +st.tightest.toFixed(3), most: st.most, organ: st.organ, pieces: desk.length }; },
    };
  }

  return {
    seat: seat, planHymn: planHymn, planRefrain: planRefrain, score: score, segment: segment, performer: performer,
    clock: clockOf, roundGroups: roundGroups, QUARTET_RATE: QUARTET_RATE,
    who: who, panOf: panOf, layoutFor: layoutFor, descantLine: descantLine, deseret: deseret, deseretCaps: deseretCaps,
    assignment: assignment,
    ROLES: ROLE_ORDER, ROLE_NAME: ROLE_NAME, ROSTER: ROSTER, PART_NAME: PART_NAME,
    PRACTICE_DO: PRACTICE_DO, ACTION_DS: ACTION_DS, ACTION_FORWARD: ACTION_FORWARD, WARD_GAIN: WARD_GAIN, actionKey: actionKey,
    rosterSize: function () { var n = 0; for (var r in ROSTER) n += ROSTER[r].length; return n; },
  };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-cast.js"] = true;   // the load guard's roll call

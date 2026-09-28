// ============================================================================
// KOLOB — kolob-hymnists.js: the colony's hymnists
//
// Fifteen people of the settlement who write the ward's new hymns
// (PLAN-COMPOSITION §14, item 1: COLONY COMPOSERS, approved). None of them
// is a template. Each is a set of HABITS that lean on the composer's dice
// and its search: the meters they reach for, how high and how wide they let
// a tune go, how often they leap, which rhythm cells they like, the way they
// like to end a hymn, and whether they are fond of a refrain. The composer
// multiplies its own weights by these and scores its candidates against
// them — so a hymn by Abner Hale is more often a minor Sacred Harp tune that
// leaps and ends on a bare fifth, and a hymn by Orson Tebbs is more often a
// plain four-square Tabernacle tune — but either may write the other's kind
// of hymn when the day asks it of them.
//
// The event log will name the author in Deseret; the staff shows nothing
// (§14). nameEn is dev-only, for the labs; it is never rendered in the app.
//
// THE HABITS (every field is a weight or a target, never a rule):
//   lean      which dialect they write in, when nobody names one
//   meters    their favourite meters (multiplies the dialect's own)
//   forms     their favourite line forms
//   times     their favourite modes of time (multiplies the dialect's)
//   modes     the modes they write in, when nobody names one
//   range     [lo, hi]: how wide a tune they write, in scale steps
//   peakAt    where the high point falls, as a fraction of the tune
//   peakTo    how high the high point climbs, in steps above the final
//   leap      the share of leaps (a third or more) they aim for
//   cells     rhythm-cell appetites, by cell id (see the composer's CELLS)
//   ending    their signature approaches to the last note: [figure, weight],
//             a figure being the last notes as steps above the final
//   refrain   fondness for a refrain; fuge, for a fuge (dialect B)
//   kinds     (dialect E) which unison song they write: a Shaker hymn, a
//             gift song on wordless syllables, a Primary song
//   repeat    fondness for returning lines (ABAC, AABA against ABCD)
//   sequence  fondness for a figure repeated a step higher or lower
//   color     Tabernacle: secondary dominants and the approach diminished
//   sevenths, susp, passing   Tabernacle: their appetite for each
//   open      Sacred Harp: how bare the chords are (thirdless)
//   alto      Sacred Harp: how often they write an alto at all
//   ornament  Old Way: how many ornament slots they leave the singers
//   melisma   how often a syllable takes two notes
//   fermata   how often an inner line ends on a hold
//   tempo     their beat, against the dialect's (1 = as written)
//   contours  the line shapes they reach for
//
// Pure (SCORE.md §1): data and small readers. No audio, no clock, no dice.
// ============================================================================

window.KOLOB = window.KOLOB || {};
window.KOLOB.Hymnists = (function () {
  "use strict";

  var LIST = [
    {
      id: "beeson", nameEn: "Thankful Beeson", nameDs: "𐐛𐐰𐑍𐐿𐑁𐐳𐑊 𐐒𐐨𐑅𐐲𐑌",
      about: "a Victorian of the choir loft: warm tunes, the organ's suspensions, a secondary dominant where the words lift",
      lean: { tabernacle: 3, sacredharp: 0.4, oldway: 0.3, psalmody: 0.4, gospel: 1.5, shaker: 0.3 },
      meters: { CM: 3, LM: 2, "87.87": 2, SM: 1, CMD: 0.8, "76.76D": 0.6, "11s": 0.4, "10.10R": 0.3 },
      forms: { ABAC: 2, ABCD: 1.5, AABA: 0.8, "ABA'C": 1.2 },
      times: { "4/4": 1.4, "3/4": 1, "6/8": 0.5, "2/2": 0.6, "3/2": 0.3 },
      modes: { ionian: 4, mixolydian: 1, aeolian: 0.8, dorian: 0.4, hexa: 0.5, penta: 0.3 },
      range: [8, 9], peakAt: 0.7, peakTo: { 7: 2, 8: 1.5, 9: 1 }, leap: 0.2,
      cells: { even: 1, dotted: 1.6, slurS: 1, slurU: 0.8, long: 1, dotS: 1.3 },
      ending: [[[2, 1, 0], 3], [[4, 2, 1, 0], 1]],
      refrain: 0.12, fuge: 0.05, repeat: 0.6, sequence: 0.35,
      color: 0.8, sevenths: 0.7, susp: 0.9, passing: 0.6,
      open: 0.4, alto: 0.6, ornament: 0.3, melisma: 0.3, fermata: 0.5, tempo: 1,
      contours: { arch: 2, descent: 1, climb: 1, wave: 1 },
    },
    {
      id: "hale", nameEn: "Abner Hale", nameDs: "𐐈𐐺𐑌𐐲𐑉 𐐐𐐩𐑊",
      about: "a singing-school master of the old square: minor tunes in the tenor, wide leaps, bare fifths to end on",
      lean: { tabernacle: 0.3, sacredharp: 3, oldway: 0.8, psalmody: 3, gospel: 0.2, shaker: 0.3 },
      meters: { CM: 2, SM: 2, LM: 1.5, "87.87": 0.6, CMD: 0.6, "11s": 0.5 },
      forms: { ABCD: 2.5, ABAC: 0.8, "ABA'C": 0.6 },
      times: { "4/4": 1, "3/2": 1.6, "3/4": 1, "2/2": 1.2, "6/8": 0.3 },
      modes: { aeolian: 3, dorian: 2, ionian: 1, penta: 0.8, mixolydian: 0.6, hexa: 0.5 },
      range: [9, 10], peakAt: 0.66, peakTo: { 7: 2, 8: 1, 9: 0.6, 5: 0.5 }, leap: 0.36,
      cells: { even: 1, dotted: 0.6, long: 1.5, slurS: 1.2, slurU: 1 },
      ending: [[[-3, 0], 3], [[-1, 0], 1.5]],
      refrain: 0.05, fuge: 0.5, repeat: 0.3, sequence: 0.25,
      color: 0.1, sevenths: 0.2, susp: 0.2, passing: 0.3,
      open: 0.85, alto: 0.3, ornament: 0.4, melisma: 0.45, fermata: 0.1, tempo: 1,
      contours: { arch: 1.5, descent: 2, climb: 1, wave: 1 },
    },
    {
      id: "carrow", nameEn: "Zina Carrow", nameDs: "𐐞𐐨𐑌𐐲 𐐗𐐰𐑉𐐬",
      about: "who leads the lined hymns on fast Sundays: narrow, slow, stepping tunes with room between the notes for the ward to decorate",
      lean: { tabernacle: 0.2, sacredharp: 0.9, oldway: 3, psalmody: 0.6, gospel: 0.1, shaker: 1.2 },
      meters: { CM: 3, SM: 2, LM: 1.5, "87.87": 0.3 },
      forms: { ABCD: 2, ABAC: 1 },
      times: { "3/2": 2, "2/2": 1.2, "4/4": 1, "3/4": 0.6 },
      modes: { dorian: 2, aeolian: 2, mixolydian: 1.5, penta: 1.5, ionian: 0.6, hexa: 1 },
      range: [6, 7], peakAt: 0.64, peakTo: { 5: 1.5, 4: 1, 7: 1 }, leap: 0.15,
      cells: { even: 1.2, long: 1.4, slurS: 1.6, slurU: 1.2, dotted: 0.3 },
      ending: [[[1, 0], 2], [[-2, -1, 0], 1.5]],
      refrain: 0, fuge: 0, repeat: 0.35, sequence: 0.15,
      color: 0, sevenths: 0.1, susp: 0.2, passing: 0.2,
      open: 0.7, alto: 0.2, ornament: 0.9, melisma: 0.6, fermata: 0.6, tempo: 1.12,
      contours: { arch: 2, descent: 1.5, wave: 1.2, climb: 0.5 },
    },
    {
      id: "lund", nameEn: "Hosea Lund", nameDs: "𐐐𐐬𐑆𐐩𐐲 𐐢𐐲𐑌𐐼",
      about: "a bright lilting hand: six-eight and three-four, dotted figures, and a refrain he can never resist",
      lean: { tabernacle: 3, sacredharp: 0.8, oldway: 0.1, psalmody: 0.4, gospel: 3, shaker: 1.2 },
      meters: { "76.76D": 2, "87.87": 2, CM: 1, "11s": 1.2, "10.10R": 1, LM: 0.6 },
      forms: { ABAC: 2, "ABA'C": 1.5, ABCD: 1 },
      times: { "6/8": 2.2, "3/4": 1.6, "4/4": 0.8, "2/2": 0.3 },
      modes: { ionian: 3, mixolydian: 1.5, hexa: 1, penta: 0.8, dorian: 0.3, aeolian: 0.3 },
      range: [9, 9], peakAt: 0.68, peakTo: { 9: 1.5, 8: 1.5, 7: 1 }, leap: 0.26,
      cells: { dotted: 2.2, dotS: 1.8, long: 1.2, even: 0.8, slurU: 1 },
      ending: [[[4, 2, 0], 3], [[2, 1, 0], 1]],
      refrain: 0.55, fuge: 0.1, repeat: 0.7, sequence: 0.5,
      color: 0.5, sevenths: 0.8, susp: 0.4, passing: 0.7,
      open: 0.45, alto: 0.6, ornament: 0.2, melisma: 0.25, fermata: 0.25, tempo: 0.96,
      contours: { arch: 1.5, climb: 1.5, wave: 1.2, descent: 0.8 },
    },
    {
      id: "oakes", nameEn: "Mercy Oakes", nameDs: "𐐣𐐲𐑉𐑅𐐨 𐐄𐐿𐑅",
      about: "the ward's fiercest tenor: minor tunes with a wide compass that climb the modal subtonic home",
      lean: { tabernacle: 0.4, sacredharp: 3, oldway: 1, psalmody: 2.5, gospel: 0.3, shaker: 0.4 },
      meters: { LM: 2, CM: 1.5, "87.87": 1.5, "87.87D": 1, SM: 1, "11s": 0.6 },
      forms: { ABCD: 2, ABAC: 1, "ABA'C": 1 },
      times: { "4/4": 1.4, "3/4": 1.2, "3/2": 0.8, "2/2": 1, "6/8": 0.5 },
      modes: { aeolian: 3, dorian: 3, mixolydian: 1, penta: 0.6, ionian: 0.6, hexa: 0.4 },
      range: [10, 10], peakAt: 0.72, peakTo: { 8: 1.5, 7: 1.5, 9: 1 }, leap: 0.4,
      cells: { even: 1, long: 1.2, dotted: 1.1, slurS: 1.2, slurU: 1.2 },
      ending: [[[-1, 0], 3], [[2, 1, 0], 1]],
      refrain: 0.08, fuge: 0.7, repeat: 0.3, sequence: 0.4,
      color: 0.2, sevenths: 0.3, susp: 0.3, passing: 0.4,
      open: 0.75, alto: 0.5, ornament: 0.5, melisma: 0.4, fermata: 0.1, tempo: 0.95,
      contours: { climb: 1.5, arch: 1.5, descent: 1, wave: 1 },
    },
    {
      id: "tebbs", nameEn: "Orson Tebbs", nameDs: "𐐃𐑉𐑅𐐲𐑌 𐐓𐐯𐐺𐑆",
      about: "plain and four-square: even notes, a narrow compass, ii–V–I and no fuss",
      lean: { tabernacle: 3, sacredharp: 0.6, oldway: 0.4, psalmody: 0.8, gospel: 0.8, shaker: 0.8 },
      meters: { LM: 2.5, CM: 2, SM: 1.2, "87.87": 1, CMD: 0.5 },
      forms: { AABA: 1.6, ABAC: 1.4, ABCD: 1 },
      times: { "4/4": 2, "2/2": 1.4, "3/4": 0.6, "3/2": 0.4 },
      modes: { ionian: 4, hexa: 1, mixolydian: 0.6, aeolian: 0.5, dorian: 0.3, penta: 0.5 },
      range: [7, 8], peakAt: 0.7, peakTo: { 7: 2, 5: 1, 8: 0.6 }, leap: 0.13,
      cells: { even: 2.4, dotted: 0.4, slurS: 0.3, slurU: 0.3, long: 1.2 },
      ending: [[[1, 0], 3], [[2, 1, 0], 1.5]],
      refrain: 0.05, fuge: 0, repeat: 0.8, sequence: 0.2,
      color: 0.1, sevenths: 0.5, susp: 0.2, passing: 0.25,
      open: 0.4, alto: 0.6, ornament: 0.2, melisma: 0.1, fermata: 0.35, tempo: 1.04,
      contours: { arch: 1.5, descent: 1.5, climb: 0.8, wave: 0.8 },
    },
    {
      id: "fife", nameEn: "Lovina Fife", nameDs: "𐐢𐐬𐑂𐐴𐑌𐐲 𐐙𐐴𐑁",
      about: "lyrical and early to its height: a rising sixth she loves, a waltz lilt, a turn back up to the tonic",
      lean: { tabernacle: 2.5, sacredharp: 0.5, oldway: 0.8, psalmody: 0.3, gospel: 1.2, shaker: 1.5 },
      meters: { "87.87": 2, "11s": 2, CM: 1, "76.76D": 1, LM: 0.6 },
      forms: { ABAC: 1.5, "ABA'C": 1.5, ABCD: 1.2 },
      times: { "3/4": 2.2, "6/8": 1.2, "4/4": 0.8, "3/2": 0.5 },
      modes: { ionian: 3, mixolydian: 1, aeolian: 1, dorian: 0.8, hexa: 0.8, penta: 0.5 },
      range: [9, 9], peakAt: 0.62, peakTo: { 8: 1.5, 9: 1.5, 7: 1 }, leap: 0.24,
      cells: { long: 2, dotS: 1.2, slurS: 1.2, even: 1, dotted: 1 },
      ending: [[[0, -1, 0], 3], [[2, 1, 0], 1]],
      refrain: 0.25, fuge: 0.05, repeat: 0.5, sequence: 0.35,
      color: 0.6, sevenths: 0.6, susp: 0.6, passing: 0.5,
      open: 0.5, alto: 0.5, ornament: 0.5, melisma: 0.35, fermata: 0.3, tempo: 1,
      contours: { arch: 2, climb: 1.2, wave: 1.2, descent: 0.6 },
      likes: { sixthUp: 1 },
    },
    {
      id: "stroud", nameEn: "Ammon Stroud", nameDs: "𐐈𐑋𐐲𐑌 𐐝𐐻𐑉𐐵𐐼",
      about: "camp-meeting blood: major Sacred Harp tunes in a dancing six-eight, choruses, the re–do close over a bare fifth",
      lean: { tabernacle: 0.8, sacredharp: 3, oldway: 0.2, psalmody: 1.2, gospel: 2.5, shaker: 0.8 },
      meters: { "87.87D": 1.5, "87.87": 1.5, "11s": 1.5, CM: 1, "10.10R": 1 },
      forms: { ABAC: 1.5, ABCD: 1.2, AABA: 1 },
      times: { "6/8": 2, "3/4": 1.6, "4/4": 1, "2/2": 0.4 },
      modes: { ionian: 2.5, hexa: 1.5, penta: 1.5, mixolydian: 1.2, aeolian: 0.6, dorian: 0.5 },
      range: [8, 9], peakAt: 0.7, peakTo: { 7: 2, 8: 1, 9: 1 }, leap: 0.3,
      cells: { long: 1.6, dotted: 1.6, dotS: 1.3, even: 1, slurU: 0.8 },
      ending: [[[1, 0], 3], [[4, 0], 1]],
      refrain: 0.45, fuge: 0.3, repeat: 0.6, sequence: 0.45,
      color: 0.3, sevenths: 0.4, susp: 0.3, passing: 0.4,
      open: 0.7, alto: 0.4, ornament: 0.3, melisma: 0.3, fermata: 0.15, tempo: 0.94,
      contours: { arch: 1.5, climb: 1.2, wave: 1.5, descent: 0.8 },
    },
    {
      id: "vail", nameEn: "Emmeline Vail", nameDs: "𐐇𐑋𐐲𐑊𐐴𐑌 𐐚𐐩𐑊",
      about: "stately minims and a late climax: the diminished seventh just before the height, and the cadential six-four",
      lean: { tabernacle: 3, sacredharp: 0.3, oldway: 0.6, psalmody: 1, gospel: 0.4, shaker: 0.3 },
      meters: { SM: 2, CM: 2, LM: 1.5, CMD: 1, "76.76D": 0.6 },
      forms: { ABCD: 1.6, ABAC: 1.4, "ABA'C": 1 },
      times: { "2/2": 2, "4/4": 1.4, "3/2": 1, "3/4": 0.5 },
      modes: { ionian: 2.5, aeolian: 1.5, dorian: 1, mixolydian: 0.6, hexa: 0.5, penta: 0.3 },
      range: [8, 9], peakAt: 0.74, peakTo: { 8: 1.5, 7: 1.5, 9: 1 }, leap: 0.17,
      cells: { even: 1.6, dotted: 0.8, long: 1.4, slurS: 0.6, slurU: 0.6 },
      ending: [[[2, 1, 0], 3], [[0, -1, 0], 1]],
      refrain: 0.05, fuge: 0.05, repeat: 0.5, sequence: 0.3,
      color: 1, sevenths: 0.8, susp: 1, passing: 0.5,
      open: 0.4, alto: 0.6, ornament: 0.4, melisma: 0.2, fermata: 0.45, tempo: 1.06,
      contours: { climb: 1.4, arch: 1.4, descent: 1, wave: 0.8 },
    },
    {
      id: "quayle", nameEn: "Tirzah Quayle", nameDs: "𐐓𐐮𐑉𐑆𐐲 𐐗𐐶𐐩𐑊",
      about: "a gapped, pentatonic ear from the far wards: tunes that skip where others step, lined or in the square",
      lean: { tabernacle: 0.4, sacredharp: 2, oldway: 2.5, psalmody: 0.8, gospel: 0.3, shaker: 2.5 },
      meters: { CM: 2.5, LM: 1.5, SM: 1, "87.87": 0.8, "11s": 0.5 },
      forms: { ABCD: 1.6, ABAC: 1.2, AABA: 0.8 },
      times: { "3/4": 1.5, "3/2": 1.4, "4/4": 1, "2/2": 0.8, "6/8": 0.5 },
      modes: { penta: 3, hexa: 2, mixolydian: 1.2, dorian: 1.2, aeolian: 0.8, ionian: 0.6 },
      range: [7, 8], peakAt: 0.64, peakTo: { 7: 1.5, 5: 1.2, 8: 1 }, leap: 0.3,
      cells: { long: 1.6, even: 1, slurS: 1.4, slurU: 1.2, dotted: 0.6 },
      ending: [[[2, 0], 3], [[-3, 0], 1.2]],
      refrain: 0.1, fuge: 0.1, repeat: 0.45, sequence: 0.2,
      color: 0.1, sevenths: 0.2, susp: 0.2, passing: 0.3,
      open: 0.8, alto: 0.3, ornament: 0.7, melisma: 0.5, fermata: 0.4, tempo: 1.02,
      contours: { arch: 1.5, wave: 1.5, descent: 1.2, climb: 0.8 },
    },
    {
      id: "arbogast", nameEn: "Nephi Arbogast", nameDs: "𐐤𐐨𐑁𐐴 𐐂𐑉𐐺𐐬𐑀𐐰𐑅𐐻",
      about: "long lines and sequences, a refrain after the verse, and a last do struck twice",
      lean: { tabernacle: 2, sacredharp: 1.5, oldway: 0.4, psalmody: 1.5, gospel: 2, shaker: 0.6 },
      meters: { "10.10R": 2, "11s": 2, "87.87D": 1, LM: 1, CM: 0.8, "76.76D": 1 },
      forms: { ABAC: 1.2, ABCD: 1.2, "ABA'C": 1.2, AABA: 0.8 },
      times: { "4/4": 1.2, "3/4": 1.2, "6/8": 1, "2/2": 0.6 },
      modes: { ionian: 2, mixolydian: 1.5, dorian: 1.2, aeolian: 1, hexa: 1, penta: 0.8 },
      range: [9, 10], peakAt: 0.68, peakTo: { 9: 1.2, 8: 1.2, 7: 1 }, leap: 0.22,
      cells: { even: 1.2, dotted: 1.2, long: 1.2, dotS: 1, slurS: 0.8, slurU: 0.8 },
      ending: [[[0, 0], 3], [[1, 0], 1]],
      refrain: 0.4, fuge: 0.3, repeat: 0.5, sequence: 0.9,
      color: 0.5, sevenths: 0.6, susp: 0.5, passing: 0.6,
      open: 0.6, alto: 0.5, ornament: 0.4, melisma: 0.3, fermata: 0.3, tempo: 0.98,
      contours: { wave: 1.6, climb: 1.2, arch: 1.2, descent: 1 },
    },
    {
      id: "welling", nameEn: "Jerusha Welling", nameDs: "𐐖𐐲𐑉𐐭𐑇𐐲 𐐎𐐯𐑊𐐮𐑍",
      about: "gentle and close: short meters, steps more than leaps, the mi–re–do that everyone can sing",
      lean: { tabernacle: 2, sacredharp: 0.5, oldway: 2, psalmody: 0.3, gospel: 1, shaker: 2.5 },
      meters: { SM: 2.5, "76.76D": 1.5, CM: 1.5, "87.87": 1, LM: 0.6 },
      forms: { ABAC: 1.5, AABA: 1.2, ABCD: 1 },
      times: { "3/4": 1.4, "4/4": 1.2, "3/2": 1, "6/8": 0.6, "2/2": 0.6 },
      modes: { ionian: 2, hexa: 1.5, mixolydian: 1, dorian: 1, aeolian: 1, penta: 1 },
      range: [7, 7], peakAt: 0.66, peakTo: { 5: 1.5, 7: 1.5, 4: 0.5 }, leap: 0.14,
      cells: { even: 1.4, long: 1.4, slurS: 1, slurU: 1, dotted: 0.6 },
      ending: [[[2, 1, 0], 3], [[1, 0], 1]],
      refrain: 0.15, fuge: 0, repeat: 0.7, sequence: 0.3,
      color: 0.2, sevenths: 0.4, susp: 0.5, passing: 0.4,
      open: 0.5, alto: 0.6, ornament: 0.6, melisma: 0.35, fermata: 0.4, tempo: 1.04,
      contours: { arch: 2, descent: 1.2, wave: 1, climb: 0.6 },
    },
    // ---- round 3: three who write in the new dialects, and in nothing else
    // (their leans toward the first three are nought, so no earlier draw moves)
    {
      id: "lowe", nameEn: "Sariah Lowe", nameDs: "𐐝𐐲𐑉𐐴𐐲 𐐢𐐬",
      about: "the Primary's president: short songs for the children, a chorus they can shout, a narrow compass and a skip of joy in it",
      lean: { tabernacle: 0, sacredharp: 0, oldway: 0, psalmody: 0, gospel: 0.6, shaker: 3.5 },
      kinds: { primary: 3, shaker: 0.6, gift: 0.4 },
      meters: { "66.66": 3, "65.65": 2, "77.77": 1.5, SM: 1, CM: 0.6 },
      forms: { ABAC: 2, AABA: 2, "AA'BA": 1 },
      times: { "6/8": 2, "2/4": 1.6, "3/4": 1.2, "4/4": 1 },
      modes: { ionian: 4, penta: 2, hexa: 1.5, mixolydian: 0.6, dorian: 0.2, aeolian: 0.2 },
      range: [6, 7], peakAt: 0.66, peakTo: { 5: 1.5, 7: 1.5, 4: 1 }, leap: 0.28,
      cells: { dotted: 2, even: 1.2, dotS: 1.2, long: 0.6 },
      ending: [[[4, 2, 0], 2], [[2, 1, 0], 2]],
      refrain: 0.8, fuge: 0, repeat: 0.8, sequence: 0.6,
      color: 0.2, sevenths: 0.4, susp: 0.1, passing: 0.3,
      open: 0.4, alto: 0.4, ornament: 0.1, melisma: 0.1, fermata: 0.1, tempo: 0.92,
      contours: { arch: 1.5, climb: 1.5, wave: 1.2, descent: 0.6 },
    },
    {
      id: "cutler", nameEn: "Ephraim Cutler", nameDs: "𐐀𐑁𐑉𐐨𐐲𐑋 𐐗𐐲𐐻𐑊𐐲𐑉",
      about: "the Social Hall's quartet man: a lead who holds his note long enough for the chord to turn under it, sevenths all the way down the circle, and a tag to finish",
      lean: { tabernacle: 0, sacredharp: 0, oldway: 0, psalmody: 0.2, gospel: 3.5, shaker: 0.2 },
      meters: { "87.87": 2, "11s": 1.5, CM: 1.2, "10.10R": 1.2, "77.77": 1 },
      forms: { AABA: 2, ABAC: 1.5, "AA'BA": 1 },
      times: { "4/4": 2, "6/8": 1.2, "3/4": 1.2 },
      modes: { ionian: 5, mixolydian: 0.8, hexa: 0.5, penta: 0.3 },
      range: [8, 9], peakAt: 0.7, peakTo: { 7: 2, 8: 1.5 }, leap: 0.22,
      cells: { long: 2, dotted: 1.6, even: 1 },
      ending: [[[2, 1, 0], 2], [[0, -1, 0], 1]],
      refrain: 0.9, fuge: 0, repeat: 0.7, sequence: 0.5,
      color: 0.95, sevenths: 1, susp: 0.2, passing: 0.4,
      open: 0.1, alto: 0.8, ornament: 0.1, melisma: 0.2, fermata: 0.5, tempo: 1.05,
      contours: { arch: 1.5, wave: 1.2, climb: 1, descent: 1 },
    },
    {
      id: "eddy", nameEn: "Tamar Eddy", nameDs: "𐐓𐐩𐑋𐐪𐑉 𐐇𐐼𐐨",
      about: "a sister who receives songs: wordless dancing tunes that come to her whole, two strains and each sung twice, often over a drone",
      lean: { tabernacle: 0, sacredharp: 0, oldway: 0, psalmody: 0.3, gospel: 0.2, shaker: 3.5 },
      kinds: { gift: 3, shaker: 1, primary: 0.2 },
      meters: { "88.88": 3, "77.77": 2, "66.66": 1 },
      forms: { "AA'BB'": 3, AABA: 1 },
      times: { "2/4": 2, "6/8": 2, "3/4": 0.8 },
      modes: { penta: 2.5, ionian: 2, mixolydian: 1.5, dorian: 1.2, hexa: 1.2, aeolian: 0.6 },
      range: [7, 8], peakAt: 0.66, peakTo: { 7: 2, 5: 1.2, 8: 1 }, leap: 0.3,
      cells: { even: 1.6, dotted: 1.4, dotS: 1.4 },
      ending: [[[4, 2, 0], 2], [[1, 0], 1.5]],
      refrain: 0.1, fuge: 0, repeat: 0.9, sequence: 0.7,
      color: 0, sevenths: 0, susp: 0, passing: 0.2,
      open: 0.6, alto: 0.2, ornament: 0.3, melisma: 0.15, fermata: 0.05, tempo: 0.9,
      contours: { wave: 2, arch: 1.4, climb: 1, descent: 0.8 },
    },
  ];

  var INDEX = {};
  LIST.forEach(function (h) { INDEX[h.id] = h; });

  // the hymnist a caller names — an id, a hymnist, or nothing (→ null)
  function byId(x) {
    if (!x) return null;
    if (typeof x === "object") return x.id && INDEX[x.id] ? INDEX[x.id] : x;
    return INDEX[x] || null;
  }
  // who writes today, when nobody says: weighted by each hymnist's lean
  // toward the dialect (or by the sum of their leans when no dialect is
  // named). One die, always thrown.
  function draw(R, dialect) {
    return R.pickW(LIST.map(function (h) {
      // (a lean written as nought is nought: the round-3 hymnists never write
      // in the first three dialects, so the draws there are as they were)
      var lw = dialect ? h.lean[dialect] : null;
      var w = dialect ? (lw != null ? lw : 0.05) : (h.lean.tabernacle + h.lean.sacredharp + h.lean.oldway);
      return [h, w];
    }));
  }
  // a habit table (meters, forms, …) read as a weight, 1 when unnamed
  function w(table, key, dflt) {
    if (!table) return dflt == null ? 1 : dflt;
    var v = table[key];
    return v == null ? (dflt == null ? 0.35 : dflt) : v;
  }
  // the few fields a Score carries (JSON-plain)
  function card(h) { return h ? { id: h.id, nameDs: h.nameDs, nameEn: h.nameEn } : null; }

  return { list: LIST, byId: byId, draw: draw, weight: w, card: card };
})();
(window.KOLOB._rooms = window.KOLOB._rooms || {})["kolob-hymnists.js"] = true;   // the load guard's roll call

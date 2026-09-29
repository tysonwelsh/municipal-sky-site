# r3c-voices-1: the gift of tongues, the far ward, and the Hosanna

*GUEST crew, round 3c. Branch `kolob-r3c-voices`. 2026-09-29.*

**What is new to hear:** three new guests, each built as a module the
engine can seat, and a lab to hear them in with the Sunday's own ward.
None of them plays in a meeting yet: the round-3c integration step wires
them in, and this note gives it the recipe. Nothing was pushed or
published, and VERSION is not bumped.

Nobody has listened. Every check below was made with the sound muted
(headless Chrome with `--mute-audio`, or offline renders). The ear is
still to come.

---

## For the owner, in plain words

1. **The gift of tongues.** In the testimony, one of the ward rises and
   sings, unbidden, in syllables no one knows. It is a free song with no
   beat, full of runs and turns (melismas). It climbs in arches to a
   height about two-thirds of the way through and comes down to rest.
   - **The singer** is one of the day's testimony-bearers.
   - **The language** is Deseret sounds, one sound per letter, from a
     small "tongue" drawn fresh for each song: three to five soft,
     voiced consonants and three to five vowels. They make a handful of
     words that come back as words do. The first word returns at the head
     of later phrases, like a name.
   - **The ward's answer.** The singer's own section hums the last note
     with them. The rest of the room fills it into a chord: bare fifths in
     a Sacred Harp or Old Way house, the full triad in a Tabernacle one,
     do in octaves in a Shaker one.
   - **The harmonium** then softly takes up the song's opening, slower,
     over a held do.
   - **How often:** mostly on fast Sundays (about one in five) and at a
     dedication. It lasts 35–60 s.
2. **The far ward.** Through the open windows you hear another ward,
   elsewhere in the colony, singing **the same hymn half a line to a full
   line behind ours**.
   - It is heard across a valley: darker (the air takes the high
     frequencies), mostly echo, from one side.
   - Its tuning is 8–20 cents off ours and drifts, as a ward singing
     without an organ does.
   - Its chorister keeps a slightly different time, so the canon breathes
     a little. It finds us again at each verse.
   - Sometimes it sings our hymn in another harmony: Sacred Harp while we
     sing Tabernacle, or in unison.
   - It joins from the second verse, or only the last, or all of them.
     About one meeting in ten, most at a conference.
3. **The Hosanna.** Only on Easter (about half of them) and at a
   dedication (nearly always), at the close of the doxology. Nothing is
   written anywhere: every event and every note it sends says
   `logged: false` (corrected in round 2).
   - **The shout.** The whole ward stands and shouts "Hosanna, Hosanna,
     Hosanna, to God and the Lamb" three times, then "Amen, Amen, and
     Amen". It is a crowd of forty (the thirty-two and the Primary's
     children), each on their own raised speaking voice, each a moment
     early or late. The room rings between the three shouts, and each
     shout rises a little.
   - **The hymn.** Then "The Spirit of God" (ASSEMBLY), sung by the full
     ward in four parts with the **full organ**. The ward sings on the
     vowels of Phelps's 1836 words. The chorus's second line is sung on
     the shout's own syllables ("Ho-san-na, ho-san-na to God and the
     Lamb"), and the last line on the amens. It broadens at the end.

**What is small, or not there yet:**
- None of this is in the meeting. It is heard only in the lab until the
  integrator wires it.
- The words are sounds, not English. The gift is meant to be that. The
  ASSEMBLY words are vowel colours with the soft consonants: you will not
  follow the text.
- **The cost is real** (see *What it costs*). The Hosanna, with forty
  voices and the full organ, costs about 1.3 times what the ward's own
  hymn costs. Nothing was cut to lower it, per your ruling.

### How to hear it

```
php -S 127.0.0.1:8173 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3c-voices
```

Then open **http://127.0.0.1:8173/art/kolob/guests3c-lab.php**. The
controls at the top choose the seed (which ward, which hymn and every
guest's dice), the Sunday, the hymn's dialect (also the house the gift
sings in), the mode, the keynote and the room. A link can carry them:
`guests3c-lab.php?seed=6&sunday=conference&dialect=tabernacle`.

Times below are from pressing ▶ (m:ss).

#### The gift of tongues: press ▶ the gift

| link | who sings, in what | listen for |
|---|---|---|
| `?seed=7&sunday=fast&dialect=tabernacle` | Erastus Farr, a bass, ionian, the Tabernacle house | Five phrases, 71 notes of melisma, the song's height at **0:14**. The first word (*l-eh l-oh l-oh*) opens the song and comes back at 0:14 and 0:31. The ward hums at **0:39**: the basses on his do with him, then a full triad (do–mi–sol) over it. The harmonium takes up the opening at **0:41**. Over by 0:48 |
| `?seed=12&sunday=fast&dialect=oldway` | Erastus Pack, a tenor, mixolydian, the Old Way house | A plainer, surer song ending on **sol**. The ward's answer is **bare fifths** (do–sol–do, no third) at 0:29; the harmonium at 0:32 |
| `?seed=3&sunday=ordinary&dialect=sacredharp` | Gideon Leavitt, a tenor, aeolian (minor), the Sacred Harp house | The most ornamented: six phrases, 62 melisma notes, the height at 0:22; bare fifths at 0:42 |
| `?seed=21&sunday=dedication&dialect=shaker` | Alma Heap, a tenor, hexatonic, the Shaker house | A **vision song**: plain, steady, few runs. The ward hums **do in octaves** under it at 0:42 |
| `?seed=40&sunday=fast&dialect=gospel` | Louisa Pack, an alto | A woman's voice, 86 melisma notes; ends on sol, the hum a triad around it (0:43) |

**Also try:** *▶ in a brush arbor (no harmonium)*, the same gift where the
rite's seating has no reed organ: the hum ends it.

#### The far ward: press ▶ the canon (our ward and the far ward)

Our ward is the Sunday's own thirty-two, singing through the Cast's own
cue sheet, with the organ where the dialect has one, exactly as the meeting
sings a hymn. *▶ the far ward alone* and *▶ our ward alone* are the two
halves.

| link | what | listen for |
|---|---|---|
| `?seed=17&sunday=conference&dialect=tabernacle` | EMIGRATION, four verses, Tabernacle with the organ | From verse 2 (ours at 0:35), the far ward comes in **a full line behind** at **0:41**, from the right, in **Sacred Harp** harmony (open fifths, the tune in the tenor), 11 cents flat and drifting up. Again at 1:08 and 1:36 |
| `?seed=6&sunday=conference&dialect=tabernacle` | FAR BOUNTIFUL | **Half a line** behind, from the far left, very distant, **20 cents sharp** and drifting sharper (+12): the most "other" tuning of these. It enters at 0:48 and 1:21 |
| `?seed=29&sunday=conference&dialect=tabernacle` | CUMORAH (long verses) | The far ward in **unison** (a Shaker way: everyone on the tune, the men an octave down), a full line late, from 1:27 |
| `?seed=12&sunday=fast&dialect=sacredharp` | MANTI SPRING, unaccompanied | Both wards Sacred Harp, all three verses, three-quarters of a line apart (0:11, 0:44, 1:16), 14 cents apart: two hollow squares across a valley |
| `?seed=13&sunday=conference&dialect=gospel` | DAWN | The farthest far ward (distance 0.97), half a line behind in the last verse (0:52) |

**Their harmony** and **their voices** menus force the far ward's setting
(ours, Sacred Harp, Tabernacle, unison) and the A/B of its voices:
twenty-four throats, as built since round 2, against eight pews of three.

#### The Hosanna: set the Sunday to Easter or a dedication, press ▶ the Hosanna

`?seed=7&sunday=dedication&dialect=tabernacle`

**Listen first for hiss or harshness in the shout, 0:02–0:20** (round 2,
the critic's). Above 4 kHz the shout is about 6 dB brighter than the
hymn that follows it. Measured, that brightness is the raised voice
itself, forty voices' upper harmonics (`SHOUT_EFFORT`), not breath: the
s and the h's are about a thousandth of the high band. **▶ the shout
alone** plays just this part. If it sounds like hiss, the levers are in
Round 2, item 6.

- **0:00** the ward rises.
- **0:02** the first Hosanna; **0:07** the second; **0:14** the third,
  each a little higher.
- **0:19** "Amen, Amen, and Amen".
- **0:24** the full organ gives out the hymn's last line.
- **0:34** "The Spirit of God": the ward and the full organ.
- **1:12** the chorus: "Ho-san-na, ho-san-na to God and the Lamb" on the
  shout's own syllables.
- About **1:54** the last chord, broadened.

On any other Sunday the card says it never comes (the lab still plays it,
as a dedication's).

---

## What shipped

| commit | what |
|---|---|
| `74ed603c` | `kolob-voices-vocal.js`, **additive**: a syllable spelled by its sounds (`"n-ah"`, `"l-oh-m"`, `"h-oh"`, `"eh-n"`); the voiced consonants n r y w d b g as fixed mouths of their own (no bursts, so no hiss and no clicks); h as a breathier onset through the vowel's mouth (the voice's own breath, not a new noise); closing m and n at a line's end; `spec.effort` (a raised, pressed voice); `opts.fric` (a line's share of its f and s). Every old syllable (ah … hum, fa sol la mi) is read exactly as before: the diff replaces eleven lines, each keeping the old values for the old syllables |
| `5801476d` | `kolob-guest-tongues.js` (the gift of tongues) |
| `e009d644` | `guests3c-lab.php`, `guests3c-lab.js`; the gift calibrated |
| `2145890d` | `kolob-guest-farward.js` (the far ward); the lab's canon |
| `06d06c7f` | `kolob-guest-hosanna.js` (the Hosanna) |
| `4bc1f7ec` | the guests **arm** their lines (below); the Hosanna's organ laid a bar at a time; the lab's odds, purity, a silent baseline, the far ward's valley A/B |
| `70482cb7` | every slice its own cue; the lab's ward pumped as the engine pumps it; the gift's pitch tracked |
| `cdc20e91` | the far ward made audibly far |
| `a9724540` | `GuestTongues.singerOf` (the singer found once the ward is seated) |
| `7b303cc0` | `hooks.arm === false` (an A/B) |
| (this) | this note |

### `KOLOB.GuestTongues` (`kolob-guest-tongues.js`)

- **Interface:** `plan(info, stream)` gives a seat or null; `decide` is
  the same, explained; `score(material, stream, t0)` is pure;
  `perform(ctx, dest, t, material, stream, hooks)` gives the end time.
  Also `gesture(score)`, `singerOf(seat, ward)`, `tongue(stream)`,
  `timeline(stream, house)`.
- **Stream:** `guest:tongues:<n>`, with forks `seat`, `shape`, `tongue`,
  `melody`, `words`, `figures`, `hum`, `ward` (a ward of its own when
  none is handed in) and `synth`.
- **The seat.** Only the testimony.
  - Its moment is 4–24 s into the testimony.
  - It is refused when the testimony was cut, or when a guest is in the
    testimony or in a section beside it (PLAN §8.13).
  - The odds, `ODDS.base` 0.07 × the Sunday's weight: fast ×3.8,
    dedication ×3.5, funeral ×1.2, easter ×0.9, conference ×0.5,
    jubilee ×0.6, pioneer and christmas ×0.5, wedding ×0.4; capped at 0.5.
  - The seat carries `part`, `pick` (the singer's die) and `seeds`. The
    song seeds the next hymn 30 % of the time, 45 % on a fast Sunday.
- **The song.** Everything below comes from the shape fork, so `plan()`
  knows the exact length before any pitch is chosen.
  - **Phrases:** 4–6 (a song over 58 s lets middle phrases go). Each has
    5–9 syllables in arches, rising to the height phrase, which reaches
    the top of the voice. Each phrase ends on an open tone (sol, re or
    mi); the last ends on do, sol or mi, held.
  - **Melismas:** 3–7 notes each, of five figures (a run, a turn, a
    shake, a leap and fall, an arabesque). They gather at the height and
    before the last note.
  - **The name:** the first two or three syllables return, on their first
    notes, at the head of the third phrase and the last.
  - **The house's style:** "old" (Sacred Harp, psalmody, the Old Way) is
    more ornamented; "shaker" is plain and steady.
- **The tongue.** Three to five of l, m, n, y, w, d, b, r, h, g (weighted:
  l, m and n most), "ah" and two to four more vowels. Eight words of two
  to four syllables are drawn, the first being the song's name.
  - A word is refused if it is an English word or a sacred word of the
    meeting (a list, spelled as the voice spells it: *amen*, *manna*,
    *hallelujah*, *Moroni*, *lala* …).
  - It is also refused if it is one syllable said over and over, or a
    name of the ward.
  - Every word is written in Deseret (`Cast.deseret`).
- **The voices:**
  - **the singer:** their own voice from the ward, surer than usual, on
    their own pitch;
  - **the hum:** every other one of the thirty-two, sharing the ward's
    throat, entering in moments and letting go one by one across the fade;
  - **the reed:** two sawtooth reeds through a still formant and a body,
    with the bellows breathing. Or `hooks.harmonium` lends the house's own.

### `KOLOB.GuestFarWard` (`kolob-guest-farward.js`)

- **Interface:** `plan`, `decide`, `prepare(material, stream)` (pure),
  `score(prepared, v, at, ourBeatS, tune, stream)` (pure; one far verse),
  `stage(ctx, dest, prepared, stream, hooks)` → `{verse, amen, close}`
  (the engine's way), `perform(…)` (the lab's way), `warm(ctx)`,
  `versesJoined(from, n)`, `lineOrder(hymn)`.
- **Stream:** `guest:farward:<n>`, with forks `seat`, `shape`,
  `material` (→ `setTune`, `pews`), `vowels` and `synth`.
- **The seat.**
  - It sits on one of the day's hymn rows (`info.hymnal`): never the
    doxology, a round, a lined Old Way hymn, the Primary's song or a
    statement of the refrain.
  - Nothing may be seated in that section or beside it.
  - The odds, `base` 0.1 × the Sunday's weight: conference ×1.9, fast
    ×1.7, dedication ×1.6, christmas ×1.3, easter ×1, ordinary ×1,
    jubilee ×0.9, funeral ×0.8, pioneer ×0.7, wedding ×0.6; capped at 0.5.
  - The seat carries `hymnId`, `sectionIndex`, `from` (`second` 55 %,
    `last` 25 %, `all` 20 %), `lagLines` (0.5, 0.75 or 1) and `far` (its
    harmony).
- **Its harmony**, by our dialect:
  - Tabernacle: the same 3, Sacred Harp 3, Shaker unison 1;
  - Sacred Harp: the same 3, Tabernacle 3, unison 1;
  - psalmody: the same 2, Sacred Harp 2, Tabernacle 2;
  - gospel: the same 3, Tabernacle 2, Sacred Harp 1;
  - Shaker: the same 3, Sacred Harp 1, Tabernacle 1.

  Another harmony is `KOLOB.Composer.setTune`: the tune kept, set again
  (0–5 ms). It keeps our line order: the fuge sung twice, the refrain.
- **The canon.**
  - Each joined verse begins `lagBeats` after ours (the lag in whole
    beats of our first line, never under 2).
  - It runs on the far chorister's own clock: tempo ×0.985–1.015,
    fermatas ×1.3–1.9, and a breath between lines.
  - It finds us again at every verse, and sings the A-men after its last
    verse when ours does (only in our own Tabernacle harmony).
- **Its tuning:** ±8–20 cents from ours, drifting −3 to +12 cents over
  what it sings.
- **Its voices** (round 2): twenty-four throats, each person their own
  voice, seated in eight pews of three, trimmed 0.9 dB to the pews'
  calibrated level. `voices: "desks"` is the A/B, eight pews each one
  shared mouth (`VoicesVocal.desk`), and the saving if one is wanted.
- **Its distance**, drawn 0.35–1:
  - the sound crosses in 0.12–0.42 s;
  - the air takes the highs above 2.1–1.2 kHz, steeply (two 12 dB
    stages);
  - most of what arrives is the valley's answer (its own dark, open tail
    of 3.4 s, with late echoes off the hills). The direct sound is 0.34 of
    it at the nearest, 0.14 at the farthest;
  - it comes from one side (±0.45–0.85).
- **Heard through** the tabernacle's wide send (a guest outside the
  windows).

### `KOLOB.GuestHosanna` (`kolob-guest-hosanna.js`)

- **Interface:** `plan`, `decide`, `score(material, stream, t0)` (pure),
  `perform(ctx, dest, t, material, stream, hooks)`, `words()`,
  `mayCome(info)`, `timeline(stream, sunday)`. Also `LOGGED` (false),
  `ENGRAVE_HYMN` (true, the staff's switch only), `YIELD` (false),
  `HYMN_CONSONANTS`, and the shout's air: `SHOUT_FRIC`, `SHOUT_H_SWELL`,
  `SHOUT_EFFORT` (round 2).
- **Stream:** `guest:hosanna:<n>`. Its `seat` fork's first die **is** the
  hook's die the meeting already throws (checked: equal), then `shape`,
  `crowd`, `ward` and `synth`.
- **The seat.** Only when the calendar's Sunday has `hosanna: true`
  (Easter, a dedication): a dedication at 0.95, Easter at 0.5. The dev
  force bypasses the die but **never the Sunday**. It sits at the close
  of the (last) doxology.
- **The shout.**
  - Each of the forty shouts on their own raised speaking pitch: trebles
    290–360 Hz, altos 255–315, tenors 175–225, basses 140–185, children
    340–430.
  - Each is 10–240 ms behind the one presiding, and each syllable a
    spoken contour: an onset pitch, then a glide to where it ends.
  - `effort` is 0.6–0.95, with no vibrato; the s said at 35 %.
  - Three shouts, each 0.6–1.2 semitones higher, with 1.1–1.6 s of the
    room between them; then the amens.
- **The hymn.**
  - ASSEMBLY from `KOLOB.Tunes` in the day's key; the four parts sung by
    the thirty-two, the Primary's children on the tune.
  - Full organ; the last line broadens by 18–32 %.
  - The words: `WORDS` (Phelps, verse 1 and the chorus). Each inner part
    takes the tune's syllable at its onset.
- **Unlogged** (corrected in round 2). `seat.logged` is false; every
  stage it tells is `logged: false`; it emits nothing of its own. The
  hymn's notes are offered to `hooks.onNote` with `guest: "hosanna"`,
  `hosanna: true`, **`logged: false` always**, and `engrave:
  ENGRAVE_HYMN`, the staff's own switch (PLAN §8.12). The shout offers
  none. (The first version sent `logged: true` while `ENGRAVE_HYMN`
  stood, which would have printed a minutes row.)

### Laid out ahead, and armed

- **Laid out ahead.** Every guest lays itself out a slice at a time
  through `hooks.defer(at, fn)`: a phrase, a handful of four or five
  voices, a bar of the organ. Each slice is handed a little before it
  sounds (2.5 s; the organ 1.2 s). With a clock, even a slice due at once
  is its own cue, so the cue that starts a guest costs only its score
  (the Hosanna's: 2 ms of main thread; it was 58 ms when its first shout
  was built inside it).
- **Armed.** With a clock, every line is also **armed**
  (`VoicesVocal`'s ARMING, the ward's own way). It is built ahead but
  joins the room only just before it sounds, and each of its mouths only
  around its own moments. A guest runs its own arm-tick:
  - one cue on the clock at a time, every 0.1 s over its span;
  - `VoicesVocal.arm(ctx, at + 0.8, at)`;
  - it is the same queue the ward's pump arms, so it is harmless beside
    it.

  This is what made the Hosanna real-time. Unarmed, forty voices
  pre-built 2.5 s ahead pinned the audio thread (p90 100 %, the audio
  clock falling to 0.2×). With no clock (an offline render), everything
  joins at once.

## How it was checked (all silent)

Muted headless Chrome over CDP on port 9493 (profile
`kolob-r3c-voices-chrome`), the lab on `php -S 127.0.0.1:8173`, and Node
for the pure parts.

| check | result |
|---|---|
| lab at 860 and 390 px | 0 console errors after pressing every play (and stop), check (the gift's), odds and purity, and every menu; no sideways scroll at either width |
| purity | each guest's plan and score (the far ward's prepare and verse) identical when run twice on the same stream; **0 `Math.random` calls** |
| the Hosanna only on Easter and a dedication | 2,000 meetings a Sunday: dedication 94.7 %, Easter 49.3 %, **every other Sunday 0 %, even forced**; the plan's first die equals the meeting's hook die |
| the Hosanna unlogged (re-checked in round 2) | 8 of 8 stages `logged: false`; the seat `logged: false`; nothing else emitted; the hymn's 415 notes all `logged: false` and `guest: "hosanna"` (the shout offers none). Through the page's own gates: **0** minutes rows, **0** notes today's staff takes |
| the odds (stand-in planner, 20,000 meetings) | the gift 6.8 % (fast 22.2, dedication 17.1, funeral 6.5, easter 4.9, ordinary 4.6, conference 3.3, pioneer 2.6, wedding 2.3, christmas 1.8); the far ward 9.8 % (conference 18.9, dedication 11.2, christmas 11.1, easter 9.4, fast 9.0, ordinary 8.7, funeral 7.2, pioneer 5.8, wedding 5.6); the Hosanna 4.0 % (dedication 91.7, Easter 50.9, else 0); at least one of the three in 19.7 % of meetings, two in 0.95 %; **0** seated in or beside another guest's section |
| the gift: levels, clicks (six seeds, one in each of the six houses) | the whole −1.7 to +0.7 LU against the organ reference (loudest 3 s); the song −1.8 to +0.3, the hum −2.5 to +0.6, the reed with the hum's tail −1.9 to −1.3; **0 clicks**, 0 clipped, peak −4.6 to −10.7 dBFS |
| the gift sung as written (the singer alone, dry, a YIN pitch track against the score; three seeds) | syllables on their written pitch in 100 % of frames; **every melisma note identified** (71/71, 62/62, 85/86: nearer its own pitch than either neighbour's, within 60 cents), median 1.5–3.9 cents off |
| the gift's words | 300 seeds: the gesture that may seed a hymn identical before and after the ward is seated (300/300); the singer one of the day's testimony-bearers in 157 of 300 (else one of the same part) |
| the far ward: the canon (seeds 7 and 12; **read from its score**, not the audio: see Round 2, item 9) | it begins 0.78 and 0.83 of our first line late (drawn 0.75: whole beats plus the valley's delay); verse after verse the same (0.83, 0.83, 0.83) |
| the far ward: tuning (**from its score**) | −11.5 → −3.8 cents (seed 7), +13.8 → +14.2 (seed 12) against ours |
| the far ward: distant | against the same pews with nothing between: the high band (2.5–8 kHz over 250 Hz–2.5 kHz) **−9.6 dB** (seed 7) and **−14.7 dB** (seed 12), centroid 587 → 488 Hz and 668 → 542 Hz |
| the far ward: level | **10.7 LU under** our ward with the organ (seed 7, loudest 3 s; 10.3 integrated); **7.3 LU under** our unaccompanied Sacred Harp ward (seed 12). 0 clicks either side |
| the Hosanna: levels, clicks (seed 7, a dedication) | the shout −1.7 LU against the organ reference; the organ's giving-out −0.6; the verse +1.2; the chorus +1.5; **0 clicks**, 0 clipped, peak −5.7 dBFS |
| our ward in the lab (the yardstick) | +0.6 LU against the organ reference (the Cast's own sheet and organ at the engine's `WARD_LEVEL`): the ward level with the organ, as r3b-ward-1 found it in the meeting |

## The integration recipe (exact)

### 1. Loading (`_engine.php`)

Load the three guests beside `kolob-guest-handbells.js` and
`kolob-guest-singingschool.js`, among the performers, after `kolob-cast.js`:

```
kolob-guest-tongues.js   kolob-guest-farward.js   kolob-guest-hosanna.js
```

- **What they need, read late** (so the order among the performers does
  not matter):
  - `KOLOB.Pitch`;
  - `KOLOB.VoicesVocal` (with this branch's additions);
  - `KOLOB.VoicesOrgan` (the pipe organ);
  - `KOLOB.Composer` (`setTune`, `spelledMonzo`);
  - `KOLOB.Tunes` (ASSEMBLY);
  - `KOLOB.Calendar` (the Hosanna's hook);
  - `KOLOB.Cast` (optional: `deseret`, and a ward of its own for a lab).
- **The roll call.** Each file answers it:
  `_rooms["kolob-guest-tongues.js"]` and the others.
- **The voices** must be this branch's `kolob-voices-vocal.js`. It is
  additive: the ward sounds exactly as before.

### 2. Planning (`planMeeting`), after the handbells, in this order

- **The order.** The gift first, then the far ward (it must see the
  gift's seat), then the Hosanna. Push each seat into `C.visitations`
  before planning the next, except the Hosanna, which is never pushed
  (below).
- **The rites' seatings.** All three are planned before the rites'
  seatings (the testimony holding the gift is then never left empty).

```js
// THE GIFT OF TONGUES (PLAN §8.6): the testimony
var TGg = KOLOB.GuestTongues;
if (TGg) {
  var tgStream = stream("guest:tongues");
  var tgSeat = TGg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, house: C.house, sections: plan,
                          guests: C.visitations, ward: C.ward || null, force: forcedType === "tongues" }, tgStream);
  if (tgSeat) {
    C.visitations.push({ type: "tongues", section: "testimony", at: tgSeat.at, dur: tgSeat.dur, fired: false, cued: true,
                         stream: tgStream, seat: tgSeat });
    // THE SEED (a request to the integrator and HYMN): when tgSeat.seeds, the
    // next singing row after the testimony may take the song's opening as its
    // first line's material — computed now (pure; the ward need not be seated):
    //   var g = TGg.gesture(TGg.score({ mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, house: C.house, part: tgSeat.part }, tgStream, 0));
    //   → that row's order `gestures: g` when the orders are posted (HY.prepare, line ≈584)
    // — only if that row is a hymn, or a doxology with no payoff (see Requests).
  }
}
// THE FAR WARD (PLAN §8.8): a hymn, joined verse by verse
var FWg = KOLOB.GuestFarWard;
if (FWg && C.hymnal) {
  var fwStream = stream("guest:farward");
  var fwSeat = FWg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, hymnal: C.hymnal,
                          guests: C.visitations, force: forcedType === "farward" }, fwStream);
  if (fwSeat) C.visitations.push({ type: "farward", section: fwSeat.section, index: fwSeat.sectionIndex, hymnId: fwSeat.hymnId,
                                   fired: false, stream: fwStream, seat: fwSeat, ofHymn: true });
}
// THE HOSANNA (PLAN §8.12): replaces the hook — its plan's first die IS the hook's die
var HOg = KOLOB.GuestHosanna, hoStream = stream("guest:hosanna");
var hoSeat = HOg ? HOg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations, force: forcedType === "hosanna" }, hoStream)   // (round 2: guests → seat.beside; it overrides §8.13 unless GuestHosanna.YIELD)
                 : (hoStream.fork("seat").next(), null);
C.hosanna = SUN && SUN.hosanna ? { possible: true, built: !!HOg, seat: hoSeat, stream: hoStream } : null;
// (never pushed into C.visitations: "guests-drawn" and the minutes must not name it)
```

- **`FORCEABLE`.** Add `tongues`, `farward` and `hosanna`. The Hosanna's
  force still obeys the Sunday; the plan refuses it on any other day.
- **The gift's singer.** Once `C.ward` is seated (line ≈608):
  `V.singer = KOLOB.GuestTongues.singerOf(V.seat, C.ward)`. This is one
  of the day's testimony-bearers of the seat's part, else another of that
  part.
  - **Better, if it can be done:** seat the ward before the guests and
    pass `ward` to `plan()`. Then the singer is always a testimony-bearer.
    Either way the song is the same.

### 3. Performance

**The gift of tongues:** a standing guest, like the handbells.

- **Cue.** It keeps its own time (`CUED.tongues = true`), cued at the
  testimony's start plus `seat.at`, and `VISIT_FN.tongues` sends it
  through the glue the handbells use:

  ```js
  tongues: function (V, tc) {
    if (!V.material) V.material = { mode: S.mode, keynoteHz: S.F0 * S.ROOT_MULT, house: C.house, ward: C.ward,
                                    singer: V.singer || KOLOB.GuestTongues.singerOf(V.seat, C.ward),
                                    harmonium: S.Meeting.sits && S.Meeting.sits("harmonium") ? false : undefined };
    return standingGuest(V, tc, KOLOB.GuestTongues, "tongues", "choir", function (x) {
      emitNote(x.layer, x.freq, x.t, x.dur, guestNote(V, "tongues", { part: x.part, member: x.member, role: x.role, deg: x.deg, monzo: x.monzo, wordDs: x.wordDs, slur: x.slur }));
    });
  }
  ```

- **Where it goes.** Into `S.seatedSend("choir")`, the choir's layer,
  where the singing school's calibration also stands.
- **The reed.** Its own reed is used. `hooks.harmonium` can lend the
  house's (`S.renderHarmonium`), but that has its own gain law and was
  not calibrated here.
- **The section.** Held until `seat.at + seat.dur + 3`.
  `LISTENED.tongues = true`: the house's own voices rest while one person
  sings.
- **The stages and their minutes rows** (`GuestTongues.ROWS`, round 2):
  - `rises` → a ✦ row, "rises and sings in tongues", with the singer's
    name (a CAST request below);
  - `the ward hums` and `the harmonium` → quiet guest rows;
  - `sings` and `the height` → no row, and no `guest` event either.
- **The glue needs two changes (round 2, the critic's).** Today
  `standingGuest`'s `onStage` calls `say()` for every stage of any guest
  that is not the handbells, and `say()` labels every such guest "♪ the
  singing school". In `kolob-guests.js`:

  ```js
  // in say(): the guest's own label
  label: (G.ROW_LABEL || (name === "handbells" ? "♫ the handbells" : "♪ the singing school")) + (stage === "ring" || stage === "fork" ? "" : " · " + stage),
  // in onStage: a guest that names its rows tells only those
  if (name === "handbells") { … as now … }
  else if (G.ROWS) { if (G.ROWS[st.stage]) say(st.stage, st); }
  else say(st.stage, st);
  ```

  and in `kolob-ui.js` `GUEST_ROWS` (the minutes print only the stages it
  names), with three new `S` strings (their Deseret from CAST):

  ```js
  tongues: { rises: ["✦", "risesInTongues"], "the ward hums": ["✦", "wardHums"], "the harmonium": ["✦", "harmoniumAnswers"] },
  ```

  Each stage carries `t0` (when it sounds) and `label`, as the handbells'
  do.
- **Timing.** `standingGuest`'s `defer` is exactly what the gift wants.
  Its arm-tick rides the same lane (`cueAt("guests", …)`), gated by
  `C_live(V)`.

**The far ward:** hooked to the ward's hymn (`kolob-voices-choir.js`,
`singHymnWard`), not cued by the poll.

- **At the button press:** `KOLOB.GuestFarWard.warm(S.ctx)` pours the
  valley's air once (as `VoicesBand.warm`), not in a cue.
- **When the hymn `V.hymnId` is planned** (its verse count known):
  ```js
  V.prepared = KOLOB.GuestFarWard.prepare({ hymn: h, keynoteHz: S.F0 * S.ROOT_MULT }, V.stream);   // pure, 0–5 ms
  V.stage = KOLOB.GuestFarWard.stage(S.ctx, S.wideSend(), V.prepared, V.stream, {
    defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
    onNote: function (n) { emitNote("farward", n.freq, n.t, n.dur, guestNote(V, "farward", { part: n.part, deg: n.deg, cents: n.cents, verse: n.verse, line: n.line })); },
  });
  V.joined = KOLOB.GuestFarWard.versesJoined(V.seat.from, plan.verses.length);
  ```
- **At each verse `v` the ward's desk takes** (the sheet written PREP_S
  before, its start `t0` on the audio clock):
  - if `V.joined` holds `v`, call
    `var r = V.stage.verse(v, t0, sheet.beatS, V.joined.length);`
  - on the first such verse, `guestSpan("farward", r.t0, …)`
    (logged: true; one minutes row, "the far ward, a line behind, from
    across the valley").
- **At the A-men's sheet**, when the ward sings one:
  `V.stage.amen(amenT0, beatS)`.
- **When the hymn is done:** `V.stage.close(hymnEnd)`.
- **Holding the hymn.** Its section is held until the far ward's last
  verse has ended (`r.t1 + 2`): up to a line after ours, and the valley's
  tail.
- **Voices.** Twenty-four throats (round 2; in eight pews), on the wide
  send.
- **Nothing else.** The house already listens during a hymn, so there is
  no `LISTENED` entry. It never plays with the organ; it is another
  ward, unaccompanied.

**The Hosanna:** at the close of the last doxology, after its hymn (A-men
or tag) and after any band crossing it.

```js
// (round 2) the last doxology is the seat's own: plan() found it in the plan
// it was given (`sections: plan`, which is C.plan, final before any guest
// is planned — planMeeting's order of service is settled by line ≈288, the
// hook at ≈554), and C.si is the section the meeting is in (enterSection)
var isLastDoxology = C.hosanna && C.hosanna.seat && C.si === C.hosanna.seat.sectionIndex;
if (C.hosanna && C.hosanna.seat && C.section === "doxology" && isLastDoxology) {
  var V = { type: "hosanna", logged: false, stream: C.hosanna.stream, fired: true };
  S.houseLetsGo(t, "hosanna", false);
  var end = KOLOB.GuestHosanna.perform(S.ctx, S.seatedSend("choir"), t,
    { keynoteHz: S.F0 * S.ROOT_MULT, ward: C.ward, sunday: sunday }, V.stream, {
      defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing) fn(); }); },
      organDest: S.seatedSend("organ"),
      onStage: function () { /* nothing is told */ },
      onNote: function (n) { emitNote(n.layer, n.freq, n.t, n.dur, guestNote(V, "hosanna", { part: n.part, hymnId: n.hymnId, line: n.line, beat: n.beat, deg: n.deg, monzo: n.monzo, hosanna: true, engrave: n.engrave })); },   // (guestNote: guest "hosanna", logged: false, as V.logged is false)
    });
  guestSpan("hosanna", t, end - t, false);        // guest-start / guest-end, logged: false (UNLOGGED.hosanna)
  C.visitType = "hosanna"; C.visitLogged = false; C.visitUntil = end;
  C.sectionDur = Math.max(C.sectionDur, end - sectionStart + 3);
}
```

- **The rest of the house.** `LISTENED.hosanna = true`. The drone stays
  (home, the doxology's own key); nothing else of the house plays.
- **Nothing on the board or in the minutes.**
  - No `hymn-announced` and no `verse-start`: the Hosanna sings ASSEMBLY
    itself, not through `singHymn`.
  - No `guests-drawn`: it is not in `C.visitations`.
  - No ✦ row.
- **No phrase row either (round 2; the first version got this wrong).**
  Every note the Hosanna offers says `logged: false` and `guest:
  "hosanna"`. `kolob-ui.js` `onNoteForLog` passes over `logged: false`, so
  the first hymn note after the shout's twenty silent seconds does not
  queue a "♮ choir speaks" row.
- **The staff.** PLAN §8.12 asks for the hymn to be engraved, the shout
  not. Each hymn note carries `engrave: GuestHosanna.ENGRAVE_HYMN` (true),
  but today's staff (`kolob-viz.js` `onNote`) passes over every
  `logged: false` note. **Until ENGRAVE teaches it to read `engrave`
  (Requests), the Hosanna is wholly audio-only: nothing in the minutes,
  nothing on the staff.** `ENGRAVE_HYMN = false` keeps it so afterwards.
- **The band in the doxology.** The Hosanna overrides PLAN §8.13 (see
  Round 2, item 8). A band seated in the doxology crosses first; the
  Hosanna follows at the close. **Recommended:** when `C.hosanna.seat` is
  set, move the band out, as the cumulative assembly does
  (`bandsLeaveTheDoxology()`, and reset `C.payoff` if it was `"bands"`).
  Plan the Hosanna before the payoff is settled to do so.

### 4. SCORE, to adopt

- **Streams:**
  - `guest:tongues:<n>`: forks `seat`, `shape`, `tongue`, `melody`,
    `words`, `figures`, `hum`, `ward`, `synth`;
  - `guest:farward:<n>`: `seat`, `shape`, `material` (→ `setTune`,
    `pews`), `vowels`, `synth`;
  - `guest:hosanna:<n>`: `seat` (its first die the hook's), `shape`,
    `crowd`, `ward`, `synth`.
- **Layers:**
  - `farward`: new. Its notes carry `part`, `deg`, `cents`, `verse`,
    `line`, `guest`.
  - The gift's notes go on `choir` (role `tongues`, `hum`) and
    `harmonium` (role `tongues-reed`). The song's note carries the
    Deseret word, `wordDs`, on each word's first syllable.
  - The Hosanna's hymn goes on `choir` with `guest: "hosanna"`,
    `hosanna: true`, `logged: false` and `engrave` (round 2). SCORE §6
    today says a `logged: false` note is neither printed nor engraved;
    adopt `engrave: true` as the one exception, for the staff alone,
    when ENGRAVE lands it.
- **`guest` stages:**
  - tongues: `rises`, `sings`, `the height`, `the ward hums`,
    `the harmonium`;
  - farward: `verse`;
  - hosanna (all logged: false): `the ward rises`, `the first Hosanna`,
    `the second`, `the third`, `amen, amen, and amen`,
    `the organ gives out the hymn`, `The Spirit of God`, `the chorus`.
- **`VoicesVocal`** (this branch, additive):
  - a note's `vowel` may be a syllable spelled by its sounds;
  - `spec.effort`, `opts.fric`, `opts.hSwell` (round 2);
  - `VoicesVocal.syllable(name)`, `VoicesVocal.CONSONANTS`.

## What it costs (measured, not cut)

Each guest was played live in the lab, muted, on this M3 Pro, and read
three ways at once, as the round-3b crews did:

- Chrome's trace of the audio thread's render callbacks, summed per
  second;
- Chrome's `renderCapacity` for the page's context;
- the nodes, from the WebAudio domain and the voices' own ledger.

The tracer is `trace3c.js` in this crew's scratchpad.

**The machine is shared with other crews, and it swings.** The same idle
lab's callbacks ran at a 49–82 µs median at different moments, and the
ward's own hymn at a 21.9 % or 31.5 % median an hour apart. So every
guest is read **beside a yardstick measured in the same run**: the
Sunday's ward singing a Tabernacle hymn with the organ, exactly as the
meeting sings it (the Cast's sheet, pumped 12 lines a call, armed 0.6 s
ahead).

**One run, back to back** (seed 7; load average 2.8–3.7):

| | the audio thread's share of each second: median · p90 · worst 5 s · worst second | one render callback (5.33 ms of audio): median · p99 · max | nodes: the context's peak · the voices' ledger peak · mouths joined, max | main thread: the cue · the largest slice |
|---|---|---|---|---|
| nothing (the lab's rooms) | 1.1 · 1.6 · 3.7 · 12.5 % | 0.06 · 1.05 · 1.55 ms | 25 · 0 · 0 | — |
| **the yardstick**: the ward's Tabernacle hymn, organ (95 s) | **31.5 · 35.3 · 34.5 · 38.2 %** | 1.51 · 3.99 · 5.46 ms | 4,836 · 1,302 · 99 | 1.5 · 31.6 ms (the ward's own pump) |
| **the canon**: the same hymn, the far ward in its last verse (100 s) | 33.3 · 46.9 · 47.1 · 49.5 % | 1.74 · 3.38 · 4.82 ms | 4,848 · 1,402 · 109 | 18.4 · 28.1 ms |
| **the Hosanna**: the shout, then ASSEMBLY, forty voices and the full organ (118 s) | **40.5 · 45.8 · 45.7 · 50.9 %** | 1.99 · 3.63 · 5.21 ms | 7,714 · 4,174 · 219 | **2.4** · 14.4 ms |
| **the gift of tongues** (52 s) | 6.8 · 14.9 · 15.3 · 16.6 % | 0.43 · 1.16 · 2.25 ms | 376 · 286 · 32 | 1.8 · 10.1 ms |

- **The audio clock kept time in every run.** The mean ratio of audio to
  wall time was 1.001. The few readings under 1 (0.74–0.95, at the
  shouts' entries) were each answered by the next reading over 1: the
  sampler read late while the main thread built a slice, and the audio
  did not stall.
- **The Hosanna** costs about **1.3×** the ward's own hymn. It was
  measured twice, in two machine states: 27.7 / 38.3 / 46.0 % against
  the yardstick's 21.9 / 28.4 / 33.8 (1.26× at the median), and
  40.5 / 45.8 / 50.9 against 31.5 / 35.3 / 38.2 (1.29×). It is forty
  singers where the ward is thirty-two, and the full organ.
  - **By phase** (the earlier run): the shout 25 % median; the organ's
    giving-out alone 10.5 % (26.6 % before its pieces were laid a bar at
    a time); the verse 31 %; the chorus 26 %.
  - **The longest callbacks** were 5.2–6.1 ms across runs, against a
    5.33 ms budget: at the busiest moments, on a loaded machine, a
    callback can run a little over. Nothing measured shows a dropout,
    but the ear should listen at 0:02 and 0:35.
  - **Unarmed**, it pinned the audio thread (p90 100 %, the clock at 0.2×
    for half a minute). Arming is what makes it play.
  - **The words' consonants cost nothing measurable** once armed: vowels
    only (`HYMN_CONSONANTS = "none"`) measured 28.3 / 37.2 % against
    27.7 / 38.3 % with every consonant. They only enlarge the ledger of
    nodes built (2,242 against 4,226), not the audio thread's work.
- **The far ward** adds about **10 points** of the audio thread while it
  sings (p90 46.9 % against 35.3 %; measured with eight pews, the first
  version's default). As offline ledgers: 374–504 voice nodes at its peak
  (69–238 on average).
  - `prepare()` (with `setTune`) takes 0–5 ms, off the audio path.
  - **Twenty-four throats against eight pews, traced live by the
    critic** (round 2; the table there). The throats cost no measurable
    share of the audio thread, only nodes. They are the default now.
- **The gift** is a single voice, a hum and a reed: 7–15 % median,
  depending on the machine's moment (the same gift read 21.5 % armed and
  21.9 % unarmed in a slower hour). About 290 voice nodes at the hum's
  peak.
- **The main thread.** The cue that starts a guest costs 1.8–2.4 ms (its
  score). Each slice after that is under 15 ms. The lab's ward pump, the
  meeting's own, reaches 28–32 ms.
- **The scores are pure and cheap:** under 1 ms each in Node (the
  Hosanna 0.9, the gift 0.7, the far ward's prepare and a verse 2.1).

**Where to save, if the owner wants to** (nothing here was done):

- the Hosanna without the Primary's children (32 voices, not 40: about
  −20 %);
- the far ward in fewer pews;
- the Hosanna's organ on "hymn principal" instead of the full organ;
- `HYMN_CONSONANTS` saves memory, not audio work.

## Requests

1. **Integrator (round 3c).** The recipe above: loading, planning, the
   three performances, SCORE §4's additions.
   - **VERSION.** Nothing here is heard in the app until you wire it. The
     voices' additions change no sound the app makes today (every old
     syllable reads as before). So no branch-local VERSION line.
   - **After wiring:** re-measure the odds against the real planner.
     These came from a stand-in whose hymn dialects are not leaned by the
     Sunday, so a fast Sunday's far ward is probably under-counted. Then
     trace a dedication whole: the Hosanna closes the meeting's heaviest
     section.
2. **Integrator and HYMN crew: the gift's seed.**
   - When `seat.seeds` is set, `GuestTongues.gesture(score)` gives
     `[[deg, …]]`: the song's first five to eight syllable notes, in the
     Score's degrees from the mode's final, in the song's own octave.
     That is the shape `compose(opts.gestures)` takes for a hymn's first
     line.
   - The next singing section after the testimony is nearly always **the
     doxology**, which carries the day's theme and the Kolob reckoning. So
     the rule needs a ruling.
   - **My suggestion:** seed a *hymn* row whenever one follows the
     testimony. Seed the doxology only when it has no payoff (no
     assembly, partner or refrain), and then as the reckoning's first
     candidate, the day's theme its fallback. The owner would hear the
     song received in tongues come back as the last hymn of the meeting.
   - HYMN: please check in hymn-lab that a five-to-eight-note melismatic
     skeleton seeds line one as intended.
3. **CAST crew.**
   - **Deseret rows** (`ACTION_DS`) for three actions: *rises and sings
     in tongues* (a ✦ row), *the ward hums the song's last note* and
     *the harmonium takes up the song*.
   - **The ward's seating before the guests.** If it is possible, seat
     the ward before `planMeeting` plans the guests; the gift's singer
     would then always be a testimony-bearer (today 52 %).
   - **The testimony-bearers** are still "seated, not heard" (r3b-form-1
     request 5). The gift gives one of them a voice, on one testimony in
     fourteen; the others still wait for theirs.
4. **ENGRAVE crew.**
   - **The far ward** has a new layer, `farward`. Its notes carry the
     verse, line and cents; perhaps a faint second staff, or nothing.
   - **The gift's notes** are on `choir` (role `tongues`), with the
     Deseret word on each word's first syllable (`wordDs`): the staff
     could underlay the song's own words.
   - **The Hosanna's hymn (round 2, corrected).** Its notes say
     `logged: false` always, with `guest: "hosanna"` and `engrave: true`
     (`ENGRAVE_HYMN`). PLAN §8.12 asks for the hymn to be engraved, but
     `kolob-viz.js` `onNote` (≈:637) passes over every `logged: false`
     note. **Request:** engrave a note marked `engrave: true` even when
     it is `logged: false`, and take nothing else from an unlogged guest.
     - The notes carry `hymnId: "earth:assembly"`, `line` (0–7) and
       `beat`, but no `verse`, and there is no `hymn-announced` or
       `verse-line` for them (none may be sent). `scoreRoute` would send
       them down the Score's path, find no Score, and print them as
       heard.
     - The shout sends no notes.
     - Until this lands, the Hosanna is wholly audio-only, the safe side
       of the ruling.
5. **The owner's rulings, when heard:**
   - whether the Hosanna's hymn is engraved (`ENGRAVE_HYMN`);
   - whether the Hosanna gives way to a guest beside its doxology
     (`YIELD`; round 2, item 8), and whether a band leaves the doxology
     for it;
   - how bright the shout is (`SHOUT_EFFORT`; round 2, item 6);
   - whether the Primary's children shout;
   - how often each guest comes (the `ODDS` tables);
   - how far the far ward stands (`distance` 0.35–1), and its level
     (`DESK_GAIN`);
   - the far ward's voices: twenty-four throats (as built since round 2)
     or eight pews (`voices: "desks"`).

## Known issues

- **Nobody has listened.** Every level is set by measurement against the
  organ reference, not by ear:
  - the gift: `SING_GAIN` 0.44, `HUM_GAIN` 0.046, `REED_GAIN` 0.07;
  - the far ward: `DESK_GAIN` 0.08, `trimDb`;
  - the Hosanna: `SHOUT_GAIN` 0.09, `WARD_GAIN` 0.064, `ORGAN_GAIN` 1.0.
- **The gift's language** is refused against a written list of English
  and sacred words and the ward's names. Two gaps:
  - `kolob-text.js`'s broadside lexicon is not exported, so it is not
    checked against;
  - a list cannot know every word. Reduplicated words (*m-ah.m-ah.l-ah*)
    are allowed; only a word of one syllable said over and over is
    refused.
- **The gift's voiced stops** (d, b, g) are a murmur and a dip, with no
  burst. They read as consonants in a phrase, not as crisp English stops.
  The same holds for the shout's "God" and "to".
- **The shout** is a crowd on vowels and soft consonants: "Ho-san-na" is
  in its rhythm and vowels more than its words (as the owner allowed).
  - Its s is said at 35 %, since a crowd's s is a hiss.
  - Its h is the voice's own breath, a moment stronger. It is subtle,
    and there is no extra noise.
- **ASSEMBLY's words** are this crew's reading of Phelps's first verse
  and chorus into the voices' sounds. Only the first verse and the chorus
  are sung.
- **The far ward's canon** re-finds us at each verse. Within a verse it
  keeps its own time: a chorister ±1.5 % and her own fermatas. On a long
  verse with many fermatas it can drift a beat or two from exactly the
  drawn lag.
  - It sings our line order: the fuge twice, the refrain.
  - It sings the A-men only in our own Tabernacle harmony.
- **The far ward's voices** (round 2) are twenty-four throats; pews are
  the A/B in the lab.
- **The longest render callbacks** of the Hosanna run up to 5.2–6.1 ms
  against 5.33 ms on this loaded machine. The audio clock kept time, and
  no dropout was measured, but it is the moment to listen for.
- **The Hosanna's organ** is its own pipe organ (full organ), built for
  the Hosanna, into the organ's layer. It is not the Sunday's organist.
- **`hooks.harmonium`** (the house's reed for the gift) is offered but
  uncalibrated. The gift's own reed is the measured one.

# r3c-hall-1: the Social Hall, and the testimony-bearers speak

*GUEST crew, round 3c (the hall). Branch `kolob-r3c-hall`. 2026-09-29.*

**What is new to hear:** two new pieces of music, each built as a module the
engine can seat, and a lab to hear them in. **Neither plays in a meeting
yet.** The round-3c integration step wires them in (the exact recipe is
below). Nothing was pushed or published, and VERSION is not bumped.

- **The Social Hall.** After the benediction the benches are pushed back.
  You hear the benches scrape, a fiddler tune two strings until the fifth is
  pure, and a caller chant "HON-our your PART-ners" on its vowels. Then comes
  a dance made from one of the meeting's own hymns (usually the doxology the
  ward has just sung): its first two lines become the A strain, its last two
  (or its refrain) the B strain, played AABB two or three times through. The
  dance is a reel (2/4), a jig (6/8) or a quadrille. Under it you hear feet
  on the boards and hands on the back-beat, and a call before each figure.
  The last phrase is played again, then the fiddle's final chord rings the
  tonic's harmonic seventh (4:7) before settling on its fifth, with a stamp,
  a shout and applause. It replaces the postlude. It is rare (about one
  meeting in sixteen), weighted to Pioneer Day, weddings and the jubilees,
  and never comes at a funeral or on a fast Sunday.
- **The testimony-bearers speak.** At the testimony, two or three of the
  Sunday's ward rise one at a time. Each speaks: a speech-melody on their own
  voice, on vowels and soft consonants, with no English. The parlor's
  harmonium or the deacon's clarinet then takes up what they said. The first
  sentence is played back, the next is doubled as it is spoken, and the last
  is made into a tune. This follows Steve Reich's *Different Trains*. Each
  speaker is distinct: the widow's sentences fall, the teenager lifts every
  ending and speaks quickly, the farmer says two short things, the old
  pioneer arches slowly. Each tune is handed back so the meeting's motif
  engine can quote it later.
- **Smaller things:**
  - the fiddle's rests are now truly silent: a note shorter than its own
    settling used to sound through the rest after it;
  - the ward's voice can now speak as well as sing;
  - the minutes can name the four new actions in Deseret.

**Nobody has listened to any of this yet.** Every check below is a
measurement made with the sound muted. The ear comes next.

---

## How to hear it

1. Serve the worktree:
   `php -S 127.0.0.1:8174 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3c-hall`
2. Open **http://127.0.0.1:8174/art/kolob/guests3d-lab.php**
3. Choose a **seed** and a **Sunday**. The lab composes the day's first hymn
   and its doxology in the dialects on the Social Hall's card, and seats the
   Sunday's ward (its testimony-bearers, its old bass, its enthusiast). Then:
   - **▶ dance** plays the Social Hall;
   - **▶ the testimony** plays the testimony-bearers.

   While a piece plays, the line under the buttons says what you are hearing
   ("now: the B strain again (second time through)").

A link can carry the settings, for example
`guests3d-lab.php?seed=9&sunday=wedding`. The keys are `seed`, `sunday`,
`mode`, `key`, `first` and `dox` (the two hymns' dialects), `on` (`auto`,
`first` or `doxology`: which hymn is danced), `piece` (`auto`, `reel`, `jig`
or `quadrille`), `times` (`auto`, `2` or `3`) and `room`. The room starts at
**as seated**: both of the app's rooms, blended where the engine will seat
each guest.

### The Social Hall: what to listen for

Each row is a link's settings (the first hymn and the doxology's dialects are
the lab's defaults, gospel and Tabernacle, unless the row says otherwise).
Times are from the press.

| settings | the dance | listen for |
|---|---|---|
| `seed=4&sunday=pioneer` | a **jig** (6/8, 105 a minute), twice through, on the doxology's hymn CUMORAH; the old bass fiddles, the enthusiast calls | 0:00 the benches; 0:04 the fiddler tunes (the upper string pulled up to a pure fifth: the beating slows and stops); 0:07 the caller's "honour your partners"; 0:09 the potatoes; 0:12 the A strain. Calls at 0:19, 0:29, 0:56 and 1:14 ("all the way home"). 1:25 the tag, 1:26 the final, 1:27 applause. |
| `seed=9&sunday=wedding` | a **reel** (2/4, 125 a minute), three times through, on the first hymn NAUVOO ROAD (gospel) | No tuning (this fiddler is ready). Ten calls. Seven **blue slides**, the first at 0:15: the tune's major third reached from the septimal minor third under it (7/6 → 5/4). |
| `seed=23&sunday=christmas&first=shaker&dox=psalmody` | a reel three times through on the doxology ZARAHEMLA SPRING (psalmody) | The longest (1:58). The clapping, and the A and B strains coming round a third time. |
| `seed=31&sunday=easter&first=oldway` | a **quadrille** (6/8, 104 a minute) on the doxology SABBATH | A statelier figure, and no tag: the final comes straight after the last B strain. |
| `seed=12&sunday=ordinary&first=sacredharp&dox=gospel` | a quadrille on the first hymn MANTI SPRING (Sacred Harp) | Ten blue slides. A Sacred Harp tune (the tenor's melody) as a dance. |

**The main question:** is it joyful, and is it recognisably a fiddle tune
made from the hymn? The card prints both strains as degrees, with the hymn's
own notes in red, so you can see which notes are the hymn's and which are
the fiddle's.

### The testimony: what to listen for

| settings | who rises | listen for |
|---|---|---|
| `seed=4&sunday=ordinary` | the young father (tenor, rising, clarinet); the old pioneer (tenor, old, arched, clarinet); the teenager (treble, quick, rising, harmonium) | Three people who talk differently. The father's sentences lift at the end, and the clarinet's echo lifts with them. The pioneer is slow and falls to rest, with a tremor in his voice. The teenager is quick. Each one's tune: 0:21, 0:52, 1:28. |
| `seed=11&sunday=fast&mode=dorian` | the farmer of few words (bass, old); the old pioneer; the young father (harmonium) | A fast Sunday's testimony, in dorian. The farmer says two short, falling things, and the clarinet makes a tune of the second at 0:14. |
| `seed=31&sunday=pioneer&mode=penta` | the young father (harmonium); the widow (alto, old, falling, harmonium); the returned missionary (bass, quick, arched, clarinet) | Pentatonic. The widow's falling sentences on the parlor organ; the missionary's four quick sentences. |
| `seed=23&sunday=funeral&mode=aeolian` | the young father; the teenager (tenor, quick) | A funeral's two, in aeolian. |

**The main question:** does the reed doubling the voice sound like the
words turning into music (humane), or like an effect? The card draws each
bearer's testimony: the speech's pitch as a thin line, the reed's notes as
thick marks on the day's just scale. You can see the echo follow the line,
the doubling lie on it, and the tune leave it.

### What the ear should judge (nobody has yet)

**The Social Hall:**
- **The fiddle's colour.** Its body EQ is unchanged from wave 1 and still
  needs the owner's ear.
- **The feet and the hands:** do they read as a floor and a room of people,
  or as a drum machine? The feet sit about 6 LU under the fiddle at their
  loudest.
- **The calls:** do they read as calls (their shapes, "SWING your PART-ner")
  with no words?
- **The benches:** do they read as wood dragged on boards? They are baked
  stick-slip, and could sound like a ratchet.

**The testimony:**
- **The speech:** is it natural? It is synthesized on vowels and m and l.
  It might sound sung, or like a "wah-wah".
- **The balance:** the reed sits a little under the voice. Should the
  doubling be louder, as it is in Reich?
- **The pace:** is the stillness between bearers (3.5–6.5 s, longer at a
  funeral) the right length?

---

## What shipped

| commit | what |
|---|---|
| `f96dae77` | The fiddle's rests are silent. A note may lift the drone string on its own (`droneV`). (`kolob-voices-folk.js`, the fiddle only.) |
| `f602e4e6` | The voice can speak: a note's `glide` walks a speech contour, plus spoken syllables on m and l. (`kolob-voices-vocal.js`, additive.) |
| `0ae6b43c` · `81881c32` | `kolob-guest-socialhall.js`: the seat, the tune, the score and perform. |
| `76e555ca` | `guests3d-lab.php` and `guests3d-lab.js`; the hall's levels. |
| `abf3d47b` · `aa708830` · `ec685b7e` | `kolob-testimony.js`: speech, the doubling, the tune, the score and perform; its levels; the lab's drawings. |
| `f27f2d6c` | `kolob-cast.js` (additive): the four new actions in the minutes. |
| `0ab9bbdc` · `b3ef29c7` · `b45d8cad` · `621f5a45` | The hall's odds as measured; its sounds baked lazily; the reed's scale around the drone; the answer's motif shape; the lab's clock. |
| (this) | this note |

### `KOLOB.GuestSocialHall` (`kolob-guest-socialhall.js`)

It has the guests' interface: `plan(meetingInfo, stream)` returns a seat or
null, and `perform(ctx, dest, t, material, stream, hooks)` returns the end
time. It also has `decide`, `prepare`, `tune`, `score`, `bake`, `bakeKind`,
`CALLS`, `FIGURES`, `PIECES`, `ODDS`, `NEVER`, `MIX` and `LEVEL`. Its stream
is `guest:socialhall:<n>`, with forks:
- `seat`: the odds and the moment;
- `shape`: the dance, the tempo, how many times through, which hymn, and
  the arrangement's leanings;
- `tune`: every beat's figure;
- `people`: the fiddler, the caller, the whoopers;
- `arrange`: each note's slide, double stop and drone;
- `calls`: which figures are called;
- `room`: where the benches and feet fall;
- `material`: a hymn composed when none is handed over;
- `synth`: sound-level detail, never reported.

Every plan is pure: no AudioContext, DOM, clock or `Math.random`, and every
die is drawn before any refusal.

**The seat.**
- Only in the postlude, 1.2–3.2 s in, after the benediction's amen has died
  away. `holdUntil` is `at + dur + 2`: the postlude lasts at least that long.
- The odds are `0.07 × the Sunday's weight`, capped at 0.6. The weights:
  Pioneer Day 7, a wedding 5.5, the jubilee kind and Christmas 2.4, Easter
  1.6, a dedication 1.2, ordinary 1, conference 0.5, fast 0, funeral 0.
- It is refused:
  - at a funeral or on a fast Sunday, even when forced (by `sunday` or by
    `kind`);
  - when the meeting has no postlude;
  - when a guest holds the postlude;
  - when a guest holds the section before it, usually the doxology
    (PLAN §8.13).
- **It replaces the postlude:** the house's voluntary and the postlude's
  seating give way to it (see the recipe).

**The dance, made from a hymn (`tune`).**
- **The strains.** A is the hymn's first two lines. B is its refrain (60 %
  of the time when it has one) or its last two lines. A hymn of three lines
  gives B its third line and its second; a hymn of two gives B its second
  line and its first.
- **Four bars a line.** Each hymn line becomes four bars, which is eight
  beats:
  - six beats for the line's notes;
  - the seventh for its last note, the cadence, on the fourth bar's
    downbeat;
  - the eighth for a pickup into whatever follows (the next line, the
    strain's own start on its repeat, the next strain, or the tag).
- **The hymn's notes are kept in order and roughly in place.** Each note is
  put where it fell in the hymn's own line. Where there are more notes than
  six beats hold, the fewest and closest-together pairs share a beat (a
  small dynamic program), and only past twelve do the weakest notes go.
  Measured over 150 hymns (six dialects, 25 seeds, each as a reel and a
  jig, 1,200 dance lines): 9,984 of 9,990 hymn notes kept. The six that
  went were in six gospel lines of more than twelve notes (the weakest,
  melisma).
- **Between the hymn's notes, the fiddle's figures.** Each figure uses the
  chord sounding at that beat, read from the hymn's own four parts; a
  unison tune gets the fiddler's guess of home or fifth. The reel's figures
  are the passing note, a step into the next note, a neighbour, the note
  again with a cut, or the chord's next tone. The jig's are the long–short
  lilt, a two-note run to a fourth, a turn, the neighbour and back, or an
  arpeggio. A held hymn note is figured with more motion, and never becomes
  four cuts running. No leap is wider than a fourth.
- **Exact pitches.** The hymn's own notes keep their exact monzos. Every
  added note takes the hymn's most-used spelling of its letter.
- **The bowing.** In a reel: the Nashville shuffle (the bar's first two
  eighths slurred, the back-beat dug in) and a slight lilt (the first eighth
  of a pair 3–10 % long). In a jig: long–short in one bow.

**The arrangement (`score`).**
- **The registers.**
  - The A strain's middle sits near 520 Hz.
  - The B strain goes up an octave, "the high part", when its lines lie
    under the A's (70 % of the time).
  - Everything is kept between G3 (the lowest string) and about 1100 Hz,
    the old-time fiddler's first position. A tune spanning more than two
    octaves can exceed that: seed 4's Sacred Harp tenor tune reaches
    1376 Hz.
- **The drone** is the tune's tonic, cross-tuned onto an open string at
  175–350 Hz. The bow leans on it under the long and strong notes and
  lifts off it through the runs (`droneV`). How much it leans is drawn
  separately for A and B.
- **Double stops.** On cadences, and on long notes at a drawn rate: the
  hymn's own chord tone a third to a sixth under the tune.
- **The seventh harmonic, all in the fiddle's part:**
  - the **blue slide** into the tune's major third from 7/6 below it;
  - the **dominant's harmonic seventh** as a double stop over sol at a half
    cadence (4:7);
  - the **final**: the drone's octave with 7/4, then with 3/2.

  Each such note is reported `septimal: true`. The hymn's own notes stay
  5-limit.
- **The order of the evening:**
  1. the benches (3–5 scrapes and nine footsteps, over about 4 s);
  2. the tuning, 80 % of the time (the upper of the two low strings pulled
     up 18–30 cents to a pure fifth in five steps, then the next pair);
  3. the caller's "honour";
  4. the potatoes (the home chord chopped, or the fiddler's foot four
     times);
  5. AABB, two or three times through (three more often on festive days);
  6. the tag (75 % of the time: the last line's third bar again);
  7. the final;
  8. applause (85 % of the time).
- **Calls** come before each strain's downbeat:
  - `callRate` is 55–90 % of the strains, and the last is always
    "all the way home";
  - no call follows itself;
  - there are eight figures, each written as its English stress-and-vowel
    shape (`CALLS`);
  - the caller chants on the tune's fifth, with a stressed syllable a step
    up, and the last syllable lifts or falls.
- **The floor and the hands.**
  - Every beat of the dance has feet: heavy on the bar, light on the
    back-beat. The last B's fourth bar is stamped, and so is the final.
  - Claps come on the back-beat. They begin in the B strains of the first
    or second time through (drawn), and come in every strain after that;
    the last time through, the A strains clap too.
  - Whoops (1–3) come as the last time through starts, as its B starts,
    and at the end. The caller shouts over the final.
- **The people**, from the Sunday's ward: the caller is the enthusiast if
  seated, else the surest man in the pews; the fiddler is the old bass if
  seated, else one of the ward; the whoopers are three of the young.

**The sound (`perform`).**
- **The fiddle** is `KOLOB.VoicesFolk`: one bowed phrase per line, with the
  drone and double-stop strings. It peaks at 37 nodes alive.
- **The voices** are `KOLOB.VoicesVocal` singers, one person each, the same
  throat for all their calls.
- **The floor, the hands and the benches** are buffers baked in plain JS,
  one kind at a time when first wanted, each on its own seed:
  - a footfall: a joist thump, a board knock and a scuff;
  - a beat's floor: 8–14 footfalls within a few hundredths;
  - a clap: noise ringing at 1.2–2.2 kHz;
  - the applause: twelve clappers;
  - a bench dragged: stick-slip at 40–80 catches a second.

  Each event costs two nodes, through five shared panners and two dark
  early reflections.
- **Slicing.** Each slice (1.5 s of events) is laid out 2.5 s ahead through
  `hooks.defer`, and its notes are told then.
- **`hooks.dests`** is `{fiddle, floor, caller}`: three ways into the room.

### `KOLOB.Testimony` (`kolob-testimony.js`)

It has the same interface: `plan`, `decide`, `prepare`, `score` and
`perform`. It also has `speech`, `transcribe`, `tuneOf`, `bake`, `REEDS`,
`MOVES`, `HARMONIUM_LEAN`, `ODDS`, `MIX` and `LEVEL`. Its stream is
`guest:testimony:<n>`, with forks:
- `seat`: the odds, the moment, how many rise (without a ward);
- `shape`: the order they rise in, each one's reed, how many sentences;
- `speech:<k>`: bearer k's sentences;
- `reed:<k>`: how the reed plays them;
- `synth`: the creaks and the reeds' breath, sound-level.

**The seat.**
- Wherever the meeting keeps its testimony. The odds are 0.82 × the
  Sunday's weight: fast 1.25 (so always), funeral 1.15, conference, wedding
  and dedication 0.9, Christmas 0.95, the rest 1.
- It is refused when a guest holds the testimony (the old tune remembered
  there), or when the ward keeps the silence (the odds' remainder). The
  house then plays the testimony as its seating says.
- It begins 3–7 s into the section, with `holdUntil` = `at + dur + 4`.

**The bearers** are the Sunday's `ward.roles.testimony`: two or three, and
three on a fast Sunday. Each has their cast voice and their archetype's
habits: rate, range, contour and pauses (`Cast.ROSTER.testimony`). They rise
in the cast's order, or (a third of Sundays) the last first. Without a
ward, two of no one in particular stand in.

**The speech (`speech`), one sentence as a person says it:**
- 5–16 syllables at the speaker's rate, in words of one to three syllables
  with one stress each, and a breath inside a long sentence.
- A few pitch accents a phrase: the first and last stresses always, the
  others two times in five. The other syllables sit near a line that
  drifts 1.2–2.8 semitones down across the sentence.
- Each speaker's shape: falling (the high point first), arched, or rising
  (every ending lifts, except the testimony's last sentence, which comes to
  rest).
- Each syllable carries on from where the one before left off. Accents
  rise out of it and fall off; phrase endings are lengthened.
- The speaking pitch is well under the singing voice: a man about
  100–130 Hz, a woman 180–220; age lowers a woman's and lifts a man's.
- The voice is the member's own. It loses its vibrato (an old voice keeps
  a tremor), is a little breathier, and is heard to breathe before each
  sentence.
- The syllables are vowels and m and l (`kolob-voices-vocal.js` SPOKEN),
  so no hiss.

**The doubling (`transcribe`), the speech's melody written down.**
- Each syllable's heard pitch (an accent's peak, elsewhere the middle of
  its glide) goes to the nearest tone of the day's just scale in the
  testimony's key.
- A sentence's last syllable, where it falls or lifts a third or more,
  becomes the two notes it moves between: the ending is the speaker's
  gesture.
- The notes are carried by whole octaves into the reed's register, one
  octave for the whole bearer, from the middle of everything they say. The
  harmonium's middle is 330 Hz, the clarinet's 440.
- A repeated tone is held, unless a stress strikes it again.
- Where the drone stands off the mode, the reed's scale takes the drone's
  own pitch for that letter (`material.droneMonzo`). The reckoning's cantus
  can do this: a note of a doxology keyed a fifth away.

**What the reed does with each sentence (`MOVES`):**
- *echo*: the sentence alone, then the reed plays it back in the speech's
  rhythm;
- *double*: the reed plays with the speaker, 40–70 ms behind the lips;
- *tune*: doubled, then the reed alone makes a tune of it (`tuneOf`):
  - the rhythm is drawn to a pulse (an eighth about one of the speaker's
    syllables, 0.2–0.36 s);
  - stressed notes are moved onto the beat;
  - it closes on do, mi or sol, whichever is nearest;
  - the last note is held to the bar's end and a beat more;
  - the clarinet adds its vibrato here only.

A bearer of two sentences has echo and tune; of three, echo, double and
tune; of four, echo, double, double and tune.

**The reed** takes each speaker up on the harmonium or the clarinet. The
harmonium is likelier for the widow, the pioneer, the sister and the farmer
(0.7–0.75), the clarinet for the young; never three on one reed running.

**The motif engine may answer.** Each tune is handed back as `score().answers`
and through `hooks.onAnswer`, at the moment it ends:
`{t, memberId, instrument, motif: {name: "testimony:<id>", gesture:
"testimony", gen: 0, chain: [], notes: [{deg, durBeats}], unit}}`. Degrees
are counted from the key handed in.

**The sound (`perform`).**
- **The speaker:** one `VoicesVocal` singer each.
- **The reeds:** built in the module, in the house's timbres. The harmonium
  is two detuned saws through the still reed formant, with bellows on a
  stage of their own before the envelope. (On the envelope, as in
  `kolob-voices-winds.js`, the reed would breathe on faintly through its
  release.) The clarinet is a triangle and a soft octave through a fixed
  lowpass.
- **Made to follow a voice:** a reed speaks in about 50 ms, a new syllable
  steps its pitch in 15 ms, and the air dips an instant. A line is one
  voice however many notes: 9 nodes on the harmonium, 5 on the clarinet
  (7 with its vibrato).
- **The pews:** a board's creak as the weight leaves it, and steps on the
  boards (baked).
- **Slicing:** slices laid out 2.5 s ahead through `hooks.defer`.
- **`hooks.dests`** is `{speaker, harmonium, clarinet}`. The pews go to
  `speaker`.

### The fiddle's rests (`kolob-voices-folk.js`, the wave-1 issue)

Wave 1's instruments round 2 had made a rest lift the bow. One case still
sounded through: a note shorter than its own settling (about 50 ms; a
reel's flick, a grace). Its settle was scheduled after the bow lifted, and
the rest played at the note's full level.

Now the lift cancels whatever the note still had coming. The string rings
down (a 20 ms time constant), and a rest long enough to hear ends in true
zero 150 ms in. The rosin noise does the same.

Measured offline, dry:

| case | before | now |
|---|---|---|
| a 40 ms note, then a rest | −0.8 dB re the note (it sounded) | −39.5 dB over the ring-down |
| any rest of 0.17 s or more, from 150 ms in | the ring-down's tail | below −140 dBFS |
| ordinary rests (plain, drone, double stop, reel eighths), from 60 ms in | −35 to −42 dB | the same |

**New:** `droneV` on a note (0 lifts the drone string alone, 0–1 leans on
it softer). The fiddle's other calls are unchanged.

### The voice can speak (`kolob-voices-vocal.js`, additive)

- **A note's `glide: [[u, r], …]`** makes it a spoken syllable. The pitch
  walks through f·r, reaching each point a fraction u through the note. It
  joins the syllable before in 60 ms, with no scoop or overshoot, and the
  next syllable begins where this one left off.
- **Spoken syllables** (`VoicesVocal.SPOKEN`): the vowels, and m or l before
  them (ma meh mi mo moo, la leh lee lo loo). No new filter is automated
  (the house rule): the syllables use the mouth's existing banks.
- **Checked:** a rendered spoken line tracked 130 → 185 Hz at the accent →
  112 Hz falling, exactly the contour written. Every sung line is
  untouched: the new code runs only for a note with a glide, and draws no
  dice otherwise.

### The cast (`kolob-cast.js`, additive)

`ACTION_DS` has four new actions in the minutes' Deseret capitals: *rises
to bear testimony*, *sits down*, *takes up the fiddle* and *calls the
dance*. The first, third and fourth are in `ACTION_FORWARD` (each gets a row
in the minutes). All four validate as `cast` events.

---

## The integration recipe (for the round-3c integration step)

### 1. Loading (`_engine.php`, and `$kolob_assets` for the footer's fingerprint)

- `kolob-guest-socialhall.js` beside `kolob-guest-handbells.js`, after the
  voices. At perform time it needs `KOLOB.VoicesFolk` (the fiddle) and
  `KOLOB.VoicesVocal` (the caller).
- `kolob-testimony.js` among the performers, after `kolob-cast.js` and
  before `kolob-meeting.js`. It needs `KOLOB.VoicesVocal`.
- Both answer the load guard's roll call (`KOLOB._rooms`). Both planners
  are pure and load headless (checked in Node).
- `kolob-voices-folk.js`, `kolob-voices-vocal.js` and `kolob-cast.js` are
  already loaded; their changes here are additive.

### 2. The Social Hall

**(a) The seat.** In `planMeeting`, after the handbell choir (so a bell
choir in the postlude refuses it, and the bands' final section is already
known) and before the Hosanna's hook and `CAL.scenes` (so the postlude's
seating sees a guest seated there):

```js
// THE SOCIAL HALL (round 3c; PLAN-COMPOSITION §8.9): after the benediction the
// benches are pushed back — a fiddle, a caller, a reel or a jig made of one of
// the day's hymns; it replaces the postlude. Rare, Pioneer Day's, a wedding's,
// a jubilee's; never at a funeral or on a fast Sunday; never beside a guest
// (kolob-guest-socialhall.js decides, on guest:socialhall:<n>).
var SHg = KOLOB.GuestSocialHall || null;
if (SHg) {
  var shStream = stream("guest:socialhall");
  var shSeat = SHg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                          force: forcedType === "socialhall" }, shStream);
  if (shSeat) {
    C.visitations.push({ type: "socialhall", section: "postlude", at: shSeat.at, dur: shSeat.dur, fired: false, cued: true,
                         stream: shStream, replaces: "postlude" });
    var last = plan[plan.length - 1];
    if (last.type === "postlude") last.dur = Math.max(last.dur, shSeat.holdUntil);
  }
}
```

- **Forcing.** Add `socialhall: true` to `FORCEABLE`. Do not add it to the
  Ives switch's own pick (`forcedPick`): it is not an Ives visitation.
- **Exclusions:** funerals and fast Sundays (absolute); a guest in the
  postlude; a guest in the section before it (PLAN §8.13).
- **What it replaces:** the postlude's own music, the organ voluntary and
  the postlude's seating.
- **The odds** by Sunday, measured over the lab's stand-in planner, are in
  "How it was checked".

**(b) The material, at the cue.** In `cuedArrival`, next to the handbells:
`if (V.type === "socialhall" && !V.material) standingMaterial(V);`. In
`standingMaterial`, for this guest:

```js
if (V.type === "socialhall") {
  var hymns = C.hymnal.map(function (r) { return { hymn: Hymnal() ? Hymnal().get(r.id) : null, section: r.section }; })
                      .filter(function (x) { return x.hymn && x.hymn.lines && x.hymn.lines.length; });
  V.material = KOLOB.GuestSocialHall.prepare({ hymns: hymns, keynoteHz: S.F0 * S.ROOT_MULT, ward: C.ward,
                                               sunday: C.meeting.sunday, kind: C.meeting.activity }, V.stream);
  V.dur = KOLOB.GuestSocialHall.score(V.material, V.stream, 0).end;   // the section held: V.at + V.dur + 2
}
```

- The hymns are the day's hymnal rows as written. The doxology (the last,
  or the row whose `section` is `"doxology"`) is the likeliest to be
  danced; the first hymn next; the others after. Warm, `prepare` costs
  0.1–0.2 ms (a cold first call about 12 ms).
- **Optional:** call `KOLOB.GuestSocialHall.bake(S.ctx)` in an idle moment
  during the doxology (about 45 ms once per context). The press then drops
  from about 12 ms to 2–4 ms. Without it, each kind is baked in the clock
  tick that first needs it (no tick over 13 ms).

**(c) The glue (`kolob-guests.js`, beside `handbellsRing`),** then
`VISIT_FN.socialhall = socialHall`:

```js
function socialHall(V, tc) {
  var G = KOLOB.GuestSocialHall;
  if (!G || !KOLOB.VoicesFolk || !KOLOB.VoicesVocal || !V.material) return 4;
  V.meetingNum = S.Meeting.meetingNum();
  var end = G.perform(S.ctx, S.seatedSend("fiddle"), tc, V.material, V.stream, {
    dests: { fiddle: S.seatedSend("fiddle"), floor: S.seatedSend("floor"), caller: S.seatedSend("choir-near") },
    defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C_live(V)) fn(); }); },
    onNote: function (x) {
      emitNote(x.layer, x.freq, x.t, x.dur, guestNote(V, "socialhall", { part: x.part, strain: x.strain, time: x.time, line: x.line, bar: x.bar,
        deg: x.deg, monzo: x.monzo, septimal: !!x.septimal, orn: x.orn || null, member: x.member || null, call: x.call || null, hymnId: V.material.hymnId }));
    },
    onStage: function (st) { /* as standingGuest's say(): a `guest` event {guest: "socialhall", stage, section, hymnId}, told at st.t0 */ },
    onCast: function (c) { cueAt("guests", c.t, function () { if (S.playing && C_live(V)) emitEvent({ type: "cast", memberId: c.memberId, nameDs: c.nameDs,
      action: c.action, actionDs: KOLOB.Cast.ACTION_DS[c.action], role: C.ward && C.ward.byId[c.memberId] ? C.ward.byId[c.memberId].role || null : null }); }); },
  });
  claimAir(end - tc, 3);
  return end - tc + 2;
}
```

- **The rooms.** Add `ROOM_DEPTH.fiddle = -0.2` and `ROOM_DEPTH.floor =
  -0.25` (`kolob-core.js`: the dance is in the room with us, a step nearer
  than the ward). The caller stands with the ward's near seat
  (`choir-near`). The lab's *as seated* measured these depths at the
  postlude's balance.
- **The house** lets go and listens (add `socialhall: true` to
  `LISTENED`). The organ, the harmonium, the strings and the clarinet wait.
- **The drone** should step back for the dance: the fiddle brings its own,
  on the dance's tonic. When the danced hymn is keyed away from home, the
  house drone would stand on its fourth or fifth. Duck it through
  `S.droneDuck` (as `stillness()` does) from the benches to the end, and
  let it return under the applause.
- **The minutes' rows:**
  - `guest` stages `benches` (✦ "the benches are pushed back"), `honour`,
    `A`, `B`, `final` and `applause`;
  - `cast` events for *takes up the fiddle* and *calls the dance* (both
    `ACTION_FORWARD`).

  The other stages (`tuning`, `potatoes`, `tag`) are the dev tools'.

### 3. The testimony-bearers

The bearers are the testimony's own content, not a visitation: keep them
out of `C.visitations`, so the pacing rule does not refuse guests in the
sections beside the testimony. Cue them the way a cued guest is cued.

**(a) The seat.** In `planMeeting`, after the ward is seated (`C.ward`),
because the bearers must be known, and after the visitations (so the old
tune in the testimony refuses them):

```js
// THE TESTIMONY-BEARERS SPEAK (round 3c; PLAN-COMPOSITION §5.2)
var TMg = KOLOB.Testimony || null;
C.testimony = null;
if (TMg && C.ward) {
  var tmStream = stream("guest:testimony");
  var tmSeat = TMg.plan({ n: C.meetingNum, kind: activity, sunday: sunday, sections: plan, guests: C.visitations,
                          bearers: (C.ward.roles.testimony || []).length || null, force: forcedType === "testimony" }, tmStream);
  if (tmSeat) {
    C.testimony = { seat: tmSeat, stream: tmStream, material: null, fired: false, until: 0 };
    plan.forEach(function (p) { if (p.type === "testimony") p.dur = Math.max(p.dur, tmSeat.holdUntil); });
  }
}
```

**(b) The cue and the material.** In `enterSection`, when the testimony
begins: `cueAt("guests", t + C.testimony.seat.at, testimonyBegins)`. Then:

```js
function testimonyBegins(tc) {
  var T = C.testimony;
  if (!T || T.fired || C.section !== "testimony" || !S.playing) return;
  T.fired = true;
  T.material = KOLOB.Testimony.prepare({ ward: C.ward, keynoteHz: S.F0 * S.ROOT_MULT, keyMonzo: [0, 0, 0, 0], mode: S.mode,
                                         sunday: C.meeting.sunday, silenceMul: silenceMul(),
                                         droneMonzo: S.droneNote ? S.droneNote().monzo : null }, T.stream);
  var end = KOLOB.Testimony.perform(S.ctx, S.seatedSend("speaker"), tc, T.material, T.stream, {
    dests: { speaker: S.seatedSend("speaker"), harmonium: S.seatedSend("reed"), clarinet: S.seatedSend("reed") },
    defer: function (at, fn) { cueAt("guests", at, function () { if (S.playing && C.testimony === T) fn(); }); },
    onNote: function (x) { emitNote(x.layer, x.freq, x.t, x.dur, { part: x.part, member: x.member, speech: !!x.speech, deg: x.deg, monzo: x.monzo, move: x.move || null, testimony: true }); },
    onStage: function (st) { /* a `testimony` event at st.t0: {stage, memberId, label} (request 3 below) */ },
    onCast: function (c) { /* as the Social Hall's: `cast` events, rises to bear testimony (a row) and sits down */ },
    onAnswer: function (a) { Motif.post(a.instrument, "clarinet", a.motif, "imitate", S.moment(), T.stream.fork("answer:" + a.memberId)); },
  });
  T.until = end;
}
```

- **The key.** Keep the testimony in the house's own key (the keynote,
  `keyMonzo` `[0,0,0,0]`, the day's mode). The motif engine's degrees are
  counted from there too, so an answer posts as it stands.
- **The drone.** `droneMonzo` is where the reckoning's drone stands in this
  rite. The reed's scale takes its pitch for that letter, and never rubs a
  second against it.
- **Answers.** `onAnswer` posts each tune to the ledger, from the reed that
  played it (`harmonium` or `clarinet`) to the clarinet or the choir. The
  deacon or the ward may then quote a speaker later in the meeting (PLAN
  §5.5). Its dice come from the testimony's own stream.
- **The house listens while they speak.** Add `|| testimonySounding()` to
  `hallListens()`:
  `function testimonySounding() { return !!C.testimony && C.testimony.fired && now() < C.testimony.until; }`.
  The deacon's own clarinet line in the testimony (`clarinetPhrase`), the
  harmonium and the strings wait. The drone and the field stay. The
  testimony's seating (lined out, the arbor, the choir alone) plays before
  the first rise and after the last sit. The Cage stillness
  (`testimonyDie`) may still fall; it ducks only the drone.
- **The rooms, and the level's convention.** Seat the testimony through
  guest seats of its own, not the house's layers. `seatedSend("voice")`,
  `"harmonium"` and `"clarinet"` would pour into those layers' sliders
  (0.35, 0.45, 0.38), 7–9 dB under what the lab measured. The guests'
  convention (the handbells) is a unity-gain seat at a depth of its own:
  `ROOM_DEPTH.speaker = -0.35` (the still small voice's nearness) and
  `ROOM_DEPTH.reed = -0.15` (where the harmonium sits). The lab measured
  the testimony at these depths, at the testimony's balance. The Social
  Hall's `fiddle`, `floor` and `choir-near` seats are unity already (no
  layer has those names).
- **The minutes:**
  - a `cast` row for each *rises to bear testimony* (the name in Deseret);
  - optionally the reed's moments (*the harmonium plays the words back*,
    *makes a tune of them*) from the `testimony` event's stages `echo` and
    `tune`.

---

## Requests

1. **To the integrator:** the recipe above: loading, the two seats, the
   material, the glue, `LISTENED`/`hallListens`, the seats' depths
   (`ROOM_DEPTH.fiddle` −0.2, `floor` −0.25, `speaker` −0.35, `reed`
   −0.15), the drone's duck under the dance, and `FORCEABLE.socialhall`
   (and `testimony` if you want a switch for it).
2. **SCORE.md, to adopt (§3 streams, §6 events, the layers):**
   - **Streams:**
     - `guest:socialhall:<n>`, with forks `seat`, `shape`, `tune`,
       `people`, `arrange`, `calls`, `room`, `material`, `synth`;
     - `guest:testimony:<n>`, with forks `seat`, `shape`, `speech:<k>`,
       `reed:<k>`, `synth`, and `answer:<memberId>` (the ledger's
       deadline, from the recipe).
   - **Layers:**
     - `fiddle`: the Social Hall's notes, with `part` (`tune`, `fig`,
       `pick`, `cad`, `stop` (a double stop's other string), `drone`,
       `final`), `strain`, `time`, `line`, `bar`, `deg`, `monzo` (relative
       to the danced hymn's key), `septimal`, `orn`, `hymnId`;
     - the calls on `choir`, with `part` `caller` | `whoop`, `member`,
       `call`;
     - the speakers on `voice`, with `speech: true`, `member`, `part`,
       `accent` (not for engraving as notes; a speech-melody could print as
       x-heads, which is ENGRAVE's call);
     - the reeds on `harmonium` / `clarinet`, with `part: "testimony"`,
       `member`, `move` (`echo`, `double`, `tune`), `deg`, `monzo`,
       `keyMonzo`.
   - **Events:**
     - `guest` with `guest: "socialhall"` and the stages `benches`,
       `tuning`, `honour`, `potatoes`, `A`, `B`, `tag`, `final`,
       `applause`;
     - a new typed event `testimony` `{stage: "rise" | "speaks" | "echo" |
       "double" | "tune" | "stillness" | "bearer", memberId, label}` (in
       `kolob-score.js` EVENTS: `{ stage: "str" }`);
     - `cast` with the four new actions (already in `ACTION_DS`).
3. **To CAST, FYI:** the testimony reads `ward.roles.testimony` and each
   member's `voice`, `habit` (`rate`, `range`, `contour`, `pauses`),
   `archetype` and `pew.x`. The Social Hall reads `roles.enthusiast`,
   `roles.oldbass` and the pews' `voice.age` and `confidence`. Nothing in
   `kolob-cast.js`'s seating changed.
4. **To ENGRAVE, FYI:** the Social Hall's strains could print as a fiddle
   tune (AABB, repeat signs), with the hymn's notes the same heads and the
   fiddle's figures smaller. The testimony's reed notes carry `deg` and
   `monzo`.

---

## How it was checked (all silent)

Checks ran in muted headless Chrome over CDP (port 9494, profile
`kolob-r3c-hall-chrome`) and in Node for the pure parts. Loudness is
BS.1770, measured by the lab's own **check**: "LU" is the loudest 3 s
against the v0.30 organ reference, rendered in the same room, as seated.

**The Social Hall, five Sundays** (the final levels: `LEVEL` 0.36; `MIX`
fiddle 1, floor 0.55, caller 0.42):

| seed · Sunday · hymns | the dance | length | integrated | loudest 3 s | peak | clipped | clicks | fiddle nodes (built / alive) | voices alive |
|---|---|---|---|---|---|---|---|---|---|
| 4 · Pioneer Day · gospel, Tabernacle | jig ×2 | 98.1 s | −22.3 LUFS | **−1.9 LU** | −6.8 dBFS | 0 | 0 | 277 / 37 | 30 |
| 9 · wedding · gospel, Tabernacle | reel ×3 | 114.1 s | −22.3 | **−1.0** | −6.9 | 0 | 0 | 381 / 37 | 38 |
| 17 · ordinary · Sacred Harp, Tabernacle | reel ×2 | 90.7 s | −22.7 | **−2.3** | −6.4 | 0 | 0 | 272 / 37 | 46 |
| 23 · Christmas · Shaker, psalmody | reel ×3 | 125.6 s | −22.6 | **−1.0** | −6.5 | 0 | 0 | 400 / 37 | 50 |
| 31 · Easter · Old Way, Tabernacle | quadrille ×2 | 95.3 s | −22.3 | **−1.2** | −6.6 | 0 | 0 | 251 / 37 | 38 |

- **How the levels were set.** Soloed at the first level (seed 4), the
  loudest 3 s were: the fiddle +0.3 LU, the caller −1.4 (too forward), the
  floor −6.4. The caller was brought down 2.4 dB and the floor up 0.8.
  The whole hall went down 2.9 dB from the first render's +1.8 LU, to sit
  between the trombones (about −2 LU after the owner lowered them) and the
  handbells (−1.3 to +1.0).

**The testimony, five Sundays** (`LEVEL` 0.6; `MIX` speaker 1, reeds 0.25,
pews 0.66):

| seed · Sunday · mode | who rises (reed, sentences) | length | integrated | loudest 3 s | peak | clipped | clicks | reed nodes | voices alive |
|---|---|---|---|---|---|---|---|---|---|
| 4 · ordinary · ionian | father (clarinet, 3), pioneer (clarinet, 2), teen (harmonium, 4) | 101.9 s | −23.2 LUFS | **−1.6 LU** | −10.9 dBFS | 0 | 0 | 84 | 42 |
| 11 · fast · dorian | farmer (clarinet, 2), pioneer (clarinet, 2), father (harmonium, 2) | 82.5 s | −23.7 | **−1.9** | −10.0 | 0 | 0 | 61 | 38 |
| 7 · wedding · mixolydian | farmer (harmonium, 2), pioneer (harmonium, 3) | 59.2 s | −24.4 | **−4.6** | −13.0 | 0 | 0 | 63 | 38 |
| 23 · funeral · aeolian | father (harmonium, 2), teen (harmonium, 4) | 66.0 s | −23.7 | **−3.1** | −11.4 | 0 | 0 | 72 | 38 |
| 31 · Pioneer Day · pentatonic | father (harmonium, 3), widow (harmonium, 3), missionary (clarinet, 4) | 101.2 s | −23.5 | **−2.1** | −9.8 | 0 | 0 | 99 | 38 |

- **How the levels were set.** Soloed at the first level, the reeds' loudest
  3 s were 8.6 LU over the speaker's: the reed drowned the voice it
  follows. Now (seed 4) the speaker is −3.5 LU, the reeds −4.9 and the
  pews −18.1.

**The odds** (the lab's stand-in planner, 20,000 meetings: the calendar's
Sundays at their shares, each Sunday's plan, the other guests' dice and
seats):

| Sunday | the Social Hall | a testimony | the bearers speak (of testimonies) |
|---|---|---|---|
| ordinary | 5.0 % | 75.6 % | 78.1 % |
| fast | **0** | 100 % | 93.9 % |
| conference | 1.9 % | 74.8 % | 71.4 % |
| Pioneer Day | **20.5 %** | 75.0 % | 76.5 % |
| Christmas | 12.1 % | 74.8 % | 72.3 % |
| Easter | 7.1 % | 75.8 % | 79.9 % |
| a wedding | **25.0 %** | 38.3 % | 71.9 % |
| a funeral | **0** | 89.4 % | 88.5 % |
| a dedication | 7.2 % | 73.8 % | 66.9 % |
| **every Sunday** | **6.3 %** (one in sixteen) | 77.9 % | 80.1 % (62.4 % of meetings) |

The Social Hall's refusals, as a share of all meetings:
- not this Sunday: 49.1 %;
- beside a guest: 19.0 % (mostly the bands in the doxology, which Pioneer
  Day brings);
- a fast Sunday: 14.5 %;
- a guest holds the postlude: 7.9 %;
- a funeral: 3.2 %.

**Other checks:**

| check | result |
|---|---|
| purity | 12 Sundays: each `prepare`, `score` and `plan` of both, made twice on the same stream, identical; 0 `Math.random` calls while they ran; the Social Hall asked for (forced) at a funeral and on a fast Sunday: refused |
| the planners' refusals (Node) | the hall: forced at Pioneer Day, seated; a funeral: "never at a funeral"; `kind: "fast"` without a Sunday: "never on a fast Sunday"; the steeples in the postlude, and the bands in the doxology: refused. The testimony: a meeting without one, and the old tune in it: refused |
| the tune | 150 hymns × reel and jig (1,200 dance lines): 9,984 of 9,990 hymn notes kept, in order, at their exact pitches; 0 errors; the six dropped in six gospel lines of more than twelve notes |
| the fiddle's rests | the table above |
| the voice's contour | a rendered spoken line's F0 (autocorrelation) followed its written contour, 130 → 185 → 112 Hz |
| the reed's scale by the drone | with `droneMonzo` 45/32 (the drone on a raised fourth) the reed's fourths became 45/32; with the drone on sol (a tone of the mode), the scale unchanged |
| the minutes | the four new actions spelled in Deseret capitals; `Score.validateEvent` passes each as a `cast` event |
| the lab at 860 and 390 px | every button and menu (both plays, stop, both checks, the menus, another Sunday, the odds, purity): 0 console errors or warnings; no sideways scroll (the page's scroll width equals the viewport) |

## The cost (measured, not cut: the owner's ruling)

- **The audio thread.** Offline renders, dry, in headless Chrome on this Mac
  (load average about 4.5):
  - the Social Hall: 20–21× realtime, about 5 % of one core while it plays;
  - the testimony: 35–36× realtime, about 3 %;
  - the v0.30 organ reference, for scale: 73×.

  In a meeting, the house lets go under both (the organ, the harmonium,
  the strings and the clarinet wait), so the net addition is smaller than
  this.
- **Nodes.**
  - The Social Hall: the fiddle builds 251–400 nodes over the dance, at
    most 37 alive. The floor and the hands cost 2 nodes an event (about 400
    over the dance, each alive a few tenths of a second; the applause
    2.6 s). The voices peak at 30–50 alive.
  - The testimony: the reeds build 61–99 (one voice a line: 9 on the
    harmonium, 5 on the clarinet, 7 with its vibrato), at most two lines
    alive. The voices peak at 38–42 (one speaker at a time). The pews cost
    3 an event.
- **The main thread.**
  - The Social Hall: 11.6–14 ms at the press (the benches' sounds baked on
    first use; 2–4 ms if `bake(ctx)` ran in an idle moment); no slice over
    12.8 ms (the floor's first bake); the others under 4 ms; 50 slices.
  - The baking, kind by kind: step 2.5 ms, light 5.3, heavy 7.7, stamp
    5.8, clap 2.6, applause 13, scrape 8.5 (all at once about 45 ms).
  - The testimony: 8–15 ms at the press (the pews baked, the first
    sentence's voice), slices under 1 ms, 18 slices.
  - Warm, `prepare` costs 0.1–0.2 ms for either guest, and `score` under
    1 ms.

## Known issues

- **Nobody has listened.** "What the ear should judge" above is the list.
  All levels were set by measurement, against the organ reference.
- **The Social Hall is refused beside a guest in 19 % of meetings.** This
  is mostly the bands crossing the doxology, and most often on Pioneer Day,
  the very Sunday it is weighted to (20.5 % there, where 49 % is asked).
  PLAN §8.13's rule is kept as written. If the owner wants the bands to
  march out and the fiddle to come in (a Pioneer Day double), that is one
  line in `decide` (let `bands` beside it pass).
- **The fiddle's register.** A tune is kept between G3 and about 1100 Hz
  where it fits, but a Sacred Harp tenor tune can span more than two
  octaves once figured, and then reaches higher (seed 4's reached 1376 Hz).
- **"A quadrille" is one figure,** in 6/8 or 2/4 at a statelier pace, with a
  call before every strain. It is not a five-figure set.
- **The testimony speaks only vowels, m and l.** Its speech may sound
  uniform: there is no n, w, y or h, and no hiss by design. Real Deseret
  phonemes are PLAN §6.5's long-term thread.
- **The reeds are the testimony's own.** They are built in the module, in
  the house's timbres, so they can follow a voice. A change to
  `kolob-voices-winds.js`'s harmonium or clarinet will not reach them.
- **The lab's rooms are one blend a guest.** In the meeting the fiddle, the
  floor and the caller (and the speaker and the reeds) go through separate
  seats at their own depths, so the blend will differ a little from the
  lab's.
- **In the lab, the testimony has no drone.** It plays in the keynote's key.
  In the meeting, `droneMonzo` shapes the reed's scale around the drone.
- **The dance's key is the danced hymn's.** If the house drone is not
  ducked under the dance (recipe 2c), a hymn keyed away from home puts the
  drone on the dance's fourth or fifth.

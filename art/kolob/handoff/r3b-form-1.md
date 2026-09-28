# r3b-form-1: the shape of a visit

*Round 3b, step 4. Branch `kolob-r3b`. 2026-09-28.*

Each visit now draws **a Sunday of the colony year**: one of nine Sundays,
each with its own character. The meeting **rises** from dawn to full light.
The rites between the hymns are **seated**, never two plain ones in a row.
And on most Sundays the drone **reckons**: one note a rite, the opening of
the tune the doxology will sing. Built as though there were no phone to
carry it. The cost was measured and is below.

Nothing was pushed or published, and VERSION is not bumped. A suggested
branch-local line: `v0.35-form.1 — a Sunday of the colony year on the
programme card (nine of them, each its own house, plan, guests, organist
and morning), the meeting rising from dawn to full light, the rites between
the hymns seated, a verse for the men or the women, and the drone spelling
the doxology's tune`. Every check was silent: the Node harness, and headless
Chrome launched with `--headless=new --mute-audio`.

The owner's listening packet for the whole of round 3b is
[`listen-r3b.md`](listen-r3b.md). The server is left running:
`php -S 127.0.0.1:8141 -t /Users/tysonwelsh/Sites/municipal-sky-site-kolob-r3b`.

Commits on `kolob-r3b` (after step 3's `a338443d`):

| commit | what |
|---|---|
| `7831e841` | the Sunday calendar, the arc of light, the rites' seatings and sub-scenes, the Kolob reckoning, the Sunday on the programme card |
| (this) | this note, and the listening packet |

---

## What shipped

### 1. The Sunday calendar (PLAN §7.1): `kolob-calendar.js`, new, pure

- **The draw.** The die that drew the kind of meeting (`meeting:<n>`'s
  former `pickW(CALENDAR)`) now draws the Sunday (`Calendar.draw(u)`). The
  kind follows from the Sunday:
  - ordinary: ordinary, a wedding, a funeral;
  - fast: fast;
  - conference: General Conference, a dedication;
  - jubilee: Pioneer Day, Christmas, Easter.

  Every later die of the plan lands where it did.
- **The character** (`SUNDAYS[id]`, read by every room that should):
  - `plan`: the meeting's shape. How many hymns; the odds of cutting the
    testimony, of an interlude, of trading the testimony and the sacrament,
    of a second doxology (the same dice, read at the Sunday's odds); a
    factor on a rite's length; `silenceMul`, `bright`, `bells`, `meterW`.
    `S.Meeting.sunday()` is the kind's `MEETINGS` row with the plan laid
    over it.
  - `season`: the day's warmth, which feeds the temper and the piper.
  - `guests`: factors on the odds the plan throws itself (the bands ×2.1 on
    Pioneer Day, the steeples ×2.4 at Christmas). The trombones, the
    handbells and the singing school read `info.sunday` in their own
    `ODDS.weight` tables, which were already written for it.
  - `cast`: how many of the ward you come to know (a fast Sunday's three
    testimony-bearers).
  - `organist`: factors on the three organists' odds (`Organist.seat(info.lean)`).
  - `reg`: the Sunday's hand on the organ's stops.
  - `morning`: factors on the prelude's seating.
  - `scenes`: factors on the rites' seatings.
  - `arc`: the Sunday's own light.
  - `dox`: factors on the doxology's dialect (a funeral rises into the
    Tabernacle).
  - `hosanna`: the Hosanna's hook.
- **Handed down.** `sunday` is passed to `Hymnal.plan` (the step-3 hooks
  `SUNDAY_LEAN`, `KIND_LEAN`, read now), `Hymnal.forms` (no round and no
  refrain at a funeral), `GuestTrombones.plan`, `GuestHandbells.plan`,
  `GuestSingingSchool.plan` (never at a funeral), `Organist.seat` and
  `Cast.seat`. No raspberry at a funeral.
- **The programme card** names the Sunday, where it named the kind:
  `getConductor().sunday` = `{id, kind, nameDs, nameEn}`, in the clerk's
  Deseret, or the Latin switch's English. The minutes' meeting row adds it
  (☀ MEETING 1 · ...). Nothing is written on the staff.
- **The Hosanna** (§8.12) is not built. Its hook: the Sunday says whether it
  may come (Easter, a dedication); its die is thrown on `guest:hosanna:<n>`
  (`seat`), so the day it is built nothing else moves. It is unlogged, and
  nothing is told.

### 2. The arc of light (PLAN §7.3)

- **Each rite's light** (`Calendar.light(plan, i, sunday)`, 0–1):
  - dawn: the prelude 0.12, the invocation 0.2;
  - the morning: the hymns rising from 0.4 to 0.66, a rite between them a
    shade under the hymn before it;
  - the stillness: the sacrament 0.08;
  - full light: the doxology 1 (a second doxology 0.92);
  - evening: the postlude 0.4.

  Each Sunday moves these. A funeral's dawn is 0.06–0.1 and its morning
  climbs from 0.2 to 0.52; Easter is lifted 0.1 all day; a fast Sunday's
  morning reaches only 0.5 and its doxology 0.8. The light is on every
  `plan[i]` and on `section-start`.
- **It leans each hymn's dialect** (`Calendar.dialectLean(light)`,
  multiplied into the hymnal's per-hymn draw). Early light favours the
  Sacred Harp ×1.55, the Old Way ×1.6 and the Shakers ×1.45 (the Tabernacle
  ×0.72, gospel ×0.5). Full light favours the Tabernacle ×2.2 and gospel
  ×2.2 (the Sacred Harp ×0.42, the Old Way ×0.28). The house dialect is
  drawn as before.
- **It leans the stops** (`Calendar.regLean(light, sunday)`, −1…+1):
  - the organist's verses: `verseRegs(style, verses, R, lean)`, the same
    four dice read against moved thresholds (full light reaches for the full
    organ; a funeral's organ stays soft);
  - the house's chords on the pipes (`houseReg()`): flutes at dawn and in
    the stillness, the 4′, the pedal and a share of the mixture in full
    light, held within about a decibel of its level (`HOUSE_LEAN_DB`). The
    house organ's notes carry `houseStops`.
- **It replaces the fixed intensity curves.** Every rite's curve is drawn
  from its light (`curveOf(section, x, light)`). At the ordinary lights they
  sit where the old ones did. A rite fades in from the level the last one
  ended at, over a tenth of its length (8–14 s). Read from outside a cue,
  the crossfade holds from the rite's scheduled start.

### 3. Seatings and sub-scenes (PLAN §7.4)

- **The rites' seatings** (`Calendar.scenes`, one die a rite on
  `scenes:<n>`): the invocation, an interlude, the testimony, the sacrament
  and the postlude each draw one of:
  - the plain house;
  - `lined`: lined out only. The deacon lines out even outside a hymn
    (p 0.85), and the ward answers; the organ, the harmonium and the strings
    sit out;
  - `arbor`: the brush arbor. No organ and no harmonium; the strings bow
    bare fifths, even in the invocation or an interlude;
  - `voluntary`: the organ leads;
  - `choir`: the choir alone. The ward hums 2–4 of the day's chords, once,
    early in the rite; the organ, the harmonium and the deacon wait.

  Each Sunday leans them. **THE RULE: never two empty rites running.** A
  hymn, the prelude and a rite a guest is seated in are never empty. When
  two plain rites would meet, the later one's die is read again from the
  seatings that are not plain; if the later one is the sacrament, the rite
  before it takes the seating instead, so the sacrament keeps its
  stillness. The sacrament's only seating besides the plain house is the
  hum.
  - The seatings reach the house through `S.Meeting.lean(layer)` (now every
    rite, not only the prelude), `S.Meeting.sits(layer)` (read by
    `houseRests`), `scene().fifths` (the strings) and `scene().hum` (the
    ward).
  - A typed `scene` event gives the minutes a row (⌖ INVOCATION · LINED OUT
    ONLY).
- **Sub-scenes inside the hymns** (the ones not already there):
  - **A verse by one part** (`kolob-cast.js`, fork `onepart`,
    `ONE_PART_RATE` 0.3). In a Tabernacle or gospel hymn sung by the ward,
    a middle verse (or the first of two) goes to the men (the tenors on the
    tune an octave down, the basses on their own part) or to the women.
    Anyone forward from the other side of the chapel keeps their seat that
    verse. The Performance carries `part: "men" | "women"`, and the
    chorister's cast event "gives the verse to the men/women" gets a ✦ row.
    It was heard 10 times in 45 meetings.
  - **A refrain rising**: +0.9 dB a verse on a hymn's refrain, and on each
    later statement of the wandering refrain (`REFRAIN_RISE_DB`, at most
    2.7).
  - Already present, and left as they were: the fuge, the organist's
    interludes between verses, the treble verse, the hummed verse, the
    quartet, the Primary, the round.

### 4. The Kolob reckoning (PLAN §7.2)

- **The order.** Once every guest and rite's seating is planned, the
  doxology's order carries the sections before it, each with its key (a
  hymn's own; the other rites home) and its mode. The sacrament is marked
  `still` when it is seated plain with no guest: the drone is all there is
  in it.
- **The desk** (`kolob-hymnal.js`, errand `reckon`, the same in the worker,
  which now loads `kolob-calendar.js` too): it writes the doxology — the
  composer's first, then up to 11 more on `hymn:<n>:<i>` → `reckoning:<k>`
  — and keeps the first whose opening stands on every section, one note
  a section. Each note must be within 25 cents of the tonic, the third or
  the fifth of that section's key and mode, or be any note of the day's
  scale in a still sacrament.
  - It tries the tune's own notes first (`by: "notes"`), and then its strong
    notes, the skeleton (`by: "strong"`).
  - The cantus begins in the prelude when the tune's first note is the
    keynote the drone already sounds at dawn (`from: 0`); otherwise in the
    invocation (`from: 1`), with the prelude as dawn on the keynote.
  - If no candidate fits, it keeps the first as written, marked
    `{ok: false}`: **the fallback**, with the drone on the keynote all
    meeting, as before.

  A partner doxology is written once (its tune is the partner's). The
  result is on the hymn: `hymn.reckoning = {ok, k, tries, by, from, n,
  cantus: [{index, type, deg, tuneMonzo, monzo, role, off}]}`.
- **The drone** (`kolob-voices-ground.js`: `S.droneTurn`, `droneNote`,
  `droneReset`). The reckoning is read at the first joint. At each joint
  the drone turns to the next rite's note: the section's own chord tone,
  exact, a comma from the tune's spelling at most, so it never beats
  against the chord. The turn is a 4–6 s exponential glide (on
  `reckoning:<n>` → `glide:<i>`, capped to end before the next rite begins)
  on every sine already sounding and every cycle begun later. The drone
  goes home as the doxology begins.
  - On a third or a fifth, the drone's own twelfth steps back, so it does
    not sound its own fifth against the key.
  - Under a hymn whose tonic the note is not, the drone steps back as it
    does under a keyed hymn (0.22).
  - Its notes carry `monzo`, `keyMonzo`, `role` and `cantus`. The harness
    holds them to the lattice to a cent.
- **The house leans on the drone.** While the drone stands on a cantus note
  other than the keynote, a chord the grammar draws that does not hold the
  note is re-set on the nearest root whose chord does (`Desk.advance`). A
  rite that is not a hymn begins on such a chord (by `drone`) when the chord
  standing does not hold the note. A composed hymn's harmony is its own.
- **The payoff.** The doxology sings the tune. The minutes print one row
  (∿ THE DRONE'S TUNE) as the drone turns home into it. On a Sunday of the
  withheld tune the assembly is that tune, so the two coincide (seed 236).
- **The switch:** `KOLOB.Experimental.reckoning` (on; `?exp=-reckoning`).
  With it off, nothing is ordered, and the drone is the keynote all
  meeting.

### Files

| file | what |
|---|---|
| `kolob-calendar.js` (new) | the Sundays and their characters, the draw, the arc of light, the dialect and stop leans, the rites' seatings and the rule, `reckon()` |
| `kolob-meeting.js` | the Sunday drawn and handed down, the plan and the guests leaned, the lights, the seatings, the Hosanna's hook, the hymn orders placed after the seatings with the reckoning's order, `readReckoning` and `reckonTurn` at the joints (and at a dev jump), the house leaning on the drone, the arc's intensity and its crossfade, `S.Meeting.day/light/lights/scene/scenes/sits/reckoning/hosanna`, and the events |
| `kolob-hymnal.js` | the light's and the doxology's lean on each hymn's dialect, the errand `reckon`, the worker's optional desk file, `prepare(…, rk)` |
| `kolob-voices-ground.js` | the drone's cantus, glides and step-back of its twelfth; the strings bowing an arbor rite's fifths |
| `kolob-voices-organ.js` | the house's stops by the light (`houseReg`, `HOUSE_LEAN_DB`); `houseStops` on its notes |
| `kolob-organist.js` | `seat(info.lean)`; `verseRegs(…, lean)` through `hymnHands(opts.reg)`; "quiet flute" said |
| `kolob-voices-choir.js` | the organist's `reg` from the hymn's light; the choir alone's hum and the lined rite's answers; the drone stepping back under a hymn it is not the tonic of |
| `kolob-voices-winds.js` | the deacon lines out in a lined rite; the harmonium's shadow rests with the house |
| `kolob-cast.js` | the Sunday's cast size (`opts.size`); the verse by one part; the refrain rising; two new actions |
| `kolob-core.js` | `houseRests` reads the rite's seating; `getConductor()` adds `sunday`, `light`, `scene` |
| `kolob-ui.js` | the Sunday on the programme card; the minutes' meeting row, the seatings' rows, THE DRONE'S TUNE, the one-part verse |
| `kolob-score.js` | EVENTS `calendar`, `scene`, `reckoning`, `drone-turn` |
| `kolob-experimental.js` | `reckoning` (on) |
| `_engine.php` | `kolob-calendar.js` after `kolob-experimental.js` |
| `_harness.js` (untracked) | the Sundays' census (`calbase=`, `calseeds`, `reck`), THE SHAPE OF A VISIT (per run: the Sundays, the light, the rule, the one-part verses, the reckoning's turns and glides), `itrace` (the intensity every second). A copy is at `…/scratchpad/_harness.r3b-form.js` |

### Decisions taken (each one line to change)

- The kinds from the Sundays: a wedding and a funeral are ordinary meetings,
  a dedication a conference, the three feasts jubilees
  (`SUNDAYS[id].kind`).
- The prelude is dawn on the keynote unless the tune begins on it
  (`reckon`, alignment A or B).
- The candidates: 12 (`RECKON_CANDIDATES`). The tolerance is 25 cents
  (`TOLERANCE_C`). The tune's own notes are tried before its strong notes.
- The sacrament keeps its stillness under the rule (`KEEPS_STILL`), so the
  testimony before it is usually seated.
- `ONE_PART_RATE` 0.3; `REFRAIN_RISE_DB` 0.9; `HOUSE_LEAN_DB` 1.2;
  `XFADE_S` [8, 14].

---

## What it measures

**The Sundays, planned** (the harness's census, the engine's own planner):

- Seeds 1–200: ordinary 47.5 % (want 45), fast 15.5 (15), conference 11.5
  (12), Pioneer Day 6.5 (8), Christmas 8.5 (6), Easter 4.5 (6), a wedding
  2.5 (4), a funeral 2.5 (3), a dedication 1.0 (1).
- 2,000 first meetings: 46.8, 15.3, 11.4, 8.5, 5.6, 5.3, 3.3, 2.8, 1.1 %.
  Every Sunday is within three standard errors (the harness checks it).

Their characters, over the same 2,000:

| Sunday | house | doxology | hymns | testimony kept | you come to know | organist | guests, the likeliest |
|---|---|---|---|---|---|---|---|
| ordinary | Tabernacle 43, Sacred Harp 24, Old Way 11 % | Tabernacle 54 % | 2 | 76 % | 10.5 | plain 40 % | bands 37, old tune 14 % |
| fast | Sacred Harp 39, Old Way 35 % | Sacred Harp 26, Shaker 24 % | 1 | 100 % | 10.5 (3 testimony) | plain 57 % | old tune 15, school 10 % |
| General Conference | Tabernacle 70 % | Tabernacle 76 % | 3 | 75 % | 11.1 | Victorian 56 % | bands 32, trombones 18 % |
| Pioneer Day | gospel 51, Tabernacle 33 % | gospel 44, Tabernacle 39 % | 3 | 73 % | 11.0 | Victorian 45 % | **bands 79 %**, old tune 23 % |
| Christmas | Tabernacle 47, gospel 26, Shaker 15 % | Tabernacle 51, Shaker (the Primary) 27 % | 3 | 80 % | 10.6 | Victorian 45 % | **handbells 31**, trombones 28 % |
| Easter | Tabernacle 55, gospel 28 % | Tabernacle 66 % | 3 | 65 % | 11.0 | Victorian 45 % | trombones 34, bands 30, handbells 28, steeples 19 % |
| a wedding | Tabernacle 48 % | Tabernacle 61 % | 2 | 41 % | 10.0 | Victorian 48 % | handbells 26 % |
| a funeral | Tabernacle 65, Old Way 15 % | **Tabernacle 80 %** | 2 | 91 % | 9.7 | plain 42 % | trombones 44 %, no bands to speak of |
| a dedication | Tabernacle 91 % | Tabernacle 91 % | 3 | 74 % | 11.5 | Victorian 52 % | bands 30, old tune 26 % |

**The arc of light.** Each hymn's dialect by the light of its rite (6,502
singing rows):

| light | Tabernacle | Sacred Harp | Old Way | psalmody | Shaker | gospel |
|---|---|---|---|---|---|---|
| early (below 0.45) | 30 % | 27 % | 15 % | 12 % | 8 % | 8 % |
| morning (0.45 to 0.9) | 39 % | 17 % | 7 % | 9 % | 11 % | 18 % |
| full (0.9 and up) | 58 % | 10 % | 3 % | 4 % | 11 % | 14 % |

Heard in 20 seeds' first meetings (`arc-measure.js`, the dumps):

| rite | light | open fifths in the hymn's chords | sevenths | the organist's full organ or mixture | the house organ |
|---|---|---|---|---|---|
| prelude | 0.12 | — | — | 0 % | flutes 62 % |
| invocation | 0.20 | — | — | — | flutes 69 % |
| hymn 1 | 0.40 | 18.2 % | 8.4 % | 8 % of the draws | principal 81 % |
| hymn 2 | 0.59 | 24.8 % | 8.4 % | 9 % | principal 100 % |
| hymn 3 | 0.70 | 9.7 % | 12.3 % | 13 % | principal 65 %, full 35 % |
| sacrament | 0.08 | — | — | — | (silent) |
| doxology | 1.00 | 13.6 % | 9.3 % | 21 % | **full 88 %** |
| postlude | 0.44 | — | — | — | principal 100 % |

The intensity, every second (`itrace`): the largest one-second step in a
whole run is now 0.12 at the median (0.15 at most, the fuging's own lift)
over 24 seeds. The build from before round 3b gave 0.35 (0.49 at most), at
every joint.

**The rites' seatings** (2,000 first meetings):

- the invocation: plain 31 %, lined 23, arbor 17, voluntary 16, choir 13;
- the testimony (in 1,565 of the meetings): choir 44 %, arbor 23, lined 15,
  plain 9, voluntary 9 (the rule seats it);
- the sacrament: plain 85 %, choir 15;
- the postlude: voluntary 42 %, plain 25, arbor 17, choir 16.

The rule sat 497 times (a quarter of meetings). Two empty rites running:
0. A verse by one part: 10 in 45 meetings.

**The reckoning:**

- **Its rate** (600 doxologies written by the desk and read, seeds 1–600):
  70.7 % reckoned.
  - 249 by the tune's own notes, 175 by its strong notes.
  - 111 begin in the prelude, 313 in the invocation.
  - On the composer's first doxology 122 times; the other 302 on candidates
    2 to 12.
  - 29.3 % fell back.
  - The desk wrote each in 69 ms at the median, 1.35 s at the most (Node,
    with its earlier hymns; in the browser's worker, 21–375 ms, below).
- **Heard in 20 seeds' meetings:** 100 drone turns, 94 of them glides; **0
  under a sung line**. They landed as tonic 32, third 28, fifth 28, alone
  in the still sacrament 12.
- **Does it sound good?** Measured on the same 20 seeds, reckoned and with
  `exp=-reckoning` (`reckon-measure.js`): for every half-second with a
  harmony sounding (the house and the ward, the drone aside), is the
  drone's pitch class in the chord, and does anything sound a second
  against it?

| | in the chord | a second against it |
|---|---|---|
| **the reckoning** | 61.9 % | 38.9 % |
| the keynote drone (the fallback) | 68.1 % | 38.6 % |
| the testimony | 58.2 vs 73.9 % | **18.3 vs 27.0 %** |
| the invocation | 56.5 vs 68.8 % | 34.0 vs 26.1 % |
| the hymns (the drone at 0.22 where it is not the tonic) | 61.2 vs 66.1 % | 42.1 vs 42.6 % |
| the doxology (home) | 66.7 vs 69.3 % | 39.2 vs 35.1 % |

  **Reading it.** The moving drone clashes no more than the keynote did,
  over the whole meeting, but it is a chord tone somewhat less often: the
  keynote is in more of the house's own chords (I, IV, vi) than any other
  note. The house leaning on the drone won back the testimony, not the
  invocation, where the organ writes a chord only now and then. The
  reckoning is kept, and on (the plan's condition, "if it sounds good by
  measurement"): no worse by the clash measure, a little less consonant by
  membership. The owner's ear decides, with `?exp=-reckoning` for the A/B.

**Distinctness** (`tools/distinctness.js`, the first 180 s of seeds 1–30):

| build | median pair D | p10 | p90 | closest | against the planted twin | near-twins |
|---|---|---|---|---|---|---|
| before round 3b (`3fc476ae`) | 0.589 | 0.477 | 0.697 | 0.360 | 9.9× | none |
| step 3 (`a338443d`) | 0.605 | 0.491 | 0.704 | 0.318 | 4.9× | none |
| **this build** (`7831e841`) | **0.626** | **0.495** | **0.733** | 0.332 | 7.5× | none |

- The median, p10 and p90 all rose, against both builds.
- The closest pair is a shade closer than before round 3b (seeds 19 and 24,
  two ordinary Tabernacle Sundays). The planted twin moved too: seed 1 is
  now a funeral whose semitone-higher twin shares everything but pitch.
- The Sunday now feeds the distance's identity group (it used to be an empty
  hook), and so do the cast and the registration.
- What separates least is the voice's and the drone's density and the
  prelude's length.

---

## What it costs (measured, not cut)

**Seed 17, the whole first meeting (1,150 s), muted Chrome.** This build
(port 8141) and the build from before round 3b (v0.35, `3fc476ae`, served
from an archive on 8143) played side by side in two Chromes, so both ran at
the same load (the machine's load average was 4). The same method as steps 1
to 3 (`trace.js`): Chrome's trace of the render callbacks, summed a second
at a time; `renderCapacity` once a second; the WebAudio domain's nodes. The
two meetings differ, because the calendar changed the dice: both are a
conference with the trombones at dawn.

| | this build | v0.35 (before round 3b) |
|---|---|---|
| the audio thread's share of each second: median · p90 · worst 5 s · worst second | **20.3 % · 31.6 % · 35.7 % · 38.0 %** | 14.7 % · 20.6 % · 27.1 % · 28.2 % |
| Chrome's render capacity: median · p90 · max | 20.1 % · 35.2 % · **67.4 %** | 14.4 % · 25.8 % · 50.5 % |
| one render callback (5.33 ms of audio): median · p99 · max | 1.05 ms · 2.54 ms · **5.14 ms** | 0.76 ms · 2.01 ms · 3.72 ms |
| nodes the context holds, at the most (created) | **2,863** (40,718) | 455 (8,028) |
| the ward's own nodes by its ledger: peak · mean | 2,010 · 263 | — |
| clock cues late · the ward's lines late | 0 of 7,677 · 0 of 1,523 | 0 |

By rite, this build (render capacity median · max; the nodes, at the most):

| rite (seed 17) | capacity | nodes |
|---|---|---|
| prelude, the trombones (0:00–1:24) | 21.3 % · 52.0 % | 409 |
| invocation, the drone's first turn (1:24–2:49) | 19.9 % · 38.3 % | 232 |
| hymn 1, gospel's quartet (2:49–5:35) | 22.7 % · 65.9 % | 1,899 |
| hymn 2, the Sacred Harp by the ward (5:35–8:20) | 27.4 % · 67.4 % | 2,616 |
| hymn 3, a round (8:20–10:51) | 21.7 % · 49.4 % | 2,863 |
| testimony, the ward humming (10:51–13:10) | 16.7 % · 62.4 % | 795 |
| sacrament (13:10–15:28) | 12.5 % · 35.7 % | 477 |
| doxology, the full organ (15:28–17:47) | 28.9 % · 48.7 % | 2,669 |
| postlude (17:47–19:10) | 15.1 % · 47.8 % | 750 |

**The composer's desk in the browser** (the worker; `KOLOB.Hymnal.book()`):

- The reckoned doxology took 21 ms (seed 3: 5 candidates), 109 ms (seed 17:
  10) and 375 ms (seed 9: 8).
- A partner doxology, written once, took 601–668 ms (seeds 18 and 10), as
  before this step.
- The other hymns took 5–56 ms. Every one was back within seconds of ▶, and
  none was late.

**Reading it.**

- **Round 3b as a whole costs about 1.4 times the audio thread of v0.35**
  at the median, and 1.5 times at the p90. The worst callback came to
  5.14 ms of a 5.33 ms buffer; before round 3b the worst was 3.72 ms. The
  worst seconds of render capacity (66–67 %) are in the hymns the whole ward
  sings. On a loaded machine those peaks are where a glitch would come
  first.
- **The weight is the ward**, as steps 1 to 3 found: the nodes peak in the
  hymns (1,900–2,900), against 230–800 in the rites around them.
- **This step's own additions are light on the audio thread.**
  - The drone's glide is automation on sines already sounding.
  - A seated rite is a few hummed chords of the ward (the testimony: 795
    nodes at the most) or the strings' bare fifths.
  - The calendar and the light are planning.
- **The reckoning's cost is the composer's**, off the audio path.

Nothing was thinned.

---

## How it was checked (all silent)

- **The harness, 24 seeds × 1,200 s** (1–20, and 37, 181, 209, 236 for
  Easter, a dedication and two funerals), on the final build: 22 pass.
  Seeds 17 and 37 fail only on the trombone choir's compass (91.7 Hz, 97.8 Hz
  and 484.1 Hz): the known GUEST issue, unchanged since step 1. THE SHAPE
  OF A VISIT reports 0 problems in all 24:
  - every Sunday one of the calendar's, told as its kind;
  - no rite brighter than the doxology, none darker than the sacrament;
  - never two empty rites running;
  - every drone turn a tonic, third, fifth, alone or home;
  - no glide under a sung line, and none running into the next rite;
  - every drone note in the lattice to a cent (the pitch check).
- **The same 20 seeds with `exp=-reckoning`**: the same passes.
- **REPRO passes** on seeds 3 (reckoned by the tune's notes, from the
  invocation), 236 (a funeral, reckoned by the strong notes, from the
  prelude, the tune withheld), 7 (a wedding; before the final touch) and 1
  (a funeral; before the final touch). In each: the same seed twice, then
  jittered timers, then re-salted sound streams, and the score is identical
  byte for byte.
- **TRANSPORT passes** on seed 9 (stopped at 150 and at 330 s: 0 stale
  sources reach the hall).
- **The census** over 2,000 and over 200 (seeds 1–200) first meetings, as
  above. Every step-3 rule still holds: no partner with the assembly, no
  refrain on a fast Sunday or at a funeral, no band in a doxology paid off
  by another, no handbells with the steeples, no singing school outside the
  prelude.
- **The browser** (muted headless Chrome, CDP 9461, PHP on :8141):
  - `index.php` (seeds 17, 236 in Latin) and all twelve labs at 860 and
    390 px: 0 console errors, no horizontal scroll.
  - The programme card at 390 px holds GENERAL CONFERENCE and AN ORDINARY
    SUNDAY in Deseret on one line.
  - Seed 17, played 88 s: the reckoning read at 1:16.7 and the drone's first
    turn (4.443 s, to 91.786 Hz), then the invocation at 1:24.5, as the
    harness has them. 0 errors, 0 late cues.
  - A jump to seed 17's doxology read the reckoning at once, with 0 errors.
  - Seeds 236 and 37 played: 0 errors.
  - The whole of seed 17's first meeting (19 minutes, traced below): 0
    errors, 0 of 7,677 cues late, 0 of the ward's 1,523 lines late.
  - The composer's desk in the browser, for seeds 3, 9, 10, 17 and 18: every
    hymn written in the worker, none late.

---

## Requests

1. **Integrator: SCORE §11.8** — the shape of a visit, as built. It can be
   adopted as written:
   - **Modules:** `kolob-calendar.js` (pure) after `kolob-experimental.js`;
     the composer's worker loads it when the page has it
     (`DESK_OPTIONAL`).
   - **Streams:**
     - `meeting:<n>`: the die that drew the kind draws the Sunday; the second
       doxology's die is a plain `next()` read at the Sunday's odds (the
       jubilee's 0.5 as before).
     - new `scenes:<n>`: a die a rite, and `hum:<i>`.
     - new `reckoning:<n>`: `glide:<i>`, `pedal:<i>`.
     - new `guest:hosanna:<n>`: `seat` (a hook, thrown, unused).
     - `hymn:<n>:<i>` → `reckoning:<k>`: the doxology's candidates.
     - `hymn:<n>:<i>` → `performance` → `onepart`.
   - **Score:**
     - `Hymn.reckoning` (dev): `{ok, k, tries, by, from, n, cantus}`;
     - `Performance.part`: `"men"` | `"women"`;
     - the plan's `onePart` and `rise`.
   - **Events:**
     - `meeting-start.sunday` is the calendar's id, and `sundayDs` rides
       along;
     - `section-start` adds `light` and `scene`; `liahona` adds `sunday`;
     - new `calendar {n, sunday, kind, nameDs, hymns, lights, rites, scenes,
       reckoning}`;
     - new `scene {section, index, scene, forced, sits, light}`;
     - new `reckoning {ok, doxId, from, k, tries, by, n, cantus, why}`;
     - new `drone-turn {at, index, section, to, role, k, deg, glide,
       fromHz, toHz, home, dox}`;
     - the cast actions "gives the verse to the men" and "… to the women".
   - **Notes:**
     - the drone's, off the keynote: `monzo`, `keyMonzo`, `role`,
       `cantus`; a turn also carries `glide` and `from`;
     - the house organ's: `houseStops`.
   - **`S.Meeting`:**
     - `sunday()` is the kind's row with the Sunday's plan over it;
     - new `day()`, `light()`, `lights()`, `scene()`, `scenes()`,
       `sits(layer)`, `reckoning()`, `hosanna()`;
     - `lean(layer)` now reads every rite's seating.
   - **`KolobAudio.getConductor()`** adds `sunday`, `light` and `scene`.
   - **`KOLOB.Experimental`** adds `reckoning`.
   - **The organist:** `seat(info.lean)`, `hymnHands(opts.reg)`.
   - **The cast:** `Cast.seat(opts.size)`.
   - **The hymnal:** `Hymnal.plan(info.sunday, sections[].light)`, and
     `prepare(…, rk)`.
2. **Integrator:** VERSION at publish. Also copy the harness from
   `…/scratchpad/_harness.r3b-form.js` into kolob-2.
3. **HYMN crew:** an `incipit` option for `compose()` (fix the first line's
   first onsets). With it, the section keys could be chosen for the cantus
   first and the doxology written to it, as the plan put it. Today the
   doxology is chosen for the keys, from up to 12 candidates, and 29 % of
   Sundays fall back. The step-3 requests on the partner and the round
   stand.
4. **HYMN crew / FORM:** the doxology's sevenths. At full light the Tabernacle
   carries the doxology (58 %) and gospel only 14 %, so the ringing chord
   is rare at the end. A Tabernacle setting that reaches for its V7s and
   secondary dominants when it is a doxology would give the plan's
   "sevenths at full light" without changing the dialect mix.
5. **CAST crew:** the testimony-bearers are still seated, not heard. The
   testimony is now the rite the rule seats most (91 % of testimonies).
6. **GUEST crew:** the Hosanna (the hook is in: `C.hosanna`, Easter and a
   dedication, unlogged); the trombone choir's compass (seeds 17, 37).
7. **ENGRAVE crew:** the drone's turns might be shown on the staff as the
   drone's note (the drone is not engraved today). Nothing of the calendar
   is written on the staff, per the owner's rule.

## Known issues

- **Tuned by measurement and by rule, not by ear.** The knobs:
  - the Sundays' characters (`SUNDAYS`) and the arc (`ARC`,
    `LIGHT_ANCHORS`);
  - the seatings (`SCENE_ODDS`);
  - `RECKON_CANDIDATES`, `ONE_PART_RATE`, `REFRAIN_RISE_DB`,
    `HOUSE_LEAN_DB`.
- **The reckoning's consonance** is the measured trade above. The moving
  drone is a chord tone less often than the keynote was.
- **The "strong notes" reading** is a skeleton (the stressed syllables). The
  literal first notes are used when any candidate fits them (59 % of the
  reckoned Sundays).
- **A still sacrament's note** ("alone") can meet the tines or a hymn rung
  on the handbells elsewhere in the rite. A guest seated in the sacrament
  makes it not still.
- **The testimony is seated on most Sundays** (the rule and the sacrament's
  stillness).
- **The arc's "sevenths"** hardly rise; see Request 4.
- **A rite's intensity** crossfades, but the fuging's own step (+0.12)
  remains.
- **The minutes print THE DRONE'S TUNE on every reckoned Sunday.** On a
  Sunday of the withheld tune the assembly's row follows it at once.

## Where the measurements live

`/private/tmp/claude-501/-Users-tysonwelsh-Sites-municipal-sky-site/9f8f9e47-5fee-4146-97e4-e448a823ca04/scratchpad/r3b-form/`:

- the tools:
  - `batch.js`: harness batches;
  - `reckon-measure.js`: the drone against the harmony, the glides;
  - `arc-measure.js`: the arc by rite;
  - `listen-index.js`: the listening index;
  - `scene-check.js`: what sounds in a seated rite;
  - `jump.js`, `smoke.js`, `card.js`, `labs.js`: the browser;
  - `trace.js`, `windows.js`: the audio thread.
- the results:
  - `b5/`: the final 24 seeds, dumps, logs, `itrace`;
  - `b5off/`: the same seeds without the reckoning;
  - `b4base/`: the pre-3b build, with `itrace`;
  - `census2000b.log`, `census200.log`, `census600r2.log` (the reckoning);
  - `dist-new/`, `dist-base/`, `dist-step3/`;
  - `repro-*.log`, `transport9c.log`;
  - `idx-b5.txt`: every seed's listening index;
  - `tr-17-new.json`, `tr-17-v035.json`: the traces.
